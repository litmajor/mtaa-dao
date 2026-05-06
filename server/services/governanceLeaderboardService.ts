import { db } from '../db';
import { logger } from '../utils/logger';
import {
  users,
  referralRewards,
  contributions,
  proposals,
  votes,
  daoMemberships,
  daos,
} from '../../shared/schema';
import {
  eq,
  and,
  desc,
  sql,
  gte,
  lte,
  countDistinct,
  sum,
  count,
} from 'drizzle-orm';

/**
 * Governance Leaderboard Service
 * Handles both system-wide and DAO-specific leaderboard operations
 * Supports referrals, contributions, voting, and activity tracking
 */
export class GovernanceLeaderboardService {
  /**
   * Get system-wide referral leaderboard (global, not DAO-scoped)
   * Ranks users by total referrals across the platform
   */
  async getSystemRefferalLeaderboard(limit: number = 100, offset: number = 0): Promise<{
    leaderboard: Array<{
      rank: number;
      userId: string;
      userName?: string;
      userEmail?: string;
      totalReferrals: number;
      activeReferrals: number;
      totalRewardsEarned: number;
      lastReferralAt?: Date;
    }>;
    totalParticipants: number;
  }> {
    try {
      // Get total count of users with at least 1 referral
      const [countResult] = await db
        .select({ count: countDistinct(referralRewards.referrerId) })
        .from(referralRewards)
        .where(eq(referralRewards.status, 'awarded'));

      const totalParticipants = countResult?.count || 0;

      // Get top referrers globally
      const leaderboard = await db
        .select({
          userId: referralRewards.referrerId,
          totalReferrals: count().as('total_referrals'),
          totalRewardsEarned: sum(referralRewards.rewardAmount).as('total_rewards'),
          lastReferralAt: sql`MAX(${referralRewards.createdAt})`.as('last_referral_at'),
        })
        .from(referralRewards)
        .where(eq(referralRewards.status, 'awarded'))
        .groupBy(referralRewards.referrerId)
        .orderBy(desc(count()))
        .limit(limit)
        .offset(offset);

      // Fetch user details
      const userIds = leaderboard.map(l => l.userId);
      const userDetails = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds)})`);

      const userMap = new Map(userDetails.map(u => [u.id, u]));

      // Combine and rank
      const rankedLeaderboard = leaderboard.map((entry, index) => {
        const user = userMap.get(entry.userId);
        return {
          rank: offset + index + 1,
          userId: entry.userId,
          userName: user?.name || undefined,
          userEmail: user?.email || undefined,
          totalReferrals: entry.totalReferrals || 0,
          activeReferrals: 0, // Would need separate query to calculate
          totalRewardsEarned: entry.totalRewardsEarned ? parseFloat(entry.totalRewardsEarned.toString()) : 0,
          lastReferralAt: entry.lastReferralAt as Date | undefined,
        };
      });

      return {
        leaderboard: rankedLeaderboard,
        totalParticipants,
      };
    } catch (error) {
      logger.error('Error fetching system referral leaderboard:', error);
      return {
        leaderboard: [],
        totalParticipants: 0,
      };
    }
  }

  /**
   * Get system-wide contributors leaderboard (global, not DAO-scoped)
   * Ranks users by total contribution amount across all DAOs
   */
  async getSystemContributorsLeaderboard(limit: number = 100, offset: number = 0): Promise<{
    leaderboard: Array<{
      rank: number;
      userId: string;
      userName?: string;
      totalContributionUsd: number;
      contributionCount: number;
      averageContribution: number;
      lastContributionAt?: Date;
    }>;
    totalParticipants: number;
  }> {
    try {
      // Get total count of users with contributions
      const [countResult] = await db
        .select({ count: countDistinct(contributions.userId) })
        .from(contributions);

      const totalParticipants = countResult?.count || 0;

      // Get top contributors globally
      const leaderboard = await db
        .select({
          userId: contributions.userId,
          totalAmount: sum(contributions.amount).as('total_amount'),
          contributionCount: count().as('contribution_count'),
          lastContributionAt: sql`MAX(${contributions.createdAt})`.as('last_contribution_at'),
        })
        .from(contributions)
        .groupBy(contributions.userId)
        .orderBy(desc(sum(contributions.amount)))
        .limit(limit)
        .offset(offset);

      // Fetch user details
      const userIds = leaderboard.map(l => l.userId);
      const userDetails = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds)})`);

      const userMap = new Map(userDetails.map(u => [u.id, u]));

      // Combine and rank
      const rankedLeaderboard = leaderboard.map((entry, index) => {
        const user = userMap.get(entry.userId);
        const totalAmount = entry.totalAmount ? parseFloat(entry.totalAmount.toString()) : 0;
        const count = entry.contributionCount || 0;

        return {
          rank: offset + index + 1,
          userId: entry.userId,
          userName: user?.name || undefined,
          totalContributionUsd: totalAmount,
          contributionCount: count,
          averageContribution: count > 0 ? totalAmount / count : 0,
          lastContributionAt: entry.lastContributionAt as Date | undefined,
        };
      });

      return {
        leaderboard: rankedLeaderboard,
        totalParticipants,
      };
    } catch (error) {
      logger.error('Error fetching system contributors leaderboard:', error);
      return {
        leaderboard: [],
        totalParticipants: 0,
      };
    }
  }

  /**
   * Get consolidated system governance statistics
   * Platform-wide metrics across all DAOs
   */
  async getSystemConsolidatedStats(): Promise<{
    totalUsers: number;
    totalDAOs: number;
    totalContributions: number;
    totalContributionAmount: number;
    totalProposals: number;
    totalVotes: number;
    averageContributionSize: number;
    averageProposalsPerDAO: number;
    reportedAt: Date;
  }> {
    try {
      // Total users
      const [userCount] = await db.select({ count: count() }).from(users);

      // Total DAOs
      const [daoCount] = await db.select({ count: count() }).from(daos);

      // Total contributions
      const [contribStats] = await db
        .select({
          count: count(),
          totalAmount: sum(contributions.amount),
        })
        .from(contributions);

      // Total proposals
      const [propCount] = await db.select({ count: count() }).from(proposals);

      // Total votes
      const [voteCount] = await db.select({ count: count() }).from(votes);

      const totalAmount = contribStats?.totalAmount ? parseFloat(contribStats.totalAmount.toString()) : 0;
      const contribCount = contribStats?.count || 0;

      return {
        totalUsers: userCount?.count || 0,
        totalDAOs: daoCount?.count || 0,
        totalContributions: contribCount,
        totalContributionAmount: totalAmount,
        totalProposals: propCount?.count || 0,
        totalVotes: voteCount?.count || 0,
        averageContributionSize: contribCount > 0 ? totalAmount / contribCount : 0,
        averageProposalsPerDAO: (daoCount?.count || 0) > 0 ? (propCount?.count || 0) / (daoCount?.count || 0) : 0,
        reportedAt: new Date(),
      };
    } catch (error) {
      logger.error('Error fetching system consolidated stats:', error);
      return {
        totalUsers: 0,
        totalDAOs: 0,
        totalContributions: 0,
        totalContributionAmount: 0,
        totalProposals: 0,
        totalVotes: 0,
        averageContributionSize: 0,
        averageProposalsPerDAO: 0,
        reportedAt: new Date(),
      };
    }
  }

  /**
   * Get DAO-specific activity leaderboard
   * Ranks members by activity level within a DAO
   */
  async getDAOActivityLeaderboard(
    daoId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{
    leaderboard: Array<{
      rank: number;
      userId: string;
      userName?: string;
      userEmail?: string;
      contributionCount: number;
      proposalCount: number;
      voteCount: number;
      totalActivityScore: number;
      lastActivityAt?: Date;
    }>;
    totalParticipants: number;
  }> {
    try {
      // Get all members of the DAO with activity
      const [countResult] = await db
        .select({ count: countDistinct(daoMemberships.userId) })
        .from(daoMemberships)
        .where(eq(daoMemberships.daoId, daoId));

      const totalParticipants = countResult?.count || 0;

      // Get activity counts per member
      const activity = await db
        .select({
          userId: daoMemberships.userId,
          contributionCount: count(contributions.id).as('contribution_count'),
          proposalCount: count(proposals.id).as('proposal_count'),
          voteCount: count(votes.id).as('vote_count'),
          lastActivityAt: sql`GREATEST(
            MAX(${contributions.createdAt}),
            MAX(${proposals.createdAt}),
            MAX(${votes.createdAt})
          )`.as('last_activity_at'),
        })
        .from(daoMemberships)
        .leftJoin(contributions, and(
          eq(contributions.daoId, daoId),
          eq(contributions.userId, daoMemberships.userId)
        ))
        .leftJoin(proposals, and(
          eq(proposals.daoId, daoId),
          eq(proposals.proposerId, daoMemberships.userId)
        ))
        .leftJoin(votes, and(
          eq(votes.daoId, daoId),
          eq(votes.userId, daoMemberships.userId)
        ))
        .where(eq(daoMemberships.daoId, daoId))
        .groupBy(daoMemberships.userId)
        .orderBy(desc(sql`${count(contributions.id)} + ${count(proposals.id)} + ${count(votes.id)}`))
        .limit(limit)
        .offset(offset);

      // Fetch user details
      const userIds = activity.map(a => a.userId).filter(Boolean);
      const userDetails = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds)})`);

      const userMap = new Map(userDetails.map(u => [u.id, u]));

      // Combine and rank
      const rankedLeaderboard = activity.map((entry, index) => {
        const user = userMap.get(entry.userId);
        const totalScore = (entry.contributionCount || 0) + (entry.proposalCount || 0) + (entry.voteCount || 0);

        return {
          rank: offset + index + 1,
          userId: entry.userId,
          userName: user?.name || undefined,
          userEmail: user?.email || undefined,
          contributionCount: entry.contributionCount || 0,
          proposalCount: entry.proposalCount || 0,
          voteCount: entry.voteCount || 0,
          totalActivityScore: totalScore,
          lastActivityAt: entry.lastActivityAt as Date | undefined,
        };
      });

      return {
        leaderboard: rankedLeaderboard,
        totalParticipants,
      };
    } catch (error) {
      logger.error(`Error fetching DAO ${daoId} activity leaderboard:`, error);
      return {
        leaderboard: [],
        totalParticipants: 0,
      };
    }
  }

  /**
   * Get DAO-specific contributions leaderboard
   * Ranks members by total contributions to the DAO
   */
  async getDAOContributionsLeaderboard(
    daoId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{
    leaderboard: Array<{
      rank: number;
      userId: string;
      userName?: string;
      userEmail?: string;
      totalContributionUsd: number;
      contributionCount: number;
      averageContribution: number;
      lastContributionAt?: Date;
    }>;
    totalParticipants: number;
  }> {
    try {
      // Get total contributors to this DAO
      const [countResult] = await db
        .select({ count: countDistinct(contributions.userId) })
        .from(contributions)
        .where(eq(contributions.daoId, daoId));

      const totalParticipants = countResult?.count || 0;

      // Get top contributors to this DAO
      const leaderboard = await db
        .select({
          userId: contributions.userId,
          totalAmount: sum(contributions.amount).as('total_amount'),
          contributionCount: count().as('contribution_count'),
          lastContributionAt: sql`MAX(${contributions.createdAt})`.as('last_contribution_at'),
        })
        .from(contributions)
        .where(eq(contributions.daoId, daoId))
        .groupBy(contributions.userId)
        .orderBy(desc(sum(contributions.amount)))
        .limit(limit)
        .offset(offset);

      // Fetch user details
      const userIds = leaderboard.map(l => l.userId);
      const userDetails = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds)})`);

      const userMap = new Map(userDetails.map(u => [u.id, u]));

      // Combine and rank
      const rankedLeaderboard = leaderboard.map((entry, index) => {
        const user = userMap.get(entry.userId);
        const totalAmount = entry.totalAmount ? parseFloat(entry.totalAmount.toString()) : 0;
        const count = entry.contributionCount || 0;

        return {
          rank: offset + index + 1,
          userId: entry.userId,
          userName: user?.name || undefined,
          userEmail: user?.email || undefined,
          totalContributionUsd: totalAmount,
          contributionCount: count,
          averageContribution: count > 0 ? totalAmount / count : 0,
          lastContributionAt: entry.lastContributionAt as Date | undefined,
        };
      });

      return {
        leaderboard: rankedLeaderboard,
        totalParticipants,
      };
    } catch (error) {
      logger.error(`Error fetching DAO ${daoId} contributions leaderboard:`, error);
      return {
        leaderboard: [],
        totalParticipants: 0,
      };
    }
  }

  /**
   * Get DAO-specific voting leaderboard
   * Ranks members by voting participation
   */
  async getDAOVotingLeaderboard(
    daoId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{
    leaderboard: Array<{
      rank: number;
      userId: string;
      userName?: string;
      userEmail?: string;
      voteCount: number;
      proposalsVotedOn: number;
      votingPower?: number;
      lastVoteAt?: Date;
    }>;
    totalParticipants: number;
  }> {
    try {
      // Get total voters in this DAO
      const [countResult] = await db
        .select({ count: countDistinct(votes.userId) })
        .from(votes)
        .where(eq(votes.daoId, daoId));

      const totalParticipants = countResult?.count || 0;

      // Get top voters in this DAO
      const leaderboard = await db
        .select({
          userId: votes.userId,
          voteCount: count().as('vote_count'),
          proposalCount: countDistinct(votes.proposalId).as('proposal_count'),
          lastVoteAt: sql`MAX(${votes.createdAt})`.as('last_vote_at'),
        })
        .from(votes)
        .where(eq(votes.daoId, daoId))
        .groupBy(votes.userId)
        .orderBy(desc(count()))
        .limit(limit)
        .offset(offset);

      // Fetch user details
      const userIds = leaderboard.map(l => l.userId).filter(Boolean);
      const userDetails = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds)})`);

      const userMap = new Map(userDetails.map(u => [u.id, u]));

      // Combine and rank
      const rankedLeaderboard = leaderboard.map((entry, index) => {
        const user = userMap.get(entry.userId);

        return {
          rank: offset + index + 1,
          userId: entry.userId,
          userName: user?.name || undefined,
          userEmail: user?.email || undefined,
          voteCount: entry.voteCount || 0,
          proposalsVotedOn: entry.proposalCount || 0,
          votingPower: undefined, // Would need to query voting power from DAO settings
          lastVoteAt: entry.lastVoteAt as Date | undefined,
        };
      });

      return {
        leaderboard: rankedLeaderboard,
        totalParticipants,
      };
    } catch (error) {
      logger.error(`Error fetching DAO ${daoId} voting leaderboard:`, error);
      return {
        leaderboard: [],
        totalParticipants: 0,
      };
    }
  }

  /**
   * Get DAO-specific consolidated governance statistics
   * Metrics for a specific DAO
   */
  async getDAOConsolidatedStats(daoId: string): Promise<{
    daoId: string;
    totalMembers: number;
    totalContributions: number;
    totalContributionAmount: number;
    totalProposals: number;
    totalVotes: number;
    averageContributionSize: number;
    proposalPassRate: number;
    votingParticipationRate: number;
    reportedAt: Date;
  }> {
    try {
      // Total members
      const [memberCount] = await db
        .select({ count: count() })
        .from(daoMemberships)
        .where(eq(daoMemberships.daoId, daoId));

      // Contribution stats
      const [contribStats] = await db
        .select({
          count: count(),
          totalAmount: sum(contributions.amount),
        })
        .from(contributions)
        .where(eq(contributions.daoId, daoId));

      // Proposal stats
      const [propStats] = await db
        .select({
          count: count(),
          passedCount: count(sql`CASE WHEN ${proposals.status} = 'passed' THEN 1 END`),
        })
        .from(proposals)
        .where(eq(proposals.daoId, daoId));

      // Vote stats
      const [voteCount] = await db
        .select({ count: count() })
        .from(votes)
        .where(eq(votes.daoId, daoId));

      const totalAmount = contribStats?.totalAmount ? parseFloat(contribStats.totalAmount.toString()) : 0;
      const totalContribs = contribStats?.count || 0;
      const totalProps = propStats?.count || 0;
      const passedProps = propStats?.passedCount || 0;
      const totalMembers = memberCount?.count || 0;

      return {
        daoId,
        totalMembers,
        totalContributions: totalContribs,
        totalContributionAmount: totalAmount,
        totalProposals: totalProps,
        totalVotes: voteCount?.count || 0,
        averageContributionSize: totalContribs > 0 ? totalAmount / totalContribs : 0,
        proposalPassRate: totalProps > 0 ? (passedProps / totalProps) * 100 : 0,
        votingParticipationRate: totalMembers > 0 ? (countDistinct(votes.userId) as any) : 0,
        reportedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Error fetching DAO ${daoId} consolidated stats:`, error);
      return {
        daoId,
        totalMembers: 0,
        totalContributions: 0,
        totalContributionAmount: 0,
        totalProposals: 0,
        totalVotes: 0,
        averageContributionSize: 0,
        proposalPassRate: 0,
        votingParticipationRate: 0,
        reportedAt: new Date(),
      };
    }
  }

  /**
   * Get user's position and stats in system-wide referral leaderboard
   */
  async getUserReferralRank(userId: string): Promise<{
    rank: number;
    totalReferrals: number;
    totalRewards: number;
    percentile: number;
  }> {
    try {
      // Get user's referral count
      const [userStats] = await db
        .select({
          count: count(),
          totalRewards: sum(referralRewards.rewardAmount),
        })
        .from(referralRewards)
        .where(
          and(
            eq(referralRewards.referrerId, userId),
            eq(referralRewards.status, 'awarded')
          )
        );

      const userCount = userStats?.count || 0;

      // Get rank (count how many users have more referrals)
      const [rankResult] = await db
        .select({
          rank: count(),
        })
        .from(referralRewards)
        .where(
          sql`${referralRewards.referrerId} IN (
            SELECT referrer_id FROM referral_rewards
            WHERE status = 'awarded'
            GROUP BY referrer_id
            HAVING COUNT(*) > ${userCount}
          )`
        );

      const rank = (rankResult?.rank || 0) + 1;

      // Get total participants
      const [totalParticipants] = await db
        .select({ count: countDistinct(referralRewards.referrerId) })
        .from(referralRewards)
        .where(eq(referralRewards.status, 'awarded'));

      const total = totalParticipants?.count || 1;
      const percentile = ((total - rank) / total) * 100;

      return {
        rank,
        totalReferrals: userCount,
        totalRewards: userStats?.totalRewards ? parseFloat(userStats.totalRewards.toString()) : 0,
        percentile,
      };
    } catch (error) {
      logger.error(`Error fetching user ${userId} referral rank:`, error);
      return {
        rank: 0,
        totalReferrals: 0,
        totalRewards: 0,
        percentile: 0,
      };
    }
  }

  /**
   * Get user's position and stats in DAO-specific activity leaderboard
   */
  async getUserDAOActivityRank(userId: string, daoId: string): Promise<{
    rank: number;
    contributionCount: number;
    proposalCount: number;
    voteCount: number;
    totalActivityScore: number;
    percentile: number;
  }> {
    try {
      // Get user's activity counts in DAO
      const [userActivity] = await db
        .select({
          contributionCount: count(contributions.id),
          proposalCount: count(proposals.id),
          voteCount: count(votes.id),
        })
        .from(daoMemberships)
        .leftJoin(contributions, and(
          eq(contributions.daoId, daoId),
          eq(contributions.userId, userId)
        ))
        .leftJoin(proposals, and(
          eq(proposals.daoId, daoId),
          eq(proposals.proposerId, userId)
        ))
        .leftJoin(votes, and(
          eq(votes.daoId, daoId),
          eq(votes.userId, userId)
        ))
        .where(
          and(
            eq(daoMemberships.daoId, daoId),
            eq(daoMemberships.userId, userId)
          )
        );

      const totalScore = (userActivity?.contributionCount || 0) + 
                        (userActivity?.proposalCount || 0) + 
                        (userActivity?.voteCount || 0);

      // Get rank (count how many members have higher score)
      const [rankResult] = await db
        .select({
          count: count(),
        })
        .from(sql`(
          SELECT 
            user_id,
            CAST(COUNT(${contributions.id}) AS INTEGER) + 
            CAST(COUNT(${proposals.id}) AS INTEGER) + 
            CAST(COUNT(${votes.id}) AS INTEGER) as activity_score
          FROM dao_memberships dm
          LEFT JOIN contributions c ON c.dao_id = ${daoId} AND c.user_id = dm.user_id
          LEFT JOIN proposals p ON p.dao_id = ${daoId} AND p.proposed_by = dm.user_id
          LEFT JOIN votes v ON v.dao_id = ${daoId} AND v.voter_id = dm.user_id
          WHERE dm.dao_id = ${daoId}
          GROUP BY user_id
          HAVING activity_score > ${totalScore}
        ) as ranked_users`);

      const rank = (rankResult?.count || 0) + 1;

      // Get total participants in DAO
      const [totalParticipants] = await db
        .select({ count: count() })
        .from(daoMemberships)
        .where(eq(daoMemberships.daoId, daoId));

      const total = totalParticipants?.count || 1;
      const percentile = ((total - rank) / total) * 100;

      return {
        rank,
        contributionCount: userActivity?.contributionCount || 0,
        proposalCount: userActivity?.proposalCount || 0,
        voteCount: userActivity?.voteCount || 0,
        totalActivityScore: totalScore,
        percentile,
      };
    } catch (error) {
      logger.error(`Error fetching user ${userId} DAO ${daoId} activity rank:`, error);
      return {
        rank: 0,
        contributionCount: 0,
        proposalCount: 0,
        voteCount: 0,
        totalActivityScore: 0,
        percentile: 0,
      };
    }
  }
}

export const governanceLeaderboardService = new GovernanceLeaderboardService();
