/**
 * Cache Manager
 * Redis-backed cache with TTL strategies, invalidation, and statistics
 */

import { createClient, RedisClientType } from "redis";
import { NormalizedData, CacheEntry, CacheConfig } from "./types";

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  itemsStored: number;
  memoryUsageBytes: number;
  evictedItems: number;
}

export class CacheManager {
  private client: RedisClientType | null = null;
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    itemsStored: 0,
    memoryUsageBytes: 0,
    evictedItems: 0,
  };

  private ttlStrategies: Record<string, number> = {
    price: 60, // 1 minute - prices change frequently
    liquidity: 300, // 5 minutes - liquidity changes moderately
    apy: 3600, // 1 hour - APY is relatively stable
    risk: 7200, // 2 hours - risk assessments change slowly
    tvl: 600, // 10 minutes - TVL updates moderately
    balance: 120, // 2 minutes - balances can change frequently
    transaction: 3600, // 1 hour - historical data
  };

  constructor(config: Partial<CacheConfig> = {}) {
    const redisUrl = config.redisUrl || process.env.REDIS_URL || "";
    const hasValidRedis = !!redisUrl && redisUrl !== "redis://localhost:6379";
    
    this.config = {
      enabled: hasValidRedis && config.enabled !== false,
      maxItems: config.maxItems || 10000,
      maxMemoryMb: config.maxMemoryMb || 512,
      redisUrl: redisUrl,
      keyPrefix: config.keyPrefix || "gateway:",
      defaultTtl: config.defaultTtl || 300,
    };
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled || !this.config.redisUrl) {
      // Redis not configured - use in-memory cache fallback
      return;
    }

    try {
      this.client = createClient({
        url: this.config.redisUrl,
      });

      this.client.on("error", () => {
        // Silently handle Redis errors
      });

      await this.client.connect();
      console.log("Cache Manager connected to Redis");

      // Set memory limit
      await this.client.configSet(
        "maxmemory",
        (this.config.maxMemoryMb! * 1024 * 1024).toString()
      );
      await this.client.configSet("maxmemory-policy", "allkeys-lru");
    } catch (error) {
      this.client = null;
    }
  }

  /**
   * Get cached data
   */
  async get<T extends NormalizedData>(key: string): Promise<T | null> {
    if (!this.client) {
      this.stats.misses++;
      return null;
    }

    try {
      const fullKey = this.prefixKey(key);
      const data = await this.client.get(fullKey);

      if (data) {
        this.stats.hits++;
        const cacheEntry = JSON.parse(data) as CacheEntry;

        // Check if data is stale
        const age = Date.now() - new Date(cacheEntry.timestamp).getTime();
        const isStale = age > (cacheEntry.ttl || this.config.defaultTtl!) * 1000;

        if (isStale) {
          // Mark as stale but still return
          return {
            ...cacheEntry.data,
            metadata: {
              ...cacheEntry.data.metadata,
              isStale: true,
              age: age / 1000,
            },
          } as unknown as T;
        }

        return cacheEntry.data as T;
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      console.error("Cache get error:", error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set cached data
   */
  async set<T extends NormalizedData>(
    key: string,
    data: T,
    ttlSeconds?: number
  ): Promise<boolean> {
    if (!this.client) return false;

    try {
      const fullKey = this.prefixKey(key);
      const ttl = ttlSeconds || this.getTTLForDataType(data.dataType);

      const cacheEntry: CacheEntry = {
        data,
        timestamp: new Date().toISOString(),
        ttl,
        source: data.source,
      };

      await this.client.setEx(
        fullKey,
        ttl,
        JSON.stringify(cacheEntry)
      );

      this.stats.itemsStored++;
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  /**
   * Batch get multiple keys
   */
  async mget<T extends NormalizedData>(keys: string[]): Promise<(T | null)[]> {
    if (!this.client) {
      return keys.map(() => null);
    }

    try {
      const fullKeys = keys.map((k) => this.prefixKey(k));
      const results = await this.client.mGet(fullKeys);

      return results.map((data, index) => {
        if (data) {
          this.stats.hits++;
          const cacheEntry = JSON.parse(data) as CacheEntry;
          return cacheEntry.data as T;
        } else {
          this.stats.misses++;
          return null;
        }
      });
    } catch (error) {
      console.error("Cache mget error:", error);
      return keys.map(() => null);
    }
  }

  /**
   * Batch set multiple keys
   */
  async mset<T extends NormalizedData>(
    entries: { key: string; data: T; ttl?: number }[]
  ): Promise<boolean> {
    if (!this.client) return false;

    try {
      for (const entry of entries) {
        await this.set(entry.key, entry.data, entry.ttl);
      }
      return true;
    } catch (error) {
      console.error("Cache mset error:", error);
      return false;
    }
  }

  /**
   * Invalidate cache by key pattern
   */
  async invalidate(pattern: string): Promise<number> {
    if (!this.client) return 0;

    try {
      const fullPattern = this.prefixKey(pattern);
      const keys = await this.client.keys(fullPattern);

      if (keys.length > 0) {
        await this.client.del(keys);
      }

      return keys.length;
    } catch (error) {
      console.error("Cache invalidate error:", error);
      return 0;
    }
  }

  /**
   * Invalidate cache for specific data type
   */
  async invalidateByType(dataType: string): Promise<number> {
    return this.invalidate(`*:${dataType}:*`);
  }

  /**
   * Invalidate cache for specific source
   */
  async invalidateBySource(source: string): Promise<number> {
    return this.invalidate(`${source}:*`);
  }

  /**
   * Invalidate cache for specific asset
   */
  async invalidateByAsset(symbol: string): Promise<number> {
    return this.invalidate(`*:${symbol}:*`);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (!this.client) return;

    try {
      const pattern = this.prefixKey("*");
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(keys);
      }

      this.stats = {
        hits: 0,
        misses: 0,
        hitRate: 0,
        itemsStored: 0,
        memoryUsageBytes: 0,
        evictedItems: 0,
      };
    } catch (error) {
      console.error("Cache clear error:", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      if (!this.client) {
        return this.stats;
      }

      const info = await this.client.info("memory");
      const lines = info.split("\r\n");
      let memoryUsed = 0;

      for (const line of lines) {
        if (line.startsWith("used_memory:")) {
          memoryUsed = parseInt(line.split(":")[1]);
          break;
        }
      }

      this.stats.memoryUsageBytes = memoryUsed;
      this.stats.hitRate = this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0;

      return this.stats;
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return this.stats;
    }
  }

  /**
   * Get cached items count
   */
  async getItemCount(): Promise<number> {
    if (!this.client) return 0;

    try {
      const pattern = this.prefixKey("*");
      const keys = await this.client.keys(pattern);
      return keys.length;
    } catch (error) {
      console.error("Error getting item count:", error);
      return 0;
    }
  }

  /**
   * Warm cache with initial data
   */
  async warmCache(entries: { key: string; data: NormalizedData; ttl?: number }[]): Promise<void> {
    if (!this.client) return;

    console.log(`Warming cache with ${entries.length} entries`);

    try {
      for (const entry of entries) {
        await this.set(entry.key, entry.data, entry.ttl);
      }
      console.log("Cache warming complete");
    } catch (error) {
      console.error("Error warming cache:", error);
    }
  }

  /**
   * Get aged data (data older than specified seconds)
   */
  async getAgedData(ageSeconds: number): Promise<NormalizedData[]> {
    if (!this.client) return [];

    try {
      const pattern = this.prefixKey("*");
      const keys = await this.client.keys(pattern);
      const agedData: NormalizedData[] = [];

      for (const key of keys) {
        const data = await this.get<NormalizedData>(key.replace(this.config.keyPrefix!, ""));

        if (data && data.metadata?.age && data.metadata.age > ageSeconds) {
          agedData.push(data);
        }
      }

      return agedData;
    } catch (error) {
      console.error("Error getting aged data:", error);
      return [];
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      console.log("Cache Manager disconnected from Redis");
    }
  }

  /**
   * Get TTL for specific data type
   */
  private getTTLForDataType(dataType: string): number {
    return this.ttlStrategies[dataType] || this.config.defaultTtl!;
  }

  /**
   * Prefix key with namespace
   */
  private prefixKey(key: string): string {
    if (key.startsWith(this.config.keyPrefix!)) {
      return key;
    }
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Check if cache is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cache key suggestion
   */
  static generateKey(
    source: string,
    dataType: string,
    asset: string,
    identifier?: string
  ): string {
    const parts = [source, dataType, asset];
    if (identifier) parts.push(identifier);
    return parts.join(":");
  }
}
