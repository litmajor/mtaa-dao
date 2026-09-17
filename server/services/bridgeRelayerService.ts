import { db } from '../db';
import { crossChainTransfers } from '../../shared/accountSchema';
import { eq, inArray } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { getBridgeIntegration, type BridgeChain, type BridgeProtocol } from './bridgeIntegration';

export class BridgeRelayerService {
  private logger = Logger.getLogger();
  private isRunning = false;
  private pollInterval = 30000; // 30 seconds
  private bridgeIntegration = getBridgeIntegration();

  /**
   * Start the relayer service
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Relayer service already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('🚀 Bridge relayer service started');
    this.pollPendingTransfers();
  }

  /**
   * Stop the relayer service
   */
  stop(): void {
    this.isRunning = false;
    this.logger.info('Bridge relayer service stopped');
  }

  /**
   * Poll for pending or bridging transfers and advance them using the shared bridge integration layer.
   */
  private async pollPendingTransfers(): Promise<void> {
    while (this.isRunning) {
      try {
        const pendingTransfers = await db.query.crossChainTransfers.findMany({
          where: inArray(crossChainTransfers.status, ['pending', 'bridging']),
        });

        for (const transfer of pendingTransfers) {
          await this.processTransfer(transfer);
        }

        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      } catch (error) {
        this.logger.error('Error polling transfers:', error);
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      }
    }
  }

  /**
   * Process a single transfer.
   */
  private async processTransfer(transfer: typeof crossChainTransfers.$inferSelect): Promise<void> {
    try {
      this.logger.info(`Processing transfer: ${transfer.id}`);

      if (!transfer.sourceTxHash || transfer.sourceTxHash.startsWith('pending_')) {
        this.logger.warn(`Transfer ${transfer.id} has not reached a real source transaction hash yet; waiting`);
        return;
      }

      const protocol = this.normalizeProtocol(transfer.bridgeProtocol);
      const sourceChain = transfer.sourceChain as BridgeChain;
      const targetChain = transfer.targetChain as BridgeChain;

      await db.update(crossChainTransfers)
        .set({
          status: 'bridging',
          bridgeInitiatedAt: transfer.bridgeInitiatedAt ?? new Date(),
          statusReason: null,
        })
        .where(eq(crossChainTransfers.id, transfer.id));

      const bridgeStatus = await this.bridgeIntegration.checkStatus(
        protocol,
        transfer.sourceTxHash,
        sourceChain,
        targetChain
      );

      if (bridgeStatus.status === 'completed') {
        await db.update(crossChainTransfers)
          .set({
            status: 'completed',
            bridgeTransactionHash: bridgeStatus.transactionHash || transfer.bridgeTransactionHash || transfer.sourceTxHash,
            confirmedAt: transfer.confirmedAt ?? new Date(),
            completedAt: new Date(),
            statusReason: null,
          })
          .where(eq(crossChainTransfers.id, transfer.id));

        this.logger.info(`Transfer ${transfer.id} completed successfully`);
        return;
      }

      if (bridgeStatus.status === 'failed') {
        await db.update(crossChainTransfers)
          .set({
            status: 'failed',
            statusReason: bridgeStatus.failureReason || 'Bridge status reported failure',
          })
          .where(eq(crossChainTransfers.id, transfer.id));
        return;
      }

      await db.update(crossChainTransfers)
        .set({
          status: 'bridging',
          statusReason: bridgeStatus.status === 'not_found' ? 'Bridge transaction not found yet' : null,
        })
        .where(eq(crossChainTransfers.id, transfer.id));
    } catch (error) {
      this.logger.error(`Failed to process transfer ${transfer.id}:`, error);

      await db.update(crossChainTransfers)
        .set({
          status: 'failed',
          statusReason: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(crossChainTransfers.id, transfer.id));
    }
  }

  private normalizeProtocol(protocol: string | null | undefined): BridgeProtocol {
    if (protocol && ['layerzero', 'axelar', 'wormhole', 'stargate'].includes(protocol)) {
      return protocol as BridgeProtocol;
    }

    return 'wormhole';
  }

  /**
   * Manually retry failed transfer.
   */
  async retryTransfer(transferId: string): Promise<void> {
    const transfer = await db.query.crossChainTransfers.findFirst({
      where: eq(crossChainTransfers.id, transferId),
    });

    if (!transfer) {
      throw new AppError('Transfer not found', 404);
    }

    if (transfer.status !== 'failed') {
      throw new AppError('Can only retry failed transfers', 400);
    }

    await db.update(crossChainTransfers)
      .set({
        status: 'pending',
        statusReason: null,
        bridgeInitiatedAt: null,
        confirmedAt: null,
        completedAt: null,
      })
      .where(eq(crossChainTransfers.id, transferId));

    this.logger.info(`Transfer ${transferId} queued for retry`);
  }
}

export const bridgeRelayerService = new BridgeRelayerService();