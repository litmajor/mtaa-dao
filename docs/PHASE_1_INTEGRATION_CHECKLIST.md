# Phase 1 Integration Checklist

## Overview

| Component | Status | File | Notes |
|-----------|--------|------|-------|
| Refactored Architecture | ✅ Complete | `assetStateEngine.refactored.ts` | Four-step pattern, three-tier model |
| API Routes | ✅ Complete | `intelligence.ts` | 4 endpoints ready for service integration |
| Dashboard Component | ✅ Complete | `AssetIntelligenceDashboard.tsx` | Consumes AssetState, renders all tiers |
| Documentation | ✅ Complete | 3 files | Corrections, visual guide, this checklist |
| Integration Work | 🔄 In Progress | Multiple files | See tasks below |

---

## Phase 1A: Core Service Integration (Priority 1)

### Task 1.1: Wire `getPriceData()` to priceOracle Service
**File:** `server/services/assetStateEngine.refactored.ts` (Line ~650)
**Current State:** Placeholder returning mock data
**Target:** Real priceOracle integration
**Effort:** 1-2 hours

```typescript
private async getPriceData(symbol: string): Promise<any> {
  // TODO: Wire these
  // const priceData = await this.priceOracle.getPrice(symbol);
  // const volatility = await this.priceOracle.getVolatility(symbol, '24h');
  // const high24h = await this.priceOracle.getHighLow(symbol, '24h');
  
  // Return structure:
  // {
  //   current,
  //   change24h,
  //   changePercent24h,
  //   high24h,
  //   low24h,
  //   volatility: { current, trend },
  //   timestamp
  // }
}
```

**Checklist:**
- [ ] Locate priceOracle service methods
- [ ] Understand its error handling & caching
- [ ] Implement integration with fallback handling
- [ ] Test with BTC, ETH, 5+ altcoins
- [ ] Verify response time < 500ms

**Success Metric:**
- Returns current price ± 0.1% of CoinGecko
- Returns volatility matching ATR calculation
- Response time < 500ms

---

### Task 1.2: Wire `getCEXData()` to ccxtService
**File:** `server/services/assetStateEngine.refactored.ts` (Line ~665)
**Current State:** Placeholder returning mock Binance data
**Target:** Real multi-exchange integration
**Effort:** 2-3 hours

```typescript
private async getCEXData(symbol: string): Promise<any> {
  // TODO: Wire these
  // const binance = await this.ccxtService.fetchOrderBook('BTCUSDT');
  // const coinbase = await this.ccxtService.fetchOrderBook('BTC-USD');
  // const kraken = await this.ccxtService.fetchOrderBook('XBTUSDT', 'kraken');
  // const gatee = await this.ccxtService.fetchOrderBook(...);
  // const okx = await this.ccxtService.fetchOrderBook(...);
  
  // Return structure:
  // {
  //   sources: [
  //     { exchange: 'binance', bid, ask, spread, volume24h, timestamp },
  //     { exchange: 'coinbase', bid, ask, ... },
  //     ...
  //   ],
  //   best: { buy, sell },
  //   depth: { bidDepth, askDepth, quality }
  // }
}
```

**Checklist:**
- [ ] Identify ccxtService methods for each exchange
- [ ] Handle exchange-specific error codes
- [ ] Implement rate-limiting strategy
- [ ] Test with 5+ exchanges (Binance, Coinbase, Kraken, Gate.io, OKX)
- [ ] Measure response time < 1000ms for all 5 in parallel

**Success Metric:**
- Gets bid/ask from all 5 exchanges
- Calculates spread correctly (ask - bid) / bid
- Best buy/sell correctly identified
- Returns in < 1000ms (parallel requests)

---

### Task 1.3: Wire `getDEXData()` to dexIntegrationService
**File:** `server/services/assetStateEngine.refactored.ts` (Line ~680)
**Current State:** Placeholder returning mock Uniswap V3 data
**Target:** Real DEX liquidity detection
**Effort:** 2-3 hours

```typescript
private async getDEXData(symbol: string): Promise<any> {
  // TODO: Wire these
  // const uniV3 = await this.dexIntegrationService.getLiquidityPools('WETH', {
  //   protocol: 'uniswap-v3'
  // });
  // const curve = await this.dexIntegrationService.getLiquidityPools(...);
  // const sushi = await this.dexIntegrationService.getLiquidityPools(...);
  
  // Return structure:
  // {
  //   sources: [
  //     { protocol: 'uniswap-v3', poolId, liquidity, slippage, fee, timestamp },
  //     { protocol: 'curve', ... },
  //     ...
  //   ],
  //   best: { protocol: 'uniswap-v3', slippage: 0.15 }
  // }
}
```

**Checklist:**
- [ ] Resolve DEX integration service location
- [ ] Identify which DEX protocols are available (Uniswap, Curve, Sushiswap, Balancer, Ubeswap)
- [ ] Understand slippage calculation method
- [ ] Test with 5+ protocols
- [ ] Measure response time < 2000ms

**Success Metric:**
- Gets liquidity from 5+ DEX protocols
- Slippage calc matches expected values (use test swaps)
- Returns in < 2000ms

---

### Task 1.4: Wire `getTechnicalData()` to indicators.ts
**File:** `server/services/assetStateEngine.refactored.ts` (Line ~695)
**Current State:** Placeholder mock technicals
**Target:** Real indicators.ts library integration
**Effort:** 2-3 hours

```typescript
private async getTechnicalData(symbol: string): Promise<any> {
  // TODO: Wire these
  // 1. Get historical candle data (200 candles, 1-hour)
  // const candles = await this.getPriceHistory(symbol, 200);
  
  // 2. Extract OHLCV arrays
  // const closes = candles.map(c => c.close);
  // const highs = candles.map(c => c.high);
  // const lows = candles.map(c => c.low);
  // const volumes = candles.map(c => c.volume);
  
  // 3. Calculate indicators
  // const rsi = this.indicatorsLibrary.rsi(closes, 14);
  // const macd = this.indicatorsLibrary.macd(closes);
  // const bb = this.indicatorsLibrary.bollingerBands(closes, 20);
  // const mas = {
  //   ma20: this.indicatorsLibrary.sma(closes, 20),
  //   ma50: this.indicatorsLibrary.sma(closes, 50),
  //   ma200: this.indicatorsLibrary.sma(closes, 200)
  // };
  
  // Return structure:
  // {
  //   rsi: { value: 65, signal: 'neutral' },
  //   macd: { line: 0.5, signal: 0.3, histogram: 0.2 },
  //   movingAverages: { ma20, ma50, ma200 },
  //   trend: { direction: 'up', strength: 0.7 }
  // }
}
```

**Checklist:**
- [ ] Locate indicators.ts library
- [ ] Understand which indicators are available (at least RSI, MACD, SMA)
- [ ] **CRITICAL:** Solve historical candle data sourcing
  - [ ] Where do 1-hour candles come from? (Database? Cache? API?)
  - [ ] How many candles needed? (200 for standard analysis)
  - [ ] Caching strategy? (How often refresh?)
- [ ] Test each indicator against known values
- [ ] Measure response time < 500ms

**Success Metric:**
- RSI matches TradingView (14 period)
- MACD line/signal/histogram correct
- Moving averages accurate
- Returns in < 500ms

---

### Task 1.5: Wire `analyzeCrossExchange()` to arbitrageDetector
**File:** `server/services/assetStateEngine.refactored.ts` (Line ~380)
**Current State:** Placeholder mock arbitrage
**Target:** Real arbitrage opportunity detection
**Effort:** 1-2 hours

```typescript
private async analyzeCrossExchange(cexData, dexData): Promise<any> {
  // TODO: Wire these
  // const opportunities = await this.arbitrageDetector.detectOpportunities(
  //   symbol,
  //   cexData.sources,
  //   dexData.sources
  // );
  
  // const spreadTrends = await this.marketAnalyticsService.analyzeSpreadTrends(
  //   symbol,
  //   '5m'  // 5 minute window
  // );
  
  // Return structure:
  // {
  //   spread: { average: 0.15, trend: 'stable' },
  //   arbitrage: { opportunities: [...] }
  // }
}
```

**Checklist:**
- [ ] Locate arbitrageDetector service
- [ ] Understand opportunity structure (route, profitUsd, profitPercent)
- [ ] Verify profitability calculations account for fees
- [ ] Test with real BTC/ETH data
- [ ] Measure response time < 500ms

**Success Metric:**
- Finds real arbitrage opportunities
- Profit calculations correct after fees
- Identifies which venue pairs have spreads
- Returns in < 500ms

---

### Task 1.6: Implement `calculateMeaningfulConfidence()` Metrics
**File:** `server/services/assetStateEngine.refactored.ts` (Line ~435)
**Current State:** Placeholder with fixed values
**Target:** Real confidence calculation
**Effort:** 2-3 hours

```typescript
private calculateMeaningfulConfidence(rawLayers, crossExchange): ConfidenceMetrics {
  // ✅ DONE: calculateExchangeAgreement() - coefficient of variation
  // ✅ DONE: calculateLiquidityQuality() - spread-based
  // ✅ DONE: calculateIndicatorAlignment() - placeholder (TODO)
  // TODO: calculateSpreadStability() - needs history
  // TODO: calculateDataFreshness() - needs timestamps
  
  // Each must return 0-100 score
  // Then weight them into overall confidence
}
```

**Checklist:**
- [ ] Implement `calculateDataFreshness()`
  - [ ] 100 if < 1s old
  - [ ] Linear decay to 0 at > 60s
- [ ] Implement `calculateSpreadStability()`
  - [ ] Track spreads for 5 minutes
  - [ ] Calculate coefficient of variation
  - [ ] Convert to 0-100 score
- [ ] **FIX:** `calculateIndicatorAlignment()`
  - [ ] Compare RSI signal (overbought/neutral/oversold)
  - [ ] Compare MACD histogram direction (positive/negative)
  - [ ] Compare MA slope (up/down/flat)
  - [ ] Score: all agree = 100, split = 50, disagree = 25
- [ ] Test confidence breakdown with real data
- [ ] Verify weighting (0.25/0.2/0.2/0.15/0.2)

**Success Metric:**
- Confidence scores 0-100 for each metric
- Overall confidence = weighted average
- Confidence drops when data stale
- Confidence drops when exchanges disagree
- Confidence rises during tight spreads

---

### Task 1.7: Implement `detectRegime()`
**File:** `server/services/assetStateEngine.refactored.ts` (Line ~405)
**Current State:** Volatility & liquidity done, marketPhase placeholder
**Target:** Complete regime detection including market phase
**Effort:** 2-3 hours

```typescript
private detectRegime(priceData, crossExchange, technicals): Regime {
  // ✅ DONE: volatilityRegime from volatility value
  // ✅ DONE: liquidityRegime from spread
  // TODO: marketPhase from price + volume + momentum
  
  // marketPhase detection algorithm:
  // 1. Is price above/below MA200? (primary trend)
  // 2. Is price above/below MA50? (secondary trend)
  // 3. Volume profile: increasing or decreasing?
  // 4. RSI: > 70 (overbought), < 30 (oversold), 30-70 (normal)?
  // 5. MACD: new highs or declining?
  
  // Then map to: accumulation | expansion | distribution | capitulation
}
```

**Checklist:**
- [ ] Define marketPhase detection algorithm
  - [ ] Accumulation: price low, volume increasing, RSI < 50
  - [ ] Expansion: price up, volume up, RSI 50-70, MACD positive
  - [ ] Distribution: price high, volume declining, RSI > 70
  - [ ] Capitulation: price down, volume panic, RSI < 30
- [ ] Get volume data alongside price/technicals
- [ ] Test with real market cycle data (bull, bear, consolidation)
- [ ] Validate phase transitions make sense

**Success Metric:**
- Correctly identifies accumulation phases
- Recognizes expansion trends
- Detects distribution tops
- Captures capitulation bottoms

---

## Phase 1B: Optional Enrichment (Priority 2)

### Task 2.1: Wire `getUserContext()` to portfolio service
**File:** `server/services/assetStateEngine.refactored.ts` (Line ~710)
**Current State:** Mock user context
**Target:** Real portfolio data
**Effort:** 1-2 hours
**Note:** Optional—engine works without this (Tier 2)

```typescript
private async getUserContext(userId: string, symbol: string): Promise<UserContext> {
  // TODO: Query portfolio service
  // const portfolio = await this.portfolioService.getUserHoldings(userId);
  // const thisCoin = portfolio.coins.find(c => c.symbol === symbol);
  // const totalValue = portfolio.totalValue;
  
  // Calculate allocation: (thisCoin.value / totalValue) * 100
  // Calculate P&L: current - cost basis
}
```

**Checklist:**
- [ ] Locate portfolio service
- [ ] Get user holdings for symbol
- [ ] Calculate allocation %
- [ ] Get cost basis for P&L
- [ ] Test with real portfolio data

---

### Task 2.2: Wire `getAISignal()` to Morio agents
**File:** `server/services/assetStateEngine.refactored.ts` (Line ~722)
**Current State:** Mock signal
**Target:** Real Morio agent integration
**Effort:** 2-3 hours
**Note:** Optional—engine works without this (Tier 3)

```typescript
private async getAISignal(derivedMetrics, userContext): Promise<AISignal> {
  // TODO: Call Morio agent
  // const signal = await this.morioAgents.generateSignal({
  //   regime: derivedMetrics.regime,
  //   confidence: derivedMetrics.confidence,
  //   technicals,
  //   userRole: userContext.role,
  //   riskProfile: userContext.riskProfile
  // });
  
  // Return: { action, confidence, reasoning }
}
```

**Checklist:**
- [ ] Locate Morio agent service
- [ ] Understand agent signal generation method
- [ ] Test signal generation with various regimes
- [ ] Validate reasoning output

---

## Phase 1C: Testing & Validation (Priority 1)

### Task 3.1: Unit Tests for Each Step
**Files:** New test files in `server/services/__tests__/`
**Effort:** 2-3 hours

```typescript
describe('AssetStateEngine', () => {
  describe('fetchRawLayers', () => {
    it('should fetch price data correctly', () => { });
    it('should fetch CEX data from 5+ exchanges', () => { });
    it('should fetch DEX data from 5+ protocols', () => { });
    it('should calculate technical indicators', () => { });
  });
  
  describe('computeDerivedMetrics', () => {
    it('should calculate cross-exchange analysis', () => { });
    it('should detect market regime correctly', () => { });
    it('should calculate meaningful confidence', () => { });
  });
  
  describe('synthesizeIntelligence', () => {
    it('should generate AI signal when context provided', () => { });
    it('should generate warnings for extreme volatility', () => { });
  });
  
  describe('assembleAssetState', () => {
    it('should separate tiers correctly', () => { });
    it('should handle optional user context', () => { });
  });
});
```

**Checklist:**
- [ ] Test each step independently with mock data
- [ ] Test with real market data (BTC, ETH during bull/bear)
- [ ] Test error scenarios (API down, stale data)
- [ ] Test performance (measure each step timing)
- [ ] Achieve > 80% code coverage

---

### Task 3.2: Integration Tests
**Files:** `server/services/__tests__/assetStateEngine.integration.test.ts`
**Effort:** 2 hours

```typescript
describe('AssetStateEngine Integration', () => {
  it('should compute complete AssetState in < 3 seconds', () => { });
  it('should cache results correctly', () => { });
  it('should handle WebSocket streaming pattern', () => { });
  it('should gracefully degrade without user context', () => { });
  it('should handle missing DEX data', () => { });
});
```

**Checklist:**
- [ ] Test full pipeline with real services
- [ ] Verify cache hit/miss behavior
- [ ] Measure end-to-end latency
- [ ] Test error recovery
- [ ] Validate all three tiers present/optional

---

### Task 3.3: Contract Tests (Dashboard ↔ API)
**Files:** `server/routes/__tests__/intelligence.test.ts`
**Effort:** 1 hour

```typescript
describe('Intelligence API', () => {
  it('should return valid AssetState from /api/intelligence/asset/:symbol', () => {
    // Verify schema matches
    // Verify all required fields present
    // Verify cache headers correct
  });
  
  it('should support batch requests', () => {
    // Verify parallel computation
    // Verify response time scales
  });
});
```

**Checklist:**
- [ ] Verify API response matches AssetState interface
- [ ] Test all 4 endpoints
- [ ] Validate error responses
- [ ] Check cache headers (5s TTL)

---

## Phase 1D: Performance & Documentation (Priority 3)

### Task 4.1: Performance Profiling
**Effort:** 1-2 hours

```
Target SLAs:
✅ fetchRawLayers()           < 2000ms (parallel calls)
✅ computeDerivedMetrics()    < 500ms  (local calculations)
✅ synthesizeIntelligence()   < 500ms  (AI call, can be async)
✅ assembleAssetState()       < 100ms  (object creation)
───────────────────────────────────────
   Full compute()            < 3000ms (total)
```

**Checklist:**
- [ ] Measure each step timing with real data
- [ ] Identify bottlenecks
- [ ] Optimize hot paths
- [ ] Verify cache hit >= 80%
- [ ] Load test with 10 concurrent requests

---

### Task 4.2: Update Documentation
**Files to Update:**
- PHASE_1_ASSETSTATEENGINE_V1.md (add integration details)
- ASSETSTATEENGINE_QUICK_START.md (update with real service names)
- README.md (add AssetStateEngine section)

**Checklist:**
- [ ] Document each service dependency
- [ ] Add troubleshooting guide
- [ ] Include real example responses
- [ ] Document performance profile
- [ ] Add architecture decision records (ADRs)

---

## Summary Timeline

| Phase | Tasks | Effort | Timeline |
|-------|-------|--------|----------|
| **1A** | Core services (1.1-1.7) | 12-16 hours | Days 1-2 |
| **1B** | Optional enrichment (2.1-2.2) | 3-5 hours | Day 3 |
| **1C** | Testing (3.1-3.3) | 5 hours | Day 3-4 |
| **1D** | Performance & docs (4.1-4.2) | 3 hours | Day 4 |
| **Total** | | ~25-30 hours | 4 days |

---

## Success Criteria

✅ All seven layers integrated and tested
✅ Each step meets SLA (fetchRaw < 2s, compute < 500ms, etc.)
✅ Dashboard displays real AssetState data
✅ Cache working (5s TTL, hit rate > 80%)
✅ Meaningful confidence breakdown guiding risk decisions
✅ Regime detection working (accumulation/expansion/distribution/capitulation)
✅ Full test coverage (> 80%)
✅ Real market data validation (BTC, ETH, 5+ alts)
✅ Error recovery working (graceful degradation, no crashes)
✅ Documentation complete and team-ready

Once complete, Phase 1 foundation is solid for:
- WebSocket streaming (reuse partial layers)
- Alerts engine (reuse derived metrics)
- Backtesting (reuse synthesis logic)
- Multi-user consensus (reuse Tier 1)
- DAO insights (leverage all three tiers)
- Yuki trading integration (consume AssetState)
