/**
 * Hook for fetching technical indicators
 */

import { useQuery } from '@tanstack/react-query';

export interface TechnicalIndicatorsResponse {
  symbol: string;
  exchange: string;
  timeframe: string;
  count: number;
  timestamp: number;
  indicators: {
    rsi: {
      value: number;
      signal: 'oversold' | 'neutral' | 'overbought';
    };
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
    signals: {
      bullish: number;
      bearish: number;
      neutral: number;
    };
  };
}

export const useTechnicalIndicators = (
  symbol: string,
  exchange: string = 'binance',
  timeframe: string = '1d',
  enabled: boolean = true
) => {
  return useQuery<TechnicalIndicatorsResponse>({
    queryKey: ['technicalIndicators', symbol, exchange, timeframe],
    queryFn: async () => {
      const response = await fetch(
        `/api/exchanges/technicals?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}&timeframe=${encodeURIComponent(timeframe)}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch technical indicators');
      }

      return response.json();
    },
    enabled: enabled && !!symbol && !!exchange,
    retry: 2,
  } as any);
};

/**
 * Get color for RSI value
 */
export const getRSIColor = (value: number): string => {
  if (value < 30) return 'text-green-500'; // Oversold - buy signal
  if (value > 70) return 'text-red-500'; // Overbought - sell signal
  return 'text-yellow-500'; // Neutral
};

/**
 * Get color for MACD histogram
 */
export const getMACDColor = (histogram: number): string => {
  if (histogram > 0) return 'text-green-500'; // Bullish
  if (histogram < 0) return 'text-red-500'; // Bearish
  return 'text-gray-500'; // Neutral
};

/**
 * Get color for Bollinger Bands position
 */
export const getBBColor = (position: string): string => {
  if (position === 'below') return 'text-green-500'; // Buy signal
  if (position === 'above') return 'text-red-500'; // Sell signal
  return 'text-blue-500'; // Neutral
};

/**
 * Get signal strength description
 */
export const getSignalStrength = (bullish: number, bearish: number, neutral: number): string => {
  const total = bullish + bearish + neutral;
  const bullishPercent = (bullish / total) * 100;

  if (bullishPercent >= 75) return 'Strong Bullish';
  if (bullishPercent >= 50) return 'Bullish';
  if (bullishPercent >= 25) return 'Neutral';
  return 'Bearish';
};

/**
 * Get signal strength color
 */
export const getSignalColor = (bullish: number, bearish: number): string => {
  if (bullish > bearish + 1) return 'text-green-600';
  if (bearish > bullish + 1) return 'text-red-600';
  return 'text-yellow-600';
};
