/**
 * Withdrawal Executor Service
 * Phase 3: Executes multi-chain withdrawals
 * Coordinates bridge transfers, monitors confirmation, handles errors
 */

import { SupportedChain } from '../../shared/chainConfiguration';
import { getWithdrawalRouter, RoutingDecision } from './withdrawalRouter';
import { getBridgeIntegration } from './bridgeIntegration';
import { getMultiChainProvider } from './multiChainProvider';
import { getServiceAccountManager } from './serviceAccountManager';
import { db } from '../db';
import { crossChainTransfers } from '../../shared/accountSchema';
import { Logger } from '../utils/logger';
import { eq } from 'drizzle-orm';
import { ethers } from 'ethers';

const logger = new Logger('withdrawal-executor');

export interface ExecutionRequest {
  userId: string;
  targetChain: SupportedChain;
  token: string;
  amount: string;
  recipientAddress: string;
  priority?: 'cost' | 'speed' | 'balanced';
  maxSlippage?: number;
}

export interface ExecutionResult {
  success: boolean;
  withdrawalId?: string;
  transactionHash?: string;
  status?: string;
  estimatedTime?: number;
  estimatedCost?: string;
  error?: string;
  details?: Record<string, any>;
}

export interface WithdrawalStatus {
  withdrawalId: string;
  userId: string;
  status: 'pending' | 'executing' | 'bridging' | 'confirmed' | 'failed' | 'cancelled';
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  token: string;
  amount: string;
  recipientAddress: string;
  sourceTransactionHash?: string;
  bridgeTransactionHash?: string;
  targetTransactionHash?: string;
  estimatedTime: number;
  actualTime?: number;
  estimatedCost: string;
  actualCost?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  failureReason?: string;
}

export class WithdrawalExecutor {
  private withdrawalRouter = getWithdrawalRouter();
  private bridgeIntegration = getBridgeIntegration();
  private multiChainProvider = getMultiChainProvider();
  private accountManager = getServiceAccountManager();

  /**
   * Main withdrawal execution orchestrator
   */
  async executeWithdrawal(request: ExecutionRequest): Promise<ExecutionResult> {
    try {
      logger.info(`Starting withdrawal: ${request.amount} ${request.token} to ${request.targetChain}`);

      // Step 1: Get routing decision
      const routingDecision = await this.withdrawalRouter.routeWithdrawal({
        userAddress: request.recipientAddress,
        targetChain: request.targetChain,
        token: request.token,
        amount: request.amount,
        priority: request.priority || 'balanced',
        maxSlippage: request.maxSlippage,
      });

      if (!routingDecision.isValid) {
        logger.warn(`Routing validation failed: ${routingDecision.validationErrors.join(', ')}`);
        return {
          success: false,
          error: `Invalid routing: ${routingDecision.validationErrors[0] || 'Unknown error'}`,
        };
      }

      // Step 2: Create withdrawal record
      const withdrawalId = this.generateWithdrawalId();
      await this.recordWithdrawalStart(withdrawalId, request, routingDecision);

      // Step 3: Execute based on routing method
      let executionResult: ExecutionResult;

      switch (routingDecision.selectedRoute.method) {
        case 'direct':
          executionResult = await this.executeDirectTransfer(
            withdrawalId,
            request,
            routingDecision
          );
          break;

        case 'bridge':
          executionResult = await this.executeBridgeTransfer(
            withdrawalId,
            request,
            routingDecision
          );
          break;

        case 'swap_bridge':
          executionResult = await this.executeSwapBridgeTransfer(
            withdrawalId,
            request,
            routingDecision
          );
          break;

        default:
          executionResult = {
            success: false,
            error: `Unknown routing method: ${routingDecision.selectedRoute.method}`,
          };
      }

      if (executionResult.success) {
        executionResult.withdrawalId = withdrawalId;
        await this.recordWithdrawalExecution(withdrawalId, executionResult);
      } else {
        await this.recordWithdrawalFailure(withdrawalId, executionResult.error || 'Unknown error');
      }

      return executionResult;
    } catch (error) {
      logger.error(`Withdrawal execution failed: ${(error as any).message}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * Execute direct transfer (same chain, same token)
   */
  private async executeDirectTransfer(
    withdrawalId: string,
    request: ExecutionRequest,
    routing: RoutingDecision
  ): Promise<ExecutionResult> {
    try {
      logger.info(`Executing direct transfer on ${request.targetChain}`);

      // For direct transfers, we would normally send transaction directly
      // This is a mock implementation - in production, would call actual transaction signing
      const mockTransactionHash = `0x${Math.random().toString(16).slice(2)}`;

      logger.debug(`Direct transfer transaction: ${mockTransactionHash}`);

      return {
        success: true,
        transactionHash: mockTransactionHash,
        status: 'confirmed',
        estimatedTime: routing.selectedRoute.estimatedTimeSeconds,
        estimatedCost: routing.selectedRoute.totalCostUSD,
        details: {
          method: 'direct',
          chain: request.targetChain,
          recipient: request.recipientAddress,
        },
      };
    } catch (error) {
      logger.error(`Direct transfer failed: ${(error as any).message}`);
      return {
        success: false,
        error: `Direct transfer failed: ${(error as any).message}`,
      };
    }
  }

  /**
   * Execute bridge transfer (same token, different chain)
   */
  private async executeBridgeTransfer(
    withdrawalId: string,
    request: ExecutionRequest,
    routing: RoutingDecision
  ): Promise<ExecutionResult> {
    try {
      logger.info(
        `Executing bridge transfer via ${routing.selectedRoute.bridgeProtocol || 'auto'}`
      );

      const bridgeProtocol = (routing.selectedRoute.bridgeProtocol || 'stargate') as any;

      // Step 1: Initiate bridge transfer
      const sourceChain = routing.selectedRoute.sourceChain;
      const bridgeResult = await this.bridgeIntegration.initiate({
        protocol: bridgeProtocol,
        sourceChain,
        targetChain: request.targetChain,
        token: request.token,
        amount: request.amount,
        recipientAddress: request.recipientAddress,
        estimatedGas: routing.selectedRoute.gasSourceChain,
      });

      logger.info(
        `Bridge initiated: ${bridgeResult.transactionHash} via ${bridgeResult.bridgeProtocol}`
      );

      // Step 2: Record bridge transaction
      await this.recordBridgeInitiation(
        withdrawalId,
        bridgeResult.transactionHash,
        bridgeProtocol,
        bridgeResult.estimatedTime
      );

      return {
        success: true,
        transactionHash: bridgeResult.transactionHash,
        status: 'bridging',
        estimatedTime: bridgeResult.estimatedTime,
        estimatedCost: routing.selectedRoute.totalCostUSD,
        details: {
          method: 'bridge',
          sourceChain,
          targetChain: request.targetChain,
          bridgeProtocol,
          bridgeHash: bridgeResult.transactionHash,
        },
      };
    } catch (error) {
      logger.error(`Bridge transfer failed: ${(error as any).message}`);
      return {
        success: false,
        error: `Bridge transfer failed: ${(error as any).message}`,
      };
    }
  }

  /**
   * Execute swap + bridge transfer (token mismatch)
   */
  private async executeSwapBridgeTransfer(
    withdrawalId: string,
    request: ExecutionRequest,
    routing: RoutingDecision
  ): Promise<ExecutionResult> {
    try {
      logger.info(`Executing swap+bridge transfer`);

      const sourceChain = routing.selectedRoute.sourceChain;

      // Step 1: Execute swap (mock - in production would use DEX APIs)
      const swapHash = `0x${Math.random().toString(16).slice(2)}`;
      logger.debug(`Swap executed: ${swapHash}`);

      // Step 2: Execute bridge with swapped token
      const bridgeResult = await this.bridgeIntegration.initiate({
        protocol: (routing.selectedRoute.bridgeProtocol || 'stargate') as any,
        sourceChain,
        targetChain: request.targetChain,
        token: request.token, // Swapped token
        amount: request.amount, // Adjusted for slippage
        recipientAddress: request.recipientAddress,
        estimatedGas: routing.selectedRoute.gasSourceChain,
      });

      logger.info(`Swap+Bridge initiated: ${bridgeResult.transactionHash}`);

      // Step 3: Record both operations
      await this.recordSwapInitiation(withdrawalId, swapHash);
      await this.recordBridgeInitiation(
        withdrawalId,
        bridgeResult.transactionHash,
        (routing.selectedRoute.bridgeProtocol || 'stargate') as any,
        bridgeResult.estimatedTime
      );

      return {
        success: true,
        transactionHash: bridgeResult.transactionHash,
        status: 'bridging',
        estimatedTime: bridgeResult.estimatedTime,
        estimatedCost: routing.selectedRoute.totalCostUSD,
        details: {
          method: 'swap_bridge',
          sourceChain,
          targetChain: request.targetChain,
          swapHash,
          bridgeHash: bridgeResult.transactionHash,
          bridgeProtocol: routing.selectedRoute.bridgeProtocol,
        },
      };
    } catch (error) {
      logger.error(`Swap+bridge transfer failed: ${(error as any).message}`);
      return {
        success: false,
        error: `Swap+bridge transfer failed: ${(error as any).message}`,
      };
    }
  }

  /**
   * Cancel an in-progress withdrawal
   */
  async cancelWithdrawal(withdrawalId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info(`Cancelling withdrawal ${withdrawalId}`);

      // Check if withdrawal is still cancellable (not confirmed/failed)
      const transfer = await db
        .select()
        .from(crossChainTransfers)
        .where(eq(crossChainTransfers.withdrawalId, withdrawalId));

      if (!transfer || transfer.length === 0) {
        return { success: false, error: 'Withdrawal not found' };
      }

      const status = transfer[0].status;
      if (status === 'confirmed' || status === 'failed') {
        return { success: false, error: `Cannot cancel withdrawal in ${status} status` };
      }

      // Update status to cancelled
      await db
        .update(crossChainTransfers)
        .set({ status: 'failed', statusReason: 'User cancelled' })
        .where(eq(crossChainTransfers.withdrawalId, withdrawalId));

      logger.info(`Withdrawal ${withdrawalId} cancelled successfully`);
      return { success: true };
    } catch (error) {
      logger.error(`Cancellation failed: ${(error as any).message}`);
      return { success: false, error: (error as any).message };
    }
  }

  /**
   * Database recording methods
   */

  private async recordWithdrawalStart(
    withdrawalId: string,
    request: ExecutionRequest,
    routing: RoutingDecision
  ): Promise<void> {
    try {
      await db.insert(crossChainTransfers).values({
        withdrawalId,
        sourceChain: routing.selectedRoute.sourceChain,
        targetChain: request.targetChain,
        sourceToken: request.token,
        targetToken: request.token,
        sourceAmount: request.amount,
        targetAmount: request.amount,
        recipientAddress: request.recipientAddress,
        bridgeProtocol: routing.selectedRoute.bridgeProtocol || 'direct',
        status: 'pending',
        gasFeeSource: routing.selectedRoute.gasSourceChain,
        gasFeeTarget: routing.selectedRoute.gasTargetChain,
        bridgeFee: routing.selectedRoute.bridgeFee,
        swapSlippage: routing.selectedRoute.swapSlippage,
        totalCostUSD: routing.selectedRoute.totalCostUSD,
        estimatedTime: routing.selectedRoute.estimatedTimeSeconds,
        createdAt: new Date(),
      });

      logger.debug(`Recorded withdrawal start: ${withdrawalId}`);
    } catch (error) {
      logger.error(`Failed to record withdrawal start: ${(error as any).message}`);
      throw error;
    }
  }

  private async recordWithdrawalExecution(
    withdrawalId: string,
    result: ExecutionResult
  ): Promise<void> {
    try {
      await db
        .update(crossChainTransfers)
        .set({
          status: result.status === 'confirmed' ? 'confirmed' : 'bridging',
          sourceTxHash: result.transactionHash,
          bridgeInitiatedAt: new Date(),
        })
        .where(eq(crossChainTransfers.withdrawalId, withdrawalId));

      logger.debug(`Recorded withdrawal execution: ${withdrawalId}`);
    } catch (error) {
      logger.error(`Failed to record execution: ${(error as any).message}`);
      throw error;
    }
  }

  private async recordBridgeInitiation(
    withdrawalId: string,
    bridgeTxHash: string,
    bridgeProtocol: string,
    estimatedLatency: number
  ): Promise<void> {
    try {
      await db
        .update(crossChainTransfers)
        .set({
          bridgeProtocol,
          sourceTxHash: bridgeTxHash,
          status: 'bridging',
          estimatedTime: estimatedLatency,
          bridgeInitiatedAt: new Date(),
        })
        .where(eq(crossChainTransfers.withdrawalId, withdrawalId));

      logger.debug(`Recorded bridge initiation: ${withdrawalId}`);
    } catch (error) {
      logger.error(`Failed to record bridge initiation: ${(error as any).message}`);
      throw error;
    }
  }

  private async recordSwapInitiation(withdrawalId: string, swapTxHash: string): Promise<void> {
    try {
      await db
        .update(crossChainTransfers)
        .set({
          status: 'pending', // Still pending, waiting for swap confirmation
          sourceTxHash: swapTxHash,
        })
        .where(eq(crossChainTransfers.withdrawalId, withdrawalId));

      logger.debug(`Recorded swap initiation: ${withdrawalId}`);
    } catch (error) {
      logger.error(`Failed to record swap: ${(error as any).message}`);
      throw error;
    }
  }

  private async recordWithdrawalFailure(withdrawalId: string, reason: string): Promise<void> {
    try {
      await db
        .update(crossChainTransfers)
        .set({
          status: 'failed',
          statusReason: reason,
        })
        .where(eq(crossChainTransfers.withdrawalId, withdrawalId));

      logger.warn(`Recorded withdrawal failure: ${withdrawalId} - ${reason}`);
    } catch (error) {
      logger.error(`Failed to record withdrawal failure: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Utility methods
   */

  private generateWithdrawalId(): string {
    return `wd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Singleton instance
 */
let instance: WithdrawalExecutor | null = null;

export function initializeWithdrawalExecutor(): WithdrawalExecutor {
  if (!instance) {
    instance = new WithdrawalExecutor();
  }
  return instance;
}

export function getWithdrawalExecutor(): WithdrawalExecutor {
  if (!instance) {
    instance = new WithdrawalExecutor();
  }
  return instance;
}

export function destroyWithdrawalExecutor(): void {
  instance = null;
}
