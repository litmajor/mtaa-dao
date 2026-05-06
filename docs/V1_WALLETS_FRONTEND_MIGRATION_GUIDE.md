# V1 Wallets API Frontend Migration Guide

## Overview
This guide maps old wallet API routes to new v1/wallets routes for frontend integration.

---

## Route Migration Mapping

### Core Wallet Operations
| Feature | Legacy Route | V1 Route | Method | Status |
|---------|-------------|----------|--------|--------|
| List Wallets | GET `/api/wallets` | GET `/api/v1/wallets` | GET | Updated ✓ |
| Create Wallet | POST `/api/wallets` | POST `/api/v1/wallets` | POST | Updated ✓ |
| Get Wallet | GET `/api/wallets/:id` | GET `/api/v1/wallets/:walletId` | GET | Updated ✓ |
| Update Wallet | PUT `/api/wallets/:id` | PUT `/api/v1/wallets/:walletId` | PUT | Updated ✓ |
| Deactivate Wallet | DELETE `/api/wallets/:id` | DELETE `/api/v1/wallets/:walletId/deactivate` | DELETE | Updated ✓ |

### Balance & Portfolio
| Feature | Legacy Route | V1 Route | Method | Status |
|---------|-------------|----------|--------|--------|
| Get Balance | GET `/api/wallet/balance/:address` | GET `/api/v1/wallets/:walletId/balance` | GET | Updated ✓ |
| Multi Balance | GET `/api/wallet/balance-multi` | GET `/api/v1/wallets/:walletId/balance/multi` | GET | Updated ✓ |
| CELO Balance | GET `/api/wallet/balance/celo` | GET `/api/v1/wallets/:walletId/balance/celo` | GET | Updated ✓ |
| cUSD Balance | GET `/api/wallet/balance/cusd` | GET `/api/v1/wallets/:walletId/balance/cusd` | GET | Updated ✓ |
| Exchange Rates | GET `/api/wallet/exchange-rates` | GET `/api/v1/wallets/:walletId/balance/exchange-rates` | GET | Updated ✓ |
| Network Info | GET `/api/wallet/network-info` | GET `/api/v1/wallets/:walletId/balance/network-info` | GET | Updated ✓ |
| Analytics | GET `/api/wallet/analytics` | GET `/api/v1/wallets/:walletId/balance/analytics` | GET | Updated ✓ |

### Sessions & Connection
| Feature | Legacy Route | V1 Route | Method | Status |
|---------|-------------|----------|--------|--------|
| Active Sessions | GET `/api/wallet-sessions/active` | GET `/api/v1/wallets/:walletId/sessions/active` | GET | Updated ✓ |
| Connect | POST `/api/wallet-sessions/connect` | POST `/api/v1/wallets/:walletId/sessions/connect` | POST | Updated ✓ |
| Disconnect | POST `/api/wallet-sessions/disconnect` | POST `/api/v1/wallets/:walletId/sessions/disconnect` | POST | Updated ✓ |
| Disconnect All | POST `/api/wallet-sessions/disconnect-all` | POST `/api/v1/wallets/:walletId/sessions/disconnect-all` | POST | Updated ✓ |
| Extend Session | POST `/api/wallet-sessions/extend` | POST `/api/v1/wallets/:walletId/sessions/extend` | POST | Updated ✓ |
| Verify Session | POST `/api/wallet-sessions/verify` | POST `/api/v1/wallets/:walletId/sessions/verify` | POST | Updated ✓ |

### Payments
| Feature | Legacy Route | V1 Route | Method | Status |
|---------|-------------|----------|--------|--------|
| Create Payment | POST `/api/wallet/payments` | POST `/api/v1/wallets/payments` | POST | Updated ✓ |
| List Payments | GET `/api/wallet/payments` | GET `/api/v1/wallets/payments` | GET | Updated ✓ |
| Get Payment | GET `/api/wallet/payments/:id` | GET `/api/v1/wallets/payments/:paymentId` | GET | Updated ✓ |
| Cancel Payment | POST `/api/wallet/payments/:id/cancel` | POST `/api/v1/wallets/payments/:paymentId/cancel` | POST | Updated ✓ |
| Create Recurring | POST `/api/wallet/recurring-payments` | POST `/api/v1/wallets/payments/recurring` | POST | Updated ✓ |
| List Recurring | GET `/api/wallet/recurring-payments` | GET `/api/v1/wallets/payments/recurring` | GET | Updated ✓ |
| Update Recurring | PUT `/api/wallet/recurring-payments/:id` | PUT `/api/v1/wallets/payments/recurring/:id` | PUT | Updated ✓ |
| Delete Recurring | DELETE `/api/wallet/recurring-payments/:id` | DELETE `/api/v1/wallets/payments/recurring/:id` | DELETE | Updated ✓ |
| Bill Split | POST `/api/wallet/bill-split` | POST `/api/v1/wallets/payments/split` | POST | Updated ✓ |
| Vouchers | GET `/api/wallet/vouchers` | GET `/api/v1/wallets/payments/vouchers` | GET | Updated ✓ |
| Redeem | POST `/api/wallet/vouchers/:id/redeem` | POST `/api/v1/wallets/payments/vouchers/:id/redeem` | POST | Updated ✓ |
| History| GET `/api/wallet/history` | GET `/api/v1/wallets/payments/history` | GET | Updated ✓ |

### Transfers
| Feature | Legacy Route | V1 Route | Method | Status |
|---------|-------------|----------|--------|--------|
| Send Native | POST `/api/wallet/send-native` | POST `/api/v1/wallets/:walletId/transfers/native` | POST | Updated ✓ |
| Send Token | POST `/api/wallet/send-token` | POST `/api/v1/wallets/:walletId/transfers/token` | POST | Updated ✓ |
| Transfer | POST `/api/wallet/transfers` | POST `/api/v1/wallets/:walletId/transfers` | POST | Updated ✓ |
| History | GET `/api/wallet/transfers/history` | GET `/api/v1/wallets/:walletId/transfers/history` | GET | Updated ✓ |
| Get Transfer | GET `/api/wallet/transfers/:id` | GET `/api/v1/wallets/:walletId/transfers/:transferId` | GET | Updated ✓ |

### Multisig (DAO Support)
| Feature | Legacy Route | V1 Route | Method | Status |
|---------|-------------|----------|--------|--------|
| Create Multisig | POST `/api/wallet/multisig/create` | POST `/api/v1/wallets/:daoId` | POST | Updated ✓ |
| List Multisigs | GET `/api/wallet/multisig` | GET `/api/v1/wallets/:daoId` | GET | Updated ✓ |
| Get Details | GET `/api/wallet/multisig/info` | GET `/api/v1/wallets/:daoId/:id` | GET | Updated ✓ |
| Approve Tx | POST `/api/wallet/multisig/approve` | POST `/api/v1/wallets/:daoId/:id/approve` | POST | Updated ✓ |
| Reject Tx | POST `/api/wallet/multisig/reject` | POST `/api/v1/wallets/:daoId/:id/reject` | POST | Updated ✓ |
| Pending | GET `/api/wallet/multisig/pending` | GET `/api/v1/wallets/:daoId/:id/pending` | GET | Updated ✓ |
| Manage Signers | POST `/api/wallet/multisig/signers` | POST `/api/v1/wallets/:daoId/:id/signers` | POST | Updated ✓ |
| List Signers | GET `/api/wallet/multisig/signers` | GET `/api/v1/wallets/:daoId/:id/signers` | GET | Updated ✓ |
| Config | PUT `/api/wallet/multisig/config` | PUT `/api/v1/wallets/:daoId/:id/config` | PUT | Updated ✓ |

### Setup & Initialization
| Feature | Legacy Route | V1 Route | Method | Status |
|---------|-------------|----------|--------|--------|
| Create Wallet | POST `/api/wallet-setup/create` | POST `/api/v1/wallets/setup/create` | POST | Updated ✓ |
| Create Mnemonic | POST `/api/wallet-setup/create/mnemonic` | POST `/api/v1/wallets/setup/create/mnemonic` | POST | Updated ✓ |
| Import | POST `/api/wallet-setup/import` | POST `/api/v1/wallets/setup/import` | POST | Updated ✓ |
| Import Private Key | POST `/api/wallet-setup/import/private-key` | POST `/api/v1/wallets/setup/import/private-key` | POST | Updated ✓ |
| Recover | POST `/api/wallet-setup/recover` | POST `/api/v1/wallets/setup/recover` | POST | Updated ✓ |
| Restore | POST `/api/wallet-setup/restore` | POST `/api/v1/wallets/setup/restore` | POST | Updated ✓ |
| Backup Confirm | POST `/api/wallet-setup/backup/confirm` | POST `/api/v1/wallets/setup/backup/confirm` | POST | Updated ✓ |
| Backup Status | GET `/api/wallet-setup/backup/status/:userId` | GET `/api/v1/wallets/setup/backup/status/:userId` | GET | Updated ✓ |
| Backup Export | GET `/api/wallet-setup/backup/export` | GET `/api/v1/wallets/setup/backup/export` | GET | Updated ✓ |
| Backup Data | GET `/api/wallet-setup/backup/data` | GET `/api/v1/wallets/setup/backup/data` | GET | Updated ✓ |
| Vault Init | POST `/api/wallet-setup/vault/initialize` | POST `/api/v1/wallets/setup/vault/initialize` | POST | Updated ✓ |
| Assets Init | POST `/api/wallet-setup/assets/initialize` | POST `/api/v1/wallets/setup/assets/initialize` | POST | Updated ✓ |
| Set PIN | POST `/api/wallet-setup/pin` | POST `/api/v1/wallets/setup/pin` | POST | Updated ✓ |
| Unlock | POST `/api/wallet-setup/unlock` | POST `/api/v1/wallets/setup/unlock` | POST | Updated ✓ |
| Logout | POST `/api/wallet-setup/logout` | POST `/api/v1/wallets/setup/logout` | POST | Updated ✓ |
| Vaults | GET `/api/wallet-setup/vaults/:userId` | GET `/api/v1/wallets/setup/vaults/:userId` | GET | Updated ✓ |
| List | GET `/api/wallet-setup/list` | GET `/api/v1/wallets/setup/list` | GET | Updated ✓ |

### Savings
| Feature | Legacy Route | V1 Route | Method | Status |
|---------|-------------|----------|--------|--------|
| Create Savings | POST `/api/wallet/savings/create` | POST `/api/v1/wallets/:walletId/savings` | POST | Updated ✓ |
| List Savings | GET `/api/wallet/savings` | GET `/api/v1/wallets/:walletId/savings` | GET | Updated ✓ |
| Deposit | POST `/api/wallet/savings/:id/deposit` | POST `/api/v1/wallets/:walletId/savings/:id/deposit` | POST | Updated ✓ |

---

## Frontend Implementation Changes

### Before (Legacy)
```typescript
// Get wallet balance
const response = await fetch('/api/wallet/balance/:address', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});

// Send token
const response = await fetch('/api/wallet/send-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ recipient, amount, tokenSymbol })
});
```

### After (V1)
```typescript
// Get wallet balance
const response = await fetch('/api/v1/wallets/:walletId/balance', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});

// Send token
const response = await fetch('/api/v1/wallets/:walletId/transfers/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ recipient, amount, tokenSymbol, contractAddress })
});
```

---

## Key Changes

### 1. **Wallet ID Parameter**
- Add `:walletId` parameter to most routes
- Extracted from wallet selection or context state

### 2. **DAO Support (Multisig)**
- Multisig routes now include `:daoId` parameter
- Enables multi-tenant DAO functionality

### 3. **Nested Resource Paths**
- Balance endpoints grouped under `/balance/*`
- Sessions under `/sessions/*`
- Transfers under `/transfers/*`
- Setup operations under `/setup/*`
- Payments operations under `/payments/*`

### 4. **Enhanced Response Structure**
All endpoints now return consistent response format:
```typescript
{
  success: boolean;
  data: T;
  _links?: {  // HATEOAS links
    self: string;
    list?: string;
    create?: string;
  };
  message?: string;
  code?: string;
  error?: string;
}
```

---

## Testing Checklist

- [ ] Update all `/api/wallet*` fetch calls to `/api/v1/wallets*`
- [ ] Add `:walletId` parameter to balance, sessions, transfers routes
- [ ] Add `:daoId` parameter to multisig operations
- [ ] Test authentication still works (isAuthenticated middleware)
- [ ] Test wallet ownership verification (walletOwnershipGuard)
- [ ] Test rate limiting constraints
- [ ] Verify error responses match new format
- [ ] Update API documentation and SDK if applicable
- [ ] Test with postman/REST client
- [ ] Integration testing with UI

---

## Files to Update

### Components Using Legacy Routes:
1. `client/src/components/wallet/WalletSetup.tsx` - Setup endpoints
2. `client/src/components/wallet/ExchangeRateWidget.tsx` - Balance endpoints
3. `client/src/components/wallet/RecurringPayments.tsx` - Payment endpoints
4. `client/src/components/wallet/TransactionHistory.tsx` - Transfer history
5. `client/src/components/wallet/WalletConnectionManager.tsx` - Session endpoints
6. `client/src/pages/wallet.tsx` - Main wallet page API calls

### Services Using Legacy Routes:
1. `client/src/lib/api.ts` or similar API client service
2. Any custom API hooks or utilities

---

## Rate Limiting Update

### V1 Wallets Rate Limits:
- **Core Wallet CRUD**: 50 req/hour
- **Balance Queries**: 100 req/hour  
- **Sessions**: 30 req/hour
- **Payments**: 50 req/hour
- **Recurring Payments**: 10 req/hour
- **Multisig**: 20 req/hour
- **Multisig Signatures**: 50 req/min (time-sensitive)
- **Transfers**: 5 req/min

See [multisig.ts](server/routes/v1/wallets/multisig.ts) for detailed rate limiter config.

---

## Support & Questions

- Refer to endpoint docstrings in each router file
- See [index.ts](server/routes/v1/wallets/index.ts) for route composition
- Check middleware files for authentication/authorization details
- Reference [walletValidation.ts](server/middleware/walletValidation.ts) for ownership guard

