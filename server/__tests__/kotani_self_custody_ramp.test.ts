import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({ db: {} }));

import { KotaniSelfCustodyRampService } from '../services/kotaniSelfCustodyRampService';
import { normalizeKotaniLedgerWebhook } from '../routes/kotanipay-status';

describe('Kotani self-custody ramp webhook signatures', () => {
  it('accepts an HMAC-SHA256 signature over the raw payload', () => {
    const secret = 'test-webhook-secret';
    const body = Buffer.from('{"event":"transaction.onramp.status.updated","data":{}}');
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    expect(KotaniSelfCustodyRampService.verifyWebhookSignature(body, signature, secret)).toBe(true);
    expect(KotaniSelfCustodyRampService.verifyWebhookSignature(body, `sha256=${signature}`, secret)).toBe(true);
  });

  it('rejects missing, malformed, or incorrect signatures', () => {
    const secret = 'test-webhook-secret';
    const body = Buffer.from('{"event":"transaction.offramp.status.updated","data":{}}');

    expect(KotaniSelfCustodyRampService.verifyWebhookSignature(body, undefined, secret)).toBe(false);
    expect(KotaniSelfCustodyRampService.verifyWebhookSignature(body, 'sha256=bad', secret)).toBe(false);
    expect(KotaniSelfCustodyRampService.verifyWebhookSignature(body, '0'.repeat(64), secret)).toBe(false);
  });

  it('omits an embedded signature field from the signed payload', () => {
    const secret = 'test-webhook-secret';
    const rawBody = Buffer.from('{"event":"transaction.deposit.status.updated","data":{"status":"SUCCESSFUL"},"signature":"ignored"}');
    const signedBody = Buffer.from('{"event":"transaction.deposit.status.updated","data":{"status":"SUCCESSFUL"}}');
    const signature = createHmac('sha256', secret).update(signedBody).digest('hex');

    expect(KotaniSelfCustodyRampService.getWebhookSignedBody(rawBody)).toEqual(signedBody);
    expect(KotaniSelfCustodyRampService.verifyWebhookSignature(
      rawBody,
      signature,
      secret,
      KotaniSelfCustodyRampService.getWebhookSignedBody(rawBody),
    )).toBe(true);
  });
});

describe('Kotani ledger webhook payload normalization', () => {
  it('normalizes v3 envelope field names', () => {
    expect(normalizeKotaniLedgerWebhook({
      event: 'transaction.deposit.status.updated',
      data: {
        status: 'SUCCESSFUL',
        reference_id: 'DEP-123',
        telco_id: 'MPESA-123',
        conversation_id: 'CONV-123',
      },
    })).toMatchObject({
      referenceId: 'DEP-123',
      status: 'SUCCESSFUL',
      receipt: 'MPESA-123',
      conversationId: 'CONV-123',
    });
  });

  it('continues to accept the legacy flat callback shape', () => {
    expect(normalizeKotaniLedgerWebhook({
      transactionId: 'DEP-456',
      status: 'completed',
      mpesaReceipt: 'MPESA-456',
    })).toMatchObject({
      referenceId: 'DEP-456',
      status: 'COMPLETED',
      receipt: 'MPESA-456',
    });
  });

  it('rejects payloads without a reference or status', () => {
    expect(normalizeKotaniLedgerWebhook({ status: 'SUCCESSFUL' })).toBeUndefined();
    expect(normalizeKotaniLedgerWebhook({ transactionId: 'DEP-789' })).toBeUndefined();
  });
});
