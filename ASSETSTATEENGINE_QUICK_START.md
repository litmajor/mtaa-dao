# AssetStateEngine v1: Implementation Quick Start

**Status:** Phase 1 Foundation - Engine-First Approach  
**Target:** 1 week to MVP  
**Goal:** Single unified `AssetState` object for all asset intelligence

---

## 📋 Implementation Checklist

### WEEK 1: Foundation (Days 1-5)

#### Day 1: Scaffold & Setup
- [x] ✅ AssetStateEngine service created (`server/services/assetStateEngine.ts`)
- [x] ✅ Intelligence routes created (`server/routes/intelligence.ts`)
- [x] ✅ Frontend dashboard component created (`client/src/components/AssetIntelligenceDashboard.tsx`)
- [ ] Register routes in main Express app
- [ ] Create type definitions (`server/types/assetTypes.ts`)
- [ ] Add to API documentation

**Command:** Register in `server/index.ts`:
```typescript
import intelligenceRoutes from './routes/intelligence';
app.use('/api/intelligence', intelligenceRoutes);
```

**Type file: `server/types/assetTypes.ts`**
```typescript
export interface AssetState {
  // ... (already defined in assetStateEngine.ts)
}

export interface UserContext {
  userId: string;
  daoId?: string;
}
```

---

#### Day 2-3: Wire up Data Layers

Replace the placeholder implementations in `assetStateEngine.ts`:

**Layer 1️⃣: Price Data Integration**
```typescript
// In getPriceData()
// Replace mock with actual priceOracle call:
import { priceOracle } from './priceOracle';

const oracleData = await priceOracle.getPrice(symbol);
return {
  current: oracleData.priceUsd,
  change24h: oracleData.change24h,
  // ... etc
};
```

**Layer 2️⃣: CEX Data Integration**
```typescript
// In getCEXData()
// Replace mock with actual ccxtService:
import { ccxtService } from './ccxtService';

const exchanges = ['binance', 'coinbase', 'kraken', 'gate.io', 'okx'];
const sources = await Promise.all(
  exchanges.map(async (ex) => {
    const orderbook = await ccxtService.fetchOrderBook(ex, symbol, 20);
    return {
      exchange: ex,
      bid: orderbook.bids[0][0],
      ask: orderbook.asks[0][0],
      spread: (orderbook.asks[0][0] - orderbook.bids[0][0]) / orderbook.bids[0][0],
      volume24h: await ccxtService.get24hVolume(ex, symbol),
      timestamp: Date.now(),
    };
  })
);
```

**Layer 3️⃣: DEX Data Integration**
```typescript
// In getDEXData()
// Replace mock with actual DEX queries:
import { dexIntegrationService } from './dexIntegrationService';
import { SmartRouter } from './smartRouter';

const dexSources = await dexIntegrationService.getLiquidityPools(symbol);
const smartRouter = SmartRouter.getInstance();
const slippage = await smartRouter.calculateSlippage(symbol, 1000000); // $1M order
```

**Layer 4️⃣: Cross-Exchange Intelligence**
```typescript
// In getCrossExchangeData()
// Use arbitrage detector + spread analysis:
import { ArbitrageDetectionService } from './arbitrageDetector';
import { marketAnalyticsService } from './marketAnalyticsService';

const arbitrage = new ArbitrageDetectionService();
const opps = await arbitrage.detectOpportunitiesForPair(symbol);
const spread = await marketAnalyticsService.analyzeSpreadTrends(symbol);
```

**Layer 5️⃣: Technical Indicators**
```typescript
// In getTechnicalData()
// Wire up indicators.ts library:
import * as indicators from './indicators';

// Get price history (last 200 candles, 1h timeframe)
const priceHistory = await this.getPriceHistory(symbol, 200);
const closes = priceHistory.map(c => c.close);
const highs = priceHistory.map(c => c.high);
const lows = priceHistory.map(c => c.low);

// Calculate all technicals at once
const technicals = {
  rsi: {
    value: indicators.rsi(closes, 14).pop(),
    signal: ... // overbought/neutral/oversold logic
  },
  macd: indicators.macd(closes),
  movingAverages: {
    ma20: indicators.sma(closes, 20).pop(),
    ma50: indicators.sma(closes, 50).pop(),
    ma200: indicators.sma(closes, 200).pop(),
  },
  bollingerBands: indicators.bollingerBands(closes, 20),
  atr: indicators.atr(highs, lows, closes, 14).pop(),
  trend: this.calculateTrendDirection(closes),
};
```

**Helper: Get Price History**
```typescript
private async getPriceHistory(symbol: string, candles: number) {
  // Query database or cache for historical OHLC data
  // Return last N candles
  // For now, you can mock or fetch from a service
  return [];
}
```

---

#### Day 4: User Context & AI Integration

**User Portfolio Context**
```typescript
// In getUserContext()
import { db } from '../db';
import { walletTransactions, contributions } from '../../shared/schema';

const portfolio = await db.query.wallets.findFirst({
  where: eq(wallets.userId, userId),
  with: { transactions: true }
});

const holding = portfolio?.transactions
  .filter(t => t.symbol === symbol)
  .reduce((sum, t) => sum + (t.type === 'buy' ? t.amount : -t.amount), 0);
```

**AI Guidance Integration**
```typescript
// In getAIGuidance()
// Call Morio agents:
import { morio } from '../agents/morio';

const signal = await morio.generateSignal(symbol, {
  technicals: technicalData,
  liquidity: crossExchangeData,
  portfolio: userContextData,
});
```

---

#### Day 5: Testing & Validation

**Test file: `server/tests/assetStateEngine.test.ts`**
```typescript
import { AssetStateEngine } from '../services/assetStateEngine';

describe('AssetStateEngine', () => {
  it('should compute BTC asset state', async () => {
    const state = await AssetStateEngine.compute('BTC');
    
    expect(state.identification.symbol).toBe('BTC');
    expect(state.price.current).toBeGreaterThan(0);
    expect(state.cex.sources.length).toBeGreaterThan(0);
    expect(state.dex.sources.length).toBeGreaterThan(0);
    expect(state.technicals.rsi).toBeDefined();
  });

  it('should include technicals', async () => {
    const state = await AssetStateEngine.compute('ETH');
    
    expect(state.technicals.rsi.value).toBeGreaterThanOrEqual(0);
    expect(state.technicals.rsi.value).toBeLessThanOrEqual(100);
    expect(state.technicals.macd.line).toBeDefined();
  });

  it('should include user context when provided', async () => {
    const state = await AssetStateEngine.compute('BTC', {
      userId: 'test-user-123',
    });
    
    expect(state.userContext).toBeDefined();
    expect(state.userContext?.holding).toBeDefined();
  });

  it('should detect arbitrage opportunities', async () => {
    const state = await AssetStateEngine.compute('BTC');
    
    if (state.crossExchange.arbitrage.opportunities.length > 0) {
      expect(state.crossExchange.arbitrage.opportunities[0].profitUsd).toBeGreaterThan(0);
    }
  });
});
```

**Run tests:**
```bash
npm test -- assetStateEngine.test.ts
```

**Postman Test Collection:**
```
POST http://localhost:3000/api/intelligence/asset/BTC
Body: { "userId": "test-user-123" }

Expected Response:
{
  "success": true,
  "data": {
    "identification": {...},
    "price": {...},
    "cex": {...},
    "dex": {...},
    "crossExchange": {...},
    "technicals": {...},
    "status": {...}
  }
}
```

---

### WEEK 2: Dashboard & Polish (Days 6-7)

#### Day 6: Integrate Frontend

**Import dashboard in your main page** (e.g., `client/src/pages/trading.tsx`):

```typescript
import AssetIntelligenceDashboard from '@/components/AssetIntelligenceDashboard';

export default function TradingPage() {
  return <AssetIntelligenceDashboard symbol="BTC" userId={userID} />;
}
```

**CSS (Optional styling):**
```css
.asset-intelligence-dashboard {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  border-radius: 12px;
  color: white;
}
```

---

#### Day 7: Live Testing & Iteration

1. **Test with real market data:**
   - Open dashboard with BTC/USDT
   - Verify all 5 layers load correctly
   - Check data freshness (should update every 5s)

2. **Performance checks:**
   - API response time should be <2s
   - Dashboard should render <1s
   - No console errors

3. **Gather feedback:**
   - What's missing?
   - What's confusing?
   - Which signals are most useful?

---

## 🔗 Integration Points (To Connect)

| Component | Status | File | Action |
|-----------|--------|------|--------|
| **priceOracle** | ✅ Exists | `server/services/priceOracle.ts` | Wire in `getPriceData()` |
| **ccxtService** | ✅ Exists | `server/services/ccxtService.ts` | Wire in `getCEXData()` |
| **dexIntegrationService** | ✅ Exists | `server/services/dexIntegrationService.ts` | Wire in `getDEXData()` |
| **arbitrageDetector** | ✅ Exists | `server/services/arbitrageDetector.ts` | Wire in `getCrossExchangeData()` |
| **indicators.ts library** | ✅ Exists | `server/services/indicators.ts` | Already attached! |
| **marketAnalyticsService** | ✅ Exists | `server/services/marketAnalyticsService.ts` | Use for spread/depth |
| **morio agents** | ✅ Exists | `server/agents/morio/` | Wire in `getAIGuidance()` |
| **Wallet/Portfolio** | ✅ Exists | `server/routes/wallet.ts` | Wire in `getUserContext()` |

---

## 📊 Expected Output Example

When you call `POST /api/intelligence/asset/BTC`:

```json
{
  "success": true,
  "data": {
    "identification": {
      "symbol": "BTC",
      "name": "Bitcoin",
      "pair": "BTC/USDT",
      "category": "L1",
      "timestamp": 1708369200000
    },
    "price": {
      "current": 65000,
      "change24h": 1500,
      "changePercent24h": 2.4,
      "high24h": 66500,
      "low24h": 64200,
      "volatility": {
        "current": 2.1,
        "trend": "stable"
      }
    },
    "cex": {
      "sources": [
        {
          "exchange": "binance",
          "bid": 65000,
          "ask": 65002,
          "spread": 0.003,
          "volume24h": 1200000,
          "timestamp": 1708369200000
        }
      ],
      "best": {
        "buy": {"exchange": "binance", "price": 65000},
        "sell": {"exchange": "coinbase", "price": 65025}
      }
    },
    "dex": {
      "sources": [
        {
          "protocol": "uniswap",
          "poolId": "pool123",
          "liquidity": 50000000,
          "slippage": 0.8,
          "timestamp": 1708369200000
        }
      ],
      "best": {
        "protocol": "curve",
        "slippage": 0.5
      }
    },
    "crossExchange": {
      "spread": {
        "average": 0.02,
        "trend": "tightening"
      },
      "arbitrage": {
        "opportunities": [
          {
            "route": "Buy Kraken → Sell Uniswap",
            "profitUsd": 500,
            "profitPercent": 0.77
          }
        ]
      }
    },
    "technicals": {
      "rsi": {
        "value": 58,
        "signal": "neutral"
      },
      "macd": {
        "line": 500,
        "signal": 450,
        "histogram": 50
      },
      "movingAverages": {
        "ma20": 64800,
        "ma50": 64500,
        "ma200": 63200
      },
      "trend": {
        "direction": "up",
        "strength": 65
      }
    },
    "userContext": {
      "holding": {
        "amount": 0.5,
        "value": 32500,
        "allocation": 35
      },
      "performance": {
        "unrealizedPnL": 2500,
        "unrealizedPnLPercent": 8.3
      }
    },
    "aiInsights": {
      "primarySignal": {
        "action": "HOLD",
        "confidence": 65,
        "reasoning": "RSI neutral, MACD bullish. Spreads tightening—good liquidity."
      },
      "warnings": [
        {
          "type": "volatility",
          "severity": "warning",
          "message": "Volatility increased 20%—consider tighter stop losses."
        }
      ]
    },
    "status": {
      "dataFreshness": 156,
      "isLiquid": true,
      "confidence": 92,
      "lastUpdated": 1708369200156
    }
  },
  "timestamp": 1708369200000
}
```

---

## 🚀 Next Steps (Phase 2+)

Once AssetStateEngine v1 is working:

### Phase 2: Real-Time Updates (Week 2)
- [ ] Add WebSocket support to push AssetState changes
- [ ] Implement 1-second refresh for price/spread
- [ ] Add client-side caching

### Phase 3: Advanced Intelligence (Week 3)
- [ ] Historical pattern analysis (spreads widen Fridays?)
- [ ] Portfolio-aware recommendations
- [ ] Multi-timeframe technical analysis

### Phase 4: Sentiment & Market Intelligence (Week 4)
- [ ] Fear & Greed Index integration
- [ ] Social volume monitoring
- [ ] News sentiment analysis

---

## 💡 Pro Tips

1. **Start with 1 symbol (BTC)** for testing
2. **Use your incredible indicators.ts library** - it's battle-tested
3. **Cache aggressively** (5s TTL is good)
4. **Test with Postman** before connecting frontend
5. **Monitor API response times** - should be <2s
6. **Log data layer by layer** - debug if something fails

---

## 🎯 Success Criteria

✅ You'll know it's working when:
- [ ] API returns complete AssetState in <2 seconds
- [ ] All 5 intelligence layers are populated
- [ ] Technical indicators match live market (RSI 0-100, MACD correct, MAs aligned)
- [ ] Dashboard renders without errors
- [ ] Data refreshes every 5 seconds

🎉 **That's MVP for Phase 1!**

Then move on to real-time (WebSocket), sentiment, and advanced features.

---

## Questions?

- **Where is [service]?** Check the file paths in "Integration Points" table
- **How do I get historical candles?** Add a helper `getPriceHistory()` that queries your OHLC database
- **Can I cache this?** Yes! Use `cacheService.set()` with 5-30s TTL
- **How do I handle errors?** Gracefully degrade - if CEX fails, still return DEX data + technicals

Good luck! 🚀
