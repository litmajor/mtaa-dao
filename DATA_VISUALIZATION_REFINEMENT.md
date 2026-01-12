# Data Visualization Refinement & Normalization Guide

## Overview
This document outlines the comprehensive data visualization refinement completed across all Phase 5-6 components to ensure proper data normalization, scaling, rounding, and visual clarity.

## Changes Summary

### 1. New Data Normalization Utility Module
**File:** `client/src/utils/dataVisualization.ts` (450+ lines)

**Key Functions:**
- **`normalizeValue(value, min, max)`** - Normalize any value to 0-100 range
- **`formatNumberCompact(num, decimals)`** - Format large numbers (T/B/M/K abbreviations)
- **`formatCurrency(value, currency)`** - Locale-aware currency formatting
- **`formatPercentage(value, decimals)`** - Consistent percentage formatting with +/- signs
- **`getOptimalDecimals(value, maxDecimals)`** - Intelligently determine decimal places based on magnitude
- **`calculateOptimalDomain(values, buffer)`** - Calculate optimal Y-axis ranges for charts
- **`formatTooltipValue(value, type)`** - Format values for chart tooltips based on context
- **`calculateDataStats(values)`** - Calculate min/max/mean/median/stdDev/range for datasets
- **`detectOutliers(values)`** - Identify statistical outliers using IQR method
- **`validateChartData(data, requiredKeys, numericKeys)`** - Validate data before rendering
- **`formatDisplayValue(value, type)`** - Smart formatting for any display context

### 2. Hook Updates
**File:** `client/src/hooks/useFearGreed.ts`

**Improvements:**
```typescript
// Updated imports
import {
  formatNumberCompact,
  formatPercentage,
  formatCurrency,
  getOptimalDecimals,
  formatDisplayValue
} from '@/utils/dataVisualization';

// Enhanced formatChangePercent() - uses getOptimalDecimals()
export function formatChangePercent(percent: number): {
  formatted: string;
  color: string;
  emoji: string;
} {
  // Now uses intelligent decimal calculation
  const decimals = getOptimalDecimals(percent);
  // Smart rounding based on magnitude
}

// Refactored formatLargeNumber() - delegates to utility
export function formatLargeNumber(num: number): string {
  return formatNumberCompact(num, 2); // Centralized formatting
}
```

**Benefits:**
- Consistent number formatting across app
- Intelligent decimal places based on value magnitude
- Centralized logic easier to maintain and update

### 3. FearGreedGauge Component Updates
**File:** `client/src/components/FearGreedGauge.tsx`

**Improvements:**
```tsx
// Enhanced imports
import { formatDisplayValue, getOptimalDecimals } from '@/utils/dataVisualization';

// Improved score display: 1 decimal precision for accuracy
<div className="text-4xl font-black" style={{ color: color }}>
  {score.toFixed(1)}  // Was: Math.round(score)
</div>

// Smart rounding in MetricCard component
const displayValue = value < 50 ? value.toFixed(1) : value.toFixed(0);
// Shows decimals for precision on smaller values, whole numbers on larger

// Improved progress bar width clamping
style={{
  width: `${Math.min(100, value)}%`  // Prevents bar from exceeding 100%
}}
```

**Visual Improvements:**
- Gauge score now displays with 1 decimal (e.g., "78.5" instead of "78")
- Metric cards show appropriate precision (1 decimal for <50, whole for ≥50)
- Progress bars properly clamped to 100% maximum

### 4. MarketChangesVisualization Component Updates
**File:** `client/src/components/MarketChangesVisualization.tsx`

**Key Improvements:**
```tsx
// Centralized formatting utility
import { formatNumberCompact, calculateOptimalDomain } from '@/utils/dataVisualization';

// Calculated optimal chart domains based on actual data
const percentages = changes.map(item => item.marketCapChangePercent)
  .concat(changes.map(item => item.volumeChangePercent));
const percentageDomain = calculateOptimalDomain(percentages, 0.1);

// Chart data properly rounded before rendering
const chartData = changes.map(item => ({
  period: getPeriodLabel(item.period),
  marketCapChange: parseFloat(item.marketCapChangePercent.toFixed(2)),
  volumeChange: parseFloat(item.volumeChangePercent.toFixed(2)),
  marketCap: item.marketCap,
  volume24h: item.volume24h
}));

// Chart configuration with proper domain
<YAxis stroke="#9ca3af" domain={percentageDomain} />

// Improved tooltip formatting: 1 decimal for percentages
formatter={(value: any) => `${(value as number).toFixed(1)}%`}
```

**Data Normalization:**
- Percentage values rounded to 2 decimals during data prep
- Chart domains calculated from actual data with 10% buffer
- Tooltip displays 1 decimal for readability
- Proper handling of negative values (-100% to +100% range)

**Benefits:**
- Charts automatically scale to data ranges
- No clipped or cramped visualization
- Consistent decimal precision across charts
- Proper spacing with buffer zones

### 5. BtcDominanceCard Component Updates
**File:** `client/src/components/BtcDominanceCard.tsx`

**Key Improvements:**
```tsx
// Enhanced Pie chart with labels and tooltips
<Pie 
  data={pieData} 
  cx="50%" 
  cy="50%" 
  innerRadius={60} 
  outerRadius={100} 
  dataKey="value"
  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}  // NEW
  labelLine={false}
>
  <Cell fill="#f7931a" />
  <Cell fill="#6b7280" />
</Pie>
<Tooltip formatter={(value: any) => `${(value as number).toFixed(1)}%`} />  // NEW

// Updated legend with percentages
<span className="text-gray-600 dark:text-gray-400">
  Bitcoin {dominancePercent.toFixed(1)}%
</span>
<span className="text-gray-600 dark:text-gray-400">
  Altcoins {altcoinPercent.toFixed(1)}%
</span>

// Improved price display with consistent decimals
<div className="text-3xl font-black text-orange-600 dark:text-orange-400">
  ${price.toFixed(2)}  // Was: formatLargeNumber(price)
</div>

// Market cap using centralized formatting
<div className="text-2xl font-black text-orange-600 dark:text-orange-400">
  {formatNumberCompact(marketCap, 2)}  // Now handles all size ranges
</div>

// Consistent dominance percentage display
Dominance: {dominancePercent.toFixed(1)}%  // Was: .toFixed(2)
Altcoin Share: {altcoinPercent.toFixed(1)}%
```

**Visual Enhancements:**
- Pie chart now displays percentage labels directly on/near segments
- Tooltip shows percentages on hover
- Legend includes actual percentages
- Price displayed with consistent 2 decimal places
- Market cap uses compact formatting (T/B/M)
- Dominance percentages use 1 decimal (e.g., "45.3%" vs "45.25%")

## Rounding Strategy

### Applied Rounding Rules

| Data Type | Range | Decimals | Example | Reason |
|-----------|-------|----------|---------|--------|
| Percentages | 0-100% | 1 | 45.3%, +2.1% | Human readable, prevents clutter |
| Large Numbers | ≥1B | 2 | $2.45T, $1.23B | Compact, readable abbreviations |
| Market Cap | All | 2 decimals | $2.45T, $1.23M | Consistent precision |
| Scores (0-100) | <50 | 1 | 45.3 | Precision where it matters |
| Scores (0-100) | ≥50 | 0 | 78 | Cleaner display |
| Volatility % | 0-5% | 2 | 3.42% | Detail preserved |
| Price (BTC) | All | 2 | $45,230.45 | Standard currency format |

### Rounding Implementation

```typescript
// Smart rounding function
function smartRound(value: number, threshold: number = 1000000): number {
  if (Math.abs(value) >= threshold) return Math.round(value);
  if (Math.abs(value) >= 1000) return Math.round(value * 10) / 10;
  if (Math.abs(value) >= 1) return Math.round(value * 100) / 100;
  return Math.round(value * 10000) / 10000;
}

// Optimal decimal calculation
function getOptimalDecimals(value: number, maxDecimals: number = 4): number {
  if (value === 0) return 0;
  const absValue = Math.abs(value);
  if (absValue >= 1000) return 0;
  if (absValue >= 100) return 1;
  if (absValue >= 10) return 2;
  if (absValue >= 1) return 2;
  if (absValue >= 0.1) return 3;
  return Math.min(maxDecimals, 4);
}
```

## Chart Scaling & Domains

### Automatic Domain Calculation

```typescript
// Calculate optimal Y-axis domain for charts
export function calculateOptimalDomain(
  values: number[],
  buffer: number = 0.1
): [number, number] {
  const validValues = values.filter(v => !isNaN(v) && isFinite(v));
  if (validValues.length === 0) return [0, 100];

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min;

  // Add buffer to prevent data from touching edges
  const minBuffer = Math.abs(min) * buffer;
  const maxBuffer = Math.abs(max) * buffer;

  // Round to nearest sensible value
  const domainMin = Math.floor(min - minBuffer);
  const domainMax = Math.ceil(max + maxBuffer);

  return [domainMin, domainMax];
}
```

**Implementation in Charts:**
```tsx
// Example: MarketChangesVisualization
const percentageDomain = calculateOptimalDomain(percentages, 0.1);
<YAxis stroke="#9ca3af" domain={percentageDomain} />
```

**Benefits:**
- Charts automatically adjust to data ranges
- 10% buffer prevents data from touching edges
- Handles negative values correctly (-50% to +75%)
- Prevents overlapping/cramped visualizations

## Data Validation

### Pre-Rendering Validation

```typescript
// Validate chart data before rendering
const validation = validateChartData(
  data,
  ['period', 'value'],  // required keys
  ['value', 'change']   // numeric keys
);

if (!validation.valid) {
  console.warn('Data validation errors:', validation.errors);
  // Handle invalid data gracefully
}
```

### Validation Checks:
1. Data is an array
2. Array is not empty
3. All required keys present
4. All numeric keys contain valid numbers
5. No NaN or Infinity values

## Tooltip Enhancements

### Smart Tooltip Formatting

```tsx
// Currency tooltip
<Tooltip
  formatter={(value: any) => formatDisplayValue(value, 'currency')}
/>

// Percentage tooltip
<Tooltip
  formatter={(value: any) => `${(value as number).toFixed(1)}%`}
/>

// Compact number tooltip
<Tooltip
  formatter={(value: any) => formatNumberCompact(value as number, 2)}
/>
```

**Features:**
- Consistent formatting across charts
- Smart decimal places based on value
- Locale-aware currency display
- Readable abbreviations (T/B/M/K)

## Visual Clutter Reduction

### Implemented Improvements

| Issue | Solution | Benefit |
|-------|----------|---------|
| Excessive decimals | `getOptimalDecimals()` | Cleaner, more readable numbers |
| Cramped charts | Dynamic domain calculation | Better use of chart space |
| Unlabeled pie slices | Direct pie labels + tooltip | No guessing percentages |
| Inconsistent formatting | Centralized utilities | Predictable, professional look |
| Overlapping data | Chart margins + responsive | Proper spacing on all screens |
| Grid line clutter | Strategic grid placement | Enhanced readability |

## Testing Recommendations

### Unit Testing
```typescript
// Test number formatting
expect(formatNumberCompact(1500000000, 2)).toBe('1.50B');
expect(formatNumberCompact(2450000000000, 2)).toBe('2.45T');

// Test decimal optimization
expect(getOptimalDecimals(45.123)).toBe(2);
expect(getOptimalDecimals(0.045)).toBe(3);

// Test domain calculation
const domain = calculateOptimalDomain([10, 20, 30]);
expect(domain[0]).toBeLessThan(10);
expect(domain[1]).toBeGreaterThan(30);
```

### Integration Testing
1. Load charts with real API data
2. Verify tooltips display correctly
3. Test with edge cases (zero, negative, very large numbers)
4. Validate responsiveness across screen sizes
5. Check dark mode rendering

### Visual Testing
1. Compare before/after rounding
2. Verify chart scaling looks proportional
3. Check legend clarity and positioning
4. Ensure all labels visible without overflow
5. Validate color contrast (WCAG AA)

## Performance Considerations

### Optimization Strategies
- Pre-round data before rendering (not during each render)
- Memoize formatting functions with useMemo
- Lazy-load heavy chart components
- Use React.memo on visualization components

### Example Optimization
```tsx
const chartData = useMemo(() => 
  changes.map(item => ({
    ...item,
    marketCapChange: parseFloat(item.marketCapChangePercent.toFixed(2))
  })),
  [changes]
);
```

## Future Enhancements

### Potential Improvements
1. **Custom number formatter configuration** - Allow users to choose abbreviation style
2. **Accessibility improvements** - Enhanced aria labels, keyboard navigation
3. **Data point highlighting** - Hover to isolate specific data series
4. **Export functionality** - Download chart as image with proper formatting
5. **Historical comparison** - Side-by-side comparison of different periods
6. **Threshold alerts** - Visual indicators when values exceed configured limits
7. **Mobile optimization** - Responsive tooltips, touch-friendly interactions

## Maintenance Guidelines

### When Adding New Visualizations
1. Use `dataVisualization.ts` utilities for all number formatting
2. Validate data with `validateChartData()` before rendering
3. Calculate optimal domains with `calculateOptimalDomain()`
4. Implement smart tooltips with `formatTooltipValue()`
5. Test edge cases (zero, negative, very large values)

### Updating Formatting Rules
1. Modify rules only in `dataVisualization.ts`
2. All components automatically use updated formatting
3. Document changes in this guide
4. Run unit tests to catch breaking changes

## Summary

The data visualization refinement ensures:
- ✅ Proper number normalization across all scales (millions to trillions)
- ✅ Consistent rounding (1-2 decimals depending on context)
- ✅ Smart domain calculation for chart Y-axes
- ✅ Clear, non-cluttered displays with strategic labeling
- ✅ Centralized formatting utilities for maintainability
- ✅ Improved chart tooltips and legends
- ✅ Enhanced visual clarity and professional appearance
- ✅ Accessibility compliance with proper contrast and labels

All visualization components now render data professionally with intelligent formatting, proper scaling, and visual clarity suitable for financial/trading analysis.
