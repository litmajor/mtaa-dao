/**
 * PHASE 1: SAFETY - Rate Limiter Configuration
 * 
 * Applies rate limiting to sensitive endpoints to prevent abuse:
 * - Withdrawals: Limited per user per hour
 * - Proposal creation: Limited per user per day
 * - Order execution: Limited per user per minute
 * - Risk operations: Limited globally
 */

import type { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import { redis } from '../services/redis';

const logger = new Logger('rate-limit-config');

export interface RateLimitConfig {
  limit: number;           // Max operations
  windowSeconds: number;   // Time window
  key?: string;           // Custom window key
  failClosed?: boolean;   // Default true for sensitive financial routes
}

function normalizeRateLimitKey(key: string): string {
  return key.replace(/^rl:/, '').trim();
}

export function getClientIdentifier(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim().length > 0) {
    return realIp.trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown-client';
}

function getRetryAfterSeconds(windowSeconds: number): number {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const remainingMs = windowStart + windowMs - now;
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

/**
 * Redis-based rate limiter using atomic counter increments and explicit TTL creation.
 */
async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  failClosed = true
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  try {
    const normalizedKey = normalizeRateLimitKey(key);
    const bucketKey = `rl:${normalizedKey}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await redis.incrWithExpiry(bucketKey, windowSeconds);
    const allowed = count <= limit;

    return {
      allowed,
      remaining: allowed ? Math.max(0, limit - count) : 0,
      retryAfter: allowed ? 0 : getRetryAfterSeconds(windowSeconds),
    };
  } catch (error) {
    logger.error('[RATE LIMIT CHECK ERROR]', error);
    if (failClosed) {
      return { allowed: false, remaining: 0, retryAfter: Math.max(1, windowSeconds) };
    }
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfter: 0 };
  }
}

/**
 * Rate limit middleware factory
 * 
 * Usage:
 * ```typescript
 * router.post('/withdraw', rateLimitMiddleware(withdrawLimits), withdrawHandler);
 * ```
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  const failClosed = config.failClosed ?? true;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || getClientIdentifier(req);
      const windowKey = config.key || `${req.method}:${req.path}:${userId}`;

      const { allowed, remaining, retryAfter } = await checkRateLimit(
        windowKey,
        config.limit,
        config.windowSeconds,
        failClosed
      );

      res.setHeader('X-RateLimit-Limit', config.limit.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      if (!allowed) {
        res.setHeader('Retry-After', retryAfter.toString());
        logger.warn(
          `[RATE LIMIT] User ${userId} exceeded limit for ${req.method} ${req.path}`,
          { windowKey, configured: config.limit, retryAfter }
        );
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter,
          message: `Please try again in ${retryAfter} seconds`
        });
      }

      next();
    } catch (error) {
      logger.error('[RATE LIMIT ERROR]', error);
      if (failClosed) {
        return res.status(503).json({
          success: false,
          error: 'Rate limit service unavailable. Please try again later.',
          code: 'RATE_LIMIT_UNAVAILABLE',
        });
      }
      next();
    }
  };
}

/**
 * Rate Limit Configurations for sensitive endpoints
 */

// Withdrawals: 10 per hour per user
export const withdrawalLimits: RateLimitConfig = {
  limit: 10,
  windowSeconds: 3600, // 1 hour
};

// 🔴 CRITICAL: Deposits: 20 per hour per user (prevent deposit spam)
export const depositLimits: RateLimitConfig = {
  limit: 20,
  windowSeconds: 3600, // 1 hour
};

// High-value withdrawals (>10k USD): 3 per day per user
export const largeWithdrawalLimits: RateLimitConfig = {
  limit: 3,
  windowSeconds: 86400, // 24 hours
};

// Proposal creation: 20 per day per user
export const proposalCreationLimits: RateLimitConfig = {
  limit: 20,
  windowSeconds: 86400, // 24 hours
};

// Proposal voting: 100 per day per user
export const proposalVotingLimits: RateLimitConfig = {
  limit: 100,
  windowSeconds: 86400, // 24 hours
};

// Order execution: 100 per minute per user
export const orderExecutionLimits: RateLimitConfig = {
  limit: 100,
  windowSeconds: 60, // 1 minute
};

// API key creation: 5 per day per user
export const apiKeyCreationLimits: RateLimitConfig = {
  limit: 5,
  windowSeconds: 86400, // 24 hours
};

// Strategy rebalance: 10 per day per vault
export const strategyRebalanceLimits: RateLimitConfig = {
  limit: 10,
  windowSeconds: 86400, // 24 hours
};

// Risk assessment recalc: 50 per hour globally
export const riskAssessmentLimits: RateLimitConfig = {
  limit: 50,
  windowSeconds: 3600, // 1 hour
  key: 'risk_assessment_global'
};

// Market data refresh: 1000 per minute globally
export const marketDataLimits: RateLimitConfig = {
  limit: 1000,
  windowSeconds: 60, // 1 minute
  key: 'market_data_global'
};

/**
 * Apply rate limits based on operation type and value
 * 
 * High-value operations get stricter limits
 */
export async function applyAdaptiveRateLimit(
  userId: string,
  operationType: 'withdrawal' | 'transfer' | 'proposal' | 'order',
  operationValue?: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  let config: RateLimitConfig;

  switch (operationType) {
    case 'withdrawal':
      // Large withdrawals (>10k USD) use stricter limit
      config = operationValue && operationValue > 10000
        ? largeWithdrawalLimits
        : withdrawalLimits;
      break;
    case 'proposal':
      config = proposalCreationLimits;
      break;
    case 'order':
      config = orderExecutionLimits;
      break;
    case 'transfer':
      config = withdrawalLimits; // Same as withdrawal
      break;
    default:
      return { allowed: true };
  }

  const windowKey = `${operationType}:${userId}`;
  const result = await checkRateLimit(
    windowKey,
    config.limit,
    config.windowSeconds,
    true
  );

  return {
    allowed: result.allowed,
    retryAfter: result.retryAfter
  };
}

/**
 * Global rate limit counter - for operations that shouldn't have per-user limits
 */
export async function checkGlobalRateLimit(
  operationName: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  return await checkRateLimit(
    `global:${operationName}`,
    limit,
    windowSeconds,
    true
  );
}
