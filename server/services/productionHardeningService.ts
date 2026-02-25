/**
 * Graph Propagation Production Hardening - Phase C
 * 
 * Features:
 * 1. Circuit Breaker (prevent feedback loops)
 * 2. Confidence Decay (stale data = lower confidence)
 * 3. Anomaly Detection (unusual cascade patterns)
 * 4. State Snapshots (rollback on anomalies)
 */

import { logger } from '../utils/logger';
import { graphPropagationEngine, GraphNode, PropagationDelta } from './graphPropagationEngine';
import { propagationMonitoringService } from './propagationMonitoringService';

// ════════════════════════════════════════════════════════════════════════════════
// 1️⃣ CIRCUIT BREAKER - Prevent Feedback Loops
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  // Trip if X cascades in Y milliseconds
  cascadeThreshold: number;        // e.g., 50 cascades
  timeWindowMs: number;           // e.g., 1000ms
  
  // Recovery
  openDurationMs: number;         // how long to stay open
  halfOpenTestCount: number;      // cascades to allow in half-open
  
  // Thresholds
  maxConfidenceFeedback: number;  // max confidence sum before trip
  maxNodesAffected: number;       // max nodes in single propagation
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  cascadeThreshold: 50,
  timeWindowMs: 1000,
  openDurationMs: 5000,
  halfOpenTestCount: 5,
  maxConfidenceFeedback: 100, // sum of confidences
  maxNodesAffected: 50,       // nodes modified per cycle
};

/**
 * Circuit breaker service
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private cascadeCounts: number[] = []; // sliding window
  private lastTrip: number | null = null;
  private halfOpenTests: number = 0;
  private config: CircuitBreakerConfig;
  
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }
  
  /**
   * Record a cascade event
   */
  recordCascade(confidenceSum: number, cascadeCount: number, nodeCount: number): boolean {
    const now = Date.now();
    
    // Add to sliding window
    this.cascadeCounts.push(now);
    
    // Remove old entries outside window
    this.cascadeCounts = this.cascadeCounts.filter(
      t => now - t < this.config.timeWindowMs
    );
    
    // Check trip conditions
    if (this.shouldTrip(confidenceSum, cascadeCount, nodeCount)) {
      this.trip();
      return false; // blocked
    }
    
    // Track half-open testing
    if (this.state === 'half-open') {
      this.halfOpenTests++;
      if (this.halfOpenTests >= this.config.halfOpenTestCount) {
        this.reset();
      }
    }
    
    return true; // allowed
  }
  
  /**
   * Check if should trip breaker
   */
  private shouldTrip(confidenceSum: number, cascadeCount: number, nodeCount: number): boolean {
    // Trip if:
    // 1. Too many cascades in time window
    if (this.cascadeCounts.length > this.config.cascadeThreshold) {
      logger.warn(`[CIRCUIT BREAKER] Trip: ${this.cascadeCounts.length} cascades in ${this.config.timeWindowMs}ms`);
      return true;
    }
    
    // 2. Confidence feedback too high (potential loop)
    if (confidenceSum > this.config.maxConfidenceFeedback) {
      logger.warn(`[CIRCUIT BREAKER] Trip: confidence sum ${confidenceSum.toFixed(1)} exceeds ${this.config.maxConfidenceFeedback}`);
      return true;
    }
    
    // 3. Too many nodes affected (cascade storm)
    if (nodeCount > this.config.maxNodesAffected) {
      logger.warn(`[CIRCUIT BREAKER] Trip: ${nodeCount} nodes affected (max ${this.config.maxNodesAffected})`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Trip the circuit breaker
   */
  private trip(): void {
    if (this.state !== 'open') {
      const previousState = this.state;
      this.state = 'open';
      this.lastTrip = Date.now();
      this.halfOpenTests = 0;
      
      propagationMonitoringService.recordEvent({
        type: 'circuit_breaker_triggered',
        timestamp: Date.now(),
        details: {
          previousState,
          newState: 'open',
          cascadeCount: this.cascadeCounts.length,
          reason: 'threshold_exceeded',
        },
        severity: 'critical',
      });
    }
  }
  
  /**
   * Attempt to reset (move to half-open)
   */
  reset(): void {
    this.state = 'half-open';
    this.halfOpenTests = 0;
    logger.info(`[CIRCUIT BREAKER] Transitioning to half-open (testing recovery)`);
  }
  
  /**
   * Full reset (closed)
   */
  close(): void {
    this.state = 'closed';
    this.cascadeCounts = [];
    this.halfOpenTests = 0;
    logger.info(`[CIRCUIT BREAKER] Reset to closed`);
  }
  
  /**
   * Check if propagation allowed
   */
  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if recovery time has passed
      if (this.lastTrip && Date.now() - this.lastTrip > this.config.openDurationMs) {
        this.reset();
        return false; // allow test in half-open
      }
      return true; // still blocked
    }
    return false; // not open, propagation allowed
  }
  
  getState(): CircuitBreakerState {
    return this.state;
  }
  
  getStats(): { state: CircuitBreakerState; cascadesInWindow: number; lastTripTime: number | null } {
    return {
      state: this.state,
      cascadesInWindow: this.cascadeCounts.length,
      lastTripTime: this.lastTrip,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// 2️⃣ CONFIDENCE DECAY - Stale Data = Lower Weight
// ════════════════════════════════════════════════════════════════════════════════

export interface ConfidenceDecayConfig {
  halfLifeMs: number;  // time for confidence to decay to 50%
  minimumConfidence: number; // floor value
}

export const DEFAULT_CONFIDENCE_DECAY_CONFIG: ConfidenceDecayConfig = {
  halfLifeMs: 60000,  // 1 minute
  minimumConfidence: 0.2,
};

/**
 * Calculate decayed confidence based on age
 */
export function calculateDecayedConfidence(
  originalConfidence: number,
  ageMs: number,
  config: ConfidenceDecayConfig = DEFAULT_CONFIDENCE_DECAY_CONFIG
): number {
  // Exponential decay: confidence = original * (0.5 ^ (age / halfLife))
  const halfLives = ageMs / config.halfLifeMs;
  const decayedConfidence = originalConfidence * Math.pow(0.5, halfLives);
  
  return Math.max(decayedConfidence, config.minimumConfidence);
}

/**
 * Apply confidence decay to all nodes
 */
export function applyConfidenceDecay(
  nodes: GraphNode[],
  config?: ConfidenceDecayConfig
): { nodesUpdated: number; avgDecay: number } {
  const c = config || DEFAULT_CONFIDENCE_DECAY_CONFIG;
  let totalDecay = 0;
  let decayCount = 0;
  
  const now = Date.now();
  
  for (const node of nodes) {
    const ageMs = now - node.propagationState.updatedAt;
    
    // Only apply decay if data is > 10 seconds old
    if (ageMs > 10000) {
      const originalConfidence = node.propagationState.signalConfidence;
      const decayedConfidence = calculateDecayedConfidence(originalConfidence, ageMs, c);
      
      node.propagationState.signalConfidence = decayedConfidence;
      node.propagationState.dataFreshness = calculateDecayedConfidence(1, ageMs, c);
      
      totalDecay += (originalConfidence - decayedConfidence);
      decayCount++;
    }
  }
  
  return {
    nodesUpdated: decayCount,
    avgDecay: decayCount > 0 ? totalDecay / decayCount : 0,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// 3️⃣ ANOMALY DETECTION - Unusual Cascade Patterns
// ════════════════════════════════════════════════════════════════════════════════

export interface AnomalyThresholds {
  unexpectedCascadeTarget: number;    // cascade to node without edge
  tooManyHighConfidenceCascades: number; // > X high-confidence cascades
  correlationUniverse: number;        // > X nodes correlated exactly
  cascadeWithinCascade: number;       // recursive cascades
  signalFlipDuring: number;           // signal flipping rapidly
}

export const DEFAULT_ANOMALY_THRESHOLDS: AnomalyThresholds = {
  unexpectedCascadeTarget: 0.1,
  tooManyHighConfidenceCascades: 30,
  correlationUniverse: 20,
  cascadeWithinCascade: 2,
  signalFlipDuring: 3,
};

/**
 * Detect anomalies in cascade pattern
 */
export function detectAnomalies(
  sourceNode: string,
  cascadeCount: number,
  confidenceSum: number,
  nodesAffected: number[],
  thresholds: AnomalyThresholds = DEFAULT_ANOMALY_THRESHOLDS
): { isAnomaly: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // Check 1: Cascade to unusually many nodes
  if (nodesAffected.length > thresholds.tooManyHighConfidenceCascades) {
    reasons.push(
      `🔴 Unexpected: ${nodesAffected.length} cascades (> ${thresholds.tooManyHighConfidenceCascades})`
    );
  }
  
  // Check 2: Perfect correlation (all nodes affected equally)
  if (nodesAffected.length > thresholds.correlationUniverse) {
    const allSame = nodesAffected.every(
      (val, _, arr) => val === arr[0]
    );
    if (allSame) {
      reasons.push(
        `🔴 Anomaly: All ${nodesAffected.length} nodes affected identically (perfect correlation)`
      );
    }
  }
  
  // Check 3: Confidence feedback too high
  const avgConfidence = confidenceSum / cascadeCount;
  if (avgConfidence > 0.95) {
    reasons.push(`🔴 Anomaly: Extremely high feedback (confidence ${(avgConfidence * 100).toFixed(0)}%)`);
  }
  
  return {
    isAnomaly: reasons.length > 0,
    reasons,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// 4️⃣ STATE SNAPSHOTS - Rollback on Anomalies
// ════════════════════════════════════════════════════════════════════════════════

export interface StateSnapshot {
  timestamp: number;
  nodes: GraphNode[];
  reason: string;
  triggeredBy: string;
}

/**
 * Snapshot manager
 */
export class SnapshotManager {
  private snapshots: StateSnapshot[] = [];
  private maxSnapshots: number = 10;
  
  /**
   * Create snapshot
   */
  createSnapshot(nodes: GraphNode[], reason: string, triggeredBy: string): StateSnapshot {
    const snapshot: StateSnapshot = {
      timestamp: Date.now(),
      nodes: JSON.parse(JSON.stringify(nodes)), // deep copy
      reason,
      triggeredBy,
    };
    
    this.snapshots.push(snapshot);
    
    // Keep bounded
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
    
    logger.info(`[SNAPSHOT] Created (${reason}) - ${nodes.length} nodes at ${snapshot.timestamp}`);
    
    propagationMonitoringService.recordEvent({
      type: 'snapshot_created',
      timestamp: Date.now(),
      details: {
        reason,
        triggeredBy,
        nodeCount: nodes.length,
      },
      severity: 'info',
    });
    
    return snapshot;
  }
  
  /**
   * Restore snapshot
   */
  restoreSnapshot(timestamp: number): GraphNode[] | null {
    const snapshot = this.snapshots.find(s => s.timestamp === timestamp);
    
    if (!snapshot) {
      logger.warn(`[SNAPSHOT] Not found for timestamp ${timestamp}`);
      return null;
    }
    
    logger.warn(`[SNAPSHOT] Restoring from ${snapshot.reason} at ${snapshot.timestamp}`);
    
    propagationMonitoringService.recordEvent({
      type: 'snapshot_restored',
      timestamp: Date.now(),
      details: {
        snapshotTimestamp: timestamp,
        reason: snapshot.reason,
        nodeCount: snapshot.nodes.length,
      },
      severity: 'warning',
    });
    
    return JSON.parse(JSON.stringify(snapshot.nodes)); // deep copy
  }
  
  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): StateSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }
  
  /**
   * List all snapshots
   */
  listSnapshots(): StateSnapshot[] {
    return this.snapshots.map(s => ({
      timestamp: s.timestamp,
      reason: s.reason,
      triggeredBy: s.triggeredBy,
      nodes: [], // don't return full nodes for list
    })) as any[];
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// 🎯 PRODUCTION HARDENING SERVICE (Phase C)
// ════════════════════════════════════════════════════════════════════════════════

export class ProductionHardeningService {
  private circuitBreaker: CircuitBreaker;
  private snapshotManager: SnapshotManager;
  private confidenceDecayConfig: ConfidenceDecayConfig;
  private anomalyThresholds: AnomalyThresholds;
  
  constructor(
    cbConfig?: Partial<CircuitBreakerConfig>,
    decayConfig?: Partial<ConfidenceDecayConfig>,
    anomalyTh?: Partial<AnomalyThresholds>
  ) {
    this.circuitBreaker = new CircuitBreaker(cbConfig);
    this.snapshotManager = new SnapshotManager();
    this.confidenceDecayConfig = { ...DEFAULT_CONFIDENCE_DECAY_CONFIG, ...decayConfig };
    this.anomalyThresholds = { ...DEFAULT_ANOMALY_THRESHOLDS, ...anomalyTh };
  }
  
  /**
   * Pre-flight check before propagation
   */
  shouldAllowPropagation(delta: PropagationDelta): {
    allowed: boolean;
    reason: string;
  } {
    if (this.circuitBreaker.isOpen()) {
      return {
        allowed: false,
        reason: `Circuit breaker is open (${this.circuitBreaker.getState()})`,
      };
    }
    
    return {
      allowed: true,
      reason: 'OK',
    };
  }
  
  /**
   * Post-flight check after propagation
   */
  recordPropagationResult(
    cascadeCount: number,
    confidenceSum: number,
    nodesAffected: number,
    confidences: number[]
  ): {
    allowed: boolean;
    anomalyDetected: boolean;
    anomalies?: string[];
  } {
    // Check circuit breaker
    const cbAllowed = this.circuitBreaker.recordCascade(
      confidenceSum,
      cascadeCount,
      nodesAffected
    );
    
    // Check anomalies
    const anomaly = detectAnomalies(
      'unknown', // would be source
      cascadeCount,
      confidenceSum,
      [nodesAffected],
      this.anomalyThresholds
    );
    
    if (anomaly.isAnomaly) {
      logger.warn(`[ANOMALY] ${anomaly.reasons.join(', ')}`);
      propagationMonitoringService.recordEvent({
        type: 'anomaly_detected',
        timestamp: Date.now(),
        details: {
          cascadeCount,
          confidenceSum,
          nodesAffected,
          anomalies: anomaly.reasons,
        },
        severity: 'warning',
      });
    }
    
    return {
      allowed: cbAllowed,
      anomalyDetected: anomaly.isAnomaly,
      anomalies: anomaly.reasons,
    };
  }
  
  /**
   * Decay all node confidences
   */
  performMaintenanceDecay(nodes: GraphNode[]): { nodesUpdated: number; avgDecay: number } {
    return applyConfidenceDecay(nodes, this.confidenceDecayConfig);
  }
  
  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getStats();
  }
  
  /**
   * Create safety snapshot
   */
  snapshot(nodes: GraphNode[], reason: string, triggeredBy: string): StateSnapshot {
    return this.snapshotManager.createSnapshot(nodes, reason, triggeredBy);
  }
  
  /**
   * Restore from snapshot
   */
  restoreSnapshot(timestamp: number): GraphNode[] | null {
    return this.snapshotManager.restoreSnapshot(timestamp);
  }
  
  /**
   * Get snapshots
   */
  getSnapshots() {
    return this.snapshotManager.listSnapshots();
  }
}

// Singleton instances
export const circuitBreaker = new CircuitBreaker();
export const snapshotManager = new SnapshotManager();
export const productionHardeningService = new ProductionHardeningService();

export default productionHardeningService;
