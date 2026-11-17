import { sql } from "drizzle-orm";
import { db } from "../db";
import { financialReconciliationService } from "./financialReconciliationService";

interface UnconfirmedProposalCompletionRow extends Record<string, unknown> {
  executionId: string;
  proposalId: string;
  daoId: string;
  executionType: string;
  status: string;
  externalReference: string | null;
  externalTxHash: string | null;
  executionResult: unknown;
}

interface ProposalChainRecordMismatchRow extends Record<string, unknown> {
  multisigTransactionId: string;
  daoId: string;
  proposalId: string | null;
  multisigStatus: string;
  submittedTxHash: string | null;
  executedAt: Date | null;
  metadata: Record<string, unknown> | null;
  executionId: string | null;
  executionReference: string | null;
  executionStatus: string | null;
  executionTxHash: string | null;
}

export interface ProposalExecutionReconciliationSummary {
  r08: number;
  r09: number;
}

const FINDING_BATCH_SIZE = 100;
const PROPOSAL_EXECUTION_RECONCILIATION_GRACE_MINUTES = 30;

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

function isUnconfirmedProposalCompletionRow(
  row: Record<string, unknown>,
): row is UnconfirmedProposalCompletionRow {
  return typeof row.executionId === "string" &&
    typeof row.proposalId === "string" &&
    typeof row.daoId === "string" &&
    typeof row.executionType === "string" &&
    typeof row.status === "string" &&
    (typeof row.externalReference === "string" || row.externalReference === null) &&
    (typeof row.externalTxHash === "string" || row.externalTxHash === null);
}

function isProposalChainRecordMismatchRow(
  row: Record<string, unknown>,
): row is ProposalChainRecordMismatchRow {
  return typeof row.multisigTransactionId === "string" &&
    typeof row.daoId === "string" &&
    (typeof row.proposalId === "string" || row.proposalId === null) &&
    typeof row.multisigStatus === "string" &&
    (typeof row.submittedTxHash === "string" || row.submittedTxHash === null) &&
    (row.executedAt instanceof Date || row.executedAt === null) &&
    (row.metadata === null || (typeof row.metadata === "object" && !Array.isArray(row.metadata))) &&
    (typeof row.executionId === "string" || row.executionId === null) &&
    (typeof row.executionReference === "string" || row.executionReference === null) &&
    (typeof row.executionStatus === "string" || row.executionStatus === null) &&
    (typeof row.executionTxHash === "string" || row.executionTxHash === null);
}

export async function reconcileProposalExecutionFindings(
  runId: string,
): Promise<ProposalExecutionReconciliationSummary> {
  const [unconfirmedCompletions, databaseChainMismatches] = await Promise.all([
    db.execute(sql`
      SELECT
        execution.id AS "executionId",
        execution.proposal_id AS "proposalId",
        execution.dao_id AS "daoId",
        execution.execution_type AS "executionType",
        execution.status,
        execution.external_reference AS "externalReference",
        execution.external_tx_hash AS "externalTxHash",
        execution.execution_result AS "executionResult"
      FROM public.proposal_execution_queue AS execution
      WHERE execution.execution_type IN ('treasury_transfer', 'vault_operation', 'disbursement')
        AND execution.status = 'completed'
        AND execution.updated_at < now() - make_interval(
          mins => ${PROPOSAL_EXECUTION_RECONCILIATION_GRACE_MINUTES}
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.treasury_multisig_transactions AS multisig
          WHERE multisig.dao_id = execution.dao_id
            AND multisig.metadata->>'proposalId' = execution.proposal_id::text
            AND multisig.status = 'executed'
            AND multisig.executed_at IS NOT NULL
            AND multisig.metadata->>'executedOnChain' = 'true'
            AND NULLIF(multisig.metadata->>'executionTxHash', '') IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.financial_reconciliation_findings AS finding
          WHERE finding.finding_key = 'R08:proposal-execution:' || execution.id
            AND finding.status IN ('open', 'acknowledged', 'reopened')
        )
      ORDER BY execution.updated_at ASC
      LIMIT ${FINDING_BATCH_SIZE}
    `),
    db.execute(sql`
      SELECT
        multisig.id AS "multisigTransactionId",
        multisig.dao_id AS "daoId",
        multisig.metadata->>'proposalId' AS "proposalId",
        multisig.status AS "multisigStatus",
        multisig.submitted_tx_hash AS "submittedTxHash",
        multisig.executed_at AS "executedAt",
        multisig.metadata,
        execution.id AS "executionId",
        execution.external_reference AS "executionReference",
        execution.status AS "executionStatus",
        execution.external_tx_hash AS "executionTxHash"
      FROM public.treasury_multisig_transactions AS multisig
      LEFT JOIN LATERAL (
        SELECT
          queue.id,
          queue.external_reference,
          queue.status,
          queue.external_tx_hash
        FROM public.proposal_execution_queue AS queue
        WHERE queue.dao_id = multisig.dao_id
          AND queue.proposal_id::text = multisig.metadata->>'proposalId'
        ORDER BY queue.updated_at DESC, queue.id DESC
        LIMIT 1
      ) AS execution ON TRUE
      WHERE multisig.status = 'executed'
        AND (
          multisig.metadata->>'executedOnChain' IS DISTINCT FROM 'true'
          OR NULLIF(multisig.metadata->>'executionTxHash', '') IS NULL
          OR multisig.executed_at IS NULL
          OR execution.id IS NULL
          OR execution.external_reference IS DISTINCT FROM multisig.id::text
          OR execution.status <> 'completed'
          OR (
            execution.external_tx_hash IS DISTINCT FROM multisig.metadata->>'executionTxHash'
            AND execution.external_tx_hash IS DISTINCT FROM multisig.submitted_tx_hash
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.financial_reconciliation_findings AS finding
          WHERE finding.finding_key = 'R09:multisig-transaction:' || multisig.id
            AND finding.status IN ('open', 'acknowledged', 'reopened')
        )
      ORDER BY multisig.updated_at ASC
      LIMIT ${FINDING_BATCH_SIZE}
    `),
  ]);

  const summary: ProposalExecutionReconciliationSummary = { r08: 0, r09: 0 };

  for (const execution of parseRows(
    unconfirmedCompletions.rows,
    isUnconfirmedProposalCompletionRow,
    "R08",
  )) {
    await financialReconciliationService.recordFinding({
      findingKey: `R08:proposal-execution:${execution.executionId}`,
      domain: "proposals",
      ruleId: "R08",
      severity: "critical",
      operationId: undefined,
      expectedState: { confirmedPayoutEvidence: true },
      observedState: {
        executionId: execution.executionId,
        proposalId: execution.proposalId,
        daoId: execution.daoId,
        executionType: execution.executionType,
        executionStatus: execution.status,
        externalReference: execution.externalReference,
        externalTxHash: execution.externalTxHash,
        executionResult: execution.executionResult,
        confirmedMultisigExecutionFound: false,
      },
      evidenceReferences: [
        `proposal-execution:${execution.executionId}`,
        `proposal:${execution.proposalId}`,
      ],
      runId,
    });
    summary.r08 += 1;
  }

  for (const mismatch of parseRows(
    databaseChainMismatches.rows,
    isProposalChainRecordMismatchRow,
    "R09",
  )) {
    await financialReconciliationService.recordFinding({
      findingKey: `R09:multisig-transaction:${mismatch.multisigTransactionId}`,
      domain: "blockchain",
      ruleId: "R09",
      severity: "high",
      expectedState: {
        databaseQueueLinkedAndCompleted: true,
        executionHashMatches: true,
      },
      observedState: {
        multisigTransactionId: mismatch.multisigTransactionId,
        daoId: mismatch.daoId,
        proposalId: mismatch.proposalId,
        multisigStatus: mismatch.multisigStatus,
        submittedTxHash: mismatch.submittedTxHash,
        executedAt: mismatch.executedAt,
        chainExecutionMetadata: mismatch.metadata,
        executionId: mismatch.executionId,
        executionReference: mismatch.executionReference,
        executionStatus: mismatch.executionStatus,
        executionTxHash: mismatch.executionTxHash,
      },
      evidenceReferences: [
        `treasury-multisig-transaction:${mismatch.multisigTransactionId}`,
        ...(mismatch.proposalId ? [`proposal:${mismatch.proposalId}`] : []),
        ...(mismatch.executionId ? [`proposal-execution:${mismatch.executionId}`] : []),
        ...(mismatch.submittedTxHash ? [`chain-transaction:${mismatch.submittedTxHash}`] : []),
      ],
      runId,
    });
    summary.r09 += 1;
  }

  return summary;
}

export async function recordUnmatchedOnchainProposalEvent(input: {
  eventType: "ProposalCreated" | "ProposalExecuted";
  contractAddress: string;
  proposalId: string;
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
  reason: string;
}): Promise<void> {
  const eventKey = [
    input.eventType,
    input.contractAddress.toLowerCase(),
    input.transactionHash.toLowerCase(),
    input.logIndex,
  ].join(":");
  await financialReconciliationService.recordFinding({
    findingKey: `R09:onchain-event:${eventKey}`,
    domain: "blockchain",
    ruleId: "R09",
    severity: "high",
    expectedState: { matchingDatabaseExecutionRecord: true },
    observedState: {
      eventType: input.eventType,
      contractAddress: input.contractAddress,
      proposalId: input.proposalId,
      transactionHash: input.transactionHash,
      blockNumber: input.blockNumber,
      blockHash: input.blockHash,
      logIndex: input.logIndex,
      mismatchReason: input.reason,
    },
    evidenceReferences: [
      `chain-transaction:${input.transactionHash}`,
      `chain-block:${input.blockHash}`,
      `treasury-contract:${input.contractAddress}`,
      `onchain-proposal:${input.proposalId}`,
    ],
  });
}
