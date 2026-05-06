/**
 * Custom Hook: useExchangeData
 * 
 * Manages exchange, asset, and price data for the Exchange Markets page.
 * Encapsulates API calls and query logic.
 */

import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/utils/authClient';

/**
 * Fetch exchange status and available exchanges
 */
export const useExchangeStatus = () => {
  return useQuery({
    queryKey: ['exchange-status'],
    queryFn: async () => {
      return authClient.get<any>('/api/exchanges/status');
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
      const data = await authClient.get<any>(`/api/exchanges/assets?exchange=${exchangeName}`);
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
      return authClient.get<any>(
        `/api/exchanges/prices?symbol=${encodeURIComponent(symbol)}&exchanges=${exchangesParam}`
      );
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
      return authClient.get<any>(
        `/api/exchanges/best-price?symbol=${encodeURIComponent(symbol)}&exchanges=${exchangesParam}`
      );
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
      return authClient.get<any>(
        `/api/exchanges/ohlcv?exchange=${exchange}&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
      );
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
      return authClient.get<any>(`/api/exchanges/balance?exchange=${exchange}`);
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
      return authClient.get<any>(`/api/exchanges/orders?exchange=${exchange}`);
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
      return authClient.post<any>('/api/v1/yuki/orders/route', {
        symbol,
        amount,
        side: 'buy',
        exchanges: ['binance', 'coinbase', 'kraken']
      });
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
      const splittingData = await authClient.post<any>('/api/v1/yuki/orders/split', {
        symbol,
        amount,
        side: 'buy',
        maxDEXLiquidity
      });
      return splittingData.data;
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
      const venueData = await authClient.get<any>(
        `/api/v1/yuki/orders/best-venue?symbol=${encodeURIComponent(symbol!)}&amount=${amount}&side=buy`
      );
      return venueData.data;
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
    const response = await authClient.post<any>('/api/v1/yuki/orders/limit', {
      exchange,
      symbol,
      side,
      amount,
      price,
      expiresInDays
    });
    return response.data;
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
      const statusData = await authClient.get<any>(
        `/api/v1/yuki/orders/limit/${orderId}/status?exchange=${exchange}`
      );
      return statusData.data;
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
      const analysisData = await authClient.post<any>('/api/v1/yuki/orders/limit/analysis', {
        symbol,
        limitPrice,
        amount,
        side: 'buy',
        exchanges: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin']
      });
      return analysisData.data;
    },
    staleTime: 15000, // 15 seconds (order book changes frequently)
    retry: 1,
    enabled: !!symbol && !!limitPrice && !!amount,
  } as any);
};
