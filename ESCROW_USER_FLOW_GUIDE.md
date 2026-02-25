# Escrow User Flow Guide

## Overview
The escrow system supports two user flows:
1. **In-App User** - Recipient already has an account
2. **Out-of-App User** - Recipient doesn't have an account yet (invite link)

---

## Flow 1: IN-APP USER (Already Has Account)

### Step 1: Payer Creates Escrow
**Location:** `/escrow` page → "Create Escrow" button → Dialog form

**What Payer Enters:**
- Recipient address/username/email
- Total amount
- Currency (USDC, USDT, ETH, DAI)
- Description
- Milestones (minimum 1)

**API Call:**
```
POST /api/escrow/initiate
{
  recipient: "john@example.com" or "johnuser" or "0x...",
  amount: "1000",
  currency: "USDC",
  description: "Project development work",
  milestones: [
    { description: "Phase 1", amount: "300" },
    { description: "Phase 2", amount: "700" }
  ]
}
```

### Step 2: Backend Lookup
Backend searches for recipient:
```typescript
// Searches by email OR username
SELECT * FROM users 
WHERE email = 'john@example.com' 
  OR username = 'johnuser'
```

### Step 3: Escrow Created with Payee Linked
If user exists in database:
- **Escrow status**: `accepted` (immediately)
- **payeeId**: Set to recipient's user ID
- Recipient can immediately see the escrow in `/escrow` page

**Backend Response:**
```json
{
  "success": true,
  "escrow": {
    "id": "esc_xyz123",
    "payerId": "user_123",
    "payeeId": "user_456",
    "amount": "1000",
    "currency": "USDC",
    "status": "accepted",
    "milestones": [...]
  },
  "inviteLink": "http://localhost:5173/escrow/accept/abc123xyz?referrer=user_123"
}
```

### Step 4: Recipient Notified
**Email sent with:**
- Payer name and amount
- Payment purpose/description
- Milestone breakdown
- Direct link to view escrow in app

**Recipient sees in:**
- Email notification
- My Escrows page (automatically appears)

---

## Flow 2: OUT-OF-APP USER (No Account Yet)

### Step 1: Payer Creates Escrow (Same as Above)
```
POST /api/escrow/initiate
{
  recipient: "newuser@example.com",  // Not in system
  amount: "500",
  currency: "USDC",
  ...
}
```

### Step 2: Backend Lookup Fails
```typescript
// No user found
SELECT * FROM users WHERE email = 'newuser@example.com'
// Returns: empty
```

### Step 3: Escrow Created as "Pending"
Since recipient doesn't exist:
- **payeeId**: Set to `"pending"` (placeholder)
- **status**: `pending`
- **metadata.inviteCode**: Generated unique code (12 chars)
- **metadata.recipientEmail**: Stored for future linking

**Backend creates invite link:**
```
https://[app-url]/escrow/accept/[inviteCode]?referrer=[payerId]
```

### Step 4: Invitation Email Sent
**To:** newuser@example.com

**Email contains:**
- Payer info and amount
- Milestone details
- **ACCEPT BUTTON** - Links to `/escrow/accept/[inviteCode]`
- Info: "Don't have an account? You'll be able to sign up"

### Step 5: Out-of-App User Clicks Link
**URL visited:**
```
https://app.mtaa.io/escrow/accept/abc123xyz?referrer=user_123
```

**Page:** `escrow-accept.tsx`

**What shows:**
- ✅ Secure payment invitation header
- ✅ Payer information
- ✅ Amount (prominently displayed)
- ✅ Payment description
- ✅ All milestones breakdown
- ✅ Two action options:

### Step 6a: User Has Account → Accept Button
```
Button: "Accept Secure Payment"
↓
API: POST /api/escrow/accept/[inviteCode]
  {
    inviteCode: "abc123xyz",
    referrer: "user_123"
  }
↓
Backend:
  - Finds escrow by inviteCode
  - Updates payeeId to authenticated user ID
  - Sets status = "accepted"
  - Logs referral (if referrer provided)
  - Sends notifications to both parties
↓
Redirects to: /wallet
```

### Step 6b: User Doesn't Have Account → Signup + Auto-Accept
```
Button: "Accept Secure Payment" (not authenticated)
↓
Redirects to: /register?escrow=[inviteCode]&referrer=[payerId]
↓
User signs up
↓
On signup completion:
  - Auto-calls POST /api/escrow/accept/[inviteCode]
  - Escrow is automatically accepted
  - referral is tracked
↓
User redirected to: /escrow (their new escrow)
```

---

## Database State Changes

### IN-APP SCENARIO
```sql
-- After creation
INSERT INTO escrow_accounts (id, payerId, payeeId, amount, currency, status, metadata)
VALUES (
  'esc_123',
  'user_payer',
  'user_recipient',  -- ← Immediately known
  '1000',
  'USDC',
  'accepted',  -- ← Ready to work
  '{"inviteCode":"...", "description":"..."}'
);
```

### OUT-OF-APP SCENARIO
```sql
-- After creation (recipient not registered)
INSERT INTO escrow_accounts (id, payerId, payeeId, amount, currency, status, metadata)
VALUES (
  'esc_456',
  'user_payer',
  'pending',  -- ← Placeholder, waiting for acceptance
  '1000',
  'USDC',
  'pending',  -- ← Not active yet
  '{"inviteCode":"abc123xyz", "recipientEmail":"new@email.com", ...}'
);

-- After recipient accepts (or signs up)
UPDATE escrow_accounts
SET 
  payeeId = 'user_newrecipient',
  status = 'accepted',
  updatedAt = NOW()
WHERE id = 'esc_456';
```

---

## Key Differences Summary

| Aspect | IN-APP | OUT-OF-APP |
|--------|--------|-----------|
| **Recipient lookup** | Email/username found in DB | Not found in DB |
| **Initial status** | `accepted` | `pending` |
| **payeeId** | User ID | `"pending"` string |
| **Invite link** | Generated but not needed | Critical - only way to accept |
| **Email notification** | Standard email | Email with accept link |
| **Recipient experience** | Sees in my-escrows immediately | Must click link, possibly signup |
| **Signup required** | No | Yes (if they accept) |
| **Referral tracking** | Yes (if referrer provided) | Yes (captured in query param) |

---

## Notifications Sent

### When Payer Creates Escrow

**Email to Recipient:**
- Subject: "💰 New Secure Payment from [payer]"
- Details: Amount, purpose, milestones
- Action: "✓ Accept Secure Payment" button (for out-of-app users)

**Notification log:**
```sql
INSERT INTO notification_logs 
  (userId, action, channel, recipient, escrowId)
VALUES 
  ('payer_id', 'escrow_created', 'email', 'recipient@email.com', 'esc_123');
```

### When Recipient Accepts Escrow

**Email to Payer:**
- Subject: "✅ Escrow Accepted - [amount] [currency] from [recipient]"
- Details: Recipient name, next steps
- Action: View in dashboard

**Email to Recipient (Confirmation):**
- Subject: "✅ You Accepted Secure Payment from [payer]"
- Details: Payer info, milestone timeline

**Notification logs:**
```sql
INSERT INTO notification_logs 
  (userId, action, channel, recipient, escrowId)
VALUES 
  ('payer_id', 'escrow_accepted', 'email', 'payer@email.com', 'esc_123'),
  ('recipient_id', 'escrow_accepted', 'email', 'recipient@email.com', 'esc_123');
```

---

## Referral Tracking (Out-of-App)

When recipient accepts from invite link:
```typescript
// Query param: ?referrer=user_123
registerEscrowReferral(referrerId, recipientId, escrowId)
↓
Rewards system tracks:
- user_123 referred user_456
- Through escrow transaction
- Amount: 1000 USDC
```

---

## Frontend Pages Involved

| Page | Purpose | User Type |
|------|---------|-----------|
| `/escrow` | View all escrows | Both |
| `/escrow/accept/[code]` | Public invite acceptance | Out-of-app recipient |
| `/register?escrow=[code]` | Signup with auto-accept | Out-of-app new user |

---

## API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/escrow/initiate` | ✅ Required | Create new escrow |
| `GET /api/escrow/invite/[code]` | ❌ Public | View escrow details by invite |
| `POST /api/escrow/accept/[code]` | ✅ Required | Accept escrow invitation |
| `GET /api/escrow/my-escrows` | ✅ Required | List user's escrows (both sides) |

---

## Error Scenarios

### Recipient Not Found (Out-of-App)
```json
{
  "success": true,
  "escrow": {...},
  "inviteLink": "https://app/escrow/accept/abc123"
}
// No error - creates pending escrow with invite code
```

### Invalid Invite Code
```json
{
  "error": "Escrow not found",
  "status": 404
}
// Shows error page on `/escrow/accept/[wrongcode]`
```

### User Tries to Accept Own Escrow
```json
{
  "error": "Cannot accept your own escrow",
  "status": 400
}
```

### Escrow Already Accepted
```json
{
  "error": "Escrow already accepted",
  "status": 400
}
```

---

## Flow Diagram

```
CREATE ESCROW (Payer)
    ↓
[Enter recipient info]
    ↓
Backend searches for user
    ├─ FOUND (In-app user)
    │   ├─ Create escrow with payeeId = user ID
    │   ├─ Set status = "accepted"
    │   ├─ Send email notification
    │   └─ Recipient sees in /escrow page immediately
    │
    └─ NOT FOUND (Out-of-app user)
        ├─ Create escrow with payeeId = "pending"
        ├─ Set status = "pending"
        ├─ Generate inviteCode
        ├─ Send email with accept link
        └─ Recipient clicks link
            ├─ Has account?
            │   ├─ YES → Accept → payeeId updated → Status = "accepted"
            │   └─ NO → Signup → Auto-accept → payeeId updated → Status = "accepted"
            └─ Both parties notified
```

---

## Questions & Answers

**Q: What if recipient email doesn't exist in DB but username does?**
A: The search uses `OR` condition - matches either email OR username. If username found, user is treated as in-app.

**Q: Can a user accept an escrow twice?**
A: No - once status is "accepted", the invite code is already consumed. Trying again returns 400 error.

**Q: What if new user signs up with different email than invited?**
A: They won't be automatically linked. The invite link becomes unusable. Payer would need to create new escrow with correct email.

**Q: Does out-of-app user get account access immediately?**
A: No - they must click the invite link. If they don't have account, they can create one during the acceptance process.

**Q: How long is invite link valid?**
A: No expiration currently. Link is valid indefinitely until recipient accepts or payer cancels (if cancellation implemented).

