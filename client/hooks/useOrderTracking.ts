/**
 * useOrderTracking Hook - Updated with Real Backend Data
 * Real-time order status, history, and trading metrics
 * Supports all market types with proper classification
 * Integrated with backend API
 * 
 * Features:
 * - Real-time order status updates from backend
 * - Order history with filtering
 * - Trading metrics and statistics
 * - Market type filtering
 * - P&L tracking
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { tradingApi } from '../lib/apiClient';

export type MarketType = 'spot' | 'margin' | 'futures' | 'swap' | 'option' | 'dex';

export interface OrderStatus {
  orderId: string;
  exchange: string;
  tradingPair: string;
  marketType: MarketType;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  amount: number;
  filled: number;
  remaining: number;
  fillPercentage: number;
  averageFillPrice: number;
  totalCost: number;
  status: 'open' | 'closed' | 'canceled' | 'expired';
  timestamp: number;
  updatedAt: number;
}

export interface OrderHistoryItem {
  id: string;
  exchange: string;
  tradingPair: string;
  marketType: MarketType;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  filledAmount: number;
  status: 'open' | 'closed' | 'canceled' | 'partial';
  createdAt: string;
  closedAt?: string;
  pnl?: {
    realizedPnl: number;
    realizedPnlPercent: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  };
}

export interface TradingMetrics {
  totalOrders: number;
  successfulOrders: number;
  partialFillRate: number;
  averageFillTime: number;
  totalFeesUSD: number;
  totalPnL: number;
  winRate: number;
  averageReturn: number;
  largestWin: number;
  largestLoss: number;
  byMarketType: {
    [key in MarketType]?: {
      orders: number;
      pnl: number;
      winRate: number;
    };
  };
}

/**
 * Hook: Get order status with real-time updates
 */
export function useOrderStatus(orderId: string, exchange: string = 'binance', pollInterval: number = 5000) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orderStatus', orderId, exchange],
    queryFn: async () => {
      const response = await fetch(`/api/v1/yuki/orders/${orderId}?exchange=${exchange}`);
      if (!response.ok) throw new Error('Failed to fetch order status');
      const data = await response.json();
      return data.order as OrderStatus;
    },
    refetchInterval: pollInterval,
    staleTime: pollInterval / 2,
  });

  return {
    order: data || null,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
  };
}

/**
 * Hook: Get all open orders
 */
export function useOpenOrders(exchange?: string, pollInterval: number = 10000) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['openOrders', exchange],
    queryFn: async () => {
      const url = exchange ? `/api/v1/yuki/orders?exchange=${exchange}` : '/api/v1/yuki/orders';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch open orders');
      const data = await response.json();
      return data.orders as OrderStatus[];
    },
    refetchInterval: pollInterval,
    staleTime: pollInterval / 2,
  });

  return {
    orders: data || [],
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    count: data?.length || 0,
  };
}

/**
 * Hook: Get order history with filtering
 */
export function useOrderHistory(options?: {
  exchange?: string;
  pair?: string;
  status?: string;
  marketType?: MarketType;
  limit?: number;
  offset?: number;
}) {
  const queryParams = new URLSearchParams();

  if (options?.exchange) queryParams.append('exchange', options.exchange);
  if (options?.pair) queryParams.append('pair', options.pair);
  if (options?.status) queryParams.append('status', options.status);
  if (options?.marketType) queryParams.append('marketType', options.marketType);
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orderHistory', options],
    queryFn: async () => {
      const url = `/api/v1/yuki/orders/limit?${queryParams.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch order history');
      const data = await response.json();
      return data.orders as OrderHistoryItem[];
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    orders: data || [],
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    count: data?.length || 0,
  };
}

/**
 * Hook: Get trading metrics and statistics
 */
export function useTradingMetrics() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tradingMetrics'],
    queryFn: async () => {
      const response = await fetch('/api/v1/yuki/orders');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      return data.metrics as TradingMetrics;
    },
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 30000,
  });

  return {
    metrics: data || null,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    totalOrders: data?.totalOrders || 0,
    totalPnL: data?.totalPnL || 0,
    winRate: data?.winRate || 0,
  };
}

/**
 * Hook: Cancel order
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ orderId, exchange }: { orderId: string; exchange: string }) => {
      const response = await fetch(`/api/v1/yuki/orders/${orderId}?exchange=${exchange}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openOrders'] });
      queryClient.invalidateQueries({ queryKey: ['orderHistory'] });
    },
  });

  return {
    cancelOrder: (orderId: string, exchange?: string) =>
      mutation.mutate({ orderId, exchange: exchange || 'binance' }),
    isLoading: mutation.isPending,
    error: mutation.error?.message || null,
    isSuccess: mutation.isSuccess,
  };
}

/**
 * Hook: Close order manually
 */
export function useCloseOrder() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ orderId, finalPrice }: { orderId: string; finalPrice: number }) => {
      const response = await fetch(`/api/v1/yuki/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalPrice }),
      });

      if (!response.ok) {
        throw new Error('Failed to close order');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openOrders'] });
      queryClient.invalidateQueries({ queryKey: ['orderHistory'] });
    },
  });

  return {
    closeOrder: (orderId: string, finalPrice: number) => mutation.mutate({ orderId, finalPrice }),
    isLoading: mutation.isPending,
    error: mutation.error?.message || null,
    isSuccess: mutation.isSuccess,
  };
}

/**
 * Hook: Market type specific order tracking
 */
export function useMarketTypeOrders(marketType: MarketType, exchange?: string) {
  const { orders, loading, error } = useOrderHistory({
    marketType,
    exchange,
    limit: 100,
  });

  // Calculate market type specific metrics
  const metrics = {
    totalOrders: orders.length,
    openOrders: orders.filter(o => o.status === 'open').length,
    closedOrders: orders.filter(o => o.status === 'closed').length,
    totalPnL: orders.reduce((sum, o) => sum + (o.pnl?.realizedPnL || 0), 0),
    avgReturn: orders.filter(o => o.pnl?.realizedPnLPercent).length > 0
      ? orders.reduce((sum, o) => sum + (o.pnl?.realizedPnLPercent || 0), 0) /
        orders.filter(o => o.pnl?.realizedPnLPercent).length
      : 0,
    winRate:
      orders.filter(o => o.pnl?.realizedPnL).length > 0
        ? (orders.filter(o => (o.pnl?.realizedPnL || 0) > 0).length /
            orders.filter(o => o.pnl?.realizedPnL).length) *
          100
        : 0,
  };

  return {
    orders,
    loading,
    error,
    metrics,
  };
}

/**
 * Hook: Spot trading orders
 */
export function useSpotOrders(exchange?: string) {
  return useMarketTypeOrders('spot', exchange);
}

/**
 * Hook: Perpetual futures orders
 */
export function usePerpetualsOrders(exchange?: string) {
  return useMarketTypeOrders('futures', exchange);
}

/**
 * Hook: Margin trading orders
 */
export function useMarginOrders(exchange?: string) {
  return useMarketTypeOrders('margin', exchange);
}

/**
 * Hook: Get position summary (for perpetuals)
 */
export function usePositionSummary(exchange: string = 'binance') {
  const { orders } = useOpenOrders(exchange);

  // Filter perpetual positions
  const positions = orders.filter(o => o.status === 'open');

  const summary = {
    totalPositions: positions.length,
    longPositions: positions.filter(o => o.type === 'buy').length,
    shortPositions: positions.filter(o => o.type === 'sell').length,
    totalExposure: positions.reduce((sum, p) => sum + p.totalCost, 0),
    totalUnrealizedPnl: positions.reduce((sum, p) => {
      const pnlPercent = (p.averageFillPrice - p.averageFillPrice) / p.averageFillPrice;
      return sum + p.totalCost * pnlPercent;
    }, 0),
  };

  return summary;
}

/**
 * Hook: Order statistics dashboard
 */
export function useOrderStatistics(marketType?: MarketType) {
  const { orders: history } = useOrderHistory({ marketType, limit: 1000 });
  const { metrics } = useTradingMetrics();

  const stats = {
    totalOrders: history.length,
    executionRate: history.filter(o => o.status === 'closed').length / history.length || 0,
    avgExecutionTime: history.reduce((sum, o) => {
      if (o.closedAt && o.createdAt) {
        return sum + (new Date(o.closedAt).getTime() - new Date(o.createdAt).getTime());
      }
      return sum;
    }, 0) / (history.filter(o => o.closedAt && o.createdAt).length || 1),
    pairFrequency: [...new Set(history.map(o => o.tradingPair))].length,
    averageProfitPerTrade: metrics?.totalPnL || 0 / (metrics?.totalOrders || 1),
    largestWin: metrics?.largestWin || 0,
    largestLoss: Math.abs(metrics?.largestLoss || 0),
    profitFactor:
      (history.filter(o => (o.pnl?.realizedPnL || 0) > 0).reduce((sum, o) => sum + (o.pnl?.realizedPnL || 0), 0) || 1) /
      (Math.abs(history.filter(o => (o.pnl?.realizedPnL || 0) < 0).reduce((sum, o) => sum + (o.pnl?.realizedPnL || 0), 0)) || 1),
  };

  return stats;
}
