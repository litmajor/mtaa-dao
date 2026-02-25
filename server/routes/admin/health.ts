/**
 * System Health & State API Routes
 * Operational intelligence endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { healthRegistry } from '../../core/consolidation/HealthRegistryConsolidation';
import { circuitBreakerRegistry } from '../../core/consolidation/CircuitBreakerConsolidation';
import { Logger } from '../../utils/logger';

const router = Router();
const logger = Logger.getLogger();

/**
 * GET /api/admin/health/state
 * Get complete system state snapshot
 */
router.get('/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = healthRegistry.getSnapshot();

    res.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    logger.error('Failed to get system state:', error);
    next(error);
  }
});

/**
 * GET /api/admin/health/summary
 * Get quick health summary
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = healthRegistry.getSnapshot();
    const circuitBreakers = circuitBreakerRegistry.getAllStatuses();

    res.json({
      success: true,
      data: {
        timestamp: new Date(),
        systemStatus: snapshot.overallStatus,
        healthScore: snapshot.healthScore,
        uptime: snapshot.uptime,
        components: snapshot.components,
        database: health.database,
        memory: health.memory,
        circuitBreakers: Object.entries(circuitBreakers).map(([name, status]) => ({
          name,
          state: status.state,
          isHealthy: status.state === 'CLOSED',
          failureRate: status.failureRate,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to get health summary:', error);
    next(error);
  }
});

/**
 * GET /api/admin/health/telemetry
 * Get detailed telemetry data
 */
router.get('/telemetry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = healthRegistry.getSnapshot();

    res.json({
      success: true,
      data: {
        snapshot,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to get telemetry:', error);
    next(error);
  }
});

/**
 * GET /api/admin/health/circuit-breakers
 * Get circuit breaker status
 */
router.get('/circuit-breakers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statuses = circuitBreakerRegistry.getAllStatuses();
    const hasOpenCircuits = circuitBreakerRegistry.hasOpenCircuits();

    res.json({
      success: true,
      data: {
        hasOpenCircuits,
        breakers: Object.values(statuses),
      },
    });
  } catch (error) {
    logger.error('Failed to get circuit breaker status:', error);
    next(error);
  }
});

/**
 * GET /api/admin/health/agents
 * Get agent status
 */
router.get('/agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = healthRegistry.getSnapshot();

    res.json({
      success: true,
      data: {
        agents: snapshot.agents,
        activeAgents: snapshot.agents.filter((a) => a.status !== 'down').length,
        healthyAgents: snapshot.agents.filter((a) => a.healthScore >= 80).length,
        timestamp: snapshot.timestamp,
      },
    });
  } catch (error) {
    logger.error('Failed to get agent status:', error);
    next(error);
  }
});

/**
 * GET /api/admin/health/database
 * Get database status
 */
router.get('/database', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = healthRegistry.getSnapshot();

    res.json({
      success: true,
      data: {
        database: snapshot.components.find(c => c.type === 'database'),
        timestamp: snapshot.timestamp,
      },
    });
  } catch (error) {
    logger.error('Failed to get database status:', error);
    next(error);
  }
});

/**
 * GET /api/admin/health/redis
 * Get Redis status
 */
router.get('/redis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = healthRegistry.getSnapshot();

    res.json({
      success: true,
      data: {
        redis: snapshot.components.find(c => c.type === 'redis'),
        timestamp: snapshot.timestamp,
      },
    });
  } catch (error) {
    logger.error('Failed to get Redis status:', error);
    next(error);
  }
});

/**
 * GET /api/admin/health/jobs
 * Get job status
 */
router.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = healthRegistry.getSnapshot();

    res.json({
      success: true,
      data: {
        jobs: snapshot.jobs,
        timestamp: snapshot.timestamp,
      },
    });
  } catch (error) {
    logger.error('Failed to get job status:', error);
    next(error);
  }
});

/**
 * GET /api/admin/health/queues
 * Get queue status
 */
router.get('/queues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = healthRegistry.getSnapshot();

    res.json({
      success: true,
      data: {
        queues: snapshot.queues,
        timestamp: snapshot.timestamp,
      },
    });
  } catch (error) {
    logger.error('Failed to get queue status:', error);
    next(error);
  }
});

/**
 * GET /api/admin/health/exchange
 * Get exchange status
 */
router.get('/exchange', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = healthRegistry.getSnapshot();

    res.json({
      success: true,
      data: {
        exchange: snapshot.components.find(c => c.type === 'exchange'),
        timestamp: snapshot.timestamp,
      },
    });
  } catch (error) {
    logger.error('Failed to get exchange status:', error);
    next(error);
  }
});

export default router;
