/**
 * usePositionManagement Hook - Updated with Real Backend Data
 * For perpetuals, margin, and complex position management
 * Handles leverage, collateral, liquidation risk, and partial closes
 * Integrated with backend API
 * 
 * Features:
 * - Position tracking with leverage from backend
 * - Liquidation risk monitoring
 * - Collateral management
 * - Take-profit and stop-loss
 * - Partial position closing
 */

'use client';

import { useState, useCallback } from 'react';
import { tradingApi } from '../lib/apiClient';

export type MarketType = 'spot' | 'margin' | 'futures' | 'swap' | 'option' | 'dex';
export type PositionSide = 'long' | 'short';

export interface Position {
  positionId: string;
  exchange: string;
  pair: string;
  marketType: Extract<MarketType, 'futures' | 'swap' | 'margin'>;
  side: PositionSide;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  collateral: number;
  leverage: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  liquidationPrice: number;
  liquidationRisk: number; // 0-100, percent
  fees: number;
  timestamp: number;
  takeProfit?: {
    price: number;
    amount: number;
  };
  stopLoss?: {
    price: number;
    amount: number;
  };
}

export interface Collateral {
  asset: string;
  exchange: string;
  total: number;
  available: number;
  borrowed: number;
  interestRate: number;
}

export interface LiquidationRiskAnalysis {
  riskLevel: 'safe' | 'moderate' | 'high' | 'critical';
  liquidationDistance: number; // Percent from liquidation
  estimatedLiquidationTime: number; // Minutes until liquidation
  requiredMargin: number;
  excessMargin: number;
  marginRatio: number;
}

export interface PositionMetrics {
  totalOpenPositions: number;
  totalCollateral: number;
  totalExposure: number;
  averageLeverage: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnl: number;
  portfolioLiquidationRisk: 'safe' | 'moderate' | 'high' | 'critical';
  riskScore: number; // 0-100
}

/**
 * Hook: Get open positions
 */
export function usePositions(exchange?: string, pair?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['positions', exchange, pair],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (exchange) params.append('exchange', exchange);
      if (pair) params.append('pair', pair);

      const url = `/api/positions?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch positions');
      const data = await response.json();
      return data.positions as Position[];
    },
    refetchInterval: 10000, // Update every 10 seconds
    staleTime: 5000,
  });

  const metrics = useMemo(() => {
    if (!data) return null;

    return {
      total: data.length,
      longs: data.filter(p => p.side === 'long').length,
      shorts: data.filter(p => p.side === 'short').length,
      totalExposure: data.reduce((sum, p) => sum + p.amount * p.currentPrice, 0),
      totalCollateral: data.reduce((sum, p) => sum + p.collateral, 0),
      totalUnrealizedPnl: data.reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0),
      avgLeverage: data.length > 0 ? data.reduce((sum, p) => sum + p.leverage, 0) / data.length : 0,
    };
  }, [data]);

  return {
    positions: data || [],
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    metrics,
  };
}

/**
 * Hook: Get single position with detailed info
 */
export function usePosition(positionId: string, exchange: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['position', positionId, exchange],
    queryFn: async () => {
      const response = await fetch(`/api/positions/${positionId}?exchange=${exchange}`);
      if (!response.ok) throw new Error('Failed to fetch position');
      const data = await response.json();
      return data.position as Position;
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });

  return {
    position: data || null,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
  };
}

/**
 * Hook: Get collateral information
 */
export function useCollateral(exchange: string, asset?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['collateral', exchange, asset],
    queryFn: async () => {
      const url = asset
        ? `/api/collateral?exchange=${exchange}&asset=${asset}`
        : `/api/collateral?exchange=${exchange}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch collateral');
      const data = await response.json();
      return data.collateral as Collateral[];
    },
    refetchInterval: 30000, // Update every 30 seconds
    staleTime: 15000,
  });

  const summary = useMemo(() => {
    if (!data) return null;

    return {
      totalValue: data.reduce((sum, c) => sum + c.total, 0),
      availableValue: data.reduce((sum, c) => sum + c.available, 0),
      borrowedValue: data.reduce((sum, c) => sum + c.borrowed, 0),
      utilizationRate: data.reduce((sum, c) => sum + c.total - c.available, 0) / 
                      (data.reduce((sum, c) => sum + c.total, 0) || 1),
    };
  }, [data]);

  return {
    collateral: data || [],
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    summary,
  };
}

/**
 * Hook: Liquidation risk analysis
 */
export function useLiquidationRisk(positionId: string, exchange: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['liquidationRisk', positionId, exchange],
    queryFn: async () => {
      const response = await fetch(`/api/positions/${positionId}/liquidation-risk?exchange=${exchange}`);
      if (!response.ok) throw new Error('Failed to fetch liquidation risk');
      const data = await response.json();
      return data.risk as LiquidationRiskAnalysis;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  return {
    risk: data || null,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    isRisky: data && (data.riskLevel === 'high' || data.riskLevel === 'critical'),
  };
}

/**
 * Hook: Portfolio liquidation risk
 */
export function usePortfolioLiquidationRisk(exchange?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portfolioLiquidationRisk', exchange],
    queryFn: async () => {
      const url = exchange
        ? `/api/positions/risk/portfolio?exchange=${exchange}`
        : `/api/positions/risk/portfolio`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch portfolio risk');
      const data = await response.json();
      return data.metrics as PositionMetrics;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  return {
    metrics: data || null,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    riskLevel: data?.portfolioLiquidationRisk || 'safe',
    isAtRisk: data && (data.portfolioLiquidationRisk === 'high' || data.portfolioLiquidationRisk === 'critical'),
  };
}

/**
 * Hook: Close or reduce position
 */
export function useReducePosition() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      positionId,
      exchange,
      amount,
      price,
      orderType = 'market',
    }: {
      positionId: string;
      exchange: string;
      amount: number;
      price?: number;
      orderType?: 'market' | 'limit';
    }) => {
      const response = await fetch(`/api/positions/${positionId}/reduce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          amount,
          price,
          orderType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reduce position');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position'] });
    },
  });

  return {
    reduce: (positionId: string, exchange: string, amount: number, price?: number, orderType?: 'market' | 'limit') =>
      mutation.mutate({ positionId, exchange, amount, price, orderType }),
    isLoading: mutation.isPending,
    error: mutation.error?.message || null,
    isSuccess: mutation.isSuccess,
  };
}

/**
 * Hook: Update take-profit or stop-loss
 */
export function useUpdateTPSL() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      positionId,
      exchange,
      takeProfit,
      stopLoss,
    }: {
      positionId: string;
      exchange: string;
      takeProfit?: { price: number; amount: number };
      stopLoss?: { price: number; amount: number };
    }) => {
      const response = await fetch(`/api/positions/${positionId}/tp-sl`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          takeProfit,
          stopLoss,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update TP/SL');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position'] });
    },
  });

  return {
    update: (positionId: string, exchange: string, tp?: { price: number; amount: number }, sl?: { price: number; amount: number }) =>
      mutation.mutate({ positionId, exchange, takeProfit: tp, stopLoss: sl }),
    isLoading: mutation.isPending,
    error: mutation.error?.message || null,
    isSuccess: mutation.isSuccess,
  };
}

/**
 * Hook: Close entire position
 */
export function useClosePosition() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      positionId,
      exchange,
      price,
      orderType = 'market',
    }: {
      positionId: string;
      exchange: string;
      price?: number;
      orderType?: 'market' | 'limit';
    }) => {
      const response = await fetch(`/api/positions/${positionId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          price,
          orderType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to close position');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position'] });
    },
  });

  return {
    close: (positionId: string, exchange: string, price?: number, orderType?: 'market' | 'limit') =>
      mutation.mutate({ positionId, exchange, price, orderType }),
    isLoading: mutation.isPending,
    error: mutation.error?.message || null,
    isSuccess: mutation.isSuccess,
  };
}

/**
 * Hook: Add collateral to reduce liquidation risk
 */
export function useAddCollateral() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      exchange,
      asset,
      amount,
    }: {
      exchange: string;
      asset: string;
      amount: number;
    }) => {
      const response = await fetch(`/api/collateral/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          asset,
          amount,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add collateral');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collateral'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });

  return {
    add: (exchange: string, asset: string, amount: number) =>
      mutation.mutate({ exchange, asset, amount }),
    isLoading: mutation.isPending,
    error: mutation.error?.message || null,
    isSuccess: mutation.isSuccess,
  };
}

/**
 * Hook: Position alerts for specific conditions
 */
export function usePositionAlerts(positionId: string, exchange: string) {
  const { position } = usePosition(positionId, exchange);
  const { risk } = useLiquidationRisk(positionId, exchange);

  const alerts = useMemo(() => {
    const alerts: Array<{ severity: 'info' | 'warning' | 'danger'; message: string }> = [];

    if (!position || !risk) return alerts;

    // Check liquidation risk
    if (risk.riskLevel === 'critical') {
      alerts.push({
        severity: 'danger',
        message: `CRITICAL: Position liquidation risk at ${risk.liquidationDistance}%. Consider closing or adding collateral.`,
      });
    } else if (risk.riskLevel === 'high') {
      alerts.push({
        severity: 'warning',
        message: `HIGH RISK: Position is ${risk.liquidationDistance}% from liquidation.`,
      });
    }

    // Check unrealized loss
    if (position.unrealizedPnlPercent < -5) {
      alerts.push({
        severity: 'warning',
        message: `Position is down ${Math.abs(position.unrealizedPnlPercent)}%. Consider your risk tolerance.`,
      });
    }

    // Check leverage
    if (position.leverage > 10) {
      alerts.push({
        severity: 'warning',
        message: `High leverage position (${position.leverage}x). This increases liquidation risk.`,
      });
    }

    // Check if close to TP or SL
    if (position.takeProfit) {
      const distanceToTP = Math.abs(position.takeProfit.price - position.currentPrice) / position.currentPrice;
      if (distanceToTP < 0.01) {
        alerts.push({
          severity: 'info',
          message: `Position is within 1% of take-profit target.`,
        });
      }
    }

    if (position.stopLoss) {
      const distanceToSL = Math.abs(position.stopLoss.price - position.currentPrice) / position.currentPrice;
      if (distanceToSL < 0.01) {
        alerts.push({
          severity: 'warning',
          message: `Position is within 1% of stop-loss trigger.`,
        });
      }
    }

    return alerts;
  }, [position, risk]);

  return {
    alerts,
    hasAlerts: alerts.length > 0,
    hasCriticalAlerts: alerts.some(a => a.severity === 'danger'),
  };
}

/**
 * Hook: Recommended actions for position management
 */
export function usePositionRecommendations(positionId: string, exchange: string) {
  const { position } = usePosition(positionId, exchange);
  const { risk } = useLiquidationRisk(positionId, exchange);
  const { metrics } = usePortfolioLiquidationRisk(exchange);

  const recommendations = useMemo(() => {
    const recs: string[] = [];

    if (!position || !risk || !metrics) return recs;

    // Liquidation risk recommendations
    if (risk.riskLevel === 'critical') {
      recs.push('Add collateral immediately to reduce liquidation risk');
      recs.push('Consider closing 50% of the position');
    } else if (risk.riskLevel === 'high') {
      recs.push('Add collateral to reduce risk');
      recs.push('Consider closing 25% of the position');
    }

    // Profit taking
    if (position.unrealizedPnlPercent > 5 && !position.takeProfit) {
      recs.push('Consider setting a take-profit to lock in gains');
    }

    // Loss management
    if (position.unrealizedPnlPercent < -2 && !position.stopLoss) {
      recs.push('Consider setting a stop-loss to limit downside');
    }

    // Leverage optimization
    if (position.leverage > 5 && position.unrealizedPnl > 0) {
      recs.push('Consider reducing leverage to lock in profits with less risk');
    }

    return recs;
  }, [position, risk, metrics]);

  return {
    recommendations,
    hasRecommendations: recommendations.length > 0,
  };
}
