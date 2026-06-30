/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OHLCV SERVICE - Foundation Layer
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * **Central Data Source for All Asset Intelligence**
 * 
 * This service is the fundamental base layer that all other asset operations
 * depend upon: Symbol Universe, Asset Intelligence Engine, Indicators, NURU, KWETU.
 * 
 * Every asset or instrument that exchanges data with the platform sources 
 * historical data through this service.
 * 
 * **Architecture:**
 * OHLCV Service (this file)
 *   ├── Symbol Universe (asset-context + metadata)
 *   ├── AssetStateEngine (market-state + intelligence)
 *   ├── Indicators Library (technical analysis)
 *   ├── NURU Cognitive Engine (portfolio analysis)
 *   └── KWETU Operations Engine (execution risk)
 * 
 * **Key Properties:**
 * • Direct CCXT integration (no bridges, no mock data)
 * • Unified caching strategy (all services share same cache)
 * • Foundation for price normalization across chains
 * • Data source registry (which exchanges supply data)
 * • Chain-pair-timeframe relationships (asset graph)
 * 
 * **No Python dependency. Single source of truth for historical data.**
 * 
 * Supersedes: backend/routes/market_data.py (v0.1 - mock implementation)
 * Version: 2.0 (Central Foundation Layer)
 */

import { ccxtService } from './ccxtService';
import { cacheService } from './cacheService';
import { logger } from '../utils/logger';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INTERFACES: Data Structures for Foundation Layer
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export interface OHLCVCandle {
  timestamp: number;          // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;             // Base asset volume
  volume_quote: number;       // Quote asset volume (USD equivalent)
  trades?: number;            // Number of trades in this candle
}

export interface OHLCVResponse {
  status: 'success' | 'error';
  symbol: string;
  pair: string;
  chain?: string;             // Track which chain this pair is from
  timeframe: string;
  exchange?: string;          // Which exchange provided this data
  total_candles: number;
  from: number;               // Start timestamp
  to: number;                 // End timestamp
  data: OHLCVCandle[];
  cached?: boolean;           // Was this served from cache?
  dataSource?: 'ccxt' | 'database' | 'cache';
  fetchedAt?: number;         // When data was fetched
  error?: string;
}

/**
 * Asset context enriched with OHLCV data
 * This is what Symbol Universe uses to understand an asset
 */
export interface AssetContext {
  symbol: string;
  name: string;
  category: string;
  
  // OHLCV-based metrics
  // Used by Symbol Universe to classify risk, liquidity, stability
  priceData: {
    current?: number;
    high24h?: number;
    low24h?: number;
    volatility24h?: number;
  };
  
  // Historical pattern recognition
  // Used by NURU to understand asset behavior
  technicalProfile: {
    trend?: 'uptrend' | 'downtrend' | 'sideways';
    volatilityRegime?: 'low' | 'normal' | 'high' | 'extreme';
    liquidityQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  };
  
  // Data sourcing metadata
  // Track which exchanges have this asset
  dataSources: {
    exchanges: string[];          // ['binance', 'kraken', 'coinbase']
    primaryExchange: string;
    candleAvailability: string[]; // ['1m', '5m', '15m', '1h', '4h', '1d']
    lastUpdated: number;
  };
}

/**
 * Registry of which assets/pairs are available on which exchanges
 * Central index for Symbol Universe to discover assets
 */
export interface DataSourceRegistry {
  symbol: string;
  pairs: Array<{
    pair: string;               // e.g., "SOL/USDT"
    exchange: string;
    quoteCurrency: string;      // e.g., "USDT"
    minOrder?: number;
    hasOHLCV: boolean;          // Can we fetch candles for this?
    lastVerified: number;       // Timestamp of last verification
  }>;
}

class OHLCVService {
  private readonly CACHE_TTL = 60000; // 1 minute for live data
  private readonly LONG_CACHE_TTL = 300000; // 5 minutes for historical
  
  // Registry of data sources (built up as we discover assets)
  private dataSourceRegistry: Map<string, DataSourceRegistry> = new Map();
  
  // Track which exchanges have OHLCV available (cache it)
  private exchangeCapabilities: Map<string, Set<string>> = new Map();

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * FOUNDATION METHODS: Called by Symbol Universe, AssetStateEngine, etc.
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * PRIMARY: Get OHLCV candles for a symbol/timeframe
   * Direct TypeScript implementation using CCXT
   * 
   * Called by:
   * • Symbol Universe (building asset context)
   * • AssetStateEngine (computing market state)
   * • Indicators library (technical analysis)
   * • NURU (portfolio composition analysis)
   * • KWETU (execution risk scoring)
   * 
   * Returns: Complete response with metadata for every consumer
   * Price: Must be <1s for cached data, <2s for fresh fetch
   */
  async getCandles(
    symbol: string,
    timeframe: string = '5m',
    limit: number = 100,
    exchange: string = 'binance'
  ): Promise<OHLCVResponse> {
    const cacheKey = `ohlcv:${symbol}:${timeframe}:${limit}:${exchange}`;
    
    try {
      // Check cache first
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug(`OHLCV cache hit for ${symbol}/${timeframe}`);
        return { ...cached, cached: true, dataSource: 'cache' };
      }

      logger.info(`Fetching OHLCV candles: ${symbol}/${timeframe} (${limit} candles)`);

      // Validate timeframe
      if (!this.isValidTimeframe(timeframe)) {
        return {
          status: 'error',
          symbol,
          pair: symbol,
          timeframe,
          total_candles: 0,
          from: 0,
          to: 0,
          data: [],
          dataSource: 'ccxt',
          error: `Invalid timeframe: ${timeframe}. Supported: 1m, 5m, 15m, 1h, 4h, 1d`
        };
      }

      // Fetch from CCXT via CCXT service (exchange-specific)
      const candles = await ccxtService.getOHLCVFromExchange(exchange, symbol, timeframe, limit);

      if (!candles || candles.length === 0) {
        logger.warn(`No OHLCV data returned for ${symbol}/${timeframe}`);
        return {
          status: 'error',
          symbol,
          pair: symbol,
          timeframe,
          total_candles: 0,
          from: 0,
          to: 0,
          data: [],
          dataSource: 'ccxt',
          error: `No data available for ${symbol}/${timeframe} on ${exchange}`
        };
      }

      // Transform CCXT format to our format
      const transformed = this.transformCCXTCandles(candles);

      // Update data source registry
      this.registerDataSource(symbol, exchange);

      // Build response
      const response: OHLCVResponse = {
        status: 'success',
        symbol,
        pair: symbol,
        timeframe,
        exchange,
        total_candles: transformed.length,
        from: transformed[0]?.timestamp || 0,
        to: transformed[transformed.length - 1]?.timestamp || 0,
        data: transformed,
        dataSource: 'ccxt',
        fetchedAt: Date.now()
      };

      // Cache the result
      const ttl = limit <= 100 ? this.CACHE_TTL : this.LONG_CACHE_TTL;
      await cacheService.set(cacheKey, response, ttl);

      return response;
    } catch (error) {
      logger.error(`OHLCV fetch error for ${symbol}:`, error);
      return {
        status: 'error',
        symbol,
        pair: symbol,
        timeframe,
        total_candles: 0,
        from: 0,
        to: 0,
        data: [],
        dataSource: 'ccxt',
        error: `Failed to fetch OHLCV: ${(error as Error).message}`
      };
    }
  }

  /**
   * ASSET ENGINE SUPPORT: Get 24h high/low for a symbol
   * Derived from OHLCV data
   * 
   * Called by AssetStateEngine to populate marketState.price
   */
  async get24hHighLow(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<{ high24h: number; low24h: number; timestamp: number } | null> {
    try {
      // Get 288 5-minute candles = 24 hours
      const response = await this.getCandles(symbol, '5m', 288, exchange);
      
      if (response.status === 'error' || response.data.length === 0) {
        return null;
      }

      const high24h = Math.max(...response.data.map(c => c.high));
      const low24h = Math.min(...response.data.map(c => c.low));
      const timestamp = Date.now();

      return { high24h, low24h, timestamp };
    } catch (error) {
      logger.error(`Failed to calculate 24h high/low for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get volatility from historical candles
   * Standard deviation of returns
   */
  async getVolatility(
    symbol: string,
    timeframe: string = '1h',
    periods: number = 24 // 24 hours
  ): Promise<{ current: number; trend: 'increasing' | 'stable' | 'decreasing' } | null> {
    try {
      const response = await this.getCandles(symbol, timeframe, periods);
      
      if (response.status === 'error' || response.data.length < 2) {
        return null;
      }

      const closes = response.data.map(c => c.close);
      
      // Calculate returns
      const returns: number[] = [];
      for (let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }

      // Calculate standard deviation (volatility)
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance) * 100; // Convert to percentage

      // Determine trend (compare first half vs second half volatility)
      const mid = Math.floor(returns.length / 2);
      const firstHalfVar = returns.slice(0, mid).reduce((a, b) => a + Math.pow(b - mean, 2), 0) / mid;
      const secondHalfVar = returns.slice(mid).reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - mid);
      
      let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
      if (secondHalfVar > firstHalfVar * 1.1) trend = 'increasing';
      if (secondHalfVar < firstHalfVar * 0.9) trend = 'decreasing';

      return { current: volatility, trend };
    } catch (error) {
      logger.error(`Failed to calculate volatility for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get volume metrics from candles
   */
  async getVolumeMetrics(
    symbol: string,
    timeframe: string = '1h',
    periods: number = 24
  ): Promise<{ volume24h: number; avgVolume: number; trend: string } | null> {
    try {
      const response = await this.getCandles(symbol, timeframe, periods);
      
      if (response.status === 'error' || response.data.length === 0) {
        return null;
      }

      const volumes = response.data.map(c => c.volume_quote || c.volume);
      const volume24h = volumes.reduce((a, b) => a + b, 0);
      const avgVolume = volume24h / volumes.length;

      // Trend: is recent volume higher or lower than average?
      const recentVolume = volumes.slice(-6).reduce((a, b) => a + b, 0) / 6;
      const trend = recentVolume > avgVolume ? 'increasing' : 'decreasing';

      return { volume24h, avgVolume, trend };
    } catch (error) {
      logger.error(`Failed to calculate volume metrics for ${symbol}:`, error);
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  private isValidTimeframe(tf: string): boolean {
    return ['1m', '5m', '15m', '1h', '4h', '1d'].includes(tf);
  }

  /**
   * Transform CCXT OHLCV format to our format
   * CCXT returns: [timestamp, open, high, low, close, volume, ...]
   */
  private transformCCXTCandles(ccxtCandles: any[][]): OHLCVCandle[] {
    return ccxtCandles.map(candle => ({
      timestamp: Math.floor(candle[0] / 1000), // Convert ms to seconds
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
      volume_quote: candle[6] || candle[5] * candle[4], // Fallback: volume * close
      trades: candle[7] || undefined
    }));
  }

  /**
   * SYMBOL UNIVERSE SUPPORT: Enrich asset with OHLCV-based context
   * 
   * Called by Symbol Universe when classifying an asset.
   * Returns: AssetContext with all OHLCV-derived metrics for classification
   * 
   * This tells Symbol Universe:
   * • What price data we have for this asset
   * • How volatile it typically is (affects risk classification)
   * • What exchanges carry it (affects trust/liquidity metrics)
   * • What technical profile we observe (affects category suggestions)
   */
  async enrichAssetContext(
    symbol: string,
    primaryExchange: string = 'binance'
  ): Promise<AssetContext | null> {
    try {
      // Fetch fresh data (symbol universe needs current context)
      const candles5m = await this.getCandles(symbol, '5m', 288, primaryExchange);   // 24h of 5m data
      const candles1h = await this.getCandles(symbol, '1h', 168, primaryExchange);   // 7d of 1h data
      
      if (candles5m.status === 'error' || candles1h.status === 'error') {
        return null;
      }

      // Calculate price metrics
      const highLow = await this.get24hHighLow(symbol, primaryExchange);
      const volatility = await this.getVolatility(symbol, '1h', 24);

      // Analyze trend and liquidity
      const trend = this.detectTrend(candles1h.data);
      const volatilityRegime = this.classifyVolatilityRegime(volatility?.current || 0);
      const liquidityQuality = this.assessLiquidityQuality(candles5m.data);

      return {
        symbol,
        name: symbol, // Will be enriched by Symbol Universe with real name
        category: 'unknown', // Will be determined by Symbol Universe
        
        priceData: {
          current: candles5m.data[candles5m.data.length - 1]?.close || 0,
          high24h: highLow?.high24h,
          low24h: highLow?.low24h,
          volatility24h: volatility?.current
        },

        technicalProfile: {
          trend,
          volatilityRegime,
          liquidityQuality
        },

        dataSources: {
          exchanges: Array.from(this.dataSourceRegistry.get(symbol)?.pairs.map(p => p.exchange) || [primaryExchange]),
          primaryExchange,
          candleAvailability: ['1m', '5m', '15m', '1h', '4h', '1d'],
          lastUpdated: Date.now()
        }
      };
    } catch (error) {
      logger.error(`Failed to enrich asset context for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * SYMBOL UNIVERSE SUPPORT: Discover available pairs for an asset
   * 
   * Called by Symbol Universe during asset discovery phase.
   * Returns: Which exchanges have OHLCV data available for this symbol
   * 
   * This enables Symbol Universe to:
   * • Build data source registry
   * • Understand cross-exchange liquidity
   * • Classify assets by availability (tape presence)
   */
  async discoverAvailablePairs(
    symbol: string,
    exchanges: string[] = ['binance', 'kraken', 'coinbase']
  ): Promise<DataSourceRegistry> {
    // This method is deprecated for bulk discovery — prefer seeding via MarketUniverseBuilder
    // For backward compatibility, return any cached registry or an empty result.
    const cached = this.dataSourceRegistry.get(symbol);
    if (cached) return cached;

    logger.warn('[OHLCV] discoverAvailablePairs() is deprecated — use marketUniverseBuilder to seed registry');
    const registry: DataSourceRegistry = { symbol, pairs: [] };
    this.dataSourceRegistry.set(symbol, registry);
    return registry;
  }

  /**
   * MULTI-CONSUMER API: Get all available timeframes for a symbol
   * 
   * Returns: Which candle timeframes CCXT supports for this symbol
   * Used by Symbol Universe to understand data completeness
   */
  getAvailableTimeframes(): string[] {
    return ['1m', '5m', '15m', '1h', '4h', '1d']; // Standard supported timeframes
  }

  /**
   * DATA SOURCE QUERY: Which exchanges provide data for this symbol?
   * 
   * Called by Symbol Universe and AssetStateEngine to:
   * • Verify data availability
   * • Choose primary vs fallback exchange
   * • Understand liquidity distribution
   */
  getDataSourceRegistry(symbol: string): DataSourceRegistry | undefined {
    return this.dataSourceRegistry.get(symbol);
  }

  /**
   * SYMBOL UNIVERSE SUPPORT: Get price-based classification hints
   * 
   * Returns data that helps Symbol Universe classify the asset category
   * Example: Very high volatility → probably 'meme_token' or 'experimental'
   */
  async getPriceClassificationHints(symbol: string): Promise<{
    avgPriceUSD: number;
    volatilityScore: number;  // 0-100
    marketCapCategory: 'mega' | 'large' | 'mid' | 'small' | 'micro';
    liquidityCategory: 'excellent' | 'good' | 'fair' | 'poor';
  } | null> {
    try {
      const candles = await this.getCandles(symbol, '1h', 24);
      if (candles.status === 'error') return null;

      const closes = candles.data.map(c => c.close);
      const avgPrice = closes.reduce((a, b) => a + b) / closes.length;
      const volatility = await this.getVolatility(symbol, '1h', 24);

      // Try to get market cap from PriceOracle first
      let marketCapEstimate: number | null = null;
      let confidence: 'high' | 'medium' | 'low' = 'low';
      try {
        const { priceOracle } = await import('./priceOracle');
        const prices = await priceOracle.getPrices([symbol]);
        const pd = prices.get(symbol.toUpperCase()) || prices.get(symbol);
        if (pd && pd.marketCap && pd.marketCap > 0) {
          marketCapEstimate = pd.marketCap;
          confidence = 'high';
        }
      } catch (err) {
        // ignore - best-effort
      }

      if (!marketCapEstimate) {
        // Heuristic fallback: estimate based on recent quote volume
        const avgVolume = candles.data.reduce((sum, c) => sum + (c.volume_quote || c.volume), 0) / candles.data.length;
        marketCapEstimate = avgVolume * 50; // heuristic multiplier
        confidence = 'low';
      }

      return {
        avgPriceUSD: avgPrice,
        volatilityScore: volatility?.current || 0,
        marketCapCategory: this.categorizeMarketCapByValue(marketCapEstimate),
        liquidityCategory: this.categorizeLiquidity(candles.data)
      };
    } catch (error) {
      logger.error(`Failed to get classification hints for ${symbol}:`, error);
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  private registerDataSource(symbol: string, exchange: string): void {
    if (!this.exchangeCapabilities.has(symbol)) {
      this.exchangeCapabilities.set(symbol, new Set());
    }
    this.exchangeCapabilities.get(symbol)!.add(exchange);
  }

  private categorizeMarketCapByValue(marketCap: number): 'mega' | 'large' | 'mid' | 'small' | 'micro' {
    if (marketCap > 500e9) return 'mega';        // > $500B
    if (marketCap > 50e9) return 'large';        // > $50B
    if (marketCap > 5e9) return 'mid';           // > $5B
    if (marketCap > 500e6) return 'small';       // > $500M
    return 'micro';                              // < $500M
  }

  private categorizeLiquidity(candles: OHLCVCandle[]): 'excellent' | 'good' | 'fair' | 'poor' {
    const avgVolume = candles.reduce((sum, c) => sum + c.volume_quote, 0) / candles.length;
    if (avgVolume > 1000000) return 'excellent';
    if (avgVolume > 100000) return 'good';
    if (avgVolume > 10000) return 'fair';
    return 'poor';
  }

  private detectTrend(candles: OHLCVCandle[]): 'uptrend' | 'downtrend' | 'sideways' {
    if (candles.length < 2) return 'sideways';
    
    const firstClose = candles[0].close;
    const lastClose = candles[candles.length - 1].close;
    const change = (lastClose - firstClose) / firstClose;

    if (change > 0.02) return 'uptrend';
    if (change < -0.02) return 'downtrend';
    return 'sideways';
  }

  private classifyVolatilityRegime(volatilityPercent: number): 'low' | 'normal' | 'high' | 'extreme' {
    if (volatilityPercent < 1) return 'low';
    if (volatilityPercent < 3) return 'normal';
    if (volatilityPercent < 8) return 'high';
    return 'extreme';
  }

  private assessLiquidityQuality(candles: OHLCVCandle[]): 'excellent' | 'good' | 'fair' | 'poor' {
    const avgSpread = candles.reduce((sum, c) => {
      const spread = (c.high - c.low) / c.close;
      return sum + spread;
    }, 0) / candles.length;

    if (avgSpread < 0.001) return 'excellent'; // <0.1% avg spread
    if (avgSpread < 0.003) return 'good';       // <0.3% avg spread
    if (avgSpread < 0.01) return 'fair';        // <1% avg spread
    return 'poor';
  }

  /**
   * Clear cache for a symbol
   */
  async clearCache(symbol: string): Promise<void> {
    const keys = [
      `ohlcv:${symbol}:1m:*`,
      `ohlcv:${symbol}:5m:*`,
      `ohlcv:${symbol}:15m:*`,
      `ohlcv:${symbol}:1h:*`,
      `ohlcv:${symbol}:4h:*`,
      `ohlcv:${symbol}:1d:*`,
    ];
    
    for (const key of keys) {
      await cacheService.delete(key);
    }
    
    logger.info(`Cleared OHLCV cache for ${symbol}`);
  }
}

export const ohlcvService = new OHLCVService();
