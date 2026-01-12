# DAO System - Quick Reference Guide

## API Endpoints Summary

### 1️⃣ GET /api/daos
**Lists all DAOs with user context**
```
Auth: Required | Returns: DAO[]
Frontend: daos.tsx line 44 (useQuery)
Cache: 1 minute staleTime
```

### 2️⃣ POST /api/daos/:id/join
**Join a DAO**
```
Auth: Required | Body: {} | Returns: { success, membership }
Frontend: daos.tsx line 68 (joinMutation)
Validates: DAO exists, not already member
```

### 3️⃣ POST /api/daos/:id/leave
**Leave a DAO**
```
Auth: Required | Body: {} | Returns: { success, message }
Frontend: daos.tsx line 82 (leaveMutation)
Validates: DAO exists, is member, not founder
Safety: Prevents founder removal ⛔
```

### 4️⃣ GET /api/daos/:daoId/dashboard-stats
**DAO dashboard statistics**
```
Auth: Optional | Returns: { totalMembers, activeProposals, treasuryBalance, etc }
Frontend: dao_treasury_overview.tsx line 49
Used by: Dashboard, analytics pages
```

### 5️⃣ GET /api/daos/:id
**Individual DAO details**
```
Auth: Required | Returns: DAO + user context
Frontend: dao/[id]/* pages
Used by: Detail pages, navigation
```

---

## Frontend Files

| File | Lines | Purpose |
|------|-------|---------|
| `daos.tsx` | 562 | Main DAO listing & discovery page |
| `dao_treasury_overview.tsx` | 232 | Treasury dashboard |
| `dao/[id]/members.tsx` | - | Members management |
| `dao/[id]/settings.tsx` | - | DAO settings |
| `dao/[id]/rules.tsx` | - | Governance rules |
| `dao/[id]/subscription.tsx` | - | Plan management |

---

## Key Components

### DAOCard Component (daos.tsx lines 150-365)
Features: Gradients, role badges, stats, trending, animations

### Tab System (daos.tsx lines 380-420)
Tabs: My Groups | Discover | Popular | Near Me

### Mutation Hooks
- `joinMutation` - Join with isPending state tracking
- `leaveMutation` - Leave with separate loading state (leavingDaoId)

---

## Safety Features ⛔

1. **Founders cannot leave** - 403 Forbidden if founder attempts
2. **Duplicate prevention** - Cannot join same DAO twice
3. **DAO validation** - All operations check DAO exists
4. **Auth required** - All write operations require authentication

---

## Error Handling

| Scenario | Response | Code |
|----------|----------|------|
| Join non-existent DAO | DAO not found | 404 |
| Join already-joined DAO | Already a member | 400 |
| Leave non-member DAO | Not a member | 403 |
| Founder leaves | Founders cannot leave | 403 |

Frontend: Toast notifications for all errors

---

## State Flow

```
User opens daos page
    ↓
useQuery fetches /api/daos
    ↓
Data cached (1 min staleTime)
    ↓
Display joinedDAOs & availableDAOs
    ↓
User clicks "Join"
    ↓
joinMutation → POST /api/daos/{id}/join
    ↓
Loading state (button disabled, spinner)
    ↓
Success: invalidateQueries → auto-refetch
    ↓
UI updates with new membership status
```

---

## UI States

- ✅ **Loaded:** Grid of DAOCards with stats
- ⏳ **Loading:** Skeleton screens
- ❌ **Error:** Toast notification + retry option
- 📭 **Empty:** Context-aware empty state with CTA
- 🔄 **Mutation:** Disabled button + loading spinner

---

## Performance Optimizations

1. React Query caching (1 min staleTime)
2. Query invalidation on mutation success
3. Separate loading states prevent duplicate requests
4. Lazy card rendering in grid

---

## Dark Mode Support

All components have `dark:` prefixes for dark mode styling.
Example: `dark:bg-gray-800`, `dark:text-gray-300`

---

## File Locations Quick Reference

```
Backend:
  server/routes/daos.ts (338 lines)

Frontend:
  client/src/pages/daos.tsx (main page, 562 lines)
  client/src/pages/dao/dao_treasury_overview.tsx
  client/src/pages/dao/[id]/members.tsx
  client/src/pages/dao/[id]/settings.tsx
  client/src/pages/dao/[id]/rules.tsx
  client/src/pages/dao/[id]/subscription.tsx
```

---

## Testing Endpoints

### Join a DAO
```bash
POST /api/daos/1/join
Authorization: Bearer {token}
```

### Leave a DAO
```bash
POST /api/daos/1/leave
Authorization: Bearer {token}
```

### Get all DAOs
```bash
GET /api/daos
Authorization: Bearer {token}
```

### Get dashboard stats
```bash
GET /api/daos/1/dashboard-stats
```

### Get DAO details
```bash
GET /api/daos/1
Authorization: Bearer {token}
```

---

**Status:** ✅ All systems operational  
**PostgreSQL fix:** ✅ Applied (dao_id, created_at columns)  
**Ready for:** Production deployment
