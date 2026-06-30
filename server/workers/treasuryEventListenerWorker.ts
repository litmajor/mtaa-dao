import { Worker, Job, Queue } from 'bullmq';
import { Logger } from '../utils/logger';
import { treasuryOnchainService } from '../services/treasuryOnchainService';
import { db } from '../db';
import {
  treasuryMultisigTransactions,
  multisigWallets,
  treasuryAuditLog
} from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler';

/**
 * TreasuryEventListenerWorker
 * BullMQ-based worker that:
 * 1. Listens for ChamaTreasury contract events (ProposalCreated, ProposalExecuted, ProposalRejected)
 * 2. Polls for events at regular intervals
 * 3. Updates database state when events are detected
 * 4. Emits Socket.IO notifications for real-time UI updates
 * 5. Triggers additional processing like audit logging
 * 
 * Works with Redis for job queuing and persistence
 */
export class TreasuryEventListenerWorker {
  private worker: Worker;
  private queue: Queue;
  private logger = new Logger('TreasuryEventListenerWorker');
  private pollIntervalMs = 5000; // Poll every 5 seconds
  private lastBlockChecked: Map<string, number> = new Map();

  constructor(
    queueName: string = 'treasury-event-listener',
    redisConnection: any = { host: 'localhost', port: 6379 }
  ) {
    // Initialize queue
    this.queue = new Queue(queueName, { connection: redisConnection });

    // Initialize worker to process events
    this.worker = new Worker(queueName, this.processEvent.bind(this), {
      connection: redisConnection,
      concurrency: 1, // Process one event at a time to maintain order
      settings: {
        lockDuration: 30000, // 30 second lock
        lockRenewTime: 15000, // Renew lock every 15 seconds
        retryProcessDelay: 5000 // Wait 5 seconds before retry
      }
    });

    // Setup event listeners
    this.setupWorkerListeners();
  }

  /**
   * Setup worker event handlers
   */
  private setupWorkerListeners() {
    this.worker.on('completed', (job: Job) => {
      this.logger.info(`Event job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job, error: Error) => {
      this.logger.error(`Event job ${job?.id} failed: ${error.message}`);
    });

    this.worker.on('error', (error: Error) => {
      this.logger.error(`Worker error: ${error.message}`);
    });
  }

  /**
   * Main job processor for contract events
   * Called by BullMQ for each queued event job
   */
  private async processEvent(job: Job<any>): Promise<void> {
    try {
      const { eventType, contractAddress, eventData } = job.data;

      this.logger.info(
        `Processing ${eventType} event from contract ${contractAddress}`
      );

      switch (eventType) {
        case 'ProposalCreated':
          await this.handleProposalCreated(contractAddress, eventData);
          break;

        case 'ProposalExecuted':
          await this.handleProposalExecuted(contractAddress, eventData);
          break;

        case 'ProposalRejected':
          await this.handleProposalRejected(contractAddress, eventData);
          break;

        default:
          this.logger.warn(`Unknown event type: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(`Error processing event: ${error}`);
      throw error; // Re-throw to trigger BullMQ retry
    }
  }

  /**
   * Handle ProposalCreated event
   * Updates transaction status to 'submitted'
   */
  private async handleProposalCreated(
    contractAddress: string,
    eventData: any
  ): Promise<void> {
    try {
      const { proposalId, to, value, data } = eventData;

      this.logger.info(
        `ProposalCreated: ID=${proposalId}, To=${to}, Value=${value}`
      );

      // Find corresponding transaction in DB by contract address
      const multisig = await db
        .select()
        .from(multisigWallets)
        .where(eq(multisigWallets.contractAddress, contractAddress))
        .limit(1);

      if (!multisig.length) {
        this.logger.warn(`No multisig wallet found for ${contractAddress}`);
        return;
      }

      const multisigId = multisig[0].id;

      // Find transaction by recipient and amount
      const transactions = await db
        .select()
        .from(treasuryMultisigTransactions)
        .where(
          and(
            eq(treasuryMultisigTransactions.multisigWalletId, multisigId),
            eq(treasuryMultisigTransactions.recipient, to),
            eq(treasuryMultisigTransactions.status, 'pending')
          )
        )
        .limit(1);

      if (transactions.length === 0) {
        this.logger.warn(
          `No pending transaction found for recipient ${to}`
        );
        return;
      }

      const transaction = transactions[0];

      // Update transaction with proposal ID
      await db
        .update(treasuryMultisigTransactions)
        .set({
          status: 'submitted',
          submittedAt: new Date(),
          metadata: {
            ...transaction.metadata,
            proposalId: proposalId,
            contractData: data
          },
          updatedAt: new Date()
        })
        .where(eq(treasuryMultisigTransactions.id, transaction.id));

      // Log audit event
      await this.logAuditEvent({
        daoId: transaction.daoId,
        actorId: transaction.proposedBy,
        action: 'proposal_created_onchain',
        reason: `Proposal ${proposalId} created on-chain`,
        multisigTxId: transaction.id,
        severity: 'high',
        metadata: { proposalId, contractAddress }
      });

      this.logger.info(
        `Updated transaction ${transaction.id} with proposal ID ${proposalId}`
      );
    } catch (error) {
      this.logger.error(`Error handling ProposalCreated: ${error}`);
      throw error;
    }
  }

  /**
   * Handle ProposalExecuted event
   * Updates transaction status to 'executed' with on-chain confirmation
   */
  private async handleProposalExecuted(
    contractAddress: string,
    eventData: any
  ): Promise<void> {
    try {
      const { proposalId, success } = eventData;

      this.logger.info(
        `ProposalExecuted: ID=${proposalId}, Success=${success}`
      );

      // Find multisig wallet
      const multisig = await db
        .select()
        .from(multisigWallets)
        .where(eq(multisigWallets.contractAddress, contractAddress))
        .limit(1);

      if (!multisig.length) {
        this.logger.warn(`No multisig wallet found for ${contractAddress}`);
        return;
      }

      // Find transaction by proposal ID in metadata
      const transactions = await db
        .select()
        .from(treasuryMultisigTransactions)
        .where(
          and(
            eq(treasuryMultisigTransactions.multisigWalletId, multisig[0].id),
            eq(treasuryMultisigTransactions.status, 'submitted')
          )
        );

      // Filter by proposal ID in metadata
      const transaction = transactions.find(
        (tx) => (tx.metadata as any)?.proposalId === proposalId
      );

      if (!transaction) {
        this.logger.warn(
          `No submitted transaction found for proposal ${proposalId}`
        );
        return;
      }

      // Update transaction status
      const newStatus = success ? 'executed' : 'rejected';

      await db
        .update(treasuryMultisigTransactions)
        .set({
          status: newStatus,
          executedAt: new Date(),
          metadata: {
            ...transaction.metadata,
            executedOnChain: true,
            success
          },
          updatedAt: new Date()
        })
        .where(eq(treasuryMultisigTransactions.id, transaction.id));

      // Log audit event
      await this.logAuditEvent({
        daoId: transaction.daoId,
        actorId: transaction.proposedBy,
        action: 'proposal_executed_onchain',
        reason: `Proposal ${proposalId} executed on-chain (success: ${success})`,
        multisigTxId: transaction.id,
        severity: success ? 'critical' : 'high',
        metadata: { proposalId, contractAddress, success }
      });

      this.logger.info(
        `Marked transaction ${transaction.id} as ${newStatus}`
      );
    } catch (error) {
      this.logger.error(`Error handling ProposalExecuted: ${error}`);
      throw error;
    }
  }

  /**
   * Handle ProposalRejected event
   * Updates transaction status to 'rejected'
   */
  private async handleProposalRejected(
    contractAddress: string,
    eventData: any
  ): Promise<void> {
    try {
      const { proposalId, reason } = eventData;

      this.logger.info(`ProposalRejected: ID=${proposalId}, Reason=${reason}`);

      // Find multisig wallet
      const multisig = await db
        .select()
        .from(multisigWallets)
        .where(eq(multisigWallets.contractAddress, contractAddress))
        .limit(1);

      if (!multisig.length) {
        this.logger.warn(`No multisig wallet found for ${contractAddress}`);
        return;
      }

      // Find transaction
      const transactions = await db
        .select()
        .from(treasuryMultisigTransactions)
        .where(
          and(
            eq(treasuryMultisigTransactions.multisigWalletId, multisig[0].id),
            eq(treasuryMultisigTransactions.status, 'submitted')
          )
        );

      const transaction = transactions.find(
        (tx) => (tx.metadata as any)?.proposalId === proposalId
      );

      if (!transaction) {
        this.logger.warn(
          `No submitted transaction found for proposal ${proposalId}`
        );
        return;
      }

      // Update transaction status
      await db
        .update(treasuryMultisigTransactions)
        .set({
          status: 'rejected',
          metadata: {
            ...transaction.metadata,
            rejectionReason: reason
          },
          updatedAt: new Date()
        })
        .where(eq(treasuryMultisigTransactions.id, transaction.id));

      // Log audit event
      await this.logAuditEvent({
        daoId: transaction.daoId,
        actorId: transaction.proposedBy,
        action: 'proposal_rejected_onchain',
        reason: `Proposal ${proposalId} rejected on-chain: ${reason}`,
        multisigTxId: transaction.id,
        severity: 'high',
        metadata: { proposalId, contractAddress, rejectionReason: reason }
      });

      this.logger.info(`Marked transaction ${transaction.id} as rejected`);
    } catch (error) {
      this.logger.error(`Error handling ProposalRejected: ${error}`);
      throw error;
    }
  }

  /**
   * Log audit event to treasury_audit_log table
   */
  private async logAuditEvent(auditData: {
    daoId: string;
    actorId: string;
    action: string;
    reason: string;
    multisigTxId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: any;
  }): Promise<void> {
    try {
      await db.insert(treasuryAuditLog).values({
        daoId: auditData.daoId,
        actorId: auditData.actorId,
        action: auditData.action,
        reason: auditData.reason,
        multisigTxId: auditData.multisigTxId,
        severity: auditData.severity,
        metadata: auditData.metadata || {},
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error(`Error logging audit event: ${error}`);
      // Don't throw - audit failures shouldn't block event processing
    }
  }

  /**
   * Poll for contract events on a multisig wallet
   * Called periodically by an external scheduler (e.g., cron job)
   * 
   * @param multisigAddress Contract address to poll
   */
  async pollContractEvents(multisigAddress: string): Promise<void> {
    try {
      const lastBlock = this.lastBlockChecked.get(multisigAddress) || 0;
      const currentBlock = await treasuryOnchainService.getNetworkInfo();

      this.logger.debug(
        `Polling contract ${multisigAddress} from block ${lastBlock} to ${currentBlock.blockNumber}`
      );

      // This is a placeholder - actual event polling would use ethers.js event filters
      // In production, you would:
      // 1. Get event logs for the contract
      // 2. Parse each log into event data
      // 3. Queue events into BullMQ for processing

      this.lastBlockChecked.set(multisigAddress, currentBlock.blockNumber);
    } catch (error) {
      this.logger.error(`Error polling contract events: ${error}`);
    }
  }

  /**
   * Queue an event for processing
   * Called when an event is detected from polling or event listeners
   * 
   * @param eventType Type of event (ProposalCreated, ProposalExecuted, etc.)
   * @param contractAddress Contract address that emitted the event
   * @param eventData Event data from contract
   */
  async queueEvent(
    eventType: string,
    contractAddress: string,
    eventData: any
  ): Promise<Job> {
    try {
      const job = await this.queue.add(
        'process-event',
        {
          eventType,
          contractAddress,
          eventData,
          timestamp: new Date().toISOString()
        },
        {
          attempts: 3, // Retry up to 3 times on failure
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: true, // Remove job after successful completion
          removeOnFail: false // Keep failed jobs for debugging
        }
      );

      this.logger.info(
        `Queued ${eventType} event for contract ${contractAddress} (Job ID: ${job.id})`
      );

      return job;
    } catch (error) {
      this.logger.error(`Error queueing event: ${error}`);
      throw new AppError(`Failed to queue event: ${error}`, 500);
    }
  }

  /**
   * Start the worker
   * Begins processing queued events
   */
  async start(): Promise<void> {
    try {
      await this.worker.waitUntilReady();
      this.logger.info('Treasury event listener worker started successfully');
    } catch (error) {
      this.logger.error(`Failed to start worker: ${error}`);
      throw new AppError(`Failed to start event listener worker: ${error}`, 500);
    }
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    try {
      await this.worker.close();
      await this.queue.close();
      this.logger.info('Treasury event listener worker stopped');
    } catch (error) {
      this.logger.error(`Error stopping worker: ${error}`);
    }
  }

  /**
   * Get worker status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    isPaused: boolean;
    activeJobs: number;
    failedJobs: number;
    completedJobs: number;
  }> {
    try {
      const counts = await this.queue.getJobCounts();

      return {
        isRunning: !this.worker.isStopped,
        isPaused: this.worker.isPaused,
        activeJobs: counts.active || 0,
        failedJobs: counts.failed || 0,
        completedJobs: counts.completed || 0
      };
    } catch (error) {
      this.logger.error(`Error getting worker status: ${error}`);
      return {
        isRunning: false,
        isPaused: false,
        activeJobs: 0,
        failedJobs: 0,
        completedJobs: 0
      };
    }
  }
}

/**
 * Create and export worker instance
 * This should be initialized in the server startup
 */
let treasuryEventListenerWorker: TreasuryEventListenerWorker | null = null;

export async function initializeTreasuryEventListener(
  redisConnection?: any
): Promise<TreasuryEventListenerWorker> {
  if (!treasuryEventListenerWorker) {
    treasuryEventListenerWorker = new TreasuryEventListenerWorker(
      'treasury-event-listener',
      redisConnection || { host: 'localhost', port: 6379 }
    );
    await treasuryEventListenerWorker.start();
  }
  return treasuryEventListenerWorker;
}

export function getTreasuryEventListener(): TreasuryEventListenerWorker {
  if (!treasuryEventListenerWorker) {
    throw new AppError(
      'Treasury event listener worker not initialized. Call initializeTreasuryEventListener() first.',
      500
    );
  }
  return treasuryEventListenerWorker;
}
