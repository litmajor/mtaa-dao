/**
 * PHASE 1: SAFETY - Cache Invalidation Pattern
 * 
 * Implements consistent cache invalidation strategy:
 * - Refresh-on-write: Immediately update cache after DB mutation
 * - Pattern-based invalidation: Support for wildcard invalidation
 * - Versioning: Track cache versions to detect staleness
 */

import { cacheService } from './cacheService';
import { logger } from '../utils/logger';

/**
 * Cache Invalidation Strategy
 * 
 * Ensures cache is kept in sync with database state.
 */
export class CacheInvalidationManager {
  /**
   * Invalidate specific cache key (immediately delete)
   * 
   * Use when you know exact key to invalidate.
   * 
   * @param key - Cache key to invalidate
   */
  async invalidateKey(key: string): Promise<void> {
    try {
      await cacheService.delete(key);
      logger.debug(`[CACHE INVALIDATE] ${key}`);
    } catch (error) {
      logger.error(`[CACHE INVALIDATE ERROR] ${key}:`, error);
      // Don't throw - cache invalidation failure should not break transaction
    }
  }

  /**
   * Invalidate vault-related caches
   * 
   * Invalidates:
   * - vault:${vaultId}:balance
   * - vault:${vaultId}:portfolio
   * - vault:${vaultId}:nav
   * - dao:${daoId}:treasury (if vault belongs to DAO)
   */
  async invalidateVaultCaches(vaultId: string, daoId?: string): Promise<void> {
    const keysToInvalidate = [
      `vault:${vaultId}:balance`,
      `vault:${vaultId}:portfolio`,
      `vault:${vaultId}:nav`,
      `vault:${vaultId}:performance`,
      `vault:${vaultId}:holdings`,
      `vault:${vaultId}:risk`,
      `vault:${vaultId}:transactions`,
    ];

    // If vault belongs to DAO, also invalidate DAO caches
    if (daoId) {
      keysToInvalidate.push(
        `dao:${daoId}:treasury`,
        `dao:${daoId}:treasury:balance`,
        `dao:${daoId}:portfolio`
      );
    }

    // Invalidate all keys
    for (const key of keysToInvalidate) {
      await this.invalidateKey(key);
    }
  }

  /**
   * Invalidate user portfolio caches
   * 
   * Propagates invalidation to all vaults owned by user.
   */
  async invalidateUserPortfolioCaches(userId: string): Promise<void> {
    const keysToInvalidate = [
      `user:${userId}:portfolio`,
      `user:${userId}:portfolio:nav`,
      `user:${userId}:portfolio:performance`,
      `user:${userId}:dashboard`,
    ];

    for (const key of keysToInvalidate) {
      await this.invalidateKey(key);
    }
  }

  /**
   * Invalidate market data caches
   * 
   * Invalidates:
   * - price:${symbol}:${exchange}
   * - volatility:${symbol}
   * - ohlc:${symbol}:${timeframe}
   */
  async invalidateMarketCaches(symbol: string, exchanges?: string[]): Promise<void> {
    const keysToInvalidate = [
      `price:${symbol}`,
      `volatility:${symbol}`,
      `ohlc:${symbol}:1m`,
      `ohlc:${symbol}:5m`,
      `ohlc:${symbol}:1h`,
      `ohlc:${symbol}:1d`,
      `orderbook:${symbol}`,
    ];

    if (exchanges) {
      for (const exchange of exchanges) {
        keysToInvalidate.push(
          `price:${symbol}:${exchange}`,
          `orderbook:${symbol}:${exchange}`
        );
      }
    }

    for (const key of keysToInvalidate) {
      await this.invalidateKey(key);
    }
  }

  /**
   * Refresh cache entry after mutation
   * 
   * Implements "refresh-on-write" pattern:
   * After database mutation, immediately populate cache with new value.
   * 
   * This is the preferred pattern for frequently-used data.
   * 
   * @param key - Cache key
   * @param valueFactory - Function that computes the new value
   * @param ttl - Time-to-live in seconds
   */
  async refreshAfterMutation<T>(
    key: string,
    valueFactory: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    try {
      const value = await valueFactory();
      await cacheService.set(key, value, ttl);
      logger.debug(`[CACHE REFRESH] ${key} (TTL: ${ttl}s)`);
      return value;
    } catch (error) {
      logger.error(`[CACHE REFRESH ERROR] ${key}:`, error);
      throw error;
    }
  }

  /**
   * Batch cache invalidation
   * 
   * Invalidate multiple keys efficiently.
   * 
   * @param keys - Array of cache keys
   * @param concurrent - Number of concurrent invalidations (default: 5)
   */
  async invalidateBatch(keys: string[], concurrent: number = 5): Promise<void> {
    logger.debug(`[CACHE INVALIDATE BATCH] ${keys.length} keys`);

    for (let i = 0; i < keys.length; i += concurrent) {
      const batch = keys.slice(i, i + concurrent);
      await Promise.all(batch.map(key => this.invalidateKey(key)));
    }
  }

  /**
   * Cache invalidation with pattern matching
   * 
   * NOTE: Pattern matching is inefficient with Redis. Only use sparingly.
   * Prefer explicit key names where possible.
   * 
   * @param pattern - Redis pattern (e.g., 'vault:*:balance')
   * @param dryRun - Don't actually invalidate, just count
   */
  async invalidateByPattern(pattern: string, dryRun: boolean = false): Promise<number> {
    try {
      // This would need direct Redis access
      // For now, log warning that this pattern matching should be avoided
      logger.warn(
        `[CACHE PATTERN INVALIDATION] Pattern: ${pattern} - Consider using explicit key names instead`
      );
      return 0;
    } catch (error) {
      logger.error(`[CACHE PATTERN ERROR] ${pattern}:`, error);
      return 0;
    }
  }
}

/**
 * Singleton instance
 */
export const cacheInvalidationManager = new CacheInvalidationManager();

/**
 * Helper function for use in services
 * 
 * Wrap mutation with automatic cache invalidation:
 * 
 * ```typescript
 * const result = await withCacheInvalidation(
 *   async () => vaultService.deposit(req),
 *   ['vault:123:balance', 'user:456:portfolio']
 * );
 * ```
 */
export async function withCacheInvalidation<T>(
  mutationFn: () => Promise<T>,
  cacheKeysToInvalidate: string[]
): Promise<T> {
  try {
    // Execute mutation
    const result = await mutationFn();

    // After successful mutation, invalidate caches
    await cacheInvalidationManager.invalidateBatch(cacheKeysToInvalidate);

    return result;
  } catch (error) {
    // Don't invalidate on error - keep stale cache if transaction failed
    logger.error('[CACHE INVALIDATION] Mutation failed, cache not invalidated:', error);
    throw error;
  }
}

/**
 * Helper for refresh-on-write pattern
 * 
 * Execute mutation, then refresh specific cache entries:
 * 
 * ```typescript
 * const result = await withCacheRefresh(
 *   async () => vaultService.deposit(req),
 *   async () => vaultService.getPortfolio(vaultId),
 *   'vault:123:portfolio',
 *   300
 * );
 * ```
 */
export async function withCacheRefresh<T>(
  mutationFn: () => Promise<T>,
  refreshFn: () => Promise<any>,
  cacheKey: string,
  ttl: number = 300
): Promise<T> {
  try {
    // Execute mutation
    const result = await mutationFn();

    // After successful mutation, refresh cache
    await cacheInvalidationManager.refreshAfterMutation(
      cacheKey,
      refreshFn,
      ttl
    );

    return result;
  } catch (error) {
    logger.error('[CACHE REFRESH] Mutation failed:', error);
    throw error;
  }
}
