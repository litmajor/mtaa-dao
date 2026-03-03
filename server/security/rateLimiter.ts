
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Different rate limits for different endpoints
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit for development
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 1000, // Much higher limit for development
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60
  },
  skipSuccessfulRequests: true,
});

export const paymentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 payment attempts per hour
  message: {
    error: 'Too many payment attempts, please try again later.',
    retryAfter: 60 * 60
  },
});

export const proposalRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 proposals per hour
  message: {
    error: 'Too many proposal submissions, please try again later.',
    retryAfter: 60 * 60
  },
});

export const vaultRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 3 vault operations per 5 minutes
  message: {
    error: 'Too many vault operations, please try again later.',
    retryAfter: 5 * 60
  },
});

// Custom rate limiter for specific user actions
export const createUserRateLimit = (maxRequests: number, windowMs: number) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req: Request) => {
      const user = req.user as any;
      return user?.claims?.sub || req.ip;
    },
    message: {
      error: 'Rate limit exceeded for this user',
      retryAfter: Math.ceil(windowMs / 1000)
    }
  });
};
// ---------- convenience wrapper matching existing middleware API -----------
// operation key + human readable window string
export function rateLimitPerUser(
  operation: string,
  maxRequests: number,
  window: string
) {
  // convert "1min"/"5min"/"30s" to ms
  const parseWindow = (w: string) => {
    const m = w.match(/^(\d+)(ms|s|min|h)$/);
    if (!m) return parseInt(w, 10) || 0;
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 'ms':
        return n;
      case 's':
        return n * 1000;
      case 'min':
        return n * 60 * 1000;
      case 'h':
        return n * 60 * 60 * 1000;
      default:
        return n;
    }
  };

  const windowMs = parseWindow(window);
  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req: Request) => {
      const user = (req as any).user;
      const id = user?.id || req.ip || 'anonymous';
      return `${operation}:${id}`;
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        operation,
      });
    },
  });
}