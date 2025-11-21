# Week 2 Implementation: Admin Dashboard & Backend Integration

## 🎯 Week 2 Overview

**Objective**: Build production-ready admin dashboard that connects to the database-persisted APIs from Week 1.

**Timeline**: 5 days (Mon-Fri)
**Focus Areas**:
1. Admin dashboard pages (7 pages)
2. Real data integration (API calls)
3. RBAC enforcement (super_admin only)
4. Settings persistence UI
5. Beta access management UI
6. Analytics visualization
7. System health monitoring

**Expected Output**: 15+ production pages, 2000+ lines of UI code, full admin suite

---

## 📋 Week 1 Recap: What's Production-Ready

### Backend APIs (All Implemented ✅)

**Settings Management**
- `GET /api/admin/settings` - Fetch all settings from database
- `PUT /api/admin/settings` - Update and persist settings + audit log

**Analytics**
- `GET /api/admin/analytics` - Real metrics (revenue, reputation, health, blockchain info)

**User Management**
- `GET /api/admin/users/list` - List all users with filters
- `PUT /api/admin/users/:userId/ban` - Ban/unban users
- `DELETE /api/admin/users/:userId` - Delete users

**DAO Management**
- `GET /api/admin/daos/list` - List all DAOs
- `PUT /api/admin/daos/:daoId/status` - Update DAO status

**Beta Access (All Persistent ✅)**
- `GET /api/admin/beta-access` - List all beta testers with pagination
- `GET /api/admin/beta-access/:userId` - Get user's beta features
- `POST /api/admin/beta-access` - Grant features to user
- `DELETE /api/admin/beta-access/:userId` - Revoke features from user
- `POST /api/admin/beta-access/bulk` - Grant to multiple users
- `DELETE /api/admin/beta-access/bulk` - Revoke from multiple users

**Feature Flags**
- `GET /api/features` - Get all features + user's enabled features
- `GET /api/admin/features` - Admin view of feature config

**Activity Logs**
- `GET /api/admin/activity-logs` - Get all user activities

**Security**
- `GET /api/admin/security/sessions` - List active sessions
- `DELETE /api/admin/security/sessions/:sessionId` - Revoke session
- `GET /api/admin/security/audit` - Security audit report

---

## 🛠️ Week 2 Tasks Breakdown

### Task 1: Admin Dashboard Layout & Navigation (Mon 9am-12pm)

**Create**: `client/src/pages/admin/` directory structure

```
client/src/pages/admin/
├── AdminDashboard.tsx (main entry point)
├── AnalyticsPage.tsx
├── SettingsPage.tsx
├── UsersPage.tsx
├── DAOsPage.tsx
├── BetaAccessPage.tsx
├── SessionsPage.tsx
├── AuditLogsPage.tsx
├── HealthMonitorPage.tsx
└── components/
    ├── AdminNav.tsx
    ├── SettingsForm.tsx
    ├── UserTable.tsx
    ├── DAOTable.tsx
    ├── BetaAccessTable.tsx
    ├── AnalyticsCard.tsx
    └── SystemHealthCard.tsx
```

**Implementation**:
- Admin routes in App.tsx
- Protected routes (super_admin only)
- Admin layout with sidebar navigation
- Breadcrumb navigation
- Loading states & error boundaries

**Time Estimate**: 3 hours

---

### Task 2: Analytics Dashboard (Mon 1pm-3pm, Tue 9am-11am)

**File**: `client/src/pages/admin/AnalyticsPage.tsx`

**Features**:
- Revenue chart (monthly/quarterly/annual from database)
- Top members reputation leaderboard
- Active DAOs count
- Treasury value
- System health status
- Blockchain info (live block number)
- Feature adoption metrics

**Components**:
- `<RevenueChart />` - Line chart (Chart.js or Recharts)
- `<TopMembersCard />` - List with activity breakdown
- `<SystemHealthCard />` - Status indicators
- `<MetricsGrid />` - Key numbers

**API Integration**:
```typescript
const response = await fetch('/api/admin/analytics', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = response.json();
// Display: data.platform, data.revenueMetrics, data.topMembers, data.systemHealth, etc.
```

**Time Estimate**: 4 hours

---

### Task 3: Settings Management Page (Tue 1pm-4pm, Wed 9am-11am)

**File**: `client/src/pages/admin/SettingsPage.tsx`

**Features**:
- Platform settings (name, maintenance mode, registration, email verification)
- Blockchain settings (network, RPC URL, contract addresses)
- Rate limits (login, register, API)
- Real-time form validation
- Save with loading state
- Success/error messages
- Audit trail (who changed what, when)

**Components**:
- `<PlatformSettings />` - Form with toggle switches
- `<BlockchainSettings />` - Form with text inputs
- `<RateLimitSettings />` - Form with number inputs
- `<SaveButton />` - With loading state
- `<SettingHistory />` - Recent changes from audit logs

**API Integration**:
```typescript
// GET
const response = await fetch('/api/admin/settings', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// PUT
await fetch('/api/admin/settings', {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ section, key, value })
});
```

**Time Estimate**: 4 hours

---

### Task 4: User Management Page (Wed 12pm-3pm, Thu 9am-11am)

**File**: `client/src/pages/admin/UsersPage.tsx`

**Features**:
- List all users with pagination
- Search by email/username
- Filter by role (member, admin, super_admin)
- Ban/unban users
- Delete users
- View user details
- Activity history per user

**Components**:
- `<UserTable />` - Table with sorting, filtering, pagination
- `<UserFilters />` - Search, role filter, date range
- `<BanUserModal />` - Confirmation dialog
- `<UserDetailsModal />` - User info, activity, beta features
- `<DeleteUserModal />` - With confirmation

**API Integration**:
```typescript
// List users
const response = await fetch('/api/admin/users/list?page=1&limit=50', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Ban user
await fetch(`/api/admin/users/${userId}/ban`, {
  method: 'PUT',
  body: JSON.stringify({ isBanned: true })
});

// Delete user
await fetch(`/api/admin/users/${userId}`, {
  method: 'DELETE'
});
```

**Time Estimate**: 4 hours

---

### Task 5: Beta Access Management (Thu 12pm-3pm, Fri 9am-11am)

**File**: `client/src/pages/admin/BetaAccessPage.tsx`

**Features**:
- List all beta testers with features breakdown
- Search users by email
- Grant features to single user
- Bulk grant to multiple users
- Revoke specific features
- Bulk revoke
- Feature adoption metrics

**Components**:
- `<BetaAccessTable />` - List beta testers with feature count
- `<GrantFeaturesModal />` - Select features to grant
- `<BulkGrantModal />` - Select users + features
- `<FeatureMultiSelect />` - Checkbox list of available features
- `<FeatureBreakdown />` - Show which features are enabled for each user

**API Integration**:
```typescript
// List beta testers
const response = await fetch('/api/admin/beta-access?page=1&limit=50', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Get user's features
const userBeta = await fetch(`/api/admin/beta-access/${userId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Grant features
await fetch('/api/admin/beta-access', {
  method: 'POST',
  body: JSON.stringify({ userId, features: ['locked_savings', 'ai_assistant'] })
});

// Bulk grant
await fetch('/api/admin/beta-access/bulk', {
  method: 'POST',
  body: JSON.stringify({ userIds, features })
});

// Revoke features
await fetch(`/api/admin/beta-access/${userId}`, {
  method: 'DELETE',
  body: JSON.stringify({ features: ['locked_savings'] })
});

// Bulk revoke
await fetch('/api/admin/beta-access/bulk', {
  method: 'DELETE',
  body: JSON.stringify({ userIds, features })
});
```

**Time Estimate**: 4 hours

---

### Task 6: DAO Management Page (Fri 12pm-3pm)

**File**: `client/src/pages/admin/DAOsPage.tsx`

**Features**:
- List all DAOs with status
- View DAO details
- Update DAO status (active, suspended, archived)
- View member count
- Treasury balance
- Recent activities

**Components**:
- `<DAOTable />` - Table with sorting, filtering
- `<DAODetailsModal />` - Full DAO info
- `<UpdateDAOStatusModal />` - Status selector
- `<DAOMetrics />` - Members, treasury, activities

**API Integration**:
```typescript
// List DAOs
const response = await fetch('/api/admin/daos/list?page=1&limit=50', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Update DAO status
await fetch(`/api/admin/daos/${daoId}/status`, {
  method: 'PUT',
  body: JSON.stringify({ status: 'suspended' })
});
```

**Time Estimate**: 2.5 hours

---

### Task 7: System Monitoring (Fri 3pm-5pm)

**File**: `client/src/pages/admin/HealthMonitorPage.tsx`

**Features**:
- System health dashboard
- Database status
- Blockchain RPC status
- Payment processor status
- API health
- Recent error logs
- System uptime

**Components**:
- `<SystemHealthCard />` - Status lights
- `<HealthChart />` - Uptime chart (24h)
- `<ErrorLogs />` - Recent errors from audit logs

**Time Estimate**: 1.5 hours

---

## 📝 Implementation Details

### Types/Interfaces (Create: `client/src/types/admin.ts`)

```typescript
interface Analytics {
  platform: {
    totalDAOs: number;
    totalMembers: number;
    activeSubscriptions: number;
    totalTreasury: number;
  };
  revenueMetrics: {
    monthly: number;
    quarterly: number;
    annual: number;
  };
  topMembers: Array<{
    name: string;
    score: number;
    activities: number;
    contributions: number;
    votes: number;
  }>;
  systemHealth: Record<'database' | 'blockchain' | 'payments' | 'api', 'healthy' | 'warning' | 'critical'>;
  chainInfo: {
    chain: string;
    block: string;
    blockNumber: number;
  };
}

interface SystemSettings {
  platform: {
    name: string;
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    requireEmailVerification: boolean;
  };
  blockchain: {
    network: string;
    rpcUrl: string;
    maonoContractAddress: string;
  };
  rateLimits: {
    login: number;
    register: number;
    apiDefault: number;
  };
}

interface BetaUser {
  id: string;
  email: string;
  username: string;
  enabledBetaFeatures: string[];
  featureCount: number;
  createdAt: string;
}

interface AdminUser {
  id: string;
  email: string;
  username: string;
  roles: string;
  isBanned: boolean;
  createdAt: string;
  lastLogin: string;
}
```

---

## 🎨 UI/UX Requirements

- **Color Scheme**: Match existing design (light/dark mode support)
- **Tables**: Sortable, filterable, paginated
- **Forms**: Real-time validation, clear error messages
- **Modals**: Confirm destructive actions
- **Loading**: Spinner on async operations
- **Toasts**: Success/error notifications
- **Responsive**: Works on tablet (admin rarely on mobile)

---

## 🔐 Security Checklist

✅ Verify `super_admin` role on every admin route
✅ Log all admin actions to audit_logs table
✅ CSRF protection on form submissions
✅ Validate input (email, numbers, enums)
✅ Sanitize displayed user data
✅ Rate limit admin endpoints
✅ Encrypt sensitive settings (API keys)
✅ Confirm destructive actions (ban, delete)

---

## 🧪 Testing Strategy

### Unit Tests
- Form validation functions
- Data formatting utilities
- Permission checking functions

### Integration Tests
- Can fetch analytics data
- Can update settings
- Can grant/revoke beta features
- Can manage users
- Can update DAO status

### E2E Tests (Post-Week 2)
- Full admin workflow from login to managing users
- Settings change persistence
- Beta feature grant reflected in /api/features

---

## 📊 Expected Output

| Component | Lines | Tests | Status |
|-----------|-------|-------|--------|
| AnalyticsPage | 300 | 25 | ✅ |
| SettingsPage | 250 | 20 | ✅ |
| UsersPage | 350 | 30 | ✅ |
| BetaAccessPage | 400 | 35 | ✅ |
| DAOsPage | 300 | 25 | ✅ |
| HealthMonitorPage | 200 | 15 | ✅ |
| AdminNav + Components | 400 | 30 | ✅ |
| Types & Utils | 150 | 20 | ✅ |
| **Total** | **2,350** | **200** | ✅ |

---

## 🚀 Deployment Checklist

- [ ] All pages render without errors
- [ ] All API calls authenticated
- [ ] All forms validate input
- [ ] All tables paginate correctly
- [ ] Destructive actions confirmed
- [ ] Error handling graceful
- [ ] Loading states visible
- [ ] Mobile/tablet responsive
- [ ] Dark mode supported
- [ ] Type checking passes
- [ ] Tests passing (80%+ coverage)
- [ ] No console errors

---

## 📅 Daily Breakdown

**Monday**:
- 9am-12pm: Admin layout, navigation, auth
- 1pm-3pm: Start analytics page structure
- Deliverable: Routes working, layout responsive

**Tuesday**:
- 9am-12pm: Finish analytics page with real data
- 1pm-4pm: Start settings page form
- Deliverable: Analytics shows real metrics

**Wednesday**:
- 9am-12pm: Finish settings page, test persistence
- 1pm-3pm: Start users page table
- Deliverable: Settings can be updated and saved

**Thursday**:
- 9am-12pm: Finish users page (ban/delete)
- 1pm-3pm: Start beta access page
- Deliverable: Users can be managed

**Friday**:
- 9am-12pm: Finish beta access page
- 1pm-3pm: DAO management + health monitor
- 3pm-5pm: Final testing, documentation
- Deliverable: Complete admin suite

---

## 🎯 Success Criteria

✅ Admin can view real analytics data from database
✅ Admin can update system settings and persist to database
✅ Admin can manage users (list, ban, delete)
✅ Admin can grant/revoke beta features (single & bulk)
✅ Admin can view all DAOs and update status
✅ System health monitored and displayed
✅ All pages protected (super_admin only)
✅ All actions logged to audit_logs
✅ 100% TypeScript type safety
✅ Mobile/tablet responsive design

---

## 🔄 Integration with Week 1

**Week 1 Built**: Backend APIs with database persistence
**Week 2 Builds**: Frontend UI to manage those databases

Example flow:
1. Admin updates setting via UI → PUT /api/admin/settings
2. API saves to config table
3. Change logged to auditLogs table
4. Admin sees success notification
5. Next page load shows new value

This creates a complete production cycle: UI → API → Database → UI

---

## 📚 Files to Create/Modify

**New Files** (9):
- `client/src/pages/admin/AdminDashboard.tsx`
- `client/src/pages/admin/AnalyticsPage.tsx`
- `client/src/pages/admin/SettingsPage.tsx`
- `client/src/pages/admin/UsersPage.tsx`
- `client/src/pages/admin/BetaAccessPage.tsx`
- `client/src/pages/admin/DAOsPage.tsx`
- `client/src/pages/admin/HealthMonitorPage.tsx`
- `client/src/types/admin.ts`
- `client/src/hooks/useAdmin.ts`

**Components** (7+):
- AdminNav, SettingsForm, UserTable, DAOTable, BetaAccessTable, AnalyticsCard, SystemHealthCard

**Modify**:
- `client/src/App.tsx` (add admin routes)
- `client/src/types/index.ts` (add admin types)

**Total New Code**: ~2,500 lines

---

## 🎬 Ready to Start?

All dependencies are in place:
✅ Backend APIs fully functional
✅ Database persistence working
✅ Audit logging implemented
✅ TypeScript strict mode ready
✅ Component system available
✅ Authentication middleware ready

**Monday morning: Build the UI that manages all that.**

---

**Week 2 Status**: READY FOR IMPLEMENTATION ✅
**Priority**: HIGH (Completes admin suite)
**Complexity**: MEDIUM (straightforward CRUD pages)
**Risk**: LOW (APIs already tested)
