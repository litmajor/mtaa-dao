
import { db } from '../storage';
import { unifiedTransactionLimits, p2pTransfers } from '../../shared/p2pTransferSchema';
import { kycTransactionHistory } from '../../shared/transactionLimitSchema';
import { kycService, KYC_TIERS } from './kycService';
import { exchangeRateService } from './exchangeRateService';
import { eq, and } from 'drizzle-orm';

export class TransactionLimitService {

  /**
   * Check if user can perform any transaction within their KYC limits
   * Supports: deposit, withdrawal, p2p_send
   */
  async canTransact(
    userId: string,
    amountUSD: number,
    transactionType: 'deposit' | 'withdrawal' | 'p2p_send'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    tier?: string;
    dailyUsed?: number;
    monthlyUsed?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
  }> {
    try {
      const tier = await kycService.getCurrentTier(userId);
      const today = new Date().toISOString().split('T')[0];
      const usage = await this.getOrCreateUnifiedUsage(userId, today);

      const dailyUsed = parseFloat(usage.dailyTotalVolume || '0');
      const monthlyUsed = parseFloat(usage.monthlyTotalVolume || '0');

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
   * Record a transaction and update unified limits
   */
  async recordTransaction(
    userId: string,
    amountUSD: number,
    transactionType: 'deposit' | 'withdrawal' | 'p2p_send',
    status: 'approved' | 'rejected' = 'approved',
    rejectionReason?: string
  ): Promise<void> {
    try {
      const tier = await kycService.getCurrentTier(userId);
      const today = new Date().toISOString().split('T')[0];
      const usage = await this.getOrCreateUnifiedUsage(userId, today);

      const dailyUsed = parseFloat(usage.dailyTotalVolume || '0');
      const monthlyUsed = parseFloat(usage.monthlyTotalVolume || '0');

      // Get current exchange rate
      const exchangeRate = await exchangeRateService.getUSDtoKESRate();

      // Record in history
      await db.insert(kycTransactionHistory).values({
        userId,
        transactionType,
        amountUSD: amountUSD.toString(),
        amountKES: (amountUSD * exchangeRate).toString(),
        kycTier: tier.tier,
        dailyLimit: tier.dailyLimit.toString(),
        monthlyLimit: tier.monthlyLimit.toString(),
        dailyUsed: dailyUsed.toString(),
        monthlyUsed: monthlyUsed.toString(),
        status,
        rejectionReason,
      });

      // Update unified usage tracking only if approved
      if (status === 'approved') {
        const updates: any = {
          dailyTotalVolume: (dailyUsed + amountUSD).toString(),
          monthlyTotalVolume: (monthlyUsed + amountUSD).toString(),
          updatedAt: new Date(),
        };

        // Update specific volume fields
        if (transactionType === 'deposit') {
          const currentDeposit = parseFloat(usage.dailyDepositVolume || '0');
          const currentMonthlyDeposit = parseFloat(usage.monthlyDepositVolume || '0');
          updates.dailyDepositVolume = (currentDeposit + amountUSD).toString();
          updates.monthlyDepositVolume = (currentMonthlyDeposit + amountUSD).toString();
        } else if (transactionType === 'withdrawal') {
          const currentWithdrawal = parseFloat(usage.dailyWithdrawalVolume || '0');
          const currentMonthlyWithdrawal = parseFloat(usage.monthlyWithdrawalVolume || '0');
          updates.dailyWithdrawalVolume = (currentWithdrawal + amountUSD).toString();
          updates.monthlyWithdrawalVolume = (currentMonthlyWithdrawal + amountUSD).toString();
        } else if (transactionType === 'p2p_send') {
          const currentP2p = parseFloat(usage.dailyP2pSentVolume || '0');
          const currentMonthlyP2p = parseFloat(usage.monthlyP2pSentVolume || '0');
          updates.dailyP2pSentVolume = (currentP2p + amountUSD).toString();
          updates.monthlyP2pSentVolume = (currentMonthlyP2p + amountUSD).toString();
        }

        await db
          .update(unifiedTransactionLimits)
          .set(updates)
          .where(
            and(
              eq(unifiedTransactionLimits.userId, userId),
              eq(unifiedTransactionLimits.transactionDate, today)
            )
          );
      }
    } catch (error) {
      console.error('Error recording transaction:', error);
      throw error;
    }
  }

  /**
   * Get or create unified usage tracking
   */
  private async getOrCreateUnifiedUsage(userId: string, date: string) {
    const [existing] = await db
      .select()
      .from(unifiedTransactionLimits)
      .where(
        and(
          eq(unifiedTransactionLimits.userId, userId),
          eq(unifiedTransactionLimits.transactionDate, date)
        )
      )
      .limit(1);

    if (existing) {
      // Check if we need to reset daily
      const lastReset = new Date(existing.lastResetDaily);
      const today = new Date();
      if (today.toDateString() !== lastReset.toDateString()) {
        await db
          .update(unifiedTransactionLimits)
          .set({
            dailyDepositVolume: '0',
            dailyWithdrawalVolume: '0',
            dailyP2pSentVolume: '0',
            dailyTotalVolume: '0',
            lastResetDaily: today,
            updatedAt: today,
          })
          .where(
            and(
              eq(unifiedTransactionLimits.userId, userId),
              eq(unifiedTransactionLimits.transactionDate, date)
            )
          );
        return { ...existing, dailyTotalVolume: '0' };
      }

      // Check if we need to reset monthly
      const lastMonthlyReset = new Date(existing.lastResetMonthly);
      if (today.getMonth() !== lastMonthlyReset.getMonth()) {
        await db
          .update(unifiedTransactionLimits)
          .set({
            monthlyDepositVolume: '0',
            monthlyWithdrawalVolume: '0',
            monthlyP2pSentVolume: '0',
            monthlyTotalVolume: '0',
            lastResetMonthly: today,
            updatedAt: today,
          })
          .where(
            and(
              eq(unifiedTransactionLimits.userId, userId),
              eq(unifiedTransactionLimits.transactionDate, date)
            )
          );
        return { ...existing, monthlyTotalVolume: '0' };
      }

      return existing;
    }

    // Create new tracking record
    const [newTracking] = await db
      .insert(unifiedTransactionLimits)
      .values({
        userId,
        transactionDate: date,
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
    breakdown: {
      deposits: { daily: number; monthly: number };
      withdrawals: { daily: number; monthly: number };
      p2pSent: { daily: number; monthly: number };
    };
  }> {
    const tier = await kycService.getCurrentTier(userId);
    const today = new Date().toISOString().split('T')[0];
    const usage = await this.getOrCreateUnifiedUsage(userId, today);

    const dailyUsed = parseFloat(usage.dailyTotalVolume || '0');
    const monthlyUsed = parseFloat(usage.monthlyTotalVolume || '0');

    return {
      tier: tier.tier,
      dailyUsed,
      monthlyUsed,
      dailyLimit: tier.dailyLimit,
      monthlyLimit: tier.monthlyLimit,
      dailyRemaining: Math.max(0, tier.dailyLimit - dailyUsed),
      monthlyRemaining: Math.max(0, tier.monthlyLimit - monthlyUsed),
      breakdown: {
        deposits: {
          daily: parseFloat(usage.dailyDepositVolume || '0'),
          monthly: parseFloat(usage.monthlyDepositVolume || '0'),
        },
        withdrawals: {
          daily: parseFloat(usage.dailyWithdrawalVolume || '0'),
          monthly: parseFloat(usage.monthlyWithdrawalVolume || '0'),
        },
        p2pSent: {
          daily: parseFloat(usage.dailyP2pSentVolume || '0'),
          monthly: parseFloat(usage.monthlyP2pSentVolume || '0'),
        },
      },
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
