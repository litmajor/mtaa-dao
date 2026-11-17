/**
 * useOHLCV — Source-Agnostic Frontend Hook
 * 
 * Routes:
 *   • Celo-native symbols (cUSD, cEUR, CELO/cUSD, etc.) → DEX
 *   • Everything else → CEX (via existing useCEXOHLCV)
 * 
 * The backend OHLCVService already handles both paths; this hook
 * simply ensures the frontend asks the right endpoint.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useCEXOHLCV, { Candle as CEXCandle, Timeframe } from '../../../src/hooks/useCEXOHLCV';

export type OHLCVTimeframe = Timeframe;

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
  source: string | null; // 'binance' | 'kraken' | 'dexscreener:ubeswap' | etc.
  refetch: () => Promise<void>;
  isRefetching: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CELO NATIVE DETECTION (mirrors OHLCVService logic)
// ═══════════════════════════════════════════════════════════════════════════════

const CELO_NATIVE_STABLECOINS = new Set([
  'CUSD', 'CEUR', 'CKES', 'CREAL', 'EXOF',
]);

function isCeloNativeSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  if (CELO_NATIVE_STABLECOINS.has(upper)) return true;
  const [base, quote] = upper.split('/');
  if (quote && CELO_NATIVE_STABLECOINS.has(quote)) return true;
  if (base && CELO_NATIVE_STABLECOINS.has(base)) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param symbol     e.g. 'BTC/USDT', 'CELO/cUSD', 'SOL/USDC'
 * @param timeframe  '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
 * @param limit      number of candles (max 500)
 * @param source     'auto' | 'cex' | 'dex' | 'binance' | 'kraken' | 'coinbase' | 'kucoin'
 *                   'auto'  → detects Celo symbols → DEX, rest → CEX
 *                   'cex'   → force CEX path (uses binance as default exchange)
 *                   'dex'   → force DEX/Celo path
 *                   concrete exchange name → pinned to that CEX
 */
export const useOHLCV = (
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

  // ── CEX PATH ───────────────────────────────────────────────────────────────
  // Delegate to the existing shared hook. We only call it when resolvedSource
  // is NOT 'dex'. Passing an empty symbol prevents the CEX hook from fetching
  // when we're on the DEX path.
  const cexExchange = resolvedSource === 'cex' ? 'binance' : resolvedSource;
  const cexResult = useCEXOHLCV(
    resolvedSource !== 'dex' ? symbol : '',
    timeframe,
    limit,
    cexExchange
  );

  // ── DEX PATH ───────────────────────────────────────────────────────────────
  const [dexState, setDexState] = useState<{
    candles: OHLCVCandle[] | null;
    loading: boolean;
    error: string | null;
    isRefetching: boolean;
    pairAddress: string | null;
  }>({
    candles: null,
    loading: resolvedSource === 'dex',
    error: null,
    isRefetching: false,
    pairAddress: null,
  });
  const dexPairAddressRef = useRef<string | null>(null);

  const fetchDEX = useCallback(async (isRefetch = false) => {
    if (resolvedSource !== 'dex') return;

    setDexState(prev => ({
      ...prev,
      loading: !isRefetch,
      isRefetching: isRefetch,
      error: null,
    }));

    try {
      // Use the backend OHLCV service endpoint for the DEX path.
      const response = await fetch(
        `/api/exchanges/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}&exchange=dex`,
        { headers: { Accept: 'application/json' } }
      );

      if (!response.ok) {
        throw new Error(`DEX fetch failed: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();

      if (payload.status === 'error') {
        throw new Error(payload.error || 'DEX data unavailable');
      }

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
      setDexState({
        candles: normalized,
        loading: false,
        error: null,
        isRefetching: false,
        pairAddress,
      });
    } catch (err: any) {
      setDexState({
        candles: null,
        loading: false,
        error: err.message || 'DEX fetch error',
        isRefetching: false,
        pairAddress: null,
      });
    }
  }, [resolvedSource, symbol, timeframe, limit]);

  useEffect(() => {
    if (resolvedSource === 'dex') {
      fetchDEX();
    }
  }, [resolvedSource, fetchDEX]);

  useEffect(() => {
    if (resolvedSource !== 'dex') return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: number | null = null;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/api/market-stream`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        console.debug('[useOHLCV] connected to market stream');
      };

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

            return {
              ...prev,
              candles: nextCandles,
            };
          });
        } catch (error) {
          console.error('[useOHLCV] failed to parse market-stream message', error);
        }
      };

      ws.onerror = () => {
        console.warn('[useOHLCV] market stream error');
      };

      ws.onclose = () => {
        if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
        reconnectTimeout = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [resolvedSource, symbol, timeframe, limit]);

  // ── RETURN ─────────────────────────────────────────────────────────────────

  if (resolvedSource === 'dex') {
    return {
      candles: dexState.candles,
      loading: dexState.loading,
      error: dexState.error,
      source: dexState.candles ? 'dexscreener' : null,
      refetch: () => fetchDEX(true),
      isRefetching: dexState.isRefetching,
    };
  }

  // Normalize CEX output (timestamps in ms → seconds)
  const normalized = cexResult.candles
    ? cexResult.candles.map((c: CEXCandle) => ({
        timestamp: Math.floor(c.timestamp / 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
      }))
    : null;

  return {
    candles: normalized,
    loading: cexResult.loading,
    error: cexResult.error,
    source: cexResult.source ?? cexExchange,
    refetch: cexResult.refetch,
    isRefetching: cexResult.isRefetching,
  };
};

export default useOHLCV;
