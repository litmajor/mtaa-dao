import { logger } from '../utils/logger';

/**
 * Price Oracle Service for Cryptocurrency Prices
 * Phase 1: BTC and ETH support
 * Uses CoinGecko API (free tier) for real-time prices
 */

interface PriceData {
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: Date;
}

interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
    usd_market_cap: number;
    usd_24h_vol: number;
    last_updated_at: number;
  };
}

class PriceOracleService {
  private cache: Map<string, { data: PriceData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 60 * 1000; // 1 minute
  private readonly API_BASE = 'https://api.coingecko.com/api/v3';
  
  // CoinGecko IDs for supported assets
  private readonly COIN_IDS: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana',
    BNB: 'binancecoin',
    XRP: 'ripple',
    LTC: 'litecoin',
  };

  /**
   * Get current price for a single asset
   */
  async getPrice(symbol: string): Promise<PriceData | null> {
    try {
      // Check cache first
      const cached = this.cache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      const coinId = this.COIN_IDS[symbol.toUpperCase()];
      if (!coinId) {
        logger.warn(`Unsupported asset symbol: ${symbol}`);
        return null;
      }

      const response = await fetch(
        `${this.API_BASE}/simple/price?ids=${coinId}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      const data: CoinGeckoResponse = await response.json();
      const coinData = data[coinId];

      if (!coinData) {
        logger.warn(`No price data for ${symbol}`);
        return null;
      }

      const priceData: PriceData = {
        symbol: symbol.toUpperCase(),
        name: this.getCoinName(symbol),
        priceUsd: coinData.usd,
        priceChange24h: coinData.usd_24h_change || 0,
        marketCap: coinData.usd_market_cap || 0,
        volume24h: coinData.usd_24h_vol || 0,
        lastUpdated: new Date(coinData.last_updated_at * 1000),
      };

      // Update cache
      this.cache.set(symbol, { data: priceData, timestamp: Date.now() });

      return priceData;
    } catch (error) {
      logger.error(`Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get prices for multiple assets
   */
  async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();

    try {
      const coinIds = symbols
        .map(s => this.COIN_IDS[s.toUpperCase()])
        .filter(Boolean);

      if (coinIds.length === 0) {
        return prices;
      }

      const response = await fetch(
        `${this.API_BASE}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      const data: CoinGeckoResponse = await response.json();

      for (const symbol of symbols) {
        const coinId = this.COIN_IDS[symbol.toUpperCase()];
        const coinData = data[coinId];

        if (coinData) {
          const priceData: PriceData = {
            symbol: symbol.toUpperCase(),
            name: this.getCoinName(symbol),
            priceUsd: coinData.usd,
            priceChange24h: coinData.usd_24h_change || 0,
            marketCap: coinData.usd_market_cap || 0,
            volume24h: coinData.usd_24h_vol || 0,
            lastUpdated: new Date(coinData.last_updated_at * 1000),
          };

          prices.set(symbol.toUpperCase(), priceData);
          
          // Update cache
          this.cache.set(symbol, { data: priceData, timestamp: Date.now() });
        }
      }
    } catch (error) {
      logger.error('Error fetching multiple prices:', error);
    }

    return prices;
  }

  /**
   * Get historical price data for charts
   */
  async getHistoricalPrices(
    symbol: string,
    days: number = 30
  ): Promise<Array<{ date: Date; price: number }>> {
    try {
      const coinId = this.COIN_IDS[symbol.toUpperCase()];
      if (!coinId) {
        return [];
      }

      const response = await fetch(
        `${this.API_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.prices.map(([timestamp, price]: [number, number]) => ({
        date: new Date(timestamp),
        price,
      }));
    } catch (error) {
      logger.error(`Error fetching historical prices for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Calculate portfolio value
   */
  async calculatePortfolioValue(
    holdings: Array<{ symbol: string; balance: number }>
  ): Promise<number> {
    let totalValue = 0;

    const symbols = holdings.map(h => h.symbol);
    const prices = await this.getPrices(symbols);

    for (const holding of holdings) {
      const price = prices.get(holding.symbol.toUpperCase());
      if (price) {
        totalValue += holding.balance * price.priceUsd;
      }
    }

    return totalValue;
  }

  /**
   * Get coin name from symbol
   */
  private getCoinName(symbol: string): string {
    const names: Record<string, string> = {
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      SOL: 'Solana',
      BNB: 'BNB',
      XRP: 'XRP',
      LTC: 'Litecoin',
    };
    return names[symbol.toUpperCase()] || symbol.toUpperCase();
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; assets: string[] } {
    return {
      size: this.cache.size,
      assets: Array.from(this.cache.keys()),
    };
  }
}

export const priceOracle = new PriceOracleService();

