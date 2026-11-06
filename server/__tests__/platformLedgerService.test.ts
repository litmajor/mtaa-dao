import { describe, expect, it, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { postPlatformTransfer } from '../services/platformLedgerService';

describe('postPlatformTransfer', () => {
  it('writes one journal transaction with a debit and credit entry', async () => {
    const results: unknown[] = [
      { rows: [] },
      { rows: [] },
      { rows: [{ id: '00000000-0000-0000-0000-000000000001' }] },
      { rows: [{ id: '00000000-0000-0000-0000-000000000002' }] },
      { rows: [{ id: '00000000-0000-0000-0000-000000000003' }] },
    ];
    const execute = vi.fn(async (_query: SQL): Promise<unknown> => results.shift());

    await postPlatformTransfer({ execute }, {
      reference: 'transfer-123',
      fromAccountId: '00000000-0000-0000-0000-000000000011',
      toAccountId: '00000000-0000-0000-0000-000000000012',
      amount: '10.25',
      currency: 'USDC',
      description: 'Internal transfer',
    });

    expect(execute).toHaveBeenCalledTimes(5);
  });

  it('fails when both account journal legs cannot be created', async () => {
    const results: unknown[] = [
      { rows: [] },
      { rows: [] },
      { rows: [{ id: '00000000-0000-0000-0000-000000000001' }] },
      { rows: [{ id: '00000000-0000-0000-0000-000000000002' }] },
      { rows: [] },
    ];
    const execute = vi.fn(async (_query: SQL): Promise<unknown> => results.shift());

    await expect(postPlatformTransfer({ execute }, {
      reference: 'transfer-456',
      fromAccountId: '00000000-0000-0000-0000-000000000011',
      toAccountId: '00000000-0000-0000-0000-000000000012',
      amount: '10.25',
      currency: 'USDC',
      description: 'Internal transfer',
    })).rejects.toThrow('Unable to post both sides');
  });

  it('rejects invalid transfers before issuing database writes', async () => {
    const execute = vi.fn(async (_query: SQL): Promise<unknown> => ({ rows: [] }));

    await expect(postPlatformTransfer({ execute }, {
      reference: 'transfer-789',
      fromAccountId: '00000000-0000-0000-0000-000000000011',
      toAccountId: '00000000-0000-0000-0000-000000000011',
      amount: '0',
      currency: 'USDC',
      description: 'Invalid transfer',
    })).rejects.toThrow('positive');

    expect(execute).not.toHaveBeenCalled();
  });
});
