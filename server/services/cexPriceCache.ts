/**
 * ⚠️ DEPRECATED - CEX Price Cache Service
 * 
 * This service has been consolidated into DataCacheConsolidation (Phase 4)
 * 
 * MIGRATION GUIDE:
 * Old pattern (generic cache service):
 *   import { CacheService } from './cexPriceCache'
 *   const priceCache = new CacheService(30, 10000)
 *   priceCache.set('BTC/USD', price)
 *   const price = priceCache.get('BTC/USD')
 * 
 * New pattern (unified cache):
 *   import { cacheManager } from '../core/consolidation/DataCacheConsolidation'
 *   cacheManager.set('cex_prices', { 'BTC/USD': price }, { ttl: 30 })
 *   const price = cacheManager.get('cex_prices', { key: 'BTC/USD' })
 * 
 * Cache configuration in consolidation:
 *   - Backend: Memory or Redis (configurable)
 *   - TTL: 30 seconds (was hardcoded at 30s, now configurable)
 *   - Max size: 1000 entries default (LRU eviction enabled)
 *   - Metrics: Built-in performance stats
 * 
 * Benefits of consolidation:
 *   - Unified cache interface for all caches
 *   - Better memory management (automatic LRU)
 *   - Shared Redis backend across caches
 *   - Metrics and monitoring built-in
 * 
 * This service will be removed in v2.0. Please migrate to DataCacheConsolidation.
 * For questions: See CONSOLIDATION_INTEGRATION_GUIDE.md
 */

/**
 * CEX Price Cache Service
 * In-memory cache with TTL for price data
 * 
 * Features:
 * - Fast lookup without database queries
 * - TTL-based expiration
 * - Automatic cleanup of expired entries
 * - Memory usage monitoring
 * - Cache statistics
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  hitCount: number;
  missCount: number;
}

/**
 * Generic in-memory cache with TTL
 */
export class CacheService<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private ttl: number; // milliseconds
  private maxSize: number; // Maximum number of entries
  private hitCount: number = 0;
  private missCount: number = 0;
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor(ttlSeconds: number = 30, maxSize: number = 10000) {
    this.ttl = ttlSeconds * 1000;
    this.maxSize = maxSize;
    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.data;
  }

  /**
   * Set value in cache
   */
  set(key: string, data: T): void {
    // Remove old entry if it exists
    this.cache.delete(key);

    // Check size limit
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.ttl,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries matching pattern
   */
  deletePattern(pattern: RegExp): number {
    let count = 0;
    for (const [key] of this.cache) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalEntries = this.cache.size;
    const totalHits = this.hitCount;
    const totalMisses = this.missCount;
    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    const missRate = 100 - hitRate;

    // Rough estimate of size (in bytes)
    let totalSize = 0;
    for (const [key, entry] of this.cache) {
      totalSize += key.length * 2; // String size estimate
      totalSize += JSON.stringify(entry.data).length; // Data size
    }

    return {
      totalEntries,
      totalSize,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      hitCount: totalHits,
      missCount: totalMisses,
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0 && process.env.NODE_ENV !== 'production') {
      console.log(`[Cache] Cleanup removed ${removedCount} expired entries`);
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every TTL/2 to catch most expired entries
    const cleanupIntervalMs = Math.max(1000, this.ttl / 2);
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Destroy cache (cleanup)
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.clear();
  }
}

/**
 * Specialized cache for CEX prices
 */
export class CEXPriceCache {
  private cache: CacheService<any>;
  private static instance: CEXPriceCache;

  private constructor() {
    // 30-second TTL for prices
    this.cache = new CacheService(30, 5000);
  }

  static getInstance(): CEXPriceCache {
    if (!CEXPriceCache.instance) {
      CEXPriceCache.instance = new CEXPriceCache();
    }
    return CEXPriceCache.instance;
  }

  /**
   * Get price for exchange/pair
   */
  getPrice(exchange: string, pair: string): any | null {
    const key = `price:${exchange}:${pair}`;
    return this.cache.get(key);
  }

  /**
   * Set price for exchange/pair
   */
  setPrice(exchange: string, pair: string, priceData: any): void {
    const key = `price:${exchange}:${pair}`;
    this.cache.set(key, priceData);
  }

  /**
   * Get all prices for a pair
   */
  getPairPrices(pair: string): Map<string, any> {
    const pattern = new RegExp(`^price:[^:]+:${pair.replace(/\//g, '\\/')}$`);
    const results = new Map<string, any>();

    for (const [key] of (this.cache as any).cache) {
      if (pattern.test(key)) {
        const value = this.cache.get(key);
        if (value) {
          const exchange = key.split(':')[1];
          results.set(exchange, value);
        }
      }
    }

    return results;
  }

  /**
   * Invalidate price for exchange
   */
  invalidateExchange(exchange: string): number {
    const pattern = new RegExp(`^price:${exchange}:`);
    return this.cache.deletePattern(pattern);
  }

  /**
   * Invalidate all prices
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    this.cache.destroy();
  }
}
