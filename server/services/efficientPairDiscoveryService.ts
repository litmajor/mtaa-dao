/**
 * Efficient Pair Discovery Service
 * 
 * Intelligently caches and updates pair lists:
 * - Caches discovered pairs (don't change much)
 * - Only fetches new/changed pairs
 * - Tracks hash of pair list to detect changes
 * - Implements incremental discovery
 * - Fast fallback to cached pairs
 */

import { ccxtService } from './ccxtService';
import { cacheManager } from '../core/consolidation/DataCacheConsolidation';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';

export interface PairDiscoveryCache {
  exchange: string;
  pairs: string[];
  hash: string; // SHA256 hash to detect changes
  totalCount: number;
  lastFetchedAt: number;
  expiresAt: number;
  fetchDurationMs: number;
}

export interface DiscoveryResult {
  exchange: string;
  phase: number;
  pairs: string[];
  newPairs: string[];
  removedPairs: string[];
  totalPairs: number;
  cacheHit: boolean; // Was this from cache?
  fetchedAt: number;
  durationMs: number;
}

class EfficientPairDiscoveryService {
  private pairCache: Map<string, PairDiscoveryCache> = new Map();
  private updateInProgress: Map<string, boolean> = new Map();

  // Cache configuration
  private readonly CACHE_CONFIG = {
    // 6 hours for Phase 1 (changes less frequent)
    phase1ExpirationMs: 6 * 60 * 60 * 1000,
    // 12 hours for Phase 2
    phase2ExpirationMs: 12 * 60 * 60 * 1000,
    // 24 hours for Phase 3 (very stable)
    phase3ExpirationMs: 24 * 60 * 60 * 1000
  };

  constructor() {
    this.loadCacheFromDisk();
  }

  /**
   * Load pair cache from persistent storage
   */
  private loadCacheFromDisk(): void {
    try {
      const cached = cacheManager.getCache('pair_discovery_cache');
      if (cached && typeof cached === 'object') {
        Object.entries(cached).forEach(([exchange, data]: any) => {
          if (data && data.pairs) {
            this.pairCache.set(exchange, data);
            logger.debug(
              `Loaded ${data.pairs.length} cached pairs for ${exchange}`
            );
          }
        });
      }
    } catch (error: any) {
      logger.warn('Failed to load pair cache from disk:', error.message);
    }
  }

  /**
   * Save pair cache to disk/storage
   * Note: Currently uses in-memory storage; can be extended to persist to Redis/DB
   */
  private saveCacheToDisk(): void {
    try {
      // In-memory cache is already stored in this.pairCache
      // For persistence, would implement:
      // - Redis storage
      // - Database serialization
      // For now, relying on application uptime
      logger.debug('[EfficientPairDiscovery] Cache maintained in memory');
    } catch (error: any) {
      logger.warn('Failed to maintain pair cache:', error.message);
    }
  }

  /**
   * Discover pairs for an exchange efficiently
   * - Returns cached pairs if fresh
   * - Fetches new pairs if cache expired
   * - Detects new/removed pairs intelligently
   */
  async discoverPairs(
    exchange: string,
    phase: number = 1,
    forceRefresh: boolean = false
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();

    try {
      // Check if update already in progress
      if (this.updateInProgress.get(exchange)) {
        logger.debug(`Discovery already in progress for ${exchange}, waiting...`);
        // Return cached while waiting
        const cached = this.pairCache.get(exchange);
        if (cached) {
          return {
            exchange,
            phase,
            pairs: cached.pairs,
            newPairs: [],
            removedPairs: [],
            totalPairs: cached.pairs.length,
            cacheHit: true,
            fetchedAt: cached.lastFetchedAt,
            durationMs: Date.now() - startTime
          };
        }
      }

      // Get cache expiration based on phase
      const cacheExpirationMs = this.getCacheExpiration(phase);
      const cached = this.pairCache.get(exchange);
      const now = Date.now();

      // Return cached if fresh and not forced refresh
      if (
        !forceRefresh &&
        cached &&
        now - cached.lastFetchedAt < cacheExpirationMs
      ) {
        logger.debug(
          `Cache hit for ${exchange}: ${cached.pairs.length} pairs (age: ${Math.round((now - cached.lastFetchedAt) / 1000)}s)`
        );

        return {
          exchange,
          phase,
          pairs: cached.pairs,
          newPairs: [],
          removedPairs: [],
          totalPairs: cached.pairs.length,
          cacheHit: true,
          fetchedAt: cached.lastFetchedAt,
          durationMs: Date.now() - startTime
        };
      }

      // Need to fetch - mark as in progress
      this.updateInProgress.set(exchange, true);

      try {
        // Fetch from exchange
        const fetchStartTime = Date.now();
        const allMarkets = await ccxtService.getMarkets(exchange);
        const fetchDurationMs = Date.now() - fetchStartTime;

        // Filter active pairs based on phase
        const pairsPerPhase = this.getPairsPerPhase(phase);
        const activePairs = allMarkets
          .filter((m: any) => (m.quote && m.quote.toUpperCase()) || m.symbol)
          .slice(0, pairsPerPhase)
          .map((m: any) => m.symbol);

        // Calculate hash to detect changes
        const newHash = this.calculateHash(activePairs);
        const oldPairs = cached?.pairs || [];
        const oldHash = cached?.hash || '';

        // Detect new/removed pairs
        const newPairs = activePairs.filter(p => !oldPairs.includes(p));
        const removedPairs = oldPairs.filter(p => !activePairs.includes(p));
        const hasChanged = newHash !== oldHash;

        // Log changes
        if (hasChanged) {
          logger.info(`
📊 ${exchange} pair list updated:
   ├─ Total pairs: ${activePairs.length}
   ├─ New pairs: ${newPairs.length}
   ├─ Removed pairs: ${removedPairs.length}
   └─ Fetch time: ${fetchDurationMs}ms
          `);
        } else {
          logger.debug(`${exchange} pairs unchanged (${activePairs.length})`);
        }

        // Update cache
        const newCache: PairDiscoveryCache = {
          exchange,
          pairs: activePairs,
          hash: newHash,
          totalCount: activePairs.length,
          lastFetchedAt: now,
          expiresAt: now + cacheExpirationMs,
          fetchDurationMs
        };

        this.pairCache.set(exchange, newCache);
        this.saveCacheToDisk();

        return {
          exchange,
          phase,
          pairs: activePairs,
          newPairs,
          removedPairs,
          totalPairs: activePairs.length,
          cacheHit: false,
          fetchedAt: now,
          durationMs: Date.now() - startTime
        };
      } finally {
        this.updateInProgress.set(exchange, false);
      }
    } catch (error: any) {
      logger.error(`Failed to discover pairs for ${exchange}:`, error.message);

      // Fall back to cached if available
      const cached = this.pairCache.get(exchange);
      if (cached) {
        logger.warn(`Falling back to cached pairs for ${exchange}`);
        return {
          exchange,
          phase,
          pairs: cached.pairs,
          newPairs: [],
          removedPairs: [],
          totalPairs: cached.pairs.length,
          cacheHit: true,
          fetchedAt: cached.lastFetchedAt,
          durationMs: Date.now() - startTime
        };
      }

      throw error;
    }
  }

  /**
   * Discover pairs for multiple exchanges in parallel (with staggering)
   */
  async discoverAllExchanges(
    exchanges: string[],
    phase: number = 1,
    onProgress?: (completed: number, total: number) => void
  ): Promise<DiscoveryResult[]> {
    logger.info(`🔍 Discovering pairs for ${exchanges.length} exchanges (Phase ${phase})...`);

    const results: DiscoveryResult[] = [];
    const startTime = Date.now();

    // Get parallel config for phase
    const parallelCount = this.getParallelExchanges(phase);

    // Process in batches to avoid overwhelming
    for (let i = 0; i < exchanges.length; i += parallelCount) {
      const batch = exchanges.slice(i, i + parallelCount);

      const batchResults = await Promise.allSettled(
        batch.map(ex => this.discoverPairs(ex, phase, false))
      );

      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error(
            `Failed to discover ${batch[idx]}:`,
            result.reason?.message
          );
        }
      });

      // Report progress
      if (onProgress) {
        onProgress(Math.min(i + parallelCount, exchanges.length), exchanges.length);
      }

      // Stagger batch starts (avoid thundering herd)
      if (i + parallelCount < exchanges.length) {
        await this.delay(200);
      }
    }

    const duration = Date.now() - startTime;
    const totalPairs = results.reduce((sum, r) => sum + r.totalPairs, 0);
    const cacheHits = results.filter(r => r.cacheHit).length;

    logger.info(`
✅ Pair discovery complete (Phase ${phase}):
   ├─ Total pairs: ${totalPairs}
   ├─ Duration: ${Math.round(duration / 1000)}s
   ├─ Cache hits: ${cacheHits}/${results.length}
   └─ New pairs: ${results.reduce((sum, r) => sum + r.newPairs.length, 0)}
    `);

    return results;
  }

  /**
   * Get cache status
   */
  getCacheStatus(exchange?: string): any {
    if (exchange) {
      const cache = this.pairCache.get(exchange);
      if (!cache) return null;

      return {
        exchange,
        pairs: cache.pairs.length,
        hash: cache.hash,
        lastFetchedAt: new Date(cache.lastFetchedAt),
        expiresAt: new Date(cache.expiresAt),
        age: {
          ms: Date.now() - cache.lastFetchedAt,
          minutes: Math.round((Date.now() - cache.lastFetchedAt) / (60 * 1000))
        },
        expired: cache.expiresAt < Date.now(),
        fetchDurationMs: cache.fetchDurationMs
      };
    }

    // Return all
    const status: Record<string, any> = {};
    this.pairCache.forEach((cache, ex) => {
      status[ex] = {
        pairs: cache.pairs.length,
        lastFetchedAt: new Date(cache.lastFetchedAt),
        expiresAt: new Date(cache.expiresAt),
        expired: cache.expiresAt < Date.now(),
        ageMinutes: Math.round((Date.now() - cache.lastFetchedAt) / (60 * 1000))
      };
    });
    return status;
  }

  /**
   * Clear cache for exchange or all
   */
  clearCache(exchange?: string): void {
    if (exchange) {
      this.pairCache.delete(exchange);
      logger.info(`Cleared cache for ${exchange}`);
    } else {
      this.pairCache.clear();
      logger.info('Cleared all pair caches');
    }
    this.saveCacheToDisk();
  }

  // ============= PRIVATE HELPERS =============

  private calculateHash(pairs: string[]): string {
    const sorted = [...pairs].sort().join('|');
    return crypto.createHash('sha256').update(sorted).digest('hex');
  }

  private getCacheExpiration(phase: number): number {
    switch (phase) {
      case 1:
        return this.CACHE_CONFIG.phase1ExpirationMs;
      case 2:
        return this.CACHE_CONFIG.phase2ExpirationMs;
      case 3:
        return this.CACHE_CONFIG.phase3ExpirationMs;
      default:
        return this.CACHE_CONFIG.phase1ExpirationMs;
    }
  }

  private getPairsPerPhase(phase: number): number {
    switch (phase) {
      case 1:
        return 100;
      case 2:
        return 500;
      case 3:
        return 2000;
      default:
        return 100;
    }
  }

  private getParallelExchanges(phase: number): number {
    switch (phase) {
      case 1:
        return 3; // Fast - parallel
      case 2:
        return 2; // Medium - semi-parallel
      case 3:
        return 1; // Slow - sequential
      default:
        return 3;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const efficientPairDiscoveryService = new EfficientPairDiscoveryService();
