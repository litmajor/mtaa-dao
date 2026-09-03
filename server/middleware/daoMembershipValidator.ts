/**
 * DAO Membership Validation Middleware
 *
 * Ensures authenticated users are active members of the DAO they're accessing.
 * Prevents privilege escalation and unauthorized data access.
 */

import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { daoMemberships, daos } from '../../shared/schema';
import { and, eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const logger = new Logger('dao-membership-validator');

type DaoIdSource = 'params' | 'query' | 'body';

function getDaoIdFromRequest(req: Request, source: DaoIdSource): string | undefined {
  switch (source) {
    case 'params':
      return typeof req.params?.daoId === 'string' ? req.params.daoId.trim() : undefined;
    case 'query':
      return typeof req.query?.daoId === 'string' ? req.query.daoId.trim() : undefined;
    case 'body':
      return typeof req.body?.daoId === 'string' ? req.body.daoId.trim() : undefined;
    default:
      return undefined;
  }
}

async function requireDAOMembershipFromSource(
  req: Request,
  res: Response,
  next: NextFunction,
  source: DaoIdSource
) {
  try {
    const userId = req.user?.id;
    const daoId = getDaoIdFromRequest(req, source);

    if (!userId) {
      logger.warn('Missing user ID for DAO membership check');
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!daoId) {
      if (source === 'query') {
        logger.info('No daoId filter, allowing global query', { userId });
        return next();
      }

      logger.warn('Missing daoId parameter for membership check', { userId });
      return res.status(400).json({
        error: 'DAO ID is required in request parameters',
        code: 'MISSING_DAO_ID',
      });
    }

    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.status, 'approved'),
          eq(daoMemberships.isBanned, false)
        )
      )
      .limit(1);

    if (membership.length > 0) {
      req.daoMembership = membership[0];
      req.daoId = daoId;

      logger.info('DAO membership verified', { userId, daoId, role: membership[0].role });
      return next();
    }

    const daoExists = await db
      .select({ id: daos.id })
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!daoExists.length) {
      logger.warn('DAO not found', { daoId });
      return res.status(404).json({
        error: 'DAO not found',
        code: 'DAO_NOT_FOUND',
      });
    }

    logger.warn('User is not an active approved member of DAO', { userId, daoId });
    return res.status(403).json({
      error: 'You are not an active member of this DAO',
      code: 'NOT_DAO_MEMBER',
    });
  } catch (error) {
    logger.error('Error verifying DAO membership', error);
    return res.status(500).json({
      error: 'Failed to verify DAO membership',
      code: 'VALIDATION_ERROR',
    });
  }
}

/**
 * Middleware to require DAO membership from URL params.
 * Usage: app.get('/api/routes/:daoId', isAuthenticated, requireDAOMembership, handler)
 */
export async function requireDAOMembership(
  req: Request,
  res: Response,
  next: NextFunction
) {
  return requireDAOMembershipFromSource(req, res, next, 'params');
}

/**
 * Middleware variant that extracts daoId from the query string.
 * Usage: app.get('/api/analytics/dao', isAuthenticated, requireDAOMembershipFromQuery, handler)
 */
export async function requireDAOMembershipFromQuery(
  req: Request,
  res: Response,
  next: NextFunction
) {
  return requireDAOMembershipFromSource(req, res, next, 'query');
}
