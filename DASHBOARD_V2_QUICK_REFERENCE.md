# Dashboard v2.0 Quick Reference Guide

## 🚀 Quick Start

```typescript
// Import the new dashboard
import ComprehensiveDashboardV2 from '@/pages/dashboard-v2';

// Use in your router
<Route path="/dashboard" element={<ComprehensiveDashboardV2 />} />
```

---

## 📋 Page Structure at a Glance

### Main Navigation (7 Tabs)
```
[DAOs] [Wallet] [Profile] [Referrals] [Vaults] [Analytics] [More]
```

### DAOs Tab (When Selected)
```
DAO Selection Cards
    ↓
Nested Tabs: [Overview] [Governance] [Treasury] [Members] [Settings]
```

---

## 🎯 Key Components

### Summary Metrics (4 Cards)
```
[Total Assets] [Monthly Return] [Your DAOs] [Pending]
```

### DAO Card (Selectable)
```
┌─────────────────────────────┐
│ 🏗️ TechDAO                  │
│ 234 members                 │
│ [Active Badge]              │
└─────────────────────────────┘
```

### DAO Details (When Selected)
```
Gradient Header: TechDAO | Description
─────────────────────────────────────────
Quick Stats: [Members] [TVL] [Proposals] [Volume]
─────────────────────────────────────────
Nested Tabs with Content:
  - Overview: Treasury Pie Chart + Activity Feed
  - Governance: Active Proposals + Voting UI
  - Treasury: Asset List + Balance
  - Members: Member Cards + Badges
  - Settings: Configuration Buttons
```

---

## 🔧 API Integration

### Endpoint Required
```
GET /api/dashboard/complete
```

### Expected Response Shape
```typescript
{
  totalAssets: number,
  monthlyReturn: number,
  userDAOs: [{
    id, name, description, members, tvl,
    status, created, avatar,
    governance: { proposals, activeFundingRound, votingPower },
    treasury: { balance, assets[], lastUpdated },
    stats: { transactionVolume, memberGrowth, proposalsApproved }
  }],
  features: { kyc: bool, pools: bool, ... },
  // ... other fields
}
```

---

## 🎨 Styling Classes Used

### Layout
- `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4` - Responsive grid
- `space-y-4` - Vertical spacing
- `gap-4` - Consistent gaps

### Colors
- `text-green-600` - Success states
- `text-purple-600` - Primary brand
- `text-blue-500` - Secondary
- `bg-gray-50` - Subtle backgrounds

### Effects
- `hover:shadow-lg` - Card hover
- `hover:scale-105` - Scale animation
- `rounded-lg` - Border radius
- `transition-all` - Smooth transitions

### Responsive
- `text-xs sm:text-sm` - Responsive text
- `md:` prefix - Medium screens
- `lg:` prefix - Large screens
- `dark:` prefix - Dark mode

---

## 🔐 Feature Gating Implementation

### In Dashboard
```typescript
// Available More Menu Pages:
availableMorePages = PAGE_TRACKER.moreMenu.filter(
  (page) => !page.gate || data.features[page.gate]
);

// Rendered if:
// 1. No gate defined, OR
// 2. data.features[gateName] === true
```

### Adding New Feature Gate
1. Add to `PAGE_TRACKER.moreMenu`:
```typescript
{
  id: 'mynewpage',
  label: 'My New Page',
  icon: MyIcon,
  gate: FEATURE_GATES.MY_FEATURE
}
```

2. Add to `FEATURE_GATES` const:
```typescript
MY_FEATURE: 'myfeature'
```

3. Include in backend `features` object

---

## 📊 Data Flow

```
User Logs In
    ↓
Auth Context Initialized (auth-context.tsx)
    ↓
useQuery fetches /api/dashboard/complete
    ↓
Data cached by React Query
    ↓
Dashboard renders with:
  - Summary metrics
  - User's DAOs
  - Wallet info
  - Referral stats
  - Feature gates applied
    ↓
Every 30s: refetchInterval auto-refreshes
```

---

## 🧩 Component Hierarchy

```
ComprehensiveDashboardV2
├── Header (Welcome, User Name)
├── Summary Metrics (4 Cards)
├── Main Tabs Container
│   ├── DAOs Tab
│   │   ├── DAO Selection Cards
│   │   ├── DaoTab Component (conditional)
│   │   │   ├── DAO Header (Gradient)
│   │   │   ├── Quick Stats
│   │   │   └── Nested Tabs
│   │   │       ├── Overview
│   │   │       ├── Governance
│   │   │       ├── Treasury
│   │   │       ├── Members
│   │   │       └── Settings
│   │   └── DAO of the Week
│   ├── Wallet Tab
│   ├── Profile Tab
│   ├── Referrals Tab
│   ├── Vaults Tab
│   ├── Analytics Tab
│   └── More Tab (Feature-Gated)
└── Page Tracker Footer
```

---

## 🛠️ Customization

### Change Primary Color
```typescript
// Replace all 'purple-600' with your color:
const COLOR = 'blue-600';
// Or use CSS variables
```

### Add New DAO Stat Card
```typescript
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm">Your Stat</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold">{value}</p>
  </CardContent>
</Card>
```

### Modify More Menu Pages
Edit `PAGE_TRACKER.moreMenu` array with new pages.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Dashboard shows "Login required" | Check auth-context, ensure user is authenticated |
| No DAOs displayed | Check mock data in fetchDashboardData, verify API returns userDAOs array |
| Feature-gated pages not showing | Verify data.features object includes the gate, check feature name matches |
| Charts not rendering | Ensure Recharts data format: `[{ date/month: string, value/return: number }]` |
| Mobile layout broken | Check grid classes, ensure responsive breakpoints used (md:, lg:) |
| TypeScript errors | All types defined in `DashboardData` interface at top of file |

---

## 📱 Mobile Optimization

```
Mobile Adjustments:
- Tabs use text-xs sizing
- Icons show next to labels
- Cards stack vertically
- 1-column grid on mobile
- 2-column on tablets
- 4-column on desktop
```

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| `dashboard-v2.tsx` | Main component (850+ lines) |
| `DASHBOARD_V2_DOCUMENTATION.ts` | Full page inventory |
| `auth-context.tsx` | Session management |
| `schema.ts` | Database types |
| `auth-session.ts` | Session routes (reference) |

---

## ✅ Pre-Deployment Checklist

- [ ] API endpoint `/api/dashboard/complete` implemented
- [ ] Feature gates returned in `features` object
- [ ] Mock data verified for dev environment
- [ ] All charts render correctly
- [ ] Mobile layout tested on iOS/Android
- [ ] Dark mode verified
- [ ] TypeScript compilation passes (0 errors)
- [ ] Session persistence working
- [ ] All images/icons loading
- [ ] Accessibility tested (keyboard nav, screen readers)

---

## 🎓 Learning Resources

- Recharts: `https://recharts.org/`
- shadcn/ui: `https://ui.shadcn.com/`
- Tailwind CSS: `https://tailwindcss.com/`
- React Query: `https://tanstack.com/query/latest`
- Lucide Icons: `https://lucide.dev/`

---

**Dashboard v2.0 is production-ready!** 🚀
