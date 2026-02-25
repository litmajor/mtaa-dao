# Wallet Session & PIN-Based Access Implementation

**Status**: ✅ COMPLETE - Wallet session system fully implemented

**Date**: January 22, 2026

---

## Overview

Implemented a complete wallet session system allowing users to access their wallets using PIN instead of seedphrase after initial creation. Sessions stay active for 24 hours, enabling seamless wallet operations without repeated authentication.

---

## Architecture

### Database Schema

**New Table: `wallet_sessions`**
```sql
wallet_sessions {
  id: uuid (primary key)
  walletId: uuid (references wallets)
  userId: varchar (references users)
  sessionToken: varchar (unique) - secure token for session
  isActive: boolean (default true)
  connectedAt: timestamp
  disconnectedAt: timestamp (null until disconnected)
  lastAccessedAt: timestamp - tracks last usage
  ipAddress: varchar - security tracking
  userAgent: varchar - device tracking
  deviceId: varchar - device identifier
  expiresAt: timestamp - session timeout (24 hours)
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

## Backend Implementation

### 1. Wallet Session Service
**File**: `server/services/wallet-session-service.ts`

**Key Functions**:

| Function | Purpose |
|----------|---------|
| `createWalletSession()` | Create new session after PIN verification |
| `getActiveWalletSession()` | Retrieve active session for user+wallet |
| `getUserActiveSessions()` | List all active sessions for user |
| `verifySessionToken()` | Validate session token and update last access |
| `extendWalletSession()` | Extend session expiry (useful before timeout) |
| `disconnectWalletSession()` | Manual disconnect (logout) |
| `disconnectWalletByToken()` | Disconnect using session token |
| `disconnectAllUserSessions()` | Logout from all devices |
| `cleanupExpiredSessions()` | Periodic cleanup (run as cron job) |

### 2. Wallet Session API Routes
**File**: `server/routes/wallet-sessions.ts`

**Endpoints**:

#### POST `/api/wallet-sessions/connect`
**Purpose**: Connect wallet with PIN verification
```json
Request:
{
  "walletId": "uuid",
  "pin": "4-digit PIN"
}

Response (Success):
{
  "success": true,
  "data": {
    "sessionToken": "hex-string",
    "expiresAt": "2026-01-23T10:30:00Z",
    "walletId": "uuid"
  }
}

Response (Error):
{
  "success": false,
  "error": "Invalid PIN"
}
```

**Flow**:
1. User authenticates with JWT
2. PIN is verified against user's stored PIN
3. Wallet session created with 24-hour expiry
4. Session token returned for client storage

**Security**:
- ✅ Requires JWT authentication
- ✅ PIN verification via `verifyPinService()`
- ✅ 3-attempt rate limiting (built-in)
- ✅ IP address & user agent logged

---

#### GET `/api/wallet-sessions/active`
**Purpose**: Get all active sessions for authenticated user
```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "walletId": "uuid",
      "connectedAt": "2026-01-22T10:30:00Z",
      "expiresAt": "2026-01-23T10:30:00Z",
      "lastAccessedAt": "2026-01-22T15:45:00Z",
      "ipAddress": "192.168.1.1",
      "deviceId": "device-123"
    }
  ]
}
```

---

#### POST `/api/wallet-sessions/verify`
**Purpose**: Verify if session token is valid
```json
Request:
{
  "sessionToken": "hex-string"
}

Response (Valid):
{
  "success": true,
  "data": {
    "valid": true,
    "walletId": "uuid",
    "userId": "user-id",
    "expiresAt": "2026-01-23T10:30:00Z"
  }
}

Response (Invalid):
{
  "success": false,
  "error": "Invalid or expired session token"
}
```

---

#### POST `/api/wallet-sessions/extend`
**Purpose**: Extend session expiry before timeout
```json
Request Header:
x-wallet-session: session-token

Request Body:
{
  "hours": 24
}

Response:
{
  "success": true,
  "data": {
    "message": "Session extended by 24 hours",
    "newExpiresAt": "2026-01-24T10:30:00Z"
  }
}
```

---

#### POST `/api/wallet-sessions/disconnect`
**Purpose**: Manually disconnect wallet (logout)
```json
Request Header:
x-wallet-session: session-token

Response:
{
  "success": true,
  "data": {
    "message": "Wallet session disconnected"
  }
}
```

---

#### POST `/api/wallet-sessions/disconnect-all`
**Purpose**: Disconnect all wallet sessions for user
```json
Response:
{
  "success": true,
  "data": {
    "message": "3 wallet session(s) disconnected",
    "disconnected": 3
  }
}
```

---

## Frontend Implementation

### 1. PIN Wallet Unlock Component
**File**: `client/src/components/wallet/PINWalletUnlock.tsx`

**Features**:
- ✅ 4-digit PIN input (numeric only)
- ✅ Visual feedback during unlock
- ✅ 3-attempt rate limiting with lockout
- ✅ Session token storage
- ✅ Responsive design

**Usage**:
```tsx
import PINWalletUnlock from '@/components/wallet/PINWalletUnlock';

function MyComponent() {
  return (
    <PINWalletUnlock 
      walletId="wallet-uuid"
      onUnlocked={(sessionToken) => {
        // Handle successful unlock
        console.log('Wallet unlocked:', sessionToken);
      }}
      onError={(error) => {
        // Handle error
        console.error('Unlock failed:', error);
      }}
    />
  );
}
```

**Flow**:
1. User enters 4-digit PIN
2. Component calls `/api/wallet-sessions/connect`
3. PIN verified on backend
4. Session token returned
5. Token stored in `sessionStorage`
6. `onUnlocked` callback triggered

**Security Features**:
- ✅ PIN masked in input field
- ✅ 3-attempt lockout (15 min wait)
- ✅ Session storage (cleared on browser close)
- ✅ Server-side rate limiting

---

### 2. Wallet Session Hook
**File**: `client/src/hooks/useWalletSession.ts`

**State Management**:
```typescript
{
  isConnected: boolean;
  sessionToken: string | null;
  walletId: string | null;
  expiresAt: Date | null;
  isLoading: boolean;
  error: string | null;
  isExpiringSoon: boolean;
  remainingMinutes: number;
}
```

**Available Methods**:

| Method | Description |
|--------|-------------|
| `connectWallet(walletId, pin)` | Connect wallet with PIN |
| `verifySession()` | Verify current session validity |
| `extendSession(hours)` | Extend session expiry |
| `disconnectWallet()` | Disconnect current wallet |
| `disconnectAll()` | Disconnect all wallets |

**Usage Example**:
```tsx
import { useWalletSession } from '@/hooks/useWalletSession';

export function MyDashboard() {
  const wallet = useWalletSession();

  useEffect(() => {
    // Auto-extend session if expiring soon
    if (wallet.isExpiringSoon && wallet.remainingMinutes < 60) {
      wallet.extendSession(24);
    }
  }, [wallet.remainingMinutes]);

  if (!wallet.isConnected) {
    return <PINWalletUnlock walletId="..." />;
  }

  return (
    <div>
      <p>Session expires in {wallet.remainingMinutes} minutes</p>
      <button onClick={() => wallet.disconnectWallet()}>
        Logout
      </button>
    </div>
  );
}
```

---

## User Flow

### Wallet Creation → Session Start
```
User Creates Wallet
    ↓
User sets PIN (4 digits)
    ↓
Wallet stored with PIN hash
    ↓
User can now use PIN to unlock
```

### Daily Access → PIN Unlock
```
User logs in with credentials
    ↓
User clicks "Access Wallet"
    ↓
PINWalletUnlock component shown
    ↓
User enters 4-digit PIN
    ↓
PIN verified against stored hash
    ↓
Session created (24 hour expiry)
    ↓
Session token stored in browser
    ↓
Wallet accessible without seedphrase
    ↓
Session persists across page refreshes
    ↓
User can extend before expiry
    ↓
Session auto-disconnects at expiry
```

### Multi-Device Support
```
Device 1: User logs in → creates session
Device 2: User logs in → creates separate session
Device 3: User logs in → creates another session

Each device has independent session
User can disconnect from all devices at once
```

---

## Security Features

### 1. PIN Verification
- ✅ PIN hashed before storage
- ✅ 3-attempt rate limiting
- ✅ 15-minute lockout after 3 failed attempts
- ✅ Server-side validation required

### 2. Session Token
- ✅ 32-byte random hex token
- ✅ Unique per session
- ✅ Expires after 24 hours
- ✅ Tied to specific wallet + user combo

### 3. IP & Device Tracking
- ✅ IP address logged
- ✅ User agent captured
- ✅ Device ID recorded
- ✅ Supports audit trail

### 4. Session Storage
- ✅ Token in `sessionStorage` (cleared on browser close)
- ✅ Auto-cleanup of expired sessions
- ✅ One-time token per session
- ✅ Cannot be replayed after disconnect

---

## Configuration

### Session Timeout (Default: 24 hours)
Change in wallet session service creation:
```typescript
const sessionTimeoutHours = config.sessionTimeoutHours || 24; // Modify here
```

### PIN Attempt Limit (Default: 3)
Change in PIN service configuration:
```typescript
maxAttempts: 3 // Modify in PIN verification service
lockoutMinutes: 15 // Lockout duration
```

### Extend Session Before Timeout
Call before expiry:
```typescript
const result = await wallet.extendSession(24); // Add 24 more hours
```

---

## Database Queries

### Create Session
```sql
INSERT INTO wallet_sessions (
  wallet_id, user_id, session_token, is_active,
  connected_at, expires_at, ip_address, user_agent
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

### Get Active Sessions
```sql
SELECT * FROM wallet_sessions
WHERE user_id = ? 
  AND is_active = true 
  AND expires_at > NOW()
ORDER BY connected_at DESC
```

### Verify Token
```sql
SELECT * FROM wallet_sessions
WHERE session_token = ?
  AND is_active = true 
  AND expires_at > NOW()
LIMIT 1
```

### Extend Session
```sql
UPDATE wallet_sessions
SET expires_at = expires_at + INTERVAL '24 hours'
WHERE id = ?
```

### Disconnect Session
```sql
UPDATE wallet_sessions
SET is_active = false, disconnected_at = NOW()
WHERE id = ? OR session_token = ?
```

### Cleanup Expired
```sql
UPDATE wallet_sessions
SET is_active = false
WHERE expires_at < NOW() AND is_active = true
```

---

## Testing Checklist

- [ ] Create wallet and set PIN
- [ ] Unlock wallet with PIN (success)
- [ ] Attempt with wrong PIN (3 times, then lockout)
- [ ] Session created with 24-hour expiry
- [ ] Session token stored in sessionStorage
- [ ] Verify session with token
- [ ] Extend session before expiry
- [ ] Manual disconnect clears session
- [ ] Disconnect all sessions from another device
- [ ] Session auto-expires after 24 hours
- [ ] Page refresh maintains session
- [ ] Browser close clears session
- [ ] Multi-device sessions are independent
- [ ] IP address and user agent logged
- [ ] Audit trail complete

---

## Next Steps

1. **Add session timeout warning**: Show notification when session expiring soon
2. **Biometric unlock**: Support fingerprint/Face ID in addition to PIN
3. **Device management page**: Let users manage active sessions
4. **Session activity log**: Show login history and device info
5. **Automatic session extension**: Extend automatically on activity
6. **Session notifications**: Alert user of new logins from other devices
7. **PIN reset flow**: Allow users to reset PIN via email/SMS verification

---

## Files Created/Modified

### Schema
- ✅ `shared/schema.ts` - Added `walletSessions` table and types

### Backend Services
- ✅ `server/services/wallet-session-service.ts` - NEW (Session management)
- ✅ `server/routes/wallet-sessions.ts` - NEW (API endpoints)
- ✅ `server/index.ts` - Updated (Route registration)

### Frontend Components
- ✅ `client/src/components/wallet/PINWalletUnlock.tsx` - NEW (PIN unlock UI)
- ✅ `client/src/hooks/useWalletSession.ts` - NEW (Session state hook)

---

## Summary

| Feature | Status | Details |
|---------|--------|---------|
| Wallet Sessions Table | ✅ | Created with all needed fields |
| Session Service | ✅ | Create, verify, extend, disconnect |
| API Endpoints | ✅ | 6 endpoints for session management |
| PIN Unlock Component | ✅ | 4-digit PIN input with 3-attempt limit |
| Session Hook | ✅ | useWalletSession for state management |
| Security | ✅ | PIN hashing, rate limiting, token expiry |
| Multi-Device | ✅ | Independent sessions per device |
| Session Persistence | ✅ | sessionStorage (auto-clears on browser close) |

**Users can now**:
1. Create wallet once with seedphrase
2. Set 4-digit PIN during creation
3. Access wallet daily with PIN (no seedphrase needed)
4. Session stays active 24 hours
5. Logout/disconnect to end session
6. Extend session before expiry
7. Access from multiple devices simultaneously

