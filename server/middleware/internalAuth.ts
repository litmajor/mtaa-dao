import { Request, Response, NextFunction } from 'express';

/**
 * Internal Auth Middleware
 * Expects header: Authorization: Bearer internal_<TOKEN>
 * Where the full token must match process.env.INTERNAL_API_TOKEN
 */
export default function internalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req.headers.authorization || '').toString();
    if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = auth.slice(7);
    if (!token.startsWith('internal_')) return res.status(401).json({ error: 'Unauthorized' });

    const expected = process.env.INTERNAL_API_TOKEN || '';
    if (!expected || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    (req as any).internal = true;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
