/**
 * Sushi Adapter
 * SushiSwap data source (price, liquidity)
 * Priority: 4 (Secondary Celo DEX data source, after Ubeswap and Mento)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * VERIFICATION NOTE — READ BEFORE ENABLING FOR CELO: -- KINDLY CONFIRM WHETHER SUSHI IS STILL DEPLOYED ON CELO BEFORE USING THIS ADAPTER FOR CELO DATA. --
 * SushiSwap is a well-known DEX with a long history on Ethereum and other
 * chains, but its Celo deployment status is unconfirmed as of this writing.
 * Sushi was a founding member of Celo's "DeFi for the People" initiative
 * alongside Curve and Ubeswap (confirmed via the Nov 2022 Celo Foundation
 * / Curve launch announcement, which lists Sushi as an existing Celo DEX
 * at that time). However, I could NOT confirm during this research pass
 * whether Sushi's Celo deployment is still active/maintained today, or
 * what its current liquidity looks like — Sushi has gone through several
 * infrastructure changes (moving off hosted subgraphs to their own API
 * at api.sushi.com) and I did not find a source confirming current Celo
 * pool activity the way I could for Curve (via curve.finance/dex/celo
 * and DefiLlama's live TVL breakdown).
 *
 * This adapter is built to the real, current Sushi API shape
 * (api.sushi.com) and will work IF Sushi still has active Celo pools —
 * but treat its `success: false` responses for Celo as potentially
 * meaning "no longer deployed here," not just "transient error," until
 * someone confirms current Celo liquidity at sushi.com/pool or
 * defillama.com/protocol/sushiswap's per-chain breakdown. Consider this
 * adapter LOWER priority than Ubeswap/Mento/Curve until that's checked.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { BaseAdapter } from "./base-adapter";
import { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";

const SUSHI_API_BASE = "https://api.sushi.com";

// Sushi's API uses numeric chain IDs. 42220 = Celo mainnet (standard,
// well-established chain ID — not chain-specific-API-dependent).
const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  celo: 42220,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
  avalanche: 43114,
};

interface SushiPool {
  address: string;
  token0: { symbol: string; address: string };
  token1: { symbol: string; address: string };
  liquidityUSD?: number;
  volumeUSD1d?: number;
  apr?: number;
}

export class SushiAdapter extends BaseAdapter {
  constructor(config: BaseAdapterConfig) {
    super("sushi", config);
  }

  async fetch(
    dataType: string,
    params: any
  ): Promise<AdapterResponse<NormalizedData | NormalizedData[]>> {
    const startTime = Date.now();

    try {
      if (dataType === "liquidity") {
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

  private async fetchPools(chain: string): Promise<SushiPool[]> {
    const chainId = CHAIN_ID_MAP[chain];
    if (!chainId) {
      throw new Error(`Sushi chain mapping not configured for "${chain}"`);
    }

    const url = `${SUSHI_API_BASE}/v7/pools/${chainId}`;
    const response = await this.makeRequest<SushiPool[]>(url);

    if (!Array.isArray(response)) {
      throw new Error(
        `Sushi API returned an unexpected shape for chain ${chain} (chainId ${chainId}). ` +
        `This may mean Sushi has no active pools on this chain — verify at ` +
        `defillama.com/protocol/sushiswap before assuming this is a transient error.`
      );
    }

    return response;
  }

  private async fetchLiquidity(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { pools, chain = "celo" } = params;

    const cacheKey = `sushi:liquidity:${chain}:${pools?.join(",") || "all"}`;
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
      const allPools = await this.fetchPools(chain);

      const filtered =
        Array.isArray(pools) && pools.length > 0
          ? allPools.filter((p) => pools.includes(p.address))
          : allPools;

      const results: NormalizedData[] = filtered
        .filter((p) => typeof p.liquidityUSD === "number" && p.liquidityUSD > 0)
        .map((pool) => ({
          id: `sushi:liquidity:${pool.address}:${Date.now()}`,
          source: "sushi",
          timestamp: new Date().toISOString(),
          dataType: "liquidity",
          asset: {
            symbol: `${pool.token0.symbol}-${pool.token1.symbol}`,
            chain,
            address: pool.address,
          },
          value: pool.liquidityUSD!,
          metadata: {
            confidence: 0.6, // see class docstring — Celo deployment status unconfirmed
            liquidityUSD: pool.liquidityUSD,
            volumeUSD1d: pool.volumeUSD1d ?? null,
            deploymentUnconfirmed: chain === "celo",
          },
        }));

      if (results.length > 0) {
        this.setCache(cacheKey, results, 300);
      }

      return {
        success: results.length > 0,
        data: results,
        error:
          results.length === 0
            ? `No active Sushi pools found for ${chain} — if this is Celo, this may mean the ` +
              `deployment is no longer active rather than a transient failure (see adapter docstring)`
            : undefined,
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

  private async fetchAPY(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { chain = "celo" } = params;

    try {
      const allPools = await this.fetchPools(chain);

      const results: NormalizedData[] = allPools
        .filter((p) => typeof p.apr === "number")
        .map((pool) => ({
          id: `sushi:apy:${pool.address}:${Date.now()}`,
          source: "sushi",
          timestamp: new Date().toISOString(),
          dataType: "apy",
          asset: {
            symbol: `${pool.token0.symbol}-${pool.token1.symbol}`,
            chain,
            address: pool.address,
          },
          value: pool.apr! * 100,
          metadata: {
            confidence: 0.6,
            deploymentUnconfirmed: chain === "celo",
          },
        }));

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
}