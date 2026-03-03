/**
 * Enhanced Symbol Universe Configuration
 * Supports multiple price sources: CEX, DEX, Oracles
 * Designed for scalability - add exchanges via config only
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
  supportedQuotes: string[];
  pairFallbacks?: Record<string, string>;
  healthCheckInterval: number;
}

export interface DEXConfig extends PriceSource {
  type: 'dex';
  chain: string;
  routerAddress?: string;
  factoryAddress?: string;
}

export interface OracleConfig extends PriceSource {
  type: 'oracle';
  apiKey?: string;
  endpoint: string;
  currencies: string[];
}

export const SYMBOL_UNIVERSE_CONFIG = {
  // ============= PRICE SOURCES - Easily extensible =============
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
        supportedQuotes: ['USDT', 'BUSD', 'USDC'],
        healthCheckInterval: 60000
      } as ExchangeConfig,

      kraken: {
        type: 'cex' as const,
        name: 'Kraken',
        enabled: true,
        priority: 2,
        rateLimitPerSecond: 5,
        timeout: 8000,
        weight: 80,
        supportedQuotes: ['USD', 'USDT'],
        pairFallbacks: {
          'ADA/USDT': 'ADA/USD',
          'SOL/USDT': 'SOL/USD',
          'MATIC/USDT': 'MATIC/USD'
        },
        healthCheckInterval: 60000
      } as ExchangeConfig,

      coinbase: {
        type: 'cex' as const,
        name: 'Coinbase',
        enabled: true,
        priority: 3,
        rateLimitPerSecond: 3,
        timeout: 10000,
        weight: 70,
        supportedQuotes: ['USD', 'USDC'],
        pairFallbacks: {
          'BNB/USDT': 'BNB/USD',
          'MATIC/USDT': 'MATIC/USD'
        },
        healthCheckInterval: 60000
      } as ExchangeConfig,

      bybit: {
        type: 'cex' as const,
        name: 'Bybit',
        enabled: true,
        priority: 4,
        rateLimitPerSecond: 8,
        timeout: 5000,
        weight: 60,
        supportedQuotes: ['USDT', 'USDC'],
        healthCheckInterval: 60000
      } as ExchangeConfig,

      kucoin: {
        type: 'cex' as const,
        name: 'KuCoin',
        enabled: true,
        priority: 5,
        rateLimitPerSecond: 3,
        timeout: 15000,
        weight: 50,
        supportedQuotes: ['USDT', 'USDC'],
        healthCheckInterval: 120000
      } as ExchangeConfig,

      okx: {
        type: 'cex' as const,
        name: 'OKX',
        enabled: true,
        priority: 6,
        rateLimitPerSecond: 10,
        timeout: 5000,
        weight: 60,
        supportedQuotes: ['USDT'],
        healthCheckInterval: 60000
      } as ExchangeConfig
    },

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
        factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
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
        routerAddress: '0xd9e1cE17f2641f24aE83637ab915310313E5e7A0'
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
        routerAddress: '0x10ED43C718714eb63d5aA57B78f985283Ed541b8'
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
        factoryAddress: '0xF18056Bbd320E96A48e3Fbf8bc061322531aac02'
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
        vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
      } as DEXConfig
    },

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
        currencies: ['usd', 'eur', 'gbp']
      } as OracleConfig
    }
  },

  // ============= MARKET DISCOVERY STRATEGY (Phased scaling) =============
  discovery: {
    phase1: {
      enabled: true,
      limit: 100,
      refreshInterval: 6 * 60 * 60 * 1000,
      sources: ['binance', 'kraken', 'coinbase']
    },
    phase2: {
      enabled: false,
      limit: 500,
      refreshInterval: 12 * 60 * 60 * 1000,
      sources: ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin']
    },
    phase3: {
      enabled: false,
      limit: 2000,
      refreshInterval: 24 * 60 * 60 * 1000,
      sources: ['binance', 'kraken', 'coinbase', 'bybit', 'kucoin', 'okx']
    },
    volumeThreshold: 100000,
    autoProgress: true,
    progressCheckInterval: 24 * 60 * 60 * 1000
  },

  // ============= RATE LIMITING & API EFFICIENCY =============
  rateLimiting: {
    useBottleneck: true,
    maxConcurrentRequests: 5,
    batchRequests: {
      enabled: true,
      batchSize: 10,
      batchDelayMs: 100
    },
    staggering: {
      enabled: true,
      delayBetweenExchangesMs: 200
    },
    exponentialBackoff: {
      enabled: true,
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      factor: 2
    },
    deduplication: {
      enabled: true,
      windowMs: 5000
    }
  },

  // ============= PRICE AGGREGATION (Multi-source) =============
  priceAggregation: {
    method: 'vwap',
    minSourcesRequired: 1,
    removeOutliers: true,
    outlierThreshold: 5,
    weighting: {
      bySourceWeight: true,
      byVolume: true,
      byFreshness: true
    }
  },

  // ============= CACHING =============
  cache: {
    backend: 'redis',
    ttl: {
      symbol_metadata: 24 * 60 * 60 * 1000,
      supported_pairs: 6 * 60 * 60 * 1000,
      top_100_symbols: 60 * 60 * 1000,
      prices_volatile: 30 * 1000,
      prices_stable: 2 * 60 * 1000
    },
    persistence: {
      enabled: true,
      interval: 60 * 1000
    }
  },

  // ============= ASSET GRAPH INTEGRATION =============
  assetGraph: {
    enabled: true,
    crossSourceLinking: true,
    priceSelection: {
      considerAllSources: true,
      preferByExchange: ['binance', 'kraken', 'coinbase'],
      preferByVolume: true,
      preferByFreshness: true
    },
    createCrossSourceEdges: true
  },

  // ============= MONITORING =============
  monitoring: {
    enabled: true,
    healthCheckInterval: 60 * 1000,
    alerts: {
      noNewPricesFor: 5 * 60 * 1000,
      tooManyFailedRequests: 0.3,
      latencyTooHigh: 5000
    }
  },

  logging: {
    enabled: true,
    level: 'info',
    logPriceUpdates: false,
    logCacheOps: false,
    logRateLimiting: false
  }
};

/**
 * Easy way to add new exchange at runtime
 */
export function addExchange(name: string, config: ExchangeConfig): void {
  (SYMBOL_UNIVERSE_CONFIG.priceSources.cex as any)[name] = config;
}

/**
 * Easy way to enable/disable phase
 */
export function setPhase(phase: 1 | 2 | 3): void {
  SYMBOL_UNIVERSE_CONFIG.discovery.phase1.enabled = phase >= 1;
  SYMBOL_UNIVERSE_CONFIG.discovery.phase2.enabled = phase >= 2;
  SYMBOL_UNIVERSE_CONFIG.discovery.phase3.enabled = phase >= 3;
}
