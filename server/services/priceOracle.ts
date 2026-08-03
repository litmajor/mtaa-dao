import { logger } from '../utils/logger';
import { getGatewayAgentService } from '../core/agents/gateway/service';
import { getGatewayService } from './gateway';
import type { GatewayEvent } from './gateway/types';
import { redis } from './redis';
import { ccxtService } from './ccxtService';
import { dexscreenerClient } from './dexscreenerClient';
import { tokenRegistry, type TokenMetadata } from './tokenRegistry';

/**
 * Price Oracle Service for Cryptocurrency Prices
 *
 * Self-Healing Discovery Edition:
 * - Automatic CoinGecko discovery for unknown assets
 * - Batched background discovery with debouncing
 * - Registry synchronization (bidirectional with tokenRegistry)
 * - Smart cooldowns (mapping failures ≠ service failures)
 * - Post-discovery cache warming
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

interface GatewayPriceData {
  symbol: string;
  price: number;
  change24h?: number;
  marketCap?: number;
  volume24h?: number;
}

interface GatewayPriceResponse {
  payload?: {
    data?: GatewayPriceData[];
  };
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

interface CoinGeckoSearchResult {
  coins: Array<{
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
    large: string;
  }>;
}

interface CoinGeckoListItem {
  id: string;
  symbol: string;
  name: string;
  platforms?: Record<string, string>;
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

interface FailureCooldown {
  gateway?: number;
  coingecko?: number;
  ccxt?: number;
  dexscreener?: number;
}

interface DiscoveryState {
  queue: Set<string>;
  isRunning: boolean;
  lastRun: number;
  discoveredCount: number;
  failedSymbols: TtlMap<number>; // Symbols that failed discovery and their retry timestamp
}

class TtlMap<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  set(key: string, value: T, ttlMs: number): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now >= entry.expiresAt) {
        this.entries.delete(key);
      }
    }
  }

  get size(): number {
    this.pruneExpired();
    return this.entries.size;
  }

  entriesSnapshot(): Array<[string, T]> {
    this.pruneExpired();
    return Array.from(this.entries.entries(), ([key, entry]) => [key, entry.value]);
  }

  forEach(callback: (value: T, key: string) => void): void {
    this.pruneExpired();
    for (const [key, entry] of this.entries) {
      callback(entry.value, key);
    }
  }
}

const HARDCODED_NAMES: Record<string, string> = {
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
  CELO: 'Celo',
  CUSD: 'Celo Dollar',
  CEUR: 'Celo Euro',
  CKES: 'Celo Kenyan Shilling',
  UBE: 'Ubeswap',
  WBTC: 'Wrapped Bitcoin',
  LDO: 'Lido DAO',
  PEPE: 'Pepe',
  SHIB: 'Shiba Inu',
};

export class PriceOracleService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DURATION = 60 * 1000;
  private readonly LONG_CACHE_DURATION = 5 * 60 * 1000;
  private readonly API_BASE = 'https://api.coingecko.com/api/v3';
  private readonly FAILURE_COOLDOWN_MS = 5_000;

  // Redis deduplication
  private readonly DEDUP_PREFIX = 'price:fetch:';
  private readonly DEDUP_TTL = 15;

  // Rate limiting
  private rateLimitState: RateLimitState = {
    requestCount: 0,
    resetTime: Date.now(),
    backoffMultiplier: 1,
    nextRetryTime: 0,
  };
  private readonly RATE_LIMIT_THRESHOLD = 10;
  private readonly RATE_LIMIT_WINDOW = 60 * 1000;
  private readonly MAX_BACKOFF_MULTIPLIER = 32;

  // Local request deduplication
  private pendingRequests: Map<string, Promise<PriceData | null>> = new Map();
  private pendingBatchRequests: Map<string, Promise<Map<string, PriceData>>> = new Map();

  // Per-source failure cooldowns
  private failureCooldowns = new Map<string, FailureCooldown>();

  // Token name cache
  private _tokenRegistryCache: Map<string, string> | null = null;
  private _tokenRegistryCacheBuilt = false;

  // Cache eviction
  private readonly MAX_CACHE_SIZE = 1000;

  // Discovery system
  private discovery: DiscoveryState = {
    queue: new Set(),
    isRunning: false,
    lastRun: 0,
    discoveredCount: 0,
    failedSymbols: new TtlMap<number>(),
  };
  private readonly DISCOVERY_BATCH_DELAY_MS = 1500;
  private readonly DISCOVERY_DEBOUNCE_MS = 500;
  private readonly DISCOVERY_MAX_BATCH_SIZE = 20;
  private readonly DISCOVERY_RETRY_AFTER_MS = 60 * 60 * 1000; // 1 hour before retrying failed symbols
  private discoveryTimeout?: ReturnType<typeof setTimeout>;

  // Symbol → CoinGecko ID mappings
  private symbolToGeckoId: Map<string, string> = new Map<string, string>([
    ['USDT', 'tether'],
    ['USDC', 'usd-coin'],
    ['WBTC', 'wrapped-bitcoin'],
    ['BTC', 'bitcoin'],
    ['ETH', 'ethereum'],
    ['BNB', 'binancecoin'],
    ['MATIC', 'matic-network'],
    ['LDO', 'lido-dao'],
    ['PEPE', 'pepe'],
    ['SHIB', 'shiba-inu'],
    ['CELO', 'celo'],
    ['CUSD', 'celo-dollar'],
    ['CEUR', 'celo-euro'],
    ['CKES', 'celo-kenyan-shilling'],
  ]);

  constructor() {
    this.subscribeToGatewayEvents();

    void this.seedFromTokenRegistry().catch((err) => {
      logger.warn('[PriceOracle] Failed to seed from token registry on init', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  private subscribeToGatewayEvents(): void {
    try {
      const gateway = getGatewayService();
      gateway.on('gatewayEvent', this.handleGatewayEvent.bind(this));
    } catch (error) {
      logger.warn('[PriceOracle] Failed to subscribe to gateway events', { error });
    }
  }

  private handleGatewayEvent(event: GatewayEvent): void {
    if (event.type !== 'price_update') {
      return;
    }

    const symbol = String(event.data.symbol || '').toUpperCase();
    const price = Number(event.data.price ?? 0);
    if (!symbol || price <= 0) {
      return;
    }

    const cached: PriceData = {
      symbol,
      name: this.getCoinName(symbol),
      priceUsd: price,
      priceChange24h: Number(event.data.change24h ?? 0),
      marketCap: Number(event.data.marketCap ?? 0),
      volume24h: Number(event.data.volume24h ?? 0),
      lastUpdated: new Date(),
    };

    this.setCache(symbol, cached);
    logger.debug('[PriceOracle] Cached gateway price update for', { symbol, price });
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Symbol Resolution & Discovery
  // ════════════════════════════════════════════════════════════════════════════════

  private resolveToCoinGeckoId(symbol: string): string | null {
    return this.symbolToGeckoId.get(symbol.toUpperCase()) || null;
  }

  registerSymbolMapping(symbol: string, coinGeckoId: string): void {
    const upperSymbol = symbol.toUpperCase();
    this.symbolToGeckoId.set(upperSymbol, coinGeckoId);
    // Remove from failed discovery set if it was there (now resolved)
    this.discovery.failedSymbols.delete(upperSymbol);
    logger.info(`[PriceOracle] Registered ${upperSymbol} → ${coinGeckoId}`);
  }

  registerSymbolMappings(mappings: Map<string, string>): void {
    for (const [symbol, coinGeckoId] of mappings) {
      this.registerSymbolMapping(symbol, coinGeckoId);
    }
    logger.info(`[PriceOracle] Registered ${mappings.size} symbol mappings`);
  }

  private async seedFromTokenRegistry(): Promise<void> {
    try {
      const { tokenRegistry } = await import('./tokenRegistry');
      const all = tokenRegistry.getAllTokens();
      const mappings = new Map<string, string>();
      const nameCache = new Map<string, string>();

      for (const t of all) {
        if (t.symbol) {
          const sym = t.symbol.toUpperCase();
          if (t.coingeckoId) mappings.set(sym, t.coingeckoId);
          if (t.name) nameCache.set(sym, t.name);
        }
      }

      if (mappings.size > 0) this.registerSymbolMappings(mappings);
      if (nameCache.size > 0) {
        this._tokenRegistryCache = nameCache;
        this._tokenRegistryCacheBuilt = true;
      }

      logger.info(
        `[PriceOracle] Seeded ${mappings.size} symbol→coingecko mappings and ${nameCache.size} names from tokenRegistry`
      );
    } catch (err: unknown) {
      logger.warn(
        `[PriceOracle] seedFromTokenRegistry failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Self-Healing Discovery System
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Queue a symbol for background discovery.
   * Debounced: waits for more symbols to batch, then runs discovery.
   */
  private queueForDiscovery(symbol: string): void {
    const upperSymbol = symbol.toUpperCase();

    // Skip if already known
    if (this.symbolToGeckoId.has(upperSymbol)) return;

    // Skip if recently failed discovery (prevent spam)
    if (this.discovery.failedSymbols.has(upperSymbol)) {
      const retryAt = this.discovery.failedSymbols.get(upperSymbol) ?? 0;
      if (Date.now() < retryAt) {
        logger.debug(
          `[PriceOracle-Discovery] Skipping ${upperSymbol} — discovery cooldown until ${new Date(
            retryAt
          ).toISOString()}`
        );
        return;
      }
      this.discovery.failedSymbols.delete(upperSymbol);
      logger.debug(`[PriceOracle-Discovery] Retry cooldown expired for ${upperSymbol}`);
    }

    // Skip if already queued
    if (this.discovery.queue.has(upperSymbol)) return;

    this.discovery.queue.add(upperSymbol);
    logger.info(`[PriceOracle-Discovery] Queued ${upperSymbol} for discovery (${this.discovery.queue.size} pending)`);

    // Debounce: reset timer on each new symbol
    if (this.discoveryTimeout) {
      clearTimeout(this.discoveryTimeout);
    }

    this.discoveryTimeout = setTimeout(() => {
      void this.runDiscovery();
    }, this.DISCOVERY_DEBOUNCE_MS);
  }

  /**
   * Execute discovery batch.
   * Tries CoinGecko search API first, falls back to /coins/list.
   */
  private async runDiscovery(): Promise<void> {
    if (this.discovery.isRunning || this.discovery.queue.size === 0) return;

    this.discovery.isRunning = true;
    this.discovery.lastRun = Date.now();

    // Take batch (up to max size)
    const batch = Array.from(this.discovery.queue).slice(0, this.DISCOVERY_MAX_BATCH_SIZE);
    for (const s of batch) this.discovery.queue.delete(s);

    logger.info(`[PriceOracle-Discovery] Running discovery for ${batch.length} symbols: ${batch.join(', ')}`);

    try {
      // Strategy 1: Search each symbol via CoinGecko /search API
      const discovered = await this.discoverViaSearch(batch);

      // Strategy 2: For remaining, try bulk /coins/list
      const remaining = batch.filter((s) => !discovered.has(s));
      if (remaining.length > 0) {
        const listDiscovered = await this.discoverViaList(remaining);
        for (const [sym, id] of listDiscovered) {
          discovered.set(sym, id);
        }
      }

      // Register all discovered mappings
      let newMappings = 0;
      for (const [symbol, coinGeckoId] of discovered) {
        this.registerSymbolMapping(symbol, coinGeckoId);
        newMappings++;

        // Sync to tokenRegistry if available
        await this.syncToTokenRegistry(symbol, coinGeckoId);
      }

      this.discovery.discoveredCount += newMappings;

      // Track failures for retry backoff
      const failed = batch.filter((s) => !discovered.has(s));
      const retryUntil = Date.now() + this.DISCOVERY_RETRY_AFTER_MS;
      for (const s of failed) {
        this.discovery.failedSymbols.set(s, retryUntil, this.DISCOVERY_RETRY_AFTER_MS);
        logger.warn(
          `[PriceOracle-Discovery] Failed to discover ${s} — will retry after ${this.DISCOVERY_RETRY_AFTER_MS / 60000}min`
        );
      }

      // Warm cache for newly discovered symbols
      if (newMappings > 0) {
        void this.warmCacheForDiscovered(Array.from(discovered.keys()));
      }

      logger.info(
        `[PriceOracle-Discovery] Batch complete: ${newMappings} discovered, ${failed.length} failed, ${this.discovery.queue.size} remaining in queue`
      );
    } catch (error) {
      logger.error('[PriceOracle-Discovery] Discovery batch failed', { error });
      // Re-queue for retry
      for (const s of batch) {
        if (!this.symbolToGeckoId.has(s)) {
          this.discovery.queue.add(s);
        }
      }
    } finally {
      this.discovery.isRunning = false;

      // Process remaining queue
      if (this.discovery.queue.size > 0) {
        setTimeout(() => {
          void this.runDiscovery();
        }, this.DISCOVERY_BATCH_DELAY_MS);
      }

      // Prune expired discovery backoff entries and log if the backlog is large
      this.discovery.failedSymbols.pruneExpired();
      if (this.discovery.failedSymbols.size > 100) {
        logger.warn(`[PriceOracle-Discovery] ${this.discovery.failedSymbols.size} symbols in failed discovery backlog`);
      }
    }
  }

  /**
   * Discover symbols using CoinGecko /search API (best for individual lookups).
   * Returns Map<symbol, coinGeckoId> for successful matches.
   */
  private async discoverViaSearch(symbols: string[]): Promise<Map<string, string>> {
    const discovered = new Map<string, string>();

    for (const symbol of symbols) {
      try {
        if (this.shouldApplyBackoff()) {
          await this.waitForBackoff();
        }

        const response = await fetch(
          `${this.API_BASE}/search?query=${encodeURIComponent(symbol.toLowerCase())}`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (response.status === 429) {
          this.applyBackoff();
          continue;
        }

        if (!response.ok) continue;

        this.incrementRateLimitCounter();

        const data: CoinGeckoSearchResult = await response.json();

        // Find best match: exact symbol match with highest market cap rank
        const match = data.coins
          ?.filter((c) => c.symbol.toUpperCase() === symbol.toUpperCase())
          .sort((a, b) => (a.market_cap_rank || Infinity) - (b.market_cap_rank || Infinity))[0];

        if (match) {
          discovered.set(symbol.toUpperCase(), match.id);
          logger.info(`[PriceOracle-Discovery] Found via search: ${symbol} → ${match.id} (${match.name})`);
        }
      } catch (error) {
        logger.debug(`[PriceOracle-Discovery] Search failed for ${symbol}`, { error });
      }
    }

    return discovered;
  }

  /**
   * Discover symbols using CoinGecko /coins/list (bulk, cached locally).
   * Downloads full list once, then matches symbols in-memory.
   * Much more efficient for bulk discovery.
   */
  private _coinGeckoListCache: CoinGeckoListItem[] | null = null;
  private _coinGeckoListCacheTime = 0;
  private readonly COINGECKO_LIST_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private async discoverViaList(symbols: string[]): Promise<Map<string, string>> {
    const discovered = new Map<string, string>();

    try {
      // Fetch full list (cached)
      if (
        !this._coinGeckoListCache ||
        Date.now() - this._coinGeckoListCacheTime > this.COINGECKO_LIST_CACHE_DURATION
      ) {
        if (this.shouldApplyBackoff()) {
          await this.waitForBackoff();
        }

        const response = await fetch(`${this.API_BASE}/coins/list`, {
          signal: AbortSignal.timeout(10000),
        });

        if (response.status === 429) {
          this.applyBackoff();
          return discovered;
        }

        if (!response.ok) {
          throw new Error(`CoinGecko list API error: ${response.status}`);
        }

        this.incrementRateLimitCounter();

        this._coinGeckoListCache = (await response.json()) as CoinGeckoListItem[];
        this._coinGeckoListCacheTime = Date.now();
        logger.info(`[PriceOracle-Discovery] Cached ${this._coinGeckoListCache.length} coins from CoinGecko list`);
      }

      if (!this._coinGeckoListCache) return discovered;

      // Match symbols
      for (const symbol of symbols) {
        const upperSymbol = symbol.toUpperCase();
        const match = this._coinGeckoListCache.find(
          (c) => c.symbol.toUpperCase() === upperSymbol
        );
        if (match) {
          discovered.set(upperSymbol, match.id);
          logger.info(`[PriceOracle-Discovery] Found via list: ${upperSymbol} → ${match.id} (${match.name})`);
        }
      }
    } catch (error) {
      logger.error('[PriceOracle-Discovery] List discovery failed', { error });
    }

    return discovered;
  }

  /**
   * Sync discovered symbol back to tokenRegistry so other services know about it.
   */
  private async syncToTokenRegistry(symbol: string, coinGeckoId: string): Promise<void> {
    try {
      const { tokenRegistry } = await import('./tokenRegistry');
      if (tokenRegistry.registerToken) {
        tokenRegistry.registerToken({
          symbol: symbol.toUpperCase(),
          coingeckoId: coinGeckoId,
          name: this.getCoinName(symbol.toUpperCase()),
          discoveredAt: new Date(),
          source: 'price-oracle-auto-discovery',
        });
        logger.debug(`[PriceOracle-Discovery] Synced ${symbol} to tokenRegistry`);
      }
    } catch (err) {
      logger.debug(`[PriceOracle-Discovery] Failed to sync ${symbol} to tokenRegistry`, { error: err });
    }
  }

  /**
   * Warm cache by fetching prices for newly discovered symbols.
   */
  private async warmCacheForDiscovered(symbols: string[]): Promise<void> {
    logger.info(`[PriceOracle-Discovery] Warming cache for ${symbols.length} newly discovered symbols`);
    try {
      const prices = await this.getPrices(symbols);
      logger.info(`[PriceOracle-Discovery] Cache warmed: ${prices.size}/${symbols.length} symbols`);
    } catch (error) {
      logger.warn('[PriceOracle-Discovery] Cache warming failed', { error });
    }
  }

  /**
   * Allow manual retry of failed discoveries (e.g., after registry update).
   */
  retryFailedDiscoveries(): void {
    const count = this.discovery.failedSymbols.size;
    if (count === 0) {
      logger.info('[PriceOracle-Discovery] No failed discoveries to retry');
      return;
    }

    this.discovery.failedSymbols.forEach((_, symbol) => {
      this.discovery.queue.add(symbol);
    });
    this.discovery.failedSymbols.clear();
    logger.info(`[PriceOracle-Discovery] Queued ${count} previously failed symbols for retry`);

    void this.runDiscovery();
  }

  /**
   * Get discovery statistics for monitoring/observability.
   */
  getDiscoveryStats(): {
    queued: number;
    isRunning: boolean;
    discoveredCount: number;
    failedCount: number;
    lastRun: number;
    knownSymbols: number;
  } {
    return {
      queued: this.discovery.queue.size,
      isRunning: this.discovery.isRunning,
      discoveredCount: this.discovery.discoveredCount,
      failedCount: this.discovery.failedSymbols.size,
      lastRun: this.discovery.lastRun,
      knownSymbols: this.symbolToGeckoId.size,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Rate Limiting
  // ════════════════════════════════════════════════════════════════════════════════

  private shouldApplyBackoff(): boolean {
    const now = Date.now();

    if (now < this.rateLimitState.nextRetryTime) {
      return true;
    }

    const timeSinceReset = now - this.rateLimitState.resetTime;

    if (timeSinceReset >= this.RATE_LIMIT_WINDOW) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.resetTime = now;
      return false;
    }

    if (this.rateLimitState.requestCount >= this.RATE_LIMIT_THRESHOLD) {
      logger.warn(
        `[PriceOracle] Rate limit threshold reached (${this.rateLimitState.requestCount}/${this.RATE_LIMIT_THRESHOLD}), applying backoff`
      );
      this.applyBackoff();
      return true;
    }

    return false;
  }

  private applyBackoff(): void {
    const backoffTime = Math.min(
      1000 * this.rateLimitState.backoffMultiplier,
      60 * 1000
    );
    this.rateLimitState.nextRetryTime = Date.now() + backoffTime;
    this.rateLimitState.backoffMultiplier = Math.min(
      this.rateLimitState.backoffMultiplier * 2,
      this.MAX_BACKOFF_MULTIPLIER
    );
    logger.warn(
      `[PriceOracle] Applying backoff of ${backoffTime}ms (multiplier: ${this.rateLimitState.backoffMultiplier / 2}x)`
    );
  }

  private incrementRateLimitCounter(): void {
    const now = Date.now();
    if (now - this.rateLimitState.resetTime > this.RATE_LIMIT_WINDOW) {
      this.rateLimitState.requestCount = 1;
      this.rateLimitState.resetTime = now;
    } else {
      this.rateLimitState.requestCount++;
    }
  }

  private resetRateLimitState(): void {
    this.rateLimitState = {
      requestCount: 0,
      resetTime: Date.now(),
      backoffMultiplier: 1,
      nextRetryTime: 0,
    };
    logger.info('[PriceOracle] Rate limit state reset after successful recovery');
  }

  private async waitForBackoff(): Promise<void> {
    const backoffNeeded = this.rateLimitState.nextRetryTime - Date.now();
    if (backoffNeeded > 0) {
      logger.debug(`[PriceOracle] Waiting ${backoffNeeded}ms for rate limit backoff`);
      await new Promise((resolve) => setTimeout(resolve, backoffNeeded));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Failure Cooldowns (Per-Source)
  // ════════════════════════════════════════════════════════════════════════════════

  private markFetchFailed(symbol: string, source: 'gateway' | 'coingecko' | 'ccxt' | 'dexscreener'): void {
    const key = symbol.toUpperCase();
    const existing = this.failureCooldowns.get(key) || {};
    existing[source] = Date.now() + this.FAILURE_COOLDOWN_MS;
    this.failureCooldowns.set(key, existing);
  }

  private hasActiveFailureCooldown(
    symbol: string,
    source?: 'gateway' | 'coingecko' | 'ccxt' | 'dexscreener'
  ): boolean {
    const cooldowns = this.failureCooldowns.get(symbol.toUpperCase());
    if (!cooldowns) return false;

    const now = Date.now();
    let hasActive = false;

    for (const [src, until] of Object.entries(cooldowns)) {
      if (until && now >= until) {
        delete cooldowns[src as keyof FailureCooldown];
      } else if (until) {
        hasActive = true;
      }
    }

    if (Object.keys(cooldowns).length === 0) {
      this.failureCooldowns.delete(symbol.toUpperCase());
    }

    if (!source) return hasActive;
    const t = cooldowns[source];
    return t ? Date.now() < t : false;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Redis Cross-Instance Deduplication
  // ════════════════════════════════════════════════════════════════════════════════

  private async acquireFetchLock(symbol: string): Promise<boolean> {
    try {
      const lockKey = `${this.DEDUP_PREFIX}${symbol}`;
      const acquired = await redis.setnx(lockKey, 'fetching', this.DEDUP_TTL);
      return Boolean(acquired);
    } catch (error) {
      logger.debug(`[PriceOracle] Lock acquisition failed for ${symbol}`, { error });
      return true;
    }
  }

  private async extendFetchLock(symbol: string, additionalSeconds: number): Promise<void> {
    try {
      const lockKey = `${this.DEDUP_PREFIX}${symbol}`;
      await redis.expire(lockKey, additionalSeconds);
    } catch (error) {
      logger.debug(`[PriceOracle] Failed to extend lock for ${symbol}`, { error });
    }
  }

  private async releaseFetchLock(symbol: string): Promise<void> {
    try {
      const lockKey = `${this.DEDUP_PREFIX}${symbol}`;
      await redis.del(lockKey);
    } catch (error) {
      logger.debug(`[PriceOracle] Failed to release lock for ${symbol}`, { error });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Cache Management
  // ════════════════════════════════════════════════════════════════════════════════

  private getFromCache(symbol: string, maxAgeMs: number = this.CACHE_DURATION): PriceData | null {
    const cached = this.cache.get(symbol.toUpperCase());
    if (cached && Date.now() - cached.timestamp < maxAgeMs) {
      return cached.data;
    }
    return null;
  }

  private setCache(symbol: string, data: PriceData): void {
    const key = symbol.toUpperCase();

    if (this.cache.size >= this.MAX_CACHE_SIZE && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        logger.debug(`[PriceOracle] Evicted ${oldestKey} from cache (LRU)`);
      }
    }

    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private getResolvedSymbol(symbol: string): string {
    return symbol.toUpperCase();
  }

  private getCoinName(symbol: string): string {
    const uc = symbol.toUpperCase();

    if (!this._tokenRegistryCacheBuilt) {
      this._tokenRegistryCache = this.buildNameCache();
      this._tokenRegistryCacheBuilt = true;
    }

    const fromRegistry = this._tokenRegistryCache?.get(uc);
    if (fromRegistry) return fromRegistry;

    return HARDCODED_NAMES[uc] || uc;
  }

  private buildNameCache(): Map<string, string> {
    try {
      const all = tokenRegistry.getAllTokens();
      const cache = new Map<string, string>();
      for (const token of all) {
        if (token.symbol && token.name) {
          cache.set(token.symbol.toUpperCase(), token.name);
        }
      }
      return cache;
    } catch {
      return new Map<string, string>();
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Gateway Agent Integration
  // ════════════════════════════════════════════════════════════════════════════════

  private async requestPricesFromGateway(
    symbols: string[],
    timeoutMs = 2000
  ): Promise<GatewayPriceResponse | null> {
    const gatewayService = getGatewayAgentService();
    if (!gatewayService.isHealthy()) {
      logger.warn('[PriceOracle] Gateway service is unhealthy; skipping gateway request');
      return null;
    }

    try {
      const p = gatewayService.requestPrices(symbols, undefined, undefined) as Promise<GatewayPriceResponse | null>;

      const result = await Promise.race<GatewayPriceResponse | null>([
        p,
        new Promise<GatewayPriceResponse | null>((_, reject) => {
          const t = setTimeout(() => reject(new Error('Gateway timeout')), timeoutMs);
          p.finally(() => clearTimeout(t));
        }),
      ]);

      return result;
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Gateway timeout') {
        logger.debug('[PriceOracle] Gateway request timed out');
        return null;
      }
      logger.debug('[PriceOracle] Gateway request failed', { error: err });
      return null;
    }
  }

  private async getPricesFromGateway(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();

    if (symbols.length === 0) return prices;

    try {
      const priceRequest = await this.requestPricesFromGateway(symbols, 2000);
      const priceDataList = priceRequest?.payload?.data || [];

      for (const priceData of priceDataList) {
        if (priceData && priceData.price > 0) {
          const result: PriceData = {
            symbol: priceData.symbol.toUpperCase(),
            name: this.getCoinName(priceData.symbol),
            priceUsd: priceData.price,
            priceChange24h: priceData.change24h || 0,
            marketCap: priceData.marketCap || 0,
            volume24h: priceData.volume24h || 0,
            lastUpdated: new Date(),
          };
          prices.set(result.symbol, result);
          this.setCache(result.symbol, result);
        }
      }

      logger.debug(`[PriceOracle-Gateway] Fetched ${prices.size}/${symbols.length} prices`);
      return prices;
    } catch (error) {
      logger.warn('[PriceOracle] Gateway batch failed', { error });
      return prices;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // CoinGecko Integration
  // ════════════════════════════════════════════════════════════════════════════════

  private async getPricesFromCoinGecko(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();

    if (symbols.length === 0) return prices;

    const symbolToId = new Map<string, string>();
    const idToSymbol = new Map<string, string>();

    for (const s of symbols) {
      const rs = this.getResolvedSymbol(s);
      const id = this.resolveToCoinGeckoId(rs);
      if (id) {
        symbolToId.set(rs, id);
        idToSymbol.set(id, rs);
      }
    }

    const coinIds = Array.from(new Set(symbolToId.values()));
    if (coinIds.length === 0) {
      logger.warn(`[PriceOracle] No CoinGecko IDs resolved for: ${symbols.join(', ')}`);
      return prices;
    }

    if (this.shouldApplyBackoff()) {
      await this.waitForBackoff();
    }

    try {
      const response = await fetch(
        `${this.API_BASE}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
      );

      if (response.status === 429) {
        logger.warn('[PriceOracle-CoinGecko] Rate limited (429)');
        this.applyBackoff();
        for (const symbol of symbols) {
          this.markFetchFailed(symbol, 'coingecko');
        }
        return prices;
      }

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      this.incrementRateLimitCounter();

      if (this.rateLimitState.backoffMultiplier > 1) {
        this.resetRateLimitState();
      }

      const data: CoinGeckoResponse = await response.json();

      for (const [coinId, priceData] of Object.entries(data)) {
        if (priceData && priceData.usd > 0) {
          const symbol = idToSymbol.get(coinId) || coinId.toUpperCase();
          const result: PriceData = {
            symbol,
            name: this.getCoinName(symbol),
            priceUsd: priceData.usd,
            priceChange24h: priceData.usd_24h_change || 0,
            marketCap: priceData.usd_market_cap || 0,
            volume24h: priceData.usd_24h_vol || 0,
            lastUpdated: new Date(priceData.last_updated_at * 1000),
          };
          prices.set(symbol, result);
          this.setCache(symbol, result);
        }
      }

      logger.debug(`[PriceOracle-CoinGecko] Fetched ${prices.size}/${coinIds.length} prices`);
      return prices;
    } catch (error) {
      logger.error('[PriceOracle] CoinGecko batch failed', { error });
      for (const symbol of symbols) {
        this.markFetchFailed(symbol, 'coingecko');
      }
      return prices;
    }
  }

  private findTokenMetadata(symbol: string): TokenMetadata | null {
    const upperSymbol = symbol.toUpperCase();
    const candidates = tokenRegistry.getAllTokens().filter(
      (t) => t.symbol?.toUpperCase() === upperSymbol
    );
    if (candidates.length === 0) return null;
    return candidates.find((t) => t.chain === 'celo') || candidates[0];
  }

  private async getPriceFromCCXT(symbol: string): Promise<PriceData | null> {
    try {
      const upperSymbol = symbol.toUpperCase();
      const exchanges = ['binance', 'coinbase', 'kraken'];
      const result = await ccxtService.getBestPrice(upperSymbol, exchanges);
      const best = result?.best;
      if (!best || !best.last || best.last <= 0) {
        throw new Error(`No CCXT price available for ${upperSymbol}`);
      }

      return {
        symbol: upperSymbol,
        name: this.getCoinName(upperSymbol),
        priceUsd: best.last,
        priceChange24h: 0,
        marketCap: 0,
        volume24h: best.volume || 0,
        lastUpdated: new Date(best.timestamp || Date.now()),
      };
    } catch (error) {
      logger.warn('[PriceOracle] CCXT price fetch failed', { error });
      this.markFetchFailed(symbol.toUpperCase(), 'ccxt');
      return null;
    }
  }

  private async getPricesFromCCXT(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    if (symbols.length === 0) return prices;

    await Promise.all(
      symbols.map(async (symbol) => {
        const price = await this.getPriceFromCCXT(symbol);
        if (price) prices.set(symbol.toUpperCase(), price);
      })
    );

    return prices;
  }

  private async getPriceFromDexScreener(symbol: string): Promise<PriceData | null> {
    const upperSymbol = symbol.toUpperCase();
    const tokenMeta = this.findTokenMetadata(upperSymbol);
    if (!tokenMeta || !tokenMeta.address || !tokenMeta.chain) {
      logger.debug(`[PriceOracle] DexScreener lookup skipped for ${upperSymbol} — token metadata unavailable`);
      this.markFetchFailed(upperSymbol, 'dexscreener');
      return null;
    }

    try {
      const pairs = await dexscreenerClient.getTokenPairsOnChain(tokenMeta.chain, tokenMeta.address);
      const validPairs = pairs
        .filter((pair) => pair.priceUsd && Number(pair.priceUsd) > 0)
        .sort((a, b) => {
          const liquidityA = a.liquidity?.usd ?? 0;
          const liquidityB = b.liquidity?.usd ?? 0;
          return liquidityB - liquidityA;
        });
      const bestPair = validPairs[0];
      if (!bestPair || !bestPair.priceUsd) {
        throw new Error(`No DexScreener USD price for ${upperSymbol}`);
      }

      const priceUsd = Number(bestPair.priceUsd);
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
        throw new Error(`Invalid DexScreener price for ${upperSymbol}: ${bestPair.priceUsd}`);
      }

      return {
        symbol: upperSymbol,
        name: this.getCoinName(upperSymbol),
        priceUsd,
        priceChange24h: bestPair.priceChange?.h24 ?? 0,
        marketCap: bestPair.marketCap ?? 0,
        volume24h: bestPair.volume?.h24 ?? 0,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.warn('[PriceOracle] DexScreener price fetch failed', { error });
      this.markFetchFailed(upperSymbol, 'dexscreener');
      return null;
    }
  }

  private async getPricesFromDexScreener(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    if (symbols.length === 0) return prices;

    await Promise.all(
      symbols.map(async (symbol) => {
        const price = await this.getPriceFromDexScreener(symbol);
        if (price) prices.set(symbol.toUpperCase(), price);
      })
    );

    return prices;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Public API: Single Price
  // ════════════════════════════════════════════════════════════════════════════════

  async getPrice(symbol: string): Promise<PriceData | null> {
    const upperSymbol = symbol.toUpperCase();

    // Check failure cooldowns
    const gatewayCooldown = this.hasActiveFailureCooldown(upperSymbol, 'gateway');
    const coingeckoCooldown = this.hasActiveFailureCooldown(upperSymbol, 'coingecko');
    const ccxtCooldown = this.hasActiveFailureCooldown(upperSymbol, 'ccxt');
    const dexscreenerCooldown = this.hasActiveFailureCooldown(upperSymbol, 'dexscreener');

    if (gatewayCooldown && coingeckoCooldown && ccxtCooldown && dexscreenerCooldown) {
      logger.debug(`[PriceOracle-Cooldown] Skipping ${upperSymbol} — all sources in cooldown`);
      const stale = this.getFromCache(upperSymbol, this.LONG_CACHE_DURATION);
      if (stale) {
        logger.debug(`[PriceOracle-Cooldown] Returning stale cache for ${upperSymbol}`);
        return stale;
      }
      return null;
    }

    // Check fresh cache
    const cached = this.getFromCache(upperSymbol);
    if (cached) {
      logger.debug(`[PriceOracle-Cache] Hit for ${upperSymbol}`);
      return cached;
    }

    // Deduplicate concurrent requests
    if (this.pendingRequests.has(upperSymbol)) {
      logger.debug(`[PriceOracle-Dedup] Returning pending request for ${upperSymbol}`);
      return this.pendingRequests.get(upperSymbol)!;
    }

    const requestPromise = this._fetchPrice(upperSymbol);
    this.pendingRequests.set(upperSymbol, requestPromise);

    try {
      return await requestPromise;
    } finally {
      this.pendingRequests.delete(upperSymbol);
    }
  }

  private async _fetchPrice(symbol: string): Promise<PriceData | null> {
    const upperSymbol = symbol.toUpperCase();

    // Try Gateway first
    if (!this.hasActiveFailureCooldown(upperSymbol, 'gateway')) {
      try {
        const gatewayResponse = await this.requestPricesFromGateway([upperSymbol], 2000);
        const priceData = gatewayResponse?.payload?.data?.[0];
        if (priceData && priceData.price > 0) {
          const result: PriceData = {
            symbol: upperSymbol,
            name: this.getCoinName(upperSymbol),
            priceUsd: priceData.price,
            priceChange24h: priceData.change24h || 0,
            marketCap: priceData.marketCap || 0,
            volume24h: priceData.volume24h || 0,
            lastUpdated: new Date(),
          };
          this.setCache(upperSymbol, result);
          logger.debug(`[PriceOracle-Gateway] Price for ${upperSymbol}: $${priceData.price}`);
          return result;
        }
      } catch (gatewayError) {
        logger.warn(
          `[PriceOracle] Gateway failed for ${upperSymbol}: ${gatewayError instanceof Error ? gatewayError.message : String(gatewayError)}`
        );
        this.markFetchFailed(upperSymbol, 'gateway');
      }
    }

    const coinId = this.resolveToCoinGeckoId(upperSymbol);
    if (!coinId) {
      logger.warn(`[PriceOracle] Unknown asset: ${upperSymbol} — queuing for discovery`);
      this.queueForDiscovery(upperSymbol);
    } else if (!this.hasActiveFailureCooldown(upperSymbol, 'coingecko')) {
      try {
        if (this.shouldApplyBackoff()) {
          await this.waitForBackoff();
        }

        const lockAcquired = await this.acquireFetchLock(upperSymbol);
        if (!lockAcquired) {
          logger.debug(`[PriceOracle] Another instance is fetching ${upperSymbol}, waiting...`);
          await new Promise((r) => setTimeout(r, 800));
          const cachedLater = this.getFromCache(upperSymbol);
          if (cachedLater) return cachedLater;
          const stale = this.getFromCache(upperSymbol, this.LONG_CACHE_DURATION);
          if (stale) return stale;
        } else {
          try {
            await this.extendFetchLock(upperSymbol, 30);

            const response = await fetch(
              `${this.API_BASE}/simple/price?ids=${coinId}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
            );

            if (response.status === 429) {
              logger.warn('[PriceOracle] CoinGecko returned 429 (rate limited)');
              this.applyBackoff();
              this.markFetchFailed(upperSymbol, 'coingecko');
            } else if (!response.ok) {
              this.markFetchFailed(upperSymbol, 'coingecko');
              throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
            } else {
              this.incrementRateLimitCounter();

              if (this.rateLimitState.backoffMultiplier > 1) {
                this.resetRateLimitState();
              }

              const data: CoinGeckoResponse = await response.json();
              const coinData = data[coinId];

              if (coinData && coinData.usd > 0) {
                const priceData: PriceData = {
                  symbol: upperSymbol,
                  name: this.getCoinName(upperSymbol),
                  priceUsd: coinData.usd,
                  priceChange24h: coinData.usd_24h_change || 0,
                  marketCap: coinData.usd_market_cap || 0,
                  volume24h: coinData.usd_24h_vol || 0,
                  lastUpdated: new Date(coinData.last_updated_at * 1000),
                };

                this.setCache(upperSymbol, priceData);
                logger.debug(`[PriceOracle-CoinGecko] Price for ${upperSymbol}: $${coinData.usd}`);
                return priceData;
              }

              logger.warn(`[PriceOracle] No CoinGecko price data for ${upperSymbol}`);
              this.markFetchFailed(upperSymbol, 'coingecko');
            }
          } finally {
            await this.releaseFetchLock(upperSymbol);
          }
        }
      } catch (error) {
        logger.error(`[PriceOracle] Error fetching price for ${upperSymbol}`, { error });
        this.markFetchFailed(upperSymbol, 'coingecko');
      }
    } else {
      logger.debug(`[PriceOracle] CoinGecko in cooldown for ${upperSymbol}`);
    }

    if (!this.hasActiveFailureCooldown(upperSymbol, 'dexscreener')) {
      const dexscreenerPrice = await this.getPriceFromDexScreener(upperSymbol);
      if (dexscreenerPrice) {
        this.setCache(upperSymbol, dexscreenerPrice);
        return dexscreenerPrice;
      }
    } else {
      logger.debug(`[PriceOracle] DexScreener in cooldown for ${upperSymbol}`);
    }

    if (!this.hasActiveFailureCooldown(upperSymbol, 'ccxt')) {
      const ccxtPrice = await this.getPriceFromCCXT(upperSymbol);
      if (ccxtPrice) {
        this.setCache(upperSymbol, ccxtPrice);
        return ccxtPrice;
      }
    } else {
      logger.debug(`[PriceOracle] CCXT in cooldown for ${upperSymbol}`);
    }

    return null;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Public API: Batch Prices
  // ════════════════════════════════════════════════════════════════════════════════

  async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
    const key = uniqueSymbols.sort().join(',');

    if (this.pendingBatchRequests.has(key)) {
      logger.debug(`[PriceOracle-Dedup] Returning pending batch for ${uniqueSymbols.length} symbols`);
      return this.pendingBatchRequests.get(key)!;
    }

    const promise = this._getBatchPrices(uniqueSymbols);
    this.pendingBatchRequests.set(key, promise);

    try {
      return await promise;
    } finally {
      this.pendingBatchRequests.delete(key);
    }
  }

  private async _getBatchPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    const notCached: string[] = [];

    for (const symbol of symbols) {
      const cached = this.getFromCache(symbol);
      if (cached) {
        prices.set(symbol, cached);
        logger.debug(`[PriceOracle-Cache] Batch hit for ${symbol}`);
      } else {
        notCached.push(symbol);
      }
    }

    if (notCached.length === 0) {
      return prices;
    }

    // Filter out symbols with both sources in cooldown
    const fetchableSymbols = notCached.filter((s) => {
      const allCooldown =
        this.hasActiveFailureCooldown(s, 'gateway') &&
        this.hasActiveFailureCooldown(s, 'coingecko') &&
        this.hasActiveFailureCooldown(s, 'ccxt') &&
        this.hasActiveFailureCooldown(s, 'dexscreener');
      if (allCooldown) {
        logger.debug(`[PriceOracle-Cooldown] Skipping batch ${s} — all sources in cooldown`);
        const stale = this.getFromCache(s, this.LONG_CACHE_DURATION);
        if (stale) prices.set(s, stale);
      }
      return !allCooldown;
    });

    if (fetchableSymbols.length === 0) {
      return prices;
    }

    // Queue unknown symbols for discovery
    const unknownSymbols = fetchableSymbols.filter((s) => !this.resolveToCoinGeckoId(s));
    for (const s of unknownSymbols) {
      this.queueForDiscovery(s);
    }

    // Only fetch known symbols from CoinGecko
    const knownSymbols = fetchableSymbols.filter((s) => this.resolveToCoinGeckoId(s));

    // Try Gateway for all fetchable
    const gatewaySymbols = fetchableSymbols.filter(
      (s) => !this.hasActiveFailureCooldown(s, 'gateway')
    );

    if (gatewaySymbols.length > 0) {
      try {
        const gatewayPrices = await this.getPricesFromGateway(gatewaySymbols);
        for (const [symbol, data] of gatewayPrices) {
          prices.set(symbol, data);
        }
      } catch (gatewayError) {
        logger.warn('[PriceOracle] Gateway batch failed', { error: gatewayError });
        for (const s of gatewaySymbols) {
          this.markFetchFailed(s, 'gateway');
        }
      }
    }

    // Fallback to CoinGecko for remaining known symbols
    let remaining = knownSymbols.filter((s) => !prices.has(s));
    if (remaining.length === 0) {
      return prices;
    }

    const coingeckoSymbols = remaining.filter(
      (s) => !this.hasActiveFailureCooldown(s, 'coingecko')
    );

    if (coingeckoSymbols.length > 0) {
      try {
        const coingeckoPrices = await this.getPricesFromCoinGecko(coingeckoSymbols);
        for (const [symbol, data] of coingeckoPrices) {
          prices.set(symbol, data);
        }
      } catch (coingeckoError) {
        logger.error('[PriceOracle] CoinGecko batch failed', { error: coingeckoError });
        for (const s of coingeckoSymbols) {
          this.markFetchFailed(s, 'coingecko');
        }
      }
    }

    remaining = remaining.filter((s) => !prices.has(s));
    if (remaining.length === 0) {
      return prices;
    }

    const dexscreenerSymbols = remaining.filter(
      (s) => !this.hasActiveFailureCooldown(s, 'dexscreener')
    );
    if (dexscreenerSymbols.length > 0) {
      try {
        const dexscreenerPrices = await this.getPricesFromDexScreener(dexscreenerSymbols);
        for (const [symbol, data] of dexscreenerPrices) {
          prices.set(symbol, data);
        }
      } catch (dexError) {
        logger.error('[PriceOracle] DexScreener batch failed', { error: dexError });
        for (const s of dexscreenerSymbols) {
          this.markFetchFailed(s, 'dexscreener');
        }
      }
    }

    remaining = remaining.filter((s) => !prices.has(s));
    if (remaining.length === 0) {
      return prices;
    }

    const ccxtSymbols = remaining.filter((s) => !this.hasActiveFailureCooldown(s, 'ccxt'));
    if (ccxtSymbols.length > 0) {
      try {
        const ccxtPrices = await this.getPricesFromCCXT(ccxtSymbols);
        for (const [symbol, data] of ccxtPrices) {
          prices.set(symbol, data);
        }
      } catch (ccxtError) {
        logger.error('[PriceOracle] CCXT batch failed', { error: ccxtError });
        for (const s of ccxtSymbols) {
          this.markFetchFailed(s, 'ccxt');
        }
      }
    }

    return prices;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Public API: Multi-Source Parallel (Cache-Aware)
  // ════════════════════════════════════════════════════════════════════════════════

  async getPricesFromMultipleSources(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase())));

    // Check cache first
    const uncached: string[] = [];
    for (const symbol of uniqueSymbols) {
      const cached = this.getFromCache(symbol);
      if (cached) {
        prices.set(symbol, cached);
        logger.debug(`[PriceOracle-Cache] Multi-source hit for ${symbol}`);
      } else {
        uncached.push(symbol);
      }
    }

    if (uncached.length === 0) {
      logger.debug('[PriceOracle] All prices served from cache');
      return prices;
    }

    // Queue unknowns for discovery
    const unknowns = uncached.filter((s) => !this.resolveToCoinGeckoId(s));
    for (const s of unknowns) {
      this.queueForDiscovery(s);
    }

    const knownUncached = uncached.filter((s) => this.resolveToCoinGeckoId(s));
    if (knownUncached.length === 0) {
      return prices;
    }

    const [gatewayResult, coingeckoResult] = await Promise.allSettled([
      this.getPricesFromGateway(knownUncached),
      this.getPricesFromCoinGecko(knownUncached),
    ]);

    const gatewayPrices =
      gatewayResult.status === 'fulfilled' ? gatewayResult.value : new Map<string, PriceData>();
    const coingeckoPrices =
      coingeckoResult.status === 'fulfilled'
        ? coingeckoResult.value
        : new Map<string, PriceData>();

    for (const symbol of knownUncached) {
      const gatewayData = gatewayPrices.get(symbol);
      const coingeckoData = coingeckoPrices.get(symbol);

      if (gatewayData) {
        prices.set(symbol, gatewayData);
        logger.debug(`[PriceOracle] Using Gateway price for ${symbol}`);
      } else if (coingeckoData) {
        prices.set(symbol, coingeckoData);
        logger.debug(`[PriceOracle] Using CoinGecko price for ${symbol}`);
      } else {
        logger.warn(`[PriceOracle] No price available for ${symbol} from any source`);
      }
    }

    return prices;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Public API: Historical Prices
  // ════════════════════════════════════════════════════════════════════════════════

  async getHistoricalPrices(
    symbol: string,
    days: number = 30
  ): Promise<Array<{ date: Date; price: number }>> {
    try {
      const upperSymbol = symbol.toUpperCase();
      const coinId = this.resolveToCoinGeckoId(upperSymbol);

      if (!coinId) {
        logger.warn(`[PriceOracle] Unsupported symbol for historical prices: ${upperSymbol}`);
        this.queueForDiscovery(upperSymbol);
        return [];
      }

      if (this.shouldApplyBackoff()) {
        await this.waitForBackoff();
      }

      const response = await fetch(
        `${this.API_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
      );

      if (response.status === 429) {
        logger.warn('[PriceOracle] CoinGecko historical returned 429 (rate limited)');
        this.applyBackoff();
        return [];
      }

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      this.incrementRateLimitCounter();

      const data = await response.json();

      return data.prices.map(([timestamp, price]: [number, number]) => ({
        date: new Date(timestamp),
        price,
      }));
    } catch (error) {
      logger.error(`[PriceOracle] Error fetching historical prices for ${symbol}`, { error });
      return [];
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Public API: Portfolio Value
  // ════════════════════════════════════════════════════════════════════════════════

  async calculatePortfolioValue(
    holdings: Array<{ symbol: string; balance: number }>
  ): Promise<number> {
    const symbols = holdings.map((h) => h.symbol);
    const prices = await this.getPrices(symbols);

    let totalValue = 0;
    for (const holding of holdings) {
      const upperSymbol = holding.symbol.toUpperCase();
      const price = prices.get(upperSymbol);
      if (price) {
        totalValue += holding.balance * price.priceUsd;
      }
    }

    return totalValue;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // Utility / Introspection
  // ════════════════════════════════════════════════════════════════════════════════

  clearCache(): void {
    this.cache.clear();
    logger.info('[PriceOracle] Cache cleared');
  }

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

  getSupportedCurrencies(): string[] {
    return Array.from(this.symbolToGeckoId.keys());
  }

  getFallbackChain(symbol: string): string[] {
    return [];
  }
}

export const priceOracle = new PriceOracleService();