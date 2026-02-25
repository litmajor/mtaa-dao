
import express from 'express';
import { z } from 'zod';
import { db } from '../db';
import { notificationService } from '../notificationService';

const router = express.Router();

// Database schema for payments (mock - replace with your actual schema)
interface Payment {
  id: string;
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  phone: string;
  daoId?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
  retryCount?: number;
  errorMessage?: string;
}

// In-memory store for KotaniPay payment status (replace with your database)
const kotaniPaymentStatus = new Map<string, Payment>();
const paymentRetryQueue = new Map<string, Payment>();

// Validation schema for KotaniPay webhook
const kotaniWebhookSchema = z.object({
  transactionId: z.string(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']),
  amount: z.number(),
  currency: z.string(),
  phone: z.string(),
  reference: z.string().optional(),
  timestamp: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional()
});

// Payment reconciliation service
class PaymentReconciliationService {
  static async reconcilePayment(transactionId: string, webhookData: any) {
    const payment = kotaniPaymentStatus.get(transactionId);
    if (!payment) {
      console.warn(`Payment reconciliation: Transaction ${transactionId} not found`);
      return false;
    }

    // Verify amount and currency match
    if (payment.amount !== webhookData.amount || payment.currency !== webhookData.currency) {
      console.error(`Payment reconciliation failed: Amount/currency mismatch for ${transactionId}`);
      return false;
    }

    // Update payment status
    payment.status = webhookData.status;
    payment.updatedAt = new Date().toISOString();
    if (webhookData.errorMessage) {
      payment.errorMessage = webhookData.errorMessage;
    }

    kotaniPaymentStatus.set(transactionId, payment);
    
    // TODO: Update your actual database
    // await db.update(payments).set(payment).where(eq(payments.transactionId, transactionId));

    return true;
  }

  static async processCompletedPayment(payment: Payment) {
    try {
      // Credit user account or update DAO premium status
      if (payment.daoId) {
        // TODO: Update DAO premium status
        console.log(`Crediting DAO ${payment.daoId} with ${payment.amount} ${payment.currency}`);
      }

      // Send success notification
      await notificationService.sendPaymentNotification(payment.phone, {
        type: 'payment_success',
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId
      });

      return true;
    } catch (error) {
      console.error('Error processing completed payment:', error);
      return false;
    }
  }

  static async processFailedPayment(payment: Payment) {
    try {
      // Add to retry queue if retries haven't been exhausted
      if ((payment.retryCount || 0) < 3) {
        payment.retryCount = (payment.retryCount || 0) + 1;
        paymentRetryQueue.set(payment.transactionId, payment);
        
        // Schedule retry after delay
        setTimeout(() => {
          this.retryFailedPayment(payment.transactionId);
        }, 30000 * payment.retryCount); // Exponential backoff
      }

      // Send failure notification
      await notificationService.sendPaymentNotification(payment.phone, {
        type: 'payment_failed',
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId,
        errorMessage: payment.errorMessage
      });

      return true;
    } catch (error) {
      console.error('Error processing failed payment:', error);
      return false;
    }
  }

  static async retryFailedPayment(transactionId: string) {
    const payment = paymentRetryQueue.get(transactionId);
    if (!payment) return;

    try {
      // TODO: Retry payment with KotaniPay API
      console.log(`Retrying payment ${transactionId} (attempt ${payment.retryCount})`);
      
      // Mock retry logic - replace with actual KotaniPay API call
      const retrySuccess = Math.random() > 0.5; // 50% chance of success
      
      if (retrySuccess) {
        payment.status = 'completed';
        paymentRetryQueue.delete(transactionId);
        await this.processCompletedPayment(payment);
      } else {
        payment.status = 'failed';
        await this.processFailedPayment(payment);
      }
    } catch (error) {
      console.error(`Retry failed for payment ${transactionId}:`, error);
    }
  }
}

// GET /api/payments/kotanipay/status/:transactionId
router.get('/status/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    const status = kotaniPaymentStatus.get(transactionId);
    
    if (!status) {
      return res.status(404).json({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      payment: status,
      retryInfo: paymentRetryQueue.has(transactionId) ? {
        inRetryQueue: true,
        retryCount: status.retryCount || 0
      } : null
    });
  } catch (error: any) {
    res.status(500).json({
      code: 'STATUS_CHECK_FAILED',
      message: 'Failed to check payment status',
      details: error.message
    });
  }
});

// POST /api/payments/kotanipay/callback
router.post('/callback', async (req, res) => {
  try {
    const webhook = kotaniWebhookSchema.parse(req.body);
    
    // Reconcile payment
    const reconciled = await PaymentReconciliationService.reconcilePayment(
      webhook.transactionId, 
      webhook
    );

    if (!reconciled) {
      return res.status(400).json({
        code: 'RECONCILIATION_FAILED',
        message: 'Payment reconciliation failed'
      });
    }

    // Update payment status
    const payment: Payment = {
      id: webhook.transactionId,
      transactionId: webhook.transactionId,
      status: webhook.status,
      amount: webhook.amount,
      currency: webhook.currency,
      phone: webhook.phone,
      reference: webhook.reference,
      createdAt: kotaniPaymentStatus.get(webhook.transactionId)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      errorMessage: webhook.errorMessage
    };

    kotaniPaymentStatus.set(webhook.transactionId, payment);

    // Process based on status
    switch (webhook.status) {
      case 'completed':
        await PaymentReconciliationService.processCompletedPayment(payment);
        break;
      case 'failed':
      case 'cancelled':
        await PaymentReconciliationService.processFailedPayment(payment);
        break;
      case 'pending':
        // Send pending notification
        await notificationService.sendPaymentNotification(payment.phone, {
          type: 'payment_pending',
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId
        });
        break;
    }

    console.log(`KotaniPay payment ${webhook.transactionId} status updated: ${webhook.status}`);

    res.json({ 
      success: true,
      reconciled: true,
      status: webhook.status
    });
  } catch (error: any) {
    console.error('KotaniPay callback error:', error);
    res.status(400).json({
      code: 'INVALID_CALLBACK',
      message: 'Invalid callback data',
      details: error.message
    });
  }
});

// GET /api/payments/kotanipay/retry/:transactionId
router.post('/retry/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    const payment = kotaniPaymentStatus.get(transactionId);
    
    if (!payment) {
      return res.status(404).json({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found'
      });
    }

    if (payment.status !== 'failed') {
      return res.status(400).json({
        code: 'INVALID_STATUS',
        message: 'Can only retry failed payments'
      });
    }

    if ((payment.retryCount || 0) >= 3) {
      return res.status(400).json({
        code: 'RETRY_LIMIT_EXCEEDED',
        message: 'Maximum retry attempts exceeded'
      });
    }

    // Add to retry queue
    payment.retryCount = (payment.retryCount || 0) + 1;
    paymentRetryQueue.set(transactionId, payment);
    
    // Retry immediately
    await PaymentReconciliationService.retryFailedPayment(transactionId);

    res.json({
      success: true,
      message: 'Payment retry initiated',
      retryCount: payment.retryCount
    });
  } catch (error: any) {
    res.status(500).json({
      code: 'RETRY_FAILED',
      message: 'Failed to retry payment',
      details: error.message
    });
  }
});

// GET /api/payments/kotanipay/reconcile
router.get('/reconcile', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get all payments in date range
    const payments = Array.from(kotaniPaymentStatus.values()).filter(payment => {
      if (startDate && payment.createdAt < startDate) return false;
      if (endDate && payment.createdAt > endDate) return false;
      return true;
    });

    const reconciliation = {
      totalPayments: payments.length,
      completed: payments.filter(p => p.status === 'completed').length,
      failed: payments.filter(p => p.status === 'failed').length,
      pending: payments.filter(p => p.status === 'pending').length,
      cancelled: payments.filter(p => p.status === 'cancelled').length,
      inRetryQueue: paymentRetryQueue.size,
      totalAmount: payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0)
    };

    res.json({
      success: true,
      reconciliation,
      payments: payments.map(p => ({
        ...p,
        inRetryQueue: paymentRetryQueue.has(p.transactionId)
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      code: 'RECONCILIATION_FAILED',
      message: 'Failed to generate reconciliation report',
      details: error.message
    });
  }
});

export default router;
