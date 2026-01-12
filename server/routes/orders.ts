/**
 * Order Routing API Endpoints
 * 
 * Routes for smart order routing, DEX vs CEX comparison, and limit orders
 */

import express, { Request, Response } from 'express';
import { orderRouter } from '../services/orderRouter';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/orders/route
 * Compare prices and get routing recommendation
 * 
 * Body:
 * {
 *   symbol: string (required) - e.g., "CELO", "USDC"
 *   amount: number (required) - amount to buy/sell
 *   side: "buy" | "sell" (optional, default: "buy")
 *   exchanges: string[] (optional) - CEX to compare, default: ["binance", "coinbase", "kraken"]
 * }
 * 
 * Response:
 * {
 *   symbol: string
 *   amount: number
 *   side: string
 *   recommendations: VenueOption[]
 *   recommended: "dex" | "cex"
 *   recommendedVenue: string | undefined
 *   savings: number
 *   savingsPercent: number
 *   timestamp: number
 * }
 */
router.post('/route', async (req: Request, res: Response) => {
  try {
    const { symbol, amount, side = 'buy', exchanges = ['binance', 'coinbase', 'kraken'] } = req.body;

    // Validate input
    if (!symbol || !amount) {
      return res.status(400).json({ error: 'Symbol and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "buy" or "sell"' });
    }

    const result = await orderRouter.comparePrices(symbol, amount, side, exchanges);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error in /orders/route:', error);
    res.status(500).json({
      error: error.message || 'Failed to route order'
    });
  }
});

/**
 * POST /api/orders/split
 * Get order splitting recommendation for large orders
 * 
 * Body:
 * {
 *   symbol: string (required)
 *   amount: number (required)
 *   side: "buy" | "sell" (optional, default: "buy")
 *   maxDEXLiquidity: number (optional) - max amount to use DEX
 * }
 * 
 * Response:
 * {
 *   symbol: string
 *   totalAmount: number
 *   splits: OrderSplit[]
 *   totalCost: number
 *   averagePrice: number
 *   recommendation: string
 * }
 */
router.post('/split', async (req: Request, res: Response) => {
  try {
    const { symbol, amount, side = 'buy', maxDEXLiquidity = 5000 } = req.body;

    if (!symbol || !amount) {
      return res.status(400).json({ error: 'Symbol and amount are required' });
    }

    const result = await orderRouter.splitOrder(symbol, amount, side, maxDEXLiquidity);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error in /orders/split:', error);
    res.status(500).json({
      error: error.message || 'Failed to split order'
    });
  }
});

/**
 * GET /api/orders/best-venue
 * Find the best execution venue for a symbol and amount
 * 
 * Query:
 * - symbol: string (required)
 * - amount: number (required)
 * - side: "buy" | "sell" (optional, default: "buy")
 * 
 * Response:
 * {
 *   venue: "dex" | "cex"
 *   exchange?: string
 *   price: number
 *   totalWithCosts: number
 *   confidence: "high" | "medium" | "low"
 *   reasoning: string
 * }
 */
router.get('/best-venue', async (req: Request, res: Response) => {
  try {
    const { symbol, amount, side = 'buy' } = req.query;

    if (!symbol || !amount) {
      return res.status(400).json({ error: 'Symbol and amount are required' });
    }

    const result = await orderRouter.findBestExecutionVenue(
      symbol as string,
      Number(amount),
      side as 'buy' | 'sell'
    );

    if (!result) {
      return res.status(404).json({ error: 'Could not determine best venue' });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error in /orders/best-venue:', error);
    res.status(500).json({
      error: error.message || 'Failed to find best venue'
    });
  }
});

/**
 * POST /api/orders/limit
 * Place a persistent limit order on CEX
 * 
 * Body:
 * {
 *   exchange: string (required) - "binance", "coinbase", etc.
 *   symbol: string (required)
 *   side: "buy" | "sell" (required)
 *   amount: number (required)
 *   price: number (required) - limit price
 *   expiresInDays: number (optional, default: 7)
 * }
 * 
 * Response:
 * {
 *   id?: string
 *   userId: string
 *   exchange: string
 *   symbol: string
 *   side: string
 *   amount: number
 *   price: number
 *   status: "pending"
 *   orderId: string
 *   createdAt: Date
 *   expiresAt: Date
 * }
 */
router.post('/limit', async (req: Request, res: Response) => {
  try {
    const { exchange, symbol, side, amount, price, expiresInDays = 7 } = req.body;

    // TODO: Get userId from authenticated user
    const userId = (req as any).user?.id || 'anonymous';

    // Validate input
    if (!exchange || !symbol || !side || !amount || !price) {
      return res.status(400).json({
        error: 'exchange, symbol, side, amount, and price are required'
      });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "buy" or "sell"' });
    }

    const result = await orderRouter.placeLimitOrder(
      userId,
      exchange,
      symbol,
      side,
      amount,
      price,
      expiresInDays
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error in /orders/limit:', error);
    res.status(500).json({
      error: error.message || 'Failed to place limit order'
    });
  }
});

/**
 * GET /api/orders/limit/:orderId/status
 * Check status of a limit order
 * 
 * Query:
 * - exchange: string (required)
 * - symbol: string (optional)
 * 
 * Response:
 * {
 *   orderId: string
 *   symbol: string
 *   side: string
 *   amount: number
 *   price: number
 *   filled: number
 *   average: number
 *   fee: number
 *   status: string
 *   timestamp: number
 * }
 */
router.get('/limit/:orderId/status', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { exchange, symbol } = req.query;

    if (!exchange) {
      return res.status(400).json({ error: 'Exchange is required' });
    }

    const result = await orderRouter.checkLimitOrderStatus(
      exchange as string,
      orderId,
      symbol as string | undefined
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error in /orders/limit/status:', error);
    res.status(500).json({
      error: error.message || 'Failed to check order status'
    });
  }
});

/**
 * DELETE /api/orders/limit/:orderId
 * Cancel a limit order
 * 
 * Query:
 * - exchange: string (required)
 * - symbol: string (optional)
 * 
 * Response:
 * {
 *   success: boolean
 * }
 */
router.delete('/limit/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { exchange, symbol } = req.query;

    if (!exchange) {
      return res.status(400).json({ error: 'Exchange is required' });
    }

    await orderRouter.cancelLimitOrder(
      exchange as string,
      orderId,
      symbol as string | undefined
    );

    res.json({
      success: true,
      message: 'Order canceled'
    });
  } catch (error: any) {
    logger.error('Error in /orders/limit/cancel:', error);
    res.status(500).json({
      error: error.message || 'Failed to cancel order'
    });
  }
});

/**
 * POST /api/orders/clear-cache
 * Clear routing decision cache (admin only)
 */
router.post('/clear-cache', async (req: Request, res: Response) => {
  try {
    // TODO: Check for admin role
    orderRouter.clearCache();

    res.json({
      success: true,
      message: 'Routing cache cleared'
    });
  } catch (error: any) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      error: error.message || 'Failed to clear cache'
    });
  }
});

export default router;
