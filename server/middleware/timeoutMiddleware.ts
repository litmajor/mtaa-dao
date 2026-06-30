/**
 * Timeout Middleware
 * Detects long-running operations and auto-queues them to Bull
 * Attaches metadata flags for routes to check and respond appropriately
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Route timeout configuration
export interface TimeoutConfig {
  defaultTimeoutMs: number; // Default timeout for all routes (5s)
  heavyComputeTimeoutMs: number; // Backtest, optimize, analysis (30-60s)
  routes?: {
    pathPattern: RegExp | string;
    timeoutMs: number;
    queueJobType?: string;
    description?: string;
  }[];
}

// Timeout categories
export const TIMEOUT_CATEGORIES = {
  FAST: 5000, // 5s - Simple queries, listings, quick operations
  MODERATE: 10000, // 10s - Some computation, multi-DB queries
  HEAVY: 30000, // 30s - Backtesting, optimization, complex analysis
  VERY_HEAVY: 60000, // 60s - Extended operations (Freqtrade optimization, etc.)
};

// Route patterns and their timeouts
export const ROUTE_TIMEOUT_MAP = [
  // Fast routes (5s)
  { pattern: /^\/api\/health/, timeout: TIMEOUT_CATEGORIES.FAST, description: 'Health check' },
  { pattern: /^\/api\/strategies\/?$/, timeout: TIMEOUT_CATEGORIES.FAST, description: 'Strategy listing' },
  { pattern: /^\/api\/vault\/?$/, timeout: TIMEOUT_CATEGORIES.FAST, description: 'Vault info' },
  
  // Moderate routes (10s)
  { pattern: /^\/api\/vault\/analytics/, timeout: TIMEOUT_CATEGORIES.MODERATE, description: 'Vault analytics' },
  { pattern: /^\/api\/investment-pools\/?$/, timeout: TIMEOUT_CATEGORIES.MODERATE, description: 'Pool listing' },
  { pattern: /^\/api\/morio\/data-hub/, timeout: TIMEOUT_CATEGORIES.MODERATE, description: 'Data hub queries' },
  { pattern: /^\/api\/prices/, timeout: TIMEOUT_CATEGORIES.MODERATE, description: 'Price fetching' },
  
  // Heavy compute routes (30-60s - auto-queue after 5s if not complete)
  { pattern: /^\/api\/strategies\/[^/]+\/backtest/, timeout: TIMEOUT_CATEGORIES.VERY_HEAVY, description: 'Strategy backtest', queueType: 'strategy-backtest' },
  { pattern: /^\/api\/strategies\/[^/]+\/optimize/, timeout: TIMEOUT_CATEGORIES.VERY_HEAVY, description: 'Strategy optimize', queueType: 'strategy-optimize' },
  { pattern: /^\/api\/investment-pools\/[^/]+\/trigger-rebalance/, timeout: TIMEOUT_CATEGORIES.HEAVY, description: 'Pool rebalance', queueType: 'pool-rebalance' },
  { pattern: /^\/api\/rebalancing\/trigger/, timeout: TIMEOUT_CATEGORIES.HEAVY, description: 'Rebalancing trigger', queueType: 'pool-rebalance' },
  { pattern: /^\/api\/symbol-universe\/discovery/, timeout: TIMEOUT_CATEGORIES.MODERATE, description: 'Symbol discovery' },
  { pattern: /^\/api\/morio.*analyze/, timeout: TIMEOUT_CATEGORIES.HEAVY, description: 'Morio analysis', queueType: 'morio-analyze' },
  { pattern: /^\/api\/morio.*chat/, timeout: TIMEOUT_CATEGORIES.MODERATE, description: 'Morio chat' },
  { pattern: /^\/api\/vault.*rebalance/, timeout: TIMEOUT_CATEGORIES.HEAVY, description: 'Vault rebalance', queueType: 'vault-rebalance' },
];

// Request context for tracking timeout state
declare global {
  namespace Express {
    interface Request {
      shouldQueue?: boolean; // Flag set by middleware if operation was queued
      jobId?: string; // ID of the queued job
      timeoutConfig?: { timeoutMs: number; queueType?: string };
      abortController?: AbortController; // For cancelling in-progress operations
    }
  }
}

/**
 * Get timeout configuration for a route
 */
function getTimeoutForRoute(path: string): { timeoutMs: number; queueType?: string; description?: string } {
  for (const route of ROUTE_TIMEOUT_MAP) {
    const pattern = typeof route.pattern === 'string' ? new RegExp(`^${route.pattern}`) : route.pattern;
    if (pattern.test(path)) {
      return {
        timeoutMs: route.timeout,
        queueType: route.queueType,
        description: route.description,
      };
    }
  }
  // Default: use moderate timeout
  return { timeoutMs: TIMEOUT_CATEGORIES.MODERATE, description: 'Default moderate timeout' };
}

/**
 * Timeout Middleware Factory
 * Creates middleware that wraps route handlers with timeout + auto-queue logic
 */
export function createTimeoutMiddleware(config: Partial<TimeoutConfig> = {}) {
  const defaultTimeoutMs = config.defaultTimeoutMs || TIMEOUT_CATEGORIES.MODERATE;
  const heavyComputeTimeoutMs = config.heavyComputeTimeoutMs || TIMEOUT_CATEGORIES.HEAVY;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip timeout for certain paths
    if (req.path === '/health' || req.path.startsWith('/api/health')) {
      return next();
    }

    // Get timeout for this route
    const timeoutConfig = getTimeoutForRoute(req.path);
    const timeoutMs = timeoutConfig.timeoutMs;

    // Attach configuration to request for handlers to use
    req.timeoutConfig = timeoutConfig;
    req.abortController = new AbortController();

    // For GET requests or non-heavy-compute operations, just proceed
    if (req.method === 'GET' || !timeoutConfig.queueType) {
      return next();
    }

    /**
     * For POST/PUT/DELETE heavy compute routes:
     * Set a timer. If the request doesn't complete in time, auto-queue it.
     */
    let timeoutHandle: NodeJS.Timeout | null = null;
    let originalSend = res.send;
    let hasResponded = false;

    // Track if response was already sent
    const originalJson = res.json;
    res.json = function (data: any) {
      hasResponded = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      return originalJson.call(this, data);
    };

    res.send = function (data: any) {
      hasResponded = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      return originalSend.call(this, data);
    };

    // Set up auto-queue timeout timer
    timeoutHandle = setTimeout(async () => {
      // Only queue if handler hasn't responded yet
      if (hasResponded) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        return;
      }

      try {
        logger.warn(`[TimeoutMiddleware] Route ${req.method} ${req.path} exceeded timeout of ${timeoutMs}ms. Auto-queuing...`);

        // Abort any in-progress operations
        if (req.abortController) {
          req.abortController.abort();
        }

        // Auto-queue the job
        // Lazy import to avoid circular dependencies
        const { jobQueueService } = await import('../services/jobQueueService');
        const jobType = timeoutConfig.queueType || 'default-job';
        const payload = {
          path: req.path,
          method: req.method,
          params: req.params,
          query: req.query,
          body: req.body,
          userId: (req as any).user?.id,
          timestamp: new Date(),
        };

        const jobId = await jobQueueService.queueJob(jobType as any, payload, {
          priority: 5,
          timeout: timeoutMs * 2, // Allow 2x the request timeout for actual job execution
        });

        req.shouldQueue = true;
        req.jobId = jobId;

        logger.info(`[TimeoutMiddleware] Job queued: ${jobId} (type: ${jobType})`);

        // Send queued response
        if (!hasResponded) {
          hasResponded = true;
          res.status(202).json({
            success: true,
            status: 'queued',
            jobId,
            statusUrl: `/api/jobs/${jobId}`,
            message: `Long-running operation queued. Check status at /api/jobs/${jobId}`,
            estimatedDuration: `${(timeoutMs / 1000).toFixed(1)}s+`,
          });
        }
      } catch (error) {
        logger.error(`[TimeoutMiddleware] Failed to queue job:`, error);

        if (!hasResponded) {
          hasResponded = true;
          res.status(503).json({
            success: false,
            error: 'Service temporarily unavailable',
            message: 'Job queue service is not responding. Please try again later.',
            code: 'JOB_QUEUE_UNAVAILABLE',
          });
        }
      }
    }, TIMEOUT_CATEGORIES.FAST); // Auto-queue after 5 seconds for heavy operations

    // Attach cleanup to response
    res.on('finish', () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    });

    next();
  };
}

/**
 * Route-specific timeout wrapper
 * Use this to wrap specific route handlers that need timeout + queue logic
 */
export function withTimeout<T extends (...args: any[]) => any>(
  handler: T,
  options?: { timeoutMs?: number; queueType?: string }
): T {
  return (async (req: Request, res: Response, next: NextFunction) => {
    const timeoutMs = options?.timeoutMs || TIMEOUT_CATEGORIES.MODERATE;
    const queueType = options?.queueType;

    // Create abort controller for this handler
    const abortController = new AbortController();
    req.abortController = abortController;
    req.timeoutConfig = { timeoutMs, queueType };

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      abortController.abort();
      if (!res.headersSent) {
        req.shouldQueue = true;
        logger.warn(`[withTimeout] Handler exceeded ${timeoutMs}ms timeout`);
      }
    }, timeoutMs);

    try {
      // Call the original handler
      await handler(req, res, next);
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
        if (!res.headersSent) {
          res.status(408).json({
            success: false,
            error: 'Request timeout',
            message: `Operation exceeded ${timeoutMs}ms timeout`,
          });
        }
      } else {
        next(error);
      }
    } finally {
      clearTimeout(timeoutHandle);
    }
  }) as T;
}

export default createTimeoutMiddleware;
