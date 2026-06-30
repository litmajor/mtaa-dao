import { beforeEach, describe, expect, it, vi } from 'vitest';


vi.mock('../priceOracle', () => ({
  priceOracle: {
    getPrices: vi.fn(async () => new Map([['BTC', { usd: 20000, marketCap: 400_000_000_000 }]])),
  },
}));

vi.mock('../cacheService', () => ({
  cacheService: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
    keys: vi.fn(async () => []),
  },
}));

describe('ohlcvServicev1 price classification', () => {
  let ohlcv: any;

  beforeEach(async () => {
    const mod = await import('../ohlcvServicev1');
    ohlcv = mod.ohlcvServicev1;
  });

  it('prefers marketCap from priceOracle when available', async () => {
    const hints = await ohlcv.getPriceClassificationHints('BTC');
    expect(hints).not.toBeNull();
    expect(hints?.marketCapCategory).toBeDefined();
  }, 20000);
});
