# 🎤 OKEDI Implementation Plan - First 2 Weeks

## Overview

**Goal**: Build the Okedi dashboard with core features (Send to DAO Member, Escrow, Dashboard Isolation)

**Timeline**: 2 weeks (80 hours)

**Team Size**: 1-2 developers (backend + frontend)

**Deliverables**:
- ✅ Okedi Dashboard isolated from other subprofiles
- ✅ Send to DAO Member feature fully working
- ✅ Escrow system schema and basic CRUD
- ✅ DAO Chat integration (display only, no new build)
- ✅ Settings page with subprofile switcher

---

## WEEK 1: Foundation & Infrastructure

### Day 1-2: Dashboard Isolation (16 hours)

#### Tasks:

**1.1 Split PersonalizedDashboard.tsx** (8 hours)
```
Current File: client/src/components/dashboard/PersonalizedDashboard.tsx (485 lines)

Create New Files:
├── client/src/components/dashboard/OkediDashboard.tsx (350 lines)
├── client/src/components/dashboard/YukiDashboard.tsx (350 lines - placeholder)
├── client/src/components/dashboard/AmaraDashboard.tsx (350 lines - placeholder)
└── client/src/components/dashboard/PersonalizedDashboard.tsx (refactored, 100 lines - router)

OkediDashboard.tsx should include:
• Personal balance card (from wallet)
• Quick actions: Receive, Send to DAO, Escrow, Send Money
• My DAOs & Governance section
• Active proposals panel
• Community chat integration
```

**1.2 Backend Dashboard Endpoint Separation** (8 hours)
```
Current: GET /api/dashboard/:persona

New Endpoints:
├── GET /api/dashboard/okedi (OKEDI data)
│   ├── Personal balance
│   ├── DAOs (created & joined)
│   ├── Active proposals
│   ├── Treasury balances
│   └── Chat summary
├── GET /api/dashboard/yuki (YUKI placeholder)
└── GET /api/dashboard/amara (AMARA placeholder)

File: server/routes/dashboard.ts (add new route handlers)
```

**Files to Create/Modify**:
- ✅ client/src/components/dashboard/OkediDashboard.tsx (NEW)
- ✅ client/src/components/dashboard/PersonalizedDashboard.tsx (REFACTOR)
- ✅ server/routes/dashboard.ts (MODIFY)
- ✅ client/src/contexts/persona-context.tsx (ENSURE it passes subprofile to dashboard)

**Testing**:
- [ ] Switch between subprofiles, verify dashboard changes
- [ ] Check API response time for /api/dashboard/okedi
- [ ] Verify all Okedi components render correctly

---

### Day 3: Database Schema for Escrow (8 hours)

#### Tasks:

**3.1 Create Escrow Tables** (4 hours)
```sql
-- In shared/schema.ts

CREATE TABLE escrow_agreements (
  id UUID PRIMARY KEY
  daoId UUID (OPTIONAL - if escrow is DAO-specific)
  senderId VARCHAR(255) REFERENCES users(id)
  recipientId VARCHAR(255) REFERENCES users(id)
  mediatorId VARCHAR(255) REFERENCES users(id)
  amount DECIMAL(18, 8)
  currency VARCHAR(20) DEFAULT 'KES'
  purpose VARCHAR(100) -- goods, service, loan, other
  status VARCHAR(50) -- pending, accepted, released, disputed, resolved, cancelled
  terms TEXT -- Description of release conditions
  createdAt TIMESTAMP DEFAULT NOW()
  acceptedAt TIMESTAMP (NULLABLE)
  releasedAt TIMESTAMP (NULLABLE)
  disputedAt TIMESTAMP (NULLABLE)
  resolvedAt TIMESTAMP (NULLABLE)
  mediatorDecision TEXT (NULLABLE)
  fundHeldAt TIMESTAMP (NULLABLE) -- When funds moved to escrow
)

CREATE TABLE escrow_messages (
  id UUID PRIMARY KEY
  escrowId UUID REFERENCES escrow_agreements(id)
  userId VARCHAR(255) REFERENCES users(id)
  message TEXT
  attachments JSONB (OPTIONAL)
  createdAt TIMESTAMP DEFAULT NOW()
)

CREATE TABLE escrow_disputes (
  id UUID PRIMARY KEY
  escrowId UUID REFERENCES escrow_agreements(id)
  filedBy VARCHAR(255) REFERENCES users(id)
  reason TEXT
  evidence JSONB -- Links to attachments
  filedAt TIMESTAMP DEFAULT NOW()
  resolvedAt TIMESTAMP (NULLABLE)
  mediatorRuling DECIMAL(18, 8) -- Amount released to each party
  status VARCHAR(50) -- pending, under_review, resolved
)
```

**3.2 Migration File** (4 hours)
```
File: DATABASE_MIGRATION_ESCROW.sql
└── Contains all CREATE TABLE statements above
└── Includes indexes for common queries
└── Update shared/schema.ts with TypeScript types
```

**Files to Create/Modify**:
- ✅ shared/schema.ts (ADD escrow tables & types)
- ✅ DATABASE_MIGRATION_ESCROW.sql (NEW migration)
- ✅ server/storage.ts (ADD escrow CRUD functions)

**Testing**:
- [ ] Migration runs without errors
- [ ] All tables created with correct columns
- [ ] Foreign key relationships work
- [ ] Can insert/query test data

---

### Day 4-5: Escrow API Routes (16 hours)

#### Tasks:

**5.1 Create Escrow Routes** (8 hours)
```
File: server/routes/escrow.ts (NEW - 300+ lines)

Routes:
POST   /api/escrow/create              - Create new escrow
GET    /api/escrow/:id                 - Get escrow details
GET    /api/escrow/user/:userId        - Get all escrows for user
PUT    /api/escrow/:id/accept          - Recipient accepts terms
PUT    /api/escrow/:id/release         - Both agree, release funds
POST   /api/escrow/:id/dispute         - File dispute
PUT    /api/escrow/:id/resolve         - Mediator resolves dispute
POST   /api/escrow/:id/messages        - Add message to escrow
GET    /api/escrow/:id/messages        - Get escrow messages

Authorization:
├── Only sender can create
├── Only recipient/sender can view their escrows
├── Only mediator can resolve
└── Only sender can cancel before acceptance
```

**5.2 Escrow Service Logic** (8 hours)
```
File: server/services/escrowService.ts (NEW - 250+ lines)

Functions:
├── createEscrow(params)
│   ├── Validate sender has funds
│   ├── Lock funds in escrow account
│   ├── Create agreement record
│   ├── Notify recipient & mediator
│   └── Return escrow details
├── acceptEscrow(escrowId, userId)
│   ├── Verify user is recipient
│   ├── Update status
│   ├── Notify parties
│   └── Start mediator review timer
├── releaseEscrow(escrowId)
│   ├── Verify both parties agreed
│   ├── Transfer funds to recipient
│   ├── Update ledger
│   └── Notify all parties
├── fileDispute(escrowId, reason, evidence)
│   ├── Create dispute record
│   ├── Notify mediator
│   ├── Start 5-7 day review period
│   └── Lock funds until resolved
└── resolveDispute(escrowId, mediatorDecision)
    ├── Calculate split based on decision
    ├── Release funds accordingly
    ├── Record decision
    └── Update trust scores
```

**Files to Create/Modify**:
- ✅ server/routes/escrow.ts (NEW)
- ✅ server/services/escrowService.ts (NEW)
- ✅ server/storage.ts (ADD escrow queries)
- ✅ server/index.ts or main router (IMPORT & USE escrow routes)

**Testing**:
- [ ] POST /api/escrow/create - creates escrow successfully
- [ ] GET /api/escrow/:id - retrieves correct escrow
- [ ] PUT /api/escrow/:id/accept - updates status
- [ ] PUT /api/escrow/:id/release - transfers funds
- [ ] POST /api/escrow/:id/dispute - creates dispute
- [ ] Error handling for edge cases (insufficient funds, invalid mediator, etc.)

---

## WEEK 2: Frontend & Send to DAO Member

### Day 1-2: Send to DAO Member Feature (16 hours)

#### Tasks:

**1.1 Backend Route for DAO Member Lookup** (4 hours)
```
File: server/routes/wallet.ts or daos.ts (MODIFY)

New Route:
GET /api/dao/:daoId/members
  ├── Returns list of all members in DAO
  ├── Include: userId, name, avatar, role
  ├── Used for autocomplete in Send modal
  └── Cache for 5 minutes

Response:
{
  success: true,
  data: [
    { id: "user-123", name: "Njeri", avatar: "...", role: "member" },
    { id: "user-456", name: "James", avatar: "...", role: "elder" }
  ]
}
```

**1.2 Backend Route for Send to DAO Member** (4 hours)
```
File: server/routes/wallet.ts (MODIFY)

New Route:
POST /api/wallet/send-to-dao-member
  Body: {
    daoId: string
    recipientUserId: string
    amount: number
    note?: string
  }
  
Logic:
├── Verify sender has funds
├── Verify recipient is DAO member
├── Create transaction record
├── Record in DAO ledger
├── Create notification
└── Return transaction details

Response:
{
  success: true,
  data: {
    txId: "tx-123",
    from: "user-789",
    to: "user-123",
    amount: 5000,
    currency: "KES",
    daoId: "dao-456",
    timestamp: "2025-01-27T...",
    note: "Payment for event supplies"
  }
}
```

**1.3 Frontend Components** (8 hours)
```
Files:
├── client/src/components/SendToDAOMember.tsx (250 lines)
│   ├── Modal/Dialog component
│   ├── DAO member autocomplete
│   ├── Amount input
│   ├── Optional note
│   ├── Confirmation modal
│   └── Success feedback
│
└── client/src/components/SendToDAOMemberButton.tsx (50 lines)
    └── Compact button that opens modal

Features:
• Search/filter members by name
• Show member role & DAO
• Favorite/recent members for quick access
• Character limit for note (200 chars)
• Estimated transaction time
• Success notification with chat link
```

**Files to Create/Modify**:
- ✅ server/routes/wallet.ts (ADD 2 routes)
- ✅ client/src/components/SendToDAOMember.tsx (NEW)
- ✅ client/src/components/dashboard/OkediDashboard.tsx (ADD button)

**Testing**:
- [ ] GET /api/dao/:daoId/members returns correct data
- [ ] POST /api/wallet/send-to-dao-member creates transaction
- [ ] Frontend modal opens/closes correctly
- [ ] Autocomplete filters work
- [ ] Can't send to self
- [ ] Can't send more than balance
- [ ] Success message displays transaction details

---

### Day 3-4: Escrow Frontend (16 hours)

#### Tasks:

**3.1 Escrow Create Component** (6 hours)
```
File: client/src/components/EscrowForm.tsx (300 lines)

Features:
├── Purpose selector (goods, service, loan, other)
├── Recipient lookup (search users/DAOs)
├── Amount input with currency selector
├── Terms/description textarea (500 chars)
├── Mediator selection
│   ├── Auto-suggest based on DAO
│   ├── Manual selection from dropdown
│   └── Show mediator reputation
├── Review summary before submit
└── Success confirmation

Validation:
• Amount must be > 0
• Recipient must exist & not be self
• Mediator must be different from sender/recipient
• Terms must be detailed (min 20 chars)
• User must have sufficient funds
```

**3.2 Escrow Status/Detail Component** (6 hours)
```
File: client/src/components/EscrowDetail.tsx (400 lines)

Features:
├── Display escrow status with timeline
├── Show sender/recipient/mediator info
├── Terms & agreement text
├── Messages/comments section
├── Action buttons based on role:
│   ├── Recipient: [Accept/Reject]
│   ├── Sender: [Cancel if pending] [Release if accepted]
│   └── Mediator: [View dispute evidence] [Make ruling]
├── Dispute section (if disputed)
├── Timeline visualization
└── Success state with reputation update

Status Flow:
Pending (waiting) → Accepted (both agree) → Released (funds sent)
                 → Disputed (disagreement) → Resolved (mediator decides)
```

**3.3 Escrow List Component** (4 hours)
```
File: client/src/components/EscrowList.tsx (200 lines)

Features:
├── List all user's escrows
├── Filter by status: All, Pending, Active, Completed, Disputed
├── Sort by date, amount, status
├── Quick view: amount, parties, status, timeline
└── Click to view details
```

**Files to Create/Modify**:
- ✅ client/src/components/EscrowForm.tsx (NEW)
- ✅ client/src/components/EscrowDetail.tsx (NEW)
- ✅ client/src/components/EscrowList.tsx (NEW)
- ✅ client/src/components/dashboard/OkediDashboard.tsx (ADD section for active escrows)

**Testing**:
- [ ] Create escrow modal opens/closes
- [ ] Form validation works
- [ ] Can select recipient
- [ ] Can select mediator
- [ ] Escrow detail shows correct status
- [ ] Recipient can accept
- [ ] Both can release
- [ ] Dispute flow works

---

### Day 5: Integration & Polish (8 hours)

#### Tasks:

**5.1 Add to OkediDashboard** (4 hours)
```
Update: client/src/components/dashboard/OkediDashboard.tsx

Add sections:
├── "Quick Actions" buttons (Receive, Send to DAO, Escrow, Send Money)
├── "Active Escrows" panel showing in-progress escrows
├── Notifications for pending escrow actions
└── Link to full Escrow list page
```

**5.2 Create Escrow List Page** (2 hours)
```
File: client/src/pages/EscrowList.tsx (150 lines)
└── Full-page view of all escrows with filters & sorting
```

**5.3 Error Handling & Edge Cases** (2 hours)
```
Handle:
├── Insufficient funds
├── User not in DAO for Send to DAO Member
├── Invalid mediator selection
├── Network errors
├── Timeout during transaction
└── Permission denied (wrong user trying to access)
```

**Files to Create/Modify**:
- ✅ client/src/components/dashboard/OkediDashboard.tsx (MODIFY)
- ✅ client/src/pages/EscrowList.tsx (NEW)
- ✅ client/src/pages/Wallet.tsx (MODIFY - add Send to DAO button)

---

## Implementation Checklist

### Week 1
- [ ] Day 1-2: Dashboard Isolation
  - [ ] OkediDashboard.tsx created
  - [ ] PersonalizedDashboard.tsx refactored as router
  - [ ] Backend /api/dashboard/okedi endpoint created
  - [ ] Tests passing for dashboard switching
  
- [ ] Day 3: Escrow Schema
  - [ ] All escrow tables created in schema.ts
  - [ ] Migration file written
  - [ ] TypeScript types defined
  - [ ] Database migration tested

- [ ] Day 4-5: Escrow API
  - [ ] All 8 escrow routes created
  - [ ] escrowService.ts with business logic
  - [ ] Error handling & validation
  - [ ] API tests passing

### Week 2
- [ ] Day 1-2: Send to DAO Member
  - [ ] GET /api/dao/:daoId/members endpoint
  - [ ] POST /api/wallet/send-to-dao-member endpoint
  - [ ] SendToDAOMember.tsx component
  - [ ] Integration in OkediDashboard
  - [ ] Tests passing

- [ ] Day 3-4: Escrow Frontend
  - [ ] EscrowForm.tsx with full flow
  - [ ] EscrowDetail.tsx showing status
  - [ ] EscrowList.tsx for browsing
  - [ ] Timeline visualization
  - [ ] All user interactions tested

- [ ] Day 5: Polish & Integration
  - [ ] OkediDashboard fully updated
  - [ ] EscrowList page created
  - [ ] Error handling complete
  - [ ] Documentation written

---

## File Summary (End of Week 2)

### New Files Created
```
client/src/
├── components/
│   ├── dashboard/
│   │   ├── OkediDashboard.tsx (350 lines) ✨ NEW
│   │   ├── PersonalizedDashboard.tsx (100 lines - refactored)
│   ├── SendToDAOMember.tsx (250 lines) ✨ NEW
│   ├── SendToDAOMemberButton.tsx (50 lines) ✨ NEW
│   ├── EscrowForm.tsx (300 lines) ✨ NEW
│   ├── EscrowDetail.tsx (400 lines) ✨ NEW
│   └── EscrowList.tsx (200 lines) ✨ NEW
└── pages/
    └── EscrowList.tsx (150 lines) ✨ NEW

server/
├── routes/
│   ├── escrow.ts (300 lines) ✨ NEW
│   └── wallet.ts (MODIFIED - add 2 routes)
├── services/
│   └── escrowService.ts (250 lines) ✨ NEW
└── storage.ts (MODIFIED - add escrow queries)

shared/
└── schema.ts (MODIFIED - add escrow tables)

Database/
└── DATABASE_MIGRATION_ESCROW.sql ✨ NEW
```

### Lines of Code Added
- Frontend: ~1,700 lines
- Backend: ~550 lines
- Database: ~100 lines
- **Total: ~2,350 lines**

---

## Testing Strategy

### Unit Tests
```typescript
// escrowService.test.ts
• createEscrow creates record & locks funds
• acceptEscrow updates status correctly
• releaseEscrow transfers funds to recipient
• fileDispute prevents release
• resolveDispute splits funds per decision

// SendToDAOMember.test.ts
• Component renders with modal closed
• Autocomplete filters members correctly
• Can submit with valid data
• Shows error with invalid recipient
• Calls API endpoint correctly
```

### Integration Tests
```typescript
// E2E: Send to DAO Member
1. User clicks "Send to DAO Member"
2. Modal opens
3. User searches & selects recipient
4. User enters amount
5. User reviews & confirms
6. API call succeeds
7. Transaction appears in history
8. Chat notification sent

// E2E: Create & Release Escrow
1. User creates escrow agreement
2. Recipient accepts terms
3. Sender releases funds
4. Funds appear in recipient wallet
5. Reputation scores updated
6. Transaction history updated
```

### Manual QA Checklist
- [ ] Dashboard displays Okedi content correctly
- [ ] Send to DAO Member works with valid recipient
- [ ] Can't send to invalid recipient
- [ ] Escrow creation validates all fields
- [ ] Escrow status updates in real-time
- [ ] Mediator can resolve disputes
- [ ] All error messages are clear
- [ ] Mobile responsive design
- [ ] Notifications work correctly

---

## Known Challenges & Mitigation

| Challenge | Solution |
|-----------|----------|
| Escrow funds locking/releasing | Use transaction DB + manual ledger updates (not smart contract) |
| Mediator selection | Auto-suggest from DAO elders, manual fallback |
| Dispute resolution | Clear evidence upload, mediator has 5-7 days to decide |
| Network race conditions | Optimistic updates with rollback on error |
| Reputation gaming | Dispute resolution affects both parties' scores |

---

## Success Criteria (End of Week 2)

✅ Okedi dashboard completely isolated from other subprofiles
✅ Send to DAO Member fully functional for 5+ transactions
✅ Escrow system handles create/accept/release flow
✅ Can file & resolve disputes with mediator
✅ All tests passing (unit + integration)
✅ No console errors or warnings
✅ Mobile responsive design working
✅ Documentation complete
✅ Ready for QA testing by Week 3

