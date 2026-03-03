/**
 * Strategy Job Worker
 * Processes backtest and optimization jobs asynchronously
 */

import { Job } from 'bull';
import type { JobPayload } from '../services/jobQueueService';
import { jobQueueService } from '../services/jobQueueService';
import { logger } from '../utils/logger';
import { strategyFreqtradeIntegration } from '../services/strategyFreqtradeIntegration';

export class StrategyJobWorker {
  /**
   * Initialize strategy job processors
   */
  static initialize() {
    jobQueueService.registerProcessor(
      'strategy-backtest',
      async (job: Job<JobPayload>) => await this.processBacktest(job),
      { concurrency: 2 } // 2 concurrent backtests
    );

    jobQueueService.registerProcessor(
      'strategy-optimize',
      async (job: Job<JobPayload>) => await this.processOptimize(job),
      { concurrency: 1 } // 1 concurrent optimization
    );

    logger.info('[StrategyJobWorker] Initialized with 2 backtest + 1 optimize slots');
  }

  /**
   * Process backtest job
   */
  static async processBacktest(job: Job<JobPayload>): Promise<any> {
    const { userId, strategyId, timerange, params = {} } = job.data;

    try {
      logger.info(`[StrategyBacktest] Starting for strategy ${strategyId} by user ${userId}`);

      await job.progress(10);

      // Fetch strategy configuration
      const strategyConfig = await this.getStrategyConfig(strategyId);
      if (!strategyConfig) {
        throw new Error(`Strategy ${strategyId} not found`);
      }

      await job.progress(30);

      // Run backtest via Freqtrade
      const backtestResults = await strategyFreqtradeIntegration.runBacktest(
        strategyConfig,
        {
          timerange,
          ...params
        }
      );

      await job.progress(90);

      // Validate results
      if (!backtestResults) {
        throw new Error('Backtest returned no results');
      }

      const result = {
        strategyId,
        userId,
        timerange,
        backtestResults,
        completedAt: new Date(),
        duration: Date.now() - job.data.timestamp
      };

      logger.info(`[StrategyBacktest] Completed for strategy ${strategyId}`);
      return result;
    } catch (error) {
      logger.error(`[StrategyBacktest] Failed for strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * Process optimization job
   */
  static async processOptimize(job: Job<JobPayload>): Promise<any> {
    const { userId, strategyId, optimizationParams = {} } = job.data;

    try {
      logger.info(`[StrategyOptimize] Starting for strategy ${strategyId} by user ${userId}`);

      await job.progress(5);

      // Fetch strategy configuration
      const strategyConfig = await this.getStrategyConfig(strategyId);
      if (!strategyConfig) {
        throw new Error(`Strategy ${strategyId} not found`);
      }

      await job.progress(25);

      // Run optimization via Freqtrade
      const optimizationResults = await strategyFreqtradeIntegration.runOptimization(
        strategyConfig,
        optimizationParams
      );

      await job.progress(98);

      // Validate results
      if (!optimizationResults) {
        throw new Error('Optimization returned no results');
      }

      const result = {
        strategyId,
        userId,
        optimizationResults,
        completedAt: new Date(),
        duration: Date.now() - job.data.timestamp
      };

      logger.info(`[StrategyOptimize] Completed for strategy ${strategyId}`);
      return result;
    } catch (error) {
      logger.error(`[StrategyOptimize] Failed for strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch strategy configuration from database
   */
  private static async getStrategyConfig(strategyId: string) {
    try {
      const { db } = await import('../db');
      const { strategies } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      const strategy = await db.query.strategies.findFirst({
        where: eq(strategies.id, strategyId)
      });

      return strategy;
    } catch (error) {
      logger.warn('Failed to fetch strategy config:', error);
      return null;
    }
  }
}

