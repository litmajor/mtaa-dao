import { db } from '../db';
import { logger } from '../utils/logger';
import {
  investmentPools,
  poolAssets,
  poolInvestments,
  daoMemberships,
} from '../../shared/schema';
import { eq, and, sum } from 'drizzle-orm';
import { priceOracle } from './priceOracle';
import { v4 as uuidv4 } from 'uuid';

/**
 * Investment Pool Service
 * Handles multi-asset pool operations including asset management and allocation tracking
 */
export class InvestmentPoolService {
  /**
   * Add an asset to an investment pool
   * Validates DAO ownership and allocation constraints
   */
  async addAssetToPool(
    poolId: string,
    assetSymbol: string,
    targetAllocation: number, // in basis points (100 = 1%, 10000 = 100%)
    userId: string,
    tokenAddress?: string,
    network?: string
  ): Promise<{ success: boolean; asset?: any; error?: string }> {
    try {
      // 1. Verify pool exists and DAO membership if required
      const [pool] = await db
        .select()
        .from(investmentPools)
        .where(eq(investmentPools.id, poolId));

      if (!pool) {
        return { success: false, error: 'Pool not found' };
      }

      // 2. Verify DAO membership if pool belongs to a DAO
      if (pool.daoId) {
        const [membership] = await db
          .select()
          .from(daoMemberships)
          .where(
            and(
              eq(daoMemberships.daoId, pool.daoId),
              eq(daoMemberships.userId, userId)
            )
          )
          .limit(1);

        if (!membership) {
          return { success: false, error: 'User is not a member of the DAO that owns this pool' };
        }
      }

      // 3. Check if asset already exists in pool
      const [existingAsset] = await db
        .select()
        .from(poolAssets)
        .where(
          and(
            eq(poolAssets.poolId, poolId),
            eq(poolAssets.assetSymbol, assetSymbol)
          )
        )
        .limit(1);

      if (existingAsset && existingAsset.isActive) {
        return { success: false, error: `Asset ${assetSymbol} already exists in this pool` };
      }

      // 4. Get current allocations to validate new total doesn't exceed 100%
      const currentAllocation = await this.getTotalAllocation(poolId);
      if (currentAllocation + targetAllocation > 10000) {
        return {
          success: false,
          error: `Adding this asset would exceed 100% allocation (current: ${(currentAllocation / 100).toFixed(2)}%, requested: ${(targetAllocation / 100).toFixed(2)}%)`,
        };
      }

      // 5. Create asset record
      const newAsset = {
        id: uuidv4(),
        poolId,
        assetSymbol,
        assetName: assetSymbol, // Will be enriched from price oracle if available
        tokenAddress: tokenAddress || null,
        network: network || null,
        targetAllocation,
        currentBalance: '0',
        currentValueUsd: '0',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(poolAssets).values(newAsset);

      logger.info(
        `Asset ${assetSymbol} added to pool ${poolId} with ${(targetAllocation / 100).toFixed(2)}% allocation`
      );

      return { success: true, asset: newAsset };
    } catch (error) {
      logger.error('Error adding asset to pool:', error);
      return { success: false, error: 'Failed to add asset to pool' };
    }
  }

  /**
   * Remove an asset from an investment pool
   * Only allows removal if no current balance
   */
  async removeAssetFromPool(
    poolId: string,
    assetSymbol: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Verify pool exists and DAO membership if required
      const [pool] = await db
        .select()
        .from(investmentPools)
        .where(eq(investmentPools.id, poolId));

      if (!pool) {
        return { success: false, error: 'Pool not found' };
      }

      // 2. Verify DAO membership
      if (pool.daoId) {
        const [membership] = await db
          .select()
          .from(daoMemberships)
          .where(
            and(
              eq(daoMemberships.daoId, pool.daoId),
              eq(daoMemberships.userId, userId)
            )
          )
          .limit(1);

        if (!membership) {
          return { success: false, error: 'User is not a member of the DAO that owns this pool' };
        }
      }

      // 3. Get asset
      const [asset] = await db
        .select()
        .from(poolAssets)
        .where(
          and(
            eq(poolAssets.poolId, poolId),
            eq(poolAssets.assetSymbol, assetSymbol)
          )
        )
        .limit(1);

      if (!asset) {
        return { success: false, error: `Asset ${assetSymbol} not found in pool` };
      }

      // 4. Verify no current balance
      if (asset.currentBalance && parseFloat(asset.currentBalance) > 0) {
        return {
          success: false,
          error: `Cannot remove asset with current balance. Current balance: ${asset.currentBalance} ${assetSymbol}`,
        };
      }

      // 5. Soft delete (mark inactive) instead of hard delete
      await db
        .update(poolAssets)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(poolAssets.poolId, poolId),
            eq(poolAssets.assetSymbol, assetSymbol)
          )
        );

      logger.info(`Asset ${assetSymbol} removed from pool ${poolId}`);

      return { success: true };
    } catch (error) {
      logger.error('Error removing asset from pool:', error);
      return { success: false, error: 'Failed to remove asset from pool' };
    }
  }

  /**
   * Update an asset's target allocation
   * Validates that total allocation remains at or below 100%
   */
  async updateAssetAllocation(
    poolId: string,
    assetSymbol: string,
    newAllocation: number, // in basis points
    userId: string
  ): Promise<{ success: boolean; asset?: any; error?: string }> {
    try {
      // 1. Verify pool exists and DAO membership
      const [pool] = await db
        .select()
        .from(investmentPools)
        .where(eq(investmentPools.id, poolId));

      if (!pool) {
        return { success: false, error: 'Pool not found' };
      }

      if (pool.daoId) {
        const [membership] = await db
          .select()
          .from(daoMemberships)
          .where(
            and(
              eq(daoMemberships.daoId, pool.daoId),
              eq(daoMemberships.userId, userId)
            )
          )
          .limit(1);

        if (!membership) {
          return { success: false, error: 'User is not a member of the DAO that owns this pool' };
        }
      }

      // 2. Get asset
      const [asset] = await db
        .select()
        .from(poolAssets)
        .where(
          and(
            eq(poolAssets.poolId, poolId),
            eq(poolAssets.assetSymbol, assetSymbol)
          )
        )
        .limit(1);

      if (!asset) {
        return { success: false, error: `Asset ${assetSymbol} not found in pool` };
      }

      // 3. Validate new allocation
      if (newAllocation < 0 || newAllocation > 10000) {
        return { success: false, error: 'Allocation must be between 0 and 10000 basis points (0-100%)' };
      }

      // 4. Check total allocation doesn't exceed 100%
      const otherAssetsAllocation = await this.getTotalAllocation(poolId, assetSymbol);
      if (otherAssetsAllocation + newAllocation > 10000) {
        return {
          success: false,
          error: `New allocation would exceed 100% (other assets: ${(otherAssetsAllocation / 100).toFixed(2)}%, requested: ${(newAllocation / 100).toFixed(2)}%)`,
        };
      }

      // 5. Update allocation
      await db
        .update(poolAssets)
        .set({
          targetAllocation: newAllocation,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(poolAssets.poolId, poolId),
            eq(poolAssets.assetSymbol, assetSymbol)
          )
        );

      logger.info(
        `Asset ${assetSymbol} allocation updated to ${(newAllocation / 100).toFixed(2)}% in pool ${poolId}`
      );

      // Return updated asset
      const [updatedAsset] = await db
        .select()
        .from(poolAssets)
        .where(
          and(
            eq(poolAssets.poolId, poolId),
            eq(poolAssets.assetSymbol, assetSymbol)
          )
        )
        .limit(1);

      return { success: true, asset: updatedAsset };
    } catch (error) {
      logger.error('Error updating asset allocation:', error);
      return { success: false, error: 'Failed to update asset allocation' };
    }
  }

  /**
   * Get total allocation for a pool, optionally excluding one asset
   */
  async getTotalAllocation(poolId: string, excludeSymbol?: string): Promise<number> {
    try {
      let query = db
        .select({
          total: sum(poolAssets.targetAllocation),
        })
        .from(poolAssets)
        .where(
          and(
            eq(poolAssets.poolId, poolId),
            eq(poolAssets.isActive, true)
          )
        );

      if (excludeSymbol) {
        // @ts-ignore - Drizzle's type system doesn't handle dynamic conditions perfectly
        query = query.where(eq(poolAssets.assetSymbol, excludeSymbol) as any);
      }

      // @ts-ignore
      const [result] = await query;

      return result?.total ? parseInt(result.total.toString()) : 0;
    } catch (error) {
      logger.error('Error calculating total allocation:', error);
      return 0;
    }
  }

  /**
   * Get all assets in a pool with current pricing
   */
  async getPoolAssets(poolId: string): Promise<any[]> {
    try {
      const assets = await db
        .select()
        .from(poolAssets)
        .where(
          and(
            eq(poolAssets.poolId, poolId),
            eq(poolAssets.isActive, true)
          )
        );

      if (assets.length === 0) {
        return [];
      }

      // Get current prices for all assets
      const assetSymbols = assets.map(a => a.assetSymbol);
      const prices = await priceOracle.getPrices(assetSymbols);

      // Enrich assets with current prices
      return assets.map(asset => {
        const priceData = prices.get(asset.assetSymbol);
        return {
          ...asset,
          currentPriceUsd: priceData?.priceUsd || parseFloat(asset.lastPriceUsd || '0'),
          priceChange24h: priceData?.priceChange24h || 0,
          targetAllocationPercent: (asset.targetAllocation / 100).toFixed(2),
        };
      });
    } catch (error) {
      logger.error('Error getting pool assets:', error);
      return [];
    }
  }

  /**
   * Calculate portfolio value and composition
   */
  async getPortfolioComposition(poolId: string): Promise<{
    totalValueUsd: number;
    assets: Array<{
      symbol: string;
      balance: number;
      valueUsd: number;
      targetAllocation: number;
      currentAllocation: number;
      allocationVariance: number; // Negative means under-allocated, positive means over-allocated
    }>;
  }> {
    try {
      const assets = await this.getPoolAssets(poolId);

      let totalValueUsd = 0;
      const assetsWithValue = assets.map(asset => {
        const balance = parseFloat(asset.currentBalance || '0');
        const valueUsd = balance * (asset.currentPriceUsd || 0);
        totalValueUsd += valueUsd;
        return { ...asset, balance, valueUsd };
      });

      // Calculate actual allocations
      const composition = assetsWithValue.map(asset => {
        const currentAllocation = totalValueUsd > 0 ? (asset.valueUsd / totalValueUsd) * 100 : 0;
        const targetAllocationPercent = asset.targetAllocation / 100;
        const variance = currentAllocation - targetAllocationPercent;

        return {
          symbol: asset.assetSymbol,
          balance: asset.balance,
          valueUsd: asset.valueUsd,
          targetAllocation: targetAllocationPercent,
          currentAllocation,
          allocationVariance: variance,
        };
      });

      return {
        totalValueUsd,
        assets: composition,
      };
    } catch (error) {
      logger.error('Error calculating portfolio composition:', error);
      return {
        totalValueUsd: 0,
        assets: [],
      };
    }
  }

  /**
   * Validate pool asset configuration
   * Checks that allocations sum to exactly 100%
   */
  async validatePoolConfiguration(poolId: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check allocation sum
      const totalAllocation = await this.getTotalAllocation(poolId);
      if (totalAllocation !== 10000) {
        issues.push(
          `Asset allocations total ${(totalAllocation / 100).toFixed(2)}% instead of required 100%`
        );
      }

      // Check at least one active asset
      const assets = await this.getPoolAssets(poolId);
      if (assets.length === 0) {
        issues.push('Pool has no active assets');
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      logger.error('Error validating pool configuration:', error);
      return {
        valid: false,
        issues: ['Failed to validate pool configuration'],
      };
    }
  }
}

export const investmentPoolService = new InvestmentPoolService();
