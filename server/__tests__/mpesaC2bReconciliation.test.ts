import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock('../services/sharedIdempotencyManager', () => ({
  sharedIdempotencyManager: {
    startProcessing: vi.fn().mockResolvedValue(true),
    recordResult: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/PaymentRecoverySAGAOrchestrator', () => ({
  paymentRecoverySAGA: {
    executePaymentSAGA: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from '../db';
import { paymentRecoverySAGA } from '../services/PaymentRecoverySAGAOrchestrator';
import { reconcileMpesaC2bCallback } from '../payments';

describe('reconcileMpesaC2bCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MPESA_AUTO_SETTLEMENT_ENABLED;
    process.env.MPESA_C2B_SHORTCODE = '600000';
  });

  it('completes the matching payment into the pending-review queue by default', async () => {
    const payment = {
      id: 'payment-1',
      userId: 'member-1',
      reference: 'M123456789AB',
      type: 'deposit',
      provider: 'mpesa',
      amount: '1200',
      currency: 'KES',
      status: 'pending',
      metadata: { purpose: 'mpesa_c2b', phone: '254712345678' },
    };
    const updates: Array<Record<string, unknown>> = [];
    let transactionSelectCount = 0;
    const transactionQuery: any = {
      from: vi.fn(() => transactionQuery),
      where: vi.fn(() => transactionQuery),
      for: vi.fn(() => transactionQuery),
      limit: vi.fn(async () => {
        const index = transactionSelectCount++;
        if (index === 0) return [payment];
        if (index === 1) return [{
          id: 'member-1',
          phone: '254712345678',
          phoneVerified: true,
        }];
        return [];
      }),
    };
    const tx = {
      select: vi.fn(() => transactionQuery),
      update: vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            updates.push(values);
            payment.status = String(values.status);
            payment.metadata = values.metadata as Record<string, unknown>;
          }),
        })),
      })),
    };
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

    vi.mocked(db.select).mockImplementation(() => {
      const query: any = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        limit: vi.fn(async () => [{ id: 'wallet-1' }]),
      };
      return query;
    });

    const result = await reconcileMpesaC2bCallback({
      BillRefNumber: payment.reference,
      TransID: 'QWE123ABC',
      TransAmount: '1200',
      MSISDN: '254712345678',
      BusinessShortCode: '600000',
    });

    expect(result).toEqual({
      reference: payment.reference,
      transactionId: 'QWE123ABC',
      alreadyProcessed: false,
      settlementStatus: 'pending_review',
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      status: 'completed',
      metadata: {
        settlementStatus: 'pending_review',
        settlementReviewReasons: ['first_payment'],
        mpesaReceipt: 'QWE123ABC',
        mpesaPaidAmount: 1200,
      },
    });
    expect(paymentRecoverySAGA.executePaymentSAGA).not.toHaveBeenCalled();
  });

  it('keeps the existing SAGA dispatch available behind the explicit feature flag', async () => {
    process.env.MPESA_AUTO_SETTLEMENT_ENABLED = 'true';
    const payment = {
      id: 'payment-auto',
      userId: 'member-1',
      reference: 'M987654321XY',
      type: 'deposit',
      provider: 'mpesa',
      amount: '1200',
      currency: 'KES',
      status: 'pending',
      metadata: { purpose: 'mpesa_c2b', phone: '254712345678' },
    };
    let transactionSelectCount = 0;
    const transactionQuery: any = {
      from: vi.fn(() => transactionQuery),
      where: vi.fn(() => transactionQuery),
      for: vi.fn(() => transactionQuery),
      limit: vi.fn(async () => {
        const index = transactionSelectCount++;
        if (index === 0) return [payment];
        if (index === 1) return [{
          id: 'member-1',
          phone: '254712345678',
          phoneVerified: true,
        }];
        if (index === 3) return [{ id: 'previous-payment' }];
        return [];
      }),
    };
    const tx = {
      select: vi.fn(() => transactionQuery),
      update: vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            payment.status = String(values.status);
            payment.metadata = values.metadata as Record<string, unknown>;
          }),
        })),
      })),
    };
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));
    vi.mocked(db.select).mockImplementation(() => {
      const query: any = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        limit: vi.fn(async () => [{ id: 'wallet-1' }]),
      };
      return query;
    });

    await reconcileMpesaC2bCallback({
      BillRefNumber: payment.reference,
      TransID: 'QWE987XYZ',
      TransAmount: '1200',
      MSISDN: '254712345678',
      BusinessShortCode: '600000',
    });

    expect(payment.metadata).toMatchObject({
      settlementStatus: 'auto_approved',
      settlementReviewReasons: [],
    });
    expect(paymentRecoverySAGA.executePaymentSAGA).toHaveBeenCalledOnce();
  });

  it('holds an amount mismatch for manual review without dispatching', async () => {
    const payment = {
      id: 'payment-2',
      userId: 'member-1',
      reference: 'M123456789AB',
      type: 'deposit',
      provider: 'mpesa',
      amount: '1200',
      currency: 'KES',
      status: 'pending',
      metadata: { purpose: 'mpesa_c2b', phone: '254712345678' },
    };
    let selectionIndex = 0;
    const transactionQuery: any = {
      from: vi.fn(() => transactionQuery),
      where: vi.fn(() => transactionQuery),
      for: vi.fn(() => transactionQuery),
      limit: vi.fn(async () => (selectionIndex++ === 0 ? [payment] : [])),
    };
    const tx = {
      select: vi.fn(() => transactionQuery),
      update: vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            payment.status = String(values.status);
            payment.metadata = values.metadata as Record<string, unknown>;
          }),
        })),
      })),
    };
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

    const result = await reconcileMpesaC2bCallback({
      BillRefNumber: payment.reference,
      TransID: 'QWE123ABC',
      TransAmount: '100',
      MSISDN: '254712345678',
    });

    expect(result.settlementStatus).toBe('pending_review');
    expect(payment.metadata).toMatchObject({
      settlementReviewReasons: expect.arrayContaining(['amount_mismatch', 'first_payment']),
    });
    expect(paymentRecoverySAGA.executePaymentSAGA).not.toHaveBeenCalled();
  });
});
