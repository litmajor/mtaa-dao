/**
 * CAPITAL FLOW RATE LIMITING MIDDLEWARE
 * 
 * Applies generous rate limiting to deposits and conservative rate limiting to withdrawals
 * Prevents abuse while encouraging participation
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { capitalFlowRateLimits } from './capitalFlowRateLimits';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

/**
 * Deposit Rate Limiter - GENEROUS
 * 
 * Limits: 50/day, 20/hour, 5/10min
 * Encourages users to deposit frequently
 */
export const depositRateLimiter = rateLimit({
  windowMs: capitalFlowRateLimits.deposits.windowMs,
  max: capitalFlowRateLimits.deposits.requestsPerDay,
  message: capitalFlowRateLimits.errors.deposits.tooManyRequestsDay,
  standardHeaders: true,
  legacyHeaders: false,
  // Key by user ID (not IP) since API calls may come from same server
  // Use ipKeyGenerator for IPv6-safe IP extraction
  keyGenerator: (req: any) => {
    if (req.user?.id) {
      return `deposit:${req.user.id}`;
    }
    // Fall back to IPv6-safe IP extraction
    const ip = ipKeyGenerator(req);
    return `deposit:${ip}`;
  },
  skip: (req: any) => {
    // Don't count failed requests
    return req.method !== 'POST';
  },
  handler: (req: any, res, options: any) => {
    logger.warn(`[RATE LIMIT] Deposit rate limit exceeded for user ${req.user?.id}`);
    res.status(429).json({
      success: false,
      error: options.message || capitalFlowRateLimits.errors.deposits.tooManyRequestsDay,
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

/**
 * Deposit Burst Limiter (Per Hour) - GENEROUS
 * 
 * Prevents short-term spam while allowing many deposits per day
 */
export const depositBurstLimiter = rateLimit({
  windowMs: capitalFlowRateLimits.deposits.windowMsHour,
  max: capitalFlowRateLimits.deposits.requestsPerHour,
  message: capitalFlowRateLimits.errors.deposits.tooManyRequestsHour,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.user?.id) {
      return `deposit-burst:${req.user.id}`;
    }
    const ip = ipKeyGenerator(req);
    return `deposit-burst:${ip}`;
  },
  skip: (req: any) => req.method !== 'POST',
  handler: (req: any, res, options: any) => {
    logger.warn(`[RATE LIMIT] Deposit burst rate limit exceeded for user ${req.user?.id}`);
    res.status(429).json({
      success: false,
      error: options.message || capitalFlowRateLimits.errors.deposits.tooManyRequestsHour,
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

/**
 * Deposit Spam Limiter (Per 10 Minutes) - CONSERVATIVE
 * 
 * Final protection against rapid-fire deposit spam
 */
export const depositSpamLimiter = rateLimit({
  windowMs: capitalFlowRateLimits.deposits.windowMsShort,
  max: capitalFlowRateLimits.deposits.requestsPerTenMinutes,
  message: capitalFlowRateLimits.errors.deposits.tooManyRequestsShort,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.user?.id) {
      return `deposit-spam:${req.user.id}`;
    }
    const ip = ipKeyGenerator(req);
    return `deposit-spam:${ip}`;
  },
  skip: (req: any) => req.method !== 'POST',
  handler: (req: any, res, options: any) => {
    logger.warn(`[RATE LIMIT] Deposit spam rate limit exceeded for user ${req.user?.id}`);
    res.status(429).json({
      success: false,
      error: options.message || capitalFlowRateLimits.errors.deposits.tooManyRequestsShort,
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

/**
 * Withdrawal Rate Limiter - CONSERVATIVE
 * 
 * Limits: 5/day, 3/hour, 1/10min
 * Protects treasury from rapid-fire withdrawals
 */
export const withdrawalRateLimiter = rateLimit({
  windowMs: capitalFlowRateLimits.withdrawals.windowMs,
  max: capitalFlowRateLimits.withdrawals.requestsPerDay,
  message: capitalFlowRateLimits.errors.withdrawals.tooManyRequestsDay,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.user?.id) {
      return `withdrawal:${req.user.id}`;
    }
    const ip = ipKeyGenerator(req);
    return `withdrawal:${ip}`;
  },
  skip: (req: any) => req.method !== 'POST',
  handler: (req: any, res, options: any) => {
    logger.warn(`[RATE LIMIT] Withdrawal rate limit exceeded for user ${req.user?.id}`);
    res.status(429).json({
      success: false,
      error: options.message || capitalFlowRateLimits.errors.withdrawals.tooManyRequestsDay,
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

/**
 * Withdrawal Burst Limiter (Per Hour) - CONSERVATIVE
 * 
 * Prevents hourly burst attacks
 */
export const withdrawalBurstLimiter = rateLimit({
  windowMs: capitalFlowRateLimits.withdrawals.windowMsHour,
  max: capitalFlowRateLimits.withdrawals.requestsPerHour,
  message: capitalFlowRateLimits.errors.withdrawals.tooManyRequestsHour,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.user?.id) {
      return `withdrawal-burst:${req.user.id}`;
    }
    const ip = ipKeyGenerator(req);
    return `withdrawal-burst:${ip}`;
  },
  skip: (req: any) => req.method !== 'POST',
  handler: (req: any, res, options: any) => {
    logger.warn(`[RATE LIMIT] Withdrawal burst rate limit exceeded for user ${req.user?.id}`);
    res.status(429).json({
      success: false,
      error: options.message || capitalFlowRateLimits.errors.withdrawals.tooManyRequestsHour,
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

/**
 * Withdrawal Spam Limiter (Per 10 Minutes) - HARD BLOCK
 * 
 * Absolute protection against rapid withdrawals
 */
export const withdrawalSpamLimiter = rateLimit({
  windowMs: capitalFlowRateLimits.withdrawals.windowMsShort,
  max: capitalFlowRateLimits.withdrawals.requestsPerTenMinutes,
  message: capitalFlowRateLimits.errors.withdrawals.tooManyRequestsShort,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.user?.id) {
      return `withdrawal-spam:${req.user.id}`;
    }
    const ip = ipKeyGenerator(req);
    return `withdrawal-spam:${ip}`;
  },
  skip: (req: any) => req.method !== 'POST',
  handler: (req: any, res, options: any) => {
    logger.error(`[SECURITY] Withdrawal spam attack detected for user ${req.user?.id}`);
    res.status(429).json({
      success: false,
      error: options.message || capitalFlowRateLimits.errors.withdrawals.tooManyRequestsShort,
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

/**
 * Combined Middleware for Deposits
 * Apply all three limiters in sequence
 */
export const depositMiddleware = [
  depositSpamLimiter,     // Strict: 1 every 2 minutes
  depositBurstLimiter,    // Moderate: 20 per hour
  depositRateLimiter      // Lenient: 50 per day
];

/**
 * Combined Middleware for Withdrawals
 * Apply all three limiters in sequence
 */
export const withdrawalMiddleware = [
  withdrawalSpamLimiter,    // HARD: 1 per 10 minutes
  withdrawalBurstLimiter,   // STRICT: 3 per hour
  withdrawalRateLimiter     // MODERATE: 5 per day
];
