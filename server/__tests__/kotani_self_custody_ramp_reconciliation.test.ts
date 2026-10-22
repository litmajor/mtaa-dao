import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbState = vi.hoisted(() => ({
  transaction: undefined as unknown,
  updates: [] as unknown[],
}));

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => dbState.transaction ? [dbState.transaction] : [],
        }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => {
        dbState.updates.push(values);
        return {
          where: () => ({
            returning: async () => [{
              referenceId: 'ramp-1',
              status: (values as { status?: string }).status,
            }],
          }),
        };
      },
    }),
  },
}));

import { KotaniSelfCustodyRampService } from '../services/kotaniSelfCustodyRampService';

const walletAddress = '0x0000000000000000000000000000000000000001';
const escrowAddress = '0x0000000000000000000000000000000000000002';
const transactionHash = `0x${'a'.repeat(64)}`;

function createTransaction(direction: 'onramp' | 'offramp', status = 'pending') {
  return {
    id: 'transaction-1',
    referenceId: 'ramp-1',
    userId: 'user-1',
    direction,
    status,
    fiatCurrency: 'KES',
    fiatAmount: '1000.00',
    cryptoAmount: '10.000000000000000000',
    exchangeRate: '100.000000000000000000',
    phoneNumber: '+254712345678',
    walletAddress,
    depositAddress: escrowAddress,
    chain: 'CELO',
    token: 'CUSD',
    transactionHash: direction === 'offramp' ? transactionHash : null,
    refundTransactionHash: null,
    cryptoAmountSettled: null,
    fiatAmountSettled: null,
    providerTransactionId: 'provider-1',
    onchainStatus: null,
    fiatStatus: null,
    providerEvent: null,
    providerMetadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };
}

describe('Kotani self-custody ramp reconciliation', () => {
  beforeEach(() => {
    dbState.transaction = undefined;
    dbState.updates = [];
  });

  it('completes an onramp only when identity, asset, hash, and both settlement amounts match', async () => {
    dbState.transaction = createTransaction('onramp');
    const result = await KotaniSelfCustodyRampService.reconcileWebhook({
      referenceId: 'ramp-1',
      status: 'SUCCESSFUL',
      onchainStatus: 'SUCCESSFUL',
      depositStatus: 'SUCCESSFUL',
      chain: 'CELO',
      token: 'CUSD',
      receiverAddress: walletAddress,
      cryptoAmountReceived: '10.1',
      fiatAmount: '1000.00',
      transactionHash,
    }, 'transaction.onramp.status.updated');

    expect(result).toMatchObject({ referenceId: 'ramp-1', status: 'completed' });
    expect(dbState.updates[0]).toMatchObject({
      status: 'completed',
      cryptoAmountSettled: '10.1',
      fiatAmountSettled: '1000.00',
    });
  });

  it('holds a short crypto settlement for reconciliation instead of completing it', async () => {
    dbState.transaction = createTransaction('onramp');
    const result = await KotaniSelfCustodyRampService.reconcileWebhook({
      referenceId: 'ramp-1',
      status: 'SUCCESSFUL',
      onchainStatus: 'SUCCESSFUL',
      depositStatus: 'SUCCESSFUL',
      chain: 'CELO',
      token: 'CUSD',
      receiverAddress: walletAddress,
      cryptoAmountReceived: '9.99',
      fiatAmount: '1000.00',
      transactionHash,
    }, 'transaction.onramp.status.updated');

    expect(result).toMatchObject({ status: 'reconciliation_required' });
  });

  it('rejects a mismatched token and preserves completed state against late events', async () => {
    dbState.transaction = createTransaction('offramp');
    await expect(KotaniSelfCustodyRampService.reconcileWebhook({
      referenceId: 'ramp-1',
      status: 'SUCCESSFUL',
      chain: 'CELO',
      token: 'USDC',
    }, 'transaction.offramp.status.updated')).rejects.toThrow('Webhook asset does not match');

    dbState.transaction = createTransaction('offramp', 'completed');
    await expect(KotaniSelfCustodyRampService.reconcileWebhook({
      referenceId: 'ramp-1',
      status: 'FAILED',
    }, 'transaction.offramp.status.updated')).resolves.toMatchObject({ status: 'completed' });
    expect(dbState.updates).toHaveLength(0);
  });

  it('records a refund only when the original token amount returns to the saved wallet', async () => {
    dbState.transaction = createTransaction('offramp', 'refund_pending');
    const result = await KotaniSelfCustodyRampService.reconcileWebhook({
      referenceId: 'ramp-1',
      receiverAddress: walletAddress,
      chain: 'CELO',
      token: 'CUSD',
      refundTransactionHash: transactionHash,
      refundAmount: '10.000000000000000000',
    }, 'refund.completed');

    expect(result).toMatchObject({ status: 'refunded' });
    expect(dbState.updates[0]).toMatchObject({
      status: 'refunded',
      refundTransactionHash: transactionHash,
    });
  });
});
