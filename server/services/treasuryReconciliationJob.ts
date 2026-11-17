/**
 * Treasury reconciliation job - continuous on-chain validation
 * 
 * Responsible for:
 * - Attempting configured DAO treasury and vault chain comparisons
 * - Recording configured reconciliation results for compliance and debugging
 * - Alerting on verified critical state mismatches
 */

import { db } from '../storage';
import {
  daos,
  vaults,
  treasuryPositions,
  vaultTokenHoldings,
  treasuryReconciliationAudits,
} from '@shared/schema';
import { eq, and, gt, sql, desc } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { logger } from '../utils/logger';
import { chainBalanceReader } from './chainBalanceReader';
import { financialReconciliationService } from './financialReconciliationService';
import {
  reconcileDaoContributionAndDepositFindings,
  recordTreasuryBalanceFinding,
} from './daoTreasuryReconciliationRules';
import { reconcileProposalExecutionFindings } from './proposalExecutionReconciliationRules';

export interface ReconciliationResult {
  type: 'dao_treasury' | 'vault_balance' | 'multisig_transactions';
  entityId: string;
  computedValue: string;
  onChainValue: string;
  discrepancy: string;
  discrepancyPercent: number;
  status: 'matched' | 'warning' | 'critical' | 'unverified';
  notes?: string;
  assetIdentity?: {
    chain: string | number;
    tokenAddress: string | null;
    holderAddress: string;
    symbol: string;
    blockNumber: number;
    blockHash: string;
  };
  lastOnChainCheck: Date;
  recordedAt: Date;
}

export interface ReconciliationJobStats {
  daosTreasuryReconciled: number;
  vaultsReconciled: number;
  daosSkipped: number;
  vaultsSkipped: number;
  criticalDiscrepancies: number;
  warningDiscrepancies: number;
  totalReconciliations: number;
  averageDiscrepancyPercent: number;
}

const CRITICAL_DISCREPANCY_THRESHOLD = 0.05; // 5% drift = critical
const WARNING_DISCREPANCY_THRESHOLD = 0.01; // 1% drift = warning

/**
 * Run the reconciliation job. DAO and vault checks are skipped until independent
 * chain readers are configured; database-derived values are not chain evidence.
 */
export async function runTreasuryReconciliationJob(): Promise<ReconciliationJobStats> {
  const startTime = Date.now();
  const results: ReconciliationResult[] = [];
  let reconciliationRunId: string | undefined;

  try {
    logger.info('[TreasuryReconciliationJob] Starting full reconciliation job...');
    const run = await financialReconciliationService.startRun({
      source: 'treasury-reconciliation-job',
    });
    reconciliationRunId = run.id;

    // Get all DAOs
    const allDaos = await db.select({ id: daos.id }).from(daos);

    // Reconcile each DAO
    for (const dao of allDaos) {
      try {
        results.push(...await reconcileDAOTreasury(dao.id));
      } catch (error) {
        logger.error(`[TreasuryReconciliationJob] Error reconciling DAO ${dao.id}:`, error);
      }
    }

    // Get all vaults
    const allVaults = await db.select({ id: vaults.id }).from(vaults);

    // Reconcile each vault
    for (const vault of allVaults) {
      try {
        results.push(...await reconcileVaultBalance(vault.id));
      } catch (error) {
        logger.error(`[TreasuryReconciliationJob] Error reconciling vault ${vault.id}:`, error);
      }
    }

    // Record all audit entries
    for (const result of results) {
      try {
        await recordReconciliationAudit(result);
      } catch (auditError) {
        logger.warn(`[TreasuryReconciliationJob] Failed to record audit for ${result.entityId}:`, { error: auditError });
      }
      await recordTreasuryBalanceFinding(result, run.id);
    }

    const daoFindings = await reconcileDaoContributionAndDepositFindings(run.id);
    const proposalFindings = await reconcileProposalExecutionFindings(run.id);

    // Calculate statistics
    const criticalCount = results.filter((r) => r.status === 'critical').length;
    const warningCount = results.filter((r) => r.status === 'warning').length;
    const averageDiscrepancy =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.discrepancyPercent, 0) / results.length
        : 0;

    const stats: ReconciliationJobStats = {
      daosTreasuryReconciled: new Set(results.filter((result) => result.type === 'dao_treasury').map((r) => r.entityId)).size,
      vaultsReconciled: new Set(results.filter((result) => result.type === 'vault_balance').map((r) => r.entityId)).size,
      daosSkipped: allDaos.length - new Set(results.filter((result) => result.type === 'dao_treasury').map((r) => r.entityId)).size,
      vaultsSkipped: allVaults.length - new Set(results.filter((result) => result.type === 'vault_balance').map((r) => r.entityId)).size,
      criticalDiscrepancies: criticalCount,
      warningDiscrepancies: warningCount,
      totalReconciliations: results.length,
      averageDiscrepancyPercent: averageDiscrepancy,
    };
    await financialReconciliationService.completeRun(run.id, {
      ...stats,
      findings: {
        r05: daoFindings.r05,
        r06: results.filter((result) =>
          result.type === 'dao_treasury' &&
          (result.status === 'warning' || result.status === 'critical')
        ).length,
        r07: daoFindings.r07,
        r08: proposalFindings.r08,
        r09: proposalFindings.r09,
      },
    });

    const elapsed = Date.now() - startTime;

    logger.info(
      `[TreasuryReconciliationJob] Completed in ${elapsed}ms. ` +
      `DAOs reconciled/skipped: ${stats.daosTreasuryReconciled}/${stats.daosSkipped}, ` +
      `Vaults reconciled/skipped: ${stats.vaultsReconciled}/${stats.vaultsSkipped}, ` +
      `Critical: ${stats.criticalDiscrepancies}, Warnings: ${stats.warningDiscrepancies}, ` +
      `Avg Discrepancy: ${stats.averageDiscrepancyPercent.toFixed(2)}%`
    );

    // Alert on critical discrepancies
    if (criticalCount > 0) {
      const criticalResults = results.filter((r) => r.status === 'critical');
      logger.warn(
        `[TreasuryReconciliationJob] ALERT: Found ${criticalCount} critical discrepancies: ` +
        criticalResults.map((r) => `${r.type}/${r.entityId} (${r.discrepancyPercent.toFixed(2)}%)`).join(', ')
      );

      // In production, could send alert to monitoring/alerting system
      // e.g., Sentry, PagerDuty, CloudWatch, etc.
    }

    return stats;
  } catch (error) {
    if (reconciliationRunId) {
      try {
        await financialReconciliationService.failRun(
          reconciliationRunId,
          error instanceof Error ? error.message : String(error),
        );
      } catch (runError) {
        logger.error('[TreasuryReconciliationJob] Could not mark reconciliation run failed:', runError);
      }
    }
    logger.error('[TreasuryReconciliationJob] Fatal error during reconciliation:', error);
    throw error;
  }
}

/**
 * Compare each indexed DAO treasury asset against an independent chain read.
 */
export async function reconcileDAOTreasury(daoId: string): Promise<ReconciliationResult[]> {
  const [dao] = await db
    .select({ holderAddress: daos.chamaTreasuryAddress })
    .from(daos)
    .where(eq(daos.id, daoId))
    .limit(1);

  const positions = await db
    .select({
      chain: treasuryPositions.chain,
      chainId: treasuryPositions.chainId,
      holderAddress: treasuryPositions.holderAddress,
      tokenAddress: treasuryPositions.contractAddress,
      symbol: treasuryPositions.symbol,
      balance: treasuryPositions.balance,
      updatedAt: treasuryPositions.updatedAt,
    })
    .from(treasuryPositions)
    .where(eq(treasuryPositions.daoId, daoId));

  return reconcileAssets(
    'dao_treasury',
    daoId,
    positions.map((position) => ({
      chain: position.chainId ?? position.chain,
      holderAddress: position.holderAddress
        ?? (dao?.holderAddress && isCeloChain(position.chainId ?? position.chain) ? dao.holderAddress : null),
      tokenAddress: position.tokenAddress,
      symbol: position.symbol,
      balance: position.balance,
      indexedAt: position.updatedAt,
    })),
  );
}

/**
 * Compare each fully identified indexed vault asset against an independent chain read.
 */
export async function reconcileVaultBalance(vaultId: string): Promise<ReconciliationResult[]> {
  const holdings = await db
    .select({
      chain: vaultTokenHoldings.chain,
      chainId: vaultTokenHoldings.chainId,
      tokenAddress: vaultTokenHoldings.tokenAddress,
      holderAddress: vaultTokenHoldings.holderAddress,
      symbol: vaultTokenHoldings.tokenSymbol,
      balance: vaultTokenHoldings.balance,
      indexedAt: vaultTokenHoldings.updatedAt,
    })
    .from(vaultTokenHoldings)
    .where(eq(vaultTokenHoldings.vaultId, vaultId));

  const identifiedHoldings = holdings.filter((holding) => holding.chainId || holding.chain);
  if (identifiedHoldings.length !== holdings.length) {
    logger.warn(
      `[TreasuryReconciliationJob] ${holdings.length - identifiedHoldings.length} vault holding(s) skipped for ${vaultId}: chain identity is missing`
    );
  }

  return reconcileAssets(
    'vault_balance',
    vaultId,
    identifiedHoldings.map((holding) => ({
      chain: holding.chainId ?? holding.chain!,
      holderAddress: holding.holderAddress,
      tokenAddress: holding.tokenAddress,
      symbol: holding.symbol,
      balance: holding.balance,
      indexedAt: holding.indexedAt,
    })),
  );
}

async function reconcileAssets(
  type: 'dao_treasury' | 'vault_balance',
  entityId: string,
  assets: Array<{
    chain: string | number;
    holderAddress: string | null;
    tokenAddress: string | null;
    symbol: string;
    balance: string | null;
    indexedAt: Date | null;
  }>,
): Promise<ReconciliationResult[]> {
  const results: ReconciliationResult[] = [];

  for (const asset of assets) {
    if (!asset.holderAddress) {
      logger.warn(`[TreasuryReconciliationJob] Skipping ${type} ${entityId}/${asset.symbol}: holder address is missing`);
      continue;
    }
    if (type === 'vault_balance' && !asset.tokenAddress) {
      logger.warn(`[TreasuryReconciliationJob] Skipping vault ${entityId}/${asset.symbol}: token address is missing`);
      continue;
    }

    try {
      const observed = await chainBalanceReader.readBalance({
        chain: asset.chain,
        holderAddress: asset.holderAddress,
        assetAddress: asset.tokenAddress,
        symbol: asset.symbol,
      });
      const computed = new Decimal(asset.balance ?? '0');
      const onChain = new Decimal(observed.balance);
      const discrepancy = computed.minus(onChain).abs();
      const denominator = Decimal.max(computed.abs(), onChain.abs());
      const discrepancyPercent = denominator.isZero()
        ? 0
        : discrepancy.div(denominator).mul(100).toNumber();
      const status = discrepancyPercent >= CRITICAL_DISCREPANCY_THRESHOLD * 100
        ? 'critical'
        : discrepancyPercent >= WARNING_DISCREPANCY_THRESHOLD * 100
          ? 'warning'
          : 'matched';

      results.push({
        type,
        entityId,
        computedValue: computed.toFixed(18),
        onChainValue: onChain.toFixed(18),
        discrepancy: discrepancy.toFixed(18),
        discrepancyPercent,
        status,
        assetIdentity: {
          chain: observed.chainId,
          tokenAddress: observed.assetAddress,
          holderAddress: observed.holderAddress,
          symbol: observed.symbol,
          blockNumber: observed.blockNumber,
          blockHash: observed.blockHash,
        },
        lastOnChainCheck: observed.observedAt,
        recordedAt: new Date(),
        notes: JSON.stringify({
          chain: observed.chain,
          chainId: observed.chainId,
          tokenAddress: observed.assetAddress,
          holderAddress: observed.holderAddress,
          symbol: observed.symbol,
          blockNumber: observed.blockNumber,
          blockHash: observed.blockHash,
          indexedAt: asset.indexedAt?.toISOString() ?? null,
          source: 'independent_rpc_read',
        }),
      });
    } catch (error) {
      logger.error(
        `[TreasuryReconciliationJob] Chain read failed for ${type}/${entityId}/${asset.symbol} on ${asset.chain}:`,
        error,
      );
    }
  }

  return results;
}

function isCeloChain(chain: string | number): boolean {
  if (chain === 42220 || chain === 44787) return true;
  if (typeof chain === 'string' && /^\d+$/.test(chain)) {
    return isCeloChain(Number(chain));
  }
  return ['celo', 'celo-mainnet', 'celo-alfajores', 'alfajores']
    .includes(String(chain).toLowerCase());
}

/**
 * Record reconciliation audit entry
 */
export async function recordReconciliationAudit(result: ReconciliationResult): Promise<void> {
  try {
    await db.insert(treasuryReconciliationAudits).values({
      reconciliationType: result.type,
      entityId: result.entityId,
      computedValue: result.computedValue,
      onChainValue: result.onChainValue,
      discrepancy: result.discrepancy,
      discrepancyPercent: result.discrepancyPercent.toString(),
      reconciliationStatus: result.status,
      lastOnChainCheck: result.lastOnChainCheck,
      notes: result.notes,
      createdAt: result.recordedAt,
    });
  } catch (error) {
    logger.error('[TreasuryReconciliation] Error recording audit:', error);
    throw error;
  }
}

/**
 * Get recent reconciliation results for entity
 */
export async function getRecentReconciliationResults(
  entityId: string,
  limit: number = 10
): Promise<ReconciliationResult[]> {
  try {
    const audits = await db
      .select()
      .from(treasuryReconciliationAudits)
      .where(eq(treasuryReconciliationAudits.entityId, entityId))
      .orderBy(desc(treasuryReconciliationAudits.createdAt))
      .limit(limit);

    return audits.map((a) => ({
      type: a.reconciliationType as 'dao_treasury' | 'vault_balance' | 'multisig_transactions',
      entityId: a.entityId,
      computedValue: a.computedValue.toString(),
      onChainValue: a.onChainValue.toString(),
      discrepancy: a.discrepancy.toString(),
      discrepancyPercent: parseFloat(a.discrepancyPercent.toString()),
      status: a.reconciliationStatus as ReconciliationResult['status'],
      lastOnChainCheck: a.lastOnChainCheck,
      recordedAt: a.createdAt,
      notes: a.notes ?? undefined,
    }));
  } catch (error) {
    logger.error(`[TreasuryReconciliation] Error fetching audit results for ${entityId}:`, error);
    throw error;
  }
}

/**
 * Get all critical discrepancies above threshold (using SQL for complex aggregation)
 */
export async function getCriticalDiscrepancies(limit: number = 50): Promise<ReconciliationResult[]> {
  try {
    // Use raw SQL to query discrepancies greater than critical threshold
    const criticalThresholdPercent = CRITICAL_DISCREPANCY_THRESHOLD * 100;
    
    const audits = await db
      .select()
      .from(treasuryReconciliationAudits)
      .where(
        and(
          eq(treasuryReconciliationAudits.reconciliationStatus, 'critical'),
          gt(sql`CAST(${treasuryReconciliationAudits.discrepancyPercent} AS FLOAT)`, criticalThresholdPercent),
        )
      )
      .orderBy(desc(treasuryReconciliationAudits.createdAt))
      .limit(limit);

    return audits.map((a) => ({
      type: a.reconciliationType as 'dao_treasury' | 'vault_balance' | 'multisig_transactions',
      entityId: a.entityId,
      computedValue: a.computedValue,
      onChainValue: a.onChainValue,
      discrepancy: a.discrepancy,
      discrepancyPercent: parseFloat(a.discrepancyPercent || '0'),
      status: 'critical' as const,
      lastOnChainCheck: a.lastOnChainCheck || new Date(),
      recordedAt: a.createdAt || new Date(),
      notes: a.notes ?? undefined,
    }));
  } catch (error) {
    logger.error('[TreasuryReconciliation] Error fetching critical discrepancies:', error);
    throw error;
  }
}

/**
 * Get warning-level discrepancies (using gt operator for threshold comparison)
 */
export async function getWarningDiscrepancies(limit: number = 50): Promise<ReconciliationResult[]> {
  try {
    // Use gt operator to find records with discrepancy percent greater than warning threshold
    const warningThresholdPercent = WARNING_DISCREPANCY_THRESHOLD * 100;
    const criticalThresholdPercent = CRITICAL_DISCREPANCY_THRESHOLD * 100;

    const audits = await db
      .select()
      .from(treasuryReconciliationAudits)
      .where(
        and(
          eq(treasuryReconciliationAudits.reconciliationStatus, 'warning'),
          gt(sql`CAST(${treasuryReconciliationAudits.discrepancyPercent} AS FLOAT)`, warningThresholdPercent),
          sql`CAST(${treasuryReconciliationAudits.discrepancyPercent} AS FLOAT) <= ${criticalThresholdPercent}`
        )
      )
      .orderBy(desc(treasuryReconciliationAudits.createdAt))
      .limit(limit);

    return audits.map((a) => ({
      type: a.reconciliationType as 'dao_treasury' | 'vault_balance' | 'multisig_transactions',
      entityId: a.entityId,
      computedValue: a.computedValue,
      onChainValue: a.onChainValue,
      discrepancy: a.discrepancy,
      discrepancyPercent: parseFloat(a.discrepancyPercent || '0'),
      status: 'warning' as const,
      lastOnChainCheck: a.lastOnChainCheck || new Date(),
      recordedAt: a.createdAt || new Date(),
      notes: a.notes ?? undefined,
    }));
  } catch (error) {
    logger.error('[TreasuryReconciliation] Error fetching warning discrepancies:', error);
    throw error;
  }
}
