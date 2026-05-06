# Vault Hierarchy - Visual Diagrams & Decision Matrix

## 🎨 Resource Hierarchy Diagram

```
═══════════════════════════════════════════════════════════════════════════════
                          DAO TREASURY HIERARCHY
═══════════════════════════════════════════════════════════════════════════════

                                    DAO
                                     │
                    ┌────────────────┴────────────────┐
                    │                                │
              User Vaults                    DAO Treasury
              (Personal)                        (Shared)
                    │                                │
         ┌──────────┼──────────┐         ┌──────────┴──────────┐
         │          │          │         │                     │
      Savings   Investment  Strategy  Multi-Category System    Vaults
      (type:     (type:      (type:     (5 budgets)          (N vaults)
      savings)   investment) strategy)  ├─ Operating (40%)    ├─ Investment
                                        ├─ Governance (30%)   ├─ Pool
        owner:     owner:    owner:     ├─ Escrow (15%)       ├─ Escrow
        user       user      user       ├─ Vault (10%)        ├─ Strategy
        treasury:  treasury: treasury:  └─ Reward (5%)        ├─ Deployment
        NULL       NULL      NULL          (completed)        ├─ Custom
                                                              └─ ...
        user       user      user          owner:
        vault      vault     vault         dao
                                           treasury:
                                           treasuryId


═══════════════════════════════════════════════════════════════════════════════
```

---

## 🔀 Ownership Model Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VAULT CREATION PATH                                │
└─────────────────────────────────────────────────────────────────────────────┘

USER CONTEXT                                    DAO CONTEXT
───────────────                                 ───────────
                                            
POST /v1/wallets/vaults                    POST /v1/daos/{daoId}/treasury/vaults
       │                                              │
       ├─ Authenticate                               ├─ Authenticate
       │  (JWT provides userId)                      │  (JWT)
       │                                             │
       └─ Create vault with:                         ├─ treasuryAdminGuard
          ├─ owner_type: 'user'                      │  (verify admin)
          ├─ owner_id: {userId}                      │
          ├─ treasury_id: null                       └─ Create vault with:
          └─ vault_type: 5 choices                      ├─ owner_type: 'dao'
             ├─ savings ✓                               ├─ owner_id: {daoId}
             ├─ investment ✓                            ├─ treasury_id: {treasuryId}
             ├─ strategy ✓                              └─ vault_type: 6 choices
             └─ custom ✓                                  ├─ investment ✓
                                                         ├─ investment-pool ✓
             ✗ investment-pool (DAO only)                ├─ escrow ✓
             ✗ escrow (DAO only)                         ├─ strategy ✓
             ✗ deployment (DAO only)                     ├─ deployment ✓
                                                         └─ custom ✓
                                                         
                                                         ✗ savings (user only)

                            ↓

                    /v1/vaults/{vaultId} ← Same 25 operations
                    
                    All ownership checks handled by middleware
                    All multisig checks handled by middleware
                    All type constraints validated before operation
                    
                    ✓ User vault: Self ownership only
                    ✓ DAO vault: DAO member access, multisig for large ops
```

---

## 🔐 Authorization Decision Tree

```
┌────────────────────────────────────────────────────────────────────────────┐
│                  OPERATION AUTHORIZATION FLOW                              │
└────────────────────────────────────────────────────────────────────────────┘

User requests: GET /v1/vaults/{vaultId}

    ├─ Extract JWT → userId
    │
    ├─ Load vault from DB
    │  ├─ Extract: owner_type, owner_id, treasury_id
    │  └─ Check if vault exists → if not: 404
    │
    ├─ vaultOwnershipGuard middleware
    │  │
    │  ├─ IF owner_type='user':
    │  │  ├─ IF owner_id === userId: ✅ ALLOW
    │  │  └─ ELSE: ❌ 403 Forbidden
    │  │
    │  ├─ IF owner_type='dao':
    │  │  ├─ Check if userId is member of DAO
    │  │  │  ├─ IF member: continue
    │  │  │  └─ ELSE: ❌ 403 Forbidden
    │  │  │
    │  │  └─ For write operations (PUT, DELETE, POST):
    │  │     ├─ Check treasuryAdminGuard
    │  │     │  ├─ IF admin: continue
    │  │     │  └─ ELSE: ❌ 403 Forbidden
    │  │     │
    │  │     └─ For withdraw/allocate:
    │  │        ├─ Check amount against multisigThreshold
    │  │        │  ├─ IF amount ≤ threshold: status='completed'
    │  │        │  └─ IF amount > threshold: status='pending' (multisig needed)
    │
    └─ vaultOwnershipGuard sets res.locals.vault
    
    Handler executes (operations.post.withdraw, etc.)
    │
    └─ Return result to user

───────────────────────────────────────────────────────────────────────

RESULT summary:
  ✓ User cannot access other user's vaults
  ✓ DAO member can read DAO vault
  ✓ Non-member cannot access DAO vault  
  ✓ Large DAO operations go pending for multisig
  ✓ Normal DAO operations execute immediately
  ✓ User operations never require multisig
```

---

## 📊 Design Decisions Matrix

### Decision 1: Shared Vs Separate Code

```
Aspect                  Shared Primitive    Separate Classes
═════════════════════════════════════════════════════════════════════
Code Duplication        0 (none)            High (19 ops × 2 = 38)
Maintenance Cost        Low (1 codebase)    High (2 codebases that drift)
Feature Parity          Guaranteed          Manual (error-prone)
Type Safety             ✅ Unified types    ❌ Duplicate types
Extensibility           Easy (add type)     Hard (refactor both)
Time to Add Type        < 1 day              > 1 week

CHOSE: Shared Primitive ✅
```

### Decision 2: Ownership Model

```
Option                  owner_type+owner_id    Separate Tables    Nullable Columns
═════════════════════════════════════════════════════════════════════════════════════
Query Simplicity        ✅ Simple              ⚠️ Joins             ✅ Simple
Data Integrity          ✅ Strong              ⚠️ Implicit          ❌ Weak
Transaction Safety      ✅ Single lock         ⚠️ Multi-lock         ✅ Single lock
Index Efficiency        ✅ (type,id)           ⚠️ Per-table         ❌ Complex
Future Extension        ✅ Trivial             ❌ Major redesign     ⚠️ Complex
PostgreSQL Best Practice ✅ Recommended        ❌ Outdated          ❌ Anti-pattern

CHOSE: owner_type + owner_id ✅
```

### Decision 3: Auth Strategy

```
Approach              Per-Handler          Middleware-Driven
════════════════════════════════════════════════════════════════════════
Code Duplication      ❌ High (19 handlers) ✅ None (centralized)
Maintainability       ❌ Low (copy-paste)   ✅ High (single place)
Consistency           ❌ Risk (drift)       ✅ Guaranteed
Audit Logging         ❌ Repeated           ✅ One place
Error Handling        ❌ Inconsistent       ✅ Standardized
New Operations        ❌ Requires copying   ✅ Just wire middleware
Testing               ❌ Per-handler        ✅ Middleware tests once

CHOSE: Middleware-Driven ✅
```

### Decision 4: Type System

```
Approach              Enum + JSONB        Pure JSONB          TypeScript Classes
════════════════════════════════════════════════════════════════════════════════════
Type Validation       ✅ Strong            ❌ None             ✅ Strong
Query Safety          ✅ Only valid types  ❌ Anything          ✅ Safe
Config Flexibility    ✅ JSONB allows both ✅ Any config        ❌ Schema required
Extensibility         ✅ Add type+validator ⚠️ No guardrails    ❌ Class redesign
Runtime Constraints   ✅ Validated         ❌ Unchecked         ✅ Validated
DB Size              ✅ Small enum         ✅ N/A              ✅ N/A

CHOSE: Enum + JSONB ✅
```

### Decision 5: Multisig: Threshold Vs Approval Count

```
Approach              Amount Threshold    Per-Operation Count    Always Required
════════════════════════════════════════════════════════════════════════════════════
Operational Flow      ✅ Small ops fast   ❌ Everything blocked   ❌ Always bottleneck
DAO Risk Management   ✅ Risk-scaled      ⚠️ One-size-fits-all   ✅ Maximum safety
Governance Burden     ✅ Light            ❌ Heavy               ❌ Very heavy
Configuration         ✅ Easy (one number) ✅ Easy (one count)    ✅ N/A
Existing DAO Pattern  ✅ Matches Celo     ⚠️ Not common          ⚠️ Not common

CHOSE: Amount Threshold ✅
```

### Decision 6: Treasury Link Design

```
Approach              treasury_id FK      Separate Tables     Nullable Columns
════════════════════════════════════════════════════════════════════════════════════
User Vault Link       ✅ NULL (clean)      ✅ None              ⚠️ Confusing
DAO Vault Link        ✅ FK reference      ✅ Table ref         ✅ Reference
Query Semantics       ✅ Clear (NULL=user) ⚠️ Implicit (no table) ⚠️ Ambiguous
Data Integrity        ✅ Strong (FK check) ✅ Table constraint   ❌ None
Future Contexts       ✅ Easy (other types) ✅ New table        ⚠️ More nullable
Index Efficiency      ✅ Single index      ✅ Per-table index   ⚠️ Conditional index

CHOSE: treasury_id FK (nullable) ✅
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VAULT OPERATION DATA FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

Request: POST /v1/vaults/vault-123/withdraw
         Body: { amount: 75000, destination: "..." }
         
    ↓
    
├─ Express Router receives request
│
├─ Middleware Stack:
│  │
│  ├─ authenticate()
│  │  └─ Validates JWT token
│  │     ├─ Extracts userId
│  │     ├─ Validates signature
│  │     └─ Sets req.user
│  │
│  ├─ vaultOwnershipGuard()
│  │  ├─ Loads vault from DB (vaults table)
│  │  ├─ Determines vault owner context:
│  │  │  ├─ IF owner_type='user':
│  │  │  │  └─ Checks userId == vault.owner_id
│  │  │  └─ IF owner_type='dao':
│  │  │     └─ Checks user is DAO member
│  │  │
│  │  └─ Sets res.locals.vault = vaultRecord
│  │
│  ├─ daoVaultMultisigGuard()
│  │  ├─ IF vault.owner_type='user': skip (no multisig)
│  │  ├─ IF vault.owner_type='dao':
│  │  │  ├─ Load daoMultisigConfig
│  │  │  ├─ Get threshold (default 50000)
│  │  │  ├─ Compare: 75000 > 50000? YES
│  │  │  │  └─ Set res.locals.status = 'pending'
│  │  │  │  └─ Set res.locals.requiresApproval = true
│  │  │  └─ Create approval record in DB
│  │  │
│  │  └─ Set res.locals.authContext
│  │
│  └─ rateLimitPerUser()
│     └─ Check user hasn't exceeded 10 withdrawals/hour
│
├─ Handler: POST /vaults/:id/withdraw
│  │
│  ├─ Read from res.locals (populated by middleware)
│  │  ├─ vault = res.locals.vault
│  │  ├─ status = res.locals.status (or 'completed')
│  │  └─ authContext = res.locals.authContext
│  │
│  ├─ VaultService.withdraw()
│  │  ├─ Validate amount > 0
│  │  ├─ Check vault.total_balance >= amount
│  │  ├─ Check vault.status != 'paused'
│  │  ├─ Check type constraints (e.g., savings can't allocate)
│  │  │
│  │  ├─ IF status='pending': create approval record
│  │  └─ IF status='completed': execute immediately
│  │
│  │  ├─ INSERT into walletTransactions:
│  │  │  ├─ amount: 75000
│  │  │  ├─ status: 'pending' | 'completed'
│  │  │  ├─ vault_id: vault-123
│  │  │  ├─ metadata: { treasuryType, reason, ... }
│  │  │  └─ timestamp: now()
│  │  │
│  │  ├─ UPDATE vaults:
│  │  │  ├─ total_balance = old_balance - 75000
│  │  │  └─ updated_at: now()
│  │  │
│  │  ├─ Log audit event:
│  │  │  ├─ dao_id: vault.owner_id (if DAO)
│  │  │  ├─ user_id: userId (who initiated)
│  │  │  ├─ action: 'vault_withdraw'
│  │  │  ├─ severity: 'critical' (if DAO) | 'medium'
│  │  │  └─ details: { amount, status, requiresMultisig }
│  │  │
│  │  └─ Return transaction object
│  │
│  └─ Return response:
│     {
│       success: true,
│       txId: "tx-789",
│       status: "pending" | "completed",
│       requiresApproval: true | false,
│       approvalCount: 0,
│       approvalThreshold: 2,
│       timestamp: "2024-03-15T10:35:00Z"
│     }
│
└─ Response sent to client
```

---

## 📋 Type Validation Logic

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  TYPE-SPECIFIC CONSTRAINT CHECKING                          │
└─────────────────────────────────────────────────────────────────────────────┘

BEFORE any operation (deposit, withdraw, allocate, etc):

VaultService.validateTypeConstraints(vault, operation)
    │
    ├─ IF vault.vault_type='savings':
    │  │
    │  ├─ ALLOW:        withdraw, deposit, pause, resume, get
    │  └─ REJECT:       allocate ❌, rebalance ❌, strategy ❌
    │     └─ Error: "Savings vault does not support allocation"
    │
    ├─ IF vault.vault_type='investment':
    │  │
    │  ├─ ALLOW:        all operations
    │  └─ REJECT:       none
    │
    ├─ IF vault.vault_type='strategy':
    │  │
    │  ├─ ALLOW:        deposit (auto-allocates), withdraw, pause, resume, get
    │  └─ REJECT:       allocate ❌ (strategy does it)
    │     └─ Error: "Strategy vault does not support manual allocation"
    │
    ├─ IF vault.vault_type='investment-pool':
    │  │
    │  ├─ ALLOW:        deposit, withdraw (share only), get, my-position
    │  └─ REJECT:       allocate ❌, rebalance ❌ (requires DAO proposal)
    │
    ├─ IF vault.vault_type='escrow':
    │  │
    │  ├─ Load config: releaseCondition, releaseTime
    │  ├─ Check condition met?
    │  │  ├─ IF NOT met:
    │  │  │  ├─ REJECT: withdraw ❌, allocate ❌
    │  │  │  └─ ALLOW:  pause, get
    │  │  └─ IF met:
    │  │     ├─ ALLOW: withdraw, get (then auto-close)
    │
    ├─ IF vault.vault_type='deployment':
    │  │
    │  ├─ ALLOW:        get, preview
    │  ├─ REJECT:       withdraw ❌, allocate ❌ (one-shot only)
    │  ├─ Check: has deployment executed?
    │  │  ├─ IF not: ALLOW allocate (one time)
    │  │  └─ IF yes: REJECT all writing ❌
    │
    └─ IF vault.vault_type='custom':
       │
       └─ ALLOW: everything (no constraints)

Result: Either continue to operation or throw error
```

---

## 🎯 Consolidation Mapping

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 LEGACY → NEW ENDPOINT MIGRATION                             │
└─────────────────────────────────────────────────────────────────────────────┘

LEGACY: /api/vaults
├─ GET    /api/vaults/{id}           → GET    /v1/vaults/{id}
├─ PUT    /api/vaults/{id}           → PUT    /v1/vaults/{id}
├─ DELETE /api/vaults/{id}           → DELETE /v1/vaults/{id}
├─ POST   /api/vaults/{id}/deposit   → POST   /v1/vaults/{id}/deposit
├─ POST   /api/vaults/{id}/withdraw  → POST   /v1/vaults/{id}/withdraw
├─ POST   /api/vaults/{id}/allocate  → POST   /v1/vaults/{id}/allocate
├─ POST   /api/vaults/{id}/rebalance → POST   /v1/vaults/{id}/rebalance
├─ GET    /api/vaults/{id}/portfolio → GET    /v1/vaults/{id}/portfolio
├─ GET    /api/vaults/{id}/positions → GET    /v1/vaults/{id}/positions
├─ GET    /api/vaults/{id}/...       → GET    /v1/vaults/{id}/...
└─ ... (19 total endpoints)

LEGACY: /wallet/savings
├─ POST   /wallet/savings            → POST   /v1/wallets/vaults (type: savings)
├─ GET    /wallet/savings            → GET    /v1/wallets/vaults?type=savings
├─ POST   /wallet/savings/{id}/...   → POST   /v1/vaults/{id}/... (if not savings constraint)
└─ ... (8 total endpoints)

LEGACY: /dao/bounty-escrow/:daoId
├─ POST   /dao/{daoId}/bounty-escrow          → POST   /v1/daos/{daoId}/treasury/vaults (type: escrow)
├─ GET    /dao/{daoId}/bounty-escrow          → GET    /v1/daos/{daoId}/treasury/vaults?type=escrow
├─ POST   /dao/{daoId}/bounty-escrow/{id}/.  → POST   /v1/vaults/{id}/... (if not escrow constraint)
└─ ... (6 total endpoints)

BENEFITS:
  ✅ All vault operations consolidated to /v1/vaults/{id}
  ✅ Type determines which operations are allowed
  ✅ User/DAO context determines auth
  ✅ 33 endpoints → 29 endpoints (but unified logic)
  ✅ Single service layer for all operations
  ✅ New vault types auto-inherit all operations
```

---

## 🛠️ Implementation Priorities

```
PHASE 1: Foundation (Week 1)
Priority: 🔴 CRITICAL
├─ Schema migration
├─ Data backfill
└─ VaultService
Result: Database ready, service layer ready

PHASE 2-3: Routers (Week 2)
Priority: 🔴 CRITICAL
├─ DAO vault operations
├─ User vault operations
├─ Shared operations endpoints
Result: All vault operations functional

PHASE 4-5: Advanced (Week 3)
Priority: 🟡 HIGH
├─ Portfolio queries
├─ Type validation
├─ Execution logging
Result: Full query surface ready

PHASE 6: Migration (Week 4)
Priority: 🟡 HIGH
├─ Consolidate /api/vaults
├─ Consolidate /wallet/savings
├─ Consolidate /dao/bounty-escrow
Result: Legacy routes deprecated, new routes primary

PHASE 7: Testing/Docs (Weeks 4-5)
Priority: 🟡 HIGH
├─ Comprehensive testing
├─ Documentation complete
Result: Production ready
```

---

**Diagram Version:** 1.0  
**Last Updated:** March 15, 2026  
**Next Review:** After Phase 1 implementation
