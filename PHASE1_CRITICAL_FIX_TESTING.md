# Phase 1 Critical Bug Fix - Testing Guide

## Overview
This document outlines the Phase 1 critical bug fix that enables founders to immediately use their DAOs after creation. The fix addresses three critical issues:

1. **Founder Role**: Changed from 'admin' to 'elder' 
2. **treasurySigners**: Now properly populated with elders (was empty)
3. **Elder Selection**: New form step to select 2-5 elders during DAO creation

---

## Implementation Summary

### Database Schema Changes (`shared/schema.ts`)
✅ **COMPLETED** - Added 10 new fields to support elder management and withdrawal modes:

**`daos` table additions:**
- `withdrawalMode` (varchar, default 'multisig') - Controls how withdrawals are authorized
- `durationModel` (varchar, default 'time') - Type of duration (time/event-based)
- `rotationFrequency` (varchar) - How often elders rotate (weekly/monthly/quarterly)
- `nextRotationDate` (timestamp) - Next scheduled elder rotation
- `minElders` (integer, default 2) - Minimum required elders
- `maxElders` (integer, default 5) - Maximum allowed elders

**`daoMemberships` table additions:**
- `canInitiateWithdrawal` (boolean, default false) - Can start withdrawal process
- `canApproveWithdrawal` (boolean, default false) - Can approve withdrawals from others
- `isRotationRecipient` (boolean, default false) - Designated for rotation mode
- `rotationRecipientDate` (timestamp) - When recipient is due to rotate in

---

### Backend API Changes (`server/api/dao_deploy.ts`)
✅ **COMPLETED** - Completely rewritten DAO deployment handler

**New Request Interface:**
```typescript
interface DaoDeployRequest {
  daoData: {
    name: string
    description: string
    daoType: string
    rotationFrequency?: string
    durationDays?: number
  }
  founderWallet: string
  invitedMembers: string[]
  selectedElders: string[] // CRITICAL NEW PARAMETER
}
```

**Critical Fixes:**
1. **Elder Validation**: Requires minimum 2 elders, validates selectedElders array
2. **Founder as Elder**: 
   - Role set to 'elder' (not 'admin')
   - isElder = true
   - canApproveWithdrawal = true
   - canInitiateWithdrawal = true (for direct mode)
3. **Treasury Configuration**:
   - treasurySigners = [founder, ...selectedElders] (NOT empty!)
   - treasuryRequiredSignatures = elders.length (matches actual count)
4. **Withdrawal Modes**: 
   - 'direct': Single elder can withdraw (fast)
   - 'multisig': Requires elder consensus (safe)
5. **Helper Functions**:
   - getDailyLimitByType() - Returns $5K (short-term) or $10K (collective)
   - getMonthlyBudgetByType() - Returns $50K (short-term) or $100K (collective)
   - calculateNextRotation() - Computes rotation dates for chamas

---

### Frontend Form Changes (`client/src/pages/create-dao.tsx`)
✅ **COMPLETED** - Added Step 2: Elder Selection

**Form Structure (7 steps total):**
1. Basic Info - Name, description, logo, category
2. **Select Elders** ← NEW STEP
3. Governance - Voting model, quorum, period
4. Treasury - Type, funding, deposits
5. Members - Invite community
6. Preview - Review and confirm
7. Success - DAO created

**Elder Selection Component (`renderElderSelection()`):**
- Displays all invited members (excluding founder)
- Checkboxes to select 2-5 elders
- Founder shown as auto-included
- Explains elder responsibilities:
  - Can approve fund withdrawals
  - Vote on important DAO decisions
  - Manage treasury access
  - Act as custodians
- Visual feedback on selections (min/max requirement)
- Validation prevents proceeding without valid selections

**Form Validation:**
- Step 1: DAO name required
- Step 2: **2-5 elders required** (new)
- Step 3: Minimum 20% quorum
- Step 4: Treasury type selected
- Step 5: At least 2 members
- Step 6 & 7: Presentation

**Deployment Flow:**
- Sends `selectedElders` array to backend
- Includes `daoData` with category and rotation info
- Passes `invitedMembers` (all non-founder members)
- Backend receives structured data, creates elders properly

---

### Vault Service Changes (`server/services/vaultService.ts`)
✅ **COMPLETED** - Updated withdrawal permissions to support withdrawal modes

**Permission Logic (`checkVaultPermissions()`):**
- **Personal Vaults**: Direct ownership required
- **DAO Vaults**: Role-based with withdrawal mode support
  - **View**: Members and above can view
  - **Deposit**: Members and above can deposit
  - **Withdraw**: 
    - Admin: Always allowed
    - Elder (direct mode): Must have `canInitiateWithdrawal = true`
    - Elder (multisig mode): Can initiate (approval required separately)
    - Elder (rotation mode): Must be `isRotationRecipient`
  - **Allocate/Rebalance**: Admin and elder only

**Logging:**
- Added withdrawal mode tracking
- Logs user ID, amount, token when withdrawal initiated
- Helps debug permission issues

---

## Testing Checklist

### ✅ Pre-Requisites
- [ ] Backend server running (`npm run dev` or `npm start`)
- [ ] Frontend running (`npm run dev`)
- [ ] Database migrated with new schema
- [ ] Test wallet available with cUSD/CELO

### Phase 1: Basic DAO Creation

#### Test 1.1: Form Navigation
```
Steps to test:
1. Go to Create DAO page
2. Verify step indicator shows 7 steps (was 6)
3. Step 2 should be "Select Elders" with Shield icon
4. Navigate back and forth through steps
Expected: All steps display correctly, no errors
```

#### Test 1.2: Elder Selection Validation
```
Steps to test:
1. Fill in Basic Info (step 1)
2. Advance to Elder Selection (step 2)
3. Try to advance without selecting elders
4. Select exactly 1 elder (invalid)
5. Try to advance (should fail)
6. Select 2 elders (valid)
7. Advance to next step
Expected: 
- Cannot proceed with <2 elders
- Error message shows: "Select 2-5 elders to continue"
- Can proceed with 2 elders
```

#### Test 1.3: Elder Selection UI
```
Steps to test:
1. Create 3 test members (step 5)
2. Go back to Elder Selection (step 2)
3. Verify founder shown as auto-selected
4. Verify 3 members available for selection
5. Verify "You (founder) will automatically be an elder" message
6. Click to select/deselect members
7. Verify selection counter updates
Expected:
- Founder not in selectable list
- 3 members available
- Counter shows current/min-max
- Selections persist when navigating
```

### Phase 2: DAO Creation Backend

#### Test 2.1: Founder Created as Elder
```
Steps to test:
1. Create DAO with 2 selected elders
2. After deployment, query database:
   SELECT * FROM daoMemberships WHERE daoId = '{dao_id}'
Expected:
- Founder has role = 'elder' (NOT 'admin')
- Founder has isElder = true
- Founder has canApproveWithdrawal = true
- Founder has canInitiateWithdrawal = true (if direct mode)
```

#### Test 2.2: treasurySigners Population
```
Steps to test:
1. Create DAO with founder + 2 selected elders (3 total)
2. Query database:
   SELECT treasurySigners, treasuryRequiredSignatures FROM daos WHERE id = '{dao_id}'
Expected:
- treasurySigners = [founder_address, elder1_address, elder2_address]
- treasurySigners.length = 3 (NOT empty!)
- treasuryRequiredSignatures = 3
```

#### Test 2.3: Other Elders Created
```
Steps to test:
1. Create DAO with 2 selected elders (plus founder)
2. Query database:
   SELECT * FROM daoMemberships WHERE daoId = '{dao_id}' AND isElder = true
Expected:
- 3 records total (founder + 2 selected)
- Selected elders have:
  - role = 'elder'
  - isElder = true
  - status = 'pending' (awaiting approval)
  - canApproveWithdrawal = true
```

#### Test 2.4: Withdrawal Mode Set
```
Steps to test:
1. Create DAO with category 'short-term'
2. Query database:
   SELECT withdrawalMode FROM daos WHERE id = '{dao_id}'
Expected:
- For 'short-term': withdrawalMode = 'direct'
- For 'chama': withdrawalMode = 'multisig'
- For other: withdrawalMode = 'multisig'
```

### Phase 3: Founder Withdrawal

#### Test 3.1: Founder Can Withdraw (Direct Mode)
```
Steps to test:
1. Create short-term DAO with founder + 1 elder
2. Deposit 100 cUSD to DAO vault
3. As founder, attempt withdrawal of 50 cUSD
4. Check vault balance
Expected:
- Withdrawal succeeds immediately
- Balance reduced by 50 cUSD
- No approval required
```

#### Test 3.2: Founder Cannot Withdraw (Multisig Mode - Before Approval)
```
Steps to test:
1. Create chama DAO with founder + 2 elders
2. Deposit 100 cUSD to DAO vault
3. As founder, attempt withdrawal of 50 cUSD
Expected:
- For multisig future impl: Withdrawal queued for approval
- Current state: Transaction created but marked 'pending_approval'
```

#### Test 3.3: Non-Elder Cannot Withdraw
```
Steps to test:
1. Create DAO with founder + 2 selected elders + 1 regular member
2. As regular member, attempt withdrawal
Expected:
- Permission denied error
- Message: "You do not have permission to withdraw"
```

### Phase 4: Permission Checks

#### Test 4.1: Elder Can Withdraw (All Modes)
```
Steps to test:
1. Create DAO with founder + 1 selected elder
2. Switch to elder's wallet/account
3. Attempt withdrawal
Expected:
- Elder can initiate withdrawal
- Success or approval pending (depending on mode)
```

#### Test 4.2: Permission Check Logs
```
Steps to test:
1. Create DAO and perform withdrawal attempt
2. Check server logs
Expected:
- Logs show: "Withdrawal initiated for DAO vault (mode: direct/multisig)"
- Logs include: User ID, amount, token symbol
```

### Phase 5: Data Integrity

#### Test 5.1: Schema Validation
```
Steps to test:
1. Query new columns:
   SELECT withdrawalMode, durationModel, minElders, maxElders 
   FROM daos WHERE id = '{dao_id}'
2. Query membership columns:
   SELECT canInitiateWithdrawal, canApproveWithdrawal, isRotationRecipient 
   FROM daoMemberships WHERE daoId = '{dao_id}'
Expected:
- All columns populated with appropriate values
- Default values correct (minElders=2, maxElders=5, etc.)
- No NULL values in required fields
```

#### Test 5.2: Rotation Fields (Chama)
```
Steps to test:
1. Create chama DAO with 'monthly' rotation
2. Query database:
   SELECT rotationFrequency, nextRotationDate FROM daos WHERE id = '{dao_id}'
Expected:
- rotationFrequency = 'monthly'
- nextRotationDate = current date + 30 days (approx)
- Not NULL
```

---

## Error Scenarios to Test

### ❌ Error 1: No Elders Selected
```
Expected Error: 
"Please select 2-5 elders to continue"
Location: Frontend form validation on step 2
```

### ❌ Error 2: Too Many Elders (>5)
```
Expected Error:
UI prevents selection beyond max
Cannot click 6th checkbox
```

### ❌ Error 3: Non-Elder Withdrawal
```
Expected Error:
403 Unauthorized
"You do not have permission to withdraw from this vault"
```

### ❌ Error 4: Insufficient Balance
```
Expected Error:
400 Validation Error
"Insufficient balance. Requested: 100, Available: 50"
```

---

## Rollback Plan

If testing reveals critical issues:

1. **Database Rollback**:
   ```sql
   -- Drop new columns if needed
   ALTER TABLE daos DROP COLUMN withdrawalMode;
   ALTER TABLE daos DROP COLUMN durationModel;
   -- etc.
   ```

2. **Code Rollback**:
   - Revert dao_deploy.ts to previous version
   - Revert vaultService.ts permission logic
   - Revert create-dao.tsx form changes

3. **Version Markers**:
   - Schema version: 3.1 (new)
   - API version: dao-deploy v2
   - Frontend version: CreateDAO v2.1

---

## Success Criteria

✅ **All tests pass when:**

1. ✅ Frontend form shows 7 steps with Elder Selection at step 2
2. ✅ Founder created as 'elder' role in database
3. ✅ treasurySigners populated with all elders (not empty)
4. ✅ treasuryRequiredSignatures matches elder count
5. ✅ Founder can withdraw from direct-mode DAO instantly
6. ✅ Non-elders cannot withdraw
7. ✅ Other elders created with status 'pending'
8. ✅ Withdrawal mode set correctly based on DAO type
9. ✅ All new schema columns populated correctly
10. ✅ Permission checks properly enforced in logs

---

## Timeline

- **Phase 1 Implementation**: ~5 hours (COMPLETED ✅)
- **Phase 1 Testing**: ~1 hour (IN-PROGRESS 🔄)
- **Phase 2 Planning** (customization): After Phase 1 verified
- **Phase 2 Implementation**: ~10-15 hours
- **Phase 3 Implementation** (frontend extensions): ~8 hours

---

## Notes

- This is a **critical fix** - without it, founders cannot use their DAOs
- The fix is **backwards compatible** - existing DAOs still work
- New DAOs require elder selection - no founder-only DAOs
- Permission system enforced at vaultService layer
- Withdrawal modes allow flexibility:
  - **direct**: Fast withdrawals (short-term groups)
  - **multisig**: Consensus required (large collectives)
  - **rotation**: Designated recipient (savings groups)

---

## Contact & Support

For issues during testing:
1. Check server logs for permission errors
2. Verify database schema applied correctly
3. Check frontend console for form validation errors
4. Review vaultService.ts for withdrawal permission logic
