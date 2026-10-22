import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { PgDialect } from 'drizzle-orm/pg-core';

const { findUser, findWallet, logger } = vi.hoisted(() => ({
  findUser: vi.fn(),
  findWallet: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  db: {
    query: {
      users: { findFirst: findUser },
      wallets: { findFirst: findWallet },
    },
  },
}));

vi.mock('../utils/logger', () => ({
  Logger: {
    getLogger: () => logger,
  },
}));

import { requireConnectedWallet } from '../middleware/walletValidation';

describe('requireConnectedWallet', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    findUser.mockResolvedValue({ id: 'user-1', username: 'member' });
    findWallet.mockResolvedValue(undefined);
    req = {
      ip: '127.0.0.1',
      user: { id: 'user-1' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('rejects legacy walletAddress values without an active registered wallet', async () => {
    findUser.mockResolvedValue({
      id: 'user-1',
      username: 'member',
      walletAddress: '0xlegacy',
    });

    await requireConnectedWallet(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'NO_WALLET',
    }));
    expect(req.wallet).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('only queries active wallets and rejects when none are found', async () => {
    findWallet.mockResolvedValue(undefined);

    await requireConnectedWallet(req as Request, res as Response, next);

    const walletQuery = findWallet.mock.calls[0][0];
    const { sql, params } = new PgDialect().sqlToQuery(walletQuery.where);
    expect(sql).toContain('is_active');
    expect(params).toContain('user-1');
    expect(params).toContain(true);
    expect(findWallet).toHaveBeenCalledWith(expect.objectContaining({
      columns: { address: true },
      orderBy: expect.any(Array),
    }));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'NO_WALLET',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the address from the active registered wallet', async () => {
    findWallet.mockResolvedValue({ address: '0xregistered' });

    await requireConnectedWallet(req as Request, res as Response, next);

    expect(req.wallet).toEqual({
      address: '0xregistered',
      userId: 'user-1',
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns the existing validation error when the wallet lookup fails', async () => {
    findWallet.mockRejectedValue(new Error('database unavailable'));

    await requireConnectedWallet(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'WALLET_VALIDATION_ERROR',
    }));
    expect(logger.error).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
