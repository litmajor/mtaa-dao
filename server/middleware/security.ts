/**
 * Security Middleware and Utilities
 * Validates parameters against SQL injection and XSS attacks
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Validates that a daoId is a valid UUID format
 */
export function validateDaoId(daoId: string): boolean {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // Simple validation: must be 36 chars with correct hyphen positions and valid hex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(daoId);
}

/**
 * Validates that a proposal ID is in correct format
 */
export function validateProposalId(proposalId: string): boolean {
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(proposalId);
}

/**
 * Validates that a string is alphanumeric with allowed special characters
 */
export function validateAlphanumeric(value: string, maxLength: number = 255): boolean {
  if (!value || value.length > maxLength) return false;
  // Allow letters, numbers, hyphens, underscores, and dots
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

/**
 * Sanitizes string input to prevent XSS attacks
 * Escapes HTML and script characters
 */
export function sanitizeString(value: string, maxLength: number = 1000): string {
  if (!value) return '';
  
  // Truncate if too long
  let sanitized = value.substring(0, maxLength);
  
  // Escape HTML special characters
  const htmlEscapeMap: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return sanitized.replace(/[&<>"/']/g, (char) => htmlEscapeMap[char]);
}

/**
 * Sanitizes object by recursively escaping string values
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T, maxDepth: number = 5): T {
  if (maxDepth <= 0 || !obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'string' ? sanitizeString(item) : sanitizeObject(item, maxDepth - 1)
    ) as any;
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, maxDepth - 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validates Ethereum address format (0x followed by 40 hex characters)
 */
export function validateEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates numeric string (integer or decimal)
 */
export function validateNumericString(value: string, allowNegative: boolean = false): boolean {
  if (allowNegative) {
    return /^-?\d+(\.\d+)?$/.test(value);
  }
  return /^\d+(\.\d+)?$/.test(value);
}

/**
 * Middleware: Validates daoId parameter
 */
export function validateDaoIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { daoId } = req.params;

  if (!daoId || !validateDaoId(daoId)) {
    res.status(400).json({
      success: false,
      message: 'Invalid DAO ID format',
      error: 'INVALID_DAO_ID',
    });
    return;
  }

  next();
}

/**
 * Middleware: Validates common parameter formats
 */
export function validateParamsMiddleware(paramValidators: { [key: string]: (val: string) => boolean }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const [paramName, validator] of Object.entries(paramValidators)) {
      const value = req.params[paramName];
      
      if (value && !validator(value)) {
        res.status(400).json({
          success: false,
          message: `Invalid ${paramName} format`,
          error: `INVALID_${paramName.toUpperCase()}`,
        });
        return;
      }
    }

    // Sanitize query and body strings
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query as any);
    }

    next();
  };
}

/**
 * Middleware: Rate limiting helper for sensitive endpoints
 */
export function rateLimitByUserId(
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minute
) {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'UNAUTHORIZED',
      });
      return;
    }

    const now = Date.now();
    const userData = userRequests.get(userId);

    if (!userData || now > userData.resetTime) {
      // New window or reset
      userRequests.set(userId, { count: 1, resetTime: now + windowMs });
      next();
    } else if (userData.count < maxRequests) {
      // Increment counter
      userData.count++;
      next();
    } else {
      // Rate limit exceeded
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((userData.resetTime - now) / 1000),
      });
    }
  };
}

/**
 * Validates and logs potentially suspicious input patterns
 */
export function detectSuspiciousInput(value: string): string[] {
  const warnings: string[] = [];

  if (/(\bselect\b|\bunion\b|\bdrop\b|\binject\b)/i.test(value)) {
    warnings.push('SQL_INJECTION_PATTERN_DETECTED');
  }

  if (/<script|javascript:|onerror|onclick/i.test(value)) {
    warnings.push('XSS_PATTERN_DETECTED');
  }

  if (/\.\.\//g.test(value)) {
    warnings.push('PATH_TRAVERSAL_PATTERN_DETECTED');
  }

  if (/([;\n]|--|#)/g.test(value)) {
    warnings.push('COMMAND_INJECTION_PATTERN_DETECTED');
  }

  return warnings;
}

/**
 * Security wrapper for route handlers - logs suspicious activity
 */
export function secureHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check for suspicious patterns in params
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') {
          const warnings = detectSuspiciousInput(value);
          if (warnings.length > 0) {
            console.warn(`[SECURITY] Suspicious input detected in param "${key}":`, warnings, value);
          }
        }
      }

      // Check for suspicious patterns in body
      if (req.body && typeof req.body === 'object') {
        const checkSuspicious = (obj: any, path: string = ''): void => {
          for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
              const warnings = detectSuspiciousInput(value);
              if (warnings.length > 0) {
                console.warn(`[SECURITY] Suspicious input detected in body.${path}${key}:`, warnings);
              }
            } else if (typeof value === 'object' && value !== null) {
              checkSuspicious(value, `${path}${key}.`);
            }
          }
        };
        checkSuspicious(req.body);
      }

      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

export default {
  validateDaoId,
  validateProposalId,
  validateEmail,
  validateEthereumAddress,
  validateNumericString,
  validateDaoIdMiddleware,
  validateParamsMiddleware,
  sanitizeString,
  sanitizeObject,
  rateLimitByUserId,
  detectSuspiciousInput,
  secureHandler,
};
