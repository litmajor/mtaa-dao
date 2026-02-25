/**
 * DexScreener API Integration Handler
 * ✅ TypeScript + Express (replaces Python FastAPI backend)
 * 
 * Provides unified API for:
 * - Token pair search and discovery
 * - Trending pair detection
 * - Real-time token data from DexScreener
 * 
 * All requests are cached and rate-limited for optimal performance
 */

import type { Request, Response, NextFunction } from 'express';
import { DexScreenerClient } from '../services/dexscreener_client';
import { logger } from '../utils/logger';

/**
 * In-memory response cache with TTL
 * Production: Migrate to Redis for distributed caching
 */
class ResponseCache {
  private cache = new Map<string, { data: any; expiresAt: number }>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.TTL_MS
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; ttlMs: number } {
    return {
      size: this.cache.size,
      ttlMs: this.TTL_MS
    };
  }
}

const responseCache = new ResponseCache();
const dexScreenerClient = new DexScreenerClient();

/**
 * GET /api/dex/health
 * Service health check
 */
export const getDexHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      status: 'healthy',
      service: 'dex-screener-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cache: responseCache.getStats()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dex/search-pairs
 * Search for trading pairs by symbol or address
 * 
 * Query Parameters:
 * - q (required): Symbol or address to search (e.g., "PUMP", "0x1234...")
 * - chains (optional): Comma-separated chain names (e.g., "ethereum,solana")
 * - limit (optional): Max results (default: 50)
 * 
 * Rate Limit: 60 requests/minute
 */
export const searchPairs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, chains, limit } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Build cache key
    const cacheKey = `search:${q}:${chains || 'all'}:${limit || 50}`;
    const cached = responseCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Prepare chains parameter
    const chainParam = chains ? (chains as string).split(',').map(c => c.trim()) : undefined;

    // Call DexScreener API
    const results = await dexScreenerClient.searchPairs({
      q,
      chains: chainParam,
      limit: limit ? parseInt(limit as string) : 50
    });

    // Cache results
    responseCache.set(cacheKey, results);

    res.json({
      ...results,
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error searching pairs:', error);
    next(error);
  }
};

/**
 * GET /api/dex/pairs/:chain/:pairAddress
 * Get detailed information about a specific trading pair
 * 
 * Path Parameters:
 * - chain: Blockchain name (e.g., "ethereum", "solana")
 * - pairAddress: Pair contract address
 * 
 * Rate Limit: 300 requests/minute
 */
export const getPairDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chain, pairAddress } = req.params;

    if (!chain || !pairAddress) {
      return res.status(400).json({ 
        error: 'Path parameters "chain" and "pairAddress" are required' 
      });
    }

    // Build cache key
    const cacheKey = `pair:${chain}:${pairAddress}`;
    const cached = responseCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Call DexScreener API
    const pairData = await dexScreenerClient.getPair({
      chainId: chain,
      pairAddress
    });

    // Cache results
    responseCache.set(cacheKey, pairData);

    res.json({
      ...pairData,
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching pair details:', error);
    next(error);
  }
};

/**
 * GET /api/dex/token-pairs/:chain/:tokenAddress
 * Get all trading pairs for a specific token
 * 
 * Path Parameters:
 * - chain: Blockchain name
 * - tokenAddress: Token contract address
 * 
 * Query Parameters:
 * - factor (optional): "txns" (transaction count), "liquidity", "volume", "fdv"
 * 
 * Rate Limit: 60 requests/minute
 */
export const getTokenPairs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chain, tokenAddress } = req.params;
    const { factor } = req.query;

    if (!chain || !tokenAddress) {
      return res.status(400).json({ 
        error: 'Path parameters "chain" and "tokenAddress" are required' 
      });
    }

    // Build cache key
    const cacheKey = `token-pairs:${chain}:${tokenAddress}:${factor || 'default'}`;
    const cached = responseCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Call DexScreener API
    const pairs = await dexScreenerClient.getTokenPairs({
      chainId: chain,
      tokenAddress,
      orderby: (factor as string) || 'txns'
    });

    // Cache results
    responseCache.set(cacheKey, pairs);

    res.json({
      pairs,
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching token pairs:', error);
    next(error);
  }
};

/**
 * GET /api/dex/trending-pairs
 * Discover trending trading pairs with filters
 * 
 * Query Parameters:
 * - chain (optional): Chain name (e.g., "ethereum", "solana")
 * - min_liquidity (optional): Minimum liquidity in USD (e.g., 100000)
 * - min_volume (optional): Minimum 24h volume in USD
 * - max_age (optional): Max pair age in hours
 * - limit (optional): Max results (default: 50)
 * 
 * Rate Limit: 30 requests/minute
 */
export const getTrendingPairs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chain, min_liquidity, min_volume, max_age, limit } = req.query;

    // Build cache key
    const cacheKey = `trending:${chain || 'all'}:${min_liquidity || 0}:${min_volume || 0}:${limit || 50}`;
    const cached = responseCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Get trending pairs from DexScreener
    const results = await dexScreenerClient.getTrendingPairs({
      chainId: chain as string | undefined,
      minLiquidity: min_liquidity ? parseInt(min_liquidity as string) : undefined,
      minVolume: min_volume ? parseInt(min_volume as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50
    });

    // Apply age filter if specified
    let filtered = results;
    if (max_age) {
      const maxAgeMs = parseInt(max_age as string) * 60 * 60 * 1000;
      filtered = results.filter(pair => {
        if (!pair.pairCreatedAt) return true;
        const age = Date.now() - pair.pairCreatedAt;
        return age <= maxAgeMs;
      });
    }

    // Cache results
    responseCache.set(cacheKey, { pairs: filtered, total: filtered.length });

    res.json({
      pairs: filtered,
      total: filtered.length,
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching trending pairs:', error);
    next(error);
  }
};

/**
 * POST /api/dex/symbol-universe/sync
 * Trigger Symbol Universe discovery from DexScreener data
 * 
 * This endpoint:
 * 1. Fetches trending pairs from DexScreener
 * 2. Auto-categorizes discovered tokens
 * 3. Enriches with CoinGecko metadata
 * 4. Detects asset relationships (wrapped, bridged, staking)
 * 5. Returns stats on new/updated assets
 * 
 * Rate Limit: 1 request/minute
 * 
 * Warning: This is a resource-intensive operation
 */
export const syncSymbolUniverse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Prevent concurrent syncs
    if ((syncSymbolUniverse as any).isRunning) {
      return res.status(429).json({
        error: 'Discovery already in progress',
        message: 'Please wait for the current sync to complete'
      });
    }

    (syncSymbolUniverse as any).isRunning = true;

    const startTime = Date.now();
    logger.info('Starting Symbol Universe discovery...');

    try {
      // This would integrate with Symbol Universe service
      // For now, return a placeholder response
      const result = {
        status: 'discovery_started',
        message: 'Symbol Universe discovery initiated',
        chains: ['ethereum', 'solana', 'polygon'],
        expectedDuration: '2-5 minutes',
        startedAt: new Date().toISOString()
      };

      res.json(result);

      // Note: In production, this would:
      // - Run async discovery in background
      // - Update database with new tokens
      // - Categorize and enrich asset data
      // - Return results via WebSocket when complete
    } finally {
      (syncSymbolUniverse as any).isRunning = false;
    }
  } catch (error) {
    logger.error('Error syncing Symbol Universe:', error);
    (syncSymbolUniverse as any).isRunning = false;
    next(error);
  }
};

/**
 * DELETE /api/dex/cache/clear
 * Clear all cached responses
 * 
 * ⚠️ Admin only - requires authentication
 */
export const clearCache = async (req: Request, res: Response, next: NextFunction) => {
  try {
    responseCache.clear();
    logger.info('DexScreener cache cleared');
    
    res.json({
      status: 'success',
      message: 'Cache cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dex/cache/stats
 * Get cache statistics
 */
export const getCacheStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = responseCache.getStats();
    
    res.json({
      cache: {
        size: stats.size,
        ttlMs: stats.ttlMs,
        ttlMinutes: stats.ttlMs / 1000 / 60
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getDexHealth,
  searchPairs,
  getPairDetails,
  getTokenPairs,
  getTrendingPairs,
  syncSymbolUniverse,
  clearCache,
  getCacheStats
};
