/**
 * 📈 Capacity Planner Agent - Resource Forecasting & Scaling Recommendations
 * 
 * Polls /api/docs/stats every 10 minutes
 * Analyzes usage patterns:
 * - Call volume trends
 * - Resource saturation
 * - Peak time forecasting
 * - Scaling recommendations
 * 
 * Actions:
 * - Identifies hotspots
 * - Forecasts capacity needs
 * - Recommends auto-scaling parameters
 * - Reports utilization trends
 */

import axios, { AxiosError } from 'axios';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ════════════════════════════════════════════════════════════════════════════════

interface EndpointStats {
  path: string;
  method: string;
  callCount: number;
  avgLatency: number;
  errorRate?: number;
}

interface StatsResponse {
  summary: {
    totalCalls: number;
    avgLatency: number;
    errorCount?: number;
    errorRate?: number;
  };
  endpoints: EndpointStats[];
}

interface CapacityPlannerThresholds {
  hotspotCallThreshold: number;
  bottleneckDegradationThreshold: number;
  scalingCallThreshold: number;
  forecastWindow: number;
}

interface CapacitySnapshot {
  timestamp: Date;
  totalCalls: number;
  avgLatency: number;
  errorCount: number;
  errorRate: number;
  hotEndpoints: Array<{ path: string; method: string; callCount: number }>;
  bottlenecks: Array<{ path: string; reason: string; severity: 'medium' | 'high' }>;
}

interface ScalingRecommendation {
  endpoint: string;
  currentCallRate: number; // calls per period
  projectedCallRate: number; // projected calls in same period
  recommendedAction: 'none' | 'monitor' | 'scale_up' | 'scale_down';
  confidence: number; // 0-1
  reason: string;
  estimatedLatencyIncrease: number; // ms
}

// Forecast strategy interface (pluggable)
export interface ForecastStrategy {
  project(endpoint: EndpointStats, windowMinutes: number): { projectedCallRate: number; confidence: number };
}

class DefaultForecastStrategy implements ForecastStrategy {
  private multiplier: number;
  constructor(multiplier = 1.25) {
    this.multiplier = multiplier;
  }
  project(endpoint: EndpointStats): { projectedCallRate: number; confidence: number } {
    return { projectedCallRate: Math.round(endpoint.callCount * this.multiplier), confidence: 0.6 };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Capacity Planner Agent
// ════════════════════════════════════════════════════════════════════════════════

export class CapacityPlannerAgent {
  private baseUrl: string;
  private pollInterval: number = 600_000; // 10 minutes default
  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;

  // resilience
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailuresBeforePause = 3;
  private readonly pauseDurationMs = 10 * 60 * 1000; // 10 minutes
  private pauseUntil?: number;
  private readonly maxRetriesPerPoll = 2;

  // Historical tracking
  private capacitySnapshots: CapacitySnapshot[] = [];
  private readonly MAX_SNAPSHOTS = 144; // 24 hours at 10-minute intervals
  private recommendationHistory: ScalingRecommendation[] = [];
  private readonly MAX_RECOMMENDATIONS = 1000;

  // Threshold & Configuration
  private thresholds: CapacityPlannerThresholds = {
    hotspotCallThreshold: 50_000, // calls in period = considered hot
    bottleneckDegradationThreshold: 50, // latency increase % from baseline
    scalingCallThreshold: 100_000, // when to recommend scaling
    forecastWindow: 60, // minutes ahead to forecast
  };

  // State
  private baselineMetrics: { name: string; avgLatency: number }[] = [];
  private slackWebhookUrl?: string;
  private forecastStrategy: ForecastStrategy = new DefaultForecastStrategy();

  constructor(
    baseUrl: string = 'http://localhost:5000',
    options?: {
      pollInterval?: number;
      slackWebhook?: string;
      thresholds?: Partial<CapacityPlannerThresholds>;
      forecastStrategy?: ForecastStrategy;
    }
  ) {
    this.baseUrl = baseUrl;
    if (options?.pollInterval) this.pollInterval = options.pollInterval;
    if (options?.slackWebhook) this.slackWebhookUrl = options.slackWebhook;
    if (options?.forecastStrategy) this.forecastStrategy = options.forecastStrategy;
    if (options?.thresholds) {
      this.thresholds = { ...this.thresholds, ...options.thresholds };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Public API
  // ════════════════════════════════════════════════════════════════════════════════

  public start(): void {
    if (this.isRunning) {
      logger.warn('[CAPACITY_PLANNER] Agent already running');
      return;
    }

    logger.info('[CAPACITY_PLANNER] Starting capacity planner agent', {
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
    logger.info('[CAPACITY_PLANNER] Capacity planner agent stopped');
  }

  /**
   * Get current capacity status
   */
  public getCurrentCapacity(): CapacitySnapshot | null {
    return this.capacitySnapshots.length > 0 ? this.capacitySnapshots[this.capacitySnapshots.length - 1] : null;
  }

  /**
   * Get capacity history
   */
  public getCapacityHistory(limit?: number): CapacitySnapshot[] {
    if (!limit) return [...this.capacitySnapshots];
    return this.capacitySnapshots.slice(-limit);
  }

  /**
   * Get scaling recommendations
   */
  public getScalingRecommendations(severity?: 'any' | 'monitor' | 'scale_up'): ScalingRecommendation[] {
    if (!severity || severity === 'any') {
      return [...this.recommendationHistory];
    }
    return this.recommendationHistory.filter((r) => r.recommendedAction === severity);
  }

  /**
   * Get hottest endpoints (by call volume)
   */
  public getHottestEndpoints(limit: number = 10): Array<{ path: string; method: string; callCount: number }> {
    const current = this.getCurrentCapacity();
    if (!current) return [];
    return current.hotEndpoints.slice(0, limit);
  }

  /**
   * Get bottlenecks
   */
  public getBottlenecks(): Array<{ path: string; reason: string; severity: 'medium' | 'high' }> {
    const current = this.getCurrentCapacity();
    if (!current) return [];
    return current.bottlenecks;
  }

  /**
   * Get utilization trend
   */
  public getUtilizationTrend(hours: number = 1): {
    avgCallRate: number; // calls per minute
    peakCallRate: number;
    trend: 'stable' | 'increasing' | 'decreasing';
  } {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const recent = this.capacitySnapshots.filter((s) => s.timestamp.getTime() > cutoff);

    if (recent.length === 0) {
      return { avgCallRate: 0, peakCallRate: 0, trend: 'stable' };
    }

    // Estimate call rate per minute (based on snapshots every 10 min)
    const callRates = recent.map((s) => (s.totalCalls / 10) * 60); // Assuming total calls is cumulative in period
    const avgCallRate = callRates.reduce((a, b) => a + b, 0) / callRates.length;
    const peakCallRate = Math.max(...callRates);

    // Detect trend
    const firstHalf = callRates.slice(0, Math.floor(callRates.length / 2)).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(callRates.length / 2));
    const secondHalf = callRates.slice(Math.floor(callRates.length / 2)).reduce((a, b) => a + b, 0) / Math.max(1, callRates.length - Math.floor(callRates.length / 2));
    let trend: 'stable' | 'increasing' | 'decreasing' = 'stable';
    if (secondHalf > firstHalf * 1.1) trend = 'increasing';
    if (secondHalf < firstHalf * 0.9) trend = 'decreasing';

    return { avgCallRate: Math.round(avgCallRate), peakCallRate: Math.round(peakCallRate), trend };
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Core Polling Logic
  // ════════════════════════════════════════════════════════════════════════════════

  private async pollOnce(): Promise<void> {
    // Respect pause due to consecutive failures
    if (this.pauseUntil && Date.now() < this.pauseUntil) {
      logger.warn('[CAPACITY_PLANNER] Poll paused until', new Date(this.pauseUntil).toISOString());
      return;
    }

    let attempt = 0;
    let lastError: any = null;
    while (attempt <= this.maxRetriesPerPoll) {
      try {
        const response = await axios.get<StatsResponse>(`${this.baseUrl}/api/docs/stats`, { timeout: 15_000 });
        const { summary, endpoints } = response.data;

        if (!summary || !Array.isArray(endpoints)) {
          logger.warn('[CAPACITY_PLANNER] Missing or invalid data in response');
          return;
        }

        const snapshot: CapacitySnapshot = {
          timestamp: new Date(),
          totalCalls: Number(summary.totalCalls || 0),
          avgLatency: Number(summary.avgLatency || 0),
          errorCount: Number(summary.errorCount || 0),
          errorRate: Number(summary.errorRate || 0),
          hotEndpoints: this.findHotEndpoints(endpoints),
          bottlenecks: this.detectBottlenecks(endpoints),
        };

        this.storeSnapshot(snapshot);
        await this.analyzeCapacity(snapshot, endpoints);

        // success
        this.consecutiveFailures = 0;
        return;
      } catch (err) {
        lastError = err;
        attempt += 1;
        const waitMs = 500 * Math.pow(2, attempt);
        logger.warn(`[CAPACITY_PLANNER] Poll attempt ${attempt} failed — retrying in ${waitMs}ms`, err instanceof Error ? err.message : err);
        await new Promise((res) => setTimeout(res, waitMs));
      }
    }

    logger.error('[CAPACITY_PLANNER] Poll failed after retries:', lastError instanceof Error ? lastError.message : lastError);
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.maxConsecutiveFailuresBeforePause) {
      this.pauseUntil = Date.now() + this.pauseDurationMs;
      logger.error('[CAPACITY_PLANNER] Pausing polling until', new Date(this.pauseUntil).toISOString());
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Analysis
  // ════════════════════════════════════════════════════════════════════════════════

  private storeSnapshot(snapshot: CapacitySnapshot): void {
    this.capacitySnapshots.push(snapshot);
    if (this.capacitySnapshots.length > this.MAX_SNAPSHOTS) {
      this.capacitySnapshots.shift();
    }
  }

  private findHotEndpoints(endpoints: EndpointStats[]): Array<{ path: string; method: string; callCount: number }> {
    return endpoints
      .filter((e) => Number(e.callCount || 0) >= this.thresholds.hotspotCallThreshold)
      .map((e) => ({ path: e.path, method: e.method, callCount: Number(e.callCount || 0) }))
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 20);
  }

  private detectBottlenecks(endpoints: EndpointStats[]): Array<{ path: string; reason: string; severity: 'medium' | 'high' }> {
    const bottlenecks: Array<{ path: string; reason: string; severity: 'medium' | 'high' }> = [];

    endpoints.forEach((endpoint) => {
      const callCount = Number(endpoint.callCount || 0);
      const avgLatency = Number(endpoint.avgLatency || 0);
      const errorRate = Number(endpoint.errorRate || 0);

      if (callCount > 10_000 && avgLatency > 1000) {
        bottlenecks.push({ path: endpoint.path, reason: `High latency (${Math.round(avgLatency)}ms) with high volume (${callCount} calls)`, severity: 'high' });
      }

      if (callCount > 10_000 && errorRate > 5) {
        bottlenecks.push({ path: endpoint.path, reason: `High error rate (${errorRate.toFixed(1)}%) with high volume`, severity: 'high' });
      }

      if (errorRate > 3 && callCount > 5_000) {
        bottlenecks.push({ path: endpoint.path, reason: `Elevated error rate (${errorRate.toFixed(1)}%) on medium-volume endpoint`, severity: 'medium' });
      }
    });

    return bottlenecks;
  }

  private async analyzeCapacity(snapshot: CapacitySnapshot, endpoints: EndpointStats[]): Promise<void> {
    // Find endpoints that need scaling
    const scalingNeeds = this.generateScalingRecommendations(endpoints);

    if (scalingNeeds.length > 0) {
      logger.info('[CAPACITY_PLANNER] Scaling recommendations generated:', {
        count: scalingNeeds.length,
        scaleUp: scalingNeeds.filter((r) => r.recommendedAction === 'scale_up').length,
      });

      // Store recommendations
      this.recommendationHistory.push(...scalingNeeds);
      if (this.recommendationHistory.length > this.MAX_RECOMMENDATIONS) {
        this.recommendationHistory = this.recommendationHistory.slice(-this.MAX_RECOMMENDATIONS);
      }

      // Notify Slack for high-confidence scale_up recommendations
      const critical = scalingNeeds.filter((r) => r.recommendedAction === 'scale_up' && r.confidence >= 0.8);
      if (critical.length > 0) {
        try {
          await this.sendSlackNotification(critical);
        } catch (err) {
          logger.error('[CAPACITY_PLANNER] Slack notification failed:', err instanceof Error ? err.message : err);
        }
      }
    }

    // Log capacity summary every poll
    logger.debug('[CAPACITY_PLANNER] Capacity snapshot:', {
      totalCalls: snapshot.totalCalls,
      hotEndpoints: snapshot.hotEndpoints.length,
      bottlenecks: snapshot.bottlenecks.length,
      avgLatency: Math.round(snapshot.avgLatency),
    });
  }

  private generateScalingRecommendations(endpoints: EndpointStats[]): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];

    endpoints
      .filter((e) => Number(e.callCount || 0) >= this.thresholds.scalingCallThreshold)
      .forEach((endpoint) => {
        const { projectedCallRate, confidence } = this.forecastStrategy.project(endpoint, this.thresholds.forecastWindow);

        let recommendedAction: 'none' | 'monitor' | 'scale_up' | 'scale_down' = 'none';
        let reason = 'Stable performance';

        const avgLatency = Number(endpoint.avgLatency || 0);

        if (avgLatency > 800 && projectedCallRate > this.thresholds.scalingCallThreshold * 1.5) {
          recommendedAction = 'scale_up';
          reason = 'High latency with projected volume increase';
        } else if (projectedCallRate > this.thresholds.scalingCallThreshold * 2) {
          recommendedAction = 'scale_up';
          reason = 'Projected 2x volume increase';
        } else if (Number(endpoint.callCount) > this.thresholds.scalingCallThreshold * 1.5 && avgLatency > 600) {
          recommendedAction = 'monitor';
          reason = 'Monitor for degradation';
        }

        if (recommendedAction !== 'none') {
          recommendations.push({
            endpoint: `${endpoint.method} ${endpoint.path}`,
            currentCallRate: Math.round(Number(endpoint.callCount || 0)),
            projectedCallRate: Math.round(projectedCallRate),
            recommendedAction,
            confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
            reason,
            estimatedLatencyIncrease: Math.round((avgLatency * 0.3) / 100) * 100,
          });
        }
      });

    return recommendations;
  }

  private async sendSlackNotification(recs: ScalingRecommendation[]): Promise<void> {
    if (!this.slackWebhookUrl) return;

    try {
      const attachments = recs.map((r) => ({
        color: r.recommendedAction === 'scale_up' ? 'danger' : 'warning',
        title: `${r.recommendedAction.toUpperCase()}: ${r.endpoint}`,
        text: `${r.reason} — projected: ${r.projectedCallRate}, confidence: ${Math.round(r.confidence * 100)}%`,
        fields: [
          { title: 'Current', value: String(r.currentCallRate), short: true },
          { title: 'Projected', value: String(r.projectedCallRate), short: true },
          { title: 'Estimated Latency Increase', value: `${r.estimatedLatencyIncrease}ms`, short: true },
        ],
        ts: Math.floor(Date.now() / 1000),
      }));

      await axios.post(this.slackWebhookUrl, { attachments }, { timeout: 5_000 });
    } catch (err) {
      logger.error('[CAPACITY_PLANNER] Failed to send Slack notification:', err instanceof Error ? err.message : err);
    }
  }
}

let capacityPlannerInstance: CapacityPlannerAgent | null = null;

export function getCapacityPlanner(
  baseUrl?: string,
  options?: {
    pollInterval?: number;
    slackWebhook?: string;
    thresholds?: Partial<CapacityPlannerThresholds>;
  }
): CapacityPlannerAgent {
  if (!capacityPlannerInstance) {
    capacityPlannerInstance = new CapacityPlannerAgent(baseUrl, options);
  }
  return capacityPlannerInstance;
}

export function initCapacityPlanner(
  baseUrl?: string,
  options?: {
    pollInterval?: number;
    slackWebhook?: string;
    thresholds?: Partial<CapacityPlannerThresholds>;
  }
): CapacityPlannerAgent {
  const agent = new CapacityPlannerAgent(baseUrl, options);
  agent.start();
  return agent;
}
