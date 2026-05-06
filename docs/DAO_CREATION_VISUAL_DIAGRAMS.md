# DAO Creation - Visual Architecture & Flow Diagrams

---

## Diagram 1: Current vs. Proposed DAO Creation Flow

### CURRENT FLOW (BROKEN)
```
┌─────────────────────────────────┐
│ Step 1: Basic Info              │ User selects DAO name, type
├─────────────────────────────────┤
│ Step 2: Governance              │ Show voting options (WRONG for chama!)
├─────────────────────────────────┤
│ Step 3: Treasury                │ Show spending limits
├─────────────────────────────────┤
│ Step 4: Members                 │ Invite people (no elder selection!)
├─────────────────────────────────┤
│ Step 5: Preview                 │ Review everything
├─────────────────────────────────┤
│ Step 6: Create                  │ Send to backend
├─────────────────────────────────┤
│ BACKEND:                        │
│ • Create DAO with wrong settings│ ❌ founder role = 'admin' not 'elder'
│ • treasurySigners = []          │ ❌ Empty! No one can sign
│ • No elders designated          │ ❌ Multi-sig broken
│ • Founder locked out of funds   │ ❌ Can't withdraw
└─────────────────────────────────┘

RESULT: DAO created but UNUSABLE
```

### PROPOSED FLOW (FIXED)
```
┌─────────────────────────────────────────────────┐
│ Step 1: Basic Info                              │ What's this DAO for?
├─────────────────────────────────────────────────┤
│ Step 2: SELECT ELDERS (NEW)                     │ Pick 2-5 trusted members
│ • Founder auto-selected                         │
│ • Elder count depends on type (2-3 for short   │
│   term, 3-5 for collective)                     │
├─────────────────────────────────────────────────┤
│ Step 3: Governance                              │ CONDITIONAL:
│ • Show if collective/long-term                  │ • Skip if short-term ✓
│ • Hide if chama/short-term                      │
├─────────────────────────────────────────────────┤
│ Step 4: Treasury                                │ CONDITIONAL limits:
│ • Daily limit = $5K if short-term               │ • $5K if chama
│ • Daily limit = $10K if collective              │ • $10K if harambee
├─────────────────────────────────────────────────┤
│ Step 5: Members                                 │ Other invited members
├─────────────────────────────────────────────────┤
│ Step 6: Preview                                 │ Review everything
├─────────────────────────────────────────────────┤
│ Step 7: Create                                  │ Send with selectedElders
├─────────────────────────────────────────────────┤
│ BACKEND:                                        │
│ • Create DAO with correct settings              │ ✓ withdrawalMode set
│ • treasurySigners = all elders                  │ ✓ ['founder', 'elder1', 'elder2']
│ • Founder role = 'elder' + 'admin'              │ ✓ Can withdraw immediately
│ • Each elder role = 'elder'                     │ ✓ Can approve withdrawals
│ • treasuryRequiredSignatures = elder count      │ ✓ 2-5 depending on setup
│ • Set withdrawalMode based on type              │ ✓ 'direct' for chama, 'multisig' for collective
└─────────────────────────────────────────────────┘

RESULT: DAO created and FULLY FUNCTIONAL
```

---

## Diagram 2: Withdrawal Flow by DAO Type

### SHORT-TERM (CHAMA) - DIRECT WITHDRAWAL
```
                   Founder/Elder wants $200
                            ↓
                   Get DAO settings
                            ↓
            ┌───────────────────────────────┐
            │ withdrawalMode === "direct"?  │
            │ YES                           │
            └───────────────────────────────┘
                            ↓
            ┌───────────────────────────────┐
            │ Is user an elder?             │
            │ YES (founder = elder)         │
            └───────────────────────────────┘
                            ↓
            ┌───────────────────────────────┐
            │ Is $200 < daily limit ($5K)?  │
            │ YES                           │
            └───────────────────────────────┘
                            ↓
            ┌───────────────────────────────┐
            │ Is $200 < balance?            │
            │ YES                           │
            └───────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │ EXECUTE IMMEDIATELY                 │
        │ • Update balance - $200              │
        │ • Send to recipient                  │
        │ • Log transaction                    │
        │ • NO WAITING                         │
        │ • NO APPROVAL NEEDED                │
        └─────────────────────────────────────┘
                            ↓
            ✓ Founder receives instant confirmation
            ✓ Recipient gets money in seconds
            ✓ Perfect for weekly chama rotations
```

### COLLECTIVE (HARAMBEE) - MULTISIG WITHDRAWAL
```
                   Elder wants $5K for project
                            ↓
                   Get DAO settings
                            ↓
            ┌───────────────────────────────┐
            │ withdrawalMode === "multisig"?│
            │ YES                           │
            └───────────────────────────────┘
                            ↓
            ┌───────────────────────────────┐
            │ Is user an elder?             │
            │ YES                           │
            └───────────────────────────────┘
                            ↓
            ┌───────────────────────────────┐
            │ Check: $5K >= threshold ($1K)?│
            │ YES - needs multi-sig         │
            └───────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │ CREATE PROPOSAL                     │
        │ • ID: proposal-xyz                  │
        │ • Amount: $5K                       │
        │ • Signers needed: 3                 │
        │ • Status: PENDING                   │
        │ • Expires: 7 days                   │
        └─────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │ AUTO-SIGN AS PROPOSER               │
        │ • Signatures: 1/3 ✓                 │
        │ • Status: WAITING                   │
        └─────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │ NOTIFY OTHER ELDERS                 │
        │ • Elder2: "New proposal needs sign" │
        │ • Elder3: "New proposal needs sign" │
        └─────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────┐
    │ ELDER 2 SIGNS (1-2 hours later)            │
    │ • Signatures: 2/3 ✓ (Still waiting)       │
    └───────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────┐
    │ ELDER 3 SIGNS (2-3 hours later)            │
    │ • Signatures: 3/3 ✓ REACHED THRESHOLD!   │
    └───────────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │ AUTO-EXECUTE                        │
        │ • Update balance - $5K               │
        │ • Send to recipient                  │
        │ • Status: COMPLETED                  │
        │ • Create audit log                   │
        └─────────────────────────────────────┘
                            ↓
            ✓ Proposal approved by 3/3 elders
            ✓ Money transferred after 2-3 hours
            ✓ Permanent record of decision
            ✓ Transparent to all members
```

### ROTATION-BASED (CHAMA AUTO) - AUTOMATIC WITHDRAWAL
```
    Scheduled Task: Check for rotation events every hour
                            ↓
        ┌─────────────────────────────────────┐
        │ SELECT * FROM daos                   │
        │ WHERE                                │
        │   durationModel = 'rotation' AND     │
        │   nextRotationDate <= NOW()          │
        └─────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │ For each rotation-based DAO:         │
        └─────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────┐
    │ Get current rotation recipient             │
    │ FROM daoMemberships WHERE                 │
    │   isRotationRecipient = true              │
    └───────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────┐
    │ Calculate withdrawal amount:               │
    │ = treasuryBalance (person gets all)        │
    │ OR = fixedAmount if configured             │
    └───────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────┐
    │ Verify balance >= amount                   │
    │ YES - Proceed                              │
    └───────────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │ EXECUTE TRANSFER                    │
        │ • Update balance                     │
        │ • Send to recipient wallet           │
        │ • Log transaction                    │
        │ • NO SIGNATURES NEEDED               │
        │ • NO WAITING                         │
        └─────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │ UPDATE ROTATION                      │
        │ • Set isRotationRecipient = false    │
        │   for current member                │
        │ • Set isRotationRecipient = true     │
        │   for next member                    │
        │ • nextRotationDate += frequency     │
        └─────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │ NOTIFY RECIPIENT                    │
        │ • "Your rotation has arrived!"       │
        │ • "Check wallet for $X transferred" │
        │ • "Next recipient: [Next Person]"   │
        └─────────────────────────────────────┘
                            ↓
            ✓ Recipient never needs to request
            ✓ Money arrives automatically
            ✓ Zero manual intervention
            ✓ Perfect for scheduled rotations
```

---

## Diagram 3: Elder Role & Permissions Matrix

### ROLE MATRIX
```
╔════════════╦═════════════╦═════════════╦═════════════════╗
║ Role       ║ Is Admin    ║ Is Elder    ║ Can Withdraw    ║
╠════════════╬═════════════╬═════════════╬═════════════════╣
║ founder    ║ TRUE        ║ TRUE        ║ YES (instant)   ║
║            ║             ║             ║                 ║
║ elder      ║ FALSE       ║ TRUE        ║ conditional*    ║
║            ║             ║             ║                 ║
║ admin      ║ TRUE        ║ FALSE       ║ NO (not elder)  ║
║ (if exists)║             ║             ║                 ║
║            ║             ║             ║                 ║
║ member     ║ FALSE       ║ FALSE       ║ NO (not elder)  ║
║            ║             ║             ║                 ║
║ guest      ║ FALSE       ║ FALSE       ║ NO (not elder)  ║
╚════════════╩═════════════╩═════════════╩═════════════════╝

*conditional:
  - If withdrawalMode = "direct": YES (instant)
  - If withdrawalMode = "multisig": YES (but needs other elders' approval)
  - If withdrawalMode = "rotation": NO (automatic system only)
```

### PERMISSION LEVELS
```
FOUNDER (Both Admin + Elder):
├─ Full DAO management (rename, archive, delete)
├─ Instant fund withdrawals
├─ Approve other withdrawals
├─ Add/remove elders
├─ Manage members
├─ View all transactions
└─ Change DAO settings

ELDER (Elder Only, not Admin):
├─ Instant withdrawals (if direct mode)
├─ Approve withdrawal proposals
├─ Initiate proposals
├─ View all transactions
├─ Vote on governance decisions
└─ CANNOT: Delete DAO, remove founder, change settings

MEMBER (Regular Member):
├─ View treasury balance
├─ Vote on decisions (if governance enabled)
├─ View transaction history
├─ Contribute to treasury
└─ CANNOT: Withdraw, propose, modify

GUEST (Invited but not accepted):
├─ View DAO info
├─ View treasury balance
└─ CANNOT: Anything else until accepted
```

---

## Diagram 4: DAO Type Decision Tree

```
        ┌─────────────────────────────────────┐
        │ What's the purpose of this group?   │
        └─────────────────────────────────────┘
                            ↓
        ┌────────────────────────────────────────────────┐
        │ Does it have a fixed end date or rotation?     │
        └────────────────────────────────────────────────┘
           Yes, fixed duration          │          No, ongoing
                                        │
                ↓                       ↓                    ↓
        ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
        │ SHORT_TERM DAO   │   │ COLLECTIVE DAO   │   │ FREE DAO         │
        │ (30-90 days)     │   │ (ongoing)        │   │ (no structure)   │
        └──────────────────┘   └──────────────────┘   └──────────────────┘
                │                      │                      │
                ↓                      ↓                      ↓
        ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
        │ Does it rotate   │   │ Need governance? │   │ How many members?│
        │ on schedule?     │   │                  │   │                  │
        └──────────────────┘   └──────────────────┘   └──────────────────┘
           Yes       │ No          Yes       │ No      1-10      │ 11+
           │         │            │         │          │        │
           ↓         ↓            ↓         ↓          ↓        ↓
        MERRY-   FIXED-      HARAMBEE  INFORMAL   SMALL    LARGE
        GO-ROUND DURATION    OR BURIAL  GROUP     GROUP    GROUP
                             FUND
```

---

## Diagram 5: Database Schema Changes

### BEFORE (Broken)
```
daos table:
├─ id
├─ name
├─ creatorId
├─ founderId
├─ daoType (free, short_term, collective)
├─ treasuryBalance
├─ treasuryMultisigEnabled: true
├─ treasuryRequiredSignatures: 3
├─ treasurySigners: [] ❌ EMPTY!
└─ treasuryDailyLimit

daoMemberships table:
├─ userId
├─ daoId
├─ role (member, proposer, elder, admin) ← Not used!
├─ isAdmin: true/false
├─ isElder: true/false ← Not created properly
├─ joinedAt
└─ createdAt

PROBLEM: No fields for withdrawal modes, rotation tracking, elder management
```

### AFTER (Fixed)
```
daos table:
├─ id
├─ name
├─ creatorId
├─ founderId
├─ daoType
├─ treasuryBalance
├─ treasuryMultisigEnabled: true
├─ treasuryRequiredSignatures: N (actual count)
├─ treasurySigners: ['user1', 'user2', 'user3'] ✓ POPULATED!
├─ treasuryDailyLimit
├─ NEW: withdrawalMode ('direct', 'multisig', 'rotation') ✓
├─ NEW: durationModel ('time', 'rotation', 'ongoing') ✓
├─ NEW: rotationFrequency ('weekly', 'monthly', 'quarterly') ✓
├─ NEW: nextRotationDate (timestamp) ✓
├─ NEW: minElders (2-5) ✓
└─ NEW: maxElders (usually 5) ✓

daoMemberships table:
├─ userId
├─ daoId
├─ role (properly set based on type) ✓
├─ isAdmin: true/false
├─ isElder: true/false ✓ PROPERLY SET
├─ joinedAt
├─ createdAt
├─ NEW: canInitiateWithdrawal (bool) ✓
├─ NEW: canApproveWithdrawal (bool) ✓
├─ NEW: isRotationRecipient (bool) ✓
└─ NEW: rotationRecipientDate (timestamp) ✓

SOLUTION: All fields needed for full functionality now present!
```

---

## Diagram 6: Implementation Timeline

```
PHASE 1: Foundation (Critical)
┌────────────────────────────────────┐  6 hours
│ 1. Update schema (2 files)         │ ┌─ 1 hour
│ 2. Update dao_deploy.ts            │ ├─ 1.5 hours
│ 3. Add elder selection UI          │ ├─ 2 hours
│ 4. Fix validation                  │ └─ 1.5 hours
└────────────────────────────────────┘
            ↓ WORKING: Can create DAOs with elders
            
PHASE 2: Full Features (High)
┌────────────────────────────────────┐  8 hours
│ 5. Implement withdrawal modes      │ ┌─ 3 hours
│ 6. Add rotation scheduling         │ ├─ 3 hours
│ 7. Elder management UI             │ └─ 2 hours
└────────────────────────────────────┘
            ↓ WORKING: All withdrawal modes functional
            
PHASE 3: Polish (Medium)
┌────────────────────────────────────┐  4 hours
│ 8. Testing & bug fixes             │ ┌─ 2 hours
│ 9. Documentation & guides          │ └─ 2 hours
└────────────────────────────────────┘
            ↓ DONE: Full production-ready implementation

Total: ~18 hours to production-ready
```

---

## Diagram 7: DAO Creation Step-by-Step (with visuals)

```
STEP 1: BASIC INFO
┌──────────────────────────────┐
│ DAO Name: [text input]        │
│ Description: [text area]      │
│ Type:                         │
│   ○ Merry-Go-Round (weekly)  │
│   ○ Table Banking (monthly)  │
│   ○ Burial Fund              │
│   ○ Community Project        │
└──────────────────────────────┘
            ↓
STEP 2: SELECT ELDERS ← NEW!
┌──────────────────────────────────────┐
│ WHO MANAGES THE FUND?                │
│                                      │
│ You (Founder): AUTOMATIC ELDER       │
│                                      │
│ Select 2-3 additional elders:        │
│ ☑ Sarah (Secretary)                  │
│ ☑ John (Treasurer)                   │
│ ☐ Peter (Regular member)             │
│ ☐ Alice (Regular member)             │
│                                      │
│ Selected: 2/3 ✓ Valid                │
└──────────────────────────────────────┘
            ↓
STEP 3: GOVERNANCE (CONDITIONAL)
If merry-go-round: SKIP (no voting needed)
If burial fund: SHOW voting options
┌──────────────────────────────┐
│ VOTING SETTINGS              │
│                              │
│ Voting Period: 72 hours      │
│ Quorum: 20% of members       │
│ Voting Power: 1 vote = 1 person
└──────────────────────────────┘
            ↓
STEP 4: TREASURY
┌──────────────────────────────┐
│ FUND LIMITS                  │
│                              │
│ Daily Limit: $5,000          │
│ Monthly Limit: $50,000       │
│ Multisig Required: YES       │
│ Required Signatures: 3       │
└──────────────────────────────┘
            ↓
STEP 5: MEMBERS
┌──────────────────────────────┐
│ INVITE MEMBERS               │
│                              │
│ Email: [input field]         │
│ [+ ADD MEMBER]               │
│                              │
│ Invited: Sarah, John, Peter  │
│ (Note: Elders selected above)│
└──────────────────────────────┘
            ↓
STEP 6: PREVIEW
┌────────────────────────────────────┐
│ REVIEW YOUR DAO                    │
│                                    │
│ Name: Kamwangi Merry-Go-Round      │
│ Type: Short-Term (Rotation-based)  │
│ Elders: You, Sarah, John           │
│ Members: + 2 invitations           │
│ Duration: Weekly (every Friday)    │
│ Daily Limit: $5,000                │
│ Governance: Disabled               │
│                                    │
│ [BACK] [CREATE DAO]                │
└────────────────────────────────────┘
            ↓
STEP 7: SUCCESS
┌────────────────────────────────┐
│ ✓ DAO CREATED SUCCESSFULLY!    │
│                                │
│ Name: Kamwangi Merry-Go-Round  │
│ ID: dao-abc123xyz              │
│ Vault ID: vault-def456uvw      │
│ Elders: 3                       │
│ Status: ACTIVE ✓               │
│                                │
│ [VIEW DAO] [INVITE MORE]       │
└────────────────────────────────┘
```

---

## Key Takeaways (Visual)

```
┌─────────────────────────────────────────────────────────────┐
│ BEFORE: "DAO created but can't use it"                      │
│                                                              │
│ DAO ──→ founder can't withdraw ──→ 💔 Broken              │
│         no elders assigned                                   │
│         multisig broken                                      │
│         members confused                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓↓↓
                      FIX APPLIED
                            ↓↓↓
┌─────────────────────────────────────────────────────────────┐
│ AFTER: "DAO created and fully functional"                   │
│                                                              │
│ DAO ──→ founder withdraws instantly ──→ ✓ Working!         │
│         elders manage fund                                   │
│         multisig works                                       │
│         members receive on schedule                          │
└─────────────────────────────────────────────────────────────┘
```

