# 🎯 DAO Endpoints Consolidation & V1 Migration Plan

**Status:** Planning Phase  
**Scope:** 71 endpoints across 2 core + 10 satellite domains  
**Target Structure:** `/api/v1/daos` + `/api/v1/daos/:daoId/{resource}`  
**Impact:** Full cluster migration with 4-phase rollout

---

## 🚨 CRITICAL FINDINGS (Pre-Migration Validation)

### Issue #1: `/api/dao/deploy` vs `/api/dao-deploy` - DUPLICATE CONFIRMED ✓

**Current State (routes.ts):**
```typescript
// Line 464 - CANONICAL ENDPOINT
app.post('/api/dao/deploy', isAuthenticated, requireRole('admin', 'moderator'), async (req, res) => {
  await daoDeployHandler(req, res);
});

// Line 473 - REDUNDANT ALIAS
app.post('/api/dao-deploy', isAuthenticated, requireRole('admin', 'moderator'), async (req, res) => {
  res.set('X-Redirect-To', '/api/dao/deploy');  // Signals redirect
  await daoDeployHandler(req, res);  // Same handler
});
```

**Recommendation:**
- `/api/dao/deploy` is canonical (use this pattern)
- `/api/dao-deploy` is redundant (delete from routes.ts)
- Consolidate both into: **`POST /api/v1/daos`** (create DAO)
- Keep 410 Gone handler for `/api/dao-deploy` for backwards compatibility

**Action:** Delete `/api/dao-deploy` handler block from routes.ts line 473-477 after migration

---

### Issue #2: `/api/pool-governance` uses `poolId` - SEPARATE ENTITY ✓

**Current State (schema.ts):**
```typescript
// Pool Governance is SEPARATE from Vaults
export const poolProposals = pgTable("pool_proposals", {
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  // ...
});

export const poolGovernanceSettings = pgTable("pool_governance_settings", {
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  // ...
});
```

**Key Finding:** `poolId` ≠ `vaultId`
- Investment pools (`investmentPools` table) are DISTINCT from vaults
- Pools have their own governance tables (poolProposals, poolVotes, poolGovernanceSettings)
- Pools can have governance WITHOUT being treasury vaults

**Recommendation:**
- Do NOT merge pools under vaults
- Create parallel nesting: `/api/v1/daos/:daoId/investment-pools/:poolId/governance`
- Keep pools as first-class resource under DAO scope
- Pool governance routes:
  - `GET /v1/daos/:daoId/investment-pools/:poolId/governance/voting-power`
  - `GET /v1/daos/:daoId/investment-pools/:poolId/governance/proposals`
  - `POST /v1/daos/:daoId/investment-pools/:poolId/governance/proposals`

**Action:** Create `/v1/daos/_daoId/investment-pools/` sub-router structure

---

### Issue #3: `/api/proposals` lacks `daoId` scoping - NEEDS THREADING ✓

**Current State (proposals.ts):**
```typescript
// Line 26 - NO PATH PARAMETER FOR DAOUI
router.get('/', isAuthenticated, async (req: express.Request, res: express.Response) => {
  const { daoId, status, proposer... } = req.query;  // ⚠️ Query param instead of path
  if (!daoId) {
    return res.status(400).json({ error: 'daoId is required' });
  }
  // ...
});
```

**Issue:** 
- Proposals treated as floating resources
- `daoId` passed as query parameter (not RESTful)
- Frontend calls must thread `daoId` through every proposal operation
- No clear tenant scoping at routing level

**Recommendation:**
- Move to path parameter: `/api/v1/daos/:daoId/proposals/:proposalId`
- Enforce tenant scoping at router level
- Eliminates frontend complexity around daoId threading

**Middleware Impact:**
```typescript
// Before migration: frontend must pass daoId
await fetch('/api/proposals?daoId=123&status=active')

// After migration: daoId in URL path
await fetch('/api/v1/daos/123/proposals?status=active')
```

**Action:** 
1. Create `/v1/daos/_daoId/proposals/` sub-router
2. Update frontend calls (31+ component migration)
3. Add tenant validation middleware at :daoId level

---

## 📊 Consolidation Mapping (71 Endpoints Total)

### Core Domains (2)

#### Domain A: DAO Operations (Collection-level)
| Legacy Route | V1 Route | Endpoint Count | Status |
|------------|----------|---|--------|
| `/api/dao/` | `/api/v1/daos` | 10 | **MERGE** |
| `/api/daos/` | `/api/v1/daos` | 10 | **MERGE** |
| **Subtotal** | | **20** | → `/api/v1/daos` (consolidated to 15 unique) |

#### Domain B: DAO-Scoped Resources (48 endpoints)
All nested under `/api/v1/daos/:daoId`

| Satellite Domain | Legacy Route | V1 Route | Count | Pattern |
|---------|----------|----------|------|---------|
| Treasury Flows | `/api/dao-treasury-flows` | `/api/v1/daos/:daoId/treasury/flows` | 4 | nest |
| Chat | `/api/dao-chat` | `/api/v1/daos/:daoId/chat` | 8 | nest |
| Subscriptions | `/api/dao-subscriptions` | `/api/v1/daos/:daoId/subscriptions` | 8 | nest |
| Governance | `/api/governance` | `/api/v1/daos/:daoId/governance` | 9 | nest |
| Proposals | `/api/proposals` | `/api/v1/daos/:daoId/proposals` | 3 | nest |
| Poll Proposals | `/api/poll-proposals` | `/api/v1/daos/:daoId/proposals/polls` | 2 | nest |
| Pool Governance | `/api/pool-governance` | `/api/v1/daos/:daoId/investment-pools/:poolId/governance` | 6 | double-nest |
| Proof of Contribution | `/api/proof-of-contribution` | `/api/v1/daos/:daoId/contributions/proof` | 6 | nest (split) |
| Abuse Prevention | `/api/dao-abuse-prevention` | `/api/v1/daos/:daoId/abuse` | 5 | nest |
| **Subtotal DAO-scoped** | | | **51** | |

### Collection-level Resources (5)

| Legacy Route | V1 Route | Endpoint Count | Pattern |
|----------|----------|---|---------|
| `/api/dao-of-the-week` | `/api/v1/daos/featured` | 2 | collection-level |
| `/api/dao-deploy` (dup of /api/dao/deploy) | `POST /api/v1/daos` | 1 | merge+consolidate |
| **Reserve (not yet mapped)** | | | |
| **Subtotal Collection-level** | | **3+** | |

### Treasury (Already Completed ✅)
- 62 endpoints already versioned to `/api/v1/daos/:daoId/treasury/*`
- 8 sub-routers (analysis, intelligence, management, multisig, vaults, withdrawals, contributions, flows)
- Status: **SKIPPED** (already done in previous phase)

---

## 🔄 Migration Phases

### Phase 1: Planning & Validation (✅ COMPLETE)
- [x] Identify duplicate endpoints (dao/deploy vs dao-deploy)
- [x] Confirm pool governance is separate entity
- [x] Verify proposals need daoId scoping
- [x] Audit frontend call sites (all proposal, governance, pool routes)
- [x] Check for hardcoded endpoint URLs in tests

**Phase 1 Deliverables:**
- ✅ [PRE_MIGRATION_AUDIT_DAO_ENDPOINTS.md](PRE_MIGRATION_AUDIT_DAO_ENDPOINTS.md)
  - 24 frontend files identified
  - 46+ direct endpoint calls catalogued
  - 3 migration patterns documented
  - Threading challenges flagged

### Phase 2: Infrastructure Setup
- [ ] Create `/api/v1/daos/_daoId/` directory structure
- [ ] Create sub-routers:
  - [ ] `/api/v1/daos/_daoId/proposals/`
  - [ ] `/api/v1/daos/_daoId/governance/`
  - [ ] `/api/v1/daos/_daoId/chat/`
  - [ ] `/api/v1/daos/_daoId/subscriptions/`
  - [ ] `/api/v1/daos/_daoId/abuse/`
  - [ ] `/api/v1/daos/_daoId/contributions/`
  - [ ] `/api/v1/daos/_daoId/investment-pools/`
- [ ] Create collection-level routers:
  - [ ] `/api/v1/daos/` (unified DAOs list)
  - [ ] `/api/v1/daos/featured/` (DAO of the week)
- [ ] Add tenant validation middleware

### Phase 3: Backend Migration
- [ ] Migrate governance endpoints
- [ ] Migrate proposal endpoints
- [ ] Migrate chat endpoints
- [ ] Migrate subscription endpoints
- [ ] Migrate abuse prevention endpoints
- [ ] Migrate contribution proof endpoints
- [ ] Migrate investment pool governance
- [ ] Add 410 Gone handlers for legacy routes

### Phase 4: Frontend Migration
- [ ] Update proposal components (15+ files)
- [ ] Update governance components (12+ files)
- [ ] Update pool governance (8+ files)
- [ ] Update DAOs list page
- [ ] Update DAO dashboard
- [ ] Verify all API calls use new V1 paths

---

## 📋 Endpoint Inventory

### Duplicate Detection (2 files)
```
❌ /api/dao/deploy         → POST /api/v1/daos
❌ /api/dao-deploy         → DELETE (same handler, keep 410 Gone)
```

### Legacy Routes Needing Migration (48)
```
/api/dao-treasury-flows/*           → /api/v1/daos/:daoId/treasury/flows/*
/api/dao-chat/*                     → /api/v1/daos/:daoId/chat/*
/api/dao-subscriptions/*            → /api/v1/daos/:daoId/subscriptions/*
/api/governance/*                   → /api/v1/daos/:daoId/governance/*
/api/proposals/*                    → /api/v1/daos/:daoId/proposals/*
/api/poll-proposals/*               → /api/v1/daos/:daoId/proposals/polls/*
/api/pool-governance/:poolId/*      → /api/v1/daos/:daoId/investment-pools/:poolId/governance/*
/api/proof-of-contribution/*        → /api/v1/daos/:daoId/contributions/proof/*
/api/dao-abuse-prevention/*         → /api/v1/daos/:daoId/abuse/*
```

### Collection-level Routes (No DAO Scoping)
```
/api/dao-of-the-week                → /api/v1/daos/featured
```

---

## 🔐 Middleware Requirements

### Tenant Validation (`/:daoId`)
```typescript
// Middleware to validate :daoId parameter
router.use('/:daoId', validateDaoId, validateDAOAccess);

// validateDaoId: Ensure daoId exists in database
// validateDAOAccess: Ensure authenticated user has access to this DAO
```

### Role-Based Access Control
```typescript
// Different endpoints require different roles
/v1/daos/:daoId/governance/*       → owner, admin, council
/v1/daos/:daoId/proposals/*        → member
/v1/daos/:daoId/chat/*             → member
/v1/daos/:daoId/abuse/*            → admin, moderator
```

---

## ⚠️ Breaking Changes & Frontend Impact

### Query Parameter → Path Parameter
```typescript
// BEFORE
GET /api/proposals?daoId=123&status=active

// AFTER
GET /api/v1/daos/123/proposals?status=active
```

**Impact:** 31+ frontend component files need updates
- proposal-engagement.ts
- proposals.ts
- governance.ts
- governance-v2.ts
- governance-activity.ts
- governance-quorum.ts
- pool-governance.ts
- dao-chat.ts
- dao-subscriptions.ts
- And all components calling these

### Resource IDs in Responses
Must include full context:
```typescript
// BEFORE
{ proposalId: "123", title: "...", daoId: "456" }

// AFTER (same, but daoId comes from URL path)
{ proposalId: "123", title: "...", daoId: "456" }  // Still included for clarity
```

---

## ✅ Pre-Migration Verification Checklist

**Phase 1 Complete - All items verified:**

- [x] All 71 endpoints catalogued
- [x] Duplicate endpoints identified and consolidated
- [x] Pool governance confirmed as separate entity
- [x] Proposal daoId threading requirements documented
- [x] Frontend files needing updates identified (24 files, see audit)
- [x] Test suite update requires (2 test files with mocked endpoints)
- [ ] Rate limiting rules applied to new endpoints (Phase 2)
- [ ] Authentication middleware validated (Phase 2)
- [ ] RBAC rules for new paths defined (Phase 2)
- [ ] Legacy 410 Gone handlers prepared (Phase 3)

**Phase 1 Artifacts:**
1. DAO_ENDPOINTS_CONSOLIDATION_PLAN.md (this file)
2. PRE_MIGRATION_AUDIT_DAO_ENDPOINTS.md (detailed frontend audit)

---

## 📈 Timeline Estimate

| Phase | Duration | Owner |
|-------|----------|-------|
| Phase 1: Planning & Validation | **CURRENT** | Backend Lead |
| Phase 2: Infrastructure Setup | 2-3 days | Backend Lead |
| Phase 3: Backend Migration | 1 week | Backend Team (2 people) |
| Phase 4: Frontend Migration | 3-4 days | Frontend Team |
| Testing & Deployment | 2-3 days | QA + DevOps |
| **Total** | **~2 weeks** | Cross-functional |

---

## 🎯 Success Criteria

✅ All 71 endpoints migrated to `/api/v1/daos` structure  
✅ Zero legacy `/api/dao*` calls in frontend  
✅ All 410 Gone handlers in place with migration hints  
✅ Zero TypeScript errors in backend  
✅ Zero API call failures in frontend  
✅ Proposal daoId properly threaded through all call sites  
✅ Pool governance accessible under DAO scope  
✅ Full tenant isolation enforced at middleware level  

---

**Next Steps:**
1. Review findings on issues #1-3
2. Approve consolidation mapping
3. Identify all frontend files needing updates (audit)
4. Create Phase 2 infrastructure (directory structure)
5. Begin backend migration

