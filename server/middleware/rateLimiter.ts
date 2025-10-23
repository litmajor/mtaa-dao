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

      await redis.increment(key);
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

