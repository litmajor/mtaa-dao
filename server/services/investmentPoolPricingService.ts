
import { db } from '../db';
import { logger } from '../utils/logger';
import {
  investmentPools,
  poolInvestments,
  poolWithdrawals,
  daoSubscriptions,
  daos,
} from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Investment Pool Pricing Service
 * Enforces platform fees based on DAO subscription tier
 */

interface PlatformFeeStructure {
  tier: 'community' | 'growth' | 'professional' | 'enterprise';
  transactionFeePercent: number;
  performanceFeePercent: number;
  managementFeePercent: number;
}

const PLATFORM_FEES: Record<string, PlatformFeeStructure> = {
  community: {
    tier: 'community',
    transactionFeePercent: 2.0,
    performanceFeePercent: 8.0,
    managementFeePercent: 1.0,
  },
  growth: {
    tier: 'growth',
    transactionFeePercent: 1.5,
    performanceFeePercent: 8.0,
    managementFeePercent: 1.0,
  },
  professional: {
    tier: 'professional',
    transactionFeePercent: 1.0,
    performanceFeePercent: 8.0,
    managementFeePercent: 1.0,
  },
  enterprise: {
    tier: 'enterprise',
    transactionFeePercent: 0.75, // Custom negotiated
    performanceFeePercent: 8.0,
    managementFeePercent: 1.0,
  },
};

class InvestmentPoolPricingService {
  /**
   * Get platform fee for a DAO's investment pool
   */
  async getPlatformFee(poolId: string): Promise<PlatformFeeStructure> {
    try {
      // Get pool and DAO
      const [pool] = await db
        .select({
          poolId: investmentPools.id,
          daoId: investmentPools.daoId,
        })
        .from(investmentPools)
        .where(eq(investmentPools.id, poolId));

      if (!pool || !pool.daoId) {
        // Default to community tier
        return PLATFORM_FEES.community;
      }

      // Get DAO's subscription tier
      const [subscription] = await db
        .select({
          currentPlan: daoSubscriptions.currentPlan,
        })
        .from(daoSubscriptions)
        .where(eq(daoSubscriptions.daoId, pool.daoId))
        .orderBy(sql`${daoSubscriptions.createdAt} DESC`)
        .limit(1);

      const tier = subscription?.currentPlan || 'community';
      return PLATFORM_FEES[tier] || PLATFORM_FEES.community;
    } catch (error) {
      logger.error('Error getting platform fee:', error);
      return PLATFORM_FEES.community;
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

      // Record in platform revenue table
      await db.execute(sql`
        INSERT INTO platform_revenue (
          source,
          dao_id,
          revenue_type,
          amount_ksh,
          tier,
          metadata,
          created_at
        ) VALUES (
          'investment_pool',
          ${pool.daoId},
          ${type === 'investment' ? 'pool_investment_fee' : 'pool_withdrawal_fee'},
          ${fees.platformFee + (fees.performanceFee || 0)},
          ${fees.tier},
          ${JSON.stringify({
            poolId,
            platformFee: fees.platformFee,
            performanceFee: fees.performanceFee || 0,
          })},
          NOW()
        )
      `);

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
