/**
 * CEX Order Manager
 * Manages order lifecycle, fills, and P&L calculation
 * 
 * Features:
 * - Order lifecycle management
 * - Partial fill handling
 * - P&L calculation (realized and unrealized)
 * - Fee tracking
 * - Order history and analytics
 */

import { Pool } from 'pg';
import { CEXOrderRepository } from '../repositories/cexOrderRepository';
import { SmartRouter } from './smartRouter';
import { ExchangeFeeService } from './exchangeFeeService';

export interface OrderFill {
  fillId: string;
  orderId: string;
  amount: number;
  price: number;
  fee: number;
  timestamp: number;
}

export interface OrderPnL {
  orderId: string;
  exchange: string;
  tradingPair: string;
  type: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  totalAmount: number;
  filledAmount: number;
  entryFees: number;
  exitFees?: number;
  realizedPnL?: number;
  realizedPnLPercent?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  status: 'open' | 'partial' | 'closed';
  openSince: number;
  closedAt?: number;
}

export interface OrderMetrics {
  totalOrders: number;
  successfulOrders: number;
  partialFillRate: number;
  averageFillTime: number;
  totalFeesUSD: number;
  totalPnL: number;
  winRate: number;
  averageReturn: number;
  largestWin: number;
  largestLoss: number;
}

/**
 * Order management service
 */
export class CEXOrderManager {
  private db: Pool;
  private smartRouter: SmartRouter;
  private feeService: ExchangeFeeService;
  private static instance: CEXOrderManager;

  private constructor(db: Pool) {
    this.db = db;
    this.smartRouter = SmartRouter.getInstance();
    this.feeService = ExchangeFeeService.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(db?: Pool): CEXOrderManager {
    if (!CEXOrderManager.instance && db) {
      CEXOrderManager.instance = new CEXOrderManager(db);
    }
    if (!CEXOrderManager.instance) {
      throw new Error('CEXOrderManager not initialized. Call getInstance(db) first.');
    }
    return CEXOrderManager.instance;
  }

  /**
   * Calculate P&L for a completed order
   */
  async calculateOrderPnL(orderId: string): Promise<OrderPnL | null> {
    try {
      // Get order from database
      const orderResult = await this.db.query(
        `SELECT * FROM cex_orders WHERE id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return null;
      }

      const order = orderResult.rows[0];
      const entryPrice = parseFloat(order.price);
      const filledAmount = order.filled_amount || 0;
      const totalAmount = order.amount;
      const entryFees = filledAmount * entryPrice * parseFloat(order.fee_percent || 0);

      // Get current market price for unrealized P&L
      const comparison = await this.smartRouter.comparePrices(order.trading_pair);
      const currentPrice = order.type === 'buy' 
        ? comparison.bestBid.price 
        : comparison.bestAsk.price;

      // Calculate unrealized P&L (for open orders)
      let unrealizedPnL = 0;
      let unrealizedPnLPercent = 0;

      if (order.status === 'open' || (order.status === 'partial' && filledAmount > 0)) {
        const remaining = totalAmount - filledAmount;
        if (order.type === 'buy') {
          unrealizedPnL = filledAmount * (currentPrice - entryPrice);
        } else {
          unrealizedPnL = filledAmount * (entryPrice - currentPrice);
        }
        unrealizedPnLPercent = filledAmount > 0 ? (unrealizedPnL / (filledAmount * entryPrice)) * 100 : 0;
      }

      // Calculate realized P&L (for closed orders)
      let realizedPnL = 0;
      let realizedPnLPercent = 0;
      let exitPrice = 0;
      let exitFees = 0;

      if (order.status === 'closed' && filledAmount > 0) {
        // Get exit fills from database
        const fillsResult = await this.db.query(
          `SELECT * FROM cex_order_fills WHERE order_id = $1 ORDER BY timestamp DESC LIMIT 1`,
          [orderId]
        );

        if (fillsResult.rows.length > 0) {
          const lastFill = fillsResult.rows[0];
          exitPrice = parseFloat(lastFill.price);
          exitFees = parseFloat(lastFill.fee);

          if (order.type === 'buy') {
            realizedPnL = filledAmount * (exitPrice - entryPrice) - entryFees - exitFees;
          } else {
            realizedPnL = filledAmount * (entryPrice - exitPrice) - entryFees - exitFees;
          }
          realizedPnLPercent = filledAmount > 0 ? (realizedPnL / (filledAmount * entryPrice)) * 100 : 0;
        }
      }

      return {
        orderId,
        exchange: order.exchange,
        tradingPair: order.trading_pair,
        type: order.type,
        entryPrice,
        exitPrice: exitPrice || undefined,
        totalAmount,
        filledAmount,
        entryFees,
        exitFees: exitFees || undefined,
        realizedPnL: realizedPnL || undefined,
        realizedPnLPercent: realizedPnLPercent || undefined,
        unrealizedPnL: unrealizedPnL || undefined,
        unrealizedPnLPercent: unrealizedPnLPercent || undefined,
        status: order.status,
        openSince: order.created_at.getTime(),
        closedAt: order.closed_at?.getTime(),
      };
    } catch (error) {
      console.error('[CEXOrderManager] Error calculating P&L:', error);
      return null;
    }
  }

  /**
   * Record a fill for an order
   */
  async recordFill(
    orderId: string,
    amount: number,
    price: number,
    fee: number
  ): Promise<OrderFill | null> {
    try {
      const fillResult = await this.db.query(
        `INSERT INTO cex_order_fills (order_id, amount, price, fee, timestamp)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [orderId, amount, price, fee, Date.now()]
      );

      if (fillResult.rows.length === 0) {
        throw new Error('Failed to create fill');
      }

      const fill = fillResult.rows[0];

      // Update order with new fill information
      await CEXOrderRepository.updateOrderFill(orderId, amount);

      return {
        fillId: fill.id,
        orderId,
        amount,
        price,
        fee,
        timestamp: fill.timestamp,
      };
    } catch (error) {
      console.error('[CEXOrderManager] Error recording fill:', error);
      return null;
    }
  }

  /**
   * Get order metrics for a user
   */
  async getUserMetrics(userId: string): Promise<OrderMetrics | null> {
    try {
      // Get all orders for user
      const ordersResult = await this.db.query(
        `SELECT * FROM cex_orders WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      const orders = ordersResult.rows;
      if (orders.length === 0) {
        return {
          totalOrders: 0,
          successfulOrders: 0,
          partialFillRate: 0,
          averageFillTime: 0,
          totalFeesUSD: 0,
          totalPnL: 0,
          winRate: 0,
          averageReturn: 0,
          largestWin: 0,
          largestLoss: 0,
        };
      }

      // Calculate metrics
      const successfulOrders = orders.filter((o: any) => o.status === 'closed').length;
      const partialFills = orders.filter((o: any) => o.status === 'partial').length;
      const closedOrders = orders.filter((o: any) => o.status === 'closed');

      // Calculate average fill time
      let totalFillTime = 0;
      for (const order of closedOrders) {
        const fillTime = (order.closed_at?.getTime() || 0) - order.created_at.getTime();
        totalFillTime += fillTime;
      }
      const averageFillTime = closedOrders.length > 0 ? totalFillTime / closedOrders.length : 0;

      // Calculate total fees
      let totalFeesUSD = 0;
      for (const order of orders) {
        const orderAmount = parseFloat(order.amount || 0);
        const orderPrice = parseFloat(order.price || 0);
        const feePercent = parseFloat(order.fee_percent || 0);
        totalFeesUSD += orderAmount * orderPrice * feePercent;
      }

      // Calculate P&L metrics
      const pnlResults = [];
      for (const order of closedOrders) {
        const pnl = await this.calculateOrderPnL(order.id);
        if (pnl) {
          pnlResults.push(pnl);
        }
      }

      const totalPnL = pnlResults.reduce((sum, p) => sum + (p.realizedPnL || 0), 0);
      const winningTrades = pnlResults.filter(p => (p.realizedPnL || 0) > 0).length;
      const winRate = pnlResults.length > 0 ? (winningTrades / pnlResults.length) * 100 : 0;
      const averageReturn = pnlResults.length > 0
        ? pnlResults.reduce((sum, p) => sum + (p.realizedPnLPercent || 0), 0) / pnlResults.length
        : 0;
      const largestWin = Math.max(...pnlResults.map(p => p.realizedPnL || 0));
      const largestLoss = Math.min(...pnlResults.map(p => p.realizedPnL || 0));

      return {
        totalOrders: orders.length,
        successfulOrders,
        partialFillRate: (partialFills / orders.length) * 100,
        averageFillTime,
        totalFeesUSD,
        totalPnL,
        winRate,
        averageReturn,
        largestWin,
        largestLoss,
      };
    } catch (error) {
      console.error('[CEXOrderManager] Error calculating metrics:', error);
      return null;
    }
  }

  /**
   * Get order history with filters
   */
  async getOrderHistory(
    userId: string,
    options?: {
      exchange?: string;
      tradingPair?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<any[]> {
    try {
      let query = `SELECT * FROM cex_orders WHERE user_id = $1`;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (options?.exchange) {
        query += ` AND exchange = $${paramIndex++}`;
        params.push(options.exchange);
      }

      if (options?.tradingPair) {
        query += ` AND trading_pair = $${paramIndex++}`;
        params.push(options.tradingPair);
      }

      if (options?.status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(options.status);
      }

      query += ` ORDER BY created_at DESC`;

      if (options?.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(options.limit);
      }

      if (options?.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(options.offset);
      }

      const result = await this.db.query(query, params);

      // Enrich with P&L data
      const enrichedOrders = [];
      for (const order of result.rows) {
        const pnl = await this.calculateOrderPnL(order.id);
        enrichedOrders.push({
          ...order,
          pnl,
        });
      }

      return enrichedOrders;
    } catch (error) {
      console.error('[CEXOrderManager] Error getting order history:', error);
      return [];
    }
  }

  /**
   * Get exchange-wide statistics
   */
  async getExchangeStats(exchange: string): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_orders,
          COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_orders,
          COUNT(CASE WHEN type = 'buy' THEN 1 END) as buy_orders,
          COUNT(CASE WHEN type = 'sell' THEN 1 END) as sell_orders,
          SUM(CAST(filled_amount AS NUMERIC)) as total_filled,
          AVG(CAST(price AS NUMERIC)) as avg_price,
          MIN(CAST(price AS NUMERIC)) as min_price,
          MAX(CAST(price AS NUMERIC)) as max_price
         FROM cex_orders 
         WHERE exchange = $1`,
        [exchange]
      );

      return result.rows[0];
    } catch (error) {
      console.error('[CEXOrderManager] Error getting exchange stats:', error);
      return null;
    }
  }

  /**
   * Close an order
   */
  async closeOrder(orderId: string, finalPrice: number): Promise<boolean> {
    try {
      const result = await this.db.query(
        `UPDATE cex_orders 
         SET status = 'closed', closed_at = NOW() 
         WHERE id = $1 
         RETURNING *`,
        [orderId]
      );

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      return true;
    } catch (error) {
      console.error('[CEXOrderManager] Error closing order:', error);
      return false;
    }
  }
}
