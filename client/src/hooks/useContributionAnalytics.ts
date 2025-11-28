import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useRealtimeMetrics } from './useRealtimeMetrics';

export interface ContributionMember {
  userId: string;
  name: string;
  tier: 'founder' | 'elder' | 'champion' | 'contributor' | 'participant';
  contributions: number;
  weightedScore: number;
  votes: number;
  proposals: number;
  participationRate: number;
  lastActive: string; // ISO date string
  verified: boolean;
  avatar?: string;
}

export interface ContributionAnalytics {
  daoId: string;
  period: {
    from: string;
    to: string;
  };
  summary: {
    totalContributors: number;
    totalContributions: number;
    averagePerMember: number;
    participationRate: number;
    newMembers: number;
    churnedMembers: number;
  };
  trends: Array<{
    date: string;
    totalContributions: number;
    contributors: number;
    byTier: {
      founder: number;
      elder: number;
      champion: number;
      contributor: number;
      participant: number;
    };
  }>;
  members: ContributionMember[];
  distribution: Array<{
    tier: string;
    count: number;
    percentage: number;
  }>;
  lastUpdated: string;
}

interface UseContributionAnalyticsProps {
  daoId: string;
  timeframe?: '7d' | '30d' | '90d' | '1y' | 'all';
  apiBaseUrl: string;
  enabled?: boolean;
}

/**
 * Hook for fetching and subscribing to contribution analytics data
 * Combines REST API for member data with WebSocket for real-time updates
 */
export const useContributionAnalytics = ({
  daoId,
  timeframe = '90d',
  apiBaseUrl,
  enabled = true,
}: UseContributionAnalyticsProps) => {
  const [mergedMembers, setMergedMembers] = useState<ContributionMember[]>([]);
  const [mergedSummary, setMergedSummary] = useState<ContributionAnalytics['summary'] | null>(null);

  // Fetch contribution analytics from REST API
  const contributionsQuery = useQuery({
    queryKey: ['contributions', daoId, timeframe],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeframe,
        limit: '100',
      });

      const response = await fetch(
        `${apiBaseUrl}/api/analyzer/contributions/${daoId}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch contributions');
      return response.json() as Promise<ContributionAnalytics>;
    },
    staleTime: 45000, // 45 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });

  // Fetch rotation history for additional insights
  const rotationQuery = useQuery({
    queryKey: ['rotation-history', daoId, timeframe],
    queryFn: async () => {
      const params = new URLSearchParams({ timeframe });

      const response = await fetch(
        `${apiBaseUrl}/api/analyzer/rotation/history/${daoId}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch rotation history');
      return response.json();
    },
    staleTime: 60000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });

  // Subscribe to real-time contribution updates
  const channelName = `dao:${daoId}:contributions`;
  const { data: realtimeData, isConnected } = useRealtimeMetrics(channelName);

  // Merge REST data with real-time updates
  useEffect(() => {
    if (contributionsQuery.data?.members) {
      let members = contributionsQuery.data.members;
      let summary = contributionsQuery.data.summary;

      // Merge real-time updates if available
      if (realtimeData && isConnected) {
        // Update member scores if real-time data has updates
        if (realtimeData.members && Array.isArray(realtimeData.members)) {
          const realtimeMap = new Map(
            realtimeData.members.map((m: any) => [m.userId, m])
          );

          members = members.map((member) => {
            const realtimeUpdate = realtimeMap.get(member.userId);
            return realtimeUpdate ? { ...member, ...realtimeUpdate } : member;
          });
        }

        // Update summary stats
        if (realtimeData.summary) {
          summary = {
            ...summary,
            ...realtimeData.summary,
          };
        }
      }

      setMergedMembers(members);
      setMergedSummary(summary);
    }
  }, [contributionsQuery.data, realtimeData, isConnected]);

  // Refresh function
  const refresh = useCallback(() => {
    contributionsQuery.refetch();
    rotationQuery.refetch();
  }, [contributionsQuery, rotationQuery]);

  return {
    members: mergedMembers,
    summary: mergedSummary,
    trends: contributionsQuery.data?.trends,
    distribution: contributionsQuery.data?.distribution,
    rotationHistory: rotationQuery.data,
    isLoading: contributionsQuery.isLoading || rotationQuery.isLoading,
    isError: contributionsQuery.isError || rotationQuery.isError,
    error: contributionsQuery.error || rotationQuery.error,
    isConnected,
    refresh,
    lastUpdated: contributionsQuery.data?.lastUpdated,
  };
};
