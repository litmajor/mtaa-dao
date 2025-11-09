
import { Router } from 'express';
import { db } from '../storage';
import { lockedSavings, vaults } from '../../shared/schema';
import { desc, eq, and } from 'drizzle-orm';
// Simple logger fallback if '../logger' does not exist
const Logger = {
  getLogger: () => ({
    error: console.error,
    info: console.info,
    warn: console.warn,
    debug: console.debug,
  }),
};

const router = Router();

// GET /api/wallet/savings - Get all savings accounts for user
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const savingsAccounts = await db
      .select()
      .from(lockedSavings)
      .where(eq(lockedSavings.userId, userId))
      .orderBy(desc(lockedSavings.createdAt));

    // Calculate current values and interest
    const enrichedSavings = savingsAccounts.map(saving => {
      const now = new Date();
      const unlocksAt = new Date(saving.unlocksAt);
      const isMatured = now >= unlocksAt;
      const daysRemaining = Math.max(0, Math.ceil((unlocksAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const lockedAt = new Date(saving.lockedAt);
      const daysElapsed = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24));
      const dailyRate = parseFloat(saving.interestRate ?? '0') / 365;
      const earnedInterest = parseFloat(saving.amount) * dailyRate * daysElapsed;
      const currentValue = parseFloat(saving.amount) + earnedInterest;
      return {
        ...saving,
        isMatured,
        daysRemaining,
        earnedInterest: earnedInterest.toFixed(2),
        currentValue: currentValue.toFixed(2)
      };
    });
    res.json({ savings: enrichedSavings });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    Logger.getLogger().error('Failed to fetch savings accounts:', err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/savings - Create new savings account
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { amount, lockPeriodDays } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (!lockPeriodDays || lockPeriodDays < 30) {
      return res.status(400).json({ error: 'Lock period must be at least 30 days' });
    }
    // Calculate interest rate based on lock period
    let interestRate = '0.08';
    if (lockPeriodDays >= 365) interestRate = '0.15';
    else if (lockPeriodDays >= 180) interestRate = '0.12';
    else if (lockPeriodDays >= 90) interestRate = '0.10';
    // Get or create default vault for user
    let vault = await db.query.vaults.findFirst({
      where: and(
        eq(vaults.userId, userId),
        eq(vaults.vaultType, 'savings')
      )
    });
    if (!vault) {
      const [newVault] = await db.insert(vaults).values({
        userId,
        name: 'Savings Vault',
        currency: 'cUSD',
        vaultType: 'savings',
        isActive: true
      }).returning();
      vault = newVault;
    }
    const unlocksAt = new Date();
    unlocksAt.setDate(unlocksAt.getDate() + Number(lockPeriodDays));
    const [lockedSaving] = await db.insert(lockedSavings).values({
      userId,
      vaultId: vault.id,
      amount: amount.toString(),
      currency: 'cUSD',
      lockPeriod: Number(lockPeriodDays),
      interestRate,
      unlocksAt,
      status: 'locked'
    }).returning();
    res.json(lockedSaving);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    Logger.getLogger().error('Failed to create savings account:', err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet/savings/withdraw/:id - Withdraw from savings account
router.post('/withdraw/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const { force } = req.body;
    const saving = await db.query.lockedSavings.findFirst({
      where: and(
        eq(lockedSavings.id, id),
        eq(lockedSavings.userId, userId)
      )
    });
    if (!saving) {
      return res.status(404).json({ error: 'Savings account not found' });
    }
    if (saving.status === 'withdrawn') {
      return res.status(400).json({ error: 'Already withdrawn' });
    }
    const now = new Date();
    const unlocksAt = new Date(saving.unlocksAt);
    const isMatured = now >= unlocksAt;
    let penalty = 0;
    if (force && !isMatured) {
      penalty = parseFloat(saving.amount) * 0.1;
    }
    const lockedAt = new Date(saving.lockedAt);
    const daysElapsed = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRate = parseFloat(saving.interestRate ?? '0') / 365;
    const earnedInterest = parseFloat(saving.amount) * dailyRate * daysElapsed;
    const totalValue = parseFloat(saving.amount) + earnedInterest;
    const finalAmount = totalValue - penalty;
    await db.update(lockedSavings)
      .set({
        status: 'withdrawn',
        penalty: penalty.toString(),
        updatedAt: new Date()
      })
      .where(eq(lockedSavings.id, id));
    res.json({
      success: true,
      finalAmount: finalAmount.toFixed(2),
      earnedInterest: earnedInterest.toFixed(2),
      penalty: penalty.toFixed(2),
      isEarlyWithdrawal: force && !isMatured
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    Logger.getLogger().error('Failed to withdraw savings:', err);
    res.status(500).json({ error: errorMsg });
  }
});

export default router;
