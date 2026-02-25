
import express from 'express';
import { db } from '../storage';
import { daos } from '../../shared/schema';
// Ensure billingStatus and nextBillingDate are present in the DAO schema
// If not, add them to the schema definition in shared/schema.ts
import { eq } from 'drizzle-orm';

const router = express.Router();

// DAO Subscription Plans
const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: ['Basic proposals', 'Up to 50 members', 'Community support'],
    limits: { members: 50, proposals: 10, storage: '100MB' }
  },
  pro: {
    name: 'Pro',
    price: 29.99,
    features: ['Advanced proposals', 'Up to 500 members', 'Priority support', 'Custom branding'],
    limits: { members: 500, proposals: 100, storage: '1GB' }
  },
  enterprise: {
    name: 'Enterprise',
    price: 99.99,
    features: ['Unlimited proposals', 'Unlimited members', '24/7 support', 'White-label solution'],
    limits: { members: -1, proposals: -1, storage: '10GB' }
  }
};

// GET /api/dao-subscriptions/plans
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    plans: SUBSCRIPTION_PLANS
  });
});

// GET /api/dao-subscriptions/:daoId/status
router.get('/:daoId/status', async (req, res) => {
  try {
    const { daoId } = req.params;
    
    const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    
    if (dao.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'DAO not found'
      });
    }
    
    const daoData = dao[0];
    const currentPlan = daoData.plan || 'free';
    const planDetails = SUBSCRIPTION_PLANS[currentPlan as keyof typeof SUBSCRIPTION_PLANS];
    
    res.json({
      success: true,
      subscription: {
        daoId,
        currentPlan,
        planDetails,
        billingStatus: daoData.billingStatus || 'active',
        nextBillingDate: daoData.nextBillingDate,
        createdAt: daoData.createdAt,
        updatedAt: daoData.updatedAt
      }
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription status',
      error: error.message
    });
  }
});

// POST /api/dao-subscriptions/:daoId/upgrade
router.post('/:daoId/upgrade', async (req, res) => {
  try {
    const { daoId } = req.params;
    const { plan, paymentMethod } = req.body;
    
    if (!SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription plan'
      });
    }
    
    const planDetails = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS];
    const subscriptionId = 'SUB-' + Date.now();
    
    // TODO: Process payment based on paymentMethod
    // TODO: Update DAO plan in database
    
    await db.update(daos)
      .set({
        plan,
        billingStatus: 'active',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));
    
    res.json({
      success: true,
      message: `Successfully upgraded to ${plan} plan`,
      subscription: {
        daoId,
        plan,
        subscriptionId,
        amount: planDetails.price,
        billingStatus: 'active',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade subscription',
      error: error.message
    });
  }
});

// POST /api/dao-subscriptions/:daoId/cancel
router.post('/:daoId/cancel', async (req, res) => {
  try {
    const { daoId } = req.params;
    
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
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
});

// GET /api/dao-subscriptions/:daoId/usage
router.get('/:daoId/usage', async (req, res) => {
  try {
    const { daoId } = req.params;
    
    // TODO: Get actual usage statistics from database
    const mockUsage = {
      daoId,
      currentMembers: 25,
      currentProposals: 5,
      storageUsed: '45MB',
      apiCalls: 150,
      bandwidthUsed: '2.3GB'
    };
    
    res.json({
      success: true,
      usage: mockUsage
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get usage statistics',
      error: error.message
    });
  }
});

export default router;
