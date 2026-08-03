import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlerts, createAlert as apiCreateAlert, deleteAlert as apiDeleteAlert } from '../api/yukiApi';

export function useAlerts() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['yukiAlerts'],
    queryFn: async () => {
      const res = await getAlerts();
      return res.data;
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: apiCreateAlert,
    onMutate: async (newAlert) => {
      await qc.cancelQueries({ queryKey: ['yukiAlerts'] });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['yukiAlerts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteAlert,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['yukiAlerts'] });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['yukiAlerts'] }),
  });

  return {
    alerts: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    createAlert: (payload: any) => createMutation.mutate(payload),
    deleteAlert: (id: string) => deleteMutation.mutate(id),
  };
}

export default useAlerts;
