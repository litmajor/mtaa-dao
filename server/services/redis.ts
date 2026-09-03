/**
 * Unified Redis Service
 * 
 * Single Redis client for the entire backend. Replaces both:
 *   • RedisService (redis package, basic ops)
 *   • CacheService (ioredis, caching layer)
 * 
 * Uses the `redis` package (node-redis v4) client returned by
 * redisConnectionManager, while keeping the full API surface of both
 * predecessors.
 * 
 * Consumers:
 *   • OHLCVService — get/set/del/keys/delMany/deleteByPrefix, pub/sub
 *   • signalsStreamer — publish, getSubscriber
 *   • MarketUniverseBuilder — warmCache, getStats
 *   • Any service needing incr, expire, setnx
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX (2026-07-07): Two separate bugs, both now fixed:
 *
 * 1. This file was typed and coded against the ioredis API (`Redis` from
 *    'ioredis'), but redisConnectionManager.ts actually hands back a
 *    node-redis v4 client (`createClient` from the `redis` package). The two
 *    libraries have different method names/signatures:
 *      - ioredis `scanStream()`        → node-redis `scanIterator()`
 *        (and it yields ONE key at a time, not batches of keys)
 *      - ioredis `.set(k, v, 'EX', t)` → node-redis `.set(k, v, { EX: t })`
 *      - ioredis `.dbsize()`           → node-redis `.dbSize()`
 *      - ioredis `.flushdb()`          → node-redis `.flushDb()`
 *    Every call site using the old ioredis-style API has been corrected
 *    below. The `Redis` type import from 'ioredis' has been removed since
 *    the underlying client is not actually an ioredis instance.
 *
 * 2. `connect()` previously called `getRedisInstance()` expecting a NEW
 *    client whenever the old one died — but the singleton manager used to
 *    keep handing back the same dead client forever. redisConnectionManager
 *    now self-heals (clears its singleton on socket 'end'), so calling
 *    getRedisInstance() again inside scheduleReconnect() now actually
 *    returns a fresh, connecting client. No change needed here beyond that
 *    upstream fix, but the reconnect path has been tightened so it doesn't
 *    stack duplicate listeners on repeated reconnects.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getRedisInstanceAsync } from '../config/redisConnectionManager';
import type { RedisClientType } from 'redis';
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
 * Unified Redis Service — singleton
 */
export class UnifiedRedisService {
  private client: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private fallbackMode = false;
  private memoryCache = new Map<string, CacheEntry>();
  private readonly securitySensitivePrefixes = ['token:blacklist', 'rate_limit', 'otp', 'idempotency'];
  private stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  private hasLoggedFallback = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private connectPromise: Promise<void> | null = null;

  private static instance: UnifiedRedisService;

  private constructor() {}

  static getInstance(): UnifiedRedisService {
    if (!UnifiedRedisService.instance) {
      UnifiedRedisService.instance = new UnifiedRedisService();
    }
    return UnifiedRedisService.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONNECTION
  // ═══════════════════════════════════════════════════════════════════════════════

  async connect(): Promise<void> {
    if (this.client?.isOpen) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      try {
        const instance = await getRedisInstanceAsync();
      if (!instance) throw new Error('Redis instance not available from connection manager');
      this.client = instance;

      const pong = await this.client.ping();
      if (pong === 'PONG') {
        logger.info('[UnifiedRedis] Connected');
        this.fallbackMode = false;
        this.reconnectAttempts = 0;

        // Avoid stacking duplicate listeners across repeated connect() calls
        // on what might be a client we've already wired up.
        this.client.removeAllListeners('error');
        this.client.removeAllListeners('end');
        this.client.removeAllListeners('close');

        this.client.on('error', (err: Error) => {
          logger.warn('[UnifiedRedis] client error', { message: err.message });
          this.fallbackMode = true;
          this.scheduleReconnect();
        });
        this.client.on('end', () => {
          logger.warn('[UnifiedRedis] client connection ended');
          this.fallbackMode = true;
          this.scheduleReconnect();
        });
        this.client.on('close', () => {
          logger.warn('[UnifiedRedis] client connection closed');
          this.fallbackMode = true;
          this.scheduleReconnect();
        });

        // Wire up concurrency managers if they exist
        try {
          const { initializeConcurrencyManagers } = require('./concurrencyControl');
          initializeConcurrencyManagers(this.client);
        } catch {
          // concurrencyControl not available
        }
      }
      } catch (error: any) {
        logger.error('[UnifiedRedis] Connection failed:', error.message);
        this.fallbackMode = true;
        this.client = null;
        this.scheduleReconnect();
      }
    })();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private waitForReady(client: RedisClientType): Promise<void> {
    return new Promise((resolve, reject) => {
      if (client.isOpen) {
        resolve();
        return;
      }
      const onReady = () => {
        client.removeListener('error', onError);
        resolve();
      };
      const onError = (err: Error) => {
        client.removeListener('ready', onReady);
        reject(err);
      };
      client.once('ready', onReady);
      client.once('error', onError);

      setTimeout(() => {
        client.removeListener('ready', onReady);
        client.removeListener('error', onError);
        reject(new Error('[UnifiedRedis] Timed out waiting for client ready'));
      }, 5000);
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client || this.fallbackMode || !this.client.isOpen) {
      await this.connect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    // Exponential backoff with jitter, capped at 60s
    const base = Math.min(60000, 1000 * Math.pow(2, this.reconnectAttempts));
    const jitter = Math.floor(Math.random() * 1000);
    const delay = Math.min(60000, base + jitter);
    this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, 10);
    this.reconnectTimer = setTimeout(() => {
      logger.info('[UnifiedRedis] Reconnecting... attempt=' + this.reconnectAttempts);
      this.connect();
    }, delay);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CORE CACHE OPERATIONS (from RedisCacheService)
  // ═══════════════════════════════════════════════════════════════════════════════

  async get<T = any>(key: string): Promise<T | null> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        if (this.isSecuritySensitiveKey(key)) {
          throw new Error(`[UnifiedRedis] Redis unavailable for security-sensitive key ${key}`);
        }
        return this.getFromMemory<T>(key);
      }

      const data = await this.client.get(key);
      if (data) {
        this.stats.hits++;
        try { return JSON.parse(data); } catch { return data as any; }
      }
      this.stats.misses++;
      return null;
    } catch (error: any) {
      logger.warn(`[UnifiedRedis] GET error for ${key}:`, error.message);
      this.fallbackMode = true;
      if (this.isSecuritySensitiveKey(key)) {
        throw error;
      }
      return this.getFromMemory<T>(key);
    }
  }

  async set<T = any>(key: string, value: T, ttlSeconds?: number, source?: string): Promise<void> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        if (this.isSecuritySensitiveKey(key)) {
          throw new Error(`[UnifiedRedis] Redis unavailable for security-sensitive key ${key}`);
        }
        this.setInMemory(key, value, ttlSeconds ?? 300);
        return;
      }
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.set(key, serialized, { EX: ttlSeconds });
      } else {
        await this.client.set(key, serialized);
      }
      this.stats.sets++;
    } catch (error: any) {
      logger.warn(`[UnifiedRedis] SET error for ${key}:`, error.message);
      this.fallbackMode = true;
      if (this.isSecuritySensitiveKey(key)) {
        throw error;
      }
      this.setInMemory(key, value, ttlSeconds ?? 300);
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        this.memoryCache.delete(key);
        return;
      }
      await this.client.del(key);
      this.stats.deletes++;
    } catch (error: any) {
      logger.warn(`[UnifiedRedis] DEL error for ${key}:`, error.message);
      this.fallbackMode = true;
      this.memoryCache.delete(key);
    }
  }

  // Compatibility alias: some callers expect `del`
  async del(key: string): Promise<void> {
    return this.delete(key);
  }

  async delMany(keys: string[]): Promise<void> {
    if (!keys?.length) return;
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        for (const k of keys) this.memoryCache.delete(k);
        return;
      }
      await this.client.del(keys);
      this.stats.deletes += keys.length;
    } catch (error: any) {
      logger.warn('[UnifiedRedis] DEL many error:', error.message);
      this.fallbackMode = true;
      for (const k of keys) this.memoryCache.delete(k);
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        for (const key of this.memoryCache.keys()) {
          if (key.startsWith(prefix)) this.memoryCache.delete(key);
        }
        return;
      }

      // node-redis v4's scanIterator yields ONE key per iteration, not
      // arrays of keys (that's the ioredis scanStream behavior). Batch
      // manually before flushing to delMany.
      let batch: string[] = [];
      for await (const key of this.client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
        batch.push(key as unknown as string);
        if (batch.length >= 100) {
          await this.delMany(batch);
          batch = [];
        }
      }
      if (batch.length) await this.delMany(batch);

      logger.info(`[UnifiedRedis] Deleted keys matching ${prefix}*`);
    } catch (error: any) {
      logger.warn(`[UnifiedRedis] deleteByPrefix error for ${prefix}:`, error.message);
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) this.memoryCache.delete(key);
      }
    }
  }

  async keys(pattern: string): Promise<string[]> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        const regex = this.globToRegex(pattern);
        return Array.from(this.memoryCache.keys()).filter(k => regex.test(k));
      }

      const results: string[] = [];
      for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        results.push(key as unknown as string);
      }
      return results;
    } catch (error: any) {
      logger.warn(`[UnifiedRedis] KEYS error for ${pattern}:`, error.message);
      const regex = this.globToRegex(pattern);
      return Array.from(this.memoryCache.keys()).filter(k => regex.test(k));
    }
  }

  async clear(pattern?: string): Promise<void> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
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

      if (pattern) {
        const keys = await this.keys(pattern);
        if (keys.length) await this.delMany(keys);
      } else {
        await this.client.flushDb();
      }
    } catch (error: any) {
      logger.warn('[UnifiedRedis] CLEAR error:', error.message);
      this.memoryCache.clear();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ATOMIC OPERATIONS (from RedisService)
  // ═══════════════════════════════════════════════════════════════════════════════

  async incr(key: string): Promise<number> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        if (this.isSecuritySensitiveKey(key)) {
          throw new Error(`[UnifiedRedis] Redis unavailable for security-sensitive key ${key}`);
        }
        return this.incrFallback(key);
      }
      return Number(await this.client.incr(key));
    } catch (error: any) {
      logger.warn('[UnifiedRedis] INCR error', { key, message: error.message });
      this.fallbackMode = true;
      if (this.isSecuritySensitiveKey(key)) {
        throw error;
      }
      return this.incrFallback(key);
    }
  }

  // Backward-compatible alias for legacy callers using ioredis-style naming.
  async increment(key: string, ttlSeconds?: number): Promise<number> {
    if (ttlSeconds !== undefined) {
      return this.incrWithExpiry(key, ttlSeconds);
    }
    return this.incr(key);
  }

  async decrement(key: string): Promise<number> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        if (this.isSecuritySensitiveKey(key)) {
          throw new Error(`[UnifiedRedis] Redis unavailable for security-sensitive key ${key}`);
        }
        const entry = this.memoryCache.get(key);
        const num = entry ? parseInt(String(entry.data), 10) || 0 : 0;
        const newVal = num - 1;
        this.memoryCache.set(key, {
          data: newVal as any,
          timestamp: Date.now(),
          ttl: entry?.ttl ?? Number.MAX_SAFE_INTEGER,
          hits: 0,
        });
        return newVal;
      }
      return Number(await this.client.decr(key));
    } catch (error: any) {
      logger.warn('[UnifiedRedis] DECR error', { key, message: error.message });
      this.fallbackMode = true;
      if (this.isSecuritySensitiveKey(key)) {
        throw error;
      }
      const entry = this.memoryCache.get(key);
      const num = entry ? parseInt(String(entry.data), 10) || 0 : 0;
      const newVal = num - 1;
      this.memoryCache.set(key, {
        data: newVal as any,
        timestamp: Date.now(),
        ttl: entry?.ttl ?? Number.MAX_SAFE_INTEGER,
        hits: 0,
      });
      return newVal;
    }
  }

  async incrWithExpiry(key: string, seconds: number): Promise<number> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        throw new Error(`[UnifiedRedis] Redis unavailable for security-sensitive key ${key}`);
      }
      const result = await this.client.eval(
        'local current = redis.call("incr", KEYS[1])\nif tonumber(current) == 1 then redis.call("expire", KEYS[1], ARGV[1]) end\nreturn current',
        { keys: [key], arguments: [String(seconds)] }
      );
      return Number(result);
    } catch (error: any) {
      logger.warn('[UnifiedRedis] INCR+EXPIRE error', { key, seconds, message: error.message });
      this.fallbackMode = true;
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        this.expireFallback(key, seconds);
        return;
      }
      await this.client.expire(key, seconds);
    } catch (error: any) {
      logger.warn('[UnifiedRedis] EXPIRE error', { key, seconds, message: error.message });
      this.fallbackMode = true;
      this.expireFallback(key, seconds);
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.set(key, value, seconds);
  }

  async setnx(key: string, value: string, expiresInSeconds?: number): Promise<boolean> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        const existing = this.getFromFallback(key);
        if (existing) return false;
        this.setInMemory(key, value, expiresInSeconds ?? Number.MAX_SAFE_INTEGER);
        return true;
      }
      if (expiresInSeconds) {
        const res = await this.client.set(key, value, { EX: expiresInSeconds, NX: true });
        return res === 'OK';
      } else {
        const res = await this.client.set(key, value, { NX: true });
        return res === 'OK';
      }
    } catch (error: any) {
      logger.warn(`[UnifiedRedis] SETNX error for ${key}:`, error.message);
      this.fallbackMode = true;
      const existing = this.getFromFallback(key);
      if (existing) return false;
      this.setInMemory(key, value, expiresInSeconds ?? Number.MAX_SAFE_INTEGER);
      return true;
    }
  }

  // Compatibility: some callers reference getFromFallback
  public getFromFallback<T = any>(key: string): T | null {
    return this.getFromMemory<T>(key);
  }

  // Compatibility: expose exists() similar to redis.exists
  public async exists(key: string): Promise<number> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) return 0;
      return await this.client.exists(key);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.warn('[UnifiedRedis] EXISTS error', { key, message });
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUB/SUB
  // ═══════════════════════════════════════════════════════════════════════════════

  async publish(channel: string, message: string): Promise<number> {
    await this.ensureConnected();
    try {
      if (this.fallbackMode || !this.client) {
        logger.debug('[UnifiedRedis] Publish skipped in fallback mode');
        return 0;
      }
      return await this.client.publish(channel, message);
    } catch (error: any) {
      logger.warn(`[UnifiedRedis] PUBLISH error to ${channel}:`, error.message);
      return 0;
    }
  }

  async getSubscriber(): Promise<RedisClientType> {
    if (this.subscriber) return this.subscriber;

    await this.ensureConnected();
    if (!this.client) {
      throw new Error('[UnifiedRedis] Cannot create subscriber — Redis unavailable');
    }

    this.subscriber = this.client.duplicate();
    this.subscriber.on('error', (err: Error) => {
      logger.warn('[UnifiedRedis][subscriber] Error', { message: err.message });
    });
    this.subscriber.on('connect', () => logger.info('[UnifiedRedis][subscriber] Connected'));
    this.subscriber.on('ready', () => logger.info('[UnifiedRedis][subscriber] Ready'));

    await this.subscriber.connect();
    return this.subscriber;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATS & MONITORING (from RedisCacheService)
  // ═══════════════════════════════════════════════════════════════════════════════

  async getStats(): Promise<CacheStats> {
    await this.ensureConnected();
    try {
      let totalKeys = 0;
      let keysByCategory: Record<string, number> = {};

      if (this.fallbackMode || !this.client) {
        totalKeys = this.memoryCache.size;
        for (const key of this.memoryCache.keys()) {
          const category = key.split(':')[0];
          keysByCategory[category] = (keysByCategory[category] || 0) + 1;
        }
      } else {
        totalKeys = await this.client.dbSize();
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
      logger.error('[UnifiedRedis] Stats error:', error);
      return { totalKeys: 0, totalHits: this.stats.hits, totalMisses: this.stats.misses, hitRate: 0, keysByCategory: {}, topKeys: [] };
    }
  }

  async healthCheck(): Promise<boolean> {
    if (this.fallbackMode || !this.client) return false;
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CACHE WARMING
  // ═══════════════════════════════════════════════════════════════════════════════

  async warmCache(entries: Array<{ key: string; value: any; ttl: number }>): Promise<void> {
    logger.info(`[UnifiedRedis] Warming ${entries.length} entries...`);
    for (const { key, value, ttl } of entries) {
      await this.set(key, value, ttl, 'cache-warmer');
    }
    logger.info('[UnifiedRedis] Warm complete');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════════

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.subscriber) {
      try { await this.subscriber.quit(); } catch {}
      this.subscriber = null;
    }
    if (this.client) {
      try { await this.client.quit(); } catch {}
      this.client = null;
      this.fallbackMode = true;
    }
    logger.info('[UnifiedRedis] Disconnected');
  }

  cleanupFallbackStore(): void {
    const now = Date.now();
    for (const [key, data] of [...this.memoryCache.entries()]) {
      if (now > data.timestamp + data.ttl * 1000) {
        this.memoryCache.delete(key);
      }
    }
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

  private incrFallback(key: string): number {
    const entry = this.memoryCache.get(key);
    const num = entry ? parseInt(String(entry.data), 10) || 0 : 0;
    const newVal = num + 1;
    this.memoryCache.set(key, {
      data: newVal as any,
      timestamp: Date.now(),
      ttl: entry?.ttl ?? Number.MAX_SAFE_INTEGER,
      hits: 0,
    });
    return newVal;
  }

  private expireFallback(key: string, seconds: number): void {
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.ttl = seconds;
      entry.timestamp = Date.now();
    }
  }

  private isSecuritySensitiveKey(key: string): boolean {
    return this.securitySensitivePrefixes.some(prefix => key.startsWith(prefix));
  }

  private globToRegex(pattern: string): RegExp {
    const esc = (s: string) => s.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
    return new RegExp('^' + pattern.split('*').map(esc).join('.*') + '$');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const redisService = UnifiedRedisService.getInstance();

// Compatibility export: many modules import { redis } from './redis'
// Provide the old name as an alias to avoid widespread refactors.
export const redis = redisService;

// Backward-compatible alias
export const cacheService = redisService;

// Auto-cleanup fallback store every 5 minutes
setInterval(() => redisService.cleanupFallbackStore(), 300000);

// Graceful shutdown
process.on('unhandledRejection', async (reason) => {
  logger.error('Unhandled rejection:', reason);
  await redisService.disconnect();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await redisService.disconnect();
  process.exit(0);
});