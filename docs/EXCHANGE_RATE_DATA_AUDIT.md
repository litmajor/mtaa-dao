# Exchange Rate & Crypto Price Data Architecture

## Executive Summary

Current system has **fragmented price data sources** with **multiple single points of failure**. This document maps existing infrastructure and identifies critical gaps.

**Status**: 🔴 **CRITICAL GAPS**
- Exchange rates: Mock data with 1-hour cache, 1 source (exchangerate-api.com)
- Crypto prices: Multiple sources but no unified management
- No local database persistence
- No fallback hierarchy for accuracy
- No redundancy for high-availability

---

## Current Data Landscape

### 1. Exchange Rate Data (USD ↔ Fiat)

#### **Current Implementation**

**Service**: `exchangeRateService.ts`
```typescript
Primary Source: exchangerate-api.com (Free tier)
├─ 1500 requests/month limit
├─ 1-hour cache TTL
├─ Fallback: Hardcoded default (129 KES/USD)
└─ No redundancy
```

**Supported Pairs**:
```
USD-KES (Primary - Kenya Shilling)
USD-EUR (Euro)
USD-GHS (Ghana Cedi)
USD-NGN (Nigerian Naira)
```

**Cache Strategy**:
- In-memory cache (volatile)
- 1-hour TTL
- No Redis/persistent storage
- Single instance only (no cluster support)

**Issues** 🔴:
```
❌ Mock data in wallet.ts (hardcoded 130.5 KES/USD)
❌ Only 1500 API calls/month (not enough for production)
❌ No failover to secondary source
❌ In-memory cache lost on restart
❌ No audit trail of rate changes
❌ No support for historical rates
```

---

### 2. Crypto Price Data (Token → USD)

#### **Current Implementation**

**Service**: `tokenService.ts` & `vaultService.ts`

**Source Hierarchy**:
```
Priority 1: CoinGecko API
├─ Free tier: 10-50 calls/second
├─ No authentication required
├─ 60-second cache TTL
└─ Coverage: CELO, cUSD, cEUR, USDC, USDT, DAI

Priority 2: DeFiLlama API
├─ Free tier: Excellent
├─ Token address-based lookups
├─ 5-minute cache TTL
└─ Coverage: Chain-specific tokens (Celo, Ethereum)

Priority 3: Chainlink Oracles (On-chain)
├─ Smart contract based (on-chain data)
├─ Requires RPC calls
├─ Most accurate/trustless
└─ Limited token coverage on Celo
```

**Token Price Mappings**:
```typescript
CoinGecko: {
  'CELO': 'celo',
  'cUSD': 'celo-dollar',
  'cEUR': 'celo-euro',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'DAI': 'dai'
}

DeFiLlama: {
  'CELO': 'celo:0x471EcE3750Da237f93B8E339c536aB0ad0c12b514',
  'cUSD': 'celo:0x765DE816845861e75A25fCA122bb6CAA78443cb53',
  'USDC': 'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
}

Chainlink: {
  'ETH': '0x3477EB6Fa582386e1d2B231467D3d02e424e263F',
  'CELO': '0xC957dff4de5f82b071b27efc1ed3d1f97c35f71e',
  'BTC': '0x1a8F5e3f3f3e59ff1e5f8d4e3f3e59ff1e5f8d4e'
}
```

**Issues** 🔴:
```
❌ No centralized price service (spread across services)
❌ Cache inconsistency (60s vs 5min vs in-memory)
❌ No freshness tracking
❌ No 24-hour change data stored
❌ No confidence scores
❌ Chainlink addresses may be wrong/incomplete
❌ No fallback to manual pricing
❌ No real-time price updates (polling-based only)
```

---

### 3. API Endpoint Issues

#### **Current Mock Endpoint**

**Route**: `GET /api/wallet/exchange-rates`

```typescript
// Production gap: HARDCODED DATA
const rates = {
  'CELO-USD': { pair: 'CELO-USD', rate: 0.65, change24h: 0.5 },
  'cUSD-USD': { pair: 'cUSD-USD', rate: 1.0, change24h: 0 },
  'cUSD-KES': { pair: 'cUSD-KES', rate: 130.5, change24h: -0.3 },
  // ... 8 more hardcoded pairs
};
```

**Issues** 🔴:
```
❌ Completely disconnected from real data sources
❌ No actual API calls to fetch data
❌ No cache management
❌ change24h field hardcoded
❌ 24-hour aggregation not implemented
❌ No rate limiting (production risk)
❌ No data freshness indicator
```

---

## Data Accuracy Assessment

### Exchange Rate Accuracy

| Source | Accuracy | Latency | Cost | Reliability |
|--------|----------|---------|------|-------------|
| exchangerate-api.com | ⭐⭐⭐⭐⭐ | 1-2s | Free (1500/mo) | 99% |
| xe.com API | ⭐⭐⭐⭐⭐ | 1-2s | Paid | 99.9% |
| OANDA | ⭐⭐⭐⭐⭐ | Real-time | Paid | 99.9% |
| Fixer.io | ⭐⭐⭐⭐ | 1-2s | Free (100/mo) | 99% |
| Open Exchange Rates | ⭐⭐⭐⭐⭐ | Real-time | Paid | 99.9% |

**Problem**: Current system uses **only free tier** with **hard rate limit**

### Crypto Price Accuracy

| Source | Accuracy | Latency | Cost | Reliability |
|--------|----------|---------|------|-------------|
| CoinGecko | ⭐⭐⭐⭐⭐ | 2-5s | Free | 99% |
| DeFiLlama | ⭐⭐⭐⭐ | 2-5s | Free | 98% |
| Chainlink (On-chain) | ⭐⭐⭐⭐⭐ | 12s* | On-chain gas | 100% |
| Kraken API | ⭐⭐⭐⭐⭐ | <1s | Free (public) | 99.9% |
| CoinMarketCap | ⭐⭐⭐⭐ | 2-5s | Paid | 99% |

**Problem**: **Multiple sources scattered across codebase**, no unified strategy

---

## Current Service Dependencies

```
Frontend
  ├─ useQuery(['exchange-rates'])
  │   └─ GET /api/wallet/exchange-rates (MOCK DATA)
  │
  └─ TokenCard, PortfolioOverview, TransactionHistory
      ├─ Fetch rates every 30s
      └─ Display without real data

Backend Services
  ├─ exchangeRateService
  │   ├─ exchangerate-api.com (1 source)
  │   └─ 1-hour cache (lost on restart)
  │
  ├─ tokenService
  │   ├─ getPriceFromCoinGecko() (60s cache)
  │   ├─ getPriceFromDeFiLlama() (5min cache)
  │   └─ getPriceFromChainlink() (on-chain)
  │
  └─ vaultService
      ├─ Local priceCache Map (volatile)
      └─ Multiple fetch strategies

Database: ❌ NO PRICE HISTORY STORED
```

---

## Availability & Reliability Issues

### Single Point of Failures

```
1. exchangerate-api.com down
   → All fiat exchange rates fail
   → Fallback: hardcoded 129 KES (STALE)
   → User impact: Cannot convert currencies

2. CoinGecko down
   → Crypto prices unavailable
   → Fallback: DeFiLlama (slower)
   → User impact: Portfolio values incorrect

3. No RPC provider for Chainlink
   → Cannot fetch on-chain prices
   → No fallback
   → User impact: Data gap

4. In-memory cache lost on restart
   → All prices reset
   → Fresh fetch required
   → Latency spike
```

### Rate Limiting Issues

```
CoinGecko: 10-50 req/sec
├─ Concurrent users: 100+?
├─ Risk: 429 Too Many Requests
└─ Impact: Price display fails

exchangerate-api.com: 1500 req/month
├─ At 100 concurrent users checking every 30s
├─ = 172,800 req/month (116x limit!)
└─ Impact: Quota exhausted by day 9
```

---

## What We Need to Fix

### Priority 1 (Critical) 🔴

1. **Replace Mock Data**
   - Endpoint currently returns hardcoded rates
   - Must connect to real sources immediately
   - Estimated effort: 2-3 hours

2. **Implement Exchange Rate Redundancy**
   - Add 2-3 secondary sources
   - Fallback chain for accuracy
   - Estimated effort: 4-6 hours

3. **Persistent Price History**
   - Store rates in database
   - Enable 24-hour change calculations
   - Estimated effort: 6-8 hours

4. **Unified Price Service**
   - Consolidate crypto price fetching
   - Single cache layer (Redis)
   - Confidence scoring
   - Estimated effort: 8-10 hours

### Priority 2 (High) 🟠

5. **Real-time Price Updates**
   - WebSocket instead of polling
   - Push updates to clients
   - Estimated effort: 12-15 hours

6. **24-Hour Change Calculation**
   - Store hourly price snapshots
   - Calculate changes from historical data
   - Estimated effort: 4-6 hours

7. **Rate Limiting & Caching Strategy**
   - Implement request batching
   - Smart cache invalidation
   - Estimated effort: 6-8 hours

8. **Monitoring & Alerts**
   - Track price feed health
   - Alert on stale data
   - Dashboard for operations
   - Estimated effort: 8-10 hours

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend Layer                         │
│  (useQuery hooks every 30s, display updates via SSE)    │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
   REST API                    WebSocket
   (Fallback)                  (Real-time)
        │                         │
┌───────┴─────────────────────────┴─────────────┐
│          Unified Price Service               │
│  ┌──────────────────────────────────────┐    │
│  │     Price Cache Layer (Redis)        │    │
│  │  ├─ TTL-based expiration             │    │
│  │  ├─ Cluster-aware                    │    │
│  │  └─ Persistent across restarts       │    │
│  └────────┬─────────────────────────────┘    │
│           │                                  │
│  ┌────────┴────────────────────────────┐    │
│  │  Data Source Manager                │    │
│  │  ├─ Exchange Rates                  │    │
│  │  │  ├─ Primary: exchangerate-api    │    │
│  │  │  ├─ Fallback: xe.com             │    │
│  │  │  └─ Manual override              │    │
│  │  │                                  │    │
│  │  ├─ Crypto Prices                  │    │
│  │  │  ├─ CoinGecko (primary)         │    │
│  │  │  ├─ DeFiLlama (secondary)       │    │
│  │  │  └─ Chainlink (tertiary)        │    │
│  │  │                                  │    │
│  │  └─ Exchange Pairs                 │    │
│  │     ├─ Binance API (spot)          │    │
│  │     └─ Kraken API (spot)           │    │
│  └────────┬─────────────────────────────┘    │
│           │                                  │
│  ┌────────┴──────────────────────────────┐  │
│  │  Historical Data Store (TimescaleDB)  │  │
│  │  ├─ Hourly snapshots                 │  │
│  │  ├─ 24h change calculations          │  │
│  │  ├─ Price trends                     │  │
│  │  └─ Audit trail                      │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
        │
        └─────────────────────────┬────────────────────┐
                                  │                    │
                            Database            External APIs
                         (PostgreSQL +         (CoinGecko,
                          TimescaleDB)         exchangerate-api,
                                               Chainlink, etc.)
```

---

## Implementation Roadmap

### Phase 1: Replace Mock Data (Week 1)
```
[ ] Connect exchange-rates endpoint to real sources
[ ] Remove hardcoded rates from wallet.ts
[ ] Test with live API calls
[ ] Add error handling
```

### Phase 2: Redundancy & Fallbacks (Week 1-2)
```
[ ] Add secondary exchange rate source (xe.com)
[ ] Implement source prioritization
[ ] Add fallback to cached rates
[ ] Create fallback update daemon
```

### Phase 3: Persistent History (Week 2-3)
```
[ ] Add prices table to database
[ ] Implement hourly snapshot job
[ ] Calculate 24-hour changes
[ ] Add historical query endpoints
```

### Phase 4: Unified Service (Week 3-4)
```
[ ] Consolidate price fetching logic
[ ] Implement Redis cache layer
[ ] Add confidence scoring
[ ] Create unified price endpoint
```

### Phase 5: Real-time Updates (Week 4-5)
```
[ ] Implement WebSocket connection
[ ] Server-Sent Events for price updates
[ ] Push to connected clients
[ ] Fallback to polling
```

### Phase 6: Monitoring (Week 5-6)
```
[ ] Dashboard for price feed health
[ ] Alerts for stale data
[ ] Metrics collection
[ ] Performance tracking
```

---

## Data Mapping Reference

### Complete Exchange Rate Pairs

**Current Supported** (should expand):
```
USD ↔ KES (Kenya)
USD ↔ EUR (Europe)
USD ↔ GHS (Ghana)
USD ↔ NGN (Nigeria)

Needed:
USD ↔ ZAR (South Africa)
USD ↔ UGX (Uganda)
USD ↔ TZS (Tanzania)
USD ↔ RWF (Rwanda)
```

### Complete Crypto Price Mappings

**CoinGecko IDs**:
```
CELO → celo
cUSD → celo-dollar
cEUR → celo-euro
USDC → usd-coin
USDT → tether
DAI → dai
WETH → ethereum
WBTC → wrapped-bitcoin
MTAA → (need to verify)
```

**DeFiLlama Token Addresses**:
```
Celo Network:
- CELO: celo:0x471EcE3750Da237f93B8E339c536aB0ad0c12b514
- cUSD: celo:0x765DE816845861e75A25fCA122bb6CAA78443cb53
- cEUR: celo:0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6CA73
- cREAL: celo:0xe8537a3d056DCA50d7ff7A2aaFF78b3961a48d8f

Ethereum Network:
- USDC: ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
- USDT: ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7
- DAI: ethereum:0x6b175474e89094c44da98b954eedeac495271d0f
```

**Chainlink Feed Addresses (Celo)**:
```
May need validation/update for Celo mainnet
Current addresses may be test/incomplete
```

---

## Summary Table

| Aspect | Current | Needed | Gap |
|--------|---------|--------|-----|
| Exchange Rate Sources | 1 (API) | 3+ | 🔴 Critical |
| Exchange Rate Cache | 1 hour | Redis 5min | 🔴 Critical |
| Crypto Price Sources | 3 (but fragmented) | Unified | 🔴 Critical |
| Price History | None | 30-day | 🔴 Critical |
| 24h Change Calc | Mock | Real | 🔴 Critical |
| Real-time Updates | No (30s poll) | WebSocket | 🟠 High |
| Fallback Strategy | Default rate | Multi-tier | 🔴 Critical |
| Database Storage | No | Yes | 🔴 Critical |
| Monitoring | None | Dashboard | 🟠 High |
| Rate Limiting | None | Smart batching | 🟠 High |

---

## Files to Modify

1. **`server/services/exchangeRateService.ts`** - Add redundancy
2. **`server/services/tokenService.ts`** - Consolidate logic
3. **`server/services/vaultService.ts`** - Remove duplicate price fetching
4. **`server/routes/wallet.ts`** - Replace mock endpoint
5. **`server/db/schema.ts`** - Add prices table
6. **`server/jobs/`** (NEW) - Add price update jobs
7. **`server/cache/`** (NEW) - Redis-based cache layer
8. **Frontend hooks** - Update to use real data

---

## Next Steps

1. **Start with Phase 1**: Replace mock data (2-3 hours)
2. **Then Phase 2**: Add exchange rate redundancy (4-6 hours)
3. **Then Phase 3**: Persistent storage (6-8 hours)
4. **Then Phase 4**: Unified service (8-10 hours)
5. **Then Phase 5-6**: Real-time and monitoring

**Total Estimated Effort**: 38-50 hours (5-6 weeks at 8-10 hrs/week)

---

**Status**: 🔴 CRITICAL - System currently using mock data with single points of failure
**Recommendation**: Begin Phase 1 implementation immediately
