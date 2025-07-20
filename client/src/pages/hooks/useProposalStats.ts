
import { useQuery } from "@tanstack/react-query";

type ProposalStats = {
  total: number;
  active: number;
  resolved: number;
  expired: number;
};

export function useProposalStats() {
  return useQuery<ProposalStats>({
    queryKey: ["dao", "proposalStats"],
    queryFn: async () => {
      const res = await fetch("/api/dao/proposals/stats");
      if (!res.ok) throw new Error("Failed to fetch proposal stats");
      return res.json();
    },
  });
}
