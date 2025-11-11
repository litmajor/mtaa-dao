
/**
 * Cross-Chain Synchronization Service
 * Uses Synchronizer agent for state consistency across chains
 */

import { synchronizerAgent } from '../agents/synchronizer';
import { Logger } from '../utils/logger';
import { db } from '../db';
import { vaults } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const logger = new Logger('cross-chain-sync');

class CrossChainSyncService {
  async syncVaultBalances(vaultId: number): Promise<void> {
    try {
      const vault = await db.query.vaults.findFirst({
        where: eq(vaults.id, vaultId)
      });

      if (!vault) {
        throw new Error(`Vault ${vaultId} not found`);
      }

      const vaultState = {
        vaultId: vault.id,
        balance: vault.balance,
        currency: vault.currency,
        chain: vault.chain || 'celo',
        lastUpdated: vault.updatedAt
      };

      // Sync state with synchronizer
      synchronizerAgent.receiveState(
        `vault_${vaultId}`,
        vaultState,
        1
      );

      // Check for drift
      if (synchronizerAgent.detectDrift()) {
        logger.warn('Vault state drift detected', { vaultId });
        const resolved = await synchronizerAgent.resolveDrift();
        
        if (resolved) {
          logger.info('Vault state drift resolved', { vaultId, resolvedState: resolved });
        }
      }

      logger.info('Vault balance synced', { vaultId, balance: vault.balance });
    } catch (error) {
      logger.error('Failed to sync vault balances', error);
      throw error;
    }
  }

  async syncProposalVotes(proposalId: string): Promise<void> {
    try {
      const proposal = await db.query.proposals.findFirst({
        where: (proposals, { eq }) => eq(proposals.id, proposalId)
      });

      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`);
      }

      const proposalState = {
        proposalId: proposal.id,
        forVotes: proposal.forVotes,
        againstVotes: proposal.againstVotes,
        abstainVotes: proposal.abstainVotes,
        status: proposal.status
      };

      synchronizerAgent.receiveState(
        `proposal_${proposalId}`,
        proposalState,
        1
      );

      logger.info('Proposal votes synced', { proposalId });
    } catch (error) {
      logger.error('Failed to sync proposal votes', error);
      throw error;
    }
  }

  async createSyncCheckpoint(identifier: string, state: Record<string, any>): Promise<string> {
    const checkpointId = `checkpoint_${identifier}_${Date.now()}`;
    
    synchronizerAgent.receiveState(identifier, state, 1);
    
    logger.info('Sync checkpoint created', { checkpointId, identifier });
    return checkpointId;
  }

  async getSyncMetrics() {
    return synchronizerAgent.getMetrics();
  }
}

export const crossChainSyncService = new CrossChainSyncService();
