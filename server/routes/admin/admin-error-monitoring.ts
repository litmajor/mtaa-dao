import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { requireRole } from '../../middleware/rbac';
import {
  PaymentErrorMonitoringService,
  PaymentErrorMetric,
  ErrorAggregation,
  ProviderErrorMetrics,
} from '../../services/paymentErrorMonitoringService';
import { PaymentErrorAlertService, AlertSeverity } from '../../services/paymentErrorAlertService';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

/**
 * ADMIN ERROR MONITORING DASHBOARD ROUTES
 * Phase 3c Foundation - Real-time error tracking and analysis
 */

/**
 * GET /api/admin/errors/dashboard
 * Main error monitoring dashboard with current status and key metrics
 */
router.get('/errors/dashboard', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const aggregation = PaymentErrorMonitoringService.getAggregation();
    const healthCheck = PaymentErrorMonitoringService.getHealthCheck();
    const allProviderMetrics = PaymentErrorMonitoringService.getAllProviderMetrics();
    const recentErrors = PaymentErrorMonitoringService.getRecentErrors(10);

    // Get alert status
    const activeAlerts = PaymentErrorAlertService.getAlertHistory(10);
    const recentCriticalAlerts = activeAlerts.filter(a => a.severity === AlertSeverity.CRITICAL);

    res.json({
      timestamp: new Date(),
      healthStatus: healthCheck.status,
      alertStatus: {
        criticalAlertsInLastHour: recentCriticalAlerts.length,
        totalAlertsInLastHour: activeAlerts.length,
        triggersEnabled: PaymentErrorAlertService.getAllTriggers().filter(t => t.enabled).length,
      },
      summary: {
        totalErrors24h: aggregation.totalErrors,
        uniqueErrorCodes: aggregation.uniqueErrorCodes,
        mostCommonError: aggregation.mostCommonError,
        retrySuccessRate: aggregation.retrySuccessRate,
        avgRetryAttempts: aggregation.avgRetryCount,
      },
      distribution: {
        byCategory: aggregation.errorsByCategory,
        byProvider: aggregation.errorsByProvider,
        byOperation: aggregation.errorsByOperation,
      },
      providers: allProviderMetrics.map(m => ({
        name: m.provider,
        totalErrors: m.totalErrors,
        errorRate: m.errorRate,
        criticalErrors: m.criticalErrors,
        timeouts: m.timeoutErrors,
        rateLimitErrors: m.rateLimitErrors,
        lastErrorTime: m.lastErrorTime,
      })),
      recentErrors: recentErrors.map(e => ({
        timestamp: e.timestamp,
        errorCode: e.errorCode,
        category: e.errorCategory,
        provider: e.provider,
        operation: e.operation,
        statusCode: e.statusCode,
        retries: e.retryCount,
      })),
    });
  } catch (error) {
    logger.error('Error fetching error dashboard', { error });
    res.status(500).json({ error: 'Failed to fetch error dashboard' });
  }
});

/**
 * GET /api/admin/errors/aggregation
 * Detailed error aggregation statistics
 */
router.get('/errors/aggregation', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const aggregation = PaymentErrorMonitoringService.getAggregation();

    res.json({
      timestamp: new Date(),
      ...aggregation,
    });
  } catch (error) {
    logger.error('Error fetching error aggregation', { error });
    res.status(500).json({ error: 'Failed to fetch error aggregation' });
  }
});

/**
 * GET /api/admin/errors/timeline
 * Error timeline showing recent errors in chronological order
 */
router.get('/errors/timeline', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const timeline = PaymentErrorMonitoringService.getErrorTimeline(limit);

    res.json({
      timestamp: new Date(),
      count: timeline.length,
      errors: timeline,
    });
  } catch (error) {
    logger.error('Error fetching error timeline', { error });
    res.status(500).json({ error: 'Failed to fetch error timeline' });
  }
});

/**
 * GET /api/admin/errors/by-code/:errorCode
 * Get detailed information about a specific error code
 */
router.get('/errors/by-code/:errorCode', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { errorCode } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    const trend = PaymentErrorMonitoringService.getErrorTrend(errorCode, hours);
    const recentErrors = PaymentErrorMonitoringService.getRecentErrors(100).filter(
      e => e.errorCode === errorCode
    );

    const topProviders: Record<string, number> = {};
    const topOperations: Record<string, number> = {};

    for (const error of recentErrors) {
      topProviders[error.provider] = (topProviders[error.provider] || 0) + 1;
      topOperations[error.operation] = (topOperations[error.operation] || 0) + 1;
    }

    res.json({
      timestamp: new Date(),
      errorCode,
      totalOccurrences: recentErrors.length,
      trend,
      topProviders: Object.entries(topProviders)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([provider, count]) => ({ provider, count })),
      topOperations: Object.entries(topOperations)
        .sort(([, a], [, b]) => b - a)
        .map(([operation, count]) => ({ operation, count })),
      recentInstances: recentErrors.slice(0, 5),
    });
  } catch (error) {
    logger.error('Error fetching error details', { error });
    res.status(500).json({ error: 'Failed to fetch error details' });
  }
});

/**
 * GET /api/admin/errors/by-provider/:provider
 * Get detailed metrics for a specific payment provider
 */
router.get('/errors/by-provider/:provider', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const metrics = PaymentErrorMonitoringService.getProviderMetrics(provider);
    const recentErrors = PaymentErrorMonitoringService.getRecentErrors(100).filter(
      e => e.provider === provider
    );

    const errorCodesTotalCount: Record<string, number> = {};
    const severityCounts = {
      critical: 0,
      warning: 0,
      info: 0,
    };

    for (const error of recentErrors) {
      errorCodesTotalCount[error.errorCode] = (errorCodesTotalCount[error.errorCode] || 0) + 1;

      if (error.statusCode >= 500) severityCounts.critical++;
      else if (error.statusCode >= 400) severityCounts.warning++;
      else severityCounts.info++;
    }

    res.json({
      timestamp: new Date(),
      provider,
      metrics,
      topErrors: Object.entries(errorCodesTotalCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([code, count]) => ({ code, count })),
      severityDistribution: severityCounts,
      recentErrors: recentErrors.slice(0, 10),
    });
  } catch (error) {
    logger.error('Error fetching provider metrics', { error });
    res.status(500).json({ error: 'Failed to fetch provider metrics' });
  }
});

/**
 * GET /api/admin/errors/by-operation/:operation
 * Get metrics for a specific operation type (deposit, withdrawal, etc.)
 */
router.get('/errors/by-operation/:operation', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { operation } = req.params;
    const metrics = PaymentErrorMonitoringService.getOperationMetrics(operation);

    res.json({
      timestamp: new Date(),
      ...metrics,
    });
  } catch (error) {
    logger.error('Error fetching operation metrics', { error });
    res.status(500).json({ error: 'Failed to fetch operation metrics' });
  }
});

/**
 * GET /api/admin/errors/health
 * Real-time health check of error monitoring system
 */
router.get('/errors/health', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const health = PaymentErrorMonitoringService.getHealthCheck();

    res.json({
      timestamp: new Date(),
      ...health,
    });
  } catch (error) {
    logger.error('Error fetching health check', { error });
    res.status(500).json({ error: 'Failed to fetch health check' });
  }
});

/**
 * GET /api/admin/errors/recent
 * Get recent errors with pagination
 */
router.get('/errors/recent', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const errors = PaymentErrorMonitoringService.getRecentErrors(limit);

    res.json({
      timestamp: new Date(),
      count: errors.length,
      errors,
    });
  } catch (error) {
    logger.error('Error fetching recent errors', { error });
    res.status(500).json({ error: 'Failed to fetch recent errors' });
  }
});

/**
 * GET /api/admin/errors/time-range
 * Get errors within a specific time range
 * Query params: startTime, endTime (ISO 8601 format)
 */
router.get('/errors/time-range', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        error: 'Missing required query parameters: startTime, endTime',
      });
    }

    const start = new Date(startTime as string);
    const end = new Date(endTime as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use ISO 8601 format.',
      });
    }

    const errors = PaymentErrorMonitoringService.getErrorsByTimeRange(start, end);

    res.json({
      timestamp: new Date(),
      timeRange: { startTime: start, endTime: end },
      count: errors.length,
      errors,
    });
  } catch (error) {
    logger.error('Error fetching errors by time range', { error });
    res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

/**
 * GET /api/admin/errors/summary
 * Quick summary of error metrics for dashboard cards
 */
router.get('/errors/summary', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const aggregation = PaymentErrorMonitoringService.getAggregation();
    const health = PaymentErrorMonitoringService.getHealthCheck();
    const allProviders = PaymentErrorMonitoringService.getAllProviderMetrics();

    const criticalErrorCount = allProviders.reduce((sum, p) => sum + p.criticalErrors, 0);
    const totalErrorRate = allProviders.reduce((sum, p) => sum + p.errorRate, 0) / allProviders.length;

    // Top 3 providers by error count
    const topProviders = allProviders
      .sort((a, b) => b.totalErrors - a.totalErrors)
      .slice(0, 3);

    res.json({
      timestamp: new Date(),
      overallHealth: health.status,
      errorMetrics: {
        last24Hours: aggregation.totalErrors,
        uniqueCodes: aggregation.uniqueErrorCodes,
        criticalErrors: criticalErrorCount,
        avgRetries: Math.round(aggregation.avgRetryCount * 100) / 100,
      },
      retrySuccess: {
        rate: Math.round(aggregation.retrySuccessRate * 100) / 100,
        percentage: `${Math.round(aggregation.retrySuccessRate)}%`,
      },
      providers: {
        total: allProviders.length,
        withErrors: allProviders.filter(p => p.totalErrors > 0).length,
        top3: topProviders.map(p => ({
          name: p.provider,
          errorCount: p.totalErrors,
          errorRate: Math.round(p.errorRate * 100) / 100,
        })),
      },
      trend: {
        topError: aggregation.mostCommonError,
        lastErrorTime: health.lastErrorTime,
      },
    });
  } catch (error) {
    logger.error('Error fetching error summary', { error });
    res.status(500).json({ error: 'Failed to fetch error summary' });
  }
});

/**
 * POST /api/admin/errors/clear (DANGEROUS - Testing Only)
 * Clear all error monitoring data
 * Only available in development environment
 */
router.post('/errors/clear', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Cannot clear error data in production environment',
      });
    }

    PaymentErrorMonitoringService.clear();
    logger.warn('Error monitoring data cleared by admin');

    res.json({
      success: true,
      message: 'Error monitoring data cleared',
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error clearing monitoring data', { error });
    res.status(500).json({ error: 'Failed to clear error data' });
  }
});

export default router;
