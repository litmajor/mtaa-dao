/**
 * CONSOLIDATED HEALTH REGISTRY
 * Unifies health tracking across the entire platform
 * 
 * Consolidates:
 * - server/utils/healthTelemetry.ts (agent heartbeats, latencies)
 * - server/utils/systemState.ts (job status, queue depth, DB status)
 * - server/services/agentStatusService.ts (agent lifecycle)
 * 
 * Enables:
 * - Cross-module health correlation
 * - Unified dashboards
 * - Predictive failure detection
 * - Coordinated recovery
 */

import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';
import os from 'os';

// ===== AGENT HEALTH =====
export interface AgentHealthStatus {
  agentId: string;
  name: string; // SYNCHRONIZER, ANALYZER, GATEWAY, etc.
  isActive: boolean;
  status: 'healthy' | 'degraded' | 'offline' | 'recovering';
  lastHeartbeat: Date | null;
  heartbeatLatency: number | null; // ms
  failureCount: number;
  successCount: number;
  taskCount: number;
  errorRate: number; // percentage
  registeredAt: Date | null;
  uptime: number; // ms
}

// ===== COMPONENT HEALTH (Exchange, Oracle, DB, etc) =====
export interface ComponentHealthStatus {
  name: string;
  type: 'exchange' | 'oracle' | 'database' | 'redis' | 'blockchain' | 'custom';
  isHealthy: boolean;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  latency: number | null; // ms
  lastUpdate: Date | null;
  failureCount: number;
  successCount: number;
  failureRate: number; // percentage
  errorMessage: string | null;
  metadata?: Record<string, any>;
}

// ===== JOB HEALTH =====
export interface JobHealthStatus {
  jobName: string;
  isActive: boolean;
  status: 'healthy' | 'degraded' | 'failed' | 'idle';
  lastExecutionTime: Date | null;
  executionDuration: number | null; // ms
  executionCount: number;
  failureCount: number;
  averageExecutionTime: number | null; // ms
  nextExecutionTime: Date | null;
  errorMessage: string | null;
}

// ===== MEMORY HEALTH =====
export interface MemoryHealthStatus {
  heapUsed: number; // bytes
  heapTotal: number; // bytes
  heapUsagePercent: number; // 0-100
  external: number; // bytes
  rss: number; // resident set size
  systemMemoryPercent: number; // 0-100
  modules: Record<string, number>; // module name -> bytes estimate
}

// ===== DATABASE HEALTH =====
export interface DatabaseHealthStatus {
  isConnected: boolean;
  status: 'healthy' | 'degraded' | 'critical' | 'disconnected';
  latency: number | null; // ms
  queryFailureRate: number; // percentage
  slowQueryCount: number;
  connectionPoolUtilization: number; // 0-100
  connectionCount: number;
  errorMessage: string | null;
}

// ===== QUEUE HEALTH =====
export interface QueueHealthStatus {
  queueName: string;
  depth: number;
  status: 'healthy' | 'warning' | 'critical';
  oldestItemAge: number | null; // ms
  averageProcessTime: number | null; // ms
  errorRate: number; // percentage
}

// ===== OVERALL SYSTEM HEALTH =====
export interface SystemHealthSnapshot {
  timestamp: Date;
  uptime: number; // ms
  
  // Component statuses
  agents: AgentHealthStatus[];
  components: ComponentHealthStatus[];
  jobs: JobHealthStatus[];
  queues: QueueHealthStatus[];
  
  // Resource health
  memory: MemoryHealthStatus;
  database: DatabaseHealthStatus;
  
  // Overall assessment
  overallStatus: 'healthy' | 'degraded' | 'critical';
  healthScore: number; // 0-100
  
  // Issues
  criticalIssues: string[];
  warnings: string[];
  
  // Recommendations
  recommendations: string[];
}

/**
 * Consolidated Health Registry
 * Single source of truth for all system health metrics
 */
export class HealthRegistry extends EventEmitter {
  private logger = Logger.getLogger();
  
  private agents: Map<string, AgentHealthStatus> = new Map();
  private components: Map<string, ComponentHealthStatus> = new Map();
  private jobs: Map<string, JobHealthStatus> = new Map();
  private queues: Map<string, QueueHealthStatus> = new Map();
  
  private startTime = Date.now();
  private lastSnapshot: SystemHealthSnapshot | null = null;

  constructor() {
    super();
    this.startMonitoring();
  }

  // ===== AGENT HEALTH METHODS =====

  registerAgent(agentId: string, name: string): void {
    this.agents.set(agentId, {
      agentId,
      name,
      isActive: false,
      status: 'offline',
      lastHeartbeat: null,
      heartbeatLatency: null,
      failureCount: 0,
      successCount: 0,
      taskCount: 0,
      errorRate: 0,
      registeredAt: new Date(),
      uptime: 0,
    });
    this.logger.info(`[HealthRegistry] Registered agent: ${name} (${agentId})`);
  }

  recordAgentHeartbeat(agentId: string, latency: number, status: 'healthy' | 'degraded' = 'healthy'): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.lastHeartbeat = new Date();
    agent.heartbeatLatency = latency;
    agent.isActive = true;
    agent.status = status;
    agent.successCount++;

    if (agent.successCount > 0) {
      agent.errorRate = (agent.failureCount / (agent.failureCount + agent.successCount)) * 100;
    }

    if (agent.registeredAt) {
      agent.uptime = Date.now() - agent.registeredAt.getTime();
    }

    this.emit('agent-heartbeat', { agentId, latency, status });
  }

  recordAgentFailure(agentId: string, error: Error): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.failureCount++;
    agent.status = agent.failureCount > 3 ? 'offline' : 'degraded';
    agent.isActive = false;

    if (agent.successCount + agent.failureCount > 0) {
      agent.errorRate = (agent.failureCount / (agent.failureCount + agent.successCount)) * 100;
    }

    this.emit('agent-failure', { agentId, error: error.message });
  }

  updateAgentTasks(agentId: string, taskCount: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.taskCount = taskCount;
    }
  }

  getAgentHealth(agentId: string): AgentHealthStatus | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AgentHealthStatus[] {
    return Array.from(this.agents.values());
  }

  // ===== COMPONENT HEALTH METHODS =====

  registerComponent(name: string, type: ComponentHealthStatus['type']): void {
    this.components.set(name, {
      name,
      type,
      isHealthy: true,
      status: 'unknown',
      latency: null,
      lastUpdate: null,
      failureCount: 0,
      successCount: 0,
      failureRate: 0,
      errorMessage: null,
    });
  }

  recordComponentSuccess(name: string, latency?: number): void {
    const component = this.components.get(name);
    if (!component) return;

    component.successCount++;
    component.lastUpdate = new Date();
    if (latency !== undefined) component.latency = latency;
    component.isHealthy = true;
    component.status = 'healthy';
    component.errorMessage = null;

    if (component.successCount + component.failureCount > 0) {
      component.failureRate = (component.failureCount / (component.successCount + component.failureCount)) * 100;
    }

    this.emit('component-success', { name, latency });
  }

  recordComponentFailure(name: string, error: Error, severity: 'warn' | 'error' = 'error'): void {
    const component = this.components.get(name);
    if (!component) return;

    component.failureCount++;
    component.lastUpdate = new Date();
    component.errorMessage = error.message;
    component.isHealthy = false;
    
    if (component.failureRate > 50) {
      component.status = 'critical';
    } else if (component.failureRate > 20) {
      component.status = 'degraded';
    }

    this.emit('component-failure', { name, error: error.message, severity });
  }

  getComponentHealth(name: string): ComponentHealthStatus | undefined {
    return this.components.get(name);
  }

  getAllComponents(): ComponentHealthStatus[] {
    return Array.from(this.components.values());
  }

  // ===== JOB HEALTH METHODS =====

  registerJob(jobName: string): void {
    this.jobs.set(jobName, {
      jobName,
      isActive: false,
      status: 'idle',
      lastExecutionTime: null,
      executionDuration: null,
      executionCount: 0,
      failureCount: 0,
      averageExecutionTime: null,
      nextExecutionTime: null,
      errorMessage: null,
    });
  }

  recordJobExecution(jobName: string, duration: number, success: boolean, error?: Error): void {
    const job = this.jobs.get(jobName);
    if (!job) return;

    job.lastExecutionTime = new Date();
    job.executionDuration = duration;
    job.executionCount++;

    if (success) {
      job.status = 'healthy';
      job.errorMessage = null;
      job.averageExecutionTime = job.averageExecutionTime
        ? (job.averageExecutionTime + duration) / 2
        : duration;
    } else {
      job.failureCount++;
      job.status = job.failureCount > 2 ? 'failed' : 'degraded';
      job.errorMessage = error?.message || null;
    }

    this.emit('job-execution', { jobName, duration, success, error: error?.message });
  }

  scheduleJobNext(jobName: string, nextTime: Date): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.nextExecutionTime = nextTime;
    }
  }

  getJobHealth(jobName: string): JobHealthStatus | undefined {
    return this.jobs.get(jobName);
  }

  getAllJobs(): JobHealthStatus[] {
    return Array.from(this.jobs.values());
  }

  // ===== QUEUE HEALTH METHODS =====

  updateQueueHealth(queueName: string, depth: number, oldestAge?: number): void {
    let queue = this.queues.get(queueName);
    if (!queue) {
      queue = {
        queueName,
        depth,
        status: 'healthy',
        oldestItemAge: oldestAge || null,
        averageProcessTime: null,
        errorRate: 0,
      };
      this.queues.set(queueName, queue);
    } else {
      queue.depth = depth;
      queue.oldestItemAge = oldestAge || null;

      // Determine status based on depth
      if (depth > 1000) {
        queue.status = 'critical';
      } else if (depth > 500) {
        queue.status = 'warning';
      } else {
        queue.status = 'healthy';
      }
    }
  }

  getQueueHealth(queueName: string): QueueHealthStatus | undefined {
    return this.queues.get(queueName);
  }

  getAllQueues(): QueueHealthStatus[] {
    return Array.from(this.queues.values());
  }

  // ===== DATABASE HEALTH METHODS =====

  private dbHealth: DatabaseHealthStatus = {
    isConnected: false,
    status: 'disconnected',
    latency: null,
    queryFailureRate: 0,
    slowQueryCount: 0,
    connectionPoolUtilization: 0,
    connectionCount: 0,
    errorMessage: null,
  };

  setDatabaseConnected(connected: boolean): void {
    this.dbHealth.isConnected = connected;
    this.dbHealth.status = connected ? 'healthy' : 'disconnected';
  }

  recordDatabaseQuery(duration: number, success: boolean, slow: boolean = false): void {
    if (slow) this.dbHealth.slowQueryCount++;
    if (!success) {
      // Update failure rate (simple moving average)
      const totalQueries = this.dbHealth.connectionCount || 1;
      this.dbHealth.queryFailureRate = ((this.dbHealth.queryFailureRate * (totalQueries - 1)) + (success ? 0 : 100)) / totalQueries;
    }
    this.dbHealth.latency = duration;
  }

  getDatabaseHealth(): DatabaseHealthStatus {
    return { ...this.dbHealth };
  }

  // ===== MEMORY HEALTH METHODS =====

  private getMemoryHealth(): MemoryHealthStatus {
    const memUsage = process.memoryUsage();
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const systemMem = os.freemem();
    const totalMem = os.totalmem();
    const systemMemUsagePercent = ((totalMem - systemMem) / totalMem) * 100;

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsagePercent,
      external: memUsage.external,
      rss: memUsage.rss,
      systemMemoryPercent: systemMemUsagePercent,
      modules: {}, // Can be populated with module-specific estimates
    };
  }

  // ===== SNAPSHOT & ASSESSMENT =====

  takeSnapshot(): SystemHealthSnapshot {
    const memory = this.getMemoryHealth();
    const database = this.getDatabaseHealth();

    // Calculate overall health score
    const agents = this.getAllAgents();
    const components = this.getAllComponents();
    const jobs = this.getAllJobs();

    let healthScore = 100;

    // Agent health penalty
    for (const agent of agents) {
      if (agent.status === 'offline') healthScore -= 15;
      else if (agent.status === 'degraded') healthScore -= 5;
    }

    // Component health penalty
    for (const component of components) {
      if (component.status === 'critical') healthScore -= 20;
      else if (component.status === 'degraded') healthScore -= 10;
    }

    // Job health penalty
    for (const job of jobs) {
      if (job.status === 'failed') healthScore -= 15;
      else if (job.status === 'degraded') healthScore -= 5;
    }

    // Memory pressure penalty
    if (memory.heapUsagePercent > 90) healthScore -= 15;
    else if (memory.heapUsagePercent > 75) healthScore -= 8;

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Identify issues
    const criticalIssues: string[] = [];
    const warnings: string[] = [];

    for (const agent of agents) {
      if (agent.status === 'offline') {
        criticalIssues.push(`Agent ${agent.name} is offline`);
      }
    }

    for (const component of components) {
      if (component.status === 'critical') {
        criticalIssues.push(`Component ${component.name} is critical: ${component.errorMessage}`);
      } else if (component.status === 'degraded') {
        warnings.push(`Component ${component.name} is degraded: ${component.errorMessage}`);
      }
    }

    for (const job of jobs) {
      if (job.status === 'failed') {
        criticalIssues.push(`Job ${job.jobName} failed: ${job.errorMessage}`);
      }
    }

    if (memory.heapUsagePercent > 90) {
      criticalIssues.push(`Heap memory critical: ${memory.heapUsagePercent.toFixed(1)}%`);
    } else if (memory.heapUsagePercent > 75) {
      warnings.push(`Heap memory high: ${memory.heapUsagePercent.toFixed(1)}%`);
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (memory.heapUsagePercent > 80) {
      recommendations.push('Consider increasing heap size or optimizing memory usage');
    }
    if (agents.filter(a => a.status === 'offline').length > 0) {
      recommendations.push('Restart offline agents');
    }
    if (components.filter(c => c.status === 'critical').length > 0) {
      recommendations.push('Investigate and remediate critical components');
    }

    const overallStatus: 'healthy' | 'degraded' | 'critical' =
      criticalIssues.length > 0 ? 'critical' : warnings.length > 0 ? 'degraded' : 'healthy';

    const snapshot: SystemHealthSnapshot = {
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
      agents,
      components,
      jobs,
      queues: this.getAllQueues(),
      memory,
      database,
      overallStatus,
      healthScore,
      criticalIssues,
      warnings,
      recommendations,
    };

    this.lastSnapshot = snapshot;
    this.emit('snapshot', snapshot);

    return snapshot;
  }

  getLastSnapshot(): SystemHealthSnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * Backwards-compatible getter used by callers expecting a synchronous snapshot.
   * Returns the last snapshot if available, otherwise generates and returns a fresh snapshot.
   */
  getSnapshot(): SystemHealthSnapshot {
    return this.lastSnapshot ?? this.takeSnapshot();
  }

  // ===== MONITORING =====

  private startMonitoring(): void {
    // Take snapshots every 30 seconds
    setInterval(() => {
      try {
        this.takeSnapshot();
      } catch (error) {
        this.logger.error('[HealthRegistry] Snapshot error:', error);
      }
    }, 30000);
  }
}

// Singleton instance
export const healthRegistry = new HealthRegistry();
