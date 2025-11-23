/**
 * KotaniPay Deposits & Withdrawals Routes
 * Handles M-Pesa ↔ cUSD conversion flows
 */

import express from 'express';
import { z } from 'zod';
import { KotanipayService } from '../services/kotanipayService';
import { db } from '../db';
import { mpesaTransactions as mpesaTransactionsTable } from '../../shared/financialEnhancedSchema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Validation schemas
const depositSchema = z.object({
  userId: z.string().uuid(),
  phone: z.string().regex(/^\+254[0-9]{9}$/, 'Invalid M-Pesa phone number'),
  amountKES: z.number().min(100).max(1000000),
  reference: z.string().optional(),
  daoId: z.string().uuid().optional(),
});

const withdrawalSchema = z.object({
  userId: z.string().uuid(),
  phone: z.string().regex(/^\+254[0-9]{9}$/, 'Invalid M-Pesa phone number'),
  amountCUSD: z.number().min(0.1).max(100000),
  daoId: z.string().uuid().optional(),
});

const transactionStatusSchema = z.object({
  transactionId: z.string(),
});

// ============================================================================
// DEPOSITS (M-Pesa → cUSD)
// ============================================================================

/**
 * POST /api/deposits/initiate
 * Initiate a deposit from M-Pesa
 */
router.post('/initiate', async (req, res) => {
  try {
    const validated = depositSchema.parse(req.body);

    const response = await KotanipayService.initiateDeposit({
      userId: validated.userId,
      phone: validated.phone,
      amountKES: validated.amountKES,
      reference: validated.reference,
      daoId: validated.daoId,
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('Deposit initiation error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'DEPOSIT_INITIATION_FAILED',
    });
  }
});

/**
 * GET /api/deposits/status/:transactionId
 * Check deposit status
 */
router.get('/status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const [transaction] = await (db as any)
      .select()
      .from(mpesaTransactionsTable)
      .where(eq(mpesaTransactionsTable.checkoutRequestId, transactionId));

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      data: {
        transactionId: transaction.transactionId,
        status: transaction.status,
        type: transaction.type,
        amountKES: parseFloat(transaction.amountKES),
        amountCUSD: parseFloat(transaction.amountCUSD),
        exchangeRate: parseFloat(transaction.exchangeRate),
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        receipt: transaction.mpesaReceipt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'STATUS_CHECK_FAILED',
    });
  }
});

/**
 * POST /api/deposits/webhook
 * KotaniPay webhook callback for deposit confirmation
 */
router.post('/webhook', async (req, res) => {
  try {
    const { transactionId, status, mpesaReceipt, amount } = req.body;

    // Verify webhook signature (if needed)
    //const isValid = verifyKotanipaySignature(req);

    if (status === 'completed') {
      await KotanipayService.completeDeposit(transactionId, mpesaReceipt, req.body);
      res.json({
        success: true,
        message: 'Deposit confirmed',
      });
    } else if (status === 'failed') {
      console.warn(`Deposit failed: ${transactionId}`);
      await KotanipayService['failDeposit'](transactionId, 'M-Pesa payment failed');
      res.json({
        success: true,
        message: 'Deposit marked as failed',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Unknown status',
      });
    }
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// WITHDRAWALS (cUSD → M-Pesa)
// ============================================================================

/**
 * POST /api/withdrawals/initiate
 * Initiate a withdrawal to M-Pesa
 */
router.post('/initiate', async (req, res) => {
  try {
    const validated = withdrawalSchema.parse(req.body);

    const response = await KotanipayService.initiateWithdrawal({
      userId: validated.userId,
      phone: validated.phone,
      amountCUSD: validated.amountCUSD,
      daoId: validated.daoId,
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('Withdrawal initiation error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'WITHDRAWAL_INITIATION_FAILED',
    });
  }
});

/**
 * GET /api/withdrawals/status/:transactionId
 * Check withdrawal status
 */
router.get('/status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const [transaction] = await (db as any)
      .select()
      .from(mpesaTransactionsTable)
      .where(eq(mpesaTransactionsTable.checkoutRequestId, transactionId));

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      data: {
        transactionId: transaction.checkoutRequestId,
        status: transaction.status,
        type: transaction.transactionType,
        amount: transaction.amount,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'STATUS_CHECK_FAILED',
    });
  }
});

/**
 * POST /api/withdrawals/webhook
 * KotaniPay webhook callback for withdrawal confirmation
 */
router.post('/webhook', async (req, res) => {
  try {
    const { transactionId, status, mpesaResponse } = req.body;

    if (status === 'completed') {
      await KotanipayService.completeWithdrawal(transactionId, mpesaResponse);
      res.json({
        success: true,
        message: 'Withdrawal confirmed',
      });
    } else if (status === 'failed') {
      console.warn(`Withdrawal failed: ${transactionId}`);
      await KotanipayService['refundWithdrawal'](transactionId);
      res.json({
        success: true,
        message: 'Withdrawal marked as failed, balance refunded',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Unknown status',
      });
    }
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================

/**
 * GET /api/transactions/history?userId=...&type=deposit&limit=50
 * Get transaction history for a user
 */
router.get('/history', async (req, res) => {
  try {
    const { userId, type, limit = '50', offset = '0' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    let query = (db as any)
      .select()
      .from(mpesaTransactionsTable)
      .where(eq(mpesaTransactionsTable.userId, userId as string));

    if (type && (type === 'stk_push' || type === 'b2c')) {
      query = query.where(eq(mpesaTransactionsTable.transactionType, type));
    }

    const transactions = await query
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      data: transactions.map((t: any) => ({
        transactionId: t.checkoutRequestId,
        type: t.transactionType,
        status: t.status,
        amount: t.amount,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/transactions/summary?userId=...
 * Get transaction summary (totals, stats)
 */
router.get('/summary', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const transactions = await (db as any)
      .select()
      .from(mpesaTransactionsTable)
      .where(eq(mpesaTransactionsTable.userId, userId as string));

    const deposits = transactions.filter((t: any) => t.type === 'deposit');
    const withdrawals = transactions.filter((t: any) => t.type === 'withdrawal');

    const summary = {
      totalDeposits: deposits.reduce((sum: number, t: any) => sum + parseFloat(t.amountCUSD), 0),
      totalWithdrawals: withdrawals.reduce(
        (sum: number, t: any) => sum + parseFloat(t.amountCUSD),
        0
      ),
      completedDeposits: deposits.filter((t: any) => t.status === 'completed').length,
      completedWithdrawals: withdrawals.filter((t: any) => t.status === 'completed').length,
      pendingTransactions: transactions.filter((t: any) => t.status === 'pending').length,
      failedTransactions: transactions.filter((t: any) => t.status === 'failed').length,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
