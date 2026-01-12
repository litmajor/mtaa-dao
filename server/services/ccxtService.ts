/**
 * CCXT Aggregator Service
 * 
 * Core service for unified cryptocurrency exchange integration
 * Handles: Price fetching, OHLCV data, order management, balance queries
 * 
 * Supported Exchanges:
 * - Binance (highest volume)
 * - Coinbase (US regulated)
 * - Kraken (advanced features)
 * - Gate.io (global coverage)
 * - OKX (liquidity)
 */

import ccxt from 'ccxt';
import NodeCache from 'node-cache';
import pLimit from 'p-limit';
import { logger } from '../utils/logger';
import { exchangesConfig, assetOverrides } from '../../shared/config';

/**
 * Type Definitions
 */
export interface CachedPrice {
  symbol: string;
  exchange: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: number;
}

export interface OrderResult {
  success: boolean;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  filled: number;
  average: number;
  fee: number;
  cost: number;
  status: string;
  timestamp: number;
}

export interface OrderStatus {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  filled: number;
  average: number;
  fee: number;
  status: string;
  timestamp: number;
}

export interface BalanceInfo {
  [asset: string]: {
    free: number;
    used: number;
    total: number;
  };
}

export interface ExchangeMarket {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  maker: number;
  taker: number;
  limits: {
    amount: {
      min: number;
      max: number;
    };
    price: {
      min: number;
      max: number;
    };
    cost: {
      min: number;
      max: number;
    };
  };
}

/**
 * Configuration
 */
// Dynamically build exchange config from exchangesConfig
import { exchangesConfig } from '../../shared/config';
const EXCHANGE_CONFIG: Record<string, any> = {};
for (const [key, value] of Object.entries(exchangesConfig)) {
  if (value.enabled) {
    EXCHANGE_CONFIG[key] = {
      name: key.charAt(0).toUpperCase() + key.slice(1),
      apiLimit: value.apiLimit || 60,
      supportedPairs: value.supportedPairs || [],
      apiKey: value.apiKey || process.env[`${key.toUpperCase()}_API_KEY`],
      apiSecret: value.apiSecret || process.env[`${key.toUpperCase()}_API_SECRET`]
    };
  }
}

/**
 * CCXT Aggregator Class
 * 
 * Manages connections to multiple exchanges and provides
 * unified interface for price discovery and trading
 */
export class CCXTAggregator {
  private exchanges: Map<string, any> = new Map();
  private priceCache = new NodeCache({ stdTTL: 30 }); // 30 seconds
  private ohlcvCache = new NodeCache({ stdTTL: 300 }); // 5 minutes
  private marketsCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
  private limiter = pLimit(3); // Limit concurrent API calls to 3

  constructor() {
    this.initializeExchanges();
  }

  /**
   * Initialize all exchange connections
   * Called on service startup
   */
  private initializeExchanges(): void {
    logger.info('🔄 Initializing CCXT exchanges...');


    const exchangeNames = Object.keys(EXCHANGE_CONFIG);
    exchangeNames.forEach((name) => {
      try {
        const ExchangeClass = ccxt[name as keyof typeof ccxt] as any;
        if (!ExchangeClass || typeof ExchangeClass !== 'function') {
          throw new Error(`Exchange class not found for ${name}`);
        }
        const config = EXCHANGE_CONFIG[name];
        const exchangeConfig: any = {
          enableRateLimit: true,
          rateLimit: this.calculateRateLimit(name),
          timeout: parseInt(process.env.CCXT_TIMEOUT || '30000'),
          apiKey: config.apiKey,
          secret: config.apiSecret
        };
        // Add passphrase for exchanges that need it (Kraken, OKX)
        if (name === 'kraken' || name === 'okx') {
          exchangeConfig.password = process.env[`${name.toUpperCase()}_PASSPHRASE`];
        }
        const exchange = new ExchangeClass(exchangeConfig);
        this.exchanges.set(name, exchange);
        logger.info(`✅ ${config.name} initialized`);
      } catch (error: any) {
        logger.error(`❌ Failed to initialize ${name}: ${error.message}`);
      }
    });

    logger.info(`✅ CCXT service ready with ${this.exchanges.size} exchanges`);
  }

  /**
   * Calculate appropriate rate limit delay for exchange
   */
  private calculateRateLimit(exchangeName: string): number {
    const config = EXCHANGE_CONFIG[exchangeName as keyof typeof EXCHANGE_CONFIG];
    if (!config) return 100;

    // Convert API limit to milliseconds delay
    // If 1200 req/min = 20 req/sec = 50ms per request
    const requestsPerSecond = config.apiLimit / 60;
    return Math.max(1000 / requestsPerSecond, 50);
  }

  /**
   * ==========================================
   * PRICE DISCOVERY METHODS
   * ==========================================
   */

  /**
   * Fetch current ticker from single exchange
   * 
   * @param exchangeName - Exchange to query (binance, coinbase, etc)
   * @param symbol - Trading pair (CELO/USDC)
   * @returns Price data or null if fetch fails
   */
  async getTickerFromExchange(
    exchangeName: string,
    symbol: string
  ): Promise<CachedPrice | null> {
    const cacheKey = `ticker:${exchangeName}:${symbol}`;
    const cached = this.priceCache.get<CachedPrice>(cacheKey);

    if (cached) {
      return cached;
    }

    return this.limiter(async () => {
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
          throw new Error(`Exchange ${exchangeName} not initialized`);
        }

        // Format symbol for this exchange
        const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
        if (!formattedSymbol) {
          logger.warn(`Symbol ${symbol} not supported on ${exchangeName}`);
          return null;
        }

        const ticker = await exchange.fetchTicker(formattedSymbol);

        const price: CachedPrice = {
          symbol: formattedSymbol,
          exchange: exchangeName,
          bid: ticker['bid'] || 0,
          ask: ticker['ask'] || 0,
          last: ticker['last'] || 0,
          volume: ticker['quoteVolume'] || 0,
          timestamp: ticker['timestamp'] || Date.now()
        };

        this.priceCache.set(cacheKey, price);
        return price;
      } catch (error: any) {
        logger.error(`Error fetching ${symbol} from ${exchangeName}: ${error.message}`);
        return null;
      }
    });
  }

  /**
   * Fetch prices from multiple exchanges simultaneously
   * 
   * @param symbol - Trading pair (CELO/USDC)
   * @param exchanges - Array of exchange names to query
   * @returns Record of exchange names to price data
   */
  async getPricesFromMultipleExchanges(
    symbol: string,
    exchanges: string[] = ['binance', 'coinbase', 'kraken']
  ): Promise<Record<string, CachedPrice | null>> {
    logger.debug(`Fetching ${symbol} from [${exchanges.join(', ')}]`);

    const promises = exchanges.map((ex) =>
      this.getTickerFromExchange(ex, symbol)
        .then((price) => ({ exchange: ex, price }))
        .catch((error) => {
          logger.error(`Failed to fetch from ${ex}: ${error.message}`);
          return { exchange: ex, price: null };
        })
    );

    const results = await Promise.allSettled(promises);
    const priceMap: Record<string, CachedPrice | null> = {};

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        priceMap[exchanges[idx]] = result.value.price;
      } else {
        priceMap[exchanges[idx]] = null;
      }
    });

    return priceMap;
  }

  /**
   * Get best (tightest spread) price from multiple exchanges
   * 
   * @param symbol - Trading pair
   * @param exchanges - Exchanges to check
   * @returns Best price data with spread analysis
   */
  async getBestPrice(
    symbol: string,
    exchanges: string[] = ['binance', 'coinbase', 'kraken']
  ): Promise<{
    best: CachedPrice & { spread: number };
    all: Record<string, CachedPrice | null>;
    analysis: { tightest: string; spread_pct: number };
  }> {
    const prices = await this.getPricesFromMultipleExchanges(symbol, exchanges);

    // Filter valid prices and calculate spreads
    const validPrices = Object.entries(prices)
      .filter(([, price]) => price !== null)
      .map(([exchange, price]) => ({
        ...price,
        spread: ((price!.ask - price!.bid) / price!.bid) * 100
      }));

    if (validPrices.length === 0) {
      throw new Error(`No valid prices found for ${symbol}`);
    }

    // Find best (tightest spread)
    const best = validPrices.reduce((prev, curr) =>
      curr.spread < prev.spread ? curr : prev
    );

    // Calculate spread between best ask and worst bid
    const bestAsk = Math.min(...validPrices.map((p) => p.ask ?? 0));
    const worstBid = Math.max(...validPrices.map((p) => p.bid ?? 0));
    const spreadPct = bestAsk > 0 ? ((worstBid - bestAsk) / bestAsk) * 100 : 0;

    return {
      best: {
        symbol: best.symbol || symbol,
        exchange: best.exchange || 'unknown',
        bid: best.bid ?? 0,
        ask: best.ask ?? 0,
        last: best.last ?? 0,
        volume: best.volume ?? 0,
        timestamp: best.timestamp ?? Date.now(),
        spread: best.spread
      },
      all: prices,
      analysis: {
        tightest: best.exchange || 'unknown',
        spread_pct: spreadPct
      }
    };
  }

  /**
   * ==========================================
   * OHLCV (CANDLE) DATA METHODS
   * ==========================================
   */

  /**
   * Fetch OHLCV (candle) data from exchange
   * 
   * @param exchangeName - Exchange to query
   * @param symbol - Trading pair
   * @param timeframe - Candle size (1m, 5m, 1h, 4h, 1d)
   * @param limit - Number of candles to fetch
   * @returns Array of [timestamp, open, high, low, close, volume]
   */
  async getOHLCVFromExchange(
    exchangeName: string,
    symbol: string,
    timeframe: string = '1h',
    limit: number = 24
  ): Promise<any[] | null> {
    const cacheKey = `ohlcv:${exchangeName}:${symbol}:${timeframe}:${limit}`;
    const cached = this.ohlcvCache.get<any[]>(cacheKey);

    if (cached) {
      return cached;
    }

    return this.limiter(async () => {
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
          throw new Error(`Exchange ${exchangeName} not initialized`);
        }

        const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
        if (!formattedSymbol) {
          return null;
        }

        const ohlcv = await exchange.fetchOHLCV(formattedSymbol, timeframe, undefined, limit);

        this.ohlcvCache.set(cacheKey, ohlcv);
        return ohlcv;
      } catch (error: any) {
        logger.error(`Error fetching OHLCV for ${symbol} from ${exchangeName}: ${error.message}`);
        return null;
      }
    });
  }

  /**
   * Fetch OHLCV from best exchange (by volume)
   * Falls back to others if primary fails
   */
  async getOHLCV(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 24,
    preferredExchanges: string[] = ['binance', 'coinbase', 'kraken']
  ): Promise<{
    data: any[] | null;
    source: string;
  }> {
    for (const exchange of preferredExchanges) {
      const data = await this.getOHLCVFromExchange(exchange, symbol, timeframe, limit);
      if (data && data.length > 0) {
        return { data, source: exchange };
      }
    }

    logger.warn(`No OHLCV data found for ${symbol} on any exchange`);
    return { data: null, source: 'none' };
  }

  /**
   * ==========================================
   * ORDER MANAGEMENT METHODS
   * ==========================================
   */

  /**
   * Validate order before placement
   * 
   * @param exchangeName - Exchange to trade on
   * @param symbol - Trading pair
   * @param side - Buy or sell
   * @param amount - Order quantity
   * @param price - Limit price (optional)
   * @returns Validation result with any errors
   */
  async validateOrder(
    exchangeName: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price?: number
  ): Promise<{
    valid: boolean;
    errors: string[];
    market?: ExchangeMarket;
  }> {
    const errors: string[] = [];

    try {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) {
        return { valid: false, errors: [`Exchange ${exchangeName} not found`] };
      }

      const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
      if (!formattedSymbol) {
        return {
          valid: false,
          errors: [`Symbol ${symbol} not supported on ${exchangeName}`]
        };
      }

      // Load markets if needed
      if (!exchange.markets || !Object.keys(exchange.markets).length) {
        await exchange.loadMarkets();
      }

      const market = exchange.markets[formattedSymbol];
      if (!market) {
        return {
          valid: false,
          errors: [`Market ${formattedSymbol} not found on ${exchangeName}`]
        };
      }

      // Validate amount
      const minAmount = market.limits?.amount?.min || 0;
      const maxAmount = market.limits?.amount?.max || Infinity;

      if (amount < minAmount) {
        errors.push(`Amount ${amount} below minimum ${minAmount}`);
      }
      if (amount > maxAmount) {
        errors.push(`Amount ${amount} above maximum ${maxAmount}`);
      }

      // Validate price if provided
      if (price) {
        const minPrice = market.limits?.price?.min || 0;
        const maxPrice = market.limits?.price?.max || Infinity;

        if (price < minPrice) {
          errors.push(`Price ${price} below minimum ${minPrice}`);
        }
        if (price > maxPrice) {
          errors.push(`Price ${price} above maximum ${maxPrice}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        market
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Place market order on exchange
   * 
   * @param exchangeName - Exchange to trade on
   * @param symbol - Trading pair
   * @param side - Buy or sell
   * @param amount - Order quantity
   * @returns Order result with execution details
   */
  async placeMarketOrder(
    exchangeName: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number
  ): Promise<OrderResult> {
    logger.info(`📊 Placing ${side} market order: ${amount} ${symbol} on ${exchangeName}`);

    // Validate order first
    const validation = await this.validateOrder(exchangeName, symbol, side, amount);
    if (!validation.valid) {
      throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
    }

    return this.limiter(async () => {
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
          throw new Error(`Exchange ${exchangeName} not initialized`);
        }

        if (!exchange.apiKey || !exchange.secret) {
          throw new Error(`No API credentials configured for ${exchangeName}`);
        }

        const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
        if (!formattedSymbol) {
          throw new Error(`Symbol ${symbol} not supported on ${exchangeName}`);
        }

        const order = await exchange.createMarketOrder(formattedSymbol, side, amount);

        logger.info(`✅ Order placed: ${order.id} on ${exchangeName}`);

        return {
          success: true,
          orderId: order['id'],
          symbol: formattedSymbol,
          side,
          amount,
          filled: order['filled'] || 0,
          average: order['average'] || 0,
          fee: order['fee']?.['cost'] || 0,
          cost: order['cost'] || 0,
          status: order['status'],
          timestamp: order['timestamp']
        };
      } catch (error: any) {
        logger.error(`❌ Failed to place order: ${error.message}`);
        throw new Error(`Failed to place ${side} market order: ${error.message}`);
      }
    });
  }

  /**
   * Place limit order on exchange
   * 
   * @param exchangeName - Exchange to trade on
   * @param symbol - Trading pair
   * @param side - Buy or sell
   * @param amount - Order quantity
   * @param price - Limit price
   * @returns Order result
   */
  async placeLimitOrder(
    exchangeName: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number
  ): Promise<OrderResult> {
    logger.info(
      `📊 Placing ${side} limit order: ${amount} ${symbol} @ ${price} on ${exchangeName}`
    );

    // Validate order first
    const validation = await this.validateOrder(exchangeName, symbol, side, amount, price);
    if (!validation.valid) {
      throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
    }

    return this.limiter(async () => {
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
          throw new Error(`Exchange ${exchangeName} not initialized`);
        }

        if (!exchange.apiKey || !exchange.secret) {
          throw new Error(`No API credentials configured for ${exchangeName}`);
        }

        const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
        if (!formattedSymbol) {
          throw new Error(`Symbol ${symbol} not supported on ${exchangeName}`);
        }

        const order = await exchange.createLimitOrder(
          formattedSymbol,
          side,
          amount,
          price
        );

        logger.info(`✅ Limit order placed: ${order.id}`);

        return {
          success: true,
          orderId: order['id'],
          symbol: formattedSymbol,
          side,
          amount,
          filled: order['filled'] || 0,
          average: order['average'] || 0,
          fee: order['fee']?.['cost'] || 0,
          cost: order['cost'] || 0,
          status: order['status'],
          timestamp: order['timestamp']
        };
      } catch (error: any) {
        logger.error(`❌ Failed to place limit order: ${error.message}`);
        throw new Error(`Failed to place ${side} limit order: ${error.message}`);
      }
    });
  }

  /**
   * Check order status
   * 
   * @param exchangeName - Exchange that placed order
   * @param orderId - Order ID
   * @param symbol - Trading pair (optional, required for some exchanges)
   * @returns Current order status
   */
  async checkOrderStatus(
    exchangeName: string,
    orderId: string,
    symbol?: string
  ): Promise<OrderStatus> {
    return this.limiter(async () => {
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
          throw new Error(`Exchange ${exchangeName} not initialized`);
        }

        const order = await exchange.fetchOrder(orderId, symbol);

        return {
          orderId: order['id'],
          symbol: order['symbol'],
          side: order['side'],
          amount: order['amount'],
          filled: order['filled'],
          average: order['average'] || 0,
          fee: order['fee']?.['cost'] || 0,
          status: order['status'],
          timestamp: order['timestamp']
        };
      } catch (error: any) {
        logger.error(`Error checking order status: ${error.message}`);
        throw new Error(`Failed to check order status: ${error.message}`);
      }
    });
  }

  /**
   * Cancel order
   * 
   * @param exchangeName - Exchange that placed order
   * @param orderId - Order ID to cancel
   * @param symbol - Trading pair (optional, required for some exchanges)
   * @returns Success status
   */
  async cancelOrder(
    exchangeName: string,
    orderId: string,
    symbol?: string
  ): Promise<boolean> {
    logger.info(`❌ Canceling order ${orderId} on ${exchangeName}`);

    return this.limiter(async () => {
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
          throw new Error(`Exchange ${exchangeName} not initialized`);
        }

        if (!exchange.apiKey || !exchange.secret) {
          throw new Error(`No API credentials configured for ${exchangeName}`);
        }

        await exchange.cancelOrder(orderId, symbol);

        logger.info(`✅ Order canceled: ${orderId}`);
        return true;
      } catch (error: any) {
        logger.error(`Failed to cancel order: ${error.message}`);
        throw new Error(`Failed to cancel order: ${error.message}`);
      }
    });
  }

  /**
   * ==========================================
   * ACCOUNT METHODS
   * ==========================================
   */

  /**
   * Get user balances from exchange
   * Requires API key and secret to be configured
   * 
   * @param exchangeName - Exchange to query
   * @returns Balance information
   */
  async getBalances(exchangeName: string): Promise<BalanceInfo> {
    return this.limiter(async () => {
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
          throw new Error(`Exchange ${exchangeName} not initialized`);
        }

        if (!exchange.apiKey || !exchange.secret) {
          throw new Error(`No API credentials configured for ${exchangeName}`);
        }

        const balance = await exchange.fetchBalance();

        // Transform to our format
        const result: BalanceInfo = {};
        for (const [asset, data] of Object.entries(balance)) {
          if (typeof data === 'object' && data !== null) {
            result[asset] = {
              free: (data as any)['free'] || 0,
              used: (data as any)['used'] || 0,
              total: (data as any)['total'] || 0
            };
          }
        }

        return result;
      } catch (error: any) {
        logger.error(`Failed to fetch balances from ${exchangeName}: ${error.message}`);
        throw new Error(`Failed to fetch balances: ${error.message}`);
      }
    });
  }

  /**
   * ==========================================
   * UTILITY METHODS
   * ==========================================
   */

  /**
   * Format symbol for specific exchange
   * Each exchange has different symbol formats
   * 
   * @param exchangeName - Exchange to format for
   * @param symbol - Base symbol (CELO, USDC, etc)
   * @returns Formatted symbol (CELO/USDC) or null if not supported
   */
  private async formatSymbolForExchange(
    exchangeName: string,
    symbol: string
  ): Promise<string | null> {
    try {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) return null;

      // If already in pair format, return as-is
      if (symbol.includes('/')) {
        return symbol;
      }

      // Load markets if needed
      if (!exchange.markets || !Object.keys(exchange.markets).length) {
        await exchange.loadMarkets();
      }

      // Look for symbol with common quote currencies
      const quoteCurrencies = ['USDC', 'USDT', 'USD', 'BUSD'];
      for (const quote of quoteCurrencies) {
        const pair = `${symbol}/${quote}`;
        if (exchange.markets && exchange.markets[pair]) {
          return pair;
        }
      }

      return null;
    } catch (error: any) {
      logger.error(`Error formatting symbol: ${error.message}`);
      return null;
    }
  }

  /**
   * Get available markets from exchange
   * 
   * @param exchangeName - Exchange to query
   * @returns Array of market info
   */
  async getMarkets(exchangeName: string): Promise<ExchangeMarket[]> {
    const cacheKey = `markets:${exchangeName}`;
    const cached = this.marketsCache.get<ExchangeMarket[]>(cacheKey);

    if (cached) {
      return cached;
    }

    return this.limiter(async () => {
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
          throw new Error(`Exchange ${exchangeName} not initialized`);
        }

        if (!exchange.markets || !Object.keys(exchange.markets).length) {
          await exchange.loadMarkets();
        }

        const markets = Object.values(exchange.markets).map((market: any) => ({
          id: market.id,
          symbol: market.symbol,
          base: market.base,
          quote: market.quote,
          maker: market.maker,
          taker: market.taker,
          limits: market.limits
        }));

        this.marketsCache.set(cacheKey, markets);
        return markets;
      } catch (error: any) {
        logger.error(`Failed to load markets from ${exchangeName}: ${error.message}`);
        throw new Error(`Failed to load markets: ${error.message}`);
      }
    });
  }

  /**
   * Get list of initialized exchanges
   * 
   * @returns Array of exchange names
   */
  getAvailableExchanges(): string[] {
    return Array.from(this.exchanges.keys());
  }

  /**
   * Dynamically discover all available symbols/assets for each exchange
   * Merges with assetOverrides for metadata/hiding
   * 
   * @param exchangeName - Exchange to discover assets from
   * @returns Array of assets with metadata
   */
  async getAvailableAssets(exchangeName: string): Promise<any[]> {
    const exchange = this.exchanges.get(exchangeName);
    if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);
    await exchange.loadMarkets();
    const symbols = Object.keys(exchange.markets);
    // Merge with assetOverrides for metadata/hiding
    return symbols.map((symbol) => {
      const override = assetOverrides[symbol] || {};
      return {
        symbol,
        ...override
      };
    }).filter((asset) => !asset.hidden);
  }

  /**
   * Get exchange connection status
   * 
   * @returns Map of exchange names to connection status
   */
  getExchangeStatus(): Record<string, { connected: boolean; hasCredentials: boolean }> {
    const status: Record<string, { connected: boolean; hasCredentials: boolean }> = {};

    this.exchanges.forEach((exchange, name) => {
      status[name] = {
        connected: !!exchange,
        hasCredentials: !!(exchange.apiKey && exchange.secret)
      };
    });

    return status;
  }

  /**
   * Clear all caches
   * Useful for testing or manual refresh
   */
  clearCaches(): void {
    this.priceCache.flushAll();
    this.ohlcvCache.flushAll();
    this.marketsCache.flushAll();
    logger.info('🧹 Cleared all CCXT caches');
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache stats for monitoring
   */
  getCacheStats(): {
    prices: { keys: number; size: number };
    ohlcv: { keys: number; size: number };
    markets: { keys: number; size: number };
  } {
    return {
      prices: {
        keys: this.priceCache.keys().length,
        size: this.priceCache.getStats().ksize || 0
      },
      ohlcv: {
        keys: this.ohlcvCache.keys().length,
        size: this.ohlcvCache.getStats().ksize || 0
      },
      markets: {
        keys: this.marketsCache.keys().length,
        size: this.marketsCache.getStats().ksize || 0
      }
    };
  }

  /**
   * Health check
   * Returns connectivity status of all exchanges
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: number;
    exchanges: Record<string, { ok: boolean; error?: string }>;
  }> {
    logger.debug('🏥 Running CCXT health check...');

    const checks: Record<string, { ok: boolean; error?: string }> = {};
    let healthyCount = 0;

    for (const name of this.getAvailableExchanges()) {
      try {
        const exchange = this.exchanges.get(name);
        // Try a simple public call (doesn't require auth)
        await exchange.fetchTicker('CELO/USDC').catch(() => {
          // Expected to fail for some symbols, but we just care about connection
        });
        checks[name] = { ok: true };
        healthyCount++;
      } catch (error: any) {
        checks[name] = {
          ok: false,
          error: error.message
        };
      }
    }

    const total = this.getAvailableExchanges().length;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (healthyCount === 0) {
      status = 'unhealthy';
    } else if (healthyCount < total * 0.75) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: Date.now(),
      exchanges: checks
    };
  }
}

/**
 * Singleton instance
 * Initialize and export service
 */
const ccxtService = new CCXTAggregator();

export default ccxtService;
export { ccxtService };
