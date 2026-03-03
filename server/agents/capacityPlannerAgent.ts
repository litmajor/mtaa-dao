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
  currentCallRate: number; // calls per minute
  projectedCallRate: number; // 1 hour from now
  recommendedAction: 'none' | 'monitor' | 'scale_up' | 'scale_down';
  confidence: number; // 0-1
  reason: string;
  estimatedLatencyIncrease: number; // ms
}

// ════════════════════════════════════════════════════════════════════════════════
// Capacity Planner Agent
// ════════════════════════════════════════════════════════════════════════════════

export class CapacityPlannerAgent {
  private baseUrl: string;
  private pollInterval: number = 600_000; // 10 minutes default
  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;

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

  constructor(
    baseUrl: string = 'http://localhost:5000',
    options?: {
      pollInterval?: number;
      slackWebhook?: string;
      thresholds?: Partial<CapacityPlannerThresholds>;
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
    try {
      const response = await axios.get(`${this.baseUrl}/api/docs/stats`, {
        timeout: 15_000,
      });

      const { summary, endpoints } = response.data;
      if (!summary || !endpoints) {
        logger.warn('[CAPACITY_PLANNER] Missing data in response');
        return;
      }

      // Create snapshot
      const snapshot: CapacitySnapshot = {
        timestamp: new Date(),
        totalCalls: summary.totalCalls,
        avgLatency: summary.avgLatency,
        errorCount: summary.errorCount || 0,
        errorRate: summary.errorRate || 0,
        hotEndpoints: this.findHotEndpoints(endpoints),
        bottlenecks: this.detectBottlenecks(endpoints),
      };

      // Store and analyze
      this.storeSnapshot(snapshot);
      await this.analyzeCapacity(snapshot, endpoints);
    } catch (error) {
      logger.error('[CAPACITY_PLANNER] Poll failed:', error instanceof Error ? error.message : error);
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

  private findHotEndpoints(endpoints: any[]): Array<{ path: string; method: string; callCount: number }> {
    return endpoints
      .filter((e) => e.callCount >= this.thresholds.hotspotCallThreshold)
      .map((e) => ({
        path: e.path,
        method: e.method,
        callCount: e.callCount,
      }))
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 20);
  }

  private detectBottlenecks(endpoints: any[]): Array<{ path: string; reason: string; severity: 'medium' | 'high' }> {
    const bottlenecks: Array<{ path: string; reason: string; severity: 'medium' | 'high' }> = [];

    endpoints.forEach((endpoint) => {
      // High latency with high volume
      if (endpoint.callCount > 10_000 && endpoint.avgLatency > 1000) {
        bottlenecks.push({
          path: endpoint.path,
          reason: `High latency (${endpoint.avgLatency.toFixed(0)}ms) with high volume (${endpoint.callCount} calls)`,
          severity: 'high',
        });
      }

      // High error rate with high volume
      if (endpoint.callCount > 10_000 && endpoint.errorRate > 5) {
        bottlenecks.push({
          path: endpoint.path,
          reason: `High error rate (${endpoint.errorRate.toFixed(1)}%) with high volume`,
          severity: 'high',
        });
      }

      // Error rate increase
      if (endpoint.errorRate > 3 && endpoint.callCount > 5_000) {
        bottlenecks.push({
          path: endpoint.path,
          reason: `Elevated error rate (${endpoint.errorRate.toFixed(1)}%) on medium-volume endpoint`,
          severity: 'medium',
        });
      }
    });

    return bottlenecks;
  }

  private async analyzeCapacity(snapshot: CapacitySnapshot, endpoints: any[]): Promise<void> {
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
    }

    // Log capacity summary every poll
    logger.debug('[CAPACITY_PLANNER] Capacity snapshot:', {
      totalCalls: snapshot.totalCalls,
      hotEndpoints: snapshot.hotEndpoints.length,
      bottlenecks: snapshot.bottlenecks.length,
      avgLatency: Math.round(snapshot.avgLatency),
    });
  }

  private generateScalingRecommendations(endpoints: any[]): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];

    endpoints
      .filter((e) => e.callCount >= this.thresholds.scalingCallThreshold)
      .forEach((endpoint) => {
        // Simulate forecast (in real system, use ML model)
        const projectedIncrease = 1.25; // 25% increase expected
        const projectedCallRate = endpoint.callCount * projectedIncrease;

        let recommendedAction: 'none' | 'monitor' | 'scale_up' | 'scale_down' = 'none';
        let confidence = 0.5;
        let reason = 'Stable performance';

        if (endpoint.avgLatency > 800 && projectedCallRate > this.thresholds.scalingCallThreshold * 1.5) {
          recommendedAction = 'scale_up';
          confidence = 0.85;
          reason = 'High latency with projected volume increase';
        } else if (projectedCallRate > this.thresholds.scalingCallThreshold * 2) {
          recommendedAction = 'scale_up';
          confidence = 0.75;
          reason = 'Projected 2x volume increase';
        } else if (endpoint.callCount > this.thresholds.scalingCallThreshold * 1.5 && endpoint.avgLatency > 600) {
          recommendedAction = 'monitor';
          confidence = 0.7;
          reason = 'Monitor for degradation';
        }

        if (recommendedAction !== 'none') {
          recommendations.push({
            endpoint: `${endpoint.method} ${endpoint.path}`,
            currentCallRate: Math.round(endpoint.callCount),
            projectedCallRate: Math.round(projectedCallRate),
            recommendedAction,
            confidence,
            reason,
            estimatedLatencyIncrease: Math.round((endpoint.avgLatency * 0.3) / 100) * 100, // Pessimistic estimate
          });
        }
      });

    return recommendations;
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
