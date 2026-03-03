/**
 * 📊 API Registry & Real-Time Stats Routes
 * 
 * Agent-facing endpoints for monitoring endpoint health and performance
 * 
 * Endpoints:
 * - GET /api/docs/stats                 → All endpoint metrics
 * - GET /api/docs/stats/summary         → Quick summary only
 * - GET /api/docs/stats/unhealthy       → Only unhealthy endpoints
 * - GET /api/docs/stats/slowest?limit=N → N slowest endpoints
 * - GET /api/docs/stats/errors?limit=N  → N highest error rate endpoints
 * - GET /api/docs/stats/by-domain       → Metrics grouped by domain
 * - GET /api/docs/stats/domain/:domain  → Metrics for 1 domain
 */

import { Router, Request, Response } from 'express';
import { endpointMetricsCollector } from '../services/endpointMetricsCollector';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();
const router = Router();

/**
 * GET /api/docs/stats
 * Get all endpoint metrics in detail
 * Agent-friendly format for comprehensive monitoring
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const metrics = endpointMetricsCollector.getAllMetrics();
    const summary = endpointMetricsCollector.getSummary();

    res.json({
      timestamp: new Date().toISOString(),
      summary,
      endpoints: metrics,
      totalEndpoints: metrics.length,
    });
  } catch (error) {
    logger.error('[API_REGISTRY] Error getting metrics:', error);
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/docs/stats/summary
 * Quick summary only (lightweight for frequent polling)
 */
router.get('/stats/summary', (req: Request, res: Response) => {
  try {
    const summary = endpointMetricsCollector.getSummary();

    res.json({
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (error) {
    logger.error('[API_REGISTRY] Error getting summary:', error);
    res.status(500).json({
      error: 'Failed to get summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/docs/stats/unhealthy
 * Only endpoints with error rate > 5%
 */
router.get('/stats/unhealthy', (req: Request, res: Response) => {
  try {
    const all = endpointMetricsCollector.getAllMetrics();
    const unhealthy = all.filter((m) => m.errorRate > 5);

    res.json({
      timestamp: new Date().toISOString(),
      unhealthyCount: unhealthy.length,
      endpoints: unhealthy.sort((a, b) => b.errorRate - a.errorRate),
    });
  } catch (error) {
    logger.error('[API_REGISTRY] Error getting unhealthy endpoints:', error);
    res.status(500).json({
      error: 'Failed to get unhealthy endpoints',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/docs/stats/slowest?limit=10
 * N slowest endpoints by average latency
 */
router.get('/stats/slowest', (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const slowest = endpointMetricsCollector.getSlowestEndpoints(limit);

    res.json({
      timestamp: new Date().toISOString(),
      limit,
      count: slowest.length,
      endpoints: slowest,
    });
  } catch (error) {
    logger.error('[API_REGISTRY] Error getting slowest endpoints:', error);
    res.status(500).json({
      error: 'Failed to get slowest endpoints',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/docs/stats/errors?limit=10
 * N endpoints with highest error rates
 */
router.get('/stats/errors', (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const highErrors = endpointMetricsCollector.getHighestErrorRates(limit);

    res.json({
      timestamp: new Date().toISOString(),
      limit,
      count: highErrors.length,
      endpoints: highErrors,
    });
  } catch (error) {
    logger.error('[API_REGISTRY] Error getting high error endpoints:', error);
    res.status(500).json({
      error: 'Failed to get high error endpoints',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/docs/stats/by-domain
 * Metrics grouped by API domain
 */
router.get('/stats/by-domain', (req: Request, res: Response) => {
  try {
    const byDomain = endpointMetricsCollector.getMetricsByDomain();

    // Calculate domain-level stats
    const domainStats: Record<string, any> = {};
    Object.entries(byDomain).forEach(([domain, metrics]) => {
      const totalCalls = metrics.reduce((sum, m) => sum + m.callCount, 0);
      const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);
      const avgLatency = Math.round(
        metrics.reduce((sum, m) => sum + m.avgLatency * m.callCount, 0) / totalCalls || 0
      );
      const errorRate = totalCalls > 0 ? ((totalErrors / totalCalls) * 100).toFixed(2) : '0.00';

      domainStats[domain] = {
        totalEndpoints: metrics.length,
        totalCalls,
        totalErrors,
        avgLatency,
        errorRate: parseFloat(errorRate),
        isHealthy: parseFloat(errorRate) < 5,
        endpoints: metrics.length <= 20 ? metrics : undefined, // Only include if small domain
      };
    });

    res.json({
      timestamp: new Date().toISOString(),
      domains: domainStats,
      totalDomains: Object.keys(domainStats).length,
    });
  } catch (error) {
    logger.error('[API_REGISTRY] Error getting domain metrics:', error);
    res.status(500).json({
      error: 'Failed to get domain metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/docs/stats/domain/:domain
 * Metrics for a specific domain only
 */
router.get('/stats/domain/:domain', (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const allMetrics = endpointMetricsCollector.getAllMetrics();
    
    // Filter metrics by domain
    const domainMetrics = allMetrics.filter((m) => {
      const pathParts = m.path.split('/').filter(Boolean);
      return pathParts[1] === domain;
    });

    if (domainMetrics.length === 0) {
      return res.status(404).json({
        error: 'Domain not found',
        message: `No endpoints found for domain: ${domain}`,
      });
    }

    const summary = {
      totalEndpoints: domainMetrics.length,
      totalCalls: domainMetrics.reduce((sum, m) => sum + m.callCount, 0),
      totalErrors: domainMetrics.reduce((sum, m) => sum + m.errorCount, 0),
      avgLatency: Math.round(
        domainMetrics.reduce((sum, m) => sum + m.avgLatency * m.callCount, 0) /
          domainMetrics.reduce((sum, m) => sum + m.callCount, 0)
      ),
      healthyEndpoints: domainMetrics.filter((m) => m.isHealthy).length,
      unhealthyEndpoints: domainMetrics.filter((m) => !m.isHealthy).length,
    };

    res.json({
      timestamp: new Date().toISOString(),
      domain,
      summary,
      endpoints: domainMetrics.sort((a, b) => b.callCount - a.callCount),
    });
  } catch (error) {
    logger.error('[API_REGISTRY] Error getting domain metrics:', error);
    res.status(500).json({
      error: 'Failed to get domain metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/docs/health
 * Quick health check for monitoring agents
 * Returns overall system health at a glance
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const summary = endpointMetricsCollector.getSummary();
    
    let overallStatus = 'healthy';
    let statusCode = 200;
    
    if (summary.unhealthyEndpoints > 0) {
      overallStatus = 'degraded';
      statusCode = 200; // Still return 200, but include status in body
    }
    if (summary.unhealthyEndpoints > summary.healthyEndpoints) {
      overallStatus = 'down';
      statusCode = 200; // Still 200 for now, clients should check status field
    }

    res.status(statusCode).json({
      timestamp: new Date().toISOString(),
      status: overallStatus,
      summary: {
        totalEndpoints: summary.totalEndpoints,
        healthyEndpoints: summary.healthyEndpoints,
        degradedEndpoints: summary.degradedEndpoints,
        unhealthyEndpoints: summary.unhealthyEndpoints,
        totalCalls: summary.totalCalls,
        overallErrorRate: summary.overallErrorRate,
        avgLatency: summary.avgLatency,
        p99Latency: summary.p99Latency,
      },
    });
  } catch (error) {
    logger.error('[API_REGISTRY] Error getting health:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
