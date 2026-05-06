# Escrow vs Bounty-Escrow Architecture - Design Refinement

## Executive Summary

**Current Design Intent** ✅
- **Escrow** (23 routes): Standard peer-to-peer financial mechanism accessible to all users
- **Bounty-Escrow** (5 routes): Task-specific funding mechanism for DAOs managing task rewards

**Issue Identified** ⚠️
- Bounty-escrow release operation has authorization checks in handler code only
- Missing middleware-level security enforcement for financial operations
- No rate limiting or second auth layer on critical operations

**Solution:** Establish clear architectural tiers with proper middleware enforcement

---

## Architectural Design

### Layer 1: Standard Escrow (Wallet-based, User-to-User)

**Purpose:** P2P financial transactions between users with milestone support

**Access:**
- ✅ Individual users
- ✅ Invite-based (shareable links)
- ✅ Full milestone workflow

**Example Flows:**
1. User A creates escrow for User B (wants to send funds safely)
2. User B accepts via invite link
3. Parties negotiate milestones
4. User B completes work
5. User A releases payment

**Route Characteristics:**
- 23 routes total
- Each route has explicit per-route middleware
- Mix of public and authenticated endpoints
- Ownership/party verification via `verifyEscrowParty()`

**Routes:**
```
GET    /api/escrow/invite/:inviteCode          [PUBLIC]
POST   /api/escrow/initiate                    [authenticate]
POST   /api/escrow/accept/:inviteCode           [authenticate]
POST   /api/escrow/:escrowId/fund               [authenticate + verifyParty]
POST   /api/escrow/:escrowId/release            [authenticate + verifyParty]
POST   /api/escrow/:escrowId/refund             [authenticate + verifyParty]
POST   /api/escrow/:escrowId/dispute            [authenticate + verifyParty]
POST   /api/escrow/:escrowId/milestones/:num/*  [authenticate + verifyParty]
GET    /api/escrow/:escrowId                    [authenticate + verifyParty]
GET    /api/escrow/my-escrows                   [authenticate]
POST   /api/escrow/:escrowId/guardians/*        [authenticate + guardianLogic]
... and more
```

**Security Model:**
- Each financial operation requires `authenticate` middleware
- Ownership/party checks via `verifyEscrowParty(escrowId, userId)`
- Guardian system for additional workflow verification

---

### Layer 2: Bounty-Escrow (DAO Task Management)

**Purpose:** DAO-managed bounty system where funds are held for task completion

**Access:**
- ✅ Task creators (hold funds)
- ✅ DAO admins/moderators (release funds)
- ✅ Task claimants (receive funds)

**Example Flows:**
1. DAO creates task with bounty
2. Admin deposits bounty amount to escrow
3. User claims / completes task
4. Admin or task creator releases bounty to claimant

**Route Characteristics:**
- 5 routes total (more compact)
- Router-level `authenticate` middleware on all routes
- Authorization checks in handler (task creator / DAO admin role)
- Missing: Rate limiting, second auth layer, audit logging

**Current Routes:**
```
POST   /api/bounty-escrow           [authenticate]  ← Create escrow
POST   /api/bounty-escrow/release   [authenticate]  ← FINANCIAL RELEASE ⚠️
POST   /api/bounty-escrow/dispute   [authenticate]
GET    /api/bounty-escrow/:taskId   [authenticate]
GET    /api/bounty-escrow/*/escrow  [authenticate]
```

**Current Security Model:**
- ✅ Basic `authenticate` middleware
- ✅ Role checks in handler (creator / dao admin)
- ❌ No rate limiting
- ❌ No second auth for high-value release
- ❌ No audit logging
- ❌ No webhook verification if used later

---

## Recommended Security Tiers

### Financial Operation: Low Amount (< $100 USD equivalent)
```
Middleware:
  1. authenticate
  2. (optional) Rate limit: 10 ops/min per user
  
Handler:
  - Role verification (create owner or DAO admin)
  - Action validation
```

### Financial Operation: Medium Amount ($100-$5,000)
```
Middleware:
  1. authenticate
  2. Rate limit: 5 ops/min per user
  3. (future) 2FA verification for amounts > $1,000
  
Handler:
  - Role verification
  - Amount validation
  - Audit log (medium severity)
```

### Financial Operation: High Amount (> $5,000 or DAO Treasury)
```
Middleware:
  1. authenticate
  2. Rate limit: 2 ops/10min per user
  3. 2FA verification (required)
  4. audit middleware (critical severity)
  
Handler:
  - Strict role verification (DAO admin only, not moderator)
  - Multi-sig check if DAO requires it
  - Approval workflow
  - Audit log (critical severity)
```

---

## Implementation Roadmap

### Phase 1: Clarify Architecture (Immediate)

**1.1 Create middleware profiles**
```typescript
// middleware/financialOperations.ts

// DAO task release - moderate risk
export const requireBountyReleaseAuth = [
  authenticate,
  rateLimitPerUser('bounty-release', 5, '1min'),
  requireDaoAdminOrCreator('task'),
  auditConsolidated('bounty_release', ['medium'])
];

// Standard escrow release - lower risk (P2P)
export const requireEscrowAuth = [
  authenticate,
  rateLimitPerUser('escrow-release', 10, '5min'),
  requireEscrowParty,
  auditConsolidated('escrow_release', ['medium'])
];

// High-value DAO operations
export const requireTreasuryAuth = [
  authenticate,
  rateLimitPerUser('treasury-op', 2, '10min'),
  requireRole('dao_admin'),  // Not moderator
  require2FA,
  auditConsolidated('treasury_operation', ['critical'])
];
```

**1.2 Update bounty-escrow routes with proper middleware**

Before:
```typescript
router.post('/release', async (req, res) => {
  // Authorization checks inside handler
  const canRelease = task[0].creatorId === userId;
  if (!canRelease) {
    // Check DAO membership...
  }
  // ... release funds
});
```

After:
```typescript
router.post('/release', 
  authenticate,
  rateLimitPerUser('bounty-release', 5, '1min'),
  requireBountyReleaseAuth,
  auditConsolidated('bounty_release', ['medium']),
  async (req, res) => {
    // Authorization already verified by middleware
    // Just execute release logic
    const { taskId, releaseToClaimant } = req.body;
    const userId = req.user.id;
    // ... release funds (audit already logged)
  }
);
```

### Phase 2: Route Hardening (This Week)

Audit all bounty-escrow routes and apply appropriate middleware:

| Route | Current | Recommended | Impact |
|-------|---------|-------------|--------|
| `POST /api/bounty-escrow` | `authenticate` | Add: role check, input validation | Prevent unauthorized bounty creation |
| `POST /api/bounty-escrow/release` | `authenticate` | Add: rate limit, audit logging | Prevent spam releases, add audit trail |
| `POST /api/bounty-escrow/dispute` | `authenticate` | Add: rate limit, owner check | Prevent dispute spam |
| `GET /api/bounty-escrow/:taskId` | `authenticate` | Add: task access check | Already has role checks in handler |
| `GET /api/bounty-escrow/*/escrow` | `authenticate` | Keep as is | Read-only, low risk |

### Phase 3: DAO Treasury Separation (Next Sprint)

**Rationale:** 
- Current bounty-escrow conflates task management with DAO treasury withdrawal
- High-value releases from DAO treasury should be separate from task bounties
- Need governance workflow (multi-sig, elder approval)

**New Structure:**
```
/api/bounty-escrow          ← Task rewards (moderate)
  POST   /              [Create bounty for task]
  POST   /release       [Release to claimant/creator]
  POST   /dispute       [Participant disputes]
  GET    /:taskId       [Get status]

/api/dao/:daoId/treasury    ← DAO Treasury (high-value) NEW
  POST   /withdraw      [requireRole('admin'), require2FA, audit]
  POST   /approve       [Multi-sig workflow]
  GET    /balance       [View treasury status]
```

---

## Code Example: Hardenened Bounty-Escrow

### Current Implementation
```typescript
import express from 'express';
import { authenticate } from '../auth';

const router = express.Router();

// ⚠️ ALL ROUTES ONLY HAVE authenticate MIDDLEWARE
router.use(authenticate);

router.post('/release', async (req, res) => {
  const { taskId, releaseToClaimant } = req.body;
  const userId = req.user?.claims?.sub ?? '';

  // EVERYTHING HAPPENS IN HANDLER (weak spot)
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId));
  
  // Authorization check buried in handler
  const canRelease = task[0].creatorId === userId || 
    (hasDaoAdminRole(userId, task[0].daoId));
  
  if (!canRelease) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Release happens without second layer
  await releaseEscrow(taskId, releaseToClaimant, userId);
  res.json({ success: true });
});
```

### Recommended Implementation
```typescript
import express from 'express';
import { authenticate } from '../auth';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { auditConsolidated } from '../services/auditConsolidated';

const router = express.Router();

// ALL bounty routes require auth
router.use(authenticate);

// Middleware for release operations
const releaseAuthMiddleware = [
  rateLimitPerUser('bounty-release', 5, '1min'),  // Max 5 releases per minute
  auditConsolidated('bounty_release', ['medium']), // Log all releases
  async (req, res, next) => {
    // Verify user is task creator or DAO admin
    const { taskId } = req.body;
    const userId = req.user.id;
    
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const isCreator = task[0].creatorId === userId;
    const isDaoAdmin = await checkDaoAdmin(userId, task[0].daoId);
    
    if (!isCreator && !isDaoAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Store in request for handler use
    req.verifiedTask = task[0];
    req.isCreator = isCreator;
    req.isDaoAdmin = isDaoAdmin;
    
    next();
  }
];

// ✅ HARDENED: Multiple layers of protection
router.post('/release', releaseAuthMiddleware, async (req, res) => {
  try {
    // Middleware has already verified permission
    const { taskId, releaseToClaimant } = req.body;
    const userId = req.user.id;
    const task = req.verifiedTask;

    // Just execute - audit logging already handled by middleware
    const release = await releaseEscrow(taskId, releaseToClaimant, userId);
    
    // Additional logging for high-value operations
    if (parseFloat(release.amount) > 5000) {
      await auditConsolidated.log({
        severity: 'critical',
        action: 'high_value_bounty_release',
        userId,
        taskId,
        amount: release.amount,
        recipient: releaseToClaimant ? task.claimerId : task.creatorId,
      });
    }

    res.json({ success: true, releaseId: release.id });
  } catch (error) {
    // Error logging happens automatically via middleware
    res.status(500).json({ error: 'Release failed' });
  }
});
```

---

## Security Checklist: Bounty-Escrow

### Current Status
- [x] Basic authentication (`authenticate` middleware)
- [x] Role verification in handler (creator / DAO admin)
- [ ] Rate limiting on endpoints
- [ ] Audit logging on financial operations
- [ ] Input validation (via Zod schemas ✓ but not enforced at middleware)
- [ ] 2FA for high-value operations
- [ ] Webhook signature verification (if webhooks added)
- [ ] CORS & CSRF protection

### Recommended Additions
1. **Rate Limiting**
   - `POST /release`: 5 ops/min per user
   - `POST /dispute`: 3 ops/min per user

2. **Audit Logging**
   - Log all release operations (medium severity)
   - Log all disputes (medium severity)
   - Log failed authorization attempts (high severity)

3. **Middleware Enforcement**
   - Move authorization to middleware layer
   - Use composable middleware (not router.use())
   - Per-route documentation of middleware stack

4. **2FA for High Values** (Phase 3)
   - If release amount > $5,000
   - Require 2FA code at release time
   - Log 2FA verification event

### Not Recommended (Yet)
- [ ] Multi-signature approval (future: governance v2)
- [ ] Escrow dispute arbitration (future: community resolution)
- [ ] Insurance pool (future: risk management)

---

## Migration Path

### Week 1: Documentation & Design Review
- ✅ Define escrow vs bounty-escrow clearly (this document)
- [ ] Get stakeholder review on security tier definitions
- [ ] Document all 5 bounty-escrow functions

### Week 2: Implement Middleware Layer
- [ ] Create financialOperations middleware file
- [ ] Add rateLimit middleware (if not exists)
- [ ] Add audit logging to bounty-release

### Week 3: Roll Out with Gates
- [ ] Deploy with feature flag: `BOUNTY_ESCROW_v2_ENABLED`
- [ ] Run both versions in parallel (1 week)
- [ ] Monitor for differences
- [ ] Switch to v2, disable v1

### Week 4: Finalize & Document
- [ ] Remove v1 routes
- [ ] Update API docs
- [ ] Create migration guide for integrations

---

## Questions to Answer

**Design Q1:** Should DAO bounty releases require approval from multiple elders/admins?
- Current: Task creator OR DAO admin can release
- Option A: Only DAO admin can release (more control)
- Option B: Task creator + DAO mod approval (multi-layer)
- **Recommendation:** Option A for now (cleaner), then multi-sig later

**Design Q2:** What if a task creator hasn't released bounty after 30 days?
- Current: Bounty locked forever
- Option A: Auto-refund to DAO treasury
- Option B: Claimant can dispute & escalate
- **Recommendation:** implement Option B in Phase 3

**Design Q3:** Should bounty-escrow and standard escrow share the same database table?
- Current: Separate (bounty uses wallet_transactions, escrow uses escrow_accounts)
- Pro consolidation: Single escrow model
- Con consolidation: Different workflows (task-tied vs P2P)
- **Recommendation:** Keep separate for now, merge in v2 if needed

---

## Summary

| Aspect | Escrow | Bounty-Escrow |
|--------|--------|---------------|
| **Purpose** | P2P funds transfer | DAO task rewards |
| **Users** | Any user pairs | Task creator + claimant + DAO |
| **Routes** | 23 (complex workflows) | 5 (task-specific) |
| **Middleware** | Per-route explicit | Router-level only |
| **Workflow** | Milestone-based | Task-completion-based |
| **Auth Model** | Party verification | Creator OR DAO admin |
| **State** | Built-in dispute system | Minimal dispute support |
| **Status** | Production-ready ✅ | Needs hardening ⚠️ |

**Next Step:** Implement Phase 1 (clarify + hardening) this sprint, then Phase 2 (treasury separation) next sprint.

