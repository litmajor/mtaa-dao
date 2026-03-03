# Bounty-Escrow Security Hardening - Implementation Guide

## Overview

This guide provides step-by-step instructions to harden the 5 bounty-escrow routes with proper middleware enforcement.

**Current State:** 1 middleware layer (basic `authenticate`)  
**Target State:** 3-4 middleware layers (auth + ratelimit + audit + role verification)

---

## Middleware Stack Structure

### Layer 1: Authentication ✅ (Already present)
```typescript
authenticate  // Validates JWT token, attaches user to req
```

### Layer 2: Rate Limiting (To add)
```typescript
rateLimitPerUser('bounty-release', 5, '1min')  // 5 ops per minute
```

### Layer 3: Role/Permission Verification (To move from handler to middleware)
```typescript
requireBountyReleaseAuth  // Custom: verify creator or DAO admin
```

### Layer 4: Audit Logging (To add)
```typescript
auditConsolidated('bounty_release', ['medium'])  // Log action with severity
```

---

## Step 1: Create Bounty-Escrow Middleware File

**File:** `server/middleware/bountyEscrowAuth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { db } from '../storage';
import { tasks, daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Verify user is task creator or DAO admin/moderator
 * Must be called AFTER authenticate middleware
 * 
 * Sets on request:
 *   req.verifiedTask - Task object
 *   req.isCreator - Boolean, is user task creator
 *   req.isDaoAdmin - Boolean, is user DAO admin/moderator
 */
export async function requireBountyReleaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { taskId } = req.body;
    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({ error: 'taskId is required in request body' });
    }

    // Get task
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskData = task[0];

    // Check if user is task creator
    const isCreator = taskData.creatorId === userId;

    // Check if user is DAO admin/moderator
    let isDaoAdmin = false;
    if (taskData.daoId) {
      const membership = await db
        .select()
        .from(daoMemberships)
        .where(
          and(
            eq(daoMemberships.daoId, taskData.daoId),
            eq(daoMemberships.userId, userId)
          )
        )
        .limit(1);

      if (membership.length > 0) {
        const role = membership[0].role?.toLowerCase();
        isDaoAdmin = role === 'admin' || role === 'moderator';
      }
    }

    // Authorization check
    if (!isCreator && !isDaoAdmin) {
      return res.status(403).json({
        error: 'Insufficient permissions to release this bounty',
        details: {
          isCreator,
          isDaoAdmin,
          userId,
          taskCreator: taskData.creatorId,
        },
      });
    }

    // Store for route handler
    (req as any).verifiedTask = taskData;
    (req as any).isCreator = isCreator;
    (req as any).isDaoAdmin = isDaoAdmin;

    next();
  } catch (error) {
    console.error('Bounty release auth error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

/**
 * Verify user is task creator only (stricter)
 * Used for destructive operations
 */
export async function requireBountyCreatorOnly(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { taskId } = req.body;
    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({ error: 'taskId required' });
    }

    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task[0].creatorId !== userId) {
      return res.status(403).json({ error: 'Only task creator can perform this action' });
    }

    (req as any).verifiedTask = task[0];
    next();
  } catch (error) {
    console.error('Bounty creator auth error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}
```

---

## Step 2: Update bounty-escrow.ts Routes

**File:** `server/routes/bounty-escrow.ts`

### 2.1 Add Imports

```typescript
// At top of file, after existing imports
import { rateLimitPerUser } from '../middleware/rateLimit';
import { auditConsolidated } from '../services/auditConsolidated';
import { 
  requireBountyReleaseAuth, 
  requireBountyCreatorOnly 
} from '../middleware/bountyEscrowAuth';
```

### 2.2 Remove Router-Level Middleware

**Change FROM:**
```typescript
// ALL bounty escrow operations require authentication
router.use(authenticate);
```

**Change TO:**
```typescript
// Per-route middleware (explicit is better than implicit)
// (Remove router.use(authenticate) entirely)
```

### 2.3 Update POST / (Create Escrow) Route

**Location:** Around line 33

**Change FROM:**
```typescript
router.post('/', async (req, res) => {
  try {
    const validatedData = createEscrowSchema.parse(req.body);
    const { taskId, amount, currency } = validatedData;
    const userId = req.user?.claims?.sub ?? '';
    // ...
```

**Change TO:**
```typescript
/**
 * POST /api/bounty-escrow
 * Create escrow for a DAO task
 * 
 * Middleware:
 *   1. authenticate (JWT validation)
 *   2. rateLimitPerUser (max 10 creates per 5 min)
 *   3. Input validation (Zod)
 *   4. auditConsolidated (log creation)
 */
router.post(
  '/',
  authenticate,
  rateLimitPerUser('bounty-create', 10, '5min'),
  auditConsolidated('bounty_escrow_create', ['medium']),
  async (req, res) => {
    try {
      const validatedData = createEscrowSchema.parse(req.body);
      const { taskId, amount, currency } = validatedData;
      const userId = req.user!.id;  // Use ! since authenticate verified it
      // ... rest of handler
```

### 2.4 Update POST /release (Critical Financial Operation)

**Location:** Around line 155

**Change FROM:**
```typescript
router.post('/release', async (req, res) => {
  try {
    const validatedData = releaseEscrowSchema.parse(req.body);
    const { taskId, releaseToClaimant } = validatedData;
    const userId = req.user?.claims?.sub ?? '';

    // Get task and verify permissions
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user can release escrow (creator or DAO admin)
    const canRelease = task[0].creatorId === userId;
    if (!canRelease) {
      const membership = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, task[0].daoId),
          eq(daoMemberships.userId, userId)
        ))
        .limit(1);
      
      if (!membership.length || !['admin', 'moderator'].includes(membership[0].role ?? '')) {
        return res.status(403).json({ error: 'Insufficient permissions to release escrow' });
      }
    }

    // ... release logic
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

**Change TO:**
```typescript
/**
 * POST /api/bounty-escrow/release
 * Release bounty escrow to task claimant or creator
 * 
 * FINANCIAL OPERATION - Multiple protection layers:
 *   1. authenticate (JWT validation)
 *   2. rateLimitPerUser (max 5 releases per min) ← Network protection
 *   3. requireBountyReleaseAuth (role verification) ← Business logic protection
 *   4. auditConsolidated (critical severity logging) ← Audit trail
 */
router.post(
  '/release',
  authenticate,
  rateLimitPerUser('bounty-release', 5, '1min'),
  requireBountyReleaseAuth,
  auditConsolidated('bounty_escrow_release', ['medium']),
  async (req, res) => {
    try {
      const validatedData = releaseEscrowSchema.parse(req.body);
      const { taskId, releaseToClaimant } = validatedData;
      const userId = req.user!.id;
      
      // Middleware has already verified permission
      // Retrieve verified task from middleware
      const task = (req as any).verifiedTask;
      const isCreator = (req as any).isCreator;
      const isDaoAdmin = (req as any).isDaoAdmin;

      // Find escrow transaction
      const escrow = await db
        .select()
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.type, 'escrow_deposit'),
          eq(walletTransactions.description, `Escrow for task: ${taskId}`),
          eq(walletTransactions.status, 'held')
        ))
        .limit(1);

      if (!escrow.length) {
        return res.status(404).json({ error: 'Active escrow not found for this task' });
      }

      const escrowAmount = parseFloat(escrow[0].amount);
      const recipient = releaseToClaimant ? task.claimerId : task.creatorId;

      if (!recipient) {
        return res.status(400).json({ error: 'No valid recipient for escrow release' });
      }

      // Update escrow status
      await db
        .update(walletTransactions)
        .set({ 
          status: 'completed',
          updatedAt: new Date()
        })
        .where(eq(walletTransactions.id, escrow[0].id));

      // Create release transaction
      const release = await db.insert(walletTransactions).values({
        walletAddress: recipient,
        amount: escrowAmount.toString(),
        currency: escrow[0].currency,
        type: 'escrow_release',
        status: 'completed',
        description: `Escrow release for task: ${taskId}`
      }).returning();

      // Update task status if released to claimant
      if (releaseToClaimant) {
        await db
          .update(tasks)
          .set({ 
            status: 'completed',
            updatedAt: new Date()
          })
          .where(eq(tasks.id, taskId));
      }

      // Log high-value releases for additional visibility
      if (escrowAmount > 5000) {
        await auditConsolidated.log({
          severity: 'high',
          action: 'high_value_bounty_release',
          userId,
          taskId,
          amount: escrowAmount,
          recipient,
          releasedBy: isCreator ? 'creator' : 'admin',
        });
      }

      res.json({
        success: true,
        releaseId: release[0].id,
        amount: escrowAmount,
        recipient,
        releasedToClaimant: releaseToClaimant
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);
```

### 2.5 Update POST /dispute Route

**Location:** Around line 280

```typescript
/**
 * POST /api/bounty-escrow/dispute
 * Dispute a bounty escrow
 * 
 * Middleware:
 *   1. authenticate
 *   2. rateLimitPerUser (max 3 disputes per min)
 *   3. auditConsolidated (log attempts)
 */
router.post(
  '/dispute',
  authenticate,
  rateLimitPerUser('bounty-dispute', 3, '1min'),
  auditConsolidated('bounty_escrow_dispute', ['medium']),
  async (req, res) => {
    // ... existing dispute logic
  }
);
```

### 2.6 Update GET Routes

```typescript
/**
 * GET /api/bounty-escrow/:taskId/escrow
 * Get escrow status for a task
 * 
 * Read-only, lower risk but still requires auth
 */
router.get(
  '/:taskId/escrow',
  authenticate,
  rateLimitPerUser('bounty-read', 30, '1min'),
  async (req, res) => {
    // ... existing logic
  }
);

/**
 * GET /api/bounty-escrow/:taskId
 * Get bounty details
 */
router.get(
  '/:taskId',
  authenticate,
  rateLimitPerUser('bounty-read', 30, '1min'),
  async (req, res) => {
    // ... existing logic
  }
);
```

---

## Step 3: Audit Logging Integration

Ensure `auditConsolidated` service is available:

**File:** `server/services/auditConsolidated.ts` (Check if exists)

If exists, you can use it as shown above. If not, create a simple version:

```typescript
export const auditConsolidated = {
  async log(event: any) {
    // Log to database/file
    console.log('[AUDIT]', JSON.stringify(event));
  },
};

export function auditConsolidated(action: string, severities: string[]) {
  return (req: any, res: any, next: any) => {
    // Log before the operation
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      // Log successful operation
      auditConsolidated.log({
        action,
        severity: severities[0],
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
        result: data.success ? 'success' : 'failure',
      });
      return originalJson(data);
    };
    next();
  };
}
```

---

## Step 4: Rate Limiting Integration

Ensure `rateLimitPerUser` middleware exists:

**File:** `server/middleware/rateLimit.ts` (Check if exists)

If not, create:

```typescript
import { Request, Response, NextFunction } from 'express';

const limitStore = new Map<string, any[]>();

export function rateLimitPerUser(
  keyPrefix: string,
  maxRequests: number,
  windowMs: string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id || req.ip;
    const key = `${keyPrefix}:${userId}`;
    
    // Parse window (e.g., '1min', '5min', '10min')
    const windowMs_ =
      windowMs === '1min' ? 60000 :
      windowMs === '5min' ? 300000 :
      windowMs === '10min' ? 600000 :
      60000;

    const now = Date.now();
    if (!limitStore.has(key)) {
      limitStore.set(key, []);
    }

    const requests = limitStore.get(key)!;
    const validRequests = requests.filter(t => now - t < windowMs_);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((validRequests[0] + windowMs_ - now) / 1000),
      });
    }

    validRequests.push(now);
    limitStore.set(key, validRequests);

    next();
  };
}
```

---

## Step 5: Testing

### Test Case 1: Verify Middleware Order

```bash
curl -X POST http://localhost:3000/api/bounty-escrow/release \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","releaseToClaimant":true}'

# Expected: 401 Unauthorized (authenticate middleware)
```

### Test Case 2: Rate Limiting

```bash
# Send 6 requests in quick succession
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/bounty-escrow \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"taskId":"task-1","amount":100,"currency":"cUSD"}'
done

# Expected: 6th request returns 429 Too Many Requests
```

### Test Case 3: Permission Denied

```bash
curl -X POST http://localhost:3000/api/bounty-escrow/release \
  -H "Authorization: Bearer OTHER_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-created-by-user-1","releaseToClaimant":true}'

# Expected: 403 Forbidden (requireBountyReleaseAuth middleware)
```

### Test Case 4: Audit Logging

```bash
# Check audit logs after successful release
cat server/logs/audit.log

# Expected: Entry for bounty_escrow_release with timestamp, userId, amount
```

---

## Summary of Changes

| Route | Old | New |
|-------|-----|-----|
| `POST /` | `authenticate` | `authenticate` + `rateLimitPerUser` + `audit` |
| `POST /release` | `authenticate` (only) | `authenticate` + `rateLimit` + **`requireBountyReleaseAuth`** + `audit` |
| `POST /dispute` | `authenticate` (only) | `authenticate` + `rateLimit` + `audit` |
| `GET /:taskId` | `authenticate` (only) | `authenticate` + `rateLimit` |
| `GET /:taskId/escrow` | `authenticate` (only) | `authenticate` + `rateLimit` |

**Key Improvement:** Authorization moved from handler code to middleware chain (Layer 3)

---

## Deployment Checklist

- [ ] Create `bountyEscrowAuth.ts` middleware file
- [ ] Update `bounty-escrow.ts` with new middleware stack
- [ ] Ensure `rateLimitPerUser` exists or create it
- [ ] Ensure `auditConsolidated` exists or create it
- [ ] Run unit tests for each route
- [ ] Test rate limiting manually
- [ ] Check audit logs are being generated
- [ ] Update API documentation
- [ ] Deploy with feature flag (optional, for safe rollout)
- [ ] Monitor error rates for 24 hours
- [ ] Remove old router-level `router.use(authenticate)`

---

## Rollback Plan

If issues are discovered:

1. Revert changes to `bounty-escrow.ts`
2. Keep `bountyEscrowAuth.ts` for reference
3. Run: `git checkout server/routes/bounty-escrow.ts`
4. Test functionality is restored
5. Schedule code review for next sprint

---

## Next Steps

1. ✅ Complete this implementation
2. ⬜ Schedule security review with team
3. ⬜ Plan Phase 3 (treasury separation) for next sprint
4. ⬜ Document in API reference for integrations

