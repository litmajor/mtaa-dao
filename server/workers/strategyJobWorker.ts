/**
 * Strategy Job Worker
 * Processes backtest and optimization jobs asynchronously
 */

import type { Job } from 'bull';
import type { JobPayload } from '../services/jobQueueService';
import { jobQueueService } from '../services/jobQueueService';
import { logger } from '../utils/logger';
import { strategyFreqtradeIntegration } from '../services/strategyFreqtradeIntegration';
import { strategyNativeBacktestIntegration } from '../services/strategyNativeBacktestIntegration';

export class StrategyJobWorker {
  /**
   * Initialize strategy job processors
   */
  static initialize() {
    jobQueueService.registerProcessor(
      'strategy-backtest',
      async (job: Job<JobPayload>) => await this.processBacktest(job),
      2 // 2 concurrent backtests
    );

    jobQueueService.registerProcessor(
      'strategy-optimize',
      async (job: Job<JobPayload>) => await this.processOptimize(job),
      1 // 1 concurrent optimization
    );

    logger.info('[StrategyJobWorker] Initialized with 2 backtest + 1 optimize slots');
  }

  /**
   * Process backtest job
   */
  static async processBacktest(job: Job<JobPayload>): Promise<any> {
    const {
      userId,
      strategyId,
      pair = 'BTC/USDT',
      timeframe = '1h',
      timerange = '20230101-20231231',
      stakeAmount = 100,
      startingCapital = 10000,
      enableOptimization = false,
      engine = 'freqtrade',
      params = {}
    } = job.data;

    try {
      logger.info(`[StrategyBacktest] Starting for strategy ${strategyId} by user ${userId}`);

      await job.progress(10);

      // Fetch strategy configuration
      const strategyConfig = await this.getStrategyConfig(strategyId);
      if (!strategyConfig) {
        throw new Error(`Strategy ${strategyId} not found`);
      }

      await job.progress(30);

      const requestedEngine = String(engine).toLowerCase() === 'native'
        ? 'native'
        : strategyConfig.freqtradeCode ? 'freqtrade' : 'native';

      let backtestResults;

      if (requestedEngine === 'native') {
        logger.info(`[StrategyBacktest] Using native TS backtest engine for ${strategyId}`);
        backtestResults = await strategyNativeBacktestIntegration.runBacktest({
          strategyId,
          pair,
          timeframe,
          timerange,
          stakeAmount,
          startingCapital,
          strategyConfig,
        });
      } else {
        logger.info(`[StrategyBacktest] Using Freqtrade backtest engine for ${strategyId}`);
        backtestResults = await strategyFreqtradeIntegration.runBacktest({
          strategyId,
          pair,
          timeframe,
          timerange,
          stakeAmount,
          startingCapital,
          enableOptimization,
        });
      }

      await job.progress(90);

      if (!backtestResults) {
        throw new Error('Backtest returned no results');
      }

      const result = {
        strategyId,
        userId,
        timerange,
        engine: requestedEngine,
        backtestResults,
        completedAt: new Date(),
        duration: Date.now() - Number(job.data.timestamp || Date.now())
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
      const { eq } = await import('drizzle-orm');

      // `strategies` table may not be present in all deployments of shared/schema.
      // Use a defensive dynamic access pattern to avoid compile-time errors.
      const sharedSchema: any = await import('../../shared/schema');
      const strategiesTable = (sharedSchema as any).strategies as any;

      if (strategiesTable && (db.query as any).strategies) {
        const strategy = await (db.query as any).strategies.findFirst({
          where: eq(strategiesTable.id, strategyId)
        });
        return strategy;
      }

      // Fallback: attempt to read from a legacy `strategy_configs` table if present
      try {
        const legacy = await db.select().from((sharedSchema as any).strategy_configs ?? (sharedSchema as any).strategyConfigs ?? ({} as any)).where(eq((sharedSchema as any).strategy_configs?.id ?? (sharedSchema as any).strategyConfigs?.id ?? 'id', strategyId));
        return legacy?.[0] ?? null;
      } catch (e) {
        // If nothing is available, warn and return null
        logger.warn('Failed to fetch strategy config:', { error: String(e) });
        return null;
      }
    } catch (error) {
      logger.warn('Failed to fetch strategy config:', { error: String(error) });
      return null;
    }
  }
}

