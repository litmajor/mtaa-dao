
import express, { Request, Response } from 'express';
import { db } from '../db';
import { users, walletTransactions } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { isAuthenticated } from '../nextAuthMiddleware';

const router = express.Router();

// Generate unique referral code
function generateReferralCode(userId: string): string {
  return `MTAA-${userId.substring(0, 6).toUpperCase()}`;
}

// GET /api/referrals/stats
router.get('/stats', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
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

  // Count referrals that are not banned
  const activeReferrals = referredUsers.filter(u => !u.isBanned).length;
    
    // Calculate total earnings from referrals
    const earnings = await db.select({
      total: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)`
    })
    .from(walletTransactions)
    .where(and(
      eq(walletTransactions.toUserId, userId),
      eq(walletTransactions.type, 'referral_reward')
    ));

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisMonthReferrals = referredUsers.filter(
      u => u.createdAt && new Date(u.createdAt) >= thisMonth
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
    // Get all users with their referral counts
    const usersWithReferrals = await db.execute(sql`
      SELECT 
        u.id,
        COALESCE(u.first_name || ' ' || u.last_name, u.email, 'Anonymous') as name,
        COUNT(DISTINCT r.id) as referral_count,
        COALESCE(SUM(CAST(wt.amount AS DECIMAL)), 0) as total_earnings
      FROM users u
      LEFT JOIN users r ON r.referred_by = u.id AND r.is_banned = false
      LEFT JOIN wallet_transactions wt ON wt.to_user_id = u.id AND wt.type = 'referral_reward'
      WHERE u.is_banned = false
      GROUP BY u.id, u.first_name, u.last_name, u.email
      HAVING COUNT(DISTINCT r.id) > 0
      ORDER BY referral_count DESC, total_earnings DESC
      LIMIT 50
    `);

    const formattedLeaderboard = usersWithReferrals.rows.map((item: any, index: number) => ({
      id: item.id,
      name: item.name,
      referrals: Number(item.referral_count),
      earnings: Number(item.total_earnings),
      rank: index + 1,
      badge: getBadge(Number(item.referral_count))
    }));

    res.json(formattedLeaderboard);
  } catch (error: any) {
    console.error('Leaderboard error:', error);
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
    // Get referrer's wallet address
    const referrer = await db.query.users.findFirst({ where: eq(users.id, referrerId) });
    const walletAddress = referrer?.walletAddress || '';
    const [transaction] = await db.insert(walletTransactions).values({
      fromUserId: referrerId,
      walletAddress,
      type: 'referral_reward',
      amount: rewardAmount.toString(),
      currency: 'cUSD',
      status: 'completed',
      description: `Referral reward for inviting new user (userId: ${newUserId})`
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
