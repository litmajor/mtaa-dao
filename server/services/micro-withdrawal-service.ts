/**
 * Micro-Withdrawal Service with Real Database Integration
 * 
 * Solves the problem of users unable to cash out small amounts (<$10)
 * due to network fees. Batches multiple micro-withdrawals into a single
 * transaction to save on gas costs.
 */

import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import {
  microWithdrawals,
  microWithdrawalBatches,
  MicroWithdrawal,
  MicroWithdrawalBatch,
} from '../../shared/microWithdrawalSchema';
import { Logger } from '../utils/logger';
import { notificationService } from '../notificationService';
import { blockchainWithdrawalService } from './blockchain-withdrawal-service';

const logger = new Logger('micro-withdrawal');

// Configuration
export const MICRO_WITHDRAWAL_CONFIG = {
  MIN_REQUEST_AMOUNT: 0.5,
  MAX_REQUEST_AMOUNT: 10.0,
  BATCH_REQUEST_THRESHOLD: 50,
  BATCH_AMOUNT_THRESHOLD: 100.0,
  AUTO_BATCH_INTERVAL_HOURS: 24,
  SUPPORTED_CURRENCIES: ['USDC', 'USDT', 'cUSD', 'ETH'],
};

/**
 * Request a micro-withdrawal
 */
export async function requestMicroWithdrawal(
  userId: string,
  amount: string,
  currency: string,
  toAddress: string
): Promise<MicroWithdrawal> {
  try {
    const numAmount = parseFloat(amount);

    // Validation
    if (isNaN(numAmount)) {
      throw new Error('Invalid amount format');
    }

    if (numAmount < MICRO_WITHDRAWAL_CONFIG.MIN_REQUEST_AMOUNT) {
      throw new Error(
        `Minimum withdrawal is $${MICRO_WITHDRAWAL_CONFIG.MIN_REQUEST_AMOUNT}`
      );
    }

    if (numAmount > MICRO_WITHDRAWAL_CONFIG.MAX_REQUEST_AMOUNT) {
      throw new Error(
        `Micro-withdrawal limit is $${MICRO_WITHDRAWAL_CONFIG.MAX_REQUEST_AMOUNT}. Use standard withdrawal for larger amounts.`
      );
    }

    if (!MICRO_WITHDRAWAL_CONFIG.SUPPORTED_CURRENCIES.includes(currency)) {
      throw new Error(
        `Currency must be one of: ${MICRO_WITHDRAWAL_CONFIG.SUPPORTED_CURRENCIES.join(', ')}`
      );
    }

    if (!toAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('Invalid Ethereum wallet address');
    }

    // Create withdrawal request in database
    const [request] = await db
      .insert(microWithdrawals)
      .values({
        userId,
        amount: amount,
        currency,
        toAddress,
        status: 'pending',
      })
      .returning();

    logger.info(
      `✅ Micro-withdrawal created: ${userId} - $${amount} ${currency}`
    );

    // Check if batch thresholds met
    await checkAndProcessBatch();

    return request;
  } catch (error: any) {
    logger.error(`❌ Failed to create micro-withdrawal: ${error.message}`);
    throw error;
  }
}

/**
 * Check if batch processing should trigger
 */
export async function checkAndProcessBatch(): Promise<boolean> {
  try {
    const stats = await getMicroWithdrawalStats();

    // Check count threshold
    if (stats.pendingCount >= MICRO_WITHDRAWAL_CONFIG.BATCH_REQUEST_THRESHOLD) {
      logger.info('✅ Batch trigger: Request count threshold reached');
      await processBatch('count');
      return true;
    }

    // Check amount threshold
    const pendingAmount = parseFloat(stats.totalPendingAmount || '0');
    if (pendingAmount >= MICRO_WITHDRAWAL_CONFIG.BATCH_AMOUNT_THRESHOLD) {
      logger.info('✅ Batch trigger: Amount threshold reached');
      await processBatch('amount');
      return true;
    }

    // Check time threshold
    if (stats.oldestRequestAge >= MICRO_WITHDRAWAL_CONFIG.AUTO_BATCH_INTERVAL_HOURS) {
      logger.info('✅ Batch trigger: Time threshold reached');
      await processBatch('time');
      return true;
    }

    return false;
  } catch (error: any) {
    logger.error(`❌ Failed to check batch thresholds: ${error.message}`);
    throw error;
  }
}

/**
 * Process a batch of pending micro-withdrawals
 */
export async function processBatch(
  triggeredBy: 'count' | 'amount' | 'time' | 'manual' | 'api'
): Promise<MicroWithdrawalBatch> {
  try {
    // Get all pending requests
    const pendingRequests = await db
      .select()
      .from(microWithdrawals)
      .where(eq(microWithdrawals.status, 'pending'))
      .orderBy(microWithdrawals.createdAt);

    if (pendingRequests.length === 0) {
      throw new Error('No pending requests to process');
    }

    // Group by currency (process each currency separately)
    const requestsByCurrency = pendingRequests.reduce(
      (acc: any, req: any) => {
        if (!acc[req.currency]) acc[req.currency] = [];
        acc[req.currency].push(req);
        return acc;
      },
      {}
    );

    // Process each currency batch
    const processedBatches = [];
    for (const [currency, requests] of Object.entries(requestsByCurrency)) {
      const batch = await processCurrencyBatch(
        requests as MicroWithdrawal[],
        currency as string,
        triggeredBy
      );
      processedBatches.push(batch);
    }

    return processedBatches[0];
  } catch (error: any) {
    logger.error(`❌ Failed to process batch: ${error.message}`);
    throw error;
  }
}

/**
 * Process batch for a specific currency
 */
async function processCurrencyBatch(
  requests: MicroWithdrawal[],
  currency: string,
  triggeredBy: string
): Promise<MicroWithdrawalBatch> {
  try {
    // Calculate totals
    const totalAmount = requests
      .reduce((sum, req) => sum + parseFloat(req.amount), 0)
      .toString();

    // Create batch record
    const [batch] = await db
      .insert(microWithdrawalBatches)
      .values({
        requestCount: requests.length,
        totalAmount,
        currency,
        status: 'processing',
        triggeredBy: triggeredBy as any,
      })
      .returning();

    logger.info(
      `🔄 Processing batch: ${requests.length} requests, $${totalAmount} ${currency}`
    );

    // Update all requests to "batched" status
    await Promise.all(
      requests.map((req) =>
        db
          .update(microWithdrawals)
          .set({
            status: 'batched',
            batchId: batch.id,
            updatedAt: new Date(),
          })
          .where(eq(microWithdrawals.id, req.id))
      )
    );

    // Execute real blockchain transaction
    await executeBlockchainTransaction(batch, requests);

    logger.info(`✅ Batch processed: ${batch.id}`);

    return batch;
  } catch (error: any) {
    logger.error(
      `❌ Failed to process currency batch: ${error.message}`
    );
    throw error;
  }
}

/**
 * Execute real blockchain transaction for batch
 */
async function executeBlockchainTransaction(
  batch: MicroWithdrawalBatch,
  requests: MicroWithdrawal[]
): Promise<void> {
  try {
    // Step 1: Estimate gas fees
    logger.info(`⛽ Estimating gas for ${requests.length} transfers...`);
    const gasFeeEstimate = await blockchainWithdrawalService.estimateGasFee(
      batch.currency,
      requests.length
    );

    // Step 2: Validate sufficient balance
    logger.info(`💰 Validating balance: need ${batch.totalAmount} + ${gasFeeEstimate.estimatedGas} gas`);
    const balanceValidation = await blockchainWithdrawalService.validateSufficientBalance(
      batch.currency,
      batch.totalAmount
    );

    if (!balanceValidation.sufficient) {
      throw new Error(
        `Insufficient balance: shortfall of ${balanceValidation.shortfall} ${batch.currency}`
      );
    }

    // Step 3: Build recipient list from requests
    const recipients = requests.map((req) => ({
      address: req.toAddress,
      amount: req.amount,
    }));

    // Step 4: Update batch status to "processing"
    await db
      .update(microWithdrawalBatches)
      .set({
        status: 'processing',
        estimatedGasFee: gasFeeEstimate.estimatedGas,
        updatedAt: new Date(),
      })
      .where(eq(microWithdrawalBatches.id, batch.id));

    // Step 5: Execute batch transfer
    logger.info(
      `🚀 Submitting batch to blockchain: ${recipients.length} transfers of ${batch.currency}`
    );
    const txResult = await blockchainWithdrawalService.executeBatchTransfer(
      batch.currency,
      recipients
    );

    // Step 6: Update batch with transaction results
    await db
      .update(microWithdrawalBatches)
      .set({
        status: 'processed',
        actualGasFee: txResult.actualGasFee,
        transactionHash: txResult.transactionHash,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(microWithdrawalBatches.id, batch.id));

    // Step 7: Update all requests with transaction hash and mark as processed
    const gasFeePerRequest = (parseFloat(txResult.actualGasFee) / requests.length).toFixed(8);

    await Promise.all(
      requests.map((req) =>
        db
          .update(microWithdrawals)
          .set({
            status: 'processed',
            actualGasFee: gasFeePerRequest,
            transactionHash: txResult.transactionHash,
            processedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(microWithdrawals.id, req.id))
      )
    );

    // Step 8: Notify users
    await notifyBatchProcessed(batch, requests);

    logger.info(
      `✅ Blockchain transaction successful: ${txResult.transactionHash} (Gas: ${txResult.actualGasFee} ${batch.currency})`
    );
  } catch (error: any) {
    logger.error(`❌ Blockchain transaction failed: ${error.message}`);

    // Mark batch as failed
    await db
      .update(microWithdrawalBatches)
      .set({
        status: 'failed',
        failureReason: error.message,
        updatedAt: new Date(),
      })
      .where(eq(microWithdrawalBatches.id, batch.id));

    // Revert requests back to pending
    await Promise.all(
      requests.map((req) =>
        db
          .update(microWithdrawals)
          .set({
            status: 'pending',
            batchId: null,
            updatedAt: new Date(),
          })
          .where(eq(microWithdrawals.id, req.id))
      )
    );

    throw error;
  }
}

/**
 * Verify batch transaction on blockchain (for admin/monitoring)
 */
export async function verifyBatchTransaction(batchId: string): Promise<{
  confirmed: boolean;
  blockNumber: number;
  confirmations: number;
  status: 'success' | 'failed' | 'pending';
}> {
  try {
    // Get batch from database
    const [batch] = await db
      .select()
      .from(microWithdrawalBatches)
      .where(eq(microWithdrawalBatches.id, batchId))
      .limit(1);

    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    if (!batch.transactionHash) {
      throw new Error(`No transaction hash for batch: ${batchId}`);
    }

    // Verify on blockchain
    return await blockchainWithdrawalService.verifyTransaction(batch.transactionHash);
  } catch (error: any) {
    logger.error(`❌ Batch verification failed: ${error.message}`);
    throw error;
  }
}

/**
 * Notify users when batch completes
 */
export async function notifyBatchProcessed(
  batch: MicroWithdrawalBatch,
  requests: MicroWithdrawal[]
): Promise<void> {
  try {
    // Group requests by user
    const requestsByUser = requests.reduce(
      (acc: any, req: any) => {
        if (!acc[req.userId]) acc[req.userId] = [];
        acc[req.userId].push(req);
        return acc;
      },
      {}
    );

    // Send notification to each user
    for (const [userId, userRequests] of Object.entries(requestsByUser)) {
      const totalAmount = (userRequests as MicroWithdrawal[])
        .reduce((sum, req) => sum + parseFloat(req.amount), 0)
        .toFixed(2);

      const gasPerUser = (
        parseFloat(batch.actualGasFee || '0') / requests.length
      ).toFixed(2);

      logger.info(
        `📧 Would notify ${userId} of batch: $${totalAmount}, gas: $${gasPerUser}`
      );
    }
  } catch (error: any) {
    logger.error(`⚠️  Failed to notify users: ${error.message}`);
    // Don't throw - notification failure shouldn't block batch processing
  }
}

/**
 * Cancel a pending micro-withdrawal
 */
export async function cancelMicroWithdrawal(
  requestId: string,
  userId: string
): Promise<MicroWithdrawal> {
  try {
    // Get request
    const [request] = await db
      .select()
      .from(microWithdrawals)
      .where(eq(microWithdrawals.id, requestId));

    if (!request) {
      throw new Error('Withdrawal request not found');
    }

    // Verify user owns this request
    if (request.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // Can only cancel pending requests
    if (request.status !== 'pending') {
      throw new Error(
        `Cannot cancel request with status "${request.status}". Only pending requests can be cancelled.`
      );
    }

    // Update status to cancelled
    const [updated] = await db
      .update(microWithdrawals)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledReason: 'User cancelled',
        updatedAt: new Date(),
      })
      .where(eq(microWithdrawals.id, requestId))
      .returning();

    logger.info(`✅ Micro-withdrawal cancelled: ${requestId}`);

    return updated;
  } catch (error: any) {
    logger.error(`❌ Failed to cancel withdrawal: ${error.message}`);
    throw error;
  }
}

/**
 * Get user's pending withdrawals
 */
export async function getUserPendingWithdrawals(
  userId: string
): Promise<MicroWithdrawal[]> {
  try {
    const requests = await db
      .select()
      .from(microWithdrawals)
      .where(eq(microWithdrawals.userId, userId))
      .orderBy(desc(microWithdrawals.createdAt));

    return requests.filter(
      (r) => r.status === 'pending' || r.status === 'batched'
    );
  } catch (error: any) {
    logger.error(`❌ Failed to get user withdrawals: ${error.message}`);
    throw error;
  }
}

/**
 * Get batch details
 */
export async function getBatchDetails(
  batchId: string
): Promise<{ batch: MicroWithdrawalBatch; requests: MicroWithdrawal[] }> {
  try {
    const [batch] = await db
      .select()
      .from(microWithdrawalBatches)
      .where(eq(microWithdrawalBatches.id, batchId));

    if (!batch) {
      throw new Error('Batch not found');
    }

    const requests = await db
      .select()
      .from(microWithdrawals)
      .where(eq(microWithdrawals.batchId, batchId));

    return { batch, requests };
  } catch (error: any) {
    logger.error(`❌ Failed to get batch details: ${error.message}`);
    throw error;
  }
}

/**
 * Get system statistics
 */
export async function getMicroWithdrawalStats(): Promise<{
  pendingCount: number;
  batchedCount: number;
  totalPendingAmount: string;
  oldestRequestAge: number;
  oldestRequestTime: Date | null;
  estimatedProcessTime: string;
  nextAutoProcessAt: Date | null;
}> {
  try {
    // Get pending requests
    const pendingRequests = await db
      .select()
      .from(microWithdrawals)
      .where(eq(microWithdrawals.status, 'pending'));

    const batchedRequests = await db
      .select()
      .from(microWithdrawals)
      .where(eq(microWithdrawals.status, 'batched'));

    // Calculate totals
    const totalAmount = pendingRequests
      .reduce((sum, req) => sum + parseFloat(req.amount), 0)
      .toFixed(2);

    // Calculate oldest request age
    let oldestRequestAge = 0;
    let oldestRequestTime = null;
    if (pendingRequests.length > 0) {
      oldestRequestTime = new Date(
        Math.min(...pendingRequests.map((r) => r.createdAt.getTime()))
      );
      const ageMs = Date.now() - oldestRequestTime.getTime();
      oldestRequestAge = Math.floor(ageMs / (1000 * 60 * 60)); // Convert to hours
    }

    // Estimate process time
    let estimatedProcessTime = 'pending';
    if (pendingRequests.length >= MICRO_WITHDRAWAL_CONFIG.BATCH_REQUEST_THRESHOLD) {
      estimatedProcessTime = '< 5 minutes (threshold reached)';
    } else if (
      parseFloat(totalAmount) >=
      MICRO_WITHDRAWAL_CONFIG.BATCH_AMOUNT_THRESHOLD
    ) {
      estimatedProcessTime = '< 5 minutes (amount threshold reached)';
    } else if (
      oldestRequestAge >=
      MICRO_WITHDRAWAL_CONFIG.AUTO_BATCH_INTERVAL_HOURS
    ) {
      estimatedProcessTime = '< 5 minutes (time threshold reached)';
    } else {
      const hoursUntilAutoProcess =
        MICRO_WITHDRAWAL_CONFIG.AUTO_BATCH_INTERVAL_HOURS - oldestRequestAge;
      estimatedProcessTime = `~ ${hoursUntilAutoProcess} hours or when threshold reached`;
    }

    // Calculate next auto-process time
    let nextAutoProcessAt = null;
    if (oldestRequestTime) {
      nextAutoProcessAt = new Date(
        oldestRequestTime.getTime() +
          MICRO_WITHDRAWAL_CONFIG.AUTO_BATCH_INTERVAL_HOURS * 60 * 60 * 1000
      );
    }

    return {
      pendingCount: pendingRequests.length,
      batchedCount: batchedRequests.length,
      totalPendingAmount: totalAmount,
      oldestRequestAge,
      oldestRequestTime,
      estimatedProcessTime,
      nextAutoProcessAt,
    };
  } catch (error: any) {
    logger.error(`❌ Failed to get statistics: ${error.message}`);
    throw error;
  }
}

/**
 * Manual batch trigger (admin only)
 */
export async function triggerManualBatchProcess(
  note?: string
): Promise<MicroWithdrawalBatch> {
  try {
    logger.info(`🔔 Manual batch trigger requested: ${note || 'no note'}`);
    return await processBatch('manual');
  } catch (error: any) {
    logger.error(`❌ Manual batch trigger failed: ${error.message}`);
    throw error;
  }
}
