import { db } from '../db';
import { logger } from '../utils/logger';
import {
  poolProposals,
  poolVotes,
  poolGovernanceSettings,
  poolVoteDelegations,
  investmentPools,
  poolInvestments,
  poolWithdrawals,
  poolAssets,
} from '../../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

/**
 * Pool Governance Service
 * Weighted voting system where voting power = share ownership
 * 1 share = 1 vote (perfect for investment pools)
 */

interface VotingPower {
  userId: string;
  ownedShares: number;
  delegatedToUser: number;
  delegatedByUser: number;
  effectiveVotingPower: number;
  sharePercentage: number;
}

interface ProposalResult {
  proposalId: string;
  status: 'active' | 'passed' | 'rejected' | 'executed' | 'cancelled';
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalVotes: number;
  quorumReached: boolean;
  approvalReached: boolean;
  turnoutPercentage: number;
}

class PoolGovernanceService {
  /**
   * Calculate user's voting power in a pool
   * Voting Power = (Shares Owned - Shares Delegated Away) + Shares Delegated To User
   */
  async calculateVotingPower(poolId: string, userId: string): Promise<VotingPower> {
    try {
      // Get pool info
      const [pool] = await db
        .select()
        .from(investmentPools)
        .where(eq(investmentPools.id, poolId));

      if (!pool) {
        throw new Error('Pool not found');
      }

      const totalSupply = Number(pool.shareTokenSupply) || 1; // Avoid division by zero

      // Calculate owned shares
      const investments = await db
        .select({ shares: poolInvestments.sharesMinted })
        .from(poolInvestments)
        .where(
          and(
            eq(poolInvestments.poolId, poolId),
            eq(poolInvestments.userId, userId),
            eq(poolInvestments.status, 'completed')
          )
        );

      const withdrawals = await db
        .select({ shares: poolWithdrawals.sharesBurned })
        .from(poolWithdrawals)
        .where(
          and(
            eq(poolWithdrawals.poolId, poolId),
            eq(poolWithdrawals.userId, userId),
            eq(poolWithdrawals.status, 'completed')
          )
        );

      const ownedShares = investments.reduce((sum, inv) => sum + Number(inv.shares), 0) -
        withdrawals.reduce((sum, wd) => sum + Number(wd.shares), 0);

      // Get delegations
      const delegatedByUser = await db
        .select({ shares: poolVoteDelegations.delegatedShares })
        .from(poolVoteDelegations)
        .where(
          and(
            eq(poolVoteDelegations.poolId, poolId),
            eq(poolVoteDelegations.delegatorId, userId),
            eq(poolVoteDelegations.isActive, true)
          )
        );

      const delegatedToUser = await db
        .select({ shares: poolVoteDelegations.delegatedShares })
        .from(poolVoteDelegations)
        .where(
          and(
            eq(poolVoteDelegations.poolId, poolId),
            eq(poolVoteDelegations.delegateId, userId),
            eq(poolVoteDelegations.isActive, true)
          )
        );

      const totalDelegatedBy = delegatedByUser.reduce((sum, d) => sum + Number(d.shares), 0);
      const totalDelegatedTo = delegatedToUser.reduce((sum, d) => sum + Number(d.shares), 0);

      // Effective voting power = owned - delegated out + delegated in
      const effectiveVotingPower = ownedShares - totalDelegatedBy + totalDelegatedTo;
      const sharePercentage = (effectiveVotingPower / totalSupply) * 100;

      return {
        userId,
        ownedShares,
        delegatedToUser: totalDelegatedTo,
        delegatedByUser: totalDelegatedBy,
        effectiveVotingPower,
        sharePercentage,
      };
    } catch (error) {
      logger.error('Error calculating voting power:', error);
      throw error;
    }
  }

  /**
   * Create a new proposal
   */
  async createProposal(
    poolId: string,
    userId: string,
    title: string,
    description: string,
    proposalType: string,
    details: any
  ): Promise<any> {
    try {
      // Check governance settings
      const [settings] = await db
        .select()
        .from(poolGovernanceSettings)
        .where(eq(poolGovernanceSettings.poolId, poolId));

      if (!settings || !settings.governanceEnabled) {
        throw new Error('Governance is not enabled for this pool');
      }

      // Check user's voting power
      const votingPower = await this.calculateVotingPower(poolId, userId);
      const minShares = Number(settings.minSharesToPropose);

      if (votingPower.effectiveVotingPower < minShares) {
        throw new Error(`Minimum ${minShares} shares required to create proposal. You have ${votingPower.effectiveVotingPower}`);
      }

      // Check cooldown period
      const cooldownHours = settings.proposalCooldownHours;
      const cooldownDate = new Date();
      cooldownDate.setHours(cooldownDate.getHours() - cooldownHours);

      const recentProposals = await db
        .select()
        .from(poolProposals)
        .where(
          and(
            eq(poolProposals.poolId, poolId),
            eq(poolProposals.createdBy, userId),
            sql`${poolProposals.createdAt} > ${cooldownDate}`
          )
        );

      if (recentProposals.length > 0) {
        throw new Error(`Proposal cooldown active. Please wait ${cooldownHours} hours between proposals`);
      }

      // Get total voting power (total supply)
      const [pool] = await db
        .select()
        .from(investmentPools)
        .where(eq(investmentPools.id, poolId));

      const totalVotingPower = Number(pool?.shareTokenSupply) || 0;

      // Calculate voting end date
      const votingEndsAt = new Date();
      votingEndsAt.setDate(votingEndsAt.getDate() + settings.votingPeriodDays);

      // Create proposal
      const [proposal] = await db
        .insert(poolProposals)
        .values({
          poolId,
          title,
          description,
          proposalType,
          details: JSON.stringify(details),
          totalVotingPower: totalVotingPower.toString(),
          quorumRequired: settings.defaultQuorum,
          approvalThreshold: settings.defaultApprovalThreshold,
          createdBy: userId,
          votingEndsAt,
          status: 'active',
        })
        .returning();

      logger.info(`📜 Proposal created: "${title}" by user ${userId} for pool ${poolId}`);

      return proposal;
    } catch (error) {
      logger.error('Error creating proposal:', error);
      throw error;
    }
  }

  /**
   * Cast a vote on a proposal
   */
  async vote(
    proposalId: string,
    userId: string,
    voteChoice: 'for' | 'against' | 'abstain',
    reason?: string
  ): Promise<any> {
    try {
      // Get proposal
      const [proposal] = await db
        .select()
        .from(poolProposals)
        .where(eq(poolProposals.id, proposalId));

      if (!proposal) {
        throw new Error('Proposal not found');
      }

      if (proposal.status !== 'active') {
        throw new Error('Proposal is not active');
      }

      // Check if voting period has ended
      if (new Date() > new Date(proposal.votingEndsAt)) {
        throw new Error('Voting period has ended');
      }

      // Check if user already voted
      const existingVote = await db
        .select()
        .from(poolVotes)
        .where(
          and(
            eq(poolVotes.proposalId, proposalId),
            eq(poolVotes.userId, userId)
          )
        );

      if (existingVote.length > 0) {
        throw new Error('You have already voted on this proposal');
      }

      // Calculate user's voting power
      const votingPower = await this.calculateVotingPower(proposal.poolId, userId);

      if (votingPower.effectiveVotingPower <= 0) {
        throw new Error('You have no voting power in this pool');
      }

      // Record vote
      const [vote] = await db
        .insert(poolVotes)
        .values({
          proposalId,
          userId,
          vote: voteChoice,
          votingPower: votingPower.effectiveVotingPower.toString(),
          sharePercentage: votingPower.sharePercentage.toString(),
          reason,
        })
        .returning();

      // Update proposal vote counts
      const voteAmount = votingPower.effectiveVotingPower;
      
      if (voteChoice === 'for') {
        await db
          .update(poolProposals)
          .set({
            votesFor: sql`${poolProposals.votesFor} + ${voteAmount}`,
          })
          .where(eq(poolProposals.id, proposalId));
      } else if (voteChoice === 'against') {
        await db
          .update(poolProposals)
          .set({
            votesAgainst: sql`${poolProposals.votesAgainst} + ${voteAmount}`,
          })
          .where(eq(poolProposals.id, proposalId));
      } else {
        await db
          .update(poolProposals)
          .set({
            votesAbstain: sql`${poolProposals.votesAbstain} + ${voteAmount}`,
          })
          .where(eq(poolProposals.id, proposalId));
      }

      logger.info(`🗳️ Vote cast: User ${userId} voted "${voteChoice}" with ${voteAmount.toFixed(4)} shares on proposal ${proposalId}`);

      // Check if proposal can be finalized
      await this.checkAndFinalizeProposal(proposalId);

      return vote;
    } catch (error) {
      logger.error('Error casting vote:', error);
      throw error;
    }
  }

  /**
   * Check proposal status and finalize if conditions are met
   */
  async checkAndFinalizeProposal(proposalId: string): Promise<ProposalResult> {
    try {
      const [proposal] = await db
        .select()
        .from(poolProposals)
        .where(eq(poolProposals.id, proposalId));

      if (!proposal) {
        throw new Error('Proposal not found');
      }

      const votesFor = Number(proposal.votesFor);
      const votesAgainst = Number(proposal.votesAgainst);
      const votesAbstain = Number(proposal.votesAbstain);
      const totalVotes = votesFor + votesAgainst + votesAbstain;
      const totalVotingPower = Number(proposal.totalVotingPower);

      const turnoutPercentage = (totalVotes / totalVotingPower) * 100;
      const quorumRequired = Number(proposal.quorumRequired);
      const approvalThreshold = Number(proposal.approvalThreshold);

      const quorumReached = turnoutPercentage >= quorumRequired;
      
      // Approval is based on votes cast (for vs against, excluding abstain)
      const votesConsidered = votesFor + votesAgainst;
      const approvalPercentage = votesConsidered > 0 ? (votesFor / votesConsidered) * 100 : 0;
      const approvalReached = approvalPercentage >= approvalThreshold;

      // Check if voting has ended
      const votingEnded = new Date() > new Date(proposal.votingEndsAt);

      // Determine if proposal should be finalized
      if (votingEnded && proposal.status === 'active') {
        let newStatus: 'passed' | 'rejected' = 'rejected';

        if (quorumReached && approvalReached) {
          newStatus = 'passed';
          logger.info(`✅ Proposal ${proposalId} PASSED - Approval: ${approvalPercentage.toFixed(2)}%, Turnout: ${turnoutPercentage.toFixed(2)}%`);
        } else {
          logger.info(`❌ Proposal ${proposalId} REJECTED - Quorum: ${quorumReached}, Approval: ${approvalReached}`);
        }

        await db
          .update(poolProposals)
          .set({ status: newStatus })
          .where(eq(poolProposals.id, proposalId));

        return {
          proposalId,
          status: newStatus,
          votesFor,
          votesAgainst,
          votesAbstain,
          totalVotes,
          quorumReached,
          approvalReached,
          turnoutPercentage,
        };
      }

      return {
        proposalId,
        status: proposal.status as any,
        votesFor,
        votesAgainst,
        votesAbstain,
        totalVotes,
        quorumReached,
        approvalReached,
        turnoutPercentage,
      };
    } catch (error) {
      logger.error('Error checking proposal:', error);
      throw error;
    }
  }

  /**
   * Execute a passed proposal
   */
  async executeProposal(proposalId: string, executorId: string): Promise<any> {
    try {
      const [proposal] = await db
        .select()
        .from(poolProposals)
        .where(eq(poolProposals.id, proposalId));

      if (!proposal) {
        throw new Error('Proposal not found');
      }

      if (proposal.status !== 'passed') {
        throw new Error('Proposal has not passed voting');
      }

      // Check timelock
      const [settings] = await db
        .select()
        .from(poolGovernanceSettings)
        .where(eq(poolGovernanceSettings.poolId, proposal.poolId));

      if (settings) {
        const timelockEnd = new Date(proposal.votingEndsAt);
        timelockEnd.setHours(timelockEnd.getHours() + settings.timelockHours);

        if (new Date() < timelockEnd) {
          throw new Error(`Timelock active. Proposal can be executed after ${timelockEnd.toLocaleString()}`);
        }
      }

      // Execute based on proposal type
      let executionResult: any = {};

      switch (proposal.proposalType) {
        case 'allocation_change':
          // Update asset allocations
          const newAllocations = JSON.parse(proposal.details as string);
          // Implement allocation change logic
          // 1. Validate allocations sum to 100%
          const totalAllocation = Object.values(newAllocations as any).reduce((a: number, b: number) => a + b, 0);
          if (Math.abs(totalAllocation - 100) > 0.01) {
            throw new Error(`Allocations must sum to 100%, got ${totalAllocation}%`);
          }
          
          // 2. Get current pool positions
          const currentAllocations = await db.query(sql`
            SELECT asset, allocation_percentage FROM pool_allocations
            WHERE pool_id = ${proposal.poolId}
          `);
          
          // 3. Calculate rebalance trades needed
          const trades = this.calculateRebalanceTrades(currentAllocations, newAllocations);
          
          // 4. Execute trades in order of priority
          for (const trade of trades) {
            const dexResult = await this.dexIntegration.executeSwap({
              fromAsset: trade.fromAsset,
              toAsset: trade.toAsset,
              amount: trade.amount,
              dex: 'uniswap' // or routing strategy
            });
            executionResult.trades = executionResult.trades || [];
            executionResult.trades.push(dexResult);
          }
          
          // 5. Update pool_allocations table
          await db.execute(sql`
            UPDATE pool_allocations
            SET allocation_percentage = CASE
              ${sql.raw(Object.entries(newAllocations as any).map(([asset, pct]) => 
                `WHEN asset = '${asset}' THEN ${pct}`
              ).join(' '))}
            END
            WHERE pool_id = ${proposal.poolId}
          `);
          
          // 6. Emit rebalance event
          await this.emitEvent('pool_rebalanced', {
            poolId: proposal.poolId,
            trades,
            newAllocations
          });
          
          // 7. Update performance metrics
          executionResult.rebalanceStatus = 'completed';
          executionResult = { message: 'Allocation change executed (simulated)', allocations: newAllocations };
          break;

        case 'fee_change':
          // Update performance fee
          const newFee = JSON.parse(proposal.details as string).newFee;
          await db
            .update(investmentPools)
            .set({ performanceFee: newFee })
            .where(eq(investmentPools.id, proposal.poolId));
          executionResult = { message: `Performance fee updated to ${newFee / 100}%` };
          break;

        case 'rebalance':
          // Trigger rebalancing
          // This would call the rebalancing service
          executionResult = { message: 'Rebalancing triggered' };
          break;

        default:
          executionResult = { message: 'Proposal executed' };
      }

      // Mark as executed
      await db
        .update(poolProposals)
        .set({
          status: 'executed',
          executedAt: new Date(),
          executionResult: JSON.stringify(executionResult),
        })
        .where(eq(poolProposals.id, proposalId));

      logger.info(`⚙️ Proposal ${proposalId} executed by user ${executorId}`);

      return {
        success: true,
        executionResult,
      };
    } catch (error) {
      logger.error('Error executing proposal:', error);
      throw error;
    }
  }

  /**
   * Get proposals for a pool
   */
  async getProposals(poolId: string, status?: string): Promise<any[]> {
    try {
      let query = db
        .select()
        .from(poolProposals)
        .where(eq(poolProposals.poolId, poolId));

      if (status) {
        query = query.where(and(
          eq(poolProposals.poolId, poolId),
          eq(poolProposals.status, status)
        )) as any;
      }

      const proposals = await query.orderBy(desc(poolProposals.createdAt));

      return proposals;
    } catch (error) {
      logger.error('Error getting proposals:', error);
      return [];
    }
  }

  /**
   * Get votes for a proposal
   */
  async getProposalVotes(proposalId: string): Promise<any[]> {
    try {
      const votes = await db
        .select()
        .from(poolVotes)
        .where(eq(poolVotes.proposalId, proposalId))
        .orderBy(desc(poolVotes.votedAt));

      return votes;
    } catch (error) {
      logger.error('Error getting votes:', error);
      return [];
    }
  }
}

export const poolGovernanceService = new PoolGovernanceService();

