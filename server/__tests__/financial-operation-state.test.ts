import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  financialOperationEvents,
  financialOperationLinks,
  financialOperations,
} from "../../shared/schema";
import { canTransitionFinancialOperation } from "../services/financialOperationState";

describe("financial operation state contract", () => {
  it("allows only the declared forward and reconciliation transitions", () => {
    expect(canTransitionFinancialOperation("initiated", "authorized")).toBe(true);
    expect(canTransitionFinancialOperation("settlement_pending", "settled")).toBe(true);
    expect(canTransitionFinancialOperation("reconciliation_required", "accounting_pending")).toBe(true);
    expect(canTransitionFinancialOperation("settled", "completed")).toBe(false);
    expect(canTransitionFinancialOperation("reconciliation_required", "completed")).toBe(false);
    expect(canTransitionFinancialOperation("completed", "settlement_pending")).toBe(false);
    expect(canTransitionFinancialOperation("failed", "completed")).toBe(false);
    expect(canTransitionFinancialOperation("initiated", "completed")).toBe(false);
  });

  it("declares durable idempotency, append-only event, and unique record-link structures", () => {
    const operationIndexes = getTableConfig(financialOperations).indexes;
    const linkIndexes = getTableConfig(financialOperationLinks).indexes;
    const eventConfig = getTableConfig(financialOperationEvents);

    expect(operationIndexes.some(
      (index) => index.config.unique && index.config.name === "financial_operations_idempotency_key_uq",
    )).toBe(true);
    expect(linkIndexes.some(
      (index) => index.config.unique && index.config.name === "financial_operation_links_record_uq",
    )).toBe(true);
    expect(eventConfig.name).toBe("financial_operation_events");
  });
});
