/**
 * Market Universe Builder
 *
 * Consumes live CCXT market data + server/services tokenRegistry metadata.
 * Produces a comprehensive universe of CEX-tradeable assets with enrichment.
 *
 * ARCHITECTURE:
 * 1. Load all markets from configured exchanges (in parallel)
 * 2. Extract base/quote pairs, filter quote currencies (USDT, USD, USDC, etc.)
 * 3. Build symbol→exchanges coverage map
 * 4. Enrich with token metadata (coingeckoId, chain, category) from tokenRegistry
 * 5. Sort by arbitrage eligibility + coverage
 * 6. Cache for 15 minutes, rebuild on-demand
 *
 * Output: ~300-500 assets, ~200-350 arb-eligible (vs 9 hardcoded)
 */

import { ccxtService } from './ccxtService';
import { tokenRegistry } from './tokenRegistry';
import { getCEXRelevantSymbols } from './tokenRegistry';
import { TokenRegistry as CeloRegistry } from '../../shared/tokenRegistry';
import { logger } from '../utils/logger';

// Definitive incompatible set — union of both registries' Celo-native tokens
const CEX_INCOMPATIBLE = new Set([
  ...CeloRegistry.getCeloNativeSymbols(),
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD', // pure stablecoins
  'USD', 'EUR', 'GBP',                                      // fiat
]);

const PREFERRED_QUOTES = ['USDT', 'USD', 'USDC', 'BTC', 'ETH'];
const UNIVERSE_REFRESH_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Market asset with enriched metadata
 */
export interface MarketAsset {
  symbol: string;
  availableOn: string[]; // exchanges where listed
  quoteCurrencies: string[]; // USDT, USD, etc.
  arbitrageEligible: boolean; // listed on 2+ exchanges
  coingeckoId?: string; // from server tokenRegistry
  chain?: string; // canonical chain from server tokenRegistry
  category?: string; // native/stablecoin/wrapped/governance
  dexAvailable?: boolean; // has liquidity on Celo DEXes (from DexScreener)
}

/**
 * Market Universe Builder — single source of truth for CEX universe
 */
export class MarketUniverseBuilder {
  private universe: MarketAsset[] = [];
  private lastBuilt = 0;
  private buildPromise: Promise<MarketAsset[]> | null = null; // prevent concurrent builds

  async buildUniverse(exchanges: string[]): Promise<MarketAsset[]> {
    // Prevent concurrent builds — return in-flight promise if already building
    if (this.buildPromise) return this.buildPromise;

    const now = Date.now();
    if (this.universe.length > 0 && now - this.lastBuilt < UNIVERSE_REFRESH_MS) {
      return this.universe;
    }

    this.buildPromise = this._build(exchanges).finally(() => {
      this.buildPromise = null;
    });

    return this.buildPromise;
  }

  private async _build(exchanges: string[]): Promise<MarketAsset[]> {
    logger.info('[MarketUniverse] Building from live exchange markets...');
    const t0 = Date.now();

    // Pull enrichment metadata from server/services tokenRegistry
    const cexMetadata = getCEXRelevantSymbols();
    // Map<symbol, TokenMetadata> — BTC → {coingeckoId:'bitcoin', chain:'ethereum'...}

    // Load markets from all exchanges in parallel
    const exchangeResults = await Promise.allSettled(
      exchanges.map(async ex => {
        try {
          const markets = await ccxtService.getMarkets(ex);
          return { ex, markets, ok: true };
        } catch (err: any) {
          logger.warn(`[MarketUniverse] Failed to load markets from ${ex}: ${err?.message || err}`);
          return { ex, markets: [], ok: false };
        }
      })
    );

    // Build symbol → exchange coverage map
    const symbolMap = new Map<
      string,
      {
        exchanges: Set<string>;
        quotes: Set<string>;
      }
    >();

    for (const result of exchangeResults) {
      if (result.status !== 'fulfilled' || !result.value.ok) continue;
      const { ex, markets } = result.value;

      for (const market of markets) {
        const base = (market as any).base?.toUpperCase();
        const quote = (market as any).quote?.toUpperCase();
        if (!base || !quote) continue;
        if (CEX_INCOMPATIBLE.has(base)) continue;
        if (!PREFERRED_QUOTES.includes(quote)) continue;

        if (!symbolMap.has(base)) {
          symbolMap.set(base, { exchanges: new Set(), quotes: new Set() });
        }
        symbolMap.get(base)!.exchanges.add(ex);
        symbolMap.get(base)!.quotes.add(quote);
      }
    }

    // Build final asset list, enriched with token metadata
    const assets: MarketAsset[] = [];

    for (const [symbol, data] of symbolMap.entries()) {
      const meta = cexMetadata.get(symbol); // may be undefined for new tokens
      const exchangeList = Array.from(data.exchanges);

      assets.push({
        symbol,
        availableOn: exchangeList,
        quoteCurrencies: Array.from(data.quotes),
        arbitrageEligible: exchangeList.length >= 2,
        coingeckoId: meta?.coingeckoId,
        chain: meta?.chain,
        category: meta?.category,
      });
    }

    // Sort: arb-eligible first, then by exchange count descending
    assets.sort((a, b) => {
      if (a.arbitrageEligible !== b.arbitrageEligible) {
        return a.arbitrageEligible ? -1 : 1;
      }
      return b.availableOn.length - a.availableOn.length;
    });

    this.universe = assets;
    this.lastBuilt = Date.now();

    const arbCount = assets.filter(a => a.arbitrageEligible).length;
    logger.info(
      `[MarketUniverse] Built: ${assets.length} total assets, ` +
        `${arbCount} arb-eligible, ` +
        `${assets.length - arbCount} single-exchange, ` +
        `in ${Date.now() - t0}ms`
    );

    // Register discovered coingeckoIds with the central price oracle so the
    // fallback service can resolve these symbols immediately.
    try {
      const oracleMap = new Map<string, string>();
      for (const asset of assets) {
        if (asset.coingeckoId && asset.symbol) {
          oracleMap.set(asset.symbol.toUpperCase(), asset.coingeckoId);
        }
      }
      if (oracleMap.size > 0) {
        const { priceOracle } = await import('./priceOracle');
        priceOracle.registerSymbolMappings(oracleMap);
        logger.info(`[MarketUniverse] Registered ${oracleMap.size} coingeckoIds with price oracle`);
      }
    } catch (err: any) {
      logger.warn('[MarketUniverse] Failed to register coingeckoIds with price oracle:', err?.message || err);
    }

    // Enrich with DexScreener Celo data: mark tokens that actually have DEX
    // liquidity on Celo and register any discovered coingeckoIds heuristically
    try {
      const { dexscreenerClient } = await import('./dexscreenerClient');
      // Collect all known Celo token addresses from tokenRegistry
      const celoAddrs = tokenRegistry.getAllTokens().map(t => (t.address || '').toLowerCase()).filter(a => !!a);
      const dexData = await dexscreenerClient.enrichWithCeloDEXData(celoAddrs);

      // Import oracle once for registrations
      const { priceOracle } = await import('./priceOracle');

      for (const asset of assets) {
        const celoToken = tokenRegistry.getCeloDEXTokens().get(asset.symbol);
        if (!celoToken) continue;

        const dexInfo = dexData.get((celoToken.address || '').toLowerCase());
        if (dexInfo && dexInfo.hasDEXData) {
          asset.dexAvailable = true;

          // Attempt to register a coingecko mapping from DexScreener discovery
          // DexScreener doesn't provide coingeckoId directly; try tokenRegistry first
          if (!asset.coingeckoId) {
            // tokenRegistry may already have the mapping by symbol/address
            const registryMatch = tokenRegistry.filterTokens({ symbol: asset.symbol })[0];
            if (registryMatch && registryMatch.coingeckoId) {
              priceOracle.registerSymbolMapping(asset.symbol, registryMatch.coingeckoId);
              asset.coingeckoId = registryMatch.coingeckoId;
            } else {
              // Heuristic fallback: use lowercase symbol as a candidate CoinGecko id
              const candidate = asset.symbol.toLowerCase();
              if (/^[a-z0-9-]{1,64}$/.test(candidate)) {
                priceOracle.registerSymbolMapping(asset.symbol, candidate);
                logger.debug(`[MarketUniverse] Heuristically registered ${asset.symbol} → ${candidate}`);
              }
            }
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[MarketUniverse] DexScreener enrichment failed: ${err?.message || err}`);
    }

    // Seed OHLCV data source registry to avoid expensive CCXT discovery probes
    try {
      const { ohlcvService } = await import('./ohlcvService');
      for (const asset of assets) {
        try {
          if (asset.availableOn && asset.availableOn.length > 0) {
            // Pass symbol + exchange list. quoteCurrencies are optional; keep call conservative.
            (ohlcvService as any).seedDataSourceRegistry?.(asset.symbol, asset.availableOn);
          }
        } catch (e: any) {
          logger.debug(`[MarketUniverse] Failed to seed OHLCV registry for ${asset.symbol}`, { error: e?.message || String(e) });
        }
      }
      logger.info('[MarketUniverse] Seeded OHLCV dataSourceRegistry from MarketUniverse');
    } catch (err) {
      logger.debug('[MarketUniverse] Unable to seed OHLCV registry:', err);
    }

    return assets;
  }

  getTopArbitrageSymbols(limit = 100): string[] {
    return this.universe
      .filter(a => a.arbitrageEligible)
      .slice(0, limit)
      .map(a => a.symbol);
  }

  getTradingPairs(limit = 200, preferredQuote = 'USDT'): string[] {
    const symbols = this.getTopArbitrageSymbols(limit);
    const pairs: string[] = [];

    for (const symbol of symbols) {
      const asset = this.universe.find(a => a.symbol === symbol)!;
      // Add USDT pair if available
      if (asset.quoteCurrencies.includes('USDT')) pairs.push(`${symbol}/USDT`);
      // Add USD pair for coinbase/kraken coverage
      if (asset.quoteCurrencies.includes('USD')) pairs.push(`${symbol}/USD`);
    }

    return [...new Set(pairs)]; // deduplicate
  }

  getSymbolsForExchanges(exchanges: string[]): string[] {
    return this.universe
      .filter(a => exchanges.every(ex => a.availableOn.includes(ex)))
      .map(a => a.symbol);
  }

  getStats() {
    return {
      total: this.universe.length,
      arbitrageEligible: this.universe.filter(a => a.arbitrageEligible).length,
      singleExchange: this.universe.filter(a => !a.arbitrageEligible).length,
      withMetadata: this.universe.filter(a => a.coingeckoId).length,
      byExchangeCount: this.universe.reduce(
        (acc, a) => {
          const k = String(a.availableOn.length);
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      ageMs: Date.now() - this.lastBuilt,
      lastBuilt: new Date(this.lastBuilt).toISOString(),
    };
  }

  /**
   * Expose universe for internal iteration (OpportunityEngine)
   */
  getUniverse(): MarketAsset[] {
    return this.universe;
  }
}

export const marketUniverseBuilder = new MarketUniverseBuilder();
