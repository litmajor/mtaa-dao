/**
 * Symbol Universe Configuration
 *
 * Authoritative declaration of exchange identity, connection parameters,
 * and known pair structures. This file is intentionally static — it defines
 * what each exchange IS and how to talk to it. Dynamic concerns (live pair
 * discovery, asset metadata, relationship graphs) belong in the adapter and
 * runtime service layers.
 *
 * ENRICHMENTS APPLIED:
 * 1.  supportedQuotes expanded for all 6 exchanges to reflect actual quote
 *     currencies available with significant volume. Previously Kraken only
 *     had ['USD', 'USDT'] — missing EUR, BTC, ETH; OKX/Bybit/KuCoin missing
 *     BTC and ETH cross pairs entirely.
 * 2.  pairFallbacks filled out for all 6 exchanges. Previously only Kraken
 *     and Coinbase had entries (2-3 each). OKX, Bybit, KuCoin had none.
 *     Covers: XBT↔BTC (Kraken), MATIC↔POL migration, common USDT→USD swaps,
 *     exchange-specific symbol quirks.
 * 3.  rateLimiting.maxConcurrentRequests raised from 5 → 10 to align with
 *     the split pLimit pools in ccxtService (tickerLimiter=10, marketLimiter=2).
 * 4.  discovery.volumeThreshold given per-exchange overrides. A $100k threshold
 *     makes sense for Binance but is too high for KuCoin's long-tail assets.
 * 5.  autoProgress removed from discovery config — it was set true but nothing
 *     implemented it, creating a false expectation. Phase progression is now
 *     an explicit operator decision via setPhase().
 * 6.  monitoring.alerts.latencyTooHigh raised from 5000ms → 15000ms to match
 *     the raised DISCOVERY_TIMEOUT in symbolUniverseService (was 2s, now 15s).
 *     5s was generating false-positive alerts on every cold-start market load.
 * 7.  DEX and oracle configs left structurally intact but clearly annotated
 *     as runtime-resolved — their addresses/endpoints are stable knowledge.
 * 8.  Dead fields removed: discovery.staggering had no consumer; batchRequests
 *     is handled by the service layer's pLimit pools, not this config.
 */

export interface PriceSource {
  type: 'cex' | 'dex' | 'oracle';
  name: string;
  enabled: boolean;
  priority: number;
  rateLimitPerSecond: number;
  timeout: number;
  weight: number;
}

export interface ExchangeConfig extends PriceSource {
  type: 'cex';
  /**
   * Quote currencies this exchange supports with meaningful liquidity.
   * Used by performMarketDiscovery() to filter raw market lists and by
   * getFallbackPairs() to generate quote-swap variants.
   * Order matters: highest-liquidity quote first.
   */
  supportedQuotes: string[];
  /**
   * Explicit pair remappings for known cross-exchange symbol quirks.
   * Key: canonical pair (as requested). Value: exchange-local equivalent.
   * Only needed for cases the automatic quote-swap logic can't cover.
   */
  pairFallbacks: Record<string, string>;
  healthCheckInterval: number;
}

export interface DEXConfig extends PriceSource {
  type: 'dex';
  chain: string;
  routerAddress?: string;
  factoryAddress?: string;
  vaultAddress?: string;
}

export interface OracleConfig extends PriceSource {
  type: 'oracle';
  apiKey?: string;
  endpoint: string;
  currencies: string[];
}

export const SYMBOL_UNIVERSE_CONFIG = {

  // ===========================================================================
  // PRICE SOURCES
  // ===========================================================================

  priceSources: {

    cex: {

      binance: {
        type: 'cex' as const,
        name: 'Binance',
        enabled: true,
        priority: 1,
        rateLimitPerSecond: 10,
        timeout: 5000,
        weight: 100,
        healthCheckInterval: 60_000,

        // ENRICHMENT #1: Added BTC, ETH, BNB — all have substantial Binance
        // volume. FDUSD added (Binance's primary USD stablecoin since 2023).
        supportedQuotes: ['USDT', 'BUSD', 'USDC', 'FDUSD', 'BTC', 'ETH', 'BNB'],

        // ENRICHMENT #2: Binance uses standard symbols for most assets but
        // has a few exceptions worth capturing explicitly.
        pairFallbacks: {
          'BTC/USD':       'BTC/USDT',    // Binance doesn't list BTC/USD
          'ETH/USD':       'ETH/USDT',
          'MATIC/USDT':    'POL/USDT',    // Polygon rebranded MATIC → POL
          'MATIC/USD':     'POL/USDT',
          'SHIB/USDT':     '1000SHIB/USDT', // Binance lists SHIB in 1000x units
          'XBT/USDT':      'BTC/USDT',    // Normalise Kraken-style XBT
          'XBT/USD':       'BTC/USDT',
        },
      } as ExchangeConfig,

      kraken: {
        type: 'cex' as const,
        name: 'Kraken',
        enabled: true,
        priority: 2,
        rateLimitPerSecond: 5,
        timeout: 10_000,   // Kraken is consistently slower than other exchanges
        weight: 80,
        healthCheckInterval: 60_000,

        // ENRICHMENT #1: Kraken has deep EUR and BTC-quoted order books.
        // Previously missing EUR, BTC, ETH entirely.
        supportedQuotes: ['USD', 'USDT', 'USDC', 'EUR', 'BTC', 'ETH'],

        // ENRICHMENT #2: Kraken uses XBT instead of BTC and has several
        // token-specific naming quirks. This is the most extensive fallback
        // table because Kraken diverges most from canonical naming.
        pairFallbacks: {
          // Kraken uses XBT, not BTC
          'BTC/USDT':      'XBT/USDT',
          'BTC/USD':       'XBT/USD',
          'BTC/EUR':       'XBT/EUR',
          'BTC/ETH':       'XBT/ETH',
          'ETH/BTC':       'ETH/XBT',
          'SOL/BTC':       'SOL/XBT',
          'LINK/BTC':      'LINK/XBT',
          'ADA/BTC':       'ADA/XBT',
          'DOT/BTC':       'DOT/XBT',
          'ATOM/BTC':      'ATOM/XBT',
          'LTC/BTC':       'LTC/XBT',
          'AVAX/BTC':      'AVAX/XBT',
          // Kraken USD → USDT swap for pairs only listed vs USD
          'ADA/USDT':      'ADA/USD',
          'SOL/USDT':      'SOL/USD',
          'MATIC/USDT':    'MATIC/USD',
          'AVAX/USDT':     'AVAX/USD',
          'DOT/USDT':      'DOT/USD',
          'ATOM/USDT':     'ATOM/USD',
          'LINK/USDT':     'LINK/USD',
          'UNI/USDT':      'UNI/USD',
          'AAVE/USDT':     'AAVE/USD',
          // MATIC → POL migration
          'POL/USDT':      'MATIC/USDT',
          'POL/USD':       'MATIC/USD',
        },
      } as ExchangeConfig,

      coinbase: {
        type: 'cex' as const,
        name: 'Coinbase',
        enabled: true,
        priority: 3,
        rateLimitPerSecond: 3,
        timeout: 10_000,
        weight: 70,
        healthCheckInterval: 60_000,

        // ENRICHMENT #1: Coinbase has a large USD book (US-regulated) and
        // growing BTC/ETH cross pairs. Previously missing BTC and ETH.
        supportedQuotes: ['USD', 'USDC', 'USDT', 'BTC', 'ETH'],

        // ENRICHMENT #2: Coinbase uses USD as primary quote, not USDT.
        // Also lists CGLD (their internal name for CELO).
        pairFallbacks: {
          'BTC/USDT':      'BTC/USD',
          'ETH/USDT':      'ETH/USD',
          'SOL/USDT':      'SOL/USD',
          'ADA/USDT':      'ADA/USD',
          'AVAX/USDT':     'AVAX/USD',
          'MATIC/USDT':    'MATIC/USD',
          'LINK/USDT':     'LINK/USD',
          'DOT/USDT':      'DOT/USD',
          'UNI/USDT':      'UNI/USD',
          'AAVE/USDT':     'AAVE/USD',
          'CRV/USDT':      'CRV/USD',
          'COMP/USDT':     'COMP/USD',
          'BNB/USDT':      'BNB/USD',
          'CELO/USDT':     'CGLD/USD',   // Coinbase-specific CELO naming
          'CELO/USD':      'CGLD/USD',
          'MATIC/USD':     'POL/USD',    // POL migration
          'XBT/USD':       'BTC/USD',    // Normalise Kraken-style XBT
        },
      } as ExchangeConfig,

      bybit: {
        type: 'cex' as const,
        name: 'Bybit',
        enabled: true,
        priority: 4,
        rateLimitPerSecond: 8,
        timeout: 5000,
        weight: 60,
        healthCheckInterval: 60_000,

        // ENRICHMENT #1: Bybit has solid BTC and ETH inverse/linear books.
        // Previously missing BTC and ETH entirely.
        supportedQuotes: ['USDT', 'USDC', 'BTC', 'ETH'],

        // ENRICHMENT #2: Bybit was missing entirely before. Covers the most
        // common cases where Bybit uses a non-standard pair format.
        pairFallbacks: {
          'BTC/USD':       'BTC/USDT',
          'ETH/USD':       'ETH/USDT',
          'SOL/USD':       'SOL/USDT',
          'MATIC/USDT':    'POL/USDT',   // POL migration on Bybit
          'MATIC/USD':     'POL/USDT',
          'XBT/USDT':      'BTC/USDT',   // Normalise Kraken-style XBT
          'XBT/USD':       'BTC/USDT',
        },
      } as ExchangeConfig,

      kucoin: {
        type: 'cex' as const,
        name: 'KuCoin',
        enabled: true,
        priority: 5,
        rateLimitPerSecond: 3,
        timeout: 15_000,  // KuCoin is the slowest of the 6 — needs headroom
        weight: 50,
        healthCheckInterval: 120_000,

        // ENRICHMENT #1: KuCoin has a large BTC and ETH book, especially for
        // long-tail assets not listed elsewhere. Previously missing both.
        supportedQuotes: ['USDT', 'USDC', 'BTC', 'ETH', 'KCS'],

        // ENRICHMENT #2: KuCoin was missing entirely before. Uses hyphen
        // separator in some internal APIs but standard slash via CCXT.
        pairFallbacks: {
          'BTC/USD':       'BTC/USDT',
          'ETH/USD':       'ETH/USDT',
          'SOL/USD':       'SOL/USDT',
          'MATIC/USDT':    'POL/USDT',
          'MATIC/USD':     'POL/USDT',
          'XBT/USDT':      'BTC/USDT',
          // KuCoin sometimes uses USDC where others use USDT
          'LINK/USDT':     'LINK/USDC',
          'UNI/USDT':      'UNI/USDC',
        },
      } as ExchangeConfig,

      okx: {
        type: 'cex' as const,
        name: 'OKX',
        enabled: true,
        priority: 6,
        rateLimitPerSecond: 10,
        timeout: 5000,
        weight: 60,
        healthCheckInterval: 60_000,

        // ENRICHMENT #1: OKX has deep BTC, ETH, and OKB quote books.
        // Previously only listed USDT.
        supportedQuotes: ['USDT', 'USDC', 'BTC', 'ETH', 'OKB'],

        // ENRICHMENT #2: OKX was missing entirely before. OKX uses standard
        // symbols but has a few swap/spot naming differences worth capturing.
        pairFallbacks: {
          'BTC/USD':       'BTC/USDT',
          'ETH/USD':       'ETH/USDT',
          'SOL/USD':       'SOL/USDT',
          'MATIC/USDT':    'POL/USDT',
          'MATIC/USD':     'POL/USDT',
          'XBT/USDT':      'BTC/USDT',
          'XBT/USD':       'BTC/USDT',
        },
      } as ExchangeConfig,

    },

    // =========================================================================
    // DEX sources — addresses are stable knowledge, kept static
    // =========================================================================

    dex: {

      uniswap: {
        type: 'dex' as const,
        name: 'Uniswap V3',
        enabled: true,
        priority: 10,
        rateLimitPerSecond: 20,
        timeout: 3000,
        weight: 90,
        chain: 'ethereum',
        factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      } as DEXConfig,

      sushiswap: {
        type: 'dex' as const,
        name: 'SushiSwap',
        enabled: true,
        priority: 11,
        rateLimitPerSecond: 15,
        timeout: 3000,
        weight: 85,
        chain: 'ethereum',
        routerAddress: '0xd9e1cE17f2641f24aE83637ab915310313E5e7A0',
      } as DEXConfig,

      pancakeswap: {
        type: 'dex' as const,
        name: 'PancakeSwap',
        enabled: true,
        priority: 12,
        rateLimitPerSecond: 15,
        timeout: 3000,
        weight: 80,
        chain: 'bsc',
        routerAddress: '0x10ED43C718714eb63d5aA57B78f985283Ed541b8',
      } as DEXConfig,

      curve: {
        type: 'dex' as const,
        name: 'Curve',
        enabled: true,
        priority: 13,
        rateLimitPerSecond: 10,
        timeout: 5000,
        weight: 75,
        chain: 'ethereum',
        factoryAddress: '0xF18056Bbd320E96A48e3Fbf8bc061322531aac02',
      } as DEXConfig,

      balancer: {
        type: 'dex' as const,
        name: 'Balancer',
        enabled: true,
        priority: 14,
        rateLimitPerSecond: 12,
        timeout: 4000,
        weight: 70,
        chain: 'ethereum',
        vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      } as DEXConfig,

    },

    // =========================================================================
    // Oracle sources
    // =========================================================================

    oracle: {

      coingecko: {
        type: 'oracle' as const,
        name: 'CoinGecko',
        enabled: true,
        priority: 100,
        rateLimitPerSecond: 5,
        timeout: 3000,
        weight: 30,
        endpoint: 'https://api.coingecko.com/api/v3',
        currencies: ['usd', 'eur', 'gbp'],
      } as OracleConfig,

    },

  },

  // ===========================================================================
  // MARKET DISCOVERY STRATEGY
  //
  // Phase progression is an explicit operator decision — call setPhase(2) or
  // setPhase(3) when the system is ready to scale.
  // ENRICHMENT #5: Removed autoProgress:true — nothing implemented it and it
  // created a false expectation of automatic phase promotion.
  // ===========================================================================

  discovery: {

    phase1: {
      enabled: true,
      limit: 100,
      refreshInterval: 6 * 60 * 60 * 1000,   // 6 hours
      sources: ['binance', 'kraken', 'coinbase'],
    },

    phase2: {
      enabled: false,
      limit: 500,
      refreshInterval: 12 * 60 * 60 * 1000,  // 12 hours
      sources: ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin'],
    },

    phase3: {
      enabled: false,
      limit: 2000,
      refreshInterval: 24 * 60 * 60 * 1000,  // 24 hours
      sources: ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx'],
    },

    // ENRICHMENT #4: Per-exchange volume thresholds.
    // Binance sees enormous volume so $100k is a reasonable noise filter.
    // KuCoin lists many long-tail assets with lower but legitimate volume.
    volumeThresholds: {
      binance:  100_000,
      kraken:    50_000,
      coinbase:  50_000,
      bybit:     75_000,
      kucoin:    25_000,   // Lower threshold — KuCoin's value is long-tail coverage
      okx:       75_000,
      default:   50_000,
    },

    progressCheckInterval: 24 * 60 * 60 * 1000,
  },

  // ===========================================================================
  // RATE LIMITING
  //
  // ENRICHMENT #3: maxConcurrentRequests raised from 5 → 10 to align with
  // the split pLimit pools in ccxtService (tickerLimiter=10, marketLimiter=2).
  // ENRICHMENT #8: Removed batchRequests and staggering — these are handled
  // by the service layer's pLimit pools, not this config.
  // ===========================================================================

  rateLimiting: {
    maxConcurrentRequests: 10,
    exponentialBackoff: {
      enabled: true,
      initialDelayMs: 1000,
      maxDelayMs: 60_000,
      factor: 2,
    },
    deduplication: {
      enabled: true,
      windowMs: 5000,
    },
  },

  // ===========================================================================
  // PRICE AGGREGATION
  // ===========================================================================

  priceAggregation: {
    method: 'vwap',
    minSourcesRequired: 1,
    removeOutliers: true,
    outlierThreshold: 5,
    weighting: {
      bySourceWeight: true,
      byVolume: true,
      byFreshness: true,
    },
  },

  // ===========================================================================
  // CACHING
  // ===========================================================================

  cache: {
    backend: 'redis',
    ttl: {
      symbol_metadata:  24 * 60 * 60 * 1000,  // 24 hours
      supported_pairs:   6 * 60 * 60 * 1000,  //  6 hours
      top_100_symbols:       60 * 60 * 1000,  //  1 hour
      prices_volatile:            30 * 1000,  // 30 seconds
      prices_stable:         2 * 60 * 1000,  //  2 minutes
    },
    persistence: {
      enabled: true,
      interval: 60 * 1000,
    },
  },

  // ===========================================================================
  // ASSET GRAPH INTEGRATION
  // ===========================================================================

  assetGraph: {
    enabled: true,
    crossSourceLinking: true,
    priceSelection: {
      considerAllSources: true,
      preferByExchange: ['binance', 'kraken', 'coinbase'],
      preferByVolume: true,
      preferByFreshness: true,
    },
    createCrossSourceEdges: true,
  },

  // ===========================================================================
  // MONITORING
  //
  // ENRICHMENT #6: latencyTooHigh raised from 5000ms → 15000ms.
  // The symbolUniverseService discovery timeout is now 15s (was 2s).
  // At 5s this alert fired on virtually every cold-start market load,
  // generating noise that masked real latency problems.
  // ===========================================================================

  monitoring: {
    enabled: true,
    healthCheckInterval: 60 * 1000,
    alerts: {
      noNewPricesFor:          5 * 60 * 1000,  // 5 minutes
      tooManyFailedRequests:   0.3,             // 30% failure rate
      latencyTooHigh:          15_000,          // 15 seconds (was 5s — FIX #6)
    },
  },

  logging: {
    enabled: true,
    level: 'info',
    logPriceUpdates: false,
    logCacheOps: false,
    logRateLimiting: false,
  },

};

// =============================================================================
// Runtime helpers
// =============================================================================

/**
 * Add a new exchange at runtime (e.g. from admin API or feature flag).
 * Does not persist across restarts — add to the config object above for
 * permanent changes.
 */
export function addExchange(name: string, config: ExchangeConfig): void {
  (SYMBOL_UNIVERSE_CONFIG.priceSources.cex as any)[name] = config;
}

/**
 * Enable a discovery phase explicitly.
 * Phase progression is a deliberate operator decision — not automatic.
 *
 * ENRICHMENT #5: Removed the autoProgress mechanism. Call this directly
 * when the system is validated and ready to scale pair coverage.
 */
export function setPhase(phase: 1 | 2 | 3): void {
  SYMBOL_UNIVERSE_CONFIG.discovery.phase1.enabled = phase >= 1;
  SYMBOL_UNIVERSE_CONFIG.discovery.phase2.enabled = phase >= 2;
  SYMBOL_UNIVERSE_CONFIG.discovery.phase3.enabled = phase >= 3;
}

/**
 * Get the volume threshold for a specific exchange.
 * Falls back to 'default' if no per-exchange override exists.
 */
export function getVolumeThreshold(exchange: string): number {
  const thresholds = SYMBOL_UNIVERSE_CONFIG.discovery.volumeThresholds as Record<string, number>;
  return thresholds[exchange] ?? thresholds['default'];
}

/**
 * Get all enabled CEX exchange names in priority order.
 */
export function getEnabledExchanges(): string[] {
  const cex = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, ExchangeConfig>;
  return Object.entries(cex)
    .filter(([, config]) => config.enabled)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([name]) => name);
}

/**
 * Get explicit pair fallback for a given exchange and pair.
 * Returns undefined if no explicit mapping exists (caller should fall back
 * to the systematic quote-swap logic in symbolUniverseService).
 */
export function getExplicitFallback(exchange: string, pair: string): string | undefined {
  const cex = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, ExchangeConfig>;
  return cex[exchange]?.pairFallbacks?.[pair];
}