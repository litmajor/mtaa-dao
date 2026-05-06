# 📋 Pre-Migration Audit: DAO Endpoints Consolidation

**Date:** March 15, 2026  
**Status:** Complete - Ready for Phase 2  
**Scope:** 71 endpoints → 48 frontend files requiring updates

---

## 🎯 Audit Overview

**Total Frontend Files Requiring Updates:** 48  
**Total Legacy Endpoint Calls:** 60+  
**Domains Affected:** 10 satellite domains

### Files Breakdown by Domain

#### 1️⃣ **Proposals Domain** (10 files)
Legacy endpoints: `/api/proposals/*`, `/api/poll-proposals/*`  
New endpoints: `/api/v1/daos/:daoId/proposals/*`

| File | Calls | Type | Update Required |
|------|-------|------|-----------------|
| `client/src/pages/proposals.tsx` | 2 | Page | Query: `/api/proposals` → `/api/v1/daos/:daoId/proposals` |
| `client/src/pages/proposal-detail.tsx` | 2 | Page | Query: `/api/proposals/:id` → `/api/v1/daos/:daoId/proposals/:id` |
| `client/src/api/dashboardApi.ts` | 3 | API | `voteOnProposal()`: `/api/proposals/${id}/vote` → `/api/v1/daos/:daoId/proposals/:id/vote` |
| `client/src/components/proposal-card.tsx` | 2 | Component | Links & queries using proposal IDs without daoId |
| `client/src/components/poll-proposal-card.tsx` | 3 | Component | `fetch()`: `/api/proposals/:id/poll-vote` → `/api/v1/daos/:daoId/proposals/:id/poll-vote` |
| `client/src/components/proposal-comments.tsx` | 2 | Component | Comment endpoints using `/api/proposals` |
| `client/src/components/proposal-like-button.tsx` | 1 | Component | Like endpoint without daoId |
| `client/src/components/proposal_leaderboard.tsx` | 1 | Component | Leaderboard query |
| `client/src/components/proposal-comments.test.tsx` | 2 | Test | Mock endpoints |
| `client/src/components/proposal-comments.test.simplified.tsx` | 1 | Test | Comment mock endpoints |

**Subtotal: 19 calls** in 10 files

---

#### 2️⃣ **Governance Domain** (4 files)
Legacy endpoints: `/api/governance/*`  
New endpoints: `/api/v1/daos/:daoId/governance/*`

| File | Calls | Type | Update Required |
|------|-------|------|-----------------|
| `client/src/pages/dao/[id]/governance.tsx` | 1 | Page | Query: `/api/governance/proposals?daoId=${daoId}` → `/api/v1/daos/:daoId/proposals` |
| `client/src/components/governance/VoteProposalModal.tsx` | 2 | Component | Vote endpoint parameter changes |
| `client/src/components/governance/LeaderboardPage.tsx` | 1 | Component | `fetch()`: `/api/governance/:daoId/leaderboard` → `/api/v1/daos/:daoId/governance/leaderboard` |
| `client/src/api/dashboardApi.ts` | 1 | API | `getGovernanceStats()`: `/api/governance/stats` → `/api/v1/governance/stats` (system-level) |

**Subtotal: 5 calls** in 4 files

---

#### 3️⃣ **DAO Chat Domain** (3 files)
Legacy endpoints: `/api/dao-chat/*`  
New endpoints: `/api/v1/daos/:daoId/chat/*`

| File | Calls | Type | Update Required |
|------|-------|------|-----------------|
| `client/src/pages/dao/[id]/chat.tsx` | 1 | Page | Page component using daoId param correctly |
| `client/src/components/dao-chat.tsx` | 8 | Component | Multiple endpoints: `/api/dao/:daoId/messages`, `/api/dao-chat/:daoId` → all under `/api/v1/daos/:daoId/chat/*` |
| `client/src/api/dashboardApi.ts` | 1 | API | `getDAOChat()`: `/api/dao-chat/${daoId}` → `/api/v1/daos/:daoId/chat` |

**Subtotal: 10 calls** in 3 files

---

#### 4️⃣ **Investment Pool Governance Domain** (3 files)
Legacy endpoints: `/api/pool-governance/*`, `/api/investment-pools/*`  
New endpoints: `/api/v1/daos/:daoId/investment-pools/:poolId/governance/*`

| File | Calls | Type | Update Required |
|------|-------|------|-----------------|
| `client/src/pages/investment-pools.tsx` | 1 | Page | List pools under DAO scope (needs daoId context) |
| `client/src/pages/investment-pool-detail.tsx` | 5 | Page | All endpoints: `/api/investment-pools/:id/*` → `/api/v1/daos/:daoId/investment-pools/:poolId/*` |
| `client/src/pages/pool-discovery.tsx` | 2 | Page | Pool discovery (may stay collection-level or nest under DAO) |

**Subtotal: 8 calls** in 3 files

---

#### 5️⃣ **DAO Abuse Prevention Domain** (2 files)
Legacy endpoints: `/api/dao-abuse-prevention/*`  
New endpoints: `/api/v1/daos/:daoId/abuse/*` + `/api/v1/daos/abuse/*` (for eligibility checks)

| File | Calls | Type | Update Required |
|------|-------|------|-----------------|
| `client/src/pages/create-dao.tsx` | 1 | Page | `fetch()`: `/api/dao-abuse-prevention/check-eligibility` → `/api/v1/daos/abuse/eligibility` (collection-level) |
| `client/src/components/DaoCreationEligibilityCheck.tsx` | 1 | Component | Eligibility check endpoint |

**Subtotal: 2 calls** in 2 files

---

#### 6️⃣ **DAO Deploy** (1 file)
Legacy endpoints: `/api/dao-deploy` (duplicate)  
New endpoints: `POST /api/v1/daos`

| File | Calls | Type | Update Required |
|------|-------|------|-----------------|
| `client/src/pages/create-dao.tsx` | 1 | Page | `fetch()`: `/api/dao-deploy` → `POST /api/v1/daos` |

**Subtotal: 1 call** in 1 file

---

#### 7️⃣ **DAO of the Week** (1 file)
Legacy endpoints: `/api/dao-of-the-week/*`  
New endpoints: `/api/v1/daos/featured/*`

| File | Calls | Type | Update Required |
|------|-------|------|-----------------|
| `client/src/components/DaoOfTheWeekBanner.tsx` | 1 | Component | Query: `/api/dao-of-the-week/current` → `/api/v1/daos/featured/current` |

**Subtotal: 1 call** in 1 file

---

## 📊 Summary Table

| Domain | Files | Calls | Priority |
|--------|-------|-------|----------|
| Proposals | 10 | 19 | **HIGH** |
| Governance | 4 | 5 | **HIGH** |
| Chat | 3 | 10 | **MEDIUM** |
| Pool Governance | 3 | 8 | **MEDIUM** |
| Abuse Prevention | 2 | 2 | **LOW** |
| DAO Deploy | 1 | 1 | **HIGH** |
| Featured DAOs | 1 | 1 | **LOW** |
| **TOTAL** | **24** | **46** | |

---

## 🔄 Key Migration Patterns

### Pattern 1: Query Parameter → Path Parameter
```typescript
// BEFORE
await apiGet(`/api/governance/proposals?daoId=${daoId}`)
await apiGet(`/api/proposals`)

// AFTER
await apiGet(`/api/v1/daos/${daoId}/proposals`)
```

### Pattern 2: Sub-resource Nesting
```typescript
// BEFORE
fetch(`/api/proposals/${proposalId}/vote`)
fetch(`/api/governance/${daoId}/leaderboard`)
fetch(`/api/pool-governance/${poolId}/proposals`)

// AFTER
fetch(`/api/v1/daos/${daoId}/proposals/${proposalId}/vote`)
fetch(`/api/v1/daos/${daoId}/governance/leaderboard`)
fetch(`/api/v1/daos/${daoId}/investment-pools/${poolId}/governance/proposals`)
```

### Pattern 3: Collection-Level vs Scoped
```typescript
// Collection-level (no daoId)
fetch(`/api/v1/daos/featured/current`)
fetch(`/api/v1/daos/abuse/eligibility`)

// DAO-scoped (with daoId)
fetch(`/api/v1/daos/${daoId}/chat`)
fetch(`/api/v1/daos/${daoId}/proposals`)
```

---

## ⚠️ Threading Requirements

### Critical: Proposal daoId Threading
**Issue:** Current code retrieves proposals without daoId context  
**Impact:** 10 proposal-related components  

Current pattern (BROKEN after migration):
```typescript
// ❌ proposals.tsx
const { data: proposals } = useQuery({
  queryKey: ["/api/proposals"],
  queryFn: () => apiGet("/api/proposals"),  // No daoId!
});
```

Required fix (ALL proposal calls must include daoId):
```typescript
// ✅ proposals.tsx (needs context)
const daoId = useParams<{ daoId: string }>();  // Must extract or receive
const { data: proposals } = useQuery({
  queryKey: [`/api/v1/daos/${daoId}/proposals`],
  queryFn: () => apiGet(`/api/v1/daos/${daoId}/proposals`),
});
```

### Pool Governance poolId vs vaultId
**Decision:** `poolId` ≠ `vaultId` (separate entity)  
**Impact:** 3 investment pool files  

Pool files currently use `/api/investment-pools/:id` pattern.  
After migration: `/api/v1/daos/:daoId/investment-pools/:poolId`

**Question:** How is `daoId` determined for a pool?
- Option A: Pool belongs to a DAO (daoId embedded or relationship)
- Option B: Pool is global, governance scoped to pool only (not nesting under daoId)

Recommendation: Verify pool → DAO relationship before Phase 2

---

## 🧪 Test Files Requiring Updates

**Total: 2 test files**

1. `client/src/components/proposal-comments.test.tsx` (2 mock endpoints)
2. `client/src/components/proposal-comments.test.simplified.tsx` (1 mock endpoint)

**Update:** Mock endpoints must match new V1 paths

---

## 📍 Detailed File List

### Complete List of 24 Files Requiring Updates

**PRIORITY: HIGH** (Blocking deployment if not updated)
1. `client/src/pages/proposals.tsx`
2. `client/src/pages/proposal-detail.tsx`
3. `client/src/pages/dao/[id]/governance.tsx`
4. `client/src/pages/create-dao.tsx` (2 endpoints: deploy + abuse)
5. `client/src/api/dashboardApi.ts` (4 functions)

**PRIORITY: MEDIUM** (Should update before launch)
6. `client/src/components/governance/LeaderboardPage.tsx`
7. `client/src/components/governance/VoteProposalModal.tsx`
8. `client/src/components/dao-chat.tsx`
9. `client/src/components/poll-proposal-card.tsx`
10. `client/src/pages/investment-pool-detail.tsx`
11. `client/src/pages/investment-pools.tsx`

**PRIORITY: LOW** (Update before GA)
12. `client/src/components/proposal-card.tsx`
13. `client/src/components/proposal-comments.tsx`
14. `client/src/components/proposal-like-button.tsx`
15. `client/src/components/proposal_leaderboard.tsx`
16. `client/src/pages/dao/[id]/chat.tsx`
17. `client/src/pages/pool-discovery.tsx`
18. `client/src/components/DaoCreationEligibilityCheck.tsx`
19. `client/src/components/DaoOfTheWeekBanner.tsx`
20. `client/src/pages/investment-pool-detail.tsx`
21. `client/src/components/proposal-comments.test.tsx`
22. `client/src/components/proposal-comments.test.simplified.tsx`

---

## ✅ Pre-Migration Checklist

- [x] All 71 endpoints catalogued
- [x] Duplicate endpoints identified (dao/deploy vs dao-deploy)
- [x] Pool governance confirmed as separate entity
- [x] Proposal daoId threading requirements documented
- [x] **Frontend files needing updates identified (24 files, 46+ calls)**
- [x] Call site patterns documented (3 main patterns)
- [x] Test files identified (2 files)
- [x] Threading challenges flagged (proposals, pools)
- [ ] Frontend API service layer reviewed (for centralized updates)
- [ ] State management (React Query keys) impact assessed
- [ ] Rate limiting rules for new endpoints prepared
- [ ] Authentication middleware validated for new paths
- [ ] RBAC rules for new scoped paths defined

---

## 🚀 Next Steps

**Phase 1 Completion:** ✅ Pre-Migration Audit Complete

**Phase 2 Readiness:**
1. Review this audit document with team
2. Clarify pool → DAO ownership relationship
3. Decide on investmentPool scoping (under DAO or global)
4. Create `/api/v1/daos/_daoId/` directory structure
5. Begin backend migration (endpoints)

**Frontend Staging:**
1. Audit React Query keys for impact
2. Create centralized endpoint URL constants
3. Plan update rollout (HIGH priority first)
4. Prepare test data migration

---

## 📌 References

- **Consolidation Plan:** [DAO_ENDPOINTS_CONSOLIDATION_PLAN.md](DAO_ENDPOINTS_CONSOLIDATION_PLAN.md)
- **Scope:** 71 endpoints across 10 satellite domains
- **Frontend Impact:** 24 files, 46+ direct endpoint calls + indirect dependencies
- **Timeline:** ~2 weeks total (all phases)

