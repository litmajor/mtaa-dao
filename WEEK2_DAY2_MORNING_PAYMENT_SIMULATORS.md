# Day 2 Morning: Payment Flow Simulators - Complete API Documentation

## Overview

The Payment Flow Simulator suite provides **BASIC depth** simulation for 5 core payment actions:

1. **Deposit** - Users fund their accounts
2. **Withdrawal** - Users cash out funds  
3. **P2P Transfer** - User-to-user direct payments
4. **Recurring Payment Setup** - Scheduled automatic payments
5. **Payment Settlement** - Resolving pending payment requests

Each simulator calculates fees, detects risks, and recommends reversibility windows - all before the actual action executes.

---

## Core Concept: Two-Step Execution Pattern

**Step 1: Simulate** → **Step 2: Execute & Reverse**

```
User clicks "Deposit $1,000"
         ↓
POST /api/simulation/payment-deposit {amount, currency, method}
         ↓
System returns simulation with:
  - beforeState (current balances)
  - afterState (after deposit)
  - fees, risks, warnings
  - reversibilityWindow (24h-365d)
         ↓
User reviews and clicks "Confirm"
         ↓
POST /api/payments/deposit {simulation, ...params}
         ↓
ReversibilityService creates action
  Status: PENDING_CONFIRMATION (requires approval if needed)
  Then: GRACE_PERIOD (24h-7d window)
         ↓
User can reverse via: POST /api/payments/reverse/{actionId}
  Until grace period expires, then EXECUTED & IRREVERSIBLE
```

---

## API Reference

### 1. Payment Deposit Simulation

**Endpoint:** `POST /api/simulation/payment-deposit`

Simulate depositing funds into the platform.

**Request Body:**
```json
{
  "amount": 10000,
  "currency": "USD",
  "paymentMethod": "bank_transfer",
  "exchangeRate": 1.0
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | ✓ | Deposit amount in source currency |
| currency | string | ✓ | USD, EUR, BTC, ETH, MTAA |
| paymentMethod | string | ✓ | bank_transfer, card, wallet |
| exchangeRate | number | - | MTAA per 1 unit of currency (default: 1.0) |

**Response Example:**
```json
{
  "simulation": {
    "status": "SUCCESS",
    "depth": "BASIC",
    "timestamp": 1707826800000,
    "executionTimeMs": 2,
    "beforeState": {
      "userBalance": 0,
      "platformFloat": 10000000,
      "pendingDeposits": 42,
      "totalAssets": 500000000
    },
    "afterState": {
      "userBalance": 9970,
      "platformFloat": 10009970,
      "pendingDeposits": 41,
      "totalAssets": 500009970
    },
    "delta": {
      "userBalanceDelta": 9970,
      "platformFloatDelta": 9970,
      "feesCollected": 30,
      "assetsIncrease": 9970
    },
    "riskLevel": "LOW",
    "riskFactors": [],
    "warnings": [],
    "errors": [],
    "reversibilityWindow": {
      "minGracePeriodHours": 24,
      "recommendedGracePeriodHours": 72,
      "maxGracePeriodDays": 365
    },
    "summary": "Deposit 10000 USD → 9970 MTAA (fee: 30 USD)",
    "impactedEntities": [
      {
        "type": "user_account",
        "id": "user-123",
        "impact": "+9970 MTAA"
      },
      {
        "type": "platform_treasury",
        "id": "treasury",
        "impact": "+9970 USD (working capital)"
      }
    ],
    "simulationData": {
      "grossAmount": 10000,
      "feeBp": 30,
      "fee": 30,
      "netDeposit": 9970,
      "currency": "USD",
      "exchangeRate": 1.0,
      "paymentMethod": "bank_transfer",
      "nativeAmount": 9970
    }
  },
  "nextStep": {
    "message": "Review simulation and confirm deposit",
    "endpoint": "POST /api/payments/deposit",
    "actionInitiation": {
      "actionType": "PAYMENT_DEPOSIT",
      "severity": "LOW",
      "reversibilityScope": {
        "initiatorCanReverse": true,
        "adminCanReverse": true,
        "governanceCanReverse": true
      },
      "gracePeriodHours": 72,
      "requiresApproval": false,
      "estimatedIrreversibleAt": "2026-02-16T08:00:00Z"
    }
  }
}
```

**Fee Schedule:**
- Bank Transfer: 0.3% (30 bps)
- Card: 2.0% (200 bps)
- Wallet: 0.5% (50 bps)

**Risk Factors:**
- `large-deposit`: Amount > $100K → triggers compliance review
- `high-card-load`: Card > $5K → longer clearing time

---

### 2. Payment Withdrawal Simulation

**Endpoint:** `POST /api/simulation/payment-withdrawal`

Simulate withdrawing funds from the platform.

**Request Body:**
```json
{
  "amount": 5000,
  "currency": "USD",
  "destination": "bank",
  "userBalance": 10000
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | ✓ | Amount to withdraw (in MTAA) |
| currency | string | ✓ | Target currency for withdrawal |
| destination | string | ✓ | bank, wallet, card |
| userBalance | number | ✓ | User's current MTAA balance |

**Response:** Similar structure to deposit, but with withdrawal-specific warnings

**Fee Schedule:**
- Bank: 1.0% (100 bps)
- Wallet: 0.75% (75 bps)
- Card: 1.5% (150 bps)

**Risk Factors:**
- `low-liquidity`: Platform liquid < $1M
- `large-withdrawal`: Amount > 50% of user balance
- `threshold-alert`: Bank withdrawal > $50K

**Grace Period:** 24h-30d (shorter than deposits since user received funds externally)

---

### 3. P2P Transfer Simulation  

**Endpoint:** `POST /api/simulation/payment-p2p`

Simulate direct user-to-user transfer.

**Request Body:**
```json
{
  "recipientId": "user-456",
  "amount": 1000,
  "memo": "Payment for consulting",
  "userBalance": 5000
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| recipientId | string | ✓ | Target user ID |
| amount | number | ✓ | Transfer amount in MTAA |
| memo | string | - | Optional payment note |
| userBalance | number | ✓ | Sender's current balance |

**Fee:** 0.1% (10 bps) - internal transfers are cheap

**Risk Factors:**
- `large-transfer`: Amount > 30% of balance
- `potential-securities`: Memo contains "loan", "investment", "raise", etc.

**Special Note on Securities:**
Transfers with memos suggesting unregistered securities activity trigger MEDIUM risk and admin approval requirement.

---

### 4. Recurring Payment Setup Simulation

**Endpoint:** `POST /api/simulation/recurring-payment-setup`

Simulate setting up automatic recurring payments.

**Request Body:**
```json
{
  "recipientId": "user-789",
  "amount": 100,
  "frequency": "monthly",
  "startDate": 1707913200000,
  "cycles": 12,
  "userBalance": 5000
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| recipientId | string | ✓ | Recipient user ID |
| amount | number | ✓ | Payment per cycle in MTAA |
| frequency | string | ✓ | weekly, biweekly, monthly, quarterly, annual |
| startDate | number | ✓ | Unix timestamp (must be future) |
| cycles | number | - | How many times to repeat (undefined = perpetual) |
| userBalance | number | ✓ | Current balance |

**Setup Fee:** 0.5% (50 bps) of payment amount - deducted immediately

**Example Projection:**
```json
{
  "paymentAmount": 100,
  "frequency": "monthly",
  "setupFee": 0.5,
  "cycles": 12,
  "projectedAnnualAmount": 1200,
  "projectedMonthlyBurden": 100
}
```

**Risk Factors:**
- `high-commitment`: Monthly burden > 50% of balance
- Perpetual payments (no cycle limit) require approval

**Special Note:**
Users can cancel recurring payments anytime within grace period, but past transactions still execute.

---

### 5. Payment Settlement Simulation

**Endpoint:** `POST /api/simulation/payment-settlement`

Simulate settling a pending payment request.

**Request Body:**
```json
{
  "requestId": "req-123",
  "senderId": "user-payee",
  "amount": 5000,
  "userBalance": 10000
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| requestId | string | ✓ | Payment request ID to settle |
| senderId | string | ✓ | User who requested payment (payee) |
| amount | number | ✓ | Settlement amount in MTAA |
| userBalance | number | ✓ | Payer's current balance |

**Fee:** 0.2% (20 bps) - lower fee for resolving disputes

**Grace Period:** 24h-7d (shortest window - settles obligation)

---

## Execution: From Simulation to Reversible Action

### Step 1: Call Simulation Endpoint

```bash
curl -X POST http://localhost:3000/api/simulation/payment-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "currency": "USD",
    "paymentMethod": "bank_transfer"
  }'
```

### Step 2: User Reviews Simulation

Frontend displays:
- **beforeState** vs **afterState** comparison
- **Fees** breakdown
- **Risks** and warnings
- **Grace Period** (when action becomes irreversible)
- **Reversibility** (who can reverse)

### Step 3: Call Execution Endpoint

User clicks "Confirm Deposit" → Frontend calls:

```bash
curl -X POST http://localhost:3000/api/payments/deposit \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "simulation": {...simulation from step 1...},
    "amount": 10000,
    "currency": "USD",
    "paymentMethod": "bank_transfer",
    "exchangeRate": 1.0
  }'
```

**Response:**
```json
{
  "success": true,
  "action": {
    "id": "action-abc123",
    "type": "PAYMENT_DEPOSIT",
    "status": "PENDING_CONFIRMATION"
  },
  "reversibility": {
    "gracePeriodDeadline": "2026-02-16T08:00:00Z",
    "hoursToReverse": 72,
    "percentRemaining": 100,
    "canReverse": true,
    "reverseEndpoint": "/api/payments/reverse/action-abc123"
  },
  "approvalRequired": false,
  "nextSteps": [
    "Deposit of 10000 USD (9970 MTAA) queued for processing",
    "You can reverse this deposit until 2026-02-16T08:00:00Z",
    "Deposit approved, processing immediately"
  ]
}
```

---

## Reversals: Undo Within Grace Period

### GET Pending Actions

```bash
curl http://localhost:3000/api/payments/pending-actions \
  -H "Authorization: Bearer {token}"
```

Returns:
```json
{
  "pendingActions": [
    {
      "id": "action-abc123",
      "type": "PAYMENT_DEPOSIT",
      "status": "GRACE_PERIOD",
      "description": "Deposit 10000 USD → 9970 MTAA",
      "hoursRemaining": 48,
      "percentRemaining": 67,
      "canReverse": true,
      "reverseEndpoint": "/api/payments/reverse/action-abc123"
    }
  ],
  "summary": {
    "total": 1,
    "reversible": 1,
    "soonToBeIrreversible": 0
  }
}
```

### POST Reverse Action

```bash
curl -X POST http://localhost:3000/api/payments/reverse/action-abc123 \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "USER_REQUESTED",
    "details": "Changed my mind"
  }'
```

Valid reasons:
- `USER_REQUESTED`
- `SENT_TO_WRONG_RECIPIENT`
- `DUPLICATE_PAYMENT`
- `INCORRECT_AMOUNT`

**Response:**
```json
{
  "success": true,
  "message": "Payment action action-abc123 has been reversed",
  "action": {
    "id": "action-abc123",
    "status": "REVERSED",
    "reversedAt": "2026-02-14T12:00:00Z"
  },
  "restoreInfo": {
    "originalAmount": 9970,
    "reversalFee": "0 MTAA (reversals are fee-free)",
    "refundTime": "1-2 business days for external withdrawals"
  }
}
```

---

## Summary: Fee Schedule

| Action | Fee | Notes |
|--------|-----|-------|
| **Deposit** - Bank | 0.3% | Lowest cost funding |
| **Deposit** - Card | 2.0% | Instant but expensive |
| **Deposit** - Wallet | 0.5% | Medium balance |
| **Withdrawal** - Bank | 1.0% | Standard cashing out |
| **Withdrawal** - Wallet | 0.75% | Crypto efficient |
| **Withdrawal** - Card | 1.5% | Higher overhead |
| **P2P Transfer** | 0.1% | Cheapest internal |
| **Recurring Setup** | 0.5% | One-time setup |
| **Settlement** | 0.2% | Dispute resolution |
| **Reversal** | 0% | Free to reverse |

---

## Grace Periods by Action Type

| Action | Min | Recommended | Max |
|--------|-----|-------------|-----|
| **Deposit** | 24h | 72h | 365d |
| **Withdrawal** | 24h | 48h | 30d |
| **P2P Transfer** | 24h | 48h | 90d |
| **Recurring Setup** | 24h | 48h | 365d |
| **Settlement** | 24h | 72h | 7d |

---

## Approval Requirements

### NO Approval Required:
- Deposits (LOW risk)
- P2P Transfers (LOW/MEDIUM risk)
- Settlements (LOW risk)

### APPROVAL REQUIRED:
- Withdrawals with HIGH risk flags
- Recurring payments > 50% of balance
- Perpetual recurring payments (no cycle limit)
- Transfers with securities-related memos

---

## Integration Example: Frontend Flow

```typescript
// 1. Simulate
const simulation = await fetch('/api/simulation/payment-deposit', {
  method: 'POST',
  body: JSON.stringify({
    amount: 10000,
    currency: 'USD',
    paymentMethod: 'bank_transfer'
  })
}).then(r => r.json());

// 2. Show user confirmation modal
showConfirmationModal({
  before: simulation.beforeState,
  after: simulation.afterState,
  fees: simulation.delta.feesCollected,
  risks: simulation.riskFactors,
  reversibilityDeadline: simulation.reversibilityWindow.recommendedGracePeriodHours
});

// 3. User confirms
if (userClicks('Confirm Deposit')) {
  const action = await fetch('/api/payments/deposit', {
    method: 'POST',
    body: JSON.stringify({
      simulation,
      amount: 10000,
      currency: 'USD',
      paymentMethod: 'bank_transfer'
    })
  }).then(r => r.json());

  // 4. Show success with reversal option
  showSuccess({
    actionId: action.action.id,
    deadline: action.reversibility.gracePeriodDeadline,
    hoursRemaining: action.reversibility.hoursToReverse,
    reverseUrl: action.reversibility.reverseEndpoint
  });

  // 5. User can reverse anytime before deadline
  if (userClicks('Undo Deposit')) {
    await fetch(`/api/payments/reverse/${actionId}`, {
      method: 'POST',
      body: JSON.stringify({
        reason: 'USER_REQUESTED'
      })
    });
  }
}
```

---

## Production Integration Checkpoints

- [ ] Simulators called before EVERY destructive action endpoint
- [ ] ReversibilityService created for each confirmed action
- [ ] Grace period deadline enforced at database level (timestamp check)
- [ ] Emergency stop circuit breaker integrated
- [ ] Approval workflows integrated for MEDIUM/HIGH risk
- [ ] Admin dashboard shows all pending reversible actions
- [ ] Automatic marking as IRREVERSIBLE when grace period expires
- [ ] All reversals logged to action_status_timeline table
- [ ] Audit trail complete (who, when, simulation data, decision)

