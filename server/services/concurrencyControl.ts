/**
 * PHASE 1: SAFETY - Concurrency Control Utilities
 * 
 * Implements distributed locking and idempotency for critical financial operations.
 * 
 * Scope:
 * - Vault mutations (deposit, withdraw, rebalance)
 * - Payment operations
 * - Governance execution
 * - Treasury transfers
 */

import redis from 'ioredis';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';

/**
 * Distributed Lock Manager using Redis
 * 
 * Prevents concurrent execution of critical operations via Redis SET with NX flag.
 * Ensures only one instance can hold a lock at a time.
 */
export class DistributedLockManager {
  private client: redis.Redis;
  private locks: Map<string, string> = new Map(); // Lock key → token

  constructor(redisClient: redis.Redis) {
    this.client = redisClient;
  }

  /**
   * Acquire distributed lock
   * 
   * @param resourceId - Resource to lock (e.g., 'vault:vault-uuid:write')
   * @param options - Lock options (timeout, retries)
   * @returns Lock token (release identifier) or null if failed
   * 
   * Example:
   * ```
   * const lock = await lockManager.acquire('vault:123:write', { timeout: 30000, retries: 3 });
   * if (!lock) throw new Error('Could not acquire lock');
   * try {
   *   await vaultService.deposit(...);
   * } finally {
   *   await lockManager.release(lock);
   * }
   * ```
   */
  async acquire(
    resourceId: string,
    options: { timeout?: number; retries?: number; retryDelay?: number } = {}
  ): Promise<string | null> {
    const { timeout = 30000, retries = 3, retryDelay = 100 } = options;
    const token = nanoid(16);
    const lockKey = `distributed-lock:${resourceId}`;
    const lockTTL = Math.ceil(timeout / 1000) + 1; // TTL in seconds

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // SET key value EX ttl NX — only set if not exists, with expiry
        const result = await this.client.set(
          lockKey,
          token,
          'EX',
          lockTTL,
          'NX'
        );

        if (result === 'OK') {
          this.locks.set(token, lockKey);
          logger.debug(`[LOCK ACQUIRED] ${resourceId} (attempt ${attempt + 1})`);
          return token;
        }

        // Lock exists, wait before retry
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        logger.error(`[LOCK ACQUIRE ERROR] ${resourceId}:`, error);
        if (attempt === retries - 1) throw error;
      }
    }

    logger.warn(`[LOCK FAILED] ${resourceId} after ${retries} retries`);
    return null;
  }

  /**
   * Release distributed lock
   * 
   * Uses Lua script to ensure atomic compare-and-delete:
   * Only delete if the token matches (prevents releasing someone else's lock).
   */
  async release(token: string): Promise<boolean> {
    const lockKey = this.locks.get(token);
    if (!lockKey) {
      logger.warn(`[LOCK RELEASE] Unknown token: ${token}`);
      return false;
    }

    try {
      // Lua script: compare token, then delete if match
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.client.eval(luaScript, 1, lockKey, token);

      if (result === 1) {
        this.locks.delete(token);
        logger.debug(`[LOCK RELEASED] ${lockKey}`);
        return true;
      }

      logger.warn(`[LOCK RELEASE MISMATCH] ${lockKey} - token mismatch`);
      return false;
    } catch (error) {
      logger.error(`[LOCK RELEASE ERROR] ${lockKey}:`, error);
      return false;
    }
  }

  /**
   * Execute critical section with automatic lock management
   * 
   * Acquires lock, executes fn, releases lock. Throws if lock cannot be acquired.
   */
  async executeWithLock<T>(
    resourceId: string,
    fn: () => Promise<T>,
    options?: { timeout?: number; retries?: number }
  ): Promise<T> {
    const token = await this.acquire(resourceId, options);
    if (!token) {
      throw new Error(`Could not acquire lock for ${resourceId}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(token);
    }
  }

  /**
   * Check if resource is locked (for diagnostics)
   */
  async isLocked(resourceId: string): Promise<boolean> {
    const lockKey = `distributed-lock:${resourceId}`;
    const exists = await this.client.exists(lockKey);
    return exists === 1;
  }
}

/**
 * Idempotency Key Manager
 * 
 * Prevents duplicate execution of financial operations.
 * Stores idempotency key → operation result mapping.
 * 
 * Use case:
 * - Network retry sends same withdrawal request twice
 * - Second request hits same idempotency key
 * - Returns cached result instead of double-withdrawal
 */
export class IdempotencyManager {
  private client: redis.Redis;
  private ttl: number = 86400; // 24 hours default

  constructor(redisClient: redis.Redis, ttlSeconds: number = 86400) {
    this.client = redisClient;
    this.ttl = ttlSeconds;
  }

  /**
   * Record idempotent operation result
   * 
   * @param idempotencyKey - Client-provided unique key (UUID or hash)
   * @param result - Operation result to cache
   * @param ttl - Time-to-live in seconds (optional override)
   */
  async recordResult(
    idempotencyKey: string,
    result: any,
    ttl: number = this.ttl
  ): Promise<void> {
    const key = `idempotency:${idempotencyKey}`;
    const serialized = JSON.stringify({
      result,
      timestamp: Date.now(),
      ttl
    });

    try {
      await this.client.setex(key, ttl, serialized);
      logger.debug(`[IDEMPOTENCY] Key recorded: ${idempotencyKey}`);
    } catch (error) {
      logger.error(`[IDEMPOTENCY] Record error: ${idempotencyKey}`, error);
      throw error;
    }
  }

  /**
   * Retrieve cached result for idempotency key
   * 
   * @returns Cached result if exists, null otherwise
   */
  async getResult(idempotencyKey: string): Promise<any | null> {
    const key = `idempotency:${idempotencyKey}`;

    try {
      const cached = await this.client.get(key);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      logger.debug(`[IDEMPOTENCY] Hit: ${idempotencyKey}`);
      return parsed.result;
    } catch (error) {
      logger.error(`[IDEMPOTENCY] Retrieve error: ${idempotencyKey}`, error);
      return null;
    }
  }

  /**
   * Check if idempotency key exists without retrieving result
   */
  async exists(idempotencyKey: string): Promise<boolean> {
    const key = `idempotency:${idempotencyKey}`;
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Invalidate idempotency key
   */
  async invalidate(idempotencyKey: string): Promise<void> {
    const key = `idempotency:${idempotencyKey}`;
    await this.client.del(key);
    logger.debug(`[IDEMPOTENCY] Invalidated: ${idempotencyKey}`);
  }
}

/**
 * Rate Limiter using Redis
 * 
 * Sliding window rate limiting to prevent abuse of critical operations.
 * 
 * Use case:
 * - Limit withdrawals to 10 per hour per user
 * - Limit governance proposals to 5 per day per user
 */
export class RateLimiter {
  private client: redis.Redis;

  constructor(redisClient: redis.Redis) {
    this.client = redisClient;
  }

  /**
   * Check if operation is allowed under rate limit
   * 
   * @param key - Rate limit identifier (e.g., 'user:123:withdrawals')
   * @param limit - Max operations allowed
   * @param windowSeconds - Time window in seconds
   * @returns { allowed: boolean; remaining: number; retryAfter: number }
   */
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
    const rateKey = `ratelimit:${key}`;
    const now = Date.now() / 1000; // Current time in seconds
    const windowStart = now - windowSeconds;

    try {
      // Remove old entries outside window
      await this.client.zremrangebyscore(rateKey, '-inf', windowStart);

      // Count entries in current window
      const count = await this.client.zcard(rateKey);
      const remaining = Math.max(0, limit - count);

      if (count < limit) {
        // Add new entry with current timestamp
        await this.client.zadd(rateKey, now, `${now}-${nanoid(8)}`);
        // Set expiry on rate key
        await this.client.expire(rateKey, windowSeconds + 1);

        logger.debug(`[RATELIMIT] ${key}: ${count + 1}/${limit}`);
        return { allowed: true, remaining: remaining - 1, retryAfter: 0 };
      }

      // At limit, calculate retry time
      const oldestEntry = await this.client.zrange(rateKey, 0, 0);
      const oldestTime = oldestEntry.length > 0 ? parseFloat(oldestEntry[0]) : now;
      const retryAfter = Math.ceil(oldestTime + windowSeconds - now);

      logger.warn(`[RATELIMIT] ${key}: Limit reached (${limit}/${limit})`);
      return { allowed: false, remaining: 0, retryAfter };
    } catch (error) {
      logger.error(`[RATELIMIT] Error checking ${key}:`, error);
      // Fail open on Redis errors (allow operation)
      return { allowed: true, remaining: limit, retryAfter: 0 };
    }
  }
}

/**
 * Export singleton instances (initialized in cacheService.ts)
 */
export let distributedLockManager: DistributedLockManager;
export let idempotencyManager: IdempotencyManager;
export let rateLimiter: RateLimiter;

/**
 * Initialize managers (called from cacheService.initialize)
 */
export function initializeConcurrencyManagers(redisClient: redis.Redis): void {
  distributedLockManager = new DistributedLockManager(redisClient);
  idempotencyManager = new IdempotencyManager(redisClient);
  rateLimiter = new RateLimiter(redisClient);
  logger.info('✅ Concurrency managers initialized');
}
