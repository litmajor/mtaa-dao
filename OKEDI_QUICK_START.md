# 🎤 OKEDI Implementation - Quick Start Reference

## What We're Building (Next 2 Weeks)

### Core Features
1. **Okedi Dashboard** (Isolated from other subprofiles)
   - Personal balance display
   - DAO governance focus
   - Community chat hub

2. **Send to DAO Member** (MTAA's unique feature)
   - Send directly to DAO member accounts
   - Search/autocomplete members
   - Primary action in wallet

3. **Escrow System** (Trust-based transactions)
   - Create agreements with mediators
   - Release funds when both agree
   - Dispute resolution with mediator ruling

---

## Essential Files (Start Here)

### Documentation
```
Read in this order:
1. OKEDI_VISUAL_MOCKUPS.md       ← See what it looks like
2. OKEDI_IMPLEMENTATION_2WEEKS.md ← See how to build it
3. SUBPROFILE_CAPABILITY_MATRIX.md ← Reference what Okedi can do
```

### Reference Images
All screens shown in `OKEDI_VISUAL_MOCKUPS.md`:
- Okedi Main Dashboard
- Send to DAO Member flow (3 screens)
- Escrow creation & management (4 screens)
- Community chat integration
- Settings / Subprofile switcher

---

## Architecture Overview

```
OKEDI SYSTEM LAYERS:

┌─────────────────────────────────────────┐
│ FRONTEND - User Interface                │
├─────────────────────────────────────────┤
│ OkediDashboard.tsx                      │
│ ├── SendToDAOMember.tsx                 │
│ ├── EscrowForm.tsx                      │
│ ├── EscrowDetail.tsx                    │
│ └── EscrowList.tsx                      │
├─────────────────────────────────────────┤
│ API Calls / React Query                 │
├─────────────────────────────────────────┤
│ BACKEND - API Routes                     │
├─────────────────────────────────────────┤
│ server/routes/                          │
│ ├── escrow.ts (8 routes)                │
│ ├── wallet.ts (2 new routes)            │
│ └── dashboard.ts (okedi endpoint)       │
├─────────────────────────────────────────┤
│ BUSINESS LOGIC - Services               │
├─────────────────────────────────────────┤
│ server/services/                        │
│ └── escrowService.ts                    │
├─────────────────────────────────────────┤
│ DATABASE - Schema & Queries              │
├─────────────────────────────────────────┤
│ shared/schema.ts (escrow tables)        │
│ server/storage.ts (escrow queries)      │
└─────────────────────────────────────────┘
```

---

## 2-Week Timeline (High Level)

### WEEK 1: Foundation

**Days 1-2: Dashboard Isolation (16h)**
- Split PersonalizedDashboard into Okedi/Yuki/Amara
- Create GET /api/dashboard/okedi
- Start: Okedi only shows governance & wallet

**Day 3: Database Schema (8h)**
- Create 3 escrow tables in PostgreSQL
- Define TypeScript types
- Write migration file

**Days 4-5: Escrow API (16h)**
- Build 8 escrow routes (create, accept, release, etc.)
- Implement escrowService.ts with business logic
- Test all endpoints

### WEEK 2: Features & Polish

**Days 1-2: Send to DAO Member (16h)**
- GET /api/dao/:daoId/members endpoint
- POST /api/wallet/send-to-dao-member endpoint
- SendToDAOMember.tsx component
- Integration into OkediDashboard

**Days 3-4: Escrow Frontend (16h)**
- EscrowForm.tsx (create escrow with validation)
- EscrowDetail.tsx (show status & timeline)
- EscrowList.tsx (browse all escrows)
- Handle all statuses: pending → accepted → released

**Day 5: Integration (8h)**
- Add buttons to OkediDashboard
- Create /pages/EscrowList page
- Error handling & edge cases
- Polish & final testing

---

## Database Schema (Quick Reference)

### Tables to Create

```sql
-- 1. Escrow Agreements (main table)
escrow_agreements (
  id, daoId, senderId, recipientId, mediatorId, 
  amount, currency, purpose, status, terms,
  createdAt, acceptedAt, releasedAt, ...
)

-- 2. Escrow Messages (comments/thread)
escrow_messages (
  id, escrowId, userId, message, attachments, createdAt
)

-- 3. Escrow Disputes (if disagreement)
escrow_disputes (
  id, escrowId, filedBy, reason, evidence, 
  status, mediatorRuling, ...
)
```

### Key Status Values
```
Pending    → Waiting for recipient to accept
Accepted   → Both parties agree, mediator reviewing
Released   → Funds sent to recipient ✅
Disputed   → Parties disagree, mediator deciding
Resolved   → Dispute settled, funds distributed
Cancelled  → Sender cancelled before acceptance
```

---

## API Endpoints (Quick Reference)

### Escrow Routes (server/routes/escrow.ts)
```
POST   /api/escrow/create              Create new escrow
GET    /api/escrow/:id                 Get escrow details
GET    /api/escrow/user/:userId        Get user's escrows
PUT    /api/escrow/:id/accept          Accept as recipient
PUT    /api/escrow/:id/release         Release funds
POST   /api/escrow/:id/dispute         File dispute
PUT    /api/escrow/:id/resolve         Mediator resolves
POST   /api/escrow/:id/messages        Add message
GET    /api/escrow/:id/messages        Get messages
```

### Wallet Routes (server/routes/wallet.ts)
```
GET    /api/dao/:daoId/members         Get DAO members
POST   /api/wallet/send-to-dao-member  Send to DAO member
```

### Dashboard Route (server/routes/dashboard.ts)
```
GET    /api/dashboard/okedi            Get Okedi dashboard data
```

---

## Component Structure

### Frontend Components (React)

```
OkediDashboard.tsx (Main container)
├── PersonalBalanceCard
├── QuickActionsBar
│   ├── ReceiveButton
│   ├── SendToDAOMemberButton ← Triggers modal
│   ├── EscrowButton ← Triggers modal
│   └── SendButton
├── MyDAOsSection
├── ActiveProposalsPanel
├── ActiveEscrowsPanel
├── CommunityChat (from dao-chat.tsx)
└── NavigationFooter

SendToDAOMember.tsx (Modal)
├── SearchBar (autocomplete members)
├── AmountInput
├── NoteInput
├── ConfirmationModal
└── SuccessScreen

EscrowForm.tsx (Modal)
├── PurposeSelector
├── RecipientSearch
├── AmountInput
├── TermsInput
├── MediatorSelector
├── ReviewModal
└── SuccessScreen

EscrowDetail.tsx (Page/Modal)
├── StatusTimeline
├── PartyInfo (sender, recipient, mediator)
├── TermsDisplay
├── MessagesThread
├── DisputeSection (if disputed)
└── ActionButtons (based on role)

EscrowList.tsx (Page)
├── FilterBar
├── SortOptions
├── EscrowCards (clickable → detail)
└── EmptyState
```

---

## Key Design Decisions

### 1. Escrow Funds Management
**Decision**: Store funds in separate "escrow" account (not smart contract)
**Why**: Simpler, faster, no blockchain needed for MTAA community use
**How**: 
- When escrow created: Move funds from sender to escrow account
- When released: Move funds from escrow to recipient
- When disputed: Hold in escrow until mediator decides

### 2. Mediator Selection
**Decision**: Auto-suggest DAO elders, allow manual selection
**Why**: Elders are trusted, but allows flexibility
**How**:
- Get all "elder" role members from DAO
- Sort by trust score
- Allow manual search if user wants different mediator

### 3. Dispute Resolution
**Decision**: Mediator can split funds (not just winner-take-all)
**Why**: Reflects real-world mediation (compromise)
**How**:
- Mediator chooses: 100% to sender, 100% to recipient, or custom split
- Must provide reasoning
- Both parties notified

### 4. Dashboard Isolation
**Decision**: Same app, but different dashboard per subprofile
**Why**: Simpler than separate apps, all features still accessible
**How**:
- OkediDashboard focuses on governance
- Yuki/Amara show different sections
- All features still available (just not highlighted)

---

## Testing Strategy

### What to Test

```
ESCROW CREATION:
✓ Create with valid params
✓ Reject insufficient funds
✓ Reject invalid recipient
✓ Reject invalid mediator
✓ Lock funds in escrow account

ESCROW ACCEPTANCE:
✓ Recipient can accept
✓ Update status to "accepted"
✓ Notify mediator
✓ Only recipient can accept

ESCROW RELEASE:
✓ Both parties must agree
✓ Transfer funds correctly
✓ Update recipient balance
✓ Clear escrow account
✓ Mark as "released"

ESCROW DISPUTE:
✓ Either party can dispute
✓ Stop automatic release
✓ Notify mediator
✓ Allow evidence upload

SEND TO DAO MEMBER:
✓ Search finds members
✓ Can send valid amount
✓ Recipient receives funds
✓ Chat notification sent
✓ Can't send to self
✓ Can't send more than balance
```

### Test Files to Create
```
client/src/__tests__/
├── SendToDAOMember.test.tsx
├── EscrowForm.test.tsx
└── EscrowDetail.test.tsx

server/__tests__/
├── escrow.routes.test.ts
└── escrowService.test.ts
```

---

## Dependencies (Already Installed)

```typescript
// Frontend (already have)
@tanstack/react-query       // API calls
react-router-dom            // Routing
lucide-react                // Icons
date-fns                    // Date formatting
zod                         // Validation

// Backend (already have)
express                     // Server
drizzle-orm                 // Database
@auth0/auth0-node           // Auth

// New installations needed: NONE
```

---

## Common Gotchas & Solutions

### Issue 1: Race Condition on Escrow Release
**Problem**: Both parties click release simultaneously
**Solution**: Use transaction lock on escrow_agreements table
```sql
UPDATE escrow_agreements 
SET status = 'released' 
WHERE id = ? AND status = 'accepted'
```

### Issue 2: Mediator Self-Selection
**Problem**: User selects self as mediator (invalid)
**Solution**: Frontend validation + backend check
```typescript
if (mediatorId === senderId || mediatorId === recipientId) {
  throw new Error("Mediator must be different from parties");
}
```

### Issue 3: Funds Already Spent Before Escrow Created
**Problem**: User creates escrow but spends funds before acceptance
**Solution**: 
- Don't immediately lock funds (just mark as "escrow pending")
- Lock when recipient accepts
- Or: Lock immediately but allow use if escrow cancelled

**Chosen**: Lock immediately to be safe

### Issue 4: Mediator Never Responds
**Problem**: Mediator goes offline, escrow stuck
**Solution**:
- 7-day auto-resolve timeout (split 50/50)
- Notify mediator repeatedly
- Allow escalation to admin

---

## Performance Considerations

### Database Indexes Needed
```sql
-- Speed up lookups by user
CREATE INDEX idx_escrow_sender ON escrow_agreements(senderId);
CREATE INDEX idx_escrow_recipient ON escrow_agreements(recipientId);
CREATE INDEX idx_escrow_mediator ON escrow_agreements(mediatorId);

-- Speed up status queries
CREATE INDEX idx_escrow_status ON escrow_agreements(status);

-- Speed up recent escrows
CREATE INDEX idx_escrow_created ON escrow_agreements(createdAt DESC);
```

### API Response Caching
```typescript
// Cache DAO members for 5 minutes
GET /api/dao/:daoId/members
  .cache(5 * 60 * 1000)

// Don't cache escrow details (real-time)
GET /api/escrow/:id
  .noCache()
```

---

## Next Steps After Week 2

### Immediate (Week 3)
- [ ] QA testing with real users
- [ ] Fix bugs from testing
- [ ] Performance optimization
- [ ] Security review (fund locking/releasing)

### Then (Week 4+)
- [ ] Start Yuki (Bot Builder) features
- [ ] Or start Amara (Hedge Fund) features
- [ ] DAO Chat enhancement (reactions, file upload)

---

## Quick Navigation

### Files by Purpose

**Want to add a new Escrow route?**
→ Edit: `server/routes/escrow.ts`

**Want to add business logic?**
→ Edit: `server/services/escrowService.ts`

**Want to change database?**
→ Edit: `shared/schema.ts` + create migration

**Want to update UI?**
→ Edit: `client/src/components/Escrow*.tsx`

**Want to fix a query?**
→ Edit: `server/storage.ts`

---

## Definitions (For Reference)

**Escrow**: Money held by neutral 3rd party until conditions are met

**Mediator**: Trusted person who resolves disputes

**Dispute**: When sender/recipient disagree on release

**DAOMember**: User who joined a DAO

**Trust Score**: Reputation number (0-100) based on activity

---

## Need More Detail?

- 📖 Full visual mockups → See `OKEDI_VISUAL_MOCKUPS.md`
- 📋 Detailed task breakdown → See `OKEDI_IMPLEMENTATION_2WEEKS.md`
- 🎯 All Okedi features → See `SUBPROFILE_CAPABILITY_MATRIX.md`
- 🛠️ Total roadmap (Yuki & Amara) → See `SUBPROFILE_CRITICAL_FEATURES_ROADMAP.md`

