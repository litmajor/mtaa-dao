# WEEK2 DAY2 MORNING: PAYMENT SIMULATORS - QUICK REFERENCE

## 5 Payment Simulators at a Glance

### 1️⃣ **Deposit Simulator**
**Endpoint:** `POST /api/simulation/payment-deposit`

```json
{
  "amount": 10000,
  "currency": "USD",
  "paymentMethod": "bank_transfer"
}
```

| Property | Value |
|----------|-------|
| **Fee** | 0.3% (bank), 2% (card), 0.5% (wallet) |
| **Grace Period** | 24h-365d (HIGHEST - fully reversible) |
| **Approval Required** | NO |
| **Risk Factors** | large-deposit (>$100K), high-card-load |

**Execution:** `POST /api/payments/deposit` with simulation result

---

### 2️⃣ **Withdrawal Simulator**
**Endpoint:** `POST /api/simulation/payment-withdrawal`

```json
{
  "amount": 5000,
  "currency": "USD",
  "destination": "bank",
  "userBalance": 10000
}
```

| Property | Value |
|----------|-------|
| **Fee** | 1% (bank), 0.75% (wallet), 1.5% (card) |
| **Grace Period** | 24h-30d (shorter - external withdrawal) |
| **Approval Required** | YES if HIGH risk flags |
| **Risk Factors** | low-liquidity, large-withdrawal (>50%), threshold-alert (>$50K) |

**Execution:** `POST /api/payments/withdraw` with simulation result

---

### 3️⃣ **P2P Transfer Simulator**
**Endpoint:** `POST /api/simulation/payment-p2p`

```json
{
  "recipientId": "user-456",
  "amount": 1000,
  "memo": "Payment",
  "userBalance": 5000
}
```

| Property | Value |
|----------|-------|
| **Fee** | 0.1% (cheapest - internal) |
| **Grace Period** | 24h-90d (high reversibility) |
| **Approval Required** | YES if securities memo detected |
| **Risk Factors** | large-transfer (>30%), potential-securities |

**Execution:** `POST /api/payments/transfer-p2p` with simulation result

---

### 4️⃣ **Recurring Payment Setup Simulator**
**Endpoint:** `POST /api/simulation/recurring-payment-setup`

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

| Property | Value |
|----------|-------|
| **Fee** | 0.5% setup (one-time) |
| **Grace Period** | 24h-365d (can cancel anytime) |
| **Approval Required** | YES if perpetual OR high burden |
| **Risk Factors** | high-commitment (>50% monthly) |

**Execution:** `POST /api/payments/setup-recurring` with simulation result

---

### 5️⃣ **Settlement Simulator**
**Endpoint:** `POST /api/simulation/payment-settlement`

```json
{
  "requestId": "req-123",
  "senderId": "user-payee",
  "amount": 5000,
  "userBalance": 10000
}
```

| Property | Value |
|----------|-------|
| **Fee** | 0.2% (dispute resolution) |
| **Grace Period** | 24h-7d (SHORTEST) |
| **Approval Required** | NO |
| **Risk Factors** | None by default |

**Execution:** `POST /api/payments/settle` with simulation result

---

## Common Flow: Simulate → Execute → Reverse

```bash
# Step 1: Simulate
$ curl -X POST /api/simulation/payment-deposit \
    -d '{"amount":10000,"currency":"USD","paymentMethod":"bank_transfer"}'

# Response includes:
# - beforeState / afterState comparison
# - fees breakdown
# - risk factors
# - reversibility window (gracePeriodHours)

# Step 2: User reviews → clicks "Confirm"

# Step 3: Execute with simulation
$ curl -X POST /api/payments/deposit \
    -d '{
      "simulation": {...from step 1...},
      "amount": 10000,
      "currency": "USD",
      "paymentMethod": "bank_transfer"
    }'

# Response includes:
# - action.id
# - gracePeriodDeadline
# - hoursToReverse
# - reverseEndpoint

# Step 4 (Optional): Reverse before deadline
$ curl -X POST /api/payments/reverse/{actionId} \
    -d '{"reason":"USER_REQUESTED"}'
```

---

## Risk Levels & Approval Requirements

| Risk Level | Approval | Grace Period | Actions |
|-----------|----------|--------------|---------|
| **LOW** | ❌ None | Longer (72h-365d) | Deposits, P2P, Settlement |
| **MEDIUM** | ⚠️ Admin review | Standard (48-72h) | Large withdrawals, secure memo transfers, high-burden recurring |
| **HIGH** | 🔐 Admin + Board | Shorter (24h-48h) | Very large withdrawals, securities hints |
| **CRITICAL** | 🔒 Governance vote | Minimal (24h) | Platform-impacting actions |

---

## Fee Comparison Chart

```
Deposit:      Bank 0.3% < Wallet 0.5% < Card 2.0%
Withdrawal:   Wallet 0.75% < Bank 1.0% < Card 1.5%
P2P:          All channels 0.1% (cheapest)
Recurring:    Setup fee 0.5% (one-time)
Settlement:   All 0.2% (mid-range)
Reversal:     All 0% (free to undo)
```

---

## Simulation Output Checklist

Every simulator returns these fields:

```
✓ status: "SUCCESS"|"WARNING"|"ERROR"
✓ depth: "BASIC"|"INTERMEDIATE"|"ADVANCED"
✓ beforeState: {current platform state}
✓ afterState: {after action state}
✓ delta: {changes}
✓ riskLevel: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"
✓ riskFactors: ["factor-1", "factor-2", ...]
✓ warnings: ["warning-1", "warning-2", ...]
✓ errors: ["error-1"] (if status = ERROR)
✓ reversibilityWindow: {min, recommended, max hours/days}
✓ summary: "Human readable description"
✓ impactedEntities: [{type, id, impact}]
✓ simulationData: {action-specific data}
```

---

## Debugging: Common Issues

**Issue: "Simulation data required"**
- Ensure you called `/api/simulation/X` first
- Pass the entire `simulation` object to `/api/payments/X`

**Issue: "Cannot execute failed simulation"**
- The simulation returned `status: "ERROR"` or `status: "WARNING"`
- Fix the input and re-simulate

**Issue: "Grace period expired"**
- You waited too long to reverse
- Cannot reverse after `gracePeriodDeadline`

**Issue: "Insufficient balance"**
- User's balance is less than the action amount
- Request current balance and re-simulate

---

## Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `simulationFramework.ts` | 113 | Base class + interfaces for all simulators |
| `paymentFlowSimulator.ts` | 1,800 | 5 simulator implementations (Deposit, Withdrawal, P2P, Recurring, Settlement) |
| `paymentFlowSimulator.test.ts` | 900 | Jest test suite (29 tests) |
| `simulationPaymentRoutes.ts` | 600 | Simulation endpoints + discovery |
| `paymentExecutionService.ts` | 850 | Execution orchestration + ReversibilityService integration |
| `paymentExecutionRoutes.ts` | 950 | Execution endpoints + reversals |
| `WEEK2_DAY2_MORNING_PAYMENT_SIMULATORS.md` | 2,000 | Full API documentation |

**Total: 7,213 lines of production code, tests, and documentation**

---

## One-Liner API Cheat Sheet

```bash
# Simulate a deposit
curl POST /api/simulation/payment-deposit -d '{"amount":1000,"currency":"USD","paymentMethod":"bank_transfer"}'

# Simulate a withdrawal  
curl POST /api/simulation/payment-withdrawal -d '{"amount":500,"currency":"USD","destination":"bank","userBalance":2000}'

# Simulate P2P transfer
curl POST /api/simulation/payment-p2p -d '{"recipientId":"user2","amount":100,"userBalance":500}'

# Simulate recurring setup
curl POST /api/simulation/recurring-payment-setup -d '{"recipientId":"user2","amount":50,"frequency":"monthly","startDate":1707913200000,"userBalance":5000}'

# Simulate settlement
curl POST /api/simulation/payment-settlement -d '{"requestId":"req1","senderId":"user2","amount":100,"userBalance":1000}'

# Execute deposit (after simulation)
curl POST /api/payments/deposit -d '{"simulation":{...},"amount":1000,"currency":"USD","paymentMethod":"bank_transfer"}'

# Get pending reversible actions
curl GET /api/payments/pending-actions

# Reverse an action
curl POST /api/payments/reverse/{actionId} -d '{"reason":"USER_REQUESTED"}'
```

---

## Integration Checklist for Frontend

- [ ] Call `/api/simulation/payment-{action}` when user initiates action
- [ ] Display `simulation.beforeState` vs `simulation.afterState` in modal
- [ ] Show `simulation.delta.feesCollected`
- [ ] List `simulation.warnings` and `simulation.riskFactors`
- [ ] Display countdown to `gracePeriodDeadline`
- [ ] Show `reversibilityWindow.recommendedGracePeriodHours`
- [ ] Call `/api/payments/{action}` on user confirmation
- [ ] Store returned `action.id`
- [ ] Show `reverseEndpoint` if `canReverse: true`
- [ ] Display pending actions from `/api/payments/pending-actions`
- [ ] Call `/api/payments/reverse/{actionId}` on user reversal request

---

## Integration Checklist for Admin Dashboard

- [ ] Monitor `/api/payments/pending-actions` for all users
- [ ] Show approval queue (actions with `requiresApproval: true`)
- [ ] Display time remaining before grace period expires
- [ ] Emergency reversal capability (override user permissions if needed)
- [ ] View audit trail of all reversals
- [ ] Emergency stop triggers (circuit breaker dashboard)
- [ ] Settlement statistics and trending

---

## What's Next

**Day 2 Afternoon (4h):** Trading & DEX Simulators (5 simulators, INTERMEDIATE depth)
- DEX Swap simulation with slippage & volatility
- CEX Order simulation with order book depth
- Smart Router simulation with route optimization
- Limit Order simulation with fill probability
- Yield Farming simulation with APY forecasting

**Day 3 Morning (4h):** Governance Simulators (5 simulators, ADVANCED depth)
- Governance proposal execution with voter dilution
- Treasury withdrawal with burn rate forecasting
- Investment execution with capital impact
- Advanced Monte Carlo voting simulations

**Day 3 Afternoon (4h):** Investment & Staking (8 simulators)
- Pool investment, withdrawal, rebalancing
- Strategy deployment with backtests
- Bot deployment with circuit breaker
- Staking, unstaking, governance voting

---

**Status: ✅ Day 2 Morning COMPLETE**

7,213 lines of code + tests + docs delivered in single session.

5/62 destructive actions now reversible with simulation preview.

57 more actions to be simulated in Days 2 Afternoon through Day 5.

