import { Router } from 'express';
import type { Request, Response } from 'express';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import {
  contributions,
  daoAnalytics,
  daos,
  platformAnnouncements,
  referralRewards,
  rewardDistribution,
  tasks,
} from '../../../shared/schema';
import { achievements, userAchievements } from '../../../shared/achievementSchema';
import { requireRole } from '../../middleware/rbac';
import { cacheManager } from '../../core/consolidation/DataCacheConsolidation';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');
const communityCache = cacheManager.registerCache({
  name: 'admin_community',
  level: 'memory',
  ttl: 10 * 60 * 1000,
  invalidationStrategy: 'ttl',
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const achievementInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  difficulty: z.string().trim().min(1).max(50),
  points: z.coerce.number().int().min(0).max(1_000_000),
  category: z.string().trim().min(1).max(100).default('general'),
});

const taskInputSchema = z.object({
  daoId: z.string().min(1),
  creatorId: z.string().min(1),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(5000),
  type: z.string().trim().min(1).max(100),
  difficulty: z.string().trim().min(1).max(50),
  reward: z.coerce.number().min(0).max(1_000_000),
});

const announcementInputSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(10000),
  type: z.string().trim().min(1).max(50).default('info'),
  audience: z.string().trim().min(1).max(50).default('all'),
  expiresAt: z.coerce.date().nullable().optional(),
});

async function getCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = await communityCache.get(key);
  if (cached !== null) return cached as T;
  const value = await loader();
  await communityCache.set(key, value);
  return value;
}

function invalidateCommunityCache(): void {
  void communityCache.clear().catch(error => logger.warn('Community cache invalidation failed:', error));
}

router.get('/referrals/metrics', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [total, todayTotal, referrers, rewards] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(referralRewards),
      db.select({ count: sql<number>`count(*)` }).from(referralRewards).where(gte(referralRewards.createdAt, today)),
      db.select({ count: sql<number>`count(distinct ${referralRewards.referrerId})` }).from(referralRewards),
      db.select({ total: sql<string>`coalesce(sum(cast(${referralRewards.rewardAmount} as numeric)), 0)` }).from(referralRewards),
    ]);
    const totalReferrals = Number(total[0]?.count || 0);
    const activeReferrers = Number(referrers[0]?.count || 0);
    res.json({
      newReferrals: Number(todayTotal[0]?.count || 0),
      activeReferrers,
      conversionRate: activeReferrers ? Math.round((totalReferrals / activeReferrers) * 100) / 100 : 0,
      totalReferrals,
      totalRewardsDistributed: Number(rewards[0]?.total || 0),
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Referral metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch referral metrics' });
  }
});

router.get('/referrals/top-referrers', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const topReferrers = await db.select({
      id: referralRewards.referrerId,
      referrals: sql<number>`count(*)`,
      totalEarnings: sql<string>`coalesce(sum(cast(${referralRewards.rewardAmount} as numeric)), 0)`,
    }).from(referralRewards)
      .groupBy(referralRewards.referrerId)
      .orderBy(desc(sql`sum(cast(${referralRewards.rewardAmount} as numeric))`))
      .limit(20);
    res.json({ topReferrers, timestamp: new Date() });
  } catch (error) {
    logger.error('Top referrers error:', error);
    res.status(500).json({ error: 'Failed to fetch top referrers' });
  }
});

router.get('/referrals/sources', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const referralData = await db.select({
      source: referralRewards.rewardType,
      referrals: sql<number>`count(*)`,
      revenue: sql<string>`coalesce(sum(cast(${referralRewards.rewardAmount} as numeric)), 0)`,
    }).from(referralRewards)
      .groupBy(referralRewards.rewardType)
      .orderBy(desc(sql`count(*)`));
    res.json({
      sources: referralData.map(item => ({ ...item, revenue: Number(item.revenue || 0), conversionRate: 0 })),
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Referral sources error:', error);
    res.status(500).json({ error: 'Failed to fetch referral sources' });
  }
});

router.get('/leaderboard/members', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : 'overall';
    const since = type === 'weekly' ? new Date(Date.now() - 7 * 86400000) : type === 'monthly' ? new Date(Date.now() - 30 * 86400000) : null;
    const members = await db.select({
      userId: contributions.userId,
      rank: sql<number>`row_number() over (order by count(*) desc)`,
      score: sql<number>`count(*) * 100`,
      contributions: sql<number>`count(*)`,
    }).from(contributions)
      .where(since ? gte(contributions.createdAt, since) : undefined)
      .groupBy(contributions.userId)
      .orderBy(desc(sql`count(*)`))
      .limit(20);
    res.json({ type, members, podium: members.slice(0, 3), timestamp: new Date() });
  } catch (error) {
    logger.error('Leaderboard members error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard members' });
  }
});

router.get('/leaderboard/achievements', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select({
      id: achievements.id,
      name: achievements.name,
      description: achievements.description,
      earnedCount: sql<number>`count(${userAchievements.id})`,
    }).from(achievements)
      .leftJoin(userAchievements, eq(userAchievements.achievementId, achievements.id))
      .groupBy(achievements.id, achievements.name, achievements.description)
      .orderBy(desc(sql`count(${userAchievements.id})`));
    res.json({ achievements: rows, totalEarned: rows.reduce((sum, row) => sum + Number(row.earnedCount || 0), 0), totalAchievements: rows.length, timestamp: new Date() });
  } catch (error) {
    logger.error('Achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

router.get('/rewards/metrics', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const metrics = await getCached('rewards:metrics', async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const [all, week, count] = await Promise.all([
        db.select({ total: sql<string>`coalesce(sum(cast(${rewardDistribution.amount} as numeric)), 0)` }).from(rewardDistribution),
        db.select({ total: sql<string>`coalesce(sum(cast(${rewardDistribution.amount} as numeric)), 0)` }).from(rewardDistribution).where(gte(rewardDistribution.distributionDate, weekAgo)),
        db.select({ count: sql<number>`count(*)` }).from(rewardDistribution),
      ]);
      const totalDistributed = Number(all[0]?.total || 0);
      return { totalDistributed, thisWeekAmount: Number(week[0]?.total || 0), averageReward: Number(count[0]?.count || 0) ? totalDistributed / Number(count[0].count) : 0 };
    });
    res.json({ ...metrics, timestamp: new Date() });
  } catch (error) {
    logger.error('Rewards metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch rewards metrics' });
  }
});

router.get('/rewards/tiers', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const tiers = await getCached('rewards:tiers', async () => {
      const rows = await db.select({ tier: rewardDistribution.status, members: sql<number>`count(*)`, totalAmount: sql<string>`coalesce(sum(cast(${rewardDistribution.amount} as numeric)), 0)` }).from(rewardDistribution).groupBy(rewardDistribution.status);
      const total = rows.reduce((sum, row) => sum + Number(row.members || 0), 0);
      return rows.map(row => ({ tier: row.tier, members: Number(row.members || 0), percentage: total ? ((Number(row.members || 0) / total) * 100).toFixed(1) : '0.0', totalAmount: Number(row.totalAmount || 0) }));
    });
    res.json({ tiers, totalMembers: tiers.reduce((sum, tier) => sum + tier.members, 0), timestamp: new Date() });
  } catch (error) {
    logger.error('Reward tiers error:', error);
    res.status(500).json({ error: 'Failed to fetch reward tiers' });
  }
});

router.get('/rewards/users', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await getCached('rewards:users', () => db.select({
      userId: rewardDistribution.recipientId,
      totalEarned: sql<string>`coalesce(sum(cast(${rewardDistribution.amount} as numeric)), 0)`,
      tier: rewardDistribution.status,
      lastDistributedAt: rewardDistribution.distributionDate,
    }).from(rewardDistribution).groupBy(rewardDistribution.recipientId, rewardDistribution.status, rewardDistribution.distributionDate).orderBy(desc(sql`sum(cast(${rewardDistribution.amount} as numeric))`)).limit(100));
    res.json({ users, distribution: { claimed: users.filter(user => user.tier === 'claimed').length, pending: users.filter(user => user.tier === 'pending').length, locked: users.filter(user => users.length > 0 && user.tier === 'locked').length }, timestamp: new Date() });
  } catch (error) {
    logger.error('User rewards error:', error);
    res.status(500).json({ error: 'Failed to fetch user rewards' });
  }
});

router.get('/achievements', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await getCached('achievements:list', () => db.select({ id: achievements.id, name: achievements.name, description: achievements.description, points: achievements.rewardPoints, earnedCount: sql<number>`count(${userAchievements.id})` }).from(achievements).leftJoin(userAchievements, eq(userAchievements.achievementId, achievements.id)).groupBy(achievements.id, achievements.name, achievements.description, achievements.rewardPoints).orderBy(desc(achievements.name)));
    res.json({ achievements: rows, total: rows.length, timestamp: new Date() });
  } catch (error) {
    logger.error('Achievements list error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

router.post('/achievements', requireSuperAdmin, async (req: Request, res: Response) => {
  const parsed = achievementInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid achievement payload', details: parsed.error.flatten() });
  try {
    const [achievement] = await db.insert(achievements).values({ name: parsed.data.name, description: parsed.data.description || null, category: parsed.data.category, criteria: JSON.stringify({ difficulty: parsed.data.difficulty }), rewardPoints: parsed.data.points }).returning();
    invalidateCommunityCache();
    res.status(201).json({ success: true, achievement, message: 'Achievement created successfully' });
  } catch (error) {
    logger.error('Achievement creation error:', error);
    res.status(500).json({ error: 'Failed to create achievement' });
  }
});

router.get('/achievements/metrics', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const [achievementCount, taskCount, activeUsers, points] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(achievements),
      db.select({ count: sql<number>`count(*)` }).from(tasks),
      db.select({ count: sql<number>`count(distinct ${userAchievements.userId})` }).from(userAchievements),
      db.select({ total: sql<number>`coalesce(sum(${achievements.rewardPoints}), 0)` }).from(achievements),
    ]);
    res.json({ totalAchievements: Number(achievementCount[0]?.count || 0), totalTasks: Number(taskCount[0]?.count || 0), activeUsers: Number(activeUsers[0]?.count || 0), totalPointsAwarded: Number(points[0]?.total || 0), timestamp: new Date() });
  } catch (error) {
    logger.error('Achievements metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements metrics' });
  }
});

router.get('/tasks', requireSuperAdmin, async (req: Request, res: Response) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid pagination' });
  try {
    const { page, limit } = parsed.data;
    const rows = await getCached('tasks:list', () => db.select({ id: tasks.id, name: tasks.title, type: tasks.category, description: tasks.description, reward: tasks.reward, completionCount: sql<number>`0`, status: tasks.status }).from(tasks).orderBy(desc(tasks.createdAt)).limit(limit).offset((page - 1) * limit));
    res.json({ tasks: rows, total: rows.length, activeCount: rows.filter(task => task.status === 'open').length, timestamp: new Date() });
  } catch (error) {
    logger.error('Tasks list error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/tasks', requireSuperAdmin, async (req: Request, res: Response) => {
  const parsed = taskInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid task payload', details: parsed.error.flatten() });
  try {
    const [task] = await db.insert(tasks).values({ daoId: parsed.data.daoId, creatorId: parsed.data.creatorId, title: parsed.data.name, description: parsed.data.description, category: parsed.data.type, difficulty: parsed.data.difficulty, reward: String(parsed.data.reward), status: 'open' }).returning();
    invalidateCommunityCache();
    res.status(201).json({ success: true, task, message: 'Task created successfully' });
  } catch (error) {
    logger.error('Task creation error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.get('/announcements', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await getCached('announcements:list', () => db.select({ id: platformAnnouncements.id, title: platformAnnouncements.title, content: platformAnnouncements.message, type: platformAnnouncements.type, audience: platformAnnouncements.targetAudience, status: platformAnnouncements.isActive, createdAt: platformAnnouncements.createdAt, expiresAt: platformAnnouncements.expiresAt }).from(platformAnnouncements).orderBy(desc(platformAnnouncements.createdAt)));
    res.json({ announcements: rows, published: rows.filter(row => row.status), draft: rows.filter(row => !row.status), timestamp: new Date() });
  } catch (error) {
    logger.error('Announcements list error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/announcements', requireSuperAdmin, async (req: Request, res: Response) => {
  const parsed = announcementInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid announcement payload', details: parsed.error.flatten() });
  try {
    const [announcement] = await db.insert(platformAnnouncements).values({ title: parsed.data.title, message: parsed.data.content, type: parsed.data.type, targetAudience: parsed.data.audience, expiresAt: parsed.data.expiresAt || null, isActive: false }).returning();
    invalidateCommunityCache();
    res.status(201).json({ success: true, announcement, message: 'Announcement created successfully' });
  } catch (error) {
    logger.error('Announcement creation error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.post('/announcements/:id/publish', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const [updated] = await db.update(platformAnnouncements).set({ isActive: true, startsAt: new Date(), updatedAt: new Date() }).where(eq(platformAnnouncements.id, req.params.id)).returning();
    if (!updated) return res.status(404).json({ error: 'Announcement not found' });
    invalidateCommunityCache();
    res.json({ success: true, message: `Announcement ${req.params.id} published successfully`, status: 'published', publishedAt: updated.startsAt });
  } catch (error) {
    logger.error('Announcement publish error:', error);
    res.status(500).json({ error: 'Failed to publish announcement' });
  }
});

router.delete('/announcements/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = await db.delete(platformAnnouncements).where(eq(platformAnnouncements.id, req.params.id)).returning({ id: platformAnnouncements.id });
    if (!deleted.length) return res.status(404).json({ error: 'Announcement not found' });
    invalidateCommunityCache();
    res.json({ success: true, message: `Announcement ${req.params.id} deleted successfully` });
  } catch (error) {
    logger.error('Announcement deletion error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

router.get('/daos/analytics/by-type', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const types = await getCached('dao-analytics:type', () => db.select({ type: daoAnalytics.daoType, count: sql<number>`count(*)`, members: sql<number>`sum(${daoAnalytics.totalMembers})`, treasury: sql<string>`coalesce(sum(${daoAnalytics.treasuryBalance}), 0)`, healthScore: sql<number>`avg(${daoAnalytics.averageParticipation})` }).from(daoAnalytics).groupBy(daoAnalytics.daoType).orderBy(desc(sql`count(*)`)));
    res.json({ types, totalDAOs: types.reduce((sum, type) => sum + Number(type.count || 0), 0), timestamp: new Date() });
  } catch (error) {
    logger.error('DAO type analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch DAO type analytics' });
  }
});

router.get('/daos/analytics/by-region', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const region = typeof req.query.region === 'string' ? req.query.region : 'North America';
    const [result] = await db.select({ region: daoAnalytics.region, count: sql<number>`count(*)`, members: sql<number>`sum(${daoAnalytics.totalMembers})`, treasury: sql<string>`coalesce(sum(${daoAnalytics.treasuryBalance}), 0)`, healthScore: sql<number>`avg(${daoAnalytics.averageParticipation})` }).from(daoAnalytics).where(eq(daoAnalytics.region, region)).groupBy(daoAnalytics.region);
    res.json({ region: result || null, timestamp: new Date() });
  } catch (error) {
    logger.error('DAO region analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch DAO region analytics' });
  }
});

router.get('/daos/analytics/by-cause', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const causes = await db.select({ cause: daoAnalytics.causeCategory, count: sql<number>`count(*)`, members: sql<number>`sum(${daoAnalytics.totalMembers})`, treasury: sql<string>`coalesce(sum(${daoAnalytics.treasuryBalance}), 0)`, healthScore: sql<number>`avg(${daoAnalytics.averageParticipation})` }).from(daoAnalytics).groupBy(daoAnalytics.causeCategory).orderBy(desc(sql`avg(${daoAnalytics.averageParticipation})`));
    res.json({ causes, totalCauses: causes.length, timestamp: new Date() });
  } catch (error) {
    logger.error('DAO cause analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch DAO cause analytics' });
  }
});

router.get('/daos/analytics/metrics', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const [totalDAOs, members, treasury, health, active, recent] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(daos),
      db.select({ total: sql<number>`coalesce(sum(${daoAnalytics.totalMembers}), 0)` }).from(daoAnalytics),
      db.select({ total: sql<string>`coalesce(sum(${daoAnalytics.treasuryBalance}), 0)` }).from(daoAnalytics),
      db.select({ avg: sql<number>`coalesce(avg(${daoAnalytics.averageParticipation}), 0)` }).from(daoAnalytics),
      db.select({ count: sql<number>`count(*)` }).from(daos).where(eq(daos.status, 'active')),
      db.select({ count: sql<number>`count(*)` }).from(daos).where(gte(daos.createdAt, new Date(Date.now() - 30 * 86400000))),
    ]);
    const total = Number(totalDAOs[0]?.count || 0);
    res.json({ totalDAOs: total, totalMembers: Number(members[0]?.total || 0), totalTreasury: Number(treasury[0]?.total || 0), averageHealthScore: Number(health[0]?.avg || 0), activeDAOs: Number(active[0]?.count || 0), growthRate: `${((Number(recent[0]?.count || 0) / Math.max(total, 1)) * 100).toFixed(1)}`, timestamp: new Date() });
  } catch (error) {
    logger.error('DAO analytics metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch DAO analytics metrics' });
  }
});

export default router;
