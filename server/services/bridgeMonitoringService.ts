
import { Logger } from '../utils/logger';
import { db } from '../db';
import { bridgeTransfers, users, type BridgeTransfer } from '../../shared/schema';
import { crossChainTransfers } from '../../shared/accountSchema';
import { notificationService } from '../notificationService';
import { eq, and, lte, gte, sql } from 'drizzle-orm';

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
        lte(bridgeTransfers.createdAt, thirtyMinutesAgo)
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
        avgTimeToLastUpdateSeconds: sql<number>`
          avg(extract(epoch from (${bridgeTransfers.updatedAt} - ${bridgeTransfers.createdAt})))
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
    const [totals] = await db.select({
      completedTransfers: sql<number>`count(*)::int`,
      bridgeFeesRecordedUSD: sql<string>`coalesce(sum(${crossChainTransfers.bridgeFee}), 0)::text`,
      sourceGasRecordedUSD: sql<string>`coalesce(sum(${crossChainTransfers.gasFeeSource}), 0)::text`,
      destinationGasRecordedUSD: sql<string>`coalesce(sum(${crossChainTransfers.gasFeeTarget}), 0)::text`,
      totalCostsRecordedUSD: sql<string>`coalesce(sum(${crossChainTransfers.totalCostUSD}), 0)::text`,
      transfersWithNonzeroBridgeFee: sql<number>`count(*) filter (where ${crossChainTransfers.bridgeFee} > 0)::int`,
    }).from(crossChainTransfers).where(and(
      gte(crossChainTransfers.createdAt, startDate),
      eq(crossChainTransfers.status, 'completed')
    ));

    return {
      available: true as const,
      timeframe,
      startDate: startDate.toISOString(),
      currency: 'USD',
      ...totals,
      collectionStatus: 'partial' as const,
      bridgeFeeAmountsPersisted: true,
      actualFeeCaptureWiredToBridgeExecution: false,
      note: 'Totals report fee amounts recorded on completed cross-chain transfer rows. The live bridge execution path does not yet populate actual protocol settlement fees, so zero totals are not proof that no fee was paid.',
    };
  }

  private async alertDelayedTransfer(transfer: BridgeTransfer) {
    this.logger.error(`Bridge transfer delayed: ${transfer.id}`, {
      sourceChain: transfer.sourceChain,
      destinationChain: transfer.destinationChain,
      amount: transfer.amount,
      ageMs: transfer.createdAt ? Date.now() - transfer.createdAt.getTime() : undefined,
    });

    if (!transfer.fromAddress) return;
    const owner = await db.query.users.findFirst({
      where: eq(users.walletAddress, transfer.fromAddress),
      columns: { id: true },
    });
    if (!owner) {
      this.logger.warn(`No user is associated with delayed bridge transfer ${transfer.id}; notification was not delivered`);
      return;
    }

    await notificationService.sendNotification(owner.id, {
      type: 'bridge_transfer_delayed',
      title: 'Bridge transfer delayed',
      message: `Your transfer ${transfer.id} from ${transfer.sourceChain} to ${transfer.destinationChain} has remained pending for over 30 minutes.`,
      priority: 'high',
      metadata: {
        transferId: transfer.id,
        sourceChain: transfer.sourceChain,
        destinationChain: transfer.destinationChain,
        amount: transfer.amount,
        transactionHash: transfer.transactionHash,
      },
      coalesceKey: `bridge-delay:${transfer.id}`,
      coalesceWindowMs: 24 * 60 * 60 * 1000,
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
