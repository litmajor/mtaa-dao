/**
 * useCEXOHLCV Hook
 * 
 * Fetch historical OHLCV candle data for charting with caching
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface UseCEXOHLCVResult {
  candles: Candle[] | null;
  loading: boolean;
  error: string | null;
  source: string | null;
  refetch: () => Promise<void>;
  isRefetching: boolean;
}

/**
 * Hook to fetch OHLCV candle data
 * @param symbol - Token symbol (e.g., 'CELO')
 * @param timeframe - Candle timeframe
 * @param limit - Number of candles to fetch (default: 24)
 * @param exchange - Specific exchange (default: binance, will fallback to others)
 * @returns Candle data with metadata
 */
export const useCEXOHLCV = (
  symbol: string,
  timeframe: Timeframe = '1h',
  limit: number = 24,
  exchange: string = 'binance'
): UseCEXOHLCVResult => {
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  const cacheRef = useRef<{
    data: Candle[] | null;
    source: string | null;
    timestamp: number;
  }>({ data: null, source: null, timestamp: 0 });

  const CACHE_TTL = 5 * 60 * 1000; // 5 minute cache (candles don't change frequently)

  /**
   * Fetch OHLCV data from API
   */
  const fetchOHLCV = useCallback(async () => {
    try {
      setError(null);

      // Check localStorage cache
      const cacheKey = `ohlcv_${symbol}_${timeframe}_${limit}`;
      const cached = localStorage.getItem(cacheKey);
      const now = Date.now();

      if (cached) {
        const { data, source: src, timestamp } = JSON.parse(cached);
        if (now - timestamp < CACHE_TTL) {
          setCandles(data);
          setSource(src);
          setLoading(false);
          return;
        }
      }

      setLoading(true);

      const response = await fetch(
        `/api/exchanges/ohlcv?symbol=${symbol}&exchange=${exchange}&timeframe=${timeframe}&limit=${limit}`
      );

      if (!response.ok) {
        if (response.status === 400) {
          const data = await response.json();
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Convert array format to object format
      const formattedCandles: Candle[] = data.data.map(
        (candle: any[]) => ({
          timestamp: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5],
        })
      );

      setCandles(formattedCandles);
      setSource(data.exchange || exchange);

      // Cache to localStorage
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: formattedCandles,
          source: data.exchange || exchange,
          timestamp: now,
        })
      );

      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setLoading(false);
      console.error('Error fetching OHLCV:', err);
    }
  }, [symbol, timeframe, limit, exchange]);

  /**
   * Manual refetch - clears cache
   */
  const refetch = useCallback(async () => {
    setIsRefetching(true);
    const cacheKey = `ohlcv_${symbol}_${timeframe}_${limit}`;
    localStorage.removeItem(cacheKey);
    await fetchOHLCV();
    setIsRefetching(false);
  }, [symbol, timeframe, limit, fetchOHLCV]);

  /**
   * Fetch on mount or when parameters change
   */
  useEffect(() => {
    fetchOHLCV();
  }, [symbol, timeframe, limit, exchange, fetchOHLCV]);

  return {
    candles,
    loading,
    error,
    source,
    refetch,
    isRefetching,
  };
};

export default useCEXOHLCV;
