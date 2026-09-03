import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Express Request type definitions globally
declare global {
  namespace Express {
    interface Request {
      internal?: boolean;
    }
  }
}

/**
 * Internal Auth Middleware
 * Expects header: Authorization: Bearer internal_<TOKEN>
 * Uses timing-safe hash comparison to protect against side-channel attacks.
 */
export default function internalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const expected = process.env.INTERNAL_API_TOKEN;

    // Configuration Guard: Fail-closed if server environment is unconfigured
    if (!expected) {
      console.error('[SECURITY CRITICAL] INTERNAL_API_TOKEN environment variable is missing.');
      return res.status(500).json({ error: 'Internal server configuration error' });
    }

    const authHeader = req.headers.authorization;
    const auth = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = auth.slice(7);

    if (!token.startsWith('internal_')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Hash both tokens to fixed-length buffers before constant-time comparison
    const tokenHash = crypto.createHash('sha256').update(token).digest();
    const expectedHash = crypto.createHash('sha256').update(expected).digest();

    if (!crypto.timingSafeEqual(tokenHash, expectedHash)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.internal = true;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}