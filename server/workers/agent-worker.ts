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
 * This file runs in a worker thread/process and is NOT part of main API
 * 
 * Benefits:
 * - API remains responsive during heavy agent compute
 * - Prevents event loop blocking
 * - Isolates agent failures (one crash ≠ API crash)
 * - Agent CPU spikes don't affect user requests
 * - Easy to monitor/restart independently
 */

import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// Agent Initialization
// ════════════════════════════════════════════════════════════════════════════════

let performanceOptimizer: any = null;
let domainAggregator: any = null;
let capacityPlanner: any = null;
let healthMonitor: any = null;

// Configuration from environment with fallbacks
const agentPort = parseInt(process.env.AGENT_PORT || process.env.PORT || '5000');
const agentHost = process.env.AGENT_HOST || 'localhost';
const baseUrl = process.env.AGENT_BASE_URL || `http://${agentHost}:${agentPort}`;

async function initializeAgents() {
  logger.info('[AGENT_WORKER] Initializing agents in isolated worker...');

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
async function initAgentWithErrorBoundary(
  name: string,
  initFn: () => any
): Promise<any> {
  try {
    const agent = initFn();
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

process.on('message', async (message: any) => {
  if (!message || !message.type) return;

  try {
    switch (message.type) {
      case 'get-perf-stats':
        if (performanceOptimizer) {
          const stats = performanceOptimizer.getOptimizationHealth();
          process.send?.({
            type: 'perf-stats-response',
            data: stats,
          });
        }
        break;

      case 'get-domain-health':
        if (domainAggregator) {
          const health = domainAggregator.getDomainSnapshot(message.domain);
          process.send?.({
            type: 'domain-health-response',
            data: health,
          });
        }
        break;

      case 'get-capacity-forecast':
        if (capacityPlanner) {
          const forecast = capacityPlanner.getCapacityForecast();
          process.send?.({
            type: 'capacity-forecast-response',
            data: forecast,
          });
        }
        break;

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
        logger.warn(`[AGENT_WORKER] Unknown message type: ${message.type}`);
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
