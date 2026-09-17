/**
 * Uniswap V3 Adapter
 * Fetch prices, liquidity, and pool data from Uniswap V3 subgraphs
 * Priority: 2
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIXES APPLIED (see audit notes):
 * 1. The original `subgraphUrl` pointed at
 *    `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3` — The
 *    Graph's "hosted service." That service is fully shut down; every
 *    query against it now returns
 *    `{"message": "This endpoint has been removed..."}` (confirmed via
 *    Uniswap/v3-info#323 and The Graph's own hosted-service deprecation
 *    notice). This adapter's fetch/fetchLiquidity have been returning
 *    zero real data — every call fell through to the catch block and
 *    reported a generic error, or worse, silently returned an empty
 *    `results: []` with `success: results.length > 0` evaluating to
 *    `false` without ever surfacing *why*.
 * 2. Replaced with the real, current decentralized-network endpoints
 *    confirmed directly from docs.uniswap.org/api/subgraph/overview
 *    (accessed 2026): `https://gateway.thegraph.com/api/<API_KEY>/
 *    subgraphs/id/<SUBGRAPH_ID>`, with a distinct verified subgraph ID
 *    per chain (including Celo — MtaaDAO's actual chain). These require
 *    a billing-linked API key from The Graph Studio; the adapter now
 *    reads `THEGRAPH_API_KEY` from env and fails loudly with a clear
 *    message if it's missing, rather than silently hitting a dead URL.
 * 3. `chains` was accepted as a parameter but every chain in the array
 *    hit the exact same single subgraph URL (implicitly Ethereum
 *    mainnet), with results simply re-labeled with whatever chain string
 *    was passed in. Requesting `chains: ["celo"]` returned Ethereum
 *    mainnet data mislabeled as Celo. Fixed: each chain now resolves to
 *    its own verified subgraph ID, and unsupported chains are skipped
 *    with a warning instead of silently querying the wrong network.
 * 4. Price calculation hardcoded `parseFloat(token.derivedETH) * 2300` —
 *    a stale, fixed ETH/USD price baked into the code (same class of bug
 *    as the hardcoded gas-cost constants found elsewhere in this
 *    codebase). Replaced with the subgraph's own `bundle(id: "1")
 *    { ethPriceUSD }` entity, which is the same mechanism Uniswap's own
 *    analytics site uses to convert derivedETH into a USD price — no
 *    external oracle dependency needed, and no hardcoded number.
 * 5. `fetchLiquidity()` accepted a `pools` parameter but never used it —
 *    it always queried the top 10 pools by TVL regardless of what was
 *    requested. Fixed to filter by the given pool addresses when
 *    provided, falling back to top-by-TVL only when `pools` is omitted.
 * 6. Neither fetch function checked for GraphQL-level errors
 *    (`response.errors`), which The Graph returns with HTTP 200 for bad
 *    queries — meaning a malformed query would look like "no data found"
 *    instead of a query error. Both now check for this explicitly.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { BaseAdapter } from "./base-adapter";
import { type AdapterResponse, type NormalizedData, type BaseAdapterConfig } from "../types";

// Verified directly against docs.uniswap.org/api/subgraph/overview.
// Each chain has its own dedicated V3 subgraph — there is no single
// "the Uniswap V3 subgraph" that covers every chain.
const V3_SUBGRAPH_IDS: Record<string, string> = {
  ethereum: "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV",
  celo: "ESdrTJ3twMwWVoQ1hUE2u7PugEHX3QkenudD6aXCkDQ4",
  arbitrum: "FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM",
  optimism: "Cghf4LfVqPiFw6fp6Y5X5Ubc8UpmUhSfJL82zwiBFLaj",
  polygon: "3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm",
  bsc: "F85MNzUGYqgSHSHRGgeVMNsdnW1KtZSVgFULumXRZTw2",
  avalanche: "GVH9h9KZ9CqheUEL93qMbq7QwgoBu32QXQDPR6bev4Eo",
  base: "43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPpNSmbQZArzMG",
};

export class UniswapAdapter extends BaseAdapter {
  constructor(config: BaseAdapterConfig) {
    super("uniswap", config);
  }

  /**
   * Build the gateway endpoint for a given chain's V3 subgraph.
   * Throws (rather than silently falling back to a wrong/dead URL) if
   * the chain isn't a known deployment or the API key is missing.
   */
  private getSubgraphEndpoint(chain: string): string {
    const subgraphId = V3_SUBGRAPH_IDS[chain];
    if (!subgraphId) {
      throw new Error(
        `No verified Uniswap V3 subgraph ID configured for chain "${chain}". ` +
        `Known chains: ${Object.keys(V3_SUBGRAPH_IDS).join(", ")}. Confirm the ` +
        `deployment exists at docs.uniswap.org/api/subgraph/overview before adding it.`
      );
    }

    const apiKey = process.env.THEGRAPH_API_KEY;
    if (!apiKey) {
      throw new Error(
        "THEGRAPH_API_KEY is not set. The Graph's hosted service (the old, keyless " +
        "api.thegraph.com endpoints) has been shut down — querying any subgraph now " +
        "requires a billing-linked API key from thegraph.com/studio/apikeys."
      );
    }

    return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;
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
        return await this.fetchAPY(params);
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

  private async fetchPriceForChain(
    chain: string,
    symbol: string,
    tokenAddress?: string
  ): Promise<{ chain: string; result?: NormalizedData; error?: string }> {
    let endpoint: string;
    try {
      endpoint = this.getSubgraphEndpoint(chain);
    } catch (err) {
      return {
        chain,
        error: `${chain}: ${(err as Error).message}`,
      };
    }

    try {
      const tokenLookup = tokenAddress
        ? `id: "${tokenAddress.toLowerCase()}"`
        : `symbol: "${symbol}"`;

      // Query the token AND the price-denominator bundle in one round trip so the
      // price conversion below uses a live figure, not a hardcoded one.
      const query = `
        query {
          tokens(first: 1, where: { ${tokenLookup} }) {
            id
            symbol
            name
            derivedETH
          }
          bundle(id: "1") {
            ethPriceUSD
          }
        }
      `;

      const response = await this.makeRequest<any>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (response.errors) {
        return {
          chain,
          error: `${chain}: GraphQL error — ${JSON.stringify(response.errors)}`,
        };
      }

      const token = response.data?.tokens?.[0];
      const nativePriceUsd = parseFloat(response.data?.bundle?.ethPriceUSD ?? "");

      if (!token) {
        return { chain }; // no such token on this chain's pools — not an error
      }

      if (!isFinite(nativePriceUsd) || nativePriceUsd <= 0) {
        return {
          chain,
          error: `${chain}: bundle.ethPriceUSD unavailable, skipping price for ${symbol}`,
        };
      }

      return {
        chain,
        result: {
          id: `uniswap:${symbol}:${chain}:${Date.now()}`,
          source: "uniswap",
          timestamp: new Date().toISOString(),
          dataType: "price",
          asset: {
            symbol,
            chain,
            address: token.id,
          },
          value: parseFloat(token.derivedETH) * nativePriceUsd,
          metadata: {
            confidence: 0.95,
            nativeAssetPriceUsd: nativePriceUsd,
            priceDenominatorSymbol: chain === "celo" ? "CELO" : "ETH",
            ...(tokenAddress ? { requestedTokenAddress: tokenAddress.toLowerCase() } : {}),
          },
        },
      };
    } catch (error) {
      return {
        chain,
        error: `${chain}: ${(error as Error).message}`,
      };
    }
  }

  private async fetchPrices(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { symbol, tokenAddress, chains = ["celo"] } = params;
    const chainList = Array.isArray(chains) ? chains : [chains];

    const cacheKey = `uniswap:prices:${symbol}:${tokenAddress ?? "symbol"}:${chainList.join(",")}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    const settledResults = await Promise.allSettled(
      chainList.map((chain: string) => this.fetchPriceForChain(chain, symbol, tokenAddress))
    );

    const results: NormalizedData[] = [];
    const errors: string[] = [];

    settledResults.forEach((settled) => {
      if (settled.status === "fulfilled") {
        const { result, error } = settled.value;
        if (result) {
          results.push(result);
        } else if (error) {
          errors.push(error);
        }
      } else {
        errors.push(`${settled.reason}`);
      }
    });

    if (results.length > 0) {
      this.setCache(cacheKey, results, 60);
    }

    return {
      success: results.length > 0,
      data: results,
      error: results.length === 0 && errors.length > 0 ? errors.join("; ") : undefined,
      timestamp: new Date(),
      latencyMs: Date.now() - startTime,
    };
  }

  private async fetchLiquidity(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { pools, chain = "celo" } = params;

    const cacheKey = `uniswap:liquidity:${chain}:${pools?.join(",") || "all"}`;
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
      const endpoint = this.getSubgraphEndpoint(chain);

      // FIX: honor the `pools` filter when provided, instead of always
      // returning the top 10 by TVL regardless of what was asked for.
      const poolFilter =
        Array.isArray(pools) && pools.length > 0
          ? `where: { id_in: [${pools.map((p: string) => `"${p.toLowerCase()}"`).join(", ")}] }, `
          : "";

      const query = `
        query {
          pools(first: 10, ${poolFilter}orderBy: totalValueLockedUSD, orderDirection: desc) {
            id
            feeTier
            token0 { symbol derivedETH }
            token1 { symbol derivedETH }
            totalValueLockedUSD
            volumeUSD
          }
        }
      `;

      const response = await this.makeRequest<any>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (response.errors) {
        return {
          success: false,
          error: `GraphQL error: ${JSON.stringify(response.errors)}`,
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
        };
      }

      const results: NormalizedData[] = (response.data?.pools || []).map((pool: any) => ({
        id: `uniswap:liquidity:${pool.id}:${Date.now()}`,
        source: "uniswap",
        timestamp: new Date().toISOString(),
        dataType: "liquidity",
        asset: {
          symbol: `${pool.token0.symbol}-${pool.token1.symbol}`,
          chain,
          address: pool.id,
        },
        value: parseFloat(pool.totalValueLockedUSD),
        metadata: {
          confidence: 0.95,
          liquidityUSD: parseFloat(pool.totalValueLockedUSD),
          tvl: parseFloat(pool.totalValueLockedUSD),
          feeTier: pool.feeTier,
          volumeUSD: parseFloat(pool.volumeUSD),
        },
      }));

      if (results.length > 0) {
        this.setCache(cacheKey, results, 300);
      }

      return {
        success: results.length > 0,
        data: results,
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

  private async fetchAPY(params: any): Promise<AdapterResponse<NormalizedData>> {
    const startTime = Date.now();

    // Uniswap doesn't directly provide APY data.
    // This would require off-chain calculation (e.g. fee APR from
    // volumeUSD/feeTier/totalValueLockedUSD over a time window) or
    // integration with Uniswap's own analytics API.
    return {
      success: false,
      error: "APY data not directly available from Uniswap",
      timestamp: new Date(),
      latencyMs: Date.now() - startTime,
    };
  }
}