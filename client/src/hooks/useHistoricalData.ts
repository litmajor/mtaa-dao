/**
 * Hook for fetching historical data and analysis
 */

import { useQuery } from '@tanstack/react-query';

export interface HistoricalDataPoint {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePercent: number;
}

export interface HistoricalStats {
  period: string;
  dataPoints: number;
  startDate: string;
  endDate: string;
  highPrice: number;
  highDate: string;
  lowPrice: number;
  lowDate: string;
  openPrice: number;
  closePrice: number;
  changePercent: number;
  changeAbsolute: number;
  volatility: number;
  averageVolume: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  cumulativeReturn: number;
  daysUp: number;
  daysDown: number;
  winRate: number;
}

export interface HistoricalAnalysisResponse {
  symbol: string;
  exchange: string;
  period: string;
  timestamp: number;
  analysis: {
    symbol: string;
    exchange: string;
    period: string;
    timestamp: number;
    data: HistoricalDataPoint[];
    stats: HistoricalStats;
  };
}

export interface HistoricalComparisonResponse {
  symbol: string;
  exchange: string;
  timestamp: number;
  comparison: {
    periods: Array<{
      symbol: string;
      exchange: string;
      period: string;
      timestamp: number;
      data: HistoricalDataPoint[];
      stats: HistoricalStats;
    }>;
    comparison: Record<string, any>;
  };
}

export const useHistoricalData = (
  symbol: string,
  exchange: string = 'binance',
  period: '1m' | '3m' | '6m' | '1y' | 'all' = '1y',
  enabled: boolean = true
) => {
  return useQuery<HistoricalAnalysisResponse>({
    queryKey: ['historicalData', symbol, exchange, period],
    queryFn: async () => {
      const response = await fetch(
        `/api/exchanges/historical?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}&period=${period}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch historical data');
      }

      return response.json();
    },
    enabled: enabled && !!symbol && !!exchange,
    retry: 2,
  } as any);
};

export const useHistoricalComparison = (
  symbol: string,
  exchange: string = 'binance',
  enabled: boolean = true
) => {
  return useQuery<HistoricalComparisonResponse>({
    queryKey: ['historicalComparison', symbol, exchange],
    queryFn: async () => {
      const response = await fetch(
        `/api/exchanges/historical/compare?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch historical comparison');
      }

      return response.json();
    },
    enabled: enabled && !!symbol && !!exchange,
    retry: 2,
  } as any);
};

/**
 * Get color for price change
 */
export const getChangeColor = (change: number): string => {
  if (change > 0) return 'text-green-600 dark:text-green-400';
  if (change < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
};

/**
 * Get background color for volatility
 */
export const getVolatilityColor = (volatility: number): string => {
  if (volatility > 10) return 'bg-red-50 dark:bg-red-900/20';
  if (volatility > 5) return 'bg-orange-50 dark:bg-orange-900/20';
  return 'bg-green-50 dark:bg-green-900/20';
};

/**
 * Format large numbers
 */
export const formatNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
};

/**
 * Get performance rating
 */
export const getPerformanceRating = (changePercent: number): string => {
  if (changePercent > 50) return 'Exceptional ⭐⭐⭐⭐⭐';
  if (changePercent > 25) return 'Excellent ⭐⭐⭐⭐';
  if (changePercent > 10) return 'Very Good ⭐⭐⭐';
  if (changePercent > 0) return 'Good ⭐⭐';
  if (changePercent > -10) return 'Fair ⭐';
  return 'Poor ❌';
};
