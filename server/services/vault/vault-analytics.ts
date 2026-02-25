/**
 * Vault Service - Analytics Module
 * 
 * Handles analytics, reporting, and data queries
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  vaults,
  vaultTransactions,
  vaultPerformance,
  vaultRiskAssessments,
  vaultStrategyAllocations,
  daoMemberships,
  userChallenges,
  proposals,
  type VaultTransaction
} from '../../../shared/schema';
import { YIELD_STRATEGIES } from '../../../shared/tokenRegistry';
import { Logger } from "../../utils/logger";
import { getErrorMessage } from '../../utils/errorUtils';
import { AppError } from "../../middleware/errorHandler";
import { vaultHelperService } from './vault-helpers';

/**
 * VaultAnalyticsService - Handles analytics and data retrieval
 */
export class VaultAnalyticsService {
  /**
   * Get all vaults for a user (personal and DAO)
   */
  async getUserVaults(userAddress: string): Promise<any[]> {
    try {
      // Get user's personal vaults
      const personalVaultsRaw = await db.query.vaults.findMany({
        where: eq(vaults.userId, userAddress)
      });

      const personalVaults = await Promise.all(personalVaultsRaw.map(async (vault: any) => {
        const tokenHoldings = await vaultHelperService.getVaultHoldings(vault.id);
        return { ...vault, tokenHoldings };
      }));

      // Get DAO vaults where user is a member
      const userDaoMemberships = await db.query.daoMemberships.findMany({
        where: and(
          eq(daoMemberships.userId, userAddress),
          eq(daoMemberships.status, 'approved')
        )
      });

      const daoIds = userDaoMemberships.map((m: any) => m.daoId);
      const daoVaultsRaw = daoIds.length > 0 ? await db.query.vaults.findMany({
        where: and(
          sql`${vaults.daoId} IN (${daoIds.join(',')})`,
          eq(vaults.isActive, true)
        )
      }) : [];

      const daoVaults = await Promise.all(daoVaultsRaw.map(async (vault: any) => {
        const tokenHoldings = await vaultHelperService.getVaultHoldings(vault.id);
        return { ...vault, tokenHoldings };
      }));

      // Calculate performance and format response
      const allVaults = [...personalVaults, ...daoVaults].map((vault: any) => ({
        id: vault.id,
        name: vault.name,
        currency: vault.currency,
        vaultType: vault.vaultType,
        balance: this.calculateVaultBalance(vault),
        performance: vault.tokenHoldings ? this.calculatePerformance(vault.tokenHoldings) : 0,
        status: vault.isActive ? 'active' : 'inactive'
      }));

      return allVaults;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get user vaults: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get vault statistics for user
   */
  async getUserVaultStats(userAddress: string): Promise<any> {
    try {
      const userVaults = await this.getUserVaults(userAddress);

      const totalValue = userVaults.reduce((sum, vault) => sum + parseFloat(vault.balance || '0'), 0);
      const totalROI = userVaults.length > 0 
        ? userVaults.reduce((sum, vault) => sum + (vault.performance || 0), 0) / userVaults.length 
        : 0;

      const activeVaults = userVaults.filter(v => v.status === 'active').length;

      return {
        totalValue: totalValue.toFixed(2),
        totalROI: totalROI.toFixed(2),
        activeVaults,
        totalVaults: userVaults.length
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get user vault stats: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get vault alerts and recent notifications
   */
  async getVaultAlerts(vaultId: string): Promise<any[]> {
    try {
      const alerts = await db.query.vaultTransactions.findMany({
        where: and(
          eq(vaultTransactions.vaultId, vaultId),
          sql`${vaultTransactions.createdAt} > NOW() - INTERVAL '7 days'`
        ),
        orderBy: desc(vaultTransactions.createdAt),
        limit: 10
      });

      return alerts.map(tx => ({
        id: `alert-${tx.id}`,
        type: tx.transactionType === 'deposit' ? 'deposit' : tx.transactionType === 'withdrawal' ? 'withdrawal' : 'performance',
        message: `${tx.transactionType === 'deposit' ? 'New deposit' : 'Withdrawal'} of ${tx.amount} ${tx.tokenSymbol}`,
        severity: tx.transactionType === 'withdrawal' ? 'medium' : 'info',
        createdAt: tx.createdAt?.toISOString() || new Date().toISOString()
      }));
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get vault alerts: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get vault details with holdings, transactions, and risk assessment
   */
  async getVaultDetails(vaultId: string, userId?: string): Promise<any> {
    try {
      if (userId) {
        const hasPermission = await vaultHelperService.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view this vault', 403);
        }
      }

      const vault = await vaultHelperService.getVaultById(vaultId);
      if (!vault) {
        throw new AppError('Vault not found', 404);
      }

      const holdings = await vaultHelperService.getVaultHoldings(vaultId);
      const transactions = await this.getVaultTransactionsPaginated(vaultId, userId, 1, 10);
      const performance = await this.calculatePerformanceAsync(vault);
      const riskAssessment = await db.query.vaultRiskAssessments.findFirst({
        where: eq(vaultRiskAssessments.vaultId, vaultId),
        orderBy: [desc(vaultRiskAssessments.createdAt)]
      });

      return {
        vault,
        holdings,
        transactions: transactions.transactions,
        performance,
        riskScore: riskAssessment?.overallRiskScore || 50,
        riskFactors: riskAssessment?.riskFactors,
        recommendations: riskAssessment?.recommendations
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get details for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get all vaults dashboard info
   */
  async getAllVaultsDashboardInfo(): Promise<any[]> {
    try {
      const allVaultsRaw = await db.query.vaults.findMany({
        where: eq(vaults.isActive, true)
      });

      const allVaults = await Promise.all(allVaultsRaw.map(async (vault: any) => {
        const tokenHoldings = await vaultHelperService.getVaultHoldings(vault.id);
        return { ...vault, tokenHoldings };
      }));

      const result: any[] = [];
      for (const vault of allVaults) {
        result.push({
          id: vault.id,
          name: vault.name,
          currency: vault.currency,
          balance: this.calculateVaultBalance(vault),
          performance: await this.calculatePerformanceAsync(vault),
          status: vault.isActive ? 'active' : 'top performer',
          tvl: vault.totalValueLocked || '0',
        });
      }
      return result;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get all vaults dashboard info: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get vault transactions with pagination
   */
  async getVaultTransactionsPaginated(
    vaultId: string, 
    userId?: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<{
    transactions: VaultTransaction[];
    totalItems: number;
    totalPages: number;
  }> {
    try {
      if (userId) {
        const hasPermission = await vaultHelperService.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view this vault transactions', 403);
        }
      }

      const offset = (page - 1) * limit;

      const transactions = await db.query.vaultTransactions.findMany({
        where: eq(vaultTransactions.vaultId, vaultId),
        orderBy: [desc(vaultTransactions.createdAt)],
        limit,
        offset
      });

      const totalItems = (await db.select({ count: sql`count(*)` })
        .from(vaultTransactions)
        .where(eq(vaultTransactions.vaultId, vaultId)))[0]?.count as number || 0;
      
      const totalPages = Math.ceil(totalItems / limit);

      return {
        transactions,
        totalItems,
        totalPages
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get paginated transactions for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get vault performance history
   */
  async getVaultPerformanceHistory(vaultId: string, userId?: string): Promise<any[]> {
    try {
      if (userId) {
        const hasPermission = await vaultHelperService.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view this vault performance history', 403);
        }
      }

      return await db.query.vaultPerformance.findMany({
        where: eq(vaultPerformance.vaultId, vaultId),
        orderBy: [desc(vaultPerformance.createdAt)],
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get performance history for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get liquidity provider positions for a vault
   */
  async getVaultLpPositions(vaultId: string, userId?: string): Promise<any[]> {
    try {
      if (userId) {
        const hasPermission = await vaultHelperService.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view LP positions for this vault', 403);
        }
      }

      const allocations = await db.query.vaultStrategyAllocations.findMany({
        where: and(
          eq(vaultStrategyAllocations.vaultId, vaultId),
          eq(vaultStrategyAllocations.isActive, true)
        )
      });

      return allocations.map(allocation => {
        const strategy = YIELD_STRATEGIES[allocation.strategyId];
        return {
          id: allocation.id,
          vaultId: vaultId,
          poolName: `${allocation.tokenSymbol} ${strategy?.name || 'Pool'}`,
          provider: strategy?.protocol || 'Unknown',
          tokens: [allocation.tokenSymbol],
          yourStake: `${allocation.allocatedAmount} ${allocation.tokenSymbol}`,
          poolShare: `${allocation.allocationPercentage}%`,
          rewardsEarned: (allocation as any).yieldEarned || (allocation as any).earnedRewards || '0',
          tvlInPool: allocation.currentValue || allocation.allocatedAmount,
          createdAt: allocation.createdAt?.toISOString() || new Date().toISOString()
        };
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get LP positions for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get daily challenge status
   */
  async getDailyChallengeStatus(userId: string): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check user's vaults and calculate progress
      const userVaults = await this.getUserVaults(userId);
      const totalValue = userVaults.reduce((sum, vault) => sum + parseFloat(vault.balance || '0'), 0);

      // Get user's daily challenge record
      let todayChallenge = await db.query.userChallenges.findFirst({
        where: and(
          eq(userChallenges.userId, userId),
          sql`DATE(${userChallenges.createdAt}) = ${today}`
        )
      });

      if (!todayChallenge) {
        // Create new challenge for today
        const [newChallenge] = await db.insert(userChallenges).values({
          userId,
          challengeType: 'daily_deposit',
          targetAmount: '100',
          currentProgress: totalValue.toString(),
          status: totalValue >= 100 ? 'completed' : 'in_progress',
          pointsReward: 50
        }).returning();
        todayChallenge = newChallenge;
      }

      return {
        userId: userId,
        currentChallenge: {
          id: todayChallenge!.id,
          title: 'Daily Vault Target',
          description: 'Maintain at least $100 total value in your vaults',
          target: todayChallenge!.targetAmount,
          currentProgress: Math.min(totalValue, parseFloat(todayChallenge!.targetAmount || '100')).toString(),
          status: todayChallenge!.status,
          reward: `${todayChallenge!.pointsReward} MTAA`,
          createdAt: todayChallenge!.createdAt?.toISOString() || new Date().toISOString(),
          endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        streak: await this.getUserChallengeStreak(userId),
        nextChallengeAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get daily challenge status for user ${userId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get user wallet status
   */
  async getUserWalletStatus(userId: string): Promise<any> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(sql`id`, userId)
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const vaults = await this.getUserVaults(userId);
      const totalValue = vaults.reduce((sum, vault) => sum + parseFloat(vault.balance || '0'), 0);

      return {
        userId: userId,
        displayName: (user as any).displayName || 'User',
        walletBalance: totalValue.toFixed(2),
        numVaults: vaults.length,
        lastUpdated: new Date().toISOString(),
        address: (user as any).walletAddress || null,
        profile: {
          reputationScore: (user as any).reputationScore || 0,
          avatarUrl: (user as any).profileImageUrl || null
        }
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get wallet status for user ${userId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }

  /**
   * Calculate vault balance from holdings
   */
  private calculateVaultBalance(vault: any): string {
    if (!vault.tokenHoldings || vault.tokenHoldings.length === 0) {
      return '0.00';
    }

    const totalBalance = vault.tokenHoldings.reduce((sum: number, holding: any) => {
      return sum + parseFloat(holding.balance || '0');
    }, 0);

    return totalBalance.toFixed(2);
  }

  /**
   * Calculate performance from holdings
   */
  private calculatePerformance(holdings: any[]): number {
    if (!holdings || holdings.length === 0) return 0;

    const totalValue = holdings.reduce((sum: number, holding: any) => {
      return sum + parseFloat(holding.valueUSD || '0');
    }, 0);

    return totalValue > 0 ? ((totalValue / holdings.length) * 100) : 0;
  }

  /**
   * Calculate performance async from database
   */
  private async calculatePerformanceAsync(vault: any): Promise<number> {
    const performances = await db.query.vaultPerformance.findMany({
      where: eq(vaultPerformance.vaultId, vault.id),
      orderBy: [desc(vaultPerformance.periodEnd)],
      limit: 1
    });
    
    if (!performances.length) return 0;
    
    const latest = performances[0];
    const startValue = parseFloat(latest.startingValue || '0');
    const endValue = parseFloat(latest.endingValue || '0');
    
    return startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
  }

  /**
   * Get user challenge streak
   */
  private async getUserChallengeStreak(userId: string): Promise<number> {
    try {
      const completedChallenges = await db.query.userChallenges.findMany({
        where: and(
          eq(userChallenges.userId, userId),
          eq(userChallenges.status, 'completed')
        ),
        orderBy: [desc(userChallenges.createdAt)],
        limit: 30
      });

      // Calculate consecutive days
      let streak = 0;
      const today = new Date();
      
      for (let i = 0; i < completedChallenges.length; i++) {
        const challengeDate = new Date(completedChallenges[i].createdAt!);
        const daysDiff = Math.floor((today.getTime() - challengeDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === i) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      Logger.getLogger().warn(`Failed to calculate streak for user ${userId}: ${getErrorMessage(error)}`);
      return 0;
    }
  }
}

// Export singleton instance
export const vaultAnalyticsService = new VaultAnalyticsService();
