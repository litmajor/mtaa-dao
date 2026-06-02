import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './auth-context';
import {authClient} from '../utils/authClient';

/**
 * Trading Account Context
 * Manages user trading account state, positions, and operations
 * Connected to exchange accounts via CCXT
 */

export interface TradePosition {
  id: string;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  leverage?: number;
  liquidationPrice?: number;
  // Optional canonical unrealized PnL value (some providers use different keys)
  unrealizedPnl?: number;
  openedAt: string;
  status: 'open' | 'closing' | 'closed';
}

export interface TradingOrder {
  id: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: number;
  filledAmount: number;
  price?: number;
  averagePrice: number;
  fee: number;
  status: 'pending' | 'filled' | 'canceled' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeBalance {
  exchange: string;
  asset: string;
  free: number;
  used: number;
  total: number;
  usdValue?: number;
}

export interface TradingMetrics {
  totalBalance: number;
  totalUsed: number;
  totalFree: number;
  totalUsdValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  winRate: number;
  trades24h: number;
  volume24h: number;
}

export interface ConnectedExchange {
  name: string;
  connected: boolean;
  lastSync?: string;
  error?: string;
}

export interface TradingAccountContextType {
  // State
  userId: string | null;
  connectedExchanges: ConnectedExchange[];
  balances: ExchangeBalance[];
  positions: TradePosition[];
  orders: TradingOrder[];
  metrics: TradingMetrics | null;
  
  // Loading states
  isLoading: boolean;
  isLoadingPositions: boolean;
  isLoadingOrders: boolean;
  isLoadingBalances: boolean;
  isLoadingMetrics: boolean;
  
  // Errors
  error: string | null;
  
  // Actions
  connectExchange: (exchangeName: string, credentials: any) => Promise<void>;
  disconnectExchange: (exchangeName: string) => Promise<void>;
  refreshBalances: (exchange?: string) => Promise<void>;
  refreshPositions: (exchange?: string) => Promise<void>;
  refreshOrders: (exchange?: string) => Promise<void>;
  refreshMetrics: () => Promise<void>;
  
  // Trading operations
  placeOrder: (exchange: string, symbol: string, side: 'buy' | 'sell', type: 'market' | 'limit', amount: number, price?: number) => Promise<TradingOrder>;
  cancelOrder: (exchange: string, orderId: string) => Promise<void>;
  closePosition: (exchange: string, positionId: string) => Promise<void>;
  
  // Utilities
  getTotalBalance: () => number;
  getTotalUsdValue: () => number;
  getExchangeBalance: (exchange: string) => ExchangeBalance | null;
}

const TradingAccountContext = createContext<TradingAccountContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function TradingAccountProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || null;
  
  // State
  const [connectedExchanges, setConnectedExchanges] = useState<ConnectedExchange[]>([]);
  const [balances, setBalances] = useState<ExchangeBalance[]>([]);
  const [positions, setPositions] = useState<TradePosition[]>([]);
  const [orders, setOrders] = useState<TradingOrder[]>([]);
  const [metrics, setMetrics] = useState<TradingMetrics | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API helper function
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const method = (options.method || 'GET').toUpperCase();

    // Helper to parse stringified JSON body if present
    const parseBody = (body?: any) => {
      if (!body) return undefined;
      if (typeof body === 'string') {
        try {
          return JSON.parse(body);
        } catch (e) {
          return body;
        }
      }
      return body;
    };

    try {
      if (method === 'GET') {
        return await authClient.get(endpoint, options as RequestInit);
      }

      if (method === 'POST') {
        const body = parseBody(options.body);
        return await authClient.post(endpoint, body, options as RequestInit);
      }

      if (method === 'PUT') {
        const body = parseBody(options.body);
        return await authClient.put(endpoint, body, options as RequestInit);
      }

      if (method === 'PATCH') {
        const body = parseBody(options.body);
        return await authClient.patch(endpoint, body, options as RequestInit);
      }

      if (method === 'DELETE') {
        return await authClient.delete(endpoint, options as RequestInit);
      }

      // Fallback to raw fetch when needed
      const resp = await authClient.fetch(endpoint, options as RequestInit);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error?.message || resp.statusText);
      }
      return await resp.json();
    } catch (err) {
      throw err;
    }
  };

  /* Normalizers - canonicalize provider responses into local shapes */
  const normalizePosition = (p: any): TradePosition => {
    return {
      id: p.id || p.positionId || p._id || `${p.exchange || 'ex'}:${p.symbol || p.market?.symbol || 'x'}`,
      exchange: p.exchange || p.market?.exchange || 'unknown',
      symbol: p.symbol || p.market?.symbol || p.ticker || '',
      side: (p.side || p.direction || 'long') as 'long' | 'short',
      amount: Number(p.amount ?? p.size ?? 0),
      entryPrice: Number(p.entryPrice ?? p.openPrice ?? p.price ?? 0),
      currentPrice: Number(p.currentPrice ?? p.markPrice ?? p.price ?? 0),
      pnl: Number(p.pnl ?? p.profit ?? 0),
      pnlPercent: Number(p.pnlPercent ?? p.profitPercent ?? 0),
      leverage: p.leverage ?? p.margin ?? undefined,
      liquidationPrice: p.liquidationPrice ?? p.liqPrice ?? undefined,
      unrealizedPnl: Number(p.unrealizedPnl ?? p.unrealizedPnL ?? p.unrealized ?? 0),
      openedAt: p.openedAt || p.openTime || p.createdAt || new Date().toISOString(),
      status: (p.status || (p.closed ? 'closed' : 'open')) as 'open' | 'closing' | 'closed',
    };
  };

  const normalizeBalance = (b: any): ExchangeBalance => ({
    exchange: b.exchange || b.provider || 'unknown',
    asset: b.asset || b.currency || 'USD',
    free: Number(b.free ?? b.available ?? 0),
    used: Number(b.used ?? b.locked ?? 0),
    total: Number(b.total ?? b.balance ?? (Number(b.free ?? 0) + Number(b.used ?? 0))),
    usdValue: Number(b.usdValue ?? b.usd_value ?? b.value ?? 0),
  });

  const normalizeMetrics = (m: any): TradingMetrics => ({
    totalBalance: Number(m?.totalBalance ?? m?.total_balance ?? m?.balance_total ?? 0),
    totalUsed: Number(m?.totalUsed ?? m?.used_total ?? 0),
    totalFree: Number(m?.totalFree ?? m?.free_total ?? 0),
    totalUsdValue: Number(m?.totalUsdValue ?? m?.usd_total ?? 0),
    unrealizedPnl: Number(m?.unrealizedPnl ?? m?.unrealized ?? 0),
    realizedPnl: Number(m?.realizedPnl ?? m?.realized ?? 0),
    totalPnl: Number(m?.totalPnl ?? m?.total_pnl ?? 0),
    winRate: Number(m?.winRate ?? m?.win_rate ?? 0),
    trades24h: Number(m?.trades24h ?? m?.trades_24h ?? 0),
    volume24h: Number(m?.volume24h ?? m?.volume_24h ?? 0),
  });

  /**
   * Get connected exchanges
   */
  const loadConnectedExchanges = useCallback(async () => {
    if (!isAuthenticated || !userId) return;

    try {
      const data = await apiCall('/user/exchange-credentials');
      setConnectedExchanges(data.exchanges || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load exchanges';
      setError(message);
      console.error('Failed to load connected exchanges:', err);
    }
  }, [isAuthenticated, userId]);

  /**
   * Connect exchange account
   */
  const connectExchange = useCallback(async (exchangeName: string, credentials: any) => {
    if (!isAuthenticated || !userId) return;

    try {
      setIsLoading(true);
      await apiCall('/user/exchange-credentials', {
        method: 'POST',
        body: JSON.stringify({
          exchange: exchangeName,
          ...credentials,
        }),
      });
      
      await loadConnectedExchanges();
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect exchange';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userId, loadConnectedExchanges]);

  /**
   * Disconnect exchange account
   */
  const disconnectExchange = useCallback(async (exchangeName: string) => {
    if (!isAuthenticated || !userId) return;

    try {
      setIsLoading(true);
      await apiCall(`/user/exchange-credentials/${exchangeName}`, {
        method: 'DELETE',
      });
      
      await loadConnectedExchanges();
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect exchange';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userId, loadConnectedExchanges]);

  /**
   * Refresh account balances
   */
  const refreshBalances = useCallback(async (exchange?: string) => {
    if (!isAuthenticated || !userId) return;

    try {
      setIsLoadingBalances(true);
      const query = exchange ? `?exchange=${exchange}` : '';
      const data = await apiCall(`/exchanges/balances${query}`);
        setBalances((data.balances || []).map(normalizeBalance));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh balances';
      setError(message);
      console.error('Failed to refresh balances:', err);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [isAuthenticated, userId]);

  /**
   * Refresh open positions
   */
  const refreshPositions = useCallback(async (exchange?: string) => {
    if (!isAuthenticated || !userId) return;

    try {
      setIsLoadingPositions(true);
      const query = exchange ? `?exchange=${exchange}` : '';
      const data = await apiCall(`/orders/positions${query}`);
        setPositions((data.positions || []).map(normalizePosition));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh positions';
      setError(message);
      console.error('Failed to refresh positions:', err);
    } finally {
      setIsLoadingPositions(false);
    }
  }, [isAuthenticated, userId]);

  /**
   * Refresh open orders
   */
  const refreshOrders = useCallback(async (exchange?: string) => {
    if (!isAuthenticated || !userId) return;

    try {
      setIsLoadingOrders(true);
      const query = exchange ? `?exchange=${exchange}` : '';
      const data = await apiCall(`/exchanges/orders${query}`);
        setOrders(data.orders || []); // No change needed here
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh orders';
      setError(message);
      console.error('Failed to refresh orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [isAuthenticated, userId]);

  /**
   * Refresh trading metrics
   */
  const refreshMetrics = useCallback(async () => {
    if (!isAuthenticated || !userId) return;

    try {
      setIsLoadingMetrics(true);
      const data = await apiCall('/orders/metrics');
        setMetrics(data.metrics ? normalizeMetrics(data.metrics) : null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh metrics';
      setError(message);
      console.error('Failed to refresh metrics:', err);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [isAuthenticated, userId]);

  /**
   * Place market or limit order
   */
  const placeOrder = useCallback(
    async (
      exchange: string,
      symbol: string,
      side: 'buy' | 'sell',
      type: 'market' | 'limit',
      amount: number,
      price?: number
    ): Promise<TradingOrder> => {
      if (!isAuthenticated || !userId) {
        throw new Error('Not authenticated');
      }

      try {
        const payload: any = {
          exchange,
          symbol,
          side,
          type,
          amount,
        };

        if (type === 'limit' && price) {
          payload.price = price;
        }

        const data = await apiCall('/exchanges/order', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        // Refresh orders after placing
        await refreshOrders(exchange);
        setError(null);

        return data.order;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to place order';
        setError(message);
        throw err;
      }
    },
    [isAuthenticated, userId, refreshOrders]
  );

  /**
   * Cancel order
   */
  const cancelOrder = useCallback(
    async (exchange: string, orderId: string) => {
      if (!isAuthenticated || !userId) {
        throw new Error('Not authenticated');
      }

      try {
        await apiCall('/exchanges/cancel-order', {
          method: 'POST',
          body: JSON.stringify({
            exchange,
            orderId,
          }),
        });

        // Refresh orders after canceling
        await refreshOrders(exchange);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to cancel order';
        setError(message);
        throw err;
      }
    },
    [isAuthenticated, userId, refreshOrders]
  );

  /**
   * Close position
   */
  const closePosition = useCallback(
    async (exchange: string, positionId: string) => {
      if (!isAuthenticated || !userId) {
        throw new Error('Not authenticated');
      }

      try {
        await apiCall('/orders/close-position', {
          method: 'POST',
          body: JSON.stringify({
            exchange,
            positionId,
          }),
        });

        // Refresh positions after closing
        await refreshPositions(exchange);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to close position';
        setError(message);
        throw err;
      }
    },
    [isAuthenticated, userId, refreshPositions]
  );

  /**
   * Get total balance across all exchanges
   */
  const getTotalBalance = useCallback(() => {
    return balances.reduce((sum, balance) => sum + balance.total, 0);
  }, [balances]);

  /**
   * Get total USD value
   */
  const getTotalUsdValue = useCallback(() => {
    return balances.reduce((sum, balance) => sum + (balance.usdValue || 0), 0);
  }, [balances]);

  /**
   * Get balance for specific exchange
   */
  const getExchangeBalance = useCallback(
    (exchange: string): ExchangeBalance | null => {
      return balances.find((b) => b.exchange.toLowerCase() === exchange.toLowerCase()) || null;
    },
    [balances]
  );

  // Initialize on mount
  useEffect(() => {
    if (isAuthenticated && userId) {
      loadConnectedExchanges();
      refreshBalances();
      refreshPositions();
      refreshOrders();
      refreshMetrics();

      // Set up polling every 30 seconds
      const interval = setInterval(() => {
        refreshBalances();
        refreshPositions();
        refreshOrders();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, userId]);

  const value: TradingAccountContextType = {
    userId,
    connectedExchanges,
    balances,
    positions,
    orders,
    metrics,
    isLoading,
    isLoadingPositions,
    isLoadingOrders,
    isLoadingBalances,
    isLoadingMetrics,
    error,
    connectExchange,
    disconnectExchange,
    refreshBalances,
    refreshPositions,
    refreshOrders,
    refreshMetrics,
    placeOrder,
    cancelOrder,
    closePosition,
    getTotalBalance,
    getTotalUsdValue,
    getExchangeBalance,
  };

  return (
    <TradingAccountContext.Provider value={value}>
      {children}
    </TradingAccountContext.Provider>
  );
}

/**
 * Hook to use trading account context
 */
export function useTradingAccount(): TradingAccountContextType {
  const context = useContext(TradingAccountContext);
  if (!context) {
    throw new Error('useTradingAccount must be used within TradingAccountProvider');
  }
  return context;
}

/**
 * Hook to check if has connected exchanges
 */
export function useHasConnectedExchanges(): boolean {
  const { connectedExchanges } = useTradingAccount();
  return connectedExchanges.some((e) => e.connected);
}

/**
 * Hook to get specific exchange
 */
export function useExchange(name: string): ConnectedExchange | null {
  const { connectedExchanges } = useTradingAccount();
  return connectedExchanges.find((e) => e.name.toLowerCase() === name.toLowerCase()) || null;
}
