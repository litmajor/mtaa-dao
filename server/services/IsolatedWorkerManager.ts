/**
 * Isolated Worker Manager
 * 
 * Runs heavy background agents in isolated worker threads/processes.
 * Prevents agent CPU/memory spikes from affecting API process.
 * 
 * Agents run in isolation:
 * - PerformanceOptimizerAgent (60s cycle)
 * - HealthMonitorAgent (30s cycle)
 * - CapacityPlannerAgent (5 min cycle)
 * - DomainAggregatorAgent (10 min cycle)
 * 
 * Main process handles:
 * - API requests
 * - WebSocket connections
 * - Periodic flush jobs (metrics to DB)
 */

import { Worker } from 'worker_threads';
import { logger } from '../utils/logger';
import { PerformanceOptimizerBufferedWriter } from './PerformanceOptimizerBufferedWriter';
import type { PerformanceOptimizerAgent } from '../agents/performanceOptimizerAgent';
import type { HealthMonitorAgent } from '../agents/healthMonitorAgent';

/**
 * Worker pool for isolated agent execution
 */
export class IsolatedWorkerManager {
  private workers: Map<string, Worker | null> = new Map();
  private agents: Map<string, any> = new Map();
  private isRunning = false;
  private flushIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Register agents that run in isolation
    this.setupAgentRegistry();
  }

  /**
   * Setup which agents to run
   */
  private setupAgentRegistry(): void {
    this.agents.set('performanceOptimizer', null);
    this.agents.set('healthMonitor', null);
    this.agents.set('capacityPlanner', null);
    this.agents.set('domainAggregator', null);
  }

  /**
   * Start isolated agents
   */
  async start(
    performanceOptimizer: PerformanceOptimizerAgent,
    healthMonitor: HealthMonitorAgent
  ): Promise<void> {
    if (this.isRunning) {
      logger.warn('[WorkerManager] Already running');
      return;
    }

    logger.info('[WorkerManager] Starting isolated worker agents...');
    this.isRunning = true;

    try {
      // Start agents in main thread (they run their own intervals)
      if (performanceOptimizer) {
        performanceOptimizer.start();
        logger.info('[WorkerManager] ✅ PerformanceOptimizerAgent started');
      }

      if (healthMonitor) {
        healthMonitor.start();
        logger.info('[WorkerManager] ✅ HealthMonitorAgent started');
      }

      // Start metrics flusher job (every 5 minutes)
      // This runs in main process (not isolated) to write to DB
      this.startMetricsFlusher();

    } catch (error) {
      logger.error('[WorkerManager] Error starting agents:', error);
      throw error;
    }
  }

  /**
   * Periodic metrics flush: Redis buffer → DB
   * 
   * Runs every 5 minutes in main process
   * Aggregates 5 1-minute samples into 1 DB row
   */
  private startMetricsFlusher(): void {
    logger.info('[WorkerManager] Starting metrics flusher (every 5 minutes)...');

    // Run immediately on first start
    this.flushMetrics();

    // Then run every 5 minutes
    const flushInterval = setInterval(
      () => this.flushMetrics(),
      5 * 60 * 1000 // 5 minutes
    );

    this.flushIntervals.set('metrics', flushInterval);
    logger.info('[WorkerManager] ✅ Metrics flusher started');
  }

  /**
   * Flush buffered metrics to DB
   */
  private async flushMetrics(): Promise<void> {
    try {
      await PerformanceOptimizerBufferedWriter.flushBufferedMetricsToDB();
    } catch (error) {
      logger.error('[WorkerManager] Metrics flush failed:', error);
      // Continue anyway - don't crash the system
    }
  }

  /**
   * Stop all workers and flush remaining data
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('[WorkerManager] Shutting down isolated workers...');
    this.isRunning = false;

    // Clear all intervals
    this.flushIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.flushIntervals.clear();

    // Final metrics flush
    try {
      await PerformanceOptimizerBufferedWriter.flushBufferedMetricsToDB();
      logger.info('[WorkerManager] ✅ Final metrics flush complete');
    } catch (error) {
      logger.error('[WorkerManager] Final flush failed:', error);
    }

    logger.info('[WorkerManager] ✅ All workers shut down');
  }

  /**
   * Get current metrics status
   */
  async getMetricsStatus(): Promise<any> {
    return await PerformanceOptimizerBufferedWriter
      .getBufferedMetricsStatus();
  }

  /**
   * Get current metrics
   */
  async getCurrentMetrics(): Promise<any> {
    return await PerformanceOptimizerBufferedWriter
      .getCurrentMetrics();
  }

  /**
   * Manually trigger metrics flush (for testing)
   */
  async flushMetricsNow(): Promise<void> {
    logger.info('[WorkerManager] Manual metrics flush triggered');
    await this.flushMetrics();
  }

  /**
   * Check if workers are running
   */
  isWorkerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Cleanup and release resources
   */
  async cleanup(): Promise<void> {
    await this.shutdown();
  }
}

export const isolatedWorkerManager = new IsolatedWorkerManager();
