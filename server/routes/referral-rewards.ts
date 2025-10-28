import { Router } from "express";
import { db } from "../db";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../auth";
import { requireAdmin } from "../nextAuthMiddleware";
import { logger } from "../utils/logger";

const router = Router();

// Configuration
const WEEKLY_REWARD_POOL = 10000; // 10,000 MTAA tokens
const REWARD_DISTRIBUTION = [
  { rank: 1, percentage: 30, amount: 3000 },
  { rank: 2, percentage: 20, amount: 2000 },
  { rank: 3, percentage: 15, amount: 1500 },
  { rank: 4, percentage: 10, amount: 1000 },
  { rank: 5, percentage: 8, amount: 800 },
  { rank: 6, percentage: 6, amount: 600 },
  { rank: 7, percentage: 5, amount: 500 },
  { rank: 8, percentage: 4, amount: 400 },
  { rank: 9, percentage: 1.5, amount: 150 },
  { rank: 10, percentage: 0.5, amount: 50 },
];

// GET /api/referral-rewards/current-week - Get current week's leaderboard with potential rewards
router.get("/current-week", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get start and end of current week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Get top referrers for current week
    const topReferrers = await db.execute(sql`
      SELECT 
        u.id,
        u."firstName",
        u."lastName",
        COUNT(DISTINCT r.id) as "referralCount",
        COUNT(DISTINCT CASE WHEN r."isActive" = true THEN r.id END) as "activeReferrals",
        SUM(CASE WHEN r."isActive" = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(r.id), 0) as "qualityScore",
        COALESCE(SUM(CAST(c.amount AS DECIMAL)), 0) as "totalValue"
      FROM users u
      LEFT JOIN referrals r ON u.id = r."referrerId"
      LEFT JOIN contributions c ON r."referredUserId" = c."userId"
      WHERE r."createdAt" >= ${weekStart}
        AND r."createdAt" < ${weekEnd}
      GROUP BY u.id, u."firstName", u."lastName"
      HAVING COUNT(r.id) >= 3
      ORDER BY COUNT(r.id) DESC, "activeReferrals" DESC
      LIMIT 20
    `);

    // Calculate potential rewards
    const leaderboard = (topReferrers.rows as any[]).map((user, index) => {
      const rank = index + 1;
      const rewardConfig = REWARD_DISTRIBUTION.find(r => r.rank === rank);
      const baseReward = rewardConfig?.amount || 0;
      
      // Quality multiplier (max 2x)
      const qualityScore = parseFloat(user.qualityScore || '0');
      const qualityMultiplier = 1 + (qualityScore * 0.5); // 50% active = 1.25x, 100% active = 1.5x
      const qualityBonus = baseReward * (qualityMultiplier - 1);
      
      const totalReward = baseReward + qualityBonus;
      
      return {
        rank,
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        referralCount: parseInt(user.referralCount),
        activeReferrals: parseInt(user.activeReferrals),
        qualityScore: parseFloat((qualityScore * 100).toFixed(1)),
        baseReward,
        qualityBonus: parseFloat(qualityBonus.toFixed(2)),
        totalReward: parseFloat(totalReward.toFixed(2)),
        isCurrentUser: user.id === userId,
      };
    });

    // Find current user's position
    const userPosition = leaderboard.find(entry => entry.isCurrentUser);
    const totalPool = leaderboard.reduce((sum, entry) => sum + entry.totalReward, 0);

    res.json({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalPool: WEEKLY_REWARD_POOL,
      distributedAmount: parseFloat(totalPool.toFixed(2)),
      leaderboard,
      userPosition,
      daysRemaining: Math.ceil((weekEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    });
  } catch (error) {
    logger.error("Error fetching current week rewards:", error);
    res.status(500).json({ error: "Failed to fetch rewards leaderboard" });
  }
});

// GET /api/referral-rewards/history - Get user's reward history
router.get("/history", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;

    const rewards = await db.execute(sql`
      SELECT 
        id,
        "weekEnding",
        rank,
        "baseReward",
        "qualityMultiplier",
        "bonusAmount",
        "totalReward",
        "claimedAmount",
        status,
        "vestingSchedule",
        "createdAt"
      FROM referral_rewards
      WHERE "userId" = ${userId}
      ORDER BY "weekEnding" DESC
      LIMIT 20
    `);

    const totalEarned = await db.execute(sql`
      SELECT 
        COALESCE(SUM("totalReward"), 0) as total,
        COALESCE(SUM("claimedAmount"), 0) as claimed
      FROM referral_rewards
      WHERE "userId" = ${userId}
    `);

    res.json({
      rewards: rewards.rows,
      summary: {
        totalEarned: parseFloat((totalEarned.rows[0] as any)?.total || '0'),
        totalClaimed: parseFloat((totalEarned.rows[0] as any)?.claimed || '0'),
        pending: parseFloat((parseFloat((totalEarned.rows[0] as any)?.total || '0') - parseFloat((totalEarned.rows[0] as any)?.claimed || '0')).toFixed(2)),
      },
    });
  } catch (error) {
    logger.error("Error fetching reward history:", error);
    res.status(500).json({ error: "Failed to fetch reward history" });
  }
});

// POST /api/referral-rewards/claim/:rewardId - Claim available rewards
router.post("/claim/:rewardId", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const rewardId = req.params.rewardId;

    // Get reward details
    const reward = await db.execute(sql`
      SELECT * FROM referral_rewards
      WHERE id = ${rewardId}
        AND "userId" = ${userId}
        AND status != 'claimed'
    `);

    if (!reward.rows.length) {
      return res.status(404).json({ error: "Reward not found or already claimed" });
    }

    const rewardData = reward.rows[0] as any;
    const vestingSchedule = rewardData.vestingSchedule || { immediate: 100 };
    
    // Calculate claimable amount based on vesting
    const now = new Date();
    const createdAt = new Date(rewardData.createdAt);
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    let vestedPercentage = 0;
    if (daysSinceCreation >= 90) vestedPercentage = 100;
    else if (daysSinceCreation >= 60) vestedPercentage = 75;
    else if (daysSinceCreation >= 30) vestedPercentage = 50;
    else vestedPercentage = 25; // Immediate unlock

    const totalReward = parseFloat(rewardData.totalReward);
    const claimedAmount = parseFloat(rewardData.claimedAmount || '0');
    const vestedAmount = (totalReward * vestedPercentage) / 100;
    const claimableAmount = vestedAmount - claimedAmount;

    if (claimableAmount <= 0) {
      return res.status(400).json({ error: "No tokens available to claim yet" });
    }

    // TODO: Integrate with actual blockchain/token transfer
    // For now, update database and log the claim
    
    await db.execute(sql`
      UPDATE referral_rewards
      SET 
        "claimedAmount" = "claimedAmount" + ${claimableAmount},
        status = CASE 
          WHEN "claimedAmount" + ${claimableAmount} >= "totalReward" THEN 'claimed'
          ELSE 'vesting'
        END,
        "updatedAt" = NOW()
      WHERE id = ${rewardId}
    `);

    // Log the claim
    await db.execute(sql`
      INSERT INTO reward_claims (id, "rewardId", amount, "claimedAt")
      VALUES (gen_random_uuid(), ${rewardId}, ${claimableAmount}, NOW())
    `);

    logger.info(`User ${userId} claimed ${claimableAmount} MTAA from reward ${rewardId}`);

    res.json({
      success: true,
      claimed: claimableAmount,
      remaining: totalReward - (claimedAmount + claimableAmount),
      nextVestingDate: daysSinceCreation < 30 ? new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000) : 
                      daysSinceCreation < 60 ? new Date(createdAt.getTime() + 60 * 24 * 60 * 60 * 1000) :
                      daysSinceCreation < 90 ? new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000) : null,
    });
  } catch (error) {
    logger.error("Error claiming reward:", error);
    res.status(500).json({ error: "Failed to claim reward" });
  }
});

// POST /api/referral-rewards/distribute - Admin: Distribute weekly rewards
router.post("/distribute", authenticate, requireAdmin, async (req, res) => {
  try {
    const { weekEnding } = req.body;

    if (!weekEnding) {
      return res.status(400).json({ error: "weekEnding date required" });
    }

    const weekEndDate = new Date(weekEnding);
    const weekStartDate = new Date(weekEndDate);
    weekStartDate.setDate(weekEndDate.getDate() - 7);

    // Check if already distributed
    const existing = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM referral_rewards
      WHERE "weekEnding" = ${weekEndDate}
    `);

    if (parseInt((existing.rows[0] as any).count) > 0) {
      return res.status(400).json({ error: "Rewards already distributed for this week" });
    }

    // Get top referrers
    const topReferrers = await db.execute(sql`
      SELECT 
        u.id,
        COUNT(DISTINCT r.id) as "referralCount",
        COUNT(DISTINCT CASE WHEN r."isActive" = true THEN r.id END) as "activeReferrals",
        SUM(CASE WHEN r."isActive" = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(r.id), 0) as "qualityScore"
      FROM users u
      LEFT JOIN referrals r ON u.id = r."referrerId"
      WHERE r."createdAt" >= ${weekStartDate}
        AND r."createdAt" < ${weekEndDate}
      GROUP BY u.id
      HAVING COUNT(r.id) >= 3
      ORDER BY COUNT(r.id) DESC, "activeReferrals" DESC
      LIMIT 10
    `);

    // Distribute rewards
    const distributions = [];
    for (let index = 0; index < (topReferrers.rows as any[]).length; index++) {
      const user = topReferrers.rows[index] as any;
      const rank = index + 1;
      const rewardConfig = REWARD_DISTRIBUTION.find(r => r.rank === rank);
      
      if (!rewardConfig) continue;

      const baseReward = rewardConfig.amount;
      const qualityScore = parseFloat(user.qualityScore || '0');
      const qualityMultiplier = 1 + (qualityScore * 0.5);
      const bonusAmount = baseReward * (qualityMultiplier - 1);
      const totalReward = baseReward + bonusAmount;

      await db.execute(sql`
        INSERT INTO referral_rewards (
          id, "userId", "weekEnding", rank, "baseReward", 
          "qualityMultiplier", "bonusAmount", "totalReward",
          "claimedAmount", status, "vestingSchedule", "createdAt"
        )
        VALUES (
          gen_random_uuid(), ${user.id}, ${weekEndDate}, ${rank}, ${baseReward},
          ${qualityMultiplier}, ${bonusAmount}, ${totalReward},
          0, 'pending', '{"immediate": 25, "30d": 25, "60d": 25, "90d": 25}'::jsonb,
          NOW()
        )
      `);

      distributions.push({
        userId: user.id,
        rank,
        totalReward,
      });
    }

    logger.info(`Distributed ${distributions.length} rewards for week ending ${weekEnding}`);

    res.json({
      success: true,
      distributed: distributions.length,
      totalAmount: distributions.reduce((sum, d) => sum + d.totalReward, 0),
      distributions,
    });
  } catch (error) {
    logger.error("Error distributing rewards:", error);
    res.status(500).json({ error: "Failed to distribute rewards" });
  }
});

// GET /api/referral-rewards/stats - Get overall program stats
router.get("/stats", authenticate, async (req, res) => {
  try {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT "userId") as "uniqueWinners",
        COUNT(*) as "totalDistributions",
        COALESCE(SUM("totalReward"), 0) as "totalDistributed",
        COALESCE(SUM("claimedAmount"), 0) as "totalClaimed",
        MAX("weekEnding") as "lastDistribution"
      FROM referral_rewards
    `);

    const currentWeekPool = WEEKLY_REWARD_POOL;
    const avgWeeklyDistribution = parseFloat((stats.rows[0] as any)?.totalDistributed || '0') / 
                                  Math.max(1, parseInt((stats.rows[0] as any)?.totalDistributions || '1') / 10);

    res.json({
      uniqueWinners: parseInt((stats.rows[0] as any)?.uniqueWinners || '0'),
      totalDistributions: parseInt((stats.rows[0] as any)?.totalDistributions || '0'),
      totalDistributed: parseFloat((stats.rows[0] as any)?.totalDistributed || '0'),
      totalClaimed: parseFloat((stats.rows[0] as any)?.totalClaimed || '0'),
      lastDistribution: (stats.rows[0] as any)?.lastDistribution,
      currentWeekPool,
      avgWeeklyDistribution: parseFloat(avgWeeklyDistribution.toFixed(2)),
    });
  } catch (error) {
    logger.error("Error fetching reward stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;

