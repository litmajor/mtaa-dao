/**
 * Order Book Data Hook
 * Fetches and manages real-time order book analysis
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';

export interface OrderBookLevel {
  price: number;
  amount: number;
  cumulative: number;
  cumulativePercent: number;
}

export interface OrderBookAnalysis {
  totalBidVolume: number;
  totalAskVolume: number;
  volumeImbalance: number;
  bidAskRatio: number;
  liquidityScore: number;
  bidDepth1pct: number;
  askDepth1pct: number;
  bidDepth5pct: number;
  askDepth5pct: number;
  pressure: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
}

export interface OrderBookMetrics {
  symbol: string;
  exchange: string;
  timestamp: number;
  mid: number;
  spread: number;
  spreadPercent: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bidWalls: Array<{ price: number; amount: number }>;
  askWalls: Array<{ price: number; amount: number }>;
  analysis: OrderBookAnalysis;
}

export interface UseOrderBookOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Fetch order book analysis
 */
async function fetchOrderBook(
  symbol: string,
  exchange: string,
  limit: number = 20
): Promise<OrderBookMetrics> {
  try {
    const response = await fetch(
      `/api/exchanges/orderbook?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}&limit=${limit}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to fetch order book');
    }

    return response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch order book');
  }
}

/**
 * Hook: Get order book analysis for a trading pair
 * Automatically refetches every 5 seconds for real-time updates
 */
export function useOrderBook(
  symbol: string,
  exchange: string = 'binance',
  limit: number = 20,
  options: UseOrderBookOptions = {}
): UseQueryResult<OrderBookMetrics, Error> {
  const { enabled = true, refetchInterval = 5000 } = options;

  return useQuery<OrderBookMetrics, Error>({
    queryKey: ['orderBook', symbol, exchange, limit],
    queryFn: () => fetchOrderBook(symbol, exchange, limit),
    enabled: enabled && !!symbol,
    refetchInterval,
    gcTime: 10000 // 10 seconds
  } as any);
}

/**
 * Fetch liquidity alerts
 */
async function fetchLiquidityAlerts(
  symbol: string,
  exchange: string
): Promise<{
  alerts: string[];
  metrics: OrderBookMetrics;
}> {
  try {
    const response = await fetch(
      `/api/exchanges/orderbook/alerts?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to fetch liquidity alerts');
    }

    return response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch liquidity alerts');
  }
}

/**
 * Hook: Check for liquidity alerts
 */
export function useLiquidityAlerts(
  symbol: string,
  exchange: string = 'binance',
  options: UseOrderBookOptions = {}
): UseQueryResult<{ alerts: string[]; metrics: OrderBookMetrics }, Error> {
  const { enabled = true, refetchInterval = 10000 } = options;

  return useQuery({
    queryKey: ['liquidityAlerts', symbol, exchange],
    queryFn: () => fetchLiquidityAlerts(symbol, exchange),
    enabled: enabled && !!symbol,
    refetchInterval,
    gcTime: 15000
  } as any);
}

/**
 * Fetch liquidity profile
 */
async function fetchLiquidityProfile(
  symbol: string,
  exchanges: string[]
): Promise<
  Array<{
    exchange: string;
    metrics: OrderBookMetrics;
    rating: string;
  }>
> {
  try {
    const response = await fetch(
      `/api/exchanges/orderbook/profile?symbol=${encodeURIComponent(symbol)}&exchanges=${encodeURIComponent(exchanges.join(','))}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to fetch liquidity profile');
    }

    const data = await response.json();
    return data.profile;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch liquidity profile');
  }
}

/**
 * Hook: Get liquidity profile across exchanges
 */
export function useLiquidityProfile(
  symbol: string,
  exchanges: string[] = ['binance', 'coinbase', 'kraken'],
  options: UseOrderBookOptions = {}
): UseQueryResult<
  Array<{
    exchange: string;
    metrics: OrderBookMetrics;
    rating: string;
  }>,
  Error
> {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ['liquidityProfile', symbol, exchanges.join(',')],
    queryFn: () => fetchLiquidityProfile(symbol, exchanges),
    enabled: enabled && !!symbol,
    gcTime: 30000
  } as any);
}

/**
 * Helper: Determine wall strength description
 */
export function getWallStrengthDescription(amount: number, midPrice: number): string {
  const value = amount * midPrice;

  if (value > 1000000) return '💪 Massive Wall';
  if (value > 500000) return '🧱 Major Wall';
  if (value > 100000) return '⬜ Significant Wall';
  return '📦 Order Cluster';
}

/**
 * Helper: Get pressure color
 */
export function getPressureColor(
  pressure: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'
): string {
  switch (pressure) {
    case 'strong_buy':
      return '#00ff00'; // Bright green
    case 'buy':
      return '#90EE90'; // Light green
    case 'neutral':
      return '#FFD700'; // Gold
    case 'sell':
      return '#FFA500'; // Orange
    case 'strong_sell':
      return '#FF0000'; // Red
    default:
      return '#666666';
  }
}

/**
 * Helper: Get pressure label with emoji
 */
export function getPressureLabel(
  pressure: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'
): string {
  switch (pressure) {
    case 'strong_buy':
      return '🚀 Strong Buy';
    case 'buy':
      return '📈 Buy';
    case 'neutral':
      return '➡️ Neutral';
    case 'sell':
      return '📉 Sell';
    case 'strong_sell':
      return '⚠️ Strong Sell';
    default:
      return '❓ Unknown';
  }
}

/**
 * Helper: Format volume display
 */
export function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return (volume / 1000000).toFixed(2) + 'M';
  }
  if (volume >= 1000) {
    return (volume / 1000).toFixed(2) + 'K';
  }
  return volume.toFixed(2);
}

/**
 * Helper: Get liquidity rating color
 */
export function getLiquidityRatingColor(rating: string): string {
  switch (rating) {
    case 'Excellent':
      return '#00ff00';
    case 'Good':
      return '#90EE90';
    case 'Fair':
      return '#FFD700';
    case 'Poor':
      return '#FF0000';
    default:
      return '#666666';
  }
}
