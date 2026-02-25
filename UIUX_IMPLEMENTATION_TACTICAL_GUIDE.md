# MTAA DAO: UI/UX Implementation Tactical Guide

**Version:** 1.0  
**Date:** January 26, 2026  
**Audience:** Product Managers, Designers, Frontend Engineers

---

## Overview

This document provides **concrete, actionable** implementation steps to move from the strategic UI/UX architecture document into code and design artifacts.

**What You'll Find:**
- Priority-ordered feature changes
- Specific design components to modify
- Code structure recommendations
- Acceptance criteria for each change
- Estimated effort (hours) and dependencies

---

## PHASE 1: FOUNDATION (Weeks 1-2) — Reduce Dashboard Cognitive Load

### 1.1 Consolidate Global Navigation

**Current State:**
```
Dashboard | Wallets | Vaults | Trading | DAO | Governance | Analytics | Settings
```

**Target State:**
```
Home | Finance | DAO | Account | Help
```

**Implementation Tasks:**

#### Task 1.1a: Update Navigation Component
- **File:** `client/src/components/navigation.tsx`
- **Change:** Replace 8 nav items with 4
- **Design:**
  ```
  Navigation Bar:
  - Home (Dashboard icon)
  - Finance (Wallet icon)
  - DAO (Group icon)
  - Account (Profile icon)
  - Help (Question icon)
  ```
- **Effort:** 2 hours
- **Acceptance:**
  - [ ] Only 4 nav items visible in main navigation
  - [ ] Each icon is clear and distinct
  - [ ] Mobile shows icons only; desktop shows text + icons
  - [ ] Active state clearly indicated

#### Task 1.1b: Create Navigation Routing Map
- **File:** `app/routes.tsx` (or equivalent)
- **Change:** Remap all existing routes to new categories
  - `/dashboard` → `/home`
  - `/wallets`, `/vaults` → `/finance/*`
  - `/dao`, `/governance` → `/dao/*`
  - `/settings`, `/profile` → `/account/*`
- **Effort:** 3 hours (includes testing)
- **Acceptance:**
  - [ ] All old routes redirect to new locations
  - [ ] Bookmarks don't break (301 redirects)
  - [ ] Deep links still work

#### Task 1.1c: DAO Context Selector (Persistent)
- **File:** `client/src/components/DaoContextSelector.tsx` (new)
- **Location:** Top-right corner, below user profile
- **Design:**
  ```
  Current: MtaaUg DAO ▼
  ────────────────────
  ✓ MtaaUg (Admin)
  □ YouthFund DAO
  □ TechCoop
  ────────────────────
  + Create New DAO
  ```
- **Behavior:**
  - Sticky across all pages
  - Clicking changes `/finance` → `/finance?dao=xyz` or `/dao?dao=xyz`
  - Highlights active DAO with checkmark + color
- **Effort:** 4 hours
- **Acceptance:**
  - [ ] Selector appears on all pages
  - [ ] Switching DAO updates relevant page content
  - [ ] "Create New DAO" opens modal
  - [ ] Selection persists across sessions (localStorage)

---

### 1.2 Redesign Home Dashboard

**Current State:** 8-12 panels, overwhelming

**Target State:** Personalized dashboard based on persona (Okedi/Yuki/Amara)

**Implementation:**

#### Task 1.2a: Dashboard Persona Detection
- **File:** `client/src/hooks/useDashboardPersona.ts` (new)
- **Logic:** Detect user persona based on:
  - Account age (< 7 days = beginner)
  - Balance size (< 10K = beginner; 10K-100K = intermediate; > 100K = advanced)
  - DAO role (member = intermediate; admin = advanced)
  - Feature adoption (enabled staking = advanced)
- **Return:** `{ persona: 'okedi' | 'yuki' | 'amara' }`
- **Effort:** 3 hours
- **Acceptance:**
  - [ ] Correctly classifies test users
  - [ ] Updates in real-time when balance changes
  - [ ] Can be overridden manually (user preference)

#### Task 1.2b: Dashboard Layout Generator
- **File:** `client/src/components/dashboard/PersonalizedDashboard.tsx` (new)
- **Render:** Different layouts per persona
- **Okedi's Dashboard:**
  ```tsx
  <>
    <BalanceCard balance={balance} change={monthlyChange} />
    <QuickActionsBar actions={['Receive', 'Send', 'Save']} />
    <RecentTransactionsCard limit={3} />
    <TipOfTheDay />
  </>
  ```
- **Yuki's Dashboard:**
  ```tsx
  <>
    <DaoTreasuryCard dao={currentDao} />
    <PersonalBalanceWidget />
    <PendingActionsCard />
    <ProposalHighlight proposals={proposals} limit={1} />
  </>
  ```
- **Amara's Dashboard:**
  ```tsx
  <>
    <PortfolioCard portfolio={portfolio} />
    <OpportunitiesCard opportunities={opportunities} limit={3} />
    <GovernanceAlerts proposals={proposals} />
    <AdvancedOptionsBar />
  </>
  ```
- **Effort:** 6 hours
- **Acceptance:**
  - [ ] Okedi sees 4 panels max
  - [ ] Yuki sees DAO + personal separated
  - [ ] Amara sees opportunities + voting
  - [ ] All dashboards load in < 2 seconds

#### Task 1.2c: Remove Old Dashboard Components
- **Files to delete or hide:**
  - `components/dashboard/dashboard.tsx` (old)
  - Multiple analytics panels
  - Leaderboard widget (move to Account/Profile)
  - Market scanner (move to Finance/Advanced)
- **Effort:** 2 hours
- **Acceptance:**
  - [ ] Old dashboard no longer appears
  - [ ] All features still accessible (just moved)
  - [ ] No console errors

---

### 1.3 Create "Quick Actions" Component

**Purpose:** Provide Okedi (and others) a clear entry point for common tasks

**Implementation:**

#### Task 1.3a: QuickActionsBar Component
- **File:** `client/src/components/QuickActionsBar.tsx` (new)
- **Displays:** 4 action buttons, persona-specific
- **Okedi's actions:**
  - [Receive 💰] → Show QR code
  - [Send 📤] → Start send flow
  - [Save 📊] → Join/deposit to vault
  - [Learn 📚] → Help + tips
- **Yuki's actions:**
  - [Vote 🗳️] → Proposals
  - [Spend 💸] → Create disbursement
  - [Add Members 👥] → Invite
  - [Report 📈] → Treasury analytics
- **Amara's actions:**
  - [Trade 📉] → DEX swap
  - [Farm 🌾] → Yield products
  - [Bridge 🔗] → Cross-chain
  - [Advanced ⚙️] → Power tools
- **Design:**
  ```
  ┌─────────────┬─────────────┬─────────────┬─────────────┐
  │  Receive    │    Send     │    Save     │   Learn     │
  │     💰      │     📤      │     📊      │     📚      │
  └─────────────┴─────────────┴─────────────┴─────────────┘
  ```
- **Effort:** 3 hours
- **Acceptance:**
  - [ ] 4 buttons displayed
  - [ ] Icons match action intent
  - [ ] Buttons are tappable (min 44px height)
  - [ ] Mobile-responsive (stack on small screens)

#### Task 1.3b: Action Modal Flows
- **Files:** `components/modals/ReceiveModal.tsx`, `SendModal.tsx`, etc.
- **Requirement:** Each action opens a focused modal, not full-page
- **Effort:** 8 hours (4 modals × 2 hours each)
- **Acceptance:**
  - [ ] Modal appears on action click
  - [ ] Each modal has < 3 input fields
  - [ ] Clear [Cancel] button
  - [ ] Shows cost/impact before confirmation

---

## PHASE 2: TRUST MOMENTS (Weeks 3-4) — Add Clarity to Critical Actions

### 2.1 Transaction Preview Modal (Send Money)

**Current Issue:** Users click through without understanding what happens

**Target:** Show full impact before confirmation

**Implementation:**

#### Task 2.1a: TransactionPreview Component
- **File:** `client/src/components/modals/TransactionPreviewModal.tsx` (new)
- **Flow:**
  1. User enters amount → preview shows automatically
  2. Preview shows:
     - Recipient (name + address)
     - Amount (in local currency + crypto)
     - Fee breakdown
     - Timeline ("~30 seconds")
     - Reversibility ("Can't undo once sent")
  3. User can [Edit] or [Confirm]
- **Design:**
  ```
  ┌──────────────────────────────┐
  │ Ready to Send?               │
  ├──────────────────────────────┤
  │ To: Kaguya                   │
  │ Amount: 5,000 cUSD           │
  │                              │
  │ Cost Breakdown:              │
  │ • Your amount: 5,000         │
  │ • Fee: 2 KES (~$0.02)        │
  │ • They receive: 4,998        │
  │ • Timeline: ~30 sec          │
  │                              │
  │ ⚠️ Can't undo after you confirm│
  │                              │
  │ [PIN to confirm] [Cancel]    │
  └──────────────────────────────┘
  ```
- **Effort:** 4 hours
- **Acceptance:**
  - [ ] Fee breakdown shown before confirmation
  - [ ] Recipient clearly identified
  - [ ] Timeline visible
  - [ ] PIN/2FA required

#### Task 2.1b: Update SendTransactionModal
- **File:** `client/src/components/modals/sendTransactionModal.tsx` (existing)
- **Change:** Replace current flow with new preview
- **Effort:** 2 hours
- **Acceptance:**
  - [ ] Old modal replaced
  - [ ] Users see preview before confirm
  - [ ] Mobile layout still works

---

### 2.2 Proposal Impact Visualization

**Current Issue:** Users vote without understanding consequences

**Target:** Show DAO impact, quorum status, voting paths

**Implementation:**

#### Task 2.2a: ProposalImpactCard Component
- **File:** `client/src/components/ProposalImpactCard.tsx` (new)
- **Shows:**
  - Budget impact (% of treasury)
  - Voting progress (visual bar)
  - Quorum status (needed votes vs. current)
  - Timeline (voting ends in X hours)
  - Similar past proposals (for context)
- **Design:**
  ```
  ┌─────────────────────────────────────┐
  │ Impact on Our DAO                   │
  ├─────────────────────────────────────┤
  │ Budget: 50,000 KES (20% of 250K)    │
  │ ████████░░ After: 200,000 KES      │
  │                                     │
  │ Votes (15 For, 2 Against, 3 Needed) │
  │ ████████░ 60% to pass               │
  │                                     │
  │ Timeline: 48 hours left             │
  │                                     │
  │ Voting Options:                     │
  │ [Vote For] [Vote Against]           │
  │ [Delegate to Amara]                 │
  └─────────────────────────────────────┘
  ```
- **Effort:** 4 hours
- **Acceptance:**
  - [ ] Budget impact calculated correctly
  - [ ] Visual bars proportional
  - [ ] Quorum calculation accurate
  - [ ] Mobile-responsive

#### Task 2.2b: Update Proposal Detail Page
- **File:** `client/src/components/ProposalDetail.tsx`
- **Add:** Impact card to top of page
- **Effort:** 1 hour
- **Acceptance:**
  - [ ] Impact card appears above proposal text
  - [ ] Card updates as votes come in
  - [ ] Real-time socket updates work

---

### 2.3 Security Explanations (Non-Technical)

**Current Issue:** "Enable 2FA" buttons appear without context

**Target:** Explain *why* in simple language

**Implementation:**

#### Task 2.3a: SecurityContextModal Component
- **File:** `client/src/components/modals/SecurityContextModal.tsx` (new)
- **Triggered:** When user enables security feature
- **Content:**
  - "What's at risk?" (explain the threat)
  - "Why this helps?" (explain the mitigation)
  - "What's the cost?" (impact on user)
  - Confirmation checkbox: "I understand this"
- **Example (2FA):**
  ```
  What's at Risk?
  If your password gets leaked, someone could:
  • Access your account
  • Send your money to their wallet
  • Vote using your power
  
  Why 2FA Helps?
  Even if they have your password, they can't log in
  without your phone. It's like a second lock.
  
  What It Costs You?
  Extra 10 seconds per login (code from phone)
  
  You understand? [Checkbox]
  [Enable 2FA] [Learn More]
  ```
- **Effort:** 3 hours
- **Acceptance:**
  - [ ] Modal appears before security change
  - [ ] Language is simple (no jargon)
  - [ ] Checkbox prevents accidental enable
  - [ ] [Learn More] links to docs

#### Task 2.3b: Add to All Security Settings
- **File:** `client/src/components/settings/SecuritySettings.tsx`
- **Changes:**
  - Add SecurityContextModal to: 2FA, PIN change, key export, etc.
  - Preload explanations for each
- **Effort:** 2 hours
- **Acceptance:**
  - [ ] All security features have explanations
  - [ ] Modals trigger before action

---

## PHASE 3: PROGRESSIVE DISCLOSURE (Weeks 5-6) — Feature Gating

### 3.1 Feature Tier Implementation

**Purpose:** Hide advanced features until user is ready

**Implementation:**

#### Task 3.1a: FeatureGate Hook
- **File:** `client/src/hooks/useFeatureGate.ts` (new)
- **Logic:**
  ```typescript
  interface FeatureTier {
    name: string;
    requiredAge?: number; // days
    requiredBalance?: number; // smallest unit
    requiredRole?: string;
    manualOptIn?: boolean;
  }
  
  const gatingRules: Record<string, FeatureTier> = {
    'dao.join': { requiredAge: 7 },
    'vault.yield': { requiredBalance: 10000000 }, // 10K smallest unit
    'trading.dex': { manualOptIn: true },
    'bridge.cross-chain': { manualOptIn: true },
    'proposal.create': { requiredRole: 'admin' },
  };
  
  function useFeatureGate(featureName: string) {
    const user = useAuth();
    const isGated = checkGate(featureName, user);
    return { isGated, reason: isGated ? 'age' | 'balance' | 'role' : null };
  }
  ```
- **Effort:** 5 hours
- **Acceptance:**
  - [ ] Hook correctly checks all conditions
  - [ ] Returns reason for gating
  - [ ] Works with feature flags (if implemented)

#### Task 3.1b: GatedFeature Wrapper Component
- **File:** `client/src/components/FeatureGate.tsx` (new)
- **Usage:**
  ```tsx
  <FeatureGate feature="trading.dex" fallback={<UpgradeMessage />}>
    <DexSwapInterface />
  </FeatureGate>
  ```
- **Fallback messages:**
  - If age-gated: "Available in 5 more days! [Why?]"
  - If balance-gated: "Deposit 10K more to unlock [Why?]"
  - If manual opt-in: "[Enable Advanced Features]"
- **Effort:** 3 hours
- **Acceptance:**
  - [ ] Gated features hidden by default
  - [ ] Fallback message is helpful
  - [ ] [Why?] explains reason
  - [ ] No XHR errors for gated features

#### Task 3.1c: Advanced Features Toggle
- **File:** `client/src/components/settings/AdvancedToggle.tsx` (new)
- **Location:** Account → Settings → Advanced Options
- **UI:**
  ```
  Enable Advanced Features?
  ⚠️ Power user mode shows all features.
  You can make complex trades and access
  raw contract interactions.
  
  Only enable if you understand risks.
  
  [I understand] [More Info] [No thanks]
  ```
- **Effect:** Sets `user.advancedMode = true` → unlocks all features
- **Effort:** 2 hours
- **Acceptance:**
  - [ ] Toggle visible in settings
  - [ ] Warning modal shown before enabling
  - [ ] All features unlock when enabled

---

### 3.2 Onboarding Path Selection

**Purpose:** Guide new users to their primary use case (not all features)

**Implementation:**

#### Task 3.2a: OnboardingPathSelector Component
- **File:** `client/src/components/OnboardingPathSelector.tsx` (new)
- **Shown:** First login after signup
- **Options:**
  ```
  How do you want to use MTAA?
  
  1. 💾 Just Save
     Keep money safe, earn interest
     (Best for: Okedi)
  
  2. 👥 Earn Together
     Join or create a group, vote on spending
     (Best for: Yuki)
  
  3. 📈 Trade & Farm
     Find opportunities, optimize yield
     (Best for: Amara)
  
  [Select Path]
  ```
- **Effect:**
  - Sets `user.onboardingPath`
  - Unlocks features related to that path
  - Customizes dashboard, tips, tutorials
- **Effort:** 3 hours
- **Acceptance:**
  - [ ] Modal shown on first login
  - [ ] Each path leads to relevant features
  - [ ] Can be changed in settings

#### Task 3.2b: Path-Specific Tutorials
- **File:** `client/src/components/tutorials/PathTutorial.tsx` (new)
- **Content:**
  - "Just Save" → Send, deposit, watch earn (3 steps)
  - "Earn Together" → Create DAO, invite, vote (4 steps)
  - "Trade & Farm" → Swap, bridge, farm (3 steps)
- **Delivery:**
  - Shown as tooltips on first visit to each section
  - Can be replayed from Help menu
- **Effort:** 6 hours (3 paths × 2 hours)
- **Acceptance:**
  - [ ] Tutorials appear for path
  - [ ] Can be skipped
  - [ ] Can be replayed

---

## PHASE 4: DESIGN SYSTEM & COMPONENTS (Weeks 5-7) — Parallel with Phase 3

### 4.1 Component Library Audit

**Purpose:** Ensure consistent patterns across app

**Implementation:**

#### Task 4.1a: Audit Existing Components
- **Scan:** `client/src/components/ui/` directory
- **Document:**
  - Button variations (primary, secondary, danger, disabled)
  - Card patterns (info, action, warning)
  - Modal sizes and types
  - Form inputs (text, select, checkbox, toggle)
  - Color usage (trust, caution, risk, neutral)
- **Effort:** 3 hours
- **Deliverable:** `COMPONENT_AUDIT.md`
- **Acceptance:**
  - [ ] All existing components documented
  - [ ] Inconsistencies identified
  - [ ] Recommendations provided

#### Task 4.1b: Standardize Button Component
- **File:** `client/src/components/ui/Button.tsx`
- **Variants:**
  ```tsx
  <Button variant="primary">Send Money</Button>    // Blue, filled
  <Button variant="secondary">Cancel</Button>      // Gray, outlined
  <Button variant="danger">Delete</Button>         // Red, outlined
  <Button variant="ghost">Learn More</Button>      // No border
  <Button size="sm">Quick Action</Button>          // Small
  <Button size="lg">Primary Action</Button>        // Large
  <Button disabled>Coming Soon</Button>            // Disabled state
  <Button loading>Processing...</Button>           // Loading state
  ```
- **Sizes:** sm (32px), md (40px), lg (48px)
- **Mobile:** All buttons min 44px height
- **Effort:** 3 hours
- **Acceptance:**
  - [ ] Variants match design spec
  - [ ] States render correctly
  - [ ] Mobile sizing OK
  - [ ] All existing buttons migrated

#### Task 4.1c: Standardize Card Component
- **File:** `client/src/components/ui/Card.tsx`
- **Variants:**
  - `variant="info"` → Gray background, title-body
  - `variant="action"` → Blue border, CTA button
  - `variant="warning"` → Orange border, attention icon
  - `variant="success"` → Green border, checkmark
- **Structure:**
  ```tsx
  <Card variant="action">
    <Card.Header icon={SendIcon}>Send Money</Card.Header>
    <Card.Body>
      Enter amount and recipient
    </Card.Body>
    <Card.Footer>
      <Button>Send</Button>
    </Card.Footer>
  </Card>
  ```
- **Effort:** 3 hours
- **Acceptance:**
  - [ ] All card variants render
  - [ ] Colors match palette
  - [ ] Responsive layout works
  - [ ] Existing cards migrated

---

### 4.2 Icon System

**Purpose:** Consistent, clear icons for all actions

**Implementation:**

#### Task 4.2a: Icon Audit & Standardization
- **Source:** Lucide React or similar
- **Standard Set:**
  | Action | Icon | Used For |
  |--------|------|----------|
  | Send | Send | Outgoing transfer |
  | Receive | Download | Incoming, deposit |
  | Wallet | Wallet | Wallets section |
  | DAO | Users | DAO, governance |
  | Vote | CheckCircle | Voting action |
  | Proposals | FileText | Proposals list |
  | Settings | Settings | Configuration |
  | Help | HelpCircle | Help, tutorials |
  | Warning | AlertTriangle | Warnings |
  | Success | CheckCircle | Completion |
  | Error | XCircle | Errors |
  | Loading | Loader | Processing |
- **Effort:** 2 hours
- **Acceptance:**
  - [ ] Icon set defined
  - [ ] All icons 24px or 32px
  - [ ] Consistent stroke weight
  - [ ] Used consistently across app

---

## PHASE 5: TESTING & VALIDATION (Weeks 7-8)

### 5.1 Acceptance Testing

#### Task 5.1a: Persona Testing
- **Setup:** Recruit 3 users (beginner, intermediate, advanced)
- **Test:**
  1. First login → see correct dashboard?
  2. Send money → understand cost before confirm?
  3. Join DAO → clear steps?
  4. Vote → understand impact?
  5. Access advanced feature → gating works?
- **Success Metric:** Each persona completes tasks in target time
  - Okedi: 3 min send, 10 min first deposit
  - Yuki: 10 min create DAO, understand voting
  - Amara: < 2 min to find and execute opportunity
- **Effort:** 8 hours (recruiting, testing, documentation)

#### Task 5.1b: Mobile Testing
- **Devices:** iPhone (iOS), Android phone
- **Test:**
  - Navigation tappable on small screens?
  - Modals readable on 375px width?
  - Forms work on mobile keyboard?
  - Images load fast?
- **Effort:** 4 hours
- **Acceptance:**
  - [ ] All flows work on mobile
  - [ ] No horizontal scrolling
  - [ ] Touch targets min 44px
  - [ ] Load time < 3 sec on 4G

#### Task 5.1c: Accessibility Testing
- **Tools:** Lighthouse, aXe, WAVE
- **Check:**
  - Color contrast (WCAG AA)
  - Keyboard navigation
  - Screen reader compatibility
  - Form labels & ARIA
- **Effort:** 4 hours
- **Acceptance:**
  - [ ] Lighthouse score > 90
  - [ ] No aXe critical errors
  - [ ] Keyboard navigation works
  - [ ] Screen reader can read key elements

---

## IMPLEMENTATION CHECKLIST

### Week 1
- [ ] Navigation consolidated (1.1a, 1.1b, 1.1c)
- [ ] Home dashboard personalization (1.2a, 1.2b)
- [ ] Quick actions component (1.3a, 1.3b)

### Week 2
- [ ] Old dashboard removed (1.2c)
- [ ] Transaction preview modal (2.1a, 2.1b)
- [ ] Proposal impact card (2.2a, 2.2b)

### Week 3
- [ ] Security explanations (2.3a, 2.3b)
- [ ] Feature gate hook (3.1a)
- [ ] Gated feature wrapper (3.1b)

### Week 4
- [ ] Advanced toggle (3.1c)
- [ ] Onboarding path selector (3.2a, 3.2b)
- [ ] Component audit complete (4.1a, 4.1b, 4.1c)

### Week 5
- [ ] Icon system (4.2a)
- [ ] Persona testing (5.1a)
- [ ] Mobile testing (5.1b)

### Week 6
- [ ] Accessibility testing (5.1c)
- [ ] Bug fixes from testing
- [ ] Documentation updates

---

## DEPENDENCY GRAPH

```
Phase 1 (Foundation)
├── Navigation Consolidation (1.1a, 1.1b, 1.1c)
│   └─> Dashboard Redesign (1.2a, 1.2b, 1.2c)
│       └─> Quick Actions (1.3a, 1.3b)
│
Phase 2 (Trust)
├── Transaction Preview (2.1a, 2.1b)
├── Proposal Impact (2.2a, 2.2b)
└── Security Explanations (2.3a, 2.3b)
    └─> Feature Gates (3.1a, 3.1b, 3.1c)
│
Phase 3 (Progressive Disclosure)
├── Feature Gates (3.1)
└── Onboarding Paths (3.2)
│
Phase 4 (Design System) — Can run parallel with Phase 3
├── Component Audit (4.1)
└── Icon System (4.2)
│
Phase 5 (Testing) — After Phase 1-4 complete
├── Persona Testing (5.1a)
├── Mobile Testing (5.1b)
└── Accessibility Testing (5.1c)
```

---

## Effort Summary

| Phase | Task | Hours |
|-------|------|-------|
| 1 | Navigation | 5 |
| 1 | Dashboard | 11 |
| 1 | Quick Actions | 6 |
| 2 | Transaction Preview | 6 |
| 2 | Proposal Impact | 5 |
| 2 | Security | 5 |
| 3 | Feature Gates | 10 |
| 3 | Onboarding | 9 |
| 4 | Components | 11 |
| 5 | Testing | 16 |
| **Total** | | **84 hours** |

**Team Recommendation:** 2 designers + 2 frontend engineers = 4 weeks (full-time)

---

## Success Metrics

After implementation, measure:

1. **Cognitive Load (Survey)**
   - "The dashboard is clear and not overwhelming" → Target: 8/10
   - "I understood what would happen before clicking" → Target: 8/10

2. **Task Completion Time**
   - First deposit: 3 min (current ~10 min)
   - First vote: 5 min (current ~15 min)
   - Find opportunity (Amara): 30 sec (current 2 min)

3. **Retention**
   - Day 7 retention: 70% (current ~40%)
   - Week 4 retention: 55% (current ~30%)

4. **Support Tickets**
   - "Confused about feature" reduction: 50%
   - "Didn't understand cost" reduction: 75%

5. **Feature Adoption**
   - "Advanced features" adoption (among advanced users): 80%
   - Proposal voting participation: 60% (current ~35%)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Navigation changes break bookmarks | High | Implement 301 redirects for all old routes |
| Feature gating too aggressive | Medium | A/B test unlock criteria; monitor user feedback |
| New users confused by onboarding modal | Medium | Make modal skippable; offer [Tell Me More] link |
| Mobile layout breaks | High | Test early and often; use responsive design patterns |
| Feature gating removes power from Amara | Medium | Provide manual [Enable Advanced] opt-in |

---

## Glossary (For Implementation Team)

- **Persona:** User archetype (Okedi/Yuki/Amara)
- **Feature Gate:** Conditional feature visibility based on user criteria
- **Quick Actions:** Contextual buttons for common tasks
- **Transaction Preview:** Modal showing cost/impact before confirmation
- **Onboarding Path:** Initial user flow based on primary use case
- **Progressive Disclosure:** Showing features only when user is ready

---

**Document Version:** 1.0  
**Last Updated:** January 26, 2026  
**Status:** Ready for Development Sprint

