import type { RequestHandler } from "express";
import { getToken } from "next-auth/jwt";
import { verifyAccessToken, type TokenPayload } from "./auth";
import { storage } from "./storage";

export interface UserClaims {
  sub: string; // JWT subject, always present
  roles?: string | string[];
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: { 
        id: string;
        claims: UserClaims;
      };
    }
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    // Try NextAuth token first
    let token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    let userClaims: UserClaims | null = null;

    if (token && token.sub) {
      const nextToken = token as Partial<TokenPayload>;
      userClaims = {
        sub: token.sub,
        email: token.email || undefined,
        roles: nextToken.roles ?? nextToken.role ?? undefined,
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
            roles: decoded.roles ?? decoded.role,
          };
        }
      }
    }

    if (!userClaims) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch user details if role is missing
    if (!userClaims.roles) {
      try {
        const user = await storage.getUser(userClaims.sub);
        if (user) {
          userClaims.roles = (user.roles as string) ?? (user as any).role ?? 'user';
        }
      } catch (error) {
        console.warn('Could not fetch user role:', error);
      }
    }

    req.user = { 
      id: userClaims.sub,
      claims: userClaims 
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const requireRole = (...allowedRoles: string[]): RequestHandler => {
  return (req, res, next) => {
    const currentRoles = req.user?.claims?.roles;
    if (!currentRoles) {
      return res.status(403).json({ message: "Access denied: No role assigned" });
    }

    // roles may be a comma-separated string or a single role
    const roleList = typeof currentRoles === 'string' ? currentRoles.split(',').map(r => r.trim()) : Array.isArray(currentRoles) ? currentRoles : [String(currentRoles)];

    if (!roleList.some(r => allowedRoles.includes(r))) {
      return res.status(403).json({ 
        message: "Access denied: Insufficient permissions",
        required: allowedRoles,
        current: currentRoles
      });
    }

    next();
  };
};

export const requireAdmin: RequestHandler = requireRole('admin', 'super_admin');
export const requireModerator: RequestHandler = requireRole('admin', 'super_admin', 'moderator');
export const requirePremium: RequestHandler = requireRole('admin', 'super_admin', 'premium', 'dao_owner');
