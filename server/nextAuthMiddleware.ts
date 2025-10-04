import type { RequestHandler } from "express";
import { getToken } from "next-auth/jwt";
import { verifyAccessToken } from "./auth";
import { storage } from "./storage";

export interface UserClaims {
  sub: string; // JWT subject, always present
  role?: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: { claims: UserClaims };
    }
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    // Try NextAuth token first
    let token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    let userClaims: UserClaims | null = null;

    if (token && token.sub) {
      userClaims = { 
        sub: token.sub, 
        email: token.email || undefined,
        role: (token as any).role || undefined 
      };
    } else {
      // Fallback to JWT token from Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwtToken = authHeader.substring(7);
        const decoded = verifyAccessToken(jwtToken);
        if (decoded) {
          userClaims = {
            sub: decoded.sub,
            email: decoded.email,
            role: decoded.role
          };
        }
      }
    }

    if (!userClaims) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch user details if role is missing
    if (!userClaims.role) {
      try {
        const user = await storage.getUser(userClaims.sub);
        if (user) {
          userClaims.role = user.role || 'user';
        }
      } catch (error) {
        console.warn('Could not fetch user role:', error);
      }
    }

    req.user = { claims: userClaims };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const requireRole = (...allowedRoles: string[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user?.claims?.role) {
      return res.status(403).json({ message: "Access denied: No role assigned" });
    }

    if (!allowedRoles.includes(req.user.claims.role)) {
      return res.status(403).json({ 
        message: "Access denied: Insufficient permissions",
        required: allowedRoles,
        current: req.user.claims.role
      });
    }

    next();
  };
};

export const requireAdmin: RequestHandler = requireRole('admin', 'super_admin');
export const requireModerator: RequestHandler = requireRole('admin', 'super_admin', 'moderator');
export const requirePremium: RequestHandler = requireRole('admin', 'super_admin', 'premium', 'dao_owner');
