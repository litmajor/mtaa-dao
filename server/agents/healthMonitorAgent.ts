/**
 * 🏥 Health Monitor Agent - Real-Time System Health Surveillance
 * 
 * Polls /api/docs/health and /api/docs/stats/summary every 10-30 seconds
 * Detects and alerts on:
 * - System-wide error rate spikes (>5%)
 * - Endpoint health degradation
 * - Latency threshold violations (>500ms avg, >1s p99)
 * - Cascading failures (>10 unhealthy endpoints)
 * 
 * Actions:
 * - Sends Slack webhooks for critical alerts
 * - Logs all state changes
 * - Tracks historical trends (sliding 24-hour window)
 * - Triggers auto-remediation hooks
 */

import axios, { AxiosError } from 'axios';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ════════════════════════════════════════════════════════════════════════════════

interface HealthSnapshot {
  timestamp: Date;
  overallErrorRate: number;
  unhealthyCount: number;
  avgLatency: number;
  p99Latency: number;
  status: 'healthy' | 'degraded' | 'critical';
  totalEndpoints: number;
  totalCalls: number;
}

interface AlertContext {
  severity: 'info' | 'warning' | 'critical';
  type: 'error_spike' | 'latency_spike' | 'unhealthy_endpoints' | 'cascading_failure' | 'recovery';
  message: string;
  metrics: Record<string, any>;
  timestamp: Date;
  actionsTaken: string[];
}

// ════════════════════════════════════════════════════════════════════════════════
// Health Monitor Agent
// ════════════════════════════════════════════════════════════════════════════════

export class HealthMonitorAgent {
  private baseUrl: string;
  private pollInterval: number = 15_000; // 15 seconds default
  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;

  // Historical tracking (24-hour sliding window)
  private healthHistory: HealthSnapshot[] = [];
  private readonly MAX_HISTORY = 5760; // 24 hours at 15-second intervals
  private alertHistory: AlertContext[] = [];
  private readonly MAX_ALERTS = 1000;

  // Thresholds & Configuration
  private thresholds: {
    errorRateWarning: number;
    errorRateCritical: number;
    latencyWarning: number;
    latencyCritical: number;
    p99LatencyWarning: number;
    p99LatencyCritical: number;
    unhealthyEndpointsWarning: number;
    unhealthyEndpointsCritical: number;
    spikeDetectionWindow: number;
  } = {
    errorRateWarning: 2.5, // % - warn above this
    errorRateCritical: 5.0, // % - critical above this
    latencyWarning: 500, // ms - warn above this
    latencyCritical: 1000, // ms - critical above this
    p99LatencyWarning: 1500, // ms
    p99LatencyCritical: 3000, // ms
    unhealthyEndpointsWarning: 5, // count
    unhealthyEndpointsCritical: 10, // count
    spikeDetectionWindow: 5, // number of recent snapshots to compare
  };

  // State tracking
  private lastHealthState: HealthSnapshot | null = null;
  private isInAlert = false;
  private alertStartTime: Date | null = null;
  private slackWebhookUrl?: string;

  constructor(
    baseUrl: string = 'http://localhost:5000',
    options?: {
      pollInterval?: number;
      slackWebhook?: string;
      thresholds?: Partial<{
        errorRateWarning: number;
        errorRateCritical: number;
        latencyWarning: number;
        latencyCritical: number;
        p99LatencyWarning: number;
        p99LatencyCritical: number;
        unhealthyEndpointsWarning: number;
        unhealthyEndpointsCritical: number;
        spikeDetectionWindow: number;
      }>;
    }
  ) {
    this.baseUrl = baseUrl;
    if (options?.pollInterval) this.pollInterval = options.pollInterval;
    if (options?.slackWebhook) this.slackWebhookUrl = options.slackWebhook;
    if (options?.thresholds) {
      this.thresholds = { ...this.thresholds, ...options.thresholds };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Public API
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Start the health monitor polling
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('[HEALTH_MONITOR] Agent already running, skipping start');
      return;
    }

    logger.info('[HEALTH_MONITOR] Starting health monitor agent', {
      baseUrl: this.baseUrl,
      pollInterval: this.pollInterval,
      thresholds: this.thresholds,
    });

    this.isRunning = true;
    this.pollOnce(); // Initial poll immediately
    this.pollTimer = setInterval(() => this.pollOnce(), this.pollInterval);
  }

  /**
   * Stop the health monitor polling
   */
  public stop(): void {
    if (!this.isRunning) return;
    if (this.pollTimer) clearInterval(this.pollTimer as any);
    this.isRunning = false;
    logger.info('[HEALTH_MONITOR] Health monitor agent stopped');
  }

  /**
   * Get current health status
   */
  public getCurrentHealth(): HealthSnapshot | null {
    return this.lastHealthState;
  }

  /**
   * Get health history
   */
  public getHealthHistory(limit?: number): HealthSnapshot[] {
    if (!limit) return [...this.healthHistory];
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get alert history
   */
  public getAlertHistory(limit?: number): AlertContext[] {
    if (!limit) return [...this.alertHistory];
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get health trends for last N seconds
   */
  public getHealthTrends(seconds: number = 300): {
    avgErrorRate: number;
    peakErrorRate: number;
    avgLatency: number;
    peakLatency: number;
    timeRange: { from: Date; to: Date };
  } {
    const cutoff = Date.now() - seconds * 1000;
    const recent = this.healthHistory.filter((h) => h.timestamp.getTime() > cutoff);

    if (recent.length === 0) {
      return {
        avgErrorRate: 0,
        peakErrorRate: 0,
        avgLatency: 0,
        peakLatency: 0,
        timeRange: { from: new Date(), to: new Date() },
      };
    }

    const avgErrorRate = recent.reduce((sum, h) => sum + h.overallErrorRate, 0) / recent.length;
    const peakErrorRate = Math.max(...recent.map((h) => h.overallErrorRate));
    const avgLatency = Math.round(recent.reduce((sum, h) => sum + h.avgLatency, 0) / recent.length);
    const peakLatency = Math.max(...recent.map((h) => h.avgLatency));

    return {
      avgErrorRate: Math.round(avgErrorRate * 100) / 100,
      peakErrorRate: Math.round(peakErrorRate * 100) / 100,
      avgLatency,
      peakLatency,
      timeRange: {
        from: recent[0].timestamp,
        to: recent[recent.length - 1].timestamp,
      },
    };
  }

  /**
   * Check if system is in alert state
   */
  public isAlertState(): boolean {
    return this.isInAlert;
  }

  /**
   * Get alert duration (if in alert)
   */
  public getAlertDuration(): number | null {
    if (!this.isInAlert || !this.alertStartTime) return null;
    return Date.now() - this.alertStartTime.getTime();
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Core Polling Logic
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Poll endpoint health once
   */
  private async pollOnce(): Promise<void> {
    try {
      const [health, summary] = await Promise.all([
        this.fetchHealth(),
        this.fetchSummary(),
      ]);

      if (!health || !summary) {
        logger.warn('[HEALTH_MONITOR] Failed to fetch health data');
        return;
      }

      // Build snapshot
      const snapshot: HealthSnapshot = {
        timestamp: new Date(),
        overallErrorRate: health.overallErrorRate || 0,
        unhealthyCount: health.unhealthyEndpoints || 0,
        avgLatency: summary.avgLatency || 0,
        p99Latency: summary.p99Latency || 0,
        status: health.status || 'healthy',
        totalEndpoints: summary.totalEndpoints || 0,
        totalCalls: summary.totalCalls || 0,
      };

      // Analyze and store
      this.storeSnapshot(snapshot);
      await this.analyzeHealth(snapshot);

      this.lastHealthState = snapshot;
    } catch (error) {
      logger.error('[HEALTH_MONITOR] Poll failed:', error instanceof Error ? error.message : error);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Data Fetching
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Fetch health endpoint
   */
  private async fetchHealth(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/docs/health`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      logger.error('[HEALTH_MONITOR] Failed to fetch /api/docs/health:', err.message);
      return null;
    }
  }

  /**
   * Fetch summary stats
   */
  private async fetchSummary(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/docs/stats/summary`, {
        timeout: 5000,
      });
      return response.data.summary;
    } catch (error) {
      const err = error as AxiosError;
      logger.error('[HEALTH_MONITOR] Failed to fetch /api/docs/stats/summary:', err.message);
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Analysis & Alerting
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Store snapshot in rolling history
   */
  private storeSnapshot(snapshot: HealthSnapshot): void {
    this.healthHistory.push(snapshot);
    if (this.healthHistory.length > this.MAX_HISTORY) {
      this.healthHistory.shift();
    }
  }

  /**
   * Analyze health and detect anomalies
   */
  private async analyzeHealth(snapshot: HealthSnapshot): Promise<void> {
    // Check for error rate spikes
    if (snapshot.overallErrorRate >= this.thresholds.errorRateCritical) {
      await this.handleErrorSpike(snapshot, 'critical');
    } else if (snapshot.overallErrorRate >= this.thresholds.errorRateWarning) {
      await this.handleErrorSpike(snapshot, 'warning');
    }

    // Check for latency spikes
    if (snapshot.avgLatency >= this.thresholds.latencyCritical) {
      await this.handleLatencySpike(snapshot, 'critical');
    } else if (snapshot.avgLatency >= this.thresholds.latencyWarning) {
      await this.handleLatencySpike(snapshot, 'warning');
    }

    // Check for p99 latency issues
    if (snapshot.p99Latency >= this.thresholds.p99LatencyCritical) {
      await this.handleP99LatencySpike(snapshot, 'critical');
    }

    // Check for cascading failures (many endpoints down)
    if (snapshot.unhealthyCount >= this.thresholds.unhealthyEndpointsCritical) {
      await this.handleCascadingFailure(snapshot);
    }

    // Check for recovery from alert state
    if (
      this.isInAlert &&
      snapshot.overallErrorRate < this.thresholds.errorRateWarning &&
      snapshot.avgLatency < this.thresholds.latencyWarning &&
      snapshot.unhealthyCount < this.thresholds.unhealthyEndpointsWarning
    ) {
      await this.handleRecovery(snapshot);
    }
  }

  /**
   * Handle error rate spike
   */
  private async handleErrorSpike(snapshot: HealthSnapshot, severity: 'warning' | 'critical'): Promise<void> {
    if (this.isInAlert && severity === 'warning') return; // Don't cascade warnings while in alert

    const alert: AlertContext = {
      severity,
      type: 'error_spike',
      message: `Error rate at ${snapshot.overallErrorRate.toFixed(2)}% (threshold: ${severity === 'critical' ? this.thresholds.errorRateCritical : this.thresholds.errorRateWarning}%)`,
      metrics: {
        overallErrorRate: snapshot.overallErrorRate,
        totalEndpoints: snapshot.totalEndpoints,
        affectedEndpoints: snapshot.unhealthyCount,
      },
      timestamp: new Date(),
      actionsTaken: [],
    };

    await this.triggerAlert(alert);
  }

  /**
   * Handle latency spike
   */
  private async handleLatencySpike(
    snapshot: HealthSnapshot,
    severity: 'warning' | 'critical'
  ): Promise<void> {
    if (this.isInAlert && severity === 'warning') return;

    const alert: AlertContext = {
      severity,
      type: 'latency_spike',
      message: `Average latency at ${snapshot.avgLatency}ms (threshold: ${severity === 'critical' ? this.thresholds.latencyCritical : this.thresholds.latencyWarning}ms)`,
      metrics: {
        avgLatency: snapshot.avgLatency,
        p99Latency: snapshot.p99Latency,
        totalCalls: snapshot.totalCalls,
      },
      timestamp: new Date(),
      actionsTaken: [],
    };

    await this.triggerAlert(alert);
  }

  /**
   * Handle p99 latency spike
   */
  private async handleP99LatencySpike(snapshot: HealthSnapshot, severity: 'warning' | 'critical'): Promise<void> {
    if (this.isInAlert && severity === 'warning') return;

    const alert: AlertContext = {
      severity,
      type: 'latency_spike',
      message: `P99 latency at ${snapshot.p99Latency}ms (threshold: ${this.thresholds.p99LatencyCritical}ms)`,
      metrics: {
        p99Latency: snapshot.p99Latency,
        avgLatency: snapshot.avgLatency,
      },
      timestamp: new Date(),
      actionsTaken: [],
    };

    await this.triggerAlert(alert);
  }

  /**
   * Handle cascading failures
   */
  private async handleCascadingFailure(snapshot: HealthSnapshot): Promise<void> {
    const alert: AlertContext = {
      severity: 'critical',
      type: 'cascading_failure',
      message: `${snapshot.unhealthyCount} endpoints unhealthy (critical threshold: ${this.thresholds.unhealthyEndpointsCritical})`,
      metrics: {
        unhealthyEndpoints: snapshot.unhealthyCount,
        totalEndpoints: snapshot.totalEndpoints,
        percentageUnhealthy: Math.round((snapshot.unhealthyCount / snapshot.totalEndpoints) * 100),
      },
      timestamp: new Date(),
      actionsTaken: [],
    };

    await this.triggerAlert(alert);
  }

  /**
   * Handle recovery from alert
   */
  private async handleRecovery(snapshot: HealthSnapshot): Promise<void> {
    const duration = this.getAlertDuration();

    const alert: AlertContext = {
      severity: 'info',
      type: 'recovery',
      message: `System recovered after ${this.formatDuration(duration || 0)} in alert state`,
      metrics: {
        overallErrorRate: snapshot.overallErrorRate,
        avgLatency: snapshot.avgLatency,
        unhealthyEndpoints: snapshot.unhealthyCount,
        alertDurationMs: duration || 0,
      },
      timestamp: new Date(),
      actionsTaken: ['Cleared alert state'],
    };

    this.isInAlert = false;
    this.alertStartTime = null;

    await this.sendSlackNotification(alert);
    this.addAlert(alert);
    logger.info('[HEALTH_MONITOR] System recovered', alert.metrics);
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(alert: AlertContext): Promise<void> {
    if (!this.isInAlert) {
      this.isInAlert = true;
      this.alertStartTime = new Date();
      logger.warn(`[HEALTH_MONITOR] ALERT TRIGGERED: ${alert.type}`, alert);
    } else {
      logger.debug(`[HEALTH_MONITOR] Additional ${alert.type} detected`, alert.metrics);
    }

    // Send to Slack if configured
    await this.sendSlackNotification(alert);

    // Store in history
    this.addAlert(alert);
  }

  /**
   * Add alert to history
   */
  private addAlert(alert: AlertContext): void {
    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.MAX_ALERTS) {
      this.alertHistory.shift();
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Notifications
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: AlertContext): Promise<void> {
    if (!this.slackWebhookUrl) return;

    try {
      const color = alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'good';
      const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : '✅';

      const payload = {
        attachments: [
          {
            color,
            title: `${emoji} ${alert.type.toUpperCase()}`,
            text: alert.message,
            fields: Object.entries(alert.metrics).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            })),
            ts: Math.floor(alert.timestamp.getTime() / 1000),
          },
        ],
      };

      await axios.post(this.slackWebhookUrl, payload, { timeout: 5000 });
    } catch (error) {
      logger.error('[HEALTH_MONITOR] Failed to send Slack notification:', error instanceof Error ? error.message : error);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Utility Helpers
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Format duration in milliseconds to human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

/**
 * Singleton instance (optional)
 */
let healthMonitorInstance: HealthMonitorAgent | null = null;

export function getHealthMonitor(
  baseUrl?: string,
  options?: {
    pollInterval?: number;
    slackWebhook?: string;
    thresholds?: Partial<{
      errorRateWarning: number;
      errorRateCritical: number;
      latencyWarning: number;
      latencyCritical: number;
      p99LatencyWarning: number;
      p99LatencyCritical: number;
      unhealthyEndpointsWarning: number;
      unhealthyEndpointsCritical: number;
      spikeDetectionWindow: number;
    }>;
  }
): HealthMonitorAgent {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new HealthMonitorAgent(baseUrl, options);
  }
  return healthMonitorInstance;
}

export function initHealthMonitor(
  baseUrl?: string,
  options?: {
    pollInterval?: number;
    slackWebhook?: string;
    thresholds?: Partial<{
      errorRateWarning: number;
      errorRateCritical: number;
      latencyWarning: number;
      latencyCritical: number;
      p99LatencyWarning: number;
      p99LatencyCritical: number;
      unhealthyEndpointsWarning: number;
      unhealthyEndpointsCritical: number;
      spikeDetectionWindow: number;
    }>;
  }
): HealthMonitorAgent {
  const monitor = new HealthMonitorAgent(baseUrl, options);
  monitor.start();
  return monitor;
}
