# Auth Token Migration - Final Completion Checklist

## Status Summary
- **✅ FULLY MIGRATED**: 25 pages (70+ functions)
- **⏳ REMAINING**: 35+ pages (90+ fetch calls)
- **TOTAL COVERAGE**: 60+ pages
- **Security Fix**: 41% complete → 100% target

---

## TIER 1 - CRITICAL AUTH & CORE (10 PAGES)
*User-facing auth/core functionality - HIGHEST PRIORITY*

### Authentication Pages (3)
- [ ] `admin-login.tsx` - 1 fetch call
- [ ] `admin-register.tsx` - 1 fetch call  
- [ ] `kyc.tsx` - 1 fetch call (⚠️ external API - verify if needs authClient)

### DAO Creation (1)
- [ ] `create-dao.tsx` - 3 fetch calls
  - `/api/user/subscription` - GET
  - `/api/v1/daos/*/abuse/eligibility` - GET
  - `/api/dao-deploy` - POST

### Vault Management (1)
- [ ] `create-vault.tsx` - 1 fetch call

### Analytics - Core (2)
- [ ] `analytics-dashboard.tsx` - 2 fetch calls
- [ ] `AnalyzerDashboard.tsx` - 1 fetch call

### Blog/Content (2)
- [ ] `blog.tsx` - 1 fetch call
- [ ] `blog-post.tsx` - 1 fetch call

---

## TIER 2 - ADMIN PANELS (10 PAGES)
*Admin functionality - HIGH PRIORITY*

### Admin Auth (Previously found)
- [ ] `admin/AdminSupportTickets.tsx` - 1 fetch call (others in query mutations)
- [ ] `admin/UserManagement.tsx` - 4 fetch calls
- [ ] `admin/SystemSettings.tsx` - 2 fetch calls
- [ ] `admin/SecuritySettings.tsx` - 4 fetch calls
- [ ] `admin/SecurityAudit.tsx` - 3 fetch calls
- [ ] `admin/RecoveryDashboard.tsx` - 3 fetch calls
- [ ] `admin/PoolManagement.tsx` - 5 fetch calls
- [ ] `admin/DaoModeration.tsx` - 2 fetch calls
- [ ] `admin/AuditViewer.tsx` - 3 fetch calls

### Admin Content
- [ ] `admin/AnnouncementsManagement.tsx` - 4 fetch calls
- [ ] `admin/AdminAnnouncements.tsx` - 4 fetch calls

---

## TIER 3 - ANALYTICS & SPECIALIZED (2 PAGES)
*Secondary analytics functionality - MEDIUM PRIORITY*

- [ ] `analytics/vault_analytics_dashboard.tsx` - 1 fetch call

---

## Migration Pattern (Proven)

```typescript
// BEFORE:
const response = await fetch('/api/endpoint', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
const data = await response.json();

// AFTER:
import authClient from '@/services/authClient';
const data = await authClient.get('/api/endpoint');
```

---

## Completion Instructions

### For Each Page:
1. **Add import** at top of file:
   ```typescript
   import authClient from '@/services/authClient';
   ```

2. **Replace all fetch() calls** in order of appearance:
   - GET: `fetch()` → `authClient.get()`
   - POST: `fetch()` + `method: 'POST'` → `authClient.post()`
   - PUT: `fetch()` + `method: 'PUT'` → `authClient.put()`
   - DELETE: `fetch()` + `method: 'DELETE'` → `authClient.delete()`
   - PATCH: `fetch()` + `method: 'PATCH'` → `authClient.patch()`

3. **Remove manual headers**:
   - Delete: `headers: { 'Authorization': 'Bearer ${token}' }`
   - Delete: `headers: { 'Content-Type': 'application/json', 'Authorization': ... }`

4. **Test**: Verify no `fetch(` calls remain in file via grep

---

## Files Successfully Completed ✅

**Auth & DAO Pages (8)**:
- forgot-password.tsx
- invite/[token].tsx
- dao/[id]/rules.tsx
- dao/[id]/subscription.tsx
- dao/[id]/settings.tsx
- dao/[id]/members.tsx
- reset-password.tsx
- AchievementSystemPage.tsx

**App Features (17)**:
- vault-overview.tsx
- bill-split.tsx
- RewardsHub.tsx
- support.tsx
- SynchronizerMonitor.tsx
- SubscriptionManagement.tsx
- DefenderMonitor.tsx
- events.tsx
- RevenueDashboard.tsx
- success-stories/submit.tsx
- PaymentReconciliation.tsx
- payment-requests.tsx
- MaonoVaultManagement.tsx
- investment-pools.tsx
- investment-pool-detail.tsx

---

## Next Actions

**Immediate** (Complete before session end):
1. Migrate TIER 1 auth pages (3-5 pages)
2. Migrate top 3 TIER 2 admin pages (UserManagement, SystemSettings, SecuritySettings)

**Follow-up** (If time permits):
1. Complete remaining 7 TIER 2 admin pages
2. Migrate TIER 3 specialized pages

**Final validation**:
```bash
grep -r "await fetch(" client/src/pages/ | grep -v kyc.tsx
# Should return 0 results for production pages
```

---

## Token/Coverage Tracking
- Tier 1: 10 pages (15 fetch calls) - ~30% of remaining
- Tier 2: 10 pages (32 fetch calls) - ~65% of remaining  
- Tier 3: 2 pages (1 fetch call) - ~5% of remaining
- **Total remaining**: 22 pages with ~48 fetch calls

