import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetGatewayService = vi.fn();
const mockGetPrice = vi.fn();
const mockGetPrices = vi.fn();

vi.mock('../services/gateway', () => ({
  getGatewayService: mockGetGatewayService,
}));

vi.mock('../services/priceOracle', () => ({
  priceOracle: {
    getPrice: mockGetPrice,
    getPrices: mockGetPrices,
  },
}));

describe('market-data price routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGatewayService.mockReset();
    mockGetPrice.mockReset();
    mockGetPrices.mockReset();
  });

  it('keeps price lookups on the oracle path instead of routing through the gateway service', async () => {
    mockGetPrice.mockResolvedValue({
      symbol: 'BTC',
      name: 'Bitcoin',
      priceUsd: 42000,
      priceChange24h: 0,
      marketCap: 0,
      volume24h: 0,
      lastUpdated: new Date(),
    });

    const { marketDataClient } = await import('../services/marketDataClient');

    await marketDataClient.getPrice('BTC', 42220);

    expect(mockGetPrice).toHaveBeenCalledWith('BTC');
    expect(mockGetGatewayService).not.toHaveBeenCalled();
  });
});
