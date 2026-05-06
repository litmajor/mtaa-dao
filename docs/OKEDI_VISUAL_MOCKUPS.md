# 🎤 OKEDI Dashboard - Visual UI/UX Mockups

## 1. OKEDI MAIN DASHBOARD

```
┌─────────────────────────────────────────────────────────────────────────┐
│ MTAA DAO Platform - Okedi (Community Leader)                   [⚙️ Settings]
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  🎤 COMMUNITY DASHBOARD                                                 │
│  Govern DAOs and lead communities                                       │
│                                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┐ │
│  │  Personal Balance    │  Active Proposals    │  DAO Count           │ │
│  │  ┌────────────────┐  │  ┌────────────────┐  │  ┌────────────────┐ │ │
│  │  │ KES 45,300     │  │  │ 3 Awaiting     │  │  │ 5 Joined       │ │ │
│  │  │ +2.1% week     │  │  │ Your Vote      │  │  │ 2 Created      │ │ │
│  │  └────────────────┘  │  │ 🔔 Alert       │  │  └────────────────┘ │ │
│  │  [Deposit][Send ▼]   │  │ [Vote Now →]   │  │  [Browse][Create →] │ │
│  └──────────────────────┴──────────────────────┴──────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 💳 QUICK ACTIONS                                                    │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ [Receive 📥] [Send to DAO Member 👥] [Escrow 🔒] [Send Money 💸]   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🏛️ MY DAOs & GOVERNANCE                                            │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │                                                                     │ │
│  │ ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────┐ │ │
│  │ │ MTAA Foundation     │  │ Youth Investment    │  │ Education +  │ │ │
│  │ │ ━━━━━━━━━━━━━━━━   │  │ Club                │  │ 20 Members   │ │ │
│  │ │ Members: 142        │  │ ━━━━━━━━━━━━━━━━   │  │              │ │ │
│  │ │ Active: 3 proposals │  │ Members: 8          │  │ Treasury:    │ │ │
│  │ │ Treasury: 125K KES  │  │ Active: 1 proposal  │  │ 8,500 KES    │ │ │
│  │ │                     │  │ Treasury: 12K KES   │  │              │ │ │
│  │ │ [View] [Vote]       │  │ [View] [Vote]       │  │ [View][Vote] │ │ │
│  │ └─────────────────────┘  └─────────────────────┘  └──────────────┘ │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 💬 COMMUNITY CHAT & UPDATES                                        │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ ┌────────────────────────────────────────────────────────────────┐ │ │
│  │ │ [All DAOs] [MTAA Foundation] [Youth Club]                     │ │ │
│  │ ├────────────────────────────────────────────────────────────────┤ │ │
│  │ │                                                                │ │ │
│  │ │ Njeri: "Great discussion today! The proposal..."              │ │ │
│  │ │ Today 3:45 PM  [👍 12] [❤️ 3] [😂 1]                         │ │ │
│  │ │                                                                │ │ │
│  │ │ John: "I agree with the treasury allocation..."               │ │ │
│  │ │ Today 3:22 PM  [👍 8] [🔔 Pinned]                             │ │ │
│  │ │                                                                │ │ │
│  │ │ [Type message...]                               [Send] [File] │ │ │
│  │ │                                                                │ │ │
│  │ └────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. SEND TO DAO MEMBER FLOW

### Screen 2A: Send Modal/Page

```
┌─────────────────────────────────────────────────────┐
│ 💳 Send to DAO Member                        [✕]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Who do you want to send to?                       │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🔍 Search member...                         │   │  ← Auto-complete from DAO
│  │                                             │   │    members
│  │ Recent / Frequent:                          │   │
│  │ ┌─────────────────────────────────────────┐ │   │
│  │ │ [👤] Njeri - MTAA Foundation            │ │   │
│  │ │ [👤] James - Youth Investment Club      │ │   │
│  │ │ [👤] Sarah - Education Fund             │ │   │
│  │ └─────────────────────────────────────────┘ │   │
│  │                                             │   │
│  │ All DAO Members:                            │   │
│  │ ┌─────────────────────────────────────────┐ │   │
│  │ │ [👤] Peter (MTAA - Treasurer) [Select] │ │   │
│  │ │ [👤] Grace (MTAA - Member)    [Select] │ │   │
│  │ │ [👤] David (MTAA - Member)    [Select] │ │   │
│  │ │ [👤] Mary (Youth Club - Member)[Select]│ │   │
│  │ │ [👤] Tom (Youth Club - Elder)  [Select]│ │   │
│  │ └─────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│         [Cancel]  [Continue →]                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Screen 2B: Send Confirmation

```
┌─────────────────────────────────────────────────────┐
│ 💳 Send to Njeri Okoye                       [✕]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  How much do you want to send?                     │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Amount: [________] KES                      │   │
│  │         [1000] [5000] [10000]               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  📍 From: Your Personal Wallet                     │
│      Balance: KES 45,300                           │
│                                                     │
│  To: Njeri Okoye (👤)                              │
│      MTAA Foundation Member                        │
│                                                     │
│  📋 Note (optional):                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ Payment for community event supplies        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  💰 Total: KES 5,000.00                            │
│  ✅ No fees                                        │
│                                                     │
│         [Cancel]  [Send Now →]                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Screen 2C: Success

```
┌─────────────────────────────────────────────────────┐
│ ✅ Send Successful!                          [✕]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│          ┌──────────┐                               │
│          │    ✓    │                                │
│          └──────────┘                               │
│                                                     │
│  You sent KES 5,000 to Njeri Okoye                 │
│                                                     │
│  📊 Details:                                       │
│     From: Your Personal Wallet                     │
│     To: Njeri Okoye                                │
│     Amount: KES 5,000.00                           │
│     Time: Today 3:45 PM                            │
│     TxID: 0x7f2a8...                               │
│                                                     │
│  ✉️ Njeri will be notified in MTAA Chat           │
│                                                     │
│         [View in Chat]  [Done]                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 3. ESCROW FLOW

### Screen 3A: Create Escrow

```
┌──────────────────────────────────────────────────────┐
│ 🔒 Create Escrow Agreement                     [✕]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  What is this escrow for?                           │
│  (This helps the mediator understand the dispute)   │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ Purpose: [✓] Goods/Service Payment             │  │
│  │ [Goods] [Service] [Loan] [Other]               │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 👤 Sender (You):                               │  │
│  │    Okedi Investor                              │  │
│  │    Balance: KES 45,300                         │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 👤 Recipient:                                  │  │
│  │    [🔍 Search...] 🏛️ MTAA Foundation           │  │
│  │                 🧑 Njeri Okoye                 │  │
│  │                 🧑 James Kipchoge              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 💰 Amount: [_________] KES                     │  │
│  │                                                │  │
│  │ 🛡️ Mediator (neutral 3rd party):              │  │
│  │    [Auto-select] [Manual Select]               │  │
│  │    ℹ️ Mediator will hold funds until both      │  │
│  │       parties agree, or makes ruling.          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 📝 Terms (describe what triggers release):     │  │
│  │ [_________________________________]             │  │
│  │  e.g., "After goods delivered and verified"   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│         [Cancel]  [Create Escrow →]                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Screen 3B: Escrow Pending (Sender View)

```
┌──────────────────────────────────────────────────────┐
│ 🔒 Escrow #1234 - Pending Agreement          [✕]   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  STATUS: ⏳ Awaiting Recipient Acceptance            │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ From:      Okedi Investor                      │  │
│  │ To:        Njeri Okoye                         │  │
│  │ Amount:    KES 10,000                          │  │
│  │ Purpose:   Service Payment                     │  │
│  │ Created:   Today 2:30 PM                       │  │
│  │ Mediator:  Sarah (Elder, MTAA Foundation)     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  📋 TERMS:                                          │
│  "Payment for graphic design services. Release      │
│   funds after client approves final designs."       │
│                                                      │
│  ⏱️ Timeline:                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │ [●──────────────────────────]                  │  │
│  │ Pending   48h remaining to accept              │  │
│  │ ✓ Both agree → Release                         │  │
│  │ ✗ Dispute → Mediator decides (5-7 days)       │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  💬 Messages:                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Sarah: "I've reviewed this. Looks fair."       │  │
│  │ Today 2:45 PM                                  │  │
│  │ [✓ Accept as Mediator]                         │  │
│  │                                                │  │
│  │ Njeri: "Waiting for confirmation..."           │  │
│  │ Today 3:00 PM                                  │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [Cancel Escrow]  [View Contract]  [Message]       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Screen 3C: Escrow Released (Both Agree)

```
┌──────────────────────────────────────────────────────┐
│ ✅ Escrow #1234 - Completed                   [✕]   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  STATUS: ✅ Funds Released Successfully             │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ From:      Okedi Investor                      │  │
│  │ To:        Njeri Okoye                         │  │
│  │ Amount:    KES 10,000 ✓ RECEIVED               │  │
│  │ Released:  Today 4:15 PM                       │  │
│  │ Mediator:  Sarah (Elder, MTAA)                │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ⏱️ Timeline:                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │ [●──●──●]                                      │  │
│  │ Pending  Accepted  RELEASED                    │  │
│  │ 2:30 PM  3:30 PM   4:15 PM                     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  🎉 Both parties confirmed receipt & satisfaction   │
│                                                      │
│  💬 Final Messages:                                 │
│  ┌────────────────────────────────────────────────┐  │
│  │ Njeri: "Work looks great! Confirming..."       │  │
│  │ Today 4:10 PM                                  │  │
│  │ [✓ Confirm Receipt - 5 minutes ago]            │  │
│  │                                                │  │
│  │ Okedi: "Happy to release funds now!"           │  │
│  │ Today 4:12 PM                                  │  │
│  │ [✓ Released Funds - 3 minutes ago]             │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  📊 Reputation Impact:                              │
│  • Okedi: +2 trust score ⭐⭐⭐⭐⭐ (89)              │
│  • Njeri: +2 trust score ⭐⭐⭐⭐⭐ (87)              │
│                                                      │
│  [View Contract]  [Done]  [Leave Review]            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Screen 3D: Escrow Dispute (Mediator View)

```
┌──────────────────────────────────────────────────────┐
│ ⚠️ Escrow #1234 - DISPUTE IN PROGRESS        [✕]   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  STATUS: 🔴 DISPUTE - Mediator Reviewing            │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ From:      Okedi Investor                      │  │
│  │ To:        Njeri Okoye                         │  │
│  │ Amount:    KES 10,000 🔒 HELD IN ESCROW        │  │
│  │ Mediator:  You (Sarah - Elder, MTAA)          │  │
│  │ Dispute Filed: Today 3:45 PM                   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ⚠️ DISPUTE DETAILS:                                │
│  ┌────────────────────────────────────────────────┐  │
│  │ Njeri's Claim:                                 │ │
│  │ "Quality not as agreed. Needs revision."       │ │
│  │                                                │ │
│  │ Okedi's Response:                              │ │
│  │ "Work was approved. No revisions needed."      │ │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  📎 Evidence:                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Njeri attached 3 files:                        │ │
│  │ [📄] design_final.pdf                          │ │
│  │ [📄] feedback.txt                              │ │
│  │ [📷] screenshot_issues.png                     │ │
│  │                                                │ │
│  │ Okedi attached 2 files:                        │ │
│  │ [📄] project_contract.pdf                      │ │
│  │ [📄] approval_email.txt                        │ │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ⏱️ Timeline:                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │ [●──────────●─────────────]                    │ │
│  │ Dispute    Mediator Review    DECISION         │ │
│  │ Filed      (In Progress)      by Jan 30        │ │
│  │ 3:45 PM    Sarah reviewing...                 │ │
│  │                                                │ │
│  │ Remaining: 2 days 14 hours                     │ │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  🎯 MEDIATOR DECISION (Sarah's Options):            │
│  ┌────────────────────────────────────────────────┐  │
│  │ [ Release 100% to Njeri ]  - Quality issue     │ │
│  │ [ Release 100% to Okedi ]  - Work was good    │ │
│  │ [ Split 50/50 ]  - Both have valid points     │ │
│  │ [ Release custom % ]  - Other ruling          │ │
│  │                                                │ │
│  │ Decision Message (required):                  │ │
│  │ [_________________________________]            │ │
│  │                                                │ │
│  │  [Send Decision]                               │ │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 4. DAO CHAT (Community Hub)

```
┌──────────────────────────────────────────────────────────────────┐
│ 💬 MTAA Foundation Community Chat                        [⚙️ Info]│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [📋 All] [🏛️ MTAA] [👥 Youth Club] [📊 Elections]  [+ Create] │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 📌 PINNED: "Treasury Update - Jan 27" - Sarah (Elder)   │   │
│  │    👍 24  ❤️ 8   😂 2   [View Full]                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────┐  Participants:         │
│  │ Messages                           │  ┌─────────────────┐  │
│  ├────────────────────────────────────┤  │ 👤 Okedi        │  │
│  │                                    │  │ 👤 Njeri        │  │
│  │ Njeri: "Great discussion on..."    │  │ 👤 Sarah (Elder)│  │
│  │ 3:45 PM  [👍 12] [❤️ 3] [🙏 1]      │  │ 👤 James        │  │
│  │                                    │  │ 👤 Peter        │  │
│  │ James: "I'd like to propose..."    │  │ 👤 Grace        │  │
│  │ 3:22 PM  [👍 8] [👏 2]              │  │ 👤 David        │  │
│  │ (with 🔗 attach-file)              │  │ 5 more...       │  │
│  │                                    │  └─────────────────┘  │
│  │ Sarah: "Let's discuss this in..."  │                        │
│  │ 2:58 PM  [👍 15] [🔔 Pinned]        │  Online: 8 / 12       │
│  │ (reply to James ↩️)                │                        │
│  │                                    │  🟢 Active Now:        │
│  │ Peter: "Funds are approved!"       │  • Njeri (typing...)   │
│  │ 1:30 PM  [👍 5]                    │  • Sarah               │
│  │                                    │  • James               │
│  │ [Earlier messages...]              │                        │
│  │                                    │                        │
│  └────────────────────────────────────┘                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [Attach 📎] [Type message here...] [😊 Emoji] [Send]   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. OKEDI SETTINGS / SUBPROFILE VIEW

```
┌─────────────────────────────────────────────────────┐
│ ⚙️ Settings - Okedi Profile                  [✕]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Subprofile] [Personal] [Security] [Wallet]      │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🎤 YOUR SUBPROFILE                          │   │
│  │                                             │   │
│  │ Current: OKEDI (Community Leader)           │   │
│  │ Role: Focus on governance & community       │   │
│  │                                             │   │
│  │ Dashboard shows:                            │   │
│  │ • Personal balance & transfers              │   │
│  │ • DAO governance & voting                   │   │
│  │ • Community chat                            │   │
│  │ • Proposal creation                         │   │
│  │ • Member management                         │   │
│  │ • Treasury overview                         │   │
│  │                                             │   │
│  │ 📌 You can switch anytime in Settings       │   │
│  │                                             │   │
│  │ [Switch to YUKI (Trader)]                   │   │
│  │    🛠️ Trading & DeFi focus                   │   │
│  │    Unlock: Bot builder, AI signals, journal │   │
│  │                                             │   │
│  │ [Switch to AMARA (Investor)]                │   │
│  │    💰 Wealth & passive income focus         │   │
│  │    Unlock: Hedge funds, passive income      │   │
│  │                                             │   │
│  │ 💡 Tip: All features work from any          │   │
│  │    subprofile - these just reorganize       │   │
│  │    what's most relevant to you!             │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Change Subprofile]  [Personalize]  [Done]       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Design Tokens (For Implementation)

```typescript
// Colors
OKEDI_PRIMARY = "#8B5CF6"    // Purple
OKEDI_SECONDARY = "#6D28D9"  // Darker purple
OKEDI_ACCENT = "#EC4899"     // Pink highlight

// Components
card = "bg-slate-800 rounded-xl p-6 border border-slate-700"
button_primary = "bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg"
button_secondary = "bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg"
input = "bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"

// Status Badges
status_success = "bg-green-500/20 text-green-300"
status_pending = "bg-amber-500/20 text-amber-300"
status_error = "bg-red-500/20 text-red-300"

// Icons from lucide-react
Send, Send2, Wallet, Lock, MessageSquare, Users, TrendingUp
```

