/**
 * Symbol Universe Routes
 * API endpoints for symbol discovery, pricing, and asset graph integration
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { symbolUniverseService } from '../services/symbolUniverseService';
import { collectorService } from '../services/collectorService';
import { treasuryPriceUpdateService } from '../services/treasuryPriceUpdateService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Standardized error handler middleware helper
 */
const handleError = (res: Response, error: unknown, context: string): Response => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`[SymbolUniverseRoutes] ${context}:`, errorMessage);

  const isProduction = process.env.NODE_ENV === 'production';
  return res.status(500).json({
    error: true,
    message: isProduction ? 'An unexpected internal error occurred' : errorMessage,
    context,
  });
};

/**
 * Helper to safely parse query parameter limits
 */
const parseLimit = (limitParam: unknown, defaultLimit = 100, maxLimit = 1000): number => {
  const parsed = parseInt(String(limitParam || ''), 10);
  if (isNaN(parsed) || parsed <= 0) return defaultLimit;
  return Math.min(parsed, maxLimit);
};

/**
 * Helper middleware to check for admin role
 */
const requireAdmin = (req: Request, res: Response, next: () => void) => {
  // Ensure user object exists (populated by authenticateToken) and check role
  const user = (req as any).user;
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return res.status(403).json({
      error: true,
      message: 'Access denied: Admin privileges required',
    });
  }
  next();
};

/**
 * GET /api/symbol-universe/all
 * Get all supported symbols from registry
 */
router.get('/all', rateLimitPerUser('symbol-universe-all', 100, '1min'), (_req: Request, res: Response) => {
  try {
    const symbols = symbolUniverseService.getAllSymbols();

    return res.json({
      success: true,
      count: symbols.length,
      symbols,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return handleError(res, error, 'GET /all');
  }
});

/**
 * GET /api/symbol-universe/discovery/:exchange
 * Discover supported pairs for specific exchange
 */
router.get(
  '/discovery/:exchange',
  rateLimitPerUser('symbol-discovery', 50, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { exchange } = req.params;
      const startTime = Date.now();

      if (!exchange || typeof exchange !== 'string') {
        return res.status(400).json({
          error: true,
          message: 'Invalid or missing exchange parameter',
        });
      }

      const result = await collectorService.collectSymbolsForExchange(exchange.toLowerCase());

      if (!result.success) {
        return res.status(500).json({
          error: true,
          message: result.error || 'Failed to discover symbols',
        });
      }

      const pairs = result.data || [];
      const elapsedMs = Date.now() - startTime;

      return res.json({
        success: true,
        exchange: exchange.toLowerCase(),
        pairCount: pairs.length,
        pairs: pairs.slice(0, 100),
        fromCache: result.fromCache,
        elapsedMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      return handleError(res, error, `GET /discovery/${req.params.exchange}`);
    }
  }
);

/**
 * GET /api/symbol-universe/supported-pairs/:exchange
 * Get supported trading pairs for exchange
 */
router.get(
  '/supported-pairs/:exchange',
  rateLimitPerUser('symbol-pairs', 50, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { exchange } = req.params;

      if (!exchange || typeof exchange !== 'string') {
        return res.status(400).json({
          error: true,
          message: 'Invalid or missing exchange parameter',
        });
      }

      const limitNum = parseLimit(req.query.limit, 100, 500);
      const pairs = await symbolUniverseService.getSupportedPairs(exchange.toLowerCase());

      return res.json({
        success: true,
        exchange: exchange.toLowerCase(),
        totalPairs: pairs.length,
        returnedCount: Math.min(limitNum, pairs.length),
        pairs: pairs.slice(0, limitNum),
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      return handleError(res, error, `GET /supported-pairs/${req.params.exchange}`);
    }
  }
);

/**
 * GET /api/symbol-universe/top-by-volume/:exchange
 * Get top N symbols by 24h volume for an exchange
 */
router.get('/top-by-volume/:exchange', async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;

    if (!exchange || typeof exchange !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing exchange parameter',
      });
    }

    const limitNum = parseLimit(req.query.limit, 100, 1000);
    const topSymbols = await symbolUniverseService.getTopByVolume(exchange.toLowerCase(), limitNum);

    return res.json({
      success: true,
      exchange: exchange.toLowerCase(),
      limit: limitNum,
      count: topSymbols.length,
      symbols: topSymbols,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return handleError(res, error, `GET /top-by-volume/${req.params.exchange}`);
  }
});

/**
 * GET /api/symbol-universe/price/:symbol/:quote?
 * Get current price for symbol
 */
router.get(
  '/price/:symbol/:quote?',
  rateLimitPerUser('symbol-price', 100, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const quote = req.params.quote || 'USD';

      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({
          error: true,
          message: 'Invalid or missing symbol parameter',
        });
      }

      const price = await symbolUniverseService.getPrice(symbol.toUpperCase(), quote.toUpperCase());

      if (!price) {
        return res.status(404).json({
          error: true,
          message: `No price found for ${symbol}/${quote}`,
        });
      }

      return res.json({
        success: true,
        symbol: symbol.toUpperCase(),
        quote: quote.toUpperCase(),
        price: price.price,
        source: price.source,
        exchange: price.exchange || 'N/A',
        change24h: price.change24h || 0,
        volume24h: price.volume24h || 0,
        timestamp: new Date(price.timestamp).toISOString(),
      });
    } catch (error: unknown) {
      return handleError(res, error, `GET /price/${req.params.symbol}`);
    }
  }
);

/**
 * GET /api/symbol-universe/metadata/:symbol
 * Get symbol metadata from token registry
 */
router.get('/metadata/:symbol', rateLimitPerUser('symbol-metadata', 50, '1min'), (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing symbol parameter',
      });
    }

    const metadata = symbolUniverseService.getSymbolMetadata(symbol.toUpperCase());

    if (!metadata) {
      return res.status(404).json({
        error: true,
        message: `Symbol ${symbol} not found in registry`,
      });
    }

    return res.json({
      success: true,
      metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return handleError(res, error, `GET /metadata/${req.params.symbol}`);
  }
});

/**
 * GET /api/symbol-universe/category/:category
 */
router.get('/category/:category', rateLimitPerUser('symbol-category', 50, '1min'), (req: Request, res: Response) => {
  try {
    const { category } = req.params;

    if (!category || typeof category !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing category parameter',
      });
    }

    const symbols = symbolUniverseService.getSymbolsByCategory(category.toLowerCase());

    return res.json({
      success: true,
      category: category.toLowerCase(),
      count: symbols.length,
      symbols,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return handleError(res, error, `GET /category/${req.params.category}`);
  }
});

/**
 * GET /api/symbol-universe/chain/:chain
 */
router.get('/chain/:chain', rateLimitPerUser('symbol-chain', 50, '1min'), (req: Request, res: Response) => {
  try {
    const { chain } = req.params;

    if (!chain || typeof chain !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing chain parameter',
      });
    }

    const symbols = symbolUniverseService.getSymbolsByChain(chain.toLowerCase());

    return res.json({
      success: true,
      chain: chain.toLowerCase(),
      count: symbols.length,
      symbols,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return handleError(res, error, `GET /chain/${req.params.chain}`);
  }
});

/**
 * GET /api/symbol-universe/stats
 */
router.get('/stats', rateLimitPerUser('symbol-stats', 50, '1min'), (_req: Request, res: Response) => {
  try {
    const stats = symbolUniverseService.getStats();

    return res.json({
      success: true,
      service: 'symbolUniverse',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return handleError(res, error, 'GET /stats');
  }
});

/**
 * POST /api/symbol-universe/cache/clear
 * Clear all service caches (ADMIN ONLY)
 */
router.post(
  '/cache/clear',
  [authenticateToken, requireAdmin, rateLimitPerUser('symbol-cache-clear', 2, '10min')],
  (_req: Request, res: Response) => {
    try {
      symbolUniverseService.clearCaches();

      return res.json({
        success: true,
        message: 'Symbol Universe caches cleared',
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      return handleError(res, error, 'POST /cache/clear');
    }
  }
);

/**
 * Treasury-specific endpoints
 */

/**
 * GET /api/symbol-universe/treasury/positions
 */
router.get(
  '/treasury/positions',
  [authenticateToken, rateLimitPerUser('treasury-positions', 30, '1min')],
  async (_req: Request, res: Response) => {
    try {
      return res.json({
        success: true,
        positions: [],
        totalValueUSD: 0,
        lastUpdated: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      return handleError(res, error, 'GET /treasury/positions');
    }
  }
);

/**
 * POST /api/symbol-universe/treasury/update/:symbol
 * Manually trigger price update for treasury positions (ADMIN ONLY)
 */
router.post(
  '/treasury/update/:symbol',
  [authenticateToken, requireAdmin, rateLimitPerUser('treasury-update', 10, '1min')],
  async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;

      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({
          error: true,
          message: 'Invalid or missing symbol parameter',
        });
      }

      await treasuryPriceUpdateService.triggerPriceUpdate(symbol.toUpperCase());

      return res.json({
        success: true,
        message: `Treasury price update triggered for ${symbol.toUpperCase()}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      return handleError(res, error, `POST /treasury/update/${req.params.symbol}`);
    }
  }
);

/**
 * GET /api/symbol-universe/treasury/stats
 */
router.get('/treasury/stats', [authenticateToken, requireAdmin], (_req: Request, res: Response) => {
  try {
    const stats = treasuryPriceUpdateService.getStats();

    return res.json({
      success: true,
      service: 'treasuryPriceUpdate',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return handleError(res, error, 'GET /treasury/stats');
  }
});

export default router;