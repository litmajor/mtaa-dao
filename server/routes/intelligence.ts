/**
 * Asset Intelligence Routes
 * 
 * Exposes AssetStateEngine via REST API
 * Single endpoint for all asset intelligence
 */

import { Router, Request, Response } from 'express';
import { assetStateEngine } from '../services/assetStateEngine';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/intelligence/asset/:symbol
 * 
 * Compute complete AssetState for a symbol
 * 
 * Request:
 * {
 *   userId?: string,
 *   daoId?: string
 * }
 * 
 * Response: { success: true, data: AssetState }
 */
router.post('/asset/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { userId, daoId } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol required',
      });
    }

    logger.info(`Computing AssetState for ${symbol}`);

    const userContext = userId ? { userId, daoId } : undefined;
    const assetState = await assetStateEngine.compute(symbol, userContext);

    res.json({
      success: true,
      data: assetState,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Intelligence endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/intelligence/asset/:symbol
 * 
 * Get cached AssetState (no computation)
 * Returns 404 if not recently cached
 */
router.get('/asset/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { userId } = req.query;

    // Try to get from cache
    const cacheKey = `asset-state:${symbol}:${userId || 'guest'}`;
    // Note: You'll need to import cacheService and implement this
    // For now, return a 404 to indicate not cached
    
    res.status(404).json({
      success: false,
      error: 'Not cached. Use POST to compute fresh state.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/intelligence/batch
 * 
 * Compute AssetState for multiple symbols
 * 
 * Request:
 * {
 *   symbols: ['BTC', 'ETH', 'SOL'],
 *   userId?: string
 * }
 * 
 * Response: { success: true, data: { [symbol]: AssetState } }
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { symbols, userId, daoId } = req.body;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Symbols array required',
      });
    }

    logger.info(`Computing AssetState batch for ${symbols.length} symbols`);

    const results: Record<string, any> = {};
    const userContext = userId ? { userId, daoId } : undefined;

    // Parallel computation
    const promises = symbols.map(async (symbol) => {
      try {
        const state = await assetStateEngine.compute(symbol, userContext);
        results[symbol] = state;
      } catch (error) {
        results[symbol] = { error: (error as Error).message };
      }
    });

    await Promise.all(promises);

    res.json({
      success: true,
      data: results,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Batch intelligence error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/intelligence/health
 * 
 * Health check - verify engine is working
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Try to compute a well-known symbol
    const state = await assetStateEngine.compute('BTC');
    
    res.json({
      success: true,
      status: 'ok',
      engine: 'AssetStateEngine v1',
      lastCompute: state.status.lastUpdated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
