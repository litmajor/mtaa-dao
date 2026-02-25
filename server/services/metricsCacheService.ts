/**
 * ⚠️ DEPRECATED - Metrics Cache Service
 * 
 * This service has been consolidated into DataCacheConsolidation (Phase 4)
 * 
 * MIGRATION GUIDE:
 * Old pattern (direct cache service):
 *   import { MetricsCacheService } from './metricsCacheService'
 *   await MetricsCacheService.set('metrics:platform', data, TTL)
 *   const data = await MetricsCacheService.get('metrics:platform')
 * 
 * New pattern (unified cache):
 *   import { cacheManager } from '../core/consolidation/DataCacheConsolidation'
 *   await cacheManager.set('platform_metrics', data, { ttl: 60 })
 *   const data = cacheManager.get('platform_metrics')
 * 
 * Cache names mapping:
 *   - 'metrics:platform' → 'platform_metrics' (TTL: 60s)
 *   - 'metrics:defi:protocols' → 'defi_protocols' (TTL: 120s)
 *   - 'metrics:cefi:exchanges' → 'cefi_exchanges' (TTL: 120s)
 *   - All other metrics use same naming with underscores
 * 
 * Benefits of consolidation:
 *   - Unified cache backend (memory/Redis/hybrid)
 *   - Automatic LRU eviction
 *   - Performance monitoring built-in
 *   - Better memory management
 * 
 * This service will be removed in v2.0. Please migrate to DataCacheConsolidation.
 * For questions: See CONSOLIDATION_INTEGRATION_GUIDE.md
 */

/**
 * Metrics Cache Service
 * Redis-based caching for high-performance metric retrieval
 * Last Updated: January 22, 2026
 */

import { logger } from '../utils/logger';

// Redis cache keys and TTLs
export const CACHE_KEYS = {
  // Monitoring metrics (60s - 5m TTL)
  PLATFORM_METRICS: 'metrics:platform',
  DEFI_PROTOCOLS: 'metrics:defi:protocols',
  CEFI_EXCHANGES: 'metrics:cefi:exchanges',
  BLOCKCHAIN_HEALTH: 'metrics:blockchain:health',
  LIQUIDITY_POOLS: 'metrics:liquidity:pools',
  REVENUE_METRICS: 'metrics:revenue',
  PAYMENT_PROVIDERS: 'metrics:payments',
  AGENTS: 'metrics:agents',
  API_USAGE: 'metrics:api:usage',
  PLATFORM_GROWTH: 'metrics:growth',

  // Community metrics (5m - 10m TTL)
  REFERRAL_METRICS: 'metrics:referrals',
  LEADERBOARD: 'metrics:leaderboard',
  REWARDS: 'metrics:rewards',
  ACHIEVEMENTS: 'metrics:achievements',
  ANNOUNCEMENTS: 'metrics:announcements',
  DAO_ANALYTICS: 'metrics:dao:analytics',

  // Support metrics (10m TTL)
  SUPPORT_TICKETS: 'metrics:support',
};

export const CACHE_TTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 600,     // 10 minutes
  LONG: 1800,      // 30 minutes
  HOURLY: 3600,    // 1 hour
};

export class MetricsCacheService {
  /**
   * Set cache value with TTL
   */
  static async set(key: string, value: any, ttl: number = CACHE_TTL.MEDIUM): Promise<void> {
    try {
      // Redis client would be initialized here
      // For now, using in-memory cache as fallback
      const cacheEntry = {
        value,
        expiresAt: Date.now() + (ttl * 1000),
      };
      
      // Store in global cache (implement Redis later)
      globalThis._metricCache = globalThis._metricCache || {};
      globalThis._metricCache[key] = cacheEntry;
      
      logger.debug(`Cache set: ${key} with TTL ${ttl}s`);
    } catch (error) {
      logger.error(`Cache set error for ${key}:`, error);
      // Non-critical error, continue without cache
    }
  }

  /**
   * Get cache value
   */
  static async get(key: string): Promise<any | null> {
    try {
      // Check in-memory cache
      const cache = globalThis._metricCache || {};
      const entry = cache[key];

      if (!entry) {
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        delete cache[key];
        return null;
      }

      logger.debug(`Cache hit: ${key}`);
      return entry.value;
    } catch (error) {
      logger.error(`Cache get error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete cache value
   */
  static async delete(key: string): Promise<void> {
    try {
      const cache = globalThis._metricCache || {};
      delete cache[key];
      logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      logger.error(`Cache delete error for ${key}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  static async clearAll(): Promise<void> {
    try {
      globalThis._metricCache = {};
      logger.info('All cache cleared');
    } catch (error) {
      logger.error('Cache clear all error:', error);
    }
  }

  /**
   * Get or set with loader function
   */
  static async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<T> {
    try {
      // Try to get from cache
      const cached = await this.get(key);
      if (cached !== null) {
        return cached as T;
      }

      // Load from source
      const value = await loader();

      // Store in cache
      await this.set(key, value, ttl);

      return value;
    } catch (error) {
      logger.error(`GetOrSet error for ${key}:`, error);
      // If cache fails, still call loader
      return loader();
    }
  }

  /**
   * Invalidate related metrics cache
   */
  static async invalidateMetricsCategory(category: string): Promise<void> {
    try {
      const cache = globalThis._metricCache || {};
      const keysToDelete = Object.keys(cache).filter(key => 
        key.includes(`metrics:${category}`)
      );

      for (const key of keysToDelete) {
        delete cache[key];
      }

      logger.info(`Invalidated ${keysToDelete.length} cache entries for ${category}`);
    } catch (error) {
      logger.error(`Cache invalidation error for ${category}:`, error);
    }
  }

  /**
   * Set cache batch
   */
  static async setBatch(entries: Array<{key: string, value: any, ttl?: number}>): Promise<void> {
    try {
      for (const entry of entries) {
        await this.set(entry.key, entry.value, entry.ttl);
      }
      logger.debug(`Cache batch set: ${entries.length} entries`);
    } catch (error) {
      logger.error('Cache batch set error:', error);
    }
  }

  /**
   * Get cache stats
   */
  static async getStats(): Promise<{
    entries: number;
    size: string;
    ttl: number;
  }> {
    try {
      const cache = globalThis._metricCache || {};
      const entries = Object.keys(cache).length;
      
      // Cleanup expired entries
      const now = Date.now();
      let cleanedCount = 0;
      for (const [key, entry] of Object.entries(cache)) {
        if (entry && (entry as any).expiresAt < now) {
          delete cache[key];
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
      }

      return {
        entries: Object.keys(cache).length,
        size: `${JSON.stringify(cache).length} bytes`,
        ttl: CACHE_TTL.MEDIUM,
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return { entries: 0, size: '0 bytes', ttl: 0 };
    }
  }
}

// Global type definitions for cache
declare global {
  namespace globalThis {
    var _metricCache: Record<string, any>;
  }
}
