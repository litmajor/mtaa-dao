/**
 * API Efficiency Layer
 * Handles rate limiting, batching, deduplication, smart caching
 * Prevents API exhaustion and wasted calls
 */

import pLimit from 'p-limit';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { SYMBOL_UNIVERSE_CONFIG } from '../config/symbolUniverseConfig';

interface RequestMetadata {
  exchange: string;
  pair: string;
  timestamp: number;
  source: string;
}

interface RateLimitBucket {
  exchange: string;
  tokensAvailable: number;
  lastRefillTime: number;
  requestQueue: Array<() => Promise<any>>;
}

class APIEfficiencyLayer extends EventEmitter {
  private config = SYMBOL_UNIVERSE_CONFIG;
  private rateLimitBuckets: Map<string, RateLimitBucket> = new Map();
  private requestDeduplicator: Map<string, Promise<any>> = new Map();
  private requestMetrics: Map<string, RequestMetadata[]> = new Map();
  private concurrencyLimiter = pLimit(this.config.rateLimiting.maxConcurrentRequests);

  private batchQueue: Map<string, Array<() => Promise<any>>> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeRateLimitBuckets();
  }

  /**
   * Initialize rate limit buckets for all exchanges
   */
  private initializeRateLimitBuckets() {
    const exchanges = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;
    Object.entries(exchanges).forEach(([exchangeName, config]: [string, any]) => {
      this.rateLimitBuckets.set(exchangeName, {
        exchange: exchangeName,
        tokensAvailable: (config as any).rateLimitPerSecond,
        lastRefillTime: Date.now(),
        requestQueue: []
      });

      // Refill tokens every second
      setInterval(() => {
        const bucket = this.rateLimitBuckets.get(exchangeName);
        if (bucket) {
          bucket.tokensAvailable = Math.min(
            (config as any).rateLimitPerSecond,
            bucket.tokensAvailable + (config as any).rateLimitPerSecond
          );
        }
      }, 1000);
    });

    logger.info('[APIEfficiency] Rate limit buckets initialized');
  }

  /**
   * Execute request with all efficiency layers
   */
  async executeRequest<T>(
    exchange: string,
    pair: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // 1. Deduplication - prevent duplicate requests
    if (this.config.rateLimiting.deduplication.enabled) {
      const dedupeKey = `${exchange}:${pair}`;
      const existing = this.requestDeduplicator.get(dedupeKey);

      if (existing) {
        logger.debug(`[APIEfficiency] Deduped request: ${dedupeKey}`);
        return existing;
      }

      // Store and clean after window
      const promise = this.executeWithRateLimit(exchange, requestFn);
      this.requestDeduplicator.set(dedupeKey, promise);

      setTimeout(() => {
        this.requestDeduplicator.delete(dedupeKey);
      }, this.config.rateLimiting.deduplication.windowMs);

      return promise;
    }

    return this.executeWithRateLimit(exchange, requestFn);
  }

  /**
   * Execute with rate limiting
   */
  private async executeWithRateLimit<T>(
    exchange: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Apply rate limit
    if (this.config.rateLimiting.useBottleneck) {
      const bucket = this.rateLimitBuckets.get(exchange);

      if (!bucket) {
        throw new Error(`No rate limit bucket for ${exchange}`);
      }

      // Wait if no tokens available
      while (bucket.tokensAvailable < 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      bucket.tokensAvailable--;
    }

    // Apply concurrency limit
    return this.concurrencyLimiter(async () => {
      try {
        return await this.executeWithRetry(exchange, requestFn);
      } catch (error) {
        this.emitMetric({
          exchange,
          pair: 'unknown',
          timestamp: Date.now(),
          source: 'error'
        });
        throw error;
      }
    });
  }

  /**
   * Execute with exponential backoff retry
   */
  private async executeWithRetry<T>(
    exchange: string,
    requestFn: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error: any) {
      const isRateLimitError =
        error.code === 'RATE_LIMIT_EXCEEDED' ||
        error.status === 429 ||
        error.message?.includes('rate limit');

      if (!isRateLimitError || !this.config.rateLimiting.exponentialBackoff.enabled) {
        throw error;
      }

      // Calculate backoff delay
      const delay = Math.min(
        this.config.rateLimiting.exponentialBackoff.initialDelayMs *
          Math.pow(this.config.rateLimiting.exponentialBackoff.factor, attempt),
        this.config.rateLimiting.exponentialBackoff.maxDelayMs
      );

      logger.warn(
        `[APIEfficiency] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1})`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.executeWithRetry(exchange, requestFn, attempt + 1);
    }
  }

  /**
   * Batch multiple requests and deduplicate
   */
  async batchRequests(
    exchange: string,
    requests: Array<{
      pair: string;
      fn: () => Promise<any>;
    }>
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    if (!this.config.rateLimiting.batchRequests.enabled) {
      // Execute without batching
      for (const { pair, fn } of requests) {
        try {
          results.set(pair, await this.executeRequest(exchange, pair, fn));
        } catch (error) {
          logger.error(`[APIEfficiency] Request failed for ${pair}:`, error);
        }
      }
      return results;
    }

    // Batch requests
    const queue = this.batchQueue.get(exchange) || [];
    this.batchQueue.set(exchange, queue);

    // Add requests to queue
    for (const { pair, fn } of requests) {
      queue.push(fn);
    }

    // Schedule batch execution
    if (!this.batchTimers.has(exchange)) {
      const timer = setTimeout(() => {
        this.executeBatch(exchange);
        this.batchTimers.delete(exchange);
      }, this.config.rateLimiting.batchRequests.batchDelayMs);

      this.batchTimers.set(exchange, timer);
    }

    // Wait for batch to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.batchQueue.get(exchange)?.length === 0) {
          clearInterval(checkInterval);
          resolve(results);
        }
      }, 50);
    });
  }

  /**
   * Execute batched requests
   */
  private async executeBatch(exchange: string) {
    const queue = this.batchQueue.get(exchange);
    if (!queue || queue.length === 0) return;

    const batch = queue.splice(0, this.config.rateLimiting.batchRequests.batchSize);

    logger.debug(
      `[APIEfficiency] Executing batch of ${batch.length} requests for ${exchange}`
    );

    // Execute all in parallel
    await Promise.all(
      batch.map(fn =>
        this.concurrencyLimiter(() => fn()).catch(error =>
          logger.error('[APIEfficiency] Batch request error:', error.message)
        )
      )
    );
  }

  /**
   * Get metrics for an exchange
   */
  getMetrics(exchange: string): any {
    const metrics = this.requestMetrics.get(exchange) || [];
    const now = Date.now();
    const last1min = metrics.filter(m => now - m.timestamp < 60000);

    return {
      totalRequests: metrics.length,
      requestsLast1min: last1min.length,
      requestsPerSecond: (last1min.length / 60).toFixed(2),
      sources: [...new Set(metrics.map(m => m.source))]
    };
  }

  /**
   * Emit metric for request
   */
  private emitMetric(metadata: RequestMetadata) {
    if (!this.requestMetrics.has(metadata.exchange)) {
      this.requestMetrics.set(metadata.exchange, []);
    }

    const metrics = this.requestMetrics.get(metadata.exchange)!;
    metrics.push(metadata);

    // Clean old metrics
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filtered = metrics.filter(m => m.timestamp > oneHourAgo);
    this.requestMetrics.set(metadata.exchange, filtered);
  }

  /**
   * Clear stale cache entries
   */
  clearStaleCache(olderThanMs: number): void {
    const cutoff = Date.now() - olderThanMs;
    Array.from(this.requestMetrics.entries()).forEach(([exchange, metrics]) => {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.requestMetrics.set(exchange, filtered);
    });
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const allMetrics: Record<string, any> = {};
    Array.from(this.rateLimitBuckets.keys()).forEach(exchange => {
      allMetrics[exchange] = this.getMetrics(exchange);
    });
    return allMetrics;
  }
}

export const apiEfficiencyLayer = new APIEfficiencyLayer();
