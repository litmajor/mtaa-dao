/**
 * CEX Order Repository
 * Data access layer for order-related database operations
 */

import { db } from '../db';
import { CEXOrder } from '../../types/cex.types';

export class CEXOrderRepository {
  /**
   * Create a new order record
   */
  static async createOrder(
    userId: string,
    exchange: string,
    orderType: 'market' | 'limit',
    orderSide: 'buy' | 'sell',
    tradingPair: string,
    amount: string,
    price?: string
  ): Promise<CEXOrder> {
    const result = await db.query(
      `INSERT INTO cex_orders (
        user_id, exchange, order_type, order_side, trading_pair, 
        amount, price, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [userId, exchange, orderType, orderSide, tradingPair, amount, price]
    );
    return this.mapToCamelCase(result.rows[0]);
  }

  /**
   * Update order with exchange response
   */
  static async updateOrderExchangeStatus(
    orderId: string,
    exchangeOrderId: string,
    status: string
  ): Promise<CEXOrder> {
    const result = await db.query(
      `UPDATE cex_orders 
       SET exchange_order_id = $1, status = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [exchangeOrderId, status, orderId]
    );
    return this.mapToCamelCase(result.rows[0]);
  }

  /**
   * Get order by ID
   */
  static async getOrderById(orderId: string): Promise<CEXOrder | null> {
    const result = await db.query(
      `SELECT * FROM cex_orders WHERE id = $1`,
      [orderId]
    );
    return result.rows.length > 0 ? this.mapToCamelCase(result.rows[0]) : null;
  }

  /**
   * Get all orders for a user
   */
  static async getUserOrders(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CEXOrder[]> {
    const result = await db.query(
      `SELECT * FROM cex_orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Get open orders for a user
   */
  static async getUserOpenOrders(userId: string): Promise<CEXOrder[]> {
    const result = await db.query(
      `SELECT * FROM cex_orders
       WHERE user_id = $1 AND status IN ('pending', 'open')
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows.map(row => this.mapToCamelCase(row));
  }

  /**
   * Update order status and fill information
   */
  static async updateOrderFill(
    orderId: string,
    filledAmount: string,
    fee: string,
    feeCurrency?: string
  ): Promise<CEXOrder> {
    const result = await db.query(
      `UPDATE cex_orders
       SET filled_amount = $1, fee = $2, fee_currency = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [filledAmount, fee, feeCurrency, orderId]
    );
    return this.mapToCamelCase(result.rows[0]);
  }

  /**
   * Mark order as completed
   */
  static async completeOrder(orderId: string): Promise<CEXOrder> {
    const result = await db.query(
      `UPDATE cex_orders
       SET status = 'closed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId]
    );
    return this.mapToCamelCase(result.rows[0]);
  }

  /**
   * Cancel order
   */
  static async cancelOrder(orderId: string): Promise<CEXOrder> {
    const result = await db.query(
      `UPDATE cex_orders
       SET status = 'canceled', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId]
    );
    return this.mapToCamelCase(result.rows[0]);
  }

  /**
   * Get order statistics for a user
   */
  static async getUserOrderStats(userId: string): Promise<{
    totalOrders: number;
    openOrders: number;
    completedOrders: number;
    totalVolume: string;
    totalFees: string;
  }> {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status IN ('pending', 'open') THEN 1 END) as open_orders,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as completed_orders,
        COALESCE(SUM(CAST(amount as DECIMAL)), 0) as total_volume,
        COALESCE(SUM(CAST(fee as DECIMAL)), 0) as total_fees
       FROM cex_orders
       WHERE user_id = $1`,
      [userId]
    );
    
    const row = result.rows[0];
    return {
      totalOrders: parseInt(row.total_orders),
      openOrders: parseInt(row.open_orders),
      completedOrders: parseInt(row.completed_orders),
      totalVolume: row.total_volume.toString(),
      totalFees: row.total_fees.toString(),
    };
  }

  /**
   * Map snake_case to camelCase
   */
  private static mapToCamelCase(row: any): CEXOrder {
    return {
      id: row.id,
      userId: row.user_id,
      exchange: row.exchange,
      orderType: row.order_type,
      orderSide: row.order_side,
      tradingPair: row.trading_pair,
      amount: row.amount,
      price: row.price,
      status: row.status,
      exchangeOrderId: row.exchange_order_id,
      filledAmount: row.filled_amount,
      fee: row.fee,
      feeCurrency: row.fee_currency,
      commission: row.commission,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }
}
