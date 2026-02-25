import { logger } from '../utils/logger';
import { db } from '../db';
import { sql, desc, gte, eq, and } from 'drizzle-orm';

/**
 * Payment Error Monitoring Service
 * 
 * Tracks, aggregates, and analyzes payment errors across all providers and operations.
 * Provides real-time metrics for the error monitoring dashboard.
 * Foundation service for Phase 3c advanced monitoring features.
 */

export interface PaymentErrorMetric {
  timestamp: Date;
  errorCode: string;
  errorCategory: string;
  provider: string;
  operation: string; // 'deposit', 'withdrawal', 'verification', 'webhook'
  userId?: string;
  count: number;
  retryCount: number;
  statusCode: number;
  message: string;
  context?: Record<string, any>;
}

export interface ErrorTrendData {
  timestamp: Date;
  errorCode: string;
  count: number;
  retrySuccessRate: number; // 0-100
}

export interface ErrorAggregation {
  totalErrors: number;
  uniqueErrorCodes: number;
  mostCommonError: string;
  errorsByCategory: Record<string, number>;
  errorsByProvider: Record<string, number>;
  errorsByOperation: Record<string, number>;
  retrySuccessRate: number;
  avgRetryCount: number;
}

export interface ProviderErrorMetrics {
  provider: string;
  totalErrors: number;
  errorRate: number; // errors per 1000 transactions
  criticalErrors: number;
  timeoutErrors: number;
  rateLimitErrors: number;
  lastErrorTime?: Date;
  recoveryTime?: number; // minutes
}

export interface ErrorTimeline {
  timestamp: Date;
  errorCode: string;
  provider: string;
  operation: string;
  message: string;
  retryAttempts: number;
  success: boolean;
}

/**
 * In-memory error tracking (24-hour rolling window)
 * For production, consider using a dedicated time-series database like InfluxDB
 */
class ErrorMonitor {
  private errors: PaymentErrorMetric[] = [];
  private maxErrors = 10000; // Keep last 10k errors in memory
  private cleanupInterval = 60 * 1000; // Cleanup every minute
  
  constructor() {
    // Cleanup old errors every minute
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  recordError(metric: PaymentErrorMetric): void {
    this.errors.push({
      ...metric,
      timestamp: new Date(),
    });

    // Keep only recent errors (24-hour window)
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
  }

  private cleanup(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.errors = this.errors.filter(e => e.timestamp > oneDayAgo);
  }

  getRecentErrors(limit: number = 100): PaymentErrorMetric[] {
    return this.errors.slice(-limit);
  }

  getErrorsByTimeRange(startTime: Date, endTime: Date): PaymentErrorMetric[] {
    return this.errors.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  getAggregation(): ErrorAggregation {
    const totalErrors = this.errors.length;
    if (totalErrors === 0) {
      return {
        totalErrors: 0,
        uniqueErrorCodes: 0,
        mostCommonError: 'N/A',
        errorsByCategory: {},
        errorsByProvider: {},
        errorsByOperation: {},
        retrySuccessRate: 0,
        avgRetryCount: 0,
      };
    }

    const errorCodeCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const providerCounts: Record<string, number> = {};
    const operationCounts: Record<string, number> = {};
    let totalRetries = 0;
    let successCount = 0;

    for (const error of this.errors) {
      errorCodeCounts[error.errorCode] = (errorCodeCounts[error.errorCode] || 0) + 1;
      categoryCounts[error.errorCategory] = (categoryCounts[error.errorCategory] || 0) + 1;
      providerCounts[error.provider] = (providerCounts[error.provider] || 0) + 1;
      operationCounts[error.operation] = (operationCounts[error.operation] || 0) + 1;
      totalRetries += error.retryCount;
    }

    const mostCommonError = Object.entries(errorCodeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'UNKNOWN';
    const retrySuccessRate = totalErrors > 0 ? (successCount / totalErrors) * 100 : 0;
    const avgRetryCount = totalErrors > 0 ? totalRetries / totalErrors : 0;

    return {
      totalErrors,
      uniqueErrorCodes: Object.keys(errorCodeCounts).length,
      mostCommonError,
      errorsByCategory: categoryCounts,
      errorsByProvider: providerCounts,
      errorsByOperation: operationCounts,
      retrySuccessRate,
      avgRetryCount,
    };
  }

  getProviderMetrics(provider: string): ProviderErrorMetrics {
    const providerErrors = this.errors.filter(e => e.provider === provider);
    
    if (providerErrors.length === 0) {
      return {
        provider,
        totalErrors: 0,
        errorRate: 0,
        criticalErrors: 0,
        timeoutErrors: 0,
        rateLimitErrors: 0,
      };
    }

    const criticalErrors = providerErrors.filter(e => e.statusCode >= 500).length;
    const timeoutErrors = providerErrors.filter(e => e.errorCode.includes('TIMEOUT')).length;
    const rateLimitErrors = providerErrors.filter(e => e.errorCode.includes('RATE_LIMIT')).length;
    const lastError = providerErrors[providerErrors.length - 1];

    return {
      provider,
      totalErrors: providerErrors.length,
      errorRate: (providerErrors.length / 1000) * 100, // Errors per 1000 transactions (estimate)
      criticalErrors,
      timeoutErrors,
      rateLimitErrors,
      lastErrorTime: lastError?.timestamp,
    };
  }

  getErrorTrend(errorCode: string, hours: number = 24): ErrorTrendData[] {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const relevantErrors = this.errors.filter(
      e => e.errorCode === errorCode && e.timestamp >= startTime
    );

    if (relevantErrors.length === 0) {
      return [];
    }

    // Group by hour
    const trends: Record<string, ErrorTrendData> = {};
    for (const error of relevantErrors) {
      const hourKey = Math.floor(error.timestamp.getTime() / (60 * 60 * 1000));
      const key = hourKey.toString();
      
      if (!trends[key]) {
        trends[key] = {
          timestamp: new Date(hourKey * 60 * 60 * 1000),
          errorCode,
          count: 0,
          retrySuccessRate: 0,
        };
      }
      
      trends[key].count++;
    }

    return Object.values(trends).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getOperationMetrics(operation: string): Record<string, any> {
    const operationErrors = this.errors.filter(e => e.operation === operation);
    
    if (operationErrors.length === 0) {
      return {
        operation,
        totalErrors: 0,
        errorRate: 0,
        criticalErrors: 0,
        topErrors: [],
      };
    }

    const errorCodeCounts: Record<string, number> = {};
    const criticalErrors = operationErrors.filter(e => e.statusCode >= 500).length;

    for (const error of operationErrors) {
      errorCodeCounts[error.errorCode] = (errorCodeCounts[error.errorCode] || 0) + 1;
    }

    const topErrors = Object.entries(errorCodeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));

    return {
      operation,
      totalErrors: operationErrors.length,
      errorRate: (operationErrors.length / 1000) * 100,
      criticalErrors,
      topErrors,
    };
  }

  getErrorTimeline(limit: number = 50): ErrorTimeline[] {
    return this.errors.slice(-limit).map(e => ({
      timestamp: e.timestamp,
      errorCode: e.errorCode,
      provider: e.provider,
      operation: e.operation,
      message: e.message,
      retryAttempts: e.retryCount,
      success: e.statusCode < 500, // Simple heuristic
    }));
  }

  clear(): void {
    this.errors = [];
  }
}

// Singleton instance
const errorMonitor = new ErrorMonitor();

/**
 * Error Monitoring Service - Public API
 */
export const PaymentErrorMonitoringService = {
  /**
   * Record a payment error for monitoring
   */
  recordError(metric: PaymentErrorMetric): void {
    errorMonitor.recordError(metric);
    
    // Log critical errors
    if (metric.statusCode >= 500) {
      logger.error(`Critical payment error [${metric.errorCode}] from ${metric.provider}`, {
        errorCode: metric.errorCode,
        provider: metric.provider,
        operation: metric.operation,
        statusCode: metric.statusCode,
        message: metric.message,
        userId: metric.userId,
      });
    }
  },

  /**
   * Get recent errors (last N)
   */
  getRecentErrors(limit: number = 100): PaymentErrorMetric[] {
    return errorMonitor.getRecentErrors(limit);
  },

  /**
   * Get errors within time range
   */
  getErrorsByTimeRange(startTime: Date, endTime: Date): PaymentErrorMetric[] {
    return errorMonitor.getErrorsByTimeRange(startTime, endTime);
  },

  /**
   * Get overall error aggregation statistics
   */
  getAggregation(): ErrorAggregation {
    return errorMonitor.getAggregation();
  },

  /**
   * Get metrics for specific provider
   */
  getProviderMetrics(provider: string): ProviderErrorMetrics {
    return errorMonitor.getProviderMetrics(provider);
  },

  /**
   * Get error trend over time
   */
  getErrorTrend(errorCode: string, hours?: number): ErrorTrendData[] {
    return errorMonitor.getErrorTrend(errorCode, hours);
  },

  /**
   * Get metrics for specific operation type
   */
  getOperationMetrics(operation: string): Record<string, any> {
    return errorMonitor.getOperationMetrics(operation);
  },

  /**
   * Get error timeline (most recent errors)
   */
  getErrorTimeline(limit?: number): ErrorTimeline[] {
    return errorMonitor.getErrorTimeline(limit);
  },

  /**
   * Get all providers' metrics
   */
  getAllProviderMetrics(): ProviderErrorMetrics[] {
    const providers = ['flutterwave', 'paystack', 'mpesa', 'mtn', 'airtel', 'stripe', 'paychant'];
    return providers.map(provider => errorMonitor.getProviderMetrics(provider));
  },

  /**
   * Get health check for error monitoring system
   */
  getHealthCheck(): {
    status: 'healthy' | 'warning' | 'critical';
    totalErrors24h: number;
    errorRate: number;
    topProvider: string;
    topError: string;
    lastErrorTime?: Date;
  } {
    const aggregation = errorMonitor.getAggregation();
    const recentHourErrors = errorMonitor.getErrorsByTimeRange(
      new Date(Date.now() - 60 * 60 * 1000),
      new Date()
    );
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (recentHourErrors.length > 50) status = 'warning';
    if (recentHourErrors.length > 200) status = 'critical';

    const allMetrics = Object.entries(aggregation.errorsByProvider)
      .sort(([, a], [, b]) => b - a);
    const topProvider = allMetrics[0]?.[0] || 'N/A';

    const recentErrors = errorMonitor.getRecentErrors(1);
    const lastErrorTime = recentErrors[0]?.timestamp;

    return {
      status,
      totalErrors24h: aggregation.totalErrors,
      errorRate: aggregation.totalErrors > 0 ? (recentHourErrors.length / aggregation.totalErrors) * 100 : 0,
      topProvider,
      topError: aggregation.mostCommonError,
      lastErrorTime,
    };
  },

  /**
   * Clear all monitoring data (for testing)
   */
  clear(): void {
    errorMonitor.clear();
    logger.info('Payment error monitoring data cleared');
  },
};

export default PaymentErrorMonitoringService;
