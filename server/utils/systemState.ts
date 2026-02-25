/**
 * ⚠️ DEPRECATED - System State Snapshot Service
 * 
 * This service has been consolidated into the unified HealthRegistry (Phase 4)
 * 
 * MIGRATION GUIDE:
 * - Old: const snapshot = await systemStateService.getSnapshot()
 * - New: import { healthRegistry } from '../core/consolidation/HealthRegistryConsolidation'
 *        const snapshot = healthRegistry.getSnapshot()
 * 
 * - Old: systemStateService.recordJob(jobId, duration)
 * - New: healthRegistry.recordJobCompletion('jobId', { duration })
 * 
 * All SystemStateSnapshot data now comes from HealthRegistry which provides:
 * - Real-time agent status
 * - Unified component health
 * - Cross-module correlations
 * - Performance metrics
 * 
 * This file will be removed in v2.0. Please migrate to HealthRegistry.
 * For questions: See CONSOLIDATION_INTEGRATION_GUIDE.md
 */

/**
 * System State Snapshot Service
 * Provides comprehensive operational intelligence about system health
 * Returns:
 * - Active agents
 * - Exchange health
 * - Job status
 * - Queue depth
 * - DB connectivity
 * - Redis fallback state
 */

import { db } from '../db';
import { Logger } from './logger';
import { healthTelemetry } from './healthTelemetry';
import { circuitBreakerRegistry } from './circuitBreaker';
// ⚠️ TODO: Use circuitBreakerRegistry from consolidation instead (Phase 5)
// Old:  import { circuitBreakerRegistry } from './circuitBreaker'
// New:  import { circuitBreakerRegistry } from '../core/consolidation/CircuitBreakerConsolidation'
// See deprecation notice in circuitBreaker.ts for migration guide
import { sql } from 'drizzle-orm';

export interface SystemStateSnapshot {
  timestamp: Date;
  systemStatus: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  agents: AgentStatus[];
  exchange: ExchangeStatus;
  jobs: JobStatus;
  queues: QueueStatus;
  database: DatabaseStatus;
  redis: RedisStatus;
  circuitBreakers: CircuitBreakerStatus[];
  recommendations: string[];
}

export interface AgentStatus {
  id: string;
  isActive: boolean;
  lastHeartbeat: Date | null;
  latency: number;
  taskCount: number;
  errorCount: number;
  status: 'healthy' | 'degraded' | 'offline';
}

export interface ExchangeStatus {
  isHealthy: boolean;
  latency: number;
  rateLimitStatus: string;
  failureRate: number;
  lastUpdate: Date | null;
  status: 'healthy' | 'degraded' | 'offline';
}

export interface JobStatus {
  totalJobs: number;
  activeJobs: number;
  failedJobs: number;
  pendingJobs: number;
  averageExecutionTime: number;
  lastJobTime: Date | null;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface QueueStatus {
  totalQueues: number;
  totalItems: number;
  delayedItems: number;
  failedItems: number;
  deepestQueue: {
    name: string;
    depth: number;
  };
  status: 'healthy' | 'warning' | 'critical';
}

export interface DatabaseStatus {
  isConnected: boolean;
  latency: number;
  queryFailureRate: number;
  slowQueryCount: number;
  connectionPoolUtilization: number;
  status: 'healthy' | 'degraded' | 'critical';
  lastError: string | null;
}

export interface RedisStatus {
  isConnected: boolean;
  latency: number;
  memoryUsage: number;
  memoryMaxUsage: number;
  keyCount: number;
  isFallbackActive: boolean;
  status: 'healthy' | 'degraded' | 'offline';
}

export interface CircuitBreakerStatus {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  isHealthy: boolean;
  failureRate: number;
  failureCount: number;
  successCount: number;
}

/**
 * System State Service
 */
export class SystemStateService {
  private logger = Logger.getLogger();
  private agents: Map<string, Omit<AgentStatus, 'status'>> = new Map();
  private jobs: Map<string, { executeTime: number; error?: string; timestamp: Date }> = new Map();
  private queues: Map<
    string,
    { depth: number; delayed: number; failed: number; lastUpdate: Date }
  > = new Map();
  private redisStats = {
    isConnected: true,
    latency: 0,
    memoryUsage: 0,
    memoryMaxUsage: 1000000000, // 1GB
    keyCount: 0,
  };

  /**
   * Register an agent
   */
  registerAgent(id: string, initialLatency: number = 0) {
    this.agents.set(id, {
      id,
      isActive: true,
      lastHeartbeat: new Date(),
      latency: initialLatency,
      taskCount: 0,
      errorCount: 0,
    });
  }

  /**
   * Update agent heartbeat
   */
  updateAgentHeartbeat(id: string, latency: number) {
    const agent = this.agents.get(id);
    if (agent) {
      agent.lastHeartbeat = new Date();
      agent.latency = latency;
      healthTelemetry.recordAgentHeartbeat(latency, true);
    }
  }

  /**
   * Record agent error
   */
  recordAgentError(id: string) {
    const agent = this.agents.get(id);
    if (agent) {
      agent.errorCount++;
      healthTelemetry.recordAgentHeartbeat(0, false);
    }
  }

  /**
   * Record job execution
   */
  recordJob(id: string, executeTime: number, error?: string) {
    this.jobs.set(id, {
      executeTime,
      error,
      timestamp: new Date(),
    });

    // Keep only last 1000 jobs
    if (this.jobs.size > 1000) {
      const firstKey = this.jobs.keys().next().value;
      if (firstKey !== undefined) {
        this.jobs.delete(firstKey);
      }
    }

    if (error) {
      healthTelemetry.recordDbQuery(executeTime, false);
    } else {
      healthTelemetry.recordDbQuery(executeTime, true, executeTime > 1000);
    }
  }

  /**
   * Update queue status
   */
  updateQueueStatus(name: string, depth: number, delayed: number = 0, failed: number = 0) {
    this.queues.set(name, {
      depth,
      delayed,
      failed,
      lastUpdate: new Date(),
    });
  }

  /**
   * Update Redis status
   */
  updateRedisStatus(
    isConnected: boolean,
    latency: number = 0,
    memoryUsage: number = 0,
    keyCount: number = 0
  ) {
    this.redisStats = {
      isConnected,
      latency,
      memoryUsage,
      memoryMaxUsage: this.redisStats.memoryMaxUsage,
      keyCount,
    };
  }

  /**
   * Get complete system state snapshot
   */
  async getSnapshot(): Promise<SystemStateSnapshot> {
    const health = healthTelemetry.getHealthSummary();
    const dbStatus = await this.getDatabaseStatus();
    const jobStatus = this.getJobStatus();
    const queueStatus = this.getQueueStatus();
    const exchangeStatus = this.getExchangeStatus();
    const redisStatus = this.getRedisStatus();
    const agentStatuses = this.getAgentStatuses();
    const circuitBreakerStatuses = this.getCircuitBreakerStatuses();

    // Determine overall system status
    const systemStatus = this.determineSystemStatus(
      dbStatus,
      jobStatus,
      queueStatus,
      redisStatus
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      dbStatus,
      jobStatus,
      queueStatus,
      health,
      circuitBreakerStatuses
    );

    return {
      timestamp: new Date(),
      systemStatus,
      uptime: health.uptime,
      agents: agentStatuses,
      exchange: exchangeStatus,
      jobs: jobStatus,
      queues: queueStatus,
      database: dbStatus,
      redis: redisStatus,
      circuitBreakers: circuitBreakerStatuses,
      recommendations,
    };
  }

  /**
   * Get database status
   */
  private async getDatabaseStatus(): Promise<DatabaseStatus> {
    try {
      const startTime = Date.now();
      const result = await db.select({ one: sql<number>`1` });
      const latency = Date.now() - startTime;

      return {
        isConnected: true,
        latency,
        queryFailureRate: 0,
        slowQueryCount: 0,
        connectionPoolUtilization: 50,
        status: 'healthy',
        lastError: null,
      };
    } catch (error) {
      this.logger.error('Database status check failed:', error);
      return {
        isConnected: false,
        latency: 0,
        queryFailureRate: 100,
        slowQueryCount: 0,
        connectionPoolUtilization: 0,
        status: 'critical',
        lastError: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get job status
   */
  private getJobStatus(): JobStatus {
    const jobs = Array.from(this.jobs.values());
    const failedJobs = jobs.filter((j) => j.error);
    const avgTime =
      jobs.length > 0
        ? jobs.reduce((sum, j) => sum + j.executeTime, 0) / jobs.length
        : 0;

    const lastJob = jobs.length > 0 ? jobs[jobs.length - 1] : null;

    return {
      totalJobs: jobs.length,
      activeJobs: Math.max(0, jobs.length - failedJobs.length),
      failedJobs: failedJobs.length,
      pendingJobs: 0, // Would need job queue implementation
      averageExecutionTime: avgTime,
      lastJobTime: lastJob?.timestamp || null,
      status: failedJobs.length > 0 ? 'degraded' : 'healthy',
    };
  }

  /**
   * Get queue status
   */
  private getQueueStatus(): QueueStatus {
    const queues = Array.from(this.queues.entries());
    const totalItems = queues.reduce((sum, [, q]) => sum + q.depth, 0);
    const delayedItems = queues.reduce((sum, [, q]) => sum + q.delayed, 0);
    const failedItems = queues.reduce((sum, [, q]) => sum + q.failed, 0);

    let deepestQueue: { name: string; depth: number } = { name: 'none', depth: 0 };
    
    for (const [name, q] of queues) {
      if (q.depth > deepestQueue.depth) {
        deepestQueue = { name, depth: q.depth };
      }
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (totalItems > 1000) status = 'critical';
    else if (totalItems > 500) status = 'warning';

    return {
      totalQueues: queues.length,
      totalItems,
      delayedItems,
      failedItems,
      deepestQueue,
      status,
    };
  }

  /**
   * Get agent statuses
   */
  private getAgentStatuses(): AgentStatus[] {
    return Array.from(this.agents.values()).map((agent) => ({
      ...agent,
      status: agent.isActive
        ? agent.errorCount === 0
          ? 'healthy'
          : 'degraded'
        : 'offline',
    }));
  }

  /**
   * Get exchange status
   */
  private getExchangeStatus(): ExchangeStatus {
    const health = healthTelemetry.getHealthSummary();
    return {
      isHealthy: health.exchange.rateLimitStatus === 'ok',
      latency: health.exchange.latency,
      rateLimitStatus: health.exchange.rateLimitStatus,
      failureRate: 0, // Would need exchange implementation
      lastUpdate: new Date(),
      status: health.exchange.rateLimitStatus === 'ok' ? 'healthy' : 'degraded',
    };
  }

  /**
   * Get Redis status
   */
  private getRedisStatus(): RedisStatus {
    return {
      isConnected: this.redisStats.isConnected,
      latency: this.redisStats.latency,
      memoryUsage: this.redisStats.memoryUsage,
      memoryMaxUsage: this.redisStats.memoryMaxUsage,
      keyCount: this.redisStats.keyCount,
      isFallbackActive: !this.redisStats.isConnected,
      status: this.redisStats.isConnected
        ? this.redisStats.latency > 100
          ? 'degraded'
          : 'healthy'
        : 'offline',
    };
  }

  /**
   * Get circuit breaker statuses
   */
  private getCircuitBreakerStatuses(): CircuitBreakerStatus[] {
    const allStatuses = circuitBreakerRegistry.getAllStatuses();
    return Object.values(allStatuses).map((status) => ({
      name: status.name,
      state: status.state,
      isHealthy: status.state === 'CLOSED',
      failureRate:
        status.totalFailures + status.totalSuccesses > 0
          ? (status.totalFailures / (status.totalFailures + status.totalSuccesses)) * 100
          : 0,
      failureCount: status.totalFailures,
      successCount: status.totalSuccesses,
    }));
  }

  /**
   * Determine overall system status
   */
  private determineSystemStatus(
    dbStatus: DatabaseStatus,
    jobStatus: JobStatus,
    queueStatus: QueueStatus,
    redisStatus: RedisStatus
  ): 'healthy' | 'degraded' | 'critical' {
    const statuses = [
      dbStatus.status,
      jobStatus.status,
      queueStatus.status,
      redisStatus.status,
    ];

    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('degraded')) return 'degraded';
    return 'healthy';
  }

  /**
   * Generate recommendations based on system state
   */
  private generateRecommendations(
    dbStatus: DatabaseStatus,
    jobStatus: JobStatus,
    queueStatus: QueueStatus,
    health: ReturnType<typeof healthTelemetry.getHealthSummary>,
    circuitBreakers: CircuitBreakerStatus[]
  ): string[] {
    const recommendations: string[] = [];

    if (dbStatus.status === 'critical') {
      recommendations.push('🔴 Database connection failed. Check database connectivity immediately.');
    } else if (dbStatus.queryFailureRate > 10) {
      recommendations.push(
        `⚠️ Database query failure rate is high (${dbStatus.queryFailureRate.toFixed(1)}%). Review slow queries.`
      );
    }

    if (health.memory.heapUsagePercent > 90) {
      recommendations.push(
        `⚠️ Memory usage is critical (${health.memory.heapUsagePercent.toFixed(1)}%). Consider garbage collection or scaling.`
      );
    }

    if (queueStatus.status === 'critical') {
      recommendations.push(
        `⚠️ Queue depth is high (${queueStatus.totalItems} items). Consider scaling workers.`
      );
    }

    if (jobStatus.status === 'degraded') {
      recommendations.push(
        `⚠️ Job failure rate is elevated. Review recent job logs for errors.`
      );
    }

    const openCircuits = circuitBreakers.filter((cb) => cb.state === 'OPEN');
    if (openCircuits.length > 0) {
      recommendations.push(
        `🔌 Circuit breakers open: ${openCircuits.map((cb) => cb.name).join(', ')}. Cascading failures detected.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ System is operating normally.');
    }

    return recommendations;
  }
}

// Global instance
export const systemStateService = new SystemStateService();
