
import { db } from '../../../db';
import { proposals, votes } from '../../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export class GovernanceService {
  /**
   * Get DAO proposals from database
   */
  async getProposals(daoId: string, status?: string) {
    try {
      let query = db.query.proposals.findMany({
        where: eq(proposals.daoId, daoId),
        orderBy: [desc(proposals.createdAt)]
      });

      const allProposals = await query;

      // Filter by status if provided
      const filtered = status 
        ? allProposals.filter(p => p.status === status)
        : allProposals;

      return {
        proposals: filtered,
        total: filtered.length
      };
    } catch (error) {
      console.error('Proposals fetch error:', error);
      return {
        proposals: [],
        total: 0
      };
    }
  }

  /**
   * Get proposal by ID with vote counts
   */
  async getProposalById(proposalId: string) {
    try {
      const proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, proposalId)
      });

      if (!proposal) {
        throw new Error('Proposal not found');
      }

      // Get vote counts
      const proposalVotes = await db.query.votes.findMany({
        where: eq(votes.proposalId, proposalId)
      });

      const votesFor = proposalVotes.filter(v => v.vote === 'for').length;
      const votesAgainst = proposalVotes.filter(v => v.vote === 'against').length;

      return {
        ...proposal,
        votesFor,
        votesAgainst,
        totalVotes: proposalVotes.length
      };
    } catch (error) {
      console.error('Proposal fetch error:', error);
      return {
        id: proposalId,
        title: 'Proposal not found',
        status: 'unknown',
        votesFor: 0,
        votesAgainst: 0
      };
    }
  }

  /**
   * Get user's voting power
   */
  async getVotingPower(userId: string, daoId: string) {
    try {
      // For now, voting power = 100 (base)
      // TODO: Implement contribution-based voting power
      return {
        power: 100,
        delegated: 0,
        total: 100
      };
    } catch (error) {
      console.error('Voting power error:', error);
      return {
        power: 100,
        delegated: 0,
        total: 100
      };
    }
  }
}
