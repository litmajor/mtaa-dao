# Multisig End-to-End Integration: Complete Wiring Map

## Overview

This document maps the complete multisig treasury workflow from STATE (database & on-chain) → SYSTEM (backend API) → SURFACE (frontend UI), following the Cartographer SSA architecture pattern.

---

## Quick Reference: Complete Flow

```
USER ACTION (Frontend UI)
    ↓
MultisigTreasuryAPI.method()  [Client API]
    ↓
POST /v1/daos/:daoId/treasury/multisig/* [Versioned Route]
    ↓
Guard Chain: authenticate → daoMembershipGuard → treasuryAdminGuard → sessionValidation
    ↓
RateLimit: Check (e.g., treasury-multisig-create: 5/1hour)
    ↓
Business Logic: Validate inputs, interact with DB & on-chain contract
    ↓
Audit Log: CRITICAL/HIGH severity event
    ↓
Database Update: multisig_wallets / multisig_approvals / multisig_signatures
    ↓
Response → Frontend UI Display
```

---

## State Layer (Database Tables)

### multisig_wallets

```sql
CREATE TABLE multisig_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID NOT NULL REFERENCES daos(id),
  multisig_address VARCHAR,                    -- on-chain contract address
  signers TEXT[] NOT NULL,                      -- array of signer identifiers
  required_signatures INT NOT NULL,             -- threshold (e.g., 2 of 3)
  chain_id INT NOT NULL DEFAULT 44787,          -- 44787 (testnet), 42220 (mainnet)
  status VARCHAR NOT NULL DEFAULT 'pending',    -- pending, deployed, simulation, disabled
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### multisig_approvals

```sql
CREATE TABLE multisig_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID NOT NULL REFERENCES daos(id),
  multisig_wallet_id UUID NOT NULL REFERENCES multisig_wallets(id),
  proposal_id INT,                              -- on-chain proposal ID
  proposed_by UUID NOT NULL REFERENCES users(id),
  recipient VARCHAR NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  purpose TEXT NOT NULL,
  required_signatures INT NOT NULL,
  current_signatures INT DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'pending',    -- pending, approved, executed, rejected, expired
  timelock_expires_at TIMESTAMP,                -- when timelock is done
  transaction_hash VARCHAR,                     -- on-chain tx hash after execution
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### multisig_signatures

```sql
CREATE TABLE multisig_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES multisig_approvals(id),
  signer_user_id UUID NOT NULL REFERENCES users(id),
  signer_address VARCHAR NOT NULL,
  signature_data VARCHAR,
  signed_at TIMESTAMP DEFAULT NOW(),
  comment TEXT
);
```

---

## System Layer: API Routes

### Route Registry

All routes follow the pattern: `/v1/daos/:daoId/treasury/multisig/*`

Route file: `server/routes/v1/daos/_daoId/treasury/multisig-unified.ts`

Import in main app: 
```typescript
import multisigRouter from './routes/v1/daos/_daoId/treasury/multisig-unified';
app.use('/v1/daos/:daoId/treasury/multisig', multisigRouter);
```

### Endpoint Summary Table

| Method | Path | Auth Chain | RateLimit | Audit | Purpose |
|--------|------|-----------|-----------|-------|---------|
| POST | `/create` | authenticate → daoMembershipGuard → treasuryAdminGuard → sessionValidation | 5/1hour | CRITICAL | Deploy new multisig wallet |
| GET | `/config` | authenticate → daoMembershipGuard | 30/1min | — | Fetch multisig configuration |
| POST | `/propose` | authenticate → daoMembershipGuard → treasuryAdminGuard → sessionValidation | 10/1hour | HIGH | Propose treasury transfer |
| GET | `/approvals` | authenticate → daoMembershipGuard | 30/1min | — | List pending/completed approvals |
| POST | `/:approvalId/sign` | authenticate → daoMembershipGuard → treasuryAdminGuard → sessionValidation | 20/5min | HIGH | Sign approval |
| POST | `/:approvalId/execute` | authenticate → daoMembershipGuard → treasuryAdminGuard → sessionValidation | 10/1hour | CRITICAL | Execute approved proposal |
| GET | `/signers` | authenticate → daoMembershipGuard | 30/1min | — | List authorized signers |

### Key Implementation Details

#### POST /create

**Input Validation:**
- `signers`: Array, min 2 elements
- `requiredSignatures`: Int, 1 ≤ n ≤ signers.length
- `chainId`: Int (optional, default 44787)
- `simulation`: Boolean (optional, default false)

**On-Chain Logic:**
- If simulation: Generate mock multisigAddress (SIMULATION-${timestamp})
- If real: Deploy ChamaTreasury via ethers.js
  ```typescript
  const factory = new ChamaTreasuryFactory(signer);
  const contract = await factory.deploy(signers, requiredSignatures, chainId);
  const multisigAddress = contract.address;
  ```

**Database Action:**
- INSERT INTO multisig_wallets

**Audit Event:**
```typescript
logConsolidatedAuditEvent({
  dao_id: daoId,
  user_id: userId,
  action: 'multisig_create_initiated',
  severity: 'critical',
  details: { signerCount, requiredSignatures, chainId, simulation }
});
```

#### POST /propose

**Input Validation:**
- `recipient`: Valid wallet address
- `amount`: Positive number
- `purpose`: Non-empty string

**Timelock Calculation:**
```typescript
const largeThreshold = 1000; // cUSD
const timelockSeconds = amount >= largeThreshold 
  ? 24 * 60 * 60  // 24 hours for large transfers
  : 60 * 60;      // 1 hour for small transfers
const timelock_expires_at = new Date(Date.now() + timelockSeconds * 1000);
```

**On-Chain Logic:**
- Call ChamaTreasury.proposeWithdrawal(recipient, amount, purpose)
- Receive proposalId from contract

**Database Action:**
- INSERT INTO multisig_approvals (status='pending', current_signatures=0)

#### POST /:approvalId/sign

**Validation:**
- Approval exists
- Signer is in multisig_wallets.signers
- Signer hasn't already signed (CHECK NOT EXISTS in multisig_signatures)
- Approval not expired (NOW() < expires_at)

**Database Actions:**
- INSERT INTO multisig_signatures
- UPDATE multisig_approvals SET current_signatures = current_signatures + 1
- If current_signatures >= required_signatures: UPDATE multisig_approvals SET status='approved'

#### POST /:approvalId/execute

**Validation:**
- current_signatures >= required_signatures
- NOW() >= timelock_expires_at
- status = 'approved'
- NOT already executed

**On-Chain Logic:**
- Call ChamaTreasury.executeProposal(proposalId)
- Get transaction hash from receipt

**Database Actions:**
- UPDATE multisig_approvals SET status='executed', transaction_hash=txHash
- Call TreasuryService.recordWithdrawal() to sync treasury balance

---

## Surface Layer: Frontend Components

### Component Hierarchy

```
Okedi Dashboard
└── QuickActions
    └── [Treasury Multisig]
        └── UnifiedMultisigFlow.tsx (NEW)
            ├── Overview Tab
            │   ├── Stats Cards (Total Signers, Pending Approvals)
            │   └── [Create Multisig] [Propose Transfer] (admin only)
            ├── Approvals Tab
            │   └── ApprovalsListView (renders approval cards)
            │       ├── [Sign] (if pending & user is signer)
            │       ├── [Execute] (if approved & user is signer)
            │       └── [Details]
            ├── Signers Tab
            │   └── SignersListView (renders signer cards)
            └── Create Tab
                └── [Open Multisig Wizard]
```

### State Management

```typescript
interface MultisigState {
  currentView: 'overview' | 'create' | 'approvals' | 'signers';
  loading: boolean;
  error: string | null;
  approvals: MultisigApproval[];      // fetched from GET /approvals
  signers: MultisigSigner[];          // fetched from GET /signers
  userRole: string | null;            // from session
  isAdmin: boolean;                   // ['admin', 'creator', 'elder'].includes(role)
}
```

### Client API (multisigTreasuryAPI.ts)

All methods prepend `/v1/daos/:daoId/treasury/multisig` to the endpoint:

```typescript
class MultisigTreasuryAPI {
  async createMultisig(daoId, request): MultisigCreateResponse
  async getConfig(daoId): MultisigConfigResponse
  async proposeTransfer(daoId, request): MultisigApproval
  async getApprovals(daoId, status?, limit?, offset?): MultisigApprovalsListResponse
  async signApproval(daoId, approvalId, comment?): MultisigSignResponse
  async executeApproval(daoId, approvalId): MultisigExecuteResponse
  async getSigners(daoId): MultisigSignersResponse
}
```

### Dialog Modals

#### Create Multisig Dialog
- Add signers (text input + add button)
- Set required signatures (number input)
- Simulation mode checkbox
- [Create] button → POST /create

#### Propose Transfer Dialog
- Recipient (text input, wallet address)
- Amount (number input, cUSD)
- Purpose (textarea)
- [Propose] button → POST /propose

---

## Integration Checklist

### Backend

- [ ] Create multisig_wallets table (Drizzle schema)
- [ ] Create multisig_approvals table
- [ ] Create multisig_signatures table
- [ ] Register /multisig router in main app
- [ ] Implement daoMembershipGuard middleware (check dao_memberships table)
- [ ] Implement treasuryAdminGuard middleware (check role in dao_memberships)
- [ ] Implement sessionValidation middleware
- [ ] Integrate ethers.js for ChamaTreasury contract calls
- [ ] Add rate limit keys to rate-limit config
- [ ] Test each endpoint with Postman/Thunder Client
- [ ] Add integration tests for complete workflow

### Frontend

- [ ] Integrate UnifiedMultisigFlow component into OkediDashboard
- [ ] Add route: `/okedi/daos/:daoId/treasury/multisig`
- [ ] Add MultisigTreasuryAPI client methods
- [ ] Test all UI interactions (add signer, sign, execute)
- [ ] Add confirmation dialogs for dangerous ops (execute)
- [ ] Add error handling & user feedback

### Contract

- [ ] Deploy ChamaTreasury on Celo testnet (44787)
- [ ] Deploy ChamaTreasury on Celo mainnet (42220)
- [ ] Verify timelocks work correctly
- [ ] Verify dual mode (LEDGER_ONLY → LIVE_VAULT)

### Deployment

- [ ] Add .env vars: CONTRACT_ADDRESS, CHAIN_ID
- [ ] Test on staging
- [ ] Deploy to production

---

## Key Design Decisions

### Why This Architecture?

1. **STATE (DB Tables)**: Single source of truth for multisig state, queryable for reports
2. **SYSTEM (API Routes)**: All business logic centralized, easy to audit & maintain
3. **SURFACE (UI Components)**: Clean separation of concerns, reusable across Okedi surfaces

### Why versioned routes `/v1/...`?

- Future-proof: Can deploy `/v2/` without breaking `/v1/` clients
- Clear API surface: All treasury ops under `/v1/daos/:daoId/treasury/*`
- Consistent with existing Okedi architecture

### Why treasuryAdminGuard on write ops?

- Multisig is a DAO governance decision → only admins/elders can propose
- Signers are selected at multisig creation → already authorized
- Prevents spam (rate limits + guard)

### Why daoMembershipGuard on all ops?

- Ensures only DAO members see their own DAO's multisig state
- Prevents cross-DAO data leakage

### Why multiple audit severity levels?

- **CRITICAL**: multisig_create, multisig_execute (state-changing, high-value ops)
- **HIGH**: multisig_propose, multisig_signed (intermediate steps)
- **MEDIUM**: config_get (read ops, for compliance)

---

## Testing Strategy

### Manual Testing Flow

1. **Setup**: Create DAO, add 3 members with admin role
2. **Create Multisig**: 
   - Open `/okedi/daos/:daoId/treasury/multisig`
   - Click [Create Multisig]
   - Add 3 signers, set threshold to 2, click [Create]
   - Verify: multisig_wallets table has 1 record, status='deployed'
3. **Propose Transfer**:
   - Click [Propose Transfer]
   - Enter recipient, amount (< 1000 for 1-hour timelock), purpose
   - Click [Propose]
   - Verify: multisig_approvals table has 1 record, current_signatures=0, status='pending'
4. **Sign (Alice)**:
   - Switch to Alice's session
   - Refresh `/treasury/multisig`
   - Click [Sign] on pending approval
   - Verify: multisig_signatures table has 1 record, multisig_approvals.current_signatures=1, status='pending'
5. **Sign (Bob)**:
   - Switch to Bob's session
   - Click [Sign]
   - Verify: multisig_signatures table has 2 records, multisig_approvals.current_signatures=2, status='approved'
6. **Execute (after timelock)**:
   - Wait 1+ hour (or mock clock in test)
   - Click [Execute]
   - Verify: multisig_approvals.status='executed', transaction_hash set, treasury balance updated

### Automated Testing (Cypress)

```typescript
describe('Multisig End-to-End', () => {
  it('should create multisig, propose, sign, execute', () => {
    cy.login('admin');
    cy.visit('/okedi/daos/test-dao/treasury/multisig');
    cy.contains('Create Multisig').click();
    cy.get('input[placeholder*="Wallet"]').type('alice@chama');
    cy.contains('Add').click();
    cy.get('input[placeholder*="Wallet"]').type('bob@chama');
    cy.contains('Add').click();
    cy.get('input[type="number"]').type('2');
    cy.contains('Create').click();
    cy.contains('Multisig created').should('exist');
    // ... continue with propose, sign, execute
  });
});
```

---

## Troubleshooting

### "Not a member of this DAO"

- User session exists but daoMemberships record missing
- Solution: Add user to DAO via Okedi onboarding flow

### "Insufficient permissions: admin or elder required"

- User is DAO member but role is 'member' or 'founder'
- Solution: Promote user to admin/elder in DAO settings

### "At least 2 signers required"

- Trying to create multisig with < 2 signers
- Solution: Add minimum 2 signers before clicking Create

### "Signature already recorded"

- User already signed this approval
- Solution: Check multisig_signatures table, verify user_id

### "Timelock not expired"

- Trying to execute before timelock_expires_at
- Solution: Wait required time (1 hour for small, 24 hours for large transfers)

---

## Next Steps

1. **Immediate** (P0):
   - Implement database tables
   - Register router in main app
   - Test endpoints with Postman

2. **This Week** (P0):
   - Integrate ethers.js for contract calls
   - Wire frontend component into dashboard
   - End-to-end test on testnet

3. **Next Sprint** (P1):
   - Websocket live-updates for approval list
   - Advanced signer management UI
   - Analytics dashboard (multisig usage stats)

4. **Later** (P2):
   - Multi-chain support (Polygon, Optimism)
   - Guardian recovery flows
   - Delegated signing

---

## References

- [Multisig Backend Routes](../../server/routes/v1/daos/_daoId/treasury/multisig-unified.ts)
- [Multisig API Client](../../client/src/api/multisigTreasuryAPI.ts)
- [Multisig UI Component](../../client/src/components/treasury/UnifiedMultisigFlow.tsx)
- [ChamaTreasury Contract](../../contracts/ChamaTreasury.sol)
- [Okedi Manifest](../okedi-manifest.md)
- [Cartographer SSA Pattern](../adr/prompts/system-cartographer.md)
