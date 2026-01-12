# Exchange Rate & Crypto Data - Action Plan

## 🎯 Mission

Make exchange rate and crypto price data **accurate**, **always available**, and **production-ready**.

---

## Current Critical Issue

**The system is currently showing HARDCODED/MOCK data to users** ❌

```
Frontend displays:
├─ CELO price: $0.65 (hardcoded, not real)
├─ 24h change: +0.5% (hardcoded, not real)  
├─ KES rate: 130.5 (may be stale)
└─ All prices refresh every 30s BUT from hardcoded endpoint

Backend truth:
├─ exchangeRateService: ✅ WORKS (fetches real rates)
├─ tokenService: ✅ WORKS (fetches real crypto prices)
├─ Endpoint /api/wallet/exchange-rates: ❌ BROKEN (returns hardcoded data)
└─ Database: ❌ NO price history stored
```

---

## Phase 1: Fix Mock Data (IMMEDIATE - 1 week)

### 1.1 Replace Mock Exchange Rates Endpoint

**File**: `server/routes/wallet.ts` (line 614-635)

**Current**:
```typescript
router.get('/exchange-rates', async (req, res) => {
  const rates = {
    'CELO-USD': { rate: 0.65, change24h: 0.5 },  // ❌ HARDCODED
    'cUSD-USD': { rate: 1.0, change24h: 0 },     // ❌ HARDCODED
    'cUSD-KES': { rate: 130.5, change24h: -0.3 }, // ❌ HARDCODED
    // ... more hardcoded pairs
  };
  res.json({ rates });
});
```

**Fix** (1-2 hours):
```typescript
router.get('/exchange-rates', async (req, res) => {
  try {
    // Fetch from real services
    const celoPrice = await tokenService.getTokenPrice('CELO');
    const cusdPrice = await tokenService.getTokenPrice('cUSD');
    
    const kesRate = await exchangeRateService.getUSDtoKESRate();
    const eurRate = await getExchangeRate('USD', 'EUR');
    
    // Build response with REAL data
    const rates = {
      'CELO-USD': { 
        rate: celoPrice, 
        change24h: await get24hChange('CELO')  // From history
      },
      'cUSD-USD': { 
        rate: cusdPrice, 
        change24h: 0  // Stablecoin
      },
      'cUSD-KES': { 
        rate: cusdPrice * kesRate, 
        change24h: await get24hChange('cUSD-KES')
      },
      // ... etc
    };
    
    res.json({ rates, timestamp: new Date() });
  } catch (error) {
    // Return cached data on error
    res.json(await getCachedRates());
  }
});
```

**Acceptance Criteria**:
- [ ] Endpoint returns real API data (not hardcoded)
- [ ] At least 1 API call per request (exchangerate-api or CoinGecko)
- [ ] Frontend displays real prices (no mock values)
- [ ] Error handling returns cached data
- [ ] Response includes data timestamp
- [ ] No console errors on /api/wallet/exchange-rates call

---

### 1.2 Expand exchangeRateService for All Pairs

**File**: `server/services/exchangeRateService.ts`

**Current** (only USD-KES):
```typescript
static async getUSDtoKESRate(): Promise<number>
```

**Add** (2-3 hours):
```typescript
// Support multiple currency pairs
static async getExchangeRate(from: string, to: string): Promise<number> {
  // Handle USD -> KES, EUR, GHS, NGN
  // With fallback chain
}

// Batch fetch multiple rates
static async getExchangeRates(pairs: string[]): Promise<Map<string, number>> {
  // USD-KES, USD-EUR, USD-GHS, USD-NGN
  // Minimize API calls
}

// Add support for multiple APIs:
private static async fetchFromXE(): Promise<rates>
private static async fetchFromFixer(): Promise<rates>
private static async fetchFromOANDA(): Promise<rates>  // Premium fallback
```

**Acceptance Criteria**:
- [ ] Support USD ↔ KES, EUR, GHS, NGN
- [ ] Batch endpoint for multiple pairs
- [ ] 2+ API sources configured
- [ ] Fallback works when primary fails
- [ ] Cache TTL configurable

---

### 1.3 Create Crypto Price Endpoint

**File**: `server/routes/wallet.ts` (NEW route)

**Add** (1-2 hours):
```typescript
router.get('/prices/crypto', async (req, res) => {
  try {
    const symbols = req.query.symbols?.split(',') || ['CELO', 'cUSD', 'USDC'];
    
    const prices = {};
    for (const symbol of symbols) {
      prices[symbol] = {
        usd: await tokenService.getTokenPrice(symbol),
        change24h: await get24hChange(symbol),
        change7d: await get7dChange(symbol),
        source: 'CoinGecko',
        timestamp: new Date()
      };
    }
    
    res.json({ prices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Acceptance Criteria**:
- [ ] Endpoint returns real crypto prices
- [ ] Supports multiple symbols (query param)
- [ ] Includes 24h/7d changes
- [ ] Specifies data source
- [ ] Error handling

---

### 1.4 Fix 24-Hour Change Display

**Problem**: Currently hardcoded and wrong

**Solution** (2-3 hours):
```typescript
// Option A (Until DB ready): Calculate from memory
const priceHistory = new Map<string, number[]>();  // Store last 24h

// Option B (Preferred): Store in database immediately
// See Phase 2

// Display on frontend:
// change24h = ((current - 24hAgo) / 24hAgo) * 100
const change24h = ((currentPrice - priceFromYesterday) / priceFromYesterday) * 100;
```

**Acceptance Criteria**:
- [ ] 24h change not hardcoded
- [ ] Calculated from history (memory or DB)
- [ ] Color coding correct (green/red)
- [ ] Percentage formatted correctly

---

## Phase 2: Database & History (Week 2)

### 2.1 Add Price Schema

**File**: `server/db/schema.ts`

**Add** (1-2 hours):
```typescript
export const prices = pgTable('prices', {
  id: serial('id').primaryKey(),
  
  // Price data
  pair: varchar('pair', { length: 20 }).notNull(),  // CELO-USD, USD-KES
  rate: decimal('rate', { precision: 18, scale: 8 }).notNull(),
  change24h: decimal('change24h', { precision: 10, scale: 8 }),
  
  // Metadata
  source: varchar('source', { length: 50 }),  // CoinGecko, exchangerate-api
  confidence: smallint('confidence'),  // 0-100 score
  
  // Timestamps
  timestamp: timestamp('timestamp').defaultNow(),
  fetchedAt: timestamp('fetched_at').defaultNow(),
  
  // Indexing
  createdAt: timestamp('created_at').defaultNow(),
});

// Historical snapshots (hourly)
export const priceSnapshots = pgTable('price_snapshots', {
  id: serial('id').primaryKey(),
  pairId: integer('pair_id').references(() => prices.id),
  
  rate: decimal('rate', { precision: 18, scale: 8 }).notNull(),
  timestamp: timestamp('timestamp').notNull(),
  
  createdAt: timestamp('created_at').defaultNow(),
});

// Create indices
export const priceIndex = index('price_pair_timestamp_idx')
  .on(prices.pair, prices.timestamp);
```

**Acceptance Criteria**:
- [ ] Schema created
- [ ] Migration runs without errors
- [ ] Can insert/query price data
- [ ] Indices created

---

### 2.2 Store Price Data

**File**: `server/services/priceService.ts` (NEW)

**Create** (2-3 hours):
```typescript
export class PriceService {
  static async recordPrice(
    pair: string,
    rate: number,
    source: string,
    confidence: number
  ): Promise<void> {
    // Insert into prices table
    await db.insert(prices).values({
      pair,
      rate,
      source,
      confidence,
      timestamp: new Date()
    });
  }
  
  static async getPriceHistory(pair: string, hours: number): Promise<Price[]> {
    // Get last N hours of prices
    const since = new Date(Date.now() - hours * 3600000);
    return await db.select()
      .from(prices)
      .where(
        and(
          eq(prices.pair, pair),
          gte(prices.timestamp, since)
        )
      )
      .orderBy(desc(prices.timestamp));
  }
  
  static async calculate24hChange(pair: string): Promise<number> {
    // Get prices from 24h ago and now
    const now = await this.getCurrentPrice(pair);
    const ago24h = await this.getPriceAt(pair, 24);  // 24 hours ago
    
    if (!ago24h) return 0;
    return ((now - ago24h) / ago24h) * 100;
  }
}
```

**Acceptance Criteria**:
- [ ] Prices recorded to database
- [ ] Can retrieve price history
- [ ] 24h change calculated from history
- [ ] Query performance acceptable (<100ms)

---

### 2.3 Create Background Job for Price Snapshots

**File**: `server/jobs/priceSnapshotJob.ts` (NEW)

**Create** (2-3 hours):
```typescript
// Run every hour
export async function captureHourlyPriceSnapshot() {
  const pairs = ['CELO-USD', 'cUSD-USD', 'USD-KES', 'USD-EUR'];
  
  for (const pair of pairs) {
    try {
      const latestPrice = await db.select()
        .from(prices)
        .where(eq(prices.pair, pair))
        .orderBy(desc(prices.timestamp))
        .limit(1);
      
      if (latestPrice.length > 0) {
        await db.insert(priceSnapshots).values({
          pairId: latestPrice[0].id,
          rate: latestPrice[0].rate,
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error(`Failed to snapshot price for ${pair}:`, error);
    }
  }
}

// Schedule with node-cron or similar
// Every hour: captureHourlyPriceSnapshot()
```

**Acceptance Criteria**:
- [ ] Job runs hourly
- [ ] Captures current prices to history table
- [ ] Handles errors gracefully
- [ ] Can be monitored

---

## Phase 3: Redundancy & Fallbacks (Week 2-3)

### 3.1 Add Secondary Exchange Rate Source

**File**: `server/services/exchangeRateService.ts`

**Add** (2-3 hours):
```typescript
private static async fetchFromXE(): Promise<number | null> {
  // Fallback source 1: xe.com API
  // Documentation: https://xeapi.xe.com/
  try {
    const response = await fetch('https://xeapi.xe.com/convert', {
      headers: { 'Authorization': `Basic ${process.env.XE_API_KEY}` }
    });
    // Parse and return rate
  } catch (error) {
    logger.warn('XE.com API failed:', error);
    return null;
  }
}

private static async fetchFromFixer(): Promise<number | null> {
  // Fallback source 2: fixer.io (if affordable)
  // Free tier: 100 req/month
}

// Updated main function
static async getUSDtoKESRate(): Promise<number> {
  // Try sources in priority order
  let rate = await this.fetchFromExchangeRateAPI();
  if (rate) return rate;
  
  rate = await this.fetchFromXE();  // NEW
  if (rate) return rate;
  
  rate = await this.fetchFromFixer();  // NEW
  if (rate) return rate;
  
  // Fall back to cached or default
  return this.getCachedOrDefault();
}
```

**Acceptance Criteria**:
- [ ] 2+ sources configured
- [ ] Fallback chain works
- [ ] Each source tested independently
- [ ] Metrics track which source used

---

### 3.2 Add Confidence Scoring

**File**: `server/services/priceService.ts`

**Add** (1-2 hours):
```typescript
calculateConfidence(price: number, source: string, age: number): number {
  let confidence = 100;
  
  // Deduct for age
  if (age > 5 * 60 * 1000) confidence -= 20;  // 5min old
  if (age > 60 * 60 * 1000) confidence -= 50;  // 1hr old
  
  // Adjust for source
  const sourceScores = {
    'CoinGecko': 95,
    'DeFiLlama': 90,
    'Chainlink': 100,
    'exchangerate-api': 90,
    'XE.com': 95,
    'Cached': 50,
    'Fallback': 30
  };
  
  confidence = Math.min(confidence, sourceScores[source] || 50);
  
  return Math.max(0, Math.min(100, confidence));
}
```

**Acceptance Criteria**:
- [ ] Confidence score calculated per price
- [ ] Reflects source + freshness
- [ ] Stored in database
- [ ] Displayed to frontend (optional)

---

## Phase 4: Unified Service (Week 3)

### 4.1 Consolidate Price Fetching

**File**: `server/services/unifiedPriceService.ts` (NEW)

**Create** (3-4 hours):
```typescript
export class UnifiedPriceService {
  // Single source of truth for all prices
  
  static async getPrice(pair: string): Promise<PriceData> {
    // Check cache first
    const cached = await redisCache.get(`price:${pair}`);
    if (cached) return cached;
    
    // Fetch from best available source
    let price = await this.getFromCoinGecko(pair);
    if (!price) price = await this.getFromDeFiLlama(pair);
    if (!price) price = await this.getFromChainlink(pair);
    if (!price) price = await this.getFromDatabase(pair);
    
    // Store in cache and database
    await redisCache.set(`price:${pair}`, price, 60);  // 60s TTL
    await priceService.recordPrice(pair, price);
    
    return price;
  }
  
  static async getPrices(pairs: string[]): Promise<Map<string, PriceData>> {
    // Batch fetch with deduplication
    const unique = [...new Set(pairs)];
    const results = await Promise.all(unique.map(p => this.getPrice(p)));
    
    return new Map(unique.map((p, i) => [p, results[i]]));
  }
  
  // Replace scattered getCoinGeckoPrice, getDeFiLlamaPrice calls
  // Consolidate all price fetching here
}
```

**Acceptance Criteria**:
- [ ] Single service for all prices
- [ ] No duplicate API calls
- [ ] Caching coordinated
- [ ] Database updates coordinated

---

### 4.2 Add Redis Caching Layer

**File**: `server/cache/priceCache.ts` (NEW)

**Create** (2-3 hours):
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export class PriceCache {
  static async get(key: string): Promise<PriceData | null> {
    const data = await redis.get(`price:${key}`);
    return data ? JSON.parse(data) : null;
  }
  
  static async set(key: string, price: PriceData, ttl: number = 60) {
    await redis.setex(
      `price:${key}`,
      ttl,
      JSON.stringify(price)
    );
  }
  
  static async delete(key: string) {
    await redis.del(`price:${key}`);
  }
  
  static async clearAll() {
    await redis.flushdb();  // Be careful with this
  }
}
```

**Acceptance Criteria**:
- [ ] Redis connection works
- [ ] Cache hit rate > 90%
- [ ] TTL configurable
- [ ] Survives restarts

---

## Phase 5: Real-time Updates (Week 4)

### 5.1 WebSocket Price Updates

**File**: `server/websocket/priceUpdater.ts` (NEW)

**Create** (4-5 hours):
```typescript
export class PriceUpdater {
  private clients: Set<WebSocket> = new Set();
  
  subscribe(ws: WebSocket) {
    this.clients.add(ws);
  }
  
  unsubscribe(ws: WebSocket) {
    this.clients.delete(ws);
  }
  
  // Called when price updates
  broadcastPriceUpdate(pair: string, price: PriceData) {
    const message = {
      type: 'PRICE_UPDATE',
      pair,
      price,
      timestamp: new Date()
    };
    
    this.clients.forEach(client => {
      client.send(JSON.stringify(message));
    });
  }
}

// On price fetch:
unifiedPriceService.onPriceUpdate((pair, price) => {
  priceUpdater.broadcastPriceUpdate(pair, price);
});
```

**Acceptance Criteria**:
- [ ] WebSocket connection works
- [ ] Price updates broadcast to clients
- [ ] Fallback to polling works
- [ ] Handles disconnections

---

## Phase 6: Monitoring (Week 4-5)

### 6.1 Add Monitoring Dashboard

**File**: `server/monitoring/priceHealthCheck.ts` (NEW)

**Create** (3-4 hours):
```typescript
export class PriceHealthCheck {
  static async check(): Promise<HealthStatus> {
    return {
      exchangeRateAPI: await this.checkExchangeRateAPI(),
      coinGecko: await this.checkCoinGecko(),
      defiLlama: await this.checkDeFiLlama(),
      chainlink: await this.checkChainlink(),
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      
      priceAge: {
        'CELO-USD': await this.getPriceAge('CELO-USD'),
        'USD-KES': await this.getPriceAge('USD-KES'),
      },
      
      cacheHitRate: await this.getCacheHitRate(),
      errorRate: await this.getErrorRate(),
    };
  }
}

// Endpoint for monitoring
router.get('/health/prices', async (req, res) => {
  const health = await priceHealthCheck.check();
  res.json(health);
});
```

**Acceptance Criteria**:
- [ ] Health check endpoint works
- [ ] Shows all API statuses
- [ ] Shows price freshness
- [ ] Shows error rates

---

## Implementation Timeline

```
WEEK 1:
├─ Mon: Replace mock endpoint (1.1)
├─ Tue: Expand exchangeRateService (1.2)
├─ Wed: Create crypto price endpoint (1.3)
├─ Thu: Fix 24h changes (1.4)
└─ Fri: Testing & QA

WEEK 2:
├─ Mon: Add price schema (2.1)
├─ Tue: Store price data (2.2)
├─ Wed: Create snapshot job (2.3)
├─ Thu: Add secondary source (3.1)
└─ Fri: Add confidence scoring (3.2)

WEEK 3:
├─ Mon: Consolidate services (4.1)
├─ Tue: Add Redis caching (4.2)
├─ Wed: WebSocket setup (5.1 start)
├─ Thu: WebSocket testing
└─ Fri: Finalize & test

WEEK 4:
├─ Mon-Tue: Health monitoring (6.1)
├─ Wed: Dashboard setup
├─ Thu: Load testing
└─ Fri: Deployment prep

WEEK 5:
├─ Mon-Fri: Production rollout + monitoring
```

---

## Success Metrics

When complete, verify:

```
✅ Accuracy
   └─ All prices from real APIs (0% mock)
   └─ 24h changes calculated from history
   └─ ±1% variance between sources

✅ Availability
   └─ 99.5% uptime for price endpoint
   └─ <500ms response time
   └─ Fallback chain working

✅ Performance
   └─ >90% cache hit rate
   └─ <50ms database queries
   └─ Support 1000+ concurrent users

✅ Data Quality
   └─ All prices <5 minutes old
   └─ 30-day history stored
   └─ Confidence score per price
   └─ Audit trail available

✅ Scalability
   └─ Redis cluster ready
   └─ Database optimized
   └─ Horizontal scaling possible
```

---

## Files to Create/Modify Summary

**Create**:
- `server/services/priceService.ts`
- `server/services/unifiedPriceService.ts`
- `server/jobs/priceSnapshotJob.ts`
- `server/cache/priceCache.ts`
- `server/websocket/priceUpdater.ts`
- `server/monitoring/priceHealthCheck.ts`
- `server/db/migrations/createPricesTable.ts`

**Modify**:
- `server/routes/wallet.ts` (fix mock endpoint)
- `server/services/exchangeRateService.ts` (add sources)
- `server/services/tokenService.ts` (coordinate with unified)
- `server/db/schema.ts` (add price tables)
- `.env` (add API keys, Redis URL)

**Expected Effort**: 38-50 hours over 4-5 weeks

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| API quota exceeded | Implement caching + batching |
| Data inconsistency | Unified service + database lock |
| Service down | Multi-source fallback chain |
| Performance degradation | Redis cache + database indices |
| Data staleness | Monitoring alerts + auto-refresh |

---

**Status**: Ready to begin Phase 1
**Next Action**: Create issue/ticket for "Replace Mock Exchange Rates Endpoint"
