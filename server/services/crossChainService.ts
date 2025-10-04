
import { ethers } from 'ethers';
import { ChainRegistry, SupportedChain, CHAIN_CONFIGS } from '../../shared/chainRegistry';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { db } from '../db';
import { crossChainTransfers, vaults } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface CrossChainTransferRequest {
  userId: string;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  tokenAddress: string;
  amount: string;
  destinationAddress: string;
  vaultId?: string;
}

export interface BridgeStatus {
  transferId: string;
  status: 'pending' | 'bridging' | 'completed' | 'failed';
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  amount: string;
  estimatedTime: number; // seconds
  gasEstimate?: string;
}

export class CrossChainService {
  private logger = Logger.getLogger();

  /**
   * Initiate cross-chain transfer
   */
  async initiateTransfer(request: CrossChainTransferRequest): Promise<BridgeStatus> {
    try {
      const sourceProvider = ChainRegistry.getProvider(request.sourceChain);
      const destProvider = ChainRegistry.getProvider(request.destinationChain);

      // Validate chains are supported
      if (!CHAIN_CONFIGS[request.sourceChain] || !CHAIN_CONFIGS[request.destinationChain]) {
        throw new AppError('Unsupported chain', 400);
      }

      // Get bridge contract address from source chain
      const sourceConfig = CHAIN_CONFIGS[request.sourceChain];
      if (!sourceConfig.bridgeContract) {
        throw new AppError('Bridge not configured for source chain', 400);
      }

      // Create transfer record in database
      const [transfer] = await db.insert(crossChainTransfers).values({
        userId: request.userId,
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        tokenAddress: request.tokenAddress,
        amount: request.amount,
        destinationAddress: request.destinationAddress,
        vaultId: request.vaultId,
        status: 'pending',
        estimatedCompletionTime: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      }).returning();

      this.logger.info(`Cross-chain transfer initiated: ${transfer.id}`);

      return {
        transferId: transfer.id!,
        status: 'pending',
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        amount: request.amount,
        estimatedTime: 1800 // 30 minutes
      };
    } catch (error) {
      this.logger.error('Failed to initiate cross-chain transfer:', error);
      throw new AppError('Failed to initiate cross-chain transfer', 500);
    }
  }

  /**
   * Check transfer status
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
      const estimatedCompletion = transfer.estimatedCompletionTime?.getTime() || now;
      const remainingTime = Math.max(0, Math.floor((estimatedCompletion - now) / 1000));

      return {
        transferId: transfer.id!,
        status: transfer.status as any,
        sourceChain: transfer.sourceChain as SupportedChain,
        destinationChain: transfer.destinationChain as SupportedChain,
        amount: transfer.amount,
        estimatedTime: remainingTime,
        gasEstimate: transfer.gasEstimate || undefined
      };
    } catch (error) {
      this.logger.error('Failed to get transfer status:', error);
      throw new AppError('Failed to get transfer status', 500);
    }
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): SupportedChain[] {
    return ChainRegistry.getMainnetChains();
  }

  /**
   * Estimate bridge fees
   */
  async estimateBridgeFees(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    amount: string
  ): Promise<{
    gasFee: string;
    bridgeFee: string;
    totalFee: string;
  }> {
    // Mock estimation - replace with actual bridge protocol fees
    const baseGas = '0.01'; // ETH/MATIC/etc
    const bridgeFeePercent = 0.001; // 0.1%
    const bridgeFee = (parseFloat(amount) * bridgeFeePercent).toString();
    const totalFee = (parseFloat(baseGas) + parseFloat(bridgeFee)).toString();

    return {
      gasFee: baseGas,
      bridgeFee,
      totalFee
    };
  }

  /**
   * Create cross-chain vault
   */
  async createCrossChainVault(
    userId: string,
    chains: SupportedChain[],
    vaultName: string
  ): Promise<string> {
    try {
      // Validate all chains are supported
      for (const chain of chains) {
        if (!CHAIN_CONFIGS[chain]) {
          throw new AppError(`Unsupported chain: ${chain}`, 400);
        }
      }

      // Create vault record with cross-chain support
      const [vault] = await db.insert(vaults).values({
        name: vaultName,
        userId,
        vaultType: 'yield',
        currency: 'cUSD',
        isActive: true,
        metadata: {
          crossChain: true,
          supportedChains: chains
        }
      }).returning();

      this.logger.info(`Cross-chain vault created: ${vault.id} for chains: ${chains.join(', ')}`);

      return vault.id;
    } catch (error) {
      this.logger.error('Failed to create cross-chain vault:', error);
      throw new AppError('Failed to create cross-chain vault', 500);
    }
  }
}

export const crossChainService = new CrossChainService();
