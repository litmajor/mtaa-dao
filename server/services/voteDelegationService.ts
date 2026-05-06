/**
 * @file voteDelegationService.ts
 * @description Backend service for vote delegation and weighted voting
 * @notice Handles vote delegation to representatives and reputation-weighted voting
 */

import { db } from '../db';
import { daos, proposals, delegations, memberReputation } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

// ==================== TYPES ====================

interface VoteDelegation {
  delegatorId: string;
  delegateeId: string;
  daoId: string;
  expiryTime?: number;
}

interface WeightedVote {
  voterId: string;
  proposalId: string;
  voteChoice: 'FOR' | 'AGAINST' | 'ABSTAIN';
  votingWeight: number;  // Reputation-weighted
}

// ==================== SERVICE ====================

export class VoteDelegationService {
  
  // ==================== VOTE DELEGATION ====================

  /**
   * Delegate voting power to another member
   * @param params Delegation parameters
   */
  async delegateVote(params: VoteDelegation): Promise<void> {
    try {
      // Verify delegator exists
      const delegator = await db.query.users.findFirst({
        where: eq(users.id, params.delegatorId as any),
      });

      if (!delegator) {
        throw new Error(`Delegator not found: ${params.delegatorId}`);
      }

      // Verify delegatee exists
      const delegatee = await db.query.users.findFirst({
        where: eq(users.id, params.delegateeId as any),
      });

      if (!delegatee) {
        throw new Error(`Delegatee not found: ${params.delegateeId}`);
      }

      // Verify delegator is member of DAO
      const membership = await db.query.daoMemberships.findFirst({
        where: and(
          eq(daoMemberships.memberId, params.delegatorId as any),
          eq(daoMemberships.daoId, params.daoId as any)
        ),
      });

      if (!membership) {
        throw new Error(`Delegator not member of DAO: ${params.daoId}`);
      }

      // Create or update delegation
      await db.execute(sql`
        INSERT INTO delegations (delegator_id, delegatee_id, dao_id, delegated_at, expiry_time)
        VALUES (${params.delegatorId}, ${params.delegateeId}, ${params.daoId}, NOW(), ${params.expiryTime || null})
        ON CONFLICT (delegator_id, dao_id) 
        DO UPDATE SET delegatee_id = ${params.delegateeId}, updated_at = NOW()
      `);

      console.log(`✅ Vote delegated: ${params.delegatorId} → ${params.delegateeId} (DAO: ${params.daoId})`);
    } catch (error) {
      console.error('❌ Error delegating vote:', error);
      throw error;
    }
  }

  /**
   * Revoke vote delegation
   */
  async revokeVoteDelegation(delegatorId: string, daoId: string): Promise<void> {
    try {
      await db.execute(sql`
        DELETE FROM delegations 
        WHERE delegator_id = ${delegatorId} AND dao_id = ${daoId}
      `);

      console.log(`✅ Vote delegation revoked: ${delegatorId} in DAO ${daoId}`);
    } catch (error) {
      console.error('❌ Error revoking vote delegation:', error);
      throw error;
    }
  }

  /**
   * Get active delegatee for a delegator
   */
  async getActiveDelegatee(delegatorId: string, daoId: string): Promise<string | null> {
    try {
      const delegation = await db.query.delegations.findFirst({
        where: and(
          eq(delegations.delegatorId, delegatorId as any),
          eq(delegations.daoId, daoId as any)
        ),
      });

      if (!delegation) return null;

      // Check if delegation expired
      if (delegation.expiryTime && delegation.expiryTime < Date.now()) {
        await this.revokeVoteDelegation(delegatorId, daoId);
        return null;
      }

      return delegation.delegateeId;
    } catch (error) {
      console.error('❌ Error getting active delegatee:', error);
      throw error;
    }
  }

  /**
   * Get all delegators for a delegatee
   */
  async getDelegators(delegateeId: string, daoId: string): Promise<string[]> {
    try {
      const delegations = await db.query.delegations.findMany({
        where: and(
          eq(delegations.delegateeId, delegateeId as any),
          eq(delegations.daoId, daoId as any)
        ),
      });

      return delegations
        .filter(d => !d.expiryTime || d.expiryTime >= Date.now())
        .map(d => d.delegatorId);
    } catch (error) {
      console.error('❌ Error getting delegators:', error);
      throw error;
    }
  }

  // ==================== WEIGHTED VOTING ====================

  /**
   * Calculate member's voting weight based on reputation
   * Reputation-weighted voting: higher reputation = more voting power
   */
  async calculateVotingWeight(memberId: string, daoId: string): Promise<number> {
    try {
      // Get member reputation in this DAO
      const reputation = await db.query.memberReputation.findFirst({
        where: and(
          eq(memberReputation.memberId, memberId as any),
          eq(memberReputation.daoId, daoId as any)
        ),
      });

      if (!reputation) {
        // Default weight if no reputation (new member)
        return 1.0;
      }

      // Scale reputation to voting weight (reputation / 100)
      // E.g., 500 reputation score = 5.0 voting weight
      const weight = (reputation.reputationScore || 0) / 100;
      return Math.max(1, weight);  // Minimum 1.0 weight
    } catch (error) {
      console.error('❌ Error calculating voting weight:', error);
      throw error;
    }
  }

  /**
   * Add weighted vote with delegation support
   * Handles both direct votes and delegated votes
   */
  async addWeightedVote(params: WeightedVote): Promise<void> {
    try {
      // Verify proposal exists
      const proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, params.proposalId as any),
      });

      if (!proposal) {
        throw new Error(`Proposal not found: ${params.proposalId}`);
      }

      // Calculate actual voting weight (reputation + delegated)
      let totalWeight = await this.calculateVotingWeight(
        params.voterId,
        proposal.daoId
      );

      // Get all delegators to this voter
      const delegators = await this.getDelegators(params.voterId, proposal.daoId);
      
      for (const delegator of delegators) {
        const delegatorWeight = await this.calculateVotingWeight(delegator, proposal.daoId);
        totalWeight += delegatorWeight;
      }

      // Record the vote
      await db.execute(sql`
        INSERT INTO proposal_votes (
          proposal_id, voter_id, vote_choice, voting_weight, created_at
        )
        VALUES (
          ${params.proposalId}, ${params.voterId}, ${params.voteChoice}, 
          ${totalWeight}, NOW()
        )
        ON CONFLICT (proposal_id, voter_id) 
        DO UPDATE SET 
          vote_choice = ${params.voteChoice},
          voting_weight = ${totalWeight},
          updated_at = NOW()
      `);

      console.log(`✅ Weighted vote recorded: ${params.voterId} (weight: ${totalWeight})`);
    } catch (error) {
      console.error('❌ Error adding weighted vote:', error);
      throw error;
    }
  }

  /**
   * Get total voting weight for a proposal choice
   */
  async getVotingWeightByChoice(
    proposalId: string,
    voteChoice: 'FOR' | 'AGAINST' | 'ABSTAIN'
  ): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COALESCE(SUM(voting_weight), 0) as total_weight
        FROM proposal_votes
        WHERE proposal_id = ${proposalId} AND vote_choice = ${voteChoice}
      `);

      return result[0]?.total_weight || 0;
    } catch (error) {
      console.error('❌ Error getting voting weight:', error);
      throw error;
    }
  }

  /**
   * Get voting results with weighted votes
   */
  async getWeightedVotingResults(proposalId: string): Promise<{
    forWeight: number;
    againstWeight: number;
    abstainWeight: number;
    totalWeight: number;
    forPercentage: number;
    againstPercentage: number;
  }> {
    try {
      const forWeight = await this.getVotingWeightByChoice(proposalId, 'FOR');
      const againstWeight = await this.getVotingWeightByChoice(proposalId, 'AGAINST');
      const abstainWeight = await this.getVotingWeightByChoice(proposalId, 'ABSTAIN');

      const totalWeight = forWeight + againstWeight + abstainWeight;

      return {
        forWeight,
        againstWeight,
        abstainWeight,
        totalWeight,
        forPercentage: totalWeight > 0 ? (forWeight / totalWeight) * 100 : 0,
        againstPercentage: totalWeight > 0 ? (againstWeight / totalWeight) * 100 : 0,
      };
    } catch (error) {
      console.error('❌ Error getting voting results:', error);
      throw error;
    }
  }

  // ==================== DISPUTE MECHANISM ====================

  /**
   * File a dispute on a proposal/vote
   * Triggers review by DAO guardians
   */
  async fileDispute(params: {
    proposalId: string;
    disputantId: string;
    reason: string;
    evidence: string;  // IPFS hash or URL
  }): Promise<string> {
    try {
      const disputeId = crypto.randomUUID();

      await db.execute(sql`
        INSERT INTO proposal_disputes (
          id, proposal_id, disputant_id, reason, evidence, filed_at, status
        )
        VALUES (
          ${disputeId}, ${params.proposalId}, ${params.disputantId},
          ${params.reason}, ${params.evidence}, NOW(), 'PENDING'
        )
      `);

      console.log(`✅ Dispute filed: ${disputeId}`);
      return disputeId;
    } catch (error) {
      console.error('❌ Error filing dispute:', error);
      throw error;
    }
  }

  /**
   * Resolve a dispute (guardian review)
   */
  async resolveDispute(params: {
    disputeId: string;
    resolution: 'UPHELD' | 'REJECTED' | 'NEEDS_REVOTE';
    reasoning: string;
  }): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE proposal_disputes
        SET status = ${params.resolution}, 
            resolved_at = NOW(),
            resolution_reasoning = ${params.reasoning}
        WHERE id = ${params.disputeId}
      `);

      if (params.resolution === 'NEEDS_REVOTE') {
        // Reset votes on associated proposal
        const dispute = await db.query.proposalDisputes.findFirst({
          where: eq(proposalDisputes.id, params.disputeId as any),
        });

        if (dispute) {
          await db.execute(sql`
            DELETE FROM proposal_votes WHERE proposal_id = ${dispute.proposalId}
          `);
        }
      }

      console.log(`✅ Dispute resolved: ${params.disputeId}`);
    } catch (error) {
      console.error('❌ Error resolving dispute:', error);
      throw error;
    }
  }

  /**
   * Get all disputes for a DAO (for guardian review)
   */
  async getDAODisputes(daoId: string): Promise<any[]> {
    try {
      const disputes = await db.execute(sql`
        SELECT pd.*, p.title as proposal_title
        FROM proposal_disputes pd
        JOIN proposals p ON pd.proposal_id = p.id
        WHERE p.dao_id = ${daoId}
        ORDER BY pd.filed_at DESC
      `);

      return disputes;
    } catch (error) {
      console.error('❌ Error getting DAO disputes:', error);
      throw error;
    }
  }

  // ==================== ANALYTICS ====================

  /**
   * Get voting participation metrics
   */
  async getVotingParticipation(daoId: string, periodDays: number = 30): Promise<{
    totalProposals: number;
    averageParticipation: number;
    averageReputation: number;
  }> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT p.id) as total_proposals,
          COALESCE(AVG(vote_participation), 0) as avg_participation,
          COALESCE(AVG(mr.reputation_score), 0) as avg_reputation
        FROM proposals p
        LEFT JOIN (
          SELECT proposal_id, COUNT(DISTINCT voter_id) as vote_participation
          FROM proposal_votes
          GROUP BY proposal_id
        ) votes ON p.id = votes.proposal_id
        LEFT JOIN member_reputation mr ON p.dao_id = mr.dao_id
        WHERE p.dao_id = ${daoId}
        AND p.created_at >= NOW() - INTERVAL '${periodDays} days'
      `);

      return {
        totalProposals: result[0]?.total_proposals || 0,
        averageParticipation: result[0]?.avg_participation || 0,
        averageReputation: result[0]?.avg_reputation || 0,
      };
    } catch (error) {
      console.error('❌ Error getting voting participation:', error);
      throw error;
    }
  }

  /**
   * Get delegation network metrics
   */
  async getDelegationStats(daoId: string): Promise<{
    totalDelegations: number;
    topDelegatees: Array<{delegateeId: string; delegatorCount: number}>;
  }> {
    try {
      const stats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_delegations,
          delegatee_id,
          COUNT(*) as delegator_count
        FROM delegations
        WHERE dao_id = ${daoId}
        AND (expiry_time IS NULL OR expiry_time >= NOW())
        GROUP BY delegatee_id
        ORDER BY delegator_count DESC
        LIMIT 10
      `);

      return {
        totalDelegations: stats.reduce((sum: number, s: any) => sum + s.total_delegations, 0),
        topDelegatees: stats.map((s: any) => ({
          delegateeId: s.delegatee_id,
          delegatorCount: s.delegator_count,
        })),
      };
    } catch (error) {
      console.error('❌ Error getting delegation stats:', error);
      throw error;
    }
  }
}

export const voteDelegationService = new VoteDelegationService();
