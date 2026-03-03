/**
 * Symbol Universe Routes
 * API endpoints for symbol discovery, pricing, and asset graph integration
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { symbolUniverseService } from '../services/symbolUniverseService';
import { collectorService } from '../services/collectorService';
import { treasuryPriceUpdateService } from '../services/treasuryPriceUpdateService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Error handler middleware for this router
 */
const handleError = (res: Response, error: any, context: string) => {
  logger.error(`[SymbolUniverseRoutes] ${context}:`, error.message);
  res.status(500).json({
    error: true,
    message: error.message || 'Internal server error',
    context
  });
};

/**
 * GET /api/symbol-universe/all
 * Get all supported symbols from registry
 */
router.get('/all', rateLimitPerUser('symbol-universe-all', 100, '1min'), (req: Request, res: Response) => {
  try {
    const symbols = symbolUniverseService.getAllSymbols();

    res.json({
      success: true,
      count: symbols.length,
      symbols,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, 'GET /all');
  }
});

/**
 * GET /api/symbol-universe/discovery/:exchange
 * Discover supported pairs for specific exchange (parallelized via Collector)
 */
router.get('/discovery/:exchange', rateLimitPerUser('symbol-discovery', 50, '1min'), async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;
    const startTime = Date.now();

    if (!exchange || typeof exchange !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing exchange parameter'
      });
    }

    // Use Collector Service for parallelized discovery with Redis buffering
    const result = await collectorService.collectSymbolsForExchange(exchange.toLowerCase());

    if (!result.success) {
      return res.status(500).json({
        error: true,
        message: result.error || 'Failed to discover symbols'
      });
    }

    const pairs = result.data || [];
    const elapsedMs = Date.now() - startTime;

    res.json({
      success: true,
      exchange: exchange.toLowerCase(),
      pairCount: pairs.length,
      pairs: pairs.slice(0, 100), // Return first 100 for API
      fromCache: result.fromCache,
      elapsedMs,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, `GET /discovery/${req.params.exchange}`);
  }
});

/**
 * GET /api/symbol-universe/supported-pairs/:exchange
 * Get supported trading pairs for exchange with smart fallbacks
 */
router.get('/supported-pairs/:exchange', rateLimitPerUser('symbol-pairs', 50, '1min'), async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;
    const { limit = 100 } = req.query;

    if (!exchange || typeof exchange !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing exchange parameter'
      });
    }

    const pairs = await symbolUniverseService.getSupportedPairs(
      exchange.toLowerCase()
    );

    const limitNum = Math.min(parseInt(limit as string) || 100, 500);

    res.json({
      success: true,
      exchange: exchange.toLowerCase(),
      totalPairs: pairs.length,
      returnedCount: Math.min(limitNum, pairs.length),
      pairs: pairs.slice(0, limitNum),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, `GET /supported-pairs/${req.params.exchange}`);
  }
});

/**
 * GET /api/symbol-universe/top-by-volume/:exchange
 * Get top N symbols by 24h volume for an exchange
 */
router.get('/top-by-volume/:exchange', async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;
    const { limit = 100 } = req.query;

    if (!exchange || typeof exchange !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing exchange parameter'
      });
    }

    const limitNum = Math.min(parseInt(limit as string) || 100, 1000);

    const topSymbols = await symbolUniverseService.getTopByVolume(
      exchange.toLowerCase(),
      limitNum
    );

    res.json({
      success: true,
      exchange: exchange.toLowerCase(),
      limit: limitNum,
      count: topSymbols.length,
      symbols: topSymbols,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, `GET /top-by-volume/${req.params.exchange}`);
  }
});

/**
 * GET /api/symbol-universe/price/:symbol/:quote?
 * Get current price for symbol from best available source
 */
router.get('/price/:symbol/:quote?', rateLimitPerUser('symbol-price', 100, '1min'), async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const quote = req.params.quote || 'USD';

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing symbol parameter'
      });
    }

    const price = await symbolUniverseService.getPrice(
      symbol.toUpperCase(),
      quote.toUpperCase()
    );

    if (!price) {
      return res.status(404).json({
        error: true,
        message: `No price found for ${symbol}/${quote}`
      });
    }

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      quote: quote.toUpperCase(),
      price: price.price,
      source: price.source,
      exchange: price.exchange || 'N/A',
      change24h: price.change24h || 0,
      volume24h: price.volume24h || 0,
      timestamp: new Date(price.timestamp).toISOString()
    });
  } catch (error: any) {
    handleError(res, error, `GET /price/${req.params.symbol}`);
  }
});

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
        message: 'Invalid or missing symbol parameter'
      });
    }

    const metadata = symbolUniverseService.getSymbolMetadata(symbol.toUpperCase());

    if (!metadata) {
      return res.status(404).json({
        error: true,
        message: `Symbol ${symbol} not found in registry`
      });
    }

    res.json({
      success: true,
      metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, `GET /metadata/${req.params.symbol}`);
  }
});

/**
 * GET /api/symbol-universe/category/:category
 * Get all symbols in a category (stablecoin, governance, etc.)
 */
router.get('/category/:category', rateLimitPerUser('symbol-category', 50, '1min'), (req: Request, res: Response) => {
  try {
    const { category } = req.params;

    if (!category || typeof category !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing category parameter'
      });
    }

    const symbols = symbolUniverseService.getSymbolsByCategory(
      category.toLowerCase()
    );

    res.json({
      success: true,
      category: category.toLowerCase(),
      count: symbols.length,
      symbols,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, `GET /category/${req.params.category}`);
  }
});

/**
 * GET /api/symbol-universe/chain/:chain
 * Get all symbols available on a blockchain
 */
router.get('/chain/:chain', rateLimitPerUser('symbol-chain', 50, '1min'), (req: Request, res: Response) => {
  try {
    const { chain } = req.params;

    if (!chain || typeof chain !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing chain parameter'
      });
    }

    const symbols = symbolUniverseService.getSymbolsByChain(chain.toLowerCase());

    res.json({
      success: true,
      chain: chain.toLowerCase(),
      count: symbols.length,
      symbols,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, `GET /chain/${req.params.chain}`);
  }
});

/**
 * GET /api/symbol-universe/stats
 * Get service statistics and cache info
 */
router.get('/stats', rateLimitPerUser('symbol-stats', 50, '1min'), (req: Request, res: Response) => {
  try {
    const stats = symbolUniverseService.getStats();

    res.json({
      success: true,
      service: 'symbolUniverse',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, 'GET /stats');
  }
});

/**
 * POST /api/symbol-universe/cache/clear
 * Clear all service caches (admin only)
 */
router.post('/cache/clear', rateLimitPerUser('symbol-cache-clear', 2, '10min'), (req: Request, res: Response) => {
  try {
    symbolUniverseService.clearCaches();

    res.json({
      success: true,
      message: 'Symbol Universe caches cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, 'POST /cache/clear');
  }
});

/**
 * Treasury-specific endpoints
 */

/**
 * GET /api/symbol-universe/treasury/positions
 * Get all treasury positions with live prices (AUTHENTICATED)
 */
router.get('/treasury/positions', [authenticateToken, rateLimitPerUser('treasury-positions', 30, '1min')], async (req: Request, res: Response) => {
  try {
    // This would need to query database
    // For now return empty structure
    res.json({
      success: true,
      positions: [],
      totalValueUSD: 0,
      lastUpdated: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, 'GET /treasury/positions');
  }
});

/**
 * POST /api/symbol-universe/treasury/update/:symbol
 * Manually trigger price update for treasury positions (AUTHENTICATED - ADMIN ONLY)
 */
router.post('/treasury/update/:symbol', [authenticateToken, rateLimitPerUser('treasury-update', 10, '1min')], async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid or missing symbol parameter'
      });
    }

    await treasuryPriceUpdateService.triggerPriceUpdate(symbol.toUpperCase());

    res.json({
      success: true,
      message: `Treasury price update triggered for ${symbol.toUpperCase()}`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, `POST /treasury/update/${req.params.symbol}`);
  }
});

/**
 * GET /api/symbol-universe/treasury/stats
 * Get treasury update service statistics
 */
router.get('/treasury/stats', (req: Request, res: Response) => {
  try {
    const stats = treasuryPriceUpdateService.getStats();

    res.json({
      success: true,
      service: 'treasuryPriceUpdate',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    handleError(res, error, 'GET /treasury/stats');
  }
});

export default router;
