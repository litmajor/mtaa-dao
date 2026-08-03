/**
 * SYSTEM HEALTH MONITOR
 *
 * Real-time monitoring of:
 * - Heap memory usage
 * - CPU usage
 * - Event loop lag
 * - Job queue depth
 * - System saturation signals
 */

import os from 'node:os';
import { logger } from './logger';
import { JobExecutionRegistry } from './jobExecutionGuard';
import { getHeapUsageSummary } from './memoryUsage';

interface SystemHealthMetrics {
  timestamp: number;
  heap: {
    usedMB: number;
    totalMB: number;
    maxMB: number;
    usagePercent: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  eventLoop: {
    lagMs: number;
    isStalled: boolean;
  };
  jobs: {
    totalJobs: number;
    runningJobs: number;
    skippedRecently: number;
  };
}

/**
 * System Health Monitor - tracks system saturation in real-time
 */
export class SystemHealthMonitor {
  private static lastCpuCheck = process.cpuUsage();
  private static lastCheckTime = Date.now();
  private static metricsHistory: SystemHealthMetrics[] = [];
  private static readonly MAX_HISTORY = 60; // Keep 60 data points
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static eventLoopLagMs = 0;
  private static eventLoopStalled = false;
  private static consecutiveSaturatedSamples = 0;
  private static readonly EVENT_LOOP_LAG_THRESHOLD_MS = 50;
  private static readonly SATURATION_HYSTERESIS_SAMPLES = 2;

  /**
   * Start continuous monitoring
   */
  static startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    logger.info(`[MONITOR] Starting system health monitoring every ${intervalMs}ms`);

    this.monitoringInterval = setInterval(() => {
      try {
        const metrics = this.captureMetrics();
        this.metricsHistory.push(metrics);

        // Keep only recent history
        if (this.metricsHistory.length > this.MAX_HISTORY) {
          this.metricsHistory.shift();
        }

        this.analyzeAndLogMetrics(metrics);
      } catch (error) {
        logger.warn('[MONITOR] Error capturing metrics', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('[MONITOR] Stopped system health monitoring');
    }
  }

  /**
   * Capture current system metrics
   */
  static captureMetrics(useIntervalBaseline: boolean = true): SystemHealthMetrics {
    const now = Date.now();

    // Heap metrics
    const heapStats = process.memoryUsage();
    const heapSummary = getHeapUsageSummary(heapStats);
    const heapUsedMB = heapSummary.usedMB;
    const heapTotalMB = heapSummary.allocatedMB;
    const heapMaxMB = heapSummary.limitMB;
    const heapUsagePercent = heapSummary.usagePercent;

    // CPU metrics
    const cpuNow = process.cpuUsage(this.lastCpuCheck);
    const timeDiff = Math.max(1, now - this.lastCheckTime);
    const cpuTimeMs = (cpuNow.user + cpuNow.system) / 1000;
    const cores = Math.max(1, os.cpus().length);
    const normalizedCpuPercent = Math.min(100, Math.round((cpuTimeMs / Math.max(1, timeDiff)) * 100 / cores));
    const userCpuPercent = Math.min(100, Math.round((cpuNow.user / 1000 / Math.max(1, timeDiff)) * 100 / cores));
    const systemCpuPercent = Math.min(100, Math.round((cpuNow.system / 1000 / Math.max(1, timeDiff)) * 100 / cores));

    this.lastCpuCheck = process.cpuUsage();
    this.lastCheckTime = now;

    // Event loop lag detection
    const eventLoopCheckStart = Date.now();
    setImmediate(() => {
      const lag = Date.now() - eventLoopCheckStart;
      this.eventLoopLagMs = Math.max(0, lag);
      this.eventLoopStalled = lag > this.EVENT_LOOP_LAG_THRESHOLD_MS;
    });
    const eventLoopLagMs = this.eventLoopLagMs;
    const eventLoopStalled = this.eventLoopStalled;

    // Job queue depth
    let jobStats: Record<string, { isRunning?: boolean; name?: string }> = {};
    let skippedRecently = 0;
    let runningJobs = 0;
    let totalJobs = 0;

    try {
      jobStats = JobExecutionRegistry.getAllStats();
      runningJobs = Object.values(jobStats).filter((j) => j.isRunning).length;
      totalJobs = Object.keys(jobStats).length;

      const fiveMinutesAgo = now - 5 * 60 * 1000;
      skippedRecently = Object.values(jobStats).reduce((sum, job) => {
        const recentMetrics = JobExecutionRegistry.getMetrics(job.name ?? '').filter((m) => m.timestamp > fiveMinutesAgo);
        return sum + recentMetrics.filter((m) => m.skipped).length;
      }, 0);
    } catch (error) {
      logger.warn('[MONITOR] Failed to collect job registry metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      timestamp: now,
      heap: {
        usedMB: heapUsedMB,
        totalMB: heapTotalMB,
        maxMB: heapMaxMB,
        usagePercent: heapUsagePercent,
      },
      cpu: {
        user: userCpuPercent,
        system: systemCpuPercent,
      },
      eventLoop: {
        lagMs: eventLoopLagMs,
        isStalled: eventLoopStalled,
      },
      jobs: {
        totalJobs,
        runningJobs,
        skippedRecently,
      },
    };
  }

  /**
   * Analyze metrics and log warnings/alerts
   */
  private static analyzeAndLogMetrics(metrics: SystemHealthMetrics): void {
    const alerts: string[] = [];

    // Heap pressure
    if (metrics.heap.usagePercent > 85) {
      alerts.push(`🔴 CRITICAL HEAP: ${metrics.heap.usedMB}MB/${metrics.heap.maxMB}MB (${metrics.heap.usagePercent}%)`);
    } else if (metrics.heap.usagePercent > 70) {
      alerts.push(`🟡 HIGH HEAP: ${metrics.heap.usedMB}MB/${metrics.heap.totalMB}MB (${metrics.heap.usagePercent}%)`);
    }

    // CPU pressure
    const totalCpu = metrics.cpu.user + metrics.cpu.system;
    if (totalCpu > 80) {
      alerts.push(`🔴 CPU SPIKE: ${totalCpu}% (user: ${metrics.cpu.user}%, system: ${metrics.cpu.system}%)`);
    }

    // Event loop stalling
    if (metrics.eventLoop.isStalled) {
      alerts.push(`🟡 EVENT LOOP LAG: ${metrics.eventLoop.lagMs}ms detected`);
    }

    // Job saturation
    if (metrics.jobs.runningJobs > 5) {
      alerts.push(`🟡 JOB SATURATION: ${metrics.jobs.runningJobs}/${metrics.jobs.totalJobs} jobs running`);
    }

    if (metrics.jobs.skippedRecently > 10) {
      alerts.push(`🟡 SKIPPED JOBS: ${metrics.jobs.skippedRecently} jobs skipped in last 5 min`);
    }

    if (alerts.length === 0) {
      // Normal operation
      logger.debug('[MONITOR] System healthy', {
        heap: `${metrics.heap.usagePercent}%`,
        cpu: `${totalCpu}%`,
        jobs: `${metrics.jobs.runningJobs}/${metrics.jobs.totalJobs}`,
      });
    } else {
      // Alert mode
      alerts.forEach((alert) => logger.warn(`[MONITOR] ${alert}`));

      // Provide diagnosis
      const diagnosis = JobExecutionRegistry.getDiagnostics();
      if (diagnosis.slowJobs.length > 0) {
        logger.warn('[MONITOR] SLOW JOBS', { slowJobs: diagnosis.slowJobs });
      }
      if (diagnosis.frequentSkips.length > 0) {
        logger.warn('[MONITOR] FREQUENT SKIPS (overload signal)', { frequentSkips: diagnosis.frequentSkips });
      }
    }
  }

  /**
   * Get current metrics
   */
  static getMetrics(): SystemHealthMetrics {
    return this.captureMetrics(true);
  }

  /**
   * Get metrics history
   */
  static getHistory(): SystemHealthMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get health score 0-100 (100 = healthy)
   */
  static getHealthScore(): number {
    if (this.metricsHistory.length === 0) {
      return 100; // Unknown = assume healthy
    }

    const recent = this.metricsHistory.slice(-5); // Last 5 samples
    const weights = [0.1, 0.15, 0.2, 0.25, 0.3];
    let weightedPenalty = 0;

    recent.forEach((m, index) => {
      const weight = weights[index] ?? 0.3;
      let penalty = 0;

      if (m.heap.usagePercent > 85) penalty += 30;
      else if (m.heap.usagePercent > 70) penalty += 15;

      const cpu = m.cpu.user + m.cpu.system;
      if (cpu > 80) penalty += 25;
      else if (cpu > 60) penalty += 10;

      if (m.eventLoop.lagMs > 100) penalty += 15;
      if (m.jobs.runningJobs > 5) penalty += 10;

      weightedPenalty += penalty * weight;
    });

    return Math.max(0, Math.round(100 - weightedPenalty));
  }

  /**
   * Check if system is saturated (needs throttling)
   */
  static isSaturated(): boolean {
    const metrics = this.captureMetrics(true);
    const isNowSaturated =
      metrics.heap.usagePercent > 75 ||
      metrics.cpu.user + metrics.cpu.system > 70 ||
      metrics.eventLoop.isStalled ||
      metrics.jobs.runningJobs > 3 ||
      metrics.jobs.skippedRecently > 5;

    if (isNowSaturated) {
      this.consecutiveSaturatedSamples += 1;
    } else {
      this.consecutiveSaturatedSamples = 0;
    }

    return this.consecutiveSaturatedSamples >= this.SATURATION_HYSTERESIS_SAMPLES;
  }
}

/**
 * Initialize system monitoring on startup
 */
export function initializeSystemMonitoring(): void {
  SystemHealthMonitor.startMonitoring(30000); // Check every 30 seconds
}

export default SystemHealthMonitor;
