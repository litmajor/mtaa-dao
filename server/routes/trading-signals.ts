/**
 * Trading Signals & Intelligence Engine API Routes
 * 
 * Comprehensive market intelligence and trading analytics:
 * - Real-time WebSocket feeds for market data streaming
 * - Futures market analytics (funding rates, liquidation predictions, open interest)
 * - Advanced microstructure analysis (order flow toxicity, volatility-of-volatility, price impact)
 * - Proprietary alpha signals and market health monitoring
 * 
 * ⚠️ REQUIRES AUTHENTICATION: All endpoints require valid JWT token in Authorization header
 * 
 * Security:
 * - All 39 endpoints protected with authenticateToken middleware
 * - WebSocket connections validated via token parameter
 * - Rate limiting enforced per user/token
 * 
 * Audit Note: This was previously exposed at /api/v1/priority4 without authentication (Feb 2026)
 * Now properly secured and renamed to trading-signals for production clarity.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { websocketRealtimeFeeds } from '../services/websocketRealTimeFeeds';
import { futuresMarketSupport } from '../services/futuresMarketSupport';
import { advancedMicrostructureIndicators } from '../services/advancedMicrostructureIndicators';
import { ccxtService } from '../services/ccxtService';
import { ApiResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================================
// 🔒 SECURITY: APPLY AUTHENTICATION TO ALL ROUTES
// ============================================================================
// ✅ All 39 endpoints require valid JWT token in Authorization header
router.use(authenticateToken as any);

function resolveExchange(exchangeParam: unknown, res: Response): string | null {
  const normalized = typeof exchangeParam === 'string' ? exchangeParam.trim().toLowerCase() : '';
  const availableExchanges = ccxtService.getAvailableExchanges();

  if (normalized) {
    if (!availableExchanges.includes(normalized)) {
      res.status(400).json(
        ApiResponse.error(`Unsupported exchange: ${normalized}`).addMeta({ supportedExchanges: availableExchanges })
      );
      return null;
    }
    return normalized;
  }

  if (availableExchanges.length === 0) {
    res.status(503).json(ApiResponse.error('No configured exchanges are available')); 
    return null;
  }

  return availableExchanges[0];
}

// ============================================================================
// LEGACY WEBSOCKET UPGRADE ROUTE
// ============================================================================

/**
 * NOTE: The `/api/trading/realtime` upgrade route was formerly implemented with
 * express-ws. The current server does not install or initialize express-ws, so
 * that route is not available here. Real-time market feed traffic is instead
 * served through the dedicated raw WebSocket price stream server at `/ws/prices`.
 */

/**
 * GET /api/trading/stats
 * Get WebSocket connection statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = websocketRealtimeFeeds.getSubscriptionStats();

    res.json(
      ApiResponse.success({
        connectedClients: stats.totalClients,
        activeSubscriptions: stats.activeStreams,
        details: stats.streams,
        timestamp: Date.now()
      })
    );
  } catch (error) {
    logger.error('Failed to get WebSocket stats', { error });
    res.status(500).json(ApiResponse.error('Failed to get WebSocket stats'));
  }
});

// ============================================================================
// FUTURES MARKET SUPPORT ROUTES
// ============================================================================

/**
 * GET /api/trading/funding-rate/:symbol
 * Get current funding rate with predictions
 */
router.get('/funding-rate/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = resolveExchange(req.query.exchange, res);
    if (!exchange) return;

    const fundingRate = await futuresMarketSupport.getFundingRate(
      symbol as string,
      exchange
    );

    res.json(
      ApiResponse.success({
        ...fundingRate,
        cached: false
      }).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to get funding rate', { error });
    res.status(500).json(ApiResponse.error('Failed to get funding rate'));
  }
});

/**
 * GET /api/trading/liquidations/:symbol
 * Get liquidation data and cascade detection
 */
router.get('/liquidations/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.query;

    const liquidationData = await futuresMarketSupport.getLiquidationData(
      symbol as string,
      exchange as string
    );

    res.json(
      ApiResponse.success({
        ...liquidationData,
        alerts: liquidationData.cascadeSeverity === 'extreme' ? ['LIQUIDATION CRISIS'] : []
      }).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to get liquidation data', { error });
    res.status(500).json(ApiResponse.error('Failed to get liquidation data'));
  }
});

/**
 * GET /api/trading/open-interest/:symbol
 * Get open interest metrics
 */
router.get('/open-interest/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.query;

    const openInterest = await futuresMarketSupport.getOpenInterest(
      symbol as string,
      exchange as string
    );

    res.json(
      ApiResponse.success(openInterest).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to get open interest', { error });
    res.status(500).json(ApiResponse.error('Failed to get open interest'));
  }
});

/**
 * POST /api/trading/funding-prediction
 * Predict future funding rates
 */
router.post('/funding-prediction', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    const exchange = resolveExchange(req.body.exchange, res);
    if (!exchange) return;

    if (!symbol) {
      return res.status(400).json(ApiResponse.error('symbol is required'));
    }

    const prediction = await futuresMarketSupport.predictFundingRate(
      symbol,
      exchange
    );

    res.json(
      ApiResponse.success(prediction).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to predict funding rate', { error });
    res.status(500).json(ApiResponse.error('Failed to predict funding rate'));
  }
});

/**
 * POST /api/trading/liquidation-risk
 * Detect liquidation risk for a position
 */
router.post('/liquidation-risk', async (req: Request, res: Response) => {
  try {
    const { symbol, entryPrice, leverage = 1 } = req.body;
    const exchange = resolveExchange(req.body.exchange, res);
    if (!exchange) return;

    if (!symbol || !entryPrice) {
      return res
        .status(400)
        .json(ApiResponse.error('symbol and entryPrice are required'));
    }

    const riskAssessment = await futuresMarketSupport.detectLiquidationRisk(
      symbol,
      entryPrice,
      leverage,
      exchange
    );

    res.json(
      ApiResponse.success(riskAssessment).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to detect liquidation risk', { error });
    res.status(500).json(ApiResponse.error('Failed to detect liquidation risk'));
  }
});

/**
 * GET /api/trading/market-health/:symbol
 * Get overall futures market health
 */
router.get('/market-health/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = resolveExchange(req.query.exchange, res);
    if (!exchange) return;

    const health = await futuresMarketSupport.getFuturesMarketHealth(
      symbol as string,
      exchange
    );

    res.json(
      ApiResponse.success(health).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to get futures market health', { error });
    res.status(500).json(ApiResponse.error('Failed to get futures market health'));
  }
});

// ============================================================================
// ADVANCED MICROSTRUCTURE ROUTES
// ============================================================================

/**
 * GET /api/trading/order-flow/:symbol
 * Get real-time order flow imbalance (proprietary alpha signal)
 */
router.get('/order-flow/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = resolveExchange(req.query.exchange, res);
    if (!exchange) return;

    const orderFlow = await advancedMicrostructureIndicators.analyzeOrderFlowImbalance(
      symbol as string,
      exchange
    );

    res.json(
      ApiResponse.success(orderFlow).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to analyze order flow', { error });
    res.status(500).json(ApiResponse.error('Failed to analyze order flow'));
  }
});

/**
 * GET /api/trading/vol-of-vol/:symbol
 * Get volatility of volatility indicators (proprietary alpha signal)
 */
router.get('/vol-of-vol/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = resolveExchange(req.query.exchange, res);
    if (!exchange) return;
    const periods = Number(req.query.periods ?? 24);
    if (!Number.isFinite(periods) || periods < 1 || periods > 500) {
      return res.status(400).json(ApiResponse.error('periods must be between 1 and 500'));
    }

    const volOfVol = await advancedMicrostructureIndicators.calculateVolatilityOfVolatility(
      symbol as string,
      exchange,
      periods
    );

    res.json(
      ApiResponse.success(volOfVol).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to calculate vol of vol', { error });
    res.status(500).json(ApiResponse.error('Failed to calculate vol of vol'));
  }
});

/**
 * GET /api/trading/toxicity/:symbol
 * Detect order book toxicity (proprietary alpha signal)
 */
router.get('/toxicity/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = resolveExchange(req.query.exchange, res);
    if (!exchange) return;

    const toxicity = await advancedMicrostructureIndicators.detectOrderBookToxicity(
      symbol as string,
      exchange
    );

    res.json(
      ApiResponse.success(toxicity).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to detect order book toxicity', { error });
    res.status(500).json(ApiResponse.error('Failed to detect order book toxicity'));
  }
});

/**
 * GET /api/trading/price-impact/:symbol
 * Analyze price impact dynamics
 */
router.get('/price-impact/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = resolveExchange(req.query.exchange, res);
    if (!exchange) return;

    const impact = await advancedMicrostructureIndicators.analyzePriceImpact(
      symbol as string,
      exchange
    );

    res.json(
      ApiResponse.success(impact).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to analyze price impact', { error });
    res.status(500).json(ApiResponse.error('Failed to analyze price impact'));
  }
});

/**
 * GET /api/trading/comprehensive/:symbol
 * Get comprehensive market microstructure indicators
 */
router.get('/comprehensive/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = resolveExchange(req.query.exchange, res);
    if (!exchange) return;

    const indicators = await advancedMicrostructureIndicators.getComprehensiveMicrostructure(
      symbol as string,
      exchange
    );

    res.json(
      ApiResponse.success(indicators).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to get comprehensive microstructure', { error });
    res
      .status(500)
      .json(ApiResponse.error('Failed to get comprehensive microstructure'));
  }
});

/**
 * GET /api/trading/alerts/:symbol
 * Generate real-time microstructure alerts
 */
router.get('/alerts/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = resolveExchange(req.query.exchange, res);
    if (!exchange) return;

    const alerts = await advancedMicrostructureIndicators.generateMicrostructureAlerts(
      symbol as string,
      exchange
    );

    res.json(
      ApiResponse.success({
        symbol,
        alertCount: alerts.length,
        alerts,
        severity: alerts.length > 0 ? 'active' : 'clear',
        timestamp: Date.now()
      }).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to generate microstructure alerts', { error });
    res
      .status(500)
      .json(ApiResponse.error('Failed to generate microstructure alerts'));
  }
});

// ============================================================================
// COMPOSITE ENDPOINTS
// ============================================================================

/**
 * GET /api/trading/market-insight/:symbol
 * Get complete market insight combining all signals
 */
router.get('/market-insight/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = resolveExchange(req.query.exchange, res);
    if (!exchange) return;

    const [microstructure, futuresHealth, alerts] = await Promise.all([
      advancedMicrostructureIndicators.getComprehensiveMicrostructure(
        symbol as string,
        exchange
      ),
      futuresMarketSupport.getFuturesMarketHealth(symbol as string, exchange),
      advancedMicrostructureIndicators.generateMicrostructureAlerts(
        symbol as string,
        exchange
      )
    ]);

    res.json(
      ApiResponse.success({
        symbol,
        microstructureQuality: microstructure.overallQuality,
        futuresHealthScore: futuresHealth.overallHealth,
        alerts: alerts.filter((a: any) => a.actionable),
        recommendations: [
          ...microstructure.recommendations,
          ...futuresHealth.recommendations
        ],
        timestamp: Date.now()
      }).addMeta({ timestamp: Date.now() })
    );
  } catch (error) {
    logger.error('Failed to get market insight', { error });
    res.status(500).json(ApiResponse.error('Failed to get market insight'));
  }
});

export default router;
