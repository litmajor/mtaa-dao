import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GatewayAggregator } from '../gatewayAggregator';

describe('GatewayAggregator smoke tests', () => {
  const originalMode = process.env.GATEWAY_MODE;

  beforeEach(() => {
    process.env.GATEWAY_MODE = 'stub';
  });

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.GATEWAY_MODE;
    } else {
      process.env.GATEWAY_MODE = originalMode;
    }
  });

  it('initializes adapters and exposes the expected adapter names', () => {
    const aggregator = new GatewayAggregator();
    const adapters = aggregator.listAdapters();

    expect(adapters.length).toBeGreaterThan(0);
    expect(adapters).toEqual(expect.arrayContaining(['uniswap', 'aave', 'sushiswap', 'pancakeswap']));
  });

  it('fails gracefully when no valid quote is available in stub mode', async () => {
    const aggregator = new GatewayAggregator();

    await expect(aggregator.getPrice('0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', '1000')).rejects.toThrow(/No valid adapters could provide executable quote/i);
  });

  it('returns an empty liquidity result set instead of crashing in stub mode', async () => {
    const aggregator = new GatewayAggregator();

    const liquidity = await aggregator.getLiquidity('0x1111111111111111111111111111111111111111');

    expect(liquidity).toEqual([]);
  });
});
