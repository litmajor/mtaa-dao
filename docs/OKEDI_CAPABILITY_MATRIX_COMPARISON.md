# OKEDI Dashboard - Feature Capability Matrix

**Current Date:** January 27, 2026  
**Status:** Skeleton implementation with gaps identified  
**Last Updated:** Today

---

## 📋 WALLET/BANKING FEATURES

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| **Personal Balance** | ✅ IMPLEMENTED | Balance Card (Top) | Shows total in USD, trend indicator |
| **Send to DAO Members** | ✅ IMPLEMENTED | SendToDAOMemberModal | Full 4-step wizard, escrow support |
| **Send to Other Users** | ❌ MISSING | — | Would need separate "Send to User" flow |
| **Send to External Addresses** | ❌ MISSING | — | Would need address validation |
| **Receive Payments** | ✅ IMPLEMENTED | Quick Actions (button) | Navigate to /wallet?action=receive |
| **Deposit/Withdraw** | ❌ MISSING | — | Not in current dashboard |
| **Transaction History** | ✅ IMPLEMENTED | Recent Transactions (5 shown) | Shows type, amount, date, status |
| **Account Settings** | ❌ MISSING | — | Should link to /settings |
| **Payment Links** | ❌ MISSING | — | Not implemented |
| **Bill Split** | ❌ MISSING | — | Not implemented |
| **Referrals** | ❌ MISSING | — | Not implemented |

---

## 🏛️ GOVERNANCE/DAOs FEATURES

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| **Discover DAOs** | ❌ MISSING | — | Should be separate section or link to /daos |
| **View DAOs I've Joined** | ✅ IMPLEMENTED | My DAOs (Grid) | Shows 4 DAOs max, filterable |
| **View DAOs I've Created** | ✅ PARTIAL | My DAOs (Grid) | Shows all DAOs but no role filter |
| **Create New DAO Proposals** | ❌ MISSING | — | Button/link needed |
| **Vote on Active Proposals** | ✅ IMPLEMENTED | Active Proposals (Panel) | Shows progress bars, voting stats |
| **Governance Stats** | ❌ MISSING | — | No "votes cast" or "influence" display |
| **Send DAO Treasury Payments** | ❌ MISSING | — | Different from Send to DAO Members |
| **Manage DAO Members** | ❌ MISSING | — | Not in dashboard |
| **View Reputation Score** | ✅ IMPLEMENTED | Balance Card (top right) | Shows trust score |
| **View Governance Score** | ❌ MISSING | — | Not implemented |
| **DAO Chat** | ❌ MISSING | — | Was removed from implementation |
| **Send Contribution** | ❌ MISSING | — | Not implemented |

---

## 🎯 IMPLEMENTATION GAP ANALYSIS

### HIGH PRIORITY (User-Facing Features)
**These are what users see immediately:**

```
IMPLEMENTED (6/17):
✅ Personal Balance
✅ Send to DAO Members
✅ Receive Payments
✅ Transaction History
✅ View My DAOs
✅ Vote on Proposals
✅ Trust Score Display

MISSING (11/17):
❌ Send to Other Users
❌ Send to External Addresses
❌ Deposit/Withdraw
❌ Account Settings
❌ Discover DAOs
❌ Governance Stats (votes cast, influence)
❌ Send DAO Treasury Payments
❌ Manage DAO Members
❌ Payment Links
❌ Bill Split
❌ Referrals
```

**Coverage: 35% (6 of 17 features)**

---

## 🔧 QUICK BUILD CHECKLIST

### Can Add in 2-3 Hours (Quick Wins)
```
[ ] Add "Discover DAOs" button linking to /daos
[ ] Add "Account Settings" link to /settings
[ ] Add "Governance Stats" card showing votes cast & influence
[ ] Add "Create Proposal" button for each DAO in My DAOs
[ ] Add DAO treasury balance to My DAOs cards
```

### Can Add in 6-8 Hours (Medium Effort)
```
[ ] Send to Other Users modal (similar to SendToDAOMember)
[ ] Deposit/Withdraw modal for each wallet
[ ] Payment Links generator
[ ] Bill Split calculator
[ ] DAO Chat integration
[ ] Send Contribution modal
```

### Can Add in 12+ Hours (Complex)
```
[ ] Send External Address with blockchain validation
[ ] Manage DAO Members interface
[ ] Referral tracking & rewards
[ ] Governance score calculation
[ ] Advanced account settings page
```

---

## 📊 SIDE-BY-SIDE COMPARISON

### What OkediDashboard Currently Shows:

```
┌─────────────────────────────────────────────┐
│  🎤 Community Dashboard                     │
├─────────────────────────────────────────────┤
│                                             │
│  💳 Personal Balance: $12,345.67            │
│     Trust Score: 85                         │
│                                             │
├─────────────────────────────────────────────┤
│  Quick Actions (4 buttons)                  │
│  [Receive] [Send] [Escrow] [Vote]           │
├─────────────────────────────────────────────┤
│  My DAOs (Grid - 4 shown)                   │
│  [DAO 1] [DAO 2] [DAO 3] [DAO 4]            │
├─────────────────────────────────────────────┤
│  Active Proposals (3 shown with bars)       │
│  [Proposal 1 - 70%]                         │
│  [Proposal 2 - 50%]                         │
│  [Proposal 3 - 30%]                         │
├─────────────────────────────────────────────┤
│  Active Escrows (3 shown)                   │
│  [$100 USD] [$50 USD] [$75 USD]             │
├─────────────────────────────────────────────┤
│  Recent Transactions (5 shown)              │
│  Send -$50 | Receive +$100 | Escrow -$75   │
├─────────────────────────────────────────────┤
│  💡 Tip of the Day                          │
└─────────────────────────────────────────────┘
```

### What Should Be There (Full OKEDI):

```
┌─────────────────────────────────────────────────────┐
│  🎤 Community Dashboard                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  💳 Personal Balance: $12,345.67                    │
│     Trust Score: 85 | Governance Score: 320        │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Quick Actions (6+ buttons)                         │
│  [Receive] [Send] [Escrow] [Vote] [Settings] [+]   │
├─────────────────────────────────────────────────────┤
│  My DAOs (Grid - 4 shown) [Discover DAOs]           │
│  [DAO 1 - Created] [DAO 2 - Member]                 │
├─────────────────────────────────────────────────────┤
│  Active Proposals (3 shown)                         │
│  [Vote Now] [Voted] [Ended]                         │
├─────────────────────────────────────────────────────┤
│  Active Escrows (3 shown)                           │
│  [$100] [$50] [$75]                                 │
├─────────────────────────────────────────────────────┤
│  Governance Stats                                   │
│  Votes Cast: 42 | Influence: 8.5% | Proposals: 3   │
├─────────────────────────────────────────────────────┤
│  Recent Transactions (5 shown)                      │
├─────────────────────────────────────────────────────┤
│  💡 Tip of the Day                                  │
├─────────────────────────────────────────────────────┤
│  💬 DAO Chat | 🎁 Referrals | 📋 Settings          │
└─────────────────────────────────────────────────────┘
```

---

## 🔴 CRITICAL GAPS

### Absolute Must-Haves (Block Release)
1. **Governance Stats** - Users need to see their influence/voting power
   - Votes cast, Proposals voted on, Influence %
   - Estimated effort: 2 hours

2. **Account Settings Link** - Users need to configure their profile
   - Link to /settings from dashboard
   - Estimated effort: 0.5 hours

3. **Discover DAOs** - Beginner users don't know what DAOs exist
   - Link to /daos or embed discovery in dashboard
   - Estimated effort: 2 hours

### Nice-to-Haves (Can Ship Without)
1. Deposit/Withdraw UI
2. Payment Links
3. Bill Split
4. Referrals
5. Send to Other Users
6. DAO Chat
7. Manage DAO Members

---

## 💾 FILES TO MODIFY

To get to full OKEDI implementation, update:

```typescript
// client/src/components/dashboard/OkediDashboard.tsx

// ADD to OkediDashboard component:
1. Governance Stats card (new section)
2. More quick actions (Send to User, Settings)
3. Discover DAOs link
4. Create Proposal button
5. Bill Split link
6. Referrals link
7. Chat integration

// Estimated lines to add: 200-300 LOC
```

---

## 📋 CHECKLIST TO COMPLETE OKEDI

**Phase 1: Critical (2-3 hours)**
- [ ] Add Governance Stats card
- [ ] Add Account Settings link
- [ ] Add Discover DAOs link
- [ ] Add Create Proposal button

**Phase 2: Important (6-8 hours)**
- [ ] Implement Send to Other Users modal
- [ ] Implement Deposit/Withdraw modals
- [ ] Add Payment Links generator
- [ ] Add Bill Split calculator
- [ ] Add DAO Chat widget

**Phase 3: Polish (12+ hours)**
- [ ] Send to External Address
- [ ] Manage DAO Members interface
- [ ] Referral tracking dashboard
- [ ] Governance score calculation
- [ ] Advanced settings page

**CURRENT COMPLETION: ~35%**

---

## 🎯 NEXT STEPS

**Option A: Quick to Market (6 hours)**
- Add Phase 1 items
- Ship with 60% feature completion
- Users can access most features via quick links

**Option B: Full Implementation (24+ hours)**
- Complete all phases
- Build every feature mentioned
- Ship with 100% capability matrix

**Recommendation:** Do Option A for MVP, then Phase 2 in next iteration.

---
