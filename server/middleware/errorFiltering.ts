import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('error-filter-middleware');

/**
 * Error Message Filtering Middleware
 * 
 * Prevents sensitive information leakage:
 * - Stack traces never sent to clients
 * - Database errors sanitized
 * - File paths removed
 * - Internal details hidden
 * - Full details logged server-side for debugging
 */

export interface ClientErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode?: number;
  };
}

export interface ServerErrorDetails {
  originalMessage: string;
  stack?: string;
  code?: string;
  statusCode: number;
  userId?: string;
  path?: string;
  method?: string;
}

/**
 * Safe error messages to send to clients
 * Mapped from error codes/types to user-friendly messages
 */
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  'VALIDATION_ERROR': 'The provided data is invalid',
  'NOT_FOUND': 'The requested resource was not found',
  'UNAUTHORIZED': 'You do not have permission to access this resource',
  'FORBIDDEN': 'Access to this resource is forbidden',
  'CONFLICT': 'This resource already exists',
  'RATE_LIMIT': 'Too many requests, please try again later',
  'DATABASE_ERROR': 'An error occurred while processing your request',
  'NETWORK_ERROR': 'A network error occurred, please try again',
  'TIMEOUT': 'The request took too long, please try again',
  'INTERNAL_ERROR': 'An unexpected error occurred, please try again later',
};

/**
 * Extract error code from error object
 */
function getErrorCode(error: any): string | null {
  if (error.code) return error.code;
  if (error.constructor?.name) {
    const name = error.constructor.name;
    if (name === 'ValidationError') return 'VALIDATION_ERROR';
    if (name === 'NotFoundError') return 'NOT_FOUND';
    if (name === 'UnauthorizedError') return 'UNAUTHORIZED';
    if (name === 'ForbiddenError') return 'FORBIDDEN';
  }
  return null;
}

/**
 * Check if error is a database error (should be sanitized)
 */
function isDatabaseError(error: any): boolean {
  const errorMessage = error.message?.toLowerCase() || '';
  return (
    errorMessage.includes('database') ||
    errorMessage.includes('query') ||
    errorMessage.includes('sql') ||
    error.name?.includes('Database') ||
    error.name?.includes('SQL')
  );
}

/**
 * Check if error is sensitive (should be hidden)
 */
function isSensitiveError(error: any): boolean {
  if (isDatabaseError(error)) return true;
  
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('password') ||
    message.includes('secret') ||
    message.includes('api_key') ||
    message.includes('token') ||
    message.includes('credential') ||
    message.includes('/') || // File paths
    message.includes('\\')   // Windows paths
  );
}

/**
 * Sanitize error message - remove sensitive information
 */
function sanitizeErrorMessage(message: string, statusCode: number): string {
  if (!message) {
    return SAFE_ERROR_MESSAGES['INTERNAL_ERROR'];
  }

  const lowerMessage = message.toLowerCase();

  // Database errors
  if (lowerMessage.includes('database') || lowerMessage.includes('query')) {
    return SAFE_ERROR_MESSAGES['DATABASE_ERROR'];
  }

  // File system errors
  if (lowerMessage.includes('enoent') || lowerMessage.includes('no such file')) {
    return SAFE_ERROR_MESSAGES['NOT_FOUND'];
  }

  // Network errors
  if (lowerMessage.includes('econnrefused') || lowerMessage.includes('timeout')) {
    return SAFE_ERROR_MESSAGES['NETWORK_ERROR'];
  }

  // Validation errors (keep some context)
  if (statusCode === 400 && lowerMessage.includes('invalid')) {
    return 'The provided data is invalid. Please check your input and try again.';
  }

  // Try to get from safe messages using error code
  const errorCode = getErrorCode({ message });
  if (errorCode && SAFE_ERROR_MESSAGES[errorCode]) {
    return SAFE_ERROR_MESSAGES[errorCode];
  }

  // Generic safe message based on status code
  switch (statusCode) {
    case 400:
      return 'Bad request. Please check your input.';
    case 401:
      return 'Authentication required.';
    case 403:
      return 'You do not have permission to access this resource.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This resource already exists.';
    case 429:
      return SAFE_ERROR_MESSAGES['RATE_LIMIT'];
    case 500:
    case 502:
    case 503:
    case 504:
      return SAFE_ERROR_MESSAGES['INTERNAL_ERROR'];
    default:
      return 'An error occurred. Please try again later.';
  }
}

/**
 * Create a safe response for the client
 */
export function createClientErrorResponse(
  statusCode: number,
  errorMessage: string,
  errorCode?: string
): ClientErrorResponse {
  return {
    success: false,
    error: {
      message: sanitizeErrorMessage(errorMessage, statusCode),
      code: errorCode,
      statusCode,
    },
  };
}

/**
 * Log detailed error information server-side
 */
function logDetailedError(
  details: ServerErrorDetails
): void {
  const logData = {
    message: details.originalMessage,
    code: details.code,
    statusCode: details.statusCode,
    userId: details.userId,
    path: details.path,
    method: details.method,
    timestamp: new Date().toISOString(),
  };

  if (details.statusCode >= 500) {
    logger.error('Server error occurred', {
      ...logData,
      stack: details.stack?.substring(0, 500), // Truncate stack
    });
  } else if (details.statusCode >= 400) {
    logger.warn('Client error occurred', logData);
  } else {
    logger.info('Error response sent', logData);
  }
}

/**
 * Express error filtering middleware
 * Should be placed AFTER all other middleware and route handlers
 * 
 * Usage:
 * app.use(errorFilteringMiddleware);
 */
export const errorFilteringMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Ensure we have an Express error handler signature
  const statusCode = error.statusCode || error.status || 500;
  const errorMessage = error.message || 'Unknown error occurred';
  const errorCode = getErrorCode(error);

  // Log detailed error (server-side only)
  logDetailedError({
    originalMessage: errorMessage,
    stack: error.stack,
    code: errorCode,
    statusCode,
    userId: (req as any).user?.userId || (req as any).user?.claims?.sub,
    path: req.path,
    method: req.method,
  });

  // Check if error should be completely hidden
  if (isSensitiveError(error) && statusCode < 500) {
    logger.warn('Sensitive error detected, replacing with generic message', {
      originalError: errorMessage.substring(0, 100),
      path: req.path,
    });
    return res.status(statusCode).json(
      createClientErrorResponse(statusCode, SAFE_ERROR_MESSAGES['INTERNAL_ERROR'])
    );
  }

  // Send safe error response to client
  res.status(statusCode).json(
    createClientErrorResponse(statusCode, errorMessage, errorCode)
  );
};

/**
 * Validation error handler
 * Converts Zod validation errors to safe response
 */
export function handleValidationError(
  errors: Record<string, string[]>
): ClientErrorResponse {
  const fieldErrors = Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
    .slice(0, 5) // Only show first 5 errors
    .join('; ');

  return {
    success: false,
    error: {
      message: `Validation failed: ${fieldErrors}`,
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    },
  };
}

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Log the error
      logger.error('Unhandled error in route handler', {
        error: error.message,
        path: req.path,
        method: req.method,
      });

      // Send safe error response
      res.status(500).json(
        createClientErrorResponse(500, error.message || 'Internal server error')
      );
    });
  };
}

/**
 * Middleware to wrap JSON parsing errors
 */
export function jsonErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (error instanceof SyntaxError && 'body' in error) {
    logger.warn('JSON parse error', { path: req.path });
    return res.status(400).json(
      createClientErrorResponse(400, 'Invalid JSON in request body')
    );
  }
  next(error);
}
