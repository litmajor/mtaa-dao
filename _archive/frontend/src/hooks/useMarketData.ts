// frontend/src/hooks/useMarketData.ts
import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';

export interface MarketData {
  pair: string;
  weighted_price: number;
  best_bid: number;
  best_ask: number;
  spread_pct: number;
  cex_price: number;
  dex_price: number;
  cex_liquidity: number;
  dex_liquidity: number;
  total_liquidity: number;
  source_count: number;
  cex_count: number;
  dex_count: number;
}

export interface MarketSource {
  exchange: string;
  type: string;
  price: number;
  bid: number;
  ask: number;
  spread_pct: number;
  volume_24h_usd: number;
  liquidity_usd: number;
  timestamp: string;
}

export const useMarketData = () => {
  const { get } = useApi();
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [sources, setSources] = useState<MarketSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search for pair
  const searchPair = useCallback(
    async (pair: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await get(`/markets/search?q=${pair}`);
        if (response.status === 'success') {
          setMarketData(response as MarketData);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch market data');
      } finally {
        setLoading(false);
      }
    },
    [get]
  );

  // Get detailed market data with all sources
  const getDetailedData = useCallback(
    async (pair: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await get(`/markets/pairs/${pair}/detail`);
        if (response.status === 'success') {
          setMarketData(response.aggregated);
          setSources([
            ...response.cex_sources,
            ...response.dex_sources
          ]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch detailed market data');
      } finally {
        setLoading(false);
      }
    },
    [get]
  );

  // Get trending pairs
  const getTrendingPairs = useCallback(
    async (limit: number = 10) => {
      try {
        const response = await get(`/markets/trending?limit=${limit}`);
        return response.trending || [];
      } catch (err: any) {
        setError(err.message || 'Failed to fetch trending pairs');
        return [];
      }
    },
    [get]
  );

  // Detect arbitrage opportunities
  const detectArbitrage = useCallback(
    async (pair: string, sizeUsd: number = 10000) => {
      try {
        const response = await get(
          `/markets/pairs/${pair}/arbitrage?size_usd=${sizeUsd}`
        );
        return response.opportunities || [];
      } catch (err: any) {
        setError(err.message || 'Failed to detect arbitrage');
        return [];
      }
    },
    [get]
  );

  // Get OHLCV data for charts
  const getOHLCV = useCallback(
    async (pair: string, timeframe: string = '1h', limit: number = 100) => {
      try {
        const response = await get(
          `/markets/ohlcv/${pair}?timeframe=${timeframe}&limit=${limit}`
        );
        return response.data || [];
      } catch (err: any) {
        setError(err.message || 'Failed to fetch OHLCV data');
        return [];
      }
    },
    [get]
  );

  // Get pair statistics
  const getPairStats = useCallback(
    async (pair: string, period: string = '24h') => {
      try {
        const response = await get(`/markets/pairs/${pair}/stats?period=${period}`);
        return response;
      } catch (err: any) {
        setError(err.message || 'Failed to fetch pair statistics');
        return null;
      }
    },
    [get]
  );

  return {
    marketData,
    sources,
    loading,
    error,
    searchPair,
    getDetailedData,
    getTrendingPairs,
    detectArbitrage,
    getOHLCV,
    getPairStats
  };
};
