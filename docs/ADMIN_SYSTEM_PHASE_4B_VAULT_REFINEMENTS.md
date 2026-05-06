# Phase 4B: Vault Refinements - Replace Mock Endpoints with Real DB Calls

**Status:** ✅ IMPLEMENTATION COMPLETE (3 of 6 tasks)

**Phase Focus:** Make savings vault lock time configurable and replace all mock vault endpoints with real database calls.

---

## ✅ Completed Tasks

### 1. ✅ Make Savings Vault Lock Duration Configurable

**File:** `/server/utils/vaultTypeValidators.ts`

**Changes:**
- Updated `TypeConstraintRules` interface to add:
  - `minLockDuration?: number` - Minimum lock duration in milliseconds (1 day)
  - `maxLockDuration?: number` - Maximum lock duration in milliseconds (365 days / 1 year)
  
- Updated `VAULT_TYPE_CONSTRAINTS` for savings vault:
  - Removed hardcoded `lockDuration: 30 * 24 * 60 * 60 * 1000`
  - Added `minLockDuration: 1 * 24 * 60 * 60 * 1000` (1 day minimum)
  - Added `maxLockDuration: 365 * 24 * 60 * 60 * 1000` (1 year maximum)

- Added new validation function `validateLockDuration()`:
  - Validates lock duration is within configured min/max range
  - Only applies to savings vault type
  - Returns detailed error messages with min/max milliseconds

**Impact:** Savings vaults now support configurable lock duration from 1 day to 1 year per instance.

---

### 2. ✅ Updated Database Schema for Vault Ownership

**File:** `/shared/schema.ts`

**New Columns Added to `vaults` Table:**
```sql
-- Ownership model (replaces userId/daoId nullable ambiguity)
owner_type VARCHAR(50),        -- 'user' | 'dao'
owner_id UUID,                  -- userId or daoId depending on owner_type

-- Treasury linking for DAO vaults
treasury_id UUID REFERENCES daos(id),  -- links vault to DAO treasury

-- Type-specific configuration
vault_config JSONB              -- stores lockDuration, strategy params, etc
```

**Benefits:**
- ✅ Clear ownership semantics (no more nullable userId/daoId ambiguity)
- ✅ Efficient queries with composite index on (owner_type, owner_id)
- ✅ Proper DAO treasury linkage for hierarchical vault organization
- ✅ Flexible configuration storage for type-specific settings

---

### 3. ✅ Replaced All Mock GET Endpoints with Real Database Queries

**File:** `/server/routes/v1/daos/_daoId/treasury/vaults.ts`

#### Endpoint 1: GET /v1/daos/:daoId/treasury/vaults (List all vaults)

**Before:** Hardcoded mock array with 2 vaults (vault_operations, vault_growth)

**After - REAL DB:**
```typescript
// Query all vaults for this DAO treasury
const treasuryVaults = await db
  .select()
  .from(vaults)
  .where(eq(vaults.treasuryId, daoId));

// Map to response format with real data
return formattedVaults map including:
- id, name, description, vaultType
- balance, totalValueLocked, riskLevel
- isActive, config (lock duration settings)
- createdAt/updatedAt timestamps
```

**Response Fields:**
- `vaultsCount`: Actual number of vaults for this DAO
- `vaults[]`: Real vault records from database

---

#### Endpoint 2: GET /v1/daos/:daoId/treasury/vaults/:vaultId (Get vault details)

**Before:** Hardcoded "Operations Fund" details

**After - REAL DB:**
```typescript
// Query specific vault and verify ownership
const vault = await db
  .select()
  .from(vaults)
  .where(eq(vaults.id, vaultId));

// Verify ownership: vaultRecord.treasuryId === daoId
if (vaultRecord.treasuryId !== daoId) {
  return 403 (Vault does not belong to this DAO)
}

// Query allocations for detailed response
const allocations = await db
  .select()
  .from(vaultStrategyAllocations)
  .where(eq(vaultStrategyAllocations.vaultId, vaultId));
```

**Enhanced Response:**
- Real vault configuration with type-specific settings
- Actual allocation breakdown (USDC, DAI, USDT, etc)
- Real balance and TVL data
- Proper error handling for vault not found (404) and unauthorized access (403)

---

#### Endpoint 3: GET /v1/daos/:daoId/treasury/vaults/:vaultId/positions

**Before:** Hardcoded positions array (USDC, DAI, USDT with mock amounts)

**After - REAL DB:**
```typescript
// Query vault allocations from database
const allocations = await db
  .select()
  .from(vaultStrategyAllocations)
  .where(eq(vaultStrategyAllocations.vaultId, vaultId));

// Map to positions format
positions = allocations.map(alloc => ({
  symbol: alloc.tokenSymbol,
  amount: alloc.allocatedAmount,
  value: alloc.allocatedAmount, // Could integrate with price oracle
  percentage: parseFloat(alloc.allocationPercentage),
  allocation: percentage > 50 ? 'primary' : percentage > 25 ? 'secondary' : 'tertiary'
}));
```

**Enhanced Response:**
- `positionsCount`: Actual count of asset positions
- `positions[]`: Real holdings from allocations table
- `totalValue`: Real TVL from vault record
- `updatedAt`: Current timestamp

---

#### Endpoint 4: GET /v1/daos/:daoId/treasury/vaults/:vaultId/nav

**Before:** Hardcoded NAV metrics (currentValue: 98500.25, gain: -1499.75, etc)

**After - REAL DB:**
```typescript
// Query vault record
const vault = await db.select().from(vaults).where(eq(vaults.id, vaultId));

// Query transaction history to calculate performance
const transactions = await db
  .select()
  .from(vaultTransactions)
  .where(eq(vaultTransactions.vaultId, vaultId));

// Calculate metrics
allocatedCapital = SUM(deposits) - SUM(withdrawals)
currentValue = vault.balance || vault.totalValueLocked
gain = currentValue - allocatedCapital
gainPercentage = (gain / allocatedCapital) * 100
```

**Real Performance Metrics:**
- `currentValue`: Actual vault balance or TVL
- `allocatedCapital`: Sum of all deposits into vault
- `withdrawnAmount`: Sum of all withdrawals from vault
- `gain/gainPercentage`: Real performance vs. allocated capital
- `performanceMetrics.totalTransactions`: Count from transaction history
- Fee information (management fee, performance fee)

---

## ✅ Updated Core Implementation

### Import Consolidation

**File:** `/server/routes/v1/daos/_daoId/treasury/vaults.ts`

**Before:**
```typescript
// Dynamic imports inside endpoints
const { db } = await import('../../../../../db');
const { vaultStrategyAllocations, vaultTransactions } = await import('../../../../../shared/schema');
const { eq } = await import('drizzle-orm');
```

**After:**
```typescript
// Top-level imports using path aliases
import { eq } from 'drizzle-orm';
import { db } from '../../../../../storage';
import { vaults, vaultStrategyAllocations, vaultTransactions } from '@shared/schema';
```

**Benefits:**
- ✅ Cleaner code with static imports
- ✅ Better type checking and IDE support
- ✅ Uses established path aliases (@shared/*)
- ✅ Removed dynamic import overhead

---

## 📋 Database Migration

### Migration Files Created

**File 1:** `/server/migrations/004_vault_ownership_treasury_linking.sql`
- SQL migration script with all ALTER TABLE and backfill statements
- Verification queries for post-migration validation
- Partially commented for staged execution

**File 2:** `/server/migrations/004_vault_ownership_treasury_linking.ts`
- TypeScript migration with `up()` and `down()` functions
- Transaction logging at each step
- Validation queries showing results
- Can be executed programmatically or via CLI

### Migration Steps (when executed)

1. **Add Columns:**
   - `owner_type VARCHAR(50)` - ownership type
   - `owner_id UUID` - owner identifier
   - `treasury_id UUID REFERENCES daos(id)` - DAO treasury link
   - `vault_config JSONB` - type-specific settings

2. **Create Indexes:**
   - `idx_vaults_owner_type_id` - composite index for ownership queries
   - `idx_vaults_treasury_id` - for DAO scoping queries

3. **Backfill Owner Type:**
   - Personal vaults: `owner_type='user'`, `owner_id=user_id`
   - DAO vaults: `owner_type='dao'`, `owner_id=dao_id`

4. **Link to Treasury:**
   - DAO vaults linked via `treasury_id=dao_id` for hierarchical organization

5. **Initialize Configuration:**
   - Savings vaults get `vault_config` with:
     - `lockDurationMs`: Existing lock_duration or 30-day default
     - `minLockDurationMs`: 1 day (86400000 ms)
     - `maxLockDurationMs`: 1 year (31536000000 ms)
     - `configurable`: true flag

---

## 🔄 Working Endpoints (Already Implemented)

### POST /v1/daos/:daoId/treasury/vaults/:vaultId/allocate
- ✅ REAL DATABASE: Creates vaultStrategyAllocations records
- ✅ REAL DATABASE: Logs transaction to vaultTransactions table
- ✅ AUDIT LOGGING: Records allocation with CRITICAL severity
- Status: Ready for testing

### POST /v1/daos/:daoId/treasury/vaults/:vaultId/rebalance
- ✅ REAL DATABASE: Queries current allocations
- ✅ REAL DATABASE: Updates vaultStrategyAllocations records
- ✅ REAL DATABASE: Creates rebalance transaction
- ✅ AUDIT LOGGING: Records rebalance operation
- Status: Ready for testing

---

## ⏭️ Remaining Tasks (Phase 4B)

### Task 4: Create Database Migration Execution Script
**Current Status:** Migration files created but not yet executed
**Action:** Run migration script on test/prod databases to apply schema changes
```bash
# TypeScript migration runner
npx ts-node server/migrations/004_vault_ownership_treasury_linking.ts
```

### Task 5: Update Allocation/Rebalance Endpoints to Use owner_type/owner_id
**Current Status:** Endpoints still use implicit ownership from userId/daoId
**Action:** Update endpoints to include new owner_type/owner_id in queries
```typescript
// Update queries to use new model
where(and(
  eq(vaults.id, vaultId),
  eq(vaults.treasuryId, daoId) // Uses treasury_id for scoping
))
```

### Task 6: Consolidate/Deprecate Old Vault Routes
**Current Status:** Old routes still exist
**Pending Routes:**
- `/wallet/savings` → consolidate to `/v1/wallets/vaults` (type: savings)
- `/dao/bounty-escrow` → consolidate to `/v1/daos/:daoId/treasury/vaults` (type: escrow)
- `/api/vaults/{id}` → migrate to `/v1/vaults/{id}`

**Action:** 
1. Add deprecation warnings to old routes
2. Create redirect handlers
3. Mark for removal in next phase

---

## 🧪 Testing Checklist (Phase 4B Completion)

- [ ] Migration script runs without errors
- [ ] Existing vault records have owner_type and owner_id populated
- [ ] DAO vaults linked to correct treasury_id
- [ ] Savings vault_config contains lock duration settings
- [ ] GET /vaults list returns real database records
- [ ] GET /vaults/:id returns real vault details with allocations
- [ ] GET /vaults/:id/positions returns actual holdings
- [ ] GET /vaults/:id/nav calculates real performance metrics
- [ ] Lock duration validation enforces 1 day - 365 day range
- [ ] Allocate endpoint creates records with owner_type/owner_id
- [ ] Rebalance endpoint works with new ownership model
- [ ] Composite index (owner_type, owner_id) improves query performance

---

## 📊 Performance Impact

### Database Optimizations
- ✅ New composite index: `(owner_type, owner_id)` - Scopes queries efficiently
- ✅ Dedicated index: `treasury_id` - Fast DAO treasury lookups
- ✅ JSONB config column - Flexible schema for future settings

### Query Efficiency
**Before:** Nullable userId/daoId required OR logic in WHERE clauses
**After:** Direct `WHERE owner_type='dao' AND owner_id=:daoId` queries

**Example:**
```typescript
// Before: Had to check multiple nullable fields
where(or(
  eq(vaults.userId, userId),
  eq(vaults.daoId, daoId)
))

// After: Explicit ownership model
where(eq(vaults.ownerId, userId))
where(eq(vaults.ownerId, daoId))
```

---

## 🔐 Security Considerations

### Ownership Verification
All endpoints now explicitly verify:
1. Vault exists (`404 if not found`)
2. Ownership matches context (`403 if unauthorized`)

**Example:**
```typescript
if (vaultRecord.treasuryId !== daoId) {
  return 403 (Vault does not belong to this DAO)
}
```

### Access Control
- ✅ treasuryAdminGuard applied to write endpoints (allocate, rebalance)
- ✅ Authentication required for all endpoints
- ✅ Rate limiting applied per-user basis
- ✅ All operations logged to audit trail

---

## 📝 Config Lock Duration Reference

**Savings Vault Lock Duration Constraints:**
- Minimum: 1 day (86,400,000 ms)
- Maximum: 1 year (31,536,000,000 ms)
- Configurable per vault instance
- Stored in `vault_config` JSONB field

**Validation:**
```typescript
validateLockDuration('savings', lockDurationMs)
// Returns: { valid: true, minMs: 86400000, maxMs: 31536000000 }
```

---

## 🚀 Next Phase (Phase 5)

1. Test all endpoints with real database
2. Execute migration on production database
3. Monitor performance with new indexes
4. Consolidate deprecated routes
5. Full integration testing with multisig operations
6. User/DAO vault creation with new ownership model

---

## 📚 Reference Files

| File | Purpose |
|------|---------|
| `server/utils/vaultTypeValidators.ts` | Type constraints with configurable lock duration |
| `shared/schema.ts` | Updated vaults table schema with ownership fields |
| `server/routes/v1/daos/_daoId/treasury/vaults.ts` | Real DB endpoints for vault operations |
| `server/migrations/004_vault_ownership_treasury_linking.sql` | SQL migration script |
| `server/migrations/004_vault_ownership_treasury_linking.ts` | TypeScript migration with validation |

---

**Last Updated:** 2025-02-21
**Phase Status:** ✅ 50% Complete (3 of 6 core tasks finished)
**Next Milestone:** Run migration and execute comprehensive testing
