/**
 * CoinGecko Adapter
 * Fallback market data source for prices and historical data
 * Priority: 3 (Good coverage, external source)
 */

import { BaseAdapter } from "./base-adapter";
import { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";

export class CoinGeckoAdapter extends BaseAdapter {
  private baseUrl = "https://api.coingecko.com/api/v3";
  private apiKey?: string;

  constructor(config: BaseAdapterConfig) {
    super("coingecko", config);
    this.apiKey = config.apiKey || process.env.COINGECKO_API_KEY;
  }

  async fetch(
    dataType: string,
    params: any
  ): Promise<AdapterResponse<NormalizedData | NormalizedData[]>> {
    const startTime = Date.now();

    try {
      if (dataType === "price") {
        return await this.fetchPrices(params);
      } else if (dataType === "risk") {
        return await this.fetchRiskData(params);
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
    const { symbols } = params;

    const cacheKey = `coingecko:prices:${symbols.join(",")}`;
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
      const ids = this.getCoinGeckoIds(symbols);
      const url = `${this.baseUrl}/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;

      const response = await this.makeRequest<any>(url);

      const results: NormalizedData[] = [];

      for (const symbol of symbols) {
        const coinId = this.getCoinGeckoId(symbol);
        const priceData = response[coinId];

        if (priceData) {
          results.push({
            id: `coingecko:${symbol}:${Date.now()}`,
            source: "coingecko",
            timestamp: new Date().toISOString(),
            dataType: "price",
            asset: {
              symbol,
              chain: "multi",
              address: coinId,
            },
            value: priceData.usd,
            metadata: {
              confidence: 0.85, // External source, good but not on-chain
              source24hVolume: priceData.usd_24h_vol,
              source24hChange: priceData.usd_24h_change,
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

  private async fetchRiskData(params: any): Promise<AdapterResponse<NormalizedData>> {
    const startTime = Date.now();
    const { protocol } = params;

    // CoinGecko provides security scores for some protocols
    try {
      const url = `${this.baseUrl}/search?query=${protocol}`;
      const response = await this.makeRequest<any>(url);

      // CoinGecko doesn't have direct risk data, would need integration with other sources
      return {
        success: false,
        error: "Risk data not available from CoinGecko",
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

  private getCoinGeckoIds(symbols: string[]): string[] {
    return symbols.map((s) => this.getCoinGeckoId(s));
  }

  private getCoinGeckoId(symbol: string): string {
    const mapping: Record<string, string> = {
      BTC: "bitcoin",
      ETH: "ethereum",
      USDC: "usd-coin",
      cUSD: "celo-dollar",
      CELO: "celo",
      DAI: "dai",
      USDT: "tether",
      cEUR: "celo-euro",
    };

    return mapping[symbol] || symbol.toLowerCase();
  }
}
