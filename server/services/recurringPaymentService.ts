
import { db } from '../db';
import { walletTransactions, users } from '../../shared/schema';
import { eq, and, lte } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { tokenService } from './tokenService';
import { gasPriceOracle } from './gasPriceOracle';
import { notificationService } from '../notificationService';
import { WebSocketService } from './WebSocketService';

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
      this.processDuePayments();
    }, 5 * 60 * 1000);

    // Initial run
    this.processDuePayments();
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
        await this.processPayment(payment as any);
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
      const gasStrategy = await gasPriceOracle.getOptimalGasStrategy('standard');
      const isCongested = await gasPriceOracle.isNetworkCongested();

      if (isCongested) {
        logger.warn(`Network congested, delaying payment ${payment.id}`);
        await this.delayPayment(payment, 'Network congestion detected');
        return;
      }

      // Step 3: Execute the payment
      const txHash = await tokenService.sendToken(
        payment.currency,
        payment.toAddress,
        payment.amount
      );

      // Step 4: Update payment status
      await db.update(walletTransactions)
        .set({
          status: 'completed',
          transactionHash: txHash,
          updatedAt: new Date(),
          metadata: { 
            executedAt: new Date().toISOString(),
            gasUsed: gasStrategy.maxFeePerGas || gasStrategy.gasPrice
          }
        })
        .where(eq(walletTransactions.id, payment.id));

      // Step 5: Notify user of success
      await this.notifySuccess(payment, txHash);

      // Step 6: Schedule next payment
      await this.scheduleNextPayment(payment);
      
      logger.info(`Recurring payment ${payment.id} processed successfully`);
      
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
      const gasStrategy = await gasPriceOracle.getOptimalGasStrategy('standard');
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

    // Send WebSocket alert
  //

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

    // Notify user
  //

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
  //

    await notificationService.createNotification({
      userId: payment.userId,
      type: 'recurring_payment_success',
      title: 'Recurring Payment Completed',
      message: `Your recurring payment of ${payment.amount} ${payment.currency} was successful`,
      priority: 'medium',
      metadata: { paymentId: payment.id, txHash }
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

export const recurringPaymentService = new RecurringPaymentService();
