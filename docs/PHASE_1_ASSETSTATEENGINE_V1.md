# PHASE 1 REFRAMED: AssetStateEngine v1

**Philosophy:** Build the unified intelligence engine first. UI and AI agents consume it. Technical indicators are supporting signals, not the focus.

---

## What is AssetStateEngine v1?

A **stateless, composable service** that synthesizes all available intelligence about an asset into a single, immutable `AssetState` object.

### Inputs (From Current Services)

```typescript
AssetStateEngine.compute(symbol: string, userContext?: UserContext) → Promise<AssetState>

Uses:
├── priceOracle              (multi-source pricing)
├── ccxtService              (CEX order books, spread)
├── dexIntegrationService    (liquidity pools, slippage)
├── arbitrageDetector        (cross-venue opportunities)
├── marketAnalyticsService   (volatility, depth trends)
├── indicators.ts            (RSI, MACD, movingAverages—YOUR EXCELLENT LIBRARY)
├── userPortfolioService     (holdings, allocation, P&L)
└── morio/elderAgents        (AI recommendations)
```

### Output: AssetState Object

```typescript
interface AssetState {
  // ASSET IDENTIFICATION
  identification: {
    symbol: string;
    name: string;
    exchange: string;
    pair: string;
    category: 'L1' | 'L2' | 'DeFi' | 'Stablecoin';
    timestamp: number;
  };

  // PRICE & VOLATILITY
  price: {
    current: number;
    change24h: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    
    volatility: {
      current: number;          // 2.1%
      ma20: number;             // 20-day rolling
      trend: 'increasing' | 'stable' | 'decreasing';
    };
  };

  // CEX LIQUIDITY LAYER
  cex: {
    sources: Array<{
      exchange: string;         // Binance, Coinbase, etc.
      bid: number;
      ask: number;
      spread: number;           // percentage
      volume24h: number;
      timestamp: number;
    }>;
    
    best: {
      buy: { exchange: string; price: number };
      sell: { exchange: string; price: number };
      spread: number;           // best possible spread
    };
    
    depth: {
      bidDepth: number;         // liquidity within 1%
      askDepth: number;
      imbalance: number;        // bid/ask ratio
      quality: 'excellent' | 'good' | 'fair' | 'poor';
    };
  };

  // DEX LIQUIDITY LAYER
  dex: {
    sources: Array<{
      protocol: string;         // Uniswap, Curve, etc.
      poolId: string;
      tokenA: string;
      tokenB: string;
      liquidity: number;        // USD value
      slippage1M: number;       // 1M USD order
      slippageWithImpact: number;
      fee: number;              // %
      timestamp: number;
    }>;
    
    best: {
      protocol: string;
      slippage: number;
      recommendation: string;   // "Best for >$100k orders"
    };
  };

  // CROSS-EXCHANGE INTELLIGENCE
  crossExchange: {
    weighted_price: number;     // Across all sources
    
    spread: {
      average: number;
      min: number;
      max: number;
      trend: 'tightening' | 'stable' | 'widening';
    };
    
    arbitrage: {
      opportunities: Array<{
        route: string;          // e.g., "Buy Kraken, Sell Uniswap"
        profitUsd: number;
        profitPercent: number;
        executionTime: number;  // ms estimate
        riskLevel: 'low' | 'medium' | 'high'; // slippage/latency risk
      }>;
      
      bestOpportunity: {
        route: string;
        profit: number;
        executable: boolean;    // Is it viable now?
      };
    };
  };

  // TECHNICAL INDICATORS (Supporting Evidence)
  technicals: {
    rsi: {
      value: number;                    // 0-100
      signal: 'overbought' | 'neutral' | 'oversold';
      strength: number;                 // How far from 50? 0-50
    };
    
    macd: {
      line: number;
      signal: number;
      histogram: number;
      signal: 'bullish_crossover' | 'bearish_crossover' | 'no_crossover';
    };
    
    movingAverages: {
      ma20: number;
      ma50: number;
      ma200: number;
      alignment: 'bullish' | 'bearish' | 'mixed';
    };
    
    bollingerBands: {
      middle: number;
      upper: number;
      lower: number;
      position: 'above' | 'middle' | 'below';
      volatility: number;
    };
    
    atr: number;                        // Average True Range
    
    trend: {
      direction: 'strong_up' | 'up' | 'neutral' | 'down' | 'strong_down';
      strength: number;                 // 0-100
      currentPrice: number;
      supportLevel: number;
      resistanceLevel: number;
    };
  };

  // USER PORTFOLIO CONTEXT
  userContext: {
    holding: {
      amount: number;
      value: number;           // Holdings value in USD
      allocation: number;      // % of portfolio
    };
    
    performance: {
      unrealizedPnL: number;   // USD
      unrealizedPnLPercent: number;
      dayChange: number;       // USD
      dayChangePercent: number;
    };
    
    tradeHistory: {
      totalBuys: number;
      totalSells: number;
      avgBuyPrice: number;
      avgSellPrice: number;
      winRate: number;
    };
    
    role: 'trader' | 'investor' | 'arbitrageur' | 'holder';
  };

  // AI GUIDANCE (FROM MORIO/ELDER AGENTS)
  aiInsights: {
    primarySignal: {
      action: 'BUY' | 'SELL' | 'HOLD' | 'MONITOR' | 'ARBITRAGE';
      confidence: number;      // 0-100
      reasoning: string;       // "RSI bullish crossover + MA alignment"
      sources: string[];       // ['RSI', 'MACD', 'Portfolio']
    };
    
    warnings: Array<{
      type: 'volatility' | 'liquidity' | 'risk' | 'opportunity';
      severity: 'critical' | 'warning' | 'info';
      message: string;
    }>;
    
    recommendations: Array<{
      action: string;
      reason: string;
      venue?: 'CEX' | 'DEX' | 'Flash';
      expectedOutcome: string;
    }>;
  };

  // MARKET SENTIMENT (Future: News, Social, Fear Index)
  sentiment: {
    fearGreed?: number;         // 0-100
    socialVolume?: number;      // Mentions, followers engaged
    newsScore?: number;         // Positive/negative news
    trend: 'bullish' | 'neutral' | 'bearish';
  };

  // MACHINE-READABLE STATUS
  status: {
    dataFreshness: number;      // How old is the data? (ms)
    isLiquid: boolean;          // Trade-able right now?
    confidence: number;         // How confident are we? 0-100
    lastUpdated: number;        // Unix timestamp
  };
}
```

---

## Phase 1 Tasks (Engine-First Approach)

### Task 1: Create AssetStateEngine Service

**File:** `server/services/assetStateEngine.ts`

```typescript
import { AssetState } from '../types/assetTypes';
import { priceOracle } from './priceOracle';
import { ccxtService } from './ccxtService';
import { dexIntegrationService } from './dexIntegrationService';
import { arbitrageDetector } from './arbitrageDetector';
import { marketAnalyticsService } from './marketAnalyticsService';
import * as indicators from './indicators';  // YOUR LIBRARY
import { getUserPortfolioState } from './portfolioService';
import { getMorioSignal } from '../agents/morio';

export class AssetStateEngine {
  static async compute(
    symbol: string,
    userContext?: { userId: string; daoId: string }
  ): Promise<AssetState> {
    const startTime = Date.now();

    // 1. GET PRICE & VOLATILITY
    const priceData = await priceOracle.getPrice(symbol);
    const volatilityData = await marketAnalyticsService.analyzeSpreadTrends(symbol);

    // 2. GET CEX DATA (ALL SOURCES)
    const cexSources = await ccxtService.getMarketSources(symbol);
    const cexBest = this.findBestCEXVenue(cexSources);

    // 3. GET DEX DATA
    const dexSources = await dexIntegrationService.getLiquidityPools(symbol);
    const dexBest = this.findBestDEXVenue(dexSources);

    // 4. CROSS-EXCHANGE INTELLIGENCE
    const arbitrageOps = await arbitrageDetector.detectOpportunitiesForPair(symbol);
    const spreadAnalysis = this.analyzeSpreadTrend(cexSources, dexSources);

    // 5. TECHNICAL INDICATORS (Using your indicators.ts library)
    const priceHistory = await this.getPriceHistory(symbol, 200); // Last 200 candles
    const technicals = this.calculateTechnicals(priceHistory);

    // 6. USER PORTFOLIO CONTEXT
    const portfolioState = userContext 
      ? await getUserPortfolioState(userContext.userId, symbol)
      : null;

    // 7. AI GUIDANCE
    const aiSignal = userContext
      ? await getMorioSignal(symbol, technicals, spreadAnalysis, portfolioState)
      : null;

    // 8. ASSEMBLE ASSET STATE
    const assetState: AssetState = {
      identification: {
        symbol,
        name: priceData.name,
        exchange: 'multi',
        pair: `${symbol}/USDT`,
        category: this.categorizeAsset(symbol),
        timestamp: Date.now(),
      },

      price: {
        current: priceData.price,
        change24h: priceData.change24h,
        changePercent24h: priceData.changePercent24h,
        high24h: priceData.high24h,
        low24h: priceData.low24h,
        volatility: {
          current: volatilityData.currentSpread,
          ma20: volatilityData.averageSpread,
          trend: volatilityData.spreadTrend,
        },
      },

      cex: {
        sources: cexSources,
        best: cexBest,
        depth: this.analyzeOrderBookDepth(cexSources),
      },

      dex: {
        sources: dexSources,
        best: dexBest,
      },

      crossExchange: {
        weighted_price: this.calculateWeightedPrice(cexSources, dexSources),
        spread: spreadAnalysis,
        arbitrage: {
          opportunities: arbitrageOps,
          bestOpportunity: arbitrageOps[0] || null,
        },
      },

      technicals,

      userContext: portfolioState || {},

      aiInsights: aiSignal || {
        primarySignal: { action: 'HOLD', confidence: 0, reasoning: '', sources: [] },
        warnings: [],
        recommendations: [],
      },

      sentiment: {
        // To be implemented: Fear & Greed, social volume, news integration
        trend: 'neutral',
      },

      status: {
        dataFreshness: Date.now() - startTime,
        isLiquid: cexBest.spread < 0.5 && dexBest.slippage < 1,
        confidence: this.calculateConfidence(cexSources, dexSources),
        lastUpdated: Date.now(),
      },
    };

    return assetState;
  }

  // HELPER: Calculate technicals using indicators.ts
  private static calculateTechnicals(priceHistory: any[]): AssetState['technicals'] {
    const closes = priceHistory.map(c => c.close);
    const highs = priceHistory.map(c => c.high);
    const lows = priceHistory.map(c => c.low);

    // Use YOUR indicators library
    const rsiValues = indicators.rsi(closes, 14);
    const macdData = indicators.macd(closes);
    const bbands = indicators.bollingerBands(closes, 20);
    const moving = {
      ma20: indicators.sma(closes, 20),
      ma50: indicators.sma(closes, 50),
      ma200: indicators.sma(closes, 200),
    };
    const atrValues = indicators.atr(highs, lows, closes, 14);

    const currentRSI = rsiValues[rsiValues.length - 1];
    const currentMACD = macdData.macd[macdData.macd.length - 1];
    const currentSignal = macdData.signal[macdData.signal.length - 1];

    return {
      rsi: {
        value: currentRSI,
        signal: currentRSI > 70 ? 'overbought' : currentRSI < 30 ? 'oversold' : 'neutral',
        strength: Math.abs(currentRSI - 50),
      },
      macd: {
        line: currentMACD,
        signal: currentSignal,
        histogram: macdData.histogram[macdData.histogram.length - 1],
        signal: currentMACD > currentSignal ? 'bullish_crossover' : 'bearish_crossover',
      },
      movingAverages: {
        ma20: moving.ma20[moving.ma20.length - 1],
        ma50: moving.ma50[moving.ma50.length - 1],
        ma200: moving.ma200[moving.ma200.length - 1],
        alignment: this.checkMAsAlignment(moving, closes[closes.length - 1]),
      },
      bollingerBands: {
        middle: bbands.middle[bbands.middle.length - 1],
        upper: bbands.upper[bbands.upper.length - 1],
        lower: bbands.lower[bbands.lower.length - 1],
        position: this.checkBBPosition(closes[closes.length - 1], bbands),
        volatility: (bbands.upper[bbands.upper.length - 1] - bbands.lower[bbands.lower.length - 1]) / bbands.middle[bbands.middle.length - 1],
      },
      atr: atrValues[atrValues.length - 1],
      trend: this.analyzeTrend(closes, moving),
    };
  }

  // ... other helpers (categorizeAsset, findBestCEXVenue, etc.)
}
```

### Task 2: Create Unified API Endpoint

**File:** `server/routes/intelligence.ts`

```typescript
import { Router } from 'express';
import { AssetStateEngine } from '../services/assetStateEngine';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * POST /api/intelligence/asset/:symbol
 * Returns complete AssetState for a symbol + user context
 */
router.post('/asset/:symbol', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { userId, daoId } = req.body;

    // Compute unified asset state
    const assetState = await AssetStateEngine.compute(symbol, { userId, daoId });

    res.json({
      success: true,
      data: assetState,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/intelligence/asset/:symbol/cached
 * Returns cached AssetState (no computation)
 */
router.get('/asset/:symbol/cached', async (req, res) => {
  // Cache with 5s TTL for real-time feel
  const cached = await cacheService.get(`asset-state:${req.params.symbol}`);
  if (!cached) {
    return res.status(404).json({ error: 'Not cached' });
  }
  res.json({ success: true, data: cached });
});

export default router;
```

### Task 3: Dashboard Component (Consumes AssetState)

**File:** `frontend/src/components/AssetIntelligenceDashboard.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { AssetState } from '@/types/assetTypes';

export const AssetIntelligenceDashboard: React.FC<{ symbol: string }> = ({ symbol }) => {
  const [assetState, setAssetState] = useState<AssetState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Single API call gets everything
    fetch(`/api/intelligence/asset/${symbol}`, { method: 'POST', body: JSON.stringify({}) })
      .then(res => res.json())
      .then(data => setAssetState(data.data))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return <div>Loading intelligence...</div>;
  if (!assetState) return <div>No data</div>;

  return (
    <div className="asset-intelligence-dashboard">
      {/* All sections now consume from single source of truth */}
      <PriceSection state={assetState} />
      <TechnicalSection state={assetState.technicals} />
      <LiquiditySection state={assetState} />
      <PortfolioImpact state={assetState.userContext} />
      <AIGuidance state={assetState.aiInsights} />
      <ActionPanel symbol={symbol} state={assetState} />
    </div>
  );
};
```

### Task 4: Integration Testing

**File:** `server/tests/assetStateEngine.test.ts`

```typescript
import { AssetStateEngine } from '../services/assetStateEngine';

describe('AssetStateEngine', () => {
  test('should compute complete AssetState for BTC', async () => {
    const state = await AssetStateEngine.compute('BTC', {
      userId: 'test-user',
      daoId: 'test-dao',
    });

    // Verify all layers exist
    expect(state.identification).toBeDefined();
    expect(state.price).toBeDefined();
    expect(state.cex).toBeDefined();
    expect(state.dex).toBeDefined();
    expect(state.crossExchange).toBeDefined();
    expect(state.technicals).toBeDefined();
    expect(state.aiInsights).toBeDefined();

    // Verify technicals are calculated
    expect(state.technicals.rsi.value).toBeTruthy();
    expect(state.technicals.macd.line).toBeTruthy();
  });

  test('technical indicators should match live market conditions', async () => {
    const state = await AssetStateEngine.compute('ETH');
    
    // RSI between 0-100
    expect(state.technicals.rsi.value).toBeGreaterThanOrEqual(0);
    expect(state.technicals.rsi.value).toBeLessThanOrEqual(100);

    // MAs in expected order
    expect(state.technicals.movingAverages.ma200).toBeLessThan(
      state.technicals.movingAverages.ma50
    );
  });
});
```

---

## Why This Approach is Superior

| Aspect | Old (Feature-First) | New (Engine-First) |
|--------|-------------------|-------------------|
| **Architecture** | Scattered components | Single source of truth |
| **Testing** | Hard to test cross-layer | Easy to unit test engine |
| **Reusability** | Duplicate logic | One engine, many consumers |
| **Real-time** | Add WebSocket to each piece | Add WebSocket to engine once |
| **AI Integration** | Morio has no context | Morio consumes AssetState |
| **Mobile** | Rebuild for mobile | Same API, new UI |
| **Performance** | N+1 API calls | 1 smart API call |

---

## Phase 1 Deliverables

```
✅ assetStateEngine.ts
   ├── compute(symbol, userContext) → Promise<AssetState>
   └── Uses all 5 layers + technicals + AI

✅ /api/intelligence/asset/:symbol endpoint
   ├── POST: compute fresh state
   └── GET /cached: return cached state (5s TTL)

✅ AssetIntelligenceDashboard component
   └── Consumes single AssetState object

✅ Integration tests
   └── Verify engine outputs correct state

✅ Documentation
   └── How to use AssetState in downstream services
```

---

## Downstream Services (Phase 2+)

Once AssetStateEngine is solid:

```
AssetStateEngine
    ↓
    ├→ WebSocket: Real-time AssetState streams
    ├→ Alerts: Monitor for crossed thresholds
    ├→ Morio: Consume for recommendations
    ├→ Mobile App: Use same API
    └→ Analytics: Log state transitions
```

---

## Quick Wins (First Week)

1. **Day 1-2:** AssetStateEngine skeleton + 3 test symbols
2. **Day 3-4:** Wire up all 5 layers (use existing services)
3. **Day 5:** Dashboard component that renders AssetState
4. **Day 6:** Integration testing
5. **Day 7:** Live testing vs real market data

By end of week: **Single source of truth for any asset, any context.**

This is the foundation. Everything else is just different views into this one object.

---

## Connection to Yuki

Yuki trading platform can now consume AssetState for:
- Strategy decision-making (technicals + spread analysis)
- Execution optimization (best venue routing)
- Risk signals (volatility + portfolio impact)
- AI guidance integration

Instead of Yuki querying 5 services, it queries one engine.

---

**Ready to implement?** The indicators.ts library is your secret weapon—all calculations are dependency-free, auditable, and production-ready.
