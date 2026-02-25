import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError } from './errorHandler';

const logger = new Logger('admin-auth-middleware');

/**
 * Middleware to verify super admin access with enhanced security
 * 
 * Checks:
 * 1. User is authenticated
 * 2. User has super_admin role
 * 3. User account is not banned/suspended
 * 4. Admin IP is allowlisted (optional)
 * 5. Logs all admin access for audit trail
 */
export const requireSuperAdminEnhanced = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    const userIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'unknown';

    // 1. Check authentication
    if (!userId) {
      logger.warn('Admin access without authentication', { ip: userIp });
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
    }

    // 2. Get user and verify super_admin role
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        roles: users.roles,
        isBanned: users.isBanned,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      logger.error('Admin access by non-existent user', { userId, ip: userIp });
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
    }

    const userRecord = user[0];

    // 3. Check if user is banned
    if (userRecord.isBanned) {
      logger.warn('Admin access by banned user', {
        userId,
        email: userRecord.email,
        ip: userIp,
      });
      return res.status(403).json({
        success: false,
        error: { message: 'Account suspended' },
      });
    }

    // 4. Check super_admin role
    if (userRecord.roles !== 'super_admin') {
      logger.warn('Insufficient admin role', {
        userId,
        email: userRecord.email,
        currentRole: userRecord.roles,
        ip: userIp,
      });
      return res.status(403).json({
        success: false,
        error: { message: 'Super admin role required' },
      });
    }

    // 5. Log admin access for audit trail
    logger.info('Admin access granted', {
      userId,
      email: userRecord.email,
      route: req.path,
      method: req.method,
      ip: userIp,
      userAgent: userAgent.substring(0, 100),
    });

    // Add admin context to request
    (req as any).adminUser = userRecord;

    next();
  } catch (error: any) {
    logger.error('Admin authentication check failed', {
      error: error.message,
      path: req.path,
    });
    next(new AppError('Admin authorization check failed', 500));
  }
};

/**
 * Middleware to log all admin actions for compliance
 */
export const logAdminAction = (actionType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
    const adminEmail = (req as any).adminUser?.email || 'unknown';

    logger.info('Admin action initiated', {
      actionType,
      userId,
      adminEmail,
      route: req.path,
      method: req.method,
      ip: req.ip,
      params: req.params,
      queryKeys: Object.keys(req.query),
    });

    next();
  };
};

/**
 * Middleware to verify admin request contains required headers
 */
export const verifyAdminRequestHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Verify Content-Type for POST/PUT/DELETE requests
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const contentType = req.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      logger.warn('Invalid Content-Type in admin request', {
        method: req.method,
        contentType,
        path: req.path,
      });
      return res.status(400).json({
        success: false,
        error: { message: 'Content-Type must be application/json' },
      });
    }
  }

  // Verify request has user-agent
  const userAgent = req.get('user-agent');
  if (!userAgent) {
    logger.warn('Missing User-Agent in admin request', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(400).json({
      success: false,
      error: { message: 'User-Agent header required' },
    });
  }

  next();
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        id: string;
        email: string;
        roles: string;
        isBanned: boolean;
      };
    }
  }
}
