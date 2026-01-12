/**
 * Fear & Greed Index Hook
 * Fetch market sentiment data with creative visualizations
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import type { FearGreedIndex, MarketChangeMetrics, BtcDominanceData, MarketSentimentResponse } from '@/types/exchanges';
import {
  formatNumberCompact,
  formatPercentage,
  formatCurrency,
  getOptimalDecimals,
  formatDisplayValue
} from '@/utils/dataVisualization';

/**
 * Fetch Fear & Greed Index
 */
export function useFearGreedIndex(): UseQueryResult<{ fearGreedIndex: FearGreedIndex }, Error> {
  return useQuery({
    queryKey: ['sentiment:fearGreed'],
    queryFn: async () => {
      const response = await fetch('/api/exchanges/sentiment/fear-greed');

      if (!response.ok) {
        throw new Error('Failed to fetch Fear & Greed Index');
      }

      return response.json();
    },
    gcTime: 5 * 60 * 1000, // 5 minutes
    staleTime: 60 * 1000, // 1 minute (market sentiment updates frequently)
    refetchInterval: 2 * 60 * 1000 // 2 minute refresh
  } as any);
}

/**
 * Fetch market changes over multiple periods
 */
export function useMarketChanges(): UseQueryResult<{ marketChanges: MarketChangeMetrics[] }, Error> {
  return useQuery({
    queryKey: ['sentiment:marketChanges'],
    queryFn: async () => {
      const response = await fetch('/api/exchanges/sentiment/market-changes');

      if (!response.ok) {
        throw new Error('Failed to fetch market changes');
      }

      return response.json();
    },
    gcTime: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000 // 5 minute refresh
  } as any);
}

/**
 * Fetch BTC dominance data
 */
export function useBtcDominance(): UseQueryResult<{ btcDominance: BtcDominanceData }, Error> {
  return useQuery({
    queryKey: ['sentiment:btcDominance'],
    queryFn: async () => {
      const response = await fetch('/api/exchanges/sentiment/btc-dominance');

      if (!response.ok) {
        throw new Error('Failed to fetch BTC dominance');
      }

      return response.json();
    },
    gcTime: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000
  } as any);
}

/**
 * Fetch complete market sentiment
 */
export function useMarketSentiment(): UseQueryResult<{ sentiment: MarketSentimentResponse }, Error> {
  return useQuery({
    queryKey: ['sentiment:complete'],
    queryFn: async () => {
      const response = await fetch('/api/exchanges/sentiment/complete');

      if (!response.ok) {
        throw new Error('Failed to fetch market sentiment');
      }

      return response.json();
    },
    gcTime: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000
  } as any);
}

/**
 * Get color for Fear & Greed classification
 */
export function getClassificationColor(classification: string): string {
  const colors: Record<string, string> = {
    extreme_fear: '#8b0000', // Dark red
    fear: '#ef4444', // Red
    neutral: '#f59e0b', // Amber
    greed: '#84cc16', // Lime
    extreme_greed: '#22c55e' // Green
  };
  return colors[classification] || '#6b7280';
}

/**
 * Get gradient for visualizations
 */
export function getFearGreedGradient(
  classification: string
): { from: string; to: string } {
  const gradients: Record<string, { from: string; to: string }> = {
    extreme_fear: { from: '#8b0000', to: '#ef4444' },
    fear: { from: '#ef4444', to: '#f97316' },
    neutral: { from: '#f59e0b', to: '#eab308' },
    greed: { from: '#84cc16', to: '#65a30d' },
    extreme_greed: { from: '#22c55e', to: '#16a34a' }
  };
  return gradients[classification] || { from: '#6b7280', to: '#9ca3af' };
}

/**
 * Format change percentage with direction
 */
export function formatChangePercent(percent: number): {
  formatted: string;
  color: string;
  emoji: string;
} {
  const isPositive = percent > 0;
  const emoji = isPositive ? '📈' : percent < 0 ? '📉' : '➡️';
  const color = isPositive ? '#22c55e' : percent < 0 ? '#ef4444' : '#f59e0b';
  const decimals = getOptimalDecimals(percent);
  const formatted = `${isPositive ? '+' : ''}${percent.toFixed(decimals)}%`;

  return { formatted, color, emoji };
}

/**
 * Format large numbers with abbreviations
 */
export function formatLargeNumber(num: number): string {
  // Use the centralized formatting utility
  return formatNumberCompact(num, 2);
}

/**
 * Get Fear & Greed gauge needle position
 */
export function getGaugeNeedleRotation(score: number): number {
  // 0-100 maps to -90 to 90 degrees
  return (score / 100) * 180 - 90;
}

/**
 * Get sentiment emoji
 */
export function getSentimentEmoji(classification: string): string {
  const emojis: Record<string, string> = {
    extreme_fear: '😨',
    fear: '😟',
    neutral: '😐',
    greed: '😊',
    extreme_greed: '🤑'
  };
  return emojis[classification] || '😐';
}

/**
 * Get sentiment description
 */
export function getSentimentDescription(classification: string): string {
  const descriptions: Record<string, string> = {
    extreme_fear: 'Extreme Fear - Potential bottom',
    fear: 'Fear - Bearish sentiment',
    neutral: 'Neutral - Uncertain market',
    greed: 'Greed - Bullish sentiment',
    extreme_greed: 'Extreme Greed - Possible top'
  };
  return descriptions[classification] || 'Neutral - Uncertain market';
}

/**
 * Determine if metric is good or bad
 */
export function getMetricStatus(
  metric: string,
  value: number
): 'excellent' | 'good' | 'fair' | 'poor' {
  const ranges: Record<string, { excellent: [number, number]; good: [number, number] }> = {
    volatility: { excellent: [50, 100], good: [30, 50] },
    momentum: { excellent: [60, 100], good: [45, 60] },
    marketTrend: { excellent: [60, 100], good: [45, 60] },
    dominance: { excellent: [40, 70], good: [30, 40] },
    volume: { excellent: [70, 100], good: [50, 70] }
  };

  const range = ranges[metric];
  if (!range) return 'fair';

  if (value >= range.excellent[0] && value <= range.excellent[1]) return 'excellent';
  if (value >= range.good[0] && value <= range.good[1]) return 'good';
  if (value < range.good[0]) return 'poor';
  return 'fair';
}
