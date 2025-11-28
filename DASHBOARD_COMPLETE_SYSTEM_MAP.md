# Dashboard Complete System Map

## Overview
The dashboard is a comprehensive, tabbed interface that serves as the main hub for all user interactions. It implements a hierarchical page tracking system with 6 main pages, 5 DAO nested tabs, and additional "More" menu items.

---

## Core Architecture

### Data Structure
```typescript
interface DashboardData {
  // Profile
  user: {
    name: string;
    avatar: string;
    walletAddress: string;
    joinDate: string;
  };

  // Portfolio Stats
  portfolio: {
    total: number;
    invested: number;
    earned: number;
    change24h: number;
  };

  // DAO Stats
  daoStats: {
    memberships: number;
    daosManaged: number;
    stakedAmount: number;
  };

  // Community Stats
  communityStats: {
    members: number;
    discussions: number;
    proposals: number;
  };

  // Referral Stats
  referralStats: {
    referrals: number;
    earnings: number;
    pendingRewards: number;
  };

  // Vaults
  vaults: Array<{
    id: string;
    name: string;
    type: string;
    balance: number;
    apy: number;
  }>;

  // Analytics
  portfolioValue: Array<{
    date: string;
    value: number;
  }>;
  performanceData: Array<{
    month: string;
    return: number;
  }>;
}
```

---

## Page Tracking System

### PAGE_TRACKER Object
```typescript
const PAGE_TRACKER = {
  main: [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'portfolio', label: 'Portfolio', icon: TrendingUp },
    { id: 'daos', label: 'DAOs', icon: Users },
    { id: 'community', label: 'Community', icon: MessageSquare },
    { id: 'referrals', label: 'Referrals', icon: Share2 },
    { id: 'wallet', label: 'Wallet', icon: Wallet }
  ],
  daoNested: [
    { id: 'dao-overview', label: 'Overview', parent: 'daos' },
    { id: 'dao-members', label: 'Members', parent: 'daos' },
    { id: 'dao-proposals', label: 'Proposals', parent: 'daos' },
    { id: 'dao-treasury', label: 'Treasury', parent: 'daos' },
    { id: 'dao-settings', label: 'Settings', parent: 'daos' }
  ]
};
```

**Page Counts:**
- **Main Pages:** 6
- **DAO Nested Tabs:** 5
- **More Menu:** Variable (dynamic based on implementation)
- **Total:** 11 + More pages

---

## Tab Structure

### 1. **Dashboard Tab** (`value="dashboard"`)
Main overview showing key metrics and status.

**Components:**
- User profile card (avatar, name, wallet, join date)
- Portfolio overview card
  - Total portfolio value
  - Invested amount
  - Earned amount
  - 24h change percentage

**Display Logic:**
```tsx
<TabsContent value="dashboard" className="space-y-4">
  {/* Profile Card */}
  <Card>
    <CardContent>
      <div className="flex items-center gap-4">
        <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full" />
        <div>
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-gray-600">{user.walletAddress}</p>
          <p className="text-xs text-gray-500">Joined {user.joinDate}</p>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Portfolio Card */}
  <Card>
    <CardHeader>
      <CardTitle>Portfolio Overview</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-600">Total Portfolio</p>
          <p className="text-2xl font-bold">${(portfolio.total / 1000).toFixed(1)}K</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Invested</p>
          <p className="text-2xl font-bold">${(portfolio.invested / 1000).toFixed(1)}K</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Earned</p>
          <p className="text-2xl font-bold text-green-600">${(portfolio.earned / 1000).toFixed(1)}K</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">24h Change</p>
          <p className="text-2xl font-bold text-blue-600">{portfolio.change24h}%</p>
        </div>
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

---

### 2. **Portfolio Tab** (`value="portfolio"`)
Detailed portfolio management and viewing.

**Components:**
- Portfolio metrics overview
- Investment breakdown
- Performance tracking

**Current Display:**
```tsx
<TabsContent value="portfolio" className="space-y-4">
  {/* Portfolio details will be rendered here */}
  {/* Mirrors dashboard portfolio overview but more detailed */}
</TabsContent>
```

---

### 3. **DAOs Tab** (`value="daos"`)
Primary DAO management interface with nested tabs.

**Nested Sub-Tabs:**

#### 3a. Overview
```tsx
<TabsContent value="overview" className="space-y-4">
  <Card>
    <CardHeader><CardTitle>Your DAOs</CardTitle></CardHeader>
    <CardContent>
      <div className="space-y-3">
        {/* Displays: DAO name, description, member count, treasury balance */}
        {data.daos.map((dao) => (
          <div key={dao.id} className="p-4 border rounded-lg">
            <p className="font-semibold">{dao.name}</p>
            <p className="text-sm text-gray-600">{dao.description}</p>
            <div className="flex justify-between mt-2">
              <span>{dao.members} members</span>
              <span>${(dao.treasury / 1000).toFixed(1)}K in treasury</span>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

#### 3b. Members
```tsx
<TabsContent value="members" className="space-y-4">
  <Card>
    <CardHeader><CardTitle>DAO Members</CardTitle></CardHeader>
    <CardContent>
      <div className="space-y-2">
        {/* Displays: member avatar, name, role, join date */}
        {data.daoMembers.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-3 border rounded">
            <div className="flex items-center gap-3">
              <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
              <div>
                <p className="font-semibold text-sm">{member.name}</p>
                <p className="text-xs text-gray-600">{member.role}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">Joined {member.joinDate}</p>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

#### 3c. Proposals
```tsx
<TabsContent value="proposals" className="space-y-4">
  <Card>
    <CardHeader>
      <div className="flex justify-between items-center">
        <CardTitle>Proposals</CardTitle>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          New Proposal
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {/* Displays: proposal title, status, vote count, end date */}
        {data.proposals.map((proposal) => (
          <div key={proposal.id} className="p-4 border rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <p className="font-semibold">{proposal.title}</p>
              <Badge variant={proposal.status === 'Active' ? 'default' : 'outline'}>
                {proposal.status}
              </Badge>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-sm">{proposal.votes} votes</span>
              <span className="text-xs text-gray-600">Ends {proposal.endDate}</span>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

#### 3d. Treasury
```tsx
<TabsContent value="treasury" className="space-y-4">
  <Card>
    <CardHeader><CardTitle>Treasury Overview</CardTitle></CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-600">Total Balance</p>
          <p className="text-2xl font-bold">${(data.treasuryStats.balance / 1000).toFixed(1)}K</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Allocation</p>
          <p className="text-2xl font-bold">{data.treasuryStats.allocation}%</p>
        </div>
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

#### 3e. Settings
```tsx
<TabsContent value="settings" className="space-y-4">
  <Card>
    <CardHeader><CardTitle>DAO Settings</CardTitle></CardHeader>
    <CardContent>
      {/* Configuration controls for DAO parameters */}
    </CardContent>
  </Card>
</TabsContent>
```

---

### 4. **Community Tab** (`value="community"`)
Community engagement and discussions.

**Components:**
- Member count display
- Discussion count
- Proposal count

```tsx
<TabsContent value="community" className="space-y-4">
  <Card>
    <CardHeader><CardTitle>Community Stats</CardTitle></CardHeader>
    <CardContent>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-600">Members</p>
          <p className="text-2xl font-bold">{data.communityStats.members}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Discussions</p>
          <p className="text-2xl font-bold">{data.communityStats.discussions}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Proposals</p>
          <p className="text-2xl font-bold">{data.communityStats.proposals}</p>
        </div>
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

---

### 5. **Referrals Tab** (`value="referrals"`)
Referral program management and tracking.

**Components:**
- Total referrals count
- Referral earnings
- Pending rewards

```tsx
<TabsContent value="referrals" className="space-y-4">
  <div className="grid grid-cols-3 gap-4">
    <Card>
      <CardHeader><CardTitle className="text-sm">Referrals</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{data.referralStats.referrals}</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-sm">Earnings</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">${(data.referralStats.earnings / 1000).toFixed(1)}K</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-sm">Pending Rewards</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">${(data.referralStats.pendingRewards / 1000).toFixed(1)}K</p>
      </CardContent>
    </Card>
  </div>
</TabsContent>
```

---

### 6. **Vaults Tab** (`value="vaults"`)
Investment vaults management.

**Components:**
- Create new vault button
- List of all vaults with metrics

```tsx
<TabsContent value="vaults" className="space-y-4">
  <Card>
    <CardHeader>
      <div className="flex justify-between items-center">
        <CardTitle>Investment Vaults</CardTitle>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          New Vault
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {/* Displays: vault name, type, balance, APY */}
        {data.vaults.map((vault) => (
          <div key={vault.id} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">{vault.name}</p>
              <Badge variant="outline">{vault.type}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600">Balance</p>
                <p className="font-semibold">${(vault.balance / 1000).toFixed(1)}K</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">APY</p>
                <p className="font-semibold text-green-600">{vault.apy}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

---

### 7. **Analytics Tab** (`value="analytics"`)
Performance and portfolio analytics.

**Components:**
- Portfolio value area chart
- Monthly performance bar chart

```tsx
<TabsContent value="analytics" className="space-y-4">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {/* Portfolio Value Chart */}
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Value</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data.portfolioValue}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#8b5cf6"
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>

    {/* Monthly Performance Chart */}
    <Card>
      <CardHeader>
        <CardTitle>Monthly Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.performanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip />
            <Bar dataKey="return" fill="#8b5cf6" name="Return %" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  </div>
</TabsContent>
```

---

### 8. **More Menu Tab** (`value="more"`)
Extensible menu for additional features.

**Components:**
- Dynamic page cards grid
- Empty state fallback

```tsx
<TabsContent value="more" className="space-y-4">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {availableMorePages.map((page) => {
      const IconComponent = (page.icon as any) || Activity;
      return (
        <Card key={page.id} className="hover:shadow-lg transition-all cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <IconComponent className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold">{page.label}</p>
                  <p className="text-xs text-gray-500">Manage your {page.label.toLowerCase()}</p>
                </div>
              </div>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      );
    })}
  </div>
  {availableMorePages.length === 0 && (
    <Card className="text-center py-12">
      <p className="text-gray-600">No additional features available yet</p>
    </Card>
  )}
</TabsContent>
```

---

## Page Tracker Footer

Located at the bottom of the dashboard, displays a summary of all pages:

```tsx
<Card className="bg-gray-50 dark:bg-gray-800">
  <CardHeader className="pb-3">
    <CardTitle className="text-sm">Dashboard Navigation Tracker</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2 text-sm">
      {/* Core Pages Section */}
      <div>
        <p className="font-semibold mb-1">Core Pages (6)</p>
        <div className="flex flex-wrap gap-2">
          {PAGE_TRACKER.main.map((page) => (
            <Badge key={page.id} variant="outline">{page.label}</Badge>
          ))}
        </div>
      </div>

      {/* DAO Nested Tabs Section */}
      <div>
        <p className="font-semibold mb-1">DAO Nested Tabs (5)</p>
        <div className="flex flex-wrap gap-2">
          {PAGE_TRACKER.daoNested.map((page) => (
            <Badge key={page.id} variant="outline">{page.label}</Badge>
          ))}
        </div>
      </div>

      {/* More Menu Section */}
      <div>
        <p className="font-semibold mb-1">More Menu ({availableMorePages.length})</p>
        <div className="flex flex-wrap gap-2">
          {availableMorePages.map((page) => (
            <Badge key={page.id} variant="secondary">{page.label}</Badge>
          ))}
        </div>
      </div>

      {/* Total Pages Count */}
      <div className="pt-2 border-t">
        <p className="text-xs text-gray-600">
          Total Pages: {PAGE_TRACKER.main.length + PAGE_TRACKER.daoNested.length + availableMorePages.length}
        </p>
      </div>
    </div>
  </CardContent>
</Card>
```

---

## Navigation Logic

### Tab Rendering
The dashboard uses Shadcn UI `Tabs` component with the following structure:

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
  {/* Tab List */}
  <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
    <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
    <TabsTrigger value="daos">DAOs</TabsTrigger>
    <TabsTrigger value="community">Community</TabsTrigger>
    <TabsTrigger value="referrals">Referrals</TabsTrigger>
    <TabsTrigger value="vaults">Vaults</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    <TabsTrigger value="more">More</TabsTrigger>
  </TabsList>

  {/* Tab Content - Rendered conditionally */}
  <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
    {/* ... nested tab structure for DAOs ... */}
  </Tabs>
</Tabs>
```

### Active Tab State
- Primary state: `activeTab` - tracks main 8 tabs
- Secondary state: `activeSubTab` - tracks 5 nested DAO tabs (Overview, Members, Proposals, Treasury, Settings)

---

## Data Flow

### Initial Load
1. User navigates to dashboard
2. Component mounts and fetches `DashboardData`
3. Data is stored in state
4. Default tab is "dashboard"
5. If user is on "daos" tab, default sub-tab is "overview"

### User Interaction
1. User clicks tab trigger
2. Active tab state updates
3. Content re-renders for new tab
4. If tab is "daos", checks active sub-tab
5. Renders appropriate nested content

### Data Updates
- Portfolio metrics update on user portfolio changes
- DAO data updates when DAOs are created/modified
- Community stats refresh when members join/proposals change
- Referral data updates when new referrals are made
- Vault data updates when new vaults are created

---

## Key Features

### 1. **Responsive Layout**
- Mobile: Single column layout
- Tablet: 2 column grid for analytics
- Desktop: 4 column grid for main metrics, full width analytics

### 2. **Tab Navigation**
- 8 primary tabs + 5 nested DAO tabs
- Smooth tab transitions
- Persistent tab state during session

### 3. **Data Visualization**
- Area chart for portfolio value trends
- Bar chart for monthly performance
- Grid layouts for metric cards

### 4. **Dynamic Content**
- "More" menu expands based on available features
- Page tracker shows total page count
- Empty states when no data available

### 5. **Visual Hierarchy**
- Profile card at top for user context
- Key metrics in 2x2 or 4-column grid
- Nested sections for complex data (DAO members, proposals)
- Color-coded badges for status (Active/Inactive)

---

## Implementation Notes

### Styling
- Uses Tailwind CSS for responsive design
- Shadcn UI components for consistency
- Purple (#8b5cf6) as primary brand color
- Gray color scale for secondary elements
- Green for positive indicators (earnings, APY)

### Performance Considerations
- Tabs only render visible content (lazy loading)
- Charts use Recharts for optimization
- Grid layouts use CSS Grid for efficient rendering
- Badge components use `map()` for dynamic rendering

### Extensibility
- `PAGE_TRACKER` object easily extended with new pages
- `availableMorePages` array supports dynamic feature addition
- Data structure allows for easy addition of new metrics
- Tab structure supports adding more nested tabs to DAOs or other sections

---

## Complete Tab Manifest

| Tab | Value | Type | Display | Nested |
|-----|-------|------|---------|--------|
| Dashboard | `dashboard` | Main | Profile + Portfolio Overview | No |
| Portfolio | `portfolio` | Main | Portfolio Details | No |
| DAOs | `daos` | Main | DAO List | Yes (5 tabs) |
| Community | `community` | Main | Community Stats | No |
| Referrals | `referrals` | Main | Referral Metrics | No |
| Vaults | `vaults` | Main | Vault List | No |
| Analytics | `analytics` | Main | Charts | No |
| More | `more` | Main | Dynamic Features | No |
| Overview | `overview` | Nested (DAOs) | DAO List | No |
| Members | `members` | Nested (DAOs) | Member List | No |
| Proposals | `proposals` | Nested (DAOs) | Proposal List | No |
| Treasury | `treasury` | Nested (DAOs) | Treasury Stats | No |
| Settings | `settings` | Nested (DAOs) | DAO Settings | No |

**Total: 13 tabs (8 main + 5 nested)**

---

## Summary

The dashboard implements a comprehensive, multi-layered tabbed interface that serves as the central hub for all user activities. With 11+ pages tracked through a dedicated `PAGE_TRACKER` system, dynamic nested tabs for DAO management, and extensible "More" menu system, it provides a scalable foundation for platform growth. The system maintains clean separation between primary tabs, nested DAO functions, and additional features while providing visual feedback through badges and charts.
