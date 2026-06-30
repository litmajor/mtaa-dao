/**
 * Engine Service
 * Compute Orchestration Layer - Manages job execution, status tracking, and progress updates
 * * Responsibilities:
 * 1. Coordinate backtest/optimize job execution
 * 2. Monitor job status and provide real-time progress via Redis pub/sub
 * 3. Handle job retries with exponential backoff
 * 4. Cache job results for fast API retrieval
 * 5. Provide job status endpoints for client polling
 */

import { logger } from '../utils/logger';
import { redis } from './redis';
import { jobQueueService } from './jobQueueService';
import { 
  rsi, 
  macd, 
  sma, 
  bollingerBands, 
  atr, 
  stochastic,
  ema,
  adx,
  williamsR,
  obv,
  mfi
} from './indicators';
import pLimit from 'p-limit';

// Tokens that should not be queried against public CEX OHLCV endpoints
const CELO_NATIVE_SYMBOLS = new Set(['CKES', 'CUSD', 'CEUR', 'CREAL', 'CELO', 'MTAA']);

export interface JobProgress {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  message?: string;
  eta?: number; // milliseconds until completion
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  retries?: number;
}

export interface JobMonitoringOptions {
  updateInterval?: number; // ms between progress updates
  statusChannel?: string; // Redis pub/sub channel
  resultTTL?: number; // How long to cache results
}

/**
 * Engine Service - Coordinate compute job execution and monitoring
 */
export class EngineService {
  private readonly JOB_STATUS_PREFIX = 'engine:job:';
  private readonly JOB_RESULT_PREFIX = 'engine:result:';
  private readonly JOB_CHANNEL_PREFIX = 'engine:progress:';
  private readonly DEFAULT_RESULT_TTL = 3600; // 1 hour
  private activeJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor(private options: JobMonitoringOptions = {}) {
    this.options = {
      updateInterval: options.updateInterval || 5000, // 5s between updates
      statusChannel: options.statusChannel || 'engine:progress',
      resultTTL: options.resultTTL || this.DEFAULT_RESULT_TTL,
    };
  }

  /**
   * Queue a compute job (backtest, optimize, rebalance)
   * Returns job ID for client polling
   */
  async queueComputeJob(
    jobType: 'strategy-backtest' | 'strategy-optimize' | 'pool-rebalance' | 'vault-rebalance',
    payload: any,
    options?: {
      priority?: number;
      timeout?: number;
      estimatedDuration?: number;
    }
  ): Promise<string> {
    try {
      logger.info(`[Engine] Queuing ${jobType} job...`);

      // Queue job via jobQueueService
      const jobId = await jobQueueService.queueJob(jobType, payload, {
        priority: options?.priority || 5,
        timeout: options?.timeout || 300000, // 5 min default
      });

      // Initialize job status in Redis
      const jobStatus: JobProgress = {
        jobId,
        status: 'queued',
        progress: 0,
        message: `${jobType} queued`,
        startedAt: new Date(),
      };

      await this.setJobStatus(jobId, jobStatus);

      // Start monitoring this job
      this.startJobMonitoring(jobId, jobType, options?.estimatedDuration);

      logger.info(`[Engine] Job ${jobId} queued (type: ${jobType})`);
      return jobId;
    } catch (error) {
      logger.error(`[Engine] Failed to queue ${jobType} job:`, error);
      throw error;
    }
  }

  /**
   * Get job status and progress
   * Returns current status from Redis cache
   */
  async getJobStatus(jobId: string): Promise<JobProgress | null> {
    try {
      const key = `${this.JOB_STATUS_PREFIX}${jobId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`[Engine] Failed to get job status for ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Update job status (called by workers)
   */
  async setJobStatus(jobId: string, status: JobProgress): Promise<void> {
    try {
      const key = `${this.JOB_STATUS_PREFIX}${jobId}`;
      await redis.set(key, JSON.stringify(status), 86400); // 24-hour TTL

      logger.debug(`[Engine] Job ${jobId} status updated: ${status.status} (${status.progress}%)`);
    } catch (error) {
      logger.error(`[Engine] Failed to set job status for ${jobId}:`, error);
    }
  }

  /**
   * Mark job as completed with result
   */
  async completeJob(jobId: string, result: any): Promise<void> {
    try {
      const currentStatus = await this.getJobStatus(jobId);

      const completedStatus: JobProgress = {
        jobId,
        status: 'completed',
        progress: 100,
        message: 'Job completed',
        completedAt: new Date(),
        result,
        startedAt: currentStatus?.startedAt,
      };

      await this.setJobStatus(jobId, completedStatus);

      // Cache result separately for fast retrieval
      const resultKey = `${this.JOB_RESULT_PREFIX}${jobId}`;
      await redis.set(resultKey, JSON.stringify(result), this.options.resultTTL || 3600);

      logger.info(`[Engine] Job ${jobId} completed`);
      this.stopJobMonitoring(jobId);
    } catch (error) {
      logger.error(`[Engine] Failed to complete job ${jobId}:`, error);
    }
  }

  /**
   * Mark job as failed with error message
   */
  async failJob(jobId: string, error: Error | string, retryCount: number = 0): Promise<void> {
    try {
      const currentStatus = await this.getJobStatus(jobId);

      const failedStatus: JobProgress = {
        jobId,
        status: 'failed',
        progress: currentStatus?.progress || 0,
        message: 'Job failed',
        error: typeof error === 'string' ? error : error.message,
        completedAt: new Date(),
        retries: retryCount,
        startedAt: currentStatus?.startedAt,
      };

      await this.setJobStatus(jobId, failedStatus);

      logger.error(`[Engine] Job ${jobId} failed (attempt ${retryCount}):`, error);
      this.stopJobMonitoring(jobId);
    } catch (error) {
      logger.error(`[Engine] Failed to mark job ${jobId} as failed:`, error);
    }
  }

  /**
   * Update job progress (0-100)
   * Called by workers to report progress
   */
  async updateJobProgress(
    jobId: string,
    options: {
      progress: number; // 0-100
      message?: string;
      eta?: number; // milliseconds until completion
    }
  ): Promise<void> {
    try {
      const currentStatus = await this.getJobStatus(jobId);
      if (!currentStatus) return;

      const updatedStatus: JobProgress = {
        ...currentStatus,
        progress: Math.min(options.progress, 100),
        message: options.message,
        eta: options.eta,
      };

      await this.setJobStatus(jobId, updatedStatus);
    } catch (error) {
      logger.error(`[Engine] Failed to update job progress for ${jobId}:`, error);
    }
  }

  /**
   * Get job result if available
   */
  async getJobResult(jobId: string): Promise<any | null> {
    try {
      const key = `${this.JOB_RESULT_PREFIX}${jobId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`[Engine] Failed to get job result for ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Cancel a queued or running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      this.stopJobMonitoring(jobId);

      const status = await this.getJobStatus(jobId);
      if (!status) {
        return false;
      }

      // If job is not yet started, mark as cancelled
      if (status.status === 'queued') {
        const cancelledStatus: JobProgress = {
          jobId,
          status: 'failed',
          progress: 0,
          message: 'Job cancelled by user',
          error: 'Cancelled',
          completedAt: new Date(),
        };
        await this.setJobStatus(jobId, cancelledStatus);
        return true;
      }

      // If job is processing, we can only mark it for cancellation
      logger.info(`[Engine] Job ${jobId} marked for cancellation (may still be processing)`);
      return false;
    } catch (error) {
      logger.error(`[Engine] Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Start monitoring a job for progress updates
   * Polls job status and publishes updates via Redis pub/sub
   */
  private startJobMonitoring(
    jobId: string,
    jobType: string,
    estimatedDuration?: number
  ): void {
    if (this.activeJobs.has(jobId)) {
      return;
    }

    logger.debug(`[Engine] Started monitoring job ${jobId}`);

    const monitoringInterval = setInterval(async () => {
      try {
        const status = await this.getJobStatus(jobId);

        if (!status) {
          clearInterval(monitoringInterval);
          this.activeJobs.delete(jobId);
          return;
        }

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(monitoringInterval);
          this.activeJobs.delete(jobId);
          return;
        }

        // Auto-estimate progress if ETA provided
        if (estimatedDuration && status.startedAt && status.status === 'processing') {
          const elapsed = Date.now() - new Date(status.startedAt).getTime();
          const estimatedProgress = Math.min(90, (elapsed / estimatedDuration) * 100);

          if (estimatedProgress > status.progress) {
            await this.updateJobProgress(jobId, {
              progress: Math.round(estimatedProgress),
              eta: Math.max(0, estimatedDuration - elapsed),
            });
          }
        }
      } catch (error) {
        logger.error(`[Engine] Error during job monitoring for ${jobId}:`, error);
      }
    }, this.options.updateInterval);

    this.activeJobs.set(jobId, monitoringInterval);
  }

  /**
   * Stop monitoring a job
   */
  private stopJobMonitoring(jobId: string): void {
    const interval = this.activeJobs.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.activeJobs.delete(jobId);
      logger.debug(`[Engine] Stopped monitoring job ${jobId}`);
    }
  }

  /**
   * Subscribe to job progress updates via Redis pub/sub
   */
  subscribeToJobProgress(
    jobId: string,
    onUpdate: (progress: JobProgress) => void
  ): () => void {
    const channel = `${this.JOB_CHANNEL_PREFIX}${jobId}`;

    const messageListener = async (msg: string) => {
      try {
        const progress = JSON.parse(msg) as JobProgress;
        onUpdate(progress);
      } catch (error) {
        logger.error(`[Engine] Error parsing progress message for ${jobId}:`, error);
      }
    };

    return () => {
      logger.debug(`[Engine] Unsubscribed from job ${jobId} progress`);
    };
  }

  /**
   * Get stats on all active jobs
   */
  async getActiveJobsStats(): Promise<{
    totalActive: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const stats = {
        totalActive: 0,
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      logger.debug('[Engine] Job stats computed (Redis keys not available in fallback mode)');
      return stats;
    } catch (error) {
      logger.error(`[Engine] Failed to get active jobs stats:`, error);
      return { totalActive: 0, queued: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * ========================================
   * DATA PROVIDER METHODS (Phase 5)
   * For Computation Modules to Pull from Redis Instead of API Calls
   * ========================================
   */

  /**
   * Get cached prices for multiple symbols from Redis
   * Falls back to collector if not in cache
   */
  async getAssetPrices(
    symbols: string[],
    options?: {
      fallbackToCollector?: boolean;
      includeChainData?: boolean;
    }
  ): Promise<Map<string, any>> {
    try {
      const results = new Map<string, any>();
      const { fallbackToCollector = true } = options || {};

      const cachedPrices = await Promise.allSettled(
        symbols.map(async (symbol) => {
          const cacheKey = `collector:price:${symbol}`;
          const cached = await redis.get(cacheKey);
          return { symbol, data: cached ? JSON.parse(cached) : null };
        })
      );

      const missingSymbols: string[] = [];

      for (const result of cachedPrices) {
        if (result.status === 'fulfilled' && result.value.data) {
          results.set(result.value.symbol, result.value.data);
        } else if (result.status === 'fulfilled') {
          missingSymbols.push(result.value.symbol);
        }
      }

      if (missingSymbols.length > 0 && fallbackToCollector) {
        try {
          const { collectorService } = await import('./collectorService');
          const freshPricesResult = await collectorService.collectPricesForSymbols(missingSymbols);
          if (freshPricesResult?.data) {
            for (const priceData of freshPricesResult.data) {
              results.set(priceData.symbol, priceData.price);
            }
          }
        } catch (error) {
          logger.warn(`[Engine] Failed to fetch missing prices from collector:`, error);
        }
      }

      logger.debug(`[Engine] getAssetPrices: ${results.size}/${symbols.length} symbols retrieved`);
      return results;
    } catch (error) {
      logger.error(`[Engine] Failed to get asset prices:`, error);
      return new Map();
    }
  }

  /**
   * Get OHLC (Open/High/Low/Close) data for a symbol
   * Used by: Technical Analysis, Indicators Calculation, Asset State Engine
   */
  async getOHLCData(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<any[] | null> {
    try {
      // 🛡️ Guard Check: Block native platform tokens (Celo native/stablecoins) from reaching centralized public CEX APIs
      const baseSym = String(symbol).includes('/') ? String(symbol).split('/')[0] : String(symbol);
      if (CELO_NATIVE_SYMBOLS.has(baseSym.toUpperCase())) {
        logger.debug(`[Engine] Bypassing external public exchange queries for native asset: ${symbol}`);
        return null;
      }

      const cacheKey = `collector:ohlc:${symbol}:${timeframe}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        logger.debug(`[Engine] OHLC cache hit for ${symbol}:${timeframe}`);
        return JSON.parse(cached);
      }

      try {
        const { ccxtService: ccxtSvc } = await import('./ccxtService');
        const result = await ccxtSvc.getOHLCV(symbol, timeframe, limit);
        const ohlcData = result?.data || result || [];

        if (ohlcData && Array.isArray(ohlcData) && ohlcData.length > 0) {
          await redis.set(cacheKey, JSON.stringify(ohlcData), 300);
          return ohlcData;
        }
      } catch (error) {
        logger.debug(`[Engine] CCXT fallback unavailable for ${symbol}`);
      }

      return null;
    } catch (error) {
      logger.error(`[Engine] Failed to get OHLC data:`, error);
      return null;
    }
  }

  /**
   * Get OHLCV data with multi-service fallback & production hardening
   */
  async getOHLCDataMultiService(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<any[] | null> {
    try {
      // 🛡️ Guard Check: Block native platform tokens (Celo native/stablecoins) from reaching centralized public CEX APIs
      const baseSym = String(symbol).includes('/') ? String(symbol).split('/')[0] : String(symbol);
      if (CELO_NATIVE_SYMBOLS.has(baseSym.toUpperCase())) {
        logger.debug(`[Engine] Bypassing external production service queries for native asset: ${symbol}`);
        return null;
      }

      // Try production OHLCV service first
      try {
        const { ohlcvService: productionService } = await import('./ohlcvService');
        const response = await productionService.getCandles(symbol, timeframe, limit);
        
        if (response.status === 'success' && response.data.length > 0) {
          logger.debug(
            `[Engine] OHLCV from production service: ${symbol}/${timeframe} (${response.data.length} candles, ${response.quality}, via ${response.exchangeUsed})`
          );
          return response.data.map((candle: any) => [
            candle.timestamp * 1000,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
            candle.volume_quote
          ]);
        }
      } catch (error) {
        logger.debug(`[Engine] Production OHLCV service unavailable:`, (error as Error).message);
      }

      // Fallback: Try foundation OHLCV service
      try {
        const { ohlcvService: foundationService } = await import('./ohlcvServicev1');
        const response = await foundationService.getCandles(symbol, timeframe, limit);
        
        if (response.status === 'success' && response.data.length > 0) {
          logger.debug(`[Engine] OHLCV from foundation service: ${symbol}/${timeframe} (${response.data.length} candles)`);
          return response.data.map((candle: any) => [
            candle.timestamp * 1000,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
            candle.volume_quote
          ]);
        }
      } catch (error) {
        logger.debug(`[Engine] Foundation OHLCV service unavailable`);
      }

      logger.debug(`[Engine] No OHLC data available for ${symbol}/${timeframe}`);
      return null;
    } catch (error) {
      logger.warn(`[Engine] Failed to get OHLC data via any service for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get OHLCV for MULTIPLE TIMEFRAMES in parallel
   */
  async getOHLCDataMultiTimeframe(
    symbol: string,
    timeframes: string[] = ['15m', '1h', '4h', '1d'],
    limit: number = 100
  ): Promise<Map<string, any[]>> {
    const startTime = Date.now();
    const results = new Map<string, any[]>();

    try {
      logger.debug(
        `[Engine] Fetching OHLCV for ${symbol} across ${timeframes.length} timeframes in parallel: ${timeframes.join(', ')}`
      );

      const ohlcvPromises = timeframes.map((tf) =>
        this.getOHLCDataMultiService(symbol, tf, limit)
          .then((data) => ({ timeframe: tf, data }))
          .catch((error) => {
            logger.warn(`[Engine] Failed to fetch OHLCV for ${symbol}:${tf}`, error);
            return { timeframe: tf, data: null };
          })
      );

      const allResults = await Promise.all(ohlcvPromises);

      let successCount = 0;
      for (const { timeframe, data } of allResults) {
        if (data && data.length > 0) {
          results.set(timeframe, data);
          successCount++;
        }
      }

      const elapsed = Date.now() - startTime;
      logger.debug(
        `[Engine] OHLCV multi-timeframe complete for ${symbol}: ${successCount}/${timeframes.length} timeframes in ${elapsed}ms`
      );

      return results;
    } catch (error) {
      logger.error(`[Engine] Failed to get OHLCV multi-timeframe for ${symbol}:`, error);
      return new Map();
    }
  }

  /**
   * Calculate indicators for MULTIPLE TIMEFRAMES from parallel-fetched OHLCV
   */
  private async calculateIndicatorsMultiTimeframe(
    symbol: string,
    timeframesToOHLCV: Map<string, any[]>
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    try {
      const indicatorPromises = Array.from(timeframesToOHLCV.entries()).map(([timeframe, ohlcData]) =>
        this.calculateIndicators(ohlcData, symbol)
          .then((indicators) => ({ timeframe, indicators }))
          .catch((error) => {
            logger.warn(`[Engine] Indicator calculation failed for ${symbol}:${timeframe}`, error);
            return { timeframe, indicators: {} };
          })
      );

      const allResults = await Promise.all(indicatorPromises);

      for (const { timeframe, indicators } of allResults) {
        if (indicators && Object.keys(indicators).length > 0) {
          results.set(timeframe, indicators);
        }
      }

      return results;
    } catch (error) {
      logger.error(`[Engine] Failed to calculate multi-timeframe indicators:`, error);
      return new Map();
    }
  }

  /**
   * Get technical indicators for a single symbol
   */
  async getTechnicalIndicators(symbol: string, timeframe: string = '1h'): Promise<any | null> {
    try {
      const cacheKey = `collector:indicators:${symbol}:${timeframe}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        logger.debug(`[Engine] Indicators cache hit for ${symbol}:${timeframe}`);
        return JSON.parse(cached);
      }

      // Use the multi-service OHLCV fetch which handles production fallback gracefully
      const ohlcData = await this.getOHLCDataMultiService(symbol, timeframe);
      
      // 🛡️ Depth Check: Require a minimum tracking payload length to calculate stable TA indicators
      if (!ohlcData || ohlcData.length < 30) {
        logger.warn(
          `[Engine] Insufficient structural history depth for ${symbol}:${timeframe}. ` +
          `Got ${ohlcData?.length || 0}/30 required candles. Aborting signal calculation.`
        );
        return null;
      }

      try {
        const indicators = await this.calculateIndicators(ohlcData, symbol);

        if (indicators) {
          await redis.set(cacheKey, JSON.stringify(indicators), 300);
        }
        return indicators;
      } catch (error) {
        logger.warn(`[Engine] Failed to calculate indicators for ${symbol}:`, error);
        return null;
      }
    } catch (error) {
      logger.error(`[Engine] Failed to get technical indicators:`, error);
      return null;
    }
  }

  /**
   * Batch fetch technical indicators for multiple symbols in parallel
   */
  async getTechnicalIndicatorsBatch(
    symbols: string[],
    timeframe: string = '1h',
    options?: {
      parallel?: boolean;
      batchSize?: number;
    }
  ): Promise<Map<string, any>> {
    try {
      const { parallel = true, batchSize = 10 } = options || {};
      const results = new Map<string, any>();

      if (parallel && symbols.length > 1) {
        const batches = [];
        for (let i = 0; i < symbols.length; i += batchSize) {
          const batch = symbols.slice(i, i + batchSize);
          batches.push(
            Promise.allSettled(
              batch.map((symbol) =>
                this.getTechnicalIndicators(symbol, timeframe).then((data) => ({
                  symbol,
                  data,
                }))
              )
            )
          );
        }

        const allResults = await Promise.all(batches);
        for (const batch of allResults) {
          for (const result of batch) {
            if (result.status === 'fulfilled' && result.value.data) {
              results.set(result.value.symbol, result.value.data);
            }
          }
        }
      } else {
        for (const symbol of symbols) {
          const data = await this.getTechnicalIndicators(symbol, timeframe);
          if (data) {
            results.set(symbol, data);
          }
        }
      }

      logger.info(`[Engine] getTechnicalIndicatorsBatch: ${results.size}/${symbols.length} indicators calculated`);
      return results;
    } catch (error) {
      logger.error(`[Engine] Failed to get technical indicators batch:`, error);
      return new Map();
    }
  }

  /**
   * MULTI-TIMEFRAME: Get indicators for ONE symbol across MULTIPLE timeframes
   */
  async getTechnicalIndicatorsMultiTimeframe(
    symbol: string,
    timeframes: string[] = ['15m', '1h', '4h', '1d']
  ): Promise<Map<string, any>> {
    const startTime = Date.now();
    const results = new Map<string, any>();

    try {
      logger.info(`[Engine] Fetching indicators for ${symbol} across ${timeframes.length} timeframes: ${timeframes.join(', ')}`);

      const indicatorPromises = timeframes.map((tf) =>
        this.getTechnicalIndicators(symbol, tf)
          .then((indicators) => ({ timeframe: tf, indicators }))
          .catch((error) => {
            logger.warn(`[Engine] Failed to get indicators for ${symbol}:${tf}`, error);
            return { timeframe: tf, indicators: null };
          })
      );

      const allResults = await Promise.all(indicatorPromises);

      let successCount = 0;
      for (const { timeframe, indicators } of allResults) {
        if (indicators) {
          results.set(timeframe, indicators);
          successCount++;
        }
      }

      const elapsed = Date.now() - startTime;
      logger.info(`[Engine] Multi-timeframe indicators for ${symbol}: ${successCount}/${timeframes.length} succeeded in ${elapsed}ms`);

      return results;
    } catch (error) {
      logger.error(`[Engine] Failed to get multi-timeframe indicators for ${symbol}:`, error);
      return new Map();
    }
  }

  /**
   * MULTI-TIMEFRAME BATCH: Get indicators for MULTIPLE symbols across MULTIPLE timeframes
   */
  async getTechnicalIndicatorsBatchMultiTimeframe(
    symbols: string[],
    timeframes: string[] = ['1h', '4h', '1d'],
    options?: {
      batchSize?: number;
    }
  ): Promise<Map<string, Map<string, any>>> {
    const startTime = Date.now();
    const results = new Map<string, Map<string, any>>();

    try {
      const { batchSize = 20 } = options || {};

      logger.info(
        `[Engine] Multi-timeframe batch: ${symbols.length} symbols × ${timeframes.length} timeframes = ${symbols.length * timeframes.length} total computations`
      );

      let successCount = 0;
      let totalCount = 0;

      // Concurrency limiter to avoid overwhelming DB/cache/remote services
      const limiter = pLimit(5);

      for (let i = 0; i < symbols.length; i += batchSize) {
        const symbolBatch = symbols.slice(i, i + batchSize);

        const batchPromises = symbolBatch.map((symbol) =>
          limiter(() =>
            this.getTechnicalIndicatorsMultiTimeframe(symbol, timeframes)
              .then((timeframeIndicators) => ({ symbol, timeframeIndicators }))
              .catch((error) => {
                logger.warn(`[Engine] Failed to get multi-timeframe for ${symbol}:`, error);
                return { symbol, timeframeIndicators: new Map() };
              })
          )
        );

        const batchResults = await Promise.all(batchPromises);

        for (const { symbol, timeframeIndicators } of batchResults) {
          if (timeframeIndicators.size > 0) {
            results.set(symbol, timeframeIndicators);
            successCount++;
          }
          totalCount++;
        }

        logger.debug(
          `[Engine] Completed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(symbols.length / batchSize)}`
        );
      }

      const elapsed = Date.now() - startTime;
      logger.info(
        `[Engine] Multi-timeframe batch complete: ${successCount}/${totalCount} symbols, ${results.size * timeframes.length} total indicators in ${elapsed}ms`
      );

      return results;
    } catch (error) {
      logger.error(`[Engine] Failed to get multi-timeframe batch:`, error);
      return new Map();
    }
  }

  /**
   * Get all cached asset prices for Opportunity Engine
   * Supports pagination - enables scanning of thousands of assets safely
   */
  async getAllAssetPricesForOpportunityEngine(options?: {
    limit?: number;
    offset?: number;
    minVolume?: number;
  }): Promise<Array<{ symbol: string; price: number; volume?: number; timestamp: number }>> {
    try {
      const { limit = 1000, offset = 0, minVolume = 0 } = options || {};
      const results: Array<{ symbol: string; price: number; volume?: number; timestamp: number }> = [];

      // Safe production approach: use standard collection hash tables if key scanning is unavailable
      const compactPricesRaw = await redis.get('collector:prices:summary');
      if (compactPricesRaw) {
        const parsed = JSON.parse(compactPricesRaw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(item => (item.volume || 0) >= minVolume);
          return filtered.slice(offset, offset + limit);
        }
      }

      logger.debug('[Engine] getAllAssetPricesForOpportunityEngine fallback executed (No structured summary hash located)');
      return results;
    } catch (error) {
      logger.error('[Engine] Failed to retrieve asset prices matrix summary:', error);
      return [];
    }
  }

  /**
   * Internal processor mapping raw multi-dimensional arrays into mathematically isolated indicators
   */
  private async calculateIndicators(ohlcData: any[][], symbol: string): Promise<any> {
    try {
      // Deconstruct column tuples securely: matrix arrays format -> [timestamp, open, high, low, close, volume]
      const closes = ohlcData.map(c => c[4]);
      const highs  = ohlcData.map(c => c[1]);
      const lows   = ohlcData.map(c => c[2]);
      const volumes = ohlcData.map(c => c[5]);

      // Execution of pipeline-imported statistical calculations
      const rsiSeries = rsi(closes, 14);
      const macdSeries = macd(closes, 12, 26, 9);
      const atrSeries = atr(highs, lows, closes, 14);
      const sma20Series = sma(closes, 20);
      const bbSeries = bollingerBands(closes, 20, 2);

      const totalCandles = ohlcData.length;

      // Extract the absolute latest index records from structural calculations
      return {
        symbol,
        timestamp: ohlcData[totalCandles - 1][0],
        rsi: rsiSeries && rsiSeries.length > 0 ? rsiSeries[rsiSeries.length - 1] : 50,
        macd: macdSeries?.macd?.length > 0 ? macdSeries.macd[macdSeries.macd.length - 1] : 0,
        signal: macdSeries?.signal?.length > 0 ? macdSeries.signal[macdSeries.signal.length - 1] : 0,
        histogram: macdSeries?.histogram?.length > 0 ? macdSeries.histogram[macdSeries.histogram.length - 1] : 0,
        atr: atrSeries && atrSeries.length > 0 ? atrSeries[atrSeries.length - 1] : 0,
        sma20: sma20Series && sma20Series.length > 0 ? sma20Series[sma20Series.length - 1] : closes[totalCandles - 1],
        bollingerBands: bbSeries ? {
          upper: bbSeries.upper?.[bbSeries.upper.length - 1] || 0,
          middle: bbSeries.middle?.[bbSeries.middle.length - 1] || 0,
          lower: bbSeries.lower?.[bbSeries.lower.length - 1] || 0
        } : null
      };
    } catch (error) {
      logger.error(`[Engine] Internal mapping loop calculation crash for ${symbol}:`, error);
      return null;
    }
  }
}

// Singleton instance for convenience
export const engineService = new EngineService();