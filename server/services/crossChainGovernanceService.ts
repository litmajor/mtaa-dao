
import { db } from '../db';
import { crossChainProposals, proposals, votes } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { SupportedChain } from '../../shared/chainRegistry';
import { bridgeProtocolService } from './bridgeProtocolService';

export interface CrossChainVote {
  proposalId: string;
  chain: SupportedChain;
  voteType: string;
  votingPower: string;
  txHash: string;
}

export class CrossChainGovernanceService {
  private logger = Logger.getLogger();

  /**
   * Create cross-chain proposal
   */
  async createCrossChainProposal(
    proposalId: string,
    chains: SupportedChain[],
    executionChain: SupportedChain
  ): Promise<string> {
    try {
      const proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, proposalId)
      });

      if (!proposal) {
        throw new AppError('Proposal not found', 404);
      }

      // Initialize vote tallies for each chain
      const votesByChain: Record<string, { yes: number; no: number; abstain: number }> = {};
      const quorumByChain: Record<string, number> = {};

      chains.forEach(chain => {
        votesByChain[chain] = { yes: 0, no: 0, abstain: 0 };
        quorumByChain[chain] = 100; // Default quorum
      });

      const [crossChainProposal] = await db.insert(crossChainProposals).values({
        proposalId,
        chains,
        votesByChain,
        quorumByChain,
        executionChain,
        syncStatus: 'pending'
      }).returning();

      this.logger.info(`Cross-chain proposal created: ${crossChainProposal.id}`);

      // Send proposal to all chains via bridge
      await this.broadcastProposal(crossChainProposal.id!, chains, proposal);

      return crossChainProposal.id!;
    } catch (error) {
      this.logger.error('Failed to create cross-chain proposal:', error);
      throw new AppError('Failed to create cross-chain proposal', 500);
    }
  }

  /**
   * Aggregate votes from multiple chains
   */
  async aggregateVotes(crossChainProposalId: string): Promise<{
    totalYes: number;
    totalNo: number;
    totalAbstain: number;
    quorumMet: boolean;
  }> {
    try {
      const crossChainProposal = await db.query.crossChainProposals.findFirst({
        where: eq(crossChainProposals.id, crossChainProposalId)
      });

      if (!crossChainProposal) {
        throw new AppError('Cross-chain proposal not found', 404);
      }

      const votesByChain = crossChainProposal.votesByChain as Record<string, any>;
      const quorumByChain = crossChainProposal.quorumByChain as Record<string, number>;

      let totalYes = 0;
      let totalNo = 0;
      let totalAbstain = 0;
      let totalQuorum = 0;
      let achievedQuorum = 0;

      Object.keys(votesByChain).forEach(chain => {
        const votes = votesByChain[chain];
        totalYes += votes.yes || 0;
        totalNo += votes.no || 0;
        totalAbstain += votes.abstain || 0;

        const chainQuorum = quorumByChain[chain] || 0;
        totalQuorum += chainQuorum;

        const chainVotes = (votes.yes || 0) + (votes.no || 0) + (votes.abstain || 0);
        if (chainVotes >= chainQuorum) {
          achievedQuorum += chainQuorum;
        }
      });

      const quorumMet = achievedQuorum >= totalQuorum;

      return {
        totalYes,
        totalNo,
        totalAbstain,
        quorumMet
      };
    } catch (error) {
      this.logger.error('Failed to aggregate votes:', error);
      throw new AppError('Failed to aggregate votes', 500);
    }
  }

  /**
   * Sync vote from specific chain
   */
  async syncVoteFromChain(
    crossChainProposalId: string,
    chain: SupportedChain,
    voteData: CrossChainVote
  ): Promise<void> {
    try {
      const crossChainProposal = await db.query.crossChainProposals.findFirst({
        where: eq(crossChainProposals.id, crossChainProposalId)
      });

      if (!crossChainProposal) {
        throw new AppError('Cross-chain proposal not found', 404);
      }

      const votesByChain = crossChainProposal.votesByChain as Record<string, any>;

      // Update vote count for the specific chain
      if (!votesByChain[chain]) {
        votesByChain[chain] = { yes: 0, no: 0, abstain: 0 };
      }

      if (voteData.voteType === 'yes') {
        votesByChain[chain].yes += parseFloat(voteData.votingPower);
      } else if (voteData.voteType === 'no') {
        votesByChain[chain].no += parseFloat(voteData.votingPower);
      } else if (voteData.voteType === 'abstain') {
        votesByChain[chain].abstain += parseFloat(voteData.votingPower);
      }

      await db.update(crossChainProposals)
        .set({ votesByChain, syncStatus: 'synced' })
        .where(eq(crossChainProposals.id, crossChainProposalId));

      this.logger.info(`Vote synced from ${chain} for proposal ${crossChainProposalId}`);
    } catch (error) {
      this.logger.error('Failed to sync vote:', error);
      throw new AppError('Failed to sync vote', 500);
    }
  }

  /**
   * Broadcast proposal to all chains
   */
  private async broadcastProposal(
    crossChainProposalId: string,
    chains: SupportedChain[],
    proposal: any
  ): Promise<void> {
    const payload = JSON.stringify({
      crossChainProposalId,
      proposalId: proposal.id,
      title: proposal.title,
      description: proposal.description,
      voteEndTime: proposal.voteEndTime
    });

    for (const chain of chains) {
      try {
        await bridgeProtocolService.sendLayerZeroMessage(
          SupportedChain.CELO, // Primary chain
          chain,
          payload
        );
      } catch (error) {
        this.logger.error(`Failed to broadcast to ${chain}:`, error);
      }
    }
  }
}

export const crossChainGovernanceService = new CrossChainGovernanceService();
