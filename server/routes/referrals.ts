
import express, { Request, Response } from 'express';
import { db } from '../db';
import { users, walletTransactions } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const router = express.Router();

// Generate unique referral code
function generateReferralCode(userId: string): string {
  return `MTAA-${userId.substring(0, 6).toUpperCase()}`;
}

// GET /api/referrals/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get referral statistics
    const referredUsers = await db.query.users.findMany({
      where: eq(users.referredBy, userId)
    });

    const activeReferrals = referredUsers.filter(u => u.isActive).length;
    
    // Calculate total earnings from referrals
    const earnings = await db.select({
      total: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)`
    })
    .from(walletTransactions)
    .where(and(
      eq(walletTransactions.userId, userId),
      eq(walletTransactions.type, 'referral_reward')
    ));

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisMonthReferrals = referredUsers.filter(
      u => new Date(u.createdAt) >= thisMonth
    ).length;

    res.json({
      referralCode: user.referralCode || generateReferralCode(userId),
      totalReferrals: referredUsers.length,
      activeReferrals,
      totalEarned: Number(earnings[0]?.total || 0),
      pendingRewards: 0, // TODO: Calculate from pending transactions
      thisMonthReferrals
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/referrals/leaderboard
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const leaderboard = await db.select({
      userId: users.id,
      name: users.name,
      referralCount: sql<number>`COUNT(referred.id)`,
      earnings: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)`
    })
    .from(users)
    .leftJoin(sql`users AS referred`, sql`referred.referred_by = ${users.id}`)
    .leftJoin(walletTransactions, and(
      eq(walletTransactions.userId, users.id),
      eq(walletTransactions.type, 'referral_reward')
    ))
    .groupBy(users.id, users.name)
    .orderBy(sql`COUNT(referred.id) DESC`)
    .limit(50);

    const formattedLeaderboard = leaderboard.map((item, index) => ({
      id: item.userId,
      name: item.name,
      referrals: Number(item.referralCount),
      earnings: Number(item.earnings),
      rank: index + 1,
      badge: getBadge(Number(item.referralCount))
    }));

    res.json(formattedLeaderboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/referrals/distribute-reward
router.post('/distribute-reward', async (req: Request, res: Response) => {
  try {
    const { referrerId, newUserId, rewardAmount = 20 } = req.body;

    if (!referrerId || !newUserId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create reward transaction
    const [transaction] = await db.insert(walletTransactions).values({
      userId: referrerId,
      type: 'referral_reward',
      amount: rewardAmount.toString(),
      currency: 'cUSD',
      status: 'completed',
      description: `Referral reward for inviting new user`,
      metadata: { newUserId }
    }).returning();

    // Update referrer's balance (if using internal balances)
    // TODO: Integrate with actual wallet system

    res.json({
      success: true,
      transaction,
      message: 'Referral reward distributed successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function getBadge(referralCount: number): string {
  if (referralCount >= 100) return 'Diamond';
  if (referralCount >= 50) return 'Platinum';
  if (referralCount >= 25) return 'Gold';
  if (referralCount >= 10) return 'Silver';
  return 'Bronze';
}

export default router;
