import { randomBytes, timingSafeEqual } from 'crypto';
import express from 'express';
import type { Request, Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../../db';
import { paymentTransactions, users } from '@shared/schema';
import { authenticate } from '../../../../auth';
import { rateLimitPerUser } from '../../../../middleware/rateLimit';
import { registerMpesaC2bCallbackUrls } from '../../../../services/mpesaC2bService';
import { reconcileMpesaC2bCallback } from '../../../../payments';

const router = express.Router();

function normalizeKenyanPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s()+-]/g, '');
  if (/^254[17]\d{8}$/.test(cleaned)) return cleaned;
  if (/^0[17]\d{8}$/.test(cleaned)) return `254${cleaned.slice(1)}`;
  if (/^[17]\d{8}$/.test(cleaned)) return `254${cleaned}`;
  return null;
}

function callbackTokenMatches(suppliedToken: unknown): boolean {
  const configuredToken = process.env.MPESA_C2B_CALLBACK_TOKEN?.trim();
  if (!configuredToken || typeof suppliedToken !== 'string' || !suppliedToken) return false;
  const expected = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function callbackResult(accepted: boolean, description: string) {
  return { ResultCode: accepted ? 0 : 1, ResultDesc: description };
}

async function validateC2bPayment(payload: Record<string, unknown>): Promise<boolean> {
  const reference = payload.BillRefNumber;
  const amount = Number(payload.TransAmount);
  const phone = normalizeKenyanPhone(String(payload.MSISDN ?? ''));
  if (typeof reference !== 'string' || !reference || !Number.isSafeInteger(amount) || amount <= 0 || !phone) {
    return false;
  }

  const [payment] = await db
    .select({
      amount: paymentTransactions.amount,
      status: paymentTransactions.status,
      phone: sql<string>`${paymentTransactions.metadata}->>'phone'`,
      purpose: sql<string>`${paymentTransactions.metadata}->>'purpose'`,
    })
    .from(paymentTransactions)
    .where(and(
      eq(paymentTransactions.reference, reference),
      eq(paymentTransactions.provider, 'mpesa'),
      eq(paymentTransactions.type, 'deposit'),
    ))
    .limit(1);

  return Boolean(
    payment &&
      payment.status === 'pending' &&
      payment.purpose === 'mpesa_c2b' &&
      Number(payment.amount) === amount &&
      normalizeKenyanPhone(payment.phone) === phone
  );
}

router.post('/request', authenticate, rateLimitPerUser('mpesa-c2b-request', 5, '10min'), async (req: Request, res: Response) => {
  if (process.env.MPESA_C2B_ENABLED !== 'true') {
    return res.status(503).json({ code: 'MPESA_C2B_DISABLED', message: 'M-Pesa C2B collections are disabled' });
  }

  const userId = (req as any).user?.id as string | undefined;
  const amount = Number(req.body?.amount);
  if (!userId) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 150_000) {
    return res.status(400).json({
      code: 'INVALID_AMOUNT',
      message: 'M-Pesa C2B amount must be a whole KES amount between 1 and 150,000',
    });
  }

  try {
    const [user] = await db
      .select({ phone: users.phone, phoneVerified: users.phoneVerified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const phone = normalizeKenyanPhone(user?.phone);
    if (!phone || !user?.phoneVerified) {
      return res.status(409).json({
        code: 'VERIFIED_PHONE_REQUIRED',
        message: 'A valid Kenyan phone number must be verified before creating a PayBill request',
      });
    }

    let reference = '';
    let created = false;
    for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
      reference = `M${randomBytes(8).toString('hex').slice(0, 11).toUpperCase()}`;
      try {
        await db.insert(paymentTransactions).values({
          userId,
          reference,
          type: 'deposit',
          amount: String(amount),
          currency: 'KES',
          provider: 'mpesa',
          status: 'pending',
          metadata: {
            purpose: 'mpesa_c2b',
            phone,
            createdAt: new Date().toISOString(),
          },
        });
        created = true;
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== '23505' || attempt === 2) throw error;
      }
    }

    if (!created) throw new Error('Unable to allocate a unique M-Pesa payment reference');
    const shortcode =
      process.env.MPESA_C2B_SHORTCODE?.trim() ||
      process.env.MPESA_BUSINESS_SHORTCODE?.trim() ||
      process.env.MPESA_SHORTCODE?.trim();
    if (!shortcode) {
      await db.delete(paymentTransactions).where(eq(paymentTransactions.reference, reference));
      return res.status(503).json({ code: 'MPESA_SHORTCODE_MISSING', message: 'M-Pesa PayBill shortcode is not configured' });
    }

    return res.status(201).json({
      success: true,
      payment: {
        reference,
        amount,
        currency: 'KES',
        provider: 'mpesa',
        method: 'paybill',
        shortcode,
        status: 'pending',
      },
      instructions: 'Pay the exact KES amount to the M-Pesa PayBill and enter this unique reference as the account number.',
    });
  } catch (error) {
    console.error('M-Pesa C2B payment request failed:', error);
    return res.status(500).json({ code: 'PAYMENT_REQUEST_FAILED', message: 'Failed to create M-Pesa PayBill request' });
  }
});

router.post('/register', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });

  try {
    const [user] = await db
      .select({ roles: users.roles, isSuperUser: users.isSuperUser })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const roles = String(user?.roles || '').split(',').map((role) => role.trim().toLowerCase());
    if (!user || (!user.isSuperUser && !roles.some((role) => ['admin', 'super_admin'].includes(role)))) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Administrator access is required' });
    }
    const message = await registerMpesaC2bCallbackUrls();
    return res.json({ success: true, message });
  } catch (error) {
    console.error('M-Pesa C2B callback registration failed:', error);
    return res.status(502).json({
      code: 'CALLBACK_REGISTRATION_FAILED',
      message: error instanceof Error ? error.message : 'Failed to register M-Pesa callbacks',
    });
  }
});

router.post('/validation', async (req: Request, res: Response) => {
  if (!callbackTokenMatches(req.query.token)) {
    return res.status(401).json(callbackResult(false, 'Unauthorized callback'));
  }
  try {
    const accepted = await validateC2bPayment(req.body || {});
    return res.json(callbackResult(accepted, accepted ? 'Accepted' : 'Payment reference or details are invalid'));
  } catch (error) {
    console.error('M-Pesa C2B validation callback failed:', error);
    return res.status(500).json(callbackResult(false, 'Validation unavailable'));
  }
});

router.post('/confirmation', async (req: Request, res: Response) => {
  if (!callbackTokenMatches(req.query.token)) {
    return res.status(401).json(callbackResult(false, 'Unauthorized callback'));
  }
  try {
    const result = await reconcileMpesaC2bCallback(req.body || {});
    return res.json(callbackResult(true, result.alreadyProcessed ? 'Already processed' : 'Accepted'));
  } catch (error) {
    console.error('M-Pesa C2B confirmation callback failed:', error);
    return res.status(500).json(callbackResult(false, 'Confirmation unavailable'));
  }
});

export default router;
