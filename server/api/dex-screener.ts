/**
 * DexScreener API Integration Handler
 */

import type { Request, Response, NextFunction } from 'express';
import { DexScreenerClient, type DexPair } from '../services/dexscreener_client';
import { logger } from '../utils/logger';

type SyncStatus = {
  isRunning: boolean;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  chains: string[];
  totalPairsScanned: number;
  uniqueTokensDiscovered: number;
  retries: number;
  idempotencyKey?: string;
  error?: string;
};

class ResponseCache {
  private cache = new Map<string, { data: any; expiresAt: number }>();
  private readonly TTL_MS = 5 * 60 * 1000;

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
    this.cache.set(key, { data, expiresAt: Date.now() + this.TTL_MS });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; ttlMs: number } {
    return { size: this.cache.size, ttlMs: this.TTL_MS };
  }
}

const responseCache = new ResponseCache();
const dexScreenerClient = new DexScreenerClient();
const symbolUniverseState: SyncStatus = {
  isRunning: false,
  chains: [],
  totalPairsScanned: 0,
  uniqueTokensDiscovered: 0,
  retries: 0,
};

const discoveredTokenUniverse = new Map<string, {
  chainId: string;
  address: string;
  symbol: string;
  name: string;
  lastSeenAt: string;
}>();

const DEFAULT_CHAINS = ['ethereum', 'solana', 'polygon', 'bsc', 'base'];

async function clientSearchPairs(q: string, chains?: string[], limit: number = 50): Promise<any> {
  const client: any = dexScreenerClient;
  if (client.searchPairs.length >= 1) {
    const response = await client.searchPairs(q, chains);
    const pairs = (response?.pairs || []).slice(0, limit);
    return { ...response, pairs, total: response?.total ?? pairs.length };
  }
  return client.searchPairs({ q, chains, limit });
}

async function clientGetPair(chain: string, pairAddress: string): Promise<any> {
  const client: any = dexScreenerClient;
  if (client.getPair.length >= 2) return client.getPair(chain, pairAddress);
  return client.getPair({ chainId: chain, pairAddress });
}

async function clientGetTokenPairs(chain: string, tokenAddress: string, _factor: string): Promise<any> {
  const client: any = dexScreenerClient;
  if (client.getTokenPairs.length >= 2) return client.getTokenPairs(chain, tokenAddress);
  return client.getTokenPairs({ chainId: chain, tokenAddress, orderby: _factor });
}

async function clientTrending(args: {
  chainId?: string;
  minLiquidity?: number;
  minVolume?: number;
  limit?: number;
}): Promise<DexPair[]> {
  const client: any = dexScreenerClient;
  const legacy = await client.findTrending?.({
    chain: args.chainId,
    minLiquidity: args.minLiquidity,
    minVolume24h: args.minVolume,
    limit: args.limit,
  });
  if (legacy?.status === 'success') return legacy?.trending || [];

  const modern = await client.getTrendingPairs?.(args);
  if (Array.isArray(modern)) return modern;
  if (Array.isArray(modern?.pairs)) return modern.pairs;
  if (Array.isArray(modern?.trending)) return modern.trending;
  return [];
}

async function runSymbolUniverseSync(options: {
  chains?: string[];
  minLiquidity?: number;
  minVolume?: number;
  limitPerChain?: number;
  retryCount?: number;
}) {
  const chains = options.chains?.length ? options.chains : DEFAULT_CHAINS;
  const minLiquidity = options.minLiquidity ?? 10000;
  const minVolume = options.minVolume ?? 50000;
  const limitPerChain = options.limitPerChain ?? 100;
  const retryCount = options.retryCount ?? 1;

  symbolUniverseState.isRunning = true;
  symbolUniverseState.startedAt = new Date().toISOString();
  symbolUniverseState.completedAt = undefined;
  symbolUniverseState.durationMs = undefined;
  symbolUniverseState.error = undefined;
  symbolUniverseState.chains = chains;
  symbolUniverseState.totalPairsScanned = 0;
  symbolUniverseState.uniqueTokensDiscovered = 0;
  symbolUniverseState.retries = 0;

  const started = Date.now();
  const runId = `sync-${started}`;
  symbolUniverseState.idempotencyKey = runId;

  const uniqueKeys = new Set<string>();

  try {
    for (const chain of chains) {
      let lastError: unknown;
      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          const pairs = await clientTrending({
            chainId: chain,
            minLiquidity,
            minVolume,
            limit: limitPerChain,
          });

          symbolUniverseState.totalPairsScanned += pairs.length;

          for (const pair of pairs) {
            for (const token of [pair.baseToken, pair.quoteToken]) {
              if (!token?.address) continue;
              const key = `${chain}:${token.address.toLowerCase()}`;
              uniqueKeys.add(key);
              discoveredTokenUniverse.set(key, {
                chainId: chain,
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                lastSeenAt: new Date().toISOString(),
              });
            }
          }

          lastError = undefined;
          break;
        } catch (error) {
          symbolUniverseState.retries += 1;
          lastError = error;
          if (attempt < retryCount) {
            logger.warn('Symbol universe sync retry', { chain, attempt: attempt + 1, error: (error as Error)?.message });
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      if (lastError) {
        throw lastError;
      }
    }

    symbolUniverseState.uniqueTokensDiscovered = uniqueKeys.size;
    symbolUniverseState.completedAt = new Date().toISOString();
    symbolUniverseState.durationMs = Date.now() - started;

    logger.info('Symbol universe sync completed', {
      runId,
      chains,
      totalPairsScanned: symbolUniverseState.totalPairsScanned,
      uniqueTokensDiscovered: symbolUniverseState.uniqueTokensDiscovered,
      retries: symbolUniverseState.retries,
    });
  } catch (error) {
    symbolUniverseState.error = (error as Error)?.message || 'Unknown sync error';
    symbolUniverseState.completedAt = new Date().toISOString();
    symbolUniverseState.durationMs = Date.now() - started;
    logger.error('Error syncing Symbol Universe:', error);
  } finally {
    symbolUniverseState.isRunning = false;
  }
}

export const getDexHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      status: 'healthy',
      service: 'dex-screener-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cache: responseCache.getStats(),
      symbolUniverseSync: {
        ...symbolUniverseState,
        persistedUniverseSize: discoveredTokenUniverse.size,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const searchPairs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, chains, limit } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const cacheKey = `search:${q}:${chains || 'all'}:${limit || 50}`;
    const cached = responseCache.get(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const chainParam = chains ? (chains as string).split(',').map(c => c.trim()) : undefined;
    const parsedLimit = limit ? parseInt(limit as string, 10) : 50;

    const results = await clientSearchPairs(q, chainParam, parsedLimit);
    responseCache.set(cacheKey, results);

    res.json({ ...results, cached: false, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error searching pairs:', error);
    next(error);
  }
};

export const getPairDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chain, pairAddress } = req.params;
    if (!chain || !pairAddress) {
      return res.status(400).json({ error: 'Path parameters "chain" and "pairAddress" are required' });
    }

    const cacheKey = `pair:${chain}:${pairAddress}`;
    const cached = responseCache.get(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const pairData = await clientGetPair(chain, pairAddress);
    responseCache.set(cacheKey, pairData);
    res.json({ ...pairData, cached: false, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error fetching pair details:', error);
    next(error);
  }
};

export const getTokenPairs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chain, tokenAddress } = req.params;
    const { factor } = req.query;

    if (!chain || !tokenAddress) {
      return res.status(400).json({ error: 'Path parameters "chain" and "tokenAddress" are required' });
    }

    const cacheKey = `token-pairs:${chain}:${tokenAddress}:${factor || 'default'}`;
    const cached = responseCache.get(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const pairs = await clientGetTokenPairs(chain, tokenAddress, (factor as string) || 'txns');
    responseCache.set(cacheKey, pairs);

    res.json({ pairs, cached: false, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error fetching token pairs:', error);
    next(error);
  }
};

export const getTrendingPairs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chain, min_liquidity, min_volume, max_age, limit } = req.query;

    const cacheKey = `trending:${chain || 'all'}:${min_liquidity || 0}:${min_volume || 0}:${limit || 50}`;
    const cached = responseCache.get(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const results = await clientTrending({
      chainId: chain as string | undefined,
      minLiquidity: min_liquidity ? parseInt(min_liquidity as string, 10) : undefined,
      minVolume: min_volume ? parseInt(min_volume as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });

    let filtered = results;
    if (max_age) {
      const maxAgeMs = parseInt(max_age as string, 10) * 60 * 60 * 1000;
      filtered = results.filter(pair => !pair.pairCreatedAt || Date.now() - pair.pairCreatedAt <= maxAgeMs);
    }

    responseCache.set(cacheKey, { pairs: filtered, total: filtered.length });
    res.json({ pairs: filtered, total: filtered.length, cached: false, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error fetching trending pairs:', error);
    next(error);
  }
};

export const syncSymbolUniverse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (symbolUniverseState.isRunning) {
      return res.status(429).json({
        error: 'Discovery already in progress',
        message: 'Please wait for the current sync to complete',
        state: symbolUniverseState,
      });
    }

    const {
      chains,
      minLiquidity,
      minVolume,
      limitPerChain,
      retryCount,
    } = req.body || {};

    const selectedChains = Array.isArray(chains) ? chains : undefined;

    setImmediate(() => {
      void runSymbolUniverseSync({
        chains: selectedChains,
        minLiquidity: minLiquidity ? Number(minLiquidity) : undefined,
        minVolume: minVolume ? Number(minVolume) : undefined,
        limitPerChain: limitPerChain ? Number(limitPerChain) : undefined,
        retryCount: retryCount ? Number(retryCount) : undefined,
      });
    });

    res.status(202).json({
      status: 'discovery_started',
      message: 'Symbol Universe background sync started',
      state: {
        ...symbolUniverseState,
        isRunning: true,
        chains: selectedChains?.length ? selectedChains : DEFAULT_CHAINS,
      },
      startedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error scheduling Symbol Universe sync:', error);
    next(error);
  }
};

export const clearCache = async (req: Request, res: Response, next: NextFunction) => {
  try {
    responseCache.clear();
    logger.info('DexScreener cache cleared');
    res.json({ status: 'success', message: 'Cache cleared', timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
};

export const getCacheStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = responseCache.getStats();
    res.json({
      cache: {
        size: stats.size,
        ttlMs: stats.ttlMs,
        ttlMinutes: stats.ttlMs / 1000 / 60,
      },
      symbolUniverse: {
        ...symbolUniverseState,
        persistedUniverseSize: discoveredTokenUniverse.size,
      },
      timestamp: new Date().toISOString(),
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
  getCacheStats,
};
