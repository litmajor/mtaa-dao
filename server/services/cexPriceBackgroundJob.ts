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
import { executeGuardedJob } from '../utils/jobExecutionGuard';

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
  avgLatency?: number;
  maxLatency?: number;
  timingDriftMs?: number;
}

/**
 * Background job for price collection
 */
export class CEXPriceBackgroundJob {
  private collector: CEXPriceCollector;
  private config: Required<JobConfig>;
  private jobTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private startTime: number | null = null;
  private nextScheduledRun: number | null = null;
  private inMemoryCache = new Map<string, { value: any; expiresAt: number }>(); // Fallback cache
  private stats = {
    totalCollections: 0,
    successfulCollections: 0,
    failedCollections: 0,
    totalCollectionTime: 0,
    totalLatency: 0,
    maxLatency: 0,
    lastCollectionTime: 0,
  };
  private static instance: CEXPriceBackgroundJob;

  private constructor(db: Pool, config: JobConfig) {
    this.collector = new CEXPriceCollector(db);
    this.config = {
      collectionIntervalSeconds: config.collectionIntervalSeconds || 30,
      tradingPairs: (config.tradingPairs || []) as string[],
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
    this.nextScheduledRun = Date.now();

    console.log(
      `[CEXPriceBackgroundJob] Starting with ${this.config.collectionIntervalSeconds}s interval`
    );

    // Run first collection immediately
    await this.runCollection();

    // Schedule recurring collections using promise chain (deterministic, not setInterval)
    this.scheduleNextCollection();

    // Graceful shutdown on process signals
    this.setupSignalHandlers();
  }

  /**
   * Schedule next collection with timeout guard to prevent blocking
   */
  private scheduleNextCollection(): void {
    if (!this.isRunning) return;

    const now = Date.now();
    const nextRun = (this.nextScheduledRun || now) + this.config.collectionIntervalSeconds * 1000;
    const delayMs = Math.max(0, nextRun - now);

    // Timeout guard: never wait more than interval + 5s drift tolerance
    const maxWaitMs = this.config.collectionIntervalSeconds * 1000 + 5000;
    const actualDelayMs = Math.min(delayMs, maxWaitMs);

    setTimeout(async () => {
      if (this.isRunning) {
        this.nextScheduledRun = Date.now();
        
        // Wrap collection with execution guard to prevent overlapping runs
        await executeGuardedJob(
          'cex-price-collection',
          () => this.runCollection(),
          {
            skipIfRunning: true,
            timeout: (this.config.collectionIntervalSeconds - 1) * 1000, // Leave 1s buffer (collections take 20-26s, need 29s max)
          }
        );
        
        this.scheduleNextCollection();
      }
    }, actualDelayMs);
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
   * Run a single collection cycle with isolation and observability
   */
  private async runCollection(): Promise<void> {
    const collectionStartTime = Date.now();

    try {
      // Add timeout guard to prevent hanging collections
      const collectionPromise = this.performCollection();
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Collection timeout (90s)')), 90000)
      );
      
      await Promise.race([collectionPromise, timeoutPromise]);
      
      const latency = Date.now() - collectionStartTime;
      this.stats.totalLatency += latency;
      this.stats.maxLatency = Math.max(this.stats.maxLatency, latency);
      this.stats.lastCollectionTime = Date.now();

      // Alert if latency approaches interval limit (25s of 30s max)
      if (latency > 25000) {
        console.warn(`[CEXPriceBackgroundJob] ⚠️ HIGH LATENCY: ${latency}ms (approaching 30s limit)`, {
          collections: this.stats.totalCollections,
          avgLatency: Math.round(this.stats.totalLatency / this.stats.totalCollections),
          maxLatency: this.stats.maxLatency,
        });
      }

      // Log timing metrics every 10 collections for observability
      if (this.stats.totalCollections % 10 === 0) {
        const avgLatency = Math.round(this.stats.totalLatency / this.stats.totalCollections);
        const timingDrift = latency > this.config.collectionIntervalSeconds * 1000 
          ? latency - (this.config.collectionIntervalSeconds * 1000)
          : 0;
        
        console.log(`[CEXPriceBackgroundJob] 📊 TIMING METRICS (every 10x):`, {
          cycle: this.stats.totalCollections,
          lastLatency: latency,
          avgLatency,
          maxLatency: this.stats.maxLatency,
          timingDriftMs: timingDrift,
          successRate: `${Math.round((this.stats.successfulCollections / this.stats.totalCollections) * 100)}%`,
        });
      }

    } catch (error) {
      this.stats.failedCollections++;
      const e: any = error;
      const errObj = e instanceof Error ? { message: e.message, stack: e.stack } : { message: String(e) };
      this.config.onError?.(e instanceof Error ? e : new Error(String(e)));
      console.error('[CEXPriceBackgroundJob] Unexpected error during collection:', errObj);
    }
  }

  /**
   * Perform the actual price collection with cache isolation
   */
  private async performCollection(): Promise<void> {
    console.log(`[CEXPriceBackgroundJob] Starting collection cycle...`);
    console.log(`[CEXPriceBackgroundJob] Trading pairs config: ${JSON.stringify(this.config.tradingPairs)}`);

    const results = await this.collector.fetchAllExchanges(this.config.tradingPairs);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    this.stats.totalCollections++;
    this.stats.successfulCollections += successCount;
    this.stats.failedCollections += failureCount;

    // Log summary
    console.log(`[CEXPriceBackgroundJob] Collection complete:`, {
      collections: this.stats.totalCollections,
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
        const raw = result.error;
        let errObj: { message: string; stack?: string | undefined };
        if (typeof raw === 'string') {
          errObj = { message: raw };
        } else if (raw && typeof raw === 'object') {
          errObj = { message: String((raw as any).message ?? JSON.stringify(raw)), stack: (raw as any).stack };
        } else {
          errObj = { message: String(raw) };
        }
        const error = new Error(`Collection failed for ${result.exchange}: ${errObj.message}`);
        this.config.onError?.(error);
        console.error(`[CEXPriceBackgroundJob] ${result.exchange} failed:`, errObj);
      } else {
        console.log(
          `[CEXPriceBackgroundJob] ${result.exchange}: ${result.pairsProcessed}/${
            result.pairsProcessed + result.pairsFailed
          } pairs (${result.duration}ms)`
        );
      }
    }

    // Attempt cache persistence - ISOLATED from collection result
    // If cache write fails, collection is still considered successful
    try {
      await this.persistCollectionToCache(results);
    } catch (cacheError) {
      console.warn('[CEXPriceBackgroundJob] ⚠️ Cache persistence failed (non-blocking):', cacheError);
      // Cache failure does NOT fail the collection
    }
  }

  /**
   * Persist collection results to cache with fallback
   * ISOLATED: failures here don't affect collection status
   */
  private async persistCollectionToCache(results: CollectionResult[]): Promise<void> {
    // Implementation: write results to Redis cache + in-memory fallback
    // This method intentionally swallows errors to isolate cache from collection
    for (const result of results) {
      if (result.success) {
        const cacheKey = `cex:prices:${result.exchange}`;
        const cacheValue = JSON.stringify(result);
        const ttl = this.config.collectionIntervalSeconds; // TTL same as collection interval

        try {
          // Try to write to Redis (primary cache)
          if (this.collector['cache']) {
            await this.collector['cache'].set?.(cacheKey, cacheValue, ttl);
          }
        } catch (redisError) {
          // Silently use in-memory fallback if Redis fails
          this.inMemoryCache.set(cacheKey, {
            value: cacheValue,
            expiresAt: Date.now() + (ttl * 1000),
          });
        }
      }
    }
  }

  /**
   * Get from in-memory fallback cache
   */
  private getFromFallbackCache(key: string): string | null {
    const cached = this.inMemoryCache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expiresAt) {
      this.inMemoryCache.delete(key);
      return null;
    }

    return cached.value;
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
    const nextCollectionTime = this.isRunning && this.nextScheduledRun
      ? this.nextScheduledRun + this.config.collectionIntervalSeconds * 1000
      : null;

    const avgLatency = this.stats.totalCollections > 0
      ? Math.round(this.stats.totalLatency / this.stats.totalCollections)
      : 0;

    const timingDrift = this.stats.lastCollectionTime
      ? Date.now() - this.stats.lastCollectionTime
      : 0;

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
      avgLatency,
      maxLatency: this.stats.maxLatency,
      timingDriftMs: timingDrift,
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
