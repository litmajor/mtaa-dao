/**
 * Market Discovery Scanner
 * 
 * Implements the complete market discovery workflow:
 * 1. Listens to phase manager events
 * 2. Discovers pairs using efficient discovery service
 * 3. Discovers DEX tokens
 * 4. Reports progress and completion
 * 5. Triggers auto-progression
 */

import { automaticPhaseManager } from './automaticPhaseManager';
import { efficientPairDiscoveryService } from './efficientPairDiscoveryService';
import { dexAssetDiscoveryService } from './dexAssetDiscoveryService';
import { symbolUniverseService } from './symbolUniverseService';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface ScanSession {
  id: string;
  phase: number;
  status: 'queued' | 'in-progress' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  totalPairs: number;
  exchangesCompleted: number;
  totalExchanges: number;
  error?: string;
  results?: any[];
}

class MarketDiscoveryScannerService extends EventEmitter {
  private activeScan: ScanSession | null = null;
  private scanHistory: Map<string, ScanSession> = new Map();
  private readonly EXCHANGES = ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx'];

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Setup event listeners from phase manager
   */
  private setupEventListeners(): void {
    // When a phase should start
    automaticPhaseManager.on('phase-start', async (event: any) => {
      try {
        await this.startPhaseScanning(event.phase);
      } catch (error: any) {
        logger.error('Phase start failed:', error.message);
      }
    });

    // When manual scan requested
    automaticPhaseManager.on('manual-scan-request', async (event: any) => {
      try {
        await this.startPhaseScanning(event.phase);
      } catch (error: any) {
        logger.error('Manual scan failed:', error.message);
      }
    });

    // When specific phase scan requested
    automaticPhaseManager.on('phase-scan-request', async (event: any) => {
      try {
        await this.startPhaseScanning(event.phase);
      } catch (error: any) {
        logger.error('Phase scan request failed:', error.message);
      }
    });

    logger.info('✅ Market Discovery Scanner event listeners configured');
  }

  /**
   * Start scanning a phase
   * Discovers pairs, integrates with Asset Graph, reports completion
   */
  private async startPhaseScanning(phase: number): Promise<void> {
    // Abort if already scanning
    if (this.activeScan && this.activeScan.status === 'in-progress') {
      logger.warn(
        `Scan already in progress for Phase ${this.activeScan.phase}, aborting new request`
      );
      return;
    }

    const sessionId = `scan-${phase}-${Date.now()}`;
    const startTime = Date.now();

    // Create scan session
    const session: ScanSession = {
      id: sessionId,
      phase,
      status: 'in-progress',
      startedAt: startTime,
      totalPairs: 0,
      exchangesCompleted: 0,
      totalExchanges: this.EXCHANGES.length,
      results: []
    };

    this.activeScan = session;
    this.scanHistory.set(sessionId, session);

    logger.info(`
🔍 Starting Market Discovery Scan
   ├─ Session: ${sessionId}
   ├─ Phase: ${phase}
   ├─ Exchanges: ${this.EXCHANGES.length}
   └─ Started: ${new Date(startTime).toLocaleTimeString()}
    `);

    try {
      // Discover pairs from all exchanges
      const results = await efficientPairDiscoveryService.discoverAllExchanges(
        this.EXCHANGES,
        phase,
        (completed, total) => {
          // Update progress
          session.exchangesCompleted = completed;
          automaticPhaseManager.reportProgress(phase, completed, total);

          // Emit progress
          this.emit('progress', {
            phase,
            completed,
            total,
            percentage: Math.round((completed / total) * 100)
          });
        }
      );

      // Update session
      session.results = results;
      session.totalPairs = results.reduce((sum, r) => sum + r.totalPairs, 0);
      session.exchangesCompleted = results.length;

      logger.info(`
📊 Pair discovery results for Phase ${phase}:
       `);

      let newPairsTotal = 0;
      let removedPairsTotal = 0;

      for (const result of results) {
        logger.info(`
   ${result.exchange.toUpperCase()}:
   ├─ Pairs: ${result.totalPairs}
   ├─ New: ${result.newPairs.length}
   ├─ Removed: ${result.removedPairs.length}
   ├─ Cache Hit: ${result.cacheHit ? 'Yes' : 'No'}
   └─ Time: ${result.durationMs}ms
        `);

        newPairsTotal += result.newPairs.length;
        removedPairsTotal += result.removedPairs.length;
      }

      logger.info(`
✅ Phase ${phase} Summary:
   ├─ Total Pairs: ${session.totalPairs}
   ├─ New Pairs Today: ${newPairsTotal}
   ├─ Removed Pairs: ${removedPairsTotal}
   ├─ Duration: ${Math.round((Date.now() - startTime) / 1000)}s
   └─ Cache Efficiency: ${results.filter(r => r.cacheHit).length}/${results.length} hits
      `);

      // Discover and integrate DEX tokens
      logger.info(`
🔄 Discovering DEX tokens for Phase ${phase}...
      `);

      try {
        const dexStartTime = Date.now();
        const dexAssets = await dexAssetDiscoveryService.discoverAllDexAssets();
        
        logger.info(`
📊 DEX Asset Discovery Results:
   ├─ Total DEX Tokens: ${dexAssets.length}
   ├─ Duration: ${Math.round((Date.now() - dexStartTime) / 1000)}s
   └─ Syncing to Asset Graph...
        `);

        // Sync DEX assets to asset graph
        await dexAssetDiscoveryService.syncDexAssetsToAssetGraph();

        logger.info(`
✅ DEX Assets Synced to Asset Graph
   ├─ Tokens integrated: ${dexAssets.length}
   ├─ Total Market Discovery Assets: ${session.totalPairs + dexAssets.length}
   └─ Status: Ready for Phase ${phase} analysis
        `);
      } catch (dexError: any) {
        logger.warn(
          `⚠️  DEX discovery issue (non-blocking): ${dexError.message}`
        );
        // Continue with phase completion - DEX failure doesn't block CEX phase
      }

      // Mark as completed
      session.status = 'completed';
      session.completedAt = Date.now();

      // Notify phase manager of completion
      await automaticPhaseManager.onPhaseCompleted(phase, session.totalPairs);

      // Emit completion
      this.emit('scan-completed', {
        phase,
        sessionId,
        totalPairs: session.totalPairs,
        duration: Date.now() - startTime,
        results
      });
    } catch (error: any) {
      logger.error(`❌ Phase ${phase} scanning failed:`, error.message);

      session.status = 'failed';
      session.error = error.message;
      session.completedAt = Date.now();

      automaticPhaseManager.reportError(phase, error.message);

      this.emit('scan-failed', {
        phase,
        sessionId,
        error: error.message
      });

      throw error;
    } finally {
      // Clear active scan
      if (this.activeScan?.id === sessionId) {
        this.activeScan = null;
      }
    }
  }

  /**
   * Get current scan status
   */
  getCurrentScan(): ScanSession | null {
    return this.activeScan;
  }

  /**
   * Get scan history
   */
  getScanHistory(limit: number = 10): ScanSession[] {
    return Array.from(this.scanHistory.values())
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, limit);
  }

  /**
   * Get cached pair status for all exchanges
   */
  getPairCacheStatus() {
    return efficientPairDiscoveryService.getCacheStatus();
  }

  /**
   * Manually clear pair cache (for reset)
   */
  clearPairCache(exchange?: string): void {
    efficientPairDiscoveryService.clearCache(exchange);
    logger.info(
      exchange ? `Cleared cache for ${exchange}` : 'Cleared all pair caches'
    );
  }

  /**
   * Get discovery dashboard
   */
  getDashboard() {
    return {
      phaseManager: automaticPhaseManager.getDashboard(),
      currentScan: this.activeScan,
      recentScans: this.getScanHistory(5),
      pairCacheStatus: this.getPairCacheStatus()
    };
  }
}

export const marketDiscoveryScannerService = new MarketDiscoveryScannerService();
