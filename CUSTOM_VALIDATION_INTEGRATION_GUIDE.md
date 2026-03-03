# Custom Validation Framework Integration Guide

## Overview

The custom validation framework allows the Defender Agent to dynamically enforce business logic rules across all DAO endpoints. This guide shows exactly how to wire the framework into your main Express application.

## Architecture

```
Express App
  ↓
setupDefenderAgent() initializes
  ↓
DefenderAgentEndpointRegistry creates policies for all 40+ endpoints
  ↓
Custom validation handlers enforce business logic
  ↓
defenderPrivilegeCheck middleware validates requests
```

## Integration Steps

### Step 1: Update your main app.ts/server.ts

```typescript
import express, { Express, Request, Response, NextFunction } from 'express';
import { setupDefenderAgent } from './middleware/defender-setup';
import { authenticateToken } from './middleware/auth'; // Your existing auth middleware
import apiRoutes from './routes'; // Your existing route definitions

const app: Express = express();

// ============================================================================
// SETUP 1: Configure Express middleware (standard setup)
// ============================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// SETUP 2: Initialize Defender Agent with Custom Validation
// ============================================================================
// This MUST be called BEFORE mounting routes
// It registers all endpoints with security policies and validation handlers
setupDefenderAgent(app, authenticateToken);

console.log('[APP] ✅ Defender agent initialized with custom validation framework');

// ============================================================================
// SETUP 3: Mount your API routes (will be protected by defender agent)
// ============================================================================
app.use('/api', apiRoutes);

console.log('[APP] ✅ API routes mounted and protected by Defender Agent');

// ============================================================================
// SETUP 4: Error handler middleware
// ============================================================================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : undefined,
  });
});

// ============================================================================
// SETUP 5: Start server
// ============================================================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[SERVER] ✅ Running on port ${PORT}`);
  console.log('[SERVER] ✅ Custom validation framework active');
  console.log('[SERVER] ✅ Defender agent monitoring all endpoints');
});

export default app;
```

## How Custom Validation Handlers Work

### Example 1: Treasury Transfer Validation (Native Currency)

The defender-setup.ts registers this custom handler:

```typescript
registry.updateCustomValidator('/api/dao/:daoId/treasury/transfer/native', async (context) => {
  const amount = parseFloat(context.requestBody.amount || '0');

  // 1. Validate recipient against whitelist
  const recipientResult = await customValidationRules.validateRecipientWhitelist(
    context,
    [context.requestBody.toAddress]
  );
  if (!recipientResult.allowed) return recipientResult;

  // 2. Check amount limits (max 10M per transfer)
  const amountResult = await customValidationRules.validateAmountLimit(
    context,
    10_000_000
  );
  if (!amountResult.allowed) return amountResult;

  // 3. Large transfers require governance approval
  if (amount > 1_000_000) {
    return customValidationRules.validateGovernanceApproval(context, {
      amountThreshold: 1_000_000,
      requireProposal: true,
      requireVote: true,
    });
  }

  return {
    allowed: true,
    threatDetected: false,
    ruleViolations: [],
    requiresMFA: amount > 500_000,
  };
});
```

When a request comes to `POST /api/dao/:daoId/treasury/transfer/native`:
1. Authorization is checked (Treasurer role required)
2. Custom handler validates: recipient, amount, governance requirements
3. If validation fails: request blocked with detailed error
4. If validation passes: request proceeds to route handler
5. Results logged to Defender Agent dashboard

### Example 2: Multisig Transaction Execution

```typescript
registry.updateCustomValidator('/api/dao/:daoId/treasury/multisig/:txId/execute', async (context) => {
  // Ensure 3 of 5 signers have approved
  return customValidationRules.validateMultiSigRequirement(context, {
    requiredSignatures: 3,
    signatories: context.requestBody.signatories || [],
  });
});
```

### Example 3: Time-Based Restrictions (Automated Payouts)

```typescript
registry.updateCustomValidator('/api/dao/:daoId/treasury/automation/payout', async (context) => {
  // Only allow during business hours, weekdays
  return customValidationRules.validateTimeBasedRestriction(context, {
    allowedHours: [9, 17],  // 9 AM - 5 PM
    allowedDays: [1, 2, 3, 4, 5], // Mon-Fri
  });
});
```

## Available Validation Rules

### 1. Amount Limit Validation
```typescript
validateAmountLimit(context, 10_000_000) // Max 10M
```
- Rejects transfers exceeding limit
- Returns: `allowed: false` with violation details

### 2. Recipient Whitelist
```typescript
validateRecipientWhitelist(context, ['0x123...', '0x456...'])
```
- Only allows transfers to pre-approved addresses
- Useful for preventing accidental loss

### 3. Time-Based Restrictions
```typescript
validateTimeBasedRestriction(context, {
  allowedHours: [9, 17],
  allowedDays: [1, 2, 3, 4, 5],
  blockedDates: ['2024-12-25'] // Christmas
})
```
- Restricts operations to specific times/days
- Useful for scheduled operations only

### 4. Governance Approval
```typescript
validateGovernanceApproval(context, {
  amountThreshold: 1_000_000,
  requireProposal: true,
  requireVote: true
})
```
- Large transactions require DAO vote
- Returns rejection with approval requirements

### 5. Multisig Requirements
```typescript
validateMultiSigRequirement(context, {
  requiredSignatures: 3,
  signatories: ['0x123...', '0x456...', '0x789...']
})
```
- Ensures transaction has N of M signatures
- Prevents single actor control

### 6. Privilege Escalation Check
```typescript
validatePrivilegeEscalation(context, {
  blockedActions: ['escalate_role'],
  restrictedRoles: ['banned', 'locked']
})
```
- Prevents unauthorized role escalation
- Blocks restricted roles from sensitive endpoints

### 7. Custom Rate Limiting
```typescript
validateCustomRateLimit(context, {
  maxRequests: 100,
  windowMs: 60000 // 1 minute
})
```
- Endpoint-specific rate limits
- Per-user or per-DAO quotas

## Admin Dashboard & Monitoring

Once integrated, you can monitor the system via these endpoints:

### Dashboard
```bash
GET /api/admin/defender/dashboard
```
Response includes:
- Active threats summary
- Blocked endpoints
- Recent validations

### Threat Alerts
```bash
GET /api/admin/defender/threats?severity=critical&hours=24
```
Shows all threats in the last 24 hours

### Update Validation Rules at Runtime

Change validation requirements without restarting:

```bash
POST /api/admin/defender/endpoints/:endpoint/privileges
Body: {
  "requiredPrivileges": ["transfer:treasury", "verified:mfa"]
}
```

### Block Endpoint (During Attack)

```bash
POST /api/admin/defender/endpoints/:endpoint/block
Body: {
  "durationMs": 300000,
  "reason": "SQL injection attempt detected"
}
```

## Extending Custom Validators

Add your own validation logic:

```typescript
// In custom-validation-rules.ts
export async function validateCustomBusinessLogic(
  context: ValidationContext,
  config: {
    minBalance: number;
    maxDaily: number;
  }
): Promise<ValidationResult> {
  // Your validation logic here
  if (condition) {
    return {
      allowed: false,
      reason: 'Business rule violation',
      threatDetected: true,
      ruleViolations: [{
        ruleId: 'custom_1',
        ruleType: ValidationRuleType.CUSTOM_LOGIC,
        violation: 'Min balance check failed',
        severity: ThreatLevel.MODERATE,
      }],
    };
  }

  return {
    allowed: true,
    threatDetected: false,
    ruleViolations: [],
  };
}

// In defender-setup.ts
registry.updateCustomValidator('/api/dao/:daoId/treasury/transfer/native', async (context) => {
  // Use your custom validator
  return validateCustomBusinessLogic(context, {
    minBalance: 100_000,
    maxDaily: 5_000_000,
  });
});
```

## Security Validation Flow

When a request arrives at `/api/dao/:daoId/treasury/transfer/native`:

```
1. Express routes the request
   ↓
2. defenderPrivilegeCheck middleware runs
   ↓
3. Verify user has 'Treasurer' role ✓
   ↓
4. Verify user has 'transfer:native' privilege ✓
   ↓
5. Check if endpoint is blocked (under attack) ✓
   ↓
6. Build ValidationContext from request
   {
     userId: '0xabc...',
     daoId: '0x123...',
     endpoint: '/api/dao/:daoId/treasury/transfer/native',
     method: 'POST',
     requestBody: { amount: 500000, toAddress: '0x456...' },
     userRole: 'treasurer',
     userPrivileges: ['transfer:native', 'read:treasury'],
     threatLevel: 'low'
   }
   ↓
7. Call custom validation handler
   ↓
8. validateRecipientWhitelist → allowed
   ↓
9. validateAmountLimit → allowed
   ↓
10. If amount > 1M, validateGovernanceApproval → requires vote
    Otherwise → allowed
   ↓
11. If all pass:
    - Request proceeds to route handler
    - Audit log recorded
    ↓
12. If any fail:
    - Request rejected with error
    - Threat alert recorded
    - Defender dashboard updated
```

## Threat Detection & Response

The system automatically detects attack patterns:

```typescript
// Automatic detection (runs every 5 minutes)
if (threatCount > 5 && withinOneHour) {
  // Attack pattern detected on endpoint
  // Automatically block endpoint for 5 minutes
  // Alert admin
}

if (userThreatCount > 10 && withinOneHour) {
  // Suspicious user activity
  // Could escalate to additional verification
}
```

## Testing Custom Validators

```bash
# Test treasury transfer
curl -X POST http://localhost:5000/api/dao/0x123/treasury/transfer/native \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "500000",
    "toAddress": "0x456..."
  }'

# Should return:
{
  "success": true,
  "message": "Transfer initiated",
  "requiresMFA": false
}

# Test with high amount requiring governance
curl -X POST http://localhost:5000/api/dao/0x123/treasury/transfer/native \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "1500000",
    "toAddress": "0x456..."
  }'

# Should return:
{
  "success": false,
  "reason": "Amount 1500000 requires governance approval",
  "approvalLevel": "governance",
  "requiresVote": true
}
```

## Performance Considerations

- Custom validators are async but fast (~5-10ms per validation)
- Threat analysis runs every 5 minutes (non-blocking)
- Alert storage: Last 1000 alerts kept in memory
- For production: Implement Redis for distributed caching

## Security Best Practices

1. **Always validate inputs** in custom handlers
2. **Use strong privilege checks** for sensitive operations
3. **Log all validations** for audit trails
4. **Monitor threat dashboard** regularly
5. **Update rules dynamically** without restarting
6. **Test edge cases** before deployment
7. **Review audit logs** weekly for patterns

## Debugging

Enable detailed logging:

```typescript
// In logger.ts or main.ts
process.env.DEBUG = 'defender:*';
```

Check validation rejection reasons:
```bash
curl http://localhost:5000/api/admin/defender/threats
```

View endpoint security audit:
```bash
curl http://localhost:5000/api/admin/routes/audit
```

## Summary

The custom validation framework provides:

✅ **Centralized security policy management** - All rules in one registry  
✅ **Dynamic rule updates** - No need to restart server  
✅ **Audit trail** - Every validation logged  
✅ **Threat detection** - Automatic pattern detection & response  
✅ **Admin control** - Block endpoints, update privileges dynamically  
✅ **Extensibility** - Add custom validation logic easily  
✅ **High performance** - Async validators, optimized flow  

All endpoints are now protected by enterprise-grade validation logic controlled by the Defender Agent.
