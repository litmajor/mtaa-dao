
import { Request, Response, NextFunction } from 'express';
import { db } from '../storage';
import { users, daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError } from './errorHandler';

const logger = new Logger('rbac-middleware');

export interface UserPermissions {
  canCreateDAO: boolean;
  canManageUsers: boolean;
  canAccessAnalytics: boolean;
  canManageBilling: boolean;
  canExecuteProposals: boolean;
  canManageVaults: boolean;
}

// Role hierarchy and permissions
/**
 * Global role permissions. If a role is missing, fallback to 'user'.
 */
const ROLE_PERMISSIONS: Record<string, UserPermissions> = {
  super_admin: {
    canCreateDAO: true,
    canManageUsers: true,
    canAccessAnalytics: true,
    canManageBilling: true,
    canExecuteProposals: true,
    canManageVaults: true,
  },
  admin: {
    canCreateDAO: true,
    canManageUsers: true,
    canAccessAnalytics: true,
    canManageBilling: false,
    canExecuteProposals: true,
    canManageVaults: true,
  },
  moderator: {
    canCreateDAO: true,
    canManageUsers: false,
    canAccessAnalytics: true,
    canManageBilling: false,
    canExecuteProposals: false,
    canManageVaults: false,
  },
  user: {
    canCreateDAO: false,
    canManageUsers: false,
    canAccessAnalytics: false,
    canManageBilling: false,
    canExecuteProposals: false,
    canManageVaults: false,
  },
};

// DAO-specific role permissions
/**
 * DAO-specific role permissions. If a role is missing, fallback to 'member'.
 */
const DAO_ROLE_PERMISSIONS: Record<string, UserPermissions> = {
  owner: {
    canCreateDAO: false,
    canManageUsers: true,
    canAccessAnalytics: true,
    canManageBilling: true,
    canExecuteProposals: true,
    canManageVaults: true,
  },
  admin: {
    canCreateDAO: false,
    canManageUsers: true,
    canAccessAnalytics: true,
    canManageBilling: false,
    canExecuteProposals: true,
    canManageVaults: true,
  },
  member: {
    canCreateDAO: false,
    canManageUsers: false,
    canAccessAnalytics: false,
    canManageBilling: false,
    canExecuteProposals: false,
    canManageVaults: false,
  },
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userPermissions?: UserPermissions;
      userRole?: string;
      daoRole?: string;
    }
  }
}

// Middleware to check global role permissions
export const requireRole = (...allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      // Get user role
      const userResult = await db
        .select({ role: users.roles })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userResult.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        });
      }

      const userRoleRaw = userResult[0].role;
      const userRole: string = userRoleRaw === null ? 'user' : userRoleRaw;
      req.userRole = userRole;

      if (!allowedRoles.includes(userRole)) {
        logger.warn('Access denied - insufficient role', { 
          userId, 
          userRole, 
          requiredRoles: allowedRoles 
        });
        return res.status(403).json({
          success: false,
          error: { message: 'Insufficient permissions' },
        });
      }

      // Add user permissions to request, with explicit fallback and logging
      if (!ROLE_PERMISSIONS[userRole]) {
        logger.warn('Undefined global role, falling back to user', { userId, userRole });
      }
      req.userPermissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.user;

      next();
    } catch (error) {
      logger.error('Role check failed', error);
      next(new AppError('Authorization check failed', 500));
    }
  };
};

// Middleware to check DAO-specific permissions
function mergePermissions(global: UserPermissions = ROLE_PERMISSIONS.user, dao: UserPermissions = DAO_ROLE_PERMISSIONS.member): UserPermissions {
  return {
    ...global,
    ...dao,
  };
}

export const requireDAORole = (...allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
      const daoId = req.params.daoId;

      if (!userId || !daoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID and DAO ID required' },
        });
      }

      // Check DAO membership and role
      const membershipResult = await db
        .select({ role: daoMemberships.role })
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.daoId, daoId)
        ))
        .limit(1);

      if (membershipResult.length === 0) {
        logger.warn('Missing DAO membership, falling back to global permissions', { userId, daoId });
        return res.status(403).json({
          success: false,
          error: { message: 'Not a member of this DAO' },
        });
      }

      const daoRoleRaw = membershipResult[0].role;
      const daoRole: string = daoRoleRaw === null ? 'member' : daoRoleRaw;
      req.daoRole = daoRole;

      if (!allowedRoles.includes(daoRole)) {
        logger.warn('Access denied - insufficient DAO role', { 
          userId, 
          daoId, 
          daoRole, 
          requiredRoles: allowedRoles 
        });
        return res.status(403).json({
          success: false,
          error: { message: 'Insufficient DAO permissions' },
        });
      }

      // Add DAO permissions to request, with explicit fallback and logging
      if (!DAO_ROLE_PERMISSIONS[daoRole]) {
        logger.warn('Undefined DAO role, falling back to member', { userId, daoId, daoRole });
      }
      const daoPermissions = DAO_ROLE_PERMISSIONS[daoRole] || DAO_ROLE_PERMISSIONS.member;
      req.userPermissions = mergePermissions(req.userPermissions, daoPermissions);

      next();
    } catch (error) {
      logger.error('DAO role check failed', error);
      next(new AppError('DAO authorization check failed', 500));
    }
  };
}

// Middleware to check specific permissions
export const requirePermission = (permission: keyof UserPermissions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userPermissions || !req.userPermissions[permission]) {
      logger.warn('Access denied - missing permission', { 
        userId: (req as any).user?.userId,
        permission,
        userPermissions: req.userPermissions,
      });
      return res.status(403).json({
        success: false,
        error: { message: `Permission required: ${permission}` },
      });
    }

    next();
  };
};

// Helper function to get user permissions
export const getUserPermissions = async (userId: string, daoId?: string): Promise<UserPermissions> => {
  try {
    // Get global role
    const userResult = await db
      .select({ role: users.roles })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const globalRole = userResult[0]?.role || 'user';
    if (!ROLE_PERMISSIONS[globalRole]) {
      logger.warn('Undefined global role in getUserPermissions, falling back to user', { userId, globalRole });
    }
    let permissions = ROLE_PERMISSIONS[globalRole] || ROLE_PERMISSIONS.user;

    // If DAO context, merge DAO permissions
    if (daoId) {
      const membershipResult = await db
        .select({ role: daoMemberships.role })
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.daoId, daoId)
        ))
        .limit(1);

      if (membershipResult.length > 0) {
        const daoRoleRaw = membershipResult[0].role;
        const daoRole: string = daoRoleRaw === null ? 'member' : daoRoleRaw;
        if (!DAO_ROLE_PERMISSIONS[daoRole]) {
          logger.warn('Undefined DAO role in getUserPermissions, falling back to member', { userId, daoId, daoRole });
        }
        const daoPermissions = DAO_ROLE_PERMISSIONS[daoRole] || DAO_ROLE_PERMISSIONS.member;
        // Merge permissions (DAO permissions override global for DAO context)
        permissions = mergePermissions(permissions, daoPermissions);
      } else {
        logger.warn('Missing DAO membership in getUserPermissions, using global permissions', { userId, daoId });
      }
    }

    return permissions;
  } catch (error) {
    logger.error('Failed to get user permissions', error);
    return ROLE_PERMISSIONS.user;
  }
};

/**
 * Permission Merging Documentation:
 * - If a user is not a member of the DAO, requireDAORole fails with a 403, but getUserPermissions falls back to global permissions.
 * - If a role is not defined in ROLE_PERMISSIONS or DAO_ROLE_PERMISSIONS, the code logs a warning and falls back to 'user' or 'member' permissions, respectively.
 * - In a DAO context, DAO permissions override global permissions for overlapping keys. This is intentional and ensures DAO-level control, but may result in a user losing some global privileges while acting within a DAO.
 * - To change this precedence, modify the mergePermissions() helper.
 */
