/**
 * Data Normalization & Visualization Utilities
 * Ensures all charts, graphs, and data displays are properly scaled and formatted
 */

/**
 * Normalize data to a specific range
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

/**
 * Format large numbers with appropriate abbreviations
 * Handles: Trillions, Billions, Millions, Thousands
 */
export function formatNumberCompact(num: number, decimals: number = 2): string {
  if (num === 0) return '0';
  if (Math.abs(num) < 1000) return num.toFixed(decimals);

  const trillion = 1e12;
  const billion = 1e9;
  const million = 1e6;
  const thousand = 1e3;

  if (Math.abs(num) >= trillion) {
    return `${(num / trillion).toFixed(decimals)}T`;
  }
  if (Math.abs(num) >= billion) {
    return `${(num / billion).toFixed(decimals)}B`;
  }
  if (Math.abs(num) >= million) {
    return `${(num / million).toFixed(decimals)}M`;
  }
  if (Math.abs(num) >= thousand) {
    return `${(num / thousand).toFixed(decimals)}K`;
  }

  return num.toFixed(decimals);
}

/**
 * Format currency with proper locale
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 4 : 2
  });

  return formatter.format(value);
}

/**
 * Format percentage with proper rounding and sign
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Get appropriate decimal places based on value magnitude
 */
export function getOptimalDecimals(value: number, maxDecimals: number = 4): number {
  if (value === 0) return 0;

  const absValue = Math.abs(value);

  if (absValue >= 1000) return 0;
  if (absValue >= 100) return 1;
  if (absValue >= 10) return 2;
  if (absValue >= 1) return 2;
  if (absValue >= 0.1) return 3;

  return Math.min(maxDecimals, 4);
}

/**
 * Round number to nearest significant figure
 */
export function roundToSignificant(value: number, significantFigures: number = 3): number {
  if (value === 0) return 0;

  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const scale = Math.pow(10, significantFigures - magnitude - 1);

  return Math.round(value * scale) / scale;
}

/**
 * Normalize chart data for consistent scaling
 */
export function normalizeChartData<T extends Record<string, any>>(
  data: T[],
  numericKeys: (keyof T)[]
): {
  normalized: (T & Record<string, number>)[];
  scales: Record<string, { min: number; max: number }>;
} {
  const scales: Record<string, { min: number; max: number }> = {};

  // Calculate min/max for each numeric key
  numericKeys.forEach((key) => {
    const values = data.map((item) => (typeof item[key] === 'number' ? item[key] : 0));
    scales[String(key)] = {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  });

  // Normalize values
  const normalized = data.map((item) => {
    const result: Record<string, any> = { ...item };

    numericKeys.forEach((key) => {
      const scale = scales[String(key)];
      const value = typeof item[key] === 'number' ? item[key] : 0;
      result[`${String(key)}_normalized`] = normalizeValue(value, scale.min, scale.max);
    });

    return result as T & Record<string, number>;
  });

  return { normalized, scales };
}

/**
 * Calculate optimal Y-axis domain for charts
 */
export function calculateOptimalDomain(
  values: number[],
  buffer: number = 0.1
): [number, number] {
  const validValues = values.filter((v) => !isNaN(v) && isFinite(v));

  if (validValues.length === 0) {
    return [0, 100];
  }

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);

  // Add buffer to prevent data from touching edges
  const range = max - min;
  const minBuffer = Math.abs(min) * buffer;
  const maxBuffer = Math.abs(max) * buffer;

  // Round to nearest sensible value
  const domainMin = Math.floor(min - minBuffer);
  const domainMax = Math.ceil(max + maxBuffer);

  return [domainMin, domainMax];
}

/**
 * Format tooltip value based on context
 */
export function formatTooltipValue(
  value: number,
  type: 'currency' | 'percentage' | 'number' | 'compact'
): string {
  switch (type) {
    case 'currency':
      return formatCurrency(value);
    case 'percentage':
      return formatPercentage(value);
    case 'compact':
      return formatNumberCompact(value);
    case 'number':
    default:
      const decimals = getOptimalDecimals(value);
      return value.toFixed(decimals);
  }
}

/**
 * Get color based on value for heatmap-style visualizations
 */
export function getValueColor(
  value: number,
  min: number,
  max: number,
  colorScheme: 'red-green' | 'blue-red' | 'cool-warm' = 'red-green'
): string {
  const normalized = normalizeValue(value, min, max);

  const colorSchemes = {
    'red-green': [
      '#ef4444', // red
      '#f97316', // orange
      '#eab308', // yellow
      '#84cc16', // lime
      '#22c55e' // green
    ],
    'blue-red': [
      '#3b82f6', // blue
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#ef4444' // red
    ],
    'cool-warm': [
      '#06b6d4', // cyan
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444' // red
    ]
  };

  const colors = colorSchemes[colorScheme];
  const index = Math.floor((normalized / 100) * (colors.length - 1));

  return colors[Math.max(0, Math.min(colors.length - 1, index))];
}

/**
 * Validate chart data for rendering
 */
export function validateChartData<T extends Record<string, any>>(
  data: T[],
  requiredKeys: (keyof T)[],
  numericKeys?: (keyof T)[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if data is an array
  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
    return { valid: false, errors };
  }

  // Check if data is empty
  if (data.length === 0) {
    errors.push('Data array is empty');
    return { valid: false, errors };
  }

  // Check required keys
  requiredKeys.forEach((key) => {
    const missing = data.some((item) => !(key in item));
    if (missing) {
      errors.push(`Required key missing: ${String(key)}`);
    }
  });

  // Check numeric keys
  if (numericKeys) {
    numericKeys.forEach((key) => {
      const nonNumeric = data.some((item) => {
        const value = item[key];
        return value !== null && value !== undefined && isNaN(Number(value));
      });
      if (nonNumeric) {
        errors.push(`Non-numeric value found in: ${String(key)}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate statistics for data set
 */
export function calculateDataStats(values: number[]): {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  range: number;
} {
  const validValues = values.filter((v) => !isNaN(v) && isFinite(v));

  if (validValues.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, range: 0 };
  }

  // Sort for median
  const sorted = [...validValues].sort((a, b) => a - b);

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;

  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  const squaredDiffs = sorted.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, mean, median, stdDev, range };
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliers(values: number[]): {
  outliers: number[];
  indices: number[];
  bounds: { lower: number; upper: number };
} {
  const validValues = values.filter((v) => !isNaN(v) && isFinite(v));

  if (validValues.length < 4) {
    return { outliers: [], indices: [], bounds: { lower: 0, upper: 0 } };
  }

  const sorted = [...validValues].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length / 4);
  const q3Index = Math.floor((3 * sorted.length) / 4);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outliers: number[] = [];
  const indices: number[] = [];

  values.forEach((value, index) => {
    if ((value < lowerBound || value > upperBound) && !isNaN(value) && isFinite(value)) {
      outliers.push(value);
      indices.push(index);
    }
  });

  return { outliers, indices, bounds: { lower: lowerBound, upper: upperBound } };
}

/**
 * Format data for display with smart rounding
 */
export function formatDisplayValue(value: number | null | undefined, type: 'auto' | 'currency' | 'percentage' | 'number'): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (!isFinite(value)) {
    return 'N/A';
  }

  switch (type) {
    case 'currency':
      return formatCurrency(value);
    case 'percentage':
      return formatPercentage(value, getOptimalDecimals(value));
    case 'number':
      return value.toFixed(getOptimalDecimals(value));
    case 'auto':
    default:
      if (Math.abs(value) >= 1000) {
        return formatNumberCompact(value);
      }
      if (Math.abs(value) < 1) {
        return value.toFixed(4);
      }
      return value.toFixed(2);
  }
}

/**
 * Limit decimal places based on range
 */
export function smartRound(value: number, threshold: number = 1000000): number {
  if (Math.abs(value) >= threshold) {
    return Math.round(value);
  }
  if (Math.abs(value) >= 1000) {
    return Math.round(value * 10) / 10;
  }
  if (Math.abs(value) >= 1) {
    return Math.round(value * 100) / 100;
  }
  return Math.round(value * 10000) / 10000;
}
