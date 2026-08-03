
/**
 * Version 1 update on 23 Jan 2026
 * Version 1.1 update on 5 July 2026
 * Imagine ill have to trade off 6 months worth of job data as a security tradeoff for the unclaimed ownership check!! belongs in my adr record
 * Job Monitoring Service
 * Tracks execution of scheduled jobs, logs metrics, and alerts on failures
 *
 * FIXES APPLIED:
 * 1. Added a pluggable alert handler (setAlertHandler / clearAlertHandler)
 *    that failJob actually invokes. Previously "alerts on failures" only
 *    meant a logger.error() call — no real notification path existed.
 *    This is intentionally decoupled (a plain callback) rather than a hard
 *    import of WebSocketEventService, to avoid a circular dependency; wire
 *    it up once at startup, e.g.:
 *      JobMonitoringService.setAlertHandler((metrics) => {
 *        webSocketEventService.notifyAlert({
 *          entityType: 'scheduled-job',
 *          entityId: metrics.jobName,
 *          alertType: 'job-failure',
 *          message: `Job ${metrics.jobName} failed: ${metrics.error}`,
 *          severity: 'high',
 *        });
 *      });
 * 2. getJobHistory() now returns a shallow copy, not the live internal
 *    array — callers mutating the returned array could previously corrupt
 *    this service's internal state.
 * 3. getSystemHealth() guards against totalExecutions === 0 producing NaN
 *    (e.g. if every job's history happens to be empty at read time due to
 *    a concurrent reset).
 * 4. Added getStaleRunningJobs() to surface jobs whose status has been
 *    'running' for longer than a threshold — useful for catching jobs
 *    that crashed hard enough to skip the try/catch (e.g. SIGKILL) and
 *    never got marked completed/failed.
 */

import { logger } from '../utils/logger';

export interface JobExecutionMetrics {
  jobName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  recordsProcessed?: number;
}

export type JobAlertHandler = (metrics: JobExecutionMetrics) => void | Promise<void>;

/**
 * Monitors and tracks scheduled job execution
 */
export class JobMonitoringService {
  private static executionHistory: Map<string, JobExecutionMetrics[]> = new Map();
  private static maxHistorySize = 100;
  private static alertHandler: JobAlertHandler | null = null; // FIX #1

  /**
   * Register a callback invoked whenever a job fails. See file header for
   * a wiring example against the existing alert infrastructure.
   */
  static setAlertHandler(handler: JobAlertHandler): void {
    this.alertHandler = handler;
  }

  static clearAlertHandler(): void {
    this.alertHandler = null;
  }

  static startJobTracking(jobName: string): JobExecutionMetrics {
    const metrics: JobExecutionMetrics = {
      jobName,
      startTime: new Date(),
      status: 'running',
    };

    if (!this.executionHistory.has(jobName)) {
      this.executionHistory.set(jobName, []);
    }

    this.executionHistory.get(jobName)!.push(metrics);

    logger.info(`📊 Job started: ${jobName}`, {
      startTime: metrics.startTime.toISOString(),
    });

    return metrics;
  }

  static completeJob(metrics: JobExecutionMetrics, recordsProcessed?: number) {
    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    metrics.status = 'completed';
    if (recordsProcessed !== undefined) {
      metrics.recordsProcessed = recordsProcessed;
    }

    logger.info(`✅ Job completed: ${metrics.jobName}`, {
      duration: `${metrics.duration}ms`,
      recordsProcessed: metrics.recordsProcessed || 'N/A',
    });

    this.pruneHistory(metrics.jobName);
  }

  /**
   * Mark job as failed
   *
   * FIX #1: now actually notifies the registered alert handler, not just logs.
   */
  static failJob(metrics: JobExecutionMetrics, error: Error | string) {
    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    metrics.status = 'failed';
    metrics.error = error instanceof Error ? error.message : String(error);

    logger.error(`❌ Job failed: ${metrics.jobName}`, {
      duration: `${metrics.duration}ms`,
      error: metrics.error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    this.pruneHistory(metrics.jobName);

    if (this.alertHandler) {
      try {
        const maybePromise = this.alertHandler(metrics);
        if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
          (maybePromise as Promise<void>).catch((err) => {
            logger.error('[JobMonitoring] Alert handler rejected:', err);
          });
        }
      } catch (err) {
        // An alert handler failing must never take down the job pipeline itself
        logger.error('[JobMonitoring] Alert handler threw synchronously:', err);
      }
    }
  }

  /**
   * FIX #2: return a copy so callers can't mutate internal state.
   */
  static getJobHistory(jobName: string): JobExecutionMetrics[] {
    return [...(this.executionHistory.get(jobName) || [])];
  }

  static getJobStats(jobName: string) {
    const history = this.getJobHistory(jobName);

    if (history.length === 0) {
      return {
        jobName,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        lastExecution: null,
      };
    }

    const successful = history.filter(h => h.status === 'completed').length;
    const failed = history.filter(h => h.status === 'failed').length;
    const avgDuration = history.reduce((sum, h) => sum + (h.duration || 0), 0) / history.length;
    const lastExecution = history[history.length - 1];

    return {
      jobName,
      totalExecutions: history.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      successRate: (successful / history.length) * 100,
      averageDuration: Math.round(avgDuration),
      lastExecution: {
        status: lastExecution.status,
        duration: lastExecution.duration,
        error: lastExecution.error,
        timestamp: lastExecution.startTime,
      },
    };
  }

  static getAllJobStats() {
    const stats: any[] = [];
    for (const jobName of this.executionHistory.keys()) {
      stats.push(this.getJobStats(jobName));
    }
    return stats;
  }

  static resetJobHistory(jobName: string) {
    this.executionHistory.delete(jobName);
    logger.info(`🔄 Job history cleared: ${jobName}`);
  }

  static resetAllHistory() {
    this.executionHistory.clear();
    logger.info('🔄 All job histories cleared');
  }

  private static pruneHistory(jobName: string) {
    const history = this.executionHistory.get(jobName);
    if (history && history.length > this.maxHistorySize) {
      const removed = history.splice(0, history.length - this.maxHistorySize);
      logger.debug(`Pruned ${removed.length} old executions for ${jobName}`);
    }
  }

  /**
   * FIX #4: surface jobs stuck in 'running' longer than expected — a sign
   * the process crashed hard enough to skip completeJob/failJob entirely.
   */
  static getStaleRunningJobs(thresholdMs: number = 30 * 60 * 1000): JobExecutionMetrics[] {
    const now = Date.now();
    const stale: JobExecutionMetrics[] = [];
    for (const history of this.executionHistory.values()) {
      for (const entry of history) {
        if (entry.status === 'running' && now - entry.startTime.getTime() > thresholdMs) {
          stale.push(entry);
        }
      }
    }
    return stale;
  }

  /**
   * Get overall system health based on job execution
   *
   * FIX #3: guard against 0/0 producing NaN.
   *
   * CAVEAT: this reads from an in-process static Map. If scheduled jobs run
   * across multiple Node processes/replicas, this only reflects whichever
   * process handles the request — not global truth. A shared store (Redis,
   * similar to jobQueueService) would be needed for a multi-process-accurate
   * view; not implemented here since it depends on your deployment topology.
   */
  static getSystemHealth() {
    const allStats = this.getAllJobStats();

    if (allStats.length === 0) {
      return {
        status: 'healthy',
        message: 'No jobs have run yet',
        jobsMonitored: 0,
        overallSuccessRate: 0,
      };
    }

    const totalExecutions = allStats.reduce((sum, s) => sum + s.totalExecutions, 0);
    const totalSuccessful = allStats.reduce((sum, s) => sum + s.successfulExecutions, 0);

    // FIX #3: avoid NaN when every tracked job currently has zero executions
    const overallSuccessRate = totalExecutions > 0 ? (totalSuccessful / totalExecutions) * 100 : 100;

    let status = 'healthy';
    if (overallSuccessRate < 90) status = 'degraded';
    if (overallSuccessRate < 50) status = 'critical';

    const staleJobs = this.getStaleRunningJobs();
    if (staleJobs.length > 0 && status === 'healthy') {
      status = 'degraded';
    }

    return {
      status,
      message: `${overallSuccessRate.toFixed(1)}% success rate across ${allStats.length} jobs`,
      jobsMonitored: allStats.length,
      overallSuccessRate: overallSuccessRate.toFixed(1),
      totalExecutions,
      totalSuccessful,
      staleRunningJobs: staleJobs.length,
      jobDetails: allStats,
    };
  }
}

/**
 * Wrapper function for safe job execution with monitoring
 */
export async function executeMonitoredJob(
  jobName: string,
  jobFn: () => Promise<number | void>
): Promise<void> {
  const metrics = JobMonitoringService.startJobTracking(jobName);

  try {
    const result = await jobFn();
    const recordsProcessed = typeof result === 'number' ? result : undefined;
    JobMonitoringService.completeJob(metrics, recordsProcessed);
  } catch (error) {
    JobMonitoringService.failJob(metrics, error as Error | string);
    // Don't rethrow - allow other jobs to continue
  }
}