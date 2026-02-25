import { logger } from '../utils/logger';
import { getGatewayAgentService } from '../core/agents/gateway/service';

/**
 * Price Oracle Service for Cryptocurrency Prices
 * Features:
 * - Multi-adapter pricing (Gateway Agent + CoinGecko)
 * - Intelligent caching with configurable TTL
 * - Request batching and deduplication
 * - Rate limiting with exponential backoff
 * - Currency fallback strategy
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
  
  // Request batching and deduplication
  private pendingRequests: Map<string, Promise<PriceData | null>> = new Map();
  private requestBatch: Set<string> = new Set();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 100; // ms to wait before sending batch request
  
  // CoinGecko IDs for supported assets
  private readonly COIN_IDS: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana',
    BNB: 'binancecoin',
    XRP: 'ripple',
    LTC: 'litecoin',
    USDC: 'usd-coin',
    USDT: 'tether',
    DAI: 'dai',
    MATIC: 'matic-network',
    AAVE: 'aave',
    LINK: 'chainlink',
    UNI: 'uniswap',
  };

  // Fallback currency hierarchy - if symbol not supported, try fallback
  private readonly CURRENCY_FALLBACKS: Record<string, string[]> = {
    cKES: ['KES', 'USD'], // Celo Kenyan Shilling falls back to KES or USD
    cREAL: ['REAL', 'BRL', 'USD'], // Celo Brazilian Real
    IMXC: ['IMX', 'ETH', 'USDC'], // ImmunefiX
    cUSD: ['USDC', 'USDT', 'DAI'], // Celo USD
    cEUR: ['EUR', 'USDC', 'USDT'], // Celo EUR
    cGLD: ['GLD', 'USD', 'USDC'], // Celo Gold
  };

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
  private getResolvedSymbol(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();
    
    // If symbol is supported directly, use it
    if (this.COIN_IDS[upperSymbol]) {
      return upperSymbol;
    }

    // Try fallback chain
    const fallbacks = this.CURRENCY_FALLBACKS[upperSymbol];
    if (fallbacks && fallbacks.length > 0) {
      for (const fallback of fallbacks) {
        if (this.COIN_IDS[fallback]) {
          logger.debug(`[PriceOracle] Using fallback: ${upperSymbol} -> ${fallback}`);
          return fallback;
        }
      }
    }

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
      // Resolve symbol to supported currency
      const resolvedSymbol = this.getResolvedSymbol(symbol);

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
            const result: PriceData = {
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
      const coinId = this.COIN_IDS[resolvedSymbol];
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
    const resolvedSymbols = remaining.map(s => this.getResolvedSymbol(s));
    const uniqueResolved = Array.from(new Set(resolvedSymbols));
    const coinIds = uniqueResolved
      .map(s => this.COIN_IDS[s])
      .filter(Boolean);

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
        const resolvedSymbol = this.getResolvedSymbol(symbol);
        const coinId = this.COIN_IDS[resolvedSymbol];
        const coinData = data[coinId];

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
      const resolvedSymbol = this.getResolvedSymbol(symbol);
      const coinId = this.COIN_IDS[resolvedSymbol];
      
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
      ...Object.keys(this.COIN_IDS),
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

