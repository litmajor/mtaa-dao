
import { db } from '../db';
import { 
  users, 
  daos, 
  vaults, 
  walletTransactions,
  paymentTransactions,
  daoMemberships,
  platformRevenue,
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
  sourceType: 'user_payment' | 'dao_billing' | 'platform_ledger' | 'provider_fee';
  status: 'collected' | 'recorded_unsettled';
}

interface TransactionFeeConfig {
  onRampFee: number; // percentage
  offRampFee: number;
  swapFee: number;
  minFeeUSD: number;
}

const PLATFORM_TRANSACTION_FEE_PERCENT = 2.0;
// TODO: replace with volume-based fee ladder once real transaction data exists — see pricing.md §6.4.
// Flat rate is a placeholder, not a design decision.

export class RevenueService {
  
  // Transaction fee configuration
  private feeConfig: TransactionFeeConfig = {
    onRampFee: PLATFORM_TRANSACTION_FEE_PERCENT, // TODO: replace with volume-based fee ladder once real transaction data exists — see pricing.md §6.4. Flat rate is a placeholder, not a design decision.
    offRampFee: PLATFORM_TRANSACTION_FEE_PERCENT,
    swapFee: PLATFORM_TRANSACTION_FEE_PERCENT,
    minFeeUSD: 0.10 // Minimum $0.10 fee
  };

  /**
   * Calculate transaction fee for on/off-ramp
   */
  async calculateTransactionFee(
    type: 'on_ramp' | 'off_ramp' | 'swap',
    amountUSD: number
  ): Promise<{ fee: number; netAmount: number }> {
    // TODO: replace with volume-based fee ladder once real transaction data exists — see pricing.md §6.4.
    // Flat rate is a placeholder, not a design decision.
    const feePercentage = PLATFORM_TRANSACTION_FEE_PERCENT;

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
      await db.insert(platformRevenue).values({
        userId,
        amount: feeUSD.toFixed(2),
        currency: 'USD',
        description: JSON.stringify({ amountUSD, transactionHash }),
        transactionType: `${type}_fee`,
        status: 'paid',
      });

      Logger.getLogger().info(`Transaction fee recorded: ${type} - $${feeUSD.toFixed(2)}`);
    } catch (error) {
      Logger.getLogger().error('Failed to record transaction fee:', error);
    }
  }

  /**
   * Legacy DAO pay-as-you-grow check retained as a TODO marker only.
   * This path is intentionally not used for fee calculation anymore.
   * TODO: remove once the DAO growth/fee ladder is explicitly retired and the route call graph is confirmed.
   */
  async checkDaoPayAsYouGrow(daoId: string): Promise<{
    shouldPay: boolean;
    tier?: { memberCount: number; vaultTVL: number; monthlyFee: number };
    reason?: string;
  }> {
    // TODO: replace with volume-based fee ladder once real transaction data exists — see pricing.md §6.4.
    // Flat rate is a placeholder, not a design decision.
    Logger.getLogger().debug(`Legacy DAO pay-as-you-grow check invoked for ${daoId}; no tier-based fee ladder is active.`);
    return { shouldPay: false, reason: 'Fee calculation is flat-rate placeholder only; legacy DAO tier ladder removed.' };
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
      `) as any;

      const totalYield = parseFloat(String((yieldData.rows[0] as any)?.total_yield ?? '0'));
      
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
      `) as any;

      const totalSpent = spendingData.rows.reduce(
        (sum: number, row: any) => sum + parseFloat(String(row.total_spent ?? '0')),
        0
      );

      const transactions = spendingData.rows.reduce(
        (sum: number, row: any) => sum + parseInt(String(row.transaction_count ?? '0')),
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
    totalByCurrency: Record<string, number>;
    streams: RevenueStream[];
    recordedUnsettled: RevenueStream[];
    diversification: number; // 0-100 score
  }> {
    try {
      const { collected, recordedUnsettled } = await this.getRevenueStreams(period);
      const streams = collected;
      const totalByCurrency = streams.reduce<Record<string, number>>((totals, stream) => {
        totals[stream.currency] = (totals[stream.currency] || 0) + stream.amount;
        return totals;
      }, {});

      // Mixed currencies are intentionally not converted with a hardcoded rate.
      // Keep `total` for API compatibility as the collected USD subtotal.
      const total = totalByCurrency.USD || 0;

      // Calculate diversification score (higher = better)
      const nonZeroStreams = streams.filter(s => s.amount > 0).length;
      const diversification = streams.length > 0
        ? (nonZeroStreams / streams.length) * 100
        : 0;

      return { total, totalByCurrency, streams, recordedUnsettled, diversification };
    } catch (error) {
      Logger.getLogger().error('Failed to generate revenue report:', error);
      return { total: 0, totalByCurrency: {}, streams: [], recordedUnsettled: [], diversification: 0 };
    }
  }

  private async getRevenueStreams(
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<{ collected: RevenueStream[]; recordedUnsettled: RevenueStream[] }> {
    const startDate = this.getStartDate(period);
    const result = await db.execute(sql`
      SELECT
        'User Payments' AS source,
        currency,
        COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount,
        'user_payment' AS source_type
      FROM user_payment_history
      WHERE payment_type = 'subscription'
        AND status = 'completed'
        AND created_at >= ${startDate}
      GROUP BY currency

      UNION ALL

      SELECT
        'DAO Billing' AS source,
        currency,
        COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount,
        'dao_billing' AS source_type
      FROM billing_history
      WHERE status = 'paid'
        AND created_at >= ${startDate}
      GROUP BY currency

      UNION ALL

      SELECT
        'Platform Ledger' AS source,
        COALESCE(currency, 'KES') AS currency,
        COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount,
        'platform_ledger' AS source_type
      FROM platform_revenue
      WHERE status = 'paid'
        AND created_at >= ${startDate}
      GROUP BY COALESCE(currency, 'KES')
    `) as any;

    const collected = (result.rows as Array<Record<string, unknown>>).map((row) => ({
      source: String(row.source),
      amount: Number(row.amount || 0),
      currency: String(row.currency || 'KES'),
      period,
      sourceType: row.source_type as RevenueStream['sourceType'],
      status: 'collected' as const,
    }));

    const feeResult = await db.execute(sql`
      SELECT
        'Provider Fee Records' AS source,
        currency,
        COALESCE(SUM(CAST(fee_amount AS NUMERIC)), 0) AS amount
      FROM transaction_fees
      WHERE fee_type = 'platform_fee'
        AND created_at >= ${startDate}
      GROUP BY currency
    `) as any;

    const recordedUnsettled = (feeResult.rows as Array<Record<string, unknown>>).map((row) => ({
      source: String(row.source),
      amount: Number(row.amount || 0),
      currency: String(row.currency || 'KES'),
      period,
      sourceType: 'provider_fee' as const,
      status: 'recorded_unsettled' as const,
    }));

    return { collected, recordedUnsettled };
  }

  // Helper methods
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
