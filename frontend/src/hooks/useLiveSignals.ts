/**
 * useLiveSignals — Real-time Intelligence Stream
 *
 * Connects to a Server-Sent Events endpoint that bridges Redis pub/sub
 * to the frontend. Falls back to polling if SSE is unavailable.
 *
 * Channels:
 *   • signals:price     — price alerts, volatility spikes
 *   • signals:opportunity — arbitrage, momentum, yield alerts
 *   • signals:strategy  — strategy fill notifications
 *
 * Usage in dashboard:
 *   const { signals, opportunities, isConnected } = useLiveSignals();
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface LiveSignal {
  id: string;
  type: 'price' | 'opportunity' | 'strategy' | 'system';
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  symbol?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface UseLiveSignalsResult {
  signals: LiveSignal[];
  opportunities: LiveSignal[];
  strategies: LiveSignal[];
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

const MAX_SIGNALS = 50;
const SSE_URL = '/api/signals/stream'; // SSE endpoint served by backend
const POLL_URL = '/api/signals/poll';  // Fallback polling endpoint
const POLL_INTERVAL = 5000;

export function useLiveSignals(): UseLiveSignalsResult {
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── SSE Connection ──
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource(SSE_URL);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
        // Stop polling if we had a fallback running
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      };

      es.onmessage = (event) => {
        try {
          const signal: LiveSignal = JSON.parse(event.data);
          setSignals((prev) => {
            const next = [signal, ...prev];
            return next.slice(0, MAX_SIGNALS);
          });
        } catch (e) {
          console.warn('[useLiveSignals] Failed to parse SSE message:', event.data);
        }
      };

      es.onerror = (err) => {
        console.warn('[useLiveSignals] SSE error, falling back to polling', err);
        setIsConnected(false);
        setError('SSE disconnected, using polling fallback');
        es.close();
        eventSourceRef.current = null;
        startPolling();
      };
    } catch (e) {
      setError('SSE not supported, using polling');
      startPolling();
    }
  }, []);

  // ── Polling Fallback ──
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;

    const poll = async () => {
      try {
        const res = await fetch(POLL_URL);
        if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
        const batch: LiveSignal[] = await res.json();
        if (batch.length > 0) {
          setSignals((prev) => {
            const next = [...batch, ...prev];
            return next.slice(0, MAX_SIGNALS);
          });
        }
      } catch (e) {
        console.debug('[useLiveSignals] Poll failed:', e);
      }
    };

    poll(); // immediate
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL);
  }, []);

  // ── Lifecycle ──
  useEffect(() => {
    connectSSE();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [connectSSE]);

  const reconnect = useCallback(() => {
    setError(null);
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    connectSSE();
  }, [connectSSE]);

  // ── Derived buckets ──
  const opportunities = signals.filter((s) => s.type === 'opportunity');
  const strategies = signals.filter((s) => s.type === 'strategy');

  return { signals, opportunities, strategies, isConnected, error, reconnect };
}

export default useLiveSignals;
