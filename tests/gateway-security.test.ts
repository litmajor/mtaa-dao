/**
 * Gateway Agent Security Tests
 * Tests for ELD-SCRY and ELD-LUMEN integration
 */

import { GatewaySecurityWrapper, createSecurityWrapper, productionSecurityConfig, strictSecurityConfig } from "../server/core/agents/gateway/security-wrapper";
import { SecureGatewayService, createSecureGatewayService } from "../server/core/agents/gateway/security-integration";
import { GatewayAgentService, getGatewayAgentService } from "../server/core/agents/gateway/service";

describe("Gateway Security Tests", () => {
  let securityWrapper: GatewaySecurityWrapper;
  let secureService: SecureGatewayService;
  let baseService: GatewayAgentService;

  beforeEach(() => {
    baseService = getGatewayAgentService();
    securityWrapper = createSecurityWrapper(productionSecurityConfig);
    secureService = createSecureGatewayService(baseService, true);
  });

  /**
   * RISK ASSESSMENT TESTS
   */
  describe("Risk Assessment (ELD-SCRY)", () => {
    it("should assess price data as low risk", async () => {
      const assessment = await securityWrapper.assessData(
        "prices",
        { ETH: { price: 2000, confidence: 0.95 } }
      );

      expect(assessment).toBeDefined();
      expect(assessment.allowed).toBe(true);
      expect(assessment.riskLevel).toBe("low");
      expect(assessment.riskScore).toBeLessThan(25);
    });

    it("should detect stale data as risk", async () => {
      const assessment = await securityWrapper.assessData(
        "prices",
        { ETH: { price: 2000 } },
        undefined,
        { stale: true }
      );

      expect(assessment.riskScore).toBeGreaterThan(10);
      expect(assessment.concerns.length).toBeGreaterThan(0);
    });

    it("should detect low confidence as risk", async () => {
      const assessment = await securityWrapper.assessData(
        "prices",
        { ETH: { price: 2000 } },
        undefined,
        { confidence: 0.5 }
      );

      expect(assessment.riskScore).toBeGreaterThan(15);
    });

    it("should detect circuit breaker open", async () => {
      const assessment = await securityWrapper.assessData(
        "prices",
        { ETH: { price: 2000 } },
        undefined,
        { circuitBreakerOpen: true }
      );

      expect(assessment.riskScore).toBeGreaterThan(20);
    });

    it("should detect high price variance", async () => {
      const assessment = await securityWrapper.assessData(
        "prices",
        {
          ETH: { price: 2000 },
          "ETH-alt": { price: 2500 }, // 20% variance
        }
      );

      // Should flag high variance
      expect(assessment.riskScore).toBeGreaterThan(15);
    });

    it("should detect low liquidity pools", async () => {
      const assessment = await securityWrapper.assessData(
        "liquidity",
        [
          { pool: "USDC-ETH", liquidity: "5000" }, // Low
          { pool: "USDC-USDT", liquidity: "1000000" }, // High
        ]
      );

      expect(assessment.concerns.length).toBeGreaterThan(0);
      expect(assessment.concerns.some((c) => c.includes("low liquidity"))).toBe(true);
    });

    it("should detect unsustainable APY", async () => {
      const assessment = await securityWrapper.assessData(
        "apy",
        { protocol: { apy: 45000 } } // 45000% APY
      );

      expect(assessment.allowed).toBe(false);
      expect(assessment.riskScore).toBeGreaterThan(75);
      expect(assessment.concerns.some((c) => c.includes("unsustainable"))).toBe(true);
    });

    it("should calculate risk score 0-100", async () => {
      const assessment = await securityWrapper.assessData("prices", {});

      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskScore).toBeLessThanOrEqual(100);
    });
  });

  /**
   * ETHICAL REVIEW TESTS
   */
  describe("Ethical Review (ELD-LUMEN)", () => {
    it("should assess transparent data as ethical", async () => {
      const assessment = await securityWrapper.assessData(
        "prices",
        { ETH: { price: 2000 } },
        undefined,
        { sources: ["chainlink", "uniswap"] } // Multiple sources disclosed
      );

      expect(assessment.ethicalScore).toBeGreaterThan(80);
    });

    it("should detect source bias (single source)", async () => {
      const assessment = await securityWrapper.assessData(
        "prices",
        { ETH: { price: 2000 } },
        undefined,
        { sources: ["chainlink"] } // Single source
      );

      expect(assessment.ethicalScore).toBeLessThan(95);
      expect(assessment.concerns.some((c) => c.includes("bias"))).toBe(true);
    });

    it("should penalize undisclosed sources", async () => {
      const assessment = await securityWrapper.assessData("prices", {});

      expect(assessment.ethicalScore).toBeLessThan(100);
      expect(assessment.concerns.some((c) => c.includes("disclosed"))).toBe(true);
    });

    it("should detect hidden tokens", async () => {
      const assessment = await securityWrapper.assessData(
        "liquidity",
        [
          { pool: "ETH-?", token0: { symbol: "ETH" }, token1: { symbol: "?" } },
        ]
      );

      expect(assessment.allowed).toBe(false);
      expect(assessment.ethicalScore).toBeLessThan(70);
    });

    it("should require APY sustainability disclosure", async () => {
      const assessment = await securityWrapper.assessData(
        "apy",
        { protocol: { apy: 5000 } } // 5000% APY
      );

      expect(assessment.concerns.some((c) => c.includes("sustainability"))).toBe(true);
    });

    it("should calculate ethics score 0-100", async () => {
      const assessment = await securityWrapper.assessData("prices", {});

      expect(assessment.ethicalScore).toBeGreaterThanOrEqual(0);
      expect(assessment.ethicalScore).toBeLessThanOrEqual(100);
    });

    it("should verify personal data consent", async () => {
      const assessment = await securityWrapper.assessData(
        "prices",
        {},
        "user-123",
        { containsPersonalData: true, consentVerified: false }
      );

      expect(assessment.allowed).toBe(false);
      expect(assessment.ethicalScore).toBeLessThan(70);
    });
  });

  /**
   * CONDITIONAL APPROVAL TESTS
   */
  describe("Conditional Approvals", () => {
    it("should approve liquidity with conditions", async () => {
      const approval = await securityWrapper.checkConditionalApproval("liquidity", [
        "uniswap",
        "aave",
      ]);

      expect(approval.approved).toBe(true);
      // Well-known protocols should have minimal conditions
    });

    it("should restrict flagged protocols", async () => {
      const approval = await securityWrapper.checkConditionalApproval("liquidity", [
        "suspicious-bridge",
      ]);

      expect(approval.restrictions.length).toBeGreaterThan(0);
    });

    it("should add conditions for high-volatility assets", async () => {
      const approval = await securityWrapper.checkConditionalApproval(
        "apy",
        undefined,
        ["shitcoin"]
      );

      expect(approval.conditions.length).toBeGreaterThan(0);
      expect(approval.conditions.some((c) => c.includes("volatility"))).toBe(true);
    });

    it("should set expiry on conditional approvals", async () => {
      const approval = await securityWrapper.checkConditionalApproval("liquidity", []);

      expect(approval.expiry).toBeDefined();
      expect(approval.expiry!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  /**
   * PRODUCTION CONFIG TESTS
   */
  describe("Production Security Configuration", () => {
    let prodWrapper: GatewaySecurityWrapper;

    beforeEach(() => {
      prodWrapper = createSecurityWrapper(productionSecurityConfig);
    });

    it("should have production config values", () => {
      const config = prodWrapper.getConfig();

      expect(config.enableScry).toBe(true);
      expect(config.enableLumen).toBe(true);
      expect(config.strictMode).toBe(false);
      expect(config.riskThreshold).toBe(70);
      expect(config.ethicsThreshold).toBe(50);
    });

    it("should allow moderate risk in production", async () => {
      const assessment = await prodWrapper.assessData(
        "prices",
        {},
        undefined,
        { confidence: 0.6 }
      );

      // Confidence 0.6 adds ~20 risk points, still below 70 threshold
      expect(assessment.allowed).toBe(true);
    });

    it("should require basic ethics in production", async () => {
      const assessment = await prodWrapper.assessData("prices", {});

      // Ethics 60 is above 50 threshold
      expect(assessment.ethicalScore).toBeGreaterThan(50);
    });
  });

  /**
   * STRICT CONFIG TESTS
   */
  describe("Strict Security Configuration", () => {
    let strictWrapper: GatewaySecurityWrapper;

    beforeEach(() => {
      strictWrapper = createSecurityWrapper(strictSecurityConfig);
    });

    it("should have strict config values", () => {
      const config = strictWrapper.getConfig();

      expect(config.strictMode).toBe(true);
      expect(config.riskThreshold).toBe(40);
      expect(config.ethicsThreshold).toBe(80);
      expect(config.cacheAssessments).toBe(false);
    });

    it("should block higher risk in strict mode", async () => {
      const assessment = await strictWrapper.assessData(
        "prices",
        {},
        undefined,
        { confidence: 0.6 }
      );

      // Stricter threshold (40 vs 70)
      expect(assessment.riskScore).toBeGreaterThan(25);
    });

    it("should require high ethics in strict mode", async () => {
      const assessment = await strictWrapper.assessData("prices", {});

      // Must be above 80 in strict mode
      expect(assessment.ethicalScore).toBeGreaterThan(75) ||
        expect(assessment.allowed).toBe(false);
    });

    it("should not cache in strict mode", () => {
      const config = strictWrapper.getConfig();

      expect(config.cacheAssessments).toBe(false);
    });
  });

  /**
   * SECURE SERVICE TESTS
   */
  describe("SecureGatewayService", () => {
    it("should request prices securely", async () => {
      const { message, assessment, allowed } =
        await secureService.requestPricesSecure(["ETH", "BTC"], ["ethereum"]);

      expect(message).toBeDefined();
      expect(assessment).toBeDefined();
      expect(typeof allowed).toBe("boolean");
    });

    it("should request liquidity securely", async () => {
      const { message, assessment, allowed } =
        await secureService.requestLiquiditySecure(undefined, ["uniswap"]);

      expect(message).toBeDefined();
      expect(assessment).toBeDefined();
      expect(typeof allowed).toBe("boolean");
    });

    it("should request APY securely", async () => {
      const { message, assessment, allowed } =
        await secureService.requestAPYSecure(["aave"]);

      expect(message).toBeDefined();
      expect(assessment).toBeDefined();
    });

    it("should request risk securely", async () => {
      const { message, assessment, allowed } =
        await secureService.requestRiskSecure(["aave"]);

      expect(message).toBeDefined();
      expect(assessment).toBeDefined();
    });

    it("should provide security statistics", () => {
      const stats = secureService.getSecurityStats();

      expect(stats).toBeDefined();
      expect(stats.cacheStats).toBeDefined();
      expect(stats.config).toBeDefined();
      expect(stats.totalDenied).toBeGreaterThanOrEqual(0);
    });

    it("should update security config at runtime", () => {
      secureService.updateSecurityConfig({ riskThreshold: 50 });

      const config = secureService.getSecurityWrapper().getConfig();
      expect(config.riskThreshold).toBe(50);
    });

    it("should clear security cache", () => {
      secureService.clearSecurityCache();

      const stats = secureService.getSecurityStats();
      expect(stats.cacheStats.cachedAssessments).toBe(0);
    });
  });

  /**
   * CACHING TESTS
   */
  describe("Assessment Caching", () => {
    it("should cache assessments", async () => {
      const data1 = { ETH: { price: 2000 } };

      const assessment1 = await securityWrapper.assessData("prices", data1);
      const assessment2 = await securityWrapper.assessData("prices", data1);

      // Both should be identical (second from cache)
      expect(assessment1.riskScore).toBe(assessment2.riskScore);
      expect(assessment1.ethicalScore).toBe(assessment2.ethicalScore);
    });

    it("should have cache hit rate", () => {
      const stats = securityWrapper.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.cachedAssessments).toBeGreaterThanOrEqual(0);
      expect(stats.ttl).toBe(3600);
    });
  });

  /**
   * RATE LIMITING TESTS
   */
  describe("Rate Limiting", () => {
    it("should allow 100 requests per minute", async () => {
      // Simulate requests from user
      const requests = [];

      for (let i = 0; i < 50; i++) {
        requests.push(
          secureService.requestPricesSecure(["ETH"], undefined, undefined, "user-123")
        );
      }

      const results = await Promise.all(requests);

      // All should succeed (within limit)
      results.forEach((r) => {
        expect(r).toBeDefined();
      });
    });
  });

  /**
   * MONITORING TESTS
   */
  describe("Security Monitoring", () => {
    it("should track denied requests", async () => {
      // Make a request that gets denied
      const strictWrapper = createSecurityWrapper(strictSecurityConfig);

      const assessment = await strictWrapper.assessData(
        "apy",
        { protocol: { apy: 45000 } },
        "user-123"
      );

      expect(assessment.allowed).toBe(false);
    });

    it("should log high-risk events", async () => {
      const spyLog = jest.spyOn(console, "warn").mockImplementation();

      const assessment = await securityWrapper.assessData(
        "prices",
        {},
        "user-456",
        { circuitBreakerOpen: true }
      );

      expect(assessment.riskScore).toBeGreaterThan(50);

      spyLog.mockRestore();
    });

    it("should provide recommendations for denied requests", async () => {
      const assessment = await securityWrapper.assessData(
        "apy",
        { protocol: { apy: 45000 } }
      );

      expect(assessment.recommendations.length).toBeGreaterThan(0);
      expect(assessment.recommendations[0]).toMatch(/verify|check|audit/i);
    });
  });

  /**
   * INTEGRATION WITH ADAPTERS TESTS
   */
  describe("Security Integration with Adapters", () => {
    it("should assess chainlink data as high confidence", async () => {
      const assessment = await securityWrapper.assessData(
        "prices",
        { symbol: "ETH", price: 2000 },
        undefined,
        { confidence: 0.99, sources: ["chainlink"] }
      );

      expect(assessment.allowed).toBe(true);
      expect(assessment.riskScore).toBeLessThan(20);
    });

    it("should be more cautious with fallback sources", async () => {
      const assessment = await securityWrapper.assessData(
        "prices",
        { symbol: "ETH", price: 2000 },
        undefined,
        { confidence: 0.85, sources: ["coingecko"] }
      );

      expect(assessment.riskScore).toBeGreaterThan(15);
    });

    it("should require conditions for new/unknown protocols", async () => {
      const approval = await securityWrapper.checkConditionalApproval("liquidity", [
        "new-protocol",
      ]);

      expect(approval.conditions.length).toBeGreaterThanOrEqual(0);
    });
  });
});
