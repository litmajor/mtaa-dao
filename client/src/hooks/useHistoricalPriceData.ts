import { useQuery } from '@tanstack/react-query';
import { SparklinePoint } from '@/components/MarketSparkline';
import { 
  marketCapHistoryCache, 
  volumeHistoryCache,
  generateCacheKey, 
  cacheSettings 
} from '@/utils/historicalDataCache';

/**
 * Configuration for different data ranges
 */
export const DATA_RANGES = {
  '24h': { days: 1, interval: 'hourly' },
  '7d': { days: 7, interval: 'daily' },
  '30d': { days: 30, interval: 'daily' },
  '1y': { days: 365, interval: 'weekly' },
} as const;

export type DataRange = keyof typeof DATA_RANGES;

interface HistoricalDataPoint {
  timestamp: number;
  price: number;
  marketCap?: number;
  volume?: number;
}

/**
 * Hook to fetch 24-hour historical price data from CoinGecko
 * Used for market sparklines with real historical data
 * 
 * @param coinId - CoinGecko coin ID (e.g., 'bitcoin', 'ethereum')
 * @param range - Data range: '24h', '7d', '30d', '1y' (default: '24h')
 * @returns Query with historical data points and sparkline-formatted data
 */
export const useHistoricalPriceData = (
  coinId: string | null,
  range: DataRange = '24h'
) => {
  return useQuery({
    queryKey: ['historical-price', coinId, range],
    queryFn: async (): Promise<{
      raw: HistoricalDataPoint[];
      sparkline: SparklinePoint[];
      stats: {
        min: number;
        max: number;
        change: number;
        changePercent: number;
      };
    }> => {
      if (!coinId) throw new Error('Coin ID required');

      const cacheKey = generateCacheKey(coinId, range);
      
      // Check cache first
      const cachedData = priceHistoryCache.get(cacheKey);
      if (cachedData) {
        console.debug(`[Cache] Hit for price data: ${cacheKey}`);
        return cachedData;
      }

      try {
        const config = DATA_RANGES[range];
        
        // CoinGecko Market Chart API - returns historical OHLC data
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${config.days}`,
          {
            headers: {
              'Accept': 'application/json',
              // Optional: Add API key if available
              ...(process.env.REACT_APP_COINGECKO_API_KEY && {
                'X-CG-Pro-API-Key': process.env.REACT_APP_COINGECKO_API_KEY
              })
            }
          }
        );

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.prices || !Array.isArray(data.prices)) {
          throw new Error('Invalid API response format');
        }

        // Transform API response to our data structure
        const raw: HistoricalDataPoint[] = data.prices.map((point: [number, number], idx: number) => ({
          timestamp: point[0],
          price: point[1],
          // Include market cap if available
          marketCap: data.market_caps?.[idx]?.[1],
          // Include volume if available
          volume: data.total_volumes?.[idx]?.[1]
        }));

        // Calculate statistics
        const prices = raw.map(p => p.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const change = prices[prices.length - 1] - prices[0];
        const changePercent = (change / prices[0]) * 100;

        // Convert to sparkline format (normalized to indices for compatibility)
        const sparkline: SparklinePoint[] = raw.map((point, idx) => ({
          time: idx,
          value: point.price
        }));

        const result = {
          raw,
          sparkline,
          stats: {
            min,
            max,
            change,
            changePercent
          }
        };

        // Cache the result
        const ttl = cacheSettings[range].ttl;
        priceHistoryCache.set(cacheKey, result, ttl);
        console.debug(`[Cache] Stored price data for ${cacheKey} (TTL: ${ttl}ms)`);

        return result;
      } catch (error) {
        console.error('Failed to fetch historical price data for', coinId, error);
        throw error;
      }
    },
    gcTime: cacheSettings[range].ttl,
    staleTime: cacheSettings[range].staleTime,
    retry: 2,
    enabled: !!coinId
  });
};

/**
 * Hook to fetch historical market cap data
 * Similar to price data but specifically for market cap trends
 */
export const useHistoricalMarketCapData = (
  coinId: string | null,
  range: DataRange = '24h'
) => {
  return useQuery({
    queryKey: ['historical-marketcap', coinId, range],
    queryFn: async (): Promise<{
      raw: HistoricalDataPoint[];
      sparkline: SparklinePoint[];
      stats: {
        min: number;
        max: number;
        change: number;
        changePercent: number;
      };
    }> => {
      if (!coinId) throw new Error('Coin ID required');

      const cacheKey = generateCacheKey(coinId, `${range}-marketcap`);
      
      // Check cache first
      const cachedData = marketCapHistoryCache.get(cacheKey);
      if (cachedData) {
        console.debug(`[Cache] Hit for market cap data: ${cacheKey}`);
        return cachedData;
      }

      try {
        const config = DATA_RANGES[range];
        
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${config.days}`,
          {
            headers: {
              'Accept': 'application/json',
              ...(process.env.REACT_APP_COINGECKO_API_KEY && {
                'X-CG-Pro-API-Key': process.env.REACT_APP_COINGECKO_API_KEY
              })
            }
          }
        );

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.market_caps || !Array.isArray(data.market_caps)) {
          throw new Error('Invalid market cap data in API response');
        }

        // Transform API response using market cap data
        const raw: HistoricalDataPoint[] = data.market_caps.map((point: [number, number], idx: number) => ({
          timestamp: point[0],
          marketCap: point[1],
          price: data.prices?.[idx]?.[1],
          volume: data.total_volumes?.[idx]?.[1]
        }));

        // Calculate statistics
        const marketCaps = raw.map(p => p.marketCap || 0);
        const min = Math.min(...marketCaps);
        const max = Math.max(...marketCaps);
        const change = marketCaps[marketCaps.length - 1] - marketCaps[0];
        const changePercent = (change / marketCaps[0]) * 100;

        // Convert to sparkline format
        const sparkline: SparklinePoint[] = raw.map((point, idx) => ({
          time: idx,
          value: point.marketCap || 0
        }));

        const result = {
          raw,
          sparkline,
          stats: {
            min,
            max,
            change,
            changePercent
          }
        };

        // Cache the result
        const ttl = cacheSettings[range].ttl;
        marketCapHistoryCache.set(cacheKey, result, ttl);
        console.debug(`[Cache] Stored market cap data for ${cacheKey} (TTL: ${ttl}ms)`);

        return result;
      } catch (error) {
        console.error('Failed to fetch historical market cap data for', coinId, error);
        throw error;
      }
    },
    gcTime: cacheSettings[range].ttl,
    staleTime: cacheSettings[range].staleTime,
    retry: 2,
    enabled: !!coinId
  });
};

/**
 * Hook to fetch historical volume data
 * Tracks trading volume trends over time
 */
export const useHistoricalVolumeData = (
  coinId: string | null,
  range: DataRange = '24h'
) => {
  return useQuery({
    queryKey: ['historical-volume', coinId, range],
    queryFn: async (): Promise<{
      raw: HistoricalDataPoint[];
      sparkline: SparklinePoint[];
      stats: {
        min: number;
        max: number;
        change: number;
        changePercent: number;
        avgVolume: number;
      };
    }> => {
      if (!coinId) throw new Error('Coin ID required');

      const cacheKey = generateCacheKey(coinId, `${range}-volume`);
      
      // Check cache first
      const cachedData = volumeHistoryCache.get(cacheKey);
      if (cachedData) {
        console.debug(`[Cache] Hit for volume data: ${cacheKey}`);
        return cachedData;
      }

      try {
        const config = DATA_RANGES[range];
        
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${config.days}`,
          {
            headers: {
              'Accept': 'application/json',
              ...(process.env.REACT_APP_COINGECKO_API_KEY && {
                'X-CG-Pro-API-Key': process.env.REACT_APP_COINGECKO_API_KEY
              })
            }
          }
        );

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.total_volumes || !Array.isArray(data.total_volumes)) {
          throw new Error('Invalid volume data in API response');
        }

        // Transform API response using volume data
        const raw: HistoricalDataPoint[] = data.total_volumes.map((point: [number, number], idx: number) => ({
          timestamp: point[0],
          volume: point[1],
          price: data.prices?.[idx]?.[1],
          marketCap: data.market_caps?.[idx]?.[1]
        }));

        // Calculate statistics
        const volumes = raw.map(p => p.volume || 0);
        const min = Math.min(...volumes);
        const max = Math.max(...volumes);
        const change = volumes[volumes.length - 1] - volumes[0];
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const changePercent = (change / volumes[0]) * 100;

        // Convert to sparkline format
        const sparkline: SparklinePoint[] = raw.map((point, idx) => ({
          time: idx,
          value: point.volume || 0
        }));

        const result = {
          raw,
          sparkline,
          stats: {
            min,
            max,
            change,
            changePercent,
            avgVolume
          }
        };

        // Cache the result
        const ttl = cacheSettings[range].ttl;
        volumeHistoryCache.set(cacheKey, result, ttl);
        console.debug(`[Cache] Stored volume data for ${cacheKey} (TTL: ${ttl}ms)`);

        return result;
      } catch (error) {
        console.error('Failed to fetch historical volume data for', coinId, error);
        throw error;
      }
    },
    gcTime: cacheSettings[range].ttl,
    staleTime: cacheSettings[range].staleTime,
    retry: 2,
    enabled: !!coinId
  });
};
