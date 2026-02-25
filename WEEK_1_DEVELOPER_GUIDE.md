# Week 1 Quick Reference - Developer Guide

## Quick Start

### For Testing
```bash
# Run all Week 1 tests
npm test -- week1-security-fixes.test.ts

# Run constraint checker tests
npm test -- constraintChecker.test.ts

# Run message signing tests
npm test -- agentMessageSigning.test.ts

# Run with coverage
npm test -- --coverage week1
```

### For Integration
```typescript
// Import the new services
import { requireDAOAdmin, requireDAOMember } from '../middleware/daoPermissions';
import { ConstraintChecker } from '../services/constraintChecker';
import { AgentMessageSigner, AgentAuthContext } from '../core/agents/security/messageSigningService';
import { requireSuperAdminEnhanced } from '../middleware/adminAuth';
```

---

## Fix #1: Permission Middleware

### Use in Routes
```typescript
import { requireDAOAdmin, requireDAOMember } from '../middleware/daoPermissions';

// Member can view queue
router.get('/:daoId/queue', isAuthenticated, requireDAOMember, handler);

// Only admins can execute
router.post('/:daoId/execute/:proposalId', isAuthenticated, requireDAOAdmin, handler);

// Only admins can cancel
router.delete('/:daoId/cancel/:executionId', isAuthenticated, requireDAOAdmin, handler);
```

### Access Control Rules
- `requireDAOMember`: User must be DAO member (any role)
- `requireDAOAdmin`: User must be DAO owner or admin

### Request Object
After middleware passes:
- `req.daoRole` - Contains the user's DAO role ('owner', 'admin', or 'member')
- Logs audit entry with user ID, DAO ID, and role

---

## Fix #2: ConstraintChecker Service

### Basic Usage
```typescript
import { ConstraintChecker } from '../services/constraintChecker';

const result = await ConstraintChecker.checkProposalExecution({
  daoId: 'dao-123',
  userId: 'user-456',
  proposalId: 'prop-789',
  action: 'treasury_transfer',
  amount: 100_000,
  dailyLimit: 1_000_000,
  hourlyLimit: 10,
  rateLimitMinutes: 60
});

if (!result.isValid) {
  console.error('Constraint violations:', result.violations);
  result.warnings.forEach(w => console.warn(w));
}
```

### Violation Types
- `MAGNITUDE_EXCEEDED` - Transaction too large
- `DAILY_LIMIT_EXCEEDED` - Daily spending limit hit
- `RATE_LIMIT_EXCEEDED` - Too many executions in time period
- `DUPLICATE_PENDING_EXECUTION` - Multiple pending for same proposal
- `*_CHECK_ERROR` - Error during checking

### Severity Levels
- `critical` - Blocks execution (e.g., magnitude exceeded)
- `high` - Blocks execution (e.g., daily limit exceeded)
- `medium` - Warning but may proceed (implementation dependent)

### Configuration
Adjust in your DAO setup:
```typescript
const constraints = {
  dailyLimit: 1_000_000,      // Max transaction value per day
  hourlyLimit: 10,             // Max executions per hour
  rateLimitMinutes: 60,        // Time window for rate limit
  // Magnitude limit is hardcoded: 10_000_000
};
```

---

## Fix #3: Agent Message Signing

### Register Agents (On Startup)
```typescript
import { AgentAuthContext } from '../core/agents/security/messageSigningService';

// Register all system agents with their secrets
AgentAuthContext.registerAgent('ANALYZER', process.env.ANALYZER_SECRET);
AgentAuthContext.registerAgent('DEFENDER', process.env.DEFENDER_SECRET);
AgentAuthContext.registerAgent('SYNCHRONIZER', process.env.SYNCHRONIZER_SECRET);
```

### Sign Message
```typescript
import { AgentMessageSigner } from '../core/agents/security/messageSigningService';

const signedMsg = AgentMessageSigner.signMessage(
  'ANALYZER',           // Sender agent
  'DEFENDER',           // Recipient agent
  { action: 'verify_proposal', data: {...} },  // Message
  analyzerSecret        // Sender's secret
);

// signedMsg.signature - Can be sent over network
// signedMsg.nonce - Unique per message
// signedMsg.timestamp - When signed
```

### Verify Message
```typescript
const result = AgentMessageSigner.verifyMessage(
  signedMsg,
  defenderSecret        // Recipient's secret (for verification)
);

if (!result.isValid) {
  console.error('Invalid message:', result.error);
  // Don't process message
}

// Process verified message
console.log('Verified from:', result.sender);
console.log('Message:', result.message);
```

### Inter-Agent Communication
```typescript
// Create signed envelope
const envelope = AgentMessageSigner.createEnvelope(
  'ANALYZER',
  'DEFENDER',
  'verify_proposal',
  { proposalId: 'prop-123' },
  analyzerSecret
);

// Send envelope via network/queue...

// On recipient side
const verified = AgentMessageSigner.verifyEnvelope(envelope, defenderSecret);
if (verified.isValid) {
  // Process verified action
}
```

### Message TTL
- Messages valid for 5 minutes
- Older messages rejected with "Message expired"
- Prevents old/stale message processing

### Replay Prevention
- Each message gets unique nonce
- Same message sent twice = rejected on second
- Nonces tracked in memory (Redis in production)

---

## Fix #4: Admin Endpoint Authentication

### Middleware Stack
```typescript
import { 
  requireSuperAdminEnhanced, 
  verifyAdminRequestHeaders,
  logAdminAction 
} from '../middleware/adminAuth';

router.use(isAuthenticated);                    // 1. Check JWT token
router.use(requireSuperAdminEnhanced);         // 2. Verify super_admin + not banned
router.use(verifyAdminRequestHeaders);         // 3. Validate headers
router.use(logAdminAction('admin_access'));    // 4. Log for audit
```

### Access Rules
- **Requirement**: `super_admin` role ONLY
- **Banned Check**: Admins with `isBanned: true` are rejected
- **Header Check**: `Content-Type: application/json` + `User-Agent` required

### What Gets Logged
- User ID and email
- Route and method
- IP address
- User-Agent string
- Query parameters (keys only)
- Timestamp

### Example Request (valid)
```bash
curl -X GET http://api/admin/users/list \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0..." \
  -H "Accept: application/json"
```

### Error Responses
```typescript
// Not authenticated
401 { error: 'Authentication required' }

// Not super admin
403 { error: 'Super admin role required' }

// Account banned
403 { error: 'Account suspended' }

// Invalid headers
400 { error: 'Content-Type must be application/json' }
400 { error: 'User-Agent header required' }
```

---

## Testing Quick Reference

### Run Specific Test Suite
```bash
# Permission middleware tests
npm test -- week1-security-fixes.test.ts -t "Permission Middleware"

# Constraint checker tests
npm test -- constraintChecker.test.ts -t "Magnitude Checking"

# Message signing tests
npm test -- agentMessageSigning.test.ts -t "Message Verification"

# Admin auth tests
npm test -- week1-security-fixes.test.ts -t "Admin Endpoint"
```

### Test Database Setup
Tests automatically:
1. Create test users (admin, member, non-member)
2. Create test DAO
3. Set up memberships
4. Generate test tokens
5. Clean up after test

### Debugging Tests
```typescript
// Enable verbose logging
logger.setLevel('debug');

// Check constraint cache
const stats = ConstraintChecker.getCacheStats();
console.log('Cache stats:', stats);

// Clear nonce cache if needed
AgentMessageSigner.clearNonceCache();
```

---

## Common Integration Patterns

### Pattern 1: Secured Route with Constraints
```typescript
router.post('/api/proposals/:daoId/execute', 
  isAuthenticated,
  requireDAOAdmin,
  async (req, res) => {
    // 1. User is authenticated ✓
    // 2. User is DAO admin ✓
    
    // 3. Check constraints
    const constraints = await ConstraintChecker.checkProposalExecution({...});
    if (!constraints.isValid) return res.status(400).json({...});
    
    // 4. Execute proposal
    // ...
  }
);
```

### Pattern 2: Agent-to-Agent Communication
```typescript
// Agent A sends to Agent B
const signed = AgentMessageSigner.signMessage(
  'AGENT_A', 'AGENT_B', message, agentASecret
);
queue.emit('agent:message', signed);

// Agent B receives
queue.on('agent:message', (signed) => {
  const verified = AgentMessageSigner.verifyMessage(signed, agentBSecret);
  if (verified.isValid) {
    processAction(verified.message);
  }
});
```

### Pattern 3: Admin Audit Trail
```typescript
// Automatically logged by requireSuperAdminEnhanced
router.put('/api/admin/users/:userId/role',
  isAuthenticated,
  requireSuperAdminEnhanced,  // Logs access + verification
  async (req, res) => {
    // Admin action is already logged
    // Additional audit logs can be added here
    logger.info('Admin updated user role', {
      adminId: req.adminUser.id,
      targetUser: req.params.userId,
      newRole: req.body.role
    });
  }
);
```

---

## Deployment Checklist

- [ ] Run all tests: `npm test -- week1`
- [ ] Verify no hardcoded secrets in code
- [ ] Set environment variables:
  - `ANALYZER_SECRET` - ANALYZER agent secret
  - `DEFENDER_SECRET` - DEFENDER agent secret  
  - `SYNCHRONIZER_SECRET` - SYNCHRONIZER agent secret
- [ ] Configure constraint limits in DAOs
- [ ] Set up monitoring for admin_access logs
- [ ] Test admin routes with valid/invalid tokens
- [ ] Verify permission errors logged properly
- [ ] Check message signing timestamp clock sync
- [ ] Monitor constraint checker performance

---

## Troubleshooting

### Issue: "Replay attack detected - nonce already used"
**Cause**: Same signed message sent twice  
**Fix**: Create new message with `signMessage()` (generates new nonce)

### Issue: "Message expired"
**Cause**: Message older than 5 minutes  
**Fix**: Sign fresh message or increase TTL

### Issue: "Signature verification failed"
**Cause**: Wrong secret or message tampered  
**Fix**: Verify secrets match, check message wasn't modified

### Issue: "Daily limit exceeded"
**Cause**: Too many transactions today  
**Fix**: Wait until next day or increase DAO daily limit

### Issue: "Rate limit exceeded"
**Cause**: Too many executions in last hour  
**Fix**: Wait or increase hourly limit

### Issue: "Not a member of this DAO"
**Cause**: User not in daoMemberships table  
**Fix**: Add user to DAO first

---

## Reference Documentation

See full documentation:
- [WEEK_1_IMPLEMENTATION_COMPLETE.md](WEEK_1_IMPLEMENTATION_COMPLETE.md) - Complete implementation details
- [AGENT_SECURITY_AUDIT_FIX_IMPLEMENTATION_GUIDE.md](AGENT_SECURITY_AUDIT_FIX_IMPLEMENTATION_GUIDE.md) - Detailed fix guide
- [AGENT_SECURITY_AUDIT_REPORT.md](AGENT_SECURITY_AUDIT_REPORT.md) - Full vulnerability report
- [SECURITY_REMEDIATION_CHECKLIST.md](SECURITY_REMEDIATION_CHECKLIST.md) - All 80+ action items

---

**Last Updated**: January 21, 2026  
**Version**: 1.0  
**Status**: ✅ All 4 CRITICAL fixes implemented and tested
