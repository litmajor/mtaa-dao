import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  recordFinding: vi.fn(),
}));

vi.mock("../db", () => ({ db: { execute: mocks.execute } }));
vi.mock("../services/financialReconciliationService", () => ({
  financialReconciliationService: { recordFinding: mocks.recordFinding },
}));

import {
  reconcileDaoContributionAndDepositFindings,
  recordTreasuryBalanceFinding,
} from "../services/daoTreasuryReconciliationRules";

describe("DAO and treasury reconciliation rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records structured R05 and R07 findings", async () => {
    mocks.execute
      .mockResolvedValueOnce({
        rows: [{
          walletTransactionId: "wallet-tx-1",
          daoId: "dao-1",
          amount: "20.00",
          currency: "KES",
          contributionId: "contribution-1",
          contributionStatus: "completed",
          approvalStatus: "awaiting",
          requiredApprovals: 1,
          recordedApprovals: 0,
          verifiedApprovals: 0,
          requiresApproval: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          walletTransactionId: "wallet-tx-2",
          daoId: "dao-1",
          amount: "50.00",
          currency: "cUSD",
          walletAddress: "0xTreasury",
          walletChainId: 42220,
          walletTokenAddress: "0xToken",
          transactionHash: null,
          stableInflowEventId: null,
          evidence: null,
          inflowStatus: null,
          confirmationState: null,
          tokenSymbol: null,
          normalizedTokenAmount: null,
          txHash: null,
          inflowTokenAddress: null,
          toAddress: null,
          inflowChainId: null,
          riskFlags: null,
          configuredTreasuryPosition: false,
        }],
      });

    const result = await reconcileDaoContributionAndDepositFindings("run-1");

    expect(result).toEqual({ r05: 1, r07: 1 });
    expect(mocks.recordFinding).toHaveBeenNthCalledWith(1, expect.objectContaining({
      findingKey: "R05:treasury-credit:wallet-tx-1",
      ruleId: "R05",
      runId: "run-1",
      observedState: expect.objectContaining({
        verifiedApprovals: 0,
        requiredApprovals: 1,
      }),
    }));
    expect(mocks.recordFinding).toHaveBeenNthCalledWith(2, expect.objectContaining({
      findingKey: "R07:treasury-deposit:wallet-tx-2",
      ruleId: "R07",
      runId: "run-1",
      observedState: expect.objectContaining({
        verifiedOnChainInflow: false,
        documentedAdjustment: false,
      }),
    }));
  });

  it("records R06 only for a DAO asset mismatch with independent chain evidence", async () => {
    const result = await recordTreasuryBalanceFinding({
      type: "dao_treasury",
      entityId: "dao-1",
      computedValue: "100.000000000000000000",
      onChainValue: "90.000000000000000000",
      discrepancy: "10.000000000000000000",
      discrepancyPercent: 10,
      status: "critical",
      lastOnChainCheck: new Date("2026-01-01T00:00:00.000Z"),
      recordedAt: new Date("2026-01-01T00:00:01.000Z"),
      assetIdentity: {
        chain: 42220,
        tokenAddress: "0xToken",
        holderAddress: "0xTreasury",
        symbol: "cUSD",
        blockNumber: 123,
        blockHash: "0xBlock",
      },
    }, "run-2");

    expect(result).toBe(true);
    expect(mocks.recordFinding).toHaveBeenCalledWith(expect.objectContaining({
      findingKey: "R06:dao:dao-1:42220:0xtoken",
      severity: "critical",
      expectedState: { indexedAssetBalance: "100.000000000000000000" },
      observedState: expect.objectContaining({
        independentlyObservedBalance: "90.000000000000000000",
        blockNumber: 123,
        blockHash: "0xBlock",
      }),
      runId: "run-2",
    }));
  });
});
