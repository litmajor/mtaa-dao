
import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env, isDevelopment } from '../../shared/config.js';
import { storage } from '../storage';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Custom error classes
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, true, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, true, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, true, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true, 'RATE_LIMIT_EXCEEDED');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, true, 'DATABASE_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service error') {
    super(`${service}: ${message}`, 502, true, 'EXTERNAL_SERVICE_ERROR');
  }
}

// Error response formatter
const formatErrorResponse = (error: AppError | Error, req: Request) => {
  const response: any = {
    success: false,
    error: {
      message: error.message,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    }
  };

  if (error instanceof AppError) {
    response.error.code = error.code;
    response.error.statusCode = error.statusCode;
  }

  // Include stack trace in development
  if (isDevelopment && error.stack) {
    response.error.stack = error.stack;
  }

  // Add request ID if available
  if (req.headers['x-request-id']) {
    response.error.requestId = req.headers['x-request-id'];
  }

  return response;
};

// Log error to database and console
const logError = async (error: Error, req: Request, res: Response) => {
  const severity = error instanceof AppError && error.statusCode < 500 ? 'medium' : 'high';
  const user = (req as any).user;

  try {
    // Log to system logs
    await storage.createSystemLog(
      'error',
      error.message,
      'api',
      {
        stack: error.stack,
        statusCode: error instanceof AppError ? error.statusCode : 500,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        userId: user?.claims?.sub,
        requestBody: req.body,
        requestQuery: req.query,
        requestParams: req.params,
      }
    );

    // Log critical errors to console
    if (severity === 'high') {
      console.error(`🚨 ${error.message}`, {
        stack: error.stack,
        path: req.path,
        method: req.method,
        userId: user?.claims?.sub,
      });
    }
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }
};

// Main error handling middleware
export const errorHandler = async (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  await logError(error, req, res);

  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code || 'APP_ERROR';
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    
    // Send detailed validation errors
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        code,
        statusCode,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        details: error.errors,
      }
    });
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  } else if (error.name === 'MongoError' || error.message.includes('database')) {
    statusCode = 500;
    message = 'Database operation failed';
    code = 'DATABASE_ERROR';
  }

  const response = formatErrorResponse(
    new AppError(message, statusCode, true, code),
    req
  );

  res.status(statusCode).json(response);
};

// Async error handler wrapper
import type { RequestHandler } from 'express';

export const asyncHandler = (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 Not Found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Unhandled rejection and exception handlers
export const setupProcessErrorHandlers = () => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('🚨 Unhandled Promise Rejection:', reason);
    // Close server gracefully
    process.exit(1);
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('🚨 Uncaught Exception:', error);
    // Close server gracefully
    process.exit(1);
  });
};
