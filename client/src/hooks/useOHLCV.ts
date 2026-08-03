/**
 * client/src/hooks/useOHLCV.ts
 * Adapted to use client's `useExchangeData` OHLCV hook for CEX path
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOHLCV as useCEXOHLCVQuery } from '@/hooks/useExchangeData';

export type OHLCVTimeframe = '1m'|'5m'|'15m'|'1h'|'4h'|'1d';

export interface OHLCVCandle {
  timestamp: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface UseOHLCVResult {
  candles: OHLCVCandle[] | null;
  loading: boolean;
  error: string | null;
  source: string | null;
  refetch: () => Promise<void>;
  isRefetching: boolean;
}

const CELO_NATIVE_STABLECOINS = new Set(['CUSD','CEUR','CKES','CREAL','EXOF']);

function isCeloNativeSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  if (CELO_NATIVE_STABLECOINS.has(upper)) return true;
  const [base, quote] = upper.split('/');
  if (quote && CELO_NATIVE_STABLECOINS.has(quote)) return true;
  if (base && CELO_NATIVE_STABLECOINS.has(base)) return true;
  return false;
}

const useOHLCV = (
  symbol: string,
  timeframe: OHLCVTimeframe = '1h',
  limit: number = 100,
  source: string = 'auto'
): UseOHLCVResult => {
  const isCelo = useMemo(() => isCeloNativeSymbol(symbol), [symbol]);

  const resolvedSource = useMemo(() => {
    if (source !== 'auto') return source;
    return isCelo ? 'dex' : 'cex';
  }, [source, isCelo]);

  const cexExchange = resolvedSource === 'cex' ? 'binance' : (resolvedSource as string);
  // useExchangeData.useOHLCV expects (exchange, symbol, timeframe)
  const cexQuery = useCEXOHLCVQuery(cexExchange || null, symbol || null, timeframe as any);

  const [dexState, setDexState] = useState<{ candles: OHLCVCandle[] | null; loading: boolean; error: string | null; isRefetching: boolean; pairAddress: string | null }>({
    candles: null,
    loading: resolvedSource === 'dex',
    error: null,
    isRefetching: false,
    pairAddress: null,
  });

  const dexPairAddressRef = useRef<string | null>(null);

  const fetchDEX = useCallback(async (isRefetch = false) => {
    if (resolvedSource !== 'dex') return;
    setDexState(prev => ({ ...prev, loading: !isRefetch, isRefetching: isRefetch, error: null }));
    try {
      const response = await fetch(`/api/exchanges/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}&exchange=dex`);
      if (!response.ok) throw new Error(`DEX fetch failed: ${response.status}`);
      const payload = await response.json();
      const normalized: OHLCVCandle[] = (payload.data || []).map((c: any) => ({
        timestamp: c.timestamp > 9999999999 ? Math.floor(c.timestamp / 1000) : c.timestamp,
        open: c.open ?? 0,
        high: c.high ?? 0,
        low: c.low ?? 0,
        close: c.close ?? 0,
        volume: c.volume ?? 0,
      }));
      const pairAddress = payload.pairAddress || null;
      dexPairAddressRef.current = pairAddress;
      setDexState({ candles: normalized, loading: false, error: null, isRefetching: false, pairAddress });
    } catch (err: any) {
      setDexState({ candles: null, loading: false, error: err.message || 'DEX fetch error', isRefetching: false, pairAddress: null });
    }
  }, [resolvedSource, symbol, timeframe, limit]);

  useEffect(() => { if (resolvedSource === 'dex') fetchDEX(); }, [resolvedSource, fetchDEX]);

  useEffect(() => {
    if (resolvedSource !== 'dex') return;
    let ws: WebSocket | null = null;
    let reconnectTimeout: number | null = null;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/api/market-stream`;
      ws = new WebSocket(url);
      ws.onopen = () => { console.debug('[useOHLCV] connected to market stream'); };
      const normalizedSymbol = symbol.toUpperCase();
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type !== 'dex_candle') return;
          if (message.timeframe !== timeframe) return;
          const targetPairAddress = message.pairAddress as string | undefined;
          if (dexPairAddressRef.current && targetPairAddress) {
            if (dexPairAddressRef.current !== targetPairAddress) return;
          } else if ((message.symbol as string)?.toUpperCase() !== normalizedSymbol) {
            return;
          }
          setDexState((prev) => {
            const existing = prev.candles ?? [];
            const incoming = message.candle as OHLCVCandle;
            const updatedTimestamp = incoming.timestamp;
            const last = existing[existing.length - 1];
            let nextCandles: OHLCVCandle[];
            if (last && last.timestamp === updatedTimestamp) {
              nextCandles = [...existing.slice(0, -1), incoming];
            } else if (!last || updatedTimestamp > last.timestamp) {
              nextCandles = [...existing, incoming].slice(-limit);
            } else {
              return prev;
            }
            return { ...prev, candles: nextCandles };
          });
        } catch (error) {
          console.error('[useOHLCV] failed to parse market-stream message', error);
        }
      };
      ws.onerror = () => { console.warn('[useOHLCV] market stream error'); };
      ws.onclose = () => { if (reconnectTimeout) window.clearTimeout(reconnectTimeout); reconnectTimeout = window.setTimeout(connect, 3000); };
    };
    connect();
    return () => { if (ws) ws.close(); if (reconnectTimeout) window.clearTimeout(reconnectTimeout); };
  }, [resolvedSource, symbol, timeframe, limit]);

  if (resolvedSource === 'dex') {
    return { candles: dexState.candles, loading: dexState.loading, error: dexState.error, source: dexState.candles ? 'dexscreener' : null, refetch: () => fetchDEX(true).then(() => {}), isRefetching: dexState.isRefetching };
  }

  // Normalize CEX output from client useExchangeData hook
  const normalized = (() => {
    const data = (cexQuery as any)?.data;
    const raw = data?.data || data || null;
    if (!raw) return null;
    try {
      const arr = Array.isArray(raw) ? raw : (raw.data || raw);
      if (!arr || !Array.isArray(arr)) return null;
      return arr.map((c: any) => ({ timestamp: Math.floor((c.timestamp || c.time || 0) / 1000) || 0, open: c.open ?? 0, high: c.high ?? 0, low: c.low ?? 0, close: c.close ?? 0, volume: c.volume ?? 0 }));
    } catch { return null; }
  })();

  return {
    candles: normalized,
    loading: (cexQuery as any)?.isLoading || false,
    error: (cexQuery as any)?.error ? String((cexQuery as any).error) : null,
    source: (cexQuery as any)?.data ? cexExchange : null,
    refetch: async () => { try { await (cexQuery as any).refetch?.(); } catch {} },
    isRefetching: (cexQuery as any)?.isRefetching || false,
  };
};

export default useOHLCV;
