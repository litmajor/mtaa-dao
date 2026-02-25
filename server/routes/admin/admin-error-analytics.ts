import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { requireRole } from '../../middleware/rbac';
import { PaymentErrorAnalyticsService } from '../../services/paymentErrorAnalyticsService';
import { PaymentErrorMonitoringService } from '../../services/paymentErrorMonitoringService';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

/**
 * ADMIN ERROR ANALYTICS ROUTES
 * Phase 3c Part 3 - Error trend analysis, root causes, and MTTR metrics
 */

/**
 * GET /api/admin/analytics/report
 * Generate comprehensive analytics report
 */
router.get('/analytics/report', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const hoursBack = Math.min(parseInt(req.query.hoursBack as string) || 24, 720); // Max 30 days
    const report = PaymentErrorAnalyticsService.generateReport(hoursBack);

    res.json({
      timestamp: new Date(),
      report,
    });
  } catch (error) {
    logger.error('Error generating analytics report', { error });
    res.status(500).json({ error: 'Failed to generate analytics report' });
  }
});

/**
 * GET /api/admin/analytics/trends/:errorCode
 * Get error trend data for specific error code
 */
router.get('/analytics/trends/:errorCode', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { errorCode } = req.params;
    const hours = Math.min(parseInt(req.query.hours as string) || 24, 168); // Max 7 days

    const trends = PaymentErrorAnalyticsService.calculateTrends(errorCode, hours);

    res.json({
      timestamp: new Date(),
      errorCode,
      hoursAnalyzed: hours,
      trendCount: trends.length,
      trends,
      summary: trends.length > 0 ? {
        totalOccurrences: trends.reduce((sum, t) => sum + t.count, 0),
        averageRate: trends.reduce((sum, t) => sum + t.rate, 0) / trends.length,
        overallTrend: trends[trends.length - 1]?.trend || 'stable',
      } : null,
    });
  } catch (error) {
    logger.error('Error fetching error trends', { error });
    res.status(500).json({ error: 'Failed to fetch error trends' });
  }
});

/**
 * GET /api/admin/analytics/root-cause/:errorCode
 * Analyze root cause for specific error
 */
router.get('/analytics/root-cause/:errorCode', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { errorCode } = req.params;
    const analysis = PaymentErrorAnalyticsService.analyzeRootCause(errorCode);

    res.json({
      timestamp: new Date(),
      analysis,
    });
  } catch (error) {
    logger.error('Error analyzing root cause', { error });
    res.status(500).json({
      error: `Failed to analyze root cause for ${req.params.errorCode}`,
    });
  }
});

/**
 * GET /api/admin/analytics/mttr/:errorCode
 * Get MTTR (Mean Time To Recovery) metrics for error
 */
router.get('/analytics/mttr/:errorCode', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { errorCode } = req.params;
    const mttr = PaymentErrorAnalyticsService.calculateMTTR(errorCode);

    res.json({
      timestamp: new Date(),
      mttr,
      analysis: {
        status: mttr.recoveryRate > 80 ? 'good' : mttr.recoveryRate > 50 ? 'fair' : 'poor',
        recommendation:
          mttr.recoveryRate > 80
            ? 'Recovery performance is good'
            : mttr.recoveryRate > 50
              ? 'Consider improving retry strategies'
              : 'Critical: Recovery rate is low - investigate immediately',
      },
    });
  } catch (error) {
    logger.error('Error calculating MTTR', { error });
    res.status(500).json({ error: 'Failed to calculate MTTR' });
  }
});

/**
 * GET /api/admin/analytics/anomalies
 * Detect anomalies in error patterns
 */
router.get('/analytics/anomalies', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const metric = (req.query.metric as string) || 'error_rate';
    const threshold = parseFloat(req.query.threshold as string) || 2;

    const anomalies = PaymentErrorAnalyticsService.detectAnomalies(metric, threshold);

    res.json({
      timestamp: new Date(),
      metric,
      threshold,
      anomaliesDetected: anomalies.length,
      anomalies,
      summary: {
        criticalAnomalies: anomalies.filter(a => a.confidence > 0.8).length,
        highConfidenceAnomalies: anomalies.filter(a => a.confidence > 0.6).length,
        mediumConfidenceAnomalies: anomalies.filter(a => a.confidence > 0.4).length,
      },
    });
  } catch (error) {
    logger.error('Error detecting anomalies', { error });
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

/**
 * GET /api/admin/analytics/correlations
 * Find correlated error codes
 */
router.get('/analytics/correlations', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const correlations = PaymentErrorAnalyticsService.findCorrelations();

    res.json({
      timestamp: new Date(),
      correlationCount: correlations.length,
      correlations,
      topCorrelations: correlations.slice(0, 5),
      insights: {
        strongestCorrelation: correlations[0],
        averageCorrelation:
          correlations.length > 0
            ? correlations.reduce((sum, c) => sum + c.correlation, 0) / correlations.length
            : 0,
      },
    });
  } catch (error) {
    logger.error('Error finding correlations', { error });
    res.status(500).json({ error: 'Failed to find correlations' });
  }
});

/**
 * GET /api/admin/analytics/mttr-summary
 * Get MTTR metrics for multiple error codes
 */
router.get('/analytics/mttr-summary', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    // Get top error codes
    const errors = PaymentErrorMonitoringService.getRecentErrors(500);
    const errorCodeMap: Record<string, number> = {};

    for (const error of errors) {
      errorCodeMap[error.errorCode] = (errorCodeMap[error.errorCode] || 0) + 1;
    }

    const topErrorCodes = Object.entries(errorCodeMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([code]) => code);

    // Calculate MTTR for each
    const mttrMetrics = topErrorCodes.map(code => PaymentErrorAnalyticsService.calculateMTTR(code));

    // Sort by recovery rate
    const sorted = mttrMetrics.sort((a, b) => b.recoveryRate - a.recoveryRate);

    res.json({
      timestamp: new Date(),
      metricsCount: sorted.length,
      metrics: sorted,
      summary: {
        averageRecoveryRate:
          sorted.length > 0
            ? sorted.reduce((sum, m) => sum + m.recoveryRate, 0) / sorted.length
            : 0,
        bestRecovery: sorted[0],
        worstRecovery: sorted[sorted.length - 1],
      },
    });
  } catch (error) {
    logger.error('Error calculating MTTR summary', { error });
    res.status(500).json({ error: 'Failed to calculate MTTR summary' });
  }
});

/**
 * GET /api/admin/analytics/error-distribution
 * Get error distribution across categories, providers, operations
 */
router.get('/analytics/error-distribution', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const aggregation = PaymentErrorMonitoringService.getAggregation();

    // Convert to array format for easier consumption
    const toDistribution = (obj: Record<string, any>) =>
      Object.entries(obj).map(([label, count]) => ({
        label,
        count,
        percentage: aggregation.totalErrors > 0
          ? ((count / aggregation.totalErrors) * 100).toFixed(2)
          : 0,
      }));

    res.json({
      timestamp: new Date(),
      totalErrors: aggregation.totalErrors,
      distribution: {
        byCategory: toDistribution(aggregation.errorsByCategory),
        byProvider: toDistribution(aggregation.errorsByProvider),
        byOperation: toDistribution(aggregation.errorsByOperation),
      },
    });
  } catch (error) {
    logger.error('Error getting error distribution', { error });
    res.status(500).json({ error: 'Failed to get error distribution' });
  }
});

/**
 * GET /api/admin/analytics/performance-metrics
 * Get overall performance and recovery metrics
 */
router.get('/analytics/performance-metrics', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const aggregation = PaymentErrorMonitoringService.getAggregation();
    const errors = PaymentErrorMonitoringService.getRecentErrors(500);

    // Calculate performance metrics
    const recoveryAttempts = errors.filter(e => e.retryCount > 0).length;
    const failedRecoveries = errors.filter(e => e.retryCount === 0).length;
    const recoveryRate = errors.length > 0 ? (recoveryAttempts / errors.length) * 100 : 0;

    // Calculate error rate trend
    const recentHourErrors = errors.filter(
      e => e.timestamp > new Date(Date.now() - 60 * 60 * 1000)
    );
    const olderErrors = errors.filter(
      e => e.timestamp <= new Date(Date.now() - 60 * 60 * 1000) &&
           e.timestamp > new Date(Date.now() - 120 * 60 * 1000)
    );

    const recentRate = recentHourErrors.length;
    const olderRate = olderErrors.length;
    const rateChange = olderRate > 0 ? ((recentRate - olderRate) / olderRate) * 100 : 0;

    // Calculate critical error percentage
    const criticalErrors = errors.filter(e => e.statusCode >= 500).length;
    const criticalPercentage = errors.length > 0 ? (criticalErrors / errors.length) * 100 : 0;

    res.json({
      timestamp: new Date(),
      metrics: {
        errorRecovery: {
          attemptedRecoveries: recoveryAttempts,
          failedRecoveries: failedRecoveries,
          recoveryRate: recoveryRate.toFixed(2),
        },
        errorRateTrend: {
          previousHour: olderRate,
          currentHour: recentRate,
          percentageChange: rateChange.toFixed(2),
          direction: rateChange > 5 ? 'increasing' : rateChange < -5 ? 'decreasing' : 'stable',
        },
        criticalErrors: {
          count: criticalErrors,
          percentage: criticalPercentage.toFixed(2),
          severity: criticalPercentage > 10 ? 'high' : criticalPercentage > 5 ? 'medium' : 'low',
        },
        overallHealth: {
          retrySuccessRate: aggregation.retrySuccessRate.toFixed(2),
          averageRetryAttempts: aggregation.avgRetryCount.toFixed(2),
          uniqueErrorCodes: aggregation.uniqueErrorCodes,
        },
      },
    });
  } catch (error) {
    logger.error('Error calculating performance metrics', { error });
    res.status(500).json({ error: 'Failed to calculate performance metrics' });
  }
});

/**
 * GET /api/admin/analytics/recommendations
 * Get AI-powered recommendations based on current errors
 */
router.get('/analytics/recommendations', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const report = PaymentErrorAnalyticsService.generateReport(24);
    const correlations = PaymentErrorAnalyticsService.findCorrelations();

    const recommendations = [
      ...report.recommendations,
      ...generateContextualRecommendations(report, correlations),
    ];

    // Remove duplicates
    const uniqueRecommendations = [...new Set(recommendations)];

    res.json({
      timestamp: new Date(),
      recommendationCount: uniqueRecommendations.length,
      recommendations: uniqueRecommendations,
      priority: {
        critical: uniqueRecommendations.filter(r => r.includes('Critical') || r.includes('immediately')).length,
        high: uniqueRecommendations.filter(r => r.includes('should') || r.includes('improve')).length,
        medium: uniqueRecommendations.length - uniqueRecommendations.filter(r => r.includes('Critical')).length,
      },
    });
  } catch (error) {
    logger.error('Error generating recommendations', { error });
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

/**
 * Helper function to generate contextual recommendations
 */
function generateContextualRecommendations(report: any, correlations: any[]): string[] {
  const recommendations: string[] = [];

  // Check summary metrics
  if (report.summary.totalErrors > 500) {
    recommendations.push('Consider implementing circuit breaker pattern to prevent cascading failures');
  }

  if (report.summary.averageErrorRate > 5) {
    recommendations.push('Error rate is above 5/hour - implement backpressure mechanisms');
  }

  // Check for correlated errors
  if (correlations.length > 5) {
    recommendations.push('Multiple error correlations detected - implement shared error handling');
  }

  // Check recovery metrics
  if (report.summary.averageRecoveryTime > 5000) {
    recommendations.push('Average recovery time exceeds 5 seconds - optimize timeout configurations');
  }

  // Check top errors
  if (report.topErrors.length > 0 && report.topErrors[0].count > report.summary.totalErrors * 0.2) {
    recommendations.push(`${report.topErrors[0].errorCode} represents >20% of errors - prioritize root cause analysis`);
  }

  return recommendations;
}

export default router;
