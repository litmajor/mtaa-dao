/**
 * 📊 Route Usage Logging Middleware
 * 
 * Tracks real traffic:
 * - Every HTTP request logged
 * - Timestamp, method, URL, status, duration
 * - Appends to CSV file for analysis
 * 
 * Usage:
 * app.use(routeUsageLogger(logFilePath))
 */

import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RouteUsageEntry {
  timestamp: string;
  method: string;
  url: string;
  path: string;
  status: number;
  duration: number;
  ip: string;
  userAgent: string;
}

/**
 * Create route usage logging middleware
 */
export function createRouteUsageLogger(logFilePath?: string) {
  const filePath = logFilePath || path.join(process.cwd(), 'route-usage.csv');
  let headerWritten = false;

  // Ensure directory exists (sync at startup is acceptable)
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create a writable stream for non-blocking append
  const stream = fs.createWriteStream(filePath, { flags: 'a' });
  try {
    const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    if (!stats || stats.size === 0) {
      const header = 'TIMESTAMP,METHOD,PATH,URL,STATUS,DURATION_MS,IP,USER_AGENT\n';
      stream.write(header);
      headerWritten = true;
    }
  } catch (err) {
    logger.error('Failed to initialize route usage stream:', err);
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    // Capture the original send function
    const originalSend = res.send;

    res.send = function (data) {
      LogRequest(res.statusCode);
      return originalSend.call(this, data);
    };

    res.on('finish', () => {
      // Only log if not already logged via redirect/send
      if (res.statusCode !== 304) {
        // Don't double-log
        LogRequest(res.statusCode);
      }
    });

    function LogRequest(status: number) {
      try {
        const duration = Date.now() - start;
        const timestamp = new Date().toISOString();

        const logLine = [
          timestamp,
          req.method,
          req.path,
          req.originalUrl,
          status,
          duration,
          ip,
          userAgent.substring(0, 100).replace(/,/g, ';'), // Escape commas in user agent
        ];

        const csv = logLine.map(v => `"${v}"`).join(',') + '\n';

        // Non-blocking write to stream
        stream.write(csv);
      } catch (error) {
        logger.error('Failed to log route usage:', error);
      }
    }

    next();
  };
}

/**
 * Parse route usage CSV file
 */
export function parseRouteUsageLog(logFilePath: string): RouteUsageEntry[] {
  try {
    if (!fs.existsSync(logFilePath)) {
      return [];
    }

    const content = fs.readFileSync(logFilePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    // Skip header
    return lines.slice(1).map(line => {
      const parts = line.split(',').map(p => p.replace(/^"|"$/g, ''));
      return {
        timestamp: parts[0],
        method: parts[1],
        path: parts[2],
        url: parts[3],
        status: parseInt(parts[4], 10),
        duration: parseInt(parts[5], 10),
        ip: parts[6],
        userAgent: parts[7],
      };
    });
  } catch (error) {
    logger.error('Failed to parse route usage log:', error);
    return [];
  }
}

/**
 * Analyze route usage
 */
export function analyzeRouteUsage(logFilePath: string) {
  const entries = parseRouteUsageLog(logFilePath);

  if (entries.length === 0) {
    return null;
  }

  const analysis = {
    totalRequests: entries.length,
    timeRange: {
      start: entries[0]?.timestamp,
      end: entries[entries.length - 1]?.timestamp,
    },
    byPath: {} as Record<
      string,
      {
        count: number;
        methods: Set<string>;
        avgDuration: number;
        statuses: Set<number>;
      }
    >,
    byMethod: {} as Record<
      string,
      {
        count: number;
        avgDuration: number;
        statusDistribution: Record<number, number>;
      }
    >,
    statusDistribution: {} as Record<number, number>,
    slowestPaths: [] as Array<{
      path: string;
      avgDuration: number;
      count: number;
    }>,
    topPaths: [] as Array<{ path: string; count: number }>,
  };

  // Aggregate by path
  entries.forEach(entry => {
    const path = entry.path;

    if (!analysis.byPath[path]) {
      analysis.byPath[path] = {
        count: 0,
        methods: new Set(),
        avgDuration: 0,
        statuses: new Set(),
      };
    }

    analysis.byPath[path].count++;
    analysis.byPath[path].methods.add(entry.method);
    analysis.byPath[path].avgDuration =
      (analysis.byPath[path].avgDuration * (analysis.byPath[path].count - 1) +
        entry.duration) /
      analysis.byPath[path].count;
    analysis.byPath[path].statuses.add(entry.status);

    // By method
    if (!analysis.byMethod[entry.method]) {
      analysis.byMethod[entry.method] = {
        count: 0,
        avgDuration: 0,
        statusDistribution: {},
      };
    }

    analysis.byMethod[entry.method].count++;
    analysis.byMethod[entry.method].statusDistribution[entry.status] =
      (analysis.byMethod[entry.method].statusDistribution[entry.status] || 0) +
      1;

    // Status distribution
    analysis.statusDistribution[entry.status] =
      (analysis.statusDistribution[entry.status] || 0) + 1;
  });

  // Calculate slowest paths
  analysis.slowestPaths = Object.entries(analysis.byPath)
    .map(([path, data]) => ({
      path,
      avgDuration: data.avgDuration,
      count: data.count,
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 20);

  // Calculate top paths
  analysis.topPaths = Object.entries(analysis.byPath)
    .map(([path, data]) => ({
      path,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Convert Sets to arrays for JSON serialization
  const cleanAnalysis = {
    ...analysis,
    byPath: Object.fromEntries(
      Object.entries(analysis.byPath).map(([path, data]) => [
        path,
        {
          ...data,
          methods: Array.from(data.methods),
          statuses: Array.from(data.statuses),
        },
      ])
    ),
  };

  return cleanAnalysis;
}

/**
 * Export analysis to files
 */
export function exportRouteUsageAnalysis(
  logFilePath: string,
  outputDir = '.'
) {
  const analysis = analyzeRouteUsage(logFilePath);

  if (!analysis) {
    console.warn('⚠️  No usage data to analyze');
    return null;
  }

  // Export JSON
  const jsonPath = path.join(outputDir, 'route-usage-analysis.json');
  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
  console.log(`✅ Usage analysis exported to: ${jsonPath}`);

  // Export top paths CSV
  const topPathsCsvPath = path.join(outputDir, 'route-usage-top-paths.csv');
  const topPathsCsv =
    'PATH,COUNT,RANK\n' +
    analysis.topPaths
      .map(
        (p, i) =>
          `"${p.path}",${p.count},${i + 1}`
      )
      .join('\n');
  fs.writeFileSync(topPathsCsvPath, topPathsCsv);
  console.log(`✅ Top paths exported to: ${topPathsCsvPath}`);

  // Export slowest paths CSV
  const slowestPathsCsvPath = path.join(
    outputDir,
    'route-usage-slowest-paths.csv'
  );
  const slowestPathsCsv =
    'PATH,AVG_DURATION_MS,COUNT,RANK\n' +
    analysis.slowestPaths
      .map(
        (p, i) =>
          `"${p.path}",${p.avgDuration.toFixed(2)},${p.count},${i + 1}`
      )
      .join('\n');
  fs.writeFileSync(slowestPathsCsvPath, slowestPathsCsv);
  console.log(`✅ Slowest paths exported to: ${slowestPathsCsvPath}`);

  // Console summary
  console.log('\n📊 Route Usage Analysis Summary:');
  console.log(`   Total Requests: ${analysis.totalRequests}`);
  console.log(`   Time Range: ${analysis.timeRange.start} to ${analysis.timeRange.end}`);
  console.log(`\n   Status Distribution:`);
  Object.entries(analysis.statusDistribution).forEach(([status, count]) => {
    console.log(`      ${status}: ${count}`);
  });
  console.log(`\n   Top 5 Paths:`);
  analysis.topPaths.slice(0, 5).forEach((p, i) => {
    console.log(`      ${i + 1}. ${p.path}: ${p.count} requests`);
  });
  console.log(`\n   Slowest 5 Paths (avg):`);
  analysis.slowestPaths.slice(0, 5).forEach((p, i) => {
    console.log(`      ${i + 1}. ${p.path}: ${p.avgDuration.toFixed(2)}ms (${p.count} requests)`);
  });

  return analysis;
}

export const routeUsageLogger = createRouteUsageLogger();
export default routeUsageLogger;
