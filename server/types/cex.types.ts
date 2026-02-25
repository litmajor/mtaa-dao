/**
 * CEX (Centralized Exchange) Schema Types
 * TypeScript definitions for all CEX-related database tables
 */

export interface CEXPrice {
  id: number;
  exchange: string; // 'binance', 'kraken', 'coinbase', etc.
  tradingPair: string; // 'BTC/USDT', 'ETH/USD', etc.
  price: string; // DECIMAL stored as string for precision
  bid?: string;
  ask?: string;
  volume?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CEXOrder {
  id: string; // UUID
  userId: string; // UUID
  exchange: string;
  orderType: 'market' | 'limit';
  orderSide: 'buy' | 'sell';
  tradingPair: string;
  amount: string; // DECIMAL as string
  price?: string; // Optional for market orders
  status: 'pending' | 'open' | 'closed' | 'canceled' | 'failed';
  exchangeOrderId?: string; // Exchange's order ID
  filledAmount: string;
  fee: string;
  feeCurrency?: string;
  commission: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface CEXCredential {
  id: string; // UUID
  userId: string; // UUID
  exchange: string;
  apiKeyEncrypted: Buffer; // Encrypted with AES-256-GCM
  apiSecretEncrypted: Buffer;
  passphraseEncrypted?: Buffer; // For exchanges like Kraken
  isSandbox: boolean;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArbitrageOpportunity {
  id: string; // UUID
  tradingPair: string;
  buyExchange: string;
  buyPrice: string;
  sellExchange: string;
  sellPrice: string;
  spreadPercent: string;
  spreadAmount: string;
  estimatedProfit?: string;
  buyLiquidity?: string;
  sellLiquidity?: string;
  buyFeePercent: string; // Default 0.1%
  sellFeePercent: string; // Default 0.1%
  netProfit?: string; // After fees
  status: 'detected' | 'opportunity' | 'executed' | 'expired';
  createdAt: Date;
  detectedAt: Date;
  executedAt?: Date;
}

export interface ExchangeSetting {
  id: string; // UUID
  userId: string; // UUID
  exchange: string;
  settingKey: string; // e.g., 'slippage_tolerance', 'min_order_amount'
  settingValue: string;
  settingType: 'string' | 'number' | 'boolean' | 'json';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request/Response types for API
 */

export interface CreateCEXCredentialRequest {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  isSandbox?: boolean;
}

export interface CEXCredentialResponse {
  id: string;
  exchange: string;
  isSandbox: boolean;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface PlaceOrderRequest {
  exchange: string;
  tradingPair: string;
  orderType: 'market' | 'limit';
  orderSide: 'buy' | 'sell';
  amount: string;
  price?: string; // Required for limit orders
}

export interface OrderResponse {
  orderId: string;
  exchange: string;
  exchangeOrderId?: string;
  tradingPair: string;
  orderSide: 'buy' | 'sell';
  amount: string;
  price?: string;
  status: string;
  createdAt: Date;
}

export interface PriceComparisonResponse {
  tradingPair: string;
  prices: {
    exchange: string;
    price: string;
    bid: string;
    ask: string;
    volume: string;
    spread?: string;
    isHighest?: boolean;
    isLowest?: boolean;
  }[];
  bestBuyExchange: string;
  bestSellExchange: string;
  bestBuyPrice: string;
  bestSellPrice: string;
  timestamp: Date;
}

export interface SmartRouteRequest {
  tradingPair: string;
  amount: string;
  mode: 'buy' | 'sell';
  slippageTolerance?: string; // Default 0.5%
}

export interface SmartRouteResponse {
  tradingPair: string;
  mode: 'buy' | 'sell';
  amount: string;
  recommendedExchange: string;
  routes: {
    exchange: string;
    price: string;
    fee: string;
    liquidity: string;
    estimatedCost?: string;
  }[];
  arbitrageOpportunity?: {
    exists: boolean;
    buyExchange?: string;
    sellExchange?: string;
    estimatedProfit?: string;
  };
  estimatedPrice: string;
  totalFee: string;
  timestamp: Date;
}

export interface ArbitrageAlertResponse {
  opportunities: {
    id: string;
    tradingPair: string;
    buyExchange: string;
    buyPrice: string;
    sellExchange: string;
    sellPrice: string;
    spreadPercent: string;
    estimatedProfit: string;
    netProfit: string;
  }[];
  totalOpportunities: number;
  timestamp: Date;
}

/**
 * Database query result types
 */

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface TransactionResult {
  success: boolean;
  transactionId: string;
  details?: Record<string, any>;
}
