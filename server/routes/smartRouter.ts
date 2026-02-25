/**
 * Smart Router API Routes
 * Endpoints for optimal route calculation and arbitrage detection
 * 
 * Endpoints:
 * - POST /api/smart-route - Calculate optimal route
 * - GET /api/prices/compare - Compare prices across exchanges
 * - GET /api/arbitrage - Find arbitrage opportunities
 * - POST /api/execution-strategy - Get execution strategy
 */

import { Router, Request, Response } from 'express';
import { SmartRouter } from '../services/smartRouter';
import { ExchangeFeeService } from '../services/exchangeFeeService';

const router = Router();

/**
 * POST /api/smart-route
 * Calculate optimal trading route
 * 
 * Request body:
 * {
 *   pair: string,           // e.g., "BTC/USDT"
 *   amount: number,         // Trade amount in USD
 *   isMaker?: boolean,      // true for limit orders (default: false)
 *   userVolume30Day?: number // User's 30-day volume for discounts
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { pair, amount, isMaker = false, userVolume30Day = 0 } = req.body;

    // Validation
    if (!pair || typeof pair !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid parameter: pair',
        example: 'BTC/USDT',
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Missing or invalid parameter: amount',
        example: 100000,
      });
    }

    const smartRouter = SmartRouter.getInstance();
    const route = await smartRouter.calculateOptimalRoute(
      pair,
      amount,
      isMaker,
      userVolume30Day
    );

    res.json({
      success: true,
      route,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[SmartRouterRoutes] Error calculating route:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to calculate route',
    });
  }
});

/**
 * GET /api/prices/compare
 * Compare prices across all exchanges
 * 
 * Query params:
 * - pair: Trading pair (e.g., BTC/USDT)
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const { pair } = req.query;

    if (!pair || typeof pair !== 'string') {
      return res.status(400).json({
        error: 'Missing required parameter: pair',
        example: '/api/prices/compare?pair=BTC/USDT',
      });
    }

    const smartRouter = SmartRouter.getInstance();
    const comparison = await smartRouter.comparePrices(pair);

    res.json({
      success: true,
      comparison,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[SmartRouterRoutes] Error comparing prices:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to compare prices',
    });
  }
});

/**
 * GET /api/arbitrage
 * Find arbitrage opportunities
 * 
 * Query params:
 * - pair: Trading pair (e.g., BTC/USDT)
 * - minProfit: Minimum profit percentage (default: 0.5)
 */
router.get('/arbitrage', async (req: Request, res: Response) => {
  try {
    const { pair, minProfit = '0.5' } = req.query;

    if (!pair || typeof pair !== 'string') {
      return res.status(400).json({
        error: 'Missing required parameter: pair',
        example: '/api/arbitrage?pair=BTC/USDT&minProfit=0.5',
      });
    }

    const minProfitPercent = parseFloat(minProfit as string) || 0.5;

    const smartRouter = SmartRouter.getInstance();
    const opportunities = await smartRouter.findArbitrageOpportunities(
      pair,
      minProfitPercent
    );

    res.json({
      success: true,
      pair,
      minProfitPercent,
      opportunitiesFound: opportunities.length,
      opportunities,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[SmartRouterRoutes] Error finding arbitrage:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to find arbitrage opportunities',
    });
  }
});

/**
 * POST /api/execution-strategy
 * Get recommended execution strategy
 * 
 * Request body:
 * {
 *   pair: string,           // e.g., "BTC/USDT"
 *   amount: number,         // Trade amount
 *   side: "buy" | "sell"    // Trade direction
 * }
 */
router.post('/execution-strategy', async (req: Request, res: Response) => {
  try {
    const { pair, amount, side } = req.body;

    // Validation
    if (!pair || typeof pair !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid parameter: pair',
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Missing or invalid parameter: amount',
      });
    }

    if (!side || !['buy', 'sell'].includes(side)) {
      return res.status(400).json({
        error: 'Missing or invalid parameter: side (must be "buy" or "sell")',
      });
    }

    const smartRouter = SmartRouter.getInstance();
    const strategy = await smartRouter.getExecutionStrategy(pair, amount, side);

    res.json({
      success: true,
      strategy,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[SmartRouterRoutes] Error getting strategy:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get execution strategy',
    });
  }
});

/**
 * GET /api/fees
 * Get fee information and comparison
 * 
 * Query params:
 * - pair: Trading pair (optional, e.g., BTC/USDT)
 * - exchange: Specific exchange (optional)
 * - isMaker: Is maker order? (default: false)
 */
router.get('/fees', (req: Request, res: Response) => {
  try {
    const { pair, exchange, isMaker = 'false' } = req.query;
    const feeService = ExchangeFeeService.getInstance();
    const isMakerOrder = isMaker === 'true';

    if (exchange && typeof exchange === 'string') {
      // Get fees for specific exchange
      const fees = feeService.getFeeStructure(exchange, (pair as string) || 'BTC/USDT');

      res.json({
        success: true,
        exchange,
        pair: pair || 'BTC/USDT',
        fees,
        summary: {
          maker: `${(fees.maker * 100).toFixed(3)}%`,
          taker: `${(fees.taker * 100).toFixed(3)}%`,
        },
        timestamp: Date.now(),
      });
    } else if (pair && typeof pair === 'string') {
      // Compare fees across all exchanges for a pair
      const comparison = feeService.getFeeComparison(pair, isMakerOrder);

      res.json({
        success: true,
        pair,
        isMaker: isMakerOrder,
        comparison: comparison.map(c => ({
          exchange: c.exchange,
          maker: `${(c.maker * 100).toFixed(3)}%`,
          taker: `${(c.taker * 100).toFixed(3)}%`,
          applied: `${(c.applied * 100).toFixed(3)}%`,
        })),
        cheapest: comparison[0].exchange,
        timestamp: Date.now(),
      });
    } else {
      // Get all exchange base fees
      const allFees = feeService.getExchangeFeeSummary();

      const formatted: Record<string, any> = {};
      for (const [ex, fees] of Object.entries(allFees)) {
        formatted[ex] = {
          maker: `${(fees.maker * 100).toFixed(3)}%`,
          taker: `${(fees.taker * 100).toFixed(3)}%`,
        };
      }

      res.json({
        success: true,
        allExchanges: formatted,
        supportedExchanges: feeService.getSupportedExchanges(),
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error('[SmartRouterRoutes] Error getting fees:', error);
    res.status(500).json({
      error: 'Failed to get fee information',
    });
  }
});

export default router;
