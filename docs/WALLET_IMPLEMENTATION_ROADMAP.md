# Wallet System Implementation Roadmap

## Overview
Build a comprehensive wallet system with multiple accounts (Wallet, Trading, Vault, Escrow) and flexible deposit/withdraw flows integrated with micro-withdrawals.

---

## Phase 1: Foundation - Account Structure ⏳ PENDING

### Create Accounts System (NEW)

**Database**:
- Create `accounts` table (userId, accountType, balance, currency, status)
- Create index: `(userId, accountType, currency)`
- Add check constraint: accountType IN ('wallet', 'trading', 'vault', 'escrow')

**Migration**:
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES users(id),
  accountType VARCHAR(50) NOT NULL,
  balance DECIMAL(18, 8) DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
  status VARCHAR(20) DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

**Service**: `server/services/account-service.ts`
- `getAccountsForUser(userId)` - Get all user accounts
- `getAccountBalance(userId, accountType)` - Get specific account balance
- `getNetWorth(userId)` - Sum all accounts
- `createAccountsForNewUser(userId)` - Auto-create 4 accounts
- `transferBetweenAccounts(fromId, toId, amount)` - Move money

**Routes**: `server/routes/accounts.ts`
```
GET    /api/accounts              - List user's accounts
GET    /api/accounts/:accountId   - Account details
GET    /api/accounts/net-worth    - Total value
```

**Status**: Prerequisite for everything else

---

## Phase 2: Deposit Infrastructure ⏳ PENDING

### Create Deposits System

**Database**:
- Create `deposits` table (userId, toAccountId, source, amount, status, etc.)
- Create indexes: userId, status, createdAt

**Service**: `server/services/deposit-service.ts`
- `initiateOffRampDeposit(userId, method, amount)` - Create deposit intent
- `completeOffRampDeposit(depositId, transactionHash)` - Webhook from off-ramp provider
- `processExternalWalletDeposit(toAddress, amount, txHash)` - Detect incoming transfer
- `getDepositHistory(userId)` - User's deposit history
- `getReceivingWalletAddress()` - Show user where to send

**Routes**: `server/routes/deposits.ts`
```
GET    /api/deposits/methods          - Available deposit options
POST   /api/deposits/offramp          - Start off-ramp deposit
GET    /api/deposits/wallet-address   - Receiving wallet address
POST   /api/deposits/webhook          - Provider webhooks
GET    /api/deposits/status/:id       - Check deposit status
GET    /api/deposits/history          - User's deposit history
```

**Integration Points**:
- Stripe integration (existing)
- Kotanipay integration (existing)
- M-Pesa integration (existing)
- Add webhook handlers for each

**Status**: Enables funding

---

## Phase 3: Withdrawal Infrastructure ⏳ PENDING

### Create Withdrawals System

**Database**:
- Create `withdrawals` table (userId, fromAccountId, destination, status, etc.)
- Create indexes: userId, fromAccountId, status, createdAt

**Service**: `server/services/withdrawal-service.ts`
- `initiateOffRampWithdraw(userId, accountId, amount, method)` - Create off-ramp request
- `initiateExternalWithdraw(userId, accountId, address, amount)` - Send to external wallet
- `initiateInternalTransfer(userId, fromAcct, toAcct, amount)` - Move between accounts
- `initiateMicroWithdraw(userId, accountId, amount, address)` - Create micro-withdrawal
- `getWithdrawalHistory(userId)` - User's withdraw history
- `getAvailableBalance(userId, accountId)` - Check if enough balance + locked status
- `estimateFees(destination, amount, currency)` - Show fees before confirm

**Routes**: `server/routes/withdrawals.ts`
```
GET    /api/withdrawals/methods       - Available withdraw options
GET    /api/withdrawals/preview       - Fee preview
POST   /api/withdrawals/offramp       - Start off-ramp withdraw
POST   /api/withdrawals/external      - Send to external wallet
POST   /api/withdrawals/internal      - Transfer between accounts
POST   /api/withdrawals/micro         - Create micro-withdrawal
GET    /api/withdrawals/status/:id    - Check status
POST   /api/withdrawals/cancel/:id    - Cancel pending
GET    /api/withdrawals/history       - User's history
```

**Micro-Withdrawals Integration**:
- When user selects "Micro-Withdrawal" destination:
  - Check amount < $10 ✓
  - Call micro-withdrawal service `requestMicroWithdrawal()`
  - Link withdrawal record to micro-withdrawal request
  - Show batch status instead of direct status

**Status**: Enables user exits

---

## Phase 4: Internal Transfers ⏳ PENDING

### Account-to-Account Transfers

**Database**:
- Create `internalTransfers` table
- Track all user transfers between their own accounts

**Service**: `server/services/transfer-service.ts`
- `transferBetweenAccounts(userId, fromId, toId, amount, reason)` - Execute transfer
- `getTransferHistory(userId)` - View all transfers

**Routes**: `server/routes/transfers.ts`
```
POST   /api/transfers                 - Create transfer
GET    /api/transfers/history         - Transfer history
```

**Valid Transfers**:
- Wallet ↔ Trading (prepare to trade or secure profits)
- Wallet ↔ Vault (save or use savings)
- Trading ↔ Vault (lock gains or trade savings)
- Any ↔ Escrow (pay for deals)

**Status**: Enables money management

---

## Phase 5: Dashboard UI - Wallet Overview 🎨 PENDING

### Create WalletDashboardPage

**Component**: `client/src/pages/wallet/index.tsx`

```tsx
export default function WalletDashboard() {
  const [accounts, setAccounts] = useState([]);
  const [activeTab, setActiveTab] = useState('deposit');
  
  return (
    <div>
      {/* Net Worth Overview */}
      <WalletBalanceOverview accounts={accounts} />
      
      {/* Tab Navigation */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab label="Deposit" value="deposit">
          <DepositPage />
        </Tab>
        
        <Tab label="Withdraw" value="withdraw">
          <WithdrawPage accounts={accounts} />
        </Tab>
        
        <Tab label="Transfers" value="transfer">
          <TransferPage accounts={accounts} />
        </Tab>
        
        <Tab label="Transactions" value="transactions">
          <TransactionHistory />
        </Tab>
        
        <Tab label="Accounts" value="accounts">
          <AccountsManagement accounts={accounts} />
        </Tab>
      </Tabs>
    </div>
  );
}
```

**Components to Create**:

1. **WalletBalanceOverview.tsx** (150 lines)
   - Shows 5 account cards: Wallet, Trading, Vault, Escrow, Total
   - Click each card to see details
   - Quick stats: Liquid, Locked, Earning

2. **DepositPage.tsx** (200 lines)
   - Method selector: Off-ramp vs External
   - Off-ramp form: Choose provider, enter amount, confirm
   - External form: Show receiving address + QR code
   - Deposit history table

3. **WithdrawPage.tsx** (250 lines)
   - Source selector: Which account?
   - Destination selector: Where to send?
   - Amount input with validation
   - Fee preview
   - Withdrawal history

4. **TransferPage.tsx** (200 lines)
   - From/To account selector
   - Amount input
   - Reason dropdown
   - Transfer history

5. **TransactionHistory.tsx** (150 lines)
   - Combined view of all: Deposits, Withdrawals, Transfers
   - Filter by type, status, date
   - Show source/destination

---

## Phase 6: Deposit UI Components 🎨 PENDING

### Create DepositPage Components

**OffRampDepositForm.tsx** (150 lines)
```tsx
export default function OffRampDepositForm() {
  const [provider, setProvider] = useState('stripe');
  const [amount, setAmount] = useState('');
  
  const providers = [
    { id: 'stripe', name: 'Stripe', currencies: ['USD', 'EUR', 'GBP'] },
    { id: 'kotanipay', name: 'Kotanipay', currencies: ['USD', 'KES'] },
    { id: 'mpesa', name: 'M-Pesa', currencies: ['KES'] }
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deposit with Off-Ramp</CardTitle>
        <CardDescription>Convert fiat to crypto</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Provider selection */}
        {/* Amount input */}
        {/* Fee preview: 2-3% */}
        {/* Continue button */}
      </CardContent>
    </Card>
  );
}
```

**ExternalWalletDepositForm.tsx** (100 lines)
```tsx
export default function ExternalWalletDepositForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deposit from External Wallet</CardTitle>
        <CardDescription>Send crypto from Binance, MetaMask, etc.</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Show receiving address */}
        {/* QR code */}
        {/* Deposit history */}
      </CardContent>
    </Card>
  );
}
```

**Status**: User can fund their account

---

## Phase 7: Withdraw UI Components 🎨 PENDING

### Create WithdrawPage Components

**WithdrawSourceSelector.tsx** (80 lines)
```tsx
export default function WithdrawSourceSelector({ accounts, onSelect }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {accounts.map(account => (
        <Card key={account.id} className="cursor-pointer" onClick={() => onSelect(account)}>
          <CardContent>
            <div className="font-bold">{account.type}</div>
            <div className="text-2xl">${account.balance}</div>
            {account.locked && <Badge variant="outline">LOCKED</Badge>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**WithdrawDestinationSelector.tsx** (150 lines)
```tsx
export default function WithdrawDestinationSelector({ amount, onSelect }) {
  const options = [
    { id: 'offramp', label: 'Off-Ramp (Get USD)', description: 'Convert to fiat' },
    { id: 'external', label: 'External Wallet', description: 'Send to external address' },
    { id: 'micro', label: 'Micro-Withdrawal', description: 'For amounts < $10 (batched)' },
    { id: 'internal', label: 'Internal Transfer', description: 'Move to another account' }
  ];
  
  return (
    <div>
      {options.map(option => {
        const disabled = option.id === 'micro' && amount > 10;
        return (
          <Card key={option.id} className={disabled ? 'opacity-50' : ''}>
            {/* Show option with description */}
          </Card>
        );
      })}
    </div>
  );
}
```

**WithdrawForm.tsx** (250 lines)
```tsx
export default function WithdrawForm() {
  const [sourceAccount, setSourceAccount] = useState(null);
  const [destination, setDestination] = useState(null);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  
  const handleWithdraw = async () => {
    // Validate amount and destination
    // Call appropriate withdrawal service
    if (destination === 'micro') {
      // Call micro-withdrawal service
      await initiateMicroWithdraw(sourceAccount, amount, address);
    } else {
      // Call regular withdrawal service
      await initiateWithdraw(sourceAccount, destination, amount, address);
    }
  };
  
  return (
    <Card>
      {/* Source selector */}
      {/* Destination selector */}
      {/* Amount input */}
      {/* Address input (if external) */}
      {/* Fee preview */}
      {/* Withdraw button */}
    </Card>
  );
}
```

**Status**: User can withdraw with multiple options

---

## Phase 8: Transfer UI Components 🎨 PENDING

### Create TransferPage

**TransferForm.tsx** (200 lines)
```tsx
export default function TransferForm() {
  const [fromAccount, setFromAccount] = useState(null);
  const [toAccount, setToAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('trading');
  
  const reasons = [
    { value: 'trading', label: 'Prepare for trading' },
    { value: 'savings', label: 'Lock in vault' },
    { value: 'profit_lock', label: 'Lock gains' },
    { value: 'rebalance', label: 'Rebalance portfolio' }
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Between Accounts</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* From account selector */}
        {/* Arrow indicator */}
        {/* To account selector */}
        {/* Amount input */}
        {/* Reason selector */}
        {/* Fee: $0 (no fees for internal transfer) */}
        {/* Transfer button */}
      </CardContent>
    </Card>
  );
}
```

**Status**: User can manage money between accounts

---

## Phase 9: Integrate Micro-Withdrawals

### Update Withdrawal Flow

**In WithdrawPage.tsx**:
```tsx
if (destination === 'micro') {
  // Show micro-withdrawal specific UI
  return (
    <div>
      {/* Amount input (max $10) */}
      {/* Address input */}
      {/* Show batch status */}
      {/* Show pending micro-withdrawals */}
      {/* Show batch history */}
    </div>
  );
}
```

**Service Integration**:
- Link `withdrawal-service.ts` to `micro-withdrawal-service.ts`
- When destination = 'micro-withdrawal':
  - Call `requestMicroWithdrawal()` from micro-withdrawal-service
  - Store withdrawal record pointing to micro-withdrawal request
  - Show batch status in UI

**Status**: Micro-withdrawals integrated into main flow

---

## Phase 10: Transaction History & Reconciliation

### Create Transaction History View

**TransactionHistory.tsx** (200 lines)
- Combined view of:
  - All deposits (with source: off-ramp or external)
  - All withdrawals (with destination)
  - All transfers (with from/to accounts)
- Filter by:
  - Type (deposit/withdraw/transfer)
  - Status (pending/completed/failed)
  - Date range
  - Account
- Show:
  - Amount, direction, status
  - Timestamp, fee, net amount
  - TX hash or reference

**Status**: User can see complete financial history

---

## Phase 11: Admin Dashboard Enhancements

### Add to Admin Dashboard

**AdminWalletStats.tsx** (150 lines)
- Total deposits (by provider)
- Total withdrawals (by destination)
- Average deposit/withdrawal amounts
- Popular destinations
- Failed transactions
- Micro-withdrawal stats

---

## Database Schema Summary

```sql
-- New Tables
accounts              (userId, accountType, balance)
deposits              (userId, toAccountId, source, amount, status)
withdrawals           (userId, fromAccountId, destination, amount, status)
internalTransfers     (userId, fromAccountId, toAccountId, amount)
microWithdrawals      (userId, amount, toAddress, status, batchId)
microWithdrawalBatches (requestIds, totalAmount, status, transactionHash)

-- Existing Tables (Reference)
users
notifications
```

---

## Implementation Timeline

| Phase | Task | Effort | Owner |
|-------|------|--------|-------|
| 1 | Accounts system | 4h | Backend |
| 2 | Deposits service | 6h | Backend |
| 3 | Withdrawals service | 6h | Backend |
| 4 | Internal transfers | 3h | Backend |
| 5 | Dashboard layout | 4h | Frontend |
| 6 | Deposit UI | 6h | Frontend |
| 7 | Withdraw UI | 8h | Frontend |
| 8 | Transfer UI | 4h | Frontend |
| 9 | Micro-withdraw integration | 3h | Both |
| 10 | Transaction history | 4h | Frontend |
| 11 | Admin dashboard | 3h | Frontend |

**Total**: ~51 hours

---

## Integration with Existing Systems

### Off-Ramp Providers
- Stripe: Existing integration, add deposit webhook
- Kotanipay: Existing integration, add deposit webhook
- M-Pesa: Existing integration, add deposit webhook

### Notifications
- Deposit completed
- Withdrawal initiated
- Withdrawal completed
- Transfer completed
- Batch processed (micro-withdrawals)

### Escrow System
- Link escrow balance to escrow account
- Allow withdrawal from escrow once released

### Profile/Dashboard
- Add wallet tab to main dashboard
- Show account balances on profile

---

## Success Criteria

✅ Users can deposit via multiple methods
✅ Users can withdraw with multiple options
✅ Users can transfer between their own accounts
✅ Micro-withdrawals available for small amounts
✅ Complete transaction history visible
✅ Real-time balance updates
✅ Clear fee preview before confirming
✅ All operations logged and auditable

---

**Status**: Ready for implementation
**Priority**: HIGH - Core financial infrastructure
**Complexity**: MEDIUM - Integrates multiple systems

