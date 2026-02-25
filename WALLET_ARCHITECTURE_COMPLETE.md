# Deposit/Withdraw Architecture & Account Structure

## Current Problem
- Micro-withdrawals exist but no clear deposit flow
- No account segmentation thinking
- No clarity on where money comes from/goes to
- Dashboard lacks proper financial views

## Proposed Architecture

### Account Types (Multi-Account Model)

```
User Account Structure:
├── PRIMARY WALLET ACCOUNT
│   ├── Receives: Off-ramp deposits, local transfers
│   ├── Balance: Available for withdrawal/trading
│   └── Use: General purpose, liquidity
│
├── TRADING ACCOUNT
│   ├── Receives: Transfers from wallet/vault
│   ├── Balance: Active trading positions
│   └── Use: CEX trading, swaps, arbitrage
│
├── VAULT ACCOUNT
│   ├── Receives: Intentional savings/investments
│   ├── Balance: Locked or time-locked assets
│   └── Use: Strategy execution, yield generation
│
├── ESCROW ACCOUNT
│   ├── Receives: Locked funds for deals
│   ├── Balance: Milestone-based releases
│   └── Use: P2P transactions, bounties
│
└── MICRO-WITHDRAWALS STAGING
    ├── Receives: Multiple < $10 requests
    ├── Balance: Pending batch processing
    └── Use: Efficient gas-saving withdrawals
```

### Deposit Flow (3 Sources)

```
DEPOSIT SOURCES → ROUTING → ACCOUNTS

Source 1: OFF-RAMP/FIAT
├─ User requests fiat withdrawal
├─ KYC/AML check
├─ Fiat → Stablecoin conversion
└─ Deposit to PRIMARY WALLET ACCOUNT
   (User now has USDC/USDT to trade/withdraw)

Source 2: EXTERNAL WALLET TRANSFER
├─ User sends crypto from CEX/personal wallet
├─ Receives at DAO contract address
├─ System detects & credits account
└─ Deposit to PRIMARY WALLET ACCOUNT
   (Ready to use immediately)

Source 3: INTERNAL TRANSFER
├─ User moves between own accounts
├─ Wallet → Vault (savings)
├─ Wallet → Trading (active)
├─ Trading → Vault (lock profits)
└─ Account-to-account movement logged
```

### Withdraw Flow (Multiple Destinations)

```
WITHDRAW SOURCES → ROUTING → DESTINATIONS

Source 1: PRIMARY WALLET
├─ Option A: To OFF-RAMP (fiat conversion)
├─ Option B: To EXTERNAL WALLET (external address)
├─ Option C: Micro-withdrawal (< $10, batched)
└─ Option D: To another account (internal)

Source 2: VAULT ACCOUNT
├─ Option A: To PRIMARY WALLET (harvest profits)
├─ Option B: To OFF-RAMP (exit completely)
├─ Option C: Lock period check first
└─ Use case: "Take profits"

Source 3: ESCROW ACCOUNT
├─ Option A: To PRIMARY WALLET (after milestone release)
├─ Option B: Partial release check
└─ Use case: "Claim completed deal"

Source 4: TRADING ACCOUNT
├─ Option A: To PRIMARY WALLET (secure profits)
├─ Option B: To VAULT (lock gains)
└─ Use case: "Close position and save"
```

---

## Dashboard/Wallet UI Structure

### Tab Layout
```
WALLET PAGE
├─ BALANCES OVERVIEW (top cards)
│  ├─ Primary Wallet: $425.50 (clickable)
│  ├─ Trading: $1,250.00 (active positions)
│  ├─ Vault: $5,430.20 (locked/earning)
│  ├─ Escrow: $0 (no pending)
│  └─ Total Net Worth: $7,105.70
│
├─ TABS
│  ├─ DEPOSIT TAB
│  │  ├─ Deposit Method Selector
│  │  │  ├─ Off-Ramp (Stripe/Kotanipay/M-Pesa) → How much fiat?
│  │  │  └─ External Wallet (Manual transfer) → Receive address + QR
│  │  ├─ Deposit History
│  │  └─ Status Tracking
│  │
│  ├─ WITHDRAW TAB
│  │  ├─ Source Selector (which account?)
│  │  │  ├─ Primary Wallet ($425.50)
│  │  │  ├─ Trading ($1,250.00)
│  │  │  ├─ Vault ($5,430.20)
│  │  │  └─ Escrow ($0)
│  │  ├─ Destination Selector (where to?)
│  │  │  ├─ Off-Ramp (convert to fiat)
│  │  │  ├─ External Wallet (enter address)
│  │  │  ├─ Micro-Withdrawal (< $10 → batched)
│  │  │  └─ Internal Transfer (to another account)
│  │  ├─ Amount & Fee Preview
│  │  └─ Withdraw History
│  │
│  ├─ TRANSACTIONS TAB
│  │  ├─ All deposits + withdrawals
│  │  ├─ Filter by type/status
│  │  └─ Detailed logs
│  │
│  ├─ MICRO-WITHDRAWALS TAB (or sub-section)
│  │  ├─ Pending requests
│  │  ├─ Batch status
│  │  ├─ New request form
│  │  └─ Batch history
│  │
│  └─ ACCOUNT MANAGEMENT TAB
│     ├─ Transfer between accounts
│     ├─ Account settings
│     └─ Account-specific history
│
└─ QUICK ACTIONS (buttons)
   ├─ "Deposit Now"
   ├─ "Withdraw"
   └─ "Send to Friend" (P2P)
```

---

## Database Schema - Updated

### Users Table (Existing)
```sql
-- Already have user info
```

### Accounts Table (NEW - Core of new system)
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES users(id),
  accountType VARCHAR(50) NOT NULL, -- 'wallet', 'trading', 'vault', 'escrow'
  balance DECIMAL(18, 8) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL, -- USDC, USDT, cUSD, ETH
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, locked, frozen
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_type CHECK (accountType IN ('wallet', 'trading', 'vault', 'escrow'))
);

CREATE UNIQUE INDEX idx_user_account_type ON accounts(userId, accountType, currency);
```

### Deposits Table (NEW)
```sql
CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES users(id),
  toAccountId UUID NOT NULL REFERENCES accounts(id),
  source VARCHAR(50) NOT NULL, -- 'offramp_stripe', 'offramp_kotanipay', 'offramp_mpesa', 'external_wallet'
  sourceIdentifier VARCHAR(255), -- tx hash, email, phone, wallet address
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  feeAmount DECIMAL(18, 8) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, failed, cancelled
  transactionHash VARCHAR(255),
  externalReference VARCHAR(255), -- off-ramp provider reference
  metadata JSONB, -- provider-specific data
  createdAt TIMESTAMP DEFAULT NOW(),
  completedAt TIMESTAMP,
  
  CONSTRAINT valid_source CHECK (source IN ('offramp_stripe', 'offramp_kotanipay', 'offramp_mpesa', 'external_wallet'))
);

CREATE INDEX idx_deposits_userId ON deposits(userId);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_deposits_createdAt ON deposits(createdAt);
```

### Withdrawals Table (NEW - replaces old if exists)
```sql
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES users(id),
  fromAccountId UUID NOT NULL REFERENCES accounts(id),
  destination VARCHAR(50) NOT NULL, -- 'offramp_stripe', 'external_wallet', 'micro_withdrawal', 'internal_transfer'
  destinationAddress VARCHAR(255), -- wallet address or off-ramp identifier
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  feeAmount DECIMAL(18, 8) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  transactionHash VARCHAR(255),
  externalReference VARCHAR(255), -- off-ramp provider reference
  metadata JSONB,
  createdAt TIMESTAMP DEFAULT NOW(),
  completedAt TIMESTAMP,
  
  CONSTRAINT valid_destination CHECK (destination IN ('offramp_stripe', 'offramp_kotanipay', 'offramp_mpesa', 'external_wallet', 'micro_withdrawal', 'internal_transfer'))
);

CREATE INDEX idx_withdrawals_userId ON withdrawals(userId);
CREATE INDEX idx_withdrawals_fromAccountId ON withdrawals(fromAccountId);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
```

### Internal Transfers Table (NEW)
```sql
CREATE TABLE internalTransfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES users(id),
  fromAccountId UUID NOT NULL REFERENCES accounts(id),
  toAccountId UUID NOT NULL REFERENCES accounts(id),
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  reason VARCHAR(100), -- 'trading', 'savings', 'profit_lock', 'rebalance'
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  createdAt TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT different_accounts CHECK (fromAccountId != toAccountId),
  CONSTRAINT valid_reason CHECK (reason IN ('trading', 'savings', 'profit_lock', 'rebalance', 'manual'))
);

CREATE INDEX idx_transfers_userId ON internalTransfers(userId);
CREATE INDEX idx_transfers_fromAccountId ON internalTransfers(fromAccountId);
CREATE INDEX idx_transfers_toAccountId ON internalTransfers(toAccountId);
```

### Micro-Withdrawals Table (ALREADY DESIGNED - fits here)
```sql
-- See MICRO_WITHDRAWALS_SCHEMA.md
-- Links to: withdrawals.id (when destination = 'micro_withdrawal')
```

---

## API Routes - Organized

### Deposit Routes
```
GET    /api/deposits/methods          List available deposit methods
POST   /api/deposits/offramp/initiate Create off-ramp deposit
GET    /api/deposits/offramp/status   Check off-ramp status
GET    /api/deposits/wallet-address   Get receiving wallet address
GET    /api/deposits/history          User's deposit history
```

### Withdraw Routes
```
GET    /api/withdrawals/methods       List available withdraw destinations
GET    /api/withdrawals/preview       Preview fees/amounts
POST   /api/withdrawals/initiate      Create withdrawal request
GET    /api/withdrawals/status/:id    Check withdrawal status
POST   /api/withdrawals/cancel/:id    Cancel pending withdrawal
GET    /api/withdrawals/history       User's withdrawal history
```

### Account Routes
```
GET    /api/accounts                  List user's accounts
GET    /api/accounts/:accountId       Account details & balance
POST   /api/accounts/transfer         Internal transfer between accounts
GET    /api/accounts/:accountId/history Transaction history for account
```

### Micro-Withdrawal Routes (as sub-section of withdrawals)
```
POST   /api/withdrawals/micro/request     Request micro-withdrawal (< $10)
GET    /api/withdrawals/micro/pending     Pending micro-withdrawals
POST   /api/withdrawals/micro/cancel      Cancel micro-withdrawal
```

---

## UI Component Structure

### DashboardPage.tsx
```tsx
export default function DashboardPage() {
  return (
    <div>
      <WalletBalanceOverview />  // Shows all 5 accounts + total net worth
      
      <Tabs>
        <Tab label="Deposit">
          <DepositPage />
        </Tab>
        
        <Tab label="Withdraw">
          <WithdrawPage />
        </Tab>
        
        <Tab label="Transactions">
          <TransactionHistory />
        </Tab>
        
        <Tab label="Accounts">
          <AccountManagement />
        </Tab>
      </Tabs>
    </div>
  );
}
```

### DepositPage.tsx
```tsx
export default function DepositPage() {
  const [method, setMethod] = useState('offramp'); // 'offramp' or 'external'
  
  return (
    <div>
      <MethodSelector onChange={setMethod} />
      
      {method === 'offramp' && (
        <OffRampDeposit />  // Stripe/Kotanipay/M-Pesa
      )}
      
      {method === 'external' && (
        <ExternalWalletDeposit />  // Show receiving address + QR
      )}
      
      <DepositHistory />
    </div>
  );
}
```

### WithdrawPage.tsx
```tsx
export default function WithdrawPage() {
  const [fromAccount, setFromAccount] = useState('wallet');
  const [toDestination, setToDestination] = useState('external');
  
  return (
    <div>
      <SourceSelector onChange={setFromAccount} />
      <DestinationSelector onChange={setToDestination} />
      
      {toDestination === 'offramp' && (
        <OffRampWithdraw fromAccount={fromAccount} />
      )}
      
      {toDestination === 'external_wallet' && (
        <ExternalWithdraw fromAccount={fromAccount} />
      )}
      
      {toDestination === 'micro_withdrawal' && (
        <MicroWithdrawalRequest fromAccount={fromAccount} />  // < $10 only
      )}
      
      {toDestination === 'internal_transfer' && (
        <InternalTransfer fromAccount={fromAccount} />
      )}
      
      <WithdrawHistory />
    </div>
  );
}
```

### WalletBalanceOverview.tsx
```tsx
// Shows all 5 account balances with clickable cards
// Clicking shows account details + options
```

---

## Implementation Priority

### Phase 1: Account Structure (FOUNDATION)
```
1. Create accounts table + schema
2. Migrate existing balances to accounts
3. Create account routes (GET /accounts)
4. Update all balance queries to use accounts table
Priority: CRITICAL - everything depends on this
```

### Phase 2: Deposit Flow
```
1. Create deposits table
2. Create deposit routes (POST /deposits/offramp, etc.)
3. Integrate with off-ramp providers (Stripe, Kotanipay, M-Pesa)
4. Create DepositPage UI component
Priority: HIGH - enables funding
```

### Phase 3: Withdraw Flow
```
1. Create withdrawals table
2. Create withdraw routes
3. Create WithdrawPage UI component
4. Integrate with off-ramp providers
Priority: HIGH - enables user exit
```

### Phase 4: Dashboard Tabs
```
1. Create DashboardPage with tabs
2. Create WalletBalanceOverview component
3. Integrate all previous components
Priority: HIGH - user-facing
```

### Phase 5: Micro-Withdrawals Integration
```
1. Create internal_transfers table (optional but useful)
2. Add micro-withdrawals as withdrawal destination
3. Update WithdrawPage to show micro-withdrawal option
4. Integrate MicroWithdrawalWidget
Priority: MEDIUM - alternative for small amounts
```

### Phase 6: Account Transfer
```
1. Create internal_transfers table
2. Add account-to-account transfer routes
3. Create transfer UI
Priority: MEDIUM - power user feature
```

---

## Key Design Decisions

### Why Separate Accounts?
1. **Clarity**: User knows where their money is
2. **Risk Management**: Can lock vault while trading continues
3. **Tax Tracking**: Easier to categorize for reporting
4. **Automation**: Different rules per account (vault auto-invest, trading auto-rebalance)
5. **Permissions**: Could allow traders to access trading account but not vault

### Why Multiple Deposit Sources?
1. **Flexibility**: Users choose what works for them
2. **Global Reach**: M-Pesa for Africa, Stripe for credit cards, Kotanipay for crypto
3. **Fiat On-Ramp**: Users can convert fiat → crypto easily
4. **Low Friction**: External wallet = instant, no fees

### Why Multiple Withdraw Options?
1. **User Preference**: Some want fiat, some want crypto
2. **Micro-Withdrawals**: Solves the < $10 problem
3. **Internal Transfers**: Keep money in DAO, just move accounts
4. **Off-Ramp**: Convert back to local currency

---

## Fee Structure Example

```
DEPOSIT FEES
├─ Off-Ramp → Wallet: 2-3% (payment processor)
└─ External Wallet → Wallet: 0% (blockchain gas paid by DAO)

WITHDRAW FEES
├─ Wallet → Off-Ramp: 2-3% (payment processor)
├─ Wallet → External: Blockchain gas (user pays)
├─ Wallet → Micro-Withdrawal: Batched gas (80-90% cheaper)
└─ Vault → Wallet (Internal): 0%

INTERNAL TRANSFER FEES
├─ Wallet ↔ Trading: 0% (instant)
├─ Wallet ↔ Vault: 0% (instant)
└─ Vault ↔ Trading: 0% (instant)
```

---

## Summary: Where Does Micro-Withdrawals Fit?

**Micro-Withdrawals** integrate as:
1. **A withdrawal destination** (not separate system)
   - When user wants to withdraw < $10
   - Automatically batched
   - 80-90% cheaper than direct

2. **In the Withdraw tab**
   ```
   Choose Destination:
   ├─ Off-Ramp (convert to fiat)
   ├─ External Wallet (direct transfer)
   ├─ Micro-Withdrawal ← HERE (for small amounts)
   └─ Internal Transfer (to another account)
   ```

3. **With its own sub-section**
   - View pending micro-withdrawals
   - See batch status
   - Cancel if needed (while still pending)

4. **Positioned as a smart choice**
   - "Withdraw $7? Use Micro-Withdrawal to save on gas!"
   - Shows gas savings vs direct

---

## Next Steps

1. **Review & Approve Architecture** - Does this make sense?
2. **Create Accounts Table** - Foundation for everything
3. **Build Deposit Flow** - Enable funding
4. **Build Withdraw Flow** - Enable micro-withdrawals
5. **Build Dashboard Tabs** - Tie it all together
6. **Add UI Components** - User-facing experience

Should I start with Phase 1 (accounts table) or would you like to discuss any architecture decisions first?
