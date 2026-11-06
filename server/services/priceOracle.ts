/**
 * Price Oracle Service (Production)
 *
 * Display path  → getPrice / getPrices          (availability-oriented)
 * Valuation path → getValuationPrice / getValuationPrices  (integrity-oriented)
 *
 * Valuation guarantees
 * ─────────────────────────────────────────────────────────────
 * • Allowlisted symbols only (no auto-discovery)
 * • Quorum of independent sources within max deviation
 * • Median of agreeing sources (not first success)
 * • DEX ignored unless liquidity ≥ floor
 * • CEX uses multi-exchange mid (bid/ask), rejects stale/crossed
 * • Circuit breaker on jumps vs last good valuation
 * • Fail closed when confidence is insufficient
 * • Full source audit trail on every valuation
 */

import { logger } from '../utils/logger';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { getGatewayAgentService } from '../core/agents/gateway/service';
import { getGatewayService } from './gateway';
import type { GatewayEvent } from './gateway/types';
import { redis } from './redis';
import { ccxtService } from './ccxtService';
import { dexscreenerClient } from './dexscreenerClient';
import { tokenRegistry, type TokenMetadata } from './tokenRegistry';
import { valuationAssets } from '../../shared/schema';
import {
  ChainlinkFeedReader,
  parseChainlinkFeedConfig,
  defaultChainlinkProvider,
  type ChainlinkFeedConfig,
  type ChainlinkFeedKind,
  type ChainlinkMode,
  type ChainlinkObservation,
} from './chainlinkFeedReader';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PriceData {
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: Date;
  /** Present on display path only when known */
  source?: PriceSource;
}

export type PriceSource = 'gateway' | 'coingecko' | 'ccxt' | 'dexscreener' | 'chainlink';

export interface ChainlinkValuationStatus {
  mode: ChainlinkMode;
  kind: ChainlinkFeedKind;
  status: 'shadow' | 'quorum' | 'agreed' | 'unavailable';
  priceUsd?: number;
  deviationPct?: number;
  feedUpdatedAt?: string;
}

export interface SourceQuote {
  source: PriceSource;
  priceUsd: number;
  /** Extra quality signals */
  liquidityUsd?: number;
  exchangeCount?: number;
  asOf: number;
  raw?: unknown;
}

export type ValuationConfidence = 'high' | 'medium' | 'low' | 'none';

export interface ValuationPrice {
  symbol: string;
  priceUsd: number;
  confidence: ValuationConfidence;
  /** Sources that participated in the median */
  sourcesUsed: SourceQuote[];
  /** Sources fetched but rejected (outlier, low liquidity, stale, …) */
  sourcesRejected: Array<SourceQuote & { reason: string }>;
  asOf: Date;
  /** Circuit breaker tripped */
  frozen?: boolean;
  haircutPriceUsd?: number; // price after optional risk haircut
  /** Records whether a configured Chainlink feed was unavailable, agreed, or observed. */
  chainlink?: ChainlinkValuationStatus;
}

export interface ValuationOptions {
  /** Require more independent sources than the configured minimum */
  minSources?: number;
  /** Require tighter agreement than the configured maximum */
  maxDeviationPct?: number;
  /** Apply risk haircut (default true for non-stables) */
  applyHaircut?: boolean;
  /** Retained for API compatibility; frozen valuations always fail closed */
  failOnFreeze?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const cfg = {
  cacheTtlMs: Number(process.env.PRICE_ORACLE_CACHE_MS ?? 60_000),
  longCacheTtlMs: Number(process.env.PRICE_ORACLE_LONG_CACHE_MS ?? 300_000),
  maxCacheSize: Number(process.env.PRICE_ORACLE_MAX_CACHE ?? 1_000),
  failureCooldownMs: Number(process.env.PRICE_ORACLE_FAILURE_COOLDOWN_MS ?? 5_000),
  dedupTtlSec: Number(process.env.PRICE_ORACLE_DEDUP_TTL_SEC ?? 15),
  rateLimitThreshold: Number(process.env.PRICE_ORACLE_RATE_LIMIT ?? 10),
  rateLimitWindowMs: 60_000,
  maxBackoffMultiplier: 32,

  // Valuation
  valuationMinSources: Number(process.env.VALUATION_MIN_SOURCES ?? 2),
  valuationMaxAgeMs: Number(process.env.VALUATION_MAX_AGE_MS ?? 15_000),
  valuationCexMinExchanges: Number(process.env.VALUATION_CEX_MIN_EXCHANGES ?? 2),
  valuationCexMaxQuoteAgeMs: Number(
    process.env.VALUATION_CEX_MAX_QUOTE_AGE_MS ?? 5_000
  ),
  valuationDexMinLiquidityUsd: Number(
    process.env.VALUATION_DEX_MIN_LIQUIDITY_USD ?? 25_000
  ),
  /** Circuit: freeze if move exceeds this % vs last good within window */
  circuitMaxJumpPct: Number(process.env.VALUATION_CIRCUIT_JUMP_PCT ?? 8),
  circuitWindowMs: Number(process.env.VALUATION_CIRCUIT_WINDOW_MS ?? 60_000),
};

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

type ValuationAssetClass = 'stable' | 'major' | 'mid' | 'alt';

interface ValuationAssetConfig {
  coingeckoId?: string;
  assetClass: ValuationAssetClass;
  maxDeviationPct: number;
  haircutPct: number;
  chain?: string;
  contractAddress?: string;
}

const HARDCODED_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
  USDC: 'USD Coin',
  USDT: 'Tether',
  CELO: 'Celo',
  CUSD: 'Celo Dollar',
  CEUR: 'Celo Euro',
  WBTC: 'Wrapped Bitcoin',
};

// ─────────────────────────────────────────────────────────────
// Small utilities
// ─────────────────────────────────────────────────────────────

class TtlMap<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();

  set(key: string, value: T, ttlMs: number): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get(key: string): T | undefined {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (Date.now() >= e.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return e.value;
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
    for (const [k, e] of this.entries) {
      if (now >= e.expiresAt) this.entries.delete(k);
    }
  }

  get size(): number {
    this.pruneExpired();
    return this.entries.size;
  }

  forEach(cb: (value: T, key: string) => void): void {
    this.pruneExpired();
    for (const [k, e] of this.entries) cb(e.value, k);
  }
}

function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function relDeviation(a: number, b: number): number {
  const midpoint = (a + b) / 2;
  if (midpoint <= 0) return Infinity;
  return (Math.abs(a - b) / midpoint) * 100;
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

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
  chainlink?: number;
}

interface DiscoveryState {
  queue: Set<string>;
  isRunning: boolean;
  lastRun: number;
  discoveredCount: number;
  failedSymbols: TtlMap<number>;
}

interface LastGoodValuation {
  priceUsd: number;
  at: number;
}

export class PriceOracleService {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, Promise<PriceData | null>>();
  private pendingBatchRequests = new Map<string, Promise<Map<string, PriceData>>>();
  private pendingValuationRequests = new Map<string, Promise<ValuationPrice | null>>();
  private failureCooldowns = new Map<string, FailureCooldown>();
  private lastGoodValuation = new Map<string, LastGoodValuation>();
  private frozenUntil = new Map<string, number>(); // circuit breaker
  private valuationCache = new TtlMap<ValuationPrice>();
  private valuationAllowlist = new Map<string, ValuationAssetConfig>();
  private chainlinkReader = new ChainlinkFeedReader({ getProvider: defaultChainlinkProvider });
  private chainlinkFeeds = new Map<string, ChainlinkFeedConfig>();
  private chainlinkDisabled = new Set<string>();
  private chainlinkInvalidSymbols = new Set<string>();
  private chainlinkGlobalConfigInvalid = false;
  private chainlinkReady: Promise<void> = Promise.resolve();

  private rateLimitState: RateLimitState = {
    requestCount: 0,
    resetTime: Date.now(),
    backoffMultiplier: 1,
    nextRetryTime: 0,
  };

  private discovery: DiscoveryState = {
    queue: new Set(),
    isRunning: false,
    lastRun: 0,
    discoveredCount: 0,
    failedSymbols: new TtlMap(),
  };
  private discoveryTimeout?: ReturnType<typeof setTimeout>;

  /** Display + discovery mappings may grow; valuation eligibility is DB-admin controlled. */
  private symbolToGeckoId = new Map<string, string>();

  private _tokenRegistryCache: Map<string, string> | null = null;
  private _tokenRegistryCacheBuilt = false;
  private _coinGeckoListCache: Array<{ id: string; symbol: string; name: string }> | null =
    null;
  private _coinGeckoListCacheTime = 0;

  constructor() {
    this.subscribeToGatewayEvents();
    this.chainlinkReady = this.initChainlinkFeeds();
    void this.reloadValuationAllowlist().catch((err) => {
      logger.error('[PriceOracle] Failed to load valuation allowlist', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
    void this.seedFromTokenRegistry().catch((err) => {
      logger.warn('[PriceOracle] seedFromTokenRegistry failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // VALUATION API (strict)
  // ═══════════════════════════════════════════════════════════

  /**
   * Manipulation-resistant valuation price.
   * Fail closed: returns null if quorum/confidence insufficient.
   */
  async getValuationPrice(
    symbol: string,
    options: ValuationOptions = {}
  ): Promise<ValuationPrice | null> {
    const upper = symbol.toUpperCase();
    const allow = this.valuationAllowlist.get(upper);
    if (!allow) {
      logger.warn('[PriceOracle:Valuation] Symbol not allowlisted', { symbol: upper });
      return null;
    }

    const minSources = Math.max(cfg.valuationMinSources, options.minSources ?? 0);
    const maxDeviationPct = Math.min(
      allow.maxDeviationPct,
      options.maxDeviationPct ?? allow.maxDeviationPct
    );
    const applyHaircut = options.applyHaircut !== false;
    const cacheKey = `${upper}:${minSources}:${maxDeviationPct}:${applyHaircut ? 'haircut' : 'raw'}`;
    const cached = this.valuationCache.get(cacheKey);
    if (cached && Date.now() - cached.asOf.getTime() <= cfg.valuationMaxAgeMs) {
      return cached;
    }
    const pending = this.pendingValuationRequests.get(cacheKey);
    if (pending) return pending;

    const request = this.fetchValuationPrice(upper, allow, options);
    this.pendingValuationRequests.set(cacheKey, request);
    try {
      return await request;
    } finally {
      this.pendingValuationRequests.delete(cacheKey);
    }
  }

  private async fetchValuationPrice(
    upper: string,
    allow: ValuationAssetConfig,
    options: ValuationOptions
  ): Promise<ValuationPrice | null> {
    // Circuit still open?
    const frozenUntil = this.frozenUntil.get(upper) ?? 0;
    if (Date.now() < frozenUntil) {
      logger.error('[PriceOracle:Valuation] Circuit open — fail closed', { symbol: upper });
      return null;
    }

    const minSources = Math.max(cfg.valuationMinSources, options.minSources ?? 0);
    const maxDev = Math.min(allow.maxDeviationPct, options.maxDeviationPct ?? allow.maxDeviationPct);

    await this.chainlinkReady;
    if (this.chainlinkGlobalConfigInvalid || this.chainlinkInvalidSymbols.has(upper)) {
      logger.error('[PriceOracle:Valuation] Invalid Chainlink feed configuration — fail closed', {
        symbol: upper,
      });
      return null;
    }

    const feed = this.chainlinkFeeds.get(upper);
    const [quotes, chainlinkQuote] = await Promise.all([
      this.collectValuationQuotes(upper, allow),
      feed && feed.mode !== 'off'
        ? this.quoteChainlink(feed)
        : Promise.resolve(null),
    ]);
    if (feed?.mode === 'quorum' && chainlinkQuote) quotes.push(chainlinkQuote);
    const accepted: SourceQuote[] = [];
    const rejected: Array<SourceQuote & { reason: string }> = [];

    const now = Date.now();
    const maxQuoteAgeMs = cfg.valuationMaxAgeMs * 4;
    for (const quote of quotes) {
      const ageMs = now - quote.asOf;
      if (!Number.isFinite(quote.priceUsd) || quote.priceUsd <= 0) {
        rejected.push({ ...quote, reason: 'non-positive or invalid price' });
      } else if (!Number.isFinite(quote.asOf) || ageMs < 0 || ageMs > maxQuoteAgeMs) {
        rejected.push({ ...quote, reason: `stale or future-dated quote (${ageMs}ms)` });
      } else {
        accepted.push(quote);
      }
    }

    // A provider family contributes at most one quote to quorum.
    const bySource = new Map<PriceSource, SourceQuote>();
    for (const quote of accepted) {
      if (!bySource.has(quote.source)) bySource.set(quote.source, quote);
    }
    accepted.length = 0;
    accepted.push(...bySource.values());

    // Outlier rejection against the median of independent source families.
    const rawPrices = accepted.map((q) => q.priceUsd);
    if (rawPrices.length >= 2) {
      const med = median(rawPrices);
      const kept: SourceQuote[] = [];
      for (const q of accepted) {
        if (relDeviation(q.priceUsd, med) <= maxDev) {
          kept.push(q);
        } else {
          rejected.push({ ...q, reason: `outlier vs median ${med}: ${q.priceUsd}` });
        }
      }
      accepted.length = 0;
      accepted.push(...kept);
    }

    if (accepted.length < minSources) {
      logger.warn('[PriceOracle:Valuation] Quorum failed', {
        symbol: upper,
        accepted: accepted.length,
        required: minSources,
        rejected: rejected.map((r) => ({ source: r.source, reason: r.reason })),
      });
      return null;
    }

    const priceUsd = median(accepted.map((q) => q.priceUsd));
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

    const chainlinkEvaluation = this.evaluateChainlink(
      upper,
      feed,
      chainlinkQuote,
      priceUsd
    );
    if (chainlinkEvaluation.reject) return null;

    // Circuit breaker vs last good
    const last = this.lastGoodValuation.get(upper);
    if (last && Date.now() - last.at < cfg.circuitWindowMs) {
      const jump = relDeviation(priceUsd, last.priceUsd);
      if (jump > cfg.circuitMaxJumpPct) {
        this.frozenUntil.set(upper, Date.now() + cfg.circuitWindowMs);
        logger.error('[PriceOracle:Valuation] Circuit breaker tripped', {
          symbol: upper,
          previous: last.priceUsd,
          next: priceUsd,
          jumpPct: jump,
        });
        return null;
      }
    }

    this.lastGoodValuation.set(upper, { priceUsd, at: Date.now() });

    const confidence = this.scoreConfidence(accepted, allow.assetClass);

    const result: ValuationPrice = {
      symbol: upper,
      priceUsd,
      confidence,
      sourcesUsed: accepted,
      sourcesRejected: rejected,
      asOf: new Date(Math.min(...accepted.map((quote) => quote.asOf))),
      haircutPriceUsd: this.applyHaircut(priceUsd, allow, options),
      ...(chainlinkEvaluation.status ? { chainlink: chainlinkEvaluation.status } : {}),
    };
    const cacheKey = `${upper}:${minSources}:${maxDev}:${options.applyHaircut !== false ? 'haircut' : 'raw'}`;
    this.valuationCache.set(cacheKey, result, Math.min(cfg.cacheTtlMs, 5_000));

    logger.info('[PriceOracle:Valuation] OK', {
      symbol: upper,
      priceUsd,
      confidence,
      sources: accepted.map((s) => s.source),
      asOf: result.asOf.toISOString(),
    });

    return result;
  }

  async getValuationPrices(
    symbols: string[],
    options: ValuationOptions = {}
  ): Promise<Map<string, ValuationPrice>> {
    const out = new Map<string, ValuationPrice>();
    await Promise.all(
      symbols.map(async (s) => {
        const v = await this.getValuationPrice(s, options);
        if (v) out.set(s.toUpperCase(), v);
      })
    );
    return out;
  }

  /** Symbols permitted for settlement / TVL */
  getValuationAllowlist(): string[] {
    return Array.from(this.valuationAllowlist.keys()).sort();
  }

  isValuationAllowlisted(symbol: string): boolean {
    return this.valuationAllowlist.has(symbol.toUpperCase());
  }

  async reloadValuationAllowlist(): Promise<number> {
    const rows = await db
      .select()
      .from(valuationAssets)
      .where(eq(valuationAssets.isActive, true));
    const next = new Map<string, ValuationAssetConfig>();

    for (const row of rows) {
      const symbol = row.symbol.trim().toUpperCase();
      const assetClass = row.assetClass as ValuationAssetClass;
      const maxDeviationPct = Number(row.maxDeviationPct);
      const haircutPct = Number(row.haircutPct);

      if (
        !symbol ||
        !['stable', 'major', 'mid', 'alt'].includes(assetClass) ||
        !Number.isFinite(maxDeviationPct) ||
        maxDeviationPct <= 0 ||
        maxDeviationPct > 25 ||
        !Number.isFinite(haircutPct) ||
        haircutPct < 0 ||
        haircutPct > 50
      ) {
        logger.error('[PriceOracle] Ignoring invalid valuation asset configuration', {
          symbol: row.symbol,
        });
        continue;
      }

      next.set(symbol, {
        coingeckoId: row.coingeckoId ?? undefined,
        assetClass,
        maxDeviationPct,
        haircutPct,
        chain: row.chain ?? undefined,
        contractAddress: row.contractAddress ?? undefined,
      });
      if (row.coingeckoId) this.symbolToGeckoId.set(symbol, row.coingeckoId);
    }

    this.valuationAllowlist = next;
    this.valuationCache.clear();
    logger.info('[PriceOracle] Valuation allowlist reloaded', { count: next.size });
    return next.size;
  }

  private applyHaircut(
    price: number,
    allow: ValuationAssetConfig,
    options: ValuationOptions
  ): number {
    if (options.applyHaircut === false) return price;
    return price * (1 - allow.haircutPct / 100);
  }

  private scoreConfidence(
    sources: SourceQuote[],
    assetClass: string
  ): ValuationConfidence {
    if (sources.length >= 3) return 'high';
    if (sources.length === 2) {
      return assetClass === 'stable' || assetClass === 'major' ? 'high' : 'medium';
    }
    if (sources.length === 1) return 'low';
    return 'none';
  }

  private async collectValuationQuotes(
    symbol: string,
    allow: ValuationAssetConfig
  ): Promise<SourceQuote[]> {
    const quotes: SourceQuote[] = [];

    const tasks: Array<Promise<void>> = [
      this.quoteCex(symbol).then((q) => {
        if (q) quotes.push(q);
      }),
      this.quoteCoinGeckoValuation(symbol, allow.coingeckoId).then((q) => {
        if (q) quotes.push(q);
      }),
      this.quoteDexScreenerValuation(allow).then((q) => {
        if (q) quotes.push(q);
      }),
    ];

    await Promise.allSettled(tasks);
    return quotes;
  }

  private async initChainlinkFeeds(): Promise<void> {
    const rawConfig = process.env.CHAINLINK_VALUATION_FEEDS;
    const { feeds, errors, invalidSymbols } = parseChainlinkFeedConfig(rawConfig);
    this.chainlinkInvalidSymbols = invalidSymbols;

    if (rawConfig?.trim() && errors.length > 0 && invalidSymbols.size === 0) {
      this.chainlinkGlobalConfigInvalid = true;
    }
    for (const error of errors) {
      logger.error('[PriceOracle:Chainlink] Invalid feed configuration — skipped', { error });
    }

    const validations = await Promise.allSettled(
      [...feeds.values()]
        .filter((feed) => feed.mode !== 'off')
        .map(async (feed) => {
          try {
            const result = await this.chainlinkReader.validate(feed);
            logger.info('[PriceOracle:Chainlink] Feed validated', {
              symbol: feed.symbol,
              chainId: feed.chainId,
              address: feed.address,
              description: result.description,
              decimals: result.decimals,
              mode: feed.mode,
            });
          } catch (error) {
            this.chainlinkDisabled.add(feed.symbol);
            logger.error('[PriceOracle:Chainlink] Feed validation failed — disabled', {
              symbol: feed.symbol,
              mode: feed.mode,
              onMissing: feed.onMissing,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })
    );
    for (const result of validations) {
      if (result.status === 'rejected') {
        logger.error('[PriceOracle:Chainlink] Unexpected feed validation failure', {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
    this.chainlinkFeeds = feeds;
  }

  private async quoteChainlink(feed: ChainlinkFeedConfig): Promise<SourceQuote | null> {
    if (this.chainlinkDisabled.has(feed.symbol)) return null;
    try {
      const observation = await this.chainlinkReader.read(feed);
      return {
        source: 'chainlink',
        priceUsd: observation.priceUsd,
        asOf: observation.observedAtMs,
        raw: observation,
      };
    } catch (error) {
      logger.warn('[PriceOracle:Valuation] Chainlink read failed', {
        symbol: feed.symbol,
        mode: feed.mode,
        chainId: feed.chainId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private evaluateChainlink(
    symbol: string,
    feed: ChainlinkFeedConfig | undefined,
    quote: SourceQuote | null,
    marketPriceUsd: number
  ): { reject: boolean; status?: ChainlinkValuationStatus } {
    if (!feed || feed.mode === 'off') return { reject: false };
    const base = { mode: feed.mode, kind: feed.kind };

    if (!quote) {
      if (feed.mode === 'anchor' && feed.onMissing === 'fail') {
        logger.error('[PriceOracle:Valuation] Chainlink anchor unavailable — fail closed', {
          symbol,
        });
        return { reject: true };
      }
      return {
        reject: false,
        status: { ...base, status: 'unavailable' },
      };
    }

    const observation = quote.raw as ChainlinkObservation;
    const deviationPct = relDeviation(quote.priceUsd, marketPriceUsd);
    const detail = {
      priceUsd: quote.priceUsd,
      deviationPct,
      feedUpdatedAt: new Date(observation.updatedAtMs).toISOString(),
    };

    if (feed.mode === 'shadow') {
      logger.info('[PriceOracle:Valuation:ChainlinkShadow]', {
        symbol,
        kind: feed.kind,
        marketPriceUsd,
        chainlinkAgeSeconds: observation.ageSeconds,
        heartbeatSeconds: observation.heartbeatSeconds,
        chainId: observation.chainId,
        roundId: observation.roundId,
        ...detail,
      });
      return {
        reject: false,
        status: { ...base, status: 'shadow', ...detail },
      };
    }

    if (feed.mode === 'quorum') {
      return {
        reject: false,
        status: { ...base, status: 'quorum', ...detail },
      };
    }

    if (deviationPct > (feed.anchorMaxDeviationPct ?? 0)) {
      logger.error('[PriceOracle:Valuation] Chainlink anchor deviation — fail closed', {
        symbol,
        marketPriceUsd,
        limitPct: feed.anchorMaxDeviationPct,
        ...detail,
      });
      return { reject: true };
    }
    return {
      reject: false,
      status: { ...base, status: 'agreed', ...detail },
    };
  }

  /** CEX: median mid across exchanges, stale/crossed rejected */
  private async quoteCex(symbol: string): Promise<SourceQuote | null> {
    try {
      const exchanges = ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'];
      // Only direct USD markets qualify; stable-quoted markets would assume a peg
      // and can conceal stablecoin depegs.
      const pair = `${symbol}/USD`;
      const exchangeQuotes = await Promise.all(
        exchanges.map(async (exchange) => {
          try {
            const t = await ccxtService.getTickerFromExchange(exchange, pair);
            if (!t) return null;
            if (
              !Number.isFinite(t.timestamp) ||
              t.timestamp <= 0 ||
              t.timestamp > Date.now() + 1_000 ||
              Date.now() - t.timestamp > cfg.valuationCexMaxQuoteAgeMs
            ) return null;
            if (!(t.bid > 0 && t.ask > 0) || t.ask < t.bid) return null;
            const mid = (t.bid + t.ask) / 2;
            return mid > 0 ? { mid, timestamp: t.timestamp } : null;
          } catch {
            return null;
          }
        })
      );
      const validQuotes = exchangeQuotes.filter(
        (quote): quote is NonNullable<typeof quote> => quote !== null
      );

      if (validQuotes.length < cfg.valuationCexMinExchanges) return null;

      return {
        source: 'ccxt',
        priceUsd: median(validQuotes.map((quote) => quote.mid)),
        exchangeCount: validQuotes.length,
        asOf: Math.max(...validQuotes.map((quote) => quote.timestamp)) || Date.now(),
      };
    } catch (err) {
      logger.debug('[PriceOracle:Valuation] CEX quote failed', {
        symbol,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /** DEX quote for chain-specific assets; only liquid pools qualify. */
  private async quoteDexScreenerValuation(
    allow: ValuationAssetConfig
  ): Promise<SourceQuote | null> {
    if (!allow.chain || !allow.contractAddress) return null;
    if (!Number.isFinite(cfg.valuationDexMinLiquidityUsd) || cfg.valuationDexMinLiquidityUsd < 0) {
      logger.error('[PriceOracle:Valuation] Invalid DEX liquidity floor', {
        floor: cfg.valuationDexMinLiquidityUsd,
      });
      return null;
    }

    try {
      const tokenAddress = allow.contractAddress.toLowerCase();
      const pairs = await dexscreenerClient.getTokenPairsOnChain(
        allow.chain.toLowerCase(),
        allow.contractAddress
      );
      const prices = pairs
        .filter((pair) => pair.chainId.toLowerCase() === allow.chain!.toLowerCase())
        .map((pair) => {
          const liquidityUsd = Number(pair.liquidity?.usd);
          if (!Number.isFinite(liquidityUsd) || liquidityUsd < cfg.valuationDexMinLiquidityUsd) {
            return null;
          }

          if (pair.baseToken.address.toLowerCase() !== tokenAddress) return null;
          const priceUsd = Number(pair.priceUsd);

          return Number.isFinite(priceUsd) && priceUsd > 0
            ? { priceUsd, liquidityUsd, pairAddress: pair.pairAddress, dexId: pair.dexId }
            : null;
        })
        .filter((pair): pair is NonNullable<typeof pair> => pair !== null)
        .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
        .slice(0, 5);

      if (prices.length === 0) return null;

      return {
        source: 'dexscreener',
        priceUsd: median(prices.map((pair) => pair.priceUsd)),
        liquidityUsd: prices.reduce((total, pair) => total + pair.liquidityUsd, 0),
        asOf: Date.now(),
        raw: prices,
      };
    } catch (error) {
      logger.debug('[PriceOracle:Valuation] DEX quote failed', {
        chain: allow.chain,
        contractAddress: allow.contractAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async quoteCoinGeckoValuation(
    symbol: string,
    fixedId?: string
  ): Promise<SourceQuote | null> {
    const id = fixedId || this.symbolToGeckoId.get(symbol);
    if (!id) return null;

    try {
      if (this.shouldApplyBackoff()) await this.waitForBackoff();

      const res = await fetch(
        `${COINGECKO_API}/simple/price?ids=${id}&vs_currencies=usd&include_last_updated_at=true`,
        { signal: AbortSignal.timeout(5_000) }
      );
      if (res.status === 429) {
        this.applyBackoff();
        return null;
      }
      if (!res.ok) return null;
      this.incrementRateLimitCounter();

      const data = (await res.json()) as Record<
        string,
        { usd?: number; last_updated_at?: number }
      >;
      const row = data[id];
      if (
        !Number.isFinite(row?.usd) ||
        !row?.usd ||
        row.usd <= 0 ||
        row?.last_updated_at === undefined ||
        !Number.isFinite(row?.last_updated_at)
      ) return null;

      const asOf = row.last_updated_at * 1000;
      if (Date.now() - asOf > cfg.valuationMaxAgeMs * 4 || asOf > Date.now() + 1_000) {
        return null;
      }

      return {
        source: 'coingecko',
        priceUsd: row.usd,
        asOf: asOf || Date.now(),
      };
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DISPLAY API (soft — existing behavior, tightened slightly)
  // ═══════════════════════════════════════════════════════════

  async getPrice(symbol: string): Promise<PriceData | null> {
    const upper = symbol.toUpperCase();

    if (
      this.hasActiveFailureCooldown(upper, 'gateway') &&
      this.hasActiveFailureCooldown(upper, 'coingecko') &&
      this.hasActiveFailureCooldown(upper, 'ccxt') &&
      this.hasActiveFailureCooldown(upper, 'dexscreener')
    ) {
      return this.getFromCache(upper, cfg.longCacheTtlMs);
    }

    const cached = this.getFromCache(upper);
    if (cached) return cached;

    if (this.pendingRequests.has(upper)) {
      return this.pendingRequests.get(upper)!;
    }

    const p = this._fetchPriceDisplay(upper);
    this.pendingRequests.set(upper, p);
    try {
      return await p;
    } finally {
      this.pendingRequests.delete(upper);
    }
  }

  async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
    const key = unique.sort().join(',');
    if (this.pendingBatchRequests.has(key)) {
      return this.pendingBatchRequests.get(key)!;
    }
    const promise = this._getBatchPricesDisplay(unique);
    this.pendingBatchRequests.set(key, promise);
    try {
      return await promise;
    } finally {
      this.pendingBatchRequests.delete(key);
    }
  }

  private async _fetchPriceDisplay(symbol: string): Promise<PriceData | null> {
    // Gateway
    if (!this.hasActiveFailureCooldown(symbol, 'gateway')) {
      try {
        const resp = await this.requestPricesFromGateway([symbol], 2_000);
        const row = resp?.payload?.data?.[0];
        if (row && Number.isFinite(row.price) && row.price > 0) {
          const data = this.toPriceData(symbol, row.price, row);
          this.setCache(symbol, data);
          return data;
        }
      } catch {
        this.markFetchFailed(symbol, 'gateway');
      }
    }

    const geckoId = this.symbolToGeckoId.get(symbol);
    if (!geckoId) {
      this.queueForDiscovery(symbol); // display only
    } else if (!this.hasActiveFailureCooldown(symbol, 'coingecko')) {
      const g = await this.fetchCoinGeckoSingle(symbol, geckoId);
      if (g) return g;
    }

    if (!this.hasActiveFailureCooldown(symbol, 'dexscreener')) {
      const d = await this.getPriceFromDexScreener(symbol);
      if (d) {
        this.setCache(symbol, d);
        return d;
      }
    }

    if (!this.hasActiveFailureCooldown(symbol, 'ccxt')) {
      const c = await this.getPriceFromCCXT(symbol);
      if (c) {
        this.setCache(symbol, c);
        return c;
      }
    }

    return this.getFromCache(symbol, cfg.longCacheTtlMs);
  }

  private async _getBatchPricesDisplay(
    symbols: string[]
  ): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    const missing: string[] = [];

    for (const s of symbols) {
      const c = this.getFromCache(s);
      if (c) prices.set(s, c);
      else missing.push(s);
    }
    if (!missing.length) return prices;

    for (const s of missing) {
      if (!this.symbolToGeckoId.has(s)) this.queueForDiscovery(s);
    }

    const gw = missing.filter((s) => !this.hasActiveFailureCooldown(s, 'gateway'));
    if (gw.length) {
      const map = await this.getPricesFromGateway(gw);
      for (const [k, v] of map) prices.set(k, v);
    }

    let left = missing.filter((s) => !prices.has(s) && this.symbolToGeckoId.has(s));
    const cg = left.filter((s) => !this.hasActiveFailureCooldown(s, 'coingecko'));
    if (cg.length) {
      const map = await this.getPricesFromCoinGecko(cg);
      for (const [k, v] of map) prices.set(k, v);
    }

    left = missing.filter((s) => !prices.has(s));
    for (const s of left) {
      if (!this.hasActiveFailureCooldown(s, 'dexscreener')) {
        const d = await this.getPriceFromDexScreener(s);
        if (d) {
          prices.set(s, d);
          this.setCache(s, d);
        }
      }
    }

    left = missing.filter((s) => !prices.has(s));
    for (const s of left) {
      if (!this.hasActiveFailureCooldown(s, 'ccxt')) {
        const c = await this.getPriceFromCCXT(s);
        if (c) {
          prices.set(s, c);
          this.setCache(s, c);
        }
      }
    }

    return prices;
  }

  // ═══════════════════════════════════════════════════════════
  // Shared source helpers (display)
  // ═══════════════════════════════════════════════════════════

  private toPriceData(
    symbol: string,
    priceUsd: number,
    extra?: { change24h?: number; marketCap?: number; volume24h?: number }
  ): PriceData {
    return {
      symbol: symbol.toUpperCase(),
      name: this.getCoinName(symbol),
      priceUsd,
      priceChange24h: extra?.change24h ?? 0,
      marketCap: extra?.marketCap ?? 0,
      volume24h: extra?.volume24h ?? 0,
      lastUpdated: new Date(),
    };
  }

  private async fetchCoinGeckoSingle(
    symbol: string,
    coinId: string
  ): Promise<PriceData | null> {
    try {
      if (this.shouldApplyBackoff()) await this.waitForBackoff();
      const res = await fetch(
        `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`,
        { signal: AbortSignal.timeout(8_000) }
      );
      if (res.status === 429) {
        this.applyBackoff();
        this.markFetchFailed(symbol, 'coingecko');
        return null;
      }
      if (!res.ok) {
        this.markFetchFailed(symbol, 'coingecko');
        return null;
      }
      this.incrementRateLimitCounter();
      const data = (await res.json()) as Record<
        string,
        {
          usd: number;
          usd_24h_change?: number;
          usd_market_cap?: number;
          usd_24h_vol?: number;
          last_updated_at?: number;
        }
      >;
      const row = data[coinId];
      if (!row?.usd) {
        this.markFetchFailed(symbol, 'coingecko');
        return null;
      }
      const priceData: PriceData = {
        symbol,
        name: this.getCoinName(symbol),
        priceUsd: row.usd,
        priceChange24h: row.usd_24h_change ?? 0,
        marketCap: row.usd_market_cap ?? 0,
        volume24h: row.usd_24h_vol ?? 0,
        lastUpdated: new Date((row.last_updated_at ?? Date.now() / 1000) * 1000),
        source: 'coingecko',
      };
      this.setCache(symbol, priceData);
      return priceData;
    } catch {
      this.markFetchFailed(symbol, 'coingecko');
      return null;
    }
  }

  private async getPricesFromGateway(
    symbols: string[]
  ): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    try {
      const resp = await this.requestPricesFromGateway(symbols, 2_000);
      for (const row of resp?.payload?.data || []) {
        if (row?.price > 0) {
          const d = this.toPriceData(row.symbol, row.price, row);
          d.source = 'gateway';
          prices.set(d.symbol, d);
          this.setCache(d.symbol, d);
        }
      }
    } catch {
      for (const s of symbols) this.markFetchFailed(s, 'gateway');
    }
    return prices;
  }

  private async getPricesFromCoinGecko(
    symbols: string[]
  ): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    const idToSym = new Map<string, string>();
    for (const s of symbols) {
      const id = this.symbolToGeckoId.get(s);
      if (id) idToSym.set(id, s);
    }
    if (!idToSym.size) return prices;

    try {
      if (this.shouldApplyBackoff()) await this.waitForBackoff();
      const ids = Array.from(idToSym.keys()).join(',');
      const res = await fetch(
        `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (res.status === 429) {
        this.applyBackoff();
        for (const s of symbols) this.markFetchFailed(s, 'coingecko');
        return prices;
      }
      if (!res.ok) return prices;
      this.incrementRateLimitCounter();
      const data = (await res.json()) as Record<
        string,
        {
          usd: number;
          usd_24h_change?: number;
          usd_market_cap?: number;
          usd_24h_vol?: number;
          last_updated_at?: number;
        }
      >;
      for (const [id, row] of Object.entries(data)) {
        if (!row?.usd) continue;
        const sym = idToSym.get(id) || id.toUpperCase();
        const d: PriceData = {
          symbol: sym,
          name: this.getCoinName(sym),
          priceUsd: row.usd,
          priceChange24h: row.usd_24h_change ?? 0,
          marketCap: row.usd_market_cap ?? 0,
          volume24h: row.usd_24h_vol ?? 0,
          lastUpdated: new Date((row.last_updated_at ?? Date.now() / 1000) * 1000),
          source: 'coingecko',
        };
        prices.set(sym, d);
        this.setCache(sym, d);
      }
    } catch {
      for (const s of symbols) this.markFetchFailed(s, 'coingecko');
    }
    return prices;
  }

  private async getPriceFromCCXT(symbol: string): Promise<PriceData | null> {
    try {
      const result = await ccxtService.getBestPrice(symbol, [
        'binance',
        'coinbase',
        'kraken',
      ]);
      if (!result?.best?.last || result.best.last <= 0) return null;
      return {
        symbol,
        name: this.getCoinName(symbol),
        priceUsd: result.best.last,
        priceChange24h: 0,
        marketCap: 0,
        volume24h: result.best.volume || 0,
        lastUpdated: new Date(result.best.timestamp || Date.now()),
        source: 'ccxt',
      };
    } catch {
      this.markFetchFailed(symbol, 'ccxt');
      return null;
    }
  }

  private async getPriceFromDexScreener(symbol: string): Promise<PriceData | null> {
    const meta = this.findTokenMetadata(symbol);
    if (!meta?.address || !meta.chain) {
      this.markFetchFailed(symbol, 'dexscreener');
      return null;
    }
    try {
      const pairs = await dexscreenerClient.getTokenPairsOnChain(
        meta.chain,
        meta.address
      );
      const best = pairs
        .filter((p) => Number(p.priceUsd) > 0)
        .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      if (!best?.priceUsd) throw new Error('no pair');
      const priceUsd = Number(best.priceUsd);
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw new Error('bad price');
      return {
        symbol,
        name: this.getCoinName(symbol),
        priceUsd,
        priceChange24h: best.priceChange?.h24 ?? 0,
        marketCap: best.marketCap ?? 0,
        volume24h: best.volume?.h24 ?? 0,
        lastUpdated: new Date(),
        source: 'dexscreener',
      };
    } catch {
      this.markFetchFailed(symbol, 'dexscreener');
      return null;
    }
  }

  private findTokenMetadata(symbol: string): TokenMetadata | null {
    const upper = symbol.toUpperCase();
    const candidates = tokenRegistry
      .getAllTokens()
      .filter((t) => t.symbol?.toUpperCase() === upper);
    if (!candidates.length) return null;
    return candidates.find((t) => t.chain === 'celo') || candidates[0];
  }

  // ═══════════════════════════════════════════════════════════
  // Gateway wiring
  // ═══════════════════════════════════════════════════════════

  private subscribeToGatewayEvents(): void {
    try {
      const gateway = getGatewayService();
      gateway.on('gatewayEvent', this.handleGatewayEvent.bind(this));
    } catch (error) {
      logger.warn('[PriceOracle] Gateway subscribe failed', { error });
    }
  }

  private handleGatewayEvent(event: GatewayEvent): void {
    if (event.type !== 'price_update') return;
    const symbol = String(event.data.symbol || '').toUpperCase();
    const price = Number(event.data.price ?? 0);
    if (!symbol || price <= 0) return;
    this.setCache(symbol, this.toPriceData(symbol, price, event.data as any));
  }

  private async requestPricesFromGateway(
    symbols: string[],
    timeoutMs = 2000
  ): Promise<{ payload?: { data?: Array<{ symbol: string; price: number; change24h?: number; marketCap?: number; volume24h?: number }> } } | null> {
    const gatewayService = getGatewayAgentService();
    if (!gatewayService.isHealthy()) return null;
    try {
      const p = gatewayService.requestPrices(symbols, undefined, undefined) as Promise<any>;
      return await Promise.race([
        p,
        new Promise<null>((_, rej) =>
          setTimeout(() => rej(new Error('Gateway timeout')), timeoutMs)
        ),
      ]);
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Discovery (DISPLAY ONLY — never valuation allowlist)
  // ═══════════════════════════════════════════════════════════

  private queueForDiscovery(symbol: string): void {
    const upper = symbol.toUpperCase();
    if (this.symbolToGeckoId.has(upper)) return;
    if (this.isValuationAllowlisted(upper)) return; // discovery never grants valuation permission
    if (this.discovery.failedSymbols.has(upper)) return;
    if (this.discovery.queue.has(upper)) return;
    this.discovery.queue.add(upper);
    if (this.discoveryTimeout) clearTimeout(this.discoveryTimeout);
    this.discoveryTimeout = setTimeout(() => void this.runDiscovery(), 500);
  }

  private async runDiscovery(): Promise<void> {
    if (this.discovery.isRunning || !this.discovery.queue.size) return;
    this.discovery.isRunning = true;
    const batch = Array.from(this.discovery.queue).slice(0, 20);
    for (const s of batch) this.discovery.queue.delete(s);

    try {
      const found = new Map<string, string>();
      // search
      for (const symbol of batch) {
        try {
          if (this.shouldApplyBackoff()) await this.waitForBackoff();
          const res = await fetch(
            `${COINGECKO_API}/search?query=${encodeURIComponent(symbol.toLowerCase())}`,
            { signal: AbortSignal.timeout(5_000) }
          );
          if (res.status === 429) {
            this.applyBackoff();
            continue;
          }
          if (!res.ok) continue;
          this.incrementRateLimitCounter();
          const data = (await res.json()) as {
            coins?: Array<{ id: string; symbol: string; market_cap_rank: number }>;
          };
          const match = data.coins
            ?.filter((c) => c.symbol.toUpperCase() === symbol)
            .sort(
              (a, b) =>
                (a.market_cap_rank || Infinity) - (b.market_cap_rank || Infinity)
            )[0];
          if (match) found.set(symbol, match.id);
        } catch {
          /* continue */
        }
      }

      for (const [sym, id] of found) {
        this.symbolToGeckoId.set(sym, id);
        this.discovery.discoveredCount++;
        // Discovery only updates display mappings; valuation assets are admin-controlled.
      }

      const failed = batch.filter((s) => !found.has(s));
      for (const s of failed) {
        this.discovery.failedSymbols.set(s, Date.now() + 3_600_000, 3_600_000);
      }
    } finally {
      this.discovery.isRunning = false;
      if (this.discovery.queue.size) {
        setTimeout(() => void this.runDiscovery(), 1_500);
      }
    }
  }

  registerSymbolMapping(symbol: string, coinGeckoId: string): void {
    this.symbolToGeckoId.set(symbol.toUpperCase(), coinGeckoId);
    this.discovery.failedSymbols.delete(symbol.toUpperCase());
  }

  /** Register display/discovery mappings without changing valuation approval. */
  registerSymbolMappings(mappings: Map<string, string>): void {
    for (const [symbol, coinGeckoId] of mappings) {
      this.registerSymbolMapping(symbol, coinGeckoId);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Cache / rate limit / cooldowns
  // ═══════════════════════════════════════════════════════════

  private getFromCache(symbol: string, maxAge = cfg.cacheTtlMs): PriceData | null {
    const e = this.cache.get(symbol.toUpperCase());
    if (e && Date.now() - e.timestamp < maxAge) return e.data;
    return null;
  }

  private setCache(symbol: string, data: PriceData): void {
    const key = symbol.toUpperCase();
    if (this.cache.size >= cfg.maxCacheSize && !this.cache.has(key)) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private markFetchFailed(symbol: string, source: PriceSource): void {
    const key = symbol.toUpperCase();
    const existing = this.failureCooldowns.get(key) || {};
    existing[source] = Date.now() + cfg.failureCooldownMs;
    this.failureCooldowns.set(key, existing);
  }

  private hasActiveFailureCooldown(symbol: string, source?: PriceSource): boolean {
    const c = this.failureCooldowns.get(symbol.toUpperCase());
    if (!c) return false;
    const now = Date.now();
    if (source) return !!(c[source] && now < c[source]!);
    return Object.values(c).some((t) => t && now < t);
  }

  private shouldApplyBackoff(): boolean {
    const now = Date.now();
    if (now < this.rateLimitState.nextRetryTime) return true;
    if (now - this.rateLimitState.resetTime >= cfg.rateLimitWindowMs) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.resetTime = now;
      return false;
    }
    if (this.rateLimitState.requestCount >= cfg.rateLimitThreshold) {
      this.applyBackoff();
      return true;
    }
    return false;
  }

  private applyBackoff(): void {
    const backoff = Math.min(1000 * this.rateLimitState.backoffMultiplier, 60_000);
    this.rateLimitState.nextRetryTime = Date.now() + backoff;
    this.rateLimitState.backoffMultiplier = Math.min(
      this.rateLimitState.backoffMultiplier * 2,
      cfg.maxBackoffMultiplier
    );
  }

  private incrementRateLimitCounter(): void {
    const now = Date.now();
    if (now - this.rateLimitState.resetTime > cfg.rateLimitWindowMs) {
      this.rateLimitState.requestCount = 1;
      this.rateLimitState.resetTime = now;
    } else {
      this.rateLimitState.requestCount++;
    }
  }

  private async waitForBackoff(): Promise<void> {
    const wait = this.rateLimitState.nextRetryTime - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  private getCoinName(symbol: string): string {
    const uc = symbol.toUpperCase();
    if (!this._tokenRegistryCacheBuilt) {
      this._tokenRegistryCache = this.buildNameCache();
      this._tokenRegistryCacheBuilt = true;
    }
    return this._tokenRegistryCache?.get(uc) || HARDCODED_NAMES[uc] || uc;
  }

  private buildNameCache(): Map<string, string> {
    try {
      const m = new Map<string, string>();
      for (const t of tokenRegistry.getAllTokens()) {
        if (t.symbol && t.name) m.set(t.symbol.toUpperCase(), t.name);
      }
      return m;
    } catch {
      return new Map();
    }
  }

  private async seedFromTokenRegistry(): Promise<void> {
    try {
      for (const t of tokenRegistry.getAllTokens()) {
        if (t.symbol && t.coingeckoId) {
          const sym = t.symbol.toUpperCase();
          if (!this.symbolToGeckoId.has(sym)) {
            this.symbolToGeckoId.set(sym, t.coingeckoId);
          }
        }
      }
    } catch {
      /* optional */
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Portfolio helper — valuation-grade when possible
  // ═══════════════════════════════════════════════════════════

  /**
   * Prefer valuation prices for allowlisted assets; skip unknowns (fail closed per leg).
   */
  async calculatePortfolioValue(
    holdings: Array<{ symbol: string; balance: number }>,
    opts?: { preferValuation?: boolean }
  ): Promise<{ totalUsd: number; missing: string[]; legs: Array<{ symbol: string; valueUsd: number; confidence?: string }> }> {
    const preferValuation = opts?.preferValuation !== false;
    let totalUsd = 0;
    const missing: string[] = [];
    const legs: Array<{ symbol: string; valueUsd: number; confidence?: string }> = [];

    for (const h of holdings) {
      const sym = h.symbol.toUpperCase();
      if (preferValuation && this.isValuationAllowlisted(sym)) {
        const v = await this.getValuationPrice(sym);
        if (!v) {
          missing.push(sym);
          continue;
        }
        const px = v.haircutPriceUsd ?? v.priceUsd;
        const valueUsd = h.balance * px;
        totalUsd += valueUsd;
        legs.push({ symbol: sym, valueUsd, confidence: v.confidence });
      } else {
        const p = await this.getPrice(sym);
        if (!p) {
          missing.push(sym);
          continue;
        }
        const valueUsd = h.balance * p.priceUsd;
        totalUsd += valueUsd;
        legs.push({ symbol: sym, valueUsd });
      }
    }

    return { totalUsd, missing, legs };
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      assets: Array.from(this.cache.keys()),
      valuationFrozen: Array.from(this.frozenUntil.entries()).filter(
        ([, until]) => until > Date.now()
      ),
      discovery: {
        queued: this.discovery.queue.size,
        discovered: this.discovery.discoveredCount,
        failed: this.discovery.failedSymbols.size,
      },
    };
  }

  getSupportedCurrencies(): string[] {
    return Array.from(this.symbolToGeckoId.keys());
  }
}

export const priceOracle = new PriceOracleService();