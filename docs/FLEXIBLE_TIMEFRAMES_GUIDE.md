# Flexible Timeframe System - Usage Guide

**Updated:** February 20, 2026  
**Version:** 2.0 (Fully Flexible: 1m to 1M)  
**Status:** Production Ready

---

## 🎯 Overview

The Technical Analysis Service now supports ANY timeframe combination from **1 minute to 1 month**:

```
Supported Timeframes:
1m, 5m, 15m, 30m, 1h, 4h, 8h, 1d, 1w, 1M
```

With **intelligent validation** that ensures macro > micro timeframe in duration.

---

## 📚 Quick Reference

### All Supported Timeframes

| Timeframe | Duration | Use Case |
|-----------|----------|----------|
| **1m** | 1 minute | Scalping, ultra-fast entries |
| **5m** | 5 minutes | Scalping, fast day trading |
| **15m** | 15 minutes | Day trading, short swings |
| **30m** | 30 minutes | Day trading, intraday |
| **1h** | 1 hour | Day/swing trading standard |
| **4h** | 4 hours | Swing trading, position trading |
| **8h** | 8 hours | Longer swing trades |
| **1d** | 1 day | Swing/position trading standard |
| **1w** | 1 week | Long-term position trading |
| **1M** | 1 month | Long-term investing |

---

## 🚀 Basic Usage

### Single Timeframe Analysis

```typescript
import { technicalAnalysisService } from './services/technicalAnalysisService';

// Any single timeframe works
const analysis = await technicalAnalysisService.analyzeSymbol(
  'BTC/USDT',
  '5m'  // or '1h', '4h', '1d', etc.
);

console.log(analysis.rsi.value, analysis.macd.position, analysis.regime);
```

### Multi-Timeframe Analysis (Any Combination)

```typescript
// Macro > Micro (always)
const mtf = await technicalAnalysisService.analyzeMultiTimeframe(
  'BTC/USDT',
  '1h',   // Macro: 1 hour
  '5m'    // Micro: 5 minutes
);

if (mtf.macroTrend.direction === 'bullish' && 
    mtf.microEntry.signal === 'buy' &&
    mtf.microEntry.confirmation) {
  console.log('Strong alignment - trade with confidence');
}
```

---

## 📋 Strategy Examples

### 1️⃣ Scalping Strategy (Ultra-Fast)

**Goal:** Trade within minutes, catch micro moves  
**Macro:** Short-term direction confirmation  
**Micro:** Exact entry timing

```typescript
// Scalping: 5m direction + 1m entry
const scalp = await technicalAnalysisService.analyzeMultiTimeframe(
  'ETH/USDT',
  '5m',   // Is 5m uptrending?
  '1m'    // Where exactly to enter?
);

if (scalp.recommendation === 'strong_buy') {
  // Place market order with tight stop loss
}
```

**Alternative Scalp Pairs:**
```typescript
// 15m + 5m
const scalp2 = await technicalAnalysisService.analyzeMultiTimeframe(
  'SOL/USDT',
  '15m',
  '5m'
);
```

### 2️⃣ Day Trading Strategy (4-8 Hours)

**Goal:** Hold trades for hours, from market open to close  
**Macro:** Session direction (1h)  
**Micro:** Entry confirmation (5-15m)

```typescript
// Day trading: 1h trend + 5m entry
const dayTrade = await technicalAnalysisService.analyzeMultiTimeframe(
  'BTC/USDT',
  '1h',    // Is hourly uptrending?
  '5m'     // Perfect 5m entry point?
);

// Day trading: 4h trend + 1h entry (for larger moves)
const dayTradeLarger = await technicalAnalysisService.analyzeMultiTimeframe(
  'BTC/USDT',
  '4h',    // 4-hour direction
  '1h'     // 1-hour confirmation
);

if (dayTrade.aggregateConfidence > 75) {
  // Trade with 3-4 hour target
}
```

### 3️⃣ Swing Trading Strategy (2-5 Days)

**Goal:** Hold trades for multiple days  
**Macro:** Daily direction  
**Micro:** 4-hour entry signal

```typescript
// Swing trading: 1d direction + 4h entry
const swingTrade = await technicalAnalysisService.analyzeMultiTimeframe(
  'ETH/USDT',
  '1d',    // Is daily trend bullish?
  '4h'     // Which 4h candle confirms entry?
);

// Swing trading: Weekly + daily
const swingLarger = await technicalAnalysisService.analyzeMultiTimeframe(
  'ETH/USDT',
  '1w',    // Weekly trend direction
  '1d'     // Daily confirmation
);

if (swingTrade.recommendation.includes('buy')) {
  // Hold for 2-5 days, wider stop loss
}
```

### 4️⃣ Long-Term Investing (Weeks/Months)

**Goal:** Position trades, ignore short-term noise  
**Macro:** Weekly or monthly direction  
**Micro:** Daily confirmation

```typescript
// Long-term: Monthly trend + weekly confirmation
const longTerm = await technicalAnalysisService.analyzeMultiTimeframe(
  'BTC/USDT',
  '1M',    // Monthly trend (big picture)
  '1w'     // Weekly confirmation
);

// Long-term: Weekly + daily
const longTermDaily = await technicalAnalysisService.analyzeMultiTimeframe(
  'BTC/USDT',
  '1w',    // Weekly trend
  '1d'     // Daily entry
);

if (longTerm.macroTrend.direction === 'bullish') {
  // Hold for months, very wide stops
}
```

---

## 🛠️ Timeframe Utilities

### Import the utilities

```typescript
import {
  isValidTimeframe,
  validateTimeframeHierarchy,
  getCacheTTL,
  getCandleLimit,
  getSuggestedMacro,
  getSuggestedMicro,
  formatTimeframe,
  calculateTimeframeRatio,
  describeTimeframePair,
  getTimeframesForStrategy,
  RECOMMENDED_PAIRS
} from './services/timeframeUtils';
```

### Validate Timeframe Combinations

```typescript
// Check if combination is valid
const validation = validateTimeframeHierarchy('1h', '5m');

if (!validation.valid) {
  console.error(validation.error);  // Error message
  return;
}

// Advanced: Check if macro is larger than micro
const validation2 = validateTimeframeHierarchy('5m', '1h');
// Error: "Macro 5m (5m) must be larger than micro 1h (60m)"
```

### Get Suggested Timeframes

```typescript
// Given a micro timeframe, get suggested macro for strategy
const suggestedMacro = getSuggestedMacro('5m', 'day_trading');
// Returns: '1h'

const suggestedMicro = getSuggestedMicro('1h', 'swing_trading');
// Returns: '4h' (but this is actually larger, so swap them)
```

### Get Cache TTL

```typescript
import { getCacheTTL } from './services/timeframeUtils';

// Get cache duration in seconds
const ttl_1m = getCacheTTL('1m');     // 60 seconds
const ttl_5m = getCacheTTL('5m');     // 300 seconds
const ttl_1h = getCacheTTL('1h');     // 3600 seconds
const ttl_1d = getCacheTTL('1d');     // 86400 seconds
const ttl_1M = getCacheTTL('1M');     // 2592000 seconds

// Use in your code
const result = await technicalAnalysisService.analyzeSymbol('BTC/USDT', '1h');
await cacheService.set(cacheKey, result, getCacheTTL('1h'));
```

### Get Candle Limit

```typescript
import { getCandleLimit } from './services/timeframeUtils';

// Get recommended number of candles to fetch
const limit_1m = getCandleLimit('1m');   // 1440 (24 hours)
const limit_1h = getCandleLimit('1h');   // 24 (24 hours)
const limit_1d = getCandleLimit('1d');   // 365 (1 year)
```

### Format Timeframe for Display

```typescript
import { formatTimeframe } from './services/timeframeUtils';

console.log(formatTimeframe('5m'));   // "5 minutes"
console.log(formatTimeframe('1h'));   // "1 hour"
console.log(formatTimeframe('1w'));   // "1 week"
console.log(formatTimeframe('1M'));   // "1 month"
```

### Describe Timeframe Pair

```typescript
import { describeTimeframePair } from './services/timeframeUtils';

const desc = describeTimeframePair('1h', '5m');
// "1 hour (macro) + 5 minutes (micro, 12× gap)"

const desc2 = describeTimeframePair('1d', '1h');
// "1 day (macro) + 1 hour (micro, 24× gap)"

// Use in logging
logger.info(`Analyzing: ${describeTimeframePair('1h', '5m')}`);
```

### Calculate Timeframe Ratio

```typescript
import { calculateTimeframeRatio } from './services/timeframeUtils';

const ratio1 = calculateTimeframeRatio('1h', '5m');    // 12
const ratio2 = calculateTimeframeRatio('1d', '4h');    // 6
const ratio3 = calculateTimeframeRatio('1w', '1d');    // 7

// Understand the gap size
if (ratio > 10) {
  console.log('Large timeframe gap - maybe choose closer pair');
}
```

### Get Timeframes for Strategy

```typescript
import { getTimeframesForStrategy } from './services/timeframeUtils';

const scalping = getTimeframesForStrategy('scalping');
// ['1m', '5m', '15m']

const dayTrading = getTimeframesForStrategy('day_trading');
// ['5m', '15m', '1h', '4h']

const swingTrading = getTimeframesForStrategy('swing_trading');
// ['4h', '1d', '1w']

// Use to dynamically select
const strategy = 'day_trading';
const timeframes = getTimeframesForStrategy(strategy);
```

### View Recommended Pairs

```typescript
import { RECOMMENDED_PAIRS } from './services/timeframeUtils';

// See all recommendations
console.log(RECOMMENDED_PAIRS.scalping);
// [{ macro: '5m', micro: '1m' }, { macro: '15m', micro: '5m' }]

console.log(RECOMMENDED_PAIRS.day_trading);
// [
//   { macro: '1h', micro: '5m' },
//   { macro: '4h', micro: '15m' },
//   { macro: '4h', micro: '1h' }
// ]

console.log(RECOMMENDED_PAIRS.swing_trading);
// [
//   { macro: '1d', micro: '4h' },
//   { macro: '1d', micro: '1h' },
//   { macro: '1w', micro: '1d' }
// ]
```

---

## ⚠️ Validation & Error Handling

### Invalid Combinations (Will Throw Error)

```typescript
// ❌ Micro is larger than macro
try {
  await technicalAnalysisService.analyzeMultiTimeframe(
    'BTC/USDT',
    '5m',   // This is micro
    '1h'    // This is macro (WRONG - should be swapped)
  );
} catch (error) {
  console.error(error.message);
  // "Macro 5m (5m) must be larger than micro 1h (60m)"
}

// ❌ Invalid timeframe
try {
  await technicalAnalysisService.analyzeMultiTimeframe(
    'BTC/USDT',
    '2h',   // Not a valid timeframe
    '15m'
  );
} catch (error) {
  console.error(error.message);
  // "Invalid macro timeframe: 2h"
}

// ❌ Gap too large
try {
  await technicalAnalysisService.analyzeMultiTimeframe(
    'BTC/USDT',
    '1m',   // Too tiny
    '1M'    // Way too large (43200× gap!)
  );
} catch (error) {
  console.error(error.message);
  // "Timeframe gap too large (43200×). Keep ratio < 1440."
}
```

### Valid Error Messages

```typescript
const { valid, error } = validateTimeframeHierarchy('1h', '5m');

// Success case
if (valid) {
  // Execute analysis
}

// Error case
if (!valid) {
  console.log(error);
  // One of:
  // - "Invalid macro timeframe: ..."
  // - "Invalid micro timeframe: ..."
  // - "Macro ... must be larger than micro ..."
  // - "Timeframe gap too large (...). Keep ratio < 1440."
}
```

---

## 🎨 Advanced Usage

### Dynamic Strategy Selection

```typescript
async function analyzeWithStrategy(
  symbol: string,
  strategy: 'scalping' | 'day_trading' | 'swing_trading' | 'long_term'
) {
  const pairs = RECOMMENDED_PAIRS[strategy];
  const results = [];

  for (const pair of pairs) {
    try {
      const analysis = await technicalAnalysisService.analyzeMultiTimeframe(
        symbol,
        pair.macro,
        pair.micro
      );
      results.push(analysis);
    } catch (error) {
      logger.warn(`Failed to analyze ${pair.macro}/${pair.micro}: ${error.message}`);
    }
  }

  // Return strongest signal
  return results.sort((a, b) => b.aggregateConfidence - a.aggregateConfidence)[0];
}

// Use it
const bestSetup = await analyzeWithStrategy('BTC/USDT', 'day_trading');
console.log(`Best setup: ${bestSetup.recommendation}`);
```

### Batch Multi-Timeframe Analysis

```typescript
async function batchMultiTimeframe(
  symbols: string[],
  macro: string,
  micro: string
) {
  const results = new Map();

  const analyses = await Promise.allSettled(
    symbols.map(symbol =>
      technicalAnalysisService.analyzeMultiTimeframe(symbol, macro, micro)
    )
  );

  analyses.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.set(symbols[index], result.value);
    }
  });

  return results;
}

// Analyze 20 symbols with 1h/5m
const bigBatch = await batchMultiTimeframe(
  ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', /* ... 17 more ... */],
  '1h',
  '5m'
);

// Find strongest buy signals
const buys = Array.from(bigBatch.values())
  .filter(a => a.recommendation.includes('buy'))
  .sort((a, b) => b.aggregateConfidence - a.aggregateConfidence);

console.log(`Found ${buys.length} strong buy signals`);
```

### Timeframe Ladder (Test Multiple Combinations)

```typescript
async function analyzeTimeframeLadder(symbol: string) {
  const timeframes = ['5m', '15m', '1h', '4h', '1d'];
  const ladder = {};

  for (let i = 0; i < timeframes.length - 1; i++) {
    const macro = timeframes[i + 1];
    const micro = timeframes[i];

    try {
      const analysis = await technicalAnalysisService.analyzeMultiTimeframe(
        symbol,
        macro,
        micro
      );

      ladder[`${macro}_${micro}`] = {
        recommendation: analysis.recommendation,
        confidence: analysis.aggregateConfidence,
        aligned: analysis.microEntry.confirmation
      };
    } catch (error) {
      logger.error(`Failed ${macro}/${micro}: ${error.message}`);
    }
  }

  return ladder;
}

// Check alignment across all timeframes
const ladder = await analyzeTimeframeLadder('BTC/USDT');
console.log(ladder);
// {
//   '15m_5m': { recommendation: 'buy', confidence: 82, aligned: true },
//   '1h_15m': { recommendation: 'buy', confidence: 76, aligned: true },
//   '4h_1h': { recommendation: 'buy', confidence: 70, aligned: true },
//   '1d_4h': { recommendation: 'hold', confidence: 52, aligned: false }
// }
```

---

## 📊 Real-World Example

### Complete Day Trading Setup

```typescript
import { technicalAnalysisService } from './services/technicalAnalysisService';
import { 
  getSuggestedMacro, 
  getSuggestedMicro,
  describeTimeframePair 
} from './services/timeframeUtils';

async function executeDayTrade(symbol: string, position: 'long' | 'short') {
  // Step 1: Auto-select recommended macro for our micro choice
  const microTF = '5m';
  const macroTF = getSuggestedMacro(microTF, 'day_trading');
  
  if (!macroTF) {
    console.error(`No recommended macro for ${microTF} in day_trading`);
    return;
  }

  console.log(`Analyzing: ${describeTimeframePair(macroTF, microTF)}`);

  // Step 2: Run multi-timeframe analysis
  const analysis = await technicalAnalysisService.analyzeMultiTimeframe(
    symbol,
    macroTF,
    microTF
  );

  // Step 3: Check alignment
  const aligned = 
    (position === 'long' && 
     analysis.macroTrend.direction === 'bullish' &&
     analysis.microEntry.signal === 'buy') ||
    (position === 'short' &&
     analysis.macroTrend.direction === 'bearish' &&
     analysis.microEntry.signal === 'sell');

  if (!aligned) {
    console.log('Not aligned - skip trade');
    return;
  }

  // Step 4: Execute with confidence check
  if (analysis.aggregateConfidence < 70) {
    console.log(`Low confidence (${analysis.aggregateConfidence}%) - wait for stronger signal`);
    return;
  }

  // Step 5: Trade
  console.log(`
    Entry: ${symbol}
    Direction: ${position}
    Macro (${macroTF}): ${analysis.macroTrend.direction}
    Strength: ${analysis.macroTrend.strength}/100
    Urgency: ${analysis.microEntry.urgency}/100
    Overall: ${analysis.recommendation}
  `);

  // Place trade...
}

// Use it
await executeDayTrade('BTC/USDT', 'long');
```

---

## ✅ Checklist: Getting Started

- [ ] Import `technicalAnalysisService`
- [ ] Choose your strategy (scalping, day trading, swing trading, long-term)
- [ ] Select macro/micro timeframes from appropriate tier
- [ ] Call `analyzeMultiTimeframe()` with validated pair
- [ ] Check `recommendation` and `aggregateConfidence`
- [ ] Check `microEntry.confirmation` for alignment
- [ ] Execute trade if conditions met
- [ ] Use utilities for error handling and formatting

---

## 📞 Support

### Common Questions

**Q: What if macro and micro are swapped?**  
A: `validateTimeframeHierarchy()` will throw an error. Swap them and try again.

**Q: Can I analyze the same timeframe twice?**  
A: No - macro must be strictly larger. Use single `analyzeSymbol()` instead.

**Q: Which combination is "best"?**  
A: Depends on your holding time. See Strategy Examples section.

**Q: Can I cache results manually?**  
A: Yes - use `getCacheTTL()` to determine correct TTL for your timeframe.

### Troubleshooting

| Issue | Fix |
|-------|-----|
| "Invalid timeframe" | Check spelling: use `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `8h`, `1d`, `1w`, `1M` |
| "Macro must be larger" | Swap the parameters - macro should be bigger in duration |
| "Gap too large" | Use timeframes closer together (e.g., `1h` + `5m` not `1m` + `1M`) |
| No error but low confidence | Market conditions may not align - try again in 5 minutes |

---

## 🎉 Summary

You now have:
✅ Support for 10 different timeframes (1m to 1M)  
✅ Automatic validation of macro/micro pairs  
✅ Intelligent cache TTL matching  
✅ Recommended pairs for 4 trading strategies  
✅ Utility functions for working with timeframes  
✅ Real-world examples for all use cases

**Ready to trade any timeframe!**

