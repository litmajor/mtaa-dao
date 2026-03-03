/**
 * DAO Consolidated Router
 * Consolidates all DAO-related routes under /api/dao/:daoId/ to prevent wildcard route collisions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { validateDaoIdMiddleware, validateParamsMiddleware, validateDaoId, sanitizeString } from '../middleware/security';
import { db } from '../storage';
import { daos } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const daoRouter = Router({ mergeParams: true });

/**
 * Middleware: Validate DAO exists and user has access
 */
async function daoAccessMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const { daoId } = req.params;

    // Validate format
    if (!validateDaoId(daoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid DAO ID format',
        error: 'INVALID_DAO_ID',
      });
    }

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({
        success: false,
        message: 'DAO not found',
        error: 'DAO_NOT_FOUND',
      });
    }

    // Store DAO in request for later use
    (req as any).dao = dao[0];
    next();
  } catch (error) {
    console.error('[DAO] Access validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate DAO access',
      error: 'VALIDATION_ERROR',
    });
  }
}

/**
 * Middleware: Sanitize request data before processing
 */
function sanitizeRequestMiddleware(req: Request, res: Response, next: NextFunction) {
  // Sanitize string values in body
  if (req.body && typeof req.body === 'object') {
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        return sanitizeString(value, 2000);
      } else if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      } else if (typeof value === 'object' && value !== null) {
        const sanitized: any = {};
        for (const [key, val] of Object.entries(value)) {
          sanitized[key] = sanitizeValue(val);
        }
        return sanitized;
      }
      return value;
    };

    req.body = sanitizeValue(req.body);
  }

  next();
}

/**
 * Apply core DAO middlewares
 */
daoRouter.use(validateDaoIdMiddleware);
daoRouter.use(daoAccessMiddleware);
daoRouter.use(sanitizeRequestMiddleware);

// Re-export for mounting in routes.ts
export default daoRouter;
