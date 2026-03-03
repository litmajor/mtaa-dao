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

import { logger } from './logger';
import { JobExecutionRegistry } from './jobExecutionGuard';

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
  private static eventLoopLagDetected = false;
  private static metricsHistory: SystemHealthMetrics[] = [];
  private static readonly MAX_HISTORY = 60; // Keep 60 data points
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static lastEventLoopCheck = Date.now();

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
        logger.warn('[MONITOR] Error capturing metrics:', error instanceof Error ? error.message : String(error));
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
  static captureMetrics(): SystemHealthMetrics {
    const now = Date.now();

    // Heap metrics
    const heapStats = process.memoryUsage();
    const heapUsedMB = Math.round(heapStats.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(heapStats.heapTotal / 1024 / 1024);
    const heapMaxMB = Math.round(heapStats.external / 1024 / 1024 + heapStats.arrayBuffers / 1024 / 1024);
    const heapUsagePercent = Math.round((heapStats.heapUsed / heapStats.heapTotal) * 100);

    // CPU metrics
    const cpuNow = process.cpuUsage(this.lastCpuCheck);
    this.lastCpuCheck = process.cpuUsage();
    const timeDiff = now - this.lastCheckTime;
    this.lastCheckTime = now;

    const userCpuPercent = Math.round((cpuNow.user / (timeDiff * 1000)) * 100);
    const systemCpuPercent = Math.round((cpuNow.system / (timeDiff * 1000)) * 100);

    // Event loop lag detection
    const eventLoopCheckStart = Date.now();
    setImmediate(() => {
      const lag = Date.now() - eventLoopCheckStart;
      if (lag > 50) {
        this.eventLoopLagDetected = true;
      }
    });

    // Job queue depth
    const jobStats = JobExecutionRegistry.getAllStats();
    const runningJobs = Object.values(jobStats).filter((j) => j.isRunning).length;
    const totalJobs = Object.keys(jobStats).length;

    // Count recently skipped jobs (last 5 minutes)
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const skippedRecently = Object.values(jobStats).reduce((sum, job) => {
      const recentMetrics = JobExecutionRegistry.getMetrics(job.name).filter((m) => m.timestamp > fiveMinutesAgo);
      return sum + recentMetrics.filter((m) => m.skipped).length;
    }, 0);

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
        lagMs: eventLoopCheckStart ? Date.now() - eventLoopCheckStart : 0,
        isStalled: this.eventLoopLagDetected,
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
      alerts.push(`🔴 CRITICAL HEAP: ${metrics.heap.usedMB}MB/${metrics.heap.totalMB}MB (${metrics.heap.usagePercent}%)`);
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
        logger.warn('[MONITOR] SLOW JOBS:', diagnosis.slowJobs);
      }
      if (diagnosis.frequentSkips.length > 0) {
        logger.warn('[MONITOR] FREQUENT SKIPS (overload signal):', diagnosis.frequentSkips);
      }
    }
  }

  /**
   * Get current metrics
   */
  static getMetrics(): SystemHealthMetrics {
    return this.captureMetrics();
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
    let score = 100;

    recent.forEach((m) => {
      // Heap pressure reduces score
      if (m.heap.usagePercent > 85) score -= 30;
      else if (m.heap.usagePercent > 70) score -= 15;

      // CPU pressure
      const cpu = m.cpu.user + m.cpu.system;
      if (cpu > 80) score -= 25;
      else if (cpu > 60) score -= 10;

      // Event loop lag
      if (m.eventLoop.lagMs > 100) score -= 15;

      // Job saturation
      if (m.jobs.runningJobs > 5) score -= 10;
    });

    return Math.max(0, score);
  }

  /**
   * Check if system is saturated (needs throttling)
   */
  static isSaturated(): boolean {
    const metrics = this.captureMetrics();
    return (
      metrics.heap.usagePercent > 75 || // High heap
      metrics.cpu.user + metrics.cpu.system > 70 || // High CPU
      metrics.jobs.runningJobs > 3 || // Multiple jobs running
      metrics.jobs.skippedRecently > 5 // Jobs being skipped
    );
  }
}

/**
 * Initialize system monitoring on startup
 */
export function initializeSystemMonitoring(): void {
  SystemHealthMonitor.startMonitoring(30000); // Check every 30 seconds
}

export default SystemHealthMonitor;
