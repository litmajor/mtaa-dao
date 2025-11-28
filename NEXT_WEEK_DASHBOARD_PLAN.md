# Next Week Dashboard Implementation Plan
## Week 2 (Following Week): Build Dashboard Tabs, Leaderboard & Real-Time Updates

**Dates**: Mon-Fri (following week from Nov 23)  
**Goals**: 
- ✅ Build Vault Analytics tab with real financial metrics
- ✅ Build Contribution Analytics tab with member insights
- ✅ Create leaderboard display with rankings & badges
- ✅ Implement real-time metric updates via WebSockets/polling

---

## 📋 Architecture Overview

### Current State
- ✅ Dashboard layout components exist (DashboardLayout, DashboardGrid, DashboardCard)
- ✅ Navigation components ready (SidebarNav, HeaderNav, BreadcrumbNav)
- ✅ Main dashboard page exists (`client/src/pages/dashboard.tsx` - 1051 lines)
- ✅ Vault Analytics component exists (`client/src/pages/analytics/vault_analytics_dashboard.tsx`)
- ✅ Analytics component exists (`client/src/components/analytics/AnalyticsDashboard.tsx`)
- ✅ Backend analyzer endpoints complete with proportional selection & contribution endpoints

### New Components to Build

```
client/src/
├── components/
│   └── analytics/
│       ├── VaultAnalyticsTab.tsx          (NEW - 400+ LOC)
│       │   ├── TVL Chart
│       │   ├── APY Trends
│       │   ├── Withdrawal Analysis
│       │   ├── Asset Distribution
│       │   └── Performance Metrics
│       │
│       ├── ContributionAnalyticsTab.tsx   (NEW - 450+ LOC)
│       │   ├── Contribution History Chart
│       │   ├── Member Rankings Table
│       │   ├── Activity Timeline
│       │   ├── Weighted Score Display
│       │   └── Contribution Trends
│       │
│       ├── LeaderboardDisplay.tsx         (NEW - 350+ LOC)
│       │   ├── Member Rank Cards
│       │   ├── Tier Badges
│       │   ├── Score Breakdowns
│       │   ├── Achievement Indicators
│       │   └── Filter/Sort Controls
│       │
│       ├── RealtimeMetricsProvider.tsx    (NEW - 300+ LOC)
│       │   ├── WebSocket Manager
│       │   ├── Polling Fallback
│       │   ├── Cache Management
│       │   └── Error Handling
│       │
│       └── MetricsHook.ts                 (NEW - 150+ LOC)
│           └── useRealtimeMetrics Hook
│
└── pages/
    └── dashboard/
        └── analytics-dashboard.tsx        (UPDATED - 600+ LOC)
            ├── Tab Container (Vault / Contribution)
            ├── Time Range Selector
            ├── Export Controls
            └── Leaderboard Integration
```

---

## 📊 Detailed Component Specifications

### 1. VaultAnalyticsTab Component

**Purpose**: Display vault-specific financial metrics and performance data

**Location**: `client/src/components/analytics/VaultAnalyticsTab.tsx`

**Features**:
```typescript
interface VaultAnalyticsProps {
  daoId: string;
  vaultId?: string;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  refreshInterval?: number;  // ms, default 30000
}

// Charts & Metrics
- Total Value Locked (TVL) - Line Chart
- APY Performance - Area Chart with trend line
- Withdrawal Trends - Bar Chart by date
- Asset Distribution - Pie Chart
- Performance vs Benchmark - Combo Chart
- Top Assets by Value - Horizontal Bar
- Liquidity Ratio - Gauge Chart
- Risk Metrics - Radar Chart

// Summary Cards
- Current TVL (with change %)
- Average APY (with historical comparison)
- Total Withdrawals (period)
- Asset Count
- Liquidity Score
- Risk Rating
```

**Data Flow**:
```
1. Fetch vault data: GET /api/analyzer/vault/:vaultId
2. Fetch analytics: GET /api/vault/performance
3. Fetch transactions: GET /api/vault/transactions
4. Fetch prices: GET /api/market/prices (external)
5. Subscribe to updates: WebSocket vault:vaultId:metrics
```

**Mockdata**:
```typescript
// Until real data available
const mockVaultData = {
  tvl: [
    { date: '2024-11-01', value: 150000 },
    { date: '2024-11-02', value: 165000 },
    // ... 90 days
  ],
  apy: [
    { date: '2024-11-01', apy: 8.5, benchmark: 7.2 },
    // ...
  ],
  assets: [
    { symbol: 'cUSD', amount: 80000, percentage: 53 },
    { symbol: 'CELO', amount: 50000, percentage: 33 },
    { symbol: 'ETH', amount: 20000, percentage: 13 },
  ]
};
```

---

### 2. ContributionAnalyticsTab Component

**Purpose**: Display member contribution metrics and participation analytics

**Location**: `client/src/components/analytics/ContributionAnalyticsTab.tsx`

**Features**:
```typescript
interface ContributionAnalyticsProps {
  daoId: string;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  refreshInterval?: number;  // ms
}

// Charts & Metrics
- Contribution Trends - Area Chart (stacked by member tier)
- Member Contributions Ranking - Horizontal Bar (top 10)
- Weighted Score Evolution - Line Chart
- Activity Timeline - Vertical timeline with events
- Contribution Distribution - Pie Chart (tier breakdown)
- Member Growth - Line Chart
- Engagement Score - Combination chart
- Contribution Rate - Bar chart (daily/weekly)

// Summary Cards
- Total Contributors (period)
- Total Contributions (sum)
- Average per Member
- Top Contributor
- Participation Rate (%)
- Member Retention
- New Members (period)
- Churned Members (period)

// Analytics Tables
- Detailed Member Contributions Table
  - Member Name
  - Contributions (count)
  - Total Amount
  - Weighted Score
  - Tier Level
  - Participation Rate
  - Last Activity

- Contribution History Table
  - Date
  - Member
  - Type (proposal, vote, comment, etc)
  - Impact Score
  - Status
```

**Data Flow**:
```
1. Fetch member list: GET /api/dao/:daoId/members
2. Fetch contributions: GET /api/analyzer/contributions/:daoId
3. Fetch rotation history: GET /api/analyzer/rotation/history/:daoId
4. Subscribe to updates: WebSocket dao:daoId:contributions
```

---

### 3. LeaderboardDisplay Component

**Purpose**: Show ranked member standings with tiered achievements

**Location**: `client/src/components/analytics/LeaderboardDisplay.tsx`

**Features**:
```typescript
interface LeaderboardProps {
  daoId: string;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  sortBy?: 'score' | 'contributions' | 'votes' | 'proposals';
  limit?: number;  // default 50
  filters?: {
    tier?: 'elder' | 'active' | 'inactive';
    status?: 'verified' | 'pending';
  };
}

// Tier System
interface MemberTier {
  name: string;
  icon: string;
  color: string;
  minScore: number;
  maxScore: number;
  badge: string;
  benefits: string[];
}

// Tiers:
- Founder (5000+ points) - Gold star, exclusive perks
- Elder (3000+ points) - Silver star, governance rights
- Champion (1500+ points) - Bronze star, special roles
- Contributor (500+ points) - Blue badge, voting rights
- Participant (100+ points) - Gray badge, member status
- New (0 points) - No badge, pending verification

// UI Elements
- Rank Card (per member):
  ├── Rank # (1-50)
  ├── Avatar
  ├── Member Name & Status
  ├── Tier Badge with Icon
  ├── Score (weighted contribution points)
  ├── Contribution Count
  ├── Vote Count
  ├── Proposal Count
  ├── Trust Score (0-100%)
  ├── Trend Indicator (↑↓→)
  └── Member Actions (view profile, message, etc)

- Filter/Sort Bar
  ├── Time Range Selector (7d, 30d, 90d, 1y, all)
  ├── Sort By Dropdown
  ├── Tier Filter Checkbox Group
  ├── Search/Filter Input
  └── Export Button

- Statistics Summary
  ├── Total Members
  ├── Active Members (7d)
  ├── Average Score
  ├── Top Score
```

**Data Structure**:
```typescript
interface LeaderboardEntry {
  rank: number;
  userId: string;
  memberName: string;
  avatar?: string;
  tier: MemberTier;
  score: number;  // weighted contributions
  contributions: {
    count: number;
    value: number;
    byType: {
      votes: number;
      proposals: number;
      comments: number;
      participation: number;
    };
  };
  trustScore: number;  // 0-100
  trend: 'up' | 'down' | 'stable';
  trendValue: number;  // points changed
  verified: boolean;
  lastActive: Date;
  joinDate: Date;
}
```

---

### 4. RealtimeMetricsProvider Component

**Purpose**: Manage WebSocket/polling connections for live metric updates

**Location**: `client/src/components/analytics/RealtimeMetricsProvider.tsx`

**Features**:
```typescript
interface RealtimeMetricsContextType {
  // Subscription management
  subscribe: (channel: string, handler: (data: any) => void) => () => void;
  unsubscribe: (channel: string, id: string) => void;
  
  // Connection status
  isConnected: boolean;
  lastUpdate: Date;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  
  // Manual refresh
  refresh: (channel: string) => Promise<void>;
  
  // Cache
  getCachedData: (channel: string) => any;
  clearCache: (channel: string) => void;
}

// Channels (subscriptions)
- 'vault:{vaultId}:metrics' - Vault TVL, APY updates
- 'vault:{vaultId}:transactions' - New transactions
- 'dao:{daoId}:contributions' - Member contribution updates
- 'dao:{daoId}:leaderboard' - Ranking changes
- 'dao:{daoId}:members' - Member status changes
- 'system:prices' - Market price updates

// Features
✅ Automatic reconnection with exponential backoff
✅ Message deduplication & ordering
✅ Client-side caching with TTL
✅ Fallback to polling if WebSocket unavailable
✅ Error recovery & retry logic
✅ Offline handling with queue
✅ Performance monitoring (message rate, latency)
```

**Implementation Details**:
```typescript
// WebSocket Connection Management
class MetricsWebSocketManager {
  private ws: WebSocket;
  private reconnectAttempts: number = 0;
  private reconnectDelay: number = 1000;
  private maxReconnectDelay: number = 30000;
  
  // Subscriptions Map: { channelName: Set<Handler> }
  private subscriptions: Map<string, Set<(data: any) => void>>;
  
  // Cache: { channelName: { data, timestamp, ttl } }
  private cache: Map<string, CacheEntry>;
  
  // Polling Fallback
  private pollIntervals: Map<string, NodeJS.Timer>;
}

// Polling Fallback (if WebSocket unavailable)
const pollingIntervals = {
  'vault:*:metrics': 30000,       // 30 seconds
  'vault:*:transactions': 60000,   // 60 seconds
  'dao:*:contributions': 45000,    // 45 seconds
  'dao:*:leaderboard': 60000,      // 60 seconds
  'system:prices': 15000,          // 15 seconds
};
```

---

### 5. useRealtimeMetrics Hook

**Purpose**: React hook for consuming real-time metric updates in components

**Location**: `client/src/hooks/useRealtimeMetrics.ts`

**Usage**:
```typescript
function VaultAnalyticsTab({ vaultId }) {
  const { data, isLoading, error, refresh } = useRealtimeMetrics(
    `vault:${vaultId}:metrics`,
    { refreshInterval: 30000, staleTime: 10000 }
  );
  
  return (
    <div>
      {error && <Alert>{error.message}</Alert>}
      {isLoading && <Spinner />}
      {data && <TVLChart data={data.tvl} />}
      <Button onClick={() => refresh()}>Refresh Now</Button>
    </div>
  );
}
```

**Returns**:
```typescript
interface UseRealtimeMetricsResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
  subscribe: (handler: (data: T) => void) => () => void;
}
```

---

## 📅 Implementation Timeline

### Monday: Architecture & Setup
- [ ] Create RealtimeMetricsProvider & useRealtimeMetrics hook
- [ ] Set up WebSocket infrastructure (with polling fallback)
- [ ] Create base component structure & TypeScript types
- [ ] Set up mock data for testing

**Deliverable**: 
- `RealtimeMetricsProvider.tsx` (300 LOC)
- `useRealtimeMetrics.ts` (150 LOC)
- Type definitions file
- Mock data file (200 LOC)

### Tuesday: Vault Analytics Tab
- [ ] Build VaultAnalyticsTab component with charts
- [ ] Implement TVL, APY, withdrawal trend charts
- [ ] Add asset distribution & performance metrics
- [ ] Integrate with real API endpoints (vault, analyzer)
- [ ] Add time range selector & refresh controls

**Deliverable**:
- `VaultAnalyticsTab.tsx` (400+ LOC)
- Chart components (200+ LOC)
- Tests (100+ LOC)

### Wednesday: Contribution Analytics Tab
- [ ] Build ContributionAnalyticsTab component
- [ ] Implement contribution history chart
- [ ] Build member rankings table
- [ ] Add activity timeline
- [ ] Integrate with analyzer endpoints

**Deliverable**:
- `ContributionAnalyticsTab.tsx` (450+ LOC)
- Member table & timeline components (250+ LOC)
- Tests (100+ LOC)

### Thursday: Leaderboard Display
- [ ] Build LeaderboardDisplay component
- [ ] Implement tier system with badges
- [ ] Create rank cards with statistics
- [ ] Add filtering, sorting, search
- [ ] Performance optimization (virtualization for 1000+ members)

**Deliverable**:
- `LeaderboardDisplay.tsx` (350+ LOC)
- Tier badge component (100 LOC)
- Rank card component (150 LOC)
- Tests (120+ LOC)

### Friday: Integration & Real-Time
- [ ] Integrate all components into analytics dashboard page
- [ ] Test real-time updates with WebSocket connections
- [ ] Implement fallback polling behavior
- [ ] Performance testing (memory, CPU, network)
- [ ] Final refinements & bug fixes

**Deliverable**:
- `analytics-dashboard.tsx` (600+ LOC)
- Integration tests (200+ LOC)
- Performance reports

---

## 🔌 API Integration Points

### Existing Backend Endpoints (Ready to Use)

1. **Vault Endpoints**
   ```
   GET /api/vault/balance-usd
   GET /api/vault/performance
   GET /api/vault/transactions
   GET /api/vault/info/:vaultAddress
   ```

2. **Analyzer Endpoints** (Built this week)
   ```
   GET /api/analyzer/contributions/:daoId
   GET /api/analyzer/rotation/history/:daoId
   POST /api/analyzer/analyze/vault/:vaultId
   GET /api/analyzer/dao/:daoId/comprehensive
   GET /api/analyzer/node/:userId
   ```

3. **Wallet Endpoints**
   ```
   GET /api/wallet/balance/:address
   GET /api/wallet/analytics
   GET /api/wallet/transactions
   ```

### Potential New Endpoints (Optional)

If real-time WebSocket updates needed:
```typescript
// WebSocket events for real-time data
socket.on('vault:metrics:update', (data) => {
  // TVL, APY changes
});

socket.on('dao:contributions:update', (data) => {
  // Member contribution updates
});

socket.on('leaderboard:update', (data) => {
  // Ranking changes
});
```

---

## 📊 Data Structure Examples

### Vault Analytics Data
```typescript
interface VaultAnalyticsData {
  vaultId: string;
  currentTVL: number;
  tvlHistory: Array<{ date: string; value: number }>;
  
  currentAPY: number;
  apyHistory: Array<{ date: string; apy: number }>;
  benchmark: number;
  
  assets: Array<{
    symbol: string;
    amount: number;
    value: number;
    percentage: number;
  }>;
  
  withdrawals: Array<{ date: string; amount: number }>;
  totalWithdrawn: number;
  
  performance: {
    dayChange: number;
    weekChange: number;
    monthChange: number;
    yearChange: number;
  };
  
  risk: {
    liquidityRatio: number;
    concentrationRisk: number;
    volatility: number;
  };
}
```

### Contribution Analytics Data
```typescript
interface ContributionAnalyticsData {
  daoId: string;
  period: { from: Date; to: Date };
  
  summary: {
    totalContributors: number;
    totalContributions: number;
    averagePerMember: number;
    participationRate: number;
    newMembers: number;
    churnedMembers: number;
  };
  
  trends: Array<{
    date: string;
    totalContributions: number;
    contributors: number;
    byTier: {
      founder: number;
      elder: number;
      champion: number;
      contributor: number;
    };
  }>;
  
  members: Array<{
    userId: string;
    name: string;
    tier: string;
    contributions: number;
    weightedScore: number;
    votes: number;
    proposals: number;
    participationRate: number;
  }>;
}
```

### Leaderboard Data
```typescript
interface LeaderboardData {
  daoId: string;
  timestamp: Date;
  
  entries: Array<{
    rank: number;
    userId: string;
    name: string;
    tier: MemberTier;
    score: number;
    scoreChange: number;
    trustScore: number;
    verified: boolean;
    lastActive: Date;
  }>;
  
  statistics: {
    totalMembers: number;
    activeMembers: number;
    averageScore: number;
    medianScore: number;
    topScore: number;
  };
}
```

---

## 🎨 UI/UX Considerations

### Chart Selection
- **TVL Trends**: LineChart (cumulative growth)
- **APY Performance**: AreaChart (trend visibility)
- **Withdrawals**: BarChart (discrete events)
- **Asset Distribution**: PieChart (composition)
- **Contributions**: StackedAreaChart (member tiers)
- **Rankings**: HorizontalBarChart (easy comparison)
- **Risk Metrics**: RadarChart (multi-dimensional)

### Color Scheme
```typescript
const colors = {
  primary: '#3B82F6',      // Blue
  success: '#10B981',      // Green
  warning: '#F59E0B',      // Amber
  danger: '#EF4444',       // Red
  
  tiers: {
    founder: '#FFD700',    // Gold
    elder: '#C0C0C0',      // Silver
    champion: '#CD7F32',   // Bronze
    contributor: '#4B5563', // Blue
    participant: '#9CA3AF', // Gray
  }
};
```

### Responsive Design
- **Mobile**: Single column, collapsed leaderboard
- **Tablet**: 2-column layout
- **Desktop**: Full 3-column or tab-based layout
- **Large Screen**: 4+ column dashboard

### Performance Optimization
- Lazy load charts (virtualized scrolling)
- Debounce real-time updates (max 1/sec)
- Cache data client-side (TTL: 5-10 minutes)
- Pagination for large lists (50 items/page)
- Virtual scrolling for 1000+ member leaderboards

---

## 🧪 Testing Strategy

### Unit Tests
- Component rendering with mock data
- Props validation
- Event handling (click, filters, sort)
- Hook behavior (useRealtimeMetrics)
- Error states

### Integration Tests
- Real-time metric subscription/unsubscription
- WebSocket connection handling
- Polling fallback behavior
- Data formatting & transformation
- Tab switching & state preservation

### E2E Tests
- Full dashboard flow with real API
- Real-time updates across components
- Filter/sort/search functionality
- Export CSV/JSON
- Performance under load

### Performance Tests
- Component render time < 1s
- Real-time update latency < 500ms
- Memory usage with 1000+ members < 100MB
- Network bandwidth < 1MB/min

---

## 🚀 Deployment Checklist

- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance benchmarks met
- [ ] WebSocket fallback verified
- [ ] Real-time updates tested with production API
- [ ] Error handling for all failure scenarios
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] Mobile responsiveness verified
- [ ] Documentation complete
- [ ] Code review approval
- [ ] Deployment to staging & production

---

## 📚 Component Size Estimates

| Component | LOC | Complexity |
|-----------|-----|-----------|
| VaultAnalyticsTab | 400+ | High |
| ContributionAnalyticsTab | 450+ | High |
| LeaderboardDisplay | 350+ | Medium |
| RealtimeMetricsProvider | 300+ | High |
| useRealtimeMetrics Hook | 150+ | Medium |
| Analytics Dashboard Page | 600+ | High |
| Tests (combined) | 400+ | Medium |
| **Total** | **~2,650** | - |

**Estimated Development Time**: 4-5 days (40-50 hours)

---

## 📌 Success Criteria

✅ All dashboard tabs (Vault & Contribution Analytics) functional with real data  
✅ Leaderboard displays 100+ members with proper tier classification  
✅ Real-time updates working (WebSocket or polling) with < 500ms latency  
✅ Charts responsive and interactive (hover, zoom, export)  
✅ Mobile-friendly design verified on multiple devices  
✅ Performance: Dashboard loads in < 2s, updates in < 500ms  
✅ Error handling & recovery implemented for all failure modes  
✅ 80%+ test coverage with unit & integration tests  
✅ Documentation complete with usage examples  
✅ Code review approved & ready for production  

---

## 🎯 Future Enhancements (Post-Week)

- [ ] Custom dashboard builder (drag-drop widgets)
- [ ] Advanced analytics (ML-based insights)
- [ ] Alert system (threshold-based notifications)
- [ ] Report generation (PDF, Excel exports)
- [ ] Multi-DAO comparison view
- [ ] Predictive analytics (forecasting trends)
- [ ] Member performance predictions
- [ ] Governance health scoring
- [ ] Mobile app dashboard
- [ ] Dark mode support
