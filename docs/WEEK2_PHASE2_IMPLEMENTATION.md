# Week 2 Phase 2: Route Integration Guide

## 🎯 Overview

Phase 2 involves integrating the Rate Limiting, Audit Logging, Validation, and Error Filtering frameworks into the Express application.

**Duration**: ~8 hours  
**Current Step**: Step 1 of 4  
**Status**: Starting now

---

## Step 1: Add Middleware to Express App ✅ (IN PROGRESS)

### 1.1 Update `server/index.ts` - Import new middleware

Add these imports at the top of the file:

```typescript
// Week 2 Security Framework
import { 
  globalRateLimiter, 
  authRateLimiter, 
  apiRateLimiter, 
  sensitiveOperationRateLimiter,
  rateLimitInfoMiddleware 
} from './middleware/rateLimiting';
import { errorFilteringMiddleware } from './middleware/errorFiltering';
import { logAuditEvent, AuditEventType } from './services/auditLogging';
```

### 1.2 Add middleware to the Express app

In `server/index.ts`, after the existing security middleware (around line 160):

```typescript
// Week 2 Security Framework - Add AFTER auditMiddleware
// Rate limit info tracking
app.use(rateLimitInfoMiddleware);

// Global rate limiting (very permissive, per-route limiters are more restrictive)
app.use(globalRateLimiter);

// Error filtering BEFORE error handlers
app.use(errorFilteringMiddleware);
```

### 1.3 Apply route-specific rate limiters

In `server/routes.ts`, add specific rate limiters to sensitive routes:

```typescript
import { authRateLimiter, apiRateLimiter, sensitiveOperationRateLimiter } from '../middleware/rateLimiting';

// Authentication routes (most restrictive)
app.post('/auth/login', authRateLimiter, authLoginHandler);
app.post('/auth/register', authRateLimiter, authRegisterHandler);

// Sensitive operations (strict limiting)
app.post('/api/proposals/execute', sensitiveOperationRateLimiter, executionHandler);
app.post('/api/treasury/transfer', sensitiveOperationRateLimiter, transferHandler);

// General API routes (moderate limiting)
app.use('/api/', apiRateLimiter);
```

---

## Step 2: Add Audit Logging to Routes (2-3 hours)

### 2.1 Authentication Routes

In `server/auth.ts`:

```typescript
import { logAuditEvent, AuditEventType } from './services/auditLogging';

export const authLoginHandler = async (req: Request, res: Response) => {
  try {
    // ... existing login logic
    
    // Log successful login
    await logAuditEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      userId: user.id,
      userEmail: user.email,
      action: 'User successfully logged in',
      severity: 'low',
      endpoint: '/auth/login',
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: { source: 'web' },
    });
    
    res.json({ success: true, user, token });
  } catch (error) {
    // Log failed login
    await logAuditEvent({
      eventType: AuditEventType.LOGIN_FAILURE,
      action: 'Failed login attempt',
      severity: 'high',
      endpoint: '/auth/login',
      method: 'POST',
      ipAddress: req.ip,
      statusCode: 401,
      metadata: {
        reason: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
};
```

### 2.2 Proposal Execution Routes

In `server/routes/proposal-execution.ts`:

```typescript
import { logAuditEvent, AuditEventType, getEventSeverity } from '../services/auditLogging';

router.post('/execute', sensitiveOperationRateLimiter, async (req: Request, res: Response) => {
  try {
    const { proposalId, executionData } = req.body;
    
    // Log execution attempt
    await logAuditEvent({
      eventType: AuditEventType.PROPOSAL_EXECUTED,
      userId: req.user?.id,
      resourceId: proposalId,
      action: 'Proposal execution started',
      severity: 'low',
      endpoint: req.path,
      method: req.method,
      ipAddress: req.ip,
      statusCode: 200,
      metadata: { daoId: executionData.daoId },
    });
    
    const result = await executeProposal(proposalId, executionData);
    
    res.json({ success: true, result });
  } catch (error) {
    // Log execution failure
    await logAuditEvent({
      eventType: AuditEventType.PROPOSAL_EXECUTED,
      userId: req.user?.id,
      resourceId: req.body.proposalId,
      action: 'Proposal execution failed',
      severity: 'high',
      endpoint: req.path,
      method: req.method,
      statusCode: 400,
      ipAddress: req.ip,
      metadata: {
        error: error instanceof Error ? error.message : 'Execution failed',
      },
    });
    
    res.status(400).json({ success: false, error: 'Execution failed' });
  }
});
```

### 2.3 Treasury/Transfer Routes

In `server/routes/dao-treasury.ts`:

```typescript
import { logAuditEvent, AuditEventType } from '../services/auditLogging';

router.post('/transfer', sensitiveOperationRateLimiter, async (req: Request, res: Response) => {
  try {
    const { amount, recipient, daoId } = req.body;
    
    // Log transfer
    await logAuditEvent({
      eventType: AuditEventType.TRANSFER_INITIATED,
      userId: req.user?.id,
      resourceId: daoId,
      action: 'Treasury transfer initiated',
      severity: 'medium',
      endpoint: req.path,
      method: req.method,
      ipAddress: req.ip,
      statusCode: 200,
      metadata: {
        amount,
        recipient,
        daoId,
      },
    });
    
    const tx = await executeTransfer(amount, recipient, daoId);
    
    res.json({ success: true, transactionHash: tx.hash });
  } catch (error) {
    await logAuditEvent({
      eventType: AuditEventType.TRANSFER_FAILED,
      userId: req.user?.id,
      action: 'Treasury transfer failed',
      severity: 'high',
      endpoint: req.path,
      method: req.method,
      statusCode: 400,
      ipAddress: req.ip,
      metadata: {
        error: error instanceof Error ? error.message : 'Transfer failed',
      },
    });
    
    res.status(400).json({ success: false, error: 'Transfer failed' });
  }
});
```

### 2.4 Admin Routes

In `server/routes/admin.ts`:

```typescript
import { logAuditEvent, AuditEventType } from '../services/auditLogging';

router.post('/users/ban', adminRateLimiter, async (req: Request, res: Response) => {
  try {
    const { userId, reason } = req.body;
    
    await banUser(userId, reason);
    
    // Log admin action
    await logAuditEvent({
      eventType: AuditEventType.ADMIN_USER_BANNED,
      userId: req.user?.id, // Admin's ID
      resourceId: userId, // Banned user's ID
      action: `Admin banned user ${userId}`,
      severity: 'critical',
      endpoint: req.path,
      method: req.method,
      ipAddress: req.ip,
      statusCode: 200,
      metadata: {
        reason,
        adminId: req.user?.id,
        bannedUserId: userId,
      },
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Ban failed' });
  }
});
```

---

## Step 3: Integrate Input Validation (2 hours)

### 3.1 Use Validation Schemas

In routes that need validation:

```typescript
import { validateInput } from '../validation/schemas';
import { proposalExecutionSchema } from '../validation/schemas';

router.post('/execute', async (req: Request, res: Response) => {
  try {
    // Validate input
    const validData = await validateInput(proposalExecutionSchema, req.body);
    
    // Process with validated data
    const result = await executeProposal(validData.proposalId);
    
    res.json({ success: true, result });
  } catch (error) {
    // Validation errors are already sanitized
    res.status(400).json({ 
      success: false, 
      error: 'Invalid request data' 
    });
  }
});
```

---

## Step 4: Write E2E Tests (1-2 hours)

### 4.1 Create `server/tests/week2E2E.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../index';

describe('Week 2 Security Framework - E2E Tests', () => {
  describe('Authentication with Rate Limiting', () => {
    it('should allow 5 login attempts in 15 minutes', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'wrong' });
        
        // First 5 should be rate-limited (429 or other)
      }
    });

    it('should block 6th login attempt', async () => {
      // After 5 attempts, 6th should get 429
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });
      
      expect(res.status).toBe(429);
    });
  });

  describe('Proposal Execution with Audit Logging', () => {
    it('should log proposal execution', async () => {
      const res = await request(app)
        .post('/api/proposals/execute')
        .set('Authorization', `Bearer ${token}`)
        .send({ proposalId: 'prop-123' });
      
      // Verify proposal was logged
      const logs = await getAuditLogs({ resourceId: 'prop-123' });
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Error Filtering', () => {
    it('should not leak error details', async () => {
      const res = await request(app)
        .post('/api/invalid')
        .send({});
      
      // Response should not contain file paths or stack traces
      expect(res.body).not.toContain('node_modules');
      expect(res.body).not.toContain('at Function');
    });
  });
});
```

---

## Integration Checklist

### Phase 2 Tasks

- [ ] Update `server/index.ts` with rate limiting middleware
- [ ] Update `server/index.ts` with error filtering middleware
- [ ] Add audit logging imports
- [ ] Add rate limiting to `/auth/*` routes
- [ ] Add rate limiting to `/api/*` routes
- [ ] Add rate limiting to `/proposals/execute` route
- [ ] Add rate limiting to `/treasury/transfer` route
- [ ] Add audit logging to authentication routes
- [ ] Add audit logging to proposal routes
- [ ] Add audit logging to treasury routes
- [ ] Add audit logging to admin routes
- [ ] Integrate validation schemas into routes
- [ ] Test in development environment
- [ ] Write E2E test suite
- [ ] Run performance tests
- [ ] Deploy to staging

---

## Quick Commands

```bash
# Run tests
npm test -- week2Integration.test.ts
npm test -- week2E2E.test.ts

# Run development server
npm run dev

# Build for production
npm run build

# Run specific test
npm test -- -t "Rate Limiting"
```

---

## Troubleshooting

**Rate limiter not working?**
- Verify middleware is applied BEFORE route handlers
- Check that rate limiter is not being bypassed
- Look at request headers: `X-RateLimit-Remaining`

**Audit logs not appearing?**
- Check database connection
- Verify `logAuditEvent()` is being awaited
- Check server logs for errors
- Verify audit_logs table exists

**Validation errors?**
- Check schema matches request data
- Verify validateInput() function is used correctly
- Look at error messages for invalid fields

---

## Performance Considerations

1. **Rate Limiting**: <1ms overhead per request
2. **Audit Logging**: Async (non-blocking), <5ms
3. **Validation**: <10ms per request
4. **Total Overhead**: ~20ms per request (acceptable)

---

## Next: Performance Testing

After integration, we'll:
1. Load test with 100+ concurrent users
2. Monitor response times
3. Check database query performance
4. Optimize as needed

---

**Ready to begin Phase 2? Follow the steps above! 🚀**
