
import express from 'express';
import { z } from 'zod';
import { notificationService } from '../notificationService';

const router = express.Router();

// Validation schema for Stripe webhook event
const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string(),
      amount: z.number(),
      currency: z.string(),
      status: z.string(),
      receipt_url: z.string().optional(),
      customer_email: z.string().optional(),
      customer: z.string().optional(),
      created: z.number(),
      failure_code: z.string().optional(),
      failure_message: z.string().optional(),
      metadata: z.record(z.string()).optional()
    })
  })
});

interface StripePayment {
  id: string;
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  email?: string;
  daoId?: string;
  receipt?: string;
  failureCode?: string;
  failureMessage?: string;
  createdAt: string;
  updatedAt: string;
  retryCount?: number;
}

// In-memory store for Stripe payment status (replace with your database)
const stripePaymentStatus = new Map<string, StripePayment>();
const stripeRetryQueue = new Map<string, StripePayment>();

// Stripe reconciliation service
class StripeReconciliationService {
  static async reconcilePayment(transactionId: string, stripeData: any) {
    const payment = stripePaymentStatus.get(transactionId);
    if (!payment) {
      console.warn(`Stripe reconciliation: Transaction ${transactionId} not found`);
      return false;
    }

    // Verify amount and currency match
    if (payment.amount !== stripeData.amount || payment.currency !== stripeData.currency) {
      console.error(`Stripe reconciliation failed: Amount/currency mismatch for ${transactionId}`);
      return false;
    }

    // Update payment status
    const status = stripeData.status === 'succeeded' ? 'completed' : 
                  stripeData.status === 'requires_payment_method' ? 'failed' : 
                  stripeData.status;

    payment.status = status;
    payment.receipt = stripeData.receipt_url;
    payment.failureCode = stripeData.failure_code;
    payment.failureMessage = stripeData.failure_message;
    payment.updatedAt = new Date().toISOString();

    stripePaymentStatus.set(transactionId, payment);
    return true;
  }

  static async processCompletedPayment(payment: StripePayment) {
    try {
      // Credit user account or update DAO premium status
      if (payment.daoId) {
        console.log(`Crediting DAO ${payment.daoId} with ${payment.amount / 100} ${payment.currency.toUpperCase()}`);
        // TODO: Update DAO premium status in database
      }

      // Send success notification via email if available
      if (payment.email) {
        await notificationService.sendPaymentNotification(payment.email, {
          type: 'payment_success',
          amount: payment.amount / 100, // Stripe amounts are in cents
          currency: payment.currency.toUpperCase(),
          transactionId: payment.transactionId
        });
      }

      // Update real-time status
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: 'completed',
        receipt: payment.receipt,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error processing completed Stripe payment:', error);
      return false;
    }
  }

  static async processFailedPayment(payment: StripePayment) {
    try {
      // Check if payment can be retried based on failure code
      const retryableFailures = ['card_declined', 'insufficient_funds', 'processing_error'];
      
      if (payment.failureCode && retryableFailures.includes(payment.failureCode) && (payment.retryCount || 0) < 2) {
        payment.retryCount = (payment.retryCount || 0) + 1;
        stripeRetryQueue.set(payment.transactionId, payment);
        
        // For Stripe, we typically don't automatically retry but notify the user to update payment method
        if (payment.email) {
          await notificationService.sendPaymentNotification(payment.email, {
            type: 'payment_retry',
            amount: payment.amount / 100,
            currency: payment.currency.toUpperCase(),
            transactionId: payment.transactionId,
            errorMessage: payment.failureMessage
          });
        }
      } else {
        // Send final failure notification
        if (payment.email) {
          await notificationService.sendPaymentNotification(payment.email, {
            type: 'payment_failed',
            amount: payment.amount / 100,
            currency: payment.currency.toUpperCase(),
            transactionId: payment.transactionId,
            errorMessage: payment.failureMessage || payment.failureCode
          });
        }
      }

      // Update real-time status
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: 'failed',
        error: payment.failureMessage || payment.failureCode,
        retryCount: payment.retryCount,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error processing failed Stripe payment:', error);
      return false;
    }
  }
}

// GET /api/payments/stripe/status/:transactionId
router.get('/status/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    const status = stripePaymentStatus.get(transactionId);
    
    if (!status) {
      return res.status(404).json({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      payment: {
        ...status,
        amount: status.amount / 100 // Convert from cents to dollars
      },
      retryInfo: stripeRetryQueue.has(transactionId) ? {
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

// POST /api/payments/stripe/webhook
router.post('/webhook', async (req, res) => {
  try {
    // TODO: Verify Stripe webhook signature in production
    // const sig = req.headers['stripe-signature'];
    // const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    
    const event = stripeWebhookSchema.parse(req.body);
    const payment = event.data.object;

    // Only process relevant events
    const relevantEvents = [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'invoice.payment_succeeded',
      'invoice.payment_failed'
    ];

    if (!relevantEvents.includes(event.type)) {
      return res.status(200).json({ received: true });
    }

    // Reconcile payment
    const reconciled = await StripeReconciliationService.reconcilePayment(
      payment.id,
      payment
    );

    if (!reconciled) {
      console.warn(`Stripe webhook: Payment ${payment.id} not found for reconciliation`);
      
      // Create new payment record if it doesn't exist (for external payments)
      const newPayment: StripePayment = {
        id: payment.id,
        transactionId: payment.id,
        status: payment.status === 'succeeded' ? 'completed' : 'failed',
        amount: payment.amount,
        currency: payment.currency,
        email: payment.customer_email,
        receipt: payment.receipt_url,
        failureCode: payment.failure_code,
        failureMessage: payment.failure_message,
        createdAt: new Date(payment.created * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        daoId: payment.metadata?.daoId
      };
      
      stripePaymentStatus.set(payment.id, newPayment);
    }

    const updatedPayment = stripePaymentStatus.get(payment.id);
    if (!updatedPayment) {
      return res.status(500).json({ error: 'Failed to process payment' });
    }

    // Process based on event type
    if (event.type.includes('succeeded')) {
      await StripeReconciliationService.processCompletedPayment(updatedPayment);
    } else if (event.type.includes('failed')) {
      await StripeReconciliationService.processFailedPayment(updatedPayment);
    }

    console.log(`Stripe payment ${payment.id} processed: ${event.type}`);

    // Respond to Stripe
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({
      code: 'INVALID_WEBHOOK',
      message: 'Invalid Stripe webhook data',
      details: error.message
    });
  }
});

// GET /api/payments/stripe/reconcile
router.get('/reconcile', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get all payments in date range
    const payments = Array.from(stripePaymentStatus.values()).filter(payment => {
      if (startDate && payment.createdAt < startDate) return false;
      if (endDate && payment.createdAt > endDate) return false;
      return true;
    });

    const reconciliation = {
      totalPayments: payments.length,
      completed: payments.filter(p => p.status === 'completed').length,
      failed: payments.filter(p => p.status === 'failed').length,
      pending: payments.filter(p => p.status === 'pending').length,
      inRetryQueue: stripeRetryQueue.size,
      totalAmount: payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + (p.amount / 100), 0), // Convert from cents
      successRate: payments.length > 0 ? 
        (payments.filter(p => p.status === 'completed').length / payments.length * 100).toFixed(2) + '%' : '0%',
      topFailureReasons: this.getTopFailureReasons(payments.filter(p => p.status === 'failed'))
    };

    res.json({
      success: true,
      reconciliation,
      payments: payments.map(p => ({
        ...p,
        amount: p.amount / 100, // Convert from cents
        inRetryQueue: stripeRetryQueue.has(p.transactionId)
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

function getTopFailureReasons(failedPayments: StripePayment[]) {
  const reasons = failedPayments.reduce((acc, payment) => {
    const reason = payment.failureCode || payment.failureMessage || 'unknown';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(reasons)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
}

export default router;
