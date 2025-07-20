import express from 'express';
import { z } from 'zod';
const router = express.Router();

// In-memory store for Stripe payment status (replace with your database)
const stripePaymentStatus = new Map<string, any>();

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
      created: z.number()
    })
  })
});

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
    res.json(status);
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
    // Parse and validate Stripe webhook event
    const event = stripeWebhookSchema.parse(req.body);
    const payment = event.data.object;
    // Update payment status
    stripePaymentStatus.set(payment.id, {
      status: payment.status === 'succeeded' ? 'completed' : payment.status,
      transactionId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      receipt: payment.receipt_url,
      email: payment.customer_email,
      timestamp: new Date(payment.created * 1000).toISOString()
    });
    // TODO: Update your database with payment status
    console.log(`Stripe payment ${payment.id} status updated: ${payment.status}`);
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

export default router;
