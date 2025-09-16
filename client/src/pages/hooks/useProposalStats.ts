
import { useQuery } from "@tanstack/react-query";

interface ProposalStats {
  total: number;
  active: number;
  resolved: number;
  expired: number;
  pending: number;
  executed: number;
  rejected: number;
  thisMonth: number;
  lastMonth: number;
  averageVotes: number;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
}

interface ProposalActivity {
  date: string;
  count: number;
  category: string;
}

export function useProposalStats(daoId?: string, timeframe: '7d' | '30d' | '90d' | 'all' = '30d') {
  return useQuery<ProposalStats>({
    queryKey: ["dao", "proposalStats", daoId, timeframe],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (daoId) params.append('daoId', daoId);
      params.append('timeframe', timeframe);

      const res = await fetch(`/api/dao/proposals/stats?${params}`);
      if (!res.ok) throw new Error("Failed to fetch proposal stats");
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProposalActivity(daoId?: string, days: number = 30) {
  return useQuery<ProposalActivity[]>({
    queryKey: ["dao", "proposalActivity", daoId, days],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (daoId) params.append('daoId', daoId);
      params.append('days', days.toString());

      const res = await fetch(`/api/dao/proposals/activity?${params}`);
      if (!res.ok) throw new Error("Failed to fetch proposal activity");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
