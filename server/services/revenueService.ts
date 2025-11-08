
import { db } from '../db';
import { 
  users, 
  daos, 
  vaults, 
  walletTransactions,
  paymentTransactions,
  daoMemberships 
} from '../../shared/schema';
import { eq, sql, and, gte, desc } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { userSubscriptionService } from './userSubscriptionService';
import { tokenService } from './tokenService';

interface RevenueStream {
  source: string;
  amount: number;
  currency: string;
  period: 'daily' | 'weekly' | 'monthly';
}

interface TransactionFeeConfig {
  onRampFee: number; // percentage
  offRampFee: number;
  swapFee: number;
  minFeeUSD: number;
}

interface PayAsYouGrowThreshold {
  memberCount: number;
  vaultTVL: number; // USD
  monthlyFee: number; // KES
}

export class RevenueService {
  
  // Transaction fee configuration
  private feeConfig: TransactionFeeConfig = {
    onRampFee: 1.0, // 1% on fiat → crypto
    offRampFee: 1.0, // 1% on crypto → fiat
    swapFee: 0.3, // 0.3% on token swaps
    minFeeUSD: 0.10 // Minimum $0.10 fee
  };

  // Pay-as-you-grow thresholds for DAOs
  private daoThresholds: PayAsYouGrowThreshold[] = [
    { memberCount: 50, vaultTVL: 10000, monthlyFee: 500 }, // KES 500/mo
    { memberCount: 100, vaultTVL: 50000, monthlyFee: 1500 }, // KES 1,500/mo
    { memberCount: 250, vaultTVL: 200000, monthlyFee: 5000 }, // KES 5,000/mo
    { memberCount: 500, vaultTVL: 1000000, monthlyFee: 15000 }, // KES 15,000/mo
  ];

  /**
   * Calculate transaction fee for on/off-ramp
   */
  async calculateTransactionFee(
    type: 'on_ramp' | 'off_ramp' | 'swap',
    amountUSD: number
  ): Promise<{ fee: number; netAmount: number }> {
    let feePercentage = 0;

    switch (type) {
      case 'on_ramp':
        feePercentage = this.feeConfig.onRampFee;
        break;
      case 'off_ramp':
        feePercentage = this.feeConfig.offRampFee;
        break;
      case 'swap':
        feePercentage = this.feeConfig.swapFee;
        break;
    }

    const calculatedFee = (amountUSD * feePercentage) / 100;
    const fee = Math.max(calculatedFee, this.feeConfig.minFeeUSD);
    const netAmount = amountUSD - fee;

    return { fee, netAmount };
  }

  /**
   * Record transaction fee revenue
   */
  async recordTransactionFee(
    userId: string,
    type: 'on_ramp' | 'off_ramp' | 'swap',
    amountUSD: number,
    feeUSD: number,
    transactionHash?: string
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO platform_revenue (
          revenue_stream, user_id, amount_usd, currency, 
          metadata, created_at
        ) VALUES (
          ${type + '_fee'}, ${userId}, ${feeUSD}, 'USD',
          ${JSON.stringify({ amountUSD, transactionHash })}, NOW()
        )
      `);

      Logger.getLogger().info(`Transaction fee recorded: ${type} - $${feeUSD.toFixed(2)}`);
    } catch (error) {
      Logger.getLogger().error('Failed to record transaction fee:', error);
    }
  }

  /**
   * Check if DAO should pay based on growth thresholds
   */
  async checkDaoPayAsYouGrow(daoId: string): Promise<{
    shouldPay: boolean;
    tier?: PayAsYouGrowThreshold;
    reason?: string;
  }> {
    try {
      // Get DAO details
      const dao = await db.query.daos.findFirst({
        where: eq(daos.id, daoId)
      });

      if (!dao) {
        return { shouldPay: false, reason: 'DAO not found' };
      }

      // If already on paid plan, skip
      if (dao.plan && dao.plan !== 'free') {
        return { shouldPay: false, reason: 'Already on paid plan' };
      }

      // Get member count
      const memberCount = dao.memberCount || 0;

      // Get vault TVL
      const vaultTVL = await db.execute(sql`
        SELECT COALESCE(SUM(CAST(total_value_locked AS NUMERIC)), 0) as total_tvl
        FROM vaults
        WHERE dao_id = ${daoId} AND is_active = true
      `);

      const totalTVL = parseFloat(vaultTVL.rows[0]?.total_tvl || '0');

      // Check thresholds
      for (const threshold of this.daoThresholds) {
        if (memberCount >= threshold.memberCount || totalTVL >= threshold.vaultTVL) {
          return {
            shouldPay: true,
            tier: threshold,
            reason: `Exceeded threshold: ${memberCount} members or $${totalTVL.toFixed(2)} TVL`
          };
        }
      }

      return { shouldPay: false };
    } catch (error) {
      Logger.getLogger().error('Failed to check DAO pay-as-you-grow:', error);
      return { shouldPay: false, reason: 'Error checking thresholds' };
    }
  }

  /**
   * Calculate affiliate yield revenue from DeFi strategies
   */
  async calculateAffiliateYield(period: 'daily' | 'weekly' | 'monthly'): Promise<number> {
    try {
      const startDate = this.getStartDate(period);

      // Get all vault strategy allocations with yield
      const yieldData = await db.execute(sql`
        SELECT 
          SUM(CAST(yield_earned AS NUMERIC)) as total_yield,
          COUNT(DISTINCT vault_id) as active_vaults
        FROM vault_strategy_allocations
        WHERE is_active = true
        AND updated_at >= ${startDate}
      `);

      const totalYield = parseFloat(yieldData.rows[0]?.total_yield || '0');
      
      // Platform takes 10% of all yields as affiliate fee
      const affiliateFee = totalYield * 0.10;

      Logger.getLogger().info(`Affiliate yield (${period}): $${affiliateFee.toFixed(2)}`);

      return affiliateFee;
    } catch (error) {
      Logger.getLogger().error('Failed to calculate affiliate yield:', error);
      return 0;
    }
  }

  /**
   * Get MTAA marketplace revenue
   */
  async getMTAAMarketplaceRevenue(period: 'daily' | 'weekly' | 'monthly'): Promise<{
    totalSpent: number;
    transactions: number;
    topCategories: any[];
  }> {
    try {
      const startDate = this.getStartDate(period);

      // Get MTAA spending from feature usage
      const spendingData = await db.execute(sql`
        SELECT 
          feature_type,
          SUM(mtaa_spent) as total_spent,
          COUNT(*) as transaction_count
        FROM user_feature_usage
        WHERE last_used_at >= ${startDate}
        AND mtaa_spent > 0
        GROUP BY feature_type
        ORDER BY total_spent DESC
      `);

      const totalSpent = spendingData.rows.reduce(
        (sum, row) => sum + parseFloat(row.total_spent || '0'), 
        0
      );

      const transactions = spendingData.rows.reduce(
        (sum, row) => sum + parseInt(row.transaction_count || '0'), 
        0
      );

      return {
        totalSpent,
        transactions,
        topCategories: spendingData.rows.slice(0, 5)
      };
    } catch (error) {
      Logger.getLogger().error('Failed to get MTAA marketplace revenue:', error);
      return { totalSpent: 0, transactions: 0, topCategories: [] };
    }
  }

  /**
   * Comprehensive revenue report
   */
  async getRevenueReport(period: 'daily' | 'weekly' | 'monthly'): Promise<{
    total: number;
    streams: RevenueStream[];
    diversification: number; // 0-100 score
  }> {
    try {
      const streams: RevenueStream[] = [];

      // 1. User subscriptions
      const userSubs = await this.getUserSubscriptionRevenue(period);
      streams.push({
        source: 'User Subscriptions',
        amount: userSubs,
        currency: 'KES',
        period
      });

      // 2. DAO subscriptions
      const daoSubs = await this.getDAOSubscriptionRevenue(period);
      streams.push({
        source: 'DAO Subscriptions',
        amount: daoSubs,
        currency: 'KES',
        period
      });

      // 3. Transaction fees
      const txFees = await this.getTransactionFeeRevenue(period);
      streams.push({
        source: 'Transaction Fees',
        amount: txFees,
        currency: 'USD',
        period
      });

      // 4. Affiliate yields
      const affiliateYield = await this.calculateAffiliateYield(period);
      streams.push({
        source: 'Affiliate Yields',
        amount: affiliateYield,
        currency: 'USD',
        period
      });

      // 5. MTAA marketplace
      const marketplace = await this.getMTAAMarketplaceRevenue(period);
      streams.push({
        source: 'MTAA Marketplace',
        amount: marketplace.totalSpent,
        currency: 'MTAA',
        period
      });

      // Calculate total (normalize to USD)
      const total = streams.reduce((sum, stream) => {
        if (stream.currency === 'KES') return sum + (stream.amount / 130); // KES to USD
        if (stream.currency === 'MTAA') return sum + (stream.amount * 0.10); // MTAA to USD
        return sum + stream.amount;
      }, 0);

      // Calculate diversification score (higher = better)
      const nonZeroStreams = streams.filter(s => s.amount > 0).length;
      const diversification = (nonZeroStreams / streams.length) * 100;

      return { total, streams, diversification };
    } catch (error) {
      Logger.getLogger().error('Failed to generate revenue report:', error);
      return { total: 0, streams: [], diversification: 0 };
    }
  }

  // Helper methods
  private async getUserSubscriptionRevenue(period: 'daily' | 'weekly' | 'monthly'): Promise<number> {
    const startDate = this.getStartDate(period);

    const revenue = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM user_payment_history
      WHERE payment_type = 'subscription'
      AND status = 'completed'
      AND created_at >= ${startDate}
    `);

    return parseFloat(revenue.rows[0]?.total || '0');
  }

  private async getDAOSubscriptionRevenue(period: 'daily' | 'weekly' | 'monthly'): Promise<number> {
    const startDate = this.getStartDate(period);

    const revenue = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM billing_history
      WHERE status = 'paid'
      AND created_at >= ${startDate}
    `);

    return parseFloat(revenue.rows[0]?.total || '0');
  }

  private async getTransactionFeeRevenue(period: 'daily' | 'weekly' | 'monthly'): Promise<number> {
    const startDate = this.getStartDate(period);

    const revenue = await db.execute(sql`
      SELECT COALESCE(SUM(amount_usd), 0) as total
      FROM platform_revenue
      WHERE revenue_stream IN ('on_ramp_fee', 'off_ramp_fee', 'swap_fee')
      AND created_at >= ${startDate}
    `);

    return parseFloat(revenue.rows[0]?.total || '0');
  }

  private getStartDate(period: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    switch (period) {
      case 'daily':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }
}

export const revenueService = new RevenueService();
