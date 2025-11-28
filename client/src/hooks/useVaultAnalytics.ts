import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useRealtimeMetrics } from './useRealtimeMetrics';

export interface VaultMetric {
  currentTVL: number;
  tvlHistory: Array<{ date: string; tvl: number }>;
  currentAPY: number;
  apyHistory: Array<{ date: string; apy: number; benchmark: number }>;
  assets: Array<{ name: string; amount: number; percentage: number }>;
  withdrawals: Array<{ date: string; amount: number }>;
  riskMetrics: {
    liquidityRatio: number;
    concentrationRisk: number;
    volatility: number;
    riskScore: number;
  };
}

export interface VaultAnalyticsResponse {
  vaultId: string;
  daoId: string;
  metrics: VaultMetric;
  lastUpdated: string;
  timestamp: number;
}

interface UseVaultAnalyticsProps {
  daoId: string;
  vaultId?: string;
  timeframe?: '7d' | '30d' | '90d' | '1y' | 'all';
  apiBaseUrl: string;
}

/**
 * Hook for fetching and subscribing to vault analytics data
 * Combines REST API for historical data with WebSocket for real-time updates
 */
export const useVaultAnalytics = ({
  daoId,
  vaultId,
  timeframe = '90d',
  apiBaseUrl,
}: UseVaultAnalyticsProps) => {
  const [mergedData, setMergedData] = useState<VaultMetric | null>(null);

  // Fetch performance metrics from REST API
  const performanceQuery = useQuery({
    queryKey: ['vault-performance', daoId, vaultId, timeframe],
    queryFn: async () => {
      const params = new URLSearchParams({ timeframe });
      const url = vaultId
        ? `${apiBaseUrl}/api/vault/performance/${vaultId}?${params}`
        : `${apiBaseUrl}/api/vault/performance?daoId=${daoId}&${params}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch vault performance');
      return response.json() as Promise<VaultAnalyticsResponse>;
    },
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch transaction history
  const transactionsQuery = useQuery({
    queryKey: ['vault-transactions', daoId, vaultId, timeframe],
    queryFn: async () => {
      const params = new URLSearchParams({ timeframe, limit: '100' });
      const url = vaultId
        ? `${apiBaseUrl}/api/vault/transactions/${vaultId}?${params}`
        : `${apiBaseUrl}/api/vault/transactions?daoId=${daoId}&${params}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch vault transactions');
      return response.json();
    },
    staleTime: 60000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Subscribe to real-time vault metrics updates
  const channelName = vaultId ? `vault:${vaultId}:metrics` : `vault:${daoId}:metrics`;
  const { data: realtimeData, isConnected } = useRealtimeMetrics(channelName);

  // Merge REST data with real-time updates
  useEffect(() => {
    if (performanceQuery.data?.metrics) {
      let merged = performanceQuery.data.metrics;

      // Merge real-time updates if available
      if (realtimeData && isConnected) {
        merged = {
          ...merged,
          currentTVL: realtimeData.currentTVL ?? merged.currentTVL,
          currentAPY: realtimeData.currentAPY ?? merged.currentAPY,
          tvlHistory: realtimeData.tvlHistory ?? merged.tvlHistory,
          apyHistory: realtimeData.apyHistory ?? merged.apyHistory,
          riskMetrics: {
            ...merged.riskMetrics,
            ...realtimeData.riskMetrics,
          },
        };
      }

      setMergedData(merged);
    }
  }, [performanceQuery.data, realtimeData, isConnected]);

  // Refresh function
  const refresh = useCallback(() => {
    performanceQuery.refetch();
    transactionsQuery.refetch();
  }, [performanceQuery, transactionsQuery]);

  return {
    data: mergedData,
    transactions: transactionsQuery.data,
    isLoading: performanceQuery.isLoading || transactionsQuery.isLoading,
    isError: performanceQuery.isError || transactionsQuery.isError,
    error: performanceQuery.error || transactionsQuery.error,
    isConnected,
    refresh,
    lastUpdated: performanceQuery.data?.lastUpdated,
  };
};
