/**
 * ⚠️ DEPRECATED - Health Telemetry Service
 * 
 * This service has been consolidated into the unified HealthRegistry (Phase 4)
 * 
 * MIGRATION GUIDE:
 * - Old: healthTelemetry.recordDbQuery()
 * - New: import { healthRegistry } from '../core/consolidation/HealthRegistryConsolidation'
 *        healthRegistry.recordComponentSuccess/Failure('database', { latency })
 * 
 * - Old: healthTelemetry.recordExchangeUpdate()
 * - New: healthRegistry.recordComponentSuccess/Failure('exchange', { latency })
 * 
 * - Old: healthTelemetry.getSnapshot()
 * - New: healthRegistry.getSnapshot()
 * 
 * This file will be removed in v2.0. Please migrate to HealthRegistry.
 * For questions: See CONSOLIDATION_INTEGRATION_GUIDE.md
 */

/**
 * Health Telemetry Service
 * Tracks system-level metrics for operational intelligence
 * - Agent heartbeat latency
 * - Exchange latency
 * - Oracle backoff multiplier
 * - DB query failure rates
 * - Memory usage per module
 */

import { Logger } from './logger';
import { performance } from 'perf_hooks';
import os from 'os';

export interface HealthTelemetry {
  timestamp: Date;
  agent: AgentHealth;
  exchange: ExchangeHealth;
  oracle: OracleHealth;
  database: DatabaseHealth;
  memory: MemoryHealth;
  overall: OverallHealth;
}

export interface AgentHealth {
  heartbeatLatency: number; // ms
  isActive: boolean;
  lastHeartbeat: Date | null;
  failureCount: number;
  successCount: number;
}

export interface ExchangeHealth {
  latency: number; // ms
  lastUpdate: Date | null;
  failureCount: number;
  successCount: number;
  rateLimitStatus: 'ok' | 'warning' | 'critical';
}

export interface OracleHealth {
  backoffMultiplier: number;
  failureCount: number;
  successCount: number;
  lastFailure: Date | null;
  nextRetryAt: Date | null;
}

export interface DatabaseHealth {
  queryFailureRate: number; // percentage 0-100
  avgQueryTime: number; // ms
  slowQueryCount: number;
  connectionPoolUtilization: number; // 0-100
  lastError: string | null;
  lastErrorTime: Date | null;
}

export interface MemoryHealth {
  heapUsed: number; // bytes
  heapTotal: number; // bytes
  external: number; // bytes
  rss: number; // resident set size in bytes
  heapUsagePercent: number; // 0-100
  systemMemoryPercent: number; // 0-100
  modules: Record<string, ModuleMemory>;
}

export interface ModuleMemory {
  name: string;
  estimatedBytes: number;
}

export interface OverallHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number; // seconds
  errorCount: number;
  warningCount: number;
  healthScore: number; // 0-100
}

export class HealthTelemetryService {
  private logger = Logger.getLogger();
  private telemetry: HealthTelemetry;
  private startTime = Date.now();
  private registeredAgents: Map<string, { name: string; status: string; lastHeartbeat: Date; }> = new Map();
  private metrics = {
    agentHeartbeats: { success: 0, failure: 0, latencies: [] as number[] },
    exchangeRequests: { success: 0, failure: 0, latencies: [] as number[] },
    oracleRequests: { success: 0, failure: 0, backoffMultiplier: 1 },
    dbQueries: {
      success: 0,
      failure: 0,
      slowCount: 0,
      latencies: [] as number[],
    },
  };

  constructor() {
    this.telemetry = this.initializeTelemetry();
    this.startMonitoring();
  }

  /**
   * Initialize telemetry structure
   */
  private initializeTelemetry(): HealthTelemetry {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      timestamp: new Date(),
      agent: {
        heartbeatLatency: 0,
        isActive: true,
        lastHeartbeat: new Date(),
        failureCount: 0,
        successCount: 0,
      },
      exchange: {
        latency: 0,
        lastUpdate: null,
        failureCount: 0,
        successCount: 0,
        rateLimitStatus: 'ok',
      },
      oracle: {
        backoffMultiplier: 1,
        failureCount: 0,
        successCount: 0,
        lastFailure: null,
        nextRetryAt: null,
      },
      database: {
        queryFailureRate: 0,
        avgQueryTime: 0,
        slowQueryCount: 0,
        connectionPoolUtilization: 0,
        lastError: null,
        lastErrorTime: null,
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        systemMemoryPercent: ((totalMem - freeMem) / totalMem) * 100,
        modules: {},
      },
      overall: {
        status: 'healthy',
        uptime: 0,
        errorCount: 0,
        warningCount: 0,
        healthScore: 100,
      },
    };
  }

  /**
   * Record agent heartbeat
   */
  recordAgentHeartbeat(latency: number, success: boolean = true) {
    this.metrics.agentHeartbeats.latencies.push(latency);
    if (this.metrics.agentHeartbeats.latencies.length > 100) {
      this.metrics.agentHeartbeats.latencies.shift();
    }

    if (success) {
      this.metrics.agentHeartbeats.success++;
      this.telemetry.agent.successCount++;
    } else {
      this.metrics.agentHeartbeats.failure++;
      this.telemetry.agent.failureCount++;
    }

    this.telemetry.agent.heartbeatLatency =
      this.metrics.agentHeartbeats.latencies.reduce((a, b) => a + b, 0) /
      this.metrics.agentHeartbeats.latencies.length;
    this.telemetry.agent.lastHeartbeat = new Date();
  }

  /**
   * Record exchange latency
   */
  recordExchangeLatency(latency: number, success: boolean = true) {
    this.metrics.exchangeRequests.latencies.push(latency);
    if (this.metrics.exchangeRequests.latencies.length > 100) {
      this.metrics.exchangeRequests.latencies.shift();
    }

    if (success) {
      this.metrics.exchangeRequests.success++;
      this.telemetry.exchange.successCount++;
    } else {
      this.metrics.exchangeRequests.failure++;
      this.telemetry.exchange.failureCount++;
    }

    this.telemetry.exchange.latency =
      this.metrics.exchangeRequests.latencies.reduce((a, b) => a + b, 0) /
      this.metrics.exchangeRequests.latencies.length;
    this.telemetry.exchange.lastUpdate = new Date();

    // Update rate limit status based on failure rate
    const failureRate =
      (this.metrics.exchangeRequests.failure /
        (this.metrics.exchangeRequests.success + this.metrics.exchangeRequests.failure)) *
      100;
    if (failureRate > 50) {
      this.telemetry.exchange.rateLimitStatus = 'critical';
    } else if (failureRate > 20) {
      this.telemetry.exchange.rateLimitStatus = 'warning';
    } else {
      this.telemetry.exchange.rateLimitStatus = 'ok';
    }
  }

  /**
   * Record oracle backoff
   */
  recordOracleBackoff(multiplier: number, success: boolean = true) {
    if (success) {
      this.metrics.oracleRequests.success++;
      this.telemetry.oracle.successCount++;
      this.telemetry.oracle.backoffMultiplier = Math.max(1, multiplier * 0.8); // exponential backoff reset
    } else {
      this.metrics.oracleRequests.failure++;
      this.telemetry.oracle.failureCount++;
      this.telemetry.oracle.backoffMultiplier = Math.min(32, multiplier * 1.5); // exponential backoff
      this.telemetry.oracle.lastFailure = new Date();
      this.telemetry.oracle.nextRetryAt = new Date(
        Date.now() + 1000 * this.telemetry.oracle.backoffMultiplier
      );
    }
  }

  /**
   * Record database query
   */
  recordDbQuery(latency: number, success: boolean = true, isSlowQuery: boolean = false) {
    this.metrics.dbQueries.latencies.push(latency);
    // Keep only last 100 queries to prevent memory bloat (was 1000, reduced for memory)
    if (this.metrics.dbQueries.latencies.length > 100) {
      this.metrics.dbQueries.latencies.shift();
    }

    if (success) {
      this.metrics.dbQueries.success++;
    } else {
      this.metrics.dbQueries.failure++;
      this.telemetry.database.lastError = 'Query failed';
      this.telemetry.database.lastErrorTime = new Date();
    }

    if (isSlowQuery) {
      this.metrics.dbQueries.slowCount++;
      this.telemetry.database.slowQueryCount++;
    }

    const total = this.metrics.dbQueries.success + this.metrics.dbQueries.failure;
    this.telemetry.database.queryFailureRate = (this.metrics.dbQueries.failure / total) * 100;
    this.telemetry.database.avgQueryTime =
      this.metrics.dbQueries.latencies.reduce((a, b) => a + b, 0) /
      this.metrics.dbQueries.latencies.length;
  }

  /**
   * Record database pool utilization
   */
  recordDbPoolUtilization(utilization: number) {
    this.telemetry.database.connectionPoolUtilization = Math.min(100, Math.max(0, utilization));
  }

  /**
   * Record module memory usage
   */
  recordModuleMemory(moduleName: string, bytes: number) {
    this.telemetry.memory.modules[moduleName] = {
      name: moduleName,
      estimatedBytes: bytes,
    };
  }

  /**
   * Register an agent into the health registry
   */
  registerAgent(agentId: string, agentName: string) {
    this.registeredAgents.set(agentId, {
      name: agentName,
      status: 'active',
      lastHeartbeat: new Date(),
    });
    this.logger.info(`[HEALTH] Agent registered: ${agentId} (${agentName})`);
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents() {
    return Array.from(this.registeredAgents.values());
  }

  /**
   * Start periodic monitoring
   */
  private startMonitoring() {
    setInterval(() => {
      this.updateTelemetry();
    }, 5000); // Update every 5 seconds
  }

  /**
   * Update telemetry snapshot
   */
  private updateTelemetry() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // Update memory metrics
    this.telemetry.memory.heapUsed = memUsage.heapUsed;
    this.telemetry.memory.heapTotal = memUsage.heapTotal;
    this.telemetry.memory.external = memUsage.external;
    this.telemetry.memory.rss = memUsage.rss;
    this.telemetry.memory.heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.telemetry.memory.systemMemoryPercent = ((totalMem - freeMem) / totalMem) * 100;

    // Update overall health
    this.telemetry.overall.uptime = (Date.now() - this.startTime) / 1000;
    this.telemetry.overall.errorCount = this.metrics.dbQueries.failure +
      this.metrics.agentHeartbeats.failure +
      this.metrics.exchangeRequests.failure;
    this.telemetry.overall.warningCount = this.telemetry.database.slowQueryCount;

    // Calculate health score
    this.telemetry.overall.healthScore = this.calculateHealthScore();

    // Determine overall status
    if (this.telemetry.overall.healthScore >= 80) {
      this.telemetry.overall.status = 'healthy';
    } else if (this.telemetry.overall.healthScore >= 50) {
      this.telemetry.overall.status = 'degraded';
    } else {
      this.telemetry.overall.status = 'critical';
    }

    this.telemetry.timestamp = new Date();
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateHealthScore(): number {
    let score = 100;

    // Penalize for high memory usage
    if (this.telemetry.memory.heapUsagePercent > 90) score -= 30;
    else if (this.telemetry.memory.heapUsagePercent > 75) score -= 15;

    // Penalize for database failures
    score -= this.telemetry.database.queryFailureRate * 0.1;

    // Penalize for agent heartbeat failures
    const agentFailureRate =
      (this.telemetry.agent.failureCount /
        (this.telemetry.agent.failureCount + this.telemetry.agent.successCount)) *
      100;
    score -= agentFailureRate * 0.15;

    // Penalize for slow queries
    if (this.telemetry.database.slowQueryCount > 10) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get current telemetry
   */
  getTelemetry(): HealthTelemetry {
    this.updateTelemetry();
    return this.telemetry;
  }

  /**
   * Get health summary
   */
  getHealthSummary() {
    const telemetry = this.getTelemetry();
    return {
      status: telemetry.overall.status,
      healthScore: telemetry.overall.healthScore,
      uptime: telemetry.overall.uptime,
      agent: {
        latency: telemetry.agent.heartbeatLatency,
        isActive: telemetry.agent.isActive,
      },
      exchange: {
        latency: telemetry.exchange.latency,
        rateLimitStatus: telemetry.exchange.rateLimitStatus,
      },
      oracle: {
        backoffMultiplier: telemetry.oracle.backoffMultiplier,
      },
      database: {
        failureRate: telemetry.database.queryFailureRate,
        avgQueryTime: telemetry.database.avgQueryTime,
        slowQueries: telemetry.database.slowQueryCount,
      },
      memory: {
        heapUsagePercent: telemetry.memory.heapUsagePercent,
        systemMemoryPercent: telemetry.memory.systemMemoryPercent,
      },
    };
  }
}

// Global instance
export const healthTelemetry = new HealthTelemetryService();
