import express from 'express';
import request from 'supertest';

const store = new Map<string, any>();

jest.mock('../../server/db', () => {
  const db = {
    insert: jest.fn(() => ({
      values: jest.fn(async (row: any) => {
        store.set(row.reference, { ...row });
        return [row];
      }),
    })),
    update: jest.fn(() => ({
      set: jest.fn((updateData: any) => ({
        where: jest.fn(async (condition: any) => {
          const ref = condition?.right?.value;
          const current = store.get(ref) || {};
          store.set(ref, { ...current, ...updateData, reference: ref });
          return [{ reference: ref, ...updateData }];
        }),
      })),
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(async (condition: any) => {
          const ref = condition?.right?.value;
          const row = store.get(ref);
          return row ? [row] : [];
        }),
      })),
    })),
  };

  return { db };
});

import paymentsRouter from '../../server/payments';

describe('payments state-machine e2e', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentsRouter);

  beforeEach(() => {
    store.clear();
  });

  it('handles success/failure/retry transitions for mpesa payment lifecycle', async () => {
    const init = await request(app)
      .post('/api/payments/mpesa/initiate')
      .send({ userId: 'u1', phone: '254700000001', amount: 100, daoId: 'dao-1' })
      .expect(200);

    const reference = init.body.reference;
    expect(reference).toBeTruthy();
    expect(store.get(reference)?.status).toBe('pending');

    await request(app)
      .post('/api/payments/mpesa/webhook')
      .send({ reference, status: 'failed' })
      .expect(200);

    expect(store.get(reference)?.status).toBe('failed');

    await request(app)
      .post('/api/payments/mpesa/webhook')
      .send({ reference, status: 'success' })
      .expect(200);

    expect(store.get(reference)?.status).toBe('completed');
  });

  it('treats duplicate success webhook calls as idempotent status updates', async () => {
    const init = await request(app)
      .post('/api/payments/crypto/initiate')
      .send({ userId: 'u2', amount: 50, currency: 'cUSD', daoId: 'dao-2', walletAddress: '0xabc' })
      .expect(200);

    const paymentReference = init.body.paymentReference;

    const payload = {
      paymentReference,
      txHash: '0x123',
      status: 'confirmed',
    };

    await request(app).post('/api/payments/crypto/webhook').send(payload).expect(200);
    const firstState = store.get(paymentReference);

    await request(app).post('/api/payments/crypto/webhook').send(payload).expect(200);
    const secondState = store.get(paymentReference);

    expect(firstState.status).toBe('completed');
    expect(secondState.status).toBe('completed');
    expect(secondState.txHash).toBeUndefined(); // txHash stored in metadata payload, not top-level
  });

  it('returns persisted status from minipay status endpoint', async () => {
    const init = await request(app)
      .post('/api/payments/minipay/initiate')
      .send({ userId: 'u3', amount: 25, currency: 'cUSD', daoId: 'dao-3' })
      .expect(200);

    const paymentReference = init.body.paymentReference;

    await request(app)
      .post('/api/payments/minipay/confirm')
      .send({ paymentReference, txHash: '0x456' })
      .expect(200);

    const status = await request(app)
      .get(`/api/payments/minipay/status/${paymentReference}`)
      .expect(200);

    expect(status.body.success).toBe(true);
    expect(status.body.payment.reference).toBe(paymentReference);
    expect(status.body.payment.status).toBe('completed');
  });
});
