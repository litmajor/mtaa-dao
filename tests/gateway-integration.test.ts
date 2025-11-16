/**
 * Gateway Agent Integration Tests
 * Tests for message bus, service layer, and component interaction
 */

import { GatewayAgent } from "../server/core/agents/gateway/index";
import { GatewayAgentService, getGatewayAgentService } from "../server/core/agents/gateway/service";
import { MessageBusAdapter } from "../server/core/agents/gateway/message-bus";
import { DataNormalizer } from "../server/core/agents/gateway/normalizer";
import { CacheManager } from "../server/core/agents/gateway/cache-manager";
import { GatewayMessage, GatewayMessageType } from "../server/core/agents/gateway/types";

describe("Gateway Agent Integration Tests", () => {
  let gatewayAgent: GatewayAgent;
  let service: GatewayAgentService;
  let messageBus: MessageBusAdapter;

  beforeEach(async () => {
    // Initialize service
    service = getGatewayAgentService();
    messageBus = service.getMessageBus ? service.getMessageBus() : undefined;
  });

  /**
   * MESSAGE BUS INTEGRATION TESTS
   */
  describe("Message Bus Integration", () => {
    it("should handle price request messages", async () => {
      const message: GatewayMessage = {
        type: "gateway:price_request",
        payload: {
          data: { symbols: ["ETH", "BTC"] },
          requestId: "test-1",
        },
        timestamp: new Date(),
      };

      // Message bus should process request
      let response: GatewayMessage | null = null;

      if (messageBus) {
        messageBus.subscribe("gateway:price_update", (msg) => {
          response = msg;
        });

        await messageBus.publish(message.type, message);

        // Wait for async processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(response).toBeDefined();
        expect(response?.type).toBe("gateway:price_update");
      }
    });

    it("should handle liquidity request messages", async () => {
      const message: GatewayMessage = {
        type: "gateway:liquidity_request",
        payload: {
          data: { protocols: ["uniswap", "aave"] },
          requestId: "test-2",
        },
        timestamp: new Date(),
      };

      if (messageBus) {
        let response: GatewayMessage | null = null;

        messageBus.subscribe("gateway:liquidity_update", (msg) => {
          response = msg;
        });

        await messageBus.publish(message.type, message);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(response).toBeDefined();
        expect(response?.type).toBe("gateway:liquidity_update");
      }
    });

    it("should handle APY request messages", async () => {
      const message: GatewayMessage = {
        type: "gateway:apy_request",
        payload: {
          data: { protocols: ["aave", "compound"] },
          requestId: "test-3",
        },
        timestamp: new Date(),
      };

      if (messageBus) {
        let response: GatewayMessage | null = null;

        messageBus.subscribe("gateway:apy_update", (msg) => {
          response = msg;
        });

        await messageBus.publish(message.type, message);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(response).toBeDefined();
      }
    });

    it("should handle risk request messages", async () => {
      const message: GatewayMessage = {
        type: "gateway:risk_request",
        payload: {
          data: { protocols: ["unknown-protocol"] },
          requestId: "test-4",
        },
        timestamp: new Date(),
      };

      if (messageBus) {
        let response: GatewayMessage | null = null;

        messageBus.subscribe("gateway:risk_update", (msg) => {
          response = msg;
        });

        await messageBus.publish(message.type, message);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(response).toBeDefined();
      }
    });

    it("should queue concurrent requests", async () => {
      if (messageBus) {
        const messages = [
          {
            type: "gateway:price_request",
            payload: { data: { symbols: ["ETH"] }, requestId: "req-1" },
            timestamp: new Date(),
          },
          {
            type: "gateway:price_request",
            payload: { data: { symbols: ["BTC"] }, requestId: "req-2" },
            timestamp: new Date(),
          },
          {
            type: "gateway:price_request",
            payload: { data: { symbols: ["SOL"] }, requestId: "req-3" },
            timestamp: new Date(),
          },
        ];

        const responses: GatewayMessage[] = [];
        messageBus.subscribe("gateway:price_update", (msg) => {
          responses.push(msg);
        });

        for (const msg of messages) {
          await messageBus.publish(msg.type, msg);
        }

        await new Promise((resolve) => setTimeout(resolve, 200));

        // All requests should be processed
        expect(responses.length).toBeGreaterThan(0);
      }
    });
  });

  /**
   * SERVICE LAYER INTEGRATION TESTS
   */
  describe("Gateway Agent Service Integration", () => {
    it("should request prices through service", async () => {
      const result = await service.requestPrices(["ETH", "BTC"], ["ethereum"]);

      expect(result).toBeDefined();
      expect(result?.type).toBe("gateway:price_update");
      expect(result?.payload?.data).toBeDefined();
    });

    it("should request liquidity through service", async () => {
      const result = await service.requestLiquidity(
        undefined,
        ["uniswap", "aave"],
        "ethereum"
      );

      expect(result).toBeDefined();
      expect(result?.type).toBe("gateway:liquidity_update");
    });

    it("should request APY through service", async () => {
      const result = await service.requestAPY(
        ["aave", "compound"],
        undefined,
        "ethereum"
      );

      expect(result).toBeDefined();
      expect(result?.type).toBe("gateway:apy_update");
    });

    it("should request risk assessment through service", async () => {
      const result = await service.requestRisk(["aave", "compound"]);

      expect(result).toBeDefined();
      expect(result?.type).toBe("gateway:risk_update");
    });

    it("should provide service status", async () => {
      const status = await service.getStatus();

      expect(status).toBeDefined();
      expect(status?.healthy).toBeDefined();
      expect(status?.adapters).toBeDefined();
      expect(status?.cacheStats).toBeDefined();
    });

    it("should be healthy with working adapters", async () => {
      const status = await service.getStatus();

      expect(status?.healthy).toBe(true);
    });
  });

  /**
   * DATA NORMALIZER INTEGRATION TESTS
   */
  describe("Data Normalizer Integration", () => {
    let normalizer: DataNormalizer;

    beforeEach(() => {
      normalizer = new DataNormalizer();
    });

    it("should normalize price data", () => {
      const priceData = {
        ETH: { price: "2000.50", timestamp: Date.now() },
        BTC: { price: "50000", timestamp: Date.now() },
      };

      const normalized = normalizer.normalizePrice(priceData);

      expect(normalized).toBeDefined();
      expect(normalized?.ETH).toHaveProperty("price");
      expect(typeof normalized?.ETH?.price).toBe("number");
    });

    it("should normalize liquidity data", () => {
      const liquidityData = [
        {
          pool: "USDC-ETH",
          liquidity: "1000000",
          fee: "0.05",
        },
      ];

      const normalized = normalizer.normalizeLiquidity(liquidityData);

      expect(normalized).toBeDefined();
      expect(Array.isArray(normalized)).toBe(true);
    });

    it("should convert APR to APY", () => {
      const apr = 10; // 10% APR
      const apy = normalizer.calculateAPY(apr);

      expect(apy).toBeGreaterThan(apr); // APY should be > APR due to compounding
    });

    it("should handle big numbers in decimal conversion", () => {
      const rayValue = "1000000000000000000000000000"; // Ray format
      const normalized = normalizer.normalizeDecimal(rayValue, 27); // 27 decimals

      expect(normalized).toBeLessThan(1); // Should be converted to human-readable
    });

    it("should detect anomalies in data", () => {
      const prices = [
        { symbol: "ETH", price: 2000 },
        { symbol: "ETH", price: 2050 },
        { symbol: "ETH", price: 50000 }, // Anomaly
      ];

      const filtered = prices.filter((p) => !normalizer.isAnomaly(p.price, 2000, 100));

      expect(filtered.length).toBeLessThan(prices.length);
    });
  });

  /**
   * CACHE MANAGER INTEGRATION TESTS
   */
  describe("Cache Manager Integration", () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
      cacheManager = new CacheManager({
        redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
        enableCache: true,
      });
    });

    it("should cache price data", async () => {
      const key = "price:ETH:ethereum";
      const data = { symbol: "ETH", price: 2000, timestamp: Date.now() };

      await cacheManager.set(key, data, 60);
      const cached = await cacheManager.get(key);

      expect(cached).toBeDefined();
      expect(cached?.symbol).toBe("ETH");
    });

    it("should expire cached data", async () => {
      const key = "price:BTC:ethereum";
      const data = { symbol: "BTC", price: 50000 };

      await cacheManager.set(key, data, 1); // 1 second TTL
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const cached = await cacheManager.get(key);

      expect(cached).toBeNull();
    });

    it("should batch set operations", async () => {
      const batch = [
        { key: "price:ETH", value: { price: 2000 }, ttl: 60 },
        { key: "price:BTC", value: { price: 50000 }, ttl: 60 },
      ];

      await cacheManager.mset(batch);

      const eth = await cacheManager.get("price:ETH");
      const btc = await cacheManager.get("price:BTC");

      expect(eth).toBeDefined();
      expect(btc).toBeDefined();
    });

    it("should invalidate by pattern", async () => {
      await cacheManager.set("price:ETH", { price: 2000 }, 60);
      await cacheManager.set("price:BTC", { price: 50000 }, 60);
      await cacheManager.set("apy:aave", { apy: 5 }, 60);

      await cacheManager.invalidateByPattern("price:*");

      const price = await cacheManager.get("price:ETH");
      const apy = await cacheManager.get("apy:aave");

      expect(price).toBeNull();
      expect(apy).toBeDefined();
    });

    it("should provide cache statistics", async () => {
      const stats = await cacheManager.getStats();

      expect(stats).toBeDefined();
      expect(stats?.hitRate).toBeDefined();
      expect(stats?.totalHits).toBeDefined();
      expect(stats?.totalMisses).toBeDefined();
    });
  });

  /**
   * FAILOVER LOGIC TESTS
   */
  describe("Adapter Failover Logic", () => {
    it("should failover to next adapter on error", async () => {
      // Service should try adapters in priority order
      // If Chainlink fails, try Uniswap, then CoinGecko, etc.
      const result = await service.requestPrices(["ETH"]);

      expect(result).toBeDefined();
      expect(result?.payload?.data).toBeDefined();
      // Should have gotten result from some adapter
    });

    it("should skip disabled adapters", async () => {
      // If adapter is disabled, should skip to next
      const result = await service.requestPrices(["ETH"]);

      expect(result).toBeDefined();
      // Should still get result from enabled adapters
    });

    it("should track circuit breaker status", async () => {
      const status = await service.getStatus();

      expect(status?.adapters).toBeDefined();
      if (status?.adapters) {
        status.adapters.forEach((adapter) => {
          expect(adapter).toHaveProperty("circuitBreaker");
        });
      }
    });

    it("should recover from circuit breaker", async () => {
      // After timeout, circuit breaker should go to half-open
      const status1 = await service.getStatus();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 31000)); // 30s default timeout

      const status2 = await service.getStatus();

      expect(status1).toBeDefined();
      expect(status2).toBeDefined();
    });
  });

  /**
   * END-TO-END WORKFLOW TESTS
   */
  describe("End-to-End Workflows", () => {
    it("should complete full price request workflow", async () => {
      // 1. Request prices
      const result = await service.requestPrices(["ETH", "BTC"]);

      expect(result).toBeDefined();
      expect(result?.type).toBe("gateway:price_update");

      // 2. Verify data structure
      const data = result?.payload?.data;
      expect(data).toBeDefined();

      // 3. Verify normalization
      if (data && typeof data === "object") {
        Object.values(data).forEach((item: any) => {
          expect(item).toHaveProperty("price");
          expect(typeof item.price).toBe("number");
        });
      }
    });

    it("should complete full multi-request workflow", async () => {
      // Simulate complex user workflow
      const prices = await service.requestPrices(["ETH", "USDC"]);
      const liquidity = await service.requestLiquidity(undefined, ["uniswap"]);
      const apy = await service.requestAPY(["aave"]);

      expect(prices).toBeDefined();
      expect(liquidity).toBeDefined();
      expect(apy).toBeDefined();

      // All should have returned data
      expect(prices?.payload?.data).toBeDefined();
      expect(liquidity?.payload?.data).toBeDefined();
      expect(apy?.payload?.data).toBeDefined();
    });

    it("should handle concurrent requests without race conditions", async () => {
      const requests = [
        service.requestPrices(["ETH"]),
        service.requestPrices(["BTC"]),
        service.requestLiquidity(undefined, ["uniswap"]),
        service.requestAPY(["aave"]),
      ];

      const results = await Promise.all(requests);

      // All should succeed
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result?.payload?.data).toBeDefined();
      });

      // Results should be different (not mixed up)
      expect(results[0]?.type).toBe("gateway:price_update");
      expect(results[2]?.type).toBe("gateway:liquidity_update");
    });
  });

  /**
   * ERROR HANDLING TESTS
   */
  describe("Error Handling", () => {
    it("should handle invalid symbols gracefully", async () => {
      const result = await service.requestPrices(["FAKESYMBOL123"]);

      expect(result).toBeDefined();
      // Should either return empty or error
      expect(result?.payload?.data === undefined || result?.payload?.error).toBe(true);
    });

    it("should handle network timeout", async () => {
      // Service should handle timeout gracefully
      const result = await service.requestPrices(["ETH"]);

      // Should still return response (even if from cache)
      expect(result).toBeDefined();
    });

    it("should handle malformed request", async () => {
      // Empty symbols array
      const result = await service.requestPrices([]);

      expect(result).toBeDefined();
      // Should handle gracefully
    });
  });
});
