# AGENT SECURITY FIX IMPLEMENTATION GUIDE

**Status**: Action Plan  
**Priority**: CRITICAL - Fix before production  
**Estimated Duration**: 6-12 weeks  

---

## QUICK START: Critical Fixes (Week 1-2)

### Fix 1: Add Permission Middleware to proposal-execution.ts

**File**: `server/routes/proposal-execution.ts`

**Current Code** (VULNERABLE):
```typescript
router.get('/:daoId/queue', isAuthenticated, async (req, res) => {
  const { daoId } = req.params;
  // ❌ NO DAO membership check - data leak!
  const executions = await db.select()...;
  res.json({ success: true, data: executions });
});

router.post('/:daoId/execute/:proposalId', isAuthenticated, async (req, res) => {
  // ❌ Comment says "Add permission check here" - NOT IMPLEMENTED
  const execution = await db.select()...;
  await ProposalExecutionService.executeProposal(execution[0]);
  res.json({ success: true, message: 'Proposal executed successfully' });
});
```

**Fixed Code** (SECURE):
```typescript
// Step 1: Create permission checking middleware

const requireDAOAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { daoId } = req.params;
    const userId = (req.user as any).claims.sub;

    // Verify user is DAO member
    const membership = await db.select().from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.status, 'approved')
      )).limit(1);

    if (!membership.length) {
      logger.warn('Access denied - not DAO member', { userId, daoId });
      return res.status(403).json({
        success: false,
        error: { message: 'You are not a member of this DAO' }
      });
    }

    // Verify user has admin or elder role
    const userRole = membership[0].role;
    if (!['admin', 'elder'].includes(userRole ?? '')) {
      logger.warn('Access denied - insufficient DAO role', { userId, daoId, userRole });
      return res.status(403).json({
        success: false,
        error: { message: 'Only admins and elders can execute proposals' }
      });
    }

    // Store for use in route handler
    (req as any).daoMembership = membership[0];
    next();
  } catch (error) {
    logger.error('DAO permission check failed', error);
    res.status(500).json({
      success: false,
      error: { message: 'Permission check failed' }
    });
  }
};

// Step 2: Apply middleware and fix routes

router.get('/:daoId/queue', isAuthenticated, requireDAOAdmin, async (req, res) => {
  try {
    const { daoId } = req.params;
    
    const executions = await db.select()
      .from(proposalExecutionQueue)
      .where(eq(proposalExecutionQueue.daoId, daoId))
      .orderBy(desc(proposalExecutionQueue.createdAt));
    
    res.json({
      success: true,
      data: executions
    });
  } catch (error: any) {
    logger.error('Failed to fetch execution queue', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch execution queue',
      // ✅ Don't expose error details
    });
  }
});

router.post('/:daoId/execute/:proposalId', isAuthenticated, requireDAOAdmin, async (req, res) => {
  try {
    const { daoId, proposalId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    // ✅ NOW: Get the execution from queue
    const execution = await db.select()
      .from(proposalExecutionQueue)
      .where(and(
        eq(proposalExecutionQueue.proposalId, proposalId),
        eq(proposalExecutionQueue.daoId, daoId),
        eq(proposalExecutionQueue.status, 'pending')
      ))
      .limit(1);
    
    if (!execution.length) {
      return res.status(404).json({
        success: false,
        message: 'No pending execution found for this proposal'
      });
    }
    
    // ✅ Log the action
    logger.info('Executing proposal', { userId, daoId, proposalId });
    
    // ✅ Execute the proposal
    await ProposalExecutionService.executeProposal(execution[0]);
    
    // ✅ Log success
    logger.info('Proposal executed successfully', { daoId, proposalId });
    
    res.json({
      success: true,
      message: 'Proposal executed successfully'
    });
  } catch (error: any) {
    logger.error('Failed to execute proposal', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute proposal'
    });
  }
});

router.delete('/:daoId/cancel/:executionId', isAuthenticated, requireDAOAdmin, async (req, res) => {
  try {
    const { daoId, executionId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    logger.info('Cancelling proposal execution', { userId, daoId, executionId });
    
    await db.update(proposalExecutionQueue)
      .set({ status: 'cancelled' })
      .where(and(
        eq(proposalExecutionQueue.id, executionId),
        eq(proposalExecutionQueue.daoId, daoId)
      ));
    
    logger.info('Proposal execution cancelled', { daoId, executionId });
    
    res.json({
      success: true,
      message: 'Execution cancelled'
    });
  } catch (error: any) {
    logger.error('Failed to cancel execution', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel execution'
    });
  }
});
```

**Testing**:
```typescript
describe('Proposal Execution Security', () => {
  it('should reject execution queue access by non-DAO members', async () => {
    const response = await api.get(
      `/api/proposal-execution/${daoA.id}/queue`,
      { headers: { authorization: `Bearer ${nonMemberToken}` } }
    );
    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('not a member');
  });

  it('should reject execution by non-admin members', async () => {
    const response = await api.post(
      `/api/proposal-execution/${daoA.id}/execute/${proposal.id}`,
      {},
      { headers: { authorization: `Bearer ${memberToken}` } }
    );
    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('admin');
  });

  it('should allow execution by DAO admin', async () => {
    const response = await api.post(
      `/api/proposal-execution/${daoA.id}/execute/${proposal.id}`,
      {},
      { headers: { authorization: `Bearer ${adminToken}` } }
    );
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

---

### Fix 2: Implement Agent Constraint Checker

**File**: `server/services/constraintChecker.ts` (NEW FILE)

**Create New File**:
```typescript
import { db } from '../storage';
import { agents, agentActions } from '../../shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const logger = new Logger('constraint-checker');

export interface AgentConstraint {
  agentId: string;
  actionType: string;
  maxAmount?: number;
  maxDailyActions?: number;
  maxDailyAmount?: number;
  requiredApprovals?: number;
  allowedRoles?: string[];
}

export interface ConstraintCheckResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
}

export class ConstraintChecker {
  /**
   * Check if action complies with all constraints
   */
  static async checkConstraints(
    agentId: string,
    actionType: string,
    amount?: number
  ): Promise<ConstraintCheckResult> {
    const result: ConstraintCheckResult = {
      passed: true,
      violations: [],
      warnings: []
    };

    try {
      // Get agent
      const agent = await db.select().from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      if (!agent.length) {
        result.violations.push(`Agent ${agentId} not found`);
        result.passed = false;
        return result;
      }

      // 1. Check action type is allowed
      const allowedActions = this.getAllowedActionsForAgent(agent[0].type);
      if (!allowedActions.includes(actionType)) {
        result.violations.push(
          `Agent not authorized for action type: ${actionType}`
        );
        result.passed = false;
      }

      // 2. Check magnitude limit
      if (amount !== undefined) {
        const maxAmount = this.getMaxAmount(agent[0].type);
        if (amount > maxAmount) {
          result.violations.push(
            `Amount ${amount} exceeds limit of ${maxAmount}`
          );
          result.passed = false;
        }
      }

      // 3. Check daily rate limit
      const dailyCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(agentActions)
        .where(and(
          eq(agentActions.agentId, agentId),
          eq(agentActions.actionType, actionType),
          gte(agentActions.createdAt, sql`NOW() - INTERVAL '24 hours'`)
        ));

      const maxDailyActions = this.getMaxDailyActions(agent[0].type);
      if (dailyCount[0].count >= maxDailyActions) {
        result.violations.push(
          `Daily action limit (${maxDailyActions}) exceeded`
        );
        result.passed = false;
      }

      // 4. Check daily amount limit
      if (amount !== undefined) {
        const dailyAmount = await db
          .select({ total: sql<number>`SUM(amount)` })
          .from(agentActions)
          .where(and(
            eq(agentActions.agentId, agentId),
            eq(agentActions.actionType, actionType),
            gte(agentActions.createdAt, sql`NOW() - INTERVAL '24 hours'`)
          ));

        const totalAmount = (dailyAmount[0]?.total || 0) + amount;
        const maxDailyAmount = this.getMaxDailyAmount(agent[0].type);
        if (totalAmount > maxDailyAmount) {
          result.violations.push(
            `Daily amount limit (${maxDailyAmount}) would be exceeded. ` +
            `Current: ${dailyAmount[0]?.total || 0}, Requested: ${amount}`
          );
          result.passed = false;
        }
      }

      // Log results
      if (!result.passed) {
        logger.warn('Constraint violations detected', {
          agentId,
          actionType,
          violations: result.violations
        });
      }

      return result;
    } catch (error) {
      logger.error('Error checking constraints', error);
      result.violations.push('Failed to check constraints');
      result.passed = false;
      return result;
    }
  }

  /**
   * Get allowed actions for agent type
   */
  private static getAllowedActionsForAgent(agentType: string): string[] {
    const allowedActions: Record<string, string[]> = {
      'treasury_manager': [
        'treasury_transfer',
        'treasury_rebalance',
        'treasury_allocate'
      ],
      'member_manager': [
        'member_add',
        'member_remove',
        'member_role_change'
      ],
      'governance_enforcer': [
        'governance_change',
        'rule_update'
      ],
      'vault_operator': [
        'vault_deposit',
        'vault_withdraw',
        'vault_rebalance'
      ]
    };

    return allowedActions[agentType] || [];
  }

  /**
   * Get maximum single transaction amount
   */
  private static getMaxAmount(agentType: string): number {
    const limits: Record<string, number> = {
      'treasury_manager': 1000000,    // 1M
      'member_manager': 0,             // N/A
      'governance_enforcer': 0,        // N/A
      'vault_operator': 500000         // 500K
    };

    return limits[agentType] || 0;
  }

  /**
   * Get maximum daily action count
   */
  private static getMaxDailyActions(agentType: string): number {
    const limits: Record<string, number> = {
      'treasury_manager': 10,
      'member_manager': 20,
      'governance_enforcer': 5,
      'vault_operator': 15
    };

    return limits[agentType] || 0;
  }

  /**
   * Get maximum daily total amount
   */
  private static getMaxDailyAmount(agentType: string): number {
    const limits: Record<string, number> = {
      'treasury_manager': 5000000,    // 5M
      'member_manager': 0,             // N/A
      'governance_enforcer': 0,        // N/A
      'vault_operator': 2000000        // 2M
    };

    return limits[agentType] || 0;
  }

  /**
   * Log constraint check for audit trail
   */
  static async logConstraintCheck(
    agentId: string,
    actionType: string,
    passed: boolean,
    violations?: string[]
  ) {
    try {
      await db.insert(agentActions).values({
        agentId,
        actionType,
        status: passed ? 'approved' : 'rejected',
        reason: violations?.join('; ') || 'Approved',
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Failed to log constraint check', error);
    }
  }
}
```

**Usage in ProposalExecutionService**:
```typescript
import { ConstraintChecker } from './constraintChecker';

static async executeProposal(execution: any) {
  try {
    const { executionType, executionData, daoId, proposalId } = execution;

    // ✅ NEW: Check constraints before execution
    const constraintCheck = await ConstraintChecker.checkConstraints(
      execution.agentId,
      executionType,
      executionData.amount
    );

    if (!constraintCheck.passed) {
      logger.error('Constraint violations - rejecting execution', {
        proposalId,
        violations: constraintCheck.violations
      });

      await db.update(proposalExecutionQueue)
        .set({
          status: 'rejected',
          reason: constraintCheck.violations.join('; ')
        })
        .where(eq(proposalExecutionQueue.id, execution.id));

      return;
    }

    // ✅ Log approved constraint check
    await ConstraintChecker.logConstraintCheck(
      execution.agentId,
      executionType,
      true
    );

    // Continue with execution...
    // Update status to executing
    await db.update(proposalExecutionQueue)
      .set({
        status: 'executing',
        lastAttempt: new Date(),
        attempts: execution.attempts + 1
      })
      .where(eq(proposalExecutionQueue.id, execution.id));

    // Execute based on type
    switch (executionType) {
      case 'treasury_transfer':
        await this.executeTreasuryTransfer(executionData, daoId, proposalId);
        break;
      // ... other cases
    }

    // Mark as completed
    await db.update(proposalExecutionQueue)
      .set({ status: 'completed' })
      .where(eq(proposalExecutionQueue.id, execution.id));

  } catch (error: any) {
    logger.error('Error executing proposal:', error);
    // Handle retry logic...
  }
}
```

---

### Fix 3: Add Input Validation with Zod

**File**: `server/schemas/validation.ts` (NEW FILE)

```typescript
import { z } from 'zod';

// Common validation patterns
export const uuidSchema = z.string().uuid();
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const amountSchema = z.number().positive().finite().max(Number.MAX_SAFE_INTEGER);
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0)
});

// Proposal execution schemas
export const executeProposalSchema = z.object({
  daoId: uuidSchema,
  proposalId: uuidSchema
});

export const createProposalSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().min(10).max(5000).trim(),
  proposalType: z.enum(['treasury', 'governance', 'member']),
  executionType: z.enum(['treasury_transfer', 'vault_operation', 'member_action', 'governance_change', 'disbursement']),
  executionData: z.record(z.any()),
  amount: z.number().positive().optional(),
  recipient: addressSchema.optional()
});

// Treasury transfer schema
export const treasuryTransferSchema = z.object({
  daoId: uuidSchema,
  amount: amountSchema,
  recipient: addressSchema,
  currency: z.string().min(1).max(10),
  reason: z.string().min(10).max(500).optional()
});

// Vote schema
export const voteSchema = z.object({
  proposalId: uuidSchema,
  daoId: uuidSchema,
  vote: z.enum(['yes', 'no', 'abstain']),
  votingPower: amountSchema
});

// Usage in routes
export function validateInput<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      (req as any).validated = validated;
      next();
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: error.errors.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }
      });
    }
  };
}
```

**Apply to Routes**:
```typescript
import { validateInput, executeProposalSchema } from '../schemas/validation';

router.post(
  '/:daoId/execute/:proposalId',
  isAuthenticated,
  requireDAOAdmin,
  validateInput(executeProposalSchema),
  async (req, res) => {
    const { daoId, proposalId } = (req as any).validated;
    // Now values are guaranteed to be valid
    // ...
  }
);
```

---

### Fix 4: Implement Security Audit Logging

**File**: `server/services/auditLogService.ts` (NEW FILE)

```typescript
import { db } from '../storage';
import { auditLogs } from '../../shared/schema';
import { Logger } from '../utils/logger';

const logger = new Logger('audit-log');

export interface AuditEvent {
  timestamp: Date;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  status: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  error?: string;
}

export class AuditLogService {
  static async log(event: AuditEvent) {
    try {
      await db.insert(auditLogs).values({
        timestamp: event.timestamp,
        userId: event.userId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        status: event.status,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        details: event.details ? JSON.stringify(event.details) : null,
        error: event.error
      });

      // Also log locally for real-time monitoring
      logger.info(`Audit: ${event.action}`, {
        userId: event.userId,
        status: event.status,
        resource: `${event.resourceType}:${event.resourceId}`,
        error: event.error
      });
    } catch (error) {
      logger.error('Failed to log audit event', error);
    }
  }

  static async getAuditTrail(
    resourceType: string,
    resourceId: string,
    limit: number = 100
  ) {
    try {
      const trail = await db.select()
        .from(auditLogs)
        .where(and(
          eq(auditLogs.resourceType, resourceType),
          eq(auditLogs.resourceId, resourceId)
        ))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);

      return trail;
    } catch (error) {
      logger.error('Failed to fetch audit trail', error);
      return [];
    }
  }

  static async logPermissionDenied(
    userId: string,
    action: string,
    reason: string,
    req: Request
  ) {
    await this.log({
      timestamp: new Date(),
      userId,
      action,
      resourceType: 'permission',
      resourceId: `${action}-denial`,
      status: 'failure',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      error: reason
    });
  }

  static async logAgentAction(
    agentId: string,
    action: string,
    daoId: string,
    status: 'success' | 'failure',
    details?: any,
    error?: string
  ) {
    await this.log({
      timestamp: new Date(),
      userId: `agent:${agentId}`,
      action,
      resourceType: 'agent_action',
      resourceId: `${daoId}:${action}`,
      status,
      details,
      error
    });
  }

  static async logProposalExecution(
    proposalId: string,
    daoId: string,
    executorId: string,
    status: 'success' | 'failure',
    error?: string
  ) {
    await this.log({
      timestamp: new Date(),
      userId: executorId,
      action: 'execute_proposal',
      resourceType: 'proposal',
      resourceId: proposalId,
      status,
      details: { daoId },
      error
    });
  }
}
```

---

## Priority 2: Input Validation (Week 3-4)

### Add Zod Validation to All Routes

**Steps**:
1. Define validation schemas for each route
2. Create validateInput middleware
3. Apply middleware to all POST/PATCH routes
4. Add tests for validation

**Example Routes to Update**:
```typescript
// governance.ts
router.post('/proposals', 
  isAuthenticated, 
  validateInput(createProposalSchema),
  async (req, res) => {...}
);

// dao-treasury-flows.ts
router.get('/history',
  isAuthenticated,
  validateInput(paginationSchema),
  async (req, res) => {...}
);

// withdrawals.ts
router.post('/create',
  isAuthenticated,
  validateInput(withdrawalSchema),
  async (req, res) => {...}
);
```

---

## Priority 3: Rate Limiting (Week 5)

### Implement Rate Limiting Middleware

**File**: `server/middleware/rateLimiter.ts`

```typescript
import rateLimit from 'express-rate-limit';

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication rate limiter (stricter)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  message: 'Too many login attempts',
  skipSuccessfulRequests: false
});

// Token refresh rate limiter
export const refreshLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 refreshes per hour per user
  message: 'Too many refresh attempts',
  keyGenerator: (req) => (req.user as any)?.id || req.ip
});

// Agent action limiter
export const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // 5 agent actions per minute per DAO
  keyGenerator: (req) => `${(req.user as any)?.id}:${req.params.daoId}`,
  message: 'Agent action rate limit exceeded'
});
```

---

## Testing & Validation Checklist

### Security Tests to Implement

```
✓ Authorization Tests (20 tests)
  - Non-members can't access DAO data
  - Non-admins can't execute proposals
  - Regular users can't access admin endpoints
  - Permission denial is logged
  
✓ Constraint Tests (15 tests)
  - Magnitude limits enforced
  - Daily rate limits enforced
  - Action type verification
  - Amount calculation accuracy
  
✓ Input Validation Tests (25 tests)
  - Invalid amounts rejected
  - Invalid addresses rejected
  - Oversized inputs rejected
  - Null/undefined handled
  
✓ Audit Logging Tests (10 tests)
  - All actions logged
  - Failed access logged
  - Agent actions logged
  - Audit trail retrievable
  
✓ Rate Limiting Tests (10 tests)
  - Rate limits enforced
  - Different limits per endpoint
  - Rate limit headers present
  - Limit resets properly
```

---

## Deployment Checklist

### Before Deploying Fixes

- [ ] All fixes code reviewed
- [ ] All tests pass (100%)
- [ ] Staging environment tested
- [ ] Database migrations prepared
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Alert thresholds set
- [ ] On-call team briefed

### Deployment Process

```
1. Backup production database
2. Deploy to staging
3. Run full test suite on staging
4. Deploy to production (canary 5%)
5. Monitor for 30 minutes
6. Roll out to 100% if no issues
7. Continue monitoring for 24 hours
8. Document any issues
```

---

## Success Metrics

After implementing all fixes, you should have:

- ✅ Zero authentication bypass vulnerabilities
- ✅ Zero privilege escalation vulnerabilities
- ✅ Zero unvalidated agent executions
- ✅ 100% input validation coverage
- ✅ Complete audit logging
- ✅ All tests passing
- ✅ Production-ready security posture

---

**Next Steps**: Start with Fix 1 (permission middleware) immediately. This is the most critical vulnerability with the highest impact.

