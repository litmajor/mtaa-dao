# Wallets ↔ Accounts Integration Guide

## Overview
Two complementary systems work together for complete fund management:

### **Wallets Table** 🔐 (Blockchain Layer)
Stores actual cryptocurrency wallet information:
- Wallet addresses on-chain (Celo, Ethereum, etc.)
- Private keys (encrypted)
- Seed phrases (encrypted)
- Public keys
- Wallet type (personal, dao, treasury, smart_contract)
- Security settings (PIN, 2FA, withdrawal limits)
- Access logs (audit trail)

**Purpose**: Connect to blockchain, send/receive external transactions

**Related Tables**:
- wallet_private_keys
- wallet_public_keys
- wallet_seed_phrases
- wallet_security_settings
- wallet_access_log
- wallet_transactions

---

### **Accounts Table** 💰 (Fund Management Layer)
Stores user's internal account structure:
- Account types: **wallet**, **trading**, **vault**, **escrow**
- Balance per account type
- Locked balance (for vault/escrow)
- Currency (USDC, USDT, cUSD, ETH, etc.)
- Status (active, suspended, closed)

**Purpose**: Organize funds by purpose, manage internal transfers

**Related Tables**:
- deposits (tracks inflows from external sources)
- withdrawals (tracks outflows to external destinations)
- internal_transfers (tracks movements between own accounts)

---

## Integration Flow

### Deposit Flow (External → Accounts)
```
External Source (Stripe, M-Pesa, External Wallet)
    ↓
Wallets Table (receives at wallet.address)
    ↓
Deposits Table (records deposit)
    ↓
Accounts Table - Wallet Account (balance increases)
    ↓
User can transfer to Trading/Vault/Escrow accounts
```

### Withdrawal Flow (Accounts → External)
```
Accounts Table - Source Account (wallet/trading/vault/escrow)
    ↓
Withdrawals Table (records withdrawal)
    ↓
Wallets Table (sends from wallet.address)
    ↓
External Destination (Stripe, External Wallet, Off-ramp)
```

### Internal Transfer Flow (Account → Account)
```
Accounts Table - Source Account (wallet/trading/vault)
    ↓
Internal Transfers Table (records transfer)
    ↓
Accounts Table - Destination Account (wallet/trading/vault/escrow)
    ↓
No blockchain interaction needed (instant, no fees)
```

---

## Database Schema Relationship

### Wallets Table Structure
```typescript
export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }),
  currency: varchar("currency").notNull(), // e.g., "USDC", "cUSD", "ETH"
  address: varchar("address").notNull().unique(), // Blockchain wallet address
  walletType: varchar("wallet_type").default("personal"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### Accounts Table Structure
```typescript
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  accountType: varchar("account_type").notNull(), // wallet, trading, vault, escrow
  balance: decimal("balance", { precision: 18, scale: 8 }).default("0"),
  locked: decimal("locked", { precision: 18, scale: 8 }).default("0"),
  currency: varchar("currency").default("USDC"),
  status: varchar("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

## Key Differences

| Aspect | Wallets | Accounts |
|--------|---------|----------|
| **Purpose** | Blockchain wallet storage | Fund management/organization |
| **Scope** | External transactions | Internal organization |
| **Blockchain** | Yes (has address) | No (virtual) |
| **Types** | personal, dao, treasury, smart_contract | wallet, trading, vault, escrow |
| **Balance** | Implicit (on blockchain) | Explicit (in DB) |
| **Security** | Private keys, encryption | Status, locking |
| **Multiple per User** | Typically 1-3 | Always 4 (wallet, trading, vault, escrow) |

---

## Current Implementation Status

### ✅ Wallets Exist
- `wallets` table defined in schema
- Related tables for security, keys, logs
- Integration points in contributionIndexerService
- **Currently empty** (0 records)

### ✅ Accounts Exist  
- `accounts` table created and verified
- 4 tables: accounts, deposits, withdrawals, internal_transfers
- API endpoints: `/api/accounts/*`
- Services: account-service, deposit-service, withdrawal-service, transfer-service

---

## API Integration Points

### For Deposits
```typescript
// 1. User initiates deposit via external source
POST /api/deposits/initiate

// 2. Funds arrive at wallet.address (on blockchain)
// 3. Webhook/listener detects transaction
// 4. Creates deposits record
// 5. Credits accounts[type="wallet"] table

// Result: User's wallet account balance increases
```

### For Withdrawals
```typescript
// 1. User selects source account (wallet/trading/vault/escrow)
POST /api/withdrawals/initiate

// 2. System validates sufficient balance in accounts table
// 3. Creates withdrawals record
// 4. Deducts from accounts table
// 5. Signs transaction from wallets.address
// 6. Submits to blockchain

// Result: Funds leave at wallet.address, external destination receives
```

### For Internal Transfers
```typescript
// 1. User selects source & destination accounts
POST /api/accounts/:id/transfer

// 2. System validates source account has sufficient balance
// 3. Creates internal_transfers record
// 4. Deducts from source account
// 5. Credits destination account
// 6. Both in accounts table (no blockchain involved)

// Result: Instant fund movement, no fees, no blockchain tx
```

---

## Implementation Checklist

### Wallets Layer (For Phase 2)
- [ ] Create user wallets (on signup/KYC)
- [ ] Generate wallet addresses (use Celo SDK or similar)
- [ ] Encrypt and store private keys
- [ ] Set up webhook listeners for incoming transactions
- [ ] Implement withdrawal signing logic
- [ ] Add wallet address to deposits flow
- [ ] Verify wallet security settings

### Accounts Layer (Phase 1 ✅ Complete)
- [x] Create accounts table
- [x] Create deposits/withdrawals/transfers tables
- [x] Implement account initialization (4 accounts per user)
- [x] Create API endpoints
- [x] Create services
- [ ] Connect deposits webhook to account crediting
- [ ] Connect withdrawal validation to account balance
- [ ] Connect internal transfers service

### Integration Points (For Phase 2)
- [ ] Link wallet.address to deposits flow
- [ ] Link withdrawal destination to wallet.address
- [ ] Sync account balances with blockchain (optional, for audit)
- [ ] Set up transaction listeners/webhooks
- [ ] Implement account-to-wallet reconciliation

---

## Summary

**Keep both tables active:**
- ✅ **Wallets** - For blockchain interaction (private keys, addresses)
- ✅ **Accounts** - For fund organization (balance tracking, internal transfers)

They are **not redundant**—they serve different purposes:
- Wallets = WHERE the funds are (on blockchain)
- Accounts = HOW the funds are organized (internally)

One user can have:
- **1 wallet** (1 blockchain address with 1 private key)
- **4 accounts** (wallet, trading, vault, escrow—all tracking the same blockchain wallet)

---

Generated: January 22, 2026
