/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MULTISIG END-TO-END INTEGRATION GUIDE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Complete wiring of multisig treasury approval workflow from user action
 * through database, on-chain contract, and back to Okedi surface.
 * 
 * Pattern: STATE → SYSTEM → SURFACE (per Cartographer architecture)
 */

// ════════════════════════════════════════════════════════════════════════════════
// 1. STATE LAYER (Database & On-Chain)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Database Schema (Drizzle ORM)
 * 
 * multisig_wallets:
 *   - id UUID PRIMARY KEY
 *   - dao_id UUID REFERENCES daos(id)
 *   - multisig_address VARCHAR (on-chain contract address)
 *   - signers TEXT[] (array of signer addresses)
 *   - required_signatures INT
 *   - chain_id INT (44787 Celo testnet, 42220 mainnet)
 *   - status VARCHAR ('pending', 'deployed', 'simulation', 'disabled')
 *   - created_by UUID REFERENCES users(id)
 *   - created_at TIMESTAMP
 *   - updated_at TIMESTAMP
 * 
 * multisig_approvals:
 *   - id UUID PRIMARY KEY
 *   - dao_id UUID REFERENCES daos(id)
 *   - multisig_wallet_id UUID REFERENCES multisig_wallets(id)
 *   - proposal_id INT (on-chain proposal ID)
 *   - proposed_by UUID REFERENCES users(id)
 *   - recipient VARCHAR
 *   - amount DECIMAL (in cUSD)
 *   - purpose TEXT
 *   - required_signatures INT (copy from wallet config at time of proposal)
 *   - current_signatures INT (incrementing as signers approve)
 *   - status VARCHAR ('pending', 'approved', 'executed', 'rejected', 'expired')
 *   - timelock_expires_at TIMESTAMP (small_transfer_delay or large_transfer_delay)
 *   - transaction_hash VARCHAR (on-chain tx hash after execution)
 *   - created_at TIMESTAMP
 *   - expires_at TIMESTAMP (7 days from creation)
 *   - updated_at TIMESTAMP
 * 
 * multisig_signatures:
 *   - id UUID PRIMARY KEY
 *   - approval_id UUID REFERENCES multisig_approvals(id)
 *   - signer_user_id UUID REFERENCES users(id) (who signed)
 *   - signer_address VARCHAR (wallet address of signer)
 *   - signature_data VARCHAR (signed message for on-chain verification)
 *   - signed_at TIMESTAMP
 *   - comment TEXT (optional signer note)
 * 
 * On-Chain State (ChamaTreasury.sol):
 *   struct Proposal {
 *     uint proposalId;
 *     address proposer;
 *     address recipient;
 *     uint amount;
 *     ProposalStatus status;
 *     uint confirmations;
 *     uint createdAt;
 *     uint executeAfter (timelock)
 *   }
 * 
 * Event stream:
 *   - ProposalCreated(proposalId, proposer, recipient, amount)
 *   - ProposalConfirmed(proposalId, signer, confirmationCount)
 *   - ProposalExecuted(proposalId, txHash)
 */

// ════════════════════════════════════════════════════════════════════════════════
// 2. SYSTEM LAYER (Backend API Routes & Business Logic)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Backend Route: server/routes/v1/daos/_daoId/treasury/multisig-unified.ts
 * 
 * Endpoints & Auth Chain:
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ POST /v1/daos/:daoId/treasury/multisig/create                  │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Guards: authenticate → daoMembershipGuard → treasuryAdminGuard  │
 * │ RateLimit: 5 per 1hour (treasury-multisig-create)              │
 * │ Audit: CRITICAL severity                                        │
 * │ Action:                                                          │
 * │   1. Validate signers (min 2)                                  │
 * │   2. Validate required_signatures (1 ≤ n ≤ signers.length)     │
 * │   3. Deploy ChamaTreasury on-chain or queue async              │
 * │   4. Insert multisig_wallets record                            │
 * │   5. Return multisigId, address, status                        │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ GET /v1/daos/:daoId/treasury/multisig/config                  │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Guards: authenticate → daoMembershipGuard                       │
 * │ RateLimit: 30 per 1min (treasury-multisig-config-get)          │
 * │ Action: Fetch multisig_wallets for daoId, return config        │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ POST /v1/daos/:daoId/treasury/multisig/propose                │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Guards: authenticate → daoMembershipGuard → treasuryAdminGuard  │
 * │ RateLimit: 10 per 1hour (treasury-multisig-propose)            │
 * │ Audit: HIGH severity                                            │
 * │ Action:                                                          │
 * │   1. Validate recipient, amount, purpose                       │
 * │   2. Call ChamaTreasury.createProposal() on-chain              │
 * │   3. Insert multisig_approvals record (status='pending')        │
 * │   4. Calculate timelock_expires_at based on tiered delays      │
 * │   5. Return approvalId, expiresAt, required_signatures         │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ GET /v1/daos/:daoId/treasury/multisig/approvals               │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Guards: authenticate → daoMembershipGuard                       │
 * │ RateLimit: 30 per 1min (treasury-multisig-approvals-list)      │
 * │ Query: status, limit, offset                                    │
 * │ Action: SELECT from multisig_approvals WHERE dao_id = :daoId  │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ POST /v1/daos/:daoId/treasury/multisig/:approvalId/sign      │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Guards: authenticate → daoMembershipGuard → treasuryAdminGuard  │
 * │ RateLimit: 20 per 5min (treasury-multisig-sign)               │
 * │ Audit: HIGH severity                                            │
 * │ Action:                                                          │
 * │   1. Fetch multisig_approvals record                           │
 * │   2. Verify signer is authorized (in multisig_wallets.signers) │
 * │   3. Verify not already signed by this signer                  │
 * │   4. Insert multisig_signatures record                         │
 * │   5. Increment current_signatures counter                      │
 * │   6. If current_signatures >= required_signatures:            │
 * │      - Update multisig_approvals.status = 'approved'           │
 * │   7. Return updated approval state                             │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ POST /v1/daos/:daoId/treasury/multisig/:approvalId/execute    │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Guards: authenticate → daoMembershipGuard → treasuryAdminGuard  │
 * │ RateLimit: 10 per 1hour (treasury-multisig-execute)           │
 * │ Audit: CRITICAL severity                                        │
 * │ Preconditions:                                                  │
 * │   - current_signatures >= required_signatures                   │
 * │   - NOW() >= timelock_expires_at                                │
 * │   - status = 'approved' (not already executed)                 │
 * │ Action:                                                          │
 * │   1. Call ChamaTreasury.executeProposal() on-chain             │
 * │   2. Get transaction hash from on-chain receipt                │
 * │   3. Update multisig_approvals.status = 'executed'             │
 * │   4. Update multisig_approvals.transaction_hash = txHash       │
 * │   5. Call TreasuryService.recordWithdrawal() to sync DB        │
 * │   6. Return txHash, new treasury balance                       │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ GET /v1/daos/:daoId/treasury/multisig/signers                 │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Guards: authenticate → daoMembershipGuard                       │
 * │ RateLimit: 30 per 1min (treasury-multisig-signers-get)        │
 * │ Action: SELECT from multisig_wallets, join with users for names│
 * └─────────────────────────────────────────────────────────────────┘
 */

// ════════════════════════════════════════════════════════════════════════════════
// 3. SURFACE LAYER (Frontend Components & User Interactions)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Frontend Component: client/src/components/treasury/UnifiedMultisigFlow.tsx
 * 
 * UI Surfaces:
 * 
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ Okedi Treasury Workspace                                          │
 * ├──────────────────────────────────────────────────────────────────┤
 * │                                                                   │
 * │  [Overview] [Approvals] [Signers] [Create]  ← Tab Navigation   │
 * │                                                                   │
 * │  Overview Tab:                                                   │
 * │  ├─ Total Signers: 3                                            │
 * │  ├─ Pending Approvals: 2                                        │
 * │  └─ [Create Multisig]  [Propose Transfer]  ← Admin Only        │
 * │                                                                   │
 * │  Approvals Tab:                                                  │
 * │  ├─ List of pending/approved/executed approvals                 │
 * │  ├─ Each card shows:                                            │
 * │  │  - Purpose, Recipient, Amount, Status                       │
 * │  │  - Signatures: X of Y                                       │
 * │  │  - [Sign] (if pending & user is signer)                    │
 * │  │  - [Execute] (if approved & user is signer)                │
 * │  │  - [Details]                                               │
 * │  │                                                              │
 * │  Signers Tab:                                                   │
 * │  ├─ List of authorized signers                                 │
 * │  ├─ Each row shows: Name, Address, Role, Approval Count       │
 * │  │                                                              │
 * │  Create Tab:                                                    │
 * │  └─ [Open Multisig Wizard] ← Launch MultisigWizard.tsx        │
 * │                                                                   │
 * │  Modals:                                                         │
 * │  ├─ Create Multisig Dialog:                                    │
 * │  │  - Add signers (min 2)                                     │
 * │  │  - Set required signatures                                 │
 * │  │  - Simulation mode checkbox                                │
 * │  │  - [Create] button triggers POST /multisig/create          │
 * │  │                                                              │
 * │  └─ Propose Transfer Dialog:                                   │
 * │     - Recipient address                                        │
 * │     - Amount (cUSD)                                            │
 * │     - Purpose (audit trail)                                    │
 * │     - [Propose] button triggers POST /multisig/propose         │
 * │                                                                   │
 * └──────────────────────────────────────────────────────────────────┘
 * 
 * Client API: client/src/api/multisigTreasuryAPI.ts
 * 
 * MultisigTreasuryAPI Methods:
 *   - createMultisig(daoId, request) → POST /v1/daos/:daoId/treasury/multisig/create
 *   - getConfig(daoId) → GET /v1/daos/:daoId/treasury/multisig/config
 *   - proposeTransfer(daoId, request) → POST /v1/daos/:daoId/treasury/multisig/propose
 *   - getApprovals(daoId, status?, limit?, offset?) → GET /v1/daos/:daoId/treasury/multisig/approvals
 *   - signApproval(daoId, approvalId, comment?) → POST /v1/daos/:daoId/treasury/multisig/:approvalId/sign
 *   - executeApproval(daoId, approvalId) → POST /v1/daos/:daoId/treasury/multisig/:approvalId/execute
 *   - getSigners(daoId) → GET /v1/daos/:daoId/treasury/multisig/signers
 */

// ════════════════════════════════════════════════════════════════════════════════
// 4. END-TO-END USER FLOW
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Scenario: Admin creates DAO, sets up multisig, proposes withdrawal
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 1: Admin navigates to Okedi Treasury Workspace            │
 * │ URL: /okedi/daos/:daoId/treasury/multisig                      │
 * │                                                                  │
 * │ Frontend:                                                        │
 * │   1. Load UnifiedMultisigFlow component                         │
 * │   2. Call multisigTreasuryAPI.getApprovals(daoId)              │
 * │   3. Call multisigTreasuryAPI.getSigners(daoId)                │
 * │   4. Render Overview tab with [Create Multisig] button         │
 * │   5. Verify user is admin (session + daoMembershipGuard)       │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 2: Admin clicks [Create Multisig]                         │
 * │                                                                  │
 * │ Frontend:                                                        │
 * │   1. Open "Create Multisig Wallet" dialog                      │
 * │   2. Admin adds 3 signers:                                     │
 * │      - alice@chama.local                                       │
 * │      - bob@chama.local                                         │
 * │      - carol@chama.local                                       │
 * │   3. Set required_signatures = 2                               │
 * │   4. Click [Create]                                            │
 * │                                                                  │
 * │ Client API Call:                                                │
 * │   POST /v1/daos/:daoId/treasury/multisig/create                │
 * │   Body: {                                                        │
 * │     signers: ["alice@...", "bob@...", "carol@..."],           │
 * │     requiredSignatures: 2,                                      │
 * │     simulation: false                                           │
 * │   }                                                              │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 3: Backend processes multisig creation                    │
 * │                                                                  │
 * │ Guard Chain:                                                     │
 * │   1. authenticate: User session valid? ✓                       │
 * │   2. daoMembershipGuard: User member of DAO? ✓                │
 * │   3. treasuryAdminGuard: User role in ['admin','elder']? ✓    │
 * │   4. sessionValidation: Session active? ✓                      │
 * │                                                                  │
 * │ RateLimit: treasury-multisig-create (5 per 1hour) ✓            │
 * │                                                                  │
 * │ Business Logic:                                                  │
 * │   1. Validate signers (count >= 2) ✓                          │
 * │   2. Validate requiredSignatures (1 ≤ n ≤ 3) ✓                │
 * │   3. Deploy ChamaTreasury contract on-chain:                  │
 * │      - Call ethers.ChamaTreasuryFactory.deploy()              │
 * │      - Get multisigAddress = 0xABC123...                      │
 * │      - Set mode = LEDGER_ONLY (start conservative)            │
 * │   4. Audit Log (CRITICAL):                                     │
 * │      {                                                           │
 * │        dao_id: ":daoId",                                       │
 * │        user_id: "user-123",                                    │
 * │        action: "multisig_create_initiated",                    │
 * │        severity: "critical",                                   │
 * │        details: { signerCount: 3, requiredSignatures: 2, ... } │
 * │      }                                                           │
 * │   5. Insert multisig_wallets:                                  │
 * │      {                                                           │
 * │        id: UUID,                                               │
 * │        dao_id: ":daoId",                                       │
 * │        multisig_address: "0xABC123...",                        │
 * │        signers: ["alice@...", "bob@...", "carol@..."],        │
 * │        required_signatures: 2,                                 │
 * │        chain_id: 44787,                                        │
 * │        status: "deployed",                                     │
 * │        created_by: "user-123",                                 │
 * │        created_at: NOW(),                                      │
 * │      }                                                           │
 * │                                                                  │
 * │ Response to Frontend:                                            │
 * │   {                                                              │
 * │     success: true,                                              │
 * │     multisigId: "ms-1234567890",                               │
 * │     multisigAddress: "0xABC123...",                            │
 * │     signers: ["alice@...", "bob@...", "carol@..."],           │
 * │     requiredSignatures: 2,                                     │
 * │     chainId: 44787,                                            │
 * │     status: "deployed",                                        │
 * │     createdAt: "2024-01-15T10:30:00Z",                         │
 * │     createdBy: "user-123"                                      │
 * │   }                                                              │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 4: Frontend shows success & reloads data                  │
 * │                                                                  │
 * │ Frontend:                                                        │
 * │   1. Show toast: "Multisig created: 0xABC123..."              │
 * │   2. Close modal                                               │
 * │   3. Call loadData() again:                                    │
 * │      - getApprovals(daoId)                                    │
 * │      - getSigners(daoId)                                      │
 * │   4. Update state with new signers list                        │
 * │   5. Render Signers tab showing 3 signers                      │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 5: Admin clicks [Propose Transfer]                        │
 * │                                                                  │
 * │ Frontend:                                                        │
 * │   1. Open "Propose Transfer" dialog                            │
 * │   2. Admin enters:                                             │
 * │      - Recipient: "0x999..." (external wallet)                │
 * │      - Amount: "5000" (cUSD)                                   │
 * │      - Purpose: "Payment for agricultural supplies"            │
 * │   3. Click [Propose]                                           │
 * │                                                                  │
 * │ Client API Call:                                                │
 * │   POST /v1/daos/:daoId/treasury/multisig/propose               │
 * │   Body: {                                                        │
 * │     recipient: "0x999...",                                     │
 * │     amount: "5000",                                            │
 * │     purpose: "Payment for agricultural supplies"               │
 * │   }                                                              │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 6: Backend processes proposal                             │
 * │                                                                  │
 * │ Guard Chain: authenticate → daoMembershipGuard → treasuryAdminGuard │
 * │ RateLimit: treasury-multisig-propose (10 per 1hour)            │
 * │                                                                  │
 * │ Business Logic:                                                  │
 * │   1. Validate recipient, amount, purpose ✓                     │
 * │   2. Call ChamaTreasury.proposeWithdrawal() on-chain:         │
 * │      - proposalId (on-chain) = 1                              │
 * │      - Event emitted: ProposalCreated(1, admin, 0x999, 5000)  │
 * │   3. Audit Log (HIGH):                                         │
 * │      {                                                           │
 * │        action: "multisig_proposal_created",                    │
 * │        severity: "high",                                       │
 * │        details: { recipient: "0x999...", amount: "5000", ... } │
 * │      }                                                           │
 * │   4. Calculate timelock:                                        │
 * │      - amount >= largeTreshold (e.g., 1000 cUSD)?             │
 * │        NO → smallTransferDelay = 1 hour                       │
 * │      - timelock_expires_at = NOW() + 1 hour                   │
 * │   5. Insert multisig_approvals:                                │
 * │      {                                                           │
 * │        id: UUID,                                               │
 * │        dao_id: ":daoId",                                       │
 * │        multisig_wallet_id: "...",                             │
 * │        proposal_id: 1,                                         │
 * │        proposed_by: "user-123",                                │
 * │        recipient: "0x999...",                                  │
 * │        amount: "5000",                                         │
 * │        purpose: "Payment for agricultural supplies",           │
 * │        required_signatures: 2,                                 │
 * │        current_signatures: 0,                                  │
 * │        status: "pending",                                      │
 * │        timelock_expires_at: NOW() + 1 hour,                   │
 * │        expires_at: NOW() + 7 days,                             │
 * │        created_at: NOW()                                       │
 * │      }                                                           │
 * │                                                                  │
 * │ Response to Frontend:                                            │
 * │   {                                                              │
 * │     success: true,                                              │
 * │     approvalId: "approval-uuid",                               │
 * │     status: "pending",                                         │
 * │     recipient: "0x999...",                                     │
 * │     amount: "5000",                                            │
 * │     purpose: "Payment for agricultural supplies",              │
 * │     requiredSignatures: 2,                                     │
 * │     currentSignatures: 0,                                      │
 * │     expiresAt: "2024-01-15T17:30:00Z",                         │
 * │     createdAt: "2024-01-15T10:30:00Z"                          │
 * │   }                                                              │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 7: Frontend shows approval & signers sign                 │
 * │                                                                  │
 * │ Frontend:                                                        │
 * │   1. Show toast: "Transfer proposal created"                   │
 * │   2. Close modal                                               │
 * │   3. Reload approvals list                                     │
 * │   4. Show in Approvals tab:                                    │
 * │      ┌────────────────────────────┐                           │
 * │      │ Purpose: Payment for ag...  │                          │
 * │      │ To: 0x999...                │                          │
 * │      │ Amount: 5000 cUSD           │                          │
 * │      │ Status: [pending]           │                          │
 * │      │ Signatures: 0 of 2          │                          │
 * │      │ [Sign]  [Details]           │                          │
 * │      └────────────────────────────┘                           │
 * │                                                                  │
 * │   5. alice@chama navigates to Okedi Treasury                  │
 * │   6. Sees pending approval                                     │
 * │   7. Clicks [Sign]                                             │
 * │                                                                  │
 * │ Client API Call (Alice signing):                               │
 * │   POST /v1/daos/:daoId/treasury/multisig/approval-uuid/sign   │
 * │   Body: { comment: "Approved - agricultural supplies needed" } │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 8: Backend processes first signature                      │
 * │                                                                  │
 * │ Guard Chain: authenticate → daoMembershipGuard → treasuryAdminGuard │
 * │ RateLimit: treasury-multisig-sign (20 per 5min)               │
 * │                                                                  │
 * │ Business Logic:                                                  │
 * │   1. Fetch multisig_approvals WHERE id = "approval-uuid"      │
 * │   2. Verify alice is in signers list ✓                        │
 * │   3. Verify alice hasn't already signed ✓                     │
 * │   4. Audit Log (HIGH):                                         │
 * │      { action: "multisig_signed", severity: "high", ... }     │
 * │   5. Insert multisig_signatures:                              │
 * │      {                                                           │
 * │        id: UUID,                                               │
 * │        approval_id: "approval-uuid",                           │
 * │        signer_user_id: "alice-user-id",                       │
 * │        signer_address: "alice@chama.local",                   │
 * │        signature_data: "...",                                  │
 * │        signed_at: NOW(),                                       │
 * │        comment: "Approved - agricultural supplies needed"      │
 * │      }                                                           │
 * │   6. UPDATE multisig_approvals:                                │
 * │      - current_signatures = 1                                 │
 * │      - status = "pending" (still need 1 more)                 │
 * │                                                                  │
 * │ Response to Frontend:                                            │
 * │   {                                                              │
 * │     success: true,                                              │
 * │     approvalId: "approval-uuid",                               │
 * │     status: "pending",                                         │
 * │     requiredSignatures: 2,                                     │
 * │     currentSignatures: 1,                                      │
 * │     message: "Signature recorded (1 of 2 required)"            │
 * │   }                                                              │
 * │                                                                  │
 * │   Frontend: Show toast "Signature recorded (1 of 2 required)"  │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 9: Bob signs (second signature)                           │
 * │                                                                  │
 * │ bob@chama navigates to Okedi Treasury                          │
 * │ bob sees pending approval                                      │
 * │ bob clicks [Sign]                                              │
 * │                                                                  │
 * │ Same flow as Alice, but now:                                   │
 * │   - current_signatures = 2 (threshold reached!)                │
 * │   - status = "approved"                                        │
 * │   - Response includes: "status: 'approved'"                    │
 * │                                                                  │
 * │ Frontend:                                                        │
 * │   1. Show toast "Signature recorded (2 of 2 required)"         │
 * │   2. Reload approvals                                          │
 * │   3. Card now shows status [approved] instead of [pending]    │
 * │   4. Show [Execute] button instead of [Sign]                  │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 10: Admin waits for timelock, then executes               │
 * │                                                                  │
 * │ Backend: Timelock expired check:                                │
 * │   - approval.timelock_expires_at = NOW() + 1 hour            │
 * │   - NOW() >= approval.timelock_expires_at? → After 1 hour    │
 * │                                                                  │
 * │ Frontend:                                                        │
 * │   1. Admin sees [Execute] button enabled (after 1 hour)       │
 * │   2. Clicks [Execute]                                          │
 * │                                                                  │
 * │ Client API Call:                                                │
 * │   POST /v1/daos/:daoId/treasury/multisig/approval-uuid/execute │
 * │   Body: {}                                                       │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 11: Backend executes on-chain                             │
 * │                                                                  │
 * │ Guard Chain: authenticate → daoMembershipGuard → treasuryAdminGuard │
 * │ RateLimit: treasury-multisig-execute (10 per 1hour)           │
 * │                                                                  │
 * │ Business Logic:                                                  │
 * │   1. Fetch multisig_approvals WHERE id = "approval-uuid"      │
 * │   2. Validate preconditions:                                   │
 * │      - current_signatures >= required_signatures? ✓ (2 >= 2)   │
 * │      - NOW() >= timelock_expires_at? ✓ (after 1 hour)        │
 * │      - status = 'approved'? ✓                                  │
 * │   3. Call ChamaTreasury.executeProposal(proposalId=1):        │
 * │      - On-chain checks:                                        │
 * │        * enough balance? ✓                                     │
 * │        * valid recipient? ✓                                    │
 * │      - Transfer 5000 cUSD to 0x999...                         │
 * │      - Event emitted: ProposalExecuted(1, 0xTXHASH...)        │
 * │   4. Audit Log (CRITICAL):                                     │
 * │      { action: "multisig_executed", severity: "critical", ... } │
 * │   5. UPDATE multisig_approvals:                                │
 * │      - status = "executed"                                    │
 * │      - transaction_hash = "0xTXHASH..."                       │
 * │   6. Call TreasuryService.recordWithdrawal():                 │
 * │      - Decrement treasury balance in DB                       │
 * │      - Record to transaction history                          │
 * │                                                                  │
 * │ Response to Frontend:                                            │
 * │   {                                                              │
 * │     success: true,                                              │
 * │     approvalId: "approval-uuid",                               │
 * │     status: "executed",                                        │
 * │     transactionHash: "0xTXHASH...",                            │
 * │     newBalance: "95000.00",                                    │
 * │     executedAt: "2024-01-15T11:35:00Z"                         │
 * │   }                                                              │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │ STEP 12: Frontend displays result                              │
 * │                                                                  │
 * │ Frontend:                                                        │
 * │   1. Show toast "Approval executed"                            │
 * │   2. Reload approvals                                          │
 * │   3. Card now shows:                                           │
 * │      ┌────────────────────────────────┐                       │
 * │      │ Purpose: Payment for ag...      │                      │
 * │      │ To: 0x999...                    │                      │
 * │      │ Amount: 5000 cUSD               │                      │
 * │      │ Status: [executed]              │                      │
 * │      │ TxHash: 0xTXHASH...             │                      │
 * │      │ [View on Explorer]              │                      │
 * │      └────────────────────────────────┘                       │
 * │                                                                  │
 * │ ✅ WORKFLOW COMPLETE!                                          │
 * │    - Multisig created with 3 signers, 2-of-3 threshold        │
 * │    - Withdrawal proposed (5000 cUSD)                          │
 * │    - Signed by Alice & Bob                                    │
 * │    - Executed after 1-hour timelock                           │
 * │    - Transfer confirmed on-chain                              │
 * │    - Audit trail logged (CRITICAL severity events)            │
 * └────────────────────────────────────────────────────────────────┘
 */

// ════════════════════════════════════════════════════════════════════════════════
// 5. INTEGRATION CHECKLIST
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Backend Implementation TODO:
 * 
 * ☐ Create multisig_wallets table (Drizzle schema + migration) --already there but should match
 * ☐ Create multisig_approvals table -- create if not there
 * ☐ Create multisig_signatures table -- there but should match
 * ☐ Register /v1/daos/:daoId/treasury/multisig router in main app
 * ☐ Implement daoMembershipGuard middleware -- done
 * ☐ Implement treasuryAdminGuard middleware -- done
 * ☐ Implement sessionValidation middleware -- done
 * ☐ Integrate ethers.js for ChamaTreasury contract calls
 * ☐ Implement contract event listener & DB indexing 
 * ☐ Add rate limiting keys to rate-limit config
 * ☐ Add audit logging to all multisig endpoints
 * ☐ Write unit tests for each endpoint
 * ☐ Write integration tests for full workflow
 * 
 * Frontend Implementation TODO:
 * 
 * ☐ Create UnifiedMultisigFlow component (DONE)
 * ☐ Create multisigTreasuryAPI client (DONE)
 * ☐ Add /okedi/daos/:daoId/treasury/multisig route
 * ☐ Integrate into OkediDashboard quick actions
 * ☐ Add Okedi Treasury workspace surface
 * ☐ Add error handling for auth failures
 * ☐ Add confirmation dialogs for sign/execute
 * ☐ Add real-time updates via websocket
 * ☐ Write Cypress E2E tests for full flow
 * ☐ Add tooltips/help text for advanced users
 * 
 * Contract Integration TODO:
 * 
 * ☐ Deploy ChamaTreasury on Celo testnet (44787)
 * ☐ Deploy ChamaTreasury on Celo mainnet (42220)
 * ☐ Create contract event listener (ProposalCreated, etc.)
 * ☐ Store event logs in multisig_approvals for audit
 * ☐ Test tiered timelocks (smallTransferDelay, largeTransferDelay)
 * ☐ Test dual mode (LEDGER_ONLY → LIVE_VAULT)
 * 
 * DevOps / Deployment TODO:
 * 
 * ☐ Add .env vars for contract addresses
 * ☐ Add .env var for chainId (testnet vs mainnet)
 * ☐ Add .env var for rate limit thresholds
 * ☐ Update Docker images if needed
 * ☐ Deploy to staging
 * ☐ Run smoke tests
 * ☐ Deploy to production
 */

// ════════════════════════════════════════════════════════════════════════════════
// 6. REFERENCES & NEXT STEPS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Files Created/Updated:
 * 
 * Backend:
 *   - server/routes/v1/daos/_daoId/treasury/multisig-unified.ts (NEW)
 *     Complete router with 7 endpoints, proper auth & audit logging
 * 
 * Frontend:
 *   - client/src/api/multisigTreasuryAPI.ts (NEW)
 *     Full API client with type definitions
 *   - client/src/components/treasury/UnifiedMultisigFlow.tsx (NEW)
 *     Complete UI orchestrator (tabs, modals, handlers)
 * 
 * Documentation:
 *   - docs/multisig-integration-guide.md (THIS FILE)
 *     Complete end-to-end wiring guide
 * 
 * Next Priority Tasks (from todo list):
 *   1. Wire multisig backend to database tables
 *   2. Integrate contract calls (ethers.js)
 *   3. Wire frontend component into OkediDashboard
 *   4. Test end-to-end flow on testnet
 *   5. Wire P1 features (referral stats, DAO chat)
 */

export const MULTISIG_INTEGRATION_GUIDE = 'See docs for complete reference';
