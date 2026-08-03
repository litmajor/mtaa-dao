import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/redis', () => ({
  redis: {
    setnx: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../core/agents/gateway/service', () => ({
  getGatewayAgentService: () => ({
    isHealthy: () => true,
    requestPrices: vi.fn().mockResolvedValue({ payload: { data: [] } }),
  }),
}));

vi.mock('../services/ccxtService', () => ({
  ccxtService: {
    getBestPrice: vi.fn().mockResolvedValue({
      best: { last: 42, volume: 99, timestamp: Date.now() },
    }),
  },
}));

vi.mock('../services/dexscreenerClient', () => ({
  dexscreenerClient: {
    getTokenPairsOnChain: vi.fn().mockResolvedValue([
      { priceUsd: '7.5', liquidity: { usd: 1000 }, volume: { h24: 600 }, priceChange: { h24: 1.2 } },
    ]),
  },
}));

vi.mock('../services/tokenRegistry', async () => {
  const actual = await vi.importActual<typeof import('../services/tokenRegistry')>('../services/tokenRegistry');
  return {
    ...actual,
    tokenRegistry: {
      getAllTokens: () => [
        { symbol: 'BTC', address: '0x1', chain: 'celo', name: 'Bitcoin', decimals: 18, category: 'native' },
      ],
    },
  };
});

import { PriceOracleService } from '../services/priceOracle';
import { ccxtService } from '../services/ccxtService';
import { dexscreenerClient } from '../services/dexscreenerClient';

const mockedCcxtService = ccxtService as unknown as { getBestPrice: ReturnType<typeof vi.fn> };
const mockedDexScreener = dexscreenerClient as unknown as { getTokenPairsOnChain: ReturnType<typeof vi.fn> };

describe('PriceOracleService fallback chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCcxtService.getBestPrice.mockResolvedValue({
      best: { last: 42, volume: 99, timestamp: Date.now() },
    });
    mockedDexScreener.getTokenPairsOnChain.mockResolvedValue([
      { priceUsd: '7.5', liquidity: { usd: 1000 }, volume: { h24: 600 }, priceChange: { h24: 1.2 } },
    ]);
  });

  it('falls back to ccxt when gateway, coingecko, and dexscreener fail', async () => {
    const oracle = new PriceOracleService();
    mockedDexScreener.getTokenPairsOnChain.mockRejectedValueOnce(new Error('dexscreener blocked'));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ bitcoin: { usd: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await oracle.getPrice('BTC');

    expect(result?.priceUsd).toBe(42);
    expect(mockedCcxtService.getBestPrice).toHaveBeenCalled();
    expect(mockedDexScreener.getTokenPairsOnChain).toHaveBeenCalled();
  });

  it('falls back to dexscreener when gateway and coingecko fail', async () => {
    const oracle = new PriceOracleService();
    mockedCcxtService.getBestPrice.mockRejectedValueOnce(new Error('ccxt blocked'));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ bitcoin: { usd: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await oracle.getPrice('BTC');

    expect(result?.priceUsd).toBe(7.5);
    expect(mockedDexScreener.getTokenPairsOnChain).toHaveBeenCalled();
    expect(mockedCcxtService.getBestPrice).not.toHaveBeenCalled();
  });
});
