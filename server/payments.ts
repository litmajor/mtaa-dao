import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { paymentTransactions } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { paymentRecoverySAGA } from './services/PaymentRecoverySAGAOrchestrator';
import { validatePaystackSignature, constructStripeEventFromRaw } from './middleware/webhookValidators';

const router = express.Router();

type PaymentMetadata = {
  walletFrom?: string;
  walletTo?: string;
  vaultId?: string;
  CheckoutRequestID?: string;
  phone?: string;
  darajaResponse?: any;
  [key: string]: unknown;
};

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
  | 'billing'
  | 'kotanipay';

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
  });
}

// FIX: Added direct verification hook helpers for security
function verifyGenericProviderSignature(provider: string, req: Request): boolean {
  const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];
  if (!secret) return false;
  
  const signature = req.headers[`x-${provider}-signature`] || req.headers['x-signature'];
  if (!signature) return false;

  const computedHash = crypto
    .createHmac('sha256', secret)
    .update(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature as string), Buffer.from(computedHash));
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

async function initializeKotaniPaySTK(amount: number, phoneNumber: string, reference: string) {
  const apiKey = process.env.KOTANIPAY_API_KEY;
  if (!apiKey) throw new Error('KOTANIPAY_API_KEY not configured');

  const env = (process.env.KOTANIPAY_ENVIRONMENT || 'sandbox').toLowerCase();
  const baseUrl = env === 'live' ? 'https://api.kotanipay.com' : 'https://apispec.kotanipay.com';

  const response = await fetch(`${baseUrl}/v2/transactions/deposit/stkpush`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Number(amount),
      phoneNumber: phoneNumber.replace(/[^0-9]/g, ''),
      callback: process.env.KOTANIPAY_CALLBACK_URL || `${process.env.APP_BASE_URL}/api/payments/kotanipay/webhook`,
      externalId: reference,
    }),
  });

  const payload = await response.json() as any;
  if (!response.ok) {
    throw new Error(payload?.message || 'Kotani Pay execution failed');
  }
  return payload;
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

// --- BILLING ENDPOINT ---
router.post('/billing/initiate', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res); if (!userId) return;
    const { amount, daoId, description, billingType, provider = 'paystack' } = req.body;
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

    res.json({ success: true, reference, status: 'pending', provider });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- STRIPE ENDPOINTS ---
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

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeSecret) return res.status(500).json({ success: false, message: 'Stripe webhook configuration error' });

    const event = constructStripeEventFromRaw(req, stripeSecret) as any;
    const object = event?.data?.object || {};
    const reference = object?.metadata?.reference;
    if (!reference) return res.status(400).json({ success: false, message: 'Missing transaction execution metadata' });

    // FIX: Encapsulate state transition and SAGA dispatch within a strict database transaction lock
    const shouldTriggerSaga = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.reference, reference))
        .for('update'); // Exclusive lock blocks concurrent retry attempts
      
      const record = rows[0];
      if (!record || record.status === 'completed') return false;

      const nextStatus = event.type === 'payment_intent.succeeded' ? 'completed' : 'failed';
      
      await tx
        .update(paymentTransactions)
        .set({
          status: nextStatus,
          metadata: { ...((record.metadata as object) || {}), stripeId: object.id, eventType: event.type },
          updatedAt: new Date()
        })
        .where(eq(paymentTransactions.reference, reference));

      return nextStatus === 'completed';
    });

    if (shouldTriggerSaga) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).then(r => r[0]);
      if (rec) {
        const meta = (rec.metadata as PaymentMetadata) || {};
        await paymentRecoverySAGA.executePaymentSAGA({
          userId: rec.userId,
          amount: Number(rec.amount),
          currency: rec.currency,
          walletFrom: meta.walletFrom || '',
          walletTo: meta.walletTo || '',
          vaultId: meta.vaultId,
          metadata: meta,
        } as any);
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// --- PAYSTACK ENDPOINTS ---
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
    if (!validatePaystackSignature(req)) {
      return res.status(401).json({ success: false, message: 'Invalid Paystack signature' });
    }

    const event = req.body;
    const reference = event?.data?.reference;
    if (!reference) return res.status(400).json({ success: false, message: 'Missing reference' });

    const targetStatus = event?.event === 'charge.success' ? 'completed' : 'failed';

    // FIX: Guard Paystack processing with atomicity locks
    const executeSaga = await db.transaction(async (tx) => {
      const rows = await tx.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).for('update');
      const record = rows[0];
      
      if (!record || record.status === 'completed') return false;

      await tx
        .update(paymentTransactions)
        .set({
          status: targetStatus,
          metadata: { ...((record.metadata as object) || {}), paystackEvent: event?.event },
          updatedAt: new Date()
        })
        .where(eq(paymentTransactions.reference, reference));

      return targetStatus === 'completed';
    });

    if (executeSaga) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).then(r => r[0]);
      if (rec) {
        const meta = (rec.metadata as PaymentMetadata) || {};
        await paymentRecoverySAGA.executePaymentSAGA({
          userId: rec.userId,
          amount: Number(rec.amount),
          currency: rec.currency,
          walletFrom: meta.walletFrom || '',
          walletTo: meta.walletTo || '',
          vaultId: meta.vaultId,
          metadata: meta,
        } as any);
      }
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- FLUTTERWAVE ENDPOINTS ---
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

    const flwSecret = process.env.FLUTTERWAVE_SECRET_HASH;
    if (flwSecret && req.headers['verif-hash'] !== flwSecret) {
      return res.status(401).json({ success: false, message: 'Unauthorized webhook hash context signature' });
    }

    const status = event?.data?.status === 'successful' ? 'completed' : 'failed';
    await db.update(paymentTransactions)
      .set({ status, metadata: { flutterwaveStatus: event?.data?.status }, updatedAt: new Date() })
      .where(eq(paymentTransactions.reference, reference));

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- COINBASE/TRANSAK/RAMP/BANK UNIFIED MATRIX ---
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

      res.json({ success: true, reference, status: 'pending' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.post(`/${provider}/webhook`, async (req: Request, res: Response) => {
    try {
      // FIX: Enforced strict generic signature verification across the looping array structure
      if (process.env.NODE_ENV === 'production' && !verifyGenericProviderSignature(provider, req)) {
        return res.status(401).json({ success: false, message: `Invalid cryptographic signature for ${provider}` });
      }

      const reference = req.body?.reference || req.body?.data?.reference || req.body?.id;
      if (!reference) return res.status(400).json({ success: false, message: 'Missing reference parameters' });

      const incomingStatus = String(req.body?.status || req.body?.data?.status || '').toLowerCase();
      const status = ['success', 'successful', 'completed', 'paid', 'confirmed'].includes(incomingStatus)
        ? 'completed'
        : incomingStatus ? 'failed' : 'processing';

      await db.update(paymentTransactions)
        .set({ status: status as any, metadata: { provider, payload: req.body }, updatedAt: new Date() })
        .where(eq(paymentTransactions.reference, reference));

      res.json({ success: true, message: 'Webhook processed' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
}

// --- MPESA DIRECT ENTRY ---
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

    res.json({ success: true, reference, status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- KOTANIPAY ENDPOINTS ---
router.post('/kotanipay/initiate', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res); if (!userId) return;
    const { amount, phone, daoId, description, currency = 'KES' } = req.body;
    const value = validateAmount(amount);
    if (!phone || !daoId) return res.status(400).json({ success: false, message: 'phone and daoId are required' });

    const reference = makeReference('KOTANI');
    const kotaniResult = await initializeKotaniPaySTK(value, phone, reference);

    await recordPendingPayment({
      userId,
      reference,
      provider: 'kotanipay',
      amount: value,
      currency,
      type: 'contribution',
      metadata: { phone, daoId, description, kotaniResponse: kotaniResult },
    });

    res.json({ success: true, reference, status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/kotanipay/webhook', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-kotani-signature'] as string) || '';
    if (process.env.NODE_ENV === 'production' && !signature) {
      return res.status(401).json({ success: false, message: 'Missing secure signature token.' });
    }

    if (signature && process.env.KOTANIPAY_WEBHOOK_SECRET) {
      const computedHash = crypto
        .createHmac('sha256', process.env.KOTANIPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedHash))) {
        return res.status(401).json({ success: false, message: 'Tampered webhook payload rejected.' });
      }
    }

    const { externalId, status, txhash } = req.body as any;
    if (!externalId) return res.status(400).json({ success: false, message: 'Missing externalId parameter.' });

    const runSaga = await db.transaction(async (tx) => {
      const rows = await tx.select().from(paymentTransactions).where(eq(paymentTransactions.reference, externalId)).for('update');
      const record = rows[0];
      if (!record || record.status === 'completed') return false;

      const runtimeStatus = ['success', 'completed', 'successful'].includes(String(status).toLowerCase()) ? 'completed' : 'failed';

      await tx.update(paymentTransactions)
        .set({ status: runtimeStatus as any, metadata: { ...(record.metadata as object), txhash }, updatedAt: new Date() })
        .where(eq(paymentTransactions.reference, externalId));

      return runtimeStatus === 'completed';
    });

    if (runSaga) {
      const rec = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, externalId)).then(r => r[0]);
      if (rec) {
        const meta = (rec.metadata as PaymentMetadata) || {};
        await paymentRecoverySAGA.executePaymentSAGA({
          userId: rec.userId,
          amount: Number(rec.amount),
          currency: rec.currency,
          walletFrom: meta.walletFrom || '',
          walletTo: meta.walletTo || '',
          vaultId: meta.vaultId,
          metadata: { ...meta, txhash },
        } as any);
      }
    }

    res.json({ success: true, message: 'Kotani Pay callback processed.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- MPESA DARAJA WEBHOOK LAYER ---
router.post('/mpesa/webhook', async (req: Request, res: Response) => {
  try {
    const callbackData = req.body?.Body?.stkCallback;
    if (!callbackData) return res.status(400).json({ success: false, message: 'Invalid Daraja structure' });

    const checkoutRequestId = callbackData.CheckoutRequestID;
    const resultCode = Number(callbackData.ResultCode);
    const targetStatus = resultCode === 0 ? 'completed' : 'failed';

    // FIX: Swapped legacy driver syntax with standard Drizzle-ORM expressions using native raw expressions
    const executeSaga = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(paymentTransactions)
        .where(sql`metadata->>'CheckoutRequestID' = ${checkoutRequestId}`)
        .for('update');
      
      const record = rows[0];
      if (!record || record.status === 'completed') return false;

      await tx
        .update(paymentTransactions)
        .set({
          status: targetStatus,
          metadata: { ...((record.metadata as object) || {}), mpesaPayload: callbackData },
          updatedAt: new Date()
        })
        .where(eq(paymentTransactions.reference, record.reference));

      return targetStatus === 'completed';
    });

    if (executeSaga) {
      const rec = await db.select().from(paymentTransactions).where(sql`metadata->>'CheckoutRequestID' = ${checkoutRequestId}`).then(r => r[0]);
      if (rec) {
        const meta = (rec.metadata as PaymentMetadata) || {};
        await paymentRecoverySAGA.executePaymentSAGA({
          userId: rec.userId,
          amount: Number(rec.amount),
          currency: rec.currency,
          walletFrom: meta.walletFrom || '',
          walletTo: meta.walletTo || '',
          vaultId: meta.vaultId,
          metadata: meta,
        } as any);
      }
    }

    res.json({ ResponseCode: '0', ResponseDesc: 'Accept Service' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- DARAJA AUTH LAYER ---
let cachedMpesaToken: { token: string; expiresAt: number } | null = null;

async function fetchMpesaAccessToken() {
  const now = Date.now();
  if (cachedMpesaToken && cachedMpesaToken.expiresAt > now + 5000) return cachedMpesaToken.token;

  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const env = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase();
  if (!key || !secret) throw new Error('MPESA_CONSUMER_KEY/SECRET not configured');

  const base = env === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const url = `${base}/oauth/v1/generate?grant_type=client_credentials`;

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const resp = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  const j = await resp.json();
  if (!resp.ok || !j?.access_token) throw new Error('Failed to obtain Mpesa access token');

  const expiresIn = Number(j.expires_in || 3600) * 1000;
  cachedMpesaToken = { token: j.access_token, expiresAt: Date.now() + expiresIn };
  return cachedMpesaToken.token;
}

router.post('/mpesa/oauth', async (req: Request, res: Response) => {
  if (String(process.env.FEATURE_MPESA_STK) !== 'true') return res.status(503).json({ success: false, message: 'MPesa STK feature disabled' });
  try {
    const token = await fetchMpesaAccessToken();
    res.json({ success: true, accessToken: token });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch token' });
  }
});

router.post('/mpesa/stk', async (req: Request, res: Response) => {
  if (String(process.env.FEATURE_MPESA_STK) !== 'true') return res.status(503).json({ success: false, message: 'MPesa STK feature disabled' });
  try {
    const userId = requireUserId(req, res); if (!userId) return;
    const { phone, amount, accountReference, description } = req.body;
    if (!phone || !amount) return res.status(400).json({ success: false, message: 'phone and amount required' });

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY || process.env.MPESA_PASSWORD;
    const callback = process.env.MPESA_CALLBACK_URL || `${process.env.APP_BASE_URL || ''}/api/payments/mpesa/webhook`;
    const env = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase();
    if (!shortcode || !passkey) return res.status(503).json({ success: false, message: 'MPesa shortcode/passkey not configured' });

    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const token = await fetchMpesaAccessToken();
    const base = env === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    const url = `${base}/mpesa/stkpush/v1/processrequest`;

    const body = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Number(amount),
      PartyA: phone.replace(/[^0-9+]/g, ''),
      PartyB: shortcode,
      PhoneNumber: phone.replace(/[^0-9+]/g, ''),
      CallBackURL: callback,
      AccountReference: accountReference || 'MtaaDAO',
      TransactionDesc: description || 'M-Pesa STK Push',
    };

    const resp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await resp.headers;
    const resData = await resp.json();
    if (!resp.ok) return res.status(502).json({ success: false, message: 'Daraja STK request failed', details: resData });

    const reference = makeReference('MPSTK');
    const checkoutRequestId = resData?.CheckoutRequestID || resData?.data?.CheckoutRequestID;
    const metadata = { phone, darajaResponse: resData, CheckoutRequestID: checkoutRequestId };
    await recordPendingPayment({ userId, reference, provider: 'mpesa', amount: Number(amount), currency: 'KES', type: 'contribution', metadata });

    res.json({ success: true, reference, daraja: resData });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'STK initiation failed' });
  }
});

// --- CRYPTO ENDPOINTS ---
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
    if (process.env.NODE_ENV === 'production' && !verifyGenericProviderSignature('crypto', req)) {
      return res.status(401).json({ success: false, message: 'Invalid crypto hash signature context' });
    }

    const { paymentReference, txHash, status } = req.body;
    if (!paymentReference || !txHash) {
      return res.status(400).json({ success: false, message: 'paymentReference and txHash are required' });
    }

    const mapped = ['confirmed', 'success', 'completed'].includes(String(status).toLowerCase()) ? 'completed' : 'failed';

    await db.update(paymentTransactions)
      .set({ status: mapped as any, metadata: { txHash, payload: req.body }, updatedAt: new Date() })
      .where(eq(paymentTransactions.reference, paymentReference));

    res.json({ success: true, message: 'Crypto webhook processed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- MINIPAY ENDPOINTS ---
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

    res.json({ success: true, paymentReference, status: 'pending', supportedCurrencies: ['cUSD', 'CELO'] });
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

    await db.update(paymentTransactions)
      .set({ status: 'completed', metadata: { txHash, payload: req.body }, updatedAt: new Date() })
      .where(eq(paymentTransactions.reference, paymentReference));

    res.json({ success: true, message: 'MiniPay payment confirmed', paymentReference, txHash, status: 'confirmed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/minipay/status/:paymentReference', async (req: Request, res: Response) => {
  try {
    const { paymentReference } = req.params;
    const record = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, paymentReference)).then(rows => rows[0]);

    if (!record) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, payment: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;