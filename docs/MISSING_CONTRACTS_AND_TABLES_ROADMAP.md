# Missing Contracts & Database Tables - Implementation Roadmap

**Status:** ⏳ Must be created  
**Date:** April 29, 2026  
**Priority:** HIGH - These gaps prevent core DAO functionality

---

## Missing Smart Contracts (13 total)

### ROSC (Rotating Savings & Credit) DAO - Missing (2 Contracts)

#### 1. RotationModule.sol (NEW - CRITICAL)
**Purpose:** Handle rotation logic - determines order of member payouts

**Must Implement:**
```solidity
contract RotationModule {
  // Track rotation position
  struct RotationState {
    uint256 currentPosition;        // Who's up next (index 1-n)
    uint256 lastPayoutTime;         // When last payout occurred
    uint256 payoutAmount;           // Amount per payout
    RotationStatus status;          // WAITING, ACTIVE, COMPLETED
  }
  
  enum RotationStatus { WAITING, ACTIVE, COMPLETED, SKIPPED }
  
  // Core methods
  function advanceRotation() external;           // Move to next member
  function getCurrentPayee() public view returns (address);
  function calculatePayoutOrder(address[] calldata members) external;
  function getRotationSchedule() external view returns (RotationState[]);
  function skipMember(address member) external onlyLoanCommittee;
  function recordPayout(address member, uint256 amount) external;
}
```

**Key Features Needed:**
- Sequential access to vault funds (member A, then B, then C, repeat)
- Skip logic (member can postpone after taking first payout)
- Automatic advancement trigger (when payout claimed)
- Penalty integration (members with late payments skip turn)
- Event emission for transparency

**Integration Points:**
- Called by: `RotationService.ts` (weekly/monthly basis)
- Reads: `daoMemberships` table
- Writes: `vaultRotationSchedule` table + events

---

#### 2. MicroLoanFacility.sol (NEW - CRITICAL)
**Purpose:** Issue micro-loans within ROSC (loaned amount = guaranteed access to vault)

**Must Implement:**
```solidity
contract MicroLoanFacility is ReentrancyGuard {
  struct MicroLoan {
    uint256 loanId;
    address borrower;
    uint256 principal;              // Original loaned amount
    uint256 interestRate;           // 0-10% (basis points)
    uint256 maturityDate;           // When repayment due
    LoanStatus status;              // ACTIVE, REPAID, DEFAULTED
    uint256 guarantorCount;         // Number of guarantors (2 required)
    address[] guarantors;           // Who guaranteed the loan
  }
  
  enum LoanStatus { PENDING_APPROVAL, ACTIVE, REPAID, DEFAULTED, CANCELLED }
  
  // Core methods
  function requestLoan(uint256 amount, address[] calldata guarantors) external returns (uint256 loanId);
  function approveLoan(uint256 loanId) external onlyLoanCommittee;
  function rejectLoan(uint256 loanId) external onlyLoanCommittee;
  function repayLoan(uint256 loanId, uint256 amount) external;
  function recordDefault(uint256 loanId) external onlyGuarantor;
  function seizeFromGuarantor(uint256 loanId, address guarantor) external;
}
```

**Key Features Needed:**
- 2-of-2 guarantor requirement (social collateral)
- Interest calculation (0-10% annual)
- Automatic maturity date tracking
- Default handling (seize from guarantors)
- Access tracking (borrower gets vault access amount = principal)
- Event logging

**Integration Points:**
- Called by: `MicroLoanService.ts` + `LoanCommitteeVoting`
- Reads: `memberReputation`, `daoMemberships`
- Writes: `microLoans` table + events

---

### Women's Group DAO - Missing (1 Contract)

#### 3. LoanFacility.sol (NEW - HIGH PRIORITY)
**Purpose:** Emergency lending for women's group (collateral = guarantee of 2 community members)

**Must Implement:**
```solidity
contract LoanFacility is ReentrancyGuard {
  struct EmergencyLoan {
    uint256 loanId;
    address borrower;
    string purpose;                 // Why loan needed (health, housing, etc)
    uint256 principal;
    uint256 interestRate;           // 0-5% (lower than ROSC)
    uint256 gracePeriod;            // 30-90 days before first payment due
    LoanStatus status;
    address guarantor1;
    address guarantor2;             // Two community members vouch
    string escapeClause;            // Forgiveness conditions (widow, health crisis)
  }
  
  enum LoanStatus { PENDING_REVIEW, APPROVED, ACTIVE, REPAID, FORGIVEN, DEFAULTED }
  
  // Core methods
  function requestLoan(uint256 amount, string calldata purpose, address[] calldata guarantors) external;
  function reviewLoan(uint256 loanId, bool approve, string calldata reason) external onlyElders;
  function activateLoan(uint256 loanId) external;
  function checkEscapeClause(uint256 loanId) external returns (bool);
  function forgveLoan(uint256 loanId) external onlyElders;
  function repayLoan(uint256 loanId, uint256 amount) external;
}
```

**Key Features Needed:**
- 2-guarantor social collateral model
- Grace period (can't demand payment immediately)
- Escape clauses (widow, health emergency → forgiven)
- Elder override authority (can forgive loans)
- Lower interest (0-5% max) than ROSC (0-10%)
- Purpose tracking (for compliance)
- Event logging

**Integration Points:**
- Called by: `LoanService.ts` + `ElderVoting`
- Reads: `memberReputation`, `personaRoles` (elders)
- Writes: `memberLoans` table + events

---

### Bail Fund DAO - Missing (2 Contracts)

#### 4. EscrowOracle.sol ✅ ALREADY CREATED (Phase 2)
**Status:** Created April 27, 2026
**File:** `/contracts/EscrowOracle.sol` (450 lines)
**Purpose:** Verify defendants appeared in court (oracle-fed)

---

#### 5. BailForfeiture.sol (NEW - HIGH PRIORITY)
**Purpose:** Handle forfeited bail when defendant doesn't appear in court

**Must Implement:**
```solidity
contract BailForfeiture {
  struct ForfeitureCase {
    uint256 caseId;
    address defendant;
    uint256 bailAmount;
    uint256 forfeitureDate;
    ForfeitureStatus status;        // PENDING_CLAIM, WRITEOFF, RECOVERED
    uint256 writeoffAmount;         // Amount written off
    string courtOrderHash;          // IPFS hash of court order
  }
  
  enum ForfeitureStatus { PENDING_CLAIM, WRITEOFF_EXECUTED, PARTIAL_RECOVERY, FULL_RECOVERY }
  
  // Core methods
  function recordForfeiture(uint256 caseId, address defendant, uint256 amount) external onlyOracle;
  function processWriteoff(uint256 caseId, uint256 amount) external onlyTreasury;
  function recordRecovery(uint256 caseId, uint256 recoveredAmount) external;
  function getForfeitureStatus(uint256 caseId) external view returns (ForfeitureStatus);
  function getTotalWriteoffs() external view returns (uint256);
}
```

**Key Features Needed:**
- Forfeiture tracking (defendant didn't appear)
- Automatic writeoff to bail fund reserves
- Recovery tracking (if defendant later apprehended)
- Partial recovery support (payments over time)
- Court order documentation (IPFS)
- Treasury integration
- Event logging

**Integration Points:**
- Called by: `ForfeitureHandlingService.ts` + `EscrowOracle.sol`
- Reads: Oracle feed for court outcomes
- Writes: `forfeitureWriteoffs` table + treasury adjustments

---

### Meta DAO - Missing (3 Contracts) ✅ Partially CREATED

#### 6. ChildDAORegistry.sol ✅ ALREADY CREATED (Phase 2)
**Status:** Created April 27, 2026
**File:** `/contracts/ChildDAORegistry.sol` (520 lines)
**Purpose:** Register child DAOs in federation

---

#### 7. DisputeResolution.sol ✅ ALREADY CREATED (Phase 2)
**Status:** Created April 27, 2026
**File:** `/contracts/DisputeResolution.sol` (460 lines)
**Purpose:** Arbitration between meta DAO and children

---

#### 8. MetaGovernance.sol (NEW - MEDIUM PRIORITY)
**Purpose:** Cross-DAO voting (parent votes affect children, children vote on parent proposals)

**Must Implement:**
```solidity
contract MetaGovernance {
  struct CrossDAOProposal {
    uint256 proposalId;
    uint256 parentDAOId;
    uint256[] affectedChildDAOIds;  // Which children affected
    ProposalType proposalType;      // FEE_CHANGE, DIVIDEND, POLICY, etc
    uint256 parentVotes;            // Parent member votes
    uint256 childVotes;             // Aggregated child member votes (weighted)
    ExecutionStatus status;
  }
  
  enum ProposalType { FEE_CHANGE, DIVIDEND_DISTRIBUTION, POLICY_UPDATE, MEMBER_SUSPENSION, EXIT_REQUEST }
  enum ExecutionStatus { PENDING, PASSED, FAILED, EXECUTED }
  
  // Core methods
  function proposeToChildren(uint256 parentProposalId, uint256[] calldata childDAOIds) external;
  function voteAsChildDAO(uint256 proposalId, uint256 vote) external onlyChildDAOGov;
  function aggregateChildVotes(uint256 proposalId) external returns (uint256 totalVotes);
  function executeCrossDAOProposal(uint256 proposalId) external;
}
```

**Key Features Needed:**
- Parent votes on direct decisions
- Child DAO weighted voting (bigger = more weight)
- Quorum by number of children (>50%)
- Veto power (parent can veto, child can exit)
- Execution propagation (affects all children)
- Event logging

**Integration Points:**
- Called by: `Governance.sol` + `metaDaoService.ts`
- Reads: `daoMemberships`, child DAO vote records
- Writes: `metaGovernanceVotes` table

---

### Short-Term Project DAO - Missing (2 Contracts)

#### 9. MilestoneEscrow.sol (NEW - MEDIUM PRIORITY)
**Purpose:** Lock funds until project milestones reached

**Must Implement:**
```solidity
contract MilestoneEscrow is ReentrancyGuard {
  struct Milestone {
    uint256 milestoneId;
    string description;             // "Phase 1 complete", "Beta launch", etc
    uint256 deadline;               // When it should be done
    uint256 releaseAmount;          // How much unlocks
    MilestoneStatus status;         // PENDING, APPROVED, REJECTED, RELEASED
    bytes32 ipfsProof;              // IPFS hash (code commit, screenshot, etc)
  }
  
  enum MilestoneStatus { PENDING, VERIFIED, RELEASED, REJECTED, EXTENDED }
  
  // Core methods
  function addMilestone(string calldata description, uint256 deadline, uint256 amount) external onlyOwner;
  function submitProof(uint256 milestoneId, bytes32 ipfsHash) external onlyProjectLead;
  function verifyMilestone(uint256 milestoneId, bool approved) external onlyAdvisors;
  function releaseFunds(uint256 milestoneId) external;
  function extendDeadline(uint256 milestoneId, uint256 newDeadline) external onlyMembers;
}
```

**Key Features Needed:**
- Milestone tracking with deadlines
- IPFS proof submission (for verification)
- Advisor voting (multiple people verify)
- Progressive fund release (not all at once)
- Deadline extension voting
- Rejection handling (funds returned)
- Event logging

**Integration Points:**
- Called by: `ProjectManagementService.ts` + `AdvisorVoting`
- Reads: `projectMilestones` table
- Writes: `milestoneVerifications` table

---

#### 10. TaxComplianceRecorder.sol (NEW - LOW PRIORITY)
**Purpose:** Record capital gains/losses for formal project accounting

**Must Implement:**
```solidity
contract TaxComplianceRecorder {
  struct TaxEvent {
    uint256 eventId;
    address member;
    uint256 timestamp;
    string eventType;               // CAPITAL_GAIN, CAPITAL_LOSS, ORDINARY_INCOME
    uint256 amount;
    bytes32 documentHash;           // IPFS of supporting doc
  }
  
  // Core methods
  function recordCapitalGain(address member, uint256 amount, string calldata description) external;
  function recordCapitalLoss(address member, uint256 amount, string calldata description) external;
  function recordOrdinaryIncome(address member, uint256 amount, string calldata description) external;
  function getTaxEventsForMember(address member, uint256 year) external view returns (TaxEvent[]);
  function exportTax1099Form(address member, uint256 year) external returns (bytes);
}
```

**Key Features Needed:**
- Event logging for IRS compliance
- Capital gains vs losses tracking
- Ordinary income recording
- Document IPFS storage
- Annual report generation
- 1099 form export
- Event logging

**Integration Points:**
- Called by: `TaxReportingService.ts` (Phase 3)
- Reads: All transaction history
- Writes: `taxComplianceRecords` table

---

### Investment Club DAO - Missing (1 Contract)

#### 11. StrategyRegistry.sol (NEW - LOW PRIORITY)
**Purpose:** Register approved investment strategies & allocations

**Must Implement:**
```solidity
contract StrategyRegistry {
  struct Strategy {
    uint256 strategyId;
    string name;                    // "Aave USDC", "Lido stETH", etc
    address yieldProtocol;          // Contract address
    uint256 apy;                    // Current APY (in basis points)
    uint256 maxAllocation;          // Can't put >X% in one strategy
    StrategyStatus status;          // ACTIVE, DEPRECATED, PAUSED
    uint256 riskRating;             // 1-5 stars
  }
  
  enum StrategyStatus { ACTIVE, DEPRECATED, PAUSED, EXPERIMENTAL }
  
  // Core methods
  function addStrategy(string calldata name, address protocol, uint256 maxAllocation) external onlyGovernance;
  function updateStrategyAPY(uint256 strategyId, uint256 newAPY) external onlyOracle;
  function setMaxAllocation(uint256 strategyId, uint256 maxAllocationPercent) external onlyGovernance;
  function deprecateStrategy(uint256 strategyId) external onlyGovernance;
  function getApprovedStrategies() external view returns (Strategy[]);
}
```

**Key Features Needed:**
- Strategy registry (approved list)
- APY oracle updates
- Risk ratings
- Allocation caps (prevents concentration)
- Deprecation without instant migration
- Governor-controlled additions
- Event logging

**Integration Points:**
- Called by: `StrategyOptimizerService.ts` (Phase 3)
- Reads: Oracle feed for APYs
- Writes: `strategies` table

---

### Generic/Infrastructure - Missing (2 Contracts)

#### 12. Guardian.sol ✅ ALREADY CREATED (Phase 2)
**Status:** Created April 27, 2026
**File:** `/contracts/Guardian.sol` (490 lines)
**Purpose:** Emergency 2-of-3 multisig override

---

#### 13. TokenFaucet.sol (NEW - LOW PRIORITY)
**Purpose:** Distribute MTAA tokens to bootstrap DAO participation

**Must Implement:**
```solidity
contract TokenFaucet {
  struct FaucetDistribution {
    address recipient;
    uint256 amount;
    uint256 claimDeadline;
    bool claimed;
  }
  
  // Core methods
  function distributeTo(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner;
  function claim() external returns (uint256);
  function revokeUnclaimed(address recipient) external onlyOwner;
  function getUnclaimedAmount(address recipient) external view returns (uint256);
}
```

**Key Features Needed:**
- Batch distribution
- Claim deadline enforcement
- Unclaimed token recovery
- Event logging

**Integration Points:**
- Called by: Admin interface only
- Writes: `tokenDistributions` table

---

## Missing Database Tables (18 total)

### ROSC DAO Tables (5 NEW)

```sql
CREATE TABLE vaultRotationSchedule (
  id SERIAL PRIMARY KEY,
  vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
  member_id UUID REFERENCES daoMembers(id),
  rotation_position INT NOT NULL,           -- Queue position (1-n)
  status VARCHAR(50) DEFAULT 'WAITING',     -- WAITING, ACTIVE, COMPLETED, SKIPPED
  payout_amount DECIMAL(20,8),
  payout_date TIMESTAMP,
  skip_count INT DEFAULT 0,                 -- How many times skipped
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE memberRotationPosition (
  id SERIAL PRIMARY KEY,
  member_id UUID REFERENCES daoMembers(id) ON DELETE CASCADE,
  vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
  current_position INT,
  last_payout_time TIMESTAMP,
  times_participated INT DEFAULT 0,
  times_skipped INT DEFAULT 0,
  total_received DECIMAL(20,8) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(member_id, vault_id)
);

CREATE TABLE microLoans (
  id SERIAL PRIMARY KEY,
  loan_id BIGINT UNIQUE NOT NULL,           -- On-chain loan ID
  borrower_id UUID REFERENCES daoMembers(id),
  principal DECIMAL(20,8) NOT NULL,
  interest_rate DECIMAL(5,2),               -- 0-10%
  originated_at TIMESTAMP DEFAULT NOW(),
  maturity_date TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING_APPROVAL',  -- ACTIVE, REPAID, DEFAULTED
  guarantor_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE microLoanApprovals (
  id SERIAL PRIMARY KEY,
  loan_id BIGINT REFERENCES microLoans(loan_id),
  guarantor_id UUID REFERENCES daoMembers(id),
  is_guarantor BOOLEAN DEFAULT TRUE,
  approved_by UUID REFERENCES daoMembers(id),
  approved_at TIMESTAMP DEFAULT NOW(),
  approval_status VARCHAR(50)               -- APPROVED, REJECTED, PENDING
);

CREATE TABLE memberPaymentSchedule (
  id SERIAL PRIMARY KEY,
  loan_id BIGINT REFERENCES microLoans(loan_id),
  member_id UUID REFERENCES daoMembers(id),
  due_date TIMESTAMP NOT NULL,
  due_amount DECIMAL(20,8) NOT NULL,
  paid_amount DECIMAL(20,8) DEFAULT 0,
  payment_received_at TIMESTAMP,
  is_late BOOLEAN DEFAULT FALSE,
  late_penalty DECIMAL(20,8) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rotation_vault_position ON vaultRotationSchedule(vault_id, rotation_position);
CREATE INDEX idx_microloans_borrower ON microLoans(borrower_id);
CREATE INDEX idx_microloans_status ON microLoans(status);
```

---

### Women's Group DAO Tables (3 NEW)

```sql
CREATE TABLE memberLoans (
  id SERIAL PRIMARY KEY,
  loan_id BIGINT UNIQUE NOT NULL,           -- On-chain loan ID
  borrower_id UUID REFERENCES daoMembers(id),
  principal DECIMAL(20,8) NOT NULL,
  interest_rate DECIMAL(5,2),               -- 0-5%
  purpose TEXT,                             -- "Medical", "Housing", etc
  grace_period_days INT DEFAULT 30,
  maturity_date TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING_REVIEW', -- APPROVED, ACTIVE, REPAID, FORGIVEN, DEFAULTED
  guarantor1_id UUID REFERENCES daoMembers(id),
  guarantor2_id UUID REFERENCES daoMembers(id),
  escape_clause TEXT,                       -- Forgiveness conditions
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE loanApprovals (
  id SERIAL PRIMARY KEY,
  loan_id BIGINT REFERENCES memberLoans(loan_id),
  reviewed_by UUID REFERENCES daoMembers(id),
  approved_timestamp TIMESTAMP DEFAULT NOW(),
  approval_reason TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  escape_clause_verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE charitableFunds (
  id SERIAL PRIMARY KEY,
  fund_id BIGINT UNIQUE NOT NULL,           -- On-chain fund ID
  receiving_member_id UUID REFERENCES daoMembers(id),
  fund_purpose VARCHAR(200),                -- "Medical emergency", "Housing crisis"
  amount_granted DECIMAL(20,8) NOT NULL,
  amount_transferred TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'APPROVED',    -- PROPOSED, APPROVED, TRANSFERRED, REPAID
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_member_loans_borrower ON memberLoans(borrower_id);
CREATE INDEX idx_member_loans_status ON memberLoans(status);
CREATE INDEX idx_charity_funds_recipient ON charitableFunds(receiving_member_id);
```

---

### Bail Fund DAO Tables (4 NEW)

```sql
CREATE TABLE defendants (
  id SERIAL PRIMARY KEY,
  defendant_id BIGINT UNIQUE NOT NULL,      -- On-chain defendant ID
  name VARCHAR(255),
  case_number VARCHAR(100) UNIQUE,
  court_location VARCHAR(255),
  charges TEXT,
  flight_risk_score INT,                    -- 1-10 scale
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bailCases (
  id SERIAL PRIMARY KEY,
  case_id BIGINT UNIQUE NOT NULL,           -- On-chain case ID
  defendant_id BIGINT REFERENCES defendants(defendant_id),
  vault_id UUID REFERENCES vaults(id),
  bail_amount DECIMAL(20,8) NOT NULL,
  bail_posted_by UUID REFERENCES daoMembers(id),
  bail_posted_at TIMESTAMP DEFAULT NOW(),
  court_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'ACTIVE',      -- ACTIVE, RELEASED, FORFEITED
  defendant_appeared BOOLEAN,
  court_order_hash VARCHAR(255),            -- IPFS hash
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE escrowConditions (
  id SERIAL PRIMARY KEY,
  case_id BIGINT REFERENCES bailCases(case_id),
  condition_type VARCHAR(100),              -- DEFENDANT_APPEARANCE, LOCATION_RESTRICTION
  condition_description TEXT,
  deadline TIMESTAMP,
  verified BOOLEAN DEFAULT FALSE,
  IPFS_proof_hash VARCHAR(255)
);

CREATE TABLE forfeitureWriteoffs (
  id SERIAL PRIMARY KEY,
  writeoff_id BIGINT UNIQUE NOT NULL,       -- On-chain writeoff ID
  case_id BIGINT REFERENCES bailCases(case_id),
  writeoff_date TIMESTAMP DEFAULT NOW(),
  writeoff_amount DECIMAL(20,8) NOT NULL,
  recovery_amount DECIMAL(20,8) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'PENDING',     -- WRITEOFF_EXECUTED, PARTIAL_RECOVERY, FULL_RECOVERY
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bail_cases_defendant ON bailCases(defendant_id);
CREATE INDEX idx_bail_cases_vault ON bailCases(vault_id);
CREATE INDEX idx_bail_cases_status ON bailCases(status);
CREATE INDEX idx_forfeiture_case ON forfeitureWriteoffs(case_id);
```

---

### Meta DAO Tables (2 NEW - Others already exist)

```sql
CREATE TABLE metaGovernanceVotes (
  id SERIAL PRIMARY KEY,
  proposal_id BIGINT,                       -- Cross-DAO proposal ID
  parent_dao_id UUID REFERENCES daos(id),
  affected_child_dao_ids UUID[],            -- Array of affected child DAOs
  proposal_type VARCHAR(100),               -- FEE_CHANGE, DIVIDEND, POLICY
  parent_votes INT,
  child_votes INT,
  execution_status VARCHAR(50),             -- PENDING, PASSED, FAILED, EXECUTED
  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE metaDAOConflicts (
  id SERIAL PRIMARY KEY,
  conflict_id BIGINT,                       -- From DisputeResolution.sol
  parent_dao_id UUID REFERENCES daos(id),
  child_dao_id UUID REFERENCES daos(id),
  dispute_type VARCHAR(100),               -- FEE_DISPUTE, DIVIDEND_DISPUTE
  arbitrator_assignment TIMESTAMP,
  resolution_deadline TIMESTAMP,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_meta_gov_parent ON metaGovernanceVotes(parent_dao_id);
CREATE INDEX idx_meta_conflicts_status ON metaDAOConflicts(status);
```

---

### Short-Term Project DAO Tables (2 NEW)

```sql
CREATE TABLE projectMilestones (
  id SERIAL PRIMARY KEY,
  milestone_id BIGINT UNIQUE NOT NULL,      -- On-chain milestone ID
  project_id UUID REFERENCES daos(id),
  description TEXT NOT NULL,
  deadline TIMESTAMP NOT NULL,
  release_amount DECIMAL(20,8) NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',     -- VERIFIED, REJECTED, RELEASED, EXTENDED
  ipfs_proof_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projectMilestoneVerifications (
  id SERIAL PRIMARY KEY,
  milestone_id BIGINT REFERENCES projectMilestones(milestone_id),
  verified_by UUID REFERENCES daoMembers(id),
  verified_at TIMESTAMP DEFAULT NOW(),
  is_approved BOOLEAN,
  verification_notes TEXT,
  advisor_count INT                         -- How many advisors approved
);

CREATE INDEX idx_milestones_project ON projectMilestones(project_id);
CREATE INDEX idx_milestones_status ON projectMilestones(status);
CREATE INDEX idx_milestone_verification ON projectMilestoneVerifications(milestone_id);
```

---

### Tax Compliance Tables (1 NEW)

```sql
CREATE TABLE taxComplianceRecords (
  id SERIAL PRIMARY KEY,
  event_id BIGINT,
  member_id UUID REFERENCES daoMembers(id),
  event_timestamp TIMESTAMP DEFAULT NOW(),
  event_type VARCHAR(100),                  -- CAPITAL_GAIN, CAPITAL_LOSS, ORDINARY_INCOME
  amount DECIMAL(20,8) NOT NULL,
  description TEXT,
  document_ipfs_hash VARCHAR(255),
  tax_year INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE strategyPerformanceHistory (
  id SERIAL PRIMARY KEY,
  strategy_id VARCHAR(100),
  apy DECIMAL(10,4),
  tvl BIGINT,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tax_member_year ON taxComplianceRecords(member_id, tax_year);
CREATE INDEX idx_tax_event_type ON taxComplianceRecords(event_type);
```

---

### Strategy Registry Table (1 NEW)

```sql
CREATE TABLE strategies (
  id SERIAL PRIMARY KEY,
  strategy_id VARCHAR(100) UNIQUE NOT NULL,  -- "aave-usdc", "lido-steth"
  name VARCHAR(255) NOT NULL,
  yield_protocol_address VARCHAR(255),
  apy DECIMAL(10,4),
  max_allocation_percent DECIMAL(5,2),
  status VARCHAR(50) DEFAULT 'ACTIVE',      -- ACTIVE, DEPRECATED, PAUSED
  risk_rating INT DEFAULT 3,                -- 1-5 stars
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strategies_status ON strategies(status);
```

---

## Summary by DAO Type

| DAO Type | Missing Contracts | Missing Tables | Priority |
|----------|------------------|-----------------|----------|
| ROSC | 2 (Rotation, MicroLoan) | 5 | 🔴 CRITICAL |
| Women's Group | 1 (LoanFacility) | 3 | 🔴 CRITICAL |
| Bail Fund | 1 (BailForfeiture) | 4 | 🔴 CRITICAL |
| Meta DAO | 1 (MetaGovernance) | 2 | 🟠 HIGH |
| Short-Term Project | 2 (MilestoneEscrow, TaxCompliance) | 2 | 🟡 MEDIUM |
| Investment Club | 1 (StrategyRegistry) | 1 | 🟡 MEDIUM |
| Generic | 3 (Guardian done, TokenFaucet) | 1 | 🟢 LOW |
| **TOTAL** | **13** | **18** | ~150 hours |

---

## Implementation Roadmap

### Phase 4A: ROSC & Women's Group (CRITICAL)
**Estimated Effort:** 60 hours

1. RotationModule.sol (8 hours)
2. MicroLoanFacility.sol (10 hours)
3. LoanFacility.sol (10 hours)
4. ROSC + Women's Group tables (12 hours)
5. Backend services (20 hours)

### Phase 4B: Bail Fund & Meta DAO (HIGH)
**Estimated Effort:** 50 hours

1. BailForfeiture.sol (8 hours)
2. MetaGovernance.sol (12 hours)
3. Bail Fund + Meta tables (10 hours)
4. Backend services (20 hours)

### Phase 4C: Short-Term Project (MEDIUM)
**Estimated Effort:** 35 hours

1. MilestoneEscrow.sol (10 hours)
2. TaxComplianceRecorder.sol (8 hours)
3. Project tables (7 hours)
4. Backend services (10 hours)

### Phase 4D: Optimization & Cleanup (LOW)
**Estimated Effort:** 25 hours

1. StrategyRegistry.sol (6 hours)
2. TokenFaucet.sol (4 hours)
3. Documentation & testing (15 hours)

---

**Total Missing Implementation:** ~170 hours (4-5 weeks of development)

**Blocking Current DAOs:**
- ROSC: Cannot launch without Rotation + MicroLoan
- Women's Group: Cannot launch without LoanFacility
- Bail Fund: Cannot launch without BailForfeiture + Oracle integration
- Meta DAO: Limited functionality without MetaGovernance

**Impact:** These 13 contracts + 18 tables unlock the remaining 30% coverage for each DAO type.
