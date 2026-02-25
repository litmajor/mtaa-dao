/**
 * Graph Propagation Monitoring & Telemetry Service
 * 
 * Tracks:
 * - Cascade metrics (count, confidence, spread)
 * - Node state changes (delta patterns)
 * - Integration metrics (OHLCV, TA, NURU triggers)
 * - Anomalies & circuit breaker events
 * - System health & performance
 */

import { logger } from '../utils/logger';

/**
 * Cascade metrics for a single propagation cycle
 */
export interface CascadeMetrics {
  timestamp: number;
  sourceNode: string;
  deltaType: string;
  cascadeCount: number;
  totalConfidenceSum: number;
  averageConfidence: number;
  maxConfidence: number;
  minConfidence: number;
  highConfidenceCascades: number; // > 0.8
  lowConfidenceCascades: number;  // < 0.3
  edgeTypeDistribution: Record<string, number>;
}

/**
 * Telemetry event types
 */
export type TelemetryEventType =
  | 'propagation_triggered'
  | 'cascade_computed'
  | 'state_updated'
  | 'ohlcv_integrated'
  | 'ta_integrated'
  | 'nuru_decision'
  | 'circuit_breaker_triggered'
  | 'anomaly_detected'
  | 'snapshot_created'
  | 'snapshot_restored';

/**
 * Telemetry event
 */
export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: number;
  nodeId?: string;
  details: Record<string, any>;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Aggregated telemetry stats
 */
export interface TelemetryStats {
  periodStart: number;
  periodEnd: number;
  totalPropagations: number;
  totalCascades: number;
  averageCascadesPerPropagation: number;
  averageConfidencePerCascade: number;
  ohlcvIntegrations: number;
  taIntegrations: number;
  nuruDecisions: number;
  circuitBreakerTrips: number;
  anomaliesDetected: number;
  snapshotsCreated: number;
  circuitBreakerActive: boolean;
}

/**
 * Monitoring service singleton
 */
export class PropagationMonitoringService {
  private events: TelemetryEvent[] = [];
  private cascadeMetrics: Map<string, CascadeMetrics> = new Map(); // by timestamp
  private eventCounts: Record<TelemetryEventType, number> = {
    propagation_triggered: 0,
    cascade_computed: 0,
    state_updated: 0,
    ohlcv_integrated: 0,
    ta_integrated: 0,
    nuru_decision: 0,
    circuit_breaker_triggered: 0,
    anomaly_detected: 0,
    snapshot_created: 0,
    snapshot_restored: 0,
  };
  
  private maxEventsInMemory = 10000; // rolling buffer
  private readonly startTime = Date.now();
  
  /**
   * Record telemetry event
   */
  recordEvent(event: TelemetryEvent): void {
    this.events.push(event);
    this.eventCounts[event.type]++;
    
    // Keep memory bounded
    if (this.events.length > this.maxEventsInMemory) {
      this.events.shift();
    }
    
    // Log critical events immediately
    if (event.severity === 'critical') {
      logger.warn(`[TELEMETRY] CRITICAL: ${event.type}`, event.details);
    }
  }
  
  /**
   * Record cascade metrics from a propagation cycle
   */
  recordCascadeMetrics(metrics: Partial<CascadeMetrics>): void {
    const timestamp = Date.now();
    const fullMetrics: CascadeMetrics = {
      timestamp,
      sourceNode: metrics.sourceNode || 'unknown',
      deltaType: metrics.deltaType || 'unknown',
      cascadeCount: metrics.cascadeCount || 0,
      totalConfidenceSum: metrics.totalConfidenceSum || 0,
      averageConfidence: metrics.averageConfidence || 0,
      maxConfidence: metrics.maxConfidence || 0,
      minConfidence: metrics.minConfidence || 0,
      highConfidenceCascades: metrics.highConfidenceCascades || 0,
      lowConfidenceCascades: metrics.lowConfidenceCascades || 0,
      edgeTypeDistribution: metrics.edgeTypeDistribution || {},
    };
    
    this.cascadeMetrics.set(`${timestamp}_${metrics.sourceNode}`, fullMetrics);
    
    // Keep bounded
    if (this.cascadeMetrics.size > 5000) {
      const entries = Array.from(this.cascadeMetrics.entries());
      const entriesToRemove = entries.slice(0, 500);
      entriesToRemove.forEach(([key]) => this.cascadeMetrics.delete(key));
    }
  }
  
  /**
   * Get telemetry stats for period
   */
  getStats(periodMinutes: number = 60): TelemetryStats {
    const now = Date.now();
    const periodStart = now - periodMinutes * 60 * 1000;
    
    const eventsInPeriod = this.events.filter(e => e.timestamp >= periodStart);
    
    // Calculate cascade stats
    let totalCascades = 0;
    let totalConfidence = 0;
    let cascadeCount = 0;
    
    this.cascadeMetrics.forEach(metrics => {
      if (metrics.timestamp >= periodStart) {
        totalCascades += metrics.cascadeCount;
        totalConfidence += metrics.totalConfidenceSum;
        cascadeCount++;
      }
    });
    
    return {
      periodStart,
      periodEnd: now,
      totalPropagations: eventsInPeriod.filter(e => e.type === 'propagation_triggered').length,
      totalCascades,
      averageCascadesPerPropagation: cascadeCount > 0 
        ? totalCascades / eventsInPeriod.filter(e => e.type === 'propagation_triggered').length
        : 0,
      averageConfidencePerCascade: totalCascades > 0 ? totalConfidence / totalCascades : 0,
      ohlcvIntegrations: this.eventCounts.ohlcv_integrated,
      taIntegrations: this.eventCounts.ta_integrated,
      nuruDecisions: this.eventCounts.nuru_decision,
      circuitBreakerTrips: this.eventCounts.circuit_breaker_triggered,
      anomaliesDetected: this.eventCounts.anomaly_detected,
      snapshotsCreated: this.eventCounts.snapshot_created,
      circuitBreakerActive: false, // would be set by actual circuit breaker
    };
  }
  
  /**
   * Get recent events
   */
  getRecentEvents(count: number = 100): TelemetryEvent[] {
    return this.events.slice(-count);
  }
  
  /**
   * Get events by type
   */
  getEventsByType(type: TelemetryEventType, limit: number = 100): TelemetryEvent[] {
    return this.events
      .filter(e => e.type === type)
      .slice(-limit);
  }
  
  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): {
    stats: TelemetryStats;
    eventCounts: Record<TelemetryEventType, number>;
    recentEvents: TelemetryEvent[];
    cascadeMetricsSnapshot: CascadeMetrics[];
  } {
    return {
      stats: this.getStats(60),
      eventCounts: this.eventCounts,
      recentEvents: this.getRecentEvents(50),
      cascadeMetricsSnapshot: Array.from(this.cascadeMetrics.values()).slice(-20),
    };
  }
  
  /**
   * Health check
   */
  getHealth(): {
    uptime: number;
    totalEvents: number;
    totalMetrics: number;
    lastEventTime: number | null;
    isHealthy: boolean;
  } {
    const lastEvent = this.events[this.events.length - 1];
    const uptime = Date.now() - this.startTime;
    
    // Consider unhealthy if no events in last 5 minutes
    const isHealthy = lastEvent ? (Date.now() - lastEvent.timestamp) < 5 * 60 * 1000 : false;
    
    return {
      uptime,
      totalEvents: this.events.length,
      totalMetrics: this.cascadeMetrics.size,
      lastEventTime: lastEvent ? lastEvent.timestamp : null,
      isHealthy,
    };
  }
  
  /**
   * Clear old data (periodic maintenance)
   */
  prune(olderThanMinutes: number = 120): { eventsPruned: number; metricsPruned: number } {
    const cutoff = Date.now() - olderThanMinutes * 60 * 1000;
    
    const beforeEvents = this.events.length;
    this.events = this.events.filter(e => e.timestamp >= cutoff);
    const eventsPruned = beforeEvents - this.events.length;
    
    const beforeMetrics = this.cascadeMetrics.size;
    Array.from(this.cascadeMetrics.entries()).forEach(([key, metrics]) => {
      if (metrics.timestamp < cutoff) {
        this.cascadeMetrics.delete(key);
      }
    });
    const metricsPruned = beforeMetrics - this.cascadeMetrics.size;
    
    return { eventsPruned, metricsPruned };
  }
}

// Singleton instance
export const propagationMonitoringService = new PropagationMonitoringService();

export default propagationMonitoringService;
