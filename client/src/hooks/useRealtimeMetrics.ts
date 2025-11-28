/**
 * useRealtimeMetrics Hook
 * 
 * Usage:
 * const { data, isLoading, error, refresh } = useRealtimeMetrics('vault:vaultId:metrics');
 */

import { useContext, useEffect, useRef, useState } from 'react';
import { RealtimeMetricsContext } from '@/components/analytics/RealtimeMetricsProvider';
import { Logger } from '@/utils/logger';

const logger = new Logger('useRealtimeMetrics');

// ============================================================================
// TYPES
// ============================================================================

export interface UseRealtimeMetricsOptions {
  enabled?: boolean;
  staleTime?: number;      // ms - data is considered stale after this time
  cacheTime?: number;      // ms - keep cache after unmount
  refreshInterval?: number; // ms - auto-refresh interval
  onError?: (error: Error) => void;
  onSuccess?: (data: any) => void;
}

export interface UseRealtimeMetricsResult<T = any> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  isConnected: boolean;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
  subscribe: (handler: (data: T) => void) => () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRealtimeMetrics<T = any>(
  channel: string,
  options: UseRealtimeMetricsOptions = {}
): UseRealtimeMetricsResult<T> {
  const {
    enabled = true,
    staleTime = 10 * 1000,        // 10 seconds
    cacheTime = 5 * 60 * 1000,    // 5 minutes
    refreshInterval,
    onError,
    onSuccess,
  } = options;

  const context = useContext(RealtimeMetricsContext);
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const subscriptionIdRef = useRef<string>('');
  const refreshTimerRef = useRef<NodeJS.Timer>();
  const staleTimerRef = useRef<NodeJS.Timer>();

  if (!context) {
    throw new Error(
      'useRealtimeMetrics must be used within RealtimeMetricsProvider'
    );
  }

  // Subscribe to channel updates
  useEffect(() => {
    if (!enabled || !channel) return;

    const handleUpdate = (newData: T) => {
      try {
        setData(newData);
        setIsLoading(false);
        setError(null);
        setLastUpdate(new Date());
        setIsStale(false);

        // Reset stale timer
        if (staleTimerRef.current) {
          clearTimeout(staleTimerRef.current);
        }
        staleTimerRef.current = setTimeout(() => {
          setIsStale(true);
        }, staleTime);

        onSuccess?.(newData);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    };

    // Try to get cached data first
    const cachedData = context.getCachedData(channel);
    if (cachedData) {
      setData(cachedData);
      setIsLoading(false);
      setLastUpdate(new Date());
    }

    // Subscribe to updates
    subscriptionIdRef.current = context.subscribe(channel, handleUpdate);

    // Setup auto-refresh if specified
    if (refreshInterval) {
      refreshTimerRef.current = setInterval(async () => {
        try {
          await context.refresh(channel);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onError?.(error);
        }
      }, refreshInterval);
    }

    // Cleanup
    return () => {
      if (subscriptionIdRef.current) {
        context.unsubscribe(channel, subscriptionIdRef.current);
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
      }
    };
  }, [channel, enabled, staleTime, refreshInterval, context, onSuccess, onError]);

  const refresh = async () => {
    try {
      setIsLoading(true);
      await context.refresh(channel);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribe = (handler: (data: T) => void) => {
    return context.subscribe(channel, handler);
  };

  return {
    data,
    isLoading,
    isStale,
    error,
    isConnected: context.isConnected,
    lastUpdate,
    refresh,
    subscribe,
  };
}

export default useRealtimeMetrics;
