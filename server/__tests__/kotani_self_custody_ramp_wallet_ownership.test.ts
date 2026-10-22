import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findWallet } = vi.hoisted(() => {
  process.env.KOTANIPAY_ONOFFRAMP_ENABLED = 'true';
  process.env.KOTANIPAY_API_KEY = 'test-api-key';
  process.env.KOTANIPAY_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.KOTANIPAY_ONOFFRAMP_WEBHOOK_URL = 'https://example.test/webhook';
  process.env.KOTANIPAY_ONOFFRAMP_SIGNATURE_MODE = 'raw-body-header';
  process.env.KOTANIPAY_V3_API_URL = 'https://sandbox-api.kotanipay.io/v3';

  return { findWallet: vi.fn() };
});

vi.mock('../db', () => ({
  db: {
    query: {
      wallets: { findFirst: findWallet },
    },
  },
}));

import { KotaniSelfCustodyRampService, RampServiceError } from '../services/kotaniSelfCustodyRampService';

describe('Kotani self-custody ramp wallet ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findWallet.mockResolvedValue(undefined);
  });

  it('rejects a valid-looking wallet address that is not an active wallet owned by the user', async () => {
    await expect(KotaniSelfCustodyRampService.createOnrampQuote({
      userId: 'user-1',
      phoneNumber: '+254712345678',
      walletAddress: '0x0000000000000000000000000000000000000001',
      fiatAmount: '1000',
    })).rejects.toMatchObject<Partial<RampServiceError>>({
      code: 'RAMP_WALLET_NOT_VERIFIED',
      statusCode: 403,
    });

    expect(findWallet).toHaveBeenCalledOnce();
  });

  it('fails closed for unapproved roots and for the sandbox root in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      process.env.KOTANIPAY_V3_API_URL = 'https://sandbox.kotaniapi.com';
      expect(KotaniSelfCustodyRampService.isAvailable()).toBe(false);
      process.env.KOTANIPAY_V3_API_URL = 'https://sandbox-api.kotanipay.io:8443/v3';
      expect(KotaniSelfCustodyRampService.isAvailable()).toBe(false);

      process.env.NODE_ENV = 'production';
      process.env.KOTANIPAY_V3_API_URL = 'https://sandbox-api.kotanipay.io/v3';
      expect(KotaniSelfCustodyRampService.isAvailable()).toBe(false);

      process.env.KOTANIPAY_V3_API_URL = 'https://api.kotanipay.io/api/v3';
      expect(KotaniSelfCustodyRampService.isAvailable()).toBe(true);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.KOTANIPAY_V3_API_URL = 'https://sandbox-api.kotanipay.io/v3';
    }
  });
});
