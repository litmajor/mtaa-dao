/**
 * ❌ DEPRECATED - This file is no longer used
 * 
 * The DexScreener and Freqtrade APIs have been **integrated directly**
 * into the main Express app and run on **port 5000** with everything else.
 * 
 * ✅ NEW LOCATION:
 * - DexScreener API: server/api/dex-screener.ts
 *   Routes: server/routes/dex-screener.ts
 *   Mounted at: app.use('/api/dex', dexScreenerRoutes)
 * 
 * - Freqtrade API: server/api/freqtrade.ts
 *   Routes: server/routes/freqtrade.ts
 *   Mounted at: app.use('/api/freqtrade', freqtradeRoutes)
 * 
 * - Main App: server/index.ts (line ~643)
 * 
 * ✅ STARTUP:
 * Just run: npm run dev
 * 
 * Everything (frontend, backend, APIs) runs on port 5000
 * in a single Express process. No separate backend server needed!
 */
