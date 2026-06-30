import pLimit from 'p-limit';
import { marketUniverseBuilder } from './marketUniverseBuilder';
import { dexscreenerClient, type DexPair } from './dexscreenerClient';
import { priceOracle } from './priceOracle';
import { tokenRegistry } from './tokenRegistry';
import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import path from 'path';

export interface ChainPresence {
  chain: string;
  address: string;
  dexListings: string[];
  liquidityUsd: number;
  volume24h: number;
  priceUsd: number;
  bestPairSymbol: string;
  adapterAvailable: boolean;
}

export interface UnifiedToken {
  symbol: string;
  name: string;
  coingeckoId?: string;

  // CEX data
  cexListings: string[];
  cexEligible: boolean;
  cexVolume24h?: number;
  cexPrice?: number;

  // DEX multi-chain presence
  chainPresence: Map<string, ChainPresence>;
  dexEligible: boolean;
  totalDexLiquidity: number;
  totalDexVolume24h: number;

  // Classification
  domain: 'cex-only' | 'dex-only' | 'both';
  arbEligible: boolean;
  crossChainArb?: boolean;
  isStable: boolean;
  isCeloNative: boolean;
  primaryChain?: string;
}

// Chain discovery configuration
export interface ChainConfig {
  dexscreenerId: string;
  name: string;
  nativeCurrency: string;
  rpcEnvVar: string;
  adapterNames: string[];
  minLiquidityUsd: number;
  enabled: boolean;
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: {
    dexscreenerId: 'ethereum',
    name: 'Ethereum',
    nativeCurrency: 'ETH',
    rpcEnvVar: 'MAINNET_RPC_URL',
    adapterNames: ['uniswap', 'curve', 'balancer', 'sushiswap'],
    minLiquidityUsd: 50_000,
    enabled: true,
  },
  bsc: {
    dexscreenerId: 'bsc',
    name: 'BNB Chain',
    nativeCurrency: 'BNB',
    rpcEnvVar: 'BSC_RPC_URL',
    adapterNames: ['pancakeswap'],
    minLiquidityUsd: 10_000,
    enabled: true,
  },
  polygon: {
    dexscreenerId: 'polygon',
    name: 'Polygon',
    nativeCurrency: 'MATIC',
    rpcEnvVar: 'POLYGON_RPC_URL',
    adapterNames: [],
    minLiquidityUsd: 10_000,
    enabled: true,
  },
  arbitrum: {
    dexscreenerId: 'arbitrum',
    name: 'Arbitrum',
    nativeCurrency: 'ETH',
    rpcEnvVar: 'ARBITRUM_RPC_URL',
    adapterNames: [],
    minLiquidityUsd: 20_000,
    enabled: true,
  },
  optimism: {
    dexscreenerId: 'optimism',
    name: 'Optimism',
    nativeCurrency: 'ETH',
    rpcEnvVar: 'OPTIMISM_RPC_URL',
    adapterNames: [],
    minLiquidityUsd: 20_000,
    enabled: false,
  },
  base: {
    dexscreenerId: 'base',
    name: 'Base',
    nativeCurrency: 'ETH',
    rpcEnvVar: 'BASE_RPC_URL',
    adapterNames: [],
    minLiquidityUsd: 20_000,
    enabled: false,
  },
  celo: {
    dexscreenerId: 'celo',
    name: 'Celo',
    nativeCurrency: 'CELO',
    rpcEnvVar: 'CELO_RPC_URL',
    adapterNames: ['uniswap', 'mento', 'ubeswap', 'aave'],
    minLiquidityUsd: 1_000,
    enabled: true,
  },
};

const CELO_SEARCH_QUERIES = ['celo', 'ubeswap', 'mento'];
const CELO_STABLES = new Set(['CUSD','CEUR','CKES','CREAL','CGHS','CBRL']);
const CELO_NATIVE = new Set(['CUSD','CEUR','CKES','CREAL','MTAA','UBE','PACT']);

class TokenDiscoveryService {
  private unifiedUniverse: Map<string, UnifiedToken> = new Map();
  private lastBuilt = 0;
  private readonly REFRESH_MS = 15 * 60 * 1000; // 15 minutes
  private buildPromise: Promise<void> | null = null;

  async buildUnifiedUniverse(): Promise<Map<string, UnifiedToken>> {
    if (this.buildPromise) {
      await this.buildPromise;
      return this.unifiedUniverse;
    }

    const now = Date.now();
    if (this.unifiedUniverse.size > 0 && now - this.lastBuilt < this.REFRESH_MS) {
      return this.unifiedUniverse;
    }

    this.buildPromise = this._build().finally(() => {
      this.buildPromise = null;
    });

    await this.buildPromise;
    return this.unifiedUniverse;
  }

  private async _build(): Promise<void> {
    logger.info('[TokenDiscovery] Building unified token universe...');
    const t0 = Date.now();

    const [cexAssetsRes, dexPairsRes] = await Promise.allSettled([
      this.discoverCEXAssets(),
      this.discoverMultiChainDEXAssets(),
    ]);

    const universe = new Map<string, UnifiedToken>();

    // Step 1: CEX assets
    if (cexAssetsRes.status === 'fulfilled') {
      for (const asset of cexAssetsRes.value) {
        universe.set(asset.symbol.toUpperCase(), {
          symbol: asset.symbol.toUpperCase(),
          name: asset.symbol.toUpperCase(),
          coingeckoId: asset.coingeckoId,
          cexListings: asset.availableOn || [],
          cexEligible: (asset.availableOn?.length || 0) >= 2,
          cexVolume24h: 0,
          cexPrice: undefined,
          chainPresence: new Map(),
          dexEligible: false,
          totalDexLiquidity: 0,
          totalDexVolume24h: 0,
          domain: 'cex-only',
          arbEligible: false,
          isStable: CELO_STABLES.has(asset.symbol.toUpperCase()),
          isCeloNative: CELO_NATIVE.has(asset.symbol.toUpperCase()),
        } as UnifiedToken);
      }
    }

    // Step 2: Merge DEX data (multi-chain)
    if (dexPairsRes.status === 'fulfilled') {
      for (const pair of dexPairsRes.value) {
        const symbol = (pair.baseToken.symbol || '').toUpperCase();
        if (!symbol) continue;

        let existing = universe.get(symbol);
        if (!existing) {
          existing = {
            symbol,
            name: pair.baseToken.name || symbol,
            coingeckoId: undefined,
            cexListings: [],
            cexEligible: false,
            cexVolume24h: 0,
            cexPrice: undefined,
            chainPresence: new Map(),
            dexEligible: false,
            totalDexLiquidity: 0,
            totalDexVolume24h: 0,
            domain: 'dex-only',
            arbEligible: false,
            isStable: CELO_STABLES.has(symbol),
            isCeloNative: CELO_NATIVE.has(symbol),
          } as UnifiedToken;
          universe.set(symbol, existing);
        }

        const chainKey = pair.chainId;
        const cfg = CHAIN_CONFIGS[chainKey];
        const adapterAvailable = Boolean(cfg && cfg.adapterNames && cfg.adapterNames.length > 0);

        const presence: ChainPresence = {
          chain: chainKey,
          address: pair.baseToken.address,
          dexListings: [pair.dexId],
          liquidityUsd: pair.liquidity?.usd || 0,
          volume24h: pair.volume?.h24 || 0,
          priceUsd: Number(pair.priceUsd || 0),
          bestPairSymbol: `${symbol}/${pair.quoteToken.symbol}`,
          adapterAvailable,
        };

        // Merge into chainPresence
        const existingPresence = existing.chainPresence.get(chainKey);
        if (existingPresence) {
          existingPresence.dexListings = [...new Set([...existingPresence.dexListings, pair.dexId])];
          existingPresence.liquidityUsd += presence.liquidityUsd;
          existingPresence.volume24h += presence.volume24h;
          // Prefer price from more liquid pair
          if (presence.liquidityUsd > existingPresence.liquidityUsd) {
            existingPresence.priceUsd = presence.priceUsd;
            existingPresence.bestPairSymbol = presence.bestPairSymbol;
          }
        } else {
          existing.chainPresence.set(chainKey, presence);
        }

        // Update totals
        existing.totalDexLiquidity += presence.liquidityUsd;
        existing.totalDexVolume24h += presence.volume24h;
        existing.dexEligible = true;

        // Update domain/arb eligibility
        if (existing.cexListings && existing.cexListings.length > 0) {
          existing.domain = 'both';
          existing.arbEligible = true;
        }

        // Update primaryChain heuristically (most liquidity)
        if (!existing.primaryChain) existing.primaryChain = chainKey;
        else {
          const prev = existing.chainPresence.get(existing.primaryChain);
          if (prev && presence.liquidityUsd > (prev?.liquidityUsd || 0)) existing.primaryChain = chainKey;
        }
      }
    }

    // Step 3: Enrich from tokenRegistry (add chain presence for known tokens)
    const celoTokens = tokenRegistry.getCeloDEXTokens();
    for (const [symbol, meta] of celoTokens.entries()) {
      const uc = symbol.toUpperCase();
      const tok = universe.get(uc);
      const cfg = CHAIN_CONFIGS['celo'];
      const adapterAvailable = cfg && cfg.adapterNames && cfg.adapterNames.length > 0;

      if (tok) {
        // ensure chainPresence exists for celo
        if (!tok.chainPresence) tok.chainPresence = new Map();
        if (!tok.chainPresence.has('celo')) {
          tok.chainPresence.set('celo', {
            chain: 'celo',
            address: meta.address,
            dexListings: [],
            liquidityUsd: 0,
            volume24h: 0,
            priceUsd: 0,
            bestPairSymbol: '',
            adapterAvailable,
          });
        }

        if (!tok.coingeckoId && meta.coingeckoId) tok.coingeckoId = meta.coingeckoId;
        if (!tok.name || tok.name === uc) tok.name = (meta as any).name || uc;
      } else {
        const map = new Map<string, ChainPresence>();
        map.set('celo', {
          chain: 'celo',
          address: meta.address,
          dexListings: [],
          liquidityUsd: 0,
          volume24h: 0,
          priceUsd: 0,
          bestPairSymbol: '',
          adapterAvailable,
        });

        universe.set(uc, {
          symbol: uc,
          name: (meta as any).name || uc,
          coingeckoId: meta.coingeckoId,
          cexListings: [],
          cexEligible: false,
          cexVolume24h: 0,
          cexPrice: undefined,
          chainPresence: map,
          dexEligible: false,
          totalDexLiquidity: 0,
          totalDexVolume24h: 0,
          domain: 'dex-only',
          arbEligible: false,
          isStable: CELO_STABLES.has(uc),
          isCeloNative: CELO_NATIVE.has(uc),
        });
      }
    }

    // Step 4: Register coingeckoIds with priceOracle
    const oracleMap = new Map<string, string>();
    for (const token of universe.values()) {
      if (token.coingeckoId) oracleMap.set(token.symbol.toUpperCase(), token.coingeckoId);
    }
    if (oracleMap.size > 0) {
      priceOracle.registerSymbolMappings(oracleMap);
      logger.info(`[TokenDiscovery] Registered ${oracleMap.size} symbols with price oracle`);
    }

    this.unifiedUniverse = universe;
    this.lastBuilt = Date.now();

    const cexOnly  = [...universe.values()].filter(t => t.domain === 'cex-only').length;
    const dexOnly  = [...universe.values()].filter(t => t.domain === 'dex-only').length;
    const both     = [...universe.values()].filter(t => t.domain === 'both').length;
    const arbReady = [...universe.values()].filter(t => t.arbEligible).length;

    logger.info(
      `[TokenDiscovery] Universe built in ${Date.now() - t0}ms: ` +
      `${universe.size} total | ${cexOnly} CEX-only | ${dexOnly} DEX-only | ` +
      `${both} on both | ${arbReady} arb-eligible`
    );
    // persist a local fallback cache to allow resilient restarts when external APIs fail
    try {
      await this.saveFallbackUniverse();
    } catch (err: any) {
      logger.warn('[TokenDiscovery] Failed to persist fallback universe cache:', err?.message || err);
    }
  }

  private async discoverCEXAssets(): Promise<Array<{symbol: string; availableOn: string[]; coingeckoId?: string;}>> {
    const exchanges = ['binance','kraken','coinbase','bybit','kucoin','okx'];
    // Ensure the universe is built (marketUniverseBuilder caches internally)
    const assets = await marketUniverseBuilder.buildUniverse(exchanges);

    return assets.map(a => ({
      symbol: a.symbol,
      availableOn: a.availableOn || [],
      coingeckoId: a.coingeckoId,
    }));
  }

  private async discoverCeloDEXAssets(): Promise<DexPair[]> {
    logger.info('[TokenDiscovery] Fetching Celo DEX pairs from DexScreener...');

    const allPairs = new Map<string, DexPair>();

    const limiter = pLimit(2);
    const queries = CELO_SEARCH_QUERIES.map(q => limiter(() => dexscreenerClient.searchPairs(q)));
    const settled = await Promise.allSettled(queries);

    for (const res of settled) {
      if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
      for (const pair of res.value) {
        if (pair.chainId !== 'celo') continue;
        if ((pair.liquidity?.usd || 0) < 1_000) continue;
        const sym = (pair.baseToken.symbol || '').toUpperCase();
        const existing = allPairs.get(sym);
        if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)) {
          allPairs.set(sym, pair);
        }
      }
    }

    // Also query known Celo token addresses directly
    const celoTokens = tokenRegistry.getCeloDEXTokens();
    const addresses = [...celoTokens.values()].map(t => t.address).filter(Boolean);
    if (addresses.length > 0) {
      try {
        const pairsByAddress = await dexscreenerClient.getCeloPairsForTokens(addresses);
        for (const pairs of pairsByAddress.values()) {
          for (const pair of pairs) {
            if (pair.chainId !== 'celo') continue;
            const sym = (pair.baseToken.symbol || '').toUpperCase();
            const existing = allPairs.get(sym);
            if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)) {
              allPairs.set(sym, pair);
            }
          }
        }
      } catch (err: any) {
        logger.warn(`[TokenDiscovery] Address-based DexScreener query failed: ${err?.message || err}`);
      }
    }

    logger.info(`[TokenDiscovery] DexScreener: ${allPairs.size} unique Celo tokens`);
    return Array.from(allPairs.values());
  }

  /**
   * Discover DEX pairs across multiple configured chains.
   * Returns a flat array of DexPair objects across chains.
   */
  private async discoverMultiChainDEXAssets(): Promise<DexPair[]> {
    const enabledChains = Object.entries(CHAIN_CONFIGS)
      .filter(([, cfg]) => cfg.enabled)
      .map(([chainKey, cfg]) => ({ chainKey, cfg }));

    logger.info(
      `[TokenDiscovery] Scanning DEX pairs on ${enabledChains.length} chains: ` +
      enabledChains.map(c => c.cfg.name).join(', ')
    );

    const limiter = pLimit(2);

    const chainResults = await Promise.allSettled(
      enabledChains.map(({ chainKey, cfg }) => limiter(() => this.discoverChainPairs(chainKey, cfg)))
    );

    const pairs: DexPair[] = [];
    for (const res of chainResults) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        pairs.push(...res.value);
      } else if (res.status === 'rejected') {
        logger.warn('[TokenDiscovery] Chain scan failed:', (res as any).reason || res);
      }
    }

    logger.info(`[TokenDiscovery] Multi-chain DexScreener discovered ${pairs.length} pairs`);
    return pairs;
  }

  /**
   * Discover pairs for a single chain using DexScreener search & address-based queries.
   * Returns the most-liquid pair per base symbol for the chain.
   */
  private async discoverChainPairs(chainKey: string, cfg: ChainConfig): Promise<DexPair[]> {
    logger.info(`[TokenDiscovery] Scanning ${cfg.name} DEX pairs...`);

    const searchTerms = [cfg.nativeCurrency.toLowerCase(), cfg.dexscreenerId];
    const pairsBySymbol = new Map<string, DexPair>();

    for (const term of searchTerms) {
      try {
        const list = await dexscreenerClient.searchPairs(term);
        for (const pair of list) {
          if (pair.chainId !== cfg.dexscreenerId) continue;
          if ((pair.liquidity?.usd || 0) < cfg.minLiquidityUsd) continue;
          const sym = (pair.baseToken.symbol || '').toUpperCase();
          const existing = pairsBySymbol.get(sym);
          if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)) {
            pairsBySymbol.set(sym, pair);
          }
        }
      } catch (err: any) {
        logger.debug(`[TokenDiscovery] ${cfg.name} search '${term}' failed: ${err?.message || err}`);
      }
    }

    // Address-based enrichment from token registry (rate-limited)
    try {
      const tokensOnChain = tokenRegistry.getTokensByChain(chainKey);
      const addresses = tokensOnChain.map(t => t.address).filter(Boolean);
      if (addresses.length > 0) {
        const addrLimiter = pLimit(3);
        const addrResults = await Promise.allSettled(
          addresses.map(a => addrLimiter(() => dexscreenerClient.getTokenPairs(a)))
        );

        for (const res of addrResults) {
          if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
          for (const pair of res.value) {
            if (pair.chainId !== cfg.dexscreenerId) continue;
            if ((pair.liquidity?.usd || 0) < cfg.minLiquidityUsd) continue;
            const sym = (pair.baseToken.symbol || '').toUpperCase();
            const existing = pairsBySymbol.get(sym);
            if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)) {
              pairsBySymbol.set(sym, pair);
            }
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[TokenDiscovery] Address-based ${cfg.name} query failed: ${err?.message || err}`);
    }

    logger.info(`[TokenDiscovery] ${cfg.name}: ${pairsBySymbol.size} tokens discovered`);
    return Array.from(pairsBySymbol.values());
  }

  /**
   * Detect cross-chain arbitrage opportunities between chains for the same token.
   */
  detectCrossChainArbitrageOpportunities(minSpreadPercent = 0.5) {
    const opportunities: Array<any> = [];

    for (const token of this.unifiedUniverse.values()) {
      if (!token.chainPresence || token.chainPresence.size < 2) continue;

      const presences = Array.from(token.chainPresence.entries())
        .filter(([, p]) => p.priceUsd > 0 && p.liquidityUsd > 5_000)
        .map(([chain, p]) => [chain, p] as [string, ChainPresence]);

      for (let i = 0; i < presences.length; i++) {
        for (let j = i + 1; j < presences.length; j++) {
          const [chainA, presenceA] = presences[i];
          const [chainB, presenceB] = presences[j];
          const spreadPct = Math.abs(presenceA.priceUsd - presenceB.priceUsd) / Math.min(presenceA.priceUsd, presenceB.priceUsd) * 100;
          if (spreadPct < minSpreadPercent) continue;

          opportunities.push({
            symbol: token.symbol,
            chainA,
            chainB,
            priceA: presenceA.priceUsd,
            priceB: presenceB.priceUsd,
            spreadPct,
            liquidityA: presenceA.liquidityUsd,
            liquidityB: presenceB.liquidityUsd,
            executable: presenceA.adapterAvailable && presenceB.adapterAvailable,
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.spreadPct - a.spreadPct);
  }

  // Helpers
  getChainTokens(chain: string, minLiquidityUsd = 5_000) {
    return [...this.unifiedUniverse.values()]
      .filter(t => {
        const p = t.chainPresence.get(chain);
        return p && p.liquidityUsd >= minLiquidityUsd;
      })
      .sort((a, b) => (b.chainPresence.get(chain)?.liquidityUsd || 0) - (a.chainPresence.get(chain)?.liquidityUsd || 0));
  }

  getAdapterExecutableTokens(chain: string) {
    const cfg = CHAIN_CONFIGS[chain];
    if (!cfg || !cfg.adapterNames || cfg.adapterNames.length === 0) return [];
    return this.getChainTokens(chain).filter(t => t.chainPresence.get(chain)?.adapterAvailable);
  }

  getCEXScanList(minExchanges = 2, limit = 300): string[] {
    return [...this.unifiedUniverse.values()]
      .filter(t => t.cexEligible && t.cexListings.length >= minExchanges)
      .sort((a, b) => b.cexListings.length - a.cexListings.length)
      .slice(0, limit)
      .map(t => t.symbol);
  }

  getCeloDEXList(minLiquidityUsd = 5_000) {
    return [...this.unifiedUniverse.values()]
      .filter(t => t.chainPresence && t.chainPresence.has('celo') && (t.chainPresence.get('celo')!.liquidityUsd || 0) >= minLiquidityUsd)
      .sort((a, b) => (b.chainPresence.get('celo')?.liquidityUsd || 0) - (a.chainPresence.get('celo')?.liquidityUsd || 0));
  }

  getArbCandidates(): UnifiedToken[] {
    return [...this.unifiedUniverse.values()]
      .filter(t => t.arbEligible && t.domain === 'both')
      .sort((a, b) => (b.totalDexLiquidity || 0) - (a.totalDexLiquidity || 0));
  }

  getAllDiscoveredSymbols(): string[] {
    return [...this.unifiedUniverse.keys()];
  }

  getToken(symbol: string): UnifiedToken | undefined {
    return this.unifiedUniverse.get(symbol.toUpperCase());
  }

  getStats() {
    const tokens = [...this.unifiedUniverse.values()];
    return {
      total:       tokens.length,
      cexOnly:     tokens.filter(t => t.domain === 'cex-only').length,
      dexOnly:     tokens.filter(t => t.domain === 'dex-only').length,
      both:        tokens.filter(t => t.domain === 'both').length,
      arbEligible: tokens.filter(t => t.arbEligible).length,
      celoNative:  tokens.filter(t => t.isCeloNative).length,
      stablecoins: tokens.filter(t => t.isStable).length,
      withAddress: tokens.filter(t => t.chainPresence && t.chainPresence.has('celo')).length,
      lastBuilt:   new Date(this.lastBuilt).toISOString(),
      ageMs:       Date.now() - this.lastBuilt,
    };
  }

  /**
   * Load a previously-saved fallback universe from disk to allow startup without external APIs.
   */
  async loadFallbackUniverse(fallbackPath?: string): Promise<Map<string, UnifiedToken>> {
    const filePath = fallbackPath || path.join(process.cwd(), 'cache', 'token-universe-fallback.json');
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw || '{}');

      const universe = new Map<string, UnifiedToken>();

      // Support two simple payload shapes: { lastBuilt, tokens: [...] } or a map { SYMBOL: token }
      if (Array.isArray(parsed.tokens)) {
        for (const t of parsed.tokens) {
          const uc = (t.symbol || '').toUpperCase();
          const cpMap = new Map<string, ChainPresence>();
          if (t.chainPresence && typeof t.chainPresence === 'object') {
            for (const [chain, p] of Object.entries(t.chainPresence)) {
              cpMap.set(chain, p as ChainPresence);
            }
          }
          const ut = { ...t, chainPresence: cpMap } as UnifiedToken;
          universe.set(uc, ut);
        }
      } else if (parsed && typeof parsed === 'object') {
        const mapObj: any = parsed.universe || parsed.tokens || parsed;
        for (const [k, v] of Object.entries(mapObj)) {
          const t = v as any;
          const uc = (t.symbol || k).toUpperCase();
          const cpMap = new Map<string, ChainPresence>();
          if (t.chainPresence && typeof t.chainPresence === 'object') {
            for (const [chain, p] of Object.entries(t.chainPresence)) {
              cpMap.set(chain, p as ChainPresence);
            }
          }
          const ut = { ...t, symbol: uc, chainPresence: cpMap } as UnifiedToken;
          universe.set(uc, ut);
        }
      }

      if (universe.size > 0) {
        this.unifiedUniverse = universe;
        this.lastBuilt = parsed.lastBuilt || Date.now();
        logger.info(`[TokenDiscovery] Loaded fallback universe from ${filePath} (${universe.size} tokens)`);
      } else {
        logger.warn(`[TokenDiscovery] Fallback universe file parsed but contained no tokens: ${filePath}`);
      }

      return this.unifiedUniverse;
    } catch (err: any) {
      logger.warn(`[TokenDiscovery] Failed to load fallback universe from ${filePath}: ${err?.message || err}`);
      return this.unifiedUniverse;
    }
  }

  /**
   * Persist the current universe to disk for use as a fallback on subsequent startups.
   */
  private async saveFallbackUniverse(fallbackPath?: string): Promise<void> {
    const filePath = fallbackPath || path.join(process.cwd(), 'cache', 'token-universe-fallback.json');
    try {
      const tokens: any[] = [];
      for (const token of this.unifiedUniverse.values()) {
        const cpObj: Record<string, ChainPresence> = {};
        for (const [chain, p] of (token.chainPresence?.entries() || [] as any)) {
          cpObj[chain] = p as ChainPresence;
        }
        const plain = { ...token, chainPresence: cpObj };
        tokens.push(plain);
      }
      const payload = { lastBuilt: this.lastBuilt || Date.now(), tokens };
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
      logger.info(`[TokenDiscovery] Saved fallback universe to ${filePath}`);
    } catch (err: any) {
      logger.warn('[TokenDiscovery] Failed to save fallback universe cache:', err?.message || err);
    }
  }
}

export const tokenDiscoveryService = new TokenDiscoveryService();
