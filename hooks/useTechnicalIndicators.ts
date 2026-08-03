/**
 * useTechnicalIndicators Hook
 *
 * Fetches technical indicators from the YUKI indicators service.
 * Supports single snapshot, multi-timeframe analysis, and chart data.
 *
 * Updated signature: object argument instead of positional params
 *
 * Usage:
 *   const { data, isLoading, error } = useTechnicalIndicators({
 *     symbol: 'BTC',
 *     timeframe: '1d',
 *     exchange: 'binance',
 *     source: 'cex' // 'cex' | 'dex' | 'auto'
 *   });
 *
 *   const multi = useTechnicalIndicators({
 *     symbol: 'ETH',
 *     mode: 'multi-timeframe',
 *     macro: '1h',
 *     micro: '5m'
 *   });
 *
 *   const chart = useTechnicalIndicators({
 *     symbol: 'CELO',
 *     mode: 'chart',
 *     timeframe: '1h',
 *     limit: 200
 *   });
 */

import { useCallback, useEffect, useState } from 'react';

// Types matching the backend response
export interface EnhancedTechnicalResult {
  symbol: string;
  timeframe: string;
  regime: {
    trend: string;
    strength: number;
    confidence: number;
  };
  candleCount: number;
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    position: string;
  };
  signals: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  weightedSignal: number;
  confidence: number;
  delta?: {
    rsi: number;
    macd: number;
  };
  [key: string]: any;
}

export interface ChartCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  atr?: number;
  stochK?: number;
  stochD?: number;
  obv?: number;
  mfi?: number;
  cci?: number;
  adx?: number;
  tenkan?: number;
  kijun?: number;
  senkouA?: number;
  senkouB?: number;
  chikou?: number;
  [key: string]: any;
}

export interface ChartResponse {
  symbol: string;
  timeframe: string;
  count: number;
  source: string;
  timestamp: number;
  candles: ChartCandle[];
  fibonacci?: any;
  volumeProfile?: any;
}

export interface MultiTimeframeResult {
  symbol: string;
  macro: EnhancedTechnicalResult;
  micro: EnhancedTechnicalResult;
  alignment: {
    aligned: boolean;
    strength: number;
    divergence: number;
  };
}

export interface UseTechnicalIndicatorsParams {
  symbol: string;
  timeframe?: string;
  exchange?: string;
  source?: 'cex' | 'dex' | 'auto';
  mode?: 'snapshot' | 'multi-timeframe' | 'chart';
  macro?: string;
  micro?: string;
  limit?: number;
}

export interface UseTechnicalIndicatorsResult<T = any> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  meta?: Record<string, any>;
}

export function useTechnicalIndicators(
  params: UseTechnicalIndicatorsParams
): UseTechnicalIndicatorsResult {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    symbol,
    timeframe = '1d',
    exchange = 'binance',
    source = 'auto',
    mode = 'snapshot',
    macro = '1h',
    micro = '5m',
    limit = 200,
  } = params;

  const buildUrl = useCallback(() => {
    const baseUrl = '/api/v1/yuki/indicators';
    const params = new URLSearchParams();

    if (mode === 'snapshot') {
      params.append('timeframe', timeframe);
      params.append('exchange', exchange);
      params.append('source', source);
      return `${baseUrl}/${symbol}?${params.toString()}`;
    } else if (mode === 'multi-timeframe') {
      params.append('macro', macro);
      params.append('micro', micro);
      params.append('exchange', exchange);
      params.append('source', source);
      return `${baseUrl}/${symbol}/multi-timeframe?${params.toString()}`;
    } else if (mode === 'chart') {
      params.append('timeframe', timeframe);
      params.append('exchange', exchange);
      params.append('source', source);
      params.append('limit', limit.toString());
      return `${baseUrl}/${symbol}/chart?${params.toString()}`;
    }

    return '';
  }, [symbol, timeframe, exchange, source, mode, macro, micro, limit]);

  const fetchIndicators = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const url = buildUrl();
      if (!url) {
        throw new Error('Invalid parameters for technical indicators');
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || errorData.error || `HTTP ${response.status}`
        );
      }

      const result = await response.json();
      setData(result.data || result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    fetchIndicators();
  }, [fetchIndicators]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchIndicators,
  };
}

// Convenience hook for snapshot mode (most common)
export function useTechnicalSnapshot(
  symbol: string,
  options?: Omit<UseTechnicalIndicatorsParams, 'symbol' | 'mode'>
): UseTechnicalIndicatorsResult<EnhancedTechnicalResult> {
  return useTechnicalIndicators({
    symbol,
    mode: 'snapshot',
    ...options,
  });
}

// Convenience hook for chart mode
export function useTechnicalChart(
  symbol: string,
  options?: Omit<UseTechnicalIndicatorsParams, 'symbol' | 'mode'>
): UseTechnicalIndicatorsResult<ChartResponse> {
  return useTechnicalIndicators({
    symbol,
    mode: 'chart',
    ...options,
  });
}

// Convenience hook for multi-timeframe mode
export function useTechnicalMultiTimeframe(
  symbol: string,
  options?: Omit<UseTechnicalIndicatorsParams, 'symbol' | 'mode'>
): UseTechnicalIndicatorsResult<MultiTimeframeResult> {
  return useTechnicalIndicators({
    symbol,
    mode: 'multi-timeframe',
    ...options,
  });
}

export default useTechnicalIndicators;
