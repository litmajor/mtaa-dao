/**
 * 📊 Endpoint Metrics Collector
 * 
 * Real-time metrics collection for all API endpoints
 * - Tracks: call count, response times, error rates, last access
 * - Keeps last 100 latency values (for percentile calculations)
 * - Memory-efficient circular buffer approach
 * - Agent-ready data format
 */

export interface EndpointMetrics {
  path: string;
  method: string;
  callCount: number;
  totalLatency: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorCount: number;
  errorRate: number; // percentage
  statusCodes: Record<number, number>; // e.g., { 200: 450, 400: 10, 500: 2 }
  lastAccessed: number; // timestamp
  lastResponseCode: number;
  lastError?: string;
  isHealthy: boolean; // errorRate < 5%
}

interface LatencyBuffer {
  values: number[];
  index: number;
  isFull: boolean;
}

class EndpointMetricsCollector {
  private metrics = new Map<string, {
    callCount: number;
    totalLatency: number;
    errorCount: number;
    statusCodes: Record<number, number>;
    lastAccessed: number;
    lastResponseCode: number;
    lastError?: string;
    latencies: LatencyBuffer;
  }>();

  private readonly BUFFER_SIZE = 100; // Keep last 100 latency measurements

  /**
   * Record a successful request
   */
  recordSuccess(path: string, method: string, latencyMs: number, statusCode: number = 200) {
    const key = this.getKey(path, method);
    this.ensureMetric(key);
    
    const metric = this.metrics.get(key)!;
    metric.callCount++;
    metric.totalLatency += latencyMs;
    metric.lastAccessed = Date.now();
    metric.lastResponseCode = statusCode;
    
    // Track status code
    metric.statusCodes[statusCode] = (metric.statusCodes[statusCode] || 0) + 1;
    
    // Add to latency buffer for percentile calculation
    this.addLatency(metric.latencies, latencyMs);
  }

  /**
   * Record a failed request
   */
  recordError(path: string, method: string, latencyMs: number, statusCode: number, error: string) {
    const key = this.getKey(path, method);
    this.ensureMetric(key);
    
    const metric = this.metrics.get(key)!;
    metric.callCount++;
    metric.errorCount++;
    metric.totalLatency += latencyMs;
    metric.lastAccessed = Date.now();
    metric.lastResponseCode = statusCode;
    metric.lastError = error;
    
    // Track status code
    metric.statusCodes[statusCode] = (metric.statusCodes[statusCode] || 0) + 1;
    
    // Add to latency buffer
    this.addLatency(metric.latencies, latencyMs);
  }

  /**
   * Get metrics for a single endpoint
   */
  getEndpointMetrics(path: string, method: string): EndpointMetrics | null {
    const key = this.getKey(path, method);
    const metric = this.metrics.get(key);
    
    if (!metric) return null;
    
    return this.compileMetrics(path, method, metric);
  }

  /**
   * Get metrics for all endpoints
   */
  getAllMetrics(): EndpointMetrics[] {
    const allMetrics: EndpointMetrics[] = [];
    
    this.metrics.forEach((metric, key) => {
      const [path, method] = key.split('|');
      allMetrics.push(this.compileMetrics(path, method, metric));
    });
    
    return allMetrics;
  }

  /**
   * Get metrics grouped by domain
   */
  getMetricsByDomain(): Record<string, EndpointMetrics[]> {
    const byDomain: Record<string, EndpointMetrics[]> = {};
    
    this.metrics.forEach((metric, key) => {
      const [path, method] = key.split('|');
      const compiled = this.compileMetrics(path, method, metric);
      
      // Extract domain from path: /api/domain/path → domain
      const pathParts = path.split('/').filter(Boolean);
      const domain = pathParts[1] || 'root';
      
      if (!byDomain[domain]) {
        byDomain[domain] = [];
      }
      byDomain[domain].push(compiled);
    });
    
    return byDomain;
  }

  /**
   * Get slowest endpoints
   */
  getSlowestEndpoints(limit: number = 10): EndpointMetrics[] {
    return this.getAllMetrics()
      .sort((a, b) => b.avgLatency - a.avgLatency)
      .slice(0, limit);
  }

  /**
   * Get endpoints with highest error rates
   */
  getHighestErrorRates(limit: number = 10): EndpointMetrics[] {
    return this.getAllMetrics()
      .filter(m => m.callCount > 10) // Only include endpoints with adequate sample size
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const all = this.getAllMetrics();
    
    if (all.length === 0) {
      return {
        totalEndpoints: 0,
        totalCalls: 0,
        totalErrors: 0,
        overallErrorRate: 0,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        healthyEndpoints: 0,
        degradedEndpoints: 0,
        unhealthyEndpoints: 0,
      };
    }
    
    const totalCalls = all.reduce((sum, m) => sum + m.callCount, 0);
    const totalErrors = all.reduce((sum, m) => sum + m.errorCount, 0);
    const avgLatencies = all.map(m => m.avgLatency);
    const p95s = all.map(m => m.p95Latency);
    const p99s = all.map(m => m.p99Latency);
    
    const healthy = all.filter(m => m.isHealthy).length;
    const degraded = all.filter(m => !m.isHealthy && m.errorRate < 10).length;
    const unhealthy = all.filter(m => m.errorRate >= 10).length;
    
    return {
      totalEndpoints: all.length,
      totalCalls,
      totalErrors,
      overallErrorRate: totalCalls > 0 ? ((totalErrors / totalCalls) * 100).toFixed(2) : 0,
      avgLatency: (avgLatencies.reduce((a, b) => a + b, 0) / avgLatencies.length).toFixed(2),
      p95Latency: this.calculatePercentile(p95s, 95),
      p99Latency: this.calculatePercentile(p99s, 99),
      healthyEndpoints: healthy,
      degradedEndpoints: degraded,
      unhealthyEndpoints: unhealthy,
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
  }

  /**
   * Reset specific endpoint metrics
   */
  resetEndpoint(path: string, method: string) {
    const key = this.getKey(path, method);
    this.metrics.delete(key);
  }

  // ─────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────

  private getKey(path: string, method: string): string {
    return `${path}|${method}`;
  }

  private ensureMetric(key: string) {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        callCount: 0,
        totalLatency: 0,
        errorCount: 0,
        statusCodes: {},
        lastAccessed: 0,
        lastResponseCode: 0,
        latencies: { values: [], index: 0, isFull: false },
      });
    }
  }

  private addLatency(buffer: LatencyBuffer, value: number) {
    if (buffer.values.length < this.BUFFER_SIZE) {
      buffer.values.push(value);
    } else {
      buffer.values[buffer.index] = value;
      buffer.index = (buffer.index + 1) % this.BUFFER_SIZE;
      buffer.isFull = true;
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Math.round(sorted[Math.max(0, index)]);
  }

  private calculateLatencyPercentiles(buffer: LatencyBuffer) {
    const values = buffer.values.length === 0 ? [0] : buffer.values;
    const sorted = [...values].sort((a, b) => a - b);
    
    const p50Index = Math.floor((50 / 100) * sorted.length);
    const p95Index = Math.floor((95 / 100) * sorted.length);
    const p99Index = Math.floor((99 / 100) * sorted.length);
    
    return {
      p50: Math.round(sorted[Math.max(0, p50Index - 1)]),
      p95: Math.round(sorted[Math.max(0, p95Index - 1)]),
      p99: Math.round(sorted[Math.max(0, p99Index - 1)]),
    };
  }

  private compileMetrics(path: string, method: string, data: any): EndpointMetrics {
    const avgLatency = data.callCount > 0 ? data.totalLatency / data.callCount : 0;
    const errorRate = data.callCount > 0 ? (data.errorCount / data.callCount) * 100 : 0;
    const percentiles = this.calculateLatencyPercentiles(data.latencies);
    
    // Find min/max from buffer
    let minLatency = Infinity;
    let maxLatency = 0;
    data.latencies.values.forEach((val: number) => {
      minLatency = Math.min(minLatency, val);
      maxLatency = Math.max(maxLatency, val);
    });
    if (minLatency === Infinity) minLatency = 0;
    
    return {
      path,
      method,
      callCount: data.callCount,
      totalLatency: Math.round(data.totalLatency),
      avgLatency: Math.round(avgLatency),
      minLatency: Math.round(minLatency),
      maxLatency: Math.round(maxLatency),
      p50Latency: percentiles.p50,
      p95Latency: percentiles.p95,
      p99Latency: percentiles.p99,
      errorCount: data.errorCount,
      errorRate: parseFloat(errorRate.toFixed(2)),
      statusCodes: data.statusCodes,
      lastAccessed: data.lastAccessed,
      lastResponseCode: data.lastResponseCode,
      lastError: data.lastError,
      isHealthy: errorRate < 5,
    };
  }
}

export const endpointMetricsCollector = new EndpointMetricsCollector();
