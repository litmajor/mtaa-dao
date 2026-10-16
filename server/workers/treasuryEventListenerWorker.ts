import { Worker, type Job, Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import {
  TreasuryOnchainService,
  treasuryOnchainService,
  type TreasuryContractEvent
} from '../services/treasuryOnchainService';
import { db } from '../db';
import {
  treasuryEventCursors,
  treasuryMultisigTransactions,
  multisigWallets,
  treasuryAuditLog
} from '../../shared/schema';
import { getEventEmitter } from '../middleware/websocket-event-emitter';
import { AppError } from '../middleware/errorHandler';

export type TreasuryEventType = TreasuryContractEvent['eventType'];

export interface TreasuryEventJobData {
  eventType: TreasuryEventType;
  contractAddress: string;
  eventData: TreasuryContractEvent;
  timestamp: string;
}

function asMetadataRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AppError('Treasury polling configuration must contain a positive safe integer', 500);
  }
  return parsed;
}

function nonNegativeInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AppError('TREASURY_EVENT_CONFIRMATIONS must be a non-negative safe integer', 500);
  }
  return parsed;
}

/**
 * Consumes multisig contract events and keeps treasury state synchronized.
 * Polling is at-least-once; status guards and stable BullMQ job IDs make
 * replaying chain logs safe.
 */
export class TreasuryEventListenerWorker {
  private worker: Worker<TreasuryEventJobData>;
  private queue: Queue<TreasuryEventJobData>;
  private logger = new Logger('TreasuryEventListenerWorker');
  private pollIntervalMs = positiveInteger(process.env.TREASURY_EVENT_POLL_INTERVAL_MS, 5000);
  private pollRange = positiveInteger(process.env.TREASURY_EVENT_POLL_RANGE, 1000);
  private maxRangesPerPoll = positiveInteger(process.env.TREASURY_EVENT_MAX_RANGES_PER_POLL, 10);
  private confirmations = nonNegativeInteger(process.env.TREASURY_EVENT_CONFIRMATIONS, 2);
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private polling = false;

  constructor(
    queueName: string = 'treasury-event-listener',
    redisConnection: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: positiveInteger(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null
    }
  ) {
    this.queue = new Queue<TreasuryEventJobData>(queueName, { connection: redisConnection });
    this.worker = new Worker<TreasuryEventJobData>(
      queueName,
      this.processEvent.bind(this),
      {
        connection: redisConnection,
        concurrency: 1,
        lockDuration: 30000,
        lockRenewTime: 15000
      }
    );
    this.setupWorkerListeners();
  }

  private setupWorkerListeners(): void {
    this.worker.on('completed', (job: Job<TreasuryEventJobData>) => {
      this.logger.info(`Event job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job<TreasuryEventJobData> | undefined, error: Error) => {
      this.logger.error(`Event job ${job?.id} failed: ${error.message}`);
    });

    this.worker.on('error', (error: Error) => {
      this.logger.error(`Worker error: ${error.message}`);
    });
  }

  private async processEvent(job: Job<TreasuryEventJobData>): Promise<void> {
    const { eventType, contractAddress, eventData } = job.data;
    this.logger.info(`Processing ${eventType} event from contract ${contractAddress}`);

    switch (eventType) {
      case 'ProposalCreated':
        await this.handleProposalCreated(contractAddress, eventData);
        break;
      case 'ProposalExecuted':
        await this.handleProposalExecuted(contractAddress, eventData);
        break;
      case 'ProposalCancelled':
        await this.handleProposalCancelled(contractAddress, eventData);
        break;
    }
  }

  private async findMultisig(contractAddress: string) {
    const [wallet] = await db
      .select()
      .from(multisigWallets)
      .where(sql`lower(${multisigWallets.contractAddress}) = lower(${contractAddress})`)
      .limit(1);
    return wallet;
  }

  private async handleProposalCreated(
    contractAddress: string,
    eventData: TreasuryContractEvent
  ): Promise<void> {
    if (eventData.eventType !== 'ProposalCreated') {
      throw new AppError('ProposalCreated job has an invalid event payload', 400);
    }
    const wallet = await this.findMultisig(contractAddress);
    if (!wallet) {
      this.logger.warn(`No multisig wallet found for ${contractAddress}`);
      return;
    }

    const candidates = await db
      .select()
      .from(treasuryMultisigTransactions)
      .where(and(
        eq(treasuryMultisigTransactions.multisigWalletId, wallet.id),
        inArray(treasuryMultisigTransactions.status, ['pending', 'approved']),
        sql`lower(${treasuryMultisigTransactions.recipient}) = lower(${eventData.recipient})`,
        eq(
          treasuryMultisigTransactions.amount,
          TreasuryOnchainService.formatAmount(eventData.amount, 18)
        )
      ))
      .limit(2);

    if (candidates.length === 0) {
      this.logger.warn(
        `No pending treasury transaction found for recipient ${eventData.recipient} and amount ${eventData.amount}`
      );
      return;
    }
    if (candidates.length > 1) {
      throw new AppError(
        `Cannot safely match ProposalCreated ${eventData.proposalId}: multiple pending transactions match recipient and amount`,
        409
      );
    }

    const transaction = candidates[0];
    const updated = await db.transaction(async (tx) => {
      const [result] = await tx
        .update(treasuryMultisigTransactions)
        .set({
          status: 'submitted',
          submittedAt: new Date(),
          submittedTxHash: eventData.transactionHash,
          metadata: {
            ...asMetadataRecord(transaction.metadata),
            proposalId: eventData.proposalId,
            proposalType: eventData.proposalType,
            proposedByAddress: eventData.proposedBy,
            onChainAmount: eventData.amount,
            executableAfter: eventData.executableAfter,
            eventBlockNumber: eventData.blockNumber,
            eventBlockHash: eventData.blockHash,
            eventLogIndex: eventData.logIndex
          },
          updatedAt: new Date()
        })
        .where(and(
          eq(treasuryMultisigTransactions.id, transaction.id),
          inArray(treasuryMultisigTransactions.status, ['pending', 'approved'])
        ))
        .returning({ id: treasuryMultisigTransactions.id });

      if (!result) return false;
      await this.logAuditEvent(tx, {
        daoId: transaction.daoId,
        actorId: transaction.proposedBy,
        action: 'proposal_created_onchain',
        reason: `Proposal ${eventData.proposalId} created on-chain`,
        multisigTxId: transaction.id,
        severity: 'high',
        metadata: {
          proposalId: eventData.proposalId,
          contractAddress,
          transactionHash: eventData.transactionHash,
          blockNumber: eventData.blockNumber
        }
      });
      return true;
    });

    if (updated) {
      this.emitTransactionUpdate(transaction.proposedBy, transaction.id, 'submitted', eventData);
      this.logger.info(`Updated transaction ${transaction.id} with proposal ID ${eventData.proposalId}`);
    }
  }

  private async findSubmittedTransaction(
    contractAddress: string,
    proposalId: string
  ) {
    const wallet = await this.findMultisig(contractAddress);
    if (!wallet) {
      this.logger.warn(`No multisig wallet found for ${contractAddress}`);
      return undefined;
    }

    const transactions = await db
      .select()
      .from(treasuryMultisigTransactions)
      .where(and(
        eq(treasuryMultisigTransactions.multisigWalletId, wallet.id),
        eq(treasuryMultisigTransactions.status, 'submitted'),
        sql`${treasuryMultisigTransactions.metadata}->>'proposalId' = ${proposalId}`
      ))
      .limit(2);

    if (transactions.length > 1) {
      throw new AppError(`Multiple submitted transactions match on-chain proposal ${proposalId}`, 409);
    }
    const transaction = transactions[0];
    if (!transaction) {
      this.logger.warn(`No submitted transaction found for proposal ${proposalId}`);
    }
    return transaction;
  }

  private async handleProposalExecuted(
    contractAddress: string,
    eventData: TreasuryContractEvent
  ): Promise<void> {
    if (eventData.eventType !== 'ProposalExecuted') {
      throw new AppError('ProposalExecuted job has an invalid event payload', 400);
    }
    const transaction = await this.findSubmittedTransaction(contractAddress, eventData.proposalId);
    if (!transaction) return;

    const status = 'executed';
    const updated = await db.transaction(async (tx) => {
      const [result] = await tx
        .update(treasuryMultisigTransactions)
        .set({
          status,
          executedAt: new Date(),
          metadata: {
            ...asMetadataRecord(transaction.metadata),
            executedOnChain: true,
            executedByAddress: eventData.executedBy,
            onChainAmount: eventData.amount,
            executionTxHash: eventData.transactionHash,
            eventBlockNumber: eventData.blockNumber,
            eventBlockHash: eventData.blockHash,
            eventLogIndex: eventData.logIndex
          },
          updatedAt: new Date()
        })
        .where(and(
          eq(treasuryMultisigTransactions.id, transaction.id),
          eq(treasuryMultisigTransactions.status, 'submitted')
        ))
        .returning({ id: treasuryMultisigTransactions.id });

      if (!result) return false;
      await this.logAuditEvent(tx, {
        daoId: transaction.daoId,
        actorId: transaction.proposedBy,
        action: 'proposal_executed_onchain',
        reason: `Proposal ${eventData.proposalId} executed on-chain`,
        multisigTxId: transaction.id,
        severity: 'critical',
        metadata: {
          proposalId: eventData.proposalId,
          contractAddress,
          executedBy: eventData.executedBy,
          recipient: eventData.recipient,
          amount: eventData.amount,
          transactionHash: eventData.transactionHash,
          blockNumber: eventData.blockNumber
        }
      });
      return true;
    });

    if (updated) {
      this.emitTransactionUpdate(transaction.proposedBy, transaction.id, status, eventData);
      this.logger.info(`Marked transaction ${transaction.id} as ${status}`);
    }
  }

  private async handleProposalCancelled(
    contractAddress: string,
    eventData: TreasuryContractEvent
  ): Promise<void> {
    if (eventData.eventType !== 'ProposalCancelled') {
      throw new AppError('ProposalCancelled job has an invalid event payload', 400);
    }
    const transaction = await this.findSubmittedTransaction(contractAddress, eventData.proposalId);
    if (!transaction) return;

    const updated = await db.transaction(async (tx) => {
      const [result] = await tx
        .update(treasuryMultisigTransactions)
        .set({
          status: 'rejected',
          metadata: {
            ...asMetadataRecord(transaction.metadata),
            cancellationOnChain: true,
            cancelledByAddress: eventData.cancelledBy,
            cancellationTxHash: eventData.transactionHash,
            eventBlockNumber: eventData.blockNumber,
            eventBlockHash: eventData.blockHash,
            eventLogIndex: eventData.logIndex
          },
          updatedAt: new Date()
        })
        .where(and(
          eq(treasuryMultisigTransactions.id, transaction.id),
          eq(treasuryMultisigTransactions.status, 'submitted')
        ))
        .returning({ id: treasuryMultisigTransactions.id });

      if (!result) return false;
      await this.logAuditEvent(tx, {
        daoId: transaction.daoId,
        actorId: transaction.proposedBy,
        action: 'proposal_cancelled_onchain',
        reason: `Proposal ${eventData.proposalId} cancelled on-chain`,
        multisigTxId: transaction.id,
        severity: 'high',
        metadata: {
          proposalId: eventData.proposalId,
          contractAddress,
          cancelledBy: eventData.cancelledBy,
          transactionHash: eventData.transactionHash,
          blockNumber: eventData.blockNumber
        }
      });
      return true;
    });

    if (updated) {
      this.emitTransactionUpdate(transaction.proposedBy, transaction.id, 'rejected', eventData);
      this.logger.info(`Marked transaction ${transaction.id} as rejected after on-chain cancellation`);
    }
  }

  private async logAuditEvent(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    auditData: {
      daoId: string;
      actorId: string;
      action: string;
      reason: string;
      multisigTxId: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      metadata: Record<string, unknown>;
    }
  ): Promise<void> {
    await tx.insert(treasuryAuditLog).values({
      daoId: auditData.daoId,
      actorId: auditData.actorId,
      action: auditData.action,
      reason: auditData.reason,
      multisigTxId: auditData.multisigTxId,
      severity: auditData.severity,
      metadata: auditData.metadata,
      timestamp: new Date()
    });
  }

  private emitTransactionUpdate(
    userId: string,
    transactionId: string,
    status: string,
    eventData: TreasuryContractEvent
  ): void {
    try {
      getEventEmitter().emitToUser(userId, 'treasury:transaction-updated', {
        transactionId,
        status,
        eventType: eventData.eventType,
        transactionHash: eventData.transactionHash,
        blockNumber: eventData.blockNumber
      });
    } catch (error) {
      this.logger.error(
        `Failed to emit treasury update for transaction ${transactionId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async pollContractEvents(multisigAddress: string): Promise<void> {
    const currentBlock = await treasuryOnchainService.getNetworkInfo();
    const finalizedBlock = currentBlock.blockNumber - this.confirmations;
    if (finalizedBlock < 0) return;

    const normalizedAddress = multisigAddress.toLowerCase();
    const wallet = await this.findMultisig(normalizedAddress);
    if (!wallet) {
      this.logger.warn(`No multisig wallet found for ${normalizedAddress}`);
      return;
    }
    const [cursor] = await db
      .select()
      .from(treasuryEventCursors)
      .where(eq(treasuryEventCursors.contractAddress, normalizedAddress))
      .limit(1);

    const configuredStart = process.env.TREASURY_EVENT_START_BLOCK;
    let startBlock: number;
    if (configuredStart !== undefined) {
      startBlock = Number(configuredStart);
    } else if (wallet.deploymentTxHash) {
      const deploymentBlock = await treasuryOnchainService.getTransactionReceiptBlock(wallet.deploymentTxHash);
      if (deploymentBlock === null) {
        throw new AppError(`Could not locate deployment transaction for ${normalizedAddress}`, 503);
      }
      startBlock = deploymentBlock;
    } else {
      startBlock = finalizedBlock;
      this.logger.warn(
        `No deployment transaction is recorded for ${normalizedAddress}; tracking starts at finalized block ${startBlock}. Set TREASURY_EVENT_START_BLOCK to backfill earlier events.`
      );
    }
    if (!Number.isSafeInteger(startBlock) || startBlock < 0) {
      throw new AppError('TREASURY_EVENT_START_BLOCK must be a non-negative safe integer', 500);
    }
    let fromBlock = cursor ? cursor.lastProcessedBlock + 1 : startBlock;
    if (fromBlock > finalizedBlock) return;

    let rangesProcessed = 0;
    while (fromBlock <= finalizedBlock && rangesProcessed < this.maxRangesPerPoll) {
      const toBlock = Math.min(fromBlock + this.pollRange - 1, finalizedBlock);
      const events = await treasuryOnchainService.getContractEvents(
        normalizedAddress,
        fromBlock,
        toBlock
      );
      events.sort((left, right) => left.blockNumber - right.blockNumber || left.logIndex - right.logIndex);

      for (const eventData of events) {
        await this.queueEvent(eventData.eventType, normalizedAddress, eventData);
      }

      await db
        .insert(treasuryEventCursors)
        .values({
          contractAddress: normalizedAddress,
          lastProcessedBlock: toBlock,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: treasuryEventCursors.contractAddress,
          set: {
            lastProcessedBlock: sql`GREATEST(${treasuryEventCursors.lastProcessedBlock}, excluded.last_processed_block)`,
            updatedAt: new Date()
          }
        });
      fromBlock = toBlock + 1;
      rangesProcessed += 1;
    }
  }

  private async pollActiveContracts(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const { chainId } = await treasuryOnchainService.getNetworkInfo();
      const wallets = await db
        .select({ contractAddress: multisigWallets.contractAddress })
        .from(multisigWallets)
        .where(and(
          eq(multisigWallets.isActive, true),
          eq(multisigWallets.chainId, chainId)
        ));

      for (const wallet of wallets) {
        try {
          await this.pollContractEvents(wallet.contractAddress);
        } catch (error) {
          this.logger.error(
            `Failed polling treasury contract ${wallet.contractAddress}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    } finally {
      this.polling = false;
    }
  }

  async queueEvent(
    eventType: TreasuryEventType,
    contractAddress: string,
    eventData: TreasuryContractEvent
  ): Promise<Job<TreasuryEventJobData>> {
    try {
      const eventJobId = `${contractAddress.toLowerCase()}-${eventData.transactionHash.toLowerCase().replace(/^0x/, '')}-${eventData.logIndex}`;
      const job = await this.queue.add(
        'process-event',
        {
          eventType,
          contractAddress,
          eventData,
          timestamp: new Date().toISOString()
        },
        {
          jobId: eventJobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 86400, count: 10000 },
          removeOnFail: false
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

  async start(): Promise<void> {
    if (this.pollTimer) return;
    try {
      await this.worker.waitUntilReady();
      void this.pollActiveContracts().catch((error) => {
        this.logger.error(`Initial treasury event poll failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      this.pollTimer = setInterval(() => {
        void this.pollActiveContracts().catch((error) => {
          this.logger.error(`Treasury event poll failed: ${error instanceof Error ? error.message : String(error)}`);
        });
      }, this.pollIntervalMs);
      this.logger.info('Treasury event listener worker started successfully');
    } catch (error) {
      this.logger.error(`Failed to start worker: ${error}`);
      await Promise.allSettled([this.worker.close(), this.queue.close()]);
      throw new AppError(`Failed to start event listener worker: ${error}`, 500);
    }
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    await Promise.all([this.worker.close(), this.queue.close()]);
    this.logger.info('Treasury event listener worker stopped');
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    isPaused: boolean;
    activeJobs: number;
    failedJobs: number;
    completedJobs: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      isRunning: this.worker.isRunning(),
      isPaused: this.worker.isPaused(),
      activeJobs: counts.active || 0,
      failedJobs: counts.failed || 0,
      completedJobs: counts.completed || 0
    };
  }
}

let treasuryEventListenerWorker: TreasuryEventListenerWorker | null = null;

export async function initializeTreasuryEventListener(
  redisConnection?: RedisOptions
): Promise<TreasuryEventListenerWorker> {
  if (!treasuryEventListenerWorker) {
    const worker = new TreasuryEventListenerWorker(
      'treasury-event-listener',
      redisConnection
    );
    await worker.start();
    treasuryEventListenerWorker = worker;
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

export async function shutdownTreasuryEventListener(): Promise<void> {
  if (!treasuryEventListenerWorker) return;
  await treasuryEventListenerWorker.stop();
  treasuryEventListenerWorker = null;
}
