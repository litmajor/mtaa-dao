/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TIMEFRAME UTILITY - Flexible Multi-Timeframe Support
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * **Purpose:** Support any timeframe combination from 1m to 1M
 * 
 * Supports all standard timeframes:
 * 1m, 5m, 15m, 30m, 1h, 4h, 8h, 1d, 1w, 1M
 * 
 * Key Utilities:
 * • Validate timeframe combinations (macro > micro)
 * • Convert to minutes for duration comparison
 * • Calculate appropriate candle limits
 * • Determine cache TTL based on timeframe
 * • Suggest optimal macro/micro pairs
 */

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '8h' | '1d' | '1w' | '1M';

/**
 * All valid timeframes with their durations in minutes
 */
export const TIMEFRAME_DURATIONS: Record<Timeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
  '8h': 480,
  '1d': 1440,
  '1w': 10080,
  '1M': 43200
};

/**
 * Recommended candle counts per timeframe for technical analysis
 * Ensures we have enough data for all indicators
 */
export const TIMEFRAME_CANDLE_LIMITS: Record<Timeframe, number> = {
  '1m': 1440,     // 24 hours of 1-min candles
  '5m': 288,      // 24 hours of 5-min candles
  '15m': 96,      // 24 hours of 15-min candles
  '30m': 48,      // 24 hours of 30-min candles
  '1h': 24,       // 24 hourly candles (1 day)
  '4h': 168,      // 7 days of 4h candles
  '8h': 84,       // 28 days of 8h candles
  '1d': 365,      // 1 year of daily candles
  '1w': 52,       // 1 year of weekly candles
  '1M': 12        // 1 year of monthly candles
};

/**
 * Cache TTL per timeframe
 * TTL matches the time it takes for a new candle to form
 */
export const TIMEFRAME_CACHE_TTL: Record<Timeframe, number> = {
  '1m': 60,         // 1 minute
  '5m': 300,        // 5 minutes
  '15m': 900,       // 15 minutes
  '30m': 1800,      // 30 minutes
  '1h': 3600,       // 1 hour
  '4h': 14400,      // 4 hours
  '8h': 28800,      // 8 hours
  '1d': 86400,      // 1 day
  '1w': 604800,     // 1 week
  '1M': 2592000     // 30 days
};

/**
 * Recommended macro/micro pairs for different trading strategies
 */
export const RECOMMENDED_PAIRS = {
  // Scalping (very fast trades)
  'scalping': [
    { macro: '5m', micro: '1m' },
    { macro: '15m', micro: '5m' }
  ],

  // Day trading (multi-hour trades)
  'day_trading': [
    { macro: '1h', micro: '5m' },
    { macro: '4h', micro: '15m' },
    { macro: '4h', micro: '1h' }
  ],

  // Swing trading (multi-day trades)
  'swing_trading': [
    { macro: '1d', micro: '4h' },
    { macro: '1d', micro: '1h' },
    { macro: '1w', micro: '1d' }
  ],

  // Long-term investing (weeks/months)
  'long_term': [
    { macro: '1w', micro: '1d' },
    { macro: '1M', micro: '1w' }
  ],

  // Custom - user decides
  'custom': []
};

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Validate if a timeframe is valid
 */
export function isValidTimeframe(tf: string): tf is Timeframe {
  return tf in TIMEFRAME_DURATIONS;
}

/**
 * Get duration in minutes for a timeframe
 */
export function getTimeframeMinutes(timeframe: Timeframe): number {
  return TIMEFRAME_DURATIONS[timeframe];
}

/**
 * Get recommended candle count for a timeframe
 */
export function getCandleLimit(timeframe: Timeframe): number {
  return TIMEFRAME_CANDLE_LIMITS[timeframe];
}

/**
 * Get cache TTL for a timeframe (in seconds)
 */
export function getCacheTTL(timeframe: Timeframe): number {
  return TIMEFRAME_CACHE_TTL[timeframe];
}

/**
 * Validate that macro timeframe is larger than micro timeframe
 * 
 * @returns { valid: boolean, error?: string }
 */
export function validateTimeframeHierarchy(
  macroTimeframe: string,
  microTimeframe: string
): { valid: boolean; error?: string } {
  if (!isValidTimeframe(macroTimeframe)) {
    return { valid: false, error: `Invalid macro timeframe: ${macroTimeframe}` };
  }

  if (!isValidTimeframe(microTimeframe)) {
    return { valid: false, error: `Invalid micro timeframe: ${microTimeframe}` };
  }

  const macroMinutes = TIMEFRAME_DURATIONS[macroTimeframe];
  const microMinutes = TIMEFRAME_DURATIONS[microTimeframe];

  if (macroMinutes <= microMinutes) {
    return {
      valid: false,
      error: `Macro ${macroTimeframe} (${macroMinutes}m) must be larger than micro ${microTimeframe} (${microMinutes}m)`
    };
  }

  // Also check that they're not too different (no point comparing 1m with 1M)
  const ratio = macroMinutes / microMinutes;
  if (ratio > 1440) {
    return {
      valid: false,
      error: `Timeframe gap too large (${ratio}×). Keep ratio < 1440.`
    };
  }

  return { valid: true };
}

/**
 * Get suggested macro timeframe for a given micro timeframe and strategy
 * 
 * @param microTimeframe The entry/execution timeframe
 * @param strategy 'scalping' | 'day_trading' | 'swing_trading' | 'long_term'
 * @returns Recommended macro timeframe
 */
export function getSuggestedMacro(
  microTimeframe: Timeframe,
  strategy: 'scalping' | 'day_trading' | 'swing_trading' | 'long_term' = 'day_trading'
): Timeframe | null {
  const pairs = RECOMMENDED_PAIRS[strategy];
  const match = pairs.find(p => p.micro === microTimeframe);

  if (match && isValidTimeframe(match.macro)) {
    return match.macro as Timeframe;
  }

  return null;
}

/**
 * Get suggested micro timeframe for a given macro timeframe
 */
export function getSuggestedMicro(
  macroTimeframe: Timeframe,
  strategy: 'scalping' | 'day_trading' | 'swing_trading' | 'long_term' = 'day_trading'
): Timeframe | null {
  const pairs = RECOMMENDED_PAIRS[strategy];
  const match = pairs.find(p => p.macro === macroTimeframe);

  if (match && isValidTimeframe(match.micro)) {
    return match.micro as Timeframe;
  }

  return null;
}

/**
 * Convert timeframe to human-readable format
 */
export function formatTimeframe(timeframe: Timeframe): string {
  const units: Record<Timeframe, string> = {
    '1m': '1 minute',
    '5m': '5 minutes',
    '15m': '15 minutes',
    '30m': '30 minutes',
    '1h': '1 hour',
    '4h': '4 hours',
    '8h': '8 hours',
    '1d': '1 day',
    '1w': '1 week',
    '1M': '1 month'
  };
  return units[timeframe];
}

/**
 * Get all valid timeframes
 */
export function getAllTimeframes(): Timeframe[] {
  return Object.keys(TIMEFRAME_DURATIONS) as Timeframe[];
}

/**
 * Get timeframes suitable for a specific strategy class
 */
export function getTimeframesForStrategy(
  strategy: 'scalping' | 'day_trading' | 'swing_trading' | 'long_term'
): Timeframe[] {
  const pairs = RECOMMENDED_PAIRS[strategy];
  const timeframes = new Set<Timeframe>();

  pairs.forEach(pair => {
    if (isValidTimeframe(pair.macro)) timeframes.add(pair.macro as Timeframe);
    if (isValidTimeframe(pair.micro)) timeframes.add(pair.micro as Timeframe);
  });

  return Array.from(timeframes).sort(
    (a, b) => TIMEFRAME_DURATIONS[a] - TIMEFRAME_DURATIONS[b]
  );
}

/**
 * Calculate the ratio between two timeframes
 * Useful for understanding the time gap
 */
export function calculateTimeframeRatio(
  macroTimeframe: Timeframe,
  microTimeframe: Timeframe
): number {
  return TIMEFRAME_DURATIONS[macroTimeframe] / TIMEFRAME_DURATIONS[microTimeframe];
}

/**
 * Example: calculateTimeframeRatio('1h', '5m') = 12 (1h is 12× 5m)
 */

/**
 * Get description of a timeframe pair for logging/debugging
 */
export function describeTimeframePair(macro: Timeframe, micro: Timeframe): string {
  const ratio = calculateTimeframeRatio(macro, micro);
  return `${formatTimeframe(macro)} (macro) + ${formatTimeframe(micro)} (micro, ${ratio}× gap)`;
}
