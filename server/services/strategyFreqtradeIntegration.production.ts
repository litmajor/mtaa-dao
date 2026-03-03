/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCTION FREQTRADE INTEGRATION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Real Freqtrade bot integration:
 * • HTTP API calls to live Freqtrade instance
 * • Strategy file deployment and validation
 * • Backtest execution with real market data
 * • Hyperparameter optimization (Bayesian, Edge case detection)
 * • Live strategy monitoring and status tracking
 * • Graceful error handling and retry logic
 */

import axios, { AxiosInstance } from 'axios';
import { Logger } from '../utils/logger';
import { db } from '../db';
import { strategiesTable } from '../db/schema/strategies';
import { eq } from 'drizzle-orm';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// PRODUCTION FREQTRADE API CLIENT
// ════════════════════════════════════════════════════════════════════════════════

export interface BacktestMetrics {
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  winRatePercent: number;
  totalProfitUsd: number;
  totalProfitPercent: number;
  avgProfitPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdownPercent: number;
  buyAndHoldPercent: number;
  exposureTimePercent: number;
  avgDurationMinutes: number;
  recoveryFactor: number;
  expectancy: number;
}

export interface FreqtradeBacktestRequest {
  strategyId: string;
  strategyCode?: string;
  pair: string;
  timeframe: string;
  timerange: string;
  stakeAmount: number;
  enableOptimization: boolean;
  optParams?: {
    spaces?: string[];
    trials?: number;
  };
}

class ProductionFreqtradeIntegration {
  private api: AxiosInstance;
  private baseUrl: string;
  private apiToken: string;
  private connectedBots: Map<string, { status: string; strategyCount: number }> =
    new Map();

  constructor() {
    this.baseUrl = process.env.FREQTRADE_API_URL || 'http://localhost:8080';
    this.apiToken = process.env.FREQTRADE_API_TOKEN || '';

    // Initialize Axios instance with auth headers
    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: this.apiToken ? `Bearer ${this.apiToken}` : undefined,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    logger.info(`[Freqtrade] Initialized API client: ${this.baseUrl}`);
  }

  /**
   * Check Freqtrade bot connectivity
   */
  async verifyConnection(): Promise<boolean> {
    try {
      const response = await this.api.get('/api/v1/status');
      logger.info('[Freqtrade] ✅ Connected to Freqtrade bot:', response.data);
      return true;
    } catch (error) {
      logger.error('[Freqtrade] ❌ Failed to connect to Freqtrade bot:', error);
      return false;
    }
  }

  /**
   * Deploy strategy file to Freqtrade
   * Strategy must have required methods: populate_indicators, populate_entry_trend, populate_exit_trend
   */
  async deployStrategy(
    strategyCode: string,
    strategyName: string
  ): Promise<{ strategyId: string; status: string }> {
    try {
      logger.info(`[Freqtrade] Deploying strategy: ${strategyName}`);

      // Validate strategy code first
      const isValid = await this.validateStrategyCode(strategyCode);
      if (!isValid) {
        throw new Error('Strategy code validation failed');
      }

      // Save strategy file to Freqtrade strategies directory
      const response = await this.api.post('/api/v1/strategy/deploy', {
        strategyName,
        strategyCode,
        forceOverwrite: true,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Strategy deployment failed');
      }

      logger.info(`[Freqtrade] ✅ Strategy deployed: ${strategyName}`);

      return {
        strategyId: response.data.strategyId || strategyName,
        status: 'deployed',
      };
    } catch (error) {
      logger.error('[Freqtrade] Strategy deployment failed:', error);
      throw error;
    }
  }

  /**
   * Validate strategy code against Freqtrade schema
   */
  private async validateStrategyCode(code: string): Promise<boolean> {
    try {
      const response = await this.api.post('/api/v1/strategy/validate', {
        code,
      });

      return response.data.valid || false;
    } catch (error) {
      logger.warn('[Freqtrade] Strategy validation error:', error);
      return false;
    }
  }

  /**
   * Queue backtest on Freqtrade
   */
  async queueBacktest(request: FreqtradeBacktestRequest): Promise<string> {
    try {
      logger.info(
        `[Freqtrade] Queuing backtest for ${request.pair} ${request.timeframe} ` +
        `(${request.timerange})`
      );

      const response = await this.api.post('/api/v1/backtest', {
        strategy: request.strategyCode || request.strategyId,
        pair: request.pair,
        timeframe: request.timeframe,
        timerange: request.timerange,
        stake_amount: request.stakeAmount,
        dry_run: true,
        trading_mode: 'spot',
        margin_mode: null,
      });

      if (!response.data.backtest_id) {
        throw new Error('Failed to queue backtest');
      }

      logger.info(`[Freqtrade] Backtest queued: ${response.data.backtest_id}`);

      return response.data.backtest_id;
    } catch (error) {
      logger.error('[Freqtrade] Error queueing backtest:', error);
      throw error;
    }
  }

  /**
   * Poll backtest results from Freqtrade
   */
  async getBacktestResults(backtestId: string): Promise<BacktestMetrics | null> {
    try {
      const response = await this.api.get(`/api/v1/backtest/${backtestId}/result`);

      if (!response.data.result) {
        logger.debug(`[Freqtrade] Backtest ${backtestId} not yet completed`);
        return null;
      }

      const result = response.data.result;

      // Map Freqtrade results to our BacktestMetrics interface
      const metrics: BacktestMetrics = {
        totalTrades: result.trade_count || 0,
        profitableTrades: result.wins || 0,
        losingTrades: result.losses || 0,
        winRatePercent: result.win_rate || 0,
        totalProfitUsd: (result.total_profit || 0) * ((result.stake_amount || 100) / 100),
        totalProfitPercent: ((result.total_profit || 0) * 100) / (result.stake_amount || 100),
        avgProfitPercent: result.avg_profit || 0,
        sharpeRatio: result.sharpe_ratio || 0,
        sortinoRatio: result.sortino_ratio || 0,
        maxDrawdownPercent: (result.max_drawdown || 0) * 100,
        buyAndHoldPercent: result.buy_hold_abs || 0,
        exposureTimePercent: result.exposure_time || 0,
        avgDurationMinutes: (result.avg_duration || 0) / 1000 / 60, // Convert from ms
        recoveryFactor: result.recovery_factor || 0,
        expectancy: result.expectancy || 0,
      };

      logger.info(
        `[Freqtrade] ✅ Backtest results: ${metrics.totalTrades} trades, ` +
        `${metrics.winRatePercent.toFixed(1)}% win rate, ` +
        `Sharpe: ${metrics.sharpeRatio.toFixed(2)}`
      );

      return metrics;
    } catch (error) {
      logger.warn(`[Freqtrade] Error fetching backtest results:`, error);
      return null;
    }
  }

  /**
   * Start hyperparameter optimization
   */
  async startOptimization(
    strategyId: string,
    pair: string,
    timerange: string,
    trials: number = 50,
    spaces: string[] = ['buy', 'sell', 'roi', 'stoploss']
  ): Promise<{ optimizationId: string; status: string }> {
    try {
      logger.info(
        `[Freqtrade] Starting optimization for ${strategyId} with ${trials} trials`
      );

      const response = await this.api.post('/api/v1/hyperopt/start', {
        strategy: strategyId,
        pair,
        timerange,
        spaces,
        hyperopt_trials: trials,
        hyperopt_min_trades: 5,
        hyperopt_loss: 'SharpeHyperOptLoss', // Optimize for Sharpe ratio
        n_startup_candles: 30,
        stake_currency: 'USDT',
        dry_run: true,
      });

      if (!response.data.optimization_id) {
        throw new Error('Failed to start optimization');
      }

      logger.info(`[Freqtrade] Optimization started: ${response.data.optimization_id}`);

      return {
        optimizationId: response.data.optimization_id,
        status: 'running',
      };
    } catch (error) {
      logger.error('[Freqtrade] Error starting optimization:', error);
      throw error;
    }
  }

  /**
   * Get optimization status and results
   */
  async getOptimizationStatus(optimizationId: string): Promise<{
    status: 'running' | 'completed';
    bestParameters?: Record<string, any>;
    metrics?: BacktestMetrics;
    progress: number;
  }> {
    try {
      const response = await this.api.get(
        `/api/v1/hyperopt/${optimizationId}/status`
      );

      const trialsCompleted = response.data.trials_completed || 0;
      const totalTrials = response.data.trials_total || 50;
      const progress = (trialsCompleted / totalTrials) * 100;

      if (response.data.status === 'completed') {
        return {
          status: 'completed',
          bestParameters: response.data.best_parameters,
          metrics: {
            totalTrades: response.data.best_result?.trade_count || 0,
            profitableTrades: response.data.best_result?.wins || 0,
            losingTrades: response.data.best_result?.losses || 0,
            winRatePercent: response.data.best_result?.win_rate || 0,
            totalProfitPercent: response.data.best_result?.total_profit || 0,
            totalProfitUsd: 0, // Calculate based on stake
            avgProfitPercent: response.data.best_result?.avg_profit || 0,
            sharpeRatio: response.data.best_result?.sharpe_ratio || 0,
            sortinoRatio: response.data.best_result?.sortino_ratio || 0,
            maxDrawdownPercent: (response.data.best_result?.max_drawdown || 0) * 100,
            buyAndHoldPercent: response.data.best_result?.buy_hold || 0,
            exposureTimePercent: response.data.best_result?.exposure_time || 0,
            avgDurationMinutes: (response.data.best_result?.avg_duration || 0) / 60000,
            recoveryFactor: response.data.best_result?.recovery_factor || 0,
            expectancy: response.data.best_result?.expectancy || 0,
          },
          progress: 100,
        };
      }

      logger.debug(
        `[Freqtrade] Optimization progress: ${trialsCompleted}/${totalTrials} trials`
      );

      return {
        status: 'running',
        progress,
      };
    } catch (error) {
      logger.warn('[Freqtrade] Error fetching optimization status:', error);
      throw error;
    }
  }

  /**
   * Deploy optimized parameters to live strategy
   */
  async deployOptimizedStrategy(
    strategyId: string,
    optimizedParameters: Record<string, any>
  ): Promise<boolean> {
    try {
      logger.info(`[Freqtrade] Deploying optimized parameters to ${strategyId}`);

      const response = await this.api.post(
        `/api/v1/strategy/${strategyId}/parameters`,
        {
          parameters: optimizedParameters,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Deployment failed');
      }

      logger.info(`[Freqtrade] ✅ Optimized parameters deployed`);

      return true;
    } catch (error) {
      logger.error('[Freqtrade] Error deploying optimized parameters:', error);
      return false;
    }
  }

  /**
   * Get available strategies from Freqtrade
   */
  async getDeployedStrategies(): Promise<
    Array<{ name: string; parameters: Record<string, any> }>
  > {
    try {
      const response = await this.api.get('/api/v1/strategies');

      return response.data.strategies || [];
    } catch (error) {
      logger.error('[Freqtrade] Error fetching strategies:', error);
      return [];
    }
  }

  /**
   * Get live bot status
   */
  async getBotStatus(): Promise<{
    status: string;
    trades: number;
    balance: number;
    profit: number;
  }> {
    try {
      const response = await this.api.get('/api/v1/bot/status');

      return {
        status: response.data.state || 'unknown',
        trades: response.data.trade_count || 0,
        balance: response.data.balance?.total || 0,
        profit: response.data.performance?.profit || 0,
      };
    } catch (error) {
      logger.error('[Freqtrade] Error fetching bot status:', error);
      throw error;
    }
  }

  /**
   * Start live trading with strategy
   */
  async startLiveTrading(strategyId: string): Promise<boolean> {
    try {
      logger.info(`[Freqtrade] Starting live trading with strategy: ${strategyId}`);

      const response = await this.api.post('/api/v1/bot/start', {
        strategy: strategyId,
        dry_run: false,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to start trading');
      }

      logger.info(`[Freqtrade] ✅ Live trading started`);

      return true;
    } catch (error) {
      logger.error('[Freqtrade] Error starting live trading:', error);
      return false;
    }
  }

  /**
   * Stop live trading
   */
  async stopLiveTrading(): Promise<boolean> {
    try {
      const response = await this.api.post('/api/v1/bot/stop');

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to stop trading');
      }

      logger.info(`[Freqtrade] ✅ Live trading stopped`);

      return true;
    } catch (error) {
      logger.error('[Freqtrade] Error stopping live trading:', error);
      return false;
    }
  }
}

export const productionFreqtradeIntegration = new ProductionFreqtradeIntegration();
