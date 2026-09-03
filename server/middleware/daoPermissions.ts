import type { Request, Response, NextFunction } from 'express';
import { db } from '../storage';
import { daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError } from './errorHandler';

const logger = new Logger('dao-permissions-middleware');

// Role hierarchy rank mapping
const ROLE_HIERARCHY: Record<string, number> = {
  owner: 5,
  admin: 4,
  elder: 3,
  moderator: 2,
  member: 1,
};

export interface DAOPermissionOptions {
  /** Minimum role required based on hierarchy (e.g. 'admin' allows 'admin' and 'owner') */
  minRole?: 'owner' | 'admin' | 'moderator' | 'member';
  /** Explicit list of acceptable roles */
  allowedRoles?: string[];
  /** Custom function to resolve daoId from the request */
  getDaoId?: (req: Request) => string | undefined;
}

/**
 * Safely extracts user ID from common passport/jwt request payload shapes
 */
function extractUserId(req: Request): string | undefined {
  const user = req.user;
  return user?.userId || user?.claims?.sub || user?.id;
}

/**
 * Unified DAO Permission Factory
 */
export function requireDAOPermission(options: DAOPermissionOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = extractUserId(req);
      const getDaoId =
        options.getDaoId || ((r) => r.params.daoId || (r.query.daoId as string));
      const daoId = getDaoId(req);

      if (!userId) {
        logger.warn('Missing authentication for DAO permission check');
        return next(new AppError('Authentication required', 401));
      }

      if (!daoId) {
        logger.warn('Missing daoId parameter for DAO permission check', { userId });
        return next(new AppError('DAO ID required', 400));
      }

      // Fetch member role in single optimized query
      const [membership] = await db
        .select({ role: daoMemberships.role })
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

      if (!membership) {
        logger.warn('User not a member of DAO', { userId, daoId });
        return next(new AppError('Not a member of this DAO', 403));
      }

      const daoRole = membership.role || 'member';

      // 1. Check explicit allowed roles if provided
      if (options.allowedRoles && !options.allowedRoles.includes(daoRole)) {
        logger.warn('User lacks required role for DAO', {
          userId,
          daoId,
          daoRole,
          required: options.allowedRoles,
        });
        return next(new AppError('DAO role permission denied for this operation', 403));
      }

      // 2. Check minimum role hierarchy if provided
      if (options.minRole) {
        const userRank = ROLE_HIERARCHY[daoRole] ?? 0;
        const requiredRank = ROLE_HIERARCHY[options.minRole] ?? 0;

        if (userRank < requiredRank) {
          logger.warn('User role below minimum threshold', {
            userId,
            daoId,
            daoRole,
            minRole: options.minRole,
          });
          return next(
            new AppError(`DAO ${options.minRole} role or higher required`, 403)
          );
        }
      }

      // Store verified role on request context
      req.daoRole = daoRole;

      logger.info('DAO permission check passed', { userId, daoId, daoRole });
      next();
    } catch (error) {
      logger.error('DAO permission check failed unexpectedly', error);
      next(new AppError('DAO authorization check failed', 500));
    }
  };
}

/**
 * Pre-configured Middleware Exports
 */
export const requireDAOAdmin = requireDAOPermission({ minRole: 'admin' });
export const requireDAOMember = requireDAOPermission({ minRole: 'member' });