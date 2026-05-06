## 🎨 PHASE 1C YUKI DASHBOARD - VISUAL FLOWS & MOCKUPS (UPDATED)

**Date:** February 3, 2026  
**Status:** Design Specification Ready (Updated with Custom Strategy Integration)  
**Purpose:** Visual reference for Phase 1C dashboard development, incorporating custom code strategy support, backtesting data access, DexScreener interfacing, and Telegram signal exposure for community bots.

This update builds on the original spec by adding flows and sections for power users integrating custom models/agents (e.g., via Freqtrade-compatible Python code). It includes backtesting endpoints, DexScreener data in watchlists/charts, and Telegram webhook/signal broadcasting. New flows emphasize seamless integration without disrupting no-code users.

---

## 📋 TABLE OF CONTENTS

1. [User Flow Diagrams](#user-flow-diagrams) *(Updated with 2 new flows)*
2. [Desktop Mockups (Full & Pro)](#desktop-mockups) *(Updated with Custom Strategy tab)*
3. [Tablet Mockups](#tablet-mockups) *(Minor updates for touch interactions)*
4. [Mobile Mockups](#mobile-mockups) *(Minor updates for swipe gestures)*
5. [Section Details](#section-details-expanded) *(Updated with Custom Strategies section)*
6. [Interaction Patterns](#interaction-patterns) *(Updated with code upload pattern)*
7. [Pro Mode Toggle Flow](#pro-mode-toggle-flow) *(Unchanged)*
8. [Color & Spacing Guide](#color--spacing-guide) *(Unchanged)*
9. [Component States](#component-states) *(Updated with backtesting states)*
10. [Data Flow Diagrams](#data-flow-diagrams) *(Updated with custom code & Telegram flows)*

---

## 🔄 USER FLOW DIAGRAMS

### Flow 1: First-Time Trader Entry *(Unchanged from original)*

```
┌─────────────────────────────────────────────────────────────┐
│                    ENTRY POINT DECISION                      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌──────────────┐     ┌──────────────┐
            │ OKEDI Active │     │  YUKI Active  │
            │  Dashboard   │     │  Dashboard   │
            └──────┬───────┘     └──────┬───────┘
                   │                    │
                   │                    ▼
                   │         ┌─────────────────────┐
                   │         │  See Balance Header │
                   │         │  See Quick Stats    │
                   │         │  See Opportunities │
                   │         └────────────┬────────┘
                   │                      │
                   │                      ▼
                   │         ┌──────────────────────┐
                   │         │ 1. View Arbitrage    │
                   │         │    "Execute" button  │
                   │         └────────────┬─────────┘
                   │                      │
                   │                      ▼
                   │         ┌──────────────────────┐
                   │         │ 2. Confirm Preview   │
                   │         │    (gas, slippage)   │
                   │         └────────────┬─────────┘
                   │                      │
                   │                      ▼
                   │         ┌──────────────────────┐
                   │         │ 3. Sign Transaction  │
                   │         │    (MetaMask)        │
                   │         └────────────┬─────────┘
                   │                      │
                   └──────────┬───────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  PROFIT EARNED! ✅   │
                    │  +$450 → Wallet     │
                    │  Strategy: Done     │
                    └─────────────────────┘
```

### Flow 2: Technical Analysis Trade *(Updated with DexScreener integration for pair discovery)*

```
┌──────────────────────────────┐
│  1. Open Yuki Dashboard      │
│     (scroll to Charts)       │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  2. Select Pair (ETH/USDC)   │
│     Select Timeframe (4h)    │
│     *New: Pull from DexScreener for DEX-specific pairs* │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  3. View Indicators          │
│     ├─ RSI < 30 (BUY signal) │
│     ├─ MACD crossover        │
│     ├─ MA confirmation       │
│     └─ *DexScreener liquidity/volume overlay* │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  4. Create Strategy          │
│     (or deploy existing)     │
│     Entry: RSI < 30          │
│     Exit: +5% profit         │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  5. Deploy Strategy          │
│     Status: ACTIVE ✅         │
│     Monitoring markets...    │
└────────────┬─────────────────┘
             │
             ▼ (Wait for signal)
             │
┌──────────────────────────────┐
│  6. Entry Signal Fired! 🔔    │
│     RSI = 28.5               │
│     [EXECUTE] [SKIP]         │
│     *New: Broadcast to Telegram channel* │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  7. Trade Executed ✅         │
│     Entry: $2,385            │
│     Position: 1 ETH          │
│     Target: $2,504           │
│     *New: Signal webhook called for bots* │
└─────────────────────────────┘
```

### Flow 3: Copy Marketplace Strategy *(Unchanged from original)*

```
┌─────────────────────────────────┐
│  1. Click Marketplace section   │
│     (from sidebar or scroll)    │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  2. Browse Strategies           │
│     Filter: Win Rate > 70%      │
│     Sort: By Monthly Profit     │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  3. Select "Binance-Kraken Arb" │
│     ├─ Rating: ⭐⭐⭐⭐⭐      │
│     ├─ Win Rate: 97%            │
│     ├─ Monthly: $8,450          │
│     └─ [COPY] button            │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  4. Customize (optional)        │
│     Position Size: 1 ETH        │
│     Risk Level: Low             │
│     DEX Preference: Uniswap V3  │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  5. Deploy Copied Strategy      │
│     Status: ACTIVE ✅            │
│     Creator: @TradeMaster       │
│     Your Share: 100%            │
│     Creator Share: 20%          │
└──────────────┬──────────────────┘
               │
               ▼ (Monitoring...)
               │
┌─────────────────────────────────┐
│  6. Strategy Trades Auto-Execute│
│     Trade #1: +$450 ✅          │
│     Trade #2: +$320 ✅          │
│     ...                         │
│     Creator earned: $154        │
│     (20% of $770)               │
└─────────────────────────────────┘
```

### *New* Flow 4: Custom Code Strategy Integration & Backtesting

```
┌──────────────────────────────┐
│  1. Open Yuki Dashboard      │
│     (scroll to Strategies)   │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  2. Click "Custom Code" tab  │
│     Upload .py file (Freqtrade format) │
│     Or paste code in editor  │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  3. Validate Code            │
│     Check for IStrategy class│
│     Sandboxed preview        │
│     [Edit] [Validate]        │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  4. Run Backtest             │
│     Select data: OHLCV API   │
│     Period: 1-12 months      │
│     Chains: ETH, Polygon     │
│     [Backtest] [Download Results] │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  5. Review Backtest Stats    │
│     Win Rate: 82%            │
│     Profit: +15.3%           │
│     Drawdown: -4.2%          │
│     Trades: 45               │
│     [Deploy] [Tweak Code]    │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  6. Deploy Custom Strategy   │
│     Status: ACTIVE ✅         │
│     Monitoring...            │
│     *Integrate DexScreener for pair discovery* │
└────────────┬─────────────────┘
             │
             ▼ (Signal fires)
             │
┌──────────────────────────────┐
│  7. Execute & Broadcast      │
│     Trade Executed ✅         │
│     Signal to Telegram webhook │
│     Bots/Communities trade   │
└─────────────────────────────┘
```

### *New* Flow 5: Telegram Signal & Community Bot Interaction

```
┌──────────────────────────────┐
│  1. Signal Generated         │
│     (From any strategy)      │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  2. Dashboard Alert          │
│     [View Signal]            │
│     Confidence: 87%          │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  3. Broadcast to Telegram    │
│     Channel: Post formatted signal │
│     Webhook: POST /signals   │
│     Payload: JSON details    │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  4. Community Bots Respond   │
│     Bot executes trade       │
│     Via Yuki API (optional)  │
│     Feedback loop: Log trades│
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  5. Dashboard Updates        │
│     Signal Status: Executed  │
│     Community Trades: 12     │
│     [View Logs]              │
└─────────────────────────────┘
```

---

## 🎨 DESKTOP MOCKUPS

### Desktop - Standard Mode (No Sidebar) *(Updated with DexScreener in Watchlist & Custom Strategies section)*

```
┌─────────────────────────────────────────────────────────────────────┐
│ [⚙️ Settings] [👤 Morio] [OKEDI | 📈 YUKI | 💰 AMARA]            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  YUKI DASHBOARD - Real-Time Trading Platform                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 💰 BALANCE HEADER (Sticky)                                      ││
│  │                                                                   ││
│  │  Trading Balance: $45,230.50      Today: +$2,450 (+5.7%)       ││
│  │  Win Rate: 73.5% | Active: 3 strategies | Risk: LOW            ││
│  │                                                                   ││
│  │  [📥 Deposit] [📤 Withdraw] [🔄 Transfer to AMARA]             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ⚡ LIVE OPPORTUNITIES (Always Visible)                         ││
│  │                                                                   ││
│  │  🔥 CRITICAL: ETH Arbitrage - Binance vs Kraken                 ││
│  │  ├─ Buy: $2,450 (Binance) → Sell: $2,501 (Kraken)             ││
│  │  ├─ Profit: +2.1% ($450) | Risk: Low | Confidence: 94%        ││
│  │  ├─ Time to execute: ~5 min | Gas: $6.50                       ││
│  │  └─ [⚡ EXECUTE NOW] [Dismiss] [View Details]                  ││
│  │                                                                   ││
│  │  💡 SOL DEX Swap - Uniswap vs Curve Spread                     ││
│  │  ├─ Uniswap: $189.50 (Best) | Curve: $189.25 (+0.13%)         ││
│  │  ├─ Volume available: 1,000+ SOL                               ││
│  │  └─ [Swap] [Details]                                            ││
│  │                                                                   ││
│  │  📊 2 more opportunities · [View All]                           ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ▼ WATCHLIST (Expanded by Default)                              ││
│  │                                                                   ││
│  │  ⭐ ETH/USDT      $2,450    ↑ +5.2%   Vol: $48B   [Trade] [📊]  ││
│  │  ├─ *DexScreener: Liquidity $120M | Trending Score: 85*        ││
│  │  ⭐ BTC/USDT      $48,200   ↑ +2.1%   Vol: $32B   [Trade] [📊]  ││
│  │  ├─ *DexScreener: Liquidity $80M | Trending Score: 92*         ││
│  │  ⭐ SOL/USDT      $189.50   ↓ -1.2%   Vol: $2.8B  [Trade] [📊]  ││
│  │  ├─ *DexScreener: Liquidity $45M | Trending Score: 78*         ││
│  │  ⭐ CELO/cUSD     $1.25     ↑ +0.5%   Vol: $45M   [Trade] [📊]  ││
│  │  ├─ *DexScreener: Liquidity $10M | Trending Score: 65*         ││
│  │                                                                   ││
│  │  [+ Add to Watchlist]                                            ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ▶ CEX MARKETS (Collapsed)                                       ││
│  │    [Click to expand] · 5 exchanges connected · Latest prices   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ▶ DEX SWAPS (Collapsed)                                         ││
│  │    [Click to expand] · Smart routing across 5-10 venues       ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ▶ ACTIVE STRATEGIES (Collapsed)                                 ││
│  │    [Click to expand] · 3 strategies running · 97% win rate     ││
│  │    *New: Custom Code tab for uploads*                           ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ▶ CHARTS & ANALYSIS (Collapsed)                                 ││
│  │    [Click to expand] · Candlestick + 50+ indicators           ││
│  │    *New: DexScreener overlay for DEX liquidity trends*         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ▶ PORTFOLIO (Collapsed)                                         ││
│  │    [Click to expand] · Total value: $45,230 · +5.7% today     ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ▶ MARKETPLACE (Collapsed)                                       ││
│  │    [Click to expand] · 500+ strategies · Browse & copy        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ▶ TELEGRAM SIGNALS (New Section, Collapsed)                     ││
│  │    [Click to expand] · Manage webhooks & channels              ││
│  │    Active: 2 channels | Signals sent: 45 today                 ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Desktop - Pro Mode (WITH Sidebar) *(Updated with new jumps for Custom Strategies & Telegram)*

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [⚙️ Settings] [👤 Morio] [OKEDI | 📈 YUKI | 💰 AMARA]                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────┬────────────────────────────────────────────────────┐   │
│  │ QUICK JUMP   │  YUKI DASHBOARD - Real-Time Trading             │   │
│  │ SIDEBAR      │                                                    │   │
│  │              │  💰 BALANCE HEADER (Sticky)                      │   │
│  │              │  ├─ Trading Balance: $45,230.50                  │   │
│  │ ⚡ Opps      │  ├─ Today: +$2,450 (+5.7%)                      │   │
│  │ [Jump]       │  ├─ Win Rate: 73.5%                             │   │
│  │              │  └─ [Deposit] [Withdraw] [Transfer]             │   │
│  │ ⭐ Watch     │                                                    │   │
│  │ [Jump]       │  ⚡ LIVE OPPORTUNITIES (Always Visible)         │   │
│  │              │  ├─ 🔥 ETH Arbitrage (Jump to details)          │   │
│  │ 🏦 CEX       │  ├─ 💡 SOL Swap Opportunity                    │   │
│  │ [Jump]       │  └─ [View All]                                   │   │
│  │              │                                                    │   │
│  │ 🔄 DEX       │  ▼ WATCHLIST (Expanded)                         │   │
│  │ [Jump]       │  ├─ ⭐ ETH/USDT $2,450 ↑+5.2%  [Trade]         │   │
│  │              │  ├─ ⭐ BTC/USDT $48,200 ↑+2.1% [Trade]         │   │
│  │ 🤖 Strat     │  ├─ ⭐ SOL/USDT $189.50 ↓-1.2% [Trade]        │   │
│  │ [Jump]       │  └─ [+ Add]                                      │   │
│  │              │                                                    │   │
│  │ 📊 Chart     │  ▶ CEX MARKETS [Click to expand]               │   │
│  │ [Jump]       │  ▶ DEX SWAPS [Click to expand]                 │   │
│  │              │  ▶ ACTIVE STRATEGIES [Click to expand]          │   │
│  │ 💼 Port      │  ▶ CHARTS & ANALYSIS [Click to expand]         │   │
│  │ [Jump]       │  ▶ PORTFOLIO [Click to expand]                 │   │
│  │              │  ▶ MARKETPLACE [Click to expand]                │   │
│  │ 🏆 Market    │  ▶ *TELEGRAM SIGNALS* [Click to expand]         │   │
│  │ [Jump]       │                                                    │   │
│  │              │                                                    │   │
│  │ *🛠️ Custom*  │                                                    │   │
│  │ *Strat [Jump]*│                                                    │   │
│  │              │                                                    │   │
│  │ ═══════════  │                                                    │   │
│  │              │                                                    │   │
│  │ ⚙️ Pro Mode  │                                                    │   │
│  │ Settings     │                                                    │   │
│  │              │                                                    │   │
│  │ ☀️ Light     │                                                    │   │
│  │ 🌙 Dark      │                                                    │   │
│  │              │                                                    │   │
│  │ 🔄 Reorder   │                                                    │   │
│  │ 🔔 Alerts    │                                                    │   │
│  │ ⌨️ Hotkeys   │                                                    │   │
│  │              │                                                    │   │
│  └──────────────┴────────────────────────────────────────────────────┘   │
│                                                                            │
│  KEY FEATURES:                                                             │
│  • Click any button to jump to section (smooth scroll)                    │
│  • Keyboard shortcuts: Ctrl+1 (Opps), Ctrl+2 (Watch), etc.              │
│  • *New: Ctrl+9 (Custom Strat), Ctrl+0 (Telegram Signals)*               │
│  • Sidebar collapses at 768px to maximize content space                  │
│  • Pro settings persist in localStorage                                   │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 TABLET MOCKUPS

### Tablet - Portrait Mode (768-1024px) *(Updated with DexScreener hints)*

```
┌─────────────────────────────────────────┐
│ [⚙️] [👤] [OKEDI|YUKI|AMARA]           │
├─────────────────────────────────────────┤
│                                           │
│ YUKI DASHBOARD                           │
│                                           │
│ 💰 BALANCE HEADER (Sticky)              │
│ ├─ $45,230.50                           │
│ ├─ Today: +$2,450 (+5.7%)              │
│ └─ [Deposit] [Withdraw]                 │
│                                           │
├─────────────────────────────────────────┤
│ ⚡ OPPORTUNITIES                        │
│                                           │
│ 🔥 ETH Arbitrage                       │
│ Buy: $2,450 → Sell: $2,501             │
│ Profit: +2.1% ($450)                   │
│ [⚡ EXECUTE]                            │
│                                           │
│ 💡 SOL Swap                             │
│ [Swap Details]                          │
│                                           │
├─────────────────────────────────────────┤
│ ▼ WATCHLIST                             │
│                                           │
│ ⭐ ETH/USDT  $2,450 ↑+5.2%             │
│ *DexScreener Liquidity: $120M*         │
│ ⭐ BTC/USDT  $48,200 ↑+2.1%           │
│ *DexScreener Liquidity: $80M*          │
│ ⭐ SOL/USDT  $189.50 ↓-1.2%           │
│ *DexScreener Liquidity: $45M*          │
│                                           │
│ [+ Add Token]                           │
│                                           │
├─────────────────────────────────────────┤
│ ▶ CEX MARKETS [expand]                 │
│                                           │
├─────────────────────────────────────────┤
│ ▶ DEX SWAPS [expand]                   │
│                                           │
├─────────────────────────────────────────┤
│ ▶ ACTIVE STRATEGIES [expand]           │
│ *Custom Code Upload Available*         │
│                                           │
├─────────────────────────────────────────┤
│ ▶ CHARTS & ANALYSIS [expand]           │
│                                           │
├─────────────────────────────────────────┤
│ ▶ PORTFOLIO [expand]                   │
│                                           │
├─────────────────────────────────────────┤
│ ▶ MARKETPLACE [expand]                 │
│                                           │
├─────────────────────────────────────────┤
│ ▶ TELEGRAM SIGNALS [expand]            │
│                                           │
└─────────────────────────────────────────┘

NOTE: Sidebar NOT shown on tablet in portrait
      Only available on desktop (1200px+) or tablet landscape
      *New: Touch to view DexScreener details in modal*
```

### Tablet - Landscape Mode (1024-1200px) with Collapsible Sidebar *(Updated with new icons)*

```
┌─────────────────┬──────────────────────────────────┐
│ [≡] ← COLLAPSE  │ [⚙️][👤][OKEDI|YUKI|AMARA]    │
├─────────────────┼──────────────────────────────────┤
│                 │                                   │
│ QUICK JUMP      │ YUKI DASHBOARD                   │
│ (Collapsed to   │                                   │
│  icons only)    │ 💰 BALANCE HEADER (Sticky)      │
│                 │ ├─ $45,230.50                    │
│ ⚡  ← Jump Opps │ ├─ Today: +$2,450 (+5.7%)      │
│ ⭐  ← Jump Watch│ └─ [Deposit] [Withdraw]         │
│ 🏦  ← Jump CEX │                                   │
│ 🔄  ← Jump DEX │ ⚡ OPPORTUNITIES                 │
│ 🤖  ← Jump Strat│ ├─ 🔥 ETH Arbitrage             │
│ 📊  ← Jump Chart│ │  [⚡ EXECUTE]                 │
│ 💼  ← Jump Port │ └─ 💡 SOL Swap                  │
│ 🏆  ← Jump Market                                  │
│ *🛠️  ← Jump Custom*                                │
│ *📡  ← Jump Telegram*                              │
│                 │ ▼ WATCHLIST                      │
│ [≡] ← EXPAND   │ ├─ ⭐ ETH/USDT $2,450          │
│                 │ ├─ ⭐ BTC/USDT $48,200         │
│                 │ └─ ⭐ SOL/USDT $189.50         │
│                 │                                   │
│                 │ ▶ CEX MARKETS [expand]          │
│                 │ ▶ DEX SWAPS [expand]            │
│                 │ ▶ ACTIVE STRATEGIES [expand]    │
│                 │ ▶ CHARTS & ANALYSIS [expand]    │
│                 │ ▶ PORTFOLIO [expand]            │
│                 │ ▶ MARKETPLACE [expand]          │
│                 │ ▶ *TELEGRAM SIGNALS* [expand]   │
│                 │                                   │
└─────────────────┴──────────────────────────────────┘

NOTE: Sidebar is collapsible to icons at 1024px
      Expands back on tap/click
      Icons show tooltips on hover
      *New: Custom/Telegram icons with tooltips*
```

---

## 📲 MOBILE MOCKUPS

### Mobile - Full Screen (< 768px) *(Updated with swipe for DexScreener trends & Telegram alerts)*

```
┌───────────────────────────────┐
│ [⚙️] [👤]                    │
│ [OKEDI | YUKI | AMARA]       │
├───────────────────────────────┤
│                                │
│ YUKI DASHBOARD                │
│                                │
│ 💰 BALANCE                    │
│ ┌─────────────────────────┐  │
│ │ $45,230.50              │  │
│ │ Today: +$2,450 (+5.7%) │  │
│ │ Win Rate: 73.5%        │  │
│ └─────────────────────────┘  │
│ [Deposit] [Withdraw]         │
│                                │
├───────────────────────────────┤
│ ⚡ OPPORTUNITIES             │
│ (3 visible, swipe for more)  │
│                                │
│ ┌─────────────────────────┐  │
│ │ 🔥 ETH Arbitrage        │  │
│ │                         │  │
│ │ Binance: $2,450        │  │
│ │ → Kraken: $2,501       │  │
│ │                         │  │
│ │ Profit: +2.1% ($450)   │  │
│ │ Risk: Low              │  │
│ │                         │  │
│ │ [⚡ EXECUTE] [Dismiss]  │  │
│ └─────────────────────────┘  │
│        → Swipe for more ←     │
│                                │
├───────────────────────────────┤
│ ▼ WATCHLIST                   │
│                                │
│ ⭐ ETH/USDT                  │
│    $2,450 ↑+5.2%            │
│    Vol: $48B                 │
│    *DexScreener: 85 Trend*  │
│    [Trade] [Remove]         │
│                                │
│ ⭐ BTC/USDT                  │
│    $48,200 ↑+2.1%           │
│    Vol: $32B                 │
│    *DexScreener: 92 Trend*  │
│    [Trade] [Remove]         │
│                                │
│ ⭐ SOL/USDT                  │
│    $189.50 ↓-1.2%           │
│    Vol: $2.8B                │
│    *DexScreener: 78 Trend*  │
│    [Trade] [Remove]         │
│                                │
│ [+ Add Token]                │
│                                │
├───────────────────────────────┤
│ ▶ CEX MARKETS                │
│    [5 exchanges connected]   │
│    [Tap to expand]           │
│                                │
├───────────────────────────────┤
│ ▶ DEX SWAPS                  │
│    [Smart routing active]    │
│    [Tap to expand]           │
│                                │
├───────────────────────────────┤
│ ▶ ACTIVE STRATEGIES          │
│    [3 running, 97% win]      │
│    *Custom Code Upload*      │
│    [Tap to expand]           │
│                                │
├───────────────────────────────┤
│ ▶ CHARTS & ANALYSIS          │
│    [50+ indicators]          │
│    [Tap to expand]           │
│                                │
├───────────────────────────────┤
│ ▶ PORTFOLIO                  │
│    [Total: $45,230]          │
│    [+5.7% today]             │
│    [Tap to expand]           │
│                                │
├───────────────────────────────┤
│ ▶ MARKETPLACE                │
│    [500+ strategies]         │
│    [Browse & copy]           │
│    [Tap to expand]           │
│                                │
├───────────────────────────────┤
│ ▶ TELEGRAM SIGNALS           │
│    [2 channels active]       │
│    [Manage Webhooks]         │
│    [Tap to expand]           │
│                                │
└───────────────────────────────┘

MOBILE FEATURES:
✅ Full-width scrollable content
✅ Sticky header (never scrolls away)
✅ Large touch targets (44px minimum)
✅ Horizontal swipe for opportunities carousel
✅ *New: Swipe left on watchlist items for DexScreener details*
✅ No sidebar (takes too much space)
✅ Collapse/expand with single tap
✅ Bottom sheet modal for details
✅ *New: Push notifications for Telegram signals*
✅ Dark mode optimized
```

---

## 🎯 SECTION DETAILS (EXPANDED)

### Section 1: Balance Header (ALWAYS STICKY) *(Unchanged)*

```
┌─────────────────────────────────────────────────┐
│                                                   │
│  💰 TRADING BALANCE                            │
│                                                   │
│  Balance: $45,230.50                           │
│                                                   │
│  Today's Performance:                          │
│  • Gain: +$2,450 (+5.7%)                      │
│  • Win Rate: 73.5% (18/23 trades)             │
│  • Active Strategies: 3 running               │
│  • Risk Level: LOW (within limits)            │
│                                                   │
│  Quick Actions:                                 │
│  [📥 Deposit] [📤 Withdraw] [🔄 Transfer]    │
│                                                   │
│  Status: REAL-TIME 🟢 Last update: 2 sec ago │
│                                                   │
└─────────────────────────────────────────────────┘

COMPONENT STATE CHANGES:
┌─ Default (idle)
│  └─ Balance: $45,230.50
│
├─ Updating prices (3s interval)
│  └─ Balance animates to new value
│     Example: $45,230.50 → $45,235.75
│     Animation: 200ms ease-in-out
│
├─ After trade (profit)
│  └─ Balance highlights in green
│     Today's Gain increments
│     Animation: Flash once, stay green for 2s
│
└─ After trade (loss)
   └─ Balance highlights in red
      Today's Gain decrements
      Animation: Flash once, stay red for 2s

MOBILE ADAPTATION:
- Same layout, narrower margin
- Two columns:
  Left: Balance amount
  Right: Today's gain % (color-coded)
```

### Section 2: Opportunities (ALWAYS VISIBLE) *(Unchanged)*

```
┌──────────────────────────────────────────────────────┐
│ ⚡ LIVE OPPORTUNITIES                             │
│                                                      │
│ Scanning 100+ venues every 10 seconds              │
│ Showing top 5 by profit, filtered by min 1%       │
│                                                      │
│ ┌────────────────────────────────────────────────┐ │
│ │ 🔥 CRITICAL: ETH Arbitrage (CEX Spread)       │ │
│ │                                                 │ │
│ │ Buy:  Binance  → ETH/USDT @ $2,450           │ │
│ │ Sell: Kraken   → ETH/USDT @ $2,501           │ │
│ │                                                 │ │
│ │ Expected Profit:  +2.1% = +$450               │ │
│ │ Execution Time:   ~5 minutes                  │ │
│ │ Gas Cost:         $6.50                        │ │
│ │ Net Profit:       $443.50                     │ │
│ │                                                 │ │
│ │ Risk Assessment:  LOW ✅                       │ │
│ │ Confidence:       94%                          │ │
│ │ Market Volatility: STABLE                      │ │
│ │                                                 │ │
│ │ [⚡ EXECUTE NOW] [View Details] [Dismiss]     │ │
│ └────────────────────────────────────────────────┘ │
│                                                      │
│ ┌────────────────────────────────────────────────┐ │
│ │ 💡 SOL DEX Swap (Protocol Spread)             │ │
│ │                                                 │ │
│ │ Uniswap V3:  SOL/USDC @ $189.50 (BEST)      │ │
│ │ Curve:       SOL/USDC @ $189.25 (+0.13%)    │ │
│ │ Balancer:    SOL/USDC @ $189.30              │ │
│ │                                                 │ │
│ │ Best Profit on 100 SOL:  $25.00               │ │
│ │ Available Volume: 1,000+ SOL                  │ │
│ │                                                 │ │
│ │ [Swap] [Details]                              │ │
│ └────────────────────────────────────────────────┘ │
│                                                      │
│ ┌────────────────────────────────────────────────┐ │
│ │ 📊 Flash Loan Opportunity                     │ │
│ │                                                 │ │
│ │ Cross-chain arbitrage detected:               │ │
│ │ USDC price difference: Ethereum vs Polygon    │ │
│ │                                                 │ │
│ │ Profit without capital:  $125.00              │ │
│ │ Fee (0.09%):             $0.75               │ │
│ │ Net Profit:              $124.25              │ │
│ │                                                 │ │
│ │ [⚡ EXECUTE WITH LOAN] [View Route]           │ │
│ └────────────────────────────────────────────────┘ │
│                                                      │
│ [🔄 Refresh Now] [View All 12]                    │
│                                                      │
└──────────────────────────────────────────────────────┘

AUTO-REFRESH BEHAVIOR:
├─ Initial load: Show 3-5 top opportunities
├─ Every 10 sec: Update with new scan results
├─ Animate: New opportunity slides in from top
├─ Highlight: New ones glow for 3 seconds
├─ Remove expired: Fade out when time expired
└─ Sound alert: (optional, user can disable)

INTERACTION FLOW:
1. User sees opportunity
2. Clicks [⚡ EXECUTE NOW]
3. Preview modal opens:
   ├─ Route details
   ├─ Gas estimate
   ├─ Slippage
   ├─ Expected profit
   └─ Buttons: [EXECUTE] [CANCEL]
4. Click [EXECUTE]
5. Wallet opens (MetaMask/WalletConnect)
6. User signs transaction
7. Transaction submitted
8. Status updates in real-time:
   └─ Pending → Confirmed → Complete
9. Profit credited to wallet
10. Opportunity marked as "Completed ✅"
```

### Section 3: Watchlist (EXPANDED BY DEFAULT) *(Updated with DexScreener data)*

```
┌────────────────────────────────────────────────────┐
│ ▼ WATCHLIST (Expanded by default)                 │
│                                                     │
│ Your saved cryptocurrency pairs with real-time   │
│ prices from 5+ exchanges. Add/remove easily.     │
│                                                     │
│ ┌──────────────────────────────────────────────┐ │
│ │                                               │ │
│ │ ⭐ ETH/USDT                                 │ │
│ │ ┌────────────────────────────────────────┐ │ │
│ │ │ Binance   $2,450    Coinbase  $2,451   │ │ │
│ │ │ Kraken    $2,448    Gate.io   $2,449   │ │ │
│ │ │ OKX       $2,450                       │ │ │
│ │ │                                        │ │ │
│ │ │ Avg Price: $2,449.60                  │ │ │
│ │ │ Range:     $2,448 - $2,451 (+0.13%)   │ │ │
│ │ │                                        │ │ │
│ │ │ 24h Change: +5.2%                     │ │ │
│ │ │ 24h Volume: $48.5B                    │ │ │
│ │ │ *DexScreener Liquidity: $120M*        │ │ │
│ │ │ *Trending Score: 85/100*              │ │ │
│ │ │                                        │ │ │
│ │ │ [Trade on Uniswap] [View Chart]       │ │ │
│ │ │ [Remove from Watchlist] [View Stats]  │ │ │
│ │ │                                        │ │ │
│ │ └────────────────────────────────────────┘ │ │
│ │                                               │ │
│ │ ⭐ BTC/USDT                                 │ │
│ │ ┌────────────────────────────────────────┐ │ │
│ │ │ Binance   $48,200   Coinbase  $48,205  │ │ │
│ │ │ Kraken    $48,195   Gate.io   $48,210  │ │ │
│ │ │ OKX       $48,200                      │ │ │
│ │ │                                        │ │ │
│ │ │ Avg Price: $48,202                    │ │ │
│ │ │ 24h Change: +2.1%                     │ │ │
│ │ │ 24h Volume: $32.8B                    │ │ │
│ │ │ *DexScreener Liquidity: $80M*         │ │ │
│ │ │ *Trending Score: 92/100*              │ │ │
│ │ │                                        │ │ │
│ │ │ [Trade on Uniswap] [View Chart]       │ │ │
│ │ └────────────────────────────────────────┘ │ │
│ │                                               │ │
│ │ ⭐ SOL/USDT                                 │ │
│ │ ┌────────────────────────────────────────┐ │ │
│ │ │ Binance   $189.50   Coinbase  $189.48  │ │ │
│ │ │ Kraken    $189.52   Gate.io   $189.50  │ │ │
│ │ │ OKX       $189.49                      │ │ │
│ │ │                                        │ │ │
│ │ │ Avg Price: $189.50                    │ │ │
│ │ │ 24h Change: -1.2%                     │ │ │
│ │ │ 24h Volume: $2.8B                     │ │ │
│ │ │ *DexScreener Liquidity: $45M*         │ │ │
│ │ │ *Trending Score: 78/100*              │ │ │
│ │ │                                        │ │ │
│ │ │ [Trade on Uniswap] [View Chart]       │ │ │
│ │ └────────────────────────────────────────┘ │ │
│ │                                               │ │
│ │ ⭐ CELO/cUSD                                │ │
│ │ ┌────────────────────────────────────────┐ │ │
│ │ │ Ubeswap   $1.25                        │ │ │
│ │ │                                        │ │ │
│ │ │ 24h Change: +0.5%                     │ │ │
│ │ │ 24h Volume: $45M                      │ │ │
│ │ │ *DexScreener Liquidity: $10M*         │ │ │
│ │ │ *Trending Score: 65/100*              │ │ │
│ │ │                                        │ │ │
│ │ │ [Trade on Ubeswap] [View Chart]       │ │ │
│ │ └────────────────────────────────────────┘ │ │
│ │                                               │ │
│ └──────────────────────────────────────────────┘ │
│                                                    │
│ [+ Add New Token] [Manage Watchlist]             │
│                                                    │
└────────────────────────────────────────────────────┘

REAL-TIME UPDATES:
├─ Price updates: Every 3 seconds
├─ Animation: Smooth number transitions
├─ Color coding:
│  ├─ Green: Price increased
│  ├─ Red: Price decreased
│  └─ Gray: No change
├─ Volume updates: Every 1 minute
├─ *New: DexScreener trends: Every 30 seconds via API*
└─ New opportunities: Added automatically

MOBILE VERSION:
└─ Horizontal scroll for watchlist items
   Show 1.5 items at a time
   Swipe left/right to see more
   *New: Long-press item for DexScreener modal*
```

### *New* Section 4: Custom Strategies (Collapsed by Default)

```
┌────────────────────────────────────────────────────┐
│ ▶ CUSTOM STRATEGIES                               │
│                                                     │
│ Upload or edit code-based strategies (Python/Freqtrade) │
│ Access backtesting data via API.                 │
│                                                     │
│ ┌──────────────────────────────────────────────┐ │
│ │                                               │ │
│ │ 📂 Upload Strategy File (.py)                 │ │
│ │ [Choose File] [Upload]                       │ │
│ │                                               │ │
│ │ Or: Code Editor                               │ │
│ │ ┌────────────────────────────────────────┐ │ │
│ │ │ class MyStrategy(IStrategy):            │ │ │
│ │ │     def populate_indicators(self, df): │ │ │
│ │ │         # Your code here             │ │ │
│ │ │     def populate_entry_trend(self, df):│ │ │
│ │ │         # Entry logic                │ │ │
│ │ │     ...                                │ │ │
│ │ └────────────────────────────────────────┘ │ │
│ │ [Validate Code] [Save]                        │ │
│ │                                               │ │
│ │ Backtesting Tools:                            │ │
│ │ ┌────────────────────────────────────────┐ │ │
│ │ │ Data Endpoint: /ohlcv/{pair}/{tf}     │ │ │
│ │ │ Period: [1 Month] [3 Months] [Custom]  │ │ │
│ │ │ Chains: [ETH] [Polygon] [All]          │ │ │
│ │ │ [Run Backtest] [Download CSV]          │ │ │
│ │ └────────────────────────────────────────┘ │ │
│ │                                               │ │
│ │ Deployed Custom Strategies:                   │ │
│ │ ├─ MyArbAgent.py - Active ✅                 │ │
│ │ │  Win Rate: 82% | Trades: 45               │ │
│ │ │  [Edit] [Deploy] [Backtest Again]         │ │
│ │ └─ MemeSniper.py - Paused                   │ │
│ │    [Resume] [Delete]                        │ │
│ │                                               │ │
│ └──────────────────────────────────────────────┘ │
│                                                    │
│ [API Docs] [Example Templates]                   │
│                                                    │
└────────────────────────────────────────────────────┘

REAL-TIME UPDATES:
├─ Code validation: Sandboxed exec (restricted libs)
├─ Backtest run: Server-side, results in 10-30s
├─ Animation: Progress bar during backtest
└─ Errors: Highlight invalid code lines

MOBILE VERSION:
└─ Code editor in modal (full-screen)
   Backtest buttons stacked
   No inline code view (tap to open)
```

### *New* Section 5: Telegram Signals (Collapsed by Default)

```
┌────────────────────────────────────────────────────┐
│ ▶ TELEGRAM SIGNALS                                │
│                                                     │
│ Manage signals for communities & bots.            │
│ Expose endpoints for automated trading.           │
│                                                     │
│ ┌──────────────────────────────────────────────┐ │
│ │                                               │ │
│ │ 📡 Active Channels:                          │ │
│ │ ├─ @YukiSignals - 1,200 subscribers         │ │
│ │ │  [Manage] [Broadcast Test]                 │ │
│ │ └─ @CommunityBots - 450 subscribers          │ │
│ │    [Manage] [Broadcast Test]                 │ │
│ │                                               │ │
│ │ Webhook Endpoint:                             │ │
│ │ ┌────────────────────────────────────────┐ │ │
│ │ │ POST https://yuki.api/signals            │ │ │
│ │ │ Payload Example: {action: "long", ...}   │ │ │
│ │ │ [Copy Endpoint] [Generate Key]            │ │ │
│ │ └────────────────────────────────────────┘ │ │
│ │                                               │ │
│ │ Recent Signals:                               │ │
│ │ ├─ ETH Long @ $2,450 - Fired 5 min ago      │ │
│ │ │  Confidence: 87% | Bots Executed: 8       │ │
│ │ │  [View Details] [Re-broadcast]           │ │
│ │ └─ SOL Swap - Fired 15 min ago               │ │
│ │    [View Details] [Re-broadcast]           │ │
│ │                                               │ │
│ │ Settings:                                     │ │
│ │ ├─ Auto-broadcast: On                       │ │
│ │ ├─ Include Charts: Yes                      │ │
│ │ └─ Rate Limit: 100/min                      │ │
│ │                                               │ │
│ └──────────────────────────────────────────────┘ │
│                                                    │
│ [+ Add Channel] [View Logs]                      │
│                                                    │
└────────────────────────────────────────────────────┘

REAL-TIME UPDATES:
├─ Signals: Pushed via WebSocket
├─ Bot executions: Logged in real-time
├─ Animation: New signal slides in
└─ Alerts: Push notification option

MOBILE VERSION:
└─ Stacked list for signals
   Webhook copy button prominent
   Channel management in modal
```

---

## 🔄 INTERACTION PATTERNS

### Pattern 1: Collapse/Expand Animations *(Unchanged)*

```
MOUSE CLICK ON "▶ CEX MARKETS"
│
├─ State: COLLAPSED
│  Display: "▶ CEX MARKETS [5 connected] [View details]"
│  Height: 60px
│
└─ CLICK
   │
   ├─ Animation: 300ms ease-in-out
   │  From: height: 60px, opacity: 0.8
   │  To:   height: 400px, opacity: 1
   │
   └─ State: EXPANDED
      Display: Full section content
      Height: Auto (400-600px depending on content)
      Icon: Change "▶" to "▼"
```

### Pattern 2: Real-Time Price Update *(Unchanged)*

```
Current Price: $2,450.00

[10 seconds later - New data from API]
│
├─ New Price: $2,450.75
│
├─ Animation Start:
│  └─ Duration: 400ms
│     Easing: cubic-bezier(0.4, 0, 0.2, 1)
│     From: $2,450.00
│     To:   $2,450.75
│
├─ Number Animation:
│  └─ Each digit transitions smoothly
│     Example: 2450.00 → 2450.25 → 2450.50 → 2450.75
│
├─ Background Color Flash:
│  ├─ Flash green: 200ms
│  ├─ Fade back to normal: 400ms
│  └─ Return to transparent: 1000ms
│
└─ Status: Complete
   New Price Display: $2,450.75
```

### Pattern 3: Section Auto-Scroll to Pro Sidebar Jump *(Unchanged)*

```
USER CLICKS "⭐ Watch" IN SIDEBAR
│
├─ Target: WATCHLIST section
├─ Current scroll position: Top of page
│
├─ Animation:
│  ├─ Duration: 600ms
│  ├─ Easing: ease-in-out
│  ├─ Scroll to: WATCHLIST position - 80px (header offset)
│  └─ Enable highlight border: 2s glow
│
└─ Result: Content scrolls smoothly to section
   Section gets highlighted with border
   Highlight fades after 2 seconds
```

### *New* Pattern 4: Custom Code Upload & Validation

```
USER CLICKS [Upload] IN CUSTOM STRATEGIES
│
├─ State: UPLOADING
│  Display: Progress spinner
│  Height: Fixed
│
└─ FILE SELECTED (.py)
   │
   ├─ Animation: 200ms fade-in editor
   │  From: opacity 0
   │  To:   opacity 1
   │
   └─ VALIDATE CLICKED
      │
      ├─ Sandboxed Exec (restricted)
      │  ├─ Success: Green checkmark
      │  │  Show preview functions
      │  │  [Backtest Now]
      │  ├─ Error: Red highlight
      │  │  Line numbers flagged
      │  │  Error message tooltip
      │  └─ Animation: Shake invalid code (100ms)
      │
      └─ State: READY
         Display: Backtest options unlocked
```

### *New* Pattern 5: Telegram Signal Broadcast

```
SIGNAL FIRED IN STRATEGY
│
├─ Auto-Broadcast: Enabled
│
└─ SEND TO CHANNEL/WEBHOOK
   │
   ├─ Animation: Signal card glows blue (300ms)
   │
   └─ CONFIRMATION
      ├─ Toast: "Signal sent to 1,200 users!"
      ├─ Log entry added with timestamp
      └─ Bot feedback: Real-time count increments
```

---

## 🎯 PRO MODE TOGGLE FLOW *(Unchanged, but note new keyboard shortcuts in desktop mockup)*

```
USER FIRST VISITS DESKTOP DASHBOARD (1200px+)
│
├─ Default: NO sidebar shown
│  Display: Standard scroll layout
│  Button visible: "Enable Pro Mode" (subtle)
│
└─ USER CLICKS "⚙️ Settings" or "[Pro Mode] toggle"
   │
   ├─ Modal/Dialog Opens:
   │  ├─ Title: "Enable Pro Mode?"
   │  ├─ Description: "Unlock quick-jump sidebar for power users"
   │  ├─ Benefits:
   │  │  ├─ Jump to any section instantly
   │  │  ├─ Keyboard shortcuts (Ctrl+1-8)
   │  │  ├─ Persistent navigation
   │  │  └─ Theme & personalization options
   │  │
   │  └─ Buttons: [Enable] [Cancel]
   │
   └─ USER CLICKS [Enable]
      │
      ├─ Action: localStorage.setItem('proMode', true)
      │
      ├─ UI Update:
      │  ├─ Sidebar slides in from left: 300ms animation
      │  ├─ Main content narrows to right
      │  ├─ Layout reflow smooth transition
      │  └─ Pro settings menu appears in sidebar
      │
      ├─ Features Now Active:
      │  ├─ ⚡ Jump button for Opportunities
      │  ├─ ⭐ Jump button for Watchlist
      │  ├─ 🏦 Jump button for CEX Markets
      │  ├─ 🔄 Jump button for DEX Swaps
      │  ├─ 🤖 Jump button for Strategies
      │  ├─ 📊 Jump button for Charts
      │  ├─ 💼 Jump button for Portfolio
      │  ├─ 🏆 Jump button for Marketplace
      │  ├─ ⌨️ Keyboard shortcuts active
      │  └─ Theme toggle (☀️/🌙)
      │
      └─ Sidebar Appears:
         ├─ Width: 140px (fixed)
         ├─ Position: Fixed left
         ├─ Z-index: Below header
         ├─ Background: Contrasting color
         ├─ Responsive: Collapses to icons at 1024px
         └─ Animation: Slide in 300ms ease-out

DISABLING PRO MODE:
└─ User clicks sidebar collapse or "Disable Pro Mode"
   ├─ Sidebar slides out: 300ms animation
   ├─ Main content expands: 300ms animation
   ├─ Setting saved: localStorage updated
   └─ Keyboard shortcuts disabled
```

---

## 🎨 COLOR & SPACING GUIDE *(Unchanged)*

### Color Palette

```
PRIMARY COLORS:
├─ Brand Blue:     #1e40af (Binance-inspired)
├─ Success Green:  #16a34a (Profit/positive)
├─ Error Red:      #dc2626 (Loss/negative)
├─ Warning Orange: #ea580c (Important alerts)
└─ Info Cyan:      #0891b2 (Information)

NEUTRAL COLORS:
├─ Dark BG:        #1a1a2e (Dark mode primary)
├─ Dark Surface:   #16213e (Dark mode cards)
├─ Light BG:       #f5f5f5 (Light mode primary)
├─ Light Surface:  #ffffff (Light mode cards)
├─ Text Dark:      #1f2937 (Light mode text)
└─ Text Light:     #f3f4f6 (Dark mode text)

ACCENT COLORS:
├─ Purple:         #8b5cf6 (Strategies/Advanced)
├─ Pink:           #ec4899 (Marketplace/Social)
├─ Amber:          #f59e0b (Warnings)
└─ Emerald:        #10b981 (Healthy/Good)
```

### Spacing System

```
BASE UNIT: 4px

Scale:
├─ xs: 4px    (inner padding on small elements)
├─ sm: 8px    (padding on elements)
├─ md: 12px   (standard padding)
├─ lg: 16px   (section padding)
├─ xl: 24px   (section margins)
├─ 2xl: 32px  (large spacing)
├─ 3xl: 48px  (header/footer spacing)
└─ 4xl: 64px  (page margins)

APPLICATION:
├─ Button padding:        8px 12px (sm/md)
├─ Card padding:          16px (lg)
├─ Section margin:        24px (xl)
├─ Header height:         64px
├─ Sidebar width:         140px (fixed)
└─ Content max-width:     1200px
```

### Typography

```
FONT STACK: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI"

SIZES & WEIGHTS:
├─ H1: 32px, 700, line-height 1.2
├─ H2: 24px, 700, line-height 1.3
├─ H3: 20px, 600, line-height 1.4
├─ Body: 14px, 400, line-height 1.5
├─ Small: 12px, 400, line-height 1.4
└─ Tiny:  11px, 500, line-height 1.3

USAGE:
├─ Section titles:   H2
├─ Card titles:      H3
├─ Main text:        Body
├─ Labels:           Small
├─ Hints/helpers:    Tiny
└─ Numbers/prices:   Monospace (JetBrains Mono)
```

---

## 🎭 COMPONENT STATES

### Opportunity Card States *(Unchanged)*

```
1. DEFAULT (Neutral)
   ┌─────────────────────────┐
   │ 📊 SOL DEX Swap         │
   │ $189.50 → $189.52       │
   │ [Details]               │
   └─────────────────────────┘
   
2. HOVER (Slightly Highlighted)
   ┌─────────────────────────┐
   │ 📊 SOL DEX Swap         │  ← Shadow increases
   │ $189.50 → $189.52       │  ← Background lightens
   │ [Details] [Swap Now]    │  ← Additional action appears
   └─────────────────────────┘
   
3. ACTIVE (Being Executed)
   ┌─────────────────────────┐
   │ 📊 SOL DEX Swap         │
   │ $189.50 → $189.52       │
   │ ⏳ Executing...         │  ← Loading spinner
   │ [Cancel]                │  ← Only cancel available
   └─────────────────────────┘
   
4. COMPLETED (Success)
   ┌─────────────────────────┐
   │ ✅ SOL DEX Swap         │
   │ $189.50 → $189.52       │
   │ +$25.50 profit gained   │  ← Green text
   │ [Transaction] [Close]   │
   └─────────────────────────┘
   
5. EXPIRED (Grayed Out)
   ┌─────────────────────────┐
   │ 📊 SOL DEX Swap (EXPIRED)
   │ $189.50 → $189.52       │
   │ ⏰ Opportunity expired   │
   │ [Dismiss]               │
   └─────────────────────────┘
```

### Section Collapse/Expand States *(Unchanged)*

```
COLLAPSED STATE:
┌─────────────────────────────────┐
│ ▶ CEX MARKETS                   │
│   5 exchanges connected         │
│   [View details] [Collapse]     │
└─────────────────────────────────┘

HOVER COLLAPSED:
┌─────────────────────────────────┐
│ ▶ CEX MARKETS                   │
│   5 exchanges connected         │
│   [View details] [Collapse] ← Underline
│   ↑ Slight elevation            │
└─────────────────────────────────┘

EXPANDING ANIMATION (300ms):
Frame 1 (0ms):    height: 60px
Frame 2 (100ms):  height: 150px
Frame 3 (200ms):  height: 300px
Frame 4 (300ms):  height: 400px (end)

EXPANDED STATE:
┌─────────────────────────────────────────┐
│ ▼ CEX MARKETS                           │
│   5 exchanges connected                 │
│                                         │
│   BINANCE                              │
│   ├─ Balance: 5.3 BTC                  │
│   ├─ Available: 5.2 BTC                │
│   └─ [Manage] [View History]           │
│                                         │
│   KRAKEN                               │
│   ├─ Balance: 3.1 ETH                  │
│   ├─ Available: 3.0 ETH                │
│   └─ [Manage] [View History]           │
│                                         │
│   [+ Add Exchange] [Refresh]            │
│                                         │
└─────────────────────────────────────────┘

COLLAPSING ANIMATION (300ms):
Frame 1 (0ms):    height: 400px
Frame 2 (100ms):  height: 250px
Frame 3 (200ms):  height: 120px
Frame 4 (300ms):  height: 60px (end)
```

### *New* Backtesting States (in Custom Strategies)

```
1. IDLE (Ready)
   ┌─────────────────────────┐
   │ Backtest Tools          │
   │ [Run Backtest]          │
   └─────────────────────────┘
   
2. RUNNING (Progress)
   ┌─────────────────────────┐
   │ Backtest Tools          │
   │ ⏳ Processing... 45%    │  ← Progress bar
   │ [Cancel]                │
   └─────────────────────────┘
   
3. COMPLETED (Success)
   ┌─────────────────────────┐
   │ ✅ Backtest Complete     │
   │ Win Rate: 82%           │  ← Green stats
   │ [View Details] [Download] │
   └─────────────────────────┘
   
4. ERROR (Failed)
   ┌─────────────────────────┐
   │ ❌ Backtest Failed       │
   │ Invalid data range      │  ← Red text
   │ [Retry] [Edit Code]     │
   └─────────────────────────┘
```

### *New* Signal Card States (in Telegram Signals)

```
1. DEFAULT (Pending)
   ┌─────────────────────────┐
   │ ETH Long @ $2,450       │
   │ Confidence: 87%         │
   │ [Broadcast]             │
   └─────────────────────────┘
   
2. SENT (Success)
   ┌─────────────────────────┐
   │ ✅ ETH Long Sent         │
   │ To 1,200 users          │  ← Green check
   │ Bots: 8 executed        │
   │ [View Logs]             │
   └─────────────────────────┘
   
3. ERROR (Failed)
   ┌─────────────────────────┐
   │ ❌ Send Failed           │
   │ Rate limit exceeded     │  ← Red warning
   │ [Retry] [Dismiss]       │
   └─────────────────────────┘
```

---

## 📊 DATA FLOW DIAGRAMS

### Real-Time Price Update Flow *(Updated with DexScreener API call)*

```
Backend Service (ccxtService)
          ↓
   Polls exchanges (10s interval)
          ↓
*New: Polls DexScreener for liquidity/trends*
          ↓
  Calculates aggregated prices + scores
          ↓
   Sends WebSocket update
          ↓
React Component Receives Update
          ↓
   State: prices = newPrices
          ↓
   Triggers animation (200ms)
          ↓
   Renders new prices + DexScreener overlays
          ↓
   Applies green/red color
          ↓
   Resets color after 1s
          ↓
Display: Updated price with animation
```

### Strategy Execution Flow *(Updated with Telegram broadcast)*

```
1. Strategy Conditions Checked (Every market update)
   Entry: RSI < 30?
   Exit: Position open?
   Amount: Ready?

2. All conditions met → Signal Generated
   │
   ├─ Create signal object with:
   │  ├─ strategyId
   │  ├─ timestamp
   │  ├─ confidence
   │  ├─ expectedPrice
   │  └─ routingPreference
   │
   └─ Store in database

3. UI Notified
   │
   ├─ Show alert: "Entry signal fired!"
   ├─ Display details modal
   ├─ Options:
   │  ├─ [EXECUTE NOW] - Execute immediately
   │  ├─ [REVIEW] - Show preview
   │  └─ [SKIP] - Dismiss for this signal
   │
   └─ Wait for user action

4A. User Clicks [EXECUTE NOW]
    │
    ├─ Call API: POST /api/yuki/strategies/:id/execute
    ├─ Show preview modal
    │  ├─ Route details
    │  ├─ Gas estimate
    │  ├─ Slippage
    │  └─ Profit estimate
    │
    ├─ User confirms
    ├─ Smart contract executed
    └─ Transaction confirmed
       └─ Profit transferred
          └─ Strategy marked as completed
             *New: Broadcast signal to Telegram channel/webhook*

4B. User Clicks [SKIP]
    │
    ├─ Signal dismissed
    ├─ Strategy continues monitoring
    └─ Wait for next signal
```

### Marketplace Strategy Copy Flow *(Unchanged)*

```
User sees strategy in marketplace
          ↓
Clicks [COPY STRATEGY]
          ↓
Modal opens with options:
├─ Position Size: [_______] (editable)
├─ Risk Level: [Low / Medium / High] (editable)
├─ DEX Preference: [Auto / Uniswap / Curve] (editable)
└─ Buttons: [COPY] [CANCEL]
          ↓
User customizes (optional)
          ↓
Clicks [COPY]
          ↓
API Call: POST /api/yuki/marketplace/:id/copy
  Body: {
    newSettings: { position, risk, dex },
    autoStartTracking: true
  }
          ↓
Backend Creates Strategy Copy
├─ Original strategy ID: linked
├─ New settings: applied
├─ Profit tracking: enabled (20% to creator)
└─ Status: READY TO DEPLOY
          ↓
UI Updates
├─ Toast: "Strategy copied!"
├─ New strategy in "My Strategies"
├─ Options: [REVIEW] [DEPLOY] [EDIT]
└─ Creator gets notification
          ↓
User clicks [DEPLOY]
          ↓
Strategy Status: ACTIVE
Monitor conditions continuously
          ↓
Signal fires → Auto-execute or notify user
          ↓
Trade executed → Profit split:
├─ 80% to user
├─ 20% to creator (automatic payout)
└─ Transaction logged
```

### *New* Custom Code Backtesting Flow

```
User uploads .py or edits code
          ↓
Clicks [Validate]
          ↓
Backend: Sandboxed exec (limited globals: pandas, ta-lib, etc.)
  If error: Return line errors
  If success: Unlock backtest
          ↓
User selects period/chain
          ↓
API Call: POST /api/yuki/backtest
  Body: {
    code: strategyCode,
    data: {pair, timeframe, from, to}
  }
          ↓
Backend Runs Freqtrade-like backtest
├─ Load OHLCV from internal DB (CCXT + DexScreener cached)
├─ Simulate trades
├─ Calculate stats: win rate, profit, drawdown
└─ Return JSON results + CSV option
          ↓
UI Updates
├─ Display stats in modal
├─ Charts: Profit curve, trade list
├─ Options: [Deploy] [Export] [Tweak]
└─ Animation: Progress during run (10-30s)
```

### *New* Telegram Signal Broadcast Flow

```
Signal generated (from strategy)
          ↓
Check settings: Auto-broadcast?
          ↓
API Call: POST /api/yuki/signals/broadcast
  Body: {
    channel: "@YukiSignals",
    webhook: true,
    payload: {action: "long", pair: "ETH/USDC", ...}
  }
          ↓
Backend Handles
├─ Telegram Bot API: Post formatted message + chart
├─ Webhook: POST to /signals with JSON
├─ Log: Store sent time, recipients
└─ Handle responses (e.g., bot executions via callback)
          ↓
UI Updates
├─ Add to recent signals list
├─ Real-time counter: Bots executed
├─ Toast: "Signal broadcasted!"
└─ Error: Retry button if failed
```

---

## 📱 RESPONSIVE BREAKPOINTS *(Updated with notes for new sections)*

```
MOBILE
< 640px
├─ Single column layout
├─ No sidebar
├─ Full-width content
├─ Stacked buttons
├─ Large touch targets (44px)
├─ Horizontal scroll for opportunities
└─ *New: Custom code editor in full-screen modal; Telegram in stacked list*

TABLET
640px - 1024px
├─ Single column OR
├─ Collapsible sidebar (icons only)
├─ Expanded on landscape
├─ Touch-friendly
└─ *New: DexScreener overlays as tooltips on touch*

DESKTOP
1024px - 1200px
├─ Sidebar icons only (collapsed by default)
├─ Can expand sidebar
├─ Optimal reading width
└─ *New: Backtest results in split-view (code left, stats right)*

DESKTOP PRO
1200px+
├─ Full sidebar visible
├─ Optimized for power users
├─ All features visible
├─ Multi-column layout
└─ *New: Telegram logs in real-time table*
```

---

## 🔐 SECURITY & SAFETY STATES *(Updated with custom code specifics)*

```
API Key Security:
├─ Encrypted in storage
├─ Never shown to user (after initial)
├─ Read-only access enforced
├─ No withdrawal capability
├─ IP whitelist enforced

Transaction Confirmation:
├─ Preview always shown
├─ User must sign with wallet
├─ Gas estimation displayed
├─ Slippage protection enabled
├─ Profit estimate shown
└─ Final confirmation required

*New: Custom Code Security:*
├─ Sandboxed execution (no os/sys access)
├─ Limited libs (pandas, numpy, ta-lib only)
├─ Timeout: 30s per backtest
├─ Rate limit: 5 backtests/min per user
└─ No external API calls in code

*New: Telegram Security:*
├─ API keys for channels encrypted
├─ Webhook auth: Bearer token required
├─ Rate limits on broadcasts
└─ Logs anonymized (no user data)

Error States:
├─ Insufficient balance → Show available
├─ Slippage too high → Reject or warn
├─ Gas price spiking → Notify user
├─ Network congestion → Show alert
├─ Exchange unavailable → Show fallback
├─ *New: Code validation fail → Highlight errors*
└─ *New: Signal broadcast fail → Retry queue*
```

---

## ✅ MOCKUP COMPLETION CHECKLIST *(Updated)*

- ✅ Desktop Standard (No sidebar)
- ✅ Desktop Pro Mode (With sidebar)
- ✅ Tablet Portrait
- ✅ Tablet Landscape
- ✅ Mobile Portrait
- ✅ User Flow Diagrams (5 flows, 2 new)
- ✅ Section Details (5 sections expanded, 2 new)
- ✅ Interaction Patterns (5 patterns, 2 new)
- ✅ Pro Mode Toggle Flow
- ✅ Color & Spacing Guide
- ✅ Component States (4 examples, 2 new)
- ✅ Data Flow Diagrams (5 flows, 2 new)
- ✅ Responsive Breakpoints
- ✅ Security States (updated)

---

## 🎯 DEVELOPMENT ROADMAP *(Updated with new phases)*

### Phase 1: Foundation (Day 1) *(Unchanged)*

```
Build:
├─ YukiDashboard.tsx (main container)
├─ BalanceHeader.tsx (sticky)
├─ CollapsibleSection.tsx (reusable)
└─ Basic styling + Tailwind

Test:
├─ Layout responsiveness
├─ Sticky header behavior
└─ Collapse/expand functionality
```

### Phase 2: Sections (Days 2-4) *(Updated)*

```
Build:
├─ OpportunitiesSection.tsx
├─ WatchlistSection.tsx (with DexScreener API)
├─ CEXMarketsSection.tsx
├─ DEXSwapSection.tsx
├─ StrategiesSection.tsx
├─ ChartsSection.tsx (with DexScreener overlays)
├─ PortfolioSection.tsx
├─ *CustomStrategiesSection.tsx*
├─ *TelegramSignalsSection.tsx*

Wire:
├─ Connect API endpoints
├─ Real data flow
└─ Real-time updates
```

### Phase 3: Pro Mode (Day 5) *(Unchanged)*

```
Build:
├─ ProSidebar.tsx
├─ Jump buttons logic
├─ Keyboard shortcuts
├─ Theme toggle
└─ Settings persistence

Polish:
├─ Mobile optimization
├─ Dark mode finalization
├─ Performance tuning
└─ Error handling
```

### *New* Phase 4: Custom Integrations (Days 6-7)

```
Build:
├─ CodeEditor.tsx (with validation)
├─ BacktestRunner.tsx (API integration)
├─ SignalBroadcaster.tsx (Telegram Bot API + webhook)
└─ DexScreenerFetcher.tsx (REST/WS polling)

Test:
├─ Sandbox security
├─ Backtest accuracy
├─ Signal delivery (mock bots)
└─ Rate limiting
```

---

## 📞 DESIGN NOTES FOR DEVELOPERS *(Updated)*

1. **Sticky Header Offset:** Account for 64px header height in scroll calculations
2. **Mobile Touch:** All interactive elements must be 44px+ in height
3. **Color Contrast:** Ensure WCAG AA compliance for all text
4. **Animation Performance:** Use transform/opacity only (not height/width)
5. **Real-time Updates:** Debounce price updates to 200ms intervals
6. **Keyboard Accessibility:** All buttons must be keyboard navigable
7. **Dark Mode:** Automatically enabled based on system preference
8. **Loading States:** Show skeleton loaders, not spinners where possible
9. **New: DexScreener Integration:** Use official REST API; fallback to cached data if rate-limited
10. **New: Custom Code:** Implement with Monaco Editor for syntax highlighting; server-side exec via Docker sandbox
11. **New: Telegram:** Use Telegram Bot API for channels; secure webhooks with JWT
12. **Performance:** Lazy-load code editor & backtest charts

---

**Design Specification Complete ✅**  
**Ready for Development ✅**  
**Generated:** February 3, 2026