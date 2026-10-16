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
import { type Pool } from 'pg';

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
  averageFillPrice: number | null;
  totalCost: number | null;
  status: 'open' | 'closed' | 'canceled' | 'expired';
  timestamp?: number;
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

interface ExchangeOrderSnapshot {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  amount: number;
  filled: number;
  average?: number;
  price?: number;
  timestamp?: number;
  status?: string;
  fee?: { cost?: number; currency?: string };
  info?: Record<string, unknown> & { executedPrice?: number; price?: number };
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
      const credentials = await this.getCredentialsForExchange(request.userId, request.exchange);

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
      const storedOrder = await CEXOrderRepository.createOrder(
        request.userId,
        request.exchange,
        request.orderType,
        request.type,
        request.tradingPair,
        String(request.amount),
        String(price),
      );
      await CEXOrderRepository.updateOrderExchangeStatus(storedOrder.id, order.id, order.status ?? 'open');

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
      const credentials = await this.getCredentialsForExchange(userId, exchange);

      if (!credentials) {
        throw new Error('No credentials for this exchange');
      }

      // Initialize exchange
      const exchangeClient = this.initializeExchange(exchange, credentials);

      const storedOrder = await CEXOrderRepository.getOrderByExchangeOrderId(userId, exchange, orderId);
      if (!storedOrder) throw new Error('Order not found for this user and exchange');

      // Fetch order from exchange
      const rawOrder = await this.executeWithRetry<unknown>(() =>
        exchangeClient.fetchOrder(orderId, storedOrder.tradingPair)
      );
      const order = this.parseExchangeOrder(rawOrder);

      // Calculate metrics
      const filled = order.filled || 0;
      const amount = order.amount || 0;
      const remaining = amount - filled;
      const fillPercentage = amount > 0 ? (filled / amount) * 100 : 0;
      const averageFillPrice = order.average ?? order.info?.executedPrice ?? (filled > 0 ? order.price ?? null : null);
      const totalCost = averageFillPrice === null ? null : filled * averageFillPrice;

      // Determine status
      let status: 'open' | 'closed' | 'canceled' | 'expired' = 'open';
      if (order.status === 'closed' || (amount > 0 && remaining <= 0)) status = 'closed';
      else if (order.status === 'canceled') status = 'canceled';
      else if (order.status === 'expired') status = 'expired';

      // Update database
      await CEXOrderRepository.updateOrderFill(storedOrder.id, String(filled), String(order.fee?.cost ?? 0), order.fee?.currency);
      await CEXOrderRepository.updateOrderExchangeStatus(storedOrder.id, orderId, status);

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
        timestamp: order.timestamp,
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
      const credentials = await this.getCredentialsForExchange(userId, exchange);

      if (!credentials) {
        throw new Error('No credentials for this exchange');
      }

      // Initialize exchange
      const exchangeClient = this.initializeExchange(exchange, credentials);

      const storedOrder = await CEXOrderRepository.getOrderByExchangeOrderId(userId, exchange, orderId);
      if (!storedOrder) throw new Error('Order not found for this user and exchange');

      // Cancel order with retry
      await this.executeWithRetry(() => exchangeClient.cancelOrder(orderId, storedOrder.tradingPair));

      // Update database
      await CEXOrderRepository.cancelOrder(storedOrder.id);

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
          const credentials = await this.getCredentialsForExchange(userId, exch);

          if (!credentials) continue;

          // Check if we should fetch (rate limit: once per 5 seconds)
          const lastFetch = this.lastFetchTime.get(exch) || 0;
          if (Date.now() - lastFetch < this.FETCH_INTERVAL) {
            continue;
          }

          const exchangeClient = this.initializeExchange(exch, credentials);
          const rawOrders = await this.executeWithRetry<unknown>(() =>
            exchangeClient.fetchOpenOrders()
          );
          const orders = this.parseExchangeOrders(rawOrders);

          for (const order of orders) {
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
              averageFillPrice: order.average ?? (filled > 0 ? order.price ?? null : null),
              totalCost: order.average !== undefined
                ? filled * order.average
                : order.price !== undefined ? filled * order.price : null,
              status: 'open',
              timestamp: order.timestamp,
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
        if (orderData.stopLoss && status.averageFillPrice !== null && status.averageFillPrice <= orderData.stopLoss) {
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
        if (orderData.takeProfit && status.averageFillPrice !== null && status.averageFillPrice >= orderData.takeProfit) {
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

  private async getCredentialsForExchange(userId: string, exchange: string) {
    const credentials = await CEXCredentialRepository.getCredentialsByUserId(userId);
    if (!credentials || !credentials.isActive || credentials.exchange.toLowerCase() !== exchange.toLowerCase()) {
      return null;
    }
    return credentials;
  }

  private parseExchangeOrders(value: unknown): ExchangeOrderSnapshot[] {
    if (!Array.isArray(value)) throw new Error('Exchange returned an invalid open-order response');
    return value.map((order) => this.parseExchangeOrder(order));
  }

  private parseExchangeOrder(value: unknown): ExchangeOrderSnapshot {
    if (!value || typeof value !== 'object') throw new Error('Exchange returned an invalid order response');
    const order = value as Record<string, unknown>;
    const readNumber = (field: string): number | undefined => {
      const value = order[field];
      if (value === null || value === undefined) return undefined;
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(parsed)) throw new Error(`Exchange returned an invalid order ${field}`);
      return parsed;
    };

    if (typeof order.id !== 'string' || typeof order.symbol !== 'string' ||
        (order.side !== 'buy' && order.side !== 'sell') || typeof order.type !== 'string') {
      throw new Error('Exchange returned an order without a valid ID, symbol, side, or type');
    }
    const amount = readNumber('amount');
    if (amount === undefined) throw new Error('Exchange returned an order without an amount');

    const fee = order.fee && typeof order.fee === 'object'
      ? order.fee as Record<string, unknown>
      : undefined;
    const feeCost = fee?.cost === null || fee?.cost === undefined ? undefined : Number(fee.cost);
    if (feeCost !== undefined && !Number.isFinite(feeCost)) throw new Error('Exchange returned an invalid order fee');
    const rawInfo = order.info && typeof order.info === 'object'
      ? order.info as Record<string, unknown>
      : undefined;
    const infoNumber = (field: string): number | undefined => {
      const value = rawInfo?.[field];
      if (value === null || value === undefined) return undefined;
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(parsed)) throw new Error(`Exchange returned an invalid order info ${field}`);
      return parsed;
    };

    return {
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      amount,
      filled: readNumber('filled') ?? 0,
      average: readNumber('average'),
      price: readNumber('price'),
      timestamp: readNumber('timestamp'),
      status: typeof order.status === 'string' ? order.status : undefined,
      fee: fee ? {
        cost: feeCost,
        currency: typeof fee.currency === 'string' ? fee.currency : undefined,
      } : undefined,
      info: rawInfo ? {
        ...rawInfo,
        executedPrice: infoNumber('executedPrice'),
        price: infoNumber('price'),
      } : undefined,
    };
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
