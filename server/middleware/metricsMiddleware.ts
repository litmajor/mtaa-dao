/**
 * 📈 Endpoint Metrics Middleware
 * 
 * Transparently tracks metrics for every API request/response
 * - Minimal overhead (timing only)
 * - Ignores /api/docs* and health check endpoints
 * - Captures status codes and errors
 */

import { Request, Response, NextFunction } from 'express';
import { endpointMetricsCollector } from '../services/endpointMetricsCollector';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

/**
 * Middleware to collect endpoint metrics
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip metrics collection for documentation and visibility endpoints
    if (req.path.startsWith('/api/docs') || req.path.startsWith('/api/visibility')) {
      return next();
    }

    // Record start time
    const startTime = Date.now();

    // Wrap response.send to capture when response actually completes
    const originalSend = res.send;
    res.send = function (data: any) {
      const latency = Date.now() - startTime;
      const statusCode = res.statusCode;
      const path = req.path;
      const method = req.method;

      try {
        // Record metrics
        if (statusCode >= 400) {
          // Error response
          const error = typeof data === 'string' ? data.substring(0, 100) : JSON.stringify(data).substring(0, 100);
          endpointMetricsCollector.recordError(path, method, latency, statusCode, error);
        } else {
          // Success response
          endpointMetricsCollector.recordSuccess(path, method, latency, statusCode);
        }

        // Log slow requests (> 1s)
        if (latency > 1000) {
          logger.warn(`[METRICS] Slow request: ${method} ${path} - ${latency}ms`);
        }
      } catch (error) {
        logger.error('[METRICS] Error recording metrics:', error);
      }

      // Call original send
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Report slow endpoints periodically
 */
export function startMetricsReporting(intervalMs: number = 300000) {
  // Report every 5 minutes by default
  setInterval(() => {
    const slowest = endpointMetricsCollector.getSlowestEndpoints(5);
    const highErrors = endpointMetricsCollector.getHighestErrorRates(3);

    if (slowest.length > 0) {
      logger.info('[METRICS] Top 5 slowest endpoints:');
      slowest.forEach((m) => {
        logger.info(`  - ${m.method} ${m.path}: ${m.avgLatency}ms avg (${m.callCount} calls)`);
      });
    }

    if (highErrors.length > 0) {
      logger.warn('[METRICS] Top 3 highest error rates:');
      highErrors.forEach((m) => {
        logger.warn(`  - ${m.method} ${m.path}: ${m.errorRate}% errors (${m.errorCount}/${m.callCount})`);
      });
    }

    // Overall summary
    const summary = endpointMetricsCollector.getSummary();
    logger.info(`[METRICS] Summary: ${summary.totalEndpoints} endpoints, ${summary.totalCalls} total calls, ${summary.overallErrorRate}% error rate`);
  }, intervalMs);
}
