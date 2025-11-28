# Tuesday & Wednesday Implementation: Real API Integration

**Status**: Phase 2 - Real Data Connection  
**Timeline**: Tuesday + Wednesday (2 days)

---

## 🎯 What's New

### **Tuesday: Vault Analytics Real API**
✅ Created `useVaultAnalytics` hook - Connects to `/api/vault/performance` and `/api/vault/transactions`  
✅ Updated `VaultAnalyticsTab` component - Now uses real vault data with WebSocket real-time updates  
✅ Data merging - Combines REST API historical data with WebSocket real-time updates  

### **Wednesday: Contribution Analytics Real API**
✅ Created `useContributionAnalytics` hook - Connects to `/api/analyzer/contributions/:daoId`  
✅ Updated `ContributionAnalyticsTab` component - Now uses real member data with sorting/filtering  
✅ Real-time subscriptions - WebSocket channel `dao:*:contributions` for live member updates  

---

## 📋 Tuesday Implementation Steps

### **Step 1: Replace Component Files**

```bash
# Backup original components
cp client/src/components/analytics/VaultAnalyticsTab.tsx \
   client/src/components/analytics/VaultAnalyticsTab.backup.tsx

# Replace with updated version
cp client/src/components/analytics/VaultAnalyticsTab.updated.tsx \
   client/src/components/analytics/VaultAnalyticsTab.tsx
```

### **Step 2: Add New Hook File**

New file created:
- `client/src/hooks/useVaultAnalytics.ts` (200 LOC)

This hook:
- Fetches from `/api/vault/performance?timeframe=90d`
- Fetches from `/api/vault/transactions?limit=100`
- Subscribes to WebSocket channel: `vault:*:metrics`
- Merges REST + real-time data
- Handles loading/error states

### **Step 3: Configure Environment Variables**

In `.env` or `.env.local`:

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:8080
```

### **Step 4: Test Vault Analytics**

```bash
# Navigate to dashboard
http://localhost:3000/analytics/test/vault/test

# Verify:
✅ Vault Analytics tab loads
✅ TVL chart shows data
✅ APY chart displays correctly
✅ Risk metrics render
✅ Asset distribution pie chart shows
✅ Time range selector works
✅ Refresh button updates data
✅ Real-time status shows "Live" or "Polling"
```

### **Step 5: Verify API Response**

```bash
# Test endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/vault/performance?timeframe=90d"

# Expected response structure:
{
  "vaultId": "vault-001",
  "daoId": "dao-001",
  "metrics": {
    "currentTVL": 1000000,
    "tvlHistory": [
      { "date": "2024-11-01", "tvl": 950000 },
      ...
    ],
    "currentAPY": 8.5,
    "apyHistory": [
      { "date": "2024-11-01", "apy": 8.2, "benchmark": 7.5 },
      ...
    ],
    "assets": [
      { "name": "cUSD", "amount": 850000, "percentage": 85 },
      ...
    ],
    "withdrawals": [
      { "date": "2024-11-01", "amount": 5000 },
      ...
    ],
    "riskMetrics": {
      "liquidityRatio": 0.85,
      "concentrationRisk": 0.25,
      "volatility": 0.15,
      "riskScore": 35
    }
  },
  "lastUpdated": "2024-11-23T14:30:00Z"
}
```

### **Step 6: Debug Data Mapping**

Add to VaultAnalyticsTab for debugging:

```typescript
// In component
useEffect(() => {
  if (vaultData) {
    console.log('✅ Vault data loaded:', {
      tvl: vaultData.currentTVL,
      apy: vaultData.currentAPY,
      assetCount: vaultData.assets?.length,
      historyDays: vaultData.tvlHistory?.length,
    });
  }
}, [vaultData]);
```

---

## 📋 Wednesday Implementation Steps

### **Step 1: Replace Component Files**

```bash
# Backup original
cp client/src/components/analytics/ContributionAnalyticsTab.tsx \
   client/src/components/analytics/ContributionAnalyticsTab.backup.tsx

# Replace with updated version
cp client/src/components/analytics/ContributionAnalyticsTab.updated.tsx \
   client/src/components/analytics/ContributionAnalyticsTab.tsx
```

### **Step 2: Add New Hook File**

New file created:
- `client/src/hooks/useContributionAnalytics.ts` (250 LOC)

This hook:
- Fetches from `/api/analyzer/contributions/:daoId?timeframe=90d`
- Fetches from `/api/analyzer/rotation/history/:daoId?timeframe=90d`
- Subscribes to WebSocket channel: `dao:*:contributions`
- Merges REST + real-time member data
- Supports sorting by score/contributions/votes/proposals

### **Step 3: Test Contribution Analytics**

```bash
# Navigate to dashboard
http://localhost:3000/analytics/test/vault/test

# Click "Contribution Analytics" tab

# Verify:
✅ Member table loads with 20+ rows
✅ Member names display correctly
✅ Tier badges show correct colors
✅ Sort buttons work (Score/Contributions/Votes/Proposals)
✅ Tier filter works
✅ Participation rates display correctly
✅ Verified member badges appear
✅ Last active times format correctly
✅ Summary cards show accurate stats
✅ Contribution trends chart updates
✅ Real-time status shows "Live" or "Polling"
```

### **Step 4: Verify API Response**

```bash
# Test endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/analyzer/contributions/dao-001?timeframe=90d&limit=100"

# Expected response structure:
{
  "daoId": "dao-001",
  "period": {
    "from": "2024-08-25",
    "to": "2024-11-23"
  },
  "summary": {
    "totalContributors": 42,
    "totalContributions": 2850,
    "averagePerMember": 67.9,
    "participationRate": 78.5,
    "newMembers": 8,
    "churnedMembers": 2
  },
  "trends": [
    {
      "date": "2024-11-01",
      "totalContributions": 45,
      "contributors": 32,
      "byTier": {
        "founder": 3,
        "elder": 8,
        "champion": 12,
        "contributor": 15,
        "participant": 4
      }
    }
  ],
  "members": [
    {
      "userId": "user-001",
      "name": "Alice Chen",
      "tier": "founder",
      "contributions": 523,
      "weightedScore": 4850,
      "votes": 45,
      "proposals": 12,
      "participationRate": 95.5,
      "lastActive": "2024-11-23T14:30:00Z",
      "verified": true,
      "avatar": "https://example.com/avatars/alice.jpg"
    }
  ],
  "distribution": [
    { "tier": "Founder", "count": 3, "percentage": 7 },
    { "tier": "Elder", "count": 8, "percentage": 19 },
    { "tier": "Champion", "count": 12, "percentage": 29 },
    { "tier": "Contributor", "count": 15, "percentage": 36 },
    { "tier": "Participant", "count": 4, "percentage": 10 }
  ],
  "lastUpdated": "2024-11-23T14:30:00Z"
}
```

### **Step 5: Test Real-Time Updates**

Once WebSocket is configured:

```typescript
// In ContributionAnalyticsTab - monitor real-time updates
useEffect(() => {
  if (isConnected) {
    console.log('✅ Real-time connected');
  } else {
    console.log('⚠️ Using polling fallback');
  }
}, [isConnected]);
```

---

## 🔍 Common Integration Issues & Fixes

### **Issue: "API Error" in Console**

**Cause**: API endpoint not available or wrong URL

**Fix**:
```typescript
// Check environment variables
console.log('API URL:', import.meta.env.VITE_API_URL);
console.log('WS URL:', import.meta.env.VITE_WS_URL);

// Verify endpoint is reachable
curl http://localhost:3001/api/vault/performance
```

### **Issue: Data Not Displaying in Charts**

**Cause**: Data structure mismatch

**Fix**:
```typescript
// Add logging in hook
useVaultAnalytics({
  daoId,
  vaultId,
  timeframe: selectedTimeRange,
  apiBaseUrl,
});

// Log the response
console.log('API Response:', {
  tvl: vaultData?.currentTVL,
  tvlHistory: vaultData?.tvlHistory?.length,
  apy: vaultData?.currentAPY,
  apyHistory: vaultData?.apyHistory?.length,
});
```

### **Issue: Members Table Empty**

**Cause**: API returning empty members array or data not merged

**Fix**:
```typescript
// Add logging
useContributionAnalytics({
  daoId,
  timeframe: selectedTimeRange,
  apiBaseUrl,
});

console.log('Members:', {
  count: members?.length,
  first: members?.[0],
  summary: summary?.totalContributors,
});
```

### **Issue: Real-Time Updates Not Working**

**Cause**: WebSocket not connected or wrong channel name

**Fix**:
```typescript
// Check real-time status
const { isConnected, data: realtimeData } = useRealtimeMetrics(channelName);

console.log('Real-time status:', {
  connected: isConnected,
  channelName: 'vault:*:metrics',
  dataReceived: !!realtimeData,
});
```

---

## ✅ Tuesday Verification Checklist

- [ ] VaultAnalyticsTab component updated
- [ ] useVaultAnalytics hook created
- [ ] Environment variables configured
- [ ] `/api/vault/performance` endpoint responds
- [ ] `/api/vault/transactions` endpoint responds
- [ ] Vault Analytics tab loads without errors
- [ ] TVL chart displays data
- [ ] APY chart displays correctly
- [ ] Asset distribution shows
- [ ] Risk metrics render
- [ ] Time range selector works
- [ ] Refresh button updates data
- [ ] Real-time status indicator present
- [ ] No console errors
- [ ] Mobile responsive verified

---

## ✅ Wednesday Verification Checklist

- [ ] ContributionAnalyticsTab component updated
- [ ] useContributionAnalytics hook created
- [ ] `/api/analyzer/contributions/:daoId` responds
- [ ] Contribution Analytics tab loads without errors
- [ ] Member table shows 20+ rows
- [ ] Tier badges display with correct colors
- [ ] Sort buttons work for all 4 criteria
- [ ] Tier filter works
- [ ] Participation rates correct
- [ ] Verified member badges appear
- [ ] Last active times format correctly
- [ ] Summary cards show accurate stats
- [ ] Contribution trends chart displays
- [ ] Member growth chart displays
- [ ] Tier distribution pie chart displays
- [ ] Top contributors bar chart displays
- [ ] Real-time updates flowing (if WebSocket)
- [ ] No console errors
- [ ] Mobile responsive verified

---

## 📊 Data Type Reference

### **VaultAnalytics Data Structure**

```typescript
interface VaultMetric {
  currentTVL: number;
  tvlHistory: Array<{ date: string; tvl: number }>;
  currentAPY: number;
  apyHistory: Array<{ date: string; apy: number; benchmark: number }>;
  assets: Array<{ name: string; amount: number; percentage: number }>;
  withdrawals: Array<{ date: string; amount: number }>;
  riskMetrics: {
    liquidityRatio: number;      // 0-1
    concentrationRisk: number;   // 0-1
    volatility: number;          // 0-1
    riskScore: number;           // 0-100
  };
}
```

### **ContributionAnalytics Data Structure**

```typescript
interface ContributionMember {
  userId: string;
  name: string;
  tier: 'founder' | 'elder' | 'champion' | 'contributor' | 'participant';
  contributions: number;
  weightedScore: number;
  votes: number;
  proposals: number;
  participationRate: number;    // 0-100
  lastActive: string;           // ISO date
  verified: boolean;
  avatar?: string;
}

interface ContributionAnalytics {
  summary: {
    totalContributors: number;
    totalContributions: number;
    averagePerMember: number;
    participationRate: number;   // 0-100
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
      participant: number;
    };
  }>;
  members: ContributionMember[];
  distribution: Array<{
    tier: string;
    count: number;
    percentage: number;
  }>;
}
```

---

## 🔄 Real-Time Data Merging Strategy

### **How It Works**

```
1. Component mounts → Call useXxxAnalytics hook
2. Hook fetches REST API → Get historical data
3. Hook subscribes to WebSocket → Listen for updates
4. REST data arrives → Display in UI
5. Real-time update arrives → Merge with existing data
6. Merged data → UI updates in place (no flicker)
7. Time range changes → Refetch with new timeframe
```

### **Example: VaultAnalyticsTab**

```typescript
// REST API provides baseline
const { data: vaultData } = useVaultAnalytics({
  daoId,
  vaultId,
  timeframe: selectedTimeRange,
  apiBaseUrl,
});

// WebSocket provides real-time updates
const { data: realtimeData, isConnected } = useRealtimeMetrics(
  `vault:${vaultId}:metrics`
);

// Merge in useEffect
useEffect(() => {
  if (vaultData) {
    let merged = vaultData;
    
    if (realtimeData && isConnected) {
      merged = {
        ...merged,
        currentTVL: realtimeData.currentTVL ?? merged.currentTVL,
        currentAPY: realtimeData.currentAPY ?? merged.currentAPY,
        // ... merge other real-time fields
      };
    }
    
    setDisplayData(merged);
  }
}, [vaultData, realtimeData, isConnected]);
```

---

## 🚀 Next Steps After Wednesday

### **By End of Wednesday**
✅ Both tabs showing real API data  
✅ Real-time updates flowing (or polling fallback)  
✅ All sorting/filtering/searching working  
✅ Zero console errors  

### **Thursday: Build LeaderboardDisplay**
- Implement new component (350+ LOC)
- Integrate into dashboard
- Connect to member data
- Add pagination/virtualization

### **Friday: Testing & Deployment**
- Unit tests for all components (78%+ coverage)
- Integration tests (end-to-end data flow)
- Performance testing (< 2s load, < 500ms updates)
- Accessibility audit (WCAG 2.1 AA)
- Deploy to production

---

## 📞 Support Files

All implementation details in:
- **TUESDAY_VAULT_DATA_GUIDE.md** - Vault API setup & debugging
- **WEDNESDAY_CONTRIBUTION_DATA_GUIDE.md** - Contribution API setup & debugging
- **useVaultAnalytics.ts** - Hook with full documentation
- **useContributionAnalytics.ts** - Hook with full documentation

---

## 🎯 Success Criteria

**Tuesday Complete When**:
- ✅ Vault metrics load from real API
- ✅ All 6 charts display real data
- ✅ Time range selector updates charts
- ✅ Real-time status indicator working
- ✅ No console errors

**Wednesday Complete When**:
- ✅ Member table loads from real API
- ✅ 20+ members display
- ✅ Sorting by all 4 criteria works
- ✅ Tier filter works
- ✅ Real-time updates flowing
- ✅ No console errors

---

**Ready to integrate real API data!** 🚀
