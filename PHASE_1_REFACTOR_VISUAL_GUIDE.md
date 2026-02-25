# Architectural Refactor: Visual Comparison

## Before vs After

### BEFORE: Monolithic Sprawl

```
┌──────────────────────────────────────────────────────────┐
│  compute() [~500 lines]                                  │
│                                                           │
│  Fetch Data                                              │
│  ├── priceOracle.getPrice()                             │
│  ├── ccxtService.getOrderBooks()                        │
│  ├── dexService.getLiquidity()                          │
│  └── indicators.calculate()                             │
│                                                           │
│  Analyze Data                                            │
│  ├── Compare CEX prices                                 │
│  ├── Detect arbitrage                                   │
│  ├── Calculate technicals                               │
│  └── Compute confidence [just "did we get data?"]      │
│                                                           │
│  Decide & Assemble                                       │
│  ├── Query user portfolio                               │
│  ├── Call Morio agents                                  │
│  └── Return AssetState                                  │
│                                                           │
│  Problems:                                               │
│  ✗ WebSocket can't reuse partial layers                │
│  ✗ Alerts engine needs custom logic                    │
│  ✗ Backtesting can't reuse synthesis                   │
│  ✗ Everything tightly coupled                          │
│  ✗ 500+ lines = hard to test                           │
└──────────────────────────────────────────────────────────┘

Consumers must call full compute():
┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐
│   Dashboard     │  │    WebSocket    │  │    Alerts    │
└────────┬────────┘  └────────┬────────┘  └──────┬───────┘
         │                    │                   │
         └────────────────────┼───────────────────┘
                              │
                      ┌───────▼───────┐
                      │   compute()   │
                      └───────────────┘
                              │
                    (Recomputes everything)
```

---

### AFTER: Modular Four-Step Pipeline

```
┌────────────────────────────────────────────────────────────────────┐
│ compute()                                                           │
│ Orchestrates four reusable steps                                   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
┌────────────────────▼──────────────────┐
│ Step 1: fetchRawLayers()              │
│ Responsibility: Get data              │
│ Returns: { price, cex, dex, tech }   │
│ Size: ~50 lines                       │
│                                       │
│ ├── priceOracle.getPrice()           │
│ ├── ccxtService.getOrderBooks()      │
│ ├── dexService.getLiquidity()        │
│ └── indicators.calculate()            │
│                                       │
│ Reusable By:                          │
│ • WebSocket (emit partial updates)    │
│ • Historical analysis                 │
│ • Simulations                         │
└────────────────────┬──────────────────┘
                     │
┌────────────────────▼──────────────────────┐
│ Step 2: computeDerivedMetrics()           │
│ Responsibility: Analyze raw data          │
│ Returns: { crossExchange, regime, conf }  │
│ Size: ~100 lines                          │
│                                           │
│ ├── analyzeCrossExchange()               │
│ │   ├── arbitrageDetector.detect()      │
│ │   └── spreadAnalysis()                │
│ ├── detectRegime()                       │
│ │   ├── volatilityRegime from vol       │
│ │   ├── liquidityRegime from spread     │
│ │   └── marketPhase from price/volume   │
│ └── calculateMeaningfulConfidence()     │
│     ├── dataFreshness                   │
│     ├── exchangeAgreement              │
│     ├── liquidityQuality               │
│     ├── spreadStability                │
│     └── indicatorAlignment             │
│                                           │
│ Reusable By:                              │
│ • Alerts engine                           │
│ • Risk management system                 │
│ • Backtesting engine                      │
│ • Position sizing calculator              │
└────────────────────┬──────────────────────┘
                     │
┌────────────────────▼─────────────────────┐
│ Step 3: synthesizeIntelligence()         │
│ Responsibility: Combine into signals     │
│ Returns: { aiInsights, warnings, conf }  │
│ Size: ~50 lines                          │
│                                          │
│ ├── getAISignal() [optional]            │
│ │   └── morioAgents.generateSignal()   │
│ ├── generateWarnings()                  │
│ │   ├── volatility warnings             │
│ │   ├── liquidity warnings              │
│ │   └── exchange disagreement alerts    │
│ └── Package confidence breakdown        │
│                                          │
│ Reusable By:                             │
│ • Execution system                       │
│ • Recommendation engine                  │
│ • Dashboard intelligence layer           │
│ • Notification system                    │
└────────────────────┬─────────────────────┘
                     │
┌────────────────────▼──────────────────────┐
│ Step 4: assembleAssetState()              │
│ Responsibility: Format for consumers      │
│ Returns: Complete AssetState              │
│ Size: ~30 lines                           │
│                                           │
│ ├── Tier 1: marketState                 │
│ ├── Tier 2: userContext (optional)      │
│ ├── Tier 3: intelligence (optional)     │
│ └── metadata + status                    │
│                                           │
│ Passed To:                                │
│ • Dashboard display                       │
│ • Yuki trading platform                   │
│ • WebSocket event stream                 │
│ • REST API responses                      │
│ • Cache system                            │
└──────────────────────────────────────────┘

Consumers can now call reusable steps:
┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
│   Dashboard      │  │   WebSocket      │  │    Alerts    │
└────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘
         │                     │                   │
         │                     │              (Calls Step 2 only,
    (Calls all 4         (Calls Step 1          reuses metrics
     steps for              frequently,         from cache)
     full detail)           Step 2-4 cached)
         │                     │                   │
         └────────────────────┼───────────────────┘
                              │
                    (All can reuse pieces)
```

---

## Data Model: Three-Tier Separation

### Before: Flat Object (Mixed Truth Values)

```typescript
interface AssetState {
  // Mix of objective + subjective + synthetic
  current: number;                    // Objective (price)
  change24h: number;                  // Objective (market data)
  cex: { ... };                       // Objective (external APIs)
  dex: { ... };                       // Objective (external APIs)
  technicals: { ... };                // Objective (calculations from price)
  userContext?: { ... };              // Subjective (user's portfolio)
  aiInsights?: { ... };               // Synthetic (computed output)
  confidence: number;                 // How confident? (just "got data?")
  crossExchange?: { ... };            // Mix of objective + synthetic
}

Problems:
✗ Can't tell objective from subjective
✗ Hard to aggregate for multi-user consensus
✗ Backtesting doesn't know what's "historical reality"
✗ Can't separate "what is" from "what to do"
```

### After: Three-Tier Model (Clear Separation)

```typescript
interface AssetState {
  // ═══════════════════════════════════════════════════════════
  // TIER 1: Market State (Objective External Reality)
  // ═══════════════════════════════════════════════════════════
  marketState: MarketState & {
    // Pure external truth—regardless of user
    price: {
      current: number;              // Objective fact
      change24h: number;            // Objective fact
      volatility: { current, trend };
    };
    
    cex: {
      sources: [ { exchange, bid, ask, spread, volume, timestamp } ];
      best: { buy?, sell? };
      depth: { bidDepth, askDepth, quality };
    };
    
    dex: {
      sources: [ { protocol, liquidity, slippage, fee, timestamp } ];
      best?: { protocol, slippage };
    };
    
    crossExchange: {
      spread: { average, trend };
      arbitrage: { opportunities };
    };
    
    technicals: {
      rsi?: { value, signal };
      macd?: { line, signal, histogram };
      movingAverages?: { ma20, ma50, ma200 };
      trend?: { direction, strength };
    };
    
    regime: {
      marketPhase: 'accumulation' | 'expansion' | 'distribution' | 'capitulation';
      volatilityRegime: 'low' | 'normal' | 'high' | 'extreme';
      liquidityRegime: 'deep' | 'normal' | 'thin';
    };
    
    timestamp: number;
  };
  
  // ═══════════════════════════════════════════════════════════
  // TIER 2: User Context (Subjective User Data)
  // ═══════════════════════════════════════════════════════════
  userContext?: {            // Only present if user context provided
    holding?: {
      amount: number;        // How much user holds
      value: number;         // USD value
      allocation: number;    // % of portfolio
    };
    performance?: {
      unrealizedPnL: number;
      unrealizedPnLPercent: number;
    };
    role?: 'trader' | 'investor' | 'arbitrageur' | 'holder';
  };
  
  // ═══════════════════════════════════════════════════════════
  // TIER 3: Intelligence Layer (Synthetic Outputs)
  // ═══════════════════════════════════════════════════════════
  intelligence?: {           // Only present if user context provided
    aiInsights?: {
      primarySignal?: {
        action: 'BUY' | 'SELL' | 'HOLD' | 'MONITOR' | 'ARBITRAGE';
        confidence: number;
        reasoning?: string;
      };
      warnings?: [{
        type: string;
        severity: 'critical' | 'warning' | 'info';
        message: string;
      }];
    };
    
    confidence: {
      overall: number;            // 0-100, weighted average
      dataFreshness: number;      // How recent? (0-100)
      exchangeAgreement: number;  // Do all CEX match? (coefficient of variation)
      liquidityQuality: number;   // Spread+depth score (0-100)
      spreadStability: number;    // Been stable? (0-100)
      indicatorAlignment: number; // RSI/MACD/MAs agree? (0-100)
    };
  };
  
  identification: { symbol, pair, category };
  status: { dataFreshness, isLiquid, lastUpdated };
}
```

### Benefits of Three-Tier Model

**Scenario 1: Multi-User Consensus**
```typescript
// Aggregate market state across users (Tier 1)
const consensusMarketState = {
  price: average(all.map(s => s.marketState.price)),
  cex: mergeExchanges(all.map(s => s.marketState.cex)),
  technicals: average(all.map(s => s.marketState.technicals)),
};

// Each user keeps own context (Tier 2) + personalized insights (Tier 3)
users.forEach(user => {
  user.assetState = {
    marketState: consensusMarketState,   // Shared
    userContext: user.portfolio,          // Personal
    intelligence: synthesize(...)         // Personal
  };
});
```

**Scenario 2: Backtesting**
```typescript
// Use Tier 1 logic with historical data
for (const candle of historicalCandles) {
  const tier1 = computeTier1(candle);           // Historical price/technicals
  const tier2 = getHistoricalContext(userId);   // User's holdings at time T
  const tier3 = synthesizeIntel(tier1, tier2);  // What would engine recommend?
  
  // Same logic as live, different data source
  validate(backtest.recommendedAction, actual.action);
}
```

**Scenario 3: DAO Insights**
```typescript
// What's the market doing? (Tier 1)
const regimes = aggregateRegimes(
  allAssets.map(a => a.marketState.regime)
);

// What are members doing? (Tier 2)
const memberAllocations = averageAllocationPercents(
  allMembers.map(m => m.userContext.allocation)
);

// What should the DAO recommend? (Tier 3)
const daoRecommendation = buildConsensus(regimes, memberAllocations);
```

---

## Confidence Breakdown: From Cosmetic to Meaningful

### Before: Cosmetic Confidence

```typescript
private calculateConfidence(cexData: any, dexData: any): number {
  let confidence = 50;
  
  // Just checking: "did we get data?"
  const cexSources = cexData.sources?.length ?? 0;
  confidence += Math.min(cexSources * 10, 25);
  
  const dexSources = dexData.sources?.length ?? 0;
  confidence += Math.min(dexSources * 5, 15);
  
  return Math.min(confidence, 100);  // 50-90, no insight
}

// Result: "Got 2 CEX + 1 DEX = 75% confident"
// Problem: Doesn't tell us ANYTHING about market state
```

### After: Meaningful Confidence

```typescript
private calculateMeaningfulConfidence(rawLayers, crossExchange): ConfidenceMetrics {
  // 1. Data Freshness: How recent is the price?
  const dataFresh = Math.max(0, 100 - (ageMs / 600));
  // 100 if < 1s old, 0 if > 60s old
  
  // 2. Exchange Agreement: Do all CEX agree?
  const agreementCoeff = calculateCoefficientOfVariation(cexPrices);
  const exchangeAgreement = Math.max(0, 100 - agreementCoeff * 100);
  // All within 0.1% = 100, spread > 1% = 0
  
  // 3. Liquidity Quality: Is the spread tight?
  const liquidityQuality = measureSpreadTightness(avgSpread);
  // < 0.05% spread = 100, > 1% spread = 0
  
  // 4. Spread Stability: Is it consistent?
  const spreadVar = calculateVariance(lastFiveMinSpreads);
  const spreadStability = 100 - (spreadVar * 10);
  // Stable = 100, volatile = 0
  
  // 5. Indicator Alignment: Do technicals agree?
  const rsiSignal = technicals.rsi.signal;
  const macdTrend = technicals.macd.histogram > 0 ? 'up' : 'down';
  const maTrend = trend.direction;
  const indicatorAlignment = measureAgreement([rsiSignal, macdTrend, maTrend]);
  // All same = 100, mixed = 50, disagreement = 25
  
  // Weight them: freshness most critical
  const overall = Math.round(
    dataFresh * 0.25 +          // Most important: stale data = wrong decisions
    exchangeAgreement * 0.2 +   // CEX disagreement suggests problems
    liquidityQuality * 0.2 +    // Tight spread = can actually execute
    spreadStability * 0.15 +    // Consistency for slippage prediction
    indicatorAlignment * 0.2    // Technical confirmation
  );
  
  return { overall, dataFresh, exchangeAgreement, liquidityQuality, spreadStability, indicatorAlignment };
}

// Result:
// {
//   overall: 78,
//   dataFreshness: 95,         // Price is fresh (< 2s old)
//   exchangeAgreement: 72,     // CEX prices agree within 0.2% (good)
//   liquidityQuality: 85,      // Spread is 0.08% (tight)
//   spreadStability: 65,       // Spread has been consistent
//   indicatorAlignment: 80     // RSI, MACD, MAs mostly aligned
// }
```

### What This Powers

**Risk Management:**
```typescript
if (confidence.overall < 50) {
  // Low confidence—be defensive
  positionSize *= 0.5;        // 50% smaller
  stopLoss *= 2;              // 2x wider
  useMarketOrders = true;     // Guarantee fill
}

if (confidence.exchangeAgreement < 40) {
  // Exchanges disagree—could be arbitrage or bad data
  pauseTrading();
  triggerAlert('EXCHANGE_DISAGREEMENT');
}

if (confidence.dataFreshness < 60) {
  // Price data is stale—can't trust
  pauseTrading();
  triggerAlert('DATA_LAG');
}
```

**Execution:**
```typescript
if (confidence.liquidityQuality > 80) {
  executionMode = 'patience';     // Use limit orders
  timeToFill = '30 seconds';
} else if (confidence.liquidityQuality > 60) {
  executionMode = 'vwap';         // Smart execution
  timeToFill = '5 minutes';
} else {
  executionMode = 'market';       // Just fill it
  timeToFill = 'immediate';
}
```

**Alerts:**
```typescript
// Only alert when confidence is good
if (confidence.overall > 70 && signal === 'BUY') {
  triggerAlert('HIGH_CONFIDENCE_BUY');
}

// Ignore signals when confidence is bad
if (confidence.overall < 50) {
  ignoreSignal(signal);
  triggerAlert('CONFIDENCE_TOO_LOW');
}
```

---

## Regime Detection: Making Engine Trade-Aware

### The Regime Concept

```
Market Cycle:
     ╱─────────────────╲
    ╱ Accumulation     ╲
   │  Smart money      │
   │  buying quietly   │  ╱─────────────────────╲
   │  Price: sideways  │ ╱ Expansion           ╲
   │  Vol: low         ├─ Momentum builds       ├─ Distribution
   │  Action: BUY     │ │ Price: up sharply     │  Smart money
    ╲                 │ │ Vol: increasing       │  selling
     ╲               │  │ Action: HOLD/ADD     │  Price: up then down
      ╲_____________╱   ╲                     │  Vol: declining
                         ╲___________________╱
                                  │
                                  │ Capitulation
                                  │ Panic selling
                                  │ Action: HOLD/wait
                                  ▼
```

### Implementation

```typescript
regime: {
  marketPhase: 'accumulation' | 'expansion' | 'distribution' | 'capitulation',
  volatilityRegime: 'low' | 'normal' | 'high' | 'extreme',
  liquidityRegime: 'deep' | 'normal' | 'thin'
}
```

**Volatility Regime** (from current volatility):
```
volatility > 3%        → 'extreme'  (panic selling/FOMO)
volatility 2-3%        → 'high'     (strong conviction buying/selling)
volatility 1-2%        → 'normal'   (healthy market)
volatility < 1%        → 'low'      (consolidation)
```

**Liquidity Regime** (from spread):
```
spread < 0.1 bps       → 'deep'     (major venue, huge interest)
spread 0.1-0.3%        → 'normal'   (healthy liquidity)
spread > 0.3%          → 'thin'     (low interest, hard to execute)
```

**Market Phase** (from price vs MAs + volume):
```
TODO: Determine from:
  • Price vs MA200 (primary trend)
  • Volume profile (is volume increasing or decreasing?)
  • Momentum indicators (Is trend accelerating or slowing?)
```

### How Regime Powers Decisions

```typescript
// ALERTS
if (regime.marketPhase === 'accumulation' && technicals.rsi < 30) {
  triggerAlert('EXTREME_DISCOUNT_IN_ACCUMULATION');  // Strong buy signal!
}

if (regime.volatilityRegime === 'extreme') {
  triggerAlert('EXTREME_VOLATILITY_WARNING');  // Be careful!
}

// STRATEGY SELECTION
const strategyForRegime = {
  'expansion': 'trend-following',      // Trade momentum
  'accumulation': 'mean-reversion',    // Buy dips
  'distribution': 'trend-fading',      // Sell rips
  'capitulation': 'wait-for-recovery'  // Don't trade
};

strategy = selectStrategy(strategyForRegime[regime.marketPhase]);

// EXECUTION MODES
if (regime.liquidityRegime === 'deep') {
  executionMode = 'patience';         // Time to get best fill
  useLimit = true;
} else if (regime.liquidityRegime === 'thin') {
  executionMode = 'market-only';      // Just get filled
  useMarket = true;
}

// RISK ADJUSTMENTS
var stopLoss = 0.02;  // Default 2%
switch (regime.volatilityRegime) {
  case 'extreme':
    stopLoss = 0.04;  // 4% in extreme vol
    break;
  case 'high':
    stopLoss = 0.03;  // 3% in high vol
    break;
  case 'low':
    stopLoss = 0.01;  // 1% in low vol (tight)
    break;
}

// POSITION SIZING
var baseSize = 1.0;  // 100% base allocation
var sizedPosition = baseSize * getPhaseMultiplier(regime.marketPhase);

function getPhaseMultiplier(phase) {
  switch(phase) {
    case 'expansion':
      return 1.5;     // 150% in strong uptrend
    case 'accumulation':
      return 1.2;     // 120% in opportunities
    case 'distribution':
      return 0.5;     // 50% reduce exposure
    case 'capitulation':
      return 0.3;     // 30% very defensive
  }
}
```

---

## Summary: What Changed & Why

| Aspect | Before | After | Benefit |
|--------|--------|-------|---------|
| **Computation** | Monolithic `compute()` | Four independent steps | `fetchRawLayers()` callable by WebSocket, Alerts callable from `computeDerivedMetrics()` |
| **Data Model** | Flat AssetState | Three-tier (Market/User/Intelligence) | Can aggregate for multi-user, backtesting knows historical reality |
| **Confidence** | Single number (cosmetic) | 5 drivers + overall | Drives risk, execution, alerts |
| **Regime** | Price + indicators | Phase + volatility + liquidity | Drives strategy switches, alert triggers, execution modes |
| **Size per Method** | ~500 lines | ~50-100 lines each | Testable, replaceable, understandable |
| **Reusability** | Everything calls full `compute()` | Each system calls what it needs | 10x reduction in API calls |
| **Future-Proof** | Hard to add new features | Easy to add new tiers/steps | DAO insights, consensus, simulation ready |

This is the foundation for a truly intelligent platform.
