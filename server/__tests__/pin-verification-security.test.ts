import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

import { checkAmountThreshold, optionalPINVerification } from '../middleware/pin-verification';
import * as walletSessionService from '../services/wallet-session-service';
import * as requestUser from '../utils/requestUser';

describe('PIN verification security hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.PIN_LARGE_TRANSFER_MAX_AGE_MS;
  });

  it('rejects optional PIN sessions when the authenticated user does not match the token owner', async () => {
    vi.spyOn(walletSessionService, 'verifySessionToken').mockResolvedValue({
      valid: true,
      userId: 'other-user',
      walletId: 'wallet-2',
    });
    vi.spyOn(requestUser, 'getRequestUserId').mockReturnValue('current-user');

    const req = {
      headers: { 'x-wallet-session': 'token-123' },
      user: { id: 'current-user' },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await optionalPINVerification(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.walletSession).toBeUndefined();
  });

  it('fails closed when amount parsing throws instead of continuing the request', () => {
    const req = {
      body: {},
      walletSession: {
        valid: true,
        userId: 'user-1',
        walletId: 'wallet-1',
        connectedAt: new Date(Date.now() - 60_000),
      },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    Object.defineProperty(req.body, 'amount', {
      get: () => {
        throw new Error('invalid amount');
      },
      configurable: true,
    });

    checkAmountThreshold('1000')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects malformed amount input instead of silently skipping the threshold check', () => {
    const req = {
      body: { amount: 'abc' },
      walletSession: {
        valid: true,
        userId: 'user-1',
        walletId: 'wallet-1',
        connectedAt: new Date(),
      },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    checkAmountThreshold('1000')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('handles serialized timestamp strings without crashing and enforces recent PIN freshness', () => {
    const req = {
      body: { amount: '2000' },
      walletSession: {
        valid: true,
        userId: 'user-1',
        walletId: 'wallet-1',
        connectedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    expect(() => checkAmountThreshold('1000')(req, res, next)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
