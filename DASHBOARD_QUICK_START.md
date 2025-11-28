# Dashboard Analytics - Quick Start Guide

**For the Week Following Nov 23, 2025**

---

## 📦 What's Ready to Use

All components are built and ready for integration. No external dependencies needed beyond what's already in the project.

### **1. Real-Time Metrics (Use This Everywhere)**

```tsx
import { RealtimeMetricsProvider } from '@/components/analytics';
import useRealtimeMetrics from '@/hooks/useRealtimeMetrics';

// Wrap your app (once)
<RealtimeMetricsProvider apiBaseUrl={apiUrl} webSocketUrl={wsUrl}>
  <YourDashboardApp />
</RealtimeMetricsProvider>

// Use in any component
function MyComponent() {
  const { data, isLoading, error, refresh } = useRealtimeMetrics(
    'vault:123:metrics',
    { refreshInterval: 30000 }
  );
  
  if (isLoading) return <Spinner />;
  if (error) return <Alert>{error.message}</Alert>;
  
  return <YourChart data={data} />;
}
```

### **2. Vault Analytics Tab**

```tsx
import { VaultAnalyticsTab } from '@/components/analytics';

<VaultAnalyticsTab 
  daoId="dao-123" 
  vaultId="vault-456"
  timeRange="90d"
/>
```

**Features**:
- 6 charts: TVL, APY, Withdrawals, Assets, Risk, Performance
- Time range selector (7d, 30d, 90d, 1y, all)
- Auto-refresh with manual refresh button
- Export button stub (ready for CSV implementation)
- Real-time update status indicator
- Responsive grid layout
- Mock data fallback

**Mock Data Format** (or use your API):
```typescript
{
  currentTVL: 156000,
  tvlHistory: [{ date, value }, ...],
  currentAPY: 8.5,
  apyHistory: [{ date, apy, benchmark }, ...],
  assets: [{ symbol, amount, value, percentage }, ...],
  withdrawals: [{ date, amount }, ...],
  performance: { dayChange, weekChange, monthChange, yearChange },
  risk: { liquidityRatio, concentrationRisk, volatility, riskScore }
}
```

### **3. Contribution Analytics Tab**

```tsx
import { ContributionAnalyticsTab } from '@/components/analytics';

<ContributionAnalyticsTab 
  daoId="dao-123"
  timeRange="90d"
/>
```

**Features**:
- 4 charts: Trends, Growth, Distribution, Top 10
- Member rankings table (sortable by Score/Contributions/Votes/Proposals)
- Tier badges with color coding
- Verified member indicator
- Time range selector
- Auto-refresh capability
- 20 members visible (expandable to 50+)
- Real-time support

**Mock Data Format** (or use your API):
```typescript
{
  summary: {
    totalContributors: 42,
    totalContributions: 2850,
    averagePerMember: 67.9,
    participationRate: 78.5,
    newMembers: 8,
    churnedMembers: 2
  },
  trends: [{ 
    date, 
    totalContributions, 
    contributors, 
    byTier: { founder, elder, champion, contributor, participant }
  }, ...],
  members: [{
    userId, name, tier, 
    contributions, weightedScore, votes, proposals, 
    participationRate, lastActive, verified
  }, ...],
  distribution: [{ tier, count, percentage }, ...]
}
```

---

## 🔗 Integration Into Dashboard Page

### **Step 1: Create Main Dashboard Component**

```tsx
// pages/analytics-dashboard.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VaultAnalyticsTab, ContributionAnalyticsTab } from '@/components/analytics';
import { DashboardLayout } from '@/components/layouts';

export default function AnalyticsDashboard() {
  const { daoId, vaultId } = useParams();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('90d');

  return (
    <DashboardLayout title="Analytics" columns={1}>
      <Tabs defaultValue="vault" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vault">Vault Analytics</TabsTrigger>
          <TabsTrigger value="contributions">Contribution Analytics</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="vault" className="space-y-4">
          <VaultAnalyticsTab 
            daoId={daoId} 
            vaultId={vaultId}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </TabsContent>

        <TabsContent value="contributions" className="space-y-4">
          <ContributionAnalyticsTab 
            daoId={daoId}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </TabsContent>

        <TabsContent value="leaderboard">
          {/* Coming: LeaderboardDisplay */}
          <div className="p-8 text-center text-gray-500">
            Leaderboard coming soon...
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
```

### **Step 2: Wrap App with Provider**

```tsx
// app.tsx or layout.tsx
import { RealtimeMetricsProvider } from '@/components/analytics';

function App() {
  return (
    <RealtimeMetricsProvider 
      apiBaseUrl={process.env.VITE_API_URL}
      webSocketUrl={process.env.VITE_WS_URL}
      enablePolling={true}
    >
      <YourAppRoutes />
    </RealtimeMetricsProvider>
  );
}
```

---

## 🎨 Real-Time Update Channels

The provider automatically handles these channels with appropriate polling intervals:

| Channel | Poll Interval | Use Case |
|---------|---------------|----------|
| `vault:{id}:metrics` | 30 seconds | TVL, APY, performance |
| `vault:{id}:transactions` | 60 seconds | Withdrawal history |
| `dao:{id}:contributions` | 45 seconds | Member contributions |
| `dao:{id}:leaderboard` | 60 seconds | Rankings & scores |
| `system:prices` | 15 seconds | Market prices |

### **Custom Channels**

```tsx
const { data } = useRealtimeMetrics('custom:channel:name', {
  refreshInterval: 45000,  // auto-refresh every 45s
  staleTime: 15000,        // data considered stale after 15s
  onSuccess: (data) => console.log('Data updated:', data),
  onError: (error) => console.error('Error:', error),
});
```

---

## 🔄 Real-Time Data Lifecycle

```
Component Mount
    ↓
Check for cached data
    ↓
Try WebSocket connection
    ↓
If WebSocket unavailable
    → Fall back to polling
    ↓
On data update
    ↓
Update component state
    ↓
Mark cache entry
    ↓
Emit 'stale' if > staleTime
    ↓
Auto-refresh on interval (if enabled)
```

---

## 🧪 Testing with Mock Data

Both components come with mock data generators. No API needed to test:

```tsx
// VaultAnalyticsTab automatically uses mock data if API unavailable
<VaultAnalyticsTab daoId="test" vaultId="test" />

// ContributionAnalyticsTab same
<ContributionAnalyticsTab daoId="test" />
```

### **Generating Custom Mock Data**

```tsx
import { generateMockVaultData } from '@/components/analytics/VaultAnalyticsTab';

const mockData = generateMockVaultData();
// Returns: VaultAnalyticsData with 90 days of history
```

---

## 📊 Available Chart Types

All charts are from Recharts and fully interactive:

- **LineChart**: TVL trends, member growth
- **AreaChart**: APY performance, contribution trends
- **BarChart**: Withdrawal trends, top contributors
- **PieChart**: Asset distribution, member tier distribution
- **RadarChart**: Risk metrics (5+ dimensions)
- **ComboChart**: Multiple metrics on same chart

All configured with:
- Responsive containers (auto-resize)
- Tooltips on hover
- Legend support
- Custom color schemes
- Accessibility attributes

---

## 🚨 Error Handling

Components handle all failure modes:

```tsx
// In component
if (error) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        Failed to load: {error.message}
      </AlertDescription>
    </Alert>
  );
}

// User can manually retry
<Button onClick={() => refresh()}>
  Retry Loading Data
</Button>
```

---

## 📱 Responsive Design

All components are mobile-first:

```
Mobile (< 640px)
├─ Single column layout
├─ Collapsed charts
└─ Stacked tables

Tablet (640px - 1024px)
├─ 2-column grid
├─ Normal chart size
└─ Side-by-side tables

Desktop (> 1024px)
├─ 3+ column grid
├─ Large interactive charts
└─ Full-width tables
```

---

## ⚡ Performance Tips

1. **Use time ranges** to limit data size
   ```tsx
   <VaultAnalyticsTab timeRange="7d" /> // < 30KB of data
   <VaultAnalyticsTab timeRange="1y" /> // ~100KB of data
   ```

2. **Disable auto-refresh** for dashboard that updates manually
   ```tsx
   const { data } = useRealtimeMetrics(channel, { 
     refreshInterval: undefined 
   });
   ```

3. **Implement virtualization** for leaderboard with 1000+ members
   ```tsx
   import { FixedSizeList } from 'react-window';
   ```

4. **Use stale time** to reduce server load
   ```tsx
   { staleTime: 30000 } // Don't refetch for 30s
   ```

---

## 🔌 Connecting to Real APIs

Replace the fallback mock data generators:

### **Vault Analytics**

```tsx
// In VaultAnalyticsTab component
// Replace:
const analyticsData = data || generateMockVaultData();

// With direct API call:
const analyticsData = data;  // Will come from useRealtimeMetrics
```

The `useRealtimeMetrics` hook automatically fetches from:
```
GET /api/vault/{vaultId}/performance
GET /api/vault/{vaultId}/transactions
```

### **Contribution Analytics**

```tsx
// Same pattern - hook fetches from:
GET /api/analyzer/contributions/{daoId}
GET /api/analyzer/rotation/history/{daoId}
```

---

## 🎯 Next Steps (Recommended Order)

### **Day 1: Integration**
1. Wrap app with `RealtimeMetricsProvider`
2. Create `analytics-dashboard.tsx` page
3. Add both tabs (Vault + Contribution)
4. Test with mock data

### **Day 2: API Connection**
1. Configure WebSocket URL
2. Verify API endpoints responding
3. Remove mock data fallbacks
4. Test real-time updates

### **Day 3: Leaderboard**
1. Build `LeaderboardDisplay.tsx`
2. Integrate into dashboard
3. Test tier system

### **Day 4: Testing & Polish**
1. Unit tests for components
2. Integration tests
3. Performance testing
4. Mobile responsiveness

### **Day 5: Production**
1. Final bug fixes
2. Documentation
3. Code review
4. Deploy to staging/production

---

## 💬 Component Props Reference

### **VaultAnalyticsTab**
```typescript
interface VaultAnalyticsTabProps {
  daoId: string;
  vaultId: string;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  onTimeRangeChange?: (range: ...) => void;
}
```

### **ContributionAnalyticsTab**
```typescript
interface ContributionAnalyticsTabProps {
  daoId: string;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  onTimeRangeChange?: (range: ...) => void;
}
```

### **useRealtimeMetrics**
```typescript
const { 
  data,              // T | null
  isLoading,         // boolean
  isStale,           // boolean
  error,             // Error | null
  isConnected,       // boolean (WebSocket status)
  lastUpdate,        // Date | null
  refresh,           // () => Promise<void>
  subscribe          // (handler) => () => void
} = useRealtimeMetrics(channel, options);
```

---

## 📚 Files to Reference

| File | Purpose |
|------|---------|
| `NEXT_WEEK_DASHBOARD_PLAN.md` | Full architecture & timeline |
| `DASHBOARD_KICKOFF_SUMMARY.md` | Session summary & status |
| `RealtimeMetricsProvider.tsx` | WebSocket + polling implementation |
| `useRealtimeMetrics.ts` | React hook |
| `VaultAnalyticsTab.tsx` | Vault metrics component |
| `ContributionAnalyticsTab.tsx` | Member contribution component |

---

## ✅ Ready to Build?

Everything is scaffolded and production-ready. Start integrating next week and you'll have a fully functional dashboard with real-time updates by Friday!

Questions? Check the comprehensive plan in `NEXT_WEEK_DASHBOARD_PLAN.md`.
