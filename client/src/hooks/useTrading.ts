import { useState, useCallback, useEffect } from 'react';
import { useTradingAccount } from '../contexts/trading-account-context';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Hook to fetch open orders
 */
export function useOpenOrders(exchange?: string) {
  const { orders, isLoadingOrders, error, refreshOrders } = useTradingAccount();
  
  const filteredOrders = exchange 
    ? orders.filter(o => o.exchange.toLowerCase() === exchange.toLowerCase())
    : orders;

  return {
    orders: filteredOrders,
    loading: isLoadingOrders,
    error,
    refresh: () => refreshOrders(exchange),
  };
}

/**
 * Hook to fetch positions
 */
export function usePositions(exchange?: string) {
  const { positions, isLoadingPositions, error, refreshPositions, metrics } = useTradingAccount();
  
  const filteredPositions = exchange
    ? positions.filter(p => p.exchange.toLowerCase() === exchange.toLowerCase())
    : positions;

  const positionMetrics = {
    totalOpenPositions: filteredPositions.length,
    totalUnrealizedPnl: filteredPositions.reduce((sum, p) => sum + p.pnl, 0),
    averageWinRate: filteredPositions.length > 0
      ? filteredPositions.filter(p => p.pnl > 0).length / filteredPositions.length
      : 0,
    largestPosition: filteredPositions.length > 0
      ? Math.max(...filteredPositions.map(p => Math.abs(p.pnl)))
      : 0,
  };

  return {
    positions: filteredPositions,
    loading: isLoadingPositions,
    error,
    metrics: positionMetrics,
    refresh: () => refreshPositions(exchange),
  };
}

/**
 * Hook to fetch trading metrics
 */
export function useTradingMetrics() {
  const { metrics, isLoadingMetrics, error, refreshMetrics } = useTradingAccount();

  // Mock data if metrics not available
  const defaultMetrics = {
    totalBalance: 0,
    totalUsdValue: 0,
    unrealizedPnl: 0,
    realizedPnl: 0,
    totalPnl: 0,
    winRate: 0,
    trades24h: 0,
    volume24h: 0,
  };

  return {
    metrics: metrics || defaultMetrics,
    loading: isLoadingMetrics,
    error,
    refresh: refreshMetrics,
  };
}

/**
 * Hook to fetch trade history (unified manual + bot + strategy trades)
 */
export function useTradeHistory() {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTradeHistory = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`${API_BASE_URL}/orders/history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trade history');
      }

      const data = await response.json();
      setTrades(data.trades || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch trade history';
      setError(message);
      console.error('Trade history fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTradeHistory();
  }, [fetchTradeHistory]);

  return {
    trades,
    loading,
    error,
    refresh: fetchTradeHistory,
  };
}

/**
 * Hook to place orders
 */
export function usePlaceOrder() {
  const { placeOrder } = useTradingAccount();
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const place = useCallback(
    async (
      exchange: string,
      symbol: string,
      side: 'buy' | 'sell',
      type: 'market' | 'limit',
      amount: number,
      price?: number
    ) => {
      try {
        setIsPlacing(true);
        setError(null);
        const order = await placeOrder(exchange, symbol, side, type, amount, price);
        return order;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to place order';
        setError(message);
        throw err;
      } finally {
        setIsPlacing(false);
      }
    },
    [placeOrder]
  );

  return {
    place,
    isPlacing,
    error,
  };
}

/**
 * Hook to check if user has connected exchanges
 */
export function useHasConnectedExchanges() {
  const { connectedExchanges } = useTradingAccount();
  return connectedExchanges.some(e => e.connected);
}

/**
 * Hook to get all connected exchanges
 */
export function useConnectedExchanges() {
  const { connectedExchanges } = useTradingAccount();
  return connectedExchanges.filter(e => e.connected);
}

/**
 * Hook to fetch account balances
 */
export function useAccountBalances(exchange?: string) {
  const { balances, isLoadingBalances, error, refreshBalances, getTotalUsdValue, getTotalBalance } = useTradingAccount();

  const filteredBalances = exchange
    ? balances.filter(b => b.exchange.toLowerCase() === exchange.toLowerCase())
    : balances;

  return {
    balances: filteredBalances,
    totalBalance: getTotalBalance(),
    totalUsdValue: getTotalUsdValue(),
    loading: isLoadingBalances,
    error,
    refresh: () => refreshBalances(exchange),
  };
}

/**
 * Hook for smart routing (DEX vs CEX comparison)
 */
export function useSmartRouting(symbol: string, amount: number, side: 'buy' | 'sell' = 'buy') {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bestRoute, setBestRoute] = useState<any>(null);

  const fetchRoutes = useCallback(async () => {
    if (!symbol || !amount) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/orders/route`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          amount,
          side,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch routes');
      }

      const data = await response.json();
      setRoutes(data.recommendations || []);
      setBestRoute(data.recommended || null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch routes';
      setError(message);
      console.error('Smart routing error:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, amount, side]);

  useEffect(() => {
    if (symbol && amount > 0) {
      const debounce = setTimeout(fetchRoutes, 500);
      return () => clearTimeout(debounce);
    }
  }, [symbol, amount, side, fetchRoutes]);

  return {
    routes,
    bestRoute,
    loading,
    error,
    refresh: fetchRoutes,
  };
}

/**
 * Hook for order splitting recommendations
 */
export function useOrderSplitting(symbol: string, amount: number, side: 'buy' | 'sell' = 'buy') {
  const [splitRecommendation, setSplitRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSplitting = useCallback(async () => {
    if (!symbol || !amount) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/orders/split`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          amount,
          side,
          maxDEXLiquidity: 0.2, // 20% of order
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch splitting recommendation');
      }

      const data = await response.json();
      setSplitRecommendation(data.data || null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch splitting';
      setError(message);
      console.error('Order splitting error:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, amount, side]);

  useEffect(() => {
    if (symbol && amount > 0) {
      const debounce = setTimeout(fetchSplitting, 500);
      return () => clearTimeout(debounce);
    }
  }, [symbol, amount, side, fetchSplitting]);

  return {
    splitRecommendation,
    loading,
    error,
    refresh: fetchSplitting,
  };
}

/**
 * Hook for best venue analysis
 */
export function useBestVenue(symbol: string, amount: number, side: 'buy' | 'sell' = 'buy') {
  const [bestVenue, setBestVenue] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBestVenue = useCallback(async () => {
    if (!symbol || !amount) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/orders/best-venue?symbol=${symbol}&amount=${amount}&side=${side}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch best venue');
      }

      const data = await response.json();
      setBestVenue(data || null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch best venue';
      setError(message);
      console.error('Best venue error:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, amount, side]);

  useEffect(() => {
    if (symbol && amount > 0) {
      const debounce = setTimeout(fetchBestVenue, 500);
      return () => clearTimeout(debounce);
    }
  }, [symbol, amount, side, fetchBestVenue]);

  return {
    bestVenue,
    loading,
    error,
    refresh: fetchBestVenue,
  };
}
