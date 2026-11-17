import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: { transaction: vi.fn() },
  selectCount: 0,
  updateCount: 0,
  queueRow: null as Record<string, any> | null,
}));

vi.mock('../storage', () => ({ db: state.db }));
vi.mock('../services/vaultService', () => ({ vaultService: {} }));
vi.mock('../services/treasuryValidationService', () => ({
  TreasuryValidationService: {},
}));

import { ProposalExecutionService } from '../proposalExecutionService';

function makeTx() {
  return {
    select: vi.fn(() => {
      const query: any = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        limit: vi.fn(async () => {
          state.selectCount += 1;
          if (state.selectCount === 1) return [];
          if (state.selectCount === 2) return state.queueRow ? [state.queueRow] : [];
          if (state.selectCount === 3 || state.selectCount === 4) {
            return state.queueRow ? [state.queueRow] : [];
          }
          return [];
        }),
      };
      return query;
    }),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(() => {
          const returning = vi.fn(async () => {
            state.updateCount += 1;
            if (state.updateCount === 1) {
              state.queueRow = { ...state.queueRow, ...values };
              return [state.queueRow];
            }
            if (state.updateCount === 2) return [{ id: 'proposal-1' }];
            if (state.updateCount === 3) {
              state.queueRow = { ...state.queueRow, ...values };
              return [{ id: 'execution-1' }];
            }
            if (state.updateCount === 4) return [{ id: 'proposal-1' }];
            return [];
          });
          const result = Promise.resolve([]);
          Object.assign(result, { returning });
          return result;
        }),
      })),
    })),
  };
}

describe('proposal execution safety', () => {
  beforeEach(() => {
    state.selectCount = 0;
    state.updateCount = 0;
    state.queueRow = {
      id: 'execution-1',
      proposalId: 'proposal-1',
      daoId: 'dao-1',
      scheduledFor: new Date(Date.now() - 1_000),
      executionType: 'treasury_transfer',
      executionData: { recipient: '0x123', amount: '10', currency: 'cUSD' },
      status: 'pending',
      attempts: 0,
      idempotencyKey: null,
    };
    const tx = makeTx();
    state.db.transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx));
  });

  it('claims once and leaves treasury payouts pending external settlement', async () => {
    const result = await ProposalExecutionService.executeProposal(
      state.queueRow,
      'admin-1',
      'proposal-key-1',
    );

    expect(result).toMatchObject({
      executionId: 'execution-1',
      proposalId: 'proposal-1',
      status: 'settlement_pending',
    });
    expect(state.queueRow).toMatchObject({
      status: 'settlement_pending',
      idempotencyKey: 'proposal-key-1',
    });
    expect(state.updateCount).toBe(3);

    const repeated = await ProposalExecutionService.executeProposal(
      state.queueRow,
      'admin-1',
      'proposal-key-1',
    );
    expect(repeated).toMatchObject({ status: 'settlement_pending', idempotent: true });
    expect(state.updateCount).toBe(3);
  });
});
