# DAO Creation Customization - Action Checklist

## Issue #1: User-Friendly & Project-Specific ❌

### Current Problem
- ⚠️ Same 6-step form for ALL DAO types
- ⚠️ Generic categories (not Mtaa-specific)
- ⚠️ No differentiation between short-term (30 days) and long-term (ongoing)

### Fix Required
- [ ] Add DAO Type selector as Step 1
  - [ ] Short-Term Fund (3-6 months)
  - [ ] Collective DAO (Ongoing)
  - [ ] Governance DAO (Community)
- [ ] Create Mtaa-specific categories per type:
  - [ ] Short-term: merry-go-round, harambee, burial, event, emergency
  - [ ] Collective: savings, table-banking, traders-coop, farmers-union
  - [ ] Governance: community-leadership, social-impact, education, health
- [ ] Make categories dynamic based on type selected
- [ ] Update category dropdown in Step 2

---

## Issue #2: Treasury Selection Not Linked to Structure ⚠️

### Current Problem
- ⚠️ All DAOs can choose cUSD, CELO, dual independently
- ⚠️ No spending limits per DAO type
- ⚠️ Short-term DAO could have $10K daily limit (inappropriate)

### Fix Required
- [ ] Link treasury options to DAO type:
  - [ ] Short-term → cUSD only
  - [ ] Collective → cUSD, CELO/dual
  - [ ] Governance → all options
- [ ] Set spending limits per type:
  - [ ] Short-term: Daily $1,000
  - [ ] Collective: Daily $5,000
  - [ ] Governance: Daily $10,000
- [ ] Make treasury selection conditional
- [ ] Store limits in DAO record during creation
- [ ] Update treasuryDailyLimit field in database

---

## Issue #3: Multisig Setup in Wrong Place ❌

### Current Problem
- ❌ Multisig setup in `/api/wallet/multisig/create` (AFTER DAO creation)
- ❌ Uses mock multisig (not real)
- ❌ Not integrated with DAO creation flow
- ❌ Separate step needed

### Fix Required
- [ ] Move multisig config to DAO deployment handler
- [ ] Set these fields DURING creation:
  - [ ] treasuryMultisigEnabled (based on type)
  - [ ] treasuryRequiredSignatures (1/3/5)
  - [ ] treasurySigners (founder is first)
  - [ ] treasuryDailyLimit
  - [ ] treasuryMonthlyBudget
- [ ] Use treasuryMultisigService (not mock)
- [ ] Add founder as first signer automatically
- [ ] Remove mock multisig endpoint call

---

## Issue #4: Short-Term DAOs Show Governance ❌

### Current Problem
- ❌ All DAOs show governance controls (Step 2)
- ❌ Short-term DAOs don't need voting (auto-execute)
- ❌ Confusing for users who just want to rotate savings

### Fix Required
- [ ] Make Governance step conditional:
  - [ ] Show if: daoType === 'collective' OR 'governance'
  - [ ] Skip if: daoType === 'shortTerm'
- [ ] Update nextStep() to jump Governance for short-term
- [ ] Update prevStep() to skip Governance for short-term
- [ ] Add duration selector for short-term DAOs
  - [ ] 30 days
  - [ ] 60 days
  - [ ] 90 days
- [ ] Update preview to show NO governance for short-term

---

## Implementation Tasks

### Frontend (create-dao.tsx)

#### Task 1: Add DAO Type Step
```typescript
[ ] Create daoTypeOptions constant with 3 options
[ ] Create renderDaoTypeSelection() function
[ ] Add to steps array as Step 1
[ ] Update step numbering (all shift by 1)
[ ] Auto-apply defaults when type selected
    - [ ] treasuryType default
    - [ ] governanceModel default
    - [ ] daoType stored in state
```

#### Task 2: Dynamic Categories
```typescript
[ ] Create getCategoriesForType(type) function
[ ] Replace static categories array
[ ] Update renderBasicInfo() to use dynamic categories
[ ] Test categories change based on type
```

#### Task 3: Conditional Governance
```typescript
[ ] Add showGovernanceStep calculation:
    if (daoType === 'shortTerm') false else true
[ ] Update nextStep() to skip governance
[ ] Update prevStep() to skip governance
[ ] Conditionally render governance section
[ ] Update steps display (hide if not shown)
```

#### Task 4: Dynamic Treasury
```typescript
[ ] Create getTreasuryOptionsForType(type) function
[ ] Update renderTreasury() to use dynamic options
[ ] Add duration selector for short-term
[ ] Validate treasury type is allowed for type
```

#### Task 5: Update Data Interfaces
```typescript
[ ] Add daoType to DaoData interface
[ ] Add duration to DaoData interface
[ ] Update type definitions
```

#### Task 6: Preview Updates
```typescript
[ ] Show DAO type in preview
[ ] Show duration for short-term
[ ] Hide governance section for short-term
[ ] Show multisig info for collective/governance
[ ] Update deploy button text per type
```

### Backend (dao_deploy.ts)

#### Task 1: Add Type Support
```typescript
[ ] Import treasuryConfig constant
[ ] Add daoType to DaoDeployRequest interface
[ ] Add duration to request
[ ] Validate daoType is valid
```

#### Task 2: Apply Treasury Config
```typescript
[ ] Get config based on daoType
[ ] Extract multisig settings
[ ] Extract spending limits
[ ] Extract signature requirements
```

#### Task 3: Store During Creation
```typescript
[ ] Save daoType to DAO record
[ ] Save plan based on daoType
[ ] Save treasuryMultisigEnabled
[ ] Save treasuryRequiredSignatures
[ ] Save treasuryDailyLimit
[ ] Save treasuryMonthlyBudget
[ ] Save originalDuration (for short-term)
[ ] Save treasurySigners (founder)
```

#### Task 4: Response Updates
```typescript
[ ] Include daoType in response
[ ] Include multisigEnabled in response
[ ] Include treasurySigners in response
[ ] Include duration in response
```

### Database Queries

#### Task 1: Verification
```sql
[ ] Query to find short-term DAOs:
    SELECT * FROM daos WHERE dao_type = 'short_term'
[ ] Query to find multisig enabled DAOs:
    SELECT * FROM daos WHERE treasury_multisig_enabled = true
[ ] Query to verify settings:
    SELECT id, dao_type, treasury_daily_limit, treasury_required_signatures
    FROM daos WHERE id = 'DAO_ID'
```

#### Task 2: Test Data
```sql
[ ] Create test short-term DAO with duration
[ ] Create test collective DAO with multisig
[ ] Create test governance DAO with all fields
[ ] Verify all fields populated correctly
```

### Testing

#### Test Case 1: Short-Term DAO
```
[ ] User selects "Short-Term Fund"
[ ] Categories show: merry-go-round, harambee, burial, event
[ ] Governance step is SKIPPED
[ ] Treasury shows only cUSD
[ ] Duration selector appears
[ ] Preview shows no governance
[ ] Database has: dao_type='short_term', treasury_multisig_enabled=false
```

#### Test Case 2: Collective DAO
```
[ ] User selects "Collective DAO"
[ ] Categories show: savings, table-banking, traders-coop, farmers-union
[ ] Governance step IS SHOWN
[ ] Treasury shows cUSD and CELO
[ ] Duration selector does NOT appear
[ ] Preview shows governance options
[ ] Database has: dao_type='collective', treasury_multisig_enabled=true, treasury_required_signatures=3
```

#### Test Case 3: Governance DAO
```
[ ] User selects "Governance DAO"
[ ] Categories show: governance, social, education, health
[ ] Governance step IS SHOWN with all options
[ ] Treasury shows all options
[ ] Duration selector does NOT appear
[ ] Preview shows advanced options
[ ] Database has: dao_type='governance', treasury_multisig_enabled=true, treasury_required_signatures=5
```

---

## Success Criteria

### Functionality ✅
- [ ] Short-term DAOs don't show governance
- [ ] Treasury options are limited per type
- [ ] Categories are relevant to DAO type
- [ ] Duration is set for short-term DAOs
- [ ] Multisig is configured during creation

### Data ✅
- [ ] daoType is saved to database
- [ ] treasuryMultisigEnabled is set based on type
- [ ] treasuryRequiredSignatures is set (1/3/5)
- [ ] treasuryDailyLimit is set per type
- [ ] treasurySigners includes founder

### User Experience ✅
- [ ] Form is shorter for short-term (no governance)
- [ ] Form is longer for governance (advanced options)
- [ ] No confusing options for user's DAO type
- [ ] Clear progression through steps
- [ ] Preview accurately reflects choices

### Project Fit ✅
- [ ] Mtaa-specific categories visible
- [ ] Categories make sense for each type
- [ ] Reflects Kenyan community structures
- [ ] Easy for non-technical users

---

## Rollback Plan

If issues found:
```
[ ] Revert create-dao.tsx to previous version
[ ] Revert dao_deploy.ts to previous version
[ ] No database changes (all new fields already exist)
[ ] Old DAOs continue to work normally
[ ] Can redeploy with fixes
```

---

## Timeline

### Phase 1: Minimum (Today/Tomorrow)
- [ ] Add DAO Type selector
- [ ] Make Governance conditional
- [ ] Basic customization
**Time: 2-3 hours**

### Phase 2: Complete (This Week)
- [ ] All issues fixed
- [ ] Full customization
- [ ] Testing complete
**Time: 4-6 hours**

### Phase 3: Polish (Next Week)
- [ ] Mtaa category refinement
- [ ] Regional expansion
- [ ] Mobile optimization
**Time: 3-4 hours**

---

## Dependencies

### Existing (Already Available)
- ✅ Database schema has all needed fields
- ✅ treasuryMultisigService exists
- ✅ Auth middleware ready
- ✅ Logger available
- ✅ UI components available

### New (Need to Add)
- ❌ DAO type definitions
- ❌ Category lists per type
- ❌ Treasury config per type
- ❌ Duration selector component

### External
- ✅ Celo network (already integrated)
- ✅ Wallet connection (already available)

---

## Questions Answered

✅ **Is the create DAO user-friendly?**
- Current: ⚠️ Partially (generic for all)
- After: ✅ Yes (customized per type)

✅ **Does it reflect our project?**
- Current: ❌ No (generic categories)
- After: ✅ Yes (Mtaa-specific)

✅ **Different types of groups/DAOs?**
- Current: ⚠️ Database ready, UI not
- After: ✅ 3 complete different flows

✅ **Treasury selection linked to structure?**
- Current: ❌ No (all options for all)
- After: ✅ Yes (options per type)

✅ **Multisig setup location?**
- Current: ❌ Wrong (after creation, mocked)
- After: ✅ Right (during creation, real)

✅ **Short-term DAOs don't need governance?**
- Current: ❌ All get governance
- After: ✅ Short-term skips governance

---

**Status: Ready to implement** ✅

All analysis complete. Choose Phase 1, 2, or 3 to get started!
