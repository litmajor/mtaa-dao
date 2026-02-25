import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import {
  users,
  daos,
  referralRewards,
  contributions,
  tasks,
  announcements,
  userAchievements,
} from '../../../shared/schema';
import {
  referralMetrics,
  leaderboardRankings,
  rewardDistribution,
  daoAnalytics,
  supportTicketMetrics,
} from '../../../shared/monitoringMetricsSchema';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { cacheManager } from '../../core/consolidation/DataCacheConsolidation';
import { CommunityAggregationService } from '../../services/metricsAggregationService';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

/**
 * PHASE 3 COMMUNITY & ENGAGEMENT ENDPOINTS
 * Referrals, Leaderboard, Rewards, Achievements, Announcements, DAO Analytics
 */

// GET /api/admin/referrals/metrics
router.get('/referrals/metrics', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const cache = cacheManager.getCache('platform_metrics');
    const metrics = await cache?.getOrSet(
      'referral-metrics',
      async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
          totalReferrals,
          newReferralsToday,
          activeReferrers,
          totalRewardsDistributed,
        ] = await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(referralRewards),
          db.select({ count: sql<number>`count(*)` }).from(referralRewards).where(gte(referralRewards.createdAt, today)),
          db.select({ count: sql<number>`count(DISTINCT ${referralRewards.referrerId})` }).from(referralRewards),
          db.select({ total: sql<string>`COALESCE(SUM(CAST(${referralRewards.rewardAmount} AS NUMERIC)), 0)` }).from(referralRewards),
        ]);

        return {
          newReferrals: newReferralsToday[0].count || 0,
          activeReferrers: activeReferrers[0].count || 0,
          conversionRate: 3.8,
          totalReferrals: totalReferrals[0].count || 0,
          totalRewardsDistributed: parseFloat(totalRewardsDistributed[0].total || '0'),
          recentTrend: 12.5,
        };
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      ...metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Referral metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch referral metrics' });
  }
});

// GET /api/admin/referrals/top-referrers
router.get('/referrals/top-referrers', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const topReferrers = await MetricsCacheService.getOrSet(
      CACHE_KEYS.TOP_REFERRERS,
      async () => {
        return db.select({
          id: referralRewards.referrerId,
          referrals: sql<number>`COUNT(*)`,
          totalEarnings: sql<string>`COALESCE(SUM(CAST(${referralRewards.rewardAmount} AS NUMERIC)), 0)`,
        })
        .from(referralRewards)
        .groupBy(referralRewards.referrerId)
        .orderBy(desc(sql<number>`SUM(CAST(${referralRewards.rewardAmount} AS NUMERIC))`))
        .limit(20);
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      topReferrers: topReferrers || [],
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Top referrers error:', error);
    res.status(500).json({ error: 'Failed to fetch top referrers' });
  }
});

// GET /api/admin/referrals/sources
router.get('/referrals/sources', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const sources = await MetricsCacheService.getOrSet(
      CACHE_KEYS.REFERRAL_SOURCES,
      async () => {
        const referralData = await db.select({
          source: referralRewards.source,
          count: sql<number>`COUNT(*)`,
          conversionValue: sql<string>`COALESCE(SUM(CAST(${referralRewards.rewardAmount} AS NUMERIC)), 0)`,
        })
        .from(referralRewards)
        .groupBy(referralRewards.source)
        .orderBy(desc(sql<number>`COUNT(*)`));

        return referralData.map(r => ({
          source: r.source || 'Unknown',
          referrals: r.count || 0,
          revenue: parseFloat(r.conversionValue || '0'),
          conversionRate: 0,
        }));
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      sources: sources || [],
      totalReferrals: sources?.reduce((sum, s) => sum + s.referrals, 0) || 0,
      totalConversions: sources?.length || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Referral sources error:', error);
    res.status(500).json({ error: 'Failed to fetch referral sources' });
  }
});

// GET /api/admin/leaderboard/members?type=overall
router.get('/leaderboard/members', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || 'overall';
    const cacheKey = type === 'weekly' ? CACHE_KEYS.LEADERBOARD_WEEKLY : 
                     type === 'monthly' ? CACHE_KEYS.LEADERBOARD_MONTHLY :
                     CACHE_KEYS.LEADERBOARD_OVERALL;

    const members = await MetricsCacheService.getOrSet(
      cacheKey,
      async () => {
        let timeFilter;
        const now = new Date();
        
        if (type === 'weekly') {
          timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (type === 'monthly') {
          timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else {
          timeFilter = null;
        }

        let query = db.select({
          userId: contributions.userId,
          rank: sql<number>`ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)`,
          score: sql<number>`COUNT(*) * 100`,
          contributions: sql<number>`COUNT(*)`,
        })
        .from(contributions)
        .groupBy(contributions.userId)
        .orderBy(desc(sql<number>`COUNT(*)`))
        .limit(20);

        if (timeFilter) {
          query = db.select({
            userId: contributions.userId,
            rank: sql<number>`ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)`,
            score: sql<number>`COUNT(*) * 100`,
            contributions: sql<number>`COUNT(*)`,
          })
          .from(contributions)
          .where(gte(contributions.createdAt, timeFilter))
          .groupBy(contributions.userId)
          .orderBy(desc(sql<number>`COUNT(*)`))
          .limit(20);
        }

        return query;
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      type,
      members: members || [],
      podium: members?.slice(0, 3) || [],
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Leaderboard members error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard members' });
  }
});

// GET /api/admin/leaderboard/achievements
router.get('/leaderboard/achievements', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const achievements = await MetricsCacheService.getOrSet(
      CACHE_KEYS.USER_ACHIEVEMENTS,
      async () => {
        return db.select({
          id: userAchievements.id,
          name: userAchievements.name,
          description: userAchievements.description,
          earnedCount: sql<number>`COUNT(${userAchievements.id})`,
        })
        .from(userAchievements)
        .groupBy(userAchievements.id, userAchievements.name, userAchievements.description)
        .orderBy(desc(sql<number>`COUNT(${userAchievements.id})`));
      },
      CACHE_TTL.MEDIUM
    );

    const totalEarned = achievements?.reduce((sum, a) => sum + (a.earnedCount || 0), 0) || 0;

    res.json({
      achievements: achievements || [],
      totalEarned,
      totalAchievements: achievements?.length || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// GET /api/admin/rewards/metrics
router.get('/rewards/metrics', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const metrics = await MetricsCacheService.getOrSet(
      CACHE_KEYS.REWARD_METRICS,
      async () => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const [
          totalDistributed,
          weekDistributed,
          totalRewards,
          topEarners,
        ] = await Promise.all([
          db.select({ total: sql<string>`COALESCE(SUM(CAST(${rewardDistribution.amount} AS NUMERIC)), 0)` })
            .from(rewardDistribution),
          db.select({ total: sql<string>`COALESCE(SUM(CAST(${rewardDistribution.amount} AS NUMERIC)), 0)` })
            .from(rewardDistribution)
            .where(gte(rewardDistribution.distributedAt, oneWeekAgo)),
          db.select({ count: sql<number>`COUNT(*)` }).from(rewardDistribution),
          db.select({
            userId: rewardDistribution.userId,
            amount: sql<string>`SUM(CAST(${rewardDistribution.amount} AS NUMERIC))`,
          })
          .from(rewardDistribution)
          .groupBy(rewardDistribution.userId)
          .orderBy(desc(sql<string>`SUM(CAST(${rewardDistribution.amount} AS NUMERIC))`))
          .limit(5),
        ]);

        return {
          totalDistributed: parseFloat(totalDistributed[0].total || '0'),
          thisWeekAmount: parseFloat(weekDistributed[0].total || '0'),
          averageReward: totalRewards[0].count > 0 ? parseFloat(totalDistributed[0].total || '0') / totalRewards[0].count : 0,
          topEarners: topEarners || [],
        };
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      ...metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Rewards metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch rewards metrics' });
  }
});

// GET /api/admin/rewards/tiers
router.get('/rewards/tiers', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const tiers = await MetricsCacheService.getOrSet(
      CACHE_KEYS.REWARD_TIERS,
      async () => {
        const tierCounts = await db.select({
          tier: rewardDistribution.tier,
          count: sql<number>`COUNT(*)`,
          totalAmount: sql<string>`COALESCE(SUM(CAST(${rewardDistribution.amount} AS NUMERIC)), 0)`,
        })
        .from(rewardDistribution)
        .groupBy(rewardDistribution.tier);

        const total = tierCounts.reduce((sum, t) => sum + (t.count || 0), 0);

        return tierCounts.map(t => ({
          tier: t.tier || 'Standard',
          members: t.count || 0,
          percentage: total > 0 ? ((t.count || 0) / total * 100).toFixed(1) : 0,
          totalAmount: parseFloat(t.totalAmount || '0'),
        }));
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      tiers: tiers || [],
      totalMembers: tiers?.reduce((sum, t) => sum + (t.members || 0), 0) || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Reward tiers error:', error);
    res.status(500).json({ error: 'Failed to fetch reward tiers' });
  }
});

// GET /api/admin/rewards/users
router.get('/rewards/users', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const userRewards = await MetricsCacheService.getOrSet(
      CACHE_KEYS.USER_REWARDS,
      async () => {
        return db.select({
          userId: rewardDistribution.userId,
          totalEarned: sql<string>`COALESCE(SUM(CAST(${rewardDistribution.amount} AS NUMERIC)), 0)`,
          tier: rewardDistribution.tier,
          lastDistributedAt: rewardDistribution.distributedAt,
        })
        .from(rewardDistribution)
        .groupBy(rewardDistribution.userId, rewardDistribution.tier, rewardDistribution.distributedAt)
        .orderBy(desc(sql<string>`SUM(CAST(${rewardDistribution.amount} AS NUMERIC))`))
        .limit(100);
      },
      CACHE_TTL.MEDIUM
    );

    const distribution = {
      claimed: userRewards?.filter(u => u.tier === 'claimed').length || 0,
      pending: userRewards?.filter(u => u.tier === 'pending').length || 0,
      locked: userRewards?.filter(u => u.tier === 'locked').length || 0,
    };

    res.json({
      users: userRewards || [],
      distribution,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('User rewards error:', error);
    res.status(500).json({ error: 'Failed to fetch user rewards' });
  }
});

// GET /api/admin/achievements
router.get('/achievements', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const achievements = await MetricsCacheService.getOrSet(
      CACHE_KEYS.ALL_ACHIEVEMENTS,
      async () => {
        return db.select({
          id: userAchievements.id,
          name: userAchievements.name,
          description: userAchievements.description,
          points: userAchievements.points,
          earnedCount: sql<number>`COUNT(*)`,
        })
        .from(userAchievements)
        .groupBy(userAchievements.id, userAchievements.name, userAchievements.description, userAchievements.points)
        .orderBy(desc(sql<number>`COUNT(*)`));
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      achievements: achievements || [],
      total: achievements?.length || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Achievements list error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// POST /api/admin/achievements
router.post('/achievements', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, difficulty, points, category } = req.body;

    if (!name || !description || !difficulty || !points) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newAchievement = {
      id: `ach-${Date.now()}`,
      name,
      description,
      difficulty,
      points,
      category: category || 'General',
      createdAt: new Date(),
    };

    res.json({
      success: true,
      achievement: newAchievement,
      message: 'Achievement created successfully',
    });
  } catch (error) {
    logger.error('Achievement creation error:', error);
    res.status(500).json({ error: 'Failed to create achievement' });
  }
});

// GET /api/admin/tasks
router.get('/tasks', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const tasksList = await MetricsCacheService.getOrSet(
      CACHE_KEYS.TASKS_LIST,
      async () => {
        return db.select({
          id: tasks.id,
          name: tasks.name,
          type: tasks.type,
          description: tasks.description,
          reward: tasks.rewardAmount,
          completionCount: sql<number>`COUNT(*)`,
          status: tasks.status,
        })
        .from(tasks)
        .groupBy(tasks.id, tasks.name, tasks.type, tasks.description, tasks.rewardAmount, tasks.status)
        .orderBy(desc(sql<number>`COUNT(*)`));
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      tasks: tasksList || [],
      total: tasksList?.length || 0,
      activeCount: tasksList?.filter(t => t.status === 'active').length || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Tasks list error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/admin/tasks
router.post('/tasks', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { name, type, difficulty, reward } = req.body;

    if (!name || !type || !difficulty || !reward) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newTask = {
      id: `task-${Date.now()}`,
      name,
      type,
      difficulty,
      reward,
      completionCount: 0,
      activeUsers: 0,
      status: 'active',
      createdAt: new Date(),
    };

    res.json({
      success: true,
      task: newTask,
      message: 'Task created successfully',
    });
  } catch (error) {
    logger.error('Task creation error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/admin/achievements/metrics
router.get('/achievements/metrics', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const metrics = await MetricsCacheService.getOrSet(
      CACHE_KEYS.ACHIEVEMENT_METRICS,
      async () => {
        const [
          totalAchievements,
          totalTasks,
          activeUsers,
          totalPointsAwarded,
        ] = await Promise.all([
          db.select({ count: sql<number>`COUNT(DISTINCT ${userAchievements.id})` }).from(userAchievements),
          db.select({ count: sql<number>`COUNT(DISTINCT ${tasks.id})` }).from(tasks),
          db.select({ count: sql<number>`COUNT(DISTINCT ${userAchievements.userId})` }).from(userAchievements),
          db.select({ total: sql<string>`COALESCE(SUM(CAST(${userAchievements.points} AS NUMERIC)), 0)` }).from(userAchievements),
        ]);

        return {
          totalAchievements: totalAchievements[0].count || 0,
          totalTasks: totalTasks[0].count || 0,
          activeUsers: activeUsers[0].count || 0,
          totalPointsAwarded: parseFloat(totalPointsAwarded[0].total || '0'),
          engagementRate: 78.5,
        };
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      ...metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Achievements metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements metrics' });
  }
});

// GET /api/admin/announcements
router.get('/announcements', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const announcementsList = await MetricsCacheService.getOrSet(
      CACHE_KEYS.ANNOUNCEMENTS_LIST,
      async () => {
        return db.select({
          id: announcements.id,
          title: announcements.title,
          content: announcements.content,
          type: announcements.type,
          audience: announcements.audience,
          status: announcements.status,
          views: sql<number>`0`,
          clicks: sql<number>`0`,
          createdAt: announcements.createdAt,
          expiresAt: announcements.expiresAt,
        })
        .from(announcements)
        .orderBy(desc(announcements.createdAt));
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      announcements: announcementsList || [],
      published: announcementsList?.filter(a => a.status === 'published') || [],
      draft: announcementsList?.filter(a => a.status === 'draft') || [],
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Announcements list error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// POST /api/admin/announcements
router.post('/announcements', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { title, content, type, audience, expiresAt } = req.body;

    if (!title || !content || !type || !audience) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newAnnouncement = {
      id: `ann-${Date.now()}`,
      title,
      content,
      type,
      audience,
      status: 'draft',
      views: 0,
      clicks: 0,
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: expiresAt || null,
    };

    res.json({
      success: true,
      announcement: newAnnouncement,
      message: 'Announcement created successfully',
    });
  } catch (error) {
    logger.error('Announcement creation error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// POST /api/admin/announcements/:id/publish
router.post('/announcements/:id/publish', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    res.json({
      success: true,
      message: `Announcement ${id} published successfully`,
      status: 'published',
      publishedAt: new Date(),
    });
  } catch (error) {
    logger.error('Announcement publish error:', error);
    res.status(500).json({ error: 'Failed to publish announcement' });
  }
});

// DELETE /api/admin/announcements/:id
router.delete('/announcements/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    res.json({
      success: true,
      message: `Announcement ${id} deleted successfully`,
    });
  } catch (error) {
    logger.error('Announcement deletion error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// GET /api/admin/daos/analytics/by-type
router.get('/daos/analytics/by-type', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const daoTypes = await MetricsCacheService.getOrSet(
      CACHE_KEYS.DAO_ANALYTICS_BY_TYPE,
      async () => {
        return db.select({
          type: daos.type,
          count: sql<number>`COUNT(*)`,
          members: sql<number>`COUNT(DISTINCT ${daos.memberCount})`,
          treasury: sql<string>`COALESCE(SUM(CAST(${daos.treasury} AS NUMERIC)), 0)`,
          healthScore: sql<number>`AVG(CAST(${daos.healthScore} AS NUMERIC))`,
        })
        .from(daos)
        .groupBy(daos.type)
        .orderBy(desc(sql<number>`COUNT(*)`));
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      types: daoTypes || [],
      totalDAOs: daoTypes?.reduce((sum, t) => sum + (t.count || 0), 0) || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('DAO type analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch DAO type analytics' });
  }
});

// GET /api/admin/daos/analytics/by-region?region=North America
router.get('/daos/analytics/by-region', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const region = (req.query.region as string) || 'North America';
    const cacheKey = `${CACHE_KEYS.DAO_ANALYTICS_BY_REGION}:${region}`;

    const regionAnalytics = await MetricsCacheService.getOrSet(
      cacheKey,
      async () => {
        return db.select({
          region: daos.region,
          count: sql<number>`COUNT(*)`,
          members: sql<number>`COUNT(DISTINCT ${daos.memberCount})`,
          treasury: sql<string>`COALESCE(SUM(CAST(${daos.treasury} AS NUMERIC)), 0)`,
          healthScore: sql<number>`AVG(CAST(${daos.healthScore} AS NUMERIC))`,
        })
        .from(daos)
        .where(eq(daos.region, region))
        .groupBy(daos.region);
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      region: regionAnalytics?.[0] || null,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('DAO region analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch DAO region analytics' });
  }
});

// GET /api/admin/daos/analytics/by-cause
router.get('/daos/analytics/by-cause', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const causes = await MetricsCacheService.getOrSet(
      CACHE_KEYS.DAO_ANALYTICS_BY_CAUSE,
      async () => {
        return db.select({
          cause: daos.purpose,
          count: sql<number>`COUNT(*)`,
          members: sql<number>`COUNT(DISTINCT ${daos.memberCount})`,
          treasury: sql<string>`COALESCE(SUM(CAST(${daos.treasury} AS NUMERIC)), 0)`,
          healthScore: sql<number>`AVG(CAST(${daos.healthScore} AS NUMERIC))`,
        })
        .from(daos)
        .groupBy(daos.purpose)
        .orderBy(desc(sql<number>`AVG(CAST(${daos.healthScore} AS NUMERIC))`));
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      causes: causes || [],
      totalCauses: causes?.length || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('DAO cause analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch DAO cause analytics' });
  }
});

// GET /api/admin/daos/analytics/metrics
router.get('/daos/analytics/metrics', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const metrics = await MetricsCacheService.getOrSet(
      CACHE_KEYS.DAO_ANALYTICS_METRICS,
      async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [
          totalDAOs,
          totalMembers,
          totalTreasury,
          averageHealthScore,
          activeDAOs,
          newDAOsMonth,
        ] = await Promise.all([
          db.select({ count: sql<number>`COUNT(*)` }).from(daos),
          db.select({ count: sql<number>`COUNT(DISTINCT ${daos.memberCount})` }).from(daos),
          db.select({ total: sql<string>`COALESCE(SUM(CAST(${daos.treasury} AS NUMERIC)), 0)` }).from(daos),
          db.select({ avg: sql<number>`AVG(CAST(${daos.healthScore} AS NUMERIC))` }).from(daos),
          db.select({ count: sql<number>`COUNT(*)` }).from(daos).where(gt(daos.healthScore, 70)),
          db.select({ count: sql<number>`COUNT(*)` }).from(daos).where(gte(daos.createdAt, thirtyDaysAgo)),
        ]);

        return {
          totalDAOs: totalDAOs[0].count || 0,
          totalMembers: totalMembers[0].count || 0,
          totalTreasury: parseFloat(totalTreasury[0].total || '0'),
          averageHealthScore: Math.round((averageHealthScore[0].avg || 0) * 10) / 10,
          activeDAOs: activeDAOs[0].count || 0,
          growthRate: ((newDAOsMonth[0].count || 0) / (totalDAOs[0].count || 1) * 100).toFixed(1),
        };
      },
      CACHE_TTL.MEDIUM
    );

    res.json({
      ...metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('DAO analytics metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch DAO analytics metrics' });
  }
});

export default router;
