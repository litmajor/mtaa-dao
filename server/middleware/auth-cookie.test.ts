import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../auth', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('../services/tokenBlacklist', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
  areUserTokensRevoked: vi.fn().mockResolvedValue(false),
}));

import { verifyAccessToken } from '../auth';
import { authenticateToken } from './auth';

const verifyTokenMock = vi.mocked(verifyAccessToken);

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('authenticateToken cookie support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyTokenMock.mockReturnValue({
      sub: 'user-1',
      email: 'user@example.test',
      role: 'member',
      roles: ['member'],
      daos: [],
    });
  });

  it('authenticates with the access_token cookie when no Authorization header exists', async () => {
    const req = {
      headers: {},
      cookies: { access_token: 'cookie-token' },
      method: 'GET',
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await authenticateToken(req, res, next);

    expect(verifyTokenMock).toHaveBeenCalledWith('cookie-token');
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not fall back to a cookie when an Authorization header is present but invalid', async () => {
    verifyTokenMock.mockReturnValue(null);
    const req = {
      headers: { authorization: 'Bearer invalid-token' },
      cookies: { access_token: 'cookie-token' },
      method: 'GET',
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await authenticateToken(req, res, next);

    expect(verifyTokenMock).toHaveBeenCalledWith('invalid-token');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requires a CSRF token for cookie-authenticated state-changing requests', async () => {
    const req = {
      headers: {},
      cookies: { access_token: 'cookie-token' },
      method: 'POST',
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid CSRF token',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
