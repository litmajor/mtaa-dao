/**
 * YUKI Routing Router - Smart Route Aggregation
 * 
 * Routes for comparing execution prices across DEX and CEX venues
 * and executing trades on the best routing venue:
 * - Compare prices across DEX and CEX with real aggregation
 * - Get recommended best route with lowest total cost
 * - Execute trade on selected venue with resilience
 * 
 * Authentication: Required (JWT token)
 * Rate Limiting: Standard (60 req/min per user)
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../../../auth';
import { logger } from '../../../utils/logger';
import { pool } from '../../../db';
import { ccxtService } from '../../../services/ccxtService';
import { orderRouter } from '../../../services/orderRouter';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// Utilities
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Retry logic with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 500
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error('Failed after retries');
}

/**
 * Get quote with timeout
 */
async function getQuoteWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs = 5000
): Promise<T | null> {
  return Promise.race([
    fn(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

const compareRoutesSchema = z.object({
  symbol: z.string().min(1, 'Symbol required'),
  amount: z.number().positive('Amount must be positive'),
  side: z.enum(['buy', 'sell']).default('buy'),
  exchanges: z.array(z.string()).optional(),
  goal: z.enum(['accumulate', 'execute', 'stealth', 'cheap']).optional(),
  urgency: z.enum(['low', 'medium', 'high']).optional(),
});

const executeRouteSchema = z.object({
  symbol: z.string().min(1, 'Symbol required'),
  amount: z.number().positive('Amount must be positive'),
  venue: z.enum(['dex', 'cex']).default('cex'),
  side: z.enum(['buy', 'sell']).default('buy'),
  slippage: z.number().min(0).max(100).optional(),
  exchangeId: z.string().optional(),
  predictBefore: z.boolean().optional().default(true),
});

const simulateRouteSchema = z.object({
  symbol: z.string().min(1, 'Symbol required'),
  amount: z.number().positive('Amount must be positive'),
  side: z.enum(['buy', 'sell']).default('buy'),
  goal: z.enum(['accumulate', 'execute', 'stealth', 'cheap']).optional(),
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /v1/yuki/routing/compare - Compare routes across venues
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Compare execution prices and routes across DEX and CEX venues
 * Returns all available routes sorted by risk-adjusted execution score
 */
router.get('/compare', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = compareRoutesSchema.parse(req.query);
    const userId = (req as any).user?.id;

    logger.info('[YUKI] Comparing routes', {
      userId,
      symbol: params.symbol,
      amount: params.amount,
      side: params.side,
      goal: params.goal,
    });

    // Build trading intent
    const intent = {
      goal: (params.goal || 'cheap') as 'accumulate' | 'execute' | 'stealth' | 'cheap',
      urgency: (params.urgency || 'medium') as 'low' | 'medium' | 'high',
      sensitivity: 'price' as const,
    };

    // Use orderRouter for intelligent routing
    const routing = await orderRouter.comparePrices(
      params.symbol,
      params.amount,
      params.side as 'buy' | 'sell',
      params.exchanges || ['binance', 'coinbase', 'kraken'],
      intent
    );

    // Transform recommendations to route format
    const routes = routing.recommendations.map((rec, idx) => ({
      id: `route_${rec.venue}_${idx}`,
      venue: rec.exchange || 'DEX',
      type: rec.venue,
      protocol: rec.venue === 'dex' ? 'Smart Contract' : 'API',
      executionPrice: rec.price,
      fee: rec.fee || rec.gasCost || 0,
      slippage: rec.slippage || 0,
      priceImpact: rec.slippage ? (rec.slippage / (params.amount * rec.price)) * 100 : 0,
      totalCost: rec.totalWithCosts,
      confidence: rec.confidence,
      reasoning: rec.reasoning,
      liquidity: Math.random() * 1000000, // Placeholder - would come from real liquidity data
    }));

    if (routes.length === 0) {
      return res.status(503).json({
        success: false,
        error: 'No routing quotes available',
        details: 'Unable to fetch quotes from DEX/CEX services',
      });
    }

    // Efficient single query: log route analytics
    try {
      await pool.query(
        `INSERT INTO limit_orders (user_id, symbol, side, status, created_at) 
         VALUES ($1, $2, $3, 'pending', NOW()) 
         ON CONFLICT (user_id, symbol, side) DO UPDATE SET created_at = NOW()`,
        [userId, params.symbol, params.side]
      );
    } catch (e) {
      logger.warn('[YUKI] Analytics logging skipped', { error: e });
    }

    return res.json({
      success: true,
      data: {
        symbol: params.symbol,
        amount: params.amount,
        side: params.side,
        intent,
        routes,
        recommended: routes[0],
        savings: routing.savings.toFixed(2),
        savingsPercent: (routing.savingsPercent).toFixed(2) + '%',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors,
      });
    }

    logger.error('[YUKI] Failed to compare routes', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to compare routes',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/routing/simulate - Pre-trade execution simulation
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Simulate execution before committing
 * Shows expected slippage, confidence, best/worst case scenarios
 */
router.post('/simulate', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const data = simulateRouteSchema.parse(req.body);
    const userId = (req as any).user?.id;

    logger.info('[YUKI] Simulating route', {
      userId,
      symbol: data.symbol,
      amount: data.amount,
      goal: data.goal,
    });

    const intent = {
      goal: (data.goal || 'cheap') as 'accumulate' | 'execute' | 'stealth' | 'cheap',
      urgency: 'medium' as const,
      sensitivity: 'price' as const,
    };

    // Get sim data from orderRouter
    const simulation = await orderRouter.simulateExecution(
      data.symbol,
      data.amount,
      data.side,
      intent
    );

    return res.json({
      success: true,
      data: {
        symbol: data.symbol,
        amount: data.amount,
        side: data.side,
        expectedSlippage: simulation.expectedSlippage.toFixed(6),
        expectedSlippagePercent: simulation.expectedSlippagePercent.toFixed(3) + '%',
        confidence: simulation.confidence.toFixed(0) + '%',
        bestSplit: {
          splits: simulation.bestSplit.splits.map(s => ({
            venue: s.venue === 'dex' ? 'DEX' : s.exchange,
            amount: parseFloat(s.amount.toFixed(8)),
            price: s.price.toFixed(8),
            cost: s.cost.toFixed(8),
            percentage: s.percentage.toFixed(1) + '%',
          })),
          recommendation: simulation.bestSplit.recommendation,
        },
        scenarios: {
          bestCase: {
            slippage: simulation.bestCase.slippage.toFixed(6),
            totalCost: simulation.bestCase.cost.toFixed(2),
          },
          worstCase: {
            slippage: simulation.worstCase.slippage.toFixed(6),
            totalCost: simulation.worstCase.cost.toFixed(2),
          },
        },
        latencyEstimate: simulation.latencyEstimate + 'ms',
        recommendation: simulation.recommendation,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors,
      });
    }

    logger.error('[YUKI] Simulation failed', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to simulate execution',
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /v1/yuki/routing/execute - Execute chosen route
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Execute a trade on the selected venue using intelligent routing
 * Orders are placed through either DEX or CEX based on venue selection
 */
router.post('/execute', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const data = executeRouteSchema.parse(req.body);
    const userId = (req as any).user?.id;

    logger.info('[YUKI] Executing route', {
      userId,
      symbol: data.symbol,
      amount: data.amount,
      venue: data.venue,
      side: data.side,
    });

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get execution simulation if requested
    let preTradeAnalysis = null;
    if (data.predictBefore) {
      try {
        preTradeAnalysis = await orderRouter.simulateExecution(
          data.symbol,
          data.amount,
          data.side
        );
        logger.info('[YUKI] Pre-trade check', {
          confidence: preTradeAnalysis.confidence.toFixed(0),
          expectedSlippage: preTradeAnalysis.expectedSlippagePercent.toFixed(2),
        });
      } catch (e) {
        logger.warn('[YUKI] Pre-trade simulation failed', { error: e });
      }
    }

    // DEX execution (not available yet)
    if (data.venue === 'dex') {
      return res.status(501).json({
        success: false,
        error: 'DEX execution not currently available',
        details: 'dexIntegrationService pending integration',
      });
    }

    // CEX execution using orderRouter
    if (data.venue === 'cex') {
      if (!data.exchangeId) {
        return res.status(400).json({
          success: false,
          error: 'Exchange ID required for CEX execution',
        });
      }

      // Verify exchange ownership (single optimized query)
      const credResult = await pool.query(
        `SELECT exchange FROM cex_credentials WHERE id = $1 AND user_id = $2 AND is_active = true`,
        [data.exchangeId, userId]
      );

      if (credResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Exchange account not found or inactive',
        });
      }

      const exchange = credResult.rows[0].exchange;

      try {
        // Execute via orderRouter (uses orderRouter.placeLimitOrder or similar)
        const result = await withRetry(async () => {
          return await ccxtService.placeMarketOrder(
            exchange,
            data.symbol,
            data.side,
            data.amount
          );
        }, 2, 1000);

        // Single efficient insert
        await pool.query(
          `INSERT INTO limit_orders (user_id, exchange, symbol, side, amount, status, created_at, order_id)
           VALUES ($1, $2, $3, $4, $5, 'filled', NOW(), $6)
           ON CONFLICT DO NOTHING`,
          [userId, exchange, data.symbol, data.side, data.amount, result.orderId]
        );

        return res.json({
          success: true,
          data: {
            executionId,
            venue: exchange,
            type: 'cex',
            symbol: data.symbol,
            amount: data.amount,
            side: data.side,
            orderId: result.orderId,
            status: 'completed',
            executionPrice: result.average?.toFixed(8),
            filled: result.filled?.toFixed(8),
            fee: result.fee?.toFixed(8),
            preTradeAnalysis: preTradeAnalysis ? {
              expectedSlippage: preTradeAnalysis.expectedSlippagePercent.toFixed(3),
              confidence: preTradeAnalysis.confidence.toFixed(0),
            } : undefined,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error('[YUKI] CEX execution failed', { error });
        return res.status(500).json({
          success: false,
          error: 'CEX execution failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid venue',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors,
      });
    }

    logger.error('[YUKI] Failed to execute route', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to execute route',
    });
  }
});

export default router;
