/**
 * Custom Hook: useExchangeData
 * 
 * Manages exchange, asset, and price data for the Exchange Markets page.
 * Encapsulates API calls and query logic.
 */

import { useQuery } from '@tanstack/react-query';

/**
 * Fetch exchange status and available exchanges
 */
export const useExchangeStatus = () => {
  return useQuery({
    queryKey: ['exchange-status'],
    queryFn: async () => {
      const response = await fetch('/api/exchanges/status');
      if (!response.ok) throw new Error('Failed to fetch exchange status');
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    retry: 1,
  } as any);
};

/**
 * Fetch available assets for an exchange
 */
export const useExchangeAssets = (exchangeName: string | null) => {
  return useQuery({
    queryKey: ['exchange-assets', exchangeName],
    queryFn: async () => {
      if (!exchangeName) return [];
      const response = await fetch(`/api/exchanges/assets?exchange=${exchangeName}`);
      if (!response.ok) throw new Error(`Failed to fetch assets for ${exchangeName}`);
      const data = await response.json();
      return data.assets || [];
    },
    staleTime: 3600000, // 1 hour (assets don't change often)
    retry: 1,
    enabled: !!exchangeName,
  } as any);
};

/**
 * Fetch prices for a symbol across multiple exchanges
 */
export const usePrices = (symbol: string | null, exchanges: string[]) => {
  return useQuery({
    queryKey: ['prices', symbol, exchanges.join(',')],
    queryFn: async () => {
      if (!symbol || exchanges.length === 0) return null;
      const exchangesParam = exchanges.join(',');
      const response = await fetch(
        `/api/exchanges/prices?symbol=${encodeURIComponent(symbol)}&exchanges=${exchangesParam}`
      );
      if (!response.ok) throw new Error('Failed to fetch prices');
      return response.json();
    },
    staleTime: 30000, // 30 seconds (prices update frequently)
    retry: 1,
    refetchInterval: 30000, // Auto-refresh prices
    enabled: !!symbol && exchanges.length > 0,
  } as any);
};

/**
 * Fetch best price across exchanges
 */
export const useBestPrice = (symbol: string | null, exchanges: string[]) => {
  return useQuery({
    queryKey: ['best-price', symbol, exchanges.join(',')],
    queryFn: async () => {
      if (!symbol || exchanges.length === 0) return null;
      const exchangesParam = exchanges.join(',');
      const response = await fetch(
        `/api/exchanges/best-price?symbol=${encodeURIComponent(symbol)}&exchanges=${exchangesParam}`
      );
      if (!response.ok) throw new Error('Failed to fetch best price');
      return response.json();
    },
    staleTime: 30000,
    retry: 1,
    refetchInterval: 30000, // Auto-refresh
    enabled: !!symbol && exchanges.length > 0,
  } as any);
};

/**
 * Fetch OHLCV (candlestick) data for an asset
 * (Prepared for future use in Phase 2/3)
 */
export const useOHLCV = (
  exchange: string | null,
  symbol: string | null,
  timeframe: string = '1h'
) => {
  return useQuery({
    queryKey: ['ohlcv', exchange, symbol, timeframe],
    queryFn: async () => {
      if (!exchange || !symbol) return null;
      const response = await fetch(
        `/api/exchanges/ohlcv?exchange=${exchange}&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
      );
      if (!response.ok) throw new Error('Failed to fetch OHLCV data');
      return response.json();
    },
    staleTime: 60000, // 1 minute
    retry: 1,
    enabled: !!exchange && !!symbol,
  } as any);
};

/**
 * Phase 2 Hook: Fetch user balance on an exchange
 * (Requires authentication and stored API keys)
 */
export const useExchangeBalance = (exchange: string | null) => {
  return useQuery({
    queryKey: ['exchange-balance', exchange],
    queryFn: async () => {
      if (!exchange) return null;
      const response = await fetch(`/api/exchanges/balance?exchange=${exchange}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch balance for ${exchange}`);
      return response.json();
    },
    staleTime: 30000,
    retry: 1,
    enabled: !!exchange,
  } as any);
};

/**
 * Phase 2 Hook: Fetch user's open orders on an exchange
 * (Requires authentication)
 */
export const useExchangeOrders = (exchange: string | null) => {
  return useQuery({
    queryKey: ['exchange-orders', exchange],
    queryFn: async () => {
      if (!exchange) return null;
      const response = await fetch(`/api/exchanges/orders?exchange=${exchange}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch orders for ${exchange}`);
      return response.json();
    },
    staleTime: 10000, // Orders update frequently
    retry: 1,
    refetchInterval: 10000, // Auto-refresh
    enabled: !!exchange,
  } as any);
};

/**
 * === PHASE 3: SMART ORDER ROUTER HOOKS ===
 */

/**
 * Compare prices across DEX and CEX venues
 * Returns routing recommendation with savings calculation
 */
export const useOrderRouting = (symbol: string | null, amount: number | null) => {
  return useQuery({
    queryKey: ['order-routing', symbol, amount],
    queryFn: async () => {
      if (!symbol || !amount) return null;
      const response = await fetch('/api/orders/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          amount,
          side: 'buy',
          exchanges: ['binance', 'coinbase', 'kraken']
        })
      });
      if (!response.ok) throw new Error('Failed to get order routing');
      const data = await response.json();
      return data.data;
    },
    staleTime: 30000, // 30 seconds
    retry: 1,
    enabled: !!symbol && !!amount,
  } as any);
};

/**
 * Get order splitting recommendation for large orders
 * Recommends optimal split between DEX and CEX
 */
export const useOrderSplitting = (
  symbol: string | null,
  amount: number | null,
  maxDEXLiquidity: number = 5000
) => {
  return useQuery({
    queryKey: ['order-splitting', symbol, amount, maxDEXLiquidity],
    queryFn: async () => {
      if (!symbol || !amount) return null;
      const response = await fetch('/api/orders/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          amount,
          side: 'buy',
          maxDEXLiquidity
        })
      });
      if (!response.ok) throw new Error('Failed to get order splitting');
      const data = await response.json();
      return data.data;
    },
    staleTime: 30000,
    retry: 1,
    enabled: !!symbol && !!amount,
  } as any);
};

/**
 * Find best execution venue for a given order
 */
export const useBestExecutionVenue = (symbol: string | null, amount: number | null) => {
  return useQuery({
    queryKey: ['best-venue', symbol, amount],
    queryFn: async () => {
      if (!symbol || !amount) return null;
      const response = await fetch(
        `/api/orders/best-venue?symbol=${encodeURIComponent(symbol!)}&amount=${amount}&side=buy`
      );
      if (!response.ok) throw new Error('Failed to find best venue');
      const data = await response.json();
      return data.data;
    },
    staleTime: 30000,
    retry: 1,
    enabled: !!symbol && !!amount,
  } as any);
};

/**
 * Create a limit order on a CEX
 */
export const useCreateLimitOrder = () => {
  return async (
    exchange: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number,
    expiresInDays?: number
  ) => {
    const response = await fetch('/api/orders/limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exchange,
        symbol,
        side,
        amount,
        price,
        expiresInDays
      })
    });
    if (!response.ok) throw new Error('Failed to create limit order');
    const data = await response.json();
    return data.data;
  };
};

/**
 * Check status of a limit order
 */
export const useLimitOrderStatus = (orderId: string | null, exchange: string | null) => {
  return useQuery({
    queryKey: ['limit-order-status', orderId, exchange],
    queryFn: async () => {
      if (!orderId || !exchange) return null;
      const response = await fetch(
        `/api/orders/limit/${orderId}/status?exchange=${exchange}`
      );
      if (!response.ok) throw new Error('Failed to check order status');
      const data = await response.json();
      return data.data;
    },
    staleTime: 5000, // 5 seconds for active orders
    refetchInterval: 5000, // Auto-refresh frequently
    retry: 1,
    enabled: !!orderId && !!exchange,
  } as any);
};

/**
 * Analyze limit order fill probability and order book depth
 * Returns analysis for setting optimal limit prices
 */
export const useLimitOrderAnalysis = (
  symbol: string | null,
  limitPrice: number | null,
  amount: number | null
) => {
  return useQuery({
    queryKey: ['limit-order-analysis', symbol, limitPrice, amount],
    queryFn: async () => {
      if (!symbol || !limitPrice || !amount) return null;
      const response = await fetch('/api/orders/limit/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          limitPrice,
          amount,
          side: 'buy',
          exchanges: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin']
        })
      });
      if (!response.ok) throw new Error('Failed to analyze limit order');
      const data = await response.json();
      return data.data;
    },
    staleTime: 15000, // 15 seconds (order book changes frequently)
    retry: 1,
    enabled: !!symbol && !!limitPrice && !!amount,
  } as any);
};
