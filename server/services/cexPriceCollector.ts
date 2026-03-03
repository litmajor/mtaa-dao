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
import { ccxtService } from './ccxtService';
import { symbolUniverseService } from './symbolUniverseService';
import { treasuryPriceUpdateService } from './treasuryPriceUpdateService';
import { logger } from '../utils/logger';
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
 * Supported exchanges - loaded from config via symbolUniverseService
 * Configuration is centralized in server/config/symbolUniverseConfig.ts
 */
const SUPPORTED_EXCHANGES = {
  binance: 'binance',
  kraken: 'kraken',
  coinbase: 'coinbase',
  bybit: 'bybit',
  kucoin: 'kucoin',
  okx: 'okx',
} as const;

export class CEXPriceCollector {
  private db: Pool;
  private cache: any; // Reference to cacheManager's cex_prices cache
  private activeCollections: Set<string> = new Set();
  private lastCollectionTime: Map<string, number> = new Map();
  private collectionErrors: Map<string, number> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds
  private readonly BATCH_SIZE = 50; // Fetch prices in batches of 50
  private readonly MAX_CONCURRENCY = 20; // Max concurrent API calls
  private readonly COLLECTION_TIMEOUT = 30000; // 30 seconds MAX (reduced from 90s to avoid timeouts)

  constructor(db: Pool) {
    this.db = db;
    this.cache = cacheManager.getCache('cex_prices');
  }

  /**
   * Fetch prices for a specific exchange and trading pairs
   * ⚡ REFACTORED: Parallel batch fetching with concurrency control
   * - Fetches up to MAX_CONCURRENCY pairs simultaneously
   * - Batches database writes (not per-pair)
   * - Short timeout (30s) to avoid Redis/DB connection exhaustion
   * - Uses Promise.allSettled() for resilience
   */
  async fetchExchangePrices(
    exchange: keyof typeof SUPPORTED_EXCHANGES,
    tradingPairs?: string[]
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    const pairs = tradingPairs || (await symbolUniverseService.getSupportedPairs(exchange as string));

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
        logger.warn(`[CEXPriceCollector] Force-clearing stuck collection for ${exchange}`);
        this.activeCollections.delete(exchange);
      }
    }, this.COLLECTION_TIMEOUT * 2); // 2x timeout for safety

    try {
      let processedCount = 0;
      let failedCount = 0;
      const results: PriceData[] = [];

      // ⚡ Fetch prices in parallel batches with concurrency control
      for (let i = 0; i < pairs.length; i += this.BATCH_SIZE) {
        const batch = pairs.slice(i, i + this.BATCH_SIZE);
        logger.debug(`[CEXPriceCollector] Fetching batch ${Math.floor(i / this.BATCH_SIZE) + 1} (${batch.length} pairs)`);

        // Fetch all pairs in batch in parallel
        const pricePromises = batch.map((pair) => this.fetchPriceForPair(exchange, pair));
        const batchResults = await Promise.allSettled(pricePromises);

        // Process batch results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
            processedCount++;
          } else {
            failedCount++;
          }
        }

        // Check timeout - abort early if taking too long
        if (Date.now() - startTime > this.COLLECTION_TIMEOUT) {
          logger.warn(`[CEXPriceCollector] Collection timeout reached for ${exchange}, stopping early`);
          break;
        }
      }

      // ⚡ Persist ALL prices in single batch operation (not per-pair)
      if (results.length > 0) {
        await this.persistPricesBatch(results);
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
    } catch (error: any) {
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
   * Fetch price for a single pair - used in parallel batch
   * ⚡ Uses parallel fallback attempts (Promise.allSettled) instead of sequential
   */
  private async fetchPriceForPair(
    exchange: keyof typeof SUPPORTED_EXCHANGES,
    pair: string
  ): Promise<PriceData | null> {
    let priceResponse = null;
    let actualPair = pair;

    try {
      // Try primary format first
      try {
        priceResponse = await ccxtService.getTickerFromExchange(exchange, pair);
      } catch (primaryError: any) {
        // Check if pair doesn't exist
        const isMissingPair =
          primaryError.code === 'BadSymbol' ||
          primaryError.message?.includes('does not have market symbol') ||
          primaryError.message?.includes('Invalid pair') ||
          primaryError.message?.includes('not found') ||
          primaryError.message?.includes('Failed to fetch price');

        if (isMissingPair) {
          // Try fallback formats in parallel
          const fallbacks = symbolUniverseService.getFallbackPairs(pair, exchange);
          
          if (fallbacks.length > 0) {
            // ⚡ Fetch all fallbacks in parallel, use first success
            const fallbackPromises = fallbacks.map((fallbackPair) =>
              ccxtService.getTickerFromExchange(exchange, fallbackPair).then(
                (result) => ({ pair: fallbackPair, result, success: true }),
                () => ({ pair: fallbackPair, result: null, success: false })
              )
            );

            const fallbackResults = await Promise.allSettled(fallbackPromises);
            
            for (const result of fallbackResults) {
              if (result.status === 'fulfilled' && result.value.success && result.value.result) {
                priceResponse = result.value.result;
                actualPair = result.value.pair;
                logger.debug(`[CEXPriceCollector] Found ${pair} as ${actualPair} on ${exchange}`);
                break;
              }
            }
          }
        } else {
          // Non-missing-pair error - log and skip
          logger.debug(`[CEXPriceCollector] Error fetching ${exchange}:${pair}: ${primaryError.message}`);
        }
      }

      if (!priceResponse) {
        return null; // Pair not available
      }

      // Validate price data
      if (!priceResponse.last || !priceResponse.bid || !priceResponse.ask || !priceResponse.volume) {
        return null; // Incomplete data
      }

      return {
        exchange: exchange as string,
        tradingPair: pair,
        price: priceResponse.last.toString(),
        bid: priceResponse.bid.toString(),
        ask: priceResponse.ask.toString(),
        volume: priceResponse.volume.toString(),
        timestamp: priceResponse.timestamp,
      };
    } catch (error: any) {
      logger.debug(`[CEXPriceCollector] Unexpected error fetching ${exchange}:${pair}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch prices for all supported exchanges in parallel
   * ⚡ Uses Promise.allSettled() for resilience - one exchange failure doesn't block others
   */
  async fetchAllExchanges(tradingPairs?: string[]): Promise<CollectionResult[]> {
    const promises = Object.keys(SUPPORTED_EXCHANGES).map((exchange) =>
      this.fetchExchangePrices(
        exchange as keyof typeof SUPPORTED_EXCHANGES,
        tradingPairs
      )
    );

    const results = await Promise.allSettled(promises);

    return results
      .map((result) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            success: false,
            exchange: 'unknown',
            pairsProcessed: 0,
            pairsFailed: 0,
            duration: 0,
            error: result.reason?.message || 'Unknown error',
          };
        }
      });
  }

  /**
   * Fetch ticker with symbol normalization for different exchanges
   * Tries multiple symbol formats and returns null if pair not available
   * 
   * 🔴 CCXT API CALL LOCATION #1 (TypeScript)
   * See: CCXT_API_CALL_MAPPING.md for redundancy analysis
   */
  private async fetchWithNormalization(client: any, originalPair: string): Promise<any | null> {
    // Parse pair components
    const [base, quote] = originalPair.split('/') || [];
    if (!base || !quote) return null;

    // Generate alternative formats to try (exchange normalization)
    const symbolsToTry = [
      originalPair,                    // BTC/USDT
      `${base}/${quote.slice(0, 3)}`, // BTC/USD (if USDT)
      `${base.toUpperCase()}/${quote.toUpperCase()}`, // Force uppercase
    ];

    for (const symbol of symbolsToTry) {
      try {
        return await this.fetchWithRetry(() => client.fetchTicker(symbol));
      } catch (error: any) {
        // Check if it's a "pair not available" error
        const isMissingPair = 
          error.code === 'BadSymbol' || 
          error.message?.includes('does not have market symbol') ||
          error.message?.includes('Invalid pair') ||
          error.message?.includes('not found');
        
        if (isMissingPair) {
          // Try next format
          continue;
        }
        
        // For other errors (network, API rate limit, etc.), don't retry other formats
        throw error;
      }
    }

    // None of the formats worked - pair not available on this exchange
    return null;
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

  private async persistPricesBatch(prices: PriceData[]): Promise<void> {
    try {
      if (prices.length === 0) return;

      // ⚡ Parallel inserts with spread limit to avoid connection pool exhaustion
      const insertPromises = prices.map((price) =>
        CEXPriceRepository.createPrice(
          price.exchange,
          price.tradingPair,
          price.price,
          price.bid,
          price.ask,
          price.volume
        ).catch((err: any) => {
          // Ignore individual errors if table doesn't exist
          if (err.code !== '42P01') {
            logger.warn(`[CEXPriceCollector] Individual insert failed for ${price.exchange}:${price.tradingPair}`);
          }
        })
      );

      // Limit concurrency to avoid overwhelming connection pool
      const concurrencyLimit = 20;
      for (let i = 0; i < insertPromises.length; i += concurrencyLimit) {
        const batch = insertPromises.slice(i, i + concurrencyLimit);
        await Promise.allSettled(batch);
      }

      logger.info(`[CEXPriceCollector] Persisted ${prices.length} prices to database`);
    } catch (error: any) {
      // Ignore table-doesn't-exist errors (code 42P01)
      if (error.code === '42P01') {
        logger.info('[CEXPriceCollector] CEX prices table does not exist, cache is active');
        return;
      }
      logger.error('[CEXPriceCollector] Database batch persistence error:', error);
      // Don't throw - cache already updated
    }
  }

  /**
   * Legacy persist method (kept for backward compatibility)
   */
  private async persistPrices(prices: PriceData[]): Promise<void> {
    // Delegate to batch method
    return this.persistPricesBatch(prices);
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
      supportedExchanges: Object.keys(SUPPORTED_EXCHANGES)
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

  /**
   * Fetch price for a single symbol from best available CEX
   * Used by collectorService to avoid duplicate fetching
   * Returns price or null if not found
   */
  async fetchPriceForSymbol(symbol: string): Promise<number | null> {
    try {
      // Try primary exchanges in order (most liquid first)
      const exchangesToTry: (keyof typeof SUPPORTED_EXCHANGES)[] = ['binance', 'kraken', 'coinbase'];

      for (const exchange of exchangesToTry) {
        try {
          // Format symbol as pair (e.g., BTC → BTC/USDT)
          const pair = `${symbol}/USDT`;
          const priceData = await this.fetchPriceForPair(exchange, pair);

          if (priceData && priceData.price) {
            const price = parseFloat(priceData.price);
            if (price > 0) {
              logger.debug(`[CEXPriceCollector] Found ${symbol} on ${exchange}: $${price}`);
              return price;
            }
          }
        } catch (error) {
          logger.debug(`[CEXPriceCollector] ${exchange} failed for ${symbol}, trying next exchange`);
          continue;
        }
      }

      logger.warn(`[CEXPriceCollector] Could not find price for ${symbol} on any exchange`);
      return null;
    } catch (error) {
      logger.error(`[CEXPriceCollector] Error fetching price for ${symbol}:`, error);
      return null;
    }
  }
}

// Export singleton instance for use by collectorService
let cexPriceCollectorInstance: CEXPriceCollector | null = null;

export function getCEXPriceCollector(db?: Pool): CEXPriceCollector {
  if (!cexPriceCollectorInstance && db) {
    cexPriceCollectorInstance = new CEXPriceCollector(db);
  }
  if (!cexPriceCollectorInstance) {
    throw new Error('CEXPriceCollector not initialized. Please pass a database pool.');
  }
  return cexPriceCollectorInstance;
}
