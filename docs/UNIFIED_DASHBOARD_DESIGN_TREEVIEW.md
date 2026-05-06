
# TREE VIEW UNIFIED DASHBOARD - DETAILED DESIGN 🎨

**Status:** Design Complete | Ready for Implementation  
**Style:** Tree View with Cards | Real-time Updates | Hybrid Hierarchy  
**Architecture:** Single Page | WebSocket Real-time | Enriched Activity Feed

---

## 🎯 VISUAL LAYOUT - DESKTOP VIEW

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  📊 UNIFIED DASHBOARD                         🔄 Real-time    👤 Alice (5s ago)  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  🌍 PLATFORM OVERVIEW                                   [Filter: Last 7d] [⚙️]   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │ 📈 Platform Metrics                                                       │   │
│  │ Total Assets: 125,000 | Total TVL: $2.5M | Active DAOs: 2 | Members: 57 │   │
│  │ Platform Health: 76/100 ████████░░  Treasury: 82/100 | Community: 79/100 │   │
│  │ Last Updated: 1m ago (Real-time)                                         │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                   │
│  🏛️ YOUR DAOs (expandable tree)                                                 │
│  ├─ DAO Alpha ──────────────────────────────────────────────────────────────┐   │
│  │ ┌──────────────┬──────────────┬──────────────┬──────────────┐            │   │
│  │ │ 👥 Members   │ 💰 Treasury  │ 🗳️ Governance│ 📊 Health    │            │   │
│  │ │ 45 total     │ $500k        │ 65% voting   │ 78/100 ✓✓    │            │   │
│  │ │ 38 active    │ +5% month    │ 12 proposals │ improving    │            │   │
│  │ │              │ 8mo runway   │ 78% approval │              │            │   │
│  │ └──────────────┴──────────────┴──────────────┴──────────────┘            │   │
│  │                                                                             │   │
│  │ 📍 Your Role: Founder | Voting Power: 20%                               │   │
│  │ 💵 Your Balance in DAO: $50,000 (10% of treasury)                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                   │
│  ├─ DAO Beta ────────────────────────────────────────────────────────────────┐   │
│  │ ┌──────────────┬──────────────┬──────────────┬──────────────┐            │   │
│  │ │ 👥 Members   │ 💰 Treasury  │ 🗳️ Governance│ 📊 Health    │            │   │
│  │ │ 12 total     │ $100k        │ 42% voting   │ 65/100 ⚠️    │            │   │
│  │ │ 8 active     │ -2% month    │ 3 proposals  │ declining    │            │   │
│  │ │              │ 3mo runway   │ 100% approval│              │            │   │
│  │ └──────────────┴──────────────┴──────────────┴──────────────┘            │   │
│  │                                                                             │   │
│  │ 📍 Your Role: Member | Voting Power: 5%                                 │   │
│  │ 💵 Your Balance in DAO: $10,000 (10% of treasury)                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                   │
│  👤 YOUR AGGREGATED BALANCES                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Total Across DAOs: $60,000                                              │   │
│  │ ├─ DAO Alpha: $50,000 (83%)  ████████████████░░░░░░                    │   │
│  │ ├─ DAO Beta:  $10,000 (17%)  ███░░░░░░░░░░░░░░░░░░                    │   │
│  │ └─ Wallet (Personal): $12,500 (21%)                                     │   │
│  │    ├─ BTC: 0.15 ($6,300)                                               │   │
│  │    ├─ ETH: 2.5 ($5,000)                                                │   │
│  │    ├─ USDC: 500 ($500)                                                 │   │
│  │    └─ cUSD: 750 ($750)                                                 │   │
│  │                                                                             │   │
│  │ 📊 Total Net Worth: $72,500 (Portfolio Breakdown) ↓                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                   │
│  📊 YOUR ASSET BREAKDOWN (List View)                                            │
│  ┌────┬───────────┬────────┬─────────┬──────────┬─────────┬─────────────────┐   │
│  │ #  │ Asset     │ Amount │ Price   │ Value    │ Change  │ Location        │   │
│  ├────┼───────────┼────────┼─────────┼──────────┼─────────┼─────────────────┤   │
│  │ 1  │ BTC       │ 0.15   │ $42,000 │ $6,300   │ +5.2%   │ Personal Wallet │   │
│  │ 2  │ ETH       │ 2.5    │ $2,000  │ $5,000   │ +2.1%   │ Personal Wallet │   │
│  │ 3  │ USDC      │ 500    │ $1.00   │ $500     │ 0%      │ Personal Wallet │   │
│  │ 4  │ cUSD      │ 750    │ $1.00   │ $750     │ -0.5%   │ Personal Wallet │   │
│  │ 5  │ DAO Alpha │ 10     │ $5,000  │ $50,000  │ +8.3%   │ DAO Treasury    │   │
│  │ 6  │ DAO Beta  │ 10     │ $1,000  │ $10,000  │ -2.1%   │ DAO Treasury    │   │
│  │ 7  │ SOL       │ 5      │ $180    │ $900     │ +12%    │ Arbitrage Pool  │   │
│  │ 8  │ AAVE      │ 2      │ $250    │ $500     │ -1.5%   │ Lending Pool    │   │
│  └────┴───────────┴────────┴─────────┴──────────┴─────────┴─────────────────┘   │
│                                                                                   │
│  🔄 REAL-TIME ACTIVITY FEED (Opportunities + Market Data)                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                             │   │
│  │ ⭐ OPPORTUNITIES (From ELD-KAIZEN)                                       │   │
│  │                                                                             │   │
│  │ 🚀 HIGH PRIORITY - DAO Alpha Treasury Optimization                      │   │
│  │    Opportunity: Allocate $100k to high-yield vault                     │   │
│  │    Est. Gain: +$5k/month | Risk: Low | Status: 3 hours ago             │   │
│  │    [View Details] [Vote] [Approve]                                      │   │
│  │                                                                             │   │
│  │ ⚡ MEDIUM PRIORITY - Member Engagement Boost                             │   │
│  │    Opportunity: Increase voting incentives by 2%                        │   │
│  │    Est. Participation: +15% | Cost: $1.5k | Status: 1 hour ago         │   │
│  │    [View Details] [Vote]                                                │   │
│  │                                                                             │   │
│  │ 🎯 YOUR ARBITRAGE OPPORTUNITY                                           │   │
│  │    BTC/USDT: Buy on Kraken ($41,950) → Sell on Binance ($42,100)      │   │
│  │    Profit: 0.36% ($63 per BTC) | Liquidity: High ✓ | 12 mins ago      │   │
│  │    [Execute] [Details]                                                  │   │
│  │                                                                             │   │
│  │ 📊 DEFI OPPORTUNITIES (From APIs)                                       │   │
│  │                                                                             │   │
│  │ 💰 Uniswap V3 AAVE/ETH: 45% APY (Concentrated liquidity)               │   │
│  │    Deposit: Min $1k | Risk: Impermanent loss | 2 mins ago               │   │
│  │    Your potential: $225/month if you deposit $5k                        │   │
│  │    [Deposit] [View Pool]                                                │   │
│  │                                                                             │   │
│  │ 🏦 Aave: ETH Lending 3.2% APY (Updated 1 min ago)                      │   │
│  │    You have 2.5 ETH available | Current rate: 3.2% | Optimal rate     │   │
│  │    [Lend] [View Details]                                                │   │
│  │                                                                             │   │
│  │ 📈 CEFI MARKET DATA                                                     │   │
│  │                                                                             │   │
│  │ 📊 BTC/USDT Spot Markets (Real-time from 6 exchanges)                  │   │
│  │    Binance:   $42,100 | Volume: $2.3B | Spread: $5                     │   │
│  │    Kraken:    $41,950 | Volume: $450M | Spread: $10 ← Best Price      │   │
│  │    Coinbase:  $42,050 | Volume: $120M | Spread: $15                    │   │
│  │    Bybit:     $42,120 | Volume: $890M | Spread: $3 ← Tightest Spread  │   │
│  │                                                                             │   │
│  │ 🌐 GLOBAL CRYPTO METRICS (Real-time)                                    │   │
│  │                                                                             │   │
│  │ 🔴 Fear & Greed Index: 42 (Fear)         ▓░░░░░░░░░░░                  │   │
│  │ 👑 BTC Dominance: 48.2% ↑ 0.3%          ████████░░░░░░░░░░             │   │
│  │ 📊 Total Market Cap: $2.1T ↓ 2.1%        ███████████░░░░░░░             │   │
│  │ 🔄 24h Volume: $96B ↑ 5.4%               ███████████████░░░             │   │
│  │ 📈 ETH Gas: 42 Gwei (Normal)             ░░░░░░░░░░░░░░░░░░             │   │
│  │                                                                             │   │
│  │ 🕐 TOP MOVERS (Last 24h)                                                │   │
│  │    SOL: +12.5% ($180)   | Reason: Solana Mainnet uptime improvement   │   │
│  │    AVAX: -8.2% ($35)    | Reason: Community vote failed                │   │
│  │    LINK: +4.3% ($28.50) | Reason: New oracle partnerships              │   │
│  │                                                                             │   │
│  │ 🔗 RECENT DAO ACTIVITIES (Your DAOs)                                    │   │
│  │                                                                             │   │
│  │ ✅ DAO Alpha - Treasury Transfer Approved                               │   │
│  │    $50k → Operations Account | Approved by 38 members (84%) | 12m ago  │   │
│  │    Your vote: ✓ Approved                                                │   │
│  │                                                                             │   │
│  │ 📋 DAO Alpha - New Proposal Created                                     │   │
│  │    "Q1 Budget Allocation" | 12 proposals | Voting opens in 2h | 20m ago │   │
│  │    Your status: Not voted yet [Vote Now]                                │   │
│  │                                                                             │   │
│  │ 👤 DAO Beta - New Member Joined                                         │   │
│  │    Sarah joined DAO Beta | Welcome vote in progress | 1h ago            │   │
│  │                                                                             │   │
│  │ 💼 Your Contribution Recorded                                           │   │
│  │    You voted on "Code Quality Standards" | Weight: 5% | 3h ago          │   │
│  │    +2 Reputation Points | Current Rank: 8th in DAO Beta                 │   │
│  │                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 MOBILE VIEW - Responsive Stacking

```
┌──────────────────────────┐
│ 📊 DASHBOARD     🔄  👤  │
├──────────────────────────┤
│                          │
│ 🌍 PLATFORM OVERVIEW     │
│ ┌────────────────────┐   │
│ │ TVL: $2.5M        │   │
│ │ Assets: 125k      │   │
│ │ Health: 76/100 ✓  │   │
│ └────────────────────┘   │
│                          │
│ 🏛️ YOUR DAOs             │
│ ┌────────────────────┐   │
│ │ DAO Alpha          │   │
│ │ Members: 45        │   │
│ │ Treasury: $500k    │   │
│ │ Your Balance: $50k │   │
│ │ Health: 78/100 ✓✓  │   │
│ │ [View] [Expand]    │   │
│ └────────────────────┘   │
│ ┌────────────────────┐   │
│ │ DAO Beta           │   │
│ │ Members: 12        │   │
│ │ Treasury: $100k    │   │
│ │ Your Balance: $10k │   │
│ │ Health: 65/100 ⚠️   │   │
│ │ [View] [Expand]    │   │
│ └────────────────────┘   │
│                          │
│ 👤 YOUR BALANCES         │
│ Total: $72.5k            │
│ ┌────────────────────┐   │
│ │ BTC: $6.3k         │   │
│ │ ETH: $5k           │   │
│ │ DAOs: $60k         │   │
│ │ Other: $1.2k       │   │
│ └────────────────────┘   │
│                          │
│ 📊 ASSETS (Tap to expand)│
│ ┌────────────────────┐   │
│ │ BTC: 0.15  $6.3k   │   │
│ │ ETH: 2.5   $5k     │   │
│ │ USDC: 500  $500    │   │
│ │ [View All] >>      │   │
│ └────────────────────┘   │
│                          │
│ 🔄 FEED (Scroll)         │
│ ┌────────────────────┐   │
│ │ ⭐ DAO Opportunity │   │
│ │ Allocate treasury  │   │
│ │ Est. Gain: +$5k/m  │   │
│ │ [View] [Vote]      │   │
│ └────────────────────┘   │
│ ┌────────────────────┐   │
│ │ 🚀 Arbitrage Opp   │   │
│ │ BTC: Buy Kraken    │   │
│ │ Sell Binance       │   │
│ │ +0.36% profit      │   │
│ │ [Execute]          │   │
│ └────────────────────┘   │
│ ┌────────────────────┐   │
│ │ 📊 BTC Markets     │   │
│ │ Kraken: $41,950    │   │
│ │ Binance: $42,100   │   │
│ │ Spread: $150       │   │
│ └────────────────────┘   │
│ ┌────────────────────┐   │
│ │ 🌐 Global Metrics  │   │
│ │ Fear: 42 (Fear)    │   │
│ │ BTC Dom: 48.2% ↑   │   │
│ │ Market: $2.1T ↓    │   │
│ └────────────────────┘   │
│                          │
└──────────────────────────┘
```

---

## 🔄 REAL-TIME ARCHITECTURE

### WebSocket Connection (Live Updates)

```typescript
// Real-time data streams:

1. PLATFORM METRICS (Every 30s)
   ├─ Total TVL: $2.5M
   ├─ Asset count: 125k
   ├─ Member count: 57
   └─ Health scores: [76, 82, 71, 79, 68]

2. DAO METRICS (Per DAO, Every 1m)
   ├─ Treasury balance
   ├─ Member count
   ├─ Active members
   ├─ Governance participation
   └─ Health trend

3. OPPORTUNITY STREAM (Real-time, As they occur)
   ├─ ELD-KAIZEN optimizations
   ├─ Arbitrage opportunities
   ├─ DeFi pool updates
   ├─ Treasury suggestions
   └─ Member engagement hints

4. MARKET DATA STREAM (Every 5s for BTC/ETH, Every 30s for others)
   ├─ Exchange prices (6 exchanges)
   ├─ Spreads & liquidity
   ├─ Volume data
   ├─ Trading pair status
   └─ Best execution paths

5. GLOBAL METRICS STREAM (Every 60s)
   ├─ Fear & Greed Index
   ├─ BTC Dominance
   ├─ Total Market Cap
   ├─ 24h Volume
   ├─ ETH Gas prices
   ├─ Top movers (24h)
   └─ Trend indicators

6. ACTIVITY LOG STREAM (Real-time, As they happen)
   ├─ DAO proposals (created, voted, approved)
   ├─ Treasury operations
   ├─ Member activities
   ├─ Governance events
   ├─ Reputation changes
   └─ System alerts
```

### Connection Management

```javascript
// Single WebSocket connection handling all streams:

const ws = new WebSocket('wss://api.mtaadao.io/ws');

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  
  switch(type) {
    case 'PLATFORM_METRICS':
      updatePlatformStats(data);  // Top section
      break;
    case 'DAO_METRICS':
      updateDaoCard(data.daoId, data);  // DAO cards
      break;
    case 'OPPORTUNITY':
      prependToActivityFeed(data);  // Activity feed
      break;
    case 'MARKET_DATA':
      updateMarketData(data);  // Asset list, market section
      break;
    case 'GLOBAL_METRICS':
      updateGlobalMetrics(data);  // Crypto metrics section
      break;
    case 'ACTIVITY':
      addActivityLog(data);  // Activity feed
      break;
  }
};

// Fallback: HTTP polling if WebSocket unavailable
setInterval(() => {
  fetch('/api/dashboard/metrics').then(updateDashboard);
}, 5000);
```

---

## 📊 COMPONENT STRUCTURE

```
UnifiedDashboard (Main Page)
│
├─ HeaderBar
│  ├─ Title "📊 UNIFIED DASHBOARD"
│  ├─ Refresh Button (Manual + Auto every 30s)
│  ├─ Filter Dropdown (Last 7d / 30d / 90d / Custom)
│  ├─ Search Bar (Find DAO, Asset, Member)
│  └─ User Profile Menu
│
├─ PlatformOverviewCard
│  ├─ Stats: TVL, Assets, DAOs, Members
│  ├─ Health Scores: [Overall, Treasury, Governance, Community, System]
│  ├─ Last Updated: "1m ago (Real-time)"
│  └─ [Expand for trends] button
│
├─ DAOsTreeSection (Expandable List)
│  ├─ DaoCard (for each DAO)
│  │  ├─ DAO Name + Status
│  │  ├─ MetricsGrid: Members | Treasury | Governance | Health
│  │  ├─ Your Role + Voting Power
│  │  ├─ Your Balance in DAO (with breakdown)
│  │  ├─ Expand Button [↓] for detailed metrics
│  │  │  ├─ Treasury Trends (chart)
│  │  │  ├─ Governance Participation (chart)
│  │  │  ├─ Member Growth (chart)
│  │  │  ├─ Last 5 Activities
│  │  │  └─ Elder Recommendations
│  │  └─ [Vote] [Send] [Settings] buttons
│  │
│  └─ [+ Create New DAO] button
│
├─ UserBalanceAggregation
│  ├─ Total Balance: $72.5k
│  ├─ Breakdown by Source
│  │  ├─ DAO Alpha: $50k (83%)
│  │  ├─ DAO Beta: $10k (17%)
│  │  ├─ Personal Wallet: $12.5k
│  │  └─ Staking/Pools: $5k
│  │
│  ├─ Pie Chart (Visual Breakdown)
│  └─ [Manage] [Export] buttons
│
├─ AssetListTable
│  ├─ Headers: # | Asset | Amount | Price | Value | Change | Location
│  ├─ Rows (Sortable by any column)
│  │  ├─ BTC: 0.15 | $42k | $6.3k | +5.2% | Personal Wallet
│  │  ├─ ETH: 2.5 | $2k | $5k | +2.1% | Personal Wallet
│  │  ├─ USDC: 500 | $1 | $500 | 0% | Personal Wallet
│  │  ├─ cUSD: 750 | $1 | $750 | -0.5% | Personal Wallet
│  │  ├─ DAO Alpha: 10 | $5k | $50k | +8.3% | DAO Treasury
│  │  ├─ DAO Beta: 10 | $1k | $10k | -2.1% | DAO Treasury
│  │  ├─ SOL: 5 | $180 | $900 | +12% | Arbitrage Pool
│  │  └─ AAVE: 2 | $250 | $500 | -1.5% | Lending Pool
│  │
│  ├─ [Search] [Filter] [Export] buttons
│  └─ Pagination: Page 1 of 3 | Items per page: [10▼]
│
├─ RealtimeActivityFeed (Main Section)
│  │
│  ├─ FeedHeader
│  │  ├─ Title "🔄 REAL-TIME ACTIVITY"
│  │  ├─ TabFilter
│  │  │  ├─ "All" (default)
│  │  │  ├─ "Opportunities"
│  │  │  ├─ "DeFi"
│  │  │  ├─ "CeFi Markets"
│  │  │  ├─ "Global Metrics"
│  │  │  ├─ "DAO Activities"
│  │  │  └─ "My Actions"
│  │  │
│  │  ├─ SortDropdown (Latest / Highest Gain / Most Relevant)
│  │  └─ PauseButton (Stop auto-scroll)
│  │
│  ├─ FeedItems (Virtualized List - loads as you scroll)
│  │
│  ├─ OpportunitiesFeed
│  │  ├─ Priority badge (⭐ HIGH / ⚡ MEDIUM / 🟢 LOW)
│  │  ├─ Title + Description
│  │  ├─ Metrics: Est. Gain, Risk Level, Time Created
│  │  ├─ Actions: [View Details] [Approve] [Vote] [Execute]
│  │  └─ Status badge (3 hours ago)
│  │
│  ├─ DefiOpportunitiesFeed
│  │  ├─ Pool name + APY
│  │  ├─ Type: Concentrated LP / Lending / Yield
│  │  ├─ Your potential earnings
│  │  ├─ Risk indicators
│  │  └─ [Deposit] [View Pool] buttons
│  │
│  ├─ ArbitrageFeed
│  │  ├─ Trading pair: BTC/USDT
│  │  ├─ Buy venue + price: Kraken $41,950
│  │  ├─ Sell venue + price: Binance $42,100
│  │  ├─ Spread: $150 (0.36%)
│  │  ├─ Liquidity: High ✓
│  │  ├─ Time created: 12 mins ago
│  │  ├─ Est. execution cost: $100 (fees)
│  │  └─ [Execute] [Details] buttons
│  │
│  ├─ CeFiMarketDataFeed
│  │  ├─ Market: BTC/USDT Spot
│  │  ├─ Exchange prices grid
│  │  │  ├─ Binance: $42,100 | Vol: $2.3B | Spread: $5
│  │  │  ├─ Kraken: $41,950 | Vol: $450M | Spread: $10 ← Best
│  │  │  ├─ Coinbase: $42,050 | Vol: $120M | Spread: $15
│  │  │  └─ Bybit: $42,120 | Vol: $890M | Spread: $3 ← Tightest
│  │  │
│  │  ├─ Summary: "Best price: Kraken | Tightest spread: Bybit"
│  │  ├─ Updated: "1 min ago (Real-time)"
│  │  └─ [Compare] [Trade] buttons
│  │
│  ├─ GlobalMetricsFeed
│  │  ├─ Fear & Greed Index: 42 (Fear) [Gauge visualization]
│  │  ├─ BTC Dominance: 48.2% ↑ 0.3% [Progress bar]
│  │  ├─ Total Market Cap: $2.1T ↓ 2.1% [Trend indicator]
│  │  ├─ 24h Volume: $96B ↑ 5.4% [Trend indicator]
│  │  ├─ ETH Gas: 42 Gwei (Normal) [Status badge]
│  │  ├─ Top Movers
│  │  │  ├─ SOL: +12.5% | Reason: Mainnet uptime improvement
│  │  │  ├─ AVAX: -8.2% | Reason: Community vote failed
│  │  │  └─ LINK: +4.3% | Reason: New oracle partnerships
│  │  │
│  │  ├─ Updated: "2 mins ago (Real-time)"
│  │  └─ [View Details] button
│  │
│  ├─ DaoActivitiesFeed
│  │  ├─ Activity: Treasury transfer approved / Proposal created / Member joined
│  │  ├─ Details: Amount, participants, votes
│  │  ├─ Time created: "12m ago"
│  │  ├─ Your status: (if applicable) "You voted: ✓ Approved"
│  │  ├─ Action badge: [Vote] [Approve] [View] buttons
│  │  └─ Reputation impact: "+2 points" (if applicable)
│  │
│  └─ EndMessage (at bottom after scrolling)
│     └─ "🎉 You're all caught up! Next update in 30s"
│
└─ Footer
   ├─ Last synced: "2 seconds ago (Real-time via WebSocket)"
   ├─ Sync status: "● Connected" (green dot)
   ├─ Network latency: "45ms"
   └─ [Settings] [Help] [Feedback] links
```

---

## 🎨 COLOR SCHEME & STYLING

### Dark Mode (Default)

```css
/* Background Gradient */
Background: Linear gradient from slate-900 → slate-800
Header: slate-900/50 with backdrop blur
Cards: slate-800 with border-slate-700

/* Text */
Primary: white
Secondary: slate-300
Muted: slate-500

/* Status Colors */
Positive (Green):   #10b981 (emerald-500)
Negative (Red):    #ef4444 (red-500)
Warning (Orange):  #f59e0b (amber-500)
Info (Blue):       #3b82f6 (blue-500)
Neutral (Gray):    #6b7280 (gray-500)

/* Accent */
Primary Accent: blue-600 (buttons, active states)
Secondary Accent: purple-600 (highlights)

/* Health Scores */
90-100: #10b981 (green) - Excellent
70-89:  #f59e0b (amber) - Good
50-69:  #f59e0b (orange) - Warning
0-49:   #ef4444 (red) - Critical
```

### Light Mode (Alternative)

```css
Background: white → gray-50
Header: white/80 with backdrop blur
Cards: white with border-gray-200

Text: Primary: gray-900
Muted: gray-600

(Same accent colors, adjusted for contrast)
```

---

## ⚡ REAL-TIME INTERACTION EXAMPLES

### Example 1: Arbitrage Opportunity Appears (Real-time)

```
Timeline of events (user's screen):

T+0s   [Nothing happens - user scrolling through history]
T+2s   🚀 New opportunity appears at top of feed
       "🎯 NEW ARBITRAGE: BTC/USDT"
       Toast notification: "New arbitrage +0.36%"
       
T+3s   Visual animation: Item slides in from top
       Sound: Soft "ding" notification
       
T+5s   User clicks [Execute]
       Modal opens with:
       - Buy: Kraken $41,950 (order book)
       - Sell: Binance $42,100 (order book)
       - Confirm execution
       
T+8s   Order executed
       Notification: "✅ Arbitrage executed! +$63 profit"
       DAO treasury balance updates in real-time
       Feed item gets "Completed" badge
```

### Example 2: Market Data Updates (Every 5s for BTC)

```
Timeline:

T+0s   CeFi Markets Feed Item
       "📊 BTC/USDT Spot Markets"
       Binance: $42,100 | Kraken: $41,950
       Updated: "15s ago"

T+5s   Data updates (WebSocket message)
       Binance: $42,105 (↑$5)
       Kraken: $41,960 (↑$10)
       Updated: "10s ago" (automatically)
       Spread animation: Bar updates visually

T+10s  Another update
       Binance: $42,095 (↓$10)
       Kraken: $41,955 (↓$5)
       Updated: "5s ago"
       
(User doesn't need to refresh - everything updates automatically)
```

### Example 3: Platform Health Drops (Alert)

```
Timeline:

T+0s   Platform Overview Card
       Health: 76/100 ✓

T+30s  ELD-KAIZEN detects declining activity
       Health metric starts dropping: 76 → 72

T+60s  Health reaches 70/100
       Color changes from amber to orange (warning)
       New opportunity appears in feed:
       "⚠️ CRITICAL: Community engagement declining"
       "Recommendation: Increase voting incentives"
       
T+90s  Notification pops: "⚠️ Platform health alert"
       User can [View] [Act] [Dismiss]
```

---

## 📡 API ENDPOINTS USED (Real-time)

```
WebSocket: wss://api.mtaadao.io/ws

HTTP Fallback (if WebSocket unavailable):

GET /api/dashboard/metrics              (Platform overview)
GET /api/elders/kaizen/all-metrics      (All DAO metrics)
GET /api/elders/kaizen/opportunities    (All opportunities)
GET /api/discover/arbitrage             (Arbitrage opportunities)
GET /api/exchanges/prices               (Market data - 6 exchanges)
GET /api/global-metrics                 (Fear & greed, BTC dom, etc)
GET /api/admin/activity-logs            (Activity stream)
GET /api/morio/elders/overview          (Elder council status)
GET /api/morio/treasury/overview        (Treasury metrics)
GET /api/morio/governance/overview      (Governance metrics)
GET /api/morio/community/overview       (Community metrics)

WebSocket Message Types:

{
  type: 'PLATFORM_METRICS',
  data: { tvl, assetCount, memberCount, healthScores }
}

{
  type: 'DAO_METRICS',
  data: { daoId, members, treasury, governance, health }
}

{
  type: 'OPPORTUNITY',
  data: { type, title, gain, risk, timestamp, actions }
}

{
  type: 'MARKET_DATA',
  data: { pair, exchanges: [{name, price, volume, spread}] }
}

{
  type: 'GLOBAL_METRICS',
  data: { fearGreed, btcDom, marketCap, volume, gasPrice, topMovers }
}

{
  type: 'ACTIVITY',
  data: { type, daoId, user, description, timestamp }
}
```

---

## 📋 IMPLEMENTATION CHECKLIST

- [ ] Create `UnifiedDashboard.tsx` page component
- [ ] Build `PlatformOverviewCard` component
- [ ] Build `DaoCardTree` component (expandable)
- [ ] Build `UserBalanceAggregation` component (pie chart)
- [ ] Build `AssetListTable` component (sortable, filterable)
- [ ] Build `RealtimeActivityFeed` component (virtualized)
- [ ] Build feed item sub-components:
  - [ ] `OpportunityCard` (with priority badges)
  - [ ] `DefiOpportunityCard` (with APY display)
  - [ ] `ArbitrageCard` (with execution buttons)
  - [ ] `MarketDataCard` (with exchange comparison)
  - [ ] `GlobalMetricsCard` (with gauges)
  - [ ] `ActivityCard` (with reputation impact)
- [ ] Setup WebSocket connection (`useWebSocket` hook)
- [ ] Setup HTTP polling fallback
- [ ] Create mock data generator (for testing)
- [ ] Add real-time update animations
- [ ] Add responsive design (mobile, tablet, desktop)
- [ ] Add filtering and sorting
- [ ] Add settings/preferences panel
- [ ] Test with real APIs
- [ ] Performance optimization (virtualization, memoization)

---

**Ready to implement! This is your Tree View Dashboard with Cards, Real-time Updates, and Enriched Activity Feed.** 🚀

*Design: Complete | Status: Ready for Code Implementation | Quality: Production Grade*
