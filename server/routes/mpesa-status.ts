import express from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { paymentTransactions } from '../../shared/schema';
import { authenticate } from '../auth';
import { reconcileMpesaCallback } from '../payments';

const router = express.Router();

router.get('/status/:transactionId', authenticate, async (req, res) => {
  try {
    const transactionId = req.params.transactionId;
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });

    const [payment] = await db
      .select()
      .from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.userId, userId),
        eq(paymentTransactions.provider, 'mpesa'),
        sql`(
          ${paymentTransactions.reference} = ${transactionId}
          OR COALESCE(
            ${paymentTransactions.metadata}->>'checkoutRequestID',
            ${paymentTransactions.metadata}->>'checkoutRequestId',
            ${paymentTransactions.metadata}->>'CheckoutRequestID'
          ) = ${transactionId}
        )`
      ))
      .limit(1);

    if (!payment) {
      return res.status(404).json({ code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found' });
    }

    const metadata = (payment.metadata || {}) as Record<string, unknown>;
    return res.json({
      success: true,
      payment: {
        reference: payment.reference,
        transactionId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        receipt: metadata.mpesaReceipt,
        resultCode: metadata.mpesaResultCode,
        resultDesc: metadata.mpesaResultDesc,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (error) {
    console.error('M-Pesa status lookup failed:', error);
    return res.status(500).json({ code: 'STATUS_CHECK_FAILED', message: 'Failed to check payment status' });
  }
});

router.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body?.Body?.stkCallback;
    if (!callbackData) {
      return res.status(400).json({ code: 'INVALID_CALLBACK', message: 'Invalid callback data' });
    }
    const result = await reconcileMpesaCallback(callbackData, req.query.token as string | undefined);
    return res.json({ success: true, reconciled: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('M-Pesa callback reconciliation failed:', message);
    return res.status(500).json({ code: 'RECONCILIATION_FAILED', message });
  }
});

router.post('/retry/:transactionId', authenticate, (_req, res) => {
  return res.status(410).json({
    code: 'RETRY_UNSUPPORTED',
    message: 'A failed M-Pesa payment must be initiated again as a new DAO contribution.',
  });
});

router.get('/reconcile', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    const payments = await db
      .select({
        amount: paymentTransactions.amount,
        status: paymentTransactions.status,
        createdAt: paymentTransactions.createdAt,
      })
      .from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.userId, userId),
        eq(paymentTransactions.provider, 'mpesa')
      ));

    const completed = payments.filter((payment) => payment.status === 'completed');
    return res.json({
      success: true,
      reconciliation: {
        totalPayments: payments.length,
        completed: completed.length,
        failed: payments.filter((payment) => payment.status === 'failed').length,
        pending: payments.filter((payment) => payment.status === 'pending').length,
        totalAmount: completed.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      },
    });
  } catch (error) {
    console.error('M-Pesa reconciliation report failed:', error);
    return res.status(500).json({ code: 'RECONCILIATION_FAILED', message: 'Failed to generate reconciliation report' });
  }
});

export default router;
