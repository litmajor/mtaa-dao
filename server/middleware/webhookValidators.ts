import crypto from 'crypto';
import Stripe from 'stripe';
import type { Request } from 'express';

export function validatePaystackSignature(req: Request): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return false;
  try {
    const payload = JSON.stringify(req.body || {});
    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
    const header = (req.headers['x-paystack-signature'] || '') as string;
    return hash === header;
  } catch (e) {
    return false;
  }
}

export function constructStripeEventFromRaw(req: Request, stripeSecret: string) {
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig) throw new Error('Missing stripe-signature header');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-08-27.basil' as any });
  // req.body must be a raw Buffer
  const raw = (req.body as Buffer) || Buffer.from('');
  return stripe.webhooks.constructEvent(raw, sig, stripeSecret);
}
