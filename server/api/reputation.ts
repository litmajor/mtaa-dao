
import { Request, Response } from 'express';
import { db } from '../db';
import { users, userActivities, proposals, tasks } from '../../shared/schema';
import { userActivitiesDaoId } from '../../shared/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const logger = new Logger('reputation-api');

export async function getUserReputationHandler(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    // Get user's reputation score and activities
      const userResult = await db
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

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult[0];

    // Get recent activities for reputation calculation
    const activities = await db
      .select()
      .from(userActivities)
      .where(eq(userActivities.userId, userId))
      .orderBy(desc(userActivities.createdAt))
      .limit(50);

    // Calculate reputation breakdown
    const proposalActivities = activities.filter(a => a.type === 'proposal_created' || a.type === 'proposal_voted');
    const taskActivities = activities.filter(a => a.type === 'task_completed' || a.type === 'task_claimed');
    const contributionActivities = activities.filter(a => a.type === 'contribution_made');

    res.json({
      user,
      reputation: {
        total: user.reputationScore ? Number(user.reputationScore) : 0,
        breakdown: {
          proposals: proposalActivities.length * 10,
          tasks: taskActivities.length * 15,
          contributions: contributionActivities.length * 5,
        },
      },
      recentActivities: activities.slice(0, 10),
    });
  } catch (error) {
    logger.error('Failed to get user reputation', error);
    throw new AppError('Failed to retrieve user reputation', 500);
  }
}

export async function getReputationLeaderboardHandler(req: Request, res: Response) {
  try {
    const { limit = 20, timeframe = 'all' } = req.query;

    let query = db
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
      .limit(parseInt(limit as string));

    const leaderboard = await query;

    res.json({ leaderboard });
  } catch (error) {
    logger.error('Failed to get reputation leaderboard', error);
    throw new AppError('Failed to retrieve reputation leaderboard', 500);
  }
}

export async function getDaoReputationLeaderboardHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const { limit = 20 } = req.query;

    // Get users who have activities in this DAO
    const daoLeaderboard = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePicture: users.profilePicture,
        reputationScore: users.reputationScore,
        daoActivityCount: sql<number>`COUNT(${userActivities.id})`,
      })
      .from(users)
      .innerJoin(userActivities, eq(users.id, userActivities.userId))
      .where(and(
        eq(userActivitiesDaoId, daoId),
        sql`${users.reputationScore} > 0`
      ))
      .groupBy(users.id)
      .orderBy(desc(users.reputationScore))
      .limit(parseInt(limit as string));

    res.json({ leaderboard: daoLeaderboard });
  } catch (error) {
    logger.error('Failed to get DAO reputation leaderboard', error);
    throw new AppError('Failed to retrieve DAO reputation leaderboard', 500);
  }
}
