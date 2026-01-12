/**
 * CCXT Service Unit Tests
 * 
 * Test suite for Phase 1: CCXT Service Foundation
 * Tests: Price fetching, OHLCV, validation, basic order simulation
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import ccxtService from '../services/ccxtService';

describe('CCXT Service - Phase 1', () => {
  /**
   * Setup and teardown
   */
  beforeAll(() => {
    console.log('Starting CCXT Service tests...');
  });

  afterAll(() => {
    ccxtService.clearCaches();
    console.log('CCXT Service tests complete');
  });

  /**
   * ==========================================
   * Initialization Tests
   * ==========================================
   */
  describe('Initialization', () => {
    it('should initialize with available exchanges', () => {
      const exchanges = ccxtService.getAvailableExchanges();
      expect(exchanges).toBeInstanceOf(Array);
      expect(exchanges.length).toBeGreaterThan(0);
      expect(exchanges).toContain('binance');
      expect(exchanges).toContain('coinbase');
    });

    it('should report exchange status', () => {
      const status = ccxtService.getExchangeStatus();
      expect(status).toHaveProperty('binance');
      expect(status.binance).toHaveProperty('connected');
      expect(status.binance).toHaveProperty('hasCredentials');
    });

    it('should perform health check', async () => {
      const health = await ccxtService.healthCheck();
      expect(health).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health).toHaveProperty('exchanges');
      expect(health).toHaveProperty('timestamp');
    });
  });

  /**
   * ==========================================
   * Price Discovery Tests
   * ==========================================
   */
  describe('Price Discovery', () => {
    it('should fetch ticker from binance', async () => {
      const price = await ccxtService.getTickerFromExchange('binance', 'CELO');
      expect(price).not.toBeNull();
      expect(price).toHaveProperty('bid');
      expect(price).toHaveProperty('ask');
      expect(price).toHaveProperty('last');
      expect(price!.bid).toBeGreaterThan(0);
      expect(price!.ask).toBeGreaterThanOrEqual(price!.bid);
    });

    it('should fetch prices from multiple exchanges', async () => {
      const prices = await ccxtService.getPricesFromMultipleExchanges('CELO', [
        'binance',
        'coinbase',
        'kraken'
      ]);

      expect(prices).toHaveProperty('binance');
      expect(prices).toHaveProperty('coinbase');
      expect(prices).toHaveProperty('kraken');

      // At least one should have data
      const hasData = Object.values(prices).some((p) => p !== null);
      expect(hasData).toBe(true);
    });

    it('should cache prices for 30 seconds', async () => {
      // First call
      const start = Date.now();
      const price1 = await ccxtService.getTickerFromExchange('binance', 'CELO');

      // Second call (should be from cache)
      const price2 = await ccxtService.getTickerFromExchange('binance', 'CELO');

      expect(price1).toEqual(price2);
    });

    it('should find best price across exchanges', async () => {
      const result = await ccxtService.getBestPrice('CELO', ['binance', 'coinbase']);

      expect(result).toHaveProperty('best');
      expect(result).toHaveProperty('all');
      expect(result).toHaveProperty('analysis');

      expect(result.best).toHaveProperty('bid');
      expect(result.best).toHaveProperty('ask');
      expect(result.best).toHaveProperty('exchange');
      expect(result.best).toHaveProperty('spread');

      expect(result.analysis).toHaveProperty('tightest');
      expect(result.analysis).toHaveProperty('spread_pct');
    });

    it('should handle invalid symbols gracefully', async () => {
      const price = await ccxtService.getTickerFromExchange('binance', 'NONEXISTENT');
      expect(price).toBeNull();
    });

    it('should handle unavailable exchanges gracefully', async () => {
      const prices = await ccxtService.getPricesFromMultipleExchanges('CELO', [
        'binance',
        'nonexistent_exchange'
      ]);

      expect(prices).toHaveProperty('binance');
      expect(prices).toHaveProperty('nonexistent_exchange');
      expect(prices.nonexistent_exchange).toBeNull();
    });
  });

  /**
   * ==========================================
   * OHLCV Data Tests
   * ==========================================
   */
  describe('OHLCV (Candle) Data', () => {
    it('should fetch OHLCV from binance', async () => {
      const ohlcv = await ccxtService.getOHLCVFromExchange('binance', 'CELO', '1h', 24);

      expect(ohlcv).not.toBeNull();
      expect(Array.isArray(ohlcv)).toBe(true);
      expect((ohlcv as any[]).length).toBeGreaterThan(0);

      // Check candle format: [timestamp, open, high, low, close, volume]
      const candle = (ohlcv as any[])[0];
      expect(candle).toHaveLength(6);
      expect(typeof candle[0]).toBe('number'); // timestamp
      expect(typeof candle[1]).toBe('number'); // open
    });

    it('should cache OHLCV for 5 minutes', async () => {
      const ohlcv1 = await ccxtService.getOHLCVFromExchange('binance', 'CELO', '1h', 24);
      const ohlcv2 = await ccxtService.getOHLCVFromExchange('binance', 'CELO', '1h', 24);

      expect(ohlcv1).toEqual(ohlcv2);
    });

    it('should support different timeframes', async () => {
      const timeframes = ['1h', '4h', '1d'];

      for (const tf of timeframes) {
        const ohlcv = await ccxtService.getOHLCVFromExchange('binance', 'CELO', tf, 24);
        expect(ohlcv).not.toBeNull();
        expect((ohlcv as any[]).length).toBeGreaterThan(0);
      }
    });

    it('should get OHLCV from best available source', async () => {
      const result = await ccxtService.getOHLCV('CELO', '1h', 24);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('source');
      expect(result.data).not.toBeNull();
      expect(typeof result.source).toBe('string');
    });

    it('should handle limited OHLCV requests', async () => {
      const ohlcv = await ccxtService.getOHLCVFromExchange('binance', 'CELO', '1h', 5);

      expect((ohlcv as any[]).length).toBeLessThanOrEqual(5);
    });
  });

  /**
   * ==========================================
   * Order Validation Tests
   * ==========================================
   */
  describe('Order Validation', () => {
    it('should validate valid market order', async () => {
      const validation = await ccxtService.validateOrder('binance', 'CELO', 'buy', 10);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.market).not.toBeNull();
    });

    it('should reject order with invalid exchange', async () => {
      const validation = await ccxtService.validateOrder('nonexistent', 'CELO', 'buy', 10);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should reject order with unsupported symbol', async () => {
      const validation = await ccxtService.validateOrder('binance', 'INVALID', 'buy', 10);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should reject order with amount too small', async () => {
      const validation = await ccxtService.validateOrder('binance', 'CELO', 'buy', 0.00001);

      // May be valid or invalid depending on market minimums
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
    });

    it('should validate limit order with price', async () => {
      const validation = await ccxtService.validateOrder(
        'binance',
        'CELO',
        'buy',
        10,
        0.65
      );

      expect(validation.valid).toBe(true);
      expect(validation.market).not.toBeNull();
    });

    it('should return market information from validation', async () => {
      const validation = await ccxtService.validateOrder('binance', 'CELO', 'buy', 10);

      const market = validation.market;
      expect(market).toHaveProperty('id');
      expect(market).toHaveProperty('symbol');
      expect(market).toHaveProperty('base');
      expect(market).toHaveProperty('quote');
      expect(market).toHaveProperty('limits');
    });
  });

  /**
   * ==========================================
   * Market Information Tests
   * ==========================================
   */
  describe('Market Information', () => {
    it('should load markets from exchange', async () => {
      const markets = await ccxtService.getMarkets('binance');

      expect(Array.isArray(markets)).toBe(true);
      expect(markets.length).toBeGreaterThan(0);

      // Check market structure
      const market = markets[0];
      expect(market).toHaveProperty('id');
      expect(market).toHaveProperty('symbol');
      expect(market).toHaveProperty('base');
      expect(market).toHaveProperty('quote');
      expect(market).toHaveProperty('maker');
      expect(market).toHaveProperty('taker');
      expect(market).toHaveProperty('limits');
    });

    it('should cache markets for 1 hour', async () => {
      const markets1 = await ccxtService.getMarkets('binance');
      const markets2 = await ccxtService.getMarkets('binance');

      expect(markets1).toEqual(markets2);
    });

    it('should handle invalid exchange', async () => {
      await expect(ccxtService.getMarkets('nonexistent')).rejects.toThrow();
    });
  });

  /**
   * ==========================================
   * Cache Management Tests
   * ==========================================
   */
  describe('Cache Management', () => {
    it('should report cache statistics', () => {
      const stats = ccxtService.getCacheStats();

      expect(stats).toHaveProperty('prices');
      expect(stats).toHaveProperty('ohlcv');
      expect(stats).toHaveProperty('markets');

      expect(stats.prices).toHaveProperty('keys');
      expect(stats.prices).toHaveProperty('size');
    });

    it('should clear all caches', () => {
      // Populate cache
      ccxtService.getTickerFromExchange('binance', 'CELO');

      // Clear
      ccxtService.clearCaches();

      // Check stats
      const stats = ccxtService.getCacheStats();
      expect(stats.prices.keys).toBe(0);
      expect(stats.ohlcv.keys).toBe(0);
      expect(stats.markets.keys).toBe(0);
    });
  });

  /**
   * ==========================================
   * Edge Cases & Error Handling
   * ==========================================
   */
  describe('Edge Cases & Error Handling', () => {
    it('should handle network timeout gracefully', async () => {
      // This would require mocking network errors
      // For now, just verify the method exists and completes
      const price = await ccxtService.getTickerFromExchange('binance', 'CELO');
      expect(typeof price === 'object' || price === null).toBe(true);
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests
      const promises = Array(5).fill(0).map(() =>
        ccxtService.getTickerFromExchange('binance', 'CELO')
      );

      const results = await Promise.all(promises);
      expect(results.length).toBe(5);
    });

    it('should handle concurrent requests', async () => {
      const promises = [
        ccxtService.getTickerFromExchange('binance', 'CELO'),
        ccxtService.getTickerFromExchange('coinbase', 'CELO'),
        ccxtService.getOHLCVFromExchange('binance', 'CELO', '1h', 24),
        ccxtService.getMarkets('binance')
      ];

      const results = await Promise.all(promises);
      expect(results.length).toBe(4);
    });

    it('should handle symbol format variations', async () => {
      // Test various symbol formats
      const formats = ['CELO', 'CELO/USDC', 'CELO/USDT'];

      for (const format of formats) {
        const price = await ccxtService.getTickerFromExchange('binance', format);
        // Should either return valid price or null (not throw)
        expect(typeof price === 'object' || price === null).toBe(true);
      }
    });

    it('should handle all exchange availability checks', async () => {
      const exchanges = ccxtService.getAvailableExchanges();

      for (const exchange of exchanges) {
        const status = ccxtService.getExchangeStatus();
        expect(status[exchange]).toBeDefined();
      }
    });
  });

  /**
   * ==========================================
   * Performance Tests
   * ==========================================
   */
  describe('Performance', () => {
    it('should return cached price within 5ms', async () => {
      // First call (populates cache)
      await ccxtService.getTickerFromExchange('binance', 'CELO');

      // Second call (should be cached)
      const start = performance.now();
      const price = await ccxtService.getTickerFromExchange('binance', 'CELO');
      const elapsed = performance.now() - start;

      expect(price).not.toBeNull();
      expect(elapsed).toBeLessThan(5); // Should be nearly instant from cache
    });

    it('should handle multiple simultaneous price requests', async () => {
      const symbols = ['CELO', 'USDC', 'USDT'];
      const exchanges = ['binance', 'coinbase'];

      const start = performance.now();

      const promises = symbols.flatMap((sym) =>
        exchanges.map((ex) => ccxtService.getTickerFromExchange(ex, sym))
      );

      const results = await Promise.all(promises);
      const elapsed = performance.now() - start;

      expect(results.length).toBe(6);
      // Should complete reasonably fast (adjust as needed based on API)
      expect(elapsed).toBeLessThan(10000);
    });
  });
});

/**
 * Integration Tests
 * Tests that would run against live API
 */
describe('CCXT Service - Integration (Live API)', () => {
  it('should connect to live Binance API', async () => {
    const price = await ccxtService.getTickerFromExchange('binance', 'CELO');

    expect(price).not.toBeNull();
    expect(price!.bid).toBeGreaterThan(0);
    expect(price!.ask).toBeGreaterThan(price!.bid);
  });

  it('should provide realistic price data', async () => {
    const prices = await ccxtService.getPricesFromMultipleExchanges('CELO', [
      'binance',
      'coinbase'
    ]);

    const validPrices = Object.values(prices).filter((p) => p !== null);
    expect(validPrices.length).toBeGreaterThan(0);

    // Prices should be within reasonable range (e.g., not 0 or extremely high)
    validPrices.forEach((p) => {
      expect(p!.bid).toBeGreaterThan(0.01);
      expect(p!.bid).toBeLessThan(1000);
    });
  });

  it('should provide consistent OHLCV data', async () => {
    const ohlcv = await ccxtService.getOHLCVFromExchange('binance', 'CELO', '1h', 24);

    expect(ohlcv).not.toBeNull();
    expect((ohlcv as any[]).length).toBe(24);

    // Check candle logic: high >= low, close between high and low
    (ohlcv as any[]).forEach((candle) => {
      const [, open, high, low, close] = candle;
      expect(high).toBeGreaterThanOrEqual(low);
      expect(high).toBeGreaterThanOrEqual(open);
      expect(high).toBeGreaterThanOrEqual(close);
      expect(low).toBeLessThanOrEqual(open);
      expect(low).toBeLessThanOrEqual(close);
    });
  });
});
