# Weeks 2-3: Core Safety Implementation Plan
## Universal Reversibility, Simulations & Confirmations

**Dates:** Week 2 (Feb 17-21) | Week 3 (Feb 24-28), 2026  
**Focus Areas:** Reversibility Pattern, Simulation Endpoints, Confirmation Workflows  
**Total Effort:** 160 hours (2 engineers × 10 days)  
**Outcome:** All 5 systems have reversibility, simulations, and confirmations implemented

---

## WEEK 2: Foundation & Universal Patterns (Feb 17-21)

### Day 1 (Monday, Feb 17): Architecture & Patterns Definition

**Morning: Universal Reversibility Pattern Design (4 hours)**
- [ ] Define standard reversibility state machine:
  ```
  States: INITIATED → PENDING_CONFIRMATION → GRACE_PERIOD → REVERSIBLE_UNTIL → EXECUTED → IRREVERSIBLE
  ```
- [ ] Design cancellation flow:
  ```
  1. User initiates action → actionId, timestamp recorded
  2. System enters GRACE_PERIOD (24-48 hours based on system)
  3. Any authorized user can submit cancel reason + signatures
  4. 2-of-3 approval board votes to cancel (or single admin if system allows)
  5. Upon approval, action reverted to pre-state + reversal audit logged
  6. After grace period expires, action becomes IRREVERSIBLE
  ```
- [ ] Define emergency stop for critical systems (agents, bots, escrow)
- [ ] Create TypeScript interfaces for reversal pattern

**Afternoon: Database Schema for Reversibility (4 hours)**
- [ ] Add reversibility tracking table:
  ```sql
  CREATE TABLE action_reversals (
    id UUID PRIMARY KEY,
    original_action_id UUID REFERENCES actions(id),
    initiated_at TIMESTAMP,
    grace_period_until TIMESTAMP,
    status ENUM ('pending', 'grace', 'reversible', 'executing', 'irreversible', 'reversed'),
    reversible_by TEXT[], -- who can cancel this action
    cancel_reason TEXT,
    cancelled_by UUID,
    cancelled_at TIMESTAMP,
    reverted_state JSONB, -- state to restore on cancel
    emergency_stop_triggered BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] Add indexes for status + grace_period queries
- [ ] Run migrations for all systems

---

### Day 2-3 (Tues-Wed, Feb 18-19): Simulation Engine

**Day 2: Governance & Escrow Simulations (8 hours)**

*Morning: Governance Execution Simulation (4 hours)*
- [ ] Create `proposalSimulationService` endpoint:
  ```typescript
  POST /api/governance/proposals/:id/simulate
  Returns:
  {
    proposalId: string;
    simulatedOutcome: {
      approved: boolean;
      votesRequired: number;
      votesReceived: number;
      timeToExecute: number;
      treasuryImpact: {
        delta: number;
        percentage: number;
        affected_daos: string[];
      };
      riskAssessment: {
        score: 1-10;
        factors: string[];
      };
    };
    dryRunResults: {
      assumedConditions: string[];
      failureModes: string[];
      sideEffects: string[];
    };
    timestamp: Date;
    validFor: "24 hours"; // simulation expires
  }
  ```
- [ ] Test with 5 real proposals from production
- [ ] Document assumptions + failure cases

*Afternoon: Escrow Release Simulation (4 hours)*
- [ ] Create escrow dry-run endpoint:
  ```typescript
  POST /api/escrow/:escrowId/simulate-release
  Returns:
  {
    escrowId: string;
    milestoneId: string;
    amountToRelease: number;
    recipientAddress: string;
    timeToDeliver: "1-2 business days";
    fees: {
      networkFee: number;
      platformFee: number;
      total: number;
    };
    remainingBalance: number;
    remainingMilestones: Milestone[];
  }
  ```
- [ ] Test with various escrow sizes + networks

**Day 3: Agent & Bot Simulations (8 hours)**

*Morning: Agent Action Simulation (4 hours)*
- [ ] Create agent dry-run endpoint:
  ```typescript
  POST /api/agents/:agentId/simulate-action
  Body: { actionType, proposedArgs, treasuryId }
  Returns:
  {
    agentId: string;
    proposedAction: string;
    simulatedOutcome: {
      treasuryDelta: number;
      positionsAffected: string[];
      gasEstimate: number;
      timeToExecute: number;
    };
    riskFactors: {
      slippage: number;
      priceImpact: number;
      liquidationRisk: boolean;
      cascadeRisk: string[];
    };
    failureModes: string[];
    alternativeActions: string[];
  }
  ```
- [ ] Integrate with existing risk analyzer
- [ ] Test with all 8 agents

*Afternoon: Bot Trading Backtest (4 hours)*
- [ ] Create bot backtest endpoint:
  ```typescript
  POST /api/bots/:botId/backtest
  Body: { 
    strategy,
    historicalData: "1_year" | "3_months" | "custom",
    constraints: { maxPerTrade, maxDaily, allowedPairs }
  }
  Returns:
  {
    botId: string;
    backtestPeriod: { start, end };
    performanceMetrics: {
      totalReturn: number;
      winRate: number;
      maxDrawdown: number;
      sharpeRatio: number;
    };
    trades: number;
    profitableTrades: number;
    averageWin: number;
    averageLoss: number;
    bestTrade: number;
    worstTrade: number;
    recommendations: string[];
    riskWarnings: string[];
  }
  ```
- [ ] Implement with live market data
- [ ] Create UI for backtest visualization

---

### Day 4-5 (Thurs-Fri, Feb 20-21): Universal Confirmation Workflows

**Day 4: Confirmation Modal Architecture (8 hours)**

*Morning: Design confirmation schema (4 hours)*
- [ ] Define `ConfirmationRequest` interface:
  ```typescript
  interface ConfirmationRequest {
    id: string;
    actionType: string; // 'RELEASE_ESCROW', 'ACTIVATE_BOT', 'EXECUTE_PROPOSAL'
    severity: 'low' | 'medium' | 'high' | 'critical';
    summary: string; // "Release $5,000 escrow to alice@example.com"
    narrative: {
      action: string;
      actor: { id: string; name: string; role: string };
      affectedResources: string[]; // users, DAOs, treasuries
      timeline: string; // "Executes immediately" or "Queued for 24 hours"
      reversibility: string; // "NO" or "Until Feb 20"
      cascades: string[] | null; // other systems affected
      maxDamage?: string; // "Could lose $10K if market moves 5%"
    };
    requiredConfirmations: number; // 1, 2, or 3
    confirmBy: Date;
    metadata: Record<string, any>;
  }
  ```
- [ ] Design confirmation response tracking
- [ ] Create confirmation state machine in DB

*Afternoon: Confirmation UI Components (4 hours)*
- [ ] Build React components:
  - `<ConfirmationModal/>` (main modal with narrative)
  - `<ActionSummary/>` (what's happening)
  - `<ImpactPreview/>` (before/after states)
  - `<RiskWarnings/>` (what could go wrong)
  - `<CascadeWarnings/>` (other systems affected)
  - `<AuditLog/>` (who's approving + when)
- [ ] Add accessibility features (large text, high contrast)
- [ ] Create storybook stories for all scenarios

**Day 5: Confirmation Integration & Testing (8 hours)**

*Morning: Backend confirmation service (4 hours)*
- [ ] Create `confirmationService`:
  ```typescript
  async createConfirmation(request: ConfirmationRequest): Promise<string>
  async submitConfirmation(confirmationId: string, userId: string, approved: boolean, reason?: string)
  async getConfirmationStatus(confirmationId: string): Promise<ConfirmationStatus>
  async getAllPendingConfirmations(userId: string): Promise<ConfirmationRequest[]>
  async revokeConfirmation(confirmationId: string, reason: string)
  ```
- [ ] Integrate with all 5 major systems
- [ ] Add confirmation deadline enforcement

*Afternoon: End-to-end testing (4 hours)*
- [ ] Test confirmation flow:
  - User initiates escrow release
  - System creates confirmation request
  - User sees modal with full narrative
  - User clicks "Approve" or "Decline"
  - Second approver sees pending confirmation
  - System executes after required approvals
  - Audit log records all confirmations
- [ ] Test with 10 different action types
- [ ] Load test: 100 concurrent confirmations

---

## WEEK 3: System-Specific Implementation (Feb 24-28)

### Day 6 (Monday, Feb 24): Governance & Escrow Systems

**Morning: Governance Reversibility (4 hours)**

Goals:
- [ ] Implement proposal cancellation with grace period
- [ ] Add cancellation reasons + audit trail
- [ ] Create cancellation confirmation workflow

Implementation:
```typescript
// New endpoint
POST /api/governance/proposals/:proposalId/cancel
Body: {
  reason: string; // "Risk score too high", "Market conditions changed"
  approvals: string[]; // signatures from 2-of-3
}

// Updates proposal state
Status: QUEUED → CANCELLATION_REQUESTED → CANCELLED

// Restoration: revert queued actions, refund any fees
// Grace period: 24 hours to cancel before execution

// Audit log entry
{
  actionType: 'PROPOSAL_CANCELLED',
  proposalId: string;
  cancelledBy: userId;
  cancelledAt: Date;
  reason: string;
  reversedState: { status: 'QUEUED' };
  approvals: [{ userId, timestamp }];
}
```

- [ ] Add UI button "Cancel Proposal" (only during grace period)
- [ ] Show 48-hour countdown to execution
- [ ] Display cancellation reason required field

**Afternoon: Escrow Reversibility (4 hours)**

Goals:
- [ ] Add "reversible" state to milestones
- [ ] Implement escrow release with grace period
- [ ] Add unreleased balance preview

Implementation:
```typescript
// Milestone states
PENDING → RELEASE_INITIATED → GRACE_PERIOD (24h) → RELEASE_EXECUTING → COMPLETED

// Pre-release confirmation shows:
{
  milestoneId: string;
  releaseTo: string;
  amount: number;
  remaining: number; // total escrow remaining after this release
  deliveryTime: "1-2 business days";
  fees: { network: 0.50, platform: 0.50 };
  canCancel: true;
  cancelUntil: Date;
}

// Cancellation
POST /api/escrow/:escrowId/milestones/:milestoneId/cancel-release
→ Refund to escrow, both parties notified
→ Audit trail records cancellation + reason
```

- [ ] Add "Cancel Release" button (24-hour window)
- [ ] Update escrow dashboard to show grace period status
- [ ] Test with real payment processing API

---

### Day 7 (Tuesday, Feb 25): Bot Trading & Investment Pools

**Morning: Bot Trading Reversibility (4 hours)**

Goals:
- [ ] Add bot pause/stop with position handling
- [ ] Implement trade strategy rollback
- [ ] Add emergency stop for runaway bots

Implementation:
```typescript
// Bot states
ACTIVE → PAUSE_REQUESTED → PAUSED

// Pause behavior
{
  onPause: {
    closeOpenTrades: boolean; // or hold?
    stopNewTrades: true;
    notification: "Bot paused. 1 open trade worth $5K"
  };
  gracePeriod: 0; // pauses immediately
  canResume: true;
  resumeUntil: null; // no expiry for paused state
}

// Emergency stop
POST /api/bots/:botId/emergency-stop
→ Closes all positions immediately
→ Disables bot permanently
→ Requires superuser approval if cascade risk detected

// Simulation before resume
POST /api/bots/:botId/simulate-resume
→ Shows: recent backtesting, pending orders, risk
```

- [ ] Add bot status dashboard showing grace period
- [ ] Create emergency stop triggers (circuit breaker)
- [ ] Test with various market conditions

**Afternoon: Investment Pools Reversibility (4 hours)**

Goals:
- [ ] Add rebalancing preview + approval
- [ ] Implement rebalancing rollback
- [ ] Add daily/weekly rebalance limits

Implementation:
```typescript
// Rebalancing workflow
1. System analyzes pool allocation
2. Creates rebalancing proposal with impact preview:
   {
     from: { USDC: 40%, ETH: 60% },
     to: { USDC: 50%, ETH: 50% },
     reason: "Drift > 10%",
     trades: [{ from: 'ETH', to: 'USDC', amount: '$1000' }],
     estimatedSlippage: 0.5%,
     gasCost: '$15'
   }
3. Waits for approval (user can preview + simulate)
4. Executes after grace period
5. Records rollback if market moves adverse

// Rollback state
if (realized_loss > 5%) {
  offer_rollback: true;
  revert_to: previous_allocation;
  deadline: 24_hours;
}
```

- [ ] Add "Preview Rebalancing" button
- [ ] Show before/after asset allocation
- [ ] Add rebalancing history + performance tracking

---

### Day 8 (Wednesday, Feb 26): Agent Actions & System Integration

**Morning: Agent Action Reversibility (4 hours)**

Goals:
- [ ] Implement agent action simulation
- [ ] Add approval workflow for high-risk actions
- [ ] Create action rollback mechanism

Implementation:
```typescript
// Agent action flow
PROPOSED → SIMULATED → PENDING_APPROVAL → GRACE_PERIOD → EXECUTED

// High-risk detection
if (treasuryDelta > $10K || slippage > 2% || hasAuthorizationEscalation) {
  requiresApproval = true;
  minApprovals = 2; // 2-of-3 board
}

// Rollback (within 1 hour of execution)
POST /api/agents/:agentId/actions/:actionId/rollback
→ Reverts trades, closes positions
→ Records reversal in audit trail
→ Compensates for slippage/fees
→ Notifies treasury manager

// Pre-action confirmation shows:
{
  agentId: string;
  proposedAction: string;
  simulatedDelta: number;
  riskScore: number;
  requiresApproval: boolean;
  approvals: [{ userId, timestamp }];
}
```

- [ ] Integrate with existing agent system
- [ ] Add rollback cost estimation
- [ ] Test with all 8 agent types

**Afternoon: Universal Confirmation Integration (4 hours)**

Goals:
- [ ] Wire up confirmations across all 5 systems
- [ ] Create confirmation dashboard
- [ ] Add audit logging for all confirmations

Implementation:
- [ ] Update all destructive endpoints to require confirmations:
  - Governance: propose, execute, cancel
  - Escrow: release milestone
  - Bots: activate, pause, stop
  - Pools: rebalance
  - Agents: execute action
- [ ] Create `/api/confirmations/pending` endpoint
- [ ] Add confirmation UI to all dashboards
- [ ] Implement confirmation expiry (24-48 hours)

---

### Day 9 (Thursday, Feb 27): Testing & Documentation

**Morning: Comprehensive Testing (4 hours)**

Test Scenarios:
- [ ] **Reversibility Test Suite** (20 scenarios)
  - Cancel proposal at hour 0, 12, 23, 24
  - Cancel escrow release at various states
  - Emergency stop bot during trade execution
  - Rollback agent action with price slippage
  - Cancel pool rebalancing mid-execution

- [ ] **Simulation Test Suite** (25 scenarios)
  - Governance: All proposal types + edge cases
  - Escrow: Various amounts + networks + fee structures
  - Agents: All 8 agent types + error conditions
  - Bots: Different strategies + market conditions
  - Pools: Various asset mixes + rebalancing triggers

- [ ] **Confirmation Test Suite** (15 scenarios)
  - Single user confirmation (low-risk)
  - Multi-sig confirmation (high-risk)
  - Partial approvals + rejections
  - Confirmation expiry timeout
  - Concurrent confirmations

- [ ] Load testing: 500 concurrent confirmations
- [ ] Performance testing: Simulations complete <2 seconds
- [ ] Failure mode testing: Network errors, DB failures, auth failures

**Afternoon: Documentation & Training (4 hours)**

Content:
- [ ] Create **Reversibility Guide** (user-facing):
  - When can each action be cancelled?
  - How to cancel + what happens
  - What "irreversible" means per system
  - FAQ: "Can I undo a completed escrow release?"

- [ ] Create **Simulation Guide** (developer):
  - When simulations are available
  - How to call simulation endpoints
  - Interpreting simulation results
  - Simulation accuracy + limitations

- [ ] Create **Confirmation Guide** (operational):
  - Confirmation workflow diagram
  - Role-based confirmations
  - Confirmation dashboard guide
  - Emergency stop procedures

- [ ] Update API documentation
- [ ] Record video walkthrough (5 mins each system)

---

### Day 10 (Friday, Feb 28): Final Integration & Handoff

**Morning: System Integration & Validation (4 hours)**

Integration Tests:
- [ ] Test cross-system reversibility:
  - Agent executes trade → triggers pool rebalancing → requires confirmation
  - Governance proposal affects multiple treasuries
  - Escrow release cascades to payment confirmation

- [ ] Validate all audit trails:
  - Every reversible action logged
  - Every cancellation + reason recorded
  - Every confirmation tracked
  - Every simulation + result stored

- [ ] Performance validation:
  - All simulations < 2 seconds
  - Confirmations display < 1 second
  - Reversibility checks < 500ms

- [ ] Security validation:
  - Authorization checks on all reversals
  - Rate limiting on confirmations
  - Signature verification on multi-sigs

**Afternoon: Deployment & Handoff (4 hours)**

Deployment:
- [ ] Database migrations to staging
- [ ] Deploy reversibility service
- [ ] Deploy simulation endpoints
- [ ] Deploy confirmation workflows
- [ ] Deploy UI components
- [ ] Run smoke tests in staging
- [ ] Prepare rollback plan

Handoff:
- [ ] Complete audit trail validation report
- [ ] Run final security checklist
- [ ] Document known limitations
- [ ] Create incident response playbook:
  - What if confirmation system goes down?
  - What if reversibility fails?
  - What if simulation gives wrong result?

- [ ] Schedule sign-off meeting with tech leads
- [ ] Plan Week 4 testing phase

**Success Criteria for Week 2-3:**
- ✅ All 5 systems have reversibility implemented + tested
- ✅ All destructive actions have simulation endpoints
- ✅ All high-risk actions have confirmation workflows
- ✅ Audit logging for all reversibility actions
- ✅ User-facing + developer documentation complete
- ✅ Comprehensive test coverage (100+ test cases)
- ✅ Performance benchmarks met (< 2second simulations)
- ✅ Ready for Week 4 security audit

---

## Resource Allocation

### Team Setup (2 Engineers)

**Engineer A: Platform & Backend**
- Days 1-2: Architecture + Database
- Days 3-5: Simulation Engines (all systems)
- Days 6-8: Backend reversibility implementation
- Days 9-10: Integration testing + deployment

**Engineer B: Frontend & Integration**
- Days 1: Help design patterns
- Days 4-5: Confirmation UI components
- Days 6-8: Frontend integration (all systems)
- Days 9-10: E2E testing + documentation

### Dependencies Management

**External Dependencies:**
- Day 3: Need access to production agent data for simulation testing
- Day 3: Need pricing API access for bot backtest data
- Day 6: Need payment processing API for escrow simulation
- Days 9-10: Staging environment must mirror production

**Internal Dependencies:**
- Must complete Week 1 emergency fixes first
- Risk analyzer service (for agent/bot simulations)
- Admin approval board system (for confirmations)

---

## Deliverables Checklist

### Code
- [ ] `reversibilityService.ts` - Universal reversal pattern
- [ ] `simulationService.ts` - All system simulations
- [ ] `confirmationService.ts` - Confirmation workflow
- [ ] Database migrations - action tracking tables
- [ ] React components - confirmation UI + dashboards
- [ ] API endpoints - 15+ new endpoints across systems

### Documentation
- [ ] Architecture documentation - reversibility pattern
- [ ] User guides - How to reverse/cancel actions
- [ ] API documentation - Simulation + confirmation endpoints
- [ ] Operational guide - Confirmation dashboard + audit logs
- [ ] Incident playbook - Failure scenarios + responses

### Testing
- [ ] Unit tests - 50+ test cases
- [ ] Integration tests - 25+ cross-system scenarios
- [ ] Load tests - 500+ concurrent confirmations
- [ ] Security tests - Authorization + signatures
- [ ] E2E tests - Full user workflows

### Training
- [ ] Video walkthroughs - Each system (5 videos × 5 mins)
- [ ] Live demo - Reversibility + confirmations
- [ ] Runbook - Operating confirmation system
- [ ] FAQ - Common questions + troubleshooting

---

## Risk Mitigation

**Schedule Risks:**
- *Risk:* Simulation engine takes longer than estimated
- *Mitigation:* Design simple MVP first, add complexity in Week 4
- *Fallback:* Use existing risk analyzer as-is if new simulator blocked

**Technical Risks:**
- *Risk:* Reversibility state machine has race conditions
- *Mitigation:* Use database transactions + state locks
- *Fallback:* Implement pessimistic locking if optimistic fails

**Integration Risks:**
- *Risk:* Confirmation system doesn't work with all 5 systems
- *Mitigation:* Weekly integration tests starting Day 6
- *Fallback:* Implement per-system confirmation adapters

---

## Success Metrics (Week 2-3)

| Metric | Target | Acceptance |
|--------|--------|-----------|
| Reversibility Coverage | 100% of 5 systems | All destructible actions reversible |
| Simulation Coverage | 100% of systems | All high-risk actions simulatable |
| Confirmation Coverage | 100% critical actions | All critical actions need approval |
| Audit Trail Completeness | 100% | Every action logged |
| Test Pass Rate | 95%+ | <5% flaky tests |
| Performance - Simulations | <2sec | p95 latency |
| Performance - Confirmations | <1sec | Modal displays quickly |
| Deployment Readiness | 100% | 0 blockers for launch |

---

**Next Phase:** Week 4 - Independent Security Audit + Validation
