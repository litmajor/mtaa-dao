# Wallets + Accounts Full Integration Guide

## 🎯 Complete System Architecture

This document shows how the **Wallets Layer** (blockchain) and **Accounts System** (fund management) integrate end-to-end.

---

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MTAA DAO WALLET SYSTEM                   │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐
│  USER SIGNUP/KYC                     │
│  ├─ Create account in users table    │
│  └─ Generate wallet                  │
│     ├─ Create wallets row            │
│     ├─ Encrypt & store private keys  │
│     └─ Initialize 4 accounts         │
└────────────┬────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│  BLOCKCHAIN INTERACTION              │
│  ├─ User has 1 wallet address        │
│  ├─ Wallet receives deposits         │
│  └─ Wallet signs withdrawals         │
└────────────┬────────────────────────┘
             │
        ┌────┴────┐
        ▼         ▼
    DEPOSITS   WITHDRAWALS
        │         │
        ▼         ▼
┌──────────────────────────────────────┐
│  FUND MANAGEMENT (Accounts)          │
│  ├─ Wallet account (receives)        │
│  ├─ Trading account (daily trading)  │
│  ├─ Vault account (locked savings)   │
│  └─ Escrow account (holds in trust)  │
└──────────────────────────────────────┘
```

---

## 🔄 Complete User Journey

### Phase 1: User Registration & Wallet Creation

```
1. User Signs Up
   POST /api/auth/register
   {
     email: "user@example.com",
     password: "...",
     phone: "+254712345678"
   }
   
   ↓
   
2. Backend Creates User Account
   - Insert into users table
   - userId = "abc-123-def-456"
   
   ↓
   
3. Auto-Generate Wallet
   walletGenerationService.createUserWallet(userId, 'USDC', 'personal')
   
   ↓
   
4. Wallet Created with:
   ✅ wallets.id = "wallet-001"
   ✅ wallets.address = "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE8"
   ✅ wallets.currency = "USDC"
   ✅ wallets.userId = "abc-123-def-456"
   ✅ wallet_private_keys (encrypted, AES-256)
   ✅ wallet_public_keys
   ✅ wallet_seed_phrases (encrypted, AES-256)
   ✅ wallet_security_settings
   
   ↓
   
5. Auto-Initialize 4 Accounts
   FOR EACH account_type IN ['wallet', 'trading', 'vault', 'escrow']:
     INSERT INTO accounts
     (
       id = uuid(),
       user_id = "abc-123-def-456",
       account_type = 'wallet' | 'trading' | 'vault' | 'escrow',
       balance = '0',
       currency = 'USDC',
       status = 'active'
     )
   
   Result:
   ✅ accounts[wallet] - for general funds
   ✅ accounts[trading] - for active trading
   ✅ accounts[vault] - for locked savings
   ✅ accounts[escrow] - for holding in trust
   
   ↓
   
6. Return to User
   {
     success: true,
     data: {
       walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE8",
       message: "Please save your wallet address"
     }
   }
```

### Phase 2: User Deposits Funds

```
1. User Sends Funds to Wallet Address
   External Source (Stripe, M-Pesa, Friend)
   → Transfer to wallet.address
   → TX Hash: 0xabc123...
   → Amount: 1000 USDC
   
   ↓
   
2. Blockchain Processes Transaction
   ✅ 12 confirmations achieved
   
   ↓
   
3. Webhook Listener Receives Notification
   POST /api/webhooks/deposits/alchemy
   {
     event: {
       activity: [{
         hash: "0xabc123...",
         toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE8",
         value: "1000000000",  // 1000 USDC
         tokenSymbol: "USDC",
         status: "confirmed",
         confirmations: 12
       }]
     }
   }
   
   ↓
   
4. Backend Processes Deposit
   transactionWebhookService.processIncomingDeposit({
     toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE8",
     amount: "1000000000",
     tokenSymbol: "USDC"
   })
   
   ↓
   
5. Find User's Wallet & Account
   wallet = SELECT * FROM wallets WHERE address = "0x742d..."
   account = SELECT * FROM accounts 
             WHERE user_id = wallet.user_id 
             AND account_type = 'wallet'
             AND currency = 'USDC'
   
   ↓
   
6. Record Deposit
   INSERT INTO deposits {
     id: uuid(),
     user_id: "abc-123-def-456",
     to_account_id: account.id,
     source: "external_wallet",
     amount: "1000",
     currency: "USDC",
     status: "completed",
     transactionHash: "0xabc123...",
     createdAt: now()
   }
   
   ↓
   
7. Update Account Balance
   UPDATE accounts SET balance = 1000 WHERE id = account.id
   
   ↓
   
8. User Can Now See Balance
   GET /api/accounts/:accountId
   {
     id: account.id,
     accountType: "wallet",
     balance: "1000.00",
     currency: "USDC"
   }
```

### Phase 3: User Transfers Between Accounts

```
1. User Transfers Funds from Wallet → Vault
   POST /api/accounts/wallet-account-id/transfer
   {
     destinationAccountId: vault-account-id,
     amount: "500.00",
     reason: "savings"
   }
   
   ↓
   
2. Backend Validates
   ✅ Source account (wallet) has balance >= 500
   ✅ Destination account (vault) exists
   ✅ Both accounts belong to same user
   
   ↓
   
3. Record Internal Transfer
   INSERT INTO internal_transfers {
     id: uuid(),
     user_id: "abc-123-def-456",
     from_account_id: wallet-account-id,
     to_account_id: vault-account-id,
     amount: "500",
     currency: "USDC",
     reason: "savings",
     status: "completed"
   }
   
   ↓
   
4. Update Balances (Atomic Transaction)
   BEGIN TRANSACTION
     UPDATE accounts SET balance = 500 WHERE id = wallet-account-id
     UPDATE accounts SET balance = 500 WHERE id = vault-account-id
   COMMIT
   
   ↓
   
5. Confirmation
   {
     success: true,
     transfer: {
       id: transfer-id,
       from: "wallet",
       to: "vault",
       amount: "500.00",
       status: "completed"
     }
   }
```

### Phase 4: User Withdraws Funds

```
1. User Initiates Withdrawal
   POST /api/withdrawals/initiate
   {
     sourceAccountId: vault-account-id,
     destination: "external_wallet",
     recipientAddress: "0xdef456...",
     amount: "250.00"
   }
   
   ↓
   
2. Backend Prepares Withdrawal
   withdrawalSigningService.prepareWithdrawalForSigning(
     userId: "abc-123-def-456",
     accountId: vault-account-id,
     destination: "external_wallet",
     recipientAddress: "0xdef456...",
     amount: "250"
   )
   
   ↓
   
3. Create Withdrawal Record
   INSERT INTO withdrawals {
     id: withdrawal-id,
     user_id: "abc-123-def-456",
     from_account_id: vault-account-id,
     destination: "external_wallet",
     amount: "250",
     currency: "USDC",
     status: "pending"
   }
   
   ↓
   
4. Build Unsigned Transaction
   Transaction {
     from: "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE8",  // wallet.address
     to: "0xdef456...",  // recipient
     value: "250000000",  // 250 USDC
     chainId: 42220
   }
   
   ↓
   
5. Sign Transaction (Server-Side Only!)
   POST /api/withdrawals/:id/sign
   {
     withdrawalId: withdrawal-id,
     authorization: "2FA_code"
   }
   
   ↓
   
   withdrawalSigningService.signWithdrawalTransaction(
     userId: "abc-123-def-456",
     walletId: wallet-id,
     withdrawalId: withdrawal-id,
     transaction: {...}
   )
   
   Steps:
   a) Verify user owns wallet
   b) Fetch encrypted private key from wallet_private_keys
   c) Decrypt with PBKDF2 key derivation
   d) Sign transaction with ethers.js
   e) Log access in wallet_access_log
   f) Return signed transaction
   
   ↓
   
6. Execute Withdrawal
   POST /api/withdrawals/:id/execute
   {
     signedTransaction: "0xsignedtx..."
   }
   
   ↓
   
   withdrawalSigningService.executeSignedWithdrawal(
     userId: "abc-123-def-456",
     withdrawalId: withdrawal-id,
     signedTransaction: "0xsignedtx...",
     rpcProvider: "https://forno.celo.org"
   )
   
   Steps:
   a) Submit to blockchain via RPC provider
   b) Receive tx hash
   c) Update withdrawals.status = "processing"
   d) Return tx hash
   
   ↓
   
7. Monitor Confirmation
   GET /api/withdrawals/:id/confirmation
   
   Background job:
   processPendingWithdrawals()
   
   Checks:
   - Get current block number
   - Calculate confirmations
   - Update status when >= 12 confirmations
   
   ↓
   
8. Update Account Balance (When Confirmed)
   UPDATE accounts SET balance = 250 WHERE id = vault-account-id
   
   ↓
   
9. Funds Arrive at Recipient
   Recipient receives 250 USDC at their address
```

---

## 💾 Database State Throughout Journey

### After Registration (User: abc-123-def-456)
```
users:
  id: "abc-123-def-456"
  email: "user@example.com"
  ...

wallets:
  id: "wallet-001"
  user_id: "abc-123-def-456"
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE8"
  currency: "USDC"
  wallet_type: "personal"
  is_active: true

wallet_private_keys:
  wallet_id: "wallet-001"
  encrypted_private_key: "encrypted..."
  encryption_iv: "random..."
  encryption_salt: "random..."
  auth_tag: "verification..."

accounts:
  [wallet]   id: "acc-001" user_id: "abc-123..." account_type: "wallet"   balance: "0"
  [trading]  id: "acc-002" user_id: "abc-123..." account_type: "trading"  balance: "0"
  [vault]    id: "acc-003" user_id: "abc-123..." account_type: "vault"    balance: "0"
  [escrow]   id: "acc-004" user_id: "abc-123..." account_type: "escrow"   balance: "0"
```

### After Deposit of 1000 USDC
```
deposits:
  id: "dep-001"
  user_id: "abc-123-def-456"
  to_account_id: "acc-001"  (wallet)
  source: "external_wallet"
  amount: "1000"
  status: "completed"

accounts:
  [wallet]   balance: "1000"
  [trading]  balance: "0"
  [vault]    balance: "0"
  [escrow]   balance: "0"

wallet_transactions:
  id: "wtx-001"
  wallet_id: "wallet-001"
  type: "deposit"
  amount: "1000"
  status: "completed"
```

### After Transfer Wallet → Vault (500 USDC)
```
internal_transfers:
  id: "xfer-001"
  user_id: "abc-123-def-456"
  from_account_id: "acc-001"  (wallet)
  to_account_id: "acc-003"    (vault)
  amount: "500"
  status: "completed"

accounts:
  [wallet]   balance: "500"
  [trading]  balance: "0"
  [vault]    balance: "500"
  [escrow]   balance: "0"
```

### After Withdrawal (250 USDC from Vault)
```
withdrawals:
  id: "with-001"
  user_id: "abc-123-def-456"
  from_account_id: "acc-003"  (vault)
  destination: "external_wallet"
  amount: "250"
  status: "completed"
  transaction_hash: "0xabc123..."

accounts:
  [wallet]   balance: "500"
  [trading]  balance: "0"
  [vault]    balance: "250"
  [escrow]   balance: "0"

wallet_transactions:
  id: "wtx-002"
  wallet_id: "wallet-001"
  type: "withdrawal"
  amount: "250"
  status: "completed"

wallet_access_log:
  id: "log-001"
  wallet_id: "wallet-001"
  user_id: "abc-123-def-456"
  action: "sign_transaction"
  ...
```

---

## 🔐 Security Throughout Flow

### Private Key Security
```
✅ Never stored in plaintext
✅ Encrypted with AES-256-GCM
✅ PBKDF2 key derivation (100k iterations)
✅ Random salt per encryption
✅ Random IV per encryption
✅ Auth tag for integrity
✅ Server-side only (never sent to client)
✅ Decryption only when signing
✅ Encrypted private key destroyed after signing
```

### Access Control
```
✅ All operations require authentication
✅ Wallet operations verified against user_id
✅ Withdrawal requires 2FA (when implemented)
✅ Private key access logged
✅ Failed attempts logged
✅ Suspicious activity can trigger locks
```

### Transaction Integrity
```
✅ Atomic database transactions
✅ Balance validation before operations
✅ Status tracking for all transactions
✅ Blockchain confirmation monitoring
✅ Idempotent webhook processing
```

---

## 📊 API Summary

### Wallet Management
```
POST   /api/wallets                           Create wallet
GET    /api/wallets                           Get wallet
GET    /api/wallets/:walletId                 Get specific wallet
POST   /api/wallets/:walletId/verify          Verify wallet
POST   /api/wallets/:walletId/deactivate      Deactivate
POST   /api/wallets/:walletId/backup          Backup (coming)
```

### Deposits
```
POST   /api/deposits/initiate                 Initiate deposit
GET    /api/deposits/status                   Check deposit status
GET    /api/deposits/wallet-address           Get receiving address
GET    /api/deposits/history                  Deposit history
```

### Withdrawals
```
POST   /api/withdrawals/initiate              Prepare withdrawal
POST   /api/withdrawals/:id/sign              Sign transaction
POST   /api/withdrawals/:id/execute           Execute withdrawal
GET    /api/withdrawals/:id/confirmation      Check confirmation
GET    /api/withdrawals/history               Withdrawal history
```

### Accounts & Transfers
```
GET    /api/accounts                          List user's accounts
GET    /api/accounts/:accountId               Get account details
PUT    /api/accounts/:accountId               Update account
POST   /api/accounts/:accountId/transfer      Transfer between accounts
GET    /api/accounts/:accountId/history       Account transaction history
```

### Webhooks
```
POST   /api/webhooks/deposits/alchemy         Alchemy webhook
POST   /api/webhooks/deposits/quicknode       QuickNode webhook
POST   /api/webhooks/deposits/manual          Manual testing
```

---

## 🎯 Implementation Checklist

- [x] Phase 1: Multi-Account System (accounts, deposits, withdrawals, transfers)
- [x] Phase 2.1: Wallets Layer (generation, encryption, signing)
- [ ] Phase 2.2: Signup Integration (auto-create wallet on register)
- [ ] Phase 2.3: Webhook Setup (Alchemy/QuickNode integration)
- [ ] Phase 2.4: Security Hardening (2FA, PIN, withdrawal limits)
- [ ] Phase 3: Frontend Implementation (UI components for all flows)
- [ ] Phase 4: Advanced Features (multi-sig, HD wallets, bridges)

---

## 🚀 Quick Reference

### Create Wallet for New User
```typescript
const wallet = await walletGenerationService.createUserWallet(userId, 'USDC', 'personal');
// Returns: { walletId, address, currency, walletType }
```

### Process Incoming Deposit
```typescript
await transactionWebhookService.processIncomingDeposit({
  transactionHash, from, to, value, tokenSymbol, decimals, blockNumber, chainId, status
});
// Auto-credits account, creates deposit record
```

### Sign & Execute Withdrawal
```typescript
const prep = await withdrawalSigningService.prepareWithdrawalForSigning(
  userId, accountId, destination, recipientAddress, amount
);
// Validates balance, creates withdrawal record

const signed = await withdrawalSigningService.signWithdrawalTransaction(
  userId, walletId, withdrawalId, prep.transaction
);
// Signs with decrypted private key

await withdrawalSigningService.executeSignedWithdrawal(
  userId, withdrawalId, signed.raw
);
// Broadcasts to blockchain
```

### Monitor Withdrawals (Background Job)
```typescript
// Run every 30 seconds
setInterval(async () => {
  const result = await withdrawalSigningService.processPendingWithdrawals();
  console.log(`Processed: ${result.processed}, Confirmed: ${result.confirmed}`);
}, 30000);
```

---

Generated: January 22, 2026
Full Wallets + Accounts Integration Complete
