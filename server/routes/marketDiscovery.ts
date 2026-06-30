/**
 * Market Discovery Routes
 * 
 * Admin endpoints for:
 * - Viewing phase progress
 * - Manually triggering scans
 * - Viewing pair cache status
 * - Admin controls (jump phase, clear cache)
 */

import express, { Router, Request, Response } from 'express';
import { isAuthenticated } from '../auth';
import { requireRole } from '../middleware/rbac';
import { automaticPhaseManager } from '../services/automaticPhaseManager';
import { marketDiscoveryScannerService } from '../services/marketDiscoveryScannerService';
import { efficientPairDiscoveryService } from '../services/efficientPairDiscoveryService';
import { dexAssetDiscoveryService } from '../services/dexAssetDiscoveryService';
import { logger } from '../utils/logger';

const router = Router();

// All market discovery endpoints require super_admin authentication
router.use(isAuthenticated, requireRole('super_admin'));

/**
 * GET /api/admin/market-discovery/status
 * Get overall market discovery status
 */
router.get('/api/admin/market-discovery/status', async (req: Request, res: Response) => {
  try {
    const dashboard = marketDiscoveryScannerService.getDashboard();
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error: any) {
    logger.error('Failed to get market discovery status:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/market-discovery/phase/:phase
 * Get progress for a specific phase
 */
router.get(
  '/api/admin/market-discovery/phase/:phase',
  async (req: Request, res: Response) => {
    try {
      const phase = parseInt(req.params.phase);
      if (phase < 1 || phase > 3) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phase: must be 1, 2, or 3'
        });
      }

      const progress = automaticPhaseManager.getPhaseProgress(phase);
      const config = automaticPhaseManager.getPhaseConfig(phase);

      res.json({
        success: true,
        data: {
          phase,
          config,
          progress
        }
      });
    } catch (error: any) {
      logger.error(`Failed to get phase ${req.params.phase} status:`, error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/admin/market-discovery/scan/manual
 * Manually trigger a scan at current phase
 * 
 * Response: { phase, estimatedDurationMs, estimatedCompletionTime }
 */
router.post('/api/admin/market-discovery/scan/manual', async (req: Request, res: Response) => {
  try {
    logger.info('👤 Admin requested manual discovery scan');

    const result = await automaticPhaseManager.triggerManualScan();

    res.json({
      success: true,
      message: 'Manual scan triggered',
      data: {
        ...result,
        currentTime: new Date(),
        estimatedCompletionTime: new Date(
          Date.now() + result.estimatedDurationMs
        ),
        durationMinutes: Math.round(result.estimatedDurationMs / 60000)
      }
    });
  } catch (error: any) {
    logger.error('Manual scan trigger failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/market-discovery/scan/phase/:phase
 * Manually trigger a scan for specific phase
 */
router.post(
  '/api/admin/market-discovery/scan/phase/:phase',
  async (req: Request, res: Response) => {
    try {
      const phase = parseInt(req.params.phase);
      if (phase < 1 || phase > 3) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phase: must be 1, 2, or 3'
        });
      }

      logger.info(`👤 Admin requested Phase ${phase} scan`);

      const result = await automaticPhaseManager.triggerPhaseScanning(phase);

      res.json({
        success: true,
        message: `Phase ${phase} scan triggered`,
        data: {
          ...result,
          currentTime: new Date(),
          estimatedCompletionTime: new Date(
            Date.now() + result.estimatedDurationMs
          ),
          durationMinutes: Math.round(result.estimatedDurationMs / 60000)
        }
      });
    } catch (error: any) {
      logger.error(`Phase ${req.params.phase} scan trigger failed:`, error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/admin/market-discovery/current-scan
 * Get current scan status in real-time
 */
router.get('/api/admin/market-discovery/current-scan', async (req: Request, res: Response) => {
  try {
    const scan = marketDiscoveryScannerService.getCurrentScan();

    if (!scan) {
      return res.json({
        success: true,
        data: null,
        message: 'No scan in progress'
      });
    }

    const progress = scan.exchangesCompleted / scan.totalExchanges;

    res.json({
      success: true,
      data: {
        ...scan,
        progressPercentage: Math.round(progress * 100),
        elapsedSeconds: scan.startedAt ? Math.round((Date.now() - scan.startedAt) / 1000) : 0
      }
    });
  } catch (error: any) {
    logger.error('Failed to get current scan:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/market-discovery/scan-history
 * Get recent scan history
 */
router.get('/api/admin/market-discovery/scan-history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const history = marketDiscoveryScannerService.getScanHistory(limit);

    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    logger.error('Failed to get scan history:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/market-discovery/cache-status
 * Get pair discovery cache status
 */
router.get('/api/admin/market-discovery/cache-status', async (req: Request, res: Response) => {
  try {
    const exchange = req.query.exchange as string | undefined;
    const status = exchange
      ? efficientPairDiscoveryService.getCacheStatus(exchange)
      : efficientPairDiscoveryService.getCacheStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    logger.error('Failed to get cache status:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/market-discovery/cache
 * Clear pair discovery cache
 * 
 * Query params:
 *   - exchange: Clear specific exchange (optional)
 */
router.delete('/api/admin/market-discovery/cache', async (req: Request, res: Response) => {
  try {
    const exchange = req.query.exchange as string | undefined;

    marketDiscoveryScannerService.clearPairCache(exchange);

    logger.info(
      `🗑️ Cache cleared${exchange ? ` for ${exchange}` : ' (all exchanges)'}`
    );

    res.json({
      success: true,
      message: exchange
        ? `Cache cleared for ${exchange}`
        : 'All pair caches cleared',
      data: {
        clearedAt: new Date()
      }
    });
  } catch (error: any) {
    logger.error('Failed to clear cache:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/market-discovery/phase/jump
 * Jump to a specific phase (admin override)
 * 
 * Body: { targetPhase: 1|2|3 }
 */
router.post('/api/admin/market-discovery/phase/jump', async (req: Request, res: Response) => {
  try {
    const { targetPhase } = req.body;

    if (!targetPhase || targetPhase < 1 || targetPhase > 3) {
      return res.status(400).json({
        success: false,
        error: 'Invalid targetPhase: must be 1, 2, or 3'
      });
    }

    logger.warn(`⚠️ Admin override: jumping to Phase ${targetPhase}`);

    await automaticPhaseManager.jumpToPhase(targetPhase);

    res.json({
      success: true,
      message: `Jumped to Phase ${targetPhase}`,
      data: {
        phase: targetPhase,
        jumpedAt: new Date()
      }
    });
  } catch (error: any) {
    logger.error(`Failed to jump to phase:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/market-discovery/refresh-all
 * Force refresh all caches and restart Phase 1
 * Use with caution - bypasses all optimization
 */
router.post('/api/admin/market-discovery/refresh-all', async (req: Request, res: Response) => {
  try {
    logger.warn('⚠️ Admin requested complete refresh - clearing all caches');

    // Clear cache
    marketDiscoveryScannerService.clearPairCache();

    // Jump to Phase 1
    await automaticPhaseManager.jumpToPhase(1);

    res.json({
      success: true,
      message: 'Complete refresh triggered',
      data: {
        refreshedAt: new Date(),
        nextPhase: 1
      }
    });
  } catch (error: any) {
    logger.error('Complete refresh failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/market-discovery/dex/status
 * Get DEX asset discovery status and cache info
 */
router.get('/api/admin/market-discovery/dex/status', async (req: Request, res: Response) => {
  try {
    const cacheStatus = dexAssetDiscoveryService.getCacheStatus();
    
    res.json({
      success: true,
      data: {
        cacheStatus,
        message: 'DEX cache status retrieved'
      }
    });
  } catch (error: any) {
    logger.error('Failed to get DEX cache status:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/market-discovery/dex/discover
 * Manually trigger DEX asset discovery and sync to Asset Graph
 */
router.post('/api/admin/market-discovery/dex/discover', async (req: Request, res: Response) => {
  try {
    logger.info('🔍 Admin triggered DEX asset discovery');
    
    const startTime = Date.now();
    const results = await dexAssetDiscoveryService.discoverAllDexAssets();
    
    // Sync discovered assets to Asset Graph
    await dexAssetDiscoveryService.syncDexAssetsToAssetGraph();
    
    const totalAssets = results.reduce((sum, r) => sum + r.totalDiscovered, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newAssets.length, 0);
    
    res.json({
      success: true,
      data: {
        discoveryDurationMs: Date.now() - startTime,
        totalAssets,
        newAssets: totalNew,
        dexResults: results.map(r => ({
          dex: r.dex,
          chain: r.chain,
          assets: r.totalDiscovered,
          newAssets: r.newAssets.length,
          duration: r.durationMs
        })),
        message: `Discovered ${totalAssets} DEX assets, ${totalNew} new`
      }
    });
  } catch (error: any) {
    logger.error('DEX discovery failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/market-discovery/dex/cache
 * Clear DEX token caches (optionally for specific DEX)
 */
router.delete('/api/admin/market-discovery/dex/cache', async (req: Request, res: Response) => {
  try {
    const { dex } = req.query;
    
    if (dex && typeof dex === 'string') {
      dexAssetDiscoveryService.clearCache(dex);
      logger.info(`Cleared DEX cache for ${dex}`);
      
      res.json({
        success: true,
        message: `Cache cleared for DEX: ${dex}`
      });
    } else {
      dexAssetDiscoveryService.clearCache();
      logger.info('Cleared all DEX caches');
      
      res.json({
        success: true,
        message: 'All DEX caches cleared'
      });
    }
  } catch (error: any) {
    logger.error('Failed to clear DEX cache:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
