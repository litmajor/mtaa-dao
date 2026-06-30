import { Router } from "express";
import { db } from "../db";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { referralPayouts } from "../../shared/financialEnhancedSchema";
import { authenticate, type AuthRequest } from "../auth";
import { randomUUID } from 'crypto';
import { requireAdmin } from "../nextAuthMiddleware";
import { logger } from "../utils/logger";
import cron, { ScheduledTask } from "node-cron";
import { detectReferrerAnomalies } from "../services/sybil-defense";

const router = Router();

// Ensure imported drizzle helpers are referenced here where relevant.
// `referralPayouts` is used for inserts; other helpers are available for future refactorings.
void eq; void desc; void gte; void lte; void and;

// Store cron job reference for cleanup
let weeklyDistributionJob: ScheduledTask | null = null;

// Configuration: HYBRID TIERED MODEL (not top-10, but progressive tiers)
// Bronze: 1-5 referrals → Points only
// Silver: 6-20 referrals → 200 base reward
// Gold: 21+ referrals → 500 base reward
// Quality multiplier (1.0-1.5x) applied to Silver/Gold based on active ratio
// 90-day vesting: 25% immediate + 25% at 30/60/90 days

const REFERRAL_TIERS = {
  bronze: { minRefs: 1, maxRefs: 5, baseReward: 0, pointsOnly: true },
  silver: { minRefs: 6, maxRefs: 20, baseReward: 200, pointsOnly: false },
  gold: { minRefs: 21, maxRefs: Infinity, baseReward: 500, pointsOnly: false },
};

const WEEKLY_REWARD_POOL = 10000; // 10,000 MTAA tokens (distributed proportionally among Silver/Gold)

// Helper: distribute rewards for a given weekEnding (Date)
async function distributeWeekRewards(weekEndDate: Date) {
  const weekStartDate = new Date(weekEndDate);
  weekStartDate.setDate(weekEndDate.getDate() - 7);
  weekStartDate.setHours(0, 0, 0, 0);
  weekEndDate.setHours(23, 59, 59, 999);

  // Check if already distributed
  const existing = await db.execute(sql`
    SELECT COUNT(*) as count FROM referral_rewards WHERE "weekEnding" = ${weekEndDate}
  `);
  if (parseInt((existing.rows[0] as any).count) > 0) {
    return { alreadyDistributed: true, distributions: [] };
  }

  const allReferrers = await db.execute(sql`
    SELECT 
      u.id,
      COUNT(DISTINCT r.id)::integer as "totalReferrals",
      COUNT(DISTINCT CASE WHEN r."isActive" = true THEN r.id END)::integer as "activeReferrals",
      SUM(CASE WHEN r."isActive" = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(r.id), 0) as "qualityScore"
    FROM users u
    LEFT JOIN referrals r ON u.id = r."referrerId"
    WHERE r."createdAt" >= ${weekStartDate}
      AND r."createdAt" < ${weekEndDate}
    GROUP BY u.id
    HAVING COUNT(r.id) >= 1  -- Lowered from 3 to 1 (all tiers now eligible)
  `);

  const distributions: any[] = [];
  for (const user of (allReferrers.rows as any[])) {
    const totalRefs = user.totalReferrals || 0;
    const activeRefs = user.activeReferrals || 0;
    
    // Determine tier: Bronze (1-5), Silver (6-20), Gold (21+)
    let tierName = 'none';
    let baseReward = 0;
    
    if (totalRefs >= 21) {
      tierName = 'gold';
      baseReward = REFERRAL_TIERS.gold.baseReward;
    } else if (totalRefs >= 6) {
      tierName = 'silver';
      baseReward = REFERRAL_TIERS.silver.baseReward;
    } else if (totalRefs >= 1) {
      tierName = 'bronze';
      baseReward = REFERRAL_TIERS.bronze.baseReward;  // 0 for points only
    } else {
      continue;  // No referrals, skip
    }

    // Skip if no base reward (Bronze tier doesn't get MTAA, only points)
    if (baseReward === 0) {
      logger.info('Bronze tier referrer - points only', { userId: user.id, totalRefs });
      continue;
    }
    
    // CRITICAL: Check for anomalies before awarding to prevent sybil attacks
    try {
      const anomalyAssessment = await detectReferrerAnomalies(user.id, 168); // 7 days lookback
      
      if (anomalyAssessment.riskLevel === 'critical') {
        logger.warn('SYBIL ATTACK DETECTED: Suspending referrer from rewards', {
          referrerId: user.id,
          tier: tierName,
          totalRefs,
          riskScore: anomalyAssessment.riskScore,
          flags: anomalyAssessment.flags
        });
        // Skip this referrer's reward and send alert
        try {
          await fetch(process.env.ADMIN_ALERT_WEBHOOK || '', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🚨 **SYBIL ATTACK**: Referrer ${user.id} risk score ${anomalyAssessment.riskScore}/100 - suspended from rewards (${tierName.toUpperCase()} tier, ${totalRefs} referrals)`
            })
          }).catch(() => {});
        } catch (e) {
          logger.debug('Admin alert send failed', e);
        }
        continue; // Skip to next referrer
      }
      
      if (anomalyAssessment.riskLevel === 'high') {
        logger.info('High-risk referrer - reward approved with monitoring', {
          referrerId: user.id,
          tier: tierName,
          riskScore: anomalyAssessment.riskScore,
          flags: anomalyAssessment.flags
        });
      }
    } catch (anomalyErr) {
      logger.error('Failed to check referrer anomalies - proceeding with caution', {
        referrerId: user.id,
        error: String(anomalyErr)
      });
      // On error, still award but log it
    }

    // Quality multiplier (max 1.5x) — applied to Silver/Gold tiers
    const qualityScore = parseFloat(user.qualityScore || '0');
    const qualityMultiplier = 1 + (qualityScore * 0.5); // 1.0 to 1.5
    const bonusAmount = baseReward * (qualityMultiplier - 1);
    const totalReward = baseReward + bonusAmount;

    // Create reward with 90-day vesting: 25% immediate + 25% at 30/60/90 days
    await db.execute(sql`
      INSERT INTO referral_rewards (
        "userId", "weekEnding", tier, "baseReward", 
        "qualityMultiplier", "bonusAmount", "totalReward",
        "claimedAmount", status, "vestingSchedule", "createdAt"
      )
      VALUES (
        ${user.id}, ${weekEndDate}, ${tierName}, ${baseReward},
        ${qualityMultiplier}, ${bonusAmount}, ${totalReward},
        0, 'pending', '{\"immediate\": 25, \"30d\": 25, \"60d\": 25, \"90d\": 25}'::jsonb,
        NOW()
      )
    `);

    distributions.push({ 
      userId: user.id, 
      tier: tierName,
      totalReferrals: totalRefs,
      activeReferrals: activeRefs,
      qualityScore: (qualityScore * 100).toFixed(0) + '%',
      baseReward,
      qualityMultiplier: qualityMultiplier.toFixed(2) + 'x',
      totalReward: totalReward.toFixed(2)
    });
  }

  return { alreadyDistributed: false, distributions };
}

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
    weekEnd.setHours(23, 59, 59, 999);

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
      const totalRefs = parseInt(user.referralCount);
      
      // Determine tier for display
      let tierName = 'none';
      let baseReward = 0;
      if (totalRefs >= 21) {
        tierName = 'gold';
        baseReward = REFERRAL_TIERS.gold.baseReward;
      } else if (totalRefs >= 6) {
        tierName = 'silver';
        baseReward = REFERRAL_TIERS.silver.baseReward;
      } else if (totalRefs >= 1) {
        tierName = 'bronze';
        baseReward = REFERRAL_TIERS.bronze.baseReward;
      }
      
      // Quality multiplier (max 1.5x)
      const qualityScore = parseFloat(user.qualityScore || '0');
      const qualityMultiplier = 1 + (qualityScore * 0.5); // 50% active = 1.25x, 100% active = 1.5x
      const qualityBonus = baseReward * (qualityMultiplier - 1);
      
      const totalReward = baseReward + qualityBonus;
      
      return {
        tier: tierName,
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        referralCount: totalRefs,
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

    // Use a transaction and SELECT ... FOR UPDATE to avoid race conditions
    const payoutId = randomUUID();
    const claimId = randomUUID();
    const requestId = randomUUID();
    let actualClaimAmount: number = 0;

    await db.transaction(async tx => {
      // Lock the reward row
      const rewardRow = await tx.execute(sql`
        SELECT * FROM referral_rewards
        WHERE id = ${rewardId}
          AND "userId" = ${userId}
        FOR UPDATE
      `);

      if (!rewardRow.rows.length) {
        throw { status: 404, message: 'Reward not found' };
      }

      const rewardData = rewardRow.rows[0] as any;
      if (rewardData.status === 'claimed') {
        throw { status: 400, message: 'Reward already fully claimed' };
      }

      // Recalculate vesting and available amount from locked row
      const now = new Date();
      const createdAt = new Date(rewardData.createdAt);
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      let vestedPercentage = 0;
      if (daysSinceCreation >= 90) vestedPercentage = 100;
      else if (daysSinceCreation >= 60) vestedPercentage = 75;
      else if (daysSinceCreation >= 30) vestedPercentage = 50;
      else vestedPercentage = 25;

      const totalReward = parseFloat(rewardData.totalReward);
      const claimedAmountDb = parseFloat(rewardData.claimedAmount || '0');
      const vestedAmount = (totalReward * vestedPercentage) / 100;
      const availableAmount = vestedAmount - claimedAmountDb;

      if (availableAmount <= 0) {
        const nextVestingDate = new Date(createdAt.getTime() + (daysSinceCreation < 30 ? 30 : daysSinceCreation < 60 ? 60 : 90) * 24 * 60 * 60 * 1000);
        throw { status: 400, message: 'No tokens available to claim yet', meta: { nextVestingDate } };
      }

      // Validate requested amount
      actualClaimAmount = claimAmount ? Number(claimAmount) : availableAmount;
      if (isNaN(actualClaimAmount) || actualClaimAmount <= 0) {
        throw { status: 400, message: 'Invalid claim amount' };
      }
      if (actualClaimAmount > availableAmount) {
        throw { status: 400, message: 'Claim amount exceeds available vested amount' };
      }

      // Fetch user's wallet address inside transaction
      const walletRow = await tx.execute(sql`SELECT wallet_address FROM users WHERE id = ${userId} LIMIT 1`);
      const walletAddress = walletRow.rows[0]?.wallet_address || null;
      if (!walletAddress) {
        throw { status: 400, message: 'No destination wallet configured for user' };
      }

      // Apply updates and inserts
      await tx.execute(sql`
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

      await tx.execute(sql`
        INSERT INTO reward_claims (id, "rewardId", amount, "claimedAt")
        VALUES (${claimId}, ${rewardId}, ${actualClaimAmount}, NOW())
      `);

      await tx.insert(referralPayouts).values({
        referrerId: userId,
        referralRewardId: rewardId,
        amount: String(actualClaimAmount),
        currency: 'MTAA',
        payoutMethod: 'onchain',
        destinationAddress: walletAddress,
        status: 'pending',
        requestId: undefined,
        metadata: { payoutId, claimId } as any,
        createdAt: new Date(),
      } as any);
    }).catch(err => {
      if (err && err.status) {
        // propogate known error
        throw err;
      }
      throw err;
    });

    logger.info(`User ${userId} queued claim ${claimId} -> payout ${payoutId} amount ${actualClaimAmount} MTAA`);

    // Return 202 Accepted to indicate asynchronous processing
    return res.status(202).json({ success: true, queued: true, payoutId, requestId });
  } catch (error) {
    logger.error("Error claiming reward:", error);
    if (error && (error as any).status) {
      const e = error as any;
      return res.status(e.status).json({ error: e.message, ...(e.meta ? { meta: e.meta } : {}) });
    }
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
    const { alreadyDistributed, distributions } = await distributeWeekRewards(weekEndDate);

    if (alreadyDistributed) {
      return res.status(400).json({ error: 'Rewards already distributed for this week' });
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
router.get("/leaderboard", authenticate, async (req, res) => {
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

    // Compute average weekly distribution by counting distinct weekEnding values
    const weekCountRow = await db.execute(sql`
      SELECT COUNT(DISTINCT "weekEnding") as "weekCount" FROM referral_rewards
    `);
    const weekCount = parseInt((weekCountRow.rows[0] as any)?.weekCount || '0');
    const avgWeeklyDistribution = totalDistributed / Math.max(1, weekCount);

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
      // Calculate last Sunday as week ending (end-of-day)
      weekEnding.setDate(now.getDate() - now.getDay());
      weekEnding.setHours(23, 59, 59, 999);

      const { alreadyDistributed, distributions } = await distributeWeekRewards(weekEnding);
      if (alreadyDistributed) {
        logger.info(`Rewards already distributed for week ending ${weekEnding}`);
        return;
      }

      logger.info(`Distributed rewards for week ending ${weekEnding}. Top ${Math.min(10, distributions.length)} referrers rewarded.`);
    } catch (error) {
      logger.error('Error in weekly distribution job:', error);
    }
  });
  
  logger.info('Weekly reward distribution job initialized (runs every Monday at 9 AM UTC)');
}

// Start the cron job when router loads (only in production)
if (process.env.NODE_ENV === 'production') {
  initWeeklyDistributionJob();
} else {
  logger.info('Weekly reward distribution job not started (NODE_ENV != production)');
}

// Cleanup function
function stopWeeklyDistributionJob() {
  if (weeklyDistributionJob) {
    weeklyDistributionJob.stop();
    logger.info('Weekly reward distribution job stopped');
  }
}

export { stopWeeklyDistributionJob };
export default router;

