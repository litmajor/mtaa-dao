
import { Router } from 'express';
import { authenticate } from '../auth';
import { userSubscriptionService, USER_PLANS } from '../services/userSubscriptionService';
import { asyncHandler } from '../middleware/errorHandler';
import { z } from 'zod';

const router = Router();

// GET /api/user-subscription/plans - Get all available plans
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    plans: USER_PLANS
  });
});

// GET /api/user-subscription/current - Get current user subscription
router.get('/current', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const subscription = await userSubscriptionService.getUserSubscription(userId);
  const vaultLimits = await userSubscriptionService.getVaultLimits(userId);

  res.json({
    success: true,
    subscription,
    vaultLimits
  });
}));

// GET /api/user-subscription/vault-limits - Check vault creation limits
router.get('/vault-limits', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const canCreate = await userSubscriptionService.canCreateVault(userId);
  const limits = await userSubscriptionService.getVaultLimits(userId);

  res.json({
    success: true,
    canCreate: canCreate.allowed,
    reason: canCreate.reason,
    limits
  });
}));

// POST /api/user-subscription/upgrade - Upgrade user subscription
router.post('/upgrade', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  
  const schema = z.object({
    plan: z.enum(['premium', 'power']),
    billingCycle: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    paymentMethod: z.string()
  });

  const { plan, billingCycle, paymentMethod } = schema.parse(req.body);

  const result = await userSubscriptionService.upgradeSubscription(
    userId, 
    plan, 
    billingCycle, 
    paymentMethod
  );

  res.json({
    success: true,
    ...result
  });
}));

// POST /api/user-subscription/cancel - Cancel subscription
router.post('/cancel', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { db } = await import('../db');
  const { sql } = await import('drizzle-orm');

  await db.execute(sql`
    UPDATE user_subscriptions 
    SET status = 'cancelled', auto_renew = false, updated_at = NOW()
    WHERE user_id = ${userId} AND status = 'active'
  `);

  res.json({
    success: true,
    message: 'Subscription cancelled successfully'
  });
}));

// GET /api/user-subscription/payment-history - Get payment history
router.get('/payment-history', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const history = await userSubscriptionService.getPaymentHistory(userId);

  res.json({
    success: true,
    history
  });
}));

// POST /api/user-subscription/purchase-vault-slot - Buy additional vault slot with MTAA
router.post('/purchase-vault-slot', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { db } = await import('../db');
  const { users, sql } = await import('../../shared/schema');
  const { eq } = await import('drizzle-orm');

  const VAULT_SLOT_COST = 1000; // MTAA tokens

  // Check user balance (assuming MTAA balance is tracked)
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  // For now, just grant the slot (implement MTAA balance check later)
  await db.execute(sql`
    UPDATE user_vault_limits 
    SET earned_vault_slots = earned_vault_slots + 1, updated_at = NOW()
    WHERE user_id = ${userId}
  `);

  await userSubscriptionService.trackFeatureUsage(userId, 'vault_slot_purchase', VAULT_SLOT_COST);

  res.json({
    success: true,
    message: 'Vault slot purchased successfully',
    cost: VAULT_SLOT_COST
  });
}));

export default router;
