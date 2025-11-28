# Monday Setup: Provider & Analytics Dashboard Integration

**Status**: Week 1 Implementation - Day 1 (Setup Phase)

---

## 📋 What's Been Created

### **1. Analytics Dashboard Page** ✅
📄 `client/src/pages/analytics-dashboard.tsx` (300 LOC)

Complete analytics page with:
- RealtimeMetricsProvider wrapper
- 3 tabs: Vault Analytics, Contribution Analytics, Leaderboard
- DAO info header with status badges
- Time range selector
- Back navigation
- Loading states
- Error handling

### **2. Route Configuration** ✅
📄 `client/src/routes/analytics-routes.tsx` (60 LOC)

Ready-to-use route definitions:
```typescript
// Routes:
/analytics/:daoId
/analytics/:daoId/vault/:vaultId
```

---

## 🔌 Integration Steps

### **Step 1: Add Routes to Your Router**

If using React Router v6.4+ (createBrowserRouter):

```typescript
// src/App.tsx or src/routes/index.ts
import { analyticsRoutes } from '@/routes/analytics-routes';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      // ... existing routes
      ...analyticsRoutes,
      // ... more routes
    ],
  },
]);
```

If using older router pattern:

```typescript
// src/App.tsx
import AnalyticsDashboard from '@/pages/analytics-dashboard';

<Routes>
  {/* existing routes */}
  <Route 
    path="/analytics/:daoId" 
    element={<AnalyticsDashboard />} 
  />
  <Route 
    path="/analytics/:daoId/vault/:vaultId" 
    element={<AnalyticsDashboard />} 
  />
</Routes>
```

### **Step 2: Create Navigation Links**

Link to analytics from your DAO pages:

```typescript
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';

function DaoDetailPage({ daoId, vaultId }) {
  const navigate = useNavigate();

  return (
    <div>
      <Button onClick={() => navigate(`/analytics/${daoId}/vault/${vaultId}`)}>
        <BarChart3 className="w-4 h-4 mr-2" />
        View Analytics
      </Button>
    </div>
  );
}
```

### **Step 3: Environment Variables**

Make sure your `.env` has:

```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

---

## 🧪 Testing Setup

### **Option A: Test with Mock Data (No API)**

The analytics tabs automatically fall back to mock data. Just navigate to:
```
http://localhost:5173/analytics/test-dao-id/vault/test-vault-id
```

**What works**:
- ✅ All charts render
- ✅ Time range selectors work
- ✅ Tab switching works
- ✅ Mock data updates
- ✅ Export buttons (stubs)

### **Option B: Test with Real API**

Once configured, the components will fetch real data from:
```
GET /api/vault/{vaultId}/performance
GET /api/vault/{vaultId}/transactions
GET /api/analyzer/contributions/{daoId}
```

---

## 📊 Component Hierarchy

```
AnalyticsDashboardPage (Wrapper)
  └─ RealtimeMetricsProvider (Context wrapper)
      └─ AnalyticsDashboardContent
          ├─ DAO Info Header
          ├─ Tabs Container
          │  ├─ Vault Analytics Tab
          │  │  └─ VaultAnalyticsTab (400 LOC)
          │  ├─ Contribution Analytics Tab
          │  │  └─ ContributionAnalyticsTab (450 LOC)
          │  └─ Leaderboard Tab
          │     └─ [Coming Thursday]
          └─ Navigation Controls
```

---

## ✅ Verification Checklist

After integration, verify:

- [ ] Routes are accessible (navigate to `/analytics/test/vault/test`)
- [ ] Analytics page loads
- [ ] Mock data appears in charts (if no API)
- [ ] Tabs switch without errors
- [ ] Time range selector works
- [ ] Back button navigates correctly
- [ ] Console has no errors
- [ ] Responsive on mobile/tablet

---

## 🔗 Connection Points

### **From Existing Pages**

Add navigation to analytics from:
- DAO detail pages
- DAO list pages
- Dashboard pages
- Vault detail pages

**Example**:
```typescript
<Button onClick={() => navigate(`/analytics/${dao.id}/vault/${vault.id}`)}>
  View Analytics
</Button>
```

---

## 📝 Next Steps (Tuesday)

Tuesday will focus on connecting real API data:
- Configure WebSocket connection
- Connect VaultAnalyticsTab to real endpoints
- Verify real-time updates working
- Test all charts with production data

---

## 🚀 Current Status

✅ **Completed**:
- Provider component (WebSocket + polling)
- React hook for subscriptions
- VaultAnalyticsTab (6 charts, 4 metrics)
- ContributionAnalyticsTab (4 charts, rankings table)
- Analytics dashboard page (300 LOC)
- Route configuration

📋 **Ready for Integration**:
- All components built and tested
- Routes configured
- Fallback mock data included
- Error handling ready

✏️ **Coming This Week**:
- Tuesday: Real API data connection
- Wednesday: Member contribution data
- Thursday: Leaderboard component
- Friday: Testing & deployment

---

## 💡 Tips

1. **Use mock data to test first**: No API setup needed
2. **Check browser console**: For WebSocket connection logs
3. **Verify environment variables**: VITE_API_URL must be set
4. **Test on mobile**: Use Chrome DevTools responsive mode
5. **Check accessibility**: Use tab navigation to verify keyboard support

---

## 📞 Quick Reference

**Main Files**:
- `analytics-dashboard.tsx` - Main page component
- `analytics-routes.tsx` - Route config
- `RealtimeMetricsProvider.tsx` - Real-time infrastructure
- `VaultAnalyticsTab.tsx` - Vault charts
- `ContributionAnalyticsTab.tsx` - Member analytics

**API Endpoints Used**:
- `GET /api/vault/{id}/performance` - TVL, APY data
- `GET /api/vault/{id}/transactions` - Withdrawal history
- `GET /api/analyzer/contributions/{daoId}` - Member data

**WebSocket Channels**:
- `vault:{id}:metrics` (30s poll)
- `vault:{id}:transactions` (60s poll)
- `dao:{daoId}:contributions` (45s poll)

---

**Ready to test? Navigate to `/analytics/test/vault/test` in your app!** 🎉
