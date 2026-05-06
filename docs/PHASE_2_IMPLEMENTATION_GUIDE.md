---
title: "PHASE 2: TREASURY CONTROLS & RATE LIMITING - IMPLEMENTATION GUIDE"
status: "READY TO IMPLEMENT"
date: "2026-03-02"
---

# Phase 2: Treasury Controls & Rate Limiting Implementation

## Overview
Phase 2 hardens the treasury system against large-scale theft and improves access controls. This phase implements:

1. **Recipient Whitelisting** - Only allow transfers to pre-approved addresses
2. **Amount Limits** - Daily caps and single-transfer maximums
3. **Multisig Approval** - Large transfers require 2+ admin signatures
4. **Withdrawal Rate Limiting** - Prevent rapid-fire withdrawal attacks

---

## Configuration Summary

### Treasury Whitelist
- **Categories**: charity, payments, team, disbursements, other
- **Approval**: Admin must approve new recipients
- **Status**: Pending → Approved
- **Expiration**: Optional per-recipient expiration dates

### Amount Limits (Per DAO, Configurable)
| Limit | Default | Example |
|-------|---------|---------|
| Daily Cap | 10% of treasury | $100k treasury = $10k/day max |
| Single Transfer Max | 5% of treasury | $100k treasury = $5k/transfer max |
| Multisig Threshold | $10,000 USD | Transfers > $10k need multisig |

### Multisig Requirements
- **Threshold**: $10,000 USD (configurable per DAO)
- **Signatures**: 2 out of 3 admins/elders
- **Expiration**: 7 days (approval must be completed within a week)
- **Signers**: Only admin, elder, creator roles

### Rate Limiting (Deposits vs Withdrawals)
| Limit | Deposits | Withdrawals |
|-------|----------|-------------|
| Per 10 minutes | 5 | 1 |
| Per hour | 20 | 3 |
| Per 24 hours | 50 | 5 |

**Rationale**: Deposits build the treasury (encourage high frequency), withdrawals drain it (restrict carefully). Asymmetric limits protect the treasury while encouraging participation.

---

## Database Schema

### New Tables Required

#### `treasury_whitelist`
Tracks whitelisted recipient addresses and their approval status.

```sql
CREATE TABLE treasury_whitelist (
  id UUID PRIMARY KEY,
  dao_id UUID NOT NULL,
  wallet_address VARCHAR NOT NULL,
  recipient_name VARCHAR,
  category VARCHAR NOT NULL,
  requested_by VARCHAR NOT NULL,
  approved_by VARCHAR,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(dao_id, wallet_address)
);
```

#### `treasury_limits`
Configurable per-DAO transfer limits and policies.

```sql
CREATE TABLE treasury_limits (
  id UUID PRIMARY KEY,
  dao_id UUID UNIQUE NOT NULL,
  daily_cap_percentage DECIMAL(5,2) DEFAULT 10,
  single_transfer_max_percentage DECIMAL(5,2) DEFAULT 5,
  multisig_threshold_usd DECIMAL(18,2) DEFAULT 10000,
  multisig_required_signatures INT DEFAULT 2,
  whitelist_required BOOLEAN DEFAULT TRUE,
  approval_required BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `treasury_approvals`
Tracks pending multisig approvals for large transfers.

```sql
CREATE TABLE treasury_approvals (
  id UUID PRIMARY KEY,
  dao_id UUID NOT NULL,
  proposal_id UUID NOT NULL,
  transfer_amount DECIMAL(18,2) NOT NULL,
  recipient_address VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'pending',
  required_signatures INT NOT NULL,
  current_signatures INT DEFAULT 0,
  approvals JSONB DEFAULT '[]',
  rejections JSONB DEFAULT '[]',
  requested_by VARCHAR NOT NULL,
  requested_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(proposal_id) -- One approval per proposal
);
```

---

## Implementation Checklist

### Step 1: Database Setup ✓
- [ ] Run migrations to create the three tables (see PHASE_2_SCHEMA_ADDITIONS.ts)
- [ ] Create indices for performance
- [ ] Seed default treasury_limits for existing DAOs

### Step 2: Service Layer ✓
- [ ] Treasury Validation Service created (treasuryValidationService.ts)
  - [ ] `isRecipientWhitelisted()` - Check if address is approved
  - [ ] `validateTransferAmount()` - Verify amount vs limits
  - [ ] `requiresMultisig()` - Check if multisig needed
  - [ ] `requestWhitelistApproval()` - Request new recipient approval
  - [ ] `approveWhitelistEntry()` - Admin approval
  - [ ] `getTreasuryLimits()` - Fetch per-DAO limits
  - [ ] `updateTreasuryLimits()` - Admin can reconfigure

### Step 3: Proposal Execution Integration
- [ ] Update `proposalExecutionService.ts`:
  - [ ] Import `TreasuryValidationService`
  - [ ] In `executeTreasuryTransfer()`:
    - [ ] Call `validateTransferAmount()`
    - [ ] Call `isRecipientWhitelisted()`
    - [ ] Check `requiresMultisig()`
    - [ ] If multisig needed: Create treasury_approval record and wait
    - [ ] Log transaction with `logTreasuryTransaction()`

### Step 4: API Endpoints
- [ ] `POST /api/dao/:daoId/whitelist` - Request new recipient approval
- [ ] `POST /api/dao/:daoId/whitelist/:id/approve` - Approve recipient (admin only)
- [ ] `POST /api/dao/:daoId/whitelist/:id/reject` - Reject recipient (admin only)
- [ ] `GET /api/dao/:daoId/whitelist` - List whitelisted recipients
- [ ] `PUT /api/dao/:daoId/treasury-limits` - Update limits (admin only)
- [ ] `GET /api/dao/:daoId/treasury-limits` - Get current limits
- [ ] `POST /api/dao/:daoId/treasury-approvals/:id/sign` - Sign multisig approval
- [ ] `GET /api/dao/:daoId/treasury-approvals` - List pending approvals with their status

### Step 5: Rate Limiting
- [ ] Apply deposit rate limiter to vault endpoints (generous: 50/day, 20/hour, 5/10min)
- [ ] Apply withdrawal rate limiter to vault endpoints (conservative: 5/day, 3/hour, 1/10min)
- [ ] Test rate limiter behavior on both operations

### Step 6: Testing
- [ ] Unit tests for TreasuryValidationService
- [ ] Integration tests:
  - [ ] Whitelist validation (approved, pending, rejected)
  - [ ] Daily cap enforcement
  - [ ] Single transfer max enforcement
  - [ ] Multisig trigger (transfer > $10k)
  - [ ] Rate limit on withdrawals (5/day, 3/hour, 1/10min)
  - [ ] Deposits allowed without rate limiting
- [ ] E2E tests with frontend

---

## Code Examples

### Validating a Treasury Transfer

```typescript
// In proposalExecutionService.ts executeTreasuryTransfer()

const { recipient, amount, currency, description } = executionData;

// Check if recipient is whitelisted
const whitelist = await TreasuryValidationService.isRecipientWhitelisted(daoId, recipient);
if (!whitelist.approved) {
  throw new Error(`Recipient ${recipient} is not whitelisted. Admin approval required.`);
}

// Validate transfer amount against limits
const amountValidation = await TreasuryValidationService.validateTransferAmount(daoId, parseFloat(amount));
if (!amountValidation.valid) {
  throw new Error(amountValidation.reason);
}

// Check if multisig is required
const needsMultisig = await TreasuryValidationService.requiresMultisig(daoId, parseFloat(amount));
if (needsMultisig) {
  // Create pending multisig approval
  const requiredSigs = await TreasuryValidationService.getMultisigRequiredSignatures(daoId);
  const signers = await TreasuryValidationService.getAvailableSigners(daoId);
  
  // Insert into treasury_approvals table (PENDING)
  // Return error saying approval is needed
  throw new Error(
    `Transfer requires ${requiredSigs} out of ${signers.length} admin signatures. ` +
    `Approval pending from: ${signers.join(', ')}`
  );
}

// Execute transfer
// ...
```

### Admin Approving New Whitelist Entry

```typescript
// In whitelist endpoint

await TreasuryValidationService.requestWhitelistApproval(
  daoId,
  '0x742d35Cc6634C0532925a3b844Bc9e7595f42e1f',
  'Charity Fund',
  'charity',
  currentUserId
);

// Later, admin approves:
await TreasuryValidationService.approveWhitelistEntry(
  entryId,
  adminUserId,
  daoId
);
```

### Updating DAO Treasury Limits

```typescript
// In treasury settings endpoint (admin only)

await TreasuryValidationService.updateTreasuryLimits(daoId, {
  dailyCapPercentage: 15, // Raise to 15%
  singleTransferMaxPercentage: 10, // Raise to 10%
  multisigThreshold: 50000, // Raise to $50k
});
```

---

## Security Notes

### Fail-Safe Defaults
- If limit check fails: DENY the transfer (fail secure)
- If whitelist check fails: DENY the transfer (unless no whitelist configured)
- If multisig check fails: REQUIRE multisig (conservative)
- If rate limit fails: DENY the withdrawal

### Audit Trail
Every treasury action is logged:
```
[AUDIT] Treasury transfer: $5000 to 0x742d... by user123 (approved) in DAO xyz
[AUDIT] Whitelist approval requested for 0x742d... by user123
[AUDIT] Whitelist approved by admin456
[AUDIT] Multisig approval pending: 2 of 3 signatures
```

### Replay Attack Prevention
- Each treasury_approval has: requestedAt, expiresAt (7 days)
- Each signature includes: userId, timestamp, signature hash
- Cannot reuse same signature twice

### Role-based Access
- **View whitelist**: DAO members
- **Request whitelist approval**: DAO members with member+ role
- **Approve whitelist**: Only admin/elder/creator roles
- **Update limits**: Only DAO creator/admin
- **Sign multisig**: Only admin/elder/creator

---

## Deployment Steps

### 1. Pre-Deployment
```bash
# Run migrations
npm run migrate

# Run tests
npm run test:treasury
npm run test:e2e:treasury
```

### 2. Deployment
```bash
# Deploy to staging first
npm run deploy:staging

# Test whitelist, limits, rate limiting on staging

# Deploy to production
npm run deploy:production
```

### 3. Post-Deployment
- [ ] Monitor logs for treasury transactions
- [ ] Verify rate limiting is working
- [ ] Test multisig approval workflow
- [ ] Send DAO admins instructions for configuring limits

---

## Next Steps (Phase 3)

After Phase 2 is complete, Phase 3 will add:
- Smart contract multisig (2-of-3 on-chain signatures)
- Voting snapshots with block numbers
- Voting delays (7-day cool-off)
- Flash loan protection
- External smart contract audit

---

## File References

| File | Purpose |
|------|---------|
| [treasuryValidationService.ts](server/services/treasuryValidationService.ts) | Core treasury validation logic |
| [PHASE_2_SCHEMA_ADDITIONS.ts](PHASE_2_SCHEMA_ADDITIONS.ts) | Database schema and migrations |
| [capitalFlowRateLimits.ts](server/middleware/capitalFlowRateLimits.ts) | Deposit & withdrawal rate limiting configuration |
| [proposalExecutionService.ts](server/proposalExecutionService.ts) | Integration point (to be updated) |

---

## Questions?

- **Whitelist categories**: Should we add more? (e.g., 'emergency', 'research')
- **Rate limit override**: Should premium DAOs get higher limits?
- **Multisig voting**: Should there be a voting timeout (e.g., must approve within 24h)?
- **Daily cap reset**: Midnight UTC or per-DAO timezone?
