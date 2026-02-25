  
 /**
 * 🔍 External API Call Tracking Service
 * 
 * Monitors external API usage:
 * - CCXT calls (exchange data)
 * - CoinGecko calls (market data)
 * - DeFi protocol calls
 * - Blockchain RPC calls
 * - Any other external dependency
 * 
 * Provides visibility into:
 * - Call frequency (detect weird polling patterns)
 * - Response times (detect slow providers)
 * - Error rates (detect reliability issues)
 * - Cost estimation (if calls are metered)
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export type ExternalAPIType =
  | 'ccxt'
  | 'coingecko'
  | 'defi_protocol'
  | 'blockchain_rpc'
  | 'dexscreener'
  | 'freqtrade'
  | 'other';

export interface APICallMetric {
  timestamp: string;
  type: ExternalAPIType;
  service: string; // e.g., 'binance', 'ethereum', 'uniswap'
  endpoint: string; // e.g., '/api/markets', '/eth_blockNumber'
  method: string; // 'GET', 'POST', etc.
  statusCode?: number;
  duration: number; // milliseconds
  error?: string; // error message if failed
  dataSize?: number; // bytes returned
}

export interface APIMetrics {
  byType: Record<ExternalAPIType, APICallMetric[]>;
  byService: Record<string, APICallMetric[]>;
  summary: {
    totalCalls: number;
    totalDuration: number;
    avgDuration: number;
    errorCount: number;
    errorRate: number;
    callsPerMinute: number;
  };
}

/**
 * External API Call Tracker
 */
export class ExternalAPITracker {
  private calls: APICallMetric[] = [];
  private logFilePath: string;
  private maxInMemory = 10000; // Keep last 10k calls in memory
  private callCounts: Map<string, number> = new Map(); // For tracking frequency

  constructor(logFilePath?: string) {
    this.logFilePath =
      logFilePath || path.join(process.cwd(), 'external-api-calls.csv');
    this.ensureLogFile();
  }

  private ensureLogFile() {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.logFilePath)) {
      const header =
        'TIMESTAMP,TYPE,SERVICE,ENDPOINT,METHOD,STATUS_CODE,DURATION_MS,DATA_SIZE_BYTES,ERROR\n';
      try {
        fs.writeFileSync(this.logFilePath, header);
      } catch (error) {
        logger.error('Failed to create API call log:', error);
      }
    }
  }

  /**
   * Record an external API call
   */
  recordCall(metric: APICallMetric): void {
    try {
      // Add to in-memory buffer
      this.calls.push(metric);

      // Trim if too large
      if (this.calls.length > this.maxInMemory) {
        this.calls = this.calls.slice(-this.maxInMemory);
      }

      // Track call frequency (for anomaly detection)
      const key = `${metric.type}:${metric.service}`;
      this.callCounts.set(key, (this.callCounts.get(key) || 0) + 1);

      // Write to CSV
      this.writeToCSV(metric);
    } catch (error) {
      logger.error('Failed to record API call:', error);
    }
  }

  private writeToCSV(metric: APICallMetric): void {
    try {
      const line = [
        metric.timestamp,
        metric.type,
        metric.service,
        metric.endpoint,
        metric.method,
        metric.statusCode || '',
        metric.duration,
        metric.dataSize || '',
        metric.error ? `"${metric.error.substring(0, 255)}"` : '',
      ].join(',');

      fs.appendFileSync(this.logFilePath, line + '\n');
    } catch (error) {
      logger.error('Failed to write API call to CSV:', error);
    }
  }

  /**
   * Get call count for specific API type/service
   */
  getCallCount(type: ExternalAPIType, service?: string): number {
    const key = service ? `${type}:${service}` : type;
    return this.callCounts.get(key) || 0;
  }

  /**
   * Get all calls in memory
   */
  getCalls(): APICallMetric[] {
    return [...this.calls];
  }

  /**
   * Analyze calls
   */
  analyze(): APIMetrics {
    const result: APIMetrics = {
      byType: {} as Record<ExternalAPIType, APICallMetric[]>,
      byService: {},
      summary: {
        totalCalls: this.calls.length,
        totalDuration: 0,
        avgDuration: 0,
        errorCount: 0,
        errorRate: 0,
        callsPerMinute: 0,
      },
    };

    if (this.calls.length === 0) {
      return result;
    }

    // Group by type and service
    this.calls.forEach(call => {
      // By type
      if (!result.byType[call.type]) {
        result.byType[call.type] = [];
      }
      result.byType[call.type].push(call);

      // By service
      if (!result.byService[call.service]) {
        result.byService[call.service] = [];
      }
      result.byService[call.service].push(call);

      // Aggregate metrics
      result.summary.totalDuration += call.duration;
      if (call.error) {
        result.summary.errorCount++;
      }
    });

    // Calculate averages
    result.summary.avgDuration = result.summary.totalDuration / this.calls.length;
    result.summary.errorRate =
      (result.summary.errorCount / this.calls.length) * 100;

    // Calculate calls per minute (based on time range)
    if (this.calls.length > 1) {
      const firstCall = new Date(this.calls[0].timestamp);
      const lastCall = new Date(this.calls[this.calls.length - 1].timestamp);
      const minutesElapsed =
        (lastCall.getTime() - firstCall.getTime()) / (1000 * 60);
      result.summary.callsPerMinute = this.calls.length / minutesElapsed;
    }

    return result;
  }

  /**
   * Export analysis
   */
  exportAnalysis(outputDir = '.') {
    const analysis = this.analyze();

    // Export JSON
    const jsonPath = path.join(outputDir, 'external-api-analysis.json');
    fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
    console.log(`✅ API analysis exported to: ${jsonPath}`);

    // Export summary CSV
    const summaryPath = path.join(outputDir, 'external-api-summary.csv');
    const summaryCSV = `METRIC,VALUE
Total Calls,${analysis.summary.totalCalls}
Total Duration (ms),${analysis.summary.totalDuration}
Avg Duration (ms),${analysis.summary.avgDuration.toFixed(2)}
Error Count,${analysis.summary.errorCount}
Error Rate (%),${analysis.summary.errorRate.toFixed(2)}
Calls Per Minute,${analysis.summary.callsPerMinute.toFixed(2)}`;

    fs.writeFileSync(summaryPath, summaryCSV);
    console.log(`✅ API summary exported to: ${summaryPath}`);

    // Export by type CSV
    const byTypePath = path.join(outputDir, 'external-api-by-type.csv');
    const byTypeCSV =
      'TYPE,COUNT,AVG_DURATION_MS,ERROR_COUNT,ERROR_RATE\n' +
      Object.entries(analysis.byType)
        .map(([type, calls]) => {
          const errorCount = calls.filter(c => c.error).length;
          const avgDuration =
            calls.reduce((sum, c) => sum + c.duration, 0) / calls.length;
          const errorRate = (errorCount / calls.length) * 100;
          return `${type},${calls.length},${avgDuration.toFixed(2)},${errorCount},${errorRate.toFixed(2)}`;
        })
        .join('\n');

    fs.writeFileSync(byTypePath, byTypeCSV);
    console.log(`✅ API by-type exported to: ${byTypePath}`);

    // Export by service CSV
    const byServicePath = path.join(outputDir, 'external-api-by-service.csv');
    const byServiceCSV =
      'SERVICE,COUNT,AVG_DURATION_MS,ERROR_COUNT,ERROR_RATE\n' +
      Object.entries(analysis.byService)
        .map(([service, calls]) => {
          const errorCount = calls.filter(c => c.error).length;
          const avgDuration =
            calls.reduce((sum, c) => sum + c.duration, 0) / calls.length;
          const errorRate = (errorCount / calls.length) * 100;
          return `"${service}",${calls.length},${avgDuration.toFixed(2)},${errorCount},${errorRate.toFixed(2)}`;
        })
        .join('\n');

    fs.writeFileSync(byServicePath, byServiceCSV);
    console.log(`✅ API by-service exported to: ${byServicePath}`);

    // Console summary
    console.log('\n📊 External API Call Summary:');
    console.log(`   Total Calls: ${analysis.summary.totalCalls}`);
    console.log(
      `   Avg Duration: ${analysis.summary.avgDuration.toFixed(2)}ms`
    );
    console.log(`   Error Rate: ${analysis.summary.errorRate.toFixed(2)}%`);
    console.log(
      `   Calls/Min: ${analysis.summary.callsPerMinute.toFixed(2)}`
    );
    console.log('\n   By Type:');
    Object.entries(analysis.byType).forEach(([type, calls]) => {
      const errorCount = calls.filter(c => c.error).length;
      console.log(`      ${type}: ${calls.length} calls, ${errorCount} errors`);
    });
    console.log('\n   By Service (Top 10):');
    Object.entries(analysis.byService)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([service, calls]) => {
        const errorCount = calls.filter(c => c.error).length;
        console.log(
          `      ${service}: ${calls.length} calls, ${errorCount} errors`
        );
      });

    return analysis;
  }

  /**
   * Detect anomalies in API usage
   */
  detectAnomalies(): {
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
  }[] {
    const anomalies: Array<{
      type: string;
      severity: 'info' | 'warning' | 'critical';
      message: string;
    }> = [];
    const analysis = this.analyze();

    // High error rate
    if (analysis.summary.errorRate > 10) {
      anomalies.push({
        type: 'HIGH_ERROR_RATE',
        severity: 'warning',
        message: `${analysis.summary.errorRate.toFixed(2)}% of API calls are failing`,
      });
    }

    // Unusual call frequency
    if (analysis.summary.callsPerMinute > 1000) {
      anomalies.push({
        type: 'HIGH_CALL_FREQUENCY',
        severity: 'critical',
        message: `${analysis.summary.callsPerMinute.toFixed(0)} calls/min - possible polling abuse`,
      });
    }

    // Individual service issues
    Object.entries(analysis.byService).forEach(([service, calls]) => {
      const errorCount = calls.filter(c => c.error).length;
      const errorRate = (errorCount / calls.length) * 100;

      if (errorRate > 20) {
        anomalies.push({
          type: 'SERVICE_ERROR_RATE',
          severity: 'warning',
          message: `${service}: ${errorRate.toFixed(2)}% error rate`,
        });
      }

      // Slow service
      const avgDuration =
        calls.reduce((sum, c) => sum + c.duration, 0) / calls.length;
      if (avgDuration > 5000) {
        anomalies.push({
          type: 'SLOW_SERVICE',
          severity: 'info',
          message: `${service}: ${avgDuration.toFixed(0)}ms avg response time`,
        });
      }
    });

    return anomalies;
  }
}

// Create singleton instance
export const externalAPITracker = new ExternalAPITracker();

export default externalAPITracker;
