import { useQuery } from '@tanstack/react-query';

interface CoinGeckoData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  atl: number;
  roi: null | {
    times: number;
    currency: string;
    percentage: number;
  };
}

/**
 * Fetch market data from CoinGecko API
 * Cached for 10 minutes per symbol
 */
export const useCoinGeckoData = (symbol: string | null) => {
  return useQuery({
    queryKey: ['coingecko', symbol || ''],
    queryFn: async () => {
      if (!symbol) return null;

      try {
        // CoinGecko API endpoint for single coin data
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_market_cap_rank=true`,
          {
            headers: {
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        const symbolLower = symbol.toLowerCase();
        
        if (!data[symbolLower]) {
          throw new Error(`No data found for symbol: ${symbol}`);
        }

        return {
          symbol,
          price: data[symbolLower].usd,
          marketCap: data[symbolLower].usd_market_cap,
          volume24h: data[symbolLower].usd_24h_vol,
          marketCapRank: data[symbolLower].usd_market_cap_rank
        };
      } catch (error) {
        console.error('Failed to fetch CoinGecko data for', symbol, error);
        return null;
      }
    },
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    enabled: !!symbol
  } as any);
};

/**
 * Fetch multiple coins data from CoinGecko at once
 * More efficient for batch queries
 */
export const useCoinGeckoMultiple = (symbols: string[]) => {
  return useQuery({
    queryKey: ['coingecko-multiple', symbols.join(',')],
    queryFn: async () => {
      if (!symbols || symbols.length === 0) return {};

      try {
        // Limit to 250 IDs per request to avoid URL length issues
        const ids = symbols.slice(0, 250).map(s => s.toLowerCase()).join(',');
        
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_market_cap_rank=true`,
          {
            headers: {
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        const result: { [key: string]: any } = {};

        // Map the response to include symbol as key
        Object.entries(data).forEach(([id, coinData]: [string, any]) => {
          const symbol = symbols.find(s => s.toLowerCase() === id);
          if (symbol) {
            result[symbol] = {
              symbol,
              price: coinData.usd,
              marketCap: coinData.usd_market_cap,
              volume24h: coinData.usd_24h_vol,
              marketCapRank: coinData.usd_market_cap_rank
            };
          }
        });

        return result;
      } catch (error) {
        console.error('Failed to fetch CoinGecko data for symbols:', symbols, error);
        return {};
      }
    },
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    enabled: symbols && symbols.length > 0
  } as any);
};

/**
 * Get formatted market cap string
 */
export const formatMarketCap = (marketCap: number | null | undefined): string => {
  if (!marketCap) return 'N/A';
  
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  } else if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  } else if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  } else if (marketCap >= 1e3) {
    return `$${(marketCap / 1e3).toFixed(2)}K`;
  }
  
  return `$${marketCap.toFixed(2)}`;
};

/**
 * Get formatted volume string
 */
export const formatVolume = (volume: number | null | undefined): string => {
  if (!volume) return 'N/A';
  
  if (volume >= 1e12) {
    return `$${(volume / 1e12).toFixed(2)}T`;
  } else if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(2)}B`;
  } else if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(2)}M`;
  } else if (volume >= 1e3) {
    return `$${(volume / 1e3).toFixed(2)}K`;
  }
  
  return `$${volume.toFixed(2)}`;
};
