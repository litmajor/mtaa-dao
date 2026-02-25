import { Router, Request, Response } from 'express';
import { volatilityMetricsService } from '../services/volatilityMetricsService';
import { marketAnalyticsService } from '../services/marketAnalyticsService';
import { smartRetryLogicService } from '../services/smartRetryLogicService';
import { ApiResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';

const router = Router();

// ============ VOLATILITY METRICS ENDPOINTS ============

/**
 * GET /api/v1/analytics/volatility/:symbol
 * Calculate and return volatility metrics for a symbol
 */
router.get('/volatility/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const period = (req.query.period || '24h') as '1h' | '4h' | '24h' | '7d';
    const exchange = (req.query.exchange || 'binance') as string;

    const volatility = await volatilityMetricsService.calculateVolatility(
      symbol,
      period,
      exchange
    );

    const response = ApiResponse.success<typeof volatility>(volatility, {
      timestamp: Date.now(),
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Error fetching volatility:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to calculate volatility', 'VOLATILITY_ERROR')
    );
  }
});

/**
 * GET /api/v1/analytics/volatility/:symbol/trends
 * Get volatility trends over multiple timeframes
 */
router.get('/volatility/:symbol/trends', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = (req.query.exchange || 'binance') as string;

    const trends = await volatilityMetricsService.getVolatilityTrends(symbol, exchange);

    const response = ApiResponse.success<typeof trends>(trends, {
      timestamp: Date.now(),
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Error fetching volatility trends:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to retrieve volatility trends', 'VOLATILITY_TRENDS_ERROR')
    );
  }
});

/**
 * POST /api/v1/analytics/risk-analysis
 * Analyze risk for a potential order
 */
router.post('/risk-analysis', async (req: Request, res: Response) => {
  try {
    const { symbol, orderSize, exchange } = req.body;

    if (!symbol || orderSize === undefined) {
      return res.status(400).json(
        ApiResponse.error('Missing required fields: symbol, orderSize', 'INVALID_INPUT')
      );
    }

    const analysis = await volatilityMetricsService.analyzeRisk(
      symbol,
      orderSize,
      exchange || 'binance'
    );

    const response = ApiResponse.success<typeof analysis>(analysis, {
      timestamp: Date.now()
    });

    res.json(response);
  } catch (error) {
    logger.error('Error analyzing risk:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to analyze risk', 'RISK_ANALYSIS_ERROR')
    );
  }
});

/**
 * GET /api/v1/analytics/slippage-estimate/:symbol
 * Estimate slippage with volatility adjustment
 */
router.get('/slippage-estimate/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const orderSize = parseFloat(req.query.orderSize as string) || 10000;
    const exchange = (req.query.exchange || 'binance') as string;

    const estimate = await volatilityMetricsService.estimateSlippageWithVolatility(
      symbol,
      orderSize,
      exchange
    );

    const response = ApiResponse.success<typeof estimate>(estimate, {
      timestamp: Date.now()
    });

    res.json(response);
  } catch (error) {
    logger.error('Error estimating slippage:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to estimate slippage', 'SLIPPAGE_ESTIMATE_ERROR')
    );
  }
});

// ============ MARKET ANALYTICS ENDPOINTS ============

/**
 * GET /api/v1/analytics/spreads/:symbol
 * Analyze spread trends for a symbol
 */
router.get('/spreads/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = (req.query.exchange || 'binance') as string;
    const timeWindow = parseInt(req.query.timeWindow as string) || 3600000; // 1 hour default

    const spreadAnalysis = await marketAnalyticsService.analyzeSpreadTrends(
      symbol,
      exchange,
      timeWindow
    );

    const response = ApiResponse.success<typeof spreadAnalysis>(spreadAnalysis, {
      timestamp: Date.now(),
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Error analyzing spreads:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to analyze spreads', 'SPREAD_ANALYSIS_ERROR')
    );
  }
});

/**
 * GET /api/v1/analytics/depth/:symbol
 * Analyze order book depth trends
 */
router.get('/depth/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = (req.query.exchange || 'binance') as string;

    const depthAnalysis = await marketAnalyticsService.analyzeDepthTrends(
      symbol,
      exchange
    );

    const response = ApiResponse.success<typeof depthAnalysis>(depthAnalysis, {
      timestamp: Date.now(),
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Error analyzing depth:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to analyze depth trends', 'DEPTH_ANALYSIS_ERROR')
    );
  }
});

/**
 * GET /api/v1/analytics/liquidity/:symbol
 * Analyze liquidity trends
 */
router.get('/liquidity/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = (req.query.exchange || 'binance') as string;

    const liquidityTrend = await marketAnalyticsService.analyzeLiquidityTrends(
      symbol,
      exchange
    );

    const response = ApiResponse.success<typeof liquidityTrend>(liquidityTrend, {
      timestamp: Date.now(),
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Error analyzing liquidity:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to analyze liquidity trends', 'LIQUIDITY_ANALYSIS_ERROR')
    );
  }
});

/**
 * GET /api/v1/analytics/microstructure/:symbol
 * Analyze market microstructure quality
 */
router.get('/microstructure/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = (req.query.exchange || 'binance') as string;

    const microstructure = await marketAnalyticsService.analyzeMarketMicrostructure(
      symbol,
      exchange
    );

    const response = ApiResponse.success<typeof microstructure>(microstructure, {
      timestamp: Date.now(),
      cached: false
    });

    res.json(response);
  } catch (error) {
    logger.error('Error analyzing microstructure:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to analyze market microstructure', 'MICROSTRUCTURE_ERROR')
    );
  }
});

// ============ SMART RETRY LOGIC ENDPOINTS ============

/**
 * POST /api/v1/execution/smart-retry
 * Execute order with smart retry logic and partial fill handling
 */
router.post('/smart-retry', async (req: Request, res: Response) => {
  try {
    const { symbol, side, amount, expectedPrice, exchange, strategy } = req.body;

    if (!symbol || !side || !amount || !expectedPrice) {
      return res.status(400).json(
        ApiResponse.error(
          'Missing required fields: symbol, side, amount, expectedPrice',
          'INVALID_INPUT'
        )
      );
    }

    const result = await smartRetryLogicService.executeWithSmartRetry(
      symbol,
      side,
      amount,
      expectedPrice,
      exchange || 'binance',
      strategy
    );

    const response = ApiResponse.success<typeof result>(result, {
      timestamp: Date.now()
    });

    res.status(result.success ? 201 : 400).json(response);
  } catch (error) {
    logger.error('Error in smart retry execution:', { error });
    res.status(500).json(
      ApiResponse.error('Smart retry execution failed', 'SMART_RETRY_ERROR')
    );
  }
});

/**
 * GET /api/v1/execution/pending-orders
 * Get all pending orders with partial fills
 */
router.get('/pending-orders', async (req: Request, res: Response) => {
  try {
    const pendingOrders = await smartRetryLogicService.getPendingOrders();

    const response = ApiResponse.success<typeof pendingOrders>(
      pendingOrders,
      {
        timestamp: Date.now()
      }
    );

    res.json(response);
  } catch (error) {
    logger.error('Error fetching pending orders:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to fetch pending orders', 'PENDING_ORDERS_ERROR')
    );
  }
});

/**
 * GET /api/v1/execution/retry-history/:orderId
 * Get retry history for a specific order
 */
router.get('/retry-history/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const history = await smartRetryLogicService.getRetryHistory(orderId);

    if (!history) {
      return res.status(404).json(
        ApiResponse.error('Order not found', 'ORDER_NOT_FOUND')
      );
    }

    const response = ApiResponse.success<typeof history>(history, {
      timestamp: Date.now()
    });

    res.json(response);
  } catch (error) {
    logger.error('Error fetching retry history:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to fetch retry history', 'RETRY_HISTORY_ERROR')
    );
  }
});

/**
 * POST /api/v1/execution/complete-order/:orderId
 * Manually complete or abandon an order
 */
router.post('/complete-order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status, reason } = req.body;

    if (!status || !['completed', 'abandoned'].includes(status)) {
      return res.status(400).json(
        ApiResponse.error('Invalid status. Must be "completed" or "abandoned"', 'INVALID_STATUS')
      );
    }

    const result = await smartRetryLogicService.completeOrder(
      orderId,
      status as 'completed' | 'abandoned',
      reason
    );

    if (!result) {
      return res.status(404).json(
        ApiResponse.error('Order not found', 'ORDER_NOT_FOUND')
      );
    }

    const response = ApiResponse.success<typeof result>(result, {
      timestamp: Date.now()
    });

    res.json(response);
  } catch (error) {
    logger.error('Error completing order:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to complete order', 'COMPLETE_ORDER_ERROR')
    );
  }
});

/**
 * POST /api/v1/execution/detect-slippage-deviation
 * Detect and analyze slippage deviation from expected
 */
router.post('/detect-slippage-deviation', async (req: Request, res: Response) => {
  try {
    const { symbol, expectedSlippage, actualSlippage } = req.body;

    if (!symbol || expectedSlippage === undefined || actualSlippage === undefined) {
      return res.status(400).json(
        ApiResponse.error(
          'Missing required fields: symbol, expectedSlippage, actualSlippage',
          'INVALID_INPUT'
        )
      );
    }

    const deviation = await smartRetryLogicService.detectSlippageDeviation(
      symbol,
      expectedSlippage,
      actualSlippage
    );

    const response = ApiResponse.success<typeof deviation>(deviation, {
      timestamp: Date.now()
    });

    res.json(response);
  } catch (error) {
    logger.error('Error detecting slippage deviation:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to detect slippage deviation', 'SLIPPAGE_DEVIATION_ERROR')
    );
  }
});

/**
 * GET /api/v1/execution/adaptive-slippage-tolerance/:symbol
 * Calculate adaptive slippage tolerance based on market conditions
 */
router.get('/adaptive-slippage-tolerance/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const baselineSlippage = parseFloat(req.query.baseline as string) || 1;

    const tolerance = await smartRetryLogicService.calculateAdaptiveSlippageTolerance(
      symbol,
      baselineSlippage
    );

    const response = ApiResponse.success<{ tolerance: number }>(
      { tolerance },
      {
        timestamp: Date.now()
      }
    );

    res.json(response);
  } catch (error) {
    logger.error('Error calculating adaptive tolerance:', { error });
    res.status(500).json(
      ApiResponse.error(
        'Failed to calculate adaptive tolerance',
        'ADAPTIVE_TOLERANCE_ERROR'
      )
    );
  }
});

// ============ COMBINED ANALYTICS ENDPOINTS ============

/**
 * GET /api/v1/analytics/market-health/:symbol
 * Get combined market health assessment for a symbol
 */
router.get('/market-health/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const exchange = (req.query.exchange || 'binance') as string;

    // Fetch all analytics in parallel
    const [volatility, depth, spread, microstructure] = await Promise.all([
      volatilityMetricsService.calculateVolatility(symbol, '24h', exchange),
      marketAnalyticsService.analyzeDepthTrends(symbol, exchange),
      marketAnalyticsService.analyzeSpreadTrends(symbol, exchange),
      marketAnalyticsService.analyzeMarketMicrostructure(symbol, exchange)
    ]);

    const healthScore =
      (100 - volatility.volatilityIndex) * 0.3 +
      depth.liquidityHealth * 0.3 +
      Math.max(0, 100 - spread.currentSpread * 1000) * 0.2 +
      (microstructure.microstructureQuality === 'excellent' ? 100 :
       microstructure.microstructureQuality === 'good' ? 75 :
       microstructure.microstructureQuality === 'fair' ? 50 : 25) * 0.2;

    const marketHealth = {
      symbol,
      exchange,
      timestamp: Date.now(),
      overallHealthScore: Math.round(healthScore),
      components: {
        volatility: volatility.volatilityIndex,
        liquidity: depth.liquidityHealth,
        spread: spread.currentSpread,
        microstructure: microstructure.microstructureQuality
      },
      assessment:
        healthScore > 80 ? 'Excellent' :
        healthScore > 60 ? 'Good' :
        healthScore > 40 ? 'Fair' :
        'Poor',
      recommendations: this.generateMarketHealthRecommendations(
        volatility,
        depth,
        spread,
        microstructure
      )
    };

    const response = ApiResponse.success<typeof marketHealth>(marketHealth, {
      timestamp: Date.now()
    });

    res.json(response);
  } catch (error) {
    logger.error('Error assessing market health:', { error });
    res.status(500).json(
      ApiResponse.error('Failed to assess market health', 'MARKET_HEALTH_ERROR')
    );
  }
});

/**
 * Helper function to generate market health recommendations
 */
function generateMarketHealthRecommendations(volatility: any, depth: any, spread: any, microstructure: any): string[] {
  const recommendations: string[] = [];

  if (volatility.riskLevel === 'extreme') {
    recommendations.push('⚠️ EXTREME VOLATILITY - Do not execute market orders');
  }

  if (depth.liquidityHealth < 40) {
    recommendations.push('⚠️ LOW LIQUIDITY - Use limit orders only');
  }

  if (spread.currentSpread > 0.5) {
    recommendations.push('⚠️ WIDE SPREADS - Consider alternative venues');
  }

  if (microstructure.microstructureQuality === 'poor') {
    recommendations.push('⚠️ POOR MARKET STRUCTURE - High execution risk');
  }

  if (volatility.riskLevel === 'low' && depth.liquidityHealth > 70 && spread.currentSpread < 0.1) {
    recommendations.push('✅ OPTIMAL CONDITIONS - Safe for large orders');
  }

  return recommendations.length > 0 ? recommendations : ['Market conditions neutral'];
}

export default router;
