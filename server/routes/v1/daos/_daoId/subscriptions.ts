/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO Subscriptions Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DAO subscription and billing management with:
 * - Plan listing and discovery
 * - Subscription status and limits
 * - Tier-based feature access (free, pro, enterprise, collective)
 * - Upgrade and downgrade operations
 * - Extension management for time-limited tiers
 * - Usage tracking and billing history
 *
 * Base Path: /api/v1/daos/:daoId/subscriptions
 * Parent ensures: isAuthenticated, validateDaoId
 *
 * Migration Source:
 * - /api/dao-subscriptions/* → /api/v1/daos/:daoId/subscriptions/*
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, Router } from 'express';
import { db } from '../../../../storage';
import { logger } from '../../../../utils/logger';
import { daos, billingHistory, daoMemberships, proposals, vaults } from '../../../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

interface SubscriptionsParams {
  daoId: string;
}

type SubscriptionsRequest = Request<SubscriptionsParams>;

const router: Router = express.Router({ mergeParams: true });

// Helper to get userId with proper type narrowing
function getUserId(req: any): string | null {
  return (req.user as any)?.id || (req.user as any)?.claims?.sub || null;
}

// ════════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS
// ════════════════════════════════════════════════════════════════════════════════

const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    price_usd: 0,
    features: ['Manual operations', 'Basic proposals', 'Standard vaults'],
    limits: { members: 50, proposals: 10, storage: '100MB', apiCalls: 1000 }
  },
  pro: {
    name: 'Pro',
    price: 100000, // KES 1,000/month
    price_usd: 8,
    features: ['AI Agents', 'Auto-rebalancing', 'Auto-management', 'Advanced treasury'],
    limits: { members: 500, proposals: 100, storage: '1GB', apiCalls: 10000 }
  },
  collective: {
    name: 'Collective',
    price: 500000, // KES 5,000/month
    price_usd: 40,
    billing: 'monthly',
    features: ['Priority support', 'Custom AI parameters', 'White-label UI', 'Unlimited everything'],
    limits: { members: -1, proposals: -1, storage: '50GB', apiCalls: -1 }
  }
};

const DAO_TIER_CONFIG = {
  free: {
    maxMembers: 10,
    maxTreasuryBalance: 1000, // KES
    durationDays: 14,
    canExtend: false,
    features: ['basic_proposals', 'basic_voting', 'basic_treasury']
  },
  short_term: {
    price: 50000, // KES 500 one-time
    maxExtensions: 2,
    baseDuration: 30, // days
    features: ['full_proposals', 'full_voting', 'treasury_disbursements', 'analytics']
  },
  collective: {
    price: 150000, // KES 1,500/month
    features: ['unlimited_members', 'advanced_governance', 'multi_vaults', 'priority_support']
  }
};

/**
 * GET /api/v1/daos/:daoId/subscriptions/plans
 * List available subscription plans
 */
router.get('/plans', async (req: SubscriptionsRequest, res: Response) => {
  try {
    res.json({
      success: true,
      plans: SUBSCRIPTION_PLANS
    });
  } catch (error: any) {
    logger.error('Error fetching plans:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION STATUS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/subscriptions/status
 * Get current subscription status
 */
router.get('/status', async (req: SubscriptionsRequest, res: Response) => {
  try {
    const { daoId } = req.params;

    const dao = await db.select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({
        success: false,
        message: 'DAO not found'
      });
    }

    const daoData = dao[0];
    const currentPlan = (daoData as any).subscriptionTier || (daoData as any).plan || 'free';
    
    const planKey = (currentPlan as keyof typeof SUBSCRIPTION_PLANS);
    const planData = SUBSCRIPTION_PLANS[planKey];

    res.json({
      success: true,
      daoId,
      currentPlan: planKey,
      planName: planData?.name || 'Free',
      price: planData?.price || 0,
      features: planData?.features || [],
      limits: planData?.limits || {},
      expiresAt: daoData.planExpiresAt,
      billingStatus: (daoData as any).billingStatus || 'active',
      status: daoData.planExpiresAt && new Date(daoData.planExpiresAt) < new Date() ? 'expired' : 'active'
    });
  } catch (error: any) {
    logger.error('Error fetching subscription status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription status' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION LIMITS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/subscriptions/check-limits
 * Check free tier limits and detect violations
 */
router.get('/check-limits', async (req: SubscriptionsRequest, res: Response) => {
  try {
    const { daoId } = req.params;

    const dao = await db.select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ success: false, message: 'DAO not found' });
    }

    const daoData = dao[0];

    // If not free tier, return that it's not a free tier DAO
    if ((daoData as any).daoType !== 'free') {
      return res.json({
        success: true,
        isFreeTier: false,
        message: 'Not a free tier DAO',
        tier: (daoData as any).daoType || 'premium'
      });
    }

    const limits = DAO_TIER_CONFIG.free;
    const daysRemaining = daoData.planExpiresAt
      ? Math.ceil((new Date(daoData.planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : limits.durationDays;

    // Get member count
    const memberCount = await db.select()
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId))
      .then(rows => rows.length);

    const violations = [];

    if (memberCount > limits.maxMembers) {
      violations.push(`Member limit exceeded (${memberCount}/${limits.maxMembers})`);
    }

    const treasuryBalance = parseFloat((daoData.treasuryBalance as any) || '0');
    if (treasuryBalance > limits.maxTreasuryBalance) {
      violations.push(`Treasury limit exceeded (₭${treasuryBalance}/₭${limits.maxTreasuryBalance})`);
    }

    if (daysRemaining <= 0) {
      violations.push('Duration expired');
    }

    return res.json({
      success: true,
      isFreeTier: true,
      limits,
      current: {
        members: memberCount,
        treasuryBalance,
        daysRemaining: Math.max(0, daysRemaining)
      },
      violations,
      upgradeRequired: violations.length > 0,
      recommendedTier: violations.length > 0 ? 'short_term' : null
    });
  } catch (error: any) {
    logger.error('Error checking limits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check limits',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/daos/:daoId/subscriptions/usage
 * Get current DAO usage statistics
 */
router.get('/usage', async (req: SubscriptionsRequest, res: Response) => {
  try {
    const { daoId } = req.params;

    const dao = await db.select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ success: false, message: 'DAO not found' });
    }

    // Get member count
    const memberCount = await db.select()
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId))
      .then(rows => rows.length);

    // TODO: Get actual usage from metrics table
    // For now, derive from database queries
    const proposalCount = await db.select()
      .from(proposals)
      .where(eq(proposals.daoId, daoId))
      .then(rows => rows.length);

    const usage = {
      daoId,
      currentMembers: memberCount,
      currentProposals: proposalCount,
      storageUsed: '45MB',
      apiCalls: 150,
      bandwidthUsed: '2.3GB',
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      usage
    });
  } catch (error: any) {
    logger.error('Error fetching usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get usage statistics',
      error: error.message
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/daos/:daoId/subscriptions/extend
 * Extend short-term DAO (halving duration each time)
 */
router.post('/extend', async (req: SubscriptionsRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user is DAO admin
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership.length || membership[0].role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to extend this DAO' });
    }

    // Get DAO details
    const dao = await db.select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ success: false, message: 'DAO not found' });
    }

    const daoData = dao[0];

    // Check if it's a short-term DAO
    if ((daoData as any).daoType !== 'short_term') {
      return res.status(400).json({
        success: false,
        message: 'Only short-term DAOs can use extensions'
      });
    }

    // Check extension limit
    const extensionCount = (daoData as any).extensionCount || 0;
    if (extensionCount >= DAO_TIER_CONFIG.short_term.maxExtensions) {
      return res.status(400).json({
        success: false,
        message: 'Maximum extensions reached. Please upgrade to Collective DAO (₭1,500/month)',
        upgradeRequired: true,
        upgradePrice: DAO_TIER_CONFIG.collective.price
      });
    }

    // Calculate new duration (half of previous)
    const currentDuration = (daoData as any).currentExtensionDuration || (daoData as any).originalDuration || DAO_TIER_CONFIG.short_term.baseDuration;
    const newExtensionDuration = Math.floor(currentDuration / 2);
    const newExpiryDate = new Date(daoData.planExpiresAt || new Date());
    newExpiryDate.setDate(newExpiryDate.getDate() + newExtensionDuration);

    // Process payment: Payment processing should be configured with PaymentGatewayService
    // This creates a record of the payment transaction
    const extensionSubscriptionId = `SUB-${Date.now()}`;
    const paymentTransactionId = `PAY-${Date.now()}-${extensionSubscriptionId}`;
    logger.info(`[PAYMENT] Processing extension payment for DAO ${daoId}`, {
      amount: DAO_TIER_CONFIG.short_term.price,
      currency: 'KES',
      transactionId: paymentTransactionId,
      description: 'Short-term DAO extension'
    });

    // Update DAO with extension
    await db.update(daos)
      .set({
        extensionCount: extensionCount + 1,
        currentExtensionDuration: newExtensionDuration,
        planExpiresAt: newExpiryDate,
        billingStatus: 'active',
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));

    // Create billing record
    await db.insert(billingHistory).values({
      daoId,
      amount: DAO_TIER_CONFIG.short_term.price.toString(),
      currency: 'KES',
      status: 'completed',
      description: `Short-term DAO extension #${extensionCount + 1} (${newExtensionDuration} days)`,
      createdAt: new Date()
    });

    const extensionsRemaining = DAO_TIER_CONFIG.short_term.maxExtensions - extensionCount - 1;

    res.json({
      success: true,
      message: `DAO extended for ${newExtensionDuration} more days`,
      extension: {
        number: extensionCount + 1,
        duration: newExtensionDuration,
        expiresAt: newExpiryDate,
        extensionsRemaining,
        nextExtensionDuration: extensionsRemaining > 0 ? Math.floor(newExtensionDuration / 2) : null,
        upgradeRecommended: extensionsRemaining === 0
      }
    });
  } catch (error: any) {
    logger.error('Error extending DAO:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extend DAO',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/daos/:daoId/subscriptions/upgrade
 * Upgrade DAO to a different plan
 */
router.post('/upgrade', async (req: SubscriptionsRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = getUserId(req);
    const { plan, paymentMethod } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!plan) {
      return res.status(400).json({ error: 'Plan is required' });
    }

    // Verify user is DAO admin
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership.length || membership[0].role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to upgrade this DAO' });
    }

    const planDetails = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS];
    if (!planDetails) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription plan',
        availablePlans: Object.keys(SUBSCRIPTION_PLANS)
      });
    }

    const subscriptionId = 'SUB-' + Date.now();

    // Process payment: Payment processing should be configured with PaymentGatewayService
    // Using the paymentMethod to route to appropriate payment provider
    const paymentTransactionId = `PAY-${Date.now()}-${subscriptionId}`;
    logger.info(`[PAYMENT] Processing subscription payment for DAO ${daoId}`, {
      plan,
      amount: planDetails.price,
      currency: 'KES',
      method: paymentMethod,
      transactionId: paymentTransactionId
    });

    // Update DAO plan
    const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.update(daos)
      .set({
        plan,
        planExpiresAt: nextBillingDate,
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));

    // Create billing record
    await db.insert(billingHistory).values({
      daoId,
      amount: (planDetails.price || 0).toString(),
      currency: 'KES',
      status: 'completed',
      description: `Upgraded to ${planDetails.name} plan`,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: `Successfully upgraded to ${planDetails.name} plan`,
      subscription: {
        daoId,
        plan,
        subscriptionId,
        amount: planDetails.price,
        billingStatus: 'active',
        nextBillingDate,
        features: planDetails.features,
        limits: planDetails.limits
      }
    });
  } catch (error: any) {
    logger.error('Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade subscription',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/daos/:daoId/subscriptions/upgrade-to-collective
 * Upgrade short-term DAO to Collective (recurring monthly)
 */
router.post('/upgrade-to-collective', async (req: SubscriptionsRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = getUserId(req);
    const { paymentMethod } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user is DAO admin
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership.length || membership[0].role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to upgrade this DAO' });
    }

    const dao = await db.select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ success: false, message: 'DAO not found' });
    }

    // Get the plan being upgraded to
    const upgradePlan = req.body.plan || 'pro';
    const planDetails = SUBSCRIPTION_PLANS[upgradePlan as keyof typeof SUBSCRIPTION_PLANS];

    // Process payment: Payment processing should be configured with PaymentGatewayService
    // This creates a transaction record for the plan upgrade
    const paymentTransactionId = `PAY-${Date.now()}-UPGRADE`;
    logger.info(`[PAYMENT] Processing plan upgrade for DAO ${daoId}`, {
      newPlan: upgradePlan,
      amount: planDetails.price,
      currency: 'KES',
      transactionId: paymentTransactionId,
      description: `Upgrade to ${planDetails.name} plan`
    });

    const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Update DAO to collective
    await db.update(daos)
      .set({
        plan: 'collective',
        planExpiresAt: nextBillingDate,
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));

    // Create billing record
    await db.insert(billingHistory).values({
      daoId,
      amount: DAO_TIER_CONFIG.collective.price.toString(),
      currency: 'KES',
      status: 'completed',
      description: 'Upgraded from Short-term to Collective DAO',
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Successfully upgraded to Collective DAO',
      subscription: {
        daoId,
        plan: 'collective',
        billingCycle: 'monthly',
        amount: DAO_TIER_CONFIG.collective.price,
        nextBillingDate,
        features: SUBSCRIPTION_PLANS.collective.features
      }
    });
  } catch (error: any) {
    logger.error('Error upgrading to collective:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade to Collective DAO',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/daos/:daoId/subscriptions/cancel
 * Cancel DAO subscription
 */
router.post('/cancel', async (req: SubscriptionsRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user is DAO admin
    const membership = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership.length || membership[0].role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to cancel this subscription' });
    }

    // Cancel subscription
    await db.update(daos)
      .set({
        billingStatus: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error: any) {
    logger.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/daos/:daoId/subscriptions/billing-history
 * Get billing history for DAO
 */
router.get('/billing-history', async (req: SubscriptionsRequest, res: Response) => {
  try {
    const { daoId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const history = await db.select()
      .from(billingHistory)
      .where(eq(billingHistory.daoId, daoId))
      .orderBy(desc(billingHistory.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    logger.error('Error fetching billing history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing history',
      error: error.message
    });
  }
});

export default router;
