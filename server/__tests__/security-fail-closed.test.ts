import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { redisStore, mockSelect, mockUpdate } = vi.hoisted(() => ({
  redisStore: {
    set: vi.fn(),
    exists: vi.fn(),
    delete: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    incrWithExpiry: vi.fn(),
  },
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../services/redis', () => ({
  redis: redisStore,
}));

vi.mock('../db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

import { rateLimiter } from '../middleware/rateLimiter';
import { isTokenBlacklisted } from '../services/tokenBlacklist';

describe('fail-closed security guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisStore.incrWithExpiry.mockReset();
    redisStore.exists.mockReset();
    redisStore.set.mockReset();
    redisStore.delete.mockReset();
    redisStore.incr.mockReset();
    redisStore.expire.mockReset();
    mockSelect.mockReset();
    mockUpdate.mockReset();
  });

  it('returns 503 and blocks the request when rate-limit state cannot be updated', async () => {
    redisStore.incrWithExpiry.mockRejectedValue(new Error('redis down'));

    const req = { ip: '1.2.3.4', body: {} } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    const middleware = rateLimiter({ windowMs: 60_000, max: 5 });
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the database as a revocation backstop when Redis has no record', async () => {
    redisStore.exists.mockResolvedValue(0);
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ tokenHash: 'abc123', revokedAt: new Date() }]),
    });

    const result = await isTokenBlacklisted('abc123');

    expect(result).toBe(true);
  });
});
