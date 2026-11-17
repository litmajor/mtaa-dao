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
  reconcileProposalExecutionFindings,
  recordUnmatchedOnchainProposalEvent,
} from "../services/proposalExecutionReconciliationRules";

describe("proposal execution reconciliation rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records structured R08 and R09 findings", async () => {
    mocks.execute
      .mockResolvedValueOnce({
        rows: [{
          executionId: "execution-1",
          proposalId: "proposal-1",
          daoId: "dao-1",
          executionType: "treasury_transfer",
          status: "completed",
          externalReference: "provider-ref-1",
          externalTxHash: null,
          executionResult: { status: "completed" },
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          multisigTransactionId: "multisig-tx-1",
          daoId: "dao-1",
          proposalId: "proposal-2",
          multisigStatus: "executed",
          submittedTxHash: "0xsubmitted",
          executedAt: new Date("2026-03-01T00:00:00.000Z"),
          metadata: { executedOnChain: true, executionTxHash: "0xchain" },
          executionId: "execution-2",
          executionReference: "multisig-tx-1",
          executionStatus: "completed",
          executionTxHash: "0xdifferent",
        }],
      });

    await expect(reconcileProposalExecutionFindings("run-1")).resolves.toEqual({
      r08: 1,
      r09: 1,
    });

    expect(mocks.recordFinding).toHaveBeenNthCalledWith(1, expect.objectContaining({
      findingKey: "R08:proposal-execution:execution-1",
      ruleId: "R08",
      severity: "critical",
      runId: "run-1",
      expectedState: { confirmedPayoutEvidence: true },
      observedState: expect.objectContaining({
        confirmedMultisigExecutionFound: false,
        externalTxHash: null,
      }),
    }));
    expect(mocks.recordFinding).toHaveBeenNthCalledWith(2, expect.objectContaining({
      findingKey: "R09:multisig-transaction:multisig-tx-1",
      ruleId: "R09",
      severity: "high",
      runId: "run-1",
      observedState: expect.objectContaining({
        executionTxHash: "0xdifferent",
      }),
    }));
  });

  it("deduplicates unmatched on-chain events using stable chain evidence", async () => {
    await recordUnmatchedOnchainProposalEvent({
      eventType: "ProposalExecuted",
      contractAddress: "0xAbC",
      proposalId: "17",
      transactionHash: "0xDef",
      blockNumber: 123,
      blockHash: "0xBlock",
      logIndex: 4,
      reason: "No corresponding database execution",
    });

    expect(mocks.recordFinding).toHaveBeenCalledWith(expect.objectContaining({
      findingKey: "R09:onchain-event:ProposalExecuted:0xabc:0xdef:4",
      ruleId: "R09",
      severity: "high",
      evidenceReferences: expect.arrayContaining([
        "chain-transaction:0xDef",
        "chain-block:0xBlock",
        "onchain-proposal:17",
      ]),
    }));
  });
});
