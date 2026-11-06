import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/providerBootstrap', () => ({
  resolveProviderUrls: () => ({ rpcUrl: '' }),
}));

vi.mock('../services/chainlinkFeedReader', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../services/chainlinkFeedReader')>();
  return {
    ...actual,
    ChainlinkFeedReader: class {
      async validate(feed: { expectedDescription: string }) {
        return { description: feed.expectedDescription, decimals: 8 };
      }

      async read(feed: {
        symbol: string;
        chainId: number;
        address: string;
        heartbeatSeconds: number;
      }) {
        return {
          ...feed,
          priceUsd: 0.0077,
          roundId: '1',
          updatedAtMs: Date.now(),
          observedAtMs: Date.now(),
          ageSeconds: 1,
          decimals: 8,
        };
      }
    },
  };
});

import { ExchangeRateService } from '../services/exchangeRateService';

describe('ExchangeRateService Chainlink fallback', () => {
  beforeEach(() => {
    vi.stubEnv(
      'CHAINLINK_VALUATION_FEEDS',
      JSON.stringify({
        KES: {
          chainId: 42220,
          address: '0x8e1f834ca4B8Efd81D9c557426C70ed5F67e87B1',
          heartbeatSeconds: 240,
          expectedDescription: 'KES / USD',
          mode: 'shadow',
        },
      })
    );
    vi.stubEnv('CELO_RPC_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('inverts the USD-per-KES feed and returns KES per USD', async () => {
    const rate = await ExchangeRateService.getUSDtoKESRate();

    expect(rate).toBe(129.87);
    expect(ExchangeRateService.getCacheInfo().source).toBe('chainlink_oracle');
  });
});
