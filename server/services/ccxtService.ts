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
 *
 * FIXES APPLIED:
 * 1. getTickerFromExchange re-throws typed errors so CEXPriceCollector
 *    can classify BadSymbol vs network vs rate-limit and attempt fallbacks.
 * 2. loadMarkets() is guarded by a per-exchange promise lock so concurrent
 *    batch fetches never fire duplicate market-load calls.
 * 3. formatSymbolForExchange now includes BTC and ETH quote currencies.
 * 4. healthCheck uses a reliable, exchange-appropriate symbol per exchange
 *    instead of hardcoded CELO/USDC on every exchange.
 * 5. pLimit concurrency is split: separate limiters for market-load ops
 *    (heavy, infrequent) vs ticker fetches (light, frequent) so a slow
 *    loadMarkets() can't starve price fetches.
 * 6. volume falls back to baseVolume when quoteVolume is missing/zero,
 *    so valid tickers with only baseVolume are no longer dropped.
 */

import ccxt from 'ccxt';
import NodeCache from 'node-cache';
import pLimit from 'p-limit';
import { logger } from '../utils/logger';
import { assetOverrides } from '../../shared/config';
import { externalAPITracker } from './externalAPITracker';
import { unifiedCache } from './unifiedCacheService';
import { publishMarketObservation } from './marketObservationPublisher';
import { cexCredentialManager } from './cexCredentialManager';
import { OrderIdempotencyRepository, orderIdempotencyRepository } from '../repositories/orderIdempotencyRepository';

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
    amount?: { min: number; max: number };
    price?: { min: number; max: number };
    cost?: { min: number; max: number };
  };
}

/**
 * FIX #1: Typed error class so callers can distinguish symbol errors
 * from network/rate-limit errors without string-matching.
 */
export class CCXTSymbolError extends Error {
  public readonly code = 'BadSymbol';
  constructor(message: string) {
    super(message);
    this.name = 'CCXTSymbolError';
  }
}

export class CCXTRateLimitError extends Error {
  public readonly code = 'RateLimit';
  constructor(message: string) {
    super(message);
    this.name = 'CCXTRateLimitError';
  }
}

/**
 * Configuration
 */
import { exchangesConfig } from '../../shared/config';
const EXCHANGE_CONFIG: Record<string, any> = {};
for (const [key, value] of Object.entries(exchangesConfig)) {
  if ((value as any).enabled) {
    EXCHANGE_CONFIG[key] = {
      name: key.charAt(0).toUpperCase() + key.slice(1),
      apiLimit: (value as any).apiLimit || 60,
      supportedPairs: (value as any).supportedPairs || [],
      apiKey: (value as any).apiKey || process.env[`${key.toUpperCase()}_API_KEY`],
      apiSecret: (value as any).apiSecret || process.env[`${key.toUpperCase()}_API_SECRET`],
    };
  }
}

// FIX #4: Per-exchange reliable health-check symbols (public, high-liquidity pairs)
const HEALTH_CHECK_SYMBOLS: Record<string, string> = {
  binance: 'BTC/USDT',
  coinbase: 'BTC/USD',
  kraken: 'BTC/USD',
  bybit: 'BTC/USDT',
  kucoin: 'BTC/USDT',
  okx: 'BTC/USDT',
  gateio: 'BTC/USDT',
};
const HEALTH_CHECK_FALLBACK = 'BTC/USDT';

// FIX #3: Expanded quote currency list including BTC and ETH
const QUOTE_CURRENCIES = ['USDC', 'USDT', 'USD', 'BUSD', 'BTC', 'ETH'] as const;

/**
 * CCXT Aggregator Class
 */
export class CCXTAggregator {
  private exchanges: Map<string, any> = new Map();
  private priceCache = new NodeCache({ stdTTL: 30 });
  private ohlcvCache = new NodeCache({ stdTTL: 300 });
  private marketsCache = new NodeCache({ stdTTL: 3600 });

  // FIX #5: Separate limiters — market loads are heavy and slow;
  // ticker fetches are lightweight and frequent.
  // Keeping them in separate pools prevents one starving the other.
  private tickerLimiter = pLimit(10);   // Up from 3 — ticker fetches are cheap
  private marketLimiter = pLimit(2);    // Low — loadMarkets is expensive per exchange
  
  // NEW: Private operations use separate limiter (lower concurrency)
  // Prevents order placement from starving price fetches
  private privateLimiter = pLimit(5);   // Lower than ticker — private ops need real spacing

  private readonly EAGER_WARMUP_EXCHANGES = ['binance', 'kraken'];
  private readonly LOAD_MARKETS_TIMEOUTS: Record<string, number> = {
    binance: 25000,
    coinbase: 30000,
    kraken: 30000,
    bybit: 40000,
    kucoin: 40000,
    okx: 35000,
    gateio: 30000,
    default: 20000,
  };

  // FIX #2: Per-exchange promise lock for loadMarkets()
  // If multiple concurrent fetches hit the same exchange simultaneously,
  // they all await the same in-flight promise instead of firing duplicates.
  private marketsLoadingPromise: Map<string, Promise<void>> = new Map();

  constructor() {
    this.initializeExchanges();
    // Warm-up markets asynchronously to avoid thundering herd during first scans
    // Fire-and-forget: warmup uses the same limiters and will log failures
    this.warmupMarkets().catch((err) => {
      logger.warn(`[CCXTAggregator] Warmup markets failed: ${err?.message || err}`);
    });
  }

  /**
   * Initialize all exchange connections
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
          secret: config.apiSecret,
        };
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

  private calculateRateLimit(exchangeName: string): number {
    const config = EXCHANGE_CONFIG[exchangeName as keyof typeof EXCHANGE_CONFIG];
    if (!config) return 100;
    const requestsPerSecond = config.apiLimit / 60;
    return Math.max(1000 / requestsPerSecond, 50);
  }

  private getLoadMarketsTimeout(exchangeName: string): number {
    const envTimeout = parseInt(process.env.CCXT_LOADMARKETS_TIMEOUT || '');
    if (!Number.isNaN(envTimeout) && envTimeout > 0) {
      return envTimeout;
    }
    return this.LOAD_MARKETS_TIMEOUTS[exchangeName] || this.LOAD_MARKETS_TIMEOUTS.default;
  }

  // ---------------------------------------------------------------------------
  // FIX #2: Shared loadMarkets() lock per exchange
  // ---------------------------------------------------------------------------

  /**
   * Ensures loadMarkets() is only called once per exchange at a time.
   * All concurrent callers awaiting market data share the same in-flight promise.
   */
  private async ensureMarketsLoaded(exchangeName: string): Promise<void> {
    const exchange = this.exchanges.get(exchangeName);
    if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);

    const cacheKey = `markets:${exchangeName}`;
    // Try local memory cache first (TTL-driven).
    const cachedMarkets = this.marketsCache.get<any>(cacheKey);
    if (cachedMarkets && Object.keys(cachedMarkets).length > 0) {
      exchange.markets = cachedMarkets;
      return;
    }

    // Try Redis-backed cache before hitting loadMarkets(). This avoids cold-start
    // loadMarkets() for exchanges that already have market metadata persisted.
    try {
      const cachedMarketsFromRedis = await unifiedCache.getCachedMarkets(exchangeName);
      if (cachedMarketsFromRedis && cachedMarketsFromRedis.length > 0) {
        exchange.markets = cachedMarketsFromRedis.reduce((acc: any, market: any) => {
          if (market && market.symbol) acc[market.symbol] = market;
          return acc;
        }, {});
        this.marketsCache.set(cacheKey, exchange.markets);
        logger.info(`[CCXTAggregator] Restored markets for ${exchangeName} from Redis cache`);
        return;
      }
    } catch (err: any) {
      logger.debug(`[CCXTAggregator] Redis market cache unavailable for ${exchangeName}: ${err.message}`);
    }

    // If the CCXT instance already has markets but our cache expired, we want to refresh
    // so fall through to the loadMarkets path. This implements TTL-based refresh semantics.

    // In-flight — reuse existing promise (don't fire a duplicate)
    const existing = this.marketsLoadingPromise.get(exchangeName);
    if (existing) {
      logger.debug(`[CCXTAggregator] Awaiting in-flight loadMarkets for ${exchangeName}`);
      return existing;
    }

    // Start a new load and register the promise
    const loadPromise = this.marketLimiter(async () => {
      // Double-check after acquiring the limiter slot
      if (exchange.markets && Object.keys(exchange.markets).length > 0) {
        // If markets are present it means either another codepath populated them
        // while we awaited the limiter slot — still record them into cache and return.
        try {
          this.marketsCache.set(cacheKey, exchange.markets);
        } catch (err: any) {
          logger.warn(`[CCXTAggregator] Failed to cache markets for ${exchangeName}: ${err.message}`);
        }
        return;
      }

      logger.info(`[CCXTAggregator] Loading markets for ${exchangeName}...`);
      const start = Date.now();
      // Load markets from exchange (do NOT force refresh every time)
      // Add a per-exchange timeout to avoid permanently blocking callers if an exchange stalls.
      const LOAD_MARKETS_TIMEOUT_MS = this.getLoadMarketsTimeout(exchangeName);
      const loadOp = exchange.loadMarkets();
      await Promise.race([
        loadOp,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`loadMarkets timeout after ${LOAD_MARKETS_TIMEOUT_MS}ms`)), LOAD_MARKETS_TIMEOUT_MS)),
      ]);
      logger.info(
        `[CCXTAggregator] loadMarkets complete for ${exchangeName} ` +
        `(${Object.keys(exchange.markets).length} markets, ${Date.now() - start}ms)`
      );

      // Store loaded markets into the in-memory cache so future calls within TTL reuse them
      try {
        this.marketsCache.set(cacheKey, exchange.markets);
      } catch (err: any) {
        logger.warn(`[CCXTAggregator] Failed to cache markets for ${exchangeName}: ${err.message}`);
      }

      // Persist market metadata to Redis for cross-process reuse.
      try {
        const marketList = Object.values(exchange.markets || {}).map((market: any) => ({
          id: market.id,
          symbol: market.symbol,
          base: market.base,
          quote: market.quote,
          maker: market.maker,
          taker: market.taker,
          limits: market.limits,
        }));
        await unifiedCache.setMarkets(exchangeName, marketList);
      } catch (err: any) {
        logger.debug(`[CCXTAggregator] Failed to persist Redis market cache for ${exchangeName}: ${err.message}`);
      }
    }).finally(() => {
      // Clear lock so future calls can re-load if markets expire
      this.marketsLoadingPromise.delete(exchangeName);
    });

    this.marketsLoadingPromise.set(exchangeName, loadPromise);
    return loadPromise;
  }

  /**
   * Warm up markets for all initialized exchanges. Uses the same per-exchange limiter
   * so it won't saturate the event loop or CCXT internal rate limits.
   */
  private async warmupMarkets(): Promise<void> {
    try {
      logger.info('[CCXTAggregator] Warmup: pre-loading markets for high-volume exchanges');
      const eager = this.EAGER_WARMUP_EXCHANGES.filter((name) => this.exchanges.has(name));
      const names = eager.length > 0 ? eager : Array.from(this.exchanges.keys());
      await Promise.all(
        names.map((n) => this.ensureMarketsLoaded(n).catch((err) => {
          logger.warn(`[CCXTAggregator] Warmup failed for ${n}: ${err?.message || err}`);
        }))
      );
      logger.info('[CCXTAggregator] Warmup complete');
    } catch (err: any) {
      logger.warn('[CCXTAggregator] Warmup encountered errors:', err?.message || err);
    }
  }

  /**
   * Clear any pending markets-loading promises. Used by external callers
   * (eg. background job timeouts) to recover from stuck network requests.
   */
  clearMarketsLoadingLocks(): void {
    const count = this.marketsLoadingPromise.size;
    if (count > 0) {
      logger.warn(`[CCXTAggregator] Clearing ${count} markets-loading lock(s)`);
    }
    this.marketsLoadingPromise.clear();
  }

  clearMarketsLoadingForExchange(exchangeName: string): boolean {
    if (this.marketsLoadingPromise.has(exchangeName)) {
      this.marketsLoadingPromise.delete(exchangeName);
      logger.warn(`[CCXTAggregator] Cleared markets-loading lock for ${exchangeName}`);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // PRICE DISCOVERY METHODS
  // ---------------------------------------------------------------------------

  /**
   * FIX #1: Re-throws typed errors instead of returning null.
   *
   * CEXPriceCollector.fetchPriceForPair checks error.code === 'BadSymbol'
   * to decide whether to attempt fallback pairs. Previously this method
   * caught everything and returned null, so fallbacks were NEVER triggered.
   * Now BadSymbol → CCXTSymbolError, rate limit → CCXTRateLimitError,
   * other errors propagate as-is.
   */
  async getTickerFromExchange(
    exchangeName: string,
    symbol: string
  ): Promise<CachedPrice | null> {
    // Outer limiter to avoid flooding unifiedCache with concurrent callers
    const response = await this.tickerLimiter(async () =>
      unifiedCache.getOrFetchPrice(exchangeName, symbol, async () => {
        // Inner limiter still used to ensure background refreshes (stale-while-revalidate)
        return this.tickerLimiter(async () => {  // FIX #5: uses dedicated ticker limiter
          const exchange = this.exchanges.get(exchangeName);
          if (!exchange) {
            throw new Error(`Exchange ${exchangeName} not initialized`);
          }

          const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
          if (!formattedSymbol) {
            // FIX #1: Throw typed symbol error instead of returning null
            throw new CCXTSymbolError(
              `Symbol ${symbol} not supported on ${exchangeName}`
            );
          }

          const startTime = Date.now();

          try {
            // 🔴 CCXT API CALL #1: fetchTicker (Price Discovery)
            const ticker = await exchange.fetchTicker(formattedSymbol);
            const duration = Date.now() - startTime;

            externalAPITracker.recordCall({
              timestamp: new Date().toISOString(),
              type: 'ccxt',
              service: exchangeName,
              endpoint: `/fetchTicker/${formattedSymbol}`,
              method: 'GET',
              statusCode: 200,
              duration,
              dataSize: ticker ? JSON.stringify(ticker).length : 0,
            });

            // FIX #6: Fall back to baseVolume when quoteVolume is missing/zero
            const volume =
              ticker['quoteVolume'] ||
              (ticker['baseVolume'] && ticker['last']
                ? ticker['baseVolume'] * ticker['last']
                : ticker['baseVolume'] || 0);

            const price: CachedPrice = {
              symbol: formattedSymbol,
              exchange: exchangeName,
              bid: ticker['bid'] || 0,
              ask: ticker['ask'] || 0,
              last: ticker['last'] || 0,
              volume,                            // FIX #6
              timestamp: ticker['timestamp'] || Date.now(),
            };

            void publishMarketObservation({
              exchange: exchangeName,
              market_symbol: formattedSymbol,
              base_asset: symbol.split('/')[0] || '',
              quote_asset: symbol.split('/')[1] || '',
              market_type: 'spot',
              data_type: 'ticker',
              payload: {
                price: typeof ticker['last'] === 'number' ? ticker['last'] : null,
                bid: typeof ticker['bid'] === 'number' ? ticker['bid'] : null,
                ask: typeof ticker['ask'] === 'number' ? ticker['ask'] : null,
                spread: typeof ticker['bid'] === 'number' && typeof ticker['ask'] === 'number' ? ticker['ask'] - ticker['bid'] : null,
                volume_24h: typeof volume === 'number' ? volume : null,
              },
              exchange_timestamp: typeof ticker['timestamp'] === 'number' ? ticker['timestamp'] : Date.now(),
              received_timestamp: Date.now(),
              ingestion_timestamp: Date.now(),
              source_channel: 'rest',
              is_stale: false,
              is_valid: typeof ticker['last'] === 'number' && typeof ticker['bid'] === 'number' && typeof ticker['ask'] === 'number',
              schema_version: '1.0',
            }).catch(() => undefined);

            return price;
          } catch (error: any) {
            const duration = Date.now() - startTime;

            externalAPITracker.recordCall({
              timestamp: new Date().toISOString(),
              type: 'ccxt',
              service: exchangeName,
              endpoint: `/fetchTicker/${symbol}`,
              method: 'GET',
              statusCode: 500,
              duration,
              error: error.message,
            });

            // FIX #1: Classify and re-throw — do NOT swallow into null
            if (
              error instanceof ccxt.BadSymbol ||
              error.message?.includes('does not have market symbol') ||
              error.message?.includes('Invalid pair') ||
              error.message?.includes('not found')
            ) {
              throw new CCXTSymbolError(
                `Symbol ${symbol} not found on ${exchangeName}: ${error.message}`
              );
            }

            if (
              error instanceof ccxt.RateLimitExceeded ||
              error.message?.includes('rate limit') ||
              error.message?.includes('too many requests')
            ) {
              throw new CCXTRateLimitError(
                `Rate limit hit on ${exchangeName}: ${error.message}`
              );
            }

            // Network / unknown — propagate as-is so caller can classify
            logger.error(`[CCXTAggregator] fetchTicker error on ${exchangeName}:${symbol}: ${error.message}`);
            throw error;
          }
        });
      })
    );

    return response.data;
  }

  /**
   * Fetch prices from multiple exchanges simultaneously
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
          // Known symbol errors are expected for some exchanges; log at debug to reduce noise
          if (error instanceof CCXTSymbolError) {
            logger.debug(`Skipped unsupported pair ${symbol} on ${ex}: ${error.message}`);
          } else if (error instanceof CCXTRateLimitError) {
            logger.warn(`Rate limit hit for ${ex} while fetching ${symbol}: ${error.message}`);
          } else {
            logger.error(`Failed to fetch from ${ex}: ${error.message}`);
          }
          return { exchange: ex, price: null };
        })
    );

    const results = await Promise.allSettled(promises);
    const priceMap: Record<string, CachedPrice | null> = {};

    results.forEach((result, idx) => {
      priceMap[exchanges[idx]] =
        result.status === 'fulfilled' ? result.value.price : null;
    });

    return priceMap;
  }

  /**
   * Get best (tightest spread) price from multiple exchanges
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

    const validPrices = Object.entries(prices)
      .filter(([, price]) => price !== null)
      .map(([exchange, price]) => ({
        ...price!,
        spread: ((price!.ask - price!.bid) / price!.bid) * 100,
      }));

    if (validPrices.length === 0) {
      throw new Error(`No valid prices found for ${symbol}`);
    }

    const best = validPrices.reduce((prev, curr) =>
      curr.spread < prev.spread ? curr : prev
    );

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
        spread: best.spread,
      },
      all: prices,
      analysis: { tightest: best.exchange || 'unknown', spread_pct: spreadPct },
    };
  }

  // ---------------------------------------------------------------------------
  // OHLCV METHODS
  // ---------------------------------------------------------------------------

  async getOHLCVFromExchange(
    exchangeName: string,
    symbol: string,
    timeframe: string = '1h',
    limit: number = 24
  ): Promise<any[] | null> {
    const result = await unifiedCache.getOrFetchCandles(
      symbol,
      timeframe,
      limit,
      exchangeName,
      async () => {
        return this.tickerLimiter(async () => {  // FIX #5
          try {
            const exchange = this.exchanges.get(exchangeName);
            if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);

            const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
            if (!formattedSymbol) return [];

            const startTime = Date.now();
            // 🔴 CCXT API CALL #4: fetchOHLCV
            const ohlcv = await exchange.fetchOHLCV(formattedSymbol, timeframe, undefined, limit);
            const duration = Date.now() - startTime;

            externalAPITracker.recordCall({
              timestamp: new Date().toISOString(),
              type: 'ccxt',
              service: exchangeName,
              endpoint: `/fetchOHLCV/${formattedSymbol}/${timeframe}`,
              method: 'GET',
              statusCode: 200,
              duration,
              dataSize: ohlcv ? ohlcv.length * 100 : 0,
            });

            void publishMarketObservation({
              exchange: exchangeName,
              market_symbol: formattedSymbol,
              base_asset: symbol.split('/')[0] || '',
              quote_asset: symbol.split('/')[1] || '',
              market_type: 'spot',
              data_type: 'ohlcv',
              payload: {
                timeframe,
                open: Array.isArray(ohlcv) && ohlcv[0] ? Number(ohlcv[0][1]) : 0,
                high: Array.isArray(ohlcv) && ohlcv[0] ? Number(ohlcv[0][2]) : 0,
                low: Array.isArray(ohlcv) && ohlcv[0] ? Number(ohlcv[0][3]) : 0,
                close: Array.isArray(ohlcv) && ohlcv[0] ? Number(ohlcv[0][4]) : 0,
                volume: Array.isArray(ohlcv) && ohlcv[0] ? Number(ohlcv[0][5]) : 0,
                candle_timestamp: Array.isArray(ohlcv) && ohlcv[0] ? Number(ohlcv[0][0]) : Date.now(),
              },
              exchange_timestamp: Date.now(),
              received_timestamp: Date.now(),
              ingestion_timestamp: Date.now(),
              source_channel: 'rest',
              is_stale: false,
              is_valid: Array.isArray(ohlcv) && ohlcv.length > 0,
              schema_version: '1.0',
            }).catch(() => undefined);

            return ohlcv;
          } catch (error: any) {
            externalAPITracker.recordCall({
              timestamp: new Date().toISOString(),
              type: 'ccxt',
              service: exchangeName,
              endpoint: `/fetchOHLCV/${symbol}/${timeframe}`,
              method: 'GET',
              statusCode: 500,
              duration: 0,
              error: error.message,
            });
            logger.error(
              `Error fetching OHLCV for ${symbol} from ${exchangeName}: ${error.message}`
            );
            return [];
          }
        });
      }
    );

    return result.data.length > 0 ? result.data : null;
  }

  async getOHLCV(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 200,
    preferredExchanges: string[] = ['binance', 'coinbase', 'kraken']
  ): Promise<{ data: any[] | null; source: string }> {
    for (const exchange of preferredExchanges) {
      const data = await this.getOHLCVFromExchange(exchange, symbol, timeframe, limit);
      if (data && data.length > 0) return { data, source: exchange };
    }

    logger.warn(`No OHLCV data found for ${symbol} on any exchange`);
    return { data: null, source: 'none' };
  }

  // ---------------------------------------------------------------------------
  // ORDER BOOK METHODS
  // ---------------------------------------------------------------------------

  async fetchOrderBook(
    exchangeName: string,
    symbol: string,
    limit: number = 20
  ): Promise<any> {
    const cacheKey = `orderbook:${exchangeName}:${symbol}:${limit}`;
    const cached = this.ohlcvCache.get<any>(cacheKey);
    if (cached) return cached;

    return this.tickerLimiter(async () => {  // FIX #5
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);

        const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
        if (!formattedSymbol) throw new Error(`Symbol ${symbol} not supported on ${exchangeName}`);

        const startTime = Date.now();
        // 🔴 CCXT API CALL #16: fetchOrderBook
        const orderBook = await exchange.fetchOrderBook(formattedSymbol, limit);
        const duration = Date.now() - startTime;

        externalAPITracker.recordCall({
          timestamp: new Date().toISOString(),
          type: 'ccxt',
          service: exchangeName,
          endpoint: `/fetchOrderBook/${formattedSymbol}`,
          method: 'GET',
          statusCode: 200,
          duration,
          dataSize: orderBook ? (orderBook.bids.length + orderBook.asks.length) * 50 : 0,
        });

        void publishMarketObservation({
          exchange: exchangeName,
          market_symbol: formattedSymbol,
          base_asset: symbol.split('/')[0] || '',
          quote_asset: symbol.split('/')[1] || '',
          market_type: 'spot',
          data_type: 'orderbook',
          payload: {
            bids: Array.isArray(orderBook?.bids) ? orderBook.bids.slice(0, limit) : [],
            asks: Array.isArray(orderBook?.asks) ? orderBook.asks.slice(0, limit) : [],
            depth_levels: Array.isArray(orderBook?.bids) && Array.isArray(orderBook?.asks) ? Math.min(orderBook.bids.length, orderBook.asks.length) : 0,
          },
          exchange_timestamp: Date.now(),
          received_timestamp: Date.now(),
          ingestion_timestamp: Date.now(),
          source_channel: 'rest',
          is_stale: false,
          is_valid: Array.isArray(orderBook?.bids) || Array.isArray(orderBook?.asks),
          schema_version: '1.0',
        }).catch(() => undefined);

        this.ohlcvCache.set(cacheKey, orderBook, 5);
        return orderBook;
      } catch (error: any) {
        externalAPITracker.recordCall({
          timestamp: new Date().toISOString(),
          type: 'ccxt',
          service: exchangeName,
          endpoint: `/fetchOrderBook/${symbol}`,
          method: 'GET',
          statusCode: 500,
          duration: 0,
          error: error.message,
        });
        logger.error(
          `Error fetching order book for ${symbol} from ${exchangeName}: ${error.message}`
        );
        throw error;
      }
    });
  }

  async fetchTrades(
    exchangeName: string,
    symbol: string,
    limit: number = 100
  ): Promise<any[] | null> {
    const cacheKey = `trades:${exchangeName}:${symbol}:${limit}`;
    const cached = this.ohlcvCache.get<any[]>(cacheKey);
    if (cached) return cached;

    return this.tickerLimiter(async () => {  // FIX #5
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);

        const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
        if (!formattedSymbol) return null;

        // 🔴 CCXT API CALL #17: fetchTrades
        const trades = await exchange.fetchTrades(formattedSymbol, undefined, limit);
        this.ohlcvCache.set(cacheKey, trades, 30);
        return trades;
      } catch (error: any) {
        logger.error(`Error fetching trades for ${symbol} from ${exchangeName}: ${error.message}`);
        return null;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // ORDER MANAGEMENT METHODS
  // ---------------------------------------------------------------------------

  async validateOrder(
    exchangeName: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price?: number
  ): Promise<{ valid: boolean; errors: string[]; market?: ExchangeMarket }> {
    const errors: string[] = [];

    try {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) return { valid: false, errors: [`Exchange ${exchangeName} not found`] };

      const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
      if (!formattedSymbol) {
        return { valid: false, errors: [`Symbol ${symbol} not supported on ${exchangeName}`] };
      }

      // FIX #2: Use shared lock instead of inline loadMarkets check
      await this.ensureMarketsLoaded(exchangeName);

      const market = exchange.markets[formattedSymbol];
      if (!market) {
        return { valid: false, errors: [`Market ${formattedSymbol} not found on ${exchangeName}`] };
      }

      const minAmount = market.limits?.amount?.min || 0;
      const maxAmount = market.limits?.amount?.max || Infinity;
      if (amount < minAmount) errors.push(`Amount ${amount} below minimum ${minAmount}`);
      if (amount > maxAmount) errors.push(`Amount ${amount} above maximum ${maxAmount}`);

      if (price) {
        const minPrice = market.limits?.price?.min || 0;
        const maxPrice = market.limits?.price?.max || Infinity;
        if (price < minPrice) errors.push(`Price ${price} below minimum ${minPrice}`);
        if (price > maxPrice) errors.push(`Price ${price} above maximum ${maxPrice}`);
      }

      return { valid: errors.length === 0, errors, market };
    } catch (error: any) {
      return { valid: false, errors: [error.message] };
    }
  }

  async placeMarketOrder(
    exchangeName: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number
  ): Promise<OrderResult> {
    logger.info(`📊 Placing ${side} market order: ${amount} ${symbol} on ${exchangeName}`);

    const validation = await this.validateOrder(exchangeName, symbol, side, amount);
    if (!validation.valid) {
      throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
    }

    return this.privateLimiter(async () => {  // Use privateLimiter, not tickerLimiter
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);
      if (!exchange.apiKey || !exchange.secret) {
        throw new Error(`No API credentials configured for ${exchangeName}`);
      }

      const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
      if (!formattedSymbol) throw new Error(`Symbol ${symbol} not supported on ${exchangeName}`);

      try {
        // 🔴 CCXT API CALL #10: createMarketOrder
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
          timestamp: order['timestamp'],
        };
      } catch (error: any) {
        logger.error(`❌ Failed to place order: ${error.message}`);
        throw new Error(`Failed to place ${side} market order: ${error.message}`);
      }
    });
  }

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

    const validation = await this.validateOrder(exchangeName, symbol, side, amount, price);
    if (!validation.valid) {
      throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
    }

    return this.privateLimiter(async () => {  // Use privateLimiter, not tickerLimiter
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);
      if (!exchange.apiKey || !exchange.secret) {
        throw new Error(`No API credentials configured for ${exchangeName}`);
      }

      const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
      if (!formattedSymbol) throw new Error(`Symbol ${symbol} not supported on ${exchangeName}`);

      try {
        // 🔴 CCXT API CALL #11: createLimitOrder
        const order = await exchange.createLimitOrder(formattedSymbol, side, amount, price);
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
          timestamp: order['timestamp'],
        };
      } catch (error: any) {
        logger.error(`❌ Failed to place limit order: ${error.message}`);
        throw new Error(`Failed to place ${side} limit order: ${error.message}`);
      }
    });
  }

  async placeStopOrder(
    exchangeName: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    stopPrice: number,
    type: 'stop-loss' | 'stop-limit' = 'stop-loss'
  ): Promise<OrderResult> {
    logger.info(`📉 Placing ${side} ${type} order for ${amount} ${symbol} at ${stopPrice} on ${exchangeName}`);

    const validation = await this.validateOrder(exchangeName, symbol, side, amount, stopPrice);
    if (!validation.valid) {
      throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
    }

    return this.privateLimiter(async () => {  // Use privateLimiter
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);
      if (!exchange.apiKey || !exchange.secret) {
        throw new Error(`No API credentials configured for ${exchangeName}`);
      }

      const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
      if (!formattedSymbol) throw new Error(`Symbol ${symbol} not supported on ${exchangeName}`);

      try {
        const order = await exchange.createOrder(
          formattedSymbol,
          type === 'stop-limit' ? 'stopLimit' : 'stop',
          side,
          amount,
          stopPrice
        );

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
          timestamp: order['timestamp'],
        };
      } catch (error: any) {
        logger.error(`❌ Failed to place stop order: ${error.message}`);
        throw new Error(`Failed to place ${type} order: ${error.message}`);
      }
    });
  }

  async placeTakeProfitOrder(
    exchangeName: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    takeProfitPrice: number
  ): Promise<OrderResult> {
    logger.info(`📈 Placing ${side} take-profit order for ${amount} ${symbol} at ${takeProfitPrice} on ${exchangeName}`);

    const validation = await this.validateOrder(exchangeName, symbol, side, amount, takeProfitPrice);
    if (!validation.valid) {
      throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
    }

    return this.privateLimiter(async () => {  // Use privateLimiter
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);
      if (!exchange.apiKey || !exchange.secret) {
        throw new Error(`No API credentials configured for ${exchangeName}`);
      }

      const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
      if (!formattedSymbol) throw new Error(`Symbol ${symbol} not supported on ${exchangeName}`);

      try {
        const order = await exchange.createOrder(
          formattedSymbol,
          'takeProfit',
          side,
          amount,
          takeProfitPrice
        );

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
          timestamp: order['timestamp'],
        };
      } catch (error: any) {
        logger.error(`❌ Failed to place take-profit order: ${error.message}`);
        throw new Error(`Failed to place take-profit order: ${error.message}`);
      }
    });
  }

  async placeTrailingStopOrder(
    exchangeName: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    trailPercent?: number,
    trailAmount?: number
  ): Promise<OrderResult> {
    logger.info(`🧭 Placing ${side} trailing-stop order for ${amount} ${symbol} on ${exchangeName}`);

    const validation = await this.validateOrder(exchangeName, symbol, side, amount);
    if (!validation.valid) {
      throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
    }

    return this.privateLimiter(async () => {  // Use privateLimiter
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);
      if (!exchange.apiKey || !exchange.secret) {
        throw new Error(`No API credentials configured for ${exchangeName}`);
      }

      const formattedSymbol = await this.formatSymbolForExchange(exchangeName, symbol);
      if (!formattedSymbol) throw new Error(`Symbol ${symbol} not supported on ${exchangeName}`);

      try {
        const params: Record<string, any> = {};
        if (trailPercent !== undefined) params.trailingPercent = trailPercent;
        if (trailAmount !== undefined) params.trailingAmount = trailAmount;

        const order = await exchange.createOrder(formattedSymbol, 'trailingStop', side, amount, undefined, params);

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
          timestamp: order['timestamp'],
        };
      } catch (error: any) {
        logger.error(`❌ Failed to place trailing-stop order: ${error.message}`);
        throw new Error(`Failed to place trailing-stop order: ${error.message}`);
      }
    });
  }

  async checkOrderStatus(
    exchangeName: string,
    orderId: string,
    symbol?: string
  ): Promise<OrderStatus> {
    return this.privateLimiter(async () => {  // Use privateLimiter for account queries
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);

        // 🔴 CCXT API CALL #12: fetchOrder
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
          timestamp: order['timestamp'],
        };
      } catch (error: any) {
        logger.error(`Error checking order status: ${error.message}`);
        throw new Error(`Failed to check order status: ${error.message}`);
      }
    });
  }

  async cancelOrder(
    exchangeName: string,
    orderId: string,
    symbol?: string
  ): Promise<boolean> {
    logger.info(`❌ Canceling order ${orderId} on ${exchangeName}`);

    return this.privateLimiter(async () => {  // Use privateLimiter
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);
        if (!exchange.apiKey || !exchange.secret) {
          throw new Error(`No API credentials configured for ${exchangeName}`);
        }

        // 🔴 CCXT API CALL #13: cancelOrder
        await exchange.cancelOrder(orderId, symbol);
        logger.info(`✅ Order canceled: ${orderId}`);
        return true;
      } catch (error: any) {
        logger.error(`Failed to cancel order: ${error.message}`);
        throw new Error(`Failed to cancel order: ${error.message}`);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // ACCOUNT METHODS
  // ---------------------------------------------------------------------------

  async getBalances(exchangeName: string): Promise<BalanceInfo> {
    return this.privateLimiter(async () => {  // Use privateLimiter for account queries
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);
        if (!exchange.apiKey || !exchange.secret) {
          throw new Error(`No API credentials configured for ${exchangeName}`);
        }

        // 🔴 CCXT API CALL #14: fetchBalance
        const balance = await exchange.fetchBalance();

        const result: BalanceInfo = {};
        // FIX #2: Skip reserved keys that are not assets
        // CCXT fetchBalance() includes: free, used, total, info, datetime, timestamp
        // Only iterate over actual asset holdings (free/used/total are object keys for assets)
        const RESERVED_KEYS = new Set(['free', 'used', 'total', 'info', 'datetime', 'timestamp']);
        
        for (const [asset, data] of Object.entries(balance)) {
          // Skip reserved keys and non-object values
          if (RESERVED_KEYS.has(asset) || typeof data !== 'object' || data === null) {
            continue;
          }
          result[asset] = {
            free: (data as any)['free'] || 0,
            used: (data as any)['used'] || 0,
            total: (data as any)['total'] || 0,
          };
        }
        return result;
      } catch (error: any) {
        logger.error(`Failed to fetch balances from ${exchangeName}: ${error.message}`);
        throw new Error(`Failed to fetch balances: ${error.message}`);
      }
    });
  }

  /**
   * Get balances for a specific credential (multi-user support)
   * 
   * NEW API: Uses per-credential clients instead of global exchange instances
   * Enables multi-user, multi-account support
   * 
   * @param credentialId - Unique credential ID
   * @param userId - User ID for authorization
   * @returns Balance info keyed by asset
   */
  async getBalancesForCredential(credentialId: string, userId: string): Promise<BalanceInfo> {
    return this.privateLimiter(async () => {
      try {
        const exchange = await cexCredentialManager.getClientForCredential(credentialId, userId);

        // 🔴 CCXT API CALL #14: fetchBalance (per-credential)
        const balance = await exchange.fetchBalance();

        const result: BalanceInfo = {};
        const RESERVED_KEYS = new Set(['free', 'used', 'total', 'info', 'datetime', 'timestamp']);
        
        for (const [asset, data] of Object.entries(balance)) {
          if (RESERVED_KEYS.has(asset) || typeof data !== 'object' || data === null) {
            continue;
          }
          result[asset] = {
            free: (data as any)['free'] || 0,
            used: (data as any)['used'] || 0,
            total: (data as any)['total'] || 0,
          };
        }
        return result;
      } catch (error: any) {
        logger.error(`Failed to fetch balances for credential ${credentialId}: ${error.message}`);
        throw error;
      }
    });
  }

  /**
   * Place market order with idempotency support (credential-based)
   * 
   * NEW API: Multi-user, multi-account version with:
   * - Per-credential client routing
   * - Idempotency key enforcement (prevents double-submit)
   * - Automatic position persistence to futures_positions table
   * 
   * @param credentialId - Unique credential ID
   * @param userId - User ID for authorization
   * @param symbol - Trading symbol (BTC, ETH, etc.)
   * @param side - Trade direction (buy/sell)
   * @param amount - Quantity to trade
   * @param idempotencyKey - Optional: Client-provided idempotency key (UUID recommended)
   * @returns Order result with ID and status
   */
  async placeMarketOrderForCredential(
    credentialId: string,
    userId: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    idempotencyKey?: string
  ): Promise<OrderResult> {
    try {
      logger.info(`📊 Placing ${side} market order: ${amount} ${symbol} for credential ${credentialId}`);

      // Get credential info to determine exchange
      const credential = await cexCredentialManager.getClientForCredential(credentialId, userId);
      const exchange = credential.id.split(':')[0] || 'unknown'; // Extract exchange from client

      // Generate idempotency key if not provided
      const key = idempotencyKey || OrderIdempotencyRepository.generateIdempotencyKey({
        userId,
        credentialId,
        symbol,
        side,
        amount,
      });

      // Check if this order was already placed
      const existing = await orderIdempotencyRepository.getIdempotencyKey(exchange, key);
      if (existing && existing.result_order_id) {
        logger.info(`[Idempotency] Returning cached order ${existing.result_order_id}`);
        return {
          success: true,
          orderId: existing.result_order_id,
          symbol,
          side,
          amount,
          filled: 0,
          average: 0,
          fee: 0,
          cost: 0,
          status: existing.result_status || 'pending',
          timestamp: Date.now(),
        };
      }

      return this.privateLimiter(async () => {
        const client = await cexCredentialManager.getClientForCredential(credentialId, userId);

        // Validate order
        const validation = await this.validateOrder(exchange, symbol, side, amount);
        if (!validation.valid) {
          throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
        }

        const formattedSymbol = await this.formatSymbolForExchange(exchange, symbol);
        if (!formattedSymbol) {
          throw new Error(`Symbol ${symbol} not supported on ${exchange}`);
        }

        try {
          // 🔴 CCXT API CALL #10: createMarketOrder (per-credential)
          const order = await client.createMarketOrder(formattedSymbol, side, amount);
          logger.info(`✅ Order placed: ${order.id}`);

          // Store idempotency key with result
          await orderIdempotencyRepository.storeIdempotencyKey({
            user_id: userId,
            credential_id: credentialId,
            exchange,
            idempotency_key: key,
            order_type: 'market',
            symbol: formattedSymbol,
            side,
            amount,
            result_order_id: order.id,
            result_status: order.status,
          });

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
            timestamp: order['timestamp'],
          };
        } catch (error: any) {
          // Store error for debugging
          await orderIdempotencyRepository.storeIdempotencyKey({
            user_id: userId,
            credential_id: credentialId,
            exchange,
            idempotency_key: key,
            order_type: 'market',
            symbol,
            side,
            amount,
            result_error: error.message,
          });

          logger.error(`❌ Failed to place market order: ${error.message}`);
          throw new Error(`Failed to place ${side} market order: ${error.message}`);
        }
      });
    } catch (error: any) {
      logger.error(`Market order for credential ${credentialId} failed:`, error);
      throw error;
    }
  }

  /**
   * Place limit order with idempotency support (credential-based)
   * 
   * NEW API: Multi-user, multi-account version with idempotency enforcement
   */
  async placeLimitOrderForCredential(
    credentialId: string,
    userId: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number,
    idempotencyKey?: string
  ): Promise<OrderResult> {
    try {
      logger.info(`📊 Placing ${side} limit order: ${amount} ${symbol} @ ${price} for credential ${credentialId}`);

      const credential = await cexCredentialManager.getClientForCredential(credentialId, userId);
      const exchange = credential.id?.split(':')[0] || 'unknown';

      const key = idempotencyKey || OrderIdempotencyRepository.generateIdempotencyKey({
        userId,
        credentialId,
        symbol,
        side,
        amount,
        price,
      });

      const existing = await orderIdempotencyRepository.getIdempotencyKey(exchange, key);
      if (existing && existing.result_order_id) {
        logger.info(`[Idempotency] Returning cached order ${existing.result_order_id}`);
        return {
          success: true,
          orderId: existing.result_order_id,
          symbol,
          side,
          amount,
          filled: 0,
          average: price,
          fee: 0,
          cost: amount * price,
          status: existing.result_status || 'pending',
          timestamp: Date.now(),
        };
      }

      return this.privateLimiter(async () => {
        const client = await cexCredentialManager.getClientForCredential(credentialId, userId);

        const validation = await this.validateOrder(exchange, symbol, side, amount, price);
        if (!validation.valid) {
          throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
        }

        const formattedSymbol = await this.formatSymbolForExchange(exchange, symbol);
        if (!formattedSymbol) {
          throw new Error(`Symbol ${symbol} not supported on ${exchange}`);
        }

        try {
          // 🔴 CCXT API CALL #11: createLimitOrder (per-credential)
          const order = await client.createLimitOrder(formattedSymbol, side, amount, price);
          logger.info(`✅ Limit order placed: ${order.id}`);

          await orderIdempotencyRepository.storeIdempotencyKey({
            user_id: userId,
            credential_id: credentialId,
            exchange,
            idempotency_key: key,
            order_type: 'limit',
            symbol: formattedSymbol,
            side,
            amount,
            price,
            result_order_id: order.id,
            result_status: order.status,
          });

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
            timestamp: order['timestamp'],
          };
        } catch (error: any) {
          await orderIdempotencyRepository.storeIdempotencyKey({
            user_id: userId,
            credential_id: credentialId,
            exchange,
            idempotency_key: key,
            order_type: 'limit',
            symbol,
            side,
            amount,
            price,
            result_error: error.message,
          });

          logger.error(`❌ Failed to place limit order: ${error.message}`);
          throw new Error(`Failed to place ${side} limit order: ${error.message}`);
        }
      });
    } catch (error: any) {
      logger.error(`Limit order for credential ${credentialId} failed:`, error);
      throw error;
    }
  }

  /**
   * Fetch open positions for a credential (multi-user support)
   * 
   * NEW API: Uses per-credential client
   */
  async fetchOpenPositionsForCredential(credentialId: string, userId: string): Promise<any[]> {
    return this.privateLimiter(async () => {
      try {
        const exchange = await cexCredentialManager.getClientForCredential(credentialId, userId);

        // Check if exchange supports fetchOpenPositions
        if (!exchange.has || !exchange.has['fetchOpenPositions']) {
          logger.debug(`Exchange does not support fetchOpenPositions`);
          return [];
        }

        // 🔴 CCXT API CALL #16: fetchOpenPositions (per-credential)
        const positions = await exchange.fetchOpenPositions();
        return positions || [];
      } catch (error: any) {
        logger.warn(`Failed to fetch positions for credential ${credentialId}: ${error.message}`);
        return [];
      }
    });
  }

  /**
   * Fetch open positions (perpetuals/futures)
   * Returns array of open positions including leverage, liquidation price, P&L
   * 
   * @param exchangeName - Exchange identifier (binance, bybit, etc.)
   * @returns Array of open positions
   */
  async fetchOpenPositions(exchangeName: string): Promise<any[]> {
    return this.privateLimiter(async () => {  // Use privateLimiter for account queries
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);
        if (!exchange.apiKey || !exchange.secret) {
          logger.warn(`No API credentials for ${exchangeName}, cannot fetch positions`);
          return [];
        }

        // Check if exchange supports fetchOpenPositions
        if (!exchange.has || !exchange.has['fetchOpenPositions']) {
          logger.debug(`${exchangeName} does not support fetchOpenPositions`);
          return [];
        }

        // 🔴 CCXT API CALL #16: fetchOpenPositions (Perpetuals)
        const positions = await exchange.fetchOpenPositions();
        return positions || [];
      } catch (error: any) {
        logger.warn(`Failed to fetch positions from ${exchangeName}: ${error.message}`);
        // Return empty array instead of throwing to allow graceful fallback
        return [];
      }
    });
  }

  /**
   * Set leverage for a perpetual position
   * 
   * Exchange-specific implementations:
   * - Binance: POST /v3/leverage (setLeverage)
   * - Bybit: linear/leverage (setLeverage)
   * - OKX: Account setLeverage (complex params)
   * - Kraken: margin setup (different API)
   * 
   * @param exchangeName - Exchange identifier
   * @param leverage - Leverage value (1-125 depending on exchange)
   * @param symbol - Optional: Symbol to set leverage for (exchange-specific)
   * @returns Success status and result
   */
  async setLeverage(
    exchangeName: string,
    leverage: number,
    symbol?: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    return this.privateLimiter(async () => {
      try {
        const exchange = this.exchanges.get(exchangeName);
        if (!exchange) {
          throw new Error(`Exchange ${exchangeName} not initialized`);
        }
        if (!exchange.apiKey || !exchange.secret) {
          throw new Error(`No API credentials configured for ${exchangeName}`);
        }

        // Validate leverage bounds (exchange-specific)
        const maxLeverage = this.getMaxLeverage(exchangeName);
        if (leverage < 1 || leverage > maxLeverage) {
          throw new Error(`Leverage must be between 1 and ${maxLeverage} on ${exchangeName}`);
        }

        logger.info(`📊 Setting leverage to ${leverage}x on ${exchangeName}${symbol ? ` for ${symbol}` : ''}`);

        // Exchange-specific setLeverage implementation
        let result: any;
        const lowerExchange = exchangeName.toLowerCase();

        if (lowerExchange === 'binance' || lowerExchange === 'bybit' || lowerExchange === 'okx') {
          // Most exchanges support standard setLeverage (if they have leverage at all)
          if (!exchange.has || !exchange.has['setLeverage']) {
            throw new Error(`${exchangeName} does not support setLeverage`);
          }

          // 🔴 CCXT API CALL: setLeverage (Perpetuals)
          result = await exchange.setLeverage(leverage, symbol);
          logger.info(`✅ Leverage set to ${leverage}x on ${exchangeName}`, result);

          return { success: true, result };
        } else if (lowerExchange === 'kraken') {
          // Kraken doesn't have a direct setLeverage; leverage is per-account
          logger.warn(`[${exchangeName}] Leverage must be configured separately per account`);
          return {
            success: false,
            error: `${exchangeName} does not support dynamic leverage adjustment via API`,
          };
        } else {
          // Generic fallback
          throw new Error(`Leverage management not implemented for ${exchangeName}`);
        }
      } catch (error: any) {
        logger.error(`Failed to set leverage on ${exchangeName}: ${error.message}`);
        return {
          success: false,
          error: error.message,
        };
      }
    });
  }

  /**
   * Get maximum leverage for an exchange
   */
  private getMaxLeverage(exchangeName: string): number {
    const limits: Record<string, number> = {
      binance: 125,
      bybit: 100,
      okx: 75,
      kraken: 5,      // Kraken has lower limits
      coinbase: 2,    // Coinbase doesn't support high leverage
      kucoin: 20,
      gateio: 30,
    };
    return limits[exchangeName.toLowerCase()] || 10;
  }

  // ---------------------------------------------------------------------------
  // UTILITY METHODS
  // ---------------------------------------------------------------------------

  /**
   * FIX #2 + FIX #3: Uses ensureMarketsLoaded (shared lock) and
   * expanded QUOTE_CURRENCIES list (now includes BTC, ETH).
   */
  private async formatSymbolForExchange(
    exchangeName: string,
    symbol: string
  ): Promise<string | null> {
    try {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) return null;

      // Already in pair format — return as-is
      if (symbol.includes('/')) return symbol;

      // FIX #2: Use shared lock instead of inline check
      await this.ensureMarketsLoaded(exchangeName);

      // FIX #3: Try all quote currencies including BTC and ETH
      for (const quote of QUOTE_CURRENCIES) {
        const pair = `${symbol}/${quote}`;
        if (exchange.markets && exchange.markets[pair]) {
          return pair;
        }
      }

      // Fallback: prefix scan (case-insensitive)
      if (exchange.markets) {
        const searchPrefix = symbol.toUpperCase() + '/';
        for (const key of Object.keys(exchange.markets)) {
          if (key.toUpperCase().startsWith(searchPrefix)) {
            logger.debug(
              `[CCXTAggregator] formatSymbol fallback: ${symbol} → ${key} on ${exchangeName}`
            );
            return key;
          }
        }
      }

      return null;
    } catch (error: any) {
      logger.error(`Error formatting symbol ${symbol} on ${exchangeName}: ${error.message}`);
      return null;
    }
  }

  async getMarkets(exchangeName: string): Promise<ExchangeMarket[]> {
    const result = await unifiedCache.getOrLoadMarkets(exchangeName, async () => {
      return this.marketLimiter(async () => {  // FIX #5
        try {
          const exchange = this.exchanges.get(exchangeName);
          if (!exchange) {
            logger.error(`🔴 Exchange ${exchangeName} NOT initialized`);
            throw new Error(`Exchange ${exchangeName} not initialized`);
          }

          // FIX #2: Use shared lock
          await this.ensureMarketsLoaded(exchangeName);

          const marketObjs = Object.values(exchange.markets || {});
          logger.info(`📡 ${exchangeName} has ${marketObjs.length} markets`);

          return marketObjs.map((market: any) => ({
            id: market.id,
            symbol: market.symbol,
            base: market.base,
            quote: market.quote,
            maker: market.maker,
            taker: market.taker,
            limits: market.limits,
          }));
        } catch (error: any) {
          logger.error(`Failed to load markets from ${exchangeName}: ${error.message}`, {
            stack: error.stack,
          });
          throw new Error(`Failed to load markets: ${error.message}`);
        }
      });
    });

    logger.info(
      `[getMarkets] ${exchangeName}: ${result.data?.length || 0} markets (source: ${result.source})`
    );
    return result.data;
  }

  getAvailableExchanges(): string[] {
    return Array.from(this.exchanges.keys());
  }

  async getAvailableAssets(exchangeName: string): Promise<any[]> {
    const exchange = this.exchanges.get(exchangeName);
    if (!exchange) throw new Error(`Exchange ${exchangeName} not initialized`);

    // FIX #2: Use shared lock
    await this.ensureMarketsLoaded(exchangeName);

    return Object.keys(exchange.markets)
      .map((symbol) => {
        const override = assetOverrides[symbol] || {};
        return { symbol, ...override };
      })
      .filter((asset) => !asset.hidden);
  }

  getExchangeStatus(): Record<string, { connected: boolean; hasCredentials: boolean }> {
    const status: Record<string, { connected: boolean; hasCredentials: boolean }> = {};
    this.exchanges.forEach((exchange, name) => {
      status[name] = {
        connected: !!exchange,
        hasCredentials: !!(exchange.apiKey && exchange.secret),
      };
    });
    return status;
  }

  clearCaches(): void {
    this.priceCache.flushAll();
    this.ohlcvCache.flushAll();
    this.marketsCache.flushAll();
    logger.info('🧹 Cleared all CCXT caches');
  }

  getCacheStats(): {
    prices: { keys: number; size: number };
    ohlcv: { keys: number; size: number };
    markets: { keys: number; size: number };
  } {
    return {
      prices: { keys: this.priceCache.keys().length, size: this.priceCache.getStats().ksize || 0 },
      ohlcv: { keys: this.ohlcvCache.keys().length, size: this.ohlcvCache.getStats().ksize || 0 },
      markets: { keys: this.marketsCache.keys().length, size: this.marketsCache.getStats().ksize || 0 },
    };
  }

  /**
   * FIX #4: Use per-exchange reliable symbols for health checks.
   * Previously used hardcoded CELO/USDC which doesn't exist on most
   * exchanges, causing all error catches to fire silently and every
   * exchange to report ok: true regardless of actual connectivity.
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
        // FIX #4: Use per-exchange known-good symbol, not CELO/USDC
        const healthSymbol = HEALTH_CHECK_SYMBOLS[name] || HEALTH_CHECK_FALLBACK;

        // 🔴 CCXT API CALL #15: fetchTicker (Health Check)
        await exchange.fetchTicker(healthSymbol);
        checks[name] = { ok: true };
        healthyCount++;
      } catch (error: any) {
        // FIX #4: Real errors are now surfaced instead of swallowed
        checks[name] = { ok: false, error: error.message };
        logger.warn(`[CCXTAggregator] Health check failed for ${name}: ${error.message}`);
      }
    }

    const total = this.getAvailableExchanges().length;
    const status: 'healthy' | 'degraded' | 'unhealthy' =
      healthyCount === 0 ? 'unhealthy' :
      healthyCount < total * 0.75 ? 'degraded' :
      'healthy';

    return { status, timestamp: Date.now(), exchanges: checks };
  }
}

/**
 * Singleton instance
 */
const ccxtService = new CCXTAggregator();

export default ccxtService;
export { ccxtService };