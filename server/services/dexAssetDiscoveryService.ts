/**
 * DEX Asset Discovery Service
 * 
 * Discovers tokens and prices from DEXes:
 * - Uniswap V3 (Ethereum)
 * - SushiSwap (Ethereum, Polygon, Arbitrum)
 * - PancakeSwap (BSC)
 * - Curve (Ethereum)
 * - Balancer (Ethereum)
 * 
 * Integrates with Asset Graph for unified asset tracking
 */

import { logger } from '../utils/logger';
import { dexService } from './dexIntegrationService';
import { assetGraphService } from './assetGraphService';
import { priceOracle } from './priceOracle';
import pLimit from 'p-limit';

export interface DexAssetSource {
  symbol: string;
  dex: string;
  chain: string;
  address?: string;
  price?: number;
  liquidity?: number;
  volume24h?: number;
  lastUpdated: number;
}

export interface DexDiscoveryResult {
  dex: string;
  chain: string;
  assets: DexAssetSource[];
  newAssets: string[];
  totalDiscovered: number;
  durationMs: number;
  fetchedAt: number;
}

class DexAssetDiscoveryService {
  private dexTokenCache: Map<string, DexAssetSource[]> = new Map();
  private lastDiscovery: Map<string, number> = new Map();

  // DEX configuration with subgraph endpoints
  private readonly DEX_CONFIG = {
    uniswap: {
      name: 'Uniswap V3',
      chain: 'ethereum',
      enabled: true,
      cacheExpirationMs: 12 * 60 * 60 * 1000, // 12 hours
      subgraph: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3'
    },
    sushiswap: {
      name: 'SushiSwap',
      chain: 'ethereum',
      enabled: true,
      cacheExpirationMs: 12 * 60 * 60 * 1000,
      subgraph: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange'
    },
    pancakeswap: {
      name: 'PancakeSwap',
      chain: 'bsc',
      enabled: true,
      cacheExpirationMs: 12 * 60 * 60 * 1000,
      subgraph: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v2'
    },
    curve: {
      name: 'Curve',
      chain: 'ethereum',
      enabled: true,
      cacheExpirationMs: 12 * 60 * 60 * 1000,
      subgraph: 'https://api.thegraph.com/subgraphs/name/convex-community/curve-factory'
    },
    balancer: {
      name: 'Balancer',
      chain: 'ethereum',
      enabled: true,
      cacheExpirationMs: 12 * 60 * 60 * 1000,
      subgraph: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2'
    }
  };

  constructor() {}

  // Concurrency controls
  private readonly SUBGRAPH_LIMITER = pLimit(3);
  private readonly PRICE_HYDRATE_LIMITER = pLimit(10);

  /**
   * Discover assets from a specific DEX
   */
  async discoverDexAssets(dex: string): Promise<DexDiscoveryResult> {
    const startTime = Date.now();
    const config = this.DEX_CONFIG[dex as keyof typeof this.DEX_CONFIG];

    if (!config || !config.enabled) {
      logger.warn(`DEX ${dex} is not enabled`);
      return {
        dex,
        chain: config?.chain || 'unknown',
        assets: [],
        newAssets: [],
        totalDiscovered: 0,
        durationMs: 0,
        fetchedAt: Date.now()
      };
    }

    try {
      // Check cache
      const cached = this.dexTokenCache.get(dex);
      const lastDiscoveryTime = this.lastDiscovery.get(dex) || 0;

      if (
        cached &&
        Date.now() - lastDiscoveryTime < config.cacheExpirationMs
      ) {
        logger.debug(`Using cached assets for ${dex} (${cached.length} tokens)`);
        return {
          dex,
          chain: config.chain,
          assets: cached,
          newAssets: [],
          totalDiscovered: cached.length,
          durationMs: Date.now() - startTime,
          fetchedAt: Date.now()
        };
      }

      // Discover assets based on DEX type (no pricing yet)
      const assets = await this.discoverAssetsByDex(dex, config);

      // Track new assets
      const oldAssets = cached || [];
      const newAssets = assets
        .filter(a => !oldAssets.find(o => o.symbol === a.symbol))
        .map(a => a.symbol);

      // Build symbol mappings for the PriceOracle (best-effort).
      // We map symbol -> lower-case id as a pragmatic default so CoinGecko
      // resolution can often succeed (collector uses the same approach).
      const symbolMappings = new Map<string, string>();
      for (const a of assets) {
        if (!a.symbol) continue;
        const upper = a.symbol.toUpperCase();
        // Normalise common misnamed fallback tokens
        const normalized = upper === 'UNISWAP' ? 'UNI' : upper;
        symbolMappings.set(normalized, normalized.toLowerCase());
      }

      if (symbolMappings.size > 0) {
        try {
          priceOracle.registerSymbolMappings(symbolMappings);
        } catch (err: any) {
          logger.warn(`Failed to register symbol mappings for ${dex}: ${err.message}`);
        }
      }

      // Hydrate prices in batch via the PriceOracle (limits apply)
      try {
        const uniqueSymbols = Array.from(new Set(assets.map(a => a.symbol).filter(Boolean)));
        if (uniqueSymbols.length > 0) {
          // Use the batch API which handles deduplication and gateway/coingecko fallbacks
          const prices = await priceOracle.getPrices(uniqueSymbols as string[]);
          for (const asset of assets) {
            const p = prices.get((asset.symbol || '').toUpperCase());
            asset.price = p ? p.priceUsd : undefined;
          }
        }
      } catch (err: any) {
        logger.debug(`Price hydration failed for ${dex}: ${err.message}`);
      }

      // Update cache
      this.dexTokenCache.set(dex, assets);
      this.lastDiscovery.set(dex, Date.now());

      logger.info(`
📊 DEX Asset Discovery - ${config.name}:
   ├─ Assets: ${assets.length}
   ├─ New: ${newAssets.length}
   ├─ Chain: ${config.chain}
   └─ Time: ${Date.now() - startTime}ms
      `);

      return {
        dex,
        chain: config.chain,
        assets,
        newAssets,
        totalDiscovered: assets.length,
        durationMs: Date.now() - startTime,
        fetchedAt: Date.now()
      };
    } catch (error: any) {
      logger.error(`Failed to discover assets from ${dex}:`, error.message);
      return {
        dex,
        chain: config?.chain || 'unknown',
        assets: [],
        newAssets: [],
        totalDiscovered: 0,
        durationMs: Date.now() - startTime,
        fetchedAt: Date.now()
      };
    }
  }

  /**
   * Discover all DEX assets
   */
  async discoverAllDexAssets(): Promise<DexDiscoveryResult[]> {
    logger.info('🔍 Discovering assets from all DEXes...');
    const startTime = Date.now();

    const dexes = Object.keys(this.DEX_CONFIG);
    const tasks = dexes.map((dex) =>
      this.SUBGRAPH_LIMITER(() => this.discoverDexAssets(dex))
    );

    const settled = await Promise.allSettled(tasks);
    const results: DexDiscoveryResult[] = [];
    settled.forEach((res, idx) => {
      if (res.status === 'fulfilled') results.push(res.value);
      else {
        logger.error(`Error discovering ${dexes[idx]}:`, (res as any).reason?.message || res);
      }
    });

    const totalAssets = results.reduce((sum, r) => sum + r.totalDiscovered, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newAssets.length, 0);

    logger.info(`
✅ DEX Discovery Complete:
   ├─ Total Assets: ${totalAssets}
   ├─ New Assets: ${totalNew}
   ├─ DEXes Scanned: ${results.length}
   └─ Total Time: ${Math.round((Date.now() - startTime) / 1000)}s
    `);

    return results;
  }

  /**
   * Merge DEX assets into Asset Graph
   */
  async syncDexAssetsToAssetGraph(): Promise<void> {
    logger.info('📊 Syncing DEX assets to Asset Graph...');

    try {
      const results = await this.discoverAllDexAssets();

      // Group assets by symbol
      const assetMap = new Map<string, DexAssetSource[]>();

      for (const result of results) {
        for (const asset of result.assets) {
          if (!assetMap.has(asset.symbol)) {
            assetMap.set(asset.symbol, []);
          }
          assetMap.get(asset.symbol)!.push(asset);
        }
      }

      // Update Asset Graph with DEX sources
      for (const [symbol, sources] of assetMap) {
        try {
          const dexSources = sources.map(s => ({
            symbol: s.symbol,
            source: `dex:${s.dex}`,
            exchange: s.dex,
            chain: s.chain,
            price: s.price,
            liquidity: s.liquidity,
            volume24h: s.volume24h,
            timestamp: s.lastUpdated
          }));

          // Add to asset graph if it has the method
          if (typeof (assetGraphService as any).updateAssetSources === 'function') {
            await (assetGraphService as any).updateAssetSources(symbol, dexSources);
          }
        } catch (error: any) {
          logger.warn(`Failed to sync ${symbol} to Asset Graph:`, error.message);
        }
      }

      logger.info(`✅ Synced ${assetMap.size} unique assets to Asset Graph`);
    } catch (error: any) {
      logger.error('DEX Asset Graph sync failed:', error.message);
    }
  }

  /**
   * Private: Discover assets by DEX type via subgraph queries
   */
  private async discoverAssetsByDex(
    dex: string,
    config: any
  ): Promise<DexAssetSource[]> {
    const assets: DexAssetSource[] = [];

    try {
      // Query DEX subgraph for top tokens by liquidity
      const topTokens = await this.queryDexSubgraph(dex, config);

      for (const token of topTokens) {
        assets.push({
          symbol: token.symbol || token.name,
          dex,
          chain: config.chain,
          address: token.address,
          price: undefined,
          liquidity: token.liquidity,
          volume24h: token.volume24h,
          lastUpdated: Date.now()
        });
      }
    } catch (error: any) {
      logger.warn(`Error discovering tokens from ${dex}:`, error.message);
      // Fallback to predefined tokens if subgraph fails
      const fallbackTokens = await this.getTopTokensFromDex(dex);
      for (const token of fallbackTokens) {
        assets.push({
          symbol: token.symbol || token.name,
          dex,
          chain: config.chain,
          address: token.address,
          price: undefined,
          liquidity: token.liquidity,
          volume24h: token.volume24h,
          lastUpdated: Date.now()
        });
      }
    }

    return assets;
  }

  /**
   * Query DEX subgraph for top tokens by liquidity
   */
  private async queryDexSubgraph(dex: string, config: any): Promise<any[]> {
    const subgraphUrl = (config as any).subgraph;
    if (!subgraphUrl) {
      logger.warn(`No subgraph configured for ${dex}`);
      return [];
    }

    try {
      // Different query structures for different DEXes
      let query = '';
      
      if (dex === 'uniswap') {
        query = `
          query {
            tokens(first: 50, orderBy: totalValueLockedUSD, orderDirection: desc) {
              id
              symbol
              name
              decimals
              totalValueLocked
              totalValueLockedUSD
            }
          }
        `;
      } else if (dex === 'sushiswap') {
        query = `
          query {
            tokens(first: 50, orderBy: liquidity, orderDirection: desc) {
              id
              symbol
              name
              decimals
              liquidity
              volumeUSD
            }
          }
        `;
      } else if (dex === 'pancakeswap') {
        query = `
          query {
            tokens(first: 50, orderBy: totalLiquidityUSD, orderDirection: desc) {
              id
              symbol
              name
              decimals
              totalLiquidityUSD
              tradeVolumeUSD
            }
          }
        `;
      } else if (dex === 'curve') {
        query = `
          query {
            coins(first: 50, orderBy: baseLiquidity, orderDirection: desc) {
              id
              symbol
              baseLiquidity
            }
          }
        `;
      } else if (dex === 'balancer') {
        query = `
          query {
            tokens(first: 50, orderBy: totalBalanceUSD, orderDirection: desc) {
              id
              symbol
              name
              decimals
              totalBalanceUSD
            }
          }
        `;
      }

      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`Subgraph error: ${response.status}`);
      }

      const data = await response.json();

      if (data.errors) {
        const errorMessage = data.errors[0]?.message || 'Unknown subgraph error';
        logger.warn(`Subgraph query error for ${dex}: ${errorMessage}`);
        return [];
      }

      // Extract tokens from response
      const tokens = data.data.tokens || data.data.coins || [];

      logger.debug(`Subgraph query for ${dex}: Found ${tokens.length} tokens`);

      return tokens.map((t: any) => ({
        symbol: t.symbol,
        name: t.name || t.symbol,
        address: t.id,
        liquidity: t.totalValueLockedUSD || t.liquidity || t.totalLiquidityUSD || t.baseLiquidity || t.totalBalanceUSD,
        volume24h: t.volumeUSD || t.tradeVolumeUSD
      }));
    } catch (error: any) {
      logger.warn(`Failed to query ${dex} subgraph:`, error.message);
      return [];
    }
  }

  /**
   * Get top tokens from a DEX (Fallback - hardcoded)
   * Used only when subgraph query fails
   */
  private async getTopTokensFromDex(dex: string): Promise<any[]> {
    // Fallback hardcoded token list - used when subgraph query fails

    const dexTokens: Record<string, any[]> = {
      uniswap: [
        { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
        { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
        { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0f' },
        { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' }
      ],
      sushiswap: [
        { symbol: 'SUSHI', name: 'Sushi', address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2' },
        { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
        { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' }
      ],
      pancakeswap: [
        { symbol: 'CAKE', name: 'PancakeSwap', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
        { symbol: 'WBNB', name: 'Wrapped BNB', address: '0xbb4CdB9CBd36B01bD1cbaAFc831a141f3A4B04d7' },
        { symbol: 'BUSD', name: 'Binance USD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' },
        { symbol: 'USDT', name: 'Tether USD', address: '0x55d398326f99059fF775485246999027B3197955' }
      ],
      curve: [
        { symbol: 'CRV', name: 'Curve DAO', address: '0xD533a949740bb3306d119CC777fa900bA034cd52' },
        { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
        { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0f' }
      ],
      balancer: [
        { symbol: 'BAL', name: 'Balancer', address: '0xba100000625a3754423978a60c9317c58a424e3D' },
        { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
        { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' }
      ]
    };

    return dexTokens[dex] || [];
  }

  /**
   * Get price for token on DEX
   */
  private async getPriceForDexToken(dex: string, token: any): Promise<number | undefined> {
    try {
      // Try to get price from price oracle (CoinGecko)
      if (token.symbol) {
        const priceData = await (priceOracle as any).getPrice(token.symbol);
        return priceData ? (priceData as any).priceUsd : undefined;
      }
    } catch (error: any) {
      logger.debug(`Could not get price for ${token.symbol} on ${dex}`);
    }
    return undefined;
  }

  /**
   * Get cache status
   */
  getCacheStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const [dex, config] of Object.entries(this.DEX_CONFIG)) {
      const cached = this.dexTokenCache.get(dex);
      const lastDiscoveryTime = this.lastDiscovery.get(dex) || 0;

      status[dex] = {
        enabled: config.enabled,
        chain: config.chain,
        cached: cached ? cached.length : 0,
        lastDiscovery: lastDiscoveryTime ? new Date(lastDiscoveryTime) : null,
        age: lastDiscoveryTime ? `${Math.round((Date.now() - lastDiscoveryTime) / 1000)}s ago` : 'Never',
        expired: lastDiscoveryTime ? Date.now() - lastDiscoveryTime > config.cacheExpirationMs : true
      };
    }

    return status;
  }

  /**
   * Clear cache
   */
  clearCache(dex?: string): void {
    if (dex) {
      this.dexTokenCache.delete(dex);
      this.lastDiscovery.delete(dex);
      logger.info(`Cleared cache for ${dex}`);
    } else {
      this.dexTokenCache.clear();
      this.lastDiscovery.clear();
      logger.info('Cleared all DEX token caches');
    }
  }
}

export const dexAssetDiscoveryService = new DexAssetDiscoveryService();
