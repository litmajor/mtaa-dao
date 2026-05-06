# Three-Profile Dashboard Architecture
**Date:** February 2, 2026  
**Status:** Production Ready  
**System:** OKEDI + YUKI + AMARA with Persistent Global Navigation

---

## 🎯 Core Concept

**Three fixed profiles** (no additions), each with distinct purpose:
- **OKEDI** - Community/Personal wallet (Send, Receive, Transfer, Deposit, Withdraw)
- **YUKI** - Trading/Active platform (Real-time opportunities, profit extraction)
- **AMARA** - Wealth/Long-term holdings (Staking, yields, wealth accumulation)

**Persistent Global Navigation** that stays visible across all profiles:
- Settings (⚙️) - Global app preferences
- Morio (👤) - Account dropdown  
- Profile Switcher - OKEDI | YUKI | AMARA (3 buttons, instant switch)

---

## 📋 System Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│         GLOBAL PERSISTENT NAVIGATION (Always Visible)          │
│  [Settings ⚙️] [Morio 👤] [OKEDI|📈 YUKI|💰 AMARA]        │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│                  PROFILE CONTENT (Switches Instantly)          │
│                                                                 │
│  Current Profile Context:                                     │
│  ├─ Balance Card (Profile-specific, Sticky)                  │
│  ├─ Quick Stats                                              │
│  ├─ Main Features (Collapsible sections)                    │
│  └─ Additional Options (Expandable as needed)               │
│                                                                 │
│  (All profiles use same navigation pattern, different content) │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

CRITICAL DESIGN RULES:
✅ Settings/Morio never reload
✅ Profile switcher always visible (3 buttons fixed)
✅ Clicking profile instantly swaps content (no page reload)
✅ Each profile remembers last tab/section state
✅ Global nav NEVER changes height/layout
✅ Mobile: responsive nav bar, profile buttons stack vertically
✅ Desktop: horizontal profile switcher
```

---

## OKEDI Profile (Community/Personal Wallet)

### Features Overview

**Core Wallet Functions:**
- 📤 Send (DAO/Treasury, User/Username, Address with fine-grained context)
- 📥 Receive (QR code, address history)
- 🔄 Transfer (to YUKI for trading, to AMARA for holding)
- 💰 Deposit/Withdraw (external sources)

**Community Features:**
- 🏛️ Governance (DAOs, proposals, voting)
- 📋 Escrow (transaction management)
- 🔗 Payment Links (generate payment requests)
- 👥 Referrals (track referral earnings)
- 🎁 Airdrops (receive & claim airdrops)

### Visual Layout

```
┌────────────────────────────────────────────────────────────────┐
│ [Settings] [👤 Morio] [OKEDI | 📈 YUKI | 💰 AMARA]          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ OKEDI Community Dashboard                                      │
│ Available Balance: $12,450.75                                 │
│ Trust Score: 95/100 | Active DAOs: 5 | Referral Earnings: +$245 YTD
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 📤 SEND FUNDS (Expandable Section)                            │
│ ├─ Send To: [DAO/Treasury ▼ | User | Address]               │
│ │                                                              │
│ │ DAO/Treasury Selected:                                     │
│ │ ├─ [List of DAOs you're member of]                        │
│ │ ├─ [Verification required before send]                    │
│ │ ├─ [Auto-fill treasury wallet]                            │
│ │ └─ Amount: [_______] [Max]  [Send]                        │
│ │                                                              │
│ │ User/Username Selected:                                    │
│ │ ├─ [Search/autocomplete users]                            │
│ │ ├─ [Show recipient's public address]                      │
│ │ ├─ [Optional message field]                               │
│ │ └─ Amount: [_______] [Max]  [Send]                        │
│ │                                                              │
│ │ SOME ADDRESS Selected:                                     │
│ │ ├─ [Paste/scan address]                                   │
│ │ ├─ [Verification warning if new]                          │
│ │ ├─ [Address history if used before]                       │
│ │ ├─ [Confirm address match]                                │
│ │ └─ Amount: [_______] [Max]  [Send]                        │
│ │                                                              │
│ └─ Fine-Grained Context: Shows exactly what you're doing!    │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 📥 RECEIVE FUNDS (Expandable Section)                         │
│ ├─ Your OKEDI Address: 0x1234...5678                        │
│ ├─ [Copy] [QR Code] [Share]                                │
│ └─ Recent Deposits:                                          │
│    ├─ $500 from @alice (2 days ago)                         │
│    └─ $200 from DAO Treasury (1 week ago)                   │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 🔄 TRANSFER (Internal) (Expandable Section)                   │
│ ├─ Transfer to YUKI (for trading):                          │
│ │  Current OKEDI: $12,450.75                                │
│ │  Current YUKI: $8,200                                     │
│ │  Amount: [_______] [Max]  [Transfer to YUKI]             │
│ │                                                              │
│ └─ Transfer to AMARA (for long-term hold):                  │
│    Current AMARA: $45,000                                   │
│    Amount: [_______] [Max]  [Transfer to AMARA]            │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 💰 DEPOSIT & WITHDRAW (Expandable Section)                    │
│ ├─ [Deposit Funds] (Bank / Card / Crypto)                   │
│ └─ [Withdraw Funds] (Bank / Wallet)                         │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 🏛️ MY DAOS (Expandable Section - Governance Focus)           │
│ ├─ [List of DAOs with voting power]                         │
│ └─ [Governance interface - not trading-related]             │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 📋 ACTIVE PROPOSALS (Expandable Section - Governance)         │
│ └─ [Proposals you can vote on]                              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Key Design Principles for OKEDI

1. **Send with Fine-Grained Context**
   - DAO/Treasury: Select from member DAOs, auto-fill treasury wallet
   - User/Username: Search users, show public address, optional message
   - Address: Paste/scan, warn if unfamiliar, show history if used
   - Each option provides appropriate verification/safety features

2. **Always Show Both Balances**
   - When in OKEDI, show: "Current OKEDI: $X | Current YUKI: $Y | Current AMARA: $Z"
   - Users always know where their money is
   - Clear visibility for transfers between profiles

3. **Governance Features Visible**
   - DAOs, proposals, escrow accessible from same dashboard
   - Community context always present
   - No trading/market data on this profile

4. **No Chart/Market Data**
   - OKEDI is about managing personal funds + governance
   - Trading data belongs in YUKI profile

---

## YUKI Profile - Mtaa Protocol (Trading/Active Platform)

### Mtaa Protocol Overview

**A complete, professional trading protocol featuring:**

**Trading Fundamentals:**
- 💼 Balances (Per exchange + DEX totals)
- 📊 Performance Metrics (Win Rate, ROI, Avg Trade Size)
- 🏦 Connected Exchanges (CEX: Binance, Kraken, Coinbase, etc.)
- 🔄 Connected DEXes (Uniswap, Curve, SushiSwap, etc.)

**Position Management:**
- 💼 My Positions (view all open positions across CEX/DEX)
- 📊 Unrealized P&L per position

**Market Discovery & Monitoring:**
- 📈 Browse Markets (per exchange, 1000+ pairs, view charts, stats)
- ⭐ Watchlist (curated monitored pairs)
- ⚡ Live Opportunities (real-time profit detection)

**Execution & Management:**
- 💳 CEX Markets (order placement, position management)
- 🔀 Swap & Bridge (multi-hop DEX swaps, smart order router, cross-chain)
- 🤖 Active Strategies (bots/automated trading)

**Monitoring & Insights:**
- 📊 Analytics (portfolio P&L, trade statistics, exchange performance)
- 🔔 Alerts & Signals (price alerts, signal notifications)

**Profit Management:**
- 💸 Transfer Profits (to OKEDI for spending, to AMARA for holding)

### Visual Layout

```
┌────────────────────────────────────────────────────────────────┐
│ [Settings] [👤 Morio] [OKEDI | 📈 YUKI | 💰 AMARA]          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📈 Mtaa Protocol - Trading Dashboard                          │
│ Trading Balance: $8,200 | Available: $8,200 | On Order: $0   │
│ Win Rate: 78% | Total ROI: +24.5% | Avg Trade Size: $450    │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 💼 MY POSITIONS (Cross-Exchange & DEX Overview)               │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ CEX Positions:                                             ││
│ │ ├─ Binance                                                ││
│ │ │  ├─ Long: 0.5 BTC @ $48,200 | Unrealized: +$1,200     ││
│ │ │  ├─ Long: 10 ETH @ $2,450 | Unrealized: +$850         ││
│ │ │  ├─ Short: 100 ADA @ $0.95 | Unrealized: -$120        ││
│ │ │  ├─ Available Balance: $2,500                          ││
│ │ │  └─ [View Details] [Add Position] [Close Position]   ││
│ │ │                                                         ││
│ │ ├─ Kraken                                                ││
│ │ │  ├─ Long: 2 ETH @ $2,420 | Unrealized: +$60           ││
│ │ │  ├─ Available Balance: $1,800                          ││
│ │ │  └─ [View Details] [Modify Position] [Close Position]││
│ │ │                                                         ││
│ │ └─ Coinbase                                              ││
│ │    ├─ Staking: 5 ETH (earning 3.2% APY) | Value: $12,250││
│ │    ├─ Available Balance: $3,900                          ││
│ │    └─ [View Details] [Modify Stake] [Unstake]          ││
│ │                                                           ││
│ │ DEX Positions:                                           ││
│ │ ├─ Uniswap (Ethereum)                                   ││
│ │ │  ├─ LP Position: ETH/USDC | TVL: $800 | APY: 4.2%     ││
│ │ │  ├─ Unclaimed Fees: $23.50                            ││
│ │ │  └─ [View Details] [Add Liquidity] [Claim Fees]      ││
│ │ │                                                         ││
│ │ ├─ Curve (Polygon)                                      ││
│ │ │  ├─ LP Position: 3pool | TVL: $200 | APY: 8.5%        ││
│ │ │  ├─ Unclaimed Fees: $12.30                            ││
│ │ │  └─ [View Details] [Withdraw] [Claim Fees]           ││
│ │ │                                                         ││
│ │ └─ SushiSwap                                            ││
│ │    ├─ LP Position: USDC/ETH | TVL: $400 | APY: 6.1%     ││
│ │    ├─ Unclaimed Fees: $8.90                             ││
│ │    └─ [View Details] [Add/Remove] [Claim Fees]        ││
│ │                                                           ││
│ │ Summary: Total Positions Value: $28,550 | Unrealized P&L: +$2,050
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 🏦 CONNECTED EXCHANGES & DEXES (Browse 1000+ Markets)         │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ CEX Connections:                                           ││
│ │ ├─ Binance (Connected) - 1,200+ pairs                     ││
│ │ │  Your Balance: $3,500 | 24h Vol: $145B               ││
│ │ │  [Search Pair...] [Filter: By Vol|Gainers|Losers]    ││
│ │ │  Browsed Pairs:                                        ││
│ │ │  ├─ ETH/USDT → $2,450 [View Chart] [Trade] [Watch]   ││
│ │ │  ├─ BTC/USDT → $48,200 [View Chart] [Trade] [Watch]  ││
│ │ │  ├─ SOL/USDT → $189.50 [View Chart] [Trade] [Watch]  ││
│ │ │  └─ [Browse All 1,200+ Pairs]                         ││
│ │ │                                                         ││
│ │ ├─ Kraken (Connected) - 850+ pairs                       ││
│ │ │  Your Balance: $2,200 | 24h Vol: $89B                ││
│ │ │  [Search Pair...] [Browse All Markets]               ││
│ │ │                                                         ││
│ │ └─ Coinbase (Connected) - 450+ pairs                     ││
│ │    Your Balance: $2,500 | 24h Vol: $56B                ││
│ │    [Search Pair...] [Browse All Markets]               ││
│ │                                                           ││
│ │ DEX Connections:                                          ││
│ │ ├─ Uniswap (Ethereum) - 8,500+ pools                    ││
│ │ │  [Search Pool...] [Browse All Pools]                  ││
│ │ │                                                         ││
│ │ ├─ Curve (Multi-chain) - 450+ pools                     ││
│ │ │  [Search Pool...] [Browse All Pools]                  ││
│ │ │                                                         ││
│ │ └─ SushiSwap (Multi-chain) - 2,200+ pools               ││
│ │    [Search Pool...] [Browse All Pools]                  ││
│ │                                                           ││
│ │ [+ Add Exchange Connection] [Manage Connections]         ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 📊 QUICK STATS (Market Performance Snapshot)                   │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ CEX Markets:                    DEX Markets:              ││
│ │ ├─ Total 24h Vol: $290B        ├─ Total 24h Vol: $3.8B  ││
│ │ ├─ Top Gainer: +18.5%          ├─ Top Gainer: +45.2%   ││
│ │ ├─ Top Loser: -12.3%           ├─ Top Loser: -8.5%     ││
│ │ ├─ Avg Spread: 0.08%           ├─ Avg Spread: 0.35%    ││
│ │ └─ Gas/Fee Avg: $0.45           └─ Gas/Fee Avg: $12.50   ││
│ │                                                            ││
│ │ [View CEX Markets] [View DEX Markets]                    ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ ⚡ LIVE OPPORTUNITIES (ALWAYS EXPANDED - CORE VALUE)           │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ 🔥 ETH Arbitrage (CEX Spread) - CRITICAL ALERT           ││
│ │    Binance $2,450 ←→ Kraken $2,501 (+2.1%)              ││
│ │    Potential Profit: +2.1% ($450 on $20k)                ││
│ │    Risk Level: Low | Confidence: 94%                     ││
│ │    Chain: Ethereum | Gas: ~$45                           ││
│ │    [⚡ Execute with Flash Loan] [Details] [Archive]     ││
│ │                                                            ││
│ │ 🔥 USDC Spread (DEX - Polygon) - NEW                     ││
│ │    Uniswap vs Curve: 0.3% difference                     ││
│ │    Potential Profit: +0.3% ($30 on $10k)                 ││
│ │    Risk Level: Very Low | Confidence: 98%                ││
│ │    Chain: Polygon | Gas: ~$1.50                          ││
│ │    [Execute] [Details] [Archive]                         ││
│ │                                                            ││
│ │ [View 5 More Opportunities] [Alerts ▼] [Settings ⚙️]   ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ ⭐ WATCHLIST (Curated Market Pairs)                            │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ ETH/USDT     $2,450    ↑ +5.2%   | 24h Vol: $48B | [Chart]││
│ │ BTC/USDT     $48,200   ↑ +2.1%   | 24h Vol: $32B | [Chart]││
│ │ SOL/USDT     $189.50   ↓ -1.2%   | 24h Vol: $2.8B| [Chart]││
│ │ [+ Add to Watchlist] [Manage] [Alerts]                    ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 🔀 SWAP & BRIDGE (DeFi/CeFi Operations)                       │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Multi-Hop Swap Router (Best execution across DEX):        ││
│ │ ├─ From: [ETH ▼] Amount: [1.5]                           ││
│ │ ├─ To: [USDC ▼]                                           ││
│ │ ├─ Route: Uniswap → SushiSwap (Best Price)              ││
│ │ ├─ Expected Output: $3,675 USDC                          ││
│ │ ├─ Price Impact: -0.25% | Gas Cost: $45                  ││
│ │ └─ [Preview Swap] [Execute Swap]                         ││
│ │                                                            ││
│ │ Smart Order Router (Best execution across CEX/DEX):      ││
│ │ ├─ From: [BTC ▼] Amount: [0.5]                          ││
│ │ ├─ To: [USDT ▼]                                          ││
│ │ ├─ Available Routes:                                     ││
│ │ │  1. Binance CEX (0.08% fee) - BEST PRICE ✓           ││
│ │ │  2. Kraken CEX (0.12% fee)                            ││
│ │ │  3. Uniswap DEX (0.3% fee)                            ││
│ │ ├─ Expected Output: $24,100 USDT                        ││
│ │ └─ [Execute via Best Route]                             ││
│ │                                                            ││
│ │ Cross-Chain Bridge:                                       ││
│ │ ├─ From Chain: [Ethereum ▼] | To Chain: [Polygon ▼]    ││
│ │ ├─ Asset: [USDC ▼] | Amount: [1000]                     ││
│ │ ├─ Bridge: Stargate (Fast & Secure)                     ││
│ │ ├─ Estimated Time: 1-3 minutes | Fee: $8.50             ││
│ │ └─ [Execute Bridge]                                      ││
│ │                                                            ││
│ │ [Swap History] [Bridge History] [Slippage Settings]      ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 📝 CEX ORDER MANAGEMENT                                        │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Quick Order Placement:                                    ││
│ │ ├─ Select Exchange: [Binance ▼]                          ││
│ │ ├─ Select Pair: [ETH/USDT ▼]                             ││
│ │ ├─ Order Type: [Market ▼ | Limit | Stop]                ││
│ │ ├─ Amount: [______] [Max]                                ││
│ │ ├─ Price: [______] (auto-filled for market)              ││
│ │ └─ [Place Order] [Preview] [Cancel]                      ││
│ │                                                            ││
│ │ Active Orders & Positions:                               ││
│ │ ├─ Order #1: Buy 0.5 BTC @ $48,000 [PENDING]            ││
│ │ ├─ Order #2: Sell 10 ETH @ $2,600 [FILLED]              ││
│ │ └─ Position: Long 2 BTC (unrealized: +$3,200)           ││
│ │                                                            ││
│ │ [View All Orders] [Trading History] [Modify Orders]      ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 🤖 ACTIVE STRATEGIES (Bots & Automated Trading)               │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Active Strategy #1: DCA Buyer                             ││
│ │   ├─ Type: Dollar-Cost Averaging                          ││
│ │   ├─ Pair: ETH/USDT | Frequency: Daily @ $200            ││
│ │   ├─ Status: ✓ RUNNING | Executed: 18 trades            ││
│ │   ├─ Avg Price: $2,380                                   ││
│ │   └─ [Edit] [Pause] [Details]                            ││
│ │                                                            ││
│ │ Active Strategy #2: Grid Trading                          ││
│ │   ├─ Type: Grid Bot | Pair: BTC/USDT                     ││
│ │   ├─ Range: $47,000 - $49,000                            ││
│ │   ├─ Status: ✓ RUNNING (6 positions open)               ││
│ │   ├─ Profit this month: +$1,250                          ││
│ │   └─ [Edit] [Pause] [Details]                            ││
│ │                                                            ││
│ │ Active Strategy #3: Arbitrage Monitor                     ││
│ │   ├─ Type: Auto Arbitrage                                ││
│ │   ├─ Status: ✓ RUNNING (monitoring 8 pairs)              ││
│ │   ├─ Trades executed: 12 this month | Profit: +$3,450   ││
│ │   └─ [Edit] [Pause] [Details]                            ││
│ │                                                            ││
│ │ [+ Create New Strategy] [Strategy Builder] [Templates]    ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 📊 ANALYTICS (Performance & P&L Tracking)                     │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Portfolio Performance:                                    ││
│ │ ├─ Total Value: $28,550 | Unrealized P&L: +$2,050 (+7.2%)
│ │ ├─ Realized P&L (This Month): +$1,234                    ││
│ │ ├─ Total P&L (YTD): +$8,450 | Win Rate: 78%             ││
│ │                                                            ││
│ │ Trade Statistics:                                         ││
│ │ ├─ Total Trades: 156 (YTD)                               ││
│ │ ├─ Winning: 122 (78%) | Losing: 34 (22%)                ││
│ │ ├─ Avg Win: +$125 | Avg Loss: -$45                      ││
│ │ ├─ Best Trade: +$1,250 (ETH arb)                         ││
│ │ └─ Worst Trade: -$320 (Wrong call)                       ││
│ │                                                            ││
│ │ Exchange Performance:                                     ││
│ │ ├─ Binance: +$4,250 YTD (178 trades)                     ││
│ │ ├─ Kraken: +$2,100 YTD (98 trades)                       ││
│ │ ├─ Uniswap: +$1,850 YTD (DEX swaps)                      ││
│ │ └─ Curve: +$250 YTD (LP fees)                            ││
│ │                                                            ││
│ │ Charts & Visualization:                                   ││
│ │ ├─ P&L Over Time (Last 90 days)                          ││
│ │ ├─ Win/Loss Ratio (Pie chart)                            ││
│ │ ├─ Trading Volume by Exchange (Bar)                      ││
│ │ ├─ Asset Allocation (Pie chart)                          ││
│ │ └─ [View Detailed Report] [Export Data] [Compare Period] ││
│ │                                                            ││
│ │ [Detailed Trade Log] [Strategy Perf] [Risk Analysis]     ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 🔔 ALERTS & SIGNALS (Notifications)                           │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Active Price Alerts: BTC $50k | ETH <$2,200 | SOL $200   ││
│ │ Signal Notifications: RSI>70 on ETH | MACD on BTC | MA on ADA
│ │ [+ Add Alert] [Configure Signals] [Notification Settings] ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 💸 TRANSFER PROFITS (Maximize Wealth)                         │
│ ├─ Cash Out to OKEDI:                                        │
│ │  Current OKEDI: $12,450.75                                │
│ │  Amount: [_______] [All Profits]  [Transfer to OKEDI]    │
│ │                                                              │
│ └─ Hold Long-term in AMARA:                                 │
│    Current AMARA: $45,000                                   │
│    Amount: [_______] [All Profits]  [Transfer to AMARA]    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```
│ ┌────────────────────────────────────────────────────────────┐│
│ │ CEX Connections:                                           ││
│ │ ├─ Binance (Connected)                                    ││
│ │ │  Live Markets: 1,200+ pairs                            ││
│ │ │  Your Balance: $3,500 | 24h Vol: $145B               ││
│ │ │  Top Pairs: BTC/USDT, ETH/USDT, SOL/USDT             ││
│ │ │  [View All Markets] [Charts]                          ││
│ │ │                                                         ││
│ │ ├─ Kraken (Connected)                                    ││
│ │ │  Live Markets: 850+ pairs                             ││
│ │ │  Your Balance: $2,200 | 24h Vol: $89B                ││
│ │ │  Top Pairs: BTC/USD, ETH/USD, XRP/USD                ││
│ │ │  [View All Markets] [Charts]                          ││
│ │ │                                                         ││
│ │ └─ Coinbase (Connected)                                  ││
│ │    Live Markets: 450+ pairs                             ││
│ │    Your Balance: $2,500 | 24h Vol: $56B                ││
│ │    Top Pairs: BTC/USD, ETH/USD, DOGE/USD               ││
│ │    [View All Markets] [Charts]                          ││
│ │                                                           ││
│ │ DEX Connections:                                          ││
│ │ ├─ Uniswap (Ethereum)                                   ││
│ │ │  Live Markets: 8,500+ pools                           ││
│ │ │   24h Vol: $2.4B | Your TVL: $800                    ││
│ │ │  Top Pools: ETH/USDC, USDC/USDT, DAI/USDC          ││
│ │ │  [View All Pools] [Charts] [LP Positions]            ││
│ │ │                                                         ││
│ │ ├─ Curve (Multi-chain)                                  ││
│ │ │  Live Markets: 450+ pools                             ││
│ │ │  24h Vol: $850M | Your TVL: $200                     ││
│ │ │  Top Pools: 3pool, USDC/USDT, DAI/USDC              ││
│ │ │  [View All Pools] [Charts] [LP Positions]            ││
│ │ │                                                         ││
│ │ └─ SushiSwap (Multi-chain)                              ││
│ │    Live Markets: 2,200+ pools                           ││
│ │    24h Vol: $600M | Your TVL: $400                     ││
│ │    Top Pools: USDC/ETH, DAI/USDC, WETH/WMATIC        ││
│ │    [View All Pools] [Charts] [LP Positions]            ││
│ │                                                           ││
│ │ [+ Add Exchange Connection] [Manage Connections]         ││
│ └────────────────────────────────────────────────────────────┘│
│ ^^ Shows available market scope across all connected platforms  │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 📊 QUICK STATS (Market Performance Snapshot)                   │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ CEX Markets:                    DEX Markets:              ││
│ │ ├─ Total 24h Vol: $290B        ├─ Total 24h Vol: $3.8B  ││
│ │ ├─ Top Gainer: +18.5%          ├─ Top Gainer: +45.2%   ││
│ │ ├─ Top Loser: -12.3%           ├─ Top Loser: -8.5%     ││
│ │ ├─ Avg Spread: 0.08%           ├─ Avg Spread: 0.35%    ││
│ │ └─ Gas/Fee Avg: $0.45           └─ Gas/Fee Avg: $12.50   ││
│ │                                                            ││
│ │ [View CEX Markets] [View DEX Markets]                    ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ ⚡ LIVE OPPORTUNITIES (ALWAYS EXPANDED - CORE VALUE)           │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ 🔥 ETH Arbitrage (CEX Spread) - CRITICAL ALERT           ││
│ │    Binance $2,450 ←→ Kraken $2,501 (+2.1%)              ││
│ │    Potential Profit: +2.1% ($450 on $20k)                ││
│ │    Risk Level: Low | Confidence: 94%                     ││
│ │    Chain: Ethereum | Gas: ~$45                           ││
│ │    [⚡ Execute with Flash Loan] [Details] [Archive]     ││
│ │                                                            ││
│ │ 🔥 USDC Spread (DEX - Polygon) - NEW                     ││
│ │    Uniswap vs Curve: 0.3% difference                     ││
│ │    Potential Profit: +0.3% ($30 on $10k)                 ││
│ │    Risk Level: Very Low | Confidence: 98%                ││
│ │    Chain: Polygon | Gas: ~$1.50                          ││
│ │    [Execute] [Details] [Archive]                         ││
│ │                                                            ││
│ │ [View 5 More Opportunities] [Alerts ▼] [Settings ⚙️]   ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ ⭐ WATCHLIST (Curated Market Pairs)                            │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ (Note: Browse markets above first to add to watchlist)     ││
│ │                                                             ││
│ │ ETH/USDT     $2,450    ↑ +5.2%   | 24h Vol: $48B | [Chart]││
│ │ BTC/USDT     $48,200   ↑ +2.1%   | 24h Vol: $32B | [Chart]││
│ │ SOL/USDT     $189.50   ↓ -1.2%   | 24h Vol: $2.8B| [Chart]││
│ │ [+ Add to Watchlist] [Manage] [Alerts]                    ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 💳 CEX MARKETS (Order Management & Execution)                  │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Quick Order Placement:                                    ││
│ │ ├─ Select Exchange: [Binance ▼]                          ││
│ │ ├─ Select Pair: [ETH/USDT ▼]                             ││
│ │ ├─ Order Type: [Market ▼ | Limit | Stop]                ││
│ │ ├─ Amount: [______] [Max]                                ││
│ │ ├─ Price: [______] (auto-filled for market)              ││
│ │ └─ [Place Order] [Preview] [Cancel]                      ││
│ │                                                            ││
│ │ Active Orders & Positions:                               ││
│ │ ├─ Order #1: Buy 0.5 BTC @ $48,000 [PENDING]            ││
│ │ ├─ Order #2: Sell 10 ETH @ $2,600 [FILLED]              ││
│ │ └─ Position: Long 2 BTC (unrealized: +$3,200)           ││
│ │                                                            ││
│ │ [View All Orders] [Trading History]                      ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 🤖 ACTIVE STRATEGIES (Bots & Automated Trading)               │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Active Strategy #1: DCA Buyer                             ││
│ │   ├─ Type: Dollar-Cost Averaging                          ││
│ │   ├─ Pair: ETH/USDT                                       ││
│ │   ├─ Frequency: Daily @ $200                             ││
│ │   ├─ Status: ✓ RUNNING                                   ││
│ │   ├─ Executed: 18 trades | Avg Price: $2,380            ││
│ │   └─ [Edit] [Pause] [Details]                            ││
│ │                                                            ││
│ │ Active Strategy #2: Grid Trading                          ││
│ │   ├─ Type: Grid Bot                                       ││
│ │   ├─ Pair: BTC/USDT                                       ││
│ │   ├─ Range: $47,000 - $49,000                            ││
│ │   ├─ Status: ✓ RUNNING (6 positions open)               ││
│ │   ├─ Profit this month: +$1,250                          ││
│ │   └─ [Edit] [Pause] [Details]                            ││
│ │                                                            ││
│ │ Active Strategy #3: Arbitrage Monitor                     ││
│ │   ├─ Type: Auto Arbitrage                                ││
│ │   ├─ Status: ✓ RUNNING (monitoring 8 pairs)              ││
│ │   ├─ Trades executed: 12 this month                      ││
│ │   ├─ Profit: +$3,450                                     ││
│ │   └─ [Edit] [Pause] [Details]                            ││
│ │                                                            ││
│ │ [+ Create New Strategy] [Strategy Builder] [Templates]    ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 🔔 ALERTS & SIGNALS (Notifications)                           │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Active Price Alerts:                                      ││
│ │ ├─ BTC hits $50,000 [Alert enabled] [Edit] [Delete]      ││
│ │ ├─ ETH drops below $2,200 [Alert enabled] [Edit]         ││
│ │ └─ SOL breaks $200 [Alert enabled] [Edit]               ││
│ │                                                            ││
│ │ Signal Notifications:                                     ││
│ │ ├─ RSI above 70 on ETH/USDT [Signal received 2h ago]    ││
│ │ ├─ MACD crossover on BTC/USDT [Signal received 4h ago]   ││
│ │ └─ Moving average cross on ADA/USDT [Signal pending]     ││
│ │                                                            ││
│ │ [+ Add Alert] [Configure Signals] [Notification Settings] ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 💸 TRANSFER PROFITS (Maximize Wealth)                         │
│ ├─ Cash Out to OKEDI:                                        │
│ │  Current OKEDI: $12,450.75                                │
│ │  Amount: [_______] [All Profits]  [Transfer to OKEDI]    │
│ │  Purpose: Spend, governance voting, send to others        │
│ │                                                              │
│ └─ Hold Long-term in AMARA:                                 │
│    Current AMARA: $45,000                                   │
│    Amount: [_______] [All Profits]  [Transfer to AMARA]    │
│    Purpose: Long-term wealth accumulation, staking, yields  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Mtaa Protocol - Key Features

1. **Positions Tracking**
   - All positions visible at top (CEX + DEX combined)
   - Shows unrealized P&L per position
   - Can drill into each position for details
   - Close/modify options per position
   - Total portfolio value + unrealized P&L summary

2. **Universal Market Access (1000+ Pairs)**
   - Access 1,200+ pairs on Binance, 850+ on Kraken, 450+ on Coinbase
   - Search functionality (type symbol to find pair)
   - Filters (by volume, gainers, losers)
   - Click any pair to:
     - View interactive chart (TradingView)
     - See order book & recent trades
     - Place order directly
     - Add to watchlist

3. **Smart Execution Layer**
   - **Multi-Hop Swap Router**: DEX swaps with best execution across pools
   - **Smart Order Router**: Automatically finds best price across all CEX/DEX
   - **Cross-Chain Bridge**: Move assets between chains (Stargate, etc.)

4. **Enhanced CEX Markets**
   - Quick order placement
   - Active orders tracking
   - Position management
   - Order history

5. **Advanced Analytics Engine**
   - Portfolio Performance (Total Value, Unrealized/Realized P&L, Win Rate)
   - Trade Statistics (Total trades, Win/Loss breakdown, Best/Worst trades)
   - Exchange Performance (Compare which exchange is most profitable)
   - Charts & Visualization (P&L trends, asset allocation, trade volume)
   - Detailed trade log + risk analysis

6. **Complete User Workflow**
   - Start: See all positions (portfolio overview)
   - Browse: Explore 1000+ markets per exchange
   - Chart: View technical analysis
   - Execute: Trade via Smart Order Router (best price)
   - Monitor: Watchlist + Opportunities
   - Manage: Active strategies + positions
   - Analyze: Performance + P&L tracking
   - Extract: Transfer profits

### Mtaa Protocol - Technical Capabilities

**Universal Market Access:**
```
1. Click [Browse All Markets] for any CEX (e.g., Binance with 1,200+ pairs)
2. Search: Type "ETH" → Shows ETH/USDT, ETH/BUSD, ETH/BNB, etc.
3. Click any result (e.g., ETH/USDT)
4. See: Current Price, 24h change, Volume, Full Interactive Chart
5. Chart: TradingView integration with all tools
6. From Chart: Place order directly or add to watchlist
7. Return: Click [Back to Exchange List] to browse more

Alternative Access:
- Filter by volume (find high-volume pairs)
- Filter by gainers/losers (find trending pairs)
- Sort by volume (see most active trading pairs)
- Each pair → chart → trade → execute
```

**Mtaa Protocol Capabilities:**
- ✅ Universal market access (1000+ pairs per exchange)
- ✅ Advanced charting & technical analysis
- ✅ Smart order routing (CEX/DEX optimization)
- ✅ Multi-position management
- ✅ DeFi swaps & cross-chain bridges
- ✅ Performance analytics & reporting
- ✅ Automated trading strategies
- ✅ Real-time price alerts & signals

---

## AMARA Profile (Wealth/Long-term Holdings)

### Visual Layout

```
┌────────────────────────────────────────────────────────────────┐
│ [Settings] [👤 Morio] [OKEDI | 📈 YUKI | 💰 AMARA]          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 💰 AMARA - Wealth & Holdings Dashboard                        │
│ Total Holdings: $45,000 | YTD Growth: +18.5%                │
│ Active Stakes: 3 | Monthly Yield: $850                       │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 📊 PORTFOLIO OVERVIEW (4 cards)                               │
│ ┌──────────┬──────────┬──────────┬──────────┐               │
│ │ Holdings │ YTD Gain │ Avg Yld │ Risk Lvl │               │
│ │ $45.0k   │ +18.5%   │ +2.3%/mo│ Medium   │               │
│ └──────────┴──────────┴──────────┴──────────┘               │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ ▼ LONG-TERM HOLDINGS (Expanded)                               │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ BTC         $20,000  (45% of portfolio)                   ││
│ │             Acquired: Jan 2024 | Current Gain: +12.5%    ││
│ │                                                            ││
│ │ ETH         $15,000  (33% of portfolio)                   ││
│ │             Acquired: Feb 2024 | Current Gain: +8.2%     ││
│ │                                                            ││
│ │ Staking     $10,000  (22% of portfolio)                   ││
│ │             (Actively earning yield)                      ││
│ │                                                            ││
│ │ [+ Add Long-term Holding] [Rebalance Portfolio] [History] ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ ▼ STAKING & YIELDS (Expanded)                                 │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Ethereum Staking: $5,000 @ 3.2% APY                      ││
│ │    Earned this month: $127.50                            ││
│ │    Earned this year: $1,534                              ││
│ │    Status: Active & Secure                               ││
│ │    [Claim Rewards] [Modify Stake] [Details]              ││
│ │                                                            ││
│ │ Polygon Staking: $5,000 @ 8.5% APY                       ││
│ │    Earned this month: $354.17                            ││
│ │    Earned this year: $4,251                              ││
│ │    Status: Active & Earning                              ││
│ │    [Claim Rewards] [Modify Stake] [Details]              ││
│ │                                                            ││
│ │ ─────────────────────────────────────────                 ││
│ │ Total Monthly Yield: $850                                ││
│ │ Total Annual Yield (projected): $10,200                 ││
│ │                                                            ││
│ │ [Claim All Rewards] [Reinvest Yield] [Configure Stakes] ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ ▶ PERFORMANCE ANALYTICS (Collapsible)                         │
│   Detailed performance tracking and analytics                  │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ ▶ TRANSFER HISTORY (Collapsible)                              │
│   Inflows from YUKI (trading profits)                          │
│   Inflows from OKEDI (wealth accumulation)                     │
│   Can expand to see transfer history & dates                  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Key Design Principles for AMARA

1. **Long-term Focus**
   - Holdings + Staking dominate the view
   - Historical performance visible
   - Growth tracking emphasized

2. **Yield Optimization**
   - Staking positions clearly displayed
   - Rewards calculated and shown
   - Claim/reinvest options prominent

3. **Wealth Accumulation**
   - Track inflows from YUKI (profits) and OKEDI (savings)
   - Portfolio allocation clear
   - Risk level visible

4. **No Trading Data**
   - AMARA is "set and forget" wealth building
   - Real-time market data not needed
   - Historical performance > real-time data

5. **Passive Income Visibility**
   - Monthly/yearly yield projections
   - Reinvestment options
   - Long-term wealth growth narrative

---

## Global Navigation Implementation

### Persistent Components (Never Reload)

```tsx
// These ALWAYS visible, ALWAYS functional
<GlobalNav>
  <SettingsButton />           // ⚙️ Opens settings modal
  <MorioDropdown />            // 👤 Account menu
  <ProfileSwitcher>
    <ProfileButton profile="OKEDI" />     // Active profile highlighted
    <ProfileButton profile="YUKI" />      // Instant switch
    <ProfileButton profile="AMARA" />     // Instant switch
  </ProfileSwitcher>
</GlobalNav>
```

### Profile Switching Behavior

```
When user clicks profile button:
1. Global nav STAYS in place (no reload)
2. Profile-specific content SWAPS instantly
3. Balance card UPDATES to show active profile balance
4. Remembered state RESTORES (last opened section)
5. URL updates (but no page reload)

Example:
- User in YUKI, has Opportunities section expanded
- User clicks OKEDI button
- Opportunities section CLOSES (it's not in OKEDI)
- OKEDI content APPEARS
- OKEDI's last-opened section EXPANDS (e.g., Send section)
- User switches back to YUKI
- Opportunities section REOPENS (remembers state)
```

### Technical Implementation

```tsx
// Context manages profile state + state per profile
interface ProfileState {
  activeProfile: 'OKEDI' | 'YUKI' | 'AMARA';
  okediState: {
    expandedSections: string[];
    selectedTab: string;
  };
  yukiState: {
    expandedSections: string[];
    selectedTab: string;
  };
  amaraState: {
    expandedSections: string[];
    selectedTab: string;
  };
}

const handleProfileSwitch = (profile) => {
  // Save current state
  saveProfileState(activeProfile, currentState);
  
  // Switch profile
  setActiveProfile(profile);
  
  // Restore that profile's state
  const savedState = loadProfileState(profile);
  restoreUIState(savedState);
  
  // NO page reload - just context update
};
```

---

## Implementation Phases

### Phase 1: Core Global Navigation + Profiles (Week 1-2)

**What Gets Built:**
- ✅ Persistent global nav component (Settings, Morio, Profile Switcher)
- ✅ Profile switching mechanism (instant, no reload)
- ✅ OKEDI profile with all 5 features (Send/Receive/Transfer/Deposit/Withdraw)
- ✅ YUKI profile with opportunities always visible
- ✅ AMARA profile with holdings + staking
- ✅ State management per profile (remembers last used section)
- ✅ Mobile-responsive layout

**Deliverable:** All 3 profiles functional, quick profile switching, global nav persists

**User Experience:** Clean, organized, no more 8-tab confusion

### Phase 2: Fine-Grained Context for OKEDI (Week 2-3)

**What Gets Built:**
- ✅ Send context switching (DAO vs User vs Address)
- ✅ DAO member verification before send
- ✅ User autocomplete + address lookup
- ✅ Address verification + warning system
- ✅ Address history tracking
- ✅ Transfer between profiles with balance display

**Deliverable:** Powerful OKEDI Send feature with all safety guardrails

### Phase 3: Trading Features for YUKI (Week 3-4)

**What Gets Built:**
- ✅ Real-time opportunity scanning
- ✅ Flash loan execution
- ✅ Profit transfer to OKEDI/AMARA
- ✅ Keyboard shortcuts for power traders
- ✅ Optional sidebar (Pro Mode)

**Deliverable:** YUKI becomes primary profit machine

### Phase 4: Polish + Analytics (Week 4+)

**What Gets Built:**
- ✅ AMARA analytics dashboard
- ✅ Performance tracking
- ✅ Yield optimization suggestions
- ✅ Personalization (section reordering, themes)
- ✅ Mobile optimization

**Deliverable:** Industry-leading dashboard experience

---

## Design Checklist

### OKEDI Profile ✅
- [ ] Send with 3 context options (DAO/User/Address)
- [ ] Fine-grained context shown for each option
- [ ] Receive with QR code + address history
- [ ] Transfer to YUKI with balance display
- [ ] Transfer to AMARA with balance display
- [ ] Deposit/Withdraw options
- [ ] Governance features visible (DAOs, proposals)
- [ ] Mobile responsive (sections stack vertically)

### YUKI Profile ✅
- [ ] Opportunities ALWAYS visible (never collapsed)
- [ ] Quick stats at top
- [ ] Watchlist below opportunities
- [ ] CEX/DEX/Strategies/Alerts as collapsible sections
- [ ] Transfer profits to OKEDI (cash out)
- [ ] Transfer profits to AMARA (hold)
- [ ] Real-time data streaming
- [ ] Mobile perfect (natural scroll, no horizontal scroll)

### AMARA Profile ✅
- [ ] Portfolio overview cards
- [ ] Long-term holdings section (expanded)
- [ ] Staking & yields section (expanded)
- [ ] Performance analytics (collapsible)
- [ ] Transfer history (collapsible)
- [ ] Can receive from YUKI + OKEDI
- [ ] Mobile responsive

### Global Navigation ✅
- [ ] Settings button (⚙️) - always accessible
- [ ] Morio dropdown (👤) - always accessible
- [ ] Profile switcher (3 buttons) - always visible
- [ ] Profile switching instant (no reload)
- [ ] State remembered per profile
- [ ] Mobile responsive (buttons stack/collapse as needed)
- [ ] Navigation never reloads
- [ ] Navigation never changes height/layout

---

## Key Principles Summary

1. **Three Fixed Profiles** - No additions, each with clear purpose
2. **Persistent Global Nav** - Settings, Morio, Profile Switcher always visible
3. **Instant Profile Switching** - No page reloads, smooth transitions
4. **Fine-Grained Context** - Send in OKEDI shows exactly what's happening
5. **Opportunities Always Visible** - YUKI never hides profit alerts
6. **Real-time Monitoring** - Data streams continuously
7. **Mobile-First Design** - Natural scrolling, responsive layout
8. **Clear Separation** - OKEDI (community), YUKI (trading), AMARA (wealth)
9. **State Memory** - Each profile remembers where you were
10. **User Intent First** - Layout serves the actual workflow, not vice versa

---

## Next Steps

1. **Approve architecture** - Three profiles, persistent nav, fine-grained context
2. **Start Phase 1** - Build global nav + profile switching
3. **Test profile switching** - Ensure instant switching works smoothly
4. **Implement OKEDI** - Send with all 3 context options
5. **Implement YUKI** - Opportunities always visible
6. **Implement AMARA** - Holdings + staking
7. **Mobile testing** - Ensure responsive design works
8. **User testing** - Validate workflows with real users

---

**This architecture is ready for production implementation!** 🚀
