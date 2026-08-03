import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dexService } from '../server/services/dexRoutingService';
import { priceOracle } from '../server/services/priceOracle';
import { productionDexRouting } from '../server/services/dexRoutingExecution.production';

describe('DEXIntegrationService route selection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses USD-normalized gas and output values when comparing routes', async () => {
    const originalRouters = (dexService as any).DEX_ROUTERS;
    (dexService as any).DEX_ROUTERS = {
      first: { address: '0x1', name: 'First', chain: 'celo', type: 'uniswap-v2' },
      second: { address: '0x2', name: 'Second', chain: 'celo', type: 'uniswap-v2' },
    };

    vi.spyOn(priceOracle, 'getPrices').mockResolvedValue(
      new Map([
        ['CELO', { priceUsd: 0.5 } as any],
        ['CUSD', { priceUsd: 1 } as any],
      ])
    );

    vi.spyOn(dexService as any, 'getSwapQuote')
      .mockResolvedValueOnce({
        fromAsset: 'CELO',
        toAsset: 'CUSD',
        amountIn: 100,
        estimatedAmountOut: 100,
        exchangeRate: 1,
        priceImpact: 0.1,
        estimatedGas: 0.1,
        dex: 'first',
      })
      .mockResolvedValueOnce({
        fromAsset: 'CELO',
        toAsset: 'CUSD',
        amountIn: 100,
        estimatedAmountOut: 99.5,
        exchangeRate: 0.995,
        priceImpact: 0.2,
        estimatedGas: 0.001,
        dex: 'second',
      });

    const result = await dexService.getBestRoute('CELO', 'CUSD', 100);

    expect(result?.dex).toBe('first');

    (dexService as any).DEX_ROUTERS = originalRouters;
  });

  it('returns null when price data is missing instead of silently defaulting to a dollar value', async () => {
    vi.spyOn(priceOracle, 'getPrices').mockResolvedValue(new Map());

    await expect(dexService.getSwapQuote('CELO', 'CUSD', 100)).resolves.toBeNull();
  });

  it('rejects unsupported pairs that are not cUSD-based', async () => {
    vi.spyOn(priceOracle, 'getPrices').mockResolvedValue(new Map([
      ['CELO', { priceUsd: 0.5 } as any],
      ['USDT', { priceUsd: 1 } as any],
    ]));

    await expect(dexService.getSwapQuote('CELO', 'USDT', 100)).resolves.toBeNull();
  });

  it('rejects unsupported assets on non-Celo chains when token metadata is absent', async () => {
    vi.spyOn(priceOracle, 'getPrices').mockResolvedValue(new Map([
      ['USDC', { priceUsd: 1 } as any],
      ['WETH', { priceUsd: 2000 } as any],
    ]));

    await expect(dexService.getSwapQuote('USDC', 'UNKNOWN', 100, undefined, 'ethereum')).resolves.toBeNull();
  });

  it('allows Celo native pairs like CELO->cEUR through the general routing shim', async () => {
    vi.spyOn(priceOracle, 'getPrices').mockResolvedValue(new Map([
      ['CELO', { priceUsd: 0.5 } as any],
      ['cEUR', { priceUsd: 1.1 } as any],
    ]));

    await expect(dexService.getSwapQuote('CELO', 'cEUR', 100, undefined, 'celo')).resolves.toBeNull();
  });

  it('returns the actual executed output amount when execution metadata is available', async () => {
    vi.spyOn(priceOracle, 'getPrices').mockResolvedValue(new Map([
      ['CELO', { priceUsd: 0.5 } as any],
      ['CUSD', { priceUsd: 1 } as any],
    ]));

    vi.spyOn(dexService as any, 'toSwapOrder').mockResolvedValue({
      asset: 'CELO',
      action: 'buy',
      amount: 100,
      amountUsd: 100,
      maxSlippagePercent: 0.5,
      deadline: undefined,
    });

    vi.spyOn(dexService as any, 'routeOrderForChain').mockResolvedValue({
      asset: 'CELO',
      action: 'buy',
      venue: 'mento',
      expectedPrice: 1,
      expectedSlippage: 0.1,
      expectedGasCost: 0.01,
      routableAmount: 100,
      confidence: 0.99,
    });

    vi.spyOn(productionDexRouting, 'executeSwap').mockResolvedValue({
      txHash: '0x123',
      slippageActual: 0.1,
      gasCostActual: 0.01,
      amountOutActual: 42,
    } as any);

    const result = await dexService.executeSwap('CUSD', 'CELO', 100, '0x1234567890123456789012345678901234567890');

    expect(result.success).toBe(true);
    expect(result.amountOut).toBe(42);
  });
});
