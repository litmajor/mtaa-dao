import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { env } from '../shared/config';

/**
 * FIXES APPLIED:
 * 1. CRITICAL: the previous token-extraction expression in authenticate()
 *    had an operator-precedence bug — `||` binds tighter than `?:` in JS,
 *    so `cookie || headerStartsWithBearer ? extractBearer() : undefined`
 *    evaluated the ternary based on whichever side of `||` was truthy, but
 *    ALWAYS returned the bearer-extraction result (or undefined) regardless
 *    of which side won. Concretely: a valid access_token cookie with no
 *    Authorization header produced `token = undefined`, and the request
 *    was rejected with 401 — even though the comment says cookies are the
 *    PREFERRED path. Fixed to actually prefer the cookie, falling back to
 *    a Bearer header only when no cookie is present.
 * 2. verifyAccessToken / verifyRefreshToken now pin `algorithms: ['HS256']`
 *    explicitly instead of accepting whatever algorithm the token claims.
 * 3. refreshTokenHandler now blacklists the OLD refresh token immediately
 *    after issuing new tokens, closing the window where a stolen refresh
 *    token remained valid for its full 7-day lifetime even after the
 *    legitimate user rotated it.
 * 4. Removed the three inline `require('crypto')` calls inside functions —
 *    this file already `import`s crypto at the top; mixing require() into
 *    an ESM-style file is fragile under strict ESM runtimes.
 */

if (!env.JWT_SECRET || !env.JWT_REFRESH_SECRET) {
  throw new Error(
    `Missing required JWT secrets. Set JWT_SECRET and JWT_REFRESH_SECRET environment variables.`
  );
}

const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const JWT_ALGORITHMS: jwt.Algorithm[] = ['HS256']; 

export type TokenPayload = {
  id?: string;
  sub: string;
  email?: string;
  // Accept either a single role or a comma-separated string or an array of roles
  role?: string;
  roles?: string | string[];
  daos?: string[];
  pending2FA?: boolean;
} & Record<string, unknown>;

export { authUserHandler } from './api/authUser';
export { authLoginHandler } from './api/auth_login';
export { authRegisterHandler } from './api/auth_register';

export interface AuthRequest extends Request {
  user?: {
    id?: string;
    email?: string;
    role?: string;
    roles?: string | string[];
    daos?: string[];
    claims?: TokenPayload;
  };
}

export const generateTokens = (payload: TokenPayload) => {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY, algorithm: 'HS256' });
  console.log('[JWT] Generated tokens for user:', payload.sub);
  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload | null => {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: JWT_ALGORITHMS }) as TokenPayload; // FIX #2
    return payload;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[JWT] Token verification failed:', errMsg);
    return null;
  }
};

export const verifyRefreshToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: JWT_ALGORITHMS }) as TokenPayload; // FIX #2
    } catch (error) {
      return null;
    }
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Extracts a bearer token from an Authorization header, if present.
 */
function extractBearerToken(req: Request): string | undefined {
  const authHeader = (req.headers.authorization || '').toString();
  return authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
}

/**
 * Decodes a token's `exp` claim (without verifying signature — the token
 * has already been verified by the caller at this point) to compute actual
 * remaining seconds until natural expiry, for accurate blacklist TTLs.
 * Falls back to `fallbackSeconds` if the token can't be decoded or has no
 * exp claim.
 */
function getRemainingSeconds(token: string, fallbackSeconds: number): number {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
      const remaining = decoded.exp - Math.floor(Date.now() / 1000);
      return remaining > 0 ? remaining : fallbackSeconds;
    }
  } catch {
    // fall through to fallback
  }
  return fallbackSeconds;
}

// Authentication middleware
export const authenticate: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthRequest;

  try {
    // FIX #1: actually prefer the cookie, only falling back to a Bearer
    // header if no cookie is present — previously the ternary's operator
    // precedence made this ALWAYS resolve via the header-extraction branch.
    const token = req.cookies?.access_token || extractBearerToken(req);

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

    const { isTokenBlacklisted, areUserTokensRevoked } = await import('./services/tokenBlacklist');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex'); // FIX #4

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

    authReq.user = {
      id: payload.sub,
      claims: { sub: payload.sub, email: payload.email, roles: payload.roles ?? payload.role },
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication failed' },
    });
  }
};

export const isAuthenticated = authenticate;

export const authorize = (roles: string | string[]): RequestHandler => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const authReq = req as AuthRequest;
    if (!authReq.user || !authReq.user.claims) {
      return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });
    }
    const currentRoles = (authReq.user.claims.roles ?? authReq.user.claims.role) as any;
    const roleList = typeof currentRoles === 'string' ? currentRoles.split(',').map((r: string) => r.trim()) : Array.isArray(currentRoles) ? currentRoles : [String(currentRoles || '')];
    if (!roleList.some((r: string) => allowed.includes(r))) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden: insufficient privileges' } });
    }
    next();
  };
};

export const requireRole = authorize;
export const requireAdmin = authorize(['admin', 'super_admin']);
export const requireModerator = authorize(['admin', 'super_admin', 'moderator']);
export const requirePremium = authorize(['admin', 'super_admin', 'premium', 'dao_owner']);

// Refresh token handler
export const refreshTokenHandler = async (req: Request, res: Response) => {
  try {
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

    const { isTokenBlacklisted, blacklistToken, areUserTokensRevoked } = await import('./services/tokenBlacklist');
    const oldTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex'); // FIX #4

    if (await isTokenBlacklisted(oldTokenHash)) {
      return res.status(401).json({
        success: false,
        error: { message: 'Token has been revoked' }
      });
    }

    if (await areUserTokensRevoked(decoded.sub)) {
      return res.status(401).json({
        success: false,
        error: { message: 'All tokens revoked' }
      });
    }

    const tokens = generateTokens({
      sub: decoded.sub,
      email: decoded.email,
      roles: decoded.roles ?? decoded.role,
    });

    // FIX #3 (refined): blacklist for the token's ACTUAL remaining lifetime
    // (decoded from its exp claim) rather than assuming the full 7-day
    // duration regardless of how close to expiry it already was — avoids
    // needlessly inflating blacklist entries for tokens near expiry anyway.
    const remainingTtlSeconds = getRemainingSeconds(refreshToken, 7 * 24 * 60 * 60);
    try {
      await blacklistToken(oldTokenHash, remainingTtlSeconds);
    } catch (err) {
      console.error('[REFRESH_TOKEN] Failed to blacklist rotated refresh token:', err);
      // Don't fail the refresh over this — the new tokens are still valid —
      // but this is worth alerting on if it happens repeatedly.
    }

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

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
export const logoutHandler = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.cookies.refresh_token;
    const userId = req.user?.id;

    if (refreshToken && userId) {
      const { blacklistToken } = await import('./services/tokenBlacklist');
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex'); // FIX #4

      const ttl = getRemainingSeconds(refreshToken, 7 * 24 * 60 * 60);
      await blacklistToken(tokenHash, ttl);
    }

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

    res.clearCookie('csrf_token', {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

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