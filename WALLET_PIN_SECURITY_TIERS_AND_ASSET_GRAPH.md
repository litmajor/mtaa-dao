# Wallet PIN Security Tiers & Asset Graph Integration

## Overview

This document explains the multi-tiered PIN security model for wallets and how it integrates with the asset graph system to provide context-aware transaction approval and multi-chain asset visibility.

## 🔐 PIN Security Tiers

The wallet security model uses **three distinct security tiers** based on transaction scope and risk level:

### **Tier 1: PIN Only (Quick Access) - Standard Operations**

**What it protects:** Session login and quick access
- User unlocks wallet with PIN
- Creates 24-hour wallet session (auto-extends on activity)
- Allows viewing balances across all chains
- Allows standard transfers and withdrawals
- Allows vault interactions (deposits, withdrawals)

**When it's used:**
```
User Flow: "I want to check my balance and make a normal transfer"
1. POST /api/wallet-setup/unlock-wallet { walletId, pinCode }
2. Client receives sessionToken and expiresAt
3. Include sessionToken in subsequent requests for 24 hours
4. Session auto-extends on activity
5. No password needed until session expires or manually logout
```

**Protection level:** Medium - PIN alone (4-8 digits with bcrypt hashing)

**Rate limits:** 3 attempts per hour (prevents brute force)

---

### **Tier 2: PIN + Private Key Signing - Large Transfers**

**What it protects:** High-value transfers over threshold
- Transfer amount > `approvalThreshold` (default: $5000)
- Requires both PIN verification AND private key signing
- Ensures both possession (PIN/session) and control (key) are confirmed
- Critical for multi-signature scenarios

**When it's used:**
```
User Flow: "I want to transfer $10,000 (above $5000 threshold)"
1. User has active PIN session (wallet sessionToken)
2. Client initiates transfer: POST /api/vault/transfer
3. System detects amount > approvalThreshold
4. Server requires additional verification:
   {
     sessionToken,  // Proves PIN unlock
     privateKeySignature, // Proves key possession
     transactionHash // What they're signing
   }
5. User must sign transaction with private key
6. Multi-party verification complete
7. Transfer proceeds with audit log: "large_transfer_pin_and_key_verified"
```

**Protection level:** HIGH - Requires 2-factor proof (PIN session + cryptographic signature)

**Security benefits:**
- Prevents wallet compromise via PIN theft alone
- Requires active access to private key
- Signing proves intent (can't be confused with permission)
- Audit trail shows both factors were used

---

### **Tier 3: Password + Private Key - Critical Operations**

**What it protects:** Maximum security operations
- Wallet recovery
- Importing new wallets
- Exporting private keys / recovery phrases
- Changing security settings (PIN, 2FA, withdrawal limits)
- Restoring from backup

**When it's used:**
```
User Flow: "I need to recover my wallet or change PIN"
1. User cannot use PIN for this (security requirement)
2. Must provide FULL password: POST /api/wallet-setup/unlock-wallet
   {
     walletId,
     pinCode: null, // NOT using PIN
     password: "full_password_required" // MUST provide password
   }
3. System verifies password against user account (bcrypt check)
4. Decrypts private key from walletPrivateKeys table
5. Allows backup/recovery operations
6. Session is "admin" mode with time limit (5 minutes)
7. Then reverts to normal PIN session
```

**Protection level:** CRITICAL - Requires authentication + key possession

**Security benefits:**
- Password proves account ownership
- Key possession proves wallet control
- Recovery operations logged with severity: "critical"
- Time-limited session (5 min) for safety

---

## 🏗️ Security Settings for Each Tier

```typescript
// walletSecuritySettings table
{
  walletId: "wallet_123",
  encryptedPin: "bcrypt_hash", // For Tier 1 & 2
  requiresPin: true,
  
  // Tier 2: Large transfer thresholds
  withdrawalLimit: "10000.00", // Max per transaction
  approvalThreshold: "5000.00", // Above this = require key signature
  requiresApprovalAboveThreshold: true, // Enforce Tier 2
  
  // Tier 3: Critical operations
  requiresBiometric: false, // Future: biometric for extra security
  twoFactorEnabled: false, // Future: 2FA for recovery operations
  
  // Audit
  lastModifiedAt: "2026-03-02T10:00:00Z",
  lastAccessedAt: "2026-03-02T10:15:00Z"
}
```

---

## 🔗 Asset Graph Integration

The wallet system is **deeply integrated** with the Asset Graph, which provides:

### **1. Multi-Chain Holdings Visibility**

When a user unlocks wallet with PIN, the system can immediately query:

```typescript
// After PIN unlock, client can call:
GET /api/discover/wallet-balance?walletAddress=0x1234...&chains=celo,ethereum,polygon

Response:
{
  "walletAddress": "0x1234...",
  "holdings": {
    "celo": {
      "chainId": 42220,
      "assets": [
        {
          "symbol": "CELO",
          "balance": "50.5",
          "valueUSD": 2525,
          "decimals": 18
        },
        {
          "symbol": "cUSD",
          "balance": "1000.00",
          "valueUSD": 1000,
          "decimals": 6
        }
      ]
    },
    "ethereum": {
      "chainId": 1,
      "assets": [
        {
          "symbol": "ETH",
          "balance": "1.5",
          "valueUSD": 2850,
          "decimals": 18
        },
        {
          "symbol": "USDC",
          "balance": "5000.00",
          "valueUSD": 5000,
          "decimals": 6
        }
      ]
    }
  },
  "totalValueUSD": 11375
}
```

### **2. Vault Holdings in Asset Context**

When a wallet holds vaults across chains, Asset Graph tracks all underlying assets:

```typescript
// Wallet structure
User → Wallet → Vaults
         ↓      ├─ Personal Vault (celo)
         ↓      │  └─ Holds: cUSD, CELO, cEUR
         ↓      └─ DAO Treasury Vault (ethereum)
         ↓         └─ Holds: ETH, USDC, WBTC

// Asset Graph discovers ALL holdings
{
  "walletId": "w_123",
  "token": "ETH",
  "chain": "ethereum",
  "source": "vault_position",
  "vaultId": "dao_treasury_v1",
  "balance": 10.5,
  "valueUSD": 19950
}
```

### **3. Yield Opportunities Detection**

Asset Graph tracks where vault assets can earn yield:

```typescript
// When wallet holds ETH in vault, Asset Graph finds:
{
  "symbol": "ETH",
  "chain": "ethereum",
  "currentPosition": {
    "type": "vault_holding",
    "amount": 10.5,
    "valueUSD": 19950
  },
  "yieldOpportunities": [
    {
      "protocol": "Aave",
      "apy": 3.2,
      "riskLevel": "low",
      "action": "Users can move ETH to Aave for 3.2% APY"
    },
    {
      "protocol": "Curve",
      "apy": 12.5,
      "riskLevel": "medium",
      "action": "Users can move ETH to Curve LP for 12.5% APY"
    }
  ]
}
```

### **4. Cross-Chain Risk Assessment**

Asset Graph tracks concentration risk across chains:

```typescript
// Treasury Intelligence aggregates across all vaults
{
  "wallet": "0x1234...",
  "exposureByChain": {
    "celo": {
      "usdValue": 5000,
      "assetCount": 4,
      "dominantAsset": "cUSD",
      "weightInPortfolio": 45
    },
    "ethereum": {
      "usdValue": 6000,
      "assetCount": 3,
      "dominantAsset": "USDC",
      "weightInPortfolio": 55
    }
  },
  "chainConcentration": 0.55, // 0-1 scale, higher = more concentrated
  "riskAssessment": "BALANCED - 45/55 split healthy"
}
```

---

## 🔄 Wallet → Asset Graph → Vault Flow

```
User Action (PIN Unlock)
        ↓
    Wallet Session Created
        ↓
    User views "My Holdings"
        ↓
    Asset Discovery Service activates:
        • Query wallets at addresses
        • Scan chains: Celo, Ethereum, Polygon, Base
        • Query protocols: Aave, Curve, Moola, Uniswap
        • Aggregate all positions
        ↓
    Results returned to client:
        • Direct holdings (tokens in wallet)
        • Vault positions (funds in each vault)
        • Yield positions (LP tokens, lending positions)
        • Debt positions (if any loans)
        ↓
    Client displays unified view:
        "You have $15,000 across 3 chains"
        "Earning $50/day in yield"
        "0 active loans"
```

---

## 📊 Implementation: PIN + Asset Graph Endpoints

### **1. Create Wallet with PIN Recommendation**

```typescript
POST /api/wallet-setup/create-wallet-mnemonic
{
  "currency": "cUSD",
  "wordCount": 12,
  "createWithPin": true  // NEW: prompt for PIN setup
}

Response:
{
  "wallet": {
    "id": "w_123",
    "address": "0x1234...",
    "mnemonicEncrypted": true
  },
  "securityRecommendation": {
    "message": "Set up PIN now to quickly access this wallet",
    "nextStep": "POST /set-pin with desired 4-8 digit PIN"
  },
  "assetGraphReady": true
}
```

### **2. Unlock Wallet with Integrated Asset Discovery**

```typescript
POST /api/wallet-setup/unlock-wallet
{
  "walletId": "w_123",
  "pinCode": "1234"
}

Response:
{
  "sessionToken": "...",
  "walletAddress": "0x1234...",
  "expiresAt": "2026-03-03T10:15:00Z",
  
  // Asset Graph immediately available
  "quickStats": {
    "totalValueUSD": 15000,
    "holdingsCount": 12,
    "chainsActive": 3,
    "yieldAPY": 8.5
  },
  
  "recommendedActions": [
    {
      "type": "move_to_yield",
      "asset": "USDC",
      "currentAmount": 5000,
      "opportunity": "Aave 4.5% APY",
      "estimatedDailyYield": 0.62
    }
  ]
}
```

### **3. Get Wallet Holdings via Asset Graph**

```typescript
GET /api/discover/wallet-holdings?sessionToken=...&includeYieldData=true

Response:
{
  "wallet": "0x1234...",
  "directHoldings": [
    {
      "symbol": "CELO",
      "chain": "celo",
      "amount": 50.5,
      "valueUSD": 2525,
      "source": "wallet_direct"
    }
  ],
  "vaultHoldings": [
    {
      "vaultId": "v_personal",
      "vaultName": "My Yield Vault",
      "chain": "celo",
      "assets": [
        {
          "symbol": "cUSD",
          "amount": 1000,
          "valueUSD": 1000,
          "underlyingYield": "3.5% APY"
        }
      ]
    }
  ],
  "portfolioStats": {
    "totalValue": 15000,
    "chainDistribution": { "celo": 55, "ethereum": 45 },
    "assetDistribution": { "stablecoins": 65, "ETH": 25, "CELO": 10 }
  }
}
```

### **4. Execute Large Transfer with Multi-Tier Verification**

```typescript
POST /api/vault/transfer
{
  "vaultId": "v_123",
  "recipient": "0x5678...",
  "amount": "7500", // Above $5000 threshold
  "sessionToken": "..." // From PIN unlock
}

System validation:
✓ Session token valid (PIN verified)
✓ Amount check: $7500 > $5000 threshold
→ Require Tier 2: PIN + Key Signature

Response (step 1):
{
  "requiresSignature": true,
  "unsignedTransaction": {
    "to": "0x5678...",
    "from": "0x1234...",
    "value": "7500",
    "nonce": 15,
    "gasLimit": 21000,
    "hash": "0xabc123..." // What to sign
  },
  "securityTier": 2,
  "message": "Large transfer detected. Please sign with private key to confirm."
}

Client signs transaction and sends back:
POST /api/vault/transfer-confirm
{
  "signedTransaction": "0x...",
  "sessionToken": "..."
}

Response (success):
{
  "success": true,
  "transactionHash": "0x...",
  "auditLog": {
    "action": "large_transfer_pin_and_key_verified",
    "timestamp": "2026-03-02T10:30:00Z",
    "tiers": ["pin_session", "key_signature"],
    "riskLevel": "mitigated"
  }
}
```

---

## 🛡️ Security Comparison Table

| Feature | Tier 1: PIN Only | Tier 2: PIN + Key | Tier 3: Password + Key |
|---------|------------------|-------------------|----------------------|
| **Use Case** | Session login, normal operations | Large transfers | Recovery, critical ops |
| **PIN Required** | ✅ Yes | ✅ Yes | ❌ No (password instead) |
| **Key Signature** | ❌ No | ✅ Yes | ✅ Yes |
| **Session Duration** | 24 hours | Per transaction | 5 minutes |
| **Rate Limit** | 3/hour | 10/day | 1/hour |
| **Audit Severity** | medium | medium-high | critical |
| **Risk Assessment** | LOW (simple access) | MEDIUM (must prove control) | HIGH (full account access) |
| **Typical Cost** | <1s | 2-3s (signing) | 1-2s (decryption) |

---

## 🔮 Future Enhancements

### **1. Biometric Tier**
```typescript
// Tier 2.5: PIN + Biometric for even faster large transfers
POST /api/vault/transfer
Requires: sessionToken + biometric scan
Benefits: Faster than key signature, still high security
```

### **2. Time-Locked Transactions**
```typescript
// For transfers above very large threshold ($50k+)
POST /api/vault/transfer-scheduled
{
  "amount": 50000,
  "executeAt": "2026-03-03T10:00:00Z", // 24h delay
  "sessionToken": "...",
  "multiSigRequired": true  // DAO treasury scenario
}
```

### **3. Wallet Device Binding**
```typescript
// PIN on Device A works, but:
// - Different device B requires password re-verification
// - Prevents stolen PIN from working elsewhere
setup: {
  "requiresDeviceBinding": true,
  "deviceFingerprint": "sha256(deviceInfo)"
}
```

### **4. Smart Contract Wallets**
```typescript
// Safe-style (Gnosis Safe) compatible setup
{
  "walletType": "smart_contract",
  "signers": ["0x1234...", "0x5678..."],
  "threshold": 2, // 2-of-3 multisig
  "pinProtectsThreshold": true // PIN required to approve
}
```

---

## 🧪 Testing Scenarios

### **Scenario 1: User creates wallet and sets PIN**
```bash
# 1. Create wallet with mnemonic
POST /api/wallet-setup/create-wallet-mnemonic
{ "currency": "cUSD", "wordCount": 12 }
→ Returns: { wallet: { id, address }, credentials: { mnemonic, privateKey } }

# 2. Set PIN for quick access
POST /api/wallet-setup/set-pin
{ "walletId": "w_123", "currentPassword": "pwd", "newPin": "1234" }
→ Returns: { success: true }

# 3. Verify PIN by unlocking
POST /api/wallet-setup/unlock-wallet
{ "walletId": "w_123", "pinCode": "1234" }
→ Returns: { sessionToken, expiresAt }

# 4. Use session to view holdings
GET /api/discover/wallet-holdings?sessionToken=...
→ Returns: { directHoldings, vaultHoldings, portfolioStats }
```

### **Scenario 2: Large transfer with Tier 2 security**
```bash
# 1. User has PIN session
sessionToken = "..." (from unlock-wallet PIN)

# 2. Initiate $7500 transfer (above $5000 threshold)
POST /api/vault/transfer
{
  "vaultId": "v_123",
  "amount": "7500",
  "sessionToken": "..."
}
→ Returns: { requiresSignature: true, unsignedTransaction }

# 3. Client signs transaction with private key
signed = signTransaction(unsignedTransaction, privateKey)

# 4. Confirm transfer
POST /api/vault/transfer-confirm
{
  "signedTransaction": signed,
  "sessionToken": "..."
}
→ Returns: { success: true, transactionHash }

# Audit log shows: Tier 1 (PIN) + Tier 2 (Key) verified
```

### **Scenario 3: Wallet recovery with Tier 3 security**
```bash
# User lost phone but has password

# 1. Request recovery (no session)
POST /api/wallet-setup/recover-wallet
{ "walletId": "w_123", "password": "full_password" }
→ Returns: { status: "recovery_initiated", backupDataNeed: "recovery_phrase" }

# 2. Provide recovery phrase
POST /api/wallet-setup/recover-wallet-confirm
{
  "walletId": "w_123",
  "recoveryPhrase": "word1 word2 ...",
  "sessionToken": "recovery_mode_token"
}
→ Returns: { recovered: true, newSessionToken }

# 3. Set new PIN
POST /api/wallet-setup/set-pin
{ "walletId": "w_123", "currentPassword": "...", "newPin": "5678" }

# Audit log shows Tier 3: password verified + key recovered
```

---

## Summary

The PIN-based wallet security system provides **three distinct security tiers**:

1. **PIN Only** (Quick Access) - Fast daily access with 24h session
2. **PIN + Key** (Large Transfers) - High-value transfers require cryptographic proof
3. **Password + Key** (Critical) - Recovery and critical ops require account ownership + key possession

The system is **deeply integrated with Asset Graph**, enabling:
- **Multi-chain holdings visibility** immediately after PIN unlock
- **Yield opportunity detection** for all vault assets
- **Risk assessment** across chains and protocols
- **Recommendation engine** suggesting where to move assets for better returns

This creates a seamless experience where users authenticate once with PIN, then get immediate visibility into their entire portfolio across all chains and vaults.
