import type { Request, Response, NextFunction } from 'express';
import { redis } from '../services/redis';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
  failClosed?: boolean;
}

function sanitizeRateLimitKey(value: unknown, fallback = 'unknown'): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    return fallback;
  }

  return normalized.replace(/\s+/g, '_');
}

function resolveClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return sanitizeRateLimitKey(forwardedFor.split(',')[0].trim(), 'unknown-ip');
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const first = forwardedFor[0]?.split(',')[0]?.trim();
    if (first) {
      return sanitizeRateLimitKey(first, 'unknown-ip');
    }
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim().length > 0) {
    return sanitizeRateLimitKey(realIp.trim(), 'unknown-ip');
  }

  const sourceIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown-ip';
  return sanitizeRateLimitKey(sourceIp, 'unknown-ip').replace(/^::ffff:/, '');
}

function getRetryAfterSeconds(windowMs: number): number {
  const elapsed = Date.now() % windowMs;
  const remainingMs = Math.max(1, windowMs - elapsed);
  return Math.ceil(remainingMs / 1000);
}

export function rateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    failClosed = true,
    keyGenerator = (req: Request) => {
      return `ip:${resolveClientIp(req)}`;
    },
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `rate_limit:${keyGenerator(req)}`;
      const windowSeconds = Math.max(1, Math.floor(windowMs / 1000));

      const count = await redis.incrWithExpiry(key, windowSeconds);

      res.setHeader('X-RateLimit-Limit', max.toString());

      if (count > max) {
        const remaining = Math.max(0, max - count);
        const retryAfter = getRetryAfterSeconds(windowMs);
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('Retry-After', retryAfter.toString());

        return res.status(429).json({
          success: false,
          error: message,
          retryAfter,
        });
      }

      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count).toString());
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      if (failClosed) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable. Please try again later.',
        });
      }

      return next();
    }
  };
}

// Specific rate limiters for different endpoints
export const registerRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registration attempts per 15 minutes per IP
  message: 'Too many registration attempts. Please try again in 15 minutes.',
  failClosed: false,
  keyGenerator: (req) => `register:${resolveClientIp(req)}`,
});

export const otpResendRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 OTP resend attempts per 5 minutes
  message: 'Too many OTP resend requests. Please wait 5 minutes.',
  failClosed: true,
  keyGenerator: (req) => {
    const identifier = (req as any).body?.email || (req as any).body?.phone || 'unknown-identifier';
    return `otp_resend:${sanitizeRateLimitKey(identifier, 'unknown-identifier')}`;
  },
});

export const otpVerifyRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 verification attempts per 15 minutes
  message: 'Too many verification attempts. Please request a new OTP.',
  failClosed: true,
  keyGenerator: (req) => {
    const identifier = (req as any).body?.email || (req as any).body?.phone || 'unknown-identifier';
    return `otp_verify:${sanitizeRateLimitKey(identifier, 'unknown-identifier')}`;
  },
});

export const loginRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes per IP
  message: 'Too many login attempts. Please try again in 15 minutes.',
  failClosed: true,
  keyGenerator: (req) => `login:${resolveClientIp(req)}`,
});

export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many API requests. Please slow down.',
  failClosed: false,
  keyGenerator: (req) => `api:${resolveClientIp(req)}`,
});

// Heavy compute endpoints - Analyzer
// 🔴 CRITICAL: Reduced from 5/min to 1/min to prevent LLM token exhaustion ($0.10-0.30 per call)
export const analyzerLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 1, // 1 analysis request per minute per user (prevent token exhaustion and cost abuse)
  message: 'Too many analysis requests. Complex AI analysis is rate-limited. Please try again in 1 minute.',
  failClosed: true,
  keyGenerator: (req) => {
    // Rate limit per user, not IP (authenticated endpoint)
    const userId = (req as any).user?.id || (req as any).user?.userId || 'unknown-user';
    return `analyzer:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// Analytics and reporting endpoints
export const analyticLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 analytics queries per minute
  message: 'Too many analytics requests. Please slow down.',
  failClosed: false,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || (req as any).user?.userId || resolveClientIp(req);
    return `analytics:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// PDF export (heavy resource consumption)
// 🔴 CRITICAL: Reduced from 2/10min to 1/hour to prevent disk exhaustion DOS
export const pdfLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1, // 1 PDF export per hour per user (prevent disk exhaustion)
  message: 'Too many PDF export requests. PDF generation is resource-intensive. Please try again in 1 hour.',
  failClosed: true,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'unknown-user';
    return `pdf:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// Trading execution endpoints (financial operations)
export const yukiSwapLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 swaps per minute per user
  message: 'Too many swap requests. Please slow down.',
  failClosed: true,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'unknown-user';
    return `yuki_swap:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// Cross-chain bridge operations (critical operations)
export const yukiBridgeLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 bridges per minute
  message: 'Too many bridge requests. Cross-chain operations are rate-limited. Please try again later.',
  failClosed: true,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'unknown-user';
    return `yuki_bridge:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// Flash loan execution (very high risk)
export const yukiFlashLoanLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 flash loans per minute per user
  message: 'Too many flash loan requests. High-risk operations are rate-limited.',
  failClosed: true,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'unknown-user';
    return `yuki_flashloan:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// ════════════════════════════════════════════════════════════════════════════════
// TREASURY MULTISIG RATE LIMITERS
// Critical financial operations requiring stricter rate limiting
// ════════════════════════════════════════════════════════════════════════════════

// Multisig wallet creation (one-time operation, very low rate)
export const treasuryMultisigCreateLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 multisig creation attempts per hour per DAO
  message: 'Too many multisig wallet creation attempts. Multisig creation is rate-limited. Please try again in 1 hour.',
  failClosed: true,
  keyGenerator: (req) => {
    const daoId = (req as any).params?.daoId || (req as any).body?.daoId || 'unknown-dao';
    const userId = (req as any).user?.id || (req as any).user?.userId || 'unknown-user';
    return `treasury_multisig_create:${sanitizeRateLimitKey(daoId, 'unknown-dao')}:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// Multisig withdrawal proposal (moderate rate)
export const treasuryMultisigProposeLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 proposals per hour per user
  message: 'Too many withdrawal proposals. You have reached the proposal limit. Please try again in 1 hour.',
  failClosed: true,
  keyGenerator: (req) => {
    const daoId = (req as any).params?.daoId || (req as any).body?.daoId || 'unknown-dao';
    const userId = (req as any).user?.id || (req as any).user?.userId || 'unknown-user';
    return `treasury_multisig_propose:${sanitizeRateLimitKey(daoId, 'unknown-dao')}:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// Multisig signature submission (higher rate allowed)
export const treasuryMultisigSignLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 signatures per 5 minutes per user
  message: 'Too many signature submissions. Please slow down.',
  failClosed: true,
  keyGenerator: (req) => {
    const daoId = (req as any).params?.daoId || (req as any).body?.daoId || 'unknown-dao';
    const userId = (req as any).user?.id || (req as any).user?.userId || 'unknown-user';
    return `treasury_multisig_sign:${sanitizeRateLimitKey(daoId, 'unknown-dao')}:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// Multisig execution (critical operation, very limited)
export const treasuryMultisigExecuteLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 executions per hour per DAO
  message: 'Too many execution attempts. Multisig executions are rate-limited. Please try again in 1 hour.',
  failClosed: true,
  keyGenerator: (req) => {
    const daoId = (req as any).params?.daoId || (req as any).body?.daoId || 'unknown-dao';
    return `treasury_multisig_execute:${sanitizeRateLimitKey(daoId, 'unknown-dao')}`;
  },
});

// Multisig configuration reads (high rate allowed)
export const treasuryMultisigReadLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 reads per minute
  message: 'Too many read requests. Please slow down.',
  failClosed: false,
  keyGenerator: (req) => {
    const daoId = (req as any).params?.daoId || 'unknown-dao';
    const userId = (req as any).user?.id || (req as any).user?.userId || resolveClientIp(req);
    return `treasury_multisig_read:${sanitizeRateLimitKey(daoId, 'unknown-dao')}:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// Strategy backtesting (heavy ML compute)
export const yukiBacktestLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 backtest jobs per minute (prevent ML model training abuse)
  message: 'Too many backtest requests. Model training is computationally expensive. Please try again in 1 minute.',
  failClosed: true,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'unknown-user';
    return `yuki_backtest:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

// Agent operations
export const agentLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 agent operations per minute
  message: 'Too many agent requests. Please slow down.',
  failClosed: false,
  keyGenerator: (req) => {
    const userId = (req as any).user?.id || (req as any).user?.userId || resolveClientIp(req);
    return `agent:${sanitizeRateLimitKey(userId, 'unknown-user')}`;
  },
});

