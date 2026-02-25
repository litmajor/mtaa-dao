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
import { distributedLockManager } from '../services/concurrencyControl';
import { logger } from '../utils/logger';

export interface RateLimitConfig {
  limit: number;           // Max operations
  windowSeconds: number;   // Time window
  key?: string;           // Custom window key
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
      const windowKey = config.key || `${req.method}:${req.path}:${userId}`;

      const { allowed, remaining, retryAfter } = await distributedLockManager.rateLimiter.checkLimit(
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
  const result = await distributedLockManager.rateLimiter.checkLimit(
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
  return await distributedLockManager.rateLimiter.checkLimit(
    `global:${operationName}`,
    limit,
    windowSeconds
  );
}
