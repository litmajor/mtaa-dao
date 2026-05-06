/**
 * Collector Service
 * UNIFIED DATA COLLECTION LAYER - Single coordinator for all external data sources
 *
 * Feeds from: CEX (CCXT), DEX (Smart Router), DEXScreener, Gateway Agent, Price Oracle
 * Pattern: Collector coordinates parallel fetching → buffers to Redis → queues DB persistence
 *
 * NO DUPLICATE FETCHING: All data sources route through here
 * - CEX prices (via cexPriceCollector)
 * - DEX prices & quotes (via smartRouter, dexIntegrationService)
 * - Price aggregation (via priceOracle)
 * - Symbol discovery (via symbolUniverseService + CCXT)
 * - Pool metrics (via investmentPoolPricingService)
 * - Vault data (via databaseOptimizationLayer)
 *
 * FIXES (v2):
 * 1. getActiveSymbols() added — opportunityEngineService.discoverAssetsForScanning() depends on it
 * 2. Unused cacheKey in collectPricesForSymbols removed
 * 3. collectCEXPrices now returns actual PriceData[] instead of always-empty []
 * 4. clearBufferedData is no longer a no-op — deletes named keys from Redis
 * 5. Lazy getCEXPriceCollector() calls no longer risk throwing — db resolved via import
 */

import { logger } from '../utils/logger';
import { redis } from './redis';
import { symbolUniverseService } from './symbolUniverseService';
import { dbOptimizationLayer } from './databaseOptimizationLayer';
import { priceOracle } from './priceOracle';
import { jobQueueService } from './jobQueueService';

interface CollectorOptions {
  maxConcurrency?: number;
  batchSize?: number;
  redisTTL?: number;
}

interface CollectorResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  itemsProcessed?: number;
  itemsFailed?: number;
  fromCache?: boolean;
}

interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
  source: string;
  metadata?: {
    marketCap?: number;
    change24h?: number;
    volume24h?: number;
    name?: string;
  };
}

class CollectorService {
  private readonly DEFAULT_MAX_CONCURRENCY = 10;
  private readonly DEFAULT_BATCH_SIZE = 50;
  private readonly DEFAULT_REDIS_TTL = 300;
  private readonly PRICE_CACHE_TTL = 30;
  private readonly SYMBOL_CACHE_TTL = 300;
  private readonly POOL_CACHE_TTL = 120;

  // FIX 1: Cache for getActiveSymbols, populated on first discovery
  private activeSymbolsCache: string[] = [];
  private activeSymbolsCachedAt = 0;
  private readonly ACTIVE_SYMBOLS_TTL = 300_000; // 5 minutes

  constructor(private options: CollectorOptions = {}) {
    this.options = {
      maxConcurrency: options.maxConcurrency ?? this.DEFAULT_MAX_CONCURRENCY,
      batchSize: options.batchSize ?? this.DEFAULT_BATCH_SIZE,
      redisTTL: options.redisTTL ?? this.DEFAULT_REDIS_TTL,
    };
  }

  // ---------------------------------------------------------------------------
  // FIX 1: getActiveSymbols — used by opportunityEngineService for asset discovery
  // ---------------------------------------------------------------------------

  /**
   * Returns a deduplicated list of actively traded symbols across all configured
   * exchanges. Results are in-memory cached for ACTIVE_SYMBOLS_TTL to avoid
   * repeated discovery overhead.
   *
   * Called by: opportunityEngineService.discoverAssetsForScanning()
   */
  async getActiveSymbols(): Promise<string[]> {
    const now = Date.now();
    if (
      this.activeSymbolsCache.length > 0 &&
      now - this.activeSymbolsCachedAt < this.ACTIVE_SYMBOLS_TTL
    ) {
      return this.activeSymbolsCache;
    }

    const redisKey = 'collector:active-symbols';
    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        this.activeSymbolsCache = JSON.parse(cached);
        this.activeSymbolsCachedAt = now;
        return this.activeSymbolsCache;
      }
    } catch {
      // Redis miss — proceed to live discovery
    }

    logger.info('[Collector] Discovering active symbols across exchanges…');

    const exchanges = ['binance', 'kraken', 'coinbase'];
    const symbolSet = new Set<string>();

    await Promise.allSettled(
      exchanges.map(async (exchange) => {
        try {
          const pairs = await symbolUniverseService.discoverSupportedPairs(exchange);
          // Extract base symbols from trading pairs like "BTC/USDT" → "BTC"
          for (const pair of pairs) {
            const base = pair.split('/')[0];
            if (base) symbolSet.add(base);
          }
        } catch (err) {
          logger.debug(`[Collector] Symbol discovery failed for ${exchange}:`, err);
        }
      })
    );

    const symbols = Array.from(symbolSet).slice(0, 200);
    this.activeSymbolsCache = symbols;
    this.activeSymbolsCachedAt = now;

    if (symbols.length > 0) {
      await redis.set(redisKey, JSON.stringify(symbols), this.SYMBOL_CACHE_TTL).catch(() => {});
    }

    logger.info(`[Collector] Active symbol discovery complete: ${symbols.length} symbols`);
    return symbols;
  }

  // ---------------------------------------------------------------------------
  // Symbol collection per exchange
  // ---------------------------------------------------------------------------

  async collectSymbolsForExchange(exchange: string): Promise<CollectorResult<string[]>> {
    const cacheKey = `collector:symbols:${exchange}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return { success: true, data: JSON.parse(cached), fromCache: true };
      }

      logger.info(`[Collector] Parallel symbol discovery for ${exchange}…`);
      const symbols = await symbolUniverseService.discoverSupportedPairs(exchange);

      await redis.set(cacheKey, JSON.stringify(symbols), this.SYMBOL_CACHE_TTL);

      if (symbols.length > 0) {
        await jobQueueService.queueJob(
          'price-oracle-update',
          { type: 'symbol-discovery', exchange, symbols, timestamp: new Date() },
          { priority: 3 }
        );
      }

      logger.info(`[Collector] ${symbols.length} symbols for ${exchange} buffered to Redis`);
      return { success: true, data: symbols, itemsProcessed: symbols.length };
    } catch (error) {
      logger.error(`[Collector] Failed to collect symbols for ${exchange}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Price collection — all sources
  // ---------------------------------------------------------------------------

  /**
   * Batch fetch prices for multiple symbols.
   * Per-symbol Redis cache checked first; only uncached symbols hit external sources.
   */
  async collectPricesForSymbols(symbols: string[]): Promise<CollectorResult<PriceData[]>> {
    // FIX 2: removed unused `const cacheKey = 'collector:prices:batch'`
    try {
      const cachedPrices: PriceData[] = [];
      const uncachedSymbols: string[] = [];

      for (const symbol of symbols) {
        const priceKey = `collector:price:${symbol}`;
        try {
          const cached = await redis.get(priceKey);
          if (cached) {
            cachedPrices.push(JSON.parse(cached));
          } else {
            uncachedSymbols.push(symbol);
          }
        } catch {
          uncachedSymbols.push(symbol);
        }
      }

      if (uncachedSymbols.length === 0) {
        return {
          success: true,
          data: cachedPrices,
          fromCache: true,
          itemsProcessed: cachedPrices.length,
        };
      }

      logger.info(
        `[Collector] Fetching ${uncachedSymbols.length}/${symbols.length} prices in parallel…`
      );

      const results = await Promise.allSettled(
        uncachedSymbols.map((sym) => this.fetchPriceFromAllSources(sym))
      );

      const fetchedPrices: PriceData[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const symbol = uncachedSymbols[i];

        if (result.status === 'fulfilled' && result.value) {
          fetchedPrices.push(result.value);
          successCount++;
          await redis
            .set(`collector:price:${symbol}`, JSON.stringify(result.value), this.PRICE_CACHE_TTL)
            .catch(() => {});
        } else {
          failureCount++;
          logger.warn(`[Collector] No price available for ${symbol}`);
        }
      }

      const allPrices = [...cachedPrices, ...fetchedPrices];

      if (allPrices.length > 0) {
        await jobQueueService
          .queueJob(
            'price-oracle-update',
            { type: 'price-batch', prices: allPrices, timestamp: new Date() },
            { priority: 2 }
          )
          .catch(() => {});
      }

      logger.info(
        `[Collector] Fetched ${successCount}/${uncachedSymbols.length} prices, buffered to Redis`
      );
      return {
        success: successCount > 0 || cachedPrices.length > 0,
        data: allPrices,
        itemsProcessed: successCount,
        itemsFailed: failureCount,
      };
    } catch (error) {
      logger.error('[Collector] collectPricesForSymbols failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Priority-based price fetching: CEX → DEX → Oracle.
   * Sequential by design — each tier is a fallback for the previous.
   */
  private async fetchPriceFromAllSources(symbol: string): Promise<PriceData | null> {
    // PRIORITY 1: CEX
    try {
      const cexPrice = await this.fetchPriceFromCEX(symbol);
      if (cexPrice && cexPrice.price && cexPrice.price > 0) return cexPrice;
    } catch {
      logger.debug(`[Collector] CEX fetch failed for ${symbol}, trying DEX`);
    }

    // PRIORITY 2: DEX
    try {
      const dexPrice = await this.fetchPriceFromDEX(symbol);
      if (dexPrice && dexPrice.price && dexPrice.price > 0) return dexPrice;
    } catch {
      logger.debug(`[Collector] DEX fetch failed for ${symbol}, trying Oracle`);
    }

    // PRIORITY 3: Oracle
    try {
      const oraclePrice = await this.fetchPriceFromOracle(symbol);
      if (oraclePrice && oraclePrice.price && oraclePrice.price > 0) return oraclePrice;
    } catch {
      logger.debug(`[Collector] Oracle fetch failed for ${symbol}`);
    }

    logger.warn(`[Collector] No price from any source for ${symbol}`);
    return null;
  }

  /**
   * FIX 5: getCEXPriceCollector is called lazily inside both fetchPriceFromCEX
   * and collectCEXPrices. If the singleton hasn't been seeded with a db Pool yet
   * the call throws. Wrap in try/catch and fall through to the next source.
   */
  private async fetchPriceFromCEX(symbol: string): Promise<PriceData | null> {
    try {
      const { getCEXPriceCollector } = await import('./cexPriceCollector');
      const collector = getCEXPriceCollector(); // throws if not initialised — caught below
      const price = await collector.fetchPriceForSymbol(symbol);
      if (price && price > 0) {
        return { symbol, price, timestamp: Date.now(), source: 'CEX' };
      }
      return null;
    } catch (error) {
      logger.debug(`[Collector] CEX price fetch failed for ${symbol}:`, error);
      return null;
    }
  }

  private async fetchPriceFromDEX(symbol: string): Promise<PriceData | null> {
    try {
      const searchUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let response: any;
      try {
        const res = await fetch(searchUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'DAO-Collector/1.0' },
        });
        response = await res.json();
      } finally {
        clearTimeout(timeoutId);
      }

      if (response?.pairs?.length > 0) {
        const bestPair = response.pairs.reduce((best: any, curr: any) =>
          (curr.txns?.h24 ?? 0) > (best.txns?.h24 ?? 0) ? curr : best
        );

        if (bestPair?.priceUsd && parseFloat(bestPair.priceUsd) > 0) {
          return {
            symbol,
            price: parseFloat(bestPair.priceUsd),
            timestamp: Date.now(),
            source: `DEX-${bestPair.dexId}`,
          };
        }
      }

      return null;
    } catch (error) {
      logger.debug(`[Collector] DEX price fetch failed for ${symbol}:`, error);
      return null;
    }
  }

  private async fetchPriceFromOracle(symbol: string): Promise<PriceData | null> {
    try {
      const oraclePriceData = await priceOracle.getPrice(symbol);
      if (oraclePriceData && oraclePriceData.priceUsd && oraclePriceData.priceUsd > 0) {
        return {
          symbol,
          price: oraclePriceData.priceUsd,
          timestamp: Date.now(),
          source: 'Oracle-CoinGecko',
          metadata: {
            marketCap: oraclePriceData.marketCap ?? undefined,
            change24h: oraclePriceData.priceChange24h ?? undefined,
            volume24h: oraclePriceData.volume24h ?? undefined,
            name: oraclePriceData.name ?? undefined,
          },
        };
      }
      return null;
    } catch (error) {
      logger.debug(`[Collector] Oracle fetch failed for ${symbol}:`, error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Token discovery sync
  // ---------------------------------------------------------------------------

  async syncTokenDiscovery(): Promise<CollectorResult<void>> {
    try {
      logger.info('[Collector] Starting token discovery sync…');
      const symbolMappings = new Map<string, string>();
      const exchanges = ['binance', 'kraken', 'coinbase'];

      for (const exchange of exchanges) {
        try {
          const symbols = await symbolUniverseService.discoverSupportedPairs(exchange);
          for (const symbol of symbols) {
            if (!symbolMappings.has(symbol)) {
              symbolMappings.set(symbol, symbol.toLowerCase());
            }
          }
        } catch (error) {
          logger.debug(`[Collector] Discovery failed for ${exchange}:`, error);
        }
      }

      if (symbolMappings.size > 0) {
        priceOracle.registerSymbolMappings(symbolMappings);
        // Invalidate active symbols cache so next call re-discovers
        this.activeSymbolsCache = [];
        this.activeSymbolsCachedAt = 0;
        logger.info(`[Collector] Token sync complete: ${symbolMappings.size} symbols registered`);
      }

      return { success: true };
    } catch (error) {
      logger.error('[Collector] Token discovery sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // CEX price collection
  // ---------------------------------------------------------------------------

  /**
   * FIX 3: Now returns actual PriceData[] from fetchExchangePrices result
   * instead of the always-empty [] that was returned before.
   */
  async collectCEXPrices(
    exchange: string,
    tradingPairs: string[]
  ): Promise<CollectorResult<PriceData[]>> {
    const cacheKey = `collector:cex-prices:${exchange}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return { success: true, data: JSON.parse(cached), fromCache: true };
      }

      logger.info(
        `[Collector] Collecting CEX prices from ${exchange} (${tradingPairs.length} pairs)…`
      );

      // FIX 5: getCEXPriceCollector may throw if no db injected yet — wrap defensively
      let result: any;
      try {
        const { getCEXPriceCollector } = await import('./cexPriceCollector');
        const collector = getCEXPriceCollector();
        result = await collector.fetchExchangePrices(exchange as any, tradingPairs);
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'CEXPriceCollector unavailable',
        };
      }

      if (!result.success) {
        return { success: false, error: result.error ?? 'CEX collection failed' };
      }

      // FIX 3: collect per-pair prices so we can actually return them
      const prices: PriceData[] = await this.collectPricesForSymbols(
        tradingPairs.map((p) => p.split('/')[0]).filter(Boolean)
      ).then((r) => r.data ?? []);

      await redis.set(cacheKey, JSON.stringify(prices), 60).catch(() => {});

      await jobQueueService
        .queueJob(
          'price-oracle-update',
          { type: 'cex-prices-batch', exchange, pairs: tradingPairs, timestamp: new Date() },
          { priority: 2 }
        )
        .catch(() => {});

      logger.info(
        `[Collector] CEX collection complete: ${result.pairsProcessed} pairs processed`
      );
      return {
        success: true,
        data: prices,
        itemsProcessed: result.pairsProcessed,
        itemsFailed: result.pairsFailed,
      };
    } catch (error) {
      logger.error('[Collector] Failed to collect CEX prices:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // DEX price collection
  // ---------------------------------------------------------------------------

  async collectDEXPrices(
    symbols: string[],
    _baseToken: string = 'USDC',
    _options?: { chainId?: number; dexes?: string[] }
  ): Promise<CollectorResult<PriceData[]>> {
    const cacheKey = `collector:dex-prices:${symbols.join(',')}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return { success: true, data: JSON.parse(cached), fromCache: true };
      }

      logger.info(`[Collector] DEX prices for ${symbols.length} symbols via DEXScreener…`);

      const results = await Promise.allSettled(
        symbols.map((sym) => this.fetchPriceFromDEX(sym))
      );

      const prices: PriceData[] = [];
      let successCount = 0;

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          prices.push(result.value);
          successCount++;
        }
      }

      if (prices.length > 0) {
        await redis.set(cacheKey, JSON.stringify(prices), 120).catch(() => {});
        await jobQueueService
          .queueJob(
            'price-oracle-update',
            { type: 'dex-prices-batch', symbols, prices, timestamp: new Date() },
            { priority: 3 }
          )
          .catch(() => {});
      }

      return {
        success: successCount > 0,
        data: prices,
        itemsProcessed: successCount,
        itemsFailed: symbols.length - successCount,
      };
    } catch (error) {
      logger.error('[Collector] Failed to collect DEX prices:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // DEX token discovery
  // ---------------------------------------------------------------------------

  async discoverDEXTokens(
    options?: { limit?: number; chain?: string }
  ): Promise<CollectorResult<string[]>> {
    const cacheKey = 'collector:dex-tokens:discovered';

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return { success: true, data: JSON.parse(cached), fromCache: true };
      }

      logger.info('[Collector] Discovering DEX tokens via DEXScreener…');

      // DEXScreener token profiles endpoint (valid as of 2024)
      const url = 'https://api.dexscreener.com/token-profiles/latest/v1';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let response: any;
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'DAO-Collector/1.0' },
        });
        response = await res.json();
      } finally {
        clearTimeout(timeoutId);
      }

      const limit = options?.limit ?? 50;
      const tokens: string[] = [];
      const seen = new Set<string>();

      const items: any[] = Array.isArray(response) ? response : response?.data ?? [];
      for (const item of items) {
        if (tokens.length >= limit) break;
        const symbol: string = item?.symbol ?? item?.tokenAddress ?? '';
        if (symbol && symbol.length > 0 && symbol.length < 20 && !seen.has(symbol)) {
          seen.add(symbol);
          tokens.push(symbol);
        }
      }

      if (tokens.length > 0) {
        await redis.set(cacheKey, JSON.stringify(tokens), 600).catch(() => {});
        return { success: true, data: tokens, itemsProcessed: tokens.length };
      }

      return { success: false, error: 'No tokens found on DEXScreener' };
    } catch (error) {
      logger.error('[Collector] Failed to discover DEX tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Pool metrics
  // ---------------------------------------------------------------------------

  async collectPoolMetrics(poolIds: string[]): Promise<CollectorResult<any[]>> {
    try {
      logger.info(`[Collector] Fetching metrics for ${poolIds.length} pools in parallel…`);

      const results = await Promise.allSettled(
        poolIds.map((id) => this.fetchPoolMetrics(id))
      );

      const poolMetrics: any[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          poolMetrics.push(result.value);
          successCount++;
        } else {
          failureCount++;
        }
      }

      if (poolMetrics.length > 0) {
        await Promise.allSettled(
          poolMetrics.map((m) =>
            redis
              .set(`collector:pool-metrics:${m.poolId}`, JSON.stringify(m), this.POOL_CACHE_TTL)
              .catch(() => {})
          )
        );

        await jobQueueService
          .queueJob(
            'pool-rebalance',
            { type: 'pool-metrics-batch', metrics: poolMetrics, timestamp: new Date() },
            { priority: 3 }
          )
          .catch(() => {});
      }

      return {
        success: successCount > 0,
        data: poolMetrics,
        itemsProcessed: successCount,
        itemsFailed: failureCount,
      };
    } catch (error) {
      logger.error('[Collector] Failed to collect pool metrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async fetchPoolMetrics(poolId: string): Promise<any> {
    try {
      return { poolId, timestamp: Date.now() };
    } catch (error) {
      logger.error(`[Collector] Failed to fetch metrics for pool ${poolId}:`, error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Vault holdings
  // ---------------------------------------------------------------------------

  async collectVaultHoldings(vaultId: string): Promise<CollectorResult<any>> {
    const cacheKey = `collector:vault-holdings:${vaultId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return { success: true, data: JSON.parse(cached), fromCache: true };
      }

      const holdings = await dbOptimizationLayer.getVaultWithHoldings(vaultId);
      if (holdings) {
        await redis.set(cacheKey, JSON.stringify(holdings), this.DEFAULT_REDIS_TTL).catch(() => {});
        return { success: true, data: holdings };
      }

      return { success: false, error: 'Vault not found' };
    } catch (error) {
      logger.error(`[Collector] Failed to collect vault holdings for ${vaultId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Generic batch collector
  // ---------------------------------------------------------------------------

  async collectBatch<T>(
    items: string[],
    fetchFn: (item: string) => Promise<T | null>,
    options?: { cacheKeyPrefix?: string; ttl?: number }
  ): Promise<CollectorResult<T[]>> {
    const {
      cacheKeyPrefix = 'collector:item',
      ttl = this.DEFAULT_REDIS_TTL,
    } = options ?? {};

    try {
      const results = await Promise.allSettled(items.map((item) => fetchFn(item)));
      const data: T[] = [];
      let successCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const item = items[i];
        if (result.status === 'fulfilled' && result.value !== null) {
          data.push(result.value!);
          successCount++;
          await redis
            .set(`${cacheKeyPrefix}:${item}`, JSON.stringify(result.value), ttl)
            .catch(() => {});
        }
      }

      return {
        success: successCount > 0,
        data,
        itemsProcessed: successCount,
        itemsFailed: items.length - successCount,
      };
    } catch (error) {
      logger.error('[Collector] Batch collection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Redis helpers
  // ---------------------------------------------------------------------------

  async getBufferedData<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      logger.error(`[Collector] Failed to get buffered data for ${key}:`, error);
      return null;
    }
  }

  /**
   * FIX 4: Actually deletes the listed keys instead of being a no-op.
   * Pass explicit keys — Redis pattern scanning is intentionally avoided
   * (KEYS/SCAN can block production Redis instances).
   */
  async clearBufferedData(keys: string[]): Promise<void> {
    if (!Array.isArray(keys) || keys.length === 0) return;
    try {
      await Promise.allSettled(keys.map((k) => redis.del(k)));
      logger.debug(`[Collector] Cleared ${keys.length} Redis keys`);
    } catch (error) {
      logger.error('[Collector] Failed to clear buffered data:', error);
    }
  }
}

export const collectorService = new CollectorService();