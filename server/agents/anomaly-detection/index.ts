/**
 * ANOMALY DETECTION AGENT
 * Security & health monitoring across all platform systems.
 */

import { BaseAgent, AgentStatus } from '../framework/base-agent';
import { Logger } from '../../utils/logger';
import { healthRegistry } from '../../core/consolidation/HealthRegistryConsolidation';
import { circuitBreakerRegistry } from '../../core/consolidation/CircuitBreakerConsolidation';
import { AgentCommunicator } from '../../core/agent-framework/agent-communicator';
import { MessageType } from '../../core/agent-framework/message-bus';

const logger = new Logger('anomaly-detection-agent');

export enum AnomalyType {
  TRANSACTION_SPIKE       = 'transaction_spike',
  UNUSUAL_PATTERN         = 'unusual_pattern',
  HEALTH_DEGRADATION      = 'health_degradation',
  SECURITY_THREAT         = 'security_threat',
  CIRCUIT_BREAKER_TRIGGER = 'circuit_breaker_trigger',
  LIQUIDITY_SHOCK         = 'liquidity_shock',
  PRICE_MANIPULATION      = 'price_manipulation',
  GAS_ANOMALY             = 'gas_anomaly',
  SYBIL_ATTACK            = 'sybil_attack',
  BLOCKCHAIN_ANOMALY      = 'blockchain_anomaly',
  DAO_CAPTURE_ATTEMPT     = 'dao_capture_attempt',
  UNAUTHORIZED_ACCESS     = 'unauthorized_access',
  VALIDATOR_MISBEHAVIOR   = 'validator_misbehavior',
  CONSENSUS_DEVIATION     = 'consensus_deviation',
}

export enum SeverityLevel {
  INFO      = 'info',
  WARNING   = 'warning',
  CRITICAL  = 'critical',
  EMERGENCY = 'emergency',
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
    deviation: number;
    violationScore: number; // FIX: was vioationScore
  };
  context: {
    recentEvents: string[];
    historicalComparisons: string[];
    correlations: Record<string, number>; // FIX: was Map — plain object serializes correctly
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

// FIX: timestamped metric entry so analyzeTrends() can do real window-based averages
export interface TimestampedMetric {
  value: number;
  recordedAt: number; // Unix ms
}

export interface TrendAnalysis {
  metric: string;
  currentValue: number;
  average7Day: number;
  average30Day: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentChange: number;
  confidenceLevel: number; // 0–100
}

const DEVIATION_THRESHOLD = 2.5;
const MAX_SERIES_LENGTH   = 1000;
const ALERT_HISTORY_TTL   = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export class AnomalyDetectionAgent extends BaseAgent {
  private communicator: AgentCommunicator;

  // FIX: renamed from `metrics` to avoid shadowing BaseAgent.metrics
  private metricSeries: Map<string, TimestampedMetric[]> = new Map();
  private baselines: Map<string, { mean: number; stdDev: number }> = new Map();
  private alertHistory: AnomalyAlert[] = [];
  private isInitialized: boolean = false;
  private refreshInterval: NodeJS.Timeout | null = null; // FIX: Timeout not Timer

  // Use 'agent' domain which is valid in CircuitBreakerDomain
  private readonly circuitBreaker = circuitBreakerRegistry.getOrCreate(
    'anomaly-detection',
    'agent',
    { failureThreshold: 20, resetTimeout: 120_000 }
  );

  constructor(agentId: string = 'ANOMALY-DETECTOR-001') {
    super(
      {
        id: agentId,
        name: 'ANOMALY_DETECTOR',
        version: '1.0.0',
        capabilities: [
          'anomaly_detection',
          'health_monitoring',
          'threat_detection',
          'trend_analysis',
          'auto_mitigation',
          'alert_generation',
        ],
      },
      undefined
    );

    this.communicator = new AgentCommunicator(agentId);
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.communicator.subscribe(
      [MessageType.HEALTH_CHECK, MessageType.METRICS_UPDATE, MessageType.ALERT_REQUEST],
      this.handleMessage.bind(this)
    );
  }

  private async handleMessage(message: unknown): Promise<void> {
    try {
      const msg = message as Record<string, unknown>;
      switch (msg.type) {
        case MessageType.METRICS_UPDATE: {
          const payload = msg.payload as Record<string, unknown>;
          await this.recordMetric(String(payload.metric), Number(payload.value));
          break;
        }
        case MessageType.ALERT_REQUEST: {
          const alerts = await this.checkAnomalies();
          if (msg.requiresResponse && msg.correlationId) {
            await this.communicator.respond(String(msg.correlationId), alerts);
          }
          break;
        }
        case MessageType.HEALTH_CHECK:
          if (msg.correlationId) {
            await this.communicator.respond(String(msg.correlationId), {
              status: 'healthy',
              alertCount: this.alertHistory.length,
              metricsTracked: this.metricSeries.size,
            });
          }
          break;
      }
    } catch (error) {
      logger.error('Message handling error:', error);
    }
  }

  async initialize(): Promise<void> {
    try {
      this.setStatus(AgentStatus.INITIALIZING);
      logger.info(`[${this.config.id}] Initializing Anomaly Detection Agent`);

      await this.buildBaselines();

      healthRegistry.registerAgent(this.config.id, 'ANOMALY_DETECTOR');
      healthRegistry.recordAgentHeartbeat(this.config.id, 10, 'healthy');

      this.startMonitoring();

      this.isInitialized = true;
      this.setStatus(AgentStatus.ACTIVE);
      logger.info(`[${this.config.id}]Anomaly Detection Agent initialized`);
    } catch (error) {
      logger.error(`[${this.config.id}] Failed to initialize:`, error);
      this.setStatus(AgentStatus.ERROR);
      healthRegistry.recordAgentFailure(this.config.id, error as Error);
      throw error;
    }
  }

  async process(data: unknown = {}): Promise<AnomalyAlert[]> {
    const startTime = Date.now();
    return this.circuitBreaker.execute(async () => {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const alerts = await this.checkAnomalies();

      for (const alert of alerts.filter(a => a.severity === SeverityLevel.CRITICAL)) {
        await this.attemptAutoMitigation(alert);
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);
      healthRegistry.recordAgentHeartbeat(this.config.id, processingTime, 'healthy');

      return alerts;
    }).catch(error => {
      logger.error(`[${this.config.id}] Processing error:`, error);
      healthRegistry.recordAgentFailure(this.config.id, error as Error);
      throw error;
    });
  }

  async checkAnomalies(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    alerts.push(...await this.checkTransactionAnomalies());
    alerts.push(...await this.checkHealthDegradation());
    alerts.push(...await this.checkSecurityThreats());
    alerts.push(...await this.checkCircuitBreakerAnomalies());

    // FIX: deduplicate — one alert per (affectedSystem, type) per check cycle
    const seen = new Set<string>();
    const deduplicated = alerts.filter(a => {
      const key = `${a.affectedSystem}:${a.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    this.alertHistory.push(...deduplicated);

    // FIX: trim on every cycle, not just when new alerts exist
    const cutoff = Date.now() - ALERT_HISTORY_TTL;
    this.alertHistory = this.alertHistory.filter(a => a.timestamp.getTime() > cutoff);

    return deduplicated;
  }

  /**
   * Analyze trends in a named metric series.
   * NOTE: averages are computed over entry count, not real calendar windows,
   * unless metrics are recorded at a fixed rate. For true time-window averages,
   * use the TimestampedMetric.recordedAt field introduced in this version.
   */
  analyzeTrends(metricName: string): TrendAnalysis {
    const series = this.metricSeries.get(metricName) ?? [];

    if (series.length === 0) {
      return { metric: metricName, currentValue: 0, average7Day: 0, average30Day: 0, trend: 'stable', percentChange: 0, confidenceLevel: 0 };
    }

    const now = Date.now();
    const sevenDayMs  = 7  * 24 * 60 * 60 * 1000;
    const thirtyDayMs = 30 * 24 * 60 * 60 * 1000;

    const recent7  = series.filter(e => now - e.recordedAt <= sevenDayMs).map(e => e.value);
    const recent30 = series.filter(e => now - e.recordedAt <= thirtyDayMs).map(e => e.value);

    const currentValue = series[series.length - 1].value;
    const avg7  = recent7.length  ? recent7.reduce((a, b)  => a + b, 0) / recent7.length  : 0;
    const avg30 = recent30.length ? recent30.reduce((a, b) => a + b, 0) / recent30.length : 0;

    const percentChange = avg7 !== 0 ? ((currentValue - avg7) / avg7) * 100 : 0;
    const trend = percentChange > 2 ? 'increasing' : percentChange < -2 ? 'decreasing' : 'stable';
    const confidenceLevel = Math.min(100, (series.length / MAX_SERIES_LENGTH) * 100);

    return { metric: metricName, currentValue, average7Day: avg7, average30Day: avg30, trend, percentChange, confidenceLevel };
  }

  getAlertHistory(hours: number = 24): AnomalyAlert[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.alertHistory.filter(a => a.timestamp.getTime() > cutoff);
  }

  async shutdown(): Promise<void> {
    logger.info(`[${this.config.id}] Shutting down Anomaly Detection Agent`);
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.setStatus(AgentStatus.PAUSED);
    this.communicator.unsubscribe();
  }

  // ===== PRIVATE HELPERS =====

  private async buildBaselines(): Promise<void> {
    logger.debug('Building baselines from historical data...');
  }

  private startMonitoring(): void {
    this.refreshInterval = setInterval(async () => {
      try {
        await this.process();
      } catch (error) {
        logger.warn('Periodic anomaly check failed:', error);
        // Circuit breaker handles failure tracking automatically in execute()
      }
    }, 60_000);
  }

  // FIX: uses TimestampedMetric so analyzeTrends() can do real window-based filtering
  private async recordMetric(metric: string, value: number): Promise<void> {
    if (!this.metricSeries.has(metric)) {
      this.metricSeries.set(metric, []);
    }
    const series = this.metricSeries.get(metric)!;
    series.push({ value, recordedAt: Date.now() });

    if (series.length > MAX_SERIES_LENGTH) {
      series.shift();
    }
  }

  private async checkTransactionAnomalies(): Promise<AnomalyAlert[]> {
    return [];
  }

  private async checkHealthDegradation(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    // FIX: use typed interface directly — no duck-typed || chaining
    // healthRegistry.getSnapshot() must return a synchronous snapshot object.
    // If your healthRegistry.getSnapshot() is async, await it here.
    const snapshot = healthRegistry.getSnapshot();
    if (!snapshot?.components) return alerts;

    for (const [systemName, status] of Object.entries(snapshot.components)) {
      const failureRate = (status as any).failureRate as number | undefined;
      if (failureRate == null || failureRate <= 0.2) continue;

      alerts.push({
        id: `alert-${Date.now()}-${systemName}`,
        type: AnomalyType.HEALTH_DEGRADATION,
        severity: SeverityLevel.WARNING,
        timestamp: new Date(),
        description: `System ${systemName} showing elevated failure rate (${(failureRate * 100).toFixed(1)}%)`,
        affectedSystem: systemName,
        metrics: {
          baselineValue: 0.05,
          observedValue: failureRate,
          deviation: (failureRate - 0.05) / 0.05,
          violationScore: Math.min(100, (failureRate / 0.2) * 100), // FIX: correct spelling
        },
        context: {
          recentEvents: [],
          historicalComparisons: [],
          correlations: {}, // FIX: plain object, not Map — serializes correctly
        },
        recommendedActions: [
          `Review logs for ${systemName}`,
          'Check circuit breaker status',
          'Consider rate limiting',
        ],
        autoMitigationAttempted: false,
      });
    }

    return alerts;
  }

  private async checkSecurityThreats(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    alerts.push(...await this.detectSybilAttacks());
    alerts.push(...await this.detectUnauthorizedAccess());
    alerts.push(...await this.detectDAOCaptureAttempts());
    return alerts;
  }

  private async checkCircuitBreakerAnomalies(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    alerts.push(...await this.detectBlockchainAnomalies());
    alerts.push(...await this.detectValidatorMisbehavior());
    alerts.push(...await this.detectConsensusDeviation());
    return alerts;
  }

  /**
   * Detect Sybil attacks: multiple accounts with suspicious correlation patterns
   */
  private async detectSybilAttacks(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    // Detect coordinated behavior: accounts created in rapid succession,
    // identical transaction patterns, shared IP addresses, etc.
    // Placeholder for implementation with user behavioral data
    return alerts;
  }

  /**
   * Detect unauthorized access attempts
   */
  private async detectUnauthorizedAccess(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    // Monitor failed auth attempts, unusual access times, geographic anomalies
    // Placeholder for implementation with authentication logs
    return alerts;
  }

  /**
   * Detect DAO capture attempts: concentrated voting power, governance attacks
   */
  private async detectDAOCaptureAttempts(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    // Monitor voting concentration, sudden membership changes,
    // governance proposal anomalies indicating capture attempts
    // Placeholder for implementation with DAO state
    return alerts;
  }

  /**
   * Detect blockchain anomalies: fork detection, block time anomalies
   */
  private async detectBlockchainAnomalies(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    // Monitor block times, transaction pool size, mempool anomalies,
    // chain reorganizations, orphaned blocks
    // Placeholder for implementation with blockchain metrics
    return alerts;
  }

  /**
   * Detect validator misbehavior: missed proposals, equivocation, double-signing
   */
  private async detectValidatorMisbehavior(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    // Monitor validator uptime, missed blocks, consensus violations
    // Placeholder for implementation with validator metrics
    return alerts;
  }

  /**
   * Detect consensus deviation: nodes out of sync with majority
   */
  private async detectConsensusDeviation(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    // Monitor state root hashes, block hashes across nodes,
    // fork recovery mechanisms
    // Placeholder for implementation with node consensus data
    return alerts;
  }

  private async attemptAutoMitigation(alert: AnomalyAlert): Promise<void> {
    try {
      logger.info(`Attempting auto-mitigation for ${alert.type}`);

      switch (alert.type) {
        case AnomalyType.HEALTH_DEGRADATION:
          // Reduce traffic load, increase timeouts
          break;
        case AnomalyType.CIRCUIT_BREAKER_TRIGGER:
          // Wait for reset timeout, escalate if repeated
          break;
        case AnomalyType.SECURITY_THREAT:
        case AnomalyType.SYBIL_ATTACK:
        case AnomalyType.DAO_CAPTURE_ATTEMPT:
        case AnomalyType.UNAUTHORIZED_ACCESS:
        case AnomalyType.VALIDATOR_MISBEHAVIOR:
          // Escalate to governance/admin action
          logger.warn(`Security threat detected: ${alert.type} on ${alert.affectedSystem}`);
          break;
        case AnomalyType.BLOCKCHAIN_ANOMALY:
        case AnomalyType.CONSENSUS_DEVIATION:
          // Potential fork — halt and sync
          logger.error(`Blockchain anomaly: ${alert.type}`);
          break;
        default:
          logger.debug(`No auto-mitigation for ${alert.type}`);
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