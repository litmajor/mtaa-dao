/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * UNIFIED CACHE SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Single source of truth for all caching across services:
 * - Price data (CCXT Service, CEX Collector)
 * - OHLCV candles (OHLCV Service, Background jobs)
 * - Market data (CCXT Service, Symbol Universe)
 * 
 * Features:
 * ✅ Stale-while-revalidate pattern
 * ✅ Pattern-based invalidation
 * ✅ Fallback to memory cache
 * ✅ Cache quality tracking (fresh/stale/degraded)
 * ✅ Statistics and monitoring
 */

import { getRedisInstance, getRedisInstanceAsync } from '../config/redisConnectionManager';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

export interface CachedPrice {
  symbol: string;
  exchange: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: number;
}

export interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExchangeMarket {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  maker: number;
  taker: number;
  limits: {
    amount?: { min: number; max: number };
    price?: { min: number; max: number };
    cost?: { min: number; max: number };
  };
}

export interface CacheResponse<T> {
  data: T;
  source: 'cache' | 'fresh';
  quality: 'fresh' | 'stale' | 'degraded';
  timestamp: number;
}

export interface CacheStats {
  totalKeys: number;
  byCategory: {
    prices: number;
    ohlcv: number;
    markets: number;
    other: number;
  };
  memoryUsage: number;
  redisConnected: boolean;
}

class UnifiedCacheService {
  private redis: any = null;
  private fallbackMemory: Map<string, { data: any; expiry: number }> = new Map();
  private isConnected = false;
  private hasLoggedConnection = false; // Track if we've already logged initial connection

  // Cache configuration
  private readonly TTL = {
    PRICE_FRESH: 30,        // 30 seconds
    PRICE_STALE: 300,       // 5 minutes
    OHLCV_FRESH_LIVE: 60,   // 1 minute for recent data
    OHLCV_FRESH_HIST: 300,  // 5 minutes for historical data
    OHLCV_STALE: 3600,      // 1 hour
    MARKETS: 3600,          // 1 hour
    MARKETS_STALE: 86400,   // 1 day
  };

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis(): void {
    try {
      // Use singleton Redis instance from connection manager
      this.redis = getRedisInstance();

      // Connection events are now handled by the singleton manager
      this.isConnected = true;
      if (!this.hasLoggedConnection) {
        this.hasLoggedConnection = true;
        logger.info('✅ Unified Cache Service using singleton Redis');
      }
    } catch (error) {
      logger.error('Failed to initialize Redis for unified cache:', error);
      this.isConnected = false;
    }
  }

  /**
   * Get or fetch price with fresh/stale caching strategy
   * Used by: CCXT Service, CEX Collector
   */
  async getOrFetchPrice(
    exchange: string,
    symbol: string,
    fetcher: () => Promise<CachedPrice | null>
  ): Promise<CacheResponse<CachedPrice>> {
    const key = `prices:${exchange}:${symbol}`;
    const staleKey = `${key}:stale`;
    try {
      // 1. Check fresh cache
      if (this.isConnected && this.redis) {
        const cached = await this.redis.get(key);
        if (cached) {
          return {
            data: JSON.parse(cached),
            source: 'cache',
            quality: 'fresh',
            timestamp: Date.now(),
          };
        }
      }

      // 2. Check stale cache
      let staleData: CachedPrice | null = null;
      if (this.isConnected && this.redis) {
        const stale = await this.redis.get(staleKey);
        if (stale) {
          staleData = JSON.parse(stale);
        }
      } else {
        const memStale = this.fallbackMemory.get(staleKey);
        if (memStale && memStale.expiry > Date.now()) {
          staleData = memStale.data;
        }
      }

      // 3. If stale exists, return it immediately and schedule a lazy background refresh
      if (staleData) {
        setImmediate(() => {
          fetcher()
            .then((fresh) => {
              if (fresh) {
                this.setPrice(key, fresh, false).catch(() => {});
              }
            })
            .catch((error) => {
              logger.debug(`Failed background refresh price ${exchange}:${symbol}:`, error?.message || error);
            });
        });

        return {
          data: staleData,
          source: 'cache',
          quality: 'stale',
          timestamp: Date.now(),
        };
      }

      // 4. No fresh or stale cache — fetch synchronously
      const fresh = await fetcher();
      if (!fresh) {
        throw new Error(`Failed to fetch price for ${exchange}:${symbol}`);
      }

      await this.setPrice(key, fresh, false);

      return {
        data: fresh,
        source: 'fresh',
        quality: 'fresh',
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error getting price ${exchange}:${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Set price in cache (fresh + stale versions)
   */
  private async setPrice(key: string, price: CachedPrice, immediate = true): Promise<void> {
    const staleKey = `${key}:stale`;

    if (this.isConnected && this.redis) {
      const serialized = JSON.stringify(price);
      const operations = [
        this.redis.setex(key, this.TTL.PRICE_FRESH, serialized),
        this.redis.setex(staleKey, this.TTL.PRICE_STALE, serialized),
      ];
      await Promise.all(operations);
    } else {
      // Fallback to memory cache
      const expiry = Date.now() + this.TTL.PRICE_FRESH * 1000;
      this.fallbackMemory.set(key, { data: price, expiry });
      this.fallbackMemory.set(staleKey, {
        data: price,
        expiry: Date.now() + this.TTL.PRICE_STALE * 1000,
      });
    }
  }

  /**
   * Get or fetch OHLCV candles with degradation support
   * Used by: OHLCV Service, Background jobs
   */
  async getOrFetchCandles(
    symbol: string,
    timeframe: string,
    limit: number,
    exchange: string,
    fetcher: () => Promise<OHLCVCandle[]>
  ): Promise<CacheResponse<OHLCVCandle[]>> {
    const key = `ohlcv:${symbol}:${timeframe}:${limit}:${exchange}`;
    const staleKey = `${key}:stale`;

    try {
      // 1. Check fresh cache (with error handling for closed Redis clients)
      if (this.isConnected && this.redis) {
        try {
          const cached = await this.redis.get(key);
          if (cached) {
            return {
              data: JSON.parse(cached),
              source: 'cache',
              quality: 'fresh',
              timestamp: Date.now(),
            };
          }
        } catch (redisError: any) {
          // If Redis is closed/unreachable, fall back to memory cache
          if (redisError?.message?.includes('closed') || redisError?.message?.includes('ECONNREFUSED')) {
            logger.debug(`[Cache] Redis unavailable, falling back to memory cache for ${key}`);
            this.isConnected = false; // Mark Redis as disconnected
          } else {
            // Log other Redis errors but continue
            logger.debug(`[Cache] Redis get error for ${key}: ${redisError?.message}`);
          }
        }
      }

      // 2. Determine fresh TTL based on candle recency
      const freshTTL = limit <= 100 ? this.TTL.OHLCV_FRESH_LIVE : this.TTL.OHLCV_FRESH_HIST;

      // 3. Check stale cache
      let staleData: OHLCVCandle[] | null = null;
      if (this.isConnected && this.redis) {
        const stale = await this.redis.get(staleKey);
        if (stale) {
          staleData = JSON.parse(stale);
        }
      } else {
        const memStale = this.fallbackMemory.get(staleKey);
        if (memStale && memStale.expiry > Date.now()) {
          staleData = memStale.data;
        }
      }

      // If stale available, schedule lazy background refresh and return stale immediately
      if (staleData && staleData.length > 0) {
        setImmediate(() => {
          fetcher()
            .then((fresh) => {
              if (fresh && fresh.length > 0) {
                this.setCandles(key, fresh, freshTTL, false).catch(() => {});
              }
            })
            .catch((error) => {
              logger.debug(`Failed background refresh candles ${symbol}:${timeframe}:`, error?.message || error);
            });
        });

        return {
          data: staleData,
          source: 'cache',
          quality: 'stale',
          timestamp: Date.now(),
        };
      }

      // Otherwise fetch synchronously
      const fresh = await fetcher();

      // If the fetcher returned empty (no market/candle data), return a degraded
      // but graceful response instead of throwing. Throwing here cascades into
      // DB logging attempts and can exhaust connection pools under heavy parallelism.
      if (!fresh || fresh.length === 0) {
        logger.debug(`[Cache] No candle data for ${symbol}:${timeframe} — returning empty degraded response`);

        // Attempt to set an empty cache entry so repeated callers will hit cache briefly
        // and avoid immediate repeated fetch storms. Ignore errors from setting cache.
        try {
          await this.setCandles(key, [], freshTTL, false);
        } catch (err) {
          logger.debug(`[Cache] Failed to set empty candles cache for ${symbol}:${timeframe}:`, (err as any)?.message || err);
        }

        return {
          data: [],
          source: 'fresh',
          quality: 'degraded',
          timestamp: Date.now(),
        };
      }

      await this.setCandles(key, fresh, freshTTL, false);

      return {
        data: fresh,
        source: 'fresh',
        quality: 'fresh',
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error getting candles ${symbol}:${timeframe}:`, error);
      throw error;
    }
  }

  /**
   * Set candles in cache (fresh + stale versions)
   */
  private async setCandles(
    key: string,
    candles: OHLCVCandle[],
    freshTTL: number,
    immediate = true
  ): Promise<void> {
    const staleKey = `${key}:stale`;

    if (this.isConnected && this.redis) {
      const serialized = JSON.stringify(candles);
      const operations = [
        this.redis.setex(key, freshTTL, serialized),
        this.redis.setex(staleKey, this.TTL.OHLCV_STALE, serialized),
      ];
      await Promise.all(operations);
    } else {
      // Fallback to memory cache
      this.fallbackMemory.set(key, {
        data: candles,
        expiry: Date.now() + freshTTL * 1000,
      });
      this.fallbackMemory.set(staleKey, {
        data: candles,
        expiry: Date.now() + this.TTL.OHLCV_STALE * 1000,
      });
    }
  }

  /**
   * Get or load market data with long expiry
   * Used by: CCXT Service, Symbol Universe
   */
  async getOrLoadMarkets(
    exchange: string,
    loader: () => Promise<ExchangeMarket[]>
  ): Promise<CacheResponse<ExchangeMarket[]>> {
    const key = `markets:${exchange}`;
    const staleKey = `${key}:stale`;

    try {
      // 1. Check fresh cache
      if (this.isConnected && this.redis) {
        const cached = await this.redis.get(key);
        if (cached) {
          return {
            data: JSON.parse(cached),
            source: 'cache',
            quality: 'fresh',
            timestamp: Date.now(),
          };
        }
      }

      // 2. Check stale cache
      let staleData: ExchangeMarket[] | null = null;
      if (this.isConnected && this.redis) {
        const stale = await this.redis.get(staleKey);
        if (stale) {
          staleData = JSON.parse(stale);
        }
      } else {
        const memStale = this.fallbackMemory.get(staleKey);
        if (memStale && memStale.expiry > Date.now()) {
          staleData = memStale.data;
        }
      }

      // 3. Load fresh
      const fresh = await loader();

      if (!fresh || fresh.length === 0) {
        if (staleData && staleData.length > 0) {
          return {
            data: staleData,
            source: 'cache',
            quality: 'stale',
            timestamp: Date.now(),
          };
        }
        throw new Error(`Failed to load markets for ${exchange}`);
      }

      // Store both fresh and stale
      if (this.isConnected && this.redis) {
        const serialized = JSON.stringify(fresh);
        await Promise.all([
          this.redis.setex(key, this.TTL.MARKETS, serialized),
          this.redis.setex(staleKey, this.TTL.MARKETS_STALE, serialized),
        ]);
      } else {
        this.fallbackMemory.set(key, {
          data: fresh,
          expiry: Date.now() + this.TTL.MARKETS * 1000,
        });
        this.fallbackMemory.set(staleKey, {
          data: fresh,
          expiry: Date.now() + this.TTL.MARKETS_STALE * 1000,
        });
      }

      return {
        data: fresh,
        source: 'fresh',
        quality: 'fresh',
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error getting markets for ${exchange}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate cache by pattern
   * Example: invalidatePattern('prices:binance:*')
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      let deletedCount = 0;

      if (this.isConnected && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          deletedCount = await this.redis.del(...keys);

          // Also delete stale versions
          const stalePattern = `${pattern}:stale`;
          const staleKeys = await this.redis.keys(stalePattern);
          if (staleKeys.length > 0) {
            deletedCount += await this.redis.del(...staleKeys);
          }
        }
      } else {
        // Memory fallback: simple pattern matching
        const regexPattern = pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`);
        for (const key of Array.from(this.fallbackMemory.keys())) {
          if (regex.test(key)) {
            this.fallbackMemory.delete(key);
            deletedCount++;
          }
        }
      }

      logger.debug(`Invalidated ${deletedCount} cache keys matching pattern: ${pattern}`);
      return deletedCount;
    } catch (error) {
      logger.error(`Error invalidating cache pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      if (this.isConnected && this.redis) {
        await this.redis.flushdb();
        logger.info('✅ Unified cache cleared (Redis)');
      } else {
        this.fallbackMemory.clear();
        logger.info('✅ Unified cache cleared (Memory)');
      }
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      let totalKeys = 0;
      let memoryUsage = 0;
      const categories = {
        prices: 0,
        ohlcv: 0,
        markets: 0,
        other: 0,
      };

      if (this.isConnected && this.redis) {
        const allKeys = await this.redis.keys('*');
        totalKeys = allKeys.length;

        for (const key of allKeys) {
          if (key.includes('prices:')) categories.prices++;
          else if (key.includes('ohlcv:')) categories.ohlcv++;
          else if (key.includes('markets:')) categories.markets++;
          else categories.other++;
        }

        const info = await this.redis.info('memory');
        const match = info.match(/used_memory:(\d+)/);
        memoryUsage = match ? parseInt(match[1]) : 0;

        return {
          totalKeys,
          byCategory: categories,
          memoryUsage,
          redisConnected: true,
        };
      } else {
        // Memory fallback stats
        totalKeys = this.fallbackMemory.size;

        for (const key of Array.from(this.fallbackMemory.keys())) {
          if (key.includes('prices:')) categories.prices++;
          else if (key.includes('ohlcv:')) categories.ohlcv++;
          else if (key.includes('markets:')) categories.markets++;
          else categories.other++;
        }

        // Rough memory estimate (8 bytes per entry + key size)
        memoryUsage = Array.from(this.fallbackMemory.keys()).reduce(
          (sum, key) => sum + key.length + 8,
          0
        );

        return {
          totalKeys,
          byCategory: categories,
          memoryUsage,
          redisConnected: false,
        };
      }
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        totalKeys: 0,
        byCategory: { prices: 0, ohlcv: 0, markets: 0, other: 0 },
        memoryUsage: 0,
        redisConnected: this.isConnected,
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.isConnected && this.redis) {
        await this.redis.ping();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Cache health check failed:', error);
      return false;
    }
  }
}

export const unifiedCache = new UnifiedCacheService();
