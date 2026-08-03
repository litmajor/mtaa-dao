import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productionDexRouting } from '../server/services/dexRoutingExecution.production';
import {
  routeTreasuryOrder,
  TreasuryDexRoutingError,
} from '../server/services/treasuryDexRouting';

describe('Treasury DEX routing wrapper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects treasury orders above the hard USD cap', async () => {
    await expect(
      routeTreasuryOrder({
        asset: 'cUSD',
        action: 'buy',
        amount: 1000,
        amountUsd: 30000,
        maxSlippagePercent: 0.5,
      })
    ).rejects.toThrow(TreasuryDexRoutingError);
  });

  it('defaults to the full Celo venue set when no allowlist is supplied', async () => {
    const routeOrderSpy = vi
      .spyOn(productionDexRouting, 'routeOrderOnCelo')
      .mockResolvedValue({
        asset: 'cUSD',
        action: 'buy',
        venue: 'mento',
        expectedPrice: 1.001,
        expectedSlippage: 0.5,
        expectedGasCost: 0.002,
        routableAmount: 1000,
        confidence: 0.97,
      });

    await routeTreasuryOrder({
      asset: 'cUSD',
      action: 'buy',
      amount: 1000,
      amountUsd: 1000,
      maxSlippagePercent: 0.5,
    });

    expect(routeOrderSpy).toHaveBeenCalledWith(
      expect.any(Object),
      { allowedVenues: ['mento', 'ubeswap'] }
    );
  });

  it('clamps slippage and restricts routing to the allowed treasury venues', async () => {
    const routeOrderSpy = vi
      .spyOn(productionDexRouting, 'routeOrderOnCelo')
      .mockResolvedValue({
        asset: 'cUSD',
        action: 'buy',
        venue: 'mento',
        expectedPrice: 1.001,
        expectedSlippage: 0.5,
        expectedGasCost: 0.002,
        routableAmount: 1000,
        confidence: 0.97,
      });

    const result = await routeTreasuryOrder({
      asset: 'cUSD',
      action: 'buy',
      amount: 1000,
      amountUsd: 1000,
      maxSlippagePercent: 3,
    });

    expect(result.venue).toBe('mento');
    expect(routeOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({ asset: 'cUSD', maxSlippagePercent: 1 }),
      { allowedVenues: ['mento', 'ubeswap'] }
    );
  });
});
