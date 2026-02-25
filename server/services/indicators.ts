/**
 * Complete Technical Indicator Library
 * 
 * Implementations are intentionally small and dependency-free so they can
 * be audited and adjusted to match the original Python behavior precisely.
 */

// ========== MOVING AVERAGES ==========

/** Simple moving average (SMA)
 * Returns an array of same length where values before `period-1` are NaN.
 */
export function sma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average (EMA)
 * Uses the recursive EMA formula with initial value set to the SMA of first period.
 * Returns an array where entries before `period-1` are NaN.
 */
export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period <= 0) return out;
  const alpha = 2 / (period + 1);
  if (values.length >= period) {
    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[i];
    let prev = sum / period;
    out[period - 1] = prev;
    for (let i = period; i < values.length; i++) {
      const v = values[i];
      const next = alpha * v + (1 - alpha) * prev;
      out[i] = next;
      prev = next;
    }
  }
  return out;
}

/** Volume-weighted moving average (VWMA)
 */
export function vwma(values: number[], volume: number[], period: number) {
  const n = values.length;
  const out = new Array<number>(n).fill(NaN);
  if (period <= 0) return out;
  for (let i = period - 1; i < n; i++) {
    let num = 0;
    let den = 0;
    for (let j = i - period + 1; j <= i; j++) {
      num += values[j] * (volume[j] ?? 0);
      den += (volume[j] ?? 0);
    }
    out[i] = den === 0 ? NaN : num / den;
  }
  return out;
}

// ========== TREND INDICATORS ==========

/** MACD (Moving Average Convergence Divergence)
 * Computes macd line (fastEMA - slowEMA), signal line (EMA of macd), and histogram.
 * Returns arrays of same length where insufficient-history entries are NaN.
 */
export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine = new Array<number>(values.length).fill(NaN);
  
  for (let i = 0; i < values.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (!Number.isNaN(f) && !Number.isNaN(s)) macdLine[i] = f - s;
  }
  
  // Calculate signal line only on valid MACD values
  const validMacd: number[] = [];
  let firstValidIdx = -1;
  for (let i = 0; i < macdLine.length; i++) {
    if (!Number.isNaN(macdLine[i])) {
      if (firstValidIdx === -1) firstValidIdx = i;
      validMacd.push(macdLine[i]);
    }
  }
  
  const signalEma = ema(validMacd, signal);
  const signalLine = new Array<number>(values.length).fill(NaN);
  for (let i = 0; i < signalEma.length; i++) {
    if (!Number.isNaN(signalEma[i])) {
      signalLine[firstValidIdx + i] = signalEma[i];
    }
  }
  
  const histogram = new Array<number>(values.length).fill(NaN);
  for (let i = 0; i < values.length; i++) {
    const m = macdLine[i];
    const sig = signalLine[i];
    if (!Number.isNaN(m) && !Number.isNaN(sig)) histogram[i] = m - sig;
  }
  
  return { macd: macdLine, signal: signalLine, histogram };
}

/** Average Directional Index (ADX)
 * Measures trend strength (not direction). Values above 25 indicate strong trend.
 */
export function adx(high: number[], low: number[], close: number[], period = 14) {
  const n = close.length;
  const out = new Array<number>(n).fill(NaN);
  if (high.length !== n || low.length !== n) return out;
  const tr: number[] = new Array(n).fill(0);
  const dmPlus: number[] = new Array(n).fill(0);
  const dmMinus: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]));
    const upMove = high[i] - high[i - 1];
    const downMove = low[i - 1] - low[i];
    dmPlus[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
    dmMinus[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
  }
  
  function smooth(arr: number[]) {
    const s = new Array<number>(n).fill(0);
    let sum = 0;
    for (let i = 1; i <= period; i++) sum += arr[i];
    s[period] = sum;
    for (let i = period + 1; i < n; i++) {
      s[i] = s[i - 1] - s[i - 1] / period + arr[i];
    }
    return s;
  }
  const sTR = smooth(tr);
  const sDMp = smooth(dmPlus);
  const sDMm = smooth(dmMinus);
  const diPlus = new Array<number>(n).fill(NaN);
  const diMinus = new Array<number>(n).fill(NaN);
  for (let i = period; i < n; i++) {
    if (sTR[i] === 0) continue;
    diPlus[i] = (sDMp[i] / sTR[i]) * 100;
    diMinus[i] = (sDMm[i] / sTR[i]) * 100;
    const dx = Math.abs(diPlus[i] - diMinus[i]) / (diPlus[i] + diMinus[i]) * 100;
    out[i] = dx;
  }
  
  const adxArr = new Array<number>(n).fill(NaN);
  let dxSum = 0;
  for (let i = period; i < n; i++) {
    if (!Number.isNaN(out[i])) {
      dxSum += out[i];
    }
    if (i === period + period - 1) {
      adxArr[i] = dxSum / period;
    } else if (i > period + period - 1) {
      adxArr[i] = (adxArr[i - 1] * (period - 1) + out[i]) / period;
    }
  }
  return adxArr;
}

/** Parabolic SAR
 * Trend-following indicator that provides entry/exit points.
 * When price crosses SAR, trend reverses.
 */
export function parabolicSAR(
  high: number[],
  low: number[],
  close: number[],
  accelStart = 0.02,
  accelMax = 0.2,
  accelIncrement = 0.02
) {
  const n = close.length;
  const sar = new Array<number>(n).fill(NaN);
  if (n < 2) return sar;
  
  let isLong = close[1] > close[0];
  let ep = isLong ? Math.max(high[0], high[1]) : Math.min(low[0], low[1]);
  let accel = accelStart;
  sar[0] = isLong ? Math.min(low[0], low[1]) : Math.max(high[0], high[1]);
  sar[1] = sar[0];
  
  for (let i = 2; i < n; i++) {
    sar[i] = sar[i - 1] + accel * (ep - sar[i - 1]);
    
    if (isLong) {
      sar[i] = Math.min(sar[i], low[i - 1], low[i - 2]);
      if (high[i] > ep) {
        ep = high[i];
        accel = Math.min(accel + accelIncrement, accelMax);
      }
      if (low[i] < sar[i]) {
        isLong = false;
        sar[i] = ep;
        ep = low[i];
        accel = accelStart;
      }
    } else {
      sar[i] = Math.max(sar[i], high[i - 1], high[i - 2]);
      if (low[i] < ep) {
        ep = low[i];
        accel = Math.min(accel + accelIncrement, accelMax);
      }
      if (high[i] > sar[i]) {
        isLong = true;
        sar[i] = ep;
        ep = high[i];
        accel = accelStart;
      }
    }
  }
  
  return sar;
}

/** Aroon Indicator
 * Identifies trend changes and strength. Both lines range 0-100.
 * Aroon Up above 70 with Aroon Down below 30 = strong uptrend.
 */
export function aroon(high: number[], low: number[], period = 25) {
  const n = high.length;
  const aroonUp = new Array<number>(n).fill(NaN);
  const aroonDown = new Array<number>(n).fill(NaN);
  
  for (let i = period; i < n; i++) {
    let highIdx = i;
    let lowIdx = i;
    
    for (let j = i - period; j <= i; j++) {
      if (high[j] >= high[highIdx]) highIdx = j;
      if (low[j] <= low[lowIdx]) lowIdx = j;
    }
    
    aroonUp[i] = ((period - (i - highIdx)) / period) * 100;
    aroonDown[i] = ((period - (i - lowIdx)) / period) * 100;
  }
  
  return { up: aroonUp, down: aroonDown };
}

/** Ichimoku Cloud
 * Complete trend-following system with 5 lines.
 * Price above cloud = bullish, below = bearish.
 */
export function ichimoku(
  high: number[],
  low: number[],
  close: number[],
  tenkanPeriod = 9,
  kijunPeriod = 26,
  senkouBPeriod = 52
) {
  const n = close.length;
  const tenkan = new Array<number>(n).fill(NaN);
  const kijun = new Array<number>(n).fill(NaN);
  const senkouA = new Array<number>(n).fill(NaN);
  const senkouB = new Array<number>(n).fill(NaN);
  const chikou = new Array<number>(n).fill(NaN);
  
  const calcLine = (period: number) => {
    const line = new Array<number>(n).fill(NaN);
    for (let i = period - 1; i < n; i++) {
      let highest = -Infinity;
      let lowest = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        highest = Math.max(highest, high[j]);
        lowest = Math.min(lowest, low[j]);
      }
      line[i] = (highest + lowest) / 2;
    }
    return line;
  };
  
  const tenkanLine = calcLine(tenkanPeriod);
  const kijunLine = calcLine(kijunPeriod);
  const senkouBLine = calcLine(senkouBPeriod);
  
  for (let i = 0; i < n; i++) {
    tenkan[i] = tenkanLine[i];
    kijun[i] = kijunLine[i];
    
    if (!Number.isNaN(tenkanLine[i]) && !Number.isNaN(kijunLine[i])) {
      const idx = i + kijunPeriod;
      if (idx < n) senkouA[idx] = (tenkanLine[i] + kijunLine[i]) / 2;
    }
    
    if (!Number.isNaN(senkouBLine[i])) {
      const idx = i + kijunPeriod;
      if (idx < n) senkouB[idx] = senkouBLine[i];
    }
    
    if (i >= kijunPeriod) {
      chikou[i - kijunPeriod] = close[i];
    }
  }
  
  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// ========== MOMENTUM INDICATORS ==========

/** RSI (Relative Strength Index)
 * Wilder's smoothing method. Range 0-100.
 * Above 70 = overbought, below 30 = oversold.
 */
export function rsi(values: number[], period = 14): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period <= 0 || values.length < 2) return out;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
  }

  if (gains.length >= period) {
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;
    const firstIndex = period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    out[firstIndex] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const idx = i + 1;
      const rs2 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      out[idx] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs2);
    }
  }
  return out;
}

/** Stochastic Oscillator (%K, %D)
 * Momentum indicator comparing close to price range.
 * %K > 80 = overbought, %K < 20 = oversold.
 */
export function stochastic(high: number[], low: number[], close: number[], kPeriod = 14, dPeriod = 3) {
  const n = close.length;
  const kArr = new Array<number>(n).fill(NaN);
  for (let i = kPeriod - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hh = Math.max(hh, high[j]);
      ll = Math.min(ll, low[j]);
    }
    const denom = hh - ll;
    kArr[i] = denom === 0 ? 50 : ((close[i] - ll) / denom) * 100;
  }
  const dArr = sma(kArr.map(v => (Number.isNaN(v) ? 0 : v)), dPeriod);
  return { k: kArr, d: dArr };
}

/** Williams %R
 * Momentum indicator (inverted stochastic).
 * Range -100 to 0. Above -20 = overbought, below -80 = oversold.
 */
export function williamsR(high: number[], low: number[], close: number[], period = 14) {
  const n = close.length;
  const wr = new Array<number>(n).fill(NaN);
  
  for (let i = period - 1; i < n; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      highest = Math.max(highest, high[j]);
      lowest = Math.min(lowest, low[j]);
    }
    const range = highest - lowest;
    wr[i] = range === 0 ? -50 : ((highest - close[i]) / range) * -100;
  }
  
  return wr;
}

/** Commodity Channel Index (CCI)
 * Identifies cyclical trends. Range typically -100 to +100.
 * Above +100 = strong uptrend, below -100 = strong downtrend.
 */
export function cci(high: number[], low: number[], close: number[], period = 20) {
  const n = close.length;
  const cci = new Array<number>(n).fill(NaN);
  const tp = new Array<number>(n);
  
  for (let i = 0; i < n; i++) {
    tp[i] = (high[i] + low[i] + close[i]) / 3;
  }
  
  const tpSma = sma(tp, period);
  
  for (let i = period - 1; i < n; i++) {
    let meanDev = 0;
    for (let j = i - period + 1; j <= i; j++) {
      meanDev += Math.abs(tp[j] - tpSma[i]);
    }
    meanDev /= period;
    
    if (meanDev !== 0) {
      cci[i] = (tp[i] - tpSma[i]) / (0.015 * meanDev);
    }
  }
  
  return cci;
}

/** True Strength Index (TSI)
 * Double-smoothed momentum indicator with less noise than RSI.
 * Positive values = bullish, negative = bearish.
 */
export function tsi(close: number[], longPeriod = 25, shortPeriod = 13, signalPeriod = 13) {
  const n = close.length;
  const momentum = new Array<number>(n).fill(0);
  
  for (let i = 1; i < n; i++) {
    momentum[i] = close[i] - close[i - 1];
  }
  
  const absMomentum = momentum.map(m => Math.abs(m));
  
  const emaLong = ema(momentum, longPeriod);
  const emaShort = ema(emaLong.map(v => Number.isNaN(v) ? 0 : v), shortPeriod);
  
  const absEmaLong = ema(absMomentum, longPeriod);
  const absEmaShort = ema(absEmaLong.map(v => Number.isNaN(v) ? 0 : v), shortPeriod);
  
  const tsi = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(emaShort[i]) && !Number.isNaN(absEmaShort[i]) && absEmaShort[i] !== 0) {
      tsi[i] = (emaShort[i] / absEmaShort[i]) * 100;
    }
  }
  
  const signal = ema(tsi.map(v => Number.isNaN(v) ? 0 : v), signalPeriod);
  
  return { tsi, signal };
}

/** Elder Ray Index
 * Measures bull and bear power relative to EMA.
 * Bull Power > 0 and rising = bulls in control.
 */
export function elderRay(high: number[], low: number[], close: number[], period = 13) {
  const emaLine = ema(close, period);
  const bullPower = new Array<number>(close.length).fill(NaN);
  const bearPower = new Array<number>(close.length).fill(NaN);
  
  for (let i = 0; i < close.length; i++) {
    if (!Number.isNaN(emaLine[i])) {
      bullPower[i] = high[i] - emaLine[i];
      bearPower[i] = low[i] - emaLine[i];
    }
  }
  
  return { bullPower, bearPower, ema: emaLine };
}

// ========== VOLATILITY INDICATORS ==========

/** Bollinger Bands
 * Volatility bands around SMA. Price touching bands = potential reversal.
 */
export function bollingerBands(values: number[], period = 20, stdDev = 2) {
  const middle = sma(values, period);
  const upper = new Array<number>(values.length).fill(NaN);
  const lower = new Array<number>(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - (middle[i] ?? 0);
      sumSq += d * d;
    }
    const variance = sumSq / period;
    const sd = Math.sqrt(variance);
    upper[i] = (middle[i] ?? NaN) + stdDev * sd;
    lower[i] = (middle[i] ?? NaN) - stdDev * sd;
  }
  return { middle, upper, lower };
}

/** Keltner Channels
 * Similar to Bollinger Bands but uses ATR. More responsive to volatility changes.
 */
export function keltnerChannels(
  high: number[],
  low: number[],
  close: number[],
  period = 20,
  atrPeriod = 10,
  atrMult = 2
) {
  const middle = ema(close, period);
  const atrVals = atr(high, low, close, atrPeriod);
  const upper = new Array<number>(close.length).fill(NaN);
  const lower = new Array<number>(close.length).fill(NaN);
  
  for (let i = 0; i < close.length; i++) {
    if (!Number.isNaN(middle[i]) && !Number.isNaN(atrVals[i])) {
      upper[i] = middle[i] + atrMult * atrVals[i];
      lower[i] = middle[i] - atrMult * atrVals[i];
    }
  }
  
  return { middle, upper, lower };
}

/** Average True Range (ATR)
 * Measures market volatility. Higher values = more volatility.
 */
export function atr(high: number[], low: number[], close: number[], period = 14): number[] {
  const n = close.length;
  const out = new Array<number>(n).fill(NaN);
  if (high.length !== n || low.length !== n || n < period + 1) return out;
  
  const tr: number[] = new Array(n).fill(0);
  tr[0] = high[0] - low[0];
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
  }
  
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  let prev = sum / period;
  out[period - 1] = prev;
  
  for (let i = period; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

// ========== VOLUME INDICATORS ==========

/** On-Balance Volume (OBV)
 * Cumulative volume indicator. Rising OBV = accumulation.
 */
export function obv(close: number[], volume: number[]): number[] {
  const n = close.length;
  const out = new Array<number>(n).fill(0);
  if (volume.length !== n) return out;
  for (let i = 1; i < n; i++) {
    if (close[i] > close[i - 1]) out[i] = out[i - 1] + volume[i];
    else if (close[i] < close[i - 1]) out[i] = out[i - 1] - volume[i];
    else out[i] = out[i - 1];
  }
  return out;
}

/** Money Flow Index (MFI)
 * Volume-weighted RSI. Range 0-100. Above 80 = overbought, below 20 = oversold.
 */
export function mfi(high: number[], low: number[], close: number[], volume: number[], period = 14) {
  const n = close.length;
  const mfi = new Array<number>(n).fill(NaN);
  const tp = new Array<number>(n);
  const mf = new Array<number>(n);
  
  for (let i = 0; i < n; i++) {
    tp[i] = (high[i] + low[i] + close[i]) / 3;
    mf[i] = tp[i] * volume[i];
  }
  
  for (let i = period; i < n; i++) {
    let posFlow = 0;
    let negFlow = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) {
        posFlow += mf[j];
      } else if (tp[j] < tp[j - 1]) {
        negFlow += mf[j];
      }
    }
    
    if (negFlow === 0) {
      mfi[i] = 100;
    } else {
      const ratio = posFlow / negFlow;
      mfi[i] = 100 - (100 / (1 + ratio));
    }
  }
  
  return mfi;
}

/** Chaikin Money Flow (CMF)
 * Measures buying/selling pressure. Range -1 to +1.
 * Positive values = accumulation, negative = distribution.
 */
export function cmf(high: number[], low: number[], close: number[], volume: number[], period = 20) {
  const n = close.length;
  const cmf = new Array<number>(n).fill(NaN);
  
  for (let i = period - 1; i < n; i++) {
    let sumMFV = 0;
    let sumVol = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      const range = high[j] - low[j];
      const mfv = range === 0 ? 0 : ((close[j] - low[j] - (high[j] - close[j])) / range) * volume[j];
      sumMFV += mfv;
      sumVol += volume[j];
    }
    
    cmf[i] = sumVol === 0 ? 0 : sumMFV / sumVol;
  }
  
  return cmf;
}

/** Volume-weighted average price (VWAP)
 * Average price weighted by volume. Used for intraday trading.
 */
export function vwap(close: number[], volume: number[], lookback?: number) {
  const n = close.length;
  const out = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - (lookback ? lookback - 1 : n - 1));
    let pv = 0;
    let vol = 0;
    for (let j = start; j <= i; j++) {
      pv += close[j] * (volume[j] ?? 0);
      vol += (volume[j] ?? 0);
    }
    out[i] = vol === 0 ? NaN : pv / vol;
  }
  return out;
}

/** Volume profile
 * Shows volume distribution by price level. POC = price with most volume.
 */
export function volumeProfile(close: number[], volume: number[], bins = 50, lookback = 200) {
  const n = close.length;
  if (n === 0) return { bins: [], poc: NaN, valueArea: [NaN, NaN] };
  const start = Math.max(0, n - lookback);
  const slice = close.slice(start);
  const volSlice = volume.slice(start);
  const minP = Math.min(...slice);
  const maxP = Math.max(...slice);
  const binWidth = (maxP - minP) / bins || 1;
  const hist = new Array<number>(bins).fill(0);
  for (let i = 0; i < slice.length; i++) {
    const p = slice[i];
    const v = volSlice[i] ?? 0;
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((p - minP) / binWidth)));
    hist[idx] += v;
  }
  let maxIdx = 0;
  let total = 0;
  for (let i = 0; i < hist.length; i++) {
    total += hist[i];
    if (hist[i] > hist[maxIdx]) maxIdx = i;
  }
  const poc = minP + (maxIdx + 0.5) * binWidth;

  const target = total * 0.7;
  let left = maxIdx;
  let right = maxIdx;
  let acc = hist[maxIdx];
  while (acc < target && (left > 0 || right < bins - 1)) {
    const leftVal = left > 0 ? hist[left - 1] : -1;
    const rightVal = right < bins - 1 ? hist[right + 1] : -1;
    if (leftVal >= rightVal) { left -= 1; acc += Math.max(0, leftVal); }
    else { right += 1; acc += Math.max(0, rightVal); }
  }
  const vaLow = minP + left * binWidth;
  const vaHigh = minP + (right + 1) * binWidth;

  return { bins: hist, binWidth, minP, maxP, poc, valueArea: [vaLow, vaHigh] };
}

// ========== SUPPORT/RESISTANCE ==========

/** Fibonacci swing levels
 * Calculates retracement and extension levels based on swing high/low.
 */
export function fibLevels(high: number[], low: number[], close: number[], lookback = 55, mode: 'swing' | 'range' = 'swing') {
  const n = close.length;
  if (n < 1) return {};
  const start = Math.max(0, n - lookback);
  let swingHigh = -Infinity;
  let swingLow = Infinity;
  let swingHighIdx = start;
  let swingLowIdx = start;
  for (let i = start; i < n; i++) {
    if (high[i] > swingHigh) { swingHigh = high[i]; swingHighIdx = i; }
    if (low[i] < swingLow) { swingLow = low[i]; swingLowIdx = i; }
  }
  const lastClose = close[n - 1];
  const mid = (swingHigh + swingLow) / 2;
  const direction = lastClose >= mid ? 'bull' : 'bear';

  const retracements = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0].map(r => ({ r, price: swingHigh - (swingHigh - swingLow) * r }));
  const extensions = [1.272, 1.618, 2.0].map(e => ({ e, price: swingHigh + (swingHigh - swingLow) * (e - 1) }));

  return {
    swingHigh,
    swingLow,
    swingHighIdx,
    swingLowIdx,
    direction,
    retracements,
    extensions
  };
}

// ========== UTILITIES ==========

/** Least-squares linear slope
 * Measures trend direction and strength. Positive = uptrend, negative = downtrend.
 */
export function slope(values: number[], window?: number): number {
  const n = values.length;
  const w = Math.min(window ?? n, n);
  if (w < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < w; i++) {
    const x = i;
    const y = values[n - w + i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = w * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (w * sumXY - sumX * sumY) / denom;
}

// ========== EXPORTS ==========

export default {
  // Moving Averages
  sma, ema, vwma,
  // Trend
  macd, adx, parabolicSAR, aroon, ichimoku,
  // Momentum
  rsi, stochastic, williamsR, cci, tsi, elderRay,
  // Volatility
  bollingerBands, keltnerChannels, atr,
  // Volume
  obv, mfi, cmf, vwap, volumeProfile,
  // Support/Resistance
  fibLevels,
  // Utilities
  slope
};