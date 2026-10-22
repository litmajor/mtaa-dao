/**
 * Database Optimization Layer
 * 
 * Provides optimized query patterns for high-load services:
 * - Batch queries with JOINs (reduce round trips)
 * - Redis caching for read-heavy data (30-60s TTL)
 * - Transaction batching for writes
 * - Connection pooling via Drizzle
 * 
 * Impact: Reduces DB queries from 6/request to 1-2 with Redis hits
 */

import { db } from '../db';
import { cacheService } from './cacheService';
import { logger } from '../utils/logger';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { vaults, vaultTokenHoldings, investmentPools, subscriptions, daos } from '../../shared/schema';

export interface OptimizedVaultData {
  id: string;
  name: string;
  description: string;
  vaultType: string;
  userId: string | null;
  daoId: string | null;
  currency: string;
  balance: string;
  totalValueLocked: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  holdings: Array<{
    tokenSymbol: string;
    balance: string;
    valueUSD: string;
  }>;
}

export interface OptimizedPoolData {
  id: string;
  daoId: string;
  name: string;
  targetSizeWei: bigint;
  currentSizeWei: bigint;
  platformFee: {
    tier: string;
    transactionFeePercent: number;
    performanceFeePercent: number;
    managementFeePercent: number;
  };
}

export class DatabaseOptimizationLayer {
  // Cache key constants
  private static readonly CACHE_KEYS = {
    vault: (vaultId: string) => `vault:${vaultId}`,
    vaultHoldings: (vaultId: string) => `vault:holdings:${vaultId}`,
    vaultState: (vaultId: string) => `vault:state:${vaultId}`,
    poolFee: (poolId: string) => `pool:fee:${poolId}`,
    poolData: (poolId: string) => `pool:data:${poolId}`,
    poolState: (poolId: string) => `pool:state:${poolId}`,
    daoSubscription: (daoId: string) => `dao:subscription:${daoId}`,
  };

  // Cache TTLs (in seconds)
  private static readonly CACHE_TTL = {
    vault: 60,           // Vault details change infrequently
    holdings: 30,        // Holdings update on every deposit/withdraw
    poolState: 30,       // Pool state updates frequently
    daoSubscription: 300, // DAO subscription rarely changes
  };

  /**
   * Get vault with all related data in a single optimized query
   * Batches: vault details + holdings (1 query instead of 2)
   */
  static async getVaultWithHoldings(vaultId: string): Promise<OptimizedVaultData | null> {
    // Check cache first
    const cacheKey = this.CACHE_KEYS.vaultState(vaultId);
    const cached = await cacheService.get<OptimizedVaultData>(cacheKey);
    if (cached) {
      logger.debug(`[DB Opt] Cache hit for vault ${vaultId}`);
      return cached;
    }

    try {
      // Single JOIN query instead of 2 sequential queries
      const result = await (db as any).select({
        vault: vaults,
        holdings: (db as any).selectDistinct(vaultTokenHoldings),
      })
        .from(vaults)
        .leftJoin(
          vaultTokenHoldings,
          eq(vaults.id, vaultTokenHoldings.vaultId)
        )
        .where(eq(vaults.id, vaultId))
        .limit(1);

      if (!result || result.length === 0) {
        return null;
      }

      // Transform the result
      const vaultData = result[0].vault;
      const holdings = result
        .filter((r: any) => r.holdings)
        .map((r: any) => r.holdings);

      const optimized: OptimizedVaultData = {
        id: vaultData.id,
        name: vaultData.name || '',
        description: vaultData.description || '',
        vaultType: vaultData.vaultType || 'regular',
        userId: vaultData.userId,
        daoId: vaultData.daoId,
        currency: vaultData.currency || 'KES',
        balance: vaultData.balance || '0',
        totalValueLocked: vaultData.totalValueLocked || '0',
        isActive: vaultData.isActive ?? true,
        createdAt: vaultData.createdAt || new Date(),
        updatedAt: vaultData.updatedAt || new Date(),
        holdings: holdings.map((h: any) => ({
          tokenSymbol: h.tokenSymbol,
          balance: h.balance,
          valueUSD: h.valueUSD || '0',
        })),
      };

      // Cache for 60s (vault details rarely change)
      await cacheService.set(
        cacheKey,
        optimized,
        this.CACHE_TTL.vault
      );

      return optimized;
    } catch (error) {
      logger.error(`[DB Opt] Error fetching vault ${vaultId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple vaults efficiently
   * Batches queries: load all at once (1 query instead of N)
   */
  static async getVaultsForUser(userId: string): Promise<OptimizedVaultData[]> {
    try {
      // Single query for all user vaults + holdings
      const results = await db
        .select({
          vault: vaults,
          holding: vaultTokenHoldings,
        })
        .from(vaults)
        .leftJoin(
          vaultTokenHoldings,
          eq(vaults.id, vaultTokenHoldings.vaultId)
        )
        .where(eq(vaults.userId, userId));

      // Group by vault ID
      const vaultMap = new Map<string, OptimizedVaultData>();
      
      for (const row of results as any[]) {
        const vaultId = row.vault.id;
        if (!vaultMap.has(vaultId)) {
          vaultMap.set(vaultId, {
            id: row.vault.id,
            name: row.vault.name || '',
            description: row.vault.description || '',
            vaultType: row.vault.vaultType || 'regular',
            userId: row.vault.userId,
            daoId: row.vault.daoId,
            currency: row.vault.currency || 'KES',
            balance: row.vault.balance || '0',
            totalValueLocked: row.vault.totalValueLocked || '0',
            isActive: row.vault.isActive ?? false,
            createdAt: row.vault.createdAt || new Date(),
            updatedAt: row.vault.updatedAt || new Date(),
            holdings: [],
          });
        }

        if (row.holding) {
          vaultMap.get(vaultId)!.holdings.push({
            tokenSymbol: row.holding.tokenSymbol,
            balance: row.holding.balance,
            valueUSD: row.holding.valueUSD || '0',
          });
        }
      }

      return Array.from(vaultMap.values());
    } catch (error) {
      logger.error(`[DB Opt] Error fetching vaults for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get pool fee with DAO subscription in ONE query
   * Replaces 2-3 sequential queries with 1 JOIN
   */
  static async getPoolFeeOptimized(poolId: string): Promise<any> {
    // Check cache first
    const cacheKey = this.CACHE_KEYS.poolFee(poolId);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug(`[DB Opt] Cache hit for pool fee ${poolId}`);
      return cached;
    }

    try {
      // Single JOIN query instead of 2-3 sequential queries
      const result = await db
        .select({
          pool: investmentPools,
          subscription: subscriptions,
          dao: daos,
        })
        .from(investmentPools)
        .leftJoin(
          subscriptions,
          and(
            eq(subscriptions.daoId, investmentPools.daoId),
            eq(subscriptions.status, 'active')
          )
        )
        .leftJoin(
          daos,
          eq(daos.id, investmentPools.daoId)
        )
        .where(eq(investmentPools.id, poolId))
        .limit(1);

      const flatFeeStructure = {
        tier: 'placeholder',
        transactionFeePercent: 2.0,
        performanceFeePercent: 8.0,
        managementFeePercent: 1.0,
      };

      // TODO: replace with volume-based fee ladder once real transaction data exists — see pricing.md §6.4.
      // Flat rate is a placeholder, not a design decision.
      await cacheService.set(
        cacheKey,
        flatFeeStructure,
        this.CACHE_TTL.daoSubscription
      );

      return flatFeeStructure;
    } catch (error) {
      logger.error(`[DB Opt] Error fetching pool fee ${poolId}:`, error);
      return { tier: 'placeholder', transactionFeePercent: 2.0, performanceFeePercent: 8.0, managementFeePercent: 1.0 };
    }
  }

  /**
   * Batch get multiple pool fees (e.g., for dashboard)
   * Single query for all pools at once
   */
  static async getPoolFeesOptimized(poolIds: string[]): Promise<Map<string, any>> {
    if (poolIds.length === 0) {
      return new Map();
    }

    try {
      const flatFeeStructure = {
        tier: 'placeholder',
        transactionFeePercent: 2.0,
        performanceFeePercent: 8.0,
        managementFeePercent: 1.0,
      };

      const feeMap = new Map<string, any>();
      for (const poolId of poolIds) {
        feeMap.set(poolId, flatFeeStructure);
      }

      // TODO: replace with volume-based fee ladder once real transaction data exists — see pricing.md §6.4.
      // Flat rate is a placeholder, not a design decision.
      return feeMap;
    } catch (error) {
      logger.error(`[DB Opt] Error fetching pool fees:`, error);
      return new Map();
    }
  }

  /**
   * Invalidate all relevant caches after write operations
   */
  static async invalidateVaultCache(vaultId: string): Promise<void> {
    const keysToDelete = [
      this.CACHE_KEYS.vault(vaultId),
      this.CACHE_KEYS.vaultHoldings(vaultId),
      this.CACHE_KEYS.vaultState(vaultId),
    ];

    for (const key of keysToDelete) {
      await cacheService.delete(key);
    }
    logger.debug(`[DB Opt] Invalidated cache for vault ${vaultId}`);
  }

  /**
   * Invalidate pool fee cache after subscription update
   */
  static async invalidatePoolFeeCache(poolId: string): Promise<void> {
    await cacheService.delete(this.CACHE_KEYS.poolFee(poolId));
    logger.debug(`[DB Opt] Invalidated fee cache for pool ${poolId}`);
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<any> {
    return await cacheService.getStats();
  }
}

export const dbOptimizationLayer = DatabaseOptimizationLayer;
