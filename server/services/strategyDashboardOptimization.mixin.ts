/**
 * Strategy Dashboard Service Optimization Integration
 * 
 * Leverages existing cacheService for read-heavy operations.
 * Reduces DB load for frequently computed metrics.
 * 
 * PATTERN: Load from cache → Use fallback to DB if needed → Cache result
 * 
 * Best suited for: Performance metrics, rankings, user comparisons
 */

import { cacheService } from './cacheService';
import { logger } from '../utils/logger';

export class StrategyDashboardOptimizedMethods {
  /**
   * Get strategy performance with caching
   * 
   * Performance metrics are read heavily but updated infrequently.
   * Cache for 30-60s to absorb repeated reads during same session.
   */
  static async getStrategyPerformanceOptimized(
    this: any,
    strategyId: string
  ): Promise<any> {
    const cacheKey = `strategy:perf:${strategyId}`;

    try {
      // Check cache first (30s TTL)
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug(`[Strategy] Performance cache hit for ${strategyId}`);
        return cached;
      }

      // Not cached, compute from DB
      logger.debug(`[Strategy] Performance cache miss, computing for ${strategyId}`);
      const performance = await this.computePerformanceMetrics(strategyId);

      // Cache for 30s (real-time is important, but prevent thrashing)
      await cacheService.set(cacheKey, performance, 30);

      return performance;
    } catch (error) {
      logger.error(`[Strategy] Error getting performance for ${strategyId}:`, error);
      // Return empty result on error
      return {
        ytdReturn: 0,
        monthReturn: 0,
        weekReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
      };
    }
  }

  /**
   * Get strategy rankings (expensive operation)
   * 
   * Rankings require heavy computation (sorting, filtering all strategies).
   * Cache for 1 hour since exact ordering isn't real-time critical.
   */
  static async getTopStrategiesOptimized(
    this: any,
    options?: {
      limit?: number;
      minAum?: number;
      riskLevel?: string;
    }
  ): Promise<any[]> {
    // Vary cache key by options for different views
    const optionsKey = options
      ? `_${options.limit || 10}_${options.minAum || 0}_${options.riskLevel || 'all'}`
      : '_default';
    const cacheKey = `strategy:top${optionsKey}:hourly`;

    try {
      // Check cache (1 hour TTL)
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug(`[Strategy] Rankings cache hit`);
        return cached;
      }

      logger.debug(`[Strategy] Rankings cache miss, computing...`);
      const strategies = await this.computeTopStrategies(options);

      // Cache for 1 hour (don't recompute frequently)
      await cacheService.set(cacheKey, strategies, 3600);

      return strategies;
    } catch (error) {
      logger.error(`[Strategy] Error getting top strategies:`, error);
      return [];
    }
  }

  /**
   * Get follower allocations (changes on deposits/withdrawals)
   * 
   * Cache for 5 minutes, invalidate only on transactions.
   */
  static async getFollowerAllocationsOptimized(
    this: any,
    strategyId: string
  ): Promise<any> {
    const cacheKey = `strategy:allocations:${strategyId}`;

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug(`[Strategy] Allocations cache hit for ${strategyId}`);
        return cached;
      }

      logger.debug(`[Strategy] Allocations cache miss, computing for ${strategyId}`);
      const allocations = await this.computeFollowerAllocations(strategyId);

      // Cache for 5 minutes (only invalidate on transactions)
      await cacheService.set(cacheKey, allocations, 300);

      return allocations;
    } catch (error) {
      logger.error(`[Strategy] Error getting allocations for ${strategyId}:`, error);
      return {
        totalValue: 0,
        followerCount: 0,
        allocations: [],
      };
    }
  }

  /**
   * Get user's strategy comparison data (personal view)
   * 
   * User-specific, cache for shorter duration (60s) since data is personal.
   */
  static async getUserStrategyComparisonOptimized(
    this: any,
    userId: string
  ): Promise<any> {
    const cacheKey = `user:strategy:compare:${userId}`;

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug(`[Strategy] User comparison cache hit for ${userId}`);
        return cached;
      }

      const comparison = await this.computeUserComparison(userId);

      // Cache for 60s (personal data)
      await cacheService.set(cacheKey, comparison, 60);

      return comparison;
    } catch (error) {
      logger.error(`[Strategy] Error getting user comparison for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Batch get performance for multiple strategies
   * 
   * Dashboard showing multiple strategies. Use cache for each.
   */
  static async getMultiplePerformancesOptimized(
    this: any,
    strategyIds: string[]
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    // Check cache for all at once (no separate calls needed)
    const cacheKeys = strategyIds.map((id) => `strategy:perf:${id}`);
    const cachedResults = await cacheService.mget(cacheKeys);

    const idsToFetch: string[] = [];

    // Separate cached from uncached
    for (let i = 0; i < strategyIds.length; i++) {
      if (cachedResults[i]) {
        results.set(strategyIds[i], cachedResults[i]);
      } else {
        idsToFetch.push(strategyIds[i]);
      }
    }

    // Fetch uncached ones
    if (idsToFetch.length > 0) {
      const fetchedResults = await Promise.all(
        idsToFetch.map((id) => this.computePerformanceMetrics(id))
      );

      // Cache and store all results
      const cacheOps = idsToFetch.map((id, idx) => [
        `strategy:perf:${id}`,
        fetchedResults[idx],
        30,
      ]);

      await cacheService.mset(
        cacheOps as Parameters<typeof cacheService.mset>[0]
      );

      idsToFetch.forEach((id, idx) => {
        results.set(id, fetchedResults[idx]);
      });
    }

    logger.debug(`[Strategy] Batch performance: ${results.size}/${strategyIds.length} from cache`);
    return results;
  }

  /**
   * Invalidate caches after updates
   */
  static async invalidateStrategyCache(strategyId: string): Promise<void> {
    const keysToDelete = [
      `strategy:perf:${strategyId}`,
      `strategy:allocations:${strategyId}`,
      `strategy:top:hourly`, // Rankings may have changed
      `strategy:top:hourly__default`,
    ];

    for (const key of keysToDelete) {
      await cacheService.del(key);
    }

    logger.info(`[Strategy] Invalidated caches for strategy ${strategyId}`);
  }

  /**
   * Invalidate all user-related caches after transaction
   */
  static async invalidateUserStrategyCache(userId: string): Promise<void> {
    const keysToDelete = [
      `user:strategy:compare:${userId}`,
    ];

    for (const key of keysToDelete) {
      await cacheService.del(key);
    }

    logger.debug(`[Strategy] Invalidated user caches for ${userId}`);
  }

  /**
   * Warmup common strategy caches (run on app startup)
   */
  static async warmupCommonCaches(this: any): Promise<void> {
    logger.info(`[Strategy] Warming up strategy caches...`);

    try {
      // Precompute top strategies
      await this.getTopStrategiesOptimized({ limit: 50 });

      logger.info(`[Strategy] Cache warmup complete`);
    } catch (error) {
      logger.error(`[Strategy] Cache warmup failed:`, error);
    }
  }

  /**
   * Stub methods to be implemented in actual service
   * (These would call the DB/compute from existing logic)
   */
  private async computePerformanceMetrics(strategyId: string): Promise<any> {
    // TODO: Implement DB query or existing logic
    return {};
  }

  private async computeTopStrategies(options?: any): Promise<any[]> {
    // TODO: Implement DB query or existing logic
    return [];
  }

  private async computeFollowerAllocations(strategyId: string): Promise<any> {
    // TODO: Implement DB query or existing logic
    return {};
  }

  private async computeUserComparison(userId: string): Promise<any> {
    // TODO: Implement DB query or existing logic
    return {};
  }
}

/**
 * Integration Example
 * 
 * In strategyDashboardService:
 * ```typescript
 * class StrategyDashboardService {
 *   async getStrategyPerformance(strategyId: string): Promise<any> {
 *     return StrategyDashboardOptimizedMethods
 *       .getStrategyPerformanceOptimized.call(this, strategyId);
 *   }
 *   
 *   async getTopStrategies(options?: any): Promise<any[]> {
 *     return StrategyDashboardOptimizedMethods
 *       .getTopStrategiesOptimized.call(this, options);
 *   }
 *   
 *   // After any strategy update:
 *   private async onStrategyUpdated(strategyId: string): Promise<void> {
 *     await StrategyDashboardOptimizedMethods
 *       .invalidateStrategyCache(strategyId);
 *   }
 * }
 * ```
 * 
 * Usage in API:
 * ```typescript
 * router.get('/strategies/top', async (req, res) => {
 *   // Single cache hit for all top strategies
 *   const strategies = await strategyService.getTopStrategies({
 *     limit: int(req.query.limit) || 10
 *   });
 *   res.json(strategies);
 * });
 * 
 * router.get('/strategies/:id/performance', async (req, res) => {
 *   // Cached performance metrics
 *   const perf = await strategyService.getStrategyPerformance(req.params.id);
 *   res.json(perf);
 * });
 * ```
 */
