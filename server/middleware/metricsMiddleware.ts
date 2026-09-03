import type { Request, Response, NextFunction } from 'express';
import { endpointMetricsCollector } from '../services/endpointMetricsCollector';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

const DEFAULT_IGNORED_PREFIXES = [
  '/api/docs',
  '/api/visibility',
  '/health',
  '/api/health',
];

/**
 * Middleware to collect endpoint metrics
 */
export function metricsMiddleware(ignoredPrefixes: string[] = DEFAULT_IGNORED_PREFIXES) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip metrics collection for ignored routes
    if (ignoredPrefixes.some((prefix) => req.path.startsWith(prefix))) {
      return next();
    }

    // Monotonic high-resolution start time
    const startTime = process.hrtime.bigint();

    // Attach listener to response finish event
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const latency = Number(endTime - startTime) / 1e6; // Convert nanoseconds to milliseconds
      const statusCode = res.statusCode;
      const method = req.method;

      // Use parameterized route template (e.g., /api/users/:id) to prevent cardinality explosion
      const routePath = req.route ? `${req.baseUrl || ''}${req.route.path}` : req.path;

      try {
        if (statusCode >= 400) {
          const errorMessage = res.statusMessage || `HTTP ${statusCode}`;
          endpointMetricsCollector.recordError(routePath, method, latency, statusCode, errorMessage);
        } else {
          endpointMetricsCollector.recordSuccess(routePath, method, latency, statusCode);
        }

        // Log slow requests (> 1000ms)
        if (latency > 1000) {
          logger.warn(`[METRICS] Slow request: ${method} ${routePath} - ${Math.round(latency)}ms`);
        }
      } catch (error) {
        logger.error('[METRICS] Error recording metrics:', error);
      }
    });

    next();
  };
}

/**
 * Report slow endpoints periodically
 */
export function startMetricsReporting(intervalMs: number = 300000): NodeJS.Timeout {
  const timer = setInterval(() => {
    try {
      const slowest = endpointMetricsCollector.getSlowestEndpoints(5);
      const highErrors = endpointMetricsCollector.getHighestErrorRates(3);

      if (slowest.length > 0) {
        logger.info('[METRICS] Top 5 slowest endpoints:');
        slowest.forEach((m) => {
          logger.info(`  - ${m.method} ${m.path}: ${Math.round(m.avgLatency)}ms avg (${m.callCount} calls)`);
        });
      }

      if (highErrors.length > 0) {
        logger.warn('[METRICS] Top 3 highest error rates:');
        highErrors.forEach((m) => {
          logger.warn(`  - ${m.method} ${m.path}: ${m.errorRate}% errors (${m.errorCount}/${m.callCount})`);
        });
      }

      const summary = endpointMetricsCollector.getSummary();
      logger.info(
        `[METRICS] Summary: ${summary.totalEndpoints} endpoints, ${summary.totalCalls} total calls, ${summary.overallErrorRate}% error rate`
      );
    } catch (error) {
      logger.error('[METRICS] Error reporting metrics:', error);
    }
  }, intervalMs);

  // Allow Node process to exit gracefully if this timer is active
  timer.unref();

  return timer;
}