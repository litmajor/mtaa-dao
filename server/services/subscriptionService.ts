
import { db } from '../storage';
import { daos, subscriptions, billingHistory, users, daoMemberships, vaults } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError, ValidationError } from '../middleware/errorHandler';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" })
  : null;

export type PaymentMethod = 'stripe' | 'vault' | 'split_equal' | 'split_custom' | 'split_percentage' | 'onchain';
export type SubscriptionPlan = 'free' | 'pro' | 'collective';

export interface SubscriptionUpgradeRequest {
  daoId: string;
  userId: string;
  plan: SubscriptionPlan | 'premium';
  paymentMethod: PaymentMethod;
  tierId?: number;
  durationMonths?: number;
  transactionHash?: string;
  daoTreasury?: string;
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
  private normalizePlan(plan: string): SubscriptionPlan {
    if (plan === 'premium') return 'pro';
    if (plan === 'pro' || plan === 'collective' || plan === 'free') return plan;
    return 'free';
  }

  private getPricing() {
    return {
      free: { KES: 0, USD: 0, EUR: 0, name: 'Free' },
      pro: { KES: 1500, USD: 12, EUR: 11, name: 'Pro' },
      collective: { KES: 5000, USD: 40, EUR: 37, name: 'Collective' }
    };
  }
  
  async upgradeSubscription(request: SubscriptionUpgradeRequest) {
    const logger = Logger.getLogger();
    
    try {
      if (!request.userId) {
        throw new AppError('User not authenticated', 401);
      }

      const plan = this.normalizePlan(request.plan);
      const pricing = this.getPricing();
      const planPricing = pricing[plan];

      if (!planPricing) {
        throw new ValidationError('Invalid subscription plan');
      }

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

      if (!membership || membership.role !== 'admin') {
        throw new AppError('Only DAO admins can manage subscriptions', 403);
      }

      let billingRecord;
      let splitResults: BillSplitResult[] = [];

      switch (request.paymentMethod) {
        case 'onchain':
          billingRecord = await this.processOnchainPayment(request, plan, planPricing);
          break;

        case 'stripe':
          billingRecord = await this.processStripePayment({ ...request, plan }, pricing);
          break;
        
        case 'vault':
          billingRecord = await this.processVaultPayment({ ...request, plan }, pricing);
          break;
        
        case 'split_equal':
        case 'split_custom':
        case 'split_percentage':
          const result = await this.processSplitPayment({ ...request, plan }, pricing);
          billingRecord = result.billingRecord;
          splitResults = result.splitResults;
          break;
        
        default:
          throw new ValidationError('Invalid payment method');
      }

      const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Update DAO subscription state to match the confirmed subscription period.
      await db.update(daos).set({
        plan,
        subscriptionPlan: plan,
        planExpiresAt: nextBillingDate,
        billingStatus: 'active',
        nextBillingDate,
        updatedAt: new Date()
      }).where(eq(daos.id, request.daoId));

      // Create/update subscription record
      const existingSubscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.daoId, request.daoId)
      });

      if (existingSubscription) {
        await db.update(subscriptions).set({
          plan,
          status: 'active',
          startDate: new Date(),
          endDate: nextBillingDate,
          updatedAt: new Date()
        }).where(eq(subscriptions.id, existingSubscription.id));
      } else {
        await db.insert(subscriptions).values({
          userId: request.userId,
          daoId: request.daoId,
          plan,
          status: 'active',
          startDate: new Date(),
          endDate: nextBillingDate
        });
      }

      logger.info(`Subscription upgraded for DAO ${request.daoId} using ${request.paymentMethod}`);

      return {
        success: true,
        billingRecord,
        splitResults: splitResults.length > 0 ? splitResults : undefined,
        subscription: {
          daoId: request.daoId,
          plan,
          status: 'active',
          nextBillingDate
        },
        message: 'Subscription upgraded successfully'
      };

    } catch (error: any) {
      logger.error(`Subscription upgrade failed: ${error.message}`, error);
      throw error;
    }
  }

  private async processOnchainPayment(
    request: SubscriptionUpgradeRequest,
    plan: SubscriptionPlan,
    pricing: { KES: number; name: string }
  ) {
    if (plan === 'free') {
      throw new ValidationError('Free tier does not require an on-chain subscription transaction');
    }

    if (!request.transactionHash || !/^0x[a-fA-F0-9]{64}$/.test(request.transactionHash)) {
      throw new ValidationError('Valid transaction hash required for on-chain subscription sync');
    }

    const [billingRecord] = await db.insert(billingHistory).values({
      daoId: request.daoId,
      amount: pricing.KES.toString(),
      currency: 'KES',
      status: 'completed',
      description: `On-chain subscription sync for ${pricing.name} plan (${request.transactionHash})`
    }).returning();

    return billingRecord;
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
      if (memberCount === 0) {
        throw new ValidationError('No active members available for split billing');
      }
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

  async getSubscriptionDetails(daoId: string, userId?: string) {
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

    const membership = userId
      ? await db.query.daoMemberships.findFirst({
          where: and(
            eq(daoMemberships.daoId, daoId),
            eq(daoMemberships.userId, userId),
            eq(daoMemberships.status, 'approved')
          )
        })
      : null;

    return {
      currentPlan: this.normalizePlan(((dao?.plan || dao?.subscriptionPlan || 'free') as any)),
      status: dao?.billingStatus || 'active',
      nextBillingDate: dao?.nextBillingDate,
      daoTreasuryAddress: dao?.chamaTreasuryAddress || dao?.vaultAddress || null,
      userRole: membership?.role || null,
      isAdmin: membership?.role === 'admin',
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

    if (!membership || membership.role !== 'admin') {
      throw new AppError('Only DAO admins can cancel subscriptions', 403);
    }

    await db.update(daos).set({
      plan: 'free',
      subscriptionPlan: 'free',
      billingStatus: 'cancelled',
      nextBillingDate: null,
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
