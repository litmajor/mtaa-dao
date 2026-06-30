/**
 * Token Registry Service
 *
 * Manages supported tokens across all blockchains.
 * Provides token metadata, categorisation, and validation.
 *
 * v2 changes:
 * - Token data moved to tokens.config.json (easier updates, version-controllable)
 * - Removed 'ton' from SupportedChain (no tokens defined for it)
 * - Added BNB, AVAX, MATIC natives + WETH, WBNB, WMATIC, WAVAX wrapped tokens
 * - Fixed PYUSD Solana address, FDUSD address (ETH + BSC)
 * - filterTokens() and getAssets() now use a TTL result cache (1 s default)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger';

// ============= TYPES & INTERFACES =============

export type SupportedChain =
  | 'ethereum'
  | 'celo'
  | 'polygon'
  | 'tron'
  | 'solana'
  | 'optimism'
  | 'arbitrum'
  | 'base'
  | 'bsc'
  | 'avalanche'
  | 'moonriver'
  | 'zksync'
  | 'xdc'
  | 'klaytn'
  | 'kava'
  | 'polygon-zkevm'
  | 'moonbeam'
  | 'boba'
  | 'aurora'
  | 'fantom'
  | 'evmos'
  | 'harmony'
  | 'gnosis';
// NOTE: 'ton' removed — add back once TON tokens are defined in tokens.config.json

export interface TokenMetadata {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chain: SupportedChain;
  chainId?: string | number;
  category: 'stablecoin' | 'wrapped' | 'native' | 'governance' | 'utility' | 'bridge';
  logoUrl?: string;
  coingeckoId?: string;
  description?: string;
  /** ISO timestamp — injected automatically during load if absent in JSON */
  added: string;
  // NEW: CEX bridging fields
  celoNativeOnly?: boolean; // true = no CEX order book, DEX-only
  hasCEXLiquidity?: boolean; // true = this token (or its cexSymbol) trades on CEX
  cexSymbol?: string; // the symbol to use on CEXes (e.g. WETH -> ETH)
}

export interface TokenRegistryFilter {
  chain?: string;
  category?: string;
  symbol?: string;
  address?: string;
}

/** Shape of tokens.config.json */
interface TokenConfig {
  native: Omit<TokenMetadata, 'added'>[];
  stablecoins: Omit<TokenMetadata, 'added'>[];
  wrapped: Omit<TokenMetadata, 'added'>[];
  governance: Omit<TokenMetadata, 'added'>[];
}

// ============= TOKEN REGISTRY SERVICE =============

class TokenRegistry {
  private tokens: Map<string, TokenMetadata> = new Map();
  private tokensByChain: Map<string, TokenMetadata[]> = new Map();
  private tokensByCategory: Map<string, TokenMetadata[]> = new Map();
  private lastUpdated: number = 0;

  /** Simple TTL cache for filterTokens / getAssets results */
  private filterCache: Map<string, { result: TokenMetadata[]; expiresAt: number }> = new Map();
  private readonly FILTER_CACHE_TTL_MS = 1000; // 1 second

  constructor() {
    this.initializeTokens();
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  /**
   * Load tokens from tokens.config.json.
   * Falls back to empty registry with a loud warning on any load / parse error.
   */
  private initializeTokens(): void {
    // __dirname is not defined in ES module scope; compute from import.meta.url
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const configPath = path.resolve(__dirname, 'tokens.config.json');

    let config: TokenConfig;
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(raw) as TokenConfig;
    } catch (err) {
      logger.error(`[TokenRegistry] Failed to load tokens.config.json from ${configPath}:`, err);
      logger.warn('[TokenRegistry] Registry is empty — all lookups will return null / []');
      this.lastUpdated = Date.now();
      return;
    }

    const now = new Date().toISOString();

    const allTokens: TokenMetadata[] = [
      ...config.native,
      ...config.stablecoins,
      ...config.wrapped,
      ...config.governance,
    ].map(t => ({ ...t, added: now } as TokenMetadata));

    for (const token of allTokens) {
      this.indexToken(token);
    }

    this.lastUpdated = Date.now();
    logger.info(
      `[TokenRegistry] Loaded ${allTokens.length} tokens ` +
        `(${config.native.length} native, ${config.stablecoins.length} stables, ` +
        `${config.wrapped.length} wrapped, ${config.governance.length} governance) ` +
        `from ${configPath}`
    );
  }

  /** Register a token into all internal indices. */
  private indexToken(token: TokenMetadata): void {
    const key = `${token.chain}:${token.address.toLowerCase()}`;
    this.tokens.set(key, token);

    if (!this.tokensByChain.has(token.chain)) {
      this.tokensByChain.set(token.chain, []);
    }
    this.tokensByChain.get(token.chain)!.push(token);

    if (!this.tokensByCategory.has(token.category)) {
      this.tokensByCategory.set(token.category, []);
    }
    this.tokensByCategory.get(token.category)!.push(token);
  }

  // ---------------------------------------------------------------------------
  // Public read API
  // ---------------------------------------------------------------------------

  getToken(chain: string, address: string): TokenMetadata | null {
    const key = `${chain.toLowerCase()}:${address.toLowerCase()}`;
    return this.tokens.get(key) ?? null;
  }

  getTokensByChain(chain: string): TokenMetadata[] {
    return this.tokensByChain.get(chain.toLowerCase()) ?? [];
  }

  getTokensByCategory(category: string): TokenMetadata[] {
    return this.tokensByCategory.get(category.toLowerCase()) ?? [];
  }

  getAllTokens(): TokenMetadata[] {
    return Array.from(this.tokens.values());
  }

  validateToken(chain: string, address: string): boolean {
    return this.getToken(chain, address) !== null;
  }

  getSupportedChains(): string[] {
    return Array.from(this.tokensByChain.keys());
  }

  getSupportedCategories(): string[] {
    return Array.from(this.tokensByCategory.keys());
  }

  // ---------------------------------------------------------------------------
  // Cached filter helpers
  // ---------------------------------------------------------------------------

  /**
   * Filter tokens by any combination of chain / category / symbol / address.
   * Results are cached for FILTER_CACHE_TTL_MS to avoid repeated full-array scans
   * under high-traffic scan cycles.
   */
  filterTokens(filter: TokenRegistryFilter): TokenMetadata[] {
    const cacheKey = JSON.stringify(filter);
    const cached = this.filterCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.result;
    }

    let results = Array.from(this.tokens.values());

    if (filter.chain) {
      const lc = filter.chain.toLowerCase();
      results = results.filter(t => t.chain === lc);
    }
    if (filter.category) {
      const lc = filter.category.toLowerCase();
      results = results.filter(t => t.category === lc);
    }
    if (filter.symbol) {
      const uc = filter.symbol.toUpperCase();
      results = results.filter(t => t.symbol === uc);
    }
    if (filter.address) {
      const lc = filter.address.toLowerCase();
      results = results.filter(t => t.address.toLowerCase() === lc);
    }

    this.filterCache.set(cacheKey, {
      result: results,
      expiresAt: Date.now() + this.FILTER_CACHE_TTL_MS,
    });

    return results;
  }

  /**
   * Convenience display getter — same caching as filterTokens.
   */
  getAssets(chain?: string, category?: string): TokenMetadata[] {
    const cacheKey = `assets:${chain ?? '*'}:${category ?? '*'}`;
    const cached = this.filterCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.result;
    }

    let results = Array.from(this.tokens.values());

    if (chain) {
      const lc = chain.toLowerCase();
      results = results.filter(t => t.chain === lc);
    }
    if (category) {
      const lc = category.toLowerCase();
      results = results.filter(t => t.category === lc);
    }

    results.sort((a, b) => a.symbol.localeCompare(b.symbol));

    this.filterCache.set(cacheKey, {
      result: results,
      expiresAt: Date.now() + this.FILTER_CACHE_TTL_MS,
    });

    return results;
  }

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  /**
   * Add or update a token at runtime (e.g. from an external discovery service).
   * Invalidates the filter cache.
   */
  addToken(token: TokenMetadata): void {
    const key = `${token.chain}:${token.address.toLowerCase()}`;

    // Update chain index
    if (!this.tokensByChain.has(token.chain)) {
      this.tokensByChain.set(token.chain, []);
    }
    const chainTokens = this.tokensByChain.get(token.chain)!;
    const chainIdx = chainTokens.findIndex(
      t => t.address.toLowerCase() === token.address.toLowerCase()
    );
    if (chainIdx >= 0) {
      chainTokens[chainIdx] = token;
    } else {
      chainTokens.push(token);
    }

    // Update category index
    if (!this.tokensByCategory.has(token.category)) {
      this.tokensByCategory.set(token.category, []);
    }
    const catTokens = this.tokensByCategory.get(token.category)!;
    const catIdx = catTokens.findIndex(
      t => t.address.toLowerCase() === token.address.toLowerCase()
    );
    if (catIdx >= 0) {
      catTokens[catIdx] = token;
    } else {
      catTokens.push(token);
    }

    this.tokens.set(key, token);

    // Bust filter cache
    this.filterCache.clear();

    logger.info(`[TokenRegistry] Token added/updated: ${token.symbol} on ${token.chain}`);
  }

  // ---------------------------------------------------------------------------
  // CEX Market Universe Helpers
  // ---------------------------------------------------------------------------

  /**
   * Get tokens relevant for CEX market universe building.
   * Filters out Celo-native-only tokens and returns metadata by symbol for enrichment.
   * Prefers ethereum > polygon > bsc chain priority when symbol exists on multiple chains.
   */
  getCEXRelevantSymbols(): Map<string, TokenMetadata> {
    // New shape: return map keyed by CEX symbol (e.g. ETH, BTC, USDC)
    // Value contains minimal enrichment: celoAddress, cexSymbol, coingeckoId, decimals
    const result = new Map<string, {
      celoAddress: string;
      cexSymbol: string;
      coingeckoId?: string;
      decimals: number;
    }>();

    for (const token of this.tokens.values()) {
      // Skip explicit Celo-native-only tokens
      if (token.celoNativeOnly) continue;

      // Normalize CEX symbol (wrapped tokens map to their underlying CEX symbol)
      const cexSymbol = (token.cexSymbol || token.symbol || '').toUpperCase();
      if (!cexSymbol) continue;

      const hasCEXLiquidity = token.hasCEXLiquidity || ['CELO', 'BTC', 'ETH', 'USDC', 'USDT'].includes(cexSymbol);
      if (!hasCEXLiquidity) continue;

      if (!result.has(cexSymbol)) {
        result.set(cexSymbol, {
          celoAddress: token.address,
          cexSymbol,
          coingeckoId: token.coingeckoId,
          decimals: token.decimals,
        });
      }
    }

    logger.debug(`[getCEXRelevantSymbols] Built CEX metadata map: ${result.size} symbols`);
    // NOTE: returns Map keyed by CEX symbol (ETH, BTC, USDC, USDT, CELO)
    return result as unknown as Map<string, TokenMetadata>;
  }

  /**
   * Return a map of all Celo DEX tokens keyed by symbol (uppercase) -> address/decimals/meta
   */
  getCeloDEXTokens(): Map<string, { address: string; symbol: string; decimals: number; coingeckoId?: string }> {
    const m = new Map<string, { address: string; symbol: string; decimals: number; coingeckoId?: string }>();
    for (const token of this.tokens.values()) {
      m.set((token.symbol || '').toUpperCase(), {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        coingeckoId: token.coingeckoId,
      });
    }
    return m;
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  getStats(): {
    totalTokens: number;
    chainCount: number;
    categoryCount: number;
    lastUpdated: string;
  } {
    return {
      totalTokens: this.tokens.size,
      chainCount: this.tokensByChain.size,
      categoryCount: this.tokensByCategory.size,
      lastUpdated: new Date(this.lastUpdated).toISOString(),
    };
  }
}

// ============= SERVICE INSTANCE =============

const tokenRegistry = new TokenRegistry();

// ============= NAMED EXPORTS FOR CEX MARKET BUILDING =============

/**
 * Get tokens relevant for CEX market universe building.
 * Filters out Celo-native-only tokens and returns metadata by symbol for enrichment.
 */
export function getCEXRelevantSymbols(): Map<string, TokenMetadata> {
  return tokenRegistry.getCEXRelevantSymbols();
}

export { tokenRegistry, TokenRegistry };