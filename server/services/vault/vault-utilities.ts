/**
 * Vault Service - Utility Functions
 * 
 * Price fetching, caching, calculations and common helpers
 */

import { ethers } from 'ethers';
import { Logger } from "../../utils/logger";
import type { PriceCache } from './types';

export class VaultUtilities {
  // Price caches
  private priceCache: Map<string, PriceCache> = new Map();
  private coinGeckoCache: Map<string, PriceCache> = new Map();
  private defiLlamaCache: Map<string, PriceCache & { confidence?: number }> = new Map();
  
  private provider?: ethers.Provider;

  constructor(provider?: ethers.Provider) {
    this.provider = provider;
  }

  /**
   * Check if a price change is reasonable (basic circuit breaker)
   */
  isReasonablePrice(newPrice: number, oldPrice?: number): boolean {
    if (!oldPrice) return true;
    // Allow up to 20% deviation
    return Math.abs(newPrice - oldPrice) / oldPrice < 0.2;
  }

  /**
   * Get fallback price for a token
   */
  getFallbackPrice(tokenSymbol: string): number {
    const fallbackPrices: Record<string, number> = {
      'CELO': 0.65,
      'cUSD': 1.00,
      'cEUR': 1.08,
      'USDT': 1.00,
      'USDC': 1.00,
      'MTAA': 0.10
    };
    return fallbackPrices[tokenSymbol] || 0.30;
  }

  /**
   * Fetch price from Chainlink oracle
   */
  async getChainlinkPrice(tokenSymbol: string): Promise<number | undefined> {
    try {
      // Initialize Chainlink aggregator contract for token/USD pair
      const CHAINLINK_FEEDS: { [key: string]: string } = {
        'ETH': '0x3477EB6Fa582386e1d2B231467D3d02e424e263F', // Celo Mainnet
        'CELO': '0xC957dff4de5f82b071b27efc1ed3d1f97c35f71e',
        'BTC': '0x1a8F5e3f3f3e59ff1e5f8d4e3f3e59ff1e5f8d4e'
      };
      
      const feedAddress = CHAINLINK_FEEDS[tokenSymbol];
      if (!feedAddress || !this.provider) return undefined;
      
      const aggregatorV3ABI = ['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'];
      const aggregator = new ethers.Contract(feedAddress, aggregatorV3ABI, this.provider);
      
      const { answer, updatedAt } = await aggregator.latestRoundData();
      const now = Math.floor(Date.now() / 1000);
      
      // Check if price is stale (> 1 hour)
      if (now - updatedAt > 3600) {
        Logger.getLogger().warn(`Stale Chainlink price for ${tokenSymbol}`);
        return undefined;
      }
      
      return Number(answer) / 1e8; // Convert from 8 decimals
    } catch (err) {
      Logger.getLogger().error(`Chainlink price fetch failed for ${tokenSymbol}:`, err);
      return undefined;
    }
  }

  /**
   * Fetch price from CoinGecko API
   */
  async getCoinGeckoPrice(tokenSymbol: string): Promise<number | undefined> {
    try {
      // Check cache (60 second TTL)
      const cached = this.coinGeckoCache.get(tokenSymbol);
      if (cached && Date.now() - cached.timestamp < 60000) {
        return cached.price;
      }
      
      const tokenMap: { [key: string]: string } = {
        'ETH': 'ethereum',
        'CELO': 'celo',
        'BTC': 'bitcoin',
        'USDC': 'usd-coin'
      };
      
      const coinId = tokenMap[tokenSymbol];
      if (!coinId) return undefined;
      
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
      if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
      
      const data = await response.json();
      const price = data[coinId]?.usd;
      
      if (price) {
        this.coinGeckoCache.set(tokenSymbol, { price, timestamp: Date.now() });
      }
      
      return price;
    } catch (err) {
      Logger.getLogger().error(`CoinGecko price fetch failed for ${tokenSymbol}:`, err);
      return undefined;
    }
  }

  /**
   * Fetch price from DeFiLlama API
   */
  async getDeFiLlamaPrice(tokenSymbol: string): Promise<number | undefined> {
    try {
      // Check cache (5 minute TTL)
      const cached = this.defiLlamaCache.get(tokenSymbol);
      if (cached && Date.now() - cached.timestamp < 300000) {
        return cached.price;
      }
      
      const chainTokenMap: { [key: string]: string } = {
        'ETH': 'ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        'CELO': 'celo:0x471EcE3750Da237f93B8E339c536989b8978a438',
        'BTC': 'ethereum:0x2260fac5e5542a773aa44fbcff5adc19a279c405'
      };
      
      const tokenAddress = chainTokenMap[tokenSymbol];
      if (!tokenAddress) return undefined;
      
      const response = await fetch(`https://coins.llama.fi/prices/current/${tokenAddress}`);
      if (!response.ok) throw new Error(`DeFiLlama API error: ${response.status}`);
      
      const data = await response.json();
      const priceData = data.coins?.[tokenAddress];
      
      if (priceData?.price) {
        this.defiLlamaCache.set(tokenSymbol, {
          price: priceData.price,
          timestamp: Date.now(),
          confidence: priceData.confidence || 0.95
        });
        return priceData.price;
      }
    } catch (err) {
      Logger.getLogger().error(`DeFiLlama price fetch failed for ${tokenSymbol}:`, err);
    }
    return undefined;
  }

  /**
   * Get token price from multiple sources with fallback
   * Priority: Chainlink > DeFiLlama > CoinGecko > Fallback
   */
  async getTokenPriceUSD(tokenSymbol: string): Promise<number> {
    const price = 
      await this.getChainlinkPrice(tokenSymbol) ||
      await this.getDeFiLlamaPrice(tokenSymbol) ||
      await this.getCoinGeckoPrice(tokenSymbol);
    
    return price ?? this.getFallbackPrice(tokenSymbol);
  }

  /**
   * Calculate vault balance from holdings
   */
  calculateVaultBalance(holdings: any[]): string {
    if (!holdings || holdings.length === 0) {
      return '0.00';
    }

    const totalBalance = holdings.reduce((sum: number, holding: any) => {
      return sum + parseFloat(holding.balance || '0');
    }, 0);

    return totalBalance.toFixed(2);
  }

  /**
   * Calculate vault performance from performance history
   */
  calculatePerformance(performances: any[]): number {
    if (!performances || performances.length === 0) return 0;
    
    const latest = performances[0];
    const startValue = parseFloat(latest.startingValue || '0');
    const endValue = parseFloat(latest.endingValue || '0');
    
    return startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.priceCache.clear();
    this.coinGeckoCache.clear();
    this.defiLlamaCache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      priceCache: this.priceCache.size,
      coinGeckoCache: this.coinGeckoCache.size,
      defiLlamaCache: this.defiLlamaCache.size
    };
  }
}

// Export singleton instance
export const vaultUtilities = new VaultUtilities();
