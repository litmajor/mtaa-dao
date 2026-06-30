import { beforeEach, describe, expect, it, vi } from 'vitest';


vi.mock('../ohlcvService', () => ({
  ohlcvService: {
    seedDataSourceRegistry: vi.fn(async () => true),
  },
}));

vi.mock('../tokenDiscoveryService', () => ({
  tokenDiscoveryService: {
    buildUniverse: vi.fn(async () => [
      { symbol: 'BTC', availableOn: ['binance'] },
      { symbol: 'ETH', availableOn: ['binance', 'kraken'] }
    ]),
  },
}));

describe('marketUniverseBuilder', () => {
  it('seeds ohlcvService with discovered markets', async () => {
    const mod = await import('../marketUniverseBuilder');
    const mub = mod.marketUniverseBuilder;

    const res = await mub.buildUniverse();
    expect(res).toBeDefined();
    const ohlcv = (await import('../ohlcvService')).ohlcvService;
    expect(ohlcv.seedDataSourceRegistry).toHaveBeenCalled();
  }, 20000);
});
