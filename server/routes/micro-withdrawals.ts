/**
 * Micro-Withdrawal Routes
 * 
 * Endpoints for users to request and manage micro-withdrawals
 * Amounts under $10 that get batched for efficient processing
 */

import express, { Router, Request, Response } from 'express';
import { authenticate } from '../auth';
import { z } from 'zod';
import {
  requestMicroWithdrawal,
  getUserPendingWithdrawals,
  checkAndProcessBatch,
  cancelMicroWithdrawal,
  getBatchDetails,
  getMicroWithdrawalStats,
  triggerManualBatchProcess,
} from '../services/micro-withdrawal-service';
import { Logger } from '../utils/logger';

const router: Router = express.Router();
const logger = new Logger('micro-withdrawal-routes');

// Validation schemas
const requestMicroWithdrawalSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format'),
  currency: z.enum(['USDC', 'USDT', 'cUSD', 'ETH']),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

const cancelRequestSchema = z.object({
  requestId: z.string(),
});

/**
 * POST /api/micro-withdrawals/request
 * Request a micro-withdrawal (< $10)
 * 
 * Auto-batches when thresholds are reached
 */
router.post('/request', authenticate, async (req: Request, res: Response) => {
  try {
    // Validate input
    const { amount, currency, toAddress } = requestMicroWithdrawalSchema.parse(req.body);
    const userId = req.user!.id;

    // Request withdrawal
    const withdrawal = await requestMicroWithdrawal(userId, amount, currency, toAddress);

    res.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        status: withdrawal.status,
        message: '✅ Withdrawal request created. Will be processed with next batch.',
      },
    });
  } catch (error: any) {
    logger.error('Error requesting micro-withdrawal:', error);
    const status = error.message.includes('Minimum')
      ? 400
      : error.message.includes('limit')
      ? 400
      : error.message.includes('Invalid')
      ? 400
      : 500;

    res.status(status).json({
      success: false,
      error: error.message || 'Failed to request micro-withdrawal',
    });
  }
});

/**
 * GET /api/micro-withdrawals/pending
 * Get all pending micro-withdrawals for user
 */
router.get('/pending', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const withdrawals = await getUserPendingWithdrawals(userId);

    res.json({
      success: true,
      count: withdrawals.length,
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount,
        currency: w.currency,
        status: w.status,
        toAddress: w.toAddress,
        createdAt: w.createdAt,
        estimatedGasFee: w.estimatedGasFee,
      })),
    });
  } catch (error: any) {
    logger.error('Error fetching pending withdrawals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending withdrawals',
    });
  }
});

/**
 * POST /api/micro-withdrawals/cancel
 * Cancel a pending micro-withdrawal request
 */
router.post('/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const { requestId } = cancelRequestSchema.parse(req.body);
    const userId = req.user!.id;

    const cancelled = await cancelMicroWithdrawal(requestId, userId);

    if (!cancelled) {
      return res.status(400).json({
        success: false,
        error: 'Could not cancel withdrawal',
      });
    }

    res.json({
      success: true,
      message: '❌ Withdrawal request cancelled',
    });
  } catch (error: any) {
    logger.error('Error cancelling micro-withdrawal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel withdrawal',
    });
  }
});

/**
 * GET /api/micro-withdrawals/batch/:batchId
 * Get details about a processed batch
 */
router.get('/batch/:batchId', authenticate, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const batchDetails = await getBatchDetails(batchId);

    if (!batchDetails || !batchDetails.batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found',
      });
    }

    const batch = batchDetails.batch;
    const requests = batchDetails.requests;

    res.json({
      success: true,
      batch: {
        id: batch.id,
        status: batch.status,
        requestCount: requests.length,
        totalAmount: batch.totalAmount,
        currency: batch.currency,
        transactionHash: batch.transactionHash,
        processedAt: batch.processedAt,
        estimatedGasFee: batch.estimatedGasFee,
        actualGasFee: batch.actualGasFee,
      },
      requests: requests.map((r: any) => ({
        id: r.id,
        amount: r.amount,
        address: r.toAddress,
        status: r.status,
        gasFee: r.actualGasFee,
      })),
    });
  } catch (error: any) {
    logger.error('Error fetching batch details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch batch details',
    });
  }
});

/**
 * GET /api/micro-withdrawals/stats
 * Get statistics on pending micro-withdrawals
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const stats = await getMicroWithdrawalStats();

    res.json({
      success: true,
      stats: {
        ...stats,
        info: {
          microWithdrawalLimit: '$10.00',
          minimumAmount: '$0.50',
          batchThreshold: '50 requests or $100 total',
          autoBatchInterval: '24 hours',
        },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

/**
 * POST /api/micro-withdrawals/process-batch
 * Admin endpoint: Manually trigger batch processing
 */
router.post('/process-batch', authenticate, async (req: Request, res: Response) => {
  try {
    // TODO: Add admin check
    // if (!isAdmin(req.user)) {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }

    const batch = await triggerManualBatchProcess();

    if (!batch) {
      return res.json({
        success: true,
        message: 'No pending withdrawals to process',
      });
    }

    res.json({
      success: true,
      batch: {
        id: batch.id,
        requestCount: batch.requestCount,
        totalAmount: batch.totalAmount,
        status: batch.status,
        currency: batch.currency,
        transactionHash: batch.transactionHash,
        message: `✅ Processed ${batch.requestCount} micro-withdrawals in batch ${batch.id}`,
      },
    });
  } catch (error: any) {
    logger.error('Error processing batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch',
    });
  }
});

/**
 * POST /api/micro-withdrawals/check-batch
 * Check if batch should be auto-processed
 */
router.post('/check-batch', authenticate, async (req: Request, res: Response) => {
  try {
    const shouldProcess = await checkAndProcessBatch();

    res.json({
      success: true,
      batchProcessed: shouldProcess,
      message: shouldProcess
        ? '✅ Batch was processed'
        : 'ℹ️ Batch thresholds not reached yet',
    });
  } catch (error: any) {
    logger.error('Error checking batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check batch status',
    });
  }
});

export default router;
