# AssetStateEngine v1: Visual Quick Reference

**One-page overview of the entire Phase 1 architecture**

---

## 🏗️ The Engine-First Architecture

```
                    USER CLICKS ASSET (BTC)
                           │
                           ▼
                   ┌─────────────────┐
                   │  Dashboard.tsx  │
                   │  (UI Component) │
                   └────────┬────────┘
                            │
                            │ POST request
                            │
        ┌───────────────────▼──────────────────┐
        │ /api/intelligence/asset/:symbol      │
        │ (Single unified endpoint)             │
        └──────────────────┬────────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │   AssetStateEngine.compute()         │
        │  (The Cognitive Synthesis Engine)    │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────┬────────┼────────┬──────────┐
        │          │        │        │          │
        ▼          ▼        ▼        ▼          ▼
     Layer 1   Layer 2  Layer 3  Layer 4   Layer 5
     PRICE    CEX      DEX    CROSS-EX   TECHNICALS
        │        │        │        │          │
        │        │        │        │          │
        └────────┴────────┴────────┴──────────┘
                           │
                    [OPTIONAL: User Context]
                    [OPTIONAL: AI Guidance]
                           │
                           ▼
                    ┌──────────────┐
                    │ AssetState   │
                    │ (Single JSON)│
                    └──────┬───────┘
                           │
                    ┌──────▼───────────────────┐
                    │ Dashboard Renders:       │
                    │ ├─ Price Section         │
                    │ ├─ Technicals Section    │
                    │ ├─ Liquidity Section     │
                    │ ├─ Cross-Exchange Opps   │
                    │ ├─ Portfolio Impact      │
                    │ ├─ AI Guidance           │
                    │ └─ Action Buttons        │
                    └─────────────────────────┘
```

---

## 📦 AssetState Object Structure

```
AssetState {
  ✅ identification
  │  ├─ symbol: "BTC"
  │  ├─ name: "Bitcoin"
  │  ├─ pair: "BTC/USDT"
  │  └─ category: "L1"
  │
  ✅ price
  │  ├─ current: 65000
  │  ├─ change24h: 1500
  │  ├─ volatility: { current: 2.1, trend: "stable" }
  │  └─ high24h/low24h
  │
  ✅ cex [LAYER 2 - CEX LIQUIDITY]
  │  ├─ sources: [
  │  │    { exchange: "binance", bid: 65000, ask: 65002, spread: 0.003 },
  │  │    { exchange: "coinbase", bid: 65010, ask: 65028, spread: 0.027 },
  │  │    ...
  │  ├─ best: { buy: { exchange, price }, sell: { exchange, price } }
  │  └─ depth: { bidDepth, askDepth, quality }
  │
  ✅ dex [LAYER 3 - DEX LIQUIDITY]  
  │  ├─ sources: [
  │  │    { protocol: "uniswap", slippage: 0.8, liquidity: 50M },
  │  │    { protocol: "curve", slippage: 0.5, liquidity: 100M },
  │  │    ...
  │  └─ best: { protocol, slippage }
  │
  ✅ crossExchange [LAYER 4 - ARBITRAGE & SPREADS]
  │  ├─ spread: { average: 0.02, trend: "tightening" }
  │  └─ arbitrage: { opportunities: [
  │       { route: "Buy Kraken → Sell Uniswap", profitUsd: 500 }
  │     ]
  │
  ✅ technicals [LAYER 5 - TECHNICALS]
  │  ├─ rsi: { value: 58, signal: "neutral" }
  │  ├─ macd: { line: 500, signal: 450, histogram: 50 }
  │  ├─ movingAverages: { ma20: 64800, ma50: 64500, ma200: 63200 }
  │  └─ trend: { direction: "up", strength: 65 }
  │
  ✅ userContext [OPTIONAL - USER HOLDINGS]
  │  ├─ holding: { amount: 0.5, value: 32500, allocation: 35% }
  │  └─ performance: { unrealizedPnL: 2500, unrealizedPnLPercent: 8.3% }
  │
  ✅ aiInsights [OPTIONAL - MORIO GUIDANCE]
  │  ├─ primarySignal: { action: "HOLD", confidence: 65, reasoning: "..." }
  │  ├─ warnings: [ { type: "volatility", severity: "warning", message: "..." } ]
  │  └─ recommendations: [ { action: "...", reason: "...", venue: "CEX" } ]
  │
  ✅ status [METADATA]
     ├─ dataFreshness: 156ms
     ├─ isLiquid: true
     ├─ confidence: 92%
     └─ lastUpdated: 1708369200156
}
```

---

## 🔌 Integration Map

```
EXISTING SERVICES → ASSETSTATEENGINE → NEW CONSUMERS

priceOracle.ts ──────────┐
ccxtService.ts ──────────┤
dexIntegrationService ───┤
arbitrageDetector ───────┤  AssetStateEngine.compute()  ──→ Dashboard.tsx
marketAnalyticsService ──┤
indicators.ts ───────────┤
walletService ───────────┤
morio agents ────────────┘

                          ↓ (Future)
                     
                    - WebSocket (Real-time)
                    - Mobile App
                    - Yuki Trading Platform
                    - Alert System
                    - Analytics Dashboard
```

---

## 📈 Data Flow by Layer

```
LAYER 1: PRICE & VOLATILITY
┌─────────────────────┐
│ priceOracle.getPrice(BTC)
│ Returns: { price: 65000, change24h: 1500, volatility: 2.1% }
└─────────────────────┘

LAYER 2: CEX LIQUIDITY
┌─────────────────────────────────────────────┐
│ ccxtService.fetchOrderBook(["binance", ...], BTC)
│ Returns: { sources: [{exchange, bid, ask, spread}] }
│ Best: { buy: Binance $65k, sell: Coinbase $65.025k }
└─────────────────────────────────────────────┘

LAYER 3: DEX LIQUIDITY
┌──────────────────────────────────────────┐
│ dexIntegrationService.getLiquidityPools(BTC)
│ Returns: { sources: [{protocol, slippage, liquidity}] }
│ Best: { protocol: Curve, slippage: 0.5% }
└──────────────────────────────────────────┘

LAYER 4: CROSS-EXCHANGE INTEL
┌──────────────────────────────────────────────┐
│ arbitrageDetector.detectOpportunities(BTC)
│ spreadAnalysis: average 0.02%, trend: tightening
│ Arb: Buy Kraken $64.95k → Sell Uniswap $65.50k = $500 profit
└──────────────────────────────────────────────┘

LAYER 5: TECHNICAL INDICATORS (YOUR LIBRARY!)
┌──────────────────────────────────────────┐
│ indicators.rsi(closes, 14) → 58
│ indicators.macd(closes) → { line, signal, histogram }
│ indicators.sma(closes, [20,50,200]) → [64800, 64500, 63200]
│ indicators.atr(highs, lows, closes, 14) → 850
│ Trend: Price trending UP, strength 65%
└──────────────────────────────────────────┘
```

---

## 🎨 Frontend Render Sections

```
┌─────────────────────────────────┐
│   PRICE SECTION                 │ Uses: price, volatility
│   ├─ Current: $65,000           │
│   ├─ 24h Change: +$1,500 (+2.4%)│
│   ├─ Range: $64.2k - $66.5k     │
│   └─ Risk: MODERATE             │
├─────────────────────────────────┤
│   TECHNICALS (1h Chart)         │ Uses: rsi, macd, ma, trend
│   ├─ RSI: 58 (neutral)          │
│   ├─ MACD: Line 500 > Signal 450│
│   ├─ MA20: $64.8k (below)       │
│   └─ Trend: ↑ UP, Strength 65%  │
├─────────────────────────────────┤
│   CEX vs DEX LIQUIDITY          │ Uses: cex.sources, dex.sources
│   ├─ Binance: Bid/Ask $65k/$65k │
│   ├─ Coinbase: $65.025k/$65.03k │
│   └─ Uniswap: 0.8% slippage     │
├─────────────────────────────────┤
│   ARBITRAGE OPPORTUNITIES 🎯    │ Uses: crossExchange.arb
│   └─ Buy Kraken → Sell Uniswap  │
│      Profit: $500 (0.77%)       │
├─────────────────────────────────┤
│   YOUR PORTFOLIO IMPACT         │ Uses: userContext (if present)
│   ├─ Hold: 0.5 BTC ($32.5k)    │
│   ├─ Allocation: 35% of portfolio│
│   └─ Unrealized P&L: +$2,500    │
├─────────────────────────────────┤
│   MORIO AI GUIDANCE 🤖           │ Uses: aiInsights (if present)
│   ├─ Signal: HOLD (65% confidence)
│   ├─ Reason: RSI bullish + MA aligned
│   └─ ⚠️ Warning: Vol up 20%, tighten stops
├─────────────────────────────────┤
│   [BUY] [SELL] [SWAP] [ALERT]  │
└─────────────────────────────────┘
```

---

## ⚙️ Configuration & Settings

```typescript
// Cache Configuration
ASSET_STATE_CACHE_TTL = 5 seconds    // Balances freshness vs API load

// Indicator Periods (configurable)
RSI_PERIOD = 14
MACD_FAST = 12, SLOW = 26, SIGNAL = 9
MA_PERIODS = [20, 50, 200]
ATR_PERIOD = 14
BB_PERIOD = 20, STD_DEV = 2

// Liquidity Thresholds
GOOD_SPREAD = < 0.5%
GOOD_DEPTH = > $1M
MIN_SLIPPAGE_DEX = < 1%

// Technical Signal Thresholds
RSI_OVERBOUGHT = > 70
RSI_OVERSOLD = < 30
VOLATILITY_HIGH = > 3%
TREND_STRONG = strength > 60%
```

---

## 🚀 Deployment Checklist

- [ ] `assetStateEngine.ts` - Service logic ✅
- [ ] `intelligence.ts` - API routes ✅
- [ ] `AssetIntelligenceDashboard.tsx` - Frontend ✅
- [ ] Register routes in Express app
- [ ] Create TypeScript interfaces (assetTypes.ts)
- [ ] Wire up all 5 data layers (getPriceData, getCEXData, etc.)
- [ ] Add price history function (getPriceHistory)
- [ ] Integration test setup
- [ ] Postman collection for manual testing
- [ ] Deploy to staging
- [ ] Load test (100 concurrent requests)
- [ ] Monitor API response times
- [ ] Gather user feedback
- [ ] Iterate & refine

---

## 📊 Success Metrics

```
Goal                          Target    Your Score
────────────────────────────────────────────────────
API Response Time             <2s       _____ ms
Dashboard Load Time           <1s       _____ ms
Data Freshness                5s        _____ s
All 5 Layers Present          100%      _____ %
Technical Indicators Accurate 95%+      _____ %
User Satisfaction             >8/10     _____ /10
Cache Hit Ratio               >80%      _____ %
Uptime                        >99.5%    _____ %
```

---

## 🎯 Philosophy Reminder

> "Build the engine first. Everything else is just different views into the same object."

- **Single Source of Truth:** One AssetState object, infinite consumers
- **Composable:** Mix and match layers as needed
- **Testable:** Each layer can be unit tested independently
- **Scalable:** Cache aggressively, compute only when needed
- **Extensible:** Add new layers (sentiment, news, on-chain) without touching core

The beauty of this approach: **Tomorrow's WebSocket streams, mobile app, Yuki platform, and alert system all consume the same `AssetState` object.**

No duplication. No inconsistency. Just pure, elegant synthesis.

---

**Status:** Ready for implementation ✅  
**Estimated Timeline:** 1 week to MVP  
**Next Phase:** Real-time updates via WebSocket
