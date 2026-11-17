import { and, eq, isNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  financialOperationEvents,
  financialOperationLinks,
  financialOperations,
  type FinancialOperationLinkType,
  type FinancialOperationStatus,
  type FinancialOperationType,
} from "../../shared/schema";
import { db } from "../db";
import { canTransitionFinancialOperation } from "./financialOperationState";

export interface CreateFinancialOperationInput {
  operationType: FinancialOperationType;
  sourceDomain: string;
  destinationDomain: string;
  asset: string;
  amount: string;
  idempotencyKey: string;
  externalReference?: string;
  actor?: string;
}

export interface TransitionFinancialOperationOptions {
  actor?: string;
  details?: Record<string, unknown>;
  externalReference?: string;
}

export class FinancialOperationError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "IDEMPOTENCY_CONFLICT" | "INVALID_TRANSITION" | "CONFLICT",
  ) {
    super(message);
    this.name = "FinancialOperationError";
  }
}

function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new FinancialOperationError(`${field} must contain 1 to ${maxLength} characters`, "INVALID_INPUT");
  }
  return normalized;
}

function normalizeAmount(value: string): string {
  const amount = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) {
    throw new FinancialOperationError("amount must be a positive decimal string", "INVALID_INPUT");
  }
  const [whole, fraction = ""] = amount.split(".");
  if (whole === "0" && !/[1-9]/.test(fraction)) {
    throw new FinancialOperationError("amount must be greater than zero", "INVALID_INPUT");
  }
  if (whole.length > 42 || fraction.length > 36) {
    throw new FinancialOperationError("amount exceeds supported precision", "INVALID_INPUT");
  }
  return `${whole}${fraction ? `.${fraction.replace(/0+$/, "")}` : ""}`.replace(/\.$/, "");
}

function assertSameIdempotentRequest(
  existing: typeof financialOperations.$inferSelect,
  input: Omit<CreateFinancialOperationInput, "idempotencyKey">,
): void {
  const matches =
    existing.operationType === input.operationType &&
    existing.sourceDomain === input.sourceDomain &&
    existing.destinationDomain === input.destinationDomain &&
    existing.asset === input.asset &&
    normalizeAmount(existing.amount) === input.amount &&
    (input.externalReference === undefined || existing.externalReference === input.externalReference);
  if (!matches) {
    throw new FinancialOperationError(
      "idempotencyKey was already used for a different financial operation",
      "IDEMPOTENCY_CONFLICT",
    );
  }
}

function normalizeDetails(details: Record<string, unknown> | undefined): string {
  if (details === undefined) return "{}";
  try {
    const encoded = JSON.stringify(details);
    if (encoded === undefined || encoded.length > 16_384) {
      throw new Error("details is empty or too large");
    }
    return encoded;
  } catch (error) {
    throw new FinancialOperationError(
      `details must be JSON serializable: ${error instanceof Error ? error.message : String(error)}`,
      "INVALID_INPUT",
    );
  }
}

function validateSettlementEvidence(
  status: FinancialOperationStatus,
  details: Record<string, unknown> | undefined,
): void {
  if (status !== "settled") return;
  const evidenceType = details?.evidenceType;
  const evidenceReference = details?.evidenceReference;
  if (
    !["provider", "blockchain", "manual", "internal_ledger"].includes(String(evidenceType)) ||
    typeof evidenceReference !== "string" ||
    !evidenceReference.trim() ||
    evidenceReference.length > 512
  ) {
    throw new FinancialOperationError(
      "settled requires evidenceType and evidenceReference in transition details",
      "INVALID_INPUT",
    );
  }
}

async function setEventContext(
  tx: { execute: (query: SQL) => Promise<unknown> },
  actor: string | undefined,
  details: Record<string, unknown> | undefined,
): Promise<void> {
  const normalizedActor = requiredText(actor ?? "system", "actor", 200);
  const encodedDetails = normalizeDetails(details);
  // The database trigger consumes these transaction-local values to append
  // the immutable event in the same transaction as the state change.
  await tx.execute(sql`
    SELECT set_config('app.financial_operation_service', 'on', true),
           set_config('app.financial_operation_actor', ${normalizedActor}, true),
           set_config('app.financial_operation_details', ${encodedDetails}, true)
  `);
}

export class FinancialOperationService {
  async createOperation(input: CreateFinancialOperationInput) {
    const idempotencyKey = requiredText(input.idempotencyKey, "idempotencyKey", 200);
    const normalized = {
      operationType: input.operationType,
      sourceDomain: requiredText(input.sourceDomain, "sourceDomain", 64),
      destinationDomain: requiredText(input.destinationDomain, "destinationDomain", 64),
      asset: requiredText(input.asset, "asset", 128),
      amount: normalizeAmount(input.amount),
      externalReference: input.externalReference === undefined
        ? undefined
        : requiredText(input.externalReference, "externalReference", 512),
    };

    return db.transaction(async (tx) => {
      await setEventContext(tx, input.actor, undefined);
      const [inserted] = await tx
        .insert(financialOperations)
        .values({
          ...normalized,
          idempotencyKey,
          status: "initiated",
        })
        .onConflictDoNothing({ target: financialOperations.idempotencyKey })
        .returning();

      if (inserted) return inserted;

      const [existing] = await tx
        .select()
        .from(financialOperations)
        .where(eq(financialOperations.idempotencyKey, idempotencyKey))
        .for("update")
        .limit(1);
      if (!existing) {
        throw new FinancialOperationError("Operation could not be created or loaded", "CONFLICT");
      }

      assertSameIdempotentRequest(existing, normalized);
      return existing;
    });
  }

  async transitionOperation(
    operationId: string,
    nextStatus: FinancialOperationStatus,
    options: TransitionFinancialOperationOptions = {},
  ) {
    return db.transaction(async (tx) => {
      const [operation] = await tx
        .select()
        .from(financialOperations)
        .where(eq(financialOperations.id, operationId))
        .for("update")
        .limit(1);
      if (!operation) {
        throw new FinancialOperationError(`Financial operation ${operationId} was not found`, "NOT_FOUND");
      }
      if (!canTransitionFinancialOperation(operation.status, nextStatus)) {
        throw new FinancialOperationError(
          `Financial operation cannot transition from ${operation.status} to ${nextStatus}`,
          "INVALID_TRANSITION",
        );
      }
      validateSettlementEvidence(nextStatus, options.details);

      if (nextStatus === "completed") {
        const [accountingLink] = await tx
          .select({ id: financialOperationLinks.id })
          .from(financialOperationLinks)
          .where(and(
            eq(financialOperationLinks.operationId, operationId),
            // These links identify the destination accounting authority;
            // provider-payment links alone are not sufficient for completion.
            sql`${financialOperationLinks.recordType} IN ('wallet_transaction', 'account_transaction', 'dao_contribution', 'vault_transaction')`,
          ))
          .limit(1);
        if (!accountingLink) {
          throw new FinancialOperationError(
            "completed requires a linked authoritative accounting record",
            "INVALID_TRANSITION",
          );
        }
      }

      const externalReference = options.externalReference === undefined
        ? undefined
        : requiredText(options.externalReference, "externalReference", 512);
      if (externalReference && operation.externalReference &&
          operation.externalReference !== externalReference) {
        throw new FinancialOperationError("externalReference cannot be replaced once recorded", "CONFLICT");
      }

      await setEventContext(tx, options.actor, options.details);
      const [updated] = await tx
        .update(financialOperations)
        .set({
          status: nextStatus,
          ...(externalReference ? { externalReference } : {}),
          updatedAt: new Date(),
        })
        .where(and(
          eq(financialOperations.id, operationId),
          eq(financialOperations.status, operation.status),
        ))
        .returning();

      if (!updated) {
        throw new FinancialOperationError("Financial operation changed concurrently", "CONFLICT");
      }
      return updated;
    });
  }

  async recordExternalReference(operationId: string, externalReference: string, actor = "system") {
    const normalizedReference = requiredText(externalReference, "externalReference", 512);
    return db.transaction(async (tx) => {
      const [operation] = await tx
        .select()
        .from(financialOperations)
        .where(eq(financialOperations.id, operationId))
        .for("update")
        .limit(1);
      if (!operation) {
        throw new FinancialOperationError(`Financial operation ${operationId} was not found`, "NOT_FOUND");
      }
      if (operation.externalReference === normalizedReference) return operation;
      if (operation.status === "completed" || operation.status === "failed") {
        throw new FinancialOperationError("Terminal operations cannot be changed", "INVALID_TRANSITION");
      }
      if (operation.externalReference !== null) {
        throw new FinancialOperationError("externalReference cannot be replaced once recorded", "CONFLICT");
      }

      await setEventContext(tx, actor, { externalReference: normalizedReference });
      const [updated] = await tx
        .update(financialOperations)
        .set({ externalReference: normalizedReference, updatedAt: new Date() })
        .where(and(
          eq(financialOperations.id, operationId),
          isNull(financialOperations.externalReference),
        ))
        .returning();
      if (!updated) {
        throw new FinancialOperationError("Financial operation changed concurrently", "CONFLICT");
      }
      return updated;
    });
  }

  async linkRecord(
    operationId: string,
    recordType: FinancialOperationLinkType,
    recordId: string,
    actor = "system",
  ) {
    const normalizedRecordId = requiredText(recordId, "recordId", 512);
    return db.transaction(async (tx) => {
      const [operation] = await tx
        .select({ id: financialOperations.id, status: financialOperations.status })
        .from(financialOperations)
        .where(eq(financialOperations.id, operationId))
        .for("update")
        .limit(1);
      if (!operation) {
        throw new FinancialOperationError(`Financial operation ${operationId} was not found`, "NOT_FOUND");
      }
      if (operation.status === "completed") {
        throw new FinancialOperationError("Completed operations cannot receive new links", "INVALID_TRANSITION");
      }

      const [existing] = await tx
        .select()
        .from(financialOperationLinks)
        .where(and(
          eq(financialOperationLinks.recordType, recordType),
          eq(financialOperationLinks.recordId, normalizedRecordId),
        ))
        .limit(1);
      if (existing) {
        if (existing.operationId !== operationId) {
          throw new FinancialOperationError("Record is already linked to another operation", "CONFLICT");
        }
        return existing;
      }

      await setEventContext(tx, actor, undefined);
      const [link] = await tx
        .insert(financialOperationLinks)
        .values({ operationId, recordType, recordId: normalizedRecordId })
        .onConflictDoNothing({
          target: [financialOperationLinks.recordType, financialOperationLinks.recordId],
        })
        .returning();
      if (link) return link;

      const [concurrentLink] = await tx
        .select()
        .from(financialOperationLinks)
        .where(and(
          eq(financialOperationLinks.recordType, recordType),
          eq(financialOperationLinks.recordId, normalizedRecordId),
        ))
        .limit(1);
      if (concurrentLink?.operationId === operationId) return concurrentLink;
      throw new FinancialOperationError("Record was concurrently linked to another operation", "CONFLICT");
    });
  }

  async getOperation(operationId: string) {
    const [operation] = await db
      .select()
      .from(financialOperations)
      .where(eq(financialOperations.id, operationId))
      .limit(1);
    return operation ?? null;
  }

  async getOperationByIdempotencyKey(idempotencyKey: string) {
    const normalizedKey = requiredText(idempotencyKey, "idempotencyKey", 200);
    const [operation] = await db
      .select()
      .from(financialOperations)
      .where(eq(financialOperations.idempotencyKey, normalizedKey))
      .limit(1);
    return operation ?? null;
  }

  async getOperationEvents(operationId: string) {
    return db
      .select()
      .from(financialOperationEvents)
      .where(eq(financialOperationEvents.operationId, operationId))
      .orderBy(financialOperationEvents.id);
  }
}

export const financialOperationService = new FinancialOperationService();
