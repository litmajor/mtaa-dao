# Week 2 Quick Start Guide

## 🚀 Before You Start

### Prerequisites Check
```bash
# 1. Verify backend APIs are running
curl http://localhost:3000/api/admin/analytics \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 2. Verify database is connected
curl http://localhost:3000/api/admin/settings \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 3. Check TypeScript compilation
cd client && npm run build

# 4. Verify React runs
npm run dev  # Should start on localhost:5173
```

---

## 📁 Directory Structure to Create

```bash
# Create admin pages directory
mkdir -p client/src/pages/admin
mkdir -p client/src/pages/admin/components
mkdir -p client/src/hooks

# Create types file
touch client/src/types/admin.ts
touch client/src/hooks/useAdmin.ts
```

---

## 🎯 Implementation Order

### Day 1: Foundation (Mon)
1. Create admin routes in App.tsx
2. Create admin layout component
3. Admin navigation sidebar
4. Protected route middleware

**Minimal Code Example**:
```typescript
// client/src/pages/admin/AdminDashboard.tsx
export function AdminDashboard() {
  const user = useAuth();
  
  if (user?.roles !== 'super_admin') {
    return <Navigate to="/" />;
  }
  
  return (
    <div className="flex">
      <AdminNav />
      <main className="flex-1 p-8">
        <h1>Admin Dashboard</h1>
      </main>
    </div>
  );
}
```

### Day 2-3: Data Pages (Tue-Wed)
1. AnalyticsPage - Fetch and display real metrics
2. SettingsPage - Form to update config
3. Begin UsersPage

**API Call Pattern**:
```typescript
const [analytics, setAnalytics] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/admin/analytics', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(r => r.json())
    .then(data => setAnalytics(data))
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
}, [token]);
```

### Day 4: Management Pages (Thu)
1. Finish UsersPage
2. BetaAccessPage
3. DAOsPage

### Day 5: Polish (Fri)
1. HealthMonitorPage
2. Error handling
3. Loading states
4. Testing
5. Documentation

---

## 🔧 Key Components to Build

### 1. AdminNav Component
```typescript
const adminNavItems = [
  { label: 'Analytics', href: '/admin' },
  { label: 'Settings', href: '/admin/settings' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Beta Access', href: '/admin/beta-access' },
  { label: 'DAOs', href: '/admin/daos' },
  { label: 'Health', href: '/admin/health' },
];
```

### 2. SettingsForm Component
```typescript
interface SettingValue {
  section: string;
  key: string;
  value: any;
}

const onSave = async (setting: SettingValue) => {
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(setting),
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (res.ok) {
    toast.success('Setting saved');
  }
};
```

### 3. UserTable Component
```typescript
const [users, setUsers] = useState([]);
const [page, setPage] = useState(1);

useEffect(() => {
  fetch(`/api/admin/users/list?page=${page}&limit=50`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(r => r.json())
    .then(data => setUsers(data.users));
}, [page, token]);

// Render table with columns: email, username, role, actions (ban, delete)
```

---

## 📊 API Response Examples

### GET /api/admin/analytics
```json
{
  "platform": {
    "totalDAOs": 42,
    "totalMembers": 1250,
    "activeSubscriptions": 15,
    "totalTreasuryValue": 125000
  },
  "revenueMetrics": {
    "monthly": 495,
    "quarterly": 1485,
    "annual": 5940
  },
  "topMembers": [
    {
      "name": "alice",
      "score": 42,
      "activities": 10,
      "contributions": 5,
      "votes": 6
    }
  ],
  "systemHealth": {
    "database": "healthy",
    "blockchain": "healthy",
    "payments": "warning",
    "api": "healthy"
  },
  "chainInfo": {
    "chain": "Celo Alfajores",
    "block": "Block #19847293",
    "blockNumber": 19847293
  }
}
```

### GET /api/admin/settings
```json
{
  "success": true,
  "settings": {
    "platform": {
      "name": "MTAA DAO",
      "maintenanceMode": false,
      "registrationEnabled": true,
      "requireEmailVerification": true
    },
    "blockchain": {
      "network": "alfajores",
      "rpcUrl": "https://alfajores-forno.celo-testnet.org",
      "maonoContractAddress": "0x..."
    },
    "rateLimits": {
      "login": 5,
      "register": 3,
      "apiDefault": 100
    }
  },
  "source": "database"
}
```

### GET /api/admin/beta-access
```json
{
  "success": true,
  "users": [
    {
      "id": "user-123",
      "email": "alice@example.com",
      "username": "alice",
      "enabledBetaFeatures": ["locked_savings", "ai_assistant"],
      "featureCount": 2,
      "createdAt": "2025-12-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalCount": 127,
    "totalPages": 3
  }
}
```

---

## 🧪 Testing Checklist

Before deploying Week 2:

- [ ] Can view analytics (data matches API response)
- [ ] Can update settings (change persists)
- [ ] Can search/filter users
- [ ] Can ban a user
- [ ] Can grant beta features (single)
- [ ] Can grant beta features (bulk)
- [ ] Can revoke beta features
- [ ] Can view all DAOs
- [ ] Can update DAO status
- [ ] System health shows actual status
- [ ] All pages load without errors
- [ ] TypeScript compilation successful
- [ ] No console warnings/errors

---

## 🚨 Common Issues & Solutions

**Issue**: 401 Unauthorized on API calls
**Solution**: Ensure token is in Authorization header
```typescript
headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
```

**Issue**: "Property 'X' does not exist"
**Solution**: Create types/admin.ts with all interfaces
```typescript
export interface AdminUser { ... }
export interface Analytics { ... }
```

**Issue**: Page doesn't refresh after API call
**Solution**: Update state after fetch
```typescript
.then(data => {
  setUsers(data.users);  // ← Trigger re-render
  toast.success('Saved');
})
```

**Issue**: Form values don't update
**Solution**: Use controlled inputs with onChange
```typescript
<input 
  value={settings.name}
  onChange={(e) => setSettings({...settings, name: e.target.value})}
/>
```

---

## 📈 Code Generation Tips

### Quick Table Template
```typescript
import React, { useState, useEffect } from 'react';

export function UserTable() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/users/list?page=${page}&limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setUsers(data.users))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <div>Loading...</div>;

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Email</th>
          <th>Username</th>
          <th>Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.id}>
            <td>{user.email}</td>
            <td>{user.username}</td>
            <td>{user.roles}</td>
            <td>
              <button onClick={() => handleBan(user.id)}>Ban</button>
              <button onClick={() => handleDelete(user.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Quick Form Template
```typescript
export function SettingsForm() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setSettings(data.settings));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        section: 'platform',
        key: 'maintenanceMode',
        value: settings.platform.maintenanceMode
      })
    });
    
    if (res.ok) toast.success('Saved');
    setSaving(false);
  };

  return (
    <div>
      <label>
        Maintenance Mode
        <input
          type="checkbox"
          checked={settings?.platform.maintenanceMode}
          onChange={(e) => setSettings({
            ...settings,
            platform: { ...settings.platform, maintenanceMode: e.target.checked }
          })}
        />
      </label>
      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
```

---

## 🎯 Success Metrics

**By End of Week 2**:
- 7 admin pages built and working
- 8 data tables with filtering/pagination
- 5 modal dialogs for confirmations
- 2+ real API integrations tested
- 0 TypeScript errors
- 100% admin routes protected
- All actions logged to audit trail
- Ready for production use

---

## ✅ Week 2 Completion Checklist

- [ ] All 7 admin pages created
- [ ] All pages connect to real APIs
- [ ] All forms validate input
- [ ] All tables support pagination
- [ ] Bulk operations working (beta access)
- [ ] Settings persist to database
- [ ] All destructive actions confirmed
- [ ] Error handling graceful
- [ ] Loading states visible
- [ ] Mobile responsive
- [ ] Dark mode works
- [ ] TypeScript passes
- [ ] Tests written (80%+)
- [ ] Documentation complete

---

## 🚀 Ready to Build?

You have everything you need:
✅ Backend APIs fully functional
✅ Database schema ready
✅ Authentication working
✅ TypeScript strict mode
✅ Component library available
✅ Plan documented

**Start Monday morning!**

---

**Next Phase**: Week 3 - Frontend Feature Gating & User Experience
