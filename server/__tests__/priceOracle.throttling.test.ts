import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/redis', () => ({
  redis: {
    setnx: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('../core/agents/gateway/service', () => ({
  getGatewayAgentService: () => ({
    isHealthy: () => false,
    requestPrices: vi.fn(),
  }),
}));

import { PriceOracleService } from '../services/priceOracle';
import { logger } from '../utils/logger';

describe('PriceOracleService throttling', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    fetchMock = vi.fn().mockImplementation(() => {
      console.log('fetchMock called');
      return Promise.reject(new Error('upstream unavailable'));
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  });

  it('returns null for BTC when gateway is unhealthy and CoinGecko fetch fails', async () => {
    expect(globalThis.fetch).toBe(fetchMock);
    const oracle = new PriceOracleService();
    const anyOracle = oracle as any;

    expect(anyOracle.resolveToCoinGeckoId('BTC')).toBe('bitcoin');

    await expect(oracle.getPrice('BTC')).resolves.toBeNull();
  });

  it('re-admits a failed discovery symbol after the retry cooldown expires', () => {
    const oracle = new PriceOracleService();
    const anyOracle = oracle as any;
    const now = Date.now();

    anyOracle.discovery.failedSymbols.set('FOO', now - 1000);
    expect(anyOracle.discovery.failedSymbols.has('FOO')).toBe(true);

    anyOracle.queueForDiscovery('FOO');

    expect(anyOracle.discovery.failedSymbols.has('FOO')).toBe(false);
    expect(anyOracle.discovery.queue.has('FOO')).toBe(true);
  });

  it('does not requeue a failed discovery symbol before retry cooldown expires', () => {
    const oracle = new PriceOracleService();
    const anyOracle = oracle as any;
    const debugSpy = vi.spyOn(logger, 'debug');
    const future = Date.now() + 1000 * 60 * 60;

    anyOracle.discovery.failedSymbols.set('BAR', future);
    anyOracle.queueForDiscovery('BAR');

    expect(anyOracle.discovery.queue.has('BAR')).toBe(false);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping BAR'));
  });

  it('logs gateway unhealthy and skips gateway request', async () => {
    const oracle = new PriceOracleService();
    const warnSpy = vi.spyOn(logger, 'warn');

    await expect(oracle.getPrice('BTC')).resolves.toBeNull();

    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes('Gateway service is unhealthy'))).toBe(true);
  });
});
