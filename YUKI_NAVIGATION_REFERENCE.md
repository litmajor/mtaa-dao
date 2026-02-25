# Yuki Navigation & Component Reference

## 🗺️ YukiDashboard Tab Structure

```
YukiDashboard (Main Hub)
├── 🏠 Overview
│   ├── Top Stats (ETH, USDC, Volume, Arbitrage Ops)
│   ├── Trading Opportunities (Arbitrage, Liquidation)
│   └── Recent Alerts (Price breaks, Risk alerts, Strategy closes)
│
├── ⚡ Execute
│   ├── Quick Actions (Swap, Bridge, Move, Flash Loan)
│   └── Quick Swap Form (From → To → Amount → Preview)
│
├── 🤖 Strategies
│   ├── List of active user strategies
│   ├── Each strategy shows: Name, Blocks, Status, P&L, Trades
│   └── New Strategy button → launches VisualStrategyBuilder
│
├── 🛒 Marketplace (NEW)
│   ├── Search & Filter Controls
│   ├── Strategy Grid (cards with metrics)
│   ├── Detail Panel (full strategy info)
│   └── Copy Strategy → Amara Upsell CTA
│
├── 🏦 Exchanges (NEW)
│   ├── Summary Cards (Total Balance, P&L, Positions, Liquidation Risks)
│   ├── Liquidation Risk Alerts
│   ├── Exchange Cards (Kraken, Coinbase, Bybit)
│   │   ├── Status & API key status
│   │   ├── Balance display with hide/show
│   │   ├── Open positions with P&L
│   │   └── Action buttons (View Orders, Add API Key, Delete)
│   └── Smart Order Routing Preview
│
└── 📈 Analytics
    ├── Portfolio Performance Chart
    └── Metrics (Total Profit, Win Rate, Max Drawdown)
```

---

## 📱 Component Details

### 1️⃣ **VisualStrategyBuilder.tsx**
**Location**: Referenced from Strategies tab → "New Strategy" button
**Purpose**: Build trading strategies without coding
**Key Features**:
- 5 Block Types (Condition, Action, Logic, Risk, Execution)
- Drag-and-drop from left palette to center canvas
- Right sidebar for block configuration
- Deploy button to save/activate strategy
- JSON export for developers

**Data Flow**:
```
User drags Condition block (price > 2800)
↓
Drops on canvas
↓
Clicks block to open config panel
↓
Sets parameters (symbol: ETH, operator: >, value: 2800)
↓
Connects to Action block (sell)
↓
Clicks Deploy
↓
Strategy saved & monitoring begins
```

### 2️⃣ **StrategyMarketplace.tsx**
**Location**: Marketplace tab in YukiDashboard
**Purpose**: Discover, copy, and monetize trading strategies
**Key Features**:
- 3 mock strategies with realistic data
- Filter by: All, Free, Paid, My Copies
- Sort by: Return (1y), Rating, Followers
- Search by name/creator
- Strategy cards show: Icon, name, creator, badge, stats
- Detail panel on right shows full metrics

**User Actions**:
```
Browse strategies
↓
Click "Copy Strategy" button
↓
Strategy duplicated to user's account
↓
See Amara upsell: "Upgrade for deeper education from creator"
↓
Click "Upgrade" → Navigate to Amara
```

**Mock Strategy Data**:
- **ETH Mean Reversion**: Free, +127% return, 68% win rate
- **Flash Loan Arbitrage**: 20% profit-share, +189% return, 85% win rate
- **Yield Farming Optimizer**: $99/month, +67% return, 62% win rate

### 3️⃣ **CexManager.tsx**
**Location**: Exchanges tab in YukiDashboard
**Purpose**: Manage connected exchange accounts & positions
**Key Features**:
- 3 mock exchanges (Kraken, Coinbase, Bybit)
- Summary stats: Total balance, P&L, positions, liquidation risks
- Liquidation risk alerts (red banner)
- Per-exchange: Balance visibility toggle, positions list, action buttons
- Smart order routing preview example

**Exchange Cards Show**:
- Exchange name, icon, connection status, API key status
- Balance display with hide/show toggle
- Balances by token (USD, ETH, BTC, USDC, etc.)
- Open positions with entry price, current price, P&L
- For perpetuals: Leverage, liquidation price, funding rate
- Liquidation risk % for positions within 20% of liq price
- Action buttons: View Orders, Add API Key, Delete exchange

**Smart Order Routing Example**:
```
User wants to buy 10 ETH
↓
Smart router compares:
  - Uniswap V3: $2,845 + $45 gas = $28,495
  - Kraken: $2,840 + $28.40 fee = $28,428 ✓ BEST
  - Coinbase: $2,842 + fee = $28,450
↓
System recommends Kraken (saves $67)
↓
User clicks "Execute Best Route"
↓
Order fills via Kraken
```

### 4️⃣ **YukiDashboard.tsx (Main Hub)**
**Location**: Main trading page
**Purpose**: Central hub for all trading activities
**Key Features**:
- 6 tabs for different workflows
- Tab navigation at top
- Active tab styled with blue border
- Content sections mount/unmount based on activeTab state

**State Management**:
```typescript
const [activeTab, setActiveTab] = useState<Tab>('overview');

// Tabs update state on click
onClick={() => setActiveTab('marketplace')}

// Content renders conditionally
{activeTab === 'marketplace' && <StrategyMarketplace />}
{activeTab === 'exchanges' && <CexManager />}
```

---

## 🔄 Data Flows

### Flow 1: Market Data (Overview Tab)
```
YukiDashboard (activeTab === 'overview')
  ↓
OverviewSection component
  ├─ Fetches market stats (mock: ETH $2,847)
  ├─ Displays in grid (4 cards)
  ├─ Shows opportunities (Arbitrage, Liquidation)
  └─ Shows alerts (Price breaks, Risk, Strategy closes)
```

### Flow 2: Strategy Copy (Marketplace Tab)
```
StrategyMarketplace component
  ├─ Loads mock strategies into state
  ├─ User clicks "Copy Strategy"
  ├─ handleCopyStrategy() triggered
  ├─ Strategy added to user's list
  ├─ Detail panel shows Amara upsell CTA
  └─ User clicks "Upgrade to Amara" → Navigation triggered
```

### Flow 3: Position Monitoring (Exchanges Tab)
```
CexManager component
  ├─ Loads mock exchanges (Kraken, Coinbase, Bybit)
  ├─ Calculates aggregated stats
  │  ├─ totalBalance = $165,000
  │  ├─ totalPnL = $890
  │  ├─ allPositions = 8 positions
  │  └─ liquidationRisks = 1 position at risk
  ├─ Renders alert if liquidation risks > 0
  ├─ Renders exchange cards with positions
  ├─ User toggles visibility on balance
  └─ Smart order routing preview shows best execution
```

---

## 🎨 Styling & Colors

### Theme
- **Background**: Slate-900 (dark gray, nearly black)
- **Cards**: Slate-800 (slightly lighter)
- **Borders**: Slate-700 (subtle grid lines)
- **Text**: White on dark backgrounds

### Status Indicators
- **Active/Connected**: Green (bg-green-600/20, text-green-300)
- **Positive Metrics**: Green (gains, win rate, active strategies)
- **Risk/Alert**: Red (losses, liquidation risks, errors)
- **Warning**: Orange (funding rates, expired keys, low margin ratio)
- **Info**: Blue (active tab, current price, scheduled executions)

### Component Spacing
- Cards: `p-4` to `p-6` (padding)
- Grids: `gap-4` between columns (16px)
- Sections: `space-y-6` vertical spacing
- Responsive: `grid-cols-1 md:grid-cols-4` (mobile → desktop)

---

## 📡 API Endpoints (When Integrated)

```typescript
// Marketplace strategies
GET /api/yuki/marketplace/strategies
POST /api/yuki/marketplace/strategies/:id/copy
GET /api/yuki/marketplace/strategies/:id/details

// Exchanges
GET /api/yuki/exchanges
POST /api/yuki/exchanges
DELETE /api/yuki/exchanges/:id
GET /api/yuki/exchanges/:id/positions
GET /api/yuki/exchanges/:id/balances

// Smart order routing
POST /api/yuki/routing/compare?symbol=ETH&amount=10
POST /api/yuki/routing/execute

// Strategies
GET /api/yuki/strategies (user's strategies)
POST /api/yuki/strategies
PUT /api/yuki/strategies/:id
DELETE /api/yuki/strategies/:id
POST /api/yuki/strategies/:id/deploy
```

---

## 🚀 Quick Start for Developers

### To mount Yuki in your app:
```typescript
import YukiDashboard from './components/trading/YukiDashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/yuki" element={<YukiDashboard />} />
    </Routes>
  );
}
```

### To use individual components:
```typescript
// Visual Strategy Builder
import VisualStrategyBuilder from './components/trading/VisualStrategyBuilder';
<VisualStrategyBuilder onDeploy={(strategy) => saveStrategy(strategy)} />

// Strategy Marketplace
import StrategyMarketplace from './components/trading/StrategyMarketplace';
<StrategyMarketplace onCopy={(strategyId) => copyStrategy(strategyId)} />

// CEX Manager
import CexManager from './components/trading/CexManager';
<CexManager onExchangeAdd={(exchange) => addExchange(exchange)} />
```

### To replace mock data:
Each component has a `MOCK_*` constant at the top. Replace with API calls:
```typescript
// Before:
const [strategies, setStrategies] = useState(MOCK_STRATEGIES);

// After:
useEffect(() => {
  fetch('/api/yuki/marketplace/strategies')
    .then(res => res.json())
    .then(data => setStrategies(data));
}, []);
```

---

## 📚 Related Documentation

- [YUKI_TRADING_QUICK_START.md](YUKI_TRADING_QUICK_START.md) - Feature overview & roadmap
- [YUKI_API_REFERENCE.md](YUKI_API_REFERENCE.md) - Detailed API documentation
- [OKEDI_DASHBOARD_QUICK_REFERENCE.md](OKEDI_DASHBOARD_QUICK_REFERENCE.md) - Okedi wallet integration
- [YUKI_IMPLEMENTATION_COMPLETE.md](YUKI_IMPLEMENTATION_COMPLETE.md) - Implementation details & next steps

---

**Last Updated**: January 29, 2026  
**Components**: 4 (Dashboard, Builder, Marketplace, Exchanges)  
**Status**: ✅ Complete & Ready for Integration
