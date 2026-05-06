/**
 * 🔎 SYSTEM VISIBILITY - Integration Guide
 * 
 * This file shows you EXACTLY how to wire the visibility stack into server/index.ts
 * 
 * Three components:
 * 1. Route export (happens once on startup)
 * 2. Route usage logging (middleware, tracks every request)
 * 3. External API tracking (manual instrumentation in services)
 * 4. System visibility dashboard (generates reports on demand)
 */

// ════════════════════════════════════════════════════════════════════════════════
// STEP 1: Import visibility middleware + services (add to index.ts imports)
// ════════════════════════════════════════════════════════════════════════════════

import exportRoutes from '../scripts/exportRoutes';
import { createRouteUsageLogger, exportRouteUsageAnalysis } from './middleware/routeUsageLogger';
import { externalAPITracker } from './services/externalAPITracker';
import { SystemVisibility } from './middleware/systemVisibility';
import { logger } from './utils/logger';

// ════════════════════════════════════════════════════════════════════════════════
// STEP 2: Mount route usage logging middleware (around line 225, after requestLogger)
// ════════════════════════════════════════════════════════════════════════════════

// Add this around line 225, right after app.use(requestLogger):

/*
// 📊 Route usage logging middleware - tracks every request
app.use(createRouteUsageLogger());

// Optional: Log external API tracker metrics periodically
setInterval(() => {
  const apiMetrics = externalAPITracker.analyze();
  if (apiMetrics.summary.totalCalls > 0) {
    logger.info('📊 API Metrics', {
      totalCalls: apiMetrics.summary.totalCalls,
      errorRate: `${apiMetrics.summary.errorRate.toFixed(2)}%`,
      callsPerMinute: apiMetrics.summary.callsPerMinute.toFixed(2),
    });
  }
}, 60000); // Every 60 seconds
*/

// ════════════════════════════════════════════════════════════════════════════════
// STEP 3: Instrument external API calls (in services that call CCXT, CoinGecko, etc)
// ════════════════════════════════════════════════════════════════════════════════

/*
EXAMPLE: In ohlcvService.ts

import { externalAPITracker } from './externalAPITracker';

async function fetchOHLCV(symbol, timeframe) {
  const start = Date.now();
  
  try {
    const data = await exchange.fetchOHLCV(symbol, timeframe);
    
    // Record successful call
    externalAPITracker.recordCall({
      timestamp: new Date().toISOString(),
      type: 'ccxt',
      service: 'binance',
      endpoint: `/fetchOHLCV`,
      method: 'GET',
      statusCode: 200,
      duration: Date.now() - start,
      dataSize: JSON.stringify(data).length,
    });
    
    return data;
    
  } catch (error) {
    // Record failed call
    externalAPITracker.recordCall({
      timestamp: new Date().toISOString(),
      type: 'ccxt',
      service: 'binance',
      endpoint: `/fetchOHLCV`,
      method: 'GET',
      duration: Date.now() - start,
      error: error.message,
    });
    
    throw error;
  }
}

EXAMPLE: In priceHistoryService.ts

import { externalAPITracker } from './externalAPITracker';

async function fetchCoinGeckoPrice(symbol) {
  const start = Date.now();
  
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}`);
    const data = await response.json();
    
    externalAPITracker.recordCall({
      timestamp: new Date().toISOString(),
      type: 'coingecko',
      service: 'coingecko',
      endpoint: `/simple/price`,
      method: 'GET',
      statusCode: response.status,
      duration: Date.now() - start,
      dataSize: JSON.stringify(data).length,
    });
    
    return data;
    
  } catch (error) {
    externalAPITracker.recordCall({
      timestamp: new Date().toISOString(),
      type: 'coingecko',
      service: 'coingecko',
      endpoint: `/simple/price`,
      method: 'GET',
      duration: Date.now() - start,
      error: error.message,
    });
    
    throw error;
  }
}
*/

// ════════════════════════════════════════════════════════════════════════════════
// STEP 4: Export route map on startup (add to startup sequence, around line 700)
// ════════════════════════════════════════════════════════════════════════════════

/*
// Add this around line 700, after all routes are registered:

// 📌 Export route structure for visibility
logger.info('📌 Exporting route structure...');
const routeExportResult = exportRoutes(app);
if (routeExportResult) {
  logger.info(`✅ Route map exported: ${routeExportResult.stats.totalEndpoints} endpoints found`);
}
*/

// ════════════════════════════════════════════════════════════════════════════════
// STEP 5: Create visibility report endpoint (optional, for on-demand analysis)
// ════════════════════════════════════════════════════════════════════════════════

/*
// Add this route to a new file: server/routes/visibility.ts

import { Router } from 'express';
import { SystemVisibility } from '../middleware/systemVisibility';
import { authenticate } from '../auth';

const router = Router();

// Protect endpoint - only superuser can generate reports
router.post('/report', authenticate, async (req, res) => {
  try {
    // Check if user is superuser
    const user = (req as any).user;
    if (user?.role !== 'superuser') {
      return res.status(403).json({ error: 'Only superusers can generate visibility reports' });
    }

    const visibility = new SystemVisibility(req.app);
    const report = visibility.generateAllReports();

    res.json({
      success: true,
      report,
      message: 'Visibility report generated. Check visibility-reports/ directory.',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to generate visibility report',
      message: error.message,
    });
  }
});

export default router;

// Then mount in index.ts:
// import visibilityRoutes from './routes/visibility';
// app.use('/api/visibility', visibilityRoutes);
*/

// ════════════════════════════════════════════════════════════════════════════════
// SUMMARY: What Gets Generated
// ════════════════════════════════════════════════════════════════════════════════

/*
After running the server with this integration, you'll get:

📁 visibility-reports/ (created automatically)
│
├─ routes-map.json              # All routes in JSON format
├─ routes-map.csv               # Routes in CSV (open in Excel!)
├─ routes-stats.json            # Route statistics
│
├─ route-usage.csv              # Every request logged (real traffic)
├─ route-usage-analysis.json    # Traffic analysis
├─ route-usage-top-paths.csv    # Most-called endpoints
├─ route-usage-slowest-paths.csv # Performance issues
│
├─ external-api-calls.csv       # Every external API call
├─ external-api-analysis.json   # API usage statistics
├─ external-api-by-type.csv     # Calls by type (CCXT, CoinGecko, etc)
├─ external-api-by-service.csv  # Calls by service (binance, ethereum, etc)
│
├─ visibility-report.json       # Full consolidated report
└─ VISIBILITY_REPORT.md         # Markdown summary

*/

// ════════════════════════════════════════════════════════════════════════════════
// WHAT YOU'LL DISCOVER
// ════════════════════════════════════════════════════════════════════════════════

/*
Open routes-map.csv in Excel, sort by DOMAIN:

Expected:
- /api/auth/* → ~15 endpoints
- /api/wallet/* → ~20 endpoints
- /api/vault/* → ~18 endpoints

But you might find:
- /api/markets/BTC → duplicate at /api/loadMarkets/BTC ⚠️
- /api/indicators → never called (routes-usage-top-paths.csv)
- /api/dex/swap → 2500ms average response time 🐢
- CCXT calls: 5,000/hour (!) when it should be 50/hour 🚨

This is how you find million-dollar bugs.
*/

// ════════════════════════════════════════════════════════════════════════════════
// NEXT STEPS
// ════════════════════════════════════════════════════════════════════════════════

/*
1. Add the imports (Step 1)
2. Mount the middleware (Step 2)
3. Instrument your services (Step 3) - start with ohlcvService, ccxtService
4. Export routes (Step 4)
5. Run server for 5-10 minutes with normal traffic
6. Call POST /api/visibility/report (if you created that endpoint)
7. Check visibility-reports/ directory
8. Open CSVs in Excel, look for:
   - Duplicate routes (same functionality, different paths)
   - Unused routes (in routes-map but not in usage logs)
   - Slow endpoints (slowest-paths.csv)
   - API abuse (high call frequency, high error rates)

This gives you the foundation to:
- Eliminate duplicate implementations
- Remove dead code
- Fix performance bottlenecks
- Optimize expensive API calls
*/

export {};
