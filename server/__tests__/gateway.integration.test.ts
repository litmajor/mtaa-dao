import { beforeAll, describe, expect, it } from 'vitest';
import { GatewayService, initializeGatewayService } from '../services/gateway';

let gatewayService: GatewayService;

describe('Gateway Integration Tests', () => {
  beforeAll(() => {
    gatewayService = initializeGatewayService();
    expect(gatewayService).toBeDefined();
  });

  describe('Price fetch', () => {
    it('returns a valid BTC price from the gateway service', async () => {
      const price = await gatewayService.getTokenPrice('BTC', 42220);
      expect(price).not.toBeNull();
      expect(price?.token).toBe('BTC');
      expect(price?.chainId).toBe(42220);
      expect(typeof price?.price).toBe('number');
      expect(price?.price).toBeGreaterThan(0);
    });

    it('does not fall back to the fabricated 1000 USD price for an unknown asset', async () => {
      const price = await gatewayService.getTokenPrice('UNKNOWN_ASSET_123', 42220);
      expect(price).toBeNull();
    });
  });

  describe('Liquidity fetch', () => {
    it('returns real liquidity metadata for a known pair', async () => {
      const liquidity = await gatewayService.getLiquidityInfo('cUSD', 'USDC', 42220);
      expect(liquidity).not.toBeNull();
      expect(liquidity?.tokenA).toBe('cUSD');
      expect(liquidity?.tokenB).toBe('USDC');
      expect(parseFloat(liquidity?.liquidity || '0')).toBeGreaterThanOrEqual(0);
    });

    it('does not return fabricated fallback liquidity for unsupported pairs', async () => {
      const liquidity = await gatewayService.getLiquidityInfo('FAKEA', 'FAKEB', 42220);
      expect(liquidity).toBeNull();
    });

    it('resolves cUSD/USDC liquidity through the Ubeswap adapter on Celo', async () => {
      const { UbeswapAdapter } = await import('../core/agents/gateway/adapters/ubeswap-adapter');
      const adapter = new UbeswapAdapter({ name: 'ubeswap', rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org', enabled: true });
      const response = await adapter.fetch('liquidity', { symbol: 'cUSD', quoteSymbol: 'USDC', chain: 'celo' });

      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
      if (!Array.isArray(response.data)) {
        throw new Error('Expected adapter response data to be an array');
      }
      expect(response.data[0]?.value).toBeGreaterThan(0);
      expect(response.data[0]?.asset?.symbol).toBe('cUSD-USDC');
    });
  });

  describe('Gas fetch', () => {
    it('returns valid gas prices for Celo without hardcoded 2 gwei stub inflation', async () => {
      const gasPrices = await gatewayService.getGasPrices(42220);
      expect(gasPrices).not.toBeNull();
      expect(gasPrices?.chainId).toBe(42220);
      expect(gasPrices?.standard).toBeDefined();
      expect(gasPrices?.fast).toBeDefined();
      expect(gasPrices?.instant).toBeDefined();
      expect(gasPrices?.standard).not.toBe('2000000000');
    });

    it('estimates gas cost in USD', async () => {
      const estimate = await gatewayService.getEstimatedGasCost(42220, '21000', 'fast');
      expect(estimate).not.toBeNull();
      expect(parseFloat(estimate?.cost || '0')).toBeGreaterThan(0);
      expect(estimate?.costUSD).toBeGreaterThan(0);
    });
  });

  describe('Route generation', () => {
    it('produces an optimal route recommendation', async () => {
      const recommendation = await gatewayService.getRouteRecommendation({
        tokenIn: 'cUSD',
        tokenOut: 'USDC',
        amountIn: '1000',
        chainInId: 42220,
        chainOutId: 42220,
        slippage: 0.5,
      });

      expect(recommendation).not.toBeNull();
      expect(recommendation?.optimalRoute).toBeDefined();
      expect(recommendation?.estimatedTime).toBeGreaterThan(0);
      expect(recommendation?.riskAssessment).toBeDefined();
    });
  });

  describe('Security validation', () => {
    it('rejects insecure route payloads instead of approving everything', async () => {
      const insecureRoute = {
        id: 'insecure-route',
        source: {
          token: 'BTC',
          amount: '1000',
          chainId: 42220,
        },
        destination: {
          token: 'ETH',
          amount: '900',
          chainId: 42220,
        },
        totalSlippage: 0.75,
        totalGasCost: '999999999999',
        bridgeMethod: 'unsafe-protocol',
        steps: [
          {
            from: { token: 'BTC', amount: '1000', chainId: 42220 },
            to: { token: 'ETH', amount: '900', chainId: 42220 },
            protocol: 'unsafe-protocol',
            fee: '0.05',
            slippage: 0.75,
            gasEstimate: '210000',
          },
        ],
      } as any;

      const audit = await gatewayService.validateRoute(insecureRoute);
      expect(audit.isApproved).toBe(false);
    });
  });

  describe('Price load test', () => {
    it('handles 100 concurrent gateway price requests without timing out', async () => {
      const requests = Array.from({ length: 100 }, () => gatewayService.getTokenPrice('BTC', 42220));
      const results = await Promise.all(requests);
      expect(results.length).toBe(100);
      expect(results.filter(r => r !== null).length).toBeGreaterThan(0);
    }, 20000);
  });
});
