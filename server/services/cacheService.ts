/**
 * Redis Cache Service
 * 
 * Distributed caching layer for multi-instance deployments
 * Replaces in-memory NodeCache with Redis for production
 * 
 * Features:
 * - Centralized cache for all instances
 * - Cache warming for high-traffic keys
 * - TTL management and expiration
 * - Cache statistics and monitoring
 * - Graceful fallback if Redis unavailable
 */

import { getRedisInstance, getRedisInstanceAsync } from '../config/redisConnectionManager';
import type { Redis } from 'ioredis';
import { logger } from '../utils/logger';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  source?: string;
}

export interface CacheStats {
  totalKeys: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  keysByCategory: Record<string, number>;
  topKeys: Array<{ key: string; hits: number; size: number }>;
}

/**
 * Redis Cache Service Singleton
 */
export class RedisCacheService {
  private client: Redis | null = null;
  private fallbackMode: boolean = false;
  private memoryCache = new Map<string, CacheEntry>(); // Fallback in-memory cache
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  private static instance: RedisCacheService;

  private constructor() {}

  static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  /**
   * Initialize Redis connection via singleton manager
   * Gracefully falls back to in-memory cache if Redis unavailable
   */
  async initialize(): Promise<void> {
    try {
      // Use singleton Redis instance from connection manager
      this.client = getRedisInstance() as any;
      
      // Test connection
      const pong = await this.client!.ping();
      if (pong === 'PONG') {
        logger.info('✅ Redis cache initialized via singleton');
        this.fallbackMode = false;
        
        // Initialize concurrency managers
        const { initializeConcurrencyManagers } = require('./concurrencyControl');
        initializeConcurrencyManagers(this.client);
      }
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || 'Unknown Redis error';
      logger.warn(`⚠️ Redis initialization failed, using in-memory cache: ${errorMessage}`);
      this.fallbackMode = true;
      this.client = null;
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      if (this.fallbackMode || !this.client) {
        return this.getFromMemory<T>(key);
      }

      const data = await this.client.get(key);
      if (data) {
        this.stats.hits++;
        try {
          return JSON.parse(data);
        } catch {
          return data as any;
        }
      }

      this.stats.misses++;
      return null;
    } catch (error: any) {
      logger.warn(`Cache get error for key ${key}:`, error.message);
      return this.getFromMemory<T>(key);
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T = any>(key: string, value: T, ttl: number = 300, source?: string): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl,
        hits: 0,
        source,
      };

      if (this.fallbackMode || !this.client) {
        this.setInMemory(key, value, ttl);
        return;
      }

      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttl, serialized);
      this.stats.sets++;
    } catch (error: any) {
      logger.warn(`Cache set error for key ${key}:`, error.message);
      this.setInMemory(key, value, ttl);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.fallbackMode || !this.client) {
        this.memoryCache.delete(key);
        return;
      }

      await this.client.del(key);
      this.stats.deletes++;
    } catch (error: any) {
      logger.warn(`Cache delete error for key ${key}:`, error.message);
      this.memoryCache.delete(key);
    }
  }

  /**
   * Clear all cache
   */
  async clear(pattern?: string): Promise<void> {
    try {
      if (this.fallbackMode || !this.client) {
        if (pattern) {
          const regex = new RegExp(pattern);
          for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
              this.memoryCache.delete(key);
            }
          }
        } else {
          this.memoryCache.clear();
        }
        return;
      }

      if (pattern) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } else {
        await this.client.flushdb();
      }
    } catch (error: any) {
      logger.warn('Cache clear error:', error.message);
      this.memoryCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      let totalKeys = 0;
      let keysByCategory: Record<string, number> = {};

      if (this.fallbackMode || !this.client) {
        totalKeys = this.memoryCache.size;
        // Categorize keys from memory
        for (const key of this.memoryCache.keys()) {
          const category = key.split(':')[0];
          keysByCategory[category] = (keysByCategory[category] || 0) + 1;
        }
      } else {
        const dbSize = await this.client.dbsize();
        totalKeys = dbSize;

        // Get keys by pattern
        const patterns = ['ticker:*', 'ohlcv:*', 'orderbook:*', 'trades:*', 'markets:*'];
        for (const pattern of patterns) {
          const keys = await this.client.keys(pattern);
          keysByCategory[pattern] = keys.length;
        }
      }

      const hitRate = this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

      return {
        totalKeys,
        totalHits: this.stats.hits,
        totalMisses: this.stats.misses,
        hitRate: parseFloat(hitRate.toFixed(2)),
        keysByCategory,
        topKeys: [], // TODO: Implement top keys tracking
      };
    } catch (error: any) {
      logger.error('Error getting cache stats:', error);
      return {
        totalKeys: 0,
        totalHits: this.stats.hits,
        totalMisses: this.stats.misses,
        hitRate: 0,
        keysByCategory: {},
        topKeys: [],
      };
    }
  }

  /**
   * Warm cache with pre-loaded data
   * Called on startup to load high-traffic keys
   */
  async warmCache(keys: Array<{ key: string; value: any; ttl: number }>): Promise<void> {
    logger.info(`🔥 Warming cache with ${keys.length} entries...`);

    try {
      for (const { key, value, ttl } of keys) {
        await this.set(key, value, ttl, 'cache-warmer');
      }

      logger.info(`✅ Cache warm complete`);
    } catch (error: any) {
      logger.error('Error warming cache:', error);
    }
  }

  /**
   * Subscribe to cache key changes
   * Useful for invalidation patterns
   */
  async subscribe(pattern: string, callback: (key: string, value: any) => void): Promise<void> {
    if (this.fallbackMode || !this.client) {
      logger.warn('Subscriptions not available in fallback mode');
      return;
    }

    try {
      const subscriber = this.client.duplicate();
      await subscriber.psubscribe(pattern, (err) => {
        if (err) {
          logger.error('Subscribe error:', err);
        }
      });

      subscriber.on('pmessage', (pattern, key, value) => {
        callback(key, value);
      });
    } catch (error: any) {
      logger.error('Error setting up subscription:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (this.fallbackMode || !this.client) {
      return false; // Not available in fallback mode
    }

    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * In-memory fallback methods
   */
  private getFromMemory<T = any>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl * 1000) {
      this.memoryCache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  private setInMemory<T = any>(key: string, value: T, ttl: number): void {
    this.memoryCache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl,
      hits: 0,
    });

    // Auto-cleanup old entries
    if (this.memoryCache.size > 10000) {
      const oldest = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)
        .slice(0, 1000);

      for (const [key] of oldest) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis disconnected');
      } catch (error: any) {
        logger.error('Error disconnecting Redis:', error);
      }
    }
  }
}

// Export singleton instance
export const cacheService = RedisCacheService.getInstance();
