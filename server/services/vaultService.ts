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

export class VaultService {
  
  // Check if user has permission to perform specific vault operation
  private async checkVaultPermissions(
    vaultId: string, 
    userId: string, 
    operation: VaultOperation = 'view'
  ): Promise<boolean> {
    const vault = await this.getVaultById(vaultId);
    if (!vault) {
      throw new Error('Vault not found');
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
          return false;
      }
    }

    return false;
  }

  // Create a new vault
  async createVault(request: CreateVaultRequest): Promise<Vault> {
    // Validate ownership
    if (!request.userId && !request.daoId) {
      throw new Error('Either userId or daoId must be specified');
    }
    if (request.userId && request.daoId) {
      throw new Error('Cannot specify both userId and daoId');
    }

    // Validate token
    const token = TokenRegistry.getToken(request.primaryCurrency);
    if (!token) {
      throw new Error(`Unsupported token: ${request.primaryCurrency}`);
    }

    // Validate yield strategy if provided
    if (request.yieldStrategy && !YIELD_STRATEGIES[request.yieldStrategy]) {
      throw new Error(`Invalid yield strategy: ${request.yieldStrategy}`);
    }

    // Calculate lockedUntil for locked_savings vaults
    let lockedUntil = null;
    if (request.vaultType === 'locked_savings') {
      const lockDurationDays = 30; // Default 30 days lock period
      lockedUntil = new Date(Date.now() + lockDurationDays * 24 * 60 * 60 * 1000);
    }

    const [newVault] = await db.insert(vaults).values({
      name: request.name,
      description: request.description,
      userId: request.userId || null,
      daoId: request.daoId || null,
      currency: request.primaryCurrency,
      vaultType: request.vaultType,
      yieldStrategy: request.yieldStrategy,
      riskLevel: request.riskLevel || 'low',
      minDeposit: request.minDeposit || '0',
      maxDeposit: request.maxDeposit || null,
      lockedUntil: lockedUntil,
      isActive: true
    }).returning();

    // Initialize performance tracking
    await this.initializePerformanceTracking(newVault.id);
    
    // Perform initial risk assessment
    await this.performRiskAssessment(newVault.id);

    return newVault;
  }

  // Deposit tokens into a vault
  async depositToken(request: VaultDepositRequest): Promise<VaultTransaction> {
    // Check authorization first
    const hasPermission = await this.checkVaultPermissions(request.vaultId, request.userId, 'deposit');
    if (!hasPermission) {
      throw new Error('Unauthorized: You do not have permission to deposit to this vault');
    }

    const vault = await this.getVaultById(request.vaultId);
    if (!vault) {
      throw new Error('Vault not found');
    }

    if (!vault.isActive) {
      throw new Error('Vault is not active');
    }

    // Validate token
    const token = TokenRegistry.getToken(request.tokenSymbol);
    if (!token) {
      throw new Error(`Unsupported token: ${request.tokenSymbol}`);
    }

    // Use BigInt arithmetic for precise decimal handling
    const depositAmountWei = ethers.parseUnits(request.amount, token.decimals);
    
    // Check minimum deposit
    if (vault.minDeposit) {
      const minDepositWei = ethers.parseUnits(vault.minDeposit, token.decimals);
      if (depositAmountWei < minDepositWei) {
        throw new Error(`Deposit amount ${request.amount} below minimum ${vault.minDeposit}`);
      }
    }

    // Check maximum deposit if set
    if (vault.maxDeposit) {
      const maxDepositWei = ethers.parseUnits(vault.maxDeposit, token.decimals);
      if (depositAmountWei > maxDepositWei) {
        throw new Error(`Deposit amount ${request.amount} exceeds maximum ${vault.maxDeposit}`);
      }
    }

    // Get current USD value using TokenService - calculate after database operations
    const priceUSD = await this.getTokenPriceUSD(request.tokenSymbol);
    const depositAmountFloat = parseFloat(ethers.formatUnits(depositAmountWei, token.decimals));
    const valueUSD = depositAmountFloat * priceUSD;

    // Wrap critical operations in database transaction
    const result = await db.transaction(async (tx) => {
      // Create transaction record
      const [transaction] = await tx.insert(vaultTransactions).values({
        vaultId: request.vaultId,
        userId: request.userId,
        transactionType: 'deposit',
        tokenSymbol: request.tokenSymbol,
        amount: request.amount,
        valueUSD: valueUSD.toString(),
        transactionHash: request.transactionHash,
        status: 'completed'
      }).returning();

      // Update or create token holding using BigInt precision
      await this.updateTokenHolding(request.vaultId, request.tokenSymbol, depositAmountWei, true, tx);

      // Update vault balance and TVL
      await this.updateVaultTVL(request.vaultId, tx);

      return transaction;
    });

    // Trigger strategy allocation if configured (outside transaction)
    // CRITICAL FIX #1: Call rebalanceVault without userId to prevent authorization failures
    // Regular DAO members can deposit but may not have rebalance permissions
    if (vault.yieldStrategy) {
      try {
        await this.rebalanceVault(request.vaultId);
      } catch (error) {
        // Log but don't fail deposit - rebalance is an optimization, not critical
        console.warn(`Rebalance failed for vault ${request.vaultId}:`, error);
      }
    }

    return result;
  }

  // Withdraw tokens from a vault
  async withdrawToken(request: VaultWithdrawRequest): Promise<VaultTransaction> {
    // Check authorization first
    const hasPermission = await this.checkVaultPermissions(request.vaultId, request.userId, 'withdraw');
    if (!hasPermission) {
      throw new Error('Unauthorized: You do not have permission to withdraw from this vault');
    }

    const vault = await this.getVaultById(request.vaultId);
    if (!vault) {
      throw new Error('Vault not found');
    }

    // Get current token holding
    const holding = await this.getTokenHolding(request.vaultId, request.tokenSymbol);
    if (!holding) {
      throw new Error('No holdings found for this token');
    }

    // Validate token for proper decimal handling
    const token = TokenRegistry.getToken(request.tokenSymbol);
    if (!token) {
      throw new Error(`Unsupported token: ${request.tokenSymbol}`);
    }

    // Use BigInt arithmetic for precise decimal handling
    const withdrawAmountWei = ethers.parseUnits(request.amount, token.decimals);
    const currentBalanceWei = ethers.parseUnits(holding.balance, token.decimals);

    if (withdrawAmountWei > currentBalanceWei) {
      throw new Error(`Insufficient balance. Requested: ${request.amount}, Available: ${holding.balance}`);
    }

    // Check if vault is locked
    if (vault.vaultType === 'locked_savings' && vault.lockedUntil && new Date() < vault.lockedUntil) {
      throw new Error('Vault is still locked for withdrawals');
    }

    // Get current USD value using TokenService - calculate after validation
    const priceUSD = await this.getTokenPriceUSD(request.tokenSymbol);
    const withdrawAmountFloat = parseFloat(ethers.formatUnits(withdrawAmountWei, token.decimals));
    const valueUSD = withdrawAmountFloat * priceUSD;

    // Wrap critical operations in database transaction
    const result = await db.transaction(async (tx) => {
      // Create transaction record
      const [transaction] = await tx.insert(vaultTransactions).values({
        vaultId: request.vaultId,
        userId: request.userId,
        transactionType: 'withdrawal',
        tokenSymbol: request.tokenSymbol,
        amount: request.amount,
        valueUSD: valueUSD.toString(),
        transactionHash: request.transactionHash,
        status: 'completed'
      }).returning();

      // Update token holding using BigInt precision
      await this.updateTokenHolding(request.vaultId, request.tokenSymbol, withdrawAmountWei * BigInt(-1), false, tx);

      // Update vault TVL
      await this.updateVaultTVL(request.vaultId, tx);

      return transaction;
    });

    return result;
  }

  // Allocate funds to yield strategy
  async allocateToStrategy(request: StrategyAllocationRequest): Promise<void> {
    // Check authorization first
    const hasPermission = await this.checkVaultPermissions(request.vaultId, request.userId, 'allocate');
    if (!hasPermission) {
      throw new Error('Unauthorized: You do not have permission to allocate strategy for this vault');
    }

    const vault = await this.getVaultById(request.vaultId);
    if (!vault) {
      throw new Error('Vault not found');
    }

    const strategy = YIELD_STRATEGIES[request.strategyId];
    if (!strategy) {
      throw new Error(`Invalid strategy: ${request.strategyId}`);
    }

    if (!strategy.supportedTokens.includes(request.tokenSymbol)) {
      throw new Error(`Strategy ${request.strategyId} does not support token ${request.tokenSymbol}`);
    }

    const holding = await this.getTokenHolding(request.vaultId, request.tokenSymbol);
    if (!holding) {
      throw new Error('No token holdings found');
    }

    // Use proper decimal handling
    const token = TokenRegistry.getToken(request.tokenSymbol);
    if (!token) {
      throw new Error(`Unsupported token: ${request.tokenSymbol}`);
    }

    const totalBalanceWei = ethers.parseUnits(holding.balance, token.decimals);
    const allocationAmountWei = (totalBalanceWei * BigInt(Math.round(request.allocationPercentage * 100))) / BigInt(10000);
    const allocationAmount = ethers.formatUnits(allocationAmountWei, token.decimals);

    // Check if allocation already exists
    const existingAllocation = await db.query.vaultStrategyAllocations.findFirst({
      where: and(
        eq(vaultStrategyAllocations.vaultId, request.vaultId),
        eq(vaultStrategyAllocations.strategyId, request.strategyId),
        eq(vaultStrategyAllocations.tokenSymbol, request.tokenSymbol)
      )
    });

    if (existingAllocation) {
      // Update existing allocation
      await db.update(vaultStrategyAllocations)
        .set({
          allocatedAmount: allocationAmount.toString(),
          allocationPercentage: request.allocationPercentage.toString(),
          lastRebalance: new Date(),
          updatedAt: new Date()
        })
        .where(eq(vaultStrategyAllocations.id, existingAllocation.id!));
    } else {
      // Create new allocation
      await db.insert(vaultStrategyAllocations).values({
        vaultId: request.vaultId,
        strategyId: request.strategyId,
        tokenSymbol: request.tokenSymbol,
        allocatedAmount: allocationAmount.toString(),
        allocationPercentage: request.allocationPercentage.toString(),
        currentValue: allocationAmount.toString(),
        isActive: true
      });
    }
  }

  // Rebalance vault strategy allocations
  async rebalanceVault(vaultId: string, userId?: string): Promise<void> {
    // Check authorization if userId provided
    if (userId) {
      const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'rebalance');
      if (!hasPermission) {
        throw new Error('Unauthorized: You do not have permission to rebalance this vault');
      }
    }

    const vault = await this.getVaultById(vaultId);
    if (!vault || !vault.yieldStrategy) {
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
        if (!token) continue;

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
      userId: vault.userId || vault.daoId || 'system',
      transactionType: 'rebalance',
      tokenSymbol: vault.currency as SupportedToken,
      amount: '0',
      valueUSD: '0',
      status: 'completed',
      metadata: { allocations: allocations.length }
    });
  }

  // Perform comprehensive risk assessment
  async performRiskAssessment(vaultId: string): Promise<void> {
    const vault = await this.getVaultById(vaultId);
    if (!vault) {
      throw new Error('Vault not found');
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
  }

  // Get user's vaults
  async getUserVaults(userId: string, daoId?: string): Promise<Vault[]> {
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
  }

  // Get vault performance
  async getVaultPerformance(vaultId: string, userId?: string): Promise<any> {
    if (userId) {
      const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
      if (!hasPermission) {
        throw new Error('Unauthorized: You do not have permission to view this vault performance');
      }
    }

    return await db.query.vaultPerformance.findMany({
      where: eq(vaultPerformance.vaultId, vaultId),
      orderBy: [desc(vaultPerformance.createdAt)],
      limit: 10
    });
  }

  // Get vault transactions
  async getVaultTransactions(vaultId: string, userId?: string, page: number = 1, limit: number = 20): Promise<VaultTransaction[]> {
    if (userId) {
      const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
      if (!hasPermission) {
        throw new Error('Unauthorized: You do not have permission to view this vault transactions');
      }
    }

    const offset = (page - 1) * limit;
    
    return await db.query.vaultTransactions.findMany({
      where: eq(vaultTransactions.vaultId, vaultId),
      orderBy: [desc(vaultTransactions.createdAt)],
      limit,
      offset
    });
  }

  // Get vault portfolio summary with authorization check
  async getVaultPortfolio(vaultId: string, userId?: string): Promise<{
    vault: Vault;
    holdings: VaultTokenHolding[];
    totalValueUSD: number;
    performance: any;
    riskScore: number;
  }> {
    // Check authorization if userId provided
    if (userId) {
      const hasPermission = await this.checkVaultPermissions(vaultId, userId, 'view');
      if (!hasPermission) {
        throw new Error('Unauthorized: You do not have permission to view this vault portfolio');
      }
    }

    const vault = await this.getVaultById(vaultId);
    if (!vault) {
      throw new Error('Vault not found');
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
  }

  // Helper methods
  async getVaultById(vaultId: string): Promise<Vault | null> {
    const result = await db.query.vaults.findFirst({
      where: eq(vaults.id, vaultId)
    });
    return result || null;
  }

  private async getTokenHolding(
    vaultId: string, 
    tokenSymbol: string, 
    tx?: any
  ): Promise<VaultTokenHolding | null> {
    const dbConnection = tx || db;
    const result = await dbConnection.query.vaultTokenHoldings.findFirst({
      where: and(
        eq(vaultTokenHoldings.vaultId, vaultId),
        eq(vaultTokenHoldings.tokenSymbol, tokenSymbol)
      )
    });
    return result || null;
  }

  private async getVaultHoldings(vaultId: string, tx?: any): Promise<VaultTokenHolding[]> {
    const dbConnection = tx || db;
    return await dbConnection.query.vaultTokenHoldings.findMany({
      where: eq(vaultTokenHoldings.vaultId, vaultId)
    });
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
      throw new Error(`Token ${tokenSymbol} not found in registry`);
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
        
        throw new Error(
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
        throw new Error(`Cannot create holding with negative balance: ${balanceFloat.toFixed(6)}`);
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
  }

  private async getTokenPriceUSD(tokenSymbol: string): Promise<number> {
    try {
      // CRITICAL FIX #3: Integrate with actual TokenService before using fallback prices
      const token = TokenRegistry.getToken(tokenSymbol);
      if (!token) {
        throw new Error(`Token ${tokenSymbol} not found in registry`);
      }

      // First, try to get real price from TokenService if available
      try {
        // Try to get current market price from TokenService
        // This will use external APIs like CoinGecko, DeFiLlama, etc.
        if (tokenService && typeof tokenService.getTokenPrice === 'function') {
          const realPrice = await tokenService.getTokenPrice(tokenSymbol);
          if (realPrice && realPrice > 0) {
            console.log(`Got real price for ${tokenSymbol}: $${realPrice}`);
            return realPrice;
          }
        }
        
        // Alternative: Try getting balance as price indicator for native CELO
        if (tokenSymbol === 'CELO' && tokenService && tokenService.provider) {
          // For CELO, we can get a baseline from network activity, but still need external price
          console.log(`Using CELO network provider but still need external price feed`);
        }
      } catch (serviceError) {
        console.warn(`TokenService price lookup failed for ${tokenSymbol}:`, serviceError);
        // Continue to fallback pricing
      }

      // Fallback to conservative market-based pricing if TokenService unavailable
      console.log(`Using fallback pricing for ${tokenSymbol}`);
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
      console.error(`Error getting price for ${tokenSymbol}:`, error);
      // Ultra-conservative fallback pricing
      return tokenSymbol.includes('USD') || tokenSymbol.includes('EUR') ? 1.00 : 0.30;
    }
  }

  private async initializePerformanceTracking(vaultId: string): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

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
}

// Export singleton instance
export const vaultService = new VaultService();