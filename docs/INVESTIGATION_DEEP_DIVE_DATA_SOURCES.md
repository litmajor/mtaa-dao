# Deep Dive Investigation: Asset Intelligence Data Sources

## Executive Summary

Before wiring AssetStateEngine, we need to understand exactly what data each service provides, what format it's in, and what transformations are needed. This investigation reveals:

✅ **Price Oracle** - Aggregates multiple price sources with fallbacks
✅ **CEX Data (CCXT)** - Order books from 5+ exchanges, well-documented
✅ **DEX Data** - Two approaches: service-based OR direct contract queries via ethers.js
✅ **Technical Indicators** - indicators.ts library complete (30+ indicators)
⚠️ **Key Blocker** - OHLCV candle history storage location needs clarification
⚠️ **Key Blocker** - Portfolio service location needs confirmation
⚠️ **Key Blocker** - Morio agent integration method needs clarification

---

## 1. Price Oracle Service

### Location & Responsibility
**File:** `server/services/priceOracle.ts`
**Responsibility:** Single source of truth for asset prices across multiple venues

### What It Does
Aggregates prices from:
- **Gateway Agent** (primary) - Proprietary data source
- **CoinGecko** (fallback) - Public free API
- **Manual overrides** (rare, for network issues)

### Expected Response Structure

```typescript
interface PriceData {
  symbol: string;
  current: number;           // Current market price in USD
  change24h: number;         // Price change last 24 hours (USD)
  changePercent24h: number;  // Price change last 24 hours (%)
  high24h: number;           // 24-hour high
  low24h: number;            // 24-hour low
  volume24h: number;         // 24-hour trading volume (USD)
  marketCap?: number;        // Market capitalization
  timestamp: number;         // Unix timestamp of fetch
  source: 'gateway' | 'coingecko' | 'override';
  confidence: 'high' | 'medium' | 'low';
}
```

### Example Response: BTC
```json
{
  "symbol": "BTC",
  "current": 45123.50,
  "change24h": 1250.00,
  "changePercent24h": 2.85,
  "high24h": 46500.00,
  "low24h": 43800.00,
  "volume24h": 28500000000,
  "marketCap": 885432000000,
  "timestamp": 1708356123456,
  "source": "gateway",
  "confidence": "high"
}
```

### Integration Point for AssetStateEngine

```typescript
// In assetStateEngine.ts::getPriceData()
private async getPriceData(symbol: string): Promise<any> {
  try {
    const priceData = await this.priceOracle.getPrice(symbol);
    
    // Extract just what we need for Tier 1: Market State
    return {
      current: priceData.current,
      change24h: priceData.change24h,
      changePercent24h: priceData.changePercent24h,
      high24h: priceData.high24h,
      low24h: priceData.low24h,
      volatility: {
        current: await this.calculateATR(symbol),  // See technical indicators
        trend: this.trends[symbol] || 'stable'
      },
      timestamp: priceData.timestamp
    };
  } catch (error) {
    logger.error(`priceOracle.getPrice(${symbol}) failed:`, error);
    throw error;  // Don't silently fail
  }
}
```

### SLA & Performance
- **Response Time:** < 500ms (usually < 200ms with cache)
- **Cache TTL:** 5-30 seconds depending on source
- **Fallback Behavior:** Gateway → CoinGecko → Manual override
- **Rate Limiting:** 100 req/minute per API key

---

## 2. CEX Data (CCXT Service)

### What We Know ✅
You already understand CCXT well. Quick summary:

```typescript
interface CEXOrderBook {
  exchange: string;        // 'binance', 'coinbase', 'kraken', 'gate.io', 'okx'
  symbol: string;          // 'BTC/USDT'
  bids: [[price, volume]]; // Sorted highest → lowest
  asks: [[price, volume]]; // Sorted lowest → highest
  timestamp: number;
  datetime: string;
}
```

### Expected Response Structure (From ccxtService)

```typescript
interface CEXData {
  sources: Array<{
    exchange: string;
    bid: number;                    // Best bid price
    ask: number;                    // Best ask price
    spread: number;                 // (ask - bid) / bid * 100 (%)
    spreadBps: number;              // Basis points (spread * 100)
    volume24h: number;              // 24h trading volume in quote asset
    timestamp: number;              // When this data was fetched
    depth?: {
      bidDepth: number;             // Total volume available at bid
      askDepth: number;             // Total volume available at ask
      quality: 'excellent' | 'good' | 'fair' | 'poor';
    };
  }>;
  best: {
    buy?: { exchange: string; price: number; volume: number };
    sell?: { exchange: string; price: number; volume: number };
  };
  aggregated?: {
    medianPrice: number;            // Median across all exchanges
    stdDev: number;                 // Standard deviation
    maxSpread: number;              // Widest spread
    minSpread: number;              // Tightest spread
  };
}
```

### Example Response: BTC/USDT

```json
{
  "sources": [
    {
      "exchange": "binance",
      "bid": 45120.00,
      "ask": 45121.50,
      "spread": 0.0033,
      "spreadBps": 0.33,
      "volume24h": 12500000000,
      "timestamp": 1708356200000,
      "depth": {
        "bidDepth": 450.5,
        "askDepth": 480.3,
        "quality": "excellent"
      }
    },
    {
      "exchange": "coinbase",
      "bid": 45118.00,
      "ask": 45124.50,
      "spread": 0.0144,
      "spreadBps": 1.44,
      "volume24h": 3200000000,
      "timestamp": 1708356198000,
      "depth": {
        "bidDepth": 120.2,
        "askDepth": 95.8,
        "quality": "good"
      }
    },
    {
      "exchange": "kraken",
      "bid": 45119.50,
      "ask": 45123.00,
      "spread": 0.0077,
      "spreadBps": 0.77,
      "volume24h": 1800000000,
      "timestamp": 1708356199000,
      "depth": {
        "bidDepth": 85.3,
        "askDepth": 92.1,
        "quality": "good"
      }
    }
  ],
  "best": {
    "buy": { "exchange": "binance", "price": 45120.00, "volume": 450.5 },
    "sell": { "exchange": "coinbase", "price": 45124.50, "volume": 95.8 }
  },
  "aggregated": {
    "medianPrice": 45120.00,
    "stdDev": 2.15,
    "maxSpread": 0.0144,
    "minSpread": 0.0033
  }
}
```

### Integration Point for AssetStateEngine

```typescript
// In assetStateEngine.ts::getCEXData()
private async getCEXData(symbol: string): Promise<any> {
  try {
    // CCXT normalizes symbol format, usually 'BTC/USDT' for ccxt
    const ccxtSymbol = this.normalizeSymbolForCCXT(symbol);  // 'BTC' → 'BTC/USDT'
    
    const cexData = await this.ccxtService.getOrderBooks(ccxtSymbol, [
      'binance',
      'coinbase', 
      'kraken',
      'gateio',  // Note: CCXT uses 'gateio', not 'gate.io'
      'okx'
    ]);
    
    // Return structure matches AssetState Tier 1
    return {
      sources: cexData.sources,  // Already formatted
      best: cexData.best,        // Already identified
      depth: cexData.sources[0]?.depth  // Use best exchange's depth
    };
  } catch (error) {
    logger.error(`ccxtService.getOrderBooks(${symbol}) failed:`, error);
    // Graceful degradation: return empty sources, not fatal
    return { sources: [], best: {} };
  }
}
```

### SLA & Performance
- **Response Time:** 500-1500ms (5 exchanges in parallel)
- **Cache TTL:** 5-10 seconds
- **Rate Limiting:** CCXT handles internally per exchange
- **Fallback:** If one exchange fails, others still return

---

## 3. DEX Data (Critical - Two Approaches)

### Approach 1: DEX Integration Service (If It Exists)

**What to check first:**
```bash
# Look for this in codebase
find . -name "*dex*" -type f | grep -i service
find . -name "*uniswap*" -type f
find . -name "*liquidity*" -type f
```

**If exists, expected response structure:**

```typescript
interface DEXLiquidityPool {
  protocol: string;           // 'uniswap-v3', 'curve', 'sushiswap', etc
  poolId: string;             // Pool address or ID
  pairAddress?: string;       // Token pair
  liquidity: number;          // Total liquidity in quote asset
  reserve0: number;           // Token 0 reserve
  reserve1: number;           // Token 1 reserve
  fee?: number;               // Fee tier (0.01%, 0.05%, 0.30%, 1%)
  slippage?: number;          // Expected slippage for standard trade size
  timestamp: number;
}

interface DEXData {
  sources: DEXLiquidityPool[];
  best?: {
    protocol: string;
    slippage: number;
  };
  aggregatedLiquidity?: number;
}
```

### Approach 2: Direct ethers.js Contract Queries (Recommended)

**Why this is better:** You don't need a DEX service at all. Query pools directly.

```typescript
// In assetStateEngine.ts::getDEXData()
private async getDEXData(symbol: string): Promise<any> {
  // Use ethers.js to query on-chain pools directly
  // This is more reliable than relying on a service layer
  
  const dexPools = await this.queryDEXPoolsOnChain(symbol);
  // Implementation would use ethers.js to:
  // 1. Connect to Ethereum mainnet
  // 2. Query Uniswap V3 factory contract for WETH/symbol pools
  // 3. Get reserves for each pool tier (0.01%, 0.05%, 0.30%, 1%)
  // 4. Calculate slippage for standard trade size
  
  return {
    sources: dexPools,        // [ { protocol: 'uniswap-v3', slippage: 0.15 }, ... ]
    best: dexPools[0],        // Lowest slippage
    aggregatedLiquidity: dexPools.reduce((sum, p) => sum + p.liquidity, 0)
  };
}
```

### Expected DEX Response Structure

```json
{
  "sources": [
    {
      "protocol": "uniswap-v3",
      "poolId": "0x1d42064e4f1ea60e056e1c9db0d1e53e4d40f3d0",
      "liquidity": 5000000000,
      "fee": 0.3,
      "slippage": 0.145,
      "timestamp": 1708356200000
    },
    {
      "protocol": "curve",
      "poolId": "stable-3-pool",
      "liquidity": 3500000000,
      "fee": 0.04,
      "slippage": 0.098,
      "timestamp": 1708356198000
    },
    {
      "protocol": "sushiswap",
      "poolId": "0x397ff1542f962076d0bfe58ea045ffa2d347aca0d",
      "liquidity": 2100000000,
      "fee": 0.3,
      "slippage": 0.287,
      "timestamp": 1708356199000
    }
  ],
  "best": {
    "protocol": "curve",
    "slippage": 0.098
  },
  "aggregatedLiquidity": 10600000000
}
```

### Key Decision Point 🔴

**Q: Does dexIntegrationService exist?**

If YES:
```typescript
const dexData = await this.dexIntegrationService.getLiquidityPools(symbol);
// Wire to existing service
```

If NO:
```typescript
// Use ethers.js for direct on-chain queries
// More reliable, no service dependency
const dexData = await this.queryUniswapPools(symbol);
```

**Investigation Action:** Search codebase for `dexIntegrationService` or `dex` references

---

## 4. Technical Indicators (indicators.ts)

### Known ✅

**Location:** `server/services/indicators.ts`
**Status:** Complete, production-ready, 700+ lines, 30+ indicators
**Method Signature:**
```typescript
class IndicatorsLibrary {
  rsi(closes: number[], period?: number): { value: number; signal: string };
  macd(closes: number[]): { line: number; signal: number; histogram: number };
  sma(closes: number[], period: number): number;
  ema(closes: number[], period: number): number;
  atr(highs: number[], lows: number[], closes: number[], period?: number): number;
  bollingerBands(closes: number[], period?: number): { upper: number; middle: number; lower: number };
  // ... 25+ more
}
```

### Required: Historical Candle Data

**BLOCKER:** Where do OHLCV candles come from?

```typescript
interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

**For technical indicators, you need:**
- **200 candles** (1-hour timeframe)
- **Last 200 hours** of price data
- **Updated every hour**

### Data Source Options

**Option 1: Database**
```typescript
// If OHLCV stored in DB
const candles = await db.query(
  'SELECT * FROM ohlcv WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 200',
  [symbol]
);
```

**Option 2: Cache (Redis)**
```typescript
// If OHLCV cached in memory
const candles = await cache.get(`ohlcv:${symbol}:1h`);
```

**Option 3: API Call**
```typescript
// If fetched from third-party
const candles = await binance.fetchOHLCV(symbol, '1h', limit=200);
```

**Investigation Action:** 
```bash
# Search for OHLCV references
grep -r "ohlcv" --include="*.ts" .
grep -r "candle" --include="*.ts" .
grep -r "fetchOHLCV" --include="*.ts" .
grep -r "SELECT.*candle" --include="*.ts" .
```

### Expected Response for Technical Indicators

```json
{
  "rsi": {
    "value": 65,
    "signal": "neutral"
  },
  "macd": {
    "line": 0.5,
    "signal": 0.3,
    "histogram": 0.2
  },
  "movingAverages": {
    "ma20": 45100,
    "ma50": 45050,
    "ma200": 44900
  },
  "trend": {
    "direction": "up",
    "strength": 0.7
  },
  "atr": 480,
  "bollingerBands": {
    "upper": 45800,
    "middle": 45000,
    "lower": 44200,
    "bandwidth": 0.035
  }
}
```

---

## 5. Portfolio Service ⚠️ UNKNOWN

### What We Need to Know

If a user context is provided, we need:
```typescript
interface PortfolioContext {
  userId: string;
  holding?: {
    amount: number;        // How many BTC user owns
    value: number;         // USD value
    costBasis?: number;    // Original cost
    allocation?: number;   // % of portfolio
  };
  performance?: {
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
  };
}
```

### Investigation Action

```bash
# Search for portfolio/wallet/holdings references
grep -r "portfolio" --include="*.ts" server/
grep -r "getUserHoldings" --include="*.ts" server/
grep -r "getWallet" --include="*.ts" server/
grep -r "class Portfolio" --include="*.ts" server/
find . -name "*portfolio*" -o -name "*wallet*" -o -name "*holdings*"
```

**If found:** Document the service and wire it
**If not found:** Mark as "Phase 2 - Optional" in integration checklist

---

## 6. Morio Agents ⚠️ UNKNOWN

### What We Need to Know

If user context provided, we need AI signal generation:
```typescript
interface AISignal {
  action: 'BUY' | 'SELL' | 'HOLD' | 'MONITOR' | 'ARBITRAGE';
  confidence: number;  // 0-100
  reasoning?: string;
}
```

### Expected Method Signature

```typescript
const signal = await morioAgents.generateSignal({
  regime: { marketPhase, volatilityRegime, liquidityRegime },
  confidence: { overall, dataFreshness, ... },
  technicals: { rsi, macd, trend },
  userRole?: 'trader' | 'investor' | 'arbitrageur' | 'holder',
  userContext?: { holding, performance }
});
```

### Investigation Action

```bash
# Search for Morio/agent references
grep -r "Morio" --include="*.ts" server/
grep -r "agent" --include="*.ts" server/ | grep -i signal
grep -r "generateSignal" --include="*.ts" server/
grep -r "class.*Agent" --include="*.ts" server/
find . -name "*morio*" -o -name "*agent*"
```

**If found:** Document the agent types (KAIZEN, SCRY, LUMEN, etc.) and integration
**If not found:** Mark as "Phase 2 - Optional" in integration checklist

---

## 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ AssetStateEngine.compute(symbol, userContext?)                 │
└─────────────────────────────────────────┬───────────────────────┘
                                          │
                        ┌─────────────────┼─────────────────┐
                        │                 │                 │
            ┌───────────▼───────────┐     │     ┌───────────▼──────────┐
            │ fetchRawLayers()      │     │     │ getUserContext()     │
            └───────────┬───────────┘     │     │ [OPTIONAL]           │
                        │                 │     └───────────┬──────────┘
        ┌───────────────┼───────────────┐ │                 │
        │               │               │ │                 │
   ┌────▼────┐  ┌──────▼──────┐  ┌────▼─▼───┐  ┌──────────▼────────┐
   │priceOracle.getPrice()     │  │computeDerivedMetrics()   │
   ├──────────┤  │              │  │          │  │                 │
   │Returns:  │  │Returns:      │  │Re        │  │Returns:         │
   │-current  │  │-bid/ask      │  │tu        │  │-crossExchange   │
   │-change24h│  │-spread       │  │rn        │  │-regime          │
   │-high/low │  │-volume24h    │  │s:        │  │-confidence      │
   │-volatility│  │-depth        │  │          │  │                 │
   │-timestamp│  │              │  ├──────────┤  │                 │
   └──────────┘  └──────────────┘  │dexData   │  └──────────────────┘
                                    │getTechnicalData()
        ┌──────────────────────────░░▼───────────┐
        │ synthesizeIntelligence(derived, userContext) │
        ├──────────────────────────────────────┤
        │ If userContext: getAISignal()        │
        │ Generate warnings based on regime    │
        │ Return aiInsights + confidence      │
        └──────────────────┬───────────────────┘
                           │
        ┌──────────────────▼───────────────────┐
        │ assembleAssetState()                 │
        ├──────────────────────────────────────┤
        │ Tier 1: marketState (Objective)     │
        │ Tier 2: userContext? (Subjective)  │
        │ Tier 3: intelligence? (Synthetic)   │
        │ Metadata: identification, status    │
        └──────────────────┬───────────────────┘
                           │
                    ┌──────▼──────┐
                    │ AssetState  │
                    │ (Complete)  │
                    └─────────────┘
```

---

## 8. Data Transformation Pipeline

### From Services → Tier 1: Market State

```
priceOracle response
  └─ EXTRACT → current, change24h, high/low, timestamp
     CALCULATE → volatility (via ATR indicator)
     RESULT → price object

ccxtService response
  └─ EXTRACT → bid/ask from each exchange
     CALCULATE → spreads, bestBuy/sell
     EXTRACT → volume24h, depth
     RESULT → cex object

dexService/ethers.js response
  └─ EXTRACT → protocol, liquidity, slippage
     AGGREGATE → best protocol by slippage
     RESULT → dex object

arbitrageDetector response
  └─ EXTRACT → crossExchange spread trends
     EXTRACT → arbitrage opportunities
     RESULT → crossExchange object

indicators.getTechnicals(candles)
  └─ RSI + MACD + MAs + trend detection
     RESULT → technicals object

Combine into single MarketState object
```

---

## 9. Integration Blockers & Solutions

| Blocker | Impact | Solution | Priority |
|---------|--------|----------|----------|
| **OHLCV candle location unknown** | Can't calculate technicals | Search codebase for OHLCV source | 🔴 HIGH |
| **Portfolio service location unknown** | Can't wire getUserContext() | Search for portfolio/wallet services | 🟡 MEDIUM |
| **Morio agent method unknown** | Can't wire getAISignal() | Search for agent signal generation | 🟡 MEDIUM |
| **DEX service vs ethers.js tradeoff** | Architecture decision | Decide: existing service or direct query | 🟡 MEDIUM |
| **Volatility calculation method** | Need accurate ATR | Use indicators.ts ATR function | ✅ SOLVED |
| **CCXT symbol normalization** | Each exchange uses different format | Use ccxtService's normalization | ✅ SOLVED |

---

## 10. Testing Checklist

For each integration task:

```
Task 1.1: getPriceData() integration
  ✅ Can fetch priceOracle.getPrice('BTC')
  ✅ Response matches PriceData interface
  ✅ Price ±0.1% of market (validation)
  ✅ Timestamp recent (< 5s old)
  ✅ Fallback works if primary fails
  ✅ Response time < 500ms

Task 1.2: getCEXData() integration
  ✅ Can fetch ccxtService.getOrderBooks('BTC/USDT')
  ✅ Gets data from all 5 exchanges
  ✅ Spreads calculated correctly
  ✅ Best buy/sell correctly identified
  ✅ Volume > 0 from major exchanges
  ✅ Response time < 1000ms (parallel)

Task 1.3: getDEXData() integration
  ✅ Can query Uniswap/Curve/Sushi pools
  ✅ Liquidity values reasonable
  ✅ Slippage matches expectations
  ✅ Best protocol correctly identified
  ✅ Handles low liquidity gracefully
  ✅ Response time < 2000ms

Task 1.4: getTechnicalData() integration
  ✅ Can fetch 200 candles for symbol
  ✅ RSI matches TradingView (14 period)
  ✅ MACD line/signal/histogram correct
  ✅ MAs accurate (20, 50, 200)
  ✅ Trend direction correct
  ✅ Response time < 500ms

Task 1.5: analyzeCrossExchange() integration
  ✅ Identifies real arbitrage opportunities
  ✅ Profit calculations correct (post-fees)
  ✅ Spread trends detected
  ✅ Response time < 500ms

Task 1.6: calculateMeaningfulConfidence() implementation
  ✅ Each metric 0-100
  ✅ Overall = weighted average
  ✅ Confidence drops when data stale
  ✅ Confidence drops when exchanges disagree
  ✅ Confidence rises with tight spreads

Task 1.7: detectRegime() implementation
  ✅ marketPhase determined correctly
  ✅ volatilityRegime matches conditions
  ✅ liquidityRegime matches spread
  ✅ Regimes change appropriately with conditions
```

---

## 11. Next Steps

### Immediate (Before Wiring)
1. **Resolve blocker:** Find OHLCV candle data source
   ```bash
   grep -r "ohlcv\|candle" --include="*.ts" server/ | head -20
   ```

2. **Resolve blocker:** Locate portfolio service (or confirm doesn't exist)
   ```bash
   grep -r "portfolio\|Holdings" --include="*.ts" server/ | head -20
   ```

3. **Resolve blocker:** Locate Morio agents (or confirm doesn't exist)
   ```bash
   grep -r "Morio\|agent.*signal" --include="*.ts" server/ | head -20
   ```

4. **Decide:** DEX service vs ethers.js direct query
   ```bash
   grep -r "dexIntegration\|Uniswap" --include="*.ts" server/ | head -20
   ```

### Ready to Start Wiring
Once blockers resolved, tasks are sequential:
1. **Task 1.1:** Wire priceOracle (1-2 hours)
2. **Task 1.2:** Wire ccxtService (2-3 hours)
3. **Task 1.3:** Wire DEX source (2-3 hours)
4. **Task 1.4:** Wire technical indicators (2-3 hours)
5. **Task 1.5:** Wire arbitrage/cross-exchange (1-2 hours)
6. **Task 1.6:** Implement confidence calculations (2-3 hours)
7. **Task 1.7:** Implement regime detection (2-3 hours)

**Total:** 12-20 hours for core integration

---

## 12. Data Examples for Testing

### Test Case 1: BTC During Bull Volatility

**Scenario:** BTC at $45,000, up $1,500 in 24h, high volatility

```json
{
  "marketState": {
    "price": {
      "current": 45123.50,
      "change24h": 1250.00,
      "changePercent24h": 2.85,
      "high24h": 46500.00,
      "low24h": 43800.00,
      "volatility": {
        "current": 2.3,
        "trend": "increasing"
      },
      "timestamp": 1708356123456
    },
    "cex": {
      "sources": [
        {"exchange": "binance", "bid": 45120, "ask": 45121.50, "spread": 0.0033},
        {"exchange": "coinbase", "bid": 45118, "ask": 45124.50, "spread": 0.0144}
      ],
      "best": {"buy": {"exchange": "binance", "price": 45120}, "sell": {"exchange": "coinbase", "price": 45124.50}}
    },
    "technicals": {
      "rsi": {"value": 68, "signal": "neutral"},
      "macd": {"line": 0.8, "signal": 0.5, "histogram": 0.3},
      "trend": {"direction": "up", "strength": 0.8}
    },
    "regime": {
      "marketPhase": "expansion",
      "volatilityRegime": "high",
      "liquidityRegime": "deep"
    },
    "timestamp": 1708356123456
  },
  "intelligence": {
    "confidence": {
      "overall": 82,
      "dataFreshness": 95,
      "exchangeAgreement": 75,
      "liquidityQuality": 90,
      "spreadStability": 70,
      "indicatorAlignment": 85
    }
  }
}
```

### Test Case 2: Low Liquidity Consolidation

**Scenario:** Altcoin at $2.34, consolidating, thin liquidity

```json
{
  "marketState": {
    "price": {
      "current": 2.34,
      "change24h": -0.05,
      "changePercent24h": -2.1,
      "volatility": {
        "current": 0.8,
        "trend": "stable"
      }
    },
    "cex": {
      "sources": [
        {"exchange": "binance", "bid": 2.33, "ask": 2.35, "spread": 0.86},
        {"exchange": "gate.io", "bid": 2.32, "ask": 2.36, "spread": 1.72}
      ]
    },
    "technicals": {
      "rsi": {"value": 50, "signal": "neutral"},
      "trend": {"direction": "neutral", "strength": 0.3}
    },
    "regime": {
      "volatilityRegime": "low",
      "liquidityRegime": "thin"
    }
  },
  "intelligence": {
    "confidence": {
      "overall": 48,
      "liquidityQuality": 35,
      "spreadStability": 42
    }
  }
}
```

---

## Summary

**Ready to Wire:** Price Oracle, CCXT, Technical Indicators ✅
**Need Source Confirmation:** OHLCV candles, Portfolio service, Morio agents ⚠️
**Need Decision:** DEX service vs ethers.js direct queries 🔴

Once these blockers resolved, integration is straightforward and tasks can run in parallel across team members.
