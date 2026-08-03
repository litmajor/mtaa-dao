/**
 * Mento Adapter
 * Celo's native stable-asset exchange protocol (cUSD, cEUR, cKES, cREAL <-> CELO)
 * Priority: 1 (Primary Celo stable-swap venue — deepest liquidity for
 * Celo-native stables, per MtaaDAO's locked DEX architecture)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DESIGN NOTE:
 * No official Mento REST API or subgraph was confirmed during research
 * for this adapter (unlike Uniswap/Moola, which have real — if
 * previously mis-pointed — subgraph infrastructure). Mento's own
 * reference implementations query the Broker contract directly on-chain,
 * which is also the pattern already proven working in this codebase
 * (see productionDexRouting.ts's queryMento/executeMentoSwap). This
 * adapter reuses that same Broker address and ABI rather than
 * introducing a second, possibly-divergent copy — see the "known
 * duplication" note below.
 *
 * KNOWN DUPLICATION: productionDexRouting.ts already implements Mento
 * quoting (queryMento) for swap-execution purposes. This adapter exists
 * for the Gateway's market-data aggregation layer (price/liquidity
 * feeds), which is a different consumer than the trade-execution path,
 * so some overlap is reasonable — but if both start drifting
 * independently (different provider-selection logic, different token
 * resolution) that's the same duplicate-infrastructure risk flagged
 * elsewhere in this codebase (Scanstream's four market-data systems).
 * Consider having one own the on-chain Mento query logic and the other
 * import it, rather than each maintaining its own copy.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { ethers } from "ethers";
import { BaseAdapter } from "./base-adapter";
import { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";
import { TokenRegistry } from "../../../../../shared/tokenRegistry";
import { getBestMentoQuote } from "../../../../../shared/mentoInfrastructure";

const ERC20_ABI = ["function decimals() view returns (uint8)"];

const MENTO_STABLES = ["CUSD", "CEUR", "CKES", "CREAL"];

export class MentoAdapter extends BaseAdapter {
  private provider: ethers.JsonRpcProvider;
  private decimalsCache: Map<string, number> = new Map();

  constructor(config: BaseAdapterConfig) {
    super("mento", config);
    this.provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL || "https://forno.celo.org");
  }

  async fetch(
    dataType: string,
    params: any
  ): Promise<AdapterResponse<NormalizedData | NormalizedData[]>> {
    const startTime = Date.now();

    try {
      if (dataType === "price") {
        return await this.fetchPrices(params);
      } else if (dataType === "liquidity") {
        return await this.fetchLiquidity(params);
      } else if (dataType === "apy") {
        return {
          success: false,
          error: "Mento is a stable-asset AMM, not a yield venue — no APY data applies",
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        success: false,
        error: `Unsupported data type: ${dataType}`,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async getDecimals(tokenAddress: string): Promise<number> {
    if (this.decimalsCache.has(tokenAddress)) return this.decimalsCache.get(tokenAddress)!;
    try {
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const d = Number(await token.decimals());
      this.decimalsCache.set(tokenAddress, d);
      return d;
    } catch {
      this.decimalsCache.set(tokenAddress, 18);
      return 18;
    }
  }

  /**
   * Find the best exchange provider + quoted amount for a token pair.
   * Returns null if no provider can quote this pair (e.g. neither side
   * is a Mento-supported stable, or the pair genuinely isn't listed).
   */
  private async getBestQuote(
    tokenInAddr: string,
    tokenOutAddr: string,
    amountIn: bigint
  ): Promise<{ provider: string; amountOut: bigint } | null> {
    return getBestMentoQuote(this.provider, tokenInAddr, tokenOutAddr, amountIn);
  }

  /**
   * Quote `symbol` against a reference stable (default cUSD). Only
   * meaningful for Mento-supported stables and CELO itself — this
   * adapter will return an error (not a fabricated number) for tokens
   * Mento doesn't actually list.
   */
  private async fetchPrices(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { symbol, quoteSymbol = "cUSD" } = params;

    if (!symbol) {
      return {
        success: false,
        error: "fetchPrices requires params.symbol",
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    const cacheKey = `mento:price:${symbol}:${quoteSymbol}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const celoTokens = TokenRegistry.getCeloDEXTokens();
      const baseEntry = celoTokens.get(symbol.toUpperCase());
      const quoteEntry = celoTokens.get(quoteSymbol.toUpperCase());

      if (!baseEntry || !quoteEntry) {
        return {
          success: false,
          error: `Token ${!baseEntry ? symbol : quoteSymbol} not found in tokenRegistry Celo DEX tokens`,
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
        };
      }

      const baseAddress = baseEntry.address.mainnet || baseEntry.address.testnet;
      const quoteAddress = quoteEntry.address.mainnet || quoteEntry.address.testnet;

      const inDecimals = await this.getDecimals(baseAddress);
      const outDecimals = await this.getDecimals(quoteAddress);
      const oneUnit = ethers.parseUnits("1", inDecimals);

      const quote = await this.getBestQuote(baseAddress, quoteAddress, oneUnit);

      if (!quote) {
        return {
          success: false,
          error: `No Mento exchange provider quotes ${symbol}/${quoteSymbol} — this pair may not be listed on Mento`,
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
        };
      }

      const price = Number(ethers.formatUnits(quote.amountOut, outDecimals));

      const result: NormalizedData = {
        id: `mento:${symbol}:${Date.now()}`,
        source: "mento",
        timestamp: new Date().toISOString(),
        dataType: "price",
        asset: {
          symbol,
          chain: "celo",
          address: baseAddress,
        },
        value: price,
        metadata: {
          confidence: 0.97, // Mento is protocol-governed reserve-backed pricing,
                             // generally the most reliable source for its own stables
          quotedIn: quoteSymbol,
          exchangeProvider: quote.provider,
          isMentoNativeStable: MENTO_STABLES.includes(symbol.toUpperCase()),
        },
      };

      this.setCache(cacheKey, [result], 30); // short TTL — Mento rates can move with reserve rebalancing

      return {
        success: true,
        data: [result],
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Liquidity depth proxy for a pair, same quote-depth-comparison
   * approach as the Ubeswap adapter (see that file's docstring for why
   * this is an approximation rather than true reserve data). Mento's
   * actual depth is governed by its reserve contract, which this
   * adapter does not query directly — a future improvement would read
   * the Reserve contract's balances rather than inferring from slippage.
   */
  private async fetchLiquidity(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { symbol, quoteSymbol = "cUSD" } = params;

    if (!symbol) {
      return {
        success: false,
        error: "fetchLiquidity requires params.symbol",
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const celoTokens = TokenRegistry.getCeloDEXTokens();
      const baseEntry = celoTokens.get(symbol.toUpperCase());
      const quoteEntry = celoTokens.get(quoteSymbol.toUpperCase());

      if (!baseEntry || !quoteEntry) {
        return {
          success: false,
          error: `Token ${!baseEntry ? symbol : quoteSymbol} not found in tokenRegistry Celo DEX tokens`,
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
        };
      }

      const baseAddress = baseEntry.address.mainnet || baseEntry.address.testnet;
      const quoteAddress = quoteEntry.address.mainnet || quoteEntry.address.testnet;

      const inDecimals = await this.getDecimals(baseAddress);
      const outDecimals = await this.getDecimals(quoteAddress);

      const smallIn = ethers.parseUnits("1", inDecimals);
      const largeIn = ethers.parseUnits("10000", inDecimals); // Mento pools are typically much deeper than Ubeswap's

      const [smallQuote, largeQuote] = await Promise.all([
        this.getBestQuote(baseAddress, quoteAddress, smallIn),
        this.getBestQuote(baseAddress, quoteAddress, largeIn),
      ]);

      if (!smallQuote || !largeQuote) {
        return {
          success: false,
          error: `No Mento liquidity found for ${symbol}/${quoteSymbol}`,
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
        };
      }

      const smallPrice = Number(ethers.formatUnits(smallQuote.amountOut, outDecimals));
      const largePrice = Number(ethers.formatUnits(largeQuote.amountOut, outDecimals)) / Number(ethers.formatUnits(largeIn, inDecimals));
      const priceImpact = smallPrice > 0 ? Math.abs(1 - largePrice / smallPrice) : null;

      const result: NormalizedData = {
        id: `mento:liquidity:${symbol}-${quoteSymbol}:${Date.now()}`,
        source: "mento",
        timestamp: new Date().toISOString(),
        dataType: "liquidity",
        asset: {
          symbol: `${symbol}-${quoteSymbol}`,
          chain: "celo",
          address: baseAddress,
        },
        value: priceImpact !== null ? 1 / Math.max(priceImpact, 0.0001) : 0,
        metadata: {
          confidence: 0.5, // approximation — see method docstring
          isProxy: true,
          priceImpactFor10000Units: priceImpact,
          exchangeProvider: largeQuote.provider,
          note: "Derived from quote-depth comparison against the Broker, not the Reserve contract's actual balances",
        },
      };

      return {
        success: true,
        data: [result],
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }
  }
}