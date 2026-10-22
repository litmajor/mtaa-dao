import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findWallet, insertValues } = vi.hoisted(() => {
  process.env.KOTANIPAY_ONOFFRAMP_ENABLED = 'true';
  process.env.KOTANIPAY_API_KEY = 'test-api-key';
  process.env.KOTANIPAY_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.KOTANIPAY_ONOFFRAMP_WEBHOOK_URL = 'https://example.test/webhook';
  process.env.KOTANIPAY_ONOFFRAMP_SIGNATURE_MODE = 'raw-body-header';
  process.env.KOTANIPAY_V3_API_URL = 'https://sandbox-api.kotanipay.io/v3';

  return {
    findWallet: vi.fn(),
    insertValues: vi.fn(),
  };
});

vi.mock('../db', () => ({
  db: {
    query: { wallets: { findFirst: findWallet } },
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        insertValues(values);
        return {
          returning: async () => [{
            ...values,
            fiatCurrency: 'KES',
            token: 'CUSD',
            chain: 'CELO',
          }],
        };
      },
    }),
  },
}));

import { KotaniSelfCustodyRampService, RampServiceError } from '../services/kotaniSelfCustodyRampService';

describe('Kotani self-custody quote validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findWallet.mockResolvedValue({ address: '0x0000000000000000000000000000000000000001' });
    insertValues.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.KOTANIPAY_V3_API_URL = 'https://sandbox-api.kotanipay.io/v3';
  });

  it('uses the approved sandbox root and retains a provider quote expiry', async () => {
    const expiry = new Date(Date.now() + 5 * 60_000).toISOString();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        id: 'rate-1',
        cryptoAmount: '25',
        value: '0.025',
        from: 'KES',
        to: 'CUSD',
        chain: 'CELO',
        token: 'CUSD',
        expiresAt: expiry,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await KotaniSelfCustodyRampService.createOnrampQuote({
      userId: 'user-1',
      phoneNumber: '+254712345678',
      walletAddress: '0x0000000000000000000000000000000000000001',
      fiatAmount: '1000',
    });

    expect(String(fetchMock.mock.calls[0][0])).toBe('https://sandbox-api.kotanipay.io/v3/rate/onramp');
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      providerMetadata: { rateId: 'rate-1', quoteExpiresAt: expiry },
    }));
  });

  it('composes the production v3 path and accepts no sandbox fallback in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      process.env.KOTANIPAY_V3_API_URL = 'https://api.kotanipay.io/api/v3';
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        success: true,
        data: { id: 'rate-prod', cryptoAmount: '25', from: 'KES', to: 'CUSD' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      vi.stubGlobal('fetch', fetchMock);

      await KotaniSelfCustodyRampService.createOnrampQuote({
        userId: 'user-1',
        phoneNumber: '+254712345678',
        walletAddress: '0x0000000000000000000000000000000000000001',
        fiatAmount: '1000',
      });

      expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.kotanipay.io/api/v3/rate/onramp');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('rejects a quote for an unexpected chain or token before persisting it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        id: 'rate-2',
        cryptoAmount: '25',
        from: 'KES',
        to: 'CUSD',
        chain: 'BASE',
        token: 'CUSD',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(KotaniSelfCustodyRampService.createOnrampQuote({
      userId: 'user-1',
      phoneNumber: '+254712345678',
      walletAddress: '0x0000000000000000000000000000000000000001',
      fiatAmount: '1000',
    })).rejects.toMatchObject<Partial<RampServiceError>>({
      code: 'PROVIDER_QUOTE_INVALID',
      statusCode: 502,
    });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('rejects an already-expired provider quote before persisting it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        id: 'rate-3',
        cryptoAmount: '25',
        from: 'KES',
        to: 'CUSD',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(KotaniSelfCustodyRampService.createOnrampQuote({
      userId: 'user-1',
      phoneNumber: '+254712345678',
      walletAddress: '0x0000000000000000000000000000000000000001',
      fiatAmount: '1000',
    })).rejects.toMatchObject<Partial<RampServiceError>>({
      code: 'PROVIDER_QUOTE_INVALID',
      statusCode: 502,
    });
    expect(insertValues).not.toHaveBeenCalled();
  });
});
