# 🎤 OKEDI System Diagrams & Architecture

## 1. USER JOURNEY FLOWS

### Send to DAO Member Flow

```
User opens wallet
     ↓
Clicks "Send to DAO Member"
     ↓
Modal opens with member search
     ↓
Selects recipient (Njeri)
     ↓
Enters amount (5,000 KES)
     ↓
Optional: Adds note
     ↓
Reviews & Confirms
     ↓
API: POST /api/wallet/send-to-dao-member
     ↓
Backend:
  1. Verify sender has funds
  2. Create transaction record
  3. Transfer funds
  4. Record in DAO ledger
  5. Create chat notification
     ↓
Success screen shows:
  ✓ Amount sent
  ✓ Recipient
  ✓ Transaction ID
  ↓
[View in Chat] - Link to MTAA chat
```

### Escrow Creation Flow

```
User clicks "Create Escrow"
     ↓
Modal: Step 1 - Purpose
  □ Goods  □ Service  □ Loan  □ Other
     ↓
Modal: Step 2 - Parties
  Sender: You (auto)
  Recipient: [Search...] → Select
  Mediator: [Auto-suggest] or [Select manually]
     ↓
Modal: Step 3 - Details
  Amount: [_____] KES
  Terms: [Describe conditions for release...]
     ↓
Modal: Step 4 - Review
  Summary of all details
  [Confirm] or [Back]
     ↓
API: POST /api/escrow/create
     ↓
Backend:
  1. Validate all parties exist
  2. Verify sender has funds
  3. Lock funds in escrow account
  4. Create escrow_agreements record
  5. Notify recipient & mediator
     ↓
Success screen
  ✓ Escrow created
  ✓ Funds locked
  ↓
Status: "Waiting for recipient..."
```

### Escrow Release Flow (Happy Path)

```
Escrow created & status = PENDING
     ↓
Recipient receives notification
     ↓
Recipient reviews terms
     ↓
Recipient clicks "Accept"
     ↓
Status changes: ACCEPTED
Mediator notified to review
     ↓
Mediator reviews & approves
     ↓
Sender clicks "Release Funds"
     ↓
API: PUT /api/escrow/:id/release
     ↓
Backend:
  1. Verify both parties accepted
  2. Transfer funds from escrow → recipient
  3. Update escrow status: RELEASED
  4. Record in transaction history
  5. Update both parties' balances
  6. Update trust scores (+2 each)
     ↓
Status: "✅ Released"
Both parties see success notification
```

### Escrow Dispute Flow

```
Escrow status = ACCEPTED
But parties disagree
     ↓
Either party clicks "File Dispute"
     ↓
Modal: Dispute Form
  Reason: [_____] why you disagree
  Evidence: [Upload files...]
     ↓
API: POST /api/escrow/:id/dispute
     ↓
Backend:
  1. Create dispute record
  2. Lock escrow (no automatic release)
  3. Notify mediator immediately
  4. Start 5-7 day review period
     ↓
Status: "⚠️ DISPUTE IN PROGRESS"
Funds remain locked
     ↓
Mediator reviews evidence from both sides
     ↓
Mediator clicks "Make Decision"
     ↓
Modal: Ruling Options
  [ Release 100% to sender ]
  [ Release 100% to recipient ]
  [ Split 50/50 ]
  [ Custom split: _% to each ]
     ↓
API: PUT /api/escrow/:id/resolve
     ↓
Backend:
  1. Calculate split
  2. Transfer funds accordingly
  3. Update status: RESOLVED
  4. Notify both parties
  5. Update trust scores (loser loses -2)
     ↓
Status: "✅ RESOLVED"
Funds distributed per ruling
```

---

## 2. SYSTEM ARCHITECTURE

### Frontend → Backend → Database

```
┌──────────────────────────────────────────────────────────────┐
│ FRONTEND LAYER (React/TypeScript)                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  OkediDashboard                                              │
│  ├─ SendToDAOMember (modal)                                 │
│  │  └─ Search DAO members → Select → Confirm → Send        │
│  │                                                           │
│  ├─ EscrowForm (modal)                                      │
│  │  └─ Create escrow: purpose → parties → amount → terms   │
│  │                                                           │
│  ├─ EscrowDetail (page/modal)                               │
│  │  └─ Show status, timeline, messages, actions             │
│  │                                                           │
│  └─ EscrowList (page)                                       │
│     └─ Browse all escrows with filters                      │
│                                                              │
│  React Query hooks:                                         │
│  • useGetDAOMembers()                                       │
│  • useSendToDAOMember()                                     │
│  • useCreateEscrow()                                        │
│  • useGetEscrow()                                           │
│  • useAcceptEscrow()                                        │
│  • useReleaseEscrow()                                       │
│  • useFileDispute()                                         │
│  • useResolveDispute()                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
           ↓ Fetch/Mutation ↓
┌──────────────────────────────────────────────────────────────┐
│ API LAYER (Express.js)                                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Wallet Routes:                                             │
│  GET  /api/dao/:daoId/members                              │
│  POST /api/wallet/send-to-dao-member                       │
│                                                              │
│  Escrow Routes:                                             │
│  POST   /api/escrow/create                                 │
│  GET    /api/escrow/:id                                    │
│  GET    /api/escrow/user/:userId                           │
│  PUT    /api/escrow/:id/accept                             │
│  PUT    /api/escrow/:id/release                            │
│  POST   /api/escrow/:id/dispute                            │
│  PUT    /api/escrow/:id/resolve                            │
│  POST   /api/escrow/:id/messages                           │
│  GET    /api/escrow/:id/messages                           │
│                                                              │
│  Middleware:                                                │
│  └─ authentication, validation, error handling             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
           ↓ Query/Execute ↓
┌──────────────────────────────────────────────────────────────┐
│ BUSINESS LOGIC LAYER (Services)                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  escrowService.ts:                                          │
│  ├─ createEscrow()                                         │
│  │  └─ Validate, lock funds, create record                 │
│  ├─ acceptEscrow()                                         │
│  │  └─ Update status, notify mediator                      │
│  ├─ releaseEscrow()                                        │
│  │  └─ Verify both agreed, transfer funds                  │
│  ├─ fileDispute()                                          │
│  │  └─ Create dispute, prevent release                     │
│  └─ resolveDispute()                                       │
│     └─ Mediator decision, split funds, update scores       │
│                                                              │
│  walletService.ts:                                          │
│  └─ sendToDAOMember()                                      │
│     └─ Verify recipient in DAO, transfer funds             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
           ↓ SQL Queries ↓
┌──────────────────────────────────────────────────────────────┐
│ DATA LAYER (PostgreSQL + Drizzle ORM)                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Users Table                                                │
│  ├─ id, username, email, balance (wallet)                  │
│  └─ used to verify sender/recipient identity               │
│                                                              │
│  DAOs Table                                                 │
│  └─ id, name, treasury_address, members...                 │
│                                                              │
│  DAO Memberships Table                                      │
│  └─ dao_id, user_id, role, joined_at                       │
│                                                              │
│  Escrow Agreements Table (NEW)                              │
│  ├─ id, senderId, recipientId, mediatorId                  │
│  ├─ amount, currency, purpose, status, terms               │
│  ├─ created/accepted/released/disputed/resolved dates      │
│  └─ mediatorDecision (if disputed)                          │
│                                                              │
│  Escrow Messages Table (NEW)                                │
│  ├─ id, escrowId, userId, message, timestamp               │
│  └─ attachments (JSON)                                      │
│                                                              │
│  Escrow Disputes Table (NEW)                                │
│  ├─ id, escrowId, filedBy, reason, status                  │
│  ├─ evidence (JSON - file links)                            │
│  ├─ mediatorRuling (%) per party                            │
│  └─ resolvedAt timestamp                                    │
│                                                              │
│  Transactions Table (existing)                              │
│  └─ Records all fund movements                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. DATA FLOW DIAGRAMS

### Send to DAO Member Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER INITIATES                                           │
│    Click "Send to DAO Member"                               │
│    Input: daoId                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. FETCH DAO MEMBERS                                        │
│    GET /api/dao/:daoId/members                              │
│    ↓                                                         │
│    Query: SELECT * FROM daoMemberships WHERE daoId = ?     │
│    Join with users table to get usernames                   │
│    ↓                                                         │
│    Return: [ {id, name, avatar, role}, ... ]               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. USER SELECTS RECIPIENT & AMOUNT                          │
│    Input: recipientId, amount, note (optional)              │
│    Validation:                                              │
│    • recipientId != senderId                                │
│    • amount > 0                                             │
│    • amount <= sender.balance                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. SEND PAYMENT                                             │
│    POST /api/wallet/send-to-dao-member                      │
│    {                                                         │
│      daoId,                                                 │
│      recipientUserId,                                       │
│      amount,                                                │
│      note                                                   │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. BACKEND PROCESSING                                       │
│                                                             │
│    Transaction (atomic):                                    │
│    BEGIN TRANSACTION                                        │
│      1. UPDATE users SET balance -= amount WHERE id = ?    │
│      2. INSERT INTO transactions (...)                      │
│      3. UPDATE users SET balance += amount WHERE id = ?    │
│      4. INSERT INTO dao_ledger (...)  [optional]           │
│    COMMIT TRANSACTION                                       │
│                                                             │
│    If any step fails → ROLLBACK                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. NOTIFICATION                                             │
│    Create notification record                               │
│    Send chat message to recipient in DAO chat              │
│    Notify via email/SMS (if enabled)                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. RESPONSE TO FRONTEND                                     │
│    {                                                         │
│      success: true,                                         │
│      data: {                                                │
│        txId, from, to, amount, daoId, timestamp, note      │
│      }                                                      │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. FRONTEND DISPLAYS SUCCESS                                │
│    Show confirmatio with transaction details               │
│    "You sent KES 5,000 to Njeri"                            │
│    [View in Chat]  [Done]                                   │
└─────────────────────────────────────────────────────────────┘
```

### Escrow Release Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER CLICKS "RELEASE FUNDS"                              │
│    escrowId = 123                                           │
│    userRole = "sender"                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. VERIFY ESCROW STATUS                                     │
│    GET /api/escrow/:id                                      │
│    ↓                                                         │
│    Query: SELECT * FROM escrow_agreements WHERE id = ?     │
│    Validate:                                                │
│    • status = "accepted" (both parties agreed)              │
│    • No active dispute                                      │
│    • Caller is sender                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. TRANSFER FUNDS                                           │
│    Transaction (atomic):                                    │
│    BEGIN TRANSACTION                                        │
│                                                             │
│    1. SELECT balance FROM escrow_account                   │
│       WHERE id = ? FOR UPDATE (lock row)                   │
│                                                             │
│    2. UPDATE escrow_accounts                                │
│       SET balance -= amount WHERE id = ?                    │
│                                                             │
│    3. UPDATE users                                          │
│       SET balance += amount WHERE id = recipientId         │
│                                                             │
│    4. INSERT INTO transactions (...)                        │
│       {from: "escrow", to: recipientId, amount, ...}       │
│                                                             │
│    5. UPDATE escrow_agreements                              │
│       SET status = 'released', released_at = NOW()         │
│                                                             │
│    6. UPDATE user_trust_scores                              │
│       sender: +2, recipient: +2                             │
│                                                             │
│    COMMIT TRANSACTION                                       │
│                                                             │
│    If any step fails → ROLLBACK                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. NOTIFICATIONS                                            │
│    • Send to both parties: "Escrow released!"               │
│    • Send to mediator: "Task completed"                     │
│    • Possibly: award mediator a badge/reward                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. RESPONSE                                                 │
│    {                                                         │
│      success: true,                                         │
│      data: {                                                │
│        escrowId, status: "released", releasedAt, txId      │
│      }                                                      │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. FRONTEND UPDATE                                          │
│    Update escrow detail page                                │
│    Show: "✅ Released - Funds sent to recipient"            │
│    Show: Timeline with completion                           │
│    Show: New trust scores (+2 each)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. STATE MANAGEMENT

### Escrow Status State Machine

```
            ┌─────────────────────────────────────────┐
            │  PENDING                                 │
            │  Waiting for recipient to accept        │
            └─────────────────────────────────────────┘
                         ↓
         ┌───────────────┬───────────────┐
         ↓               ↓               ↓
    [Accept]        [Timeout]     [Cancelled]
         ↓               ↓               ↓
         │         [Auto-Reject]    [Refunded]
         │               ↓               ↓
         │           [Refunded]     [CANCELLED] ✗
         │               ↓
         └──────────────→└──────────────────────┐
                                                 ↓
                    ┌────────────────────────────────────┐
                    │  ACCEPTED                          │
                    │  Both agree, mediator reviewing    │
                    └────────────────────────────────────┘
                              ↓
                  ┌──────────┬─┴──────────┐
                  ↓          ↓            ↓
              [Release]  [Dispute]   [Timeout]
                  ↓          ↓            ↓
                  │          │       [Split 50/50]
                  │          │            ↓
                  │    ┌─────┴────────────┘
                  │    ↓
                  │  ┌──────────────────────────┐
                  │  │  DISPUTED                │
                  │  │  Mediator deciding       │
                  │  └──────────────────────────┘
                  │          ↓
                  │    [Mediator Decides]
                  │          ↓
                  │    ┌──────────────────┐
                  │    │  RESOLVED        │
                  │    │  Funds split     │
                  │    └──────────────────┘
                  │          ↓
                  │      [Release]
                  │          ↓
                  └─────→┌──────────────────────────┐
                         │  RELEASED                │
                         │  ✅ Complete             │
                         └──────────────────────────┘
```

### Escrow Parties State (Who sees what)

```
SENDER (who created escrow):
├─ Pending state
│  └─ Waiting message: "Recipient hasn't accepted yet"
├─ Accepted state
│  └─ Action button: [Release Funds] or [View Dispute]
├─ Released state
│  └─ Success: "Funds released ✅" + Reputation +2
├─ Disputed state
│  └─ Read only: Review evidence, wait for mediator
└─ Resolved state
   └─ Result: "Mediator decided in favor of [party]"

RECIPIENT (who receives payment):
├─ Pending state
│  └─ Action button: [Accept] or [Decline]
├─ Accepted state
│  └─ Waiting message: "Sender will release funds"
├─ Released state
│  └─ Success: "Funds received ✅" + Reputation +2
├─ Disputed state
│  └─ Can upload evidence to mediator
└─ Resolved state
   └─ Result: "You received [amount] from mediator ruling"

MEDIATOR (neutral 3rd party):
├─ Pending state
│  └─ No action needed
├─ Accepted state
│  └─ Notification: "Review and approve this escrow"
├─ Released state
│  └─ Not notified (auto-released)
├─ Disputed state
│  └─ Action: Review evidence from both sides
│     [Make Decision] button with options:
│     • 100% to sender
│     • 100% to recipient
│     • 50/50 split
│     • Custom split
└─ Resolved state
   └─ Success: "You resolved this dispute" + Reputation +5
```

---

## 5. Error Handling Flow

```
User initiates transaction
         ↓
Input validation (Frontend)
├─ Invalid? → Show error modal → Stop
└─ Valid? → Continue
         ↓
API request with auth token
├─ No auth? → Redirect to login
├─ Expired? → Refresh token → Retry
└─ Valid? → Continue
         ↓
Backend validation
├─ Insufficient funds?
│  └─ Return 400: "Not enough balance"
│     → Show error: "Your balance is KES X, you need Y"
├─ Invalid recipient?
│  └─ Return 404: "Recipient not found"
│     → Show error: "User is not a member of this DAO"
├─ Already disputed?
│  └─ Return 409: "Escrow already in dispute"
│     → Show error: "Cannot release - dispute in progress"
└─ Valid? → Process transaction
         ↓
Database transaction
├─ Lock conflict?
│  └─ Retry up to 3 times with exponential backoff
├─ Constraint violation?
│  └─ Rollback → Return 500: "Database error"
└─ Success? → Commit
         ↓
Create notification
├─ Email service down?
│  └─ Log error, continue (don't fail transaction)
└─ Success? → Continue
         ↓
Return success response
         ↓
Frontend shows success + next steps
```

---

## 6. Trust Score Calculation

```
ACTION                    IMPACT        CONDITIONS
─────────────────────────────────────────────────────
Send via Escrow (normal)  +2 points     • Must complete to 100%
Release Escrow            +2 points     • Must be both parties
Successful Dispute        0 points      • Mediated fairly
Lose Dispute             -2 points      • Lose the ruling
File False Dispute       -5 points      • Evidence weak, loses
Perfect Record (100+)    +1 bonus       • Every 10 transactions

TRUST SCORE RANGES:
  90-100   🟢 Excellent (can be mediator)
  75-89    🟢 Good (trusted)
  50-74    🟡 Okay (proceed with caution)
  25-49    🟡 Risky (require larger deposits)
  0-24     🔴 Very Risky (limited to small escrows)
```

---

## 7. Mediator Selection Logic

```
User creates escrow with recipient & wants mediator
         ↓
System runs selection algorithm:
         ↓
1. Get all members from recipient's DAO
   └─ Filter: role = "elder" OR role = "treasurer"
         ↓
2. Filter out invalid mediators:
   └─ Is sender? Skip
   └─ Is recipient? Skip
   └─ Trust score < 75? Skip
   └─ Currently mediating another dispute? Skip
         ↓
3. Sort by criteria:
   ├─ Trust score (highest first)
   ├─ Dispute resolution history (fewer unfair rulings first)
   └─ Response time (faster responders first)
         ↓
4. Suggest top 3
   └─ "Suggested Mediators: [1] Sarah [2] James [3] Peter"
         ↓
If user wants different mediator:
└─ Show full list with trust scores
└─ Allow manual selection
```

