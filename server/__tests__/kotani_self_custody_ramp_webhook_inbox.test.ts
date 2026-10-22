import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbState = vi.hoisted(() => ({
  inserted: undefined as unknown,
  selectedStatus: 'pending',
  claimResults: [] as Array<Array<{ id: string }>>,
  updates: [] as unknown[],
}));

vi.mock('../db', () => ({
  db: {
    insert: () => ({
      values: (values: unknown) => {
        dbState.inserted = values;
        return { onConflictDoNothing: async () => undefined };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ status: dbState.selectedStatus }],
        }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => {
        dbState.updates.push(values);
        return {
          where: () => ({
            returning: async () => dbState.claimResults.shift() ?? [],
          }),
        };
      },
    }),
  },
}));

import { KotaniSelfCustodyRampService } from '../services/kotaniSelfCustodyRampService';

describe('Kotani self-custody durable webhook inbox', () => {
  beforeEach(() => {
    dbState.inserted = undefined;
    dbState.selectedStatus = 'pending';
    dbState.claimResults = [];
    dbState.updates = [];
  });

  it('persists a deduplicated settlement subset without signatures or phone numbers', async () => {
    const stored = await KotaniSelfCustodyRampService.persistWebhookEvent(
      'a'.repeat(64),
      'transaction.offramp.status.updated',
      {
        referenceId: 'ramp-1',
        status: 'SUCCESSFUL',
        chain: 'CELO',
        token: 'CUSD',
        senderAddress: '0x0000000000000000000000000000000000000001',
        phoneNumber: '+254712345678',
        signature: 'not-to-be-stored',
        arbitraryProviderData: 'not-to-be-stored',
      },
    );

    expect(stored.status).toBe('pending');
    expect(dbState.inserted).toMatchObject({
      eventDigest: 'a'.repeat(64),
      referenceId: 'ramp-1',
      payload: {
        referenceId: 'ramp-1',
        status: 'SUCCESSFUL',
        chain: 'CELO',
        token: 'CUSD',
      },
    });
    expect(dbState.inserted).not.toHaveProperty('payload.phoneNumber');
    expect(dbState.inserted).not.toHaveProperty('payload.signature');
    expect(dbState.inserted).not.toHaveProperty('payload.arbitraryProviderData');
  });

  it('atomically allows only one processor to claim a pending event', async () => {
    dbState.claimResults = [[{ id: 'event-1' }], []];

    await expect(KotaniSelfCustodyRampService.claimWebhookEvent('b'.repeat(64))).resolves.toBe(true);
    await expect(KotaniSelfCustodyRampService.claimWebhookEvent('b'.repeat(64))).resolves.toBe(false);
    expect(dbState.updates).toHaveLength(2);
  });
});
