/**
 * 🌐 Domain Aggregator Agent - Domain-Level Health & Analytics
 * 
 * Polls /api/docs/stats/by-domain every 5 minutes
 * Analyzes health per domain:
 * - /api/admin
 * - /api/strategies
 * - /api/payments
 * - etc.
 * 
 * Actions:
 * - Tracks per-domain error rates
 * - Detects domain degradation
 * - Alerts domain owners
 * - Maintains domain health history
 * - Reports trends (5min, 1hr, 24hr)
 */

import axios from 'axios';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ════════════════════════════════════════════════════════════════════════════════

interface DomainMetrics {
  timestamp: Date;
  domain: string;
  endpointCount: number;
  callCount: number;
  errorCount: number;
  errorRate: number;
  avgLatency: number;
  medianLatency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
}

type DomainHealthState = 'healthy' | 'warning' | 'critical' | 'recovering';

type DomainTrend = 'stable' | 'degrading' | 'critical' | 'recovering' | 'healthy';

interface DomainAssessment {
  healthState: DomainHealthState;
  healthScore: number;
  trend: DomainTrend;
  confidence: number;
}

interface DomainSnapshot {
  metrics: DomainMetrics;
  assessment: DomainAssessment;
}

interface DomainAlert {
  severity: 'warning' | 'critical';
  domain: string;
  type: 'error_spike' | 'latency_spike' | 'degradation' | 'recovery';
  message: string;
  metrics: Record<string, unknown>;
  timestamp: Date;
}

interface DomainThresholds {
  errorRateWarning: number;
  errorRateCritical: number;
  latencyWarning: number;
  latencyCritical: number;
  p99LatencyWarning: number;
  p99LatencyCritical: number;
}

interface DomainHistory {
  buffer: DomainSnapshot[];
  nextIndex: number;
  size: number;
}

type DomainAlertState = 'healthy' | 'warning' | 'critical';

// ════════════════════════════════════════════════════════════════════════════════
// Domain Aggregator Agent
// ════════════════════════════════════════════════════════════════════════════════

export class DomainAggregatorAgent {
  private baseUrl: string;
  private pollInterval: number = 300_000; // 5 minutes default
  private _isRunning = false;
  private pollTimer?: NodeJS.Timeout;
  private isPolling = false;

  public get isRunning(): boolean {
    return this._isRunning;
  }

  // Historical tracking per domain
  private domainSnapshots: Map<string, DomainHistory> = new Map();
  private readonly MAX_SNAPSHOTS_PER_DOMAIN = 288; // 24 hours at 5-minute intervals
  private alertHistory: DomainAlert[] = [];
  private readonly MAX_ALERTS = 500;
  private domainAlertState: Map<string, DomainAlertState> = new Map();

  // Thresholds & Configuration
  private thresholds: DomainThresholds = {
    errorRateWarning: 3.0, // % - warn above this
    errorRateCritical: 7.5, // % - critical above this
    latencyWarning: 750, // ms - warn above this
    latencyCritical: 1500, // ms - critical above this
    p99LatencyWarning: 2000, // ms
    p99LatencyCritical: 4000, // ms
  };

  // State tracking
  private lastDomainStates: Map<string, DomainSnapshot> = new Map();
  private slackWebhookUrl?: string;
  // Retry / pause state for resilient polling
  private pauseUntil?: number | null = null;
  private maxRetriesPerPoll: number = 3;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailuresBeforePause: number = 5;
  private pauseDurationMs: number = 15 * 60_000; // 15 minutes

  constructor(
    baseUrl: string = 'http://localhost:5000',
    options?: {
      pollInterval?: number;
      slackWebhook?: string;
      thresholds?: Partial<DomainThresholds>;
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

  public start(): void {
    if (this._isRunning) {
      logger.warn('[DOMAIN_AGGREGATOR] Agent already running');
      return;
    }

    logger.info('[DOMAIN_AGGREGATOR] Starting domain aggregator agent', {
      baseUrl: this.baseUrl,
      pollInterval: this.pollInterval,
      thresholds: this.thresholds,
    });

    this._isRunning = true;
    this.pollOnce();
    this.pollTimer = setInterval(() => this.pollOnce(), this.pollInterval);
  }

  public stop(): void {
    if (!this.isRunning) return;
    if (this.pollTimer) clearInterval(this.pollTimer as any);
    this._isRunning = false;
    logger.info('[DOMAIN_AGGREGATOR] Domain aggregator agent stopped');
  }

  /**
   * Get domain health for all domains
   */
  public getDomainSnapshot(domain?: string): DomainSnapshot | Map<string, DomainSnapshot> | null {
    if (domain) {
      return this.lastDomainStates.get(domain) || null;
    }
    return this.lastDomainStates;
  }

  /**
   * Get domain health history
   */
  public getDomainHistory(domain: string, limit?: number): DomainSnapshot[] {
    const history = this.domainSnapshots.get(domain);
    if (!history || history.size === 0) return [];

    const snapshots: DomainSnapshot[] = [];
    const start = history.size === this.MAX_SNAPSHOTS_PER_DOMAIN ? history.nextIndex : 0;
    for (let i = 0; i < history.size; i += 1) {
      snapshots.push(history.buffer[(start + i) % this.MAX_SNAPSHOTS_PER_DOMAIN]);
    }

    if (!limit) return snapshots;
    return snapshots.slice(-limit);
  }

  /**
   * Get domain health trends
   */
  public getDomainTrends(domain: string, minutes: number = 60): {
    avgErrorRate: number;
    peakErrorRate: number;
    avgLatency: number;
    peakLatency: number;
    trend: DomainTrend;
    timeRange: { from: Date; to: Date };
  } {
    const snapshots = this.getDomainHistory(domain);
    const cutoff = Date.now() - minutes * 60 * 1000;
    const recent = snapshots.filter((s) => s.metrics.timestamp.getTime() > cutoff);

    if (recent.length === 0) {
      return {
        avgErrorRate: 0,
        peakErrorRate: 0,
        avgLatency: 0,
        peakLatency: 0,
        trend: 'stable',
        timeRange: { from: new Date(), to: new Date() },
      };
    }

    const avgErrorRate = recent.reduce((sum, s) => sum + s.metrics.errorRate, 0) / recent.length;
    const peakErrorRate = Math.max(...recent.map((s) => s.metrics.errorRate));
    const avgLatency = Math.round(recent.reduce((sum, s) => sum + s.metrics.avgLatency, 0) / recent.length);
    const peakLatency = Math.max(...recent.map((s) => s.metrics.avgLatency));

    const firstHalf = recent.slice(0, Math.floor(recent.length / 2)).reduce((sum, s) => sum + s.metrics.errorRate, 0) / Math.max(1, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2)).reduce((sum, s) => sum + s.metrics.errorRate, 0) / Math.max(1, recent.length - Math.floor(recent.length / 2));
    let trend: DomainTrend = 'stable';
    if (secondHalf > firstHalf * 1.1) trend = 'degrading';
    if (secondHalf < firstHalf * 0.9) trend = 'healthy';

    return {
      avgErrorRate: Math.round(avgErrorRate * 100) / 100,
      peakErrorRate: Math.round(peakErrorRate * 100) / 100,
      avgLatency,
      peakLatency,
      trend,
      timeRange: {
        from: recent[0].metrics.timestamp,
        to: recent[recent.length - 1].metrics.timestamp,
      },
    };
  }

  /**
   * Get all unhealthy domains
   */
  public getUnhealthyDomains(): DomainSnapshot[] {
    return Array.from(this.lastDomainStates.values()).filter((s) => s.assessment.healthState !== 'healthy');
  }

  /**
   * Get slowest domains
   */
  public getSlowestDomains(limit: number = 10): DomainSnapshot[] {
    return Array.from(this.lastDomainStates.values())
      .sort((a, b) => b.metrics.p99Latency - a.metrics.p99Latency)
      .slice(0, limit);
  }

  /**
   * Get highest error rate domains
   */
  public getHighestErrorDomains(limit: number = 10): DomainSnapshot[] {
    return Array.from(this.lastDomainStates.values())
      .sort((a, b) => b.metrics.errorRate - a.metrics.errorRate)
      .slice(0, limit);
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Core Polling Logic
  // ════════════════════════════════════════════════════════════════════════════════

  private async pollOnce(): Promise<void> {
    if (this.isPolling) {
      logger.warn('[DOMAIN_AGGREGATOR] Poll already in progress, skipping overlapping execution');
      return;
    }

    if (this.pauseUntil && Date.now() < this.pauseUntil) {
      logger.warn('[DOMAIN_AGGREGATOR] Poll paused until', { pausedUntil: new Date(this.pauseUntil).toISOString() });
      return;
    }

    this.isPolling = true;
    let attempt = 0;
    let lastError: unknown = null;

    try {
      while (attempt <= this.maxRetriesPerPoll) {
        try {
          const response = await axios.get(`${this.baseUrl}/api/docs/stats/by-domain`, { timeout: 10_000 });
          const { domains } = response.data as { domains?: Record<string, unknown> };
          if (!domains || typeof domains !== 'object') {
            logger.warn('[DOMAIN_AGGREGATOR] No domain data in response');
            return;
          }

          for (const [domain, stats] of Object.entries(domains)) {
            const statObj = stats as Record<string, unknown>;
            const metrics: DomainMetrics = {
              timestamp: new Date(),
              domain,
              endpointCount: Number(statObj.endpointCount || 0),
              callCount: Number(statObj.callCount || 0),
              errorCount: Number(statObj.errorCount || 0),
              errorRate: Number(statObj.errorRate || 0),
              avgLatency: Number(statObj.avgLatency || 0),
              medianLatency: Number(statObj.medianLatency || statObj.avgLatency || 0),
              p95Latency: Number(statObj.p95Latency || statObj.p99Latency || 0),
              p99Latency: Number(statObj.p99Latency || 0),
              maxLatency: Number(statObj.maxLatency || statObj.p99Latency || statObj.avgLatency || 0),
            };

            const previous = this.lastDomainStates.get(domain);
            const snapshot: DomainSnapshot = {
              metrics,
              assessment: this.buildDomainAssessment(metrics, previous),
            };

            this.storeSnapshot(domain, snapshot);
            await this.analyzeDomain(domain, snapshot);
            this.lastDomainStates.set(domain, snapshot);
          }

          this.consecutiveFailures = 0;
          return;
        } catch (err) {
          lastError = err;
          attempt += 1;
          const waitMs = 300 * Math.pow(2, attempt);
          logger.warn(`[DOMAIN_AGGREGATOR] Poll attempt ${attempt} failed — retrying in ${waitMs}ms`, {
            error: err instanceof Error ? err.message : String(err),
          });
          await new Promise((res) => setTimeout(res, waitMs));
        }
      }

      logger.error('[DOMAIN_AGGREGATOR] Poll failed after retries:', lastError instanceof Error ? lastError.message : String(lastError));
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= this.maxConsecutiveFailuresBeforePause) {
        this.pauseUntil = Date.now() + this.pauseDurationMs;
        logger.error('[DOMAIN_AGGREGATOR] Pausing polling until', new Date(this.pauseUntil).toISOString());
      }
    } finally {
      this.isPolling = false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Analysis
  // ════════════════════════════════════════════════════════════════════════════════

  private storeSnapshot(domain: string, snapshot: DomainSnapshot): void {
    let history = this.domainSnapshots.get(domain);
    if (!history) {
      history = { buffer: new Array<DomainSnapshot>(this.MAX_SNAPSHOTS_PER_DOMAIN), nextIndex: 0, size: 0 };
      this.domainSnapshots.set(domain, history);
    }

    if (history.size < this.MAX_SNAPSHOTS_PER_DOMAIN) {
      history.buffer[history.size] = snapshot;
      history.size += 1;
    } else {
      history.buffer[history.nextIndex] = snapshot;
    }

    history.nextIndex = (history.nextIndex + 1) % this.MAX_SNAPSHOTS_PER_DOMAIN;
  }

  private buildDomainAssessment(metrics: DomainMetrics, previous?: DomainSnapshot): DomainAssessment {
    const errorCritical = metrics.errorRate >= this.thresholds.errorRateCritical;
    const latencyCritical = metrics.p99Latency >= this.thresholds.p99LatencyCritical || metrics.avgLatency >= this.thresholds.latencyCritical;
    const errorWarning = metrics.errorRate >= this.thresholds.errorRateWarning;
    const latencyWarning = metrics.p99Latency >= this.thresholds.p99LatencyWarning || metrics.avgLatency >= this.thresholds.latencyWarning;

    const confidence = Math.min(1, Math.max(0.2, metrics.callCount / 1000));
    let healthState: DomainHealthState = 'healthy';

    if (errorCritical || latencyCritical) {
      healthState = 'critical';
    } else if (errorWarning || latencyWarning) {
      healthState = 'warning';
    } else if (previous && previous.assessment.healthState !== 'healthy') {
      healthState = 'recovering';
    }

    let trend: DomainTrend = 'stable';
    if (healthState === 'critical') {
      trend = 'critical';
    } else if (previous) {
      const errorIncrease = metrics.errorRate > previous.metrics.errorRate * 1.05;
      const p99Increase = metrics.p99Latency > previous.metrics.p99Latency * 1.05;
      const avgIncrease = metrics.avgLatency > previous.metrics.avgLatency * 1.05;

      if (healthState === 'recovering') {
        trend = 'recovering';
      } else if (errorIncrease || p99Increase || avgIncrease) {
        trend = 'degrading';
      } else if (healthState === 'healthy' && previous.assessment.healthState !== 'healthy') {
        trend = 'healthy';
      }
    }

    let score = 100;
    score -= Math.min(40, (metrics.errorRate / Math.max(1, this.thresholds.errorRateCritical)) * 40);
    score -= Math.min(30, (metrics.p99Latency / Math.max(1, this.thresholds.p99LatencyCritical)) * 30);
    score -= Math.min(20, (metrics.avgLatency / Math.max(1, this.thresholds.latencyCritical)) * 20);
    if (metrics.callCount < 100) score -= 10;
    if (healthState === 'critical') score -= 10;
    score = Math.max(0, Math.round(score * confidence));

    return {
      healthState,
      healthScore: score,
      trend,
      confidence,
    };
  }

  private async analyzeDomain(domain: string, snapshot: DomainSnapshot): Promise<void> {
    const previous = this.lastDomainStates.get(domain);
    const previousAlertState = this.domainAlertState.get(domain) ?? 'healthy';
    const currentState = snapshot.assessment.healthState;

    if (currentState === previousAlertState) {
      return;
    }

    const metrics = snapshot.metrics;
    const alerts: string[] = [];
    const aggregatedMetrics: Record<string, unknown> = {
      errorRate: metrics.errorRate,
      p99Latency: metrics.p99Latency,
      avgLatency: metrics.avgLatency,
      callCount: metrics.callCount,
      endpointCount: metrics.endpointCount,
    };

    if (currentState === 'critical') {
      if (metrics.errorRate >= this.thresholds.errorRateCritical) {
        alerts.push(`critical error rate ${metrics.errorRate.toFixed(2)}%`);
      }
      if (metrics.p99Latency >= this.thresholds.p99LatencyCritical) {
        alerts.push(`critical p99 latency ${metrics.p99Latency.toFixed(0)}ms`);
      }
      if (metrics.avgLatency >= this.thresholds.latencyCritical) {
        alerts.push(`critical avg latency ${metrics.avgLatency.toFixed(0)}ms`);
      }
    } else if (currentState === 'warning') {
      if (metrics.errorRate >= this.thresholds.errorRateWarning) {
        alerts.push(`warning error rate ${metrics.errorRate.toFixed(2)}%`);
      }
      if (metrics.p99Latency >= this.thresholds.p99LatencyWarning) {
        alerts.push(`warning p99 latency ${metrics.p99Latency.toFixed(0)}ms`);
      }
      if (metrics.avgLatency >= this.thresholds.latencyWarning) {
        alerts.push(`warning avg latency ${metrics.avgLatency.toFixed(0)}ms`);
      }
    } else if (currentState === 'recovering' || currentState === 'healthy') {
      alerts.push('domain is recovering or healthy');
    }

    if (alerts.length === 0) {
      this.domainAlertState.set(domain, currentState === 'recovering' ? 'warning' : currentState);
      return;
    }

    const alertType = currentState === 'critical' ? 'error_spike' : currentState === 'warning' ? 'degradation' : 'recovery';
    const severity = currentState === 'critical' ? 'critical' : 'warning';
    const message = `Domain ${domain} transitioned to ${currentState}: ${alerts.join('; ')}`;

    await this.handleAlert({
      severity,
      domain,
      type: alertType,
      message,
      metrics: aggregatedMetrics,
      timestamp: new Date(),
    });

    this.domainAlertState.set(domain, currentState === 'recovering' ? 'warning' : currentState);
  }

  private async handleAlert(alert: DomainAlert): Promise<void> {
    logger.warn(`[DOMAIN_AGGREGATOR] ${alert.message}`, alert.metrics);
    await this.sendSlackNotification(alert);
    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.MAX_ALERTS) {
      this.alertHistory.shift();
    }
  }

  private async sendSlackNotification(alert: DomainAlert): Promise<void> {
    if (!this.slackWebhookUrl) return;

    try {
      const color = alert.severity === 'critical' ? 'danger' : 'warning';
      const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';

      const payload = {
        attachments: [
          {
            color,
            title: `${emoji} DOMAIN: ${alert.domain.toUpperCase()}`,
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
      logger.error('[DOMAIN_AGGREGATOR] Failed to send Slack notification:', error instanceof Error ? error.message : error);
    }
  }
}

let domainAggregatorInstance: DomainAggregatorAgent | null = null;

export function getDomainAggregator(
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
    }>;
  }
): DomainAggregatorAgent {
  if (!domainAggregatorInstance) {
    domainAggregatorInstance = new DomainAggregatorAgent(baseUrl, options);
  }
  return domainAggregatorInstance;
}

export function initDomainAggregator(
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
    }>;
  }
): DomainAggregatorAgent {
  const agent = new DomainAggregatorAgent(baseUrl, options);
  agent.start();
  return agent;
}
