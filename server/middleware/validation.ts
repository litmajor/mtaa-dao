
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { AppError, ValidationError } from './errorHandler';
import { Logger } from '../utils/logger';

const logger = new Logger('validation-middleware');

// Common validation schemas
export const commonSchemas = {
  id: z.string().min(1, 'ID is required'),
  email: z.string().email('Invalid email format'),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, 'Amount must be a positive number'),
  pagination: z.object({
    page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform((val) => val ? Math.min(100, parseInt(val, 10)) : 20),
  }),
  vaultId: z.string().min(1, 'Vault ID is required'),
  userId: z.string().min(1, 'User ID is required'),
};

// Validation middleware factory
export const validate = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = logger.child({
      requestId: req.headers['x-request-id'],
      method: req.method,
      url: req.url,
    });

    try {
      // Validate request body
      if (schema.body && req.body) {
        const validatedBody = schema.body.parse(req.body);
        req.body = validatedBody;
        requestLogger.debug('Request body validated successfully');
      }

      // Validate query parameters
      if (schema.query && req.query) {
        const validatedQuery = schema.query.parse(req.query);
        req.query = validatedQuery;
        requestLogger.debug('Query parameters validated successfully');
      }

      // Validate route parameters
      if (schema.params && req.params) {
        const validatedParams = schema.params.parse(req.params);
        req.params = validatedParams;
        requestLogger.debug('Route parameters validated successfully');
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        requestLogger.warn('Validation failed', { errors: error.errors });
        
        const validationError = new ValidationError(
          `Validation failed: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}`
        );
        
        return next(validationError);
      }
      
      requestLogger.error('Unexpected validation error', error);
      return next(new AppError('Validation processing failed', 500));
    }
  };
};

// Specific validation schemas for different endpoints
export const vaultValidation = {
  createVault: validate({
    body: z.object({
      name: z.string().min(1, 'Vault name is required').max(100, 'Vault name too long'),
      description: z.string().optional(),
      type: z.enum(['personal', 'community']),
      currency: z.string().min(1, 'Currency is required'),
      initialDeposit: commonSchemas.amount.optional(),
    }),
  }),
  
  getVault: validate({
    params: z.object({
      vaultId: commonSchemas.vaultId,
    }),
  }),
  
  depositToVault: validate({
    params: z.object({
      vaultId: commonSchemas.vaultId,
    }),
    body: z.object({
      amount: commonSchemas.amount,
      tokenSymbol: z.string().min(1, 'Token symbol is required'),
    }),
  }),
  
  withdrawFromVault: validate({
    params: z.object({
      vaultId: commonSchemas.vaultId,
    }),
    body: z.object({
      amount: commonSchemas.amount,
      tokenSymbol: z.string().min(1, 'Token symbol is required'),
    }),
  }),
  
  getVaultTransactions: validate({
    params: z.object({
      vaultId: commonSchemas.vaultId,
    }),
    query: commonSchemas.pagination,
  }),
};

export const authValidation = {
  register: validate({
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(8, 'Password must be at least 8 characters'),
      name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
      walletAddress: z.string().optional(),
    }),
  }),
  
  login: validate({
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(1, 'Password is required'),
    }),
  }),
};

export const walletValidation = {
  transfer: validate({
    body: z.object({
      to: z.string().min(1, 'Recipient address is required'),
      amount: commonSchemas.amount,
      tokenSymbol: z.string().min(1, 'Token symbol is required'),
    }),
  }),
  
  getBalance: validate({
    query: z.object({
      tokenSymbol: z.string().optional(),
    }),
  }),
};

// Response validation middleware
export const validateResponse = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(body: any) {
      const requestLogger = logger.child({
        requestId: req.headers['x-request-id'],
        method: req.method,
        url: req.url,
      });

      try {
        if (body && typeof body === 'object') {
          const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
          schema.parse(parsedBody);
          requestLogger.debug('Response validated successfully');
        }
      } catch (error) {
        if (error instanceof ZodError) {
          requestLogger.error('Response validation failed', { errors: error.errors });
        } else {
          requestLogger.error('Response validation error', error);
        }
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};

// Standard API response schemas
export const responseSchemas = {
  success: z.object({
    success: z.literal(true),
    data: z.any().optional(),
    message: z.string().optional(),
  }),
  
  error: z.object({
    success: z.literal(false),
    error: z.object({
      message: z.string(),
      code: z.string().optional(),
      statusCode: z.number().optional(),
      timestamp: z.string(),
      path: z.string(),
      method: z.string(),
    }),
  }),
  
  vault: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    balance: z.string(),
    currency: z.string(),
    isActive: z.boolean(),
  }),
  
  transaction: z.object({
    id: z.string(),
    vaultId: z.string(),
    amount: z.string(),
    tokenSymbol: z.string(),
    status: z.string(),
    transactionHash: z.string().optional(),
    createdAt: z.string(),
  }),
};

