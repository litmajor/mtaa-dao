import crypto from 'crypto';
import type { Request } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  paymentProviderAdapters,
  WebhookVerificationError,
} from '../services/paymentProviderAdapters';

function requestWithRawBody(rawBody: Buffer, headers: Record<string, string> = {}): Request {
  return {
    rawBody,
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe('payment provider webhook adapters', () => {
  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = 'test-paystack-secret';
    process.env.FLUTTERWAVE_SECRET_HASH = 'test-flutterwave-hash';
  });

  it('verifies Paystack against the exact raw body and normalizes a successful event', async () => {
    const rawBody = Buffer.from(
      '{"event":"charge.success","data":{"reference":"pay-ref-1","id":12345}}',
    );
    const signature = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex');
    const event = await paymentProviderAdapters.paystack.verifyWebhook(
      requestWithRawBody(rawBody, { 'x-paystack-signature': signature }),
    );

    expect(event).toEqual({
      provider: 'paystack',
      reference: 'pay-ref-1',
      providerReference: '12345',
      status: 'completed',
      providerData: { paystackEvent: 'charge.success', paystackId: 12345 },
    });
  });

  it('rejects invalid Paystack signatures before accepting callback data', async () => {
    const rawBody = Buffer.from('{"event":"charge.success","data":{"reference":"pay-ref-1"}}');

    await expect(paymentProviderAdapters.paystack.verifyWebhook(
      requestWithRawBody(rawBody, { 'x-paystack-signature': '00'.repeat(64) }),
    )).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  it('verifies Flutterwave shared-secret headers and normalizes provider transaction IDs', async () => {
    const rawBody = Buffer.from(
      '{"data":{"tx_ref":"flw-ref-1","id":6789,"status":"successful"}}',
    );
    const event = await paymentProviderAdapters.flutterwave.verifyWebhook(
      requestWithRawBody(rawBody, { 'verif-hash': process.env.FLUTTERWAVE_SECRET_HASH! }),
    );

    expect(event).toEqual({
      provider: 'flutterwave',
      reference: 'flw-ref-1',
      providerReference: '6789',
      status: 'completed',
      providerData: { flutterwaveStatus: 'successful', flutterwaveTransactionId: 6789 },
    });
  });

  it('rejects Flutterwave callbacks when the configured secret hash does not match', async () => {
    await expect(paymentProviderAdapters.flutterwave.verifyWebhook(
      requestWithRawBody(Buffer.from('{"data":{"tx_ref":"flw-ref-1"}}'), {
        'verif-hash': 'wrong-hash',
      }),
    )).rejects.toBeInstanceOf(WebhookVerificationError);
  });
});
