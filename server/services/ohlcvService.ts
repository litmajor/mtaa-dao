/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OHLCV SERVICE - MERGED v2.2 (Production Hardened + Universal)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Merged from:
 *   • v2.1 (Foundation Layer) — DEX/CEX routing, Celo native support, registry
 *   • v2.0 (Production Hardened) — circuit breaker, health scoring, stale cache
 *
 * This is the single source of truth. Both legacy v1 and production v2
 * consumers are satisfied by this unified implementation.
 *
 * Architecture:
 *   OHLCV Service (this file)
 *     ├── Symbol Universe  (asset-context + metadata)
 *     ├── AssetStateEngine (market-state + intelligence)
 *     ├── Indicators       (technical analysis)
 *     ├── NURU             (portfolio analysis)
 *     └── KWETU            (execution risk)
 *
 * Data paths:
 *   CEX symbols  → CCXT with multi-exchange fallback + health scoring
 *   Celo-native  → DexScreener (cUSD, cEUR, cKES, cREAL, eXOF, CELO DEX pairs)
 *   DEX symbols  → DexScreener (any chain/DEX via dexscreenerClient)
 *
 * Production features:
 *   Multi-exchange fallback routing (primary → secondary → tertiary)
 *   Exchange health scoring & circuit breaker
 *   Parallel fetching for <300ms context enrichment
 *   Graceful degradation (stale cache > nothing)
 *   DEX/CEX auto-routing via isCeloNativeSymbol()
 *   volume_quote USD normalisation for cross pairs
 *   getVolatility uses sample variance (/ n-1)
 *   Reliable cache invalidation (prefix scan + explicit keys)
 *
 * Version: 2.2 (Merged)
 */

import { ccxtService } from './ccxtService';
import { cacheService } from './cacheService';
import { dexscreenerClient, type DexPair } from './dexscreenerClient';
import { priceOracle } from './priceOracle';
import { logger } from '../utils/logger';
import { publishSignal } from './signalsStreamer';
import { marketDataClient } from './marketDataClient';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Symbols whose primary liquidity lives on Celo DEXes, not CEXes.
 * CELO itself trades on both — routes to CEX by default unless the
 * caller requests a Celo DEX pair (e.g. 'CELO/cUSD').
 */
const CELO_NATIVE_STABLECOINS = new Set([
  'CUSD', 'CEUR', 'CKES', 'CREAL', 'EXOF',
]);

/**
 * CEX fallback chain — tried in order until one returns data.
 * Health scoring reorders this dynamically; this is the base priority.
 */
const CEX_FALLBACK_CHAIN = ['binance', 'kraken', 'coinbase', 'kucoin'] as const;

/** Timeframes accepted everywhere in this service. */
const VALID_TIMEFRAMES = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);

/** USDT-stable quote currencies that don't need conversion. */
const USD_QUOTES = new Set(['USD', 'USDT', 'USDC', 'BUSD', 'DAI', 'CUSD']);

// Cache TTLs
const CACHE_TTL = 60_000;       // 1 min — live data
const LONG_CACHE_TTL = 300_000; // 5 min — historical
const STALE_CACHE_TTL = 3_600_000; // 1 hour — stale fallback

// Circuit breaker config
const CIRCUIT_BREAKER_THRESHOLD = 3;  // consecutive failures
const CIRCUIT_BREAKER_DURATION = 5 * 60_000; // 5 minutes
const FETCH_TIMEOUT = 5_000; // 5 seconds per exchange attempt

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OHLCVCandle {
  timestamp: number;       // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;          // Base asset volume
  volume_quote: number;    // Quote volume in USD (normalised)
  trades?: number;
}

export interface OHLCVResponse {
  status: 'success' | 'error' | 'degraded';
  symbol: string;
  pair: string;
  chain?: string;
  timeframe: string;
  exchange?: string;
  total_candles: number;
  from: number;
  to: number;
  data: OHLCVCandle[];
  cached?: boolean;
  dataSource?: 'ccxt' | 'dexscreener' | 'database' | 'cache' | 'stale-cache';
  fetchedAt?: number;
  pairAddress?: string | null;
  error?: string;
  quality?: 'fresh' | 'cached' | 'stale' | 'degraded';
  exchangeUsed?: string;
  fallbackReason?: string;
}

export interface ExchangeHealth {
  exchange: string;
  lastSuccess: number;
  lastFailure?: number;
  consecutiveFailures: number;
  healthScore: number; // 0-100
  circuitBreakerOpen: boolean;
  lastChecked: number;
}

export interface AssetContext {
  symbol: string;
  name: string;
  category: string;
  priceData: {
    current?: number;
    high24h?: number;
    low24h?: number;
    volatility24h?: number;
  };
  technicalProfile: {
    trend?: 'uptrend' | 'downtrend' | 'sideways';
    volatilityRegime?: 'low' | 'normal' | 'high' | 'extreme';
    liquidityQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  };
  dataSources: {
    exchanges: string[];
    primaryExchange: string;
    candleAvailability: string[];
    lastUpdated: number;
  };
  enrichmentQuality?: 'fresh' | 'cached' | 'degraded';
}

export interface DataSourceRegistry {
  symbol: string;
  pairs: Array<{
    pair: string;
    exchange: string;
    quoteCurrency: string;
    minOrder?: number;
    hasOHLCV: boolean;
    lastVerified: number;
  }>;
}

/** Shape used by MarketUniverseBuilder to seed the registry at startup. */
export interface RegistrySeedEntry {
  symbol: string;
  exchange: string;
  chain?: string;
  pair?: string;
  quoteCurrency?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MERGED SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class OHLCVService {
  // ── Data registries ─────────────────────────────────────────────────────
  private dataSourceRegistry   = new Map<string, DataSourceRegistry>();
  private exchangeCapabilities = new Map<string, Set<string>>();
  private exchangeHealth       = new Map<string, ExchangeHealth>();
  private cachedKeys           = new Set<string>();

  // ── Exchange priority overrides (symbol-specific) ───────────────────────
  private exchangePriority: Record<string, string[]> = {
    'BTC/USDT': ['binance', 'kraken', 'coinbase', 'bybit'],
    'ETH/USDT': ['binance', 'kraken', 'coinbase', 'bybit'],
  };

  constructor() {
    this.initializeExchangeHealth();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIMARY: getCandles (merged from v1 + v2)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get OHLCV candles for any symbol on any supported venue.
   *
   * exchange = 'auto'    → service picks CEX or DEX based on symbol.
   * exchange = 'dex'     → forces the DEX path (any chain via DexScreener).
   * exchange = 'celo_dex'→ forces Celo DEX path (legacy compat).
   * exchange = 'binance' → uses that CEX directly with health-aware fallback.
   *
   * Production features:
   *   • Health-scored exchange routing (healthy exchanges tried first)
   *   • Circuit breaker skips failing exchanges
   *   • Stale cache fallback when all live sources fail
   *   • DEX auto-routing for Celo-native symbols
   */
  async getCandles(
    symbol: string,
    timeframe = '5m',
    limit = 100,
    exchange = 'auto',
  ): Promise<OHLCVResponse> {
    const resolved = this.resolveExchange(symbol, exchange);
    const chain    = resolved === 'dex' || resolved === 'celo_dex' ? 'dex' : 'cex';
    const cacheKey = this.getCacheKey(symbol, timeframe, limit, exchange);

    try {
      // 1. Fresh cache check
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug(`OHLCV fresh cache hit: ${symbol}/${timeframe}`);
        return { ...cached, cached: true, dataSource: 'cache', quality: 'cached' };
      }

      if (!VALID_TIMEFRAMES.has(timeframe)) {
        return this.errorResponse(symbol, timeframe, `Invalid timeframe: ${timeframe}. Supported: ${[...VALID_TIMEFRAMES].join(', ')}`);
      }

      // 2. Route to the correct data path
      let response: OHLCVResponse;

      if (resolved === 'dex' || resolved === 'celo_dex') {
        response = await this.getDexCandles(symbol, timeframe, limit);
      } else {
        response = await this.getCEXCandles(symbol, timeframe, limit, resolved);
      }

      // 3. Cache success
      if (response.status === 'success') {
        const ttl = this.selectCacheTTL(limit);
        await cacheService.set(cacheKey, response, ttl);
        this.cachedKeys.add(cacheKey);
        this.registerDataSource(symbol, response.exchange ?? resolved);

        // Emit lightweight price signal (best-effort)
        try {
          const last = response.data[response.data.length - 1];
          void publishSignal({
            id: `ohlcv-${symbol}-${Date.now()}`,
            type: 'price',
            severity: 'low',
            title: `OHLCV update: ${symbol}`,
            message: `New ${timeframe} candle from ${response.exchangeUsed || resolved}`,
            symbol,
            timestamp: Date.now(),
            metadata: {
              close: last?.close,
              open: last?.open,
              high: last?.high,
              low: last?.low,
              volume: last?.volume,
              exchange: response.exchangeUsed || resolved,
            },
          });
        } catch {
          // best-effort — don't affect main flow
        }

        return { ...response, quality: 'fresh' };
      }

      // 4. Live fetch failed — try stale cache
      const staleKey = `${cacheKey}:stale`;
      const stale = await cacheService.get(staleKey);
      if (stale) {
        logger.info(`Using stale cache for ${symbol}/${timeframe}`);
        return {
          ...stale,
          status: 'degraded',
          quality: 'stale',
          dataSource: 'stale-cache',
          fallbackReason: response.error || 'Live source failed',
        };
      }

      // 5. Nothing available — return the error response
      return response;
    } catch (error) {
      logger.error(`Unexpected error in getCandles for ${symbol}:`, error);

      // Last resort: stale cache
      const staleKey = `${cacheKey}:stale`;
      const stale = await cacheService.get(staleKey);
      if (stale) {
        return {
          ...stale,
          status: 'degraded',
          quality: 'stale',
          dataSource: 'stale-cache',
          fallbackReason: `Exception: ${(error as Error).message}`,
        };
      }

      return this.errorResponse(symbol, timeframe, (error as Error).message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V1 LEGACY: seedRegistry (full batch seed)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Seed the data-source registry from MarketUniverseBuilder output.
   *
   * Call this once on startup before Symbol Universe begins discovery.
   * Without seeding, the registry is empty at cold-start and only
   * builds up lazily as individual candle fetches succeed.
   */
  seedRegistry(entries: RegistrySeedEntry[]): void {
    for (const entry of entries) {
      const { symbol, exchange, pair, quoteCurrency } = entry;

      if (!this.dataSourceRegistry.has(symbol)) {
        this.dataSourceRegistry.set(symbol, { symbol, pairs: [] });
      }

      const registry = this.dataSourceRegistry.get(symbol)!;
      const alreadyKnown = registry.pairs.some(
        p => p.exchange === exchange && p.pair === (pair ?? symbol),
      );

      if (!alreadyKnown) {
        registry.pairs.push({
          pair:          pair ?? symbol,
          exchange,
          quoteCurrency: quoteCurrency ?? 'USD',
          hasOHLCV:      true,
          lastVerified:  Date.now(),
        });
      }

      // Update fast exchange-capability index
      if (!this.exchangeCapabilities.has(symbol)) {
        this.exchangeCapabilities.set(symbol, new Set());
      }
      this.exchangeCapabilities.get(symbol)!.add(exchange);

      // Also seed exchange health if not already known
      if (!this.exchangeHealth.has(exchange)) {
        this.exchangeHealth.set(exchange, {
          exchange,
          lastSuccess: Date.now(),
          consecutiveFailures: 0,
          healthScore: 100,
          circuitBreakerOpen: false,
          lastChecked: Date.now(),
        });
      }
    }

    logger.info(`[OHLCV] Registry seeded with ${entries.length} entries (${this.dataSourceRegistry.size} unique symbols)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 PRODUCTION: seedDataSourceRegistry (per-symbol)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Seed the data source registry for a single symbol.
   * V2-style per-symbol seeding for services that don't have the full
   * MarketUniverseBuilder output available.
   */
  seedDataSourceRegistry(
    symbol: string,
    exchanges: string[],
    quoteCurrencies: string[] = ['USDT'],
  ): void {
    const pairs = exchanges.map(ex => ({
      pair: `${symbol}/${quoteCurrencies[0] || 'USDT'}`,
      exchange: ex,
      quoteCurrency: quoteCurrencies[0] || 'USDT',
      minOrder: undefined as number | undefined,
      hasOHLCV: true,
      lastVerified: Date.now(),
    }));

    this.dataSourceRegistry.set(symbol, { symbol, pairs });

    for (const ex of exchanges) {
      this.registerDataSource(symbol, ex);
      if (!this.exchangeHealth.has(ex)) {
        this.exchangeHealth.set(ex, {
          exchange: ex,
          lastSuccess: Date.now(),
          consecutiveFailures: 0,
          healthScore: 100,
          circuitBreakerOpen: false,
          lastChecked: Date.now(),
        });
      }
    }

    logger.debug(`[OHLCV] Seeded dataSourceRegistry for ${symbol} (${exchanges.length} exchanges)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 24h HIGH/LOW (merged)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 24-hour high and low derived from 5-minute candles.
   * Called by AssetStateEngine to populate marketState.price.
   */
  async get24hHighLow(
    symbol: string,
    exchange = 'auto',
  ): Promise<{ high24h: number; low24h: number; timestamp: number } | null> {
    const response = await this.getCandles(symbol, '5m', 288, exchange);
    if (response.status === 'error' || response.data.length === 0) return null;

    return {
      high24h:   Math.max(...response.data.map(c => c.high)),
      low24h:    Math.min(...response.data.map(c => c.low)),
      timestamp: Date.now(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VOLATILITY (merged — v1 signature with v2 sample variance)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Annualised volatility (std-dev of log returns) from historical candles.
   * Uses sample variance (n-1) for an unbiased estimator.
   *
   * Signature matches v1: accepts exchange param for routing.
   */
  async getVolatility(
    symbol:    string,
    timeframe  = '1h',
    periods    = 24,
    exchange   = 'auto',
  ): Promise<{ current: number; trend: 'increasing' | 'stable' | 'decreasing' } | null> {
    const response = await this.getCandles(symbol, timeframe, periods, exchange);
    if (response.status === 'error' || response.data.length < 2) return null;

    const closes  = response.data.map(c => c.close);
    const returns = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
    const n       = returns.length;
    const mean    = returns.reduce((a, b) => a + b, 0) / n;

    // Sample variance (/ n-1) — unbiased estimator
    const variance   = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    const volatility = Math.sqrt(variance) * 100;

    // Compare first-half vs second-half variance to detect trend
    const mid       = Math.floor(n / 2);
    const variance1 = returns.slice(0, mid).reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(mid - 1, 1);
    const variance2 = returns.slice(mid).reduce((a, b)  => a + (b - mean) ** 2, 0) / Math.max(n - mid - 1, 1);
    const trend = variance2 > variance1 * 1.1
      ? 'increasing'
      : variance2 < variance1 * 0.9
        ? 'decreasing'
        : 'stable';

    return { current: volatility, trend };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME METRICS (v1 only — preserved)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 24-hour volume metrics.
   * volume_quote is always USD-normalised.
   */
  async getVolumeMetrics(
    symbol:    string,
    timeframe  = '1h',
    periods    = 24,
    exchange   = 'auto',
  ): Promise<{ volume24h: number; avgVolume: number; trend: string } | null> {
    const response = await this.getCandles(symbol, timeframe, periods, exchange);
    if (response.status === 'error' || response.data.length === 0) return null;

    const volumes   = response.data.map(c => c.volume_quote);
    const volume24h = volumes.reduce((a, b) => a + b, 0);
    const avgVolume = volume24h / volumes.length;
    const recent    = volumes.slice(-6).reduce((a, b) => a + b, 0) / 6;

    return { volume24h, avgVolume, trend: recent > avgVolume ? 'increasing' : 'decreasing' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENRICH ASSET CONTEXT (merged — v2 parallel + v1 inline high/low)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enrich asset context with <300ms target latency.
   *
   * Uses Promise.allSettled for parallel fetching.
   * Computes 24h high/low inline from already-fetched 5m candles
   * (no redundant cache lookup).
   */
  async enrichAssetContext(
    symbol:          string,
    primaryExchange  = 'auto',
  ): Promise<AssetContext | null> {
    const startTime = Date.now();

    try {
      // Parallel fetch — all at once
      const [candles5mResult, candles1hResult] = await Promise.allSettled([
        this.getCandles(symbol, '5m', 288, primaryExchange),
        this.getCandles(symbol, '1h', 168, primaryExchange),
      ]);

      const candles5m = candles5mResult.status === 'fulfilled' ? candles5mResult.value : null;
      const candles1h = candles1hResult.status === 'fulfilled' ? candles1hResult.value : null;

      if (!candles5m || candles5m.status === 'error' || !candles1h || candles1h.status === 'error') {
        logger.warn(`Insufficient data to enrich ${symbol}`);
        return null;
      }

      // Inline 24h high/low — no second fetch needed
      const high24h = Math.max(...candles5m.data.map(c => c.high));
      const low24h  = Math.min(...candles5m.data.map(c => c.low));

      // Volatility from 1h candles (parallel with high/low calc)
      const volatility = await this.getVolatility(symbol, '1h', 24, primaryExchange);

      // Determine quality
      let enrichmentQuality: 'fresh' | 'cached' | 'degraded' = 'fresh';
      if (candles5m.quality === 'stale' || candles1h.quality === 'stale') {
        enrichmentQuality = 'degraded';
      } else if (candles5m.quality === 'cached' && candles1h.quality === 'cached') {
        enrichmentQuality = 'cached';
      }

      const resolvedExchange = candles5m.exchange ?? primaryExchange;
      const knownExchanges   = Array.from(
        this.dataSourceRegistry.get(symbol)?.pairs.map(p => p.exchange) ?? [resolvedExchange],
      );

      const elapsed = Date.now() - startTime;
      if (elapsed > 300) {
        logger.warn(`Context enrichment took ${elapsed}ms (target: <300ms)`);
      } else {
        logger.debug(`Context enrichment completed in ${elapsed}ms`);
      }

      return {
        symbol,
        name:     symbol,
        category: 'unknown',
        priceData: {
          current:       candles5m.data.at(-1)?.close ?? 0,
          high24h,
          low24h,
          volatility24h: volatility?.current,
        },
        technicalProfile: {
          trend:            this.detectTrend(candles1h.data),
          volatilityRegime: this.classifyVolatilityRegime(volatility?.current ?? 0),
          liquidityQuality: this.assessLiquidityQuality(candles5m.data),
        },
        dataSources: {
          exchanges:          knownExchanges,
          primaryExchange:    resolvedExchange,
          candleAvailability: [...VALID_TIMEFRAMES],
          lastUpdated:        Date.now(),
        },
        enrichmentQuality,
      };
    } catch (error) {
      logger.error(`Failed to enrich asset context for ${symbol}:`, error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRICE CLASSIFICATION HINTS (merged — v2 market cap + v1 price oracle)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Price-based classification hints for Symbol Universe.
   * Integrates PriceOracle for real market cap when available;
   * falls back to volume heuristic.
   */
  async getPriceClassificationHints(
    symbol: string,
    exchange = 'auto',
  ): Promise<{
    avgPriceUSD: number;
    volatilityScore: number;
    marketCapEstimate?: number;
    marketCapCategory: 'mega' | 'large' | 'mid' | 'small' | 'micro';
    liquidityCategory: 'excellent' | 'good' | 'fair' | 'poor';
    classificationConfidence: 'high' | 'medium' | 'low';
  } | null> {
    try {
      const candles = await this.getCandles(symbol, '1h', 24, exchange);
      if (candles.status === 'error' || candles.data.length === 0) return null;

      const closes    = candles.data.map(c => c.close);
      const avgPrice  = closes.reduce((a, b) => a + b, 0) / closes.length;
      const vol       = await this.getVolatility(symbol, '1h', 24, exchange);

      // Try PriceOracle first
      let marketCapEstimate = 0;
      let confidence: 'high' | 'medium' | 'low' = 'medium';

      try {
        const prices = await priceOracle.getPrices([symbol]);
        const pd     = prices.get(symbol.toUpperCase()) ?? prices.get(symbol);
        if (pd?.marketCap && pd.marketCap > 0) {
          marketCapEstimate = pd.marketCap;
          confidence = 'high';
        }
      } catch { /* ignore — will use heuristic */ }

      // Fallback heuristic
      if (!marketCapEstimate) {
        const avgVol = candles.data.reduce((s, c) => s + c.volume_quote, 0) / candles.data.length;
        marketCapEstimate = avgVol * 50;
        confidence = 'low';
      }

      return {
        avgPriceUSD:       avgPrice,
        volatilityScore:   vol?.current ?? 0,
        marketCapEstimate,
        marketCapCategory: this.categorizeMarketCap(marketCapEstimate),
        liquidityCategory: this.categorizeLiquidity(candles.data),
        classificationConfidence: confidence,
      };
    } catch (error) {
      logger.error(`Failed to get classification hints for ${symbol}:`, error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRY QUERIES (v1 preserved)
  // ═══════════════════════════════════════════════════════════════════════════

  getAvailableTimeframes(): string[] {
    return [...VALID_TIMEFRAMES];
  }

  getDataSourceRegistry(symbol: string): DataSourceRegistry | undefined {
    return this.dataSourceRegistry.get(symbol);
  }

  /**
   * @deprecated Use seedRegistry() + MarketUniverseBuilder instead.
   */
  async discoverAvailablePairs(symbol: string): Promise<DataSourceRegistry> {
    logger.warn('[OHLCV] discoverAvailablePairs() is deprecated — use seedRegistry()');
    return this.dataSourceRegistry.get(symbol) ?? { symbol, pairs: [] };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXCHANGE HEALTH (v2 production feature)
  // ═══════════════════════════════════════════════════════════════════════════

  getExchangeHealthStatus(): ExchangeHealth[] {
    return Array.from(this.exchangeHealth.values());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE MANAGEMENT (merged — v1 prefix scan + v2 explicit keys)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Clear all cached candles for a symbol.
   * Uses explicit key deletion (reliable) + pattern deletion (if supported).
   */
  async clearCache(symbol: string): Promise<void> {
    // Method 1: Explicit key deletion (always works)
    const timeframes = [...VALID_TIMEFRAMES];
    const limits = [50, 100, 168, 200, 288, 500];
    const exchanges = [...CEX_FALLBACK_CHAIN, 'dex', 'celo_dex', 'auto'];

    for (const tf of timeframes) {
      for (const limit of limits) {
        for (const ex of exchanges) {
          const key = this.getCacheKey(symbol, tf, limit, ex);
          await cacheService.delete(key).catch(() => {});
          this.cachedKeys.delete(key);
        }
      }
    }

    // Method 2: Pattern deletion (if cacheService supports it)
    try {
      if (typeof (cacheService as any).deleteByPrefix === 'function') {
        await (cacheService as any).deleteByPrefix(`ohlcv:cex:${symbol}:`);
        await (cacheService as any).deleteByPrefix(`ohlcv:dex:${symbol}:`);
      } else if (typeof (cacheService as any).keys === 'function') {
        const keys: string[] = await (cacheService as any).keys(`ohlcv:*:${symbol}:*`);
        await Promise.all(keys.map((k: string) => cacheService.delete(k)));
      }
    } catch {
      // Pattern deletion not supported — explicit deletion above already handled it
    }

    logger.info(`[OHLCV] Cache cleared for ${symbol}`);
  }

  /**
   * V2 alias for clearCache — same implementation.
   */
  async clearCacheForSymbol(symbol: string): Promise<void> {
    return this.clearCache(symbol);
  }

  /**
   * Save current data to stale cache before expiry.
   * Improves graceful degradation when exchanges are down.
   */
  async ensureStaleCacheBackup(symbol: string, timeframe: string): Promise<void> {
    try {
      const pattern = `ohlcv:*:${symbol}:${timeframe}:*`;
      let keys: string[] = [];

      if (typeof (cacheService as any).keys === 'function') {
        keys = await (cacheService as any).keys(pattern);
      } else {
        // Enumerate common keys
        const limits = [100, 200, 288, 500];
        const exchanges = [...CEX_FALLBACK_CHAIN, 'dex', 'auto'];
        keys = limits.flatMap(lim => exchanges.map(ex => this.getCacheKey(symbol, timeframe, lim, ex)));
      }

      for (const key of keys) {
        try {
          const data = await cacheService.get(key);
          if (!data) continue;
          const staleKey = `${key}:stale`;
          await cacheService.set(staleKey, data, STALE_CACHE_TTL);
        } catch {
          // best-effort
        }
      }

      logger.debug(`Backed up stale cache for ${symbol}/${timeframe} (keys: ${keys.length})`);
    } catch (error) {
      logger.debug(`Stale cache backup failed for ${symbol}:`, error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: EXCHANGE / VENUE ROUTING (merged v1 + v2)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve the 'auto' sentinel to a concrete exchange id.
   *
   * Decision tree:
   *   1. Caller specified 'dex' or 'celo_dex' → dex path.
   *   2. Caller specified a concrete CEX → honour it.
   *   3. Symbol is Celo-native → dex.
   *   4. Symbol contains '/cUSD', '/cEUR', '/cKES' → dex.
   *   5. Everything else → 'binance' (head of CEX fallback chain).
   */
  private resolveExchange(symbol: string, requested: string): string {
    if (requested === 'dex' || requested === 'celo_dex') return 'dex';
    if (requested !== 'auto') return requested;
    if (this.isCeloNativeSymbol(symbol)) return 'dex';
    return 'binance';
  }

  private isCeloNativeSymbol(symbol: string): boolean {
    const upper = symbol.toUpperCase();
    if (CELO_NATIVE_STABLECOINS.has(upper)) return true;
    const [base, quote] = upper.split('/');
    if (quote && CELO_NATIVE_STABLECOINS.has(quote)) return true;
    if (base  && CELO_NATIVE_STABLECOINS.has(base))  return true;
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: CEX DATA PATH (merged v1 transform + v2 health routing)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch OHLCV from CEX with health-scored fallback chain.
   *
   * Tries exchanges in health-score order. Skips circuit-broken exchanges.
   * On success, records which exchange served data.
   */
  private async getCEXCandles(
    symbol:    string,
    timeframe: string,
    limit:     number,
    exchange:  string,
  ): Promise<OHLCVResponse> {
    // Build candidate list
    let candidates: string[];
    if (exchange === 'binance') {
      // 'auto' resolved to binance → try full fallback chain
      candidates = [...CEX_FALLBACK_CHAIN];
    } else if (this.exchangePriority[symbol]) {
      // Symbol-specific override
      candidates = [...this.exchangePriority[symbol]];
    } else {
      // Caller pinned a specific exchange → respect it, but add fallbacks
      candidates = [exchange, ...CEX_FALLBACK_CHAIN.filter(e => e !== exchange)];
    }

    // Sort by health score (healthy first), filter out circuit-broken
    candidates = candidates
      .filter(ex => {
        const health = this.exchangeHealth.get(ex);
        return !health?.circuitBreakerOpen;
      })
      .sort((a, b) => {
        const scoreA = this.exchangeHealth.get(a)?.healthScore ?? 50;
        const scoreB = this.exchangeHealth.get(b)?.healthScore ?? 50;
        return scoreB - scoreA; // descending
      });

    let lastError = '';

    for (const ex of candidates) {
      try {
        logger.info(`[OHLCV] Fetching ${symbol}/${timeframe} from ${ex}`);
        const candles = await this.fetchWithTimeout(symbol, timeframe, limit, ex);

        if (!candles?.length) {
          lastError = `${ex} returned empty dataset`;
          this.recordExchangeFailure(ex);
          continue;
        }

        const data = await this.transformCCXTCandles(candles, symbol, ex);
        this.recordExchangeSuccess(ex);
        this.registerDataSource(symbol, ex);

        return {
          status:        'success',
          symbol,
          pair:          symbol,
          chain:         'cex',
          timeframe,
          exchange:      ex,
          total_candles: data.length,
          from:          data[0]?.timestamp ?? 0,
          to:            data.at(-1)?.timestamp ?? 0,
          data,
          dataSource:    'ccxt',
          fetchedAt:     Date.now(),
          exchangeUsed:  ex,
        };
      } catch (err) {
        lastError = (err as Error).message;
        this.recordExchangeFailure(ex);
        logger.warn(`[OHLCV] ${ex} failed for ${symbol}: ${lastError}`);
      }
    }

    return this.errorResponse(
      symbol,
      timeframe,
      `No CEX has data for ${symbol}. Last error: ${lastError}`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: DEX DATA PATH (v1 preserved)
  // ═══════════════════════════════════════════════════════════════════════════

  private async getDexCandles(
    symbol:    string,
    timeframe: string,
    limit:     number,
  ): Promise<OHLCVResponse> {
    try {
      logger.info(`[OHLCV] Fetching DEX data for ${symbol} via market data plane`);
      const response = await marketDataClient.getCandles(symbol, timeframe, limit, 'dex');

      if (response.status === 'error' || !response.data || response.data.length === 0) {
        return this.errorResponse(
          symbol,
          timeframe,
          response.error || `No market data OHLCV data for ${symbol}`,
        );
      }

      return {
        ...response,
        dataSource: response.dataSource || 'market-data-plane',
        fetchedAt:  Date.now(),
        chain:      'dex',
      };
    } catch (error) {
      logger.error(`[OHLCV] Market data plane fetch failed for ${symbol}:`, error);
      return this.errorResponse(
        symbol,
        timeframe,
        `Market data plane fetch failed: ${(error as Error).message}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: CCXT TRANSFORM (v1 with volume_quote normalization)
  // ═══════════════════════════════════════════════════════════════════════════

  private async transformCCXTCandles(
    ccxtCandles: any[][],
    symbol:      string,
    exchange:    string,
  ): Promise<OHLCVCandle[]> {
    const [, quote] = symbol.includes('/') ? symbol.split('/') : [symbol, 'USD'];
    const isUsdQuote = USD_QUOTES.has((quote ?? '').toUpperCase());

    let quoteToUsd = 1;
    if (!isUsdQuote && quote) {
      try {
        const prices = await priceOracle.getPrices([quote]);
        const pd     = prices.get(quote.toUpperCase());
        if (pd?.priceUsd && pd.priceUsd > 0) quoteToUsd = pd.priceUsd;
      } catch {
        logger.warn(`[OHLCV] Could not fetch ${quote}/USD rate; volume_quote may be inaccurate`);
      }
    }

    return ccxtCandles.map(c => {
      const baseVolume  = c[5] ?? 0;
      const closePrice  = c[4] ?? 0;
      const rawQuoteVol = c[6] != null ? c[6] : baseVolume * closePrice;
      const volumeQuote = rawQuoteVol * quoteToUsd;

      return {
        timestamp:    Math.floor(c[0] / 1000),
        open:         c[1] ?? 0,
        high:         c[2] ?? 0,
        low:          c[3] ?? 0,
        close:        closePrice,
        volume:       baseVolume,
        volume_quote: volumeQuote,
        trades:       c[7] ?? undefined,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: CIRCUIT BREAKER & HEALTH SCORING (v2 production)
  // ═══════════════════════════════════════════════════════════════════════════

  private initializeExchangeHealth(): void {
    for (const exchange of CEX_FALLBACK_CHAIN) {
      this.exchangeHealth.set(exchange, {
        exchange,
        lastSuccess: Date.now(),
        consecutiveFailures: 0,
        healthScore: 100,
        circuitBreakerOpen: false,
        lastChecked: Date.now(),
      });
    }
  }

  private recordExchangeSuccess(exchange: string): void {
    const health = this.exchangeHealth.get(exchange);
    if (!health) return;

    health.lastSuccess = Date.now();
    health.consecutiveFailures = 0;
    health.healthScore = Math.min(100, health.healthScore + 10);
    health.circuitBreakerOpen = false;
    health.lastChecked = Date.now();

    logger.debug(`Exchange ${exchange} health restored to ${health.healthScore}`);
  }

  private recordExchangeFailure(exchange: string): void {
    const health = this.exchangeHealth.get(exchange);
    if (!health) return;

    health.lastFailure = Date.now();
    health.consecutiveFailures++;
    health.healthScore = Math.max(0, health.healthScore - 25);
    health.lastChecked = Date.now();

    if (health.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      health.circuitBreakerOpen = true;
      setTimeout(() => {
        health.circuitBreakerOpen = false;
        health.consecutiveFailures = 0;
        logger.info(`Circuit breaker reset for ${exchange}`);
      }, CIRCUIT_BREAKER_DURATION);

      logger.error(`Circuit breaker OPEN for ${exchange} (score: ${health.healthScore})`);
    }

    logger.warn(`Exchange ${exchange} health degraded to ${health.healthScore} (failures: ${health.consecutiveFailures})`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: FETCH WITH TIMEOUT (v2)
  // ═══════════════════════════════════════════════════════════════════════════

  private async fetchWithTimeout(
    symbol: string,
    timeframe: string,
    limit: number,
    exchange: string,
    timeout = FETCH_TIMEOUT,
  ): Promise<any[][]> {
    const result = await Promise.race<any[] | any[][] | null>([
      ccxtService.getOHLCVFromExchange(exchange, symbol, timeframe, limit),
      new Promise<any[][]>((_, reject) =>
        setTimeout(() => reject(new Error(`CCXT timeout for ${exchange} after ${timeout}ms`)), timeout),
      ),
    ]);
    return (result ?? []) as any[][];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: REGISTRY
  // ═══════════════════════════════════════════════════════════════════════════

  private registerDataSource(symbol: string, exchange: string): void {
    if (!this.dataSourceRegistry.has(symbol)) {
      this.dataSourceRegistry.set(symbol, { symbol, pairs: [] });
    }
    const reg = this.dataSourceRegistry.get(symbol)!;
    if (!reg.pairs.some(p => p.exchange === exchange)) {
      reg.pairs.push({
        pair:          symbol,
        exchange,
        quoteCurrency: 'USD',
        hasOHLCV:      true,
        lastVerified:  Date.now(),
      });
    }

    if (!this.exchangeCapabilities.has(symbol)) {
      this.exchangeCapabilities.set(symbol, new Set());
    }
    this.exchangeCapabilities.get(symbol)!.add(exchange);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: ANALYSIS HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private detectTrend(candles: OHLCVCandle[]): 'uptrend' | 'downtrend' | 'sideways' {
    if (candles.length < 2) return 'sideways';
    const change = (candles.at(-1)!.close - candles[0].close) / candles[0].close;
    return change > 0.02 ? 'uptrend' : change < -0.02 ? 'downtrend' : 'sideways';
  }

  private classifyVolatilityRegime(v: number): 'low' | 'normal' | 'high' | 'extreme' {
    if (v < 1) return 'low';
    if (v < 3) return 'normal';
    if (v < 8) return 'high';
    return 'extreme';
  }

  private assessLiquidityQuality(candles: OHLCVCandle[]): 'excellent' | 'good' | 'fair' | 'poor' {
    if (!candles.length) return 'poor';
    const avgSpread = candles.reduce((s, c) => s + (c.close > 0 ? (c.high - c.low) / c.close : 0), 0) / candles.length;
    if (avgSpread < 0.001) return 'excellent';
    if (avgSpread < 0.003) return 'good';
    if (avgSpread < 0.010) return 'fair';
    return 'poor';
  }

  private categorizeLiquidity(candles: OHLCVCandle[]): 'excellent' | 'good' | 'fair' | 'poor' {
    if (!candles.length) return 'poor';
    const avg = candles.reduce((s, c) => s + c.volume_quote, 0) / candles.length;
    if (avg > 1_000_000) return 'excellent';
    if (avg > 100_000)   return 'good';
    if (avg > 10_000)    return 'fair';
    return 'poor';
  }

  private categorizeMarketCap(mc: number): 'mega' | 'large' | 'mid' | 'small' | 'micro' {
    if (mc > 500e9) return 'mega';
    if (mc > 50e9)  return 'large';
    if (mc > 5e9)   return 'mid';
    if (mc > 500e6) return 'small';
    return 'micro';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  private getCacheKey(symbol: string, timeframe: string, limit: number, exchange?: string): string {
    const resolved = this.resolveExchange(symbol, exchange || 'auto');
    const chain = resolved === 'dex' ? 'dex' : 'cex';
    return `ohlcv:${chain}:${symbol}:${timeframe}:${limit}:${exchange || 'auto'}`;
  }

  private selectCacheTTL(limit: number): number {
    return limit <= 100 ? CACHE_TTL : LONG_CACHE_TTL;
  }

  private errorResponse(symbol: string, timeframe: string, message: string): OHLCVResponse {
    return {
      status:        'error',
      symbol,
      pair:          symbol,
      timeframe,
      total_candles: 0,
      from:          0,
      to:            0,
      data:          [],
      dataSource:    'ccxt',
      error:         message,
      quality:       'degraded',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const ohlcvService = new OHLCVService();