/**
 * Gateway Agent Security Integration
 * Applies ELD-SCRY and ELD-LUMEN security checks to all Gateway responses
 */

import { GatewayAgentService } from "./service";
import {
  GatewaySecurityWrapper,
  createSecurityWrapper,
  productionSecurityConfig,
  strictSecurityConfig,
  SecurityConfig,
  SecurityAssessment,
} from "./security-wrapper";
import { GatewayMessage, GatewayMessageType } from "./types";

/**
 * Secure Gateway Service - wraps GatewayAgentService with security layer
 */
export class SecureGatewayService {
  private service: GatewayAgentService;
  private securityWrapper: GatewaySecurityWrapper;
  private deniedRequests = new Map<string, number>();

  constructor(
    service: GatewayAgentService,
    securityConfig?: Partial<SecurityConfig>
  ) {
    this.service = service;
    this.securityWrapper = createSecurityWrapper(securityConfig);
  }

  /**
   * Request prices with security checks
   */
  async requestPricesSecure(
    symbols: string[],
    chains?: string[],
    source?: string,
    userId?: string
  ): Promise<{
    message: GatewayMessage;
    assessment: SecurityAssessment;
    allowed: boolean;
  }> {
    try {
      // Get data from service
      const message = await this.service.requestPrices(symbols, chains, source);

      if (!message) {
        return {
          message: {
            type: "gateway:error" as GatewayMessageType,
            from: "SECURE-GATEWAY-SERVICE",
            payload: { error: "No response from service" },
            timestamp: new Date(),
          },
          assessment: {
            allowed: false,
            riskLevel: "high",
            riskScore: 75,
            ethicalScore: 50,
            concerns: ["Service unavailable"],
            recommendations: ["Retry request"],
            requiresReview: true,
          },
          allowed: false,
        };
      }

      // Apply security wrapper
      const { message: secureMessage, assessment } =
        await this.securityWrapper.wrapResponse(message, "prices", userId);

      return {
        message: secureMessage,
        assessment,
        allowed: assessment.allowed,
      };
    } catch (error) {
      console.error("[Secure Gateway] Price request error:", error);
      throw error;
    }
  }

  /**
   * Request liquidity with security checks
   */
  async requestLiquiditySecure(
    pools?: string[],
    protocols?: string[],
    chain?: string,
    userId?: string
  ): Promise<{
    message: GatewayMessage;
    assessment: SecurityAssessment;
    allowed: boolean;
  }> {
    try {
      const message = await this.service.requestLiquidity(
        pools,
        protocols,
        chain
      );

      if (!message) {
        return {
          message: {
            type: "gateway:error" as GatewayMessageType,
            from: "SECURE-GATEWAY-SERVICE",
            payload: { error: "No response from service" },
            timestamp: new Date(),
          },
          assessment: {
            allowed: false,
            riskLevel: "high",
            riskScore: 75,
            ethicalScore: 50,
            concerns: ["Service unavailable"],
            recommendations: ["Retry request"],
            requiresReview: true,
          },
          allowed: false,
        };
      }

      // Check conditional approvals
      const conditionalApproval =
        await this.securityWrapper.checkConditionalApproval(
          "liquidity",
          protocols
        );

      if (!conditionalApproval.approved) {
        return {
          message: {
            type: "gateway:access_denied" as GatewayMessageType,
            from: "SECURE-GATEWAY-SERVICE",
            payload: {
              error: "Conditional approval failed",
              restrictions: conditionalApproval.restrictions,
            },
            timestamp: new Date(),
          },
          assessment: {
            allowed: false,
            riskLevel: "high",
            riskScore: 80,
            ethicalScore: 45,
            concerns: conditionalApproval.conditions,
            recommendations: [
              "Review restrictions and conditions",
            ],
            requiresReview: true,
          },
          allowed: false,
        };
      }

      const { message: secureMessage, assessment } =
        await this.securityWrapper.wrapResponse(message, "liquidity", userId);

      return {
        message: secureMessage,
        assessment,
        allowed: assessment.allowed,
      };
    } catch (error) {
      console.error("[Secure Gateway] Liquidity request error:", error);
      throw error;
    }
  }

  /**
   * Request APY with security checks
   */
  async requestAPYSecure(
    protocols: string[],
    assets?: string[],
    chain?: string,
    userId?: string
  ): Promise<{
    message: GatewayMessage;
    assessment: SecurityAssessment;
    allowed: boolean;
  }> {
    try {
      const message = await this.service.requestAPY(protocols, assets, chain);

      if (!message) {
        return {
          message: {
            type: "gateway:error" as GatewayMessageType,
            from: "SECURE-GATEWAY-SERVICE",
            payload: { error: "No response from service" },
            timestamp: new Date(),
          },
          assessment: {
            allowed: false,
            riskLevel: "high",
            riskScore: 75,
            ethicalScore: 50,
            concerns: ["Service unavailable"],
            recommendations: ["Retry request"],
            requiresReview: true,
          },
          allowed: false,
        };
      }

      // Check conditional approvals for APY (sustainability check)
      const conditionalApproval =
        await this.securityWrapper.checkConditionalApproval("apy", undefined, assets);

      if (!conditionalApproval.approved) {
        return {
          message: {
            type: "gateway:access_denied" as GatewayMessageType,
            from: "SECURE-GATEWAY-SERVICE",
            payload: {
              error: "APY sustainability concerns",
              conditions: conditionalApproval.conditions,
            },
            timestamp: new Date(),
          },
          assessment: {
            allowed: false,
            riskLevel: "high",
            riskScore: 85,
            ethicalScore: 40,
            concerns: conditionalApproval.conditions,
            recommendations: [
              "Verify APY is sustainable",
              "Check protocol audit status",
            ],
            requiresReview: true,
          },
          allowed: false,
        };
      }

      const { message: secureMessage, assessment } =
        await this.securityWrapper.wrapResponse(message, "apy", userId);

      return {
        message: secureMessage,
        assessment,
        allowed: assessment.allowed,
      };
    } catch (error) {
      console.error("[Secure Gateway] APY request error:", error);
      throw error;
    }
  }

  /**
   * Request risk assessment with security checks
   */
  async requestRiskSecure(
    protocols: string[],
    userId?: string
  ): Promise<{
    message: GatewayMessage;
    assessment: SecurityAssessment;
    allowed: boolean;
  }> {
    try {
      const message = await this.service.requestRisk(protocols);

      if (!message) {
        return {
          message: {
            type: "gateway:error" as GatewayMessageType,
            from: "SECURE-GATEWAY-SERVICE",
            payload: { error: "No response from service" },
            timestamp: new Date(),
          },
          assessment: {
            allowed: false,
            riskLevel: "critical",
            riskScore: 100,
            ethicalScore: 50,
            concerns: ["Service unavailable"],
            recommendations: ["Retry request"],
            requiresReview: true,
          },
          allowed: false,
        };
      }

      // Check conditional approvals
      const conditionalApproval =
        await this.securityWrapper.checkConditionalApproval("risk", protocols);

      // Risk data itself may have special handling
      const { message: secureMessage, assessment } =
        await this.securityWrapper.wrapResponse(message, "risk", userId);

      return {
        message: secureMessage,
        assessment,
        allowed: assessment.allowed,
      };
    } catch (error) {
      console.error("[Secure Gateway] Risk request error:", error);
      throw error;
    }
  }

  /**
   * Track denied requests for monitoring
   */
  private trackDeniedRequest(userId?: string): void {
    const key = userId || "anonymous";
    const current = this.deniedRequests.get(key) || 0;
    this.deniedRequests.set(key, current + 1);

    // Alert if suspicious pattern (>10 denials in 5 minutes)
    if (current > 10) {
      console.warn(`[Secure Gateway] High denial rate for user: ${key}`);
    }
  }

  /**
   * Get security statistics
   */
  getSecurityStats() {
    return {
      cacheStats: this.securityWrapper.getCacheStats(),
      config: this.securityWrapper.getConfig(),
      deniedRequestsBy: Object.fromEntries(this.deniedRequests),
      totalDenied: Array.from(this.deniedRequests.values()).reduce(
        (a, b) => a + b,
        0
      ),
    };
  }

  /**
   * Update security config
   */
  updateSecurityConfig(config: Partial<SecurityConfig>): void {
    this.securityWrapper.updateConfig(config);
  }

  /**
   * Clear security cache
   */
  clearSecurityCache(): void {
    this.securityWrapper.clearCache();
  }

  /**
   * Get underlying service
   */
  getService(): GatewayAgentService {
    return this.service;
  }

  /**
   * Get security wrapper
   */
  getSecurityWrapper(): GatewaySecurityWrapper {
    return this.securityWrapper;
  }
}

/**
 * Create secure gateway service
 */
export function createSecureGatewayService(
  service: GatewayAgentService,
  production: boolean = true
): SecureGatewayService {
  const config = production
    ? productionSecurityConfig
    : strictSecurityConfig;

  return new SecureGatewayService(service, config);
}

/**
 * Integration example for main application
 *
 * Usage in application:
 *
 * import { getGatewayAgentService } from './agents/gateway/service';
 * import { createSecureGatewayService } from './agents/gateway/security-integration';
 *
 * // Get the base service
 * const baseService = getGatewayAgentService();
 *
 * // Wrap with security
 * const secureService = createSecureGatewayService(baseService, true);
 *
 * // Use secure service for all public endpoints
 * app.get('/api/v1/gateway/prices', async (req, res) => {
 *   const { symbols, chains, source } = req.query;
 *   const userId = req.user?.id;
 *
 *   const { message, assessment, allowed } = await secureService.requestPricesSecure(
 *     symbols as string[],
 *     chains as string[],
 *     source as string,
 *     userId
 *   );
 *
 *   if (!allowed) {
 *     return res.status(403).json({
 *       success: false,
 *       error: 'Access denied',
 *       assessment: {
 *         riskLevel: assessment.riskLevel,
 *         concerns: assessment.concerns,
 *         recommendations: assessment.recommendations,
 *       },
 *     });
 *   }
 *
 *   res.json({
 *     success: true,
 *     data: message.payload?.data,
 *     assessment: {
 *       riskScore: assessment.riskScore,
 *       ethicalScore: assessment.ethicalScore,
 *       requiresReview: assessment.requiresReview,
 *     },
 *   });
 * });
 *
 * // Monitor security
 * app.get('/api/v1/gateway/security-stats', (req, res) => {
 *   res.json(secureService.getSecurityStats());
 * });
 */

export default createSecureGatewayService;
