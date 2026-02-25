/**
 * Opportunity Stream Hook
 * 
 * React hook for real-time opportunity updates via WebSocket
 */

import { useEffect, useState, useRef, useCallback } from 'react';

interface OpportunityData {
  id: string;
  type: 'arbitrage' | 'dex-spread' | 'emerging-token';
  symbol: string;
  chain?: string;
  profitPercent: number;
  profitAmount?: number;
  venue1: string;
  venue2: string;
  price1: number;
  price2: number;
  volume: number;
  risk: 'low' | 'medium' | 'high';
  timestamp: number;
  confidence: number;
  executionRecommendation?: {
    venue: 'dex' | 'cex';
    dex?: string;
    exchange?: string;
    estimatedOutput: number;
  };
}

interface UseOpportunityStreamOptions {
  minProfitPercent?: number;
  subscribeToTypes?: ('arbitrage' | 'dex-spread' | 'emerging-token')[];
  enabled?: boolean;
}

interface OpportunityStreamStatus {
  connected: boolean;
  clientId?: string;
  connectedClients?: number;
  engineStatus?: {
    isScanning: boolean;
    cacheSize: number;
    listenerCount: number;
  };
}

/**
 * Hook for real-time opportunity streaming
 */
export function useOpportunityStream(
  options: UseOpportunityStreamOptions = {}
) {
  const {
    minProfitPercent = 0.5,
    subscribeToTypes = ['arbitrage', 'dex-spread', 'emerging-token'],
    enabled = true
  } = options;

  const [opportunities, setOpportunities] = useState<OpportunityData[]>([]);
  const [status, setStatus] = useState<OpportunityStreamStatus>({ connected: false });
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(5);

  // Connect to WebSocket
  useEffect(() => {
    if (!enabled) return;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/opportunities-stream`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('Connected to opportunity stream');
          reconnectAttemptsRef.current = 0;
          setStatus(prev => ({ ...prev, connected: true }));
          setError(null);

          // Subscribe to preferred types
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: { types: subscribeToTypes }
          }));

          // Set initial filter
          ws.send(JSON.stringify({
            type: 'set-filter',
            payload: { minProfitPercent }
          }));
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);

            switch (message.type) {
              case 'connected':
                setStatus(prev => ({
                  ...prev,
                  clientId: message.clientId
                }));
                break;

              case 'opportunities':
                setOpportunities(message.data || []);
                break;

              case 'status':
                setStatus(prev => ({
                  ...prev,
                  connectedClients: message.connectedClients,
                  engineStatus: message.engine
                }));
                break;

              case 'error':
                console.error('Stream error:', message.message);
                setError(new Error(message.message));
                break;

              case 'subscribed':
              case 'unsubscribed':
              case 'filter-updated':
              case 'pong':
                // Acknowledge messages - no action needed
                break;

              default:
                console.warn('Unknown message type:', message.type);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onerror = (event: Event) => {
          const wsError = new Error(`WebSocket error: ${event}`);
          console.error('WebSocket error:', wsError);
          setError(wsError);
        };

        ws.onclose = () => {
          console.log('Disconnected from opportunity stream');
          setStatus(prev => ({ ...prev, connected: false }));
          wsRef.current = null;

          // Attempt reconnection
          if (enabled && reconnectAttemptsRef.current < maxReconnectAttemptsRef.current) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          }
        };

        wsRef.current = ws;
      } catch (err) {
        const connectError = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to connect to opportunity stream:', connectError);
        setError(connectError);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enabled, subscribeToTypes, minProfitPercent]);

  /**
   * Update profit filter
   */
  const setFilter = useCallback((minProfit: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set-filter',
        payload: { minProfitPercent: minProfit }
      }));
    }
  }, []);

  /**
   * Subscribe to additional types
   */
  const subscribe = useCallback((types: ('arbitrage' | 'dex-spread' | 'emerging-token')[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        payload: { types }
      }));
    }
  }, []);

  /**
   * Unsubscribe from types
   */
  const unsubscribe = useCallback((types: ('arbitrage' | 'dex-spread' | 'emerging-token')[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        payload: { types }
      }));
    }
  }, []);

  /**
   * Get stream status
   */
  const getStatus = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'get-status' }));
    }
  }, []);

  return {
    opportunities,
    connected: status.connected,
    clientId: status.clientId,
    error,
    status,
    setFilter,
    subscribe,
    unsubscribe,
    getStatus
  };
}

/**
 * Hook to get sorted opportunities
 */
export function useFilteredOpportunities(
  opportunities: OpportunityData[],
  filters?: {
    type?: 'arbitrage' | 'dex-spread' | 'emerging-token';
    minProfit?: number;
    maxProfit?: number;
    riskLevel?: 'low' | 'medium' | 'high';
    symbol?: string;
  }
) {
  return opportunities.filter(opp => {
    if (filters?.type && opp.type !== filters.type) return false;
    if (filters?.minProfit && opp.profitPercent < filters.minProfit) return false;
    if (filters?.maxProfit && opp.profitPercent > filters.maxProfit) return false;
    if (filters?.riskLevel && opp.risk !== filters.riskLevel) return false;
    if (filters?.symbol && opp.symbol !== filters.symbol) return false;
    return true;
  });
}
