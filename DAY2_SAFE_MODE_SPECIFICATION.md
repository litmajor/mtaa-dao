# Day 2 Implementation Plan: Safe Mode + Admin Auth Integration
**Date:** February 14, 2026  
**Status:** PLANNING  
**Power Checklist Items:** 11/11 ✅ (All items + advanced features)

---

## 🎯 Day 2 Objectives

### 1. **Safe Mode: Proposal-Only Execution**
Agents can propose actions but cannot execute them. All proposed actions go to admin queue for review/approval.

**What This Does:**
- Agent generates action proposal (e.g., "Swap 100 USDC for 95 wETH")
- Action is NOT executed immediately
- Admin sees proposal in dashboard with risk analysis
- Admin reviews 3 options: **✅ Approve**, ❌ **Reject**, 🔧 **Modify**
- If approved, agent executes (or admin executes on behalf)
- If rejected, agent gets feedback and can propose different approach
- Full audit trail of all proposals + approvals

**Database Changes:**
- New table: `agent_proposals` with columns:
  - `id`, `agent_id`, `action_type`, `proposed_args`, `risk_score`, `status`
  - `created_at`, `approved_by`, `approved_at`, `executed_at`, `rejection_reason`

**Services:**
- `agentProposalService.ts` - Create, list, approve, reject proposals
- `proposalRiskAnalyzer.ts` - Score risk (amount, volatility, frequency, etc.)

**API Endpoints:**
```
POST   /api/admin/agents/:agentId/propose         # Agent submits proposal
GET    /api/admin/proposals                        # List all proposals (pending + history)
GET    /api/admin/proposals/:proposalId            # View single proposal details
POST   /api/admin/proposals/:proposalId/approve    # Admin approves
POST   /api/admin/proposals/:proposalId/reject     # Admin rejects
POST   /api/admin/proposals/:proposalId/modify     # Edit risk params + re-propose
```

**Frontend:**
- `ProposalQueueCard.tsx` - Shows pending proposals with risk indicators
- `ProposalDetailModal.tsx` - Full proposal review with decision buttons
- `ProposalHistory.tsx` - Timeline of all proposals + actions taken

---

### 2. **Admin Auth Integration**
Connect kill-switch + safe mode to existing admin auth system (from earlier phases).

**What This Does:**
- All actions (kill-switch, reactivate, approve/reject proposals) require superuser auth
- Actions logged to admin audit table: `admin_action_log`
- Superuser role from existing auth is primary check
- Could add role-based granularity later (e.g., "proposal_reviewer" role)

**Database:**
- Use existing `admin_users` table for actor identification
- Create `admin_action_log` table:
  ```
  id | admin_user_id | action_type | resource_type | resource_id | 
  before_state | after_state | reason | created_at | ip_address
  ```

**API Changes:**
- Add middleware: `requireSuperuser()` to all agent control endpoints
- Add middleware: `logAdminAction()` to capture before/after + actor
- Return 403 if not superuser
- Reject request if auth token missing/invalid

**Services:**
- `adminAuthService.ts` - Verify superuser, extract actor info, validate session
- `adminAuditLogger.ts` - Log actions to admin_action_log table
- Extend existing auth flow from Phase 4

---

### 3. **Dashboard Unification**
Show all agent controls in one place: Status + Safe Mode + Auth Info

**Frontend Layout:**
```
┌─────────────────────────────────────────────────┐
│  AGENT CONTROL DASHBOARD                        │
├─────────────────────────────────────────────────┤
│                                                 │
│  Agent Name: KAIZEN                             │
│  Status: 🟢 ACTIVE  | Auth: ✅ Superuser      │
│                                                 │
│  ┌── PENDING PROPOSALS (3) ───────────────────┐ │
│  │  • Swap 100 USDC → wETH (Risk: 🟡 Medium) │ │
│  │  • Claim rewards (Risk: 🟢 Low)            │ │
│  │  • Rebalance pool (Risk: 🟠 High)          │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  ┌── RECENT ACTIVITY ──────────────────────────┐ │
│  │  2026-02-14 14:30 | Proposal Approved       │ │
│  │  2026-02-14 14:15 | 12 actions executed     │ │
│  │  2026-02-14 13:45 | Circuit breaker reset   │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  [Approve Proposal] [View History] [Kill Switch] │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Components:**
- `AgentControlDashboard.tsx` - Main container (unifies Day 1 + Day 2)
- Enhanced `AgentStatusCard.tsx` - Add auth info
- New `ProposalQueueCard.tsx` - Shows pending approvals

---

## 📋 Day 2 Checklist

### Phase 2A: Database + Services (4 hours)
- [ ] Create `agent_proposals` migration
- [ ] Create `admin_action_log` migration
- [ ] Create `agentProposalService.ts` (CRUD, list pending)
- [ ] Create `proposalRiskAnalyzer.ts` (score calculation)
- [ ] Create `adminAuthService.ts` (verify + extract actor)
- [ ] Create `adminAuditLogger.ts` (log actions)
- [ ] Write migrations to test suite
- [ ] Test all services locally

### Phase 2B: API Endpoints (2 hours)
- [ ] Mount routes in `admin-agents-kill-switch.ts` (or new `admin-agent-proposals.ts`)
- [ ] Add auth middleware to all endpoints
- [ ] Add audit logging wrapper
- [ ] Add request validation (reason, amount, etc.)
- [ ] Test with Postman/curl

### Phase 2C: Frontend (3 hours)
- [ ] Create `ProposalQueueCard.tsx` (list + approve/reject buttons)
- [ ] Create `ProposalDetailModal.tsx` (full review)
- [ ] Create `ProposalHistory.tsx` (timeline)
- [ ] Update `AgentStatusCard.tsx` (add auth badge)
- [ ] Create `AgentControlDashboard.tsx` (unify all)
- [ ] Add CSS for new components

### Phase 2D: Testing + Polish (2 hours)
- [ ] Add tests for all new services
- [ ] Add API integration tests
- [ ] Test auth flow (superuser required)
- [ ] Test proposal workflow (propose → approve → execute)
- [ ] Add error handling + user feedback
- [ ] Update documentation

---

## 💡 Key Decisions & Trade-offs

### Q: Why proposal-only mode instead of just manual approval?
**A:** Agents proposed actions instantly, which is flexible but risky. Safe mode lets agents auto-execute low-risk proposals while requiring approval for important ones.

### Q: What makes a proposal "high risk"?
**A:** 
- **Amount**: Large % of treasury (e.g., > 10%)
- **Frequency**: Multiple actions in short time (sign of runaway?)
- **Type**: Swap (medium risk) > Bridge (high risk) > Claim (low risk)
- **Volatility**: High slippage possible (if price volatile)
- **Historical**: Similar proposal failed recently

Score = weighted formula → 0-100 → 🟢 (0-33) / 🟡 (34-66) / 🟠 (67-100)

### Q: How long should proposals wait for approval?
**A:** 
- **Low risk** (< 33): Auto-execute after 5 min if no rejection
- **Medium risk** (34-66): Require explicit approval, max 1 hour
- **High risk** (67-100): Require explicit approval + security review, max 4 hours
- **After deadline**: Auto-reject, agent can re-propose

### Q: Who can approve proposals?
**A:** 
- **Phase 2**: Any superuser (same as who can use kill-switch)
- **Phase 5 (Week 2)**: Add 2-of-3 approval board (governance vote)

---

## 🔍 Risk Analysis Examples

### Example 1: Low Risk ✅
```
Action: Claim AAVE rewards (0.5 AAVE)
Risk Breakdown:
  • Amount: 0.02% of treasury → 0 points
  • Frequency: 1 claim/day (normal) → 0 points  
  • Type: Claim (safe) → 0 points
  • Volatility: N/A → 0 points
Risk Score: 🟢 0/100 (GREEN)
Action: Auto-execute after 5 min if not rejected
```

### Example 2: Medium Risk ⚠️
```
Action: Swap 500 USDC for wETH
Risk Breakdown:
  • Amount: 2% of treasury → 20 points
  • Frequency: 3 swaps today (elevated) → 15 points
  • Type: Swap (medium risk) → 15 points
  • Slippage: <0.5% (safe) → 0 points
Risk Score: 🟡 50/100 (YELLOW)
Action: Requires explicit superuser approval
```

### Example 3: High Risk 🚨
```
Action: Bridge 100 USDC to Polygon
Risk Breakdown:
  • Amount: 5% of treasury → 30 points
  • Frequency: 2nd bridge in 2 hours → 20 points
  • Type: Bridge (high risk) → 30 points
  • New chain: Polygon (untested) → 20 points
Risk Score: 🟠 100/100 (RED)
Action: Requires explicit approval + security review
```

---

## 📊 Database Schema (New Tables)

### agent_proposals
```sql
CREATE TABLE agent_proposals (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id),
  
  -- Proposal content
  action_type VARCHAR(50) NOT NULL,  -- 'SWAP', 'BRIDGE', 'CLAIM', etc.
  proposed_args JSONB NOT NULL,      -- { to, amount, minOut, ... }
  
  -- Risk scoring
  risk_score INT NOT NULL DEFAULT 0,
  risk_category VARCHAR(20),         -- 'LOW', 'MEDIUM', 'HIGH'
  risk_breakdown JSONB,              -- { amount, frequency, volatility, ... }
  
  -- Status flow
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, EXECUTED, EXPIRED
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Approval info
  approved_by UUID REFERENCES admin_users(id),
  approved_at TIMESTAMP,
  
  -- Rejection info
  rejected_by UUID REFERENCES admin_users(id),
  rejection_reason TEXT,
  rejected_at TIMESTAMP,
  
  -- Execution
  executed_at TIMESTAMP,
  execution_hash VARCHAR(255),       -- tx hash if executed on-chain
  
  -- Timeout
  expires_at TIMESTAMP NOT NULL,
  
  -- Audit
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  INDEX(agent_id),
  INDEX(status),
  INDEX(created_at),
  INDEX(expires_at)
);
```

### admin_action_log
```sql
CREATE TABLE admin_action_log (
  id UUID PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES admin_users(id),
  
  -- What happened
  action_type VARCHAR(50) NOT NULL,  -- 'KILL_SWITCH', 'REACTIVATE', 'APPROVE_PROPOSAL', etc.
  resource_type VARCHAR(50) NOT NULL, -- 'AGENT', 'PROPOSAL', 'AGENT_CONFIG'
  resource_id UUID NOT NULL,
  
  -- State change
  before_state JSONB,
  after_state JSONB,
  
  -- Context
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  INDEX(admin_user_id),
  INDEX(action_type),
  INDEX(resource_type),
  INDEX(created_at)
);
```

---

## 🔄 Workflow Diagrams

### Proposal Lifecycle
```
┌─────────────────────────────────────────────────────────┐
│  AGENT GENERATES PROPOSAL                               │
│  "Swap 100 USDC for wETH"                               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │ RISK ANALYSIS            │
         │ Calculate risk_score     │
         │ Assign category          │
         └──────────┬──────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
   LOW RISK (0-33)         MEDIUM RISK (34-66)    HIGH RISK (67-100)
   Auto-execute            Need approval          Need approval +
   after 5 min             Max 1 hour             security review
        │                       │                      │
        │            ┌──────────┴──────────┐           │
        │            │                     │           │
        ▼            ▼                     ▼           ▼
    APPROVE      REJECT                APPROVE      SECURITY
    EXECUTE               (feedback)    EXECUTE      REVIEW
        │                   │               │           │
        └───────────┬───────┴───────────────┴───────────┘
                    │
                    ▼
        ┌────────────────────────┐
        │ AUDIT LOG ENTRY        │
        │ - Who approved         │
        │ - When                 │
        │ - Reason provided      │
        │ - Risk category        │
        └────────────────────────┘
```

### Admin Auth Flow
```
┌──────────────────────────────────────┐
│  ADMIN ACTION REQUEST                │
│  (Approve Proposal / Kill-Switch)    │
└──────────────────┬───────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ CHECK AUTH TOKEN     │
        │ Valid & not expired? │
        └──────────┬───────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    NO  ▼                     ▼  YES
   401 ┌──────────────────┐  401 ┌──────────────────┐
   Unauthorized EXTRACT ACTOR    Unauthorized
              │ - User ID         │
              │ - Role            │
              │ - IP Address      │
              └────────┬──────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │ CHECK SUPERUSER ROLE │
            │ is_superuser == true │
            └──────────┬───────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
    NO  ▼                             ▼  YES
   403 ┌──────────────────┐  ┌──────────────────┐
   Forbidden PROCESS REQUEST │ ALLOWED          │
              │              │ 200 OK           │
              │              │ + JSON response  │
              │              └────────┬─────────┘
              │                       │
              └───────────┬───────────┘
                          │
                          ▼
            ┌──────────────────────┐
            │ LOG TO AUDIT TABLE   │
            │ - User ID            │
            │ - Action type        │
            │ - Before/after state │
            │ - Timestamp          │
            │ - IP address         │
            └──────────────────────┘
```

---

## 📝 API Request/Response Examples (Day 2)

### Propose Action
```bash
POST /api/admin/agents/agent-kaizen/propose
Content-Type: application/json
Authorization: Bearer $ADMIN_TOKEN

{
  "action_type": "SWAP",
  "proposed_args": {
    "tokenIn": "USDC",
    "amountIn": 100,
    "tokenOut": "wETH",
    "minAmountOut": 0.05,
    "slippage": 0.005
  }
}
```

**Response (201 Created):**
```json
{
  "proposal": {
    "id": "prop-123",
    "agent_id": "agent-kaizen",
    "status": "PENDING",
    "created_at": "2026-02-14T10:00:00Z",
    "expires_at": "2026-02-14T11:00:00Z"
  },
  "risk_analysis": {
    "score": 45,
    "category": "MEDIUM",
    "breakdown": {
      "amount": "2% of treasury",
      "frequency": "3rd swap today",
      "type": "SWAP",
      "slippage": "<0.5%"
    },
    "recommendation": "Requires explicit approval"
  },
  "next_action": "POST /api/admin/proposals/prop-123/approve"
}
```

### List Pending Proposals
```bash
GET /api/admin/proposals?status=PENDING
Authorization: Bearer $ADMIN_TOKEN
```

**Response:**
```json
{
  "totalProposals": 3,
  "pendingProposals": [
    {
      "id": "prop-123",
      "agent": "KAIZEN",
      "action": "Swap 100 USDC for wETH",
      "riskScore": 45,
      "riskCategory": "MEDIUM",
      "createdAt": "2026-02-14T10:00:00Z",
      "expiresAt": "2026-02-14T11:00:00Z",
      "timeSinceProposal": "15 minutes"
    },
    {
      "id": "prop-124",
      "agent": "FRACTIONATOR",
      "action": "Claim AAVE rewards",
      "riskScore": 5,
      "riskCategory": "LOW",
      "createdAt": "2026-02-14T09:45:00Z",
      "expiresAt": "2026-02-14T09:50:00Z",
      "autoExecutesIn": "Approved"
    }
  ]
}
```

### Approve Proposal
```bash
POST /api/admin/proposals/prop-123/approve
Content-Type: application/json
Authorization: Bearer $ADMIN_TOKEN

{
  "reason": "Risk score is acceptable, slippage is minimal",
  "authActor": "superuser-456"  // auto-filled from token
}
```

**Response (200 OK):**
```json
{
  "powerChecklistItems": [1, 2, 3, 6, 7, 8, 9, 10],
  "success": true,
  "proposal": {
    "id": "prop-123",
    "status": "APPROVED",
    "approved_by": "superuser-456",
    "approved_at": "2026-02-14T10:15:00Z",
    "reason": "Risk score is acceptable, slippage is minimal"
  },
  "narrative": {
    "action": "Proposal Approved",
    "impact": {
      "agent": "KAIZEN",
      "effect": "Will execute swap action as proposed",
      "dataLoss": false
    },
    "timeline": {
      "approvedAt": "2026-02-14T10:15:00Z",
      "approvedBy": "Team Lead (superuser)",
      "authority": "superuser",
      "reversible": "YES - use POST /reject anytime before execution"
    }
  },
  "auditLog": {
    "id": "audit-789",
    "actionType": "APPROVE_PROPOSAL",
    "actor": "superuser-456",
    "timestamp": "2026-02-14T10:15:00Z",
    "ipAddress": "192.168.1.100"
  }
}
```

### Reject Proposal
```bash
POST /api/admin/proposals/prop-125/reject
Content-Type: application/json
Authorization: Bearer $ADMIN_TOKEN

{
  "reason": "Risk score too high (95/100). Bridge to unknown chain needs more testing."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "proposal": {
    "id": "prop-125",
    "status": "REJECTED",
    "rejected_by": "superuser-456",
    "rejected_at": "2026-02-14T10:30:00Z",
    "rejection_reason": "Risk score too high..."
  },
  "feedback_to_agent": "Your bridge proposal was rejected due to high risk. Please reduce amount or wait for security review of Polygon integration."
}
```

---

## 🧪 Testing Strategy (Day 2)

### Service Tests
- `proposalRiskAnalyzer.test.ts` - Test risk scoring logic
- `agentProposalService.test.ts` - Test CRUD operations
- `adminAuthService.test.ts` - Test auth flow
- `adminAuditLogger.test.ts` - Test logging

### Integration Tests
- Test full proposal workflow: propose → approve → execute
- Test rejection flow: propose → reject → feedback to agent
- Test auto-execution for low-risk proposals
- Test expiration handling (proposal expires if not approved)
- Test auth middleware (reject unauthenticated requests)
- Test audit logging (all actions are recorded)

### E2E Tests
- Agent submits safe-mode proposal
- Admin reviews in dashboard
- Admin approves with reason
- Action executes on-chain
- Audit trail shows full history

---

## 🚀 Deployment Timeline (Day 2)

| Time | Task | Deliverable |
|------|------|---|
| 09:00 - 13:00 | Database + Services | 6 new services, 2 migrations, tests |
| 13:00 - 15:00 | API Endpoints | 5 new routes, auth middleware |
| 15:00 - 18:00 | Frontend | 4 new components, dashboard |
| 18:00 - 20:00 | Testing + Polish | All tests pass, E2E works |
| 20:00 - 22:00 | Documentation | Quick start + API docs + troubleshooting |

---

## 📝 Dependencies & Integration Points

### Must Exist Before Day 2:
- ✅ `agents` table (from Day 1)
- ✅ `agent_state_history` table (from Day 1)
- ✅ `admin_users` table (from Phase 4)
- ✅ Auth middleware that validates JWT (from Phase 4)
- ✅ `AgentStatusCard.tsx` component (from Day 1)

### New for Day 2:
- 🆕 `agent_proposals` table
- 🆕 `admin_action_log` table
- 🆕 `agentProposalService.ts`
- 🆕 `proposalRiskAnalyzer.ts`
- 🆕 `adminAuthService.ts` (extends existing auth)
- 🆕 `adminAuditLogger.ts`
- 🆕 API routes (5 endpoints)
- 🆕 Frontend components (3-4 new)

### Reuses from Day 1:
- Kill-switch / reactivation logic
- Admin auth tokens
- Audit trail patterns
- UI/UX design system

---

## ✨ Final Notes

**Day 1 + Day 2 = Complete System:**
- ✅ Kill-switch: Pause runaway agents (emergency)
- ✅ Safe mode: Require approval for all actions (risk-based)
- ✅ Admin auth: Track who did what (accountability)
- ✅ Audit trail: Full history for compliance
- ✅ Power checklist: 11/11 items implemented

**Ready for DAO Governance:**
- Agents can't "runaway" (kill-switch + circuit breaker)
- Agents can't execute without approval (safe mode)
- All actions are logged (audit trail)
- Admins are authenticated (role-based access)
- Easy to extend (approval board, soft deletes, etc.)

---

**Next Steps:** 
1. Review this spec
2. Ask questions or request changes
3. Build Day 2 code when ready
4. Day 3: Governance integration (vote on actions)

