import { useQuery } from '@tanstack/react-query';
import { getPortfolio } from '../api/yukiApi';
import { useYukiStore } from '../stores/useYukiStore';
import { useEffect } from 'react';

export function usePortfolio() {
  const setPortfolioTotals = useYukiStore((state) => state.setPortfolioTotals);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['yukiPortfolio'],
    queryFn: async () => {
      const response = await getPortfolio();
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  useEffect(() => {
    if (data) {
      setPortfolioTotals({
        totalValueUsd: data.totalValueUsd || '0',
        totalStakedUsd: data.totalStakedUsd || '0',
        totalAvailableUsd: data.totalAvailableUsd || '0',
      });
    }
  }, [data, setPortfolioTotals]);

  return {
    portfolio: data,
    isLoading,
    error,
    refetch,
  };
}
