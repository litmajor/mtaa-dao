import { Request, Response, NextFunction } from 'express';
import { db } from '../storage';
import { daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError } from './errorHandler';

const logger = new Logger('dao-permissions-middleware');

/**
 * Middleware to verify user is a DAO admin (owner or admin role)
 * Requires: req.params.daoId
 * Sets: req.daoRole, req.userPermissions (merged)
 */
export const requireDAOAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    const daoId = req.params.daoId;

    if (!userId) {
      logger.warn('Missing authentication for DAO admin check');
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
    }

    if (!daoId) {
      logger.warn('Missing daoId parameter for DAO admin check', { userId });
      return res.status(400).json({
        success: false,
        error: { message: 'DAO ID required' },
      });
    }

    // Check DAO membership and verify admin role
    const membershipResult = await db
      .select({ role: daoMemberships.role })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId)
      ))
      .limit(1);

    if (membershipResult.length === 0) {
      logger.warn('User not a member of DAO', { userId, daoId });
      return res.status(403).json({
        success: false,
        error: { message: 'Not a member of this DAO' },
      });
    }

    const daoRole = membershipResult[0].role || 'member';
    
    // Only owner or admin can perform sensitive operations
    if (!['owner', 'admin'].includes(daoRole)) {
      logger.warn('User lacks admin role for DAO', { userId, daoId, daoRole });
      return res.status(403).json({
        success: false,
        error: { message: 'DAO admin role required for this operation' },
      });
    }

    // Store role info on request for downstream handlers
    req.daoRole = daoRole;
    
    logger.info('DAO admin check passed', { userId, daoId, daoRole });
    next();
  } catch (error) {
    logger.error('DAO admin permission check failed', error);
    next(new AppError('DAO authorization check failed', 500));
  }
};

/**
 * Middleware to verify user is a DAO member
 * Requires: req.params.daoId
 * Sets: req.daoRole
 */
export const requireDAOMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    const daoId = req.params.daoId;

    if (!userId) {
      logger.warn('Missing authentication for DAO member check');
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
    }

    if (!daoId) {
      logger.warn('Missing daoId parameter for DAO member check', { userId });
      return res.status(400).json({
        success: false,
        error: { message: 'DAO ID required' },
      });
    }

    // Check DAO membership
    const membershipResult = await db
      .select({ role: daoMemberships.role })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId)
      ))
      .limit(1);

    if (membershipResult.length === 0) {
      logger.warn('User not a member of DAO', { userId, daoId });
      return res.status(403).json({
        success: false,
        error: { message: 'Not a member of this DAO' },
      });
    }

    const daoRole = membershipResult[0].role || 'member';
    req.daoRole = daoRole;
    
    logger.info('DAO member check passed', { userId, daoId, daoRole });
    next();
  } catch (error) {
    logger.error('DAO member permission check failed', error);
    next(new AppError('DAO authorization check failed', 500));
  }
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      daoRole?: string;
    }
  }
}
