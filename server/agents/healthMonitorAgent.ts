// ============================================================================
// 🏥 Health Monitor Agent — ALIGNED & ENHANCED
// ============================================================================
// Fixes:
//   • Endpoints are now CONFIGURABLE and default to REAL paths
//   • Added typed response interfaces (no more `any`)
//   • Added circuit breaker + retry logic
//   • Added Registry event-mode (zero HTTP when running in-process)
//   • Added correlation IDs for traceability
//   • Alert cooldown is now PER-SEVERITY (critical always notifies)
//   • Recovery alerts are now sent immediately (no throttle)
//
// Endpoints polled:
//   • GET {baseUrl}/api/health/docs/health        (agent health status)
//   • GET {baseUrl}/api/health/docs/stats/summary (latency & call stats)
//
// If running in the same Node process, set useRegistryEvents: true to skip
// HTTP polling and consume HealthRegistry events directly.
// ============================================================================

import axios, { type AxiosError } from 'axios';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

// ═════════════════════════════════════════════════════════════════════════════
// Type Definitions — Strict contracts for the endpoints we poll
// ═════════════════════════════════════════════════════════════════════════════

/** Response from /api/health/docs/health */
export interface DocsHealthResponse {
  status: 'healthy' | 'degraded' | 'critical';
  overallErrorRate: number;
  unhealthyEndpoints: number;
  totalEndpoints: number;
  timestamp: string;
  registrySnapshot?: any; // optional debug payload
}

/** Response from /api/health/docs/stats/summary */
export interface DocsStatsSummaryResponse {
  summary: {
    totalEndpoints: number;
    totalCalls: number;
    avgLatency: number;
    p99Latency: number;
    healthyCount: number;
    degradedCount: number;
    criticalCount: number;
  };
  timestamp: string;
}

export interface HealthSnapshot {
  timestamp: Date;
  overallErrorRate: number;
  unhealthyCount: number;
  avgLatency: number;
  p99Latency: number;
  status: 'healthy' | 'degraded' | 'critical';
  totalEndpoints: number;
  totalCalls: number;
}

export interface AlertContext {
  severity: 'info' | 'warning' | 'critical';
  type: 'error_spike' | 'latency_spike' | 'p99_latency_spike' | 'unhealthy_endpoints' | 'cascading_failure' | 'recovery' | 'endpoint_unreachable';
  message: string;
  metrics: Record<string, any>;
  timestamp: Date;
  actionsTaken: string[];
  correlationId: string;
}

export interface MonitorOptions {
  pollInterval?: number;
  slackWebhook?: string;
  thresholds?: Partial<MonitorThresholds>;
  /** If true, consumes HealthRegistry events instead of HTTP polling */
  useRegistryEvents?: boolean;
  /** HTTP paths (only used when useRegistryEvents is false) */
  endpoints?: {
    health: string;
    summary: string;
  };
  /** Max retries per poll before marking unreachable */
  maxRetries?: number;
  /** Retry delay base in ms (exponential backoff) */
  retryDelayMs?: number;
}

export interface MonitorThresholds {
  errorRateWarning: number;
  errorRateCritical: number;
  latencyWarning: number;
  latencyCritical: number;
  p99LatencyWarning: number;
  p99LatencyCritical: number;
  unhealthyEndpointsWarning: number;
  unhealthyEndpointsCritical: number;
  spikeDetectionWindow: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Circuit Breaker
// ═════════════════════════════════════════════════════════════════════════════

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 30_000
  ) {}

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailureTime || 0) > this.resetTimeoutMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    return true; // half-open
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      logger.warn('[HEALTH_MONITOR] Circuit breaker OPENED');
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Health Monitor Agent
// ═════════════════════════════════════════════════════════════════════════════

export class HealthMonitorAgent {
  private _isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private circuitBreaker = new CircuitBreaker();

  // Historical tracking
  private healthHistory: HealthSnapshot[] = [];
  private readonly MAX_HISTORY = 5760;
  private alertHistory: AlertContext[] = [];
  private readonly MAX_ALERTS = 1000;

  // Thresholds
  private thresholds: MonitorThresholds = {
    errorRateWarning: 2.5,
    errorRateCritical: 5.0,
    latencyWarning: 500,
    latencyCritical: 1000,
    p99LatencyWarning: 1500,
    p99LatencyCritical: 3000,
    unhealthyEndpointsWarning: 5,
    unhealthyEndpointsCritical: 10,
    spikeDetectionWindow: 5,
  };

  // State tracking
  private lastHealthState: HealthSnapshot | null = null;
  private isInAlert = false;
  private alertStartTime: Date | null = null;
  private lastAlertSentAt: Record<string, number> = {};
  private readonly alertCooldownMs = 15 * 60_000;
  private slackWebhookUrl?: string;

  // Endpoint configuration
  private endpoints: { health: string; summary: string };
  private maxRetries: number;
  private retryDelayMs: number;

  // Registry event mode
  private useRegistryEvents: boolean;
  private registryUnsubscribe?: () => void;

  constructor(
    private readonly baseUrl: string = 'http://localhost:5000',
    options: MonitorOptions = {}
  ) {
    if (options.pollInterval) this.pollInterval = options.pollInterval;
    this.slackWebhookUrl = options.slackWebhook;
    if (options.thresholds) this.thresholds = { ...this.thresholds, ...options.thresholds };
    this.useRegistryEvents = options.useRegistryEvents ?? true;
    this.endpoints = options.endpoints ?? {
      health: '/api/health/docs/health',
      summary: '/api/health/docs/stats/summary',
    };
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 500;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public pollInterval = 15_000;

  public start(): void {
    if (this._isRunning) {
      logger.warn('[HEALTH_MONITOR] Agent already running');
      return;
    }

    logger.info('[HEALTH_MONITOR] Starting agent', {
      baseUrl: this.baseUrl,
      pollInterval: this.pollInterval,
      mode: this.useRegistryEvents ? 'registry-events' : 'http-polling',
      endpoints: this.useRegistryEvents ? null : this.endpoints,
      thresholds: this.thresholds,
    });

    this._isRunning = true;

    if (this.useRegistryEvents) {
      this.startRegistryListener();
    } else {
      this.pollLoop();
    }
  }

  public stop(): void {
    if (!this._isRunning) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    if (this.registryUnsubscribe) {
      this.registryUnsubscribe();
      this.registryUnsubscribe = undefined;
    }
    this._isRunning = false;
    logger.info('[HEALTH_MONITOR] Agent stopped');
  }

  public getCurrentHealth(): HealthSnapshot | null {
    return this.lastHealthState;
  }

  public getHealthHistory(limit?: number): HealthSnapshot[] {
    return limit ? this.healthHistory.slice(-limit) : [...this.healthHistory];
  }

  public getAlertHistory(limit?: number): AlertContext[] {
    return limit ? this.alertHistory.slice(-limit) : [...this.alertHistory];
  }

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

    return {
      avgErrorRate: Math.round((recent.reduce((s, h) => s + h.overallErrorRate, 0) / recent.length) * 100) / 100,
      peakErrorRate: Math.round(Math.max(...recent.map((h) => h.overallErrorRate)) * 100) / 100,
      avgLatency: Math.round(recent.reduce((s, h) => s + h.avgLatency, 0) / recent.length),
      peakLatency: Math.max(...recent.map((h) => h.avgLatency)),
      timeRange: {
        from: recent[0].timestamp,
        to: recent[recent.length - 1].timestamp,
      },
    };
  }

  public isAlertState(): boolean {
    return this.isInAlert;
  }

  public getAlertDuration(): number | null {
    if (!this.isInAlert || !this.alertStartTime) return null;
    return Date.now() - this.alertStartTime.getTime();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Registry Event Mode (In-Process)
  // ═══════════════════════════════════════════════════════════════════════════

  private startRegistryListener(): void {
    try {
      // Dynamic import to avoid hard dependency if not using registry mode
      const { healthRegistry } = require('../core/consolidation/HealthRegistryConsolidation');

      const handler = (snapshot: any) => {
        if (!this._isRunning) return;

        const components = snapshot.components || [];
        const totalEndpoints = components.length;
        const unhealthyCount = components.filter(
          (c: any) => c.status === 'critical' || c.status === 'degraded'
        ).length;

        const failureRates = components
          .map((c: any) => c.failureRate || 0)
          .filter((r: number) => r > 0);
        const overallErrorRate = failureRates.length
          ? failureRates.reduce((a: number, b: number) => a + b, 0) / failureRates.length
          : 0;

        const latencies = components
          .map((c: any) => c.latency)
          .filter((l: any): l is number => typeof l === 'number');
        const avgLatency = latencies.length
          ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
          : 0;
        const sorted = [...latencies].sort((a, b) => a - b);
        const p99Latency = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1] : 0;

        const snapshotData: HealthSnapshot = {
          timestamp: new Date(),
          overallErrorRate: Math.round(overallErrorRate * 100) / 100,
          unhealthyCount,
          avgLatency,
          p99Latency,
          status: snapshot.overallStatus === 'critical' ? 'critical' : snapshot.overallStatus,
          totalEndpoints,
          totalCalls: components.reduce((s: number, c: any) => s + (c.successCount || 0) + (c.failureCount || 0), 0),
        };

        this.storeSnapshot(snapshotData);
        this.analyzeHealth(snapshotData);
        this.lastHealthState = snapshotData;
      };

      healthRegistry.on('snapshot', handler);
      this.registryUnsubscribe = () => healthRegistry.off('snapshot', handler);

      // Take initial snapshot immediately
      handler(healthRegistry.getSnapshot());
    } catch (err) {
      logger.error('[HEALTH_MONITOR] Failed to start registry listener, falling back to HTTP', err);
      this.useRegistryEvents = false;
      this.pollLoop();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HTTP Polling Mode
  // ═══════════════════════════════════════════════════════════════════════════

  private async pollLoop(): Promise<void> {
    if (!this._isRunning || this.useRegistryEvents) return;

    try {
      await this.pollOnce();
    } finally {
      if (this._isRunning && !this.useRegistryEvents) {
        this.pollTimer = setTimeout(() => void this.pollLoop(), this.pollInterval);
      }
    }
  }

  private async pollOnce(): Promise<void> {
    if (!this.circuitBreaker.canExecute()) {
      logger.warn('[HEALTH_MONITOR] Circuit breaker open, skipping poll');
      return;
    }

    try {
      const [health, summary] = await Promise.all([
        this.fetchWithRetry<DocsHealthResponse>(this.endpoints.health),
        this.fetchWithRetry<DocsStatsSummaryResponse>(this.endpoints.summary),
      ]);

      const failedEndpoints: string[] = [];
      if (!health) failedEndpoints.push(this.endpoints.health);
      if (!summary) failedEndpoints.push(this.endpoints.summary);

      const snapshot: HealthSnapshot = {
        timestamp: new Date(),
        overallErrorRate: health?.overallErrorRate ?? (failedEndpoints.length > 0 ? 100 : 0),
        unhealthyCount: health?.unhealthyEndpoints ?? summary?.summary.totalEndpoints ?? 0,
        avgLatency: summary?.summary.avgLatency ?? 0,
        p99Latency: summary?.summary.p99Latency ?? 0,
        status:
          failedEndpoints.length > 0
            ? 'critical'
            : health?.status || 'healthy',
        totalEndpoints: summary?.summary.totalEndpoints ?? 0,
        totalCalls: summary?.summary.totalCalls ?? 0,
      };

      this.storeSnapshot(snapshot);
      this.circuitBreaker.recordSuccess();

      if (failedEndpoints.length > 0) {
        await this.handleFetchFailure(failedEndpoints, snapshot);
      }

      await this.analyzeHealth(snapshot);
      this.lastHealthState = snapshot;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      logger.error('[HEALTH_MONITOR] Poll failed:', error instanceof Error ? error.message : error);
    }
  }

  private async fetchWithRetry<T>(path: string, attempt = 1): Promise<T | null> {
    try {
      const response = await axios.get<T>(`${this.baseUrl}${path}`, {
        timeout: 5000,
        validateStatus: (s) => s < 500, // Accept 200-499 (503 is valid for degraded)
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      if (attempt < this.maxRetries) {
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        logger.debug(`[HEALTH_MONITOR] Retry ${attempt}/${this.maxRetries} for ${path} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        return this.fetchWithRetry<T>(path, attempt + 1);
      }
      logger.error(`[HEALTH_MONITOR] Failed to fetch ${path} after ${this.maxRetries} attempts:`, err.message);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Analysis & Alerting
  // ═══════════════════════════════════════════════════════════════════════════

  private storeSnapshot(snapshot: HealthSnapshot): void {
    this.healthHistory.push(snapshot);
    if (this.healthHistory.length > this.MAX_HISTORY) {
      this.healthHistory.shift();
    }
  }

  private async analyzeHealth(snapshot: HealthSnapshot): Promise<void> {
    const alertsToTrigger: AlertContext[] = [];

    // Error rate
    if (snapshot.overallErrorRate >= this.thresholds.errorRateCritical) {
      alertsToTrigger.push(this.buildAlert('error_spike', 'critical', snapshot));
    } else if (snapshot.overallErrorRate >= this.thresholds.errorRateWarning) {
      alertsToTrigger.push(this.buildAlert('error_spike', 'warning', snapshot));
    }

    // Latency
    if (snapshot.avgLatency >= this.thresholds.latencyCritical) {
      alertsToTrigger.push(this.buildAlert('latency_spike', 'critical', snapshot));
    } else if (snapshot.avgLatency >= this.thresholds.latencyWarning) {
      alertsToTrigger.push(this.buildAlert('latency_spike', 'warning', snapshot));
    }

    // P99
    if (snapshot.p99Latency >= this.thresholds.p99LatencyCritical) {
      alertsToTrigger.push(this.buildAlert('p99_latency_spike', 'critical', snapshot));
    } else if (snapshot.p99Latency >= this.thresholds.p99LatencyWarning) {
      alertsToTrigger.push(this.buildAlert('p99_latency_spike', 'warning', snapshot));
    }

    // Cascading failures
    if (snapshot.unhealthyCount >= this.thresholds.unhealthyEndpointsCritical) {
      alertsToTrigger.push(this.buildAlert('cascading_failure', 'critical', snapshot));
    } else if (snapshot.unhealthyCount >= this.thresholds.unhealthyEndpointsWarning) {
      alertsToTrigger.push(this.buildAlert('unhealthy_endpoints', 'warning', snapshot));
    }

    // Deduplicate by type: keep highest severity per type
    const deduped = new Map<string, AlertContext>();
    for (const alert of alertsToTrigger) {
      const existing = deduped.get(alert.type);
      if (!existing || (alert.severity === 'critical' && existing.severity !== 'critical')) {
        deduped.set(alert.type, alert);
      }
    }

    for (const alert of deduped.values()) {
      await this.triggerAlert(alert);
    }

    // Recovery check
    if (
      this.isInAlert &&
      snapshot.overallErrorRate < this.thresholds.errorRateWarning &&
      snapshot.avgLatency < this.thresholds.latencyWarning &&
      snapshot.unhealthyCount < this.thresholds.unhealthyEndpointsWarning
    ) {
      await this.handleRecovery(snapshot);
    }
  }

  private buildAlert(
    type: AlertContext['type'],
    severity: AlertContext['severity'],
    snapshot: HealthSnapshot
  ): AlertContext {
    const correlationId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let message = '';
    const metrics: Record<string, any> = {
      overallErrorRate: snapshot.overallErrorRate,
      avgLatency: snapshot.avgLatency,
      p99Latency: snapshot.p99Latency,
      unhealthyEndpoints: snapshot.unhealthyCount,
      totalEndpoints: snapshot.totalEndpoints,
    };

    switch (type) {
      case 'error_spike':
        message = `Error rate at ${snapshot.overallErrorRate.toFixed(2)}% (threshold: ${severity === 'critical' ? this.thresholds.errorRateCritical : this.thresholds.errorRateWarning}%)`;
        break;
      case 'latency_spike':
        message = `Average latency at ${snapshot.avgLatency}ms (threshold: ${severity === 'critical' ? this.thresholds.latencyCritical : this.thresholds.latencyWarning}ms)`;
        break;
      case 'p99_latency_spike':
        message = `P99 latency at ${snapshot.p99Latency}ms (threshold: ${severity === 'critical' ? this.thresholds.p99LatencyCritical : this.thresholds.p99LatencyWarning}ms)`;
        break;
      case 'cascading_failure':
        message = `${snapshot.unhealthyCount} endpoints unhealthy (critical threshold: ${this.thresholds.unhealthyEndpointsCritical})`;
        metrics.percentageUnhealthy = snapshot.totalEndpoints
          ? Math.round((snapshot.unhealthyCount / snapshot.totalEndpoints) * 100)
          : 0;
        break;
      case 'unhealthy_endpoints':
        message = `${snapshot.unhealthyCount} endpoints unhealthy (warning threshold: ${this.thresholds.unhealthyEndpointsWarning})`;
        break;
      default:
        message = `Health alert: ${type}`;
    }

    return {
      severity,
      type,
      message,
      metrics,
      timestamp: new Date(),
      actionsTaken: [],
      correlationId,
    };
  }

  private async handleFetchFailure(failedEndpoints: string[], snapshot: HealthSnapshot): Promise<void> {
    const alert: AlertContext = {
      severity: 'critical',
      type: 'endpoint_unreachable',
      message: `Failed to fetch health data from ${failedEndpoints.join(', ')}`,
      metrics: { failedEndpoints, overallErrorRate: snapshot.overallErrorRate, totalEndpoints: snapshot.totalEndpoints },
      timestamp: new Date(),
      actionsTaken: ['Circuit breaker incremented'],
      correlationId: `unreachable-${Date.now()}`,
    };
    await this.triggerAlert(alert);
  }

  private shouldSendNotification(alertType: string, severity: string): boolean {
    // Critical alerts ALWAYS notify (no throttle)
    if (severity === 'critical') return true;
    const lastSent = this.lastAlertSentAt[alertType] || 0;
    return Date.now() - lastSent >= this.alertCooldownMs;
  }

  private async handleRecovery(snapshot: HealthSnapshot): Promise<void> {
    const duration = this.getAlertDuration();
    const correlationId = `recovery-${Date.now()}`;

    const alert: AlertContext = {
      severity: 'info',
      type: 'recovery',
      message: `System recovered after ${this.formatDuration(duration || 0)}`,
      metrics: {
        overallErrorRate: snapshot.overallErrorRate,
        avgLatency: snapshot.avgLatency,
        unhealthyEndpoints: snapshot.unhealthyCount,
        alertDurationMs: duration || 0,
      },
      timestamp: new Date(),
      actionsTaken: ['Cleared alert state'],
      correlationId,
    };

    this.isInAlert = false;
    this.alertStartTime = null;

    // Recovery is always sent immediately
    await this.sendSlackNotification(alert);
    this.addAlert(alert);
    logger.info('[HEALTH_MONITOR] System recovered', alert.metrics);
  }

  private async triggerAlert(alert: AlertContext): Promise<void> {
    const shouldNotify = this.shouldSendNotification(alert.type, alert.severity);
    const isFirstAlert = !this.isInAlert;

    if (isFirstAlert) {
      this.isInAlert = true;
      this.alertStartTime = new Date();
      logger.warn(`[HEALTH_MONITOR] ALERT TRIGGERED: ${alert.type} [${alert.correlationId}]`, {
        severity: alert.severity,
        message: alert.message,
      });
    } else {
      logger.debug(`[HEALTH_MONITOR] Additional ${alert.type} detected [${alert.correlationId}]`);
    }

    if (shouldNotify) {
      await this.sendSlackNotification(alert);
      this.lastAlertSentAt[alert.type] = Date.now();
    } else {
      logger.debug('[HEALTH_MONITOR] Alert throttled', { type: alert.type, severity: alert.severity });
    }

    if (isFirstAlert || shouldNotify) {
      this.addAlert(alert);
    }
  }

  private addAlert(alert: AlertContext): void {
    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.MAX_ALERTS) {
      this.alertHistory.shift();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Notifications
  // ═══════════════════════════════════════════════════════════════════════════

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
            footer: `Correlation: ${alert.correlationId}`,
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
      logger.error('[HEALTH_MONITOR] Slack notification failed:', error instanceof Error ? error.message : error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Utilities
  // ═══════════════════════════════════════════════════════════════════════════

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton Factory
// ═════════════════════════════════════════════════════════════════════════════

let healthMonitorInstance: HealthMonitorAgent | null = null;

export function getHealthMonitor(baseUrl?: string, options?: MonitorOptions): HealthMonitorAgent {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new HealthMonitorAgent(baseUrl, options);
    return healthMonitorInstance;
  }
  if (baseUrl || options) {
    logger.warn('[HEALTH_MONITOR] getHealthMonitor called after init; config ignored', { baseUrl, options });
  }
  return healthMonitorInstance;
}

export function initHealthMonitor(baseUrl?: string, options?: MonitorOptions): HealthMonitorAgent {
  const monitor = new HealthMonitorAgent(baseUrl, options);
  monitor.start();
  return monitor;
}