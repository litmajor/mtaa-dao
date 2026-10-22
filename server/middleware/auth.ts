/**
 * Authentication and Authorization Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { verifyAccessToken, type TokenPayload } from '../auth';


/**
 * Authenticate JWT token
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const bearerToken = typeof authHeader === 'string'
    ? authHeader.match(/^Bearer\s+(\S+)$/i)?.[1]
    : undefined;
  const token = authHeader
    ? bearerToken
    : (req.cookies as Record<string, unknown> | undefined)?.access_token;

  if (typeof token !== 'string' || token.length === 0) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  let payload: TokenPayload | null;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
  if (!payload) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }

  try {
    const { isTokenBlacklisted, areUserTokensRevoked } = await import('../services/tokenBlacklist');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (await isTokenBlacklisted(tokenHash)) {
      return res.status(403).json({ success: false, error: 'Token has been revoked' });
    }
    if (await areUserTokensRevoked(payload.sub)) {
      return res.status(403).json({ success: false, error: 'All tokens revoked' });
    }
  } catch (error) {
    return next(error);
  }

  if (!authHeader && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const csrfHeader = req.headers['x-csrf-token'];
    const csrfCookie = (req.cookies as Record<string, unknown> | undefined)?.csrf_token;
    if (
      typeof csrfHeader !== 'string'
      || typeof csrfCookie !== 'string'
      || csrfHeader !== csrfCookie
    ) {
      return res.status(403).json({ success: false, error: 'Invalid CSRF token' });
    }
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
};

/**
 * Check if user is superuser
 */
// still named isSuperUser for backwards compatibility but checks for super_admin
export const isSuperUser = (req: Request, res: Response, next: NextFunction) => {
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
export const isDaoMember = (req: Request, res: Response, next: NextFunction) => {
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
export const isDaoAdmin = (req: Request, res: Response, next: NextFunction) => {
  const roles = Array.isArray(req.user?.roles) ? req.user!.roles : (typeof req.user?.roles === 'string' ? (req.user!.roles as string).split(',').map(r => r.trim()) : req.user?.role ? [req.user.role] : []);
  if (!roles.includes('super_admin') && !roles.includes('dao-admin')) {
    return res.status(403).json({
      success: false,
      error: 'DAO admin access required'
    });
  }
  next();
};
