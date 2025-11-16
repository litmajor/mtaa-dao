/**
 * Uniswap V3 Adapter
 * Fetch prices, liquidity, and pool data from Uniswap V3 subgraph
 * Priority: 2
 */

import { BaseAdapter } from "./base-adapter";
import { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";

export class UniswapAdapter extends BaseAdapter {
  private subgraphUrl = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";

  constructor(config: BaseAdapterConfig) {
    super("uniswap", config);
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

  private async fetchPrices(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { symbol, chains = ["celo"] } = params;

    const cacheKey = `uniswap:prices:${symbol}:${chains.join(",")}`;
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
      const results: NormalizedData[] = [];

      for (const chain of chains) {
        const query = `
          query {
            tokens(first: 1, where: { symbol: "${symbol}" }) {
              id
              symbol
              name
              derivedETH
            }
          }
        `;

        const response = await this.makeRequest<any>(this.subgraphUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (response.data?.tokens?.[0]) {
          const token = response.data.tokens[0];

          results.push({
            id: `uniswap:${symbol}:${chain}:${Date.now()}`,
            source: "uniswap",
            timestamp: new Date().toISOString(),
            dataType: "price",
            asset: {
              symbol,
              chain,
              address: token.id,
            },
            value: parseFloat(token.derivedETH) * 2300, // Approximate ETH price
            metadata: {
              confidence: 0.95,
            },
          });
        }
      }

      this.setCache(cacheKey, results, 60);

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

  private async fetchLiquidity(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { pools, chain = "celo" } = params;

    const cacheKey = `uniswap:liquidity:${pools?.join(",") || "all"}`;
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
      const query = `
        query {
          pools(first: 10, orderBy: totalValueLockedUSD, orderDirection: desc) {
            id
            feeTier
            token0 { symbol derivedETH }
            token1 { symbol derivedETH }
            totalValueLockedUSD
            volumeUSD
          }
        }
      `;

      const response = await this.makeRequest<any>(this.subgraphUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

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
        },
      }));

      this.setCache(cacheKey, results, 300);

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

    // Uniswap doesn't directly provide APY data
    // This would require off-chain calculation or integration with Uniswap analytics

    return {
      success: false,
      error: "APY data not directly available from Uniswap",
      timestamp: new Date(),
      latencyMs: Date.now() - startTime,
    };
  }
}
