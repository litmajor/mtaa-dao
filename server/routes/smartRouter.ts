/**
 * Smart Router API Routes
 * Endpoints for optimal route calculation and arbitrage detection
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { SmartRouter } from '../services/smartRouter';
import { ExchangeFeeService } from '../services/exchangeFeeService';

const router = Router();

/**
 * Standardized error logger & response sanitizer
 */
function handleError(res: Response, error: unknown, defaultMessage: string): Response {
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = error instanceof Error ? error.message : String(error);

  console.error(`[SmartRouterRoutes] ${defaultMessage}:`, errorMessage);

  return res.status(500).json({
    success: false,
    error: isProduction ? defaultMessage : errorMessage,
  });
}

/**
 * POST /api/smart-route
 * Calculate optimal trading route
 */
router.post('/smart-route', async (req: Request, res: Response) => {
  try {
    const { pair, amount, side = 'buy', isMaker = false } = req.body;

    // Validation
    if (!pair || typeof pair !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid parameter: pair',
        example: 'BTC/USDT',
      });
    }

    if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid parameter: amount (must be a positive number)',
        example: 100000,
      });
    }
    if (side !== 'buy' && side !== 'sell') {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameter: side (must be "buy" or "sell")',
      });
    }

    const smartRouter = SmartRouter.getInstance();
    const user = (req as Request & {
      user?: { id?: string; userId?: string; claims?: { sub?: string } };
    }).user;
    const route = await smartRouter.calculateOptimalRoute(
      pair.toUpperCase(),
      amount,
      side,
      Boolean(isMaker),
      user?.userId || user?.claims?.sub || user?.id
    );

    return res.json({
      success: true,
      route,
      timestamp: Date.now(),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to calculate route');
  }
});

/**
 * GET /api/prices/compare
 * Compare prices across all exchanges
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const { pair } = req.query;

    if (!pair || typeof pair !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: pair',
        example: '/api/prices/compare?pair=BTC/USDT',
      });
    }

    const smartRouter = SmartRouter.getInstance();
    const comparison = await smartRouter.comparePrices(pair.toUpperCase());

    return res.json({
      success: true,
      comparison,
      timestamp: Date.now(),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to compare prices');
  }
});

/**
 * GET /api/arbitrage
 * Find arbitrage opportunities
 */
router.get('/arbitrage', async (req: Request, res: Response) => {
  try {
    const { pair, minProfit = '0.5' } = req.query;

    if (!pair || typeof pair !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: pair',
        example: '/api/arbitrage?pair=BTC/USDT&minProfit=0.5',
      });
    }

    const parsedMinProfit = parseFloat(String(minProfit));
    const minProfitPercent = isNaN(parsedMinProfit) || parsedMinProfit < 0 ? 0.5 : parsedMinProfit;

    const smartRouter = SmartRouter.getInstance();
    const opportunities = await smartRouter.findArbitrageOpportunities(
      pair.toUpperCase(),
      minProfitPercent
    );

    return res.json({
      success: true,
      pair: pair.toUpperCase(),
      minProfitPercent,
      opportunitiesFound: opportunities.length,
      opportunities,
      timestamp: Date.now(),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to find arbitrage opportunities');
  }
});

/**
 * POST /api/execution-strategy
 * Get recommended execution strategy
 */
router.post('/execution-strategy', async (req: Request, res: Response) => {
  try {
    const { pair, amount, side } = req.body;

    if (!pair || typeof pair !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid parameter: pair',
      });
    }

    if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid parameter: amount',
      });
    }

    if (!side || !['buy', 'sell'].includes(String(side).toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid parameter: side (must be "buy" or "sell")',
      });
    }

    const smartRouter = SmartRouter.getInstance();
    const user = (req as Request & {
      user?: { id?: string; userId?: string; claims?: { sub?: string } };
    }).user;
    const strategy = await smartRouter.getExecutionStrategy(
      pair.toUpperCase(),
      amount,
      side.toLowerCase() as 'buy' | 'sell',
      user?.userId || user?.claims?.sub || user?.id
    );

    return res.json({
      success: true,
      strategy,
      timestamp: Date.now(),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get execution strategy');
  }
});

/**
 * GET /api/fees
 * Get fee information and comparison
 */
router.get('/fees', (req: Request, res: Response) => {
  try {
    const { pair, exchange, isMaker = 'false', side = 'buy' } = req.query;
    const feeService = ExchangeFeeService.getInstance();
    const isMakerOrder = String(isMaker).toLowerCase() === 'true';
    const tradeSide = String(side).toLowerCase();
    const user = (req as Request & {
      user?: { id?: string; userId?: string; claims?: { sub?: string } };
    }).user;
    const userId = user?.userId || user?.claims?.sub || user?.id;
    if (tradeSide !== 'buy' && tradeSide !== 'sell') {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameter: side (must be "buy" or "sell")',
      });
    }

    if (exchange && typeof exchange === 'string') {
      const selectedPair = (pair as string) || 'BTC/USDT';
      const fees = feeService.resolveFees(exchange, selectedPair, tradeSide, {
        isMaker: isMakerOrder,
        userId,
      });
      if (!fees) {
        return res.status(404).json({
          success: false,
          error: `No fee schedule configured for exchange: ${exchange}`,
        });
      }

      return res.json({
        success: true,
        exchange,
        pair: selectedPair,
        fees,
        summary: {
          maker: `${(fees.maker * 100).toFixed(3)}%`,
          taker: `${(fees.taker * 100).toFixed(3)}%`,
          applied: `${(fees.feeRate * 100).toFixed(3)}%`,
        },
        timestamp: Date.now(),
      });
    }

    if (pair && typeof pair === 'string') {
      const comparison = feeService.getFeeComparison(
        pair.toUpperCase(),
        tradeSide,
        0,
        new Date(),
        isMakerOrder,
        userId
      );

      return res.json({
        success: true,
        pair: pair.toUpperCase(),
        side: tradeSide,
        isMaker: isMakerOrder,
        comparison: comparison.map((c) => ({
          exchange: c.exchange,
          maker: `${(c.maker * 100).toFixed(3)}%`,
          taker: `${(c.taker * 100).toFixed(3)}%`,
          applied: `${(c.applied * 100).toFixed(3)}%`,
        })),
        cheapest: comparison[0]?.exchange || null,
        timestamp: Date.now(),
      });
    }

    // Default: Get base fees for all exchanges
    const formatted: Record<string, { maker: string; taker: string; asOf: string }> = {};
    for (const ex of feeService.getSupportedExchanges()) {
      const schedule = feeService.getSchedule(ex);
      if (!schedule) continue;
      formatted[ex] = {
        maker: `${(schedule.baseStructure.maker * 100).toFixed(3)}%`,
        taker: `${(schedule.baseStructure.taker * 100).toFixed(3)}%`,
        asOf: schedule.asOf,
      };
    }

    return res.json({
      success: true,
      allExchanges: formatted,
      supportedExchanges: feeService.getSupportedExchanges(),
      timestamp: Date.now(),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get fee information');
  }
});

export default router;