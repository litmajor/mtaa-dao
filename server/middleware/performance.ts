import type { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';

export interface SlowQueryRecord {
  query: string;
  duration: number;
  timestamp: Date;
}

/**
 * Performance monitoring middleware
 * Captures high-precision response timing and logs slow requests
 */
export function performanceMonitor(slowThresholdMs: number = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();

    // Intercept writeHead to set performance headers before stream flushes
    const originalWriteHead: typeof res.writeHead = res.writeHead.bind(res);
    res.writeHead = function (
      statusCode: number,
      statusMessageOrHeaders?: string | Record<string, string | number | string[] | undefined> | number[],
      headers?: Record<string, string | number | string[] | undefined>,
    ) {
      if (!res.headersSent) {
        const duration = Math.round(performance.now() - start);
        res.setHeader('X-Response-Time', `${duration}ms`);
      }

      if (typeof statusMessageOrHeaders === 'string') {
        return originalWriteHead(statusCode, statusMessageOrHeaders, headers as any);
      }

      if (statusMessageOrHeaders !== undefined) {
        return originalWriteHead(statusCode, statusMessageOrHeaders as any);
      }

      return originalWriteHead(statusCode);
    } as typeof res.writeHead;

    // Log metric on response completion
    res.on('finish', () => {
      const duration = Math.round(performance.now() - start);
      
      if (duration > slowThresholdMs) {
        logger.warn(`Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`, {
          method: req.method,
          url: req.originalUrl,
          duration,
          statusCode: res.statusCode,
        });
      }
    });

    next();
  };
}

/**
 * Database query performance tracker with ring-buffer storage & parameter sanitization
 */
class QueryPerformanceTracker {
  private slowQueries: SlowQueryRecord[] = [];
  private readonly maxSlowQueries = 100;
  private readonly slowQueryThreshold = 500; // ms

  /**
   * Sanitizes SQL queries by replacing literal values with placeholders
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/'[^']*'/g, "'?'") // Strip string literals
      .replace(/\b\d+\b/g, '?')  // Strip numeric literals
      .substring(0, 300);        // Truncate length
  }

  trackQuery(query: string, duration: number) {
    if (duration > this.slowQueryThreshold) {
      const sanitized = this.sanitizeQuery(query);
      const record: SlowQueryRecord = {
        query: sanitized,
        duration: Math.round(duration),
        timestamp: new Date(),
      };

      if (this.slowQueries.length >= this.maxSlowQueries) {
        this.slowQueries.shift();
      }
      this.slowQueries.push(record);

      logger.warn(`Slow query detected: ${Math.round(duration)}ms`, {
        query: sanitized,
        duration: Math.round(duration),
      });
    }
  }

  getSlowQueries(): ReadonlyArray<SlowQueryRecord> {
    return [...this.slowQueries];
  }

  clearSlowQueries() {
    this.slowQueries = [];
  }
}

export const queryPerformanceTracker = new QueryPerformanceTracker();