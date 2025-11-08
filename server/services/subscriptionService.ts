
import { db } from '../storage';
import { daos, subscriptions, billingHistory, users, daoMemberships, vaults } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError, ValidationError } from '../middleware/errorHandler';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" })
  : null;

export type PaymentMethod = 'stripe' | 'vault' | 'split_equal' | 'split_custom' | 'split_percentage';

export interface SubscriptionUpgradeRequest {
  daoId: string;
  userId: string;
  plan: 'free' | 'premium';
  paymentMethod: PaymentMethod;
  splitConfig?: {
    type: 'equal' | 'custom' | 'percentage';
    customShares?: { [userId: string]: number };
    percentages?: { [userId: string]: number };
  };
  vaultId?: string;
  stripePaymentMethodId?: string;
}

export interface BillSplitResult {
  memberId: string;
  memberName: string;
  amount: number;
  paid: boolean;
}

export class SubscriptionService {
  
  async upgradeSubscription(request: SubscriptionUpgradeRequest) {
    const logger = Logger.getLogger();
    
    try {
      // Validate DAO exists and user is admin
      const dao = await db.query.daos.findFirst({
        where: eq(daos.id, request.daoId)
      });

      if (!dao) {
        throw new ValidationError('DAO not found');
      }

      const membership = await db.query.daoMemberships.findFirst({
        where: and(
          eq(daoMemberships.daoId, request.daoId),
          eq(daoMemberships.userId, request.userId),
          eq(daoMemberships.status, 'approved')
        )
      });

      if (!membership || !['admin', 'elder'].includes(membership.role || '')) {
        throw new AppError('Only DAO admins can manage subscriptions', 403);
      }

      const pricing = {
        premium: { KES: 1500, USD: 9.99, EUR: 8.99 }
      };

      let billingRecord;
      let splitResults: BillSplitResult[] = [];

      switch (request.paymentMethod) {
        case 'stripe':
          billingRecord = await this.processStripePayment(request, pricing);
          break;
        
        case 'vault':
          billingRecord = await this.processVaultPayment(request, pricing);
          break;
        
        case 'split_equal':
        case 'split_custom':
        case 'split_percentage':
          const result = await this.processSplitPayment(request, pricing);
          billingRecord = result.billingRecord;
          splitResults = result.splitResults;
          break;
        
        default:
          throw new ValidationError('Invalid payment method');
      }

      // Update DAO subscription
      await db.update(daos).set({
        plan: request.plan,
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billingStatus: 'active',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      }).where(eq(daos.id, request.daoId));

      // Create/update subscription record
      await db.insert(subscriptions).values({
        userId: request.userId,
        daoId: request.daoId,
        plan: request.plan,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }).onConflictDoUpdate({
        target: [subscriptions.daoId],
        set: {
          plan: request.plan,
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          updatedAt: new Date()
        }
      });

      logger.info(`Subscription upgraded for DAO ${request.daoId} using ${request.paymentMethod}`);

      return {
        success: true,
        billingRecord,
        splitResults: splitResults.length > 0 ? splitResults : undefined,
        message: 'Subscription upgraded successfully'
      };

    } catch (error: any) {
      logger.error(`Subscription upgrade failed: ${error.message}`, error);
      throw error;
    }
  }

  private async processStripePayment(request: SubscriptionUpgradeRequest, pricing: any) {
    if (!stripe) {
      throw new ValidationError('Stripe not configured');
    }

    const amount = pricing[request.plan as keyof typeof pricing].USD;

    // Create billing record
    const [billingRecord] = await db.insert(billingHistory).values({
      daoId: request.daoId,
      amount: amount.toString(),
      currency: 'USD',
      status: 'completed',
      description: `Stripe payment for ${request.plan} plan`
    }).returning();

    return billingRecord;
  }

  private async processVaultPayment(request: SubscriptionUpgradeRequest, pricing: any) {
    if (!request.vaultId) {
      throw new ValidationError('Vault ID required for vault payment');
    }

    const vault = await db.query.vaults.findFirst({
      where: and(
        eq(vaults.id, request.vaultId),
        eq(vaults.daoId, request.daoId)
      )
    });

    if (!vault) {
      throw new ValidationError('Vault not found or not owned by DAO');
    }

    const amount = pricing[request.plan as keyof typeof pricing].KES;
    const vaultBalance = parseFloat(vault.balance || '0');

    if (vaultBalance < amount) {
      throw new ValidationError(`Insufficient vault balance. Required: ${amount}, Available: ${vaultBalance}`);
    }

    // Deduct from vault
    await db.update(vaults).set({
      balance: (vaultBalance - amount).toString(),
      updatedAt: new Date()
    }).where(eq(vaults.id, request.vaultId));

    const [billingRecord] = await db.insert(billingHistory).values({
      daoId: request.daoId,
      amount: amount.toString(),
      currency: 'KES',
      status: 'completed',
      description: `Vault payment for ${request.plan} plan from ${vault.name}`
    }).returning();

    return billingRecord;
  }

  private async processSplitPayment(request: SubscriptionUpgradeRequest, pricing: any) {
    const amount = pricing[request.plan as keyof typeof pricing].KES;
    
    // Get all active members
    const members = await db.query.daoMemberships.findMany({
      where: and(
        eq(daoMemberships.daoId, request.daoId),
        eq(daoMemberships.status, 'approved')
      )
    });

    const memberCount = members.length;
    const splitResults: BillSplitResult[] = [];

    let memberShares: { [userId: string]: number } = {};

    if (request.paymentMethod === 'split_equal') {
      const perMember = amount / memberCount;
      members.forEach(m => {
        memberShares[m.userId] = perMember;
      });
    } else if (request.paymentMethod === 'split_custom' && request.splitConfig?.customShares) {
      memberShares = request.splitConfig.customShares;
    } else if (request.paymentMethod === 'split_percentage' && request.splitConfig?.percentages) {
      members.forEach(m => {
        const percentage = request.splitConfig!.percentages![m.userId] || 0;
        memberShares[m.userId] = (amount * percentage) / 100;
      });
    }

    for (const member of members) {
      const memberAmount = memberShares[member.userId] || 0;
      const user = await db.query.users.findFirst({
        where: eq(users.id, member.userId)
      });

      splitResults.push({
        memberId: member.userId,
        memberName: user?.username || 'Unknown',
        amount: memberAmount,
        paid: false // In real implementation, track individual payments
      });
    }

    const [billingRecord] = await db.insert(billingHistory).values({
      daoId: request.daoId,
      amount: amount.toString(),
      currency: 'KES',
      status: 'pending',
      description: `Split payment for ${request.plan} plan (${request.paymentMethod})`
    }).returning();

    return { billingRecord, splitResults };
  }

  async getSubscriptionDetails(daoId: string) {
    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId)
    });

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.daoId, daoId)
    });

    const history = await db.query.billingHistory.findMany({
      where: eq(billingHistory.daoId, daoId),
      orderBy: [desc(billingHistory.createdAt)],
      limit: 10
    });

    return {
      currentPlan: dao?.plan || 'free',
      status: dao?.billingStatus || 'active',
      nextBillingDate: dao?.nextBillingDate,
      subscription,
      billingHistory: history
    };
  }

  async cancelSubscription(daoId: string, userId: string) {
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.status, 'approved')
      )
    });

    if (!membership || !['admin', 'elder'].includes(membership.role || '')) {
      throw new AppError('Only DAO admins can cancel subscriptions', 403);
    }

    await db.update(daos).set({
      plan: 'free',
      billingStatus: 'cancelled',
      updatedAt: new Date()
    }).where(eq(daos.id, daoId));

    await db.update(subscriptions).set({
      status: 'cancelled',
      updatedAt: new Date()
    }).where(eq(subscriptions.daoId, daoId));

    return { success: true, message: 'Subscription cancelled' };
  }
}

export const subscriptionService = new SubscriptionService();
