# Exchange Rate Data Infrastructure - Reference Guide

## 📊 Quick Status Dashboard

```
CURRENT STATE (TODAY)
═══════════════════════════════════════════════════════════

Frontend Display:
├─ Exchange Rates: ❌ MOCK DATA (hardcoded 130.5 KES/USD)
├─ Crypto Prices: ❌ MOCK DATA (0.65 CELO/USD)
├─ 24h Changes: ❌ FAKE (hardcoded +0.5%)
└─ Refresh Rate: 30 seconds (but no real data)

Backend Services:
├─ exchangeRateService: ✅ REAL (fetches from exchangerate-api.com)
├─ tokenService: ✅ REAL (fetches from CoinGecko, DeFiLlama)
├─ /api/wallet/exchange-rates: ❌ DISCONNECTED (returns hardcoded)
└─ Database: ❌ NO PRICES TABLE

Rate Limiting:
├─ exchangerate-api.com: 1500/month (quota = 116x insufficient!)
├─ CoinGecko: 10-50/sec (marginal)
└─ DeFiLlama: Generous (OK)

Caching:
├─ Strategy: In-memory (volatile, lost on restart)
├─ Redis: ❌ NOT USED
└─ Database: ❌ NO HISTORY STORED
```

---

## 🔴 Critical Issues Summary

| Issue | Impact | Severity | Fix Time |
|-------|--------|----------|----------|
| Mock endpoint not connected to API | Users see fake prices | CRITICAL | 2-3h |
| No price history database | Can't calculate 24h changes | CRITICAL | 6-8h |
| Only 1 API source for forex | Single point of failure | CRITICAL | 4-6h |
| In-memory cache only | Prices lost on restart | CRITICAL | 3-4h |
| Quota inadequate (1500/mo) | System fails day 9 | CRITICAL | 2-3h |
| Fragmented price services | Duplicate API calls | HIGH | 8-10h |
| No monitoring/alerts | Blind to failures | HIGH | 6-8h |
| No real-time updates | Latency issues | HIGH | 12-15h |

**Total Critical Issues**: 8
**Combined Fix Time**: 42-57 hours (5-7 weeks)

---

## 📍 Where Everything Lives

### Exchange Rate Data Flow

```
Frontend (Browser)
    ↓
useQuery('exchange-rates', 30s refresh)
    ↓
GET /api/wallet/exchange-rates
    ↓
server/routes/wallet.ts (line 614)
    ├─ PROBLEM: Returns hardcoded JSON
    ├─ SHOULD: Call exchangeRateService
    └─ SHOULD: Call tokenService
    ↓
server/services/exchangeRateService.ts
    ├─ getUSDtoKESRate() ✅ WORKS
    └─ MISSING: getExchangeRate(from, to)
    ↓
Real APIs
├─ exchangerate-api.com (USD→KES,EUR,GHS,NGN)
├─ CoinGecko (crypto prices)
└─ DeFiLlama (crypto prices)
    ↓
Database (EMPTY - no storage)
    ├─ prices table: ❌ DOESN'T EXIST
    ├─ price_snapshots: ❌ DOESN'T EXIST
    └─ transaction history: ✅ EXISTS (but no prices)
```

### Crypto Price Data Flow

```
Multiple Entry Points (FRAGMENTED):
├─ tokenService.getTokenPriceFromOracle()
│  ├─ Tries: CoinGecko
│  ├─ Then: DeFiLlama
│  └─ Then: Chainlink
│
├─ vaultService.getCoinGeckoPrice()
│  └─ Has own cache (60s)
│
├─ vaultService.getDeFiLlamaPrice()
│  └─ Has own cache (5min)
│
└─ vaultService.getChainlinkPrice()
   └─ On-chain fetch

Problem: Same APIs called from multiple places
Solution: Consolidate to unifiedPriceService
```

---

## 🛠️ What Needs to Be Built

### Part 1: Database Schema

```sql
-- MUST CREATE
CREATE TABLE prices (
  id SERIAL PRIMARY KEY,
  pair VARCHAR(20) NOT NULL,        -- 'CELO-USD', 'USD-KES'
  rate DECIMAL(18,8) NOT NULL,      -- 0.65000000
  change24h DECIMAL(10,8),          -- -0.02500000
  source VARCHAR(50),               -- 'CoinGecko', 'exchangerate-api'
  confidence SMALLINT,              -- 0-100
  timestamp TIMESTAMP DEFAULT NOW(),
  UNIQUE(pair, timestamp)           -- Only one rate per pair per second
);

CREATE TABLE price_snapshots (
  id SERIAL PRIMARY KEY,
  pair VARCHAR(20) NOT NULL,
  rate DECIMAL(18,8) NOT NULL,
  timestamp TIMESTAMP NOT NULL,     -- Hourly snapshots
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_price_pair_time ON prices(pair, timestamp DESC);
CREATE INDEX idx_snapshot_pair_time ON price_snapshots(pair, timestamp DESC);
```

### Part 2: Service Layer

```typescript
// server/services/unifiedPriceService.ts
- getPrice(pair) → PriceData
- getPrices(pairs[]) → Map<pair, PriceData>
- get24hChange(pair) → number
- get7dChange(pair) → number
- recordPrice(pair, rate, source, confidence)

// server/services/exchangeRateService.ts (EXPAND)
- getExchangeRate(from, to) → number
- getExchangeRates(pairs[]) → Map
- fetchFromExchangeRateAPI()
- fetchFromXE()
- fetchFromFixer()

// server/services/priceService.ts (NEW)
- recordPrice()
- getPriceHistory()
- calculate24hChange()
```

### Part 3: Caching Layer

```typescript
// server/cache/priceCache.ts
- Redis connection
- Cache get/set/delete
- TTL management (60s for crypto, varies for forex)
- Cluster support

// Caching Strategy:
├─ CELO-USD: 60s (high volume)
├─ cUSD-USD: 300s (stablecoin, low change)
├─ USD-KES: 300s (low volatility)
└─ Fallback: return old cached value if fetch fails
```

### Part 4: API Endpoints

```typescript
// Existing (FIX):
GET /api/wallet/exchange-rates
  → Should fetch real data, not hardcoded

// New (ADD):
GET /api/prices/exchange-rates?pairs=USD-KES,USD-EUR
  → Returns forex rates

GET /api/prices/crypto?symbols=CELO,cUSD,USDC
  → Returns crypto prices with 24h change

GET /api/health/prices
  → Returns health status of price feeds

GET /api/prices/history/:pair?days=7
  → Returns price history for charts
```

### Part 5: Background Jobs

```typescript
// server/jobs/priceSnapshotJob.ts
- Runs every hour
- Captures current prices to price_snapshots
- Calculates 24h change
- Deletes old data (>30 days)

// server/jobs/priceUpdateJob.ts
- Runs every 30 seconds
- Fetches latest prices from APIs
- Updates database
- Broadcasts via WebSocket
```

### Part 6: Monitoring

```typescript
// server/monitoring/priceHealthCheck.ts
Checks:
- API endpoint availability (all sources)
- Price freshness (all pairs)
- Error rates
- Cache hit rate
- Database query performance
- Rate limit usage

Dashboard shows:
- Status of each API
- Last price update time
- Recent errors
- Quota usage
```

---

## 🚀 Quick Start (Phase 1 Only)

### Step 1: Fix Mock Endpoint (2-3 hours)

Edit `server/routes/wallet.ts` line 614:

```diff
- router.get('/exchange-rates', async (req, res) => {
-   const rates = {
-     'CELO-USD': { rate: 0.65, change24h: 0.5 },
-     // ... more hardcoded
-   };
-   res.json({ rates });
- });

+ router.get('/exchange-rates', async (req, res) => {
+   try {
+     // Fetch real data
+     const celoPrice = await tokenService.getTokenPrice('CELO');
+     const kesRate = await exchangeRateService.getUSDtoKESRate();
+     
+     const rates = {
+       'CELO-USD': {
+         rate: celoPrice,
+         change24h: 0.5  // TODO: Calculate from DB
+       },
+       'cUSD-USD': { rate: 1.0, change24h: 0 },
+       'cUSD-KES': {
+         rate: kesRate,
+         change24h: -0.3  // TODO: Calculate from DB
+       },
+     };
+     
+     res.json({ rates });
+   } catch (error) {
+     res.status(500).json({ error: 'Price fetch failed' });
+   }
+ });
```

**Test**:
```bash
curl http://localhost:3000/api/wallet/exchange-rates
# Should show real prices from API, not hardcoded
```

### Step 2: Expand Exchange Rate Service (3-4 hours)

Edit `server/services/exchangeRateService.ts`:

```typescript
// Add this method
static async getExchangeRate(from: string, to: string): Promise<number> {
  if (from === 'USD') {
    // Direct fetch
    return await this.getUSDRate(to);
  }
  // Else: pair through USD (from→USD, USD→to)
}

private static async getUSDRate(currency: string): Promise<number> {
  try {
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/USD`
    );
    const data = await response.json();
    return data.rates[currency];
  } catch (error) {
    logger.warn(`Failed to get USD-${currency}:`, error);
    return this.getFallbackRate(currency);
  }
}
```

**Test**:
```bash
# Should return real rates from API
const rate = await exchangeRateService.getExchangeRate('USD', 'KES');
```

### Step 3: Verify Frontend Shows Real Data (30 minutes)

After steps 1-2, frontend should display:
- ✅ Real CELO price (not hardcoded 0.65)
- ✅ Real KES rate (not hardcoded 130.5)
- ✅ API calls visible in Network tab
- ⚠️ 24h changes still hardcoded (OK for Phase 1)

---

## 📈 API Rate Limit Analysis

```
Current Usage (100 concurrent users):

exchangerate-api.com:
  └─ At 30s poll interval per user
  └─ 100 users × (86400s ÷ 30s) = 288,000 req/day
  └─ Monthly: 8.6 million req
  └─ Limit: 1,500 req/month
  └─ RATIO: 5,700x OVER LIMIT 🔴

Solution options:

A) Batch requests:
   └─ Cache and serve same rate to all users
   └─ Reduce from 288,000 to ~2,880 req/day (100x improvement)
   └─ Still 2x over limit for 30-day month

B) Reduce poll frequency:
   └─ Change frontend from 30s to 5min
   └─ Reduces to 17,280 req/day (12x improvement)
   └─ Still over limit

C) Add paid tier:
   └─ exchangerate-api.com Pro: $5-15/month
   └─ 100,000+ req/month
   └─ Solution: Cheap upgrade

D) Switch providers:
   └─ OANDA: Real-time API
   └─ XE: Premium accuracy
   └─ Open Exchange Rates: 1000 req/month free

Recommended: C + D (redundancy)
```

---

## 🔐 API Keys Required

```env
# exchangerate-api.com
EXCHANGERATE_API_KEY=your_key_here
EXCHANGERATE_API_URL=https://api.exchangerate-api.com/v4/latest

# CoinGecko (free, no key needed)
# But can add for higher rate limits

# DeFiLlama (free)
DEFI_LLAMA_URL=https://coins.llama.fi

# XE.com (optional fallback)
XE_API_KEY=your_key_here
XE_API_URL=https://xeapi.xe.com

# Redis
REDIS_URL=redis://localhost:6379
REDIS_TTL=60  # seconds

# Optional: Chainlink RPC
CELO_RPC_URL=https://forno.celo.org
ETHEREUM_RPC_URL=https://eth.llamarpc.com
```

---

## 📊 Data Quality Metrics

Track these continuously:

```typescript
Accuracy:
├─ Price variance between sources (<1% acceptable)
├─ Data age (freshness) - should be <5min
└─ Coverage - # of pairs/tokens supported

Availability:
├─ API uptime % (target: 99.5%)
├─ Endpoint response time (target: <500ms)
└─ Fallback activation rate (target: <1%)

Performance:
├─ Cache hit rate (target: >90%)
├─ Database query time (target: <100ms)
├─ API call latency (varies, target: <5s)
└─ WebSocket throughput (target: 100+ messages/sec)

Errors:
├─ 5xx error rate (target: <0.1%)
├─ API quota exhaustion (target: 0)
└─ Stale data rate (target: <2%)
```

---

## ✅ Checklist: When Complete

**Phase 1 Done When**:
- [ ] `GET /api/wallet/exchange-rates` returns real API data
- [ ] Frontend displays real CELO price (verify Network tab)
- [ ] Frontend displays real KES rate (check vs live market)
- [ ] Error handling works (test when APIs unavailable)
- [ ] No console errors
- [ ] Response includes data timestamp
- [ ] Endpoint works for all supported pairs

**Phase 2 Done When**:
- [ ] prices table created in database
- [ ] price_snapshots table created
- [ ] Prices being recorded every fetch
- [ ] 24h change calculated from history
- [ ] Database queries performant (<100ms)
- [ ] Can retrieve 7-day price history

**Phase 3 Done When**:
- [ ] 2+ API sources configured
- [ ] Fallback chain tested
- [ ] Each source works independently
- [ ] Metric tracking active

**Phase 4 Done When**:
- [ ] Single unifiedPriceService used everywhere
- [ ] No duplicate API calls
- [ ] Consolidated caching
- [ ] Confidence scoring active

**Phase 5 Done When**:
- [ ] WebSocket connection works
- [ ] Price updates broadcast to clients
- [ ] Polling fallback functional
- [ ] Load tested with 100+ concurrent

**Phase 6 Done When**:
- [ ] Health check endpoint works
- [ ] Dashboard shows all metrics
- [ ] Alerts configured
- [ ] Operations team trained

---

## 📞 Support Information

**Questions?**
- Check `EXCHANGE_RATE_DATA_AUDIT.md` for detailed analysis
- Check `DATA_INFRASTRUCTURE_MAP.md` for current state
- Check `EXCHANGE_RATE_ACTION_PLAN.md` for next steps

**Emergency**:
- If prices not updating: Check exchangeRateService logs
- If database errors: Check schema migrations
- If APIs failing: Check API keys in .env
- If Redis errors: Check Redis connection string

---

**Last Updated**: Today
**Status**: Ready for Phase 1 implementation
**Estimated Completion**: 5-7 weeks (all phases)
**Priority**: CRITICAL (Production blocker)
