import { db } from '../db';
import { logger } from '../utils/logger';
import {
  investmentPools,
  poolAssets,
  rebalancingSettings,
  poolRebalances,
  poolSwapTransactions,
  assetPriceHistory,
} from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { priceOracle } from './priceOracle';
import { dexService } from './dexIntegrationService';

/**
 * Automated Rebalancing Service
 * Monitors pools and triggers rebalancing when allocations drift beyond threshold
 */

interface AssetAllocation {
  assetSymbol: string;
  targetAllocation: number; // basis points
  currentBalance: number;
  currentValueUsd: number;
  currentAllocation: number; // actual basis points
  deviation: number; // basis points
}

class RebalancingService {
  private isRunning = false;

  /**
   * Check all pools and rebalance if needed
   */
  async checkAndRebalanceAll(): Promise<void> {
    if (this.isRunning) {
      logger.info('Rebalancing check already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('🔄 Starting automated rebalancing check...');

      // Get all pools with auto-rebalance enabled
      const poolsToCheck = await db
        .select({
          poolId: investmentPools.id,
          poolName: investmentPools.name,
          tvl: investmentPools.totalValueLocked,
          autoRebalanceEnabled: rebalancingSettings.autoRebalanceEnabled,
        })
        .from(investmentPools)
        .innerJoin(
          rebalancingSettings,
          eq(rebalancingSettings.poolId, investmentPools.id)
        )
        .where(
          and(
            eq(investmentPools.isActive, true),
            eq(rebalancingSettings.autoRebalanceEnabled, true)
          )
        );

      logger.info(`Found ${poolsToCheck.length} pools with auto-rebalance enabled`);

      for (const pool of poolsToCheck) {
        try {
          await this.checkAndRebalancePool(pool.poolId);
        } catch (error) {
          logger.error(`Error rebalancing pool ${pool.poolId}:`, error);
        }
      }

      logger.info('✅ Rebalancing check completed');
    } catch (error) {
      logger.error('Error in rebalancing service:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check and rebalance a specific pool
   */
  async checkAndRebalancePool(poolId: string): Promise<boolean> {
    try {
      // Get pool settings
      const [settings] = await db
        .select()
        .from(rebalancingSettings)
        .where(eq(rebalancingSettings.poolId, poolId));

      if (!settings || !settings.autoRebalanceEnabled) {
        return false;
      }

      // Get pool assets
      const assets = await db
        .select()
        .from(poolAssets)
        .where(eq(poolAssets.poolId, poolId));

      if (assets.length === 0) {
        return false;
      }

      // Get current prices
      const assetSymbols = assets.map(a => a.assetSymbol);
      const prices = await priceOracle.getPrices(assetSymbols);

      // Calculate current allocations
      let totalValue = 0;
      const allocations: AssetAllocation[] = [];

      for (const asset of assets) {
        const priceData = prices.get(asset.assetSymbol);
        if (!priceData) continue;

        const currentBalance = Number(asset.currentBalance) || 0;
        const currentValueUsd = currentBalance * priceData.priceUsd;
        totalValue += currentValueUsd;

        allocations.push({
          assetSymbol: asset.assetSymbol,
          targetAllocation: asset.targetAllocation,
          currentBalance,
          currentValueUsd,
          currentAllocation: 0, // Will be calculated after totalValue is known
          deviation: 0,
        });
      }

      // Calculate actual allocations and deviations
      let maxDeviation = 0;
      for (const allocation of allocations) {
        allocation.currentAllocation = totalValue > 0 
          ? Math.round((allocation.currentValueUsd / totalValue) * 10000)
          : 0;
        allocation.deviation = Math.abs(allocation.currentAllocation - allocation.targetAllocation);
        maxDeviation = Math.max(maxDeviation, allocation.deviation);
      }

      logger.info(`Pool ${poolId}: Max deviation = ${maxDeviation} basis points (threshold: ${settings.rebalanceThreshold})`);

      // Check if rebalancing is needed
      if (maxDeviation < settings.rebalanceThreshold) {
        logger.info(`Pool ${poolId}: No rebalancing needed`);
        
        // Update last check time
        await db
          .update(rebalancingSettings)
          .set({ lastRebalanceCheck: new Date() })
          .where(eq(rebalancingSettings.poolId, poolId));
        
        return false;
      }

      // Perform rebalancing
      logger.info(`Pool ${poolId}: Rebalancing needed! Max deviation: ${maxDeviation} bp`);
      await this.performRebalance(poolId, allocations, totalValue);

      return true;
    } catch (error) {
      logger.error(`Error checking pool ${poolId} for rebalancing:`, error);
      return false;
    }
  }

  /**
   * Perform the actual rebalancing
   */
  private async performRebalance(
    poolId: string,
    allocations: AssetAllocation[],
    totalValue: number
  ): Promise<void> {
    try {
      // Calculate required swaps
      const swaps: Array<{
        fromAsset: string;
        toAsset: string;
        amount: number;
      }> = [];

      // Simplified rebalancing: For Phase 2, we'll log the required swaps
      // In Phase 3, this will integrate with DEX for actual swaps
      
      const assetsToSell = allocations.filter(a => a.currentAllocation > a.targetAllocation);
      const assetsToBuy = allocations.filter(a => a.currentAllocation < a.targetAllocation);

      for (const sellAsset of assetsToSell) {
        const excessValue = (sellAsset.currentAllocation - sellAsset.targetAllocation) / 10000 * totalValue;
        
        for (const buyAsset of assetsToBuy) {
          const deficitValue = (buyAsset.targetAllocation - buyAsset.currentAllocation) / 10000 * totalValue;
          const swapAmount = Math.min(excessValue, deficitValue);
          
          if (swapAmount > 0) {
            swaps.push({
              fromAsset: sellAsset.assetSymbol,
              toAsset: buyAsset.assetSymbol,
              amount: swapAmount,
            });
          }
        }
      }

      // Record rebalance event
      const [rebalance] = await db
        .insert(poolRebalances)
        .values({
          poolId,
          initiatedBy: 'system', // Automated rebalancing
          tvlBefore: totalValue.toString(),
          tvlAfter: totalValue.toString(), // Same until swaps are executed
          assetsChanged: JSON.stringify(allocations.map(a => ({
            symbol: a.assetSymbol,
            from_allocation: a.currentAllocation,
            to_allocation: a.targetAllocation,
            deviation: a.deviation,
          }))),
          reason: `Automated rebalancing - Max deviation: ${Math.max(...allocations.map(a => a.deviation))} bp`,
          status: 'simulated', // In Phase 2, we simulate. Phase 3 will execute actual swaps
        })
        .returning();

      // Execute swaps using DEX service (Phase 3)
      for (const swap of swaps) {
        // Get swap quote
        const quote = await dexService.getSwapQuote(
          swap.fromAsset,
          swap.toAsset,
          swap.amount
        );

        // Execute swap (simulated in Phase 3)
        const swapResult = await dexService.executeSwap(
          swap.fromAsset,
          swap.toAsset,
          swap.amount
        );

        // Record swap transaction
        await db.insert(poolSwapTransactions).values({
          poolId,
          rebalanceId: rebalance.id,
          fromAsset: swap.fromAsset,
          toAsset: swap.toAsset,
          amountFrom: swap.amount.toString(),
          amountTo: swapResult.amountOut?.toString() || '0',
          exchangeRate: swapResult.actualRate?.toString(),
          dexUsed: quote?.dex || 'ubeswap',
          transactionHash: swapResult.transactionHash,
          gasFee: swapResult.gasUsed?.toString(),
          status: swapResult.success ? 'completed' : 'failed',
        });

        logger.info(`  📊 Swap: ${swap.fromAsset} → ${swap.toAsset} ($${swap.amount.toFixed(2)})`);
        if (swapResult.success) {
          logger.info(`     ✅ Output: ${swapResult.amountOut?.toFixed(6)} ${swap.toAsset}`);
          logger.info(`     TX: ${swapResult.transactionHash}`);
        } else {
          logger.error(`     ❌ Swap failed: ${swapResult.error}`);
        }
      }

      // Update rebalancing settings
      await db
        .update(rebalancingSettings)
        .set({
          lastRebalanceCheck: new Date(),
          nextRebalanceScheduled: this.getNextRebalanceTime(allocations[0]?.deviation || 0),
        })
        .where(eq(rebalancingSettings.poolId, poolId));

      logger.info(`✅ Pool ${poolId}: Rebalancing completed (${swaps.length} swaps simulated)`);
    } catch (error) {
      logger.error('Error performing rebalance:', error);
      throw error;
    }
  }

  /**
   * Calculate next rebalance time based on frequency
   */
  private getNextRebalanceTime(deviation: number): Date {
    const now = new Date();
    
    // More aggressive rebalancing for larger deviations
    if (deviation > 1000) { // > 10%
      now.setHours(now.getHours() + 6); // 6 hours
    } else if (deviation > 500) { // > 5%
      now.setDate(now.getDate() + 1); // 1 day
    } else {
      now.setDate(now.getDate() + 7); // 7 days
    }
    
    return now;
  }

  /**
   * Record asset prices for historical tracking
   */
  async recordAssetPrices(): Promise<void> {
    try {
      const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'LTC'];
      const prices = await priceOracle.getPrices(symbols);

      for (const [symbol, priceData] of prices.entries()) {
        await db.insert(assetPriceHistory).values({
          assetSymbol: symbol,
          priceUsd: priceData.priceUsd.toString(),
          marketCap: priceData.marketCap.toString(),
          volume24h: priceData.volume24h.toString(),
          priceChange24h: priceData.priceChange24h.toString(),
        });
      }

      logger.info(`📈 Recorded prices for ${prices.size} assets`);
    } catch (error) {
      logger.error('Error recording asset prices:', error);
    }
  }

  /**
   * Get rebalancing status for a pool
   */
  async getRebalancingStatus(poolId: string): Promise<any> {
    try {
      const [settings] = await db
        .select()
        .from(rebalancingSettings)
        .where(eq(rebalancingSettings.poolId, poolId));

      const recentRebalances = await db
        .select()
        .from(poolRebalances)
        .where(eq(poolRebalances.poolId, poolId))
        .orderBy(sql`${poolRebalances.rebalancedAt} DESC`)
        .limit(10);

      return {
        settings,
        recentRebalances,
        nextCheck: settings?.nextRebalanceScheduled,
      };
    } catch (error) {
      logger.error('Error getting rebalancing status:', error);
      return null;
    }
  }
}

export const rebalancingService = new RebalancingService();

