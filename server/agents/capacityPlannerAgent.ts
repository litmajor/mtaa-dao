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

import axios from 'axios';
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

interface CapacityWindowInfo {
  windowMinutes: number;
  isCumulative: boolean;
}

interface StatsResponse {
  summary: {
    totalCalls: number;
    avgLatency: number;
    errorCount?: number;
    errorRate?: number;
    cpuPressure?: number;
    memoryPressure?: number;
    queuePressure?: number;
    workerSaturation?: number;
    eventLoopLagMs?: number;
  };
  endpoints: EndpointStats[];
}

interface CapacityPlannerThresholds {
  hotspotCallThreshold: number;
  bottleneckDegradationThreshold: number;
  scalingCallThreshold: number;
  forecastWindow: number;
}

interface CapacityMetrics {
  timestamp: Date;
  totalCalls: number;
  avgLatency: number;
  errorCount: number;
  errorRate: number;
  cpuPressure: number;
  memoryPressure: number;
  queuePressure: number;
  workerSaturation: number;
  eventLoopLagMs: number;
  endpointCount: number;
  hotEndpointCount: number;
  bottleneckCount: number;
}

interface CapacityAssessment {
  healthState: 'healthy' | 'warning' | 'critical' | 'recovering';
  healthScore: number;
  trend: 'stable' | 'degrading' | 'critical' | 'recovering' | 'healthy';
  confidence: number;
  saturationScore: number;
}

interface CapacitySnapshot {
  metrics: CapacityMetrics;
  assessment: CapacityAssessment;
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
  risk: 'low' | 'medium' | 'high' | 'critical';
  capacityScore: number;
  timeToSaturationHours: number | null;
}

// Forecast strategy interface (pluggable)
export interface ForecastStrategy {
  project(endpoint: EndpointStats, windowMinutes: number, history: readonly CapacitySnapshot[]): { projectedCallRate: number; confidence: number };
}

class DefaultForecastStrategy implements ForecastStrategy {
  private multiplier: number;
  constructor(multiplier = 1.2) {
    this.multiplier = multiplier;
  }

  project(endpoint: EndpointStats, windowMinutes: number, history: readonly CapacitySnapshot[]): { projectedCallRate: number; confidence: number } {
    const current = Math.max(0, Number(endpoint.callCount || 0));
    if (history.length === 0) {
      return { projectedCallRate: Math.round(current * this.multiplier), confidence: 0.35 };
    }

    const recentTraffic = history.slice(-6).map((snapshot) => snapshot.metrics.totalCalls);
    const first = recentTraffic[0] ?? current;
    const last = recentTraffic[recentTraffic.length - 1] ?? current;
    const slope = recentTraffic.length > 1 ? (last - first) / Math.max(1, recentTraffic.length - 1) : 0;
    const windowRatio = Math.max(1, Math.round(windowMinutes / 10));
    const projected = Math.max(current, Math.round(last + slope * windowRatio));
    const confidence = Math.min(0.95, 0.35 + Math.min(0.4, history.length * 0.05) + (Math.abs(slope) < Math.max(1, current * 0.1) ? 0.1 : 0));

    return { projectedCallRate: projected, confidence };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Capacity Planner Agent
// ════════════════════════════════════════════════════════════════════════════════

export class CapacityPlannerAgent {
  private baseUrl: string;
  private pollInterval: number = 600_000; // 10 minutes default
  private _isRunning = false;
  private pollTimer?: NodeJS.Timeout;

  public get isRunning(): boolean {
    return this._isRunning;
  }

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
  private lastRecommendationState: Map<string, 'none' | 'monitor' | 'scale_up' | 'scale_down'> = new Map();
  private endpointCallHistory: Map<string, number> = new Map();

  // Threshold & Configuration
  private thresholds: CapacityPlannerThresholds = {
    hotspotCallThreshold: 50_000, // calls in period = considered hot
    bottleneckDegradationThreshold: 50, // latency increase % from baseline
    scalingCallThreshold: 100_000, // when to recommend scaling
    forecastWindow: 60, // minutes ahead to forecast
  };
  private windowInfo: CapacityWindowInfo = {
    windowMinutes: 10,
    isCumulative: true,
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
    if (this._isRunning) {
      logger.warn('[CAPACITY_PLANNER] Agent already running');
      return;
    }

    logger.info('[CAPACITY_PLANNER] Starting capacity planner agent', {
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
    const recent = this.capacitySnapshots.filter((s) => s.metrics.timestamp.getTime() > cutoff);

    if (recent.length === 0) {
      return { avgCallRate: 0, peakCallRate: 0, trend: 'stable' };
    }

    const windowMinutes = this.windowInfo.windowMinutes || 10;
    const isCumulative = this.windowInfo.isCumulative;

    const callRates = recent.reduce<number[]>((rates, snapshot, index) => {
      const previous = recent[index - 1];
      if (!previous) {
        return rates;
      }

      const previousCalls = Number(previous.metrics.totalCalls || 0);
      const currentCalls = Number(snapshot.metrics.totalCalls || 0);
      const elapsedMinutes = Math.max(1, (snapshot.metrics.timestamp.getTime() - previous.metrics.timestamp.getTime()) / 60_000);
      const windowCalls = isCumulative ? Math.max(0, currentCalls - previousCalls) : currentCalls;
      const normalizedMinutes = Math.max(1, Math.min(windowMinutes, elapsedMinutes));
      rates.push(windowCalls > 0 ? windowCalls / normalizedMinutes : 0);
      return rates;
    }, []);
    const avgCallRate = callRates.length > 0 ? callRates.reduce((a, b) => a + b, 0) / callRates.length : 0;
    const peakCallRate = callRates.length > 0 ? Math.max(...callRates) : 0;

    // Detect trend
    const firstHalf = callRates.slice(0, Math.floor(callRates.length / 2)).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(callRates.length / 2));
    const secondHalf = callRates.slice(Math.floor(callRates.length / 2)).reduce((a, b) => a + b, 0) / Math.max(1, callRates.length - Math.floor(callRates.length / 2));
    let trend: 'stable' | 'increasing' | 'decreasing' = 'stable';
    if (secondHalf > firstHalf * 1.1) trend = 'increasing';
    if (secondHalf < firstHalf * 0.9) trend = 'decreasing';

    return { avgCallRate: Math.round(avgCallRate), peakCallRate: Math.round(peakCallRate), trend };
  }

  public getCapacityForecast(): {
    generatedAt: string;
    currentCapacity: CapacitySnapshot | null;
    recommendations: ScalingRecommendation[];
    forecastWindowMinutes: number;
  } {
    return {
      generatedAt: new Date().toISOString(),
      currentCapacity: this.getCurrentCapacity(),
      recommendations: this.getScalingRecommendations('scale_up'),
      forecastWindowMinutes: this.thresholds.forecastWindow,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Core Polling Logic
  // ════════════════════════════════════════════════════════════════════════════════

  private async pollOnce(): Promise<void> {
    // Respect pause due to consecutive failures
    if (this.pauseUntil && Date.now() < this.pauseUntil) {
      logger.warn('[CAPACITY_PLANNER] Poll paused until', { pausedUntil: new Date(this.pauseUntil).toISOString() });
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

        const metrics: CapacityMetrics = {
          timestamp: new Date(),
          totalCalls: Number(summary.totalCalls || 0),
          avgLatency: Number(summary.avgLatency || 0),
          errorCount: Number(summary.errorCount || 0),
          errorRate: Number(summary.errorRate || 0),
          cpuPressure: Number(summary.cpuPressure || 0),
          memoryPressure: Number(summary.memoryPressure || 0),
          queuePressure: Number(summary.queuePressure || 0),
          workerSaturation: Number(summary.workerSaturation || 0),
          eventLoopLagMs: Number(summary.eventLoopLagMs || 0),
          endpointCount: Array.isArray(endpoints) ? endpoints.length : 0,
          hotEndpointCount: this.findHotEndpoints(endpoints).length,
          bottleneckCount: this.detectBottlenecks(endpoints).length,
        };

        const endpointUsage = this.getEndpointUsage(endpoints);
        const snapshot: CapacitySnapshot = {
          metrics,
          assessment: this.buildAssessment(metrics),
          hotEndpoints: this.findHotEndpoints(endpoints, endpointUsage),
          bottlenecks: this.detectBottlenecks(endpoints, endpointUsage),
        };

        this.storeSnapshot(snapshot);
        await this.analyzeCapacity(snapshot, endpoints, endpointUsage);

        // success
        this.consecutiveFailures = 0;
        return;
      } catch (err) {
        lastError = err;
        attempt += 1;
        const waitMs = 500 * Math.pow(2, attempt);
        logger.warn(`[CAPACITY_PLANNER] Poll attempt ${attempt} failed — retrying in ${waitMs}ms`, {
          error: err instanceof Error ? err.message : String(err),
        });
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

  private buildAssessment(metrics: CapacityMetrics): CapacityAssessment {
    const saturationScore = Math.min(100, Math.round(100 - (metrics.cpuPressure * 0.35) - (metrics.memoryPressure * 0.25) - (metrics.queuePressure * 0.2) - (metrics.workerSaturation * 0.2)));
    const errorPressure = metrics.errorRate > 0 ? Math.min(40, metrics.errorRate * 2) : 0;
    const latencyPressure = metrics.avgLatency > 0 ? Math.min(30, metrics.avgLatency / 50) : 0;
    const lagPressure = metrics.eventLoopLagMs > 0 ? Math.min(20, metrics.eventLoopLagMs / 10) : 0;
    const healthScore = Math.max(0, Math.min(100, saturationScore - errorPressure - latencyPressure - lagPressure));

    let healthState: CapacityAssessment['healthState'] = 'healthy';
    if (healthScore < 45) healthState = 'critical';
    else if (healthScore < 70) healthState = 'warning';
    else if (this.capacitySnapshots.length > 0) healthState = 'recovering';

    let trend: CapacityAssessment['trend'] = 'stable';
    const previous = this.capacitySnapshots[this.capacitySnapshots.length - 1];
    if (previous) {
      const elapsedMinutes = Math.max(1, (metrics.timestamp.getTime() - previous.metrics.timestamp.getTime()) / 60_000);
      const growth = Math.max(0, metrics.totalCalls - previous.metrics.totalCalls);
      const recentRate = growth > 0 ? growth / elapsedMinutes : 0;
      const previousDelta = Math.max(0, previous.metrics.totalCalls - (this.capacitySnapshots[this.capacitySnapshots.length - 2]?.metrics.totalCalls || 0));
      const previousElapsedMinutes = Math.max(1, (previous.metrics.timestamp.getTime() - (this.capacitySnapshots[this.capacitySnapshots.length - 2]?.metrics.timestamp.getTime() || previous.metrics.timestamp.getTime())) / 60_000);
      const previousRate = previousDelta > 0 ? previousDelta / previousElapsedMinutes : 0;
      if (healthState === 'critical') trend = 'critical';
      else if (recentRate > previousRate * 1.2) trend = 'degrading';
      else if (healthState === 'recovering') trend = 'recovering';
      else if (healthState === 'healthy' && previous.assessment.healthState !== 'healthy') trend = 'healthy';
    }

    const confidence = Math.min(0.95, 0.35 + Math.min(0.4, this.capacitySnapshots.length * 0.05));

    return {
      healthState,
      healthScore,
      trend,
      confidence,
      saturationScore,
    };
  }

  private getEndpointUsage(endpoints: EndpointStats[]): Map<string, number> {
    const usage = new Map<string, number>();
    endpoints.forEach((endpoint) => {
      const key = this.getEndpointKey(endpoint);
      const previous = this.endpointCallHistory.get(key) ?? 0;
      const current = Number(endpoint.callCount || 0);
      usage.set(key, Math.max(0, current - previous));
    });

    endpoints.forEach((endpoint) => {
      this.endpointCallHistory.set(this.getEndpointKey(endpoint), Number(endpoint.callCount || 0));
    });

    return usage;
  }

  private getEndpointKey(endpoint: EndpointStats): string {
    return `${endpoint.method} ${endpoint.path}`;
  }

  private findHotEndpoints(endpoints: EndpointStats[], endpointUsage?: Map<string, number>): Array<{ path: string; method: string; callCount: number }> {
    return endpoints
      .filter((endpoint) => {
        const key = this.getEndpointKey(endpoint);
        const recentCalls = endpointUsage?.get(key) ?? this.getEndpointUsage([endpoint]).get(key) ?? 0;
        return recentCalls >= this.thresholds.hotspotCallThreshold;
      })
      .map((endpoint) => {
        const key = this.getEndpointKey(endpoint);
        const recentCalls = endpointUsage?.get(key) ?? this.getEndpointUsage([endpoint]).get(key) ?? 0;
        return { path: endpoint.path, method: endpoint.method, callCount: recentCalls };
      })
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 20);
  }

  private detectBottlenecks(endpoints: EndpointStats[], endpointUsage?: Map<string, number>): Array<{ path: string; reason: string; severity: 'medium' | 'high' }> {
    const bottlenecks: Array<{ path: string; reason: string; severity: 'medium' | 'high' }> = [];

    endpoints.forEach((endpoint) => {
      const callCount = endpointUsage?.get(this.getEndpointKey(endpoint)) ?? 0;
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

  private async analyzeCapacity(snapshot: CapacitySnapshot, endpoints: EndpointStats[], endpointUsage?: Map<string, number>): Promise<void> {
    const scalingNeeds = this.generateScalingRecommendations(endpoints, snapshot, endpointUsage);

    if (scalingNeeds.length > 0) {
      logger.info('[CAPACITY_PLANNER] Scaling recommendations generated:', {
        count: scalingNeeds.length,
        scaleUp: scalingNeeds.filter((r) => r.recommendedAction === 'scale_up').length,
      });

      const nextRecommendations = scalingNeeds.filter((recommendation) => {
        const previousState = this.lastRecommendationState.get(recommendation.endpoint);
        return previousState !== recommendation.recommendedAction;
      });

      if (nextRecommendations.length > 0) {
        this.recommendationHistory.push(...nextRecommendations);
        if (this.recommendationHistory.length > this.MAX_RECOMMENDATIONS) {
          this.recommendationHistory = this.recommendationHistory.slice(-this.MAX_RECOMMENDATIONS);
        }

        nextRecommendations.forEach((recommendation) => {
          this.lastRecommendationState.set(recommendation.endpoint, recommendation.recommendedAction);
        });

        const critical = nextRecommendations.filter((r) => r.recommendedAction === 'scale_up' && r.confidence >= 0.75);
        if (critical.length > 0) {
          try {
            await this.sendSlackNotification(critical);
          } catch (err) {
            logger.error('[CAPACITY_PLANNER] Slack notification failed:', err instanceof Error ? err.message : err);
          }
        }
      }
    }

    logger.debug('[CAPACITY_PLANNER] Capacity snapshot:', {
      totalCalls: snapshot.metrics.totalCalls,
      hotEndpoints: snapshot.hotEndpoints.length,
      bottlenecks: snapshot.bottlenecks.length,
      avgLatency: Math.round(snapshot.metrics.avgLatency),
      healthScore: snapshot.assessment.healthScore,
    });
  }

  private generateScalingRecommendations(endpoints: EndpointStats[], snapshot: CapacitySnapshot, endpointUsage?: Map<string, number>): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];
    const history = this.capacitySnapshots;

    endpoints
      .filter((endpoint) => {
        const key = this.getEndpointKey(endpoint);
        const recentCalls = endpointUsage?.get(key) ?? 0;
        return recentCalls >= this.thresholds.scalingCallThreshold;
      })
      .forEach((endpoint) => {
        const key = this.getEndpointKey(endpoint);
        const recentCalls = endpointUsage?.get(key) ?? 0;
        const { projectedCallRate, confidence } = this.forecastStrategy.project({ ...endpoint, callCount: recentCalls }, this.thresholds.forecastWindow, history);
        const avgLatency = Number(endpoint.avgLatency || 0);
        const saturation = Math.min(100, Math.round((projectedCallRate / Math.max(1, this.thresholds.scalingCallThreshold)) * 100));
        const timeToSaturationHours = projectedCallRate > 0 ? Math.max(0, Math.round((this.thresholds.scalingCallThreshold * 2 - projectedCallRate) / Math.max(1, Math.round(projectedCallRate / Math.max(1, this.capacitySnapshots.length || 1))) / 24)) : null;

        let recommendedAction: 'none' | 'monitor' | 'scale_up' | 'scale_down' = 'none';
        let reason = 'Stable performance';
        let risk: ScalingRecommendation['risk'] = 'low';
        let capacityScore = 100;

        if (snapshot.assessment.healthState === 'critical' || saturation > 140 || avgLatency > 1200) {
          recommendedAction = 'scale_up';
          reason = 'Projected demand exceeds safe operating range';
          risk = 'high';
          capacityScore = Math.max(20, 100 - saturation);
        } else if (snapshot.assessment.healthState === 'warning' || saturation > 120 || avgLatency > 900) {
          recommendedAction = 'monitor';
          reason = 'Demand is trending upward and should be watched';
          risk = 'medium';
          capacityScore = Math.max(40, 100 - saturation + 10);
        } else if (saturation < 80 && snapshot.assessment.healthState === 'recovering') {
          recommendedAction = 'scale_down';
          reason = 'Capacity pressure has recovered';
          risk = 'low';
          capacityScore = 90;
        }

        if (recommendedAction !== 'none') {
          recommendations.push({
            endpoint: `${endpoint.method} ${endpoint.path}`,
            currentCallRate: Math.round(recentCalls),
            projectedCallRate: Math.round(projectedCallRate),
            recommendedAction,
            confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
            reason,
            estimatedLatencyIncrease: Math.round((avgLatency * 0.3) / 100) * 100,
            risk,
            capacityScore,
            timeToSaturationHours,
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
