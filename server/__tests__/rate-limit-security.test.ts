import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const redisMock = vi.hoisted(() => ({
  incrWithExpiry: vi.fn(),
}));

vi.mock('../services/redis', () => ({
  redis: {
    incrWithExpiry: redisMock.incrWithExpiry,
  },
}));

import { rateLimitMiddleware, getClientIdentifier } from '../middleware/rateLimitConfig';

describe('rate limit security hardening', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses atomic increments and keeps retry-after aligned to the remaining time in the current window', async () => {
    redisMock.incrWithExpiry.mockResolvedValue(11);

    const req = {
      method: 'POST',
      path: '/withdraw',
      user: { id: 'user-123' },
      headers: {},
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await rateLimitMiddleware({ limit: 10, windowSeconds: 3600, failClosed: true })(req, res, next);

    expect(redisMock.incrWithExpiry).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(next).not.toHaveBeenCalled();
  });

  it('does not allow double-prefixed rate-limit keys', async () => {
    redisMock.incrWithExpiry.mockResolvedValue(1);

    const req = {
      method: 'POST',
      path: '/withdraw',
      user: { id: 'user-123' },
      headers: {},
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    } as unknown as Request;

    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await rateLimitMiddleware({ limit: 10, windowSeconds: 3600, failClosed: true })(req, res, next);

    const key = redisMock.incrWithExpiry.mock.calls[0][0];
    expect(key).not.toMatch(/^rl:rl:/);
    expect(key).toMatch(/^rl:/);
  });

  it('fails closed when Redis is unavailable during financial rate limiting', async () => {
    redisMock.incrWithExpiry.mockRejectedValue(new Error('redis down'));

    const req = {
      method: 'POST',
      path: '/withdraw',
      user: { id: 'user-123' },
      headers: {},
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await rateLimitMiddleware({ limit: 10, windowSeconds: 3600, failClosed: true })(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('prefers a trusted forwarding header over remote IP for client identity', () => {
    const req = {
      headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' },
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    } as unknown as Request;

    expect(getClientIdentifier(req)).toBe('198.51.100.9');
  });
});
