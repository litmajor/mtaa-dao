// Phase 3: Comprehensive Vault Service Layer for MtaaDAO
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { 
  vaults, 
  vaultTokenHoldings, 
  vaultTransactions, 
  vaultPerformance, 
  vaultStrategyAllocations,
  vaultRiskAssessments,
  daoMemberships,
  type Vault,
  type VaultTransaction,
  type VaultTokenHolding,
  type InsertVaultTransaction,
  type InsertVaultTokenHolding,
  type InsertVaultPerformance,
  type InsertVaultRiskAssessment
} from '../../shared/schema';
import { TokenRegistry, YIELD_STRATEGIES, type SupportedToken } from '../../shared/tokenRegistry';
import { ethers } from 'ethers';
import { tokenService } from './tokenService';
import { Logger } from "../utils/logger";
import { AppError, ValidationError, NotFoundError } from "../middleware/errorHandler";
import { z } from "zod";

export interface VaultDepositRequest {
  vaultId: string;
  userId: string;
  tokenSymbol: SupportedToken;
  amount: string; // in human-readable units
  transactionHash?: string;
}

export interface VaultWithdrawRequest {
  vaultId: string;
  userId: string;
  tokenSymbol: SupportedToken;
  amount: string; // in human-readable units
  transactionHash?: string;
}

export interface CreateVaultRequest {
  name: string;
  description?: string;
  userId?: string; // for personal vaults
  daoId?: string; // for DAO vaults
  vaultType: 'regular' | 'savings' | 'locked_savings' | 'yield' | 'dao_treasury';
  primaryCurrency: SupportedToken;
  yieldStrategy?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  minDeposit?: string;
  maxDeposit?: string;
}

export interface StrategyAllocationRequest {
  vaultId: string;
  userId: string; // Added for authorization
  strategyId: string;
  tokenSymbol: SupportedToken;
  allocationPercentage: number; // 0-100
}

type VaultOperation = 'view' | 'deposit' | 'withdraw' | 'allocate' | 'rebalance';

// Zod Schemas for validation
const createVaultSchema = z.object({
  name: z.string().min(1, "Vault name is required"),
  description: z.string().optional(),
  userId: z.string().optional(),
  daoId: z.string().optional(),
  vaultType: z.enum(['regular', 'savings', 'locked_savings', 'yield', 'dao_treasury']),
  primaryCurrency: z.nativeEnum(SupportedToken),
  yieldStrategy: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
  minDeposit: z.string().optional(),
  maxDeposit: z.string().optional(),
});

const depositSchema = z.object({
  vaultId: z.string().min(1, "Vault ID is required"),
  userId: z.string().min(1, "User ID is required"),
  tokenSymbol: z.nativeEnum(SupportedToken),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Amount must be a non-negative number",
  }),
  transactionHash: z.string().optional(),
});

const withdrawSchema = z.object({
  vaultId: z.string().min(1, "Vault ID is required"),
  userId: z.string().min(1, "User ID is required"),
  tokenSymbol: z.nativeEnum(SupportedToken),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Amount must be a non-negative number",
  }),
  transactionHash: z.string().optional(),
});

const strategyAllocationSchema = z.object({
  vaultId: z.string().min(1, "Vault ID is required"),
  userId: z.string().min(1, "User ID is required"),
  strategyId: z.string().min(1, "Strategy ID is required"),
  tokenSymbol: z.nativeEnum(SupportedToken),
  allocationPercentage: z.number().min(0).max(100),
});


export class VaultService {

  // Check if user has permission to perform specific vault operation
  private async checkVaultPermissions(
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

      // CRITICAL SECURITY: Operation-specific role requirements for DAO vaults
      switch (operation) {
        case 'view':
          // Anyone with approved membership can view
          return ['member', 'proposer', 'elder', 'admin'].includes(userRole);

        case 'deposit':
          // Members and above can deposit
          return ['member', 'proposer', 'elder', 'admin'].includes(userRole);

        case 'withdraw':
          // SECURITY FIX: Only admin and elder can withdraw from DAO vaults
          return ['admin', 'elder'].includes(userRole);

        case 'allocate':
        case 'rebalance':
          // SECURITY FIX: Only admin and elder can manage strategy allocations
          return ['admin', 'elder'].includes(userRole);

        default:
          Logger.getLogger().error(`Invalid operation type '${operation}' for permission check.`);
          return false;
      }
    }

    Logger.getLogger().warn(`Vault ${vaultId} has neither userId nor daoId.`);
    return false;
  }

  // Create a new vault
  async createVault(request: CreateVaultRequest): Promise<Vault> {
    try {
      const validatedRequest = createVaultSchema.parse(request);

      // Validate ownership
      if (!validatedRequest.userId && !validatedRequest.daoId) {
        throw new ValidationError('Either userId or daoId must be specified');
      }
      if (validatedRequest.userId && validatedRequest.daoId) {
        throw new ValidationError('Cannot specify both userId and daoId');
      }

      // Validate token
      const token = TokenRegistry.getToken(validatedRequest.primaryCurrency);
      if (!token) {
        throw new ValidationError(`Unsupported token: ${validatedRequest.primaryCurrency}`);
      }

      // Validate yield strategy if provided
      if (validatedRequest.yieldStrategy && !YIELD_STRATEGIES[validatedRequest.yieldStrategy]) {
        throw new ValidationError(`Invalid yield strategy: ${validatedRequest.yieldStrategy}`);
      }

      // Validate min/max deposit amounts
      if (validatedRequest.minDeposit) {
        ethers.parseUnits(validatedRequest.minDeposit, token.decimals);
      }
      if (validatedRequest.maxDeposit) {
        ethers.parseUnits(validatedRequest.maxDeposit, token.decimals);
      }
      if (validatedRequest.minDeposit && validatedRequest.maxDeposit && 
          ethers.parseUnits(validatedRequest.minDeposit, token.decimals) > ethers.parseUnits(validatedRequest.maxDeposit, token.decimals)) {
        throw new ValidationError("Minimum deposit cannot be greater than maximum deposit");
      }

      // Calculate lockedUntil for locked_savings vaults
      let lockedUntil = null;
      if (validatedRequest.vaultType === 'locked_savings') {
        const lockDurationDays = 30; // Default 30 days lock period
        lockedUntil = new Date(Date.now() + lockDurationDays * 24 * 60 * 60 * 1000);
      }

      const [newVault] = await db.insert(vaults).values({
        name: validatedRequest.name,
        description: validatedRequest.description,
        userId: validatedRequest.userId || null,
        daoId: validatedRequest.daoId || null,
        currency: validatedRequest.primaryCurrency,
        vaultType: validatedRequest.vaultType,
        yieldStrategy: validatedRequest.yieldStrategy,
        riskLevel: validatedRequest.riskLevel,
        minDeposit: validatedRequest.minDeposit || '0',
        maxDeposit: validatedRequest.maxDeposit,
        lockedUntil: lockedUntil,
        isActive: true
      }).returning();

      // Initialize performance tracking
      await this.initializePerformanceTracking(newVault.id);

      // Perform initial risk assessment
      await this.performRiskAssessment(newVault.id);

      return newVault;
    } catch (error) {
      Logger.getLogger().error(`Failed to create vault: ${error.message}`, error);
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input for creating vault: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create vault', 500, error.message);
    }
  }

  // Deposit tokens into a vault
  async depositToken(request: VaultDepositRequest): Promise<VaultTransaction> {
    try {
      const validatedRequest = depositSchema.parse(request);

      // Check authorization first
      const hasPermission = await this.checkVaultPermissions(validatedRequest.vaultId, validatedRequest.userId, 'deposit');
      if (!hasPermission) {
        throw new AppError('Unauthorized: You do not have permission to deposit to this vault', 403);
      }

      const vault = await this.getVaultById(validatedRequest.vaultId);
      if (!vault) {
        throw new NotFoundError('Vault not found');
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

      // Get current USD value using TokenService - calculate after database operations
      const priceUSD = await this.getTokenPriceUSD(validatedRequest.tokenSymbol);
      const depositAmountFloat = parseFloat(ethers.formatUnits(depositAmountWei, token.decimals));
      const valueUSD = depositAmountFloat * priceUSD;

      // Wrap critical operations in database transaction
      const result = await db.transaction(async (tx) => {
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

        // Update or create token holding using BigInt precision
        await this.updateTokenHolding(validatedRequest.vaultId, validatedRequest.tokenSymbol, depositAmountWei, true, tx);

        // Update vault balance and TVL
        await this.updateVaultTVL(validatedRequest.vaultId, tx);

        return transaction;
      });

      // Trigger strategy allocation if configured (outside transaction)
      // CRITICAL FIX #1: Call rebalanceVault without userId to prevent authorization failures
      // Regular DAO members can deposit but may not have rebalance permissions
      if (vault.yieldStrategy) {
        try {
          await this.rebalanceVault(validatedRequest.vaultId);
        } catch (error) {
          // Log but don't fail deposit - rebalance is an optimization, not critical
          Logger.getLogger().warn(`Rebalance failed for vault ${validatedRequest.vaultId} after deposit: ${error.message}`, error);
        }
      }

      return result;
    } catch (error) {
      Logger.getLogger().error(`Failed to deposit token: ${error.message}`, error);
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input for deposit: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to deposit token', 500, error.message);
    }
  }

  // Withdraw tokens from a vault
  async withdrawToken(request: VaultWithdrawRequest): Promise<VaultTransaction> {
    try {
      const validatedRequest = withdrawSchema.parse(request);

      // Check authorization first
      const hasPermission = await this.checkVaultPermissions(validatedRequest.vaultId, validatedRequest.userId, 'withdraw');
      if (!hasPermission) {
        throw new AppError('Unauthorized: You do not have permission to withdraw from this vault', 403);
      }

      const vault = await this.getVaultById(validatedRequest.vaultId);
      if (!vault) {
        throw new NotFoundError('Vault not found');
      }

      // Get current token holding
      const holding = await this.getTokenHolding(validatedRequest.vaultId, validatedRequest.tokenSymbol);
      if (!holding) {
        throw new NotFoundError('No holdings found for this token');
      }

      // Validate token for proper decimal handling
      const token = TokenRegistry.getToken(validatedRequest.tokenSymbol);
      if (!token) {
        throw new ValidationError(`Unsupported token: ${validatedRequest.tokenSymbol}`);
      }

      // Use BigInt arithmetic for precise decimal handling
      const withdrawAmountWei = ethers.parseUnits(validatedRequest.amount, token.decimals);
      const currentBalanceWei = ethers.parseUnits(holding.balance, token.decimals);

      if (withdrawAmountWei > currentBalanceWei) {
        throw new ValidationError(`Insufficient balance. Requested: ${validatedRequest.amount}, Available: ${holding.balance}`);
      }

      // Check if vault is locked
      if (vault.vaultType === 'locked_savings' && vault.lockedUntil && new Date() < vault.lockedUntil) {
        throw new ValidationError('Vault is still locked for withdrawals');
      }

      // Get current USD value using TokenService - calculate after validation
      const priceUSD = await this.getTokenPriceUSD(validatedRequest.tokenSymbol);
      const withdrawAmountFloat = parseFloat(ethers.formatUnits(withdrawAmountWei, token.decimals));
      const valueUSD = withdrawAmountFloat * priceUSD;

      // Wrap critical operations in database transaction
      const result = await db.transaction(async (tx) => {
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

        // Update token holding using BigInt precision
        await this.updateTokenHolding(validatedRequest.vaultId, validatedRequest.tokenSymbol, withdrawAmountWei * BigInt(-1), false, tx);

        // Update vault TVL
        await this.updateVaultTVL(validatedRequest.vaultId, tx);

        return transaction;
      });

      return result;
    } catch (error) {
      Logger.getLogger().error(`Failed to withdraw token: ${error.message}`, error);
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input for withdrawal: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to withdraw token', 500, error.message);
    }
  }

  // Allocate funds to yield strategy
  async allocateToStrategy(request: StrategyAllocationRequest): Promise<void> {
    try {
      const validatedRequest = strategyAllocationSchema.parse(request);

      // Check authorization first
      const hasPermission = await this.checkVaultPermissions(validatedRequest.vaultId, validatedRequest.userId, 'allocate');
      if (!hasPermission) {
        throw new AppError('Unauthorized: You do not have permission to allocate strategy for this vault', 403);
      }

      const vault = await this.getVaultById(validatedRequest.vaultId);
      if (!vault) {
        throw new NotFoundError('Vault not found');
      }

      const strategy = YIELD_STRATEGIES[validatedRequest.strategyId];
      if (!strategy) {
        throw new ValidationError(`Invalid strategy: ${validatedRequest.strategyId}`);
      }

      if (!strategy.supportedTokens.includes(validatedRequest.tokenSymbol)) {
        throw new ValidationError(`Strategy ${validatedRequest.strategyId} does not support token ${validatedRequest.tokenSymbol}`);
      }

      const holding = await this.getTokenHolding(validatedRequest.vaultId, validatedRequest.tokenSymbol);
      if (!holding) {
        throw new NotFoundError('No token holdings found');
      }

      // Use proper decimal handling
      const token = TokenRegistry.getToken(validatedRequest.tokenSymbol);
      if (!token) {
        throw new ValidationError(`Unsupported token: ${validatedRequest.tokenSymbol}`);
      }

      const totalBalanceWei = ethers.parseUnits(holding.balance, token.decimals);
      const allocationAmountWei = (totalBalanceWei * BigInt(Math.round(validatedRequest.allocationPercentage * 100))) / BigInt(10000);
      const allocationAmount = ethers.formatUnits(allocationAmountWei, token.decimals);

      // Check if allocation already exists
      const existingAllocation = await db.query.vaultStrategyAllocations.findFirst({
        where: and(
          eq(vaultStrategyAllocations.vaultId, validatedRequest.vaultId),
          eq(vaultStrategyAllocations.strategyId, validatedRequest.strategyId),
          eq(vaultStrategyAllocations.tokenSymbol, validatedRequest.tokenSymbol)
        )
      });

      if (existingAllocation) {
        // Update existing allocation
        await db.update(vaultStrategyAllocations)
          .set({
            allocatedAmount: allocationAmount.toString(),
            allocationPercentage: validatedRequest.allocationPercentage.toString(),
            lastRebalance: new Date(),
            updatedAt: new Date()
          })
          .where(eq(vaultStrategyAllocations.id, existingAllocation.id!));
      } else {
        // Create new allocation
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
    } catch (error) {
      Logger.getLogger().error(`Failed to allocate to strategy: ${error.message}`, error);
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input for strategy allocation: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to allocate to strategy', 500, error.message);
    }
  }

  // Rebalance vault strategy allocations
  async rebalanceVault(vaultId: string, userId?: string): Promise<void> {
    try {
      // Check authorization if userId provided
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'rebalance');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to rebalance this vault', 403);
        }
      }

      const vault = await this.getVaultById(vaultId);
      if (!vault || !vault.yieldStrategy) {
        Logger.getLogger().info(`Vault ${vaultId} has no yield strategy, skipping rebalance.`);
        return;
      }

      const allocations = await db.query.vaultStrategyAllocations.findMany({
        where: and(
          eq(vaultStrategyAllocations.vaultId, vaultId),
          eq(vaultStrategyAllocations.isActive, true)
        )
      });

      // Update allocations based on current market conditions using proper decimal handling
      for (const allocation of allocations) {
        const holding = await this.getTokenHolding(vaultId, allocation.tokenSymbol);
        if (holding) {
          const token = TokenRegistry.getToken(allocation.tokenSymbol);
          if (!token) {
            Logger.getLogger().warn(`Token ${allocation.tokenSymbol} not found in registry during rebalance.`);
            continue; 
          }

          const totalBalanceWei = ethers.parseUnits(holding.balance, token.decimals);
          const targetPercentage = parseFloat(allocation.allocationPercentage);
          const newAllocationWei = (totalBalanceWei * BigInt(Math.round(targetPercentage * 100))) / BigInt(10000);
          const newAllocation = ethers.formatUnits(newAllocationWei, token.decimals);

          await db.update(vaultStrategyAllocations)
            .set({
              allocatedAmount: newAllocation,
              currentValue: newAllocation,
              lastRebalance: new Date(),
              updatedAt: new Date()
            })
            .where(eq(vaultStrategyAllocations.id, allocation.id!));
        }
      }

      // Record rebalance transaction
      await db.insert(vaultTransactions).values({
        vaultId: vaultId,
        userId: userId || vault.userId || vault.daoId || 'system', // Use provided userId if available, else vault owner/DAO
        transactionType: 'rebalance',
        tokenSymbol: vault.currency as SupportedToken, // Assuming vault currency is the primary token for rebalance tx
        amount: '0', // Rebalance doesn't involve a direct amount change in this transaction type
        valueUSD: '0', // Value will be implicitly updated in holdings
        status: 'completed',
        metadata: { allocationsUpdated: allocations.length }
      });
    } catch (error) {
      Logger.getLogger().error(`Failed to rebalance vault ${vaultId}: ${error.message}`, error);
      throw new AppError(`Failed to rebalance vault ${vaultId}`, 500, error.message);
    }
  }

  // Perform comprehensive risk assessment
  async performRiskAssessment(vaultId: string): Promise<void> {
    try {
      const vault = await this.getVaultById(vaultId);
      if (!vault) {
        throw new NotFoundError('Vault not found');
      }

      const holdings = await this.getVaultHoldings(vaultId);
      const allocations = await db.query.vaultStrategyAllocations.findMany({
        where: eq(vaultStrategyAllocations.vaultId, vaultId)
      });

      // Calculate risk scores (1-100 scale)
      let liquidityRisk = 10; // Base liquidity risk
      let smartContractRisk = 5; // Base smart contract risk
      let marketRisk = 15; // Base market risk
      let concentrationRisk = 0;
      let protocolRisk = 0;

      // Assess concentration risk
      if (holdings.length === 1) {
        concentrationRisk = 80; // High concentration risk
      } else if (holdings.length <= 3) {
        concentrationRisk = 40; // Medium concentration risk
      } else {
        concentrationRisk = 10; // Low concentration risk
      }

      // Assess protocol risk from strategies
      for (const allocation of allocations) {
        const strategy = YIELD_STRATEGIES[allocation.strategyId];
        if (strategy) {
          switch (strategy.riskLevel) {
            case 'high':
              protocolRisk += 30;
              break;
            case 'medium':
              protocolRisk += 15;
              break;
            case 'low':
              protocolRisk += 5;
              break;
          }
        }
      }

      protocolRisk = Math.min(protocolRisk, 100); // Cap at 100

      // Calculate overall risk score
      const overallRiskScore = Math.round(
        (liquidityRisk + smartContractRisk + marketRisk + concentrationRisk + protocolRisk) / 5
      );

      // Generate risk factors and recommendations
      const riskFactors = {
        tokenConcentration: holdings.length <= 3,
        highYieldStrategies: allocations.some(a => {
          const strategy = YIELD_STRATEGIES[a.strategyId];
          return strategy?.riskLevel === 'high';
        }),
        lockedFunds: vault.vaultType === 'locked_savings',
        newVault: vault.createdAt ? new Date(vault.createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000 : true // Less than 30 days old
      };

      const recommendations = [];
      if (riskFactors.tokenConcentration) {
        recommendations.push('Diversify token holdings to reduce concentration risk');
      }
      if (riskFactors.highYieldStrategies) {
        recommendations.push('Consider reducing allocation to high-risk strategies');
      }
      if (overallRiskScore > 70) {
        recommendations.push('Overall risk level is high - consider rebalancing');
      }

      // Save risk assessment
      await db.insert(vaultRiskAssessments).values({
        vaultId: vaultId,
        overallRiskScore,
        liquidityRisk,
        smartContractRisk,
        marketRisk,
        concentrationRisk,
        protocolRisk,
        riskFactors,
        recommendations,
        nextAssessmentDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        assessedBy: vault.userId || vault.daoId || 'system'
      });
    } catch (error) {
      Logger.getLogger().error(`Failed to perform risk assessment for vault ${vaultId}: ${error.message}`, error);
      throw new AppError(`Failed to perform risk assessment for vault ${vaultId}`, 500, error.message);
    }
  }

  // Get user's vaults
  async getUserVaults(userId: string, daoId?: string): Promise<Vault[]> {
    try {
      if (daoId) {
        // Get DAO vaults where user has membership
        const membership = await db.query.daoMemberships.findFirst({
          where: and(
            eq(daoMemberships.daoId, daoId),
            eq(daoMemberships.userId, userId),
            eq(daoMemberships.status, 'approved')
          )
        });

        if (!membership || membership.isBanned) {
          Logger.getLogger().warn(`User ${userId} is not an approved member of DAO ${daoId} or is banned.`);
          return [];
        }

        return await db.query.vaults.findMany({
          where: eq(vaults.daoId, daoId)
        });
      } else {
        // Get personal vaults
        return await db.query.vaults.findMany({
          where: eq(vaults.userId, userId)
        });
      }
    } catch (error) {
      Logger.getLogger().error(`Failed to get vaults for user ${userId} (DAO: ${daoId}): ${error.message}`, error);
      throw new AppError(`Failed to retrieve vaults`, 500, error.message);
    }
  }

  // Get vault performance
  async getVaultPerformance(vaultId: string, userId?: string): Promise<any> {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view this vault performance', 403);
        }
      }

      return await db.query.vaultPerformance.findMany({
        where: eq(vaultPerformance.vaultId, vaultId),
        orderBy: [desc(vaultPerformance.createdAt)],
        limit: 10
      });
    } catch (error) {
      Logger.getLogger().error(`Failed to get performance for vault ${vaultId}: ${error.message}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve vault performance', 500, error.message);
    }
  }

  // Get vault transactions
  async getVaultTransactions(vaultId: string, userId?: string, page: number = 1, limit: number = 20): Promise<VaultTransaction[]> {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view this vault transactions', 403);
        }
      }

      const offset = (page - 1) * limit;

      return await db.query.vaultTransactions.findMany({
        where: eq(vaultTransactions.vaultId, vaultId),
        orderBy: [desc(vaultTransactions.createdAt)],
        limit,
        offset
      });
    } catch (error) {
      Logger.getLogger().error(`Failed to get transactions for vault ${vaultId}: ${error.message}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve vault transactions', 500, error.message);
    }
  }

  // Get vault portfolio summary with authorization check
  async getVaultPortfolio(vaultId: string, userId?: string): Promise<{
    vault: Vault;
    holdings: VaultTokenHolding[];
    totalValueUSD: number;
    performance: any;
    riskScore: number;
  }> {
    try {
      // Check authorization if userId provided
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view this vault portfolio', 403);
        }
      }

      const vault = await this.getVaultById(vaultId);
      if (!vault) {
        throw new NotFoundError('Vault not found');
      }

      const holdings = await this.getVaultHoldings(vaultId);

      // Calculate total value
      let totalValueUSD = 0;
      for (const holding of holdings) {
        totalValueUSD += parseFloat(holding.valueUSD || '0');
      }

      // Get latest performance
      const performance = await db.query.vaultPerformance.findFirst({
        where: eq(vaultPerformance.vaultId, vaultId),
        orderBy: [desc(vaultPerformance.createdAt)]
      });

      // Get latest risk score
      const riskAssessment = await db.query.vaultRiskAssessments.findFirst({
        where: eq(vaultRiskAssessments.vaultId, vaultId),
        orderBy: [desc(vaultRiskAssessments.createdAt)]
      });

      return {
        vault,
        holdings,
        totalValueUSD,
        performance,
        riskScore: riskAssessment?.overallRiskScore || 50
      };
    } catch (error) {
      Logger.getLogger().error(`Failed to get portfolio for vault ${vaultId}: ${error.message}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve vault portfolio', 500, error.message);
    }
  }

  // Helper methods
  async getVaultById(vaultId: string): Promise<Vault | null> {
    try {
      const result = await db.query.vaults.findFirst({
        where: eq(vaults.id, vaultId)
      });
      return result || null;
    } catch (error) {
      Logger.getLogger().error(`Error fetching vault by ID ${vaultId}: ${error.message}`, error);
      throw new AppError(`Database error retrieving vault ${vaultId}`, 500, error.message);
    }
  }

  private async getTokenHolding(
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
      Logger.getLogger().error(`Error fetching token holding for vault ${vaultId}, token ${tokenSymbol}: ${error.message}`, error);
      throw new AppError(`Database error retrieving holding for ${tokenSymbol}`, 500, error.message);
    }
  }

  private async getVaultHoldings(vaultId: string, tx?: any): Promise<VaultTokenHolding[]> {
    try {
      const dbConnection = tx || db;
      return await dbConnection.query.vaultTokenHoldings.findMany({
        where: eq(vaultTokenHoldings.vaultId, vaultId)
      });
    } catch (error) {
      Logger.getLogger().error(`Error fetching all holdings for vault ${vaultId}: ${error.message}`, error);
      throw new AppError(`Database error retrieving holdings for vault ${vaultId}`, 500, error.message);
    }
  }

  private async updateTokenHolding(
    vaultId: string, 
    tokenSymbol: string, 
    amountWei: bigint, 
    isDeposit: boolean,
    tx?: any
  ): Promise<void> {
    const dbConnection = tx || db;
    const token = TokenRegistry.getToken(tokenSymbol);
    if (!token) {
      throw new ValidationError(`Token ${tokenSymbol} not found in registry`);
    }

    const priceUSD = await this.getTokenPriceUSD(tokenSymbol);
    const amountFloat = parseFloat(ethers.formatUnits(amountWei < 0 ? -amountWei : amountWei, token.decimals));

    // CRITICAL CONCURRENCY FIX: Use row locking to find existing holding
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

      // ATOMIC UPDATE: Use SQL-level constraints to prevent race conditions
      const amountDelta = ethers.formatUnits(amountWei, token.decimals);

      // For withdrawals (negative amounts), enforce balance constraint at SQL level
      const updateResult = await dbConnection.update(vaultTokenHoldings)
        .set({
          // Use SQL expressions for atomic balance updates
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
          // CRITICAL: Only update if balance constraint is satisfied
          sql`(CAST(${holdingRecord.balance} AS NUMERIC) + CAST(${amountDelta} AS NUMERIC)) >= 0`
        ))
        .execute();

      // Check if the atomic update succeeded
      if (!updateResult || (updateResult as any).rowCount === 0) {
        // Get current balance for detailed error message
        const currentHolding = await this.getTokenHolding(vaultId, tokenSymbol, tx);
        const currentBalance = currentHolding?.balance || '0';
        const requestedAmount = ethers.formatUnits(amountWei < 0n ? -amountWei : amountWei, token.decimals);

        throw new ValidationError(
          `Insufficient balance for withdrawal. Available: ${parseFloat(currentBalance).toFixed(6)}, ` +
          `Requested: ${requestedAmount}. This may be due to concurrent operations or insufficient funds.`
        );
      }
    } else {
      // Create new holding - no concurrency risk for new records
      const balanceStr = ethers.formatUnits(amountWei, token.decimals);
      const balanceFloat = parseFloat(balanceStr);

      // Prevent creating holdings with negative balances
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

  private async updateVaultTVL(vaultId: string, tx?: any): Promise<void> {
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
      Logger.getLogger().error(`Error updating TVL for vault ${vaultId}: ${error.message}`, error);
      throw new AppError(`Database error updating TVL for vault ${vaultId}`, 500, error.message);
    }
  }

  private async getTokenPriceUSD(tokenSymbol: string): Promise<number> {
    try {
      // CRITICAL FIX #3: Integrate with actual TokenService before using fallback prices
      const token = TokenRegistry.getToken(tokenSymbol);
      if (!token) {
        throw new ValidationError(`Token ${tokenSymbol} not found in registry`);
      }

      // First, try to get real price from TokenService if available
      try {
        // Try to get current market price from TokenService
        // This will use external APIs like CoinGecko, DeFiLlama, etc.
        if (tokenService && typeof tokenService.getTokenPrice === 'function') {
          const realPrice = await tokenService.getTokenPrice(tokenSymbol);
          if (realPrice && realPrice > 0) {
            Logger.getLogger().debug(`Got real price for ${tokenSymbol}: $${realPrice}`);
            return realPrice;
          }
        }

        // Alternative: Try getting balance as price indicator for native CELO
        if (tokenSymbol === 'CELO' && tokenService && tokenService.provider) {
          // For CELO, we can get a baseline from network activity, but still need external price
          Logger.getLogger().debug(`Using CELO network provider but still need external price feed`);
        }
      } catch (serviceError) {
        Logger.getLogger().warn(`TokenService price lookup failed for ${tokenSymbol}: ${serviceError.message}`, serviceError);
        // Continue to fallback pricing
      }

      // Fallback to conservative market-based pricing if TokenService unavailable
      Logger.getLogger().debug(`Using fallback pricing for ${tokenSymbol}`);
      const fallbackPrices: Record<string, number> = {
        'CELO': 0.65,    // Conservative CELO price
        'cUSD': 1.00,    // Celo Dollar should be stable
        'cEUR': 1.08,    // Celo Euro should track EUR/USD
        'USDT': 1.00,    // USDT should be stable
        'MTAA': 0.10     // Community token - conservative estimate
      };

      let price = fallbackPrices[tokenSymbol];

      // If no fallback price available, determine based on token properties
      if (!price) {
        if (tokenSymbol.includes('USD') || tokenSymbol.includes('EUR')) {
          price = 1.00; // Assume stablecoins are $1
        } else if (token.category === 'community') {
          price = 0.10; // Conservative price for community tokens
        } else if (token.category === 'bridged') {
          price = 0.50; // Conservative price for bridged tokens
        } else {
          price = 0.30; // Very conservative default
        }
      }

      // Apply risk-based pricing adjustments for non-stable tokens
      if (token.category === 'community' && token.riskLevel === 'high') {
        price *= 0.9; // 10% discount for high-risk community tokens
      }

      if (token.category === 'bridged' && !token.isActive) {
        price *= 0.95; // 5% discount for inactive bridged tokens
      }

      return price;
    } catch (error) {
      Logger.getLogger().error(`Error getting price for ${tokenSymbol}: ${error.message}`, error);
      // Ultra-conservative fallback pricing
      return tokenSymbol.includes('USD') || tokenSymbol.includes('EUR') ? 1.00 : 0.30;
    }
  }

  private async initializePerformanceTracking(vaultId: string): Promise<void> {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Check if performance record already exists for today to avoid duplicates
      const existingPerformance = await db.query.vaultPerformance.findFirst({
        where: and(
          eq(vaultPerformance.vaultId, vaultId),
          gte(vaultPerformance.createdAt, startOfDay),
          lte(vaultPerformance.createdAt, endOfDay)
        )
      });

      if (!existingPerformance) {
        await db.insert(vaultPerformance).values({
          vaultId,
          period: 'daily',
          periodStart: startOfDay,
          periodEnd: endOfDay,
          startingValue: '0',
          endingValue: '0',
          yield: '0',
          yieldPercentage: '0'
        });
      }
    } catch (error) {
      Logger.getLogger().error(`Failed to initialize performance tracking for vault ${vaultId}: ${error.message}`, error);
      // This is a critical operation, but we might not want to fail vault creation entirely. Log and continue.
      // Depending on requirements, this could throw an AppError.
    }
  }
}

// Export singleton instance
export const vaultService = new VaultService();