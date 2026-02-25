import { useEffect, useRef, useState, useCallback } from 'react';

export type WebSocketMessageType =
  | 'PLATFORM_METRICS'
  | 'DAO_METRICS'
  | 'OPPORTUNITY'
  | 'MARKET_DATA'
  | 'GLOBAL_METRICS'
  | 'ACTIVITY';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  timestamp: number;
  data: any;
  source?: string;
}

interface UseWebSocketOptions {
  enabled?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

interface UseWebSocketReturn {
  connected: boolean;
  reconnecting: boolean;
  messages: WebSocketMessage[];
  error: Error | null;
  send: (message: any) => void;
  close: () => void;
  reconnect: () => void;
}

/**
 * Hook to manage WebSocket connection for real-time dashboard updates
 * Falls back to HTTP polling if WebSocket is unavailable
 */
export function useWebSocket(
  url: string = 'wss://api.mtaadao.io/ws',
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    enabled = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const messageBufferRef = useRef<WebSocketMessage[]>([]);

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setReconnecting(true);
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setConnected(true);
        setReconnecting(false);
        reconnectAttemptsRef.current = 0;
        setError(null);
        onConnect?.();

        // Send pending messages
        messageBufferRef.current.forEach(msg => {
          wsRef.current?.send(JSON.stringify(msg));
        });
        messageBufferRef.current = [];
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setMessages(prev => [...prev.slice(-99), message]); // Keep last 100 messages
          onMessage?.(message);
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      wsRef.current.onerror = (event) => {
        const error = new Error('WebSocket error occurred');
        console.error('[WebSocket] Error:', error);
        setError(error);
        onError?.(error);
      };

      wsRef.current.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setConnected(false);
        onDisconnect?.();

        // Attempt to reconnect
        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          setReconnecting(true);
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        }
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to establish WebSocket connection');
      setError(error);
      onError?.(error);
      setReconnecting(false);

      // Retry connection
      if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current += 1;
        setReconnecting(true);
        reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
      }
    }
  }, [enabled, url, reconnectInterval, maxReconnectAttempts, onConnect, onDisconnect, onError, onMessage]);

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Buffer message if not connected
      messageBufferRef.current.push(message);
    }
  }, []);

  const close = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
    setConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    close();
    connect();
  }, [close, connect]);

  // Connect on mount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      close();
    };
  }, [enabled, connect, close]);

  return {
    connected,
    reconnecting,
    messages,
    error,
    send,
    close,
    reconnect,
  };
}

/**
 * Alternative polling-based hook for when WebSocket is unavailable
 * Used as fallback mechanism
 */
export function usePolling(
  url: string,
  interval: number = 5000,
  enabled: boolean = true
) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Polling failed');
      setError(error);
      console.error('[Polling] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetch();

    // Set up polling
    pollingIntervalRef.current = setInterval(fetch, interval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [enabled, interval, fetch]);

  return { data, loading, error };
}

/**
 * Combined hook that uses WebSocket with HTTP polling fallback
 */
export function useRealtimeData(
  wsUrl: string = 'wss://api.mtaadao.io/ws',
  pollingUrl?: string,
  pollingInterval: number = 10000
) {
  const [useFallback, setUseFallback] = useState(false);

  const ws = useWebSocket(wsUrl, {
    enabled: !useFallback,
    onError: () => {
      console.warn('[RealtimeData] WebSocket failed, switching to polling');
      setUseFallback(true);
    },
  });

  const polling = usePolling(pollingUrl || wsUrl, pollingInterval, useFallback);

  return {
    connected: !useFallback && ws.connected,
    reconnecting: ws.reconnecting,
    fallbackActive: useFallback,
    messages: ws.messages,
    data: polling.data,
    error: ws.error || polling.error,
    send: ws.send,
    close: ws.close,
    reconnect: ws.reconnect,
  };
}

export default useWebSocket;
