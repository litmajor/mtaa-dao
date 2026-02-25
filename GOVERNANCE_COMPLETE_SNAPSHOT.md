# Governance System - Complete Snapshot

**Date**: February 2, 2026  
**Status**: 🔄 Phase 1B (Foundations Complete, UI Enhancement Pending)  
**Completion**: 75% (Core governance operational, proposal UI needs work)

---

## 🎯 GOVERNANCE OVERVIEW

The MTAA governance system is a comprehensive, community-driven framework enabling DAOs to:
- Create and manage proposals with transparent voting
- Distribute treasury funds fairly with rotation-based withdrawal cycles
- Implement adaptive quorum calculations based on member activity
- Support multiple voting mechanisms (simple majority, quadratic voting)
- Enforce treasury multi-signature requirements for security
- Delegate voting power to representatives
- Track all governance events and member activity

---

## 🏗️ DAO TYPES & STRUCTURES

### 1. **DAO Types** (stored in `daos.daoType`)

| Type | Purpose | Duration | Features |
|------|---------|----------|----------|
| **Free** | Community projects | Ongoing | Basic governance, up to 50 members |
| **Short-term** | Limited duration (30/60/90 days) | Configurable | Auto-expiry, extension support (max 2x), rotation-based withdrawals |
| **Collective** | Long-term collaboration | Ongoing | Advanced governance, unlimited members, treasury management |
| **Meta** | Governance of DAOs | Ongoing | Multi-DAO coordination, parameter adjustment, protocol upgrades |

### 2. **Withdrawal Models** (stored in `daos.withdrawalMode`)

| Model | Description | Use Case |
|-------|-------------|----------|
| **Direct** | Single-sig withdrawals | Quick-moving funds, single trustee |
| **Multisig** | 2-of-3 or 3-of-5 approval | Treasure security, financial DAOs |
| **Rotation** | Sequential fund distribution | Fair wealth distribution, savings circles |

### 3. **Duration Models** (stored in `daos.durationModel`)

| Model | Behavior | Frequency |
|-------|----------|-----------|
| **Time-based** | Fixed expiry date | One-time, no renewal |
| **Rotation-based** | Cycles through recipients | Weekly, Monthly, Quarterly |
| **Ongoing** | No expiry | Indefinite |

---

## 🗳️ VOTING SYSTEMS & MECHANISMS

### Vote Types (stored in `votes.voteType`)

```
yes     - Support proposal
no      - Oppose proposal  
abstain - Remain neutral (counted for quorum but not influence)
```

### Voting Power Calculation

#### Standard Voting Power
```typescript
// Basic 1-token = 1-vote system
votingPower = governanceTokensHeld;

// Example:
// Member with 100 MTAA tokens = 100 voting power
```

#### Quadratic Voting (Optional - Advanced)
```typescript
// Prevents whale dominance by using square root
votingPower = sqrt(tokenBalance) * reputationMultiplier;

// Reputation tiers:
// 0-999 points     → 1.0x multiplier
// 1000-4999 points → 1.25x multiplier
// 5000-9999 points → 1.5x multiplier
// 10000+ points    → 2.0x multiplier

// Example:
// Member with 10,000 MTAA + 1000 rep
// votingPower = sqrt(10000) * 1.25 = 100 * 1.25 = 125
```

#### Weighted Voting (Delegation-adjusted)
```typescript
// Votes can be delegated with weights
const finalVote = baseVotingPower * delegationWeight;

// Delegation scope:
// - all: delegate all voting power
// - category-specific: only specific proposal types
// - proposal-specific: only a single proposal
```

### Vote Weight (stored in `votes.weight`)

| Weight | Meaning | Use Case |
|--------|---------|----------|
| 1.0 | Full voting power | Default |
| 0.5 | Half voting power | Reduced influence votes |
| 0.25 | Quarter voting power | Lower weight for certain votes |
| Custom | Fractional weight | Quadratic or weighted voting |

---

## 👥 MEMBER ROLES & PERMISSIONS

### Role Hierarchy (stored in `daoMemberships.role`)

| Role | Voting | Propose | Execute | Approve | Delegate |
|------|--------|---------|---------|---------|----------|
| **Member** | ✅ | ❌ | ❌ | ❌ | ✅* |
| **Proposer** | ✅ | ✅ | ❌ | ❌ | ✅* |
| **Elder** | ✅ | ✅ | ✅ | ✅ | ✅* |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |

*Can receive delegated votes but cannot delegate to others (unless admin)

### Special Flags

```typescript
daoMemberships {
  isElder: boolean              // Elder privileges
  isAdmin: boolean              // Full DAO control
  canInitiateWithdrawal: boolean // Can request treasury withdrawal
  canApproveWithdrawal: boolean  // Can approve withdrawals (multisig)
  isRotationRecipient: boolean   // Eligible for rotation cycles
  isBanned: boolean              // Permanently banned member
}
```

---

## 📋 PROPOSAL SYSTEM

### Database Schema

```typescript
proposals {
  id: uuid
  title: string
  description: string
  proposalType: varchar  // "general" | "budget" | "emergency" | "poll"
  
  // Proposer info
  proposerId: varchar    // User who created proposal
  daoId: uuid           // Associated DAO
  
  // Voting period
  voteStartTime: timestamp
  voteEndTime: timestamp
  quorumRequired: integer (%) // e.g., 20 for 20%
  
  // Vote tallies
  yesVotes: integer
  noVotes: integer
  abstainVotes: integer
  
  // Poll options (for poll-type proposals)
  pollOptions: jsonb    // [{id, label, votes}]
  allowMultipleChoices: boolean
  
  // Execution
  status: varchar       // "draft" | "active" | "passed" | "failed" | "executed" | "expired"
  executedAt: timestamp
  executionTxHash: varchar // Blockchain tx hash
  executionData: jsonb  // Data for execution
  
  // Social features
  likesCount: integer
  commentsCount: integer
  isFeatured: boolean
  
  metadata: jsonb       // Custom data
}
```

### Proposal Types

| Type | Description | Use Case | Execution |
|------|-------------|----------|-----------|
| **General** | Standard governance votes | Policy decisions, rule changes | Manual execution via governance |
| **Budget** | Treasury allocation proposals | Spending approvals | Automatic fund transfer |
| **Emergency** | Fast-track proposals | Crisis response, urgent decisions | Reduced voting period (24h) |
| **Poll** | Community surveys | Sentiment tracking, non-binding votes | No execution needed |

### Proposal Lifecycle

```
draft
  ↓ [create]
active (voting period open)
  ↓ [voting ends]
passed (approval % reached + quorum met)
  ├─ ✅ [execute] → executed
  └─ ⏳ [delay period] → ready for execution
  
OR
  ↓ [voting ends, failed conditions]
failed (< quorum OR < approval %)
  ↓
expired (voting period ended, never executed)
```

### Proposal Status Flow

```typescript
status: "draft" | "active" | "passed" | "failed" | "executed" | "expired"

Transitions:
- draft → active: Once posting period starts
- active → passed: yesVotes >= approvalThreshold + quorum met
- active → failed: noVotes >= noVotes + quorum not met
- passed → executed: After execution delay + execution called
- active/passed → expired: After voteEndTime
```

---

## 🔐 VOTING & QUORUM SYSTEM

### Quorum Calculation

```typescript
// Dynamic quorum based on active membership
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const activeMemberCount = members.filter(m => m.lastActive >= thirtyDaysAgo);
const requiredQuorum = Math.ceil((activeMemberCount * quorumPercentage) / 100);

// Default quorum percentage: 20%
// Can be customized per DAO via governance parameters
```

### Quorum History Tracking

```typescript
quorumHistory {
  id: uuid
  daoId: uuid
  proposalId: uuid
  activeMemberCount: integer
  requiredQuorum: integer
  achievedQuorum: integer
  quorumMet: boolean
  calculatedAt: timestamp
}
```

### Vote Validation

```typescript
// Votes must meet:
1. Voter is DAO member with active status
2. Voter not banned (isBanned = false)
3. Vote cast during voting period (now between voteStartTime and voteEndTime)
4. Voter hasn't already voted on this proposal
5. Voter has sufficient voting power

// Delegated votes:
- Must be active delegation
- Delegator's voting power transferred to delegate
- Delegate votes count as delegated votes
```

---

## 🗳️ CASTING VOTES

### Vote Database Schema

```typescript
votes {
  id: uuid
  proposalId: uuid          // Which proposal
  userId: varchar           // Who voted
  daoId: uuid              // Which DAO
  voteType: varchar        // "yes" | "no" | "abstain"
  weight: decimal (1.0)    // Voting weight/multiplier
  votingPower: decimal     // Actual power used
  isDelegated: boolean     // Is this a delegated vote?
  delegatedBy: varchar     // If delegated, who delegated?
  createdAt: timestamp     // When vote was cast
}
```

### Vote Tallying

```typescript
// Calculate proposal results
const totalVotes = yesVotes + noVotes + abstainVotes;
const votingVotes = yesVotes + noVotes;  // Excludes abstain
const approvalRate = votingVotes > 0 ? (yesVotes / votingVotes) * 100 : 0;
const participationRate = (totalVotes / activeMemberCount) * 100;

// Proposal passes if:
// 1. approvalRate >= approvalThreshold (typically 50%)
// 2. participationRate >= quorumPercentage (typically 20%)
```

---

## 🎯 VOTE DELEGATION

### Delegation Models

```typescript
voteDelegations {
  id: uuid
  delegatorId: varchar      // Who delegates
  delegateId: varchar       // Who receives delegation
  daoId: uuid              // Which DAO
  scope: varchar           // Delegation scope:
                           //   "all" - all proposals
                           //   "category-specific" - specific types
                           //   "proposal-specific" - single proposal
  category: varchar        // If category-specific: "budget", "policy", etc
  proposalId: uuid         // If proposal-specific
  isActive: boolean        // Can be deactivated
}
```

### Delegation Constraints

```typescript
// Single delegate voting power limit (prevent vote hoarding)
maxDelegationPercentage: 10%  // Single delegate can't hold >10% of votes

// Example:
// DAO with 100 members, each with 1 vote = 100 total
// Single delegate max = 10 votes (10%)
// Prevents whale voting and promotes distributed governance
```

### Delegation Flow

```
Member A (10 votes)
  ├─ Delegates 10 votes to Member B (full delegation, "all" scope)
  │
  └─ Member B now controls 10 votes
      ├─ Votes on Proposal 1 with 10 votes
      └─ If >maxDelegationPercentage, excess votes rejected

Alternative: Category-specific
Member A (10 votes)
  ├─ Delegates 6 votes to Member B (for "budget" proposals only)
  ├─ Keeps 4 votes for direct voting
  │
  └─ Member B can only vote with 6 on budget proposals
      - On non-budget proposals, Member A votes directly with 4
```

---

## 💰 TREASURY & EXECUTION

### Treasury Management

```typescript
// DAO Treasury Configuration
daos {
  treasuryBalance: decimal
  treasuryMultisigEnabled: boolean        // Multi-sig required?
  treasuryRequiredSignatures: integer     // e.g., 3-of-5
  treasurySigners: jsonb[]               // List of signer user IDs
  treasuryWithdrawalThreshold: decimal    // e.g., $1000
  treasuryDailyLimit: decimal             // e.g., $10,000/day
  treasuryMonthlyBudget: decimal          // e.g., $100,000/month
  
  // Rotation settings
  rotationFrequency: varchar              // "weekly" | "monthly" | "quarterly"
  rotationSelectionMethod: varchar        // "sequential" | "lottery" | "proportional"
  nextRotationDate: timestamp
  currentRotationCycle: integer           // Current cycle #
  totalRotationCycles: integer            // Total planned cycles
}
```

### Proposal Execution

```typescript
// Execution Queue
proposalExecutionQueue {
  id: uuid
  proposalId: uuid
  status: varchar           // "pending" | "approved" | "rejected" | "executed"
  executionTimestamp: timestamp
  executionDelay: integer   // Delay in hours before execution
  createdAt: timestamp
}

// Execution Flow:
1. Proposal passes voting → "passed" status
2. Added to execution queue
3. Wait executionDelay (e.g., 24 hours for security)
4. Execute proposal → update treasury, transfer funds, etc.
5. Record executionTxHash for on-chain verification
```

### Budget Categories

```typescript
budgetCategories {
  id: uuid
  daoId: uuid
  categoryName: varchar    // "operational", "grants", "marketing", etc
  monthlyBudget: decimal
  yearlyBudget: decimal
  allocatedAmount: decimal
  remainingAmount: decimal
  isActive: boolean
}

// Example Budget Allocation:
Total Monthly Budget: $10,000
├─ Operations: $4,000
├─ Grants/Rewards: $3,000
├─ Marketing: $2,000
└─ Emergency Reserve: $1,000
```

---

## 🔄 ROTATION-BASED WITHDRAWALS

### Rotation Cycles

```typescript
daoRotationCycles {
  id: uuid
  daoId: uuid
  cycleNumber: integer           // 1, 2, 3, etc
  recipientUserId: varchar       // Who gets funds this cycle
  status: varchar                // "pending" | "active" | "completed" | "skipped"
  startDate: timestamp
  endDate: timestamp
  amountDistributed: decimal
  transactionHash: varchar       // Blockchain proof
  distributedAt: timestamp
}
```

### Rotation Selection Methods

| Method | Selection | Fair For |
|--------|-----------|----------|
| **Sequential** | Predetermined order | Predictable, fair list-based |
| **Lottery** | Random selection | Unbiased, excitement |
| **Proportional** | Based on contribution | Merit-based, performance |

### Example: Weekly Rotation with 4 Cycles

```
DAO: "Medical Fund"
Duration Model: rotation
Rotation Frequency: weekly
Total Rotation Cycles: 4
Treasury Amount: $40,000 (split = $10,000 each cycle)
Selection Method: sequential

Cycle 1 (Week 1):
  ├─ Recipient: Alice
  ├─ Amount: $10,000
  ├─ Status: active
  └─ Dates: Jan 1-7

Cycle 2 (Week 2):
  ├─ Recipient: Bob
  ├─ Amount: $10,000
  └─ Dates: Jan 8-14

Cycle 3 (Week 3):
  ├─ Recipient: Carol
  ├─ Amount: $10,000
  └─ Dates: Jan 15-21

Cycle 4 (Week 4):
  ├─ Recipient: David
  ├─ Amount: $10,000
  └─ Dates: Jan 22-28
```

---

## 📊 GOVERNANCE ANALYTICS

### Member Activity Tracking

```typescript
memberActivityLog {
  id: uuid
  daoId: uuid
  memberId: varchar
  activityType: varchar    // "vote_cast", "proposal_created", "delegation_received", etc
  description: string
  pointsEarned: integer    // Reputation/activity points
  activityDate: timestamp
}

// Activity Point System:
vote_cast: 5 points
proposal_created: 20 points
proposal_passed: 50 points
member_invited: 10 points
delegation_received: 15 points
```

### Governance Events Log

```typescript
governanceEvents {
  id: uuid
  daoId: uuid
  eventType: varchar       // "member_joined", "proposal_created", "proposal_executed", "vote_cast", "delegation_changed"
  description: string
  actorWalletId: varchar   // Who triggered event
  associatedProposalId: uuid
  eventDate: timestamp
}

// Audit Trail Example:
2026-02-01 14:23:45 | member_joined | Alice joined as "member"
2026-02-01 15:10:00 | proposal_created | Bob created "Q2 Budget" proposal
2026-02-02 10:30:15 | vote_cast | Alice voted YES on "Q2 Budget"
2026-02-02 11:45:30 | vote_cast | Carol voted NO on "Q2 Budget"
2026-02-03 12:00:00 | proposal_executed | Q2 Budget approved + executed
```

### Governance Reports

```typescript
governanceReports {
  id: uuid
  daoId: uuid
  reportType: varchar      // "monthly", "quarterly", "annual"
  totalProposals: integer
  passedProposals: integer
  failedProposals: integer
  avgQuorum: decimal
  avgParticipation: decimal
  topVoter: varchar
  mostActiveMember: varchar
  treasuryTurnover: decimal
  generatedAt: timestamp
}
```

---

## 🔌 API ENDPOINTS

### DAO Management

```
GET    /api/governance/:daoId/quorum
       Response: { activeMemberCount, quorumPercentage, requiredQuorum }

POST   /api/governance/:daoId/parameters
       Body: { votingPeriodDays?, quorumPercent?, approvalPercent? }
       Response: { updated DAO }

GET    /api/governance/:daoId/members
       Response: [{ userId, role, votingPower, status }]
```

### Proposals

```
POST   /api/governance/:daoId/proposals
       Body: { title, description, proposalType, voteEndTime }
       Response: { proposalId, status }

GET    /api/governance/:daoId/proposals
       Query: ?status=active|passed|failed
       Response: [{ proposal }]

GET    /api/governance/proposals/:proposalId
       Response: { proposal + voting stats }

POST   /api/governance/proposals/:proposalId/execute
       Response: { executionTxHash, status }
```

### Voting

```
POST   /api/governance/proposals/:proposalId/vote
       Body: { voteType: "yes"|"no"|"abstain", reason? }
       Response: { voteId, votingPower, timestamp }

GET    /api/governance/proposals/:proposalId/votes
       Response: [{ vote }]

GET    /api/governance/proposals/:proposalId/results
       Response: { yesVotes, noVotes, abstainVotes, approvalRate, quorumMet }
```

### Delegation

```
POST   /api/governance/:daoId/delegate
       Body: { delegateUserId, scope: "all"|"category"|"proposal", category?, proposalId? }
       Response: { delegationId, votingPowerDelegated }

GET    /api/governance/:daoId/delegations
       Response: [{ delegations }]

DELETE /api/governance/delegations/:delegationId
       Response: { revoked }
```

### Stats & Analytics

```
GET    /api/governance/:daoId/stats
       Response: { totalMembers, activeMembers, avgParticipation, totalProposals }

GET    /api/governance/:daoId/member/:userId/votes
       Response: [{ vote history }]

GET    /api/governance/:daoId/events
       Response: [{ governance events }]
```

---

## 📁 CODEBASE STRUCTURE

### Backend Files

```
server/
├── services/
│   ├── governance-service.ts (1104 lines)
│   │   ├── DAO Management (createDAO, getDAO, updateDAOParameters)
│   │   ├── DAO Membership (addDAOMember, getDAOMembers, etc)
│   │   ├── Governance Tokens (createGovernanceToken, etc)
│   │   ├── Proposals (createProposal, getProposal, updateProposalStatus)
│   │   ├── Voting (castVote, getProposalVotes, etc)
│   │   ├── Vote Delegation (delegateVotes, revokeDelegation, etc)
│   │   ├── Treasury Management (manageTreasuryFunds, etc)
│   │   ├── Budget Management (createBudgetCategory, etc)
│   │   ├── Rotation Cycles (initializeRotationCycle, executeRotation, etc)
│   │   └── Activity Tracking & Events
│   │
│   └── rules-integration.ts (Custom governance rules engine)
│       └── evaluateGovernanceRules()
│
├── routes/
│   ├── governance.ts (554 lines)
│   │   ├── POST /proposals/:proposalId/execute (with quorum enforcement)
│   │   ├── GET /:daoId/quorum
│   │   ├── POST /:daoId/parameters
│   │   └── [More endpoints]
│   │
│   ├── governance-v2.ts (Advanced governance features)
│   ├── governance-quorum.ts (Dynamic quorum calculations)
│   └── modules/governance-routes.ts
│
└── core/
    └── kwetu/services/governance_service.ts
```

### Frontend Files

```
client/src/
├── pages/
│   └── dao/[id]/governance.tsx
│       └── DAO Governance Dashboard
│           ├── Proposals List (with voting)
│           ├── Voting Power Display
│           ├── Create Proposal Form
│           ├── Active Votes Panel
│           ├── Treasury Status
│           └── Member Management
│
└── components/governance/ (planned)
    ├── ProposalCard.tsx (✅ exists, shows proposal info)
    ├── VotingPanel.tsx (needs enhancement)
    ├── CreateProposalModal.tsx (🔄 needs work)
    ├── VotingHistory.tsx (🔄 planned)
    ├── DelegateVotesModal.tsx (🔄 needs implementation)
    ├── GovernanceStats.tsx (partial)
    └── TreasuryManagement.tsx (🔄 needs work)
```

### Database Schema Files

```
shared/schema.ts (Lines: 310-550+)
├── daos (310-376)
│   ├── DAO types, plans, treasury config
│   ├── Rotation settings
│   ├── Governance parameters
│   └── Multi-sig configuration
│
├── daoMemberships (659-682)
│   ├── Member roles (member, proposer, elder, admin)
│   ├── Status tracking
│   ├── Withdrawal permissions
│   └── Rotation eligibility
│
├── proposals (468-512)
│   ├── Proposal types (general, budget, emergency, poll)
│   ├── Voting configuration
│   ├── Vote tallies
│   ├── Execution data
│   └── Social features (likes, comments)
│
├── votes (522-532)
│   ├── Vote recording
│   ├── Voting power tracking
│   ├── Delegation tracking
│   └── Vote weights
│
├── voteDelegations (514-521)
│   ├── Delegation scope (all, category, proposal)
│   └── Activation status
│
├── daoInvitations (684-704)
│   ├── Peer invites
│   ├── Email/phone invites
│   └── Referral tracking
│
├── daoRotationCycles (706-721)
│   ├── Cycle tracking
│   ├── Recipients
│   └── Distribution amounts
│
├── quorumHistory (534-543)
│   └── Quorum audit trail
│
├── proposalExecutionQueue (545-556)
│   └─ Execution scheduling
│
└── budgetCategories, expenses, governanceEvents, memberActivityLog, governanceReports
    └─ Supporting tables for treasury and analytics
```

---

## 📈 IMPLEMENTATION STATUS

### ✅ Complete (Production-Ready)

- [x] DAO creation with multiple types (free, short-term, collective, meta)
- [x] Member roles and permissions (member, proposer, elder, admin)
- [x] Proposal creation and management
- [x] Basic voting system (yes/no/abstain)
- [x] Vote tallying and result calculation
- [x] Quorum calculation (dynamic based on active members)
- [x] Vote delegation (all scopes)
- [x] Delegation constraints (max 10% single delegate)
- [x] Proposal execution queue
- [x] Treasury management with multi-sig
- [x] Rotation-based withdrawal cycles
- [x] Budget category management
- [x] Governance events logging
- [x] Member activity tracking
- [x] Database schema (all tables)
- [x] Backend API endpoints (governance service)
- [x] Authentication & authorization

### 🔄 Partial Implementation

- [x] Frontend voting display (basic show in OkediDashboard)
- [ ] Create proposal UI (design exists, not integrated)
- [ ] Advanced filtering & search
- [ ] Real-time vote updates (WebSocket ready, not active)
- [ ] Vote delegation UI (no component yet)
- [ ] Governance stats dashboard (basic tracking)

### ⚠️ Needs Work

- [ ] Proposal discussion/comments UI
- [ ] Advanced voting mechanisms (quadratic voting UI)
- [ ] Proposal execution monitoring
- [ ] Treasury visualization dashboard
- [ ] Rotation cycle tracking UI
- [ ] Governance rules engine UI
- [ ] Member onboarding flow for new DAOs
- [ ] Proposal template system (backend ready, UI pending)

---

## 🚀 QUICK REFERENCE: WHAT YOU CAN DO

### For DAO Founders
1. ✅ Create DAO (free, short-term, collective, meta)
2. ✅ Invite members via links/email
3. ✅ Set voting periods, quorum %
4. ✅ Configure treasury (balance, limits, multi-sig)
5. ✅ Set up rotation cycles (for savings circles)
6. ✅ Manage budget categories
7. 🔄 Create proposals (backend ready, UI needs work)

### For DAO Members
1. ✅ Join DAO via invite
2. ✅ See active proposals
3. ✅ Cast votes on proposals
4. ✅ View proposal results
5. ✅ Delegate voting power to others
6. ✅ Track voting history
7. 🔄 Create proposals (depends on role)
8. 🔄 View treasury status (basic)

### For DAO Admins
1. ✅ Manage members (add/remove/ban)
2. ✅ Set member roles (elder, proposer, admin)
3. ✅ Configure voting parameters
4. ✅ Monitor governance events
5. ✅ Track member activity & reputation
6. ✅ Manage treasury signers (multi-sig)
7. ✅ Execute proposals after voting
8. ✅ Manage rotation cycles

---

## 🔧 KEY CONCEPTS & FORMULAS

### Approval Percentage
```
Approval % = yesVotes / (yesVotes + noVotes) * 100
Default threshold: 50%
```

### Quorum Participation
```
Quorum % = totalVotes / activeMemberCount * 100
Default required: 20% of active members
```

### Voting Power (Standard)
```
votingPower = governanceTokensHeld * voteWeight
Example: 100 MTAA tokens * 1.0 weight = 100 votes
```

### Voting Power (Quadratic)
```
votingPower = sqrt(tokenBalance) * reputationMultiplier
Example: sqrt(10,000) * 1.25 = 100 * 1.25 = 125 votes
```

### Max Single Delegate Power
```
maxPower = (totalVotingPower * 10%) / 100
Example: DAO with 1000 total votes: max delegate = 100 votes
```

---

## 📝 NOTABLE DESIGN DECISIONS

1. **Dynamic Quorum**: Based on active members (last 30 days) to prevent whale dominance
2. **Delegation Limits**: Single delegate can't hold >10% to ensure distributed governance
3. **Execution Delay**: 24-hour wait after proposal passes for security
4. **Rotation Fairness**: Sequential/lottery/proportional methods for equitable distribution
5. **Multi-sig Security**: 3-of-5 approval for large treasury withdrawals
6. **Event Logging**: Complete audit trail for all governance actions
7. **Quadratic Voting**: Optional to prevent whale dominance while maintaining simplicity

---

## 🎯 PHASE 1B GOVERNANCE REQUIREMENTS

**Current**: 75% complete (core functionality working)

**Remaining Work**:
- [ ] Implement "Create Proposal" UI with form validation
- [ ] Build proposal discussion/comments system
- [ ] Add vote delegation UI
- [ ] Create governance analytics dashboard
- [ ] Implement WebSocket live voting updates
- [ ] Add proposal templates dropdown
- [ ] Treasury visualization (pie charts, spending trends)
- [ ] Member contribution/reputation tracking UI

**Estimated Effort**: 15-20 hours for full UI/UX completion

---

## 🔗 RELATED SYSTEMS

- **Wallet System**: Handles fund transfers for treasury & rotation distributions
- **Notification System**: Alerts members about new proposals, vote results
- **Persistence System**: Tracks all governance state changes
- **Analytics System**: Generates DAO governance reports
- **Escrow System**: Used for conditional fund releases based on governance approval
- **Payment Links**: Can be proposal-triggered for fund distribution

---

**Next Steps**: Begin Phase 1B Governance UI implementation starting with Create Proposal modal and vote delegation interface.
