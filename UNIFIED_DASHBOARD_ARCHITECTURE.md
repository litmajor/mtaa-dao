# Tree View Dashboard - Architecture & Visual Design

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                ┌─────────────┼─────────────┐
                │             │             │
         ┌──────▼───┐   ┌────▼─────┐  ┌───▼─────┐
         │   HTTP   │   │ WebSocket │  │ Polling │
         │  Fetch   │   │  (Primary)│  │(Fallback)
         └──────┬───┘   └────┬─────┘  └───┬─────┘
                │             │             │
    ┌───────────▼─────────────▼─────────────▼─────────────┐
    │   UnifiedDashboardData (React State)                │
    │  ┌──────────┐  ┌─────────┐  ┌────────────────────┐ │
    │  │ Platform │  │  DAOs   │  │ Opportunities &    │ │
    │  │ Metrics  │  │ Balances│  │ Activities & Assets│ │
    │  └──────────┘  └─────────┘  └────────────────────┘ │
    └────────────┬────────────────────────────────────────┘
                 │
    ┌────────────▼────────────────────────────────────────┐
    │         UnifiedDashboardPage Component              │
    │  ┌─────────────────────────────────────────────┐   │
    │  │         Header & Controls                    │   │
    │  │ (Search, Filters, Status, Refresh)         │   │
    │  └──────────────────┬──────────────────────────┘   │
    │  ┌──────────────────▼──────────────────────────┐   │
    │  │     PlatformOverviewCard                     │   │
    │  │  (TVL, Health Scores, Asset Count)         │   │
    │  └──────────────────┬──────────────────────────┘   │
    │  ┌──────────────────▼──────────────────────────┐   │
    │  │  DaoTreeSection  │ UserBalanceSection      │   │
    │  │  (3 col)         │ (1 col)                  │   │
    │  │  • DAO Cards     │ • Net Worth              │   │
    │  │  • Metrics       │ • Pie Chart              │   │
    │  │  • Expandable    │ • Allocation             │   │
    │  └──────────────────┴──────────────────────────┘   │
    │  ┌─────────────────────────────────────────────┐   │
    │  │     AssetListTable                          │   │
    │  │  (Sortable, Searchable, Paginated)        │   │
    │  └──────────────────┬──────────────────────────┘   │
    │  ┌──────────────────▼──────────────────────────┐   │
    │  │    RealtimeActivityFeed                     │   │
    │  │  (6 Card Types, Multi-Tab, Real-time)      │   │
    │  └─────────────────────────────────────────────┘   │
    │  ┌─────────────────────────────────────────────┐   │
    │  │         Footer (Sync Info)                   │   │
    │  └─────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    Backend Services                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  REST APIs (for initial page load):                             │
│  ├── GET /api/dashboard/metrics           → Platform overview   │
│  ├── GET /api/elders/kaizen/all-metrics   → DAO metrics         │
│  ├── GET /api/user/balances               → User balances       │
│  ├── GET /api/user/assets                 → Assets              │
│  ├── GET /api/elders/kaizen/opportunities → Opportunities       │
│  └── GET /api/admin/activity-logs         → Activities          │
│                                                                   │
│  WebSocket Stream (for real-time updates):                      │
│  └── wss://api.mtaadao.io/ws                                    │
│      ├── PLATFORM_METRICS (every 30s)                           │
│      ├── DAO_METRICS (when changes)                             │
│      ├── OPPORTUNITY (real-time)                                │
│      ├── MARKET_DATA (every 5-30s)                              │
│      ├── GLOBAL_METRICS (every 60s)                             │
│      └── ACTIVITY (real-time)                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```
UnifiedDashboardPage (280 lines)
│
├── Header Section
│   ├── Title & Description
│   ├── Connection Status Badge
│   ├── Refresh & Settings Buttons
│   ├── Search Input
│   ├── Timeframe Filter Dropdown
│   └── Live/Paused Toggle
│
├── PlatformOverviewCard (180 lines)
│   ├── Stats Grid
│   │   ├── TVL Card
│   │   ├── Asset Count Card
│   │   ├── DAO Count Card
│   │   └── Member Count Card
│   └── Health Scores Grid
│       ├── Treasury Score Bar
│       ├── Liquidity Score Bar
│       ├── Governance Score Bar
│       ├── Security Score Bar
│       └── Adoption Score Bar
│
├── Two-Column Layout
│   ├── Left (2/3 width) → DaoTreeSection (320 lines)
│   │   ├── Section Header with "Create New DAO" button
│   │   └── DAO Cards (collapsible)
│   │       ├── DAO Header (with chevron toggle)
│   │       ├── Name & ID
│   │       ├── Health Score Badge
│   │       ├── Metrics Grid
│   │       │   ├── Members Card
│   │       │   ├── Treasury Card
│   │       │   ├── Governance Card
│   │       │   └── Your Balance Card
│   │       ├── Your Role Section
│   │       └── Expanded Details (hidden by default)
│   │           ├── Treasury Trend Bar
│   │           ├── Approval Rate Bar
│   │           └── Action Buttons (4 buttons)
│   │
│   └── Right (1/3 width) → UserBalanceSection (380 lines)
│       ├── Total Net Worth Card
│       │   ├── Dollar Amount (large)
│       │   └── Breakdown (DAO, Staking, Pools)
│       ├── Allocation Breakdown Card
│       │   ├── List of DAOs with percentages
│       │   └── Color-coded dots
│       ├── Growth Card (30-day change)
│       │   ├── Percentage with arrow
│       │   └── Dollar amount change
│       └── Assets & Positions Grid
│           ├── Staking Card
│           │   ├── Amount
│           │   └── APY + Rewards
│           ├── Liquidity Pools Card
│           │   ├── Amount
│           │   └── APY + Fees
│           └── Wallet Card
│               ├── Amount
│               └── DAO count & last update
│
├── AssetListTable (450 lines)
│   ├── Header Section
│   │   ├── "Assets" Title
│   │   └── Export Button
│   ├── Filter Bar
│   │   ├── Search Input
│   │   ├── Location Filter Dropdown
│   │   └── Items Per Page Selector
│   ├── Summary Row (assets count, total value)
│   ├── Table
│   │   ├── Header Row (sortable columns)
│   │   │   ├── Asset (symbol + icon)
│   │   │   ├── Price
│   │   │   ├── Amount
│   │   │   ├── Value
│   │   │   ├── 24h Change
│   │   │   ├── Location
│   │   │   └── Actions (3 buttons)
│   │   └── Data Rows (repeating for each asset)
│   │       └── Cells matching headers
│   └── Pagination Controls
│       ├── Previous Button
│       ├── Page Number Buttons
│       ├── Next Button
│       └── Page Info (X of Y)
│
└── RealtimeActivityFeed (600 lines)
    ├── Header with Title & Pause Toggle
    ├── Tab Filters (6 tabs)
    │   ├── All
    │   ├── Opportunities
    │   ├── DeFi
    │   ├── Arbitrage
    │   ├── Markets
    │   └── Global
    └── Activity Items (sorted by timestamp, newest first)
        ├── OpportunityCard (if type = opportunity)
        │   ├── Icon & Priority Badge
        │   ├── Title
        │   ├── Description
        │   ├── Risk Badge
        │   ├── DAO Name
        │   ├── Gain Percentage
        │   └── Timestamp
        │
        ├── DefiCard (if type = defi)
        │   ├── Zap Icon
        │   ├── Pool Name & Chain
        │   ├── APY Display
        │   ├── TVL Display
        │   └── Your Potential Display
        │
        ├── ArbitrageCard (if type = arbitrage)
        │   ├── Trending Icon
        │   ├── Asset Symbol
        │   ├── Buy/Sell Venues
        │   ├── Buy Price
        │   ├── Sell Price
        │   └── Profit Percentage
        │
        ├── MarketDataCard (if type = market)
        │   ├── Chart Icon
        │   ├── Asset Symbol & Exchange
        │   ├── Price
        │   ├── 24h Change
        │   └── Volume
        │
        ├── GlobalMetricsCard (if type = global)
        │   ├── Globe Icon
        │   ├── Metric Name
        │   ├── Description
        │   ├── Value
        │   └── Change Percentage
        │
        └── ActivityCard (if type = activity)
            ├── Activity Icon
            ├── DAO Name with Status Icon
            ├── Member Name + Action
            ├── Description
            └── Timestamp
```

---

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────┐
│         User navigates to /dashboard                   │
└──────────────────┬─────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│  UnifiedDashboardPage mounts                           │
│  • Calls useUnifiedDashboardData() hook               │
│  • Establishes useWebSocket() connection              │
└──────────────────┬─────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
    HTTP Fetch           WebSocket Connect
    (6 parallel)         to wss://api.../ws
        │                     │
        ├─────────────┬───────┤
        │             │       │
    Platform     DAOs  + User Balances
    Assets       Opps  + Activities
        │             │       │
        └─────────────┴───────┘
                │
                ▼
    ┌───────────────────────┐
    │ UnifiedDashboardData  │ (React State)
    │ Platform + DAOs +     │
    │ Balances + Assets +   │
    │ Opportunities +       │
    │ Activities            │
    └───────────┬───────────┘
                │
    ┌───────────▼────────────────────┐
    │ Components consume data:        │
    │                                 │
    │ • PlatformOverviewCard          │
    │ • DaoTreeSection                │
    │ • UserBalanceSection            │
    │ • AssetListTable                │
    │ • RealtimeActivityFeed          │
    └─────────────┬────────────────────┘
                  │
                  ▼
          ┌───────────────┐
          │   Render UI   │
          │  (Dark Mode)  │
          └───────────────┘


        ┌─────────────────────────────────────────┐
        │   WebSocket Real-time Update Loop      │
        └─────────────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
    Receive message                   Pause/Resume
    from backend                      (user toggle)
        │                                   │
        ▼                                   ▼
    Parse JSON                         Update state
    (error handling)                       │
        │                                   ▼
        ▼                              Update countdown
    Update state                       timer (30s)
    by message type:                       │
    - PLATFORM_METRICS                 (if not paused)
    - DAO_METRICS                      Update
    - OPPORTUNITY                      Components
    - MARKET_DATA
    - GLOBAL_METRICS
    - ACTIVITY
        │
        ▼
    Trigger re-render
    for affected components
        │
        ▼
    Display updates
    (smooth animations)
```

---

## State Management Flow

```
UnifiedDashboardPage Component State:

searchQuery (string)
  ├── Used by: DaoTreeSection (filter DAOs)
  └── Updated by: Search input onChange

filterTimeframe (string: '7d'|'30d'|'90d'|'custom')
  ├── Used by: useUnifiedDashboardData (API call parameter)
  └── Updated by: Timeframe dropdown onChange

isPaused (boolean)
  ├── Used by: useWebSocket (enable/disable)
  ├── Used by: Timer countdown logic
  └── Updated by: Live/Paused toggle button

timeUntilNextUpdate (number)
  ├── Used by: Status bar display
  └── Updated by: useEffect interval (1s tick)

Connected Data (from useUnifiedDashboardData):

data.platform: PlatformMetrics
  └── Consumed by: PlatformOverviewCard

data.daos: Dao[]
  └── Consumed by: DaoTreeSection, RealtimeActivityFeed

data.userBalances: Record<daoId, number>
  ├── Consumed by: DaoTreeSection (your balance per DAO)
  └── Consumed by: UserBalanceSection (aggregated)

data.assets: Asset[]
  ├── Consumed by: AssetListTable
  └── Consumed by: UserBalanceSection (values)

data.opportunities: Opportunity[]
  └── Consumed by: RealtimeActivityFeed

data.activities: ActivityLog[]
  └── Consumed by: RealtimeActivityFeed

data.daoNames: Record<daoId, name>
  └── Consumed by: UserBalanceSection (pie chart labels)

data.totalNetWorth: number
  └── Consumed by: UserBalanceSection

data.stakingAmount: number
  └── Consumed by: UserBalanceSection

data.poolAmount: number
  └── Consumed by: UserBalanceSection


Connected Data (from useWebSocket):

connected: boolean
  ├── Used by: Connection status indicator
  └── Updated by: WebSocket onopen/onclose

reconnecting: boolean
  └── Used by: Connection status indicator

messages: WebSocketMessage[]
  └── Watched by: useEffect for message processing
      ├── Updates data when new messages arrive
      └── Triggers component re-renders
```

---

## Color Scheme

```
Background Colors:
├── slate-900 (#0f172a) - Main background
├── slate-800 (#1e293b) - Cards & panels
├── slate-700 (#334155) - Hover states
└── slate-600 (#475569) - Borders

Status Colors (Health Scores):
├── Emerald (#10b981) - Good (80+)
├── Amber (#f59e0b) - Warning (60-79)
└── Red (#ef4444) - Critical (0-59)

Accent Colors:
├── Blue (#3b82f6) - Primary actions, charts
├── Green (#10b981) - Positive changes, gains
├── Red (#ef4444) - Negative changes, losses
├── Purple (#8b5cf6) - Governance
├── Cyan (#06b6d4) - Global metrics
└── Yellow/Amber (#f59e0b) - Alerts

Text Colors:
├── White (#f8fafc) - Primary text
├── slate-300 (#cbd5e1) - Secondary text
└── slate-400 (#94a3b8) - Tertiary text
```

---

## Responsive Breakpoints

```
Mobile (0px - 640px):
├── Single column layout
├── Full-width cards (stacked)
├── Horizontal scrollable tables
├── Pie chart 200px
└── Font sizes: sm/base

Tablet (641px - 1024px):
├── 2-column layout (DAO tree + balance)
├── Table columns hidden/compressed
├── Pie chart 300px
└── Font sizes: base/lg

Desktop (1025px+):
├── 3-column layout (DAO tree 2/3 + balance 1/3)
├── Full table with all columns
├── Pie chart 400px
└── Font sizes: lg/xl
```

---

## Real-time Message Handling

```
┌─────────────────────────────┐
│   WebSocket Message Arrives  │
└──────────────┬──────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Parse JSON Message   │
    │ Extract:             │
    │ - type               │
    │ - timestamp          │
    │ - data               │
    └──────────┬───────────┘
               │
    ┌──────────▼──────────────────────────────────┐
    │ Switch on Message Type:                      │
    └──────────┬──────────────────────────────────┘
               │
    ┌──────────┼──────────┬──────────┬──────────┬────────────┐
    │          │          │          │          │            │
    ▼          ▼          ▼          ▼          ▼            ▼
PLATFORM   DAO_     OPPORT-  MARKET_  GLOBAL_  ACTIVITY
METRICS    METRICS  UNITY    DATA     METRICS
    │          │          │          │          │            │
    ├─update   ├─update   ├─add new  ├─update  ├─update    ├─add
    │platform  │DAO in    │opportunity to     │global     new
    │data      │tree      │feed      │prices  │metrics    activity
    │          │          │          │        │           │
    └──────────┴──────────┴──────────┴────────┴────────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │ Trigger Re-render   │
          │ (Only affected      │
          │  components)        │
          └─────────────────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │ Animate Updates     │
          │ (Tailwind trans)    │
          └─────────────────────┘
```

---

## Error Handling Flow

```
┌────────────────────────────┐
│   API Call or Message      │
│   Processing               │
└────────────┬───────────────┘
             │
    ┌────────▼────────┐
    │ Try-Catch Block │
    └────────┬────────┘
             │
    ┌────────▼────────────────────┐
    │ Error Occurred?             │
    └────────┬──────────┬─────────┘
             │ Yes      │ No
             ▼          ▼
        Log Error   Update State
        Show UI     Render UI
        Error       Smooth
        Message     Animation
             │
    ┌────────▼────────────────────┐
    │ Fallback Behavior:          │
    │ • Use cached data           │
    │ • Show retry button         │
    │ • Connection indicator      │
    │ • Disable affected UI       │
    └────────────────────────────┘
```

---

## Performance Optimization Strategy

```
Initial Page Load:
  ├── 1. Parse HTML/CSS (browser)
  ├── 2. Load JS bundle (async)
  ├── 3. React hydration
  ├── 4. Component mount (useEffect)
  ├── 5. HTTP API calls (parallel)
  └── 6. First Paint (with mock/cached data)
         └─ Real data from API arrives
             └─ Second paint (updated)

Real-time Updates:
  ├── WebSocket message arrives
  ├── Parse JSON (fast)
  ├── Update React state (fast)
  ├── Components re-render (only affected)
  ├── Smooth CSS transitions
  └── No janky animations

Activity Feed:
  ├── Virtual scrolling (react-window)
  ├── Only 10-20 items rendered at time
  ├── Maintains message history (last 100)
  ├── Lazy load on scroll
  └── Smooth scrolling animations
```

---

This architecture ensures:
✅ Responsive, performant, real-time dashboard  
✅ Works offline with mock data  
✅ Scales to large datasets  
✅ Accessible and mobile-friendly  
✅ Easy to maintain and extend  
