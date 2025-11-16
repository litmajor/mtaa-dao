/**
 * Moola Market Adapter
 * Lending protocol data source for interest rates and utilization
 * Priority: 4 (Protocol-specific rates, utilization data)
 */

import { BaseAdapter } from "./base-adapter";
import { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";

export class MoolaAdapter extends BaseAdapter {
  private baseUrl = "https://api.moola.market";
  private subgraphUrl =
    "https://api.thegraph.com/subgraphs/name/moolamarket/moola-market";

  constructor(config: BaseAdapterConfig) {
    super("moola", config);
  }

  async fetch(
    dataType: string,
    params: any
  ): Promise<AdapterResponse<NormalizedData | NormalizedData[]>> {
    const startTime = Date.now();

    try {
      if (dataType === "apy") {
        return await this.fetchAPY(params);
      } else if (dataType === "price") {
        return await this.fetchPrices(params);
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
    const { assets } = params;

    const cacheKey = `moola:apy:${assets.join(",")}`;
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
      // GraphQL query to fetch reserve data from Moola Market
      const query = `
        query {
          reserves(first: 100) {
            id
            name
            symbol
            decimals
            price
            borrowingEnabled
            utilizationRate
            baseLTVasCollateral
            reserveLiquidationThreshold
            currentLiquidityRate
            currentStableBorrowRate
            currentVariableBorrowRate
            totalBorrows
            totalDeposits
            totalSupply
          }
        }
      `;

      const response = await this.makeRequest<any>(`${this.subgraphUrl}`, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
      });

      const results: NormalizedData[] = [];

      if (response.data && response.data.reserves) {
        for (const reserve of response.data.reserves) {
          if (assets.includes(reserve.symbol) || assets.length === 0) {
            // Supply APY (lender yield)
            results.push({
              id: `moola:${reserve.symbol}:supply:${Date.now()}`,
              source: "moola",
              timestamp: new Date().toISOString(),
              dataType: "apy",
              asset: {
                symbol: reserve.symbol,
                chain: "celo",
                address: reserve.id,
              },
              value: this.rayToPercent(reserve.currentLiquidityRate),
              metadata: {
                confidence: 0.90,
                type: "supply",
                utilizationRate: this.rayToPercent(reserve.utilizationRate),
                totalDeposits: reserve.totalDeposits,
                totalBorrows: reserve.totalBorrows,
                price: reserve.price,
              },
            });

            // Borrow APY (variable rate)
            results.push({
              id: `moola:${reserve.symbol}:borrow:${Date.now()}`,
              source: "moola",
              timestamp: new Date().toISOString(),
              dataType: "apy",
              asset: {
                symbol: reserve.symbol,
                chain: "celo",
                address: reserve.id,
              },
              value: this.rayToPercent(reserve.currentVariableBorrowRate),
              metadata: {
                confidence: 0.90,
                type: "borrow",
                utilizationRate: this.rayToPercent(reserve.utilizationRate),
                stableRate: this.rayToPercent(reserve.currentStableBorrowRate),
                borrowingEnabled: reserve.borrowingEnabled,
              },
            });
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

  private async fetchPrices(params: any): Promise<AdapterResponse<NormalizedData[]>> {
    const startTime = Date.now();
    const { symbols } = params;

    const cacheKey = `moola:prices:${symbols.join(",")}`;
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
      // Moola uses oracle prices for reserves
      const query = `
        query {
          reserves(first: 100) {
            id
            symbol
            price
            priceInEth
          }
        }
      `;

      const response = await this.makeRequest<any>(`${this.subgraphUrl}`, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
      });

      const results: NormalizedData[] = [];

      if (response.data && response.data.reserves) {
        for (const reserve of response.data.reserves) {
          if (symbols.includes(reserve.symbol)) {
            results.push({
              id: `moola:${reserve.symbol}:${Date.now()}`,
              source: "moola",
              timestamp: new Date().toISOString(),
              dataType: "price",
              asset: {
                symbol: reserve.symbol,
                chain: "celo",
                address: reserve.id,
              },
              value: parseFloat(reserve.price),
              metadata: {
                confidence: 0.88,
                priceSource: "moola-oracle",
                priceInEth: reserve.priceInEth,
              },
            });
          }
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

  /**
   * Convert ray format (1e27) to percentage
   * Ray is 10^27, so divide by 10^25 to get basis points (0.01%)
   */
  private rayToPercent(ray: string): number {
    try {
      const rayValue = BigInt(ray);
      const percent = Number(rayValue) / 1e25; // 10^25 = 0.01%
      return percent;
    } catch {
      return 0;
    }
  }
}
