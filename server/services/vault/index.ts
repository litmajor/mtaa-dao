/**
 * Vault Service - Module Index
 * 
 * Aggregates all vault service modules into a single cohesive service
 * Maintains backward compatibility with the original monolithic VaultService
 */

import { vaultCreationService } from './vault-creation';
import { vaultOperationsService } from './vault-operations';
import { vaultAnalyticsService } from './vault-analytics';
import { vaultGovernanceService } from './vault-governance';
import { vaultHelperService } from './vault-helpers';
import { vaultUtilities } from './vault-utilities';
import type {
  CreateVaultRequest,
  VaultDepositRequest,
  VaultWithdrawRequest,
  StrategyAllocationRequest
} from './types';
import type { Vault, VaultTransaction } from '../../../shared/schema';

/**
 * Unified VaultService - aggregates all modules
 * Provides single entry point maintaining original API
 */
class VaultService {
  // Creation operations
  createVault = vaultCreationService.createVault.bind(vaultCreationService);

  // Operations (deposits, withdrawals, allocations)
  depositToken = vaultOperationsService.depositToken.bind(vaultOperationsService);
  withdrawToken = vaultOperationsService.withdrawToken.bind(vaultOperationsService);
  allocateToVault = vaultOperationsService.allocateToVault.bind(vaultOperationsService);
  allocateToStrategy = vaultOperationsService.allocateToStrategy.bind(vaultOperationsService);
  rebalanceVault = vaultOperationsService.rebalanceVault.bind(vaultOperationsService);

  // Analytics (queries and reporting)
  getUserVaults = vaultAnalyticsService.getUserVaults.bind(vaultAnalyticsService);
  getUserVaultStats = vaultAnalyticsService.getUserVaultStats.bind(vaultAnalyticsService);
  getVaultAlerts = vaultAnalyticsService.getVaultAlerts.bind(vaultAnalyticsService);
  getVaultDetails = vaultAnalyticsService.getVaultDetails.bind(vaultAnalyticsService);
  getAllVaultsDashboardInfo = vaultAnalyticsService.getAllVaultsDashboardInfo.bind(vaultAnalyticsService);
  getVaultTransactionsPaginated = vaultAnalyticsService.getVaultTransactionsPaginated.bind(vaultAnalyticsService);
  getVaultPerformanceHistory = vaultAnalyticsService.getVaultPerformanceHistory.bind(vaultAnalyticsService);
  getVaultLpPositions = vaultAnalyticsService.getVaultLpPositions.bind(vaultAnalyticsService);
  getDailyChallengeStatus = vaultAnalyticsService.getDailyChallengeStatus.bind(vaultAnalyticsService);
  getUserWalletStatus = vaultAnalyticsService.getUserWalletStatus.bind(vaultAnalyticsService);

  // Governance and risk
  getVaultGovernanceProposals = vaultGovernanceService.getVaultGovernanceProposals.bind(vaultGovernanceService);
  performRiskAssessment = vaultGovernanceService.performRiskAssessment.bind(vaultGovernanceService);

  // Helper methods
  getVaultById = vaultHelperService.getVaultById.bind(vaultHelperService);
  checkVaultPermissions = vaultHelperService.checkVaultPermissions.bind(vaultHelperService);

  // Utility methods
  getTokenPriceUSD = vaultUtilities.getTokenPriceUSD.bind(vaultUtilities);

  // Aliases for backward compatibility
  async getVaultTransactions(vaultId: string, userId?: string, page: number = 1, limit: number = 10) {
    return this.getVaultTransactionsPaginated(vaultId, userId, page, limit);
  }

  async getVaultPerformance(vaultId: string, userId?: string) {
    return this.getVaultPerformanceHistory(vaultId, userId);
  }

  async getVaultPortfolio(vaultId: string, userId?: string) {
    return this.getVaultDetails(vaultId, userId);
  }

  /**
   * Claim daily challenge reward
   * This method is kept in the main service for backward compatibility
   * but delegates to analytics service
   */
  async claimDailyChallengeReward(userId: string): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { db } = await import('../../db');
      const { userChallenges } = await import('../../../shared/schema');
      const { and, eq, sql } = await import('drizzle-orm');

      const userChallenge = await db.query.userChallenges.findFirst({
        where: and(
          eq(userChallenges.userId, userId),
          sql`DATE(${userChallenges.createdAt}) = ${today}`,
          eq(userChallenges.status, 'completed')
        )
      });

      if (!userChallenge) {
        throw new Error('No completed challenge found for today');
      }

      // Mark as claimed
      await db.update(userChallenges)
        .set({
          status: 'claimed',
          updatedAt: new Date()
        })
        .where(eq(userChallenges.id, userChallenge.id));

      return {
        success: true,
        reward: userChallenge.pointsReward,
        message: `Claimed ${userChallenge.pointsReward} points!`
      };
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
export const vaultService = new VaultService();

// Also export individual services for direct access if needed
export {
  vaultCreationService,
  vaultOperationsService,
  vaultAnalyticsService,
  vaultGovernanceService,
  vaultHelperService,
  vaultUtilities
};

// Export types
export type {
  CreateVaultRequest,
  VaultDepositRequest,
  VaultWithdrawRequest,
  StrategyAllocationRequest,
  Vault,
  VaultTransaction
};
