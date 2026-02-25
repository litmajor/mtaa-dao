import { Router, Request, Response } from 'express';
import { websocketRealtimeFeeds } from '../services/websocketRealTimeFeeds';
import { futuresMarketSupport } from '../services/futuresMarketSupport';
import { advancedMicrostructureIndicators } from '../services/advancedMicrostructureIndicators';
import { ApiResponse } from '../types/ApiResponse';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================================
// WEBSOCKET ROUTES
// ============================================================================

/**
 * WebSocket upgrade endpoint
 * Clients connect here and subscribe to real-time feeds
 */
router.ws('/realtime', (ws, req) => {
  const clientId = uuidv4();
  logger.info('WebSocket client connection request', { clientId });

  try {
    websocketRealtimeFeeds.addClient(clientId, ws);
  } catch (error) {
    logger.error('Failed to add WebSocket client', { clientId, error });
    ws.close(1011, 'Server error');
  }
});

/**
 * GET /api/v1/realtime/stats
 * Get WebSocket connection statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = websocketRealtimeFeeds.getSubscriptionStats();

    res.json(
      ApiResponse.success({
        connectedClients: stats.totalClients,
        activeSubscriptions: stats.totalSubscriptions,
        details: stats.subscriptions,
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
 * GET /api/v1/futures/funding-rate/:symbol
 * Get current funding rate with predictions
 */
router.get('/funding-rate/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.query;

    const fundingRate = await futuresMarketSupport.getFundingRate(
      symbol as string,
      exchange as string
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
 * GET /api/v1/futures/liquidations/:symbol
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
 * GET /api/v1/futures/open-interest/:symbol
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
 * POST /api/v1/futures/funding-prediction
 * Predict future funding rates
 */
router.post('/funding-prediction', async (req: Request, res: Response) => {
  try {
    const { symbol, exchange = 'binance' } = req.body;

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
 * POST /api/v1/futures/liquidation-risk
 * Detect liquidation risk for a position
 */
router.post('/liquidation-risk', async (req: Request, res: Response) => {
  try {
    const { symbol, entryPrice, leverage = 1, exchange = 'binance' } = req.body;

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
 * GET /api/v1/futures/market-health/:symbol
 * Get overall futures market health
 */
router.get('/market-health/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.query;

    const health = await futuresMarketSupport.getFuturesMarketHealth(
      symbol as string,
      exchange as string
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
 * GET /api/v1/microstructure/order-flow/:symbol
 * Get real-time order flow imbalance
 */
router.get('/order-flow/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.query;

    const orderFlow = await advancedMicrostructureIndicators.analyzeOrderFlowImbalance(
      symbol as string,
      exchange as string
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
 * GET /api/v1/microstructure/vol-of-vol/:symbol
 * Get volatility of volatility indicators
 */
router.get('/vol-of-vol/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance', periods = '24' } = req.query;

    const volOfVol = await advancedMicrostructureIndicators.calculateVolatilityOfVolatility(
      symbol as string,
      exchange as string,
      parseInt(periods as string)
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
 * GET /api/v1/microstructure/toxicity/:symbol
 * Detect order book toxicity
 */
router.get('/toxicity/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.query;

    const toxicity = await advancedMicrostructureIndicators.detectOrderBookToxicity(
      symbol as string,
      exchange as string
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
 * GET /api/v1/microstructure/price-impact/:symbol
 * Analyze price impact dynamics
 */
router.get('/price-impact/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.query;

    const impact = await advancedMicrostructureIndicators.analyzePriceImpact(
      symbol as string,
      exchange as string
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
 * GET /api/v1/microstructure/comprehensive/:symbol
 * Get comprehensive market microstructure indicators
 */
router.get('/comprehensive/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.query;

    const indicators = await advancedMicrostructureIndicators.getComprehensiveMicrostructure(
      symbol as string,
      exchange as string
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
 * GET /api/v1/microstructure/alerts/:symbol
 * Generate real-time microstructure alerts
 */
router.get('/alerts/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.query;

    const alerts = await advancedMicrostructureIndicators.generateMicrostructureAlerts(
      symbol as string,
      exchange as string
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
 * GET /api/v1/priority4/market-insight/:symbol
 * Get complete Priority 4 market insight
 */
router.get('/market-insight/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'binance' } = req.query;

    const [microstructure, futuresHealth, alerts] = await Promise.all([
      advancedMicrostructureIndicators.getComprehensiveMicrostructure(
        symbol as string,
        exchange as string
      ),
      futuresMarketSupport.getFuturesMarketHealth(symbol as string, exchange as string),
      advancedMicrostructureIndicators.generateMicrostructureAlerts(
        symbol as string,
        exchange as string
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
