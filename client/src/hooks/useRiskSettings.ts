import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRiskSettings, updateRiskSettings } from '../api/yukiApi';

export function useRiskSettings() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['yukiRiskSettings'],
    queryFn: async () => {
      const res = await getRiskSettings();
      return res.data;
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (patch: any) => updateRiskSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yukiRiskSettings'] }),
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    isSaving: (mutation as any).isPending ?? false,
    refetch: query.refetch,
    update: (patch: any) => mutation.mutate(patch),
  };
}

export default useRiskSettings;
