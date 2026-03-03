# Security Middleware Integration Guide

## Overview
This guide explains how to integrate the security middleware into your Express routes to protect against SQL injection, XSS attacks, and unauthorized access.

---

## Quick Start

### 1. Import Security Modules
```typescript
import { 
  validateDaoIdMiddleware, 
  sanitizeObject 
} from '../middleware/security';

import { 
  secureRoute, 
  validateDAOScope, 
  auditLog 
} from '../middleware/security-integration';

import { 
  trackDeprecatedEndpoint,
  getDeprecationMetrics,
  getDeprecationReport 
} from '../middleware/deprecation-monitor';
```

### 2. Apply Security to Routes

#### Pattern A: DAO Scope Validation (Recommended)
```typescript
// Mount security validation at DAO level
app.use('/api/dao/:daoId', validateDaoIdMiddleware);

// Apply route-level middleware
app.use('/api/dao/:daoId', validateDAOScope);

// Mount route handlers
app.use('/api/dao/:daoId/governance', governanceRoutes);
app.use('/api/dao/:daoId/treasury', daoTreasuryRoutes);
```

#### Pattern B: Individual Route Protection
```typescript
router.get('/balance', 
  isAuthenticated,
  validateDAOScope,
  auditLog('treasury_balance'),
  secureRoute(async (req, res) => {
    const { daoId } = req.params;
    const userId = req.userId!; // Validated and sanitized
    
    // Handler code here
    res.json({ balance: 1000 });
  })
);
```

#### Pattern C: Deprecated Route Monitoring
```typescript
// Monitor old endpoint for migration tracking
app.use('/api/governance/:daoId', trackDeprecatedEndpoint('/api/governance'));

// Send deprecation headers
app.use('/api/governance/:daoId', (req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
  res.setHeader('X-Deprecated-Route', 'Please use /api/dao/:daoId/governance');
  next();
});
```

---

## Integration Examples

### Example 1: Securing Treasury Endpoints

**Before (Vulnerable):**
```typescript
router.post('/:daoId/transfer/native', isAuthenticated, async (req, res) => {
  const { daoId } = req.params;
  const { toAddress, amount } = req.body;
  
  // No validation! Vulnerable to SQL injection, XSS, etc.
  const dao = await db.select().from(daos).where(eq(daos.id, daoId));
  // ...
});
```

**After (Secure):**
```typescript
router.post('/transfer/native', 
  isAuthenticated,
  validateDAOScope,
  auditLog('treasury_transfer'),
  secureRoute(async (req: SecureRequest, res: Response) => {
    const { daoId } = req.params; // Validated: must be valid UUID
    const userId = req.userId!;    // Extracted and validated
    const { toAddress, amount } = req.body; // Sanitized
    
    // Check for suspicious patterns (logged if found)
    const threatLevel = assessThreatLevel(req);
    if (threatLevel === 'high') {
      logger.warn('High-threat request detected', { userId, daoId });
    }
    
    // Database query is safe - parameterized by daoId validation
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    
    // Response is sanitized automatically
    res.json({ success: true, transfer: { daoId, amount, toAddress } });
  })
);
```

### Example 2: Rate Limiting Sensitive Operations

```typescript
import { secureRateLimit } from '../middleware/security-integration';

// Apply stricter rate limiting to financial operations
router.post('/multisig/propose',
  isAuthenticated,
  validateDAOScope,
  secureRateLimit(5, 60000), // 5 requests per minute, not 10
  auditLog('multisig_propose'),
  secureRoute(async (req, res) => {
    const { daoId } = req.params;
    const { amount, recipient } = req.body;
    
    // This endpoint is protected by stricter rate limits
    // and all suspicious behavior is logged
    res.json({ success: true });
  })
);
```

### Example 3: Monitoring Route Adoption

```typescript
// Deprecation admin endpoints
app.get('/admin/deprecated-metrics', 
  authenticateAdmin,
  (req, res) => {
    res.json(deprecationMonitor.getMetrics());
  }
);

app.get('/admin/deprecated-report',
  authenticateAdmin,
  (req, res) => {
    const html = deprecationMonitor.generateHTMLReport();
    res.contentType('text/html').send(html);
  }
);

app.post('/admin/export-deprecated-metrics',
  authenticateAdmin,
  (req, res) => {
    const data = deprecationMonitor.exportMetrics();
    res.json({
      success: true,
      file: 'deprecation-metrics.json',
      summary: data.summary
    });
  }
);
```

---

## Security Features by Middleware

### What Each Middleware Provides

#### `validateDaoIdMiddleware` (From `security.ts`)
✓ Validates DAO ID is valid UUID format  
✓ Returns 400 if format invalid  
✓ Fast regex-based validation  

**When to use:** Apply at `/api/dao/:daoId` level for all DAO routes

#### `validateDAOScope` (From `security-integration.ts`)
✓ Validates user authenticated  
✓ Validates DAO scope for request  
✓ Extracts and stores userId for use in handlers  
✓ Logs scope validation events  

**When to use:** Apply to all handlers requiring DAO context

#### `secureRoute` (From `security-integration.ts`)
✓ Sanitizes request body  
✓ Detects suspicious input patterns  
✓ Assesses threat level  
✓ Logs security events  
✓ Catches and handles errors  

**When to use:** Wrap actual handler functions

#### `auditLog` (From `security-integration.ts`)
✓ Times request execution  
✓ Logs operation type, user, DAO, result  
✓ Tracks duration for performance monitoring  

**When to use:** Apply to sensitive operations (transfers, proposals, etc.)

#### `trackDeprecatedEndpoint` (From `deprecation-monitor.ts`)
✓ Records every endpoint hit  
✓ Tracks unique users  
✓ Measures response times  
✓ Counts errors  

**When to use:** Apply to routes scheduled for deprecation

---

## Request/Response Lifecycle

### Incoming Request
```
Request comes in
  ↓
[validateDaoIdMiddleware] - Check DAO ID format
  ↓
[validateDAOScope] - Extract userId, validate context
  ↓
[auditLog] - Start timing
  ↓
[secureRoute wrapper] - Sanitize inputs, detect threats
  ↓
Handler function executes
  ↓
Response is sanitized
  ↓
[auditLog] - Log completion
  ↓
Response sent to client (includes Deprecation headers if old route)
```

### Example Request Flow
```typescript
// Request: POST /api/dao/550e8400-e29b-41d4-a716-446655440000/treasury/transfer/native
// Body: { "toAddress": "<img src=x onerror=alert('xss')>", "amount": "100.50" }

// Step 1: validateDaoIdMiddleware
✓ Pass: "550e8400-e29b-41d4-a716-446655440000" matches UUID regex

// Step 2: validateDAOScope  
✓ Pass: User authenticated, daoId extracted, stored in req.daoId

// Step 3: auditLog
⏱ Start timing: 0ms

// Step 4: secureRoute
✓ Sanitize body: "<img src=x onerror=alert('xss')>" → "&lt;img src=x onerror=alert('xss')&gt;"
⚠ Detect threat: XSS_PATTERN_DETECTED logged
→ Threat level: "medium"

// Step 5: Handler
✓ Execute with sanitized inputs: { "toAddress": "&lt;img...", "amount": "100.50" }
✓ Database query safe due to parameterization

// Step 6: Response
✓ Data sanitized before sending

// Step 7: auditLog
✓ Complete: POST /treasury/transfer/native - 45ms - User#123 - 200 OK
```

---

## Configuration Recommendations

### For Production
```typescript
// Strict validation
const rateLimit = rateLimitByUserId(
  5,      // 5 requests
  60000   // per 60 seconds (very strict for financial ops)
);

// Deep threat analysis
const suspiciousPatterns = detectSuspiciousInput(input);
if (suspiciousPatterns.length > 0) {
  // Block or log aggressively
  logger.error('[SECURITY] High-risk request', { patterns, userId, daoId });
}
```

### For Development
```typescript
// Relaxed for testing
const rateLimit = rateLimitByUserId(
  50,     // 50 requests
  60000   // per 60 seconds
);

// Detailed logging
const threatLevel = assessThreatLevel(req);
logger.debug(`[THREAT] Level: ${threatLevel}`, { patterns, path, method });
```

### For Staging
```typescript
// Monitor deprecated endpoints closely
app.get('/admin/deprecated-metrics', getDeprecationMetrics);

// Export metrics hourly for analysis
setInterval(() => {
  deprecationMonitor.exportMetrics();
}, 3600000);
```

---

## Testing Security Integration

### Unit Test Example
```typescript
import { validateDaoId } from '../middleware/security';
import { secureRoute } from '../middleware/security-integration';

describe('Security Middleware', () => {
  test('validateDaoId accepts valid UUID', () => {
    const valid = '550e8400-e29b-41d4-a716-446655440000';
    expect(validateDaoId(valid)).toBe(true);
  });

  test('validateDaoId rejects invalid format', () => {
    const invalid = 'not-a-uuid';
    expect(validateDaoId(invalid)).toBe(false);
  });

  test('secureRoute sanitizes request body', async () => {
    const req = {
      params: { daoId: '550e8400-e29b-41d4-a716-446655440000' },
      body: { name: '<script>alert("xss")</script>' },
    } as any;
    
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as any;

    const handler = secureRoute(async (req, res) => {
      expect(req.body.name).toContain('&lt;script&gt;');
      res.json({ escaped: true });
    });

    await handler(req, res, () => {});
    expect(res.json).toHaveBeenCalledWith({ escaped: true });
  });
});
```

### Integration Test Example
```bash
#!/bin/bash

# Test SQL injection protection
curl -X POST "http://localhost:3000/api/dao/invalid'/OR'1'='1/treasury/transfer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
# Expected: 400 Bad Request - Invalid DAO ID format

# Test XSS protection
curl -X POST "http://localhost:3000/api/dao/550e8400-e29b-41d4-a716-446655440000/treasury/transfer/native" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"script":"<img src=x onerror=alert(1)>"}'
# Expected: 200 OK with sanitized response

# Test rate limiting
for i in {1..15}; do
  curl -X GET "http://localhost:3000/api/dao/550e8400-e29b-41d4-a716-446655440000/treasury/budget" \
    -H "Authorization: Bearer $TOKEN"
done
# Expected: First 10 succeed, 11+ get 429 Too Many Requests
```

---

## Monitoring & Alerting

### Key Metrics to Monitor
```typescript
// High-threat request rate
const threats = deprecationMonitor.getMetrics()
  .filter(m => m.error_rate > 0.1); // >10% error rate

// Deprecated endpoint usage (should decrease over time)
const usage = deprecationMonitor.getMetrics()
  .map(m => ({ endpoint: m.endpoint, count: m.usage_count }));

// Response time degradation
const slowEndpoints = deprecationMonitor.getMetrics()
  .filter(m => m.avg_response_time_ms > 1000); // >1 second
```

### Setting Up Alerts
```typescript
// Alert if deprecated endpoint still in use
if (deprecationMonitor.getMetrics().some(m => m.usage_count > 100)) {
  logger.warn('[ALERT] Deprecated endpoints still heavily used');
  // Send Slack/PagerDuty alert
}

// Alert if error rate spiking
if (deprecationMonitor.getMetrics().some(m => m.error_rate > 0.2)) {
  logger.error('[ALERT] High error rate on deprecated endpoints');
  // Send Slack/PagerDuty alert
}
```

---

## Troubleshooting

### Issue: Valid requests being rejected with 400 "Invalid DAO ID"
**Solution:** Ensure DAO ID is a valid V4 UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

### Issue: Rate limiting seems too aggressive
**Solution:** Adjust limits in `rateLimitByUserId(maxRequests, windowMs)`:
```typescript
// Default: 10 requests per 60 seconds
// For API: 20 requests per 60 seconds
// For webhooks: 100 requests per 60 seconds
```

### Issue: Suspicious input being flagged but should be allowed
**Solution:** Update pattern detection in `detectSuspiciousInput()` or implement custom validator:
```typescript
export function customValidator(input: string): string[] {
  const warnings: string[] = [];
  
  // Add custom rules here
  if (input.includes('--')) {
    warnings.push('POTENTIAL_SQL_COMMENT');
  }
  
  return warnings;
}
```

---

## Next Steps

1. **Integrate** security middleware into all DAO routes
2. **Test** using provided test suite (test-security-hardening.sh)
3. **Monitor** deprecated endpoint usage via admin dashboard
4. **Migrate** clients to new consolidated routes before sunset date
5. **Decommission** old routes 90 days after deployment

For questions, refer to:
- Security module: `/server/middleware/security.ts`
- Integration helpers: `/server/middleware/security-integration.ts`
- Monitoring: `/server/middleware/deprecation-monitor.ts`
