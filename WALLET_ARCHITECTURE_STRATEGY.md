# MTAA DAO - Wallet Architecture & User Control Strategy

## Overview

The wallet system needs to be **user's PRIMARY self-custody wallet**, while the platform manages **specialized accounts** for different purposes (trading, escrow, vault). This is the correct architecture for maximum user control and security.

---

## Current Architecture (Existing Implementation)

### 1. **MTAA Primary Wallet** ✅ (Self-Custody)
**Location**: `wallet-setup.ts` (865 lines)

**How It Works:**
```
User → Creates/Imports Wallet → Mnemonic (12 or 24 words) → Encrypted in DB
                                    ↓
                            Private Key Derived
                                    ↓
                        Blockchain Wallet Address
```

**Key Features:**
- **User owns the mnemonic** (can export and recover elsewhere)
- **Encrypted private key** stored in database
- **Multi-chain support**: Ethereum, Celo, Polygon, Solana, etc.
- **Password-protected** encryption
- **Self-hosted recovery phrase backup**

**Current Implementation:**
```typescript
// User creates wallet with mnemonic
POST /api/wallet-setup/create-wallet-mnemonic
Response: {
  mnemonic: "word1 word2 word3..." (12-24 words),
  address: "0x...",
  publicKey: "...",
  encrypted: true
}

// User can recover/import from mnemonic
POST /api/wallet-setup/recover-wallet-mnemonic
Body: { mnemonic: "..." }
```

**Database Storage:**
```typescript
users {
  id: UUID,
  encryptedWallet: encrypted_data,    // AES-256-GCM encrypted
  walletSalt: unique_salt,
  walletIv: initialization_vector,
  walletAuthTag: authentication_tag,
  hasBackedUpMnemonic: boolean
}
```

---

## System Architecture (Three Separate Layers)

### Layer 1: MTAA Primary Wallet (User's Self-Custody)
```
┌─────────────────────────────────────────────────────────┐
│          USER'S PRIMARY WALLET (SELF-CUSTODY)           │
├─────────────────────────────────────────────────────────┤
│ • User's mnemonic (backup phrase)                       │
│ • Private key encrypted in DB                           │
│ • Full control over funds                               │
│ • Can export private key anytime                        │
│ • Multi-chain addresses derived from same mnemonic      │
└─────────────────────────────────────────────────────────┘
        ↑                     ↑                  ↑
        │                     │                  │
   [Deposits]          [Withdrawals]         [Direct Use]
   (On-Ramps)          (Off-Ramps)           (Own Wallet)
```

**User's Wallet Addresses Across Chains:**
- `0x... (Ethereum)` — Derived from HD wallet path m/44'/60'/0'/0/0
- `0x... (Celo)` — Derived from HD wallet path m/44'/52752'/0'/0/0
- `0x... (Polygon)` — Derived from HD wallet path m/44'/137'/0'/0/0
- `SOL_ADDRESS (Solana)` — Derived from HD wallet path m/44'/501'/0'/0/0

---

### Layer 2: Internal Trading Account (DEX Integration)
```
┌──────────────────────────────────────────────────────────┐
│    INTERNAL TRADING ACCOUNT (Platform-Managed)           │
├──────────────────────────────────────────────────────────┤
│ • Routes on platform DEX (Uniswap, Curve, etc)          │
│ • User approves token spending                           │
│ • Transactions signed by USER'S private key              │
│ • Platform executes routes on behalf of user             │
│ • All funds stay in user's wallet                        │
└──────────────────────────────────────────────────────────┘
```

**How Trading Works:**
```
1. User wants to swap USDC → BTC
2. Platform generates swap route (e.g., USDC → ETH → BTC)
3. User approves token spending in wallet (one-time per token)
4. Platform submits transaction signed by user's private key
5. DEX executes swap
6. Funds arrive in user's wallet directly
```

**No CEX Credentials Stored:**
- Users do NOT give platform their CEX API keys
- Users do NOT sign up for CEX accounts through platform
- Platform never holds user funds directly
- Transactions are **peer-to-DEX**, not peer-to-platform

---

### Layer 3: Escrow System (Separate Smart Contract)
```
┌──────────────────────────────────────────────────────────┐
│       ESCROW CONTRACTS (Third-Party Transfers)           │
├──────────────────────────────────────────────────────────┤
│ • Multi-sig escrow for payments between users            │
│ • Milestone-based release                               │
│ • Dispute resolution                                    │
│ • Can be peer-to-peer or peer-to-platform               │
│ • User's funds in escrow, then released                 │
└──────────────────────────────────────────────────────────┘
```

**How Escrow Works:**
```
1. Payer creates escrow with recipient
2. Payer transfers funds to escrow contract
3. Escrow holds funds (multi-sig: payer + payee + platform)
4. Milestones completed
5. Payee approves release
6. Funds transferred to payee's wallet
```

---

## Decision Matrix: What to Store vs. What Users Control

| Feature | Responsibility | Location | Security |
|---------|-----------------|----------|----------|
| **Mnemonic (Recovery Phrase)** | User backs up | User keeps safe | User's responsibility |
| **Private Key** | Platform stores encrypted | Database (AES-256-GCM) | Encrypted at rest |
| **Public Address** | Both | Database + blockchain | Public knowledge |
| **CEX API Keys** | Users don't provide | N/A | Not implemented |
| **Trading Approvals** | User signs via wallet | Blockchain | Signed by user |
| **Escrow Deposits** | User initiates | Smart contract | Smart contract manages |
| **Vault Deposits** | User initiates | Smart contract | Smart contract manages |
| **Pool Stakes** | User initiates | Smart contract | Smart contract manages |

---

## Architecture Diagram: Complete Money/Asset Flow

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         USER REGISTRATION                                 │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ↓
        ┌──────────────────────────────────────────┐
        │   Create/Import MTAA Wallet              │
        │   ├─ Generate 12/24 word mnemonic        │
        │   ├─ Derive multi-chain addresses        │
        │   ├─ Encrypt private key (AES-256-GCM)   │
        │   └─ User backs up mnemonic              │
        └──────────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ↓                     ↓
        ┌─────────────────────┐ ┌──────────────────┐
        │  DEPOSIT (On-Ramp)  │ │  IMPORT EXISTING │
        │                     │ │    CEX WALLET    │
        │ • Flutterwave       │ │                  │
        │ • Paystack          │ │ (API keys stay   │
        │ • Paychant          │ │  with user/CEX)  │
        │ • Kotani            │ │                  │
        │ • M-Pesa            │ │ (Not via MTAA)   │
        │ • Airtel            │ │                  │
        │ • Onramper          │ │                  │
        │                     │ │                  │
        │ Funds → User Wallet │ │ No CEX accounts  │
        └─────────────────────┘ │ needed here      │
                │               └──────────────────┘
                │
                └──────────────────────────┬─────────────────────┐
                                           │                     │
                                    ┌──────↓──────────┐    ┌─────↓─────────┐
                                    │  SWAP (DEX)     │    │  DIRECT HOLD  │
                                    │                 │    │               │
                                    │ Platform routes │    │ • Earn from   │
                                    │ swaps, user     │    │   staking     │
                                    │ signs           │    │ • Send to     │
                                    │                 │    │   others      │
                                    │ Example:        │    │ • Spend       │
                                    │ USDC→BTC→ETH    │    │               │
                                    │                 │    │               │
                                    │ Funds stay in   │    │               │
                                    │ user wallet     │    │               │
                                    └────────┬────────┘    │               │
                                             │             │               │
        ┌────────────────┬────────────────────┼─────────────┼────────────────┐
        │                │                    │             │                │
        ↓                ↓                    ↓             ↓                ↓
   ┌─────────┐   ┌──────────────┐   ┌──────────────┐  ┌────────┐    ┌────────────┐
   │  VAULT  │   │    POOLS     │   │   TRADES     │  │ ESCROW │    │ WITHDRAW   │
   │         │   │              │   │              │  │        │    │ (Off-Ramp) │
   │ 4-15%   │   │ 3-40% APY    │   │ 20-150% APY  │  │ P2P    │    │            │
   │ APY     │   │ (locked)     │   │ (automated)  │  │ or     │    │ Back to:   │
   │         │   │              │   │              │  │ P2Plat │    │ Fiat (via) │
   │ Keep    │   │ • 30 days    │   │ • Grid       │  │ form   │    │ Provider   │
   │ or      │   │ • 90 days    │   │ • DCA        │  │        │    │            │
   │ auto    │   │ • 180 days   │   │ • Arbitrage  │  │ Funds: │    │ -2-5% fee  │
   │ compound│   │              │   │ • Momentum   │  │        │    │ 1-3 days   │
   │         │   │ Get 3-8x     │   │ • Yield Rot  │  │ • In   │    │            │
   │ Yield   │   │ on APY       │   │ • Covered    │  │   Payer│    │ Funds to   │
   │ monthly │   │              │   │ • LP Hedge   │  │ • In   │    │ account    │
   │         │   │ Harvest any  │   │              │  │   Escrow     │            │
   │         │   │ time         │   │ Auto-stop    │  │ • Smart│    │            │
   │         │   │              │   │ loss limits  │  │   contract  │            │
   │         │   │              │   │              │  │        │    │            │
   └────┬────┘   └────┬─────────┘   └──────┬───────┘  └───┬────┘    └────────────┘
        │              │                    │             │
        └──────────────┴────────────────────┴─────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  PASSIVE INCOME STREAMS      │
        │                              │
        │ • Governance voting: $5/vote │
        │ • Referrals: 3-10% commission│
        │ • Contributions: $50-200/item│
        │ • Pool fees: 0.01-0.05%      │
        │ • MTAA staking: 2-5% APY     │
        │                              │
        │ Earned → User Wallet or      │
        │ Reinvest → Vault/Pools       │
        └──────────────────────────────┘
```

---

## Security Model

### User's Primary Wallet Security

**What User Controls:**
- ✅ Mnemonic phrase (recovery password)
- ✅ Wallet password (for local encryption)
- ✅ Private key (encrypted, can export)
- ✅ Signing transactions

**What Platform Controls:**
- ✅ Encryption keys (AES-256-GCM)
- ✅ Database storage
- ✅ Transaction monitoring
- ✅ Rate limiting

**Threat Models Covered:**
```
┌──────────────────────────────────────────────────────┐
│ Threat: Database Breach                              │
│ → Private keys encrypted with user password          │
│ → User's password NOT in database (JWT only)         │
│ → Attacker cannot decrypt without user's password    │
│ Risk Level: LOW (encrypted data is useless)          │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Threat: Platform Server Compromise                   │
│ → User can export private key and recover elsewhere  │
│ → User's funds safe on blockchain                    │
│ → Attacker can't move funds without mnemonic         │
│ Risk Level: LOW (funds on blockchain, not platform)  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Threat: User Loses Mnemonic                          │
│ → User can't recover wallet from blockchain alone    │
│ → Must have backup phrase (user's responsibility)    │
│ → Platform stores encrypted backup (optional)        │
│ Risk Level: MEDIUM (user responsible for backup)     │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Threat: CEX Compromise (Not Applicable)              │
│ → Users don't store CEX API keys on platform         │
│ → If user wants CEX, they manage directly            │
│ → Platform only does DEX swaps                       │
│ Risk Level: NONE (CEX not involved)                  │
└──────────────────────────────────────────────────────┘
```

---

## Implementation: MTAA Wallet as Primary

### Best Practice Architecture

```
TIER 1: USER'S PRIMARY WALLET (SELF-CUSTODY)
├─ Mnemonic: User backups
├─ Private Key: Encrypted in database
├─ Signing: User's signature required
└─ Control: User owns 100%

TIER 2: PLATFORM ACCOUNTS (INTERNAL ROUTING)
├─ Vault Account: User deposits, platform routes to DeFi
├─ Trading Account: User signs DEX transactions
├─ Escrow Account: User deposits for P2P payments
└─ Savings Account: Auto-compound staking rewards

TIER 3: BLOCKCHAIN (PUBLIC LEDGER)
├─ All transactions signed by user's private key
├─ All funds in user's addresses
├─ Platform never holds funds directly
└─ Smart contracts manage yields/escrows
```

### What NOT to Do

❌ **Don't create sub-accounts users don't control**
❌ **Don't ask users for CEX credentials** 
❌ **Don't require users to sign up with external CEX**
❌ **Don't hold funds in platform-owned addresses**
❌ **Don't create custodial wallets**

### What TO Do

✅ **Make MTAA wallet their primary**
✅ **Let users export private key anytime**
✅ **Users manage their own mnemonic backup**
✅ **Encrypt private keys with user password**
✅ **Sign all transactions with user's private key**
✅ **Store encrypted keys in database**
✅ **All funds on blockchain (not platform)**

---

## API Endpoints for Wallet Management

### Create/Recover Wallet
```bash
# Create new wallet
POST /api/wallet-setup/create-wallet-mnemonic
{
  "wordCount": 12,
  "password": "user_password"
}
Response: {
  "mnemonic": "word1 word2 ...",
  "address": "0x...",
  "networks": [
    { "chain": "ethereum", "address": "0x..." },
    { "chain": "celo", "address": "0x..." },
    { "chain": "solana", "address": "SOL..." }
  ]
}

# Recover existing wallet
POST /api/wallet-setup/recover-wallet-mnemonic
{
  "mnemonic": "word1 word2 ...",
  "password": "user_password"
}

# Export private key (user confirms with password)
POST /api/wallet-setup/export-private-key
{
  "password": "user_password"
}
Response: {
  "privateKey": "0x...",
  "address": "0x...",
  "warning": "Keep this safe. Anyone with this key can access your funds."
}
```

### View Addresses Across Chains
```bash
GET /api/wallet/addresses
Response: {
  "addresses": [
    { "chain": "ethereum", "address": "0x...", "balance": "1.5 ETH" },
    { "chain": "celo", "address": "0x...", "balance": "500 cUSD" },
    { "chain": "solana", "address": "SOL...", "balance": "10 SOL" }
  ]
}
```

---

## Trading: How CEX Connections Work (Future)

**Current**: Platform DEX only (Uniswap, Curve, etc)

**Future Option: User-Managed CEX**
```
If user wants to trade on centralized exchanges:

1. User goes to Binance/Kraken/FTX directly
2. User creates CEX account (their account)
3. User generates API key with restrictions:
   - ❌ No withdrawal permissions
   - ✅ Read balance only
   - ✅ Create orders only
4. User optionally shares API key with platform (optional, user chooses)
5. Platform can monitor or execute trades
6. User's funds never leave CEX
7. User can revoke API key anytime

PLATFORM NEVER STORES CEX CREDENTIALS
PLATFORM NEVER CREATES CEX ACCOUNTS FOR USERS
```

---

## Summary: Your Wallet Strategy

| Component | Owned By | Location | Purpose |
|-----------|----------|----------|---------|
| **MTAA Wallet** | User | Encrypted in DB | Primary self-custody wallet |
| **Mnemonic Phrase** | User | User backs up | Recovery + ownership proof |
| **Private Key** | User | DB (encrypted) | Signing transactions |
| **Trading Account** | Platform | Internal routing | DEX swap execution |
| **Escrow Account** | Both | Smart contract | P2P payments |
| **Vault Account** | User | DeFi smart contract | Yield farming |
| **CEX Account** | User (if any) | User's CEX | Optional external trading |

---

## Next Steps

1. **Current Implementation** ✅ Already done (wallet-setup.ts)
2. **Verify Private Key Export** ✅ **COMPLETED** - POST `/api/wallet-setup/export-private-key`
3. **Add Mnemonic Backup Download** ✅ **COMPLETED** - POST `/api/wallet-setup/export-encrypted-backup`
4. **Document Wallet Recovery** ✅ **COMPLETED** - See [WALLET_RECOVERY_IMPLEMENTATION.md](WALLET_RECOVERY_IMPLEMENTATION.md)
5. **No CEX Integration** → Users manage CEX separately (future optional feature)
6. **Platform owns ZERO user funds** → All DEX, vaults, pools use user's addresses

### Completed Features Documentation

All three recovery features are now **production-ready**:

- **Private Key Export**: Secure export with password verification and warnings
- **Mnemonic Backup Download**: Encrypted backup with AES-256-GCM + Scrypt
- **Wallet Recovery**: Restore from mnemonic or backup file with verification

See [WALLET_RECOVERY_IMPLEMENTATION.md](WALLET_RECOVERY_IMPLEMENTATION.md) for complete technical details, security model, client examples, and testing procedures.

---

**Created**: January 21, 2026  
**Purpose**: Define MTAA DAO wallet architecture as user's primary self-custody solution
