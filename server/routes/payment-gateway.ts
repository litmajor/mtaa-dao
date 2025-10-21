
import express from 'express';
import { paymentGatewayService } from '../services/paymentGatewayService';
import { isAuthenticated } from '../auth';

const router = express.Router();

// POST /api/payment-gateway/deposit
router.post('/deposit', isAuthenticated, async (req, res) => {
  try {
    const { provider, amount, currency, method, metadata } = req.body;
    const userId = (req.user as any)?.claims?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await paymentGatewayService.initiateDeposit(provider, {
      userId,
      amount,
      currency,
      method,
      metadata,
      callbackUrl: `${process.env.APP_URL}/payment/callback`
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payment-gateway/withdraw
router.post('/withdraw', isAuthenticated, async (req, res) => {
  try {
    const { provider, amount, currency, method, metadata } = req.body;
    const userId = (req.user as any)?.claims?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await paymentGatewayService.initiateWithdrawal(provider, {
      userId,
      amount,
      currency,
      method,
      metadata
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payment-gateway/verify/:provider/:reference
router.get('/verify/:provider/:reference', isAuthenticated, async (req, res) => {
  try {
    const { provider, reference } = req.params;

    const result = await paymentGatewayService.verifyTransaction(provider, reference);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payment-gateway/flutterwave/webhook
router.post('/flutterwave/webhook', async (req, res) => {
  try {
    const signature = req.headers['verif-hash'];
    
    if (signature !== process.env.FLUTTERWAVE_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = req.body;
    
    // Process webhook
    console.log('Flutterwave webhook received:', payload);

    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payment-gateway/paystack/webhook
router.post('/paystack/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    
    // Verify webhook signature
    // Implementation depends on Paystack webhook documentation

    const payload = req.body;
    
    console.log('Paystack webhook received:', payload);

    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payment-gateway/mpesa/callback
router.post('/mpesa/callback', async (req, res) => {
  try {
    const payload = req.body;
    
    console.log('M-Pesa callback received:', payload);

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
