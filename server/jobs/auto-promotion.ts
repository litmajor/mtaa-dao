/**
 * Auto-Promotion Job
 * 
 * Scheduled job that runs periodically to:
 * 1. Check all members for promotion eligibility
 * 2. Auto-promote eligible members
 * 3. Send notifications to newly promoted members
 */

import { logger } from '../utils/logger';
import { db } from '../storage';
import { PromotionService } from '../services/promotion-service';
import { notificationService } from '../notificationService';
import { daos } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export class AutoPromotionJob {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start the auto-promotion job
   * Runs every 1 hour by default
   */
  start(intervalMs: number = 60 * 60 * 1000): void {
    if (this.isRunning) {
      logger.warn('Auto-promotion job is already running');
      return;
    }

    logger.info('Starting auto-promotion job', { intervalMs });
    this.isRunning = true;

    // Run immediately on start
    this.runCheck().catch((error) => {
      logger.error('Auto-promotion job failed on startup:', error);
    });

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runCheck().catch((error) => {
        logger.error('Auto-promotion job failed:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop the auto-promotion job
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('Auto-promotion job stopped');
  }

  /**
   * Run a single check for promotion eligibility
   */
  private async runCheck(): Promise<void> {
    const startTime = Date.now();
    let promotionCount = 0;

    try {
      logger.debug('Running auto-promotion check...');

      // Get all active DAOs
      const allDaos = await db.select({ id: daos.id }).from(daos);

      logger.debug('Checking promotions for DAOs', { daoCount: allDaos.length });

      // Check each DAO
      for (const daoRow of allDaos) {
        const daoId = daoRow.id;

        try {
          // Auto-promote eligible users in this DAO
          const promotedUsers = await PromotionService.autoPromoteEligibleUsers(daoId);
          promotionCount += promotedUsers.length;

          if (promotedUsers.length > 0) {
            logger.info('Auto-promoted users', {
              daoId,
              count: promotedUsers.length,
              users: promotedUsers.map(p => ({
                userId: p.userId,
                fromRole: p.fromRole,
                toRole: p.toRole,
              })),
            });

            // Send notifications for each promoted user
            await this.notifyPromotedUsers(daoId, promotedUsers);
          }
        } catch (error) {
          logger.error('Error checking DAO for promotions:', error, { daoId });
          // Continue with next DAO
          continue;
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Auto-promotion check completed', {
        daoCount: allDaos.length,
        promotionCount,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Auto-promotion job error:', error, {
        durationMs: duration,
        promotionCount,
      });
    }
  }

  /**
   * Send notifications to promoted users
   */
  private async notifyPromotedUsers(
    daoId: string,
    promotions: any[]
  ): Promise<void> {
    try {
      for (const promotion of promotions) {
        // Send notification to promoted user
        await notificationService.createNotification({
          userId: promotion.userId,
          title: 'Promotion Achievement! 🚀',
          message: `You've been promoted to ${promotion.toRole} in the DAO!`,
          type: 'promotion',
          metadata: {
            daoId,
            fromRole: promotion.fromRole,
            toRole: promotion.toRole,
            promotedBy: promotion.promotedBy,
            actionUrl: `/dao/${daoId}/governance`,
          },
        });

        logger.debug('Promotion notification sent', {
          userId: promotion.userId,
          toRole: promotion.toRole,
        });
      }
    } catch (error) {
      logger.error('Error sending promotion notifications:', error);
      // Don't throw - notifications are not critical
    }
  }
}

/**
 * Singleton instance
 */
export const autoPromotionJob = new AutoPromotionJob();

/**
 * Initialize the job (call from server startup)
 */
export function initializeAutoPromotionJob(): void {
  autoPromotionJob.start(
    parseInt(process.env.AUTO_PROMOTION_INTERVAL_MS || '3600000')
  );
}

export default { autoPromotionJob, initializeAutoPromotionJob };
