import { logger } from '../utils/logger';
import { PaymentErrorMonitoringService } from './paymentErrorMonitoringService';

/**
 * Error Analytics Service
 * Provides advanced error analysis including trends, root causes, and recovery metrics
 */

export interface ErrorTrend {
  timestamp: Date;
  errorCode: string;
  count: number;
  rate: number; // errors per hour
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercent: number; // percentage change from previous period
}

export interface RootCauseAnalysis {
  errorCode: string;
  totalOccurrences: number;
  averageRecoveryTime: number; // milliseconds
  primaryCause: string;
  relatedErrors: Array<{
    code: string;
    correlation: number; // 0-1 correlation coefficient
    frequency: number;
  }>;
  affectedProviders: string[];
  affectedOperations: string[];
  firstOccurrence: Date;
  lastOccurrence: Date;
  trend: 'increasing' | 'decreasing' | 'stable';
  recommendations: string[];
}

export interface MTTRMetrics {
  errorCode: string;
  meanTimeToRecovery: number; // milliseconds
  medianTimeToRecovery: number; // milliseconds
  minTimeToRecovery: number; // milliseconds
  maxTimeToRecovery: number; // milliseconds
  recoveryRate: number; // percentage (0-100)
  successfulRecoveries: number;
  failedRecoveries: number;
}

export interface ErrorCorrelation {
  errorCode1: string;
  errorCode2: string;
  correlation: number; // 0-1
  coOccurrences: number;
  percentage: number;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metric: string;
}

export interface AnomalyDetectionResult {
  timestamp: Date;
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number; // standard deviations
  isAnomaly: boolean;
  confidence: number; // 0-1
}

export interface ErrorDistribution {
  metric: string;
  label: string;
  count: number;
  percentage: number;
}

export interface AnalyticsReport {
  period: {
    start: Date;
    end: Date;
    duration: string;
  };
  summary: {
    totalErrors: number;
    uniqueErrorCodes: number;
    averageErrorRate: number;
    peakErrorRate: number;
    averageRecoveryTime: number;
  };
  trends: {
    daily: ErrorTrend[];
    byProvider: Record<string, number>;
    byOperation: Record<string, number>;
    byErrorCode: Record<string, number>;
  };
  topErrors: Array<{
    errorCode: string;
    count: number;
    percentage: number;
    providers: string[];
  }>;
  rootCauses: RootCauseAnalysis[];
  mttrMetrics: MTTRMetrics[];
  anomalies: AnomalyDetectionResult[];
  recommendations: string[];
}

/**
 * Error Analytics Engine
 */
class ErrorAnalyticsEngine {
  /**
   * Calculate error trends over time
   */
  calculateTrends(errorCode: string, hours: number = 24): ErrorTrend[] {
    const trend = PaymentErrorMonitoringService.getErrorTrend(errorCode, hours);

    if (trend.length < 2) {
      return [];
    }

    const trends: ErrorTrend[] = [];
    for (let i = 0; i < trend.length; i++) {
      const current = trend[i];
      const previous = i > 0 ? trend[i - 1] : trend[i];

      const change = previous.count > 0 ? ((current.count - previous.count) / previous.count) * 100 : 0;
      let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';

      if (change > 5) {
        trendDirection = 'increasing';
      } else if (change < -5) {
        trendDirection = 'decreasing';
      }

      trends.push({
        timestamp: current.timestamp,
        errorCode,
        count: current.count,
        rate: current.count / (hours / trend.length), // errors per hour in this bucket
        trend: trendDirection,
        trendPercent: change,
      });
    }

    return trends;
  }

  /**
   * Analyze root causes for error code
   */
  analyzeRootCause(errorCode: string): RootCauseAnalysis {
    const recentErrors = PaymentErrorMonitoringService.getRecentErrors(1000).filter(
      e => e.errorCode === errorCode
    );

    if (recentErrors.length === 0) {
      throw new Error(`No errors found for code: ${errorCode}`);
    }

    // Calculate recovery times (assume next successful operation = recovery)
    const recoveryTimes: number[] = [];
    const providerMap: Record<string, number> = {};
    const operationMap: Record<string, number> = {};

    for (const error of recentErrors) {
      providerMap[error.provider] = (providerMap[error.provider] || 0) + 1;
      operationMap[error.operation] = (operationMap[error.operation] || 0) + 1;

      // Estimate recovery time based on retry count and error category
      if (error.retryCount > 0) {
        // Assume exponential backoff: 1s, 2s, 4s, 8s
        const recoveryTime = Math.min(Math.pow(2, error.retryCount) * 1000, 30000);
        recoveryTimes.push(recoveryTime);
      }
    }

    // Sort for percentile calculation
    recoveryTimes.sort((a, b) => a - b);

    // Find correlated errors
    const allErrors = PaymentErrorMonitoringService.getRecentErrors(500);
    const errorCodeCounts: Record<string, number> = {};

    for (const error of allErrors) {
      if (error.errorCode !== errorCode) {
        errorCodeCounts[error.errorCode] = (errorCodeCounts[error.errorCode] || 0) + 1;
      }
    }

    const correlations = Object.entries(errorCodeCounts)
      .map(([code, count]) => ({
        code,
        correlation: Math.min(count / recentErrors.length, 1),
        frequency: count,
      }))
      .sort((a, b) => b.correlation - a.correlation)
      .slice(0, 5);

    // Determine trend
    const trends = this.calculateTrends(errorCode, 24);
    const trendDirection = trends.length > 0 && trends[trends.length - 1].trendPercent > 5
      ? 'increasing'
      : trends.length > 0 && trends[trends.length - 1].trendPercent < -5
        ? 'decreasing'
        : 'stable';

    // Determine primary cause (based on error code patterns)
    const primaryCauseMap: Record<string, string> = {
      PROVIDER_TIMEOUT: 'Provider response timeout - slow API',
      PROVIDER_RATE_LIMITED: 'Provider rate limiting - too many requests',
      PROVIDER_API_ERROR: 'Provider API error - check provider status',
      NETWORK_ERROR: 'Network connectivity issue - check internet',
      CONNECTION_TIMEOUT: 'Connection timeout - network issue',
      DATABASE_ERROR: 'Database operation error - retry may help',
      INVALID_AMOUNT: 'Invalid transaction amount - validate input',
      LIMIT_EXCEEDED: 'Transaction limit exceeded - check limits',
    };

    const primaryCause = primaryCauseMap[errorCode] || 'Unknown root cause';

    // Generate recommendations
    const recommendations = this.generateRecommendations(errorCode, trendDirection, correlations);

    const dates = recentErrors.map(e => e.timestamp);
    const firstOccurrence = new Date(Math.min(...dates.map(d => d.getTime())));
    const lastOccurrence = new Date(Math.max(...dates.map(d => d.getTime())));

    return {
      errorCode,
      totalOccurrences: recentErrors.length,
      averageRecoveryTime: recoveryTimes.length > 0
        ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length
        : 0,
      primaryCause,
      relatedErrors: correlations,
      affectedProviders: Object.keys(providerMap),
      affectedOperations: Object.keys(operationMap),
      firstOccurrence,
      lastOccurrence,
      trend: trendDirection,
      recommendations,
    };
  }

  /**
   * Calculate MTTR (Mean Time To Recovery) metrics
   */
  calculateMTTR(errorCode: string): MTTRMetrics {
    const recentErrors = PaymentErrorMonitoringService.getRecentErrors(500).filter(
      e => e.errorCode === errorCode
    );

    const recoveryTimes: number[] = [];

    for (const error of recentErrors) {
      // Calculate recovery time based on retry attempts
      if (error.retryCount > 0) {
        const recoveryTime = Math.min(Math.pow(2, error.retryCount - 1) * 1000, 30000);
        recoveryTimes.push(recoveryTime);
      }
    }

    if (recoveryTimes.length === 0) {
      // No recovery data available
      return {
        errorCode,
        meanTimeToRecovery: 0,
        medianTimeToRecovery: 0,
        minTimeToRecovery: 0,
        maxTimeToRecovery: 0,
        recoveryRate: 0,
        successfulRecoveries: 0,
        failedRecoveries: recentErrors.length,
      };
    }

    const mean = recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
    const sorted = [...recoveryTimes].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    const successfulRecoveries = recoveryTimes.length;
    const failedRecoveries = recentErrors.length - successfulRecoveries;
    const recoveryRate = (successfulRecoveries / recentErrors.length) * 100;

    return {
      errorCode,
      meanTimeToRecovery: mean,
      medianTimeToRecovery: median,
      minTimeToRecovery: Math.min(...recoveryTimes),
      maxTimeToRecovery: Math.max(...recoveryTimes),
      recoveryRate,
      successfulRecoveries,
      failedRecoveries,
    };
  }

  /**
   * Detect anomalies in error patterns
   */
  detectAnomalies(metric: string, threshold: number = 2): AnomalyDetectionResult[] {
    const errors = PaymentErrorMonitoringService.getRecentErrors(500);
    const anomalies: AnomalyDetectionResult[] = [];

    // Calculate baseline statistics
    const timeSlots: Record<number, number> = {};
    for (const error of errors) {
      const hour = Math.floor(error.timestamp.getTime() / (60 * 60 * 1000));
      timeSlots[hour] = (timeSlots[hour] || 0) + 1;
    }

    const values = Object.values(timeSlots);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Detect anomalies
    for (const [timeSlot, count] of Object.entries(timeSlots)) {
      const deviation = Math.abs(count - mean) / stdDev;
      const isAnomaly = deviation > threshold;

      if (isAnomaly) {
        anomalies.push({
          timestamp: new Date(parseInt(timeSlot) * 60 * 60 * 1000),
          metric,
          currentValue: count,
          expectedValue: mean,
          deviation,
          isAnomaly: true,
          confidence: Math.min(deviation / threshold, 1),
        });
      }
    }

    return anomalies.sort((a, b) => b.deviation - a.deviation).slice(0, 10);
  }

  /**
   * Find correlated error codes
   */
  findCorrelations(): ErrorCorrelation[] {
    const recentErrors = PaymentErrorMonitoringService.getRecentErrors(500);
    const errorCodeCounts: Record<string, number> = {};
    const errorPairs: Record<string, number> = {};

    for (const error of recentErrors) {
      errorCodeCounts[error.errorCode] = (errorCodeCounts[error.errorCode] || 0) + 1;
    }

    // Find co-occurring error codes
    for (let i = 0; i < recentErrors.length; i++) {
      for (let j = i + 1; j < Math.min(i + 10, recentErrors.length); j++) {
        const code1 = recentErrors[i].errorCode;
        const code2 = recentErrors[j].errorCode;

        if (code1 !== code2) {
          const key = [code1, code2].sort().join('_');
          errorPairs[key] = (errorPairs[key] || 0) + 1;
        }
      }
    }

    // Convert pairs to correlation array
    const correlations: ErrorCorrelation[] = [];
    const totalErrors = recentErrors.length;

    for (const [pair, count] of Object.entries(errorPairs)) {
      const [code1, code2] = pair.split('_');
      const correlation = count / totalErrors;

      if (correlation > 0.05) {
        // At least 5% co-occurrence
        correlations.push({
          errorCode1: code1,
          errorCode2: code2,
          correlation,
          coOccurrences: count,
          percentage: correlation * 100,
        });
      }
    }

    return correlations.sort((a, b) => b.correlation - a.correlation).slice(0, 20);
  }

  /**
   * Generate comprehensive analytics report
   */
  generateReport(hoursBack: number = 24): AnalyticsReport {
    const aggregation = PaymentErrorMonitoringService.getAggregation();
    const errors = PaymentErrorMonitoringService.getRecentErrors(1000);

    // Calculate time period
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursBack * 60 * 60 * 1000);

    // Filter errors in range
    const periodErrors = errors.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);

    // Calculate trends
    const topErrorCodes = Object.entries(aggregation.errorsByProvider)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([code]) => code);

    const trends: Record<string, number> = {};
    for (const [code] of Object.entries(aggregation.errorsByProvider).sort(
      ([, a], [, b]) => b - a
    ).slice(0, 5)) {
      trends[code] = (aggregation.errorsByProvider[code] || 0);
    }

    // Get top error details
    const topErrors = Object.entries(aggregation.errorsByProvider)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code, count]) => {
        const providers = periodErrors
          .filter(e => e.errorCode === code)
          .map(e => e.provider);
        const uniqueProviders = [...new Set(providers)];

        return {
          errorCode: code,
          count,
          percentage: (count / aggregation.totalErrors) * 100,
          providers: uniqueProviders,
        };
      });

    // Get root cause analysis for top errors
    const rootCauses = topErrorCodes.slice(0, 3).map(code => {
      try {
        return this.analyzeRootCause(code);
      } catch {
        return null;
      }
    }).filter(Boolean) as RootCauseAnalysis[];

    // Calculate MTTR for top errors
    const mttrMetrics = topErrorCodes.slice(0, 3).map(code => this.calculateMTTR(code));

    // Detect anomalies
    const anomalies = this.detectAnomalies('error_rate', 2);

    // Generate recommendations
    const recommendations = this.generateSystemRecommendations(
      aggregation,
      rootCauses,
      anomalies
    );

    // Calculate averages
    const avgErrorRate = periodErrors.length > 0
      ? (periodErrors.length / hoursBack)
      : 0;
    const peakHour = Math.max(
      ...Object.values(aggregation.errorsByProvider).map(v => typeof v === 'number' ? v : 0),
      0
    );
    const avgRecoveryTime = mttrMetrics.length > 0
      ? mttrMetrics.reduce((sum, m) => sum + m.meanTimeToRecovery, 0) / mttrMetrics.length
      : 0;

    return {
      period: {
        start: startTime,
        end: endTime,
        duration: `${hoursBack} hours`,
      },
      summary: {
        totalErrors: periodErrors.length,
        uniqueErrorCodes: Object.keys(aggregation.errorsByProvider).length,
        averageErrorRate: avgErrorRate,
        peakErrorRate: peakHour,
        averageRecoveryTime: avgRecoveryTime,
      },
      trends: {
        daily: topErrorCodes.slice(0, 3).map(code => this.calculateTrends(code, hoursBack)[0]).filter(Boolean) as ErrorTrend[],
        byProvider: aggregation.errorsByProvider,
        byOperation: aggregation.errorsByOperation,
        byErrorCode: trends,
      },
      topErrors,
      rootCauses,
      mttrMetrics,
      anomalies,
      recommendations,
    };
  }

  /**
   * Generate recommendations based on analytics
   */
  private generateRecommendations(
    errorCode: string,
    trend: 'increasing' | 'decreasing' | 'stable',
    correlations: Array<{ code: string }>
  ): string[] {
    const recommendations: string[] = [];

    // Add trend-specific recommendations
    if (trend === 'increasing') {
      recommendations.push(`Error ${errorCode} is increasing - investigate root cause immediately`);
      recommendations.push('Consider temporarily increasing retry limits');
      recommendations.push('Check provider status page for known issues');
    }

    // Add correlation-based recommendations
    if (correlations.length > 0) {
      recommendations.push(
        `This error correlates with ${correlations[0].code} - they may have a common cause`
      );
    }

    // Add code-specific recommendations
    if (errorCode.includes('TIMEOUT')) {
      recommendations.push('Increase timeout thresholds or improve network connectivity');
      recommendations.push('Consider implementing circuit breaker pattern');
    }

    if (errorCode.includes('RATE_LIMIT')) {
      recommendations.push('Implement request queuing or rate limiting');
      recommendations.push('Contact provider about higher rate limits');
    }

    if (errorCode.includes('SERVICE_UNAVAILABLE')) {
      recommendations.push('Implement provider fallback strategy');
      recommendations.push('Consider caching previous successful responses');
    }

    return recommendations;
  }

  /**
   * Generate system-wide recommendations
   */
  private generateSystemRecommendations(
    aggregation: any,
    rootCauses: RootCauseAnalysis[],
    anomalies: AnomalyDetectionResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Check overall error rate
    if (aggregation.totalErrors > 100) {
      recommendations.push('Overall error rate is high - prioritize root cause analysis');
    }

    // Check for anomalies
    if (anomalies.length > 0) {
      recommendations.push(`Detected ${anomalies.length} anomalies - investigate unusual patterns`);
    }

    // Check retry success rate
    if (aggregation.retrySuccessRate < 80) {
      recommendations.push('Low retry success rate - review retry strategy');
    }

    // Recommendations from root causes
    for (const cause of rootCauses.slice(0, 2)) {
      if (cause.trend === 'increasing') {
        recommendations.push(`Critical: ${cause.errorCode} errors are increasing`);
      }
    }

    // General best practices
    if (recommendations.length < 3) {
      recommendations.push('Monitor error trends closely for early detection');
      recommendations.push('Maintain updated runbooks for common errors');
      recommendations.push('Regular review of error patterns with team');
    }

    return recommendations;
  }
}

// Singleton instance
const analyticsEngine = new ErrorAnalyticsEngine();

/**
 * Error Analytics Service - Public API
 */
export const PaymentErrorAnalyticsService = {
  calculateTrends: (errorCode: string, hours?: number) =>
    analyticsEngine.calculateTrends(errorCode, hours),

  analyzeRootCause: (errorCode: string) => analyticsEngine.analyzeRootCause(errorCode),

  calculateMTTR: (errorCode: string) => analyticsEngine.calculateMTTR(errorCode),

  detectAnomalies: (metric: string, threshold?: number) =>
    analyticsEngine.detectAnomalies(metric, threshold),

  findCorrelations: () => analyticsEngine.findCorrelations(),

  generateReport: (hoursBack?: number) => analyticsEngine.generateReport(hoursBack),
};

export default PaymentErrorAnalyticsService;
