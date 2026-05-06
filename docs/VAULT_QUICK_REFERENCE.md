# Vault Hierarchy - Quick Reference for Developers

## 🎯 5-Minute Orientation

### What Is This System?

DAO Treasury → Vaults Hierarchy

```
1 DAO
  ↓
1 Treasury (multi-category: operating, governance, escrow, vault, reward)
  ↓
N Vaults (programmable containers within treasury)
  ↓
M Positions (holdings within each vault)
```

Also: Users can create personal vaults (no treasury context)

### Two Ownership Models

```
User Vault                          DAO Vault
┌─────────────────────────┐        ┌──────────────────────────┐
│ owner_type: 'user'      │        │ owner_type: 'dao'        │
│ owner_id: userId        │        │ owner_id: daoId          │
│ treasury_id: NULL       │        │ treasury_id: treasuryId  │
│ vault_type: 5 choices   │        │ vault_type: 6 choices    │
└─────────────────────────┘        └──────────────────────────┘
     (personal use)                   (governed resource)
```

### Key Insight

**Same resource, different spawn context.**

Operations happen at vault level, not treasury or user level:
- `POST /v1/wallets/vaults` ← spawn user vault
- `POST /v1/daos/{daoId}/treasury/vaults` ← spawn DAO vault
- `POST /v1/vaults/{vaultId}/deposit` ← same endpoint for both

---

## 🏗️ Database Schema (TL;DR)

```sql
-- Main vault table
CREATE TABLE vaults (
  id UUID PRIMARY KEY,
  owner_type ENUM('user', 'dao'),           -- Who owns this
  owner_id UUID,                             -- userId or daoId
  treasury_id UUID NULLABLE,                 -- Only for DAO vaults
  vault_type ENUM(
    'savings',           -- User: fixed-yield, locked
    'investment',        -- User/DAO: active allocation
    'strategy',          -- User/DAO: auto-execute via strategy
    'investment-pool',   -- DAO: multi-member fund
    'escrow',           -- DAO: time/condition-locked
    'deployment',       -- DAO: smart contract deployment
    'custom'            -- User/DAO: no constraints
  ),
  config JSONB,                              -- Type-specific settings
  total_balance DECIMAL(20,8),
  status ENUM('active', 'paused', 'closed'),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- For pooled vaults (investment-pool type)
CREATE TABLE vault_positions (
  id UUID PRIMARY KEY,
  vault_id UUID REFERENCES vaults(id),
  member_id UUID,           -- userId or daoMemberId
  shares DECIMAL(20,8),     -- % ownership
  entry_date TIMESTAMP,
  UNIQUE INDEX (vault_id, member_id)
);
```

---

## 📍 API Routes Cheat Sheet

### Spawn Endpoints (Create vaults)

```
POST /v1/wallets/vaults
  → Create personal vault
  → owner_type='user' (from JWT)
  → Types: savings, investment, strategy, custom

GET /v1/wallets/vaults
  → List my vaults

POST /v1/daos/{daoId}/treasury/vaults
  → Create DAO vault (needs treasuryAdminGuard)
  → owner_type='dao', treasury_id from URL
  → Types: investment, investment-pool, escrow, strategy, deployment, custom

GET /v1/daos/{daoId}/treasury/vaults
  → List DAO vault (needs daoMembershipGuard)
```

### Operations (Same for user + DAO)

```
GET    /v1/vaults/{vaultId}                 Read vault
PUT    /v1/vaults/{vaultId}                 Update config
DELETE /v1/vaults/{vaultId}                 Close vault

POST   /v1/vaults/{vaultId}/deposit         Add funds
POST   /v1/vaults/{vaultId}/withdraw        Remove funds (multisig if DAO)
POST   /v1/vaults/{vaultId}/allocate        Assign to strategy/position
POST   /v1/vaults/{vaultId}/rebalance       Rebalance positions

POST   /v1/vaults/{vaultId}/pause           Freeze operations
POST   /v1/vaults/{vaultId}/resume          Resume operations

GET    /v1/vaults/{vaultId}/portfolio       All positions + allocation%
GET    /v1/vaults/{vaultId}/positions       Detailed positions
GET    /v1/vaults/{vaultId}/performance     Returns + NAV
GET    /v1/vaults/{vaultId}/my-position     Your share (pooled only)
GET    /v1/vaults/{vaultId}/transactions    Transfer log
GET    /v1/vaults/{vaultId}/execution-log   Full operation log
```

---

## 🔐 Authentication Rules

### User Vaults

```
Create: ✅ Any user (self)
Read:   ✅ Owner only
Write:  ✅ Owner only
Ops:    ✅ Owner only
```

### DAO Vaults

```
Create: ✅ treasuryAdminGuard (admin only)
Read:   ✅ daoMembershipGuard (members can read)
Write:  ✅ treasuryAdminGuard
Ops:    ✅ daoMembershipGuard (members)
         ⚠️ Large ops require multisig approval
```

### Multisig Threshold

For DAO vaults only:
- Withdraw > 50,000 cUSD? → Requires multisig approval
- Allocate > 50,000 cUSD? → Requires multisig approval
- Get threshold from `daoMultisigConfig.withdrawalThreshold`

---

## 🎭 Vault Type Behaviors

### savings (User Only)
```
Purpose:       Fixed-yield savings
Config:        { lockPeriod: "30d", yieldRate: 0.05 }
Operations:    deposit ✅, withdraw ✅, pause ✅
NOT allowed:   allocate ❌, rebalance ❌, strategy ❌
```

### investment (User or DAO)
```
Purpose:       Active trading/allocation
Config:        { rebalanceInterval: "weekly", allowedAssets: [...] }
Operations:    deposit ✅, withdraw ✅, allocate ✅, rebalance ✅
```

### strategy (User or DAO)
```
Purpose:       Auto-execute via external strategy
Config:        { strategyId: "strat-123", autoExecute: true }
Operations:    deposit ✅ (auto-allocates per strategy)
NOT allowed:   manual allocate ❌
```

### investment-pool (DAO Only)
```
Purpose:       Multi-member fund
Config:        { poolType: "weighted", memberShares: {...} }
Operations:    deposit ✅, withdraw from your share ✅
Special:       GET /v1/vaults/{vaultId}/my-position → your %
```

### escrow (DAO Only)
```
Purpose:       Time/condition-locked capital
Config:        { releaseCondition: "bounty:completed", releaseTime: "..." }
Operations:    wait until condition met, then withdraw ✅
NOT allowed:   withdraw before condition ❌, rebalance ❌
```

### deployment (DAO Only)
```
Purpose:       Smart contract deployment capital
Config:        { deploymentTarget: "contract-addr", deploymentAmount: 50000 }
Operations:    single allocation, then immutable
```

### custom (User or DAO)
```
Purpose:       Power users
Config:        anything
Operations:    everything allowed
```

---

## 📋 Example Workflows

### Workflow 1: User Creates Investment Vault

```bash
# 1. Create vault
POST /v1/wallets/vaults
Authorization: Bearer {jwt}
{
  "name": "My Portfolio",
  "vault_type": "investment",
  "config": {
    "rebalanceInterval": "monthly",
    "allowedAssets": ["cUSD", "cEUR"]
  }
}

Returns: {
  "id": "vault-123",
  "owner_type": "user",
  "owner_id": "{userId}",
  "vault_type": "investment",
  "status": "active",
  "total_balance": "0"
}

# 2. Deposit funds
POST /v1/vaults/vault-123/deposit
{
  "amount": "10000",
  "source": "wallet-123"
}

# 3. Check balance
GET /v1/vaults/vault-123/portfolio
Returns: All positions + allocation breakdown

# 4. Rebalance
POST /v1/vaults/vault-123/rebalance
{
  "allocations": { "cUSD": 0.60, "cEUR": 0.40 }
}
```

### Workflow 2: DAO Creates Investment Pool

```bash
# 1. Create investment-pool in DAO treasury (admin only)
POST /v1/daos/dao-acme/treasury/vaults
Authorization: Bearer {adminJwt}
X-DAO-Guard: treasuryAdminGuard
{
  "name": "Community Fund",
  "vault_type": "investment-pool",
  "config": {
    "poolType": "weighted",
    "minContribution": 1000,
    "memberShares": {
      "user-1": 0.40,
      "user-2": 0.60
    }
  }
}

Returns: {
  "id": "vault-456",
  "owner_type": "dao",
  "owner_id": "dao-acme",
  "treasury_id": "treasury-xyz",
  "vault_type": "investment-pool"
}

# 2. Member checks their position
GET /v1/vaults/vault-456/my-position
Response: {
  "member_id": "user-1",
  "shares": "0.40",
  "entry_value": "50000",
  "current_value": "52000",
  "unrealized_pnl": "2000"
}

# 3. Member withdraws their portion (needs multisig if > threshold)
POST /v1/vaults/vault-456/withdraw
{
  "amount": "52000",
  "destination": "wallet-xyz"
}
```

### Workflow 3: DAO Escrow for Bounty

```bash
# 1. Create escrow vault (bounty completion condition)
POST /v1/daos/dao-acme/treasury/vaults
{
  "name": "Q1 Bug Bounty Escrow",
  "vault_type": "escrow",
  "config": {
    "releaseCondition": "bounty:completed",
    "bountyId": "bounty-123",
    "refundOnExpiry": true
  }
}

# 2. Deposit bounty amount
POST /v1/vaults/vault-escrow-001/deposit
{
  "amount": "10000",
  "source": "treasury"
}

# 3. Withdrawal blocked until bounty marked complete
POST /v1/vaults/vault-escrow-001/withdraw
{
  "amount": "10000"
}
# Returns: 403 Forbidden - "Escrow condition not met"

# 4. After bounty completion, withdraw is allowed
POST /v1/vaults/vault-escrow-001/withdraw
{
  "amount": "10000"
}
# Returns: 200 OK, transfer executed
```

---

## 👨‍💻 For Backend Developers

### Key Files

```
Core Service:
  server/services/VaultService.ts
  
Routers:
  server/routes/v1/wallets/vaults.ts       (user context)
  server/routes/v1/daos/_daoId/treasury/vaults.ts  (DAO context)
  server/routes/v1/vaults.ts               (operations)
  
Middleware:
  server/middleware/vaultOwnershipGuard.ts
  server/middleware/daoVaultMultisigGuard.ts
  
Schema:
  shared/schema.ts                         (vaults table)
```

### Common Tasks

**Add a new vault type:**
1. Add to enum: `vault_type: ENUM(..., 'new_type')`
2. Add validator: `validateNewTypeVault()` in VaultService
3. Add constraints check in operations handler
4. Update docs

**Add a new operation:**
1. Add method to VaultService
2. Wire middleware stack in router
3. Add error handling
4. Update documentation

**Debug ownership issue:**
1. Check vault.owner_type + owner_id in DB
2. Verify JWT userId or daoId matches
3. Check daoMembershipGuard if DAO vault

---

## 🧪 Testing Checklist

```
Authentication
  □ User can't access other user's vault
  □ DAO member can read DAO vault
  □ Non-member can't access DAO vault
  □ Multisig enforced for large DAO ops

Type Constraints
  □ savings vault rejects allocate operation
  □ escrow vault blocks withdraw before release
  □ strategy vault auto-allocates on deposit
  □ investment-pool returns correct my-position

Multisig
  □ Small withdraw needs no multisig
  □ Large withdraw requires multisig approval
  □ No bypass of threshold check

Operations
  □ deposit increases total_balance
  □ withdraw decreases total_balance
  □ pause blocks operations
  □ resume allows operations again
```

---

## ⚠️ Common Mistakes

❌ **Mistake 1:** Hardcoding user/dao logic in operation handlers
✅ **Fix:** Use ownership guard middleware, handlers are owner-agnostic

❌ **Mistake 2:** Forgetting multisig check for DAO withdrawals
✅ **Fix:** Middleware applies multisig, not handler

❌ **Mistake 3:** Creating separate endpoints for user/DAO vaults
✅ **Fix:** One `/v1/vaults/{id}` endpoint, ownership resolved by middleware

❌ **Mistake 4:** Storing strategy config in separate table
✅ **Fix:** All type-specific config lives in vaults.config JSONB

❌ **Mistake 5:** Forgetting treasury_id FK for DAO vaults
✅ **Fix:** Always set on DAO vault creation

---

## 📞 Quick Help

**Q: How do I know if a vault is DAO or user?**
A: Check `vault.owner_type` — 'user' or 'dao'

**Q: Where does user context come from?**
A: JWT token in Authorization header

**Q: Where does DAO context come from?**
A: URL path parameter `{daoId}`

**Q: Why is my withdraw pending?**
A: DAO vault, amount exceeds multisig threshold. Requires approvals.

**Q: Can a user vault have a treasury?**
A: No. User vaults have treasury_id=NULL. Treasury is DAO-only.

**Q: Can I change vault type after creation?**
A: No. Type change would break constraints. Create new vault instead.

**Q: How do I migrate from old /api/vaults?**
A: See VAULT_IMPLEMENTATION_ROADMAP.md migration section

---

## 🔗 Related Documents

- **Architecture:** VAULT_HIERARCHY_ARCHITECTURE.md
- **Design Decisions:** VAULT_IMPLEMENTATION_ROADMAP.md
- **Multi-Treasury:** MULTI_TREASURY_IMPLEMENTATION.md
- **API Spec:** [Detailed OpenAPI coming]

---

**Last Updated:** 2024  
**Status:** Design Complete, Implementation Ready  
**Questions?** See related documents or ask architecture team
