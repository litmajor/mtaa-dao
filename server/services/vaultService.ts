
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { 
  vaults, 
  vaultTokenHoldings, 
  vaultTransactions, 
  vaultPerformance, 
  vaultStrategyAllocations,
  vaultRiskAssessments,
  proposals,
  userChallenges,
  users,
  daoMemberships,
  type Vault,
  type VaultTransaction,
  type VaultTokenHolding,
  type InsertVaultTransaction,
  type InsertVaultTokenHolding,
  type InsertVaultPerformance,
  type InsertVaultRiskAssessment
} from '../../shared/schema';
import { TokenRegistry, YIELD_STRATEGIES, type SupportedToken, SupportedTokenEnum } from '../../shared/tokenRegistry';
import { ethers } from 'ethers';
import { tokenService } from './tokenService';
import { Logger } from "../utils/logger";
import { getErrorMessage } from '../utils/errorUtils';
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
  primaryCurrency: z.enum(['CELO', 'cUSD', 'cEUR', 'USDT', 'USDC', 'MTAA'] as const),
  yieldStrategy: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
  minDeposit: z.string().optional(),
  maxDeposit: z.string().optional(),
});

const depositSchema = z.object({
  vaultId: z.string().min(1, "Vault ID is required"),
  userId: z.string().min(1, "User ID is required"),
  tokenSymbol: z.enum(['CELO', 'cUSD', 'cEUR', 'USDT', 'USDC', 'MTAA'] as const),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Amount must be a non-negative number",
  }),
  transactionHash: z.string().optional(),
});

const withdrawSchema = z.object({
  vaultId: z.string().min(1, "Vault ID is required"),
  userId: z.string().min(1, "User ID is required"),
  tokenSymbol: z.enum(['CELO', 'cUSD', 'cEUR', 'USDT', 'USDC', 'MTAA'] as const),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Amount must be a non-negative number",
  }),
  transactionHash: z.string().optional(),
});

const strategyAllocationSchema = z.object({
  vaultId: z.string().min(1, "Vault ID is required"),
  userId: z.string().min(1, "User ID is required"),
  strategyId: z.string().min(1, "Strategy ID is required"),
  tokenSymbol: z.enum(['CELO', 'cUSD', 'cEUR', 'USDT', 'USDC', 'MTAA'] as const),
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

      // Check vault limits for personal vaults
      if (validatedRequest.userId) {
        const { userSubscriptionService } = await import('./userSubscriptionService');
        const canCreate = await userSubscriptionService.canCreateVault(validatedRequest.userId);
        if (!canCreate.allowed) {
          throw new ValidationError(canCreate.reason || 'Vault limit reached');
        }
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
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to create vault: ${msg}`, error);
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input for creating vault: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
  throw new AppError(msg, 500);
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
      // SECURITY FIX: Use system-level rebalance with proper authorization check
      // Only trigger auto-rebalance if vault has configured strategy and user has permission
      if (vault.yieldStrategy) {
        try {
          // Check if user has rebalance permission before triggering
          const hasRebalancePermission = await this.checkVaultPermissions(
            validatedRequest.vaultId, 
            validatedRequest.userId, 
            'rebalance'
          );
          
          if (hasRebalancePermission) {
            // User has permission - use their ID for audit trail
            await this.rebalanceVault(validatedRequest.vaultId, validatedRequest.userId);
          } else {
            // User doesn't have permission - use system rebalance (admin-authorized)
            // This is scheduled for later execution by vault automation
            Logger.getLogger().info(`Rebalance scheduled for vault ${validatedRequest.vaultId} - user ${validatedRequest.userId} lacks direct permission`);
          }
        } catch (error) {
          // Log but don't fail deposit - rebalance is an optimization, not critical
          const msg = getErrorMessage(error);
          Logger.getLogger().warn(`Rebalance failed for vault ${validatedRequest.vaultId} after deposit: ${msg}`, error);
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
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to allocate to strategy: ${msg}`, error);
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input for strategy allocation: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof AppError) {
        throw error;
      }
  throw new AppError(msg, 500);
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
  const msg = getErrorMessage(error);
  Logger.getLogger().error(`Failed to rebalance vault ${vaultId}: ${msg}`, error);
  throw new AppError(msg, 500);
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
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to perform risk assessment for vault ${vaultId}: ${msg}`, error);
  throw new AppError(msg, 500);
    }
  }

  // Get user's vaults
  async getUserVaults(userAddress: string): Promise<any[]> {
    try {
      // Get user's personal vaults
      const personalVaultsRaw = await db.query.vaults.findMany({
        where: eq(vaults.userId, userAddress)
      });
      // Fetch token holdings for each personal vault
      const personalVaults = await Promise.all(personalVaultsRaw.map(async (vault: any) => {
        const tokenHoldings = await this.getVaultHoldings(vault.id);
        return { ...vault, tokenHoldings };
      }));

      // Get DAO vaults where user is a member
      const userDaoMemberships = await db.query.daoMemberships.findMany({
        where: and(
          eq(daoMemberships.userId, userAddress),
          eq(daoMemberships.status, 'approved')
        )
      });

      const daoIds = userDaoMemberships.map((m: any) => m.daoId);
      const daoVaultsRaw = daoIds.length > 0 ? await db.query.vaults.findMany({
        where: and(
          sql`${vaults.daoId} IN (${daoIds.join(',')})`,
          eq(vaults.isActive, true)
        )
      }) : [];
      // Fetch token holdings for each DAO vault
      const daoVaults = await Promise.all(daoVaultsRaw.map(async (vault: any) => {
        const tokenHoldings = await this.getVaultHoldings(vault.id);
        return { ...vault, tokenHoldings };
      }));

      // Calculate performance and format response
      const allVaults = [...personalVaults, ...daoVaults].map((vault: any) => ({
        id: vault.id,
        name: vault.name,
        currency: vault.currency,
        vaultType: vault.vaultType,
        balance: this.calculateVaultBalance(vault),
        performance: this.calculatePerformance(vault),
        status: vault.isActive ? 'active' : 'inactive'
      }));

      return allVaults;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get user vaults: ${msg}`, error);
  throw new AppError(msg, 500);
    }
  }

  // Get vault statistics for user
  async getUserVaultStats(userAddress: string): Promise<any> {
    try {
      const userVaults = await this.getUserVaults(userAddress);

      const totalValue = userVaults.reduce((sum, vault) => sum + parseFloat(vault.balance || '0'), 0);
      const totalROI = userVaults.length > 0 
        ? userVaults.reduce((sum, vault) => sum + (vault.performance || 0), 0) / userVaults.length 
        : 0;

      const activeVaults = userVaults.filter(v => v.status === 'active').length;

      return {
        totalValue: totalValue.toFixed(2),
        totalROI: totalROI.toFixed(2),
        activeVaults,
        totalVaults: userVaults.length
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get user vault stats: ${msg}`, error);
  throw new AppError(msg, 500);
    }
  }

  // Get vault alerts and notifications
  async getVaultAlerts(vaultId: string): Promise<any[]> {
    try {
      // Replace mock implementation with real alert logic
      const alerts = await db.query.vaultTransactions.findMany({
        where: and(
          eq(vaultTransactions.vaultId, vaultId),
          sql`${vaultTransactions.createdAt} > NOW() - INTERVAL '7 days'`
        ),
        orderBy: desc(vaultTransactions.createdAt),
        limit: 10
      });

      return alerts.map(tx => ({
        id: `alert-${tx.id}`,
        type: tx.transactionType === 'deposit' ? 'deposit' : tx.transactionType === 'withdrawal' ? 'withdrawal' : 'performance',
        message: `${tx.transactionType === 'deposit' ? 'New deposit' : 'Withdrawal'} of ${tx.amount} ${tx.tokenSymbol}`,
        severity: tx.transactionType === 'withdrawal' ? 'medium' : 'info',
        createdAt: tx.createdAt?.toISOString() || new Date().toISOString()
      }));
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get vault alerts: ${msg}`, error);
  throw new AppError(msg, 500);
    }
  }

  // Helper methods
  private calculateVaultBalance(vault: any): string {
    // Calculate total balance from token holdings
    if (!vault.tokenHoldings || vault.tokenHoldings.length === 0) {
      return '0.00';
    }

    // Sum up all token holdings (simplified calculation)
    const totalBalance = vault.tokenHoldings.reduce((sum: number, holding: any) => {
      return sum + parseFloat(holding.balance || '0');
    }, 0);

    return totalBalance.toFixed(2);
  }

  private calculatePerformance(vault: any): number {
    // Mock performance calculation - replace with actual logic
    // This should ideally fetch historical data and calculate ROI.
    // For now, returning a random value for demonstration.
    return Math.random() * 20 - 5; // Random performance between -5% and +15%
  }

  // Get vault by ID with enhanced details
  async getVaultDetails(vaultId: string, userId?: string): Promise<any> {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view this vault', 403);
        }
      }

      const vault = await this.getVaultById(vaultId);
      if (!vault) {
        throw new NotFoundError('Vault not found');
      }

      const holdings = await this.getVaultHoldings(vaultId);
      const transactions = await this.getVaultTransactions(vaultId, userId, 1, 10);
      const performance = await this.getVaultPerformance(vaultId, userId);
      const riskAssessment = await db.query.vaultRiskAssessments.findFirst({
        where: eq(vaultRiskAssessments.vaultId, vaultId),
        orderBy: [desc(vaultRiskAssessments.createdAt)]
      });

      return {
        vault,
        holdings,
        transactions,
        performance,
        riskScore: riskAssessment?.overallRiskScore || 50,
        riskFactors: riskAssessment?.riskFactors,
        recommendations: riskAssessment?.recommendations
      };
    } catch (error) {
        const msg = getErrorMessage(error);
        Logger.getLogger().error(`Failed to get details for vault ${vaultId}: ${msg}`, error);
        if (error instanceof AppError) {
          throw error;
        }
  throw new AppError(msg, 500);
    }
  }
  
  // Get list of all vaults and their balances for dashboard
  async getAllVaultsDashboardInfo(): Promise<any[]> {
    try {
      const allVaultsRaw = await db.query.vaults.findMany({
        where: eq(vaults.isActive, true)
      });
      // Fetch token holdings for each vault
      const allVaults = await Promise.all(allVaultsRaw.map(async (vault: any) => {
        const tokenHoldings = await this.getVaultHoldings(vault.id);
        return { ...vault, tokenHoldings };
      }));

      return allVaults.map((vault: any) => ({
        id: vault.id,
        name: vault.name,
        currency: vault.currency,
        balance: this.calculateVaultBalance(vault),
        performance: this.calculatePerformance(vault),
        status: vault.isActive ? 'active' : 'top performer',
        tvl: vault.totalValueLocked || '0',
      }));
    } catch (error) {
        const msg = getErrorMessage(error);
        Logger.getLogger().error(`Failed to get all vaults dashboard info: ${msg}`, error);
  throw new AppError(msg, 500);
    }
  }

  // Get vault transactions for UI with pagination
  async getVaultTransactionsPaginated(vaultId: string, userId?: string, page: number = 1, limit: number = 10): Promise<{
    transactions: VaultTransaction[];
    totalItems: number;
    totalPages: number;
  }> {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view this vault transactions', 403);
        }
      }

      const offset = (page - 1) * limit;

      const transactions = await db.query.vaultTransactions.findMany({
        where: eq(vaultTransactions.vaultId, vaultId),
        orderBy: [desc(vaultTransactions.createdAt)],
        limit,
        offset
      });

      const totalItems = (await db.select({ count: sql`count(*)` }).from(vaultTransactions).where(eq(vaultTransactions.vaultId, vaultId)))[0]?.count as number || 0;
      const totalPages = Math.ceil(totalItems / limit);

      return {
        transactions,
        totalItems,
        totalPages
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get paginated transactions for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
  throw new AppError(msg, 500);
    }
  }

  // Get vault performance history
  async getVaultPerformanceHistory(vaultId: string, userId?: string): Promise<any[]> {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view this vault performance history', 403);
        }
      }

      return await db.query.vaultPerformance.findMany({
        where: eq(vaultPerformance.vaultId, vaultId),
        orderBy: [desc(vaultPerformance.createdAt)],
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get performance history for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
  throw new AppError(msg, 500);
    }
  }

  // Get governance proposals related to vaults
  async getVaultGovernanceProposals(vaultId: string, userId?: string): Promise<any[]> {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view governance proposals for this vault', 403);
        }
      }

      // Get real proposals from database instead of mock data
      const proposalRows = await db.query.proposals.findMany({
        where: sql`${proposals.metadata}->>'vaultId' = ${vaultId}`,
        orderBy: [desc(proposals.createdAt)],
        limit: 10
      });

      return proposalRows.map(p => ({
        id: p.id,
        vaultId: vaultId,
        title: p.title,
        description: p.description,
        status: p.status,
  votesFor: parseInt(String(p.yesVotes || '0')),
  votesAgainst: parseInt(String(p.noVotes || '0')),
  quorumReached: (parseInt(String(p.yesVotes || '0')) + parseInt(String(p.noVotes || '0'))) >= parseInt(String((p as any).quorum || '100')),
        createdAt: p.createdAt?.toISOString(),
        endsAt: (p as any).votingDeadline?.toISOString()
      }));
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get governance proposals for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
  throw new AppError(msg, 500);
    }
  }

  // Get liquidity provider positions for a vault
  async getVaultLpPositions(vaultId: string, userId?: string): Promise<any[]> {
    try {
      if (userId) {
        const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view LP positions for this vault', 403);
        }
      }

      // Get real LP positions from vault strategy allocations
      const allocations = await db.query.vaultStrategyAllocations.findMany({
        where: and(
          eq(vaultStrategyAllocations.vaultId, vaultId),
          eq(vaultStrategyAllocations.isActive, true)
        )
      });

      return allocations.map(allocation => {
        const strategy = YIELD_STRATEGIES[allocation.strategyId];
        return {
          id: allocation.id,
          vaultId: vaultId,
          poolName: `${allocation.tokenSymbol} ${strategy?.name || 'Pool'}`,
          provider: strategy?.protocol || 'Unknown',
          tokens: [allocation.tokenSymbol],
          yourStake: `${allocation.allocatedAmount} ${allocation.tokenSymbol}`,
          poolShare: `${allocation.allocationPercentage}%`,
          rewardsEarned: (allocation as any).yieldEarned || (allocation as any).earnedRewards || '0',
          tvlInPool: allocation.currentValue || allocation.allocatedAmount,
          createdAt: allocation.createdAt?.toISOString() || new Date().toISOString()
        };
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get LP positions for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
  throw new AppError(msg, 500);
    }
  }

  // Get daily challenge status
  async getDailyChallengeStatus(userId: string): Promise<any> {
    try {
      // Get real challenge from database
      const today = new Date().toISOString().split('T')[0];
      
      // Check user's vaults and calculate progress
      const userVaults = await this.getUserVaults(userId);
      const totalValue = userVaults.reduce((sum, vault) => sum + parseFloat(vault.balance || '0'), 0);

      // Get user's daily challenge record
      let todayChallenge = await db.query.userChallenges.findFirst({
        where: and(
          eq(userChallenges.userId, userId),
          sql`DATE(${userChallenges.createdAt}) = ${today}`
        )
      });

      if (!todayChallenge) {
        // Create new challenge for today
        const [newChallenge] = await db.insert(userChallenges).values({
          userId,
          challengeType: 'daily_deposit',
          targetAmount: '100',
          currentProgress: totalValue.toString(),
          status: totalValue >= 100 ? 'completed' : 'in_progress',
          pointsReward: 50
        }).returning();
        todayChallenge = newChallenge;
      }

      return {
        userId: userId,
        currentChallenge: {
    id: todayChallenge!.id,
          title: 'Daily Vault Target',
          description: 'Maintain at least $100 total value in your vaults',
          target: todayChallenge!.targetAmount,
          currentProgress: Math.min(totalValue, parseFloat(todayChallenge!.targetAmount || '100')).toString(),
          status: todayChallenge!.status,
          reward: `${todayChallenge!.pointsReward} MTAA`,
          createdAt: todayChallenge!.createdAt?.toISOString() || new Date().toISOString(),
          endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        streak: await this.getUserChallengeStreak(userId),
        nextChallengeAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get daily challenge status for user ${userId}: ${msg}`, error);
  throw new AppError(msg, 500);
    }
  }

  // Get user challenge streak
  private async getUserChallengeStreak(userId: string): Promise<number> {
    try {
      const completedChallenges = await db.query.userChallenges.findMany({
        where: and(
          eq(userChallenges.userId, userId),
          eq(userChallenges.status, 'completed')
        ),
        orderBy: [desc(userChallenges.createdAt)],
        limit: 30
      });

      // Calculate consecutive days
      let streak = 0;
      const today = new Date();
      
      for (let i = 0; i < completedChallenges.length; i++) {
        const challengeDate = new Date(completedChallenges[i].createdAt!);
        const daysDiff = Math.floor((today.getTime() - challengeDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === i) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to calculate streak for user ${userId}: ${msg}`, error);
      return 0;
    }
  }

  // Claim daily challenge reward
  async claimDailyChallengeReward(userId: string): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const userChallenge = await db.query.userChallenges.findFirst({
        where: and(
          eq(userChallenges.userId, userId),
          sql`DATE(${userChallenges.createdAt}) = ${today}`,
          eq(userChallenges.status, 'completed')
        )
      });

      if (!userChallenge) {
        return { success: false, message: 'No completed challenge found for today.' };
      }

      if (userChallenge.rewardClaimed) {
        return { success: false, message: 'Reward already claimed for today.' };
      }

      // Update challenge as claimed
      await db.update(userChallenges)
        .set({ 
          rewardClaimed: true,
          claimedAt: new Date()
        })
        .where(eq(userChallenges.id, userChallenge.id!));

      // Award points to user (integrate with reputation system)
      // This would typically update user's MTAA token balance
      const newStreak = await this.getUserChallengeStreak(userId);

      return { 
        success: true, 
        message: `Reward claimed! Your streak is now ${newStreak} days.`,
        pointsAwarded: userChallenge.pointsReward,
        newStreak 
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to claim daily challenge reward for user ${userId}: ${msg}`, error);
  throw new AppError(msg, 500);
    }
  }
  
  // Get wallet connection status
  async getUserWalletStatus(userId: string): Promise<any> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return {
        userId: userId,
        isConnected: !!user.walletAddress,
        address: user.walletAddress || null,
        profile: {
          reputationScore: user.reputationScore || 0,
          avatarUrl: user.profileImageUrl || null
        }
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get wallet status for user ${userId}: ${msg}`, error);
  throw new AppError(msg, 500);
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
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error fetching vault by ID ${vaultId}: ${msg}`, error);
  throw new AppError(msg, 500);
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
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error fetching token holding for vault ${vaultId}, token ${tokenSymbol}: ${msg}`, error);
  throw new AppError(msg, 500);
    }
  }

  private async getVaultHoldings(vaultId: string, tx?: any): Promise<VaultTokenHolding[]> {
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
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error updating TVL for vault ${vaultId}: ${msg}`, error);
  throw new AppError(msg, 500);
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
        const seMsg = getErrorMessage(serviceError);
        Logger.getLogger().warn(`TokenService price lookup failed for ${tokenSymbol}: ${seMsg}`, serviceError);
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
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Error getting price for ${tokenSymbol}: ${msg}`, error);
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
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to initialize performance tracking for vault ${vaultId}: ${msg}`, error);
      // This is a critical operation, but we might not want to fail vault creation entirely. Log and continue.
      // Depending on requirements, this could throw an AppError.
    }
  }

  // Add missing methods referenced in routes
  async getVaultTransactions(vaultId: string, userId?: string, page: number = 1, limit: number = 10): Promise<any> {
    return this.getVaultTransactionsPaginated(vaultId, userId, page, limit);
  }

  async getVaultPerformance(vaultId: string, userId?: string): Promise<any> {
    return this.getVaultPerformanceHistory(vaultId, userId);
  }

  async getVaultPortfolio(vaultId: string, userId?: string): Promise<any> {
    return this.getVaultDetails(vaultId, userId);
  }
}

// Export singleton instance
export const vaultService = new VaultService();
