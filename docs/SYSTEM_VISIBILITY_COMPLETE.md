# 🔎 System Visibility Stack - Complete

## ✅ What Was Built

### 4 Core Components

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| **Route Exporter** | `scripts/exportRoutes.js` | Exports all defined routes to JSON/CSV | ✅ Ready |
| **Usage Logger** | `server/middleware/routeUsageLogger.ts` | Logs every HTTP request to CSV | ✅ Ready |
| **API Tracker** | `server/services/externalAPITracker.ts` | Tracks CCXT, CoinGecko, DeFi calls | ✅ Ready |
| **Visibility Dashboard** | `server/middleware/systemVisibility.ts` | Consolidated reporting interface | ✅ Ready |
| **Integration Guide** | `SYSTEM_VISIBILITY_INTEGRATION_GUIDE.ts` | Exact code to mount everything | ✅ Ready |

---

## 📁 Output Files Generated

After integration and running server:

```
visibility-reports/
├─ routes-map.json              # All routes structure
├─ routes-map.csv               # Routes in Excel format
├─ routes-stats.json            # Route statistics

├─ route-usage.csv              # Every HTTP request
├─ route-usage-analysis.json    # Usage patterns
├─ route-usage-top-paths.csv    # Most-called endpoints
├─ route-usage-slowest-paths.csv# Performance issues

├─ external-api-calls.csv       # Every external API call
├─ external-api-analysis.json   # API analytics
├─ external-api-by-type.csv     # CCXT, CoinGecko, etc breakdowns
├─ external-api-by-service.csv  # Per-service metrics

├─ visibility-report.json       # Full report
└─ VISIBILITY_REPORT.md         # Markdown summary
```

---

## 🚀 Integration Checklist

### Phase 1: Add Middleware (30 minutes)

- [ ] Open `server/index.ts`
- [ ] Add import: `import { createRouteUsageLogger } from './middleware/routeUsageLogger';`
- [ ] Add around line 225: `app.use(createRouteUsageLogger());`
- [ ] Test: Run server, make a request, check `route-usage.csv`

### Phase 2: Export Routes (10 minutes)

- [ ] Add import: `import exportRoutes from '../scripts/exportRoutes';`
- [ ] Add around line 700 (after all routes mounted):
  ```typescript
  const routeExportResult = exportRoutes(app);
  if (routeExportResult) {
    logger.info(`✅ Routes exported: ${routeExportResult.stats.totalEndpoints} endpoints`);
  }
  ```
- [ ] Server startup will generate `visibility-reports/routes-map.csv`

### Phase 3: Instrument Services (1-2 hours)

Wrap external API calls in tracker:

#### In `ohlcvService.ts`:
```typescript
import { externalAPITracker } from './externalAPITracker';

// Around the CCXT fetch call:
const start = Date.now();
try {
  const data = await exchange.fetchOHLCV(symbol, timeframe);
  externalAPITracker.recordCall({
    timestamp: new Date().toISOString(),
    type: 'ccxt',
    service: 'binance', // etc
    endpoint: '/fetchOHLCV',
    method: 'GET',
    statusCode: 200,
    duration: Date.now() - start,
    dataSize: JSON.stringify(data).length,
  });
  return data;
} catch (error) {
  externalAPITracker.recordCall({
    timestamp: new Date().toISOString(),
    type: 'ccxt',
    service: 'binance',
    endpoint: '/fetchOHLCV',
    method: 'GET',
    duration: Date.now() - start,
    error: error.message,
  });
  throw error;
}
```

**Key services to instrument** (priority order):
1. `ohlcvService.ts` - CCXT calls
2. `priceHistoryService.ts` - CoinGecko calls
3. `dexIntegrationService.ts` - DEX protocol calls
4. `blockchain.ts` - RPC calls
5. Any service making external HTTP requests

### Phase 4: Create Reporting Endpoint (Optional, 15 minutes)

Enable on-demand reports via API:

```typescript
// In server/routes/visibility.ts (new file)
import { Router } from 'express';
import { SystemVisibility } from '../middleware/systemVisibility';
import { authenticate } from '../auth';

const router = Router();

router.post('/report', authenticate, async (req, res) => {
  // Check superuser
  const user = (req as any).user;
  if (user?.role !== 'superuser') {
    return res.status(403).json({ error: 'Superuser only' });
  }
  
  try {
    const visibility = new SystemVisibility(req.app);
    const report = visibility.generateAllReports();
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

// Mount in index.ts:
// import visibilityRoutes from './routes/visibility';
// app.use('/api/visibility', visibilityRoutes);
```

Then call: `POST /api/visibility/report` to generate reports on demand.

---

## 📊 What You'll Discover

### Expected (Healthy):
```
routes-map.csv:
  Total: ~200 endpoints
  Domains: 20-30 unique
  
route-usage-top-paths.csv:
  /api/auth/login: 500 calls
  /api/wallet/balance: 450 calls
  /api/vault/list: 200 calls
  
external-api-by-type.csv:
  ccxt: 200 calls/hour
  coingecko: 50 calls/hour
  blockchain_rpc: 100 calls/hour
```

### Critical Issues (What to Fix):
```
Duplicate routes:
  /api/symbols/BTC && /api/markets/BTC  ← Same data path twice
  /api/ticker/:symbol && /api/price/:symbol
  
API abuse:
  ccxt: 5000 calls/hour (should be ~200)  ← Polling leak
  coingecko: 1000 calls/hour  ← Rate limit risk
  
Slow endpoints:
  /api/dex/swap: 3500ms avg
  /api/analytics/calculate: 5000ms avg
  
Error paths:
  /api/bridge/quote: 25% error rate
  /api/blockchain/sign: 15% error rate
  
Dead code:
  /api/v1/legacy/symbols  ← In routes-map, never in usage
  /api/deprecated/getPrice  ← Defined but not called
```

---

## 🧠 Example Analysis Workflow

### 1. Run Server with Traffic (10 minutes)
```bash
npm run dev
# Run some trades, navigate UI, make API calls
```

### 2. Open Excel
```bash
open visibility-reports/routes-map.csv
open visibility-reports/route-usage-top-paths.csv
open visibility-reports/external-api-by-type.csv
```

### 3. Look for Patterns
- **Duplicate paths:** Sort by domain, look for similar endpoints
- **Unused routes:** Compare routes-map.csv against route-usage.csv
- **Slow endpoints:** Sort by duration in slowest-paths.csv
- **API abuse:** Check if any type has unusually high call count

### 4. Generate Issues
```
Issue 1: Duplicate Route Found
  Path 1: /api/markets/:symbol
  Path 2: /api/loadMarkets/:symbol
  Status: Both return same data
  Action: Consolidate into one

Issue 2: API Abuse - CCXT Polling
  Calls: 5000/hour (expected: 200)
  Service: ccxt:binance
  Likely cause: Frontend polling /api/ticker every second
  Action: Add caching + increase polling interval

Issue 3: Slow Endpoint
  Path: /api/dex/swap
  Avg: 3500ms (should be <500ms)
  Calls: 50/hour
  Action: Profile + optimize swap calculation

Issue 4: High Error Rate
  Path: /api/bridge/quote
  Error rate: 25%
  Status codes: 500 (15%), 503 (10%)
  Action: Check bridge service health
```

---

## 💡 What This Enables

✅ **Eliminate Duplicate Code**
- Find same endpoint implemented twice
- Consolidate to single source of truth
- Reduces maintenance burden

✅ **Remove Dead Routes**
- Identify unused endpoints
- Clean up API surface
- Improve security (fewer targets)

✅ **Optimize Performance**
- Identify slow endpoints
- Profile bottlenecks
- Measure improvements

✅ **Control API Usage**
- Detect polling abuse
- Monitor external API costs
- Enforce rate limits

✅ **Visibility Into System**
- Understand traffic patterns
- Detect anomalies
- Plan scaling

---

## 🎯 Next Steps (In Order)

1. **Today (30 min):** Add route usage logging + route export
2. **Tomorrow (1-2 hours):** Instrument OHLCV + price services
3. **This week (2-3 hours):** Instrument all external API calls
4. **Next sprint:** Analyze reports, create issues, start fixing

---

## 📞 Reference

### createRouteUsageLogger()
```typescript
import { createRouteUsageLogger } from './middleware/routeUsageLogger';
app.use(createRouteUsageLogger());
```

### externalAPITracker.recordCall()
```typescript
import { externalAPITracker } from './services/externalAPITracker';
externalAPITracker.recordCall({
  timestamp: new Date().toISOString(),
  type: 'ccxt' | 'coingecko' | 'defi_protocol' | 'blockchain_rpc' | etc,
  service: 'binance' | 'ethereum' | 'uniswap' | etc,
  endpoint: '/endpoint/path',
  method: 'GET' | 'POST',
  statusCode?: 200,
  duration: millis,
  error?: error.message,
  dataSize?: bytes,
});
```

### exportRoutes()
```typescript
import exportRoutes from '../scripts/exportRoutes';
const result = exportRoutes(app, './visibility-reports');
```

### SystemVisibility
```typescript
import { SystemVisibility } from './middleware/systemVisibility';
const visibility = new SystemVisibility(app);
const report = visibility.generateAllReports();
```

---

## 🎉 Summary

You now have **production-grade visibility** into:
- ✅ Every route (structural)
- ✅ Every request (behavioral)
- ✅ Every external API call (dependency)
- ✅ All anomalies (problems)

**No guessing. Pure facts.**

This is how you find and fix the million-dollar bugs that kill performance.
