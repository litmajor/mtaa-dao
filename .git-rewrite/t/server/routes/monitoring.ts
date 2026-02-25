
import express, { Request, Response } from 'express';
import { metricsCollector } from '../monitoring/metricsCollector';
import { logger } from '../utils/logger';
import { isAuthenticated } from '../nextAuthMiddleware';

const router = express.Router();

interface Alert {
  id: string;
  type: 'error_rate' | 'response_time' | 'memory_usage' | 'disk_space' | 'connection_count';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolvedAt?: number;
}

class AlertManager {
  private static instance: AlertManager;
  private alerts: Alert[] = [];
  private alertRules = {
    errorRate: { threshold: 5, severity: 'high' as const },
    responseTime: { threshold: 1000, severity: 'medium' as const },
    memoryUsage: { threshold: 80, severity: 'high' as const },
    connectionCount: { threshold: 1000, severity: 'medium' as const }
  };

  public static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  private constructor() {
    // Check for alerts every minute
    setInterval(() => this.checkAlerts(), 60000);
  }

  private checkAlerts() {
    const metrics = metricsCollector.getMetrics();
    
    // Check error rate
    if (metrics.summary.errorRate > this.alertRules.errorRate.threshold) {
      this.createAlert(
        'error_rate',
        this.alertRules.errorRate.severity,
        `High error rate: ${metrics.summary.errorRate.toFixed(2)}%`
      );
    }

    // Check response time
    if (metrics.summary.avgResponseTime > this.alertRules.responseTime.threshold) {
      this.createAlert(
        'response_time',
        this.alertRules.responseTime.severity,
        `Slow response time: ${metrics.summary.avgResponseTime.toFixed(2)}ms`
      );
    }

    // Check memory usage
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024);
    if (memoryUsage > 500) {
      this.createAlert(
        'memory_usage',
        this.alertRules.memoryUsage.severity,
        `High memory usage: ${memoryUsage.toFixed(2)}MB`
      );
    }

    // Check connection count
    if (metrics.summary.activeConnections > this.alertRules.connectionCount.threshold) {
      this.createAlert(
        'connection_count',
        this.alertRules.connectionCount.severity,
        `High connection count: ${metrics.summary.activeConnections}`
      );
    }
  }

  private createAlert(type: Alert['type'], severity: Alert['severity'], message: string) {
    // Don't create duplicate alerts
    const existingAlert = this.alerts.find(
      alert => alert.type === type && !alert.acknowledged && !alert.resolvedAt
    );
    
    if (existingAlert) return;

    const alert: Alert = {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      acknowledged: false
    };

    this.alerts.push(alert);
    logger.warn(`Alert created: ${message}`, { alert });

    // Auto-resolve old alerts of the same type
    this.alerts
      .filter(a => a.type === type && a.id !== alert.id && !a.resolvedAt)
      .forEach(a => a.resolvedAt = Date.now());
  }

  public getAlerts(includeResolved = false): Alert[] {
    return this.alerts.filter(alert => 
      includeResolved || (!alert.resolvedAt && !alert.acknowledged)
    );
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }
}

const alertManager = AlertManager.getInstance();

// Dashboard endpoint
router.get('/dashboard', isAuthenticated, (req: Request, res: Response) => {
  const metrics = metricsCollector.getMetrics();
  const alerts = alertManager.getAlerts();
  const healthScore = metricsCollector.getHealthScore();

  res.json({
    healthScore,
    alerts: alerts.length,
    criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
    metrics: {
      totalRequests: metrics.summary.totalRequests,
      errorRate: metrics.summary.errorRate,
      avgResponseTime: metrics.summary.avgResponseTime,
      activeConnections: metrics.summary.activeConnections,
      uptime: metrics.summary.uptime,
      memoryUsage: process.memoryUsage()
    },
    recentRequests: metrics.requests.slice(-20),
    systemMetrics: metrics.system.slice(-10)
  });
});

// Alerts endpoints
router.get('/alerts', isAuthenticated, (req: Request, res: Response) => {
  const includeResolved = req.query.resolved === 'true';
  const alerts = alertManager.getAlerts(includeResolved);
  res.json({ alerts });
});

router.post('/alerts/:alertId/acknowledge', isAuthenticated, (req: Request, res: Response) => {
  const { alertId } = req.params;
  const success = alertManager.acknowledgeAlert(alertId);
  
  if (success) {
    res.json({ message: 'Alert acknowledged' });
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

router.post('/alerts/:alertId/resolve', isAuthenticated, (req: Request, res: Response) => {
  const { alertId } = req.params;
  const success = alertManager.resolveAlert(alertId);
  
  if (success) {
    res.json({ message: 'Alert resolved' });
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

// Performance metrics endpoint
router.get('/performance', isAuthenticated, (req: Request, res: Response) => {
  const metrics = metricsCollector.getMetrics();
  
  // Calculate performance insights
  const slowEndpoints = metrics.requests
    .filter(r => r.responseTime > 1000)
    .reduce((acc, req) => {
      const key = `${req.method} ${req.route}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const errorEndpoints = metrics.requests
    .filter(r => r.statusCode >= 400)
    .reduce((acc, req) => {
      const key = `${req.method} ${req.route}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  res.json({
    slowEndpoints,
    errorEndpoints,
    performanceScore: metricsCollector.getHealthScore(),
    recommendations: generatePerformanceRecommendations(metrics)
  });
});

function generatePerformanceRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];
  
  if (metrics.summary.errorRate > 2) {
    recommendations.push('High error rate detected. Review error logs and fix failing endpoints.');
  }
  
  if (metrics.summary.avgResponseTime > 500) {
    recommendations.push('Slow response times detected. Consider optimizing database queries and adding caching.');
  }
  
  const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
  if (memoryUsageMB > 300) {
    recommendations.push('High memory usage. Review memory leaks and optimize resource usage.');
  }
  
  if (metrics.summary.activeConnections > 100) {
    recommendations.push('High number of active connections. Consider implementing connection pooling.');
  }

  return recommendations;
}

export default router;
