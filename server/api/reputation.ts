import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, userActivities } from '../../shared/schema';
import { eq, desc, sql, and, gte, count } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const logger = new Logger('reputation-api');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Calculates a date threshold based on timeframe string
 */
function getTimeframeCutoff(timeframe?: string): Date | null {
  const now = new Date();
  if (timeframe === '7d' || timeframe === 'weekly') {
    return new Date(now.setDate(now.getDate() - 7));
  }
  if (timeframe === '30d' || timeframe === 'monthly') {
    return new Date(now.setDate(now.getDate() - 30));
  }
  return null; // 'all'
}

/**
 * GET /api/reputation/user/:userId
 * Get user reputation score, breakdown, and recent activity history
 */
export async function getUserReputationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // 1. Get user record
    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePicture: users.profilePicture,
        reputationScore: users.reputationScore,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Fetch recent activities for display
    const recentActivities = await db
      .select()
      .from(userActivities)
      .where(eq(userActivities.userId, userId))
      .orderBy(desc(userActivities.createdAt))
      .limit(10);

    // 3. Count activity totals for accurate category breakdown
    const activityCounts = await db
      .select({
        type: userActivities.type,
        activityCount: count(userActivities.id),
      })
      .from(userActivities)
      .where(eq(userActivities.userId, userId))
      .groupBy(userActivities.type);

    const countsMap = new Map(activityCounts.map(a => [a.type, Number(a.activityCount)]));

    const proposalsCount = (countsMap.get('proposal_created') || 0) + (countsMap.get('proposal_voted') || 0);
    const tasksCount = (countsMap.get('task_completed') || 0) + (countsMap.get('task_claimed') || 0);
    const contributionsCount = countsMap.get('contribution_made') || 0;

    return res.json({
      user,
      reputation: {
        total: user.reputationScore ? Number(user.reputationScore) : 0,
        breakdown: {
          proposals: proposalsCount * 10,
          tasks: tasksCount * 15,
          contributions: contributionsCount * 5,
        },
      },
      recentActivities,
    });
  } catch (error) {
    logger.error('Failed to get user reputation', error);
    next(error);
  }
}

/**
 * GET /api/reputation/leaderboard
 * Get global reputation leaderboard with timeframe support
 */
export async function getReputationLeaderboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit: rawLimit = String(DEFAULT_LIMIT), timeframe } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(rawLimit as string, 10) || DEFAULT_LIMIT), MAX_LIMIT);
    const cutoffDate = getTimeframeCutoff(timeframe as string);

    // If a specific timeframe (7d, 30d) is specified, rank by activity score in that window
    if (cutoffDate) {
      const timeframeLeaderboard = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profilePicture: users.profilePicture,
          reputationScore: users.reputationScore,
          periodActivityCount: count(userActivities.id),
        })
        .from(users)
        .innerJoin(userActivities, eq(users.id, userActivities.userId))
        .where(gte(userActivities.createdAt, cutoffDate))
        .groupBy(
          users.id,
          users.firstName,
          users.lastName,
          users.profilePicture,
          users.reputationScore
        )
        .orderBy(desc(count(userActivities.id)))
        .limit(parsedLimit);

      return res.json({ timeframe, leaderboard: timeframeLeaderboard });
    }

    // Default 'all-time' global leaderboard
    const leaderboard = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePicture: users.profilePicture,
        reputationScore: users.reputationScore,
        rank: sql<number>`ROW_NUMBER() OVER (ORDER BY ${users.reputationScore} DESC)`,
      })
      .from(users)
      .where(sql`${users.reputationScore} > 0`)
      .orderBy(desc(users.reputationScore))
      .limit(parsedLimit);

    return res.json({ timeframe: 'all', leaderboard });
  } catch (error) {
    logger.error('Failed to get reputation leaderboard', error);
    next(error);
  }
}

/**
 * GET /api/reputation/dao/:daoId/leaderboard
 * Get DAO-specific reputation leaderboard
 */
export async function getDaoReputationLeaderboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { daoId } = req.params;
    const { limit: rawLimit = String(DEFAULT_LIMIT) } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(rawLimit as string, 10) || DEFAULT_LIMIT), MAX_LIMIT);

    if (!daoId) {
      return res.status(400).json({ error: 'DAO ID is required' });
    }

    const daoLeaderboard = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePicture: users.profilePicture,
        reputationScore: users.reputationScore,
        daoActivityCount: count(userActivities.id),
      })
      .from(users)
      .innerJoin(userActivities, eq(users.id, userActivities.userId))
      .where(
        and(
          eq(userActivities.dao_id, daoId),
          sql`${users.reputationScore} > 0`
        )
      )
      .groupBy(
        users.id,
        users.firstName,
        users.lastName,
        users.profilePicture,
        users.reputationScore
      ) // Fixed PostgreSQL strict GROUP BY requirement
      .orderBy(desc(count(userActivities.id)), desc(users.reputationScore))
      .limit(parsedLimit);

    return res.json({ daoId, leaderboard: daoLeaderboard });
  } catch (error) {
    logger.error('Failed to get DAO reputation leaderboard', error);
    next(error);
  }
}