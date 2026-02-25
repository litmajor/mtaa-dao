/**
 * CEX Order Executor
 * Executes trades on actual exchanges via CCXT
 * 
 * Features:
 * - Order placement with validation
 * - Order status tracking
 * - Partial fill handling
 * - Error recovery and retry logic
 * - Real-time order monitoring
 */

import ccxt from 'ccxt';
import { CEXCredentialRepository } from '../repositories/cexCredentialRepository';
import { CEXOrderRepository } from '../repositories/cexOrderRepository';
import { CEXPriceBackgroundJob } from './cexPriceBackgroundJob';
import { SmartRouter } from './smartRouter';
import { Pool } from 'pg';

export interface PlaceOrderRequest {
  userId: string;
  exchange: string;
  tradingPair: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  amount: number; // In base currency (e.g., BTC)
  price?: number; // For limit orders
  stopLoss?: number; // Optional stop-loss price
  takeProfit?: number; // Optional take-profit price
}

export interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  exchange: string;
  tradingPair: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: number;
  error?: string;
}

export interface OrderStatus {
  orderId: string;
  exchange: string;
  tradingPair: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  amount: number;
  filled: number;
  remaining: number;
  fillPercentage: number;
  averageFillPrice: number;
  totalCost: number;
  status: 'open' | 'closed' | 'canceled' | 'expired';
  timestamp: number;
  updatedAt: number;
}

export interface ExecutionResult {
  orderId: string;
  executed: boolean;
  exchange: string;
  tradingPair: string;
  type: 'buy' | 'sell';
  amount: number;
  filled: number;
  remaining: number;
  averagePrice: number;
  totalCost: number;
  fees: number;
  timestamp: number;
}

/**
 * Order execution engine
 */
export class CEXOrderExecutor {
  private db: Pool;
  private activeOrders: Map<string, any> = new Map();
  private lastFetchTime: Map<string, number> = new Map();
  private readonly FETCH_INTERVAL = 5000; // 5 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Place a new order on an exchange
   */
  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResult> {
    const startTime = Date.now();

    try {
      // Validate request
      this.validateOrderRequest(request);

      // Get user credentials
      const credentials = await CEXCredentialRepository.getCredentialsByUserId(
        request.userId,
        request.exchange
      );

      if (!credentials || !credentials.isActive) {
        throw new Error('Invalid or inactive credentials for this exchange');
      }

      // Initialize exchange client
      const exchange = this.initializeExchange(request.exchange, credentials);

      // Determine price (for limit orders)
      let price = request.price;
      if (request.orderType === 'market' && !price) {
        // Get current market price
        const smartRouter = SmartRouter.getInstance();
        const comparison = await smartRouter.comparePrices(request.tradingPair);
        price = request.type === 'buy' ? comparison.bestAsk.price : comparison.bestBid.price;
      }

      if (!price) {
        throw new Error('Unable to determine order price');
      }

      // Place order with retry logic
      let order = await this.executeWithRetry(() =>
        this.createOrder(exchange, request, price)
      );

      if (!order || !order.id) {
        throw new Error('Failed to create order');
      }

      // Store order in database
      await CEXOrderRepository.createOrder(
        request.userId,
        request.exchange,
        request.tradingPair,
        request.type,
        request.amount,
        price,
        order.id,
        'open'
      );

      // Store in active orders map
      this.activeOrders.set(order.id, {
        userId: request.userId,
        exchange: request.exchange,
        order,
        createdAt: Date.now(),
        stopLoss: request.stopLoss,
        takeProfit: request.takeProfit,
      });

      return {
        success: true,
        orderId: order.id,
        exchange: request.exchange,
        tradingPair: request.tradingPair,
        type: request.type,
        amount: request.amount,
        price,
        timestamp: startTime,
      };
    } catch (error) {
      console.error('[CEXOrderExecutor] Error placing order:', error);
      return {
        success: false,
        exchange: request.exchange,
        tradingPair: request.tradingPair,
        type: request.type,
        amount: request.amount,
        price: request.price || 0,
        timestamp: startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get status of an order
   */
  async getOrderStatus(
    userId: string,
    exchange: string,
    orderId: string
  ): Promise<OrderStatus | null> {
    try {
      // Get credentials
      const credentials = await CEXCredentialRepository.getCredentialsByUserId(
        userId,
        exchange
      );

      if (!credentials) {
        throw new Error('No credentials for this exchange');
      }

      // Initialize exchange
      const exchangeClient = this.initializeExchange(exchange, credentials);

      // Fetch order from exchange
      const order = await this.executeWithRetry(() =>
        exchangeClient.fetchOrder(orderId)
      );

      if (!order) {
        throw new Error('Order not found on exchange');
      }

      // Calculate metrics
      const filled = order.filled || 0;
      const amount = order.amount || 0;
      const remaining = amount - filled;
      const fillPercentage = amount > 0 ? (filled / amount) * 100 : 0;
      const averageFillPrice = order.average || order.info?.executedPrice || 0;
      const totalCost = filled * (averageFillPrice || order.info?.price || 0);

      // Determine status
      let status: 'open' | 'closed' | 'canceled' | 'expired' = 'open';
      if (order.status === 'closed' || remaining === 0) status = 'closed';
      else if (order.status === 'canceled') status = 'canceled';
      else if (order.status === 'expired') status = 'expired';

      // Update database
      await CEXOrderRepository.updateOrderFill(
        orderId,
        filled,
        status === 'closed' ? status : 'open'
      );

      return {
        orderId,
        exchange,
        tradingPair: order.symbol || '',
        type: order.side === 'buy' ? 'buy' : 'sell',
        orderType: order.type === 'market' ? 'market' : 'limit',
        amount,
        filled,
        remaining,
        fillPercentage,
        averageFillPrice,
        totalCost,
        status,
        timestamp: order.timestamp || Date.now(),
        updatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[CEXOrderExecutor] Error getting order status:', error);
      return null;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    userId: string,
    exchange: string,
    orderId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get credentials
      const credentials = await CEXCredentialRepository.getCredentialsByUserId(
        userId,
        exchange
      );

      if (!credentials) {
        throw new Error('No credentials for this exchange');
      }

      // Initialize exchange
      const exchangeClient = this.initializeExchange(exchange, credentials);

      // Cancel order with retry
      await this.executeWithRetry(() => exchangeClient.cancelOrder(orderId));

      // Update database
      await CEXOrderRepository.cancelOrder(orderId);

      // Remove from active orders
      this.activeOrders.delete(orderId);

      return {
        success: true,
        message: `Order ${orderId} canceled successfully`,
      };
    } catch (error) {
      console.error('[CEXOrderExecutor] Error canceling order:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel order',
      };
    }
  }

  /**
   * Get all open orders for a user
   */
  async getOpenOrders(userId: string, exchange?: string): Promise<OrderStatus[]> {
    try {
      // Get credentials
      const exchangesToCheck = exchange
        ? [exchange]
        : ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx'];

      const allOrders: OrderStatus[] = [];

      for (const exch of exchangesToCheck) {
        try {
          const credentials = await CEXCredentialRepository.getCredentialsByUserId(
            userId,
            exch
          );

          if (!credentials) continue;

          // Check if we should fetch (rate limit: once per 5 seconds)
          const lastFetch = this.lastFetchTime.get(exch) || 0;
          if (Date.now() - lastFetch < this.FETCH_INTERVAL) {
            continue;
          }

          const exchangeClient = this.initializeExchange(exch, credentials);
          const orders = await this.executeWithRetry(() =>
            exchangeClient.fetchOpenOrders()
          );

          for (const order of orders || []) {
            const filled = order.filled || 0;
            const amount = order.amount || 0;
            const remaining = amount - filled;
            const fillPercentage = amount > 0 ? (filled / amount) * 100 : 0;

            allOrders.push({
              orderId: order.id || '',
              exchange: exch,
              tradingPair: order.symbol || '',
              type: order.side === 'buy' ? 'buy' : 'sell',
              orderType: order.type === 'market' ? 'market' : 'limit',
              amount,
              filled,
              remaining,
              fillPercentage,
              averageFillPrice: order.average || 0,
              totalCost: filled * (order.average || order.info?.price || 0),
              status: 'open',
              timestamp: order.timestamp || Date.now(),
              updatedAt: Date.now(),
            });
          }

          this.lastFetchTime.set(exch, Date.now());
        } catch (error) {
          console.error(`[CEXOrderExecutor] Error fetching open orders from ${exch}:`, error);
          continue;
        }
      }

      return allOrders;
    } catch (error) {
      console.error('[CEXOrderExecutor] Error getting open orders:', error);
      return [];
    }
  }

  /**
   * Monitor active orders and trigger stop-loss/take-profit
   */
  async monitorActiveOrders(): Promise<void> {
    const smartRouter = SmartRouter.getInstance();

    for (const [orderId, orderData] of this.activeOrders) {
      try {
        // Get current order status
        const status = await this.getOrderStatus(
          orderData.userId,
          orderData.exchange,
          orderId
        );

        if (!status) continue;

        // Skip if order not closed
        if (status.status !== 'closed' && status.fillPercentage < 100) {
          continue;
        }

        // Check stop-loss
        if (orderData.stopLoss && status.averageFillPrice <= orderData.stopLoss) {
          console.log(
            `[CEXOrderExecutor] Stop-loss triggered for order ${orderId}: ${status.averageFillPrice} <= ${orderData.stopLoss}`
          );

          // Place counter order
          await this.placeOrder({
            userId: orderData.userId,
            exchange: orderData.exchange,
            tradingPair: status.tradingPair,
            type: status.type === 'buy' ? 'sell' : 'buy',
            orderType: 'market',
            amount: status.filled,
          });
        }

        // Check take-profit
        if (orderData.takeProfit && status.averageFillPrice >= orderData.takeProfit) {
          console.log(
            `[CEXOrderExecutor] Take-profit triggered for order ${orderId}: ${status.averageFillPrice} >= ${orderData.takeProfit}`
          );

          // Place counter order
          await this.placeOrder({
            userId: orderData.userId,
            exchange: orderData.exchange,
            tradingPair: status.tradingPair,
            type: status.type === 'buy' ? 'sell' : 'buy',
            orderType: 'market',
            amount: status.filled,
          });
        }

        // Remove closed order from active list
        if (status.status === 'closed') {
          this.activeOrders.delete(orderId);
        }
      } catch (error) {
        console.error(`[CEXOrderExecutor] Error monitoring order ${orderId}:`, error);
      }
    }
  }

  /**
   * Validate order request
   */
  private validateOrderRequest(request: PlaceOrderRequest): void {
    if (!request.userId) throw new Error('Missing userId');
    if (!request.exchange) throw new Error('Missing exchange');
    if (!request.tradingPair) throw new Error('Missing tradingPair');
    if (!['buy', 'sell'].includes(request.type)) throw new Error('Invalid type');
    if (!['market', 'limit'].includes(request.orderType)) throw new Error('Invalid orderType');
    if (!request.amount || request.amount <= 0) throw new Error('Invalid amount');
    if (request.orderType === 'limit' && !request.price) {
      throw new Error('Price required for limit orders');
    }

    const validExchanges = ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx'];
    if (!validExchanges.includes(request.exchange.toLowerCase())) {
      throw new Error(`Unsupported exchange: ${request.exchange}`);
    }
  }

  /**
   * Initialize CCXT exchange client
   */
  private initializeExchange(exchange: string, credentials: any): any {
    const exchangeClass = (ccxt as any)[exchange.toLowerCase()];
    if (!exchangeClass) {
      throw new Error(`Unsupported exchange: ${exchange}`);
    }

    return new exchangeClass({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.passphrase,
      enableRateLimit: true,
      timeout: 10000,
    });
  }

  /**
   * Create order on exchange
   */
  private async createOrder(exchange: any, request: PlaceOrderRequest, price: number): Promise<any> {
    return exchange.createOrder(
      request.tradingPair,
      request.orderType,
      request.type,
      request.amount,
      request.orderType === 'limit' ? price : undefined
    );
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await this.delay(this.RETRY_DELAY);
        return this.executeWithRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get number of active orders
   */
  getActiveOrderCount(): number {
    return this.activeOrders.size;
  }
}
