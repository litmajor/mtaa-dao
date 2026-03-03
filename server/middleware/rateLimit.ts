import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// tiny helper to parse simple duration strings like "1min", "5min", "10min", "30s", "2h"
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(ms|s|min|h)$/);
  if (!match) {
    // fallback to milliseconds number
    const n = parseInt(window, 10);
    return isNaN(n) ? 0 : n;
  }
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'min':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      return value;
  }
}

/**
 * Rate limiter that enforces a per-user (or per-IP) limit for a named operation.
 *
 * Example: `rateLimitPerUser('treasury-withdraw', 2, '10min')`.
 * The supplied key is combined with the user's ID (or IP) so each user has
 * their own counter per operation.
 */
export function rateLimitPerUser(
  operation: string,
  maxRequests: number,
  window: string
) {
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
