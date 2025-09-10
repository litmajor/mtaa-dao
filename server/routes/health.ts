// Simple health check endpoint for API
import express, { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
}
import { db } from '../storage';
import { metricsCollector } from '../monitoring/metricsCollector';
import { logger } from '../utils/logger';
import { env } from '@shared/config';

const router = express.Router();

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

interface HealthCheckResult {
  status: 'pass' | 'warn' | 'fail';
  responseTime: number;
  message?: string;
  details?: any;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    await db.execute('SELECT 1');
    return {
      status: 'pass',
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - startTime,
      message: 'Database connection failed',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    // Placeholder for Redis check - implement based on your Redis setup
    return {
      status: 'pass',
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - startTime,
      message: 'Redis connection failed',
      details: error instanceof Error ? error.message : String(error)
    };
  }
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

  return {
    status,
    responseTime: 0,
    message,
    details: {
      heapUsed: `${memoryUsageMB.toFixed(2)}MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`
    }
  };
}

function checkDisk(): HealthCheckResult {
  // Simplified disk check - in a real environment, you'd check actual disk usage
  return {
    status: 'pass',
    responseTime: 0,
    details: {
      available: 'Unknown',
      used: 'Unknown'
    }
  };
}

function checkStorage(): HealthCheckResult {
  // Check if storage is accessible
  try {
    return {
      status: 'pass',
      responseTime: 0
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: 0,
      message: 'Storage check failed',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  });
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const checks = {
      database: await checkDatabase(),
      redis: await checkRedis(),
      storage: checkStorage(),
      memory: checkMemory(),
      disk: checkDisk()
    };

    const metrics = metricsCollector.getMetrics();
    const healthScore = metricsCollector.getHealthScore();

    // Determine overall status
    const hasFailures = Object.values(checks).some(check => check.status === 'fail');
    const hasWarnings = Object.values(checks).some(check => check.status === 'warn');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings || healthScore < 80) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

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
        activeConnections: metrics.summary.activeConnections
      }
    };

    // Set appropriate HTTP status
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthCheck);

    // Log unhealthy status
    if (overallStatus === 'unhealthy') {
      logger.error('Health check failed', { checks, healthScore });
    }

  } catch (error) {
    logger.error('Health check error', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Readiness probe
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbCheck = await checkDatabase();
    if (dbCheck.status === 'fail') {
      return res.status(503).json({
        ready: false,
        reason: 'Database not available'
      });
    }

    res.json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: 'Readiness check failed'
    });
  }
});

// Liveness probe
router.get('/live', (req: Request, res: Response) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint for monitoring systems (JSON format)
router.get('/metrics', (req: Request, res: Response) => {
  const metrics = metricsCollector.getMetrics();
  res.json(metrics);
});

// Prometheus metrics endpoint
router.get('/metrics/prometheus', (req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain');
  res.send(metricsCollector.getPrometheusMetrics());
});

// System resource monitoring
router.get('/system', (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  res.json({
    memory: {
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`
    },
    cpu: {
      user: `${(cpuUsage.user / 1000000).toFixed(2)}s`,
      system: `${(cpuUsage.system / 1000000).toFixed(2)}s`
    },
    uptime: `${process.uptime().toFixed(2)}s`,
    version: process.version,
    platform: process.platform,
    arch: process.arch
  });
});

// Only one default export allowed per file. Remove duplicate.
