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
import { OrderRepository, OptimisticLockError } from '../domain/trading/OrderRepository';
import { OrderStatus, validateOrderTransition } from '../domain/trading/OrderStateMachine';
import { commandBus } from '../domain/setup';
import { 
  CreateOrderCommand, 
  UpdateOrderFillCommand, 
  CancelOrderCommand, 
  ExpireOrderCommand,
  TradingCommandTypes
} from '../domain/trading/TradingCommands';
import { v4 as uuid } from 'uuid';
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
  private repo = new OrderRepository();

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
    try {
      const commandId = uuid();
      const command: CreateOrderCommand = {
        id: commandId,
        type: TradingCommandTypes.CreateOrder,
        actor: userId, // Assuming user initiates
        correlationId: commandId, // Should ideally come from request context
        payload: {
          userId,
          exchange,
          exchangeOrderId: orderId,
          symbol,
          side,
          amount,
          price,
          expiresAt: expiresAt.toISOString()
        }
      };

      const result = await commandBus.dispatch(command);
      
      if (!result.success) {
        throw new Error(`Command failed: ${result.error}`);
      }

      logger.info(`Created limit order via CommandBus: ${userId} ${exchange} ${side} ${amount} ${symbol} @ ${price}`);

      // We need to fetch the newly created order for compatibility with the return type
      // Since it's eventually consistent or inserted within the tx, we can fetch it.
      // But we need the DB order ID. Wait, CreateOrderCommand doesn't currently accept the ID, it generates it inside repo or uses exchangeOrderId.
      // The aggregate uses `id: uuid()` in `create()`. We can query by `orderId` (exchangeOrderId).
      const orders = await this.repo.findByUser(userId, OrderStatus.CREATED);
      const order = orders.find(o => o.orderId === orderId);

      if (!order) {
        throw new Error('Order was created but could not be retrieved immediately.');
      }

      // Map back to LimitOrderRecord for compatibility
      return {
        id: order.id,
        userId: order.userId,
        exchange: order.exchange,
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        amount: order.amount,
        price: order.price,
        status: order.status as 'pending' | 'filled' | 'canceled' | 'expired',
        filledAmount: order.filledAmount,
        filledPrice: order.filledPrice,
        fee: order.fee,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        filledAt: order.filledAt,
        canceledAt: order.canceledAt,
        lastCheckedAt: order.lastCheckedAt
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
      // For compatibility, map 'pending' to 'CREATED' or similar, but the repo handles this
      const orders = await this.repo.findByUser(userId, statusFilter as any);

      return orders.map(order => ({
        id: order.id,
        userId: order.userId,
        exchange: order.exchange,
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        amount: order.amount,
        price: order.price,
        status: order.status as 'pending' | 'filled' | 'canceled' | 'expired',
        filledAmount: order.filledAmount,
        filledPrice: order.filledPrice,
        fee: order.fee,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        filledAt: order.filledAt,
        canceledAt: order.canceledAt,
        lastCheckedAt: order.lastCheckedAt
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
      const order = await this.repo.findById(orderId);

      if (!order) {
        return null;
      }

      return {
        id: order.id,
        userId: order.userId,
        exchange: order.exchange,
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        amount: order.amount,
        price: order.price,
        status: order.status as 'pending' | 'filled' | 'canceled' | 'expired',
        filledAmount: order.filledAmount,
        filledPrice: order.filledPrice,
        fee: order.fee,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        filledAt: order.filledAt,
        canceledAt: order.canceledAt,
        lastCheckedAt: order.lastCheckedAt
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

      // Load fresh aggregate for OCC check
      const aggregate = await this.repo.findById(dbOrder.id);
      if (!aggregate) return;

      const targetStatus = status.status === 'closed' ? OrderStatus.FILLED : 
                          (status.status === 'canceled' ? OrderStatus.CANCELLED : aggregate.status);

      // Update the database with new status using CommandBus
      const isFinalFill = status.status === 'closed';
      if (status.filled !== undefined || isFinalFill) {
        const command: UpdateOrderFillCommand = {
          id: uuid(),
          type: TradingCommandTypes.UpdateOrderFill,
          actor: 'system',
          correlationId: uuid(),
          payload: {
            orderId: aggregate.id,
            filledAmount: status.filled || aggregate.filledAmount,
            filledPrice: status.average || aggregate.filledPrice,
            fee: status.fee || aggregate.fee,
            isFinalFill
          }
        };

        const result = await commandBus.dispatch(command);
        if (!result.success) {
           if (result.error?.includes('OCC_CONFLICT')) {
             logger.warn(`OCC conflict checking order status for ${dbOrder.orderId}`);
           } else {
             logger.warn(`Update order fill command failed: ${result.error}`);
           }
        } else {
           logger.debug(`Updated order status: ${dbOrder.orderId} → ${targetStatus}`);
        }
      }

    } catch (error: any) {
      logger.warn(`Could not check order status for ${dbOrder.orderId}:`, error.message);
      // Try to update last checked timestamp
      try {
        const agg = await this.repo.findById(dbOrder.id);
        if (agg) {
          await this.repo.update(agg.id, agg.version, { lastCheckedAt: new Date() });
        }
      } catch (e) {
        // ignore occ here
      }
    }
  }

  /**
   * Check status of all active limit orders
   * Should be run periodically (every 5 minutes)
   */
  async checkAllActiveOrders(): Promise<void> {
    try {
      const pendingOrders = await this.repo.findByStatus(OrderStatus.CREATED);

      logger.debug(`Checking status of ${pendingOrders.length} pending limit orders`);

      // Check each order
      for (const order of pendingOrders) {
        const dbOrder: LimitOrderRecord = {
          id: order.id,
          userId: order.userId,
          exchange: order.exchange,
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side,
          amount: order.amount,
          price: order.price,
          status: order.status as any,
          filledAmount: order.filledAmount,
          filledPrice: order.filledPrice,
          fee: order.fee,
          createdAt: order.createdAt,
          expiresAt: order.expiresAt,
          filledAt: order.filledAt,
          canceledAt: order.canceledAt,
          lastCheckedAt: order.lastCheckedAt
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
      const pendingOrders = await this.repo.findByStatus(OrderStatus.CREATED);
      const expiredOrders = pendingOrders.filter(o => o.expiresAt < now);

      for (const order of expiredOrders) {
        logger.info(`Order expired: ${order.orderId} (${order.symbol})`);

        // Try to cancel on exchange
        try {
          await ccxtService.cancelOrder(order.exchange, order.orderId, order.symbol);
        } catch (error: any) {
          logger.warn(`Could not cancel expired order on exchange:`, error.message);
        }

        // Mark as expired in database using CommandBus
        const command: ExpireOrderCommand = {
          id: uuid(),
          type: TradingCommandTypes.ExpireOrder,
          actor: 'system',
          correlationId: uuid(),
          payload: { orderId: order.id }
        };
        const result = await commandBus.dispatch(command);
        if (!result.success) {
           logger.warn(`Expire order command failed: ${result.error}`);
        }
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
        // Mark as canceled in database via CommandBus
        const command: CancelOrderCommand = {
          id: uuid(),
          type: TradingCommandTypes.CancelOrder,
          actor: 'user', // Or 'system' depending on context
          correlationId: uuid(),
          payload: { orderId: dbOrder.id, reason: 'User requested cancellation' }
        };
        const result = await commandBus.dispatch(command);
        if (!result.success) {
           logger.warn(`Cancel order command failed: ${result.error}`);
        } else {
           logger.info(`Canceled limit order: ${dbOrder.orderId}`);
        }
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
