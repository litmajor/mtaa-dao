/**
 * Vault Service - Hybrid On-Chain/Off-Chain Balance Computation
 * 
 * Responsible for:
 * - Computing vault balances from chain-indexed vaultTokenHoldings
 * - Never using stored DB vault.balance as source of truth
 * - Supporting multi-token vault positions
 * - Providing reconciliation validation
 */

import { db } from '../storage';
import { vaults, vaultTokenHoldings } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { Decimal } from 'decimal.js';

export interface ComputedVaultBalance {
  vaultId: string;
  userId?: string | null;
  daoId?: string | null;
  computedBalance: string; // Decimal as string
  lastUpdatedAt: Date | null;
  tokenHoldingsCount: number;
  holdings: Array<{
    token: string;
    balance: string;
    valueUsd: string;
    lastUpdatedAt: Date | null;
  }>;
}

/**
 * Compute vault balance from vaultTokenHoldings (chain-indexed, source of truth)
 * This is the SOURCE OF TRUTH - never use vaults.balance field
 */
export async function getComputedVaultBalance(vaultId: string): Promise<ComputedVaultBalance> {
  try {
    // Get vault info
    const [vault] = await db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId));

    if (!vault) {
      throw new Error(`Vault ${vaultId} not found`);
    }

    // Query: Sum all vaultTokenHoldings for this vault, grouped by token
    const holdingsResult = await db
      .select({
        totalBalance: sql<string>`COALESCE(SUM(${vaultTokenHoldings.balance}), '0')`.as('total_balance'),
        totalValueUsd: sql<string>`COALESCE(SUM(${vaultTokenHoldings.valueUSD}), '0')`.as('total_value_usd'),
        maxUpdatedAt: sql<Date| null>`MAX(${vaultTokenHoldings.updatedAt})`.as('max_updated_at'),
        count: sql<number>`COUNT(DISTINCT ${vaultTokenHoldings.id})`.as('holding_count'),
      })
      .from(vaultTokenHoldings)
      .where(eq(vaultTokenHoldings.vaultId, vaultId));

    const holdingsData = holdingsResult[0] || {
      totalBalance: '0',
      totalValueUsd: '0',
      maxUpdatedAt: null,
      count: 0,
    };

    // Query individual holdings for detailed response
    const detailedHoldings = await db
      .select({
        token: vaultTokenHoldings.tokenSymbol,
        balance: vaultTokenHoldings.balance,
        valueUsd: vaultTokenHoldings.valueUSD,
        lastUpdatedAt: vaultTokenHoldings.updatedAt,
      })
      .from(vaultTokenHoldings)
      .where(eq(vaultTokenHoldings.vaultId, vaultId));

    const computedBalance = new Decimal(holdingsData.totalBalance || '0');

    logger.info(
      `[VaultService] Vault ${vaultId}: computed=${computedBalance.toString()}, ` +
      `tokens=${holdingsData.count}, last_updated=${holdingsData.maxUpdatedAt?.toISOString()}`
    );

    return {
      vaultId,
      userId: vault.userId,
      daoId: vault.daoId,
      computedBalance: computedBalance.toString(),
      lastUpdatedAt: holdingsData.maxUpdatedAt || null,
      tokenHoldingsCount: holdingsData.count,
      holdings: detailedHoldings.map((h) => ({
        token: h.token || 'unknown',
        balance: h.balance || '0',
        valueUsd: h.valueUsd || '0',
        lastUpdatedAt: h.lastUpdatedAt,
      })),
    };
  } catch (error) {
    logger.error(`[VaultService] Error computing balance for vault ${vaultId}:`, error);
    throw error;
  }
}

/**
 * Get all vaults with their computed balances (paginated)
 */
export async function getAllVaultBalances(limit: number = 100, offset: number = 0): Promise<ComputedVaultBalance[]> {
  try {
    const vaultList = await db
      .select({ id: vaults.id })
      .from(vaults)
      .limit(limit)
      .offset(offset);

    const results = await Promise.all(vaultList.map((v) => getComputedVaultBalance(v.id)));

    return results;
  } catch (error) {
    logger.error('[VaultService] Error fetching all vault balances:', error);
    throw error;
  }
}

/**
 * Get all vaults for a user with computed balances
 */
export async function getUserVaultBalances(userId: string): Promise<ComputedVaultBalance[]> {
  try {
    const userVaults = await db
      .select({ id: vaults.id })
      .from(vaults)
      .where(eq(vaults.userId, userId));

    const results = await Promise.all(userVaults.map((v) => getComputedVaultBalance(v.id)));

    return results;
  } catch (error) {
    logger.error(`[VaultService] Error fetching vaults for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get all vaults for a DAO with computed balances
 */
export async function getDAOVaultBalances(daoId: string): Promise<ComputedVaultBalance[]> {
  try {
    const daoVaults = await db
      .select({ id: vaults.id })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    const results = await Promise.all(daoVaults.map((v) => getComputedVaultBalance(v.id)));

    return results;
  } catch (error) {
    logger.error(`[VaultService] Error fetching vaults for DAO ${daoId}:`, error);
    throw error;
  }
}

/**
 * DEPRECATED: Get stored vault balance from DB (should not be used)
 * This field drifts from actual on-chain state
 * Use getComputedVaultBalance() instead
 */
export async function getStoredVaultBalance(vaultId: string): Promise<string> {
  logger.warn(
    `[VaultService] DEPRECATED: getStoredVaultBalance() called for vault ${vaultId}. ` +
    `This will return stale data. Use getComputedVaultBalance() instead.`
  );

  const [vault] = await db
    .select({ balance: vaults.balance })
    .from(vaults)
    .where(eq(vaults.id, vaultId));

  return vault?.balance || '0';
}

/**
 * Audit: Update stored balance (for backwards compatibility only)
 * This should ONLY be updated from chain reconciliation, not from API logic
 */
export async function updateStoredVaultBalance(vaultId: string, newBalance: string): Promise<void> {
  logger.warn(
    `[VaultService] Updating stored vault balance for ${vaultId} to ${newBalance}. ` +
    `This is for backwards compatibility only. Computed balance from vaultTokenHoldings is source of truth.`
  );

  await db.update(vaults).set({ balance: newBalance }).where(eq(vaults.id, vaultId));
}
