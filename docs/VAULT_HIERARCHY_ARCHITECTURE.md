# DAO Treasury + Vault Hierarchy Architecture

## 📋 Executive Summary

A sophisticated multi-level financial primitive system where:
- **1 Treasury** per DAO (already implemented in Phase 4)
- **N Vaults** spawned from each treasury (programmable containers)
- **Multisig** as approval layer for DAO vault operations
- **Shared ownership model** supporting both user and DAO contexts
- **Consolidated endpoints** replacing legacy `/api/vaults`, `/wallet/savings`, `/dao/bounty-escrow`

---

## 🏗️ Resource Tree & Hierarchy

```
DAO
├── Treasury (1:1)
│   ├── Multi-Treasury System (5 budget categories)
│   │   ├── Operating (40%)
│   │   ├── Governance (30%)
│   │   ├── Escrow (15%)
│   │   ├── Vault (10%)
│   │   └── Reward (5%)
│   │
│   └── Vaults (N:1 to treasury)
│       ├── Investment Vault (type: investment)
│       ├── Investment Pool (type: investment-pool)
│       ├── Escrow Vault (type: escrow)
│       ├── Strategy Vault (type: strategy)
│       ├── Deployment Vault (type: deployment)
│       └── Custom Vault (type: custom)
│
User
└── Personal Vaults (N:M) ← no treasury
    ├── Savings Vault (type: savings)
    ├── Investment Vault (type: investment)
    ├── Strategy Vault (type: strategy)
    └── Custom Vault (type: custom)
```

---

## 🗄️ Schema Design

### Core Vault Table (vaults)

**Current Issues:**
- No owner_type/owner_id tracking
- No treasury_id foreign key
- No vault_type classification
- No config JSONB for flexibility

**After Migration:**

```sql
CREATE TABLE vaults (
  id UUID PRIMARY KEY,
  
  -- Ownership Model (Dual Context)
  owner_type ENUM('user', 'dao') NOT NULL,
  owner_id UUID NOT NULL,                    -- userId or daoId
  
  -- Treasury Reference (DAO context only)
  treasury_id UUID NULLABLE REFERENCES treasuries(id),
  
  -- Vault Classification
  vault_type ENUM(
    'savings',           -- Fixed-yield, time-locked or open
    'investment',        -- Active allocation vault
    'strategy',          -- Wired to strategyId
    'investment-pool',   -- Multi-member pooled fund
    'escrow',           -- Time or condition-locked
    'deployment',       -- Smart contract deployment capital
    'custom'            -- No constraints, full surface
  ) NOT NULL DEFAULT 'custom',
  
  -- Vault Configuration
  name VARCHAR(255) NOT NULL,
  description TEXT NULLABLE,
  config JSONB NOT NULL DEFAULT '{}',  -- Type-specific config:
                                        -- {
                                        --   "lockPeriod": "30d",
                                        --   "strategyId": "...",
                                        --   "multisigThreshold": 50000,
                                        --   "rebalanceInterval": "weekly",
                                        --   "releaseCondition": "...",
                                        --   "constraints": {...}
                                        -- }
  
  -- Status & Balance
  status ENUM('active', 'paused', 'closed') DEFAULT 'active',
  total_balance DECIMAL(20,8) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'cUSD',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  closed_at TIMESTAMP NULLABLE,
  
  -- Indexes
  UNIQUE INDEX idx_vault_owner (owner_type, owner_id),
  INDEX idx_vault_treasury (treasury_id),
  INDEX idx_vault_type (vault_type),
  INDEX idx_vault_status (status)
);
```

### New Relationship Table (vault_positions)

For investment-pool vaults tracking per-member shares:

```sql
CREATE TABLE vault_positions (
  id UUID PRIMARY KEY,
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,              -- userId for users, daoMemberId for DAOs
  shares DECIMAL(20,8) NOT NULL,
  share_percentage DECIMAL(5,2),
  entry_value DECIMAL(20,8),
  entry_date TIMESTAMP,
  updated_at TIMESTAMP DEFAULT now(),
  
  UNIQUE INDEX idx_position_member (vault_id, member_id)
);
```

### Backfill Requirements

Every existing vault record must be assigned before new router goes live:

```sql
-- Phase 1: Identify current owners
SELECT id, user_id, dao_id 
FROM vaults 
WHERE owner_type IS NULL;

-- Phase 2: Backfill owner_type and owner_id
UPDATE vaults
SET owner_type = CASE WHEN user_id IS NOT NULL THEN 'user' ELSE 'dao' END,
    owner_id = COALESCE(user_id, dao_id)
WHERE owner_type IS NULL;

-- Phase 3: Validate no nulls remain
SELECT COUNT(*) FROM vaults WHERE owner_type IS NULL;  -- Should be 0

-- Phase 4: Link DAO vaults to treasuries
UPDATE vaults v
SET treasury_id = t.id
FROM treasuries t
WHERE v.owner_type = 'dao' AND v.owner_id = t.dao_id;
```

---

## 📍 API Route Structure

### Spawn Endpoints (Context-Specific)

#### User Context - Create Personal Vault
```
POST /v1/wallets/vaults
├── Create: owner_type='user', owner_id={userId}
├── No treasury_id
└── Types: savings|investment|strategy|custom

GET /v1/wallets/vaults
├── List all vaults where owner_type='user' AND owner_id={userId}
└── User context from JWT
```

#### DAO Context - Create Treasury Vault
```
POST /v1/daos/{daoId}/treasury/vaults
├── Create: owner_type='dao', owner_id={daoId}
├── Link treasury_id from URL
├── Requires treasuryAdminGuard
└── Types: investment|investment-pool|escrow|strategy|deployment|custom

GET /v1/daos/{daoId}/treasury/vaults
├── List all vaults where owner_type='dao' AND owner_id={daoId}
└── Scoped to DAO, daoMembershipGuard
```

### Operations (Owner-Agnostic)

```
GET /v1/vaults/{vaultId}                    ← Get vault details
PUT /v1/vaults/{vaultId}                    ← Update config/name/type
DELETE /v1/vaults/{vaultId}                 ← Deactivate (zero balance only)

POST /v1/vaults/{vaultId}/pause             ← Halt all operations
POST /v1/vaults/{vaultId}/resume            ← Resume operations

POST /v1/vaults/{vaultId}/deposit           ← Add funds
POST /v1/vaults/{vaultId}/withdraw          ← Remove funds (multisig check for DAO)
POST /v1/vaults/{vaultId}/allocate          ← Assign to strategy/pool
POST /v1/vaults/{vaultId}/rebalance         ← Rebalance positions

GET /v1/vaults/{vaultId}/portfolio          ← Full portfolio view
GET /v1/vaults/{vaultId}/positions          ← All positions in vault
GET /v1/vaults/{vaultId}/performance        ← Historical performance
GET /v1/vaults/{vaultId}/analytics          ← Advanced metrics
GET /v1/vaults/{vaultId}/risk               ← Risk assessment
GET /v1/vaults/{vaultId}/transactions       ← Transaction history
GET /v1/vaults/{vaultId}/execution-log      ← Cross-vault execution events

GET /v1/vaults/{vaultId}/my-position        ← Caller's share (pooled vaults)
GET /v1/vaults/{vaultId}/assets             ← Link to asset-registry
POST /v1/vaults/{vaultId}/assets/sync       ← Sync asset registry
POST /v1/vaults/{vaultId}/nav               ← NAV update
```

---

## 🔐 Authentication & Authorization Model

### Auth Middleware Strategy

**Principle:** Auth is owner-agnostic, resolved from vault record + JWT

```typescript
// Middleware: vaultOwnershipGuard
// 1. Load vault from {vaultId}
// 2. Extract owner_type + owner_id from vault record
// 3. If owner_type='user':
//    - Check JWT userId == vault.owner_id
// 4. If owner_type='dao':
//    - Check user is member of vault.owner_id (DAO)
//    - For write operations: check treasuryAdminGuard
//    - For withdraw/allocate: check against multisig threshold
// 5. Proceed or return 403

// No per-handler auth needed — it's all middleware-driven
res.locals.vault = vaultRecord;          ← Available in handler
res.locals.authContext = { 
  isOwner: boolean,
  isDaoMember: boolean,
  requiresMultisig: boolean 
};
```

### Access Rules by Owner Type

| Operation | User Owner | DAO Owner |
|-----------|-----------|-----------|
| GET vault | Owner only | DAO members (read) |
| PUT config | Owner only | treasuryAdminGuard |
| DELETE | Owner only | treasuryAdminGuard |
| POST deposit | Any | Members or external |
| POST withdraw | Owner check | Multisig check + DAO member |
| POST allocate | Owner check | Multisig check + DAO member |
| POST rebalance | Owner check | Multisig check + DAO member |

---

## 🎭 Vault Types & Constraints

### 1. Savings
**Context:** User only  
**Purpose:** Fixed-yield, time-locked or open  
**Constraints:**
- Deposits and withdrawals only
- No allocate/strategy integration
- Lock period from config.lockPeriod
- Replaces `/wallet/savings/*`

**Config:**
```json
{
  "lockPeriod": "30d",           // ISO duration or null for open
  "yieldRate": 0.05,             // 5% APY
  "autoCompound": true,
  "earlyWithdrawalPenalty": 0.01 // 1% penalty
}
```

### 2. Investment
**Context:** User or DAO  
**Purpose:** Active allocation vault with full operations  
**Constraints:**
- Full operations: allocate, rebalance, positions, performance
- Can integrate strategies
- Multi-position support

**Config:**
```json
{
  "rebalanceInterval": "weekly",
  "allowedAssets": ["...", "..."],
  "constraints": {
    "maxDrawdown": 0.20,
    "volatilityTarget": 0.12
  }
}
```

### 3. Strategy
**Context:** User or DAO  
**Purpose:** Wired to a strategyId, auto-executes via MirrorCore-X  
**Constraints:**
- Deposit triggers allocation per strategy config
- strategyId wired at spawn or post-creation
- Read-only from vault perspective (strategy handles execution)

**Config:**
```json
{
  "strategyId": "strategy-uuid",
  "autoExecute": true,
  "allocationLimit": 100000,
  "slippage": 0.005
}
```

### 4. Investment Pool
**Context:** DAO only  
**Purpose:** Multi-member pooled fund  
**Constraints:**
- my-position tracks per-member share
- Governed by DAO proposals for rebalance/withdraw
- vault_positions table tracks shares

**Config:**
```json
{
  "poolType": "weighted",            // weighted, equal, etc.
  "memberShares": { "user-1": 0.40, "user-2": 0.60 },
  "minContribution": 1000,
  "lockupPeriod": "90d"
}
```

### 5. Escrow
**Context:** DAO only  
**Purpose:** Time or condition-locked, release triggered externally  
**Constraints:**
- Time-locked or condition-locked
- Release triggered by external event (bounty completion, proposal execution)
- Replaces `/dao/bounty-escrow/*`

**Config:**
```json
{
  "releaseCondition": "bounty:completed" | "timestamp",
  "releaseTime": "2024-12-31T23:59:59Z",
  "releaseThreshold": 50000,
  "refundOnExpiry": true
}
```

### 6. Deployment
**Context:** DAO only  
**Purpose:** Capital reserved for smart contract deployment or protocol initialization  
**Constraints:**
- One-shot allocation
- Execution-logged
- Non-reversible once deployed

**Config:**
```json
{
  "deploymentTarget": "contract-address-or-proposal-id",
  "deploymentTime": "2024-12-31T23:59:59Z",
  "deploymentAmount": 50000,
  "gasBuffer": 5000,
  "verificationRequired": true
}
```

### 7. Custom
**Context:** User or DAO  
**Purpose:** Power users and advanced configs  
**Constraints:**
- No constraints enforced
- Full operation surface available
- Advanced configs in JSONB

---

## 🔄 Ownership Model Details

### Dual Context Ownership

```typescript
// User Context (personal vault)
{
  owner_type: 'user',
  owner_id: '{userId}',
  treasury_id: null,           // Users have no treasury
  vault_type: 'savings' | 'investment' | 'strategy' | 'custom'
}

// DAO Context (treasury vault)
{
  owner_type: 'dao',
  owner_id: '{daoId}',
  treasury_id: '{treasuryId}', // Link to DAO's treasury
  vault_type: 'investment' | 'investment-pool' | 'escrow' | 'strategy' | 'deployment' | 'custom'
}
```

### Migration of Legacy Data

**Current Legacy Routes:**
- `/api/vaults/...` (19 endpoints) → Flat, unscoped vaults
- `/wallet/savings/...` → Personal savings vaults
- `/dao/bounty-escrow/...` → DAO escrow vaults (RegExp routes)

**Migration Strategy:**

1. **Backfill Phase**
   - Add owner_type, owner_id to all existing vault records
   - Link DAO vaults to appropriate treasury_id
   - Classify vault_type based on current usage

2. **Router Migration**
   - Old routes remain (deprecated, logged)
   - New scoped routes take precedence
   - Gradual client migration window (3 months)

3. **Death of Routes**
   - `/api/vaults/{id}` → `GET /v1/vaults/{id}` (operations unchanged)
   - `/wallet/savings` → consolidated into `POST /v1/wallets/vaults` (type: savings)
   - `/dao/bounty-escrow` → consolidated into `POST /v1/daos/{daoId}/treasury/vaults` (type: escrow)

---

## 🛠️ Service Layer Architecture

### VaultService Class

All operations database-agnostic, using Drizzle ORM.

```typescript
class VaultService {
  // Spawn Operations
  static async createUserVault(userId: string, config: VaultConfig): Promise<Vault>
  static async createDaoVault(daoId: string, treasuryId: string, config: VaultConfig): Promise<Vault>
  
  // Read Operations
  static async getVault(vaultId: string): Promise<Vault>
  static async listUserVaults(userId: string): Promise<Vault[]>
  static async listDaoVaults(daoId: string): Promise<Vault[]>
  
  // Write Operations
  static async updateVault(vaultId: string, updates: Partial<VaultConfig>): Promise<Vault>
  static async deleteVault(vaultId: string): Promise<boolean>
  
  // Fund Operations
  static async deposit(vaultId: string, amount: string, source: string): Promise<Transaction>
  static async withdraw(vaultId: string, amount: string, destination: string): Promise<Transaction>
  
  // Allocation Operations
  static async allocate(vaultId: string, assetId: string, amount: string): Promise<Position>
  static async rebalance(vaultId: string, targetAllocations: Record<string, string>): Promise<Position[]>
  
  // Status Operations
  static async pauseVault(vaultId: string): Promise<boolean>
  static async resumeVault(vaultId: string): Promise<boolean>
  
  // Query Operations
  static async getPortfolio(vaultId: string): Promise<Portfolio>
  static async getPositions(vaultId: string): Promise<Position[]>
  static async getPerformance(vaultId: string): Promise<Performance>
  static async getMyPosition(vaultId: string, userId: string): Promise<Position>
  static async getTransactionHistory(vaultId: string, limit?: number): Promise<Transaction[]>
  static async getExecutionLog(vaultId: string): Promise<ExecutionEvent[]>
  
  // Type-Specific Operations
  static async validateType(vaultId: string, operation: string): Promise<boolean>
  static async applyTypeConstraints(vault: Vault, operation: string): Promise<void>
}
```

---

## 📊 Data Flow Examples

### Scenario 1: User Creates Investment Vault

```
POST /v1/wallets/vaults
{
  "name": "My Portfolio",
  "vault_type": "investment",
  "config": {
    "rebalanceInterval": "monthly",
    "allowedAssets": ["cUSD", "cEUR"]
  }
}

↓ VaultService.createUserVault()
↓ Insert into vaults table (owner_type='user', treasury_id=null)
↓ Return vault with full metadata

Response:
{
  "id": "vault-123",
  "owner_type": "user",
  "owner_id": "{userId}",
  "vault_type": "investment",
  "status": "active",
  "total_balance": "0",
  "created_at": "2024-03-15T10:00:00Z"
}
```

### Scenario 2: DAO Treasury Spawns Investment Pool

```
POST /v1/daos/dao-acme/treasury/vaults
{
  "name": "Community Investment Pool",
  "vault_type": "investment-pool",
  "config": {
    "poolType": "weighted",
    "minContribution": 1000,
    "lockupPeriod": "90d"
  }
}

↓ treasuryAdminGuard confirms admin
↓ VaultService.createDaoVault()
↓ Insert into vaults table (owner_type='dao', treasury_id='{treasuryId}')
↓ Create vault_positions records for DAO members

Response:
{
  "id": "vault-456",
  "owner_type": "dao",
  "owner_id": "dao-acme",
  "vault_type": "investment-pool",
  "treasury_id": "treasury-xyz",
  "status": "active",
  "total_balance": "0",
  "created_at": "2024-03-15T10:30:00Z"
}
```

### Scenario 3: DAO Member Withdraws from Investment Pool

```
POST /v1/vaults/vault-456/withdraw
{
  "amount": "5000",
  "destination": "user-wallet"
}

↓ vaultOwnershipGuard loads vault
↓ Confirms owner_type='dao', checks JWT user is DAO member
↓ Checks treasury multisig threshold (50000 cUSD)
↓ Amount < threshold: auto-approved
↓ Amount >= threshold: set status='pending', create approval record
↓ VaultService.withdraw()
↓ Create transaction record
↓ Update vault.total_balance

Response:
{
  "txId": "tx-789",
  "vaultId": "vault-456",
  "amount": "5000",
  "status": "completed",
  "timestamp": "2024-03-15T10:35:00Z"
}
```

### Scenario 4: User Queries Escrow Vault Status

```
GET /v1/vaults/vault-escrow-001

↓ vaultOwnershipGuard loads vault
↓ Confirms vault exists
↓ Checks caller has read permission
↓ VaultService.getVault()
↓ Query vaults table, resolve owner context

Response:
{
  "id": "vault-escrow-001",
  "name": "Q1 Bounty Escrow",
  "vault_type": "escrow",
  "owner_type": "dao",
  "owner_id": "dao-acme",
  "status": "active",
  "total_balance": "50000",
  "config": {
    "releaseCondition": "bounty:completed",
    "releaseThreshold": 50000,
    "refundOnExpiry": true
  }
}
```

---

## 🎯 Multisig Enforcement

### Withdraw Threshold Check

For DAO vaults, multisig thresholds are applied at middleware:

```typescript
// middleware: daoVaultMultisigGuard
async (req: Request, res: Response, next) => {
  const vault = res.locals.vault;
  
  if (vault.owner_type !== 'dao') return next();  // User vaults don't need multisig
  
  const { amount } = req.body;
  const amountNum = parseFloat(amount);
  
  // Get DAO multisig config
  const multisigConfig = await getMultisigConfig(vault.owner_id);
  const threshold = multisigConfig?.withdrawalThreshold || 50000;
  
  if (amountNum > threshold) {
    // Require multisig approvals
    const approval = await createWithdrawalApproval(vault.id, amount, userId);
    res.locals.requiresApproval = true;
    res.locals.approvalId = approval.id;
    res.locals.status = 'pending';  // Transaction will be pending until threshold met
  }
  
  next();
}
```

### Allocate/Rebalance Also Subject to Multisig

Same logic applies to POST /vaults/{vaultId}/allocate and POST /vaults/{vaultId}/rebalance

---

## 🔗 Integration Points

### With Multi-Treasury System (Already Implemented)

- DAO vault spawn requires valid `treasuryId` from treasury table
- Vault balance updates contribute to treasury composition
- Multisig threshold for vault ops references same daoMultisigConfig table

### With Asset Registry

- `GET /v1/vaults/{vaultId}/assets` → links vault positions to asset metadata
- `POST /v1/vaults/{vaultId}/assets/sync` → re-syncs asset prices/metadata

### With Strategy System (MirrorCore-X)

- Strategy-type vaults have `config.strategyId` wired at creation
- Deposit to strategy vault triggers automatic allocation via strategy
- Strategy portfolio integration for performance/analytics

### With DAO Proposals

- Investment-pool rebalance can require DAO proposal approval
- Escrow release conditions tied to proposal execution
- Deployment vault tied to contract deployment proposals

---

## 📝 TODO List (30 Items)

```
Phase 1: Schema & Database
  □ Plan schema migration (vaults table)
  □ Add owner_type, owner_id, vault_type, treasury_id columns
  □ Create vault_positions table (for pooled vaults)
  □ Backfill vaults table (owner_type+owner_id)
  □ Write migration scripts for endpoint consolidation

Phase 2: Service Layer
  □ Create VaultService with real DB queries
  □ Implement spawn operations (user + DAO)
  □ Implement read operations (get, list)
  □ Implement write operations (update, delete)
  □ Implement fund operations (deposit, withdraw)

Phase 3: DAO Vault Router
  □ Build vault operations router (DAO context)
  □ Add multisig threshold checks (DAO vaults)
  □ Implement pause/resume operations
  □ Implement deposit/withdraw with multisig
  □ Build allocation/rebalance endpoints

Phase 4: User Vault Router
  □ Build user vault spawn endpoint
  □ Build user vault listing endpoint
  □ Share operations router (user + DAO use same /v1/vaults/{id} routes)

Phase 5: Advanced Features
  □ Implement my-position endpoint (pooled vaults)
  □ Create execution-log tracking system
  □ Build portfolio + positions endpoints
  □ Implement performance/analytics/risk queries
  □ Build asset registry integration

Phase 6: Type-Specific Logic
  □ Implement vault_type-specific logic
  □ Create vault type specification document
  □ Build validation + error handling
  □ Implement strategy wiring system

Phase 7: Consolidation & Migration
  □ Migrate old /api/vaults endpoints
  □ Consolidate /wallet/savings into vaults
  □ Consolidate /dao/bounty-escrow into vaults
  □ Build auth middleware (owner-agnostic)

Phase 8: Documentation & Testing
  □ Write comprehensive vault documentation
  □ Test all vault type operations
  □ Verify multisig threshold enforcement
  □ Final integration + go-live
```

---

## 🎓 Key Design Decisions

### Decision 1: Shared Primitive Model
**Why:** Vaults are the same resource whether spawned by user or DAO. Ownership is in the record, not the URL.

### Decision 2: Owner-Agnostic Operations
**Why:** Same /v1/vaults/{id} endpoints for all operations. Auth middleware resolves context. Eliminates duplicate code.

### Decision 3: Type System via vault_type + config JSONB
**Why:** Flexibility without creating separate code paths. constraints, lock periods, strategy IDs all live in config.

### Decision 4: Treasury as Factory
**Why:** DAO vaults created *from* treasury context (POST to treasury route), but operations happen at vault level (GET|PUT|DELETE /vaults/{id}).

### Decision 5: Multisig at Middleware
**Why:** DAO vault withdrawals/allocations subject to multisig threshold. Applied uniformly via middleware, not per-handler.

### Decision 6: Lazy Strategy Wiring
**Why:** Strategy vaults can be wired at spawn or post-creation. Allows flexibility for both immediate and gradual deployments.

---

## 🚀 Next Steps

1. **Immediate:** Implement schema migration and backfill (needs DB team)
2. **Week 1:** Build VaultService with all DB operations
3. **Week 2:** Build vault operations router (shared for user + DAO)
4. **Week 3:** Build spawn endpoints (user + DAO contexts)
5. **Week 4:** Consolidate legacy endpoints, write docs
6. **Week 5:** Testing, verification, go-live

---

**Status:** Architecture Complete, Ready for Implementation  
**Complexity:** High (multi-context ownership, type system, multisig integration)  
**Dependencies:** Multi-treasury system (completed), Asset registry, Strategy system  
**Estimated Effort:** 4-5 weeks + QA
