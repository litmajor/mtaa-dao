/**
 * ════════════════════════════════════════════════════════════════════════════════
 * Complete Technical Indicator Library — Array-Based
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Production-grade technical indicators that return time-series arrays.
 * Each function takes price/volume arrays and returns aligned arrays of indicator values.
 *
 * Usage:
 *   const closes = candles.map(c => c.close);
 *   const rsiValues = rsi(closes, 14);
 *   // rsiValues[i] = RSI(14) at candle i
 */

// ════════════════════════════════════════════════════════════════════════════════
// SIMPLE & EXPONENTIAL MOVING AVERAGES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Simple Moving Average
 * @param closes Closing prices
 * @param period SMA period
 * @returns Array of SMA values (NaN for periods < period)
 */
export function sma(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Exponential Moving Average
 * @param closes Closing prices
 * @param period EMA period
 * @returns Array of EMA values
 */
export function ema(closes: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);

  let currentEma: number | null = null;

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      // Initialize EMA with SMA
      currentEma = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(currentEma);
    } else {
      currentEma = closes[i] * k + currentEma! * (1 - k);
      result.push(currentEma);
    }
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// RELATIVE STRENGTH INDEX (RSI)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Relative Strength Index (RSI)
 * @param closes Closing prices
 * @param period RSI period (default 14)
 * @returns Array of RSI values (0-100)
 */
export function rsi(closes: number[], period: number = 14): number[] {
  const result: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(NaN);
      continue;
    }

    const changes = [];
    for (let j = i - period + 1; j <= i; j++) {
      changes.push(closes[j] - closes[j - 1]);
    }

    const gains = changes.filter((c) => c > 0).reduce((a, b) => a + b, 0) / period;
    const losses = Math.abs(changes.filter((c) => c < 0).reduce((a, b) => a + b, 0)) / period;

    const rs = losses === 0 ? (gains === 0 ? 50 : 100) : gains / losses;
    const rsiValue = 100 - 100 / (1 + rs);

    result.push(rsiValue);
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// MACD (MOVING AVERAGE CONVERGENCE DIVERGENCE)
// ════════════════════════════════════════════════════════════════════════════════

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

/**
 * MACD - Moving Average Convergence Divergence
 * @param closes Closing prices
 * @param fast Fast EMA period (default 12)
 * @param slow Slow EMA period (default 26)
 * @param signal Signal line period (default 9)
 * @returns Object with macd, signal, and histogram arrays
 */
export function macd(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): MACDResult {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);

  const macdLine: number[] = fastEma.map((f, i) =>
    isNaN(f) || isNaN(slowEma[i]) ? NaN : f - slowEma[i]
  );

  const signalLine = ema(macdLine.filter((v) => !isNaN(v)), signal);
  const signalFilled: number[] = [];
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) {
      signalFilled.push(NaN);
    } else {
      signalFilled.push(signalLine[signalIdx] ?? NaN);
      signalIdx++;
    }
  }

  const histogram = macdLine.map((m, i) =>
    isNaN(m) || isNaN(signalFilled[i]) ? NaN : m - signalFilled[i]
  );

  return { macd: macdLine, signal: signalFilled, histogram };
}

// ════════════════════════════════════════════════════════════════════════════════
// BOLLINGER BANDS
// ════════════════════════════════════════════════════════════════════════════════

export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

/**
 * Bollinger Bands
 * @param closes Closing prices
 * @param period MA period (default 20)
 * @param stdDev Standard deviation multiplier (default 2)
 * @returns Object with upper, middle, lower arrays
 */
export function bollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsResult {
  const smaValues = sma(closes, period);

  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1 || isNaN(smaValues[i])) {
      upper.push(NaN);
      middle.push(NaN);
      lower.push(NaN);
      continue;
    }

    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
    const std = Math.sqrt(variance);

    middle.push(mean);
    upper.push(mean + stdDev * std);
    lower.push(mean - stdDev * std);
  }

  return { upper, middle, lower };
}

// ════════════════════════════════════════════════════════════════════════════════
// AVERAGE TRUE RANGE (ATR)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Average True Range
 * @param highs High prices
 * @param lows Low prices
 * @param closes Close prices
 * @param period ATR period (default 14)
 * @returns Array of ATR values
 */
export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const result: number[] = [];

  // Calculate true ranges
  const trueRanges: number[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i === 0) {
      trueRanges.push(highs[0] - lows[0]);
    } else {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
  }

  // Calculate ATR using EMA
  let atrValue: number | null = null;
  const k = 2 / (period + 1);

  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      atrValue = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(atrValue);
    } else {
      atrValue = trueRanges[i] * k + atrValue! * (1 - k);
      result.push(atrValue);
    }
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// STOCHASTIC OSCILLATOR
// ════════════════════════════════════════════════════════════════════════════════

export interface StochasticResult {
  k: number[];
  d: number[];
}

/**
 * Stochastic Oscillator
 * @param highs High prices
 * @param lows Low prices
 * @param closes Close prices
 * @param period Stochastic period (default 14)
 * @param smoothK K smoothing period (default 3)
 * @returns Object with k and d arrays
 */
export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
  smoothK: number = 3
): StochasticResult {
  const k: number[] = [];

  // Calculate raw %K
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      k.push(NaN);
      continue;
    }

    const slice = closes.slice(i - period + 1, i + 1);
    const high = Math.max(...highs.slice(i - period + 1, i + 1));
    const low = Math.min(...lows.slice(i - period + 1, i + 1));

    if (high === low) {
      k.push(50);
    } else {
      k.push(((closes[i] - low) / (high - low)) * 100);
    }
  }

  // Smooth %K using SMA
  const kSmoothed = sma(k.filter((v) => !isNaN(v)), smoothK);
  const kFilled: number[] = [];
  let kIdx = 0;
  for (let i = 0; i < k.length; i++) {
    if (isNaN(k[i])) {
      kFilled.push(NaN);
    } else {
      kFilled.push(kSmoothed[kIdx] ?? NaN);
      kIdx++;
    }
  }

  // %D is SMA of %K
  const d = sma(kFilled.filter((v) => !isNaN(v)), 3);
  const dFilled: number[] = [];
  let dIdx = 0;
  for (let i = 0; i < kFilled.length; i++) {
    if (isNaN(kFilled[i])) {
      dFilled.push(NaN);
    } else {
      dFilled.push(d[dIdx] ?? NaN);
      dIdx++;
    }
  }

  return { k: kFilled, d: dFilled };
}

// ════════════════════════════════════════════════════════════════════════════════
// ON-BALANCE VOLUME (OBV)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * On-Balance Volume
 * @param closes Closing prices
 * @param volumes Trading volumes
 * @returns Array of OBV values (cumulative)
 */
export function obv(closes: number[], volumes: number[]): number[] {
  const result: number[] = [volumes[0] || 0];

  for (let i = 1; i < closes.length; i++) {
    let change = 0;
    if (closes[i] > closes[i - 1]) {
      change = volumes[i] || 0;
    } else if (closes[i] < closes[i - 1]) {
      change = -(volumes[i] || 0);
    }
    result.push(result[i - 1] + change);
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY FLOW INDEX (MFI)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Money Flow Index
 * @param highs High prices
 * @param lows Low prices
 * @param closes Close prices
 * @param volumes Trading volumes
 * @param period MFI period (default 14)
 * @returns Array of MFI values (0-100)
 */
export function mfi(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 14
): number[] {
  const result: number[] = [];

  const typicalPrices = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const rawMoneyFlow = typicalPrices.map((tp, i) => tp * (volumes[i] || 0));

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }

    const slice = rawMoneyFlow.slice(i - period + 1, i + 1);
    const priceSlice = closes.slice(i - period + 1, i + 1);

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = 0; j < slice.length; j++) {
      if (priceSlice[j] > (priceSlice[j - 1] ?? 0)) {
        positiveFlow += slice[j];
      } else if (priceSlice[j] < (priceSlice[j - 1] ?? 0)) {
        negativeFlow += slice[j];
      }
    }

    const mfiRatio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
    const mfiValue = 100 - 100 / (1 + mfiRatio);

    result.push(mfiValue);
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// COMMODITY CHANNEL INDEX (CCI)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Commodity Channel Index
 * @param highs High prices
 * @param lows Low prices
 * @param closes Close prices
 * @param period CCI period (default 20)
 * @returns Array of CCI values
 */
export function cci(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20
): number[] {
  const result: number[] = [];

  const typicalPrices = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const smaValues = sma(typicalPrices, period);

  for (let i = 0; i < typicalPrices.length; i++) {
    if (i < period - 1 || isNaN(smaValues[i])) {
      result.push(NaN);
      continue;
    }

    const slice = typicalPrices.slice(i - period + 1, i + 1);
    const mean = smaValues[i];
    const meanDeviation = slice.reduce((acc, val) => acc + Math.abs(val - mean), 0) / period;

    const cci = meanDeviation === 0 ? 0 : (typicalPrices[i] - mean) / (0.015 * meanDeviation);
    result.push(cci);
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// AVERAGE DIRECTIONAL INDEX (ADX)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Average Directional Index
 * @param highs High prices
 * @param lows Low prices
 * @param closes Close prices
 * @param period ADX period (default 14)
 * @returns Array of ADX values (0-100)
 */
export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const result: number[] = [];

  // Calculate directional movements
  const upMove: number[] = [];
  const downMove: number[] = [];

  for (let i = 0; i < highs.length; i++) {
    if (i === 0) {
      upMove.push(0);
      downMove.push(0);
    } else {
      const up = highs[i] - highs[i - 1];
      const down = lows[i - 1] - lows[i];

      upMove.push(Math.max(up, 0));
      downMove.push(Math.max(down, 0));
    }
  }

  // If both > 0, take the larger one, set other to 0
  for (let i = 0; i < upMove.length; i++) {
    if (upMove[i] > 0 && downMove[i] > 0) {
      if (upMove[i] > downMove[i]) {
        downMove[i] = 0;
      } else {
        upMove[i] = 0;
      }
    }
  }

  // Calculate ADX
  let plusDI: number | null = null;
  let minusDI: number | null = null;
  let atrVal: number | null = null;
  const atrValues = atr(highs, lows, closes, period);

  for (let i = 0; i < upMove.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      plusDI =
        (upMove.slice(0, period).reduce((a, b) => a + b, 0) / atrValues[i]) * 100;
      minusDI =
        (downMove.slice(0, period).reduce((a, b) => a + b, 0) / atrValues[i]) * 100;
      const di = Math.abs(plusDI - minusDI) / (plusDI + minusDI) || 0;
      result.push(di * 100);
    } else {
      plusDI = plusDI! * (1 - 1 / period) + (upMove[i] / atrValues[i]) * 100 * (1 / period);
      minusDI = minusDI! * (1 - 1 / period) + (downMove[i] / atrValues[i]) * 100 * (1 / period);
      const di = Math.abs(plusDI - minusDI) / (plusDI + minusDI) || 0;
      result.push(di * 100);
    }
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// ICHIMOKU CLOUD
// ════════════════════════════════════════════════════════════════════════════════

export interface IchimokuResult {
  tenkan: number[];
  kijun: number[];
  senkouA: number[];
  senkouB: number[];
  chikou: number[];
}

/**
 * Ichimoku Cloud
 * @param highs High prices
 * @param lows Low prices
 * @param closes Close prices
 * @param fast Fast period (default 9)
 * @param medium Medium period (default 26)
 * @param slow Slow period (default 52)
 * @returns Object with ichimoku components
 */
export function ichimoku(
  highs: number[],
  lows: number[],
  closes: number[],
  fast: number = 9,
  medium: number = 26,
  slow: number = 52
): IchimokuResult {
  const tenkan: number[] = [];
  const kijun: number[] = [];
  const senkouA: number[] = [];
  const senkouB: number[] = [];
  const chikou: number[] = [];

  // Tenkan-sen (9-period high-low / 2)
  for (let i = 0; i < closes.length; i++) {
    if (i < fast - 1) {
      tenkan.push(NaN);
    } else {
      const h = Math.max(...highs.slice(i - fast + 1, i + 1));
      const l = Math.min(...lows.slice(i - fast + 1, i + 1));
      tenkan.push((h + l) / 2);
    }
  }

  // Kijun-sen (26-period high-low / 2)
  for (let i = 0; i < closes.length; i++) {
    if (i < medium - 1) {
      kijun.push(NaN);
    } else {
      const h = Math.max(...highs.slice(i - medium + 1, i + 1));
      const l = Math.min(...lows.slice(i - medium + 1, i + 1));
      kijun.push((h + l) / 2);
    }
  }

  // Senkou Span A (displaced 26 periods forward)
  for (let i = 0; i < closes.length; i++) {
    if (i < medium - 1) {
      senkouA.push(NaN);
    } else {
      senkouA.push((tenkan[i] + kijun[i]) / 2);
    }
  }

  // Senkou Span B (52-period high-low / 2, displaced 26 periods forward)
  for (let i = 0; i < closes.length; i++) {
    if (i < slow - 1) {
      senkouB.push(NaN);
    } else {
      const h = Math.max(...highs.slice(i - slow + 1, i + 1));
      const l = Math.min(...lows.slice(i - slow + 1, i + 1));
      senkouB.push((h + l) / 2);
    }
  }

  // Chikou Span (close shifted back 26 periods)
  for (let i = 0; i < closes.length; i++) {
    if (i < medium) {
      chikou.push(NaN);
    } else {
      chikou.push(closes[i - medium]);
    }
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// ════════════════════════════════════════════════════════════════════════════════
// FIBONACCI LEVELS
// ════════════════════════════════════════════════════════════════════════════════

export interface FibonacciLevels {
  swing_high: number;
  swing_low: number;
  range: number;
  level_0: number;
  level_236: number;
  level_382: number;
  level_50: number;
  level_618: number;
  level_786: number;
  level_100: number;
}

/**
 * Fibonacci Levels
 * @param highs High prices
 * @param lows Low prices
 * @param closes Close prices
 * @param lookback Lookback period for swing identification (default 55)
 * @param mode 'swing' for swing high/low or 'trend' for trend-based
 * @returns Object with fibonacci levels
 */
export function fibLevels(
  highs: number[],
  lows: number[],
  closes: number[],
  lookback: number = 55,
  mode: 'swing' | 'trend' = 'swing'
): FibonacciLevels {
  if (highs.length < lookback) {
    lookback = highs.length;
  }

  const slice_highs = highs.slice(-lookback);
  const slice_lows = lows.slice(-lookback);

  const swing_high = Math.max(...slice_highs);
  const swing_low = Math.min(...slice_lows);
  const range = swing_high - swing_low;

  return {
    swing_high,
    swing_low,
    range,
    level_0: swing_high,
    level_236: swing_high - range * 0.236,
    level_382: swing_high - range * 0.382,
    level_50: swing_high - range * 0.5,
    level_618: swing_high - range * 0.618,
    level_786: swing_high - range * 0.786,
    level_100: swing_low,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// VOLUME PROFILE
// ════════════════════════════════════════════════════════════════════════════════

export interface VolumeProfileBucket {
  priceLevel: number;
  volume: number;
  volumePercent: number;
}

/**
 * Volume Profile
 * @param closes Close prices
 * @param volumes Trading volumes
 * @param buckets Number of price buckets (default 50)
 * @param lookback Lookback period (default 200)
 * @returns Array of volume profile buckets sorted by price
 */
export function volumeProfile(
  closes: number[],
  volumes: number[],
  buckets: number = 50,
  lookback: number = 200
): VolumeProfileBucket[] {
  if (closes.length < lookback) {
    lookback = closes.length;
  }

  const slice_closes = closes.slice(-lookback);
  const slice_volumes = volumes.slice(-lookback);

  const minPrice = Math.min(...slice_closes);
  const maxPrice = Math.max(...slice_closes);
  const bucketSize = (maxPrice - minPrice) / buckets;

  const volumeMap: Record<number, number> = {};

  for (let i = 0; i < slice_closes.length; i++) {
    const bucketIdx = Math.floor((slice_closes[i] - minPrice) / bucketSize);
    const bucketLevel = minPrice + bucketIdx * bucketSize;
    volumeMap[bucketLevel] = (volumeMap[bucketLevel] || 0) + (slice_volumes[i] || 0);
  }

  const totalVolume = Object.values(volumeMap).reduce((a, b) => a + b, 0) || 1;

  return Object.entries(volumeMap)
    .map(([price, vol]) => ({
      priceLevel: parseFloat(price),
      volume: vol,
      volumePercent: (vol / totalVolume) * 100,
    }))
    .sort((a, b) => a.priceLevel - b.priceLevel);
}
