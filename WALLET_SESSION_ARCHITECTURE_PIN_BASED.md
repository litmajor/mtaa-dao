# Dual-Tier Wallet Authentication Architecture

## Overview

**Two independent authentication layers** for users:
1. **App Session** (JWT) - Application-wide authentication
2. **Wallet Session** (PIN-based) - Wallet-specific access

Users can authenticate to the app and independently authenticate to individual wallets.

---

## Architecture Comparison

| Layer | Auth Method | Scope | Persistence | Use Case |
|---|---|---|---|---|
| **App Session** | JWT Token (OAuth/credentials) | Platform-wide | Entire session | Access app, manage account, switch wallets |
| **Wallet Session** | PIN (4-8 digits) | Single wallet | 24 hours | Quick access to specific wallet, stay logged in |

---

## Authentication Flows

### Flow 1: Initial Login
```
User logs into app
    ↓
JWT token issued (app session)
    ↓
User can view all wallets
    ↓
User selects wallet → wants to transact
    ↓
Requires wallet unlock
```

### Flow 2: PIN-Based Wallet Access (Recommended)
```
App Session Active (JWT valid)
    ↓
User hits /unlock-wallet with PIN
    ↓
PIN verified against walletSecuritySettings.encryptedPin
    ↓
walletSession created (24-hour expiry)
    ↓
sessionToken returned to client
    ↓
User stays logged in to that wallet
    ↓
Can make transactions using sessionToken
```

### Flow 3: Password-Based Full Access (For Key Material)
```
App Session Active (JWT valid)
    ↓
User hits /unlock-wallet with password
    ↓
Password decrypts wallet from walletPrivateKeys
    ↓
Returns privateKey + mnemonic (unencrypted)
    ↓
No session created - one-time key access
    ↓
User has control, can export/backup immediately
```

### Flow 4: Switch Wallets
```
Currently logged in: Wallet A (sessionToken: abc123)
    ↓
User selects Wallet B
    ↓
POST /unlock-wallet with walletId=B and PIN
    ↓
New sessionToken for Wallet B created
    ↓
Client switches: sessionToken = xyz789
    ↓
Wallet A session (abc123) remains valid but inactive
    ↓
Can switch back without re-auth
```

---

## Database Schema

### walletSecuritySettings
```typescript
{
  walletId: uuid,           // Foreign key to wallets
  requiresPin: boolean,     // true if PIN configured
  encryptedPin: text,       // SHA256 hash of PIN (TODO: use bcrypt)
  requiresBiometric: boolean,
  twoFactorEnabled: boolean,
  withdrawalLimit: decimal, // Daily withdrawal limit
  whitelistedAddresses: jsonb, // Array of approved addresses
  ...
}
```

### walletSessions (NEW - for PIN-based access)
```typescript
{
  id: uuid,
  walletId: uuid,           // Which wallet this session is for
  userId: varchar,          // Which user owns this session
  sessionToken: varchar,    // Unique token for this session
  isActive: boolean,        // true = currently used
  connectedAt: timestamp,   // When session created
  disconnectedAt: timestamp, // When session closed
  lastAccessedAt: timestamp,
  expiresAt: timestamp,     // 24 hours from creation
  autoExtendEnabled: boolean, // Extend on activity
  ipAddress: varchar,       // Device IP
  userAgent: varchar,       // Device info
  deviceId: varchar,        // Device identifier
  ...
}
```

---

## API Endpoints

### 1. POST /api/wallet-setup/set-pin
**Purpose:** Configure PIN for wallet sessions

**Request:**
```json
{
  "walletId": "uuid-of-wallet",
  "currentPassword": "user-wallet-password",
  "newPin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PIN configured successfully",
  "note": "You can now use PIN to quickly unlock your wallet"
}
```

**Security:**
- Requires current password (proves ownership)
- PIN hashed with SHA256 (upgrade to bcrypt)
- Stored in walletSecuritySettings table

---

### 2. POST /api/wallet-setup/unlock-wallet
**Purpose:** Unlock wallet with PIN or password

#### Option A: PIN-Based (Creates Session)
**Request:**
```json
{
  "userId": "user-id",
  "walletId": "wallet-id",
  "pinCode": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "walletSession": {
    "sessionToken": "hex-string",
    "walletId": "uuid",
    "walletAddress": "0x...",
    "expiresAt": "2026-03-03T12:00:00Z",
    "autoExtendEnabled": true
  },
  "authMethod": "PIN",
  "accessLevel": "read-write",
  "note": "Use this sessionToken to stay logged in..."
}
```

**Behavior:**
- Returns `sessionToken` (not key material)
- Session valid for 24 hours
- Auto-extends on activity
- Can switch to different wallet (new session)

#### Option B: Password-Based (Full Access)
**Request:**
```json
{
  "userId": "user-id",
  "password": "wallet-password"
}
```

**Response:**
```json
{
  "success": true,
  "wallet": {
    "address": "0x...",
    "privateKey": "...",
    "mnemonic": "..."
  },
  "authMethod": "password",
  "accessLevel": "full",
  "warning": "You have access to private key..."
}
```

**Behavior:**
- Returns unencrypted key material
- NO session created
- One-time full access
- For backup/recovery operations

---

### 3. POST /api/wallet-setup/wallet-logout
**Purpose:** End wallet session

**Request:**
```json
{
  "sessionToken": "hex-string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out from wallet"
}
```

**Behavior:**
- Closes specific wallet session
- Other wallet sessions remain active
- App session (JWT) continues

---

### 4. GET /api/wallet-setup/user-wallets
**Purpose:** List all wallets for user (wallet switching)

**Response:**
```json
{
  "success": true,
  "wallets": [
    {
      "id": "wallet-1-uuid",
      "address": "0x...",
      "currency": "cUSD",
      "walletType": "personal",
      "isActive": true,
      "createdAt": "2025-...",
      "isPinConfigured": true,
      "isCurrentlyActive": true
    },
    {
      "id": "wallet-2-uuid",
      "address": "0x...",
      "currency": "ETH",
      "walletType": "personal",
      "isPinConfigured": false,
      "isCurrentlyActive": false
    }
  ],
  "activeWalletId": "wallet-1-uuid",
  "currentSessionToken": "hex-...",
  "walletCount": 2,
  "maxWallets": 5,
  "message": "To switch wallets, use unlock-wallet endpoint..."
}
```

---

## Workflow: Complete User Journey

### Day 1: Initial Setup
```
1. User signs up → JWT token issued (app session)
2. POST /create-wallet-mnemonic → Wallet created, mnemonic + key returned
3. User saves mnemonic securely
4. POST /set-pin → PIN configured on wallet
```

### Day 2: Using Wallet
```
1. User logs in → JWT token valid
2. GET /user-wallets → Shows all wallets
3. Selects Wallet A
4. POST /unlock-wallet (PIN: 1234) → sessionToken issued
5. User can transact for 24 hours without re-entering PIN
6. Session auto-extends on activity
```

### Day 3: Multiple Wallets
```
1. App session still valid (JWT)
2. User wants to access Wallet B (different wallet)
3. POST /unlock-wallet with walletId=B + PIN
4. New sessionToken issued for Wallet B
5. Client switches to new token
6. Can switch back to Wallet A using old sessionToken
```

### Day 4: Recovery
```
1. User forgot PIN BUT remembers password
2. POST /unlock-wallet with password → Returns key material
3. Backup mnemonic again
4. POST /set-pin → Configure new PIN
```

---

## Security Properties

### ✅ PIN-Based Sessions
- PIN is 4-8 digits (hashed with SHA256, should be bcrypt)
- Session expires after 24 hours OR on logout
- Auto-extends on activity
- Can be used across multiple devices
- Only provides read-write access (not key material)
- Rate limited: 3 attempts/hour

### ✅ Password-Based Access
- Full access to privateKey + mnemonic
- Rate limited: 3 attempts/hour
- Logged as HIGH-severity audit event
- For backup/recovery only
- Should prompt user to set PIN for convenience

### ✅ Multi-Wallet Support
- Max 5 wallets per user
- Independent sessions per wallet
- Can have multiple active sessions simultaneously
- Logout from one wallet doesn't affect others

### ✅ Wallet Switching
- User can switch between wallets seamlessly
- New PIN unlock = new session
- Old sessions remain valid
- No need to re-authenticate to app (JWT still valid)

---

## Audit Logging

All wallet authentication events logged:

| Action | Severity | Trigger |
|---|---|---|
| `wallet_pin_configured` | Medium | PIN setup successful |
| `wallet_session_created_with_pin` | Medium | PIN unlock successful |
| `wallet_unlocked_full_key_access` | High | Password unlock (key material) |
| `wallet_unlock_pin_failed` | Medium | Invalid PIN (3/hour limit) |
| `wallet_unlock_failed_password` | Medium | Invalid password (3/hour limit) |
| `wallet_session_closed` | Low | User logout |
| `user_wallets_listed` | Low | User views wallet list |

---

## Rate Limiting

### PIN Attempts
- **3 attempts per hour per user** (per wallet)
- After 3 failures: 429 Too Many Requests + Retry-After: 3600

### Password Attempts
- **3 attempts per hour per user**
- After 3 failures: 429 Too Many Requests + Retry-After: 3600

### Wallet Operations
- Create wallet: 10/hour
- Change PIN: No specific limit (use password verification as guard)
- List wallets: No limit

---

## Future Enhancements

### Phase 2: Biometric Support
```typescript
// In walletSecuritySettings
biomet: boolean = true
biometricType: 'fingerprint' | 'face' | 'voice'
```

### Phase 3: Hardware Wallet Integration
```typescript
// Gnosis Safe / Ledger support
walletType: 'hardware_wallet'
contractAddress: '0x...'
```

### Phase 4: Stealth Addresses / Privacy
```typescript
// For each wallet - create multiple stealth addresses
stealthAddresses: [{
  mainAddress: '0x...',
  stealthAddress: '0x...',
  metadata: { purpose: 'privacy' }
}]
```

---

## Configuration Constants

```typescript
const MAX_WALLETS_PER_USER = 5;
const WALLET_SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const PIN_LENGTH_MIN = 4;
const PIN_LENGTH_MAX = 8;
const PIN_ATTEMPT_LIMIT = 3; // per hour
const PASSWORD_ATTEMPT_LIMIT = 3; // per hour
```

---

## Testing Scenarios

### Scenario 1: PIN Setup & Login
```bash
# 1. User creates wallet
POST /api/wallet-setup/create-wallet-mnemonic
← Returns: wallet, mnemonic, privateKey

# 2. User sets PIN
POST /api/wallet-setup/set-pin
  { walletId, currentPassword, newPin: "1234" }

# 3. User logs out and back in
# JWT still valid, but wallet session expired

# 4. User unlocks with PIN
POST /api/wallet-setup/unlock-wallet
  { walletId, pinCode: "1234" }
← Returns: sessionToken, expiresAt

# 5. User uses wallet
# All requests include sessionToken in Authorization header
GET /api/wallet-setup/user-wallets
  Authorization: Bearer <sessionToken>
← Can transact for 24 hours
```

### Scenario 2: Multiple Wallets
```bash
# After user creates Wallet B
GET /api/wallet-setup/user-wallets
← Shows: [Wallet A (active), Wallet B (inactive)]

# Switch to Wallet B
POST /api/wallet-setup/unlock-wallet
  { walletId: B, pinCode: "5678" }
← New sessionToken for Wallet B

# Wallet A session still valid (but not active)
# Can switch back instantly

POST /api/wallet-setup/wallet-logout
  { sessionToken: <wallet_A_token> }
```

---

**Date:** March 2, 2026  
**Status:** ✅ Implementation Complete
