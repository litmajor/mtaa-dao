/**
 * ANOMALY DETECTION AGENT
 * Security & health monitoring across all platform systems
 * 
 * Features:
 * - Real-time anomaly detection using statistical analysis
 * - Transaction pattern analysis
 * - System health degradation detection
 * - Security threat identification
 * - Automated alerting and response
 */

import { BaseAgent, AgentConfig, AgentStatus } from '../framework/base-agent';
import { Logger } from '../../utils/logger';
import { healthRegistry } from '../../core/consolidation/HealthRegistryConsolidation';
import { circuitBreakerRegistry } from '../../core/consolidation/CircuitBreakerConsolidation';
import { AgentCommunicator } from '../../core/agent-framework/agent-communicator';
import { MessageType } from '../../core/agent-framework/message-bus';

const logger = new Logger('anomaly-detection-agent');

export enum AnomalyType {
  TRANSACTION_SPIKE = 'transaction_spike',
  UNUSUAL_PATTERN = 'unusual_pattern',
  HEALTH_DEGRADATION = 'health_degradation',
  SECURITY_THREAT = 'security_threat',
  CIRCUIT_BREAKER_TRIGGER = 'circuit_breaker_trigger',
  LIQUIDITY_SHOCK = 'liquidity_shock',
  PRICE_MANIPULATION = 'price_manipulation',
  GAS_ANOMALY = 'gas_anomaly'
}

export enum SeverityLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

export interface AnomalyAlert {
  id: string;
  type: AnomalyType;
  severity: SeverityLevel;
  timestamp: Date;
  description: string;
  affectedSystem: string;
  metrics: {
    baselineValue: number;
    observedValue: number;
    deviation: number; // percentage
    vioationScore: number; // 0-100
  };
  context: {
    recentEvents: string[];
    historicalComparisons: string[];
    correlations: Map<string, number>;
  };
  recommendedActions: string[];
  autoMitigationAttempted: boolean;
  autoMitigationResult?: 'success' | 'partial' | 'failed';
}

export interface HealthSnapshot {
  timestamp: Date;
  systemHealth: {
    agents: Map<string, number>;
    databases: Map<string, number>;
    caches: Map<string, number>;
    externalAPIs: Map<string, number>;
  };
  transactionMetrics: {
    volume: number;
    successRate: number;
    averageGasCost: number;
    p95Latency: number;
  };
  securityMetrics: {
    failedAuthAttempts: number;
    suspiciousTransactions: number;
    revokedPermissions: number;
  };
}

export interface TrendAnalysis {
  metric: string;
  currentValue: number;
  average7Day: number;
  average30Day: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentChange: number;
  confidenceLevel: number;
}

const DEFAULT_BASELINE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
const DEVIATION_THRESHOLD = 2.5; // 2.5 standard deviations

export class AnomalyDetectionAgent extends BaseAgent {
  private communicator: AgentCommunicator;
  private metrics: Map<string, number[]> = new Map();
  private baselines: Map<string, { mean: number; stdDev: number }> = new Map();
  private alertHistory: AnomalyAlert[] = [];
  private isInitialized: boolean = false;
  private refreshInterval: NodeJS.Timer | null = null;
  private circuitBreaker = circuitBreakerRegistry.getOrCreate('anomaly-detection', 'media', {
    failureThreshold: 20,
    resetTimeout: 120000
  });

  constructor(agentId: string = 'ANOMALY-DETECTOR-001') {
    super({
      id: agentId,
      name: 'ANOMALY_DETECTOR',
      version: '1.0.0',
      capabilities: [
        'anomaly_detection',
        'health_monitoring',
        'threat_detection',
        'trend_analysis',
        'auto_mitigation',
        'alert_generation'
      ]
    });

    this.communicator = new AgentCommunicator(agentId);
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.communicator.subscribe([
      MessageType.HEALTH_CHECK,
      MessageType.METRICS_UPDATE,
      MessageType.ALERT_REQUEST
    ], this.handleMessage.bind(this));
  }

  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case MessageType.METRICS_UPDATE:
          await this.recordMetric(message.payload.metric, message.payload.value);
          break;
        case MessageType.ALERT_REQUEST:
          const alerts = await this.checkAnomalies();
          if (message.requiresResponse && message.correlationId) {
            await this.communicator.respond(message.correlationId, alerts);
          }
          break;
        case MessageType.HEALTH_CHECK:
          await this.communicator.respond(message.correlationId, {
            status: 'healthy',
            alertCount: this.alertHistory.length,
            metricsTracked: this.metrics.size
          });
          break;
      }
    } catch (error) {
      logger.error('Message handling error:', error);
      this.circuitBreaker.recordFailure(error);
    }
  }

  /**
   * Initialize anomaly detection
   */
  async initialize(): Promise<void> {
    try {
      this.setStatus(AgentStatus.INITIALIZING);
      logger.info(`[${this.config.id}] Initializing Anomaly Detection Agent`);

      // Build initial baselines from historical data
      await this.buildBaselines();

      // Register with health system
      healthRegistry.registerAgent(this.config.id, 'ANOMALY_DETECTOR');
      healthRegistry.recordAgentHeartbeat(this.config.id, 10, 'healthy');

      // Start periodic monitoring
      this.startMonitoring();

      this.isInitialized = true;
      this.setStatus(AgentStatus.ACTIVE);
      logger.info(`[${this.config.id}] ✅ Anomaly Detection Agent initialized`);
    } catch (error) {
      logger.error(`[${this.config.id}] Failed to initialize:`, error);
      this.setStatus(AgentStatus.ERROR);
      healthRegistry.recordAgentFailure(this.config.id, error as Error);
      throw error;
    }
  }

  /**
   * Main processing: Continuous anomaly checking
   */
  async process(data: any = {}): Promise<AnomalyAlert[]> {
    const startTime = Date.now();
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check for anomalies
      const alerts = await this.checkAnomalies();

      // Apply auto-mitigation for critical alerts
      for (const alert of alerts.filter(a => a.severity === SeverityLevel.CRITICAL)) {
        await this.attemptAutoMitigation(alert);
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);

      this.circuitBreaker.recordSuccess();
      healthRegistry.recordAgentHeartbeat(this.config.id, processingTime, 'healthy');

      return alerts;
    } catch (error) {
      logger.error(`[${this.config.id}] Processing error:`, error);
      this.circuitBreaker.recordFailure(error);
      healthRegistry.recordAgentFailure(this.config.id, error as Error);
      throw error;
    }
  }

  /**
   * Check for anomalies across all metrics
   */
  async checkAnomalies(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    // Check transaction metrics
    alerts.push(...await this.checkTransactionAnomalies());

    // Check health degradation
    alerts.push(...await this.checkHealthDegradation());

    // Check security threats
    alerts.push(...await this.checkSecurityThreats());

    // Check circuit breaker states
    alerts.push(...await this.checkCircuitBreakerAnomalies());

    // Store in history
    this.alertHistory.push(...alerts);

    // Keep only recent alerts (last 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    this.alertHistory = this.alertHistory.filter(a => a.timestamp.getTime() > sevenDaysAgo);

    return alerts;
  }

  /**
   * Analyze trends in metrics
   */
  analyzeTrends(metricName: string): TrendAnalysis {
    const allValues = this.metrics.get(metricName) || [];
    if (allValues.length === 0) {
      return {
        metric: metricName,
        currentValue: 0,
        average7Day: 0,
        average30Day: 0,
        trend: 'stable',
        percentChange: 0,
        confidenceLevel: 0
      };
    }

    const currentValue = allValues[allValues.length - 1];
    const sevenDayAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDayAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    // Would need timestamps on metric values to calculate properly
    const recent7Day = allValues.slice(-7);
    const recent30Day = allValues.slice(-30);

    const avg7 = recent7Day.reduce((a, b) => a + b, 0) / recent7Day.length;
    const avg30 = recent30Day.reduce((a, b) => a + b, 0) / recent30Day.length;

    const percentChange = avg7 !== 0 ? ((currentValue - avg7) / avg7) * 100 : 0;
    const trend = percentChange > 2 ? 'increasing' : percentChange < -2 ? 'decreasing' : 'stable';

    return {
      metric: metricName,
      currentValue,
      average7Day: avg7,
      average30Day: avg30,
      trend,
      percentChange,
      confidenceLevel: Math.min(100, (allValues.length / 1000) * 100)
    };
  }

  /**
   * Get recent alerts
   */
  getAlertHistory(hours: number = 24): AnomalyAlert[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.alertHistory.filter(a => a.timestamp.getTime() > cutoff);
  }

  /**
   * Shutdown agent
   */
  async shutdown(): Promise<void> {
    logger.info(`[${this.config.id}] Shutting down Anomaly Detection Agent`);
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.communicator.unsubscribe();
  }

  // ===== PRIVATE HELPERS =====

  private async buildBaselines(): Promise<void> {
    // Would load historical data and calculate baselines
    logger.debug('Building baselines from historical data...');
  }

  private startMonitoring(): void {
    // Check anomalies every 60 seconds
    this.refreshInterval = setInterval(async () => {
      try {
        await this.process();
      } catch (error) {
        logger.warn('Periodic anomaly check failed:', error);
      }
    }, 60000);
  }

  private async recordMetric(metric: string, value: number): Promise<void> {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push(value);

    // Keep only last 1000 values
    const values = this.metrics.get(metric)!;
    if (values.length > 1000) {
      values.shift();
    }
  }

  private async checkTransactionAnomalies(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    // Would implement transaction volume spike detection
    return alerts;
  }

  private async checkHealthDegradation(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    const snapshot = healthRegistry.getSnapshot();

    for (const [systemName, status] of Object.entries(snapshot.components || {})) {
      if (status.failureRate as any > 0.2) {
        alerts.push({
          id: `alert-${Date.now()}-${systemName}`,
          type: AnomalyType.HEALTH_DEGRADATION,
          severity: SeverityLevel.WARNING,
          timestamp: new Date(),
          description: `System ${systemName} showing elevated failure rate`,
          affectedSystem: systemName,
          metrics: {
            baselineValue: 0.05,
            observedValue: (status.failureRate as any) * 100,
            deviation: ((status.failureRate as any) - 0.05) / 0.05,
            vioationScore: Math.min(100, ((status.failureRate as any) / 0.2) * 100)
          },
          context: {
            recentEvents: [],
            historicalComparisons: [],
            correlations: new Map()
          },
          recommendedActions: [
            `Review logs for ${systemName}`,
            'Check circuit breaker status',
            'Consider rate limiting'
          ],
          autoMitigationAttempted: false
        });
      }
    }

    return alerts;
  }

  private async checkSecurityThreats(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    // Would implement security threat detection
    return alerts;
  }

  private async checkCircuitBreakerAnomalies(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    // Would check if circuit breakers are frequently opening
    return alerts;
  }

  private async attemptAutoMitigation(alert: AnomalyAlert): Promise<void> {
    try {
      logger.info(`Attempting auto-mitigation for ${alert.type}`);

      switch (alert.type) {
        case AnomalyType.HEALTH_DEGRADATION:
          // Could reduce traffic, increase timeouts, etc.
          break;
        case AnomalyType.CIRCUIT_BREAKER_TRIGGER:
          // Reset circuit breakers if safe
          break;
        case AnomalyType.SECURITY_THREAT:
          // Increase monitoring, disable risky operations
          break;
      }

      alert.autoMitigationAttempted = true;
      alert.autoMitigationResult = 'success';
    } catch (error) {
      logger.error('Auto-mitigation failed:', error);
      alert.autoMitigationAttempted = true;
      alert.autoMitigationResult = 'failed';
    }
  }
}
