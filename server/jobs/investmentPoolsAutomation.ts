import cron from 'node-cron';
import { logger } from '../utils/logger';
import { rebalancingService } from '../services/rebalancingService';
import { performanceTrackingService } from '../services/performanceTrackingService';
import { db } from '../db';
import { investmentPools } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { jobQueueService } from '../services/jobQueueService';

/**
 * Investment Pools Automation
 * Scheduled tasks for rebalancing, performance tracking, and price recording
 */

export function setupInvestmentPoolsAutomation() {
  logger.info('🤖 Setting up investment pools automation...');

  // Record asset prices every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await rebalancingService.recordAssetPrices();
    } catch (error) {
      logger.error('Error in price recording job:', error);
    }
  });
  logger.info('✅ Price recording job scheduled (every 5 minutes)');

  // Record performance snapshots every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await performanceTrackingService.recordAllPoolSnapshots();
    } catch (error) {
      logger.error('Error in performance tracking job:', error);
    }
  });
  logger.info('✅ Performance tracking job scheduled (every hour)');

  // Refresh mark-to-market share prices every 15 minutes.
  cron.schedule('*/15 * * * *', async () => {
    try {
      const activePools = await db
        .select({ id: investmentPools.id })
        .from(investmentPools)
        .where(eq(investmentPools.isActive, true));
      const period = Math.floor(Date.now() / (15 * 60 * 1000));
      for (const pool of activePools) {
        try {
          await jobQueueService.queueJob(
            'pool-valuation',
            { userId: 'system', poolId: pool.id },
            { attempts: 3, jobId: `pool-valuation-${pool.id}-${period}` }
          );
        } catch (error) {
          logger.error('Failed to queue valuation for investment pool', {
            poolId: pool.id,
            error,
          });
        }
      }
    } catch (error) {
      logger.error('Error queuing pool valuation jobs:', error);
    }
  });
  logger.info('✅ Pool valuation job scheduled (every 15 minutes)');

  // Check and rebalance pools every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      await rebalancingService.checkAndRebalanceAll();
    } catch (error) {
      logger.error('Error in rebalancing job:', error);
    }
  });
  logger.info('✅ Rebalancing check job scheduled (every 6 hours)');

  // Daily summary at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('📊 Daily Investment Pools Summary:');
      // Could add email notifications or dashboard updates here
    } catch (error) {
      logger.error('Error in daily summary job:', error);
    }
  });
  logger.info('✅ Daily summary job scheduled (midnight)');

  logger.info('🚀 Investment pools automation is running!');
}

// Manual trigger functions for testing/admin use
export async function triggerManualRebalance(poolId?: string) {
  if (poolId) {
    return await rebalancingService.checkAndRebalancePool(poolId);
  } else {
    await rebalancingService.checkAndRebalanceAll();
  }
}

export async function triggerManualSnapshot(poolId?: string) {
  if (poolId) {
    await performanceTrackingService.recordPoolSnapshot(poolId);
  } else {
    await performanceTrackingService.recordAllPoolSnapshots();
  }
}

export async function triggerPriceRecording() {
  await rebalancingService.recordAssetPrices();
}
