/**
 * WebSocket Health Monitor
 * Tracks health metrics, detects anomalies, and triggers alerts
 * 
 * Metrics tracked:
 * - Connection health (latency, packet loss, error rate)
 * - Message throughput and lag
 * - Memory pressure
 * - Subscription saturation
 * - Reconnection patterns
 */

import { logger } from '../utils/logger';

export interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  threshold?: { warning: number; critical: number };
}

export interface HealthReport {
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'critical';
  metrics: HealthMetric[];
  alerts: AlertEvent[];
  summary: string;
}

export interface AlertEvent {
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: Date;
}

export class WebSocketHealthMonitor {
  private metrics: Map<string, HealthMetric> = new Map();
  private alerts: AlertEvent[] = [];
  private history: HealthReport[] = [];
  
  private readonly MAX_HISTORY = 100;
  private readonly ALERT_RETENTION = 1000;

  // Thresholds
  private readonly THRESHOLDS = {
    avgLatency: { warning: 100, critical: 500 },           // ms
    packetLoss: { warning: 1, critical: 5 },               // percent
    errorRate: { warning: 0.5, critical: 2 },              // percent
    memoryUsage: { warning: 400, critical: 800 },          // MB
    messageQueueDepth: { warning: 1000, critical: 10000 }, // messages
    reconnectRate: { warning: 5, critical: 20 },           // per minute
    subscriptionSaturation: { warning: 80, critical: 95 }  // percent
  };

  /**
   * Record a metric
   */
  public recordMetric(name: string, value: number, unit: string, thresholdOverride?: any): void {
    const metric: HealthMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      threshold: thresholdOverride || (this.THRESHOLDS as any)[name]
    };

    this.metrics.set(name, metric);

    // Check thresholds
    if (metric.threshold) {
      if (value >= metric.threshold.critical) {
        this.addAlert('critical', name, value, metric.threshold.critical);
      } else if (value >= metric.threshold.warning) {
        this.addAlert('warning', name, value, metric.threshold.warning);
      }
    }
  }

  /**
   * Add an alert
   */
  private addAlert(
    severity: 'info' | 'warning' | 'critical',
    metric: string,
    value: number,
    threshold: number
  ): void {
    const alert: AlertEvent = {
      severity,
      metric,
      value,
      threshold,
      message: `${metric} at ${value.toFixed(2)} (threshold: ${threshold})`,
      timestamp: new Date()
    };

    this.alerts.push(alert);

    // Trim old alerts
    if (this.alerts.length > this.ALERT_RETENTION) {
      this.alerts = this.alerts.slice(-this.ALERT_RETENTION);
    }

    // Log alert
    if (severity === 'critical') {
      logger.error(`[WebSocket Health] CRITICAL: ${alert.message}`);
    } else if (severity === 'warning') {
      logger.warn(`[WebSocket Health] WARNING: ${alert.message}`);
    }
  }

  /**
   * Generate health report
   */
  public generateReport(): HealthReport {
    // Determine overall status
    const criticalAlerts = this.alerts.filter(
      a => a.severity === 'critical' && 
      Date.now() - a.timestamp.getTime() < 60000 // Last 60 seconds
    );
    const warningAlerts = this.alerts.filter(
      a => a.severity === 'warning' && 
      Date.now() - a.timestamp.getTime() < 300000 // Last 5 minutes
    );

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'degraded';
    }

    const report: HealthReport = {
      timestamp: new Date(),
      status,
      metrics: Array.from(this.metrics.values()),
      alerts: [...criticalAlerts, ...warningAlerts].slice(-10), // Last 10 recent alerts
      summary: this.generateSummary(status, criticalAlerts.length, warningAlerts.length)
    };

    this.history.push(report);
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY);
    }

    return report;
  }

  /**
   * Generate text summary
   */
  private generateSummary(status: string, criticalCount: number, warningCount: number): string {
    const parts: string[] = [`Status: ${status.toUpperCase()}`];
    
    if (criticalCount > 0) {
      parts.push(`${criticalCount} critical alerts`);
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} warnings`);
    }
    
    const latency = this.metrics.get('avgLatency');
    if (latency) {
      parts.push(`Avg latency: ${latency.value.toFixed(0)}ms`);
    }
    
    const memUsage = this.metrics.get('memoryUsage');
    if (memUsage) {
      parts.push(`Memory: ${memUsage.value.toFixed(0)}MB`);
    }

    return parts.join(' | ');
  }

  /**
   * Get metric value
   */
  public getMetric(name: string): number | null {
    return this.metrics.get(name)?.value || null;
  }

  /**
   * Get recent alerts
   */
  public getRecentAlerts(minutes: number = 5): AlertEvent[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.alerts.filter(a => a.timestamp.getTime() > cutoff);
  }

  /**
   * Get report history
   */
  public getHistory(minutes: number = 60): HealthReport[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.history.filter(r => r.timestamp.getTime() > cutoff);
  }

  /**
   * Health check - returns boolean
   */
  public isHealthy(): boolean {
    const report = this.generateReport();
    return report.status === 'healthy';
  }

  /**
   * Health check with details
   */
  public getHealthStatus(): { healthy: boolean; report: HealthReport } {
    const report = this.generateReport();
    return {
      healthy: report.status === 'healthy',
      report
    };
  }

  /**
   * Clear history
   */
  public clearHistory(): void {
    this.history = [];
    this.alerts = [];
  }
}

export const wsHealthMonitor = new WebSocketHealthMonitor();
