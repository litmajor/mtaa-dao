/**
 * Market Discovery Bootstrap & Integration
 * 
 * This file shows how to initialize and integrate the market discovery system
 * into your Express app at startup.
 * 
 * Add this to your main server.ts or app initialization file:
 */

// ============= INITIALIZATION EXAMPLE =============

// In server.ts or wherever you initialize Express:

import express from 'express';
import { logger } from './utils/logger';
import { automaticPhaseManager } from './services/automaticPhaseManager';
import { marketDiscoveryScannerService } from './services/marketDiscoveryScannerService';
import marketDiscoveryRouter from './routes/marketDiscovery';

// Create Express app
const app = express();

// ... other middleware ...

// ============= 1. REGISTER MARKET DISCOVERY ROUTES =============

// Add these routes to your Express app
app.use(marketDiscoveryRouter);

// ============= 2. INITIALIZE MARKET DISCOVERY =============

// Start market discovery when app starts
async function initializeMarketDiscovery(): Promise<void> {
  try {
    logger.info('🚀 Initializing Market Discovery System...');

    // Initialize automatic phase manager
    await automaticPhaseManager.initialize();

    // Setup event listeners for progress tracking
    marketDiscoveryScannerService.on('progress', (event: any) => {
      logger.debug(`Discovery progress: Phase ${event.phase} - ${event.percentage}% complete`);
    });

    marketDiscoveryScannerService.on('scan-completed', (event: any) => {
      logger.info(`✅ Discovery scan completed: ${event.totalPairs} pairs in ${event.durationMs}ms`);
    });

    marketDiscoveryScannerService.on('scan-failed', (event: any) => {
      logger.error(`❌ Discovery scan failed: ${event.error}`);
    });

    logger.info('✅ Market Discovery System initialized successfully');
  } catch (error: any) {
    logger.error('❌ Failed to initialize Market Discovery:', error.message);
    process.exit(1);
  }
}

// Call initialization when app starts
initializeMarketDiscovery().catch(error => {
  logger.error('Fatal error during initialization:', error);
  process.exit(1);
});

// ============= 3. EXAMPLE API ENDPOINTS =============

/**
 * Usage Examples:
 * 
 * 1. Check overall discovery status:
 *    GET /api/admin/market-discovery/status
 * 
 * 2. Get Phase 1 progress:
 *    GET /api/admin/market-discovery/phase/1
 * 
 * 3. Manually trigger a scan:
 *    POST /api/admin/market-discovery/scan/manual
 * 
 * 4. Trigger Phase 2 scan:
 *    POST /api/admin/market-discovery/scan/phase/2
 * 
 * 5. Check current scan status:
 *    GET /api/admin/market-discovery/current-scan
 * 
 * 6. View pair cache status:
 *    GET /api/admin/market-discovery/cache-status
 *    GET /api/admin/market-discovery/cache-status?exchange=binance
 * 
 * 7. Clear pair cache:
 *    DELETE /api/admin/market-discovery/cache
 *    DELETE /api/admin/market-discovery/cache?exchange=binance
 * 
 * 8. Jump to Phase 2 (admin override):
 *    POST /api/admin/market-discovery/phase/jump
 *    Body: { "targetPhase": 2 }
 * 
 * 9. Complete refresh (clears cache, restarts Phase 1):
 *    POST /api/admin/market-discovery/refresh-all
 */

// ============= 4. ADMIN DASHBOARD BUTTON LOCATIONS =============

/**
 * Suggested locations for admin dashboard buttons:
 * 
 * Dashboard Section: Market Discovery Status
 * ├─ Status Card
 * │  ├─ Current Phase badge
 * │  ├─ Total Pairs discovered
 * │  ├─ Last scan timestamp
 * │  └─ Next scheduled scan
 * │
 * ├─ Action Buttons
 * │  ├─ [Scan Now] → POST /api/admin/market-discovery/scan/manual
 * │  ├─ [View Details] → GET /api/admin/market-discovery/status
 * │  └─ [Phase Jump] → Modal → POST /api/admin/market-discovery/phase/jump
 * │
 * └─ Advanced Options (Collapsible)
 *    ├─ Phase 1 Status (GET /api/admin/market-discovery/phase/1)
 *    ├─ Phase 2 Status (GET /api/admin/market-discovery/phase/2)
 *    │  └─ [Enable Phase 2] → POST /api/admin/market-discovery/scan/phase/2
 *    ├─ Phase 3 Status (GET /api/admin/market-discovery/phase/3)
 *    │  └─ [Enable Phase 3] → POST /api/admin/market-discovery/scan/phase/3
 *    ├─ Pair Cache Status (GET /api/admin/market-discovery/cache-status)
 *    │  └─ [Clear Cache] → DELETE /api/admin/market-discovery/cache
 *    ├─ Scan History (GET /api/admin/market-discovery/scan-history?limit=10)
 *    └─ [Refresh All] → POST /api/admin/market-discovery/refresh-all
 */

// ============= 5. WORKFLOW DIAGRAM =============

/**
 * Automatic Progression Flow:
 * 
 * App Starts
 *      ↓
 * Initialize Phase Manager
 *      ↓
 * Load Phase 1 (100 pairs/exchange)
 *      ↓
 * [Emit: phase-start event]
 *      ↓
 * Scanner: Discover pairs from all exchanges
 * (Uses cache if available)
 *      ↓
 * [Emit: progress events for each exchange]
 *      ↓
 * Phase 1 completes
 *      ↓
 * [Emit: phase-completed event]
 *      ↓
 * Wait 24 hours
 *      ↓
 * Auto-progress to Phase 2
 *      ↓
 * [Repeat: phase-start → discovery → completion]
 *      ↓
 * Wait 7 days
 *      ↓
 * Auto-progress to Phase 3
 *      ↓
 * Full market coverage (2000+ pairs)
 * 
 * 
 * Manual Override Flow:
 * 
 * Admin clicks [Scan Now]
 *      ↓
 * POST /api/admin/market-discovery/scan/manual
 *      ↓
 * Trigger manual scan at current phase
 *      ↓
 * Scanner discovers pairs immediately
 *      ↓
 * UI updates with progress (via WebSocket or polling)
 *      ↓
 * Scan completes
 *      ↓
 * [Emit: scan-completed event]
 */

// ============= 6. FRONTEND INTEGRATION EXAMPLE (React/Vue) =============

/**
 * Example React Hook for Admin Dashboard:
 * 
 * function MarketDiscoveryStatus() {
 *   const [status, setStatus] = useState(null);
 *   const [scanning, setScanning] = useState(false);
 *   
 *   // Fetch status on mount
 *   useEffect(() => {
 *     fetchStatus();
 *     const interval = setInterval(fetchStatus, 3000); // Poll every 3s
 *     return () => clearInterval(interval);
 *   }, []);
 *   
 *   const fetchStatus = async () => {
 *     const res = await fetch('/api/admin/market-discovery/status');
 *     const data = await res.json();
 *     setStatus(data.data);
 *   };
 *   
 *   const triggerScan = async () => {
 *     setScanning(true);
 *     const res = await fetch('/api/admin/market-discovery/scan/manual', {
 *       method: 'POST'
 *     });
 *     const data = await res.json();
 *     toast.success(`Scan started, ETA: ${data.data.durationMinutes} minutes`);
 *     setScanning(false);
 *   };
 *   
 *   return (
 *     <Card title="Market Discovery">
 *       <Status>Phase {status?.phaseManager.currentPhase}</Status>
 *       <Button onClick={triggerScan} disabled={scanning}>
 *         {scanning ? 'Scanning...' : 'Scan Now'}
 *       </Button>
 *       <Progress value={status?.currentScan?.progressPercentage} />
 *       <Details>{/* Display status details */}</Details>
 *     </Card>
 *   );
 * }
 */

// ============= 7. CONFIGURATION TUNING =============

/**
 * To adjust automatic progression and scanning behavior:
 * 
 * File: server/services/automaticPhaseManager.ts
 * 
 * Modify PHASE_CONFIGS:
 * 
 * Phase 1:
 *   - autoProgressAfterMs: Change from 24h to other duration
 *   - pairsPerExchange: Change from 100 to fewer/more
 *   - parallelExchanges: Change from 3 to 1/2/4 (faster/slower)
 * 
 * Phase 2:
 *   - Set enabled: true to enable auto-progression
 *   - Adjust pairsPerExchange: 500 (current) or adjust
 * 
 * Phase 3:
 *   - Set enabled: true to enable full market coverage
 *   - Set autoProgressAfterMs: 0 to stop progression at Phase 3
 * 
 * Cache Configuration (efficientPairDiscoveryService.ts):
 *   - phase1ExpirationMs: 6h (how long before refetching Phase 1 pairs)
 *   - phase2ExpirationMs: 12h
 *   - phase3ExpirationMs: 24h (stable, refetch once daily)
 */

export {};
