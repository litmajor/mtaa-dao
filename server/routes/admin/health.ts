/**
 * System Health & State API Routes
 * Operational intelligence endpoints
 * 
 * ⚠️  CRITICAL: ALL endpoints require SUPER_ADMIN role
 * These endpoints expose sensitive system topology and must be heavily restricted
 */

import { Router, Request, Response, NextFunction } from 'express';
import { healthRegistry } from '../../core/consolidation/HealthRegistryConsolidation';
import { circuitBreakerRegistry } from '../../core/consolidation/CircuitBreakerConsolidation';
import { Logger } from '../../utils/logger';
import { authenticateToken } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { logConsolidatedAuditEvent, AuditEventType } from '../../services/auditConsolidated';
import { getSingletonHealthStatus } from '../../utils/singletonVerifier';

const router = Router();
const logger = Logger.getLogger();

/**
 * Middleware: Require superuser authentication for all health endpoints
 */
const requireSuperAdmin = requireRole('super_admin');

/**
 * Middleware: Log access to sensitive health/telemetry endpoints
 */
const auditHealthAccess = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)?.id || 'unknown';
  const endpoint = req.originalUrl || req.path;
  
  // Log the access
  await logConsolidatedAuditEvent({
    actorId: userId,
    actionType: AuditEventType.ADMIN_USER_LIST_ACCESSED, // Using as generic admin access
    actionCategory: 'admin',
    targetType: 'health_telemetry',
    targetId: endpoint,
    result: 'success',
    endpoint,
    metadata: {
      component: req.path.split('/').pop() || 'unknown',
    },
  }).catch(err => logger.warn('[Health] Audit log failed:', err));

  next();
};

/**
 * GET /api/admin/health/state
 * Get complete system state snapshot
 * ⚠️ REQUIRES: super_admin role (leaks full system topology)
 */
router.get('/state', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
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
 * ⚠️ REQUIRES: super_admin role (leaks queue depths, circuit breaker status)
 */
router.get('/summary', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
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
 * ⚠️ REQUIRES: super_admin role (leaks detailed system metrics)
 */
router.get('/telemetry', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
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
 * ⚠️ REQUIRES: super_admin role (leaks circuit breaker failure rates and state)
 */
router.get('/circuit-breakers', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
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
 * ⚠️ REQUIRES: super_admin role (leaks agent deployment info and status)
 */
router.get('/agents', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
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
 * ⚠️ REQUIRES: super_admin role (leaks database health, connection status)
 */
router.get('/database', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
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
 * ⚠️ REQUIRES: super_admin role (leaks Redis connection status and configuration)
 */
router.get('/redis', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
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
 * ⚠️ REQUIRES: super_admin role (leaks job queue depth and execution schedule)
 */
router.get('/jobs', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
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
 * ⚠️ REQUIRES: super_admin role (leaks queue depth and worker utilization)
 */
router.get('/queues', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
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
 * ⚠️ REQUIRES: super_admin role (leaks exchange integration details and status)
 */
router.get('/exchange', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * GET /api/admin/health/singletons
 * Verify singleton instance health
 * ⚠️ REQUIRES: super_admin role (verifies all critical services are singletons)
 * 
 * Returns:
 * - allValid: boolean indicating if all services have exactly 1 instance
 * - violations: array of services with duplicate instances
 * - totalServices: total number of verified services
 * 
 * Example response:
 * {
 *   "success": true,
 *   "data": {
 *     "status": "healthy" | "degraded",
 *     "timestamp": "2026-03-03T...",
 *     "singletons": {
 *       "allValid": true,
 *       "violations": [],
 *       "totalServices": 8,
 *       "services": [
 *         { "name": "Redis", "count": 1, "valid": true },
 *         { "name": "WebSocket", "count": 1, "valid": true },
 *         ...
 *       ]
 *     }
 *   }
 * }
 */
router.get('/singletons', [authenticateToken, requireSuperAdmin, auditHealthAccess], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const singletonStatus = getSingletonHealthStatus();
    
    res.json({
      success: true,
      data: {
        status: singletonStatus.allValid ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        singletons: {
          allValid: singletonStatus.allValid,
          violations: singletonStatus.violations,
          totalServices: singletonStatus.totalServices,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get singleton health status:', error);
    next(error);
  }
});

export default router;
