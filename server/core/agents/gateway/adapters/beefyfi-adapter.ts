/**
 * Beefyfi Adapter
 * Yield farming protocol data source for APY and strategy returns
 * Priority: 5 (Yield optimization, strategy-specific data)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIXES APPLIED (see audit notes, verified against docs.beefy.finance and
 * github.com/beefyfinance/beefy-api):
 * 1. `fetchTVL()`'s check `typeof tvlData === "number"` could NEVER be
 *    true. Beefy's real `/tvl` endpoint returns a flat object keyed by
 *    vault ID for ALL chains at once, e.g.
 *    `{"optimism-bifi-maxi": 37679.65, "celo-bifi-maxi": 128.4, ...}` —
 *    never a bare number, and never scoped to one chain. This function
 *    has been returning zero results on every call since it was written.
 * 2. Neither `fetchAPY()` nor `fetchTVL()`'s `?chain=${chain}` query
 *    parameter is part of Beefy's documented API — `/tvl` and
 *    `/apy/breakdown` are both global, all-chains endpoints with no
 *    server-side chain filter. The original code looped over `chains`
 *    and hit the identical global endpoint on every iteration (wasteful,
 *    and silently relying on a filter the server doesn't apply), then
 *    labeled every returned vault with whichever `chain` the loop
 *    happened to be on — so requesting `chains: ["celo"]` would have
 *    returned (and mislabeled as Celo) vaults from every chain Beefy
 *    supports, not just Celo.
 * 3. Fixed by fetching the `/vaults` endpoint once (which Beefy's docs
 *    confirm includes an explicit `chain` field per vault) and using it
 *    as the source of truth for which vault belongs to which chain,
 *    instead of trusting a URL parameter the API ignores or the loop
 *    variable. `/tvl` and `/apy/breakdown` are now each fetched once
 *    (not once per requested chain) and joined against this vault→chain
 *    map, then filtered to the requested chains.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { BaseAdapter } from "./base-adapter";
import { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";

interface BeefyVaultMeta {
  id: string;
  name?: string;
  chain: string;
  platform?: string;
  assets?: string[];
  status?: string;
}

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

  /**
   * Fetch (and cache) the vault -> chain metadata map. This is the only
   * reliable source of truth for which chain a given vault belongs to —
   * neither /tvl nor /apy/breakdown expose a chain filter or a chain
   * field per entry.
   */
  private async getVaultChainMap(): Promise<Map<string, BeefyVaultMeta>> {
    const cacheKey = "beefyfi:vaults:meta";
    const cached = this.getCache(cacheKey);
    if (cached) {
      return new Map(Object.entries(cached));
    }

    const vaultsUrl = `${this.baseUrl}/vaults`;
    const vaultsData = await this.makeRequest<BeefyVaultMeta[]>(vaultsUrl);

    const map = new Map<string, BeefyVaultMeta>();
    if (Array.isArray(vaultsData)) {
      for (const vault of vaultsData) {
        if (vault?.id) {
          map.set(vault.id, vault);
        }
      }
    }

    // Cache the plain object form (Map isn't directly cache-serializable
    // in most simple cache implementations); reconstructed on read.
    this.setCache(cacheKey, Object.fromEntries(map), 3600);

    return map;
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
      const vaultChainMap = await this.getVaultChainMap();

      // Global endpoint — fetched ONCE, not per requested chain.
      const apyUrl = `${this.baseUrl}/apy/breakdown`;
      const apyData = await this.makeRequest<any>(apyUrl);

      const results: NormalizedData[] = [];
      const requestedChains = new Set(chains);

      if (apyData && typeof apyData === "object") {
        for (const [vaultId, vaultData] of Object.entries(apyData)) {
          if (vaults.length > 0 && !vaults.includes(vaultId)) {
            continue;
          }

          // FIX: determine the vault's real chain from /vaults metadata,
          // not from a URL filter the API doesn't apply or from the loop
          // variable of a per-chain iteration that no longer exists.
          const meta = vaultChainMap.get(vaultId);
          const vaultChain = meta?.chain;

          if (!vaultChain || !requestedChains.has(vaultChain)) {
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
                symbol: meta?.name || vaultId,
                chain: vaultChain,
                address: vaultId,
              },
              value: vault.totalApy * 100, // fraction -> percent
              metadata: {
                confidence: 0.90,
                vaultId,
                strategyApy: (vault.strategyApy || 0) * 100,
                rewardApy: (vault.rewardApy || 0) * 100,
                tradingApy: (vault.tradingApy || vault.tradingApr || 0) * 100,
                assets: meta?.assets,
                platform: meta?.platform,
              },
            });
          }
        }
      }

      if (results.length > 0) {
        this.setCache(cacheKey, results, 3600); // Cache for 1 hour
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
      const vaultChainMap = await this.getVaultChainMap();

      // Global endpoint, keyed by vault ID — NOT a per-chain number.
      // FIX: previously checked `typeof tvlData === "number"`, which
      // this real response shape can never satisfy.
      const tvlUrl = `${this.baseUrl}/tvl`;
      const tvlData = await this.makeRequest<Record<string, number>>(tvlUrl);

      const results: NormalizedData[] = [];

      if (tvlData && typeof tvlData === "object") {
        // Aggregate per-vault TVL up to a per-requested-chain total,
        // using /vaults metadata to know which chain each vault ID
        // belongs to (the API itself doesn't tell you this in /tvl).
        const totalsByChain = new Map<string, number>();

        for (const [vaultId, tvl] of Object.entries(tvlData)) {
          const meta = vaultChainMap.get(vaultId);
          const vaultChain = meta?.chain;
          if (!vaultChain || !chains.includes(vaultChain)) continue;
          if (typeof tvl !== "number" || !isFinite(tvl)) continue;

          totalsByChain.set(vaultChain, (totalsByChain.get(vaultChain) || 0) + tvl);
        }

        for (const chain of chains) {
          const total = totalsByChain.get(chain);
          if (total === undefined) continue;

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
            value: total,
            metadata: {
              confidence: 0.92,
              metricType: "total-tvl",
              chain,
              vaultCount: Array.from(vaultChainMap.values()).filter(v => v.chain === chain).length,
            },
          });
        }
      }

      if (results.length > 0) {
        this.setCache(cacheKey, results, 300); // Cache for 5 minutes
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
}