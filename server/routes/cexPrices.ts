/**
 * CEX Price Collection Routes
 * Endpoints for price collection, caching, and monitoring
 * 
 * Endpoints:
 * - GET /api/cex/prices/cache - Get cache statistics
 * - POST /api/cex/prices/cache/invalidate - Clear cache
 * - POST /api/cex/prices/collect - Trigger manual collection
 * - GET /api/cex/prices/health - Health status
 * - GET /api/cex/prices/stats - Collection statistics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { CEXPriceBackgroundJob } from '../services/cexPriceBackgroundJob';
import { cacheManager } from '../core/consolidation/DataCacheConsolidation';

const router = Router();

/**
 * Middleware to verify admin access
 */
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // In real implementation, verify user is admin
  // For now, just check if user exists
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * GET /api/cex/prices/cache
 * Get cache statistics
 */
router.get('/cache', (req: Request, res: Response) => {
  try {
    const cache = cacheManager.getCache('cex_prices');
    const stats = cache?.getMetrics();

    res.json({
      success: true,
      cache: stats,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[CEXPriceRoutes] Error getting cache stats:', error);
    res.status(500).json({
      error: 'Failed to get cache statistics',
    });
  }
});

/**
 * POST /api/cex/prices/cache/invalidate
 * Clear cache (with optional filtering)
 */
router.post('/cache/invalidate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { exchange } = req.body;
    const cache = cacheManager.getCache('cex_prices');

    let cleared = 0;
    if (exchange && cache) {
      // Clear specific exchange
      cleared = await cache.invalidatePattern(`.*:${exchange}:.*`);
      res.json({
        success: true,
        message: `Invalidated ${cleared} cache entries for ${exchange}`,
        timestamp: Date.now(),
      });
    } else if (cache) {
      // Clear all
      await cache.clear();
      res.json({
        success: true,
        message: 'Invalidated entire cache',
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error('[CEXPriceRoutes] Error invalidating cache:', error);
    res.status(500).json({
      error: 'Failed to invalidate cache',
    });
  }
});

/**
 * POST /api/cex/prices/collect
 * Trigger manual price collection
 */
router.post('/collect', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { exchange, pairs } = req.body;
    const job = CEXPriceBackgroundJob.getInstance();
    const collector = job.getCollector();

    if (exchange) {
      // Collect specific exchange
      if (!['binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx'].includes(exchange)) {
        return res.status(400).json({
          error: 'Invalid exchange',
          supportedExchanges: ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx'],
        });
      }

      const result = await collector.fetchExchangePrices(
        exchange as any,
        pairs
      );

      res.json({
        success: result.success,
        result,
        timestamp: Date.now(),
      });
    } else {
      // Collect all exchanges
      const results = await collector.fetchAllExchanges(pairs);

      res.json({
        success: results.every(r => r.success),
        results,
        summary: {
          totalExchanges: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        },
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error('[CEXPriceRoutes] Error triggering collection:', error);
    res.status(500).json({
      error: 'Failed to trigger price collection',
    });
  }
});

/**
 * GET /api/cex/prices/health
 * Get health status of collector
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const job = CEXPriceBackgroundJob.getInstance();
    const collector = job.getCollector();

    const health = collector.getHealthStatus();

    res.json({
      success: true,
      health,
      jobRunning: job.getStats().isRunning,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[CEXPriceRoutes] Error getting health:', error);
    res.status(500).json({
      error: 'Failed to get health status',
    });
  }
});

/**
 * GET /api/cex/prices/stats
 * Get collection statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const job = CEXPriceBackgroundJob.getInstance();
    const collector = job.getCollector();

    const jobStats = job.getStats();
    const collectionStats = collector.getCollectionStats();

    res.json({
      success: true,
      jobStats,
      collectionStats,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[CEXPriceRoutes] Error getting stats:', error);
    res.status(500).json({
      error: 'Failed to get collection statistics',
    });
  }
});

/**
 * GET /api/cex/prices
 * Get current prices (from cache or database)
 * Query params:
 * - pair: Trading pair (e.g., BTC/USDT)
 * - exchange: Specific exchange (optional)
 * - useCache: Use cache if available (default: true)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { pair, exchange, useCache = 'true' } = req.query;

    if (!pair || typeof pair !== 'string') {
      return res.status(400).json({
        error: 'Missing required parameter: pair',
        example: '/api/cex/prices?pair=BTC/USDT',
      });
    }

    const job = CEXPriceBackgroundJob.getInstance();
    const collector = job.getCollector();
    const shouldUseCache = useCache !== 'false';

    if (exchange && typeof exchange === 'string') {
      // Get price from specific exchange
      const price = await collector.getPrice(exchange, pair, shouldUseCache);

      res.json({
        success: price !== null,
        data: price || { error: 'Price not found' },
        fromCache: shouldUseCache,
        timestamp: Date.now(),
      });
    } else {
      // Get prices from all exchanges
      const prices = await collector.getPairPrices(pair);

      res.json({
        success: prices.size > 0,
        pair,
        exchangeCount: prices.size,
        data: Object.fromEntries(prices),
        fromCache: shouldUseCache,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error('[CEXPriceRoutes] Error getting prices:', error);
    res.status(500).json({
      error: 'Failed to get prices',
    });
  }
});

export default router;
