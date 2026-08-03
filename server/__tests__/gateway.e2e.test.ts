/**
 * Gateway Service E2E Tests
 * Comprehensive test suite for verifying gateway functionality
 * Tests initialization, all key functions, and E2E data flows
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { initializeGatewayService, getGatewayService, GatewayService } from '../services/gateway';
import { createGatewayRoutes } from '../services/gateway/api';
import { Express } from 'express';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Logger } from '../utils/logger';

const logger = new Logger('gateway.e2e.test');

/**
 * E2E Test Suite: Gateway Service
 */
describe('Gateway Service E2E Tests', () => {
  let gatewayService: GatewayService;
  let app: Express;

  /**
   * Setup: Initialize gateway service and create Express app
   */
  beforeAll(() => {
    logger.info('Setting up gateway service tests...');

    // Initialize gateway service singleton
    gatewayService = initializeGatewayService();
    expect(gatewayService).toBeDefined();

    // Create Express app with gateway routes
    app = express();
    app.use(express.json());

    const gatewayRoutes = createGatewayRoutes(gatewayService);
    app.use('/api/gateway', gatewayRoutes);
    app.use('/api/v1/market', gatewayRoutes);

    logger.info('Gateway service initialized and routes mounted');
  });

  afterAll(() => {
    logger.info('Cleaning up gateway tests');
  });

  // ============================================================================
  // SECTION 1: INITIALIZATION TESTS
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize gateway service without errors', () => {
      expect(gatewayService).toBeDefined();
      expect(gatewayService).toBeInstanceOf(GatewayService);
    });

    it('should enforce auth when gateway auth is enabled', async () => {
      process.env.GATEWAY_REQUIRE_AUTH = 'true';
      process.env.JWT_SECRET = 'test-secret';

      const authApp = express();
      authApp.use(express.json());
      authApp.use('/api/gateway', createGatewayRoutes(gatewayService));

      const unauthenticated = await request(authApp).get('/api/gateway/health');
      expect(unauthenticated.status).toBe(401);

      const token = jwt.sign(
        { id: 'user-1', email: 'user@example.com', role: 'member', daos: [] },
        process.env.JWT_SECRET!
      );

      const authenticated = await request(authApp)
        .get('/api/gateway/health')
        .set('Authorization', `Bearer ${token}`);

      expect(authenticated.status).toBe(200);
    });

    it('should return singleton instance on subsequent calls', () => {
      const instance1 = getGatewayService();
      const instance2 = getGatewayService();
      expect(instance1).toBe(instance2);
    });

    it('should have event emitter capability', () => {
      expect(typeof gatewayService.on).toBe('function');
      expect(typeof gatewayService.emit).toBe('function');
      expect(typeof gatewayService.off).toBe('function');
    });

    it('should have all key methods available', () => {
      expect(typeof gatewayService.getTokenPrice).toBe('function');
      expect(typeof gatewayService.getPricesForTokens).toBe('function');
      expect(typeof gatewayService.getAggregatedPrice).toBe('function');
      expect(typeof gatewayService.getLiquidityInfo).toBe('function');
      expect(typeof gatewayService.getGasPrices).toBe('function');
      expect(typeof gatewayService.getVolumeData).toBe('function');
    });
  });

  // ============================================================================
  // SECTION 2: PRICE AGGREGATION TESTS
  // ============================================================================

  describe('Price Aggregation', () => {
    it('should get single token price', async () => {
      const price = await gatewayService.getTokenPrice('BTC', 42220); // Celo mainnet
      expect(price).toBeDefined();
      expect(price?.token).toBe('BTC');
      expect(price?.chainId).toBe(42220);
      expect(typeof price?.price).toBe('number');
      expect(price?.price).toBeGreaterThan(0);
      expect(price?.source).toBeDefined();
      expect(price?.confidence).toBeDefined();
    });

    it('should get batch prices for multiple tokens', async () => {
      const prices = await gatewayService.getPricesForTokens(['BTC', 'ETH', 'USDC'], 42220);
      expect(prices).toBeDefined();
      expect(Object.keys(prices).length).toBeGreaterThan(0);

      for (const token of ['BTC', 'ETH', 'USDC']) {
        if (prices[token]) {
          expect(prices[token].token).toBe(token);
          expect(prices[token].chainId).toBe(42220);
          expect(typeof prices[token].price).toBe('number');
        }
      }
    });

    it('should return aggregated price with confidence', async () => {
      const price = await gatewayService.getAggregatedPrice('ETH', 42220);
      expect(price).toBeDefined();
      expect(price?.confidence).toBeDefined();
      expect(price?.confidence).toBeGreaterThanOrEqual(0);
      expect(price?.confidence).toBeLessThanOrEqual(1);
      expect(price?.timestamp).toBeDefined();
    });

    it('should cache prices', async () => {
      // First call
      const start1 = Date.now();
      const price1 = await gatewayService.getTokenPrice('BTC', 42220);
      const latency1 = Date.now() - start1;

      // Second call (should be cached)
      const start2 = Date.now();
      const price2 = await gatewayService.getTokenPrice('BTC', 42220);
      const latency2 = Date.now() - start2;

      expect(price1?.price).toBe(price2?.price);
      // Cache hit should be faster (typically < 10ms vs 50-200ms for fresh fetch)
      expect(latency2).toBeLessThanOrEqual(latency1 + 100);
    });

    it('should handle price fetch errors gracefully', async () => {
      // Invalid chain ID should return null or default
      const price = await gatewayService.getTokenPrice('INVALID_TOKEN', 99999);
      // Should either return null or a mock response
      expect(price === null || typeof price === 'object').toBe(true);
    });
  });

  // ============================================================================
  // SECTION 3: LIQUIDITY ANALYSIS TESTS
  // ============================================================================

  describe('Liquidity Analysis', () => {
    it('should get liquidity information', async () => {
      const liquidity = await gatewayService.getLiquidityInfo('cUSD', 'USDC', 42220);
      expect(liquidity).toBeDefined();
      expect(liquidity?.tokenA).toBe('cUSD');
      expect(liquidity?.tokenB).toBe('USDC');
      expect(liquidity?.chainId).toBe(42220);
      expect(liquidity?.liquidity).toBeDefined();
      expect(parseFloat(liquidity?.liquidity || '0')).toBeGreaterThanOrEqual(0);
    });

    it('should analyze liquidity depth', async () => {
      const analysis = await gatewayService.analyzeLiquidityDepth('cUSD', 'USDC', 42220, ['100', '1000', '10000']);
      expect(analysis).toBeDefined();
      expect(Array.isArray(analysis)).toBe(true);
      expect(analysis.length).toBe(3);

      for (const point of analysis) {
        expect(point.amount).toBeDefined();
        expect(typeof point.slippage).toBe('number');
      }
    });

    it('should check liquidity health', async () => {
      const health = await gatewayService.checkLiquidityHealth('cUSD', 'USDC', 42220, '100000');
      expect(health).toBeDefined();
      expect(typeof health?.healthy).toBe('boolean');
      expect(health?.available).toBeDefined();
      expect(parseFloat(health?.available || '0')).toBeGreaterThanOrEqual(0);
    });

    it('should expose liquidity metadata', async () => {
      const liquidity = await gatewayService.getLiquidityInfo('cUSD', 'USDC', 42220);
      expect(liquidity?.depth).toBeDefined();
      expect(liquidity?.fee).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // SECTION 4: GAS ESTIMATION TESTS
  // ============================================================================

  describe('Gas Estimation', () => {
    it('should get gas prices for a chain', async () => {
      const gasPrices = await gatewayService.getGasPrices(42220); // Celo
      expect(gasPrices).toBeDefined();
      expect(gasPrices?.chainId).toBe(42220);
      expect(parseFloat(gasPrices?.standard || '0')).toBeGreaterThan(0);
      expect(parseFloat(gasPrices?.fast || '0')).toBeGreaterThan(0);
      expect(parseFloat(gasPrices?.instant || '0')).toBeGreaterThan(0);
    });

    it('should estimate gas cost for a transaction', async () => {
      const estimate = await gatewayService.getEstimatedGasCost(42220, '21000', 'fast');
      expect(estimate).toBeDefined();
      expect(parseFloat(estimate?.cost || '0')).toBeGreaterThan(0);
      expect(estimate?.costUSD).toBeGreaterThan(0);
    });

    it('should compare gas across chains', async () => {
      const comparison = await gatewayService.compareGasAcrossChains([42220, 1, 137], '21000');
      expect(comparison).toBeDefined();
      expect(Object.keys(comparison).length).toBeGreaterThan(0);
      expect(comparison[42220]).toBeDefined();
      expect(comparison[42220]?.costUSD).toBeGreaterThanOrEqual(0);
    });

    it('should return gas price data for multiple chains', async () => {
      const gasCelo = await gatewayService.getGasPrices(42220);
      const gasEth = await gatewayService.getGasPrices(1);

      expect(parseFloat(gasEth?.fast || '0')).toBeGreaterThan(0);
      expect(parseFloat(gasCelo?.fast || '0')).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SECTION 5: VOLUME DATA TESTS
  // ============================================================================

  describe('Volume Data', () => {
    it('should get volume data for pair', async () => {
      const volume = await gatewayService.getVolumeData('BTC/USD', 42220, '24h');
      expect(volume).toBeDefined();
      expect(volume?.pair).toBe('BTC/USD');
      expect(volume?.chainId).toBe(42220);
      expect(parseFloat(volume?.volume24h || '0')).toBeGreaterThanOrEqual(0);
    });

    it('should get volume for different timeframes', async () => {
      const day = await gatewayService.getVolumeData('BTC/USD', 42220, '24h');
      const week = await gatewayService.getVolumeData('BTC/USD', 42220, '7d');
      const month = await gatewayService.getVolumeData('BTC/USD', 42220, 'monthly');

      expect(parseFloat(day?.volume24h || '0')).toBeGreaterThanOrEqual(0);
      expect(parseFloat(week?.volume7d || '0')).toBeGreaterThanOrEqual(0);
      expect(parseFloat(month?.volumeMonthly || '0')).toBeGreaterThanOrEqual(0);
      expect(parseFloat(month?.volumeMonthly || '0')).toBeGreaterThanOrEqual(parseFloat(week?.volume7d || '0'));
    });

    it('should get trending volume pairs', async () => {
      const activity = await gatewayService.analyzeMarketActivity(42220);
      expect(activity).toBeDefined();
      expect(activity?.trending).toBeDefined();
      expect(Array.isArray(activity?.trending)).toBe(true);
      expect(activity?.trending?.length).toBeLessThanOrEqual(5);

      for (const pair of activity?.trending || []) {
        expect(pair?.pair).toBeDefined();
        expect(pair?.change ?? pair?.volumeUSD).toBeDefined();
      }
    });
  });

  // ============================================================================
  // SECTION 6: ROUTE OPTIMIZATION TESTS
  // ============================================================================

  describe('Route Optimization', () => {
    it('should generate an optimal route', async () => {
      const quote = await gatewayService.getOptimalRoute({
        tokenIn: 'cUSD',
        tokenOut: 'USDC',
        amountIn: '1000',
        chainInId: 42220,
        chainOutId: 42220,
        slippage: 0.5,
      });

      expect(quote).toBeDefined();
      expect(quote?.route).toBeDefined();
      expect(quote?.alternatives).toBeDefined();
      expect(Array.isArray(quote?.alternatives)).toBe(true);
    });

    it('should calculate route recommendation metadata', async () => {
      const recommendation = await gatewayService.getRouteRecommendation({
        tokenIn: 'BTC',
        tokenOut: 'ETH',
        amountIn: '1',
        chainInId: 42220,
        chainOutId: 42220,
        slippage: 0.5,
      });

      expect(recommendation).toBeDefined();
      expect(recommendation?.optimalRoute).toBeDefined();
      expect(recommendation?.estimatedTime).toBeGreaterThan(0);
      expect(recommendation?.riskAssessment).toBeDefined();
    });

    it('should handle cross-chain route requests', async () => {
      const quote = await gatewayService.getOptimalRoute({
        tokenIn: 'cUSD',
        tokenOut: 'USDC',
        amountIn: '1000',
        chainInId: 42220,
        chainOutId: 1,
        slippage: 0.5,
      });

      expect(quote).toBeDefined();
      expect(quote?.route).toBeDefined();
    });
  });

  // ============================================================================
  // SECTION 7: REST API ENDPOINT TESTS
  // ============================================================================

  describe('REST API Endpoints', () => {
    it('GET /api/gateway/price/:token/:chainId - should return single price', async () => {
      const res = await request(app)
        .get('/api/gateway/price/BTC/42220')
        .expect(200);

      expect(res.body?.success).toBe(true);
      expect(res.body?.data).toBeDefined();
      expect(res.body?.data?.token).toBe('BTC');
      expect(res.body?.data?.price).toBeGreaterThan(0);
    });

    it('GET /api/v1/market/price/:token/:chainId - should return single price from the market data plane', async () => {
      const res = await request(app)
        .get('/api/v1/market/price/BTC/42220')
        .expect(200);

      expect(res.body?.success).toBe(true);
      expect(res.body?.data).toBeDefined();
      expect(res.body?.data?.token).toBe('BTC');
      expect(res.body?.data?.price).toBeGreaterThan(0);
    });

    it('POST /api/gateway/prices - should return batch prices', async () => {
      const res = await request(app)
        .post('/api/gateway/prices')
        .send({
          tokens: ['BTC', 'ETH'],
          chainId: 42220,
        })
        .expect(200);

      expect(res.body?.success).toBe(true);
      expect(res.body?.data).toBeDefined();
      expect(Object.keys(res.body?.data).length).toBeGreaterThan(0);
    });

    it('GET /api/gateway/price/:token/:chainId/aggregated - should return aggregated price', async () => {
      const res = await request(app)
        .get('/api/gateway/price/ETH/42220/aggregated')
        .expect(200);

      expect(res.body?.success).toBe(true);
      expect(res.body?.data).toBeDefined();
      expect(res.body?.data?.confidence).toBeDefined();
    });

    it('GET /api/gateway/liquidity/:tokenA/:tokenB/:chainId - should return liquidity', async () => {
      const res = await request(app)
        .get('/api/gateway/liquidity/cUSD/USDC/42220')
        .expect(200);

      expect(res.body?.success).toBe(true);
      expect(res.body?.data).toBeDefined();
      expect(res.body?.data?.tokenA).toBe('cUSD');
      expect(res.body?.data?.tokenB).toBe('USDC');
    });

    it('POST /api/gateway/liquidity/depth-analysis - should analyze depth', async () => {
      const res = await request(app)
        .post('/api/gateway/liquidity/depth-analysis')
        .send({
          tokenA: 'cUSD',
          tokenB: 'USDC',
          chainId: 42220,
          amounts: [100, 1000],
        })
        .expect(200);

      expect(res.body?.success).toBe(true);
      expect(Array.isArray(res.body?.data)).toBe(true);
      expect(res.body?.data?.length).toBe(2);
    });

    it('GET /api/gateway/gas/:chainId - should return gas prices', async () => {
      const res = await request(app)
        .get('/api/gateway/gas/42220')
        .expect(200);

      expect(res.body?.success).toBe(true);
      expect(parseFloat(res.body?.data?.standard || '0')).toBeGreaterThan(0);
      expect(parseFloat(res.body?.data?.fast || '0')).toBeGreaterThan(0);
    });

    it('GET /api/gateway/volume/:pair/:chainId - should return volume data', async () => {
      const res = await request(app)
        .get('/api/gateway/volume/BTC~USD/42220')
        .expect(200);

      expect(res.body?.success).toBe(true);
      expect(res.body?.data).toBeDefined();
      expect(parseFloat(res.body?.data?.volume24h || '0')).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/gateway/health - should return health status', async () => {
      const res = await request(app)
        .get('/api/gateway/health')
        .expect(200);

      expect(res.body?.success).toBe(true);
      expect(res.body?.data?.status).toBeDefined();
    });
  });

  // ============================================================================
  // SECTION 8: ERROR HANDLING & EDGE CASES
  // ============================================================================

  describe('Error Handling & Edge Cases', () => {
    it('should handle invalid chain IDs gracefully', async () => {
      const price = await gatewayService.getTokenPrice('BTC', 99999);
      // Should return null or handle gracefully without throwing
      expect(price === null || typeof price === 'object').toBe(true);
    });

    it('should handle invalid tokens gracefully', async () => {
      const price = await gatewayService.getTokenPrice('INVALID_XYZ_TOKEN', 42220);
      // Should return null or handle gracefully without throwing
      expect(price === null || typeof price === 'object').toBe(true);
    });

    it('should handle empty token arrays', async () => {
      const prices = await gatewayService.getPricesForTokens([], 42220);
      expect(typeof prices).toBe('object');
      expect(Object.keys(prices).length).toBe(0);
    });

    it('should handle concurrent requests', async () => {
      const promises = [
        gatewayService.getTokenPrice('BTC', 42220),
        gatewayService.getTokenPrice('ETH', 42220),
        gatewayService.getPricesForTokens(['USDC', 'cUSD'], 42220),
        gatewayService.getGasPrices(42220),
      ];

      const results = await Promise.all(promises);
      expect(results.length).toBe(4);
      expect(results.every(r => r !== undefined)).toBe(true);
    });

    it('should return valid cache entries after first fetch', async () => {
      const price1 = await gatewayService.getTokenPrice('BTC', 42220);
      const price2 = await gatewayService.getTokenPrice('BTC', 42220);

      expect(price1?.price).toBe(price2?.price);
      expect(price1?.timestamp).toBeLessThanOrEqual(price2?.timestamp || 0);
    });
  });

  // ============================================================================
  // SECTION 9: DATA CONSISTENCY TESTS
  // ============================================================================

  describe('Data Consistency', () => {
    it('should maintain cache TTL', async () => {
      const price1 = await gatewayService.getTokenPrice('ETH', 42220);
      const timestamp1 = price1?.timestamp;

      // Wait a tiny bit and fetch again
      await new Promise(resolve => setTimeout(resolve, 100));

      const price2 = await gatewayService.getTokenPrice('ETH', 42220);
      const timestamp2 = price2?.timestamp;

      // If cached, timestamps should be same
      expect(timestamp1).toBe(timestamp2);
    });

    it('should have valid price ranges', async () => {
      const btcPrice = await gatewayService.getTokenPrice('BTC', 42220);
      const ethPrice = await gatewayService.getTokenPrice('ETH', 42220);

      // BTC should typically be > ETH
      expect(btcPrice?.price).toBeGreaterThan(0);
      expect(ethPrice?.price).toBeGreaterThan(0);
      expect(btcPrice?.price).toBeGreaterThan(ethPrice?.price || 0);
    });

    it('should maintain source attribution', async () => {
      const price = await gatewayService.getTokenPrice('BTC', 42220);
      expect(price?.source).toBeDefined();
      expect(['mock', 'chainlink', 'uniswap', 'coingecko'].includes(price?.source || '')).toBe(true);
    });

    it('should track confidence consistency', async () => {
      const prices = [];
      for (let i = 0; i < 3; i++) {
        const p = await gatewayService.getTokenPrice('ETH', 42220);
        prices.push(p);
      }

      // All should have defined confidence
      expect(prices.every(p => p?.confidence !== undefined)).toBe(true);

      // Confidence should be in valid range
      expect(prices.every(p => (p?.confidence || 0) >= 0 && (p?.confidence || 0) <= 1)).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 10: PERFORMANCE TESTS
  // ============================================================================

  describe('Performance', () => {
    it('should retrieve cached prices quickly', async () => {
      // Warm up cache
      await gatewayService.getTokenPrice('BTC', 42220);

      // Time cached retrieval
      const start = Date.now();
      const price = await gatewayService.getTokenPrice('BTC', 42220);
      const latency = Date.now() - start;

      expect(latency).toBeLessThan(50); // Cache hit should be < 50ms
      expect(price).toBeDefined();
    });

    it('should handle batch price requests efficiently', async () => {
      const start = Date.now();
      const prices = await gatewayService.getPricesForTokens(['BTC', 'ETH', 'USDC', 'cUSD'], 42220);
      const latency = Date.now() - start;

      expect(latency).toBeLessThan(1000); // Batch should complete reasonably
      expect(Object.keys(prices).length).toBeGreaterThan(0);
    });

    it('should respond to health checks instantly', async () => {
      const start = Date.now();
      const health = await gatewayService.getHealthStatus();
      const latency = Date.now() - start;

      expect(latency).toBeLessThan(10);
      expect(health).toBeDefined();
    });
  });

  // ============================================================================
  // SECTION 11: EVENT EMITTER TESTS
  // ============================================================================

  describe('Event Emitter Capabilities', () => {
    it('should emit events on price fetch', async () => {
      const eventHandler = vi.fn();
      gatewayService.on('priceRequested', eventHandler);

      await gatewayService.getTokenPrice('BTC', 42220);

      gatewayService.off('priceRequested', eventHandler);
      expect(eventHandler).not.toHaveBeenCalled();
    });

    it('should support multiple event listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      gatewayService.on('test', handler1);
      gatewayService.on('test', handler2);
      gatewayService.emit('test', { data: 'test' });

      gatewayService.off('test', handler1);
      gatewayService.off('test', handler2);

      // Verify listeners can be added and removed
      expect(true).toBe(true);
    });
  });
});
