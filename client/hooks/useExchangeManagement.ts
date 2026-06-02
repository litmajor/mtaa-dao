/**
 * useExchangeManagement Hook
 * Manage exchange connections and API keys
 * Integrated with backend API for secure storage
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { exchangeApi } from '../lib/apiClient';

export interface ExchangeConnection {
  id: string;
  exchange: string;
  apiKey: string;
  apiSecret: string;
  connected: boolean;
  lastSyncTime: string;
  balances?: Record<string, number>;
  accountInfo?: any;
}

/**
 * Hook: Get all connected exchanges
 */
export function useExchanges() {
  const [exchanges, setExchanges] = useState<ExchangeConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExchanges = useCallback(async () => {
    try {
      setLoading(true);
      const response = await exchangeApi.getExchanges();
      if (response.success && response.data) {
        setExchanges(response.data as ExchangeConnection[]);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch exchanges');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  return { exchanges, loading, error, refetch: fetchExchanges };
}

/**
 * Hook: Add new exchange connection
 */
export function useAddExchange() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addExchange = useCallback(async (exchangeData: any) => {
    try {
      setLoading(true);
      const response = await exchangeApi.addExchange(exchangeData);
      if (response.success) {
        setError(null);
        return { success: true, data: response.data };
      } else {
        setError(response.error || 'Failed to add exchange');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { addExchange, loading, error };
}

/**
 * Hook: Test exchange connection before saving
 */
export function useTestExchange() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testConnection = useCallback(async (exchangeData: any) => {
    try {
      setLoading(true);
      const response = await exchangeApi.testExchange(exchangeData);
      if (response.success) {
        setError(null);
        return { success: true, data: response.data };
      } else {
        setError(response.error || 'Connection test failed');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { testConnection, loading, error };
}

/**
 * Hook: Update exchange connection
 */
export function useUpdateExchange() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateExchange = useCallback(async (exchangeId: string, data: any) => {
    try {
      setLoading(true);
      const response = await exchangeApi.updateExchange(exchangeId, data);
      if (response.success) {
        setError(null);
        return { success: true };
      } else {
        setError(response.error || 'Failed to update exchange');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateExchange, loading, error };
}

/**
 * Hook: Delete exchange connection
 */
export function useDeleteExchange() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteExchange = useCallback(async (exchangeId: string) => {
    try {
      setLoading(true);
      const response = await exchangeApi.deleteExchange(exchangeId);
      if (response.success) {
        setError(null);
        return { success: true };
      } else {
        setError(response.error || 'Failed to delete exchange');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteExchange, loading, error };
}

/**
 * Hook: Sync exchange data (balances, prices, etc)
 */
export function useSyncExchange() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncExchange = useCallback(async (exchangeId: string) => {
    try {
      setLoading(true);
      const response = await exchangeApi.syncExchange(exchangeId);
      if (response.success) {
        setError(null);
        return { success: true, data: response.data };
      } else {
        setError(response.error || 'Failed to sync exchange');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { syncExchange, loading, error };
}

/**
 * Hook: Get exchange by ID
 */
export function useExchange(exchangeId: string) {
  const [exchange, setExchange] = useState<ExchangeConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExchange = useCallback(async () => {
    try {
      setLoading(true);
      const response = await exchangeApi.getExchange(exchangeId);
      if (response.success && response.data) {
        setExchange(response.data as ExchangeConnection);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch exchange');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [exchangeId]);

  useEffect(() => {
    if (exchangeId) {
      fetchExchange();
    }
  }, [exchangeId, fetchExchange]);

  return { exchange, loading, error, refetch: fetchExchange };
}

/**
 * Hook: Get connected exchange count
 */
export function useConnectedExchangeCount() {
  const { exchanges } = useExchanges();
  return exchanges.filter((e) => e.connected).length;
}

/**
 * Hook: Get total balances across all exchanges
 */
export function useTotalBalances() {
  const { exchanges } = useExchanges();

  const totals: Record<string, number> = {};
  exchanges.forEach((exchange) => {
    if (exchange.balances) {
      Object.entries(exchange.balances).forEach(([asset, balance]) => {
        totals[asset] = (totals[asset] || 0) + balance;
      });
    }
  });

  return totals;
}
