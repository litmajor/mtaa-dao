
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';

export interface SystemMetrics {
  timestamp: number;
  memory: NodeJS.MemoryUsage;
  uptime: number;
  activeConnections: number;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  cpuUsage: number;
}

export interface RequestMetrics {
  method: string;
  route: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
}

export interface DatabaseMetrics {
  activeConnections: number;
  totalQueries: number;
  slowQueries: number;
  avgQueryTime: number;
  errors: number;
}

export interface BusinessMetrics {
  activeUsers: number;
  totalTransactions: number;
  totalVolumeUSD: number;
  totalProposals: number;
  activeVaults: number;
  totalStaked: number;
}

class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: {
    requests: RequestMetrics[];
    system: SystemMetrics[];
    database: DatabaseMetrics[];
    business: BusinessMetrics[];
  };
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];
  private activeConnections = 0;

  private constructor() {
    this.metrics = {
      requests: [],
      system: [],
      database: [],
      business: []
    };
    
    // Collect system metrics every 30 seconds
    setInterval(() => this.collectSystemMetrics(), 30000);
    
    // Clean old metrics every hour
    setInterval(() => this.cleanOldMetrics(), 3600000);
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public requestMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      this.activeConnections++;

      res.on('finish', () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        this.requestCount++;
        this.responseTimes.push(responseTime);

        if (res.statusCode >= 400) {
          this.errorCount++;
        }

        const metric: RequestMetrics = {
          method: req.method,
          route: req.route?.path || req.path,
          statusCode: res.statusCode,
          responseTime,
          timestamp: Date.now(),
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: (req as any).user?.id
        };

        this.addRequestMetric(metric);
        this.activeConnections--;
      });

      next();
    };
  }

  private addRequestMetric(metric: RequestMetrics) {
    this.metrics.requests.push(metric);
    
    // Log slow requests
    if (metric.responseTime > 1000) {
      logger.warn(`Slow request: ${metric.method} ${metric.route} took ${metric.responseTime}ms`);
    }
    
    // Log errors
    if (metric.statusCode >= 500) {
      logger.error(`Server error: ${metric.method} ${metric.route} returned ${metric.statusCode}`);
    }
  }

  private collectSystemMetrics() {
    const metric: SystemMetrics = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      activeConnections: this.activeConnections,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      avgResponseTime: this.getAverageResponseTime(),
      cpuUsage: process.cpuUsage().user / 1000000 // Convert to seconds
    };

    this.metrics.system.push(metric);
    
    // Log memory warnings
    const memoryUsageMB = metric.memory.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 500) {
      logger.warn(`High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
    }
  }

  public addDatabaseMetric(metric: DatabaseMetrics) {
    this.metrics.database.push({
      ...metric,
      timestamp: Date.now()
    } as any);
  }

  public addBusinessMetric(metric: BusinessMetrics) {
    this.metrics.business.push({
      ...metric,
      timestamp: Date.now()
    } as any);
  }

  private getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.responseTimes.length;
  }

  private cleanOldMetrics() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    this.metrics.requests = this.metrics.requests.filter(m => m.timestamp > oneDayAgo);
    this.metrics.system = this.metrics.system.filter(m => m.timestamp > oneDayAgo);
    this.metrics.database = this.metrics.database.filter(m => (m as any).timestamp > oneDayAgo);
    this.metrics.business = this.metrics.business.filter(m => (m as any).timestamp > oneDayAgo);
    
    // Reset counters periodically
    this.responseTimes = this.responseTimes.slice(-1000); // Keep last 1000 response times
  }

  public getMetrics() {
    return {
      ...this.metrics,
      summary: {
        totalRequests: this.requestCount,
        totalErrors: this.errorCount,
        errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
        avgResponseTime: this.getAverageResponseTime(),
        activeConnections: this.activeConnections,
        uptime: process.uptime()
      }
    };
  }

  public getHealthScore(): number {
    const metrics = this.getMetrics();
    let score = 100;

    // Deduct points for high error rate
    if (metrics.summary.errorRate > 5) score -= 20;
    else if (metrics.summary.errorRate > 1) score -= 10;

    // Deduct points for slow response times
    if (metrics.summary.avgResponseTime > 1000) score -= 20;
    else if (metrics.summary.avgResponseTime > 500) score -= 10;

    // Deduct points for high memory usage
    const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsageMB > 1000) score -= 20;
    else if (memoryUsageMB > 500) score -= 10;

    return Math.max(0, score);
  }
}

export const metricsCollector = MetricsCollector.getInstance();
