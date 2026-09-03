/**
 * Centralized Error Filtering Middleware for Express.js
 * This middleware captures all errors thrown in the application, sanitizes them for client consumption, and logs detailed diagnostic information for server-side observability.
 * It distinguishes between operational errors (expected application errors) and unhandled system crashes.
 */ 

import type { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('error-filter-middleware');

export interface ClientErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: Record<string, string[]>;
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

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'The provided data is invalid',
  NOT_FOUND: 'The requested resource was not found',
  UNAUTHORIZED: 'Authentication required to access this resource',
  FORBIDDEN: 'Access to this resource is forbidden',
  CONFLICT: 'This resource already exists',
  RATE_LIMIT: 'Too many requests, please try again later',
  DATABASE_ERROR: 'A database error occurred while processing your request',
  NETWORK_ERROR: 'A downstream network error occurred',
  INTERNAL_ERROR: 'An unexpected internal error occurred. Please try again later',
};

/**
 * Custom Operational Error Class
 * Distinguishes expected application errors from unhandled system crashes
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code?: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Extract error code from error object or class name
 */
function getErrorCode(error: any): string | undefined {
  if (error.code) return String(error.code);
  if (error.constructor?.name) {
    const name = error.constructor.name;
    if (name === 'ValidationError') return 'VALIDATION_ERROR';
    if (name === 'NotFoundError') return 'NOT_FOUND';
    if (name === 'UnauthorizedError') return 'UNAUTHORIZED';
    if (name === 'ForbiddenError') return 'FORBIDDEN';
  }
  return undefined;
}

/**
 * Detect database or system-level driver errors
 */
function isInternalDriverError(error: any): boolean {
  const msg = error.message?.toLowerCase() || '';
  const name = error.name || '';
  return (
    msg.includes('postgres') ||
    msg.includes('mysql') ||
    msg.includes('sqlite') ||
    msg.includes('mongo') ||
    msg.includes('syntax error at or near') ||
    msg.includes('connection refused') ||
    name.includes('Database') ||
    name.includes('QueryFailed')
  );
}

/**
 * Sanitize error message for client consumption
 */
function sanitizeErrorMessage(error: any, statusCode: number): string {
  // Always mask non-operational 500 errors and DB driver leaks
  if (statusCode >= 500 || isInternalDriverError(error)) {
    return SAFE_ERROR_MESSAGES.INTERNAL_ERROR;
  }

  // If error is marked explicitly operational, return message safely
  if (error.isOperational && error.message) {
    return error.message;
  }

  const errorCode = getErrorCode(error);
  if (errorCode && SAFE_ERROR_MESSAGES[errorCode]) {
    return SAFE_ERROR_MESSAGES[errorCode];
  }

  switch (statusCode) {
    case 400: return 'Bad request. Please verify your input.';
    case 401: return SAFE_ERROR_MESSAGES.UNAUTHORIZED;
    case 403: return SAFE_ERROR_MESSAGES.FORBIDDEN;
    case 404: return SAFE_ERROR_MESSAGES.NOT_FOUND;
    case 409: return SAFE_ERROR_MESSAGES.CONFLICT;
    case 429: return SAFE_ERROR_MESSAGES.RATE_LIMIT;
    default: return SAFE_ERROR_MESSAGES.INTERNAL_ERROR;
  }
}

/**
 * Build safe client response payload
 */
export function createClientErrorResponse(
  statusCode: number,
  rawError: any,
  errorCode?: string,
  details?: Record<string, string[]>
): ClientErrorResponse {
  return {
    success: false,
    error: {
      message: sanitizeErrorMessage(rawError, statusCode),
      code: errorCode || getErrorCode(rawError),
      statusCode,
      ...(details ? { details } : {}),
    },
  };
}

/**
 * Log server-side diagnostic details without truncation
 */
function logDetailedError(details: ServerErrorDetails): void {
  const logData = {
    message: details.originalMessage,
    code: details.code,
    statusCode: details.statusCode,
    userId: details.userId,
    path: details.path,
    method: details.method,
    timestamp: new Date().toISOString(),
    stack: details.stack, // Full stack trace preserved for server observability
  };

  if (details.statusCode >= 500) {
    logger.error('Unhandled server error occurred', logData);
  } else {
    logger.warn('Client request error', logData);
  }
}

/**
 * Central Express Error Filtering Middleware
 */
export const errorFilteringMiddleware = (
  error: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  const statusCode = error.statusCode || error.status || 500;
  const errorMessage = error.message || 'Unknown error occurred';
  const errorCode = getErrorCode(error);

  logDetailedError({
    originalMessage: errorMessage,
    stack: error.stack,
    code: errorCode,
    statusCode,
    userId: (req as any).user?.userId || (req as any).user?.claims?.sub,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json(
    createClientErrorResponse(statusCode, error, errorCode)
  );
};

/**
 * Wrap async route handlers to delegate errors to central middleware
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    //  FIX: Delegates all caught errors to Express next(err) pipeline
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Format structured validation error responses (e.g., Zod / express-validator)
 */
export function handleValidationError(
  fieldErrors: Record<string, string[]>
): ClientErrorResponse {
  return {
    success: false,
    error: {
      message: SAFE_ERROR_MESSAGES.VALIDATION_ERROR,
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: fieldErrors,
    },
  };
}

/**
 * Handle invalid JSON body syntax errors from body-parser
 */
export function jsonErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (error instanceof SyntaxError && 'body' in error) {
    logger.warn('JSON parse error in request body', { path: req.path });
    return res.status(400).json(
      createClientErrorResponse(400, new AppError('Invalid JSON format in request body', 400, 'INVALID_JSON'))
    );
  }
  next(error);
}