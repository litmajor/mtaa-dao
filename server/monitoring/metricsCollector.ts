
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';

// Simple Prometheus-style metrics (without external dependency)
class PrometheusMetrics {
  private metrics: Map<string, any> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  counter(name: string, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  getMetrics(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters.entries()) {
      lines.push(`# TYPE ${key.split('{')[0]} counter`);
      lines.push(`${key} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges.entries()) {
      lines.push(`# TYPE ${key.split('{')[0]} gauge`);
      lines.push(`${key} ${value}`);
    }

    // Histograms
    for (const [key, values] of this.histograms.entries()) {
      const baseName = key.split('{')[0];
      lines.push(`# TYPE ${baseName} histogram`);
      
      const sorted = values.sort((a, b) => a - b);
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);

      lines.push(`${key.replace('}', ',quantile="0.5"}')} ${this.quantile(sorted, 0.5)}`);
      lines.push(`${key.replace('}', ',quantile="0.95"}')} ${this.quantile(sorted, 0.95)}`);
      lines.push(`${key.replace('}', ',quantile="0.99"}')} ${this.quantile(sorted, 0.99)}`);
      lines.push(`${baseName}_count${key.includes('{') ? key.substring(key.indexOf('{')) : ''} ${count}`);
      lines.push(`${baseName}_sum${key.includes('{') ? key.substring(key.indexOf('{')) : ''} ${sum}`);
    }

    return lines.join('\n');
  }

  private quantile(sorted: number[], q: number): number {
    const index = Math.ceil(sorted.length * q) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

const prometheus = new PrometheusMetrics();

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
    
    // Update Prometheus metrics
    prometheus.counter('http_requests_total', {
      method: metric.method,
      route: metric.route,
      status: metric.statusCode.toString()
    });
    
    prometheus.histogram('http_request_duration_ms', metric.responseTime, {
      method: metric.method,
      route: metric.route
    });

    if (metric.statusCode >= 400) {
      prometheus.counter('http_request_errors_total', {
        method: metric.method,
        route: metric.route,
        status: metric.statusCode.toString()
      });
    }
    
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
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metric: SystemMetrics = {
      timestamp: Date.now(),
      memory: memoryUsage,
      uptime: process.uptime(),
      activeConnections: this.activeConnections,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      avgResponseTime: this.getAverageResponseTime(),
      cpuUsage: cpuUsage.user / 1000000 // Convert to seconds
    };

    this.metrics.system.push(metric);
    
    // Update Prometheus metrics
    prometheus.gauge('nodejs_memory_usage_bytes', memoryUsage.heapUsed, { type: 'heap_used' });
    prometheus.gauge('nodejs_memory_usage_bytes', memoryUsage.heapTotal, { type: 'heap_total' });
    prometheus.gauge('nodejs_memory_usage_bytes', memoryUsage.external, { type: 'external' });
    prometheus.gauge('process_uptime_seconds', process.uptime());
    prometheus.gauge('http_requests_total', this.requestCount);
    prometheus.gauge('http_request_errors_total', this.errorCount);
    prometheus.gauge('http_request_duration_ms', this.getAverageResponseTime());
    prometheus.gauge('http_active_connections', this.activeConnections);
    
    // Log memory warnings
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
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

    // Update health score in Prometheus
    prometheus.gauge('application_health_score', score);

    return Math.max(0, score);
  }

  public getPrometheusMetrics(): string {
    return prometheus.getMetrics();
  }

  public addBusinessMetrics(metrics: any) {
    // Add business metrics to Prometheus
    prometheus.gauge('business_active_users', metrics.activeUsers);
    prometheus.gauge('business_total_transactions', metrics.totalTransactions);
    prometheus.gauge('business_total_volume_usd', metrics.totalVolumeUSD);
    prometheus.gauge('business_total_proposals', metrics.totalProposals);
    prometheus.gauge('business_active_vaults', metrics.activeVaults);
    prometheus.gauge('business_total_staked', metrics.totalStaked);
    
    this.addBusinessMetric(metrics);
  }
}

export const metricsCollector = MetricsCollector.getInstance();
