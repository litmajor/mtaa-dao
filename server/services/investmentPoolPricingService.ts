
import { db } from '../db';
import { logger } from '../utils/logger';
import {
  investmentPools,
  poolInvestments,
  poolWithdrawals,
  daos,
  subscriptions,
  platformRevenue,
} from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { dbOptimizationLayer } from './databaseOptimizationLayer';

/**
 * Investment Pool Pricing Service
 * Interim flat fee placeholder; no DAO subscription tier is read for fee calculation.
 */

const PLATFORM_TRANSACTION_FEE_PERCENT = 2.0;
// TODO: replace with volume-based fee ladder once real transaction data exists — see pricing.md §6.4.
// Flat rate is a placeholder, not a design decision.

interface PlatformFeeStructure {
  tier: 'placeholder';
  transactionFeePercent: number;
  performanceFeePercent: number;
  managementFeePercent: number;
}

const FLAT_PLATFORM_FEES: PlatformFeeStructure = {
  tier: 'placeholder',
  transactionFeePercent: PLATFORM_TRANSACTION_FEE_PERCENT,
  performanceFeePercent: 8.0,
  managementFeePercent: 1.0,
};

class InvestmentPoolPricingService {
  /**
   * Get platform fee for a DAO's investment pool
   */
  async getPlatformFee(poolId: string): Promise<PlatformFeeStructure> {
    try {
      const feeStructure = await dbOptimizationLayer.getPoolFeeOptimized(poolId);
      return feeStructure || FLAT_PLATFORM_FEES;
    } catch (error) {
      logger.error('Error getting platform fee:', error);
      return FLAT_PLATFORM_FEES;
    }
  }

  /**
   * Calculate fees for an investment
   */
  async calculateInvestmentFees(poolId: string, amountUsd: number) {
    const fees = await this.getPlatformFee(poolId);
    
    const platformFee = (amountUsd * fees.transactionFeePercent) / 100;
    const netAmount = amountUsd - platformFee;

    return {
      grossAmount: amountUsd,
      platformFee,
      platformFeePercent: fees.transactionFeePercent,
      netAmount,
      tier: fees.tier,
    };
  }

  /**
   * Calculate fees for a withdrawal
   */
  async calculateWithdrawalFees(
    poolId: string,
    withdrawalValueUsd: number,
    initialInvestment: number
  ) {
    const fees = await this.getPlatformFee(poolId);
    
    const platformFee = (withdrawalValueUsd * fees.transactionFeePercent) / 100;
    
    // Performance fee only on profits
    const profit = Math.max(0, withdrawalValueUsd - initialInvestment);
    const performanceFee = (profit * fees.performanceFeePercent) / 100;
    
    const totalFees = platformFee + performanceFee;
    const netAmount = withdrawalValueUsd - totalFees;

    return {
      grossAmount: withdrawalValueUsd,
      platformFee,
      platformFeePercent: fees.transactionFeePercent,
      performanceFee,
      performanceFeePercent: fees.performanceFeePercent,
      profit,
      totalFees,
      netAmount,
      tier: fees.tier,
    };
  }

  /**
   * Record revenue from pool fees
   */
  async recordPoolRevenue(
    poolId: string,
    type: 'investment' | 'withdrawal',
    fees: {
      platformFee: number;
      performanceFee?: number;
      tier: string;
    }
  ) {
    try {
      // Get pool's DAO
      const [pool] = await db
        .select({ daoId: investmentPools.daoId })
        .from(investmentPools)
        .where(eq(investmentPools.id, poolId));

      if (!pool?.daoId) return;

      await db.insert(platformRevenue).values({
        daoId: pool.daoId,
        amount: (fees.platformFee + (fees.performanceFee || 0)).toFixed(2),
        currency: 'USD',
        description: JSON.stringify({
          poolId,
          tier: fees.tier,
          platformFee: fees.platformFee,
          performanceFee: fees.performanceFee || 0,
        }),
        transactionType: type === 'investment' ? 'pool_investment_fee' : 'pool_withdrawal_fee',
        status: 'paid',
      });

      logger.info(`✅ Recorded pool revenue: ${type} fee of KES ${fees.platformFee} (${fees.tier} tier)`);
    } catch (error) {
      logger.error('Error recording pool revenue:', error);
    }
  }

  /**
   * Track usage metrics for a DAO's investment pools
   */
  async trackPoolUsage(daoId: string, period: 'month' | 'year' = 'month') {
    try {
      const startDate = new Date();
      if (period === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }

      // Get all pools for this DAO
      const pools = await db
        .select({ id: investmentPools.id })
        .from(investmentPools)
        .where(eq(investmentPools.daoId, daoId));

      const poolIds = pools.map(p => p.id);

      // Count investments
      const investments = await db
        .select({
          count: sql<number>`COUNT(*)`,
          volume: sql<number>`SUM(CAST(investment_amount_usd AS DECIMAL))`,
        })
        .from(poolInvestments)
        .where(
          and(
            sql`${poolInvestments.poolId} IN (${sql.join(poolIds, sql`, `)})`,
            sql`${poolInvestments.investedAt} >= ${startDate}`
          )
        );

      // Count withdrawals
      const withdrawals = await db
        .select({
          count: sql<number>`COUNT(*)`,
          volume: sql<number>`SUM(CAST(withdrawal_value_usd AS DECIMAL))`,
        })
        .from(poolWithdrawals)
        .where(
          and(
            sql`${poolWithdrawals.poolId} IN (${sql.join(poolIds, sql`, `)})`,
            sql`${poolWithdrawals.withdrawnAt} >= ${startDate}`
          )
        );

      return {
        period,
        poolCount: pools.length,
        investments: {
          count: investments[0]?.count || 0,
          volume: Number(investments[0]?.volume || 0),
        },
        withdrawals: {
          count: withdrawals[0]?.count || 0,
          volume: Number(withdrawals[0]?.volume || 0),
        },
        totalTransactions: (investments[0]?.count || 0) + (withdrawals[0]?.count || 0),
        totalVolume: Number(investments[0]?.volume || 0) + Number(withdrawals[0]?.volume || 0),
      };
    } catch (error) {
      logger.error('Error tracking pool usage:', error);
      return null;
    }
  }
}

export const investmentPoolPricingService = new InvestmentPoolPricingService();
