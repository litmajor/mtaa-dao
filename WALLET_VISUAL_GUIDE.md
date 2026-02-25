# Wallet Visual Guide - Complete User Flow

## Overview
The wallet system provides a comprehensive interface for deposits, withdrawals, vault management, transaction history, and security controls with real vault data integration.

---

## Main Wallet Dashboard (Desktop - 1440px+)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              WALLET DASHBOARD                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Vault] [Deposit/Withdraw] [Portfolio] [Monitor] [History] [Advanced]     │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 💰 YOUR PERSONAL VAULT (2025 Edition)                                 │ │
│  │                                                                        │ │
│  │  🌙  [Pin Configured Badge]  [2FA Enabled Badge]                      │ │
│  │                                                                        │ │
│  │  Vaults: 3  │  Personal: 2  │  DAO: 1  │  Multisig: 0               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │ 📊 VAULT BALANCE CARD    │  │ 🔄 SEND/RECEIVE CARD    │                 │
│  ├──────────────────────────┤  ├──────────────────────────┤                 │
│  │                          │  │                          │                 │
│  │ Personal Vault           │  │ Your Receive Address:    │                 │
│  │ ┌──────────────────────┐ │  │                          │                 │
│  │ │     $125,500 USD     │ │  │ 0x742d35Cc6634C0532925  │                 │
│  │ └──────────────────────┘ │  │ a69b4E6d1d4f78E9...     │                 │
│  │                          │  │                          │                 │
│  │ APY Breakdown:           │  │ ┌──────────────────────┐ │                 │
│  │ ├─ USDC:  5.2%           │  │ │ [Copy]  [QR Code]    │ │                 │
│  │ ├─ CELO:  8.1%           │  │ └──────────────────────┘ │                 │
│  │ └─ ETH:   3.7%           │  │                          │                 │
│  │                          │  │ [Send Funds]             │                 │
│  │ 🔄 [Refresh] [Deposit]   │  │ [Request Payment]        │                 │
│  │    [Withdraw]            │  │ [Split Bill]             │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ 📈 DEPOSIT / WITHDRAW FLOW                                              │ │
│  ├──────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  [Deposit]  [Withdraw]  ← Toggle Flow Type                             │ │
│  │                                                                          │ │
│  │  Select Payment Method:                                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │ 📱 M-Pesa    │  │ 🏦 Bank      │  │ 💱 Exchange  │  │ ⛓️ Crypto  │ │ │
│  │  │              │  │ Transfer     │  │ Onramp       │  │ Transfer   │ │ │
│  │  │ 0%-2% Fee    │  │ 0.5%-1% Fee  │  │ 1%-3% Fee    │  │ Gas Fees   │ │ │
│  │  │ 2-5 mins     │  │ 1-2 hours    │  │ 5-15 mins    │  │ Varies     │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │ │
│  │                                                                          │ │
│  │  Enter Amount (KES):                                                   │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │ 50,000                                                         │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                          │ │
│  │  Fee: 0.5%-2%  •  Time: 1-2 hours                                      │ │
│  │                                                                          │ │
│  │  [Start Deposit]                                                       │ │
│  │                                                                          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ 📊 PORTFOLIO OVERVIEW                                                   │ │
│  ├──────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  Total Assets: $245,800  |  Monthly Return: 3.2%  |  Pending: 2       │ │
│  │                                                                          │ │
│  │  Portfolio Value (30 days)                                             │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │                         ╱╲                                    │   │ │
│  │  │  $250K ───────────╱────╱  ╲──────────────                     │   │ │
│  │  │                 ╱            ╲  ╱╲                            │   │ │
│  │  │  $240K ───────╱──────────────  ╲╱  ╲────────                 │   │ │
│  │  │             ╱                        ╲  ╱╲                    │   │ │
│  │  │  $230K ────╱──────────────────────────╲╱  ╲──────            │   │ │
│  │  │                                              ╲  ╱            │   │ │
│  │  │  $220K ────────────────────────────────────  ╲╱             │   │ │
│  │  │                                                              │   │ │
│  │  │  Nov 1      Nov 10      Nov 20      Nov 30                  │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Withdrawal Security Flow (Step-by-Step)

### Step 1: Select Vault & Amount
```
┌──────────────────────────────────────┐
│ 🏦 WITHDRAWAL MODAL                  │
├──────────────────────────────────────┤
│                                      │
│ Select Vault:                        │
│ ┌──────────────────────────────────┐ │
│ │ Growth Vault - USDC               │ │
│ │ Balance: $50,000                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Withdrawal Method:                   │
│ ⬤ M-Pesa  ○ Bank  ○ Wallet  ○ Swap  │
│                                      │
│ Amount (KES):                        │
│ ┌──────────────────────────────────┐ │
│ │ 50000                             │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ⚠️ Security Status:                  │
│ 🛡️ 2FA REQUIRED                     │
│ 🔐 PIN REQUIRED                     │
│                                      │
│ [Cancel]  [Proceed to Verification] │
│                                      │
└──────────────────────────────────────┘
```

### Step 2: 2FA Verification
```
┌──────────────────────────────────────┐
│ 🔐 2FA VERIFICATION REQUIRED          │
├──────────────────────────────────────┤
│                                      │
│ Enter 6-digit code from:             │
│ ⬤ SMS to +254***7890               │
│ ○ Email (hidden)                    │
│ ○ Authenticator App                 │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ [_] [_] [_] [_] [_] [_]          │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Attempt: 1 of 3                      │
│                                      │
│ [Use Backup Code]  [Resend OTP]     │
│                                      │
│ [Cancel]  [Verify]                  │
│                                      │
└──────────────────────────────────────┘
```

### Step 3: PIN Verification
```
┌──────────────────────────────────────┐
│ 🔑 PIN VERIFICATION                  │
├──────────────────────────────────────┤
│                                      │
│ Enter your 4-8 digit PIN             │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ • • • •                          │ │
│ └──────────────────────────────────┘ │
│                                      │
│ PIN Strength: ▰▰▰▰▱ Strong          │
│                                      │
│ Attempt: 2 of 3                      │
│                                      │
│ [Forgot PIN?]                        │
│                                      │
│ [Cancel]  [Verify]                  │
│                                      │
└──────────────────────────────────────┘
```

### Step 4: Withdrawal Complete
```
┌──────────────────────────────────────┐
│ ✅ WITHDRAWAL INITIATED               │
├──────────────────────────────────────┤
│                                      │
│ Amount: 50,000 KES                   │
│ Method: M-Pesa                       │
│ Status: Processing                   │
│                                      │
│ ⏱️ Expected Time: 2-5 minutes        │
│ 🔗 Transaction Hash:                 │
│    0x742d35Cc6634...                 │
│                                      │
│ Verification: ✅ 2FA  ✅ PIN         │
│                                      │
│ You can now close this window.       │
│                                      │
│ [View Details]  [Close]              │
│                                      │
│ 📧 Confirmation sent to your email   │
│                                      │
└──────────────────────────────────────┘
```

---

## Transaction History Page

```
┌──────────────────────────────────────────────────────────────┐
│ TRANSACTION HISTORY                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Search: [___________________]  Filter: [All ▼]  [30d ▼]    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ↓ Nov 22, 2024                                               │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ ↑ WITHDRAWAL  [Completed]  [🛡️ 2FA Verified]  🔐 PIN   │  │
│ │                                                        │  │
│ │ Withdrawn from Growth Vault to M-Pesa                │  │
│ │ Nov 22, 2024 at 3:45 PM                              │  │
│ │                                                        │  │
│ │ Amount: -50,000 KES                                  │  │
│ │ ≈ 385 cUSD  |  ≈ 3,200 USDC                          │  │
│ │                                                        │  │
│ │ Gas: 0.5 CELO  |  Hash: 0x742d...                    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ↓ Nov 20, 2024                                               │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ ↓ DEPOSIT  [Completed]                                 │  │
│ │                                                        │  │
│ │ Deposited via Bank Transfer                           │  │
│ │ Nov 20, 2024 at 10:30 AM                              │  │
│ │                                                        │  │
│ │ Amount: +10,000 KES                                   │  │
│ │ ≈ 77 cUSD  |  ≈ 640 USDC                              │  │
│ │                                                        │  │
│ │ Hash: 0x894a...                                       │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ↓ Nov 18, 2024                                               │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ ↔️  TRANSFER  [Completed]                              │  │
│ │                                                        │  │
│ │ Sent to 0x842f... (Personal Vault)                    │  │
│ │ Nov 18, 2024 at 8:15 PM                               │  │
│ │                                                        │  │
│ │ Amount: -5,000 KES                                    │  │
│ │ ≈ 38.5 cUSD  |  ≈ 320 USDC                            │  │
│ │                                                        │  │
│ │ Hash: 0x1f3e...                                       │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ [Load More]                                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Mobile Wallet Layout (320px - 767px)

```
┌──────────────────────────────┐
│ WALLET                       │
│ [Vault][Deposit][History]   │
├──────────────────────────────┤
│                              │
│ 💰 PERSONAL VAULT            │
│ 🔐 PIN Configured            │
│ 🛡️ 2FA Enabled               │
│                              │
│ ┌──────────────────────────┐ │
│ │ $125,500                 │ │
│ │ ↑ +$125 (30d)            │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 📈 PORTFOLIO             │ │
│ │ 30-day Chart             │ │
│ │ [Mini Line Chart]        │ │
│ │ $245,800 ↑3.2%           │ │
│ └──────────────────────────┘ │
│                              │
│ [Deposit] [Withdraw] [Send]  │
│                              │
│ 📊 BALANCES BY ASSET         │
│ ┌──────────────────────────┐ │
│ │ USDC  $150,000 (61%)    │ │
│ │ ▰▰▰▰▰▰▱▱▱▱              │ │
│ │                          │ │
│ │ CELO  $65,000 (26%)     │ │
│ │ ▰▰▰▱▱▱▱▱▱▱              │ │
│ │                          │ │
│ │ ETH   $30,800 (13%)     │ │
│ │ ▰▱▱▱▱▱▱▱▱▱              │ │
│ └──────────────────────────┘ │
│                              │
│ 📋 RECENT ACTIVITY           │
│ ┌──────────────────────────┐ │
│ │ ↑ Withdrawal             │ │
│ │ 50,000 KES (M-Pesa)     │ │
│ │ Nov 22  ✅ 2FA  🔐 PIN   │ │
│ │                          │ │
│ │ ↓ Deposit                │ │
│ │ +10,000 KES (Bank)      │ │
│ │ Nov 20  ✅ Completed    │ │
│ │                          │ │
│ │ ↔️ Transfer              │ │
│ │ 5,000 KES (Personal)    │ │
│ │ Nov 18  ✅ Completed    │ │
│ │                          │ │
│ │ [View All Transactions]  │ │
│ └──────────────────────────┘ │
│                              │
│ 🔄 RECEIVE MONEY             │
│ ┌──────────────────────────┐ │
│ │ Address:                 │ │
│ │ 0x742d35Cc6634C05329...  │ │
│ │                          │ │
│ │ [Copy]  [QR Code]        │ │
│ └──────────────────────────┘ │
│                              │
└──────────────────────────────┘
```

---

## Real Data Integration

### API Endpoints
- `GET /api/wallets` - Fetch user's vaults with balances
- `GET /api/2fa/config` - Check 2FA/PIN status
- `POST /api/2fa/generate` - Generate OTP
- `POST /api/2fa/verify` - Verify OTP
- `POST /api/pin/verify` - Verify PIN
- `POST /api/withdrawals/verify-2fa` - Execute withdrawal
- `GET /api/transactions` - Fetch transaction history

---

## Security Badges

### 2FA Enabled
```
🛡️ 2FA ENABLED
├─ Method: SMS
├─ Last Used: 2 mins ago
└─ Change Method
```

### PIN Configured
```
🔐 PIN CONFIGURED
├─ Set: Nov 15, 2024
└─ Change PIN
```

