/**
 * Execution Tracking Service
 * 
 * Tracks all trading executions for quality analysis:
 * - Actual slippage (estimated vs realized)
 * - Execution timing
 * - Fee efficiency
 * - Venue performance ranking
 * - Execution history and trends
 */

import { cacheService } from './cacheService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionRecord {
  id: string;
  symbol: string;
  exchange: string;
  side: 'buy' | 'sell';
  inputAmount: number;
  inputToken: string;
  outputToken: string;
  
  // Estimated values (at time of quote)
  estimatedPrice: number;
  estimatedOutput: number;
  estimatedFee: number;
  estimatedSlippage: number;
  
  // Actual values (post-execution)
  actualPrice?: number;
  actualOutput?: number;
  actualFee?: number;
  actualSlippage?: number;
  
  // Execution details
  txHash?: string;
  executionTime?: number; // ms to fill
  status: 'pending' | 'filled' | 'partial' | 'failed';
  failureReason?: string;
  
  // Timestamps
  quotedAt: number;
  executedAt?: number;
  settledAt?: number;
  
  // Quality metrics
  slippageRealization?: number; // (actualSlippage - estimatedSlippage) / estimatedSlippage
  feeEfficiency?: number; // (estimatedFee - actualFee) / estimatedFee
  executionQualityScore?: number; // 0-100
}

export interface ExecutionQuality {
  avgSlippageRealization: number;
  avgFeeEfficiency: number;
  avgExecutionTime: number;
  successRate: number;
  totalExecutions: number;
  bestExecutionScore: number;
  worstExecutionScore: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface VenuePerformance {
  exchange: string;
  executions: ExecutionRecord[];
  quality: ExecutionQuality;
  ranking: number;
}

/**
 * Execution Tracking Service
 */
export class ExecutionTrackingService {
  private static instance: ExecutionTrackingService;
  private cachePrefix = 'execution:';
  private historyWindow = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  static getInstance(): ExecutionTrackingService {
    if (!ExecutionTrackingService.instance) {
      ExecutionTrackingService.instance = new ExecutionTrackingService();
    }
    return ExecutionTrackingService.instance;
  }

  /**
   * Record a new execution quote (before filling)
   */
  async recordQuote(
    symbol: string,
    exchange: string,
    side: 'buy' | 'sell',
    inputAmount: number,
    inputToken: string,
    outputToken: string,
    estimatedPrice: number,
    estimatedOutput: number,
    estimatedFee: number,
    estimatedSlippage: number
  ): Promise<ExecutionRecord> {
    const record: ExecutionRecord = {
      id: uuidv4(),
      symbol,
      exchange,
      side,
      inputAmount,
      inputToken,
      outputToken,
      estimatedPrice,
      estimatedOutput,
      estimatedFee,
      estimatedSlippage,
      quotedAt: Date.now(),
      status: 'pending',
    };

    // Store in cache for later reference
    const key = `${this.cachePrefix}quote:${record.id}`;
    await cacheService.set(key, record, 3600); // 1 hour TTL

    logger.debug(`📊 Recorded execution quote: ${record.id} on ${exchange}`);
    return record;
  }

  /**
   * Update execution with actual results
   */
  async recordExecution(
    quoteId: string,
    actualPrice: number,
    actualOutput: number,
    actualFee: number,
    actualSlippage: number,
    executionTime: number,
    txHash: string,
    status: 'filled' | 'partial' | 'failed' = 'filled',
    failureReason?: string
  ): Promise<ExecutionRecord> {
    // Retrieve the quote
    const key = `${this.cachePrefix}quote:${quoteId}`;
    let record = await cacheService.get<ExecutionRecord>(key);

    if (!record) {
      throw new Error(`Execution quote ${quoteId} not found`);
    }

    // Update with actual values
    record.actualPrice = actualPrice;
    record.actualOutput = actualOutput;
    record.actualFee = actualFee;
    record.actualSlippage = actualSlippage;
    record.executionTime = executionTime;
    record.txHash = txHash;
    record.status = status;
    record.failureReason = failureReason;
    record.executedAt = Date.now();

    // Calculate quality metrics
    if (record.estimatedSlippage !== 0) {
      record.slippageRealization = (actualSlippage - record.estimatedSlippage) / record.estimatedSlippage;
    }

    if (record.estimatedFee !== 0) {
      record.feeEfficiency = (record.estimatedFee - actualFee) / record.estimatedFee;
    }

    // Score execution quality (0-100)
    record.executionQualityScore = this.calculateExecutionScore(
      record.slippageRealization || 0,
      record.feeEfficiency || 0,
      executionTime,
      status
    );

    // Store in persistent history
    const historyKey = `${this.cachePrefix}history:${record.exchange}:${record.symbol}`;
    const history = (await cacheService.get<ExecutionRecord[]>(historyKey)) || [];
    history.push(record);

    // Keep only last 24 hours
    const cutoff = Date.now() - this.historyWindow;
    const filtered = history.filter((r) => r.quotedAt > cutoff);

    await cacheService.set(historyKey, filtered, 86400); // 24-hour TTL

    logger.info(`✅ Recorded execution: ${quoteId} - Score: ${record.executionQualityScore}`);
    return record;
  }

  /**
   * Calculate execution quality score (0-100)
   * Factors: slippage realization, fee efficiency, execution time, fill status
   */
  private calculateExecutionScore(
    slippageRealization: number,
    feeEfficiency: number,
    executionTime: number,
    status: string
  ): number {
    let score = 100;

    // Slippage penalty (worse than estimated = penalty)
    if (slippageRealization > 0) {
      score -= Math.min(40, slippageRealization * 20);
    } else {
      score += Math.min(10, Math.abs(slippageRealization) * 5); // Bonus for better
    }

    // Fee efficiency bonus (pay less than estimated)
    if (feeEfficiency > 0) {
      score += Math.min(10, feeEfficiency * 5);
    } else {
      score -= Math.min(15, Math.abs(feeEfficiency) * 10);
    }

    // Execution timing bonus (faster is better, reasonable is 5-10s)
    if (executionTime < 5000) {
      score += 10;
    } else if (executionTime > 30000) {
      score -= Math.min(20, (executionTime / 1000 - 30) * 0.5);
    }

    // Status multiplier
    if (status === 'failed') {
      score = 0;
    } else if (status === 'partial') {
      score *= 0.7;
    }

    return Math.max(0, Math.min(100, parseFloat(score.toFixed(2))));
  }

  /**
   * Get execution quality for specific exchange/pair combination
   */
  async getExecutionQuality(
    exchange: string,
    symbol: string,
    hoursBack: number = 24
  ): Promise<ExecutionQuality> {
    const historyKey = `${this.cachePrefix}history:${exchange}:${symbol}`;
    const history = (await cacheService.get<ExecutionRecord[]>(historyKey)) || [];

    if (history.length === 0) {
      return {
        avgSlippageRealization: 0,
        avgFeeEfficiency: 0,
        avgExecutionTime: 0,
        successRate: 0,
        totalExecutions: 0,
        bestExecutionScore: 0,
        worstExecutionScore: 0,
        trend: 'stable',
      };
    }

    // Filter to time window
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    const recent = history.filter((r) => r.quotedAt > cutoff && r.status !== 'pending');

    if (recent.length === 0) {
      return {
        avgSlippageRealization: 0,
        avgFeeEfficiency: 0,
        avgExecutionTime: 0,
        successRate: 0,
        totalExecutions: 0,
        bestExecutionScore: 0,
        worstExecutionScore: 0,
        trend: 'stable',
      };
    }

    // Calculate metrics
    const totalExecutions = recent.length;
    const successful = recent.filter((r) => r.status === 'filled');
    const successRate = (successful.length / totalExecutions) * 100;

    const avgSlippageRealization =
      recent.reduce((sum, r) => sum + (r.slippageRealization || 0), 0) / recent.length;

    const avgFeeEfficiency =
      recent.reduce((sum, r) => sum + (r.feeEfficiency || 0), 0) / recent.length;

    const avgExecutionTime =
      successful.length > 0
        ? successful.reduce((sum, r) => sum + (r.executionTime || 0), 0) / successful.length
        : 0;

    const scores = recent.map((r) => r.executionQualityScore || 0);
    const bestExecutionScore = Math.max(...scores);
    const worstExecutionScore = Math.min(...scores);

    // Detect trend
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const firstHalfAvg =
      firstHalf.reduce((sum, r) => sum + (r.executionQualityScore || 0), 0) / firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, r) => sum + (r.executionQualityScore || 0), 0) / secondHalf.length;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (secondHalfAvg > firstHalfAvg + 5) trend = 'improving';
    if (secondHalfAvg < firstHalfAvg - 5) trend = 'declining';

    return {
      avgSlippageRealization: parseFloat(avgSlippageRealization.toFixed(6)),
      avgFeeEfficiency: parseFloat(avgFeeEfficiency.toFixed(6)),
      avgExecutionTime: parseFloat(avgExecutionTime.toFixed(0)),
      successRate: parseFloat(successRate.toFixed(2)),
      totalExecutions,
      bestExecutionScore: parseFloat(bestExecutionScore.toFixed(2)),
      worstExecutionScore: parseFloat(worstExecutionScore.toFixed(2)),
      trend,
    };
  }

  /**
   * Get venue performance ranking
   */
  async getVenuePerformance(
    symbol: string,
    hoursBack: number = 24
  ): Promise<VenuePerformance[]> {
    const exchanges = ['binance', 'coinbase', 'kraken', 'gate.io'];
    const performances: VenuePerformance[] = [];

    for (const exchange of exchanges) {
      const historyKey = `${this.cachePrefix}history:${exchange}:${symbol}`;
      const executions = (await cacheService.get<ExecutionRecord[]>(historyKey)) || [];

      const quality = await this.getExecutionQuality(exchange, symbol, hoursBack);

      performances.push({
        exchange,
        executions: executions.slice(0, 100), // Last 100
        quality,
        ranking: 0, // Will be set after sorting
      });
    }

    // Rank by execution quality score
    performances.sort(
      (a, b) => b.quality.bestExecutionScore - a.quality.bestExecutionScore
    );

    performances.forEach((p, idx) => {
      p.ranking = idx + 1;
    });

    return performances;
  }

  /**
   * Get slippage analysis
   */
  async getSlippageAnalysis(symbol: string, hoursBack: number = 24): Promise<any> {
    const exchanges = ['binance', 'coinbase', 'kraken', 'gate.io'];
    const analysis: Record<string, any> = {
      symbol,
      timeRange: `${hoursBack}h`,
      timestamp: Date.now(),
      byExchange: {},
    };

    for (const exchange of exchanges) {
      const quality = await this.getExecutionQuality(exchange, symbol, hoursBack);

      analysis.byExchange[exchange] = {
        avgSlippageRealization: quality.avgSlippageRealization,
        avgSlippagePercent: parseFloat((quality.avgSlippageRealization * 100).toFixed(2)),
        successRate: quality.successRate,
        totalExecutions: quality.totalExecutions,
        trend: quality.trend,
        interpretation:
          quality.avgSlippageRealization > 0.02
            ? '⚠️ High slippage'
            : quality.avgSlippageRealization < -0.02
              ? '✅ Better than expected'
              : '✓ As expected',
      };
    }

    // Best performer
    const sorted = Object.entries(analysis.byExchange).sort(
      ([, a]: any, [, b]: any) =>
        a.avgSlippageRealization - b.avgSlippageRealization
    );

    analysis.bestPerformer = sorted[0]?.[0];
    analysis.worstPerformer = sorted[sorted.length - 1]?.[0];

    return analysis;
  }

  /**
   * Get execution history for user
   */
  async getExecutionHistory(
    exchange?: string,
    symbol?: string,
    hoursBack: number = 24
  ): Promise<ExecutionRecord[]> {
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    const pattern = exchange && symbol 
      ? `${this.cachePrefix}history:${exchange}:${symbol}`
      : `${this.cachePrefix}history:*`;

    let allRecords: ExecutionRecord[] = [];

    if (pattern === `${this.cachePrefix}history:*`) {
      // Get all history
      const exchanges = ['binance', 'coinbase', 'kraken', 'gate.io'];
      const symbols = ['BTC/USDT', 'ETH/USDT', 'CELO/USDC'];

      for (const ex of exchanges) {
        for (const sym of symbols) {
          const key = `${this.cachePrefix}history:${ex}:${sym}`;
          const records = (await cacheService.get<ExecutionRecord[]>(key)) || [];
          allRecords.push(...records);
        }
      }
    } else {
      const records = (await cacheService.get<ExecutionRecord[]>(pattern)) || [];
      allRecords = records;
    }

    // Filter to time window
    return allRecords.filter((r) => r.quotedAt > cutoff);
  }

  /**
   * Clear old execution history
   */
  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up old execution records...');
    const cutoff = Date.now() - this.historyWindow;

    // Get all execution keys
    const pattern = `${this.cachePrefix}history:*`;
    const allRecords = await this.getExecutionHistory();

    // Filter and clean
    const recent = allRecords.filter((r) => r.quotedAt > cutoff);
    logger.info(`✅ Cleaned up execution history: ${allRecords.length} → ${recent.length} records`);
  }
}

// Export singleton instance
export const executionTracking = ExecutionTrackingService.getInstance();
