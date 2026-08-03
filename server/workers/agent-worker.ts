/**
 * 🏗️ Agent Worker - Isolated Execution Thread
 * 
 * CRITICAL: Moves all background agents OFF the main API process thread
 * 
 * Risk Profile Mitigation:
 * ✅ PerformanceOptimizerAgent (2min poll) - CPU heavy, isolated
 * ✅ DomainAggregatorAgent (5min poll) - I/O heavy, isolated
 * ✅ CapacityPlannerAgent (10min poll) - DB/compute heavy, isolated
 * 
 * This file runs in a forked child process and is NOT part of main API
 * 
 * Benefits:
 * - API remains responsive during heavy agent compute
 * - Prevents event loop blocking in the main process
 * - Isolates agent failures (one crash ≠ API crash)
 * - Agent CPU spikes don't affect user requests
 * - Easy to monitor/restart independently
 */

import { Logger } from '../utils/logger';
import { evaluateAgentRuntimeSafety } from '../utils/agentRuntimeSafety';
import type { PerformanceOptimizerAgent } from '../agents/performanceOptimizerAgent';
import type { DomainAggregatorAgent } from '../agents/domainAggregatorAgent';
import type { CapacityPlannerAgent } from '../agents/capacityPlannerAgent';
import type { HealthMonitorAgent } from '../agents/healthMonitorAgent';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// Agent Initialization
// ════════════════════════════════════════════════════════════════════════════════

let performanceOptimizer: PerformanceOptimizerAgent | null = null;
let domainAggregator: DomainAggregatorAgent | null = null;
let capacityPlanner: CapacityPlannerAgent | null = null;
let healthMonitor: HealthMonitorAgent | null = null;

// Configuration from environment with fallbacks
const agentPort = parseInt(process.env.AGENT_PORT || process.env.PORT || '5000');
const agentHost = process.env.AGENT_HOST || 'localhost';
const baseUrl = process.env.AGENT_BASE_URL || `http://${agentHost}:${agentPort}`;

async function initializeAgents() {
  logger.info('[AGENT_WORKER] Initializing agents in isolated worker...');

  const runtimeSafety = evaluateAgentRuntimeSafety();
  if (runtimeSafety.shouldPause) {
    logger.warn(`[AGENT_WORKER] Pausing agent initialization due to runtime pressure: ${runtimeSafety.reason}`);
    return;
  }

  try {
    // Lazy load agents to avoid blocking
    const { initPerformanceOptimizer } = await import('../agents/performanceOptimizerAgent');
    const { initDomainAggregator } = await import('../agents/domainAggregatorAgent');
    const { initCapacityPlanner } = await import('../agents/capacityPlannerAgent');
    const { initHealthMonitor } = await import('../agents/healthMonitorAgent');

    // Initialize with error boundaries
    performanceOptimizer = await initAgentWithErrorBoundary(
      'PerformanceOptimizer',
      () => initPerformanceOptimizer(baseUrl, {
        pollInterval: parseInt(process.env.AGENT_PERF_INTERVAL || '120000'),
        slackWebhook: process.env.SLACK_WEBHOOK_PERFORMANCE,
      })
    );

    domainAggregator = await initAgentWithErrorBoundary(
      'DomainAggregator',
      () => initDomainAggregator(baseUrl, {
        pollInterval: parseInt(process.env.AGENT_DOMAIN_INTERVAL || '300000'),
        slackWebhook: process.env.SLACK_WEBHOOK_DOMAIN_ALERTS,
      })
    );

    capacityPlanner = await initAgentWithErrorBoundary(
      'CapacityPlanner',
      () => initCapacityPlanner(baseUrl, {
        pollInterval: parseInt(process.env.AGENT_CAPACITY_INTERVAL || '600000'),
        slackWebhook: process.env.SLACK_WEBHOOK_CAPACITY,
      })
    );

    healthMonitor = await initAgentWithErrorBoundary(
      'HealthMonitor',
      () => initHealthMonitor(baseUrl, {
        pollInterval: parseInt(process.env.AGENT_HEALTH_INTERVAL || '15000'),
        slackWebhook: process.env.SLACK_WEBHOOK_HEALTH,
      })
    );

    logger.info('[AGENT_WORKER] ✅ All agents initialized in isolated worker');
  } catch (error) {
    logger.error('[AGENT_WORKER] Failed to initialize agents:', error);
    process.exit(1);
  }
}

/**
 * Error boundary wrapper for each agent
 * Ensures one agent failure doesn't crash the worker
 */
async function initAgentWithErrorBoundary<T>(
  name: string,
  initFn: () => Promise<T> | T
): Promise<T | null> {
  try {
    const agent = await initFn();
    logger.info(`[AGENT_WORKER] ✅ ${name} initialized`);
    return agent;
  } catch (error) {
    logger.error(`[AGENT_WORKER] ❌ ${name} initialization failed:`, error);
    // Return null agent - it simply won't run
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Message Handler (IPC from Main Process)
// ════════════════════════════════════════════════════════════════════════════════

process.on('message', async (message: unknown) => {
  if (!message || typeof message !== 'object' || message === null) return;
  const msg = message as { type?: string; domain?: string };
  if (!msg.type) return;

  try {
    switch (msg.type) {
      case 'get-perf-stats': {
        const runtimeSafety = evaluateAgentRuntimeSafety();
        if (runtimeSafety.shouldPause) {
          process.send?.({ type: 'error', error: `Performance optimizer paused: ${runtimeSafety.reason}` });
          break;
        }

        if (performanceOptimizer) {
          const stats = performanceOptimizer.getOptimizationHealth();
          process.send?.({
            type: 'perf-stats-response',
            data: {
              ...stats,
              summary: {
                totalActions: stats.totalActions,
                successfulActions: stats.successfulActions,
                averageImprovement: stats.averageImprovement,
                currentlySlow: stats.currentlySlow,
                healthState: stats.currentlySlow > 0 ? 'warning' : 'healthy',
              },
            },
          });
        } else {
          process.send?.({
            type: 'error',
            error: 'PerformanceOptimizer agent is not initialized',
          });
        }
        break;
      }

      case 'get-domain-health': {
        const runtimeSafety = evaluateAgentRuntimeSafety();
        if (runtimeSafety.shouldPause) {
          process.send?.({ type: 'error', error: `Domain aggregator paused: ${runtimeSafety.reason}` });
          break;
        }

        if (domainAggregator) {
          const health = domainAggregator.getDomainSnapshot(msg.domain);
          const isSingleDomainSnapshot = !!msg.domain && health !== null && !(health instanceof Map);
          const payload = isSingleDomainSnapshot
            ? {
                ...health,
                summary: {
                  currentHealth: health.assessment?.healthState ?? 'unknown',
                  currentHealthScore: health.assessment?.healthScore ?? 0,
                  trend: health.assessment?.trend ?? 'stable',
                  confidence: health.assessment?.confidence ?? 0,
                  saturationScore: Math.round(Math.max(0, 100 - (health.assessment?.healthScore ?? 0))),
                },
              }
            : health;

          process.send?.({
            type: 'domain-health-response',
            data: payload,
          });
        } else {
          process.send?.({
            type: 'error',
            error: 'DomainAggregator agent is not initialized',
          });
        }
        break;
      }

      case 'get-capacity-forecast': {
        const runtimeSafety = evaluateAgentRuntimeSafety();
        if (runtimeSafety.shouldPause) {
          process.send?.({ type: 'error', error: `Capacity planner paused: ${runtimeSafety.reason}` });
          break;
        }

        if (capacityPlanner) {
          const forecast = capacityPlanner.getCapacityForecast();
          process.send?.({
            type: 'capacity-forecast-response',
            data: {
              ...forecast,
              summary: {
                currentHealth: forecast.currentCapacity?.assessment.healthState ?? 'unknown',
                currentHealthScore: forecast.currentCapacity?.assessment.healthScore ?? 0,
                trend: forecast.currentCapacity?.assessment.trend ?? 'stable',
                confidence: forecast.currentCapacity?.assessment.confidence ?? 0,
                saturationScore: forecast.currentCapacity?.assessment.saturationScore ?? 0,
              },
            },
          });
        } else {
          process.send?.({
            type: 'error',
            error: 'CapacityPlanner agent is not initialized',
          });
        }
        break;
      }

      case 'get-agent-health':
        // Report worker health
        process.send?.({
          type: 'agent-worker-health',
          data: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            agentsRunning: {
              performanceOptimizer: !!performanceOptimizer && performanceOptimizer.isRunning,
              domainAggregator: !!domainAggregator && domainAggregator.isRunning,
              capacityPlanner: !!capacityPlanner && capacityPlanner.isRunning,
              healthMonitor: !!healthMonitor && healthMonitor.isRunning,
            },
          },
        });
        break;

      case 'stop':
        logger.info('[AGENT_WORKER] Stopping all agents...');
        await stopAllAgents();
        process.send?.({ type: 'stopped' });
        process.exit(0);
        break;

      default:
        logger.warn(`[AGENT_WORKER] Unknown message type: ${msg.type}`);
    }
  } catch (error) {
    logger.error(`[AGENT_WORKER] Error handling message:`, error);
    process.send?.({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// Lifecycle
// ════════════════════════════════════════════════════════════════════════════════

async function stopAllAgents() {
  try {
    if (healthMonitor?.stop) healthMonitor.stop();
    if (performanceOptimizer?.stop) performanceOptimizer.stop();
    if (domainAggregator?.stop) domainAggregator.stop();
    if (capacityPlanner?.stop) capacityPlanner.stop();
    logger.info('[AGENT_WORKER] All agents stopped');
  } catch (error) {
    logger.error('[AGENT_WORKER] Error stopping agents:', error);
  }
}

process.on('SIGTERM', async () => {
  logger.info('[AGENT_WORKER] Received SIGTERM, shutting down gracefully...');
  await stopAllAgents();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[AGENT_WORKER] Received SIGINT, shutting down gracefully...');
  await stopAllAgents();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('[AGENT_WORKER] Uncaught exception:', error);
  // Don't crash - log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[AGENT_WORKER] Unhandled rejection:', reason);
  // Don't crash - log and continue
});

// ════════════════════════════════════════════════════════════════════════════════
// Start
// ════════════════════════════════════════════════════════════════════════════════

logger.info('[AGENT_WORKER] Starting agent worker process...');
initializeAgents().catch((error) => {
  logger.error('[AGENT_WORKER] Fatal error during startup:', error);
  process.exit(1);
});
