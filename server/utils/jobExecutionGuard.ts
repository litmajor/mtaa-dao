/**
 * JOB EXECUTION GUARD
 * 
 * Prevents overlapping job execution - critical for high-frequency systems
 * 
 * Problem: Without guards, intervals fire overlapping runs if previous run takes too long
 * Impact: Event loop saturation → Redis/DB failures
 * 
 * Solution: Track execution state, skip if already running, wait for completion before next
 */

import { logger } from './logger';

interface JobStats {
  name: string;
  isRunning: boolean;
  lastDuration: number;
  lastStartTime: number | null;
  lastEndTime: number | null;
  executionCount: number;
  skipCount: number;
  errorCount: number;
  avgDuration: number;
  maxDuration: number;
}

interface ExecutionMetrics {
  duration: number;
  timestamp: number;
  skipped: boolean;
  error?: string;
}

/**
 * Global job registry - tracks all job execution states
 */
export class JobExecutionRegistry {
  private static jobs = new Map<string, JobStats>();
  private static metrics = new Map<string, ExecutionMetrics[]>();
  private static readonly MAX_METRICS_HISTORY = 100; // Keep last 100 executions

  /**
   * Register a job (must be called before scheduling)
   */
  static registerJob(name: string): void {
    if (!this.jobs.has(name)) {
      this.jobs.set(name, {
        name,
        isRunning: false,
        lastDuration: 0,
        lastStartTime: null,
        lastEndTime: null,
        executionCount: 0,
        skipCount: 0,
        errorCount: 0,
        avgDuration: 0,
        maxDuration: 0,
      });
      this.metrics.set(name, []);
      logger.info(`[JOBS] Registered job: ${name}`);
    }
  }

  /**
   * Check if a job is currently running
   */
  static isRunning(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      this.registerJob(name);
      return false;
    }
    return job.isRunning;
  }

  /**
   * Mark job as starting
   */
  static markStart(name: string): void {
    const job = this.jobs.get(name);
    if (job) {
      job.isRunning = true;
      job.lastStartTime = Date.now();
    }
  }

  /**
   * Mark job as completed
   */
  static markEnd(name: string, error?: Error): void {
    const job = this.jobs.get(name);
    if (!job) return;

    const now = Date.now();
    const duration = job.lastStartTime ? now - job.lastStartTime : 0;

    job.isRunning = false;
    job.lastEndTime = now;
    job.lastDuration = duration;
    job.executionCount++;

    if (error) {
      job.errorCount++;
    }

    // Update average
    job.avgDuration = (job.avgDuration * (job.executionCount - 1) + duration) / job.executionCount;
    job.maxDuration = Math.max(job.maxDuration, duration);

    // Record metrics
    const jobMetrics = this.metrics.get(name) || [];
    jobMetrics.push({
      duration,
      timestamp: now,
      skipped: false,
      error: error?.message,
    });

    // Keep only recent history
    if (jobMetrics.length > this.MAX_METRICS_HISTORY) {
      jobMetrics.shift();
    }
    this.metrics.set(name, jobMetrics);
  }

  /**
   * Mark job as skipped
   */
  static markSkipped(name: string): void {
    const job = this.jobs.get(name);
    if (job) {
      job.skipCount++;

      const jobMetrics = this.metrics.get(name) || [];
      jobMetrics.push({
        duration: 0,
        timestamp: Date.now(),
        skipped: true,
      });

      if (jobMetrics.length > this.MAX_METRICS_HISTORY) {
        jobMetrics.shift();
      }
      this.metrics.set(name, jobMetrics);
    }
  }

  /**
   * Get job statistics
   */
  static getStats(name: string): JobStats | null {
    return this.jobs.get(name) || null;
  }

  /**
   * Get metrics history for a job
   */
  static getMetrics(name: string): ExecutionMetrics[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get all job stats
   */
  static getAllStats(): Record<string, JobStats> {
    const result: Record<string, JobStats> = {};
    this.jobs.forEach((stats, name) => {
      result[name] = stats;
    });
    return result;
  }

  /**
   * Check for problematic patterns
   */
  static getDiagnostics(): {
    saturated: string[];
    slowJobs: string[];
    frequentSkips: string[];
    highErrorRate: string[];
  } {
    const now = Date.now();
    const saturated: string[] = [];
    const slowJobs: string[] = [];
    const frequentSkips: string[] = [];
    const highErrorRate: string[] = [];

    this.jobs.forEach((job) => {
      // Jobs that are running for too long (likely still executing)
      if (job.isRunning && job.lastStartTime && now - job.lastStartTime > 30000) {
        saturated.push(`${job.name} (stuck for ${now - job.lastStartTime}ms)`);
      }

      // Jobs with high average duration
      if (job.avgDuration > 5000) {
        slowJobs.push(`${job.name} (avg: ${job.avgDuration}ms, max: ${job.maxDuration}ms)`);
      }

      // Jobs being skipped frequently (indicates overload)
      if (job.skipCount > job.executionCount * 0.1) {
        frequentSkips.push(`${job.name} (${job.skipCount}/${job.executionCount} skipped)`);
      }

      // Jobs with high error rate
      if (job.errorCount > job.executionCount * 0.05) {
        highErrorRate.push(`${job.name} (${job.errorCount}/${job.executionCount} errors)`);
      }
    });

    return { saturated, slowJobs, frequentSkips, highErrorRate };
  }
}

/**
 * Execute a job with automatic guard and metrics collection
 *
 * Usage:
 * ```ts
 * const result = await executeGuardedJob('myJob', async () => {
 *   // your job logic here
 * });
 *
 * if (!result.executed) {
 *   console.log('Job skipped - previous run still executing');
 * }
 * ```
 */
export async function executeGuardedJob<T>(
  jobName: string,
  executeFn: () => Promise<T>,
  options?: {
    skipIfRunning?: boolean; // default: true
    logDuration?: boolean; // default: true
    timeout?: number; // max ms to allow, default: no timeout
  }
): Promise<{ executed: boolean; result?: T; error?: Error; duration: number }> {
  const skipIfRunning = options?.skipIfRunning ?? true;
  const logDuration = options?.logDuration ?? true;
  const timeout = options?.timeout;

  // Register job first time
  if (!JobExecutionRegistry.getStats(jobName)) {
    JobExecutionRegistry.registerJob(jobName);
  }

  // Check if already running
  if (JobExecutionRegistry.isRunning(jobName)) {
    if (skipIfRunning) {
      JobExecutionRegistry.markSkipped(jobName);
      return {
        executed: false,
        duration: 0,
      };
    }
    // Otherwise, wait for it to finish (risky - can create queue)
  }

  JobExecutionRegistry.markStart(jobName);

  try {
    let result: T;

    if (timeout) {
      // Execute with timeout
      result = await Promise.race([
        executeFn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`Job timeout after ${timeout}ms`)), timeout)
        ),
      ]);
    } else {
      result = await executeFn();
    }

    const stats = JobExecutionRegistry.getStats(jobName)!;
    const duration = stats.lastDuration;

    if (logDuration) {
      logger.debug(`[JOBS] ${jobName} completed`, {
        duration,
        avg: stats.avgDuration,
        max: stats.maxDuration,
      });
    }

    JobExecutionRegistry.markEnd(jobName);

    return {
      executed: true,
      result,
      duration,
    };
  } catch (error) {
    JobExecutionRegistry.markEnd(jobName, error instanceof Error ? error : new Error(String(error)));

    return {
      executed: true,
      error: error instanceof Error ? error : new Error(String(error)),
      duration: JobExecutionRegistry.getStats(jobName)?.lastDuration || 0,
    };
  }
}

export default JobExecutionRegistry;
