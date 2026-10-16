import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  db: {
    transaction: vi.fn(),
  },
}));

import { db } from '../db';
import { reconcileMpesaCallback } from '../payments';

function createTransaction(payment: Record<string, unknown>, contribution: Record<string, unknown>) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const selections = [payment, contribution];
  let selectionIndex = 0;

  const tx = {
    select: vi.fn(() => {
      const query: any = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        for: vi.fn(() => query),
        limit: vi.fn(() => Promise.resolve([selections[selectionIndex++]])),
      };
      return query;
    }),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          updates.push({ table, values });
        }),
      })),
    })),
  };

  return { tx, updates };
}

describe('reconcileMpesaCallback DAO contributions', () => {
  beforeEach(() => vi.clearAllMocks());

  const payment = {
    id: 'payment-1',
    userId: 'member-1',
    amount: '1200',
    currency: 'KES',
    reference: 'MPE-123',
    status: 'pending',
    metadata: {
      purpose: 'dao_contribution',
      daoId: 'dao-1',
      contributionId: 'contribution-1',
      phone: '254712345678',
      checkoutRequestID: 'checkout-1',
      callbackToken: 'trusted-callback-token',
    },
  };

  const contribution = {
    id: 'contribution-1',
    daoId: 'dao-1',
    contributorId: 'member-1',
    amount: '1200',
    status: 'pending',
    metadata: { method: 'M-Pesa', paymentStatus: 'awaiting_callback' },
  };

  it('credits a confirmed payment to the pending DAO contribution ledger', async () => {
    const { tx, updates } = createTransaction(payment, contribution);
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

    const result = await reconcileMpesaCallback({
      CheckoutRequestID: 'checkout-1',
      ResultCode: 0,
      ResultDesc: 'Success',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 1200 },
          { Name: 'MpesaReceiptNumber', Value: 'QWE123ABC' },
          { Name: 'PhoneNumber', Value: 254712345678 },
        ],
      },
    }, 'trusted-callback-token');

    expect(result).toMatchObject({
      reference: 'MPE-123',
      status: 'completed',
      contributionCredited: true,
    });
    expect(updates).toHaveLength(2);
    expect(updates[0].values.status).toBe('completed');
    expect(updates[1].values).toMatchObject({
      status: 'pending',
      metadata: {
        paymentStatus: 'confirmed',
        mpesaReceipt: 'QWE123ABC',
      },
    });
  });

  it('rejects a callback with an amount that does not match the contribution', async () => {
    const { tx, updates } = createTransaction(payment, contribution);
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

    await expect(reconcileMpesaCallback({
      CheckoutRequestID: 'checkout-1',
      ResultCode: 0,
      CallbackMetadata: { Item: [{ Name: 'Amount', Value: 100 }] },
    }, 'trusted-callback-token')).rejects.toThrow('M-Pesa amount mismatch');
    expect(updates).toHaveLength(0);
  });

  it('does not credit callbacks without the per-payment callback token', async () => {
    const { tx, updates } = createTransaction(payment, contribution);
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

    await expect(reconcileMpesaCallback({
      CheckoutRequestID: 'checkout-1',
      ResultCode: 0,
      CallbackMetadata: { Item: [{ Name: 'Amount', Value: 1200 }] },
    })).rejects.toThrow('Invalid callback authorization token');
    expect(updates).toHaveLength(0);
  });
});
