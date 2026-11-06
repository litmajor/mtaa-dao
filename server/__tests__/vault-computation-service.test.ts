import { beforeEach, describe, expect, it, vi } from 'vitest';

const { selectResults, select } = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const select = vi.fn(() => {
    const query = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn(() => Promise.resolve(selectResults.shift())),
    };
    return query;
  });
  return { selectResults, select };
});

vi.mock('../storage', () => ({
  db: { select },
}));

import { getComputedVaultBalance } from '../services/vaultComputationService';

describe('getComputedVaultBalance', () => {
  beforeEach(() => {
    select.mockClear();
    selectResults.length = 0;
  });

  it('aggregates multiple holding rows only when their chain asset identity matches', async () => {
    selectResults.push(
      [{ userId: 'user-1', daoId: null }],
      [{
        totalBalance: '15',
        totalValueUsd: '15',
        unpricedCount: 0,
        unverifiedCount: 0,
        tokenCount: 1,
        maxUpdatedAt: null,
        count: 2,
      }],
      [
        {
          token: 'cUSD',
          balance: '10',
          valueUsd: '10',
          chain: 'celo',
          chainId: 42220,
          tokenAddress: '0x0000000000000000000000000000000000000010',
          holderAddress: '0x0000000000000000000000000000000000000011',
          lastUpdatedAt: null,
        },
        {
          token: 'cUSD',
          balance: '5',
          valueUsd: '5',
          chain: 'celo',
          chainId: 42220,
          tokenAddress: '0x0000000000000000000000000000000000000010',
          holderAddress: '0x0000000000000000000000000000000000000011',
          lastUpdatedAt: null,
        },
      ],
    );

    const result = await getComputedVaultBalance('vault-1');

    expect(result.computedBalance).toBe('15');
    expect(result.computedValueUsd).toBe('15');
    expect(result.holdings).toHaveLength(2);
  });

  it('treats a default zero valuation for a nonzero holding as unpriced', async () => {
    selectResults.push(
      [{ userId: 'user-1', daoId: null }],
      [{
        totalBalance: '10',
        totalValueUsd: '0',
        unpricedCount: 1,
        unverifiedCount: 0,
        tokenCount: 1,
        maxUpdatedAt: null,
        count: 1,
      }],
      [{
        token: 'cUSD',
        balance: '10',
        valueUsd: '0',
        chain: 'celo',
        chainId: 42220,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        holderAddress: '0x0000000000000000000000000000000000000001',
        lastUpdatedAt: null,
      }],
    );

    const result = await getComputedVaultBalance('vault-1');

    expect(result.computedBalance).toBe('10');
    expect(result.computedValueUsd).toBeNull();
    expect(result.holdings[0].valueUsd).toBeNull();
  });
});
