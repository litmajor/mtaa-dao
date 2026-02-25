/**
 * 🔎 System Visibility Dashboard
 * 
 * Unified interface to:
 * - Export route maps (structural)
 * - Analyze route usage (behavioral)
 * - Track external API calls
 * - Detect anomalies and duplication
 * 
 * Usage:
 * const visibility = new SystemVisibility(app)
 * visibility.generateAllReports()
 */

import {
  parseRouteUsageLog,
  analyzeRouteUsage,
  exportRouteUsageAnalysis,
} from './routeUsageLogger';
import {
  externalAPITracker,
  ExternalAPIType,
} from '../services/externalAPITracker';
import fs from 'fs';
import path from 'path';
import type { Express } from 'express';
import { logger } from '../utils/logger';

export interface VisibilityReport {
  timestamp: string;
  routes: {
    totalEndpoints: number;
    uniqueDomains: number;
    totalMethods: number;
    duplicates: Array<{
      path: string;
      count: number;
      methods: string[];
    }>;
  };
  usage: {
    totalRequests: number;
    timeRange: string;
    topPaths: Array<{ path: string; count: number }>;
    slowestPaths: Array<{
      path: string;
      avgDuration: number;
      count: number;
    }>;
    statusDistribution: Record<number, number>;
    averageResponseTime: number;
  };
  externalAPIs: {
    totalCalls: number;
    callsPerMinute: number;
    errorRate: number;
    byType: Record<ExternalAPIType, number>;
    byService: Record<string, number>;
    anomalies: Array<{
      type: string;
      severity: string;
      message: string;
    }>;
  };
  anomalies: {
    duplicateRoutes: string[];
    unusedRoutes: string[];
    highErrorPaths: string[];
    slowPaths: string[];
    apiAbuse: string[];
  };
}

export class SystemVisibility {
  private app: Express;
  private outputDir: string;
  private routeUsageLogPath: string;

  constructor(
    app: Express,
    outputDir = path.join(process.cwd(), 'visibility-reports')
  ) {
    this.app = app;
    this.outputDir = outputDir;
    this.routeUsageLogPath = path.join(process.cwd(), 'route-usage.csv');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Generate all reports
   */
  generateAllReports(): VisibilityReport {
    console.log('\n📊 Generating System Visibility Report...\n');

    // 1. Export route structure
    console.log('Step 1: Route export (run scripts/exportRoutes.js separately)...');
    const routeExport: any = { endpoints: [], stats: { totalEndpoints: 0, uniqueDomains: 0, totalMethods: 0 } };

    // 2. Analyze usage
    console.log('\nStep 2: Analyzing route usage...');
    let usageAnalysis: any = null;
    if (fs.existsSync(this.routeUsageLogPath)) {
      usageAnalysis = analyzeRouteUsage(this.routeUsageLogPath);
      exportRouteUsageAnalysis(this.routeUsageLogPath, this.outputDir);
    } else {
      console.warn('⚠️  No usage data yet. Run server for a few minutes first.');
    }

    // 3. Analyze external APIs
    console.log('\nStep 3: Analyzing external API calls...');
    const apiAnalysis = externalAPITracker.exportAnalysis(this.outputDir);
    const apiAnomalies = externalAPITracker.detectAnomalies();

    // 4. Detect anomalies
    console.log('\nStep 4: Detecting anomalies...');
    const anomalies = this.detectAnomalies(
      routeExport,
      usageAnalysis,
      apiAnalysis
    );

    // 5. Compile report
    const report = this.compileReport(
      routeExport,
      usageAnalysis,
      apiAnalysis,
      anomalies,
      apiAnomalies
    );

    // 6. Export report
    this.exportReport(report);

    return report;
  }

  private detectAnomalies(
    routeExport: any,
    usageAnalysis: any,
    apiAnalysis: any
  ) {
    const anomalies = {
      duplicateRoutes: [] as string[],
      unusedRoutes: [] as string[],
      highErrorPaths: [] as string[],
      slowPaths: [] as string[],
      apiAbuse: [] as string[],
    };

    if (!routeExport || !routeExport.endpoints) return anomalies;

    // Find duplicate routes (same path, different methods or implementations)
    const pathCounts: Record<string, number> = {};
    routeExport.endpoints.forEach((ep: any) => {
      const basePath = ep.path.replace(/:[^/]+/g, ':param'); // Normalize params
      pathCounts[basePath] = (pathCounts[basePath] || 0) + 1;
    });

    Object.entries(pathCounts).forEach(([path, count]) => {
      if (count > 1) {
        anomalies.duplicateRoutes.push(`${path} (${count} variations)`);
      }
    });

    // Find unused routes (defined but never called)
    if (usageAnalysis && usageAnalysis.topPaths) {
      const usedPaths = new Set(usageAnalysis.topPaths.map((p: any) => p.path));
      routeExport.endpoints.forEach((ep: any) => {
        if (!usedPaths.has(ep.path)) {
          anomalies.unusedRoutes.push(ep.path);
        }
      });
    }

    // Find high error paths
    if (usageAnalysis && usageAnalysis.byPath) {
      Object.entries(usageAnalysis.byPath).forEach(
        ([path, data]: [string, any]) => {
          const errorCount = Object.entries(data.statuses).reduce(
            (sum, [status, count]: [string, any]) => {
              if (parseInt(status, 10) >= 400) return sum + count;
              return sum;
            },
            0
          );
          const errorRate = (errorCount / data.count) * 100;
          if (errorRate > 10) {
            anomalies.highErrorPaths.push(
              `${path} (${errorRate.toFixed(2)}% errors)`
            );
          }
        }
      );
    }

    // Find slow paths
    if (usageAnalysis && usageAnalysis.slowestPaths) {
      usageAnalysis.slowestPaths
        .filter((p: any) => p.avgDuration > 1000)
        .forEach((p: any) => {
          anomalies.slowPaths.push(
            `${p.path} (${p.avgDuration.toFixed(0)}ms avg)`
          );
        });
    }

    // Detect API abuse
    if (apiAnalysis && apiAnalysis.summary) {
      if (apiAnalysis.summary.callsPerMinute > 100) {
        anomalies.apiAbuse.push(
          `High API call frequency: ${apiAnalysis.summary.callsPerMinute.toFixed(
            0
          )} calls/min`
        );
      }
      if (apiAnalysis.summary.errorRate > 5) {
        anomalies.apiAbuse.push(
          `High API error rate: ${apiAnalysis.summary.errorRate.toFixed(2)}%`
        );
      }
    }

    return anomalies;
  }

  private compileReport(
    routeExport: any,
    usageAnalysis: any,
    apiAnalysis: any,
    anomalies: any,
    apiAnomalies: any
  ): VisibilityReport {
    return {
      timestamp: new Date().toISOString(),
      routes: {
        totalEndpoints: routeExport?.endpoints?.length || 0,
        uniqueDomains: routeExport?.stats?.uniqueDomains || 0,
        totalMethods: routeExport?.stats?.totalMethods || 0,
        duplicates: anomalies.duplicateRoutes.map((d: string) => ({
          path: d,
          count: 0,
          methods: [],
        })),
      },
      usage: {
        totalRequests: usageAnalysis?.totalRequests || 0,
        timeRange: usageAnalysis
          ? `${usageAnalysis.timeRange.start} to ${usageAnalysis.timeRange.end}`
          : 'N/A',
        topPaths: usageAnalysis?.topPaths || [],
        slowestPaths: usageAnalysis?.slowestPaths || [],
        statusDistribution: usageAnalysis?.statusDistribution || {},
        averageResponseTime: usageAnalysis?.byMethod?.GET?.avgDuration || 0,
      },
      externalAPIs: {
        totalCalls: apiAnalysis?.summary?.totalCalls || 0,
        callsPerMinute: apiAnalysis?.summary?.callsPerMinute || 0,
        errorRate: apiAnalysis?.summary?.errorRate || 0,
        byType: this.mapToRecord(
          apiAnalysis?.byType || {},
          arr => arr.length
        ),
        byService: this.mapToRecord(
          apiAnalysis?.byService || {},
          arr => arr.length
        ),
        anomalies: apiAnomalies || [],
      },
      anomalies,
    };
  }

  private mapToRecord<T extends any[]>(
    obj: Record<string, T>,
    fn: (arr: T) => number
  ): Record<string, number> {
    const result: Record<string, number> = {};
    Object.entries(obj).forEach(([key, arr]) => {
      result[key] = fn(arr);
    });
    return result;
  }

  private exportReport(report: VisibilityReport) {
    // Export JSON
    const jsonPath = path.join(this.outputDir, 'visibility-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Full report exported to: ${jsonPath}`);

    // Export summary markdown
    const mdPath = path.join(this.outputDir, 'VISIBILITY_REPORT.md');
    const md = this.generateMarkdownReport(report);
    fs.writeFileSync(mdPath, md);
    console.log(`✅ Markdown report exported to: ${mdPath}`);

    // Console summary
    this.printSummary(report);
  }

  private generateMarkdownReport(report: VisibilityReport): string {
    let md = '# System Visibility Report\n\n';
    md += `Generated: ${report.timestamp}\n\n`;

    // Routes section
    md += '## Routes\n\n';
    md += `- Total Endpoints: ${report.routes.totalEndpoints}\n`;
    md += `- Unique Domains: ${report.routes.uniqueDomains}\n`;
    md += `- Total Methods: ${report.routes.totalMethods}\n`;

    if (report.routes.duplicates.length > 0) {
      md += '\n### Duplicate Routes Warning ⚠️\n\n';
      report.routes.duplicates.forEach(d => {
        md += `- ${d.path}\n`;
      });
    }

    // Usage section
    md += '\n## Route Usage\n\n';
    md += `- Total Requests: ${report.usage.totalRequests}\n`;
    md += `- Time Range: ${report.usage.timeRange}\n`;
    md += `- Avg Response Time: ${report.usage.averageResponseTime.toFixed(
      2
    )}ms\n`;

    if (report.usage.topPaths.length > 0) {
      md += '\n### Top 10 Paths\n\n';
      report.usage.topPaths.slice(0, 10).forEach((p, i) => {
        md += `${i + 1}. \`${p.path}\` - ${p.count} requests\n`;
      });
    }

    if (report.usage.slowestPaths.length > 0) {
      md += '\n### Slowest Paths\n\n';
      report.usage.slowestPaths.slice(0, 10).forEach((p, i) => {
        md += `${i + 1}. \`${p.path}\` - ${p.avgDuration.toFixed(2)}ms (${
          p.count
        } requests)\n`;
      });
    }

    // External APIs section
    md += '\n## External API Calls\n\n';
    md += `- Total Calls: ${report.externalAPIs.totalCalls}\n`;
    md += `- Calls/Min: ${report.externalAPIs.callsPerMinute.toFixed(2)}\n`;
    md += `- Error Rate: ${report.externalAPIs.errorRate.toFixed(2)}%\n`;

    if (Object.keys(report.externalAPIs.byType).length > 0) {
      md += '\n### By Type\n\n';
      Object.entries(report.externalAPIs.byType).forEach(([type, count]) => {
        md += `- ${type}: ${count} calls\n`;
      });
    }

    // Anomalies section
    md += '\n## Anomalies Detected\n\n';

    if (report.anomalies.duplicateRoutes.length > 0) {
      md += '### Duplicate Routes\n\n';
      report.anomalies.duplicateRoutes.forEach(r => {
        md += `- ${r}\n`;
      });
      md += '\n';
    }

    if (report.anomalies.highErrorPaths.length > 0) {
      md += '### High Error Rate Paths\n\n';
      report.anomalies.highErrorPaths.forEach(p => {
        md += `- ${p}\n`;
      });
      md += '\n';
    }

    if (report.anomalies.slowPaths.length > 0) {
      md += '### Slow Paths\n\n';
      report.anomalies.slowPaths.forEach(p => {
        md += `- ${p}\n`;
      });
      md += '\n';
    }

    if (report.anomalies.apiAbuse.length > 0) {
      md += '### API Usage Issues\n\n';
      report.anomalies.apiAbuse.forEach(a => {
        md += `- ${a}\n`;
      });
      md += '\n';
    }

    return md;
  }

  private printSummary(report: VisibilityReport) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYSTEM VISIBILITY SUMMARY');
    console.log('='.repeat(60));

    console.log('\n🛣️  Routes:');
    console.log(`   Total Endpoints: ${report.routes.totalEndpoints}`);
    console.log(`   Unique Domains: ${report.routes.uniqueDomains}`);
    console.log(`   Total Methods: ${report.routes.totalMethods}`);

    console.log('\n📈 Usage:');
    console.log(`   Total Requests: ${report.usage.totalRequests}`);
    console.log(
      `   Avg Response: ${report.usage.averageResponseTime.toFixed(2)}ms`
    );

    console.log('\n🔌 External APIs:');
    console.log(`   Total Calls: ${report.externalAPIs.totalCalls}`);
    console.log(
      `   Calls/Min: ${report.externalAPIs.callsPerMinute.toFixed(2)}`
    );
    console.log(
      `   Error Rate: ${report.externalAPIs.errorRate.toFixed(2)}%`
    );

    console.log('\n⚠️  Anomalies:');
    const totalAnomalies =
      report.anomalies.duplicateRoutes.length +
      report.anomalies.highErrorPaths.length +
      report.anomalies.slowPaths.length +
      report.anomalies.apiAbuse.length;

    if (totalAnomalies === 0) {
      console.log('   ✅ No anomalies detected!');
    } else {
      if (report.anomalies.duplicateRoutes.length > 0) {
        console.log(
          `   ⚠️  ${report.anomalies.duplicateRoutes.length} duplicate routes`
        );
      }
      if (report.anomalies.highErrorPaths.length > 0) {
        console.log(
          `   ⚠️  ${report.anomalies.highErrorPaths.length} high-error paths`
        );
      }
      if (report.anomalies.slowPaths.length > 0) {
        console.log(
          `   ⚠️  ${report.anomalies.slowPaths.length} slow paths`
        );
      }
      if (report.anomalies.apiAbuse.length > 0) {
        console.log(
          `   🚨 ${report.anomalies.apiAbuse.length} API usage issues`
        );
      }
    }

    console.log(
      '\n📁 Reports saved to: ' +
        path.relative(process.cwd(), this.outputDir)
    );
    console.log('='.repeat(60) + '\n');
  }
}

export default SystemVisibility;
