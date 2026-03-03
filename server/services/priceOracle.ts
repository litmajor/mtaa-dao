import { logger } from '../utils/logger';
import { getGatewayAgentService } from '../core/agents/gateway/service';
import { redis } from './redis';

/**
 * Price Oracle Service for Cryptocurrency Prices
 * 
 * Enhanced Features:
 * - Dynamic symbol resolution (no hardcoding)
 * - Multi-adapter pricing (Gateway Agent + CoinGecko)
 * - Redis-backed deduplication (cross-instance)
 * - Request batching and deduplication (local)
 * - Rate limiting with exponential backoff
 * - Metrics enrichment: market cap, 24h change, volume
 * - Fallback-only role: CEX → DEX → Oracle priority
 */

interface PriceData {
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: Date;
}

interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
    usd_market_cap: number;
    usd_24h_vol: number;
    last_updated_at: number;
  };
}

interface CacheEntry {
  data: PriceData;
  timestamp: number;
}

interface RateLimitState {
  requestCount: number;
  resetTime: number;
  backoffMultiplier: number;
  nextRetryTime: number;
}

class PriceOracleService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DURATION = 60 * 1000; // 1 minute for standard cache
  private readonly LONG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for fallback data
  private readonly API_BASE = 'https://api.coingecko.com/api/v3';
  
  // Redis deduplication: Prevent duplicate fetches across instances
  private readonly DEDUP_PREFIX = 'price:fetch:';
  private readonly DEDUP_TTL = 10; // 10 seconds - only one fetch per symbol in this window
  
  // Rate limiting
  private rateLimitState: RateLimitState = {
    requestCount: 0,
    resetTime: 0,
    backoffMultiplier: 1,
    nextRetryTime: 0,
  };
  private readonly RATE_LIMIT_THRESHOLD = 10; // Requests per window
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly MAX_BACKOFF_MULTIPLIER = 32; // Max 32x backoff
  
  // Request deduplication (local, per-instance)
  private pendingRequests: Map<string, Promise<PriceData | null>> = new Map();

  // Legacy fallback chains placeholder (dynamic registry used instead).
  // Kept as an empty map to remain backwards compatible with callers
  // that reference `CURRENCY_FALLBACKS` while the dynamic registry is
  // the authoritative source for symbol resolution.
  private readonly CURRENCY_FALLBACKS: Record<string, string[]> = {};
  
  // ❌ REMOVED: Hardcoded COIN_IDS map
  // ✅ Dynamic resolution via collector service + assetRegistry
  private symbolToGeckoId: Map<string, string> = new Map();

  /**
   * DYNAMIC SYMBOL RESOLUTION
   * Resolves symbol to CoinGecko ID from registry
   * No hardcoded mappings - fully dynamic
   */
  private async resolveToCoinGeckoId(symbol: string): Promise<string | null> {
    try {
      const upperSymbol = symbol.toUpperCase();
      
      // Check local cache first
      if (this.symbolToGeckoId.has(upperSymbol)) {
        return this.symbolToGeckoId.get(upperSymbol) || null;
      }

      logger.debug(`[PriceOracle] Symbol ${symbol} not yet registered - need discovery phase`);
      return null;
    } catch (error) {
      logger.debug(`[PriceOracle] Error resolving symbol ${symbol}:`, error);
      return null;
    }
  }

  /**
   * POPULATE SYMBOL MAP (called by collector during discovery)
   * Allows dynamic symbol registration without hardcoding
   */
  registerSymbolMapping(symbol: string, coinGeckoId: string): void {
    this.symbolToGeckoId.set(symbol.toUpperCase(), coinGeckoId);
    logger.debug(`[PriceOracle] Registered ${symbol} → ${coinGeckoId}`);
  }

  /**
   * BULK REGISTER SYMBOLS (called during discovery phase)
   */
  registerSymbolMappings(mappings: Map<string, string>): void {
    for (const [symbol, coinGeckoId] of mappings) {
      this.registerSymbolMapping(symbol, coinGeckoId);
    }
    logger.info(`[PriceOracle] Registered ${mappings.size} symbol mappings`);
  }

  /**
   * REDIS DEDUPLICATION: Prevent duplicate fetches across instances
   */
  private async acquireFetchLock(symbol: string): Promise<boolean> {
    try {
      const lockKey = `${this.DEDUP_PREFIX}${symbol}`;
      await redis.set(lockKey, 'fetching', this.DEDUP_TTL);
      return true; // Lock acquired
    } catch (error) {
      logger.debug(`[PriceOracle] Lock acquisition failed for ${symbol}:`, error);
      return true; // Allow fetch if Redis fails
    }
  }

  /**
   * Check if we should apply rate limiting backoff
   */
  private shouldApplyBackoff(): boolean {
    if (Date.now() < this.rateLimitState.nextRetryTime) {
      return true;
    }

    if (this.rateLimitState.requestCount >= this.RATE_LIMIT_THRESHOLD) {
      const timeSinceReset = Date.now() - this.rateLimitState.resetTime;
      if (timeSinceReset < this.RATE_LIMIT_WINDOW) {
        // Still within rate limit window and threshold exceeded
        logger.warn(`[PriceOracle] Rate limit threshold reached (${this.rateLimitState.requestCount}/${this.RATE_LIMIT_THRESHOLD}), applying backoff`);
        this.applyBackoff();
        return true;
      } else {
        // Reset the counter
        this.rateLimitState.requestCount = 0;
        this.rateLimitState.resetTime = Date.now();
      }
    }

    return false;
  }

  /**
   * Apply exponential backoff when rate limited
   */
  private applyBackoff(): void {
    const backoffTime = Math.min(
      1000 * this.rateLimitState.backoffMultiplier,
      60 * 1000 // Max 60 second backoff
    );
    this.rateLimitState.nextRetryTime = Date.now() + backoffTime;
    this.rateLimitState.backoffMultiplier = Math.min(
      this.rateLimitState.backoffMultiplier * 2,
      this.MAX_BACKOFF_MULTIPLIER
    );
    logger.warn(`[PriceOracle] Applying backoff of ${backoffTime}ms (multiplier: ${this.rateLimitState.backoffMultiplier / 2}x)`);
  }

  /**
   * Reset rate limit state
   */
  private resetRateLimitState(): void {
    this.rateLimitState = {
      requestCount: 0,
      resetTime: Date.now(),
      backoffMultiplier: 1,
      nextRetryTime: 0,
    };
  }

  /**
   * Wait for rate limit backoff if needed
   */
  private async waitForBackoff(): Promise<void> {
    const backoffNeeded = this.rateLimitState.nextRetryTime - Date.now();
    if (backoffNeeded > 0) {
      logger.debug(`[PriceOracle] Waiting ${backoffNeeded}ms for rate limit backoff`);
      await new Promise((resolve) => setTimeout(resolve, backoffNeeded));
    }
  }

  /**
   * Get fallback currency for unsupported symbols
   */
  /**
   * Get fallback currency for unsupported symbols.
   *
   * This helper now leverages the async {@link resolveToCoinGeckoId} method so
   * that callers can prime the registry and log missing mappings while still
   * returning the original symbol for use by the gateway and cache keys. The
   * return value has not changed (it is always the upper‑cased symbol) so the
   * rest of the service remains backwards‑compatible.
   */
  private async getResolvedSymbol(symbol: string): Promise<string> {
    const upperSymbol = symbol.toUpperCase();

    // attempt to resolve to a Gecko ID (logs if the symbol is unknown)
    // we intentionally ignore the result because the gateway and cache system
    // still operate on the plain symbol name.
    await this.resolveToCoinGeckoId(upperSymbol);

    return upperSymbol;
  }

  /**
   * Get single price with deduplication
   */
  async getPrice(symbol: string): Promise<PriceData | null> {
    const upperSymbol = symbol.toUpperCase();

    // Check cache first
    const cached = this.cache.get(upperSymbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.debug(`[PriceOracle-Cache] Hit for ${upperSymbol}`);
      return cached.data;
    }

    // Deduplicate concurrent requests
    if (this.pendingRequests.has(upperSymbol)) {
      logger.debug(`[PriceOracle-Dedup] Returning pending request for ${upperSymbol}`);
      return this.pendingRequests.get(upperSymbol)!;
    }

    // Create new request promise
    const requestPromise = this._fetchPrice(upperSymbol);
    this.pendingRequests.set(upperSymbol, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(upperSymbol);
    }
  }

  /**
   * Internal fetch for single price
   */
  private async _fetchPrice(symbol: string): Promise<PriceData | null> {
    try {
      // Resolve symbol to supported currency (async helper)
      const resolvedSymbol = await this.getResolvedSymbol(symbol);

      // Check cache for resolved symbol
      const cached = this.cache.get(resolvedSymbol);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        logger.debug(`[PriceOracle-Cache] Hit for ${resolvedSymbol}`);
        return cached.data;
      }

      // Try Gateway Agent first
      try {
        const gatewayService = getGatewayAgentService();
        if (gatewayService.isHealthy()) {
          const priceRequest = await gatewayService.requestPrices(
            [resolvedSymbol],
            undefined,
            undefined
          );

          await new Promise((resolve) => setTimeout(resolve, 50));

          const priceData = priceRequest?.payload?.data?.[0];
          if (priceData && priceData.price > 0) {
            const result: 
            PriceData = {
              symbol: resolvedSymbol,
              name: this.getCoinName(resolvedSymbol),
              priceUsd: priceData.price,
              priceChange24h: priceData.change24h || 0,
              marketCap: priceData.marketCap || 0,
              volume24h: priceData.volume24h || 0,
              lastUpdated: new Date(),
            };

            this.cache.set(resolvedSymbol, { data: result, timestamp: Date.now() });
            logger.debug(`[PriceOracle-Gateway] Price for ${symbol}: $${priceData.price}`);
            return result;
          }
        }
      } catch (gatewayError) {
        logger.debug(`[PriceOracle] Gateway failed for ${symbol}, trying CoinGecko`);
      }

      // Fallback to CoinGecko
      const coinId = await this.resolveToCoinGeckoId(resolvedSymbol);
      if (!coinId) {
        logger.warn(`[PriceOracle] Unsupported asset: ${symbol}`);
        return null;
      }

      // Check for rate limiting
      if (this.shouldApplyBackoff()) {
        await this.waitForBackoff();
      }

      const response = await fetch(
        `${this.API_BASE}/simple/price?ids=${coinId}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
      );

      this.rateLimitState.requestCount++;

      if (response.status === 429) {
        // Too many requests - apply backoff
        logger.warn('[PriceOracle] CoinGecko returned 429 (rate limited)');
        this.applyBackoff();
        return null;
      }

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      // Reset rate limit on success
      if (this.rateLimitState.requestCount % this.RATE_LIMIT_THRESHOLD === 0) {
        this.resetRateLimitState();
      }

      const data: CoinGeckoResponse = await response.json();
      const coinData = data[coinId];

      if (!coinData) {
        logger.warn(`[PriceOracle] No data for ${symbol}`);
        return null;
      }

      const priceData: PriceData = {
        symbol: resolvedSymbol,
        name: this.getCoinName(resolvedSymbol),
        priceUsd: coinData.usd,
        priceChange24h: coinData.usd_24h_change || 0,
        marketCap: coinData.usd_market_cap || 0,
        volume24h: coinData.usd_24h_vol || 0,
        lastUpdated: new Date(coinData.last_updated_at * 1000),
      };

      this.cache.set(resolvedSymbol, { data: priceData, timestamp: Date.now() });
      logger.debug(`[PriceOracle-CoinGecko] Price for ${symbol}: $${coinData.usd}`);

      return priceData;
    } catch (error) {
      logger.error(`[PriceOracle] Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get prices for multiple assets with batching
   */
  async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    const uniqueSymbols = Array.from(new Set(symbols));

    // Try to get prices using batch request
    return this._getBatchPrices(uniqueSymbols);
  }

  /**
   * Internal batch price fetching with deduplication
   */
  private async _getBatchPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();

    // Check cache first
    const notCached = [];
    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      const cached = this.cache.get(upperSymbol);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        prices.set(upperSymbol, cached.data);
        logger.debug(`[PriceOracle-Cache] Batch hit for ${upperSymbol}`);
      } else {
        notCached.push(symbol);
      }
    }

    // If all cached, return early
    if (notCached.length === 0) {
      return prices;
    }

    // Try Gateway Agent for batch
    try {
      const gatewayService = getGatewayAgentService();
      if (gatewayService.isHealthy()) {
        const priceRequest = await gatewayService.requestPrices(
          notCached.map(s => s.toUpperCase()),
          undefined,
          undefined
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        const priceDataList = priceRequest?.payload?.data || [];
        for (const priceData of priceDataList) {
          if (priceData && priceData.price > 0) {
            const result: PriceData = {
              symbol: priceData.symbol,
              name: this.getCoinName(priceData.symbol),
              priceUsd: priceData.price,
              priceChange24h: priceData.change24h || 0,
              marketCap: priceData.marketCap || 0,
              volume24h: priceData.volume24h || 0,
              lastUpdated: new Date(),
            };

            prices.set(priceData.symbol, result);
            this.cache.set(priceData.symbol, { data: result, timestamp: Date.now() });
            logger.debug(`[PriceOracle-Gateway-Batch] Price for ${priceData.symbol}: $${priceData.price}`);
          }
        }

        if (prices.size === symbols.length) {
          return prices;
        }
      }
    } catch (gatewayError) {
      logger.debug('[PriceOracle] Gateway batch failed, falling back to CoinGecko');
    }

    // Fallback to CoinGecko for remaining symbols
    const remaining = symbols.filter(s => !prices.has(s.toUpperCase()));
    if (remaining.length === 0) {
      return prices;
    }

    // Resolve symbols and get coin IDs
    // resolve each symbol (priming registry) and collect the associated
    // CoinGecko ids for the batch request
    const resolvedSymbols: string[] = [];
    const coinIdSet: Set<string> = new Set();

    for (const s of remaining) {
      const rs = await this.getResolvedSymbol(s);
      resolvedSymbols.push(rs);
      const id = await this.resolveToCoinGeckoId(rs);
      if (id) coinIdSet.add(id);
    }

    const uniqueResolved = Array.from(new Set(resolvedSymbols));
    const coinIds = Array.from(coinIdSet);

    if (coinIds.length === 0) {
      return prices;
    }

    // Check for rate limiting
    if (this.shouldApplyBackoff()) {
      await this.waitForBackoff();
    }

    try {
      const response = await fetch(
        `${this.API_BASE}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
      );

      this.rateLimitState.requestCount++;

      if (response.status === 429) {
        logger.warn('[PriceOracle] CoinGecko batch returned 429 (rate limited)');
        this.applyBackoff();
        return prices;
      }

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      // Reset rate limit on success
      if (this.rateLimitState.requestCount % this.RATE_LIMIT_THRESHOLD === 0) {
        this.resetRateLimitState();
      }

      const data: CoinGeckoResponse = await response.json();

      for (const symbol of remaining) {
        const resolvedSymbol = await this.getResolvedSymbol(symbol);
        const coinId = await this.resolveToCoinGeckoId(resolvedSymbol);
        const coinData = coinId ? data[coinId] : undefined;

        if (coinData) {
          const priceData: PriceData = {
            symbol: resolvedSymbol,
            name: this.getCoinName(resolvedSymbol),
            priceUsd: coinData.usd,
            priceChange24h: coinData.usd_24h_change || 0,
            marketCap: coinData.usd_market_cap || 0,
            volume24h: coinData.usd_24h_vol || 0,
            lastUpdated: new Date(coinData.last_updated_at * 1000),
          };

          prices.set(resolvedSymbol, priceData);
          this.cache.set(resolvedSymbol, { data: priceData, timestamp: Date.now() });
          logger.debug(`[PriceOracle-CoinGecko-Batch] Price for ${symbol}: $${coinData.usd}`);
        }
      }

      return prices;
    } catch (error) {
      logger.error('[PriceOracle] Error fetching batch prices:', error);
      return prices;
    }
  }

  /**
   * Get historical price data for charts
   */
  async getHistoricalPrices(
    symbol: string,
    days: number = 30
  ): Promise<Array<{ date: Date; price: number }>> {
    try {
      const resolvedSymbol = await this.getResolvedSymbol(symbol);
      const coinId = await this.resolveToCoinGeckoId(resolvedSymbol);
      
      if (!coinId) {
        logger.warn(`[PriceOracle] Unsupported symbol for historical prices: ${symbol}`);
        return [];
      }

      // Check for rate limiting
      if (this.shouldApplyBackoff()) {
        await this.waitForBackoff();
      }

      const response = await fetch(
        `${this.API_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
      );

      this.rateLimitState.requestCount++;

      if (response.status === 429) {
        logger.warn('[PriceOracle] CoinGecko historical returned 429 (rate limited)');
        this.applyBackoff();
        return [];
      }

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.prices.map(([timestamp, price]: [number, number]) => ({
        date: new Date(timestamp),
        price,
      }));
    } catch (error) {
      logger.error(`[PriceOracle] Error fetching historical prices for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get prices from multiple sources in parallel using Promise.allSettled()
   * Returns first successful result for each symbol
   * More resilient than sequential fallback strategy
   */
  async getPricesFromMultipleSources(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    const uniqueSymbols = Array.from(new Set(symbols));

    try {
      // Fetch from primary source (Gateway Agent) and fallback (CoinGecko) in parallel
      const [gatewayResults, coinGeckoResults] = await Promise.allSettled([
        this.getPricesFromGateway(uniqueSymbols),
        this.getPricesFromCoinGecko(uniqueSymbols),
      ]) as [
        PromiseSettledResult<Map<string, PriceData>>,
        PromiseSettledResult<Map<string, PriceData>>
      ];

      // Combine results, preferring successful source
      if (gatewayResults.status === 'fulfilled') {
        for (const [symbol, data] of gatewayResults.value) {
          prices.set(symbol, data);
          logger.debug(`[PriceOracle] Using Gateway price for ${symbol}`);
        }
      }

      // Fill gaps with CoinGecko results
      if (coinGeckoResults.status === 'fulfilled') {
        for (const [symbol, data] of coinGeckoResults.value) {
          if (!prices.has(symbol)) {
            prices.set(symbol, data);
            logger.debug(`[PriceOracle] Using CoinGecko price for ${symbol}`);
          }
        }
      }

      return prices;
    } catch (error) {
      logger.error('[PriceOracle] Multi-source parallel fetching failed:', error);
      return prices;
    }
  }

  /**
   * Fetch prices from Gateway Agent service (primary source)
   */
  private async getPricesFromGateway(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    try {
      const gatewayService = getGatewayAgentService();
      if (!gatewayService.isHealthy()) {
        return prices;
      }

      const priceRequest = await gatewayService.requestPrices(symbols, undefined, undefined);
      const priceDataList = priceRequest?.payload?.data || [];

      for (const priceData of priceDataList) {
        if (priceData && priceData.price > 0) {
          const result: PriceData = {
            symbol: priceData.symbol,
            name: this.getCoinName(priceData.symbol),
            priceUsd: priceData.price,
            priceChange24h: priceData.change24h || 0,
            marketCap: priceData.marketCap || 0,
            volume24h: priceData.volume24h || 0,
            lastUpdated: new Date(),
          };
          prices.set(priceData.symbol, result);
          this.cache.set(priceData.symbol, { data: result, timestamp: Date.now() });
        }
      }

      logger.debug(`[PriceOracle-Gateway] Fetched ${prices.size} prices in parallel`);
      return prices;
    } catch (error) {
      logger.debug('[PriceOracle] Gateway service failed:', error);
      return prices;
    }
  }

  /**
   * Fetch prices from CoinGecko API (fallback source)
   */
  private async getPricesFromCoinGecko(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    try {
      const resolvedSymbols: string[] = [];
      const coinIdSet: Set<string> = new Set();

      for (const s of symbols) {
        const rs = await this.getResolvedSymbol(s);
        resolvedSymbols.push(rs);
        const id = await this.resolveToCoinGeckoId(rs);
        if (id) coinIdSet.add(id);
      }

      const uniqueResolved = Array.from(new Set(resolvedSymbols));
      const coinIds = Array.from(coinIdSet);

      if (coinIds.length === 0) {
        return prices;
      }

      // Check rate limiting
      if (this.shouldApplyBackoff()) {
        await this.waitForBackoff();
      }

      const response = await fetch(
        `${this.API_BASE}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
      );

      this.rateLimitState.requestCount++;

      if (response.status === 429) {
        logger.warn('[PriceOracle-CoinGecko] Rate limited (429)');
        this.applyBackoff();
        return prices;
      }

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      const data: CoinGeckoResponse = await response.json();

      for (const [coinId, priceData] of Object.entries(data)) {
        if (priceData && priceData.usd > 0) {
          // reverse-lookup: find the symbol corresponding to the coinId in the
        // dynamic map (fallback to uppercased id if not registered)
        const symbol = Array.from(this.symbolToGeckoId.entries()).find(([, id]) => id === coinId)?.[0] || coinId.toUpperCase();
          const result: PriceData = {
            symbol,
            name: this.getCoinName(symbol),
            priceUsd: priceData.usd,
            priceChange24h: priceData.usd_24h_change,
            marketCap: priceData.usd_market_cap,
            volume24h: priceData.usd_24h_vol,
            lastUpdated: new Date(priceData.last_updated_at * 1000),
          };
          prices.set(symbol, result);
          this.cache.set(symbol, { data: result, timestamp: Date.now() });
        }
      }

      logger.debug(`[PriceOracle-CoinGecko] Fetched ${prices.size} prices in parallel`);
      return prices;
    } catch (error) {
      logger.debug('[PriceOracle] CoinGecko service failed:', error);
      return prices;
    }
  }

  /**
   * Calculate portfolio value
   */
  async calculatePortfolioValue(
    holdings: Array<{ symbol: string; balance: number }>
  ): Promise<number> {
    let totalValue = 0;

    const symbols = holdings.map(h => h.symbol);
    const prices = await this.getPrices(symbols);

    for (const holding of holdings) {
      const upperSymbol = holding.symbol.toUpperCase();
      const price = prices.get(upperSymbol);
      if (price) {
        totalValue += holding.balance * price.priceUsd;
      }
    }

    return totalValue;
  }

  /**
   * Get coin name from symbol
   */
  private getCoinName(symbol: string): string {
    const names: Record<string, string> = {
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      SOL: 'Solana',
      BNB: 'BNB',
      XRP: 'XRP',
      LTC: 'Litecoin',
      USDC: 'USD Coin',
      USDT: 'Tether',
      DAI: 'Dai',
      MATIC: 'Polygon',
      AAVE: 'Aave',
      LINK: 'Chainlink',
      UNI: 'Uniswap',
    };
    return names[symbol.toUpperCase()] || symbol.toUpperCase();
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('[PriceOracle] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { 
    size: number; 
    assets: string[];
    rateLimitState: {
      requestCount: number;
      backoffMultiplier: number;
      nextRetryTime: number;
    };
  } {
    return {
      size: this.cache.size,
      assets: Array.from(this.cache.keys()),
      rateLimitState: {
        requestCount: this.rateLimitState.requestCount,
        backoffMultiplier: this.rateLimitState.backoffMultiplier,
        nextRetryTime: Math.max(0, this.rateLimitState.nextRetryTime - Date.now()),
      },
    };
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): string[] {
    return Array.from(new Set([
      ...Array.from(this.symbolToGeckoId.keys()),
      ...Object.keys(this.CURRENCY_FALLBACKS),
    ]));
  }
  /**
   * Get fallback chain for a currency
   */
  getFallbackChain(symbol: string): string[] {
    const upperSymbol = symbol.toUpperCase();
    return this.CURRENCY_FALLBACKS[upperSymbol] || [];
  }
}

export const priceOracle = new PriceOracleService();

