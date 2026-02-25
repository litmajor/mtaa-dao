/**
 * YUKI TRADING API ROUTES - PHASE 2 INTEGRATION
 * 
 * Backend API endpoints for the Trading Hub
 * Integrates with ExchangeDataCacheService for efficient data delivery
 */

import { Router, Request, Response } from 'express';
import { cacheManager } from '../../core/consolidation/DataCacheConsolidation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/yuki/exchanges
 * Get aggregated exchange prices with optional filtering
 * 
 * Query params:
 * - pair: string (e.g., 'ETH/USDT')
 * - limit: number (default: 30)
 * - regions: string[] (e.g., 'North America,Asia-Pacific')
 * - sortBy: 'price' | 'volume' | 'liquidity' | 'fees' | 'uptime'
 * 
 * Response: AggregatedPriceData
 */
router.get('/exchanges', [authenticateToken as any], async (req: Request, res: Response) => {
  try {
    const { pair = 'ETH/USDT', limit = 30, sortBy = 'price', regions } = req.query;

    // Get base exchange data with fallback caching
    const cache = cacheManager.getCache('exchange_data');
    let data = await cache?.get(`prices:${pair}:${limit}`) || await Promise.resolve({ exchanges: [] });

    // Apply region filter if specified
    if (regions && typeof regions === 'string') {
      const regionList = regions.split(',').map((r) => r.trim());
      data.exchanges = data.exchanges.filter((e) => regionList.includes(e.region));
    }

    // Apply sort
    if (sortBy && typeof sortBy === 'string' && cache) {
      const ranked = await cache.get(`ranked:${pair}:${sortBy}`);
      if (ranked) {
        data.exchanges = ranked;
      }
    }

    res.json({
      success: true,
      data,
      cached: true, // Could add cache hit indicator
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching exchanges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exchange data',
    });
  }
});

/**
 * GET /api/yuki/exchanges/ranked
 * Get exchanges ranked by criteria
 * 
 * Query params:
 * - pair: string
 * - sortBy: 'price' | 'volume' | 'liquidity' | 'fees' | 'uptime'
 * - limit: number
 * 
 * Response: ExchangeData[]
 */
router.get('/exchanges/ranked', [authenticateToken as any], async (req: Request, res: Response) => {
  try {
    const { pair = 'ETH/USDT', sortBy = 'price', limit = 30 } = req.query;

    const ranked = await exchangeCache.getRankedExchanges(pair as string, sortBy as any);
    const sliced = ranked.slice(0, parseInt(limit as string));

    res.json({
      success: true,
      data: sliced,
      count: sliced.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error ranking exchanges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rank exchanges',
    });
  }
});

/**
 * GET /api/yuki/exchanges/by-region
 * Get exchanges filtered by region
 * 
 * Query params:
 * - pair: string
 * - region: string (North America, Europe, Asia-Pacific, etc.)
 * 
 * Response: ExchangeData[]
 */
router.get('/exchanges/by-region', [authenticateToken as any], async (req: Request, res: Response) => {
  try {
    const { pair = 'ETH/USDT', region = 'North America' } = req.query;

    const regional = await exchangeCache.getExchangesByRegion(pair as string, region as string);

    res.json({
      success: true,
      data: regional,
      count: regional.length,
      region,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error getting regional exchanges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get regional exchanges',
    });
  }
});

/**
 * GET /api/yuki/exchanges/regions
 * Get all available regions
 * 
 * Query params:
 * - pair: string (default: 'ETH/USDT')
 * 
 * Response: string[]
 */
router.get('/exchanges/regions', [authenticateToken as any], async (req: Request, res: Response) => {
  try {
    const { pair = 'ETH/USDT' } = req.query;

    const regions = await exchangeCache.getAvailableRegions(pair as string);

    res.json({
      success: true,
      data: regions,
      count: regions.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error getting regions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get regions',
    });
  }
});

/**
 * POST /api/yuki/exchanges/batch
 * Batch fetch multiple pairs efficiently
 * 
 * Body:
 * {
 *   pairs: string[]
 *   limit: number (default: 30)
 * }
 * 
 * Response: {
 *   immediate: AggregatedPriceData[]
 *   queued: Promise<AggregatedPriceData>[]
 * }
 */
router.post('/exchanges/batch', [authenticateToken as any], async (req: Request, res: Response) => {
  try {
    const { pairs = ['ETH/USDT'], limit = 30 } = req.body;

    if (!Array.isArray(pairs) || pairs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'pairs must be a non-empty array',
      });
    }

    const result = await exchangeCache.batchFetchPrices(pairs, limit);

    // Wait for immediate results
    const immediate = result.immediate;

    // Start queuing remaining
    result.queued.forEach((promise) => {
      promise.catch((err) => console.error('Queued fetch error:', err));
    });

    res.json({
      success: true,
      data: {
        immediate,
        queuedCount: result.queued.length,
      },
      timestamp: Date.now(),
      note: 'Immediate data returned; queued items loading in background',
    });
  } catch (error) {
    console.error('Error batch fetching:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch fetch exchanges',
    });
  }
});

/**
 * POST /api/yuki/cache/invalidate
 * Invalidate cache for a specific pair
 * Useful after a trade to get fresh prices
 * 
 * Body:
 * { pair: string }
 * 
 * Response: { success: boolean }
 */
router.post('/cache/invalidate', [authenticateToken as any], async (req: Request, res: Response) => {
  try {
    const { pair } = req.body;

    if (!pair) {
      return res.status(400).json({
        success: false,
        error: 'pair is required',
      });
    }

    await exchangeCache.invalidateCache(pair);

    res.json({
      success: true,
      message: `Cache invalidated for ${pair}`,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
    });
  }
});

/**
 * GET /api/yuki/health
 * Health check for caching service
 * 
 * Response: {
 *   redis: boolean
 *   database: boolean
 *   uptime: string
 * }
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await exchangeCache.healthCheck();
    const allHealthy = health.redis && health.database;

    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      data: health,
    });
  } catch (error) {
    console.error('Error checking health:', error);
    res.status(503).json({
      success: false,
      error: 'Health check failed',
    });
  }
});

export default router;
