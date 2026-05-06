/**
 * DAO Membership Validation Middleware
 * 
 * Ensures authenticated users are members of the DAO they're accessing
 * Prevents privilege escalation and unauthorized data access
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { daoMemberships, daos } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const logger = new Logger('dao-membership-validator');

/**
 * Middleware to require DAO membership
 * Usage: app.get('/api/routes/:daoId', isAuthenticated, requireDAOMembership, handler)
 * 
 * Sets req.daoMembership with membership object if valid
 * Returns 403 if user is not a member of the DAO
 */
export async function requireDAOMembership(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = (req as any).user?.id;
    const daoId = req.params.daoId;

    if (!userId) {
      logger.warn('Missing user ID for DAO membership check');
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!daoId) {
      logger.warn('Missing daoId parameter for membership check', { userId });
      return res.status(400).json({
        error: 'DAO ID is required in URL parameters',
        code: 'MISSING_DAO_ID'
      });
    }

    // Verify DAO exists
    const daoExists = await db
      .select({ id: daos.id })
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!daoExists.length) {
      logger.warn('DAO not found', { daoId });
      return res.status(404).json({
        error: 'DAO not found',
        code: 'DAO_NOT_FOUND'
      });
    }

    // Check DAO membership
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.daoId, daoId)
        )
      )
      .limit(1);

    if (!membership.length) {
      logger.warn('User not a member of DAO', { userId, daoId });
      return res.status(403).json({
        error: 'You are not a member of this DAO',
        code: 'NOT_DAO_MEMBER'
      });
    }

    // Store membership info on request for downstream handlers
    (req as any).daoMembership = membership[0];
    (req as any).daoId = daoId;
    
    logger.info('DAO membership verified', { userId, daoId, role: membership[0].role });
    next();
  } catch (error) {
    logger.error('Error verifying DAO membership', error);
    res.status(500).json({
      error: 'Failed to verify DAO membership',
      code: 'VALIDATION_ERROR'
    });
  }
}

/**
 * Middleware variant that extracts daoId from query params instead of URL params
 * Usage: app.get('/api/analytics/dao', isAuthenticated, requireDAOMembershipFromQuery, handler)
 */
export async function requireDAOMembershipFromQuery(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = (req as any).user?.id;
    const daoId = req.query.daoId as string;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!daoId) {
      // If no daoId provided, user can query global/personal data
      logger.info('No daoId filter, allowing global query', { userId });
      return next();
    }

    // Verify DAO exists
    const daoExists = await db
      .select({ id: daos.id })
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!daoExists.length) {
      return res.status(404).json({
        error: 'DAO not found',
        code: 'DAO_NOT_FOUND'
      });
    }

    // Check DAO membership
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.daoId, daoId)
        )
      )
      .limit(1);

    if (!membership.length) {
      logger.warn('User not a member of DAO', { userId, daoId });
      return res.status(403).json({
        error: 'You are not a member of this DAO',
        code: 'NOT_DAO_MEMBER'
      });
    }

    // Store membership info
    (req as any).daoMembership = membership[0];
    (req as any).daoId = daoId;
    
    next();
  } catch (error) {
    logger.error('Error verifying DAO membership from query', error);
    res.status(500).json({
      error: 'Failed to verify DAO membership',
      code: 'VALIDATION_ERROR'
    });
  }
}
