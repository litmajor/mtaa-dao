/**
 * useLiveExchangePrices Hook
 * 
 * Manages WebSocket connection for real-time price streaming
 * Features:
 * - Auto-connect to WebSocket server
 * - Subscribe/unsubscribe to symbols and exchanges
 * - Real-time price updates
 * - Arbitrage opportunity detection
 * - Auto-reconnection on disconnect
 * - Proper cleanup on unmount
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Type Definitions
 */
export interface LivePrice {
  symbol: string;
  exchange: string;
  bid: number;
  ask: number;
  timestamp: number;
  midPrice?: number;
}

export interface ArbitrageAlert {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spreadPct: number;
  profit: number;
  timestamp: number;
}

export interface WebSocketMessage {
  type: 'price' | 'order' | 'arbitrage' | 'subscribed' | 'unsubscribed' | 'error';
  symbol?: string;
  exchange?: string;
  bid?: number;
  ask?: number;
  timestamp?: number;
  buyExchange?: string;
  sellExchange?: string;
  buyPrice?: number;
  sellPrice?: number;
  spreadPct?: number;
  profit?: number;
  message?: string;
  error?: string;
  symbols?: string[];
  exchanges?: string[];
}

interface UseLiveExchangePricesOptions {
  initialSymbols?: string[];
  initialExchanges?: string[];
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useLiveExchangePrices(options: UseLiveExchangePricesOptions = {}) {
  const {
    initialSymbols = [],
    initialExchanges = [],
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options;

  // State management
  const [prices, setPrices] = useState<Map<string, LivePrice>>(new Map());
  const [arbitrageAlerts, setArbitrageAlerts] = useState<ArbitrageAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribedSymbols, setSubscribedSymbols] = useState<Set<string>>(
    new Set(initialSymbols)
  );
  const [subscribedExchanges, setSubscribedExchanges] = useState<Set<string>>(
    new Set(initialExchanges)
  );

  // Refs for managing WebSocket connection and reconnection
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pricesRef = useRef<Map<string, LivePrice>>(new Map());
  const alertsRef = useRef<ArbitrageAlert[]>([]);

  const queryClient = useQueryClient();

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    try {
      // Don't reconnect if already connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/prices`;

      console.log('🔌 Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptRef.current = 0;

        // Subscribe to initial symbols and exchanges
        if (subscribedSymbols.size > 0 || subscribedExchanges.size > 0) {
          const subscribeMessage = {
            action: 'subscribe',
            symbols: Array.from(subscribedSymbols),
            exchanges: Array.from(subscribedExchanges)
          };
          ws.send(JSON.stringify(subscribeMessage));
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (event: Event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect
        if (autoConnect && reconnectAttemptRef.current < maxReconnectAttempts) {
          reconnectAttemptRef.current += 1;
          console.log(
            `🔄 Attempting reconnect ${reconnectAttemptRef.current}/${maxReconnectAttempts}`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (error: any) {
      console.error('Error connecting to WebSocket:', error);
      setError(error.message);
    }
  }, [subscribedSymbols, subscribedExchanges, autoConnect, reconnectInterval, maxReconnectAttempts]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'price':
        if (message.symbol && message.exchange !== undefined && message.bid !== undefined && message.ask !== undefined) {
          const priceKey = `${message.symbol}:${message.exchange}`;
          const livePrice: LivePrice = {
            symbol: message.symbol,
            exchange: message.exchange,
            bid: message.bid,
            ask: message.ask,
            timestamp: message.timestamp || Date.now(),
            midPrice: (message.bid + message.ask) / 2
          };

          pricesRef.current.set(priceKey, livePrice);
          setPrices(new Map(pricesRef.current));
        }
        break;

      case 'arbitrage':
        if (
          message.symbol &&
          message.buyExchange &&
          message.sellExchange &&
          message.buyPrice !== undefined &&
          message.sellPrice !== undefined &&
          message.spreadPct !== undefined
        ) {
          const alert: ArbitrageAlert = {
            symbol: message.symbol,
            buyExchange: message.buyExchange,
            sellExchange: message.sellExchange,
            buyPrice: message.buyPrice,
            sellPrice: message.sellPrice,
            spreadPct: message.spreadPct,
            profit: message.profit || 0,
            timestamp: message.timestamp || Date.now()
          };

          // Add to alerts list (keep last 100)
          alertsRef.current.unshift(alert);
          if (alertsRef.current.length > 100) {
            alertsRef.current.pop();
          }

          setArbitrageAlerts([...alertsRef.current]);

          // Trigger browser notification for significant opportunities
          if (message.spreadPct > 1 && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`Arbitrage Alert: ${message.symbol}`, {
              body: `${message.spreadPct.toFixed(2)}% spread between ${message.buyExchange} and ${message.sellExchange}`,
              tag: `arbitrage-${message.symbol}`
            });
          }
        }
        break;

      case 'subscribed':
        console.log('✅ Successfully subscribed', message.symbols, message.exchanges);
        break;

      case 'unsubscribed':
        console.log('✅ Successfully unsubscribed', message.symbols, message.exchanges);
        break;

      case 'error':
        console.error('WebSocket error message:', message.message);
        setError(message.message || 'WebSocket error');
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }, []);

  /**
   * Subscribe to symbols and exchanges
   */
  const subscribe = useCallback((symbols: string[], exchanges: string[]) => {
    const newSymbols = new Set(subscribedSymbols);
    const newExchanges = new Set(subscribedExchanges);

    symbols.forEach(s => newSymbols.add(s));
    exchanges.forEach(e => newExchanges.add(e));

    setSubscribedSymbols(newSymbols);
    setSubscribedExchanges(newExchanges);

    // Send subscribe message if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        action: 'subscribe',
        symbols: Array.from(newSymbols),
        exchanges: Array.from(newExchanges)
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, [subscribedSymbols, subscribedExchanges]);

  /**
   * Unsubscribe from symbols and exchanges
   */
  const unsubscribe = useCallback((symbols: string[], exchanges: string[]) => {
    const newSymbols = new Set(subscribedSymbols);
    const newExchanges = new Set(subscribedExchanges);

    symbols.forEach(s => newSymbols.delete(s));
    exchanges.forEach(e => newExchanges.delete(e));

    setSubscribedSymbols(newSymbols);
    setSubscribedExchanges(newExchanges);

    // Send unsubscribe message if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        action: 'unsubscribe',
        symbols,
        exchanges
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, [subscribedSymbols, subscribedExchanges]);

  /**
   * Get price for specific symbol/exchange
   */
  const getPrice = useCallback((symbol: string, exchange: string): LivePrice | undefined => {
    return prices.get(`${symbol}:${exchange}`);
  }, [prices]);

  /**
   * Get all prices for a symbol across exchanges
   */
  const getPricesForSymbol = useCallback((symbol: string): LivePrice[] => {
    return Array.from(prices.values()).filter(p => p.symbol === symbol);
  }, [prices]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnected(false);
  }, []);

  /**
   * Initialize connection on mount
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  /**
   * Request browser notification permissions
   */
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    }
    return Notification.permission === 'granted';
  }, []);

  return {
    // State
    prices: Object.fromEntries(prices),
    arbitrageAlerts,
    isConnected,
    error,
    subscribedSymbols: Array.from(subscribedSymbols),
    subscribedExchanges: Array.from(subscribedExchanges),

    // Methods
    subscribe,
    unsubscribe,
    getPrice,
    getPricesForSymbol,
    connect,
    disconnect,
    requestNotificationPermission
  };
}

/**
 * Hook for monitoring specific arbitrage pair
 */
export function useArbitrageMonitor(symbol: string, minSpreadPct: number = 0.5) {
  const { arbitrageAlerts } = useLiveExchangePrices({
    initialSymbols: [symbol],
    initialExchanges: []
  });

  const relevantAlerts = arbitrageAlerts.filter(
    alert => alert.symbol === symbol && alert.spreadPct >= minSpreadPct
  );

  const bestOpportunity = relevantAlerts.length > 0 ? relevantAlerts[0] : null;

  return {
    alerts: relevantAlerts,
    bestOpportunity,
    alertCount: relevantAlerts.length
  };
}

/**
 * Hook for comparing prices across exchanges
 */
export function useExchangePriceComparison(symbol: string, exchanges: string[]) {
  const { subscribe, getPricesForSymbol } = useLiveExchangePrices({
    initialSymbols: [symbol],
    initialExchanges: exchanges
  });

  const pricesForSymbol = getPricesForSymbol(symbol);

  const comparison = exchanges.map(exchange => {
    const price = pricesForSymbol.find(p => p.exchange === exchange);
    return {
      exchange,
      bid: price?.bid,
      ask: price?.ask,
      midPrice: price?.midPrice,
      available: !!price
    };
  });

  const lowestAsk = comparison
    .filter(c => c.ask !== undefined)
    .sort((a, b) => (a.ask || 0) - (b.ask || 0))[0];

  const highestBid = comparison
    .filter(c => c.bid !== undefined)
    .sort((a, b) => (b.bid || 0) - (a.bid || 0))[0];

  const bestBuyExchange = lowestAsk?.exchange;
  const bestSellExchange = highestBid?.exchange;

  return {
    symbol,
    comparison,
    bestBuyExchange,
    bestSellExchange,
    bestBuyPrice: lowestAsk?.ask,
    bestSellPrice: highestBid?.bid,
    potentialSpread:
      lowestAsk?.ask && highestBid?.bid
        ? ((highestBid.bid - lowestAsk.ask) / lowestAsk.ask) * 100
        : null
  };
}
