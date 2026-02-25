import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { paymentTransactions } from '../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

type Provider =
  | 'stripe'
  | 'paystack'
  | 'flutterwave'
  | 'coinbase'
  | 'transak'
  | 'ramp'
  | 'bank'
  | 'mpesa'
  | 'crypto'
  | 'minipay'
  | 'billing';

function requireUserId(req: Request, res: Response): string | null {
  const userId = (req as any).user?.id || req.body?.userId;
  if (!userId) {
    res.status(400).json({ success: false, message: 'userId is required' });
    return null;
  }
  return String(userId);
}

function makeReference(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function validateAmount(amount: any): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid amount');
  return n;
}

async function recordPendingPayment(args: {
  userId: string;
  reference: string;
  provider: Provider;
  amount: number;
  currency: string;
  type: string;
  metadata?: Record<string, any>;
}) {
  await db.insert(paymentTransactions).values({
    userId: args.userId,
    reference: args.reference,
    provider: args.provider,
    amount: String(args.amount),
    currency: args.currency,
    type: args.type,
    status: 'pending',
    metadata: args.metadata || {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
}

async function updatePaymentStatus(reference: string, status: 'pending' | 'processing' | 'completed' | 'failed', metadata?: Record<string, any>) {
  await db
    .update(paymentTransactions)
    .set({
      status,
      metadata: metadata || {},
      updatedAt: new Date(),
    } as any)
    .where(eq(paymentTransactions.reference, reference));
}

async function initializePaystack(amount: number, email: string, reference: string) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY not configured');

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: Math.round(amount * 100), email, reference }),
  });

  const payload = await response.json() as any;
  if (!response.ok || !payload?.status) {
    throw new Error(payload?.message || 'Paystack initialization failed');
  }

  return payload.data;
}

async function initializeFlutterwave(amount: number, email: string, reference: string, currency: string) {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');

  const response = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: reference,
      amount,
      currency,
      redirect_url: process.env.APP_BASE_URL || 'https://app.mtaa.com',
      customer: { email },
      customizations: { title: 'Mtaa DAO Payment' },
    }),
  });

  const payload = await response.json() as any;
  if (!response.ok || payload?.status !== 'success') {
    throw new Error(payload?.message || 'Flutterwave initialization failed');
  }

  return payload.data;
}

// Billing payments (generic provider selector)
router.post('/billing/initiate', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res); if (!userId) return;
    const { amount, daoId, description, billingType, provider = 'paystack', email } = req.body;
    const value = validateAmount(amount);
    if (!daoId || !billingType) {
      return res.status(400).json({ success: false, message: 'daoId and billingType are required' });
    }

    const reference = makeReference('BILL');
    await recordPendingPayment({
      userId,
      reference,
      provider: 'billing',
      amount: value,
      currency: 'KES',
      type: 'billing',
      metadata: { daoId, description, billingType, upstreamProvider: provider },
    });

    res.json({
      success: true,
      reference,
      status: 'pending',
      provider,
      message: 'Billing payment recorded and queued for provider execution',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Stripe
router.post('/stripe/initiate', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res); if (!userId) return;
    const { amount, daoId, description, currency = 'usd' } = req.body;
    const value = validateAmount(amount);
    if (!daoId) return res.status(400).json({ success: false, message: 'daoId is required' });

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return res.status(503).json({ success: false, message: 'Stripe not configured' });

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(key, { apiVersion: '2025-08-27.basil' as any });

    const reference = makeReference('STR');
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(value * 100),
      currency,
      metadata: { daoId, description: description || '', reference, userId },
    });

    await recordPendingPayment({
      userId,
      reference,
      provider: 'stripe',
      amount: value,
      currency: currency.toUpperCase(),
      type: 'contribution',
      metadata: { daoId, paymentIntentId: pi.id, clientSecret: pi.client_secret },
    });

    res.json({ success: true, reference, paymentIntentId: pi.id, clientSecret: pi.client_secret, status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/stripe/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    const object = event?.data?.object || {};
    const reference = object?.metadata?.reference;
    if (!reference) return res.status(400).json({ success: false, message: 'Missing reference in webhook metadata' });

    if (event.type === 'payment_intent.succeeded') {
      await updatePaymentStatus(reference, 'completed', { stripeId: object.id, eventType: event.type });
    } else if (event.type === 'payment_intent.payment_failed') {
      await updatePaymentStatus(reference, 'failed', { stripeId: object.id, eventType: event.type });
    } else {
      await updatePaymentStatus(reference, 'processing', { stripeId: object.id, eventType: event.type });
    }

    res.json({ received: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Paystack
router.post('/paystack/initiate', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res); if (!userId) return;
    const { amount, daoId, description, email } = req.body;
    const value = validateAmount(amount);
    if (!daoId || !email) return res.status(400).json({ success: false, message: 'daoId and email are required' });

    const reference = makeReference('PAY');
    const data = await initializePaystack(value, email, reference);

    await recordPendingPayment({
      userId,
      reference,
      provider: 'paystack',
      amount: value,
      currency: 'KES',
      type: 'contribution',
      metadata: { daoId, description, authorizationUrl: data.authorization_url },
    });

    res.json({ success: true, reference, paymentUrl: data.authorization_url, status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/paystack/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    const reference = event?.data?.reference;
    if (!reference) return res.status(400).json({ success: false, message: 'Missing transaction reference' });

    const status = event?.event === 'charge.success' ? 'completed' : 'failed';
    await updatePaymentStatus(reference, status, { paystackEvent: event?.event, payload: event?.data });
    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Flutterwave
router.post('/flutterwave/initiate', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res); if (!userId) return;
    const { amount, daoId, description, email, currency = 'KES' } = req.body;
    const value = validateAmount(amount);
    if (!daoId || !email) return res.status(400).json({ success: false, message: 'daoId and email are required' });

    const reference = makeReference('FLW');
    const data = await initializeFlutterwave(value, email, reference, currency);

    await recordPendingPayment({
      userId,
      reference,
      provider: 'flutterwave',
      amount: value,
      currency,
      type: 'contribution',
      metadata: { daoId, description, paymentLink: data.link },
    });

    res.json({ success: true, reference, paymentUrl: data.link, status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/flutterwave/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    const reference = event?.data?.tx_ref;
    if (!reference) return res.status(400).json({ success: false, message: 'Missing transaction reference' });

    const status = event?.data?.status === 'successful' ? 'completed' : 'failed';
    await updatePaymentStatus(reference, status, { flutterwaveStatus: event?.data?.status, payload: event?.data });
    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Coinbase/Transak/Ramp/Bank unified creation with persistent tracking
for (const provider of ['coinbase', 'transak', 'ramp', 'bank'] as const) {
  router.post(`/${provider}/initiate`, async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req, res); if (!userId) return;
      const { amount, daoId, description, currency = 'KES' } = req.body;
      const value = validateAmount(amount);
      if (!daoId) return res.status(400).json({ success: false, message: 'daoId is required' });

      const reference = makeReference(provider.toUpperCase());
      await recordPendingPayment({
        userId,
        reference,
        provider,
        amount: value,
        currency,
        type: 'contribution',
        metadata: { daoId, description },
      });

      res.json({
        success: true,
        reference,
        status: 'pending',
        message: `${provider} payment initialized`,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post(`/${provider}/webhook`, async (req: Request, res: Response) => {
    try {
      const reference = req.body?.reference || req.body?.data?.reference || req.body?.id;
      if (!reference) return res.status(400).json({ success: false, message: 'Missing reference' });

      const incomingStatus = String(req.body?.status || req.body?.data?.status || '').toLowerCase();
      const status = ['success', 'successful', 'completed', 'paid', 'confirmed'].includes(incomingStatus)
        ? 'completed'
        : incomingStatus
          ? 'failed'
          : 'processing';

      await updatePaymentStatus(reference, status as any, { provider, payload: req.body });
      res.json({ success: true, message: `${provider} webhook processed` });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
}

// MPesa
router.post('/mpesa/initiate', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res); if (!userId) return;
    const { phone, amount, daoId, accountReference, description } = req.body;
    const value = validateAmount(amount);
    if (!phone || !daoId) return res.status(400).json({ success: false, message: 'phone and daoId are required' });

    const reference = makeReference('MPESA');
    await recordPendingPayment({
      userId,
      reference,
      provider: 'mpesa',
      amount: value,
      currency: 'KES',
      type: 'contribution',
      metadata: { phone, daoId, accountReference, description },
    });

    res.json({ success: true, reference, status: 'pending', message: 'M-Pesa payment initialized' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/mpesa/webhook', async (req: Request, res: Response) => {
  try {
    const reference = req.body?.reference || req.body?.transactionId;
    if (!reference) return res.status(400).json({ success: false, message: 'Missing reference' });

    const status = String(req.body?.status || '').toLowerCase();
    const mapped = ['success', 'completed', 'confirmed'].includes(status) ? 'completed' : 'failed';
    await updatePaymentStatus(reference, mapped, { mpesaPayload: req.body });

    res.json({ success: true, message: 'M-Pesa webhook processed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Crypto
router.post('/crypto/initiate', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res); if (!userId) return;
    const { amount, currency, daoId, walletAddress } = req.body;
    const value = validateAmount(amount);
    if (!currency || !daoId || !walletAddress) {
      return res.status(400).json({ success: false, message: 'amount, currency, daoId and walletAddress are required' });
    }

    const reference = makeReference('CRYPTO');
    await recordPendingPayment({
      userId,
      reference,
      provider: 'crypto',
      amount: value,
      currency: String(currency).toUpperCase(),
      type: 'contribution',
      metadata: { daoId, walletAddress },
    });

    res.json({ success: true, paymentReference: reference, status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/crypto/webhook', async (req: Request, res: Response) => {
  try {
    const { paymentReference, txHash, status } = req.body;
    if (!paymentReference || !txHash) {
      return res.status(400).json({ success: false, message: 'paymentReference and txHash are required' });
    }

    const mapped = ['confirmed', 'success', 'completed'].includes(String(status).toLowerCase())
      ? 'completed'
      : 'failed';

    await updatePaymentStatus(paymentReference, mapped as any, { txHash, payload: req.body });
    res.json({ success: true, message: 'Crypto webhook processed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// MiniPay
router.post('/minipay/initiate', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res); if (!userId) return;
    const { amount, currency, daoId, description, recipientAddress } = req.body;
    const value = validateAmount(amount);
    if (!currency || !daoId) {
      return res.status(400).json({ success: false, message: 'amount, currency and daoId are required' });
    }

    const paymentReference = makeReference('MINIPAY');
    await recordPendingPayment({
      userId,
      reference: paymentReference,
      provider: 'minipay',
      amount: value,
      currency: String(currency).toUpperCase(),
      type: 'contribution',
      metadata: { daoId, description, recipientAddress },
    });

    res.json({
      success: true,
      paymentReference,
      status: 'pending',
      supportedCurrencies: ['cUSD', 'CELO'],
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/minipay/confirm', async (req: Request, res: Response) => {
  try {
    const { paymentReference, txHash } = req.body;
    if (!paymentReference || !txHash) {
      return res.status(400).json({ success: false, message: 'paymentReference and txHash are required' });
    }

    await updatePaymentStatus(paymentReference, 'completed', { txHash, payload: req.body });
    res.json({ success: true, message: 'MiniPay payment confirmed', paymentReference, txHash, status: 'confirmed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/minipay/status/:paymentReference', async (req: Request, res: Response) => {
  try {
    const { paymentReference } = req.params;
    const record = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.reference, paymentReference))
      .then(rows => rows[0]);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.json({ success: true, payment: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
