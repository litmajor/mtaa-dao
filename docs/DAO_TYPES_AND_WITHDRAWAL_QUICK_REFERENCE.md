# Quick Reference: DAO Types & Withdrawal Modes

## DAO Types & Their Rules

### Type 1: Short-Term (Chama/Merry-Go-Round)
```
Characteristics:
- Duration: 30-90 days OR rotation-based (weekly/monthly)
- Governance: NOT needed (auto-execute on rotation)
- Elders: 2-3 required
- Withdrawals: DIRECT (instant, no proposals)
- Daily Limit: $5,000
- Monthly Budget: $50,000
- Best for: Merry-go-round, table banking, weekly contributions

Example Flow:
1. Founder + 2 elders create chama
2. Members contribute weekly
3. When rotation date arrives: Auto-withdraw to next recipient
4. No governance votes needed
5. Founder/elders can manage fund directly
```

### Type 2: Collective (Harambee/Burial Fund)
```
Characteristics:
- Duration: Ongoing (no end date)
- Governance: YES (members vote on usage)
- Elders: 3-5 required
- Withdrawals: MULTISIG (needs elder approval)
- Daily Limit: $10,000
- Monthly Budget: $100,000
- Best for: Harambee, burial funds, community projects

Example Flow:
1. Founder + 3 elders create collective
2. Members vote on spending proposals
3. To withdraw: Proposal → Elders vote → Execute
4. No auto-rotation
5. Requires voting for all major decisions
```

### Type 3: Free/Community Group
```
Characteristics:
- Duration: Ongoing
- Governance: Optional
- Elders: 2 required
- Withdrawals: MULTISIG (needs approval)
- Daily Limit: $1,000
- Monthly Budget: $10,000
- Best for: General groups, informal coordination
```

---

## Withdrawal Modes Explained

### Mode 1: "direct"
```
Who can withdraw: Founder + Any Elder
How much: Up to daily limit instantly
Process: No approval needed
Best for: Short-term DAOs, urgent fund needs
Example: Chama needs to send money to next recipient Friday → Founder withdraws instantly

Code check:
withdrawalMode: "direct"
→ User can withdraw if role === 'elder' or role === 'admin'
→ No multi-sig proposal created
→ Balance updated immediately
```

### Mode 2: "multisig"
```
Who can withdraw: Any Elder (must propose)
How much: Amount >= $1K needs multi-sig, < $1K is faster
Process: Propose → Wait for N elders to sign → Execute
Best for: Collective DAOs, large withdrawals, governance required
Example: Collective wants to spend $5K on project → 3 elders approve → funds released

Code check:
withdrawalMode: "multisig"
→ Elder creates proposal via treasuryMultisigService
→ Other elders must sign
→ Once signatures >= treasuryRequiredSignatures → auto-execute
→ Non-elders can't propose
```

### Mode 3: "rotation"
```
Who can withdraw: Automatic (recipient on rotation date)
How much: Full withdrawal to recipient
Process: Automatic when date arrives
Best for: Chama with scheduled rotations
Example: Every week on Friday, next person in rotation receives their share

Code check:
durationModel: "rotation"
nextRotationDate: "2025-11-24T00:00:00Z"
rotationRecipient: "user123"
→ On date arrival: Check if member has isRotationRecipient=true
→ Auto-transfer funds to their wallet
→ Move isRotationRecipient flag to next person
→ Update nextRotationDate
```

---

## Elder Role Breakdown

### What Gets Created at DAO Setup
```typescript
// Founder automatically becomes:
daoMemberships[founder] = {
  role: 'elder',           // Can do elder things
  isElder: true,           // Flag for queries
  isAdmin: true,           // Full control
  canInitiateWithdrawal: true,    // Can start withdrawals
  canApproveWithdrawal: true,     // Can sign multi-sig
}

// Selected elders become:
daoMemberships[elder] = {
  role: 'elder',           // Can do elder things
  isElder: true,           // Flag for queries
  isAdmin: false,          // Limited control
  canInitiateWithdrawal: (depends on withdrawalMode),
  canApproveWithdrawal: true,     // Can sign multi-sig
  status: 'pending',       // Must accept invite
}

// Regular members:
daoMemberships[member] = {
  role: 'member',          // Basic member
  isElder: false,          // No elder privileges
  isAdmin: false,          // No admin control
  canInitiateWithdrawal: false,   // Can't start withdrawals
  canApproveWithdrawal: false,    // Can't sign withdrawals
}
```

### Elder Permissions by Withdrawal Mode
```
If withdrawalMode === "direct":
  canInitiateWithdrawal: true   ✓ Elders can withdraw instantly
  canApproveWithdrawal: true    ✓ Can approve others' withdrawals

If withdrawalMode === "multisig":
  canInitiateWithdrawal: false  ✗ Members can't initiate (only other elders)
  canApproveWithdrawal: true    ✓ Must be elder to approve

If withdrawalMode === "rotation":
  canInitiateWithdrawal: false  ✗ Nobody initiates (automatic)
  canApproveWithdrawal: false   ✗ Nobody approves (automatic)
```

---

## Critical Bug: What Was Wrong

### Before Fix
```
User creates DAO:
1. daoMemberships[founder] = { role: 'admin', isElder: FALSE } ❌
2. daos.treasurySigners = [] ❌ (empty array!)
3. daos.treasuryRequiredSignatures = 3
4. Multi-sig enabled: true

When founder tries to withdraw:
→ vaultService checks: role === 'admin' or 'elder'?
→ role is 'admin' ✓ passes check
→ treasuryMultisigService starts proposal
→ Needs 3 signatures but signers = []
→ STUCK: Can't get signatures from nobody
→ Fund locked forever
```

### After Fix
```
User creates DAO with elders:
1. daoMemberships[founder] = { role: 'elder', isElder: TRUE } ✓
2. daos.treasurySigners = ['founder', 'elder1', 'elder2'] ✓
3. daos.treasuryRequiredSignatures = 3 (matches signer count) ✓
4. withdrawalMode = 'direct' (for short-term) ✓

When founder tries to withdraw:
→ If withdrawalMode === 'direct':
  → vaultService checks: role === 'elder'? YES ✓
  → No proposal needed
  → Withdraw instantly ✓

When collective needs to withdraw:
→ If withdrawalMode === 'multisig':
  → Elder creates proposal
  → treasuryMultisigService checks: signers = ['founder', 'elder1', 'elder2']
  → Founder already signed, need 2 more
  → Elder1 signs, Elder2 signs
  → 3 signatures reached → Execute ✓
```

---

## DAO Creation Form Changes

### New Step 2.5: Select Elders
```
Currently: Steps are 1→2→3→4→5→6
New: Steps are 1→2.5→3→4→5→6→7

Step 1: Basic Info (Name, description, type)
Step 2.5: Select Elders ← NEW (2-5 members, minimum required)
Step 3: Governance (Skip if short-term)
Step 4: Treasury (Limits vary by type)
Step 5: Members (Regular members to invite)
Step 6: Preview (Review everything)
Step 7: Success (Confirm, show DAO details)
```

### What Changes by DAO Type

| Step | Short-Term | Collective | Free |
|---|---|---|---|
| **Elders** | Select 2-3 | Select 3-5 | Select 2-3 |
| **Governance** | Skip entirely | Show voting options | Optional |
| **Withdrawal** | Direct (instant) | Multi-sig (approval needed) | Multi-sig |
| **Daily Limit** | $5K | $10K | $1K |
| **Monthly Budget** | $50K | $100K | $10K |
| **Treasury Mode** | Direct withdrawal | Proposal + vote | Proposal only |

---

## For Chama Specifically

### Merry-Go-Round Setup
```
1. Create DAO as "short_term" type
2. Set rotationFrequency = "weekly" or "monthly"
3. Select 2 elders (often group secretary, treasurer)
4. No governance voting needed
5. Set daily limit to total contribution amount × 2
6. System auto-calculates next rotation date

Withdrawal Behavior:
- Day 1: Members contribute → Fund grows
- Day 6: Rotation date arrives
- Automatically transfers to Person A
- Moves rotation to Person B
- Process repeats

Elder Responsibilities:
- Founder: Receives fund on their rotation
- Elder1: Can manage contributions, handle disputes
- Elder2: Can manage withdrawals, track rotations
- All elders: Can approve if member disputes fund transfer
```

### Table Banking Setup
```
1. Create DAO as "short_term" type
2. Set rotationFrequency = "monthly"
3. Select 3 elders (chairperson, secretary, treasurer)
4. No governance voting
5. Set daily limit to monthly contribution × 3
6. System tracks month-to-month rotations

Withdrawal Behavior:
- Month 1: Member A receives
- Month 2: Member B receives
- Month 3: Member C receives
- Repeat for duration (6 months typical)

Elder Responsibilities:
- Chairperson: Manages meetings, disputes
- Secretary: Records contributions, tracks rotations
- Treasurer: Manages fund, handles withdrawals
- All: Must approve withdrawals for transparency
```

---

## Implementation Checklist (In Order)

**Before Any Code Changes:**
- [ ] Confirm: Chama = short-term with rotation frequency? Or separate type?
- [ ] Confirm: Founder should always have direct withdrawal? Or need approval?
- [ ] Confirm: What happens when member joins after rotation started?

**Database Changes:**
- [ ] Add fields to daos table (withdrawalMode, durationModel, rotationFrequency, etc.)
- [ ] Add fields to daoMemberships (canInitiateWithdrawal, canApproveWithdrawal)
- [ ] Run Drizzle migration

**Backend Changes:**
- [ ] Update dao_deploy.ts to receive selectedElders
- [ ] Create elders during DAO creation
- [ ] Set treasurySigners and treasuryRequiredSignatures correctly
- [ ] Update vaultService.ts to check withdrawalMode
- [ ] Verify treasuryMultisigService works with new signers list

**Frontend Changes:**
- [ ] Add Step 2.5 elder selector to create-dao.tsx
- [ ] Update validation to require minimum elders
- [ ] Update deployDAO() to send selectedElders
- [ ] Make governance step conditional

**Testing:**
- [ ] Create short-term DAO → founder can withdraw instantly
- [ ] Create collective DAO → needs elder approval
- [ ] Test with 2, 3, 5 elders
- [ ] Verify non-elder members can't withdraw
- [ ] Test rotation date calculations

