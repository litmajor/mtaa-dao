# Critical DAO Creation Design Issues - Analysis & Solutions

**Date:** November 19, 2025
**Status:** Identified 3 fundamental design issues that require solving BEFORE Phase 1 implementation

---

## Issue #1: Chama Classification - Long-Term vs Short-Term vs Custom Type?

### The Question
> "A chama falls into a long term dao, right, even if rotating the money, or can the chama have its own design and different types"

### Current Schema Analysis
```typescript
// Current DAO Types (shared/schema.ts):
daoType: varchar("dao_type").default("free"), // free, short_term, collective, meta
plan: varchar("plan").default("free"), // free, premium, short_term, collective
```

### The Problem
Current 4 types (`free`, `short_term`, `collective`, `meta`) don't map to Mtaa's actual use cases:

| Current Type | Duration | Purpose | Chama Fit? |
|---|---|---|---|
| `free` | ∞ Ongoing | Generic, unlimited | ❌ Too vague |
| `short_term` | 30-90 days | Temporary fund | ❌ Chama rotates on schedule, not time-based |
| `collective` | ∞ Ongoing | Community project | ⚠️ Maybe if no governance |
| `meta` | Unknown | Unknown purpose | ❌ Not used |

**Chama Reality:**
- Rotates money on SCHEDULE (weekly, monthly, etc.), not fixed timeline
- Needs governance FOR rotation decisions but NO voting
- Can be short-term (1 year) or long-term (ongoing)
- Needs recurring event handling (next rotation date, next recipient)
- Has fixed rules (everyone contributes equal amount)

### Solution: Introduce "Rotation-Based" Design
Replace generic types with **actual Mtaa categories** that can have their own rules:

```typescript
// PROPOSED: Replace daoType with more specific categories
daoCategory: varchar("dao_category").default("general"), // merry-go-round, harambee, table-banking, burial-fund, traders-coop, etc.
durationModel: varchar("duration_model").default("rotation"), // time-based, rotation-based, ongoing
rotationFrequency?: varchar("rotation_frequency"), // weekly, monthly, quarterly (for chama)
nextRotationDate?: timestamp("next_rotation_date"), // when next person receives fund
isGovernanceRequired: boolean("is_governance_required").default(false), // chama needs FALSE
```

### Action Items
- [ ] Add `rotationFrequency`, `nextRotationDate` fields to daos table
- [ ] Add `durationModel` to distinguish "rotation-based" from "time-based"
- [ ] Create chama-specific rules: Fixed contribution amount, automatic rotation, no voting
- [ ] In create-dao.tsx: If user selects "Merry-Go-Round", show rotation frequency selector (weekly/monthly/quarterly) instead of governance options

---

## Issue #2: All DAOs Have Admins, But Short-Term/Chama Don't Need Proposals - How Do They Withdraw?

### The Question
> "All daos have admins even the short term ones, how will they coordinate the group and receive funds, how will they withdraw without proposals? how do i ensure only founder + elder can withdraw"

### Current Implementation Analysis

#### Withdrawal Permission Logic (vaultService.ts:449-450)
```typescript
case 'withdraw':
  // SECURITY FIX: Only admin and elder can withdraw from DAO vaults
  return ['admin', 'elder'].includes(userRole);
```

**Current System:**
- ✅ Withdrawal permission exists: admin OR elder
- ✅ Daily spending limits exist: `treasuryDailyLimit` (default $10K)
- ✅ Multi-sig thresholds exist: `treasuryRequiredSignatures` (default 3)
- ❌ **Problem:** Short-term DAOs shouldn't need multi-sig proposals (too slow)
- ❌ **Problem:** Elder role not created during DAO creation
- ❌ **Problem:** Founder is NOT automatically an elder (can't withdraw!)

#### Multi-Sig Withdrawal Flow (treasuryMultisigService.ts:22-80)
```typescript
async proposeWithdrawal(daoId, proposedBy, amount, recipient, purpose) {
  // Only elders and admins can propose:
  const membership = await db.select().from(daoMemberships)
    .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, proposedBy)))
  
  if (!['elder', 'admin'].includes(membership[0].role)) {
    throw "Only elders and admins can propose treasury withdrawals"
  }
  
  // Check multi-sig threshold
  const needsMultisig = daoData.treasuryMultisigEnabled && 
                       amount >= parseFloat(daoData.treasuryWithdrawalThreshold)
  
  // If needs multisig, must wait for signatures
  // If not, auto-approved
}
```

### The Problem Breakdown

| Scenario | Current Flow | Issue |
|---|---|---|
| **Short-term chama withdrawal** | Founder creates proposal → waits for 3 elder signatures → funds released | ⚠️ Too slow for "next person this Friday" |
| **Founder tries to withdraw** | Founder is `admin` but NOT `elder` → tries proposal → needs elder signatures from others → blocked if not enough elders | ❌ BROKEN: Founder can't access their own DAO treasury |
| **Only founder + elder should withdraw** | Currently enforces `['admin', 'elder'].includes(role)` | ⚠️ Admin could be anyone, but should be just founder |
| **Receiving next rotation** | Current system doesn't handle "recipient gets automatic access" | ❌ Missing feature |

### Solution: Different Withdrawal Modes by DAO Type

```typescript
// NEW FIELD IN daos TABLE:
withdrawalMode: varchar("withdrawal_mode").default("multisig"), 
  // "direct" (founder+elder only, instant)
  // "multisig" (multi-sig proposal, 2-3 signatures)
  // "rotation" (automatic when rotation date reaches)

// NEW FIELDS IN daoMemberships TABLE:
canInitiateWithdrawal: boolean("can_initiate_withdrawal").default(false), // elder or authorized
canApproveWithdrawal: boolean("can_approve_withdrawal").default(false), // for multisig
isRotationRecipient: boolean("is_rotation_recipient").default(false), // next person in chama
```

#### Implementation Strategy

**For Short-Term DAOs (Chama/Merry-Go-Round):**
```typescript
withdrawalMode: "direct"
// Founder automatically becomes BOTH admin AND elder
// Only founder + designated elders can withdraw
// No multi-sig needed for amounts < monthly budget
// Instant withdrawal for next rotation recipient
```

**For Collective DAOs (Harambee/Burial Funds):**
```typescript
withdrawalMode: "multisig"
// Admin + elders must approve via proposals
// Multi-sig required for all withdrawals > daily limit
// Slower but more secure
```

**For Time-Based Short-Term (Fixed-term fund):**
```typescript
withdrawalMode: "rotation"
// Automatic withdrawal on maturity date or rotation event
// No proposal needed
// Funds auto-released when rotation schedule triggers
```

---

## Issue #3: CRITICAL - Elder Role Missing from DAO Creation

### The Question
> "Also brings up we forgot elder role (required for multisig and other functionality) in create dao"

### Current Problem

#### Who Creates Elders?
- **Current:** Unknown! Code references `isElder: boolean` in daoMemberships but:
  - create-dao.tsx doesn't set it
  - dao_deploy.ts doesn't create elders
  - No endpoint exists to designate elders

#### Current Create DAO Flow (dao_deploy.ts)
```typescript
// 1. Create DAO record
const [dao] = await db.insert(daos).values({
  // ... basic info ...
  founderId: founderWallet,
  creatorId: founderWallet,
  treasuryMultisigEnabled: true,
  treasuryRequiredSignatures: 3,
  treasurySigners: [], // EMPTY! No signers set!
  // ... more fields ...
})

// 2. Create treasury vault
const [vault] = await db.insert(vaults).values({
  daoId: dao.id,
  type: 'dao_treasury',
  ownerWallet: founderWallet, // Founder gets vault access
})

// 3. Create founder membership
const [founderMembership] = await db.insert(daoMemberships).values({
  userId: founderWallet,
  daoId: dao.id,
  role: 'admin', // Only admin, NOT elder!
  isAdmin: true,
  isElder: false, // WRONG: Should be true!
})

// 4. Add invited members as pending
for (const member of invitedMembers) {
  await db.insert(daoMemberships).values({
    userId: member,
    daoId: dao.id,
    role: 'member',
    status: 'pending',
    isElder: false, // No elders designated!
  })
}
```

### The Consequences

**Bug #1: Founder Can't Withdraw**
```
Founder creates DAO
→ Added as admin (role='admin', isElder=false)
→ Tries to withdraw from treasury
→ treasuryMultisigService checks: if (!['elder', 'admin'].includes(role))
→ Founder IS admin, so passes check
→ But needs multi-sig signatures from... nobody (treasurySigners=[])
→ STUCK: Multi-sig enabled but no signers configured!
```

**Bug #2: No Multi-Sig Signers Set**
```
treasuryRequiredSignatures: 3
treasurySigners: [] // EMPTY ARRAY!
→ Any withdrawal attempt fails: 
   "Insufficient signers configured. Need 3, have 0"
```

**Bug #3: Invited Members Can't Become Elders**
```
No process to:
- Designate which invited members should be elders
- Set how many elders needed (should be 2-3 for short-term)
- Define elder responsibilities
```

### Solution: Update DAO Creation Flow

```typescript
// IN create-dao.tsx (new step):
// Step 2.5: "Select Elders" (after basic info, before governance)
// - Allow founder to select 2-3 members as elders
// - Show elder responsibilities based on DAO type
// - For short-term: suggest 2-3 elders
// - For collective: suggest 3-5 elders

// IN dao_deploy.ts (CRITICAL FIXES):

async function daoDeployHandler(req, res) {
  const {
    daoData,
    founderWallet,
    invitedMembers,
    selectedElders // NEW: array of user IDs to be elders
  } = req.body;

  // 1. Validate elders count
  if (!selectedElders || selectedElders.length < 2) {
    throw new ValidationError('At least 2 elders required for multi-sig');
  }

  // 2. Create DAO record
  const [dao] = await db.insert(daos).values({
    // ... existing fields ...
    founderId: founderWallet,
    treasuryMultisigEnabled: true,
    treasuryRequiredSignatures: selectedElders.length, // Set to actual elder count!
    treasurySigners: selectedElders, // Set the actual signer IDs
    withdrawalMode: daoData.daoType === 'short_term' ? 'direct' : 'multisig'
  }).returning();

  // 3. Create founder membership as BOTH admin AND elder
  await db.insert(daoMemberships).values({
    userId: founderWallet,
    daoId: dao.id,
    role: 'elder', // Change from 'admin' to 'elder'
    isAdmin: true,
    isElder: true, // FIXED: Founder is elder
    canInitiateWithdrawal: true,
    canApproveWithdrawal: true
  }).returning();

  // 4. Create selected elders
  for (const elderId of selectedElders) {
    if (elderId !== founderWallet) { // Skip if founder already created above
      await db.insert(daoMemberships).values({
        userId: elderId,
        daoId: dao.id,
        role: 'elder',
        status: 'pending', // They need to accept
        isElder: true,
        canInitiateWithdrawal: daoData.daoType !== 'short_term', // Only in collective
        canApproveWithdrawal: true // Elders can approve withdrawals
      }).returning();
    }
  }

  // 5. Create other invited members (as regular members)
  for (const member of invitedMembers) {
    if (!selectedElders.includes(member)) { // Skip if already an elder
      await db.insert(daoMemberships).values({
        userId: member,
        daoId: dao.id,
        role: 'member',
        status: 'pending',
        isElder: false
      }).returning();
    }
  }

  // Rest of flow...
}
```

---

## Implementation Priority & Timeline

### Priority 1: CRITICAL (Must do before any DAO creation)
1. **Add elder selection to create-dao.tsx** (Step 2.5)
   - Show after basic info
   - Allow 2-5 elders based on DAO type
   - Validate at least 2 selected
   - Estimated: 2-3 hours

2. **Fix dao_deploy.ts to create elders**
   - Update to receive `selectedElders` from frontend
   - Set `treasurySigners` correctly
   - Make founder both admin AND elder
   - Set `treasuryRequiredSignatures` to actual elder count
   - Estimated: 1-2 hours

3. **Add withdrawalMode field to daos table**
   - Migrate database
   - Update schema.ts
   - Set correctly based on daoType
   - Estimated: 1 hour

### Priority 2: HIGH (Needed for chama support)
4. **Add rotation-based duration fields**
   - `rotationFrequency`, `nextRotationDate`, `durationModel`
   - Estimated: 2 hours

5. **Implement withdrawal mode logic**
   - Update vaultService.ts to check withdrawalMode
   - Implement direct withdrawal (no proposals)
   - Estimated: 3-4 hours

6. **Add elder management UI**
   - Change member roles (member → elder)
   - Remove elders
   - Estimated: 2-3 hours

### Priority 3: MEDIUM (For Phase 2)
7. **Update multisig logic for different modes**
8. **Implement rotation-based auto-withdrawals**
9. **Add UI for managing elders and withdrawal modes**

---

## Database Schema Changes Needed

```sql
-- Add to daos table:
ALTER TABLE daos ADD COLUMN withdrawal_mode VARCHAR DEFAULT 'multisig'; -- 'direct', 'multisig', 'rotation'
ALTER TABLE daos ADD COLUMN duration_model VARCHAR DEFAULT 'time'; -- 'time', 'rotation', 'ongoing'
ALTER TABLE daos ADD COLUMN rotation_frequency VARCHAR; -- 'weekly', 'monthly', 'quarterly'
ALTER TABLE daos ADD COLUMN next_rotation_date TIMESTAMP;

-- Add to daoMemberships table:
ALTER TABLE dao_memberships ADD COLUMN can_initiate_withdrawal BOOLEAN DEFAULT FALSE;
ALTER TABLE dao_memberships ADD COLUMN can_approve_withdrawal BOOLEAN DEFAULT FALSE;
ALTER TABLE dao_memberships ADD COLUMN is_rotation_recipient BOOLEAN DEFAULT FALSE;
```

---

## Recommended Next Steps

**Action Items Before Phase 1 Implementation:**

1. **Decide on chama classification:**
   - [ ] Should chama be a separate `daoCategory` (not daoType)?
   - [ ] Should it support both fixed-term AND ongoing rotation?
   - [ ] What's the difference between merry-go-round, harambee, table-banking?

2. **Confirm withdrawal modes:**
   - [ ] Do short-term DAOs need multi-sig or direct founder+elder only?
   - [ ] Should rotation-based auto-withdraw on schedule?
   - [ ] What's the threshold for no multi-sig needed?

3. **Clarify elder role:**
   - [ ] How many elders minimum/maximum per DAO type?
   - [ ] Can founder remove elders?
   - [ ] Can elders be added/removed after DAO creation?
   - [ ] Do elders need to accept invitation before withdrawal powers active?

4. **Update create-dao.tsx:**
   - [ ] Add elder selection step (Step 2.5)
   - [ ] Show elder count recommendations
   - [ ] Explain each role (admin, elder, member)

5. **Run database migration:**
   - [ ] Add new fields to daos and daoMemberships tables
   - [ ] Update Drizzle schema.ts

---

## Conclusion

The current system has the **infrastructure** for elders and multi-sig, but it's **not wired into the DAO creation flow**. This is a **critical bug** that will prevent ANY DAO from functioning properly on day 1.

**Fix Effort:** 4-6 hours total for Priority 1 items
**Impact:** Makes DAOs actually withdrawable and enables chama support

