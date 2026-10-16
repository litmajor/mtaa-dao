
import { db } from '../db';
import { walletTransactions, users, daos } from '../../shared/schema';
import { eq, and, lte, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { tokenService } from './tokenService';
import { gasPriceOracle } from './gasPriceOracle';
import { getMultiChainProvider } from './multiChainProvider';
import { notificationService } from '../notificationService';
import { WebSocketService } from './WebSocketService';
import { paymentRecoverySAGA } from './PaymentRecoverySAGAOrchestrator';

const logger = Logger.getLogger();

let wsService: WebSocketService | null = null;
function getWsService(): WebSocketService {
  if (!wsService) {
    wsService = WebSocketService.getInstance();
  }
  return wsService;
}

interface RecurringPayment {
  id: string;
  userId: string;
  toAddress: string;
  amount: string;
  currency: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextPayment: Date;
  isActive: boolean;
  lastFailureReason?: string;
  consecutiveFailures: number;
}

export class RecurringPaymentService {
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  /**
   * Start the recurring payment processor
   */
  start(): void {
    if (this.processingInterval) {
      logger.warn('Recurring payment processor already running');
      return;
    }

    logger.info('Starting recurring payment processor...');
    
    // Check for due payments every 5 minutes
    this.processingInterval = setInterval(() => {
      this.processDuePayments().catch((err) => {
        // Log error but don't crash - errors are already logged in processDuePayments
        if (err.message && (err.message.includes('TIMEOUT') || err.message.includes('timeout'))) {
          logger.warn(`⚠️ RPC timeout in recurring payments: ${err.message}`);
        }
      });
    }, 5 * 60 * 1000);

    // Initial run wrapped in promise handler
    this.processDuePayments().catch((err) => {
      logger.warn('Error in initial recurring payment check:', err.message);
    });
  }

  /**
   * Stop the recurring payment processor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Recurring payment processor stopped');
    }
  }

  /**
   * Process all due recurring payments
   */
  private async processDuePayments(): Promise<void> {
    try {
      const now = new Date();
      
      // Get all active recurring payments that are due
      const duePayments = await db.query.walletTransactions.findMany({
        where: and(
          eq(walletTransactions.type, 'recurring'),
          eq(walletTransactions.status, 'pending'),
          lte(walletTransactions.createdAt, now)
        )
      });

      logger.info(`Processing ${duePayments.length} due recurring payments`);

      for (const payment of duePayments) {
        const result = await executeMultiRecipientPayment(payment.id);
        if (result.status !== 'succeeded') {
          logger.error(`Recurring payment ${payment.id} failed: ${result.error ?? 'execution failed'}`);
        }
      }
      
    } catch (error) {
      logger.error('Error processing recurring payments:', error);
    }
  }

  /**
   * Validate and process a single recurring payment
   */
  private async processPayment(payment: RecurringPayment): Promise<void> {
    try {
      // Step 1: Pre-execution balance validation
      const balanceCheck = await this.validateBalance(payment);
      
      if (!balanceCheck.hasBalance) {
        await this.handleInsufficientBalance(payment, balanceCheck.currentBalance, balanceCheck.requiredBalance);
        return;
      }

      // Step 2: Check gas prices and network congestion
      const provider = getMultiChainProvider().getProvider('polygon');
      const gasStrategy = await gasPriceOracle.getOptimalGasStrategy(provider, 'polygon', 'standard');

      // Heuristic: consider network congested when instant tier >> standard tier
      const standardStrategy = await gasPriceOracle.getOptimalGasStrategy(provider, 'polygon', 'standard');
      const instantStrategy = await gasPriceOracle.getOptimalGasStrategy(provider, 'polygon', 'instant');
      const standardFee = BigInt(standardStrategy.maxFeePerGas || standardStrategy.gasPrice || '0');
      const instantFee = BigInt(instantStrategy.maxFeePerGas || instantStrategy.gasPrice || '0');
      const isCongested = !!(instantFee > 0n && standardFee > 0n &&
        instantFee > (standardFee * BigInt(150) / BigInt(100)));

      if (isCongested) {
        logger.warn(`Network congested, delaying payment ${payment.id}`);
        await this.delayPayment(payment, 'Network congestion detected');
        return;
      }

      // Step 3: Execute the payment via the Payment Recovery SAGA orchestrator
      try {
        // Resolve user's wallet address for the saga
        const userRow = await db.query.users.findFirst({ where: eq(users.id, payment.userId) });
        const walletFrom = (userRow as any)?.walletAddress || payment.userId;

        const saga = await paymentRecoverySAGA.executePaymentSAGA({
          userId: payment.userId,
          amount: Number(payment.amount),
          currency: payment.currency,
          walletFrom,
          walletTo: payment.toAddress,
          vaultId: (payment as any)?.metadata?.vaultId,
          metadata: (payment as any)?.metadata || {}
        });

        // Reflect saga outcome in the recurring payment record
        const baseMetadata = (payment as any)?.metadata || {};

        if (saga?.status === 'succeeded') {
          await db.update(walletTransactions)
            .set({
              status: 'completed',
              updatedAt: new Date(),
              metadata: {
                ...baseMetadata,
                executedAt: new Date().toISOString(),
                sagaId: saga.id
              }
            })
            .where(eq(walletTransactions.id, payment.id));

          // Notify user (no txHash available here; the saga writes on-chain records to its events table)
          await this.notifySuccess(payment, (saga as any)?.paymentId ?? '');

          // Schedule next payment and emit notification event
          await this.scheduleNextPayment(payment);
          try {
            await notificationService.createNotification({
              userId: payment.userId,
              type: 'payment_recurring_completed',
              title: 'Recurring Payment Completed',
              message: `Recurring payment of ${payment.amount} ${payment.currency} has been processed`,
              priority: 'high',
              metadata: {
                entityType: 'payment',
                entityId: payment.id,
                recurring: true,
                toAddress: payment.toAddress,
                amount: payment.amount,
                currency: payment.currency,
                frequency: payment.frequency,
                sagaId: saga.id,
                nextPayment: payment.nextPayment,
                status: 'completed'
              },
              persist: true,
            });
          } catch (wsError) {
            logger.warn('Failed to emit WebSocket event for recurring payment completion', { error: wsError });
          }

          logger.info(`Recurring payment ${payment.id} processed successfully via SAGA ${saga.id}`);
        } else {
          // Saga failed or is compensating
          await db.update(walletTransactions)
            .set({
              status: 'failed',
              updatedAt: new Date(),
              metadata: {
                ...baseMetadata,
                lastFailureReason: saga?.lastError || 'saga_failed',
                sagaId: saga?.id
              }
            })
            .where(eq(walletTransactions.id, payment.id));

          await this.handlePaymentFailure(payment, new Error(saga?.lastError || 'saga_failed'));
        }

      } catch (sagaError) {
        logger.error(`SAGA execution error for recurring payment ${payment.id}:`, sagaError);
        // Fallback: mark failed and handle failure
        await db.update(walletTransactions)
          .set({ status: 'failed', updatedAt: new Date(), metadata: { ...(payment as any)?.metadata, lastFailureReason: String(sagaError) } })
          .where(eq(walletTransactions.id, payment.id));

        await this.handlePaymentFailure(payment, sagaError);
      }
      
    } catch (error) {
      logger.error(`Failed to process recurring payment ${payment.id}:`, error);
      await this.handlePaymentFailure(payment, error);
    }
  }

  /**
   * Validate user has sufficient balance for payment
   */
  private async validateBalance(payment: RecurringPayment): Promise<{
    hasBalance: boolean;
    currentBalance: string;
    requiredBalance: string;
  }> {
    try {
      // Get user's wallet address
      const user = await db.query.users.findFirst({
        where: eq(users.id, payment.userId)
      });

      if (!user?.walletAddress) {
        throw new Error('User wallet address not found');
      }

      // Get current balance
      const balance = await tokenService.getTokenBalance(payment.currency, user.walletAddress);
      const currentBalance = BigInt(balance);
      const requiredAmount = BigInt(payment.amount);

      // Estimate gas cost
      const provider = getMultiChainProvider().getProvider('polygon');
      const gasStrategy = await gasPriceOracle.getOptimalGasStrategy(provider, 'polygon', 'standard');
      const estimatedGas = BigInt(21000); // Standard transfer
      const gasCost = BigInt(gasStrategy.maxFeePerGas || gasStrategy.gasPrice || '0') * estimatedGas;

      // Total required = amount + gas (if paying in same currency)
      const totalRequired = payment.currency === 'CELO' 
        ? requiredAmount + gasCost 
        : requiredAmount;

      return {
        hasBalance: currentBalance >= totalRequired,
        currentBalance: currentBalance.toString(),
        requiredBalance: totalRequired.toString()
      };
      
    } catch (error) {
      logger.error('Balance validation failed:', error);
      return {
        hasBalance: false,
        currentBalance: '0',
        requiredBalance: payment.amount
      };
    }
  }

  /**
   * Handle insufficient balance scenario
   */
  private async handleInsufficientBalance(
    payment: RecurringPayment,
    currentBalance: string,
    requiredBalance: string
  ): Promise<void> {
    const consecutiveFailures = (payment.consecutiveFailures || 0) + 1;
    
    // Update payment with failure info
    await db.update(walletTransactions)
      .set({
        status: consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES ? 'failed' : 'pending',
        metadata: {
          lastFailureReason: 'Insufficient balance',
          currentBalance,
          requiredBalance,
          consecutiveFailures,
          lastFailureAt: new Date().toISOString()
        }
      })
      .where(eq(walletTransactions.id, payment.id));

    // Emit WebSocket notification for insufficient balance
    try {
      await notificationService.createNotification({
        userId: payment.userId,
        type: 'payment_insufficient_balance',
        title: 'Insufficient Balance',
        message: `Recurring payment failed: insufficient balance (Need: ${requiredBalance}, Have: ${currentBalance})`,
        priority: 'high',
        metadata: {
          entityType: 'payment',
          entityId: payment.id,
          paymentId: payment.id,
          required: requiredBalance,
          current: currentBalance,
          consecutiveFailures,
          willDisable: consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES
        },
        persist: true,
      });
    } catch (wsError) {
      logger.warn('Failed to emit WebSocket notification for insufficient balance', { error: wsError });
    }

    // Send notification
    await notificationService.createNotification({
      userId: payment.userId,
      type: 'payment_insufficient_balance',
      title: 'Recurring Payment Failed',
      message: `Your recurring payment of ${payment.amount} ${payment.currency} failed due to insufficient balance. Current: ${currentBalance}, Required: ${requiredBalance}`,
      priority: 'high',
      metadata: { paymentId: payment.id, consecutiveFailures }
    });

    // Auto-disable after max failures
    if (consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      logger.warn(`Disabling recurring payment ${payment.id} after ${consecutiveFailures} failures`);
      // Additional notification about auto-disable
      await notificationService.createNotification({
        userId: payment.userId,
        type: 'recurring_payment_disabled',
        title: 'Recurring Payment Disabled',
        message: `Your recurring payment has been automatically disabled after ${consecutiveFailures} consecutive failures. Please top up your balance and re-enable it.`,
        priority: 'urgent',
        metadata: { paymentId: payment.id }
      });
    }
  }

  /**
   * Delay payment due to network conditions
   */
  private async delayPayment(payment: RecurringPayment, reason: string): Promise<void> {
    const delayMinutes = 30;
    const newSchedule = new Date(Date.now() + delayMinutes * 60 * 1000);

    await db.update(walletTransactions)
      .set({
        createdAt: newSchedule,
        metadata: {
          delayReason: reason,
          originalSchedule: payment.nextPayment,
          delayedUntil: newSchedule.toISOString()
        }
      })
      .where(eq(walletTransactions.id, payment.id));

    logger.info(`Payment ${payment.id} delayed until ${newSchedule.toISOString()}`);
  }

  /**
   * Handle payment execution failure
   */
  private async handlePaymentFailure(payment: RecurringPayment, error: any): Promise<void> {
    const consecutiveFailures = (payment.consecutiveFailures || 0) + 1;
    
    await db.update(walletTransactions)
      .set({
        status: 'failed',
        metadata: {
          lastFailureReason: error.message,
          consecutiveFailures,
          lastFailureAt: new Date().toISOString()
        }
      })
      .where(eq(walletTransactions.id, payment.id));

    // Emit WebSocket notification for payment failure
    try {
      await notificationService.createNotification({
        userId: payment.userId,
        type: 'payment_recurring_failed',
        title: 'Recurring Payment Failed',
        message: `Recurring payment failed: ${error.message}`,
        priority: 'high',
        metadata: {
          entityType: 'payment',
          entityId: payment.id,
          paymentId: payment.id,
          toAddress: payment.toAddress,
          amount: payment.amount,
          currency: payment.currency,
          error: error.message,
          consecutiveFailures
        },
        persist: true,
      });
    } catch (wsError) {
      logger.warn('Failed to emit WebSocket notification for payment failure', { error: wsError });
    }

    // Notify user
    await notificationService.createNotification({
      userId: payment.userId,
      type: 'recurring_payment_failed',
      title: 'Recurring Payment Failed',
      message: `Your recurring payment failed: ${error.message}`,
      priority: 'high',
      metadata: { paymentId: payment.id, error: error.message }
    });
  }

  /**
   * Notify user of successful payment
   */
  private async notifySuccess(payment: RecurringPayment, txHash: string): Promise<void> {
    await notificationService.createNotification({
      userId: payment.userId,
      type: 'recurring_payment_success',
      title: 'Recurring Payment Completed',
      message: `Your recurring payment of ${payment.amount} ${payment.currency} was successful`,
      priority: 'medium',
      metadata: {
        entityType: 'payment',
        entityId: payment.id,
        paymentId: payment.id,
        status: 'completed',
        recurring: true,
        toAddress: payment.toAddress,
        amount: payment.amount,
        currency: payment.currency,
        transactionHash: txHash,
        nextPayment: payment.nextPayment
      },
      persist: true,
    });
  }

  /**
   * Schedule the next payment based on frequency
   */
  private async scheduleNextPayment(payment: RecurringPayment): Promise<void> {
    const currentDate = new Date(payment.nextPayment);
    let nextDate: Date;

    switch (payment.frequency) {
      case 'daily':
        nextDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
        break;
      case 'weekly':
        nextDate = new Date(currentDate.setDate(currentDate.getDate() + 7));
        break;
      case 'monthly':
        nextDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
        break;
      case 'yearly':
        nextDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));
        break;
      default:
        nextDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
    }

    // Create new pending payment record
    await db.insert(walletTransactions).values({
      fromUserId: payment.userId,
      toUserId: payment.toAddress,
      walletAddress: payment.toAddress,
      amount: payment.amount,
      currency: payment.currency,
      type: 'recurring',
      status: 'pending',
      createdAt: nextDate,
      metadata: {
        frequency: payment.frequency,
        parentPaymentId: payment.id,
        scheduledFor: nextDate.toISOString()
      }
    });

    logger.info(`Next payment scheduled for ${nextDate.toISOString()}`);
  }
}

export interface RecipientInput {
  userId?: string;
  daoId?: string;
  walletAddress?: string;
  receivePercentage?: number;
  customAmount?: string;
}

type MultiRecipientInput = {
  creatorId: string;
  amount: string;
  currency: string;
  description?: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  interval?: number;
  paymentType?: string;
  autoExecute?: boolean;
  requireConfirmation?: boolean;
  [key: string]: unknown;
};

export async function createMultiRecipientRecurringPayment(
  input: MultiRecipientInput,
  recipients: RecipientInput[] = []
) {
  if (recipients.length === 0) throw new Error('At least one recurring payment recipient is required');
  const recipientKeys = new Set<string>();
  for (const [index, recipient] of recipients.entries()) {
    const targets = [recipient.userId, recipient.daoId, recipient.walletAddress].filter(Boolean);
    if (targets.length !== 1) {
      throw new Error(`Recipient ${index + 1} must specify exactly one user, DAO, or wallet destination`);
    }
    const targetKey = recipient.userId
      ? `user:${recipient.userId}`
      : recipient.daoId
        ? `dao:${recipient.daoId}`
        : `wallet:${recipient.walletAddress!.toLowerCase()}`;
    if (recipientKeys.has(targetKey)) throw new Error(`Duplicate recurring payment recipient: ${targetKey}`);
    recipientKeys.add(targetKey);

    if (recipient.receivePercentage !== undefined &&
        (!Number.isFinite(recipient.receivePercentage) || recipient.receivePercentage < 0 || recipient.receivePercentage > 100)) {
      throw new Error(`Recipient ${index + 1} percentage must be between 0 and 100`);
    }
    if (recipient.customAmount !== undefined) {
      const cents = Number(recipient.customAmount) * 100;
      if (!Number.isFinite(cents) || !Number.isInteger(cents) || cents <= 0) {
        throw new Error(`Recipient ${index + 1} custom amount must be positive with at most two decimals`);
      }
    }
  }
  const percentageRecipients = recipients.filter((recipient) => recipient.customAmount === undefined);
  const hasPercentages = percentageRecipients.some((recipient) => recipient.receivePercentage !== undefined);
  if (hasPercentages && (
    percentageRecipients.some((recipient) => recipient.receivePercentage === undefined) ||
    Math.abs(percentageRecipients.reduce((sum, recipient) => sum + (recipient.receivePercentage ?? 0), 0) - 100) > 0.01
  )) {
    throw new Error('Variable recipient percentages must all be specified and total 100');
  }

  const primaryRecipient = recipients[0];
  const [payment] = await db.insert(walletTransactions).values({
    id: uuidv4(),
    fromUserId: input.creatorId,
    walletAddress: primaryRecipient?.walletAddress || primaryRecipient?.userId || input.creatorId,
    amount: input.amount,
    currency: input.currency,
    type: 'recurring',
    status: input.autoExecute === false ? 'paused' : 'pending',
    description: input.description || 'Recurring payment',
    createdAt: input.startDate,
    metadata: {
      ...input,
      recipients,
      nextPayment: input.startDate.toISOString(),
    },
  }).returning();
  return payment;
}

export async function getCreatedRecurringPayments(userId: string) {
  return db.select().from(walletTransactions).where(and(
    eq(walletTransactions.fromUserId, userId),
    eq(walletTransactions.type, 'recurring')
  ));
}

export async function getReceivedRecurringPayments(userId: string) {
  return db.select().from(walletTransactions).where(and(
    eq(walletTransactions.walletAddress, userId),
    eq(walletTransactions.type, 'recurring')
  ));
}

export async function getRecurringPaymentWithRecipients(id: string) {
  const [payment] = await db.select().from(walletTransactions).where(eq(walletTransactions.id, id)).limit(1);
  if (!payment) throw new Error('Recurring payment not found');
  return { recurringPayment: payment, recipients: (payment.metadata as any)?.recipients || [], executions: [] };
}

async function updateRecurringStatus(id: string, status: string) {
  await db.update(walletTransactions).set({ status, updatedAt: new Date() }).where(eq(walletTransactions.id, id));
}

export const cancelRecurringPaymentWithDAO = (id: string) => updateRecurringStatus(id, 'cancelled');
export const pauseRecurringPayment = (id: string) => updateRecurringStatus(id, 'paused');
export const resumeRecurringPayment = (id: string) => updateRecurringStatus(id, 'pending');

export async function executeMultiRecipientPayment(id: string) {
  const [payment] = await db.select().from(walletTransactions)
    .where(and(eq(walletTransactions.id, id), eq(walletTransactions.type, 'recurring')))
    .limit(1);
  if (!payment) throw new Error('Recurring payment not found');

  const metadata = payment.metadata && typeof payment.metadata === 'object'
    ? payment.metadata as Record<string, unknown>
    : {};
  const configuredRecipients = Array.isArray(metadata.recipients)
    ? metadata.recipients as RecipientInput[]
    : [];
  const recipients = configuredRecipients.length > 0
    ? configuredRecipients
    : payment.toUserId
      ? [{ userId: payment.toUserId }]
      : [{ walletAddress: payment.walletAddress }];
  if (recipients.length === 0) throw new Error('Recurring payment has no recipients');

  // Claim the due row atomically so overlapping workers cannot execute it twice.
  const [claimed] = await db.update(walletTransactions)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(and(
      eq(walletTransactions.id, id),
      eq(walletTransactions.type, 'recurring'),
      eq(walletTransactions.status, 'pending')
    ))
    .returning();
  if (!claimed) throw new Error(`Recurring payment ${id} is not pending or is already being processed`);

  let results: Array<{ recipientIndex: number; executionId: string; status: string }> = [];
  let latestExecutionId: string | undefined;
  try {
  const creatorId = payment.fromUserId;
  if (!creatorId) {
    await markRecurringPaymentFailed(id, metadata, 'Recurring payment has no creator');
    throw new Error('Recurring payment has no creator');
  }
  const sender = await db.query.users.findFirst({ where: eq(users.id, creatorId) });
  if (!sender?.walletAddress) {
    await markRecurringPaymentFailed(id, metadata, 'Recurring payment creator has no registered wallet');
    throw new Error('Recurring payment creator has no registered wallet');
  }

  const totalCents = Number(payment.amount) * 100;
  if (!Number.isSafeInteger(totalCents) || !Number.isInteger(totalCents) || totalCents <= 0) {
    await markRecurringPaymentFailed(id, metadata, 'Recurring payment amount must be a positive amount with at most two decimals');
    throw new Error('Recurring payment amount must be a positive amount with at most two decimals');
  }

  const fixed = recipients.map((recipient) => recipient.customAmount === undefined
    ? 0
    : Number(recipient.customAmount) * 100);
  if (fixed.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
    await markRecurringPaymentFailed(id, metadata, 'Recipient custom amounts must be non-negative amounts with at most two decimals');
    throw new Error('Recipient custom amounts must be non-negative amounts with at most two decimals');
  }
  const fixedTotal = fixed.reduce((sum, amount) => sum + amount, 0);
  if (fixedTotal > totalCents) {
    await markRecurringPaymentFailed(id, metadata, 'Recipient custom amounts exceed the recurring payment total');
    throw new Error('Recipient custom amounts exceed the recurring payment total');
  }

  const variableIndexes = recipients.map((recipient, index) => ({ recipient, index }))
    .filter(({ recipient }) => recipient.customAmount === undefined);
  const remaining = totalCents - fixedTotal;
  const percentageTotal = variableIndexes.reduce((sum, { recipient }) => sum + (recipient.receivePercentage ?? 0), 0);
  if (variableIndexes.length > 0 && percentageTotal > 0 && Math.abs(percentageTotal - 100) > 0.01) {
    await markRecurringPaymentFailed(id, metadata, 'Recipient percentages must total 100 when percentage allocations are used');
    throw new Error('Recipient percentages must total 100 when percentage allocations are used');
  }
  if (variableIndexes.length === 0 && remaining !== 0) {
    await markRecurringPaymentFailed(id, metadata, 'Recipient custom amounts must equal the recurring payment total');
    throw new Error('Recipient custom amounts must equal the recurring payment total');
  }
  if (variableIndexes.some(({ recipient }) => recipient.receivePercentage === undefined) && percentageTotal > 0) {
    await markRecurringPaymentFailed(id, metadata, 'Every variable recipient must specify a percentage when percentage allocations are used');
    throw new Error('Every variable recipient must specify a percentage when percentage allocations are used');
  }

  let allocated = fixed.slice();
  if (variableIndexes.length > 0) {
    let remainder = remaining;
    variableIndexes.forEach(({ recipient, index }, position) => {
      const share = position === variableIndexes.length - 1
        ? remainder
        : percentageTotal > 0
          ? Math.floor(remaining * (recipient.receivePercentage ?? 0) / 100)
          : Math.floor(remaining / variableIndexes.length);
      allocated[index] = share;
      remainder -= share;
    });
  }

  const previousResults = Array.isArray(metadata.recipientExecutionResults)
    ? metadata.recipientExecutionResults as Array<{ recipientIndex: number; executionId: string; status: string }>
    : [];
  const successfulIndexes = new Set(previousResults.filter((result) => result.status === 'succeeded').map((result) => result.recipientIndex));
  results = [...previousResults];

    for (let index = 0; index < recipients.length; index++) {
      if (successfulIndexes.has(index)) continue;
      const recipient = recipients[index];
      const amountCents = allocated[index];
      if (amountCents <= 0) throw new Error(`Recipient ${index + 1} has no allocated amount`);

      let walletTo = recipient.walletAddress;
      if (!walletTo && recipient.userId) {
        const user = await db.query.users.findFirst({ where: eq(users.id, recipient.userId) });
        walletTo = user?.walletAddress ?? undefined;
      }
      if (walletTo && !recipient.userId && !recipient.daoId) {
        const user = await db.query.users.findFirst({ where: eq(users.id, walletTo) });
        walletTo = user?.walletAddress ?? walletTo;
      }
      if (!walletTo && recipient.daoId) {
        const dao = await db.query.daos.findFirst({ where: eq(daos.id, recipient.daoId) });
        walletTo = dao?.vaultAddress ?? dao?.chamaTreasuryAddress ?? undefined;
      }
      if (!walletTo) throw new Error(`Recipient ${index + 1} does not resolve to a wallet address`);
      if (walletTo.toLowerCase() === sender.walletAddress.toLowerCase()) {
        throw new Error(`Recipient ${index + 1} resolves to the sender's own wallet`);
      }

      const saga = await paymentRecoverySAGA.executePaymentSAGA({
        userId: creatorId,
        amount: amountCents / 100,
        currency: payment.currency ?? 'cUSD',
        walletFrom: sender.walletAddress,
        walletTo,
        vaultId: payment.vaultId ?? undefined,
        metadata: { recurringPaymentId: payment.id, recipientIndex: index, recipient },
      });
      latestExecutionId = saga.id;
      results.push({ recipientIndex: index, executionId: saga.id, status: saga.status });

      await db.update(walletTransactions)
        .set({
          metadata: { ...metadata, recipientExecutionResults: results },
          updatedAt: new Date(),
        })
        .where(eq(walletTransactions.id, id));

      if (saga.status !== 'succeeded') {
        throw new Error(saga.lastError || `Payment SAGA failed for recipient ${index + 1}`);
      }
    }

    await db.update(walletTransactions)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(walletTransactions.id, id));
    await scheduleNextRecurringPayment(payment, metadata);
    return { status: 'succeeded' as const, executionId: latestExecutionId ?? results.at(-1)?.executionId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(walletTransactions)
      .set({
        status: 'failed',
        metadata: { ...metadata, recipientExecutionResults: results, lastFailureReason: message },
        updatedAt: new Date(),
      })
      .where(eq(walletTransactions.id, id));
    return { status: 'failed' as const, executionId: latestExecutionId, error: message };
  }
}

async function markRecurringPaymentFailed(id: string, metadata: Record<string, unknown>, reason: string): Promise<void> {
  await db.update(walletTransactions)
    .set({
      status: 'failed',
      metadata: { ...metadata, lastFailureReason: reason },
      updatedAt: new Date(),
    })
    .where(eq(walletTransactions.id, id));
}

async function scheduleNextRecurringPayment(
  payment: typeof walletTransactions.$inferSelect,
  metadata: Record<string, unknown>
): Promise<void> {
  const occurrenceCount = Number(metadata.occurrenceCount ?? 0) + 1;
  const maxOccurrences = metadata.maxOccurrences === undefined ? undefined : Number(metadata.maxOccurrences);
  if (!Number.isInteger(occurrenceCount) || occurrenceCount < 1 ||
      (maxOccurrences !== undefined && (!Number.isInteger(maxOccurrences) || maxOccurrences < 1))) {
    throw new Error('Recurring payment occurrence metadata is invalid');
  }
  if (maxOccurrences !== undefined && occurrenceCount >= maxOccurrences) return;

  const frequency = String(metadata.frequency ?? '').toLowerCase();
  const interval = Number(metadata.interval ?? 1);
  const scheduledDate = metadata.nextPayment ? new Date(String(metadata.nextPayment)) : payment.createdAt;
  if (!scheduledDate || !Number.isFinite(scheduledDate.getTime()) || !Number.isInteger(interval) || interval < 1) {
    throw new Error('Recurring payment schedule metadata is invalid');
  }

  const nextDate = new Date(scheduledDate);
  switch (frequency) {
    case 'daily': nextDate.setDate(nextDate.getDate() + interval); break;
    case 'weekly': nextDate.setDate(nextDate.getDate() + 7 * interval); break;
    case 'biweekly': nextDate.setDate(nextDate.getDate() + 14 * interval); break;
    case 'monthly': nextDate.setMonth(nextDate.getMonth() + interval); break;
    case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3 * interval); break;
    case 'annual':
    case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + interval); break;
    default: return;
  }

  const endDate = metadata.endDate ? new Date(String(metadata.endDate)) : undefined;
  if (endDate && nextDate > endDate) return;

  await db.insert(walletTransactions).values({
    fromUserId: payment.fromUserId,
    toUserId: payment.toUserId,
    walletAddress: payment.walletAddress,
    vaultId: payment.vaultId,
    daoId: payment.daoId,
    amount: payment.amount,
    currency: payment.currency,
    type: 'recurring',
    status: 'pending',
    description: payment.description,
    createdAt: nextDate,
    metadata: {
      ...metadata,
      occurrenceCount,
      nextPayment: nextDate.toISOString(),
      recipientExecutionResults: [],
    },
  });
}

export async function getPendingMultiRecipientExecutions() {
  return db.select().from(walletTransactions).where(and(
    eq(walletTransactions.type, 'recurring'),
    eq(walletTransactions.status, 'pending'),
    lte(walletTransactions.createdAt, new Date())
  ));
}

export const recurringPaymentService = new RecurringPaymentService();
