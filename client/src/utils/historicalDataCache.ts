/**
 * Historical Data Cache Management
 * 
 * Implements an intelligent caching strategy for price history data
 * to reduce API calls and improve performance
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

/**
 * In-memory cache with TTL support
 * Stores historical data with automatic expiration
 */
class DataCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Get cached data if valid
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if data has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set cache entry with TTL
   */
  set(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    this.stats.size = this.cache.size;
  }

  /**
   * Clear specific cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: string } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : '0.00';
    return {
      ...this.stats,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Periodic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.stats.size = this.cache.size;
        console.debug(`[DataCache] Cleaned ${cleaned} expired entries. Size: ${this.stats.size}`);
      }
    }, 60 * 1000); // Cleanup every minute
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * Global cache instance for historical price data
 */
export const priceHistoryCache = new DataCache<any>();

/**
 * Global cache instance for market cap data
 */
export const marketCapHistoryCache = new DataCache<any>();

/**
 * Global cache instance for volume data
 */
export const volumeHistoryCache = new DataCache<any>();

/**
 * Generate cache key for historical data
 */
export const generateCacheKey = (coinId: string, range: string): string => {
  return `${coinId}:${range}`;
};

/**
 * Cache settings by data range
 * Longer ranges are cached longer since they change less frequently
 */
export const cacheSettings = {
  '24h': {
    ttl: 3 * 60 * 1000, // 3 minutes
    staleTime: 2 * 60 * 1000 // 2 minutes
  },
  '7d': {
    ttl: 10 * 60 * 1000, // 10 minutes
    staleTime: 5 * 60 * 1000 // 5 minutes
  },
  '30d': {
    ttl: 30 * 60 * 1000, // 30 minutes
    staleTime: 15 * 60 * 1000 // 15 minutes
  },
  '1y': {
    ttl: 60 * 60 * 1000, // 1 hour
    staleTime: 30 * 60 * 1000 // 30 minutes
  }
};

/**
 * Batch cache reader for multiple assets
 * Useful for loading multiple sparklines efficiently
 */
export class BatchCacheReader {
  private caches = {
    price: priceHistoryCache,
    marketCap: marketCapHistoryCache,
    volume: volumeHistoryCache
  };

  /**
   * Get multiple cache entries efficiently
   */
  getBatch(
    keys: string[],
    type: 'price' | 'marketCap' | 'volume' = 'price'
  ): Map<string, any | null> {
    const cache = this.caches[type];
    const results = new Map<string, any | null>();

    for (const key of keys) {
      results.set(key, cache.get(key));
    }

    return results;
  }

  /**
   * Set multiple cache entries
   */
  setBatch(
    entries: Map<string, any>,
    type: 'price' | 'marketCap' | 'volume' = 'price',
    ttl?: number
  ): void {
    const cache = this.caches[type];

    for (const [key, data] of entries.entries()) {
      cache.set(key, data, ttl);
    }
  }

  /**
   * Clear specific cache type
   */
  clearCache(type: 'price' | 'marketCap' | 'volume' | 'all'): void {
    if (type === 'all') {
      Object.values(this.caches).forEach(cache => cache.clear());
    } else {
      this.caches[type].clear();
    }
  }

  /**
   * Get statistics for all caches
   */
  getAllStats(): Record<string, CacheStats & { hitRate: string }> {
    return {
      price: this.caches.price.getStats(),
      marketCap: this.caches.marketCap.getStats(),
      volume: this.caches.volume.getStats()
    };
  }
}

/**
 * Export singleton instance
 */
export const batchCacheReader = new BatchCacheReader();
