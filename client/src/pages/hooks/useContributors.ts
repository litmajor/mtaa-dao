// hooks/useContributors.ts

import { useQuery } from "@tanstack/react-query";

export function useContributors() {
  return useQuery({
    queryKey: ["dao", "contributors"],
    queryFn: async () => {
      const res = await fetch("/api/dao/contributors");
      if (!res.ok) throw new Error("Failed to fetch contributors");
      return res.json();
    },
  });
}
