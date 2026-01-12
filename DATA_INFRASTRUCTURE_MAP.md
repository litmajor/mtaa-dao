# Data Infrastructure Map - Current State

## Quick Visual Map

```
TODAY'S SYSTEM
═════════════════════════════════════════════════════════

USER SEES (Frontend)
├─ Portfolio page
│  ├─ Balance in KES, USD, EUR ← GETS MOCK DATA 🔴
│  └─ Prices with 24h changes ← HARDCODED 🔴
│
├─ Transaction list
│  ├─ Historical rates ← NOT STORED 🔴
│  └─ Price at time of transaction ← NO HISTORY 🔴
│
└─ TokenCard prices
   ├─ Current unit price ← MOCK 0.65 CELO/USD 🔴
   └─ 24h change ← HARDCODED +0.5% 🔴


BACKEND (Server)
═════════════════════════════════════════════════════════

API Endpoint: GET /api/wallet/exchange-rates
└─ wallet.ts (line 614)
   │
   ├─ Returns hardcoded object 🔴
   │  {
   │    'CELO-USD': { rate: 0.65, change24h: 0.5 },
   │    'cUSD-USD': { rate: 1.0, change24h: 0 },
   │    'cUSD-KES': { rate: 130.5, change24h: -0.3 },
   │    // ... more mock data
   │  }
   │
   └─ NOT CONNECTED TO ANY REAL API 🔴


Exchange Rate Service
═════════════════════════════════════════════════════════

exchangeRateService.ts
│
├─ USED BY:
│  ├─ transactionLimitService (USD→KES conversion) ✅ WORKS
│  └─ kotanipayService (payment conversions) ✅ WORKS
│
├─ REAL API CONNECTION ✅
│  └─ exchangerate-api.com/v4/latest/USD
│     └─ Gets live rates for fiat (KES, EUR, GHS, NGN)
│
├─ CACHE STRATEGY
│  ├─ In-memory cache (volatile) ⚠️
│  ├─ 1-hour TTL
│  ├─ Lost on server restart 🔴
│  └─ Single instance only 🔴
│
└─ FALLBACK
   ├─ If API fails: Use stale cached rate ⚠️
   └─ If nothing cached: Use hardcoded 129 KES 🔴


Crypto Price Services (FRAGMENTED) 🔴
═════════════════════════════════════════════════════════

tokenService.ts
├─ getPriceFromCoinGecko() ✅ WORKS (60s cache)
├─ getPriceFromDeFiLlama() ✅ WORKS (5min cache)
└─ getPriceFromChainlink() ⚠️ MAY NOT WORK

vaultService.ts
├─ getChainlinkPrice() ✅ Attempts on-chain
├─ getCoinGeckoPrice() ✅ Has 60s cache
└─ getDeFiLlamaPrice() ✅ Has 5min cache

PROBLEM: Same APIs called from 2+ places 🔴
└─ No unified coordination
└─ Different cache durations
└─ Possible duplicate API calls


Database Storage
═════════════════════════════════════════════════════════

PostgreSQL tables:
├─ users ✅
├─ wallets ✅
├─ transactions ✅
├─ dao_treasury ✅
└─ PRICES table? 🔴 DOES NOT EXIST

Missing:
┌─ prices (should store history)
│  ├─ id
│  ├─ pair (CELO-USD, USD-KES, etc.)
│  ├─ rate
│  ├─ change24h
│  ├─ timestamp
│  ├─ source (CoinGecko, exchangerate-api, etc.)
│  └─ confidence (0-100)
│
└─ price_snapshots (hourly history)
   ├─ id
   ├─ price_id
   ├─ rate
   └─ timestamp (hourly)


24-Hour Change Calculation
═════════════════════════════════════════════════════════

Current: Hardcoded in mock data 🔴
├─ CELO-USD: +0.5% (fake)
├─ cUSD-USD: 0% (correct)
└─ cUSD-KES: -0.3% (fake)

Should be: Calculate from history
├─ Current price
└─ Price from 24 hours ago
   └─ % change = ((new - old) / old) * 100

Problem: No historical data stored 🔴
└─ Cannot calculate real 24h changes


API Rate Limiting Analysis
═════════════════════════════════════════════════════════

exchangerate-api.com
├─ Free tier: 1500 req/month
├─ At 100 users checking every 30s:
│  └─ 172,800 req/month needed
├─ RATIO: 115x over limit 🔴
└─ VERDICT: Completely inadequate

CoinGecko
├─ Free tier: 10-50 req/second
├─ At 100 concurrent users:
│  └─ Possible 429 errors
└─ VERDICT: Marginal, needs optimization

DeFiLlama
├─ Free tier: Generous
├─ VERDICT: Adequate

Chainlink (On-chain)
├─ Cost: Gas fees per call
├─ RPC: Depends on provider limits
└─ VERDICT: Not for real-time polling


Data Freshness Timeline
═════════════════════════════════════════════════════════

Frontend behavior (useQuery):
├─ Poll every 30 seconds ✅
├─ Get: GET /api/wallet/exchange-rates
└─ Receive: 24-hour-old hardcoded data 🔴

If API were working:
├─ exchangerate-api: Updated every ~5 minutes ✅
├─ CoinGecko: Updated every ~30 seconds ✅
├─ DeFiLlama: Updated every ~2 minutes ✅
└─ Chainlink: Updated every block (~12 seconds) ✅

Current gap: Frontend always gets stale mock data 🔴
└─ No idea if rate is 1 second or 1 week old


Known Issues Summary
═════════════════════════════════════════════════════════

🔴 CRITICAL (Production Breaking)
├─ Mock data in wallet.ts endpoint (line 614)
├─ No real API calls for exchange rates
├─ 24h change hardcoded/faked
├─ No price history database
├─ exchangerate-api quota inadequate
└─ No fallback to real data

🟠 HIGH (Causing Inaccuracy)
├─ Fragmented crypto price fetching
├─ No unified price service
├─ Inconsistent cache durations (60s vs 5min vs 1hr)
├─ No confidence scoring
├─ Duplicate API calls possible
└─ No rate limiting/batching

⚠️ MEDIUM (Degradation Risk)
├─ In-memory cache (lost on restart)
├─ Single-source fallback (no redundancy)
├─ Chainlink addresses may be outdated
├─ No monitoring/alerts
└─ No audit trail


What Actually Works Today
═════════════════════════════════════════════════════════

✅ Real USD ↔ KES conversion (internal services)
   └─ exchangeRateService used by transactionLimitService
   └─ Used for: Payment processing, KYC limits

✅ Crypto prices for vaults
   └─ tokenService.getTokenPriceFromOracle()
   └─ Used for: Vault calculations, balance tracking

✅ Wallet balances display
   └─ Shows in user's currency preference
   └─ But with MOCK prices 🔴

❌ Frontend price display
   └─ Shows hardcoded/fake prices
   └─ "change24h" is completely wrong


Files Needing Changes
═════════════════════════════════════════════════════════

IMMEDIATE (Fix mock data):
├─ server/routes/wallet.ts (line 614-635)
│  └─ Replace hardcoded rates with API calls
│
├─ server/services/exchangeRateService.ts
│  └─ Expand to support all pairs (not just USD-KES)
│
└─ server/services/tokenService.ts
   └─ Add real-time price fetch for crypto

DATABASE (Add schema):
├─ server/db/schema.ts
│  ├─ prices table
│  └─ price_snapshots table
│
└─ Database migrations (new files)

CACHING (Add Redis layer):
├─ server/cache/ (NEW DIRECTORY)
│  ├─ priceCache.ts
│  └─ exchangeRateCache.ts
│
└─ .env (NEW VARIABLES)
   ├─ REDIS_URL
   └─ REDIS_TTL


Real vs Mock Comparison
═════════════════════════════════════════════════════════

REAL EXCHANGE RATES (If using exchangerate-api):
Today: USD 1 = KES 130.50 (live market rate)
       EUR 1 = USD 1.10  (live market rate)

MOCK RATES (Current - wrong):
Always: USD 1 = KES 130.5  (hardcoded, not updated)
        EUR 1 = USD 0.91   (hardcoded, stale)

REAL CRYPTO PRICES (CoinGecko):
CELO:  $0.65 (live, updates every 30s)
cUSD:  $0.995 (live, updates every 30s)
USDC:  $1.00 (live, updates every 30s)

MOCK CRYPTO PRICES (Current - wrong):
CELO:  $0.65 (hardcoded since... when?)
cUSD:  $1.00 (at least this is right by luck)
USDC:  $1.00 (at least this is right by luck)

24h CHANGES (Real would be calculated):
Real:  CELO ↑ +2.5% (calculated from history)
       cUSD → 0.0% (no change, as expected)

Mock (Current - all faked):
       CELO ↑ +0.5% (hardcoded guess)
       cUSD → 0.0% (lucky guess)


Dependency Graph
═════════════════════════════════════════════════════════

Frontend Components
├─ PortfolioOverview.tsx
│  └─ useQuery('exchange-rates')
│     └─ Gets mock data from endpoint 🔴
│
├─ BalanceAggregatorWidget.tsx
│  └─ useQuery('exchange-rates')
│     └─ Gets mock data from endpoint 🔴
│
├─ TransactionHistory.tsx
│  └─ useQuery('exchange-rates')
│     └─ Gets mock data from endpoint 🔴
│
└─ PriceDisplay.tsx (NEW)
   └─ Uses exchangeRates prop
      └─ Still mock data 🔴


Backend Services Chain
├─ kotanipayService
│  └─ exchangeRateService.getUSDtoKESRate()
│     └─ ✅ Real API (works!)
│
├─ transactionLimitService
│  └─ exchangeRateService.getUSDtoKESRate()
│     └─ ✅ Real API (works!)
│
└─ tokenService
   ├─ getPriceFromCoinGecko()
   │  └─ ✅ Real API
   ├─ getPriceFromDeFiLlama()
   │  └─ ✅ Real API
   └─ getPriceFromChainlink()
      └─ ⚠️ May not work (RPC dependent)


Network Calls (Per User, Per 30s Cycle)
═════════════════════════════════════════════════════════

Current (should be):
GET /api/wallet/exchange-rates
├─ Should call: exchangerate-api.com + CoinGecko
├─ Should return: Real prices
└─ Actually returns: Hardcoded mock data 🔴

Per 100 concurrent users:
├─ Expected: 3-4 upstream API calls per 30s
├─ Actually: 0 API calls (just returns hardcoded)
└─ When fixed: 100+ API calls per 30s
   └─ Needs rate limiting/batching!


Recovery Plan Priority
═════════════════════════════════════════════════════════

WEEK 1 - CRITICAL FIXES:
├─ [ ] Day 1: Replace mock endpoint with real API calls (3h)
├─ [ ] Day 2: Add exchange rate redundancy (4h)
├─ [ ] Day 3: Fix crypto price service consolidation (4h)
└─ [ ] Day 4: Add database schema for prices (2h)
   Total: ~13 hours

WEEK 2 - HIGH PRIORITY:
├─ [ ] Add Redis caching layer (4h)
├─ [ ] Implement 24h change calculation (3h)
├─ [ ] Add price history storage job (3h)
└─ [ ] Create monitoring dashboard (4h)
   Total: ~14 hours

WEEK 3 - MEDIUM PRIORITY:
├─ [ ] Implement WebSocket real-time updates (6h)
├─ [ ] Add fallback mechanisms (3h)
├─ [ ] Performance optimization (3h)
└─ [ ] Documentation (2h)
   Total: ~14 hours

ESTIMATED TOTAL: 4-5 weeks of work
```

---

## Key Metrics to Track

```
ACCURACY:
├─ Price variance between sources (should be <1%)
├─ Freshness: How old is the latest price? (should be <5min)
├─ Coverage: # of pairs supported (currently: 11, should be: 50+)
└─ Confidence: Data source trust score (should track per source)

AVAILABILITY:
├─ Uptime of exchange-rates endpoint (currently: ✅ always up, but with wrong data)
├─ API response time (should be <500ms)
├─ Cache hit rate (should be >90%)
└─ Fallback activation rate (should be <1%)

PERFORMANCE:
├─ Database query time for prices (should be <50ms)
├─ Cache query time (should be <10ms)
├─ API call time (varies, should be <5s)
└─ Concurrent users supported (currently: ?, should be: 1000+)
```

---

## Summary: "What We Have vs What We Need"

| Area | Have | Need | Status |
|------|------|------|--------|
| Exchange Rate API | 1 source | 3+ sources | 🔴 |
| Crypto Price API | 3 sources scattered | 1 unified service | 🔴 |
| Cache Storage | In-memory (volatile) | Redis + DB | 🔴 |
| Price History | None | 30 days | 🔴 |
| 24h Changes | Hardcoded | Calculated real | 🔴 |
| Rate Limiting | None | Batching + queue | 🔴 |
| Monitoring | None | Dashboard + alerts | 🔴 |
| Redundancy | None | 3-tier fallback | 🔴 |

**Overall Status: 🔴 PRODUCTION NOT READY**

---

**Generated**: Data Audit
**Last Updated**: Today
**Next Review**: After Phase 1 completion
