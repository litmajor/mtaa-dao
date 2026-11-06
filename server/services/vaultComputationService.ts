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
  computedBalance: string | null; // Null when holdings contain multiple token symbols.
  computedValueUsd: string | null; // Null when at least one holding has no recorded USD valuation.
  lastUpdatedAt: Date | null;
  tokenHoldingsCount: number;
  tokenCount: number;
  unverifiedHoldingCount: number;
  holdings: Array<{
    token: string;
    balance: string;
    valueUsd: string | null;
    chain: string | null;
    chainId: number | null;
    tokenAddress: string | null;
    holderAddress: string | null;
    lastUpdatedAt: Date | null;
  }>;
}

/**
 * Compute indexed vault holdings. This is not a direct chain read.
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
        unpricedCount: sql<number>`COUNT(*) FILTER (
          WHERE ${vaultTokenHoldings.valueUSD} IS NULL
            OR (${vaultTokenHoldings.balance} <> 0 AND ${vaultTokenHoldings.valueUSD} = 0)
        )`.as('unpriced_count'),
        unverifiedCount: sql<number>`COUNT(*) FILTER (
          WHERE (${vaultTokenHoldings.chainId} IS NULL AND ${vaultTokenHoldings.chain} IS NULL)
            OR ${vaultTokenHoldings.holderAddress} IS NULL
            OR ${vaultTokenHoldings.tokenAddress} IS NULL
        )`.as('unverified_count'),
        tokenCount: sql<number>`COUNT(DISTINCT ${vaultTokenHoldings.tokenSymbol})`.as('token_count'),
        maxUpdatedAt: sql<Date| null>`MAX(${vaultTokenHoldings.updatedAt})`.as('max_updated_at'),
        count: sql<number>`COUNT(DISTINCT ${vaultTokenHoldings.id})`.as('holding_count'),
      })
      .from(vaultTokenHoldings)
      .where(eq(vaultTokenHoldings.vaultId, vaultId));

    const holdingsData = holdingsResult[0] || {
      totalBalance: '0',
      totalValueUsd: '0',
      unpricedCount: 0,
      unverifiedCount: 0,
      tokenCount: 0,
      maxUpdatedAt: null,
      count: 0,
    };

    // Query individual holdings for detailed response
    const detailedHoldings = await db
      .select({
        token: vaultTokenHoldings.tokenSymbol,
        balance: vaultTokenHoldings.balance,
        valueUsd: vaultTokenHoldings.valueUSD,
        chain: vaultTokenHoldings.chain,
        chainId: vaultTokenHoldings.chainId,
        tokenAddress: vaultTokenHoldings.tokenAddress,
        holderAddress: vaultTokenHoldings.holderAddress,
        lastUpdatedAt: vaultTokenHoldings.updatedAt,
      })
      .from(vaultTokenHoldings)
      .where(eq(vaultTokenHoldings.vaultId, vaultId));

    // The table has no chain/contract identity, so don't aggregate multiple rows
    // into one raw token quantity, even when their display symbols match.
    const assetIdentities = new Set(detailedHoldings.map((holding) => {
      if (!holding.tokenAddress || !holding.holderAddress || (!holding.chainId && !holding.chain)) {
        return null;
      }
      return [
        holding.chainId ?? holding.chain?.toLowerCase(),
        holding.tokenAddress.toLowerCase(),
        holding.holderAddress.toLowerCase(),
      ].join(':');
    }));
    const hasCompleteAssetIdentity = assetIdentities.size > 0
      && !assetIdentities.has(null)
      && holdingsData.unverifiedCount === 0;
    const computedBalance = hasCompleteAssetIdentity && assetIdentities.size === 1
      ? new Decimal(holdingsData.totalBalance || '0').toString()
      : null;
    const computedValueUsd = holdingsData.count > 0
      && holdingsData.unpricedCount === 0
      && hasCompleteAssetIdentity
      ? new Decimal(holdingsData.totalValueUsd || '0').toString()
      : null;

    logger.info(
      `[VaultService] Vault ${vaultId}: token_balance=${computedBalance ?? 'multiple assets'}, ` +
      `value_usd=${computedValueUsd ?? 'incomplete'}, ` +
      `unverified=${holdingsData.unverifiedCount}, ` +
      `tokens=${holdingsData.count}, last_updated=${holdingsData.maxUpdatedAt?.toISOString()}`
    );

    return {
      vaultId,
      userId: vault.userId,
      daoId: vault.daoId,
      computedBalance,
      computedValueUsd,
      lastUpdatedAt: holdingsData.maxUpdatedAt || null,
      tokenHoldingsCount: holdingsData.count,
      tokenCount: holdingsData.tokenCount,
      unverifiedHoldingCount: holdingsData.unverifiedCount,
      holdings: detailedHoldings.map((h) => {
        const balance = h.balance || '0';
        const balanceIsNonZero = !new Decimal(balance).isZero();
        const valueUsd = h.valueUsd === null
          || (balanceIsNonZero && new Decimal(h.valueUsd).isZero())
          ? null
          : h.valueUsd?.toString() ?? null;

        return {
          token: h.token || 'unknown',
          balance,
          valueUsd,
          chain: h.chain,
          chainId: h.chainId,
          tokenAddress: h.tokenAddress,
          holderAddress: h.holderAddress,
          lastUpdatedAt: h.lastUpdatedAt,
        };
      }),
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
