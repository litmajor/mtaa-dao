# AGENT SECURITY FIX CHECKLIST & TRACKING

**Project**: MTAA DAO Platform - Security Remediation  
**Start Date**: [To be filled]  
**Target Completion**: 8 weeks  
**Status**: Not Started  

---

## PHASE 1: CRITICAL VULNERABILITIES (Week 1-2)

### Critical Issue #1: Permission Verification in Proposal Execution

**File**: `server/routes/proposal-execution.ts`

**Tasks**:
- [ ] Create `requireDAOAdmin` middleware
- [ ] Add middleware to GET /api/proposal-execution/:daoId/queue
- [ ] Add middleware to POST /api/proposal-execution/:daoId/execute/:proposalId
- [ ] Add middleware to DELETE /api/proposal-execution/:daoId/cancel/:executionId
- [ ] Remove generic error responses (no stack traces)
- [ ] Add audit logging for all actions
- [ ] Write tests:
  - [ ] Non-member cannot access queue
  - [ ] Non-admin member cannot execute
  - [ ] Admin can execute
  - [ ] Failed access is logged
  - [ ] Permission denial returns 403

**Verification**:
```bash
# Test 1: Non-member access denied
curl -H "Authorization: Bearer <non-member-token>" \
  https://api.staging/api/proposal-execution/DAO-XYZ/queue
# Expected: 403 Forbidden

# Test 2: Admin can access
curl -H "Authorization: Bearer <admin-token>" \
  https://api.staging/api/proposal-execution/DAO-XYZ/queue
# Expected: 200 OK with queue data

# Test 3: Check logs
grep -i "permission denied" server.log
# Expected: Entry for non-member attempt
```

**Sign-Off**:
- [ ] Code reviewed by: ___________
- [ ] Tests pass: ___________
- [ ] Staging tested: ___________
- [ ] Ready for production: ___________

**Status**: ⬜ Not Started  
**Estimated Effort**: 8 hours  
**Assigned To**: ___________  

---

### Critical Issue #2: Agent Constraint Checker

**File**: `server/services/constraintChecker.ts` (NEW)

**Tasks**:
- [ ] Create ConstraintChecker class with:
  - [ ] checkConstraints() method
  - [ ] getAllowedActionsForAgent() method
  - [ ] getMaxAmount() method
  - [ ] getMaxDailyActions() method
  - [ ] getMaxDailyAmount() method
  - [ ] logConstraintCheck() method
- [ ] Define constraint limits for each agent type
- [ ] Integrate with ProposalExecutionService:
  - [ ] Call checkConstraints before execution
  - [ ] Reject if violations exist
  - [ ] Log constraint check results
- [ ] Write tests:
  - [ ] Magnitude check works
  - [ ] Daily transaction limit enforced
  - [ ] Daily amount limit enforced
  - [ ] Violations are logged
  - [ ] Approved transactions logged
  - [ ] Multiple agents have different limits

**Verification**:
```bash
# Test 1: Magnitude limit exceeded
curl -X POST \
  -d '{"amount": 2000000}' \
  https://api.staging/api/proposal-execution/DAO-A/execute/PROP-1
# Expected: 403 with constraint violation

# Test 2: Within limit
curl -X POST \
  -d '{"amount": 50000}' \
  https://api.staging/api/proposal-execution/DAO-A/execute/PROP-1
# Expected: 200 OK, executes

# Test 3: Check audit log
SELECT * FROM agentActions WHERE agentId='agent-treasury-1' AND actionType='treasury_transfer' AND createdAt > NOW() - INTERVAL '24 hours';
# Expected: Shows recent constraint checks
```

**Sign-Off**:
- [ ] Code reviewed by: ___________
- [ ] Tests pass: ___________
- [ ] Constraints properly defined: ___________
- [ ] Staging tested: ___________
- [ ] Ready for production: ___________

**Status**: ⬜ Not Started  
**Estimated Effort**: 12 hours  
**Assigned To**: ___________  

---

### Critical Issue #3: Agent Message Signing

**File**: `server/core/agents/gateway/message-bus.ts`

**Tasks**:
- [ ] Implement signMessage() function
- [ ] Implement verifyMessage() function
- [ ] Implement nonce tracking
- [ ] Add timestamp validation (5-minute window)
- [ ] Add replay attack prevention
- [ ] Update message publisher to sign all messages
- [ ] Update message handler to verify signatures
- [ ] Write tests:
  - [ ] Valid message accepted
  - [ ] Invalid signature rejected
  - [ ] Expired message rejected
  - [ ] Replayed message rejected
  - [ ] Tampered message rejected
  - [ ] Spoofed agent rejected

**Verification**:
```bash
# Test 1: Valid signed message
curl -X POST \
  -d '{"payload": {...}, "signature": "valid-hash"}' \
  https://api.staging/api/internal/agent-message
# Expected: 200 OK, message processed

# Test 2: Invalid signature
curl -X POST \
  -d '{"payload": {...}, "signature": "invalid-hash"}' \
  https://api.staging/api/internal/agent-message
# Expected: 401 Unauthorized

# Test 3: Old timestamp
curl -X POST \
  -d '{"payload": {"timestamp": <6-minutes-ago>}, "signature": "valid"}' \
  https://api.staging/api/internal/agent-message
# Expected: 401 Unauthorized (expired)
```

**Sign-Off**:
- [ ] Code reviewed by: ___________
- [ ] Crypto implementation verified: ___________
- [ ] Tests pass: ___________
- [ ] Staging tested: ___________
- [ ] Ready for production: ___________

**Status**: ⬜ Not Started  
**Estimated Effort**: 10 hours  
**Assigned To**: ___________  

---

### Critical Issue #4: Admin Endpoint Authentication

**File**: `server/routes/admin.ts` and `server/routes/admin/*.ts`

**Tasks**:
- [ ] Audit all admin routes for requireSuperAdmin middleware
- [ ] Add middleware to missing routes:
  - [ ] admin/analytics
  - [ ] admin/users
  - [ ] admin/daos
  - [ ] admin/logs
  - [ ] admin/flags
  - [ ] admin/settings
  - [ ] admin/security
- [ ] Verify no role escalation possible
- [ ] Test super_admin verification on all endpoints
- [ ] Write tests:
  - [ ] Admin role cannot access /admin endpoints
  - [ ] Super admin can access all /admin endpoints
  - [ ] Regular user gets 403
  - [ ] Missing super admin requirement is caught

**Sign-Off**:
- [ ] All admin routes audited by: ___________
- [ ] Middleware applied consistently by: ___________
- [ ] Tests pass: ___________
- [ ] Code reviewed by: ___________
- [ ] Ready for production: ___________

**Status**: ⬜ Not Started  
**Estimated Effort**: 6 hours  
**Assigned To**: ___________  

---

## PHASE 2: HIGH SEVERITY ISSUES (Week 3-4)

### High Issue #1: Input Validation Framework

**File**: `server/schemas/validation.ts` (NEW)

**Tasks**:
- [ ] Create Zod schemas for:
  - [ ] UUID validation
  - [ ] Ethereum address validation
  - [ ] Amount validation
  - [ ] Pagination validation
  - [ ] Proposal creation
  - [ ] Treasury transfer
  - [ ] Voting
  - [ ] DAO creation
  - [ ] All other POST/PATCH endpoints
- [ ] Create validateInput middleware
- [ ] Apply to routes:
  - [ ] All governance routes
  - [ ] All treasury routes
  - [ ] All proposal routes
  - [ ] All withdrawal routes
  - [ ] All DAO routes
- [ ] Write tests (20+ test cases):
  - [ ] Invalid types rejected
  - [ ] Out-of-range values rejected
  - [ ] Invalid formats rejected
  - [ ] Valid data accepted
  - [ ] Error messages helpful

**Sign-Off**:
- [ ] Schemas defined by: ___________
- [ ] Middleware implemented by: ___________
- [ ] Applied to all routes by: ___________
- [ ] Tests pass (20+): ___________
- [ ] Ready for production: ___________

**Status**: ⬜ Not Started  
**Estimated Effort**: 20 hours  
**Assigned To**: ___________  

---

### High Issue #2: Error Message Filtering

**File**: Multiple route files

**Tasks**:
- [ ] Audit all error responses for stack traces
- [ ] Remove stack traces from error responses
- [ ] Implement generic error messages:
  - [ ] "Invalid request" instead of SQL error
  - [ ] "Not found" instead of schema error
  - [ ] "Server error" instead of connection string
- [ ] Add detailed logging server-side
- [ ] Write tests:
  - [ ] No stack traces in responses
  - [ ] Detailed errors in server logs
  - [ ] Generic messages to clients
  - [ ] 500 errors still logged

**Sign-Off**:
- [ ] All routes audited by: ___________
- [ ] Responses fixed by: ___________
- [ ] Logging implemented by: ___________
- [ ] Tests pass: ___________
- [ ] Ready for production: ___________

**Status**: ⬜ Not Started  
**Estimated Effort**: 8 hours  
**Assigned To**: ___________  

---

### High Issue #3: Rate Limiting Implementation

**File**: `server/middleware/rateLimiter.ts` (NEW)

**Tasks**:
- [ ] Create rate limiting middleware for:
  - [ ] General endpoints (100/min)
  - [ ] Authentication (5/min per IP)
  - [ ] Token refresh (10/hour per user)
  - [ ] Agent operations (5/min per DAO)
- [ ] Apply to endpoints
- [ ] Add rate limit headers to responses
- [ ] Add bypass for health checks
- [ ] Write tests:
  - [ ] Requests allowed within limit
  - [ ] Requests blocked above limit
  - [ ] Different limits per endpoint
  - [ ] Rate limit resets properly
  - [ ] Headers present in response

**Sign-Off**:
- [ ] Middleware implemented by: ___________
- [ ] Applied to routes by: ___________
- [ ] Tests pass: ___________
- [ ] Staging tested by: ___________
- [ ] Ready for production: ___________

**Status**: ⬜ Not Started  
**Estimated Effort**: 12 hours  
**Assigned To**: ___________  

---

### High Issue #4: Audit Logging Framework

**File**: `server/services/auditLogService.ts` (NEW)

**Tasks**:
- [ ] Create AuditLogService with:
  - [ ] log() method
  - [ ] getAuditTrail() method
  - [ ] logPermissionDenied() method
  - [ ] logAgentAction() method
  - [ ] logProposalExecution() method
- [ ] Create auditLogs table schema
- [ ] Add audit logging to:
  - [ ] All permission checks
  - [ ] All agent actions
  - [ ] All role changes
  - [ ] All sensitive operations
- [ ] Write tests:
  - [ ] Actions are logged
  - [ ] Failed access is logged
  - [ ] Audit trail retrievable
  - [ ] Data is retained properly
  - [ ] No sensitive data in logs

**Sign-Off**:
- [ ] Schema created by: ___________
- [ ] Service implemented by: ___________
- [ ] Logging added by: ___________
- [ ] Tests pass: ___________
- [ ] Ready for production: ___________

**Status**: ⬜ Not Started  
**Estimated Effort**: 16 hours  
**Assigned To**: ___________  

---

## PHASE 3: MEDIUM SEVERITY ISSUES (Week 5-8)

### Medium Issue #1: Token Revocation

**File**: `server/services/tokenService.ts`

**Tasks**:
- [ ] Create revokedTokens table
- [ ] Implement revokeToken() function
- [ ] Implement isTokenRevoked() check
- [ ] Add to authentication middleware
- [ ] Add logout endpoint that revokes token
- [ ] Write tests

**Status**: ⬜ Not Started  
**Assigned To**: ___________  

---

### Medium Issue #2: Session Tracking

**File**: `server/services/sessionService.ts`

**Tasks**:
- [ ] Create userSessions table
- [ ] Implement createSession() function
- [ ] Implement updateActivity() function
- [ ] Implement endSession() function
- [ ] Track IP, user agent, login time
- [ ] Write tests

**Status**: ⬜ Not Started  
**Assigned To**: ___________  

---

### Medium Issue #3: Transaction Atomicity

**File**: `server/proposalExecutionService.ts`

**Tasks**:
- [ ] Wrap multi-step operations in db.transaction()
- [ ] Test rollback on failure
- [ ] Verify state consistency
- [ ] Write tests

**Status**: ⬜ Not Started  
**Assigned To**: ___________  

---

### Medium Issue #4: Advanced Monitoring

**File**: `server/services/monitoringService.ts`

**Tasks**:
- [ ] Set up security event monitoring
- [ ] Configure alert thresholds
- [ ] Implement enforcement actions
- [ ] Set up dashboards
- [ ] Write tests

**Status**: ⬜ Not Started  
**Assigned To**: ___________  

---

## TESTING SUMMARY

| Test Type | Count | Status | Assigned To |
|-----------|-------|--------|------------|
| Authorization tests | 20 | ⬜ | |
| Constraint tests | 15 | ⬜ | |
| Input validation tests | 25 | ⬜ | |
| Audit logging tests | 10 | ⬜ | |
| Rate limiting tests | 10 | ⬜ | |
| **TOTAL** | **80** | | |

**Target**: All tests passing before production deployment

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment (Week 8)

- [ ] All tests passing (100%)
- [ ] Code review approved by: ___________
- [ ] Security review approved by: ___________
- [ ] Staging tested by: ___________
- [ ] Documentation complete
- [ ] Team trained
- [ ] Rollback plan documented
- [ ] On-call team briefed

### Deployment Process

1. **Backup Phase**
   - [ ] Database backup created
   - [ ] Backup verified
   - [ ] Rollback plan documented

2. **Staging Deployment**
   - [ ] Deploy to staging
   - [ ] Run full test suite
   - [ ] Smoke tests pass
   - [ ] No errors in logs

3. **Production Deployment (Canary - 5%)**
   - [ ] Deploy to 5% of production
   - [ ] Monitor metrics (30 min)
   - [ ] No critical errors
   - [ ] No performance degradation

4. **Production Rollout (100%)**
   - [ ] Roll out to 100%
   - [ ] Monitor metrics (1 hour)
   - [ ] Continue monitoring (24 hours)
   - [ ] Send deployment notification

### Post-Deployment (Day 1)

- [ ] Monitor error rates
- [ ] Check security logs
- [ ] Verify rate limiting works
- [ ] Verify audit logging works
- [ ] Test with real users (if applicable)

---

## METRICS & SUCCESS CRITERIA

### Baseline (Before Fixes)

| Metric | Current | Target |
|--------|---------|--------|
| Security Score | 35/100 | 85/100 |
| CRITICAL Vulns | 4 | 0 |
| HIGH Vulns | 8 | 0 |
| MEDIUM Vulns | 12 | 0 |
| Test Coverage | ~30% | 100% |
| Audit Logging | None | Complete |
| Rate Limiting | None | Everywhere |
| Input Validation | Minimal | 100% |

### Success Criteria (After Fixes)

- ✅ Zero CRITICAL vulnerabilities
- ✅ Zero HIGH vulnerabilities
- ✅ Security score 85+
- ✅ All 80+ tests passing
- ✅ Complete audit trail
- ✅ Rate limiting on all endpoints
- ✅ Input validation on all POST/PATCH
- ✅ Constraint checking on all agent actions

---

## TEAM COMMUNICATION

### Weekly Status Meeting

**Attendees**: Engineering Lead, Security Lead, QA Lead

**Agenda**:
1. Progress on CRITICAL fixes
2. Issues encountered
3. Test results
4. Timeline adjustments
5. Next week priorities

**Minutes Document**: `SECURITY_REMEDIATION_WEEKLY_NOTES.md`

---

## SIGN-OFF

**Project Manager**: ___________  
**Engineering Lead**: ___________  
**Security Lead**: ___________  
**CTO/Tech Lead**: ___________  
**Date**: ___________  

---

**This checklist will be updated weekly with progress.**

