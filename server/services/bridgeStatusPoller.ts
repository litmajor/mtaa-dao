/**
 * Bridge Status Poller Service
 * Phase 3: Real-time withdrawal monitoring
 * Polls bridge status, updates database, handles completion/failures
 */

import { SupportedChain } from '../../shared/chainConfiguration';
import { getBridgeIntegration, BridgeProtocol } from './bridgeIntegration';
import { getMultiChainProvider } from './multiChainProvider';
import { db } from '../db';
import { crossChainTransfers } from '../../shared/accountSchema';
import { Logger } from '../utils/logger';
import { eq } from 'drizzle-orm';

const logger = new Logger('bridge-status-poller');

export interface PollingConfig {
  withdrawalId: string;
  bridgeProtocol: BridgeProtocol;
  bridgeTxHash: string;
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  estimatedCompletionTime: number;
}

export interface PollingResult {
  withdrawalId: string;
  status: 'pending' | 'confirmed' | 'failed' | 'completed';
  confirmations: number;
  targetTxHash?: string;
  completionTime?: number;
  failureReason?: string;
}

export class BridgeStatusPoller {
  private bridgeIntegration = getBridgeIntegration();
  private multiChainProvider = getMultiChainProvider();
  private activePollers = new Map<string, NodeJS.Timeout>();
  private pollingIntervals: Map<string, number> = new Map([
    ['layerzero', 30000], // 30s
    ['axelar', 45000], // 45s
    ['wormhole', 20000], // 20s
    ['stargate', 15000], // 15s
  ]);

  /**
   * Start polling for a withdrawal
   */
  startPolling(config: PollingConfig): void {
    const existingPoller = this.activePollers.get(config.withdrawalId);
    if (existingPoller) {
      clearInterval(existingPoller);
    }

    logger.info(`Starting polling for ${config.withdrawalId} (${config.bridgeProtocol})`);

    // Initial poll immediately
    this.pollBridgeStatus(config);

    // Then set interval
    const interval = this.pollingIntervals.get(config.bridgeProtocol) || 30000;
    const poller = setInterval(() => {
      this.pollBridgeStatus(config);
    }, interval);

    this.activePollers.set(config.withdrawalId, poller);
  }

  /**
   * Stop polling for a withdrawal
   */
  stopPolling(withdrawalId: string): void {
    const poller = this.activePollers.get(withdrawalId);
    if (poller) {
      clearInterval(poller);
      this.activePollers.delete(withdrawalId);
      logger.info(`Stopped polling for ${withdrawalId}`);
    }
  }

  /**
   * Poll single bridge status
   */
  private async pollBridgeStatus(config: PollingConfig): Promise<void> {
    try {
      const bridgeStatus = await this.bridgeIntegration.checkStatus(
        config.bridgeProtocol,
        config.bridgeTxHash,
        config.sourceChain,
        config.targetChain
      );

      logger.debug(
        `Status poll for ${config.withdrawalId}: ${bridgeStatus.status}`
      );

      // Update database with status
      await this.updateWithdrawalStatus(config.withdrawalId, bridgeStatus);

      // Check if transfer is complete
      if (bridgeStatus.status === 'completed') {
        logger.info(`Withdrawal ${config.withdrawalId} completed`);
        this.stopPolling(config.withdrawalId);
        await this.recordCompletion(config.withdrawalId);
      }

      // Check if transfer failed
      if (bridgeStatus.status === 'failed') {
        logger.warn(`Withdrawal ${config.withdrawalId} failed: ${bridgeStatus.failureReason}`);
        this.stopPolling(config.withdrawalId);
        await this.recordFailure(config.withdrawalId, bridgeStatus.failureReason);
      }
    } catch (error) {
      logger.error(
        `Error polling withdrawal ${config.withdrawalId}: ${(error as any).message}`
      );
      // Continue polling on error, don't stop
    }
  }

  /**
   * Get current withdrawal status
   */
  async getWithdrawalStatus(withdrawalId: string): Promise<PollingResult | null> {
    try {
      const transfer = await db
        .select()
        .from(crossChainTransfers)
        .where(eq(crossChainTransfers.withdrawalId, withdrawalId));

      if (!transfer || transfer.length === 0) {
        return null;
      }

      const t = transfer[0];

      // Determine status based on database record
      let status: 'pending' | 'confirmed' | 'failed' | 'completed' = 'pending';
      if (t.status === 'failed') {
        status = 'failed';
      } else if (t.status === 'completed') {
        status = 'completed';
      } else if (t.sourceTxHash) {
        status = 'confirmed';
      }

      return {
        withdrawalId,
        status,
        confirmations: 0,
        targetTxHash: t.targetTxHash || undefined,
        completionTime: t.completedAt
          ? Math.floor((t.completedAt.getTime() - t.createdAt.getTime()) / 1000)
          : undefined,
        failureReason: t.statusReason || undefined,
      };
    } catch (error) {
      logger.error(`Error getting withdrawal status: ${(error as any).message}`);
      return null;
    }
  }

  /**
   * Get status for multiple withdrawals (batch)
   */
  async getWithdrawalStatuses(withdrawalIds: string[]): Promise<Map<string, PollingResult>> {
    const results = new Map<string, PollingResult>();

    for (const id of withdrawalIds) {
      const result = await this.getWithdrawalStatus(id);
      if (result) {
        results.set(id, result);
      }
    }

    return results;
  }

  /**
   * Wait for withdrawal completion (useful for client-side polling)
   */
  async waitForCompletion(
    withdrawalId: string,
    timeout: number = 1800000
  ): Promise<PollingResult | null> {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds

    while (Date.now() - startTime < timeout) {
      const status = await this.getWithdrawalStatus(withdrawalId);

      if (!status) {
        throw new Error('Withdrawal not found');
      }

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'failed') {
        return status;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Withdrawal polling timeout');
  }

  /**
   * Database update methods
   */

  private async updateWithdrawalStatus(
    withdrawalId: string,
    bridgeStatus: any
  ): Promise<void> {
    try {
      const updateData: any = {
        status: bridgeStatus.status,
      };

      if (bridgeStatus.failureReason) {
        updateData.statusReason = bridgeStatus.failureReason;
      }

      await db
        .update(crossChainTransfers)
        .set(updateData)
        .where(eq(crossChainTransfers.withdrawalId, withdrawalId));

      logger.debug(`Updated withdrawal status: ${withdrawalId}`);
    } catch (error) {
      logger.error(`Failed to update withdrawal status: ${(error as any).message}`);
      throw error;
    }
  }

  private async recordCompletion(
    withdrawalId: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status: 'completed',
        completedAt: new Date(),
      };

      await db
        .update(crossChainTransfers)
        .set(updateData)
        .where(eq(crossChainTransfers.withdrawalId, withdrawalId));

      logger.info(`Recorded completion for withdrawal ${withdrawalId}`);

      // Emit completion event (for WebSocket/real-time updates)
      this.emitCompletionEvent(withdrawalId);
    } catch (error) {
      logger.error(`Failed to record completion: ${(error as any).message}`);
      throw error;
    }
  }

  private async recordFailure(withdrawalId: string, reason?: string): Promise<void> {
    try {
      await db
        .update(crossChainTransfers)
        .set({
          status: 'failed',
          statusReason: reason || 'Bridge transfer failed',
          completedAt: new Date(),
        })
        .where(eq(crossChainTransfers.withdrawalId, withdrawalId));

      logger.warn(`Recorded failure for withdrawal ${withdrawalId}: ${reason}`);

      // Emit failure event (for WebSocket/real-time updates)
      this.emitFailureEvent(withdrawalId, reason);
    } catch (error) {
      logger.error(`Failed to record failure: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Event emission for real-time updates
   * These would be WebSocket events in a production environment
   */

  private emitCompletionEvent(withdrawalId: string): void {
    logger.info(`Emission: Withdrawal ${withdrawalId} completed`);
    // TODO: Emit WebSocket event to client
    // globalEventEmitter.emit('withdrawal:completed', { withdrawalId });
  }

  private emitFailureEvent(withdrawalId: string, reason?: string): void {
    logger.warn(`Emission: Withdrawal ${withdrawalId} failed - ${reason}`);
    // TODO: Emit WebSocket event to client
    // globalEventEmitter.emit('withdrawal:failed', { withdrawalId, reason });
  }

  /**
   * Cleanup - stop all active pollers
   */
  stopAllPollers(): void {
    logger.info('Stopping all active pollers...');

    for (const [withdrawalId, poller] of this.activePollers.entries()) {
      clearInterval(poller);
      logger.debug(`Stopped poller for ${withdrawalId}`);
    }

    this.activePollers.clear();
  }

  /**
   * Get polling statistics
   */
  getPollingStats(): {
    activeCount: number;
    withdrawalIds: string[];
  } {
    return {
      activeCount: this.activePollers.size,
      withdrawalIds: Array.from(this.activePollers.keys()),
    };
  }
}

/**
 * Singleton instance
 */
let instance: BridgeStatusPoller | null = null;

export function initializeBridgeStatusPoller(): BridgeStatusPoller {
  if (!instance) {
    instance = new BridgeStatusPoller();
  }
  return instance;
}

export function getBridgeStatusPoller(): BridgeStatusPoller {
  if (!instance) {
    instance = new BridgeStatusPoller();
  }
  return instance;
}

export function destroyBridgeStatusPoller(): void {
  if (instance) {
    instance.stopAllPollers();
  }
  instance = null;
}
