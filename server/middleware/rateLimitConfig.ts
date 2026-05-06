/**
 * PHASE 1: SAFETY - Rate Limiter Configuration
 * 
 * Applies rate limiting to sensitive endpoints to prevent abuse:
 * - Withdrawals: Limited per user per hour
 * - Proposal creation: Limited per user per day
 * - Order execution: Limited per user per minute
 * - Risk operations: Limited globally
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import { redis } from '../services/redis';

const logger = new Logger('rate-limit-config');

export interface RateLimitConfig {
  limit: number;           // Max operations
  windowSeconds: number;   // Time window
  key?: string;           // Custom window key
}

/**
 * Redis-based rate limiter using simple counter pattern
 */
async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  try {
    const fullKey = `rl:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    
    // Get current count
    const countStr = await redis.get(fullKey);
    const count = countStr ? parseInt(countStr) : 0;
    
    if (count < limit) {
      // Increment counter
      await redis.incr(fullKey);
      // Set expiry if this is the first request in this window
      if (count === 0) {
        await redis.expire(fullKey, windowSeconds + 1);
      }
      
      return {
        allowed: true,
        remaining: limit - count - 1,
        retryAfter: 0
      };
    }
    
    // Rate limit exceeded
    const retryAfter = Math.max(1, windowSeconds);
    
    return {
      allowed: false,
      remaining: 0,
      retryAfter
    };
  } catch (error) {
    logger.error('[RATE LIMIT CHECK ERROR]', error);
    // Fail open on error
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
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
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id || req.ip;
      const windowKey = config.key || `rl:${req.method}:${req.path}:${userId}`;

      const { allowed, remaining, retryAfter } = await checkRateLimit(
        windowKey,
        config.limit,
        config.windowSeconds
      );

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      if (!allowed) {
        res.setHeader('Retry-After', retryAfter);
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
      // On error, allow request (fail open)
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

  const windowKey = `rl:${operationType}:${userId}`;
  const result = await checkRateLimit(
    windowKey,
    config.limit,
    config.windowSeconds
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
    `rl:global:${operationName}`,
    limit,
    windowSeconds
  );
}
