/**
 * CEX Order Execution Routes
 * Endpoints for placing, tracking, and managing orders
 * 
 * Endpoints:
 * - POST /api/orders - Place new order
 * - GET /api/orders/:orderId - Get order status
 * - DELETE /api/orders/:orderId - Cancel order
 * - GET /api/orders - Get all open orders
 * - GET /api/orders/history - Get order history
 * - GET /api/orders/metrics - Get user metrics
 * - POST /api/orders/:orderId/close - Close order manually
 */

import { Router, Request, Response } from 'express';
import { CEXOrderExecutor } from '../services/cexOrderExecutor';
import { CEXOrderManager } from '../services/cexOrderManager';
import { Pool } from 'pg';

const router = Router();

// Middleware: Verify user is authenticated (basic check)
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * POST /api/orders
 * Place a new order
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { pair, amount, type, orderType, price, stopLoss, takeProfit, exchange } = req.body;
    const userId = req.user.id;

    // Validation
    if (!pair || !amount || !type || !orderType) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['pair', 'amount', 'type', 'orderType'],
      });
    }

    if (!['buy', 'sell'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "buy" or "sell".' });
    }

    if (!['market', 'limit'].includes(orderType)) {
      return res.status(400).json({ error: 'Invalid orderType. Must be "market" or "limit".' });
    }

    if (orderType === 'limit' && !price) {
      return res.status(400).json({ error: 'Price required for limit orders' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    // Create executor and place order
    const db = (req as any).db as Pool;
    const executor = new CEXOrderExecutor(db);

    const result = await executor.placeOrder({
      userId,
      exchange: exchange || 'binance',
      tradingPair: pair,
      type,
      orderType,
      amount,
      price,
      stopLoss,
      takeProfit,
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        orderId: result.orderId,
        exchange: result.exchange,
        tradingPair: result.tradingPair,
        type: result.type,
        amount: result.amount,
        price: result.price,
        timestamp: result.timestamp,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[OrderRoutes] Error placing order:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to place order',
    });
  }
});

/**
 * GET /api/orders/:orderId
 * Get status of a specific order
 */
router.get('/:orderId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { exchange = 'binance' } = req.query;
    const userId = req.user.id;

    const db = (req as any).db as Pool;
    const executor = new CEXOrderExecutor(db);

    const status = await executor.getOrderStatus(userId, exchange as string, orderId);

    if (!status) {
      return res.status(404).json({
        error: 'Order not found',
      });
    }

    res.json({
      success: true,
      order: status,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[OrderRoutes] Error getting order status:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get order status',
    });
  }
});

/**
 * DELETE /api/orders/:orderId
 * Cancel an order
 */
router.delete('/:orderId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { exchange = 'binance' } = req.query;
    const userId = req.user.id;

    const db = (req as any).db as Pool;
    const executor = new CEXOrderExecutor(db);

    const result = await executor.cancelOrder(userId, exchange as string, orderId);

    res.json({
      success: result.success,
      message: result.message,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[OrderRoutes] Error canceling order:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to cancel order',
    });
  }
});

/**
 * GET /api/orders
 * Get all open orders
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { exchange } = req.query;
    const userId = req.user.id;

    const db = (req as any).db as Pool;
    const executor = new CEXOrderExecutor(db);

    const openOrders = await executor.getOpenOrders(userId, exchange as string | undefined);

    res.json({
      success: true,
      count: openOrders.length,
      orders: openOrders,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[OrderRoutes] Error getting open orders:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get open orders',
    });
  }
});

/**
 * GET /api/orders/history
 * Get order history with filtering
 */
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { exchange, pair, status, limit = '50', offset = '0' } = req.query;
    const userId = req.user.id;

    const db = (req as any).db as Pool;
    const manager = CEXOrderManager.getInstance(db);

    const history = await manager.getOrderHistory(userId, {
      exchange: exchange as string | undefined,
      tradingPair: pair as string | undefined,
      status: status as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      count: history.length,
      orders: history,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[OrderRoutes] Error getting order history:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get order history',
    });
  }
});

/**
 * GET /api/orders/metrics
 * Get user's trading metrics and statistics
 */
router.get('/metrics', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const db = (req as any).db as Pool;
    const manager = CEXOrderManager.getInstance(db);

    const metrics = await manager.getUserMetrics(userId);

    res.json({
      success: true,
      metrics,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[OrderRoutes] Error getting metrics:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get metrics',
    });
  }
});

/**
 * POST /api/orders/:orderId/close
 * Manually close an order
 */
router.post('/:orderId/close', requireAuth, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { finalPrice } = req.body;

    if (!finalPrice || finalPrice <= 0) {
      return res.status(400).json({
        error: 'finalPrice required and must be positive',
      });
    }

    const db = (req as any).db as Pool;
    const manager = CEXOrderManager.getInstance(db);

    const success = await manager.closeOrder(orderId, finalPrice);

    if (success) {
      res.json({
        success: true,
        message: 'Order closed successfully',
        timestamp: Date.now(),
      });
    } else {
      res.status(400).json({
        error: 'Failed to close order',
      });
    }
  } catch (error) {
    console.error('[OrderRoutes] Error closing order:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to close order',
    });
  }
});

export default router;
