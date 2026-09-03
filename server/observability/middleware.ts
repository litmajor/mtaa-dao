import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { CorrelationContext } from './CorrelationContext';

// Regex to validate alphanumeric correlation IDs (UUIDs or trace IDs)
const VALID_CORRELATION_ID_REGEX = /^[a-zA-Z0-9\-_]{8,64}$/;

function sanitizeCorrelationId(rawHeaderValue: string | string[] | undefined): string {
  const headerValue = Array.isArray(rawHeaderValue) ? rawHeaderValue[0] : rawHeaderValue;
  
  if (headerValue && VALID_CORRELATION_ID_REGEX.test(headerValue)) {
    return headerValue;
  }
  
  return randomUUID();
}

/**
 * Correlation ID middleware with response header propagation
 * and dynamic actor resolution support.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Extract and sanitize incoming correlation / request ID
  const rawHeader = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  const correlationId = sanitizeCorrelationId(rawHeader as string);

  // 2. Attach correlation ID to response headers for client tracking
  res.setHeader('X-Correlation-ID', correlationId);

  // 3. Define getter for dynamic actor resolution (evaluates when logs are written)
  const getActor = (): string => {
    const user = (req as any).user;
    if (user?.id) return `user_${user.id}`;
    if (user?.userId) return `user_${user.userId}`;
    return 'anonymous';
  };

  // 4. Initialize AsyncLocalStorage context
  CorrelationContext.run(
    {
      correlationId,
      get actor() {
        return getActor();
      },
    },
    () => {
      next();
    }
  );
}