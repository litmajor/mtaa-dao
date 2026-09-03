import { Router } from 'express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { CEXPriceBackgroundJob } from '../services/cexPriceBackgroundJob';
import { cacheManager } from '../core/consolidation/DataCacheConsolidation';

const SUPPORTED_EXCHANGES = ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx'] as const;
type SupportedExchange = (typeof SUPPORTED_EXCHANGES)[number];

const isSupportedExchange = (value: unknown): value is SupportedExchange =>
  typeof value === 'string' && SUPPORTED_EXCHANGES.includes(value as SupportedExchange);

/**
 * Higher-order function to eliminate boilerplate try-catch blocks
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error(`[CEXPriceRoutes] Error handling ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    });
  };

/**
 * Middleware to verify admin access
 */
const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const router = Router();

/**
 * GET /cache
 * Get cache statistics
 */
router.get('/cache', (_req: Request, res: Response) => {
  const cache = cacheManager.getCache('cex_prices');
  const stats = cache?.getMetrics() ?? null;

  return res.json({
    success: true,
    cache: stats,
    timestamp: Date.now(),
  });
});

/**
 * POST /cache/invalidate
 * Clear cache (with optional filtering)
 */
router.post('/cache/invalidate', requireAdmin, asyncHandler(async (req, res) => {
  const { exchange } = req.body;
  const cache = cacheManager.getCache('cex_prices');

  if (!cache) {
    return res.status(503).json({ error: 'Cache unavailable' });
  }

  if (exchange) {
    const cleared = await cache.invalidatePattern(`.*:${exchange}:.*`);
    return res.json({
      success: true,
      message: `Invalidated ${cleared} cache entries for ${exchange}`,
      timestamp: Date.now(),
    });
  }

  await cache.clear();
  return res.json({
    success: true,
    message: 'Invalidated entire cache',
    timestamp: Date.now(),
  });
}));

/**
 * POST /collect
 * Trigger manual price collection
 */
router.post('/collect', requireAdmin, asyncHandler(async (req, res) => {
  const { exchange, pairs } = req.body;
  const collector = CEXPriceBackgroundJob.getInstance().getCollector();

  if (exchange) {
    if (!isSupportedExchange(exchange)) {
      return res.status(400).json({
        error: 'Invalid exchange',
        supportedExchanges: SUPPORTED_EXCHANGES,
      });
    }

    const result = await collector.fetchExchangePrices(exchange, pairs);

    return res.json({
      success: result.success,
      result,
      timestamp: Date.now(),
    });
  }

  const results = await collector.fetchAllExchanges(pairs);

  return res.json({
    success: results.every((r) => r.success),
    results,
    summary: {
      totalExchanges: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    },
    timestamp: Date.now(),
  });
}));

/**
 * GET /health
 * Get health status of collector
 */
router.get('/health', (_req: Request, res: Response) => {
  const job = CEXPriceBackgroundJob.getInstance();
  const collector = job.getCollector();

  return res.json({
    success: true,
    health: collector.getHealthStatus(),
    jobRunning: job.getStats().isRunning,
    timestamp: Date.now(),
  });
});

/**
 * GET /stats
 * Get collection statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  const job = CEXPriceBackgroundJob.getInstance();
  const collector = job.getCollector();

  return res.json({
    success: true,
    jobStats: job.getStats(),
    collectionStats: collector.getCollectionStats(),
    timestamp: Date.now(),
  });
});

/**
 * GET /
 * Get current prices (from cache or database)
 */
router.get('/', asyncHandler(async (req, res) => {
  const { pair, exchange, useCache = 'true' } = req.query;

  if (typeof pair !== 'string' || !pair.trim()) {
    return res.status(400).json({
      error: 'Missing or invalid required parameter: pair',
      example: '/api/cex/prices?pair=BTC/USDT',
    });
  }

  const collector = CEXPriceBackgroundJob.getInstance().getCollector();
  const shouldUseCache = useCache !== 'false';

  if (typeof exchange === 'string' && exchange.trim()) {
    const price = await collector.getPrice(exchange, pair, shouldUseCache);

    return res.json({
      success: price !== null,
      data: price ?? { error: 'Price not found' },
      fromCache: shouldUseCache,
      timestamp: Date.now(),
    });
  }

  const prices = await collector.getPairPrices(pair);

  return res.json({
    success: prices.size > 0,
    pair,
    exchangeCount: prices.size,
    data: Object.fromEntries(prices),
    fromCache: shouldUseCache,
    timestamp: Date.now(),
  });
}));

export default router;