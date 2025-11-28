/**
 * Gateway API Routes
 * Exposes gateway functionality via REST endpoints
 */

import { Router, Request, Response } from 'express';
import { GatewayService } from './gateway';
import { GatewayQuoteRequest } from './types';

export function createGatewayRoutes(gateway: GatewayService): Router {
  const router = Router();

  // ============================================================================
  // PRICE ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/price/:token/:chainId
   * Get current token price
   */
  router.get('/price/:token/:chainId', async (req: Request, res: Response) => {
    try {
      const { token, chainId } = req.params;
      const price = await gateway.getTokenPrice(token, parseInt(chainId));

      if (!price) {
        return res.status(404).json({ error: 'Price not found' });
      }

      res.json({
        success: true,
        data: price,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get price' 
      });
    }
  });

  /**
   * GET /api/gateway/prices
   * Get prices for multiple tokens
   */
  router.post('/prices', async (req: Request, res: Response) => {
    try {
      const { tokens, chainId } = req.body;

      if (!Array.isArray(tokens) || !chainId) {
        return res.status(400).json({ error: 'tokens and chainId required' });
      }

      const prices = await gateway.getPricesForTokens(tokens, chainId);
      res.json({
        success: true,
        data: prices,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get prices' 
      });
    }
  });

  /**
   * GET /api/gateway/price/:token/:chainId/aggregated
   * Get aggregated price from multiple sources
   */
  router.get('/price/:token/:chainId/aggregated', async (req: Request, res: Response) => {
    try {
      const { token, chainId } = req.params;
      const price = await gateway.getAggregatedPrice(token, parseInt(chainId));

      if (!price) {
        return res.status(404).json({ error: 'Price not found' });
      }

      res.json({
        success: true,
        data: price,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get aggregated price' 
      });
    }
  });

  // ============================================================================
  // LIQUIDITY ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/liquidity/:tokenA/:tokenB/:chainId
   * Get liquidity info for token pair
   */
  router.get('/liquidity/:tokenA/:tokenB/:chainId', async (req: Request, res: Response) => {
    try {
      const { tokenA, tokenB, chainId } = req.params;
      const liquidity = await gateway.getLiquidityInfo(tokenA, tokenB, parseInt(chainId));

      if (!liquidity) {
        return res.status(404).json({ error: 'Liquidity info not found' });
      }

      res.json({
        success: true,
        data: liquidity,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get liquidity' 
      });
    }
  });

  /**
   * POST /api/gateway/liquidity/depth-analysis
   * Analyze liquidity depth for different amounts
   */
  router.post('/liquidity/depth-analysis', async (req: Request, res: Response) => {
    try {
      const { tokenA, tokenB, chainId, amounts } = req.body;

      const analysis = await gateway.analyzeLiquidityDepth(tokenA, tokenB, chainId, amounts);
      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to analyze liquidity' 
      });
    }
  });

  /**
   * POST /api/gateway/liquidity/health-check
   * Check if liquidity is healthy for operation
   */
  router.post('/liquidity/health-check', async (req: Request, res: Response) => {
    try {
      const { tokenA, tokenB, chainId, minLiquidity } = req.body;

      const health = await gateway.checkLiquidityHealth(tokenA, tokenB, chainId, minLiquidity);
      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to check liquidity health' 
      });
    }
  });

  // ============================================================================
  // GAS PRICE ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/gas/:chainId
   * Get gas prices for chain
   */
  router.get('/gas/:chainId', async (req: Request, res: Response) => {
    try {
      const { chainId } = req.params;
      const gasPrices = await gateway.getGasPrices(parseInt(chainId));

      if (!gasPrices) {
        return res.status(404).json({ error: 'Gas prices not found' });
      }

      res.json({
        success: true,
        data: gasPrices,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get gas prices' 
      });
    }
  });

  /**
   * POST /api/gateway/gas/estimate
   * Estimate gas cost for transaction
   */
  router.post('/gas/estimate', async (req: Request, res: Response) => {
    try {
      const { chainId, gasLimit, speedLevel } = req.body;

      const estimate = await gateway.getEstimatedGasCost(
        chainId,
        gasLimit,
        speedLevel || 'standard'
      );

      if (!estimate) {
        return res.status(404).json({ error: 'Cannot estimate gas' });
      }

      res.json({
        success: true,
        data: estimate,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to estimate gas' 
      });
    }
  });

  /**
   * POST /api/gateway/gas/compare
   * Compare gas costs across chains
   */
  router.post('/gas/compare', async (req: Request, res: Response) => {
    try {
      const { chainIds, gasLimit } = req.body;

      const comparison = await gateway.compareGasAcrossChains(chainIds, gasLimit);
      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to compare gas' 
      });
    }
  });

  // ============================================================================
  // VOLUME ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/volume/:pair/:chainId
   * Get trading volume for pair
   */
  router.get('/volume/:pair/:chainId', async (req: Request, res: Response) => {
    try {
      const { pair, chainId } = req.params;
      const timeframe = req.query.timeframe as '24h' | '7d' | 'monthly' || '24h';

      const volume = await gateway.getVolumeData(pair, parseInt(chainId), timeframe);

      if (!volume) {
        return res.status(404).json({ error: 'Volume data not found' });
      }

      res.json({
        success: true,
        data: volume,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get volume' 
      });
    }
  });

  /**
   * GET /api/gateway/market-activity/:chainId
   * Analyze market activity on chain
   */
  router.get('/market-activity/:chainId', async (req: Request, res: Response) => {
    try {
      const { chainId } = req.params;

      const activity = await gateway.analyzeMarketActivity(parseInt(chainId));

      if (!activity) {
        return res.status(404).json({ error: 'Market activity not found' });
      }

      res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to analyze market activity' 
      });
    }
  });

  // ============================================================================
  // ROUTE ENDPOINTS
  // ============================================================================

  /**
   * POST /api/gateway/quote
   * Get optimal route quote
   */
  router.post('/quote', async (req: Request, res: Response) => {
    try {
      const request: GatewayQuoteRequest = req.body;

      const response = await gateway.getOptimalRoute(request);

      if (!response) {
        return res.status(404).json({ error: 'No route found' });
      }

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get quote' 
      });
    }
  });

  /**
   * POST /api/gateway/recommendation
   * Get route recommendation
   */
  router.post('/recommendation', async (req: Request, res: Response) => {
    try {
      const request: GatewayQuoteRequest = req.body;

      const recommendation = await gateway.getRouteRecommendation(request);

      if (!recommendation) {
        return res.status(404).json({ error: 'No recommendation available' });
      }

      res.json({
        success: true,
        data: recommendation,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get recommendation' 
      });
    }
  });

  // ============================================================================
  // SECURITY ENDPOINTS
  // ============================================================================

  /**
   * POST /api/gateway/validate-route
   * Validate route for security
   */
  router.post('/validate-route', async (req: Request, res: Response) => {
    try {
      const route = req.body;

      const audit = await gateway.validateRoute(route);
      res.json({
        success: true,
        data: audit,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to validate route' 
      });
    }
  });

  /**
   * POST /api/gateway/validate-operation
   * Validate operation parameters
   */
  router.post('/validate-operation', async (req: Request, res: Response) => {
    try {
      const { operation, params } = req.body;

      const validation = await gateway.validateOperation(operation, params);
      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to validate operation' 
      });
    }
  });

  // ============================================================================
  // MARKET DATA ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/market-snapshot
   * Get current market snapshot
   */
  router.get('/market-snapshot', async (req: Request, res: Response) => {
    try {
      const snapshot = await gateway.getMarketSnapshot();
      res.json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get market snapshot' 
      });
    }
  });

  // ============================================================================
  // HEALTH ENDPOINTS
  // ============================================================================

  /**
   * GET /api/gateway/health
   * Get gateway health status
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await gateway.getHealthStatus();
      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get health status' 
      });
    }
  });

  return router;
}
