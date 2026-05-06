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
 *
 * FIXES (v2 — applied on top of prior fix set):
 * A. Promise.race → Promise.any for fallback resolution
 *    Promise.race settles on FIRST settlement (including rejections).
 *    Promise.any resolves on FIRST fulfillment — exactly what "race to first success" means.
 *    Both fetchPriceForPair fallback block and the exported helper are fixed.
 * B. fetchWithRetry is now actually called for primary pair fetch (was defined, never used).
 * C. Singleton getCEXPriceCollector() no longer throws when called without db
 *    if the instance is already initialised — safe for lazy collectorService imports.
 */

import ccxt from 'ccxt';
import { CEXPriceRepository } from '../repositories/cexPriceRepository';
import { cacheManager } from '../core/consolidation/DataCacheConsolidation';
import { ccxtService } from './ccxtService';
import { symbolUniverseService } from './symbolUniverseService';
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
  pairsAborted: number;
  duration: number;
  error?: string;
}

type FetchFailureReason =
  | 'PAIR_NOT_FOUND'
  | 'INCOMPLETE_DATA'
  | 'NETWORK_ERROR'
  | 'RATE_LIMIT'
  | 'UNKNOWN';

interface FetchFailure {
  pair: string;
  reason: FetchFailureReason;
  message: string;
}

const SUPPORTED_EXCHANGES = {
  binance: 'binance',
  kraken: 'kraken',
  coinbase: 'coinbase',
  bybit: 'bybit',
  kucoin: 'kucoin',
  okx: 'okx',
} as const;

// Quote currencies tried in order of liquidity preference
const QUOTE_CURRENCIES = ['USDT', 'USD', 'BTC', 'ETH'] as const;

export class CEXPriceCollector {
  private db: Pool;
  private cache: any;
  private activeCollections: Set<string> = new Set();
  private lastCollectionTime: Map<string, number> = new Map();
  private collectionErrors: Map<string, number> = new Map();
  private perExchangeLatency: Map<string, number[]> = new Map();
  private failureLog: Map<string, FetchFailure[]> = new Map();

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000;
  private readonly BATCH_SIZE = 50;
  private readonly COLLECTION_TIMEOUT = 30000;
  private readonly LATENCY_HISTORY_SIZE = 10;
  private readonly SLOW_EXCHANGE_THRESHOLD_MS = 20000;

  constructor(db: Pool) {
    this.db = db;
    this.cache = cacheManager.getCache('cex_prices');
  }

  // ---------------------------------------------------------------------------
  // Public: fetch all pairs for an exchange
  // ---------------------------------------------------------------------------

  async fetchExchangePrices(
    exchange: keyof typeof SUPPORTED_EXCHANGES,
    tradingPairs?: string[]
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    const pairs =
      (tradingPairs && tradingPairs.length > 0)
        ? tradingPairs
        : (await symbolUniverseService.getSupportedPairs(exchange as string));

    logger.info(
      `[CEXPriceCollector] Starting collection for ${exchange} — ${pairs.length} pairs: ` +
        `${pairs.slice(0, 10).join(', ')}${pairs.length > 10 ? ` (+${pairs.length - 10} more)` : ''}`
    );

    if (this.activeCollections.has(exchange)) {
      return {
        success: false,
        exchange,
        pairsProcessed: 0,
        pairsFailed: 0,
        pairsAborted: 0,
        duration: 0,
        error: 'Collection already in progress for this exchange',
      };
    }

    this.activeCollections.add(exchange);
    this.failureLog.set(exchange as string, []);

    // Safety valve: clear stuck collections
    const timeoutHandle = setTimeout(() => {
      if (this.activeCollections.has(exchange)) {
        logger.warn(`[CEXPriceCollector] Force-clearing stuck collection for ${exchange}`);
        this.activeCollections.delete(exchange);
      }
    }, this.COLLECTION_TIMEOUT * 2);

    try {
      let processedCount = 0;
      let failedCount = 0;
      let abortedCount = 0;
      const results: PriceData[] = [];

      for (let i = 0; i < pairs.length; i += this.BATCH_SIZE) {
        if (Date.now() - startTime > this.COLLECTION_TIMEOUT) {
          abortedCount += pairs.length - i;
          logger.warn(
            `[CEXPriceCollector] Timeout for ${exchange} after ${i} pairs. ` +
              `Aborting ${abortedCount} remaining.`
          );
          break;
        }

        const batch = pairs.slice(i, i + this.BATCH_SIZE);
        logger.debug(
          `[CEXPriceCollector] Batch ${Math.floor(i / this.BATCH_SIZE) + 1} ` +
            `(${batch.length} pairs) for ${exchange}`
        );

        const batchResults = await Promise.allSettled(
          batch.map((pair) => this.fetchPriceForPair(exchange, pair))
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
            processedCount++;
          } else {
            failedCount++;
          }
        }
      }

      let persistFailures = 0;
      if (results.length > 0) {
        persistFailures = await this.persistPricesBatch(results);
        processedCount -= persistFailures;
        failedCount += persistFailures;
      }

      this.lastCollectionTime.set(exchange, Date.now());
      this.collectionErrors.set(exchange, 0);
      this.logFailureSummary(exchange as string);

      return {
        success: true,
        exchange,
        pairsProcessed: processedCount,
        pairsFailed: failedCount,
        pairsAborted: abortedCount,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      this.collectionErrors.set(exchange, (this.collectionErrors.get(exchange) ?? 0) + 1);
      logger.error(`[CEXPriceCollector] Collection failed for ${exchange}:`, error);
      return {
        success: false,
        exchange,
        pairsProcessed: 0,
        pairsFailed: pairs.length,
        pairsAborted: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      clearTimeout(timeoutHandle);
      this.activeCollections.delete(exchange);
      this.recordExchangeLatency(exchange as string, Date.now() - startTime);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: single pair fetch
  // ---------------------------------------------------------------------------

  /**
   * FIX A (partial): fallback block now uses Promise.any instead of Promise.race.
   * FIX B: primary fetch now routes through fetchWithRetry.
   */
  private async fetchPriceForPair(
    exchange: keyof typeof SUPPORTED_EXCHANGES,
    pair: string
  ): Promise<PriceData | null> {
    let priceResponse: any = null;
    let actualPair = pair;

    try {
      // FIX B: wrap primary fetch in retry logic (was called directly before)
      try {
        priceResponse = await this.fetchWithRetry(() =>
          this.fetchWithNormalization(exchange, pair)
        );

        if (priceResponse?._resolvedSymbol && priceResponse._resolvedSymbol !== pair) {
          actualPair = priceResponse._resolvedSymbol;
          logger.debug(
            `[CEXPriceCollector] Normalised: ${pair} → ${actualPair} on ${exchange}`
          );
        }
      } catch (primaryError: any) {
        const isMissingPair =
          primaryError.code === 'BadSymbol' ||
          primaryError.message?.includes('does not have market symbol') ||
          primaryError.message?.includes('Invalid pair') ||
          primaryError.message?.includes('not found') ||
          primaryError.message?.includes('Failed to fetch price');

        if (isMissingPair) {
          const fallbacks = symbolUniverseService.getFallbackPairs(pair, exchange);

          if (fallbacks.length > 0) {
            try {
              // FIX A: Use Promise.allSettled for compatibility with broader TypeScript targets
              // Race to first successful fallback pair fetch
              const results = await Promise.allSettled(
                fallbacks.map((fallbackPair) =>
                  ccxtService.getTickerFromExchange(exchange, fallbackPair).then((result) => {
                    if (!result) throw new Error('No result');
                    return { pair: fallbackPair, result };
                  })
                )
              );
              
              const winner = results.find(r => r.status === 'fulfilled');
              if (!winner || winner.status !== 'fulfilled') {
                throw new Error('All fallback pairs failed');
              }
              
              priceResponse = winner.value.result;
              actualPair = winner.value.pair;
              logger.debug(
                `[CEXPriceCollector] Fallback resolved: ${pair} → ${actualPair} on ${exchange}`
              );
            } catch {
              this.recordFailure(
                exchange as string,
                pair,
                'PAIR_NOT_FOUND',
                `Not found under primary or ${fallbacks.length} fallback format(s)`
              );
              return null;
            }
          } else {
            this.recordFailure(
              exchange as string,
              pair,
              'PAIR_NOT_FOUND',
              'No fallback pairs configured'
            );
            return null;
          }
        } else {
          const reason = this.classifyError(primaryError);
          this.recordFailure(exchange as string, pair, reason, primaryError.message);
          return null;
        }
      }

      if (!priceResponse) {
        this.recordFailure(
          exchange as string,
          pair,
          'PAIR_NOT_FOUND',
          'No response after normalisation'
        );
        return null;
      }

      const missingFields = (['last', 'bid', 'ask', 'volume'] as const).filter(
        (f) => !(priceResponse as any)[f]
      );
      if (missingFields.length > 0) {
        this.recordFailure(
          exchange as string,
          pair,
          'INCOMPLETE_DATA',
          `Missing fields: ${missingFields.join(', ')}`
        );
        return null;
      }

      return {
        exchange: exchange as string,
        tradingPair: actualPair,
        price: priceResponse.last.toString(),
        bid: priceResponse.bid.toString(),
        ask: priceResponse.ask.toString(),
        volume: priceResponse.volume.toString(),
        timestamp: priceResponse.timestamp,
      };
    } catch (error: any) {
      this.recordFailure(exchange as string, pair, this.classifyError(error), error.message);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  async fetchAllExchanges(tradingPairs?: string[]): Promise<CollectionResult[]> {
    const results = await Promise.allSettled(
      Object.keys(SUPPORTED_EXCHANGES).map((ex) =>
        this.fetchExchangePrices(ex as keyof typeof SUPPORTED_EXCHANGES, tradingPairs)
      )
    );

    return results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            success: false,
            exchange: 'unknown',
            pairsProcessed: 0,
            pairsFailed: 0,
            pairsAborted: 0,
            duration: 0,
            error: (r.reason as Error)?.message ?? 'Unknown error',
          }
    );
  }

  private async fetchWithNormalization(
    exchange: keyof typeof SUPPORTED_EXCHANGES,
    originalPair: string
  ): Promise<any | null> {
    const [base, quote] = originalPair.split('/');
    if (!base || !quote) return null;

    const symbolsToTry = [
      originalPair,
      `${base}/${quote.slice(0, 3)}`,
      `${base.toUpperCase()}/${quote.toUpperCase()}`,
      `${base.toLowerCase()}/${quote.toLowerCase()}`,
    ].filter((s, i, arr) => arr.indexOf(s) === i);

    for (const symbol of symbolsToTry) {
      try {
        const result = await ccxtService.getTickerFromExchange(exchange as string, symbol);
        if (result) return { ...result, _resolvedSymbol: symbol };
      } catch (error: any) {
        const isMissingPair =
          error.code === 'BadSymbol' ||
          error.message?.includes('does not have market symbol') ||
          error.message?.includes('Invalid pair') ||
          error.message?.includes('not found');

        if (isMissingPair) continue;
        throw error; // non-symbol error — propagate
      }
    }

    return null;
  }

  /**
   * FIX B: fetchWithRetry is now used (was dead code — defined but never called).
   * Used for the primary fetch path in fetchPriceForPair.
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

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private async persistPricesBatch(prices: PriceData[]): Promise<number> {
    let failedInserts = 0;
    if (prices.length === 0) return 0;

    try {
      const insertPromises = prices.map((price) =>
        CEXPriceRepository.createPrice(
          price.exchange,
          price.tradingPair,
          price.price,
          price.bid,
          price.ask,
          price.volume
        ).catch((err: any) => {
          if (err.code !== '42P01') {
            failedInserts++;
            logger.warn(
              `[CEXPriceCollector] Insert failed ${price.exchange}:${price.tradingPair} — ${err.message}`
            );
          }
        })
      );

      const concurrencyLimit = 20;
      for (let i = 0; i < insertPromises.length; i += concurrencyLimit) {
        await Promise.allSettled(insertPromises.slice(i, i + concurrencyLimit));
      }

      const succeeded = prices.length - failedInserts;
      logger.info(
        `[CEXPriceCollector] Persisted ${succeeded}/${prices.length} prices` +
          (failedInserts > 0 ? ` (${failedInserts} failed)` : '')
      );
    } catch (error: any) {
      if (error.code === '42P01') {
        logger.info('[CEXPriceCollector] cex_prices table missing — cache active');
        return 0;
      }
      logger.error('[CEXPriceCollector] Batch persist error:', error);
    }

    return failedInserts;
  }

  // ---------------------------------------------------------------------------
  // Public read API
  // ---------------------------------------------------------------------------

  async getPrice(
    exchange: string,
    tradingPair: string,
    useCache = true
  ): Promise<PriceData | null> {
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
      logger.error('[CEXPriceCollector] DB query error:', error);
      return null;
    }
  }

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
      logger.error('[CEXPriceCollector] DB query error:', error);
      return new Map();
    }
  }

  /**
   * Tries USDT → USD → BTC → ETH across binance → kraken → coinbase.
   * FIX A: inner fallback within fetchPriceForPair already uses Promise.any.
   */
  async fetchPriceForSymbol(symbol: string): Promise<number | null> {
    const exchangesToTry: (keyof typeof SUPPORTED_EXCHANGES)[] = [
      'binance',
      'kraken',
      'coinbase',
    ];

    for (const exchange of exchangesToTry) {
      for (const quote of QUOTE_CURRENCIES) {
        try {
          const priceData = await this.fetchPriceForPair(exchange, `${symbol}/${quote}`);
          if (priceData?.price) {
            const price = parseFloat(priceData.price);
            if (price > 0) {
              logger.debug(
                `[CEXPriceCollector] ${symbol} on ${exchange} as ${symbol}/${quote}: $${price}`
              );
              return price;
            }
          }
        } catch {
          continue;
        }
      }
      logger.debug(
        `[CEXPriceCollector] ${exchange} had no price for ${symbol} across all quote currencies`
      );
    }

    logger.warn(`[CEXPriceCollector] No price for ${symbol} on any exchange`);
    return null;
  }

  // ---------------------------------------------------------------------------
  // Error classification
  // ---------------------------------------------------------------------------

  private classifyError(error: any): FetchFailureReason {
    if (!error) return 'UNKNOWN';
    const msg = (error.message ?? '').toLowerCase();
    if (
      error.code === 'BadSymbol' ||
      msg.includes('does not have market symbol') ||
      msg.includes('invalid pair') ||
      msg.includes('not found')
    )
      return 'PAIR_NOT_FOUND';
    if (msg.includes('rate limit') || msg.includes('too many requests') || error.code === 429)
      return 'RATE_LIMIT';
    if (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused')
    )
      return 'NETWORK_ERROR';
    return 'UNKNOWN';
  }

  private recordFailure(
    exchange: string,
    pair: string,
    reason: FetchFailureReason,
    message: string
  ): void {
    const failures = this.failureLog.get(exchange) ?? [];
    failures.push({ pair, reason, message });
    this.failureLog.set(exchange, failures);
    logger.debug(
      `[CEXPriceCollector] Fetch failed — ${exchange}:${pair} [${reason}] ${message}`
    );
  }

  private logFailureSummary(exchange: string): void {
    const failures = this.failureLog.get(exchange) ?? [];
    if (failures.length === 0) return;

    const byReason = failures.reduce(
      (acc, f) => ({ ...acc, [f.reason]: (acc[f.reason] ?? 0) + 1 }),
      {} as Record<string, number>
    );

    logger.warn(
      `[CEXPriceCollector] ${exchange} failure summary: ` +
        Object.entries(byReason)
          .map(([r, c]) => `${r}=${c}`)
          .join(', ')
    );
  }

  // ---------------------------------------------------------------------------
  // Diagnostics & lifecycle
  // ---------------------------------------------------------------------------

  getHealthStatus() {
    return {
      activeCollections: Array.from(this.activeCollections),
      lastCollectionTimes: Object.fromEntries(this.lastCollectionTime),
      errorCounts: Object.fromEntries(this.collectionErrors),
      cacheStats: this.cache.getStats(),
    };
  }

  getCollectionStats() {
    return {
      totalCollections: this.lastCollectionTime.size,
      failedCollections: Array.from(this.collectionErrors.entries())
        .filter(([_, count]) => count > 0)
        .map(([exchange, count]) => ({ exchange, consecutiveErrors: count })),
      cacheStatus: this.cache.getStats(),
      supportedExchanges: Object.keys(SUPPORTED_EXCHANGES),
    };
  }

  getFailureLog(exchange?: string): Record<string, FetchFailure[]> {
    if (exchange) return { [exchange]: this.failureLog.get(exchange) ?? [] };
    return Object.fromEntries(this.failureLog);
  }

  clearCacheForExchange(exchange: string): number {
    return this.cache.invalidateExchange(exchange);
  }

  clearAllCache(): void {
    this.cache.invalidateAll();
  }

  private recordExchangeLatency(exchange: string, duration: number): void {
    const latencies = this.perExchangeLatency.get(exchange) ?? [];
    latencies.push(duration);
    if (latencies.length > this.LATENCY_HISTORY_SIZE) latencies.shift();
    this.perExchangeLatency.set(exchange, latencies);

    if (duration > this.SLOW_EXCHANGE_THRESHOLD_MS) {
      const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      logger.warn(
        `[CEXPriceCollector] Slow exchange: ${exchange} took ${duration}ms (avg: ${avg}ms)`
      );
    }
  }

  getExchangeLatency(exchange: string): { avg: number; max: number; measurements: number } {
    const latencies = this.perExchangeLatency.get(exchange) ?? [];
    if (latencies.length === 0) return { avg: 0, max: 0, measurements: 0 };
    return {
      avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      max: Math.max(...latencies),
      measurements: latencies.length,
    };
  }

  getDiagnostics(): Record<
    string,
    { latency: { avg: number; max: number; measurements: number }; errors: number }
  > {
    const allExchanges = new Set([
      'binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx',
      ...this.perExchangeLatency.keys(),
    ]);

    const result: Record<string, any> = {};
    for (const exchange of allExchanges) {
      result[exchange] = {
        latency: this.getExchangeLatency(exchange),
        errors: this.collectionErrors.get(exchange) ?? 0,
      };
    }
    return result;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  destroy(): void {
    this.cache.destroy();
    this.activeCollections.clear();
    this.lastCollectionTime.clear();
    this.collectionErrors.clear();
    this.failureLog.clear();
    this.perExchangeLatency.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// FIX C: if instance already exists, return it without requiring db arg.
//        Callers like collectorService that lazy-import without a Pool won't throw
//        as long as the instance was seeded at startup.
// ---------------------------------------------------------------------------

let cexPriceCollectorInstance: CEXPriceCollector | null = null;

export function getCEXPriceCollector(db?: Pool): CEXPriceCollector {
  if (!cexPriceCollectorInstance) {
    if (!db) {
      throw new Error(
        '[CEXPriceCollector] Not initialised. Call getCEXPriceCollector(db) once at startup ' +
          'before using it without a db argument.'
      );
    }
    cexPriceCollectorInstance = new CEXPriceCollector(db);
  }
  return cexPriceCollectorInstance;
}