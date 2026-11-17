import type { FinancialOperationStatus } from "../../shared/schema";

const allowedTransitions: Record<FinancialOperationStatus, readonly FinancialOperationStatus[]> = {
  initiated: ["awaiting_authorization", "authorized", "settlement_pending", "failed", "reconciliation_required"],
  awaiting_authorization: ["authorized", "failed", "reconciliation_required"],
  authorized: ["settlement_pending", "failed", "reconciliation_required"],
  settlement_pending: ["settled", "failed", "reconciliation_required"],
  settled: ["accounting_pending", "reconciliation_required"],
  accounting_pending: ["completed", "failed", "reconciliation_required"],
  completed: [],
  failed: [],
  reconciliation_required: ["settlement_pending", "settled", "accounting_pending", "failed"],
};

export function canTransitionFinancialOperation(
  from: FinancialOperationStatus,
  to: FinancialOperationStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}
