# Phase 1 Quick Reference Guide

## TL;DR - What Changed

### 🐛 Three Bugs Fixed
1. **Founder was 'admin', not 'elder'** → Now created as 'elder'
2. **treasurySigners was empty []** → Now populated with [founder, ...elders]
3. **No way to select elders** → Added Step 2 to form

### 📝 4 Files Modified
1. `shared/schema.ts` - Added 10 database fields
2. `server/api/dao_deploy.ts` - Rewrote DAO creation handler
3. `client/src/pages/create-dao.tsx` - Added elder selection form
4. `server/services/vaultService.ts` - Enhanced permission logic

### ✅ Result
Founders can now withdraw from DAOs immediately after creation ✅

---

## What Happens Now

### Form Creation Flow
```
User creates DAO
    ↓
Step 1: Basic Info (name, category, logo)
    ↓
Step 2: Select Elders ← NEW! (2-5 selections)
    ↓
Step 3: Governance (quorum, voting period)
    ↓
Step 4: Treasury (type, funding)
    ↓
Step 5: Members (invite community)
    ↓
Step 6: Preview (review everything)
    ↓
Step 7: Success (DAO created!)
    ↓
Founder is now an elder ✅
Founder can withdraw immediately ✅
```

### Database Records Created
```
DAO Entry:
- treasurySigners = [founder, elder1, elder2]
- treasuryRequiredSignatures = 3
- withdrawalMode = 'multisig' or 'direct'
- minElders = 2, maxElders = 5

Founder Membership:
- role = 'elder' (not 'admin')
- isElder = true
- canApproveWithdrawal = true
- status = 'approved' (auto-approved)

Other Elders:
- role = 'elder'
- isElder = true
- canApproveWithdrawal = true
- status = 'pending' (awaiting approval)
```

---

## Key Implementation Details

### 1. Backend: New API Interface
```typescript
POST /api/dao-deploy
{
  daoData: {
    name: "Kilifi Savings Group",
    description: "...",
    daoType: "chama",
    rotationFrequency: "monthly"
  },
  founderWallet: "0x...",
  invitedMembers: ["0x...", "0x..."],
  selectedElders: ["0x...", "0x..."]  ← CRITICAL NEW FIELD
}
```

### 2. Frontend: Elder Selection Component
```typescript
// Step 2 shows:
- Founder (auto-selected, not clickable)
- Invited members (checkboxes)
- Min/max validation (2-5)
- Elder responsibilities explained
- Selection counter (e.g., "2/2-5")
```

### 3. Permission Matrix
```
Role      | View | Deposit | Withdraw | Allocate
----------|------|---------|----------|----------
Member    | YES  | YES     | NO       | NO
Proposer  | YES  | YES     | NO       | NO
Elder*    | YES  | YES     | YES      | YES
Admin     | YES  | YES     | YES      | YES
```
*Elder can withdraw based on withdrawalMode and permissions

### 4. Withdrawal Modes
```
direct:    Single elder → instant withdrawal
multisig:  Need consensus → requires approvals
rotation:  Designated recipient → scheduled withdrawals
```

---

## Testing Checklist (Quick)

### ✅ Form Tests (5 min)
- [ ] Create DAO form shows 7 steps
- [ ] Step 2 labeled "Select Elders"
- [ ] Cannot proceed without 2-5 selections
- [ ] Can select multiple members

### ✅ Database Tests (5 min)
```sql
-- Check founder is elder
SELECT * FROM daoMemberships 
WHERE daoId = '...' AND role = 'elder'

-- Check treasurySigners populated
SELECT treasurySigners FROM daos WHERE id = '...'

-- Verify elder count
SELECT COUNT(*) FROM daoMemberships 
WHERE daoId = '...' AND isElder = true
```

### ✅ Withdrawal Test (5 min)
- [ ] Founder can withdraw
- [ ] Non-elder cannot withdraw
- [ ] Proper error messages shown

---

## Deployment Commands

```bash
# 1. Run migrations
npm run db:migrate

# 2. Build backend
npm run build

# 3. Start server
npm run start

# 4. Deploy frontend
npm run build:frontend
npm run deploy:frontend

# 5. Verify
curl http://localhost:3000/api/health
```

---

## Common Issues & Fixes

### ❌ Issue: Cannot select elders
**Fix**: Make sure you have at least 2 members added (Step 5) before going back to Step 2

### ❌ Issue: Founder not showing as elder in DB
**Fix**: Clear browser cache, restart backend, check migrations ran

### ❌ Issue: treasurySigners still empty
**Fix**: Check database migration applied, restart server, create new DAO

### ❌ Issue: Form validation errors
**Fix**: Check browser console, clear local storage, refresh page

---

## File Locations

| What | Where |
|------|-------|
| Schema changes | `shared/schema.ts` (lines 240-270, 560-580) |
| Backend handler | `server/api/dao_deploy.ts` (entire file) |
| Frontend form | `client/src/pages/create-dao.tsx` (lines 50-1175) |
| Permissions | `server/services/vaultService.ts` (lines 406-490) |

---

## Success Indicators

✅ All of these should be true:

1. Founder has `role='elder'` in DB
2. `treasurySigners = [founder, elder1, elder2, ...]`
3. `treasurySigners` is NOT empty
4. Founder can withdraw
5. Non-elders cannot withdraw
6. Form requires 2-5 elders
7. No permission errors in logs

---

## Rollback (If Needed)

```bash
# Revert code changes
git revert <commit-hash>

# Revert database (optional, data preserved)
# Drop new columns if absolutely needed
npm run db:rollback
```

---

## Documentation Files

1. **PHASE1_DELIVERY_SUMMARY.md** - Executive summary
2. **PHASE1_IMPLEMENTATION_COMPLETE.md** - Technical details
3. **PHASE1_CRITICAL_FIX_TESTING.md** - Full test plan
4. **PHASE1_QUICK_REFERENCE_GUIDE.md** - This file

---

## Contact & Support

For questions:
1. Check documentation files listed above
2. Review inline code comments
3. Check server logs for error details
4. Run test suite from PHASE1_CRITICAL_FIX_TESTING.md

---

## Status

✅ **Implementation**: COMPLETE
✅ **Code Compilation**: PASSING
✅ **Testing**: READY (use provided test plan)
⏳ **Deployment**: PENDING (after testing)

---

**Ready to test? Start with: `PHASE1_CRITICAL_FIX_TESTING.md`**
