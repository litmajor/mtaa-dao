/**
 * DAO Billing - Subscription and Billing Management
 * 
 * DAO-facing endpoints for subscription management, billing dashboard, and plan upgrades
 * 
 * Endpoints:
 * GET    /api/v1/daos/:daoId/billing/dashboard    Get billing dashboard
 * POST   /api/v1/daos/:daoId/billing/upgrade      Upgrade DAO plan
 */

import express, { Request, Response } from 'express';
import { isAuthenticated } from '../../../../auth';
import { rateLimiter } from '../../../../middleware/rateLimiter';
import { db } from '../../../../storage';
import { daos, billingHistory, subscriptions, proposals, vaults } from '@shared/schema';
import { sql, eq, desc, and } from 'drizzle-orm';
import { financialAnalyticsService } from '../../../../services/financialAnalyticsService';

const router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 CRITICAL: Rate limiter for plan changes (prevents upgrade spam/DoS)
 */
const billingUpgradeLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 plan changes per hour (prevent upgrade spam)
  keyGenerator: (req: any) => `billing:upgrade:${req.user?.id || req.ip}`,
});

// ════════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════════

router.use(isAuthenticated);

// ════════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/billing/dashboard
 * Get billing dashboard data with enhanced analytics
 * 
 * Returns:
 * - Current subscription plan
 * - Billing history (last 12 months)
 * - Usage metrics against plan limits
 * - Upgrade recommendations
 * - Treasury health metrics
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = (req.user as any)?.claims?.id;

    // Verify DAO exists
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      return res.status(404).json({ 
        success: false,
        error: 'DAO not found' 
      });
    }

    // Get current subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.daoId, daoId),
        eq(subscriptions.status, 'active')
      ))
      .limit(1);

    // Get billing history with payment method breakdown
    const history = await db
      .select()
      .from(billingHistory)
      .where(eq(billingHistory.daoId, daoId))
      .orderBy(desc(billingHistory.createdAt))
      .limit(12);

    // Calculate billing analytics
    const totalSpent = history.reduce((sum: number, h: any) => sum + parseFloat(h.amount || '0'), 0);
    const avgMonthlySpend = history.length > 0 ? totalSpent / Math.min(history.length, 12) : 0;
    
    // Get financial analytics
    const analytics = await financialAnalyticsService.getDaoFinancialOverview(daoId);
    const treasuryHealth = await financialAnalyticsService.getTreasuryHealthMetrics(daoId);

    // Get actual counts for proposals and vaults
    const proposalCount = await db
      .select({ count: sql`count(*)` })
      .from(proposals)
      .where(eq(proposals.daoId, daoId));
    
    const vaultCount = await db
      .select({ count: sql`count(*)` })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    // Calculate usage metrics
    const currentPlan = subscription?.plan || 'free';
    const planLimits = {
      free: { members: 25, proposals: 10, vaults: 1 },
      premium: { members: Infinity, proposals: Infinity, vaults: Infinity }
    };

    const usage = {
      members: dao.memberCount ?? 0,
      proposals: proposalCount[0]?.count || 0,
      vaults: vaultCount[0]?.count || 0,
      limits: planLimits[currentPlan as keyof typeof planLimits]
    };

    // Calculate upgrade ROI
    const memberOverage = Math.max(0, (usage.members ?? 0) - 25);
    const proposalOverage = Math.max(0, Number(usage.proposals ?? 0) - 10);
    const vaultOverage = Math.max(0, Number(usage.vaults ?? 0) - 1);
    const upgradeRecommended = memberOverage > 0 || proposalOverage > 0 || vaultOverage > 0;

    res.json({
      success: true,
      data: {
        dao,
        subscription: subscription || null,
        billingHistory: history,
        billingAnalytics: {
          totalSpent,
          avgMonthlySpend,
          currency: history[0]?.currency || 'KES',
          nextBillingDate: subscription?.endDate,
          paymentMethodsUsed: [...new Set(history.map((h: any) => h.currency))]
        },
        analytics,
        treasuryHealth,
        usage,
        upgradeAnalysis: {
          recommended: upgradeRecommended,
          reason: upgradeRecommended 
            ? `You're exceeding limits: ${memberOverage > 0 ? `${memberOverage} extra members` : ''} ${proposalOverage > 0 ? `${proposalOverage} extra proposals` : ''}`
            : 'Current plan meets your needs',
          estimatedMonthlyCost: upgradeRecommended ? 1500 : 0
        }
      }
    });

  } catch (error: any) {
    console.error('Billing dashboard error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load billing dashboard',
      message: error.message 
    });
  }
});

/**
 * POST /api/v1/daos/:daoId/billing/upgrade
 * Upgrade DAO plan
 * 
 * Body:
 * - plan: string (e.g., 'premium')
 * - paymentMethod: { currency: string }
 * 
 * Returns:
 * - Updated billing record
 * - New plan details
 */
router.post('/upgrade', billingUpgradeLimiter, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { plan, paymentMethod } = req.body;
    const userId = (req.user as any)?.claims?.id;

    // Validate plan
    if (!['premium'].includes(plan)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid plan selected' 
      });
    }

    // Get DAO
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      return res.status(404).json({ 
        success: false,
        error: 'DAO not found' 
      });
    }

    // Calculate pricing based on region/currency
    const pricing = {
      premium: {
        KES: 1500,
        USD: 9.99,
        EUR: 8.99
      }
    };

    const currency = paymentMethod?.currency || 'KES';
    const amount = pricing[plan as keyof typeof pricing][currency as keyof typeof pricing.premium];

    // Create billing record
    const billingRecord = await db
      .insert(billingHistory)
      .values({
        daoId,
        amount: amount.toString(),
        currency,
        status: 'pending',
        description: `Upgrade to ${plan} plan`
      })
      .returning();

    // Update DAO plan
    await db
      .update(daos)
      .set({
        plan,
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        billingStatus: 'active',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      })
      .where(eq(daos.id, daoId));

    // Create or update subscription
    await db
      .insert(subscriptions)
      .values({
        userId,
        daoId,
        plan,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      })
      .onConflictDoUpdate({
        target: [subscriptions.daoId],
        set: {
          plan,
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

    res.json({
      success: true,
      message: 'Plan upgraded successfully',
      data: {
        billing: billingRecord[0],
        newPlan: plan
      }
    });

  } catch (error: any) {
    console.error('Plan upgrade error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upgrade plan',
      message: error.message 
    });
  }
});

export default router;
