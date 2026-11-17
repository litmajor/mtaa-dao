import { sql } from "drizzle-orm";
import { db } from "../db";
import { financialReconciliationService } from "./financialReconciliationService";

interface ProviderPaidPaymentRow extends Record<string, unknown> {
  id: string;
  reference: string;
  provider: string;
  providerReference: string | null;
  userId: string;
  amount: string;
  currency: string;
  status: string;
  updatedAt: Date | null;
}

interface UnverifiedWalletCreditRow extends Record<string, unknown> {
  id: string;
  accountId: string;
  reference: string;
  amount: string;
  currency: string;
  paymentId: string | null;
  paymentStatus: string | null;
  settlementVerified: boolean;
}

interface DuplicateProviderCreditRow extends Record<string, unknown> {
  provider: string;
  providerReference: string;
  paymentIds: string[];
  accountTransactionIds: string[];
  creditCount: number;
}

interface AccountJournalMismatchRow extends Record<string, unknown> {
  accountId: string;
  userId: string;
  currency: string;
  accountBalance: string;
  journalBalance: string;
  lastJournalEntryId: string | null;
}

export interface PaymentWalletReconciliationSummary {
  r01: number;
  r02: number;
  r03: number;
  r04: number;
}

const FINDING_BATCH_SIZE = 100;

function parseRows<T extends Record<string, unknown>>(
  rows: Record<string, unknown>[],
  isExpectedRow: (row: Record<string, unknown>) => row is T,
  ruleId: string,
): T[] {
  return rows.map((row) => {
    if (!isExpectedRow(row)) {
      throw new Error(`${ruleId} reconciliation returned a row with an unexpected shape`);
    }
    return row;
  });
}

function isProviderPaidPaymentRow(row: Record<string, unknown>): row is ProviderPaidPaymentRow {
  return typeof row.id === "string" &&
    typeof row.reference === "string" &&
    typeof row.provider === "string" &&
    (typeof row.providerReference === "string" || row.providerReference === null) &&
    typeof row.userId === "string" &&
    typeof row.amount === "string" &&
    typeof row.currency === "string" &&
    typeof row.status === "string" &&
    (row.updatedAt instanceof Date || row.updatedAt === null);
}

function isUnverifiedWalletCreditRow(row: Record<string, unknown>): row is UnverifiedWalletCreditRow {
  return typeof row.id === "string" &&
    typeof row.accountId === "string" &&
    typeof row.reference === "string" &&
    typeof row.amount === "string" &&
    typeof row.currency === "string" &&
    (typeof row.paymentId === "string" || row.paymentId === null) &&
    (typeof row.paymentStatus === "string" || row.paymentStatus === null) &&
    typeof row.settlementVerified === "boolean";
}

function isDuplicateProviderCreditRow(row: Record<string, unknown>): row is DuplicateProviderCreditRow {
  return typeof row.provider === "string" &&
    typeof row.providerReference === "string" &&
    Array.isArray(row.paymentIds) &&
    row.paymentIds.every((id) => typeof id === "string") &&
    Array.isArray(row.accountTransactionIds) &&
    row.accountTransactionIds.every((id) => typeof id === "string") &&
    typeof row.creditCount === "number";
}

function isAccountJournalMismatchRow(row: Record<string, unknown>): row is AccountJournalMismatchRow {
  return typeof row.accountId === "string" &&
    typeof row.userId === "string" &&
    typeof row.currency === "string" &&
    typeof row.accountBalance === "string" &&
    typeof row.journalBalance === "string" &&
    (typeof row.lastJournalEntryId === "string" || row.lastJournalEntryId === null);
}

export async function reconcilePaymentWalletFindings(
  runId: string,
): Promise<PaymentWalletReconciliationSummary> {
  const [uncreditedPayments, unverifiedCredits, duplicateCredits, journalMismatches] =
    await Promise.all([
      db.execute(sql`
        SELECT
          payment.id,
          payment.reference,
          payment.provider,
          payment.provider_reference AS "providerReference",
          payment.user_id AS "userId",
          payment.amount,
          payment.currency,
          payment.status,
          payment.updated_at AS "updatedAt"
        FROM public.payment_transactions AS payment
        WHERE payment.status IN ('webhook_received', 'verified', 'settling', 'completed')
          AND (
            payment.metadata->>'settlementEvidenceVerified' = 'true'
            OR payment.metadata->>'gatewayVerified' = 'true'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.account_transactions AS credit
            WHERE credit.reference = 'payment:' || payment.id
              AND credit.transaction_type = 'deposit'
              AND credit.status = 'completed'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.financial_reconciliation_findings AS finding
            WHERE finding.finding_key = 'R01:payment:' || payment.id
              AND finding.status IN ('open', 'acknowledged', 'reopened')
          )
        ORDER BY payment.updated_at ASC NULLS FIRST
        LIMIT ${FINDING_BATCH_SIZE}
      `),
      db.execute(sql`
        SELECT
          credit.id,
          credit.account_id AS "accountId",
          credit.reference,
          credit.amount::text AS amount,
          credit.currency,
          payment.id AS "paymentId",
          payment.status AS "paymentStatus",
          COALESCE(
            payment.metadata->>'settlementEvidenceVerified' = 'true'
            OR payment.metadata->>'gatewayVerified' = 'true',
            FALSE
          ) AS "settlementVerified"
        FROM public.account_transactions AS credit
        LEFT JOIN public.payment_transactions AS payment
          ON credit.reference = 'payment:' || payment.id
        WHERE credit.transaction_type = 'deposit'
          AND credit.status = 'completed'
          AND credit.reference LIKE 'payment:%'
          AND (
            payment.id IS NULL
            OR payment.status <> 'completed'
            OR NOT (
              COALESCE(payment.metadata->>'settlementEvidenceVerified' = 'true', FALSE)
              OR COALESCE(payment.metadata->>'gatewayVerified' = 'true', FALSE)
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.financial_reconciliation_findings AS finding
            WHERE finding.finding_key = 'R02:account-transaction:' || credit.id
              AND finding.status IN ('open', 'acknowledged', 'reopened')
          )
        ORDER BY credit.created_at ASC
        LIMIT ${FINDING_BATCH_SIZE}
      `),
      db.execute(sql`
        SELECT
          payment.provider,
          payment.provider_reference AS "providerReference",
          ARRAY_AGG(DISTINCT payment.id) AS "paymentIds",
          ARRAY_AGG(DISTINCT credit.id::text) AS "accountTransactionIds",
          COUNT(DISTINCT credit.id)::int AS "creditCount"
        FROM public.payment_transactions AS payment
        JOIN public.account_transactions AS credit
          ON credit.reference = 'payment:' || payment.id
         AND credit.transaction_type = 'deposit'
         AND credit.status = 'completed'
        WHERE payment.provider_reference IS NOT NULL
        GROUP BY payment.provider, payment.provider_reference
        HAVING COUNT(DISTINCT credit.id) > 1
          AND NOT EXISTS (
            SELECT 1
            FROM public.financial_reconciliation_findings AS finding
            WHERE finding.finding_key =
              'R03:' || payment.provider || ':' || payment.provider_reference
              AND finding.status IN ('open', 'acknowledged', 'reopened')
          )
        ORDER BY COUNT(DISTINCT credit.id) DESC
        LIMIT ${FINDING_BATCH_SIZE}
      `),
      db.execute(sql`
        SELECT
          account.id AS "accountId",
          account.user_id AS "userId",
          account.currency,
          account.balance::text AS "accountBalance",
          COALESCE(latest.balance_after, 0)::text AS "journalBalance",
          latest.id::text AS "lastJournalEntryId"
        FROM public.accounts AS account
        LEFT JOIN LATERAL (
          SELECT entry.id, entry.balance_after
          FROM public.account_transactions AS entry
          WHERE entry.account_id = account.id
            AND entry.status = 'completed'
          ORDER BY entry.created_at DESC, entry.id DESC
          LIMIT 1
        ) AS latest ON TRUE
        WHERE account.balance::numeric IS DISTINCT FROM COALESCE(latest.balance_after, 0)::numeric
          AND NOT EXISTS (
            SELECT 1
            FROM public.financial_reconciliation_findings AS finding
            WHERE finding.finding_key = 'R04:account:' || account.id
              AND finding.status IN ('open', 'acknowledged', 'reopened')
          )
        ORDER BY account.updated_at ASC
        LIMIT ${FINDING_BATCH_SIZE}
      `),
    ]);

  const summary: PaymentWalletReconciliationSummary = { r01: 0, r02: 0, r03: 0, r04: 0 };

  for (const payment of parseRows(
    uncreditedPayments.rows,
    isProviderPaidPaymentRow,
    "R01",
  )) {
    await financialReconciliationService.recordFinding({
      findingKey: `R01:payment:${payment.id}`,
      domain: "payments",
      ruleId: "R01",
      severity: "high",
      expectedState: { paymentCredited: true },
      observedState: {
        paymentId: payment.id,
        reference: payment.reference,
        provider: payment.provider,
        providerReference: payment.providerReference,
        userId: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
        paymentStatus: payment.status,
        updatedAt: payment.updatedAt,
        walletCreditFound: false,
      },
      evidenceReferences: [
        `payment:${payment.id}`,
        ...(payment.providerReference ? [`provider:${payment.provider}:${payment.providerReference}`] : []),
      ],
      runId,
    });
    summary.r01 += 1;
  }

  for (const credit of parseRows(
    unverifiedCredits.rows,
    isUnverifiedWalletCreditRow,
    "R02",
  )) {
    await financialReconciliationService.recordFinding({
      findingKey: `R02:account-transaction:${credit.id}`,
      domain: "wallets",
      ruleId: "R02",
      severity: "high",
      expectedState: { verifiedSettlement: true },
      observedState: {
        accountTransactionId: credit.id,
        accountId: credit.accountId,
        reference: credit.reference,
        amount: credit.amount,
        currency: credit.currency,
        paymentId: credit.paymentId,
        paymentStatus: credit.paymentStatus,
        settlementVerified: credit.settlementVerified,
      },
      evidenceReferences: [
        `account-transaction:${credit.id}`,
        ...(credit.paymentId ? [`payment:${credit.paymentId}`] : []),
      ],
      runId,
    });
    summary.r02 += 1;
  }

  for (const duplicate of parseRows(
    duplicateCredits.rows,
    isDuplicateProviderCreditRow,
    "R03",
  )) {
    await financialReconciliationService.recordFinding({
      findingKey: `R03:${duplicate.provider}:${duplicate.providerReference}`,
      domain: "payments",
      ruleId: "R03",
      severity: "critical",
      expectedState: { creditCount: 1 },
      observedState: {
        provider: duplicate.provider,
        providerReference: duplicate.providerReference,
        creditCount: duplicate.creditCount,
        paymentIds: duplicate.paymentIds,
        accountTransactionIds: duplicate.accountTransactionIds,
      },
      evidenceReferences: [
        `provider:${duplicate.provider}:${duplicate.providerReference}`,
        ...duplicate.paymentIds.map((id) => `payment:${id}`),
        ...duplicate.accountTransactionIds.map((id) => `account-transaction:${id}`),
      ],
      runId,
    });
    summary.r03 += 1;
  }

  for (const mismatch of parseRows(
    journalMismatches.rows,
    isAccountJournalMismatchRow,
    "R04",
  )) {
    await financialReconciliationService.recordFinding({
      findingKey: `R04:account:${mismatch.accountId}`,
      domain: "wallets",
      ruleId: "R04",
      severity: "high",
      expectedState: { balanceMatchesLatestJournal: true, balance: mismatch.journalBalance },
      observedState: {
        accountId: mismatch.accountId,
        userId: mismatch.userId,
        currency: mismatch.currency,
        accountBalance: mismatch.accountBalance,
        journalBalance: mismatch.journalBalance,
        lastJournalEntryId: mismatch.lastJournalEntryId,
      },
      evidenceReferences: [
        `account:${mismatch.accountId}`,
        ...(mismatch.lastJournalEntryId ? [`account-transaction:${mismatch.lastJournalEntryId}`] : []),
      ],
      runId,
    });
    summary.r04 += 1;
  }

  return summary;
}
