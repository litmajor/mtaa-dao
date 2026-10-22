import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}));
vi.mock('../services/rules-integration', () => ({
  evaluateRotationRules: vi.fn().mockResolvedValue({ approved: true, results: [] }),
  formatRuleRejectionMessage: vi.fn(),
  logRuleEvaluation: vi.fn(),
}));
vi.mock('../services/rotation_contract', () => ({
  distributeToRecipientOnChain: vi.fn(),
  initializeRotationOnChain: vi.fn(),
  recordContributionOnChain: vi.fn(),
}));
vi.mock('../services/mpesaB2cPayoutService', () => ({
  getB2cCallbackToken: vi.fn(() => 'test-callback-token'),
  initiateDarajaB2cPayout: vi.fn(),
  MAX_B2C_AMOUNT_KES: 150_000,
}));

import {
  completeManualRotation,
  processRotation,
  reconcileRotationB2cCallback,
  shouldUseOnChainRotationRail,
} from '../api/rotation_service';
import { db } from '../db';
import { distributeToRecipientOnChain } from '../services/rotation_contract';

function createTransaction(selectResults: unknown[]) {
  let selectIndex = 0;
  const updates: Array<{ values: unknown; where: unknown }> = [];

  const tx = {
    select: vi.fn(() => {
      let resultIndex = -1;
      const query: any = {
        from: vi.fn(() => query),
        where: vi.fn(() => {
          resultIndex = selectIndex++;
          return query;
        }),
        for: vi.fn(() => query),
        limit: vi.fn(() => Promise.resolve(selectResults[resultIndex])),
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve(selectResults[resultIndex]).then(resolve, reject),
      };
      return query;
    }),
    update: vi.fn(() => {
      const operation = { values: undefined as unknown, where: undefined as unknown };
      updates.push(operation);
      return {
        set: vi.fn((values: unknown) => {
          operation.values = values;
          const result: unknown[] = [{ id: 'contribution-1' }];
          const whereResult: any = {
            returning: vi.fn(() => Promise.resolve(result)),
            then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
              Promise.resolve(result).then(resolve, reject),
          };
          return {
            where: vi.fn((where: unknown) => {
              operation.where = where;
              return whereResult;
            }),
          };
        }),
      };
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve([])),
    })),
  };

  return { tx, updates };
}

describe('completeManualRotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shouldUseOnChainRotationRail', () => {
    it('switches only when the expected KES pool exceeds the B2C request ceiling', () => {
      expect(shouldUseOnChainRotationRail(150_000)).toBe(false);
      expect(shouldUseOnChainRotationRail(150_001)).toBe(true);
      expect(shouldUseOnChainRotationRail(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    });
  });

  describe('reconcileRotationB2cCallback', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('completes the cycle and advances the DAO after a verified B2C result', async () => {
      const { tx, updates } = createTransaction([
        [{
          id: 'payout-1',
          daoId: 'dao-1',
          cycleId: 'cycle-1',
          status: 'accepted',
          amountKes: 2400,
        }],
        [{
          id: 'cycle-1',
          cycleNumber: 1,
          status: 'pending_b2c_payout',
          notes: 'Authorized payout',
        }],
        [{ id: 'contribution-1' }],
        [{ rotationFrequency: 'monthly' }],
      ]);
      vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

      const result = await reconcileRotationB2cCallback({
        OriginatorConversationID: 'originator-1',
        ResultCode: 0,
        ResultDesc: 'Success',
        TransactionID: 'transaction-1',
        ResultParameters: {
          ResultParameter: [
            { Key: 'TransactionAmount', Value: 2400 },
            { Key: 'TransactionReceipt', Value: 'QWE123ABC' },
          ],
        },
      }, 'test-callback-token');

      expect(result).toMatchObject({
        status: 'succeeded',
        duplicate: false,
        payoutId: 'payout-1',
        transactionId: 'transaction-1',
        receipt: 'QWE123ABC',
      });
      expect(updates.map((update) => update.values)).toEqual(expect.arrayContaining([
        expect.objectContaining({ status: 'succeeded', transactionId: 'transaction-1' }),
        expect.objectContaining({ status: 'completed' }),
        expect.objectContaining({ currentRotationCycle: 1 }),
      ]));
      expect(updates[3].values).toMatchObject({
        nextRotationDate: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  it('records the first active elder confirmation without marking a payout complete', async () => {
    const cycle = {
      id: 'cycle-1',
      cycleNumber: 2,
      recipientUserId: 'member-2',
      amountDistributed: '1250.50',
      notes: 'Awaiting manual KES payout',
      status: 'pending_manual_payout',
      paymentReference: null,
    };
    const first = createTransaction([
      [cycle],
      [{ role: 'elder', status: 'approved', isBanned: false }],
      [],
    ]);
    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => callback(first.tx));

    const firstResult = await completeManualRotation('dao-1', 'cycle-1', 'elder-1');
    expect(firstResult).toMatchObject({
      status: 'awaiting_second_confirmation',
      confirmationsReceived: 1,
    });
    expect(first.tx.insert).toHaveBeenCalled();
    expect(first.updates).toHaveLength(0);
  });

  it('does not complete a payout that has no contributions assigned to it', async () => {
    const { tx, updates } = createTransaction([
      [{
        id: 'cycle-1',
        cycleNumber: 1,
        recipientUserId: 'member-2',
        amountDistributed: '1250',
        notes: '',
        status: 'pending_manual_payout',
        paymentReference: 'QWE123ABC',
      }],
      [{ role: 'treasurer', status: 'approved', isBanned: false }],
      [{ confirmerId: 'elder-1' }],
      [{ role: 'elder', status: 'approved', isBanned: false }],
      [],
    ]);
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

    await expect(completeManualRotation('dao-1', 'cycle-1', 'treasurer-2'))
      .rejects.toThrow('No contributions are assigned to this rotation cycle');
    expect(updates).toHaveLength(0);
  });

  it('rejects a payout recipient trying to confirm their own payout', async () => {
    const { tx, updates } = createTransaction([[
      { id: 'cycle-1', recipientUserId: 'member-1', cycleNumber: 1 },
    ]]);
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

    await expect(completeManualRotation('dao-1', 'cycle-1', 'member-1'))
      .rejects.toThrow('cannot confirm their own payout');
    expect(updates).toHaveLength(0);
  });

  it('does not let the first confirmer record the same confirmation twice', async () => {
    const { tx, updates } = createTransaction([
      [{ id: 'cycle-1', recipientUserId: 'member-2', cycleNumber: 1, paymentReference: 'QWE123ABC' }],
      [{ role: 'elder', status: 'approved', isBanned: false }],
      [{ confirmerId: 'elder-1' }],
    ]);
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

    const result = await completeManualRotation('dao-1', 'cycle-1', 'elder-1');
    expect(result).toMatchObject({ status: 'awaiting_second_confirmation', confirmationsReceived: 1 });
    expect(updates).toHaveLength(0);
  });

  it('rejects completion when both confirmations come from the same role', async () => {
    const { tx, updates } = createTransaction([
      [{ id: 'cycle-1', recipientUserId: 'member-2', cycleNumber: 1, paymentReference: 'QWE123ABC' }],
      [{ role: 'elder', status: 'approved', isBanned: false }],
      [{ confirmerId: 'elder-1' }],
      [{ role: 'elder', status: 'approved', isBanned: false }],
    ]);
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

    await expect(completeManualRotation('dao-1', 'cycle-1', 'elder-2'))
      .rejects.toThrow('one treasurer and one elder');
    expect(updates).toHaveLength(0);
  });

  it('waits for every member to contribute the fixed KES amount before preparing a rotation payout', async () => {
    const dao = {
      id: 'dao-1',
      daoType: 'merryGoRound',
      durationModel: 'rotation',
      nextRotationDate: new Date(Date.now() - 1000),
      rotationSelectionMethod: 'sequential',
      rotationFrequency: 'monthly',
      currentRotationCycle: 0,
      treasuryBalance: '0',
      vaultAddress: null,
      chamaTreasuryAddress: null,
      rotationContributionAmountKes: 1200,
    };
    const availableContributions = [{
      id: 'contribution-1',
      contributorId: 'member-1',
      amount: '1200',
      status: 'approved',
      metadata: {},
    }, {
      id: 'contribution-2',
      contributorId: 'member-2',
      amount: '1200',
      status: 'approved',
      metadata: {},
    }];
    const members = [{
      userId: 'member-1',
      joinedAt: new Date(Date.now() - 1000),
    }, {
      userId: 'member-2',
      joinedAt: new Date(),
    }];
    const selectResults = [ [dao], [], [], [dao], members, availableContributions, members ];
    vi.mocked(db.select).mockImplementation(() => {
      const result = selectResults.shift();
      const query: any = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        limit: vi.fn(() => Promise.resolve(result)),
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    });

    let updateCount = 0;
    vi.mocked(db.update).mockImplementation(() => {
      const result = updateCount++ === 0 ? [dao] : [];
      const query: any = {
        set: vi.fn(() => query),
        where: vi.fn(() => query),
        returning: vi.fn(() => Promise.resolve(result)),
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    });

    const tx = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([dao]),
          }),
        }),
      })),
      insert: vi.fn(() => ({
        values: () => ({
          returning: () => Promise.resolve([{ id: 'cycle-1' }]),
        }),
      })),
      update: vi.fn(() => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'contribution-1' }]),
          }),
        }),
      })),
    };
    vi.mocked(db.transaction).mockImplementation(async (callback: any) => callback(tx));

    const result = await processRotation('dao-1');

    expect(result).toMatchObject({
      status: 'pending_manual_payout',
      cycleId: 'cycle-1',
      cycleNumber: 1,
      recipientUserId: 'member-1',
      amountDistributed: '2400',
      currency: 'KES',
    });
    expect(tx.insert).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
    expect(distributeToRecipientOnChain).not.toHaveBeenCalled();
  });
});
