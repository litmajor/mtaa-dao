import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export enum ActivityType {
  VOTE = 'vote',
  PROPOSAL = 'proposal',
  COMMENT = 'comment',
  MEETING = 'meeting',
  TASK = 'task',
  INVITE = 'invite',
}

export interface ActivityRecord {
  id: string;
  userId: string;
  daoId: string;
  type: ActivityType;
  points: number;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ActivityStats {
  totalPoints: number;
  daysActive: number;
  lastActivityDate: Date | null;
  activityBreakdown: Record<ActivityType, { count: number; points: number }>;
  averagePointsPerDay: number;
}

/**
 * ActivityService - Manages activity tracking and point calculations
 *
 * Features:
 * - Award points for various actions (votes, proposals, comments, etc.)
 * - Calculate user activity statistics
 * - Handle point decay (monthly/yearly)
 * - Track activity history
 * - Support custom point values
 *
 * Activity Types & Default Points:
 * - VOTE: 5 points
 * - PROPOSAL: 15 points
 * - COMMENT: 3 points
 * - MEETING: 10 points
 * - TASK: 20 points
 * - INVITE: 10 points (when invitee joins)
 */

const ACTIVITY_POINTS: Record<ActivityType, number> = {
  [ActivityType.VOTE]: 5,
  [ActivityType.PROPOSAL]: 15,
  [ActivityType.COMMENT]: 3,
  [ActivityType.MEETING]: 10,
  [ActivityType.TASK]: 20,
  [ActivityType.INVITE]: 10,
};

export class ActivityService {
  /**
   * Award points for a user action
   */
  static async awardPoints(
    userId: string,
    daoId: string,
    type: ActivityType,
    description: string,
    customPoints?: number,
    metadata?: Record<string, any>
  ): Promise<ActivityRecord> {
    const points = customPoints ?? ACTIVITY_POINTS[type];
    const activityId = uuid();
    const activity: ActivityRecord = {
      id: activityId,
      userId,
      daoId,
      type,
      points,
      description,
      metadata,
      createdAt: new Date(),
    };

    try {
      // Store in database using Drizzle ORM
      await db.execute(sql`
        INSERT INTO user_activities (
          id, user_id, dao_id, activity_type, points,
          description, metadata, created_at
        ) VALUES (
          ${activityId},
          ${userId},
          ${daoId},
          ${type},
          ${points},
          ${description},
          ${JSON.stringify(metadata || {})},
          ${activity.createdAt}
        )
      `);

      // Update user's total points
      await db.execute(sql`
        UPDATE user_stats
        SET total_points = total_points + ${points},
            last_activity_date = ${activity.createdAt}
        WHERE user_id = ${userId} AND dao_id = ${daoId}
      `);
    } catch (error) {
      console.error('Error awarding points:', error);
      throw error;
    }

    return activity;
  }

  /**
   * Get user activity history for a DAO
   */
  static async getActivityHistory(
    userId: string,
    daoId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ActivityRecord[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          id, user_id, dao_id, activity_type,
          points, description, metadata, created_at
        FROM user_activities
        WHERE user_id = ${userId} AND dao_id = ${daoId}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      return (result.rows || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        daoId: row.dao_id,
        type: row.activity_type as ActivityType,
        points: row.points,
        description: row.description,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('Error fetching activity history:', error);
      return [];
    }
  }

  /**
   * Calculate activity statistics for a user
   */
  static async calculateStats(userId: string, daoId: string): Promise<ActivityStats> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COALESCE(total_points, 0) as total_points,
          COALESCE(days_active, 0) as days_active,
          last_activity_date
        FROM user_stats
        WHERE user_id = ${userId} AND dao_id = ${daoId}
      `);

      const stats = result.rows?.[0];
      const totalPoints = parseInt((stats?.total_points || 0).toString());
      const daysActive = parseInt((stats?.days_active || 0).toString());
      const lastActivityDate = stats?.last_activity_date 
        ? new Date(stats.last_activity_date as string | number) 
        : null;

      // Get breakdown by activity type
      const breakdownResult = await db.execute(sql`
        SELECT activity_type, COUNT(*) as count, SUM(points) as points
        FROM user_activities
        WHERE user_id = ${userId} AND dao_id = ${daoId}
        GROUP BY activity_type
      `);

      const activityBreakdown: Record<ActivityType, { count: number; points: number }> = {} as any;
      for (const type of Object.values(ActivityType)) {
        activityBreakdown[type] = { count: 0, points: 0 };
      }

      (breakdownResult.rows || []).forEach((row: any) => {
        activityBreakdown[row.activity_type as ActivityType] = {
          count: parseInt(row.count.toString()),
          points: parseInt(row.points.toString()) || 0,
        };
      });

      const averagePointsPerDay = daysActive > 0 ? totalPoints / daysActive : 0;

      return {
        totalPoints,
        daysActive,
        lastActivityDate,
        activityBreakdown,
        averagePointsPerDay,
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      const activityBreakdown: Record<ActivityType, { count: number; points: number }> = {} as any;
      for (const type of Object.values(ActivityType)) {
        activityBreakdown[type] = { count: 0, points: 0 };
      }
      return {
        totalPoints: 0,
        daysActive: 0,
        lastActivityDate: null,
        activityBreakdown,
        averagePointsPerDay: 0,
      };
    }
  }

  /**
   * Calculate total points with decay
   * Points decay over time:
   * - Monthly: 0.9x multiplier (10% decay)
   * - Yearly: 0.5x multiplier (50% decay)
   */
  static async calculatePointsWithDecay(userId: string, daoId: string): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT
          ua.points,
          ua.created_at,
          CASE
            WHEN ua.created_at >= NOW() - INTERVAL '1 month' THEN ua.points
            WHEN ua.created_at >= NOW() - INTERVAL '1 year' THEN ua.points * 0.9
            ELSE ua.points * 0.5
          END as decayed_points
        FROM user_activities ua
        WHERE ua.user_id = ${userId} AND ua.dao_id = ${daoId}
      `);

      return (result.rows || []).reduce((total: number, row: any) => {
        return total + parseFloat(row.decayed_points || 0);
      }, 0);
    } catch (error) {
      console.error('Error calculating decayed points:', error);
      return 0;
    }
  }

  /**
   * Get leaderboard for a DAO
   */
  static async getLeaderboard(
    daoId: string,
    limit: number = 10
  ): Promise<Array<{ userId: string; displayName: string; points: number; daysActive: number }>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          us.user_id,
          u.display_name,
          us.total_points,
          us.days_active
        FROM user_stats us
        JOIN users u ON us.user_id = u.id
        WHERE us.dao_id = ${daoId}
        ORDER BY us.total_points DESC
        LIMIT ${limit}
      `);

      return (result.rows || []).map((row: any) => ({
        userId: row.user_id,
        displayName: row.display_name || 'Anonymous',
        points: row.total_points || 0,
        daysActive: row.days_active || 0,
      }));
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }

  /**
   * Check if activity should expire
   * Default expiration: 90 days
   */
  static async expireOldActivity(daoId: string, daysOld: number = 90): Promise<number> {
    try {
      // Mark old activities as expired instead of deleting
      const result = await db.execute(sql`
        UPDATE user_activities
        SET expires_at = NOW()
        WHERE dao_id = ${daoId}
          AND expires_at IS NULL
          AND created_at < NOW() - INTERVAL '${daysOld} days'
      `);

      // Return count of expired records
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error expiring old activities:', error);
      return 0;
    }
  }

  /**
   * Reset activity for a user (admin only)
   */
  static async resetActivity(userId: string, daoId: string): Promise<void> {
    try {
      // Delete activity records
      await db.execute(sql`
        DELETE FROM user_activities
        WHERE user_id = ${userId} AND dao_id = ${daoId}
      `);

      // Reset user stats
      await db.execute(sql`
        UPDATE user_stats
        SET total_points = 0, days_active = 0, last_activity_date = NULL
        WHERE user_id = ${userId} AND dao_id = ${daoId}
      `);
    } catch (error) {
      console.error('Error resetting activity:', error);
      throw error;
    }
  }

  /**
   * Bulk award points
   */
  static async bulkAwardPoints(
    activities: Array<{
      userId: string;
      daoId: string;
      type: ActivityType;
      description: string;
      points?: number;
      metadata?: Record<string, any>;
    }>
  ): Promise<ActivityRecord[]> {
    const results: ActivityRecord[] = [];

    for (const activity of activities) {
      const record = await this.awardPoints(
        activity.userId,
        activity.daoId,
        activity.type,
        activity.description,
        activity.points,
        activity.metadata
      );
      results.push(record);
    }

    return results;
  }
}

export default ActivityService;
