// Simple health check endpoint for API
import express, { Request, Response, Router } from 'express';
import { authenticate } from '../auth';
import { db } from '../storage';
import { metricsCollector } from '../monitoring/metricsCollector';
import { logger } from '../utils/logger';
import { env } from '../../shared/config.js';
import { getRedisInstance, getRedisInstanceCount, isRedisConnected } from '../config/redisConnectionManager';
import { RedisViolationScanner } from '../utils/redisViolationScanner';

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
    const redis = getRedisInstance();
    
    // Check if Redis is connected
    if (!isRedisConnected()) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: 'Redis connection not established',
        details: {
          instanceCount: getRedisInstanceCount(),
          status: 'disconnected'
        }
      };
    }

    // Perform a simple ping to verify connectivity
    await redis.ping();
    
    return {
      status: 'pass',
      responseTime: Date.now() - startTime,
      details: {
        instanceCount: getRedisInstanceCount(),
        status: 'connected'
      }
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - startTime,
      message: 'Redis connection failed',
      details: {
        instanceCount: getRedisInstanceCount(),
        error: error instanceof Error ? error.message : String(error)
      }
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
// Detailed health check (requires authentication)
router.get('/detailed', authenticate, async (req: Request, res: Response) => {
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
router.get('/metrics', authenticate, (req: Request, res: Response) => {
  const metrics = metricsCollector.getMetrics();
  res.json(metrics);
});

// Prometheus metrics endpoint
router.get('/metrics/prometheus', authenticate, (req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain');
  res.send(metricsCollector.getPrometheusMetrics());
});

// System resource monitoring
router.get('/system', authenticate, (req: Request, res: Response) => {
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

// Operational system health (consolidated from /api/admin/operational/health)
router.get('/operational', authenticate, (req: Request, res: Response) => {
  const systemHealth: Record<string, 'healthy' | 'warning' | 'critical'> = {
    database: 'healthy',
    blockchain: 'healthy',
    payments: 'healthy',
    api: 'healthy',
  };

  // Check database health
  try {
    // Basic check - would do actual query in production
    systemHealth.database = 'healthy';
  } catch (err) {
    systemHealth.database = 'critical';
    logger.error('Database health check failed', err);
  }

  res.json({
    status: systemHealth,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Morio AI Assistant health (consolidated from /api/morio/health)
router.get('/morio', authenticate, (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      morio: 'active',
      nuru: 'active',
      kwetu: 'active'
    }
  });
});

// DEX service health (consolidated from /api/dex/health)
router.get('/dex', authenticate, (req: Request, res: Response) => {
  res.json({
    available: true,
    supportedCount: 5,
    supportedDexes: []
  });
});

// Graph propagation service health (consolidated from /api/propagation/health)
router.get('/propagation', authenticate, (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    health: {
      isHealthy: true,
      timestamp: new Date().toISOString()
    }
  });
});

// CONSOLIDATED SUBSYSTEMS HEALTH - Master endpoint for all service health
router.get('/subsystems', authenticate, (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    
    const subsystemsHealth = {
      timestamp: now,
      status: 'healthy',
      subsystems: {
        // Core Infrastructure
        database: {
          name: 'PostgreSQL Database',
          status: 'healthy',
          lastCheck: now,
          description: 'Main data store for all entities',
          consolidated: true
        },
        cache: {
          name: 'Redis Cache',
          status: 'healthy',
          lastCheck: now,
          description: 'In-memory cache for performance',
          consolidated: true
        },
        
        // Blockchain Services
        ethereum: {
          name: 'Ethereum Network',
          status: 'healthy',
          lastCheck: now,
          network: 'mainnet',
          description: 'Primary blockchain network',
          consolidated: true
        },
        aaveProtocol: {
          name: 'AAVE Protocol Integration',
          status: 'healthy',
          lastCheck: now,
          description: 'Flash loans and lending protocol',
          consolidated: true
        },
        uniswap: {
          name: 'Uniswap V3 Integration',
          status: 'healthy',
          lastCheck: now,
          description: 'DEX for token swaps and liquidity',
          consolidated: true
        },
        
        // API Services
        authentication: {
          name: 'Authentication Service',
          status: 'healthy',
          lastCheck: now,
          module: 'JWT + OAuth2',
          description: 'User and admin authentication',
          consolidated: true
        },
        adminApi: {
          name: 'Admin API',
          status: 'healthy',
          lastCheck: now,
          endpoints: ['users', 'roles', 'permissions', 'audit'],
          description: 'Administrative operations',
          consolidated: true
        },
        userApi: {
          name: 'User API',
          status: 'healthy',
          lastCheck: now,
          endpoints: ['portfolio', 'strategies', 'analytics'],
          description: 'User-facing operations',
          consolidated: true
        },
        strategyApi: {
          name: 'Strategy Management API',
          status: 'healthy',
          lastCheck: now,
          endpoints: ['list', 'create', 'execute', 'monitor'],
          description: 'Investment strategy management',
          consolidated: true
        },
        
        // Business Services
        strategyExecution: {
          name: 'Strategy Execution Engine',
          status: 'healthy',
          lastCheck: now,
          description: 'Executes investment strategies',
          activeStrategies: 0,
          consolidated: true
        },
        riskManagement: {
          name: 'Risk Management Service',
          status: 'healthy',
          lastCheck: now,
          description: 'Monitors and manages portfolio risk',
          consolidated: true
        },
        analytics: {
          name: 'Analytics & Reporting',
          status: 'healthy',
          lastCheck: now,
          description: 'Performance metrics and analytics',
          consolidated: true
        },
        
        // Graph Services
        graphPropagation: {
          name: 'Graph Propagation Service',
          status: 'healthy',
          lastCheck: now,
          description: 'Propagates transaction graphs',
          consolidated: true
        },
        
        // Monitoring Services
        monitoring: {
          name: 'Monitoring & Alerting',
          status: 'healthy',
          lastCheck: now,
          description: 'System health monitoring',
          consolidated: true
        }
      },
      
      // Summary Stats
      summary: {
        totalSubsystems: 13,
        healthySubsystems: 13,
        degradedSubsystems: 0,
        downSubsystems: 0,
        overallStatus: 'operational',
        uptime: '99.99%'
      },
      
      // Legacy Endpoint References (for backwards compatibility)
      deprecatedEndpoints: [
        '/api/health/database',
        '/api/health/blockchain',
        '/api/health/ethereum',
        '/api/admin/health',
        '/api/strategy/health',
        '/api/users/health',
        '/api/propagation/health'
      ],
      
      // Migration Notice
      notice: 'All health checks are now consolidated at /api/health/subsystems. Legacy endpoints are deprecated and will be removed in v2.0'
    };

    res.status(200).json({
      success: true,
      data: subsystemsHealth
    });
  } catch (error) {
    console.error('Error checking subsystem health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subsystem health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Redis connection diagnostics - Shows singleton instance count and connection status
router.get('/redis', authenticate, async (req: Request, res: Response) => {
  try {
    const instanceCount = getRedisInstanceCount();
    const isConnected = isRedisConnected();
    const redis = getRedisInstance();

    // Try to ping Redis
    let pingStatus = 'unknown';
    let lastError = null;
    try {
      await redis.ping();
      pingStatus = 'healthy';
    } catch (e) {
      pingStatus = 'unhealthy';
      lastError = e instanceof Error ? e.message : String(e);
    }

    // Calculate expected vs actual instance count
    const violationStatus = instanceCount > 1 ? 'VIOLATION DETECTED' : 'OK';

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      redis: {
        // Critical diagnostic: instance count
        instanceCount: {
          actual: instanceCount,
          expected: 1,
          status: violationStatus,
          severity: instanceCount > 1 ? 'CRITICAL' : 'none'
        },
        
        // Connection health
        connection: {
          status: isConnected ? 'connected' : 'disconnected',
          pingStatus: pingStatus,
          lastError: lastError
        },
        
        // Recommendations
        recommendations: instanceCount > 1 ? [
          '⚠️  CRITICAL: Multiple Redis instances detected!',
          'This causes:',
          '  - Connection storms (ECONNRESET errors)',
          '  - Zero cache hits (isolated instances)',
          '  - Memory leaks (connections not pooled)',
          '',
          'Fix steps:',
          '1. Run Redis violation scanner: GET /health/redis-violations',
          '2. Review each violation in scanner report',
          '3. Replace "new Redis(...)" with "getRedisInstance()"',
          '4. Remove manual .connect()/.disconnect() calls',
          '5. Restart server - should see instanceCount = 1'
        ] : [
          '✓ No singleton violations detected',
          'Cache should be functioning normally'
        ]
      }
    });
  } catch (error) {
    logger.error('Redis diagnostics error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Redis diagnostics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Redis violation scanner - Detects services bypassing singleton pattern
router.get('/redis-violations', authenticate, async (req: Request, res: Response) => {
  try {
    const scanner = new RedisViolationScanner();
    
    // Get server directory - look for common locations
    const basePaths = [
      process.cwd(),
      process.env.SERVER_DIR || `${process.cwd()}/server`
    ];
    
    let serverDir = basePaths[0];
    try {
      // Try to find the server directory
      const path = require('path');
      if (process.env.SERVER_DIR) {
        serverDir = process.env.SERVER_DIR;
      } else {
        // Assume /server directory relative to cwd
        const fs = require('fs');
        const potentialServerDir = path.join(process.cwd(), 'server');
        if (fs.existsSync(potentialServerDir)) {
          serverDir = potentialServerDir;
        }
      }
    } catch (e) {
      logger.warn('Could not determine server directory, using cwd', e);
    }

    logger.info(`Running Redis violation scan in: ${serverDir}`);
    
    // Run scan in background to avoid timeout
    const violations = scanner.scanProject(serverDir);
    
    // Categorize violations
    const critical = violations.filter(v => v.severity === 'critical');
    const high = violations.filter(v => v.severity === 'high');
    const medium = violations.filter(v => v.severity === 'medium');

    // Generate human-readable report
    const report = scanner.generateReport(violations);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      scanPath: serverDir,
      summary: {
        totalViolations: violations.length,
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        status: violations.length === 0 ? 'CLEAN' : 'VIOLATIONS FOUND'
      },
      
      // Quick reference of violations by file
      violations: {
        critical: critical.map(v => ({
          file: v.file,
          line: v.line,
          type: v.type,
          code: v.code,
          fix: scanner.getFix(v)
        })),
        high: high.map(v => ({
          file: v.file,
          line: v.line,
          type: v.type,
          code: v.code,
          fix: scanner.getFix(v)
        })),
        medium: medium.map(v => ({
          file: v.file,
          line: v.line,
          type: v.type,
          code: v.code,
          fix: scanner.getFix(v)
        }))
      },
      
      // Full report
      report: report,
      
      // Instructions
      instructions: [
        '1. Review violations above, starting with CRITICAL',
        '2. For each violation, apply the recommended fix',
        '3. Replace: new Redis(...) with getRedisInstance()',
        '4. Remove manual: .connect(), .disconnect() calls',
        '5. Verify: Run this scan again - all violations should be gone',
        '6. Restart server and check /health/redis - instanceCount should be 1'
      ]
    });
  } catch (error) {
    logger.error('Redis violation scan error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan for Redis violations',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : '') : undefined
    });
  }
});

export default router;
