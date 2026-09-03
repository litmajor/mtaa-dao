/**
 * Deprecation Monitoring & Analytics
 * Tracks usage of deprecated endpoints for migration planning
 */

import type { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { cacheService } from '../services/cacheService';

const logger = new Logger('deprecation-monitor');

/**
 * Redis and In-memory storage for deprecation metrics
 * Time series database considered
 */
const MAX_UNIQUE_USERS_PER_ENDPOINT = 1000;
const DEPRECATION_CACHE_PREFIX = 'deprecation-monitor:';

class DeprecationMonitor {
  private metrics = new Map<string, {
    endpoint: string;
    count: number;
    lastUsed: Date;
    users: Map<string, number>;
    errors: number;
    avgResponseTime: number;
  }>();

  private requestTimings = new Map<string, number[]>();

  private async persistMetricToRedis(endpoint: string, metric: { endpoint: string; count: number; lastUsed: string; users: string[]; errors: number; avgResponseTime: number }) {
    try {
      const key = `${DEPRECATION_CACHE_PREFIX}${endpoint}`;
      await cacheService.set(key, metric, 60 * 60 * 24 * 7); // 7-day retention
    } catch (error) {
      logger.debug('[DEPRECATION] Redis persistence unavailable', { endpoint, error });
    }
  }

  /**
   * Record deprecated endpoint usage
   */
  recordUsage(
    endpoint: string,
    userId: string | null,
    statusCode: number,
    responseTimeMs: number
  ) {
    const key = endpoint;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        endpoint,
        count: 0,
        lastUsed: new Date(),
        users: new Map(),
        errors: 0,
        avgResponseTime: 0,
      });
    }

    const metric = this.metrics.get(key)!;
    metric.count++;
    metric.lastUsed = new Date();

    if (userId) {
      if (!metric.users.has(userId)) {
        if (metric.users.size >= MAX_UNIQUE_USERS_PER_ENDPOINT) {
          const oldestUser = metric.users.keys().next().value;
          if (oldestUser) metric.users.delete(oldestUser);
        }
        metric.users.set(userId, Date.now());
      } else {
        metric.users.set(userId, Date.now());
      }
    }

    if (statusCode >= 400) {
      metric.errors++;
    }

    // Track response times
    if (!this.requestTimings.has(key)) {
      this.requestTimings.set(key, []);
    }
    this.requestTimings.get(key)!.push(responseTimeMs);

    // Calculate average response time (keep last 100 samples)
    const timings = this.requestTimings.get(key)!;
    if (timings.length > 100) {
      timings.shift();
    }
    const sum = timings.reduce((a, b) => a + b, 0);
    metric.avgResponseTime = Math.round(sum / timings.length);

    const snapshot = {
      endpoint: metric.endpoint,
      count: metric.count,
      lastUsed: metric.lastUsed.toISOString(),
      users: Array.from(metric.users.keys()),
      errors: metric.errors,
      avgResponseTime: metric.avgResponseTime,
    };

    void this.persistMetricToRedis(endpoint, snapshot);

    logger.debug(`[DEPRECATION] Endpoint usage recorded`, {
      endpoint,
      userId,
      statusCode,
      responseTimeMs,
      totalUsage: metric.count,
    });
  }

  /**
   * Get metrics for all deprecated endpoints
   */
  getMetrics() {
    const data: any[] = [];

    for (const [key, metric] of this.metrics.entries()) {
      data.push({
        endpoint: metric.endpoint,
        usage_count: metric.count,
        unique_users: metric.users.size,
        error_count: metric.errors,
        error_rate: `${((metric.errors / metric.count) * 100).toFixed(1)}%`,
        avg_response_time_ms: metric.avgResponseTime,
        last_used: metric.lastUsed.toISOString(),
      });
    }

    return data.sort((a, b) => b.usage_count - a.usage_count);
  }

  /**
   * Export metrics to JSON file for analysis
   */
  async exportMetrics(filePath?: string) {
    const file = filePath || path.join(process.cwd(), 'deprecation-metrics.json');
    const data = {
      exportedAt: new Date().toISOString(),
      metrics: this.getMetrics(),
      summary: {
        total_deprecated_endpoints: this.metrics.size,
        total_requests: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.count, 0),
        total_unique_users: new Set(
          Array.from(this.metrics.values()).flatMap(m => Array.from(m.users.keys()))
        ).size,
      },
    };

    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
    logger.info(`[DEPRECATION] Metrics exported to ${file}`);

    return data;
  }

  /**
   * Get HTML report of deprecated endpoint usage
   */
  generateHTMLReport(): string {
    const metrics = this.getMetrics();
    const timestamp = new Date().toISOString();

    const rows = metrics
      .map(
        m => `
      <tr>
        <td><code>${m.endpoint}</code></td>
        <td style="text-align: center;">${m.usage_count}</td>
        <td style="text-align: center;">${m.unique_users}</td>
        <td style="text-align: center;">${m.error_count}</td>
        <td style="text-align: center;">${m.error_rate}</td>
        <td style="text-align: center;">${m.avg_response_time_ms}ms</td>
        <td>${m.last_used.substring(0, 10)}</td>
      </tr>
    `
      )
      .join('\n');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Deprecation Monitoring Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; margin: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .warning { background-color: #fff3cd; padding: 12px; border-radius: 4px; margin: 20px 0; }
        .migration-guide { background-color: #e8f4f8; padding: 12px; border-left: 4px solid #0288d1; margin: 20px 0; }
        code { background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>Deprecation Monitoring Report</h1>
      <p><strong>Generated:</strong> ${timestamp}</p>
      
      <div class="warning">
        <h3>⚠️ Migration Notice</h3>
        <p>The following endpoints will be removed in <strong>90 days</strong>.</p>
        <p>Please migrate to the new consolidated routes under <code>/api/dao/:daoId/...</code></p>
      </div>

      <h2>Deprecated Endpoint Usage</h2>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Requests</th>
            <th>Unique Users</th>
            <th>Errors</th>
            <th>Error Rate</th>
            <th>Avg Response</th>
            <th>Last Used</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <h2>Migration Guide</h2>
      <div class="migration-guide">
        <h3>Old Route → New Route</h3>
        <ul>
          <li><code>/api/governance/:daoId/*</code> → <code>/api/dao/:daoId/governance/*</code></li>
          <li><code>/api/dao-treasury/:daoId/*</code> → <code>/api/dao/:daoId/treasury/*</code></li>
          <li><code>/api/disbursements/:daoId/*</code> → <code>/api/dao/:daoId/disbursements/*</code></li>
        </ul>
      </div>

      <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
        <p>Report generated automatically by Deprecation Monitor</p>
      </footer>
    </body>
    </html>
  `;
  }

  /**
   * Clear metrics (useful for testing)
   */
  async clear() {
    this.metrics.clear();
    this.requestTimings.clear();
    try {
      await cacheService.deleteByPrefix(DEPRECATION_CACHE_PREFIX);
    } catch (error) {
      logger.debug('[DEPRECATION] Redis clear skipped', { error });
    }
  }
}

// Global instance
export const deprecationMonitor = new DeprecationMonitor();

/**
 * Middleware: Monitor deprecated endpoint usage
 *
 * @example
 * app.use('/api/governance/:daoId', trackDeprecatedEndpoint('/api/governance'));
 */
export interface DeprecatedEndpointOptions {
  sunsetDate?: Date | string | number;
  docsUrl?: string;
  deprecationMessage?: string;
}

export function trackDeprecatedEndpoint(
  endpoint: string,
  options: DeprecatedEndpointOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const userId = req.user?.id || req.user?.claims?.sub || null;
    const sunsetDate = new Date(options.sunsetDate ?? Date.now() + 90 * 24 * 60 * 60 * 1000);
    const docsUrl = options.docsUrl ?? 'https://docs.mtaadao.com/api-deprecations';
    const deprecationMessage =
      options.deprecationMessage || 'Deprecated API endpoint: migrate to the current DAO route structure.';

    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate.toUTCString());
    res.setHeader('Link', `<${docsUrl}>; rel="deprecation"`);
    res.setHeader('Warning', `299 - "${deprecationMessage}"`);

    let finalised = false;
    const finalize = () => {
      if (finalised) return;
      finalised = true;

      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode;

      deprecationMonitor.recordUsage(endpoint, userId, statusCode, responseTime);

      logger.warn(`[DEPRECATED] ${endpoint}`, {
        method: req.method,
        path: req.path,
        userId,
        statusCode,
        responseTimeMs: responseTime,
      });
    };

    res.once('finish', finalize);
    res.once('close', finalize);

    next();
  };
}

/**
 * Endpoint: Get deprecation metrics
 *
 * @example
 * app.get('/admin/deprecated-metrics', (req, res) => {
 *   res.json(deprecationMonitor.getMetrics());
 * });
 */
export function getDeprecationMetrics(req: Request, res: Response) {
  const metrics = deprecationMonitor.getMetrics();
  res.json({
    success: true,
    generatedAt: new Date().toISOString(),
    sunsetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    metrics,
  });
}

/**
 * Endpoint: Get deprecation report (HTML)
 *
 * @example
 * app.get('/admin/deprecated-report', (req, res) => {
 *   const html = deprecationMonitor.generateHTMLReport();
 *   res.contentType('text/html').send(html);
 * });
 */
export function getDeprecationReport(req: Request, res: Response) {
  const html = deprecationMonitor.generateHTMLReport();
  res.contentType('text/html').send(html);
}

/**
 * Endpoint: Export deprecation metrics to file
 *
 * @example
 * app.post('/admin/export-deprecation-metrics', (req, res) => {
 *   const data = deprecationMonitor.exportMetrics();
 *   res.json({ success: true, exported: data });
 * });
 */
export async function exportDeprecationMetrics(req: Request, res: Response) {
  try {
    const data = await deprecationMonitor.exportMetrics();
    res.json({
      success: true,
      message: 'Metrics exported to deprecation-metrics.json',
      summary: data.summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Export failed',
    });
  }
}

export default {
  deprecationMonitor,
  trackDeprecatedEndpoint,
  getDeprecationMetrics,
  getDeprecationReport,
  exportDeprecationMetrics,
};
