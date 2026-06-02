/**
 * useAnalytics Hook - Updated with Real Backend Data
 * Trading analytics, performance metrics, and dashboard data
 * Market type aware with proper classification
 * Integrated with backend API
 * 
 * Features:
 * - Performance metrics from backend
 * - Fee analysis and optimization
 * - Pair performance analysis
 * - Time-based analytics
 * - Risk metrics
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../lib/apiClient';

export type MarketType = 'spot' | 'margin' | 'futures' | 'swap' | 'option' | 'dex';

export interface PairPerformance {
  pair: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  pnlPercent: number;
  averageReturn: number;
  sharpRatio: number;
  maxDrawdown: number;
  marketTypes: MarketType[];
}

export interface ExchangePerformance {
  exchange: string;
  totalTrades: number;
  totalFees: number;
  totalPnL: number;
  bestPair: string;
  marketTypes: { [key in MarketType]?: number };
}

export interface TimeBasedMetrics {
  date: string;
  trades: number;
  pnl: number;
  fees: number;
  winRate: number;
  volumeUSD: number;
}

export interface RiskMetrics {
  valueAtRisk: number; // VaR 95%
  maximumDrawdown: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number; // Market correlation
  correlationMatrix: { [key: string]: number };
}

export interface PortfolioMetrics {
  totalCapital: number;
  totalProfit: number;
  profitPercent: number;
  totalFees: number;
  totalTrades: number;
  successRate: number;
  averageTradeSize: number;
  averageTradeProfit: number;
  profitFactor: number; // Gross profit / gross loss
  expectancy: number; // Average win * win rate - average loss * loss rate
}

/**
 * Hook: Get pair performance metrics
 */
export function usePairPerformance(pair?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pairPerformance', pair],
    queryFn: async () => {
      const url = pair ? `/api/analytics/pairs/${pair}` : `/api/analytics/pairs`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch pair performance');
      const data = await response.json();
      return data.pairs as PairPerformance[];
    },
    staleTime: 60000, // Cache for 60 seconds
  });

  // Sort by PnL if not filtering by single pair
  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.totalPnL - a.totalPnL);
  }, [data]);

  return {
    pairs: sorted,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    topPair: sorted[0] || null,
    bestPerformer: sorted.reduce((best, curr) => (curr.pnlPercent > (best?.pnlPercent || 0) ? curr : best), null),
  };
}

/**
 * Hook: Get exchange performance comparison
 */
export function useExchangePerformance() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['exchangePerformance'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/exchanges');
      if (!response.ok) throw new Error('Failed to fetch exchange performance');
      const data = await response.json();
      return data.exchanges as ExchangePerformance[];
    },
    staleTime: 60000,
  });

  const summary = useMemo(() => {
    if (!data) return null;

    return {
      bestExchange: data.reduce((best, curr) => (curr.totalPnL > (best?.totalPnL || 0) ? curr : best)),
      mostUsed: data.reduce((most, curr) => (curr.totalTrades > (most?.totalTrades || 0) ? curr : most)),
      lowestFees: data.reduce((lowest, curr) => (curr.totalFees < (lowest?.totalFees || Infinity) ? curr : lowest)),
      totalFees: data.reduce((sum, e) => sum + e.totalFees, 0),
      totalPnL: data.reduce((sum, e) => sum + e.totalPnL, 0),
    };
  }, [data]);

  return {
    exchanges: data || [],
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    summary,
  };
}

/**
 * Hook: Get time-based analytics (daily/weekly/monthly)
 */
export function useTimeBasedAnalytics(timeframe: 'day' | 'week' | 'month' | 'year' = 'week') {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['timeBasedAnalytics', timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/timeseries?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      return data.timeseries as TimeBasedMetrics[];
    },
    staleTime: 30000,
  });

  const cumulativeMetrics = useMemo(() => {
    if (!data) return null;

    let cumulativePnL = 0;
    let cumulativeFees = 0;
    let totalTrades = 0;
    let totalWins = 0;

    return data.map(metric => {
      cumulativePnL += metric.pnl;
      cumulativeFees += metric.fees;
      totalTrades += metric.trades;
      totalWins += Math.round(metric.trades * (metric.winRate / 100));

      return {
        ...metric,
        cumulativePnL,
        cumulativeFees,
        netPnL: cumulativePnL - cumulativeFees,
        cumulativeWinRate: totalWins / Math.max(totalTrades, 1),
      };
    });
  }, [data]);

  return {
    metrics: data || [],
    cumulativeMetrics: cumulativeMetrics || [],
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    latestMetric: data?.[data.length - 1] || null,
  };
}

/**
 * Hook: Get risk metrics
 */
export function useRiskMetrics() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['riskMetrics'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/risk');
      if (!response.ok) throw new Error('Failed to fetch risk metrics');
      const data = await response.json();
      return data.risk as RiskMetrics;
    },
    staleTime: 120000, // Cache for 2 minutes (expensive calculation)
  });

  return {
    risk: data || null,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    isHighRisk: data && data.valueAtRisk > 0.2, // More than 20% VaR
    isStable: data && data.volatility < 0.15, // Less than 15% volatility
  };
}

/**
 * Hook: Get portfolio metrics
 */
export function usePortfolioMetrics() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portfolioMetrics'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/portfolio');
      if (!response.ok) throw new Error('Failed to fetch portfolio metrics');
      const data = await response.json();
      return data.portfolio as PortfolioMetrics;
    },
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 30000,
  });

  return {
    portfolio: data || null,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    isProfit: data && data.totalProfit > 0,
    profitMargin: data ? (data.totalProfit / data.totalCapital) * 100 : 0,
    feePercentage: data ? (data.totalFees / data.totalCapital) * 100 : 0,
  };
}

/**
 * Hook: Market type performance breakdown
 */
export function useMarketTypeAnalytics(marketType: MarketType) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['marketTypeAnalytics', marketType],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/market-types/${marketType}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      return data.analytics;
    },
    staleTime: 60000,
  });

  return {
    analytics: data || null,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
  };
}

/**
 * Hook: Spot trading analytics
 */
export function useSpotAnalytics() {
  return useMarketTypeAnalytics('spot');
}

/**
 * Hook: Perpetuals trading analytics
 */
export function usePerpetualsAnalytics() {
  return useMarketTypeAnalytics('futures');
}

/**
 * Hook: Margin trading analytics
 */
export function useMarginAnalytics() {
  return useMarketTypeAnalytics('margin');
}

/**
 * Hook: Fee optimization analysis
 */
export function useFeeOptimization() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['feeOptimization'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/fee-optimization');
      if (!response.ok) throw new Error('Failed to fetch fee optimization');
      const data = await response.json();
      return data.optimization;
    },
    staleTime: 300000, // Cache for 5 minutes (doesn't change often)
  });

  const recommendations = useMemo(() => {
    if (!data) return [];

    return [
      {
        title: 'VIP Tier Eligibility',
        description: data.nextVipTierVolumeNeeded
          ? `${data.nextVipTierVolumeNeeded} more volume to reach next tier`
          : 'Already at max VIP tier',
        savings: data.potentialSavings || 0,
      },
      {
        title: 'Maker vs Taker',
        description: `Using maker orders saves ~${data.makerTakerDifference}% per trade`,
        savings: data.makerSavings || 0,
      },
      {
        title: 'Best Exchange for Fees',
        description: `${data.bestExchangeForFees} has the lowest fees`,
        savings: data.exchangeSavings || 0,
      },
    ];
  }, [data]);

  return {
    optimization: data || null,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    recommendations,
    totalPotentialSavings: recommendations.reduce((sum, r) => sum + r.savings, 0),
  };
}

/**
 * Hook: Correlation matrix for diversification
 */
export function useCorrelationAnalysis() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['correlationAnalysis'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/correlations');
      if (!response.ok) throw new Error('Failed to fetch correlations');
      const data = await response.json();
      return data.correlations;
    },
    staleTime: 300000,
  });

  const diversificationScore = useMemo(() => {
    if (!data) return 0;
    
    const values = Object.values(data).flat() as number[];
    const avgCorrelation = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Convert average correlation to diversification score (0-100)
    // Lower correlation = better diversification
    return Math.max(0, (1 - avgCorrelation) * 100);
  }, [data]);

  return {
    correlations: data || null,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
    diversificationScore,
    isWellDiversified: diversificationScore > 60,
  };
}

/**
 * Hook: Performance comparison vs benchmark
 */
export function useBenchmarkComparison(benchmark: 'BTC' | 'ETH' | 'SPY' = 'BTC') {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['benchmarkComparison', benchmark],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/benchmark?benchmark=${benchmark}`);
      if (!response.ok) throw new Error('Failed to fetch benchmark data');
      const data = await response.json();
      return data.comparison;
    },
    staleTime: 60000,
  });

  const performance = useMemo(() => {
    if (!data) return null;

    return {
      yourReturn: data.yourReturn,
      benchmarkReturn: data.benchmarkReturn,
      outperformance: data.yourReturn - data.benchmarkReturn,
      alpha: data.alpha, // Excess return
      beta: data.beta, // Market sensitivity
      isOutperforming: data.yourReturn > data.benchmarkReturn,
    };
  }, [data]);

  return {
    comparison: data || null,
    performance,
    loading: isLoading,
    error: error?.message || null,
    refresh: refetch,
  };
}

/**
 * Hook: Dashboard summary (combines multiple metrics)
 */
export function useDashboardSummary() {
  const portfolio = usePortfolioMetrics();
  const risk = useRiskMetrics();
  const pairs = usePairPerformance();
  const exchanges = useExchangePerformance();
  const { cumulativeMetrics } = useTimeBasedAnalytics('week');

  const loading = portfolio.loading || risk.loading || pairs.loading || exchanges.loading;
  const hasError = portfolio.error || risk.error || pairs.error || exchanges.error;

  const summary = useMemo(() => {
    if (!portfolio.portfolio || !risk.risk || !pairs.pairs) return null;

    return {
      totalCapital: portfolio.portfolio.totalCapital,
      totalProfit: portfolio.portfolio.totalProfit,
      profitPercent: portfolio.portfolio.profitPercent,
      totalFees: portfolio.portfolio.totalFees,
      totalTrades: portfolio.portfolio.totalTrades,
      winRate: portfolio.portfolio.successRate,
      riskScore: risk.risk.valueAtRisk,
      volatility: risk.risk.volatility,
      topPair: pairs.topPair,
      bestExchange: exchanges.summary?.bestExchange,
      weeklyTrend: cumulativeMetrics?.[cumulativeMetrics.length - 1]?.cumulativePnL || 0,
    };
  }, [portfolio.portfolio, risk.risk, pairs.pairs, exchanges.summary, cumulativeMetrics]);

  return {
    summary,
    loading,
    error: hasError,
    refresh: () => {
      portfolio.refresh();
      risk.refresh();
      pairs.refresh();
      exchanges.refresh();
    },
  };
}
