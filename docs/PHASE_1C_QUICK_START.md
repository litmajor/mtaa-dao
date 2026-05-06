# 🎯 PHASE 1C - YUKI DASHBOARD QUICK START

**Status:** Ready to Build  
**Architecture:** Scroll-based with optional sidebar (Power Users)  
**Components:** 8 sections + 15+ sub-components  
**Endpoints:** 20 (all ready on backend)  
**Est. Time:** 4-5 days

---

## 🎮 What You're Building

**YUKI Dashboard** = Single-page scroll design with:

```
┌────────────────────────────────────────┐
│ Header (Sticky)                        │
│ Balance + Quick Stats                  │
├────────────────────────────────────────┤
│ ⚡ LIVE OPPORTUNITIES (Always!)       │ ← Visible from start
│ (Most important - top)                 │
├────────────────────────────────────────┤
│ ▼ Watchlist (Expanded)                 │
│ ▶ CEX Markets (Collapsed)              │
│ ▶ DEX Swaps (Collapsed)                │
│ ▶ Active Strategies (Collapsed)        │
│ ▶ Alerts & Signals (Collapsed)         │
│ ▶ Charts & Portfolio (Collapsed)       │
│                                        │
│ Just scroll to see everything!         │
│ No tabs needed.                        │
└────────────────────────────────────────┘

DESKTOP VIEW (with Pro Sidebar):
┌──────────────┬────────────────────────┐
│ SIDEBAR      │ MAIN CONTENT (scroll)  │
│ Quick Jump:  │ (same as above)        │
│ [⚡ Opps]   │                        │
│ [⭐ Watch]  │                        │
│ [🏦 CEX]    │                        │
│ [🤖 Strat]  │                        │
│ [🔔 Alerts] │                        │
│              │                        │
│ Click items  │ Main view auto-scrolls │
│ to jump      │ to section             │
└──────────────┴────────────────────────┘
```

---

## ✨ The 8 Sections (NOT TABS)

| Section | Visible | Purpose | Interaction |
|---------|---------|---------|-------------|
| **Balance Header** | 🟢 Always Sticky | Show trading balance + quick stats | Deposit/transfer buttons |
| **Live Opportunities** | 🟢 Always Visible | Arbitrage alerts + profit opportunities | Execute trades directly |
| **Watchlist** | 🟢 Expanded by Default | Saved crypto pairs with prices | Add/remove pairs |
| **CEX Markets** | 🔴 Collapsed | Exchange connections & balances | Expand to manage |
| **DEX Swaps** | 🔴 Collapsed | Token swap interface & builder | Expand to swap |
| **Active Strategies** | 🔴 Collapsed | Running trading bots/automation | Expand to modify |
| **Charts** | 🔴 Collapsed | Candlestick charts + indicators | Expand for analysis |
| **Portfolio** | 🔴 Collapsed | Holdings, allocation, performance | Expand for details |

**Key Difference:** Instead of clicking tabs, users just **scroll**. Sections they don't need right now are collapsed. Power users can enable sidebar to jump directly.

---

## 🏗️ Build Plan - Scroll-Based Architecture

### Phase 1: Foundation (Day 1)

**Step 1: Main Component - YukiDashboard.tsx**

```typescript
// Scroll-based layout (NO TABS)
export default function YukiDashboard() {
  const [expandedSections, setExpandedSections] = useState({
    opportunities: true,      // Always visible
    watchlist: true,          // Expanded by default
    cexMarkets: false,        // Collapsed
    dexSwaps: false,
    strategies: false,
    charts: false,
    portfolio: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="w-full">
      {/* Header (Sticky) */}
      <div className="sticky top-0 z-40 bg-white border-b">
        <BalanceHeader />
        <QuickStats />
      </div>

      {/* Main Content - Just Scroll! */}
      <div className="max-w-6xl mx-auto px-4 space-y-6 pb-12">
        
        {/* Section 1: Live Opportunities (Always Visible) */}
        <OpportunitiesSection />
        
        {/* Section 2: Watchlist (Expanded) */}
        <CollapsibleSection 
          title="Watchlist"
          isExpanded={expandedSections.watchlist}
          onToggle={() => toggleSection('watchlist')}
        >
          <WatchlistSection />
        </CollapsibleSection>
        
        {/* Section 3: CEX Markets (Collapsed) */}
        <CollapsibleSection 
          title="CEX Markets"
          isExpanded={expandedSections.cexMarkets}
          onToggle={() => toggleSection('cexMarkets')}
        >
          <CEXMarketsSection />
        </CollapsibleSection>
        
        {/* Section 4: DEX Swaps (Collapsed) */}
        <CollapsibleSection 
          title="DEX Swaps"
          isExpanded={expandedSections.dexSwaps}
          onToggle={() => toggleSection('dexSwaps')}
        >
          <DEXSwapSection />
        </CollapsibleSection>
        
        {/* Section 5: Active Strategies (Collapsed) */}
        <CollapsibleSection 
          title="Active Strategies"
          isExpanded={expandedSections.strategies}
          onToggle={() => toggleSection('strategies')}
        >
          <StrategiesSection />
        </CollapsibleSection>
        
        {/* Section 6: Charts (Collapsed) */}
        <CollapsibleSection 
          title="Charts & Analysis"
          isExpanded={expandedSections.charts}
          onToggle={() => toggleSection('charts')}
        >
          <ChartsSection />
        </CollapsibleSection>
        
        {/* Section 7: Portfolio (Collapsed) */}
        <CollapsibleSection 
          title="Portfolio Overview"
          isExpanded={expandedSections.portfolio}
          onToggle={() => toggleSection('portfolio')}
        >
          <PortfolioSection />
        </CollapsibleSection>
      </div>

      {/* Optional: Pro Sidebar (Desktop Only) */}
      {isMobile === false && proModeEnabled && (
        <ProSidebar sections={expandedSections} onJump={jumpToSection} />
      )}
    </div>
  );
}
```

**Step 2: Collapsible Section Component**

```typescript
// components/trading/CollapsibleSection.tsx
export function CollapsibleSection({ 
  title, 
  isExpanded, 
  onToggle, 
  children 
}) {
  return (
    <div className="border rounded-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <span>{isExpanded ? '▼' : '▶'}</span>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t p-4">
          {children}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Routing**
```typescript
// In App.tsx
const YukiDashboard = lazy(() => import('./components/trading/YukiDashboard'));

// Add route
<Route path="yuki-dashboard" element={<YukiDashboard />} />
```

---

### Phase 2: Balance Header & Quick Stats (Day 1-2)

**BalanceHeader.tsx**
```typescript
export function BalanceHeader() {
  const [balance, setBalance] = useState(8200);
  const [todayGain, setTodayGain] = useState(450);

  useEffect(() => {
    // Fetch real balance from API
    fetchTradingBalance();
  }, []);

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg">
      <h1 className="text-3xl font-bold mb-2">
        Trading Balance: ${balance.toLocaleString()}
      </h1>
      <p className="text-blue-100 mb-4">
        Today's Gain: <span className="text-green-200 font-bold">+${todayGain}</span>
        | Win Rate: 78% | Active Strategies: 3
      </p>
      <div className="flex gap-3">
        <Button variant="secondary">[Transfer Profit to OKEDI →]</Button>
        <Button variant="secondary">[+ Deposit]</Button>
      </div>
    </div>
  );
}
```

**QuickStats.tsx**
```typescript
export function QuickStats() {
  const [stats, setStats] = useState({
    volume24h: '2.4B',
    topGain: '+24.5%',
    topLoss: '-8.2%',
    avgFee: '0.05%'
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
      <StatCard label="24h Volume" value={stats.volume24h} />
      <StatCard label="Top Gainer" value={stats.topGain} color="green" />
      <StatCard label="Top Loser" value={stats.topLoss} color="red" />
      <StatCard label="Avg Fee" value={stats.avgFee} />
    </div>
  );
}
```

---

### Phase 3: Live Opportunities (Day 2)

**OpportunitiesSection.tsx**
```typescript
export function OpportunitiesSection() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch opportunities from API
    const fetchOps = async () => {
      const res = await fetch('/api/yuki/market/opportunities');
      setOpportunities(await res.json());
      setLoading(false);
    };
    
    fetchOps();
    // Refresh every 3 seconds for real-time updates
    const interval = setInterval(fetchOps, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading opportunities...</div>;

  return (
    <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">⚡</span>
        <h2 className="text-xl font-bold text-orange-900">
          Live Opportunities
        </h2>
        <span className="ml-auto text-xs bg-orange-200 px-2 py-1 rounded">
          Real-time detected
        </span>
      </div>

      <div className="space-y-4">
        {opportunities.slice(0, 5).map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}
      </div>

      {opportunities.length > 5 && (
        <div className="mt-4 pt-4 border-t border-orange-200">
          <Button variant="outline" className="w-full">
            View {opportunities.length - 5} More Opportunities →
          </Button>
        </div>
      )}
    </div>
  );
}

function OpportunityCard({ opportunity }) {
  return (
    <div className="bg-white rounded-lg p-4 border-l-4 border-orange-400">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg">{opportunity.title}</h3>
        <span className="text-xs font-bold text-green-600">
          +{opportunity.profit}%
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-3">{opportunity.description}</p>
      <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
        <div>
          <span className="text-gray-500">Profit:</span>
          <div className="font-bold">${opportunity.profitAmount}</div>
        </div>
        <div>
          <span className="text-gray-500">Risk:</span>
          <div className="font-bold text-orange-600">{opportunity.risk}</div>
        </div>
        <div>
          <span className="text-gray-500">Confidence:</span>
          <div className="font-bold text-green-600">{opportunity.confidence}%</div>
        </div>
      </div>
      <Button className="w-full">Execute Now</Button>
    </div>
  );
}
```

---

### Phase 4: Other Sections (Days 3-5)

Build similar components for:
- **WatchlistSection.tsx** - Token prices, add/remove
- **CEXMarketsSection.tsx** - Exchange balances, trading history
- **DEXSwapSection.tsx** - Token selector, swap preview, execute
- **StrategiesSection.tsx** - List strategies, create new, modify
- **ChartsSection.tsx** - Recharts candlesticks + indicators
- **PortfolioSection.tsx** - Holdings table, allocation pie chart

Each follows same pattern:
1. Fetch data from API
2. Display in collapsible container
3. Show loading/error states
4. Real-time refresh where needed

---

### Phase 5: Pro Mode & Sidebar (Day 5 - Optional)

**ProSidebar.tsx** (Desktop only)
```typescript
export function ProSidebar({ sections, onJump }) {
  const [proModeEnabled, setProModeEnabled] = useState(
    localStorage.getItem('yuki_pro_mode') === 'true'
  );

  if (!proModeEnabled) return null;

  return (
    <aside className="hidden lg:block w-64 bg-gray-50 border-l p-4 fixed right-0 top-20 h-screen overflow-y-auto">
      <h3 className="font-bold mb-4">Quick Jump (Pro Mode)</h3>
      
      <div className="space-y-2">
        <JumpButton 
          icon="⚡" 
          label="Opportunities" 
          onClick={() => onJump('opportunities')}
        />
        <JumpButton 
          icon="⭐" 
          label="Watchlist" 
          onClick={() => onJump('watchlist')}
        />
        <JumpButton 
          icon="🏦" 
          label="CEX Markets" 
          onClick={() => onJump('cexMarkets')}
        />
        <JumpButton 
          icon="🤖" 
          label="Strategies" 
          onClick={() => onJump('strategies')}
        />
        <JumpButton 
          icon="🔔" 
          label="Alerts" 
          onClick={() => onJump('alerts')}
        />
      </div>

      <hr className="my-6" />
      
      <h3 className="font-bold mb-3 text-sm">Pro Settings</h3>
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" /> Dark Mode
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" /> Sound Alerts
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" /> Keyboard Shortcuts
        </label>
      </div>
    </aside>
  );
}
```

---

## 💻 File Structure You'll Create

```
```
client/src/components/trading/
├── YukiDashboard.tsx                  ← Main component (scroll-based)
├── sections/
│   ├── BalanceHeader.tsx              ← Sticky header with balance
│   ├── QuickStats.tsx                 ← 4 quick stat cards
│   ├── OpportunitiesSection.tsx       ← Live arb opportunities
│   ├── WatchlistSection.tsx           ← Saved crypto pairs
│   ├── CEXMarketsSection.tsx          ← Exchange integrations
│   ├── DEXSwapSection.tsx             ← Token swap builder
│   ├── StrategiesSection.tsx          ← Active trading bots
│   ├── ChartsSection.tsx              ← Technical analysis charts
│   └── PortfolioSection.tsx           ← Holdings overview
├── components/
│   ├── CollapsibleSection.tsx         ← Collapse/expand container
│   ├── OpportunityCard.tsx            ← Single opportunity display
│   ├── PriceCard.tsx                  ← Token price display
│   ├── TokenSelector.tsx              ← Token dropdown
│   ├── ChainSelector.tsx              ← Blockchain selector
│   ├── SwapPreview.tsx                ← Route visualization
│   ├── BridgePreview.tsx              ← Cross-chain preview
│   ├── StrategyCard.tsx               ← Strategy display
│   ├── CandleChart.tsx                ← Recharts candlestick
│   ├── HoldingsTable.tsx              ← Portfolio table
│   └── AllocationChart.tsx            ← Pie chart
├── sidebar/ (Optional Pro Mode)
│   └── ProSidebar.tsx                 ← Desktop sidebar with quick jump
└── hooks/
    ├── useScrollToSection.tsx         ← Scroll animations
    └── useProMode.tsx                 ← Pro sidebar toggle
```

---

## ✨ Key Design Principles

### 1. **Information Hierarchy**
- **Opportunities FIRST** - Most important (always visible, top of page)
- **Watchlist SECOND** - Expanded by default (users check prices frequently)
- **Everything else** - Collapsed until needed (reduce cognitive load)

### 2. **Real-Time Monitoring**
- Opportunities refresh every 3 seconds
- Watchlist updates continuously
- No data lost when scrolling
- Users can keep page open all day

### 3. **Mobile-Perfect**
- Natural vertical stacking
- No horizontal scrolling
- Touch-friendly buttons (48px+)
- Collapsible sections work on mobile
- Sidebar hidden on mobile (optional drawer)

### 4. **Desktop Power User**
- Optional sidebar for quick navigation
- Keyboard shortcuts (Ctrl+1 to jump)
- Persistent layout preferences
- Auto-collapse unused sections

### 5. **No Tab Switching Friction**
- Zero context loss
- All data always flowing
- Just scroll to see more
- Click to expand details

---

## 🚀 Build Sequence

**Optimal Order:**

1. **YukiDashboard.tsx** - Main container
2. **CollapsibleSection.tsx** - Reusable collapse component
3. **BalanceHeader.tsx** - Sticky header
4. **QuickStats.tsx** - 4 stat cards
5. **OpportunitiesSection.tsx** - Most important section
6. **OpportunityCard.tsx** - Single opportunity display
7. **WatchlistSection.tsx** - Saved tokens
8. **PriceCard.tsx** - Token price display
9. **CEXMarketsSection.tsx** - Exchange integration
10. **DEXSwapSection.tsx** - Swap builder
11. **TokenSelector.tsx** - Reusable dropdown
12. **SwapPreview.tsx** - Route display
13. **StrategiesSection.tsx** - Trading bot management
14. **StrategyCard.tsx** - Strategy display
15. **ChartsSection.tsx** - Candlestick charts
16. **CandleChart.tsx** - Recharts integration
17. **PortfolioSection.tsx** - Holdings
18. **HoldingsTable.tsx** - Table + charts
19. **ProSidebar.tsx** - Optional desktop sidebar
20. **Testing & Polish** - Responsive, dark mode, errors

---

## 💡 Key Implementation Tips

### 1. Start Simple
```typescript
// Day 1: Just get sections rendering
export default function YukiDashboard() {
  return (
    <>
      <BalanceHeader />
      <QuickStats />
      <OpportunitiesSection />
      <CollapsibleSection title="Watchlist"><WatchlistSection /></CollapsibleSection>
      <CollapsibleSection title="CEX"><CEXSection /></CollapsibleSection>
      {/* ... etc */}
    </>
  );
}
```

### 2. Add APIs Incrementally
```typescript
// Day 2: Wire one section at a time
// Start with OpportunitiesSection (most important)
useEffect(() => {
  fetch('/api/yuki/market/opportunities')
    .then(r => r.json())
    .then(data => setOpportunities(data));
}, []);

// Don't try to wire everything at once!
```

### 3. Use React Query for Data
```typescript
import { useQuery } from '@tanstack/react-query';

// Cleaner than useState + useEffect
const { data: opportunities, isLoading } = useQuery({
  queryKey: ['opportunities'],
  queryFn: () => fetch('/api/yuki/market/opportunities').then(r => r.json()),
  refetchInterval: 3000, // Refresh every 3s
});
```

### 4. Real-Time Updates
```typescript
// Don't lose data when user scrolls
// Keep fetching in background
useEffect(() => {
  const interval = setInterval(() => {
    refetchOpportunities(); // Re-fetch silently
  }, 3000);
  
  return () => clearInterval(interval);
}, []);
```

### 5. Smooth Collapse/Expand
```typescript
// Use Framer Motion for smooth animations
import { motion, AnimatePresence } from 'framer-motion';

{isExpanded && (
  <motion.div
    initial={{ height: 0, opacity: 0 }}
    animate={{ height: 'auto', opacity: 1 }}
    exit={{ height: 0, opacity: 0 }}
  >
    {children}
  </motion.div>
)}
```

---

## 🎨 Visual Design

### Colors
- **Primary:** Blue (trading/technical)
- **Opportunities:** Orange (attention/profit)
- **Success:** Green (gains/positive)
- **Warning:** Yellow (fees/risk)
- **Error:** Red (losses/problems)

### Typography
- **Headers:** Bold, 18-24px
- **Section Titles:** Bold, 16px
- **Body:** Regular, 14px
- **Labels:** Small, 12px

### Spacing
- **Section Padding:** 24px
- **Card Padding:** 16px
- **Gap Between Cards:** 12px
- **Gap Between Sections:** 24px

---

## 📊 Expected API Responses

### Opportunities API
```json
{
  "opportunities": [
    {
      "id": "opp_123",
      "title": "ETH Arbitrage",
      "description": "Binance-Kraken spread",
      "from": { "exchange": "binance", "price": 2450 },
      "to": { "exchange": "kraken", "price": 2501 },
      "profit": "+2.1%",
      "profitAmount": "$450",
      "risk": "Low",
      "confidence": "94%",
      "estimatedTime": "5 minutes"
    }
  ]
}
```

### Watchlist API
```json
{
  "watchlist": [
    {
      "id": "eth_usdt",
      "symbol": "ETH/USDT",
      "price": 2450,
      "change24h": 5.2,
      "volume": "2.4B",
      "marketCap": "298B"
    }
  ]
}
```

---

## ⏱️ Day-by-Day Timeline

```
DAY 1 (6-8 hours)
├─ 2h: Setup + YukiDashboard skeleton
├─ 2h: Create CollapsibleSection component
├─ 2h: Build BalanceHeader + QuickStats
└─ 2h: Test mobile responsiveness

DAY 2 (6-8 hours)
├─ 2h: Build OpportunitiesSection (with mock data)
├─ 2h: Wire /api/yuki/market/opportunities API
├─ 2h: Build OpportunityCard display
└─ 2h: Add real-time refresh (3s interval)

DAY 3 (6-8 hours)
├─ 2h: Build WatchlistSection
├─ 2h: Build PriceCard component
├─ 2h: Wire /api/yuki/market/prices API
└─ 2h: Build TokenSelector dropdown

DAY 4 (6-8 hours)
├─ 2h: Build CEXMarketsSection
├─ 2h: Build DEXSwapSection with preview
├─ 2h: Build StrategiesSection
└─ 2h: Build ChartsSection with Recharts

DAY 5 (4-6 hours)
├─ 2h: Build PortfolioSection
├─ 1h: Implement ProSidebar (optional)
├─ 1h: Add keyboard shortcuts
└─ 2h: Mobile responsiveness + dark mode + error handling
```

---

## 🎉 Launch Criteria

✅ All 8 sections render without errors  
✅ Opportunities real-time update every 3s  
✅ Mobile responsive (tested <600px)  
✅ Tablet responsive (600px-1024px)  
✅ Desktop responsive (>1024px)  
✅ Dark mode works  
✅ Error messages user-friendly  
✅ Loading states prevent double-clicks  
✅ No console errors  
✅ Works on real backend APIs  
✅ Opportunities always visible (never scrolls out)  
✅ Collapsible sections smooth (no jumps)

---

## 📚 References

- [DASHBOARD_ARCHITECTURE_ANALYSIS.md](DASHBOARD_ARCHITECTURE_ANALYSIS.md) - Full design spec
- [YUKI_API_COMPLETION_SUMMARY.md](YUKI_API_COMPLETION_SUMMARY.md) - All 20 APIs
- [TRADING_INFRASTRUCTURE_COMPLETE.md](TRADING_INFRASTRUCTURE_COMPLETE.md) - Backend architecture
- Okedi components - UI patterns to follow
- shadcn/ui docs - Components library

---

## 🔑 Why Scroll-Based Design?

**Problems with 8 Tabs:**
- ❌ Exceeds UX best practices (should be 3-5)
- ❌ Opportunities hidden = missed profits
- ❌ Can't monitor multiple markets
- ❌ Mobile unusable (horizontal scroll nightmare)
- ❌ Context lost when switching tabs

**Benefits of Scroll-Based:**
- ✅ Everything visible at once
- ✅ Opportunities ALWAYS visible (core value!)
- ✅ Real-time monitoring possible
- ✅ Mobile-perfect naturally
- ✅ No context switching friction
- ✅ Professional appearance (like Bloomberg/TradingView)
- ✅ Scalable (add sections without breaking UX)
- ✅ Optional sidebar for power users
- ✅ Keyboard shortcuts (Ctrl+1, Ctrl+2, etc)
- ✅ Personalization (reorder sections, collapse preferences)

---

## 🚀 Let's Build!
