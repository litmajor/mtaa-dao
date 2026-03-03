/**
 * Security Middleware Integration Utilities
 * Provides wrappers and helpers for adding security validation to route handlers
 */

import { Request, Response, NextFunction } from 'express';
import { 
  validateDaoId, 
  sanitizeObject, 
  detectSuspiciousInput,
  rateLimitByUserId 
} from './security';
import { Logger } from '../utils/logger';

const logger = new Logger('security-integration');

/**
 * Enhanced request object with security context
 */
export interface SecureRequest extends Request {
  daoId?: string;
  userId?: string;
  securityContext?: {
    isValidated: boolean;
    suspiciousPatterns: string[];
    timestampValidated?: number;
  };
}

/**
 * Wraps a route handler with security validation and monitoring
 * 
 * @example
 * router.post('/transfer', authenticateToken, secureRoute(async (req, res) => {
 *   const { daoId } = req.params;
 *   // Handler code
 * }));
 */
export function secureRoute(handler: (req: SecureRequest, res: Response, next?: NextFunction) => Promise<void>) {
  return async (req: SecureRequest, res: Response, next: NextFunction) => {
    try {
      // Extract daoId from params
      const daoId = req.params.daoId;
      if (daoId) {
        if (!validateDaoId(daoId)) {
          logger.warn(`[SECURITY] Invalid DAO ID format attempted: ${daoId}`);
          return res.status(400).json({
            success: false,
            message: 'Invalid DAO ID format',
            error: 'INVALID_DAO_ID',
          });
        }
        req.daoId = daoId;
      }

      // Extract user ID
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
      if (userId) {
        req.userId = userId;
      }

      // Detect suspicious input patterns
      const suspiciousPatterns: string[] = [];
      
      // Check body for suspicious patterns
      if (req.body && typeof req.body === 'object') {
        for (const [key, value] of Object.entries(req.body)) {
          if (typeof value === 'string') {
            const patterns = detectSuspiciousInput(value);
            if (patterns.length > 0) {
              suspiciousPatterns.push(...patterns.map(p => `body.${key}: ${p}`));
            }
          }
        }
      }

      // Check query params for suspicious patterns
      if (req.query && typeof req.query === 'object') {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            const patterns = detectSuspiciousInput(value);
            if (patterns.length > 0) {
              suspiciousPatterns.push(...patterns.map(p => `query.${key}: ${p}`));
            }
          }
        }
      }

      // Store security context
      req.securityContext = {
        isValidated: true,
        suspiciousPatterns,
        timestampValidated: Date.now(),
      };

      // Log if suspicious patterns detected
      if (suspiciousPatterns.length > 0) {
        logger.warn(`[SECURITY] Suspicious input detected`, {
          userId,
          daoId,
          patterns: suspiciousPatterns,
          path: req.path,
          method: req.method,
        });
      }

      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
      }

      // Call handler
      await handler(req, res, next);
    } catch (error) {
      logger.error('[SECURITY] Route handler error', {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method,
      });
      next(error);
    }
  };
}

/**
 * Rate limiting middleware with enhanced logging
 */
export function secureRateLimit(maxRequests: number = 10, windowMs: number = 60000) {
  const limiter = rateLimitByUserId(maxRequests, windowMs);
  
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
    
    try {
      limiter(req, res, () => {
        logger.debug(`[RATE_LIMIT] Request allowed`, {
          userId,
          path: req.path,
          method: req.method,
        });
        next();
      });
    } catch (error) {
      logger.error('[RATE_LIMIT] Error in rate limiting', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  };
}

/**
 * DAO scope validation - ensures request operates only on requested DAO
 */
export async function validateDAOScope(
  req: SecureRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const daoId = req.params.daoId;
  const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

  if (!daoId || !userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication and DAO context required',
      error: 'MISSING_CONTEXT',
    });
    return;
  }

  if (!validateDaoId(daoId)) {
    res.status(400).json({
      success: false,
      message: 'Invalid DAO ID format',
      error: 'INVALID_DAO_ID',
    });
    return;
  }

  // Store for downstream handlers
  req.daoId = daoId;
  req.userId = userId;

  logger.debug(`[DAO_SCOPE] Validated scope`, {
    userId,
    daoId,
    path: req.path,
  });

  next();
}

/**
 * Audit logging wrapper for sensitive operations
 * 
 * @example
 * router.post('/transfer', authenticateToken, auditLog('treasury_transfer'), async (req, res) => {
 *   // Handler
 * });
 */
export function auditLog(operationType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;

    // Store original send function
    res.send = function(data: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
      const daoId = (req as any).params?.daoId;

      logger.info(`[AUDIT] ${operationType}`, {
        userId,
        daoId,
        statusCode,
        duration: `${duration}ms`,
        method: req.method,
        path: req.path,
        success: statusCode < 400,
      });

      // Call original send
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Monitoring wrapper to track deprecated endpoint usage
 * 
 * @example
 * app.use('/api/governance/:daoId', monitorDeprecation('governance'));
 */
export function monitorDeprecation(endpointName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
    const daoId = req.params.daoId;

    logger.warn(`[DEPRECATED_ENDPOINT] ${endpointName}`, {
      userId,
      daoId,
      method: req.method,
      path: req.path,
      userAgent: req.get('user-agent'),
    });

    // Send deprecation headers
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.setHeader('X-Deprecated-Endpoint', endpointName);

    next();
  };
}

/**
 * Extract client threat level based on request patterns
 */
export function assessThreatLevel(req: Request): 'low' | 'medium' | 'high' {
  const suspiciousPatterns = (req as SecureRequest).securityContext?.suspiciousPatterns || [];
  const contentLength = req.get('content-length');
  const largePayload = contentLength && parseInt(contentLength) > 1024 * 1024; // > 1MB

  // Count risk factors
  let riskScore = 0;

  if (suspiciousPatterns.length > 0) riskScore += suspiciousPatterns.length * 2;
  if (largePayload) riskScore += 1;
  if (req.get('user-agent')?.toLowerCase().includes('bot')) riskScore += 0.5;

  if (riskScore >= 3) return 'high';
  if (riskScore >= 1) return 'medium';
  return 'low';
}

export default {
  secureRoute,
  secureRateLimit,
  validateDAOScope,
  auditLog,
  monitorDeprecation,
  assessThreatLevel,
};
