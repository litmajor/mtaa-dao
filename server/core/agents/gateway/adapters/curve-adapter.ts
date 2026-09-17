/**
 * Curve Adapter
 * Stableswap/crypto pool data source (liquidity, volume) for Curve pools
 * Priority: 3 (Stablecoin-optimized swaps)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * VERIFICATION NOTES:
 * - Curve IS deployed on Celo (confirmed: celo.curve.finance,
 *   curve.finance/dex/celo/pools/, and the official Nov 2022 Celo
 *   Foundation / Curve launch announcement). TVL on Celo is small
 *   relative to Ethereum (~$277K vs ~$1.14B per DefiLlama at time of
 *   writing) — expect meaningfully higher price impact on Celo Curve
 *   pools than the "stablecoins trade near parity" assumption that's
 *   safe to make on Ethereum mainnet. Do not assume Celo Curve pools are
 *   deep enough to ignore priceImpact the way productionDexRouting.ts's
 *   old queryCurve() did.
 * - Real REST API confirmed via docs.curve.finance / curvefi/curve-api on
 *   GitHub: `https://api.curve.finance/api/getPools/{blockchainId}/{registryId}`.
 *   NOTE: this is `api.curve.finance`, NOT `api.curve.fi` — the older
 *   `dexIntegration.ts`/`productionDexRouting.ts` files in this codebase
 *   reference `api.curve.fi/api/getPools`, which is the wrong domain.
 *   Worth fixing there too.
 * - Registries queried below (main, factory, factory-crypto, crypto) are
 *   the common ones seen across chains in Curve's own API docs/examples.
 *   Not every chain has every registry populated — this adapter treats
 *   an empty/404 registry as "no pools of that type," not an error.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { BaseAdapter } from "./base-adapter";
import { type AdapterResponse, type NormalizedData, type BaseAdapterConfig } from "../types";

const CURVE_API_BASE = "https://api.curve.finance/api/getPools";

// Registry types to check per chain. Not all exist on every chain — each
// is fetched independently and failures/empties are skipped, not fatal.
const REGISTRIES = ["main", "factory", "factory-crypto", "crypto"];

const CHAIN_ID_MAP: Record<string, string> = {
  ethereum: "ethereum",
  celo: "celo",
  arbitrum: "arbitrum",
  polygon: "polygon",
  optimism: "optimism",
  avalanche: "avalanche",
};

interface CurvePool {
  id: string;
  address: string;
  coins: Array<{ symbol: string; address: string; decimals: string; usdPrice?: number }>;
  usdTotal: number;
  volumeUSD?: number;
  isMetaPool?: boolean;
}

export class CurveAdapter extends BaseAdapter {
  constructor(config: BaseAdapterConfig) {
    super("curve", config);
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

  /**
   * Fetch pools across all known registries for a chain, tolerating
   * individual registry failures (a chain not having a "factory-crypto"
   * registry, for example, is normal — not an error).
   */
  private async fetchAllPools(chain: string): Promise<CurvePool[]> {
    const chainId = CHAIN_ID_MAP[chain];
    if (!chainId) {
      throw new Error(`Curve chain mapping not configured for "${chain}"`);
    }

    const allPools: CurvePool[] = [];

    await Promise.all(
      REGISTRIES.map(async (registry) => {
        try {
          const url = `${CURVE_API_BASE}/${chainId}/${registry}`;
          const response = await this.makeRequest<any>(url);
          const pools: CurvePool[] = response?.data?.poolData || [];
          allPools.push(...pools);
        } catch (err) {
          // Not fatal — this registry may simply not exist on this chain.
          this.log(`[CurveAdapter] Registry "${registry}" unavailable on ${chain}, skipping`);
        }
      })
    );

    return allPools;
  }

  private async fetchLiquidity(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { pools, chain = "celo" } = params;

    const cacheKey = `curve:liquidity:${chain}:${pools?.join(",") || "all"}`;
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
      const allPools = await this.fetchAllPools(chain);

      const filtered =
        Array.isArray(pools) && pools.length > 0
          ? allPools.filter((p) => pools.includes(p.address) || pools.includes(p.id))
          : allPools;

      const results: NormalizedData[] = filtered
        .filter((p) => typeof p.usdTotal === "number" && p.usdTotal > 0)
        .map((pool) => ({
          id: `curve:liquidity:${pool.address}:${Date.now()}`,
          source: "curve",
          timestamp: new Date().toISOString(),
          dataType: "liquidity",
          asset: {
            symbol: pool.coins.map((c) => c.symbol).join("-"),
            chain,
            address: pool.address,
          },
          value: pool.usdTotal,
          metadata: {
            confidence: chain === "celo" ? 0.75 : 0.95, // lower confidence: thin Celo liquidity
            liquidityUSD: pool.usdTotal,
            tvl: pool.usdTotal,
            volumeUSD: pool.volumeUSD ?? null,
            coins: pool.coins.map((c) => ({ symbol: c.symbol, address: c.address })),
            isMetaPool: !!pool.isMetaPool,
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

  /**
   * Curve's public getPools endpoint doesn't return a base-fee APY
   * directly for most chains outside Ethereum (LP staking/gauge APY
   * requires the separate getSubgraphData endpoint, which is not
   * confirmed populated for Celo). Rather than fabricate a number, this
   * returns pool-level fee data only, clearly labeled as fee-derived,
   * not a full APY including gauge rewards.
   */
  private async fetchAPY(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { chain = "celo" } = params;

    try {
      const allPools = await this.fetchAllPools(chain);

      const results: NormalizedData[] = allPools
        .filter((p) => (p as any).gaugeCrvApy || (p as any).baseApy)
        .map((pool: any) => ({
          id: `curve:apy:${pool.address}:${Date.now()}`,
          source: "curve",
          timestamp: new Date().toISOString(),
          dataType: "apy",
          asset: {
            symbol: pool.coins.map((c: any) => c.symbol).join("-"),
            chain,
            address: pool.address,
          },
          value: pool.baseApy ?? 0,
          metadata: {
            confidence: 0.6, // best-effort — Curve's own APY breakdown API
                              // is not confirmed populated for Celo pools
            note: "Base-fee APY only; gauge/CRV reward APY not confirmed available for this chain",
          },
        }));

      return {
        success: results.length > 0,
        data: results,
        error: results.length === 0 ? "No APY data available from Curve for this chain" : undefined,
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