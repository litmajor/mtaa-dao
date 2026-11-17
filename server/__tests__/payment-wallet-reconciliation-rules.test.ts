import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  recordFinding: vi.fn(),
}));

vi.mock("../db", () => ({ db: { execute: mocks.execute } }));
vi.mock("../services/financialReconciliationService", () => ({
  financialReconciliationService: { recordFinding: mocks.recordFinding },
}));

import { reconcilePaymentWalletFindings } from "../services/paymentWalletReconciliationRules";

describe("payment and wallet reconciliation rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records structured findings for R01 through R04 without applying financial writes", async () => {
    mocks.execute
      .mockResolvedValueOnce({
        rows: [{
          id: "payment-1",
          reference: "PAY-1",
          provider: "paystack",
          providerReference: "provider-ref-1",
          userId: "user-1",
          amount: "12.50",
          currency: "KES",
          status: "webhook_received",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "account-tx-1",
          accountId: "account-1",
          reference: "payment:payment-2",
          amount: "8.00",
          currency: "KES",
          paymentId: "payment-2",
          paymentStatus: "completed",
          settlementVerified: false,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          provider: "mpesa",
          providerReference: "receipt-1",
          paymentIds: ["payment-3", "payment-4"],
          accountTransactionIds: ["account-tx-3", "account-tx-4"],
          creditCount: 2,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          accountId: "account-2",
          userId: "user-2",
          currency: "USDC",
          accountBalance: "9.00000000",
          journalBalance: "7.00000000",
          lastJournalEntryId: "account-tx-5",
        }],
      });

    const result = await reconcilePaymentWalletFindings("run-1");

    expect(result).toEqual({ r01: 1, r02: 1, r03: 1, r04: 1 });
    expect(mocks.execute).toHaveBeenCalledTimes(4);
    expect(mocks.recordFinding).toHaveBeenCalledTimes(4);
    expect(mocks.recordFinding).toHaveBeenNthCalledWith(1, expect.objectContaining({
      findingKey: "R01:payment:payment-1",
      ruleId: "R01",
      runId: "run-1",
      observedState: expect.objectContaining({ walletCreditFound: false }),
      evidenceReferences: ["payment:payment-1", "provider:paystack:provider-ref-1"],
    }));
    expect(mocks.recordFinding).toHaveBeenNthCalledWith(2, expect.objectContaining({
      findingKey: "R02:account-transaction:account-tx-1",
      ruleId: "R02",
      observedState: expect.objectContaining({ settlementVerified: false }),
    }));
    expect(mocks.recordFinding).toHaveBeenNthCalledWith(3, expect.objectContaining({
      findingKey: "R03:mpesa:receipt-1",
      ruleId: "R03",
      severity: "critical",
      expectedState: { creditCount: 1 },
    }));
    expect(mocks.recordFinding).toHaveBeenNthCalledWith(4, expect.objectContaining({
      findingKey: "R04:account:account-2",
      ruleId: "R04",
      expectedState: { balanceMatchesLatestJournal: true, balance: "7.00000000" },
    }));
  });
});
