/**
 * Authentication and Authorization Middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    // role strings are stored in users.roles column; global admin value is 'super_admin'
    role: 'super_admin' | 'dao-admin' | 'member' | 'guest';
    daos: string[];
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
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret) as any;
    req.user = decoded;
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
  if (req.user?.role !== 'super_admin') {
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
  if (!req.user || req.user.daos.length === 0) {
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
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'dao-admin') {
    return res.status(403).json({
      success: false,
      error: 'DAO admin access required'
    });
  }
  next();
};
