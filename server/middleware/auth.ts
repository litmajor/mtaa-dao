/**
 * Authentication and Authorization Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, type TokenPayload } from '../auth';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    // roles can be a single string or comma-separated string or array
    role?: string;
    roles?: string | string[];
    daos?: string[];
  };
}


/**
 * Authenticate JWT token
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  try {
    const payload = verifyAccessToken(token);
    if (!payload) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    // Reject temporary tokens issued for 2FA challenge flow
    if (payload.pending2FA === true) {
      return res.status(403).json({ success: false, error: 'Two-factor authentication pending' });
    }

    const userClaims: TokenPayload = payload;
    req.user = {
      id: userClaims.sub,
      email: userClaims.email,
      role: userClaims.role,
      roles: userClaims.roles,
      daos: userClaims.daos ?? [],
    };

    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

/**
 * Check if user is superuser
 */
// still named isSuperUser for backwards compatibility but checks for super_admin
export const isSuperUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  const roles = Array.isArray(req.user?.roles) ? req.user!.roles : (typeof req.user?.roles === 'string' ? (req.user!.roles as string).split(',').map(r => r.trim()) : req.user?.role ? [req.user.role] : []);
  if (!roles.includes('super_admin')) {
    return res.status(403).json({
      success: false,
      error: 'Super-admin access required'
    });
  }
  next();
};

/**
 * Check if user is DAO member
 */
export const isDaoMember = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !(req.user.daos && req.user.daos.length > 0)) {
    return res.status(403).json({
      success: false,
      error: 'DAO membership required'
    });
  }
  next();
};

/**
 * Check if user is DAO admin
 */
export const isDaoAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  const roles = Array.isArray(req.user?.roles) ? req.user!.roles : (typeof req.user?.roles === 'string' ? (req.user!.roles as string).split(',').map(r => r.trim()) : req.user?.role ? [req.user.role] : []);
  if (!roles.includes('super_admin') && !roles.includes('dao-admin')) {
    return res.status(403).json({
      success: false,
      error: 'DAO admin access required'
    });
  }
  next();
};
