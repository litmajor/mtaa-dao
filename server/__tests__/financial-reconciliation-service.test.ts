import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  db: { transaction: vi.fn(), insert: vi.fn(), update: vi.fn() },
  findings: [] as Array<Record<string, any>>,
  runs: [] as Array<Record<string, any>>,
  events: [] as Array<Record<string, any>>,
  id: 0,
}));

vi.mock("../db", () => ({ db: state.db }));

import {
  financialReconciliationFindingEvents,
  financialReconciliationFindings,
  financialReconciliationRuns,
} from "../../shared/schema";
import {
  FinancialReconciliationError,
  FinancialReconciliationService,
} from "../services/financialReconciliationService";

function makeTransaction() {
  return {
    insert: vi.fn((table: unknown) => {
      let values: Record<string, any>;
      const builder: any = {
        values: vi.fn((input: Record<string, any>) => {
          values = input;
          if (table === financialReconciliationFindingEvents) state.events.push(values);
          return builder;
        }),
        onConflictDoNothing: vi.fn(() => builder),
        returning: vi.fn(async () => {
          if (table === financialReconciliationFindings) {
            if (state.findings.some((finding) => finding.findingKey === values.findingKey)) return [];
            const inserted = {
              id: `finding-${++state.id}`,
              status: "open",
              firstDetectedAt: values.firstDetectedAt,
              lastDetectedAt: values.lastDetectedAt,
              evidenceReferences: [],
              ...values,
            };
            state.findings.push(inserted);
            return [inserted];
          }
          if (table === financialReconciliationRuns) {
            const inserted = { id: `run-${++state.id}`, startedAt: new Date(), ...values };
            state.runs.push(inserted);
            return [inserted];
          }
          if (table === financialReconciliationFindingEvents) {
            return [];
          }
          return [];
        }),
      };
      return builder;
    }),
    select: vi.fn(() => {
      let table: unknown;
      const builder: any = {
        from: vi.fn((selectedTable: unknown) => {
          table = selectedTable;
          return builder;
        }),
        where: vi.fn(() => builder),
        for: vi.fn(() => builder),
        limit: vi.fn(async () => {
          if (table === financialReconciliationFindings) return state.findings.slice(0, 1);
          if (table === financialReconciliationRuns) return state.runs.slice(0, 1);
          return [];
        }),
      };
      return builder;
    }),
    update: vi.fn((table: unknown) => {
      let values: Record<string, any>;
      const builder: any = {
        set: vi.fn((input: Record<string, any>) => {
          values = input;
          return builder;
        }),
        where: vi.fn(() => builder),
        returning: vi.fn(async () => {
          const records = table === financialReconciliationFindings ? state.findings : state.runs;
          const current = records[records.length - 1];
          if (!current) return [];
          Object.assign(current, values);
          return [current];
        }),
      };
      return builder;
    }),
  };
}

describe("FinancialReconciliationService", () => {
  let service: FinancialReconciliationService;

  beforeEach(() => {
    state.findings = [];
    state.runs = [];
    state.events = [];
    state.id = 0;
    const tx = makeTransaction();
    state.db.transaction.mockImplementation(async (callback: (transaction: ReturnType<typeof makeTransaction>) => unknown) => callback(tx));
    state.db.insert.mockImplementation((table: unknown) => tx.insert(table));
    state.db.update.mockImplementation((table: unknown) => tx.update(table));
    service = new FinancialReconciliationService();
  });

  const findingInput = {
    findingKey: "R01:provider:pay-123",
    domain: "payments",
    ruleId: "R01",
    severity: "high" as const,
    expectedState: { walletCredited: true },
    observedState: { providerSettled: true, walletCredited: false },
    evidenceReferences: ["payment:pay-123", "provider:receipt-123"],
  };

  it("deduplicates repeated detections, preserves evidence history, and reopens resolved findings", async () => {
    const firstDetectedAt = new Date("2026-01-01T00:00:00.000Z");
    const first = await service.recordFinding({
      ...findingInput,
      evidenceReferences: ["payment:pay-123"],
      detectedAt: firstDetectedAt,
      runId: "run-1",
    });
    const repeated = await service.recordFinding({
      ...findingInput,
      evidenceReferences: ["provider:receipt-123"],
      runId: "run-2",
    });

    expect(repeated.id).toBe(first.id);
    expect(repeated.firstDetectedAt).toEqual(firstDetectedAt);
    expect(repeated.evidenceReferences).toEqual(["payment:pay-123", "provider:receipt-123"]);
    expect(state.findings).toHaveLength(1);
    expect(state.events.map((event) => event.eventType)).toEqual(["detected", "detected"]);

    const acknowledged = await service.acknowledgeFinding(first.id, "admin-1", "Investigating provider settlement");
    expect(acknowledged.status).toBe("acknowledged");

    const resolved = await service.resolveFinding(first.id, "admin-1", "Credited after provider verification", [
      "account-transaction:acct-tx-1",
    ]);
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolutionNote).toBe("Credited after provider verification");

    const reopened = await service.recordFinding({
      ...findingInput,
      evidenceReferences: ["provider:receipt-124"],
      runId: "run-3",
    });
    expect(reopened.status).toBe("reopened");
    expect(reopened.resolvedAt).toBeNull();
    expect(reopened.acknowledgedAt).toBeNull();
    expect(reopened.evidenceReferences).toContain("account-transaction:acct-tx-1");
    expect(reopened.evidenceReferences).toContain("provider:receipt-124");
    expect(state.events.map((event) => event.eventType)).toEqual([
      "detected",
      "detected",
      "acknowledged",
      "resolved",
      "reopened",
    ]);
  });

  it("tracks reconciliation run completion and failure", async () => {
    const run = await service.startRun({ sources: ["payments", "wallets"] });
    expect(run.status).toBe("running");

    const completed = await service.completeRun(run.id, { scanned: 12, findings: 2 });
    expect(completed.status).toBe("completed");
    expect(completed.summary).toEqual({ scanned: 12, findings: 2 });

    const failedRun = await service.startRun();
    const failed = await service.failRun(failedRun.id, "Provider status API timed out");
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("timed out");
  });

  it("requires explanations and rejects acknowledging a resolved finding", async () => {
    const finding = await service.recordFinding(findingInput);
    await expect(service.acknowledgeFinding(finding.id, "admin-1", " "))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });

    await service.resolveFinding(finding.id, "admin-1", "Resolved by confirmed provider evidence");
    await expect(service.acknowledgeFinding(finding.id, "admin-1", "Rechecking"))
      .rejects.toBeInstanceOf(FinancialReconciliationError);
  });
});
