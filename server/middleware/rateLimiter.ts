import { Request, Response, NextFunction } from 'express';
import { redis } from '../services/redis';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export function rateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    keyGenerator = (req: Request) => {
      // Default: Use IP address
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `rate_limit:${keyGenerator(req)}`;
      const current = await redis.get(key);
      
      if (current === null) {
        // First request in window
        await redis.set(key, '1', Math.floor(windowMs / 1000));
        res.setHeader('X-RateLimit-Limit', max.toString());
        res.setHeader('X-RateLimit-Remaining', (max - 1).toString());
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
        return next();
      }

      const count = parseInt(current);
      
      if (count >= max) {
        res.setHeader('X-RateLimit-Limit', max.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('Retry-After', Math.floor(windowMs / 1000).toString());
        
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter: Math.floor(windowMs / 1000),
        });
      }

      await redis.incr(key);
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', (max - count - 1).toString());
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow the request (fail open)
      next();
    }
  };
}

// Specific rate limiters for different endpoints
export const registerRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registration attempts per 15 minutes per IP
  message: 'Too many registration attempts. Please try again in 15 minutes.',
  keyGenerator: (req) => `register:${req.ip}`,
});

export const otpResendRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 OTP resend attempts per 5 minutes
  message: 'Too many OTP resend requests. Please wait 5 minutes.',
  keyGenerator: (req) => {
    const identifier = req.body.email || req.body.phone;
    return `otp_resend:${identifier}`;
  },
});

export const otpVerifyRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 verification attempts per 15 minutes
  message: 'Too many verification attempts. Please request a new OTP.',
  keyGenerator: (req) => {
    const identifier = req.body.email || req.body.phone;
    return `otp_verify:${identifier}`;
  },
});

export const loginRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes per IP
  message: 'Too many login attempts. Please try again in 15 minutes.',
  keyGenerator: (req) => `login:${req.ip}`,
});

export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many API requests. Please slow down.',
});

// Heavy compute endpoints - Analyzer
// 🔴 CRITICAL: Reduced from 5/min to 1/min to prevent LLM token exhaustion ($0.10-0.30 per call)
export const analyzerLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 1, // 1 analysis request per minute per user (prevent token exhaustion and cost abuse)
  message: 'Too many analysis requests. Complex AI analysis is rate-limited. Please try again in 1 minute.',
  keyGenerator: (req) => {
    // Rate limit per user, not IP (authenticated endpoint)
    return `analyzer:${(req as any).user?.id || req.ip}`;
  },
});

// Analytics and reporting endpoints
export const analyticLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 analytics queries per minute
  message: 'Too many analytics requests. Please slow down.',
  keyGenerator: (req) => `analytics:${(req as any).user?.id || req.ip}`,
});

// PDF export (heavy resource consumption)
// 🔴 CRITICAL: Reduced from 2/10min to 1/hour to prevent disk exhaustion DOS
export const pdfLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1, // 1 PDF export per hour per user (prevent disk exhaustion)
  message: 'Too many PDF export requests. PDF generation is resource-intensive. Please try again in 1 hour.',
  keyGenerator: (req) => `pdf:${(req as any).user?.id || req.ip}`,
});

// Trading execution endpoints (financial operations)
export const yukiSwapLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 swaps per minute per user
  message: 'Too many swap requests. Please slow down.',
  keyGenerator: (req) => `yuki_swap:${(req as any).user?.id || req.ip}`,
});

// Cross-chain bridge operations (critical operations)
export const yukiBridgeLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 bridges per minute
  message: 'Too many bridge requests. Cross-chain operations are rate-limited. Please try again later.',
  keyGenerator: (req) => `yuki_bridge:${(req as any).user?.id || req.ip}`,
});

// Flash loan execution (very high risk)
export const yukiFlashLoanLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 flash loans per minute per user
  message: 'Too many flash loan requests. High-risk operations are rate-limited.',
  keyGenerator: (req) => `yuki_flashloan:${(req as any).user?.id || req.ip}`,
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
  keyGenerator: (req) => {
    const daoId = (req as any).params?.daoId || (req as any).body?.daoId;
    return `treasury_multisig_create:${daoId}:${(req as any).user?.id}`;
  },
});

// Multisig withdrawal proposal (moderate rate)
export const treasuryMultisigProposeLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 proposals per hour per user
  message: 'Too many withdrawal proposals. You have reached the proposal limit. Please try again in 1 hour.',
  keyGenerator: (req) => {
    const daoId = (req as any).params?.daoId || (req as any).body?.daoId;
    return `treasury_multisig_propose:${daoId}:${(req as any).user?.id}`;
  },
});

// Multisig signature submission (higher rate allowed)
export const treasuryMultisigSignLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 signatures per 5 minutes per user
  message: 'Too many signature submissions. Please slow down.',
  keyGenerator: (req) => {
    const daoId = (req as any).params?.daoId || (req as any).body?.daoId;
    return `treasury_multisig_sign:${daoId}:${(req as any).user?.id}`;
  },
});

// Multisig execution (critical operation, very limited)
export const treasuryMultisigExecuteLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 executions per hour per DAO
  message: 'Too many execution attempts. Multisig executions are rate-limited. Please try again in 1 hour.',
  keyGenerator: (req) => {
    const daoId = (req as any).params?.daoId || (req as any).body?.daoId;
    return `treasury_multisig_execute:${daoId}`;
  },
});

// Multisig configuration reads (high rate allowed)
export const treasuryMultisigReadLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 reads per minute
  message: 'Too many read requests. Please slow down.',
  keyGenerator: (req) => {
    const daoId = (req as any).params?.daoId;
    return `treasury_multisig_read:${daoId}:${(req as any).user?.id || req.ip}`;
  },
});

// Strategy backtesting (heavy ML compute)
export const yukiBacktestLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 backtest jobs per minute (prevent ML model training abuse)
  message: 'Too many backtest requests. Model training is computationally expensive. Please try again in 1 minute.',
  keyGenerator: (req) => `yuki_backtest:${(req as any).user?.id || req.ip}`,
});

// Agent operations
export const agentLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 agent operations per minute
  message: 'Too many agent requests. Please slow down.',
  keyGenerator: (req) => `agent:${(req as any).user?.id || req.ip}`,
});

