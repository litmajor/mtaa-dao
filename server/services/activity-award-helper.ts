/**
 * Activity Award Helper
 * 
 * Utility functions to award activity points from various handlers
 * without needing to import full ActivityService
 */

import { logger } from '../utils/logger';

export enum ActivityAwardType {
  VOTE = 'vote',
  PROPOSAL = 'proposal',
  COMMENT = 'comment',
  LIKE = 'like',
  MEETING = 'meeting',
  TASK = 'task',
  INVITE = 'invite',
}

interface AwardActivityParams {
  userId: string;
  daoId: string;
  type: ActivityAwardType;
  description: string;
  metadata?: Record<string, any>;
  points?: number;
}

/**
 * Award activity points to a user
 * This is a convenience wrapper that calls the activity API
 */
export async function awardActivity({
  userId,
  daoId,
  type,
  description,
  metadata,
  points,
}: AwardActivityParams): Promise<boolean> {
  try {
    // Call the internal API endpoint
    const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/governance/${daoId}/activity/award`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || ''}`,
      },
      body: JSON.stringify({
        userId,
        type,
        description,
        metadata,
        ...(points && { points }),
      }),
    });

    if (!response.ok) {
      logger.warn('Failed to award activity points', {
        userId,
        daoId,
        type,
        status: response.status,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error awarding activity points:', error, {
      userId,
      daoId,
      type,
    });
    return false;
  }
}

/**
 * Award activity points synchronously using database insert
 * This is more reliable for critical paths
 */
export async function awardActivityDirect(
  params: AwardActivityParams
): Promise<string | null> {
  try {
    const dbModule = await import('../db');
    const { db } = dbModule;
    const { v4: uuid } = await import('uuid');
    const { sql } = await import('drizzle-orm');

    const activityId = uuid();
    const now = new Date();

    // Determine points based on type if not provided
    const pointMap: Record<ActivityAwardType, number> = {
      [ActivityAwardType.VOTE]: 5,
      [ActivityAwardType.PROPOSAL]: 15,
      [ActivityAwardType.COMMENT]: 3,
      [ActivityAwardType.LIKE]: 1,
      [ActivityAwardType.MEETING]: 10,
      [ActivityAwardType.TASK]: 20,
      [ActivityAwardType.INVITE]: 10,
    };

    const points = params.points || pointMap[params.type];

    // Insert into activity log
    await db.execute(sql`
      INSERT INTO governance_activity_log (id, user_id, dao_id, type, points, description, metadata, created_at)
      VALUES (${activityId}, ${params.userId}, ${params.daoId}, ${params.type}, ${points}, ${params.description}, ${JSON.stringify(params.metadata || {})}, ${now})
      ON CONFLICT DO NOTHING
    `);

    logger.debug('Activity awarded directly', {
      activityId,
      userId: params.userId,
      daoId: params.daoId,
      type: params.type,
      points,
    });

    return activityId;
  } catch (error) {
    logger.error('Error awarding activity directly:', error, {
      userId: params.userId,
      type: params.type,
    });
    return null;
  }
}

/**
 * Check if user is eligible for promotion after awarding activity
 */
export async function checkPromotionEligibility(
  userId: string,
  daoId: string
): Promise<{
  isEligible: boolean;
  nextRole?: string;
  message?: string;
}> {
  try {
    const response = await fetch(
      `http://localhost:${process.env.PORT || 3000}/api/governance/${daoId}/promotion/eligibility`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || ''}`,
        },
      }
    );

    if (!response.ok) {
      return { isEligible: false };
    }

    const data = await response.json();
    return {
      isEligible: data.eligibility?.isEligible || false,
      nextRole: data.eligibility?.nextRole,
      message: data.eligibility?.isEligible
        ? `Eligible for promotion to ${data.eligibility.nextRole}`
        : undefined,
    };
  } catch (error) {
    logger.error('Error checking promotion eligibility:', error);
    return { isEligible: false };
  }
}

export default {
  awardActivity,
  awardActivityDirect,
  checkPromotionEligibility,
  ActivityAwardType,
};
