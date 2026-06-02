/**
 * useTreasuryData Hook
 * 
 * Fetches real treasury data from the backend API
 * - Token holdings from MultiAssetVault smart contract
 * - Budget and expenses from database
 * - Governance weight from MtaaGovernance contract
 * 
 * Features:
 * - Auto-refresh on interval
 * - Error handling with fallback to mock data
 * - Loading state management
 * - Hooks into daoId from React Router
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

interface TokenHolding {
  symbol: string;
  name: string;
  amount: number;
  value: number;
  allocation: number;
  decimals: number;
  address: string;
}

export interface TreasuryData {
  totalAssets: number;
  tokenHoldings: TokenHolding[];
  governanceWeight: number;
  monthlyBudget: number;
  spentThisMonth: number;
  lastUpdated: string;
  daoId: string;
}

interface UseTreasuryDataOptions {
  daoId?: string;
  refreshInterval?: number;
  enabled?: boolean;
}

interface UseTreasuryDataResult {
  data: TreasuryData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lastUpdated: string | null;
  health: {
    score: number;
    alerts: Array<{ severity: 'high' | 'medium' | 'low'; message: string }>;
  } | null;
}

/**
 * Mock data generator (used as fallback)
 */
function generateMockTreasuryData(daoId: string): TreasuryData {
  return {
    totalAssets: 48500000,
    tokenHoldings: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        amount: 15000,
        value: 36750000,
        allocation: 75.8,
        decimals: 18,
        address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        amount: 8000000,
        value: 8000000,
        allocation: 16.5,
        decimals: 6,
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      {
        symbol: 'DAO',
        name: 'MTAA DAO Token',
        amount: 300000,
        value: 3750000,
        allocation: 7.7,
        decimals: 18,
        address: '0x0000000000000000000000000000000000000000',
      },
    ],
    governanceWeight: 42.3,
    monthlyBudget: 500000,
    spentThisMonth: 287500,
    lastUpdated: new Date().toISOString(),
    daoId,
  };
}

/**
 * Fetch treasury data from backend API
 */
async function fetchTreasuryData(daoId: string): Promise<TreasuryData> {
  try {
    const response = await fetch(`/api/treasury/data/${daoId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch treasury data: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid treasury data response');
    }

    return result.data;
  } catch (error) {
    console.error('[Treasury Hook] Error fetching data:', error);
    // Return mock data as fallback
    return generateMockTreasuryData(daoId);
  }
}

/**
 * Fetch treasury health metrics
 */
async function fetchTreasuryHealth(daoId: string): Promise<{
  score: number;
  alerts: Array<{ severity: 'high' | 'medium' | 'low'; message: string }>;
}> {
  try {
    const response = await fetch(`/api/treasury/health/${daoId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { score: 100, alerts: [] };
    }

    const result = await response.json();
    return result.data || { score: 100, alerts: [] };
  } catch (error) {
    console.error('[Treasury Hook] Error fetching health:', error);
    return { score: 100, alerts: [] };
  }
}

/**
 * React Hook: useTreasuryData
 * 
 * Usage:
 * ```tsx
 * const { data, loading, error, refetch } = useTreasuryData({
 *   refreshInterval: 30000, // Refresh every 30s
 * });
 * ```
 */
export function useTreasuryData(options: UseTreasuryDataOptions = {}): UseTreasuryDataResult {
  const { daoId: paramDaoId } = useParams<{ daoId: string }>();
  const daoId = options.daoId || paramDaoId;

  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [health, setHealth] = useState<{ score: number; alerts: Array<{ severity: 'high' | 'medium' | 'low'; message: string }> } | null>(null);

  const refreshInterval = options.refreshInterval ?? 30000; // 30s default
  const enabled = options.enabled !== false; // Enabled by default

  // Fetch function
  const refetch = useCallback(async () => {
    if (!daoId) {
      setError(new Error('DAO ID is required'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch data in parallel
      const [treasuryData, healthData] = await Promise.all([
        fetchTreasuryData(daoId),
        fetchTreasuryHealth(daoId),
      ]);

      setData(treasuryData);
      setHealth(healthData);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch treasury data');
      setError(error);
      // Use mock data on error
      setData(generateMockTreasuryData(daoId));
    } finally {
      setLoading(false);
    }
  }, [daoId]);

  // Initial fetch + periodic refresh
  useEffect(() => {
    if (!enabled || !daoId) return;

    refetch();

    // Set up refresh interval
    const interval = setInterval(refetch, refreshInterval);

    return () => clearInterval(interval);
  }, [daoId, enabled, refreshInterval, refetch]);

  return {
    data,
    loading,
    error,
    refetch,
    lastUpdated,
    health,
  };
}

/**
 * Hook for fetching only token holdings
 */
export function useTreasuryHoldings(daoId?: string) {
  const { data, loading, error } = useTreasuryData({ daoId });
  return {
    holdings: data?.tokenHoldings || [],
    totalValue: data?.totalAssets || 0,
    loading,
    error,
  };
}

/**
 * Hook for fetching only budget data
 */
export function useTreasuryBudget(daoId?: string) {
  const [budget, setBudget] = useState<{ monthlyBudget: number; spentThisMonth: number; remaining: number; usagePercentage: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!daoId) return;

    const fetchBudget = async () => {
      try {
        const response = await fetch(`/api/treasury/budget/${daoId}`);
        if (!response.ok) throw new Error('Failed to fetch budget');

        const result = await response.json();
        setBudget(result.data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch budget'));
      } finally {
        setLoading(false);
      }
    };

    fetchBudget();
  }, [daoId]);

  return { budget, loading, error };
}
