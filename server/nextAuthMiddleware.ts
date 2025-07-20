import type { RequestHandler } from "express";
import { getToken } from "next-auth/jwt";

declare global {
  namespace Express {
    interface UserClaims {
      sub: string;
    }
    interface Request {
      user?: { claims: UserClaims };
    }
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    // Get token from cookies (NextAuth default)
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Attach user info to req for downstream handlers
    if (!token.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = { claims: { sub: token.sub } };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
