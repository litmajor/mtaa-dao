import crypto from 'crypto';
import type { Request } from 'express';

export type SettledProvider = 'paystack' | 'flutterwave';
export type ProviderEventStatus = 'completed' | 'failed' | 'pending';

export interface VerifiedPaymentEvent {
  provider: SettledProvider;
  reference: string;
  providerReference?: string;
  status: ProviderEventStatus;
  providerData: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  verifyWebhook(request: Request): Promise<VerifiedPaymentEvent>;
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

function getRawBody(request: Request): Buffer {
  const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
  if (!Buffer.isBuffer(rawBody)) {
    throw new Error('Webhook raw request body is unavailable');
  }
  return rawBody;
}

function parseJson(rawBody: Buffer): Record<string, any> {
  const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Webhook payload must be a JSON object');
  }
  return parsed as Record<string, any>;
}

function constantTimeHexMatch(actual: string, expected: string): boolean {
  if (!/^[\da-f]+$/i.test(actual) || !/^[\da-f]+$/i.test(expected)) return false;
  const actualBytes = Buffer.from(actual, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  return actualBytes.length === expectedBytes.length &&
    crypto.timingSafeEqual(actualBytes, expectedBytes);
}

class PaystackAdapter implements PaymentProviderAdapter {
  async verifyWebhook(request: Request): Promise<VerifiedPaymentEvent> {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = request.get('x-paystack-signature') || '';
    if (!secret) throw new Error('Paystack webhook secret is not configured');

    const rawBody = getRawBody(request);
    const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    if (!constantTimeHexMatch(signature, expected)) {
      throw new WebhookVerificationError('Invalid Paystack webhook signature');
    }

    const event = parseJson(rawBody);
    const data = event.data;
    if (!data || typeof data.reference !== 'string' || !data.reference.trim()) {
      throw new Error('Paystack webhook is missing a payment reference');
    }
    const status: ProviderEventStatus =
      event.event === 'charge.success' ? 'completed' :
      event.event === 'charge.failed' ? 'failed' : 'pending';
    return {
      provider: 'paystack',
      reference: data.reference,
      providerReference: data.id === undefined || data.id === null ? undefined : String(data.id),
      status,
      providerData: { paystackEvent: event.event, paystackId: data.id },
    };
  }
}

class FlutterwaveAdapter implements PaymentProviderAdapter {
  async verifyWebhook(request: Request): Promise<VerifiedPaymentEvent> {
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
    const signature = request.get('verif-hash') || '';
    if (!secretHash) throw new Error('Flutterwave webhook secret hash is not configured');
    const signatureBytes = Buffer.from(signature);
    const secretBytes = Buffer.from(secretHash);
    if (!signature || signatureBytes.length !== secretBytes.length ||
        !crypto.timingSafeEqual(signatureBytes, secretBytes)) {
      throw new WebhookVerificationError('Invalid Flutterwave webhook signature');
    }

    const event = parseJson(getRawBody(request));
    const data = event.data;
    if (!data || typeof data.tx_ref !== 'string' || !data.tx_ref.trim()) {
      throw new Error('Flutterwave webhook is missing a payment reference');
    }
    const status: ProviderEventStatus =
      data.status === 'successful' ? 'completed' :
      data.status === 'failed' ? 'failed' : 'pending';
    return {
      provider: 'flutterwave',
      reference: data.tx_ref,
      providerReference: data.id === undefined || data.id === null ? undefined : String(data.id),
      status,
      providerData: { flutterwaveStatus: data.status, flutterwaveTransactionId: data.id },
    };
  }
}

export const paymentProviderAdapters: Record<SettledProvider, PaymentProviderAdapter> = {
  paystack: new PaystackAdapter(),
  flutterwave: new FlutterwaveAdapter(),
};
