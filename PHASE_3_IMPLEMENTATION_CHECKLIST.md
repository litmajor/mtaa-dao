# PHASE 3 IMPLEMENTATION CHECKLIST
## Days 1-14: Smart Contract Multisig + Audit Logging

---

## WEEK 1: CONTRACT DEVELOPMENT & TESTING (Days 1-7)

### Day 1-2: Smart Contract Development
- [x] Create MultiSigTreasury.sol (380 lines)
  - [x] 2-of-3 multisig enforcement
  - [x] 48-hour timelock
  - [x] Recipient whitelist
  - [x] Amount limits (5% single, 5% daily)
  - [x] State machine (Pending→Approved→Executed)
  - [x] Event logging
- [x] Create AuditLog.sol (280 lines)
  - [x] Immutable event recording
  - [x] Indexing by DAO + Actor + ActionType
  - [x] Pagination support
  - [x] Cryptographic verification hashes
- [x] Create GovernanceSnapshot.sol (350 lines)
  - [x] Block-based voting snapshots
  - [x] Vote recording with validation
  - [x] Quorum checking
  - [x] One vote per member enforcement

### Day 2-3: Contract Testing (40+ tests)
**MultiSigTreasury Tests (12 tests)**
- [ ] Test 1: Initialize with 3 signers successfully
- [ ] Test 2: Propose transaction with valid recipient
- [ ] Test 3: Reject proposal if recipient not whitelisted
- [ ] Test 4: Reject approval before timelock elapses
- [ ] Test 5: Accept approval after timelock elapses
- [ ] Test 6: Track approvals correctly (1/2, 2/2)
- [ ] Test 7: Execute transaction with 2 approvals
- [ ] Test 8: Prevent execution with only 1 approval
- [ ] Test 9: Enforce 5% single transfer limit
- [ ] Test 10: Enforce 5% daily limit
- [ ] Test 11: Add/remove whitelist recipients
- [ ] Test 12: Handle reentrancy attack (ReentrancyGuard)

**AuditLog Tests (10 tests)**
- [ ] Test 13: Log action and return entryId
- [ ] Test 14: Retrieve entry by ID
- [ ] Test 15: Query all entries for DAO
- [ ] Test 16: Query all entries by actor
- [ ] Test 17: Paginate results (offset/limit)
- [ ] Test 18: Get action type counts
- [ ] Test 19: Cryptographic hash verification
- [ ] Test 20: Cannot modify existing entries (immutable)
- [ ] Test 21: Handle 1000+ entries (stress test)
- [ ] Test 22: Event emission and indexing

**GovernanceSnapshot Tests (8 tests)**
- [ ] Test 23: Create snapshot at current block
- [ ] Test 24: Record vote with validation
- [ ] Test 25: Prevent duplicate voting
- [ ] Test 26: Validate vote choices (for/against/abstain)
- [ ] Test 27: Tally votes correctly
- [ ] Test 28: Check quorum requirement
- [ ] Test 29: Determine proposal pass/fail
- [ ] Test 30: Prevent voting after snapshot closes

**Integration Tests (10 tests)**
- [ ] Test 31: Propose → Approve → Execute flow
- [ ] Test 32: Multisig signatures persist
- [ ] Test 33: Audit log created with each action
- [ ] Test 34: Snapshot created with proposal
- [ ] Test 35: Vote and multisig approval both recorded
- [ ] Test 36: Chain multiple transactions
- [ ] Test 37: Reject transaction reverts approvals
- [ ] Test 38: Whitelist changes reflected in proposals
- [ ] Test 39: Timelock countdown works
- [ ] Test 40: Gas usage within limits (<200k)

**Test Command:**
```bash
npm run test:contracts
# Expected: 40/40 passing ✓
```

### Day 3-4: Deployment Setup
- [ ] Create Hardhat config (hardhat.config.ts)
  - [ ] Sepolia testnet configured
  - [ ] Mainnet configured
  - [ ] Private keys from environment
  - [ ] Gas price settings

- [ ] Create deployment scripts
  - [ ] script: deploy-multisig-treasury.ts
    - [ ] Deploy MultiSigTreasury
    - [ ] Deploy AuditLog
    - [ ] Deploy GovernanceSnapshot
    - [ ] Initialize with 3 signers
    - [ ] Save addresses to .env
  
  - [ ] script: initialize-multisig.ts
    - [ ] Add 3 signers to multisig
    - [ ] Add initial whitelist recipients
    - [ ] Set amount limits
    - [ ] Grant roles (SIGNER_ROLE, ADMIN_ROLE)
  
  - [ ] script: whitelist-recipients.ts
    - [ ] Add treasury DAO address
    - [ ] Add team wallets
    - [ ] Add multisig as recipient

- [ ] Deploy to Sepolia testnet
  ```bash
  npx hardhat run scripts/deploy-multisig-treasury.ts --network sepolia
  
  # Expected output:
  # MultiSigTreasury deployed to: 0x123...
  # AuditLog deployed to: 0x456...
  # GovernanceSnapshot deployed to: 0x789...
  # Deployment cost: ~0.5 ETH
  ```

- [ ] Verify contracts on Etherscan
  ```bash
  npx hardhat verify --network sepolia <ADDRESS> <CONSTRUCTOR_ARGS>
  ```

---

## WEEK 2: BACKEND + FRONTEND + DEPLOYMENT (Days 8-14)

### Day 8-9: Backend API Integration

#### Create treasury-multisig.ts routes file
```bash
touch server/routes/treasury-multisig.ts
```

**Endpoint 1: Propose Transaction**
- [ ] POST `/treasury/:daoId/transactions/propose`
- [ ] Input validation:
  - [ ] Verify user is DAO admin
  - [ ] Check recipient is whitelisted
  - [ ] Validate amount < 5% threshold
  - [ ] Check daily limit not exceeded
- [ ] Contract interaction:
  - [ ] Get MultiSigTreasury address for DAO
  - [ ] Call `proposeTransaction(recipient, amount, token, description)`
- [ ] Database logging:
  - [ ] Insert into `treasury_multisig_transactions`
  - [ ] Status: 'pending'
  - [ ] Store blockTimestamp
- [ ] Response:
  ```json
  {
    "success": true,
    "transactionId": 1,
    "recipient": "0x...",
    "amount": "50000",
    "createdAt": "2024-01-15T10:30:00Z"
  }
  ```

**Endpoint 2: Approve Transaction**
- [ ] POST `/treasury/:daoId/transactions/:id/approve`
- [ ] Input validation:
  - [ ] Verify user is authorized signer
  - [ ] Check transaction exists
  - [ ] Verify timelock has elapsed
  - [ ] User hasn't already approved
- [ ] Contract interaction:
  - [ ] Call `approveTransaction(transactionId)`
  - [ ] Verify returned approval count (1/2 or 2/2?)
- [ ] Database logging:
  - [ ] Update transaction status
  - [ ] Record signer + timestamp
- [ ] Audit logging:
  - [ ] Call AuditLog.log() with actionType='TransactionApproved'
- [ ] Response:
  ```json
  {
    "success": true,
    "approvalCount": 1,
    "approvalsRequired": 2,
    "status": "pending",
    "approvers": ["0x..."]
  }
  ```

**Endpoint 3: Execute Transaction**
- [ ] POST `/treasury/:daoId/transactions/:id/execute`
- [ ] Input validation:
  - [ ] User can be any DAO member (permissionless)
  - [ ] Transaction must have 2 approvals
  - [ ] Timelock must have elapsed
- [ ] Contract interaction:
  - [ ] Call `executeTransaction(transactionId)`
  - [ ] Verify execution succeeded
- [ ] Database logging:
  - [ ] Update status to 'executed'
  - [ ] Store transaction hash
  - [ ] Record execution timestamp
- [ ] Audit logging:
  - [ ] Call AuditLog.log() with actionType='TransactionExecuted'
  - [ ] Include transaction hash
- [ ] Response:
  ```json
  {
    "success": true,
    "transactionId": 1,
    "status": "executed",
    "txHash": "0x...",
    "executedAt": "2024-01-17T10:30:00Z"
  }
  ```

**Endpoint 4: Query Audit Log**
- [ ] GET `/treasury/:daoId/audit-log?offset=0&limit=50`
- [ ] Query logic:
  - [ ] Verify user has access to DAO
  - [ ] Get entries from `audit_logs` table
  - [ ] Filter by daoId
  - [ ] Order by timestamp DESC
  - [ ] Apply offset/limit
- [ ] Response:
  ```json
  {
    "success": true,
    "entries": [
      {
        "id": 1,
        "daoId": "dao-123",
        "actor": "0x...",
        "actionType": "TransactionExecuted",
        "description": "Transfer 50k USDC to treasury",
        "timestamp": "2024-01-17T10:30:00Z",
        "blockNumber": 1234567
      }
    ],
    "total": 50,
    "offset": 0,
    "limit": 50
  }
  ```

**Test to verify API connection:**
```bash
# Start dev server
npm run dev

# Test Endpoint 1: Propose
curl -X POST http://localhost:3000/treasury/dao-123/transactions/propose \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{"recipient":"0x...","amount":"50000","token":"0xA0b86991..."}'

# Expected: { success: true, transactionId: 1 }
```

### Day 9-10: Database Schema Migration

#### Create migration file
```bash
# Create migration script
touch server/migrations/003_treasury_multisig.sql
```

**Create Table 1: treasury_multisig_transactions**
```sql
CREATE TABLE treasury_multisig_transactions (
  id BIGSERIAL PRIMARY KEY,
  dao_id VARCHAR(255) NOT NULL,
  transaction_id BIGINT UNIQUE NOT NULL,
  proposer_address VARCHAR(42) NOT NULL,
  recipient_address VARCHAR(42) NOT NULL,
  amount NUMERIC(30,6) NOT NULL,
  token_address VARCHAR(42),
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, executed, rejected
  approval_count SMALLINT DEFAULT 0,
  required_approvals SMALLINT DEFAULT 2,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  timelock_until TIMESTAMP,
  executed_at TIMESTAMP,
  tx_hash VARCHAR(66),
  block_number BIGINT,
  
  UNIQUE(dao_id, transaction_id),
  INDEX idx_dao_id (dao_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

CREATE TABLE treasury_multisig_approvals (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL,
  signer_address VARCHAR(42) NOT NULL,
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(transaction_id, signer_address),
  FOREIGN KEY (transaction_id) REFERENCES treasury_multisig_transactions(transaction_id),
  INDEX idx_signer (signer_address)
);
```

**Create Table 2: audit_logs**
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  dao_id VARCHAR(255) NOT NULL,
  actor_address VARCHAR(42) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  description TEXT,
  data JSONB,
  block_number BIGINT,
  tx_hash VARCHAR(66),
  ipfs_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_dao_id (dao_id),
  INDEX idx_actor (actor_address),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at),
  INDEX idx_dao_action (dao_id, action_type)
);
```

**Create Table 3: voting_snapshots**
```sql
CREATE TABLE voting_snapshots (
  id BIGSERIAL PRIMARY KEY,
  proposal_id BIGINT UNIQUE NOT NULL,
  dao_id VARCHAR(255) NOT NULL,
  snapshot_block BIGINT NOT NULL,
  token_address VARCHAR(42),
  total_voting_power NUMERIC(30,6),
  votes_for NUMERIC(30,6) DEFAULT 0,
  votes_against NUMERIC(30,6) DEFAULT 0,
  votes_abstain NUMERIC(30,6) DEFAULT 0,
  quorum_percentage SMALLINT DEFAULT 50,
  quorum_met BOOLEAN DEFAULT FALSE,
  passed BOOLEAN,
  status VARCHAR(20) DEFAULT 'active', -- active, closed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  
  INDEX idx_dao_id (dao_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

CREATE TABLE voting_members (
  id BIGSERIAL PRIMARY KEY,
  proposal_id BIGINT NOT NULL,
  member_address VARCHAR(42) NOT NULL,
  voting_power NUMERIC(30,6),
  vote_choice VARCHAR(50), -- 'for', 'against', 'abstain'
  voted_at TIMESTAMP,
  
  UNIQUE(proposal_id, member_address),
  FOREIGN KEY (proposal_id) REFERENCES voting_snapshots(proposal_id),
  INDEX idx_member (member_address)
);
```

**Run migration:**
```bash
npm run migrate

# Expected output:
# Migration 003_treasury_multisig.sql: SUCCESS
# Tables created: 4
# Indices created: 12
```

### Day 10-11: Frontend Contract Components

#### Create contract interaction client
```bash
touch client/src/api/multisigAPI.ts
```

**Create API client (similar to treasuryAPI.ts)**
- [ ] Implement functions:
  - [ ] `proposeTransaction(daoId, recipient, amount, token, description)`
  - [ ] `approveTransaction(daoId, transactionId, signature)`
  - [ ] `executeTransaction(daoId, transactionId)`
  - [ ] `getTransactions(daoId, status)`
  - [ ] `getAuditLog(daoId, offset, limit)`
  - [ ] `getWhitelistRecipients(daoId)`

#### Create React component
```bash
touch client/src/components/MultisigApprovals.tsx
```

**Component features:**
- [ ] Display pending transactions
- [ ] Show approval progress (1/2, 2/2)
- [ ] Countdown timer for timelock
- [ ] Approve button (with signature flow)
- [ ] Execute button (permissionless, once 2 approvals)
- [ ] View audit trail
- [ ] Real-time status updates

**Integration into DAO Settings:**
- [ ] Add "Multisig Approvals" as Tab 8 in DAO Settings
- [ ] Role-based: admin/creator can see + approve, elder/member read-only
- [ ] Show notification when action is ready to execute

### Day 11-13: Testing & QA

#### Core Flows to Test

**Flow 1: Happy Path (Successful Execution)**
- [ ] Step 1: Admin proposes transfer of 50k USDC to treasury wallet
  - [ ] API: POST /treasury/{daoId}/transactions/propose
  - [ ] Expected: Transaction created, status='pending'
  - [ ] Verify: Transaction ID returned, audit log entry created
  
- [ ] Step 2: Wait for timelock (48 hours)
  - [ ] In testing: Use hardhat time manipulation to skip ahead
  - [ ] Command: `npx hardhat time increase 48 hours`
  
- [ ] Step 3: Signer 1 approves transaction
  - [ ] API: POST /treasury/{daoId}/transactions/{id}/approve
  - [ ] Expected: Approval recorded, status still='pending', approvalCount=1/2
  - [ ] Verify: Audit log shows 'TransactionApproved'
  
- [ ] Step 4: Signer 2 approves transaction
  - [ ] API: POST /treasury/{daoId}/transactions/{id}/approve
  - [ ] Expected: Approval recorded, status='approved', approvalCount=2/2
  - [ ] Verify: Transaction is now executable
  
- [ ] Step 5: Anyone executes transaction
  - [ ] API: POST /treasury/{daoId}/transactions/{id}/execute
  - [ ] Expected: status='executed', funds transferred
  - [ ] Verify: recipient_address balance increased by 50k USDC

- [ ] Step 6: Audit trail complete
  - [ ] API: GET /treasury/{daoId}/audit-log
  - [ ] Expected: 3 entries (Proposed, Approved×2, Executed)
  - [ ] Verify: Timestamps, actors, action types correct

**Flow 2: Rejection Path**
- [ ] Signer 1 approves, Signer 2 rejects
  - [ ] API: POST /treasury/{daoId}/transactions/{id}/reject
  - [ ] Expected: status='rejected', cannot execute anymore
  
- [ ] Verify audit log shows 'TransactionRejected'

**Flow 3: Security Violations**
- [ ] Attempt transfer > 5% treasury → REJECTED
- [ ] Attempt transfer to non-whitelisted recipient → REJECTED
- [ ] Attempt to execute before timelock → REJECTED
- [ ] Attempt to execute with only 1 approval → REJECTED
- [ ] Verify all violations logged in audit trail

**Performance Testing**
- [ ] Measure gas usage (should be <200k)
- [ ] Measure API response time (<500ms)
- [ ] Load test: 100 concurrent proposals → all handled
- [ ] Database query: 10k audit entries with pagination → <100ms

#### Test Execution
```bash
# Run all tests
npm run test:e2e:phase3

# Expected output:
# Phase 3 E2E Tests
# ✓ Happy path: Propose → Timeout → Approve → Execute
# ✓ Rejection: Signer 1 approves, Signer 2 rejects
# ✓ Security: Non-whitelisted recipient rejected
# ✓ Security: Transfer > 5% rejected
# ✓ Performance: Gas usage < 200k
# 
# 5/5 tests passing ✓
```

### Day 13-14: Production Deployment & Monitoring

#### Pre-Deployment Checklist
- [ ] Security audit passed (internal)
- [ ] All 40+ tests passing
- [ ] Gas usage optimized
- [ ] Contracts deployed to testnet
- [ ] Integration tests passed
- [ ] Database migrations tested
- [ ] API endpoints verified
- [ ] Frontend components integrated

#### Mainnet Deployment
```bash
# Step 1: Deploy contracts to mainnet
npx hardhat run scripts/deploy-multisig-treasury.ts --network mainnet

# Step 2: Verify on Etherscan
npx hardhat verify --network mainnet <ADDRESS> <ARGS>

# Step 3: Initialize signers & recipients
npx hardhat run scripts/initialize-multisig.ts --network mainnet

# Step 4: Set contract addresses in backend
echo "MAINNET_MULTISIG_TREASURY=0x..." >> .env.mainnet
echo "MAINNET_AUDIT_LOG=0x..." >> .env.mainnet

# Step 5: Run database migrations
npm run migrate -- --env mainnet

# Step 6: Deploy backend (if containerized)
docker build -t mtaa-dao-backend:phase3 .
docker push mtaa-dao-backend:phase3
kubectl set image deployment/mtaa-backend mtaa-backend=mtaa-dao-backend:phase3

# Step 7: Deploy frontend
npm run build
deploy/frontend
```

#### Monitoring Setup
- [ ] Create Datadog dashboard for:
  - [ ] Proposal creation rate
  - [ ] Approval success rate
  - [ ] Average execution time
  - [ ] Gas usage per transaction
  - [ ] Audit log entry count
  
- [ ] Set up alerts for:
  - [ ] Failed proposals (5+ in 1 hour)
  - [ ] Rejected signatures (5+ in 1 hour)
  - [ ] High gas usage (>250k)
  - [ ] Database query latency (>1s)

#### Verification Tests (Post-Deploy)
- [ ] Create test proposal on mainnet
- [ ] Verify all 3 signers can approve
- [ ] Verify audit log records everything
- [ ] Test receiving transaction notifications
- [ ] Confirm gas costs match estimates

---

## COMPLETION CRITERIA

### Code Quality
- [x] 3 smart contracts deployed (MultiSigTreasury, AuditLog, GovernanceSnapshot)
- [ ] 40+ tests passing with 85%+ code coverage
- [ ] 4 API endpoints implemented and verified
- [ ] 3 database tables created with proper indices
- [ ] Zero compilation errors (Solidity 0.8.20)
- [ ] Zero security warnings from SlitherAI

### Security
- [ ] Internal security audit passed
- [ ] All 6 vulnerabilities from Phase 2 audit addressed
- [ ] Multisig: 100% of transfers require 2/3 approvals
- [ ] Timelock: 100% of transfers wait 48 hours
- [ ] Whitelist: 100% of transfers to whitelisted only
- [ ] Audit logs: 100% of actions recorded
- [ ] No reentrancy vulnerabilities
- [ ] No integer overflow/underflow

### Performance
- [ ] Gas per transaction: <200k (target: <150k)
- [ ] API response time: <500ms (target: <200ms)
- [ ] Database query: <100ms (target: <50ms)
- [ ] Uptime: 99.9%

### Documentation
- [ ] Code comments on all complex functions ✓ (in contracts)
- [ ] README with setup instructions
- [ ] API documentation (Swagger)
- [ ] Deployment runbook
- [ ] Troubleshooting guide

### Acceptance Tests
- [ ] Scenario 1: Happy path ✓ (propose→timeout→2 approvals→execute)
- [ ] Scenario 2: Rejection ✓ (one signer rejects)
- [ ] Scenario 3: Timeout enforcement ✓ (cannot execute before 48h)
- [ ] Scenario 4: Whitelist enforcement ✓ (non-whitelisted rejected)
- [ ] Scenario 5: Amount limit enforcement ✓ (>5% rejected)
- [ ] Scenario 6: Audit trail ✓ (all actions logged)

---

## SIGN-OFF

When all items are checked:
1. [ ] Create Git tag: `phase-3-complete-v1.0.0`
2. [ ] Create release notes documenting all changes
3. [ ] Schedule post-launch monitoring call
4. [ ] Begin Phase 4 planning (Governance Enhancements)

**Status:** 🔄 IN PROGRESS  
**Started:** [DATE]  
**Expected Completion:** 7-14 days  
**Actual Completion:** [TBD]

