
import type { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { z } from 'zod';

// Common validation schemas
export const sanitizedStringSchema = z.string()
  .min(1)
  .max(1000)
  .refine((str) => !containsHtml(str), 'HTML content not allowed');

export const sanitizedEmailSchema = z.string()
  .email()
  .refine((email) => validator.isEmail(email), 'Invalid email format');

export const sanitizedUrlSchema = z.string()
  .url()
  .refine((url) => validator.isURL(url), 'Invalid URL format');

export const sanitizedAmountSchema = z.string()
  .refine((amount) => validator.isNumeric(amount), 'Invalid numeric amount')
  .refine((amount) => parseFloat(amount) >= 0, 'Amount must be positive');

// Helper functions
function containsHtml(str: string): boolean {
  return /<[^>]*>/.test(str);
}

function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}

// Middleware for sanitizing request body
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// SQL injection prevention
export const preventSqlInjection = (req: Request, res: Response, next: NextFunction) => {
  const sqlInjectionPatterns = [
    /(\b(select|insert|update|delete|drop|create|alter|exec|execute|union|script)\b)/i,
    /(;|\-\-|\/\*|\*\/|xp_|sp_)/i,
    /(\b(or|and)\b.*?=.*?)/i
  ];
  
  const checkForSqlInjection = (value: string): boolean => {
    return sqlInjectionPatterns.some(pattern => pattern.test(value));
  };
  
  const checkObject = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return checkForSqlInjection(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.some(checkObject);
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkObject);
    }
    
    return false;
  };
  
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({ 
      error: 'Potentially malicious input detected' 
    });
  }
  
  next();
};

// XSS prevention
export const preventXSS = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<embed[^>]*>/gi,
    /<object[^>]*>/gi
  ];
  
  const checkForXSS = (value: string): boolean => {
    return xssPatterns.some(pattern => pattern.test(value));
  };
  
  const checkObject = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return checkForXSS(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.some(checkObject);
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkObject);
    }
    
    return false;
  };
  
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({ 
      error: 'XSS attempt detected' 
    });
  }
  
  next();
};

// Comprehensive input validation middleware
export const validateAndSanitize = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // First sanitize
      sanitizeInput(req, res, () => {});
      
      // Then validate
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: 'Invalid input data',
          details: result.error.errors
        });
      }
      
      req.body = result.data;
      next();
    } catch (error) {
      res.status(400).json({ 
        error: 'Input validation failed' 
      });
    }
  };
};
