# Week 3: Visual Implementation Guide

## 🎨 UI Mockup & Layout

### Desktop View (1920px)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💰 Performance | 🔄 Arbitrage | 🌉 MultiHop | 📈 Slippage | ...             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┬──────────────┬────────────────┬──────────────┐
│ 🔄 Active   │ 💰 Best      │ 📊 Avg         │ ⚡ Top Route │
│ Arbitrages  │ Profit       │ Slippage       │              │
│             │              │                │              │
│ 12          │ 2.85%        │ 0.38%          │ 97% Eff      │
│             │ $520         │                │              │
└─────────────┴──────────────┴────────────────┴──────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Opportunity Filters                                          │
├────────────────────────┬──────────────────┬────────────────┤
│ Type: All ▼            │ Min Profit: $100 │ Max Slippage: 1%
│                        │ [####-----]      │ [##---------]  │
└────────────────────────┴──────────────────┴────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 🔄 Arbitrage Detection                                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──────────────────────────────────────────────┐                 │
│ │ USDC → USDT → USDC                  Low Risk │                 │
│ │ Uniswap → Sushiswap → Curve                 │                 │
│ │                                              │                 │
│ │ Profit: $450.25 (2.34%) | Volume: $20k      │                 │
│ │ Gas: $45 | Net: $405 | Exec: 12s            │                 │
│ │ Slippage: 0.045% | Confidence: 92%          │                 │
│ └──────────────────────────────────────────────┘                 │
│                                                                    │
│ ┌──────────────────────────────────────────────┐                 │
│ │ USDC → DAI → USDC                Medium Risk │                 │
│ │ Curve → Uniswap → Sushiswap                 │                 │
│ │ ... (more arbitrage opportunities)           │                 │
│ └──────────────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 🌉 Multi-Hop Swap Routes                                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──────────────────────────────────────────────┐                 │
│ │ USDC → ETH → DAI                    98% Eff │                 │
│ │ Uniswap: USDC→ETH (0.15%)                   │                 │
│ │ Curve: ETH→DAI (0.05%)                      │                 │
│ │                                              │                 │
│ │ Input: $5000 | Output: $14,250 | Min: $14,100 │              │
│ │ Total Slippage: 0.21% | vs Direct: +2.5%    │                 │
│ │ Liquidity: $75M | Gas: $95                   │                 │
│ └──────────────────────────────────────────────┘                 │
│                                                                    │
│ (more multi-hop routes...)                                       │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 📈 Slippage Predictions                                            │
│ [+ Show Detailed Analysis]                                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌─────────────────────────────────────┐                          │
│ │ USDC/ETH                      0.45% │                          │
│ │ Amount: $10,000                     │                          │
│ │ ┌──────┬──────────┬──────┐         │                          │
│ │ │ 0.20%│  0.45%   │ 1.20%│         │                          │
│ │ │ Min  │  Likely  │ Max  │         │                          │
│ │ └──────┴──────────┴──────┘         │                          │
│ │ Volatility: 1.15x | Liquidity: $250M │                        │
│ │ Recommended Max: 0.75%              │                          │
│ │ Breakdown: Base 0.20% + Liq 0.15% + Vol 0.10% │              │
│ └─────────────────────────────────────┘                          │
│                                                                    │
│ (more slippage predictions...)                                   │
└────────────────────────────────────────────────────────────────────┘
```

### Tablet View (768px)
```
┌──────────────┬──────────────┐
│ 🔄 Active    │ 💰 Best      │
│ Arbitrages   │ Profit       │
│ 12           │ $520 (2.85%) │
└──────────────┴──────────────┘
┌──────────────┬──────────────┐
│ 📊 Avg       │ ⚡ Top Route │
│ Slippage     │              │
│ 0.38%        │ 97% Eff      │
└──────────────┴──────────────┘

┌──────────────────────────────────┐
│ Filters (stacked vertically)    │
├──────────────────────────────────┤
│ Type: All ▼                      │
│                                  │
│ Min Profit: $100                 │
│ [####-----]                      │
│                                  │
│ Max Slippage: 1%                 │
│ [##---------]                    │
└──────────────────────────────────┘

[Arbitrage section - full width]
[Multi-Hop section - full width]
[Slippage section - full width]
```

### Mobile View (375px)
```
┌────────────────────┐
│ 🔄 Active Arbs     │
│ 12                 │
└────────────────────┘
┌────────────────────┐
│ 💰 Best Profit     │
│ $520 (2.85%)       │
└────────────────────┘
┌────────────────────┐
│ 📊 Avg Slippage    │
│ 0.38%              │
└────────────────────┘
┌────────────────────┐
│ ⚡ Top Route       │
│ 97% Eff            │
└────────────────────┘

┌────────────────────┐
│ Type: All ▼        │
└────────────────────┘
┌────────────────────┐
│ Min Profit: $100   │
│ [####-----]        │
└────────────────────┘
┌────────────────────┐
│ Max Slippage: 1%   │
│ [##---------]      │
└────────────────────┘

[Arbitrage cards - full width]
[Multi-Hop cards - full width]
[Slippage cards - full width]
```

---

## 🎯 User Interaction Flows

### Flow 1: Finding Arbitrage

```
┌─────────────────────┐
│ Open Opportunities  │
│ Tab                 │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│ See Summary Cards                │
│ - Active Arbs: 12                │
│ - Best Profit: $520 (2.85%)      │
│ - Avg Slippage: 0.38%            │
│ - Top Route: 97% Eff             │
└──────────┬──────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Scan Arbitrage Section            │
│ (Emerald background)              │
│ - See 12 profitable cycles        │
│ - Risk levels color-coded         │
│ - Confidence scores shown         │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ User Adjusts Min Profit Filter    │
│ to $200                           │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Arbitrage List Updates            │
│ Shows 4 opportunities             │
│ (highest profit ones)             │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ User Clicks USDC→USDT→USDC       │
│ Card                              │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Arbitrage Details Display:        │
│ - Profit: $520 (2.85%)           │
│ - Volume: $20,000 required       │
│ - Gas: $50                       │
│ - Net Profit: $470               │
│ - Risk: Low (green badge)        │
│ - Confidence: 94%                │
│ - Execution: 10 seconds          │
└──────────────────────────────────┘
```

### Flow 2: Optimizing a Swap

```
┌─────────────────────────┐
│ User Planning Swap:     │
│ 5000 USDC to ETH        │
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────────┐
│ Opens Opportunities Tab  │
│ to Check Routes          │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Sees Multi-Hop Section (Blue)    │
│ - Direct swap comparison shown   │
│ - Direct: 2.5 ETH (0.85% slip)   │
│ - Multi-hop: 2.568 ETH (0.35%)   │
│ - Difference: +3.2% better!      │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ User Clicks Best Multi-Hop Route │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ See Route Details:               │
│ Step 1: Uniswap                  │
│   USDC → DAI (0.15% impact)      │
│ Step 2: Curve                    │
│   DAI → USDC (0.05% impact)      │
│ Step 3: Sushiswap                │
│   USDC → ETH (0.15% impact)      │
│                                  │
│ Total Slippage: 0.35%            │
│ vs Direct Swap: +3.2% gain       │
│ Estimated Gas: $95               │
│ Liquidity Available: $75M         │
│ Efficiency: 98%                  │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ User Executes Multi-Hop Swap     │
│ and Gets Better Rate!            │
└──────────────────────────────────┘
```

### Flow 3: Predicting Slippage

```
┌──────────────────────────┐
│ User Planning Large Trade │
│ $50,000 USDC → ETH       │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Opens Opportunities Tab          │
│ Scroll to Slippage Section       │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Sees Slippage Predictions        │
│ USDC/ETH Token Pair              │
│ Predicted Slippage: 0.45%        │
│ Range: 0.20% - 1.20%             │
│ (min, likely, max)               │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ User Clicks                      │
│ [+ Show Detailed Analysis]       │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ See Breakdown:                   │
│ Volatility Factor: 1.15x         │
│ Liquidity Depth: $250M           │
│ Recommended Max: 0.75%           │
│                                  │
│ Price Impact Components:         │
│ • Base Impact: 0.20%             │
│ • Liquidity Impact: 0.15%        │
│ • Volatility Impact: 0.10%       │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ User Decision:                   │
│ "0.45% predicted is reasonable"  │
│ "I'll set tolerance to 0.75%"    │
│ Execute swap with confidence     │
└──────────────────────────────────┘
```

---

## 🎨 Component States

### Arbitrage Card - Normal State
```
┌─────────────────────────────────────────┐
│ USDC → USDT → USDC            Low Risk  │
│ Uniswap → Sushiswap → Curve            │
│                                         │
│ Profit: $450.25 (2.34%)                │
│ Volume Req: $20,000                    │
│ Gas: $45  |  Net: $405                 │
│ Execution: 12s | Slippage: 0.045% | ⭐92% │
└─────────────────────────────────────────┘
```

### Arbitrage Card - Hover State
```
┌─────────────────────────────────────────┐
│ USDC → USDT → USDC            Low Risk  │ 🖱️ (highlighted)
│ Uniswap → Sushiswap → Curve            │
│                                         │
│ Profit: $450.25 (2.34%)                │
│ Volume Req: $20,000                    │
│ Gas: $45  |  Net: $405                 │
│ Execution: 12s | Slippage: 0.045% | ⭐92% │
└─────────────────────────────────────────┘
```

### Multi-Hop Card - Normal State
```
┌──────────────────────────────────────────┐
│ USDC → ETH → DAI              98% Eff    │
│ Uniswap: USDC→ETH (0.15%)               │
│ Curve: ETH→DAI (0.05%)                  │
│                                          │
│ Input: $1000 | Expected: $2850          │
│ vs Direct Swap: +2.5%                   │
│ Total Slippage: 0.21%                   │
└──────────────────────────────────────────┘
```

### Slippage Prediction - Collapsed
```
┌──────────────────────────────────┐
│ USDC/ETH         Amount: $10,000 │
│            Predicted: 0.45%      │
│                                  │
│ Min: 0.20% | Likely: 0.45%      │
│ Max: 1.20%                       │
│                                  │
│ Volatility: 1.15x                │
│ Recommended Max: 0.75%           │
└──────────────────────────────────┘
```

### Slippage Prediction - Expanded
```
┌──────────────────────────────────────┐
│ USDC/ETH         Amount: $10,000    │
│            Predicted: 0.45%        │
│                                    │
│ Min: 0.20% | Likely: 0.45%        │
│ Max: 1.20%                        │
│                                    │
│ Volatility: 1.15x                 │
│ Liquidity Depth: $250M            │
│ Recommended Max: 0.75%            │
│                                    │
│ Price Impact Breakdown:           │
│ • Base Impact: 0.20%              │
│ • Liquidity Impact: 0.15%         │
│ • Volatility Impact: 0.10%        │
│                                    │
│ [- Hide Analysis]                 │
└──────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│ User Interaction (Filters, Chain Selection)              │
└────────────────────────┬─────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ API Request  │ │ API Request  │ │ API Request  │
  │ /arbitrage   │ │/multihop     │ │/slippage     │
  └──────────────┘ └──────────────┘ └──────────────┘
        │                │                │
        ▼                ▼                ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ Query Hook   │ │ Query Hook   │ │ Query Hook   │
  │ (30s cache)  │ │ (45s cache)  │ │ (60s cache)  │
  └──────────────┘ └──────────────┘ └──────────────┘
        │                │                │
        ▼                ▼                ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ State Update │ │ State Update │ │ State Update │
  └──────────────┘ └──────────────┘ └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │ Filtered Data Applied           │
        │ (Filter state + Data state)     │
        └────────────────┬────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ Arbitrage    │ │ Multi-Hop    │ │ Slippage     │
  │ Section      │ │ Section      │ │ Section      │
  │ (Conditional)│ │ (Conditional)│ │ (Always)     │
  └──────────────┘ └──────────────┘ └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │ Rendered UI Components          │
        │ (Cards, Charts, Controls)       │
        └────────────────────────────────┘
```

---

## 🎯 Summary Cards Grid Layout

### 4-Column (Desktop)
```
┌──────────┬──────────┬──────────┬──────────┐
│Emerald   │Blue      │Amber     │Purple    │
│🔄 Count  │💰 Profit │📊 Slip   │⚡ Route  │
└──────────┴──────────┴──────────┴──────────┘
```

### 2-Column (Tablet)
```
┌──────────┬──────────┐
│Emerald   │Blue      │
│🔄 Count  │💰 Profit │
├──────────┼──────────┤
│Amber     │Purple    │
│📊 Slip   │⚡ Route  │
└──────────┴──────────┘
```

### 1-Column (Mobile)
```
┌──────────────┐
│Emerald       │
│🔄 Count      │
├──────────────┤
│Blue          │
│💰 Profit     │
├──────────────┤
│Amber         │
│📊 Slippage   │
├──────────────┤
│Purple        │
│⚡ Route      │
└──────────────┘
```

---

## ✨ Visual Elements Reference

### Gradient Cards (Summary)
```
Emerald Gradient:
  From: #ecfdf5 (light: 50)
  To:   #064e3b (dark: 900)
  
Blue Gradient:
  From: #eff6ff
  To:   #0c2340
  
Amber Gradient:
  From: #fefce8
  To:   #78350f
  
Purple Gradient:
  From: #faf5ff
  To:   #3f0f5c
```

### Opportunity Cards
```
Arbitrage (Emerald)
  BG: #f0fdf4 (light) / #0a3622/0.2 (dark)
  Border: #dcfce7 (light) / #064e3b (dark)
  Text: #15803d (green-700)

Multi-Hop (Blue)
  BG: #f0f9ff / #0c2340/0.2
  Border: #bfdbfe / #0c2340
  Text: #1e40af (blue-700)

Slippage (Gray)
  BG: #f9fafb / #475569/0.5
  Border: #e5e7eb / #475569
  Text: #111827 (gray-900)
```

### Icon Set
```
Summary Cards:
  🔄 Arbitrage (rotation)
  💰 Profit (money)
  📊 Analytics (chart)
  ⚡ Performance (lightning)

Sections:
  🔄 Arbitrage detection
  🌉 Multi-hop routes
  📈 Slippage predictions

Control:
  ▼ Dropdown
  [+] Expand
  [✕] Close
```

---

**Visual Guide Complete ✨**
