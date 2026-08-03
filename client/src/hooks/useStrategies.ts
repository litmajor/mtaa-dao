import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUserStrategies,
  createStrategy as apiCreateStrategy,
  getStrategy as apiGetStrategy,
  updateStrategy as apiUpdateStrategy,
  deleteStrategy as apiDeleteStrategy,
  deployStrategy as apiDeployStrategy,
  deployCompiledStrategy as apiDeployCompiledStrategy,
  backtestStrategy as apiBacktestStrategy,
  getBacktestJobStatus as apiGetBacktestJobStatus,
  getBacktestJobResult as apiGetBacktestJobResult,
  normalizeBacktestJobResponse,
} from '../api/yukiApi';

type BacktestStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'error';
type BacktestResult = any; // Replace with actual type if known
interface BacktestState {
  jobId: string | null;
  status: BacktestStatus;
  progress: number;
  error: string | null;
  result: any;
  isActive: boolean;
}

export function useStrategies() {
  const qc = useQueryClient();
  const [backtestState, setBacktestState] = useState<BacktestState>({
    jobId: null,
    status: 'idle',
    progress: 0,
    error: null,
    result: null,
    isActive: false,
  });

  const listQuery = useQuery({
    queryKey: ['yukiStrategies'],
    queryFn: async () => {
      const res = await getUserStrategies();
      return res.data;
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (vars: any) => apiCreateStrategy(vars.name, vars.description, vars.blocks),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yukiStrategies'] }),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: any) => apiUpdateStrategy(vars.id, vars.name, vars.description, vars.blocks),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yukiStrategies'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: any) => apiDeleteStrategy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yukiStrategies'] }),
  });

  const deployMutation = useMutation({
    mutationFn: (id: any) => apiDeployStrategy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yukiStrategies'] }),
  });

  const deployCompiledMutation = useMutation({
    mutationFn: (vars: any) => apiDeployCompiledStrategy(vars.compiled, vars.deploymentConfig),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yukiStrategies'] }),
  });

  const backtestMutation = useMutation({
    mutationFn: async (vars: { id: string; startDate: string; endDate: string }) => {
      return apiBacktestStrategy(vars.id, vars.startDate, vars.endDate);
    },
    onSuccess: (job) => {
      setBacktestState({
        jobId: job.jobId || null,
        status: (job.status as BacktestStatus) || 'queued',
        progress: 0,
        error: null,
        result: null,
        isActive: Boolean(job.jobId),
      });
    },
    onError: (error: any) => {
      setBacktestState((prev) => ({
        ...prev,
        status: 'failed',
        error: error?.message || 'Backtest failed',
        isActive: false,
        progress: 0,
      }));
    },
  });

  useEffect(() => {
    if (!backtestState.jobId || !backtestState.isActive) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const [statusRes, resultRes] = await Promise.all([
          apiGetBacktestJobStatus(backtestState.jobId!),
          apiGetBacktestJobResult(backtestState.jobId!),
        ]);

        const statusPayload = statusRes?.data?.data ?? statusRes?.data ?? statusRes;
        const resultPayload = resultRes?.data?.data ?? resultRes?.data ?? resultRes;
        const nextStatus = (statusPayload?.status || 'queued') as BacktestStatus;
        const nextProgress = typeof statusPayload?.progress === 'number' ? statusPayload.progress : 0;
        const nextError = statusPayload?.error || statusPayload?.message || null;

        if (!cancelled) {
          setBacktestState((prev) => ({
            ...prev,
            status: nextStatus,
            progress: nextProgress,
            error: nextError,
            result: nextStatus === 'completed' ? (resultPayload?.result ?? resultPayload?.data?.result ?? null) : prev.result,
            isActive: nextStatus === 'queued' || nextStatus === 'processing',
          }));
        }
      } catch (error: any) {
        if (!cancelled) {
          setBacktestState((prev) => ({
            ...prev,
            status: 'error',
            error: error?.message || 'Unable to fetch backtest status',
            isActive: false,
          }));
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void poll();
    }, 1500);

    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [backtestState.jobId, backtestState.isActive]);

  async function getStrategy(id: string) {
    const res = await apiGetStrategy(id);
    return res.data;
  }

  return {
    strategies: listQuery.data,
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    refetch: listQuery.refetch,
    create: (payload: any) => createMutation.mutate(payload),
    update: (payload: any) => updateMutation.mutate(payload),
    remove: (id: string) => deleteMutation.mutate(id),
    deploy: (id: string) => deployMutation.mutate(id),
    deployCompiled: (compiled: any, config?: any) => deployCompiledMutation.mutate({ compiled, deploymentConfig: config }),
    backtest: (id: string, startDate: string, endDate: string) => backtestMutation.mutateAsync({ id, startDate, endDate }),
    backtestState,
    isBacktestPending: backtestMutation.isPending || backtestState.isActive,
    backtestError: backtestMutation.error,
    resetBacktest: () => setBacktestState({
      jobId: null,
      status: 'idle',
      progress: 0,
      error: null,
      result: null,
      isActive: false,
    }),
    getStrategy,
  };
}

export default useStrategies;
