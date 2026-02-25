/**
 * Vault Service - Creation Module
 * 
 * Handles vault creation, initialization, and setup
 */

import { ethers } from 'ethers';
import { db } from '../../db';
import { vaults, vaultPerformance, vaultRiskAssessments, users } from '../../../shared/schema';
import { TokenRegistry, YIELD_STRATEGIES } from '../../../shared/tokenRegistry';
import { Logger } from "../../utils/logger";
import { getErrorMessage } from '../../utils/errorUtils';
import { AppError, ValidationError } from "../../middleware/errorHandler";
import { retryWithExponentialBackoff } from '../../middleware/retryStrategy';
import { z } from "zod";
import { createVaultSchema } from './types';
import type { CreateVaultRequest } from './types';
import type { Vault } from '../../../shared/schema';
import { gte, lte, and, eq } from 'drizzle-orm';

/**
 * VaultCreationService - Handles vault creation and initialization
 */
export class VaultCreationService {
  /**
   * Create a new vault
   */
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

      // ✅ IMPROVED: Validate wallet exists for personal vaults with retry logic
      if (validatedRequest.userId) {
        const hasWallet = await retryWithExponentialBackoff(
          () => this.validateUserWallet(validatedRequest.userId!),
          {
            maxRetries: 3,
            initialDelayMs: 100,
            maxDelayMs: 2000,
            backoffMultiplier: 2,
          }
        );

        if (!hasWallet) {
          throw new ValidationError(
            'Wallet connection required. Please connect your wallet (MetaMask, WalletConnect, or Minipay) ' +
            'from the Wallet page before creating a vault.'
          );
        }
      }

      // Check vault limits for personal vaults
      if (validatedRequest.userId) {
        const { userSubscriptionService } = await import('../userSubscriptionService');
        const canCreate = await userSubscriptionService.canCreateVault(validatedRequest.userId);
        if (!canCreate.allowed) {
          throw new ValidationError(canCreate.reason || 'Vault limit reached');
        }
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
      await this.performInitialRiskAssessment(newVault.id);

      Logger.getLogger().info(`Vault created successfully: ${newVault.id}`);

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

  /**
   * Validate that user has a connected wallet
   * @param userId - User ID to check
   * @returns true if user has connected wallet, false otherwise
   */
  private async validateUserWallet(userId: string): Promise<boolean> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          walletAddress: true
        }
      });

      return !!user?.walletAddress;
    } catch (error) {
      Logger.getLogger().error(`Error validating wallet for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Initialize performance tracking for a new vault
   */
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
      // This is a non-critical operation, so we log but don't throw
    }
  }

  /**
   * Perform initial risk assessment for a newly created vault
   */
  private async performInitialRiskAssessment(vaultId: string): Promise<void> {
    try {
      const vault = await db.query.vaults.findFirst({
        where: eq(vaults.id, vaultId)
      });

      if (!vault) {
        throw new ValidationError(`Vault ${vaultId} not found`);
      }

      // Initial risk assessment for new vaults
      const overallRiskScore = vault.riskLevel === 'low' ? 30 : vault.riskLevel === 'medium' ? 50 : 70;

      await db.insert(vaultRiskAssessments).values({
        vaultId: vaultId,
        overallRiskScore,
        liquidityRisk: 20,
        smartContractRisk: 15,
        marketRisk: 25,
        concentrationRisk: 10,
        protocolRisk: 5,
        riskFactors: JSON.stringify({
          newVault: true,
          zeroBalance: true,
          noStrategy: !vault.yieldStrategy
        }),
        recommendations: JSON.stringify([
          'Monitor vault performance once deposits are made',
          'Consider enabling yield strategy for better returns',
          'Review risk level quarterly'
        ]),
        nextAssessmentDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        assessedBy: vault.userId || vault.daoId || 'system'
      });

      Logger.getLogger().info(`Initial risk assessment completed for vault ${vaultId}`);
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to perform initial risk assessment for vault ${vaultId}: ${msg}`, error);
      // Non-critical operation, don't throw
    }
  }
}

// Export singleton instance
export const vaultCreationService = new VaultCreationService();
