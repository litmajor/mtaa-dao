import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { CorrelationContext } from './CorrelationContext';

export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Check incoming correlation header
  const headerCorrelationId = req.headers['x-correlation-id'];
  
  // 2. Generate UUID if missing
  const correlationId = (Array.isArray(headerCorrelationId) 
    ? headerCorrelationId[0] 
    : headerCorrelationId) || randomUUID();
  
  // Try to determine actor if authenticated, fallback to anonymous
  const actor = (req as any).user ? `user_${(req as any).user.id}` : 'anonymous';

  // 3 & 4. Create context and execute request
  CorrelationContext.run({ correlationId, actor }, () => {
    next();
  });
}
