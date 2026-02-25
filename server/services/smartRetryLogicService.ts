import { cacheService } from './cacheService';
import { ccxtService } from './ccxtService';
import { executionTrackingService } from './executionTrackingService';
import { logger } from '../utils/logger';

/**
 * Smart Retry Logic Service
 * Handles automatic partial fill detection, retry logic, and order completion
 * Manages slippage deviation detection and adaptive retry strategies
 */

export interface PartialFillRecord {
  orderId: string;
  symbol: string;
  exchange: string;
  side: 'buy' | 'sell';
  originalAmount: number;
  filledAmount: number;
  remainingAmount: number;
  averagePrice: number;
  totalCost: number;
  timestamp: number;
  status: 'partial' | 'completed' | 'abandoned';
  retries: number;
  reason: string;
}

export interface RetryStrategy {
  maxRetries: number;
  initialDelay: number;                  // Milliseconds
  backoffMultiplier: number;
  maxDelay: number;
  slippageTolerance: number;             // %
  minFillThreshold: number;              // % of original order
  useAltVenue: boolean;                  // Try different exchange
  splitArbitrage: boolean;               // Split across venues if cheaper
}

export interface SmartRetryResult {
  success: boolean;
  totalFilled: number;
  finalPrice: number;
  totalRetries: number;
  totalExecutionTime: number;            // Milliseconds
  finalSlippage: number;                 // %
  recommendations: string[];
  abandonedReason?: string;
}

export interface SlippageDeviation {
  symbol: string;
  expectedSlippage: number;
  actualSlippage: number;
  deviationPercentage: number;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'extreme';
  recommendation: string;
}

class SmartRetryLogicService {
  private static instance: SmartRetryLogicService;
  private activeOrders: Map<string, PartialFillRecord> = new Map();
  private retryQueue: Array<{ orderId: string; executeAt: number }> = [];

  private constructor() {
    // Start retry queue processor
    this.startRetryProcessor();
  }

  static getInstance(): SmartRetryLogicService {
    if (!SmartRetryLogicService.instance) {
      SmartRetryLogicService.instance = new SmartRetryLogicService();
    }
    return SmartRetryLogicService.instance;
  }

  /**
   * Execute order with automatic partial fill handling and retry logic
   */
  async executeWithSmartRetry(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    expectedPrice: number,
    exchange: string = 'binance',
    strategy?: Partial<RetryStrategy>
  ): Promise<SmartRetryResult> {
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Merge with default strategy
    const retryStrategy = this.getRetryStrategy(strategy);

    try {
      let totalFilled = 0;
      let totalCost = 0;
      let finalPrice = expectedPrice;
      let totalRetries = 0;
      const startTime = Date.now();

      // Attempt initial execution
      let result = await this.attemptExecution(
        symbol,
        side,
        amount,
        exchange
      );

      totalFilled += result.filled;
      totalCost += result.cost;
      if (result.filled > 0) {
        finalPrice = result.average;
      }

      // Check for partial fill
      if (result.filled < amount && result.filled > 0) {
        logger.info('Partial fill detected, initiating retry logic', {
          orderId,
          symbol,
          requested: amount,
          filled: result.filled
        });

        // Store partial fill record
        const partialRecord: PartialFillRecord = {
          orderId,
          symbol,
          exchange,
          side,
          originalAmount: amount,
          filledAmount: result.filled,
          remainingAmount: amount - result.filled,
          averagePrice: result.average,
          totalCost: result.cost,
          timestamp: Date.now(),
          status: 'partial',
          retries: 0,
          reason: 'Insufficient liquidity at initial attempt'
        };

        this.activeOrders.set(orderId, partialRecord);

        // Retry remaining amount
        while (
          partialRecord.remainingAmount > 0 &&
          totalRetries < retryStrategy.maxRetries
        ) {
          totalRetries++;

          // Calculate delay with exponential backoff
          const delay = Math.min(
            retryStrategy.initialDelay * Math.pow(retryStrategy.backoffMultiplier, totalRetries - 1),
            retryStrategy.maxDelay
          );

          logger.info(`Retry ${totalRetries}/${retryStrategy.maxRetries} after ${delay}ms`, {
            orderId,
            remaining: partialRecord.remainingAmount
          });

          await this.sleep(delay);

          // Try alternative venue if configured
          let retryExchange = exchange;
          if (retryStrategy.useAltVenue && totalRetries % 2 === 0) {
            retryExchange = this.getAlternativeExchange(exchange);
          }

          // Attempt retry
          result = await this.attemptExecution(
            symbol,
            side,
            partialRecord.remainingAmount,
            retryExchange
          );

          if (result.filled > 0) {
            totalFilled += result.filled;
            totalCost += result.cost;
            finalPrice = (totalCost / totalFilled); // Weighted average

            partialRecord.filledAmount = totalFilled;
            partialRecord.remainingAmount = amount - totalFilled;
            partialRecord.averagePrice = finalPrice;
            partialRecord.totalCost = totalCost;
            partialRecord.retries = totalRetries;

            // Check if slippage acceptable
            const actualSlippage = this.calculateSlippage(expectedPrice, finalPrice);
            if (actualSlippage > retryStrategy.slippageTolerance) {
              logger.warn('Slippage exceeded tolerance', {
                orderId,
                expectedSlippage: retryStrategy.slippageTolerance,
                actualSlippage
              });
              break;
            }
          }

          // Check min fill threshold
          const fillPercentage = (totalFilled / amount) * 100;
          if (fillPercentage < retryStrategy.minFillThreshold) {
            logger.warn('Fill below minimum threshold, abandoning order', {
              orderId,
              fillPercentage,
              threshold: retryStrategy.minFillThreshold
            });
            break;
          }
        }

        // Mark order as completed or abandoned
        partialRecord.status = totalFilled >= amount ? 'completed' : 'abandoned';
        this.activeOrders.set(orderId, partialRecord);
      }

      const executionTime = Date.now() - startTime;
      const finalSlippage = this.calculateSlippage(expectedPrice, finalPrice);

      // Track execution for quality metrics
      await executionTrackingService.trackExecution({
        symbol,
        exchange,
        side,
        amount: totalFilled,
        expectedPrice,
        actualPrice: finalPrice,
        timestamp: Date.now(),
        status: totalFilled >= amount ? 'success' : totalFilled > 0 ? 'partial' : 'failed'
      });

      // Generate recommendations
      const recommendations = this.generateRetryRecommendations(
        totalFilled,
        amount,
        finalSlippage,
        totalRetries
      );

      return {
        success: totalFilled >= amount,
        totalFilled,
        finalPrice,
        totalRetries,
        totalExecutionTime: executionTime,
        finalSlippage,
        recommendations
      };
    } catch (error) {
      logger.error('Smart retry execution failed:', { orderId, symbol, error });
      return {
        success: false,
        totalFilled: 0,
        finalPrice: expectedPrice,
        totalRetries: 0,
        totalExecutionTime: Date.now(),
        finalSlippage: 0,
        recommendations: ['Execution failed - try again later or check market conditions'],
        abandonedReason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get pending orders with partial fills
   */
  async getPendingOrders(): Promise<PartialFillRecord[]> {
    return Array.from(this.activeOrders.values()).filter(
      order => order.status === 'partial'
    );
  }

  /**
   * Detect slippage deviation and generate alert
   */
  async detectSlippageDeviation(
    symbol: string,
    expectedSlippage: number,
    actualSlippage: number
  ): Promise<SlippageDeviation> {
    const deviationPercentage = ((actualSlippage - expectedSlippage) / expectedSlippage) * 100;

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'extreme' = 'low';
    if (deviationPercentage > 100) severity = 'extreme';
    else if (deviationPercentage > 50) severity = 'high';
    else if (deviationPercentage > 25) severity = 'medium';

    // Generate recommendation
    const recommendation = this.generateSlippageRecommendation(
      severity,
      actualSlippage,
      expectedSlippage
    );

    const deviation: SlippageDeviation = {
      symbol,
      expectedSlippage,
      actualSlippage,
      deviationPercentage,
      timestamp: Date.now(),
      severity,
      recommendation
    };

    // Store deviation for analysis
    const deviationHistory = (await cacheService.get(`slippage-deviations:${symbol}`)) || [];
    deviationHistory.push(deviation);
    await cacheService.set(`slippage-deviations:${symbol}`, deviationHistory, 86400);

    return deviation;
  }

  /**
   * Calculate adaptive slippage tolerance based on market conditions
   */
  async calculateAdaptiveSlippageTolerance(
    symbol: string,
    baselineSlippage: number = 1
  ): Promise<number> {
    try {
      // Get recent slippage history
      const deviationHistory = (await cacheService.get(`slippage-deviations:${symbol}`)) || [];

      if (deviationHistory.length < 5) {
        return baselineSlippage;
      }

      // Calculate moving average of recent slippages
      const recentDeviations = deviationHistory.slice(-10);
      const avgDeviation = recentDeviations.reduce((sum, d) => sum + d.actualSlippage, 0) / recentDeviations.length;

      // Add 1.5x standard deviation as buffer
      const stdDev = Math.sqrt(
        recentDeviations.reduce((sum, d) => sum + Math.pow(d.actualSlippage - avgDeviation, 2), 0) / recentDeviations.length
      );

      const adaptiveTolerance = avgDeviation + (stdDev * 1.5);

      logger.debug('Calculated adaptive slippage tolerance', {
        symbol,
        baseline: baselineSlippage,
        adaptive: adaptiveTolerance
      });

      return Math.max(baselineSlippage, adaptiveTolerance);
    } catch (error) {
      logger.error('Error calculating adaptive tolerance:', { symbol, error });
      return baselineSlippage;
    }
  }

  /**
   * Get detailed retry history for an order
   */
  async getRetryHistory(orderId: string): Promise<PartialFillRecord | undefined> {
    return this.activeOrders.get(orderId);
  }

  /**
   * Manually complete or abandon an order
   */
  async completeOrder(orderId: string, finalStatus: 'completed' | 'abandoned', reason?: string): Promise<PartialFillRecord | null> {
    const order = this.activeOrders.get(orderId);
    
    if (order) {
      order.status = finalStatus;
      if (reason) {
        order.reason = reason;
      }
      this.activeOrders.set(orderId, order);
      return order;
    }

    return null;
  }

  // ============ Private Helper Methods ============

  private async attemptExecution(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    exchange: string
  ): Promise<{ filled: number; average: number; cost: number }> {
    try {
      // Get current price and order book
      const ticker = await ccxtService.fetchTicker(exchange, symbol);
      const orderBook = await ccxtService.fetchOrderBook(exchange, symbol, 50);

      // Simulate order execution on order book
      const executedAmount = this.simulateOrderExecution(
        orderBook,
        side,
        amount
      );

      return {
        filled: executedAmount.amount,
        average: executedAmount.price,
        cost: executedAmount.amount * executedAmount.price
      };
    } catch (error) {
      logger.error('Execution attempt failed:', { symbol, exchange, error });
      return { filled: 0, average: 0, cost: 0 };
    }
  }

  private simulateOrderExecution(
    orderBook: any,
    side: 'buy' | 'sell',
    amount: number
  ): { amount: number; price: number } {
    const orders = side === 'buy' ? orderBook.asks : orderBook.bids;
    let cumulativeAmount = 0;
    let cumulativeCost = 0;

    for (const [price, volume] of orders) {
      const toFill = Math.min(volume, amount - cumulativeAmount);
      cumulativeAmount += toFill;
      cumulativeCost += toFill * price;

      if (cumulativeAmount >= amount) break;
    }

    const avgPrice = cumulativeAmount > 0 ? cumulativeCost / cumulativeAmount : 0;
    return { amount: cumulativeAmount, price: avgPrice };
  }

  private getRetryStrategy(strategy?: Partial<RetryStrategy>): RetryStrategy {
    return {
      maxRetries: strategy?.maxRetries ?? 5,
      initialDelay: strategy?.initialDelay ?? 1000,       // 1 second
      backoffMultiplier: strategy?.backoffMultiplier ?? 1.5,
      maxDelay: strategy?.maxDelay ?? 30000,              // 30 seconds
      slippageTolerance: strategy?.slippageTolerance ?? 2, // 2%
      minFillThreshold: strategy?.minFillThreshold ?? 50,  // 50%
      useAltVenue: strategy?.useAltVenue ?? false,
      splitArbitrage: strategy?.splitArbitrage ?? false
    };
  }

  private getAlternativeExchange(currentExchange: string): string {
    const exchanges = ['binance', 'coinbase', 'kraken', 'gate.io', 'okx'];
    const alternatives = exchanges.filter(e => e !== currentExchange);
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  private calculateSlippage(expectedPrice: number, actualPrice: number): number {
    if (expectedPrice === 0) return 0;
    return ((actualPrice - expectedPrice) / expectedPrice) * 100;
  }

  private generateRetryRecommendations(
    totalFilled: number,
    amount: number,
    finalSlippage: number,
    retries: number
  ): string[] {
    const recommendations: string[] = [];

    const fillPercentage = (totalFilled / amount) * 100;

    if (fillPercentage === 100) {
      recommendations.push('Order fully completed successfully');
    } else if (fillPercentage >= 80) {
      recommendations.push('Order mostly filled - remaining can be completed manually if needed');
    } else if (fillPercentage >= 50) {
      recommendations.push('Order partially filled - consider waiting for better liquidity or manually completing');
    } else if (fillPercentage > 0) {
      recommendations.push('Minimal fill achieved - market liquidity constrained, recommend canceling remaining');
    } else {
      recommendations.push('Order could not be filled - market may be closed or illiquid');
    }

    if (finalSlippage > 1) {
      recommendations.push(`Slippage of ${finalSlippage.toFixed(2)}% - consider using limit orders for future trades`);
    }

    if (retries >= 3) {
      recommendations.push('High retry count - market may be too illiquid for this size, recommend splitting orders');
    }

    return recommendations;
  }

  private generateSlippageRecommendation(
    severity: string,
    actualSlippage: number,
    expectedSlippage: number
  ): string {
    if (severity === 'extreme') {
      return `EXTREME: Actual slippage ${actualSlippage.toFixed(2)}% vs expected ${expectedSlippage.toFixed(2)}% - DO NOT EXECUTE`;
    }
    if (severity === 'high') {
      return `HIGH: Slippage ${actualSlippage.toFixed(2)}% significantly exceeds estimate - consider reducing order size`;
    }
    if (severity === 'medium') {
      return `Slippage ${actualSlippage.toFixed(2)}% moderately above estimate - monitor and adjust if persists`;
    }
    return `Slippage within acceptable range`;
  }

  private startRetryProcessor(): void {
    // Process retry queue every 100ms
    setInterval(() => {
      const now = Date.now();
      while (this.retryQueue.length > 0 && this.retryQueue[0].executeAt <= now) {
        this.retryQueue.shift();
        // Retry logic would go here
      }
    }, 100);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const smartRetryLogicService = SmartRetryLogicService.getInstance();
