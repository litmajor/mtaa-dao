/**
 * Gateway Agent REST API Routes
 * Provides HTTP endpoints for price, liquidity, APY, risk, and health data
 * Response format: GatewayResponse<NormalizedData[]>
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { type GatewayAgentService } from "../core/agents/gateway/service";
import { getGatewayAgentService } from "../core/agents/gateway/service";
import { marketDataClient } from "../services/marketDataClient";
import { authenticateToken } from "../middleware/auth";
import { rateLimitPerUser } from "../middleware/rateLimit";

const gatewayAgentRateLimiter = rateLimitPerUser(
  'gateway-agent',
  Number(process.env.GATEWAY_RATE_LIMIT_MAX || 60),
  process.env.GATEWAY_RATE_LIMIT_WINDOW || '1min',
);

// Local type definition to avoid circular imports
interface GatewayResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  requestId?: string;
  cacheHit?: boolean;
  age?: number;
  metadata?: {
    source?: string;
    latencyMs?: number;
    [key: string]: any;
  };
}


/**
 * Create gateway routes
 */
export function createGatewayRoutes(service?: GatewayAgentService): Router {
  const router = Router();
  const gatewayService = service || getGatewayAgentService();

  if (process.env.GATEWAY_REQUIRE_AUTH !== 'false') {
    router.use(authenticateToken as any);
  }
  router.use(gatewayAgentRateLimiter as any);

  /**
   * GET /api/v1/gateway/prices
   * Request prices for multiple assets
   *
   * Query Parameters:
   * - symbols: comma-separated list of symbols (BTC,ETH,cUSD)
   * - chains: comma-separated list of chains (celo,ethereum)
   * - preferredSource: preferred adapter (chainlink, uniswap, coingecko)
   *
   * Response: GatewayResponse<NormalizedData[]>
   */
  router.get("/prices", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!gatewayService.isHealthy()) {
        return sendResponse(res, 503, {
          success: false,
          error: 'Gateway service unavailable',
          requestId: generateRequestId(),
          timestamp: new Date().toISOString(),
        });
      }
      const requestId = generateRequestId();
      const startTime = Date.now();

      const symbols = (req.query.symbols as string)?.split(",").filter(Boolean) || [];
      const chains = (req.query.chains as string)?.split(",").filter(Boolean);
      const preferredSource = req.query.preferredSource as string;

      if (!symbols.length) {
        return sendResponse(res, 400, {
          success: false,
          error: "symbols parameter required (comma-separated)",
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      // Request through message bus
      const prices = await Promise.all(
        symbols.map((symbol) => marketDataClient.getPrice(symbol, Number(chains?.[0] || 42220), preferredSource))
      );

      const latencyMs = Date.now() - startTime;

      return sendResponse(res, 200, {
        success: true,
        data: prices.filter(Boolean),
        timestamp: new Date().toISOString(),
        requestId,
        metadata: {
          source: preferredSource || "market-data-plane",
          latencyMs,
          cacheHit: false,
        },
      });
    } catch (error) {
      return handleError(res, error, "prices");
    }
  });

  /**
   * GET /api/v1/gateway/liquidity
   * Request liquidity data from DEXes
   *
   * Query Parameters:
   * - protocols: comma-separated list (uniswap,moola)
   * - pools: comma-separated list of pool addresses
   * - chain: blockchain name (celo, ethereum)
   *
   * Response: GatewayResponse<NormalizedData[]>
   */
  router.get("/liquidity", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!gatewayService.isHealthy()) {
        return sendResponse(res, 503, {
          success: false,
          error: 'Gateway service unavailable',
          requestId: generateRequestId(),
          timestamp: new Date().toISOString(),
        });
      }
      const requestId = generateRequestId();
      const startTime = Date.now();

      const protocols = (req.query.protocols as string)?.split(",").filter(Boolean) || [];
      const pools = (req.query.pools as string)?.split(",").filter(Boolean);
      const chain = req.query.chain as string;

      if (!protocols.length) {
        return sendResponse(res, 400, {
          success: false,
          error: "protocols parameter required (comma-separated)",
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const liquidity = await Promise.all(
        (pools.length ? pools : ['default']).map((pool) =>
          marketDataClient.getLiquidity(pool, pool, Number(chain === 'celo' ? 42220 : 1))
        )
      );

      const latencyMs = Date.now() - startTime;

      return sendResponse(res, 200, {
        success: true,
        data: liquidity.filter(Boolean),
        timestamp: new Date().toISOString(),
        requestId,
        metadata: {
          source: protocols.join(",") || 'market-data-plane',
          latencyMs,
          cacheHit: false,
        },
      });
    } catch (error) {
      return handleError(res, error, "liquidity");
    }
  });

  /**
   * GET /api/v1/gateway/apy
   * Request APY/yield data from lending/yield protocols
   *
   * Query Parameters:
   * - protocols: comma-separated list (moola,beefyfi,aave)
   * - assets: comma-separated list of assets (cUSD,USDC,DAI)
   * - chain: blockchain name (celo)
   *
   * Response: GatewayResponse<NormalizedData[]>
   */
  router.get("/apy", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!gatewayService.isHealthy()) {
        return sendResponse(res, 503, {
          success: false,
          error: 'Gateway service unavailable',
          requestId: generateRequestId(),
          timestamp: new Date().toISOString(),
        });
      }
      const requestId = generateRequestId();
      const startTime = Date.now();

      const protocols = (req.query.protocols as string)?.split(",").filter(Boolean) || [];
      const assets = (req.query.assets as string)?.split(",").filter(Boolean);
      const chain = req.query.chain as string;

      if (!protocols.length) {
        return sendResponse(res, 400, {
          success: false,
          error: "protocols parameter required (comma-separated)",
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const request = await gatewayService.requestAPY(protocols, assets, chain);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const latencyMs = Date.now() - startTime;

      return sendResponse(res, 200, {
        success: true,
        data: request?.payload?.data || [],
        timestamp: new Date().toISOString(),
        requestId,
        metadata: {
          source: protocols.join(","),
          latencyMs,
          cacheHit: (request?.payload as any)?.cacheHit || false,
        },
      });
    } catch (error) {
      return handleError(res, error, "apy");
    }
  });

  /**
   * GET /api/v1/gateway/risk
   * Request risk assessment for protocols
   *
   * Query Parameters:
   * - protocols: comma-separated list (uniswap,moola,curve)
   *
   * Response: GatewayResponse<NormalizedData[]>
   */
  router.get("/risk", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!gatewayService.isHealthy()) {
        return sendResponse(res, 503, {
          success: false,
          error: 'Gateway service unavailable',
          requestId: generateRequestId(),
          timestamp: new Date().toISOString(),
        });
      }
      const requestId = generateRequestId();
      const startTime = Date.now();

      const protocols = (req.query.protocols as string)?.split(",").filter(Boolean) || [];

      if (!protocols.length) {
        return sendResponse(res, 400, {
          success: false,
          error: "protocols parameter required (comma-separated)",
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const request = await gatewayService.requestRisk(protocols);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const latencyMs = Date.now() - startTime;

      return sendResponse(res, 200, {
        success: true,
        data: request?.payload?.data || [],
        timestamp: new Date().toISOString(),
        requestId,
        metadata: {
          source: "risk-assessment",
          latencyMs,
          cacheHit: (request?.payload as any)?.cacheHit || false,
        },
      });
    } catch (error) {
      return handleError(res, error, "risk");
    }
  });

  /**
   * GET /api/v1/gateway/price/:symbol
   * Get price for single symbol
   *
   * Path Parameters:
   * - symbol: asset symbol (BTC, ETH, cUSD)
   *
   * Query Parameters:
   * - chains: comma-separated chains (default: celo)
   * - source: preferred source (chainlink, uniswap)
   *
   * Response: GatewayResponse<NormalizedData>
   */
  router.get("/price/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!gatewayService.isHealthy()) {
        return sendResponse(res, 503, {
          success: false,
          error: 'Gateway service unavailable',
          requestId: generateRequestId(),
          timestamp: new Date().toISOString(),
        });
      }
      const requestId = generateRequestId();
      const startTime = Date.now();

      const { symbol } = req.params;
      const chains = (req.query.chains as string)?.split(",") || ["celo"];
      const source = req.query.source as string;

      if (!symbol) {
        return sendResponse(res, 400, {
          success: false,
          error: "symbol parameter required",
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const price = await marketDataClient.getPrice(symbol, Number(chains?.[0] || 42220), source);

      const latencyMs = Date.now() - startTime;

      return sendResponse(res, 200, {
        success: true,
        data: price || null,
        timestamp: new Date().toISOString(),
        requestId,
        metadata: {
          source: source || "market-data-plane",
          latencyMs,
          cacheHit: false,
        },
      });
    } catch (error) {
      return handleError(res, error, `price/${req.params.symbol}`);
    }
  });

  /**
   * GET /api/v1/gateway/health
   * Get Gateway Agent health status
   *
   * Response: { healthy: boolean; status: any; }
   */
  router.get("/health", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = generateRequestId();
      if (!gatewayService.isHealthy()) {
        return sendResponse(res, 503, {
          success: false,
          error: 'Gateway service unavailable',
          timestamp: new Date().toISOString(),
          requestId,
        });
      }

      const status = await gatewayService.getStatus();

      return sendResponse(res, 200, {
        success: gatewayService.isHealthy(),
        data: status,
        timestamp: new Date().toISOString(),
        metadata: {
          source: "gateway-service",
        },
        requestId,
      });
    } catch (error) {
      return handleError(res, error, "health");
    }
  });

  /**
   * GET /api/v1/gateway/stats
   * Get detailed statistics
   */
  router.get("/stats", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = generateRequestId();
      const status = await gatewayService.getStatus();

      return sendResponse(res, 200, {
        success: true,
        data: {
          service: status.service,
          gateway: status.gateway,
          cache: status.gateway.cache,
          adapters: status.gateway.adapters,
        },
        timestamp: new Date().toISOString(),
        metadata: {
          source: "gateway-service",
        },
        requestId,
      });
    } catch (error) {
      return handleError(res, error, "stats");
    }
  });

  /**
   * POST /api/v1/gateway/invalidate-cache
   * Invalidate cache entries
   *
   * Body:
   * {
   *   pattern?: string;        // Glob pattern for cache keys
   *   dataType?: string;       // Type to invalidate (price, apy, etc)
   *   source?: string;         // Source to invalidate
   *   all?: boolean;           // Clear all cache
   * }
   */
  router.post("/invalidate-cache", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = generateRequestId();
      const { pattern, dataType, source, all } = req.body;

      // In production, validate auth/permissions
      // if (!isAdmin(req.user)) return sendResponse(res, 403, { error: "Unauthorized" });

      // Send cache invalidation message through bus
      const invalidationMessage = {
        type: "gateway:cache_invalidate" as const,
        from: "REST-API",
        timestamp: new Date(),
        payload: {
          pattern,
          dataType,
          source,
          all,
          requestId,
        },
      };

      // This would be published through message bus in production
      console.log("Cache invalidation requested:", invalidationMessage.payload);

      return sendResponse(res, 200, {
        success: true,
        data: { invalidated: true, requestId },
        timestamp: new Date().toISOString(),
        requestId,
      });
    } catch (error) {
      return handleError(res, error, "invalidate-cache");
    }
  });

  return router;
}

/**
 * Helper: Send standardized response
 */
function sendResponse<T>(res: Response, statusCode: number, data: GatewayResponse<T>) {
  return res.status(statusCode).json({
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  });
}

/**
 * Helper: Handle errors
 */
function handleError(res: Response, error: any, endpoint: string) {
  const requestId = generateRequestId();
  const statusCode = error.statusCode || 500;

  console.error(`[Gateway API] ${endpoint} error:`, error);

  return sendResponse(res, statusCode, {
    success: false,
    error: error.message || "Internal server error",
    requestId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Helper: Generate unique request ID
 */
function generateRequestId(): string {
  return `req:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
}
