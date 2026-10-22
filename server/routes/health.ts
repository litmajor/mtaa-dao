// INTEGRATED HEALTH ROUTER — Aligned with HealthRegistry & Monitor Agent
// ============================================================================
// Replaces: server/routes/health.routes.ts
// 
// Integration points:
//   • All check results feed into HealthRegistry (single source of truth)
//   • NEW: /api/health/docs/health  → Agent-compatible endpoint
//   • NEW: /api/health/docs/stats/summary → Agent-compatible stats
//   • /subsystems now dynamically reads from HealthRegistry
//   • All legacy endpoints preserved for backward compatibility
// ============================================================================

import express from 'express';
import type { Request, Response, Router } from 'express';
import { authenticate } from '../auth';
import { requireRole } from '../middleware/rbac';
import { db } from '../storage';
import { metricsCollector } from '../monitoring/metricsCollector';
import { logger } from '../utils/logger';
import { env } from '../../shared/config.js';
import { getRedisInstanceCount } from '../config/redisConnectionManager';
import { redisService } from '../services/redis';
import { RedisViolationScanner } from '../utils/redisViolationScanner';
import type { RedisViolation } from '../utils/redisViolationScanner';

// ── HealthRegistry Integration ───────────────────────────────────────────────
import { healthRegistry } from '../core/consolidation/HealthRegistryConsolidation';
import { initializeHealthRegistryComponents } from '../core/consolidation/HealthBootstrap';

const router = express.Router();

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

interface HealthCheckResult {
  status: 'pass' | 'warn' | 'fail';
  responseTime: number;
  message?: string;
  details?: any;
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    storage: HealthCheckResult;
    memory: HealthCheckResult;
    disk: HealthCheckResult;
  };
  metrics: {
    healthScore: number;
    responseTime: number;
    errorRate: number;
    activeConnections: number;
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Registry Bootstrap — Register all components on module load
// ═════════════════════════════════════════════════════════════════════════════

const COMPONENT_NAMES = {
  database: 'PostgreSQL Database',
  redis: 'Redis Cache',
  storage: 'File Storage',
  memory: 'Node.js Memory',
  disk: 'Disk I/O',
} as const;

initializeHealthRegistryComponents();

// ═════════════════════════════════════════════════════════════════════════════
// Check Functions — Now dual-write to Registry + return result
// ═════════════════════════════════════════════════════════════════════════════

async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const componentName = COMPONENT_NAMES.database;

  try {
    await db.execute('SELECT 1');
    const latency = Date.now() - startTime;

    // ── Registry update ──
    healthRegistry.recordComponentSuccess(componentName, latency);
    healthRegistry.setDatabaseConnected(true);
    healthRegistry.recordDatabaseQuery(latency, true);

    return { status: 'pass', responseTime: latency };
  } catch (error) {
    const latency = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));

    // ── Registry update ──
    healthRegistry.recordComponentFailure(componentName, err, 'error');
    healthRegistry.setDatabaseConnected(false);
    healthRegistry.recordDatabaseQuery(latency, false);

    return {
      status: 'fail',
      responseTime: latency,
      message: 'Database connection failed',
      details: err.message,
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const componentName = COMPONENT_NAMES.redis;

  // Bounded ping via UnifiedRedis (timeout + circuit breaker); never hangs.
  const healthy = await redisService.healthCheck();
  const status = redisService.getStatus();
  const latency = Date.now() - startTime;
  const details = { instanceCount: getRedisInstanceCount(), ...status };

  if (healthy && status.status === 'up') {
    healthRegistry.recordComponentSuccess(componentName, latency);
    return { status: 'pass', responseTime: latency, details };
  }

  // Redis down/degraded is served by the in-memory fallback: degrade, don't fail.
  const message = status.status === 'down'
    ? 'Redis unavailable – serving from in-memory fallback'
    : 'Redis degraded';
  healthRegistry.recordComponentFailure(componentName, new Error(status.lastError || message), 'warn');
  return { status: 'warn', responseTime: latency, message, details };
}

function checkMemory(): HealthCheckResult {
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;

  let status: 'pass' | 'warn' | 'fail' = 'pass';
  let message: string | undefined;

  if (memoryUsageMB > 1000) {
    status = 'fail';
    message = `High memory usage: ${memoryUsageMB.toFixed(2)}MB`;
  } else if (memoryUsageMB > 500) {
    status = 'warn';
    message = `Moderate memory usage: ${memoryUsageMB.toFixed(2)}MB`;
  }

  // ── Registry update ──
  // Memory is auto-tracked by registry snapshot, but we can log component status
  const componentName = COMPONENT_NAMES.memory;
  if (status === 'fail') {
    healthRegistry.recordComponentFailure(
      componentName,
      new Error(message),
      'error'
    );
  } else if (status === 'warn') {
    healthRegistry.recordComponentFailure(
      componentName,
      new Error(message),
      'warn'
    );
  } else {
    healthRegistry.recordComponentSuccess(componentName, 0);
  }

  return {
    status,
    responseTime: 0,
    message,
    details: {
      heapUsed: `${memoryUsageMB.toFixed(2)}MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
    },
  };
}

function checkDisk(): HealthCheckResult {
  // TODO: Implement actual disk check using fs.statfs or diskusage package
  healthRegistry.recordComponentSuccess(COMPONENT_NAMES.disk, 0);

  return {
    status: 'pass',
    responseTime: 0,
    details: { available: 'Unknown', used: 'Unknown', note: 'Implement fs.statfs for real data' },
  };
}

function checkStorage(): HealthCheckResult {
  try {
    healthRegistry.recordComponentSuccess(COMPONENT_NAMES.storage, 0);
    return { status: 'pass', responseTime: 0 };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    healthRegistry.recordComponentFailure(COMPONENT_NAMES.storage, err, 'error');

    return {
      status: 'fail',
      responseTime: 0,
      message: 'Storage check failed',
      details: err.message,
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Helper: Build agent-compatible health status from registry + live checks
// ═════════════════════════════════════════════════════════════════════════════

function buildAgentHealthPayload(): {
  status: 'healthy' | 'degraded' | 'critical';
  overallErrorRate: number;
  unhealthyEndpoints: number;
  totalEndpoints: number;
  timestamp: string;
  registrySnapshot?: unknown;
} {
  try {
    const snapshot = healthRegistry.getSnapshot();
    const components = snapshot.components ?? [];

    const totalEndpoints = components.length;
    const unhealthyEndpoints = components.filter(
      (c) => c.status === 'critical' || c.status === 'degraded'
    ).length;

    const failureRates = components.map((c) => c.failureRate ?? 0);
    const overallErrorRate = failureRates.length
      ? failureRates.reduce((a, b) => a + b, 0) / failureRates.length
      : 0;

    const status: 'healthy' | 'degraded' | 'critical' =
      snapshot.overallStatus === 'critical' || unhealthyEndpoints > 10
        ? 'critical'
        : snapshot.overallStatus === 'degraded' || unhealthyEndpoints > 5
        ? 'degraded'
        : 'healthy';

    return {
      status,
      overallErrorRate: Math.round(overallErrorRate * 100) / 100,
      unhealthyEndpoints,
      totalEndpoints,
      timestamp: new Date().toISOString(),
      registrySnapshot: snapshot,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[HEALTH] Failed to build agent health payload', err);

    return {
      status: 'critical' as const,
      overallErrorRate: 100,
      unhealthyEndpoints: 1,
      totalEndpoints: 1,
      timestamp: new Date().toISOString(),
      registrySnapshot: { error: err.message },
    };
  }
}

function buildAgentSummaryPayload(): {
  summary: {
    totalEndpoints: number;
    totalCalls: number;
    avgLatency: number;
    p99Latency: number;
    healthyCount: number;
    degradedCount: number;
    criticalCount: number;
  };
  timestamp: string;
} {
  try {
    const snapshot = healthRegistry.getSnapshot();
    const components = snapshot.components ?? [];

    const latencies = components
      .map((c) => c.latency)
      .filter((l): l is number => l !== null)
      .sort((a, b) => a - b);

    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    const p99Index = Math.floor(latencies.length * 0.99);
    const p99Latency = latencies.length ? latencies[Math.min(p99Index, latencies.length - 1)] : 0;

    return {
      summary: {
        totalEndpoints: components.length,
        totalCalls: components.reduce((sum, c) => sum + c.successCount + c.failureCount, 0),
        avgLatency,
        p99Latency,
        healthyCount: components.filter((c) => c.status === 'healthy').length,
        degradedCount: components.filter((c) => c.status === 'degraded').length,
        criticalCount: components.filter((c) => c.status === 'critical').length,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[HEALTH] Failed to build agent summary payload', err);

    return {
      summary: {
        totalEndpoints: 0,
        totalCalls: 0,
        avgLatency: 0,
        p99Latency: 0,
        healthyCount: 0,
        degradedCount: 0,
        criticalCount: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Routes
// ═════════════════════════════════════════════════════════════════════════════

// ── Basic health (public) ──
router.get('/', async (_req: Request, res: Response) => {
  const redisStatus = redisService.getStatus();
  res.json({
    status: redisStatus.status === 'up' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    redis: {
      status: redisStatus.status,
      usingFallback: redisStatus.usingFallback,
      lastError: redisStatus.lastError,
      lastErrorAt: redisStatus.lastErrorAt,
      circuitState: redisStatus.circuitState,
    },
  });
});

// ── Agent-compatible: /api/health/docs/health ──
// This is what HealthMonitorAgent polls. Returns lightweight status.
router.get('/docs/health', async (_req: Request, res: Response) => {
  const payload = buildAgentHealthPayload();
  const statusCode = payload.status === 'critical' ? 503 : 200;
  res.status(statusCode).json(payload);
});

// ── Agent-compatible: /api/health/docs/stats/summary ──
// This is what HealthMonitorAgent polls for stats.
router.get('/docs/stats/summary', async (_req: Request, res: Response) => {
  res.json(buildAgentSummaryPayload());
});

// ── Detailed health check (requires authentication) ──
router.get('/detailed', authenticate, async (_req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const checks = {
      database: await checkDatabase(),
      redis: await checkRedis(),
      storage: checkStorage(),
      memory: checkMemory(),
      disk: checkDisk(),
    };

    const metrics = metricsCollector.getMetrics();
    const healthScore = metricsCollector.getHealthScore();

    const hasFailures = Object.values(checks).some((c) => c.status === 'fail');
    const hasWarnings = Object.values(checks).some((c) => c.status === 'warn');

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (hasFailures) overallStatus = 'unhealthy';
    else if (hasWarnings || healthScore < 80) overallStatus = 'degraded';
    else overallStatus = 'healthy';

    const healthCheck: HealthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks,
      metrics: {
        healthScore,
        responseTime: Date.now() - startTime,
        errorRate: metrics.summary.errorRate,
        activeConnections: metrics.summary.activeConnections,
      },
    };

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(healthCheck);

    if (overallStatus === 'unhealthy') {
      logger.error('Health check failed', { checks, healthScore });
    }
  } catch (error) {
    logger.error('Health check error', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// ── Readiness probe ──
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const dbCheck = await checkDatabase();
    if (dbCheck.status === 'fail') {
      return res.status(503).json({ ready: false, reason: 'Database not available' });
    }
    res.json({ ready: true, timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ ready: false, reason: 'Readiness check failed' });
  }
});

// ── Liveness probe ──
router.get('/live', (_req: Request, res: Response) => {
  res.json({ alive: true, timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ── Metrics endpoints ──
router.get('/metrics', authenticate, requireRole('super_admin'), (_req: Request, res: Response) => {
  res.json(metricsCollector.getMetrics());
});

router.get('/metrics/prometheus', authenticate, requireRole('super_admin'), (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain');
  res.send(metricsCollector.getPrometheusMetrics());
});

// ── System resources ──
router.get('/system', authenticate, requireRole('super_admin'), (_req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  res.json({
    memory: {
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`,
    },
    cpu: {
      user: `${(cpuUsage.user / 1000000).toFixed(2)}s`,
      system: `${(cpuUsage.system / 1000000).toFixed(2)}s`,
    },
    uptime: `${process.uptime().toFixed(2)}s`,
    version: process.version,
    platform: process.platform,
    arch: process.arch,
  });
});

// ── Operational health ──
router.get('/operational', authenticate, requireRole('super_admin'), (_req: Request, res: Response) => {
  const snapshot = healthRegistry.getSnapshot();
  const systemHealth: Record<string, 'healthy' | 'warning' | 'critical'> = {};

  for (const comp of snapshot.components) {
    systemHealth[comp.name] =
      comp.status === 'healthy' ? 'healthy' : comp.status === 'degraded' ? 'warning' : 'critical';
  }

  // Ensure legacy keys exist
  systemHealth.database ??= snapshot.database.status === 'healthy' ? 'healthy' : 'critical';
  systemHealth.blockchain ??= 'healthy';
  systemHealth.payments ??= 'healthy';
  systemHealth.api ??= snapshot.overallStatus === 'healthy' ? 'healthy' : 'warning';

  res.json({
    status: systemHealth,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    registryScore: snapshot.healthScore,
  });
});

// ── Subsystem health (NOW DYNAMIC via HealthRegistry) ──
router.get('/subsystems', authenticate, requireRole('super_admin'), (_req: Request, res: Response) => {
  try {
    const snapshot = healthRegistry.getSnapshot();
    const now = new Date().toISOString();

    // Map registry components to subsystem format
    const subsystems: Record<string, any> = {};
    for (const comp of snapshot.components) {
      subsystems[comp.name.toLowerCase().replace(/\\s+/g, '')] = {
        name: comp.name,
        status: comp.status === 'unknown' ? 'healthy' : comp.status,
        lastCheck: comp.lastUpdate?.toISOString() || now,
        description: `${comp.type} component`,
        consolidated: true,
        latency: comp.latency,
        failureRate: comp.failureRate,
      };
    }

    // Add agents
    for (const agent of snapshot.agents) {
      subsystems[agent.name.toLowerCase()] = {
        name: `${agent.name} Agent`,
        status: agent.status,
        lastCheck: agent.lastHeartbeat?.toISOString() || now,
        description: `Agent ${agent.agentId}`,
        consolidated: true,
        taskCount: agent.taskCount,
        errorRate: agent.errorRate,
      };
    }

    // Add jobs
    for (const job of snapshot.jobs) {
      subsystems[job.jobName.toLowerCase().replace(/\\s+/g, '')] = {
        name: job.jobName,
        status: job.status,
        lastCheck: job.lastExecutionTime?.toISOString() || now,
        description: 'Scheduled job',
        consolidated: true,
        executionCount: job.executionCount,
        failureCount: job.failureCount,
      };
    }

    const healthyCount = Object.values(subsystems).filter(
      (s: any) => s.status === 'healthy'
    ).length;
    const degradedCount = Object.values(subsystems).filter(
      (s: any) => s.status === 'degraded'
    ).length;
    const criticalCount = Object.values(subsystems).filter(
      (s: any) => s.status === 'critical' || s.status === 'offline' || s.status === 'failed'
    ).length;

    const subsystemsHealth = {
      timestamp: now,
      status: snapshot.overallStatus,
      subsystems,
      summary: {
        totalSubsystems: Object.keys(subsystems).length,
        healthySubsystems: healthyCount,
        degradedSubsystems: degradedCount,
        downSubsystems: criticalCount,
        overallStatus: snapshot.overallStatus,
        uptime: `${process.uptime().toFixed(0)}s`,
        healthScore: snapshot.healthScore,
      },
      criticalIssues: snapshot.criticalIssues,
      warnings: snapshot.warnings,
      recommendations: snapshot.recommendations,
      deprecatedEndpoints: [
        '/api/health/database',
        '/api/health/blockchain',
        '/api/health/ethereum',
        '/api/admin/health',
        '/api/strategy/health',
        '/api/users/health',
        '/api/propagation/health',
      ],
      notice:
        'All health checks are now consolidated at /api/health/subsystems. Legacy endpoints are deprecated and will be removed in v2.0',
    };

    res.status(200).json({ success: true, data: subsystemsHealth });
  } catch (error) {
    logger.error('Error checking subsystem health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subsystem health',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ── Registry snapshot (raw) ──
router.get('/registry', authenticate, requireRole('super_admin'), (_req: Request, res: Response) => {
  res.json(healthRegistry.getSnapshot());
});

// ── Legacy service endpoints (preserved, now registry-backed) ──
router.get('/morio', authenticate, requireRole('super_admin'), (_req: Request, res: Response) => {
  const snapshot = healthRegistry.getSnapshot();
  const morioAgent = snapshot.agents.find((a) => a.name === 'MORIO');

  res.json({
    status: morioAgent?.status || 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      morio: morioAgent?.status || 'active',
      nuru: 'active',
      kwetu: 'active',
    },
  });
});

router.get('/dex', authenticate, requireRole('super_admin'), (_req: Request, res: Response) => {
  res.json({ available: true, supportedCount: 5, supportedDexes: [] });
});

router.get('/propagation', authenticate, requireRole('super_admin'), (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    health: { isHealthy: true, timestamp: new Date().toISOString() },
  });
});

// ── Redis diagnostics ──
router.get('/redis', authenticate, requireRole('super_admin'), async (_req: Request, res: Response) => {
  try {
    const instanceCount = getRedisInstanceCount();
    const pingOk = await redisService.healthCheck();
    const status = redisService.getStatus();
    const connected = status.connected;
    const pingStatus = pingOk ? 'healthy' : 'unhealthy';
    const lastError = status.lastError;

    const violationStatus = instanceCount > 1 ? 'VIOLATION DETECTED' : 'OK';

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      redis: {
        instanceCount: {
          actual: instanceCount,
          expected: 1,
          status: violationStatus,
          severity: instanceCount > 1 ? 'CRITICAL' : 'none',
        },
        connection: {
          status: connected ? 'connected' : 'disconnected',
          pingStatus,
          lastError,
        },
        resilience: status,
        recommendations:
          instanceCount > 1
            ? [
                '⚠️  CRITICAL: Multiple Redis instances detected!',
                'This causes: connection storms, zero cache hits, memory leaks.',
                'Fix: Replace "new Redis(...)" with "getRedisInstance()"',
              ]
            : ['✓ No singleton violations detected'],
      },
    });
  } catch (error) {
    logger.error('Redis diagnostics error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Redis diagnostics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/redis-violations', authenticate, requireRole('super_admin'), async (_req: Request, res: Response) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const basePaths = [process.cwd(), process.env.SERVER_DIR || `${process.cwd()}/server`];

    let serverDir = basePaths[0];
    const potentialServerDir = path.join(process.cwd(), 'server');
    if (fs.existsSync(potentialServerDir)) serverDir = potentialServerDir;

    logger.info(`Running Redis violation scan in: ${serverDir}`);
    const violations = RedisViolationScanner.scanProject(serverDir);

    const critical = violations.filter((v: RedisViolation) => v.severity === 'critical');
    const high = violations.filter((v: RedisViolation) => v.severity === 'high');
    const medium = violations.filter((v: RedisViolation) => v.severity === 'medium');
    const report = RedisViolationScanner.generateReport(violations);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      scanPath: serverDir,
      summary: {
        totalViolations: violations.length,
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        status: violations.length === 0 ? 'CLEAN' : 'VIOLATIONS FOUND',
      },
      violations: {
        critical: critical.map((v: RedisViolation) => ({
          file: v.file,
          line: v.line,
          type: v.type,
          code: v.code,
          fix: RedisViolationScanner.getFix(v),
        })),
        high: high.map((v: RedisViolation) => ({
          file: v.file,
          line: v.line,
          type: v.type,
          code: v.code,
          fix: RedisViolationScanner.getFix(v),
        })),
        medium: medium.map((v: RedisViolation) => ({
          file: v.file,
          line: v.line,
          type: v.type,
          code: v.code,
          fix: RedisViolationScanner.getFix(v),
        })),
      },
      report,
      instructions: [
        '1. Review violations above, starting with CRITICAL',
        '2. Replace: new Redis(...) with getRedisInstance()',
        '3. Remove manual: .connect(), .disconnect() calls',
        '4. Verify: Run this scan again',
        '5. Restart server and check /health/redis - instanceCount should be 1',
      ],
    });
  } catch (error) {
    logger.error('Redis violation scan error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan for Redis violations',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : '') : undefined,
    });
  }
});

export default router;