# 🎯 MIGRATION DECISIONS - FINALIZED & CONFIRMED

**Date:** Migration Phase 2 Kickoff  
**Status:** ✅ ALL CRITICAL DECISIONS RESOLVED  
**Impact:** Ready to proceed with implementation

---

## 📋 Decision Matrix

| Decision | Status | Scope | Implementation | Files |
|----------|--------|-------|-----------------|-------|
| Pool Ownership & Multi-Asset | ✅ CONFIRMED | Per-DAO, Multi-Asset | Pools at `/api/v1/daos/:daoId/investment-pools` | 3 pool files |
| Governance Scope | ✅ CONFIRMED | System-Wide + DAO-Specific | Both scopes maintained | 4 governance files |
| Chat Ownership | ✅ CONFIRMED | Per-DAO | At `/api/v1/daos/:daoId/chat` | 1 chat file |

---

## ✅ Decision #1: Investment Pools - FULLY CLARIFIED

### Question
- ❓ Does each pool belong to a single DAO?
- ❓ Can pools contain multiple assets?
- ❓ How should endpoints be scoped?

### Answer (Confirmed)
✅ **Each pool belongs to exactly ONE DAO**
- Pools are a feature of DAOs where members pool assets together
- Pools cannot exist as standalone entities
- Each pool has a `daoId` foreign key relationship

✅ **Pools ARE MULTI-ASSET by design**
- One pool can contain ETH, USDC, cEUR, and other cryptocurrencies
- The `poolAssets` table manages portfolio composition
- Each asset has a `targetAllocation` (expressed in basis points)
- Members can view the complete asset composition

✅ **Endpoint Scoping**
```typescript
// All pool endpoints are DAO-scoped
GET    /api/v1/daos/:daoId/investment-pools
GET    /api/v1/daos/:daoId/investment-pools/:poolId
GET    /api/v1/daos/:daoId/investment-pools/:poolId/assets
POST   /api/v1/daos/:daoId/investment-pools
POST   /api/v1/daos/:daoId/investment-pools/:poolId/assets
PATCH  /api/v1/daos/:daoId/investment-pools/:poolId/assets/:assetSymbol
DELETE /api/v1/daos/:daoId/investment-pools/:poolId/assets/:assetSymbol
```

### Schema Validation
```sql
-- CONFIRMED STRUCTURE
investmentPools table:
  - id: uuid (primary key)
  - daoId: uuid (foreign key to daos) ← Pool belongs to DAO
  - name: varchar
  - symbol: varchar
  - description: text
  - totalValueLocked: numeric
  - sharePrice: numeric
  - performanceFee: numeric
  - createdAt, updatedAt

poolAssets table:
  - id: uuid (primary key)
  - poolId: uuid (foreign key to investmentPools) ← Asset belongs to pool
  - assetSymbol: varchar (e.g., 'ETH', 'USDC', 'cEUR')
  - tokenAddress: varchar
  - network: varchar (e.g., 'ethereum', 'polygon')
  - targetAllocation: integer (basis points, e.g., 5000 = 50%)
  - currentBalance: numeric
  - currentValueUsd: numeric
  - createdAt, updatedAt
```

### Implementation Impact
- **Files Affected:** 3 pool-related endpoint files
- **Breaking Changes:** None (multi-asset structure already in schema)
- **New Endpoints:** None (structure already confirmed)
- **Testing:** Verify multi-asset allocation calculations

### Phase 2 Tasks
- [ ] Update pool controller to enforce DAO ownership
- [ ] Implement pool asset management endpoints (CRUD)
- [ ] Add allocation validation (sum = 100%)
- [ ] Implement multi-asset balance calculations
- [ ] Create pool with initial assets (POST endpoint)
- [ ] Update pool assets (PATCH endpoint)
- [ ] Remove assets from pool (DELETE endpoint)

---

## ✅ Decision #2: Governance Scope - DUAL LEADERBOARDS

### Question
- ❓ Should leaderboards be system-wide only?
- ❓ Should leaderboards be DAO-specific only?
- ❓ What types of leaderboards exist?

### Answer (Confirmed)
✅ **TWO TYPES OF LEADERBOARDS COEXIST**

#### Type 1: System-Wide Leaderboards (Global)
These track platform-level metrics across all DAOs:
- Referral leaderboards (total referrals across platform)
- Global contributor ranking
- Platform-wide strategy performance
- Global governance participation stats

**Endpoints (No daoId):**
```typescript
GET /api/v1/governance/leaderboard              // Global metrics
GET /api/v1/governance/leaderboard/referrals    // Global referral rankings
GET /api/v1/governance/leaderboard/contributors // Global contributors
GET /api/v1/governance/leaderboard/consolidated // System-wide stats
GET /api/v1/governance/stats                    // Overall governance metrics
```

#### Type 2: DAO-Specific Leaderboards (Per-DAO)
These track activity metrics within a specific DAO:
- DAO member activity ranking
- DAO contribution leaderboard
- DAO strategy performance
- DAO governance participation stats

**Endpoints (With daoId):**
```typescript
GET /api/v1/daos/:daoId/governance/leaderboard
GET /api/v1/daos/:daoId/governance/leaderboard/activity
GET /api/v1/daos/:daoId/governance/leaderboard/contributions
GET /api/v1/daos/:daoId/governance/leaderboard/strategy
GET /api/v1/daos/:daoId/governance/leaderboard/voting
GET /api/v1/daos/:daoId/governance/stats
GET /api/v1/daos/:daoId/governance/members
```

### Query Pattern
```typescript
// System-wide: Aggregate across all DAOs
SELECT user_id, COUNT(*) as referral_count
FROM referrals
GROUP BY user_id
ORDER BY referral_count DESC

// DAO-specific: Filter by daoId
SELECT user_id, COUNT(*) as contributions
FROM dao_contributions
WHERE dao_id = :daoId
GROUP BY user_id
ORDER BY contributions DESC
```

### Implementation Impact
- **Files Affected:** 4 governance-related endpoint files
- **Breaking Changes:** None (endpoints are independent)
- **New Endpoints:** Duplicate structure (system + DAO-scoped)
- **Testing:** Verify both scopes return correct filtered data

### Phase 2 Tasks
- [ ] Keep system-wide endpoints at `/api/v1/governance/*`
- [ ] Add DAO-specific endpoints at `/api/v1/daos/:daoId/governance/*`
- [ ] Implement filtering logic in governance service
- [ ] Create separate queries for system-wide vs DAO-specific
- [ ] Add daoId validation for DAO-specific endpoints

---

## ✅ Decision #3: Chat Ownership - DAO-SCOPED

### Question
- ❓ Are chat channels per-DAO or global?
- ❓ How should chat endpoints be organized?

### Answer (Confirmed)
✅ **Chat channels are DAO-specific**
- Each DAO has its own chat space
- Chat cannot span multiple DAOs
- Channels are owned and managed at the DAO level

**Endpoint Scoping:**
```typescript
GET    /api/v1/daos/:daoId/chat/channels
GET    /api/v1/daos/:daoId/chat/channels/:channelId
POST   /api/v1/daos/:daoId/chat/messages
GET    /api/v1/daos/:daoId/chat/messages/:messageId
```

### Implementation Impact
- **Files Affected:** 1 chat-related endpoint file
- **Breaking Changes:** None (already DAO-scoped in current design)
- **New Endpoints:** None (structure already correct)

---

## 🚀 Phase 2 Implementation Roadmap

### Week 1: Investment Pools (Multi-Asset)
1. **Pool Asset Management**
   - Implement addAssetToPool endpoint
   - Implement removeAssetFromPool endpoint
   - Implement updateAssetAllocation endpoint

2. **Multi-Asset Calculations**
   - Calculate portfolio composition
   - Validate allocation sum = 100%
   - Calculate total pool value (multi-asset)

3. **Testing & Validation**
   - Unit tests for multi-asset calculations
   - Integration tests for pool endpoints
   - Verify allocation validation

### Week 2: Governance Leaderboards (Dual Scope)
1. **System-Wide Leaderboards**
   - Implement system-wide referral leaderboard
   - Implement global contributor ranking
   - Implement consolidated governance stats

2. **DAO-Specific Leaderboards**
   - Implement per-DAO activity leaderboard
   - Implement per-DAO contribution ranking
   - Implement per-DAO governance stats

3. **Testing & Validation**
   - Verify system-wide queries aggregate correctly
   - Verify DAO-specific queries filter correctly
   - Cross-check consistency between scopes

### Week 3: Chat & Finalization
1. **Chat Operations**
   - Verify DAO-scoped chat functionality
   - Test message persistence
   - Validate access control

2. **Phase 2 Completion**
   - Full endpoint test coverage
   - Documentation updates
   - Code review & cleanup

---

## 📊 Pre/Post Migration Comparison

### Before (Phase 1 State)
```
Governance: Global endpoints only
  /api/v1/governance/stats
  /api/v1/governance/leaderboard

Pools: Single-asset assumption
  /api/v1/daos/:daoId/investment-pools
  /api/v1/daos/:daoId/investment-pools/:poolId
  (No asset-level endpoints)
```

### After (Phase 2 State)
```
Governance: Dual-scope endpoints
  /api/v1/governance/* (system-wide)
  /api/v1/daos/:daoId/governance/* (DAO-specific)

Pools: Multi-asset support
  /api/v1/daos/:daoId/investment-pools
  /api/v1/daos/:daoId/investment-pools/:poolId
  /api/v1/daos/:daoId/investment-pools/:poolId/assets ← NEW
  /api/v1/daos/:daoId/investment-pools/:poolId/assets/:assetSymbol ← NEW
```

---

## ✅ Sign-Off

All critical decisions have been clarified and confirmed. Phase 2 implementation can proceed immediately.

- **Pool Structure:** ✅ Multi-asset, DAO-scoped, confirmed
- **Governance Scope:** ✅ Dual leaderboards, system-wide + DAO-specific
- **Chat Ownership:** ✅ DAO-scoped, confirmed
- **Implementation:** Ready to begin Phase 2 tasks

**Next Step:** Begin Week 1 - Investment Pools (Multi-Asset)
