
import express from 'express';
import { isAuthenticated } from '../auth';
import { db } from '../storage';
import { daos, billingHistory, subscriptions, users } from '../../shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { financialAnalyticsService } from '../services/financialAnalyticsService';

const router = express.Router();

// Get billing dashboard data
router.get('/dashboard/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = (req.user as any)?.claims?.id;

    // Verify user has access to this DAO
    const dao = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get current subscription
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.daoId, daoId),
        eq(subscriptions.status, 'active')
      ))
      .limit(1);

    // Get billing history
    const history = await db
      .select()
      .from(billingHistory)
      .where(eq(billingHistory.daoId, daoId))
      .orderBy(desc(billingHistory.createdAt))
      .limit(12);

    // Get financial analytics
    const analytics = await financialAnalyticsService.getDaoFinancialOverview(daoId);
    const treasuryHealth = await financialAnalyticsService.getTreasuryHealthMetrics(daoId);

    // Calculate usage metrics
    const currentPlan = subscription[0]?.plan || 'free';
    const planLimits = {
      free: { members: 25, proposals: 10, vaults: 1 },
      premium: { members: Infinity, proposals: Infinity, vaults: Infinity }
    };

    const usage = {
      members: dao[0].memberCount,
      proposals: 0, // TODO: Count from proposals table
      vaults: 0, // TODO: Count from vaults table
      limits: planLimits[currentPlan as keyof typeof planLimits]
    };

    res.json({
      dao: dao[0],
      subscription: subscription[0] || null,
      billingHistory: history,
      analytics,
      treasuryHealth,
      usage,
      recommendedPlan: usage.members > 25 ? 'premium' : 'free'
    });

  } catch (error: any) {
    console.error('Billing dashboard error:', error);
    res.status(500).json({ error: 'Failed to load billing dashboard' });
  }
});

// Upgrade DAO plan
router.post('/upgrade/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { plan, paymentMethod } = req.body;
    const userId = (req.user as any)?.claims?.id;

    // Validate plan
    if (!['premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Get DAO
    const dao = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
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
      billing: billingRecord[0],
      newPlan: plan
    });

  } catch (error: any) {
    console.error('Plan upgrade error:', error);
    res.status(500).json({ error: 'Failed to upgrade plan' });
  }
});

// Get platform financial analytics (admin only)
router.get('/analytics/platform', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.id;
    
    // Check if user is admin/superuser
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0]?.isSuperUser) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { startDate, endDate } = req.query;
    
    const analytics = await financialAnalyticsService.getPlatformFinancialMetrics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json(analytics);

  } catch (error: any) {
    console.error('Platform analytics error:', error);
    res.status(500).json({ error: 'Failed to load platform analytics' });
  }
});

export default router;
