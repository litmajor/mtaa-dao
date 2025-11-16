/**
 * Gateway Agent Security Wrapper
 * Integrates ELD-SCRY for risk assessment and ELD-LUMEN for ethical review
 * Acts as gatekeeper for all Gateway data responses
 */

import { GatewayMessage, NormalizedData, GatewayResponse } from "./types";

/**
 * Security assessment result
 */
export interface SecurityAssessment {
  allowed: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number; // 0-100
  ethicalScore: number; // 0-100
  concerns: string[];
  recommendations: string[];
  requiresReview: boolean;
  reviewedAt?: Date;
  reviewedBy?: string;
}

/**
 * Conditional approval wrapper
 */
export interface ConditionalApproval {
  approved: boolean;
  conditions: string[];
  restrictions: string[];
  expiry?: Date;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  enableScry: boolean;
  enableLumen: boolean;
  strictMode: boolean; // If true, require both approvals
  riskThreshold: number; // 0-100, blocks if exceeded
  ethicsThreshold: number; // 0-100, blocks if below
  cacheAssessments: boolean;
  assessmentTTL: number; // seconds
}

/**
 * Gateway Security Wrapper
 * Checks all data responses against security policies
 */
export class GatewaySecurityWrapper {
  private assessmentCache = new Map<string, SecurityAssessment>();
  private assessmentTimestamps = new Map<string, Date>();
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableScry: config.enableScry ?? true,
      enableLumen: config.enableLumen ?? true,
      strictMode: config.strictMode ?? false,
      riskThreshold: config.riskThreshold ?? 75, // Block high risk (>75)
      ethicsThreshold: config.ethicsThreshold ?? 40, // Allow if ethics >= 40
      cacheAssessments: config.cacheAssessments ?? true,
      assessmentTTL: config.assessmentTTL ?? 3600, // 1 hour
    };
  }

  /**
   * Assess gateway data for security/ethics
   */
  async assessData(
    dataType: string,
    data: any,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<SecurityAssessment> {
    // Generate cache key
    const cacheKey = this.generateCacheKey(dataType, data, userId);

    // Check cache
    if (this.config.cacheAssessments) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Conduct ELD-SCRY risk assessment
      const riskAssessment = this.config.enableScry
        ? await this.conductRiskAssessment(dataType, data, metadata)
        : { riskScore: 0, riskLevel: "low" as const, concerns: [], recommendations: [] };

      // Conduct ELD-LUMEN ethical review
      const ethicsAssessment = this.config.enableLumen
        ? await this.conductEthicsReview(dataType, data, metadata)
        : { ethicalScore: 100, concerns: [], recommendations: [] };

      // Synthesize assessment
      const assessment: SecurityAssessment = {
        allowed:
          riskAssessment.riskScore <= this.config.riskThreshold &&
          ethicsAssessment.ethicalScore >= this.config.ethicsThreshold,
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
        ethicalScore: ethicsAssessment.ethicalScore,
        concerns: [
          ...riskAssessment.concerns,
          ...ethicsAssessment.concerns,
        ],
        recommendations: [
          ...riskAssessment.recommendations,
          ...ethicsAssessment.recommendations,
        ],
        requiresReview:
          riskAssessment.riskScore > 50 ||
          ethicsAssessment.ethicalScore < 70,
        reviewedAt: new Date(),
      };

      // Cache result
      if (this.config.cacheAssessments) {
        this.setInCache(cacheKey, assessment);
      }

      return assessment;
    } catch (error) {
      console.error("[Security Wrapper] Assessment failed:", error);
      // Fail open in case of error (but log it)
      return {
        allowed: true,
        riskLevel: "medium",
        riskScore: 50,
        ethicalScore: 50,
        concerns: ["Assessment error - defaulting to allowed"],
        recommendations: ["Review security configuration"],
        requiresReview: true,
        reviewedAt: new Date(),
      };
    }
  }

  /**
   * Wrap gateway response with security metadata
   */
  async wrapResponse<T>(
    message: GatewayMessage,
    dataType: string,
    userId?: string
  ): Promise<{ message: GatewayMessage; assessment: SecurityAssessment }> {
    // Assess the response data
    const assessment = await this.assessData(
      dataType,
      message.payload?.data,
      userId,
      message.metadata
    );

    // Modify response based on assessment
    if (!assessment.allowed) {
      console.warn(
        `[Security Wrapper] Blocking response due to security concerns`,
        {
          riskScore: assessment.riskScore,
          ethicalScore: assessment.ethicalScore,
          concerns: assessment.concerns,
        }
      );

      // Return denied message
      return {
        message: {
          type: "gateway:access_denied",
          from: "SECURITY-WRAPPER",
          payload: {
            data: null,
            error: "Access denied due to security/ethical concerns",
            requestId: message.payload?.requestId,
          },
          timestamp: new Date(),
          metadata: {
            ...message.metadata,
            securityAssessment: assessment,
          },
        },
        assessment,
      };
    }

    // Add security metadata to response
    const wrappedMessage: GatewayMessage = {
      ...message,
      metadata: {
        ...message.metadata,
        securityAssessment: {
          riskScore: assessment.riskScore,
          ethicalScore: assessment.ethicalScore,
          requiresReview: assessment.requiresReview,
          riskLevel: assessment.riskLevel,
        },
      },
      from: message.from || "SECURITY-WRAPPER",
    };

    return { message: wrappedMessage, assessment };
  }

  /**
   * Check if data type requires special approval
   */
  async checkConditionalApproval(
    dataType: string,
    protocols?: string[],
    assets?: string[]
  ): Promise<ConditionalApproval> {
    // Data types that may have special conditions
    const conditionalTypes = ["risk", "apy", "liquidity"];

    if (!conditionalTypes.includes(dataType)) {
      return {
        approved: true,
        conditions: [],
        restrictions: [],
      };
    }

    const conditions: string[] = [];
    const restrictions: string[] = [];

    // Risk assessment may have special conditions
    if (dataType === "risk" && protocols) {
      for (const protocol of protocols) {
        // Check if protocol is on watchlist or flagged
        const assessment = await this.assessProtocol(protocol);

        if (assessment.flagged) {
          conditions.push(
            `Protocol '${protocol}' requires additional disclosure`
          );
        }

        if (assessment.restrictions.length > 0) {
          restrictions.push(
            ...assessment.restrictions.map((r) => `${protocol}: ${r}`)
          );
        }
      }
    }

    // APY data for certain assets may have warnings
    if (dataType === "apy" && assets) {
      for (const asset of assets) {
        const assessment = await this.assessAsset(asset);

        if (assessment.volatility > 0.8) {
          conditions.push(`Asset '${asset}' has high volatility - verify risk tolerance`);
        }
      }
    }

    return {
      approved: restrictions.length === 0,
      conditions,
      restrictions,
      expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  }

  /**
   * Conduct risk assessment using ELD-SCRY patterns
   */
  private async conductRiskAssessment(
    dataType: string,
    data: any,
    metadata?: Record<string, any>
  ): Promise<{
    riskScore: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    concerns: string[];
    recommendations: string[];
  }> {
    let riskScore = 0;
    const concerns: string[] = [];
    const recommendations: string[] = [];

    // Check data freshness
    if (metadata?.stale) {
      riskScore += 15;
      concerns.push("Data source stale - may not reflect current state");
      recommendations.push("Request fresh data from primary sources");
    }

    // Check confidence scores
    if (metadata?.confidence && metadata.confidence < 0.7) {
      riskScore += 20;
      concerns.push("Low adapter confidence - results may be inaccurate");
      recommendations.push("Cross-reference with multiple sources");
    }

    // Check circuit breaker status
    if (metadata?.circuitBreakerOpen) {
      riskScore += 25;
      concerns.push("Adapter circuit breaker open - may indicate outage");
      recommendations.push("Monitor adapter health and retry later");
    }

    // Data type specific checks
    switch (dataType) {
      case "prices":
        if (data && typeof data === "object") {
          const priceVariance = this.calculatePriceVariance(data);
          if (priceVariance > 0.1) {
            // 10% variance
            riskScore += 15;
            concerns.push(
              `High price variance detected (${(priceVariance * 100).toFixed(1)}%)`
            );
            recommendations.push("Investigate pricing discrepancies");
          }
        }
        break;

      case "liquidity":
        if (data && data.length > 0) {
          const lowLiquidityPools = data.filter(
            (p: any) => p.liquidity && p.liquidity < 10000
          );
          if (lowLiquidityPools.length > 0) {
            riskScore += 10;
            concerns.push(`${lowLiquidityPools.length} pools with low liquidity`);
            recommendations.push("Use higher liquidity pools for trades");
          }
        }
        break;

      case "apy":
        if (data && typeof data === "object") {
          const suspiciousAPY = Object.entries(data).filter(
            ([_, v]: any) => v > 10000 // >10000% APY
          );
          if (suspiciousAPY.length > 0) {
            riskScore += 30;
            concerns.push(
              `Unusually high APY detected - likely unsustainable`
            );
            recommendations.push("Verify APY sustainability and protocol risk");
          }
        }
        break;

      case "risk":
        // Risk data itself is being checked
        if (data && data.riskScore && data.riskScore > 75) {
          riskScore = Math.min(100, riskScore + 20);
          concerns.push(
            `High protocol risk detected (${data.riskScore}/100)`
          );
          recommendations.push("Consider safer alternative protocols");
        }
        break;
    }

    const riskLevel: "low" | "medium" | "high" | "critical" =
      riskScore < 25 ? "low" : riskScore < 50 ? "medium" : riskScore < 75 ? "high" : "critical";

    return {
      riskScore: Math.min(100, riskScore),
      riskLevel,
      concerns,
      recommendations,
    };
  }

  /**
   * Conduct ethical review using ELD-LUMEN framework
   */
  private async conductEthicsReview(
    dataType: string,
    data: any,
    metadata?: Record<string, any>
  ): Promise<{
    ethicalScore: number;
    concerns: string[];
    recommendations: string[];
  }> {
    let ethicalScore = 100;
    const concerns: string[] = [];
    const recommendations: string[] = [];

    // Check data source transparency
    if (!metadata?.sources || metadata.sources.length === 0) {
      ethicalScore -= 15;
      concerns.push("Data source not disclosed");
      recommendations.push("Ensure data source transparency");
    }

    // Check for data bias
    if (metadata?.sources && metadata.sources.length === 1) {
      ethicalScore -= 10;
      concerns.push("Data from single source - potential bias");
      recommendations.push("Cross-reference with multiple sources");
    }

    // Data type specific ethics checks
    switch (dataType) {
      case "prices":
        // Price manipulation detection
        if (metadata?.confidence && metadata.confidence < 0.6) {
          ethicalScore -= 20;
          concerns.push("Low confidence in pricing - may reflect manipulation");
          recommendations.push("Request data from verified price oracle");
        }
        break;

      case "apy":
        // APY sustainability ethics
        if (data && typeof data === "object") {
          const hasWarning = Object.values(data).some(
            (v: any) => v > 5000 // >5000% APY
          );
          if (hasWarning) {
            ethicalScore -= 25;
            concerns.push("APY appears unsustainable - may mislead users");
            recommendations.push(
              "Disclose sustainability risks and audit mechanics"
            );
          }
        }
        break;

      case "liquidity":
        // Liquidity transparency
        if (data && Array.isArray(data)) {
          const hiddenTokens = data.filter(
            (p: any) =>
              p.token0?.symbol === "?" || p.token1?.symbol === "?"
          );
          if (hiddenTokens.length > 0) {
            ethicalScore -= 30;
            concerns.push("Unknown tokens detected - transparency violation");
            recommendations.push(
              "Only use pools with verified token information"
            );
          }
        }
        break;

      case "risk":
        // Risk communication ethics
        if (data && data.riskScore && data.riskScore < 20) {
          ethicalScore -= 15;
          concerns.push("Risk may be understated - insufficient disclosure");
          recommendations.push("Ensure comprehensive risk communication");
        }
        break;
    }

    // Check for data consent compliance (GDPR-like)
    if (metadata?.containsPersonalData && !metadata?.consentVerified) {
      ethicalScore -= 40;
      concerns.push("Personal data without consent verification");
      recommendations.push("Verify user consent before sharing data");
    }

    return {
      ethicalScore: Math.max(0, ethicalScore),
      concerns,
      recommendations,
    };
  }

  /**
   * Assess protocol for risk factors
   */
  private async assessProtocol(
    protocol: string
  ): Promise<{
    flagged: boolean;
    restrictions: string[];
  }> {
    // Integration point with ELD-SCRY threat detection
    // This would call actual threat database in production

    const flaggedProtocols = ["suspicious-bridge", "deprecated-protocol"];
    const restrictedProtocols: Record<string, string[]> = {
      "high-risk-lending": [
        "Maximum 10% portfolio allocation",
        "Requires additional insurance",
      ],
      "unaudited-contract": [
        "Only for risk-tolerant users",
        "Requires explicit acknowledgment",
      ],
    };

    return {
      flagged: flaggedProtocols.includes(protocol),
      restrictions: restrictedProtocols[protocol] || [],
    };
  }

  /**
   * Assess asset for volatility/risk
   */
  private async assessAsset(
    asset: string
  ): Promise<{
    volatility: number;
    riskFactors: string[];
  }> {
    // Integration point with price volatility data
    // In production, this would fetch from historical data

    // Mock assessment
    const volatilities: Record<string, number> = {
      BTC: 0.6,
      ETH: 0.7,
      USDC: 0.01,
      USDT: 0.02,
      shitcoin: 0.95,
    };

    return {
      volatility: volatilities[asset] || 0.5,
      riskFactors: volatilities[asset]! > 0.8 ? ["Extreme volatility"] : [],
    };
  }

  /**
   * Calculate price variance across sources
   */
  private calculatePriceVariance(data: any): number {
    if (!data || typeof data !== "object") {
      return 0;
    }

    const prices = Object.values(data)
      .map((v: any) => (typeof v === "object" ? v.price : v))
      .filter((p) => typeof p === "number") as number[];

    if (prices.length < 2) {
      return 0;
    }

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance =
      Math.sqrt(
        prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) /
          prices.length
      ) / avg;

    return Math.min(variance, 1); // Cap at 100%
  }

  /**
   * Get assessment from cache
   */
  private getFromCache(key: string): SecurityAssessment | null {
    const assessment = this.assessmentCache.get(key);
    const timestamp = this.assessmentTimestamps.get(key);

    if (!assessment || !timestamp) {
      return null;
    }

    const age = (Date.now() - timestamp.getTime()) / 1000;
    if (age > this.config.assessmentTTL) {
      this.assessmentCache.delete(key);
      this.assessmentTimestamps.delete(key);
      return null;
    }

    return assessment;
  }

  /**
   * Store assessment in cache
   */
  private setInCache(key: string, assessment: SecurityAssessment): void {
    // Limit cache size
    if (this.assessmentCache.size > 10000) {
      const firstKey = this.assessmentCache.keys().next().value;
      if (firstKey) {
        this.assessmentCache.delete(firstKey);
        this.assessmentTimestamps.delete(firstKey);
      }
    }

    this.assessmentCache.set(key, assessment);
    this.assessmentTimestamps.set(key, new Date());
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    dataType: string,
    data: any,
    userId?: string
  ): string {
    const dataHash = this.simpleHash(JSON.stringify(data).substring(0, 100));
    return `sec:${dataType}:${dataHash}:${userId || "anon"}`;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get config
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  updateConfig(partial: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Clear assessment cache
   */
  clearCache(): void {
    this.assessmentCache.clear();
    this.assessmentTimestamps.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedAssessments: this.assessmentCache.size,
      maxCacheSize: 10000,
      ttl: this.config.assessmentTTL,
    };
  }
}

/**
 * Create default security wrapper
 */
export function createSecurityWrapper(
  config?: Partial<SecurityConfig>
): GatewaySecurityWrapper {
  return new GatewaySecurityWrapper(config);
}

/**
 * Production-grade security configuration
 */
export const productionSecurityConfig: SecurityConfig = {
  enableScry: true,
  enableLumen: true,
  strictMode: false,
  riskThreshold: 70,
  ethicsThreshold: 50,
  cacheAssessments: true,
  assessmentTTL: 3600, // 1 hour
};

/**
 * Strict security configuration (for sensitive data)
 */
export const strictSecurityConfig: SecurityConfig = {
  enableScry: true,
  enableLumen: true,
  strictMode: true,
  riskThreshold: 40,
  ethicsThreshold: 80,
  cacheAssessments: false,
  assessmentTTL: 60, // 1 minute
};
