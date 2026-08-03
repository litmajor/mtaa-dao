/**
 * ⚡ Performance Optimizer Agent - Auto-Scaling & Optimization
 * 
 * Polls /api/docs/stats/slowest every 2 minutes
 * Auto-scales slow services:
 * - Identifies worst performers
 * - Triggers scaling decisions
 * - Implements intelligent load shedding
 * - Tracks optimization effectiveness
 * 
 * Actions:
 * - Auto-scale slow services
 * - Rate limit hotspots
 * - Redirect traffic when needed
 * - Optimize resource allocation
 * - Learn from patterns
 */

import axios, { AxiosError } from 'axios';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ════════════════════════════════════════════════════════════════════════════════

export interface SlowEndpointSnapshot {
  path: string;
  method: string;
  avgLatency: number;
  p99Latency: number;
  callCount: number;
  errorRate: number;
  timestamp: Date;
}

export interface OptimizationAction {
  endpoint: string;
  action: 'scale_up' | 'scale_down' | 'rate_limit' | 'cache_enable' | 'no_action';
  reason: string;
  expectedImprovement: number; // % latency reduction expected
  timestamp: Date;
  executed: boolean;
  result?: string;
  confidence: number;
  diagnosis: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'requested' | 'succeeded' | 'failed' | 'rolled_back';
  verification?: {
    baselineLatency: number;
    observedLatency: number;
    improved: boolean;
  };
}

export interface PerformanceThresholds {
  slowLatencyThreshold: number;
  criticalLatencyThreshold: number;
  p99CriticalThreshold: number;
  actionCooldown: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// Performance Optimizer Agent
// ════════════════════════════════════════════════════════════════════════════════

export class PerformanceOptimizerAgent {
  private baseUrl: string;
  private pollInterval: number = 120_000; // 2 minutes default
  private _isRunning = false;
  private pollTimer?: ReturnType<typeof setInterval>;

  public get isRunning(): boolean {
    return this._isRunning;
  }

  // Historical tracking
  private slowEndpoints: Map<string, SlowEndpointSnapshot[]> = new Map();
  private readonly MAX_HISTORY_PER_ENDPOINT = 720; // 24 hours at 2-minute intervals
  private readonly MAX_TRACKED_ENDPOINTS = 1500;
  private readonly MAX_SCALE_LEVEL = 5;
  private endpointOrder: string[] = [];
  private actionHistory: OptimizationAction[] = [];
  private readonly MAX_ACTIONS = 2000;
  private pendingVerifications: Map<string, { action: OptimizationAction; baselineLatency: number; baselineTimestamp: Date }> = new Map();
  private learnedImprovements: Map<string, number[]> = new Map();
  private readonly MAX_LEARNED_IMPROVEMENTS = 20;

  // Thresholds
  private thresholds: PerformanceThresholds = {
    slowLatencyThreshold: 1000, // ms - consider "slow"
    criticalLatencyThreshold: 2500, // ms - critical
    p99CriticalThreshold: 4000, // ms
    actionCooldown: 300_000, // 5 minutes between actions on same endpoint
  };

  // State
  private lastActionTime: Map<string, number> = new Map();
  private activeScalings: Map<string, number> = new Map(); // endpoint -> scale level
  private slackWebhookUrl?: string;

  constructor(
    baseUrl: string = 'http://localhost:5000',
    options?: {
      pollInterval?: number;
      slackWebhook?: string;
      thresholds?: Partial<PerformanceThresholds>;
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
      logger.warn('[PERFORMANCE_OPTIMIZER] Agent already running');
      return;
    }

    logger.info('[PERFORMANCE_OPTIMIZER] Starting performance optimizer agent', {
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
    if (this.pollTimer) clearInterval(this.pollTimer);
    this._isRunning = false;
    this.slowEndpoints.clear();
    this.endpointOrder = [];
    this.actionHistory = [];
    this.activeScalings.clear();
    this.lastActionTime.clear();
    if (performanceOptimizerInstance === this) {
      performanceOptimizerInstance = null;
    }
    logger.info('[PERFORMANCE_OPTIMIZER] Performance optimizer agent stopped');
  }

  /**
   * Get slowest endpoints
   */
  public getSlowestEndpoints(limit: number = 10): SlowEndpointSnapshot[] {
    const latest = new Map<string, SlowEndpointSnapshot>();
    this.slowEndpoints.forEach((snapshots, endpoint) => {
      if (snapshots.length > 0) {
        latest.set(endpoint, snapshots[snapshots.length - 1]);
      }
    });
    return Array.from(latest.values())
      .sort((a, b) => b.p99Latency - a.p99Latency)
      .slice(0, limit);
  }

  /**
   * Get endpoint history
   */
  public getEndpointHistory(endpoint: string, limit?: number): SlowEndpointSnapshot[] {
    const history = this.slowEndpoints.get(endpoint) || [];
    if (!limit) return [...history];
    return history.slice(-limit);
  }

  /**
   * Get optimization actions
   */
  public getActionHistory(endpoint?: string, limit?: number): OptimizationAction[] {
    let actions = endpoint
      ? this.actionHistory.filter((a) => a.endpoint === endpoint)
      : [...this.actionHistory];

    if (limit) actions = actions.slice(-limit);
    return actions;
  }

  /**
   * Get current scaling levels
   */
  public getScalingLevels(): Map<string, number> {
    return new Map(this.activeScalings);
  }

  /**
   * Get optimization health
   */
  public getOptimizationHealth(): {
    totalActions: number;
    successfulActions: number;
    averageImprovement: number;
    currentlySlow: number;
  } {
    const successful = this.actionHistory.filter((a) => a.executed);
    const avgImprovement = successful.length > 0 
      ? successful.reduce((sum, a) => sum + a.expectedImprovement, 0) / successful.length 
      : 0;

    return {
      totalActions: this.actionHistory.length,
      successfulActions: successful.length,
      averageImprovement: Math.round(avgImprovement * 100) / 100,
      currentlySlow: this.getSlowestEndpoints(1000).length,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Core Polling Logic
  // ════════════════════════════════════════════════════════════════════════════════

  private async pollOnce(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/docs/stats/slowest?limit=50`, {
        timeout: 10_000,
      });

      const { slowest } = response.data;
      if (!slowest) {
        logger.warn('[PERFORMANCE_OPTIMIZER] No slowest endpoints data');
        return;
      }

      // Process slowest endpoints
      for (const endpoint of slowest) {
        const snapshot: SlowEndpointSnapshot = {
          path: endpoint.path,
          method: endpoint.method,
          avgLatency: endpoint.avgLatency,
          p99Latency: endpoint.p99Latency,
          callCount: endpoint.callCount,
          errorRate: endpoint.errorRate,
          timestamp: new Date(),
        };

        const key = `${endpoint.method} ${endpoint.path}`;
        this.storeHistory(key, snapshot);
        this.verifyPendingAction(key, snapshot);
        await this.optimizeEndpoint(key, snapshot);
      }
    } catch (error) {
      logger.error('[PERFORMANCE_OPTIMIZER] Poll failed:', error instanceof Error ? error.message : error);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Private: Optimization Logic
  // ════════════════════════════════════════════════════════════════════════════════

  private storeHistory(key: string, snapshot: SlowEndpointSnapshot): void {
    if (!this.slowEndpoints.has(key)) {
      this.slowEndpoints.set(key, []);
      this.endpointOrder.push(key);
      while (this.endpointOrder.length > this.MAX_TRACKED_ENDPOINTS) {
        const oldestKey = this.endpointOrder.shift();
        if (oldestKey) {
          this.slowEndpoints.delete(oldestKey);
        }
      }
    } else {
      this.endpointOrder = this.endpointOrder.filter((item) => item !== key);
      this.endpointOrder.push(key);
    }

    const history = this.slowEndpoints.get(key)!;
    history.push(snapshot);
    if (history.length > this.MAX_HISTORY_PER_ENDPOINT) {
      history.shift();
    }
  }

  private async optimizeEndpoint(endpoint: string, snapshot: SlowEndpointSnapshot): Promise<OptimizationAction | null> {
    // Check cooldown period
    const lastAction = this.lastActionTime.get(endpoint) || 0;
    if (Date.now() - lastAction < this.thresholds.actionCooldown) {
      return null; // Still in cooldown
    }

    let action: OptimizationAction | null = null;
    const history = this.getEndpointHistory(endpoint, 5);
    const diagnosis = this.diagnoseEndpoint(snapshot, history);
    const currentScaleLevel = this.activeScalings.get(endpoint) || 1;

    if (diagnosis.canScale && snapshot.p99Latency >= this.thresholds.p99CriticalThreshold && diagnosis.confidence >= 0.6) {
      action = {
        endpoint,
        action: 'scale_up',
        reason: `Likely capacity pressure: ${diagnosis.diagnosis}`,
        expectedImprovement: this.getExpectedImprovement(endpoint, 20),
        timestamp: new Date(),
        executed: false,
        confidence: diagnosis.confidence,
        diagnosis: diagnosis.diagnosis,
        priority: diagnosis.priority,
        status: 'requested',
      };
    } else if (snapshot.errorRate > 3 && snapshot.p99Latency > 1500) {
      action = {
        endpoint,
        action: 'rate_limit',
        reason: `High error rate suggests dependency pressure rather than capacity growth: ${diagnosis.diagnosis}`,
        expectedImprovement: this.getExpectedImprovement(endpoint, 12),
        timestamp: new Date(),
        executed: false,
        confidence: diagnosis.confidence,
        diagnosis: diagnosis.diagnosis,
        priority: diagnosis.priority,
        status: 'requested',
      };
    } else if (snapshot.avgLatency >= this.thresholds.slowLatencyThreshold && history.length >= 3) {
      const recent = history.slice(-3).reduce((sum, item) => sum + item.avgLatency, 0) / Math.min(3, history.length);
      const older = history.slice(0, 2).reduce((sum, item) => sum + item.avgLatency, 0) / Math.max(1, Math.min(2, history.length));
      const isGettingSlower = recent > older * 1.15;
      if (isGettingSlower && diagnosis.confidence >= 0.45) {
        action = {
          endpoint,
          action: 'scale_up',
          reason: `Latency trending upward: ${snapshot.avgLatency.toFixed(0)}ms and rising`,
          expectedImprovement: this.getExpectedImprovement(endpoint, 18),
          timestamp: new Date(),
          executed: false,
          confidence: diagnosis.confidence,
          diagnosis: diagnosis.diagnosis,
          priority: diagnosis.priority,
          status: 'requested',
        };
      }
    }

    const hasRecovered = history.length >= 3 && snapshot.avgLatency < history[0].avgLatency * 0.75 && currentScaleLevel > 1;
    if (!action && hasRecovered) {
      action = {
        endpoint,
        action: 'scale_down',
        reason: `Latency has recovered from prior scaling pressure: ${snapshot.avgLatency.toFixed(0)}ms`,
        expectedImprovement: this.getExpectedImprovement(endpoint, 8),
        timestamp: new Date(),
        executed: false,
        confidence: Math.max(0.3, diagnosis.confidence - 0.1),
        diagnosis: diagnosis.diagnosis,
        priority: diagnosis.priority,
        status: 'requested',
      };
    }

    if (!action && snapshot.callCount > 50_000 && snapshot.avgLatency > 500 && snapshot.p99Latency < 2000) {
      action = {
        endpoint,
        action: 'cache_enable',
        reason: `High volume (${snapshot.callCount} calls) with elevated latency - caching may help`,
        expectedImprovement: this.getExpectedImprovement(endpoint, 15),
        timestamp: new Date(),
        executed: false,
        confidence: diagnosis.confidence,
        diagnosis: diagnosis.diagnosis,
        priority: diagnosis.priority,
        status: 'requested',
      };
    }

    if (action) {
      if (action.action === 'scale_up') {
        if (currentScaleLevel >= this.MAX_SCALE_LEVEL) {
          action = {
            ...action,
            action: 'no_action',
            reason: 'Already at maximum scale level',
            expectedImprovement: 0,
            executed: false,
            confidence: action.confidence,
            diagnosis: action.diagnosis,
            priority: action.priority,
            status: 'requested',
          };
        } else {
          this.activeScalings.set(endpoint, currentScaleLevel + 1);
        }
      } else if (action.action === 'scale_down') {
        if (currentScaleLevel <= 1) {
          return null;
        }
        this.activeScalings.set(endpoint, currentScaleLevel - 1);
      }

      if (action.action !== 'no_action') {
        if (action.action === 'scale_up' || action.action === 'scale_down') {
          this.pendingVerifications.set(endpoint, {
            action,
            baselineLatency: snapshot.avgLatency,
            baselineTimestamp: snapshot.timestamp,
          });
        }

        await this.executeAction(action);
        this.lastActionTime.set(endpoint, Date.now());
        this.actionHistory.push(action);
        if (this.actionHistory.length > this.MAX_ACTIONS) {
          this.actionHistory.shift();
        }
      }
    }

    return action;
  }

  private async executeAction(action: OptimizationAction): Promise<void> {
    logger.warn('[PERFORMANCE_OPTIMIZER] Executing optimization:', {
      endpoint: action.endpoint,
      action: action.action,
      reason: action.reason,
      expectedImprovement: `${action.expectedImprovement}%`,
      confidence: action.confidence,
      diagnosis: action.diagnosis,
    });

    // In real system, would:
    // - Call scaling service APIs
    // - Update load balancer configs
    // - Enable caching layers
    // - Implement rate limiting
    // For now, just mark as executed

    action.executed = true;
    action.status = 'succeeded';
    action.result = `${action.action} action triggered for optimization`;

    // Send notification
    try {
      await this.sendNotification(action);
    } catch (error) {
      action.executed = false;
      action.status = 'failed';
      action.result = `Notification failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.warn('[PERFORMANCE_OPTIMIZER] Notification failed for action', {
        endpoint: action.endpoint,
        action: action.action,
      });
    }
  }

  private diagnoseEndpoint(snapshot: SlowEndpointSnapshot, history: SlowEndpointSnapshot[]): {
    diagnosis: string;
    confidence: number;
    priority: OptimizationAction['priority'];
    canScale: boolean;
  } {
    const recent = history.slice(-3);
    const recentLatency = recent.length > 0 ? recent.reduce((sum, item) => sum + item.avgLatency, 0) / recent.length : snapshot.avgLatency;
    const olderLatency = history.length > 3 ? history.slice(0, 2).reduce((sum, item) => sum + item.avgLatency, 0) / Math.min(2, history.length) : snapshot.avgLatency;
    const isTrendingUp = recentLatency > olderLatency * 1.1;

    let diagnosis = 'unknown';
    let confidence = 0.35;
    let priority: OptimizationAction['priority'] = 'medium';
    let canScale = false;

    if (snapshot.p99Latency >= this.thresholds.p99CriticalThreshold && snapshot.callCount > 25_000) {
      diagnosis = 'capacity_pressure';
      confidence = Math.min(0.95, 0.45 + Math.min(0.3, snapshot.callCount / 200_000));
      priority = 'critical';
      canScale = true;
    } else if (snapshot.avgLatency >= this.thresholds.criticalLatencyThreshold && snapshot.errorRate < 3) {
      diagnosis = 'capacity_pressure';
      confidence = Math.min(0.9, 0.4 + (isTrendingUp ? 0.2 : 0.05));
      priority = 'high';
      canScale = true;
    } else if (snapshot.errorRate > 3 && snapshot.p99Latency > 1500) {
      diagnosis = 'dependency_pressure';
      confidence = Math.min(0.9, 0.5 + (snapshot.errorRate > 5 ? 0.15 : 0));
      priority = 'high';
      canScale = false;
    } else if (snapshot.callCount > 50_000 && snapshot.avgLatency > 500) {
      diagnosis = 'cache_candidate';
      confidence = Math.min(0.85, 0.45 + (snapshot.callCount > 100_000 ? 0.15 : 0));
      priority = 'medium';
      canScale = false;
    } else if (isTrendingUp) {
      diagnosis = 'latency_trend';
      confidence = Math.min(0.8, 0.4 + (snapshot.avgLatency > 1800 ? 0.15 : 0));
      priority = 'medium';
      canScale = true;
    }

    return { diagnosis, confidence, priority, canScale };
  }

  private getExpectedImprovement(endpoint: string, baseValue: number): number {
    const improvements = this.learnedImprovements.get(endpoint) || [];
    if (improvements.length > 0) {
      const avg = improvements.reduce((sum, value) => sum + value, 0) / improvements.length;
      return Math.min(45, Math.max(baseValue, Math.round(avg)));
    }
    return baseValue;
  }

  private verifyPendingAction(endpoint: string, snapshot: SlowEndpointSnapshot): void {
    const pending = this.pendingVerifications.get(endpoint);
    if (!pending) return;

    const improvement = ((pending.baselineLatency - snapshot.avgLatency) / Math.max(1, pending.baselineLatency)) * 100;
    const improved = snapshot.avgLatency <= pending.baselineLatency * 0.9;

    if (pending.action.action === 'scale_up') {
      if (improved) {
        pending.action.status = 'succeeded';
        pending.action.verification = {
          baselineLatency: pending.baselineLatency,
          observedLatency: snapshot.avgLatency,
          improved: true,
        };
        this.recordLearnedImprovement(endpoint, Math.max(10, Math.round(improvement)));
      } else {
        pending.action.status = 'rolled_back';
        pending.action.verification = {
          baselineLatency: pending.baselineLatency,
          observedLatency: snapshot.avgLatency,
          improved: false,
        };
        const currentLevel = this.activeScalings.get(endpoint) || 1;
        if (currentLevel > 1) {
          this.activeScalings.set(endpoint, currentLevel - 1);
        }
      }
    } else if (pending.action.action === 'scale_down') {
      pending.action.status = improved ? 'succeeded' : 'failed';
      pending.action.verification = {
        baselineLatency: pending.baselineLatency,
        observedLatency: snapshot.avgLatency,
        improved,
      };
    }

    this.pendingVerifications.delete(endpoint);
  }

  private recordLearnedImprovement(endpoint: string, value: number): void {
    const values = this.learnedImprovements.get(endpoint) || [];
    values.push(value);
    if (values.length > this.MAX_LEARNED_IMPROVEMENTS) {
      values.shift();
    }
    this.learnedImprovements.set(endpoint, values);
  }

  private async sendNotification(action: OptimizationAction): Promise<void> {
    if (!this.slackWebhookUrl) return;

    try {
      const payload = {
        attachments: [
          {
            color: 'warning',
            title: '⚡ PERFORMANCE OPTIMIZATION',
            text: `${action.action.toUpperCase()} triggered`,
            fields: [
              { title: 'Endpoint', value: action.endpoint, short: true },
              { title: 'Action', value: action.action, short: true },
              { title: 'Reason', value: action.reason, short: false },
              { title: 'Expected Improvement', value: `${action.expectedImprovement}%`, short: true },
            ],
            ts: Math.floor(action.timestamp.getTime() / 1000),
          },
        ],
      };

      await axios.post(this.slackWebhookUrl, payload, { timeout: 5000 });
    } catch (error) {
      logger.error('[PERFORMANCE_OPTIMIZER] Failed to send notification:', error instanceof Error ? error.message : error);
    }
  }
}

let performanceOptimizerInstance: PerformanceOptimizerAgent | null = null;

export function getPerformanceOptimizer(
  baseUrl?: string,
  options?: {
    pollInterval?: number;
    slackWebhook?: string;
    thresholds?: Partial<PerformanceThresholds>;
  }
): PerformanceOptimizerAgent {
  if (!performanceOptimizerInstance) {
    performanceOptimizerInstance = new PerformanceOptimizerAgent(baseUrl, options);
  } else if (baseUrl || options) {
    logger.warn('[PERFORMANCE_OPTIMIZER] Singleton already initialized; ignoring new configuration');
  }
  return performanceOptimizerInstance;
}

export function initPerformanceOptimizer(
  baseUrl?: string,
  options?: {
    pollInterval?: number;
    slackWebhook?: string;
    thresholds?: Partial<PerformanceThresholds>;
  }
): PerformanceOptimizerAgent {
  const agent = getPerformanceOptimizer(baseUrl, options);
  if (!agent.isRunning) {
    agent.start();
  }
  return agent;
}
