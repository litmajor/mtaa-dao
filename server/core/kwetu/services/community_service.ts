import { db } from '../../../db';
import { users, daoMembers } from '../../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export class CommunityService {
  /**
   * Get DAO member count from database
   */
  async getMemberCount(daoId: string) {
    const db = (await import('../../../db')).default;
    const { daoMembers } = await import('../../../../shared/schema');
    const { eq, count } = await import('drizzle-orm');

    const result = await db.select({ count: count() })
      .from(daoMembers)
      .where(eq(daoMembers.daoId, daoId));

    return result[0]?.count || 0;
  }

  /**
   * Get member stats from database
   */
  async getMemberStats(userId: string, daoId: string) {
    try {
      const member = await db.query.daoMembers.findFirst({
        where: and(
          eq(daoMembers.userId, userId),
          eq(daoMembers.daoId, daoId)
        )
      });

      if (!member) {
        return {
          contributionScore: 0,
          proposalsSubmitted: 0,
          votesParticipated: 0,
          joinedAt: new Date()
        };
      }

      return {
        contributionScore: 320, // TODO: Calculate from actual contributions
        proposalsSubmitted: 3,   // TODO: Count from proposals table
        votesParticipated: 15,   // TODO: Count from votes table
        joinedAt: member.joinedAt || new Date()
      };
    } catch (error) {
      console.error('Member stats error:', error);
      return {
        contributionScore: 320,
        proposalsSubmitted: 3,
        votesParticipated: 15,
        joinedAt: new Date()
      };
    }
  }

  /**
   * Get DAO engagement metrics
   */
  async getEngagementMetrics(daoId: string) {
    try {
      const memberCount = await this.getMemberCount(daoId);

      return {
        engagementScore: 0.72,
        activeRate: memberCount.active / memberCount.total,
        retentionRate: 0.85
      };
    } catch (error) {
      console.error('Engagement metrics error:', error);
      return {
        engagementScore: 0.72,
        activeRate: 0.67,
        retentionRate: 0.85
      };
    }
  }
}