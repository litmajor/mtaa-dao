/**
 * Gateway Security Middleware
 * Express middleware to apply security checks to all Gateway endpoints
 */

import { Request, Response, NextFunction } from "express";
import { SecureGatewayService } from "./security-integration";
import { SecurityAssessment } from "./security-wrapper";

/**
 * Extend Express Request to include security context
 */
declare global {
  namespace Express {
    interface Request {
      securityAssessment?: SecurityAssessment;
      gatewaySecurityWarnings?: string[];
      gatewayUser?: string;
    }
  }
}

/**
 * Security context for requests
 */
export interface SecurityContext {
  userId?: string;
  requestId: string;
  timestamp: Date;
  assessmentRequired: boolean;
  assessment?: SecurityAssessment;
}

/**
 * Create security middleware factory
 */
export function createGatewaySecurityMiddleware(secureService: SecureGatewayService) {
  /**
   * Middleware to add security context
   */
  const securityContextMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    // Extract user from request (adapt based on your auth system)
    const userId = (req as any).user?.id || (req as any).userId || undefined;

    // Generate request ID if not present
    const requestId = (req as any).id || (req as any).requestId || `req-${Date.now()}`;

    // Store in request
    (req as any).gatewayUser = userId;
    (req as any).securityContext = {
      userId,
      requestId,
      timestamp: new Date(),
      assessmentRequired: true,
    };

    next();
  };

  /**
   * Middleware to enforce security assessments
   */
  const enforceSecurity = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const assessment = (req as any).securityAssessment;

    // If assessment shows access denied, block request
    if (assessment && !assessment.allowed) {
      console.warn(`[Security Middleware] Blocking request for user: ${(req as any).gatewayUser}`, {
        riskLevel: assessment.riskLevel,
        concerns: assessment.concerns,
      });

      return res.status(403).json({
        success: false,
        error: "Access denied due to security/ethical concerns",
        details: {
          riskLevel: assessment.riskLevel,
          riskScore: assessment.riskScore,
          ethicalScore: assessment.ethicalScore,
          concerns: assessment.concerns,
          recommendations: assessment.recommendations,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // If assessment has warnings, add to response headers
    if (assessment && assessment.requiresReview) {
      res.setHeader("X-Gateway-Security-Review-Required", "true");
      res.setHeader("X-Gateway-Risk-Level", assessment.riskLevel);
    }

    next();
  };

  /**
   * Middleware to add security metadata to response
   */
  const addSecurityMetadata = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
      const assessment = (req as any).securityAssessment;

      // Add security metadata to response if available
      if (assessment) {
        data._security = {
          riskScore: assessment.riskScore,
          ethicalScore: assessment.ethicalScore,
          riskLevel: assessment.riskLevel,
          requiresReview: assessment.requiresReview,
          assessedAt: assessment.reviewedAt?.toISOString(),
        };
      }

      return originalJson(data);
    };

    next();
  };

  /**
   * Middleware to assess price requests
   */
  const assessPriceRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { symbols, chains, source } = req.query;
      const userId = (req as any).gatewayUser;

      if (Array.isArray(symbols) || typeof symbols === "string") {
        // Mock assessment for now - in production, would call secureService
        const assessment = {
          allowed: true,
          riskLevel: "low" as const,
          riskScore: 10,
          ethicalScore: 95,
          concerns: [] as string[],
          recommendations: [] as string[],
          requiresReview: false,
          reviewedAt: new Date(),
        };

        (req as any).securityAssessment = assessment;
      }

      next();
    } catch (error) {
      console.error("[Security Middleware] Price assessment error:", error);
      next(error);
    }
  };

  /**
   * Middleware to assess liquidity requests
   */
  const assessLiquidityRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { protocols, pools, chain } = req.query;
      const userId = (req as any).gatewayUser;

      // Check for suspicious protocol patterns
      const suspiciousProtocols: string[] = [];
      if (typeof protocols === "string") {
        const protoList = protocols.split(",");
        // Add checks for flagged protocols
      }

      const assessment = {
        allowed: suspiciousProtocols.length === 0,
        riskLevel: suspiciousProtocols.length > 0 ? ("high" as const) : ("low" as const),
        riskScore: suspiciousProtocols.length > 0 ? 70 : 15,
        ethicalScore: 90,
        concerns: suspiciousProtocols.map((p) => `Flagged protocol: ${p}`),
        recommendations: ["Verify protocol before interacting"],
        requiresReview: suspiciousProtocols.length > 0,
        reviewedAt: new Date(),
      };

      (req as any).securityAssessment = assessment;
      next();
    } catch (error) {
      console.error("[Security Middleware] Liquidity assessment error:", error);
      next(error);
    }
  };

  /**
   * Middleware to assess APY requests
   */
  const assessAPYRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { protocols, assets } = req.query;

      // Check for suspicious APY patterns (would integrate with ELD-LUMEN in production)
      const assessment = {
        allowed: true,
        riskLevel: "low" as const,
        riskScore: 20,
        ethicalScore: 85,
        concerns: [] as string[],
        recommendations: ["Verify APY sustainability"] as string[],
        requiresReview: false,
        reviewedAt: new Date(),
      };

      (req as any).securityAssessment = assessment;
      next();
    } catch (error) {
      console.error("[Security Middleware] APY assessment error:", error);
      next(error);
    }
  };

  /**
   * Middleware to assess risk requests
   */
  const assessRiskRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { protocols } = req.query;

      // Risk requests should be transparent about assessments
      const assessment = {
        allowed: true,
        riskLevel: "low" as const,
        riskScore: 25,
        ethicalScore: 100,
        concerns: [] as string[],
        recommendations: [] as string[],
        requiresReview: false,
        reviewedAt: new Date(),
      };

      (req as any).securityAssessment = assessment;
      next();
    } catch (error) {
      console.error("[Security Middleware] Risk assessment error:", error);
      next(error);
    }
  };

  /**
   * Rate limiting for security
   */
  const rateLimitSecurityChecks = new Map<string, number[]>();
  const rateLimitMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const userId = (req as any).gatewayUser || "anonymous";
    const now = Date.now();
    const window = 60000; // 1 minute

    // Get user's request timestamps
    let timestamps = rateLimitSecurityChecks.get(userId) || [];

    // Filter timestamps within window
    timestamps = timestamps.filter((t) => now - t < window);

    // Check if exceeded (max 100 requests per minute)
    if (timestamps.length > 100) {
      return res.status(429).json({
        success: false,
        error: "Rate limit exceeded",
        retryAfter: Math.ceil(window / 1000),
      });
    }

    // Add current timestamp
    timestamps.push(now);
    rateLimitSecurityChecks.set(userId, timestamps);

    // Cleanup old entries
    if (rateLimitSecurityChecks.size > 10000) {
      const firstKey = rateLimitSecurityChecks.keys().next().value;
      if (firstKey) {
        rateLimitSecurityChecks.delete(firstKey);
      }
    }

    next();
  };

  /**
   * Log security events
   */
  const logSecurityEvents = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const assessment = (req as any).securityAssessment;
    const userId = (req as any).gatewayUser;

    // Log high-risk events
    if (assessment && assessment.riskScore > 50) {
      console.warn(`[Security Event] High-risk request from ${userId}`, {
        path: req.path,
        method: req.method,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        concerns: assessment.concerns,
        timestamp: new Date().toISOString(),
      });
    }

    // Log denied requests
    if (assessment && !assessment.allowed) {
      console.error(`[Security Event] Denied request from ${userId}`, {
        path: req.path,
        method: req.method,
        riskScore: assessment.riskScore,
        ethicalScore: assessment.ethicalScore,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };

  /**
   * Combine all middlewares
   */
  return {
    securityContextMiddleware,
    assessPriceRequest,
    assessLiquidityRequest,
    assessAPYRequest,
    assessRiskRequest,
    enforceSecurity,
    addSecurityMetadata,
    rateLimitMiddleware,
    logSecurityEvents,
  };
}

/**
 * Apply all security middlewares to Express app
 */
export function applyGatewaySecurityMiddlewares(
  app: any,
  secureService: SecureGatewayService
): void {
  const middlewares = createGatewaySecurityMiddleware(secureService);

  // Global middlewares
  app.use(middlewares.securityContextMiddleware);
  app.use(middlewares.rateLimitMiddleware);
  app.use(middlewares.logSecurityEvents);

  // Specific route middlewares (apply these to specific routes in gateway.ts)
  // Example:
  // app.get('/api/v1/gateway/prices', middlewares.assessPriceRequest, middlewares.enforceSecurity, ...);
}

export default createGatewaySecurityMiddleware;
