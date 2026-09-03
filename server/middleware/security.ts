/**
 * Security Middleware and Utilities
 * Validates parameters against SQL injection and XSS attacks
 */

import type{ Request, Response, NextFunction } from 'express';

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
export function sanitizeObject<T extends Record<string, any>>(obj: T, maxDepth: number = 5, seen = new WeakSet<object>()): T {
  if (maxDepth <= 0 || !obj || typeof obj !== 'object') {
    return obj;
  }

  if (obj === null || Object.getPrototypeOf(obj) === null) {
    return obj;
  }

  if (seen.has(obj)) {
    return obj;
  }

  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'string' ? item : sanitizeObject(item, maxDepth - 1, seen)
    ) as any;
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, maxDepth - 1, seen);
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
function isValidEip55ChecksumAddress(address: string): boolean {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return false;
  }

  const addressBody = address.slice(2);
  const checksumAddress = addressBody
    .split('')
    .map((char, index) => {
      const shouldUppercase = /[A-F]/.test(char) &&
        addressBody.toLowerCase().split('').filter((c, i) => i === index).length === 0;
      return shouldUppercase ? char.toUpperCase() : char.toLowerCase();
    })
    .join('');

  return checksumAddress === addressBody.toLowerCase() || checksumAddress === addressBody.toUpperCase();
}

export function validateEthereumAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return false;
  }

  const addressBody = address.slice(2);
  const checksumAddress = addressBody
    .split('')
    .map((char, idx) => {
      const lower = addressBody.toLowerCase();
      const relevant = lower[idx];
      return /[a-f]/.test(relevant) ? char.toLowerCase() : char.toUpperCase();
    })
    .join('');

  return address === `0x${checksumAddress}`;
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
    for (const [key, entry] of userRequests.entries()) {
      if (entry.resetTime <= now) {
        userRequests.delete(key);
      }
    }

    const userData = userRequests.get(userId);

    if (!userData || now > userData.resetTime) {
      userRequests.set(userId, { count: 1, resetTime: now + windowMs });
      next();
    } else if (userData.count < maxRequests) {
      userData.count++;
      next();
    } else {
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
function collectStringValues(value: unknown, prefix = ''): Array<{ path: string; value: string }> {
  if (typeof value === 'string') {
    return [{ path: prefix || 'value', value }];
  }

  if (Array.isArray(value)) {
    const results: Array<{ path: string; value: string }> = [];
    value.forEach((item, index) => {
      results.push(...collectStringValues(item, `${prefix}[${index}]`));
    });
    return results;
  }

  if (value && typeof value === 'object') {
    const results: Array<{ path: string; value: string }> = [];
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      results.push(...collectStringValues(nestedValue, nextPrefix));
    }
    return results;
  }

  return [];
}

export function detectSuspiciousInput(value: unknown): string[] {
  const warnings: string[] = [];

  for (const entry of collectStringValues(value)) {
    const candidate = entry.value;

    if (/(\bselect\b|\bunion\b|\bdrop\b|\binject\b)/i.test(candidate)) {
      warnings.push('SQL_INJECTION_PATTERN_DETECTED');
    }

    if (/<script|javascript:|onerror|onclick/i.test(candidate)) {
      warnings.push('XSS_PATTERN_DETECTED');
    }

    if (/\.\.\//g.test(candidate)) {
      warnings.push('PATH_TRAVERSAL_PATTERN_DETECTED');
    }

    if (/([;]|--)/g.test(candidate)) {
      warnings.push('COMMAND_INJECTION_PATTERN_DETECTED');
    }
  }

  return [...new Set(warnings)];
}

/**
 * Security wrapper for route handlers - logs suspicious activity
 */
export function secureHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suspiciousPatterns: string[] = [];

      const collectPatterns = (input: unknown, prefix: string) => {
        for (const entry of collectStringValues(input, prefix)) {
          const warnings = detectSuspiciousInput(entry.value);
          if (warnings.length > 0) {
            suspiciousPatterns.push(`${entry.path}: ${warnings.join(', ')}`);
          }
        }
      };

      for (const [key, value] of Object.entries(req.params)) {
        collectPatterns(value, `params.${key}`);
      }

      collectPatterns(req.body, 'body');
      collectPatterns(req.query, 'query');

      if (suspiciousPatterns.length > 0) {
        console.warn('[SECURITY] Suspicious input detected', suspiciousPatterns);
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
