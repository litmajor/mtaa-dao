
import { useQuery } from "@tanstack/react-query";

interface Contributor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  role: string;
  reputation: number;
  contributionCount: number;
  lastActivity: string;
  joinedAt: string;
  skills: string[];
  bio?: string;
}

interface ContributorsResponse {
  contributors: Contributor[];
  totalCount: number;
  activeCount: number;
}

export function useContributors(daoId?: string, filters?: {
  role?: string;
  active?: boolean;
  minReputation?: number;
}) {
  return useQuery({
    queryKey: ["dao", "contributors", daoId, filters],
    queryFn: async (): Promise<ContributorsResponse> => {
      const params = new URLSearchParams();
      
      if (daoId) params.append('daoId', daoId);
      if (filters?.role) params.append('role', filters.role);
      if (filters?.active !== undefined) params.append('active', filters.active.toString());
      if (filters?.minReputation) params.append('minReputation', filters.minReputation.toString());

      const res = await fetch(`/api/dao/contributors?${params}`);
      if (!res.ok) throw new Error("Failed to fetch contributors");
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

export function useContributor(contributorId: string) {
  return useQuery({
    queryKey: ["contributor", contributorId],
    queryFn: async (): Promise<Contributor> => {
      const res = await fetch(`/api/dao/contributors/${contributorId}`);
      if (!res.ok) throw new Error("Failed to fetch contributor");
      return res.json();
    },
    enabled: !!contributorId,
  });
}
