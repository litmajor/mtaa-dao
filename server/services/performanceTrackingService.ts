import { db } from '../db';
import { logger } from '../utils/logger';
import {
  investmentPools,
  poolAssets,
  poolPerformance,
  poolInvestments,
} from '../../shared/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { priceOracle } from './priceOracle';

/**
 * Performance Tracking Service
 * Records snapshots of pool performance for historical charts and analytics
 */

interface PoolPerformanceSnapshot {
  poolId: string;
  tvl: number;
  sharePrice: number;
  totalReturnPercentage: number;
  prices: {
    btc?: number;
    eth?: number;
    sol?: number;
    bnb?: number;
    xrp?: number;
    ltc?: number;
  };
  volatility: number;
  sharpeRatio: number;
}

class PerformanceTrackingService {
  /**
   * Record performance snapshots for all active pools
   */
  async recordAllPoolSnapshots(): Promise<void> {
    try {
      logger.info('📊 Recording performance snapshots for all pools...');

      const pools = await db
        .select()
        .from(investmentPools)
        .where(eq(investmentPools.isActive, true));

      for (const pool of pools) {
        try {
          await this.recordPoolSnapshot(pool.id);
        } catch (error) {
          logger.error(`Error recording snapshot for pool ${pool.id}:`, error);
        }
      }

      logger.info(`✅ Recorded snapshots for ${pools.length} pools`);
    } catch (error) {
      logger.error('Error in performance tracking service:', error);
    }
  }

  /**
   * Record a performance snapshot for a specific pool
   */
  async recordPoolSnapshot(poolId: string): Promise<void> {
    try {
      // Get pool data
      const [pool] = await db
        .select()
        .from(investmentPools)
        .where(eq(investmentPools.id, poolId));

      if (!pool) {
        logger.warn(`Pool ${poolId} not found`);
        return;
      }

      // Get pool assets
      const assets = await db
        .select()
        .from(poolAssets)
        .where(eq(poolAssets.poolId, poolId));

      // Get current prices for all assets
      const assetSymbols = assets.map(a => a.assetSymbol);
      const prices = await priceOracle.getPrices(assetSymbols);

      // Build price object
      const priceSnapshot: any = {};
      prices.forEach((data, symbol) => {
        priceSnapshot[symbol.toLowerCase()] = data.priceUsd;
      });

      // Calculate total return percentage
      const totalInvested = await this.getTotalInvestedAmount(poolId);
      const currentTVL = Number(pool.totalValueLocked) || 0;
      const totalReturn = totalInvested > 0 
        ? ((currentTVL - totalInvested) / totalInvested) * 100 
        : 0;

      // Calculate volatility (simplified: based on recent snapshots)
      const volatility = await this.calculateVolatility(poolId);

      // Calculate Sharpe ratio (risk-adjusted return)
      const sharpeRatio = await this.calculateSharpeRatio(poolId, totalReturn, volatility);

      // Insert snapshot
      await db.insert(poolPerformance).values({
        poolId,
        tvl: currentTVL.toString(),
        sharePrice: pool.sharePrice,
        totalReturnPercentage: totalReturn.toString(),
        btcPrice: priceSnapshot.btc?.toString(),
        ethPrice: priceSnapshot.eth?.toString(),
        solPrice: priceSnapshot.sol?.toString(),
        bnbPrice: priceSnapshot.bnb?.toString(),
        xrpPrice: priceSnapshot.xrp?.toString(),
        ltcPrice: priceSnapshot.ltc?.toString(),
        volatility: volatility.toString(),
        sharpeRatio: sharpeRatio.toString(),
      });

      logger.info(`📈 Snapshot recorded for pool ${pool.name}: TVL=$${currentTVL.toFixed(2)}, Return=${totalReturn.toFixed(2)}%`);
    } catch (error) {
      logger.error(`Error recording pool snapshot for ${poolId}:`, error);
      throw error;
    }
  }

  /**
   * Get total amount invested in a pool (all time)
   */
  private async getTotalInvestedAmount(poolId: string): Promise<number> {
    try {
      const result = await db
        .select({
          total: sql<number>`COALESCE(SUM(CAST(${poolInvestments.investmentAmountUsd} AS DECIMAL)), 0)`,
        })
        .from(poolInvestments)
        .where(eq(poolInvestments.poolId, poolId));

      return Number(result[0]?.total) || 0;
    } catch (error) {
      logger.error('Error calculating total invested:', error);
      return 0;
    }
  }

  /**
   * Calculate pool volatility (standard deviation of returns)
   */
  private async calculateVolatility(poolId: string): Promise<number> {
    try {
      // Get recent snapshots (last 30 days)
      const recentSnapshots = await db
        .select({
          sharePrice: poolPerformance.sharePrice,
          snapshotAt: poolPerformance.snapshotAt,
        })
        .from(poolPerformance)
        .where(eq(poolPerformance.poolId, poolId))
        .orderBy(desc(poolPerformance.snapshotAt))
        .limit(30);

      if (recentSnapshots.length < 2) {
        return 0; // Not enough data
      }

      // Calculate daily returns
      const returns: number[] = [];
      for (let i = 0; i < recentSnapshots.length - 1; i++) {
        const currentPrice = Number(recentSnapshots[i].sharePrice);
        const previousPrice = Number(recentSnapshots[i + 1].sharePrice);
        if (previousPrice > 0) {
          const dailyReturn = (currentPrice - previousPrice) / previousPrice;
          returns.push(dailyReturn);
        }
      }

      if (returns.length === 0) return 0;

      // Calculate standard deviation
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
      const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / returns.length;
      const stdDev = Math.sqrt(variance);

      // Annualize volatility (assuming 365 days)
      return stdDev * Math.sqrt(365) * 100; // Convert to percentage
    } catch (error) {
      logger.error('Error calculating volatility:', error);
      return 0;
    }
  }

  /**
   * Calculate Sharpe Ratio (risk-adjusted return)
   * Formula: (Return - Risk-free rate) / Volatility
   */
  private async calculateSharpeRatio(
    poolId: string,
    annualReturn: number,
    volatility: number
  ): Promise<number> {
    try {
      if (volatility === 0) return 0;

      const riskFreeRate = 4.0; // Assume 4% risk-free rate (e.g., US Treasury)
      const excessReturn = annualReturn - riskFreeRate;
      const sharpeRatio = excessReturn / volatility;

      return sharpeRatio;
    } catch (error) {
      logger.error('Error calculating Sharpe ratio:', error);
      return 0;
    }
  }

  /**
   * Get performance history for a pool
   */
  async getPerformanceHistory(
    poolId: string,
    days: number = 30
  ): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const history = await db
        .select()
        .from(poolPerformance)
        .where(
          sql`${poolPerformance.poolId} = ${poolId} AND ${poolPerformance.snapshotAt} >= ${startDate}`
        )
        .orderBy(poolPerformance.snapshotAt);

      return history;
    } catch (error) {
      logger.error('Error fetching performance history:', error);
      return [];
    }
  }

  /**
   * Get pool analytics summary
   */
  async getPoolAnalytics(poolId: string): Promise<any> {
    try {
      const [pool] = await db
        .select()
        .from(investmentPools)
        .where(eq(investmentPools.id, poolId));

      if (!pool) return null;

      // Get latest snapshot
      const [latestSnapshot] = await db
        .select()
        .from(poolPerformance)
        .where(eq(poolPerformance.poolId, poolId))
        .orderBy(desc(poolPerformance.snapshotAt))
        .limit(1);

      // Get 7-day and 30-day returns
      const returns7d = await this.getReturnForPeriod(poolId, 7);
      const returns30d = await this.getReturnForPeriod(poolId, 30);
      const returns90d = await this.getReturnForPeriod(poolId, 90);

      // Get total invested
      const totalInvested = await this.getTotalInvestedAmount(poolId);

      return {
        pool: {
          id: pool.id,
          name: pool.name,
          symbol: pool.symbol,
          tvl: Number(pool.totalValueLocked),
          sharePrice: Number(pool.sharePrice),
        },
        performance: {
          currentReturn: Number(latestSnapshot?.totalReturnPercentage) || 0,
          returns7d,
          returns30d,
          returns90d,
          volatility: Number(latestSnapshot?.volatility) || 0,
          sharpeRatio: Number(latestSnapshot?.sharpeRatio) || 0,
        },
        investment: {
          totalInvested,
          currentValue: Number(pool.totalValueLocked),
          profit: Number(pool.totalValueLocked) - totalInvested,
        },
      };
    } catch (error) {
      logger.error('Error getting pool analytics:', error);
      return null;
    }
  }

  /**
   * Calculate return percentage for a specific period
   */
  private async getReturnForPeriod(poolId: string, days: number): Promise<number> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [oldSnapshot] = await db
        .select()
        .from(poolPerformance)
        .where(
          sql`${poolPerformance.poolId} = ${poolId} AND ${poolPerformance.snapshotAt} >= ${startDate}`
        )
        .orderBy(poolPerformance.snapshotAt)
        .limit(1);

      const [latestSnapshot] = await db
        .select()
        .from(poolPerformance)
        .where(eq(poolPerformance.poolId, poolId))
        .orderBy(desc(poolPerformance.snapshotAt))
        .limit(1);

      if (!oldSnapshot || !latestSnapshot) return 0;

      const oldPrice = Number(oldSnapshot.sharePrice);
      const currentPrice = Number(latestSnapshot.sharePrice);

      if (oldPrice === 0) return 0;

      return ((currentPrice - oldPrice) / oldPrice) * 100;
    } catch (error) {
      logger.error(`Error calculating ${days}d return:`, error);
      return 0;
    }
  }
}

export const performanceTrackingService = new PerformanceTrackingService();

