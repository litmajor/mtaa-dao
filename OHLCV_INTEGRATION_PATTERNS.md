# OHLCV Service - Integration Quick Reference

**Updated:** Current Session  
**Status:** ACTIVE - Use these patterns for new code

---

## Pattern 1: Basic OHLCV Data Retrieval

### ✅ NEW PATTERN (Use This)
```typescript
import { ohlcvService } from './services/ohlcvService';

// Get 24 hours of 5-minute candles
const response = await ohlcvService.getCandles(
  'BTC/USDT',    // symbol
  '5m',          // timeframe
  288,           // limit (288 * 5m = 24h)
  'binance'      // exchange
);

if (response.status === 'success') {
  const candles = response.data; // OHLCVCandle[]
  console.log(`Got ${candles.length} candles`);
  console.log(`Data source: ${response.dataSource}`); // 'ccxt', 'cache', 'database'
  console.log(`Price range: $${response.data[0].close} - $${response.data[response.data.length - 1].close}`);
}
```

### ❌ OLD PATTERN (Don't Use)
```typescript
// DON'T DO THIS ANYMORE:
import { ccxtService } from './services/ccxtService';

const rawData = await ccxtService.fetchOHLCV('binance', 'BTC/USDT', '5m', 288);
const prices = rawData.map(d => d[4]); // Magic index 4 is 'close'
```

---

## Pattern 2: Volatility Metrics

### ✅ NEW PATTERN (Use This)
```typescript
import { volatilityMetricsService } from './services/volatilityMetricsService';

// Calculate volatility for different periods
const vol24h = await volatilityMetricsService.calculateVolatility(
  'ETH/USDT',
  '24h'  // '1h' | '4h' | '24h' | '7d'
);

console.log(`Volatility: ${vol24h.volatility}%`);
console.log(`Trend: ${vol24h.volatilityTrend}`); // 'increasing' | 'stable' | 'decreasing'
console.log(`Risk Level: ${vol24h.riskLevel}`);  // 'low' | 'medium' | 'high' | 'extreme'

// Volatility is now cached and uses ohlcvService internally
```

### ❌ OLD PATTERN (Refactored Away)
```typescript
// DON'T DO THIS - volatilityMetricsService now handles OHLCV fetching:
const ohlcvData = await ccxtService.fetchOHLCV(...);
// volatilityMetricsService does this internally now
```

---

## Pattern 3: Technical Indicators (NEW)

### ✅ NEW PATTERN (Use This)
```typescript
import { technicalAnalysisService } from './services/technicalAnalysisService';

// Analyze a single symbol
const analysis = await technicalAnalysisService.analyzeSymbol(
  'BTC/USDT',
  '5m',    // timeframe
  'binance'
);

// Access all indicators
console.log(`RSI: ${analysis.rsi.value} (${analysis.rsi.signal})`);
console.log(`MACD: ${analysis.macd.macd} (${analysis.macd.position})`);
console.log(`Bollinger Bands: ${analysis.bollingerBands.lower} - ${analysis.bollingerBands.upper}`);
console.log(`SMA20: ${analysis.movingAverages.sma20}`);
console.log(`SMA50: ${analysis.movingAverages.sma50}`);

// See metadata
console.log(`Data source: ${analysis.ohlcvDataSource}`); // 'cache' or 'ccxt'
console.log(`Candles: ${analysis.candleCount}`);
console.log(`Price range: ${analysis.priceRange.min} - ${analysis.priceRange.max}`);

// Analyze multiple symbols in parallel
const results = await technicalAnalysisService.analyzeSymbols(
  ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
  '5m'
);
results.forEach((analysis, symbol) => {
  console.log(`${symbol}: ${analysis.signals.bullish} bullish signals`);
});

// Quick signal summary
const signal = await technicalAnalysisService.getSignalSummary('BTC/USDT');
console.log(`Signal: ${signal.signal} (${signal.confidence}% confidence)`);
```

### ❌ OLD PATTERN (Don't Use)
```typescript
// DON'T DO THIS - use technicalAnalysisService instead:
import { calculateRSI, calculateSMA } from './services/technicalIndicators';
const prices = [...]; // Manual fetching
const rsi = calculateRSI(prices);
```

---

## Pattern 4: Risk Analysis

### ✅ NEW PATTERN (Use This)
```typescript
import { volatilityMetricsService } from './services/volatilityMetricsService';

// Analyze execution risk for an order
const riskAnalysis = await volatilityMetricsService.analyzeRisk(
  'ETH/USDT',
  10000, // desired order size in USD
  'binance'
);

console.log(`Risk Level: ${riskAnalysis.riskLevel}`);
console.log(`Risk Score: ${riskAnalysis.riskScore}/100`);
console.log(`Max Recommended Order: $${riskAnalysis.maxRecommendedOrderSize}`);
console.log(`Optimal Execution Time: ${riskAnalysis.optimalExecutionTime}`);

// Risk analysis now benefits from ohlcvService caching
```

---

## Pattern 5: Historical Price Data

### ✅ CURRENT PATTERN (Stable)
```typescript
import { priceHistoryService } from './services/priceHistoryService';

// Get historical prices (uses CoinGecko for long-term, will use ohlcvService for recent)
const historical = await priceHistoryService.getHistoricalData(
  'ETH',      // symbol
  'ethereum', // coingecko ID (or symbol for CCXT)
  30,         // days
  'usd'
);

console.log(`${historical.prices.length} price points`);
historical.prices.forEach(point => {
  console.log(`${new Date(point.timestamp).toISOString()}: $${point.close}`);
});
```

### ⏳ NEXT: Hybrid Mode (In Development)
```typescript
// After HIGH-2 consolidation, this will optionally use ohlcvService:
const historical = await priceHistoryService.getHistoricalData(
  'ETH',
  'ethereum',
  7, // Recent data (< 30 days)
  'usd',
  'hybrid'  // Use ohlcvService for recent, CoinGecko for old
);
```

---

## Service Dependencies Map

```
┌─────────────────────────────────────────────────────────────┐
│ OHLCV Service (FOUNDATION)                                  │
│ • getCandles() - Primary OHLCV source                        │
│ • get24hHighLow(), getVolatility(), etc.                    │
│ • Caching + unified error handling                          │
└─────────────────────────────────────────────────────────────┘
         ↓ Dependencies
┌─────────────────────────────────────────────────────────────┐
│ Direct Consumers (Consolidated)                             │
│ ✅ volatilityMetricsService - Uses getCandles()            │
│ ✅ technicalAnalysisService - Uses getCandles()            │
│ ⏳ priceHistoryService - Hybrid (CoinGecko + ohlcvService) │
└─────────────────────────────────────────────────────────────┘
         ↓ For Indicators/Analysis
┌─────────────────────────────────────────────────────────────┐
│ Pure Calculation Functions                                  │
│ • technicalIndicators.ts (RSI, MACD, BB, SMA, EMA)         │
│ • Expects price arrays, no data fetching                    │
│ • Called by technicalAnalysisService                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Caching Behavior

| Service | Method | Cache TTL | When to Bypass |
|---------|--------|-----------|---|
| ohlcvService | getCandles() | 1 min (live), longer for historical | Real-time strategies |
| volatilityMetricsService | calculateVolatility() | 1-4 hours (depends on period) | Fresh volatility needed |
| technicalAnalysisService | analyzeSymbol() | 5 minutes | High-frequency signals |
| priceHistoryService | getHistoricalData() | 24 hours | After major events |

**Note:** All caching is transparent - services automatically return cached data when available.

---

## Error Handling

### OHLCV Errors
```typescript
const response = await ohlcvService.getCandles('INVALID/PAIR', '5m');

if (response.status === 'error') {
  console.error(`Error: ${response.error}`);
  // response.data will be empty []
}
```

### Volatility Errors
```typescript
try {
  const vol = await volatilityMetricsService.calculateVolatility('BTC/USDT');
  if (vol.volatility === 0) {
    console.warn('No data available');
  }
} catch (error) {
  // Service logs error and returns empty metrics
  console.error(error);
}
```

### Indicators Errors
```typescript
const analysis = await technicalAnalysisService.analyzeSymbol('BTC/USDT');

if (analysis.candleCount === 0) {
  // Failed to fetch OHLCV
  console.warn('No candles available - empty analysis returned');
}

// Check data source
if (analysis.ohlcvDataSource === 'error') {
  console.error('Failed to fetch data');
}
```

---

## Migration Checklist

When updating code to use new patterns:

- [ ] Replace `ccxtService.fetchOHLCV()` with `ohlcvService.getCandles()`
- [ ] Update data extraction from `candle[4]` to `candle.close`
- [ ] Check response status: `response.status === 'success'`
- [ ] Verify candle data exists: `response.data.length > 0`
- [ ] For indicators: use `technicalAnalysisService` instead of manual function calls
- [ ] For volatility: no changes needed (already refactored)
- [ ] Test with both cached and fresh data

---

## Key Differences: Format

### CCXT Format (OLD)
```typescript
const candle = [timestamp, open, high, low, close, volume];
const close = candle[4];
```

### OHLCVCandle Format (NEW)
```typescript
const candle: OHLCVCandle = {
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  volume_quote: number,
  trades?: number
};
const close = candle.close;
```

---

## Questions?

Refer to:
- `server/services/ohlcvService.ts` - Foundation service
- `server/services/volatilityMetricsService.ts` - Updated to use ohlcvService
- `server/services/technicalAnalysisService.ts` - New wrapper service
- `OHLCV_SERVICE_CONSOLIDATION_PLAN.md` - Full design document

