/**
 * Binance Exchange Connector
 * Implements exchange operations for Binance
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { ExchangeConnector, OrderRequest, OrderResponse, TickerData, BalanceResponse, FeeInfo, TradeHistory } from './types';

export class BinanceConnector implements ExchangeConnector {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private client: AxiosInstance;
  private isConnectedFlag: boolean = false;

  constructor(apiKey: string, apiSecret: string, sandbox: boolean = false) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = sandbox
      ? 'https://testnet.binance.vision/api'
      : 'https://api.binance.com/api';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Generate HMAC SHA256 signature for request
   */
  private generateSignature(query: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(query)
      .digest('hex');
  }

  /**
   * Send signed request
   */
  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    const timestamp = Date.now();
    const query = new URLSearchParams({
      ...params,
      timestamp,
    }).toString();

    const signature = this.generateSignature(query);

    const config = {
      method,
      url: `${endpoint}?${query}&signature=${signature}`,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
    };

    const response = await this.client.request<T>(config);
    return response.data;
  }

  async connect(): Promise<void> {
    try {
      // Test connection by getting account info
      await this.signedRequest('GET', '/v3/account');
      this.isConnectedFlag = true;
    } catch (error) {
      throw new Error(`Failed to connect to Binance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    return Promise.resolve();
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * Place a market or limit order
   */
  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    try {
      const symbol = request.pair.replace('/', ''); // BTC/USDT -> BTCUSDT

      const params: Record<string, any> = {
        symbol,
        side: request.side,
        type: request.type.toUpperCase(),
        quantity: request.quantity,
        newOrderRespType: 'FULL', // Return full trade data
      };

      if (request.type === 'limit' && request.price) {
        params.price = request.price;
        params.timeInForce = request.timeInForce || 'GTC';
      }

      const response = await this.signedRequest<any>('POST', '/v3/order', params);

      return {
        orderId: response.orderId,
        pair: request.pair,
        side: request.side,
        type: request.type,
        quantity: request.quantity,
        price: request.price,
        filledQuantity: parseFloat(response.executedQty),
        filledPrice: response.fills?.[0]?.price ? parseFloat(response.fills[0].price) : request.price,
        fee: response.fills?.reduce((sum: number, fill: any) => sum + parseFloat(fill.commission), 0) || 0,
        status: this.mapOrderStatus(response.status),
        timestamp: new Date(response.transactTime),
      };
    } catch (error) {
      throw new Error(`Failed to place order on Binance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, pair: string): Promise<void> {
    try {
      const symbol = pair.replace('/', '');
      await this.signedRequest('DELETE', '/v3/order', {
        symbol,
        orderId,
      });
    } catch (error) {
      throw new Error(`Failed to cancel order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string, pair: string): Promise<OrderResponse> {
    try {
      const symbol = pair.replace('/', '');
      const response = await this.signedRequest<any>('GET', '/v3/order', {
        symbol,
        orderId,
      });

      return {
        orderId: response.orderId,
        pair,
        side: response.side,
        type: response.type,
        quantity: parseFloat(response.origQty),
        price: parseFloat(response.price),
        filledQuantity: parseFloat(response.executedQty),
        filledPrice: response.fills?.[0]?.price ? parseFloat(response.fills[0].price) : parseFloat(response.price),
        fee: response.fills?.reduce((sum: number, fill: any) => sum + parseFloat(fill.commission), 0) || 0,
        status: this.mapOrderStatus(response.status),
        timestamp: new Date(response.time),
      };
    } catch (error) {
      throw new Error(`Failed to get order status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<BalanceResponse> {
    try {
      const response = await this.signedRequest<any>('GET', '/v3/account');
      const balances: BalanceResponse = {};

      response.balances.forEach((balance: any) => {
        const free = parseFloat(balance.free);
        const locked = parseFloat(balance.locked);
        if (free > 0 || locked > 0) {
          balances[balance.asset] = {
            asset: balance.asset,
            free,
            locked,
            total: free + locked,
          };
        }
      });

      return balances;
    } catch (error) {
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current ticker
   */
  async getTicker(pair: string): Promise<TickerData> {
    try {
      const symbol = pair.replace('/', '');
      const response = await this.client.get<any>(`/v3/ticker/bookTicker`, {
        params: { symbol },
      });

      return {
        symbol: pair,
        bid: parseFloat(response.data.bidPrice),
        ask: parseFloat(response.data.askPrice),
        last: parseFloat(response.data.askPrice), // Use ask as last
        volume: 0,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to get ticker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get trading fees
   */
  async getFeeInfo(): Promise<FeeInfo> {
    try {
      const response = await this.signedRequest<any>('GET', '/v3/account');

      return {
        makerFee: response.makerCommission / 10000,
        takerFee: response.takerCommission / 10000,
        volume30Days: 0,
        nextLevelVolume: 0,
        nextLevelMaker: 0,
        nextLevelTaker: 0,
      };
    } catch (error) {
      throw new Error(`Failed to get fee info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get trade history
   */
  async getTradeHistory(pair?: string, limit: number = 100): Promise<TradeHistory[]> {
    try {
      const symbol = pair ? pair.replace('/', '') : undefined;
      const params: Record<string, any> = { limit };
      if (symbol) params.symbol = symbol;

      const response = await this.signedRequest<any[]>('GET', '/v3/myTrades', params);

      return response.map((trade) => ({
        id: trade.id,
        pair: pair || trade.symbol,
        side: trade.isBuyer ? 'BUY' : 'SELL',
        quantity: parseFloat(trade.qty),
        price: parseFloat(trade.price),
        fee: parseFloat(trade.commission),
        status: 'completed',
        timestamp: new Date(trade.time),
      }));
    } catch (error) {
      throw new Error(`Failed to get trade history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map Binance order status to common format
   */
  private mapOrderStatus(status: string): 'pending' | 'partial' | 'filled' | 'cancelled' {
    switch (status) {
      case 'NEW':
      case 'PENDING_CANCEL':
        return 'pending';
      case 'PARTIALLY_FILLED':
        return 'partial';
      case 'FILLED':
        return 'filled';
      case 'CANCELED':
      case 'REJECTED':
      case 'EXPIRED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}
