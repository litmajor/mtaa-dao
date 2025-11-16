/**
 * Beefyfi Adapter
 * Yield farming protocol data source for APY and strategy returns
 * Priority: 5 (Yield optimization, strategy-specific data)
 */

import { BaseAdapter } from "./base-adapter";
import { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";

export class BeefyfiAdapter extends BaseAdapter {
  private baseUrl = "https://api.beefy.finance";

  constructor(config: BaseAdapterConfig) {
    super("beefyfi", config);
  }

  async fetch(
    dataType: string,
    params: any
  ): Promise<AdapterResponse<NormalizedData | NormalizedData[]>> {
    const startTime = Date.now();

    try {
      if (dataType === "apy") {
        return await this.fetchAPY(params);
      } else if (dataType === "tvl") {
        return await this.fetchTVL(params);
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

  private async fetchAPY(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { chains = ["celo"], vaults = [] } = params;

    const cacheKey = `beefyfi:apy:${chains.join(",")}:${vaults.join(",")}`;
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
        // Beefy provides APY data via multiple endpoints
        const apyUrl = `${this.baseUrl}/apy/breakdown?chain=${chain}`;
        const apyData = await this.makeRequest<any>(apyUrl);

        if (apyData && typeof apyData === "object") {
          for (const [vaultId, vaultData] of Object.entries(apyData)) {
            // Filter by vaults if specified
            if (vaults.length > 0 && !vaults.includes(vaultId)) {
              continue;
            }

            const vault = vaultData as any;
            if (vault.totalApy !== undefined) {
              results.push({
                id: `beefyfi:${vaultId}:${Date.now()}`,
                source: "beefyfi",
                timestamp: new Date().toISOString(),
                dataType: "apy",
                asset: {
                  symbol: vault.name || vaultId,
                  chain,
                  address: vaultId,
                },
                value: vault.totalApy * 100, // Convert to percentage
                metadata: {
                  confidence: 0.90,
                  vaultId,
                  strategyApy: (vault.strategyApy || 0) * 100,
                  rewardApy: (vault.rewardApy || 0) * 100,
                  tradingApy: (vault.tradingApy || 0) * 100,
                  assets: vault.assets,
                  platform: vault.platform,
                  compounding: vault.compounding,
                },
              });
            }
          }
        }
      }

      this.setCache(cacheKey, results, 3600); // Cache for 1 hour

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

  private async fetchTVL(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { chains = ["celo"] } = params;

    const cacheKey = `beefyfi:tvl:${chains.join(",")}`;
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
        // Beefy chainTvl endpoint
        const tvlUrl = `${this.baseUrl}/tvl?chain=${chain}`;
        const tvlData = await this.makeRequest<any>(tvlUrl);

        if (typeof tvlData === "number") {
          results.push({
            id: `beefyfi:${chain}:tvl:${Date.now()}`,
            source: "beefyfi",
            timestamp: new Date().toISOString(),
            dataType: "tvl",
            asset: {
              symbol: "Beefyfi",
              chain,
              address: "beefyfi-protocol",
            },
            value: tvlData,
            metadata: {
              confidence: 0.92,
              metricType: "total-tvl",
              chain,
            },
          });
        }
      }

      this.setCache(cacheKey, results, 300); // Cache for 5 minutes

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
