import { Router, Request, Response } from 'express';
import { cacheManager } from '../../../core/consolidation/DataCacheConsolidation';
import { authenticate } from '../../../auth';
import advancedModeGuard from '../../../middleware/advancedModeGuard';
import { logger } from '../../../utils/logger';
import ccxtService from '../../../services/ccxtService';

const router = Router();

// Local type for cached price payloads
interface CachedPrices {
  exchanges?: Array<any>;
}

// Instantiate the exchange cache from the shared cache manager
const exchangeCache = cacheManager.getCache('exchange_data');

function clampLimit(input: any, defaultVal = 30, maxVal = 500) {
  const n = parseInt(String(input || ''), 10);
  if (Number.isNaN(n) || n <= 0) return defaultVal;
  return Math.min(n, maxVal);
}

/**
 * GET /v1/yuki/exchanges/available
 * Returns the exchange ids supported by the platform
 */
router.get('/exchanges/available', authenticate, async (_req: Request, res: Response) => {
  try {
    // Prefer authoritative source from CCXT service
    const exchanges = (typeof ccxtService.getAvailableExchanges === 'function')
      ? ccxtService.getAvailableExchanges()
      : ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'];

    return res.json({ success: true, data: exchanges });
  } catch (error: any) {
    logger.error('[YUKI] Failed to fetch available exchanges', { error });
    return res.status(500).json({ success: false, error: 'Failed to list exchanges' });
  }
});

/**
 * GET /v1/yuki/exchanges
 * Aggregated exchange prices with optional filtering
 */
router.get('/exchanges', authenticate, async (req: Request, res: Response) => {
  try {
    const pair = (req.query.pair as string) || 'ETH/USDT';
    const limit = clampLimit(req.query.limit, 30, 500);
    const sortBy = (req.query.sortBy as string) || 'price';
    const regionsQuery = (req.query.regions as string) || '';

    const key = `prices:${pair}:${limit}`;
    const cached = await exchangeCache?.get(key);
    let data = (cached ?? { exchanges: [] });

    // Clone before mutating to avoid corrupting cached object
    data = { ...data, exchanges: Array.isArray(data.exchanges) ? [...data.exchanges] : [] };

    // Apply region filter
    if (regionsQuery) {
      const regionList = regionsQuery.split(',').map((r) => r.trim());
      data.exchanges = data.exchanges.filter((e: any) => regionList.includes(e.region));
    }

    // Apply sort - try ranked cache first
    if (sortBy) {
      const rankedKey = `ranked:${pair}:${sortBy}`;
      const ranked = await exchangeCache?.get(rankedKey);
      if (Array.isArray(ranked) && ranked.length > 0) {
        data.exchanges = ranked.slice(0, limit);
      } else if (Array.isArray(data.exchanges) && data.exchanges.length > 0) {
        // fallback generic sort
        data.exchanges = data.exchanges.sort((a: any, b: any) => {
          if (sortBy === 'volume') return (b.volume || 0) - (a.volume || 0);
          if (sortBy === 'liquidity') return (b.liquidity || 0) - (a.liquidity || 0);
          if (sortBy === 'fees') return (a.fees || 0) - (b.fees || 0);
          if (sortBy === 'uptime') return (b.uptime || 0) - (a.uptime || 0);
          // default price: highest liquidity/price
          return (b.price || 0) - (a.price || 0);
        }).slice(0, limit);
      }
    }

    return res.json({ success: true, data, cached: Boolean(cached), timestamp: Date.now() });
  } catch (error: any) {
    logger.error('[YUKI] /exchanges failed', { error });
    return res.status(500).json({ success: false, error: 'Failed to fetch exchange data' });
  }
});

/**
 * GET /v1/yuki/exchanges/ranked
 */
router.get('/exchanges/ranked', authenticate, async (req: Request, res: Response) => {
  try {
    const pair = (req.query.pair as string) || 'ETH/USDT';
    const sortBy = (req.query.sortBy as string) || 'price';
    const limit = clampLimit(req.query.limit, 30, 500);

    // Attempt to read a ranked cache entry first
    const rankedKey = `ranked:${pair}:${sortBy}`;
    const rankedCached = await exchangeCache?.get(rankedKey);
    if (Array.isArray(rankedCached) && rankedCached.length > 0) {
      const sliced = rankedCached.slice(0, limit);
      return res.json({ success: true, data: sliced, count: sliced.length, timestamp: Date.now() });
    }

    // Fallback: use cached price list + local sort
    const key = `prices:${pair}:500`;
    const cachedObj = (await exchangeCache?.get(key)) ?? { exchanges: [] };
    const list = Array.isArray((cachedObj as CachedPrices).exchanges) ? (cachedObj as CachedPrices).exchanges! : [];
    const sorted = list.sort((a: any, b: any) => ((b.price || 0) - (a.price || 0))).slice(0, limit);

    return res.json({ success: true, data: sorted, count: sorted.length, timestamp: Date.now() });
  } catch (error: any) {
    logger.error('[YUKI] /exchanges/ranked failed', { error });
    return res.status(500).json({ success: false, error: 'Failed to rank exchanges' });
  }
});

/**
 * GET /v1/yuki/exchanges/by-region
 */
router.get('/exchanges/by-region', authenticate, async (req: Request, res: Response) => {
  try {
    const pair = (req.query.pair as string) || 'ETH/USDT';
    const region = (req.query.region as string) || '';

    const key = `prices:${pair}:500`;
    const cachedObj = (await exchangeCache?.get(key)) ?? { exchanges: [] };
    const list = Array.isArray((cachedObj as CachedPrices).exchanges) ? (cachedObj as CachedPrices).exchanges! : [];

    const regional = region ? list.filter((e: any) => e.region === region) : list;

    return res.json({ success: true, data: regional, count: regional.length, region, timestamp: Date.now() });
  } catch (error: any) {
    logger.error('[YUKI] /exchanges/by-region failed', { error });
    return res.status(500).json({ success: false, error: 'Failed to get regional exchanges' });
  }
});

/**
 * GET /v1/yuki/exchanges/regions
 */
router.get('/exchanges/regions', authenticate, async (req: Request, res: Response) => {
  try {
    const pair = (req.query.pair as string) || 'ETH/USDT';
    const key = `prices:${pair}:500`;
    const cachedObj = (await exchangeCache?.get(key)) ?? { exchanges: [] };
    const list = Array.isArray((cachedObj as CachedPrices).exchanges) ? (cachedObj as CachedPrices).exchanges! : [];
    const regions = Array.from(new Set(list.map((e: any) => e.region).filter(Boolean)));

    return res.json({ success: true, data: regions, count: regions.length, timestamp: Date.now() });
  } catch (error: any) {
    logger.error('[YUKI] /exchanges/regions failed', { error });
    return res.status(500).json({ success: false, error: 'Failed to get regions' });
  }
});

/**
 * POST /v1/yuki/exchanges/batch
 * Batch fetch multiple pairs and return results (no fire-and-forget leak)
 */
router.post('/exchanges/batch', authenticate, async (req: Request, res: Response) => {
  try {
    const { pairs = ['ETH/USDT'], limit = 30 } = req.body;
    if (!Array.isArray(pairs) || pairs.length === 0) {
      return res.status(400).json({ success: false, error: 'pairs must be a non-empty array' });
    }

    // Fallback: iterate pairs and read cached entries (no specialised batch helper available)
    const results = await Promise.all(pairs.map(async (pair: string) => {
      const key = `prices:${pair}:500`;
      const entry = await exchangeCache?.get(key) ?? { exchanges: [] };
      return { pair, data: entry };
    }));

    return res.json({ success: true, data: { immediate: results, queued: [] }, timestamp: Date.now() });
  } catch (error: any) {
    logger.error('[YUKI] /exchanges/batch failed', { error });
    return res.status(500).json({ success: false, error: 'Failed to batch fetch exchanges' });
  }
});

/**
 * POST /v1/yuki/cache/invalidate
 * Protected by advancedModeGuard
 */
router.post('/cache/invalidate', [authenticate, advancedModeGuard], async (req: Request, res: Response) => {
  try {
    const { pair } = req.body;
    if (!pair) return res.status(400).json({ success: false, error: 'pair is required' });

    // Invalidate specific cache key or pattern
    const cache = cacheManager.getCache('exchange_data');
    if (cache) {
      // Try delete specific entry first
      await cache.delete(`prices:${pair}:500`);
      // Also invalidate any related ranked entries
      await cache.invalidatePattern(`ranked:${pair}:.*`);
    }

    return res.json({ success: true, message: `Cache invalidated for ${pair}`, timestamp: Date.now() });
  } catch (error: any) {
    logger.error('[YUKI] /cache/invalidate failed', { error });
    return res.status(500).json({ success: false, error: 'Failed to invalidate cache' });
  }
});

/**
 * GET /v1/yuki/health
 * Protected endpoint (requires authentication)
 */
router.get('/health', authenticate, async (_req: Request, res: Response) => {
  try {
    // Provide cache metrics and manager status
    const metrics = exchangeCache ? exchangeCache.getMetrics() : null;
    const managerStatus = cacheManager.getStatus();
    const health = { metrics, managerStatus };
    const allHealthy = Boolean(metrics && managerStatus);
    return res.status(allHealthy ? 200 : 503).json({ success: allHealthy, data: health });
  } catch (error: any) {
    logger.error('[YUKI] /health failed', { error });
    return res.status(503).json({ success: false, error: 'Health check failed' });
  }
});

export default router;
