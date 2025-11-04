import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Performance monitoring middleware
 * Tracks and logs slow requests
 */
export function performanceMonitor(slowThreshold: number = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // Override res.end to measure timing before headers are sent
    const originalEnd = res.end.bind(res);
    res.end = function(...args: any[]) {
      const duration = Date.now() - start;
      
      // Set performance header before headers are sent
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${duration}ms`);
      }
      
      // Log slow requests
      if (duration > slowThreshold) {
        logger.warn(`Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`, {
          method: req.method,
          url: req.originalUrl,
          duration,
          statusCode: res.statusCode,
        });
      }
      
      return originalEnd(...args);
    };
    
    next();
  };
}

/**
 * Database query performance tracker
 */
class QueryPerformanceTracker {
  private slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
  }> = [];
  
  private maxSlowQueries = 100;
  private slowQueryThreshold = 500; // ms

  trackQuery(query: string, duration: number) {
    if (duration > this.slowQueryThreshold) {
      this.slowQueries.push({
        query: query.substring(0, 200), // Truncate long queries
        duration,
        timestamp: new Date(),
      });
      
      // Keep only recent slow queries
      if (this.slowQueries.length > this.maxSlowQueries) {
        this.slowQueries.shift();
      }
      
      logger.warn(`Slow query detected: ${duration}ms`, {
        query: query.substring(0, 200),
        duration,
      });
    }
  }

  getSlowQueries() {
    return this.slowQueries;
  }

  clearSlowQueries() {
    this.slowQueries = [];
  }
}

export const queryPerformanceTracker = new QueryPerformanceTracker();
