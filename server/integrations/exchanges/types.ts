/**
 * Exchange Integration Types
 * Common interfaces for exchange API interactions
 */

export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // For Coinbase Pro
}

export interface ExchangeConfig {
  name: string;
  credentials: ExchangeCredentials;
  sandbox?: boolean;
}

export interface OrderRequest {
  pair: string;
  side: 'BUY' | 'SELL';
  type: 'market' | 'limit';
  quantity: number;
  price?: number; // Required for limit orders
  timeInForce?: 'GTC' | 'IOC' | 'FOK'; // Good-till-cancel, Immediate-or-cancel, Fill-or-kill
}

export interface OrderResponse {
  orderId: string;
  pair: string;
  side: 'BUY' | 'SELL';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
  filledQuantity: number;
  filledPrice?: number;
  fee: number;
  status: 'pending' | 'partial' | 'filled' | 'cancelled';
  timestamp: Date;
  executionTime?: number;
}

export interface TickerData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: Date;
}

export interface BalanceData {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

export interface BalanceResponse {
  [key: string]: BalanceData;
}

export interface FeeInfo {
  makerFee: number; // 0.001 = 0.1%
  takerFee: number;
  volume30Days: number;
  nextLevelVolume: number;
  nextLevelMaker: number;
  nextLevelTaker: number;
}

export interface TradeHistory {
  id: string;
  pair: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  status: 'completed' | 'failed';
  timestamp: Date;
}

export interface ExchangeConnector {
  // Initialization
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Orders
  placeOrder(request: OrderRequest): Promise<OrderResponse>;
  cancelOrder(orderId: string, pair: string): Promise<void>;
  getOrderStatus(orderId: string, pair: string): Promise<OrderResponse>;

  // Account
  getBalance(): Promise<BalanceResponse>;
  getTicker(pair: string): Promise<TickerData>;
  getFeeInfo(): Promise<FeeInfo>;

  // History
  getTradeHistory(pair?: string, limit?: number): Promise<TradeHistory[]>;

  // Streaming (optional)
  subscribeToTicker?(pair: string, callback: (data: TickerData) => void): void;
  unsubscribeFromTicker?(pair: string): void;
}
