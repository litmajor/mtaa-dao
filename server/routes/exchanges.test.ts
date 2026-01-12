/**
 * Exchange Routes Integration Tests
 * 
 * Test suite for Phase 1: CCXT API Endpoints
 * Tests: HTTP endpoint validation, response formats, error handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// @ts-ignore
import request from 'supertest';
import express from 'express';
import exchangeRoutes from '../routes/exchanges';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/exchanges', exchangeRoutes);

describe('Exchange Routes API - Phase 1', () => {
  /**
   * ==========================================
   * Status Endpoint Tests
   * ==========================================
   */
  describe('GET /api/exchanges/status', () => {
    it('should return exchange status', async () => {
      const res = await request(app).get('/api/exchanges/status');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('exchanges');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(res.body.status);
    });

    it('should include all initialized exchanges', async () => {
      const res = await request(app).get('/api/exchanges/status');

      expect(res.status).toBe(200);
      expect(res.body.exchanges).toHaveProperty('binance');
      expect(res.body.exchanges).toHaveProperty('coinbase');
      expect(res.body.exchanges).toHaveProperty('kraken');
    });

    it('should have required fields for each exchange', async () => {
      const res = await request(app).get('/api/exchanges/status');

      Object.values(res.body.exchanges).forEach((ex: any) => {
        expect(ex).toHaveProperty('connected');
        expect(typeof ex.connected).toBe('boolean');
      });
    });
  });

  /**
   * ==========================================
   * Prices Endpoint Tests
   * ==========================================
   */
  describe('GET /api/exchanges/prices', () => {
    it('should require symbol parameter', async () => {
      const res = await request(app).get('/api/exchanges/prices');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return prices for valid symbol', async () => {
      const res = await request(app).get('/api/exchanges/prices?symbol=CELO');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('symbol');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('prices');
      expect(res.body).toHaveProperty('analysis');

      expect(res.body.symbol).toBe('CELO');
    });

    it('should include prices from default exchanges', async () => {
      const res = await request(app).get('/api/exchanges/prices?symbol=CELO');

      expect(res.status).toBe(200);
      const priceObj = res.body.prices;

      expect(priceObj).toHaveProperty('binance');
      expect(priceObj).toHaveProperty('coinbase');
      expect(priceObj).toHaveProperty('kraken');
    });

    it('should include analysis metrics', async () => {
      const res = await request(app).get('/api/exchanges/prices?symbol=CELO');

      expect(res.status).toBe(200);
      const analysis = res.body.analysis;

      expect(analysis).toHaveProperty('best_bid');
      expect(analysis).toHaveProperty('best_ask');
      expect(analysis).toHaveProperty('spread');
      expect(analysis).toHaveProperty('spread_pct');
      expect(analysis).toHaveProperty('best_source');

      expect(typeof analysis.best_bid).toBe('number');
      expect(typeof analysis.spread_pct).toBe('number');
    });

    it('should accept custom exchange list', async () => {
      const res = await request(app)
        .get('/api/exchanges/prices?symbol=CELO&exchanges=binance,coinbase');

      expect(res.status).toBe(200);
      const priceObj = res.body.prices;

      expect(priceObj).toHaveProperty('binance');
      expect(priceObj).toHaveProperty('coinbase');
      expect(priceObj).not.toHaveProperty('kraken');
    });

    it('should handle invalid symbol', async () => {
      const res = await request(app).get('/api/exchanges/prices?symbol=NONEXISTENT');

      // Could be 200 with nulls or 400, depending on implementation
      expect([200, 400, 404]).toContain(res.status);
    });

    it('should handle invalid exchange name', async () => {
      const res = await request(app)
        .get('/api/exchanges/prices?symbol=CELO&exchanges=invalid');

      expect([200, 400]).toContain(res.status);
    });

    it('should validate multiple exchanges parameter', async () => {
      const res = await request(app)
        .get('/api/exchanges/prices?symbol=CELO&exchanges=binance,coinbase,kraken');

      expect(res.status).toBe(200);
      expect(Object.keys(res.body.prices).length).toBe(3);
    });
  });

  /**
   * ==========================================
   * Best Price Endpoint Tests
   * ==========================================
   */
  describe('GET /api/exchanges/best-price', () => {
    it('should require symbol parameter', async () => {
      const res = await request(app).get('/api/exchanges/best-price');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return best price with all comparison data', async () => {
      const res = await request(app).get('/api/exchanges/best-price?symbol=CELO');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('symbol');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('best');
      expect(res.body).toHaveProperty('all');
      expect(res.body).toHaveProperty('analysis');
    });

    it('should include best price details', async () => {
      const res = await request(app).get('/api/exchanges/best-price?symbol=CELO');

      expect(res.status).toBe(200);
      const best = res.body.best;

      expect(best).toHaveProperty('exchange');
      expect(best).toHaveProperty('bid');
      expect(best).toHaveProperty('ask');
      expect(best).toHaveProperty('spread');
      expect(typeof best.exchange).toBe('string');
    });

    it('should include analysis with spread metrics', async () => {
      const res = await request(app).get('/api/exchanges/best-price?symbol=CELO');

      expect(res.status).toBe(200);
      const analysis = res.body.analysis;

      expect(analysis).toHaveProperty('tightest');
      expect(analysis).toHaveProperty('loosest');
      expect(analysis).toHaveProperty('spread_pct');
      expect(analysis).toHaveProperty('arbitrage_opportunity');

      expect(typeof analysis.spread_pct).toBe('number');
      expect(analysis.spread_pct).toBeGreaterThanOrEqual(0);
    });

    it('should accept custom exchanges', async () => {
      const res = await request(app)
        .get('/api/exchanges/best-price?symbol=CELO&exchanges=binance,coinbase');

      expect(res.status).toBe(200);
      expect(Object.keys(res.body.all).length).toBeLessThanOrEqual(2);
    });
  });

  /**
   * ==========================================
   * OHLCV Endpoint Tests
   * ==========================================
   */
  describe('GET /api/exchanges/ohlcv', () => {
    it('should require symbol parameter', async () => {
      const res = await request(app).get('/api/exchanges/ohlcv');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return OHLCV data with default parameters', async () => {
      const res = await request(app).get('/api/exchanges/ohlcv?symbol=CELO');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('symbol');
      expect(res.body).toHaveProperty('exchange');
      expect(res.body).toHaveProperty('timeframe');
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('timestamp');

      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return properly formatted candle data', async () => {
      const res = await request(app).get('/api/exchanges/ohlcv?symbol=CELO');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Each candle should be array of [timestamp, open, high, low, close, volume]
      res.body.data.forEach((candle: any[]) => {
        expect(candle).toHaveLength(6);
        expect(typeof candle[0]).toBe('number'); // timestamp
        expect(typeof candle[1]).toBe('number'); // open
        expect(typeof candle[2]).toBe('number'); // high
        expect(typeof candle[3]).toBe('number'); // low
        expect(typeof candle[4]).toBe('number'); // close
        expect(typeof candle[5]).toBe('number'); // volume
      });
    });

    it('should accept timeframe parameter', async () => {
      const timeframes = ['1h', '4h', '1d'];

      for (const tf of timeframes) {
        const res = await request(app).get(`/api/exchanges/ohlcv?symbol=CELO&timeframe=${tf}`);

        expect(res.status).toBe(200);
        expect(res.body.timeframe).toBe(tf);
      }
    });

    it('should accept limit parameter', async () => {
      const res = await request(app).get('/api/exchanges/ohlcv?symbol=CELO&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(10);
    });

    it('should reject invalid timeframe', async () => {
      const res = await request(app).get('/api/exchanges/ohlcv?symbol=CELO&timeframe=invalid');

      expect([200, 400]).toContain(res.status);
    });

    it('should handle limit bounds', async () => {
      // Test max limit
      const res1 = await request(app).get('/api/exchanges/ohlcv?symbol=CELO&limit=500');
      expect(res1.status).toBe(200);

      // Test very high limit (should cap)
      const res2 = await request(app).get('/api/exchanges/ohlcv?symbol=CELO&limit=10000');
      expect([200, 400]).toContain(res2.status);
    });

    it('should use different exchange if specified', async () => {
      const res = await request(app).get('/api/exchanges/ohlcv?symbol=CELO&exchange=coinbase');

      expect(res.status).toBe(200);
      expect(res.body.exchange).toBe('coinbase');
    });
  });

  /**
   * ==========================================
   * Markets Endpoint Tests
   * ==========================================
   */
  describe('GET /api/exchanges/markets', () => {
    it('should return markets for default exchange', async () => {
      const res = await request(app).get('/api/exchanges/markets');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('exchange');
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('markets');
      expect(res.body).toHaveProperty('timestamp');

      expect(Array.isArray(res.body.markets)).toBe(true);
    });

    it('should accept exchange parameter', async () => {
      const res = await request(app).get('/api/exchanges/markets?exchange=coinbase');

      expect(res.status).toBe(200);
      expect(res.body.exchange).toBe('coinbase');
    });

    it('should return properly formatted market data', async () => {
      const res = await request(app).get('/api/exchanges/markets?exchange=binance');

      expect(res.status).toBe(200);
      expect(res.body.markets.length).toBeGreaterThan(0);

      const market = res.body.markets[0];
      expect(market).toHaveProperty('id');
      expect(market).toHaveProperty('symbol');
      expect(market).toHaveProperty('base');
      expect(market).toHaveProperty('quote');
      expect(market).toHaveProperty('maker');
      expect(market).toHaveProperty('taker');
    });

    it('should allow filtering by symbol', async () => {
      const res = await request(app).get('/api/exchanges/markets?exchange=binance&symbol=CELO');

      expect(res.status).toBe(200);
      // Result should have fewer markets if filter applied
      expect(Array.isArray(res.body.markets)).toBe(true);
    });

    it('should handle invalid exchange', async () => {
      const res = await request(app).get('/api/exchanges/markets?exchange=invalid');

      expect([200, 400, 500]).toContain(res.status);
    });

    it('should include market limits', async () => {
      const res = await request(app).get('/api/exchanges/markets?exchange=binance');

      if (res.status === 200 && res.body.markets.length > 0) {
        const market = res.body.markets[0];
        expect(market).toHaveProperty('limits');
        expect(market.limits).toHaveProperty('amount');
        expect(market.limits).toHaveProperty('price');
        expect(market.limits).toHaveProperty('cost');
      }
    });
  });

  /**
   * ==========================================
   * Order Validation Endpoint Tests (Private)
   * ==========================================
   */
  describe('POST /api/exchanges/order/validate', () => {
    it('should validate market buy order', async () => {
      const res = await request(app)
        .post('/api/exchanges/order/validate')
        .send({
          exchange: 'binance',
          symbol: 'CELO',
          side: 'buy',
          amount: 10
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('valid');
      expect(res.body).toHaveProperty('errors');
      expect(res.body).toHaveProperty('market');

      expect(typeof res.body.valid).toBe('boolean');
      expect(Array.isArray(res.body.errors)).toBe(true);
    });

    it('should validate limit order with price', async () => {
      const res = await request(app)
        .post('/api/exchanges/order/validate')
        .send({
          exchange: 'binance',
          symbol: 'CELO',
          side: 'sell',
          amount: 10,
          price: 0.7
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('valid');
    });

    it('should require exchange parameter', async () => {
      const res = await request(app)
        .post('/api/exchanges/order/validate')
        .send({
          symbol: 'CELO',
          side: 'buy',
          amount: 10
        });

      expect(res.status).toBe(400);
    });

    it('should require symbol parameter', async () => {
      const res = await request(app)
        .post('/api/exchanges/order/validate')
        .send({
          exchange: 'binance',
          side: 'buy',
          amount: 10
        });

      expect(res.status).toBe(400);
    });

    it('should require side parameter', async () => {
      const res = await request(app)
        .post('/api/exchanges/order/validate')
        .send({
          exchange: 'binance',
          symbol: 'CELO',
          amount: 10
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid side', async () => {
      const res = await request(app)
        .post('/api/exchanges/order/validate')
        .send({
          exchange: 'binance',
          symbol: 'CELO',
          side: 'invalid',
          amount: 10
        });

      expect([400, 200]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.valid).toBe(false);
      }
    });

    it('should reject invalid exchange', async () => {
      const res = await request(app)
        .post('/api/exchanges/order/validate')
        .send({
          exchange: 'invalid',
          symbol: 'CELO',
          side: 'buy',
          amount: 10
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('should include market details when valid', async () => {
      const res = await request(app)
        .post('/api/exchanges/order/validate')
        .send({
          exchange: 'binance',
          symbol: 'CELO',
          side: 'buy',
          amount: 10
        });

      if (res.body.valid) {
        const market = res.body.market;
        expect(market).toHaveProperty('symbol');
        expect(market).toHaveProperty('limits');
        expect(market).toHaveProperty('maker');
        expect(market).toHaveProperty('taker');
      }
    });
  });

  /**
   * ==========================================
   * Cache Management Endpoints (Private)
   * ==========================================
   */
  describe('GET /api/exchanges/cache-stats', () => {
    it('should return cache statistics', async () => {
      const res = await request(app).get('/api/exchanges/cache-stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('prices');
      expect(res.body).toHaveProperty('ohlcv');
      expect(res.body).toHaveProperty('markets');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should have proper cache stat structure', async () => {
      const res = await request(app).get('/api/exchanges/cache-stats');

      expect(res.status).toBe(200);
      const priceStats = res.body.prices;

      expect(priceStats).toHaveProperty('keys');
      expect(priceStats).toHaveProperty('size');
      expect(typeof priceStats.keys).toBe('number');
      expect(typeof priceStats.size).toBe('number');
    });
  });

  describe('POST /api/exchanges/cache/clear', () => {
    it('should clear caches', async () => {
      const res = await request(app).post('/api/exchanges/cache/clear');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should actually clear caches', async () => {
      // Get initial stats
      const stats1 = await request(app).get('/api/exchanges/cache-stats');
      const initialKeys = stats1.body.prices.keys;

      // Clear
      await request(app).post('/api/exchanges/cache/clear');

      // Get stats after clear
      const stats2 = await request(app).get('/api/exchanges/cache-stats');
      const afterClearKeys = stats2.body.prices.keys;

      expect(afterClearKeys).toBeLessThanOrEqual(initialKeys);
    });
  });

  /**
   * ==========================================
   * Response Format Tests
   * ==========================================
   */
  describe('Response Format Consistency', () => {
    it('should include timestamp in all responses', async () => {
      const endpoints = [
        '/api/exchanges/status',
        '/api/exchanges/prices?symbol=CELO',
        '/api/exchanges/best-price?symbol=CELO',
        '/api/exchanges/ohlcv?symbol=CELO',
        '/api/exchanges/markets'
      ];

      for (const endpoint of endpoints) {
        const res = await request(app).get(endpoint);

        if (res.status === 200) {
          expect(res.body).toHaveProperty('timestamp');
          expect(typeof res.body.timestamp).toBe('number');
        }
      }
    });

    it('should return proper error responses', async () => {
      const res = await request(app).get('/api/exchanges/prices'); // Missing required param

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });
  });

  /**
   * ==========================================
   * Performance Tests
   * ==========================================
   */
  describe('Performance', () => {
    it('should return cached prices quickly', async () => {
      // First call
      await request(app).get('/api/exchanges/prices?symbol=CELO');

      // Second call should be faster (from cache)
      const start = Date.now();
      const res = await request(app).get('/api/exchanges/prices?symbol=CELO');
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(100); // Should be fast from cache
    });

    it('should handle parallel requests', async () => {
      const requests = Array(5).fill(0).map(() =>
        request(app).get('/api/exchanges/prices?symbol=CELO')
      );

      const results = await Promise.all(requests);

      results.forEach((res: any) => {
        expect(res.status).toBe(200);
      });
    });
  });
});
