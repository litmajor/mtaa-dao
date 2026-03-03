# DAO Route Consolidation & Security Hardening

## Status: In Progress

### 1. Security Enhancements Implemented ✓
- Created `/server/middleware/security.ts` with:
  - Input validation (daoId, email, Ethereum address, numeric strings)
  - XSS prevention via HTML sanitization
  - Suspicious input pattern detection (SQL injection, XSS, path traversal)
  - Rate limiting per user ID
  - Request sanitization middleware
  - Security wrapper for route handlers

### 2. Route Consolidation Updated ✓
- Updated `/server/routes.ts`:
  - Consolidated all DAO-related routes under `/api/dao/:daoId/`
  - Added security middleware validation at `/api/dao/:daoId` level
  - Implemented backwards-compatible redirects from:
    - `/api/governance/:daoId/*` → `/api/dao/:daoId/governance/*`
    - `/api/dao-treasury/:daoId/*` → `/api/dao/:daoId/treasury/*`
    - `/api/disbursements/:daoId/*` → `/api/dao/:daoId/disbursements/*`
  - All redirects include deprecation headers with 90-day sunset notice

### 3. Route Path Updates Required
The following files need their route definitions updated to remove the `:daoId` prefix (handled by mount path):

#### A. `/server/routes/governance.ts`
**Routes to update** (10 total):
- ✓ `/:daoId/quorum` → `/quorum`
- ✓ `/:daoId/proposals/:proposalId/cancel` → `/proposals/:proposalId/cancel`
- `/:daoId/proposals/:proposalId/simulate` → `/proposals/:proposalId/simulate`
- `/:daoId/templates` → `/templates` (GET)
- `/:daoId/templates` → `/templates` (POST)
- `/:daoId/delegate` → `/delegate`
- `/:daoId/delegations` → `/delegations`
- `/:daoId/delegate/:delegationId` → `/delegate/:delegationId`

**Note**: Routes like `/proposals/:proposalId/execute` (without daoId) are already correctly formatted and don'tneed updates.

#### B. `/server/routes/dao_treasury.ts`
**Routes to update** (14 total):
- `/:daoId/balance` → `/balance`
- `/:daoId/transfer/native` → `/transfer/native`
- `/:daoId/transfer/token` → `/transfer/token`
- `/:daoId/automation/payout` → `/automation/payout`
- `/:daoId/snapshot` → `/snapshot`
- `/:daoId/report` → `/report`
- `/:daoId/analytics` → `/analytics`
- `/:daoId/limits` → `/limits`
- `/:daoId/multisig/propose` → `/multisig/propose`
- `/:daoId/multisig/:txId/sign` → `/multisig/:txId/sign`
- `/:daoId/multisig/:txId/execute` → `/multisig/:txId/execute`
- `/:daoId/multisig/pending` → `/multisig/pending`
- `/:daoId/budget` → `/budget`
- `/:daoId/audit` → `/audit`

#### C. `/server/routes/disbursements.ts`
**Routes to update** (2 total):
- `/:daoId/history` → `/history`
- `/:daoId/templates` → `/templates`

**Note**: Routes like `/create` (without daoId) don't need updates.

### 4. Security Middleware Integration
Each route file should be updated to:
1. Import security utilities: `import { sanitizeObject, detectSuspiciousInput } from '../middleware/security';`
2. Apply sanitization to request bodies
3. Add suspicious input detection logging

### 5. Example Migration (Already Updated in governance.ts)

**Before:**
```typescript
router.get('/:daoId/quorum', isAuthenticated, async (req, res) => {
  const { daoId } = req.params;
  // ...
});
```

**After:**
```typescript
router.get('/quorum', isAuthenticated, async (req, res) => {
  const { daoId } = req.params;  // Still works - daoId is in parent router params
  // ...
});
```

### 6. Backwards Compatibility
Old routes continue to work via 307 redirects:
- Response headers include:
  - `Deprecation: true`
  - `Sunset: <date 90 days in future>` (RFC 8594)
  - `X-Deprecated-Route: <suggested new path>`

### 7. Wildcard Route Collision Prevention
Moving routes from top-level routes to nested under `/api/dao/:daoId/...` prevents:
- Future top-level parameters from colliding with `/:identifier` patterns
- Confusion about which DAO a request targets
- Route matching ambiguities

### 8. Benefits Achieved
✓ **Security**: Input validation, sanitization, and suspicious pattern detection  
✓ **Architecture**: Consolidated DAO endpoints under single namespace  
✓ **Compatibility**: Seamless migration path with deprecation warnings  
✓ **Maintainability**: Clear hierarchy - `/api/dao/:daoId/[service]/[action]`  

### 9. Next Steps
- [ ] Update governance.ts remaining 8 routes
- [ ] Update dao_treasury.ts all 14 routes
- [ ] Update disbursements.ts both routes
- [ ] Add security middleware integration to route handlers
- [ ] Test backwards-compatible redirects
- [ ] Verify DAO scope validation works correctly
- [ ] Monitor deprecated endpoint usage
