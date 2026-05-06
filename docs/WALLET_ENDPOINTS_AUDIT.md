# /api/wallet* Endpoints Comprehensive Audit

**Audit Date**: March 13, 2026  
**Status**: In Progress - Versioning Strategy  
**Focus**: Identify consumers, middleware gaps, legacy domains, and deprecation strategy

---

## Executive Summary

The `/api/wallet*` namespace contains **47 endpoints** across **4 primary domains** serving multiple consumer types:
- **Web/SPA Client**: React app from `client/src/`
- **Mobile Clients**: Multiple wallet session endpoints (PIN-based)
- **Admin Panel**: User vault management + billing operations
- **Internal Services**: Signal ingestion, payment processing, escrow workflows

**Critical Finding**: `/api/wallet-setup` has **minimal middleware** - only `isAuthenticated` with no rate limiting on 5 key provisioning endpoints.

---

## Domains & Endpoint Inventory

### 1. **Primary Domain: `/api/wallet` (Legacy - 18 endpoints)**

**Mount Point**: [server/index.ts#L1134](server/index.ts#L1134)  
**Middleware Stack**: `isAuthenticated`  
**Status**: ACTIVE - Used by web client  
**Rate Limiters**: 
- `sendNativeLimiter` (5/min) on POST /send-native
- `sendTokenLimiter` (5/min) on POST /send-token
- `savingsLimiter` (10/hr) on POST /savings/:action

#### Endpoint Breakdown

| Path | Method | Auth | RateLimit | Purpose | Consumer |
|------|--------|------|-----------|---------|----------|
| `/balance/:address?` | GET | ✅ | ❌ | Fetch CELO balance | Web Client |
| `/balance/celo` | GET | ✅ | ❌ | Get CELO balance | Web Client |
| `/balance/cusd` | GET | ✅ | ❌ | Get cUSD balance | Web Client |
| `/balance-multi` | GET | ✅ | ❌ | Multi-wallet balances | Web Client |
| `/send-native` | POST | ✅ | ✅ 5/min | Send CELO tokens | Web Client |
| `/send-token` | POST | ✅ | ✅ 5/min | Send other tokens | Web Client |
| `/analytics` | GET | ✅ | ❌ | Transaction analytics | Web Client |
| `/savings` | GET | ✅ | ❌ | View savings accounts | Web Client |
| `/savings` | POST | ✅ | ⚠️ unspecified | Create savings | Web Client |
| `/savings/create` | POST | ✅ | ✅ 10/hr | Alt: Create savings | Web Client |
| `/savings/withdraw/:id` | POST | ✅ | ✅ 10/hr | Withdraw savings | Web Client |
| `/exchange-rates` | GET | ❌ | ❌ | **PUBLIC** - Market rates | Mobile/Web |
| `/network-info` | GET | ✅ | ❌ | Network configuration | Web Client |
| `/multisig` | POST | ✅ | ❌ | Multisig operations | Web Client |
| `/multisig/create` | POST | ✅ | ❌ | Create multisig | Web Client |
| `/multisig/info` | POST | ✅ | ❌ | Get multisig info | Web Client |
| `/multisig/submit` | POST | ✅ | ❌ | Submit tx | Web Client |

**Sub-domains Used**:
- `/bill-split` (8 endpoints) - redirected to separate route file
- `/recurring-payments` (? endpoints) - redirected to separate route file
- `/vouchers` (? endpoints) - redirected to separate route file  
- `/phone` (? endpoints) - redirected to separate route file

---

### 2. **Setup Domain: `/api/wallet-setup` (Provisioning - 17 endpoints)**

**Mount Point**: [server/index.ts#L1135](server/index.ts#L1135)  
**Middleware Stack**: `isAuthenticated` **ONLY** ⚠️  
**Status**: ACTIVE - Used for wallet provisioning  
**Rate Limiters**: 
- `walletKeyMaterialLimiter` (3/hr) on key access endpoints
- `walletBackupDataLimiter` (5/hr) on backup endpoints
- `walletCreationLimiter` (10/hr) on creation endpoints

#### Critical Middleware Gap
**Finding**: Endpoints `/user-vaults`, `/initialize-assets`, `/backup-status/:userId`, `/get-backup-data` have NO authentication validation in some cases:

| Path | Method | Auth | Issue | Risk |
|------|--------|------|-------|------|
| `/backup-status/:userId` | GET | ❌ | No auth | **PUBLIC EXPOSURE** of backup status |
| `/initialize-assets` | POST | ❌ | No auth | Unauthorized wallet init |
| `/initialize-additional-vault` | POST | ✅ | OK | Protected |
| `/user-vaults/:userId` | GET | ⚠️ | Implicit | No explicit check |
| `/user-wallets` | GET | ✅ | OK | Protected |

**Action Required**: Add explicit `isAuthenticated` + userId verification to bypass endpoints.

#### Endpoint Breakdown

| Path | Method | Auth | RateLimit | Purpose | Consumer |
|------|--------|------|-----------|---------|----------|
| `/create-wallet-mnemonic` | POST | ✅ | ✅ 10/hr | Generate wallet | Mobile/Web |
| `/create-wallet` | POST | ✅ | ✅ 10/hr | Create (alt) | Mobile/Web |
| `/recover-wallet` | POST | ✅ | ✅ 3/hr | Recover from seed | Mobile/Web |
| `/import-private-key` | POST | ✅ | ✅ 3/hr | Import key | Mobile/Web |
| `/unlock-wallet` | POST | ✅ | ✅ 3/hr | Unlock wallet | Mobile/Web |
| `/backup-confirmed` | POST | ✅ | ❌ | Mark backup done | Mobile/Web |
| `/export-encrypted-backup` | POST | ✅ | ❌ | Export backup | Mobile/Web |
| `/restore-from-backup` | POST | ✅ | ❌ | Restore backup | Mobile/Web |
| `/initialize-additional-vault` | POST | ✅ | ✅ 10/hr | Add vault | Mobile/Web |
| `/user-vaults/:userId` | GET | ⚠️ | ❌ | Get user vaults | **Internal service** |
| `/initialize-assets` | POST | ❌ | ❌ | Init assets | **Public endpoint** ⚠️ |
| `/import-wallet` | POST | ❌ | ❌ | Import wallet | **Public endpoint** ⚠️ |
| `/backup-status/:userId` | GET | ❌ | ❌ | Backup status | **Public endpoint** ⚠️ |
| `/get-backup-data` | POST | ✅ | ✅ 5/hr | Get backup data | Mobile/Web |
| `/set-pin` | POST | ✅ | ❌ | Set PIN | Mobile/Web |
| `/wallet-logout` | POST | ✅ | ❌ | Logout wallet | Mobile/Web |
| `/user-wallets` | GET | ✅ | ❌ | List user wallets | Mobile/Web |

---

### 3. **Sessions Domain: `/api/wallet-sessions` (Session Management - 6 endpoints)**

**Mount Point**: [server/index.ts#L1137](server/index.ts#L1137)  
**Middleware Stack**: `isAuthenticated` on most (with one exception)  
**Status**: ACTIVE - PIN-based wallet access  
**Rate Limiters**: ❌ NONE - Could benefit from rate limiting

#### Endpoint Breakdown

| Path | Method | Auth | RateLimit | Purpose | Consumer |
|------|--------|------|-----------|---------|----------|
| `/connect` | POST | ✅ | ❌ | Create session via PIN | Mobile Client |
| `/active` | GET | ✅ | ❌ | Get active session | Mobile Client |
| `/verify` | POST | ❌ | ❌ | **PUBLIC** - Verify token | Mobile Client |
| `/extend` | POST | ✅ | ❌ | Extend session | Mobile Client |
| `/disconnect` | POST | ✅ | ❌ | End session | Mobile Client |
| `/disconnect-all` | POST | ✅ | ❌ | End all sessions | Mobile Client |

**Authentication Gap**: `/verify` accepts POST without `authenticateToken` - allows verification of arbitrary session tokens.

---

### 4. **Wallets Domain: `/api/wallets` (Creation/Discovery - 13 endpoints)**

**Mount Point**: [server/index.ts#L1136](server/index.ts#L1136)  
**Middleware Stack**: `isAuthenticated`  
**Status**: ACTIVE - Wallet management  
**Rate Limiters**: ❌ NONE - No rate limiting configured

#### Endpoint Breakdown

| Path | Method | Auth | Purpose | Consumer |
|------|--------|------|---------|----------|
| `/connect` | POST | ✅ | Connect wallet | Web Client |
| `/` | GET | ✅ | List connections | Web Client |
| `/:walletId` | GET | ✅ | Get wallet details | Web Client |
| `/queue-transaction` | POST | ✅ | Queue transaction | Web Client |
| `/record-transaction` | POST | ✅ | Record tx | Web Client |
| `/transaction-queue` | GET | ✅ | View queue | Web Client |
| `/transaction/:hash` | GET | ✅ | Get tx details | Web Client |
| `/transactions` | GET | ✅ | List transactions | Web Client |
| `/portfolio` | POST | ✅ | Get portfolio | Web Client |
| `/balances` | GET | ✅ | Get balances | Web Client |
| `/verify-wallet-signature` | POST | ✅ | Verify sig | Web Client |
| `/supported-networks` | GET | ✅ | Get networks | Web Client |
| `/network-tokens` | GET | ✅ | Get tokens | Web Client |

---

## Legacy Domain Identification: Four Critical Sub-domains

### **Problem**: Sub-domain Routes Duplicated/Redundant

The following sub-domains exist **both as separate route files AND potentially as internal routes**:

#### 1. **Bill Split** (`/api/wallet/bill-split`)
- **File**: `/server/routes/bill-split.ts`
- **Mount**: [server/index.ts#L1144](server/index.ts#L1144)
- **Endpoints**: 8 (`GET`, `POST`, `PUT` operations)
- **Status**: ✅ Properly mounted
- **Auth**: `isAuthenticated`
- **Rate Limiters**: ❌ None detected
- **Consumer**: Web client for expense splitting flows

#### 2. **Recurring Payments** (`/api/wallet/recurring-payments`)
- **File**: `/server/routes/recurring-payments.ts`
- **Mount**: [server/index.ts#L1139](server/index.ts#L1139)
- **Endpoints**: ? (unknown count)
- **Status**: ✅ Properly mounted
- **Auth**: `isAuthenticated`
- **Rate Limiters**: ❌ Verify needed
- **Consumer**: Web/Admin for subscription management

#### 3. **Vouchers** (`/api/wallet/vouchers`)
- **File**: `/server/routes/vouchers.ts`
- **Mount**: [server/index.ts#L1140](server/index.ts#L1140)
- **Endpoints**: ? (unknown count)
- **Status**: ✅ Properly mounted
- **Auth**: `isAuthenticated`
- **Rate Limiters**: ❌ Verify needed
- **Consumer**: Web client for voucher redemption

#### 4. **Phone Payments** (`/api/wallet/phone`)
- **File**: `/server/routes/phone-payments.ts`
- **Mount**: [server/index.ts#L1141](server/index.ts#L1141)
- **Endpoints**: ? (unknown count)
- **Status**: ✅ Properly mounted
- **Auth**: `isAuthenticated`
- **Rate Limiters**: ❌ Verify needed
- **Consumer**: Mobile client for USSD/mobile money integration

---

## Consumer Mapping

### By Internal Service

| Service | Endpoints | Type | Auth |
|---------|-----------|------|------|
| **Web Client** | `/api/wallet/*` main endpoints | REST | JWT + NextAuth |
| **Mobile Client** | `/api/wallet-sessions/*` + `/api/wallet-setup/*` | REST + PIN | JWT |
| **Admin Panel** | `/api/wallet-setup/user-vaults/:userId` | REST | JWT |
| **Payment Gateway** | `/api/payment-gateway/*` (separate domain) | REST | JWT |
| **Escrow Service** | `/api/escrow/*` (uses wallet funcs internally) | REST | JWT |
| **Signal Ingestion** | Not directly via `/api/wallet*` | Internal | Service-to-Service |

### By Data Flow

```
Web Client (React)
  ↓
/api/wallet/balance/* → Get user balance
/api/wallet/send-native → Send funds
/api/wallet/multisig/* → Multisig operations
/api/wallet/bill-split/* → Split expenses
  ↓
[Wallet Service Layer]
  ↓
Blockchain (Celo)
  ↓
[CEX Integration] (separate route domain)
  ↓
Arbitrage/Opportunity Engine

Mobile Client (Native App)
  ↓  
/api/wallet-setup/* → Create/restore wallet
/api/wallet-sessions/* → PIN-based access
  ↓
[Wallet Service Layer]

Admin Panel
  ↓
/api/wallet-setup/user-vaults/:userId → Billing
/admin endpoints → User management
```

---

## Critical Finding: Incomplete Middleware on /api/wallet-setup

### Summary
5 of 17 endpoints in `/api/wallet-setup` lack proper authentication:
- ❌ `/backup-status/:userId` - GET (public read of backup status)
- ❌ `/initialize-assets` - POST (public wallet initialization)
- ❌ `/import-wallet` - POST (public wallet import)
- ⚠️ `/user-vaults/:userId` - GET (implicit check, no validation)

### Security Impact
**CRITICAL**: Public endpoints allow:
1. Enumeration of user backup status (privacy leak)
2. Initialization of wallets without user consent (account takeover)
3. Importing arbitrary wallets (privilege escalation)

### Recommended Fix
```typescript
// Before: No auth on GET /backup-status/:userId
router.get('/backup-status/:userId', async (req, res) => { ... }

// After: Add explicit auth + userId verification
router.get('/backup-status/:userId', isAuthenticated, checkUserOwnership, async (req, res) => { ... }

// Helper middleware
const checkUserOwnership = (req: Request, res: Response, next: Function) => {
  const userId = req.params.userId;
  const requestingUserId = (req as any).user?.id;
  
  if (userId !== requestingUserId && !isAdmin(requestingUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
```

---

## Deprecation Strategy: Adding Headers Without Logic Changes

### Objective
Mark legacy domains for deprecation while maintaining full functionality. Allow clients to migrate gracefully.

### Header Pattern
```typescript
// Sunset headers for legacy domains
X-Deprecated: true                              // Deprecated flag
Sunset: Wed, 13 Jun 2026 00:00:00 GMT         // EOL date (3 months from now)
Deprecation: true                              // RFC 8594 standard
Link: <https://api.example.com/docs/v2/wallet>; rel="successor-version"
```

### Domains to Deprecate (4 main)
1. `/api/wallet` → Migrate to `/api/v2/wallet`
2. `/api/wallet-setup` → Migrate to `/api/v2/wallet-setup`
3. `/api/wallets` → Migrate to `/api/v2/wallets`
4. `/api/wallet-sessions` → Migrate to `/api/v2/wallet-sessions`

### Implementation (No Logic Changes)
Add middleware response headers:
```typescript
const addDeprecationHeaders = (domain: string, successorPath: string) => {
  return (req: Request, res: Response, next: Function) => {
    res.set('X-Deprecated', 'true');
    res.set('Sunset', 'Wed, 13 Jun 2026 00:00:00 GMT');
    res.set('Deprecation', 'true');
    res.set('Link', `<${successorPath}>; rel="successor-version"`);
    
    // Log to Redis for metrics
    const key = `wallet:metrics:${domain}:${req.method}:${req.path}`;
    redisClient.incr(key).catch(err => logger.warn('Metrics tracking failed', err));
    
    next();
  };
};
```

---

## Metrics & Call Volume Baseline

### Redis Route Metrics Strategy
Track using sliding window counter per endpoint:
```typescript
// Key format
wallet:metrics:{domain}:{method}:{path}:{timestamp}

// Examples
wallet:metrics:/api/wallet:GET:/balance:2026031300  // Hour 00:00-01:00
wallet:metrics:/api/wallet-setup:POST:/create-wallet-mnemonic:2026031312

// Query pattern (last 24 hours)
redis.keys('wallet:metrics:*')  // Get all metrics
redis.getall('wallet:metrics:*') // Aggregate call volume
```

### Baseline Call Volume (to establish)
Will populate after implementing metrics middleware:

| Domain | Endpoint | Method | Expected/Actual |
|--------|----------|--------|-----------------|
| `/api/wallet` | /balance/:address | GET | ~100/hr (user checks balance) |
| `/api/wallet` | /send-native | POST | ~10/hr (financial tx) |
| `/api/wallet-setup` | /create-wallet-mnemonic | POST | ~5/day (onboarding) |
| `/api/wallet-sessions` | /connect | POST | ~50/day (PIN login) |

---

## Three Critical Sub-domains to Document

### Domain 1: **Setup** (`/api/wallet-setup`)
**Purpose**: Wallet provisioning and key material management  
**Flow**: User onboarding → Wallet generation → Backup → Ready for use

**Lifecycle**:
```
New User
  ↓
POST /api/wallet-setup/create-wallet-mnemonic (generate 12/24 words)
  ↓
User writes down seed offline
  ↓
POST /api/wallet-setup/backup-confirmed (verify user saved)
  ↓
POST /api/wallet-setup/set-pin (4-digit PIN for sessions)
  ↓
Wallet ready for use
```

**Sub-endpoints**:
- Key generation: `create-wallet-mnemonic`, `create-wallet`
- Recovery: `recover-wallet`, `import-private-key`, `import-wallet`
- Backup: `export-encrypted-backup`, `restore-from-backup`, `backup-confirmed`
- Access: `unlock-wallet`, `set-pin`
- Vault management: `initialize-additional-vault`, `user-vaults`

**Security**: Key material access limited to 3/hour; backup access 5/hour

---

### Domain 2: **Payments** (`/api/wallet/*` + `/api/wallet/bill-split`)
**Purpose**: Financial operations (transfers, bill splitting, recurring payments, vouchers)  
**Flow**: User initiates payment → Rate-limited execution → Blockchain confirmation

**Components**:
1. **Direct Transfers**: `/send-native`, `/send-token` (5/min limit)
2. **Bill Split**: `/api/wallet/bill-split/*` (expense splitting, settlement)
3. **Recurring**: `/api/wallet/recurring-payments/*` (subscriptions, auto-pay)
4. **Vouchers**: `/api/wallet/vouchers/*` (promotion codes, incentives)
5. **Multisig**: `/multisig/*` (governance spend, multi-approval)

**Rate Limiting**:
- Send operations: 5/minute per user
- Savings operations: 10/hour per user
- Backup access: 5/hour per user

---

### Domain 3: **Sessions** (`/api/wallet-sessions`)
**Purpose**: PIN-based wallet access without exposing seed phrases  
**Flow**: User provides PIN → Session token created → Token used for operations → Session expires

**Lifecycle**:
```
User Unlocks Wallet
  ↓
POST /api/wallet-sessions/connect (provide PIN)
  ↓
Server creates session token (24hr expiry default)
  ↓
Mobile app stores token in secure storage
  ↓
Token sent in X-Wallet-Session header for operations
  ↓
GET /api/wallet-sessions/active (check session status)
  ↓
POST /api/wallet-sessions/extend (renew expiry)
  ↓
POST /api/wallet-sessions/disconnect (logout)
```

**Endpoints**:
- Session lifecycle: `connect`, `active`, `extend`, `disconnect`, `disconnect-all`
- Verification: `verify` (token validation)

**Security**:
- PIN stored hashed (bcrypt)
- Session tokens use secure random generation
- Token expiration enforced
- IP/UA fingerprinting (optional)

---

## Immediate Action Items

### 1. **Fix Middleware Gaps** (URGENT)
- [ ] Add `isAuthenticated` to `/api/wallet-setup/backup-status/:userId`
- [ ] Add `isAuthenticated` + ownership check to `/api/wallet-setup/initialize-assets`
- [ ] Add `isAuthenticated` + ownership check to `/api/wallet-setup/import-wallet`
- [ ] Add explicit `isAuthenticated` to `/api/wallet-setup/user-vaults/:userId`
- [ ] Add `authenticateToken` to `/api/wallet-sessions/verify`

### 2. **Add Deprecation Headers** (LOW IMPACT)
- [ ] Create `deprecationHeaders` middleware
- [ ] Mount on `/api/wallet`
- [ ] Mount on `/api/wallet-setup`
- [ ] Mount on `/api/wallets`
- [ ] Mount on `/api/wallet-sessions`

### 3. **Implement Metrics Collection** (BASELINE)
- [ ] Create `routeMetricsMiddleware` for Redis logging
- [ ] Record per-endpoint call volume (hourly buckets)
- [ ] Run for 1 week to establish baseline
- [ ] Generate report: top endpoints, call patterns

### 4. **Document Sub-domains** (REFERENCE)
- [ ] Create `/api/v2/wallet/README.md` migration guide
- [ ] Document each sub-domain: setup, payments, sessions
- [ ] Create OpenAPI spec for v2 endpoints
- [ ] Add deprecation timeline to API docs

---

## References

- **Routes**: [server/routes/wallet.ts](server/routes/wallet.ts) | [wallet-setup.ts](server/routes/wallet-setup.ts) | [wallet-sessions.ts](server/routes/wallet-sessions.ts) | [wallets.ts](server/routes/wallets.ts)
- **Index Mount Points**: [server/index.ts#L1134-L1144](server/index.ts#L1134)
- **Middleware**: [server/middleware/rateLimiting.ts](server/middleware/rateLimiting.ts) | [auth.ts](server/middleware/auth.ts)
- **Metrics**: [visibility/routes-stats.json](visibility/routes-stats.json) | [visibility/routes-map.json](visibility/routes-map.json)

