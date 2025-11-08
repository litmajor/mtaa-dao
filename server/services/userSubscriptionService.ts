
import { db } from '../storage';
import { users, vaults } from '../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError, ValidationError } from '../middleware/errorHandler';

export interface UserSubscriptionPlan {
  name: 'free' | 'premium' | 'power';
  price: { daily?: number; weekly?: number; monthly: number; yearly: number };
  currency: string;
  vaultLimit: number;
  features: string[];
}

export const USER_PLANS: Record<string, UserSubscriptionPlan> = {
  free: {
    name: 'free',
    price: { monthly: 0, yearly: 0 },
    currency: 'KES',
    vaultLimit: 1,
    features: [
      'Basic wallet features',
      '1 personal vault',
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
    vaultLimit: 5,
    features: [
      'Everything in Free',
      'Up to 5 personal vaults',
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
    vaultLimit: 20,
    features: [
      'Everything in Premium',
      'Up to 20 personal vaults',
      'AI-powered analytics',
      'Auto-rebalancing',
      'API access',
      'White-label options',
      'Dedicated account manager',
      'Custom integrations',
    ]
  }
};

export class UserSubscriptionService {
  
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

  async getVaultLimits(userId: string) {
    try {
      let limits = await db.execute(sql`
        SELECT * FROM user_vault_limits WHERE user_id = ${userId}
      `);

      if (limits.rows.length === 0) {
        // Initialize limits
        await db.execute(sql`
          INSERT INTO user_vault_limits (user_id, total_vaults_allowed)
          VALUES (${userId}, 1)
        `);
        limits = await db.execute(sql`
          SELECT * FROM user_vault_limits WHERE user_id = ${userId}
        `);
      }

      const userVaults = await db.execute(sql`
        SELECT COUNT(*) as count FROM vaults WHERE user_id = ${userId}
      `);

      return {
        ...limits.rows[0],
        current_vault_count: parseInt(userVaults.rows[0].count as string)
      };
    } catch (error) {
      Logger.getLogger().error('Failed to get vault limits:', error);
      throw new AppError('Failed to fetch vault limits', 500);
    }
  }

  async canCreateVault(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const limits = await this.getVaultLimits(userId);
      const subscription = await this.getUserSubscription(userId);

      const totalAllowed = limits.total_vaults_allowed + limits.earned_vault_slots;

      if (limits.current_vault_count >= totalAllowed) {
        return {
          allowed: false,
          reason: `You've reached your vault limit (${totalAllowed}). Upgrade to ${subscription.plan === 'free' ? 'Premium' : 'Power'} or earn slots through activity.`
        };
      }

      return { allowed: true };
    } catch (error) {
      Logger.getLogger().error('Failed to check vault creation:', error);
      return { allowed: false, reason: 'Failed to verify limits' };
    }
  }

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

      // Update vault limits
      await db.execute(sql`
        UPDATE user_vault_limits 
        SET total_vaults_allowed = ${planDetails.vaultLimit}, updated_at = NOW()
        WHERE user_id = ${userId}
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

  async earnVaultSlot(userId: string, reason: string) {
    try {
      await db.execute(sql`
        UPDATE user_vault_limits 
        SET earned_vault_slots = earned_vault_slots + 1, updated_at = NOW()
        WHERE user_id = ${userId}
      `);

      Logger.getLogger().info(`User ${userId} earned vault slot: ${reason}`);
    } catch (error) {
      Logger.getLogger().error('Failed to award vault slot:', error);
    }
  }

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
