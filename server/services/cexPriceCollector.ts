/**
 * CEX Price Collection Service
 * Fetches prices from multiple CEX exchanges
 * 
 * Features:
 * - Multi-exchange support via CCXT
 * - Error handling and retry logic
 * - Background collection
 * - Database persistence
 * - Cache integration
 */

import ccxt from 'ccxt';
import { CEXPriceRepository } from '../repositories/cexPriceRepository';
import { cacheManager } from '../core/consolidation/DataCacheConsolidation';
import { Pool } from 'pg';

export interface PriceData {
  exchange: string;
  tradingPair: string;
  price: string;
  bid: string;
  ask: string;
  volume: string;
  timestamp: number;
}

export interface CollectionResult {
  success: boolean;
  exchange: string;
  pairsProcessed: number;
  pairsFailed: number;
  duration: number;
  error?: string;
}

/**
 * Supported exchanges with their CCXT identifiers
 */
const SUPPORTED_EXCHANGES = {
  binance: 'binance',
  kraken: 'kraken',
  coinbase: 'coinbase',
  bybit: 'bybit',
  kucoin: 'kucoin',
  okx: 'okx',
} as const;

/**
 * Default trading pairs to track
 */
const DEFAULT_TRADING_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'ADA/USDT',
  'XRP/USDT',
  'DOGE/USDT',
  'MATIC/USDT',
  'AVAX/USDT',
  'LINK/USDT',
];

/**
 * Symbol normalization formats to try when a pair fails
 * Different exchanges support different quote currencies
 */
const SYMBOL_FORMATS = (base: string, quote: string) => [
  `${base}/${quote}`,           // MATIC/USDT
  `${base}/${quote.slice(0, 3)}`, // MATIC/USD (if quote is USDT)
  `${base}/${quote.toUpperCase()}`, // Ensure uppercase
];

/**
 * Exchange-specific symbol mappings for pairs that have different formats
 * Key: originalPair, Value: { exchange: [alternative formats] }
 */
const EXCHANGE_SYMBOL_MAPS: Record<string, Record<string, string[]>> = {
  'MATIC/USDT': {
    // Most exchanges have MATIC/USDT, no alternatives needed
  },
  'BTC/USDT': {},
  'ETH/USDT': {},
  // Add more as needed based on actual exchange support
};

export class CEXPriceCollector {
  private db: Pool;
  private cache: any; // Reference to cacheManager's cex_prices cache
  private activeCollections: Set<string> = new Set();
  private lastCollectionTime: Map<string, number> = new Map();
  private collectionErrors: Map<string, number> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  constructor(db: Pool) {
    this.db = db;
    this.cache = cacheManager.getCache('cex_prices');
  }

  /**
   * Fetch prices for a specific exchange and trading pairs
   */
  async fetchExchangePrices(
    exchange: keyof typeof SUPPORTED_EXCHANGES,
    tradingPairs?: string[]
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    const pairs = tradingPairs || DEFAULT_TRADING_PAIRS;
    const COLLECTION_TIMEOUT = 90000; // 90 seconds max per exchange

    // Prevent concurrent collection for same exchange
    if (this.activeCollections.has(exchange)) {
      return {
        success: false,
        exchange,
        pairsProcessed: 0,
        pairsFailed: 0,
        duration: 0,
        error: 'Collection already in progress for this exchange',
      };
    }

    this.activeCollections.add(exchange);
    
    // Auto-cleanup stuck collections after timeout
    const timeoutHandle = setTimeout(() => {
      if (this.activeCollections.has(exchange)) {
        console.warn(`[CEXPriceCollector] Force-clearing stuck collection for ${exchange}`);
        this.activeCollections.delete(exchange);
      }
    }, COLLECTION_TIMEOUT);

    try {
      const exchangeClass = (ccxt as any)[SUPPORTED_EXCHANGES[exchange]];
      if (!exchangeClass) {
        throw new Error(`Unsupported exchange: ${exchange}`);
      }

      const client = new exchangeClass({
        enableRateLimit: true,
        timeout: 10000,
      });

      let processedCount = 0;
      let failedCount = 0;
      const results: PriceData[] = [];

      // Fetch prices for each pair
      for (const pair of pairs) {
        try {
          // Try to fetch price for this pair
          const ticker: any = await this.fetchWithNormalization(client, pair);

          if (!ticker) {
            // Pair not available on this exchange - silently skip
            failedCount++;
            continue;
          }

          if (!ticker.last) {
            failedCount++;
            continue;
          }

          const priceData: PriceData = {
            exchange,
            tradingPair: pair,
            price: ticker.last.toString(),
            bid: (ticker.bid || ticker.last).toString(),
            ask: (ticker.ask || ticker.last).toString(),
            volume: (ticker.quoteVolume || 0).toString(),
            timestamp: Date.now(),
          };

          results.push(priceData);
          processedCount++;

          // Update cache immediately
          this.cache.setPrice(exchange, pair, {
            price: priceData.price,
            bid: priceData.bid,
            ask: priceData.ask,
            volume: priceData.volume,
            timestamp: priceData.timestamp,
          });
        } catch (error: any) {
          // Silently skip missing pairs - only log actual network/API errors
          const isMissingPair = 
            error.code === 'BadSymbol' || 
            error.message?.includes('does not have market symbol') ||
            error.message?.includes('Invalid pair') ||
            error.message?.includes('not found');
          
          if (!isMissingPair) {
            console.error(`[CEXPriceCollector] Error fetching ${exchange}:${pair}:`, error.message);
          }
          failedCount++;
        }
      }

      // Persist to database
      if (results.length > 0) {
        await this.persistPrices(results);
      }

      // Update collection stats
      this.lastCollectionTime.set(exchange, Date.now());
      this.collectionErrors.set(exchange, 0); // Reset error count

      const duration = Date.now() - startTime;

      return {
        success: true,
        exchange,
        pairsProcessed: processedCount,
        pairsFailed: failedCount,
        duration,
      };
    } catch (error) {
      const errorCount = (this.collectionErrors.get(exchange) || 0) + 1;
      this.collectionErrors.set(exchange, errorCount);

      const duration = Date.now() - startTime;

      console.error(`[CEXPriceCollector] Collection failed for ${exchange}:`, error);

      return {
        success: false,
        exchange,
        pairsProcessed: 0,
        pairsFailed: pairs.length,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      clearTimeout(timeoutHandle);
      this.activeCollections.delete(exchange);
    }
  }

  /**
   * Fetch prices for all supported exchanges
   */
  async fetchAllExchanges(tradingPairs?: string[]): Promise<CollectionResult[]> {
    const results: CollectionResult[] = [];

    for (const exchange of Object.keys(SUPPORTED_EXCHANGES)) {
      const result = await this.fetchExchangePrices(
        exchange as keyof typeof SUPPORTED_EXCHANGES,
        tradingPairs
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Fetch ticker with symbol normalization for different exchanges
   * Silently returns null if pair is not available on the exchange
   * 
   * 🔴 CCXT API CALL LOCATION #1 (TypeScript)
   * See: CCXT_API_CALL_MAPPING.md for redundancy analysis
   */
  private async fetchWithNormalization(client: any, originalPair: string): Promise<any | null> {
    try {
      // Try primary format only - if it fails with BadSymbol, return null
      return await this.fetchWithRetry(() => client.fetchTicker(originalPair));
    } catch (error: any) {
      // Check if it's a "pair not available" error
      const isMissingPair = 
        error.code === 'BadSymbol' || 
        error.message?.includes('does not have market symbol') ||
        error.message?.includes('Invalid pair') ||
        error.message?.includes('not found');
      
      if (isMissingPair) {
        // Pair doesn't exist on this exchange - return null silently
        return null;//i want to add an alternative to make it intelligent and swich format
        
      }
      
      // For other errors (network, API rate limit, etc.), propagate them
      throw error;
    }
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await this.delay(this.RETRY_DELAY);
        return this.fetchWithRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Persist prices to database
   */
  private async persistPrices(prices: PriceData[]): Promise<void> {
    try {
      for (const price of prices) {
        await CEXPriceRepository.createPrice(
          price.exchange,
          price.tradingPair,
          price.price,
          price.bid,
          price.ask,
          price.volume
        );
      }
    } catch (error: any) {
      // Ignore table-doesn't-exist errors (code 42P01)
      if (error.code === '42P01') {
        // Table doesn't exist yet - this is OK, cache is still active
        return;
      }
      console.error('[CEXPriceCollector] Database persistence error:', error);
      // Don't throw - cache already updated
    }
  }

  /**
   * Get price from cache or database
   */
  async getPrice(
    exchange: string,
    tradingPair: string,
    useCache: boolean = true
  ): Promise<PriceData | null> {
    // Try cache first if enabled
    if (useCache) {
      const cachedPrice = this.cache.getPrice(exchange, tradingPair);
      if (cachedPrice) {
        return {
          exchange,
          tradingPair,
          price: cachedPrice.price,
          bid: cachedPrice.bid,
          ask: cachedPrice.ask,
          volume: cachedPrice.volume,
          timestamp: cachedPrice.timestamp,
        };
      }
    }

    // Fall back to database
    try {
      const result = await this.db.query(
        `SELECT * FROM cex_prices 
         WHERE exchange = $1 AND trading_pair = $2 
         ORDER BY timestamp DESC LIMIT 1`,
        [exchange, tradingPair]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        exchange: row.exchange,
        tradingPair: row.trading_pair,
        price: row.price,
        bid: row.bid,
        ask: row.ask,
        volume: row.volume,
        timestamp: row.timestamp.getTime(),
      };
    } catch (error) {
      console.error('[CEXPriceCollector] Database query error:', error);
      return null;
    }
  }

  /**
   * Get all prices for a trading pair
   */
  async getPairPrices(tradingPair: string): Promise<Map<string, PriceData>> {
    try {
      const result = await this.db.query(
        `SELECT DISTINCT ON (exchange) * FROM cex_prices 
         WHERE trading_pair = $1 
         ORDER BY exchange, timestamp DESC`,
        [tradingPair]
      );

      const prices = new Map<string, PriceData>();

      for (const row of result.rows) {
        prices.set(row.exchange, {
          exchange: row.exchange,
          tradingPair: row.trading_pair,
          price: row.price,
          bid: row.bid,
          ask: row.ask,
          volume: row.volume,
          timestamp: row.timestamp.getTime(),
        });
      }

      return prices;
    } catch (error) {
      console.error('[CEXPriceCollector] Database query error:', error);
      return new Map();
    }
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const status: Record<string, any> = {
      activeCollections: Array.from(this.activeCollections),
      lastCollectionTimes: Object.fromEntries(this.lastCollectionTime),
      errorCounts: Object.fromEntries(this.collectionErrors),
      cacheStats: this.cache.getStats(),
    };

    return status;
  }

  /**
   * Get collection statistics
   */
  getCollectionStats() {
    const stats = {
      totalCollections: this.lastCollectionTime.size,
      failedCollections: Array.from(this.collectionErrors.entries())
        .filter(([_, count]) => count > 0)
        .map(([exchange, count]) => ({ exchange, consecutiveErrors: count })),
      cacheStatus: this.cache.getStats(),
      supportedExchanges: Object.keys(SUPPORTED_EXCHANGES),
      defaultPairs: DEFAULT_TRADING_PAIRS,
    };

    return stats;
  }

  /**
   * Clear cache for specific exchange
   */
  clearCacheForExchange(exchange: string): number {
    return this.cache.invalidateExchange(exchange);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.invalidateAll();
  }

  /**
   * Utility: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown
   */
  destroy(): void {
    this.cache.destroy();
    this.activeCollections.clear();
    this.lastCollectionTime.clear();
    this.collectionErrors.clear();
  }
}
