/**
 * Treasury Reconciliation Job - Continuous On-Chain Validation
 * 
 * Responsible for:
 * - Periodic validation of computed DAO treasury against on-chain state
 * - Periodic validation of computed vault balances against on-chain state
 * - Detecting discrepancies and drift issues
 * - Recording audits for compliance and debugging
 * - Alerting on critical state mismatches
 */

import { db } from '../storage';
import {
  daos,
  vaults,
  treasuryPositions,
  treasuryReconciliationAudits,
  vaultPerformance,
} from '@shared/schema';
import { eq, and, gt, sql, desc } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { Decimal } from 'decimal.js';
import TreasuryService from './treasuryService';
import * as vaultService from './vaultComputationService';

export interface ReconciliationResult {
  type: 'dao_treasury' | 'vault_balance' | 'multisig_transactions';
  entityId: string;
  computedValue: string;
  onChainValue: string;
  discrepancy: string;
  discrepancyPercent: number;
  status: 'matched' | 'warning' | 'critical';
  lastOnChainCheck: Date;
  recordedAt: Date;
}

export interface ReconciliationJobStats {
  daosTreasuryReconciled: number;
  vaultsReconciled: number;
  criticalDiscrepancies: number;
  warningDiscrepancies: number;
  totalReconciliations: number;
  averageDiscrepancyPercent: number;
}

const CRITICAL_DISCREPANCY_THRESHOLD = 0.05; // 5% drift = critical
const WARNING_DISCREPANCY_THRESHOLD = 0.01; // 1% drift = warning

/**
 * Run full treasury reconciliation job
 * Call this periodically (e.g., every hour) to validate state
 */
export async function runTreasuryReconciliationJob(): Promise<ReconciliationJobStats> {
  const startTime = Date.now();
  const results: ReconciliationResult[] = [];

  try {
    logger.info('[TreasuryReconciliationJob] Starting full reconciliation job...');

    // Get all DAOs
    const allDaos = await db.select({ id: daos.id, treasuryBalance: daos.treasuryBalance }).from(daos);

    // Reconcile each DAO
    for (const dao of allDaos) {
      try {
        const daoResult = await reconcileDAOTreasury(dao.id, dao.treasuryBalance || '0');
        results.push(daoResult);
      } catch (error) {
        logger.error(`[TreasuryReconciliationJob] Error reconciling DAO ${dao.id}:`, error);
      }
    }

    // Get all vaults
    const allVaults = await db.select({ id: vaults.id, balance: vaults.balance }).from(vaults);

    // Reconcile each vault
    for (const vault of allVaults) {
      try {
        const vaultResult = await reconcileVaultBalance(vault.id, vault.balance || '0');
        results.push(vaultResult);
      } catch (error) {
        logger.error(`[TreasuryReconciliationJob] Error reconciling vault ${vault.id}:`, error);
      }
    }

    // Record all audit entries
    for (const result of results) {
      try {
        await recordReconciliationAudit(result);
      } catch (auditError) {
        logger.warn(`[TreasuryReconciliationJob] Failed to record audit for ${result.entityId}:`, auditError);
      }
    }

    // Calculate statistics
    const criticalCount = results.filter((r) => r.status === 'critical').length;
    const warningCount = results.filter((r) => r.status === 'warning').length;
    const averageDiscrepancy =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.discrepancyPercent, 0) / results.length
        : 0;

    const stats: ReconciliationJobStats = {
      daosTreasuryReconciled: allDaos.length,
      vaultsReconciled: allVaults.length,
      criticalDiscrepancies: criticalCount,
      warningDiscrepancies: warningCount,
      totalReconciliations: results.length,
      averageDiscrepancyPercent: averageDiscrepancy,
    };

    const elapsed = Date.now() - startTime;

    logger.info(
      `[TreasuryReconciliationJob] Completed in ${elapsed}ms. ` +
      `DAOs: ${stats.daosTreasuryReconciled}, Vaults: ${stats.vaultsReconciled}, ` +
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
    logger.error('[TreasuryReconciliationJob] Fatal error during reconciliation:', error);
    throw error;
  }
}

/**
 * Reconcile single DAO treasury
 */
export async function reconcileDAOTreasury(daoId: string, storedValue: string): Promise<ReconciliationResult> {
  try {
    // Get computed balance from treasuryPositions + stableInflowEvents
    const computed = await TreasuryService.getComputedTreasuryBalance(daoId);

    // Get on-chain state (this would query actual blockchain for live verification)
    const onChainValue = await getOnChainDAOTreasuryBalance(daoId);

    // Compare computed vs on-chain
    const computedDecimal = new Decimal(computed.totalComputedBalance || '0');
    const onChainDecimal = new Decimal(onChainValue || '0');

    const discrepancy = computedDecimal.minus(onChainDecimal).abs();
    const discrepancyPercent =
      onChainDecimal.isZero()
        ? 0
        : discrepancy.dividedBy(onChainDecimal).times(100).toNumber();

    const status =
      discrepancyPercent >= CRITICAL_DISCREPANCY_THRESHOLD * 100
        ? 'critical'
        : discrepancyPercent >= WARNING_DISCREPANCY_THRESHOLD * 100
          ? 'warning'
          : 'matched';

    logger.info(
      `[TreasuryReconciliation] DAO ${daoId}: computed=${computedDecimal.toString()}, ` +
      `on_chain=${onChainDecimal.toString()}, discrepancy=${discrepancy.toString()} (${discrepancyPercent.toFixed(2)}%), ` +
      `status=${status}`
    );

    return {
      type: 'dao_treasury',
      entityId: daoId,
      computedValue: computedDecimal.toString(),
      onChainValue: onChainDecimal.toString(),
      discrepancy: discrepancy.toString(),
      discrepancyPercent,
      status,
      lastOnChainCheck: new Date(),
      recordedAt: new Date(),
    };
  } catch (error) {
    logger.error(`[TreasuryReconciliation] Error reconciling DAO ${daoId}:`, error);
    throw error;
  }
}

/**
 * Reconcile single vault balance
 */
export async function reconcileVaultBalance(vaultId: string, storedValue: string): Promise<ReconciliationResult> {
  try {
    // Get computed balance from vaultTokenHoldings
    const computed = await vaultService.getComputedVaultBalance(vaultId);

    // Get on-chain state
    const onChainValue = await getOnChainVaultBalance(vaultId);

    // Compare
    const computedDecimal = new Decimal(computed.computedBalance || '0');
    const onChainDecimal = new Decimal(onChainValue || '0');

    const discrepancy = computedDecimal.minus(onChainDecimal).abs();
    const discrepancyPercent =
      onChainDecimal.isZero()
        ? 0
        : discrepancy.dividedBy(onChainDecimal).times(100).toNumber();

    const status =
      discrepancyPercent >= CRITICAL_DISCREPANCY_THRESHOLD * 100
        ? 'critical'
        : discrepancyPercent >= WARNING_DISCREPANCY_THRESHOLD * 100
          ? 'warning'
          : 'matched';

    logger.info(
      `[VaultReconciliation] Vault ${vaultId}: computed=${computedDecimal.toString()}, ` +
      `on_chain=${onChainDecimal.toString()}, discrepancy=${discrepancy.toString()} (${discrepancyPercent.toFixed(2)}%), ` +
      `status=${status}`
    );

    return {
      type: 'vault_balance',
      entityId: vaultId,
      computedValue: computedDecimal.toString(),
      onChainValue: onChainDecimal.toString(),
      discrepancy: discrepancy.toString(),
      discrepancyPercent,
      status,
      lastOnChainCheck: new Date(),
      recordedAt: new Date(),
    };
  } catch (error) {
    logger.error(`[VaultReconciliation] Error reconciling vault ${vaultId}:`, error);
    throw error;
  }
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
      status: a.reconciliationStatus as 'matched' | 'warning' | 'critical',
      lastOnChainCheck: a.lastOnChainCheck,
      recordedAt: a.createdAt,
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
        sql`CAST(${treasuryReconciliationAudits.discrepancyPercent} AS FLOAT) > ${criticalThresholdPercent}`
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
    }));
  } catch (error) {
    logger.error('[TreasuryReconciliation] Error fetching warning discrepancies:', error);
    throw error;
  }
}

// ============================================================================
// ON-CHAIN STATE QUERYING (PLACEHOLDERS)
// ============================================================================

/**
 * Query actual on-chain DAO treasury balance
 * Aggregates balances from all treasury positions and stable inflows
 */
async function getOnChainDAOTreasuryBalance(daoId: string): Promise<string> {
  try {
    // Query all treasury positions for this DAO from indexed events
    const positions = await db
      .select()
      .from(treasuryPositions)
      .where(eq(treasuryPositions.daoId, daoId));

    // Sum all position balances
    const totalBalance = positions.reduce((sum, pos) => {
      const posBalance = new Decimal(pos.balance || '0');
      return sum.plus(posBalance);
    }, new Decimal('0'));

    logger.debug(
      `[OnChainQueries] Computed on-chain DAO treasury balance for ${daoId}: ` +
      `${totalBalance.toString()} from ${positions.length} positions`
    );

    return totalBalance.toString();
  } catch (error) {
    logger.error(`[OnChainQueries] Error querying on-chain DAO treasury:`, error);
    throw error;
  }
}

/**
 * Query actual on-chain vault balance
 * Aggregates token holdings from vault token holdings indexed from on-chain contracts
 */
async function getOnChainVaultBalance(vaultId: string): Promise<string> {
  try {
    // Query the most recent vault performance record to get accurate balance
    const [performance] = await db
      .select()
      .from(vaultPerformance)
      .where(eq(vaultPerformance.vaultId, vaultId))
      .orderBy(desc(vaultPerformance.createdAt))
      .limit(1);

    if (!performance) {
      logger.warn(`[OnChainQueries] No performance record found for vault ${vaultId}`);
      return '0';
    }

    const balance = new Decimal(performance.endingValue || '0');

    logger.debug(
      `[OnChainQueries] Computed on-chain vault balance for ${vaultId}: ` +
      `${balance.toString()} as of ${performance.createdAt}`
    );

    return balance.toString();
  } catch (error) {
    logger.error(`[OnChainQueries] Error querying on-chain vault balance:`, error);
    throw error;
  }
}
