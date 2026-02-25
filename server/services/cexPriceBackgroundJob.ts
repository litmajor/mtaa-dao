/**
 * CEX Price Background Job Scheduler
 * Handles periodic price collection with cron scheduling
 * 
 * Features:
 * - Configurable collection intervals
 * - Graceful startup/shutdown
 * - Error handling and recovery
 * - Collection statistics
 * - Memory efficiency
 */

import { Pool } from 'pg';
import { CEXPriceCollector, CollectionResult } from './cexPriceCollector';

export interface JobConfig {
  collectionIntervalSeconds: number; // How often to collect prices (default: 30)
  tradingPairs?: string[]; // Pairs to collect (default: DEFAULT_TRADING_PAIRS)
  maxConcurrentExchanges: number; // Max exchanges to collect from simultaneously
  onError?: (error: Error) => void; // Error callback
}

export interface JobStats {
  isRunning: boolean;
  startTime: number | null;
  totalCollections: number;
  successfulCollections: number;
  failedCollections: number;
  averageCollectionTime: number;
  lastCollectionTime: number | null;
  nextCollectionTime: number | null;
  uptime: number;
}

/**
 * Background job for price collection
 */
export class CEXPriceBackgroundJob {
  private collector: CEXPriceCollector;
  private config: Required<JobConfig>;
  private jobTimer: NodeJS.Timer | null = null;
  private isRunning: boolean = false;
  private startTime: number | null = null;
  private stats = {
    totalCollections: 0,
    successfulCollections: 0,
    failedCollections: 0,
    totalCollectionTime: 0,
    lastCollectionTime: 0,
  };
  private static instance: CEXPriceBackgroundJob;

  private constructor(db: Pool, config: JobConfig) {
    this.collector = new CEXPriceCollector(db);
    this.config = {
      collectionIntervalSeconds: config.collectionIntervalSeconds || 30,
      tradingPairs: config.tradingPairs,
      maxConcurrentExchanges: config.maxConcurrentExchanges || 3,
      onError: config.onError || (() => {}),
    };
  }

  /**
   * Initialize singleton instance
   */
  static initialize(db: Pool, config: JobConfig): CEXPriceBackgroundJob {
    if (!CEXPriceBackgroundJob.instance) {
      CEXPriceBackgroundJob.instance = new CEXPriceBackgroundJob(db, config);
    }
    return CEXPriceBackgroundJob.instance;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CEXPriceBackgroundJob {
    if (!CEXPriceBackgroundJob.instance) {
      throw new Error('CEXPriceBackgroundJob not initialized. Call initialize() first.');
    }
    return CEXPriceBackgroundJob.instance;
  }

  /**
   * Start background job
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[CEXPriceBackgroundJob] Job already running');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();

    console.log(
      `[CEXPriceBackgroundJob] Starting with ${this.config.collectionIntervalSeconds}s interval`
    );

    // Run first collection immediately
    await this.runCollection();

    // Schedule recurring collections
    this.jobTimer = setInterval(() => this.runCollection(), this.config.collectionIntervalSeconds * 1000);

    // Graceful shutdown on process signals
    this.setupSignalHandlers();
  }

  /**
   * Stop background job
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[CEXPriceBackgroundJob] Job not running');
      return;
    }

    if (this.jobTimer) {
      clearInterval(this.jobTimer);
      this.jobTimer = null;
    }

    this.isRunning = false;

    console.log('[CEXPriceBackgroundJob] Job stopped');
    console.log(`[CEXPriceBackgroundJob] Final stats:`, this.getStats());
  }

  /**
   * Run a single collection cycle
   */
  private async runCollection(): Promise<void> {
    const collectionStartTime = Date.now();

    try {
      console.log(`[CEXPriceBackgroundJob] Starting collection cycle...`);

      const results = await this.collector.fetchAllExchanges(this.config.tradingPairs);

      const duration = Date.now() - collectionStartTime;
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      this.stats.totalCollections++;
      this.stats.successfulCollections += successCount;
      this.stats.failedCollections += failureCount;
      this.stats.totalCollectionTime += duration;
      this.stats.lastCollectionTime = Date.now();

      // Log summary
      console.log(`[CEXPriceBackgroundJob] Collection complete:`, {
        duration,
        successCount,
        failureCount,
        details: results.map(r => ({
          exchange: r.exchange,
          success: r.success,
          pairsProcessed: r.pairsProcessed,
          pairsFailed: r.pairsFailed,
        })),
      });

      // Log detailed results
      for (const result of results) {
        if (!result.success) {
          const error = new Error(`Collection failed for ${result.exchange}: ${result.error}`);
          this.config.onError?.(error);
          console.error(`[CEXPriceBackgroundJob] ${result.exchange} failed:`, result.error);
        } else {
          console.log(
            `[CEXPriceBackgroundJob] ${result.exchange}: ${result.pairsProcessed}/${
              result.pairsProcessed + result.pairsFailed
            } pairs (${result.duration}ms)`
          );
        }
      }
    } catch (error) {
      this.stats.failedCollections++;
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.onError?.(err);
      console.error('[CEXPriceBackgroundJob] Unexpected error during collection:', error);
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals = ['SIGINT', 'SIGTERM'];

    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\n[CEXPriceBackgroundJob] Received ${signal}, shutting down gracefully...`);
        await this.stop();
        process.exit(0);
      });
    });
  }

  /**
   * Get job statistics
   */
  getStats(): JobStats {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;
    const nextCollectionTime = this.isRunning
      ? this.stats.lastCollectionTime + this.config.collectionIntervalSeconds * 1000
      : null;

    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      totalCollections: this.stats.totalCollections,
      successfulCollections: this.stats.successfulCollections,
      failedCollections: this.stats.failedCollections,
      averageCollectionTime:
        this.stats.totalCollections > 0
          ? this.stats.totalCollectionTime / this.stats.totalCollections
          : 0,
      lastCollectionTime: this.stats.lastCollectionTime || null,
      nextCollectionTime,
      uptime,
    };
  }

  /**
   * Get collector instance for manual operations
   */
  getCollector(): CEXPriceCollector {
    return this.collector;
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    if (this.jobTimer) {
      clearInterval(this.jobTimer);
      this.jobTimer = null;
    }
    this.collector.destroy();
    this.isRunning = false;
  }
}

/**
 * Helper to create and start background job
 */
export async function startPriceCollectionJob(db: Pool, config: JobConfig): Promise<CEXPriceBackgroundJob> {
  const job = CEXPriceBackgroundJob.initialize(db, config);
  await job.start();
  return job;
}
