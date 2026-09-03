
import { db } from '../storage';
import { users, vaults } from '../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError, ValidationError } from '../middleware/errorHandler';

/**
 * DEPRECATED: Subscription-tier-based vault limits (see pricing.md § 7).
 * Replaced by age-based + KYC-based soft caps in getMaxVaultsForUser().
 * Kept for backward compatibility with existing subscription/payment flows.
 * Will be removed once all subscription upsell logic is migrated.
 */
export interface UserSubscriptionPlan {
  name: 'free' | 'premium' | 'power';
  price: { daily?: number; weekly?: number; monthly: number; yearly: number };
  currency: string;
  features: string[];
  // DEPRECATED: vaultLimit removed — no longer gates vault creation
}

export const USER_PLANS: Record<string, Omit<UserSubscriptionPlan, 'vaultLimit'>> = {
  free: {
    name: 'free',
    price: { monthly: 0, yearly: 0 },
    currency: 'KES',
    features: [
      'Basic wallet features',
      'Standard analytics (weekly)',
      'Community support',
      'Transaction history',
    ]
  },
  premium: {
    name: 'premium',
    price: { 
      daily: 20, 
      weekly: 100, 
      monthly: 500, 
      yearly: 5000 
    },
    currency: 'KES',
    features: [
      'Everything in Free',
      'Advanced analytics (daily)',
      'Instant withdrawals',
      'Priority support',
      'Custom vault strategies',
      'Ad-free experience',
      'Export reports',
    ]
  },
  power: {
    name: 'power',
    price: { 
      daily: 50, 
      weekly: 250, 
      monthly: 1500, 
      yearly: 15000 
    },
    currency: 'KES',
    features: [
      'Everything in Premium',
      'AI-powered analytics',
      'Auto-rebalancing',
      'API access',
      'White-label options',
      'Dedicated account manager',
      'Custom integrations',
    ]
  }
};

/**
 * Vault cap: TEMPORARY PLACEHOLDER.
 * 
 * Design is TBD per pricing.md § 2 & § 6:
 * - Candidates: KYC-tier-linked limit + inactivity-based reclamation
 * - Age-based gating was considered but flagged as weak on its own
 * - Numeric limits per vault type: not yet decided
 * 
 * This flat cap (10 vaults) is conservative emergency ceiling only.
 * Replace once vault-cap mechanism is finalized with real usage data.
 * 
 * See pricing.md § 2 for design rationale & open items.
 */
export const VAULT_CAP_CONFIG = {
  // Temporary flat ceiling: revisit with data before finalizing
  flatCapPerUser: 10,
  // TODO: Replace with decision from pricing.md § 6 (KYC + inactivity mechanism)
  // This placeholder prevents unlimited vault creation abuse while TBD mechanism is under design
};

/**
 * KYC tier type (matches kycService.KYCTier.tier).
 */
type KYCTier = 'none' | 'basic' | 'intermediate' | 'advanced';

export class UserSubscriptionService {
  
  /**
   * Get active subscription for user (payment/feature tier).
   * NOTE: No longer controls vault creation — see canCreateVault().
   */
  async getUserSubscription(userId: string) {
    try {
      const subscription = await db.execute(sql`
        SELECT * FROM user_subscriptions 
        WHERE user_id = ${userId} 
        AND status = 'active'
        ORDER BY created_at DESC 
        LIMIT 1
      `);

      if (subscription.rows.length === 0) {
        return { plan: 'free', status: 'active', features: USER_PLANS.free.features };
      }

      const sub = subscription.rows[0];
      return {
        ...sub,
        features: USER_PLANS[sub.plan as keyof typeof USER_PLANS]?.features || []
      };
    } catch (error) {
      Logger.getLogger().error('Failed to get user subscription:', error);
      throw new AppError('Failed to fetch subscription', 500);
    }
  }

  /**
   * DEPRECATED: Age/KYC vault gating logic removed pending spec finalization.
   * 
   * Previous implementation:
   * - Age gates: day 0→1, day 7→3, day 30→5, day 90→10 vaults
   * - KYC multipliers: none 1.0x, basic 1.5x, intermediate 2.0x, advanced 3.0x
   * 
   * Candidate mechanism per pricing.md § 2 (open):
   * - KYC-tier-linked limit (prevents on-chain creation spam without blocking non-custodial design)
   * - Inactivity-based reclamation (hibernate vaults untouched 90+ days)
   * 
   * Awaiting: real transaction/vault-creation data before committing numeric thresholds
   * See pricing.md § 6, §8 — "instrument before tuning"
   */

  /**
   * Get vault limit info for user.
   * 
   * TEMPORARY: Using flat cap (VAULT_CAP_CONFIG.flatCapPerUser) until
   * vault-cap mechanism is finalized per pricing.md § 2 & § 6.
   * 
   * This is conservative emergency ceiling — allows testing without unlimited abuse,
   * but does not implement the intended KYC + inactivity design yet.
   */
  async getVaultLimits(userId: string) {
    try {
      const userVaults = await db.execute(sql`
        SELECT COUNT(*) as count FROM vaults WHERE user_id = ${userId}
      `);

      const currentCount = parseInt(userVaults.rows[0]?.count as string) || 0;
      const maxAllowed = VAULT_CAP_CONFIG.flatCapPerUser;

      return {
        userId,
        currentVaultCount: currentCount,
        maxVaultsAllowed: maxAllowed,
        availableSlots: Math.max(0, maxAllowed - currentCount),
      };
    } catch (error) {
      Logger.getLogger().error('Failed to get vault limits:', error);
      throw new AppError('Failed to fetch vault limits', 500);
    }
  }

  /**
   * Check if user can create a vault.
   * 
   * TEMPORARY: Uses flat cap only. Once vault-cap mechanism is finalized
   * (pricing.md § 2 & § 6), replace with KYC + inactivity logic.
   */
  async canCreateVault(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const limits = await this.getVaultLimits(userId);
      const currentCount = limits.currentVaultCount;
      const maxAllowed = limits.maxVaultsAllowed;

      if (currentCount >= maxAllowed) {
        return {
          allowed: false,
          reason: `Vault limit reached (${currentCount}/${maxAllowed}). Contact support or check pricing.md for planned cap mechanism.`,
        };
      }

      return { allowed: true };
    } catch (error) {
      Logger.getLogger().error('Failed to check vault creation:', error);
      return { allowed: false, reason: 'Failed to verify limits' };
    }
  }

  /**
   * Check for inactive vaults (placeholder).
   * 
   * Inactivity-based reclamation is part of the TBD vault-cap mechanism (pricing.md § 2).
   * Currently returns empty list. Implement once cap mechanism is finalized.
   */
  async checkInactiveVaults(userId: string): Promise<{
    inactive: Array<{ vaultId: string; lastActivityDays: number }>;
    hibernatedCount: number;
  }> {
    // TODO: Implement once vault-cap mechanism is finalized (pricing.md § 2, § 6)
    // Part of the inactivity-based reclamation design (candidate cap mechanism).
    // Currently returns empty, no hibernation yet.
    return { inactive: [], hibernatedCount: 0 };
  }

  /**
   * Upgrade to a paid subscription (for advanced features, not vault limits).
   * See pricing.md § 4 — subscription is fully decoupled from vault creation.
   */
  async upgradeSubscription(userId: string, plan: 'premium' | 'power', billingCycle: 'daily' | 'weekly' | 'monthly' | 'yearly', paymentMethod: string) {
    try {
      const planDetails = USER_PLANS[plan];
      const amount = billingCycle === 'yearly' ? planDetails.price.yearly :
                     billingCycle === 'monthly' ? planDetails.price.monthly :
                     billingCycle === 'weekly' ? planDetails.price.weekly! :
                     planDetails.price.daily!;

      const endDate = new Date();
      if (billingCycle === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
      else if (billingCycle === 'monthly') endDate.setMonth(endDate.getMonth() + 1);
      else if (billingCycle === 'weekly') endDate.setDate(endDate.getDate() + 7);
      else endDate.setDate(endDate.getDate() + 1);

      // Cancel existing subscription
      await db.execute(sql`
        UPDATE user_subscriptions 
        SET status = 'cancelled', updated_at = NOW()
        WHERE user_id = ${userId} AND status = 'active'
      `);

      // Create new subscription
      await db.execute(sql`
        INSERT INTO user_subscriptions (
          user_id, plan, status, payment_method, billing_cycle, 
          amount, currency, start_date, end_date
        ) VALUES (
          ${userId}, ${plan}, 'active', ${paymentMethod}, ${billingCycle},
          ${amount}, ${planDetails.currency}, NOW(), ${endDate}
        )
      `);

      // Record payment
      await db.execute(sql`
        INSERT INTO user_payment_history (
          user_id, amount, currency, payment_method, payment_type, status
        ) VALUES (
          ${userId}, ${amount}, ${planDetails.currency}, ${paymentMethod}, 'subscription', 'completed'
        )
      `);

      Logger.getLogger().info(`User ${userId} upgraded to ${plan} (${billingCycle})`);

      return {
        success: true,
        plan,
        billingCycle,
        amount,
        endDate
      };
    } catch (error) {
      Logger.getLogger().error('Failed to upgrade subscription:', error);
      throw new AppError('Failed to upgrade subscription', 500);
    }
  }

  /**
   * Award earned vault slot (from achievements, referrals, transactions, etc.).
   * Separate from age/KYC limit; cumulative.
   */
  async earnVaultSlot(userId: string, reason: string) {
    try {
      // Upsert into user_vault_limits
      await db.execute(sql`
        INSERT INTO user_vault_limits (user_id, earned_vault_slots)
        VALUES (${userId}, 1)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          earned_vault_slots = user_vault_limits.earned_vault_slots + 1,
          updated_at = NOW()
      `);

      Logger.getLogger().info(`User ${userId} earned vault slot: ${reason}`);
    } catch (error) {
      Logger.getLogger().error('Failed to award vault slot:', error);
    }
  }

  /**
   * Track feature usage for analytics and earning mechanics.
   */
  async trackFeatureUsage(userId: string, featureType: string, mtaaSpent: number = 0) {
    try {
      await db.execute(sql`
        INSERT INTO user_feature_usage (user_id, feature_type, usage_count, mtaa_spent, last_used_at)
        VALUES (${userId}, ${featureType}, 1, ${mtaaSpent}, NOW())
        ON CONFLICT (user_id, feature_type) 
        DO UPDATE SET 
          usage_count = user_feature_usage.usage_count + 1,
          mtaa_spent = user_feature_usage.mtaa_spent + ${mtaaSpent},
          last_used_at = NOW()
      `);
    } catch (error) {
      Logger.getLogger().error('Failed to track feature usage:', error);
    }
  }

  /**
   * Get payment history for user (subscriptions, transactions, etc.).
   */
  async getPaymentHistory(userId: string, limit: number = 50) {
    try {
      const history = await db.execute(sql`
        SELECT * FROM user_payment_history 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

      return history.rows;
    } catch (error) {
      Logger.getLogger().error('Failed to get payment history:', error);
      return [];
    }
  }
}

export const userSubscriptionService = new UserSubscriptionService();
