/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DEX ROUTING EXECUTION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Executes swaps on DEX/CEX networks:
 * • Routes orders via Smart Order Router
 * • Executes transactions on optimal venues
 * • Handles slippage, gas costs, transaction tracking
 * • Supports split orders for large trades
 * • Multi-chain execution (Ethereum, Polygon, Arbitrum, Optimism, Celo)
 */

import { Logger } from '../utils/logger';
import { db } from '../db';
import { strategyRebalancesTable } from '../db/schema/strategies';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface SwapOrder {
  id?: string;
  asset: string; // "ETH", "USDC", etc
  action: 'buy' | 'sell';
  amount: number;
  amountUsd: number;
  targetPrice?: number;
  maxSlippagePercent: number;
  deadline?: number; // timestamp
  gasPrice?: number;
}

export interface ExecutedTransaction {
  hash: string;
  asset: string;
  action: 'buy' | 'sell';
  amount: number;
  price: number;
  venue: 'uniswap' | 'curve' | 'balancer' | 'cex' | 'other';
  slippagePercent: number;
  gasCostUsd: number;
  gasCostGwei: number;
  status: 'pending' | 'confirmed' | 'failed';
  executedAt: number;
  confirmedAt?: number;
  blockNumber?: number;
}

export interface RebalanceExecution {
  rebalanceId: string;
  strategyId: string;
  triggeredAt: number;
  executionStartedAt?: number;
  transactions: ExecutedTransaction[];
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'partial';
  totalGasUsed: number;
  totalGasCostUsd: number;
  totalSlippage: number;
  successfulTransactions: number;
  failedTransactions: number;
  error?: string;
  completedAt?: number;
}

export interface RoutingRecommendation {
  venue: 'uniswap' | 'curve' | 'balancer' | 'cex';
  expectedPrice: number;
  expectedSlippage: number;
  expectedGasCost: number;
  totalCost: number;
  confidence: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// DEX ROUTING EXECUTION SERVICE
// ════════════════════════════════════════════════════════════════════════════════

class DexRoutingExecution {
  private activeExecutions: Map<string, RebalanceExecution> = new Map();
  private transactionQueue: Map<string, SwapOrder[]> = new Map();

  // Mock routing recommendations (in production, calls orderRouter service)
  private getMockRoutingRecommendation(order: SwapOrder): RoutingRecommendation {
    const venues = ['uniswap', 'curve', 'balancer', 'cex'] as const;
    const selectedVenue = venues[Math.floor(Math.random() * venues.length)];

    return {
      venue: selectedVenue,
      expectedPrice: (order.targetPrice || 1000) * (0.98 + Math.random() * 0.04),
      expectedSlippage: 0.1 + Math.random() * 0.4,
      expectedGasCost: 50 + Math.random() * 150,
      totalCost: 50 + Math.random() * 50,
      confidence: 0.85 + Math.random() * 0.15,
    };
  }

  /**
   * Initiate rebalancing execution
   */
  async executeRebalance(input: {
    strategyId: string;
    orders: SwapOrder[];
    chain: string;
    maxSlippagePercent?: number;
    gasLimit?: number;
  }): Promise<string> {
    try {
      const rebalanceId = uuidv4();

      const execution: RebalanceExecution = {
        rebalanceId,
        strategyId: input.strategyId,
        triggeredAt: Date.now(),
        transactions: [],
        status: 'pending',
        totalGasUsed: 0,
        totalGasCostUsd: 0,
        totalSlippage: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
      };

      this.activeExecutions.set(rebalanceId, execution);
      this.transactionQueue.set(rebalanceId, input.orders);

      logger.info(`[DexRouting] Started rebalance execution: ${rebalanceId} with ${input.orders.length} orders`);

      // Start async execution
      this.executeOrders(rebalanceId, input.chain, input.maxSlippagePercent || 0.5);

      return rebalanceId;
    } catch (error) {
      logger.error('[DexRouting] Error initiating rebalance:', error);
      throw error;
    }
  }

  /**
   * Execute orders sequentially from transaction queue
   */
  private async executeOrders(
    rebalanceId: string,
    chain: string,
    maxSlippage: number
  ): Promise<void> {
    try {
      const execution = this.activeExecutions.get(rebalanceId)!;
      const orders = this.transactionQueue.get(rebalanceId);

      if (!orders || orders.length === 0) {
        throw new Error(`No orders found in queue for rebalance: ${rebalanceId}`);
      }

      execution.status = 'executing';
      execution.executionStartedAt = Date.now();

      for (const order of orders) {
        try {
          // Get routing recommendation
          const recommendation = this.getMockRoutingRecommendation(order);

          // Simulate transaction execution
          const transaction = await this.executeSwap({
            order,
            venue: recommendation.venue,
            expectedPrice: recommendation.expectedPrice,
            expectedSlippage: recommendation.expectedSlippage,
            expectedGasCost: recommendation.expectedGasCost,
            chain,
          });

          execution.transactions.push(transaction);
          execution.successfulTransactions++;
          execution.totalSlippage += transaction.slippagePercent;
          execution.totalGasCostUsd += transaction.gasCostUsd;
          execution.totalGasUsed += transaction.gasCostGwei;

          logger.info(
            `[DexRouting] Executed ${transaction.asset} ${transaction.action} on ${transaction.venue}: ` +
              `${transaction.amount} @ ${transaction.price.toFixed(2)} ` +
              `(slippage: ${transaction.slippagePercent.toFixed(2)}%)`
          );
        } catch (error) {
          execution.failedTransactions++;
          logger.error(`[DexRouting] Order execution failed for ${order.asset}:`, error);

          // Add failed transaction record
          execution.transactions.push({
            hash: `failed_${Date.now()}`,
            asset: order.asset,
            action: order.action,
            amount: order.amount,
            price: 0,
            venue: 'other',
            slippagePercent: 0,
            gasCostUsd: 0,
            gasCostGwei: 0,
            status: 'failed',
            executedAt: Date.now(),
          });
        }

        // Simulate network delay between orders
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
      }

      // Update status
      if (execution.failedTransactions === 0) {
        execution.status = 'completed';
      } else if (execution.successfulTransactions > 0) {
        execution.status = 'partial';
      } else {
        execution.status = 'failed';
        execution.error = `All ${orders.length} orders failed`;
      }

      execution.completedAt = Date.now();

      // Persist to database
      await this.persistRebalanceExecution(execution);

      logger.info(
        `✅ Rebalance execution completed: ${rebalanceId} ` +
          `(${execution.successfulTransactions} success, ${execution.failedTransactions} failed) ` +
          `Gas: ${execution.totalGasCostUsd.toFixed(2)} USD, ` +
          `Slippage: ${execution.totalSlippage.toFixed(2)}%`
      );
    } catch (error) {
      const execution = this.activeExecutions.get(rebalanceId)!;
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = Date.now();
      logger.error('[DexRouting] Execution pipeline failed:', error);
    }
  }

  /**
   * Execute single swap
   */
  private async executeSwap(input: {
    order: SwapOrder;
    venue: 'uniswap' | 'curve' | 'balancer' | 'cex';
    expectedPrice: number;
    expectedSlippage: number;
    expectedGasCost: number;
    chain: string;
  }): Promise<ExecutedTransaction> {
    return new Promise((resolve) => {
      // Simulate swap execution (1-2 seconds)
      setTimeout(() => {
        const actualSlippage = input.expectedSlippage * (0.8 + Math.random() * 0.4);
        const actualGasCost = input.expectedGasCost * (0.9 + Math.random() * 0.2);

        const transaction: ExecutedTransaction = {
          hash: uuidv4(),
          asset: input.order.asset,
          action: input.order.action,
          amount: input.order.amount,
          price: input.expectedPrice * (1 - actualSlippage / 100),
          venue: input.venue,
          slippagePercent: actualSlippage,
          gasCostUsd: actualGasCost,
          gasCostGwei: actualGasCost * 1000, // Simplified conversion
          status: Math.random() > 0.05 ? 'confirmed' : 'failed', // 95% success rate
          executedAt: Date.now(),
          confirmedAt: Date.now() + 3000 + Math.random() * 5000,
          blockNumber: Math.floor(Math.random() * 18000000),
        };

        resolve(transaction);
      }, 1000 + Math.random() * 2000);
    });
  }

  /**
   * Persist rebalance execution to database
   */
  private async persistRebalanceExecution(execution: RebalanceExecution): Promise<void> {
    try {
      await db.insert(strategyRebalancesTable).values({
        id: execution.rebalanceId,
        strategyId: execution.strategyId,
        triggeredAt: new Date(execution.triggeredAt),
        executedAt: new Date(execution.executionStartedAt || execution.triggeredAt),
        completedAt: execution.completedAt ? new Date(execution.completedAt) : undefined,
        status: execution.status as any,
        successfulTransactions: execution.successfulTransactions,
        failedTransactions: execution.failedTransactions,
        transactionCount: execution.transactions.length,
        totalGasUsed: String(execution.totalGasUsed),
        totalGasCostUsd: String(execution.totalGasCostUsd),
        totalSlippage: String(execution.totalSlippage),
        transactions: execution.transactions as any,
        error: execution.error,
        createdAt: new Date(),
      });

      logger.debug(`[DexRouting] Persisted rebalance execution: ${execution.rebalanceId}`);
    } catch (error) {
      logger.error('[DexRouting] Error persisting rebalance execution:', error);
    }
  }

  /**
   * Get execution status
   */
  getExecutionStatus(rebalanceId: string): RebalanceExecution | null {
    return this.activeExecutions.get(rebalanceId) || null;
  }

  /**
   * Split large order for multi-venue execution
   */
  splitOrder(order: SwapOrder, maxOrderSize: number): SwapOrder[] {
    if (order.amountUsd <= maxOrderSize) {
      return [order];
    }

    const splitCount = Math.ceil(order.amountUsd / maxOrderSize);
    const splitOrders: SwapOrder[] = [];

    for (let i = 0; i < splitCount; i++) {
      const splitAmount = Math.min(maxOrderSize, order.amountUsd - i * maxOrderSize);
      splitOrders.push({
        ...order,
        id: `${order.id}_split_${i}`,
        amountUsd: splitAmount,
        amount: (order.amount * splitAmount) / order.amountUsd,
      });
    }

    logger.info(`[DexRouting] Split order ${order.id}: ${splitCount} chunks (${maxOrderSize} USD each)`);

    return splitOrders;
  }

  /**
   * Estimate rebalance cost and impact
   */
  estimateRebalanceCost(orders: SwapOrder[]): {
    estimatedGasUsd: number;
    estimatedSlippageUsd: number;
    totalCostUsd: number;
    impactPercent: number;
  } {
    let estimatedGas = 0;
    let estimatedSlippage = 0;
    let totalOrderValue = 0;

    for (const order of orders) {
      // Estimate gas: ~100-200 gwei per swap on Ethereum, less on L2s
      estimatedGas += 75 + Math.random() * 75; // USD

      // Estimate slippage based on order size
      const slippage = (order.amountUsd / 10000) * 0.5; // 0.5% slippage per $10k
      estimatedSlippage += slippage;

      totalOrderValue += order.amountUsd;
    }

    const totalCost = estimatedGas + estimatedSlippage;
    const impactPercent = (totalCost / totalOrderValue) * 100;

    return {
      estimatedGasUsd: estimatedGas,
      estimatedSlippageUsd: estimatedSlippage,
      totalCostUsd: totalCost,
      impactPercent,
    };
  }

  /**
   * Cancel pending rebalance execution
   */
  async cancelRebalance(rebalanceId: string): Promise<boolean> {
    try {
      const execution = this.activeExecutions.get(rebalanceId);

      if (!execution) {
        return false;
      }

      if (execution.status === 'executing') {
        logger.warn(`[DexRouting] Cannot cancel executing rebalance: ${rebalanceId}`);
        return false;
      }

      execution.status = 'failed';
      execution.error = 'Cancelled by user';
      execution.completedAt = Date.now();

      this.activeExecutions.delete(rebalanceId);
      this.transactionQueue.delete(rebalanceId);

      logger.info(`[DexRouting] Cancelled rebalance: ${rebalanceId}`);

      return true;
    } catch (error) {
      logger.error('[DexRouting] Error cancelling rebalance:', error);
      return false;
    }
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): RebalanceExecution[] {
    return Array.from(this.activeExecutions.values()).filter((e) => e.status === 'executing');
  }

  /**
   * Estimate price impact of large order
   */
  estimatePriceImpact(
    asset: string,
    amount: number,
    amountUsd: number,
    historicalVolume24h: number
  ): number {
    // Price impact ≈ (order size / 24h volume) * slippage factor
    const volumeRatio = amountUsd / historicalVolume24h;
    const baseSlippage = 0.05; // 0.05% base
    const impactFactor = 2; // Orders > 1% volume have 2x impact

    if (volumeRatio > 0.01) {
      return baseSlippage + volumeRatio * 100 * impactFactor;
    }

    return baseSlippage + volumeRatio * 100;
  }
}

export const dexRoutingExecution = new DexRoutingExecution();
