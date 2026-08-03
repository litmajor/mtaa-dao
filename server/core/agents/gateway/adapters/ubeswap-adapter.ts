/**
 * Ubeswap Adapter
 * Celo-native Uniswap V2 fork — on-chain price/liquidity data source
 * Priority: 2 (Primary Celo DEX, alongside Mento)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DESIGN NOTE:
 * Unlike the Uniswap/Moola adapters, this one is intentionally NOT built
 * on a subgraph. I looked for a live, officially-maintained Ubeswap
 * subgraph on The Graph's decentralized network and could not confirm
 * one exists — the only concrete reference found was a 2022 community
 * workshop repo showing how to BUILD a subgraph from scratch, not a
 * maintained public deployment. Rather than hardcode a guessed subgraph
 * ID (the exact mistake being fixed across the other adapters in this
 * codebase), this adapter queries the Ubeswap router directly on-chain,
 * using the same `getAmountsOut` pattern already proven working in
 * dexIntegration.ts and productionDexRouting.ts.
 *
 * This trades subgraph conveniences (historical volume, TVL aggregation)
 * for reliability: on-chain quotes can't go stale or hit a dead endpoint.
 * If Ubeswap does have a maintained subgraph, point UBESWAP_SUBGRAPH_URL
 * (env) at it and extend fetchLiquidity to use it for TVL/volume — this
 * adapter's "liquidity" method currently derives a liquidity proxy from
 * quote depth rather than true pool reserves (see method docstring).
 * ─────────────────────────────────────────────────────────────────────────
 */

import { ethers } from "ethers";
import { BaseAdapter } from "./base-adapter";
import type { AdapterResponse, NormalizedData, BaseAdapterConfig } from '../types';
import { TokenRegistry } from "../../../../../shared/tokenRegistry";

const UBESWAP_ROUTER = "0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121";
const CELO_NATIVE_ADDRESS = "0x471EcE3750Da237f93B8E339c536989b8978a438";

const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])",
];

const ERC20_ABI = ["function decimals() view returns (uint8)"];

export class UbeswapAdapter extends BaseAdapter {
  private provider: ethers.JsonRpcProvider;
  private decimalsCache: Map<string, number> = new Map();

  constructor(config: BaseAdapterConfig) {
    super("ubeswap", config);
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
          error: "APY data not available from Ubeswap router directly (LP farming rewards require the farm contracts, not covered by this adapter)",
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
   * Price via on-chain quote: how much `quoteSymbol` (default cUSD) a
   * unit of `symbol` trades for right now on Ubeswap. This is a real
   * quote, not a subgraph-derived historical price — it reflects current
   * pool state including whatever slippage a 1-unit trade would incur.
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

    const cacheKey = `ubeswap:price:${symbol}:${quoteSymbol}`;
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

      const router = new ethers.Contract(UBESWAP_ROUTER, ROUTER_ABI, this.provider);
      const baseAddress = baseEntry.address.mainnet || baseEntry.address.testnet;
      const quoteAddress = quoteEntry.address.mainnet || quoteEntry.address.testnet;
      const oneUnit = ethers.parseUnits("1", baseEntry.decimals);

      let path = [baseAddress, quoteAddress];
      let amounts: bigint[];
      try {
        amounts = await router.getAmountsOut(oneUnit, path);
      } catch {
        path = [baseAddress, CELO_NATIVE_ADDRESS, quoteAddress];
        amounts = await router.getAmountsOut(oneUnit, path);
      }

      const amountOut = amounts[amounts.length - 1];
      const price = Number(ethers.formatUnits(amountOut, quoteEntry.decimals));

      const result: NormalizedData = {
        id: `ubeswap:${symbol}:${Date.now()}`,
        source: "ubeswap",
        timestamp: new Date().toISOString(),
        dataType: "price",
        asset: {
          symbol,
          chain: "celo",
          address: baseAddress,
        },
        value: price,
        metadata: {
          confidence: 0.85, // on-chain 1-unit quote, not a TVL-weighted mid price
          quotedIn: quoteSymbol,
          routedVia: path.length > 2 ? "CELO" : "direct",
        },
      };

      this.setCache(cacheKey, [result], 60);

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
   * Liquidity proxy via quote-depth comparison: compares the effective
   * price of a small trade vs. a larger trade to estimate price impact,
   * then infers a rough liquidity figure from that impact. This is NOT
   * true pool reserve data (Ubeswap's factory/pair contracts would need
   * to be queried directly for exact reserves, which this adapter
   * doesn't do yet) — treat `value` as an approximation, and prefer a
   * real subgraph or direct pair-reserve query if precision matters for
   * a specific integration (e.g. slippage-sensitive routing).
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

      const router = new ethers.Contract(UBESWAP_ROUTER, ROUTER_ABI, this.provider);
      const baseAddress = baseEntry.address.mainnet || baseEntry.address.testnet;
      const quoteAddress = quoteEntry.address.mainnet || quoteEntry.address.testnet;
      let path = [baseAddress, quoteAddress];

      const smallIn = ethers.parseUnits("1", baseEntry.decimals);
      const largeIn = ethers.parseUnits("1000", baseEntry.decimals);

      let [smallOut, largeOut] = await Promise.all([
        router.getAmountsOut(smallIn, path).catch(() => null),
        router.getAmountsOut(largeIn, path).catch(() => null),
      ]);

      if (!smallOut || !largeOut) {
        path = [baseAddress, CELO_NATIVE_ADDRESS, quoteAddress];
        [smallOut, largeOut] = await Promise.all([
          router.getAmountsOut(smallIn, path).catch(() => null),
          router.getAmountsOut(largeIn, path).catch(() => null),
        ]);
      }

      if (!smallOut || !largeOut) {
        return {
          success: false,
          error: `No Ubeswap pool found for ${symbol}/${quoteSymbol}`,
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
        };
      }

      const smallPrice = Number(ethers.formatUnits(smallOut[smallOut.length - 1], quoteEntry.decimals));
      const largePrice = Number(ethers.formatUnits(largeOut[largeOut.length - 1], quoteEntry.decimals)) / 1000;
      const priceImpact = smallPrice > 0 ? Math.abs(1 - largePrice / smallPrice) : null;

      const result: NormalizedData = {
        id: `ubeswap:liquidity:${symbol}-${quoteSymbol}:${Date.now()}`,
        source: "ubeswap",
        timestamp: new Date().toISOString(),
        dataType: "liquidity",
        asset: {
          symbol: `${symbol}-${quoteSymbol}`,
          chain: "celo",
          address: baseAddress,
        },
        value: priceImpact !== null ? 1 / Math.max(priceImpact, 0.0001) : 0, // rough relative depth proxy
        metadata: {
          confidence: 0.4, // approximation only — see method docstring
          isProxy: true,
          priceImpactFor1000Units: priceImpact,
          note: "Derived from quote-depth comparison, not actual pool reserves",
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