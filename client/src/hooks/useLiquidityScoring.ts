/**
 * Liquidity Scoring Hook
 * Fetches and manages liquidity metrics and rankings
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';

export interface LiquidityComponent {
  score: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  details: string;
}

export interface LiquidityMetrics {
  symbol: string;
  exchange: string;
  timestamp: number;
  overall: LiquidityComponent;
  spread: LiquidityComponent;
  depth: LiquidityComponent;
  volume: LiquidityComponent;
  stability: LiquidityComponent;
  imbalance: LiquidityComponent;
  volatility: LiquidityComponent;
  warnings?: string[];
}

export interface LiquidityRanking {
  symbol: string;
  exchanges: Array<{
    exchange: string;
    score: number;
    rating: string;
  }>;
  bestExchange: { exchange: string; score: number };
  averageScore: number;
  rank: number;
  timestamp: number;
}

export interface UseLiquidityScoringOptions {
  enabled?: boolean;
}

/**
 * Fetch liquidity score
 */
async function fetchLiquidityScore(
  symbol: string,
  exchange: string
): Promise<LiquidityMetrics> {
  try {
    const response = await fetch(
      `/api/exchanges/liquidity/score?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to fetch liquidity score');
    }

    return response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch liquidity score');
  }
}

/**
 * Hook: Get liquidity metrics for a trading pair
 */
export function useLiquidityScore(
  symbol: string,
  exchange: string = 'binance',
  options: UseLiquidityScoringOptions = {}
): UseQueryResult<LiquidityMetrics, Error> {
  const { enabled = true } = options;

  return useQuery<LiquidityMetrics, Error>({
    queryKey: ['liquidityScore', symbol, exchange],
    queryFn: () => fetchLiquidityScore(symbol, exchange),
    enabled: enabled && !!symbol,
    gcTime: 300000 // 5 minutes
  } as any);
}

/**
 * Fetch liquidity ranking
 */
async function fetchLiquidityRanking(symbol: string, exchanges: string[]): Promise<LiquidityRanking> {
  try {
    const response = await fetch(
      `/api/exchanges/liquidity/ranking?symbol=${encodeURIComponent(symbol)}&exchanges=${encodeURIComponent(exchanges.join(','))}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to fetch liquidity ranking');
    }

    return response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch liquidity ranking');
  }
}

/**
 * Hook: Get liquidity ranking across exchanges
 */
export function useLiquidityRanking(
  symbol: string,
  exchanges: string[] = ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'],
  options: UseLiquidityScoringOptions = {}
): UseQueryResult<LiquidityRanking, Error> {
  const { enabled = true } = options;

  return useQuery<LiquidityRanking, Error>({
    queryKey: ['liquidityRanking', symbol, exchanges.join(',')],
    queryFn: () => fetchLiquidityRanking(symbol, exchanges),
    enabled: enabled && !!symbol,
    gcTime: 300000 // 5 minutes
  } as any);
}

/**
 * Helper: Get color for liquidity rating
 */
export function getLiquidityColor(rating: string): string {
  switch (rating) {
    case 'excellent':
      return '#10b981'; // Green
    case 'good':
      return '#3b82f6'; // Blue
    case 'fair':
      return '#f59e0b'; // Amber
    case 'poor':
      return '#ef4444'; // Red
    default:
      return '#6b7280'; // Gray
  }
}

/**
 * Helper: Get rating emoji
 */
export function getLiquidityEmoji(rating: string): string {
  switch (rating) {
    case 'excellent':
      return '⭐⭐⭐⭐⭐';
    case 'good':
      return '⭐⭐⭐⭐';
    case 'fair':
      return '⭐⭐⭐';
    case 'poor':
      return '⭐⭐';
    default:
      return '⭐';
  }
}

/**
 * Helper: Get rating description
 */
export function getRatingDescription(rating: string): string {
  switch (rating) {
    case 'excellent':
      return 'Excellent liquidity';
    case 'good':
      return 'Good liquidity';
    case 'fair':
      return 'Fair liquidity';
    case 'poor':
      return 'Poor liquidity';
    default:
      return 'Unknown';
  }
}

/**
 * Helper: Format score with icon
 */
export function formatScoreWithIcon(score: number): { icon: string; color: string } {
  if (score >= 80) {
    return { icon: '🟢', color: '#10b981' };
  } else if (score >= 60) {
    return { icon: '🔵', color: '#3b82f6' };
  } else if (score >= 40) {
    return { icon: '🟡', color: '#f59e0b' };
  } else {
    return { icon: '🔴', color: '#ef4444' };
  }
}
