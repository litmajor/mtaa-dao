
import { db } from '../storage';
import { transactionLimitTracking, kycTransactionHistory } from '../../shared/transactionLimitSchema';
import { kycService, KYC_TIERS } from './kycService';
import { eq, and, gte } from 'drizzle-orm';

export class TransactionLimitService {
  private readonly EXCHANGE_RATE_KES_USD = 129;

  /**
   * Check if user can perform transaction within their KYC limits
   */
  async canTransact(userId: string, amountUSD: number, transactionType: 'deposit' | 'withdrawal'): Promise<{
    allowed: boolean;
    reason?: string;
    tier?: string;
    dailyUsed?: number;
    monthlyUsed?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
  }> {
    try {
      // Get user's KYC tier
      const tier = await kycService.getCurrentTier(userId);
      
      // Get current usage for today
      const today = new Date().toISOString().split('T')[0];
      const usage = await this.getOrCreateUsageTracking(userId, today);

      const dailyUsed = parseFloat(usage.dailyVolume || '0');
      const monthlyUsed = parseFloat(usage.monthlyVolume || '0');

      // Convert tier limits to USD
      const dailyLimitUSD = tier.dailyLimit;
      const monthlyLimitUSD = tier.monthlyLimit;

      // Check daily limit
      if (dailyUsed + amountUSD > dailyLimitUSD) {
        return {
          allowed: false,
          reason: `Daily limit exceeded. Used: $${dailyUsed.toFixed(2)}/${dailyLimitUSD}, Attempting: $${amountUSD.toFixed(2)}`,
          tier: tier.tier,
          dailyUsed,
          monthlyUsed,
          dailyLimit: dailyLimitUSD,
          monthlyLimit: monthlyLimitUSD,
        };
      }

      // Check monthly limit
      if (monthlyUsed + amountUSD > monthlyLimitUSD) {
        return {
          allowed: false,
          reason: `Monthly limit exceeded. Used: $${monthlyUsed.toFixed(2)}/${monthlyLimitUSD}, Attempting: $${amountUSD.toFixed(2)}`,
          tier: tier.tier,
          dailyUsed,
          monthlyUsed,
          dailyLimit: dailyLimitUSD,
          monthlyLimit: monthlyLimitUSD,
        };
      }

      return {
        allowed: true,
        tier: tier.tier,
        dailyUsed,
        monthlyUsed,
        dailyLimit: dailyLimitUSD,
        monthlyLimit: monthlyLimitUSD,
      };
    } catch (error: any) {
      console.error('Error checking transaction limits:', error);
      return {
        allowed: false,
        reason: 'Error validating transaction limits',
      };
    }
  }

  /**
   * Record a successful transaction and update limits
   */
  async recordTransaction(
    userId: string,
    amountUSD: number,
    transactionType: 'deposit' | 'withdrawal',
    status: 'approved' | 'rejected' = 'approved',
    rejectionReason?: string
  ): Promise<void> {
    try {
      const tier = await kycService.getCurrentTier(userId);
      const today = new Date().toISOString().split('T')[0];
      const usage = await this.getOrCreateUsageTracking(userId, today);

      const dailyUsed = parseFloat(usage.dailyVolume || '0');
      const monthlyUsed = parseFloat(usage.monthlyVolume || '0');

      // Record in history
      await db.insert(kycTransactionHistory).values({
        userId,
        transactionType,
        amountUSD: amountUSD.toString(),
        amountKES: (amountUSD * this.EXCHANGE_RATE_KES_USD).toString(),
        kycTier: tier.tier,
        dailyLimit: tier.dailyLimit.toString(),
        monthlyLimit: tier.monthlyLimit.toString(),
        dailyUsed: dailyUsed.toString(),
        monthlyUsed: monthlyUsed.toString(),
        status,
        rejectionReason,
      });

      // Update usage tracking only if approved
      if (status === 'approved') {
        await db
          .update(transactionLimitTracking)
          .set({
            dailyVolume: (dailyUsed + amountUSD).toString(),
            monthlyVolume: (monthlyUsed + amountUSD).toString(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(transactionLimitTracking.userId, userId),
              eq(transactionLimitTracking.transactionDate, today)
            )
          );
      }
    } catch (error) {
      console.error('Error recording transaction:', error);
      throw error;
    }
  }

  /**
   * Get or create usage tracking for a specific date
   */
  private async getOrCreateUsageTracking(userId: string, date: string) {
    const [existing] = await db
      .select()
      .from(transactionLimitTracking)
      .where(
        and(
          eq(transactionLimitTracking.userId, userId),
          eq(transactionLimitTracking.transactionDate, date)
        )
      )
      .limit(1);

    if (existing) {
      // Check if we need to reset daily
      const lastReset = new Date(existing.lastResetDaily);
      const today = new Date();
      if (today.toDateString() !== lastReset.toDateString()) {
        await db
          .update(transactionLimitTracking)
          .set({
            dailyVolume: '0',
            lastResetDaily: today,
            updatedAt: today,
          })
          .where(
            and(
              eq(transactionLimitTracking.userId, userId),
              eq(transactionLimitTracking.transactionDate, date)
            )
          );
        return { ...existing, dailyVolume: '0' };
      }

      // Check if we need to reset monthly
      const lastMonthlyReset = new Date(existing.lastResetMonthly);
      if (today.getMonth() !== lastMonthlyReset.getMonth()) {
        await db
          .update(transactionLimitTracking)
          .set({
            monthlyVolume: '0',
            lastResetMonthly: today,
            updatedAt: today,
          })
          .where(
            and(
              eq(transactionLimitTracking.userId, userId),
              eq(transactionLimitTracking.transactionDate, date)
            )
          );
        return { ...existing, monthlyVolume: '0' };
      }

      return existing;
    }

    // Create new tracking record
    const [newTracking] = await db
      .insert(transactionLimitTracking)
      .values({
        userId,
        transactionDate: date,
        dailyVolume: '0',
        monthlyVolume: '0',
      })
      .returning();

    return newTracking;
  }

  /**
   * Get user's current transaction usage
   */
  async getUserUsage(userId: string): Promise<{
    tier: string;
    dailyUsed: number;
    monthlyUsed: number;
    dailyLimit: number;
    monthlyLimit: number;
    dailyRemaining: number;
    monthlyRemaining: number;
  }> {
    const tier = await kycService.getCurrentTier(userId);
    const today = new Date().toISOString().split('T')[0];
    const usage = await this.getOrCreateUsageTracking(userId, today);

    const dailyUsed = parseFloat(usage.dailyVolume || '0');
    const monthlyUsed = parseFloat(usage.monthlyVolume || '0');

    return {
      tier: tier.tier,
      dailyUsed,
      monthlyUsed,
      dailyLimit: tier.dailyLimit,
      monthlyLimit: tier.monthlyLimit,
      dailyRemaining: Math.max(0, tier.dailyLimit - dailyUsed),
      monthlyRemaining: Math.max(0, tier.monthlyLimit - monthlyUsed),
    };
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(userId: string, limit: number = 50) {
    return await db
      .select()
      .from(kycTransactionHistory)
      .where(eq(kycTransactionHistory.userId, userId))
      .orderBy(kycTransactionHistory.createdAt)
      .limit(limit);
  }
}

export const transactionLimitService = new TransactionLimitService();
