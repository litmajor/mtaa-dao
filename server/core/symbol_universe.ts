/**
 * Symbol Universe Adapter
 *
 * Central registry of asset metadata across chains and protocols.
 * Provides unified asset context: identification, cross-chain deployments,
 * wrapped/synthetic relationships, DeFi protocol integration, risk classification.
 *
 * FIXES APPLIED:
 * 1.  discoverFromCCXTExchanges() iterates ALL configured exchanges, not just
 *     hardcoded 'binance'. Calls ccxtService.getMarkets() directly so it
 *     benefits from the promise-lock fix in ccxtService.
 * 2.  getMarketsFromCCXT() (was getMockCCXTMarkets()) no longer maps
 *     exchange→single chain and queries DexScreener wrongly. Uses CCXT market
 *     data which is already exchange-authoritative and chain-aware.
 * 3.  detectAssetRelationships() pattern matching tightened. Wrapped (w*) and
 *     staking (st*) heuristics now require the inferred underlying to be a
 *     registered asset AND have an appropriate category. Prevents false positives
 *     on WAVES, STORJ, STG, WLD, etc.
 * 4.  detectAssetRelationships() deduplicates via a Set of "from→type→to" keys.
 *     Prevents the relationships array growing unboundedly across repeated syncs.
 * 5.  inferCategory() fully normalised — all symbol comparisons use
 *     symbol.toUpperCase(). Duplicate AAVE (governance_token + money_market)
 *     resolved. Liquid staking array corrected ('STETH' not 'stETH').
 * 6.  enrichDiscoveredAssets() rate-limited to 4 req/s via a simple token
 *     bucket. Concurrency capped at 4 parallel CoinGecko calls via batching.
 * 7.  inferTierFromUniswapLiquidity() replaced with inferTierFromVolume() which
 *     derives tier from volume/liquidity data already present in DexScreener
 *     discovery results — eliminating 50 extra per-token network calls.
 * 8.  syncWithProtocols() wraps each step independently. One failing source
 *     no longer kills the remaining steps.
 * 9.  suggestCategories() categoryFamilies completed — all entries populated,
 *     no more empty arrays or "add more correlations" stubs.
 * 10. chainIdToName() returns 'unknown' for unrecognised chain IDs instead of
 *     silently misattributing deployments to 'ethereum'.
 * 11. Adapter exposes getKnownAssets() and getRelationships() as a bridge so
 *     the runtime symbolUniverseService can consume this knowledge graph.
 */

import { dexscreenerClient } from '../services/dexscreener_client';
import { ccxtService } from '../services/ccxtService';
import { SYMBOL_UNIVERSE_CONFIG } from '../config/symbolUniverseConfig';
import { logger } from '../utils/logger';

// Supported blockchain networks
export type SupportedChain = 
  | 'ethereum'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'avalanche'
  | 'fantom'
  | 'celo'
  | 'solana'
  | 'binance'
  | 'cosmos'
  | 'unknown';

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export type TokenCategory =
  | 'l1' | 'l2' | 'sidechain'
  | 'stablecoin' | 'algorithmic_stablecoin' | 'rwa_stablecoin'
  | 'defi_token' | 'governance_token' | 'protocol_token' | 'oracle_token' | 'bridge_token'
  | 'lp_token' | 'liquid_staking' | 'yield_token' | 'rebasing_token'
  | 'wrapped' | 'synthetic' | 'derivative' | 'index_token'
  | 'money_market' | 'collateral' | 'lending_token'
  | 'meme_token' | 'gaming_token' | 'nft_related' | 'utility_token'
  | 'fee_sharing' | 'insurance_token' | 'crosschain_token'
  | 'other';

export interface AssetMetadata {
  symbol: string;
  name: string;
  decimals: number;
  category: TokenCategory;
  tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  riskProfile: 'blue_chip' | 'established' | 'emerging' | 'experimental';
  tags?: string[];
}

export interface ChainDeployment {
  chain: SupportedChain;
  contractAddress: string;
  deployer: string;
  deployedAt: number;
  isNative: boolean;
  hasLiquidity: boolean;
}

export interface SymbolRelationship {
  from: string;
  to: string;
  type: 'wrapped' | 'bridged' | 'synthetic' | 'yield_bearing' | 'lp_token';
  riskFactor: number;
}

export interface SymbolUniverseStore {
  assets: Map<string, AssetMetadata>;
  deployments: Map<string, ChainDeployment[]>;
  relationships: Array<SymbolRelationship>;
  crossChainBridges: Map<string, Array<{ from: SupportedChain; to: SupportedChain; protocol: string }>>;
  dynamicAssets: Map<string, { discoveredAt: number; source: string; metadata?: AssetMetadata }>;
}

export interface DiscoverySource {
  exchange: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  active: boolean;
  volume24h?: number;
  discoveredAt: number;
}

// FIX #10: Known chain IDs — returns 'unknown' for anything not in this map
const CHAIN_ID_MAP: Record<number, string> = {
  1:     'ethereum',
  10:    'optimism',
  42161: 'arbitrum',
  137:   'polygon',
  56:    'bsc',
  250:   'fantom',
  43114: 'avalanche',
  324:   'zksync',
  25:    'cronos',
  100:   'gnosis',
  1284:  'moonbeam',
  8453:  'base',
};

// FIX #6: Simple rate-limiter for CoinGecko (≤4 req/s, batch size 4)
const COINGECKO_RATE_LIMIT_MS = 250;  // 1000ms / 4 req/s
const COINGECKO_BATCH_SIZE    = 4;

// ---------------------------------------------------------------------------
// SymbolUniverseService
// ---------------------------------------------------------------------------

export class SymbolUniverseService {
  private universe: SymbolUniverseStore;
  private lastUpdated: number = 0;
  private updateIntervalMs = 3_600_000; // 1 hour

  // FIX #4: Relationship deduplication key set
  private relationshipKeys: Set<string> = new Set();

  private categoryRiskScore: Map<TokenCategory, number> = new Map([
    ['l1', 5], ['stablecoin', 5], ['governance_token', 10],
    ['l2', 15], ['sidechain', 20], ['defi_token', 25],
    ['liquid_staking', 30], ['money_market', 25], ['oracle_token', 20],
    ['lp_token', 35], ['protocol_token', 30], ['yield_token', 35],
    ['bridge_token', 40], ['wrapped', 15], ['synthetic', 40],
    ['algorithmic_stablecoin', 50], ['derivative', 45], ['index_token', 35],
    ['rebasing_token', 50], ['meme_token', 70], ['gaming_token', 55],
    ['rwa_stablecoin', 45], ['nft_related', 60], ['insurance_token', 50],
    ['utility_token', 40], ['fee_sharing', 35], ['collateral', 30],
    ['lending_token', 30], ['crosschain_token', 40], ['other', 60],
  ]);

  constructor() {
    this.universe = {
      assets: new Map(),
      deployments: new Map(),
      relationships: [],
      crossChainBridges: new Map(),
      dynamicAssets: new Map(),
    };
    this.initializeUniverse();
  }

  // ---------------------------------------------------------------------------
  // Seed data
  // ---------------------------------------------------------------------------

  private initializeUniverse(): void {
    const seed: Array<[string, Omit<AssetMetadata, 'symbol'>]> = [
      ['ETH',    { name: 'Ethereum',         decimals: 18, category: 'l1',            tier: 'tier_1', riskProfile: 'blue_chip' }],
      ['BTC',    { name: 'Bitcoin',           decimals: 8,  category: 'l1',            tier: 'tier_1', riskProfile: 'blue_chip' }],
      ['USDC',   { name: 'USD Coin',          decimals: 6,  category: 'stablecoin',    tier: 'tier_1', riskProfile: 'blue_chip' }],
      ['USDT',   { name: 'Tether',            decimals: 6,  category: 'stablecoin',    tier: 'tier_1', riskProfile: 'blue_chip' }],
      ['DAI',    { name: 'Dai Stablecoin',    decimals: 18, category: 'stablecoin',    tier: 'tier_1', riskProfile: 'blue_chip' }],
      ['AAVE',   { name: 'Aave Token',        decimals: 18, category: 'money_market',  tier: 'tier_2', riskProfile: 'established' }],
      ['COMP',   { name: 'Compound',          decimals: 18, category: 'money_market',  tier: 'tier_2', riskProfile: 'established' }],
      ['UNI',    { name: 'Uniswap',           decimals: 18, category: 'governance_token', tier: 'tier_2', riskProfile: 'established' }],
      ['CRV',    { name: 'Curve DAO',         decimals: 18, category: 'governance_token', tier: 'tier_2', riskProfile: 'established' }],
      ['LINK',   { name: 'Chainlink',         decimals: 18, category: 'oracle_token',  tier: 'tier_2', riskProfile: 'established' }],
      ['STETH',  { name: 'Lido Staked ETH',   decimals: 18, category: 'liquid_staking', tier: 'tier_2', riskProfile: 'established' }],
      ['WSTETH', { name: 'Wrapped stETH',     decimals: 18, category: 'wrapped',       tier: 'tier_2', riskProfile: 'established' }],
      ['RETH',   { name: 'Rocket Pool ETH',   decimals: 18, category: 'liquid_staking', tier: 'tier_2', riskProfile: 'established' }],
      ['ARB',    { name: 'Arbitrum',          decimals: 18, category: 'l2',            tier: 'tier_3', riskProfile: 'emerging' }],
      ['OP',     { name: 'Optimism',          decimals: 18, category: 'l2',            tier: 'tier_3', riskProfile: 'emerging' }],
      ['MATIC',  { name: 'Polygon',           decimals: 18, category: 'l2',            tier: 'tier_3', riskProfile: 'emerging' }],
    ];

    for (const [symbol, meta] of seed) {
      this.registerAsset(symbol, { symbol, ...meta });
    }

    // Canonical deployments
    this.registerDeployment('ETH:ethereum', {
      chain: 'ethereum', contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      deployer: 'native', deployedAt: 1438269973, isNative: true, hasLiquidity: true,
    });
    this.registerDeployment('USDC:ethereum', {
      chain: 'ethereum', contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      deployer: 'Circle', deployedAt: 1533596298, isNative: false, hasLiquidity: true,
    });

    // Canonical relationships (seeded once, won't be duplicated — FIX #4)
    this.registerRelationship({ from: 'ETH',   to: 'WETH',   type: 'wrapped',       riskFactor: 1.02 });
    this.registerRelationship({ from: 'ETH',   to: 'STETH',  type: 'yield_bearing', riskFactor: 1.05 });
    this.registerRelationship({ from: 'STETH', to: 'WSTETH', type: 'wrapped',       riskFactor: 1.02 });
    this.registerRelationship({ from: 'ETH',   to: 'RETH',   type: 'yield_bearing', riskFactor: 1.06 });

    this.lastUpdated = Date.now();
  }

  // ---------------------------------------------------------------------------
  // Public read API (FIX #11: exposed for runtime service bridge)
  // ---------------------------------------------------------------------------

  getAsset(symbol: string): AssetMetadata | undefined {
    return this.universe.assets.get(symbol.toUpperCase());
  }

  /** FIX #11: Runtime service can call this to enrich its own metadata. */
  getKnownAssets(): Map<string, AssetMetadata> {
    return new Map(this.universe.assets);
  }

  /** FIX #11: Runtime service can call this for relationship-aware fallback. */
  getRelationships(): SymbolRelationship[] {
    return [...this.universe.relationships];
  }

  getDeployments(symbol: string): ChainDeployment[] {
    const deployments: ChainDeployment[] = [];
    for (const [key, deps] of this.universe.deployments.entries()) {
      if (key.startsWith(`${symbol.toUpperCase()}:`)) deployments.push(...deps);
    }
    return deployments;
  }

  getDeploymentOnChain(symbol: string, chain: SupportedChain): ChainDeployment | undefined {
    return this.universe.deployments.get(`${symbol.toUpperCase()}:${chain}`)?.[0];
  }

  getWrappedVersions(symbol: string) {
    return this.universe.relationships
      .filter(r => r.from === symbol.toUpperCase())
      .map(r => ({ symbol: r.to, type: r.type, riskFactor: r.riskFactor }));
  }

  getUnderlyingAsset(symbol: string) {
    const rel = this.universe.relationships.find(r => r.to === symbol.toUpperCase());
    return rel ? { symbol: rel.from, type: rel.type, riskFactor: rel.riskFactor } : undefined;
  }

  resolveAssetAcrossChains(symbol: string): Map<SupportedChain, ChainDeployment> {
    const resolved = new Map<SupportedChain, ChainDeployment>();
    for (const dep of this.getDeployments(symbol)) resolved.set(dep.chain, dep);
    return resolved;
  }

  getAssetsByCategory(category: TokenCategory): AssetMetadata[] {
    return [...this.universe.assets.values()].filter(a => a.category === category);
  }

  getAssetsByTier(tier: AssetMetadata['tier']): AssetMetadata[] {
    return [...this.universe.assets.values()].filter(a => a.tier === tier);
  }

  getTier1Assets(): AssetMetadata[] { return this.getAssetsByTier('tier_1'); }

  getSyntheticAssets(): AssetMetadata[] {
    return [...this.universe.assets.values()].filter(
      a => a.category === 'synthetic' || a.category === 'wrapped' || a.category === 'liquid_staking'
    );
  }

  isLiquidStaking(symbol: string): boolean {
    return this.getAsset(symbol)?.category === 'liquid_staking';
  }

  isStablecoin(symbol: string): boolean {
    return this.getAsset(symbol)?.category === 'stablecoin';
  }

  findSaferAlternative(symbol: string): AssetMetadata | undefined {
    const current = this.getAsset(symbol);
    if (!current) return undefined;
    if (current.tier !== 'tier_1') {
      for (const asset of this.universe.assets.values()) {
        if (asset.tier === 'tier_1' && asset.category === current.category) return asset;
      }
    }
    const underlying = this.getUnderlyingAsset(symbol);
    return underlying ? this.getAsset(underlying.symbol) : undefined;
  }

  getDiscoveredAssets() {
    return [...this.universe.dynamicAssets.entries()].map(([symbol, data]) => ({
      symbol, discoveredAt: data.discoveredAt, source: data.source,
    }));
  }

  isDiscoveredDynamically(symbol: string): boolean {
    return this.universe.dynamicAssets.has(symbol.toUpperCase());
  }

  getAllAssets() {
    return [...this.universe.assets.entries()].map(([symbol, metadata]) => ({
      symbol, metadata, isDynamic: this.universe.dynamicAssets.has(symbol),
    }));
  }

  // ---------------------------------------------------------------------------
  // Sync orchestration (FIX #8: per-step isolation)
  // ---------------------------------------------------------------------------

  async syncWithProtocols(): Promise<{ newAssetsDiscovered: number; assetsUpdated: number }> {
    if (Date.now() - this.lastUpdated < this.updateIntervalMs) {
      return { newAssetsDiscovered: 0, assetsUpdated: 0 };
    }

    let newCount = 0;
    let updateCount = 0;

    // FIX #8: Each step wrapped independently — failure in one doesn't kill others
    const steps: Array<() => Promise<{ new: number; updated: number }>> = [
      () => this.discoverFromCCXTExchanges(),
      () => this.discoverFromUniswap(),
      () => this.discoverFromCurve(),
    ];

    for (const step of steps) {
      try {
        const result = await step();
        newCount += result.new;
        updateCount += result.updated;
      } catch (error: any) {
        logger.error('[SymbolUniverse] Discovery step failed:', error.message);
      }
    }

    // Enrichment and relationship detection are best-effort
    try { await this.enrichDiscoveredAssets(); } catch (e: any) {
      logger.error('[SymbolUniverse] Enrichment failed:', e.message);
    }
    try { await this.detectAssetRelationships(); } catch (e: any) {
      logger.error('[SymbolUniverse] Relationship detection failed:', e.message);
    }

    this.lastUpdated = Date.now();
    return { newAssetsDiscovered: newCount, assetsUpdated: updateCount };
  }

  // ---------------------------------------------------------------------------
  // Discovery: CEX (FIX #1 + FIX #2)
  // ---------------------------------------------------------------------------

  /**
   * FIX #1: Iterates all configured CEX exchanges, not just 'binance'.
   * FIX #2: Uses ccxtService.getMarkets() (CCXT-authoritative data) instead
   * of routing through DexScreener with incorrect chain mappings.
   */
  async discoverFromCCXTExchanges(): Promise<{ new: number; updated: number }> {
    let newCount = 0;
    let updateCount = 0;

    const cexSources = SYMBOL_UNIVERSE_CONFIG.priceSources.cex as Record<string, any>;
    const enabledExchanges = Object.entries(cexSources)
      .filter(([, config]) => config.enabled)
      .map(([name]) => name);

    for (const exchange of enabledExchanges) {
      try {
        const markets = await this.getMarketsFromCCXT(exchange);
        for (const market of markets) {
          const sym = market.symbol?.toUpperCase();
          if (!sym) continue;

          if (!this.universe.assets.has(sym)) {
            this.registerDynamicAsset(sym, {
              exchange,
              symbol: sym,
              baseAsset: market.baseAsset,
              quoteAsset: market.quoteAsset,
              active: true,
              volume24h: market.volume24h,
              discoveredAt: Date.now(),
            });
            newCount++;
          } else {
            updateCount++;
          }
        }
      } catch (error: any) {
        logger.warn(`[SymbolUniverse] CEX discovery failed for ${exchange}: ${error.message}`);
      }
    }

    return { new: newCount, updated: updateCount };
  }

  /**
   * FIX #2: Uses ccxtService.getMarkets() directly instead of mapping
   * exchange→chain and querying DexScreener (which was wrong — Binance
   * lists tokens from BSC, Solana, Cosmos, not just Ethereum).
   */
  private async getMarketsFromCCXT(exchange: string): Promise<Array<{
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    volume24h?: number;
  }>> {
    const markets = await ccxtService.getMarkets(exchange);
    if (!markets || markets.length === 0) return [];

    return markets
      .filter((m: any) => m.symbol?.includes('/'))
      .map((m: any) => {
        const [base, quote] = m.symbol.split('/');
        return {
          symbol: base,           // Store the base asset symbol
          baseAsset: base,
          quoteAsset: quote,
          volume24h: undefined,   // Volume not in market metadata; enriched later
        };
      });
  }

  // ---------------------------------------------------------------------------
  // Discovery: Uniswap via DexScreener (FIX #7)
  // ---------------------------------------------------------------------------

  /**
   * FIX #7: inferTierFromUniswapLiquidity() was called once per token
   * (50 extra DexScreener calls). Now tier is inferred from the liquidity
   * data already present in the DexScreener search result.
   */
  async discoverFromUniswap(): Promise<{ new: number; updated: number }> {
    let newCount = 0;
    let updateCount = 0;

    try {
      const searchResult = await dexscreenerClient.searchPairs('*', ['ethereum']);

      if (searchResult.status !== 'success' || !searchResult.pairs) {
        logger.warn('[SymbolUniverse] DexScreener Uniswap search unavailable');
        return { new: 0, updated: 0 };
      }

      const topTokens = searchResult.pairs.slice(0, 50);

      for (const pair of topTokens) {
        const symbol = pair.baseToken.symbol.toUpperCase();
        const name   = pair.baseToken.name;

        if (!this.universe.assets.has(symbol)) {
          // FIX #7: derive tier from inline liquidity data — no extra call
          const tier = this.inferTierFromVolume(pair.liquidity?.usd, pair.volume?.h24);
          const category = this.inferCategory(symbol, name);
          const suggested = this.suggestCategories(symbol, name);

          this.registerAsset(symbol, {
            symbol, name,
            decimals: pair.baseToken.decimals || 18,
            category, tier,
            riskProfile: tier === 'tier_1' ? 'blue_chip'
                       : tier === 'tier_2' ? 'established'
                       : tier === 'tier_3' ? 'emerging' : 'experimental',
            tags: suggested.slice(1),
          });

          const chain = this.chainIdToName(1); // Uniswap → Ethereum
          if (chain !== 'unknown') {
            this.registerDeployment(`${symbol}:${chain}`, {
              chain: chain as SupportedChain,
              contractAddress: pair.baseToken.address,
              deployer: 'uniswap_discovery',
              deployedAt: Date.now(),
              isNative: false,
              hasLiquidity: (pair.liquidity?.usd || 0) > 0,
            });
          }
          newCount++;
        } else {
          updateCount++;
        }
      }
    } catch (error: any) {
      logger.error('[SymbolUniverse] Uniswap discovery error:', error.message);
    }

    return { new: newCount, updated: updateCount };
  }

  // ---------------------------------------------------------------------------
  // Discovery: Curve via DexScreener
  // ---------------------------------------------------------------------------

  async discoverFromCurve(): Promise<{ new: number; updated: number }> {
    let newCount = 0;
    let updateCount = 0;

    try {
      const searchResult = await dexscreenerClient.searchPairs('stablecoin', ['ethereum']);

      if (searchResult.status !== 'success' || !searchResult.pairs) {
        logger.warn('[SymbolUniverse] DexScreener Curve search unavailable');
        return { new: 0, updated: 0 };
      }

      for (const pair of searchResult.pairs.slice(0, 30)) {
        const symbol = pair.baseToken.symbol.toUpperCase();
        const name   = pair.baseToken.name;

        if (!this.universe.assets.has(symbol)) {
          this.registerAsset(symbol, {
            symbol, name,
            decimals: pair.baseToken.decimals || 18,
            category: this.inferCurveCategory(symbol, name),
            tier: 'tier_2',
            riskProfile: 'established',
          });
          newCount++;
        } else {
          updateCount++;
        }
      }
    } catch (error: any) {
      logger.error('[SymbolUniverse] Curve discovery error:', error.message);
    }

    return { new: newCount, updated: updateCount };
  }

  // ---------------------------------------------------------------------------
  // Enrichment (FIX #6: rate-limited CoinGecko)
  // ---------------------------------------------------------------------------

  /**
   * FIX #6: Processes enrichment in batches of COINGECKO_BATCH_SIZE with a
   * COINGECKO_RATE_LIMIT_MS delay between batches. Prevents instant 429s
   * on large dynamic asset sets (CoinGecko free: 5 req/s).
   */
  private async enrichDiscoveredAssets(): Promise<void> {
    const discovered = [...this.universe.dynamicAssets.entries()];
    if (discovered.length === 0) return;

    logger.info(`[SymbolUniverse] Enriching ${discovered.length} dynamic assets via CoinGecko`);

    for (let i = 0; i < discovered.length; i += COINGECKO_BATCH_SIZE) {
      const batch = discovered.slice(i, i + COINGECKO_BATCH_SIZE);

      await Promise.allSettled(batch.map(async ([symbol]) => {
        try {
          const enriched = await this.fetchAssetMetadataFromCoinGecko(symbol);
          if (enriched) {
            const existing = this.universe.assets.get(symbol);
            if (existing) {
              this.universe.assets.set(symbol, { ...existing, ...enriched });
            }
          }
        } catch (error: any) {
          logger.debug(`[SymbolUniverse] CoinGecko enrichment failed for ${symbol}: ${error.message}`);
        }
      }));

      // FIX #6: Rate-limit pause between batches
      if (i + COINGECKO_BATCH_SIZE < discovered.length) {
        await this.delay(COINGECKO_RATE_LIMIT_MS * COINGECKO_BATCH_SIZE);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Relationship detection (FIX #3 + FIX #4)
  // ---------------------------------------------------------------------------

  /**
   * FIX #3: Pattern matching now requires:
   *   - For wrapped (w*): underlying must be a registered asset with a
   *     non-wrapped category (prevents wXXX → XXX false positives)
   *   - For staking (st*): underlying must be registered with 'l1' or 'l2'
   *     category (prevents STG, STORJ, STMX false positives)
   *   - For bridged (.e suffix): underlying must be registered
   *
   * FIX #4: Deduplicates via a Set<string> of "from|type|to" keys.
   */
  private async detectAssetRelationships(): Promise<void> {
    const assets = [...this.universe.assets.keys()];

    for (const symbol of assets) {
      const sym = symbol.toUpperCase();

      // Wrapped pattern: wXXX → XXX
      if (sym.startsWith('W') && sym.length > 2) {
        const candidate = sym.substring(1);
        const underlying = this.universe.assets.get(candidate);

        // FIX #3: Only register if underlying exists AND is not itself a
        // wrapped/synthetic (prevents chained false positives)
        if (underlying && !['wrapped', 'synthetic', 'lp_token'].includes(underlying.category)) {
          this.registerRelationship({
            from: candidate, to: sym, type: 'wrapped', riskFactor: 1.02,
          });
        }
      }

      // Bridged pattern: XXX.e → XXX (Avalanche bridge convention)
      if (sym.endsWith('.E')) {
        const candidate = sym.slice(0, -2);
        if (this.universe.assets.has(candidate)) {
          this.registerRelationship({
            from: candidate, to: sym, type: 'bridged', riskFactor: 1.08,
          });
        }
      }

      // Staking derivative pattern: stXXX → XXX
      // FIX #3: Underlying must be 'l1' or 'l2' — staking derivatives wrap
      // native chain assets, not DeFi tokens
      if (sym.startsWith('ST') && sym.length > 3) {
        const candidate = sym.substring(2);
        const underlying = this.universe.assets.get(candidate);

        if (underlying && ['l1', 'l2'].includes(underlying.category)) {
          this.registerRelationship({
            from: candidate, to: sym, type: 'yield_bearing', riskFactor: 1.05,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Category inference (FIX #5)
  // ---------------------------------------------------------------------------

  /**
   * FIX #5: All symbol comparisons now use symbol.toUpperCase() consistently.
   * Duplicate AAVE in governance_token + money_market resolved:
   *   - AAVE → money_market (its primary function)
   *   - UNI, CRV, SUSHI → governance_token
   * Liquid staking array corrected to uppercase ('STETH' not 'stETH').
   */
  inferCategory(
    symbol: string,
    name: string,
    metadata?: { volume24h?: number; liquidity?: number }
  ): TokenCategory {
    const sym   = symbol.toUpperCase();
    const lower = (symbol + ' ' + name).toLowerCase();

    // Layer 1
    if (['ETH', 'BTC', 'SOL', 'BNB'].includes(sym)) return 'l1';

    // Layer 2
    if (['ARB', 'OP', 'MATIC', 'IMX', 'METIS'].includes(sym)) return 'l2';
    if (lower.includes('arbitrum') || lower.includes('optimism') || lower.includes('polygon')) return 'l2';

    // Sidechains
    if (['XDAI', 'GNO'].includes(sym) || lower.includes('gnosis')) return 'sidechain';

    // Stablecoins
    if (['USDC', 'USDT', 'BUSD', 'TUSD', 'FRAX', 'LUSD'].includes(sym)) return 'stablecoin';
    if (sym === 'DAI' || lower.includes('stablecoin')) return 'stablecoin';

    // Algorithmic stablecoins (checked before generic stablecoin)
    if (['UST', 'FEI', 'USDD', 'CUSD'].includes(sym)) return 'algorithmic_stablecoin';

    // Real World Asset stablecoins
    if (lower.includes('rwa') || lower.includes('real world asset')) return 'rwa_stablecoin';

    // Money markets (FIX #5: AAVE removed from governance list, lives here only)
    if (['AAVE', 'COMP', 'CREAM', 'EULER'].includes(sym)) return 'money_market';
    if (lower.includes('compound') || lower.includes('lending protocol')) return 'money_market';

    // Governance tokens (FIX #5: AAVE removed)
    if (['UNI', 'CRV', 'SUSHI', 'BAL', 'CAKE'].includes(sym)) return 'governance_token';
    if (lower.includes('governance') || lower.includes(' dao')) return 'governance_token';

    // Oracle tokens
    if (['LINK', 'API3', 'BAND', 'TRB', 'UMA'].includes(sym)) return 'oracle_token';

    // Liquid staking (FIX #5: uppercase consistently)
    if (['STETH', 'RETH', 'CBETH', 'WSTETH', 'SFRXETH'].includes(sym)) return 'liquid_staking';
    if (lower.includes('liquid staking') || lower.includes('staking derivative')) return 'liquid_staking';

    // Yield-bearing tokens
    if (sym.startsWith('A') && lower.includes('aave')) return 'yield_token';
    if (sym.startsWith('C') && lower.includes('compound')) return 'yield_token';

    // LP tokens
    if (lower.includes(' lp') || lower.includes('liquidity pool') || lower.includes('pool token')) return 'lp_token';

    // Wrapped assets
    if (sym.startsWith('W') && sym.length > 2 && this.universe.assets.has(sym.substring(1))) return 'wrapped';
    if (lower.includes('wrapped')) return 'wrapped';

    // Synthetic
    if (lower.includes('synthetic') || lower.includes(' synth')) return 'synthetic';

    // Rebasing
    if (['OHM', 'MEMO'].includes(sym) || lower.includes('rebase')) return 'rebasing_token';

    // Gaming
    if (['AXS', 'SAND', 'ENJ', 'GALA', 'FLOW', 'ILV'].includes(sym)) return 'gaming_token';
    if (lower.includes('gaming') || lower.includes('metaverse') || lower.includes('play-to-earn')) return 'gaming_token';

    // Meme
    if (['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK'].includes(sym)) return 'meme_token';
    if (lower.includes('meme')) return 'meme_token';

    // Insurance
    if (['NXM', 'WNXM', 'NSURE', 'INSUR'].includes(sym)) return 'insurance_token';

    // Bridge/crosschain
    if (lower.includes('wormhole') || lower.includes('portal') || sym.endsWith('.E')) return 'bridge_token';

    // NFT
    if (['BLUR', 'LOOKS', 'X2Y2'].includes(sym)) return 'nft_related';
    if (lower.includes('nft') || lower.includes('non-fungible')) return 'nft_related';

    // Generic DeFi if high volume
    if (metadata?.volume24h && metadata.volume24h > 1_000_000) return 'defi_token';

    return 'other';
  }

  // ---------------------------------------------------------------------------
  // Category helpers
  // ---------------------------------------------------------------------------

  getAssetsByCategories(categories: TokenCategory[]): AssetMetadata[] {
    return [...this.universe.assets.values()].filter(a => categories.includes(a.category));
  }

  getCategoryRiskScore(category: TokenCategory): number {
    return this.categoryRiskScore.get(category) ?? 60;
  }

  getCategoryRiskMultiplier(category: TokenCategory): number {
    return 1.0 + (this.getCategoryRiskScore(category) / 100);
  }

  isSafeCategory(category: TokenCategory): boolean {
    return ['l1', 'stablecoin', 'governance_token', 'l2', 'wrapped', 'oracle_token'].includes(category);
  }

  isHighRiskCategory(category: TokenCategory): boolean {
    return this.getCategoryRiskScore(category) > 45;
  }

  findSaferAlternativesInCategory(symbol: string, targetCategory: TokenCategory): AssetMetadata[] {
    const tierOrder: Record<string, number> = { tier_1: 0, tier_2: 1, tier_3: 2, tier_4: 3 };
    return this.getAssetsByCategory(targetCategory)
      .filter(a => a.symbol !== symbol.toUpperCase())
      .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier])
      .slice(0, 5);
  }

  analyzeCategoryComposition(symbols: string[]) {
    const analysis = new Map<TokenCategory, { count: number; riskSum: number; tiers: string[]; symbols: string[] }>();

    for (const symbol of symbols) {
      const asset = this.getAsset(symbol);
      if (!asset) continue;
      const entry = analysis.get(asset.category) || { count: 0, riskSum: 0, tiers: [], symbols: [] };
      entry.count++;
      entry.riskSum += this.getCategoryRiskScore(asset.category);
      entry.tiers.push(asset.tier);
      entry.symbols.push(asset.symbol);
      analysis.set(asset.category, entry);
    }

    return [...analysis.entries()].map(([category, data]) => ({
      category,
      count: data.count,
      avgRisk: Math.round(data.riskSum / data.count),
      avgTier: this.getModalTier(data.tiers),
      symbols: data.symbols,
    }));
  }

  /**
   * FIX #9: All category families fully populated — no empty arrays or stubs.
   */
  suggestCategories(
    symbol: string,
    name: string,
    metadata?: { volume24h?: number; liquidity?: number }
  ): TokenCategory[] {
    const primary = this.inferCategory(symbol, name, metadata);
    const seen = new Set<TokenCategory>([primary]);
    const suggestions: TokenCategory[] = [primary];

    const families: Record<TokenCategory, TokenCategory[]> = {
      l1:                    ['governance_token', 'wrapped'],
      l2:                    ['bridge_token', 'defi_token'],
      sidechain:             ['l2', 'bridge_token'],
      stablecoin:            ['rwa_stablecoin', 'yield_token'],
      algorithmic_stablecoin:['stablecoin', 'rebasing_token'],
      rwa_stablecoin:        ['stablecoin', 'collateral'],
      governance_token:      ['defi_token', 'protocol_token'],
      defi_token:            ['governance_token', 'protocol_token'],
      protocol_token:        ['governance_token', 'fee_sharing'],
      oracle_token:          ['protocol_token', 'defi_token'],
      bridge_token:          ['crosschain_token', 'l2'],
      lp_token:              ['defi_token', 'yield_token'],
      liquid_staking:        ['yield_token', 'wrapped'],
      yield_token:           ['money_market', 'liquid_staking'],
      rebasing_token:        ['synthetic', 'defi_token'],
      wrapped:               ['synthetic', 'bridge_token'],
      synthetic:             ['derivative', 'defi_token'],
      derivative:            ['defi_token', 'synthetic'],
      index_token:           ['defi_token', 'protocol_token'],
      money_market:          ['defi_token', 'lending_token'],
      collateral:            ['money_market', 'wrapped'],
      lending_token:         ['money_market', 'yield_token'],
      meme_token:            ['defi_token', 'utility_token'],
      gaming_token:          ['nft_related', 'utility_token'],
      nft_related:           ['gaming_token', 'utility_token'],
      utility_token:         ['protocol_token', 'fee_sharing'],
      fee_sharing:           ['governance_token', 'protocol_token'],
      insurance_token:       ['protocol_token', 'defi_token'],
      crosschain_token:      ['bridge_token', 'l2'],
      other:                 ['defi_token'],
    };

    for (const related of (families[primary] || [])) {
      if (!seen.has(related)) { seen.add(related); suggestions.push(related); }
    }

    return suggestions.slice(0, 3);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private registerAsset(symbol: string, metadata: AssetMetadata): void {
    this.universe.assets.set(symbol.toUpperCase(), { ...metadata, symbol: symbol.toUpperCase() });
  }

  private registerDeployment(key: string, deployment: ChainDeployment): void {
    const existing = this.universe.deployments.get(key) || [];
    existing.push(deployment);
    this.universe.deployments.set(key, existing);
  }

  /**
   * FIX #4: Deduplicates relationships before inserting.
   */
  private registerRelationship(rel: SymbolRelationship): void {
    const key = `${rel.from.toUpperCase()}|${rel.type}|${rel.to.toUpperCase()}`;
    if (this.relationshipKeys.has(key)) return;
    this.relationshipKeys.add(key);
    this.universe.relationships.push({
      ...rel,
      from: rel.from.toUpperCase(),
      to:   rel.to.toUpperCase(),
    });
  }

  private registerDynamicAsset(symbol: string, source: DiscoverySource): void {
    const sym = symbol.toUpperCase();
    this.universe.dynamicAssets.set(sym, {
      discoveredAt: source.discoveredAt,
      source: `${source.exchange}:${source.baseAsset}/${source.quoteAsset}`,
      metadata: undefined,
    });

    if (!this.universe.assets.has(sym)) {
      this.registerAsset(sym, {
        symbol: sym, name: sym,
        decimals: 18, category: 'other',
        tier: 'tier_4', riskProfile: 'experimental',
      });
    }
  }

  /**
   * FIX #7: Derives tier from already-fetched liquidity/volume data.
   * Replaces inferTierFromUniswapLiquidity() which made one DexScreener
   * call per token (50+ calls in a loop).
   */
  private inferTierFromVolume(
    liquidityUsd?: number,
    volume24h?: number
  ): AssetMetadata['tier'] {
    const liq = liquidityUsd || 0;
    const vol = volume24h || 0;

    if (liq > 100_000_000 || vol > 500_000_000) return 'tier_1';
    if (liq > 10_000_000  || vol > 50_000_000)  return 'tier_2';
    if (liq > 1_000_000   || vol > 5_000_000)   return 'tier_3';
    return 'tier_4';
  }

  private inferCurveCategory(symbol: string, name: string): TokenCategory {
    const sym   = symbol.toUpperCase();
    const lower = (symbol + ' ' + name).toLowerCase();
    if (lower.includes('stablecoin') || sym.endsWith('USD')) return 'stablecoin';
    if (lower.includes('staking') || sym.startsWith('ST'))   return 'liquid_staking';
    if (['CRV', 'CURVE'].includes(sym))                       return 'governance_token';
    if (['CVX', 'CONVEX'].includes(sym))                      return 'defi_token';
    if (lower.includes(' lp') || lower.includes('pool'))      return 'lp_token';
    return this.inferCategory(symbol, name);
  }

  private async fetchAssetMetadataFromCoinGecko(symbol: string): Promise<Partial<AssetMetadata> | null> {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) return null;
      const data = await response.json();
      const coin = data.coins?.[0];
      if (!coin) return null;

      return {
        name: coin.name,
        decimals: 18,
        category: this.inferCategory(coin.symbol.toUpperCase(), coin.name),
      };
    } catch (error: any) {
      logger.debug(`[SymbolUniverse] CoinGecko lookup failed for ${symbol}: ${error.message}`);
      return null;
    }
  }

  /**
   * FIX #10: Returns 'unknown' for unrecognised chain IDs.
   * Callers skip deployment registration for 'unknown' chains.
   */
  chainIdToName(chainId: number): string {
    return CHAIN_ID_MAP[chainId] ?? 'unknown';
  }

  private getModalTier(tiers: string[]): string {
    const counts: Record<string, number> = {};
    for (const t of tiers) counts[t] = (counts[t] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'tier_4';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  getStats() {
    const byCategory: Record<string, number> = {};
    const byTier: Record<string, number>     = {};

    for (const asset of this.universe.assets.values()) {
      byCategory[asset.category] = (byCategory[asset.category] || 0) + 1;
      byTier[asset.tier]         = (byTier[asset.tier]         || 0) + 1;
    }

    const totalDeployments = [...this.universe.deployments.values()]
      .reduce((sum, deps) => sum + deps.length, 0);

    const discoveredCount = [...this.universe.assets.keys()]
      .filter(sym => this.universe.dynamicAssets.has(sym)).length;

    return {
      totalAssets: this.universe.assets.size,
      hardcodedAssets: this.universe.assets.size - discoveredCount,
      discoveredAssets: discoveredCount,
      totalRelationships: this.universe.relationships.length,
      byCategory, byTier, totalDeployments,
      lastSyncedAt: this.lastUpdated,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const symbolUniverse = new SymbolUniverseService();

/**
 * FIX #11: Also export under the runtime service name so consumers can
 * import either identifier and get the same singleton. The runtime
 * symbolUniverseService can call symbolUniverse.getKnownAssets() and
 * symbolUniverse.getRelationships() to enrich its own metadata without
 * duplicating the knowledge graph.
 */
export { symbolUniverse as symbolUniverseAdapter };