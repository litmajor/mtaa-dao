/**
 * Custom Hook: useExchangeData
 * 
 * Manages exchange, asset, and price data for the Exchange Markets page.
 * Encapsulates API calls and query logic.
 */

import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/utils/authClient';

interface LiveMarketTicker {
  exchange: string;
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  volume24h: number;
  change24h: number | null;
  timestamp: number;
}

type LiveMarketAsset<T> = T & {
  symbol: string;
  markets: LiveMarketTicker[];
};

interface LiveMarketData<T> {
  assets: LiveMarketAsset<T>[];
  exchanges: Record<string, { ok: boolean; tickerCount: number; error?: string }>;
  timestamp: string;
}

async function fetchLiveMarketData<T>(limit: number, exchanges: string[] = []): Promise<LiveMarketData<T>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (exchanges.length > 0) params.set('exchanges', exchanges.join(','));

  const response = await authClient.get<LiveMarketData<T>>(
    `/api/v1/yuki/market/top?${params.toString()}`,
    { timeoutMs: 30000 }
  );
  if (!response || !Array.isArray(response.assets) || !response.exchanges) {
    throw new Error('Market data response did not contain assets and exchange status');
  }
  return response;
}

/**
 * Fetch exchange status and available exchanges
 */
export const useExchangeStatus = () => {
  return useQuery({
    queryKey: ['exchange-status'],
    queryFn: async () => {
      return authClient.get<string[]>('/api/v1/yuki/exchanges/exchanges/available');
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
      const data = await fetchLiveMarketData<any>(500, [exchangeName]);
      return data.assets.flatMap((asset) => asset.markets
        .filter((market) => market.exchange === exchangeName)
        .map((market) => ({
          symbol: market.symbol,
          base: asset.symbol,
          quote: market.symbol.split('/')[1],
          last: market.last,
          bid: market.bid,
          ask: market.ask,
          volume24h: market.volume24h,
          change24h: market.change24h,
          timestamp: market.timestamp,
        })));
    },
    staleTime: 10000,
    refetchInterval: 30000,
    retry: 0,
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
      const data = await fetchLiveMarketData<any>(500, exchanges);
      const [baseSymbol, quoteSymbol] = symbol.split('/');
      const normalizedPair = symbol.includes('/') ? symbol.toUpperCase() : null;
      const asset = data.assets.find((item) => item.symbol.toUpperCase() === baseSymbol.toUpperCase());
      const marketData = (asset?.markets ?? [])
        .filter((market) => exchanges.includes(market.exchange))
        .filter((market) => !normalizedPair || market.symbol.toUpperCase() === normalizedPair)
        .sort((a, b) => b.volume24h - a.volume24h);
      const prices = Object.fromEntries(exchanges.flatMap((exchange) => {
        const market = marketData.find((item) => item.exchange === exchange);
        if (!market) return [];
        return [[exchange, {
          ...market,
          price: market.last,
          volume: market.volume24h,
          quote: quoteSymbol,
        }]];
      }));
      return { prices, timestamp: data.timestamp };
    },
    staleTime: 30000, // 30 seconds (prices update frequently)
    refetchInterval: 30000, // Auto-refresh prices
    enabled: !!symbol && exchanges.length > 0,
  } as any);
};

/**
 * Fetch best price across exchanges
 */
export const useBestPrice = (symbol: string | null, exchanges: string[]) => {
  const query = usePrices(symbol, exchanges);
  const prices = (query.data as any)?.prices ?? {};
  const candidates = Object.values(prices).filter((price: any) => price.bid > 0 && price.ask > 0) as any[];
  const best = candidates
    .map((price) => ({
      ...price,
      spread: price.ask - price.bid,
      spreadPct: ((price.ask - price.bid) / price.bid) * 100,
    }))
    .sort((a, b) => a.spreadPct - b.spreadPct)[0];

  return {
    ...query,
    data: best ? {
      best,
      all: prices,
      analysis: {
        tightest: best.exchange,
        spread_pct: best.spreadPct,
      },
    } : null,
  } as any;
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
        `/api/v1/yuki/exchanges/ohlcv?exchange=${exchange}&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
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
      return authClient.get<any>(`/api/v1/yuki/exchanges/balance?exchange=${exchange}`);
    },
    staleTime: 30000,
    retry: 1,
    enabled: !!exchange,
  } as any);
};

  /**
   * Fetch top assets aggregated from live exchange tickers by the backend.
   */
  export const useTopAssets = <T = any>(limit: number = 100) => {
    return useQuery<{
      assets: LiveMarketAsset<T>[];
      exchanges: LiveMarketData<T>['exchanges'];
      timestamp: string;
    }>({
      queryKey: ['top-assets', limit],
      queryFn: () => fetchLiveMarketData<T>(limit),
      staleTime: 10000,
      refetchInterval: 30000,
      retry: 0,
    });
  };

  /**
   * Search for a base symbol across available exchanges.
   * Calls the server aggregated exchange endpoint and returns a simplified result.
   */
  export const useFindSymbolAcrossExchanges = (baseSymbol: string | null, exchanges: string[] = []) => {
    return useQuery({
      queryKey: ['find-symbol', baseSymbol, exchanges.join(',')],
      queryFn: async () => {
        if (!baseSymbol) return { found: 0, exchanges: [] };
        try {
          const data = await fetchLiveMarketData<any>(500, exchanges);
          const asset = data.assets.find((item) => item.symbol.toUpperCase() === baseSymbol.toUpperCase());
          const list = asset?.markets ?? [];
          return {
            found: list.length,
            exchanges: list.map((market) => ({
              exchange: market.exchange,
              symbol: market.symbol,
              price: market.last,
              bid: market.bid,
              ask: market.ask,
              volume: market.volume24h,
              change24h: market.change24h,
              timestamp: market.timestamp,
            }))
          };
        } catch (error) {
          console.error('Failed to find symbol across exchanges:', error);
          throw error;
        }
      },
      staleTime: 30000,
      retry: 1,
      enabled: !!baseSymbol,
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
      return authClient.get<any>(`/api/v1/yuki/exchanges/orders?exchange=${exchange}`);
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
        exchanges: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx']
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
        exchanges: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx']
      });
      return analysisData.data;
    },
    staleTime: 15000, // 15 seconds (order book changes frequently)
    retry: 1,
    enabled: !!symbol && !!limitPrice && !!amount,
  } as any);
};
