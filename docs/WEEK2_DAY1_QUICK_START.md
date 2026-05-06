# Week 2 Day 1: Quick Start Guide

**Objective:** Universal reversibility pattern foundation for all high-power actions

---

## What Was Built

### 3 New Services
1. **ReversibilityService** - Manages action lifecycle (create → confirm → grace period → execute → irreversible)
2. **EmergencyStopService** - Circuit breaker + emergency stop mechanism
3. Database schema with PostgreSQL triggers for automatic audit trail

### Key Files
```
server/types/reversibility.ts              - 15 enums + 20 interfaces (630 lines)
server/services/reversibilityService.ts    - Lifecycle management (629 lines)
server/services/emergencyStopService.ts    - Circuit breaker + emergency stop (362 lines)
server/migrations/012-action-reversals-tracking.ts  - Main schema (180 lines)
server/migrations/013-emergency-stop-tracking.ts    - Emergency tracking (130 lines)
```

---

## State Machine (Guaranteed Flow)

```
INITIATED → PENDING_CONFIRMATION → GRACE_PERIOD → EXECUTED → IRREVERSIBLE

Can reverse:
  - GRACE_PERIOD: Always
  - REVERSIBLE_UNTIL: Final warning
  - EXECUTED: If not past reversalDeadlineHours
  
Emergency stop:
  - ANY STATE → EMERGENCY_STOPPED
  - Circuit breaker opens
  - Queued actions reversed
```

---

## Severity & Grace Periods

| Level | Grace | Approval | Who Can Reverse |
|-------|-------|----------|---|
| LOW | 24h | None | Initiator |
| MEDIUM | 48h | 1 moderator | Initiator, Admin |
| HIGH | 72h | 2-of-3 board | Initiator, Admin, Governance |
| CRITICAL | 7d | Superuser+Board+CEO | All |

---

## Usage: Create Reversible Action

```typescript
import { ReversibilityService } from './services/reversibilityService';
import { ActionSeverity, ActorType } from './types/reversibility';

const reversibilityService = new ReversibilityService(db);

// Example: Kill-switch for runaway agent
const action = await reversibilityService.createReversibleAction({
  actionType: 'AGENT_PAUSE',
  description: 'Emergency pause of KAIZEN agent',
  severity: ActionSeverity.CRITICAL,
  initiator: { id: 'admin-1', type: ActorType.ADMIN, role: 'SUPERUSER' },
  affectedEntity: { type: 'AGENT', id: 'agent-kaizen', name: 'KAIZEN' },
  actionPayload: { pause: true },
  beforeState: { is_active: true },
  afterState: { is_active: false },
  confirmationRequirement: { 
    type: 'APPROVAL_BOARD', 
    requiredApprovals: 2, 
    confirmationTimeoutMinutes: 60 
  },
  gracePeriodConfig: { 
    durationHours: 72, 
    reminderHoursBefore: [24, 6, 1],
    autoExecuteAtDeadline: false 
  },
  reversibilityScope: {
    fields: ['is_active'],
    initiatorCanReverse: true,
    adminCanReverse: true,
    governanceCanReverse: true,
    reversalDeadlineHours: 168 // 7 days
  }
});

// Now action ID can be used to track lifecycle
console.log(action.status); // 'INITIATED'
console.log(action.gracePeriodEndsAt); // Date 72 hours in future
```

---

## Usage: Record Approval

```typescript
// When approver votes
await reversibilityService.recordApproval(
  action.id,
  'member-2',
  'GOVERNANCE_MEMBER',
  'Looks good, emergency justified'
);

// Check approvals
const approvals = await reversibilityService.getApprovals(action.id);
console.log(approvals.length); // How many so far
```

---

## Usage: Reverse Action

```typescript
// User wants to cancel during grace period
await reversibilityService.reverseAction({
  actionId: action.id,
  reason: ReversalReason.USER_CANCELLATION,
  reversedBy: { id: 'admin-1', type: ActorType.ADMIN, role: 'SUPERUSER' },
  reversalReason: 'False alarm - agent behaving normally now'
});

// Action now in REVERSED state
const updated = await reversibilityService.getActionById(action.id);
console.log(updated.status); // 'REVERSED'
console.log(updated.reversedAt); // Timestamp
```

---

## Usage: Circuit Breaker

```typescript
import { EmergencyStopService } from './services/emergencyStopService';

const emergencyStopService = new EmergencyStopService(db, reversibilityService);

// Before executing action, check circuit breaker
const allowed = await emergencyStopService.checkCircuitBreaker('AGENT_ACTION');
if (!allowed) {
  throw new Error('Circuit breaker open - no new agent actions');
}

// If runaway detected, trigger emergency stop
await emergencyStopService.triggerEmergencyStop(
  'AGENT_ACTION',
  { id: 'system', type: ActorType.SYSTEM },
  'Agent exceeded 20 actions/hour threshold',
  ['action-id-1', 'action-id-2', ...] // To reverse
);

// Circuit breaker is now OPEN for 30 minutes
// All listed actions reversed
// Auto-resets after cooldown
```

---

## Thresholds (Circuit Breaker)

```typescript
AGENT_ACTION: 20/hour          // ~1 action every 3 minutes max
ADMIN_USER_OPERATION: 50/30min // ~1 user op every 36 seconds max
GOVERNANCE_PROPOSAL_EXECUTION: 10/day
BOT_TRADE: 100/hour
ESCROW_RELEASE: 25/hour
```

---

## Integration Checklist

For each system, implement this pattern:

```typescript
// 1. Create reversible action
const action = await reversibilityService.createReversibleAction({
  // config with severity, grace period, scope
});

// 2. Store action ID with any related record
// Example: INSERT INTO proposals(id, reversal_action_id) VALUES (proposal_id, action.id)

// 3. During grace period
// - Send reminders at configured intervals
// - Allow user to cancel via reverseAction()
// - Log all interactions

// 4. After grace period
// - Execute the actual change
// - Call executedAction()
// - State transition automatic via database

// 5. If reversal needed
// - Call reverseAction() with reason
// - Auto-revert associated state
// - Send notifications
```

---

## Day 2 Prep

**Tomorrow:** Build simulation engines for all 5 systems

Each system will have:
- `POST /api/simulate-{action}` endpoint
- Shows beforeState → afterState impact
- No actual database changes
- Used before confirmation

Example:
```
POST /api/simulate-proposal-execution
{
  proposalId: "prop-123",
  expectedTreasuryImpact: -500000,
  affectedUsers: 234,
  estimatedGasImpact: 50
}
```

---

## Success Criteria: Day 1 ✅

- [x] Type system defined (15 enums + 20 interfaces)
- [x] ReversibilityService with lifecycle methods
- [x] EmergencyStopService with circuit breaker
- [x] Database schema with 3 tables + indexes + triggers
- [x] State machine validated with PostgreSQL constraints
- [x] Audit trail automatic via triggers
- [x] Zero TypeScript errors on new code
- [x] Ready for integration across all 5 systems
- [x] Documentation complete with examples

---

## Files Ready for Week 2 Days 2-5 Integration

✅ `server/types/reversibility.ts` - All types for all systems
✅ `server/services/reversibilityService.ts` - Lifecycle engine
✅ `server/services/emergencyStopService.ts` - Safety mechanisms
✅ `server/migrations/012-action-reversals-tracking.ts` - Action schema
✅ `server/migrations/013-emergency-stop-tracking.ts` - Emergency schema

**Next:** Deploy migrations and build 5 simulation engines (Day 2)
