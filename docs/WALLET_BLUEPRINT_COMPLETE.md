# Wallet & Micro-Withdrawals Architecture - Complete Blueprint

## Executive Summary

You're building a **comprehensive financial management system** for MTAA DAO that:

1. **Multi-account model** (Wallet, Trading, Vault, Escrow) - Organized money management
2. **Flexible deposits** (Off-ramp fiat + External crypto) - Multiple funding paths  
3. **Smart withdrawals** (4 destinations + micro-batching) - User choice + efficiency
4. **Micro-withdrawals** (integrated as withdrawal option) - Solves < $10 problem
5. **Complete history** - Full financial transparency

---

## Architecture at a Glance

### Account Hierarchy
```
USER
├─ PRIMARY WALLET ($425)        ← Hub account, receives deposits
├─ TRADING ACCOUNT ($1,250)     ← Active positions, leverage
├─ VAULT ACCOUNT ($5,430)       ← Locked savings, earning yields
├─ ESCROW ACCOUNT ($0)          ← Deal funds, milestone-locked
└─ TOTAL NET WORTH ($7,105)
```

### Money Flows

**DEPOSIT** (Getting money in):
```
Fiat (USD) ──→ Off-Ramp (Stripe/Kotanipay/M-Pesa) ──→ PRIMARY WALLET
Crypto     ──→ External Wallet Transfer           ──→ PRIMARY WALLET
```

**WITHDRAW** (Getting money out):
```
FROM account (Wallet/Trading/Vault/Escrow)
├─ TO: Off-Ramp       → Get fiat (USD/KES/etc)
├─ TO: External       → Send to external address
├─ TO: Micro-Batch    → Smart batching (< $10)
└─ TO: Internal       → Move to another account
```

**INTERNAL TRANSFER** (Moving between own accounts):
```
Wallet ↔ Trading (prepare to trade)
Wallet ↔ Vault (save money)
Trading ↔ Vault (lock gains)
Any ↔ Escrow (fund deals)
```

---

## Where Micro-Withdrawals Fit

### NOT a separate system
### It IS one option in the withdraw flow

**User decision tree**:
```
"I want to withdraw"
         ↓
"How much?"
├─ If < $10  → "Use Micro-Withdrawal (save gas!)"
└─ If ≥ $10  → "Choose: Off-Ramp, External, or Internal"
```

**When user chooses Micro-Withdrawal**:
1. Amount validated: $0.50 - $10.00 ✓
2. Request submitted to batch system
3. Waits for batch trigger (50 requests OR $100 OR 24 hours)
4. Batch processes: gas split among users
5. User notified with TX hash

---

## Database Schema (7 Tables)

### 1. accounts
```
id (UUID)
userId (FK to users)
accountType (wallet/trading/vault/escrow)
balance (DECIMAL)
currency (USDC/USDT/cUSD/ETH)
status (active/locked)
```
Purpose: Core account management

### 2. deposits
```
id (UUID)
userId (FK)
toAccountId (FK to accounts)
source (offramp_stripe/offramp_kotanipay/offramp_mpesa/external_wallet)
amount, feeAmount, currency
status (pending/completed/failed)
transactionHash, externalReference
```
Purpose: Track all incoming money

### 3. withdrawals
```
id (UUID)
userId (FK)
fromAccountId (FK to accounts)
destination (offramp/external/micro_withdrawal/internal_transfer)
destinationAddress (wallet address or reference)
amount, feeAmount, currency
status (pending/processing/completed/failed)
transactionHash
```
Purpose: Track all outgoing money

### 4. internalTransfers
```
id (UUID)
userId (FK)
fromAccountId (FK to accounts)
toAccountId (FK to accounts)
amount, currency
reason (trading/savings/profit_lock/rebalance)
```
Purpose: Track user's account-to-account moves

### 5. microWithdrawals
```
id (UUID)
userId (FK)
amount ($0.50-$10.00)
currency
toAddress (0x...)
status (pending/batched/processed/failed/cancelled)
batchId (FK to microWithdrawalBatches)
```
Purpose: Individual micro-withdrawal requests
*Already designed in MICRO_WITHDRAWALS_SCHEMA.md*

### 6. microWithdrawalBatches
```
id (UUID)
requestIds (array)
totalAmount, currency
status (pending/processing/processed/failed)
transactionHash
triggeredBy (count/amount/time/manual)
```
Purpose: Consolidated batches
*Already designed in MICRO_WITHDRAWALS_SCHEMA.md*

### 7. users (existing)
All tables FK to this

---

## API Endpoints (30+ total)

### Account Management
```
GET  /api/accounts                Get all user's accounts
GET  /api/accounts/:accountId     Get specific account
GET  /api/accounts/net-worth      Total user net worth
```

### Deposits
```
GET    /api/deposits/methods                Get deposit methods
POST   /api/deposits/offramp                Start off-ramp deposit
GET    /api/deposits/wallet-address        Show receiving address
POST   /api/deposits/webhook                Provider webhooks
GET    /api/deposits/status/:id            Check status
GET    /api/deposits/history               Deposit history
```

### Withdrawals
```
GET    /api/withdrawals/methods            List withdraw options
GET    /api/withdrawals/preview            Preview fees
POST   /api/withdrawals/offramp            Start off-ramp
POST   /api/withdrawals/external           Send to external
POST   /api/withdrawals/internal           Move between accounts
POST   /api/withdrawals/micro              Create micro-withdrawal
GET    /api/withdrawals/status/:id         Check status
POST   /api/withdrawals/cancel/:id         Cancel pending
GET    /api/withdrawals/history            Withdraw history
```

### Micro-Withdrawals (Sub-section)
```
POST   /api/withdrawals/micro/request      Request withdrawal
GET    /api/withdrawals/micro/pending      Pending requests
POST   /api/withdrawals/micro/cancel       Cancel request
GET    /api/withdrawals/micro/batch/:id    Batch details
GET    /api/withdrawals/micro/stats        System stats
```

### Internal Transfers
```
POST   /api/transfers                      Create transfer
GET    /api/transfers/history              Transfer history
```

### Transactions (Combined View)
```
GET    /api/transactions                   All deposits + withdraws + transfers
GET    /api/transactions/history           Filtered history
```

---

## UI Components (12+ new)

### Dashboard Page
```
WalletDashboard (main container)
├─ WalletBalanceOverview (card grid: 5 accounts + total)
└─ Tabs:
   ├─ DepositPage
   ├─ WithdrawPage
   ├─ TransferPage
   ├─ TransactionHistory
   └─ AccountManagement
```

### Deposit Components
```
DepositPage
├─ DepositMethodSelector
├─ OffRampDepositForm (Stripe/Kotanipay/M-Pesa)
├─ ExternalWalletDepositForm
└─ DepositHistory
```

### Withdraw Components
```
WithdrawPage
├─ WithdrawSourceSelector (which account?)
├─ WithdrawDestinationSelector (where to?)
├─ WithdrawForm
│  ├─ OffRampWithdraw
│  ├─ ExternalWalletWithdraw
│  ├─ MicroWithdrawalRequest (< $10)
│  └─ InternalTransferForm
└─ WithdrawHistory
```

### Transfer Components
```
TransferPage
├─ TransferForm
│  ├─ FromAccountSelector
│  ├─ ToAccountSelector
│  └─ ReasonSelector
└─ TransferHistory
```

### Shared Components
```
WalletBalanceCard (single account)
FeePreview (shows costs)
TransactionHistory (combined view)
AccountManagement (account settings)
```

---

## Service Layer (4 new services)

### account-service.ts
```typescript
getAccountsForUser(userId)
getAccountBalance(userId, accountType)
getNetWorth(userId)
createAccountsForNewUser(userId)
transferBetweenAccounts(fromId, toId, amount)
lockAccount(accountId)
unlockAccount(accountId)
```

### deposit-service.ts
```typescript
initiateOffRampDeposit(userId, method, amount)
completeOffRampDeposit(depositId, transactionHash)
processExternalWalletDeposit(toAddress, amount, txHash)
getDepositHistory(userId)
getReceivingWalletAddress()
```

### withdrawal-service.ts
```typescript
initiateOffRampWithdraw(userId, accountId, amount, method)
initiateExternalWithdraw(userId, accountId, address, amount)
initiateInternalTransfer(userId, fromAcct, toAcct, amount)
initiateMicroWithdraw(userId, accountId, amount, address)
getWithdrawalHistory(userId)
getAvailableBalance(userId, accountId)
estimateFees(destination, amount, currency)
cancelWithdrawal(withdrawalId)
```

### transfer-service.ts
```typescript
transferBetweenAccounts(userId, fromId, toId, amount, reason)
getTransferHistory(userId)
validateTransferEligibility(fromId, toId)
```

---

## Integration Points

### With Existing Systems

**Off-Ramp Providers**:
- Stripe (deposits + withdrawals)
- Kotanipay (deposits + withdrawals)
- M-Pesa (deposits + withdrawals)

**Notification System**:
- Deposit completed
- Withdrawal initiated/completed
- Batch processed
- Transfer completed
- Failed transaction

**Micro-Withdrawals** (already built):
- Already has: requestMicroWithdrawal(), processBatch(), cancelMicroWithdrawal()
- Just needs: Link to withdrawal service, show in UI

**Escrow System** (existing):
- Link escrow balance to escrow account
- Allow withdrawal from escrow when released

**Profile/Dashboard** (existing):
- Add Wallet tab
- Show balances on profile

---

## Fee Structure

### Deposits
```
Off-Ramp (Fiat → Crypto):  2-3% (payment processor fee)
External (Crypto → Crypto): 0% (DAO covers blockchain gas)
```

### Withdrawals
```
Off-Ramp (Crypto → Fiat):    2-3% (payment processor)
External (Crypto → Wallet):  User pays blockchain gas
Micro-Withdrawal:             ~$0.60-$1 (shared among 50 users)
Internal Transfer:            0% (instant, no fees)
```

### Savings from Micro-Withdrawals
```
Direct withdrawal of $7:      Pay $5-10 in gas → Net $0-2 received
Batched withdrawal of $7:     Pay $0.60 in gas → Net $6.40 received
Savings: 85-90% ✓
```

---

## Implementation Phases

### Phase 1: Foundation (4h) 🎯
- [ ] Create accounts table
- [ ] Create account-service
- [ ] Create account routes
- [ ] Migrate existing balances

### Phase 2: Deposits (6h)
- [ ] Create deposits table
- [ ] Create deposit-service
- [ ] Create deposit routes
- [ ] Integrate off-ramp providers
- [ ] Add webhooks

### Phase 3: Withdrawals (6h)
- [ ] Create withdrawals table
- [ ] Create withdrawal-service
- [ ] Create withdrawal routes
- [ ] Integrate off-ramp for withdrawals

### Phase 4: Internal Transfers (3h)
- [ ] Create internalTransfers table
- [ ] Create transfer-service
- [ ] Create transfer routes

### Phase 5: Dashboard UI (4h)
- [ ] WalletDashboard main page
- [ ] WalletBalanceOverview
- [ ] Tab layout
- [ ] Transaction history

### Phase 6: Deposit UI (6h)
- [ ] DepositPage components
- [ ] OffRampDepositForm
- [ ] ExternalWalletDepositForm
- [ ] DepositHistory

### Phase 7: Withdraw UI (8h)
- [ ] WithdrawPage components
- [ ] Source/destination selectors
- [ ] Fee preview
- [ ] WithdrawForm variants

### Phase 8: Transfer UI (4h)
- [ ] TransferPage
- [ ] TransferForm
- [ ] TransferHistory

### Phase 9: Micro-Withdrawals Integration (3h)
- [ ] Link withdrawal-service to micro-withdrawal-service
- [ ] Add micro-withdrawal option to WithdrawForm
- [ ] Show batch status
- [ ] Display pending micro-withdrawals

### Phase 10: Admin & Polish (4h)
- [ ] Admin stats dashboard
- [ ] Transaction search/filter
- [ ] Error handling refinement
- [ ] Performance optimization

**Total**: ~48 hours

---

## Success Metrics

| Metric | Target | When |
|--------|--------|------|
| Deposits working | ✓ | After Phase 2 |
| Withdrawals working | ✓ | After Phase 3 |
| Full UI operational | ✓ | After Phase 8 |
| Micro-withdrawals integrated | ✓ | After Phase 9 |
| Avg. user transaction time | < 2min | After Phase 10 |
| Micro-withdrawal savings | 80%+ | After Phase 9 |
| System uptime | 99.9% | After deployment |

---

## Risk Mitigation

### Financial Risks
- [ ] Audit all money movement logic
- [ ] Test with test money first (staging)
- [ ] Reconciliation process for failed transactions
- [ ] Backup/restore procedures

### Security Risks
- [ ] Rate limit on withdrawals
- [ ] Daily withdrawal limits
- [ ] 2FA for large transactions
- [ ] Whitelist addresses for external transfers

### UX Risks
- [ ] Clear fee preview before confirming
- [ ] Confirmation steps for large amounts
- [ ] Undo/cancel options where possible
- [ ] Error messages are helpful
- [ ] Loading states during processing

---

## Files Delivered

### Architecture Documentation
- ✅ WALLET_ARCHITECTURE_COMPLETE.md (5,000+ words)
- ✅ WALLET_FLOW_DIAGRAMS.md (visual flows)
- ✅ WALLET_IMPLEMENTATION_ROADMAP.md (detailed phases)

### Existing Micro-Withdrawals Code
- ✅ server/services/micro-withdrawal-service.ts (340 lines)
- ✅ server/routes/micro-withdrawals.ts (250 lines)
- ✅ client/src/components/MicroWithdrawalWidget.tsx (250 lines)
- ✅ Multiple documentation files

### Ready for Implementation
- 🎯 Database schema designed
- 🎯 Service layer planned
- 🎯 API routes designed
- 🎯 UI components specified
- 🎯 Integration points identified

---

## Key Design Decisions

### ✅ Multi-Account Model
**Why**: 
- Clarity: User knows where money is
- Risk management: Vault stays locked while trading continues
- Automation: Different rules per account
- Tax tracking: Easier for reporting

### ✅ Micro-Withdrawals as Withdraw Option
**Why**:
- Integrated, not separate
- User sees it as one choice
- Automatic smart routing for small amounts
- 80-90% gas savings

### ✅ Flexible Deposit Sources
**Why**:
- Users can fund however they want
- Multiple fiat on-ramps (Stripe/Kotanipay/M-Pesa)
- External wallet option for existing crypto holders
- Low friction = high adoption

### ✅ Internal Transfer System
**Why**:
- Users manage their own money
- Zero fees between own accounts
- Fast (instant)
- Enables sophisticated money management

### ✅ Fee Transparency
**Why**:
- Preview all fees before confirming
- Build user trust
- Helps users make informed decisions
- Differentiates from competitors

---

## Next Steps

1. **Review Architecture** ← You are here
   - [ ] Approve account model?
   - [ ] Approve deposit/withdraw flows?
   - [ ] Approve integration with micro-withdrawals?

2. **Implement Phase 1** (Foundation)
   - Create accounts table
   - Create account-service
   - Create account routes

3. **Implement Phase 2** (Deposits)
   - Create deposits table
   - Connect to off-ramp providers

4. **Continue through Phase 10** (Full implementation)

5. **Test thoroughly** (staging environment)

6. **Deploy to production**

---

## Questions to Confirm

1. ✅ Should micro-withdrawals be option in withdraw flow? (YES - integrated)
2. ✅ Should separate accounts exist? (YES - Wallet/Trading/Vault/Escrow)
3. ✅ What are fee splits? (Off-ramp: 2-3%, Direct: gas, Micro: shared)
4. ✅ Which off-ramp providers? (Stripe, Kotanipay, M-Pesa - all exist)
5. ✅ Internal transfer limits? (None suggested - let user manage)
6. ✅ Account lock periods? (Only vault if configured)
7. ✅ Withdrawal limits? (Suggest daily limits for security)
8. ✅ 2FA for large transactions? (YES - recommend)

---

**Status**: Architecture Complete ✅
**Phase**: Ready for Implementation 🚀
**Timeline**: ~48 hours to full deployment
**Complexity**: MEDIUM - Well organized, clear phases
**Risk**: LOW - Using existing patterns, tested components

Ready to start Phase 1?

