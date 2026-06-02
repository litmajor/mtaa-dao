import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

function parseAllowlist(env?: string) {
  if (!env) return [];
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

function ipFromRequest(req: Request) {
  const xf = (req.headers['x-forwarded-for'] as string) || '';
  if (xf) return xf.split(',')[0].trim();
  return req.ip;
}

export function metricsAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const ipAllowlist = parseAllowlist(process.env.METRICS_IP_ALLOWLIST);
    const clientIp = ipFromRequest(req);

    // If allowlist provided and client IP matches, allow immediately
    if (ipAllowlist.length > 0 && ipAllowlist.includes(clientIp)) {
      return next();
    }

    // Validate token: support Authorization Bearer, x-metrics-token header, or cookie named metrics_token
    const headerAuth = (req.headers.authorization || '') as string;
    const bearer = headerAuth.startsWith('Bearer ') ? headerAuth.split(' ')[1] : undefined;
    const headerToken = (req.headers['x-metrics-token'] as string) || undefined;
    const cookieToken = (req.cookies && (req.cookies.metrics_token || req.cookies.metricsToken)) || undefined;

    const expected = process.env.METRICS_AUTH_TOKEN || process.env.METRICS_COOKIE_TOKEN || '';

    if (!expected) {
      // No auth configured — deny by default
      return res.status(401).send('Metrics auth not configured');
    }

    const received = bearer || headerToken || cookieToken || '';

    // timing-safe compare
    const expBuf = Buffer.from(expected);
    const recBuf = Buffer.from(received);
    if (expBuf.length === 0 || recBuf.length === 0) {
      return res.status(401).send('Unauthorized');
    }

    if (expBuf.length !== recBuf.length) {
      return res.status(401).send('Unauthorized');
    }

    if (!crypto.timingSafeEqual(expBuf, recBuf)) {
      return res.status(401).send('Unauthorized');
    }

    return next();
  } catch (err) {
    console.error('metricsAuth error', err);
    return res.status(500).send('Metrics auth error');
  }
}

export default metricsAuth;
