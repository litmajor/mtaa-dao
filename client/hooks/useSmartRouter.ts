/**
 * useSmartRouter Hook
 * Smart order routing with real-time fee comparison and best execution
 * Analyzes liquidity, slippage, and fees across all connected exchanges
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

export type Route = { from: string; to: string; steps: Array<{ exchange: string; amountIn: string }> }
export type Order = { id?: string; market: string; side: 'buy' | 'sell'; amount: string; price?: string }

interface RoutingPath {
  exchange: string;
  makerFee: number;
  takerFee: number;
  feePercent: number;
  liquidity: number;
  slippage: number;
  availableForOrder: boolean;
  orderValue: number;
  feeAmount: number;
  slippageAmount: number;
  totalCost: number;
  alternativeRoutes?: Route[];
}

interface RoutingAnalysis {
  bestPath: RoutingPath;
  paths: RoutingPath[];
  savings: number;
  savingsPercent: number;
}

interface LiquidityData {
  exchanges: Array<{
    exchange: string;
    depth: number;
  }>;
  avgDepth: number;
  maxDepth: number;
}

interface SlippageData {
  estimated: number;
  bestCase: number;
  worstCase: number;
  warning?: string;
}

interface FeeData {
  exchange: string;
  makerFee: number;
  takerFee: number;
  savingsPercent: number;
}

/**
 * Main smart routing hook
 * Analyzes all exchanges to find the best execution path
 */
export function useSmartRouting(pair: string, quantity: number, side: 'BUY' | 'SELL') {
  const [routing, setRouting] = useState<RoutingAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const analyzeRouting = async () => {
      if (!pair || !quantity) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/smart-route', {
          pair,
          quantity,
          side,
        });

        if (response.success) {
          setRouting(response.data as RoutingAnalysis);
        } else {
          setError(response.error || 'Failed to analyze routing');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Error analyzing routing');
      } finally {
        setLoading(false);
      }
    };

    analyzeRouting();
  }, [pair, quantity, side]);

  return { routing, loading, error };
}

/**
 * Hook for real-time exchange quotes
 */
export function useExchangeQuotes(pair: string, quantity: number, side: 'BUY' | 'SELL') {
  const [quotes, setQuotes] = useState<RoutingPath[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!pair || !quantity) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/quotes', {
          pair,
          quantity,
          side,
        });

        if (response.success) {
          setQuotes(response.data as RoutingPath[]);
        } else {
          setError(response.error || 'Failed to fetch quotes');
        }
        } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Error fetching quotes');
      } finally {
        setLoading(false);
      }
    };

    fetchQuotes();
  }, [pair, quantity, side]);

  return { quotes, loading, error };
}

/**
 * Hook for fee comparison across exchanges
 */
export function useFeeComparison() {
  const [fees, setFees] = useState<FeeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFees = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get('/api/trading/fees');

        if (response.success) {
          setFees(response.data as FeeData[]);
        } else {
          setError(response.error || 'Failed to fetch fees');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Error fetching fees');
      } finally {
        setLoading(false);
      }
    };

    fetchFees();
  }, []);

  return { fees, loading, error };
}

/**
 * Hook to calculate savings with smart routing
 */
export function useSavingsBySmartRouting(pair: string, quantity: number, side: 'BUY' | 'SELL') {
  const [savings, setSavings] = useState(0);
  const [savingsPercent, setSavingsPercent] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const calculateSavings = async () => {
      if (!pair || !quantity) return;

      setLoading(true);

      try {
        const response = await apiClient.post('/api/trading/savings', {
          pair,
          quantity,
          side,
        });

        if (response.success && response.data && typeof response.data === 'object') {
          const d = response.data as Record<string, unknown>;
          setSavings(Number(d.savings ?? 0));
          setSavingsPercent(Number(d.savingsPercent ?? 0));
        }
      } catch (err: unknown) {
        console.error('Error calculating savings:', err);
      } finally {
        setLoading(false);
      }
    };

    calculateSavings();
  }, [pair, quantity, side]);

  return { savings, savingsPercent, loading };
}

/**
 * Hook for liquidity analysis across exchanges
 */
export function useLiquidityAnalysis(pair: string) {
  const [liquidity, setLiquidity] = useState<LiquidityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const analyzeLiquidity = async () => {
      if (!pair) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/liquidity', {
          pair,
        });

        if (response.success) {
          setLiquidity(response.data as LiquidityData);
        } else {
          setError(response.error || 'Failed to analyze liquidity');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Error analyzing liquidity');
      } finally {
        setLoading(false);
      }
    };

    analyzeLiquidity();
  }, [pair]);

  return { liquidity, loading, error };
}

/**
 * Hook for slippage estimation
 */
export function useSlippageCalculation(pair: string, quantity: number, side: 'BUY' | 'SELL') {
  const [slippage, setSlippage] = useState<SlippageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculateSlippage = async () => {
      if (!pair || !quantity) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/slippage', {
          pair,
          quantity,
          side,
        });

        if (response.success) {
          setSlippage(response.data as SlippageData);
        } else {
          setError(response.error || 'Failed to calculate slippage');
        }
        } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Error calculating slippage');
      } finally {
        setLoading(false);
      }
    };

    calculateSlippage();
  }, [pair, quantity, side]);

  return { slippage, loading, error };
}

/**
 * Hook to find best exchange for a given pair
 */
export function useBestExchange(pair: string, quantity: number, side: 'BUY' | 'SELL') {
  const [bestExchange, setBestExchange] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const findBest = async () => {
      if (!pair || !quantity) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/best-exchange', {
          pair,
          quantity,
          side,
        });

        if (response.success && response.data && typeof response.data === 'object') {
          const d = response.data as Record<string, unknown>;
          setBestExchange((d.exchange as string) || null);
        } else {
          setError(response.error || 'Failed to find best exchange');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Error finding best exchange');
      } finally {
        setLoading(false);
      }
    };

    findBest();
  }, [pair, quantity, side]);

  return { bestExchange, loading, error };
}

/**
 * Hook to analyze arbitrage opportunities
 */
export function useArbitrageAnalysis(pair: string) {
  const [opportunities, setOpportunities] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeArbitrage = useCallback(async () => {
    if (!pair) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/trading/arbitrage', {
        pair,
      });

        if (response.success && response.data && typeof response.data === 'object') {
          const d = response.data as Record<string, unknown>;
          setOpportunities((d.opportunities as Array<Record<string, unknown>> | undefined) || []);
        } else {
          setError(response.error || 'Failed to analyze arbitrage');
        }
      } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Error analyzing arbitrage');
    } finally {
      setLoading(false);
    }
  }, [pair]);

  useEffect(() => {
    analyzeArbitrage();
  }, [analyzeArbitrage]);

  return { opportunities, loading, error, refresh: analyzeArbitrage };
}

/**
 * Hook for multi-leg routing (splitting orders across exchanges)
 */
export function useMultiLegRouting(pair: string, quantity: number, side: 'BUY' | 'SELL') {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculateRoutes = async () => {
      if (!pair || !quantity) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/multi-leg-routes', {
          pair,
          quantity,
          side,
        });

        if (response.success && response.data && typeof response.data === 'object') {
          const d = response.data as Record<string, unknown>;
          setRoutes((d.routes as Route[] | undefined) || []);
        } else {
          setError(response.error || 'Failed to calculate multi-leg routes');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Error calculating multi-leg routes');
      } finally {
        setLoading(false);
      }
    };

    calculateRoutes();
  }, [pair, quantity, side]);

  return { routes, loading, error };
}

/**
 * Hook to get execution recommendation
 */
export function useExecutionRecommendation(pair: string, quantity: number, side: 'BUY' | 'SELL') {
  const [recommendation, setRecommendation] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getRecommendation = async () => {
      if (!pair || !quantity) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post('/api/trading/execution-recommendation', {
          pair,
          quantity,
          side,
        });

        if (response.success && response.data && typeof response.data === 'object') {
          setRecommendation(response.data as Record<string, unknown>);
        } else {
          setError(response.error || 'Failed to get recommendation');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Error getting recommendation');
      } finally {
        setLoading(false);
      }
    };

    getRecommendation();
  }, [pair, quantity, side]);

  return { recommendation, loading, error };
}
