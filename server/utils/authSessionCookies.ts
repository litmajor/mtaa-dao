import { randomBytes } from 'node:crypto';
import type { Response } from 'express';

export interface AuthSessionTokens {
  accessToken: string;
  refreshToken: string;
}

export function setAuthSessionCookies(res: Response, tokens: AuthSessionTokens): string {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = 'strict' as const;
  const csrfToken = randomBytes(32).toString('hex');

  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  return csrfToken;
}
