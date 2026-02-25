# Data Source Deep Dive: Before Wiring Phase 1

You're right—let's explore and understand what data each service ACTUALLY produces before doing the integration. This prevents surprises during implementation.

---

## 1️⃣ Price Oracle Data

**File:** `server/services/priceOracle.ts`

### What It Provides

```typescript
interface PriceData {
  symbol: string;        // 'BTC', 'ETH', etc
  name: string;          // 'Bitcoin', 'Ethereum'
  priceUsd: number;      // Current price in USD
  priceChange24h: number; // 24h price change in USD
  marketCap: number;     // Market cap in USD
  volume24h: number;     // 24h volume in USD
  lastUpdated: Date;     // When data was fetched
}
```

### Data Source Strategy
- **Primary:** Gateway Agent Service (custom, probably enterprise API)
- **Fallback:** CoinGecko API `https://api.coingecko.com/api/v3`
- **Caching:** 1 minute TTL for normal data, 5 minutes for fallback data
- **Rate Limiting:** 10 requests per minute window with exponential backoff

### Supported Symbols
```javascript
COIN_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  LTC: 'litecoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  MATIC: 'matic-network',
  AAVE: 'aave',
  LINK: 'chainlink',
  UNI: 'uniswap',
  // ... ~30+ total
}
```

### Fallback Strategy (For Wrapped/Regional Coins)
```javascript
CURRENCY_FALLBACKS = {
  cKES: ['KES', 'USD'],              // Celo Kenyan Shilling
  cREAL: ['REAL', 'BRL', 'USD'],     // Celo Brazilian Real
  cUSD: ['USDC', 'USDT', 'DAI'],     // Celo USD
  cEUR: ['EUR', 'USDC', 'USDT'],     // Celo EUR
  cGLD: ['GLD', 'USD', 'USDC'],      // Celo Gold
}
```

### Key Features
- ✅ Request deduplication (avoid duplicate concurrent calls)
- ✅ Request batching (collect requests, send in batch)
- ✅ Rate limiting with exponential backoff (smart retry)
- ✅ Event emitter for price updates
- ✅ Batch fetch capability

### Method Signature
```typescript
async getPrice(symbol: string): Promise<PriceData | null>
async getPriceData(symbols: string[]): Promise<PriceData[]>  // Batch version
async getHistoricalPrice(symbol: string, timestamp: Date): Promise<number | null>
```

### Real Example Output
```json
{
  "symbol": "BTC",
  "name": "Bitcoin",
  "priceUsd": 45200.50,
  "priceChange24h": 1200.00,
  "marketCap": 884123000000,
  "volume24h": 28350000000,
  "lastUpdated": "2024-02-19T15:30:45Z"
}
```

### Integration Note
⚠️ **Missing:** Volatility calculation is NOT provided by this service
- Will need to either:
  - Request it separately from priceOracle
  - Calculate from historical prices (need OHLC data)
  - Use ATR from indicators.ts

---

## 2️⃣ CCXT Service Data (CEX - Centralized Exchanges)

**File:** `server/services/ccxtService.ts`

### What It Provides

```typescript
interface CachedPrice {
  symbol: string;        // 'BTC/USDT'
  exchange: string;      // 'binance', 'coinbase', 'kraken', 'gate', 'okx'
  bid: number;          // Best bid price
  ask: number;          // Best ask price
  last: number;         // Last trade price
  volume: number;       // 24h volume
  timestamp: number;    // Fetch timestamp
}

interface ExchangeMarket {
  id: string;
  symbol: string;       // 'BTC/USDT'
  base: string;         // 'BTC'
  quote: string;        // 'USDT'
  maker: number;        // 0.001 = 0.1% fee
  taker: number;        // 0.001 = 0.1%
  limits: {
    amount: { min: number; max: number },
    price: { min: number; max: number },
    cost: { min: number; max: number }
  };
}
```

### Supported Exchanges (5 Primary + Fallbacks)

| Exchange | Status | Fee (Maker/Taker) | Notes |
|----------|--------|-------------------|-------|
| **Binance** | ✅ Primary | 0.1% / 0.1% | Highest volume, most liquid |
| **Coinbase** | ✅ Primary | 0.4% / 0.6% | US regulated |
| **Kraken** | ✅ Primary | 0.16% / 0.26% | Advanced features |
| **Gate.io** | ✅ Primary | 0.2% / 0.2% | Global coverage |
| **OKX** | ✅ Primary | 0.02% / 0.05% | High liquidity |
| Bybit | ✅ Secondary | 0.01% / 0.01% | Futures focused |
| KuCoin | ✅ Secondary | 0.1% / 0.1% | Alt coins |

### Data Query Methods

```typescript
// Get ticker (single price point)
async getTickerFromExchange(exchange: string, symbol: string): Promise<Ticker>
// Returns: { bid, ask, last, volume, timestamp }

// Get order book (bid/ask wall structure)
async fetchOrderBook(exchange: string, symbol: string, limit?: number): Promise<OrderBook>
// Returns: { bids: [[price, volume], ...], asks: [[price, volume], ...] }

// Get OHLCV data (candles)
async fetchOHLCV(exchange: string, symbol: string, timeframe: string, limit?: number): Promise<OHLCV[]>
// Returns: [[timestamp, open, high, low, close, volume], ...]

// Get recent trades
async fetchTrades(exchange: string, symbol: string, limit?: number): Promise<Trade[]>
// Returns: [{ id, timestamp, side, price, amount, cost }, ...]

// Get current balance
async getBalance(exchange: string, tradingPairKey?: string): Promise<BalanceInfo>
// Returns: { BTC: {free: 1.5, used: 0.5, total: 2.0}, USDT: {...}, ... }
```

### Real Example: Order Book from Binance

```json
{
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "bids": [
    [44998.50, 2.5],      // price, volume
    [44998.00, 5.3],
    [44997.50, 10.1],
    [44997.00, 15.8]
  ],
  "asks": [
    [45000.00, 1.8],      // price, volume
    [45000.50, 6.2],
    [45001.00, 12.4],
    [45001.50, 18.7]
  ],
  "timestamp": 1708353045000,
  "datetime": "2024-02-19T15:30:45Z"
}
```

### Real Example: Spread Data Across Exchanges

```
BTC/USDT Prices (Feb 19, 15:35 UTC):
┌─────────────┬──────────────┬──────────────┬─────────────┐
│ Exchange    │ Bid (best)   │ Ask (best)   │ Spread %    │
├─────────────┼──────────────┼──────────────┼─────────────┤
│ Binance     │ 44998.50     │ 45000.00     │ 0.0033%     │
│ Coinbase    │ 44999.00     │ 45001.20     │ 0.0049%     │
│ Kraken      │ 44997.80     │ 45002.50     │ 0.0104%     │
│ Gate.io     │ 44996.50     │ 45003.00     │ 0.0144%     │
│ OKX         │ 44995.00     │ 45004.00     │ 0.0201%     │
└─────────────┴──────────────┴──────────────┴─────────────┘

Cross-Exchange Opportunities:
• Lowest Ask: Binance @ 45000.00
• Highest Bid: Kraken @ 44997.80
• Arbitrage Spread: 2.20 USDT per BTC (0.0049% profit before fees)
```

### Integration Note
✅ **Ready to use** - This is the most straightforward service. 

**Challenge:** Multiple exchanges = multiple parallel requests
- Binance: ~100ms
- Coinbase: ~150ms
- Kraken: ~200ms
- Gate.io: ~180ms
- OKX: ~160ms
**Total (parallel):** ~200ms (bottlenecked by slowest)

---

## 3️⃣ DEX Integration Service Data

**File:** `server/services/dexIntegrationService.ts`

### What It Provides

**This is different from what you might expect.** It's not just liquidity querying—it's swap execution.

```typescript
interface SwapQuote {
  fromAsset: string;           // 'ETH'
  toAsset: string;             // 'USDC'
  amountIn: number;            // Amount you're trading
  estimatedAmountOut: number;  // What you'll receive
  exchangeRate: number;        // Direct exchange rate
  priceImpact: number;         // % of slippage
  estimatedGas: number;        // Gas cost estimate
  dex: string;                 // 'uniswap-v3', 'curve', etc
}

interface SwapResult {
  success: boolean;
  transactionHash?: string;
  amountOut?: number;
  actualRate?: number;
  gasUsed?: number;
  error?: string;
}
```

### Supported DEX Protocols & Networks

| Protocol | Chain | Fee | Address | Type |
|----------|-------|-----|---------|------|
| **Ubeswap** | Celo | 0.3%+ | 0xE3D8... | Uniswap-V2 |
| **Uniswap V3** | Ethereum | 0.01-1% | 0xE592... | Uniswap-V3 |
| **Sushiswap** | Ethereum | 0.25% | 0xd9e1... | Uniswap-V2 |
| **Uniswap V3** | Polygon | 0.01-1% | 0xE592... | Uniswap-V3 |
| **Sushiswap** | Polygon | 0.25% | 0x1b02... | Uniswap-V2 |
| **Uniswap V3** | Arbitrum | 0.01-1% | 0xE592... | Uniswap-V3 |
| **Sushiswap** | Arbitrum | 0.25% | 0x1b02... | Uniswap-V2 |
| **Uniswap V3** | Optimism | 0.01-1% | 0xE592... | Uniswap-V3 |
| **PancakeSwap** | BSC | 0.25% | 0x10ED... | Uniswap-V2 |

### Key Data Structures

```typescript
// Provider initialization (RPC endpoint configured)
provider = new ethers.JsonRpcProvider(rpcUrl);

// Available swap methods
async getSwapQuote(swap: SwapRequest): Promise<SwapQuote>
async executeSwap(swap: SwapRequest): Promise<SwapResult>
async getLiquidityPool(protocol: string, pair: string): Promise<PoolData>
```

### Real Example: Swap Quote for 1 ETH → USDC

```json
{
  "fromAsset": "ETH",
  "toAsset": "USDC",
  "amountIn": 1.0,
  "estimatedAmountOut": 3245.50,
  "exchangeRate": 3245.50,
  "priceImpact": 0.12,       // 0.12% slippage for 1 ETH
  "estimatedGas": 0.015,     // ~$45 at 3000 gwei
  "dex": "uniswap-v3",
  "timestamp": 1708353045000
}
```

### ⚠️ Critical Understanding

**This service is focused on EXECUTION, not just data querying.**
- It has write access to wallets
- It can execute actual swaps
- It's meant for simulations and live trading

**For Asset Intelligence, we need:**
1. Pool liquidity data
2. Slippage calculations
3. Historical swap prices

**What we need to extract:**
```typescript
// The data we want from DEX:
{
  protocol: "uniswap-v3",
  poolId: "0x8ad599c3a0ff1de082011efddc58f1908762f2f",
  liquidity: 2500000,        // USD liquidity in pool
  slippage: 0.15,            // % slippage for standard trade
  fee: 0.3,                  // Protocol fee %
  timestamp: 1708353045000
}
```

**Question for Implementation:** 
- Do we query pools directly or call getSwapQuote() with a test amount?
- Need to find out how to get pool liquidity without executing swaps

---

## 4️⃣ Arbitrage Detection Service

**File:** `server/services/arbitrageDetection.ts`

### What It Provides

```typescript
interface ArbitrageOpportunity {
  symbol: string;              // 'BTC'
  buyExchange: string;         // 'binance'
  sellExchange: string;        // 'kraken'
  buyPrice: number;            // 44998.50
  sellPrice: number;           // 45002.80
  spread: number;              // 4.30 USDT
  spreadPercent: number;       // 0.0096%
  profitPerUnit: number;       // 4.30 (before fees)
  profitPercent: number;       // 0.0096% (before fees)
  buyFee: number;              // 0.0010 (maker fee)
  sellFee: number;             // 0.0010 (taker fee)
  netProfit: number;           // 3.10 (after fees)
  netProfitPercent: number;    // 0.0069% (after fees)
  volume: number;              // Available volume
  volumeScore: 'excellent' | 'good' | 'fair' | 'poor';  // Based on volume
  risk: 'low' | 'medium' | 'high' | 'very_high';       // Spread + liquidity
  timestamp: number;           // Detection time
}
```

### Exchange Fee Structure (Built-in Knowledge)

```typescript
fees = {
  binance: { maker: 0.001, taker: 0.001 },     // 0.1%
  coinbase: { maker: 0.004, taker: 0.006 },    // 0.4% / 0.6%
  kraken: { maker: 0.0016, taker: 0.0026 },    // 0.16% / 0.26%
  bybit: { maker: 0.0001, taker: 0.0001 },     // 0.01%
  kucoin: { maker: 0.001, taker: 0.001 },      // 0.1%
  okx: { maker: 0.0002, taker: 0.0005 }        // 0.02% / 0.05%
}
```

### Risk Assessment Logic

```typescript
// Risk increases with: wider spread, lower volume, poor liquidity
if (spreadPercent > 2.0 || liquidityScore < 30) return 'very_high';
if (spreadPercent > 1.0 || liquidityScore < 50 || volumeScore === 'poor') return 'high';
if (spreadPercent > 0.5 || liquidityScore < 65 || volumeScore === 'fair') return 'medium';
return 'low';

// Volume scoring
if (volume > 100000) return 'excellent';
if (volume > 10000) return 'good';
if (volume > 1000) return 'fair';
return 'poor';
```

### Method Signature

```typescript
async findArbitrageOpportunities(
  symbol: string,
  exchanges: string[] = ['binance', 'coinbase', 'kraken', 'gate', 'okx']
): Promise<ArbitrageOpportunity[]>

async findProfitableSymbols(
  exchanges: string[] = ['binance', 'coinbase', 'kraken'],
  minProfitPercent: number = 0.1
): Promise<ProfitableSymbol[]>
```

### Real Example: BTC Arbitrage

```json
{
  "symbol": "BTC",
  "buyExchange": "coinbase",
  "sellExchange": "binance",
  "buyPrice": 45002.20,
  "sellPrice": 45008.80,
  "spread": 6.60,
  "spreadPercent": 0.0147,
  "profitPerUnit": 6.60,
  "profitPercent": 0.0147,
  "buyFee": 270.01,           // Coinbase maker: 0.4%
  "sellFee": 270.05,          // Binance taker: 0.1%
  "netProfit": 6.60 - 540.06 = LOSS,
  "netProfitPercent": -1.2,   // Not profitable after fees!
  "volume": 34000,
  "volumeScore": "excellent",
  "risk": "low",
  "timestamp": 1708353045000
}
```

### Integration Note
✅ **Ready to use** - Direct call to detect opportunities

**Caching:** 60 seconds TTL (data is volatile—arbitrage windows close fast)

---

## 5️⃣ Market Analytics Service

**File:** `server/services/marketAnalyticsService.ts`

### What It Provides

```typescript
interface SpreadAnalysis {
  symbol: string;              // 'BTC'
  exchange: string;            // 'binance'
  timestamp: number;
  currentSpread: number;       // Current spread %
  spreadTrend: 'widening' | 'stable' | 'tightening';
  spreadHistory: Array<{
    timestamp: number;
    spread: number;
  }>;
  averageSpread: number;       // Average over time window
  spreadVolatility: number;    // Standard deviation
  tightestSpread: number;      // Min spread
  widestSpread: number;        // Max spread
}

interface DepthAnalysis {
  symbol: string;
  exchange: string;
  timestamp: number;
  bidDepth: {
    level1: number;            // Volume within 0.5%
    level2: number;            // Volume within 1%
    level5: number;            // Volume within 5%
    level10: number;           // Volume within 10%
    total: number;
  };
  askDepth: {
    level1: number;
    level2: number;
    level5: number;
    level10: number;
    total: number;
  };
  depthTrend: 'improving' | 'stable' | 'degrading';
  depthImbalance: number;      // bid / ask depth ratio
  liquidityHealth: number;     // 0-100 score
}

interface MarketMicrostructure {
  symbol: string;
  exchange: string;
  timestamp: number;
  orderFlowImbalance: number;  // -100 (sell pressure) to 100 (buy pressure)
  priceImpactEstimate: number; // For $1M order
  effectiveSpread: number;     // Including market impact
  resilienceIndicator: number; // Recovery speed after large trades
  microstructureQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface LiquidityTrend {
  symbol: string;
  exchange: string;
  timeWindow: string;          // '1h', '24h', etc
  trend: 'improving' | 'stable' | 'degrading';
  liquidityScore: number;      // 0-100
  averageDailyVolume: number;
  volumeTrend: 'increasing' | 'stable' | 'decreasing';
  volumeImbalance: {
    buyVolume: number;
    sellVolume: number;
    ratio: number;             // buy/sell
  };
  recommendations: string[];
}
```

### Method Signatures

```typescript
async analyzeSpreadTrends(
  symbol: string,
  exchange: string = 'binance',
  timeWindow: number = 3600000  // 1 hour
): Promise<SpreadAnalysis>

async analyzeDepth(
  symbol: string,
  exchange: string = 'binance'
): Promise<DepthAnalysis>

async analyzeMarketMicrostructure(
  symbol: string,
  exchange: string = 'binance'
): Promise<MarketMicrostructure>

async analyzeLiquidityTrend(
  symbol: string,
  exchange: string = 'binance',
  timeWindow: string = '24h'
): Promise<LiquidityTrend>
```

### Real Example: Spread Trend Analysis (BTC/USDT on Binance)

```json
{
  "symbol": "BTC",
  "exchange": "binance",
  "timestamp": 1708353045000,
  "currentSpread": 0.0043,
  "spreadTrend": "stable",
  "spreadHistory": [
    {"timestamp": 1708349445000, "spread": 0.0045},
    {"timestamp": 1708349745000, "spread": 0.0042},
    {"timestamp": 1708350045000, "spread": 0.0041},
    {"timestamp": 1708350345000, "spread": 0.0044},
    {"timestamp": 1708350645000, "spread": 0.0043}
  ],
  "averageSpread": 0.00430,
  "spreadVolatility": 0.00015,  // Low volatility = stable
  "tightestSpread": 0.00410,
  "widestSpread": 0.00450
}
```

### Integration Note
⚠️ **Caching:** 30 minutes (spread analysis is expensive, doesn't need real-time updates)

---

## 6️⃣ Indicators Library Data

**File:** Already found earlier - `indicators.ts` is complete and production-ready

### What It Provides (30+ Indicators)

```typescript
// Basic trend indicators
rsi(closes: number[], period: number = 14): number[]
macd(closes: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9)
  : { line: number[], signal: number[], histogram: number[] }
sma(prices: number[], period: number): number[]
ema(prices: number[], period: number): number[]

// Volatility indicators
bollingerBands(closes: number[], period: number = 20): { upper: number[], middle: number[], lower: number[] }
atr(highs: number[], lows: number[], closes: number[], period: number = 14): number[]
keltnerChannels(highs: number[], lows: number[], closes: number[], period: number = 20)

// Momentum indicators
stochastic(highs: number[], lows: number[], closes: number[], period: number = 14)
williamsPR(highs: number[], lows: number[], closes: number[], period: number = 14): number[]
cci(highs: number[], lows: number[], closes: number[], period: number = 20): number[]

// Volume indicators
obv(closes: number[], volumes: number[]): number[]
mfi(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 14): number[]
cmf(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 20): number[]

// Pattern analysis
fibs(low: number, high: number): { level_0: number, level_23_6: number, ... }
```

### Data Format

```typescript
// Inputs: arrays of OHLCV candle data
const closes = [45000, 45100, 44950, 45200, 45150]; // Last 5 hours
const highs = [45200, 45250, 45100, 45300, 45250];
const lows = [44800, 44900, 44900, 45000, 45100];
const volumes = [12500, 15300, 14200, 18900, 16700];

// Outputs: arrays of indicator values
const rsiValues = indicators.rsi(closes, 14);
// Returns: [40.2, 45.5, 38.9, 55.2, 52.1]

const bbandsValues = indicators.bollingerBands(closes, 20);
// Returns: {
//   upper: [45500, 45600, ...],
//   middle: [45200, 45300, ...],
//   lower: [44800, 44900, ...]
// }
```

### Integration Note
✅ **Ready to use** - Zero dependencies, all calculations self-contained

**Need:** 200 OHLCV candles (1-hour timeframe) for complete technical analysis

---

## COMPARISON TABLE: Data Sources at a Glance

| Service | Latency | Cache TTL | Complexity | Production Ready | Note |
|---------|---------|-----------|-----------|------------------|------|
| Price Oracle | ~200ms | 1-5 min | Low | ✅ Yes | Simple price fetch |
| CCXT (CEX) | ~200ms | Real-time | Medium | ✅ Yes | Parallel calls needed |
| DEX Integration | ~500ms+ | N/A | High | ⚠️ Partial | Execution-focused, need liquidity query method |
| Arbitrage Detection | ~300ms | 60s | Medium | ✅ Yes | Fast, but volatile data |
| Market Analytics | ~400ms | 30min | High | ✅ Yes | Expensive, cache longer |
| Indicators Lib | ~50ms | N/A | Low | ✅ Yes | In-memory calculations only |

---

## ⚠️ Critical Data Points Missing

### 1. **Volatility Data**
- PriceOracle doesn't provide volatility
- Need to either:
  - Request separately
  - Calculate from OHLCV (ATR from indicators)
  - Use standard deviation of returns

### 2. **Historical OHLCV Candles**
- Needed for technical indicators
- CCXT can fetch, but which timeframe? (1h, 4h, 1d?)
- How many candles? (200 recommended for RSI/MACD)
- Database storage? Or fetch on demand?

### 3. **DEX Liquidity Pools**
- DEX Integration Service is swap-execution focused
- Does it have a method to query pool liquidity without executing?
- Need to clarify: `getLiquidityPool()` availability

### 4. **User Portfolio Data**
- Need to find portfolio/wallet service
- Do we have a database of user holdings?
- Real wallets or simulated holdings?

### 5. **AI Signal Generation**
- Need to locate Morio agent service
- What's the signal() or generateSignal() method signature?

---

## 📋 Pre-Integration Checklist

Before we wire everything:

- [ ] Confirm DEX service has pool query method (not just swap execution)
- [ ] Find and examine portfolio service structure
- [ ] Locate Morio agent signal generation method
- [ ] Decide on OHLCV storage strategy (DB vs on-demand fetch)
- [ ] Confirm which indicators are priority (RSI, MACD definitely, others?)
- [ ] Determine volatility calculation method (ATR vs stdev)
- [ ] Test CCXT parallel performance with all 5 exchanges
- [ ] Validate arbitrage detection with real market data
- [ ] Check market analytics spread history storage
- [ ] Measure each service's actual latency with real data

**Status:** Exploration complete, ready to answer specific questions before wiring.

What should we prioritize for the first integration pass?
