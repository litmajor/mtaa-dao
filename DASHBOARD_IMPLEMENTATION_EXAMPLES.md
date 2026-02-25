# Dashboard Implementation Examples - All Personas

Complete examples for implementing Yuki and Amara dashboards using the new API system.

## 🎯 Okedi Dashboard (Beginner)

**Status:** ✅ **COMPLETE**

**File:** `client/src/components/dashboard/OkediDashboard.tsx`

**API Call:**
```typescript
import { getOkediDashboard } from '@/api/dashboardApi';

useEffect(() => {
  const loadData = async () => {
    try {
      const data = await getOkediDashboard();
      setData(data);
    } catch (error) {
      setError(error.message);
    }
  };
  loadData();
}, []);
```

**Use Cases:**
- New DAO members
- Token holders
- Casual users
- Simple overview of activity

---

## 🎯 Yuki Dashboard (Intermediate)

**Status:** 📋 **Template Below**

**File:** `client/src/components/dashboard/YukiDashboard.tsx` (create this file)

**Template Implementation:**

```typescript
import React, { useState, useEffect } from 'react';
import { getYukiDashboard } from '@/api/dashboardApi';

interface YukiDashboardData {
  personalBalance: number;
  daoTreasury: number;
  pendingActions: Array<{
    id: string;
    type: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  investmentPools: Array<{
    id: string;
    name: string;
    allocation: number;
    roi: number;
    participants: number;
  }>;
  poolShares: Array<{
    poolId: string;
    shares: number;
    value: number;
    apy: number;
  }>;
  liquidityProviding: Array<{
    poolId: string;
    poolName: string;
    liquidityValue: number;
    rewards: number;
  }>;
  governanceOpportunities: Array<{
    daoId: string;
    daoName: string;
    role: string;
    votingPower: number;
  }>;
  analyticsMetrics: {
    totalInvested: number;
    totalReturns: number;
    averageROI: number;
    riskScore: number;
  };
  upcomingEvents: Array<{
    id: string;
    name: string;
    date: string;
    type: string;
  }>;
}

export default function YukiDashboard() {
  const [data, setData] = useState<YukiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const dashboardData = await getYukiDashboard();
        
        if (isMounted) {
          setData(dashboardData);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError((err as any)?.message || 'Failed to load dashboard');
          setLoading(false);
        }
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, []);

  if (loading) return <div>Loading Yuki Dashboard...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No data available</div>;

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Portfolio Overview</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-slate-400">Personal Balance</p>
            <p className="text-2xl font-bold">${data.personalBalance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-400">DAO Treasury</p>
            <p className="text-2xl font-bold">${data.daoTreasury.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-400">Total Returns</p>
            <p className="text-2xl font-bold text-green-400">+${data.analyticsMetrics.totalReturns.toFixed(2)}</p>
          </div>
        </div>
      </section>

      {/* Investment Pools */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Your Investment Pools</h2>
        <div className="space-y-3">
          {data.investmentPools.map(pool => (
            <div key={pool.id} className="bg-slate-700 p-4 rounded">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold">{pool.name}</p>
                  <p className="text-sm text-slate-400">{pool.participants} participants</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{pool.allocation}%</p>
                  <p className="text-green-400">ROI: +{pool.roi}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Liquidity Providing */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Liquidity Providing</h2>
        <div className="space-y-3">
          {data.liquidityProviding.map(lp => (
            <div key={lp.poolId} className="bg-slate-700 p-4 rounded">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold">{lp.poolName}</p>
                  <p className="text-slate-400">Value: ${lp.liquidityValue}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-semibold">${lp.rewards}</p>
                  <p className="text-sm text-slate-400">Pending Rewards</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pending Actions */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Pending Actions</h2>
        <div className="space-y-2">
          {data.pendingActions.map(action => (
            <div key={action.id} className="bg-slate-700 p-3 rounded flex justify-between items-center">
              <p>{action.description}</p>
              <span className={`px-3 py-1 rounded text-sm ${
                action.priority === 'high' ? 'bg-red-600' : 
                action.priority === 'medium' ? 'bg-yellow-600' : 
                'bg-green-600'
              }`}>
                {action.priority}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## 🎯 Amara Dashboard (Advanced)

**Status:** 📋 **Template Below**

**File:** `client/src/components/dashboard/AmaraDashboard.tsx` (create this file)

**Template Implementation:**

```typescript
import React, { useState, useEffect } from 'react';
import { getAmaraDashboard } from '@/api/dashboardApi';

interface AmaraDashboardData {
  daoGovernanceMetrics: {
    totalDAOs: number;
    adminsIn: number;
    treasuryManaged: number;
    decisions: number;
    averageApprovalRate: number;
  };
  governanceActivities: Array<{
    id: string;
    daoId: string;
    daoName: string;
    action: string;
    status: 'pending' | 'approved' | 'rejected';
    votesFor: number;
    votesAgainst: number;
    deadline: string;
  }>;
  treasuryAnalytics: {
    totalManaged: number;
    monthlyInflow: number;
    monthlyOutflow: number;
    allocations: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
  strategicInitiatives: Array<{
    id: string;
    name: string;
    status: 'planning' | 'in_progress' | 'completed';
    progress: number;
    budget: number;
    impact: string;
  }>;
  communityHealth: {
    memberSentiment: number;
    activityLevel: number;
    retentionRate: number;
    engagementScore: number;
  };
  advancedReports: Array<{
    id: string;
    name: string;
    lastGenerated: string;
    metrics: Record<string, number>;
  }>;
}

export default function AmaraDashboard() {
  const [data, setData] = useState<AmaraDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const dashboardData = await getAmaraDashboard();
        
        if (isMounted) {
          setData(dashboardData);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError((err as any)?.message || 'Failed to load dashboard');
          setLoading(false);
        }
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, []);

  if (loading) return <div>Loading Amara Dashboard...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No data available</div>;

  return (
    <div className="space-y-6">
      {/* Governance Metrics */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Governance Metrics</h2>
        <div className="grid grid-cols-5 gap-4">
          <div>
            <p className="text-slate-400">DAOs Managed</p>
            <p className="text-2xl font-bold">{data.daoGovernanceMetrics.totalDAOs}</p>
          </div>
          <div>
            <p className="text-slate-400">Admin In</p>
            <p className="text-2xl font-bold">{data.daoGovernanceMetrics.adminsIn}</p>
          </div>
          <div>
            <p className="text-slate-400">Treasury</p>
            <p className="text-2xl font-bold">${(data.daoGovernanceMetrics.treasuryManaged / 1000000).toFixed(1)}M</p>
          </div>
          <div>
            <p className="text-slate-400">Decisions</p>
            <p className="text-2xl font-bold">{data.daoGovernanceMetrics.decisions}</p>
          </div>
          <div>
            <p className="text-slate-400">Approval Rate</p>
            <p className="text-2xl font-bold">{data.daoGovernanceMetrics.averageApprovalRate}%</p>
          </div>
        </div>
      </section>

      {/* Active Governance */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Active Governance</h2>
        <div className="space-y-4">
          {data.governanceActivities.map(activity => (
            <div key={activity.id} className="bg-slate-700 p-4 rounded">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold">{activity.daoName}</p>
                  <p className="text-sm text-slate-400">{activity.action}</p>
                </div>
                <span className={`px-3 py-1 rounded text-sm ${
                  activity.status === 'approved' ? 'bg-green-600' :
                  activity.status === 'rejected' ? 'bg-red-600' :
                  'bg-yellow-600'
                }`}>
                  {activity.status}
                </span>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-sm text-green-400">For: {activity.votesFor}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-red-400">Against: {activity.votesAgainst}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm text-slate-400">Deadline: {activity.deadline}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Treasury Analytics */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Treasury Analytics</h2>
        <div className="mb-4">
          <p className="text-slate-400">Total Managed</p>
          <p className="text-3xl font-bold">${data.treasuryAnalytics.totalManaged.toLocaleString()}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-700 p-3 rounded">
            <p className="text-slate-400">Monthly Inflow</p>
            <p className="text-green-400 font-semibold">${data.treasuryAnalytics.monthlyInflow.toLocaleString()}</p>
          </div>
          <div className="bg-slate-700 p-3 rounded">
            <p className="text-slate-400">Monthly Outflow</p>
            <p className="text-red-400 font-semibold">${data.treasuryAnalytics.monthlyOutflow.toLocaleString()}</p>
          </div>
        </div>
        <div className="space-y-2">
          {data.treasuryAnalytics.allocations.map((alloc, idx) => (
            <div key={idx}>
              <div className="flex justify-between mb-1">
                <p className="text-sm">{alloc.category}</p>
                <p className="text-sm font-semibold">{alloc.percentage}%</p>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${alloc.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Community Health */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Community Health</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-slate-400 text-sm">Member Sentiment</p>
            <p className="text-2xl font-bold">{data.communityHealth.memberSentiment}%</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Activity Level</p>
            <p className="text-2xl font-bold">{data.communityHealth.activityLevel}%</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Retention Rate</p>
            <p className="text-2xl font-bold">{data.communityHealth.retentionRate}%</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Engagement Score</p>
            <p className="text-2xl font-bold">{data.communityHealth.engagementScore}/100</p>
          </div>
        </div>
      </section>

      {/* Strategic Initiatives */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Strategic Initiatives</h2>
        <div className="space-y-4">
          {data.strategicInitiatives.map(initiative => (
            <div key={initiative.id} className="bg-slate-700 p-4 rounded">
              <div className="flex justify-between mb-2">
                <p className="font-semibold">{initiative.name}</p>
                <span className="text-sm text-slate-400">{initiative.progress}% Complete</span>
              </div>
              <div className="w-full bg-slate-600 rounded-full h-2 mb-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all" 
                  style={{ width: `${initiative.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <p>Budget: ${initiative.budget.toLocaleString()}</p>
                <p>Impact: {initiative.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## 🔄 Integration Steps

### For Yuki Dashboard:
1. Copy template above to `client/src/components/dashboard/YukiDashboard.tsx`
2. Import in your router/layout
3. Call the component when user has Yuki persona
4. Add route `/dashboard/yuki`
5. Test with `getYukiDashboard()` API call

### For Amara Dashboard:
1. Copy template above to `client/src/components/dashboard/AmaraDashboard.tsx`
2. Import in your router/layout
3. Call the component when user has Amara persona
4. Add route `/dashboard/amara`
5. Test with `getAmaraDashboard()` API call

### Router Implementation:
```typescript
import OkediDashboard from '@/components/dashboard/OkediDashboard';
import YukiDashboard from '@/components/dashboard/YukiDashboard';
import AmaraDashboard from '@/components/dashboard/AmaraDashboard';

function DashboardRouter() {
  const [persona, setPersona] = useState<'okedi' | 'yuki' | 'amara'>('okedi');

  return (
    <>
      {persona === 'okedi' && <OkediDashboard />}
      {persona === 'yuki' && <YukiDashboard />}
      {persona === 'amara' && <AmaraDashboard />}
    </>
  );
}
```

---

## ✅ Verification Checklist

After implementing all three dashboards:

- [ ] All three components render without errors
- [ ] API calls return proper data for each persona
- [ ] Routing switches between personas correctly
- [ ] Error states display properly
- [ ] Loading states appear during data fetch
- [ ] All data fields display correctly
- [ ] Responsive design works on mobile
- [ ] Console has no errors
- [ ] Network tab shows successful API calls
- [ ] Data updates when backend changes

---

**Status:** Templates ready for implementation  
**Next Step:** Implement Yuki and Amara dashboards using templates above
