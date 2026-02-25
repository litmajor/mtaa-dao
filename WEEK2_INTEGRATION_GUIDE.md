# Week 2 Security Framework - Integration Guide

## Quick Start: Implementing Rate Limiting & Audit Logging

### 1. Setup Rate Limiting in Express App

```typescript
import express from 'express';
import { 
  globalRateLimiter, 
  authRateLimiter, 
  apiRateLimiter, 
  sensitiveOperationRateLimiter,
  rateLimitInfoMiddleware 
} from './middleware/rateLimiting';

const app = express();

// Apply rate limit info to all requests
app.use(rateLimitInfoMiddleware);

// Global rate limiting (apply to all routes)
app.use(globalRateLimiter);

// Authentication routes (most restrictive)
app.post('/auth/login', authRateLimiter, (req, res) => {
  // Handle login
});

app.post('/auth/register', authRateLimiter, (req, res) => {
  // Handle registration
});

// API routes (moderate limiting)
app.use('/api/', apiRateLimiter);

// Sensitive operations (strict limiting)
app.post('/proposals/execute', sensitiveOperationRateLimiter, (req, res) => {
  // Execute proposal
});

app.post('/treasury/transfer', sensitiveOperationRateLimiter, (req, res) => {
  // Transfer funds
});
```

### 2. Setup Audit Logging

```typescript
import { logAuditEvent, AuditEventType } from './services/auditLogging';

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
  metadata: {
    source: 'web',
  },
});

// Log failed login attempt
await logAuditEvent({
  eventType: AuditEventType.LOGIN_FAILURE,
  action: 'Failed login attempt',
  severity: 'high',
  endpoint: '/auth/login',
  method: 'POST',
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  statusCode: 401,
  metadata: {
    reason: 'Invalid credentials',
    attempts: loginAttempts,
  },
});

// Log admin action
await logAuditEvent({
  eventType: AuditEventType.ADMIN_USER_BANNED,
  userId: adminId,
  resourceId: bannedUserId,
  action: 'Admin banned user account',
  severity: 'critical',
  endpoint: '/admin/users/ban',
  method: 'POST',
  ipAddress: req.ip,
  statusCode: 200,
  metadata: {
    reason: 'Suspicious activity',
    email: bannedUser.email,
  },
});

// Log proposal execution
await logAuditEvent({
  eventType: AuditEventType.PROPOSAL_EXECUTED,
  userId: executorId,
  resourceId: proposalId,
  action: 'Proposal executed successfully',
  severity: 'low',
  endpoint: '/proposals/execute',
  method: 'POST',
  statusCode: 200,
  metadata: {
    proposalId,
    amount: '1000',
    recipient: '0xabc123...',
    transactionHash: 'tx-hash-123',
  },
});

// Log constraint violation (security event)
await logAuditEvent({
  eventType: AuditEventType.CONSTRAINT_VIOLATION,
  userId: userId,
  action: 'Transaction constraint violation detected',
  severity: 'critical',
  endpoint: '/proposals/execute',
  method: 'POST',
  statusCode: 400,
  metadata: {
    constraint: 'daily_limit',
    requested: '10000',
    available: '500',
    limit: '5000',
  },
});
```

### 3. Query Audit Logs

```typescript
import { 
  getAuditLogs, 
  getUserActivity, 
  getSecurityEvents, 
  generateAuditReport 
} from './services/auditLogging';

// Get all login events
const loginEvents = await getAuditLogs({
  resource: AuditEventType.LOGIN_SUCCESS,
  limit: 100,
});

// Get user's recent activity (last 24 hours)
const userActivity = await getUserActivity('user-123', 24, 50);

// Get security events (high/critical only)
const securityEvents = await getSecurityEvents({
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
  limit: 100,
});

// Get all events for a specific user
const userEvents = await getAuditLogs({
  userId: 'user-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  limit: 200,
});

// Filter by severity
const criticalEvents = await getAuditLogs({
  severity: 'critical',
  limit: 50,
});

// Generate compliance report
const report = await generateAuditReport({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  userId: 'user-123',
});

console.log(`Total events: ${report.totalEvents}`);
console.log(`Events by type:`, report.eventsByType);
console.log(`Events by severity:`, report.eventsBySeverity);
console.log(`Critical events: ${report.criticalEvents.length}`);
```

### 4. Integrate Input Validation

```typescript
import { validateInput } from './validation/schemas';
import { proposalExecutionSchema } from './validation/schemas';

// In your route handler
app.post('/proposals/execute', async (req, res) => {
  try {
    // Validate input
    const validData = await validateInput(proposalExecutionSchema, req.body);
    
    // Process valid data
    const result = await executeProposal(validData);
    
    // Log success
    await logAuditEvent({
      eventType: AuditEventType.PROPOSAL_EXECUTED,
      userId: req.user.id,
      resourceId: validData.proposalId,
      action: 'Proposal executed',
      severity: 'low',
      endpoint: req.path,
      method: req.method,
      statusCode: 200,
      metadata: { transactionHash: result.hash },
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    // Log validation failure
    await logAuditEvent({
      eventType: AuditEventType.API_VALIDATION_FAILED,
      userId: req.user?.id,
      action: 'Proposal execution validation failed',
      severity: 'high',
      endpoint: req.path,
      method: req.method,
      statusCode: 400,
      metadata: {
        error: error instanceof Error ? error.message : 'Validation failed',
        input: Object.keys(req.body),
      },
    });
    
    res.status(400).json({ 
      success: false, 
      error: 'Invalid request data' 
    });
  }
});
```

### 5. Integrate Error Filtering

```typescript
import { errorFilteringMiddleware } from './middleware/errorFiltering';

const app = express();

// ... other middleware ...

// Add error filtering BEFORE other error handlers
app.use(errorFilteringMiddleware);

// Global error handler
app.use((err, req, res, next) => {
  // Log error with audit trail
  await logAuditEvent({
    eventType: AuditEventType.API_ERROR,
    userId: req.user?.id,
    action: 'API error occurred',
    severity: 'high',
    endpoint: req.path,
    method: req.method,
    statusCode: err.status || 500,
    metadata: {
      errorCode: err.code,
      errorType: err.constructor.name,
      // Note: detailed error is already in server logs
    },
  });
  
  // Error filtering middleware already sanitized the error
  res.status(err.status || 500).json(err.sanitized || {
    success: false,
    error: { message: 'Internal server error' },
  });
});
```

### 6. Admin Dashboard Queries

```typescript
// Get all failed login attempts (last hour)
const failedLogins = await getAuditLogs({
  resource: AuditEventType.LOGIN_FAILURE,
  startDate: new Date(Date.now() - 60 * 60 * 1000),
  limit: 100,
});

// Get all admin actions (audit trail)
const adminActions = await getAuditLogs({
  resource: AuditEventType.ADMIN_USER_BANNED,
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  limit: 500,
});

// Get security incidents
const incidents = await getSecurityEvents({
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
});

// Generate weekly compliance report
const weeklyReport = await generateAuditReport({
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
});
```

## Rate Limiting Configuration

### Custom Rate Limiter

```typescript
import { createRateLimiter } from './middleware/rateLimiting';

// Create custom limiter (e.g., payment endpoint)
const paymentRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // Max 5 payments per hour
  keyGenerator: (req) => {
    // Rate limit by user ID
    return `payment:${req.user?.id}`;
  },
  skipSuccessfulRequests: false, // Count all requests
  onLimitReached: (req, res) => {
    // Custom handler
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many payment attempts. Try again later.',
        code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
        retryAfter: 3600, // 1 hour in seconds
      },
    });
  },
});

app.post('/payments/submit', paymentRateLimiter, async (req, res) => {
  // Handle payment
});
```

### Distributed Rate Limiting (Redis)

```typescript
import redis from 'redis';

// For production with multiple servers:
const redisClient = redis.createClient();

export async function createDistributedRateLimiter(config: RateLimitConfig) {
  return (req, res, next) => {
    const key = getDistributedRateLimitKey(req, 'user');
    
    redisClient.get(key, (err, count) => {
      const current = parseInt(count || '0') + 1;
      
      if (current > config.maxRequests) {
        res.status(429).json({
          success: false,
          error: { message: 'Rate limit exceeded' },
        });
      } else {
        redisClient.setex(key, config.windowMs / 1000, current);
        next();
      }
    });
  };
}
```

## Event Type Reference

```typescript
// Authentication
AuditEventType.LOGIN_ATTEMPT
AuditEventType.LOGIN_SUCCESS
AuditEventType.LOGIN_FAILURE
AuditEventType.LOGOUT
AuditEventType.TOKEN_REFRESH
AuditEventType.TOKEN_VALIDATION_FAILED

// Account
AuditEventType.ACCOUNT_CREATED
AuditEventType.ACCOUNT_UPDATED
AuditEventType.ACCOUNT_BANNED
AuditEventType.PASSWORD_CHANGED

// DAO & Proposals
AuditEventType.DAO_CREATED
AuditEventType.PROPOSAL_CREATED
AuditEventType.PROPOSAL_EXECUTED
AuditEventType.MEMBER_ADDED
AuditEventType.MEMBER_REMOVED

// Treasury
AuditEventType.TRANSFER_INITIATED
AuditEventType.TRANSFER_EXECUTED
AuditEventType.TRANSFER_FAILED

// Security
AuditEventType.PERMISSION_DENIED
AuditEventType.CONSTRAINT_VIOLATION
AuditEventType.RATE_LIMIT_EXCEEDED
AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT
AuditEventType.SUSPICIOUS_ACTIVITY

// Admin
AuditEventType.ADMIN_USER_BANNED
AuditEventType.ADMIN_USER_LIST_ACCESSED
AuditEventType.ADMIN_SETTINGS_CHANGED

// Payments
AuditEventType.PAYMENT_INITIATED
AuditEventType.PAYMENT_COMPLETED
AuditEventType.PAYMENT_FAILED

// Agent
AuditEventType.AGENT_MESSAGE_SIGNED
AuditEventType.AGENT_MESSAGE_VERIFIED
AuditEventType.AGENT_EXECUTION_COMPLETED
```

## Testing

```bash
# Run rate limiting tests
npm test -- server/tests/week2Integration.test.ts -t "Rate Limiting"

# Run audit logging tests
npm test -- server/tests/week2Integration.test.ts -t "Audit Logging"

# Run all integration tests
npm test -- server/tests/week2Integration.test.ts

# Run with coverage
npm test -- server/tests/week2Integration.test.ts --coverage
```

## Performance Tips

1. **Use indexed queries**: `userId`, `timestamp`, `severity` columns are indexed
2. **Pagination**: Always use `limit` and `offset` for large result sets
3. **Date ranges**: Filter by date range to reduce query time
4. **Audit archiving**: Regularly archive old logs to separate storage
5. **Redis for distributed**: Use Redis for multi-server deployments

## Troubleshooting

### Rate Limit Not Working
- Verify middleware is applied to route
- Check key generator function returns consistent values
- Ensure rate limiter is applied BEFORE route handler

### Audit Logs Not Being Recorded
- Check database connection
- Verify table schema matches expectations
- Look for async errors in server logs
- Ensure `logAuditEvent()` is awaited

### Audit Queries Slow
- Add indexes: `CREATE INDEX idx_user ON audit_logs(user_id)`
- Add indexes: `CREATE INDEX idx_timestamp ON audit_logs(timestamp)`
- Use date range filtering to limit result set
- Archive old records to improve query performance

## Next Steps

1. ✅ Rate Limiting: Integrate into Express app
2. ✅ Audit Logging: Add to all critical operations
3. ⏳ Error Filtering: Apply to all error handlers
4. ⏳ Validation: Integrate into all routes
5. ⏳ Testing: Write comprehensive E2E tests
6. ⏳ Monitoring: Setup alerts for security events
