
import { Logger } from '../utils/logger';
import { db } from '../db';
import { bridgeTransfers } from '@/shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export class BridgeMonitoringService {
  private logger = Logger.getLogger();

  /**
   * Monitor pending transfers and alert on delays
   */
  async monitorPendingTransfers() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const delayedTransfers = await db.query.bridgeTransfers.findMany({
      where: and(
        eq(bridgeTransfers.status, 'pending'),
        gte(bridgeTransfers.createdAt, thirtyMinutesAgo)
      )
    });

    if (delayedTransfers.length > 0) {
      this.logger.warn(`Found ${delayedTransfers.length} delayed bridge transfers`, {
        transfers: delayedTransfers.map(t => t.id)
      });
      
      // Trigger alerts for delayed transfers
      for (const transfer of delayedTransfers) {
        await this.alertDelayedTransfer(transfer);
      }
    }
  }

  /**
   * Get bridge analytics
   */
  async getBridgeAnalytics(timeframe: 'day' | 'week' | 'month' = 'day') {
    const startDate = this.getStartDate(timeframe);

    const analytics = await db
      .select({
        sourceChain: bridgeTransfers.sourceChain,
        destinationChain: bridgeTransfers.destinationChain,
        totalTransfers: sql<number>`count(*)`,
        totalVolume: sql<number>`sum(${bridgeTransfers.amount})`,
        successRate: sql<number>`
          (count(case when ${bridgeTransfers.status} = 'completed' then 1 end)::float / count(*)::float) * 100
        `,
        avgTime: sql<number>`
          avg(extract(epoch from (${bridgeTransfers.completedAt} - ${bridgeTransfers.createdAt})))
        `
      })
      .from(bridgeTransfers)
      .where(gte(bridgeTransfers.createdAt, startDate))
      .groupBy(bridgeTransfers.sourceChain, bridgeTransfers.destinationChain);

    return analytics;
  }

  /**
   * Calculate bridge fees collected
   */
  async calculateFeesCollected(timeframe: 'day' | 'week' | 'month' = 'day') {
    const startDate = this.getStartDate(timeframe);

    const fees = await db
      .select({
        totalFees: sql<number>`sum(${bridgeTransfers.bridgeFee})`
      })
      .from(bridgeTransfers)
      .where(
        and(
          gte(bridgeTransfers.createdAt, startDate),
          eq(bridgeTransfers.status, 'completed')
        )
      );

    return fees[0]?.totalFees || 0;
  }

  private async alertDelayedTransfer(transfer: any) {
    // Implement notification logic
    this.logger.error(`Bridge transfer delayed: ${transfer.id}`, {
      sourceChain: transfer.sourceChain,
      destinationChain: transfer.destinationChain,
      amount: transfer.amount,
      age: Date.now() - transfer.createdAt.getTime()
    });
  }

  private getStartDate(timeframe: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (timeframe) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }
}

export const bridgeMonitoringService = new BridgeMonitoringService();
