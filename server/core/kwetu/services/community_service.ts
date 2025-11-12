import { db } from '../../../db';
import { users, daoMemberships, proposals, votes, userActivities } from '../../../../shared/schema';
import { eq, and, sql, gte, inArray } from 'drizzle-orm';

export class CommunityService {
  /**
   * Get DAO member count from database
   */
  async getMemberCount(daoId: string): Promise<number> {
    const result = await db.select({ count: sql`count(*)` })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));
    return Number(result[0]?.count || 0);
  }

  /**
   * Get member stats from database
   */
  async getMemberStats(userId: string, daoId: string) {
    const member = await db.select()
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId)
      ))
      .limit(1);

    if (member.length === 0) {
      throw new Error(`Membership not found for user ${userId} in DAO ${daoId}`);
    }

    const joinedAt = member[0].joinedAt || new Date();

    // Calculate contribution score: number of contributions * 100 (arbitrary weighting)
    const contributions = await db.select({ count: sql`count(*)` })
      .from(userActivities)
      .where(and(
        eq(userActivities.userId, userId),
        eq(userActivities.dao_id, daoId),
        eq(userActivities.type, 'contribution')
      ));
    const contributionCount = Number(contributions[0]?.count || 0);
    const contributionScore = contributionCount * 100;

    // Proposals submitted: count proposals where proposerId = userId
    const submittedProposals = await db.select({ count: sql`count(*)` })
      .from(proposals)
      .where(and(
        eq(proposals.daoId, daoId),
        eq(proposals.proposerId, userId)
      ));
    const proposalsSubmitted = Number(submittedProposals[0]?.count || 0);

    // Fetch user info
    const userInfo = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    // Votes participated: count votes where userId = voterId (assuming votes.userId)
    const participatedVotes = await db.select({ count: sql`count(*)` })
      .from(votes)
      .where(and(
        eq(votes.daoId, daoId),
        eq(votes.userId, userId)
      ));
    const votesParticipated = Number(participatedVotes[0]?.count || 0);

    return {
      contributionScore,
      proposalsSubmitted,
      votesParticipated,
      joinedAt,
      user: userInfo[0] || null
    };
  }

  /**
   * Get DAO engagement metrics
   */
  async getEngagementMetrics(daoId: string) {
    const totalMembers = await this.getMemberCount(daoId);

    // Calculate active members: unique users with activity in last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // Get all member userIds
    const members = await db.select({ userId: daoMemberships.userId })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));
    const userIds = members.map(m => m.userId);

    let activeMembers = 0;
    if (userIds.length > 0) {
      const actives = await db.selectDistinct({ userId: userActivities.userId })
        .from(userActivities)
        .where(and(
          inArray(userActivities.userId, userIds),
          eq(userActivities.dao_id, daoId),
          gte(userActivities.createdAt, since)
        ));
      activeMembers = actives.length;
    }

    const activeRate = totalMembers > 0 ? activeMembers / totalMembers : 0;
    const engagementScore = activeRate; // Proxy

    // Retention rate: active this period / active prior period
    let retentionRate = 0.85; // Default/fallback
    const priorSince = new Date(since);
    priorSince.setDate(priorSince.getDate() - 30);

    const priorActives = await db.selectDistinct({ userId: userActivities.userId })
      .from(userActivities)
      .where(and(
        inArray(userActivities.userId, userIds),
        eq(userActivities.dao_id, daoId),
        gte(userActivities.createdAt, priorSince),
        sql`${userActivities.createdAt} < ${since}`
      ));
    const priorActiveCount = priorActives.length;

    if (priorActiveCount > 0) {
      const returning = await db.selectDistinct({ userId: userActivities.userId })
        .from(userActivities)
        .where(and(
          inArray(userActivities.userId, priorActives.map(a => a.userId)),
          eq(userActivities.dao_id, daoId),
          gte(userActivities.createdAt, since)
        ));
      retentionRate = returning.length / priorActiveCount;
    }

    return {
      engagementScore,
      activeRate,
      retentionRate
    };
  }
}