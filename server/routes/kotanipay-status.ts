
import express from 'express';
import { z } from 'zod';
const router = express.Router();

// In-memory store for KotaniPay payment status (replace with your database)
const kotaniPaymentStatus = new Map<string, any>();

// Validation schema for KotaniPay webhook
const kotaniWebhookSchema = z.object({
  transactionId: z.string(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']),
  amount: z.number(),
  currency: z.string(),
  phone: z.string(),
  reference: z.string().optional(),
  timestamp: z.string().optional()
});

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

    res.json(status);
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
    
    // Update payment status
    kotaniPaymentStatus.set(webhook.transactionId, {
      status: webhook.status,
      transactionId: webhook.transactionId,
      amount: webhook.amount,
      currency: webhook.currency,
      phone: webhook.phone,
      reference: webhook.reference,
      timestamp: webhook.timestamp || new Date().toISOString()
    });

    // TODO: Update your database with payment status
    // TODO: If payment successful, update DAO premium status if it's a billing payment
    
    console.log(`KotaniPay payment ${webhook.transactionId} status updated: ${webhook.status}`);

    res.json({ success: true });
  } catch (error: any) {
    console.error('KotaniPay callback error:', error);
    res.status(400).json({
      code: 'INVALID_CALLBACK',
      message: 'Invalid callback data',
      details: error.message
    });
  }
});

export default router;
