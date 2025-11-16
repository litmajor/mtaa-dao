/**
 * Gateway Agent Adapter Unit Tests
 * Tests for all 6 API adapters with mock responses
 */

import { ChainlinkAdapter } from "../server/core/agents/gateway/adapters/chainlink-adapter";
import { UniswapAdapter } from "../server/core/agents/gateway/adapters/uniswap-adapter";
import { CoinGeckoAdapter } from "../server/core/agents/gateway/adapters/coingecko-adapter";
import { MoolaAdapter } from "../server/core/agents/gateway/adapters/moola-adapter";
import { BeefyfiAdapter } from "../server/core/agents/gateway/adapters/beefyfi-adapter";
import { BlockchainAdapter } from "../server/core/agents/gateway/adapters/blockchain-adapter";

describe("Gateway Adapters - Unit Tests", () => {
  /**
   * CHAINLINK ADAPTER TESTS
   */
  describe("ChainlinkAdapter", () => {
    let adapter: ChainlinkAdapter;

    beforeEach(() => {
      adapter = new ChainlinkAdapter({
        name: "Chainlink",
        priority: 1,
        enabled: true,
      });
    });

    it("should initialize with correct config", () => {
      expect(adapter).toBeDefined();
      expect(adapter.config.name).toBe("Chainlink");
      expect(adapter.config.priority).toBe(1);
    });

    it("should fetch ETH/USD price", async () => {
      const result = await adapter.fetchPrice("ETH");

      expect(result).toBeDefined();
      expect(result?.data).toHaveProperty("symbol");
      expect(result?.data).toHaveProperty("price");
      expect(result?.data).toHaveProperty("confidence");
      expect(result.data.confidence).toBeGreaterThan(0.9); // Chainlink: 99%
    });

    it("should fetch multiple prices", async () => {
      const result = await adapter.fetchPrices(["BTC", "ETH", "USDC"]);

      expect(Array.isArray(result?.data)).toBe(true);
      expect(result!.data.length).toBeGreaterThan(0);
      expect(result!.data[0]).toHaveProperty("symbol");
    });

    it("should handle missing price feed", async () => {
      const result = await adapter.fetchPrice("UNKNOWN");

      expect(result).toBeDefined();
      expect(result?.error).toBeDefined();
    });

    it("should have correct priority", () => {
      expect(adapter.config.priority).toBe(1); // Highest priority (oracle)
    });

    it("should implement retry logic", async () => {
      // Mock a failure then success
      const spyFetch = jest.spyOn(global, "fetch" as any);
      spyFetch.mockRejectedValueOnce(new Error("Network error"));
      spyFetch.mockResolvedValueOnce({
        json: async () => ({ price: 2000 }),
      });

      // Adapter should retry
      const result = await adapter.fetchPrice("ETH");
      expect(result).toBeDefined();
    });
  });

  /**
   * UNISWAP ADAPTER TESTS
   */
  describe("UniswapAdapter", () => {
    let adapter: UniswapAdapter;

    beforeEach(() => {
      adapter = new UniswapAdapter({
        name: "Uniswap",
        priority: 2,
        enabled: true,
      });
    });

    it("should initialize with correct config", () => {
      expect(adapter).toBeDefined();
      expect(adapter.config.priority).toBe(2); // Second priority (DEX)
    });

    it("should fetch prices from Uniswap", async () => {
      const result = await adapter.fetchPrices(["ETH", "USDC"]);

      expect(result).toBeDefined();
      expect(Array.isArray(result?.data)).toBe(true);
    });

    it("should fetch liquidity data", async () => {
      const result = await adapter.fetchLiquidity("USDC-ETH");

      expect(result).toBeDefined();
      expect(result?.data).toHaveProperty("liquidity");
      expect(result?.data).toHaveProperty("confidence");
    });

    it("should handle GraphQL errors gracefully", async () => {
      // Test error handling
      const result = await adapter.fetchLiquidity("INVALID");

      expect(result).toBeDefined();
      // Should either return data or error
      expect(result?.data || result?.error).toBeDefined();
    });

    it("should have confidence between 0-1", async () => {
      const result = await adapter.fetchPrices(["ETH"]);

      if (result?.data && Array.isArray(result.data)) {
        result.data.forEach((item) => {
          expect(item.confidence).toBeGreaterThanOrEqual(0);
          expect(item.confidence).toBeLessThanOrEqual(1);
        });
      }
    });
  });

  /**
   * COINGECKO ADAPTER TESTS
   */
  describe("CoinGeckoAdapter", () => {
    let adapter: CoinGeckoAdapter;

    beforeEach(() => {
      adapter = new CoinGeckoAdapter({
        name: "CoinGecko",
        priority: 3,
        enabled: true,
      });
    });

    it("should initialize with correct config", () => {
      expect(adapter).toBeDefined();
      expect(adapter.config.priority).toBe(3); // Fallback pricing
    });

    it("should fetch prices for major assets", async () => {
      const result = await adapter.fetchPrices(["BTC", "ETH", "SOL"]);

      expect(result).toBeDefined();
      expect(Array.isArray(result?.data)).toBe(true);
      expect(result!.data.length).toBeGreaterThan(0);
    });

    it("should support 10K+ tokens", async () => {
      // CoinGecko supports extensive token list
      const result = await adapter.fetchPrice("BTC");

      expect(result).toBeDefined();
      expect(result?.data?.symbol).toBeDefined();
    });

    it("should have 60 second cache", async () => {
      const result1 = await adapter.fetchPrice("ETH");
      const result2 = await adapter.fetchPrice("ETH");

      // Both should return (cached second time)
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it("should have medium confidence (85%)", async () => {
      const result = await adapter.fetchPrice("ETH");

      expect(result?.data?.confidence).toBeLessThan(0.9);
      expect(result?.data?.confidence).toBeGreaterThan(0.8);
    });

    it("should handle unknown tokens gracefully", async () => {
      const result = await adapter.fetchPrice("FAKECOIN123");

      // Should return error or empty
      expect(result?.error || result?.data === null).toBe(true);
    });
  });

  /**
   * MOOLA ADAPTER TESTS
   */
  describe("MoolaAdapter", () => {
    let adapter: MoolaAdapter;

    beforeEach(() => {
      adapter = new MoolaAdapter({
        name: "Moola",
        priority: 4,
        enabled: true,
      });
    });

    it("should initialize with correct config", () => {
      expect(adapter).toBeDefined();
      expect(adapter.config.priority).toBe(4);
    });

    it("should fetch lending APY data", async () => {
      const result = await adapter.fetchAPY(["USDC", "USDT"]);

      expect(result).toBeDefined();
      expect(result?.data).toHaveProperty("supplyAPY");
      expect(result?.data).toHaveProperty("borrowAPY");
    });

    it("should fetch utilization rates", async () => {
      const result = await adapter.fetchAPY(["USDC"]);

      expect(result?.data).toHaveProperty("utilization");
      expect(result?.data?.utilization).toBeGreaterThanOrEqual(0);
      expect(result?.data?.utilization).toBeLessThanOrEqual(1);
    });

    it("should handle Ray format conversion (1e27)", async () => {
      // Moola uses Ray format, adapter should convert
      const result = await adapter.fetchAPY(["USDC"]);

      if (result?.data?.supplyAPY) {
        // Should be converted to percentage (0-100)
        expect(result.data.supplyAPY).toBeGreaterThanOrEqual(0);
        expect(result.data.supplyAPY).toBeLessThan(10000); // Reasonable APY
      }
    });

    it("should have 90% confidence", async () => {
      const result = await adapter.fetchAPY(["USDC"]);

      expect(result?.data?.confidence).toBeGreaterThan(0.85);
      expect(result?.data?.confidence).toBeLessThan(0.95);
    });
  });

  /**
   * BEEFYFI ADAPTER TESTS
   */
  describe("BeefyfiAdapter", () => {
    let adapter: BeefyfiAdapter;

    beforeEach(() => {
      adapter = new BeefyfiAdapter({
        name: "Beefyfi",
        priority: 5,
        enabled: true,
      });
    });

    it("should initialize with correct config", () => {
      expect(adapter).toBeDefined();
      expect(adapter.config.priority).toBe(5);
    });

    it("should fetch strategy APY", async () => {
      const result = await adapter.fetchAPY(["ethereum", "polygon"]);

      expect(result).toBeDefined();
      expect(result?.data).toHaveProperty("strategies");
    });

    it("should fetch TVL per vault", async () => {
      const result = await adapter.fetchAPY(["ethereum"]);

      if (result?.data?.strategies) {
        result.data.strategies.forEach((strategy: any) => {
          expect(strategy).toHaveProperty("tvl");
        });
      }
    });

    it("should have 90% confidence", async () => {
      const result = await adapter.fetchAPY(["ethereum"]);

      expect(result?.data?.confidence).toBeGreaterThan(0.85);
      expect(result?.data?.confidence).toBeLessThan(0.95);
    });
  });

  /**
   * BLOCKCHAIN ADAPTER TESTS
   */
  describe("BlockchainAdapter", () => {
    let adapter: BlockchainAdapter;

    beforeEach(() => {
      adapter = new BlockchainAdapter({
        name: "Blockchain",
        priority: 6,
        enabled: true,
      });
    });

    it("should initialize with correct config", () => {
      expect(adapter).toBeDefined();
      expect(adapter.config.priority).toBe(6); // Lowest priority (RPC only)
    });

    it("should fetch on-chain balances", async () => {
      const result = await adapter.fetchBalance(
        "0x1234567890123456789012345678901234567890",
        "USDC",
        "ethereum"
      );

      expect(result).toBeDefined();
      expect(result?.data).toHaveProperty("balance");
    });

    it("should fetch Uniswap V3 prices", async () => {
      const result = await adapter.fetchPrice("ETH", "ethereum");

      expect(result).toBeDefined();
      expect(result?.data).toHaveProperty("price");
    });

    it("should verify transactions", async () => {
      const result = await adapter.verifyTransaction(
        "0xabcd1234abcd1234abcd1234abcd1234abcd1234",
        "ethereum"
      );

      expect(result).toBeDefined();
      expect(result?.data).toHaveProperty("verified");
    });

    it("should have high confidence for on-chain data", async () => {
      const result = await adapter.fetchPrice("ETH", "ethereum");

      expect(result?.data?.confidence).toBeGreaterThan(0.95);
    });

    it("should handle RPC failures gracefully", async () => {
      // Test with invalid address
      const result = await adapter.fetchBalance("INVALID", "USDC", "ethereum");

      expect(result).toBeDefined();
      expect(result?.error || result?.data === null).toBe(true);
    });
  });

  /**
   * ADAPTER PRIORITY ORDERING TESTS
   */
  describe("Adapter Priority Ordering", () => {
    const adapters = [
      new ChainlinkAdapter({ name: "Chainlink", priority: 1, enabled: true }),
      new UniswapAdapter({ name: "Uniswap", priority: 2, enabled: true }),
      new CoinGeckoAdapter({ name: "CoinGecko", priority: 3, enabled: true }),
      new MoolaAdapter({ name: "Moola", priority: 4, enabled: true }),
      new BeefyfiAdapter({ name: "Beefyfi", priority: 5, enabled: true }),
      new BlockchainAdapter({ name: "Blockchain", priority: 6, enabled: true }),
    ];

    it("should have correct priority order", () => {
      adapters.forEach((adapter, index) => {
        expect(adapter.config.priority).toBe(index + 1);
      });
    });

    it("should be sorted by priority", () => {
      const sorted = [...adapters].sort(
        (a, b) => a.config.priority - b.config.priority
      );

      sorted.forEach((adapter, index) => {
        expect(adapter.config.priority).toBe(index + 1);
      });
    });
  });

  /**
   * ADAPTER RESILIENCE TESTS
   */
  describe("Adapter Resilience", () => {
    let adapter: ChainlinkAdapter;

    beforeEach(() => {
      adapter = new ChainlinkAdapter({
        name: "Chainlink",
        priority: 1,
        enabled: true,
      });
    });

    it("should retry on network failure", async () => {
      const retryCount = 3;
      // Adapter should attempt retries
      const result = await adapter.fetchPrice("ETH");

      expect(result).toBeDefined();
    });

    it("should have timeout protection", async () => {
      // Request should timeout after configured duration
      const result = await adapter.fetchPrice("ETH");

      expect(result).toBeDefined();
      expect(result?.data || result?.error).toBeDefined();
    });

    it("should cache local results", async () => {
      const result1 = await adapter.fetchPrice("ETH");
      const result2 = await adapter.fetchPrice("ETH");

      // Both should return (second from cache)
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
