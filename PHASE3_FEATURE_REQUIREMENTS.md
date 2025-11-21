# Phase 3: Feature Requirements & Implementation Plan

## Current Context (as of Nov 19, 2025)
- Phase 1: ✅ Complete (Critical bug fixes: founder role, treasurySigners, elder selector)
- Phase 2: ✅ Complete (DAO Type Selector, Dynamic Categories/Treasury, Conditional Governance, Duration Selector)
- **Phase 3: Pending** - Need to implement 3 major features you identified

---

## 📋 Question 1: Custom Rules for DAO Creator

### Current State
❌ **NOT YET IMPLEMENTED**

The DAO creation form currently supports:
- DAO name, description, logo
- DAO type (shortTerm, collective, governance)
- Category selection
- Treasury configuration
- Governance settings (quorum, voting period)

**BUT NO CUSTOM RULES SYSTEM EXISTS**

### What Custom Rules Could Include
1. **Entry Rules**
   - Minimum contribution required per member
   - Approval process for new members (automatic, elder approval, vote)
   - Background/KYC requirements
   - Financial history verification

2. **Withdrawal Rules**
   - Fixed withdrawal days (e.g., every Friday)
   - Maximum withdrawal per member per cycle
   - Waiting period before first withdrawal
   - Emergency withdrawal penalties

3. **Rotation Rules** (For shortTerm DAOs)
   - Custom rotation schedule (fixed dates vs frequency-based)
   - Distribution method (equal split, proportional, lottery)
   - What happens if member misses their rotation turn

4. **Financial Rules**
   - Penalty for late contributions
   - Interest accrual
   - Fee structure for management/operations
   - Minimum/maximum holdings per member

5. **Governance Rules**
   - Required approval authorities for actions
   - Voting thresholds for different proposal types
   - Cool-down periods between proposals

### Implementation Approach

#### Phase 3.1: Rules Engine Architecture
```typescript
// Add to DaoData interface
interface CustomRules {
  id: string;
  ruleType: 'entry' | 'withdrawal' | 'rotation' | 'financial' | 'governance';
  name: string;
  description: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

interface RuleCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

interface RuleAction {
  type: 'approve' | 'reject' | 'notify' | 'apply_penalty' | 'trigger_vote';
  payload: any;
}
```

#### Phase 3.2: Frontend Components
- Rules builder UI with template presets
- Drag-and-drop rule configuration
- Rule preview and testing
- Rule impact calculator

#### Phase 3.3: Backend Implementation
- Store rules in database
- Evaluate rules at transaction time
- Audit trail for rule applications
- Rule versioning for DAO evolution

**Effort Estimate**: 40-60 hours
**Priority**: MEDIUM (valuable but not critical for MVP)

---

## 🔄 Question 2: Rotation Logic & Treasury Depletion

### Current State
⚠️ **PARTIAL IMPLEMENTATION**

**What EXISTS:**
- `rotationFrequency` field in DAO schema (weekly, monthly, quarterly)
- `nextRotationDate` calculated on DAO creation
- `isRotationRecipient` flag in daoMemberships
- `rotationRecipientDate` timestamp

**What's MISSING:**
1. Rotation winner selection algorithm
2. Automated fund distribution on rotation
3. Treasury balance tracking per rotation cycle
4. Handling missed rotations

### Merry-Go-Round Example (Standard Implementation)

**Scenario**: 5 members contribute 1000 cUSD each (5000 total)
- Member A gets 5000 on Month 1
- Member B gets 5000 on Month 2 (after contributions continue)
- ... and so on

### Rotation Logic Needed

#### 1. **Determining Rotation Winner**

```typescript
enum RotationSelectionMethod {
  SEQUENTIAL = 'sequential',        // Predetermined order
  ROUND_ROBIN = 'round_robin',      // Based on contribution timing
  LOTTERY = 'lottery',               // Random selection
  PROPORTIONAL = 'proportional'      // Based on contributions
}

async function selectRotationRecipient(
  daoId: string, 
  rotationCycle: number
): Promise<string> {
  const dao = await getDAO(daoId);
  const members = await getDaoMembers(daoId);
  
  switch (dao.rotationSelectionMethod) {
    case 'SEQUENTIAL':
      return members[rotationCycle % members.length].id;
    
    case 'LOTTERY':
      return selectRandomMember(members);
    
    case 'PROPORTIONAL':
      return selectByContributionAmount(members);
  }
}
```

#### 2. **Treasury Depletion - Is It Expected?**

**YES, for short-term rotation DAOs** ✅

This is THE POINT of a Merry-Go-Round:
- Members contribute regularly (weekly/monthly)
- ONE member gets the entire pot each rotation
- Next rotation, contributions restart
- Cycle continues until all members have received

**Example Timeline:**
```
CYCLE 1 (Month 1):
- 5 members @ 1000 cUSD each = 5000 total
- Member A receives 5000 (treasury depletes to 0)
- Treasury balance: 0 cUSD

CYCLE 2 (Month 2):
- 5 members @ 1000 cUSD each = 5000 total
- Member B receives 5000 (treasury depletes to 0)
- Treasury balance: 0 cUSD

[Cycle 3, 4, 5 same pattern]

After 5 months: All members have received ~5000 cUSD
Total deployed from treasury: 25,000 cUSD
```

**For collective/governance DAOs:**
- Treasury is NOT depleted
- Funds accumulate
- Withdrawals require multi-sig approval
- Long-term vehicle

### Implementation Requirements

#### Phase 3.2: Rotation Engine

```typescript
// Add to DAOs table schema
interface DaoRotationConfig {
  selectionMethod: 'sequential' | 'lottery' | 'proportional';
  contributionFrequency: 'weekly' | 'bi-weekly' | 'monthly';
  rotationCycle: number;           // How many members?
  estimatedCycleDuration: number;  // in days
  totalCycles: number;             // How many rotations total?
}
```

**Backend API Endpoints Needed:**
- `POST /api/dao/:id/rotation/process` - Run rotation on schedule
- `GET /api/dao/:id/rotation/status` - Get current rotation state
- `POST /api/dao/:id/contributions/deposit` - Regular member contributions
- `POST /api/dao/:id/rotation/recipient/:userId/receive` - Distribute funds

**Effort Estimate**: 25-35 hours
**Priority**: HIGH (core feature for shortTerm DAOs)

---

## 👥 Question 3: Invitation System & Member Discovery

### Current State
❌ **NOT FULLY IMPLEMENTED**

**What EXISTS:**
- Members added during DAO creation with wallet addresses
- `isPeerInvite` flag in form
- `status` field in daoMemberships (approved, pending, rejected)

**What's MISSING:**
1. Actual invitation database table
2. Email/SMS notification system
3. Referral link generation
4. Peer invite link tracking
5. Pending invites display in dashboard
6. Accept/reject invite flow

### The Complete Invitation Flow

#### **Phase 3.3.1: Database Schema**

```typescript
// New table needed
export const daoInvitations = pgTable("dao_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  invitedBy: varchar("invited_by").references(() => users.id), // Who sent the invite?
  invitedEmail: varchar("invited_email"), // Email of recipient
  invitedPhone: varchar("invited_phone"), // Phone of recipient
  recipientUserId: varchar("recipient_user_id").references(() => users.id), // If already a user
  role: varchar("role").default("member"), // member, elder, treasurer
  inviteLink: varchar("invite_link").unique(), // Unique URL token
  status: varchar("status").default("pending"), // pending, accepted, rejected, expired
  expiresAt: timestamp("expires_at"), // 30 days default
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  isPeerInvite: boolean("is_peer_invite").default(false), // Member referred by peer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

#### **Phase 3.3.2: Invitation Process**

**Step 1: Founder Creates DAO**
```
Founder enters member addresses/emails during creation
├─ If email: Send invitation
├─ If wallet address: Create pending membership
└─ If existing user: Link directly or send invite
```

**Step 2: Invitations Sent**
```
Email/SMS Notification:
┌─────────────────────────────────────────┐
│ You're invited to join "Mama Savings"   │
│                                         │
│ By: Sarah Kipchoge                      │
│ Role: Member (Peer Invite)             │
│                                         │
│ [Accept Invite] [Decline]              │
│                                         │
│ Link: app.mtaa.com/invite/xyz-token     │
└─────────────────────────────────────────┘
```

**Step 3: Member Accepts Invite**
```
Flow:
1. User clicks invite link
2. If not logged in → Signup/Login required
3. If logged in → Show DAO preview + Accept button
4. Accept → Create daoMembership record (status: approved)
5. Dashboard shows in "DAOs" tab
```

**Step 4: Peer Invites by Existing Members**
```
Existing Member sees:
┌─────────────────────────────────────────┐
│ Invite Others to "Mama Savings"        │
│                                         │
│ Your Peer Invite Link:                 │
│ app.mtaa.com/invite/peer/abc-xyz       │
│ [Copy] [Share on WhatsApp]             │
│                                         │
│ Or invite by email:                    │
│ [Email field] [Send Invite]            │
└─────────────────────────────────────────┘
```

#### **Phase 3.3.3: Frontend Implementation**

**Location 1: Dashboard - "My DAOs" Tab**
```
PENDING INVITES:
┌─────────────────────────────────────────┐
│ 🔔 You have 3 pending invites           │
│                                         │
│ 1. Mama Savings DAO                    │
│    Invited by: Sarah Kipchoge          │
│    [Accept] [Decline]                  │
│                                         │
│ 2. Youth Fund                          │
│    Invited by: James Omondi            │
│    [Accept] [Decline]                  │
│                                         │
│ 3. Community Health Fund               │
│    Invited by: Peer Link               │
│    [Accept] [Decline]                  │
└─────────────────────────────────────────┘

ACTIVE DAOS:
┌─────────────────────────────────────────┐
│ ✓ Mama Savings DAO                     │
│   Members: 12 | Balance: 45,000 cUSD   │
│   Your Role: Member                     │
│   [View] [Details]                     │
└─────────────────────────────────────────┘
```

**Location 2: DAO Members Tab**
```
MEMBERS MANAGEMENT:
┌──────────────────────────────────────────────┐
│ Members (12)  | Pending (3)  | Invited (5)  │
│                                              │
│ PENDING INVITES:                            │
│ ┌──────────────────────────────────────────┐│
│ │ ☐ john@example.com                       ││
│ │   Role: Member | Invited: 3 days ago    ││
│ │   [Resend] [Revoke] [✓ Accepted]        ││
│ │                                          ││
│ │ ☐ +254712345678                         ││
│ │   Role: Elder | Invited: 1 day ago      ││
│ │   [Resend] [Revoke]                     ││
│ │                                          ││
│ │ ☐ jane@example.com                      ││
│ │   Role: Treasurer | Status: Declined    ││
│ │   [Send New Invite] [Remove]            ││
│ └──────────────────────────────────────────┘│
│                                              │
│ [+ Invite More Members]                    │
└──────────────────────────────────────────────┘
```

**Location 3: Accept Invite Screen**
```
User receives email/WhatsApp link → clicks → sees:

┌─────────────────────────────────────────────┐
│ JOIN: "Mama Savings DAO" 💰                │
│                                             │
│ [Logo] Mama Savings DAO                   │
│ Founded by: Sarah Kipchoge                │
│ Type: Short-Term Fund (Merry-Go-Round)   │
│ Members: 11 (including you)               │
│                                             │
│ DETAILS:                                   │
│ • Category: Merry-Go-Round                │
│ • Duration: 60 days                       │
│ • Your Role: Member (Peer Invite)        │
│                                             │
│ ROTATION TERMS:                           │
│ • Monthly rotations                       │
│ • Each member gets ≈45,000 cUSD         │
│ • Next payout: Member 5 on Dec 5        │
│                                             │
│ [Accept & Join] [View More] [Decline]   │
│                                             │
│ Already a member? [Go to Dashboard]      │
└─────────────────────────────────────────────┘
```

#### **Phase 3.3.4: Backend API Endpoints**

```typescript
// Invitation Management
POST   /api/dao/:daoId/invitations                    // Create invitation
GET    /api/dao/:daoId/invitations                    // List invitations
PATCH  /api/dao/:daoId/invitations/:inviteId          // Resend/revoke
DELETE /api/dao/:daoId/invitations/:inviteId          // Delete invitation

// Accept/Reject Invite
POST   /api/invitations/:inviteToken/accept           // Accept invite
POST   /api/invitations/:inviteToken/reject           // Reject invite

// Peer Invites
GET    /api/dao/:daoId/peer-invite-link               // Get peer invite URL
POST   /api/dao/:daoId/members/peer-invite-email      // Send peer invite by email

// Dashboard
GET    /api/invitations/pending                       // Get pending invites for user
GET    /api/dao/my-daos                               // Get user's DAOs
```

#### **Phase 3.3.5: User Flow**

```
SCENARIO 1: Email Invitation
================================
1. Founder enters: "john@example.com" during DAO creation
2. System sends email with unique invite link
3. John receives email → clicks link
4. If not logged in: 
   - Signup with option to auto-fill email
   - Login after signup
5. See DAO preview
6. Click [Accept Invite]
7. Added to DAO as member
8. Email confirmation
9. Dashboard shows DAO in "My DAOs"

SCENARIO 2: Existing User by Wallet
================================
1. Founder enters: "0x123...abc" (Sarah's wallet)
2. System finds user (Sarah) in database
3. Sends in-app notification + email
4. Sarah sees notification
5. Click [Accept] in notification
6. Added to DAO
7. Appears in "My DAOs"

SCENARIO 3: Peer Invite Link
================================
1. Member Jane receives peer invite URL
2. She copies and shares in WhatsApp group
3. Tom clicks link (new user)
4. Tom: [Sign Up] → verify → Join
5. Tom: [Accept] → added to DAO
6. Tom sees DAO in dashboard

SCENARIO 4: Peer Invite by Email
================================
1. Jane in DAO members tab
2. Clicks [Invite More Members]
3. Enters phone: "+254712345678"
4. System sends SMS with invite link
5. Friend receives SMS → clicks
6. Signup/Login → Accept → DAO appears
```

#### **Phase 3.3.6: Database Changes**

**New Table:**
```sql
CREATE TABLE dao_invitations (
  id UUID PRIMARY KEY,
  dao_id UUID NOT NULL REFERENCES daos(id),
  invited_by VARCHAR REFERENCES users(id),
  invited_email VARCHAR,
  invited_phone VARCHAR,
  recipient_user_id VARCHAR REFERENCES users(id),
  role VARCHAR DEFAULT 'member',
  invite_link VARCHAR UNIQUE NOT NULL,
  status VARCHAR DEFAULT 'pending',
  expires_at TIMESTAMP,
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  is_peer_invite BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invite_link ON dao_invitations(invite_link);
CREATE INDEX idx_dao_pending ON dao_invitations(dao_id, status);
CREATE INDEX idx_recipient_pending ON dao_invitations(recipient_user_id, status);
```

**Modified Table (daoMemberships):**
```sql
ALTER TABLE dao_memberships 
ADD COLUMN invitation_id UUID REFERENCES dao_invitations(id);
```

**Effort Estimate**: 35-50 hours
**Priority**: HIGH (critical for user onboarding)

---

## 🎯 Implementation Timeline

### Phase 3 Roadmap

| Phase | Feature | Hours | Priority | Dependencies |
|-------|---------|-------|----------|--------------|
| 3.1 | Custom Rules Engine | 50h | MEDIUM | None |
| 3.2 | Rotation Logic | 30h | HIGH | None |
| 3.3 | Invitation System | 45h | HIGH | User model |
| 3.4 | Testing & Polish | 15h | HIGH | All above |

**Total Estimated Effort**: ~140 hours (3-4 weeks)

---

## 🔍 Summary of Answers

### Q1: Can DAO creator add custom rules?
**Currently**: ❌ No
**Solution**: Implement rules engine (Phase 3.1) with template presets
**Impact**: Highly customizable DAOs, handles complex governance

### Q2: How is rotation determined & does treasury deplete?
**Currently**: ⚠️ Partial (schema exists, logic missing)
**Solution**: Implement rotation selection algorithm (Phase 3.2)
**Impact**: Merry-go-round DAOs work as intended, treasury DOES deplete (by design)

### Q3: How do members get invited & see pending invites?
**Currently**: ❌ Not implemented
**Solution**: Complete invitation system (Phase 3.3)
**Impact**: Smooth onboarding, visible pending invites in dashboard

---

## Next Steps

1. **Confirm Priority**: Which feature to implement first?
2. **Design Decisions**: 
   - Custom rules: Simple presets or advanced builder?
   - Rotation: Which selection method to default to?
   - Invites: Email/SMS/both? Expiry duration?
3. **Implementation**: Ready to build any of these?

