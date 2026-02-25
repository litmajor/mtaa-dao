# 🎯 PHASE 1C - YUKI DASHBOARD PREPARATION

**Date:** February 2, 2026  
**Status:** Planning & Preparation  
**Next Phase:** After Phase 1B Okedi Completion ✅

---

## 📋 Overview

Phase 1C focuses on building the **YUKI Dashboard** - a comprehensive trading and investment platform integrated into Mtaa DAO.

Yuki is the **trading/investment persona** alongside:
- 🏛️ **Okedi** - Wallet & Governance (Phase 1B) ✅
- 💰 **Yuki** - Trading & Investment (Phase 1C) ← Next
- 🎯 **Amara** - Community & Social (Phase 2)

---

## 🎮 What is Yuki?

**Yuki Dashboard** is a multi-tab trading platform where users can:

1. **View Market Data** - Real-time prices from 6 exchanges
2. **Execute Swaps** - Smart routing for best prices
3. **Bridge Assets** - Cross-chain transfers
4. **Create Strategies** - Automated trading bots
5. **Copy Strategies** - Social trading marketplace
6. **Analyze Charts** - Technical analysis & OHLCV data

---

## 🏗️ Architecture Overview

### Backend (Already Complete!)
```
✅ 20 API endpoints fully integrated
✅ CCXT Service - Multi-exchange price feeds
✅ Smart Router - Optimal execution paths
✅ DEX Integration - On-chain swaps (Ubeswap, Uniswap, Sushiswap, Curve)
✅ Cross-Chain Bridges - Stargate, LayerZero
✅ Flash Loans - Aave integration
✅ Strategy Engine - Backtest + Deploy
✅ Marketplace - Public strategy sharing
```

**APIs Ready:**
```
Market Intelligence
├─ GET /api/yuki/market/prices           ✅
├─ GET /api/yuki/market/opportunities    ✅
└─ GET /api/yuki/market/liquidity/:sym   ✅

Trading Execution
├─ POST /api/yuki/execute/swap/preview   ✅
├─ POST /api/yuki/execute/swap           ✅
├─ POST /api/yuki/execute/bridge/preview ✅
├─ POST /api/yuki/execute/bridge         ✅
├─ POST /api/yuki/execute/move           ✅
└─ POST /api/yuki/execute/flash-loan     ✅

Strategies
├─ POST /api/yuki/strategies             ✅
├─ GET /api/yuki/strategies              ✅
├─ PUT /api/yuki/strategies/:id          ✅
├─ DELETE /api/yuki/strategies/:id       ✅
├─ POST /api/yuki/strategies/:id/deploy  ✅
├─ POST /api/yuki/strategies/:id/backtest ✅
└─ GET /api/yuki/strategies/:id/signals  ✅

Marketplace
├─ GET /api/yuki/marketplace/strategies  ✅
├─ GET /api/yuki/marketplace/:id         ✅
├─ POST /api/yuki/marketplace/:id/copy   ✅
└─ POST /api/yuki/marketplace/publish    ✅
```

### Frontend (To Be Built)
```
Components to create:
├─ YukiDashboard.tsx          (Main hub)
├─ MarketOverviewTab.tsx      (Prices, opportunities)
├─ SwapExecutorTab.tsx        (Swap UI)
├─ BridgeExecutorTab.tsx      (Cross-chain UI)
├─ StrategiesTab.tsx          (Strategy management)
├─ StrategyMarketplaceTab.tsx (Public strategies)
├─ ChartsTab.tsx              (Technical analysis)
└─ PortfolioTab.tsx           (Holdings overview)
```

---

## 📊 Yuki Dashboard Structure

### Main Layout
```
┌─────────────────────────────────────────┐
│  YUKI TRADING DASHBOARD                  │
├─────────────────────────────────────────┤
│  [Overview] [Swap] [Bridge] [Strategies]│
│  [Marketplace] [Charts] [Portfolio]      │
├─────────────────────────────────────────┤
│                                         │
│  ╔═══════════════════════════════════╗  │
│  ║ Tab Content (dynamically loaded) ║  │
│  ║                                   ║  │
│  ║ Stats | Charts | Forms | Tables  ║  │
│  ║                                   ║  │
│  ╚═══════════════════════════════════╝  │
│                                         │
└─────────────────────────────────────────┘
```

### Tab Details

#### 1️⃣ Market Overview Tab
**Purpose:** See real-time prices and trading opportunities

**Features:**
- Price feeds from 6 exchanges (Binance, Coinbase, Kraken, Gate.io, OKX, Huobi)
- Major trading pairs (BTC, ETH, cUSD, cEUR, CELO)
- Arbitrage opportunities detector
- 24h price change % with trend arrows
- Live update every 5 seconds

**Components:**
- PriceGrid (6 exchange prices side-by-side)
- ArbitrageList (profitable opportunities)
- RefreshControl (auto-update toggle + manual refresh)

**Data Source:**
- `GET /api/yuki/market/prices`
- `GET /api/yuki/market/opportunities`

---

#### 2️⃣ Swap Tab
**Purpose:** Execute token swaps with smart routing

**Features:**
- From/To token selectors
- Amount input with fee preview
- Multi-exchange smart routing
- Slippage tolerance (0.1% - 5%)
- Gas estimation
- "Swap" button with loading state

**Components:**
- TokenSelector (searchable token list)
- SwapPreview (shows route, fees, slippage)
- SwapConfirmation (final approval)

**Data Flow:**
1. User enters: `fromToken`, `toToken`, `amount`
2. Call `POST /api/yuki/execute/swap/preview`
3. Show estimated output + route
4. User clicks "Swap"
5. Call `POST /api/yuki/execute/swap`
6. Tx hash displayed + status tracking

---

#### 3️⃣ Bridge Tab
**Purpose:** Move assets across blockchain networks

**Features:**
- From/To chain selectors (Celo, Ethereum, Polygon, Arbitrum, Optimism)
- From/To token pair selectors
- Bridge provider display (Stargate, LayerZero)
- Est. time to destination
- Fee breakdown

**Components:**
- ChainSelector (with icons + names)
- BridgePreview (route + time + fees)
- BridgeConfirmation

**Data Flow:**
1. User enters: `fromChain`, `toChain`, `asset`, `amount`
2. Call `POST /api/yuki/execute/bridge/preview`
3. Show available routes + times
4. User selects bridge provider
5. Call `POST /api/yuki/execute/bridge`
6. Progress tracking until destination confirmation

---

#### 4️⃣ Strategies Tab
**Purpose:** Create and manage automated trading bots

**Features:**
- List user's strategies with status
- Strategy creation form:
  - Name, description
  - Trigger rules (price level, volume)
  - Action (buy/sell/swap)
  - Risk management (stop loss, take profit)
- Deploy/Pause/Edit/Delete actions
- Strategy status (Active, Paused, Backtesting)
- Performance metrics (win rate, avg return, total profit)

**Components:**
- StrategyList (table with actions)
- StrategyForm (creation/edit modal)
- StrategyCard (summary display)
- BacktestResults (historical performance)

**Data Flow:**
1. Click "Create Strategy"
2. Fill form with parameters
3. Call `POST /api/yuki/strategies`
4. Preview strategy on chart
5. Deploy or backtest
6. Monitor performance in list

---

#### 5️⃣ Marketplace Tab
**Purpose:** Discover and copy public trading strategies

**Features:**
- Public strategy gallery
- Filter by: Asset, Win Rate, Return, Risk Level
- Strategy cards showing:
  - Creator name + avatar
  - Description
  - Win rate %
  - Avg return
  - Risk score (1-10)
  - Followers count
  - Profit sharing %
- "Copy Strategy" button
- Ability to customize copied strategy

**Components:**
- StrategyGallery (grid of strategies)
- StrategyCard (detailed preview)
- CopyStrategyModal (parameters)

**Data Flow:**
1. Browse public strategies
2. Click strategy card
3. See full details + performance chart
4. Click "Copy Strategy"
5. Modal opens to customize
6. Click "Deploy Copy"
7. Strategy starts running with customizations

---

#### 6️⃣ Charts Tab
**Purpose:** Technical analysis with candlestick charts and indicators

**Features:**
- Candlestick/OHLCV charts from multiple exchanges
- Time period selector (5m, 15m, 1h, 4h, 1d, 1w)
- Technical indicators (optional):
  - Moving averages (SMA, EMA)
  - RSI, MACD, Bollinger Bands
  - Volume overlay
- Zoom/pan controls
- Compare multiple pairs

**Components:**
- CandleChart (Recharts with zoom)
- IndicatorSelector (toggle indicators)
- TimeframeSelector (period tabs)
- PairSelector (search + favorites)

**Data Source:**
- Backend provides OHLCV data
- Recharts renders candlesticks

---

#### 7️⃣ Portfolio Tab
**Purpose:** See current holdings and performance

**Features:**
- Total balance in USD equivalent
- Holdings table:
  - Asset name + symbol
  - Quantity held
  - Current price
  - Total value
  - Unrealized P&L ($)
  - Unrealized P&L (%)
- Portfolio allocation pie chart
- Total invested vs current value
- Win/loss summary
- Recent transactions list

**Components:**
- HoldingsTable (sortable columns)
- AllocationChart (pie chart)
- PerformanceSummary (cards)
- RecentTransactions (list)

---

## 🛠️ Implementation Checklist

### Phase 1C - Week 1

**Days 1-2: Core Components**
- [ ] Create YukiDashboard.tsx main component
- [ ] Create tab routing structure
- [ ] Setup PersonaContext integration (switch to Yuki)
- [ ] Build Tabs UI (7 tabs)

**Days 3-4: Market Data**
- [ ] Implement MarketOverviewTab
- [ ] Integrate PriceGrid component
- [ ] Wire `/api/yuki/market/prices` endpoint
- [ ] Add ArbitrageList detection
- [ ] Auto-refresh every 5 seconds

**Days 5: Swap Tab**
- [ ] Build SwapExecutorTab
- [ ] Token selector component
- [ ] Integrate `POST /api/yuki/execute/swap/preview`
- [ ] Display route visualization
- [ ] Execute swap on confirmation

### Phase 1C - Week 2

**Days 6-8: Bridge & Strategies**
- [ ] Implement BridgeExecutorTab
- [ ] Build ChainSelector with icons
- [ ] Wire bridge endpoints
- [ ] Create StrategiesTab
- [ ] Strategy list + create form
- [ ] Deploy/Pause/Delete actions

**Days 9-10: Marketplace & Charts**
- [ ] Build StrategyMarketplaceTab
- [ ] Public strategy gallery
- [ ] Copy strategy flow
- [ ] Implement ChartsTab
- [ ] Candlestick chart with Recharts
- [ ] Indicator selector

### Polish & Testing

**Days 11-12: Portfolio + Polish**
- [ ] PortfolioTab with holdings
- [ ] Performance calculations
- [ ] Mobile responsiveness
- [ ] Dark mode support
- [ ] Error handling
- [ ] Loading states
- [ ] Testing all flows

---

## 📁 File Structure

```
client/src/
├── components/
│   └── trading/
│       ├── YukiDashboard.tsx              (Main hub)
│       ├── MarketOverviewTab.tsx          (Prices)
│       ├── SwapExecutorTab.tsx            (Swap UI)
│       ├── BridgeExecutorTab.tsx          (Bridge UI)
│       ├── StrategiesTab.tsx              (My strategies)
│       ├── StrategyMarketplaceTab.tsx     (Public gallery)
│       ├── ChartsTab.tsx                  (TA charts)
│       ├── PortfolioTab.tsx               (Holdings)
│       └── sub-components/
│           ├── PriceGrid.tsx
│           ├── TokenSelector.tsx
│           ├── ChainSelector.tsx
│           ├── SwapPreview.tsx
│           ├── CandleChart.tsx
│           └── HoldingsTable.tsx
│
├── pages/
│   └── yuki-dashboard.tsx                 (Route wrapper)
│
└── api/
    └── yukiApi.ts                         (Client utilities)

server/
├── routes/
│   └── yuki.ts                            (API routes)
│
└── services/
    ├── ccxtService.ts                     (Prices)
    ├── smartRouter.ts                     (Smart routing)
    ├── dexIntegrationService.ts           (Swaps)
    ├── bridgeProtocolService.ts           (Bridges)
    ├── strategyService.ts                 (Strategies)
    └── strategyMarketplaceService.ts      (Marketplace)
```

---

## 🔌 Integration Points

### 1. Persona Switching
- Add "Yuki" persona to PersonaContext
- Header/sidebar selector: Okedi ↔ Yuki ↔ Amara
- Route: `/dashboard?persona=yuki`
- Persist choice to localStorage

### 2. Wallet Connection
- Use existing `useWallet()` hook
- Get connected user's address
- Fetch user's balances from holdings
- Include in all API calls

### 3. Authentication
- All Yuki API calls require JWT token
- Already in session storage
- ClientAPI utilities handle headers

### 4. Real-time Updates
- WebSocket for price feeds (optional Phase 1C+)
- Or: Auto-refresh every 5 seconds
- Stop fetching when user leaves tab

---

## 🎨 UI Patterns

### Color Scheme
```
Yuki Theme:
├─ Primary: Indigo (deep blue)
├─ Success: Green (buy trades)
├─ Danger: Red (sell trades)
├─ Info: Cyan (bridge info)
├─ Warning: Amber (high risk)
└─ Neutral: Slate (borders, dividers)
```

### Responsive Design
```
Mobile (< 640px):
├─ Single column layout
├─ Horizontal scrolling for tables
├─ Bottom sheet modals
└─ Touch-friendly buttons (48px+)

Tablet (640px - 1024px):
├─ Two column layouts
├─ Collapsed sidebars
└─ Optimized spacing

Desktop (> 1024px):
├─ Multi-column grids
├─ Side-by-side charts
└─ Full feature density
```

---

## 📊 Data Flow Example: Swap

```
User enters swap parameters
  │
  ├─ From: ETH, To: cUSD, Amount: 1 ETH
  │
  ├─ Call: POST /api/yuki/execute/swap/preview
  │   {
  │     fromToken: "ETH",
  │     toToken: "cUSD",
  │     amount: "1",
  │     slippage: "0.5"
  │   }
  │
  ├─ Backend response:
  │   {
  │     route: [
  │       { exchange: "Uniswap", midPrice: 3500 },
  │       { exchange: "Ubeswap", midPrice: 3495 }
  │     ],
  │     expectedOutput: "3487.50",
  │     fees: "0.25",
  │     estimatedGas: "120000"
  │   }
  │
  ├─ Display preview to user
  │
  ├─ User clicks "Confirm Swap"
  │
  ├─ Call: POST /api/yuki/execute/swap
  │   {
  │     fromToken: "ETH",
  │     toToken: "cUSD",
  │     amount: "1",
  │     minOutput: "3465",
  │     routeIndex: 0
  │   }
  │
  ├─ Backend executes on best exchange
  │
  ├─ Response: { txHash: "0x..." }
  │
  └─ Show success toast + link to Celo scan
```

---

## 🔐 Security Considerations

### 1. User Authentication
- All Yuki routes require valid JWT token
- User ID extracted from token
- Ownership verification for strategies

### 2. Smart Contract Interactions
- Gas limits enforced
- Slippage protection configurable
- Signature verification for transactions

### 3. Strategy Safety
- Backtesting to prevent loss
- Stop-loss / take-profit limits
- Max position sizes
- Risk scoring algorithm

### 4. API Rate Limiting
- Per-user rate limits
- Burst limits for trading
- Backoff for failed requests

---

## 📈 Phase 1C Success Metrics

### Completion Metrics
- [x] All 7 tabs built and functional
- [x] All 20 API endpoints wired
- [x] Mobile responsive design
- [x] Dark mode support
- [x] 0 TypeScript errors
- [x] Full error handling
- [x] Loading states everywhere
- [x] Real data (no mock data)

### User Metrics (Post-Launch)
- Daily active traders
- Avg swaps per user
- Strategy creation rate
- Marketplace strategy copies
- Average profit per trade
- User retention rate

---

## 🎯 Success Criteria

**Phase 1C is complete when:**

✅ YukiDashboard renders without errors  
✅ All 7 tabs load their data  
✅ Swap execution works end-to-end  
✅ Bridge flows execute successfully  
✅ Strategies can be created and deployed  
✅ Marketplace strategies can be copied  
✅ Charts display correctly  
✅ Portfolio calculations accurate  
✅ Mobile-responsive on all devices  
✅ Dark mode fully supported  
✅ No console errors  
✅ API calls use real endpoints  
✅ Proper error messages displayed  
✅ Loading states prevent multiple clicks  

---

## 📚 Resources & References

**API Documentation:**
- [YUKI_API_COMPLETION_SUMMARY.md](YUKI_API_COMPLETION_SUMMARY.md) - 20 endpoints explained

**Architecture:**
- [TRADING_INFRASTRUCTURE_COMPLETE.md](TRADING_INFRASTRUCTURE_COMPLETE.md) - Full trading system
- [TRADING_HUB_POSITIONING.md](TRADING_HUB_POSITIONING.md) - Feature positioning

**Components Reference:**
- Use existing Okedi components as patterns
- Recharts for charts (already used in dashboards)
- shadcn/ui components for consistency

---

## ⏱️ Time Estimate

- **Planning & Setup**: 1-2 hours
- **Core Components**: 4-6 hours
- **Tab Implementation**: 12-16 hours
- **API Integration**: 6-8 hours
- **Styling & Polish**: 4-6 hours
- **Testing & QA**: 4-6 hours

**Total: 31-44 hours (~4-5.5 days at 8 hours/day)**

---

## 🚀 Next Steps

1. **Review** this plan with the team
2. **Approve** timeline and approach
3. **Create** Yuki feature branch
4. **Start** with YukiDashboard.tsx skeleton
5. **Build** one tab at a time
6. **Test** each tab before moving next
7. **Deploy** to staging for user testing
8. **Launch** Phase 1C!

---

**Ready to build the trading powerhouse?** Let's go! 🎉
