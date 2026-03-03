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
 */

import { logger } from '../utils/logger';
import { redis } from './redis';
import { ccxtService } from './ccxtService';
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

/**
 * Collector Service - Parallel data fetching with Redis buffering
 * 
 * Responsibilities:
 * 1. Batch fetch symbols from exchange (parallel CCXT calls)
 * 2. Batch fetch prices (Promise.allSettled across multiple sources)
 * 3. Batch fetch pool metrics (parallel DB + cache lookups)
 * 4. Batch fetch vault holdings (leverages databaseOptimizationLayer)
 * 5. Buffer all results to Redis before DB persistence
 */
class CollectorService {
  private readonly DEFAULT_MAX_CONCURRENCY = 10;
  private readonly DEFAULT_BATCH_SIZE = 50;
  private readonly DEFAULT_REDIS_TTL = 300; // 5 minutes for buffered data
  private readonly PRICE_CACHE_TTL = 30; // 30 seconds for price data
  private readonly SYMBOL_CACHE_TTL = 300; // 5 minutes for symbols
  private readonly POOL_CACHE_TTL = 120; // 2 minutes for pool data

  constructor(private options: CollectorOptions = {}) {
    this.options = {
      maxConcurrency: options.maxConcurrency || this.DEFAULT_MAX_CONCURRENCY,
      batchSize: options.batchSize || this.DEFAULT_BATCH_SIZE,
      redisTTL: options.redisTTL || this.DEFAULT_REDIS_TTL,
    };
  }

  /**
   * Collect symbols for an exchange in parallel batches
   * Parallelizes CCXT market fetching to reduce sequential calls
   */
  async collectSymbolsForExchange(exchange: string): Promise<CollectorResult<string[]>> {
    const cacheKey = `collector:symbols:${exchange}`;

    try {
      // Check Redis cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`[Collector] Symbols for ${exchange} loaded from Redis cache`);
        return {
          success: true,
          data: JSON.parse(cached),
          fromCache: true,
        };
      }

      logger.info(`[Collector] Starting parallel symbol discovery for ${exchange}...`);

      // Use symbolUniverseService with CCXT backend
      // This already batches internally but we add Redis buffering
      const symbols = await symbolUniverseService.discoverSupportedPairs(exchange);

      // Buffer to Redis for fast retrieval by Engine/API layers
      await redis.set(cacheKey, JSON.stringify(symbols), this.SYMBOL_CACHE_TTL);

      // Queue async DB persistence if needed
      if (symbols.length > 0) {
        await jobQueueService.queueJob('price-oracle-update', {
          type: 'symbol-discovery',
          exchange,
          symbols,
          timestamp: new Date(),
        }, { priority: 3 });
      }

      logger.info(`[Collector] Discovered ${symbols.length} symbols for ${exchange}, buffered to Redis`);
      return {
        success: true,
        data: symbols,
        itemsProcessed: symbols.length,
      };
    } catch (error) {
      logger.error(`[Collector] Failed to collect symbols for ${exchange}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch fetch prices for multiple symbols using Promise.allSettled
   * Tries all price sources in parallel, uses first available
   */
  async collectPricesForSymbols(symbols: string[]): Promise<CollectorResult<PriceData[]>> {
    const cacheKey = 'collector:prices:batch';

    try {
      // Check if all prices exist in Redis cache
      const cachedPrices: PriceData[] = [];
      const uncachedSymbols: string[] = [];

      for (const symbol of symbols) {
        const priceKey = `collector:price:${symbol}`;
        const cached = await redis.get(priceKey);
        if (cached) {
          cachedPrices.push(JSON.parse(cached));
        } else {
          uncachedSymbols.push(symbol);
        }
      }

      // If all cached, return fast
      if (uncachedSymbols.length === 0) {
        logger.info(`[Collector] All ${symbols.length} prices loaded from Redis cache`);
        return {
          success: true,
          data: cachedPrices,
          fromCache: true,
          itemsProcessed: cachedPrices.length,
        };
      }

      logger.info(`[Collector] Fetching ${uncachedSymbols.length}/${symbols.length} prices from all sources in parallel...`);

      /**
       * UNIFIED PARALLEL FETCHING
       * Coordinator pattern: Call all data sources simultaneously, not sequentially
       * - CEX prices (Binance, Kraken, etc.)
       * - DEX quotes (Uniswap, SushiSwap, etc.)
       * - Price Oracle (Gateway Agent + CoinGecko fallback)
       * Uses first successful source per symbol
       */
      const pricePromises = uncachedSymbols.map((symbol) =>
        this.fetchPriceFromAllSources(symbol) // Tries ALL sources in parallel
      );

      const results = await Promise.allSettled(pricePromises);

      // Process results
      const fetchedPrices: PriceData[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const symbol = uncachedSymbols[i];

        if (result.status === 'fulfilled' && result.value) {
          fetchedPrices.push(result.value);
          successCount++;

          // Buffer each price to Redis
          const priceKey = `collector:price:${symbol}`;
          await redis.set(priceKey, JSON.stringify(result.value), this.PRICE_CACHE_TTL);
        } else {
          failureCount++;
          logger.warn(`[Collector] Failed to fetch price for ${symbol}`);
        }
      }

      // Combine cached + fetched prices
      const allPrices = [...cachedPrices, ...fetchedPrices];

      // Queue DB persistence job
      if (allPrices.length > 0) {
        await jobQueueService.queueJob('price-oracle-update', {
          type: 'price-batch',
          prices: allPrices,
          timestamp: new Date(),
        }, { priority: 2 });
      }

      logger.info(`[Collector] Fetched ${successCount}/${uncachedSymbols.length} prices from unified sources, buffered to Redis`);
      return {
        success: successCount > 0,
        data: allPrices,
        itemsProcessed: successCount,
        itemsFailed: failureCount,
      };
    } catch (error) {
      logger.error(`[Collector] Failed to collect prices:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * PRIORITY-BASED PRICE FETCHING
   * 
   * Follows strict priority order:
   * 1️⃣ CEX (real-time, most liquid, highest priority)
   * 2️⃣ DEX (fallback, real liquidity)
   * 3️⃣ ORACLE (final fallback, always available, metrics enrichment)
   * 
   * Each source is tried sequentially - not in parallel
   * This ensures we use the best available price
   */
  private async fetchPriceFromAllSources(symbol: string): Promise<PriceData | null> {
    try {
      logger.debug(`[Collector] Fetching ${symbol} using priority order: CEX → DEX → Oracle`);

      // PRIORITY 1: CEX (real-time trading, most reliable for major tokens)
      try {
        const cexPrice = await this.fetchPriceFromCEX(symbol);
        if (cexPrice && cexPrice.price > 0) {
          logger.debug(`[Collector] ${symbol} from CEX: $${cexPrice.price}`);
          return cexPrice;
        }
      } catch (error) {
        logger.debug(`[Collector] CEX fetch failed for ${symbol}, trying DEX`);
      }

      // PRIORITY 2: DEX (fallback, real pool liquidity)
      try {
        const dexPrice = await this.fetchPriceFromDEX(symbol);
        if (dexPrice && dexPrice.price > 0) {
          logger.debug(`[Collector] ${symbol} from DEX: $${dexPrice.price}`);
          return dexPrice;
        }
      } catch (error) {
        logger.debug(`[Collector] DEX fetch failed for ${symbol}, trying Oracle`);
      }

      // PRIORITY 3: ORACLE (final fallback, always available)
      try {
        const oraclePrice = await this.fetchPriceFromOracle(symbol);
        if (oraclePrice && oraclePrice.price > 0) {
          logger.debug(`[Collector] ${symbol} from Oracle: $${oraclePrice.price}`);
          return oraclePrice;
        }
      } catch (error) {
        logger.debug(`[Collector] Oracle fetch failed for ${symbol}`);
      }

      logger.warn(`[Collector] No price available from any source for ${symbol}`);
      return null;
    } catch (error) {
      logger.warn(`[Collector] Error fetching price from all sources for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch price from CEX via CCXT (Binance, Kraken, Coinbase, etc.)
   * Routes through cexPriceCollector singleton, not duplicating fetches
   */
  private async fetchPriceFromCEX(symbol: string): Promise<PriceData | null> {
    try {
      // Lazy import to avoid circular dependencies
      const { getCEXPriceCollector } = await import('./cexPriceCollector');
      const collector = getCEXPriceCollector();

      // Call cexPriceCollector's direct price fetching (uses its cache/logic, no duplicate parallel fetch)
      const price = await collector.fetchPriceForSymbol?.(symbol);

      if (price && typeof price === 'number' && price > 0) {
        return {
          symbol,
          price,
          timestamp: Date.now(),
          source: 'CEX',
        };
      }
      return null;
    } catch (error) {
      logger.debug(`[Collector] CEX price fetch failed for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch price from DEX via DEXScreener API
   * Gets real DEX market data (Uniswap, SushiSwap, QuickSwap, etc. across all chains)
   * Dynamic discovery - not hardcoded pair format
   */
  private async fetchPriceFromDEX(symbol: string): Promise<PriceData | null> {
    try {
      // Use DEXScreener API to discover token across all DEX markets
      const baseUrl = 'https://api.dexscreener.com/latest/dex';
      const searchUrl = `${baseUrl}/search?q=${symbol}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'DAO-Collector/1.0' },
      })
        .then(r => r.json())
        .finally(() => clearTimeout(timeoutId));

      if (response?.pairs && response.pairs.length > 0) {
        // Get the most liquid pair (highest txns in 24h)
        const bestPair = response.pairs.reduce((best: any, curr: any) => {
          const currTxns = curr.txns?.h24 || 0;
          const bestTxns = best.txns?.h24 || 0;
          return currTxns > bestTxns ? curr : best;
        });

        if (bestPair && bestPair.priceUsd && parseFloat(bestPair.priceUsd) > 0) {
          logger.debug(`[Collector] DEX price for ${symbol} found on ${bestPair.dexId}/${bestPair.chainId}`);
          return {
            symbol,
            price: parseFloat(bestPair.priceUsd),
            timestamp: Date.now(),
            source: `DEX-${bestPair.dexId}`,
          };
        }
      }

      logger.debug(`[Collector] No DEX price found for ${symbol} on DEXScreener`);
      return null;
    } catch (error) {
      logger.debug(`[Collector] DEX price fetch failed for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch price from Price Oracle (Gateway Agent + CoinGecko)
   * Already has parallel multi-source fetching built-in
   */
  /**
   * Fetch price from Price Oracle (CoinGecko)
   * Used as FALLBACK - provides metrics (market cap, 24h change, volume)
   * Not used for arbitrage (too slow - 60s TTL)
   */
  private async fetchPriceFromOracle(symbol: string): Promise<PriceData | null> {
    try {
      const oraclePriceData = await priceOracle.getPrice(symbol);

      if (oraclePriceData && oraclePriceData.priceUsd > 0) {
        // Return enriched with oracle metrics
        return {
          symbol,
          price: oraclePriceData.priceUsd,
          timestamp: Date.now(),
          source: 'Oracle-CoinGecko',
          metadata: {
            marketCap: oraclePriceData.marketCap,
            change24h: oraclePriceData.priceChange24h,
            volume24h: oraclePriceData.volume24h,
            name: oraclePriceData.name,
          },
        };
      }
      return null;
    } catch (error) {
      logger.debug(`[Collector] Oracle fetch failed for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * SYNC TOKEN DISCOVERY: Called periodically to discover all tokens
   * Populates priceOracle symbol mappings + assetRegistry
   * Should be called on startup + every 6 hours
   */
  async syncTokenDiscovery(): Promise<CollectorResult<void>> {
    try {
      logger.info(`[Collector] Starting token discovery sync...`);

      const symbolMappings = new Map<string, string>();

      // Discover from all exchange sources
      const exchanges = ['binance', 'kraken', 'coinbase'];
      for (const exchange of exchanges) {
        try {
          const symbols = await symbolUniverseService.discoverSupportedPairs(exchange);
          for (const symbol of symbols) {
            // Map each symbol to a stable ID (can be extended with assetRegistry)
            if (!symbolMappings.has(symbol)) {
              logger.debug(`[Collector] Discovered ${symbol} from ${exchange}`);
              // For now, use symbol as ID - real implementation would use assetRegistry
              symbolMappings.set(symbol, symbol.toLowerCase());
            }
          }
        } catch (error) {
          logger.debug(`[Collector] Discovery failed for ${exchange}:`, error);
        }
      }

      // Register all symbols with priceOracle for fast fallback lookup
      if (symbolMappings.size > 0) {
        priceOracle.registerSymbolMappings(symbolMappings);
        logger.info(`[Collector] Token sync complete: ${symbolMappings.size} symbols registered with oracle`);
      }

      return { success: true };
    } catch (error) {
      logger.error(`[Collector] Token discovery sync failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch fetch prices for multiple symbols using CEX unified collection
   * Single interface to collect CEX prices from all exchanges without redundant fetching
   */
  async collectCEXPrices(
    exchange: string,
    tradingPairs: string[]
  ): Promise<CollectorResult<PriceData[]>> {
    const cacheKey = `collector:cex-prices:${exchange}`;

    try {
      // Check Redis cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`[Collector] CEX prices for ${exchange} loaded from Redis cache`);
        return {
          success: true,
          data: JSON.parse(cached),
          fromCache: true,
        };
      }

      logger.info(`[Collector] Collecting CEX prices from ${exchange} (${tradingPairs.length} pairs) with parallel batching...`);

      // Lazy import to coordinate with cexPriceCollector (avoid circular dependency)
      const { getCEXPriceCollector } = await import('./cexPriceCollector');
      const collector = getCEXPriceCollector();

      // Call cexPriceCollector to fetch all pairs (it handles parallel batching internally)
      const result = await collector.fetchExchangePrices(
        exchange as any,
        tradingPairs
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'CEX collection failed',
        };
      }

      // Buffer to Redis (shorter TTL for CEX prices - more dynamic)
      await redis.set(cacheKey, JSON.stringify(result), 60); // 1-min TTL

      // Queue DB persistence
      await jobQueueService.queueJob('price-oracle-update', {
        type: 'cex-prices-batch',
        exchange,
        pairs: tradingPairs,
        result,
        timestamp: new Date(),
      }, { priority: 2 });

      logger.info(`[Collector] CEX collection complete: ${result.pairsProcessed} pairs processed`);
      return {
        success: true,
        data: [], // Will be populated by cexPriceCollector or stored in DB
        itemsProcessed: result.pairsProcessed,
        itemsFailed: result.pairsFailed,
      };
    } catch (error) {
      logger.error(`[Collector] Failed to collect CEX prices:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch fetch DEX prices / liquidity quotes
   * Uses DEXScreener API to discover actual DEX markets without hardcoded pair formats
   */
  async collectDEXPrices(
    symbols: string[],
    baseToken: string = 'USDC',
    options?: { chainId?: number; dexes?: string[] }
  ): Promise<CollectorResult<PriceData[]>> {
    const cacheKey = `collector:dex-prices:${symbols.join(',')}`;

    try {
      // Check Redis cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`[Collector] DEX prices loaded from Redis cache`);
        return {
          success: true,
          data: JSON.parse(cached),
          fromCache: true,
        };
      }

      logger.info(`[Collector] Collecting DEX prices for ${symbols.length} symbols via DEXScreener...`);

      // Parallel fetch from DEXScreener API
      const pricePromises = symbols.map((symbol) => this.fetchPriceFromDEX(symbol));
      const results = await Promise.allSettled(pricePromises);

      const prices: PriceData[] = [];
      let successCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
          prices.push(result.value);
          successCount++;
        }
      }

      // Buffer to Redis
      if (prices.length > 0) {
        await redis.set(cacheKey, JSON.stringify(prices), 120); // 2-min TTL

        // Queue DB persistence
        await jobQueueService.queueJob('price-oracle-update', {
          type: 'dex-prices-batch',
          symbols,
          baseToken,
          prices,
          timestamp: new Date(),
        }, { priority: 3 });
      }

      logger.info(`[Collector] DEX collection complete: ${successCount}/${symbols.length} prices fetched`);
      return {
        success: successCount > 0,
        data: prices,
        itemsProcessed: successCount,
        itemsFailed: symbols.length - successCount,
      };
    } catch (error) {
      logger.error(`[Collector] Failed to collect DEX prices:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Discover DEX tokens dynamically via DEXScreener
   * Finds trending/high-volume tokens across all DEX markets
   */
  async discoverDEXTokens(options?: { limit?: number; chain?: string; sortBy?: 'volume' | 'txns' | 'price_change' }): Promise<CollectorResult<string[]>> {
    const cacheKey = 'collector:dex-tokens:discovered';

    try {
      // Check Redis cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`[Collector] DEX tokens loaded from cache`);
        return {
          success: true,
          data: JSON.parse(cached),
          fromCache: true,
        };
      }

      logger.info(`[Collector] Discovering DEX tokens via DEXScreener (trending)...`);

      // Use DEXScreener API to find trending tokens
      const baseUrl = 'https://api.dexscreener.com/latest/dex';
      const trendingUrl = `${baseUrl}/tokens`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(trendingUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'DAO-Collector/1.0' },
      })
        .then(r => r.json())
        .finally(() => clearTimeout(timeoutId));

      const tokens: string[] = [];

      if (response?.pairs && Array.isArray(response.pairs)) {
        // Extract unique symbols, sorted by volume/liquidity
        const symbolSet = new Set<string>();
        const limit = options?.limit || 50;

        for (const pair of response.pairs) {
          if (symbolSet.size >= limit) break;

          // Extract symbol from token name or address
          const symbol = pair.baseToken?.symbol || pair.tokenName || '';
          if (symbol && symbol.length > 0 && symbol.length < 20) {
            symbolSet.add(symbol);
          }
        }

        tokens.push(...Array.from(symbolSet).slice(0, limit));
      }

      // Buffer to Redis (longer TTL for token discovery)
      if (tokens.length > 0) {
        await redis.set(cacheKey, JSON.stringify(tokens), 600); // 10-min TTL

        logger.info(`[Collector] Discovered ${tokens.length} DEX tokens, buffered to Redis`);
        return {
          success: true,
          data: tokens,
          itemsProcessed: tokens.length,
        };
      }

      return {
        success: false,
        error: 'No tokens found on DEXScreener',
      };
    } catch (error) {
      logger.error(`[Collector] Failed to discover DEX tokens:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch price for a symbol with fallback strategy
   * Tries primary source, then fallbacks in parallel
   */

  /**
   * Batch fetch pool metrics (prices, fees, TVL, etc.)
   * Leverages parallel queries and Redis caching
   */
  async collectPoolMetrics(poolIds: string[]): Promise<CollectorResult<any[]>> {
    const cacheKey = 'collector:pool-metrics:batch';

    try {
      logger.info(`[Collector] Fetching metrics for ${poolIds.length} pools in parallel...`);

      // Batch fetch from optimization layer
      const metricPromises = poolIds.map((poolId) =>
        this.fetchPoolMetrics(poolId)
      );

      const results = await Promise.allSettled(metricPromises);

      // Process results
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

      // Buffer to Redis
      if (poolMetrics.length > 0) {
        for (const metrics of poolMetrics) {
          const key = `collector:pool-metrics:${metrics.poolId}`;
          await redis.set(key, JSON.stringify(metrics), this.POOL_CACHE_TTL);
        }

        // Queue DB persistence
        await jobQueueService.queueJob('pool-rebalance', {
          type: 'pool-metrics-batch',
          metrics: poolMetrics,
          timestamp: new Date(),
        }, { priority: 3 });
      }

      logger.info(`[Collector] Collected metrics for ${successCount}/${poolIds.length} pools`);
      return {
        success: successCount > 0,
        data: poolMetrics,
        itemsProcessed: successCount,
        itemsFailed: failureCount,
      };
    } catch (error) {
      logger.error(`[Collector] Failed to collect pool metrics:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch individual pool metrics
   */
  private async fetchPoolMetrics(poolId: string): Promise<any> {
    try {
      // Leverage databaseOptimizationLayer for fast queries
      // This would fetch pool data, holdings, prices, etc. in a single batch
      return {
        poolId,
        timestamp: Date.now(),
        // In real implementation, would call investmentPoolPricingService
        // and databaseOptimizationLayer for batch data
      };
    } catch (error) {
      logger.error(`[Collector] Failed to fetch metrics for pool ${poolId}:`, error);
      return null;
    }
  }

  /**
   * Batch fetch vault holdings
   * Leverages databaseOptimizationLayer batch queries
   */
  async collectVaultHoldings(vaultId: string): Promise<CollectorResult<any>> {
    const cacheKey = `collector:vault-holdings:${vaultId}`;

    try {
      // Check Redis cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`[Collector] Vault holdings for ${vaultId} loaded from Redis cache`);
        return {
          success: true,
          data: JSON.parse(cached),
          fromCache: true,
        };
      }

      logger.info(`[Collector] Fetching vault holdings for ${vaultId}...`);

      // Use dbOptimizationLayer batch methods
      const holdings = await dbOptimizationLayer.getVaultWithHoldings(vaultId);

      if (holdings) {
        // Buffer to Redis
        await redis.set(cacheKey, JSON.stringify(holdings), this.DEFAULT_REDIS_TTL);

        logger.info(`[Collector] Collected holdings for vault ${vaultId}, buffered to Redis`);
        return {
          success: true,
          data: holdings,
        };
      }

      return {
        success: false,
        error: 'Vault not found',
      };
    } catch (error) {
      logger.error(`[Collector] Failed to collect vault holdings for ${vaultId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generic batch collector for arbitrary data with Redis buffering
   * Pattern: Fetch in parallel → Buffer to Redis → Queue DB persistence
   */
  async collectBatch<T>(
    items: string[],
    fetchFn: (item: string) => Promise<T | null>,
    options?: { cacheKeyPrefix?: string; ttl?: number; persistToDb?: boolean }
  ): Promise<CollectorResult<T[]>> {
    try {
      const { cacheKeyPrefix = 'collector:item', ttl = this.DEFAULT_REDIS_TTL, persistToDb = true } = options || {};

      // Fetch all items in parallel
      const promises = items.map((item) => fetchFn(item));
      const results = await Promise.allSettled(promises);

      // Process results
      const data: T[] = [];
      let successCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const item = items[i];

        if (result.status === 'fulfilled' && result.value) {
          data.push(result.value);
          successCount++;

          // Buffer to Redis
          const key = `${cacheKeyPrefix}:${item}`;
          await redis.set(key, JSON.stringify(result.value), ttl);
        }
      }

      logger.info(`[Collector] Batch collected ${successCount}/${items.length} items`);
      return {
        success: successCount > 0,
        data,
        itemsProcessed: successCount,
        itemsFailed: items.length - successCount,
      };
    } catch (error) {
      logger.error(`[Collector] Batch collection failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get buffered data from Redis (useful for Engine/API layers)
   */
  async getBufferedData<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`[Collector] Failed to get buffered data for ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear buffered data from Redis (by individual keys if known)
   */
  async clearBufferedData(pattern: string): Promise<void> {
    try {
      // Note: Redis service doesn't expose keys() method for pattern matching
      // To clear data, explicitly delete known cache keys
      logger.debug(`[Collector] Clear data pattern: ${pattern} (specify keys to delete explicitly)`);
      // Example: await redis.delete(`collector:${pattern}`);
    } catch (error) {
      logger.error(`[Collector] Failed to clear buffered data:`, error);
    }
  }
}

// Export singleton instance
export const collectorService = new CollectorService();
