import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { getUserKYC } = vi.hoisted(() => ({
  getUserKYC: vi.fn(),
}));

vi.mock('../services/kycService', () => ({
  kycService: { getUserKYC },
}));

import { requireApprovedKyc } from '../middleware/requireApprovedKyc';

describe('approved KYC escrow guard', () => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: 'payer-1' };
    next();
  });
  app.post('/create', requireApprovedKyc, (_req, res) => res.sendStatus(201));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows only users with approved KYC to reach escrow creation', async () => {
    getUserKYC.mockResolvedValue({ status: 'approved' });

    const response = await request(app).post('/create');

    expect(response.status).toBe(201);
    expect(getUserKYC).toHaveBeenCalledWith('payer-1');
  });

  it('denies users without approved KYC before escrow creation', async () => {
    getUserKYC.mockResolvedValue({ status: 'pending' });

    const response = await request(app).post('/create');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('KYC_VERIFICATION_REQUIRED');
  });
});
