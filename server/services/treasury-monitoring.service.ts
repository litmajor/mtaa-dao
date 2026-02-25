/**
 * Treasury Health Monitoring Service
 * 
 * Background cron job that periodically monitors treasury health
 * and stores snapshots for historical analysis and trending.
 * 
 * Runs every 6 hours by default (configurable)
 */

import cron from 'node-cron';
import { db } from '../db';
import { daos, vaultTokenHoldings, treasuryHealthHistory } from '../../shared/schema';
import { generateTreasuryIntelligence } from './treasury-intelligence.service';
import { desc } from 'drizzle-orm';
import { logger } from '../utils/logger';

interface TreasuryMonitoringConfig {
  enabled?: boolean;
  scheduleExpression?: string; // cron expression (default: every 6 hours)
  includeMetadata?: boolean;
  batchSize?: number;
}

let scheduledJob: cron.ScheduledTask | null = null;

/**
 * Initialize treasury health monitoring
 */
export function initTreasuryMonitoring(config: TreasuryMonitoringConfig = {}) {
  const {
    enabled = process.env.NODE_ENV === 'production',
    scheduleExpression = '0 */6 * * *', // Every 6 hours
    includeMetadata = false,
    batchSize = 10
  } = config;

  if (!enabled) {
    logger.info('Treasury health monitoring is disabled');
    return;
  }

  logger.info('Initializing treasury health monitoring', { scheduleExpression });

  scheduledJob = cron.schedule(scheduleExpression, async () => {
    try {
      await monitorAllTreasuryHealth(includeMetadata, batchSize);
    } catch (error) {
      logger.error('Treasury monitoring job failed', error as Error);
    }
  });

  // Run initial check after 1 minute
  setTimeout(() => {
    monitorAllTreasuryHealth(includeMetadata, batchSize)
      .catch(err => logger.error('Initial treasury monitoring check failed', err as Error));
  }, 60000);

  logger.info('Treasury health monitoring initialized');
}

/**
 * Stop the monitoring job
 */
export function stopTreasuryMonitoring() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob.destroy();
    scheduledJob = null;
    logger.info('Treasury health monitoring stopped');
  }
}

/**
 * Monitor all DAO treasuries
 */
async function monitorAllTreasuryHealth(
  includeMetadata: boolean = false,
  batchSize: number = 10
) {
  try {
    logger.info('Starting treasury health monitoring cycle');

    // Fetch all active DAOs
    const allDaos = await db.select().from(daos);

    if (allDaos.length === 0) {
      logger.info('No DAOs to monitor');
      return;
    }

    // Process in batches
    const batches = [];
    for (let i = 0; i < allDaos.length; i += batchSize) {
      batches.push(allDaos.slice(i, i + batchSize));
    }

    let successCount = 0;
    let failureCount = 0;

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(dao => analyzeSingleTreasuryHealth(dao, includeMetadata))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failureCount++;
          logger.warn('Failed to analyze treasury', { error: result.reason });
        }
      }
    }

    logger.info('Treasury health monitoring cycle completed', {
      total: allDaos.length,
      successful: successCount,
      failed: failureCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to monitor all treasury health', error as Error);
  }
}

/**
 * Analyze and store health for a single DAO treasury
 */
async function analyzeSingleTreasuryHealth(
  dao: any,
  includeMetadata: boolean = false
) {
  try {
    const daoId = dao.id;

    // Fetch vault holdings for this DAO
    const holdings = await db
      .select()
      .from(vaultTokenHoldings)
      .where(vaultTokenHoldings.vaultId === daoId);

    // Build treasury object
    const treasury = {
      daoId,
      daoType: (dao.daoType || 'free') as any,
      assets: holdings.map(h => ({
        symbol: h.tokenSymbol,
        chain: 'CELO' as any,
        amount: h.tokenAmount,
        decimals: h.tokenDecimals || 18,
      })),
    };

    // Generate intelligence
    const intelligence = await generateTreasuryIntelligence(treasury);

    // Calculate health metrics
    const { crossChainState, semanticSummary, risks, opportunities } = intelligence;

    // Store in history table
    await db.insert(treasuryHealthHistory).values({
      daoId,
      healthStatus: semanticSummary.healthStatus as any,
      healthScore: calculateHealthScore(intelligence),
      assetCount: holdings.length,
      totalValueUsd: crossChainState.totalValueUSD.toString(),
      stableExposurePercent: crossChainState.stableExposure.toString(),
      volatileExposurePercent: crossChainState.volatileExposure.toString(),
      yieldExposurePercent: crossChainState.yieldExposure.toString(),
      assetConcentration: crossChainState.assetConcentration.toString(),
      chainConcentration: crossChainState.chainConcentration.toString(),
      chainCount: Object.keys(crossChainState.exposureByChain).length,
      alertCount: risks.length,
      recommendationCount: opportunities.length,
      snapshotReason: 'scheduled',
      metadata: includeMetadata ? intelligence : {},
      recordedAt: new Date(),
    });

    logger.debug(`Treasury health recorded for DAO ${daoId}`, {
      status: semanticSummary.healthStatus,
      score: calculateHealthScore(intelligence),
      assetCount: holdings.length,
    });

  } catch (error) {
    logger.error(`Failed to analyze treasury health for DAO`, error as Error);
    throw error;
  }
}

/**
 * Calculate health score (0-100) from treasury intelligence
 * Matches calculation in API endpoint
 */
function calculateHealthScore(intelligence: any): number {
  const { crossChainState, risks } = intelligence;

  let score = 100;

  // Deductions based on exposures
  if (crossChainState.volatileExposure > 80) score -= 30;
  else if (crossChainState.volatileExposure > 60) score -= 15;
  else if (crossChainState.volatileExposure > 40) score -= 5;

  if (crossChainState.chainConcentration > 0.8) score -= 20;
  else if (crossChainState.chainConcentration > 0.6) score -= 10;

  if (crossChainState.stableExposure < 30 && crossChainState.totalValueUSD > 1000) score -= 15;

  // Bonuses
  if (Object.keys(crossChainState.exposureByChain).length > 2) score += 5;
  if (crossChainState.assetConcentration < 0.3) score += 10;

  // Risk deductions
  score -= Math.min(risks.length * 3, 15);

  return Math.max(0, Math.min(100, score));
}

/**
 * Manually trigger health monitoring for a specific DAO
 * Useful for on-demand analysis after significant treasury changes
 */
export async function monitorDaoTreasuryNow(daoId: string) {
  try {
    const daoResult = await db.select().from(daos).where(daos.id === daoId);

    if (daoResult.length === 0) {
      throw new Error(`DAO not found: ${daoId}`);
    }

    await analyzeSingleTreasuryHealth(daoResult[0], true);
    logger.info(`Manual treasury health check completed for DAO ${daoId}`);

  } catch (error) {
    logger.error(`Failed to run manual treasury health check for DAO ${daoId}`, error as Error);
    throw error;
  }
}

/**
 * Get historical health data for a DAO
 */
export async function getTreasuryHealthHistory(
  daoId: string,
  days: number = 30
): Promise<any[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const history = await db
      .select()
      .from(treasuryHealthHistory)
      .where(
        treasuryHealthHistory.daoId === daoId &&
        treasuryHealthHistory.recordedAt >= cutoffDate
      )
      .orderBy(desc(treasuryHealthHistory.recordedAt));

    return history.map(h => ({
      timestamp: h.recordedAt,
      status: h.healthStatus,
      score: h.healthScore,
      assetCount: h.assetCount,
      volatileExposure: h.volatileExposurePercent,
      stableExposure: h.stableExposurePercent,
      chainCount: h.chainCount,
    }));

  } catch (error) {
    logger.error(`Failed to fetch treasury health history for DAO ${daoId}`, error as Error);
    return [];
  }
}

/**
 * Get latest health status for a DAO
 */
export async function getLatestTreasuryHealth(daoId: string) {
  try {
    const latest = await db
      .select()
      .from(treasuryHealthHistory)
      .where(treasuryHealthHistory.daoId === daoId)
      .orderBy(desc(treasuryHealthHistory.recordedAt))
      .limit(1);

    return latest.length > 0 ? latest[0] : null;

  } catch (error) {
    logger.error(`Failed to fetch latest treasury health for DAO ${daoId}`, error as Error);
    return null;
  }
}

/**
 * Cleanup old health history records (older than 90 days)
 * Can be called as part of a maintenance routine
 */
export async function cleanupOldHealthHistory(daysToKeep: number = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // This would need to be implemented with proper drizzle delete syntax
    logger.info(`Cleanup of treasury health history older than ${daysToKeep} days not yet implemented`);

  } catch (error) {
    logger.error('Failed to cleanup old health history', error as Error);
  }
}

export { treasuryHealthHistory };
