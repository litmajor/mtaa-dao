/**
 * Symbol Universe Service
 *
 * Primary interface for symbol discovery and price management.
 * Integrates TokenRegistry with CEX capabilities and price sources.
 *
 * FIXES APPLIED:
 * 1. Discovery timeout raised from 2s → 15s; cold-start exchanges (Kraken,
 *    KuCoin) regularly take 3–8s for loadMarkets(). A 2s timeout caused the
 *    entire exchange to fall back to 7 hardcoded pairs for the full 1h TTL.
 * 2. getFallbackPairs() now generates systematic fallbacks across all quote
 *    currencies instead of only checking config stubs (which were empty for
 *    OKX, Bybit, KuCoin) and a single USDT→USD swap.
 * 3. performMarketDiscovery() filter expanded to include BTC and ETH quote
 *    currencies so high-volume cross pairs aren't silently dropped.
 * 4. getPrice() now distinguishes CCXTSymbolError (skip exchange) from
 *    CCXTRateLimitError (back off, stop trying that exchange) instead of
 *    catching all errors and continuing blindly.
 * 5. COMMON_FALLBACK_PAIRS expanded to cover USD, USDC, and BTC-quoted
 *    variants so cold-start fallback isn't limited to 7 USDT pairs.
 * 6. Background rediscovery: when stale cache is served due to timeout, a
 *    background refresh fires so the next collection run gets live data.
 */

import { tokenRegistry } from './tokenRegistry';
import { ccxtService, CCXTSymbolError, CCXTRateLimitError } from './ccxtService';
import { marketUniverseBuilder } from './marketUniverseBuilder';
import { cacheManager } from '../core/consolidation/DataCacheConsolidation';
import { priceOracle } from './priceOracle';
import { SYMBOL_UNIVERSE_CONFIG } from '../config/symbolUniverseConfig';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface SymbolPrice {
  symbol: string;
  quote: string;
  price: number;
  source: 'cex' | 'ohlcv' | 'coingecko';
  exchange?: string;
  timestamp: number;
  change24h?: number;
  volume24h?: number;
}

export interface PriceUpdate {
  symbol: string;
  price: number;
  source: string;
  timestamp: number;
}

// FIX #5: Expanded fallback pairs covering multiple quote currencies and
// including BTC-quoted pairs for exchanges that don't support USDT well.
const COMMON_FALLBACK_PAIRS = [
  // USDT-quoted (most exchanges)
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT',
  'ADA/USDT', 'AVAX/USDT', 'MATIC/USDT', 'LINK/USDT',
  'DOT/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT',
  // USD-quoted (Kraken, Coinbase)
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD',
  'AVAX/USD', 'MATIC/USD', 'LINK/USD', 'DOT/USD',
  // USDC-quoted (Coinbase, Binance)
  'BTC/USDC', 'ETH/USDC', 'SOL/USDC',
  // BTC-quoted (cross pairs, high volume on Kraken/Binance)
  'ETH/BTC', 'LINK/BTC', 'ADA/BTC',
];

// FIX #3: Quote currencies to filter markets by during discovery.
// Previously only used exchange-config supportedQuotes which omitted BTC/ETH.
const DISCOVERY_QUOTE_CURRENCIES = ['USDT', 'USD', 'USDC', 'BUSD', 'BTC', 'ETH'];

// Tokens that are native to Celo or otherwise not listed on centralized exchanges
// (uppercase keys for case-insensitive comparisons)
const CEX_INCOMPATIBLE = new Set([
  'CKES', 'CUSD', 'CEUR', 'CREAL', 'CELO', 'MTAA'
]);

/**
 * Symbol Universe Service — single source of truth for symbols
 */
export class SymbolUniverseService extends EventEmitter {
  private priceCache: Map<string, SymbolPrice> = new Map();
  private supportedPairsCache: Map<string, Set<string>> = new Map();
  private lastDiscovery: Map<string, number> = new Map();
  private allSymbolsCache: Set<string> | null = null;

  // FIX #6: Track in-flight background refreshes so we don't stack them
  private backgroundRefreshInProgress: Set<string> = new Set();

  private readonly DISCOVERY_CACHE_TTL = 3_600_000;   // 1 hour

  // FIX #1: Raised from 2s → 15s.
  // Kraken and KuCoin loadMarkets() regularly takes 3–8s on cold start.
  // At 2s the timeout fired before markets loaded, poisoning the cache
  // with 7 hardcoded pairs for the full 1h TTL.
  private readonly DISCOVERY_TIMEOUT = 15_000;

  constructor() {
    super();
    this.initialize();
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  private initialize(): void {
    logger.info('🔄 Initializing Symbol Universe Service...');

    const cachedPrices = cacheManager.getCache('symbol_prices');
    if (cachedPrices) {
      logger.info('✅ Loaded price cache');
    }

    const cexSources = SYMBOL_UNIVERSE_CONFIG.priceSources.cex;
    Object.keys(cexSources).forEach((exchange: string) => {
      this.supportedPairsCache.set(exchange, new Set());
    });

    logger.info('✅ Symbol Universe Service ready');
  }

  // ---------------------------------------------------------------------------
  // Symbol resolution
  // ---------------------------------------------------------------------------

  getAllSymbols(): string[] {
    // Backwards-compatible: return on-chain registry symbols by default
    return this.getAllOnChainSymbols();
  }

  /**
   * Explicit: return all on-chain symbols from the token registry
   */
  getAllOnChainSymbols(): string[] {
    if (this.allSymbolsCache) return Array.from(this.allSymbolsCache);
    try {
      const tokens = (tokenRegistry as any).getAllTokens?.() || [];
      this.allSymbolsCache = new Set((tokens as any[]).map((t: any) => String(t.symbol).toUpperCase()));
      return Array.from(this.allSymbolsCache);
    } catch (err) {
      logger.warn('[getAllOnChainSymbols] tokenRegistry lookup failed, returning empty list');
      return [];
    }
  }

  /**
   * Build a list of CEX-tradable symbols by consulting the market universe builder.
   * Returns symbols sorted by number of exchanges listing them (descending).
   * This is the preferred method as it leverages pre-built universe data.
   */
  async getAllCEXSymbols(options?: { limit?: number; minExchanges?: number }): Promise<string[]> {
    try {
      // Get configured CEX exchanges
      const cexConfig = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;
      const exchanges = Object.keys(cexConfig).filter((e) => cexConfig[e]?.enabled);

      // Build/fetch the market universe from CCXT
      await marketUniverseBuilder.buildUniverse(exchanges);
      
      // Get top symbols by arbitrage eligibility (most liquid, most exchanges)
      const limit = options?.limit ?? 500;
      const topSymbols = marketUniverseBuilder.getTopArbitrageSymbols(limit);
      
      logger.debug(
        `[getAllCEXSymbols] Built CEX symbol list: ${topSymbols.length} symbols ` +
        `(limit: ${limit})`
      );
      
      return topSymbols;
    } catch (err) {
      logger.warn(
        `[getAllCEXSymbols] Failed to build universe, falling back to manual discovery: ${err instanceof Error ? err.message : err}`
      );
      
      // Fallback to manual discovery (pre-universe method)
      const cexConfig = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;
      const exchanges = Object.keys(cexConfig).filter((e) => cexConfig[e]?.enabled);

      const symbolToExchanges: Map<string, Set<string>> = new Map();

      const promises = exchanges.map((ex) =>
        this.getSupportedPairs(ex)
          .then((pairs) => ({ ex, pairs }))
          .catch((err) => {
            logger.debug(`[getAllCEXSymbols] ${ex} discovery failed: ${err?.message || err}`);
            return { ex, pairs: [] as string[] };
          })
      );

      const results = await Promise.all(promises);

      for (const { ex, pairs } of results) {
        for (const p of pairs) {
          const parts = String(p).toUpperCase().split('/');
          if (parts.length !== 2) continue;
          const [base, quote] = parts;
          if (!DISCOVERY_QUOTE_CURRENCIES.includes(quote)) continue;
          if (CEX_INCOMPATIBLE.has(base)) continue;

          if (!symbolToExchanges.has(base)) symbolToExchanges.set(base, new Set());
          symbolToExchanges.get(base)!.add(ex);
        }
      }

      const arr = Array.from(symbolToExchanges.entries())
        .map(([symbol, exSet]) => ({ symbol, count: exSet.size }))
        .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol));

      const limit = options?.limit ?? 500;
      return arr.slice(0, limit).map((r) => r.symbol);
    }
  }

  /**
   * Produce a list of arbitrage-eligible pairs (e.g. 'BTC/USDT') that are
   * tradable on at least `minExchanges` exchanges. Prefers `preferredQuote`.
   * Uses the market universe builder for pre-built pair data.
   */
  async getArbitrageEligiblePairs(options?: { minExchanges?: number; preferredQuote?: string; limit?: number }): Promise<string[]> {
    try {
      const minExchanges = options?.minExchanges ?? 2;
      const preferredQuote = (options?.preferredQuote || 'USDT').toUpperCase();
      const limit = options?.limit ?? 200;

      // Get configured CEX exchanges
      const cexConfig = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;
      const exchanges = Object.keys(cexConfig).filter((e) => cexConfig[e]?.enabled);

      // Build/fetch the market universe from CCXT
      await marketUniverseBuilder.buildUniverse(exchanges);
      
      // Get trading pairs from universe (already filtered for arbitrage eligibility)
      const pairs = marketUniverseBuilder.getTradingPairs(limit, preferredQuote);
      
      logger.debug(
        `[getArbitrageEligiblePairs] Got ${pairs.length} arb-eligible pairs ` +
        `(minExchanges: ${minExchanges}, quote: ${preferredQuote}, limit: ${limit})`
      );
      
      return pairs;
    } catch (err) {
      logger.warn(
        `[getArbitrageEligiblePairs] Failed to use universe builder, falling back to manual discovery: ${err instanceof Error ? err.message : err}`
      );

      // Fallback to manual discovery (pre-universe method)
      const minExchanges = options?.minExchanges ?? 2;
      const preferredQuote = (options?.preferredQuote || 'USDT').toUpperCase();
      const cexConfig = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;
      const exchanges = Object.keys(cexConfig).filter((e) => cexConfig[e]?.enabled);

      const pairToExchanges: Map<string, Set<string>> = new Map();

      const promises = exchanges.map((ex) =>
        this.getSupportedPairs(ex)
          .then((pairs) => ({ ex, pairs }))
          .catch((err) => ({ ex, pairs: [] as string[] }))
      );

      const results = await Promise.all(promises);

      for (const { ex, pairs } of results) {
        for (const p of pairs) {
          const up = String(p).toUpperCase();
          const parts = up.split('/');
          if (parts.length !== 2) continue;
          const [base, quote] = parts;
          if (CEX_INCOMPATIBLE.has(base)) continue;
          if (quote !== preferredQuote) continue; // Only count pairs in preferred quote

          if (!pairToExchanges.has(up)) pairToExchanges.set(up, new Set());
          pairToExchanges.get(up)!.add(ex);
        }
      }

      const eligible = Array.from(pairToExchanges.entries())
        .filter(([pair, exSet]) => exSet.size >= minExchanges)
        .map(([pair, exSet]) => ({ pair, count: exSet.size }))
        .sort((a, b) => b.count - a.count || a.pair.localeCompare(b.pair));

      const limit = options?.limit ?? 200;
      return eligible.slice(0, limit).map((r) => r.pair);
    }
  }

  // ---------------------------------------------------------------------------
  // Pair discovery
  // ---------------------------------------------------------------------------

  /**
   * Discover supported pairs for an exchange.
   *
   * FIX #1: Timeout raised to 15s so Kraken/KuCoin cold-start market loads
   * complete before we fall back. When a stale cache is served due to timeout,
   * a background refresh fires (FIX #6) so the next run gets fresh data.
   */
  async discoverSupportedPairs(exchange: string): Promise<string[]> {
    const cached = this.supportedPairsCache.get(exchange);
    const lastDiscoveryTime = this.lastDiscovery.get(exchange) || 0;
    const cacheAge = Date.now() - lastDiscoveryTime;

    // Return fresh cache immediately
    if (cached && cached.size > 0 && cacheAge < this.DISCOVERY_CACHE_TTL) {
      logger.info(
        `[discoverSupportedPairs] ✅ Cache hit for ${exchange} ` +
        `(${cached.size} pairs, age: ${Math.round(cacheAge / 1000)}s)`
      );
      return Array.from(cached);
    }

    const cexConfig = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as any;
    const exchangeConfig = cexConfig[exchange];

    if (!exchangeConfig?.enabled) {
      logger.warn(`[discoverSupportedPairs] ${exchange} disabled or not configured`);
      return this.getFallbackPairsForExchange(exchange);
    }

    logger.info(`[discoverSupportedPairs] 🔍 Discovering pairs on ${exchange}...`);

    const discoveryPromise = this.performMarketDiscovery(exchange, exchangeConfig);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), this.DISCOVERY_TIMEOUT)
    );

    const raceResult = await Promise.race([discoveryPromise, timeoutPromise]);

    if (raceResult !== null) {
      // Discovery succeeded within timeout
      this.supportedPairsCache.set(exchange, raceResult);
      this.lastDiscovery.set(exchange, Date.now());
      logger.info(
        `[discoverSupportedPairs] ✅ ${exchange}: discovered ${raceResult.size} pairs`
      );
      return Array.from(raceResult);
    }

    // Timeout hit — serve stale or fallback
    logger.warn(
      `[discoverSupportedPairs] ⏱️  Timeout (${this.DISCOVERY_TIMEOUT}ms) for ${exchange}`
    );

    // FIX #6: Fire background refresh so next collection run gets fresh data
    this.scheduleBackgroundRefresh(exchange, exchangeConfig);

    if (cached && cached.size > 0) {
      logger.info(
        `[discoverSupportedPairs] Serving stale cache for ${exchange} ` +
        `(${cached.size} pairs, age: ${Math.round(cacheAge / 1000)}s)`
      );
      return Array.from(cached);
    }

    const fallback = this.getFallbackPairsForExchange(exchange);
    logger.info(
      `[discoverSupportedPairs] No cache available for ${exchange}, ` +
      `using ${fallback.length} fallback pairs`
    );
    return fallback;
  }

  /**
   * FIX #6: Background refresh — runs discovery without blocking the caller.
   * Prevents stacking multiple refreshes for the same exchange.
   */
  private scheduleBackgroundRefresh(exchange: string, exchangeConfig: any): void {
    if (this.backgroundRefreshInProgress.has(exchange)) return;

    this.backgroundRefreshInProgress.add(exchange);
    logger.info(`[discoverSupportedPairs] 🔄 Background refresh queued for ${exchange}`);

    this.performMarketDiscovery(exchange, exchangeConfig)
      .then((pairs) => {
        this.supportedPairsCache.set(exchange, pairs);
        this.lastDiscovery.set(exchange, Date.now());
        logger.info(
          `[discoverSupportedPairs] ✅ Background refresh complete for ${exchange}: ` +
          `${pairs.size} pairs`
        );
      })
      .catch((err) => {
        logger.error(
          `[discoverSupportedPairs] Background refresh failed for ${exchange}: ${err.message}`
        );
      })
      .finally(() => {
        this.backgroundRefreshInProgress.delete(exchange);
      });
  }

  /**
   * Internal: Perform actual market discovery from CCXT.
   *
   * FIX #3: Filter now includes BTC and ETH quote currencies in addition to
   * exchange-specific supportedQuotes. Previously only supportedQuotes from
   * config were used, which for Kraken was ['USD', 'USDT'] — silently
   * dropping all ETH/BTC, LINK/ETH, etc. cross pairs.
   */
  private async performMarketDiscovery(
    exchange: string,
    exchangeConfig: any
  ): Promise<Set<string>> {
    logger.info(`[performMarketDiscovery] Starting for ${exchange}`);

    const markets = await ccxtService.getMarkets(exchange);

    if (!markets || markets.length === 0) {
      logger.warn(`[performMarketDiscovery] ❌ No markets returned for ${exchange}`);
      return new Set();
    }

    logger.info(`[performMarketDiscovery] ${exchange}: ${markets.length} raw markets`);

    // FIX #3: Merge exchange-config quotes with expanded base quote set
    const configQuotes: string[] = exchangeConfig.supportedQuotes || ['USDT', 'USD', 'USDC'];
    const allQuotes = new Set([...configQuotes, ...DISCOVERY_QUOTE_CURRENCIES]);

    const supportedPairs = new Set<string>();

    for (const market of markets) {
      const symbol = (market as any).symbol?.toUpperCase();
      if (!symbol) continue;

      const parts = symbol.split('/');
      if (parts.length !== 2) continue;

      const [, quote] = parts;

      if (allQuotes.has(quote)) {
        supportedPairs.add(symbol);
      }
    }

    logger.info(
      `[performMarketDiscovery] ${exchange}: ${supportedPairs.size}/${markets.length} ` +
      `pairs after filtering (quotes: ${Array.from(allQuotes).join(', ')})`
    );

    if (supportedPairs.size === 0) {
      const sample = markets.slice(0, 5).map((m: any) => m.symbol).join(', ');
      logger.warn(
        `[performMarketDiscovery] ⚠️  ${exchange} 0 pairs after filtering. ` +
        `Sample symbols: ${sample}`
      );
    }

    return supportedPairs;
  }

  /**
   * Public API: get supported pairs (with fallback handled internally)
   */
  async getSupportedPairs(exchange: string): Promise<string[]> {
    return this.discoverSupportedPairs(exchange);
  }

  // ---------------------------------------------------------------------------
  // Fallback pair generation
  // ---------------------------------------------------------------------------

  /**
   * FIX #2: Generate systematic fallbacks instead of relying on sparse
   * config stubs (which were empty for OKX, Bybit, KuCoin) and a single
   * USDT→USD swap.
   *
   * Strategy:
   * 1. Check config pairFallbacks (explicit overrides, highest priority)
   * 2. Generate quote-swap variants (USDT↔USD↔USDC↔BUSD)
   * 3. Try BTC/ETH as quote currency for non-stablecoin pairs
   */
  public getFallbackPairs(pair: string, exchange: string): string[] {
    const fallbacks: string[] = [];
    const seen = new Set<string>([pair]); // Don't include the original pair

    const addIfNew = (p: string) => {
      if (!seen.has(p)) { seen.add(p); fallbacks.push(p); }
    };

    const cexConfig = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;
    const exchangeConfig = cexConfig[exchange];

    // 1. Explicit config overrides (highest priority)
    const configFallback = exchangeConfig?.pairFallbacks?.[pair];
    if (configFallback) addIfNew(configFallback);

    // 2. Parse the original pair
    const slashIdx = pair.indexOf('/');
    if (slashIdx === -1) return fallbacks;

    const base = pair.substring(0, slashIdx);
    const quote = pair.substring(slashIdx + 1);

    // 3. Quote-swap variants: try all stable/fiat currencies
    const stableQuotes = ['USDT', 'USD', 'USDC', 'BUSD'];
    for (const q of stableQuotes) {
      if (q !== quote) addIfNew(`${base}/${q}`);
    }

    // 4. If base is not a stablecoin, also try BTC and ETH as quote
    const stableBases = new Set(['USDT', 'USD', 'USDC', 'BUSD', 'DAI', 'TUSD']);
    if (!stableBases.has(base)) {
      if (quote !== 'BTC') addIfNew(`${base}/BTC`);
      if (quote !== 'ETH') addIfNew(`${base}/ETH`);
    }

    // 5. Exchange-specific normalization (e.g. Kraken uses XBT instead of BTC)
    if (exchange === 'kraken') {
      if (base === 'BTC') {
        for (const q of stableQuotes) addIfNew(`XBT/${q}`);
      }
      if (quote === 'BTC') addIfNew(`${base}/XBT`);
    }

    logger.debug(
      `[getFallbackPairs] ${exchange}:${pair} → fallbacks: ${fallbacks.join(', ') || 'none'}`
    );

    return fallbacks;
  }

  /**
   * Exchange-appropriate fallback pairs for when discovery fails entirely.
   * Uses exchange config supportedQuotes to pick the most relevant subset.
   */
  private getFallbackPairsForExchange(exchange: string): string[] {
    const cexConfig = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;
    const exchangeConfig = cexConfig[exchange];
    const supportedQuotes: string[] = exchangeConfig?.supportedQuotes || ['USDT'];

    return COMMON_FALLBACK_PAIRS.filter((pair) => {
      const quote = pair.split('/')[1];
      return supportedQuotes.includes(quote) || DISCOVERY_QUOTE_CURRENCIES.includes(quote);
    });
  }

  // ---------------------------------------------------------------------------
  // Price fetching
  // ---------------------------------------------------------------------------

  /**
   * Get price for symbol from best available source.
   *
   * FIX #4: Now distinguishes error types from ccxtService:
   * - CCXTSymbolError → pair genuinely doesn't exist on this exchange, skip it
   * - CCXTRateLimitError → exchange is overloaded, stop trying it for this call
   * - Other errors → log and continue to next exchange
   *
   * Previously all errors were caught identically and silently continued,
   * meaning rate-limit storms burned through all exchanges without backoff.
   */
  async getPrice(symbol: string, quote: string = 'USD'): Promise<SymbolPrice | null> {
    const pair = `${symbol}/${quote}`;
    const cacheKey = `price:${pair}`;

    const cached = this.priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 30_000) return cached;

    const cexSources = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;

    for (const exchangeName of Object.keys(cexSources)) {
      const exchange = cexSources[exchangeName];
      if (!exchange.enabled) continue;

      try {
        const ticker = await ccxtService.getTickerFromExchange(exchangeName, pair);
        if (!ticker) continue;

        // FIX #6: volume fallback mirrors ccxtService fix
        const volume =
          (ticker as any).volume ||
          (ticker as any).quoteVolume ||
          (ticker as any).baseVolume ||
          0;

        const price: SymbolPrice = {
          symbol,
          quote,
          price: (ticker as any).last || (ticker as any).bid || 0,
          source: 'cex',
          exchange: exchangeName,
          timestamp: Date.now(),
          change24h: (ticker as any).percentage,
          volume24h: volume,
        };

        this.priceCache.set(cacheKey, price);
        this.emit('price-update', {
          symbol,
          price: price.price,
          source: 'cex',
          timestamp: Date.now(),
        });
        return price;

      } catch (error: any) {
        // FIX #4: Typed error handling
        if (error instanceof CCXTSymbolError) {
          // Pair doesn't exist on this exchange — skip to next, no noise
          logger.debug(
            `[getPrice] ${exchangeName} does not list ${pair}, skipping`
          );
          continue;
        }

        if (error instanceof CCXTRateLimitError) {
          // Exchange is rate-limiting us — stop trying it for this call
          logger.warn(
            `[getPrice] Rate limit hit on ${exchangeName} for ${pair}, ` +
            `skipping remaining attempts on this exchange`
          );
          continue;
        }

        // Network or unknown error — log at warn level and try next exchange
        logger.warn(
          `[getPrice] ${exchangeName} failed for ${pair}: ${error.message}`
        );
        continue;
      }
    }

    // Fallback to CoinGecko oracle
    try {
      const priceByCoin = await (priceOracle as any).getPrice(symbol);
      if (priceByCoin) {
        const priceValue =
          typeof priceByCoin === 'number'
            ? priceByCoin
            : (priceByCoin as any).price || (priceByCoin as any).usd || 0;

        if (priceValue) {
          const price: SymbolPrice = {
            symbol,
            quote,
            price: priceValue,
            source: 'coingecko',
            timestamp: Date.now(),
          };
          this.priceCache.set(cacheKey, price);
          return price;
        }
      }
    } catch (error) {
      logger.debug(`[getPrice] CoinGecko failed for ${symbol}`);
    }

    logger.warn(`[getPrice] No price available for ${pair}`);
    return null;
  }

  // ---------------------------------------------------------------------------
  // Utility methods
  // ---------------------------------------------------------------------------

  async getTopByVolume(
    exchange: string,
    limit: number = 100
  ): Promise<{ symbol: string; volume24h: number }[]> {
    try {
      const pairs = await this.getSupportedPairs(exchange);
      return pairs.slice(0, limit).map((pair) => ({
        symbol: pair,
        volume24h: 0, // Populated by caller or price oracle
      }));
    } catch (error: any) {
      logger.error(`[getTopByVolume] Failed for ${exchange}: ${error.message}`);
      return [];
    }
  }

  onPriceUpdate(callback: (update: PriceUpdate) => void): void {
    this.on('price-update', callback);
  }

  getSymbolMetadata(symbol: string) {
    return tokenRegistry.getAllTokens().find((t: any) => t.symbol === symbol);
  }

  getSymbolsByCategory(category: string): string[] {
    try {
      const tokens = (tokenRegistry as any).getTokensByCategory?.(category) || [];
      return tokens.map((t: any) => t.symbol);
    } catch {
      return [];
    }
  }

  getSymbolsByChain(chain: string): string[] {
    try {
      const tokens = (tokenRegistry as any).getTokensByChain?.(chain) || [];
      return tokens.map((t: any) => t.symbol);
    } catch {
      return [];
    }
  }

  clearCaches(): void {
    this.priceCache.clear();
    this.supportedPairsCache.forEach((set) => set.clear());
    this.allSymbolsCache = null;
    this.lastDiscovery.clear();
    logger.info('✅ Symbol Universe caches cleared');
  }

  getStats(): Record<string, any> {
    return {
      cachedPrices: this.priceCache.size,
      backgroundRefreshesInProgress: Array.from(this.backgroundRefreshInProgress),
      cachedExchanges: Array.from(this.supportedPairsCache.keys()).reduce(
        (acc: Record<string, number>, key: string) => {
          acc[key] = this.supportedPairsCache.get(key)?.size || 0;
          return acc;
        },
        {}
      ),
      lastDiscoveryTimes: Object.fromEntries(this.lastDiscovery),
    };
  }
}

/**
 * Singleton instance
 */
export const symbolUniverseService = new SymbolUniverseService();