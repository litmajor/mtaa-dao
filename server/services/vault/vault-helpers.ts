/**
 * Vault Service - Helper Functions
 * 
 * Database access, data retrieval, and common operations
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  vaults,
  vaultTokenHoldings,
  type Vault,
  type VaultTokenHolding
} from '../../../shared/schema';
import { TokenRegistry } from '../../../shared/tokenRegistry';
import { Logger } from "../../utils/logger";
import { getErrorMessage } from '../../utils/errorUtils';
import { AppError, ValidationError, NotFoundError } from "../../middleware/errorHandler";
import { ethers } from 'ethers';
import type { VaultOperation } from './types';
import { daoMemberships, daos } from '../../../shared/schema';

/**
 * VaultHelperService - Database access and common operations
 */
export class VaultHelperService {
  /**
   * Get vault by ID
   */
  async getVaultById(vaultId: string): Promise<Vault | null> {
    try {
      const result = await db.query.vaults.findFirst({
        where: eq(vaults.id, vaultId)
      });
      return result || null;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error fetching vault by ID ${vaultId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get single token holding
   */
  async getTokenHolding(
    vaultId: string, 
    tokenSymbol: string, 
    tx?: any
  ): Promise<VaultTokenHolding | null> {
    try {
      const dbConnection = tx || db;
      const result = await dbConnection.query.vaultTokenHoldings.findFirst({
        where: and(
          eq(vaultTokenHoldings.vaultId, vaultId),
          eq(vaultTokenHoldings.tokenSymbol, tokenSymbol)
        )
      });
      return result || null;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error fetching token holding for vault ${vaultId}, token ${tokenSymbol}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }

  /**
   * Get all token holdings for a vault
   */
  async getVaultHoldings(vaultId: string, tx?: any): Promise<VaultTokenHolding[]> {
    try {
      const dbConnection = tx || db;
      return await dbConnection.query.vaultTokenHoldings.findMany({
        where: eq(vaultTokenHoldings.vaultId, vaultId)
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error fetching all holdings for vault ${vaultId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }

  /**
   * Update token holding amount (atomic operation)
   */
  async updateTokenHolding(
    vaultId: string, 
    tokenSymbol: string, 
    amountWei: bigint, 
    isDeposit: boolean,
    priceUSD: number,
    tx?: any
  ): Promise<void> {
    const dbConnection = tx || db;
    const token = TokenRegistry.getToken(tokenSymbol);
    if (!token) {
      throw new ValidationError(`Token ${tokenSymbol} not found in registry`);
    }

    const amountFloat = parseFloat(ethers.formatUnits(amountWei < 0n ? -amountWei : amountWei, token.decimals));

    // Use row locking to find existing holding
    const existing = await dbConnection
      .select()
      .from(vaultTokenHoldings)
      .where(and(
        eq(vaultTokenHoldings.vaultId, vaultId),
        eq(vaultTokenHoldings.tokenSymbol, tokenSymbol)
      ))
      .for('update')
      .limit(1)
      .execute();

    if (existing && existing.length > 0) {
      const holdingRecord = existing[0];
      const amountDelta = ethers.formatUnits(amountWei, token.decimals);

      // Atomic update with SQL-level constraints
      const updateResult = await dbConnection.update(vaultTokenHoldings)
        .set({
          balance: sql`CASE 
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0 
            THEN CAST((CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) AS TEXT)
            ELSE ${holdingRecord.balance}
          END`,
          valueUSD: sql`CASE 
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0 
            THEN CAST(((CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) * ${priceUSD}) AS TEXT)
            ELSE ${holdingRecord.valueUSD}
          END`,
          totalDeposited: sql`CASE 
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0 AND ${isDeposit}
            THEN CAST((COALESCE(CAST(${holdingRecord.totalDeposited || '0'} AS NUMERIC), 0) + ${amountFloat}) AS TEXT)
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0
            THEN ${holdingRecord.totalDeposited}
            ELSE ${holdingRecord.totalDeposited}
          END`,
          totalWithdrawn: sql`CASE 
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0 AND NOT ${isDeposit}
            THEN CAST((COALESCE(CAST(${holdingRecord.totalWithdrawn || '0'} AS NUMERIC), 0) + ${amountFloat}) AS TEXT)
            WHEN (CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0
            THEN ${holdingRecord.totalWithdrawn}
            ELSE ${holdingRecord.totalWithdrawn}
          END`,
          lastPriceUpdate: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(vaultTokenHoldings.id, holdingRecord.id),
          sql`(CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0`
        ))
        .execute();

      // Check if the atomic update succeeded
      if (!updateResult || (updateResult as any).rowCount === 0) {
        const currentHolding = await this.getTokenHolding(vaultId, tokenSymbol, tx);
        const currentBalance = currentHolding?.balance || '0';
        const requestedAmount = ethers.formatUnits(amountWei < 0n ? -amountWei : amountWei, token.decimals);

        throw new ValidationError(
          `Insufficient balance for withdrawal. Available: ${parseFloat(currentBalance).toFixed(6)}, ` +
          `Requested: ${requestedAmount}. This may be due to concurrent operations or insufficient funds.`
        );
      }
    } else {
      // Create new holding
      const balanceStr = ethers.formatUnits(amountWei, token.decimals);
      const balanceFloat = parseFloat(balanceStr);

      if (balanceFloat < 0) {
        throw new ValidationError(`Cannot create holding with negative balance: ${balanceFloat.toFixed(6)}`);
      }

      const valueUSD = balanceFloat * priceUSD;
      const absAmountFloat = Math.abs(balanceFloat);

      await dbConnection.insert(vaultTokenHoldings).values({
        vaultId,
        tokenSymbol,
        balance: balanceStr,
        valueUSD: valueUSD.toString(),
        averageEntryPrice: priceUSD.toString(),
        totalDeposited: isDeposit ? absAmountFloat.toString() : '0',
        totalWithdrawn: !isDeposit ? absAmountFloat.toString() : '0'
      });
    }
  }

  /**
   * Update vault total value locked (TVL)
   */
  async updateVaultTVL(vaultId: string, tx?: any): Promise<void> {
    try {
      const dbConnection = tx || db;
      const holdings = await this.getVaultHoldings(vaultId, tx);
      const totalValueUSD = holdings.reduce((sum, holding) => 
        sum + parseFloat(holding.valueUSD || '0'), 0
      );

      await dbConnection.update(vaults)
        .set({
          totalValueLocked: totalValueUSD.toString(),
          updatedAt: new Date()
        })
        .where(eq(vaults.id, vaultId));
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error updating TVL for vault ${vaultId}: ${msg}`, error);
      throw new AppError(msg, 500);
    }
  }

  /**
   * Check if user has permission to perform vault operation
   */
  async checkVaultPermissions(
    vaultId: string, 
    userId: string, 
    operation: VaultOperation = 'view'
  ): Promise<boolean> {
    const vault = await this.getVaultById(vaultId);
    if (!vault) {
      throw new NotFoundError('Vault not found');
    }

    // Personal vault - check direct ownership
    if (vault.userId) {
      return vault.userId === userId;
    }

    // DAO vault - check DAO membership and operation-specific permissions
    if (vault.daoId) {
      const membership = await db.query.daoMemberships.findFirst({
        where: and(
          eq(daoMemberships.daoId, vault.daoId),
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.status, 'approved')
        )
      });

      if (!membership || membership.isBanned) {
        Logger.getLogger().warn(`User ${userId} attempted unauthorized access to DAO vault ${vaultId}`);
        return false;
      }

      const userRole = membership.role || 'member';

      // Operation-specific role requirements for DAO vaults
      switch (operation) {
        case 'view':
          return ['member', 'proposer', 'elder', 'admin'].includes(userRole);

        case 'deposit':
          return ['member', 'proposer', 'elder', 'admin'].includes(userRole);

        case 'withdraw': {
          const dao = await db.query.daos.findFirst({
            where: eq(sql`id`, vault.daoId!)
          });

          if (!dao) {
            return false;
          }

          const withdrawalMode = dao.withdrawalMode || 'multisig';

          if (userRole === 'admin') {
            return true;
          }

          if (userRole === 'elder') {
            if (withdrawalMode === 'direct') {
              return membership.canInitiateWithdrawal === true;
            } else if (withdrawalMode === 'multisig') {
              return true;
            } else if (withdrawalMode === 'rotation') {
              return membership.isRotationRecipient === true;
            }
          }

          return false;
        }

        case 'allocate':
        case 'rebalance':
          return ['admin', 'elder'].includes(userRole);

        default:
          Logger.getLogger().error(`Invalid operation type '${operation}' for permission check.`);
          return false;
      }
    }

    Logger.getLogger().warn(`Vault ${vaultId} has neither userId nor daoId.`);
    return false;
  }
}

// Export singleton instance
export const vaultHelperService = new VaultHelperService();
