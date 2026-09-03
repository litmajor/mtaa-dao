/**
 * Gateway API Routes
 * Exposes gateway functionality via REST endpoints
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GatewayService } from './gateway';
import type { GatewayQuoteRequest } from './types';
import { authenticateToken } from '../../middleware/auth';
import { rateLimitPerUser } from '../../middleware/rateLimit';

const gatewayRateLimiter = rateLimitPerUser(
  'gateway-data-plane',
  Number(process.env.GATEWAY_RATE_LIMIT_MAX || 60),
  process.env.GATEWAY_RATE_LIMIT_WINDOW || '1min'
);

/**
 * Helper to safely parse integer route parameters
 */
function parseChainId(param: string): number | null {
  const parsed = parseInt(param, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

/**
 * Helper to handle errors without leaking internal stack or system details
 */
function handleError(res: Response, error: unknown, fallbackMessage: string): Response {
  // In production, log error details to your logging service (e.g., Pino/Winston)
  // console.error(error);
  return res.status(500).json({
    success: false,
    error: fallbackMessage,
  });
}

export function createGatewayRoutes(gateway: GatewayService): Router {
  const router = Router();

  // Apply optional global auth and rate limiting
  if (process.env.GATEWAY_REQUIRE_AUTH !== 'false') {
    router.use(authenticateToken as unknown as (req: Request, res: Response, next: NextFunction) => void);
  }
  router.use(gatewayRateLimiter as unknown as (req: Request, res: Response, next: NextFunction) => void);

  // ============================================================================
  // PRICE ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/price/:token/:chainId
   */
  router.get('/price/:token/:chainId', async (req: Request, res: Response) => {
    try {
      const { token, chainId: rawChainId } = req.params;
      const chainId = parseChainId(rawChainId);

      if (!chainId || !token) {
        return res.status(400).json({ success: false, error: 'Invalid token or chainId parameter' });
      }

      const price = await gateway.getTokenPrice(token, chainId);

      if (!price) {
        return res.status(404).json({ success: false, error: 'Price not found' });
      }

      return res.json({
        success: true,
        data: price,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to get price');
    }
  });

  /**
   * POST /api/gateway/prices
   * Get prices for multiple tokens
   */
  router.post('/prices', async (req: Request, res: Response) => {
    try {
      const { tokens, chainId } = req.body;

      if (!Array.isArray(tokens) || tokens.length === 0 || typeof chainId !== 'number') {
        return res.status(400).json({ success: false, error: 'Valid tokens array and numeric chainId are required' });
      }

      const prices = await gateway.getPricesForTokens(tokens, chainId);
      return res.json({
        success: true,
        data: prices,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to get prices');
    }
  });

  /**
   * GET /api/gateway/price/:token/:chainId/aggregated
   */
  router.get('/price/:token/:chainId/aggregated', async (req: Request, res: Response) => {
    try {
      const { token, chainId: rawChainId } = req.params;
      const chainId = parseChainId(rawChainId);

      if (!chainId || !token) {
        return res.status(400).json({ success: false, error: 'Invalid token or chainId parameter' });
      }

      const price = await gateway.getAggregatedPrice(token, chainId);

      if (!price) {
        return res.status(404).json({ success: false, error: 'Price not found' });
      }

      return res.json({
        success: true,
        data: price,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to get aggregated price');
    }
  });

  // ============================================================================
  // LIQUIDITY ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/liquidity/:tokenA/:tokenB/:chainId
   */
  router.get('/liquidity/:tokenA/:tokenB/:chainId', async (req: Request, res: Response) => {
    try {
      const { tokenA, tokenB, chainId: rawChainId } = req.params;
      const chainId = parseChainId(rawChainId);

      if (!chainId || !tokenA || !tokenB) {
        return res.status(400).json({ success: false, error: 'Invalid tokens or chainId parameter' });
      }

      const liquidity = await gateway.getLiquidityInfo(tokenA, tokenB, chainId);

      if (!liquidity) {
        return res.status(404).json({ success: false, error: 'Liquidity info not found' });
      }

      return res.json({
        success: true,
        data: liquidity,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to get liquidity');
    }
  });

  /**
   * POST /api/gateway/liquidity/depth-analysis
   */
  router.post('/liquidity/depth-analysis', async (req: Request, res: Response) => {
    try {
      const { tokenA, tokenB, chainId, amounts } = req.body;

      if (!tokenA || !tokenB || typeof chainId !== 'number' || !Array.isArray(amounts)) {
        return res.status(400).json({ success: false, error: 'Invalid parameters for depth analysis' });
      }

      const analysis = await gateway.analyzeLiquidityDepth(tokenA, tokenB, chainId, amounts);
      return res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to analyze liquidity');
    }
  });

  /**
   * POST /api/gateway/liquidity/health-check
   */
  router.post('/liquidity/health-check', async (req: Request, res: Response) => {
    try {
      const { tokenA, tokenB, chainId, minLiquidity } = req.body;

      if (!tokenA || !tokenB || typeof chainId !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid parameters for liquidity health check' });
      }

      const health = await gateway.checkLiquidityHealth(tokenA, tokenB, chainId, minLiquidity);
      return res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to check liquidity health');
    }
  });

  // ============================================================================
  // GAS PRICE ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/gas/:chainId
   */
  router.get('/gas/:chainId', async (req: Request, res: Response) => {
    try {
      const { chainId: rawChainId } = req.params;
      const chainId = parseChainId(rawChainId);

      if (!chainId) {
        return res.status(400).json({ success: false, error: 'Invalid chainId parameter' });
      }

      const gasPrices = await gateway.getGasPrices(chainId);

      if (!gasPrices) {
        return res.status(404).json({ success: false, error: 'Gas prices not found' });
      }

      return res.json({
        success: true,
        data: gasPrices,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to get gas prices');
    }
  });

  /**
   * POST /api/gateway/gas/estimate
   */
  router.post('/gas/estimate', async (req: Request, res: Response) => {
    try {
      const { chainId, gasLimit, speedLevel } = req.body;

      if (typeof chainId !== 'number' || !gasLimit) {
        return res.status(400).json({ success: false, error: 'chainId and gasLimit required' });
      }

      const estimate = await gateway.getEstimatedGasCost(
        chainId,
        gasLimit,
        speedLevel || 'standard'
      );

      if (!estimate) {
        return res.status(404).json({ success: false, error: 'Cannot estimate gas' });
      }

      return res.json({
        success: true,
        data: estimate,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to estimate gas');
    }
  });

  /**
   * POST /api/gateway/gas/compare
   */
  router.post('/gas/compare', async (req: Request, res: Response) => {
    try {
      const { chainIds, gasLimit } = req.body;

      if (!Array.isArray(chainIds) || !gasLimit) {
        return res.status(400).json({ success: false, error: 'chainIds array and gasLimit required' });
      }

      const comparison = await gateway.compareGasAcrossChains(chainIds, gasLimit);
      return res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to compare gas');
    }
  });

  // ============================================================================
  // VOLUME ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/volume/:pair/:chainId
   */
  router.get('/volume/:pair/:chainId', async (req: Request, res: Response) => {
    try {
      const { pair, chainId: rawChainId } = req.params;
      const chainId = parseChainId(rawChainId);

      if (!chainId || !pair) {
        return res.status(400).json({ success: false, error: 'Invalid pair or chainId parameter' });
      }

      const timeframe = (req.query.timeframe as '24h' | '7d' | 'monthly') || '24h';
      const volume = await gateway.getVolumeData(pair, chainId, timeframe);

      if (!volume) {
        return res.status(404).json({ success: false, error: 'Volume data not found' });
      }

      return res.json({
        success: true,
        data: volume,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to get volume');
    }
  });

  /**
   * GET /api/gateway/market-activity/:chainId
   */
  router.get('/market-activity/:chainId', async (req: Request, res: Response) => {
    try {
      const { chainId: rawChainId } = req.params;
      const chainId = parseChainId(rawChainId);

      if (!chainId) {
        return res.status(400).json({ success: false, error: 'Invalid chainId parameter' });
      }

      const activity = await gateway.analyzeMarketActivity(chainId);

      if (!activity) {
        return res.status(404).json({ success: false, error: 'Market activity not found' });
      }

      return res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to analyze market activity');
    }
  });

  // ============================================================================
  // ROUTE ENDPOINTS
  // ============================================================================

  /**
   * POST /api/gateway/quote
   */
  router.post('/quote', async (req: Request, res: Response) => {
    try {
      const request: GatewayQuoteRequest = req.body;

      if (!request || !request.tokenIn || !request.tokenOut) {
        return res.status(400).json({ success: false, error: 'Invalid quote request payload' });
      }

      const response = await gateway.getOptimalRoute(request);

      if (!response) {
        return res.status(404).json({ success: false, error: 'No route found' });
      }

      return res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to get quote');
    }
  });

  /**
   * POST /api/gateway/recommendation
   */
  router.post('/recommendation', async (req: Request, res: Response) => {
    try {
      const request: GatewayQuoteRequest = req.body;

      if (!request || !request.tokenIn || !request.tokenOut) {
        return res.status(400).json({ success: false, error: 'Invalid route recommendation payload' });
      }

      const recommendation = await gateway.getRouteRecommendation(request);

      if (!recommendation) {
        return res.status(404).json({ success: false, error: 'No recommendation available' });
      }

      return res.json({
        success: true,
        data: recommendation,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to get recommendation');
    }
  });

  // ============================================================================
  // SECURITY ENDPOINTS
  // ============================================================================

  /**
   * POST /api/gateway/validate-route
   */
  router.post('/validate-route', async (req: Request, res: Response) => {
    try {
      const route = req.body;

      if (!route || typeof route !== 'object') {
        return res.status(400).json({ success: false, error: 'Route payload required' });
      }

      const audit = await gateway.validateRoute(route);
      return res.json({
        success: true,
        data: audit,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to validate route');
    }
  });

  /**
   * POST /api/gateway/validate-operation
   */
  router.post('/validate-operation', async (req: Request, res: Response) => {
    try {
      const { operation, params } = req.body;

      if (!operation || !params) {
        return res.status(400).json({ success: false, error: 'Operation and params are required' });
      }

      const validation = await gateway.validateOperation(operation, params);
      return res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to validate operation');
    }
  });

  // ============================================================================
  // MARKET DATA ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/market-snapshot
   */
  router.get('/market-snapshot', async (_req: Request, res: Response) => {
    try {
      const snapshot = await gateway.getMarketSnapshot();
      return res.json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to get market snapshot');
    }
  });

  // ============================================================================
  // HEALTH ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/health
   */
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const health = await gateway.getHealthStatus();
      return res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to get health status');
    }
  });

  return router;
}
