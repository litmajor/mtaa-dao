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

import {
  getRedisInstance,
  getRedisInstanceAsync,
  REDIS_COMMAND_TIMEOUT_MS,
  REDIS_CONNECT_TIMEOUT_MS,
} from '../config/redisConnectionManager';
import type { RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { circuitBreakerRegistry } from '../core/consolidation/CircuitBreakerConsolidation';
import type { CircuitBreakerState } from '../core/consolidation/CircuitBreakerConsolidation';

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

export type RedisHealthStatus = 'up' | 'down' | 'degraded';

export interface RedisStatus {
  status: RedisHealthStatus;
  usingFallback: boolean;
  connected: boolean;
  circuitState: CircuitBreakerState;
  lastError: string | null;
  lastErrorAt: string | null;
  lastConnectedAt: string | null;
  reconnectAttempts: number;
  fallbackKeys: number;
  commandTimeoutMs: number;
  connectTimeoutMs: number;
}

const DEGRADED_WINDOW_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

class RedisTimeoutError extends Error {
  constructor(op: string, ms: number) {
    super(`[UnifiedRedis] ${op} timed out after ${ms}ms`);
    this.name = 'RedisTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, op: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  // Swallow late rejections from the losing promise so they never surface as unhandled.
  promise.catch(() => {});
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new RedisTimeoutError(op, ms)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(rediss?:\/\/)[^@\s]*@/gi, '$1***@');
}

/**
 * Unified Redis Service — singleton
 *
 * Every Redis command is bounded by REDIS_COMMAND_TIMEOUT_MS and routed through
 * the `redis` circuit breaker. When Redis is unavailable (not ready, timed out,
 * or circuit open) operations transparently use the in-memory fallback, except
 * security-sensitive keys which fail closed. Reconnection happens in the
 * background; normal operation resumes automatically once Redis is ready.
 */
export class UnifiedRedisService {
  private client: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private memoryCache = new Map<string, CacheEntry>();
  private readonly securitySensitivePrefixes = ['token:blacklist', 'rate_limit', 'otp', 'idempotency'];
  private stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private connectPromise: Promise<void> | null = null;
  private available = false;
  private loggedFallback = false;
  private lastError: string | null = null;
  private lastErrorAt: number | null = null;
  private lastConnectedAt: number | null = null;
  private readonly instrumentedClients = new WeakSet<object>();
  private readonly concurrencyWiredClients = new WeakSet<object>();
  private readonly breaker = circuitBreakerRegistry.getOrCreate('redis', 'infrastructure', {
    failureThreshold: 5,
    successThreshold: 1,
    resetTimeout: 5000,
    monitoringWindow: 30000,
    maxResetTimeout: 60000,
  });

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

  /**
   * Bounded connect: resolves within ~REDIS_CONNECT_TIMEOUT_MS and never throws.
   * Check `getStatus().connected` to know whether Redis is actually usable.
   */
  async connect(): Promise<void> {
    if (this.client?.isReady) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      try {
        const pending = getRedisInstance();
        this.instrument(pending);
        this.client = pending;

        const client = await withTimeout(getRedisInstanceAsync(), REDIS_CONNECT_TIMEOUT_MS + 250, 'connect');
        this.instrument(client);
        this.client = client;

        const pong = await withTimeout(client.ping(), REDIS_COMMAND_TIMEOUT_MS, 'PING');
        if (pong !== 'PONG') throw new Error(`Unexpected PING reply: ${String(pong)}`);

        this.markAvailable();
        this.wireConcurrencyManagers(client);
      } catch (error) {
        this.markUnavailable('connect', error);
      }
    })().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  isUsingFallback(): boolean {
    return !this.client?.isReady || this.breaker.isOpen();
  }

  getStatus(): RedisStatus {
    const connected = this.client?.isReady === true;
    const circuitState = this.breaker.getState();
    const recentError = this.lastErrorAt !== null && Date.now() - this.lastErrorAt < DEGRADED_WINDOW_MS;
    let status: RedisHealthStatus = 'up';
    if (!connected) status = 'down';
    else if (circuitState !== 'CLOSED' || recentError) status = 'degraded';

    return {
      status,
      usingFallback: this.isUsingFallback(),
      connected,
      circuitState,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt ? new Date(this.lastErrorAt).toISOString() : null,
      lastConnectedAt: this.lastConnectedAt ? new Date(this.lastConnectedAt).toISOString() : null,
      reconnectAttempts: this.reconnectAttempts,
      fallbackKeys: this.memoryCache.size,
      commandTimeoutMs: REDIS_COMMAND_TIMEOUT_MS,
      connectTimeoutMs: REDIS_CONNECT_TIMEOUT_MS,
    };
  }

  private instrument(client: RedisClientType): void {
    if (this.instrumentedClients.has(client)) return;
    this.instrumentedClients.add(client);

    client.on('ready', () => {
      this.client = client;
      this.markAvailable();
      this.wireConcurrencyManagers(client);
    });
    client.on('error', (err: Error) => {
      if (this.client === client || !this.client) this.markUnavailable('client', err);
    });
    client.on('end', () => {
      if (this.client === client) this.client = null;
      this.markUnavailable('client', new Error('Redis connection ended'));
    });
  }

  private wireConcurrencyManagers(client: RedisClientType): void {
    if (this.concurrencyWiredClients.has(client)) return;
    this.concurrencyWiredClients.add(client);
    import('./concurrencyControl')
      .then((mod: any) => {
        if (typeof mod?.initializeConcurrencyManagers === 'function') mod.initializeConcurrencyManagers(client);
      })
      .catch(() => {
        // concurrencyControl not available
      });
  }

  private markAvailable(): void {
    this.lastConnectedAt = Date.now();
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.available) {
      this.available = true;
      if (this.loggedFallback) {
        logger.info('[UnifiedRedis] Redis connection restored – resuming normal operation');
      } else {
        logger.info('[UnifiedRedis] Connected');
      }
      this.loggedFallback = false;
    }
  }

  private markUnavailable(op: string, error: unknown): void {
    this.lastError = errorMessage(error);
    this.lastErrorAt = Date.now();
    const connectionLost = !this.client?.isReady;
    if (connectionLost && (this.available || !this.loggedFallback)) {
      this.available = false;
      this.loggedFallback = true;
      logger.warn(`[UnifiedRedis] Redis unavailable – switching to in-memory fallback (${op}: ${this.lastError})`);
    } else {
      logger.debug(`[UnifiedRedis] ${op} failed: ${this.lastError}`);
    }
    if (connectionLost) this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const base = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * Math.pow(2, this.reconnectAttempts));
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, base + Math.floor(Math.random() * 500));
    this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, 10);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.client?.isReady) return;
      logger.debug('[UnifiedRedis] Reconnecting... attempt=' + this.reconnectAttempts);
      void this.connect();
    }, delay);
    this.reconnectTimer.unref?.();
  }

  /**
   * Run a Redis command with timeout + circuit breaker. Falls back (never blocks)
   * when Redis is not ready, the circuit is open, or the command fails.
   */
  private async run<T>(
    op: string,
    command: (client: RedisClientType) => Promise<T>,
    fallback: () => T | Promise<T>,
    timeoutMs: number = REDIS_COMMAND_TIMEOUT_MS
  ): Promise<T> {
    const client = this.client;
    if (!client || !client.isReady) {
      if (!this.connectPromise) this.scheduleReconnect();
      return fallback();
    }
    try {
      return await this.breaker.execute(() => withTimeout(command(client), timeoutMs, op), op);
    } catch (error: any) {
      if (error?.code !== 'CIRCUIT_BREAKER_OPEN') this.markUnavailable(op, error);
      return fallback();
    }
  }

  private failClosedOr<T>(key: string, fallback: () => T): () => T {
    return () => {
      if (this.isSecuritySensitiveKey(key)) {
        throw new Error(`[UnifiedRedis] Redis unavailable for security-sensitive key ${key}`);
      }
      return fallback();
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CORE CACHE OPERATIONS (from RedisCacheService)
  // ═══════════════════════════════════════════════════════════════════════════════

  async get<T = any>(key: string): Promise<T | null> {
    return this.run<T | null>(
      'GET',
      async (client) => {
        const data = await client.get(key);
        if (data) {
          this.stats.hits++;
          try { return JSON.parse(data); } catch { return data as any; }
        }
        this.stats.misses++;
        return null;
      },
      this.failClosedOr(key, () => this.getFromMemory<T>(key))
    );
  }

  async set<T = any>(key: string, value: T, ttlSeconds?: number, _source?: string): Promise<void> {
    return this.run<void>(
      'SET',
      async (client) => {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
          await client.set(key, serialized, { EX: ttlSeconds });
        } else {
          await client.set(key, serialized);
        }
        this.stats.sets++;
      },
      this.failClosedOr(key, () => this.setInMemory(key, value, ttlSeconds ?? 300))
    );
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    return this.run<void>(
      'DEL',
      async (client) => {
        await client.del(key);
        this.stats.deletes++;
      },
      () => undefined
    );
  }

  // Compatibility alias: some callers expect `del`
  async del(key: string): Promise<void> {
    return this.delete(key);
  }

  async delMany(keys: string[]): Promise<void> {
    if (!keys?.length) return;
    for (const k of keys) this.memoryCache.delete(k);
    return this.run<void>(
      'DEL',
      async (client) => {
        await client.del(keys);
        this.stats.deletes += keys.length;
      },
      () => undefined
    );
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of [...this.memoryCache.keys()]) {
      if (key.startsWith(prefix)) this.memoryCache.delete(key);
    }
    return this.run<void>(
      'SCAN+DEL',
      async (client) => {
        // node-redis scanIterator yields batches (v5+) or single keys (v4); handle both.
        let batch: string[] = [];
        for await (const chunk of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
          batch.push(...(Array.isArray(chunk) ? chunk : [chunk]).map(String));
          if (batch.length >= 100) {
            await client.del(batch);
            this.stats.deletes += batch.length;
            batch = [];
          }
        }
        if (batch.length) {
          await client.del(batch);
          this.stats.deletes += batch.length;
        }
        logger.info(`[UnifiedRedis] Deleted keys matching ${prefix}*`);
      },
      () => undefined,
      REDIS_COMMAND_TIMEOUT_MS * 10
    );
  }

  async keys(pattern: string): Promise<string[]> {
    return this.run<string[]>(
      'SCAN',
      async (client) => {
        const results: string[] = [];
        for await (const chunk of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
          results.push(...(Array.isArray(chunk) ? chunk : [chunk]).map(String));
        }
        return results;
      },
      () => {
        const regex = this.globToRegex(pattern);
        return Array.from(this.memoryCache.keys()).filter(k => regex.test(k));
      },
      REDIS_COMMAND_TIMEOUT_MS * 10
    );
  }

  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      const regex = new RegExp(pattern);
      for (const key of [...this.memoryCache.keys()]) {
        if (regex.test(key)) this.memoryCache.delete(key);
      }
      const keys = await this.keys(pattern);
      if (keys.length) await this.delMany(keys);
      return;
    }
    this.memoryCache.clear();
    return this.run<void>('FLUSHDB', async (client) => { await client.flushDb(); }, () => undefined);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ATOMIC OPERATIONS (from RedisService)
  // ═══════════════════════════════════════════════════════════════════════════════

  async incr(key: string): Promise<number> {
    return this.run<number>(
      'INCR',
      async (client) => Number(await client.incr(key)),
      this.failClosedOr(key, () => this.addFallback(key, 1))
    );
  }

  // Backward-compatible alias for legacy callers using ioredis-style naming.
  async increment(key: string, ttlSeconds?: number): Promise<number> {
    if (ttlSeconds !== undefined) {
      return this.incrWithExpiry(key, ttlSeconds);
    }
    return this.incr(key);
  }

  async decrement(key: string): Promise<number> {
    return this.run<number>(
      'DECR',
      async (client) => Number(await client.decr(key)),
      this.failClosedOr(key, () => this.addFallback(key, -1))
    );
  }

  /** Atomic INCR + EXPIRE. Used for rate limiting, so it always fails closed. */
  async incrWithExpiry(key: string, seconds: number): Promise<number> {
    return this.run<number>(
      'INCR+EXPIRE',
      async (client) => {
        const result = await client.eval(
          'local current = redis.call("incr", KEYS[1])\nif tonumber(current) == 1 then redis.call("expire", KEYS[1], ARGV[1]) end\nreturn current',
          { keys: [key], arguments: [String(seconds)] }
        );
        return Number(result);
      },
      () => {
        throw new Error(`[UnifiedRedis] Redis unavailable for security-sensitive key ${key}`);
      }
    );
  }

  async expire(key: string, seconds: number): Promise<void> {
    return this.run<void>(
      'EXPIRE',
      async (client) => { await client.expire(key, seconds); },
      () => this.expireFallback(key, seconds)
    );
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.set(key, value, seconds);
  }

  async setnx(key: string, value: string, expiresInSeconds?: number): Promise<boolean> {
    return this.run<boolean>(
      'SETNX',
      async (client) => {
        const res = expiresInSeconds
          ? await client.set(key, value, { EX: expiresInSeconds, NX: true })
          : await client.set(key, value, { NX: true });
        return res === 'OK';
      },
      this.failClosedOr(key, () => {
        if (this.getFromFallback(key)) return false;
        this.setInMemory(key, value, expiresInSeconds ?? Number.MAX_SAFE_INTEGER);
        return true;
      })
    );
  }

  // Compatibility: some callers reference getFromFallback
  public getFromFallback<T = any>(key: string): T | null {
    return this.getFromMemory<T>(key);
  }

  // Compatibility: expose exists() similar to redis.exists
  public async exists(key: string): Promise<number> {
    return this.run<number>('EXISTS', async (client) => Number(await client.exists(key)), () => 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUB/SUB
  // ═══════════════════════════════════════════════════════════════════════════════

  async publish(channel: string, message: string): Promise<number> {
    return this.run<number>('PUBLISH', async (client) => Number(await client.publish(channel, message)), () => 0);
  }

  async getSubscriber(): Promise<RedisClientType> {
    if (this.subscriber) return this.subscriber;

    const client = this.client;
    if (!client?.isReady || this.breaker.isOpen()) {
      if (!this.connectPromise) this.scheduleReconnect();
      throw new Error('[UnifiedRedis] Cannot create subscriber — Redis unavailable');
    }

    const subscriber = client.duplicate() as RedisClientType;
    subscriber.on('error', (err: Error) => {
      logger.debug('[UnifiedRedis][subscriber] Error', { message: err.message });
    });
    subscriber.on('ready', () => logger.info('[UnifiedRedis][subscriber] Ready'));

    try {
      await withTimeout(subscriber.connect(), REDIS_CONNECT_TIMEOUT_MS, 'subscriber connect');
    } catch (error) {
      try { subscriber.destroy(); } catch {}
      throw error;
    }
    this.subscriber = subscriber;
    return subscriber;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATS & MONITORING (from RedisCacheService)
  // ═══════════════════════════════════════════════════════════════════════════════

  async getStats(): Promise<CacheStats> {
    const memoryStats = () => {
      const keysByCategory: Record<string, number> = {};
      for (const key of this.memoryCache.keys()) {
        const category = key.split(':')[0];
        keysByCategory[category] = (keysByCategory[category] || 0) + 1;
      }
      return { totalKeys: this.memoryCache.size, keysByCategory };
    };

    const { totalKeys, keysByCategory } = await this.run(
      'DBSIZE',
      async (client) => {
        const total = Number(await client.dbSize());
        const byCategory: Record<string, number> = {};
        for (const pattern of ['ticker:*', 'ohlcv:*', 'orderbook:*', 'trades:*', 'markets:*']) {
          byCategory[pattern] = (await this.keys(pattern)).length;
        }
        return { totalKeys: total, keysByCategory: byCategory };
      },
      memoryStats,
      REDIS_COMMAND_TIMEOUT_MS * 20
    );

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
  }

  async healthCheck(): Promise<boolean> {
    return this.run<boolean>('PING', async (client) => (await client.ping()) === 'PONG', () => false);
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
    const closeBounded = async (c: RedisClientType) => {
      try {
        if (c.isReady) await withTimeout(c.quit(), REDIS_COMMAND_TIMEOUT_MS, 'QUIT');
        else c.destroy();
      } catch {
        try { c.destroy(); } catch {}
      }
    };
    if (this.subscriber) {
      await closeBounded(this.subscriber);
      this.subscriber = null;
    }
    if (this.client) {
      const c = this.client;
      this.client = null;
      await closeBounded(c);
    }
    this.available = false;
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

  private addFallback(key: string, delta: number): number {
    const entry = this.memoryCache.get(key);
    const num = entry ? parseInt(String(entry.data), 10) || 0 : 0;
    const newVal = num + delta;
    this.memoryCache.set(key, {
      data: newVal as any,
      timestamp: entry?.timestamp ?? Date.now(),
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
setInterval(() => redisService.cleanupFallbackStore(), 300000).unref();

// Graceful shutdown (bounded; never hangs on a dead Redis).
// NOTE: unhandledRejection is owned by server/index.ts — do not exit the
// process from here, or any stray rejection becomes a total outage.
process.on('SIGTERM', async () => {
  await redisService.disconnect();
  process.exit(0);
});
