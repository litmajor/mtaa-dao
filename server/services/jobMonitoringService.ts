/**
 * Job Monitoring Service
 * Tracks execution of scheduled jobs, logs metrics, and alerts on failures
 * Last Updated: January 23, 2026
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

/**
 * Monitors and tracks scheduled job execution
 */
export class JobMonitoringService {
  private static executionHistory: Map<string, JobExecutionMetrics[]> = new Map();
  private static maxHistorySize = 100; // Keep last 100 executions per job

  /**
   * Start tracking a job execution
   */
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

  /**
   * Mark job as completed
   */
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
  }

  /**
   * Get execution history for a job
   */
  static getJobHistory(jobName: string): JobExecutionMetrics[] {
    return this.executionHistory.get(jobName) || [];
  }

  /**
   * Get statistics for a job
   */
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

  /**
   * Get all job statistics
   */
  static getAllJobStats() {
    const stats: any[] = [];
    for (const jobName of this.executionHistory.keys()) {
      stats.push(this.getJobStats(jobName));
    }
    return stats;
  }

  /**
   * Reset history for a job
   */
  static resetJobHistory(jobName: string) {
    this.executionHistory.delete(jobName);
    logger.info(`🔄 Job history cleared: ${jobName}`);
  }

  /**
   * Reset all history
   */
  static resetAllHistory() {
    this.executionHistory.clear();
    logger.info('🔄 All job histories cleared');
  }

  /**
   * Prune old executions to keep history manageable
   */
  private static pruneHistory(jobName: string) {
    const history = this.executionHistory.get(jobName);
    if (history && history.length > this.maxHistorySize) {
      const removed = history.splice(0, history.length - this.maxHistorySize);
      logger.debug(`Pruned ${removed.length} old executions for ${jobName}`);
    }
  }

  /**
   * Get overall system health based on job execution
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
    const overallSuccessRate = (totalSuccessful / totalExecutions) * 100;

    let status = 'healthy';
    if (overallSuccessRate < 90) {
      status = 'degraded';
    }
    if (overallSuccessRate < 50) {
      status = 'critical';
    }

    return {
      status,
      message: `${overallSuccessRate.toFixed(1)}% success rate across ${allStats.length} jobs`,
      jobsMonitored: allStats.length,
      overallSuccessRate: overallSuccessRate.toFixed(1),
      totalExecutions,
      totalSuccessful,
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
