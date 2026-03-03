/**
 * Symbol Universe Service
 * 
 * Primary interface for symbol discovery and price management
 * Integrates TokenRegistry with CEX capabilities and price sources
 */

import { tokenRegistry } from './tokenRegistry';
import { ccxtService } from './ccxtService';
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

/**
 * Symbol Universe Service - Single source of truth for symbols
 */
export class SymbolUniverseService extends EventEmitter {
  private priceCache: Map<string, SymbolPrice> = new Map();
  private supportedPairsCache: Map<string, Set<string>> = new Map();
  private allSymbolsCache: Set<string> | null = null;
  private lastDiscovery: Map<string, number> = new Map();

  constructor() {
    super();
    this.initialize();
  }

  /**
   * Initialize service and load cached data
   */
  private initialize(): void {
    logger.info('🔄 Initializing Symbol Universe Service...');

    // Load price cache from cacheManager
    const cachedPrices = cacheManager.getCache('symbol_prices');
    if (cachedPrices) {
      logger.info('✅ Loaded price cache');
    }

    // Initialize supported pairs from config
    const cexSources = SYMBOL_UNIVERSE_CONFIG.priceSources.cex;
    Object.keys(cexSources).forEach((exchange: string): void => {
      this.supportedPairsCache.set(exchange, new Set());
    });

    logger.info('✅ Symbol Universe Service ready');
  }

  /**
   * Get all supported symbols from registry
   */
  getAllSymbols(): string[] {
    if (this.allSymbolsCache) {
      return Array.from(this.allSymbolsCache);
    }

    // Get from token registry
    const tokens = tokenRegistry.getAllTokens();
    this.allSymbolsCache = new Set(tokens.map((t: any) => (t as any).symbol));

    return Array.from(this.allSymbolsCache);
  }

  /**
   * Discover supported pairs for an exchange
   * Returns only pairs that actually exist on that exchange
   */
  async discoverSupportedPairs(exchange: string): Promise<string[]> {
    const cached = this.supportedPairsCache.get(exchange);
    const lastDiscoveryTime = this.lastDiscovery.get(exchange) || 0;
    const cacheTTL = SYMBOL_UNIVERSE_CONFIG.cache.ttl.supported_pairs;

    // Return cached if fresh
    if (cached && cached.size > 0 && Date.now() - lastDiscoveryTime < cacheTTL) {
      return Array.from(cached);
    }

    try {
      const cexConfig = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as any;
      const exchangeConfig = cexConfig[exchange];
      if (!exchangeConfig || !exchangeConfig.enabled) {
        logger.warn(`[SymbolUniverse] Exchange ${exchange} disabled or not configured`);
        return [];
      }

      logger.info(`[SymbolUniverse] Discovering supported pairs on ${exchange}...`);

      // Get all available markets from exchange
      const markets = await ccxtService.getMarkets(exchange);
      logger.info(`[SymbolUniverse] raw markets count for ${exchange}: ${markets.length}`);
      if (!markets || markets.length === 0) {
        logger.warn(`[SymbolUniverse] No markets found for ${exchange}`);
        return [];
      }

      // Filter to supported quotes
      const supportedPairs = new Set<string>();
      const primaryQuotes = (exchangeConfig as any).supportedQuotes || ['USDT', 'USD', 'USDC'];

      // Build supported pairs from markets
      for (const market of markets) {
        const symbol = (market as any).symbol.toUpperCase();
        const [base, quote] = symbol.split('/');

        // Accept if quote matches primary quote currencies
        if (primaryQuotes.some((pq: string) => quote === pq)) {
          supportedPairs.add(symbol);
        }
      }

      // Cache the discovered pairs
      this.supportedPairsCache.set(exchange, supportedPairs);
      this.lastDiscovery.set(exchange, Date.now());

      logger.info(`[SymbolUniverse] Supported pairs for ${exchange}: ${Array.from(supportedPairs).slice(0,10).join(', ')} (total ${supportedPairs.size})`);
      return Array.from(supportedPairs);
    } catch (error: any) {
      logger.error(`[SymbolUniverse] Discovery failed for ${exchange}:`, error.message);
      return [];
    }
  }

  /**
   * Get supported pairs for exchange (with fallbacks)
   */
  async getSupportedPairs(exchange: string): Promise<string[]> {
    const supported = await this.discoverSupportedPairs(exchange);

    if (supported.length === 0) {
      // Fallback to common pairs with USDT quote
      const commonSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'AVAX', 'MATIC'];
      return commonSymbols.map(s => `${s}/USDT`);
    }

    return supported;
  }

  /**
   * Get top N symbols by volume for an exchange
   */
  async getTopByVolume(
    exchange: string,
    limit: number = 100
  ): Promise<{ symbol: string; volume24h: number }[]> {
    try {
      const pairs = await this.getSupportedPairs(exchange);

      // Would fetch volume data from exchange or price oracle
      // For now, return supported pairs with placeholder volume
      return pairs.slice(0, limit).map((pair, idx) => ({
        symbol: pair,
        volume24h: Math.random() * 1000000000 // Placeholder
      }));
    } catch (error: any) {
      logger.error(`[SymbolUniverse] Failed to get top by volume for ${exchange}:`, error.message);
      return [];
    }
  }

  /**
   * Get price for symbol from best available source
   */
  async getPrice(
    symbol: string,
    quote: string = 'USD'
  ): Promise<SymbolPrice | null> {
    const pair = `${symbol}/${quote}`;
    const cacheKey = `price:${pair}`;

    // Check cache first
    const cached = this.priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached;
    }

    // Try price sources in priority order
    const cexSources = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;
    
    // Try each exchange in order
    for (const exchangeName of Object.keys(cexSources)) {
      const exchange = cexSources[exchangeName];
      if (!exchange.enabled) continue;

      try {
        const ticker = await (ccxtService as any).getTickerFromExchange(exchangeName, pair);
        if (ticker) {
          const priceValue = (ticker as any).last || (ticker as any).bid || 0;
          const price: SymbolPrice = {
            symbol,
            quote,
            price: priceValue,
            source: 'cex',
            exchange: exchangeName,
            timestamp: Date.now(),
            change24h: (ticker as any).percentage,
            volume24h: (ticker as any).quoteVolume
          };
          this.priceCache.set(cacheKey, price);
          this.emit('price-update', { symbol, price: price.price, source: 'cex', timestamp: Date.now() });
          return price;
        }
      } catch (error) {
        logger.debug(`[SymbolUniverse] ${exchangeName} unavailable for ${pair}`);
        continue;
      }
    }

    // Fallback to CoinGecko oracle
    try {
      const priceByCoin = await (priceOracle as any).getPrice(symbol);
      if (priceByCoin && typeof priceByCoin === 'number') {
        const price: SymbolPrice = {
          symbol,
          quote,
          price: priceByCoin,
          source: 'coingecko',
          timestamp: Date.now()
        };
        this.priceCache.set(cacheKey, price);
        return price;
      } else if (priceByCoin && typeof priceByCoin === 'object') {
        // Handle case where it returns an object with price
        const priceValue = (priceByCoin as any).price || (priceByCoin as any).usd || 0;
        if (priceValue) {
          const price: SymbolPrice = {
            symbol,
            quote,
            price: priceValue,
            source: 'coingecko',
            timestamp: Date.now()
          };
          this.priceCache.set(cacheKey, price);
          return price;
        }
      }
    } catch (error) {
      logger.debug(`[SymbolUniverse] CoinGecko failed for ${symbol}`);
    }

    logger.warn(`[SymbolUniverse] No price available for ${pair}`);
    return null;
  }

  /**
   * Get fallback pairs for symbol on exchange
   */
  public getFallbackPairs(pair: string, exchange: string): string[] {
    const cexConfig = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;
    const exchangeConfig = cexConfig[exchange];
    
    if (exchangeConfig?.pairFallbacks?.[pair]) {
      return [exchangeConfig.pairFallbacks[pair]];
    }
    
    // Default fallback: try with USD if pair uses USDT
    if (pair.endsWith('/USDT')) {
      return [pair.replace('/USDT', '/USD')];
    }
    
    return [];
  }

  /**
   * Subscribe to price updates
   */
  onPriceUpdate(callback: (update: PriceUpdate) => void): void {
    this.on('price-update', callback);
  }

  /**
   * Get symbol metadata from token registry
   */
  getSymbolMetadata(symbol: string) {
    const tokens = tokenRegistry.getAllTokens();
    return tokens.find((t: any) => t.symbol === symbol);
  }

  /**
   * Get symbols by category
   */
  getSymbolsByCategory(category: string): string[] {
    try {
      const tokens = (tokenRegistry as any).getTokensByCategory?.(category) || [];
      return tokens.map((t: any) => (t as any).symbol);
    } catch (error) {
      logger.debug(`[SymbolUniverse] Could not get tokens by category ${category}`);
      return [];
    }
  }

  /**
   * Get symbols by chain
   */
  getSymbolsByChain(chain: string): string[] {
    try {
      const tokens = (tokenRegistry as any).getTokensByChain?.(chain) || [];
      return tokens.map((t: any) => (t as any).symbol);
    } catch (error) {
      logger.debug(`[SymbolUniverse] Could not get tokens by chain ${chain}`);
      return [];
    }
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.priceCache.clear();
    this.supportedPairsCache.forEach(set => set.clear());
    this.allSymbolsCache = null;
    this.lastDiscovery.clear();
    logger.info('✅ Symbol Universe caches cleared');
  }

  /**
   * Get service statistics
   */
  getStats(): Record<string, any> {
    return {
      cachedPrices: this.priceCache.size,
      cachedExchanges: Array.from(this.supportedPairsCache.keys()).reduce((acc: Record<string, number>, key: string) => {
        const pairs = this.supportedPairsCache.get(key);
        acc[key] = pairs?.size || 0;
        return acc;
      }, {} as Record<string, number>),
      lastDiscoveryTimes: Object.fromEntries(this.lastDiscovery)
    };
  }
}

/**
 * Singleton instance
 */
export const symbolUniverseService = new SymbolUniverseService();
