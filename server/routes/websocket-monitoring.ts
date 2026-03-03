/**
 * WebSocket Monitoring Routes
 * Provides endpoints to monitor WebSocket health, connections, and metrics
 * 
 * Endpoints:
 * - GET /api/monitoring/websocket/health - Overall health status
 * - GET /api/monitoring/websocket/stats - Current statistics
 * - GET /api/monitoring/websocket/connections - Active connections
 * - GET /api/monitoring/websocket/alerts - Recent alerts
 * - GET /api/monitoring/websocket/history - Historical data
 */

import { Router, Request, Response } from 'express';
import { wsConnectionManager } from '../services/WebSocketConnectionManager';
import { wsHealthMonitor } from '../services/WebSocketHealthMonitor';
import { logger } from '../utils/logger';
import { isAuthenticated, AuthRequest } from '../auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

/**
 * Middleware: Authentication + Role-based access control
 * Requires: super_admin or admin role for all monitoring endpoints
 */
router.use(isAuthenticated as any);
router.use(requireRole('super_admin'));

// All routes below this point require authentication and admin/super_admin role

/**
 * GET /api/monitoring/websocket/health
 * Get overall WebSocket health status
 * 
 * Auth: Required (admin/super_admin)
 * Response: Health status with metrics and recent alerts
 */
router.get('/websocket/health', (req: AuthRequest, res: Response) => {
  try {
    const { healthy, report } = wsHealthMonitor.getHealthStatus();
    
    res.json({
      healthy,
      status: report.status,
      timestamp: report.timestamp,
      summary: report.summary,
      metrics: report.metrics.map(m => ({
        name: m.name,
        value: m.value.toFixed(2),
        unit: m.unit,
        threshold: m.threshold
      })),
      recentAlerts: report.alerts.slice(0, 5),
      totalAlerts: report.alerts.length
    });
  } catch (error) {
    logger.error('[WebSocket Monitoring] Health check error:', error);
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

/**
 * GET /api/monitoring/websocket/stats
 * Get detailed statistics on connections, messaging, and resources
 * 
 * Auth: Required (admin/super_admin)
 * Response: Detailed stats broken down by user, message type, and subscription
 */
router.get('/websocket/stats', (req: AuthRequest, res: Response) => {
  try {
    const stats = wsConnectionManager.getStats();
    
    // Format for response
    const response = {
      timestamp: new Date(),
      connections: {
        total: stats.totalConnections,
        dead: stats.deadConnections,
        healthy: stats.totalConnections - stats.deadConnections,
        byUser: Array.from(stats.connectionsByUser.entries()).map(([userId, count]) => ({
          userId,
          connections: count
        }))
      },
      messaging: {
        total: stats.totalMessages,
        byType: Array.from(stats.messagesByType.entries()).map(([type, count]) => ({
          type,
          count
        }))
      },
      subscriptions: {
        total: stats.subscriptionBreakdown.size,
        breakdown: Array.from(stats.subscriptionBreakdown.entries()).map(([sub, count]) => ({
          subscription: sub,
          clients: count
        })).sort((a, b) => b.clients - a.clients).slice(0, 20) // Top 20
      },
      resources: {
        memoryUsageMB: stats.memoryUsageMB,
        cpuUsagePercent: stats.cpuUsagePercent || 0
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('[WebSocket Monitoring] Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /api/monitoring/websocket/connections
 * Get active connections grouped by user (paginated)
 * 
 * Auth: Required (admin/super_admin)
 * Query: limit=100 (max 1000)
 * Response: Total connections with per-user breakdown
 */
router.get('/websocket/connections', (req: AuthRequest, res: Response) => {
  try {
    const stats = wsConnectionManager.getStats();
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    
    // Return summary of connections
    const byUser = Array.from(stats.connectionsByUser.entries())
      .map(([userId, connections]) => ({
        userId,
        connections,
        subscriptions: 0 // Would need to track per user
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, limit);

    res.json({
      total: stats.totalConnections,
      users: byUser.length,
      connectionsByUser: byUser,
      maxConnectionsPerUser: 5 // From config
    });
  } catch (error) {
    logger.error('[WebSocket Monitoring] Connections error:', error);
    res.status(500).json({ error: 'Failed to get connections' });
  }
});

/**
 * GET /api/monitoring/websocket/alerts
 * Get recent alerts filtered by severity and time
 * 
 * Auth: Required (admin/super_admin)
 * Query: minutes=60 (max 1440 for 24 hours)
 * Response: Alerts grouped by severity with detailed metrics
 */
router.get('/websocket/alerts', (req: AuthRequest, res: Response) => {
  try {
    const minutes = Math.min(Number(req.query.minutes) || 60, 1440); // Max 24 hours
    const alerts = wsHealthMonitor.getRecentAlerts(minutes);
    
    // Group by severity
    const bySeverity = {
      critical: alerts.filter(a => a.severity === 'critical'),
      warning: alerts.filter(a => a.severity === 'warning'),
      info: alerts.filter(a => a.severity === 'info')
    };

    res.json({
      timeframe: `${minutes} minutes`,
      timestamp: new Date(),
      summary: {
        critical: bySeverity.critical.length,
        warning: bySeverity.warning.length,
        info: bySeverity.info.length,
        total: alerts.length
      },
      alerts: alerts.map(a => ({
        severity: a.severity,
        metric: a.metric,
        message: a.message,
        value: a.value.toFixed(2),
        threshold: a.threshold.toFixed(2),
        timestamp: a.timestamp
      }))
    });
  } catch (error) {
    logger.error('[WebSocket Monitoring] Alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * GET /api/monitoring/websocket/history
 * Get historical health data with trends
 * 
 * Auth: Required (admin/super_admin)
 * Query: minutes=60 (max 1440 for 24 hours)
 * Response: Timeline of health scores with average metrics
 */
router.get('/websocket/history', (req: AuthRequest, res: Response) => {
  try {
    const minutes = Math.min(Number(req.query.minutes) || 60, 1440);
    const history = wsHealthMonitor.getHistory(minutes);
    
    // Simple health score over time
    const timeline = history.map(report => ({
      timestamp: report.timestamp,
      status: report.status,
      statusScore: report.status === 'healthy' ? 100 : report.status === 'degraded' ? 50 : 0,
      metrics: {
        latency: report.metrics.find(m => m.name === 'avgLatency')?.value || 0,
        memoryMB: report.metrics.find(m => m.name === 'memoryUsage')?.value || 0,
        errorRate: report.metrics.find(m => m.name === 'errorRate')?.value || 0
      },
      alertCount: report.alerts.length
    }));

    // Calculate averages
    const avgStatus = timeline.reduce((sum, t) => sum + t.statusScore, 0) / timeline.length;
    const avgLatency = timeline.reduce((sum, t) => sum + t.metrics.latency, 0) / timeline.length;
    const avgMemory = timeline.reduce((sum, t) => sum + t.metrics.memoryMB, 0) / timeline.length;

    res.json({
      timeframe: `${minutes} minutes`,
      dataPoints: timeline.length,
      averages: {
        healthScore: avgStatus.toFixed(0),
        latencyMs: avgLatency.toFixed(0),
        memoryMB: avgMemory.toFixed(0)
      },
      timeline
    });
  } catch (error) {
    logger.error('[WebSocket Monitoring] History error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

/**
 * POST /api/monitoring/websocket/test
 * Test WebSocket connectivity and system diagnostics
 * 
 * Auth: Required (admin/super_admin)
 * Response: Current health status + connection counts
 */
router.post('/websocket/test', (req: AuthRequest, res: Response) => {
  try {
    const health = wsHealthMonitor.isHealthy();
    const stats = wsConnectionManager.getStats();
    
    res.json({
      healthy: health,
      diagnostics: {
        connectionsActive: stats.totalConnections,
        deadConnections: stats.deadConnections,
        memoryMB: stats.memoryUsageMB,
        messagesProcessed: stats.totalMessages,
        subscriptionsActive: stats.subscriptionBreakdown.size
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('[WebSocket Monitoring] Test error:', error);
    res.status(500).json({ error: 'Test failed' });
  }
});

export default router;
