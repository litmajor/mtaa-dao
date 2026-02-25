# Week 3: Opportunities Tab - Quick Reference

## 🎯 One-Page Summary

### What's New?
The Opportunities tab has been upgraded from basic arbitrage detection to a comprehensive opportunity discovery system with:
- **Arbitrage Detection** - Find profitable cycles (updated every 30s)
- **Multi-Hop Optimization** - Get better rates through multiple pools
- **Slippage Predictions** - Understand price impact for your swaps
- **Smart Filtering** - Filter by profit, type, and slippage
- **Risk Assessment** - Confidence scores and risk levels

### Key Numbers
| Feature | Value |
|---------|-------|
| Summary Cards | 4 (Arbitrage Count, Best Profit, Avg Slippage, Top Route) |
| Filters | 3 (Type, Min Profit, Max Slippage) |
| Feature Sections | 3 (Arbitrage, Multi-Hop, Slippage) |
| Cache Intervals | 4 (30s, 45s, 60s, 30s) |
| Data Refresh | Real-time with smart caching |

---

## 🔌 Backend Endpoints Required

### 1. Arbitrage Opportunities
```
GET /api/dex/arbitrage?chain={chain}&minProfit={minProfit}
Returns: ArbitrageOpportunity[]
Cache: 30 seconds
```
**Data needed**: Profit amount, net profit after gas, volume required, confidence

### 2. Multi-Hop Routes  
```
GET /api/dex/multihop-routes?chain={chain}&maxSlippage={maxSlippage}
Returns: MultiHopSwap[]
Cache: 45 seconds
```
**Data needed**: Path details, input/output, comparison to direct swap

### 3. Slippage Predictions
```
GET /api/dex/slippage-predictions?chain={chain}
Returns: SlippagePrediction[]
Cache: 60 seconds
```
**Data needed**: Predicted slippage ranges, volatility factors, breakdown

### 4. Opportunity Summary
```
GET /api/dex/opportunity-summary?chain={chain}
Returns: OpportunitySummary
Cache: 30 seconds
```
**Data needed**: Count of arbitrages, best opportunity, average metrics

---

## 🎨 UI Layout

### Top Section (Always Visible)
```
┌─────────────────────────────────────────┐
│ 4 Summary Cards (Emerald, Blue, Amber, Purple) │
│ Active Arbs | Best Profit | Avg Slippage | Top Route │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Filters (3 controls)                   │
│ Type | Min Profit Slider | Max Slippage Slider │
└─────────────────────────────────────────┘
```

### Conditional Sections
```
IF Type = "all" OR "arbitrage"
┌─────────────────────────────────────────┐
│ Arbitrage Detection (Emerald background) │
│ List of profitable cycles with details  │
└─────────────────────────────────────────┘

IF Type = "all" OR "multihop"
┌─────────────────────────────────────────┐
│ Multi-Hop Swap Routes (Blue background) │
│ Optimized paths with comparisons        │
└─────────────────────────────────────────┘
```

### Always-Visible Section
```
┌─────────────────────────────────────────┐
│ Slippage Predictions (Collapsible)      │
│ Top 5 token pairs with ranges           │
│ [+ Show Detailed Analysis] button       │
└─────────────────────────────────────────┘
```

---

## 🎯 User Features

### Feature 1: Arbitrage Detection
**What it does**: Shows profitable token cycles like USDC → USDT → USDC

**Key Metrics**:
- Profit in $ and %
- Volume required to execute
- Gas cost estimate
- Net profit (after gas)
- Risk level (Low/Medium/High)
- Confidence % (80-100 is good)
- Execution time in seconds

### Feature 2: Multi-Hop Routes
**What it does**: Finds better swap rates by routing through multiple pools

**Key Metrics**:
- Full path with DEXes (e.g., Uniswap → Curve → Sushiswap)
- Input and expected output amounts
- How much better than direct swap (%)
- Total slippage of the route
- Efficiency score (0-100%)

### Feature 3: Slippage Predictions
**What it does**: Predicts what slippage you'll get on a trade

**Key Metrics**:
- Predicted slippage (most likely)
- Range (min, likely, max)
- Volatility factor (1.0x = normal)
- Liquidity depth (how much available)
- Recommended max slippage setting
- Breakdown of costs:
  - Base impact (protocol fee)
  - Liquidity impact (pool utilization)
  - Volatility impact (price movement)

---

## 💻 State Variables

```typescript
// Filter states
opportunitiesFilter: 'all' | 'arbitrage' | 'multihop'
minProfitFilter: number (0-1000)
slippageFilter: number (0-5)

// Selection states
selectedArbitrage: ArbitrageOpportunity | null
selectedMultiHop: MultiHopSwap | null

// UI state
showSlippageAnalysis: boolean
```

---

## 🔄 Query Hooks

| Hook | Cache | Updates | Purpose |
|------|-------|---------|---------|
| arbitrage-opportunities | 30s | Every 30s | Find profitable cycles |
| multihop-swaps | 45s | Every 45s | Optimize swap routes |
| slippage-predictions | 60s | Every 60s | Predict slippage ranges |
| opportunity-summary | 30s | Every 30s | Top-level metrics |

**Cache Strategy**: Shorter for actively trading data, longer for stable metrics

---

## 🎨 Color Scheme

### Gradient Cards (Top)
- **Emerald**: Active Arbitrage Count
- **Blue**: Best Profit Amount
- **Amber**: Average Slippage
- **Purple**: Top Route Efficiency

### Section Backgrounds
- **Arbitrage Cards**: Emerald green (emerald-50 light, emerald-900/20 dark)
- **Multi-Hop Cards**: Blue (blue-50 light, blue-900/20 dark)
- **Slippage Cards**: Gray (gray-50 light, slate-700/50 dark)

### Risk Level Badges
- **Green**: Low risk ✓
- **Amber**: Medium risk ⚠️
- **Red**: High risk ✗

---

## 📱 Responsive Design

| Screen | Summary Cards | Filters | Opportunities |
|--------|---|---------|---|
| Mobile < 640px | 1 column | Stacked | Full width |
| Tablet 640-1024px | 2 columns | 3 columns | Full width |
| Desktop > 1024px | 4 columns | 3 columns | Full width |

---

## ⚡ Performance

### Load Times (Expected)
- Summary cards: < 500ms
- Arbitrage load: < 1000ms
- Multi-hop routes: < 800ms
- Slippage data: < 600ms
- **Total page**: < 2 seconds first load

### Real-Time Updates
- Every 30 seconds: Arbitrage and Summary refresh
- Every 45 seconds: Multi-hop routes refresh
- Every 60 seconds: Slippage predictions refresh

---

## 🧪 Testing Checklist

### Smoke Tests (Do These First)
- [ ] Opportunities tab opens without errors
- [ ] Summary cards display numbers
- [ ] Arbitrage section loads
- [ ] Multi-hop section loads
- [ ] Slippage section loads
- [ ] No TypeScript errors in console

### Feature Tests
- [ ] Type filter changes arbitrage/multihop display
- [ ] Min profit slider filters arbitrage list
- [ ] Max slippage slider filters multihop list
- [ ] Clicking "Show Detailed Analysis" expands details
- [ ] Risk level badges show correct colors
- [ ] Loading states appear while data loads

### Responsive Tests
- [ ] Mobile: 375px width works
- [ ] Tablet: 768px width works
- [ ] Desktop: 1920px width works
- [ ] Cards don't overlap
- [ ] Text is readable at all sizes

### Dark Mode Tests
- [ ] All text readable in dark mode
- [ ] Cards have visible borders
- [ ] Gradients work in dark mode
- [ ] Color contrast is acceptable

---

## 🔧 Configuration

### Environment
- Uses existing API base URL
- No new environment variables needed
- Uses existing auth tokens

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

---

## 📊 Data Structures

### ArbitrageOpportunity
```typescript
{
  id: string
  route: ["USDC", "USDT", "USDC"]  // Token path
  dexPath: ["Uniswap", "Sushiswap", "Curve"]  // DEX path
  profitAmount: 450.25
  profitPercentage: 2.34
  volumeRequired: 20000
  gasEstimate: 45.00
  netProfit: 405.25
  riskLevel: "low" | "medium" | "high"
  executionTime: 12  // seconds
  slippage: 0.045  // percentage
  confidence: 92  // 0-100
}
```

### MultiHopSwap
```typescript
{
  id: string
  path: [
    { dex: "Uniswap", tokenIn: "USDC", tokenOut: "ETH", priceImpact: 0.15 },
    { dex: "Curve", tokenIn: "ETH", tokenOut: "DAI", priceImpact: 0.05 }
  ]
  inputAmount: 1000
  expectedOutput: 2850
  minOutput: 2820
  totalSlippage: 0.21
  estimatedGas: 120
  priceComparisonToDirectSwap: 2.5  // % better
  liquidity: 50000000
  efficiency: 98  // 0-100
}
```

### SlippagePrediction
```typescript
{
  tokenPair: "USDC/ETH"
  amount: 10000
  predictedSlippage: 0.45
  slippageRanges: {
    min: 0.20,
    likely: 0.45,
    max: 1.20
  }
  volatilityFactor: 1.15
  liquidityDepth: 250.5  // millions
  recommendedMaxSlippage: 0.75
  priceImpactBreakdown: {
    base: 0.20,
    liquidity: 0.15,
    volatility: 0.10
  }
}
```

### OpportunitySummary
```typescript
{
  activeArbitrages: 12
  bestArbitrage: ArbitrageOpportunity | null
  averageSlippage: 0.38
  topMultiHopPath: MultiHopSwap | null
  scanTime: 245  // milliseconds
}
```

---

## 🚀 Deployment

### Pre-Deployment Checklist
- [ ] All 4 backend endpoints implemented
- [ ] Endpoints return correct data structures
- [ ] Cache timing configured
- [ ] Gas estimation working
- [ ] Live data flowing

### Testing Progression
1. Local development with mock data
2. Staging with real endpoint connection
3. Production deployment

### Rollback
If issues occur:
1. Opportunities tab shows "Not available"
2. User can still use other tabs
3. No errors thrown

---

## 📞 Support

### Common Issues

**Q: Arbitrage section is empty**
A: Check `/api/dex/arbitrage` endpoint is returning data. Min profit filter might be too high.

**Q: Multi-hop routes not showing**
A: Verify `/api/dex/multihop-routes` returns data. Max slippage filter might be too low.

**Q: Numbers look strange**
A: Check API response data types. Ensure amounts are in USD and percentages as decimals (0.45 for 0.45%).

**Q: Dark mode colors wrong**
A: Verify Tailwind dark mode is enabled in environment. Colors should use `dark:` variants.

---

## 📈 Success Metrics

### Performance Targets
- First load: < 2 seconds
- Filter update: < 300ms
- Refresh cycle: 30-60 seconds
- API response: < 500ms

### User Experience
- Arbitrage confidence > 90%
- Multi-hop improvement > 1%
- Slippage predictions within ±0.2%
- Risk levels accurately colored

---

## 🎓 Learning Resources

- [Full Implementation](WEEK_3_OPPORTUNITIES_ENHANCEMENT.md)
- [Backend API Specs](WEEK_3_OPPORTUNITIES_ENHANCEMENT.md#-backend-api-endpoints)
- [User Workflows](WEEK_3_OPPORTUNITIES_ENHANCEMENT.md#-user-workflows)
- [Code Integration](client/src/pages/DeFiDEXAnalytics.tsx)

---

**Week 3 Opportunities Tab Complete ✨**
