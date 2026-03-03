/**
 * Pool & Vault Job Worker
 * Processes rebalancing and heavy pool/vault operations asynchronously
 */

import { Job } from 'bull';
import type { JobPayload } from '../services/jobQueueService';
import { jobQueueService } from '../services/jobQueueService';
import { logger } from '../utils/logger';

export class PoolVaultJobWorker {
  /**
   * Initialize pool/vault job processors
   */
  static initialize() {
    jobQueueService.registerProcessor(
      'pool-rebalance',
      async (job: Job<JobPayload>) => await this.processPoolRebalance(job),
      { concurrency: 2 } // 2 concurrent rebalances
    );

    jobQueueService.registerProcessor(
      'vault-rebalance',
      async (job: Job<JobPayload>) => await this.processVaultRebalance(job),
      { concurrency: 2 } // 2 concurrent vault rebalances
    );

    logger.info('[PoolVaultJobWorker] Initialized with 2 pool + 2 vault slots');
  }

  /**
   * Process pool rebalancing job
   */
  static async processPoolRebalance(job: Job<JobPayload>): Promise<any> {
    const { userId, poolId, force = false } = job.data;

    try {
      logger.info(`[PoolRebalance] Starting for pool ${poolId} by user ${userId}`);

      await job.progress(10);

      // Get pool data
      const poolData = await this.getPoolData(poolId);
      if (!poolData) {
        throw new Error(`Pool ${poolId} not found`);
      }

      await job.progress(30);

      // Calculate optimal allocations
      const rebalancePlan = await this.calculateRebalance(poolId, poolData);

      await job.progress(60);

      // Execute rebalancing transactions
      const rebalanceResult = await this.executePoolRebalance(poolId, rebalancePlan);

      await job.progress(90);

      const result = {
        poolId,
        userId,
        rebalanceResult,
        completedAt: new Date(),
        duration: Date.now() - job.data.timestamp
      };

      logger.info(`[PoolRebalance] Completed for pool ${poolId}`);
      return result;
    } catch (error) {
      logger.error(`[PoolRebalance] Failed for pool ${poolId}:`, error);
      throw error;
    }
  }

  /**
   * Process vault rebalancing job
   */
  static async processVaultRebalance(job: Job<JobPayload>): Promise<any> {
    const { userId, vaultId } = job.data;

    try {
      logger.info(`[VaultRebalance] Starting for vault ${vaultId} by user ${userId}`);

      await job.progress(15);

      // Load vault portfolio data
      const vaultData = await this.getVaultData(vaultId, userId);
      if (!vaultData) {
        throw new Error(`Vault ${vaultId} not found or unauthorized`);
      }

      await job.progress(40);

      // Calculate optimal portfolio
      const rebalancePlan = await this.calculateVaultRebalance(vaultId, vaultData);

      await job.progress(75);

      // Execute rebalancing
      const result = await this.executeVaultRebalance(vaultId, rebalancePlan);

      await job.progress(90);

      const endResult = {
        vaultId,
        userId,
        result,
        completedAt: new Date(),
        duration: Date.now() - job.data.timestamp
      };

      logger.info(`[VaultRebalance] Completed for vault ${vaultId}`);
      return endResult;
    } catch (error) {
      logger.error(`[VaultRebalance] Failed for vault ${vaultId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch pool data from database
   */
  private static async getPoolData(poolId: string) {
    try {
      const { db } = await import('../db');
      const { investmentPools } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      const pool = await db.query.investmentPools.findFirst({
        where: eq(investmentPools.id, poolId)
      });

      return pool;
    } catch (error) {
      logger.warn('Failed to fetch pool data:', error);
      return null;
    }
  }

  /**
   * Fetch vault data
   */
  private static async getVaultData(vaultId: string, userId: string) {
    try {
      const { db } = await import('../db');
      const { vaults } = await import('../../shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const vault = await db.query.vaults.findFirst({
        where: and(
          eq(vaults.id, vaultId),
          eq(vaults.manager, userId)
        )
      });

      return vault;
    } catch (error) {
      logger.warn('Failed to fetch vault data:', error);
      return null;
    }
  }

  /**
   * Calculate pool rebalancing plan
   */
  private static async calculateRebalance(poolId: string, poolData: any) {
    try {
      const { investmentPoolPricingService } = await import('../services/investmentPoolPricingService');
      const plan = await investmentPoolPricingService.calculateOptimalAllocation(poolId, poolData);
      return plan;
    } catch (error) {
      logger.warn('Failed to calculate rebalance plan:', error);
      return poolData;
    }
  }

  /**
   * Calculate vault rebalancing plan
   */
  private static async calculateVaultRebalance(vaultId: string, vaultData: any) {
    try {
      const { smartRouterService } = await import('../services/smartRouterService');
      const plan = await smartRouterService.optimizeAllocation(vaultData);
      return plan;
    } catch (error) {
      logger.warn('Failed to calculate vault rebalance plan:', error);
      return vaultData;
    }
  }

  /**
   * Execute pool rebalancing
   */
  private static async executePoolRebalance(poolId: string, plan: any) {
    try {
      const { db } = await import('../db');
      const { investmentPools } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      // Update pool allocations in database
      const result = await db
        .update(investmentPools)
        .set({
          allocations: plan.allocations,
          rebalancedAt: new Date()
        })
        .where(eq(investmentPools.id, poolId))
        .returning();

      return result[0] || null;
    } catch (error) {
      logger.warn('Failed to execute pool rebalance:', error);
      throw error;
    }
  }

  /**
   * Execute vault rebalancing
   */
  private static async executeVaultRebalance(vaultId: string, plan: any) {
    try {
      const { db } = await import('../db');
      const { vaults } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      // Update vault allocations
      const result = await db
        .update(vaults)
        .set({
          allocations: plan.allocations,
          lastRebalancedAt: new Date()
        })
        .where(eq(vaults.id, vaultId))
        .returning();

      return result[0] || null;
    } catch (error) {
      logger.warn('Failed to execute vault rebalance:', error);
      throw error;
    }
  }
}

