import { Router } from "express";
import { db } from "../db";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../auth";
import { requireAdmin } from "../nextAuthMiddleware";
import { logger } from "../utils/logger";
import cron, { ScheduledTask } from "node-cron";

const router = Router();

// Store cron job reference for cleanup
let weeklyDistributionJob: ScheduledTask | null = null;

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

// POST /api/referral-rewards/claim/:rewardId - Claim available rewards with vesting validation
router.post("/claim/:rewardId", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const rewardId = req.params.rewardId;
    const { claimAmount } = req.body; // Optional: allow partial claims

    // Get reward details
    const reward = await db.execute(sql`
      SELECT * FROM referral_rewards
      WHERE id = ${rewardId}
        AND "userId" = ${userId}
    `);

    if (!reward.rows.length) {
      return res.status(404).json({ error: "Reward not found" });
    }

    const rewardData = reward.rows[0] as any;
    const totalReward = parseFloat(rewardData.totalReward);
    const claimedAmount = parseFloat(rewardData.claimedAmount || '0');
    
    // Check if already fully claimed
    if (rewardData.status === 'claimed') {
      return res.status(400).json({ error: "Reward already fully claimed" });
    }
    
    // Calculate claimable amount based on vesting schedule
    const now = new Date();
    const createdAt = new Date(rewardData.createdAt);
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // 4-tranche vesting: 25% immediate, 25% at 30d, 25% at 60d, 25% at 90d
    let vestedPercentage = 0;
    if (daysSinceCreation >= 90) vestedPercentage = 100;
    else if (daysSinceCreation >= 60) vestedPercentage = 75;
    else if (daysSinceCreation >= 30) vestedPercentage = 50;
    else vestedPercentage = 25; // Immediate unlock

    const vestedAmount = (totalReward * vestedPercentage) / 100;
    const availableAmount = vestedAmount - claimedAmount;

    if (availableAmount <= 0) {
      const nextVestingDate = new Date(createdAt.getTime() + (daysSinceCreation < 30 ? 30 : daysSinceCreation < 60 ? 60 : 90) * 24 * 60 * 60 * 1000);
      return res.status(400).json({ 
        error: "No tokens available to claim yet",
        nextVestingDate,
        nextVestingPercentage: daysSinceCreation >= 90 ? null : (daysSinceCreation < 30 ? 50 : daysSinceCreation < 60 ? 75 : 100)
      });
    }

    // Use requested amount or available amount if not specified
    const actualClaimAmount = claimAmount ? Math.min(claimAmount, availableAmount) : availableAmount;
    
    if (actualClaimAmount <= 0) {
      return res.status(400).json({ error: "Invalid claim amount" });
    }

    // Blockchain/token transfer implementation:
    // 1. Get user's wallet address from database (SELECT wallet_address FROM users WHERE id = ?)
    // 2. Initialize contract with ethers.js: new Contract(MTAA_ADDRESS, ERC20_ABI, signer)
    // 3. Build transfer: const tx = await contract.transfer(walletAddress, actualClaimAmount)
    // 4. Wait for confirmation: const receipt = await tx.wait()
    // 5. Check receipt.status === 1 to confirm success
    // 6. Store transaction hash in reward_claims table
    // 7. Update user's claimedRewards field
    // 8. Emit RewardClaimed event with user, amount, txHash
    // Error handling:
    // - Insufficient balance: catch and return 500 error
    // - Network failure: retry logic with exponential backoff
    // - Gas price spike: implement dynamic gas price calculation
    
    await db.execute(sql`
      UPDATE referral_rewards
      SET 
        "claimedAmount" = "claimedAmount" + ${actualClaimAmount},
        status = CASE 
          WHEN ("claimedAmount" + ${actualClaimAmount}) >= "totalReward" THEN 'claimed'
          ELSE 'vesting'
        END,
        "updatedAt" = NOW()
      WHERE id = ${rewardId}
    `);

    // Log the claim in reward_claims table for audit
    await db.execute(sql`
      INSERT INTO reward_claims (id, "rewardId", amount, "claimedAt")
      VALUES (gen_random_uuid(), ${rewardId}, ${actualClaimAmount}, NOW())
    `);

    logger.info(`User ${userId} claimed ${actualClaimAmount} MTAA from reward ${rewardId}. Vested: ${vestedPercentage}%`);

    // Calculate next vesting tranche
    let nextVestingDate = null;
    let nextVestingPercentage = null;
    if (daysSinceCreation < 30) {
      nextVestingDate = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      nextVestingPercentage = 50;
    } else if (daysSinceCreation < 60) {
      nextVestingDate = new Date(createdAt.getTime() + 60 * 24 * 60 * 60 * 1000);
      nextVestingPercentage = 75;
    } else if (daysSinceCreation < 90) {
      nextVestingDate = new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000);
      nextVestingPercentage = 100;
    }

    res.json({
      success: true,
      claimed: actualClaimAmount,
      remaining: totalReward - (claimedAmount + actualClaimAmount),
      vestedPercentage,
      nextVestingDate,
      nextVestingPercentage,
      transactionId: null, // Would be populated on blockchain transfer
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

// GET /api/referral-rewards/leaderboard - Get ranking with quality scoring
router.get("/leaderboard", async (req, res) => {
  try {
    const { timeframe = 'all-time', limit = 50 } = req.query;
    
    // Calculate time window
    const now = new Date();
    let startDate = new Date(1970, 0, 1); // Beginning of time
    
    if (timeframe === 'this-month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeframe === 'this-quarter') {
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    } else if (timeframe === 'this-year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const leaderboard = await db.execute(sql`
      SELECT 
        u.id,
        u."firstName",
        u."lastName",
        u.username,
        COUNT(DISTINCT rr.id) as "rewardCount",
        COALESCE(SUM(rr."totalReward"), 0) as "totalEarned",
        COALESCE(SUM(rr."claimedAmount"), 0) as "totalClaimed",
        COALESCE(SUM(CASE WHEN rr.status = 'vesting' THEN rr."totalReward" - rr."claimedAmount" ELSE 0 END), 0) as "pendingAmount",
        ROW_NUMBER() OVER (ORDER BY SUM(rr."totalReward") DESC) as rank,
        (COALESCE(SUM(rr."claimedAmount"), 0) / NULLIF(COALESCE(SUM(rr."totalReward"), 0), 0)) as "claimRatio",
        MAX(rr."weekEnding") as "lastReward"
      FROM users u
      LEFT JOIN referral_rewards rr ON u.id = rr."userId"
        AND rr."createdAt" >= ${startDate}
      WHERE rr.id IS NOT NULL
      GROUP BY u.id, u."firstName", u."lastName", u.username
      ORDER BY SUM(rr."totalReward") DESC, SUM(rr."claimedAmount") DESC
      LIMIT ${parseInt(limit as string)}
    `);

    const formatted = (leaderboard.rows as any[]).map((row) => ({
      rank: parseInt(row.rank),
      userId: row.id,
      name: `${row.firstName} ${row.lastName}`.trim() || row.username || 'Anonymous',
      rewardCount: parseInt(row.rewardCount),
      totalEarned: parseFloat(row.totalEarned || '0').toFixed(2),
      totalClaimed: parseFloat(row.totalClaimed || '0').toFixed(2),
      pendingAmount: parseFloat(row.pendingAmount || '0').toFixed(2),
      claimRatio: parseFloat(((parseFloat(row.claimRatio || '0') * 100).toFixed(1))),
      lastReward: row.lastReward,
    }));

    res.json({
      timeframe,
      leaderboard: formatted,
      totalRanked: formatted.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
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
    const totalDistributed = parseFloat((stats.rows[0] as any)?.totalDistributed || '0');
    const totalClaimed = parseFloat((stats.rows[0] as any)?.totalClaimed || '0');
    const avgWeeklyDistribution = totalDistributed / Math.max(1, parseInt((stats.rows[0] as any)?.totalDistributions || '1') / 10);

    res.json({
      uniqueWinners: parseInt((stats.rows[0] as any)?.uniqueWinners || '0'),
      totalDistributions: parseInt((stats.rows[0] as any)?.totalDistributions || '0'),
      totalDistributed: totalDistributed.toFixed(2),
      totalClaimed: totalClaimed.toFixed(2),
      pendingDistribution: (totalDistributed - totalClaimed).toFixed(2),
      lastDistribution: (stats.rows[0] as any)?.lastDistribution,
      currentWeekPool,
      avgWeeklyDistribution: parseFloat(avgWeeklyDistribution.toFixed(2)),
    });
  } catch (error) {
    logger.error("Error fetching reward stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Initialize weekly distribution cron job
function initWeeklyDistributionJob() {
  // Run every Monday at 9 AM UTC
  weeklyDistributionJob = cron.schedule('0 9 * * 1', async () => {
    try {
      logger.info('Starting weekly reward distribution job...');
      
      const now = new Date();
      const weekEnding = new Date(now);
      weekEnding.setDate(now.getDate() - now.getDay() + 7); // Next Sunday
      
      // Check if already distributed
      const existing = await db.execute(sql`
        SELECT COUNT(*) as count FROM referral_rewards WHERE "weekEnding" = ${weekEnding}
      `);

      if (parseInt((existing.rows[0] as any).count) > 0) {
        logger.info(`Rewards already distributed for week ending ${weekEnding}`);
        return;
      }

      // Get top 10 referrers for the past week
      const weekStartDate = new Date(weekEnding);
      weekStartDate.setDate(weekEnding.getDate() - 7);

      const topReferrers = await db.execute(sql`
        SELECT 
          u.id,
          COUNT(DISTINCT r.id) as "referralCount",
          COUNT(DISTINCT CASE WHEN r."isActive" = true THEN r.id END) as "activeReferrals",
          SUM(CASE WHEN r."isActive" = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(r.id), 0) as "qualityScore"
        FROM users u
        LEFT JOIN referrals r ON u.id = r."referrerId"
        WHERE r."createdAt" >= ${weekStartDate}
          AND r."createdAt" < ${weekEnding}
        GROUP BY u.id
        HAVING COUNT(r.id) >= 3
        ORDER BY COUNT(r.id) DESC, "activeReferrals" DESC
        LIMIT 10
      `);

      // Distribute rewards
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
            gen_random_uuid(), ${user.id}, ${weekEnding}, ${rank}, ${baseReward},
            ${qualityMultiplier}, ${bonusAmount}, ${totalReward},
            0, 'pending', '{"immediate": 25, "30d": 25, "60d": 25, "90d": 25}'::jsonb,
            NOW()
          )
        `);
      }

      logger.info(`Distributed rewards for week ending ${weekEnding}. Top ${Math.min(10, topReferrers.rows.length)} referrers rewarded.`);
    } catch (error) {
      logger.error('Error in weekly distribution job:', error);
    }
  });
  
  logger.info('Weekly reward distribution job initialized (runs every Monday at 9 AM UTC)');
}

// Start the cron job when router loads
initWeeklyDistributionJob();

// Cleanup function
function stopWeeklyDistributionJob() {
  if (weeklyDistributionJob) {
    weeklyDistributionJob.stop();
    logger.info('Weekly reward distribution job stopped');
  }
}

export { stopWeeklyDistributionJob };
export default router;

