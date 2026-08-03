# 🚨 Critical Route Structure Issues - Diagnostic Report

**Date:** June 19, 2026  
**Severity:** CRITICAL - Multiple domains unreachable due to Express sub-router mounting bugs  
**Impact:** All `/api/v1/daos/:daoId/*` and `/api/v1/strategies/*` sub-resources  

---

## Executive Summary

Your API has **5 critical categories of route problems**:

1. **RegExp Route Leakage**: Sub-router regex patterns bleeding into path strings (UNREACHABLE ROUTES)
2. **Triple Domain Duplication**: 3 domains (deposits, transactions, withdrawals) expose identical 4 paths
3. **Exact Domain Clones**: 5 domain pairs with identical/near-identical functionality
4. **Double Nesting**: V1 sub-routers mounted at wrong levels
5. **Orphaned Route Files**: Unmaintained stub files polluting the namespace

---

## ISSUE #1: RegExp Route Leakage (BLOCKING)

### Problem Description

Express sub-router mounting is exposing internal regex patterns instead of clean paths. Routes are essentially **unreachable** because the router paths don't match properly.

### Affected Routes

```
/api/v1/daos/ RegExp(/^(?:\\/)\\/?(?=\\/|$)/i) /members
/api/v1/daos/ RegExp(/^(?:\\/)\\/backtest\\/?(?=\\/|$)/i) /backtest
/api/v1/strategies/ RegExp(/^(?:\\/)\\/backtest\\/?(?=\\/|$)/i) /backtest
```

### Root Cause

**File:** `server/routes/v1/daos/index.ts` (lines 55-59)

```typescript
// ❌ WRONG: This re-mounts at /:daoId after already being mounted at that level
const router = express.Router({ mergeParams: true });

/**
 * Mount DAO-scoped consolidation router
 */
router.use('/:daoId', daoIdRouter);  // ❌ LINE 59 - DOUBLE NESTING!
```

**Parent File:** `server/routes/v1/daos.ts` (line 567)

```typescript
// Parent already mounts at /:daoId
router.use('/:daoId', daoIdRouter);  // Parent level
```

This creates: `/api/v1/daos/:daoId/:daoId/*` which breaks all sub-routes.

### Impact

ALL these routes are currently **unreachable**:
- ✗ GET `/api/v1/daos/:daoId/members`
- ✗ GET `/api/v1/daos/:daoId/treasury`
- ✗ GET `/api/v1/daos/:daoId/proposals`
- ✗ GET `/api/v1/daos/:daoId/chat`
- ✗ GET `/api/v1/daos/:daoId/governance`
- ✗ GET `/api/v1/daos/:daoId/investment-pools`
- ✗ GET `/api/v1/daos/:daoId/subscriptions`
- ✗ GET `/api/v1/daos/:daoId/abuse`
- ✗ GET `/api/v1/daos/:daoId/contributions`
- ✗ GET `/api/v1/daos/:daoId/billing`

### Fix

**File:** `server/routes/v1/daos/index.ts`

**Change:** Remove lines 55-59 (the duplicate mount)

```typescript
// ✅ CORRECT: Export the router directly - don't re-mount
export default daoIdRouter;
```

Or if index.ts needs to stay, make it a pass-through:

```typescript
import express from 'express';
import daoIdRouter from './_daoId';

const router = express.Router({ mergeParams: true });

// ✅ CORRECT: Mount the sub-routers directly from _daoId
// (daoIdRouter already contains all the mounts)
router.use('/', daoIdRouter);  // ✅ Mount at root, not /:daoId

export default router;
```

---

## ISSUE #2: Triple Deposit/Withdraw Duplication

### Problem Description

THREE separate domains all mount the SAME 4-endpoint handler, creating massive redundancy and confusing API structure.

### Current State

**File:** `server/routes.ts` (lines 395-397)

```typescript
app.use('/api/deposits', depositsWithdrawalsRoutes);      // Line 395
app.use('/api/withdrawals', depositsWithdrawalsRoutes);   // Line 396
app.use('/api/transactions', depositsWithdrawalsRoutes);  // Line 397
```

**Handler File:** `server/routes/deposits-withdrawals.ts`

```typescript
const router = Router();

router.get('/deposits', isAuthenticated, (req, res) => {
  res.json({ deposits: [] });
});

router.get('/withdrawals', isAuthenticated, (req, res) => {
  res.json({ withdrawals: [] });
});

router.post('/deposit', isAuthenticated, (req, res) => {
  res.json({ success: true });
});

router.post('/withdraw', isAuthenticated, (req, res) => {
  res.json({ success: true });
});
```

### Current Routes (All Available!)

```
GET    /api/deposits/deposits        (redundant)
GET    /api/deposits/withdrawals     (wrong domain!)
POST   /api/deposits/deposit         (redundant)
POST   /api/deposits/withdraw        (wrong domain!)

GET    /api/withdrawals/deposits     (wrong domain!)
GET    /api/withdrawals/withdrawals  (redundant)
POST   /api/withdrawals/deposit      (wrong domain!)
POST   /api/withdrawals/withdraw     (redundant)

GET    /api/transactions/deposits    (VERY wrong!)
GET    /api/transactions/withdrawals (VERY wrong!)
POST   /api/transactions/deposit     (VERY wrong!)
POST   /api/transactions/withdraw    (VERY wrong!)
```

### Impact

- Clients don't know which domain to use
- `/api/transactions` returns deposit/withdrawal data instead of transaction batches
- Wastes 12 route slots for 4 actual operations
- Violates REST semantics (resources vs operations mismatch)

### Fix Strategy

**Option A: Consolidate to Single Domain** (Recommended)

Create `/api/v1/transactions` with proper sub-resources:

```typescript
GET    /api/v1/transactions              → List all transactions
POST   /api/v1/transactions              → Create new transaction
GET    /api/v1/transactions/:txId        → Get transaction details
DELETE /api/v1/transactions/:txId        → Cancel transaction

GET    /api/v1/transactions/deposits     → List deposits
GET    /api/v1/transactions/withdrawals  → List withdrawals
POST   /api/v1/transactions/deposits     → Create deposit
POST   /api/v1/transactions/withdrawals  → Create withdrawal
```

**Option B: Use Proper Wallet Sub-Routes**

```typescript
GET    /api/v1/wallets/:walletId/deposits     → List deposits for wallet
GET    /api/v1/wallets/:walletId/withdrawals  → List withdrawals for wallet
POST   /api/v1/wallets/:walletId/deposits     → Deposit to wallet
POST   /api/v1/wallets/:walletId/withdrawals  → Withdraw from wallet
```

**Immediate Fix (3 lines):**

Replace lines 395-397 in `server/routes.ts`:

```typescript
// ✅ Remove all three lines:
// app.use('/api/deposits', depositsWithdrawalsRoutes);
// app.use('/api/withdrawals', depositsWithdrawalsRoutes);
// app.use('/api/transactions', depositsWithdrawalsRoutes);

// ✅ Add proper v1 transaction routes:
// TODO: Create v1/transactions router with proper structure
```

---

## ISSUE #3: Exact Domain Clones & Orphaned Routes

### 3A: DEX = DEX-SCREENER

**Status:** ⚠️ CRITICAL DUPLICATION

**Files:**
- `server/routes/dex.ts` - STUB (2 endpoints)
- `server/routes/dex-screener.ts` - REAL (8 endpoints)

**Current Mounts:**
- `server/index.ts` line 1267: `app.use('/api/dex', dexScreenerRoutes);`
- `server/routes/dex.ts` is **ORPHANED** - NOT MOUNTED

**dex-screener.ts Endpoints:**
```typescript
GET  /health
GET  /search-pairs
GET  /pairs/:chain/:pairAddress
GET  /token-pairs/:chain/:tokenAddress
GET  /trending-pairs
POST /symbol-universe/sync
DELETE /cache/clear
GET  /cache/stats
```

**Fix:** Remove `server/routes/dex.ts` - it's unused

---

### 3B: FEATURES = FEATURE-ANALYTICS

**Status:** ⚠️ LIKELY DUPLICATION

**Files:**
- `server/routes/features.ts` - STATUS UNKNOWN
- `server/routes/featureAnalytics.ts` - REAL

**Current Mounts:**
- `server/index.ts` line 1231: `app.use('/api/features', featureAnalyticsRoutes);`

**Action:** Review `features.ts` - if stub, remove it

---

### 3C: API-REGISTRY = DOCS

**Status:** ⚠️ SUSPICIOUS NAMING

**Files:**
- `server/routes/apiRegistry.ts` - Likely 8 stat endpoints
- Named as "registry" but mounted as `/api/docs`

**Current Mounts:**
- `server/index.ts` line 1317: `app.use('/api/docs', apiRegistryRoutes);`

**Issue:** Confusing naming - "registry" vs "docs"

**Fix:** Rename to clarify purpose:
- If it's OpenAPI documentation: `/api/openapi` + `/api/openapi/docs`
- If it's endpoint stats: `/api/admin/registry` + `/api/admin/registry/stats`

---

### 3D: GRAPH-PROPAGATION ≈ PROPAGATION

**Status:** ⚠️ POTENTIAL CONFLICT

**Files:**
- `server/routes/graph-propagation.ts` - REAL

**Current Mounts (BOTH PRESENT!):**
- `server/routes.ts` line 485: `app.use('/api/propagation', graphPropagationRoutes);`
- `server/index.ts` line 1233: `app.use('/api/propagation', graphPropagationRoutes);`

**Issue:** SAME ROUTE MOUNTED TWICE (creates conflict/override)

**Impact:** Only one mounts successfully; the other is ignored/overridden

**Fix:** Keep ONLY the mount in `server/routes.ts` - remove from `index.ts`

---

### 3E: :daoId DOMAIN = PROPOSAL-EXECUTION DOMAIN

**Status:** ⚠️ STRUCTURAL DUPLICATION

**Files:**
- `server/routes/proposal-execution.ts` - 3 endpoints (queue/execute/cancel)

**Current Mounts:**
- `server/routes.ts` line 367: `app.use('/api/proposal-execution', proposalExecutionRoutes);`
- `server/index.ts` line 326: `router.use('/proposal-execution', proposalExecutionRouter);`

**Issue:** PROPOSAL-EXECUTION MOUNTED TWICE (in two different servers!)

**Should be:** Mounted at DAO-scoped level:
```typescript
/api/v1/daos/:daoId/proposal-execution/
```

**Fix:** Remove both mounts above and integrate into v1/daos/:daoId tree

---

## ISSUE #4: Strategies Route Regex Leakage

### Affected Paths

```
/api/v1/strategies/ RegExp(/^(?:\\/)\\/backtest\\/?(?=\\/|$)/i) /backtest
```

### Root Cause

Same double-nesting pattern as Issue #1 - likely in `server/routes/v1/strategies/index.ts`

### Fix

Same solution: Remove duplicate `:strategyId` mounts in the index.ts file

---

## Consolidated Fix Checklist

### IMMEDIATE (BLOCKING - Do These First)

- [ ] **Fix v1/daos double-nesting** (`server/routes/v1/daos/index.ts` line 59)
  - Remove: `router.use('/:daoId', daoIdRouter);`
  - Export: `export default daoIdRouter;` OR mount at root

- [ ] **Fix v1/strategies double-nesting** (search for similar pattern)
  - Same fix as daos

- [ ] **Fix propagation conflict** (remove `server/index.ts` line 1233)
  - Keep: `server/routes.ts` line 485 ONLY
  - Remove: `server/index.ts` line 1233

- [ ] **Test all v1 DAO sub-routes**
  - POST `/api/v1/daos/:daoId/members`
  - GET `/api/v1/daos/:daoId/treasury`
  - GET `/api/v1/daos/:daoId/proposals`
  - etc.

### SHORT-TERM (Clean Up This Week)

- [ ] **Consolidate deposit/transaction/withdrawal routes**
  - Option A: Create `/api/v1/transactions` domain
  - Option B: Move to `/api/v1/wallets/:walletId/*`

- [ ] **Remove orphaned files:**
  - `server/routes/dex.ts` (use dex-screener instead)
  - `server/routes/features.ts` (if stub; use featureAnalytics)

- [ ] **Remove duplicate proposal-execution mounts**
  - Delete from `server/routes.ts` line 367
  - Delete from `server/index.ts` line 326
  - Move to v1/daos/:daoId/proposal-execution

- [ ] **Rename/clarify apiRegistry → openapi or stats**

### MEDIUM-TERM (Proper Structure)

- [ ] **Consolidate all DAO sub-resources under v1:**
  ```
  /api/v1/daos/:daoId/
  ├─ members/
  ├─ treasury/
  ├─ proposals/
  ├─ proposal-execution/  ← Move here
  ├─ chat/
  ├─ governance/
  ├─ investment-pools/
  ├─ subscriptions/
  ├─ abuse/
  ├─ contributions/
  └─ billing/
  ```

- [ ] **Create proper transaction domain:**
  ```
  /api/v1/transactions/
  ├─ GET / (list)
  ├─ POST / (create)
  ├─ GET /:txId
  ├─ DELETE /:txId
  ├─ deposits/
  └─ withdrawals/
  ```

---

## Testing Strategy

After each fix, verify with:

```bash
# Test all v1 DAO routes
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/v1/daos/test-dao-id/members

# Test all v1 strategies routes  
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/v1/strategies/test-id/backtest

# Test propagation route (should exist in ONE place only)
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/propagation/status

# Verify no conflicts
npm run build  # Should complete without errors
```

---

## Affected Files Summary

| File | Issue | Action |
|------|-------|--------|
| `server/routes/v1/daos/index.ts` | Double nesting | Remove line 59 |
| `server/routes/v1/strategies/index.ts` | Double nesting | Same fix |
| `server/routes.ts` | Triple deposit duplication | Consolidate lines 395-397 |
| `server/index.ts` line 1233 | Propagation conflict | Remove |
| `server/routes/dex.ts` | Orphaned | Delete |
| `server/routes/features.ts` | Likely orphaned | Review/Delete |
| `server/routes/proposal-execution.ts` | Wrong mount points | Move to v1/daos/:daoId |

---

## Critical Impact Summary

**Currently Unreachable Routes (BREAKING):**
- All 10 sub-domains under `/api/v1/daos/:daoId/*`
- All sub-routes under `/api/v1/strategies/:strategyId/*`
- **Total: ~50+ routes blocked**

**Confusing/Wrong Routes:**
- 12 deposit/withdrawal routes in wrong domains
- 2 propagation mounts (conflict)
- 2 proposal-execution mounts (conflict)

**Orphaned/Unused Code:**
- `server/routes/dex.ts` (never mounted)
- `server/routes/features.ts` (likely)

---

## Questions for Implementation

1. Should `/api/transactions` stay as a legacy endpoint or migrate to v1?
2. Should deposits/withdrawals be consolidated or distributed across wallets?
3. Should proposal-execution be DAO-scoped or global?
4. Is `apiRegistry` for docs or stats? (Clarify naming)

