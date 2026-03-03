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

import axios, { AxiosError } from 'axios';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ════════════════════════════════════════════════════════════════════════════════

interface DomainSnapshot {
  timestamp: Date;
  domain: string;
  endpointCount: number;
  callCount: number;
  avgLatency: number;
  p99Latency: number;
  errorRate: number;
  isHealthy: boolean;
  trend: 'stable' | 'improving' | 'degrading';
}

interface DomainAlert {
  severity: 'warning' | 'critical';
  domain: string;
  type: 'error_spike' | 'latency_spike' | 'recovery';
  message: string;
  metrics: Record<string, any>;
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

// ════════════════════════════════════════════════════════════════════════════════
// Domain Aggregator Agent
// ════════════════════════════════════════════════════════════════════════════════

export class DomainAggregatorAgent {
  private baseUrl: string;
  private pollInterval: number = 300_000; // 5 minutes default
  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;

  // Historical tracking per domain
  private domainSnapshots: Map<string, DomainSnapshot[]> = new Map();
  private readonly MAX_SNAPSHOTS_PER_DOMAIN = 288; // 24 hours at 5-minute intervals
  private alertHistory: DomainAlert[] = [];
  private readonly MAX_ALERTS = 500;

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
    if (this.isRunning) {
      logger.warn('[DOMAIN_AGGREGATOR] Agent already running');
      return;
    }

    logger.info('[DOMAIN_AGGREGATOR] Starting domain aggregator agent', {
      baseUrl: this.baseUrl,
      pollInterval: this.pollInterval,
      thresholds: this.thresholds,
    });

    this.isRunning = true;
    this.pollOnce();
    this.pollTimer = setInterval(() => this.pollOnce(), this.pollInterval);
  }

  public stop(): void {
    if (!this.isRunning) return;
    if (this.pollTimer) clearInterval(this.pollTimer as any);
    this.isRunning = false;
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
    const snapshots = this.domainSnapshots.get(domain) || [];
    if (!limit) return [...snapshots];
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
    trend: 'stable' | 'improving' | 'degrading';
    timeRange: { from: Date; to: Date };
  } {
    const snapshots = this.getDomainHistory(domain);
    const cutoff = Date.now() - minutes * 60 * 1000;
    const recent = snapshots.filter((s) => s.timestamp.getTime() > cutoff);

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

    const avgErrorRate = recent.reduce((sum, s) => sum + s.errorRate, 0) / recent.length;
    const peakErrorRate = Math.max(...recent.map((s) => s.errorRate));
    const avgLatency = Math.round(recent.reduce((sum, s) => sum + s.avgLatency, 0) / recent.length);
    const peakLatency = Math.max(...recent.map((s) => s.avgLatency));

    // Detect trend
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2)).reduce((sum, s) => sum + s.errorRate, 0) / Math.max(1, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2)).reduce((sum, s) => sum + s.errorRate, 0) / Math.max(1, recent.length - Math.floor(recent.length / 2));
    let trend: 'stable' | 'improving' | 'degrading' = 'stable';
    if (secondHalf > firstHalf * 1.1) trend = 'degrading';
    if (secondHalf < firstHalf * 0.9) trend = 'improving';

    return {
      avgErrorRate: Math.round(avgErrorRate * 100) / 100,
      peakErrorRate: Math.round(peakErrorRate * 100) / 100,
      avgLatency,
      peakLatency,
      trend,
      timeRange: {
        from: recent[0].timestamp,
        to: recent[recent.length - 1].timestamp,
      },
    };
  }

  /**
   * Get all unhealthy domains
   */
  public getUnhealthyDomains(): DomainSnapshot[] {
    return Array.from(this.lastDomainStates.values()).filter((s) => !s.isHealthy);
  }

  /**
   * Get slowest domains
   */
  public getSlowestDomains(limit: number = 10): DomainSnapshot[] {
    return Array.from(this.lastDomainStates.values())
      .sort((a, b) => b.p99Latency - a.p99Latency)
      .slice(0, limit);
  }

  /**
   * Get highest error rate domains
   */
  public getHighestErrorDomains(limit: number = 10): DomainSnapshot[] {
    return Array.from(this.lastDomainStates.values())
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Core Polling Logic
  // ════════════════════════════════════════════════════════════════════════════════

  private async pollOnce(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/docs/stats/by-domain`, {
        timeout: 10_000,
      });

      const { domains } = response.data;
      if (!domains) {
        logger.warn('[DOMAIN_AGGREGATOR] No domain data in response');
        return;
      }

      // Process each domain
      for (const [domain, stats] of Object.entries(domains)) {
        const snapshot: DomainSnapshot = {
          timestamp: new Date(),
          domain: domain as string,
          endpointCount: (stats as any).endpointCount,
          callCount: (stats as any).callCount,
          avgLatency: (stats as any).avgLatency,
          p99Latency: (stats as any).p99Latency,
          errorRate: (stats as any).errorRate,
          isHealthy: (stats as any).isHealthy,
          trend: 'stable',
        };

        // Store snapshot
        this.storeSnapshot(domain as string, snapshot);

        // Analyze
        await this.analyzeDomain(domain as string, snapshot);

        this.lastDomainStates.set(domain as string, snapshot);
      }
    } catch (error) {
      logger.error('[DOMAIN_AGGREGATOR] Poll failed:', error instanceof Error ? error.message : error);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Analysis
  // ════════════════════════════════════════════════════════════════════════════════

  private storeSnapshot(domain: string, snapshot: DomainSnapshot): void {
    if (!this.domainSnapshots.has(domain)) {
      this.domainSnapshots.set(domain, []);
    }
    const arr = this.domainSnapshots.get(domain)!;
    arr.push(snapshot);
    if (arr.length > this.MAX_SNAPSHOTS_PER_DOMAIN) {
      arr.shift();
    }
  }

  private async analyzeDomain(domain: string, snapshot: DomainSnapshot): Promise<void> {
    const previous = this.lastDomainStates.get(domain);

    // Check error rate
    if (snapshot.errorRate >= this.thresholds.errorRateCritical) {
      await this.handleAlert(
        {
          severity: 'critical',
          domain,
          type: 'error_spike',
          message: `Domain ${domain} error rate critical: ${snapshot.errorRate.toFixed(2)}% (threshold: ${this.thresholds.errorRateCritical}%)`,
          metrics: {
            errorRate: snapshot.errorRate,
            callCount: snapshot.callCount,
            endpointCount: snapshot.endpointCount,
          },
          timestamp: new Date(),
        }
      );
    } else if (snapshot.errorRate >= this.thresholds.errorRateWarning) {
      if (!previous || previous.errorRate < this.thresholds.errorRateWarning) {
        await this.handleAlert({
          severity: 'warning',
          domain,
          type: 'error_spike',
          message: `Domain ${domain} error rate warning: ${snapshot.errorRate.toFixed(2)}% (threshold: ${this.thresholds.errorRateWarning}%)`,
          metrics: {
            errorRate: snapshot.errorRate,
            callCount: snapshot.callCount,
          },
          timestamp: new Date(),
        });
      }
    }

    // Check latency
    if (snapshot.p99Latency >= this.thresholds.p99LatencyCritical) {
      await this.handleAlert({
        severity: 'critical',
        domain,
        type: 'latency_spike',
        message: `Domain ${domain} P99 latency critical: ${snapshot.p99Latency.toFixed(0)}ms (threshold: ${this.thresholds.p99LatencyCritical}ms)`,
        metrics: {
          p99Latency: snapshot.p99Latency,
          avgLatency: snapshot.avgLatency,
          endpointCount: snapshot.endpointCount,
        },
        timestamp: new Date(),
      });
    }

    // Check recovery
    if (previous && !snapshot.isHealthy && previous.isHealthy === false && snapshot.errorRate < this.thresholds.errorRateWarning) {
      await this.handleAlert({
        severity: 'warning',
        domain,
        type: 'recovery',
        message: `Domain ${domain} recovered: Error rate now ${snapshot.errorRate.toFixed(2)}%`,
        metrics: {
          errorRate: snapshot.errorRate,
          avgLatency: snapshot.avgLatency,
        },
        timestamp: new Date(),
      });
    }
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
