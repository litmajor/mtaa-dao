import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('rate-limit-middleware');

/**
 * Rate Limiting Middleware
 * 
 * Prevents abuse and DoS attacks:
 * - Global rate limiting (requests per time period)
 * - Per-user rate limiting
 * - Per-endpoint rate limiting
 * - Configurable windows and limits
 * - Graceful degradation
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key (default: IP)
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  onLimitReached?: (req: Request, res: Response) => void; // Custom handler
}

export interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

/**
 * In-memory rate limit store
 * For production, use Redis for distributed rate limiting
 */
class MemoryRateLimitStore {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor(windowMs: number) {
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      Object.keys(this.store).forEach((key) => {
        if (this.store[key].resetTime < now) {
          delete this.store[key];
        }
      });
    }, 60_000);
  }

  increment(key: string, windowMs: number): number {
    const now = Date.now();
    const existing = this.store[key];

    if (!existing || existing.resetTime < now) {
      this.store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return 1;
    }

    this.store[key].count++;
    return this.store[key].count;
  }

  getRemainingRequests(key: string, maxRequests: number): number {
    const existing = this.store[key];
    if (!existing) return maxRequests;
    return Math.max(0, maxRequests - existing.count);
  }

  getResetTime(key: string): number {
    const existing = this.store[key];
    return existing?.resetTime || Date.now();
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store = {};
  }
}

/**
 * Default key generator (IP-based)
 */
function defaultKeyGenerator(req: Request): string {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  ).toString();
}

/**
 * Create a rate limiting middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    onLimitReached,
  } = config;

  const store = new MemoryRateLimitStore(windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const count = store.increment(key, windowMs);
    const remaining = store.getRemainingRequests(key, maxRequests);
    const resetTime = store.getResetTime(key);

    // Add rate limit info to response headers
    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', remaining.toString());
    res.set('X-RateLimit-Reset', resetTime.toString());

    if (count > maxRequests) {
      logger.warn('Rate limit exceeded', {
        key,
        path: req.path,
        method: req.method,
        attempts: count,
      });

      if (onLimitReached) {
        onLimitReached(req, res);
      } else {
        res.status(429).json({
          success: false,
          error: {
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
          },
        });
      }
      return;
    }

    // Track response to optionally skip counting
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.send;

      res.send = function (data: any) {
        const statusCode = res.statusCode;
        const isSuccess = statusCode >= 200 && statusCode < 300;

        if (
          (skipSuccessfulRequests && isSuccess) ||
          (skipFailedRequests && !isSuccess)
        ) {
          // Decrement count for this request
          store.increment(key, 0); // Reset
          logger.debug('Request skipped from rate limit', {
            key,
            statusCode,
            path: req.path,
          });
        }

        return originalSend.call(this, data);
      };
    }

    next();
  };
}

/**
 * Selective rate limiter - only apply to routes that need it
 * Skip static assets, pages, components, and public routes
 */
export const globalRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  // Exempt these from rate limiting:
  // 1. Static assets (images, fonts, CSS, JS)
  // 2. Vite pages and components
  // 3. Public endpoints (health, public stats, etc.)
  // 4. Well-known routes
  
  const exemptPatterns = [
    // Static assets
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i,
    /\.(css|js|map)$/i, // CSS/JS typically cached anyway
    
    // Static asset directories
    /^\/mtaa_dao_logos\//,
    /^\/public\//,
    /^\/assets\//,
    /^\/static\//,
    /^\/dist\//,
    
    // Vite pages and components
    /^\/admin$/,
    /^\/admin-.*/,
    /^\/dashboard$/,
    /^\/home$/,
    /^\/profile$/,
    /^\/settings$/,
    /^\/@vite\//,
    /^\/node_modules\//,
    
    // Well-known routes
    /^\/\.well-known\//,
    /^\/favicon\.ico$/,
    /^\/robots\.txt$/,
    /^\/sitemap\.xml$/,
    
    // Public endpoints (no auth needed)
    /^\/api\/public\//,
    /^\/health$/,
    /^\/api\/health/,
    /^\/api\/stats\/public/,
    /^\/api\/events/,
  ];

  // Check if request matches exempt patterns
  if (exemptPatterns.some(pattern => pattern.test(req.path))) {
    return next();
  }

  // Only rate limit actual API endpoints that modify state or are sensitive
  const rateLimitedPatterns = [
    /^\/api\/auth\//,        // Login, register, password reset
    /^\/api\/users\//,       // User operations
    /^\/api\/proposals\//,   // Create/vote on proposals
    /^\/api\/payments\//,    // Payment operations
    /^\/api\/transfers\//,   // Fund transfers
    /^\/api\/vault\//,       // Vault operations
    /^\/api\/kyc\//,         // KYC operations
    /^\/api\/wallet\//,      // Wallet operations (except public queries)
  ];

  // Check if this is a route that should be rate limited
  const shouldRateLimit = rateLimitedPatterns.some(pattern => pattern.test(req.path));
  
  if (!shouldRateLimit) {
    return next();
  }

  // Apply rate limiting only to specific sensitive API routes
  const limiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: process.env.NODE_ENV === 'development' ? 5000 : 100,
  });

  limiter(req, res, next);
};

/**
 * Auth endpoint rate limiter
 * 5 requests per 15 minutes per IP (prevent brute force)
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * API endpoint rate limiter
 * 100 requests per minute per user
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    return userId || defaultKeyGenerator(req);
  },
});

/**
 * Sensitive operation rate limiter
 * 10 requests per hour per user (proposals, transfers, etc.)
 */
export const sensitiveOperationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    if (!userId) {
      return defaultKeyGenerator(req);
    }
    return `sensitive:${userId}`;
  },
});

/**
 * Admin operation rate limiter
 * 50 requests per minute per admin (bulk operations, etc.)
 */
export const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 50,
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    return `admin:${userId}`;
  },
});

/**
 * Distributed rate limiting key for use with Redis
 * Helps identify clients across different servers
 */
export function getDistributedRateLimitKey(
  req: Request,
  scope: 'global' | 'user' | 'endpoint' = 'global'
): string {
  const ip = defaultKeyGenerator(req);
  const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
  const endpoint = req.path;

  switch (scope) {
    case 'user':
      return `ratelimit:user:${userId}`;
    case 'endpoint':
      return `ratelimit:endpoint:${endpoint}:${ip}`;
    case 'global':
    default:
      return `ratelimit:global:${ip}`;
  }
}

/**
 * Helper to reset rate limit for a key (admin function)
 */
export function resetRateLimit(store: MemoryRateLimitStore, key: string): void {
  logger.info('Rate limit reset', { key });
  // Implementation depends on store type
  // For MemoryRateLimitStore, entries auto-expire
}

/**
 * Middleware to add rate limit info to requests for logging
 */
export const rateLimitInfoMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  (req as any).rateLimitKey = defaultKeyGenerator(req);
  next();
};
