import { useQuery } from '@tanstack/react-query';
import { API_CONFIG, fetchAPI } from '@/config/apiConfig';

/**
 * Hook to fetch platform overview metrics
 */
export function usePlatformMetrics() {
  return useQuery({
    queryKey: ['platformMetrics'] as const,
    queryFn: () => fetchAPI(API_CONFIG.ENDPOINTS.DASHBOARD_METRICS),
    refetchInterval: 30000,
  });
}

/**
 * Hook to fetch all DAO metrics (for superuser/admin)
 */
export function useAllDaoMetrics() {
  return useQuery({
    queryKey: ['allDaoMetrics'] as const,
    queryFn: () => fetchAPI(API_CONFIG.ENDPOINTS.ELDERS_KAIZEN_ALL),
    refetchInterval: 60000,
  });
}

/**
 * Hook to fetch specific DAO metrics
 */
export function useDaoMetrics(daoId?: string | null) {
  return useQuery({
    queryKey: ['daoMetrics', daoId ?? 'none'] as const,
    queryFn: () => daoId ? fetchAPI(API_CONFIG.ENDPOINTS.ELDERS_KAIZEN_DAO(daoId)) : Promise.resolve(null),
    enabled: !!daoId,
    refetchInterval: 60000,
  });
}

/**
 * Hook to fetch opportunities for a DAO
 */
export function useDaoOpportunities(daoId?: string | null, category?: string) {
  return useQuery({
    queryKey: ['daoOpportunities', daoId ?? 'none', category ?? 'all'] as const,
    queryFn: () => daoId && category ? fetchAPI(API_CONFIG.ENDPOINTS.ELDERS_KAIZEN_OPPORTUNITIES(daoId, category)) : Promise.resolve([]),
    enabled: !!daoId && !!category,
    refetchInterval: 30000,
  });
}

/**
 * Hook to fetch arbitrage opportunities
 */
export function useArbitrageOpportunities(symbol?: string) {
  return useQuery({
    queryKey: ['arbitrage', symbol ?? 'all'] as const,
    queryFn: async () => {
      const endpoint = symbol 
        ? API_CONFIG.ENDPOINTS.ARBITRAGE_ASSET(symbol)
        : API_CONFIG.ENDPOINTS.ARBITRAGE_OPPORTUNITIES;
      return fetchAPI(endpoint);
    },
    refetchInterval: 15000,
  });
}

/**
 * Hook to fetch market data for a trading pair
 */
export function useMarketData(pair?: string) {
  return useQuery({
    queryKey: ['marketData', pair ?? 'none'] as const,
    queryFn: () => pair ? fetchAPI(API_CONFIG.ENDPOINTS.EXCHANGE_PRICES(pair)) : Promise.resolve(null),
    enabled: !!pair,
    refetchInterval: 5000,
  });
}

/**
 * Hook to fetch global crypto metrics
 */
export function useGlobalMetrics() {
  return useQuery({
    queryKey: ['globalMetrics'] as const,
    queryFn: () => fetchAPI(API_CONFIG.ENDPOINTS.GLOBAL_METRICS),
    refetchInterval: 60000,
  });
}

/**
 * Hook to fetch activity logs
 */
export function useActivityLogs(daoId?: string, limit = 50) {
  return useQuery({
    queryKey: ['activityLogs', daoId ?? 'all', limit] as const,
    queryFn: async () => {
      const url = new URL(API_CONFIG.ENDPOINTS.ACTIVITY_LOGS);
      if (daoId) url.searchParams.append('daoId', daoId);
      url.searchParams.append('limit', limit.toString());
      return fetchAPI(url.toString());
    },
    refetchInterval: 10000,
  });
}

/**
 * Hook to fetch list of DAOs user is member of
 */
export function useUserDAOs() {
  return useQuery({
    queryKey: ['userDAOs'] as const,
    queryFn: () => fetchAPI(API_CONFIG.ENDPOINTS.DAO_LIST),
    refetchInterval: 300000,
  });
}

/**
 * Hook to fetch multiple DAO metrics at once
 */
export function useDaoMetricsMultiple(daoIds: string[]) {
  return daoIds.map((daoId: string) =>
    useQuery({
      queryKey: ['daoMetrics', daoId] as const,
      queryFn: () => fetchAPI(API_CONFIG.ENDPOINTS.DAO_METRICS(daoId)),
      refetchInterval: 60000,
    })
  );
}

/**
 * Hook to fetch morio data hub overview (aggregated data)
 */
export function useMorioOverview(daoId?: string) {
  const elders = useQuery({
    queryKey: ['morio', 'elders', daoId ?? 'none'] as const,
    queryFn: () => fetchAPI(API_CONFIG.ENDPOINTS.MORIO_ELDERS),
    refetchInterval: 60000,
  });

  const treasury = useQuery({
    queryKey: ['morio', 'treasury', daoId ?? 'none'] as const,
    queryFn: () => fetchAPI(API_CONFIG.ENDPOINTS.MORIO_TREASURY(daoId)),
    refetchInterval: 60000,
  });

  const governance = useQuery({
    queryKey: ['morio', 'governance', daoId ?? 'none'] as const,
    queryFn: () => fetchAPI(API_CONFIG.ENDPOINTS.MORIO_GOVERNANCE(daoId)),
    refetchInterval: 60000,
  });

  const community = useQuery({
    queryKey: ['morio', 'community', daoId ?? 'none'] as const,
    queryFn: () => fetchAPI(API_CONFIG.ENDPOINTS.MORIO_COMMUNITY(daoId)),
    refetchInterval: 60000,
  });

  return {
    elders,
    treasury,
    governance,
    community,
    isLoading: [elders, treasury, governance, community].some((q: any) => q.isLoading),
    isError: [elders, treasury, governance, community].some((r: any) => r.isError),
  };
}

/**
 * Hook to fetch asset discovery data
 */
export function useAssetDiscovery(search?: string, limit = 100) {
  return useQuery({
    queryKey: ['assetDiscovery', search ?? 'all', limit] as const,
    queryFn: async () => {
      const url = new URL(`${API_CONFIG.BASE_URL}/api/discover/assets`);
      if (search) url.searchParams.append('search', search);
      url.searchParams.append('limit', limit.toString());
      return fetchAPI(url.toString());
    },
    refetchInterval: 300000,
  });
}
