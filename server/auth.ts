import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface TokenPayload {
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

  return { accessToken, refreshToken };
};

// Verify access token
export const verifyAccessToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
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
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: { message: 'No token provided' }
      });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    if (!payload) {
      return res.status(401).json({ 
        success: false,
        error: { message: 'Invalid or expired token' }
      });
    }

    req.user = { 
      id: payload.sub,
      claims: { sub: payload.sub, email: payload.email, role: payload.role } 
    };
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false,
      error: { message: 'Authentication failed' }
    });
  }
};

// Alias for compatibility
export const isAuthenticated = authenticate;

// Refresh token handler
export const refreshTokenHandler = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

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

    // Generate new tokens
    const tokens = generateTokens({
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role
    });

    // Set HTTP-only cookie for refresh token
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      success: true,
      data: { accessToken: tokens.accessToken }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: { message: 'Token refresh failed' }
    });
  }
};

// Logout handler
export const logoutHandler = async (req: Request, res: Response) => {
  try {
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
    res.status(500).json({ 
      success: false,
      error: { message: 'Logout failed' }
    });
  }
};