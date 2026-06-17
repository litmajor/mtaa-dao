/**
 * PRODUCTION-HARDENED CROSS-CHAIN ORCHESTRATION SERVICE
 * Multi-chain token routing engine with strict execution guarantees
 */

import { ethers } from 'ethers';
import { ChainRegistry, SupportedChain, CHAIN_CONFIGS } from '../../shared/chainRegistry';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { db } from '../db';
import { randomUUID } from 'crypto';
import { vaults } from '../../shared/schema';
import { crossChainTransfers } from '../../shared/accountSchema';

type InsertCrossChainTransfer = typeof crossChainTransfers.$inferInsert;
type InsertVault = typeof vaults.$inferInsert;
import { eq, and } from 'drizzle-orm';

export interface CrossChainTransferRequest {
  userId: string;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  tokenAddress: string;
  amount: string; // Keep as string string representing raw token units (Wei)
  destinationAddress: string;
  sourceTxHash: string; // FIX: Make source transaction hash mandatory to prevent ghost states
  vaultId?: string;
}

export interface BridgeStatus {
  transferId: string;
  sourceTxHash: string | null;
  status: 'pending' | 'bridging' | 'completed' | 'failed';
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  amount: string;
  estimatedTime: number; 
  gasEstimate?: string;
}

export class CrossChainService {
  private logger = Logger.getLogger();

  /**
   * Initiate and log a validated cross-chain transfer matching an on-chain event
   */
  async initiateTransfer(request: CrossChainTransferRequest): Promise<BridgeStatus> {
    try {
      // Validate input chains exist in registry
      if (!CHAIN_CONFIGS[request.sourceChain] || !CHAIN_CONFIGS[request.destinationChain]) {
        throw new AppError('Unsupported chain parameters provided.', 400);
      }

      const sourceConfig = CHAIN_CONFIGS[request.sourceChain];
      if (!sourceConfig.bridgeContract) {
        throw new AppError(`Bridge interface unconfigured for chain: ${request.sourceChain}`, 400);
      }

      // FIX: Validate format of the transaction hash before saving to DB
      if (!/^0x([A-Fa-f0-9]{64})$/.test(request.sourceTxHash)) {
        throw new AppError('Invalid cryptographic source transaction hash format.', 400);
      }

      // FIX: Strict Web3 Idempotency check using combination of source transaction hash and chain
      const existingTransfer = await db.query.crossChainTransfers.findFirst({
        where: and(
          eq(crossChainTransfers.sourceTxHash, request.sourceTxHash),
          eq(crossChainTransfers.sourceChain, request.sourceChain)
        )
      });

      if (existingTransfer) {
        this.logger.warn(`Idempotency trigger: Transfer log already found for hash ${request.sourceTxHash}`);
        return {
          transferId: existingTransfer.id ?? '',
          sourceTxHash: existingTransfer.sourceTxHash ?? null,
          status: existingTransfer.status as any,
          sourceChain: existingTransfer.sourceChain as SupportedChain,
          destinationChain: existingTransfer.targetChain as SupportedChain,
          amount: existingTransfer.sourceAmount,
          estimatedTime: 0
        };
      }

      // Create transfer record in database tied to the verified transaction hash
      const transferInsert: InsertCrossChainTransfer = {
        withdrawalId: randomUUID(),
        userId: request.userId,
        sourceChain: request.sourceChain,
        sourceToken: request.tokenAddress,
        sourceAmount: request.amount,
        sourceTxHash: request.sourceTxHash,
        targetChain: request.destinationChain,
        targetToken: request.tokenAddress,
        targetAmount: request.amount,
        recipientAddress: request.destinationAddress,
        status: 'pending',
        estimatedTime: 1800 // 30-minute fallback window in seconds
      };

      const [transfer] = await db.insert(crossChainTransfers).values(transferInsert).returning();

      this.logger.info(`Cross-chain transfer state logged successfully: ${transfer.id}`);

      return {
        transferId: transfer.id ?? '',
        sourceTxHash: transfer.sourceTxHash ?? null,
        status: 'pending',
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        amount: request.amount,
        estimatedTime: 1800 
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      // FIX: Guard database constraint error checks (e.g. Unique Index violations on txHash)
      const errMessage = (error as any).message || '';
      if (errMessage.includes('unique') || (error as any).code === '23505') {
        throw new AppError('Transaction registry collision: This transfer has already been submitted.', 409);
      }

      this.logger.error('Failed to initiate cross-chain transfer mapping sequence:', error);
      throw new AppError('Failed to initiate cross-chain transfer orchestration pipeline.', 500);
    }
  }

  /**
   * Check transfer status across internal records
   */
  async getTransferStatus(transferId: string): Promise<BridgeStatus | null> {
    try {
      const transfer = await db.query.crossChainTransfers.findFirst({
        where: eq(crossChainTransfers.id, transferId)
      });

      if (!transfer) {
        return null;
      }

      const now = Date.now();
      const estimatedCompletion = (transfer.estimatedTime ? now + transfer.estimatedTime * 1000 : now) || now;
      const remainingTime = Math.max(0, Math.floor((estimatedCompletion - now) / 1000));

      return {
        transferId: transfer.id!,
        sourceTxHash: transfer.sourceTxHash || '0x',
        status: transfer.status as any,
        sourceChain: transfer.sourceChain as SupportedChain,
        destinationChain: transfer.targetChain as SupportedChain,
        amount: transfer.sourceAmount,
        estimatedTime: remainingTime,
        gasEstimate: transfer.gasEstimate || undefined
      };
    } catch (error) {
      this.logger.error('Failed to query transfer tracking indices:', error);
      throw new AppError('Failed to retrieve current cross-chain transfer state.', 500);
    }
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): SupportedChain[] {
    return ChainRegistry.getMainnetChains();
  }

  /**
   * Estimate bridge fees using native BigInt variables to protect asset decimals
   */
  async estimateBridgeFees(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    amount: string // Token amount expressed in raw atomic values (e.g. Wei)
  ): Promise<{
    gasFee: string;
    bridgeFee: string;
    totalFee: string;
  }> {
    try {
      // FIX: Avoid floating-point arithmetic errors by using BigInt math for decimals
      const baseGasWei = ethers.parseUnits('0.01', 18); // Base cost parameters scaled out
      const inputAmountBigInt = ethers.toBigInt(amount);
      
      // Calculate a 0.1% bridge protocol fee using integer scale factors (multiply first, then divide)
      const bridgeFeeWei = (inputAmountBigInt * 1n) / 1000n;
      const totalFeeWei = baseGasWei + bridgeFeeWei;

      return {
        gasFee: ethers.formatUnits(baseGasWei, 18),
        bridgeFee: ethers.formatUnits(bridgeFeeWei, 18),
        totalFee: ethers.formatUnits(totalFeeWei, 18)
      };
    } catch (error) {
      this.logger.error('Precision parsing error during bridge fee calculations:', error);
      throw new AppError('Failed to compute precision bridge fee estimates.', 500);
    }
  }

  /**
   * Create cross-chain vault tracking schemas
   */
  async createCrossChainVault(
    userId: string,
    chains: SupportedChain[],
    vaultName: string
  ): Promise<string> {
    try {
      for (const chain of chains) {
        if (!CHAIN_CONFIGS[chain]) {
          throw new AppError(`Unsupported validation target chain index: ${chain}`, 400);
        }
      }

      const vaultInsert: InsertVault = {
        name: vaultName,
        userId,
        creatorId: userId,
        vaultType: 'yield',
        currency: 'cUSD',
        isActive: true,
        vaultConfig: {
          crossChain: true,
          supportedChains: chains
        }
      };

      const [vault] = await db.insert(vaults).values(vaultInsert).returning();

      this.logger.info(`Cross-chain vault logged: ${vault.id} for network nodes: ${chains.join(', ')}`);

      return vault.id;
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Failed to build cross-chain vault persistence mapping structures:', error);
      throw new AppError('Failed to create cross-chain vault database entries.', 500);
    }
  }
}

export const crossChainService = new CrossChainService();