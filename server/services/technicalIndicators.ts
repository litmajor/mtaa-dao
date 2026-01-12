/**
 * Technical Indicators Service
 * Calculates RSI, MACD, Bollinger Bands, and Moving Averages
 */

export interface TechnicalIndicatorsResult {
  symbol: string;
  exchange: string;
  timeframe: string;
  timestamp: number;
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
    bullish: number; // Count of bullish signals
    bearish: number; // Count of bearish signals
    neutral: number; // Count of neutral signals
  };
}

/**
 * Calculate Simple Moving Average
 * @param prices Array of prices
 * @param period Number of periods for MA
 * @returns SMA value
 */
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];

  const slice = prices.slice(-period);
  const sum = slice.reduce((acc, price) => acc + price, 0);
  return sum / period;
}

/**
 * Calculate Exponential Moving Average
 * @param prices Array of prices
 * @param period Number of periods for EMA
 * @returns EMA value
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];

  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

/**
 * Calculate Relative Strength Index (RSI)
 * @param prices Array of closing prices
 * @param period Period for RSI calculation (default 14)
 * @returns RSI value (0-100)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    return 50; // Default neutral
  }

  let gains = 0;
  let losses = 0;

  // Calculate first gains and losses
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate RSI for remaining prices
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) {
    return avgGain === 0 ? 50 : 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return Math.round(rsi * 100) / 100;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param prices Array of closing prices
 * @returns MACD, Signal line, and Histogram
 */
export function calculateMACD(prices: number[]): {
  macd: number;
  signal: number;
  histogram: number;
} {
  if (prices.length < 26) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;

  // Calculate signal line (9-period EMA of MACD)
  // For simplicity, we'll use a simplified approach
  let macdLine = [];
  for (let i = 25; i < prices.length; i++) {
    const e12 = calculateEMA(prices.slice(0, i + 1), 12);
    const e26 = calculateEMA(prices.slice(0, i + 1), 26);
    macdLine.push(e12 - e26);
  }

  const signal =
    macdLine.length >= 9
      ? calculateSMA(macdLine.slice(-9), 9)
      : macdLine[macdLine.length - 1] || 0;

  const histogram = macd - signal;

  return {
    macd: Math.round(macd * 10000) / 10000,
    signal: Math.round(signal * 10000) / 10000,
    histogram: Math.round(histogram * 10000) / 10000,
  };
}

/**
 * Calculate Bollinger Bands
 * @param prices Array of closing prices
 * @param period Period for moving average (default 20)
 * @param stdDev Standard deviations (default 2)
 * @returns Upper, Middle, and Lower bands
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): {
  upper: number;
  middle: number;
  lower: number;
} {
  if (prices.length < period) {
    return { upper: 0, middle: 0, lower: 0 };
  }

  const middle = calculateSMA(prices, period);
  const slice = prices.slice(-period);

  // Calculate standard deviation
  const variance =
    slice.reduce((acc, price) => acc + Math.pow(price - middle, 2), 0) /
    period;
  const standardDeviation = Math.sqrt(variance);

  const upper = middle + standardDeviation * stdDev;
  const lower = middle - standardDeviation * stdDev;

  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round(lower * 100) / 100,
  };
}

/**
 * Calculate all technical indicators
 * @param ohlcv Array of OHLCV data with { open, high, low, close, volume }
 * @param symbol Asset symbol
 * @param exchange Exchange name
 * @param timeframe Timeframe identifier
 * @returns Complete technical indicators result
 */
export function calculateAllIndicators(
  ohlcv: Array<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>,
  symbol: string,
  exchange: string,
  timeframe: string
): TechnicalIndicatorsResult {
  if (ohlcv.length < 26) {
    throw new Error(`Insufficient data: need at least 26 candles, got ${ohlcv.length}`);
  }

  const closes = ohlcv.map((candle) => candle.close);
  const timestamp = Date.now();

  // Calculate indicators
  const rsi = calculateRSI(closes);
  const macdData = calculateMACD(closes);
  const bbands = calculateBollingerBands(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = closes.length >= 200 ? calculateSMA(closes, 200) : closes[0];
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  // Determine current price position relative to Bollinger Bands
  const currentPrice = closes[closes.length - 1];
  let bbPosition: 'above' | 'within' | 'below' = 'within';
  if (currentPrice > bbands.upper) {
    bbPosition = 'above';
  } else if (currentPrice < bbands.lower) {
    bbPosition = 'below';
  }

  // Generate signals
  let bullishSignals = 0;
  let bearishSignals = 0;
  let neutralSignals = 0;

  // RSI signal
  if (rsi < 30) {
    bullishSignals++;
  } else if (rsi > 70) {
    bearishSignals++;
  } else {
    neutralSignals++;
  }

  // MACD signal
  if (macdData.histogram > 0 && macdData.macd > macdData.signal) {
    bullishSignals++;
  } else if (macdData.histogram < 0 && macdData.macd < macdData.signal) {
    bearishSignals++;
  } else {
    neutralSignals++;
  }

  // Bollinger Bands signal
  if (bbPosition === 'below') {
    bullishSignals++;
  } else if (bbPosition === 'above') {
    bearishSignals++;
  } else {
    neutralSignals++;
  }

  // Moving Average signal
  if (currentPrice > sma20 && sma20 > sma50 && sma50 > sma200) {
    bullishSignals++;
  } else if (currentPrice < sma20 && sma20 < sma50 && sma50 < sma200) {
    bearishSignals++;
  } else {
    neutralSignals++;
  }

  return {
    symbol,
    exchange,
    timeframe,
    timestamp,
    rsi: {
      value: Math.round(rsi * 100) / 100,
      signal: rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral',
    },
    macd: {
      macd: macdData.macd,
      signal: macdData.signal,
      histogram: macdData.histogram,
      position:
        macdData.histogram > 0
          ? 'bullish'
          : macdData.histogram < 0
            ? 'bearish'
            : 'neutral',
    },
    bollingerBands: {
      upper: bbands.upper,
      middle: bbands.middle,
      lower: bbands.lower,
      position: bbPosition,
    },
    movingAverages: {
      sma20: Math.round(sma20 * 100) / 100,
      sma50: Math.round(sma50 * 100) / 100,
      sma200: Math.round(sma200 * 100) / 100,
      ema12: Math.round(ema12 * 100) / 100,
      ema26: Math.round(ema26 * 100) / 100,
    },
    signals: {
      bullish: bullishSignals,
      bearish: bearishSignals,
      neutral: neutralSignals,
    },
  };
}

/**
 * Get strength of trend based on moving averages
 */
export function getTrendStrength(
  sma20: number,
  sma50: number,
  sma200: number,
  currentPrice: number
): 'strong_uptrend' | 'uptrend' | 'sideways' | 'downtrend' | 'strong_downtrend' {
  if (currentPrice > sma20 && sma20 > sma50 && sma50 > sma200) {
    return 'strong_uptrend';
  }
  if (currentPrice > sma20 && sma20 > sma50) {
    return 'uptrend';
  }
  if (currentPrice < sma20 && sma20 < sma50 && sma50 < sma200) {
    return 'strong_downtrend';
  }
  if (currentPrice < sma20 && sma20 < sma50) {
    return 'downtrend';
  }
  return 'sideways';
}

/**
 * Get volatility indicator based on Bollinger Bands
 */
export function getBollingerBandVolatility(
  upper: number,
  lower: number,
  middle: number
): number {
  const bandwidth = ((upper - lower) / middle) * 100;
  return Math.round(bandwidth * 100) / 100;
}
