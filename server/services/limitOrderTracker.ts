/**
 * Limit Order Tracking Service
 * 
 * Manages persistent limit orders placed on centralized exchanges
 * Features:
 * - Store limit orders in database
 * - Check order status periodically
 * - Update filled amounts and prices
 * - Auto-cancel expired orders
 * - Notify users when orders are filled
 */

import { db } from '../db';
import { limitOrders } from '../../shared/schema';
import { ccxtService } from './ccxtService';
import { logger } from '../utils/logger';
import { eq, and, lt, ne } from 'drizzle-orm';

export interface LimitOrderRecord {
  id: string;
  userId: string;
  exchange: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'pending' | 'filled' | 'canceled' | 'expired';
  filledAmount: number;
  filledPrice?: number;
  fee: number;
  createdAt: Date;
  filledAt?: Date;
  expiresAt: Date;
  canceledAt?: Date;
  lastCheckedAt?: Date;
}

class LimitOrderTracker {
  private trackingInterval: NodeJS.Timer | null = null;

  constructor() {
    logger.info('✅ Limit Order Tracker Service initialized');
  }

  /**
   * Create and store a limit order in the database
   */
  async createLimitOrder(
    userId: string,
    exchange: string,
    orderId: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number,
    expiresAt: Date
  ): Promise<LimitOrderRecord> {
    try {
      const result = await db
        .insert(limitOrders)
        .values({
          userId,
          exchange,
          orderId,
          symbol,
          side,
          amount: amount.toString(),
          price: price.toString(),
          expiresAt,
          status: 'pending'
        })
        .returning();

      const order = result[0];
      logger.info(`Created limit order: ${userId} ${exchange} ${side} ${amount} ${symbol} @ ${price}`);

      return {
        id: order.id,
        userId: order.userId,
        exchange: order.exchange,
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        amount: Number(order.amount),
        price: Number(order.price),
        status: order.status as 'pending' | 'filled' | 'canceled' | 'expired',
        filledAmount: Number(order.filledAmount || 0),
        filledPrice: order.filledPrice ? Number(order.filledPrice) : undefined,
        fee: Number(order.fee || 0),
        createdAt: order.createdAt!,
        expiresAt: order.expiresAt!,
        filledAt: order.filledAt || undefined,
        canceledAt: order.canceledAt || undefined,
        lastCheckedAt: order.lastCheckedAt || undefined
      };
    } catch (error: any) {
      logger.error('Error creating limit order:', error);
      throw error;
    }
  }

  /**
   * Get all pending limit orders for a user
   */
  async getUserLimitOrders(userId: string, statusFilter?: string): Promise<LimitOrderRecord[]> {
    try {
      const query = statusFilter
        ? db.select().from(limitOrders).where(and(
            eq(limitOrders.userId, userId),
            eq(limitOrders.status, statusFilter)
          ))
        : db.select().from(limitOrders).where(eq(limitOrders.userId, userId));

      const results = await query;

      return results.map(order => ({
        id: order.id,
        userId: order.userId,
        exchange: order.exchange,
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        amount: Number(order.amount),
        price: Number(order.price),
        status: order.status as 'pending' | 'filled' | 'canceled' | 'expired',
        filledAmount: Number(order.filledAmount || 0),
        filledPrice: order.filledPrice ? Number(order.filledPrice) : undefined,
        fee: Number(order.fee || 0),
        createdAt: order.createdAt!,
        expiresAt: order.expiresAt!,
        filledAt: order.filledAt || undefined,
        canceledAt: order.canceledAt || undefined,
        lastCheckedAt: order.lastCheckedAt || undefined
      }));
    } catch (error: any) {
      logger.error('Error getting user limit orders:', error);
      throw error;
    }
  }

  /**
   * Get a specific limit order by ID
   */
  async getLimitOrder(orderId: string): Promise<LimitOrderRecord | null> {
    try {
      const result = await db
        .select()
        .from(limitOrders)
        .where(eq(limitOrders.id, orderId))
        .limit(1);

      if (!result.length) {
        return null;
      }

      const order = result[0];
      return {
        id: order.id,
        userId: order.userId,
        exchange: order.exchange,
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        amount: Number(order.amount),
        price: Number(order.price),
        status: order.status as 'pending' | 'filled' | 'canceled' | 'expired',
        filledAmount: Number(order.filledAmount || 0),
        filledPrice: order.filledPrice ? Number(order.filledPrice) : undefined,
        fee: Number(order.fee || 0),
        createdAt: order.createdAt!,
        expiresAt: order.expiresAt!,
        filledAt: order.filledAt || undefined,
        canceledAt: order.canceledAt || undefined,
        lastCheckedAt: order.lastCheckedAt || undefined
      };
    } catch (error: any) {
      logger.error('Error getting limit order:', error);
      throw error;
    }
  }

  /**
   * Check and update status of a single limit order
   */
  async checkOrderStatus(dbOrder: LimitOrderRecord): Promise<void> {
    try {
      const status = await ccxtService.checkOrderStatus(
        dbOrder.exchange,
        dbOrder.orderId,
        dbOrder.symbol
      );

      // Update the database with new status
      await db
        .update(limitOrders)
        .set({
          status: status.status,
          filledAmount: status.filled ? status.filled.toString() : dbOrder.filledAmount.toString(),
          filledPrice: status.average ? status.average.toString() : undefined,
          fee: status.fee ? status.fee.toString() : dbOrder.fee.toString(),
          filledAt: status.status === 'closed' ? new Date() : dbOrder.filledAt,
          lastCheckedAt: new Date()
        })
        .where(eq(limitOrders.id, dbOrder.id));

      logger.debug(`Updated order status: ${dbOrder.orderId} → ${status.status}`);
    } catch (error: any) {
      logger.warn(`Could not check order status for ${dbOrder.orderId}:`, error.message);
      // Update last checked timestamp even if failed
      await db
        .update(limitOrders)
        .set({ lastCheckedAt: new Date() })
        .where(eq(limitOrders.id, dbOrder.id));
    }
  }

  /**
   * Check status of all active limit orders
   * Should be run periodically (every 5 minutes)
   */
  async checkAllActiveOrders(): Promise<void> {
    try {
      // Get all pending orders
      const pendingOrders = await db
        .select()
        .from(limitOrders)
        .where(eq(limitOrders.status, 'pending'));

      logger.debug(`Checking status of ${pendingOrders.length} pending limit orders`);

      // Check each order
      for (const order of pendingOrders) {
        const dbOrder: LimitOrderRecord = {
          id: order.id,
          userId: order.userId,
          exchange: order.exchange,
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side as 'buy' | 'sell',
          amount: Number(order.amount),
          price: Number(order.price),
          status: order.status as 'pending' | 'filled' | 'canceled' | 'expired',
          filledAmount: Number(order.filledAmount || 0),
          filledPrice: order.filledPrice ? Number(order.filledPrice) : undefined,
          fee: Number(order.fee || 0),
          createdAt: order.createdAt!,
          expiresAt: order.expiresAt!,
          filledAt: order.filledAt || undefined,
          canceledAt: order.canceledAt || undefined,
          lastCheckedAt: order.lastCheckedAt || undefined
        };

        await this.checkOrderStatus(dbOrder);
      }

      // Check for expired orders
      await this.expireOldOrders();
    } catch (error: any) {
      logger.error('Error checking all active orders:', error);
    }
  }

  /**
   * Expire orders that have reached their expiration date
   */
  async expireOldOrders(): Promise<void> {
    try {
      const now = new Date();
      const expiredOrders = await db
        .select()
        .from(limitOrders)
        .where(
          and(
            eq(limitOrders.status, 'pending'),
            lt(limitOrders.expiresAt, now)
          )
        );

      for (const order of expiredOrders) {
        logger.info(`Order expired: ${order.orderId} (${order.symbol})`);

        // Try to cancel on exchange
        try {
          await ccxtService.cancelOrder(order.exchange, order.orderId, order.symbol);
        } catch (error: any) {
          logger.warn(`Could not cancel expired order on exchange:`, error.message);
        }

        // Mark as expired in database
        await db
          .update(limitOrders)
          .set({
            status: 'expired',
            canceledAt: now
          })
          .where(eq(limitOrders.id, order.id));
      }
    } catch (error: any) {
      logger.error('Error expiring old orders:', error);
    }
  }

  /**
   * Cancel a limit order
   */
  async cancelLimitOrder(dbOrderId: string): Promise<boolean> {
    try {
      const dbOrder = await this.getLimitOrder(dbOrderId);
      if (!dbOrder) {
        throw new Error(`Limit order not found: ${dbOrderId}`);
      }

      // Cancel on exchange
      const success = await ccxtService.cancelOrder(
        dbOrder.exchange,
        dbOrder.orderId,
        dbOrder.symbol
      );

      if (success) {
        // Mark as canceled in database
        await db
          .update(limitOrders)
          .set({
            status: 'canceled',
            canceledAt: new Date()
          })
          .where(eq(limitOrders.id, dbOrderId));

        logger.info(`Canceled limit order: ${dbOrder.orderId}`);
      }

      return success;
    } catch (error: any) {
      logger.error('Error canceling limit order:', error);
      throw error;
    }
  }

  /**
   * Start periodic order status checking
   */
  startPeriodicChecking(intervalMs: number = 5 * 60 * 1000): void {
    if (this.trackingInterval) {
      logger.warn('Periodic checking already running');
      return;
    }

    logger.info(`Starting periodic order checking every ${intervalMs / 1000}s`);

    this.trackingInterval = setInterval(async () => {
      await this.checkAllActiveOrders();
    }, intervalMs);
  }

  /**
   * Stop periodic order status checking
   */
  stopPeriodicChecking(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
      logger.info('Stopped periodic order checking');
    }
  }

  /**
   * Get statistics for a user's limit orders
   */
  async getOrderStats(userId: string): Promise<{
    total: number;
    pending: number;
    filled: number;
    canceled: number;
    expired: number;
    totalFilledAmount: number;
    totalFees: number;
  }> {
    try {
      const userOrders = await this.getUserLimitOrders(userId);

      return {
        total: userOrders.length,
        pending: userOrders.filter(o => o.status === 'pending').length,
        filled: userOrders.filter(o => o.status === 'filled').length,
        canceled: userOrders.filter(o => o.status === 'canceled').length,
        expired: userOrders.filter(o => o.status === 'expired').length,
        totalFilledAmount: userOrders.reduce((sum, o) => sum + o.filledAmount, 0),
        totalFees: userOrders.reduce((sum, o) => sum + o.fee, 0)
      };
    } catch (error: any) {
      logger.error('Error getting order stats:', error);
      throw error;
    }
  }
}

export const limitOrderTracker = new LimitOrderTracker();
