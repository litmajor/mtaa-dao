import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registerClientGeneratedWallet, saveVaultBackup } = vi.hoisted(() => ({
  registerClientGeneratedWallet: vi.fn(),
  saveVaultBackup: vi.fn(),
}));

vi.mock('../auth', () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/wallet-generation-service', () => ({
  walletGenerationService: {
    registerClientGeneratedWallet,
  },
  createUserWallet: vi.fn(),
  generateMnemonicWallet: vi.fn(),
}));

vi.mock('../services/walletVaultService', () => ({
  saveVaultBackup,
  getVaultBackup: vi.fn(),
}));

import setupRouter from '../routes/v1/wallets/setup';

describe('wallet setup vault routes', () => {
  beforeEach(() => {
    registerClientGeneratedWallet.mockReset();
    saveVaultBackup.mockReset();
  });

  it('creates a wallet and stores a keystore backup when a keystore is supplied', async () => {
    registerClientGeneratedWallet.mockResolvedValue({ walletId: 'wallet-123', address: '0xabc' });
    saveVaultBackup.mockResolvedValue({ success: true, backedUpAt: new Date() });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 'user-123' };
      next();
    });
    app.use('/api/v1/wallets/setup', setupRouter);

    const keystore = {
      version: 3,
      id: 'id',
      address: '0xabc',
      crypto: {
        ciphertext: 'cipher',
        cipherparams: {},
        cipher: 'aes-128-ctr',
        kdf: 'scrypt',
        kdfparams: {},
        mac: 'mac',
      },
    };

    const res = await request(app)
      .post('/api/v1/wallets/setup/create')
      .send({ address: '0xabc', keystore });

    expect(res.status).toBe(201);
    expect(registerClientGeneratedWallet).toHaveBeenCalledWith('user-123', '0xabc', 'USDC', 'personal');
    expect(saveVaultBackup).toHaveBeenCalledWith('user-123', 'wallet-123', keystore, expect.objectContaining({}));
    expect(res.body.success).toBe(true);
    expect(res.body.data.wallet.address).toBe('0xabc');
  });
});
