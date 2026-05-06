# MTAA DAO: UI/UX Detailed Design Mockups & Flows

**Version:** 1.0  
**Date:** January 26, 2026  
**Format:** Text-based mockups + interaction descriptions

---

## SECTION 1: HOME DASHBOARD MOCKUPS

### 1.1 Okedi's Home (Beginner)

```
┌────────────────────────────────────────────────────────────┐
│  MTAA    🔔  ⚙️                   MY ACCOUNT ▼              │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  My Balance: 45,230 KES                                    │
│  📈 +2,340 this month (5.2%)                               │
│  💚 Your money is growing!                                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Quick Actions (Pick one)                            │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  [💰 Receive]  [📤 Send]  [📊 Earn]  [📚 Learn]     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Recent Activity (Last 3)                            │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  ✓ Sent to Kaguya: 5,000 KES              2 days ago│  │
│  │  ✓ Earned interest: +145 KES              1 day ago │  │
│  │  ✓ Withdrawal approved: 10,000 KES        3 hrs ago │  │
│  │  [View More]                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  💡 Tip of the Day                                   │  │
│  │  "Join a DAO to earn 8% APY + help your community"  │  │
│  │  [Learn How] [Not Now]                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
├────────────────────────────────────────────────────────────┤
│  [Home]  [Finance]  [DAO]  [Account]  [Help]                │
└────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **Balance display** (large, primary focus)
- **Trend indicator** (growth = encouragement)
- **4 quick actions only** (not 12)
- **Recent activity** (proof of progress)
- **Tip** (guides next step)
- **Status:** Confidence-building, not overwhelming

---

### 1.2 Yuki's Home (Intermediate — DAO Context)

```
┌────────────────────────────────────────────────────────────┐
│  MTAA    🔔  ⚙️                   MtaaUg DAO ▼              │
│                            [My Role: Admin]                │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  OUR DAO TREASURY                                    │  │
│  │  Total: 250,000 KES                                  │  │
│  │  ████████░░░░ Allocated: 60% | Earning: 35%         │  │
│  │                                                      │  │
│  │  Members: 45 | Proposals this month: 3              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PENDING ACTIONS                                     │  │
│  │  ⚠️  2 proposals need your approval (close in 12h)  │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  "Fund Q1 Marketing"                         │   │  │
│  │  │  • Budget: 50,000 KES (20% of treasury)     │   │  │
│  │  │  • Currently: 15 For, 2 Against             │   │  │
│  │  │  [View & Vote]                              │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │  ⏳ Withdrawal request: 50,000 KES to Amara        │  │
│  │  └─ Needs: 2 of 3 admin approvals                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  MY PERSONAL WALLET                                  │  │
│  │  Balance: 12,450 KES                                 │  │
│  │  (Separate from DAO funds)                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [Go to DAO Details] [Go to Proposals] [Go to Finance]     │
│                                                              │
├────────────────────────────────────────────────────────────┤
│  [Home]  [Finance]  [DAO]  [Account]  [Help]                │
└────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **DAO context clear** (top of page, selector available)
- **DAO treasury shown** (primary focus)
- **Pending actions visible** (approval workflow)
- **Personal wallet separate** (clear distinction)
- **Quick links** (navigate to relevant sections)
- **Status:** Action-focused, not overwhelming

---

### 1.3 Amara's Home (Advanced)

```
┌────────────────────────────────────────────────────────────┐
│  MTAA    🔔  ⚙️                   Portfolio ▼               │
│                            [Advanced Mode: ON]             │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  PORTFOLIO SUMMARY                                          │
│  Total: $145,230 (↑3.4% 24h)                               │
│  Available: $45,000 | Staked: $100,230                     │
│  Daily Return: ~$580 (0.4%)                                │
│  30-Day Return: ~$12,450 (+9.4%)                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ⚡ OPPORTUNITIES (Last 24h)                          │  │
│  │  [Scan Now] [Filter: All] [Settings]                │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  1. Ubeswap-Curve USDC Spread: +2.3%               │  │
│  │     Volume: $150K | Urgency: HIGH (30min window)    │  │
│  │     Estimated Profit: $1,150 on $50K swap           │  │
│  │     [Swap Now] [Details] [Skip]                     │  │
│  │                                                     │  │
│  │  2. Celo-Polygon ETH Arbitrage: +1.8%              │  │
│  │     Cost: 0.05 CELO gas + bridge fee               │  │
│  │     Est. Profit: $180 on 5 ETH bridge              │  │
│  │     [Bridge] [Pass] [Auto-Execute on Hit]          │  │
│  │                                                     │  │
│  │  3. Moola Lending Rate: 12% APY                    │  │
│  │     Currently earning: 8% in savings vault          │  │
│  │     Potential gain: +4% on $100K = $4K/yr          │  │
│  │     [Deposit] [Learn More]                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  GOVERNANCE ALERTS (3 proposals need votes)                │
│  ✓ MtaaUg DAO: Execute pending (8 hours left)             │
│  ⏳ YouthFund DAO: 3 proposals voting (48h left)           │
│  [Voting Dashboard] [Delegate Votes]                      │
│                                                              │
│  Advanced Options:                                          │
│  [Market Scanner] [Yield Dashboard] [Bot Config]           │
│  [Contract Interaction] [Batch Operations]                 │
│                                                              │
├────────────────────────────────────────────────────────────┤
│  [Home]  [Finance]  [DAO]  [Account]  [Help]                │
└────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- **Portfolio metrics** (ROI-focused)
- **Opportunities ranked** (by urgency & profit)
- **One-click execution** (minimal friction)
- **Governance alerts** (voting power)
- **Advanced controls** (power user features)
- **Status:** Data-rich, action-ready

---

## SECTION 2: SEND MONEY FLOW

### 2.1 Step 1: Select Recipient

```
┌────────────────────────────────────────────────────┐
│  Send Money                            [X]         │
├────────────────────────────────────────────────────┤
│                                                    │
│  Who are you sending to?                          │
│                                                    │
│  ┌───────────────────────────────────────────┐    │
│  │ Recipient Type ▼                          │    │
│  │ • DAO Member (Recommended)                │    │
│  │ • Known Contact                           │    │
│  │ • New Address                             │    │
│  └───────────────────────────────────────────┘    │
│                                                    │
│  Selected: DAO Member                            │
│                                                    │
│  ┌───────────────────────────────────────────┐    │
│  │ Recipient ▼ Search...                     │    │
│  │ ✓ Kaguya (Member since 2024)             │    │
│  │ • Jamal (Member since 2025)              │    │
│  │ • Amara (Admin, since 2024)              │    │
│  │ + Add New Contact                         │    │
│  └───────────────────────────────────────────┘    │
│                                                    │
│  Recipient Info:                                  │
│  Kaguya                                           │
│  Address: 0x8a3f...7c9e (verified DAO member)    │
│  (Shows trust indicator, not raw address)         │
│                                                    │
│  ┌──────────────────────────────────────────┐    │
│  │  [Cancel]     [Next: Enter Amount]       │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Flow Rules:**
- Default to DAO members (safest option)
- Show context (role, join date) for social proof
- Require explicit selection of "New Address"
- Next button disabled until recipient selected

---

### 2.2 Step 2: Enter Amount & Review Cost

```
┌────────────────────────────────────────────────────┐
│  Send Money                            [X]         │
├────────────────────────────────────────────────────┤
│                                                    │
│  How much?                                        │
│                                                    │
│  To: Kaguya (MtaaUg member)                      │
│                                                    │
│  Amount (cUSD):                                   │
│  ┌───────────────────────────────────────────┐    │
│  │ 5,000 [cUSD ▼]                            │    │
│  │ ≈ $60 USD                                 │    │
│  └───────────────────────────────────────────┘    │
│                                                    │
│  Your Available Balance: 45,230 cUSD             │
│  └─ Tip: Keep ~100 for transaction fees         │
│                                                    │
│  ┌───────────────────────────────────────────┐    │
│  │  COST BREAKDOWN                           │    │
│  │  ────────────────────────────────────     │    │
│  │  Amount they'll receive: 5,000 cUSD      │    │
│  │  Transaction fee: 2 KES (~$0.02)         │    │
│  │  ────────────────────────────────────     │    │
│  │  Total leaving your wallet: 5,002 KES    │    │
│  │                                           │    │
│  │  Timeline: ~30 seconds to arrive          │    │
│  │  Reversible? ❌ Cannot undo after sent    │    │
│  └───────────────────────────────────────────┘    │
│                                                    │
│  [Cancel]     [Review & Confirm] ← Shows next step│
│                                                    │
└────────────────────────────────────────────────────┘
```

**Flow Rules:**
- Show cost breakdown **before** confirmation
- Show timeline (sets expectations)
- Emphasize reversibility status
- Tip provides context
- Amount pre-populated if coming from action

---

### 2.3 Step 3: Confirm & Verify PIN

```
┌────────────────────────────────────────────────────┐
│  Confirm Send                         [X]         │
├────────────────────────────────────────────────────┤
│                                                    │
│  🔒 This is a REAL transaction                   │
│                                                    │
│  To: Kaguya (MtaaUg member)                      │
│  Amount: 5,000 cUSD                              │
│  Fee: 2 KES                                      │
│                                                    │
│  ┌───────────────────────────────────────────┐    │
│  │  ⚠️ After you confirm:                     │    │
│  │  • Transaction cannot be undone           │    │
│  │  • Money will arrive in ~30 seconds       │    │
│  │  • You can ask Kaguya to return if needed │    │
│  └───────────────────────────────────────────┘    │
│                                                    │
│  Enter Your PIN to Confirm:                      │
│  ┌───────────────────────────────────────────┐    │
│  │ ● ● ● ●                              (4) │    │
│  │  [Delete]                    [Biometric] │    │
│  └───────────────────────────────────────────┘    │
│                                                    │
│  [Cancel & Go Back]                              │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Flow Rules:**
- Show warning **before** asking for PIN
- Clear confirmation of amount & recipient
- PIN input required (no quick-click confirmation)
- Timeout after 5 minutes

---

### 2.4 Step 4: Success & Next Steps

```
┌────────────────────────────────────────────────────┐
│  ✅ Sent Successfully!                            │
│                         [X]                        │
├────────────────────────────────────────────────────┤
│                                                    │
│  5,000 cUSD → Kaguya                             │
│                                                    │
│  Transaction Details:                            │
│  • Status: Confirmed                             │
│  • Hash: 0x7f3a...2b9c [View on Explorer]        │
│  • Time: Just now                                │
│  • Fee Paid: 2 KES                               │
│                                                    │
│  ┌───────────────────────────────────────────┐    │
│  │  Your New Balance: 40,228 cUSD            │    │
│  │                                           │    │
│  │  📈 At current rate:                      │    │
│  │     You'd earn ~$8 in interest per month  │    │
│  │     (if you deposit to a vault)           │    │
│  └───────────────────────────────────────────┘    │
│                                                    │
│  What's Next?                                     │
│  ┌─────────────────────────────────────────┐     │
│  │ □ Share this transaction with Kaguya    │     │
│  │ □ Join a DAO to earn more               │     │
│  │ □ Deposit to vault for interest         │     │
│  └─────────────────────────────────────────┘     │
│                                                    │
│  [Back to Wallet] [Repeat Send] [Home]           │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Flow Rules:**
- Celebrate success prominently
- Show next earning opportunity
- Provide helpful suggestions
- Make transaction history accessible

---

## SECTION 3: PROPOSAL VOTING FLOW

### 3.1 Proposal List (DAO Tab)

```
┌────────────────────────────────────────────────────┐
│  MtaaUg DAO - Proposals           [Create New ▼]   │
├────────────────────────────────────────────────────┤
│                                                    │
│  Filter: [All] [Active] [Passed] [Failed]         │
│                                                    │
│  ┌───────────────────────────────────────────────┐ │
│  │  ✅ PASSED (1 week ago)                        │ │
│  │  "Fund Community Outreach"                    │ │
│  │  Budget: 25,000 KES | Votes: 18 For, 1 Against│ │
│  │  Executed ✓                                    │ │
│  │  [View Details] [View Results]                │ │
│  └───────────────────────────────────────────────┘ │
│                                                    │
│  ┌───────────────────────────────────────────────┐ │
│  │  🕐 VOTING (2 days left)  ⏱️ HIGH PRIORITY     │ │
│  │  "Fund Q1 Marketing"                          │ │
│  │  Budget: 50,000 KES (20% of treasury)         │ │
│  │  Votes: 15 For, 2 Against, 3 Needed to Pass  │ │
│  │  Your Status: ⏳ You haven't voted            │ │
│  │  [Vote Now] [View Details]                    │ │
│  └───────────────────────────────────────────────┘ │
│                                                    │
│  ┌───────────────────────────────────────────────┐ │
│  │  📝 DISCUSSION (4 days left)                   │ │
│  │  "Allow monthly spending up to 5% of budget"  │ │
│  │  Proposed by: Jamal (Member)                  │ │
│  │  Comments: 8 people discussing                │ │
│  │  [Join Discussion] [View Details]             │ │
│  └───────────────────────────────────────────────┘ │
│                                                    │
├────────────────────────────────────────────────────┤
│  [Home]  [Finance]  [DAO]  [Account]  [Help]        │
└────────────────────────────────────────────────────┘
```

**Design Rules:**
- Active proposals first
- Visual priority: urgent items highlighted
- Clear voting status (voted / not voted)
- One-click [Vote Now] button
- Distinction between discussion & voting phases

---

### 3.2 Proposal Detail (Before Voting)

```
┌────────────────────────────────────────────────────┐
│  Proposal: "Fund Q1 Marketing"        [Close]      │
├────────────────────────────────────────────────────┤
│                                                    │
│  STATUS: 🕐 Voting (2 days left)                  │
│  TIME: Voting closes in 48 hours                  │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  IMPACT ON OUR DAO                           │ │
│  │  ────────────────────────────────────────    │ │
│  │  Current Treasury: 250,000 KES               │ │
│  │  This Proposal: 50,000 KES                   │ │
│  │  ████████░░░░░░░░░░ After: 200,000 KES     │ │
│  │                                              │ │
│  │  This is 20% of our budget                   │ │
│  │  Timeline: January 15 - March 15 (3 months)  │ │
│  │  Responsible: Amara (admin)                  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  PROPOSAL DETAILS                                 │
│  ────────────────────────────────────────────    │
│  What's This About?                              │
│  Run a digital marketing campaign to bring       │
│  new members to our DAO. We'll focus on          │
│  TikTok and Instagram ads targeting age 18-35   │
│  in Kenya, Uganda, and Nigeria.                  │
│                                                    │
│  How Will the Money Be Used?                     │
│  • Social media ads: 20,000 KES (40%)           │
│  • Content creation: 10,000 KES (20%)           │
│  • Community events: 20,000 KES (40%)           │
│  Total: 50,000 KES                              │
│                                                    │
│  Success Metrics:                                │
│  • Target: 500 new members                      │
│  • Cost per acquisition: 100 KES                │
│  • Expected reach: 50,000 people                │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  VOTING STATUS                               │ │
│  │  ────────────────────────────────────────    │ │
│  │  For:     15 votes ████████░░░░░░  (60%)    │ │
│  │  Against: 2 votes  ░░░░░░░░░░░░░░░░ (8%)     │ │
│  │  Abstain: 8 votes  ░░░░░░░░░░░░░░░░ (32%)    │ │
│  │                                              │ │
│  │  Votes needed to pass: 16 (>50%)             │ │
│  │  Current: 15 For (1 MORE VOTE NEEDED!)      │ │
│  │                                              │ │
│  │  Your voting power: 1,000 MTAA (4%)          │ │
│  │  Status: You haven't voted yet               │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  RECENT VOTES & COMMENTS                         │
│  • ✓ Yuki voted For (admin comment: "Looks good")│
│  • ✓ Jamal voted Against ("Need ROI metric")    │
│  • Amara commented: "Timeline is tight, but     │
│    doable. Happy to answer questions."          │
│                                                    │
│  [View All Comments] [Add Comment]              │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  YOUR DECISION                               │ │
│  │  ────────────────────────────────────────    │ │
│  │  [Vote For]  [Vote Against]  [Abstain]       │ │
│  │  [Delegate to Yuki (I trust her judgment)]   │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Design Rules:**
- Impact card at top (most important)
- Voting status clear
- Quorum calculation visible
- Comments show transparency
- Delegation option for uncertain voters
- No jargon (explain every metric)

---

### 3.3 Proposal Confirmation Modal

```
┌────────────────────────────────────────────────────┐
│  Confirm Your Vote                    [X]         │
├────────────────────────────────────────────────────┤
│                                                    │
│  You're about to vote on:                         │
│  "Fund Q1 Marketing"                              │
│                                                    │
│  Your Vote: ✓ FOR                                 │
│                                                    │
│  What This Means:                                 │
│  • You support spending 50,000 KES on marketing  │
│  • This will reduce our treasury by 20%          │
│  • After approval, money goes to marketing team  │
│  • You can always comment if concerns arise       │
│                                                    │
│  Your Voting Power: 1,000 MTAA (4%)              │
│  Impact: Your vote adds to "For" total           │
│                                                    │
│  ┌────────────────────────────────────────────┐  │
│  │ Understand & Confirm?                      │  │
│  │ □ I understand the proposal                │  │
│  │ □ I understand the budget impact           │  │
│  │ □ I'm ready to vote (can't undo)           │  │
│  │                                            │  │
│  │ [Vote For] [Vote Against] [Cancel]         │  │
│  └────────────────────────────────────────────┘  │
│                                                    │
│  Questions?                                       │
│  [Read Proposal Again] [View Comments]           │
│  [Delegation] [Help]                             │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Design Rules:**
- Explicit confirmation required
- Checkboxes prevent accidental voting
- Link back to full proposal
- Delegation option
- Help available

---

## SECTION 4: DAO TREASURY VIEW

### 4.1 Treasury Overview

```
┌────────────────────────────────────────────────────┐
│  MtaaUg DAO - Treasury               [Settings]     │
├────────────────────────────────────────────────────┤
│                                                    │
│  TOTAL TREASURY: 250,000 KES                      │
│                                                    │
│  ALLOCATION STATUS                                │
│  ┌─────────────────────────────────────────────┐  │
│  │ Active (Generating Yield)                   │  │
│  │ ████████░░░░░░░░░░ 60% (150,000 KES)       │  │
│  │                                             │  │
│  │ Allocated (For Approved Spending)           │  │
│  │ ░░░░░░░░████░░░░░░░░░░░░░░░ 20% (50,000)  │  │
│  │                                             │  │
│  │ Available (Unallocated)                     │  │
│  │ ░░░░░░░░░░░░░░░░░░░░████░░░░ 20% (50,000) │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  BREAKDOWN BY VAULT                               │
│  ┌──────────────────────────────────────────────┐ │
│  │ EARNING VAULTS                              │ │
│  │                                              │ │
│  │ 📊 Savings Vault (Main)                     │ │
│  │    • Amount: 100,000 cUSD                   │ │
│  │    • APY: 8% (≈ 8,000 KES/year)            │ │
│  │    • Earned this month: +667 KES            │ │
│  │    • Manager: AI Treasury (automated)        │ │
│  │    [View Details] [Withdraw]                │ │
│  │                                              │ │
│  │ 📊 Moola Lending Pool                       │ │
│  │    • Amount: 50,000 cUSD                    │ │
│  │    • APY: 12% (higher risk)                 │ │
│  │    • Earned this month: +500 KES            │ │
│  │    • Manager: Amara (approved)              │ │
│  │    [View Details] [Withdraw]                │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ ALLOCATED (Pending Spending)                │ │
│  │                                              │ │
│  │ ✓ Q1 Marketing: 50,000 KES                 │ │
│  │   Status: Approved by vote                  │ │
│  │   Timeline: Jan 15 - Mar 15                 │ │
│  │   Responsible: Amara                        │ │
│  │   [View Budget] [Release Funds]             │ │
│  │   [Pause] [Track Spending]                  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  RECENT ACTIVITY                                  │
│  • Withdrawal: 50,000 KES → Amara (approved)    │
│  • Deposit: 25,000 KES ← Jamal (member)         │
│  • Earned: +1,167 KES (yield from vaults)       │
│  [View Full History]                             │
│                                                    │
│  TREASURY RULES                                   │
│  • Single withdrawal limit: 100,000 KES          │
│  • Multi-sig required: 2 of 3 admins            │
│  • Spending approval: Proposal vote needed       │
│  [View All Rules] [Change Rules] (admin only)    │
│                                                    │
├────────────────────────────────────────────────────┤
│  [Home]  [Finance]  [DAO]  [Account]  [Help]        │
└────────────────────────────────────────────────────┘
```

**Design Rules:**
- Visual breakdown of allocation
- Earning vaults highlighted (positive outcome)
- Allocated funds tracked (transparency)
- Available balance clear
- Activity log for transparency
- Rules visible to all

---

## SECTION 5: SECURITY & TRUST MOMENTS

### 5.1 Enable 2FA Flow

```
┌────────────────────────────────────────────────────┐
│  Secure Your Account                  [X]         │
├────────────────────────────────────────────────────┤
│                                                    │
│  What's at Risk if You Don't Enable 2FA?         │
│  ────────────────────────────────────────────    │
│  If someone gets your password, they could:       │
│  • Access your account                           │
│  • Send your money to their wallet               │
│  • Vote using your voting power                  │
│  • Impersonate you                               │
│                                                    │
│  How 2FA Protects You                            │
│  ────────────────────────────────────────────    │
│  Two-Factor Authentication (2FA) means:          │
│  1. Normal login (username + password)           │
│  2. PLUS: Code from your phone                   │
│                                                    │
│  Even if hacker has your password, they can't    │
│  get in without also having your phone.          │
│  It's like a second lock on your account.        │
│                                                    │
│  What It Costs You                               │
│  ────────────────────────────────────────────    │
│  When logging in:                                 │
│  • Old way: 30 seconds                           │
│  • With 2FA: 40 seconds (+10 seconds)            │
│                                                    │
│  That's it. One extra code from your phone.       │
│                                                    │
│  Ready to Secure Your Account?                   │
│                                                    │
│  ┌─────────────────────────────────────────────┐ │
│  │ □ I understand the risk (password leak)     │ │
│  │ □ I understand 2FA adds protection          │ │
│  │ □ I'm willing to spend 10 sec extra/login   │ │
│  │                                             │ │
│  │ [Enable 2FA Now] [Tell Me More] [Not Now]   │ │
│  └─────────────────────────────────────────────┘ │
│                                                    │
│  Learn More:                                      │
│  [What if I lose my phone?]                       │
│  [How do backup codes work?]                      │
│  [Is 2FA required?]                               │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Design Rules:**
- Explain threat (not just "enable 2FA")
- Show cost (time trade-off)
- Explicit understanding required
- Help links for concerns
- Not mandatory (but recommended)

---

### 5.2 Wallet Key Export (High Risk)

```
┌────────────────────────────────────────────────────┐
│  ⚠️ Export Wallet Keys                [X]         │
├────────────────────────────────────────────────────┤
│                                                    │
│  🚨 CRITICAL: THIS IS DANGEROUS                  │
│                                                    │
│  What You're About to Do:                         │
│  Export the secret code that controls your money  │
│                                                    │
│  If Someone Gets Your Key:                        │
│  ✗ They own your money (permanently)             │
│  ✗ You can't get it back                         │
│  ✗ They can spend it anywhere                    │
│                                                    │
│  How to Protect Your Key:                         │
│  ✓ Write it down (on paper, not computer)        │
│  ✓ Store in safe place (safe, bank, etc)         │
│  ✓ Never share with anyone                       │
│  ✓ Never email, screenshot, or text it           │
│  ✓ Never paste in chat or form                   │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ I Understand This Risks                      │ │
│  │                                              │ │
│  │ □ If key is leaked, money is gone forever    │ │
│  │ □ I won't share my key with anyone           │ │
│  │ □ I'll store it in a safe, physical place    │ │
│  │ □ I have a pen and paper ready               │ │
│  │                                              │ │
│  │ [Show My Key] [Cancel] [Help]                │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Still need help?                                 │
│  [Call Support] [Email Support] [FAQ]            │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Design Rules:**
- Red/orange styling (danger signal)
- Multiple checkboxes (confirm understanding)
- Explicit instructions (not jargon)
- Support options
- No auto-show (explicit request)

---

## SECTION 6: ERROR HANDLING & FEEDBACK

### 6.1 Transaction Failed - Helpful Explanation

```
┌────────────────────────────────────────────────────┐
│  ❌ Transaction Failed                [X]         │
├────────────────────────────────────────────────────┤
│                                                    │
│  What Happened:                                   │
│  Your send to Kaguya didn't go through            │
│                                                    │
│  Why It Failed:                                   │
│  ✗ Your balance dropped below the amount         │
│  ✗ (Someone else withdrew from the account?)    │
│                                                    │
│  What To Do Now:                                  │
│  1. Check your balance (now 42,000 KES)          │
│  2. Try sending a smaller amount                 │
│  3. Or deposit more funds first                  │
│                                                    │
│  Error Code: TXN_INSUFFICIENT_BALANCE            │
│  Time: 2:45 PM, Jan 26                           │
│  [View Details] [Contact Support]                │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ [Retry with Lower Amount]  [Go Back]        │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Design Rules:**
- Explain *what* happened (not just "error")
- Explain *why* it happened (root cause)
- Suggest *how* to fix it (actionable)
- Offer retry (with suggested adjustment)
- Support option available

---

### 6.2 Loading State with Context

```
┌────────────────────────────────────────────────────┐
│  ⏳ Processing Your Transaction...                │
├────────────────────────────────────────────────────┤
│                                                    │
│  This is normal. Blockchain is responding...      │
│                                                    │
│  Current Step:                                    │
│  ⏳ 1. Processing payment (10-15 seconds)        │
│  ░░ 2. Confirming on blockchain (10-20 sec)     │
│  ░░ 3. Updating your balance (5 seconds)        │
│                                                    │
│  Total time: Usually ~30 seconds                  │
│                                                    │
│  Total Waiting: 12 seconds                        │
│  └────────── (½ done)                             │
│                                                    │
│  💡 What's happening?                             │
│  Your money is being sent to the Celo network.    │
│  The blockchain is checking everything.           │
│  Once confirmed, Kaguya will have the money.      │
│                                                    │
│  Can I close this?                                │
│  No—keep this page open.                          │
│  Closing won't stop the transaction.             │
│                                                    │
│  Still waiting after 60 seconds?                 │
│  [Check Status] [Contact Support]                │
│                                                    │
│  ⏳ Processing... Do not close this page         │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Design Rules:**
- Progress bar (visual progress)
- Step-by-step explanation
- Total time estimate
- Explanation of what's happening
- FAQ (can I close, what if it's slow)
- Support fallback

---

## SECTION 7: MOBILE LAYOUT EXAMPLES

### 7.1 Mobile Home Dashboard (Okedi)

```
┌─────────────────────────┐
│  MTAA  [Notifications]  │
├─────────────────────────┤
│                         │
│  My Balance             │
│  45,230 KES             │
│  📈 +2,340 this month   │
│                         │
│  Quick Actions:         │
│  ┌─────────┬──────┐    │
│  │ Receive │ Send │    │
│  └─────────┴──────┘    │
│  ┌─────────┬──────┐    │
│  │  Save   │Learn │    │
│  └─────────┴──────┘    │
│                         │
│  Recent:                │
│  • +145 KES earned      │
│  • Sent 5,000 KES       │
│  • Withdrawal OK        │
│  [See More]             │
│                         │
│  💡 Tip: Join a DAO     │
│  [Learn]                │
│                         │
├─────────────────────────┤
│ Home Finance DAO Account │
└─────────────────────────┘
```

**Mobile Rules:**
- Full-width sections
- Buttons stack vertically on narrow screens
- Swipe navigation optional
- Bottom nav always visible
- Touch targets min 44px

---

### 7.2 Mobile Proposal Vote

```
┌─────────────────────────────┐
│ Fund Q1 Marketing    [Back] │
├─────────────────────────────┤
│ 🕐 Voting (2 days)          │
│                             │
│ Budget: 50,000 KES (20%)    │
│ ████████░░░░░░░░░░          │
│ Current: 200,000 KES after  │
│                             │
│ Votes: 15 For, 2 Against    │
│ Need: 1 more vote to pass   │
│                             │
│ Your vote: Not voted ⏳      │
│                             │
│ ═════════════════════════   │
│ WHAT IS THIS?               │
│                             │
│ Marketing campaign for:     │
│ • Social media ads: 20K     │
│ • Events: 20K              │
│ • Content: 10K             │
│                             │
│ [View Full Details]         │
│                             │
│ ═════════════════════════   │
│ [Vote For] [Vote Against]   │
│ [Delegate] [Cancel]         │
│                             │
└─────────────────────────────┘
```

**Mobile Rules:**
- One action per screen (not overwhelming)
- [View Full Details] for more info
- Large touch buttons
- Swipe to vote (optional, with tap backup)

---

## SECTION 8: MICRO-INTERACTIONS & ANIMATIONS

### Successful Action Animation

```
Confirmation appears at top of screen:
┌─────────────────────────────┐
│ ✅ Sent 5,000 KES          │
│    to Kaguya                │
└─────────────────────────────┘
└─→ Slides in from top
   └─→ Stays for 3 seconds
      └─→ Slides out
```

**Rules:**
- Non-intrusive (toast, not modal)
- Auto-dismiss (user doesn't close)
- Can be manually dismissed
- Doesn't block interaction

---

### Loading Skeleton (Optimistic UI)

```
Before data loads:
┌─────────────────────────────┐
│ My Balance: [▓▓▓▓▓]          │
│ 📈 [▓▓▓▓▓▓▓]                │
└─────────────────────────────┘
└─→ Animated shimmer effect
   └─→ Replaced when data arrives
      └─→ No flash/jump
```

**Rules:**
- Skeleton matches content shape
- Shimmer animation suggests loading
- Content loads without jumping
- Faster perceived performance

---

## CONCLUSION

These mockups show:
1. **Clarity first** — No hidden complexity
2. **Context always visible** — User knows where they are
3. **Impact preview** — Before commitment
4. **Simple language** — No jargon
5. **Helpful errors** — Show solutions, not just failures
6. **Mobile-first** — Works on small screens
7. **Accessibility built-in** — Text readable, colors contrasting
8. **Trust through transparency** — All costs, timelines, risks visible

---

**Document Version:** 1.0  
**Last Updated:** January 26, 2026  
**Status:** Ready for Design Handoff

