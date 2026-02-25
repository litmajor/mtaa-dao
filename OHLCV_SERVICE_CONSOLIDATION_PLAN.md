# OHLCV Service Consolidation Plan
**Target:** Make ohlcvService the central, unified data foundation for all historical price data consumption  
**Status:** Phase 5 - ACTIVE  
**Priority:** CRITICAL - Prevents data fragmentation and improves performance

---

## Executive Summary

The platform has fragmented OHLCV data fetching across multiple services, each with its own implementation, caching, and error handling. This plan consolidates all OHLCV consumption into a single authoritative source (`ohlcvService.ts`), reducing technical debt and improving data consistency.

**Key Principle:** OHLCV Service = Central Foundation  
- All historical price data flows through ohlcvService
- Symbol Universe enrichment via OHLCV discovery
- AssetStateEngine builds Tier 1 market state from OHLCV
- All indicators, analytics, and simulators delegate to unified service

---

## Current Fragmentation Map

### ✅ Already Centralized (Ready)
| Service | Status | Notes |
|---------|--------|-------|
| ohlcvService.ts | ✅ EXISTS | Core implementation with CCXT integration, caching, volatility |
| portfolioService.ts | ✅ EXISTS | New service, ready for OHLCV delegation |

### 🔴 Direct CCXT Consumers (Need Consolidation)
| Service | File | Issue | Priority |
|---------|------|-------|----------|
| volatilityMetricsService | volatilityMetricsService.ts:103 | Directly calls `ccxtService.fetchOHLCV()` | **CRITICAL** |
| technicalIndicators | technicalIndicators.ts | Expects price arrays (functions), not integrated yet | **HIGH** |
| priceHistoryService | priceHistoryService.ts | Uses CoinGecko API instead of ohlcvService | **HIGH** |

### 🟡 Related Services (Use Order Books/Spreads)
| Service | File | Integration | Priority |
|---------|------|---|----------|
| marketAnalyticsService | marketAnalyticsService.ts | Uses `ccxtService.fetchOrderBook()` - complementary | **MEDIUM** |
| orderBookAnalyzer | orderBookAnalyzer.ts | Fetches order books - separate concern but related | **MEDIUM** |
| arbitrageDetector | arbitrageDetector.ts | Uses asset exchange presence data | **MEDIUM** |

### 🟢 Static/Indirect Consumers
| Service | File | Integration | Priority |
|---------|------|---|----------|
| assetIntelligence | assetIntelligence.ts | Static database, no OHLCV fetching | DEFERRED |
| trading simulators | tradingDexSimulator.ts | Accept params, don't fetch OHLCV | DEFERRED |

---

## Consolidation Tasks

### [CRITICAL-1] Refactor volatilityMetricsService → Use ohlcvService

**Current Implementation:**
```typescript
// Lines 75-110 in volatilityMetricsService.ts
const ohlcvData = await ccxtService.fetchOHLCV(exchange, symbol, timeframe, limit);
```

**Problem:**
- Duplicate OHLCV fetching logic
- No benefit from ohlcvService caching or error handling
- Redundant implementation

**Solution:**
```typescript
// Import ohlcvService
import { ohlcvService } from './ohlcvService';

// Replace direct ccxtService call with:
const response = await ohlcvService.getCandles(symbol, timeframeMap[period], limit, exchange);
const ohlcvData = response.data; // Extract candles from OHLCVResponse
```

**Expected Outcome:**
- Reduced code duplication
- Automatic caching benefits
- Unified error handling
- Consistent data format

**Time Estimate:** 30 minutes

---

### [HIGH-1] Connect technicalIndicators ↔ ohlcvService

**Current Implementation:**
```typescript
// technicalIndicators.ts exports pure functions:
export function calculateSMA(prices: number[], period: number): number { }
export function calculateEMA(prices: number[], period: number): number { }
export function calculateRSI(prices: number[], period: number): number { }
// etc.
```

**Problem:**
- Functions require manual price extraction
- No automatic OHLCV fetching
- Consumers must handle data pipeline

**Solution - Create Wrapper Service:**
```typescript
// NEW: server/services/technicalAnalysisService.ts
export class TechnicalAnalysisService {
  async analyzeSymbol(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<TechnicalIndicatorsResult> {
    // Fetch OHLCV from unified source
    const ohlcvResponse = await ohlcvService.getCandles(
      symbol, 
      '5m',  // 5-minute candles
      288    // 288 * 5min = 24 hours
    );
    
    const closingPrices = ohlcvResponse.data.map(c => c.close);
    
    // Apply indicator functions to extracted prices
    return {
      symbol,
      exchange,
      timeframe: '5m',
      timestamp: Date.now(),
      rsi: { value: calculateRSI(closingPrices), signal: classifyRSI(...) },
      macd: { macd: calculateMACD(...), ... },
      // ... rest of indicators
      signals: { bullish: 0, bearish: 0, neutral: 0 }
    };
  }
}
```

**Expected Outcome:**
- Automatic OHLCV fetching
- Consistent data via ohlcvService
- Single point of caching
- Cleaner consumer code

**Time Estimate:** 1 hour

---

### [HIGH-2] Integrate priceHistoryService ↔ ohlcvService

**Current Implementation:**
```typescript
// priceHistoryService.ts
// Uses CoinGecko API (/coins/{id}/market_chart)
// CoinGecko returns: prices, market_caps, volumes (daily)
```

**Problem:**
- Different data source (CoinGecko vs CCXT)
- No coordination between services
- Potential data inconsistency

**Architecture Decision:**
- **Keep CoinGecko** for long-term historical data (>30 days)
- **Use ohlcvService** for recent/live data (<30 days)
- **Coordinate** via ohlcvService.getCandles() for current period

**Solution:**
```typescript
// In priceHistoryService.ts - add hybrid fetch
async function getHistoricalPrices(
  symbol: string,
  days: number,
  source: 'coingecko' | 'ccxt' | 'hybrid' = 'hybrid'
): Promise<HistoricalPriceData> {
  if (source === 'ccxt' || (source === 'hybrid' && days <= 30)) {
    // Use ohlcvService for recent data
    const ohlcvResponse = await ohlcvService.getCandles(
      symbol,
      '1d',     // Daily candles
      Math.min(days, 30)
    );
    return this.transformOHLCVToHistoricalData(ohlcvResponse.data);
  } else {
    // Use CoinGecko for historical data
    return this.fetchFromCoinGecko(symbol, days, currency);
  }
}
```

**Expected Outcome:**
- Unified historical data access
- CoinGecko for long-term, ohlcvService for short-term
- Clear separation of concerns
- No redundant fetching

**Time Estimate:** 1 hour

---

### [MEDIUM-1] Enhance Symbol Universe with ohlcvService

**Current State:**
```typescript
// symbol_universe.ts - Static asset database
// No connection to live OHLCV data
```

**Goal:**
- Discover new trading pairs from OHLCV data
- Enrich existing assets with live metadata
- Asset-discovery notifications

**New Methods for ohlcvService:**
```typescript
// In ohlcvService.ts - ADD:

async discoverNewAssets(exchange: string = 'binance'): Promise<string[]> {
  // Get all available symbols from exchange
  // Cross-reference with symbol_universe
  // Return newly discovered symbols
}

async enrichSymbolUniverse(symbol: string): Promise<EnrichedSymbolMetadata> {
  // Get current OHLCV data
  // Extract market cap estimate, liquidity, volatility
  // Return enrichment metadata
}

async onAssetDiscovered(callback: (asset: string) => void) {
  // Subscribe to new asset discovery events
}
```

**Integration with Symbol Universe:**
```typescript
// symbol_universe.ts - ADD:

async enrichFromOHLCVData(): Promise<void> {
  // Called on startup + periodic refresh
  for (const symbol of this.symbols) {
    const enrichment = await ohlcvService.enrichSymbolUniverse(symbol);
    this.updateAssetMetadata(symbol, enrichment);
  }
}

async discoverNewAssets(): Promise<void> {
  // Called periodically (e.g., hourly)
  const discovered = await ohlcvService.discoverNewAssets();
  for (const symbol of discovered) {
    await this.addNewAsset(symbol);
  }
}
```

**Expected Outcome:**
- Symbol Universe dynamically enriched with live data
- New trading pairs automatically discovered
- Metadata always fresh
- Improved asset discovery

**Time Estimate:** 2 hours

---

### [MEDIUM-2] Wire AssetStateEngine ↔ ohlcvService

**Current State:**
```typescript
// assetStateEngine.refactored.ts
async fetchRawLayers(symbol: string) {
  // No explicit OHLCV source documented
}
```

**Integration:**
```typescript
// assetStateEngine.refactored.ts - UPDATE fetchRawLayers():

async fetchRawLayers(symbol: string): Promise<RawTier> {
  // PRIMARY: Get OHLCV as Tier 1 foundation
  const ohlcvResponse = await ohlcvService.getCandles(
    symbol,
    '5m',
    288  // 24 hours of 5-min candles
  );

  // SECONDARY: Enrich with Symbol Universe metadata
  const assetMetadata = this.symbolUniverse.getAsset(symbol);
  const enriched = await ohlcvService.enrichSymbolUniverse(symbol);

  return {
    symbol,
    timestamp: Date.now(),
    prices: ohlcvResponse.data,
    volatility: ohlcvResponse.volatility,
    metadata: { ...assetMetadata, ...enriched },
    liquidity: ohlcvResponse.liquidity,
    dataSource: 'ohlcvService', // Explicit source
    quality: ohlcvResponse.quality,
  };
}
```

**Expected Outcome:**
- Clear precedence: OHLCV + metadata
- Consistent Tier 1 data source
- Better debugging (explicit data source)
- Foundation for Tier 2/3 computations

**Time Estimate:** 30 minutes

---

### [DEFERRED] Market Analytics Service Enhancements

**Current:** Uses `ccxtService.fetchOrderBook()`  
**Future:** Could integrate ohlcvService for historical context on spreads  
**Status:** Not blocking, depends on spread history tracking

---

## Implementation Sequence

### Phase 1: Critical Consolidation (This Session)
1. ✅ [CRITICAL-1] Refactor volatilityMetricsService → ohlcvService
2. ⏳ [HIGH-1] Create technicalAnalysisService wrapper
3. ⏳ [HIGH-2] Hybrid priceHistoryService with ohlcvService delegation

### Phase 2: Foundation Wiring (Next Session)
4. ⏳ [MEDIUM-1] Enhance Symbol Universe with ohlcvService enrichment
5. ⏳ [MEDIUM-2] Wire AssetStateEngine to ohlcvService as Tier 1

### Phase 3: Validation & Optimization
6. ⏳ Create unit tests for all integrations
7. ⏳ Performance analysis (cache hit rates, latencies)
8. ⏳ Documentation of unified OHLCV pattern

---

## Success Criteria

### Data Consistency
- [ ] All OHLCV data flows through unified service
- [ ] No duplicate fetching from CCXT
- [ ] Single cache invalidation point

### Performance
- [ ] 90%+ cache hit rate for repeated queries
- [ ] <500ms p99 latency for cached responses
- [ ] <2s p99 latency for fresh fetches

### Code Quality
- [ ] Zero direct ccxtService.fetchOHLCV() calls (except in ohlcvService)
- [ ] All services import from ohlcvService for historical data
- [ ] Complete test coverage for consolidation points

### Architectural
- [ ] OHLCV as documented foundation in ARCHITECTURE.md
- [ ] Clear dependency graph (OHLCV → Indicators, Analytics, etc.)
- [ ] Asset discovery integrated with Symbol Universe

---

## Risk Assessment

### Risk: Refactoring volatilityMetricsService
**Impact:** Medium (used by risk scoring systems)  
**Mitigation:** Keep interface unchanged, only internal refactoring  
**Testing:** Unit tests verify calculation results remain identical

### Risk: Changing technicalIndicators interface
**Impact:** Medium (used by NURU/KWETU)  
**Mitigation:** Create wrapper service, old functions remain  
**Testing:** Output comparison between old and new implementations

### Risk: Hybrid priceHistoryService behavior
**Impact:** Low (mostly analytical use)  
**Mitigation:** Clear documentation of data source selection  
**Testing:** Validate CoinGecko + CCXT data alignment

---

## File Changes Summary

| File | Change | Complexity |
|------|--------|-----------|
| volatilityMetricsService.ts | Import ohlcvService, replace CCXT calls | LOW |
| technicalAnalysisService.ts | NEW file, wrapper around indicators + OHLCV | MEDIUM |
| priceHistoryService.ts | Add hybrid fetch logic | MEDIUM |
| symbol_universe.ts | Add enrichment + discovery methods | MEDIUM |
| assetStateEngine.refactored.ts | Explicit ohlcvService dependency in fetchRawLayers | LOW |
| ohlcvService.ts | Extend with enrichment + discovery methods | MEDIUM |

**Total Implementation Time:** 5-6 hours  
**Total Testing Time:** 2-3 hours

---

## Rollback Plan

If consolidation causes issues:
1. Revert ohlcvService imports in affected services
2. Restore direct ccxtService calls as temporary fallback
3. Re-enable Python routes as backup (already archived but recoverable)
4. Run comprehensive cache validation

Each service maintains backward compatibility during transition.

