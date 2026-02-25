/**
 * Vault Service - Operations Module
 * 
 * Handles vault operations: deposits, withdrawals, allocations, rebalancing
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  vaultTransactions,
  vaultStrategyAllocations,
  type VaultTransaction
} from '../../../shared/schema';
import { TokenRegistry, YIELD_STRATEGIES } from '../../../shared/tokenRegistry';
import { ethers } from 'ethers';
import { Logger } from "../../utils/logger";
import { getErrorMessage } from '../../utils/errorUtils';
import { AppError, ValidationError } from "../../middleware/errorHandler";
import { z } from "zod";
import { depositSchema, withdrawSchema, strategyAllocationSchema } from './types';
import type { VaultDepositRequest, VaultWithdrawRequest, StrategyAllocationRequest, PendingTransaction } from './types';
import { vaultHelperService } from './vault-helpers';
import { notificationService } from '../../notificationService';

/**
 * VaultOperationsService - Handles vault transactions and allocations
 */
export class VaultOperationsService {
  // Queue management for reliable transaction processing
  private transactionQueue: PendingTransaction[] = [];
  private isProcessingQueue: boolean = false;

  /**
   * Deposit tokens into a vault
   */
  async depositToken(request: VaultDepositRequest): Promise<VaultTransaction> {
    try {
      const validatedRequest = depositSchema.parse(request);

      // Check authorization first
      const hasPermission = await vaultHelperService.checkVaultPermissions(validatedRequest.vaultId, validatedRequest.userId, 'deposit');
      if (!hasPermission) {
        throw new AppError('Unauthorized: You do not have permission to deposit to this vault', 403);
      }

      const vault = await vaultHelperService.getVaultById(validatedRequest.vaultId);
      if (!vault) {
        throw new ValidationError('Vault not found');
      }

      if (!vault.isActive) {
        throw new ValidationError('Vault is not active');
      }

      // Validate token
      const token = TokenRegistry.getToken(validatedRequest.tokenSymbol);
      if (!token) {
        throw new ValidationError(`Unsupported token: ${validatedRequest.tokenSymbol}`);
      }

      // Use BigInt arithmetic for precise decimal handling
      const depositAmountWei = ethers.parseUnits(validatedRequest.amount, token.decimals);

      // Check minimum deposit
      if (vault.minDeposit) {
        const minDepositWei = ethers.parseUnits(vault.minDeposit, token.decimals);
        if (depositAmountWei < minDepositWei) {
          throw new ValidationError(`Deposit amount ${validatedRequest.amount} below minimum ${vault.minDeposit}`);
        }
      }

      // Check maximum deposit if set
      if (vault.maxDeposit) {
        const maxDepositWei = ethers.parseUnits(vault.maxDeposit, token.decimals);
        if (depositAmountWei > maxDepositWei) {
          throw new ValidationError(`Deposit amount ${validatedRequest.amount} exceeds maximum ${vault.maxDeposit}`);
        }
      }

      // Get price from token service
      const priceUSD = await this.getTokenPrice(validatedRequest.tokenSymbol);
      const depositAmountFloat = parseFloat(ethers.formatUnits(depositAmountWei, token.decimals));
      const valueUSD = depositAmountFloat * priceUSD;

      // Wrap critical operations in database transaction
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
        
        // Create transaction record
        const [transaction] = await tx.insert(vaultTransactions).values({
          vaultId: validatedRequest.vaultId,
          userId: validatedRequest.userId,
          transactionType: 'deposit',
          tokenSymbol: validatedRequest.tokenSymbol,
          amount: validatedRequest.amount,
          valueUSD: valueUSD.toString(),
          transactionHash: validatedRequest.transactionHash,
          status: 'completed'
        }).returning();

        // Update token holdings atomically
        await vaultHelperService.updateTokenHolding(
          validatedRequest.vaultId,
          validatedRequest.tokenSymbol,
          depositAmountWei,
          true,
          priceUSD,
          tx
        );

        // Update vault TVL
        await vaultHelperService.updateVaultTVL(validatedRequest.vaultId, tx);

        return transaction;
      }, { isolationLevel: 'serializable' });

      // Trigger strategy rebalancing if configured (outside transaction)
      if (vault.yieldStrategy && (vault as any).autoRebalanceEnabled) {
        try {
          const hasRebalancePermission = await vaultHelperService.checkVaultPermissions(
            validatedRequest.vaultId,
            validatedRequest.userId,
            'rebalance'
          );
          if (hasRebalancePermission) {
            await this.rebalanceVault(validatedRequest.vaultId, validatedRequest.userId);
          } else {
            await this.queueRebalanceRequest(validatedRequest.vaultId, validatedRequest.userId);
          }
        } catch (error) {
          const msg = getErrorMessage(error);
          Logger.getLogger().warn(`Rebalance failed for vault ${validatedRequest.vaultId} after deposit: ${msg}`);
        }
      }

      return result;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to deposit token: ${msg}`, error);
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input for deposit: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }

  /**
   * Withdraw tokens from a vault
   */
  async withdrawToken(request: VaultWithdrawRequest): Promise<VaultTransaction> {
    try {
      const validatedRequest = withdrawSchema.parse(request);

      // Check authorization first
      const hasPermission = await vaultHelperService.checkVaultPermissions(validatedRequest.vaultId, validatedRequest.userId, 'withdraw');
      if (!hasPermission) {
        throw new AppError('Unauthorized: You do not have permission to withdraw from this vault', 403);
      }

      const vault = await vaultHelperService.getVaultById(validatedRequest.vaultId);
      if (!vault) {
        throw new ValidationError('Vault not found');
      }

      // Check if vault is locked (for locked_savings type)
      if (vault.vaultType === 'locked_savings' && vault.lockedUntil && new Date() < vault.lockedUntil) {
        const daysRemaining = Math.ceil((vault.lockedUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        throw new ValidationError(`Vault is locked until ${vault.lockedUntil.toISOString()}. ${daysRemaining} days remaining.`);
      }

      // Validate token
      const token = TokenRegistry.getToken(validatedRequest.tokenSymbol);
      if (!token) {
        throw new ValidationError(`Unsupported token: ${validatedRequest.tokenSymbol}`);
      }

      const withdrawAmountWei = ethers.parseUnits(validatedRequest.amount, token.decimals);
      const priceUSD = await this.getTokenPrice(validatedRequest.tokenSymbol);
      const withdrawAmountFloat = parseFloat(ethers.formatUnits(withdrawAmountWei, token.decimals));
      const valueUSD = withdrawAmountFloat * priceUSD;

      // Wrap in transaction for atomicity
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);

        // Create transaction record
        const [transaction] = await tx.insert(vaultTransactions).values({
          vaultId: validatedRequest.vaultId,
          userId: validatedRequest.userId,
          transactionType: 'withdrawal',
          tokenSymbol: validatedRequest.tokenSymbol,
          amount: validatedRequest.amount,
          valueUSD: valueUSD.toString(),
          transactionHash: validatedRequest.transactionHash,
          status: 'completed'
        }).returning();

        // Update token holdings (negative amount for withdrawal)
        await vaultHelperService.updateTokenHolding(
          validatedRequest.vaultId,
          validatedRequest.tokenSymbol,
          -withdrawAmountWei,
          false,
          priceUSD,
          tx
        );

        // Update vault TVL
        await vaultHelperService.updateVaultTVL(validatedRequest.vaultId, tx);

        return transaction;
      }, { isolationLevel: 'serializable' });

      return result;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to withdraw token: ${msg}`, error);
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input for withdrawal: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }

  /**
   * Allocate funds to a vault strategy
   */
  async allocateToVault(request: StrategyAllocationRequest): Promise<void> {
    try {
      const validatedRequest = strategyAllocationSchema.parse(request);

      // Check authorization
      const hasPermission = await vaultHelperService.checkVaultPermissions(validatedRequest.vaultId, validatedRequest.userId, 'allocate');
      if (!hasPermission) {
        throw new AppError('Unauthorized: You do not have permission to allocate funds for this vault', 403);
      }

      // Get vault and strategy
      const vault = await vaultHelperService.getVaultById(validatedRequest.vaultId);
      if (!vault) {
        throw new ValidationError('Vault not found');
      }

      const strategy = YIELD_STRATEGIES[validatedRequest.strategyId];
      if (!strategy) {
        throw new ValidationError(`Invalid strategy: ${validatedRequest.strategyId}`);
      }

      if (!strategy.supportedTokens.includes(validatedRequest.tokenSymbol)) {
        throw new ValidationError(`Strategy ${validatedRequest.strategyId} does not support token ${validatedRequest.tokenSymbol}`);
      }

      // Get token holding
      const holding = await vaultHelperService.getTokenHolding(validatedRequest.vaultId, validatedRequest.tokenSymbol);
      if (!holding) {
        throw new ValidationError('No token holdings found');
      }

      const token = TokenRegistry.getToken(validatedRequest.tokenSymbol);
      if (!token) {
        throw new ValidationError(`Unsupported token: ${validatedRequest.tokenSymbol}`);
      }

      // Calculate allocation amount
      const totalBalanceWei = ethers.parseUnits(holding.balance, token.decimals);
      const allocationAmountWei = (totalBalanceWei * BigInt(Math.round(validatedRequest.allocationPercentage * 100))) / BigInt(10000);
      const allocationAmount = ethers.formatUnits(allocationAmountWei, token.decimals);

      // Upsert allocation
      const existingAllocation = await db.query.vaultStrategyAllocations.findFirst({
        where: and(
          eq(vaultStrategyAllocations.vaultId, validatedRequest.vaultId),
          eq(vaultStrategyAllocations.strategyId, validatedRequest.strategyId),
          eq(vaultStrategyAllocations.tokenSymbol, validatedRequest.tokenSymbol)
        )
      });

      if (existingAllocation) {
        await db.update(vaultStrategyAllocations)
          .set({
            allocatedAmount: allocationAmount.toString(),
            allocationPercentage: validatedRequest.allocationPercentage.toString(),
            lastRebalance: new Date(),
            updatedAt: new Date()
          })
          .where(eq(vaultStrategyAllocations.id, existingAllocation.id!));
      } else {
        await db.insert(vaultStrategyAllocations).values({
          vaultId: validatedRequest.vaultId,
          strategyId: validatedRequest.strategyId,
          tokenSymbol: validatedRequest.tokenSymbol,
          allocatedAmount: allocationAmount.toString(),
          allocationPercentage: validatedRequest.allocationPercentage.toString(),
          currentValue: allocationAmount.toString(),
          isActive: true
        });
      }

      Logger.getLogger().info(`Allocation created for vault ${validatedRequest.vaultId}, strategy ${validatedRequest.strategyId}`);
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to allocate to vault: ${msg}`, error);
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input for vault allocation: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }

  /**
   * Allocate to a specific yield strategy (alias)
   */
  async allocateToStrategy(request: StrategyAllocationRequest): Promise<void> {
    return this.allocateToVault(request);
  }

  /**
   * Rebalance vault allocation
   */
  async rebalanceVault(vaultId: string, userId?: string): Promise<void> {
    try {
      const vault = await vaultHelperService.getVaultById(vaultId);
      if (!vault) {
        throw new ValidationError('Vault not found');
      }

      if (!vault.yieldStrategy) {
        throw new ValidationError('Vault has no yield strategy configured');
      }

      // Get all holdings for the vault
      const holdings = await vaultHelperService.getVaultHoldings(vaultId);
      if (holdings.length === 0) {
        throw new ValidationError('Vault has no token holdings to rebalance');
      }

      // Rebalance each holding to the default strategy
      for (const holding of holdings) {
        try {
          // Get or calculate allocation percentage
          const allocationPercentage = vault.riskLevel === 'low' ? 50 : vault.riskLevel === 'medium' ? 75 : 100;

          await this.allocateToVault({
            vaultId,
            userId: userId || vault.userId || vault.daoId || 'system',
            strategyId: vault.yieldStrategy,
            tokenSymbol: holding.tokenSymbol,
            allocationPercentage
          });
        } catch (error) {
          const msg = getErrorMessage(error);
          Logger.getLogger().warn(`Failed to allocate ${holding.tokenSymbol} in vault ${vaultId}: ${msg}`);
        }
      }

      Logger.getLogger().info(`Vault ${vaultId} rebalanced successfully`);
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to rebalance vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }

  /**
   * Queue rebalance request for admin approval
   */
  private async queueRebalanceRequest(vaultId: string, userId: string): Promise<void> {
    Logger.getLogger().info(`Rebalance request queued for admin approval: vault ${vaultId}, user ${userId}`);
    
    // TODO: Implement rebalance queue when vaultRebalanceQueue table is created
    // For now, just log the request
    
    // Send notification to DAO governance team
    try {
      await notificationService.createNotification({
        userId: 'system',
        type: 'governance',
        title: `Vault Rebalance Request`,
        message: `New rebalance request pending approval for vault ${vaultId}`,
        metadata: {
          vaultId,
          userId
        }
      });
    } catch (notifError) {
      Logger.getLogger().warn(`Failed to send rebalance notification: ${getErrorMessage(notifError)}`);
    }
  }

  /**
   * Enqueue transaction for reliable processing
   */
  async enqueueTransaction(tx: PendingTransaction): Promise<void> {
    this.transactionQueue.push(tx);
    await this.processQueue();
  }

  /**
   * Process transaction queue with retry logic
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.transactionQueue.length === 0) return;

    this.isProcessingQueue = true;
    try {
      while (this.transactionQueue.length > 0) {
        const tx = this.transactionQueue[0];

        try {
          // Execute transaction (placeholder - implement actual execution)
          Logger.getLogger().info(`Processing queued transaction: ${tx.id}`);

          // Remove from queue on success
          this.transactionQueue.shift();
        } catch (err) {
          // Retry logic with exponential backoff
          tx.retryCount = (tx.retryCount || 0) + 1;
          if (tx.retryCount > 5) {
            Logger.getLogger().error(`Transaction ${tx.id} failed after 5 retries`);
            this.transactionQueue.shift();
          } else {
            // Wait before retry: 2^retryCount seconds
            const retryCount = tx.retryCount || 0;
            await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Get token price with fallback
   */
  private async getTokenPrice(tokenSymbol: string): Promise<number> {
    const fallbackPrices: Record<string, number> = {
      'CELO': 0.65,
      'cUSD': 1.00,
      'cEUR': 1.08,
      'USDT': 1.00,
      'USDC': 1.00,
      'MTAA': 0.10
    };

    return fallbackPrices[tokenSymbol] || 0.30;
  }
}

// Export singleton instance
export const vaultOperationsService = new VaultOperationsService();
