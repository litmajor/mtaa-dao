import express from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db';
import { mpesaTransactions } from '../../shared/financialEnhancedSchema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { authenticate } from '../auth';
import { KotanipayService } from '../services/kotanipayService';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC ENDPOINTS (No User Auth - Protected by Cryptographic Signatures)
// ════════════════════════════════════════════════════════════════════════════════

const kotaniWebhookSchema = z.object({
  transactionId: z.string(), // Corresponds to checkoutRequestId / internal tracking ID
  status: z.enum(['pending', 'completed', 'failed', 'cancelled', 'successful']),
  amount: z.number(),
  currency: z.string(),
  phone: z.string(),
  mpesaReceipt: z.string().optional(),
  conversationId: z.string().optional(),
  errorMessage: z.string().optional()
});

/**
 * POST /api/payments/kotanipay/callback
 * Webhook consumer for KotaniPay infrastructure updates
 */
router.post('/callback', async (req, res) => {
  try {
    // 🛡️ Verify Webhook Payload Origin Authenticity
    const signature = req.headers['x-kotani-signature'];
    if (process.env.NODE_ENV === 'production' && !signature) {
      return res.status(401).json({ success: false, message: 'Missing webhook signature context.' });
    }

    if (signature && process.env.KOTANIPAY_WEBHOOK_SECRET) {
      const computedHash = crypto
        .createHmac('sha256', process.env.KOTANIPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== computedHash) {
        return res.status(401).json({ success: false, message: 'Tampered signature payload verification rejected.' });
      }
    }

    const webhook = kotaniWebhookSchema.parse(req.body);
    
    // Look up tracking context within the master PostgreSQL ledger
    const [transaction] = await (db as any)
      .select()
      .from(mpesaTransactions)
      .where(eq(mpesaTransactions.checkoutRequestId, webhook.transactionId));

    if (!transaction) {
      return res.status(404).json({ code: 'TRANSACTION_NOT_FOUND', message: 'Transaction tracking index missing.' });
    }

    const rawStatus = webhook.status.toLowerCase();
    const isSuccess = ['completed', 'successful'].includes(rawStatus);

    if (isSuccess) {
      if (transaction.transactionType === 'stk_push') {
        // Handle M-Pesa → Stablecoin Inflow Execution Loop
        await KotanipayService.completeDeposit(
          webhook.transactionId,
          webhook.mpesaReceipt || webhook.transactionId,
          req.body
        );
      } else if (transaction.transactionType === 'b2c') {
        // Handle Stablecoin → M-Pesa Outflow Clearing Pipeline
        await KotanipayService.completeWithdrawal(
          webhook.transactionId,
          { ConversationID: webhook.conversationId || webhook.transactionId }
        );
      }
    } else if (['failed', 'cancelled'].includes(rawStatus)) {
      if (transaction.transactionType === 'stk_push') {
        await KotanipayService.failDeposit(webhook.transactionId, webhook.errorMessage || 'Transaction rejected');
      } else if (transaction.transactionType === 'b2c') {
        await KotanipayService.refundWithdrawal(webhook.transactionId);
      }
    }

    res.json({ success: true, reconciled: true, status: webhook.status });
  } catch (error: any) {
    console.error('KotaniPay callback validation failure:', error);
    res.status(400).json({ code: 'INVALID_CALLBACK', message: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// 2. AUTHENTICATED ENDPOINTS (Requires Standard User Session Authentication Headers)
// ════════════════════════════════════════════════════════════════════════════════

router.use(authenticate);

/**
 * GET /api/payments/kotanipay/status/:transactionId
 * Safe database-driven lookup endpoint
 */
router.get('/status/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    const [statusRecord] = await (db as any)
      .select()
      .from(mpesaTransactions)
      .where(eq(mpesaTransactions.checkoutRequestId, transactionId));
    
    if (!statusRecord) {
      return res.status(404).json({ code: 'TRANSACTION_NOT_FOUND', message: 'Requested transaction registry index missing.' });
    }

    res.json({
      success: true,
      payment: {
        id: statusRecord.checkoutRequestId,
        transactionId: statusRecord.checkoutRequestId,
        status: statusRecord.status,
        amount: parseFloat(statusRecord.amount),
        phone: statusRecord.phoneNumber,
        type: statusRecord.transactionType,
        createdAt: statusRecord.createdAt,
        updatedAt: statusRecord.updatedAt,
        metadata: statusRecord.metadata
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'STATUS_CHECK_FAILED', message: 'Failed to verify transaction ledger state.', details: error.message });
  }
});

/**
 * POST /api/payments/kotanipay/retry/:transactionId
 * Atomic retry state tracking handler
 */
router.post('/retry/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    const [transaction] = await (db as any)
      .select()
      .from(mpesaTransactions)
      .where(eq(mpesaTransactions.checkoutRequestId, transactionId));
    
    if (!transaction) {
      return res.status(404).json({ code: 'TRANSACTION_NOT_FOUND', message: 'Target entry was not discovered.' });
    }

    if (transaction.status !== 'failed') {
      return res.status(400).json({ code: 'INVALID_STATUS', message: 'Only transactions marked explicitly as failed can enter the manual correction loop.' });
    }

    const currentRetries = (transaction.metadata as any)?.retryCount || 0;
    if (currentRetries >= 3) {
      return res.status(400).json({ code: 'RETRY_LIMIT_EXCEEDED', message: 'Maximum engine fallback recovery thresholds exceeded.' });
    }

    // Atomically increment retry indexes within row execution metadata logs
    const updatedMetadata = {
      ...(typeof transaction.metadata === 'object' ? transaction.metadata : {}),
      retryCount: currentRetries + 1,
      lastRetryAt: new Date().toISOString()
    };

    await (db as any)
      .update(mpesaTransactions)
      .set({
        status: 'pending',
        metadata: updatedMetadata,
        updatedAt: new Date()
      })
      .where(eq(mpesaTransactions.checkoutRequestId, transactionId));

    // Re-dispatch target operational task context to service engine
    if (transaction.transactionType === 'stk_push') {
      await KotanipayService.initiateDeposit({
        userId: transaction.userId,
        phone: transaction.phoneNumber,
        amountKES: parseFloat(transaction.amount),
        reference: transaction.checkoutRequestId,
        daoId: (transaction.metadata as any)?.daoId
      });
    }

    res.json({ success: true, message: 'Kotani Pay transactional queue recovery sequence re-dispatched.', retryCount: currentRetries + 1 });
  } catch (error: any) {
    res.status(500).json({ code: 'RETRY_FAILED', message: error.message });
  }
});

/**
 * GET /api/payments/kotanipay/reconcile
 * Historical analytics compiler engine
 */
router.get('/reconcile', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let queryConditions = [];
    if (startDate) queryConditions.push(sql`${mpesaTransactions.createdAt} >= ${new Date(startDate as string)}`);
    if (endDate) queryConditions.push(sql`${mpesaTransactions.createdAt} <= ${new Date(endDate as string)}`);

    const records = await (db as any)
      .select()
      .from(mpesaTransactions)
      .where(queryConditions.length > 0 ? and(...queryConditions) : undefined);

    const reconciliation = {
      totalPayments: records.length,
      completed: records.filter((r: any) => r.status === 'completed').length,
      failed: records.filter((r: any) => r.status === 'failed').length,
      pending: records.filter((r: any) => r.status === 'pending').length,
      cancelled: records.filter((r: any) => r.status === 'cancelled').length,
      totalAmountKES: records
        .filter((r: any) => r.status === 'completed' && r.transactionType === 'stk_push')
        .reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0)
    };

    res.json({
      success: true,
      reconciliation,
      payments: records.map((r: any) => ({
        transactionId: r.checkoutRequestId,
        status: r.status,
        amount: parseFloat(r.amount),
        type: r.transactionType,
        phone: r.phoneNumber,
        createdAt: r.createdAt
      }))
    });
  } catch (error: any) {
    res.status(500).json({ code: 'RECONCILIATION_FAILED', message: 'Failed to compile active ledger evaluation report.', details: error.message });
  }
});

export default router;