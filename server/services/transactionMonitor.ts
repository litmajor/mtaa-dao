
import { db } from '../db';
import { walletTransactions, vaultTransactions } from '../../shared/schema';
import { eq, and, or, lt } from 'drizzle-orm';
import { tokenService } from './tokenService';
import { Logger } from '../utils/logger';
import { notificationService } from '../notificationService';
import { WebSocketService } from './WebSocketService';

const logger = Logger.getLogger();
const wsService = WebSocketService.getInstance();

interface TransactionRetryConfig {
  maxRetries: number;
  retryDelays: number[]; // milliseconds
  notifyOnFailure: boolean;
}

const DEFAULT_RETRY_CONFIG: TransactionRetryConfig = {
  maxRetries: 3,
  retryDelays: [5000, 15000, 60000], // 5s, 15s, 1min
  notifyOnFailure: true
};

export class TransactionMonitor {
  private retryQueue = new Map<string, { attempt: number; nextRetry: number }>();
  private monitoringInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.monitoringInterval) return;

    logger.info('Starting transaction monitor...');
    
    // Check pending transactions every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkPendingTransactions();
    }, 30000);

    // Initial check
    this.checkPendingTransactions();
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Transaction monitor stopped');
    }
  }

  private async checkPendingTransactions() {
    try {
      // Check wallet transactions
      const pendingWallet = await db.query.walletTransactions.findMany({
        where: or(
          eq(walletTransactions.status, 'pending'),
          eq(walletTransactions.status, 'processing')
        )
      });

      for (const tx of pendingWallet) {
        await this.verifyWalletTransaction(tx);
      }

      // Check vault transactions
      const pendingVault = await db.query.vaultTransactions.findMany({
        where: or(
          eq(vaultTransactions.status, 'pending'),
          eq(vaultTransactions.status, 'processing')
        )
      });

      for (const tx of pendingVault) {
        await this.verifyVaultTransaction(tx);
      }

      // Process retry queue
      await this.processRetryQueue();

    } catch (error) {
      logger.error('Transaction monitoring error:', error);
    }
  }

  private async verifyWalletTransaction(tx: any) {
    if (!tx.transactionHash) {
      // No hash yet - check if too old
      const age = Date.now() - new Date(tx.createdAt).getTime();
      if (age > 5 * 60 * 1000) { // 5 minutes
        await this.handleFailedTransaction(tx, 'wallet', 'Transaction timeout - no hash');
      }
      return;
    }

    try {
      // Verify on blockchain
      const receipt = await tokenService.provider.getTransactionReceipt(tx.transactionHash);
      
      if (receipt) {
        const status = receipt.status === 1 ? 'completed' : 'failed';
        
        await db.update(walletTransactions)
          .set({ 
            status,
            updatedAt: new Date(),
            metadata: { ...tx.metadata, receipt: receipt.toJSON() }
          })
          .where(eq(walletTransactions.id, tx.id));

        if (status === 'failed') {
          await this.handleFailedTransaction(tx, 'wallet', 'Transaction reverted on blockchain');
        } else {
          logger.info(`Transaction confirmed: ${tx.transactionHash}`);
          
          // Send WebSocket notification for real-time updates
          if (tx.fromUserId) {
            wsService.sendToUser(tx.fromUserId, {
              type: 'TRANSACTION_CONFIRMED',
              data: {
                transactionId: tx.id,
                hash: tx.transactionHash,
                amount: tx.amount,
                currency: tx.currency,
                status: 'completed'
              }
            });
            
            // Also send persistent notification
            await notificationService.sendNotification(tx.fromUserId, {
              type: 'transaction_success',
              title: 'Transaction Confirmed',
              message: `Your ${tx.currency} transfer of ${tx.amount} was successful`,
              priority: 'medium',
              metadata: { transactionId: tx.id, hash: tx.transactionHash }
            });
          }
        }
      } else {
        // Still pending on blockchain
        const age = Date.now() - new Date(tx.createdAt).getTime();
        if (age > 15 * 60 * 1000) { // 15 minutes timeout
          await this.scheduleRetry(tx, 'wallet');
        }
      }
    } catch (error) {
      logger.error(`Error verifying transaction ${tx.transactionHash}:`, error);
    }
  }

  private async verifyVaultTransaction(tx: any) {
    // Similar logic for vault transactions
    if (!tx.transactionHash) {
      const age = Date.now() - new Date(tx.createdAt).getTime();
      if (age > 5 * 60 * 1000) {
        await this.handleFailedTransaction(tx, 'vault', 'Transaction timeout - no hash');
      }
      return;
    }

    try {
      const receipt = await tokenService.provider.getTransactionReceipt(tx.transactionHash);
      
      if (receipt) {
        const status = receipt.status === 1 ? 'completed' : 'failed';
        
        await db.update(vaultTransactions)
          .set({ 
            status,
            updatedAt: new Date(),
            metadata: { ...tx.metadata, receipt: receipt.toJSON() }
          })
          .where(eq(vaultTransactions.id, tx.id));

        if (status === 'failed') {
          await this.handleFailedTransaction(tx, 'vault', 'Transaction reverted on blockchain');
        }
      }
    } catch (error) {
      logger.error(`Error verifying vault transaction ${tx.transactionHash}:`, error);
    }
  }

  private async scheduleRetry(tx: any, type: 'wallet' | 'vault') {
    const existing = this.retryQueue.get(tx.id);
    const attempt = existing ? existing.attempt + 1 : 1;

    if (attempt > DEFAULT_RETRY_CONFIG.maxRetries) {
      await this.handleFailedTransaction(tx, type, 'Max retries exceeded');
      return;
    }

    const delay = DEFAULT_RETRY_CONFIG.retryDelays[attempt - 1] || 60000;
    
    this.retryQueue.set(tx.id, {
      attempt,
      nextRetry: Date.now() + delay
    });

    logger.info(`Scheduled retry ${attempt}/${DEFAULT_RETRY_CONFIG.maxRetries} for transaction ${tx.id}`);
  }

  private async processRetryQueue() {
    const now = Date.now();
    
    for (const [txId, retry] of this.retryQueue.entries()) {
      if (retry.nextRetry <= now) {
        // Attempt retry
        this.retryQueue.delete(txId);
        logger.info(`Retrying transaction ${txId} (attempt ${retry.attempt})`);
        
        // Re-trigger monitoring check
        this.checkPendingTransactions();
      }
    }
  }

  private async handleFailedTransaction(tx: any, type: 'wallet' | 'vault', reason: string) {
    logger.error(`Transaction failed: ${tx.id} - ${reason}`);

    // Update status
    const table = type === 'wallet' ? walletTransactions : vaultTransactions;
    await db.update(table)
      .set({ 
        status: 'failed',
        updatedAt: new Date(),
        metadata: { ...tx.metadata, failureReason: reason }
      })
      .where(eq(table.id, tx.id));

    // Notify user via WebSocket (immediate) and notification (persistent)
    const userId = type === 'wallet' ? tx.fromUserId : tx.userId;
    if (userId && DEFAULT_RETRY_CONFIG.notifyOnFailure) {
      // Immediate WebSocket alert
      wsService.sendToUser(userId, {
        type: 'TRANSACTION_FAILED',
        data: {
          transactionId: tx.id,
          hash: tx.transactionHash,
          amount: tx.amount,
          currency: tx.currency,
          reason,
          status: 'failed'
        }
      });
      
      // Persistent notification
      await notificationService.sendNotification(userId, {
        type: 'transaction_failed',
        title: 'Transaction Failed',
        message: `Your transaction failed: ${reason}. Please try again or contact support.`,
        priority: 'high',
        metadata: { transactionId: tx.id, reason, canRetry: true }
      });
    }

    // Remove from retry queue
    this.retryQueue.delete(tx.id);
  }
}

export const transactionMonitor = new TransactionMonitor();
