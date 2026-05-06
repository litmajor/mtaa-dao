import { useEffect, useRef, useState, useCallback } from 'react';
import { API_CONFIG } from '@/config/apiConfig';

/**
 * Event Listener callback
 */
type EventCallback = (data: any) => void;

/**
 * Socket-like object that mimics Socket.IO API
 */
interface Socket {
  on(event: string, callback: EventCallback): void;
  off(event: string, callback?: EventCallback): void;
  emit(event: string, data?: any): void;
  connected: boolean;
}

/**
 * WebSocket Event structure
 */
interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: number;
}

interface UseWebSocketOptions {
  onMessage?: (event: WebSocketEvent) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * Enhanced WebSocket Hook with Socket.IO-like API
 * Provides: socket.on(), socket.off(), socket.emit(), socket.connected
 * Maintains backward compatibility with WebSocketEvent interface
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onError,
    onConnect,
    onDisconnect,
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const messageQueue = useRef<WebSocketEvent[]>([]);
  
  // Event listeners: Map<eventType, Set<callbacks>>
  const eventListeners = useRef<Map<string, Set<EventCallback>>>(new Map());

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Construct WebSocket URL
  const wsUrl = API_CONFIG.WS_URL || 'ws://localhost:5000';

  const connect = useCallback(() => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setLastError(null);

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectCount.current = 0;

        // Process queued messages
        while (messageQueue.current.length > 0) {
          const msg = messageQueue.current.shift();
          if (msg && ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(msg));
          }
        }

        onConnect?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const wsEvent: WebSocketEvent = JSON.parse(event.data);
          
          // Call legacy callback if provided
          onMessage?.(wsEvent);
          
          // Emit to registered event listeners (Socket.IO pattern)
          const eventType = wsEvent.type || 'message';
          const callbacks = eventListeners.current.get(eventType);
          if (callbacks) {
            callbacks.forEach(callback => {
              try {
                callback(wsEvent.data || wsEvent);
              } catch (err) {
                console.error(`Error in event listener for ${eventType}:`, err);
              }
            });
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setLastError('WebSocket connection error');
        onError?.(error);
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        onDisconnect?.();

        // Attempt reconnection with exponential backoff
        if (reconnectCount.current < maxReconnectAttempts) {
          reconnectCount.current++;
          const delay = reconnectInterval * Math.pow(2, reconnectCount.current - 1);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectCount.current})`);

          reconnectTimer.current = setTimeout(() => {
            connect();
          }, Math.min(delay, 30000)); // Max 30s delay
        } else {
          setLastError('Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setIsConnecting(false);
      setLastError(error instanceof Error ? error.message : 'Connection failed');
    }
  }, [isConnecting, isConnected, wsUrl, onConnect, onDisconnect, onError, onMessage, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const send = useCallback((event: WebSocketEvent | Omit<WebSocketEvent, 'timestamp'>) => {
    const fullEvent: WebSocketEvent = {
      ...(event as any),
      timestamp: (event as any).timestamp || Date.now(),
    };

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(fullEvent));
    } else {
      messageQueue.current.push(fullEvent);
      if (!isConnected && !isConnecting) {
        connect();
      }
    }
  }, [isConnected, isConnecting, connect]);

  const subscribe = useCallback((eventType: string) => {
    send({
      type: 'SUBSCRIBE',
      data: { eventType },
    });
  }, [send]);

  const unsubscribe = useCallback((eventType: string) => {
    send({
      type: 'UNSUBSCRIBE',
      data: { eventType },
    });
  }, [send]);

  /**
   * Socket.IO-style event listener (ADD event handler)
   * Usage: socket.on('config:changed', (data) => { ... })
   */
  const on = useCallback((event: string, callback: EventCallback) => {
    if (!eventListeners.current.has(event)) {
      eventListeners.current.set(event, new Set());
    }
    eventListeners.current.get(event)?.add(callback);
  }, []);

  /**
   * Socket.IO-style event unlistener (REMOVE event handler)
   * Usage: socket.off('config:changed', callback)
   */
  const off = useCallback((event: string, callback?: EventCallback) => {
    if (!callback) {
      // Remove all listeners for this event
      eventListeners.current.delete(event);
    } else {
      // Remove specific listener
      eventListeners.current.get(event)?.delete(callback);
    }
  }, []);

  /**
   * Socket.IO-style event emitter (SEND event to server)
   * Usage: socket.emit('subscribe', { room: 'alerts' })
   */
  const emit = useCallback((event: string, data?: any) => {
    send({
      type: event,
      data: data || {},
    });
  }, [send]);

  // Create socket object with Socket.IO-like API
  const socket: Socket = {
    on,
    off,
    emit,
    connected: isConnected,
  };

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [autoConnect, connect]);

  return {
    // Socket.IO-like API (primary)
    socket,
    
    // Legacy API (for backward compatibility)
    isConnected,
    isConnecting,
    lastError,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
    
    // Event methods for direct consumption
    on,
    off,
    emit,
  };
}

/**
 * Hook for subscribing to specific WebSocket events
 * Handles subscribe/unsubscribe lifecycle
 */
export function useWebSocketEvent(
  eventType: string,
  onEvent: (data: any) => void,
  options?: UseWebSocketOptions
) {
  const { send, subscribe, unsubscribe, isConnected } = useWebSocket({
    ...options,
    onMessage: (event) => {
      if (event.type === eventType) {
        onEvent(event.data);
      }
      options?.onMessage?.(event);
    },
  });

  useEffect(() => {
    if (isConnected) {
      subscribe(eventType);

      return () => {
        unsubscribe(eventType);
      };
    }
  }, [isConnected, eventType, subscribe, unsubscribe]);

  return { isConnected, send };
}

/**
 * Hook for real-time market data updates
 */
export function useRealtimeMarketData(pair: string) {
  const [marketData, setMarketData] = useState<any>(null);
  const { isConnected } = useWebSocketEvent(
    `MARKET_DATA_${pair.toUpperCase().replace('/', '_')}`,
    (data) => {
      setMarketData(data);
    }
  );

  return { marketData, isConnected };
}

/**
 * Hook for real-time platform metrics
 */
export function useRealtimePlatformMetrics() {
  const [metrics, setMetrics] = useState<any>(null);
  const { isConnected } = useWebSocketEvent(
    'PLATFORM_METRICS',
    (data) => {
      setMetrics(data);
    }
  );

  return { metrics, isConnected };
}

/**
 * Hook for real-time DAO metrics
 */
export function useRealtimeDaoMetrics(daoId: string) {
  const [metrics, setMetrics] = useState<any>(null);
  const { isConnected } = useWebSocketEvent(
    `DAO_METRICS_${daoId}`,
    (data) => {
      setMetrics(data);
    }
  );

  return { metrics, isConnected };
}

/**
 * Hook for real-time activity feed
 */
export function useRealtimeActivityFeed() {
  const [activities, setActivities] = useState<any[]>([]);

  const handleMessage = (event: WebSocketEvent) => {
    switch (event.type) {
      case 'OPPORTUNITY':
      case 'ARBITRAGE':
      case 'ALERT':
      case 'DAO_EVENT':
        setActivities((prev) => [
          {
            ...event.data,
            receivedAt: new Date(),
          },
          ...prev,
        ].slice(0, 100)); // Keep last 100 items
        break;
    }
  };

  const { isConnected } = useWebSocket({
    onMessage: handleMessage,
  });

  return { activities, isConnected };
}

/**
 * Hook for real-time arbitrage opportunities
 */
export function useRealtimeArbitrage() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const { isConnected } = useWebSocketEvent(
    'ARBITRAGE_OPPORTUNITIES',
    (data) => {
      setOpportunities(Array.isArray(data) ? data : [data]);
    }
  );

  return { opportunities, isConnected };
}

/**
 * Hook for global market alerts
 */
export function useGlobalAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const { isConnected } = useWebSocketEvent(
    'GLOBAL_ALERTS',
    (data) => {
      setAlerts((prev) => [data, ...prev].slice(0, 50));
    }
  );

  return { alerts, isConnected };
}
