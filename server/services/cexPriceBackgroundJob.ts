/**
 * CEX Price Background Job Scheduler
 * Handles periodic price collection with deterministic scheduling
 */

import { Pool } from 'pg';
import { CEXPriceCollector, CollectionResult } from './cexPriceCollector';
import ccxtService from './ccxtService';
import { executeGuardedJob } from '../utils/jobExecutionGuard';

export interface JobConfig {
  collectionIntervalSeconds: number;
  tradingPairs?: string[];
  maxConcurrentExchanges: number;
  onError?: (error: Error) => void;
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

export class CEXPriceBackgroundJob {
  private collector: CEXPriceCollector;
  private config: Required<JobConfig>;
  private jobTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private startTime: number | null = null;
  private nextScheduledRun: number | null = null;
  private inMemoryCache = new Map<string, { value: any; expiresAt: number }>();
  private stats = {
    totalCollections: 0,
    successfulCollections: 0,
    failedCollections: 0,
    totalCollectionTime: 0,
    totalLatency: 0,
    maxLatency: 0,
    lastCollectionTime: 0,
  };
  private static instance: CEXPriceBackgroundJob | null = null;

  private constructor(db: Pool, config: JobConfig) {
    this.collector = new CEXPriceCollector(db);
    this.config = {
      collectionIntervalSeconds: config.collectionIntervalSeconds || 30,
      tradingPairs: config.tradingPairs || [],
      maxConcurrentExchanges: config.maxConcurrentExchanges || 3,
      onError: config.onError || (() => {}),
    };
  }

  static initialize(db: Pool, config: JobConfig): CEXPriceBackgroundJob {
    if (!CEXPriceBackgroundJob.instance) {
      CEXPriceBackgroundJob.instance = new CEXPriceBackgroundJob(db, config);
    }
    return CEXPriceBackgroundJob.instance;
  }

  static getInstance(): CEXPriceBackgroundJob {
    if (!CEXPriceBackgroundJob.instance) {
      throw new Error('CEXPriceBackgroundJob not initialized. Call initialize() first.');
    }
    return CEXPriceBackgroundJob.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = Date.now();
    this.nextScheduledRun = Date.now();

    console.log(`[CEXPriceBackgroundJob] Starting with ${this.config.collectionIntervalSeconds}s interval`);

    // Run first collection under the same guarded execution as scheduled runs
    const execTimeout = Math.max(85000, (this.config.collectionIntervalSeconds - 1) * 1000);
    await executeGuardedJob(
      'cex-price-collection',
      async () => {
        return await Promise.race([
          this.runCollection(),
          new Promise<void>((_, reject) =>
            setTimeout(() => {
              try {
                this.collector.clearAllActiveCollections();
              } catch (e) {
                console.error('[CEXPriceBackgroundJob] onTimeout clear active collections failed', e);
              }
              try {
                if (typeof (ccxtService as any).clearMarketsLoadingLocks === 'function') {
                  (ccxtService as any).clearMarketsLoadingLocks();
                }
              } catch (e) {
                console.error('[CEXPriceBackgroundJob] onTimeout clear CCXT locks failed', e);
              }
              reject(new Error(`Job timeout after ${execTimeout}ms`));
            }, execTimeout)
          ),
        ]);
      },
      { skipIfRunning: true }
    );

    this.scheduleNextCollection();
    this.setupSignalHandlers();
  }

  private scheduleNextCollection(): void {
    if (!this.isRunning) return;
    const now = Date.now();
    const nextRun = (this.nextScheduledRun || now) + this.config.collectionIntervalSeconds * 1000;
    const delayMs = Math.max(0, nextRun - now);

    const maxWaitMs = this.config.collectionIntervalSeconds * 1000 + 5000;
    const actualDelayMs = Math.min(delayMs, maxWaitMs);

    setTimeout(async () => {
      if (!this.isRunning) return;
      this.nextScheduledRun = Date.now();
      const execTimeout = Math.max(85000, (this.config.collectionIntervalSeconds - 1) * 1000);

      await executeGuardedJob(
        'cex-price-collection',
        async () => {
          return await Promise.race([
            this.runCollection(),
            new Promise<void>((_, reject) =>
              setTimeout(() => {
                try {
                  this.collector.clearAllActiveCollections();
                } catch (e) {
                  console.error('[CEXPriceBackgroundJob] onTimeout clear active collections failed', e);
                }
                try {
                  if (typeof (ccxtService as any).clearMarketsLoadingLocks === 'function') {
                    (ccxtService as any).clearMarketsLoadingLocks();
                  }
                } catch (e) {
                  console.error('[CEXPriceBackgroundJob] onTimeout clear CCXT locks failed', e);
                }
                reject(new Error(`Job timeout after ${execTimeout}ms`));
              }, execTimeout)
            ),
          ]);
        },
        { skipIfRunning: true }
      );

      this.scheduleNextCollection();
    }, actualDelayMs);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    if (this.jobTimer) {
      clearInterval(this.jobTimer);
      this.jobTimer = null;
    }
    this.isRunning = false;
    console.log('[CEXPriceBackgroundJob] Job stopped');
    console.log('[CEXPriceBackgroundJob] Final stats:', this.getStats());
  }

  private async runCollection(): Promise<void> {
    const collectionStartTime = Date.now();
    try {
      await this.performCollection();

      const latency = Date.now() - collectionStartTime;
      this.stats.totalLatency += latency;
      this.stats.maxLatency = Math.max(this.stats.maxLatency, latency);
      this.stats.lastCollectionTime = Date.now();

      if (latency > 25000) {
        console.warn(`[CEXPriceBackgroundJob] HIGH LATENCY: ${latency}ms`, {
          collections: this.stats.totalCollections,
          avgLatency: this.stats.totalCollections > 0 ? Math.round(this.stats.totalLatency / this.stats.totalCollections) : 0,
          maxLatency: this.stats.maxLatency,
        });
      }

      if (this.stats.totalCollections > 0 && this.stats.totalCollections % 10 === 0) {
        const avgLatency = Math.round(this.stats.totalLatency / this.stats.totalCollections);
        const timingDrift = latency > this.config.collectionIntervalSeconds * 1000 ? latency - (this.config.collectionIntervalSeconds * 1000) : 0;
        console.log('[CEXPriceBackgroundJob] TIMING METRICS:', {
          cycle: this.stats.totalCollections,
          lastLatency: latency,
          avgLatency,
          maxLatency: this.stats.maxLatency,
          timingDriftMs: timingDrift,
          successRate: this.stats.totalCollections > 0 ? `${Math.round((this.stats.successfulCollections / this.stats.totalCollections) * 100)}%` : '0%'
        });
      }
    } catch (error: any) {
      this.stats.failedCollections++;
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
      console.error('[CEXPriceBackgroundJob] Collection error:', error);
    }
  }

  private async performCollection(): Promise<void> {
    const start = Date.now();
    try {
      const results = await this.collector.fetchAllExchanges(this.config.tradingPairs.length ? this.config.tradingPairs : undefined);
      this.stats.totalCollections += results.length;

      let successes = 0;
      for (const r of results) {
        if (r.success) successes++;
        else this.stats.failedCollections++;
      }
      this.stats.successfulCollections += successes;

      const duration = Date.now() - start;
      this.stats.totalCollectionTime += duration;
      console.log(`[CEXPriceBackgroundJob] Collection finished — exchanges: ${results.length}, success: ${successes}, duration: ${duration}ms`);
    } catch (error) {
      this.stats.failedCollections++;
      throw error;
    }
  }

  private getFromFallbackCache(key: string): string | null {
    const cached = this.inMemoryCache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.inMemoryCache.delete(key);
      return null;
    }
    return cached.value;
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\n[CEXPriceBackgroundJob] Received ${signal}, shutting down gracefully...`);
        await this.stop();
        process.exit(0);
      });
    });
  }

  getStats(): JobStats {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;
    const nextCollectionTime = this.isRunning && this.nextScheduledRun ? this.nextScheduledRun + this.config.collectionIntervalSeconds * 1000 : null;
    const avgLatency = this.stats.totalCollections > 0 ? Math.round(this.stats.totalLatency / this.stats.totalCollections) : 0;
    const timingDrift = this.stats.lastCollectionTime ? Date.now() - this.stats.lastCollectionTime : 0;

    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      totalCollections: this.stats.totalCollections,
      successfulCollections: this.stats.successfulCollections,
      failedCollections: this.stats.failedCollections,
      averageCollectionTime: this.stats.totalCollections > 0 ? this.stats.totalCollectionTime / this.stats.totalCollections : 0,
      lastCollectionTime: this.stats.lastCollectionTime || null,
      nextCollectionTime,
      uptime,
      avgLatency,
      maxLatency: this.stats.maxLatency,
      timingDriftMs: timingDrift,
    };
  }

  getCollector(): CEXPriceCollector {
    return this.collector;
  }

  destroy(): void {
    if (this.jobTimer) {
      clearInterval(this.jobTimer);
      this.jobTimer = null;
    }
    this.collector.destroy();
    this.isRunning = false;
  }
}

export async function startPriceCollectionJob(db: Pool, config: JobConfig): Promise<CEXPriceBackgroundJob> {
  const job = CEXPriceBackgroundJob.initialize(db, config);
  await job.start();
  return job;
}
