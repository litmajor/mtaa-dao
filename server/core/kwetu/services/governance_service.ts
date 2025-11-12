import { db } from '../../../db';
import { proposals, votes, voteDelegations, userActivities } from '../../../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export class GovernanceService {
  /**
   * Get DAO proposals from database
   */
  async getProposals(daoId: string, status?: string, limit: number = 50, offset: number = 0) {
    const where = status
      ? and(eq(proposals.daoId, daoId), eq(proposals.status, status))
      : eq(proposals.daoId, daoId);

    const proposalQuery = db.select()
      .from(proposals)
      .where(where)
      .orderBy(desc(proposals.createdAt))
      .limit(limit)
      .offset(offset);

    const proposalsList = await proposalQuery;

    // Get total count for pagination
    const totalQuery = await db.select({ count: sql`count(*)` })
      .from(proposals)
      .where(where);

    const total = Number(totalQuery[0]?.count || 0);

    return {
      proposals: proposalsList,
      total
    };
  }

  /**
   * Get proposal by ID with vote counts
   */
  async getProposalById(proposalId: string) {
    const proposalData = await db.select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (proposalData.length === 0) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const proposal = proposalData[0];

    // Get aggregated vote counts
    const voteCounts = await db.select({
      votesFor: sql<number>`SUM(CASE WHEN ${votes.voteType} = 'for' THEN 1 ELSE 0 END)`,
      votesAgainst: sql<number>`SUM(CASE WHEN ${votes.voteType} = 'against' THEN 1 ELSE 0 END)`,
      votesAbstain: sql<number>`SUM(CASE WHEN ${votes.voteType} = 'abstain' THEN 1 ELSE 0 END)`,
      totalVotes: sql<number>`COUNT(*)`
    }).from(votes).where(eq(votes.proposalId, proposalId));

    return {
      ...proposal,
      votesFor: Number(voteCounts[0]?.votesFor || 0),
      votesAgainst: Number(voteCounts[0]?.votesAgainst || 0),
      votesAbstain: Number(voteCounts[0]?.votesAbstain || 0),
      totalVotes: Number(voteCounts[0]?.totalVotes || 0)
    };
  }

  /**
   * Get user's voting power
   */
  async getVotingPower(userId: string, daoId: string) {
    // Base power: from contributions (e.g., count * 10)
    const contributions = await db.select({ count: sql`count(*)` })
      .from(userActivities)
      .where(and(
        eq(userActivities.userId, userId),
        eq(userActivities.dao_id, daoId),
        eq(userActivities.type, 'contribution')
      ));
    const basePower = Number(contributions[0]?.count || 0) * 10;

    // Delegated: count of delegations to this user
    const delegatedIn = await db.select({ count: sql`count(*)` })
      .from(voteDelegations)
      .where(and(
        eq(voteDelegations.daoId, daoId),
        eq(voteDelegations.delegateId, userId)
      ));
    const delegated = Number(delegatedIn[0]?.count || 0);

    // Delegated out: count of delegations from this user
    const delegatedOut = await db.select({ count: sql`count(*)` })
      .from(voteDelegations)
      .where(and(
        eq(voteDelegations.daoId, daoId),
        eq(voteDelegations.delegatorId, userId)
      ));
    const delegatedAway = Number(delegatedOut[0]?.count || 0);

    const total = basePower + delegated - delegatedAway;

    return {
      power: basePower,
      delegated: delegated - delegatedAway,
      total
    };
  }
}