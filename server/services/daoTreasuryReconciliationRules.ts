import { sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../db";
import { financialReconciliationService } from "./financialReconciliationService";
import { hasStableInflowRiskFlagsCleared } from "../types/stableInflow";
import type { ReconciliationResult } from "./treasuryReconciliationJob";

interface UnapprovedContributionCreditRow extends Record<string, unknown> {
  walletTransactionId: string;
  daoId: string;
  amount: string;
  currency: string | null;
  contributionId: string | null;
  contributionStatus: string | null;
  approvalStatus: string | null;
  requiredApprovals: number | null;
  recordedApprovals: number | null;
  verifiedApprovals: number;
  requiresApproval: boolean;
}

interface UnsupportedTreasuryDepositRow extends Record<string, unknown> {
  walletTransactionId: string;
  daoId: string;
  amount: string;
  currency: string | null;
  walletAddress: string;
  walletChainId: number | null;
  walletTokenAddress: string | null;
  transactionHash: string | null;
  stableInflowEventId: string | null;
  evidence: Record<string, unknown> | null;
  inflowStatus: string | null;
  confirmationState: string | null;
  tokenSymbol: string | null;
  normalizedTokenAmount: string | null;
  txHash: string | null;
  inflowTokenAddress: string | null;
  toAddress: string | null;
  inflowChainId: number | null;
  riskFlags: unknown;
  configuredTreasuryPosition: boolean;
}

export interface DaoTreasuryReconciliationSummary {
  r05: number;
  r07: number;
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

function isUnapprovedContributionCreditRow(
  row: Record<string, unknown>,
): row is UnapprovedContributionCreditRow {
  return typeof row.walletTransactionId === "string" &&
    typeof row.daoId === "string" &&
    typeof row.amount === "string" &&
    (typeof row.currency === "string" || row.currency === null) &&
    (typeof row.contributionId === "string" || row.contributionId === null) &&
    (typeof row.contributionStatus === "string" || row.contributionStatus === null) &&
    (typeof row.approvalStatus === "string" || row.approvalStatus === null) &&
    (typeof row.requiredApprovals === "number" || row.requiredApprovals === null) &&
    (typeof row.recordedApprovals === "number" || row.recordedApprovals === null) &&
    typeof row.verifiedApprovals === "number" &&
    typeof row.requiresApproval === "boolean";
}

function isUnsupportedTreasuryDepositRow(
  row: Record<string, unknown>,
): row is UnsupportedTreasuryDepositRow {
  return typeof row.walletTransactionId === "string" &&
    typeof row.daoId === "string" &&
    typeof row.amount === "string" &&
    (typeof row.currency === "string" || row.currency === null) &&
    typeof row.walletAddress === "string" &&
    (typeof row.walletChainId === "number" || row.walletChainId === null) &&
    (typeof row.walletTokenAddress === "string" || row.walletTokenAddress === null) &&
    (typeof row.transactionHash === "string" || row.transactionHash === null) &&
    (typeof row.stableInflowEventId === "string" || row.stableInflowEventId === null) &&
    (row.evidence === null || (typeof row.evidence === "object" && !Array.isArray(row.evidence))) &&
    (typeof row.inflowStatus === "string" || row.inflowStatus === null) &&
    (typeof row.confirmationState === "string" || row.confirmationState === null) &&
    (typeof row.tokenSymbol === "string" || row.tokenSymbol === null) &&
    (typeof row.normalizedTokenAmount === "string" || row.normalizedTokenAmount === null) &&
    (typeof row.txHash === "string" || row.txHash === null) &&
    (typeof row.inflowTokenAddress === "string" || row.inflowTokenAddress === null) &&
    (typeof row.toAddress === "string" || row.toAddress === null) &&
    (typeof row.inflowChainId === "number" || row.inflowChainId === null) &&
    typeof row.configuredTreasuryPosition === "boolean";
}

export async function reconcileDaoContributionAndDepositFindings(
  runId: string,
): Promise<DaoTreasuryReconciliationSummary> {
  const [unapprovedCredits, unsupportedDeposits] = await Promise.all([
    db.execute(sql`
      SELECT
        credit.id AS "walletTransactionId",
        credit.dao_id AS "daoId",
        credit.amount::text AS amount,
        credit.currency,
        contribution.id AS "contributionId",
        contribution.status AS "contributionStatus",
        contribution.approval_status AS "approvalStatus",
        contribution.required_approvals AS "requiredApprovals",
        contribution.approvals_count AS "recordedApprovals",
        COUNT(approval.id) FILTER (WHERE approval.approved)::int AS "verifiedApprovals",
        COALESCE(
          contribution.currency = 'KES' OR COALESCE(contribution_type.requires_approval, FALSE),
          contribution.id IS NULL
        ) AS "requiresApproval"
      FROM public.wallet_transactions AS credit
      LEFT JOIN public.dao_contributions AS contribution
        ON contribution.id::text = credit.metadata->>'contributionId'
      LEFT JOIN public.dao_contribution_types AS contribution_type
        ON contribution_type.id = contribution.contribution_type_id
      LEFT JOIN public.dao_contribution_approvals AS approval
        ON approval.contribution_id = contribution.id
      WHERE credit.dao_id IS NOT NULL
        AND credit.type = 'contribution'
        AND credit.status = 'completed'
      GROUP BY
        credit.id,
        credit.dao_id,
        credit.amount,
        credit.currency,
        contribution.id,
        contribution.status,
        contribution.approval_status,
        contribution.required_approvals,
        contribution.approvals_count,
        contribution.currency,
        contribution_type.requires_approval,
        contribution_type.approvals_needed
      HAVING (
        contribution.id IS NULL
        OR (
          (contribution.currency = 'KES' OR COALESCE(contribution_type.requires_approval, FALSE))
          AND COUNT(approval.id) FILTER (WHERE approval.approved)
            < GREATEST(1, COALESCE(contribution.required_approvals, contribution_type.approvals_needed, 1))
        )
      )
        AND NOT EXISTS (
          SELECT 1
          FROM public.financial_reconciliation_findings AS finding
          WHERE finding.finding_key = 'R05:treasury-credit:' || credit.id
            AND finding.status IN ('open', 'acknowledged', 'reopened')
        )
      ORDER BY credit.created_at ASC
      LIMIT ${FINDING_BATCH_SIZE}
    `),
    db.execute(sql`
      SELECT
        credit.id AS "walletTransactionId",
        credit.dao_id AS "daoId",
        credit.amount::text AS amount,
        credit.currency,
        credit.wallet_address AS "walletAddress",
        credit.chain_id AS "walletChainId",
        credit.token_address AS "walletTokenAddress",
        credit.transaction_hash AS "transactionHash",
        credit.stable_inflow_event_id AS "stableInflowEventId",
        credit.metadata->'evidence' AS evidence,
        inflow.status AS "inflowStatus",
        inflow.confirmation_state AS "confirmationState",
        inflow.token_symbol AS "tokenSymbol",
        inflow.normalized_token_amount::text AS "normalizedTokenAmount",
        inflow.tx_hash AS "txHash",
        inflow.token_address AS "inflowTokenAddress",
        inflow.to_address AS "toAddress",
        inflow.chain_id AS "inflowChainId",
        inflow.risk_flags AS "riskFlags",
        EXISTS (
          SELECT 1
          FROM public.treasury_positions AS position
          WHERE position.dao_id = credit.dao_id
            AND position.chain_id = inflow.chain_id
            AND lower(position.contract_address) = lower(inflow.token_address)
            AND lower(position.holder_address) = lower(inflow.to_address)
        ) AS "configuredTreasuryPosition"
      FROM public.wallet_transactions AS credit
      LEFT JOIN public.stable_inflow_events AS inflow
        ON inflow.id = credit.stable_inflow_event_id
      WHERE credit.dao_id IS NOT NULL
        AND credit.type = 'deposit'
        AND credit.status = 'completed'
        AND NOT (
          (
            credit.metadata->'evidence'->>'kind' = 'internal_adjustment'
            AND length(trim(COALESCE(credit.metadata->'evidence'->>'adjustmentReference', ''))) > 0
            AND length(trim(COALESCE(credit.metadata->'evidence'->>'reason', ''))) > 0
          )
          OR (
            inflow.id IS NOT NULL
            AND credit.metadata->'evidence'->>'kind' = 'on_chain'
            AND credit.metadata->'evidence'->>'stableInflowEventId' = inflow.id::text
            AND inflow.status = 'credited'
            AND inflow.confirmation_state = 'confirmed'
            AND lower(inflow.token_symbol) = lower(credit.currency)
            AND inflow.normalized_token_amount::numeric = credit.amount::numeric
            AND inflow.tx_hash = credit.transaction_hash
            AND lower(inflow.to_address) = lower(credit.wallet_address)
            AND inflow.chain_id = credit.chain_id
            AND lower(inflow.token_address) = lower(credit.token_address)
            AND COALESCE(inflow.risk_flags->>'depegDetected', 'true') = 'false'
            AND COALESCE(inflow.risk_flags->>'delayedConfirmation', 'true') = 'false'
            AND COALESCE(inflow.risk_flags->>'lowLiquidity', 'true') = 'false'
            AND COALESCE(inflow.risk_flags->>'highRiskScore', 'true') = 'false'
            AND EXISTS (
              SELECT 1
              FROM public.treasury_positions AS position
              WHERE position.dao_id = credit.dao_id
                AND position.chain_id = inflow.chain_id
                AND lower(position.contract_address) = lower(inflow.token_address)
                AND lower(position.holder_address) = lower(inflow.to_address)
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.financial_reconciliation_findings AS finding
          WHERE finding.finding_key = 'R07:treasury-deposit:' || credit.id
            AND finding.status IN ('open', 'acknowledged', 'reopened')
        )
      ORDER BY credit.created_at ASC
      LIMIT ${FINDING_BATCH_SIZE}
    `),
  ]);

  const summary: DaoTreasuryReconciliationSummary = { r05: 0, r07: 0 };

  for (const credit of parseRows(
    unapprovedCredits.rows,
    isUnapprovedContributionCreditRow,
    "R05",
  )) {
    await financialReconciliationService.recordFinding({
      findingKey: `R05:treasury-credit:${credit.walletTransactionId}`,
      domain: "dao",
      ruleId: "R05",
      severity: "high",
      expectedState: {
        requiredApprovalSatisfied: true,
        minimumApprovals: credit.requiresApproval ? credit.requiredApprovals ?? 1 : 0,
      },
      observedState: {
        walletTransactionId: credit.walletTransactionId,
        daoId: credit.daoId,
        amount: credit.amount,
        currency: credit.currency,
        contributionId: credit.contributionId,
        contributionStatus: credit.contributionStatus,
        approvalStatus: credit.approvalStatus,
        requiredApprovals: credit.requiredApprovals,
        recordedApprovals: credit.recordedApprovals,
        verifiedApprovals: credit.verifiedApprovals,
        requiresApproval: credit.requiresApproval,
      },
      evidenceReferences: [
        `treasury-credit:${credit.walletTransactionId}`,
        ...(credit.contributionId ? [`dao-contribution:${credit.contributionId}`] : []),
      ],
      runId,
    });
    summary.r05 += 1;
  }

  for (const deposit of parseRows(
    unsupportedDeposits.rows,
    isUnsupportedTreasuryDepositRow,
    "R07",
  )) {
    const internalAdjustment = deposit.evidence?.kind === "internal_adjustment" &&
      typeof deposit.evidence.adjustmentReference === "string" &&
      deposit.evidence.adjustmentReference.trim().length > 0 &&
      typeof deposit.evidence.reason === "string" &&
      deposit.evidence.reason.trim().length > 0;
    const onChainEvidence = deposit.evidence?.kind === "on_chain" &&
      deposit.evidence.stableInflowEventId === deposit.stableInflowEventId &&
      deposit.inflowStatus === "credited" &&
      deposit.confirmationState === "confirmed" &&
      deposit.tokenSymbol?.toLowerCase() === deposit.currency?.toLowerCase() &&
      deposit.normalizedTokenAmount !== null &&
      new Decimal(deposit.normalizedTokenAmount).eq(deposit.amount) &&
      deposit.txHash === deposit.transactionHash &&
      deposit.toAddress?.toLowerCase() === deposit.walletAddress.toLowerCase() &&
      deposit.inflowChainId === deposit.walletChainId &&
      deposit.inflowTokenAddress?.toLowerCase() === deposit.walletTokenAddress?.toLowerCase();
    const riskFlagsCleared = hasStableInflowRiskFlagsCleared(deposit.riskFlags);
    const supportedOnChainEvidence = onChainEvidence &&
      deposit.configuredTreasuryPosition &&
      riskFlagsCleared;

    await financialReconciliationService.recordFinding({
      findingKey: `R07:treasury-deposit:${deposit.walletTransactionId}`,
      domain: "treasury",
      ruleId: "R07",
      severity: "high",
      expectedState: { supportingInflowOrDocumentedAdjustment: true },
      observedState: {
        walletTransactionId: deposit.walletTransactionId,
        daoId: deposit.daoId,
        amount: deposit.amount,
        currency: deposit.currency,
        transactionHash: deposit.transactionHash,
        stableInflowEventId: deposit.stableInflowEventId,
        walletAddress: deposit.walletAddress,
        walletChainId: deposit.walletChainId,
        walletTokenAddress: deposit.walletTokenAddress,
        evidence: deposit.evidence,
        inflowStatus: deposit.inflowStatus,
        confirmationState: deposit.confirmationState,
        inflowChainId: deposit.inflowChainId,
        inflowTokenAddress: deposit.inflowTokenAddress,
        riskFlags: deposit.riskFlags,
        configuredTreasuryPosition: deposit.configuredTreasuryPosition,
        documentedAdjustment: internalAdjustment,
        verifiedOnChainInflow: supportedOnChainEvidence,
      },
      evidenceReferences: [
        `treasury-deposit:${deposit.walletTransactionId}`,
        ...(deposit.stableInflowEventId ? [`stable-inflow:${deposit.stableInflowEventId}`] : []),
      ],
      runId,
    });
    summary.r07 += 1;
  }

  return summary;
}

export async function recordTreasuryBalanceFinding(
  result: ReconciliationResult,
  runId: string,
): Promise<boolean> {
  if (
    result.type !== "dao_treasury" ||
    (result.status !== "warning" && result.status !== "critical") ||
    !result.assetIdentity
  ) {
    return false;
  }

  const { chain, tokenAddress, holderAddress, symbol, blockNumber, blockHash } = result.assetIdentity;
  const assetKey = tokenAddress?.toLowerCase() || symbol.toLowerCase();
  await financialReconciliationService.recordFinding({
    findingKey: `R06:dao:${result.entityId}:${chain}:${assetKey}`,
    domain: "treasury",
    ruleId: "R06",
    severity: result.status === "critical" ? "critical" : "high",
    expectedState: { indexedAssetBalance: result.computedValue },
    observedState: {
      independentlyObservedBalance: result.onChainValue,
      discrepancy: result.discrepancy,
      discrepancyPercent: result.discrepancyPercent,
      daoId: result.entityId,
      chain,
      tokenAddress,
      holderAddress,
      symbol,
      blockNumber,
      blockHash,
      onChainCheckedAt: result.lastOnChainCheck,
    },
    evidenceReferences: [
      `dao-treasury:${result.entityId}`,
      `chain:${chain}:asset:${assetKey}`,
      ...(blockHash ? [`block:${chain}:${blockHash}`] : []),
    ],
    runId,
  });
  return true;
}
