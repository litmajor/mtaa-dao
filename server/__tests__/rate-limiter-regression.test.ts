import { describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  createRateLimiter,
  defaultKeyGenerator,
  globalRateLimiter,
} from '../middleware/rateLimiting';

function buildRes(): Response {
  const res = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    set: vi.fn((key: string, value: string | number) => {
      res.headers[key] = String(value);
      return res;
    }),
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: any, payload?: unknown) {
      return this;
    }),
    send: vi.fn(function (this: any, payload?: unknown) {
      return this;
    }),
    end: vi.fn(function (this: any, payload?: unknown) {
      return this;
    }),
    sendFile: vi.fn(function (this: any, payload?: unknown) {
      return this;
    }),
  } as unknown as Response;

  return res;
}

describe('rate limiter regression coverage', () => {
  it('reuses a shared in-memory store across requests instead of re-instantiating on every hit', () => {
    const reqBase = {
      method: 'POST',
      path: '/api/auth/login',
      headers: {},
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    } as unknown as Request;

    for (let i = 0; i < 101; i += 1) {
      const req = { ...reqBase } as Request;
      const res = buildRes();
      const next = vi.fn() as NextFunction;

      globalRateLimiter(req, res, next);

      if (i < 100) {
        expect(next).toHaveBeenCalledTimes(1);
      } else {
        expect(res.status).toHaveBeenCalledWith(429);
        expect(next).not.toHaveBeenCalled();
      }
    }
  });

  it('does not double count successful requests when skipSuccessfulRequests is enabled', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      skipSuccessfulRequests: true,
      keyGenerator: () => 'skip-success-case',
    });

    const req = {
      method: 'POST',
      path: '/api/auth/login',
      headers: {},
      ip: '203.0.113.22',
      socket: { remoteAddress: '203.0.113.22' },
    } as Request;

    const firstRes = buildRes();
    const firstNext = vi.fn() as NextFunction;
    limiter(req, firstRes, firstNext);

    expect(firstNext).toHaveBeenCalledTimes(1);
    firstRes.statusCode = 200;
    (firstRes.send as any)('ok');

    const secondRes = buildRes();
    const secondNext = vi.fn() as NextFunction;
    limiter(req, secondRes, secondNext);

    expect(secondNext).toHaveBeenCalledTimes(1);
    expect(secondRes.status).not.toHaveBeenCalledWith(429);
  });

  it('prefers x-forwarded-for when generating the client key', () => {
    const req = {
      headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' },
      ip: '203.0.113.8',
      socket: { remoteAddress: '203.0.113.8' },
    } as unknown as Request;

    expect(defaultKeyGenerator(req)).toBe('198.51.100.9');
  });
});
