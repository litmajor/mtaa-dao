// hooks/useTechnicalIndicators.ts
import { useQuery } from '@tanstack/react-query';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES (mirror the v2 service exports so the frontend is type-safe)
// ═══════════════════════════════════════════════════════════════════════════════

export type MarketRegime = 'trending' | 'range' | 'high_volatility' | 'low_volatility';

export interface WeightedSignal {
  indicator: 'rsi' | 'macd' | 'bb' | 'ma_cross';
  signal: 'bullish' | 'bearish' | 'neutral';
  value: number;
  base_weight: number;
  regime_weight: number;
  final_weight: number;
  confidence: number;
}

export interface SignalDelta {
  signalChanged: boolean;
  confidenceShift: number;
  newAcceleration: boolean;
  regimeShift: boolean;
  volatilityTrend: 'increasing' | 'stable' | 'decreasing';
  strength: number;
}

export interface EnhancedTechnicalResult {
  symbol: string;
  exchange: string;
  timeframe: string;
  timestamp: number;
  candleCount: number;
  ohlcvDataSource: string;
  fetchedAt: number;

  rsi: { value: number; signal: 'oversold' | 'neutral' | 'overbought' };
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    position: 'bearish' | 'neutral' | 'bullish';
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    position: 'above' | 'within' | 'below';
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    sma200: number;
    ema12: number;
    ema26: number;
  };
  signals: { bullish: number; bearish: number; neutral: number };

  regime: MarketRegime;
  volatility: number;
  weightedSignals: WeightedSignal[];
  overallConfidence: number;
  signalState: {
    timestamp: number;
    symbol: string;
    timeframe: string;
    overallSignal: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    weightedSignals: WeightedSignal[];
    regime: MarketRegime;
    volatility: number;
    accelerating: boolean;
  };
  previousState?: EnhancedTechnicalResult['signalState'];
  delta?: SignalDelta;

  priceRange: { min: number; max: number; avg: number };
  volumeMetrics: { avgVolume: number; maxVolume: number; minVolume: number };
}

export interface MultiTimeframeResponse {
  symbol: string;
  exchange: string;
  timestamp: number;
  macroTrend: {
    timeframe: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    support: number;
    resistance: number;
  };
  microEntry: {
    timeframe: string;
    signal: 'buy' | 'sell' | 'hold';
    confirmation: boolean;
    urgency: number;
  };
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  aggregateConfidence: number;
}

export interface UseTechnicalIndicatorsOptions {
  symbol: string;
  timeframe?: string;
  exchange?: string;
  source?: 'cex' | 'dex' | 'auto';
  enabled?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enhanced snapshot: regime, weighted signals, confidence, delta
 * GET /v1/yuki/indicators/:symbol
 */
export const useTechnicalIndicators = ({
  symbol,
  timeframe = '1d',
  exchange = 'binance',
  source = 'auto',
  enabled = true,
}: UseTechnicalIndicatorsOptions) => {
  const params = new URLSearchParams({
    timeframe,
    exchange,
    source,
  });

  return useQuery<EnhancedTechnicalResult>({
    queryKey: ['technicalIndicators', symbol, timeframe, exchange, source],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/yuki/indicators/${encodeURIComponent(symbol)}?${params.toString()}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error || 'Failed to fetch indicators');
      }
      const json = await res.json();
      return json.data;
    },
    enabled: enabled && !!symbol,
    staleTime: 60_000,
  });
};

/**
 * Multi-timeframe analysis (macro trend + micro entry)
 * GET /v1/yuki/indicators/:symbol/multi-timeframe
 */
export const useMultiTimeframeIndicators = ({
  symbol,
  exchange = 'binance',
  source = 'auto',
  enabled = true,
  macro = '1h',
  micro = '5m',
}: UseTechnicalIndicatorsOptions & { macro?: string; micro?: string }) => {
  const params = new URLSearchParams({
    macro,
    micro,
    exchange,
    source,
  });

  return useQuery<MultiTimeframeResponse>({
    queryKey: ['multiTimeframeIndicators', symbol, macro, micro, exchange, source],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/yuki/indicators/${encodeURIComponent(symbol)}/multi-timeframe?${params.toString()}`
      );
      if (!res.ok) throw new Error('Failed to fetch multi-timeframe analysis');
      const json = await res.json();
      return json.data;
    },
    enabled: enabled && !!symbol,
    staleTime: 120_000,
  });
};

/**
 * Chart time-series (candles + indicator arrays)
 * GET /v1/yuki/indicators/:symbol/chart
 */
export const useIndicatorChart = ({
  symbol,
  timeframe = '1d',
  exchange = 'binance',
  source = 'auto',
  limit = 200,
  enabled = true,
}: UseTechnicalIndicatorsOptions & { limit?: number }) => {
  const params = new URLSearchParams({
    timeframe,
    exchange,
    source,
    limit: String(limit),
  });

  return useQuery({
    queryKey: ['indicatorChart', symbol, timeframe, exchange, source, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/yuki/indicators/${encodeURIComponent(symbol)}/chart?${params.toString()}`
      );
      if (!res.ok) throw new Error('Failed to fetch chart indicators');
      const json = await res.json();
      return json.data;
    },
    enabled: enabled && !!symbol,
    staleTime: 300_000,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export const getRSIColor = (value: number): string => {
  if (value < 30) return 'text-green-500';
  if (value > 70) return 'text-red-500';
  return 'text-yellow-500';
};

export const getMACDColor = (histogram: number): string => {
  if (histogram > 0) return 'text-green-500';
  if (histogram < 0) return 'text-red-500';
  return 'text-gray-500';
};

export const getRegimeColor = (regime: MarketRegime): string => {
  switch (regime) {
    case 'trending': return 'text-blue-500';
    case 'range': return 'text-purple-500';
    case 'high_volatility': return 'text-orange-500';
    case 'low_volatility': return 'text-emerald-500';
  }
};

export const getRegimeLabel = (regime: MarketRegime): string => {
  switch (regime) {
    case 'trending': return 'Trending';
    case 'range': return 'Range-bound';
    case 'high_volatility': return 'High Volatility';
    case 'low_volatility': return 'Low Volatility';
  }
};

export const getConfidenceBadge = (confidence: number) => {
  if (confidence >= 75) return { label: 'High Conviction', color: 'bg-green-100 text-green-800' };
  if (confidence >= 55) return { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' };
  return { label: 'Uncertain', color: 'bg-gray-100 text-gray-800' };
};

export const getRecommendationColor = (
  rec: MultiTimeframeResponse['recommendation']
): string => {
  switch (rec) {
    case 'strong_buy': return 'text-green-700 font-bold';
    case 'buy': return 'text-green-600';
    case 'hold': return 'text-yellow-600';
    case 'sell': return 'text-red-600';
    case 'strong_sell': return 'text-red-700 font-bold';
  }
};