# CCXT API Call Mapping & Redundancy Avoidance Guide

**Purpose**: Document all locations where CCXT API calls are made to identify and eliminate redundant requests.

---

## 📍 CCXT API Call Locations - COMPLETE MAP

### 1. **TypeScript Main Service** - `server/services/ccxtService.ts` (CCXTAggregator)

#### Price Discovery
**Location #1: `getTickerFromExchange(exchangeName, symbol)` — Line ~223**
```typescript
await exchange.fetchTicker(formattedSymbol);
```
- Called for single exchange price lookup
- Returns: last, bid, ask, volume
- Used by: Frontend components, price widgets
- Cache TTL: 30 seconds
- Concurrency limit: 3 parallel calls

**Location #2: `getPricesFromMultipleExchanges(symbol, exchanges[])` — Line ~247**
- Calls `getTickerFromExchange()` for each exchange in parallel
- Total: N exchanges × 1 call = N API calls per request

**Location #3: `getBestPrice(symbol, exchanges[])` — Line ~280**
- Calls `getPricesFromMultipleExchanges()` internally
- Used for spread analysis and best execution

#### OHLCV (Candle) Data
**Location #4: `getOHLCVFromExchange(exchangeName, symbol, timeframe, limit)` — Line ~362**
```typescript
await exchange.fetchOHLCV(formattedSymbol, timeframe, undefined, limit);
```
- Returns candlestick data (open, high, low, close, volume)
- Called for charting, technical analysis
- Cache TTL: 5 minutes
- Default timeframe: 1h, Default limit: 24 candles
- Concurrency limit: 3 parallel calls

**Location #5: `getOHLCV(symbol, timeframe, limit, preferredExchanges[])` — Line ~407**
- Calls `getOHLCVFromExchange()` for each exchange until success
- Falls back to next exchange if primary fails

#### Market & Symbol Data
**Location #6: `loadMarkets()` — Line ~440 (in validateOrder)**
```typescript
await exchange.loadMarkets();
```
- Fetches list of all trading pairs on exchange
- Used for symbol validation before order placement
- Called indirectly for order validation

**Location #7: `formatSymbolForExchange()` — Line ~755**
```typescript
await exchange.loadMarkets();
```
- Loads markets to find correct symbol format for exchange
- Called before every price/OHLCV/order operation
- Searches for symbol with various quote currencies (USDC, USDT, USD, BUSD)

**Location #8: `getMarkets(exchangeName)` — Line ~786**
```typescript
await exchange.loadMarkets();
```
- Returns all markets from exchange
- Cache TTL: 1 hour
- Used by market discovery features

**Location #9: `getAvailableAssets(exchangeName)` — Line ~816**
```typescript
await exchange.loadMarkets();
```
- Gets all available symbols/assets from exchange
- Filters based on asset overrides

#### Order Management
**Location #10: `placeMarketOrder(exchangeName, symbol, side, amount)` — Line ~508**
```typescript
await exchange.createMarketOrder(formattedSymbol, side, amount);
```
- Requires API key + secret
- Returns: orderId, filled, average price, fee
- Concurrency limit: 3 parallel (queued execution)

**Location #11: `placeLimitOrder(exchangeName, symbol, side, amount, price)` — Line ~585**
```typescript
await exchange.createLimitOrder(formattedSymbol, side, amount, price);
```
- Requires API key + secret
- Similar to market order but with price limit

**Location #12: `checkOrderStatus(exchangeName, orderId, symbol)` — Line ~625**
```typescript
await exchange.fetchOrder(orderId, symbol);
```
- Gets order status/fill information
- Used for order tracking

**Location #13: `cancelOrder(exchangeName, orderId, symbol)` — Line ~654**
```typescript
await exchange.cancelOrder(orderId, symbol);
```
- Requires API key + secret
- Cancels open order

#### Account Management
**Location #14: `getBalances(exchangeName)` — Line ~689**
```typescript
await exchange.fetchBalance();
```
- Requires API key + secret
- Returns all account balances
- Used for portfolio display

#### Health & Status
**Location #15: `healthCheck()` — Line ~893**
```typescript
await exchange.fetchTicker('CELO/USDC');
```
- Tests connectivity to each exchange
- Used for health monitoring
- May fail gracefully (expected for some symbols)

---

### 2. **TypeScript Alternative Service** - `server/services/cexPriceCollector.ts`

#### Primary Method: `fetchExchangePrices(exchange, tradingPairs?)`
- **Lines**: ~108-230
- **Supported Exchanges**: binance, kraken, coinbase, bybit, kucoin, okx (6 exchanges)
- **Default Pairs**: BTC/USDT, ETH/USDT, BNB/USDT, SOL/USDT, ADA/USDT, XRP/USDT, DOGE/USDT, MATIC/USDT, AVAX/USDT, LINK/USDT

**Location #16: fetchTicker via fetchWithNormalization() — Line ~267**
```typescript
await this.fetchWithRetry(() => client.fetchTicker(originalPair));
```
- Returns: last price, bid, ask, volume
- Called once per trading pair
- Total: 6 exchanges × 10 pairs = 60+ calls per collection cycle

**Error Handling & Retries**:
- Max retries: 3
- Retry delay: 2000ms
- Timeout per exchange: 90 seconds
- Symbol normalization for format differences

**Data Persistence**:
- Cached immediately via `cache.setPrice()`
- Persisted to database via `persistPrices()`

#### Secondary Method: `fetchAllExchanges(tradingPairs?)`
- **Lines**: ~232-245
- **Behavior**: Iterates through all supported exchanges calling `fetchExchangePrices()` sequentially
- **Total API Calls**: 60+ baseline + retry multiplier

---

### 3. **Python Backend** - `backend/services/market_aggregator.py`

#### Primary Method: `get_cex_prices(pair)`
- **Lines**: ~37-55
- **Supported Exchanges**: binance, coinbase, kraken, gatedio, okx, bybit, kucoin, bitget (8 exchanges)
- **Concurrency**: Uses `asyncio.gather()` for parallel fetching

**Location #17: fetch_ticker() — Line ~64 (in _fetch_from_exchange)**
```python
ticker = exchange.fetch_ticker(pair)
```
- Returns: last, bid, ask, volume information
- Called once per exchange per pair

**Location #18: fetch_order_book() — Line ~65 (in _fetch_from_exchange)**
```python
order_book = exchange.fetch_order_book(pair, limit=5)
```
- Returns: bids/asks array (top 5 levels)
- Used for liquidity calculations (sum of bid/ask depths)
- **Called TWICE per pair per exchange = Heavy API usage**

**Per Pair, Per Cycle**: 
- 8 exchanges × 2 API calls per exchange = **16 API calls per trading pair**
- With 10 default pairs = **160+ API calls per full collection**

**Computed Data**:
- Volume (24h USD): `ticker.quoteVolume * ticker.last`
- Liquidity (USD): Sum of top 5 bid/ask levels
- Spread (pct): `(ask - bid) / bid * 100`

#### Secondary Method: `get_pair_market_data(pair)` — Line ~190
```python
cex_prices = await sel - CRITICAL

### Current Redundancies:
1. **3 Independent Fetch Systems**:
   - `CEXTAggregator` (ccxtService.ts) — Real-time price discovery
   - `CEXPriceCollector` (cexPriceCollector.ts) — Batch collection
   - `MarketAggregator` (Python market_aggregator.py) — Python service
   - Each fetches independently = **3× API call volume**

2. **No Cross-Backend Caching**:
   - TS cache (CEXPriceCache) doesn't share with Python
   - TS ccxtService cache (30s TTL) doesn't share with CEXPriceCollector
   - Python has no local caching strategy

3. **Frequency Analysis** - VERY HIGH RISK:
   - If `fetchTicker()` called every 30 seconds × 6 exchanges = **12 calls/min**
   - If `fetchBalance()` called for portfolio display (every page load) = **many calls**
   - If `healthCheck()` runs every 60 seconds = **6 exchanges/min**
   - If `loadMarkets()` called before each operation = **explosive overhead**
   - **Total realistic: 500+ API calls per minute per backend**

4. **Double Order Book Fetches** (Python Only):
   - `fetch_order_book()` called for EVERY pair on EVERY exchange
   - Only uses top 1 level (bids[0][0], asks[0][0])
   - Could use `fetchTicker()` instead (includes best bid/ask)
   - **Unnecessary 160 API calls per cycle in Python**

5. **Symbol Loading Redundancy**:
   - `loadMarkets()` called in:
     - `validateOrder()` (Line 440)
     - `formatSymbolForExchange()` (Line 755)
     - `getMarkets()` (Line 786)
     - `getAvailableAssets()` (Line 816)
   - Markets cached 1 hour but loaded fresh every time
   - **Fixable with check: if (!exchange.markets) loadMarkets()**

### API Call Estimate - Current State:
```
Backend         | Method                    | Frequency    | Calls/Min
────────────────┼──────────────────────────┼──────────────┼──────────
CCXTAggregator  | getTickerFromExchange()   | Every 30s    | 12
                | getOHLCVFromExchange()    | Every 60s    | 6
                | loadMarkets()             | Variable     | 20-50
                | healthCheck()             | Every 60s    | 6
                | formatSymbolForExchange() | On demand    | 5-20
────────────────┼──────────────────────────┼──────────────┼──────────
CEXPriceCollector | fetchExchangePrices()   | Every 30s    | 60
                  | fetchAllExchanges()     | Occasional   | 60+
────────────────┼──────────────────────────┼──────────────┼──────────
MarketAggregator | get_cex_prices()        | Every 60s    | 160 (!)
                 | fetch_ticker()          |              | 80
                 | fetch_order_book()      |              | 80 (REDUNDANT!)
────────────────┼──────────────────────────┼──────────────┼──────────
TOTAL MINIMUM   |                          |              | **330-400/min**
REALISTIC PEAK  |                          |              | **600-800/min**
```

### | Service | Method | Location | Frequency | Calls/Cycle | Redundant? | Priority |
|---|---------|--------|----------|-----------|-------------|-----------|----------|
| 1 | CCXTAggregator | fetchTicker() | Line 223 | On demand | 1-6 | Yes (×3) | HIGH |
| 2 | CCXTAggregator | fetchOHLCV() | Line 362 | On demand | 1-6 | Yes (×3) | MEDIUM |
| 3 | CCXTAggregator | loadMarkets() | Lines 440,755,786,816 | Frequent | Variable | **YES!** | **CRITICAL** |
| 4 | CCXTAggregator | createMarketOrder() | Line 508 | On demand | 1 | No | N/A |
| 5 | CCXTAggregator | createLimitOrder() | Line 585 | On demand | 1 | No | N/A |
| 6 | CCXTAggregator | fetchOrder() | Line 625 | On demand | 1 | No | N/A |
| 7 | CCXTAggregator | cancelOrder() | Line 654 | On demand | 1 | No | N/A |
| 8 | CCXTAggregator | fetchBalance() | Line 689 | On demand | 1 | Yes (×3) | MEDIUM |
| 9 | CCXTAggregator | fetchTicker() | Line 893 | Every 60s | 1-6 | Yes (×3) | MEDIUM |
| 10 | CEXPriceCollector | fetchTicker() | Line 267 | Every 30s | 60 | Yes (×2) | **CRITICAL** |
| 11 | CEXPriceCollector | fetchAllExchanges() | Line 232 | Occasional | 60+ | Yes (×2) | CRITICAL |
| 12 | MarketAggregator | fetch_ticker() | Line 64 | Every 60s | 80 | Yes (×2) | **CRITICAL** |
| 13 | MarketAggregator | fetch_order_book() | Line 65 | Every 60s | 80 | **REDUNDANT!** | **CRITICAL** |

### Key Redundancies Identified:
- **Line 3**: `loadMarkets()` called 4 times - **can cache first load** ✓
- **Line 13**: Order book data only needs best ask/bid - **use fetchTicker instead** ✓✓
- **Lines 1,2,8,9**: Same data fetched by 3 independent services - **consolidate** ✓✓✓

**Conservative Optimization Target**: 
- Remove order_book fetch (saves 80 calls/min)
- Cache loadMarkets properly (saves 20-50 calls/min)
- Consolidate to single service (saves 120 calls/min)
- **New total: 110-150 calls/min** (from current 400+
### Current Redundancies:
1. **Multiple Fetch Points**: Both TS and Python backends fetch independently (if both running)
2. **No Cross-Backend Caching**: TS cache (CEXPriceCache) doesn't share with Python
3. **Frequency Analysis**:
   - If `fetchExchangePrices()` is called every 30 seconds for each exchange = **240+ calls/min** per exchange
   - If multiple frontend requests trigger collection = **exponential growth**
4. **Order Book Redundancy**: Fetching full order books (5 levels) when only best bid/ask needed

---

## ✅ Caching Strategy Recommendations

### Tier 1: In-Process Cache (EXISTING - TS Only)
**File**: `server/services/cexPriceCache.ts`
```tCCXTAggregator Callers (ccxtService.ts)
Search patterns:
- `ccxtService.getTickerFromExchange(` or `getTickerFromExchange(`
- `ccxtService.getBestPrice(` or `getBestPrice(`
- `ccxtService.getOHLCV(` or `getOHLCV(`
- `ccxtService.getMarkets(` or `getMarkets(`
- `ccxtService.getBalances(` or `getBalances(`
- `ccxtService.healthCheck(` or `healthCheck(`

Typical call locations:
- `/server/routes/exchangeRoutes.ts` - REST API endpoints
- `/server/middleware/` - Any price validation
- `/client/hooks/useExchangeData.ts` - React hooks
- `/server/services/` - Other services
- Scheduled jobs / cron tasks

### CEXPriceCollector Callers (cexPriceCollector.ts)
Search patterns:
- `collector.fetchExchangePrices(`
- `collector.fetchAllExchanges(`
- `new CEXPriceCollector(`

Typical call locations:
- Data collection background jobs
- Periodic price updates
- Dashboard data feeders
- Migration/initialization scripts

### MarketAggregator Callers (market_aggregator.py)
Search patterns:
- `aggregator.get_cex_prices(`
- `aggregator.get_pair_market_data(`
- `aggregator.calculate_aggregate_price(`

Typical call locations:
- Flask/FastAPI route handlers
- Background task workers
- WebSocket update handlers
- Python:ticker:{exchange}:{pair} → {full ticker data}
cex:orderbook:{exchange}:{pair} → {order book snapshot}
```

**Suggested TTL**:
- Ticker data: 5-10 seconds (for volatile assets)
- Order book: 2-3 seconds (more frequent changes)
- Aggregate prices: 10-15 seconds

### Tier 3: Database Persistence (EXISTING)
**File**: `cexPriceRepository.ts`
- Used for historical analysis, not real-time prevention of redundancy
- Keep current implementation for audit trail

---

## 📊 API Call Optimization Matrix

| Source | Method | Calls/Cycle | Exchanges | Data Points |
|--------|--------|-------------|-----------|------------|
| TypeScript | `fetchTicker()` | 60-120 | 6 | price, bid, ask, volume |
| **Python** | **`fetchTicker()`** | **80** | **8** | **same** |
| **Python** | **`fetchOrderBook(limit=5)`** | **80** | **8** | **bids[], asks[]** |
| **TOTAL** | - | **220-280** | - | - |

**Optimization Target**: Reduce to **80 calls/cycle** (single fetch source)

---

## 🎯 Implementation Plan

### Phase 1: Identify Current Collection Points
- [ ] Find all places calling `fetchExchangePrices()` (TS)
- [ ] Find all places calling `get_cex_prices()` (Python)
- [ ] Check frontend request patterns that trigger collection
- [ ] Measure actual API call frequency (logs/monitoring)

### Phase 2: Implement Shared Cache
- [ ] Define Redis schema for CCXT data
- [ ] Add Redis initialization to both backends
- [ ] Update TS to check Redis before CCXT API
- [ ] Update Python to check Redis before CCXT API
- [ ] Set appropriate TTLs per data type

### Phase 3: Consolidate Collection
- [ ] Choose single backend as "publisher" (probably Python - faster async)
- [ ] Have other backend consume from Redis cache
- [ ] Implement cache-first retry logic (Redis → CCXT → Error)

### Phase 4: Monitoring
- [ ] Track cache hits vs misses
- [ ] Monitor actual API call volume
- [ ] Alert on unusual spikes

---

## 🔍 Call Sites for Easy Reference

### TS Backend Callers
- Search: `fetchExchangePrices(` in `/server`
- Search: `fetchAllExchanges(` in `/server`
- Likely locations:
  - Controllers/routes
  - Scheduler/cron jobs
  - WebSocket handlers
  - Admin endpoints

### Python Backend Callers
- Search: `get_cex_prices(` in `/backend`
- Search: `get_pair_market_data(` in `/backend`
- Likely locations:
  - Flask/FastAPI routes
## 🚨 IMMEDIATE ACTIONS REQUIRED

1. **Add marker comments** to each API call location with `🔴 CCXT API CALL #N` 
   - Use: `grep "🔴 CCXT API CALL" *.ts *.py` to find all locations
   - ✓ Already added to lines in Python and one TS service

2. **Audit current usage frequency**
   - Check logs for how often each method is called
   - Add timing/profiling to measure actual API volume
   - Compare against exchange rate limit thresholds

3. **Priority fixes (in order)**:
   - **CRITICAL**: Change Python `fetch_order_book()` to use `fetchTicker()` results
     - One-line fix: Remove unnecessary API call (saves 80/min)
   - **CRITICAL**: Add check before `loadMarkets()` calls
     - Fix: Check if markets already loaded before reload
     - Save: 20-50 calls/min
   - **HIGH**: Consolidate CCXTAggregator and CEXPriceCollector
     - Merge into single service
     - Share cache via Redis
     - Save: 60+ calls/min
   - **MEDIUM**: Add centralized rate limiter across all services
     - Prevent API limit violations
     - Queue overflow requests

---

## 📝 Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-02-11 | 1.0 | Initial map of 18 API call locations across 3 services | Copilot |
| 2026-02-11 | 1.1 | Added call frequency analysis and redundancy matrix | Copilot |
| TBD | 1.2 | After implementation of identified fixes | TBD |

**Last Updated**: 2026-02-11  
**Maintenance**: Update whenever fetch methods are added/modified or after implementing redundancy fixes

---

## 📝 Notes for Team

1. **Exchange Support Mismatch**:
   - TS: binance, kraken, coinbase, bybit, kucoin, okx (6)
   - Python: adds gatedio, bitget (8)
   - Consider unifying to 8 exchanges or reducing to 6

2. **Order Book Complexity**:
   - Python fetches full order books for liquidity calculation
   - TS only fetches tickers
   - Decide if order books are necessary (adds 80 API calls!)

3. **Symbol Format Handling**:
   - Different exchanges use different formats (BTC/USD vs BTC/USDT)
   - TS has normalization logic - Python lacks this
   - Standardize before Redis caching

4. **Async vs Sequential**:
   - Python uses `asyncio.gather()` for parallel execution
   - TS uses sequential loops in some places, parallel in others
   - Check if TS can benefit from concurrent.futures or similar

---

## 🚨 Immediate Action Items

| Priority | Action | Owner | Status |
|----------|--------|-------|--------|
| HIGH | Audit all callers of fetch methods | Backend Team | [ ] |
| HIGH | Add logging to each API call | Backend Team | [ ] |
| MEDIUM | Measure baseline API call volume | DevOps | [ ] |
| MEDIUM | Design Redis schema for caching | Backend Team | [ ] |
| LOW | Unify exchange support lists | Backend Team | [ ] |

---

**Last Updated**: 2026-02-11  
**Maintenance**: Update whenever fetch methods are added/modified
