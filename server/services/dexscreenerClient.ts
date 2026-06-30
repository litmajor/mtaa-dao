/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DexScreener API Client
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Bridges multi-chain DEX pair discovery with Node.js server.
 * Enables real-time trending pair detection and market data enrichment.
 *
 * Public DexScreener REST API — no authentication required:
 * - https://api.dexscreener.com/latest/dex/search?q=TOKEN
 * - https://api.dexscreener.com/latest/dex/pairs/{chainId}/{pairAddress}
 * - https://api.dexscreener.com/latest/dex/tokens/{tokenAddress}
 * - https://api.dexscreener.com/token-boosts/latest/v1
 */

import { logger } from '../utils/logger';

// ============= TYPES =============

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string | null;
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number; // Fully diluted valuation
  pairCreatedAt?: number;
  volume?: {
    h1?: number;
    h6?: number;
    h24: number;
  };
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  txns?: {
    m5?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    h6?: { buys?: number; sells?: number };
    h24?: { buys?: number; sells?: number };
  };
}

export interface DexToken {
  address: string;
  name: string;
  symbol: string;
  decimals?: number;
  chainId: string;
}

export interface DexPairEnrichment {
  bestPair: DexPair | null;
  totalLiquidityUsd: number;
  volume24h: number;
  dexes: string[];
  hasDEXData: boolean;
}

// ============= CLIENT =============

export class DexScreenerClient {
  private readonly BASE_URL = 'https://api.dexscreener.com';
  private readonly RATE_LIMIT_MS = 300; // ~3 req/s on free tier
  private lastCall = 0;

  /**
   * Rate-limited fetch wrapper — enforces free tier limits.
   */
  private async rateLimitedFetch(url: string): Promise<any> {
    const now = Date.now();
    const wait = this.RATE_LIMIT_MS - (now - this.lastCall);
    if (wait > 0) {
      await new Promise(r => setTimeout(r, wait));
    }
    this.lastCall = Date.now();

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`DexScreener ${response.status}: ${url}`);
      }
      return response.json();
    } catch (err: any) {
      logger.warn(`[DexScreener] Fetch failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Search across all chains and DEXes for a query.
   * Returns pairs matching the symbol or token name.
   */
  async searchPairs(query: string): Promise<DexPair[]> {
    try {
      const data = await this.rateLimitedFetch(
        `${this.BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      return data.pairs || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Get all pairs for a specific token address on any chain.
   */
  async getTokenPairs(tokenAddress: string): Promise<DexPair[]> {
    try {
      const data = await this.rateLimitedFetch(
        `${this.BASE_URL}/latest/dex/tokens/${tokenAddress}`
      );
      return data.pairs || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Get detailed info about a specific pair.
   */
  async getPairDetails(chainId: string, pairAddress: string): Promise<DexPair | null> {
    try {
      const data = await this.rateLimitedFetch(
        `${this.BASE_URL}/latest/dex/pairs/${chainId}/${pairAddress}`
      );
      return data.pair || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Get Celo-specific trending pairs with liquidity/volume filters.
   */
  async getCeloTrendingPairs(options?: {
    minLiquidityUsd?: number;
    minVolume24h?: number;
    limit?: number;
  }): Promise<DexPair[]> {
    const {
      minLiquidityUsd = 10_000,
      minVolume24h = 5_000,
      limit = 50,
    } = options || {};

    try {
      // Search for celo pairs (returns top results, may include non-Celo)
      const pairs = await this.searchPairs('celo');

      // Filter for Celo chain with liquidity/volume thresholds
      const filtered = pairs
        .filter(p =>
          p.chainId === 'celo' &&
          (p.liquidity?.usd || 0) >= minLiquidityUsd &&
          (p.volume?.h24 || 0) >= minVolume24h
        )
        .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, limit);

      // Auto-register discovered tokens with the price oracle (best-effort)
      try {
        const { priceOracle } = await import('./priceOracle');
        const { tokenRegistry } = await import('./tokenRegistry');
        const supported = new Set(priceOracle.getSupportedCurrencies().map(s => s.toUpperCase()));

        for (const pair of filtered) {
          const candidates = [pair.baseToken, pair.quoteToken];
          for (const tk of candidates) {
            const sym = (tk.symbol || '').toUpperCase();
            if (!sym || supported.has(sym)) continue;

            // First try token registry lookup (best source)
            const reg = tokenRegistry.filterTokens({ symbol: sym })[0];
            if (reg && reg.coingeckoId) {
              priceOracle.registerSymbolMapping(sym, reg.coingeckoId);
              supported.add(sym);
              logger.debug(`[DexScreener] Registered ${sym} → ${reg.coingeckoId} from tokenRegistry`);
              continue;
            }

            // Heuristic fallback: use lowercase symbol as candidate coingecko id
            const candidate = sym.toLowerCase();
            if (/^[a-z0-9-]{1,64}$/.test(candidate)) {
              priceOracle.registerSymbolMapping(sym, candidate);
              supported.add(sym);
              logger.debug(`[DexScreener] Heuristically registered ${sym} → ${candidate}`);
            }
          }
        }
      } catch (regErr: any) {
        logger.warn('[DexScreener] Auto-registration with price oracle failed:', regErr?.message || regErr);
      }

      return filtered;
    } catch (err) {
      logger.warn('[DexScreener] getCeloTrendingPairs failed:', err);
      return [];
    }
  }

  /**
   * Get Celo pairs for a list of token addresses.
   * Batches requests (max 30 per request) to stay within API limits.
   */
  async getCeloPairsForTokens(tokenAddresses: string[]): Promise<Map<string, DexPair[]>> {
    const result = new Map<string, DexPair[]>();

    // Batch: DexScreener allows comma-separated addresses, max 30 per request
    const BATCH_SIZE = 30;
    for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
      const batch = tokenAddresses.slice(i, i + BATCH_SIZE);
      try {
        const data = await this.rateLimitedFetch(
          `${this.BASE_URL}/latest/dex/tokens/${batch.join(',')}`
        );
        const pairs: DexPair[] = data.pairs || [];

        for (const pair of pairs) {
          if (pair.chainId !== 'celo') continue;

          const addr = pair.baseToken.address.toLowerCase();
          if (!result.has(addr)) {
            result.set(addr, []);
          }
          result.get(addr)!.push(pair);
        }
      } catch (err: any) {
        logger.warn(`[DexScreener] Batch ${i / BATCH_SIZE + 1} failed: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Enrich Celo token addresses with DEX liquidity data from DexScreener.
   * Used to mark which Celo tokens have real DEX presence.
   */
  async enrichWithCeloDEXData(
    celoTokenAddresses: string[]
  ): Promise<Map<string, DexPairEnrichment>> {
    const pairsByToken = await this.getCeloPairsForTokens(celoTokenAddresses);
    const result = new Map<string, DexPairEnrichment>();

    for (const [address, pairs] of pairsByToken.entries()) {
      const sorted = pairs.sort((a, b) =>
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      );

      result.set(address, {
        bestPair: sorted[0] || null,
        totalLiquidityUsd: pairs.reduce((s, p) => s + (p.liquidity?.usd || 0), 0),
        volume24h: pairs.reduce((s, p) => s + (p.volume?.h24 || 0), 0),
        dexes: [...new Set(pairs.map(p => p.dexId))],
        hasDEXData: pairs.length > 0,
      });
    }

    logger.info(
      `[DexScreener] Enriched ${result.size} Celo tokens with DEX data ` +
      `(found DEX pairs for ${Array.from(result.values()).filter(r => r.hasDEXData).length})`
    );

    return result;
  }

  /**
   * Monitor trending Celo tokens and return any new ones above liquidity threshold.
   * Useful for continuous discovery of emerging tokens.
   */
  async discoverEmergingCeloTokens(
    knownAddresses: Set<string>,
    options?: {
      minLiquidityUsd?: number;
      minVolume24h?: number;
    }
  ): Promise<DexToken[]> {
    const {
      minLiquidityUsd = 100_000,
      minVolume24h = 50_000,
    } = options || {};

    try {
      const pairs = await this.getCeloTrendingPairs({
        minLiquidityUsd,
        minVolume24h,
        limit: 100,
      });

      const emerging: DexToken[] = [];

      for (const pair of pairs) {
        const baseAddr = pair.baseToken.address.toLowerCase();
        const quoteAddr = pair.quoteToken.address.toLowerCase();

        // Discover tokens not yet in our registry
        if (!knownAddresses.has(baseAddr)) {
          emerging.push({
            address: pair.baseToken.address,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            chainId: pair.chainId,
          });
        }

        if (!knownAddresses.has(quoteAddr)) {
          emerging.push({
            address: pair.quoteToken.address,
            symbol: pair.quoteToken.symbol,
            name: pair.quoteToken.name,
            chainId: pair.chainId,
          });
        }
      }

      // Deduplicate by address
      const deduped = Array.from(
        new Map(emerging.map(t => [t.address.toLowerCase(), t])).values()
      );

      logger.info(
        `[DexScreener] Discovered ${deduped.length} emerging Celo tokens ` +
        `above $${minLiquidityUsd} liquidity threshold`
      );

      return deduped;
    } catch (err: any) {
      logger.warn('[DexScreener] Emerging token discovery failed:', err.message);
      return [];
    }
  }
}

// ============= SINGLETON EXPORT =============

export const dexscreenerClient = new DexScreenerClient();
