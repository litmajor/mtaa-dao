import express from 'express';
import { db } from '../db';
import { mpesaTransactions } from '../../shared/financialEnhancedSchema';
import { eq, and, sql } from 'drizzle-orm';
import { authenticate } from '../auth';
import { KotanipayService } from '../services/kotanipayService';
import { KotaniSelfCustodyRampService } from '../services/kotaniSelfCustodyRampService';

const router = express.Router();

type LedgerWebhook = {
  referenceId: string;
  status: string;
  receipt?: string;
  conversationId?: string;
  errorMessage?: string;
  data: Record<string, unknown>;
};

function getObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function getString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}

export function normalizeKotaniLedgerWebhook(payload: unknown): LedgerWebhook | undefined {
  const envelope = getObject(payload);
  if (!envelope) return undefined;
  const data = getObject(envelope.data) ?? envelope;
  const referenceId = getString(data.reference_id, data.referenceId, data.transactionId);
  const status = getString(data.status);
  if (!referenceId || !status) return undefined;
  return {
    referenceId,
    status: status.toUpperCase(),
    receipt: getString(data.telco_id, data.mpesaReceipt, data.mpesa_receipt),
    conversationId: getString(data.conversationId, data.conversation_id, data.telco_id),
    errorMessage: getString(data.error_message, data.errorMessage),
    data,
  };
}

function getRawBody(req: express.Request): Buffer | undefined {
  return (req as express.Request & { rawBody?: Buffer }).rawBody;
}

function acknowledgeWebhook(res: express.Response): void {
  res.status(200).json({ received: true });
}

// ════════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC ENDPOINTS (No User Auth - Protected by Cryptographic Signatures)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/payments/kotanipay/callback
 * Webhook consumer for KotaniPay infrastructure updates
 */
router.post('/callback', async (req, res) => {
  try {
    const rawBody = getRawBody(req);
    const payload: unknown = rawBody ? JSON.parse(rawBody.toString('utf8')) : req.body;
    const envelope = getObject(payload);
    const data = getObject(envelope?.data) ?? envelope;
    const signature = req.header('x-kotani-signature')
      || (typeof envelope?.signature === 'string' ? envelope.signature : undefined);
    const secret = process.env.KOTANIPAY_WEBHOOK_SECRET;
    if (process.env.NODE_ENV === 'production' || signature) {
      const signedBody = rawBody
        ? KotaniSelfCustodyRampService.getWebhookSignedBody(rawBody)
        : undefined;
      if (!rawBody || !signature || !secret
        || !KotaniSelfCustodyRampService.verifyWebhookSignature(rawBody, signature, secret, signedBody)) {
        console.warn('Invalid KotaniPay ledger webhook signature; acknowledging without processing.');
        acknowledgeWebhook(res);
        return;
      }
    }

    const webhook = normalizeKotaniLedgerWebhook(payload);
    if (!webhook || !data) {
      console.warn('Malformed KotaniPay ledger webhook; acknowledging without processing.');
      acknowledgeWebhook(res);
      return;
    }

    // Look up tracking context within the master PostgreSQL ledger
    const [transaction] = await db
      .select()
      .from(mpesaTransactions)
      .where(eq(mpesaTransactions.checkoutRequestId, webhook.referenceId))
      .limit(1);

    if (!transaction) {
      console.warn('Unknown KotaniPay ledger reference; acknowledging webhook.', webhook.referenceId);
      acknowledgeWebhook(res);
      return;
    }

    const isSuccess = ['COMPLETED', 'SUCCESSFUL', 'SUCCESS'].includes(webhook.status);

    if (isSuccess) {
      if (transaction.transactionType === 'stk_push') {
        // Handle M-Pesa → Stablecoin Inflow Execution Loop
        await KotanipayService.completeDeposit(
          webhook.referenceId,
          webhook.receipt || webhook.referenceId,
          webhook.data
        );
      } else if (transaction.transactionType === 'b2c') {
        // Handle Stablecoin → M-Pesa Outflow Clearing Pipeline
        await KotanipayService.completeWithdrawal(
          webhook.referenceId,
          { ConversationID: webhook.conversationId || webhook.referenceId }
        );
      }
    } else if (['FAILED', 'CANCELLED', 'CANCELED'].includes(webhook.status)) {
      if (transaction.transactionType === 'stk_push') {
        await KotanipayService.failDeposit(webhook.referenceId, webhook.errorMessage || 'Transaction rejected');
      } else if (transaction.transactionType === 'b2c') {
        await KotanipayService.refundWithdrawal(webhook.referenceId);
      }
    }

    acknowledgeWebhook(res);
  } catch (error) {
    console.error('KotaniPay ledger webhook processing failed; acknowledging provider callback.', error);
    acknowledgeWebhook(res);
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

    return res.status(409).json({
      code: 'RETRY_UNSUPPORTED',
      message: 'A safe retry is unavailable until KotaniPay confirms same-transaction STK idempotency. The failed transaction was not changed.',
    });
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