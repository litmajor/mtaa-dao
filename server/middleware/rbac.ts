
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
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userResult.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        });
      }

      const userRole = userResult[0].role;
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

      // Add user permissions to request
      req.userPermissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.user;

      next();
    } catch (error) {
      logger.error('Role check failed', error);
      next(new AppError('Authorization check failed', 500));
    }
  };
};

// Middleware to check DAO-specific permissions
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
        return res.status(403).json({
          success: false,
          error: { message: 'Not a member of this DAO' },
        });
      }

      const daoRole = membershipResult[0].role;
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

      // Add DAO permissions to request
      const daoPermissions = DAO_ROLE_PERMISSIONS[daoRole] || DAO_ROLE_PERMISSIONS.member;
      req.userPermissions = {
        ...req.userPermissions,
        ...daoPermissions,
      };

      next();
    } catch (error) {
      logger.error('DAO role check failed', error);
      next(new AppError('DAO authorization check failed', 500));
    }
  };
};

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
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const globalRole = userResult[0]?.role || 'user';
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
        const daoRole = membershipResult[0].role;
        const daoPermissions = DAO_ROLE_PERMISSIONS[daoRole] || DAO_ROLE_PERMISSIONS.member;
        
        // Merge permissions (DAO permissions override global for DAO context)
        permissions = {
          ...permissions,
          ...daoPermissions,
        };
      }
    }

    return permissions;
  } catch (error) {
    logger.error('Failed to get user permissions', error);
    return ROLE_PERMISSIONS.user;
  }
};
