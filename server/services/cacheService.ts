/**
 * Redis Cache Service — Centralized Caching Layer
 * 
 * Distributed caching for multi-instance deployments.
 * Replaces in-memory NodeCache with Redis for production.
 * 
 * Features:
 * - Centralized cache for all instances
 * - Cache warming for high-traffic keys
 * - TTL management and expiration
 * - Cache statistics and monitoring
 * - Pub/Sub for real-time signals
 * - Graceful fallback if Redis unavailable
 * - deleteByPrefix / delMany for bulk operations
 * 
 * Consumers:
 *   • OHLCVService — candle caching, cache invalidation
 *   • signalsStreamer — Redis pub/sub for live alerts
 *   • MarketUniverseBuilder — registry warming
 */

import { redis as redisService } from './redis';
import type { RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { getRedisSubscriptionManager } from './redisSubscriptionManager';

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
  private client: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private fallbackMode: boolean = false;
  private memoryCache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };

  private static instance: RedisCacheService;

  private constructor() {}

  static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  async initialize(): Promise<void> {
    try {
      await redisService.connect();
      const healthy = await redisService.healthCheck();
      if (healthy) {
        logger.info('[RedisCache] Initialized via unified redis service');
        this.fallbackMode = false;
        this.client = null; // never use direct client
      } else {
        logger.warn('[RedisCache] Redis unavailable; using in-memory fallback');
        this.fallbackMode = true;
        this.client = null;
      }
    } catch (error: any) {
      const msg = error?.message || String(error) || 'Unknown Redis error';
      logger.warn(`[RedisCache] Fallback mode: ${msg}`);
      this.fallbackMode = true;
      this.client = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CORE CACHE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  async get<T = any>(key: string): Promise<T | null> {
    try {
      if (this.fallbackMode) return this.getFromMemory<T>(key);

      const data = await redisService.get(key);
      if (data) {
        this.stats.hits++;
        try { return JSON.parse(data); } catch { return data as any; }
      }

      this.stats.misses++;
      return null;
    } catch (error: any) {
      logger.warn(`[RedisCache] GET error for ${key}:`, error.message);
      return this.getFromMemory<T>(key);
    }
  }

  async set<T = any>(key: string, value: T, ttl: number = 300, source?: string): Promise<void> {
    try {
      if (this.fallbackMode) {
        this.setInMemory(key, value, ttl);
        return;
      }

      const serialized = JSON.stringify(value);
      await redisService.set(key, serialized, ttl);
      this.stats.sets++;
    } catch (error: any) {
      logger.warn(`[RedisCache] SET error for ${key}:`, error.message);
      this.setInMemory(key, value, ttl);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.fallbackMode) {
        this.memoryCache.delete(key);
        return;
      }
      await redisService.del(key);
      this.stats.deletes++;
    } catch (error: any) {
      logger.warn(`[RedisCache] DEL error for ${key}:`, error.message);
      this.memoryCache.delete(key);
    }
  }

  /**
   * Legacy alias used by earlier cache callers.
   */
  async del(keyOrKeys: string | string[]): Promise<void> {
    if (Array.isArray(keyOrKeys)) {
      await this.delMany(keyOrKeys);
      return;
    }
    await this.delete(keyOrKeys);
  }

  async mget<T = any>(keys: string[]): Promise<Array<T | null>> {
    return Promise.all(keys.map((key) => this.get<T>(key)));
  }

  async mset(entries: Array<[string, any, number?]>): Promise<void> {
    await Promise.all(
      entries.map(([key, value, ttl]) => this.set(key, value, ttl ?? 300))
    );
  }

  /**
   * Delete multiple keys at once (variadic DEL).
   * Used by OHLCVService.clearCache() for bulk invalidation.
   */
  async delMany(keys: string[]): Promise<void> {
    if (!keys || keys.length === 0) return;

    try {
      if (this.fallbackMode) {
        for (const k of keys) this.memoryCache.delete(k);
        return;
      }
      await redisService.delMany(keys);
      this.stats.deletes += keys.length;
    } catch (error: any) {
      logger.warn(`[RedisCache] DEL many error:`, error.message);
      for (const k of keys) this.memoryCache.delete(k);
    }
  }

  /**
   * Delete all keys matching a prefix.
   * Uses Redis SCAN + DEL pipeline for safety on large keyspaces.
   * Used by OHLCVService.clearCache(symbol).
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      if (this.fallbackMode) {
        for (const key of this.memoryCache.keys()) {
          if (key.startsWith(prefix)) this.memoryCache.delete(key);
        }
        return;
      }

      await redisService.deleteByPrefix(prefix);
      logger.info(`[RedisCache] Deleted keys matching ${prefix}*`);
    } catch (error: any) {
      logger.warn(`[RedisCache] deleteByPrefix error for ${prefix}:`, error.message);
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) this.memoryCache.delete(key);
      }
    }
  }

  /**
   * List keys matching a Redis glob pattern.
   * Uses SCAN in production; KEYS only in fallback.
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      if (this.fallbackMode) {
        const regex = this.globToRegex(pattern);
        return Array.from(this.memoryCache.keys()).filter(k => regex.test(k));
      }
      return await redisService.keys(pattern);
    } catch (error: any) {
      logger.warn(`[RedisCache] KEYS error for ${pattern}:`, error.message);
      const regex = this.globToRegex(pattern);
      return Array.from(this.memoryCache.keys()).filter(k => regex.test(k));
    }
  }

  /**
   * Clear all cache, optionally filtered by pattern.
   */
  async clear(pattern?: string): Promise<void> {
    try {
      if (this.fallbackMode) {
        if (pattern) {
          const regex = new RegExp(pattern);
          for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) this.memoryCache.delete(key);
          }
        } else {
          this.memoryCache.clear();
        }
        return;
      }

      await redisService.clear(pattern);
    } catch (error: any) {
      logger.warn('[RedisCache] CLEAR error:', error.message);
      this.memoryCache.clear();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUB/SUB — Real-Time Signals
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Publish a message to a Redis channel.
   * Used by signalsStreamer for live alerts.
   */
  async publish(channel: string, message: string): Promise<number> {
    try {
      if (this.fallbackMode) {
        logger.debug('[RedisCache] Publish skipped in fallback mode');
        return 0;
      }
      return await redisService.publish(channel, message);
    } catch (error: any) {
      logger.warn(`[RedisCache] PUBLISH error to ${channel}:`, error.message);
      return 0;
    }
  }

  /**
   * Get a dedicated subscriber client for pub/sub.
   * Reuses a single subscriber connection.
   */
  async getSubscriber(): Promise<RedisClientType> {
    if (this.subscriber) return this.subscriber;
    const sub = await redisService.getSubscriber();
    // ensure returned value is non-null RedisClientType
    if (!sub) throw new Error('[RedisCache] getSubscriber returned null');
    const subscriberClient = sub as RedisClientType;
    this.subscriber = subscriberClient;
    return subscriberClient;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATS & MONITORING
  // ═══════════════════════════════════════════════════════════════════════════════

  async getStats(): Promise<CacheStats> {
    try {
      let totalKeys = 0;
      let keysByCategory: Record<string, number> = {};

      if (this.fallbackMode) {
        totalKeys = this.memoryCache.size;
        for (const key of this.memoryCache.keys()) {
          const category = key.split(':')[0];
          keysByCategory[category] = (keysByCategory[category] || 0) + 1;
        }
      } else {
        totalKeys = await redisService.getStats().then(s => s.totalKeys).catch(() => 0);
        const patterns = ['ticker:*', 'ohlcv:*', 'orderbook:*', 'trades:*', 'markets:*'];
        for (const pattern of patterns) {
          const keys = await this.keys(pattern);
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
        topKeys: [],
      };
    } catch (error: any) {
      logger.error('[RedisCache] Stats error:', error);
      return { totalKeys: 0, totalHits: this.stats.hits, totalMisses: this.stats.misses, hitRate: 0, keysByCategory: {}, topKeys: [] };
    }
  }

  async healthCheck(): Promise<boolean> {
    if (this.fallbackMode) return false;
    try {
      return await redisService.healthCheck();
    } catch { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CACHE WARMING
  // ═══════════════════════════════════════════════════════════════════════════════

  async warmCache(entries: Array<{ key: string; value: any; ttl: number }>): Promise<void> {
    logger.info(`[RedisCache] Warming ${entries.length} entries...`);
    for (const { key, value, ttl } of entries) {
      await this.set(key, value, ttl, 'cache-warmer');
    }
    logger.info('[RedisCache] Warm complete');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS (Pattern-based)
  // ═══════════════════════════════════════════════════════════════════════════════

  async subscribe(pattern: string, callback: (key: string, value: any) => void): Promise<void> {
    if (this.fallbackMode) {
      logger.warn('[RedisCache] Subscriptions not available in fallback mode');
      return;
    }
    try {
      const manager = await getRedisSubscriptionManager();
      await manager.pSubscribe(pattern, (message: string, channel: string) => {
        try {
          callback(channel, message as any);
        } catch (_) {}
      });
    } catch (error: any) {
      logger.error('[RedisCache] Subscription setup error:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════════

  async disconnect(): Promise<void> {
    if (this.subscriber) {
      try { await this.subscriber.quit(); } catch (e) {}
      this.subscriber = null;
    }
    try { await redisService.disconnect(); } catch (e) {}
    this.client = null;
    logger.info('[RedisCache] Disconnected');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private getFromMemory<T = any>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl * 1000) {
      this.memoryCache.delete(key);
      return null;
    }
    entry.hits++;
    return entry.data;
  }

  private setInMemory<T = any>(key: string, value: T, ttl: number): void {
    this.memoryCache.set(key, { data: value, timestamp: Date.now(), ttl, hits: 0 });
    if (this.memoryCache.size > 10000) {
      const oldest = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)
        .slice(0, 1000);
      for (const [k] of oldest) this.memoryCache.delete(k);
    }
  }

  private globToRegex(pattern: string): RegExp {
    const esc = (s: string) => s.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
    return new RegExp('^' + pattern.split('*').map(esc).join('.*') + '$');
  }
}

// Singleton export
export const cacheService = RedisCacheService.getInstance();