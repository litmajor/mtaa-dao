import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// Validate JWT secrets are set
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error(
    `Missing required JWT secrets. Set JWT_SECRET and JWT_REFRESH_SECRET environment variables.`
  );
}

// Use environment variables ONLY - no hardcoded fallbacks
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface TokenPayload {
  id?: string;
  sub: string;
  email?: string;
  role?: string;
}

// Import or define UserClaims type
import type { UserClaims } from './nextAuthMiddleware'; // adjust path if needed

// Re-export handler functions from their respective files
export { authUserHandler } from './api/authUser';
export { authLoginHandler } from './api/auth_login';
export { authRegisterHandler } from './api/auth_register';

export interface AuthRequest extends Request {
  user?: { 
    id: string;
    claims: TokenPayload;
  };
}

// Generate access and refresh tokens
export const generateTokens = (payload: TokenPayload) => {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  console.log('[JWT] Generated tokens for user:', payload.sub);
  return { accessToken, refreshToken };
};

// Verify access token
export const verifyAccessToken = (token: string): TokenPayload | null => {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return payload;
  } catch (error) {
    console.error('[JWT] Token verification failed:', (error as any).message);
    return null;
  }
};

// Verify refresh token
export const verifyRefreshToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
};

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

// Verify password
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Authentication middleware
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Prefer cookie-based tokens (httpOnly), but allow bearer header for backward compatibility
    const token =
      req.cookies?.access_token ||
      (req.headers.authorization || '').toString().startsWith('Bearer ')
        ? (req.headers.authorization || '').toString().split(' ')[1]
        : undefined;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'No token provided' },
      });
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid or expired token' },
      });
    }

    // Check if token has been revoked via blacklist
    const { isTokenBlacklisted, areUserTokensRevoked } = await import('./services/tokenBlacklist');
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    if (await isTokenBlacklisted(tokenHash)) {
      return res.status(401).json({
        success: false,
        error: { message: 'Token has been revoked' },
      });
    }

    if (await areUserTokensRevoked(payload.sub)) {
      return res.status(401).json({
        success: false,
        error: { message: 'All tokens revoked' },
      });
    }

    // CSRF protection (double submit token)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrfHeader = (req.headers['x-csrf-token'] as string) || '';
      const csrfCookie = req.cookies?.csrf_token;
      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        return res.status(403).json({
          success: false,
          error: { message: 'Invalid CSRF token' },
        });
      }
    }

    req.user = {
      id: payload.sub,
      claims: { sub: payload.sub, email: payload.email, role: payload.role },
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication failed' },
    });
  }
};

// Alias for compatibility
export const isAuthenticated = authenticate;

// Authorization middleware factory
export const authorize = (roles: string | string[]) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.claims) {
      return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });
    }
    const role = req.user.claims.role || '';
    if (!allowed.includes(role)) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden: insufficient privileges' } });
    }
    next();
  };
};

// Refresh token handler
export const refreshTokenHandler = async (req: Request, res: Response) => {
  try {
    // CSRF protection for token refresh
    const csrfHeader = (req.headers['x-csrf-token'] as string) || '';
    const csrfCookie = req.cookies?.csrf_token;
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({
        success: false,
        error: { message: 'Invalid CSRF token' },
      });
    }

    const refreshToken = req.cookies.refreshToken || req.cookies.refresh_token || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ 
        success: false,
        error: { message: 'Refresh token required' }
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json({ 
        success: false,
        error: { message: 'Invalid refresh token' }
      });
    }

    // Check if token is blacklisted (from logout/revocation)
    const { isTokenBlacklisted } = await import('./services/tokenBlacklist');
    const tokenHash = require('crypto').createHash('sha256').update(refreshToken).digest('hex');
    
    if (await isTokenBlacklisted(tokenHash)) {
      return res.status(401).json({ 
        success: false,
        error: { message: 'Token has been revoked' }
      });
    }

    // Check if all user tokens are revoked (force logout)
    const { areUserTokensRevoked } = await import('./services/tokenBlacklist');
    if (await areUserTokensRevoked(decoded.sub)) {
      return res.status(401).json({ 
        success: false,
        error: { message: 'All tokens revoked' }
      });
    }

    // Generate new tokens
    const tokens = generateTokens({
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role
    });

    // Rotate refresh token - set new one as cookie (+ rotate in DB later)
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Rotate CSRF token too
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    // NO accessToken in response - already in httpOnly cookie
    res.json({ 
      success: true,
      data: { message: 'Token refreshed successfully', csrfToken }
    });
  } catch (error) {
    console.error('[REFRESH_TOKEN] Error:', error);
    res.status(500).json({ 
      success: false,
      error: { message: 'Token refresh failed' }
    });
  }
};

// Logout handler
export const logoutHandler = async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.cookies.refresh_token;
    const userId = req.user?.id;

    // Blacklist refresh token
    if (refreshToken && userId) {
      const { blacklistToken } = await import('./services/tokenBlacklist');
      const crypto = require('crypto');
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      
      // Calculate remaining TTL (7 days from now)
      const ttl = 7 * 24 * 60 * 60;
      await blacklistToken(tokenHash, ttl);
    }

    // Clear cookies
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    // Clear CSRF cookie
    res.clearCookie('csrf_token', {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    // Also clear old cookie names for backwards compatibility
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('[LOGOUT] Error:', error);
    res.status(500).json({ 
      success: false,
      error: { message: 'Logout failed' }
    });
  }
};