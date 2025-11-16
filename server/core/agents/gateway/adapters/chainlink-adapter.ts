/**
 * Chainlink Oracle Adapter
 * Fetch trusted oracle prices and risk data from Chainlink
 * Priority: 1 (Highest - most trustworthy)
 */

import { BaseAdapter } from "./base-adapter";
import { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";

export class ChainlinkAdapter extends BaseAdapter {
  private rpcUrl: string;

  constructor(config: BaseAdapterConfig) {
    super("chainlink", config);
    this.rpcUrl = config.rpcUrl || process.env.CHAINLINK_RPC_URL || "";

    if (!this.rpcUrl) {
      throw new Error("Chainlink adapter requires CHAINLINK_RPC_URL");
    }
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

    const cacheKey = `chainlink:prices:${symbols.join(",")}`;
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

      for (const symbol of symbols) {
        const price = await this.getPriceFromOracle(symbol);

        results.push({
          id: `chainlink:${symbol}:${Date.now()}`,
          source: "chainlink",
          timestamp: new Date().toISOString(),
          dataType: "price",
          asset: {
            symbol,
            chain: "celo",
            address: "0x0", // Chainlink doesn't use addresses
          },
          value: price,
          metadata: {
            confidence: 0.99, // Highest confidence
          },
        });
      }

      // Cache for 60 seconds
      this.setCache(cacheKey, results, 60);

      return {
        success: true,
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

    // Chainlink doesn't provide protocol risk data directly
    // This would be enhanced with Chainlink Risk/CVX data if available

    return {
      success: false,
      error: "Risk data not available from Chainlink",
      timestamp: new Date(),
      latencyMs: Date.now() - startTime,
    };
  }

  private async getPriceFromOracle(symbol: string): Promise<number> {
    // This is a placeholder for actual Chainlink oracle interaction
    // In production, this would:
    // 1. Create a payload for Chainlink oracle RPC call
    // 2. Call the RPC endpoint
    // 3. Parse the response and return price

    const priceFeed = this.getChainlinkFeedAddress(symbol);

    if (!priceFeed) {
      throw new Error(`No Chainlink feed found for ${symbol}`);
    }

    // Mock implementation - in production use ethers.js or web3.js
    const mockPrices: Record<string, number> = {
      BTC: 43500,
      ETH: 2300,
      cUSD: 1.0,
      USDC: 1.0,
      cEUR: 1.1,
    };

    return mockPrices[symbol] || 0;
  }

  private getChainlinkFeedAddress(symbol: string): string | null {
    // Chainlink feed addresses on Celo mainnet
    const feeds: Record<string, string> = {
      BTC: "0x0000000000000000000000000000000000000000", // Example
      ETH: "0x0000000000000000000000000000000000000001",
      cUSD: "0x0000000000000000000000000000000000000002",
    };

    return feeds[symbol] || null;
  }
}
