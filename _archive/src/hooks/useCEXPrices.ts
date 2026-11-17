/**
 * useCEXPrices Hook
 * 
 * Fetch real-time prices from multiple exchanges with caching and auto-polling
 */

import { useEffect, useState, useCallback, useRef } from 'react';

interface Price {
  bid: number;
  ask: number;
  last: number;
}

interface PriceData {
  [exchange: string]: Price | null;
}

interface Analysis {
  best_bid: number;
  best_ask: number;
  spread: number;
  spread_pct: number;
  best_source: string;
}

interface UseCEXPricesResult {
  prices: PriceData | null;
  analysis: Analysis | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isRefetching: boolean;
}

/**
 * Hook to fetch CEX prices with auto-polling
 * @param symbol - Token symbol (e.g., 'CELO')
 * @param exchanges - List of exchanges to fetch from (default: all)
 * @param pollInterval - Auto-poll interval in ms (default: 30000ms = 30s)
 * @returns Price data with analysis and control methods
 */
export const useCEXPrices = (
  symbol: string,
  exchanges: string[] = ['binance', 'coinbase', 'kraken'],
  pollInterval: number = 30000
): UseCEXPricesResult => {
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<{
    data: PriceData | null;
    analysis: Analysis | null;
    timestamp: number;
  }>({ data: null, analysis: null, timestamp: 0 });

  const CACHE_TTL = 3000; // 3 second client-side cache

  /**
   * Fetch prices from API
   */
  const fetchPrices = useCallback(async () => {
    try {
      setError(null);
      
      // Check client cache
      const now = Date.now();
      if (
        cacheRef.current.data &&
        now - cacheRef.current.timestamp < CACHE_TTL
      ) {
        setPrices(cacheRef.current.data);
        setAnalysis(cacheRef.current.analysis);
        setLoading(false);
        return;
      }

      setLoading(true);
      
      const exchangeParam = exchanges.join(',');
      const response = await fetch(
        `/api/exchanges/prices?symbol=${symbol}&exchanges=${exchangeParam}`
      );

      if (!response.ok) {
        if (response.status === 400) {
          const data = await response.json();
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      setPrices(data.prices);
      setAnalysis(data.analysis);
      
      // Update cache
      cacheRef.current = {
        data: data.prices,
        analysis: data.analysis,
        timestamp: now,
      };

      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setLoading(false);
      console.error('Error fetching CEX prices:', err);
    }
  }, [symbol, exchanges]);

  /**
   * Manual refetch
   */
  const refetch = useCallback(async () => {
    setIsRefetching(true);
    // Clear cache to force fresh fetch
    cacheRef.current = { data: null, analysis: null, timestamp: 0 };
    await fetchPrices();
    setIsRefetching(false);
  }, [fetchPrices]);

  /**
   * Auto-polling effect
   */
  useEffect(() => {
    // Initial fetch
    fetchPrices();

    // Set up polling
    pollTimeoutRef.current = setInterval(() => {
      fetchPrices();
    }, pollInterval);

    return () => {
      if (pollTimeoutRef.current) {
        clearInterval(pollTimeoutRef.current);
      }
    };
  }, [symbol, exchanges, pollInterval, fetchPrices]);

  return {
    prices,
    analysis,
    loading,
    error,
    refetch,
    isRefetching,
  };
};

export default useCEXPrices;
