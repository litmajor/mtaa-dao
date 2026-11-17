import { and, eq } from "drizzle-orm";
import {
  financialReconciliationFindingEvents,
  financialReconciliationFindings,
  financialReconciliationRuns,
  type FinancialReconciliationFindingStatus,
  type FinancialReconciliationSeverity,
} from "../../shared/schema";
import { db } from "../db";

export interface RecordFinancialReconciliationFindingInput {
  findingKey: string;
  domain: string;
  ruleId: string;
  severity: FinancialReconciliationSeverity;
  operationId?: string;
  expectedState: unknown;
  observedState: unknown;
  evidenceReferences: string[];
  runId?: string;
  detectedAt?: Date;
  actor?: string;
}

export class FinancialReconciliationError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "INVALID_TRANSITION",
  ) {
    super(message);
    this.name = "FinancialReconciliationError";
  }
}

function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new FinancialReconciliationError(
      `${field} must contain 1 to ${maxLength} characters`,
      "INVALID_INPUT",
    );
  }
  return normalized;
}

function validateJson(value: unknown, field: string): void {
  try {
    if (JSON.stringify(value) === undefined) throw new Error("value is not JSON serializable");
  } catch (error) {
    throw new FinancialReconciliationError(
      `${field} must be JSON serializable: ${error instanceof Error ? error.message : String(error)}`,
      "INVALID_INPUT",
    );
  }
}

function normalizeEvidenceReferences(references: string[]): string[] {
  if (!Array.isArray(references) || references.some((reference) => typeof reference !== "string")) {
    throw new FinancialReconciliationError("evidenceReferences must be an array of strings", "INVALID_INPUT");
  }
  return [...new Set(references.map((reference) => reference.trim()).filter(Boolean))];
}

function appendEvidenceReferences(current: string[], additional: string[]): string[] {
  return [...new Set([...normalizeEvidenceReferences(current), ...normalizeEvidenceReferences(additional)])];
}

export class FinancialReconciliationService {
  async startRun(metadata: Record<string, unknown> = {}) {
    validateJson(metadata, "run metadata");
    const [run] = await db.insert(financialReconciliationRuns)
      .values({ status: "running", summary: metadata })
      .returning();
    return run;
  }

  async completeRun(runId: string, summary: Record<string, unknown>) {
    validateJson(summary, "run summary");
    return this.finishRun(runId, "completed", summary);
  }

  async failRun(runId: string, error: string, summary: Record<string, unknown> = {}) {
    validateJson(summary, "run summary");
    const failure = requiredText(error, "error", 8_000);
    return this.finishRun(runId, "failed", summary, failure);
  }

  private async finishRun(
    runId: string,
    status: "completed" | "failed",
    summary: Record<string, unknown>,
    error?: string,
  ) {
    const normalizedRunId = requiredText(runId, "runId", 64);
    const [run] = await db.update(financialReconciliationRuns)
      .set({
        status,
        summary,
        error: error ?? null,
        completedAt: new Date(),
      })
      .where(and(
        eq(financialReconciliationRuns.id, normalizedRunId),
        eq(financialReconciliationRuns.status, "running"),
      ))
      .returning();
    if (!run) {
      throw new FinancialReconciliationError(
        `Running reconciliation run ${normalizedRunId} was not found`,
        "NOT_FOUND",
      );
    }
    return run;
  }

  async recordFinding(input: RecordFinancialReconciliationFindingInput) {
    const findingKey = requiredText(input.findingKey, "findingKey", 512);
    const domain = requiredText(input.domain, "domain", 64);
    const ruleId = requiredText(input.ruleId, "ruleId", 16);
    const actor = requiredText(input.actor ?? "system:financial-reconciliation", "actor", 200);
    const evidenceReferences = normalizeEvidenceReferences(input.evidenceReferences);
    validateJson(input.expectedState, "expectedState");
    validateJson(input.observedState, "observedState");
    const detectedAt = input.detectedAt ?? new Date();

    return db.transaction(async (tx) => {
      const [inserted] = await tx.insert(financialReconciliationFindings)
        .values({
          findingKey,
          domain,
          ruleId,
          severity: input.severity,
          operationId: input.operationId ?? null,
          status: "open",
          expectedState: input.expectedState,
          observedState: input.observedState,
          evidenceReferences,
          firstDetectedAt: detectedAt,
          lastDetectedAt: detectedAt,
          lastRunId: input.runId ?? null,
        })
        .onConflictDoNothing({ target: financialReconciliationFindings.findingKey })
        .returning();

      let finding = inserted;
      let eventType: "detected" | "reopened" = "detected";
      let fromStatus: FinancialReconciliationFindingStatus | null = null;
      if (!finding) {
        const [existing] = await tx.select()
          .from(financialReconciliationFindings)
          .where(eq(financialReconciliationFindings.findingKey, findingKey))
          .for("update")
          .limit(1);
        if (!existing) {
          throw new FinancialReconciliationError("Finding could not be inserted or loaded", "NOT_FOUND");
        }

        fromStatus = existing.status;
        const reopened = existing.status === "resolved";
        eventType = reopened ? "reopened" : "detected";
        const [updated] = await tx.update(financialReconciliationFindings)
          .set({
            domain,
            ruleId,
            severity: input.severity,
            operationId: input.operationId ?? existing.operationId,
            status: reopened ? "reopened" : existing.status,
            expectedState: input.expectedState,
            observedState: input.observedState,
            evidenceReferences: appendEvidenceReferences(existing.evidenceReferences, evidenceReferences),
            lastDetectedAt: detectedAt,
            lastRunId: input.runId ?? existing.lastRunId,
            resolvedAt: reopened ? null : existing.resolvedAt,
            resolvedBy: reopened ? null : existing.resolvedBy,
            resolutionNote: reopened ? null : existing.resolutionNote,
            acknowledgedAt: reopened ? null : existing.acknowledgedAt,
            acknowledgedBy: reopened ? null : existing.acknowledgedBy,
            updatedAt: detectedAt,
          })
          .where(eq(financialReconciliationFindings.id, existing.id))
          .returning();
        if (!updated) {
          throw new FinancialReconciliationError("Finding could not be updated", "NOT_FOUND");
        }
        finding = updated;
      }

      await tx.insert(financialReconciliationFindingEvents).values({
        findingId: finding.id,
        runId: input.runId ?? null,
        eventType,
        fromStatus,
        toStatus: finding.status,
        actor,
        expectedState: input.expectedState,
        observedState: input.observedState,
        evidenceReferences,
        createdAt: detectedAt,
      });

      return finding;
    });
  }

  async acknowledgeFinding(findingId: string, actor: string, note: string) {
    return this.transitionFinding(findingId, "acknowledged", actor, note);
  }

  async resolveFinding(
    findingId: string,
    actor: string,
    explanation: string,
    evidenceReferences: string[] = [],
  ) {
    return this.transitionFinding(findingId, "resolved", actor, explanation, evidenceReferences);
  }

  private async transitionFinding(
    findingId: string,
    nextStatus: "acknowledged" | "resolved",
    actorValue: string,
    noteValue: string,
    additionalEvidence: string[] = [],
  ) {
    const normalizedFindingId = requiredText(findingId, "findingId", 64);
    const actor = requiredText(actorValue, "actor", 200);
    const note = requiredText(noteValue, nextStatus === "resolved" ? "explanation" : "note", 8_000);
    const evidenceReferences = normalizeEvidenceReferences(additionalEvidence);

    return db.transaction(async (tx) => {
      const [existing] = await tx.select()
        .from(financialReconciliationFindings)
        .where(eq(financialReconciliationFindings.id, normalizedFindingId))
        .for("update")
        .limit(1);
      if (!existing) {
        throw new FinancialReconciliationError(`Finding ${normalizedFindingId} was not found`, "NOT_FOUND");
      }
      if (existing.status === "resolved") {
        if (nextStatus === "resolved") return existing;
        throw new FinancialReconciliationError("A resolved finding cannot be acknowledged", "INVALID_TRANSITION");
      }
      if (nextStatus === "acknowledged" && existing.status === "acknowledged") return existing;

      const nextEvidence = appendEvidenceReferences(existing.evidenceReferences, evidenceReferences);
      const transitionedAt = new Date();
      const [updated] = await tx.update(financialReconciliationFindings)
        .set(nextStatus === "acknowledged"
          ? {
            status: "acknowledged",
            acknowledgedAt: transitionedAt,
            acknowledgedBy: actor,
            evidenceReferences: nextEvidence,
            updatedAt: transitionedAt,
          }
          : {
            status: "resolved",
            resolvedAt: transitionedAt,
            resolvedBy: actor,
            resolutionNote: note,
            evidenceReferences: nextEvidence,
            updatedAt: transitionedAt,
          })
        .where(eq(financialReconciliationFindings.id, normalizedFindingId))
        .returning();
      if (!updated) {
        throw new FinancialReconciliationError("Finding could not be transitioned", "NOT_FOUND");
      }

      await tx.insert(financialReconciliationFindingEvents).values({
        findingId: existing.id,
        runId: existing.lastRunId,
        eventType: nextStatus,
        fromStatus: existing.status,
        toStatus: updated.status,
        actor,
        note,
        expectedState: existing.expectedState,
        observedState: existing.observedState,
        evidenceReferences: nextEvidence,
        createdAt: transitionedAt,
      });
      return updated;
    });
  }
}

export const financialReconciliationService = new FinancialReconciliationService();
