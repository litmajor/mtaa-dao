# MTAA DAO: UI/UX Redesign — Implementation Checklist

**Status:** Week 2 Components Complete - API Integration & SecurityContextModal Done  
**Last Updated:** January 26, 2026
**Progress:** Phase 1-2 Documentation Complete | Components Implemented | API Integration Layer Ready

---

## 📋 PRE-IMPLEMENTATION CHECKLIST

### Stakeholder Alignment (Do This First)
- [ ] Executive sponsor reviews UIUX_REDESIGN_EXECUTIVE_SUMMARY.md
- [ ] Executive sponsor approves budget & timeline
- [ ] Executive sponsor assigns project lead (PM)
- [ ] Project lead assembles 4-person team (2 design, 2 eng)
- [ ] Team leads (Design + Engineering) review scope in TACTICAL_GUIDE.md
- [ ] Team all-hands: Review the 7 principles from SYSTEMS_ARCHITECTURE.md PART 4

**Estimated Time:** 3 hours (1 exec meeting, 2 team meetings)  
**Outcome:** Full buy-in, clear ownership, ready to execute

---

## PHASE 1: FOUNDATION (Weeks 1-2) — 19 hours engineering

### Week 1: Navigation & Dashboard

#### Task 1.1: Navigation Consolidation [5 hours]
**Objective:** Reduce nav from 8 to 4 items

**Checklist:**
- [ ] Design lead creates nav mockup (4 items: Home, Finance, DAO, Account)
- [ ] Engineering agrees on routing structure
- [ ] Create component: `client/src/components/GlobalNav.tsx`
- [ ] Update router: Add 301 redirects for old routes
- [ ] Test: All old routes → new routes work
- [ ] Test: Mobile nav (icons only, stacked on narrow)
- [ ] Test: Active states, hover states, focus states
- [ ] Document: Navigation structure in design system

**Acceptance Criteria:**
- [ ] Only 4 nav items visible (not 8)
- [ ] Mobile responsive (< 375px width)
- [ ] Old links don't break (301 redirects)
- [ ] Active nav item clearly highlighted
- [ ] Touch targets min 44px
- [ ] No console errors

**Status:** Not Started | Assigned To: [NAME] | Due: [DATE]

---

#### Task 1.2: Home Dashboard Personalization [11 hours]
**Objective:** Create 3 different dashboards (Okedi, Yuki, Amara)

**Subtasks:**

**1.2a: Persona Detection Hook** [3 hours]
- [ ] Create hook: `client/src/hooks/useDashboardPersona.ts`
- [ ] Logic: Detect persona based on (account age, balance, DAO role, feature adoption)
- [ ] Test: Correctly identifies test users
- [ ] Test: Updates in real-time when balance changes
- [ ] Document: How persona detection works

**Acceptance:**
- [ ] Hook returns correct persona
- [ ] Works with all persona types
- [ ] No API calls (uses local data)

---

**1.2b: Dashboard Layout Generator** [5 hours]
- [ ] Design: 3 dashboard layouts (Okedi, Yuki, Amara)
- [ ] Create component: `client/src/components/dashboard/PersonalizedDashboard.tsx`
- [ ] Okedi's dashboard:
  - [ ] Balance card (with trend)
  - [ ] Quick actions: Receive, Send, Save, Learn
  - [ ] Recent transactions (max 3)
  - [ ] Tip of the day
- [ ] Yuki's dashboard:
  - [ ] DAO treasury card
  - [ ] Personal balance widget
  - [ ] Pending actions list
  - [ ] Latest proposal highlight
- [ ] Amara's dashboard:
  - [ ] Portfolio card (ROI)
  - [ ] Opportunities list
  - [ ] Governance alerts
  - [ ] Advanced options
- [ ] Test: Each layout loads in < 2 seconds
- [ ] Test: Mobile layout stacks correctly
- [ ] Test: No overlapping elements

**Acceptance:**
- [ ] 3 dashboards match mockups
- [ ] Load time < 2 sec
- [ ] Mobile responsive
- [ ] All cards render correctly

---

**1.2c: Remove Old Dashboard** [1 hour]
- [ ] Hide/delete: Old dashboard component
- [ ] Hide/delete: Unused analytics panels
- [ ] Hide/delete: Unused leaderboard widget
- [ ] Redirect: Old `/dashboard` → `/home`
- [ ] Test: No dead links
- [ ] Test: No console errors from missing components

**Acceptance:**
- [ ] Old dashboard no longer appears
- [ ] All features still accessible (moved)
- [ ] No 404 errors

---

**1.2d: Create DAO Context Selector** [2 hours]
- [ ] Design: Sticky context selector (top-right below avatar)
- [ ] Create component: `client/src/components/DaoContextSelector.tsx`
- [ ] Feature:
  - [ ] Shows current DAO
  - [ ] Dropdown to switch DAOs
  - [ ] Shows user's role in DAO
  - [ ] [+ Create New DAO] button
- [ ] Behavior:
  - [ ] Sticky across all pages
  - [ ] Persists selection in localStorage
  - [ ] Updates content when DAO changes
  - [ ] Modal opens for DAO creation
- [ ] Test: Mobile appearance (works on small screens)
- [ ] Test: Multiple DAOs render correctly
- [ ] Test: Selection persists on refresh

**Acceptance:**
- [ ] Selector appears on all pages
- [ ] Switching DAO updates content
- [ ] Persists selection across sessions
- [ ] Mobile-friendly

---

### Week 1-2: Quick Actions Component

#### Task 1.3: Quick Actions Bar [6 hours]

**1.3a: QuickActionsBar Component** [2 hours]
- [ ] Design: 4 action buttons per persona
- [ ] Create component: `client/src/components/QuickActionsBar.tsx`
- [ ] Props: `persona` (okedi | yuki | amara)
- [ ] Okedi's buttons: [Receive] [Send] [Save] [Learn]
- [ ] Yuki's buttons: [Vote] [Spend] [Add Members] [Report]
- [ ] Amara's buttons: [Trade] [Farm] [Bridge] [Advanced]
- [ ] Styling: 4 equal-width buttons (responsive)
- [ ] Test: All buttons clickable
- [ ] Test: Mobile (stack on narrow screens)
- [ ] Test: Icons + text visible

**Acceptance:**
- [ ] 4 buttons rendered
- [ ] Icons match actions
- [ ] Mobile responsive
- [ ] Touch targets 44px+

---

**1.3b: Action Modal Flows** [4 hours]
- [ ] Create modals:
  - [ ] `ReceiveModal.tsx` — Show QR code + address
  - [ ] `SendModal.tsx` — Send flow with preview (see Task 2.1)
  - [ ] `SaveModal.tsx` — Join/deposit to vault
  - [ ] `LearnModal.tsx` — Help + tips
- [ ] Each modal:
  - [ ] Opens on button click
  - [ ] < 3 input fields
  - [ ] Clear [Cancel] button
  - [ ] Shows cost/impact before confirm
- [ ] Test: All modals open/close correctly
- [ ] Test: Mobile modal sizing
- [ ] Test: Keyboard navigation

**Acceptance:**
- [ ] Modals appear on action click
- [ ] Clean, simple UI (< 3 fields)
- [ ] Mobile-responsive
- [ ] No modal bugs

---

## PHASE 2: TRUST MOMENTS (Weeks 3-4) — 14 hours engineering

### Week 3: Transparency Features

#### Task 2.1: Transaction Preview Modal [4 hours]
**Objective:** Show impact before user confirms send

**Checklist:**
- [ ] Create component: `client/src/components/modals/TransactionPreviewModal.tsx`
- [ ] Flow: 3 steps
  - [ ] Enter amount → shows preview
  - [ ] Review preview (recipient, amount, fee, timeline)
  - [ ] Confirm with PIN
- [ ] Preview shows:
  - [ ] Recipient (name + address truncated)
  - [ ] Amount (in local currency + crypto)
  - [ ] Fee breakdown (not just total)
  - [ ] Timeline ("~30 seconds")
  - [ ] Reversibility status ("Can't undo once sent")
- [ ] Design: Follow mockup in DESIGN_MOCKUPS.md SECTION 2
- [ ] Test: All flows work
- [ ] Test: Mobile layout
- [ ] Test: Fee calculation correct
- [ ] Test: Timeline accurate

**Acceptance:**
- [ ] Fee breakdown visible before confirm
- [ ] Recipient clearly identified
- [ ] Timeline shown
- [ ] PIN required
- [ ] Mobile-responsive

---

#### Task 2.2: Proposal Impact Visualization [5 hours]
**Objective:** Show DAO impact before user votes

**Checklist:**
- [ ] Create component: `client/src/components/ProposalImpactCard.tsx`
- [ ] Shows:
  - [ ] Budget impact (% of treasury)
  - [ ] Voting progress bar (visual)
  - [ ] Quorum status (votes needed)
  - [ ] Timeline (voting ends in X hours)
  - [ ] Similar past proposals (for context)
- [ ] Design: Follow mockup in DESIGN_MOCKUPS.md SECTION 3
- [ ] Calculations:
  - [ ] Budget % = (proposal amount / total treasury) × 100
  - [ ] Remaining votes = votes needed − current votes
  - [ ] Time remaining = voting deadline − now
- [ ] Test: Math correct
- [ ] Test: Real-time updates (socket integration)
- [ ] Test: Mobile layout
- [ ] Test: Visual proportions accurate

**Acceptance:**
- [ ] Budget impact calculated correctly
- [ ] Visual bars proportional
- [ ] Quorum calculation accurate
- [ ] Mobile-responsive
- [ ] Real-time updates work

---

#### Task 2.3: Update Proposal Detail Page [1 hour]
**Objective:** Add impact card to proposal page

**Checklist:**
- [ ] File: `client/src/components/ProposalDetail.tsx`
- [ ] Add component: `<ProposalImpactCard />` at top
- [ ] Test: Impact card appears
- [ ] Test: Proposal text below card
- [ ] Test: Card updates with votes
- [ ] No layout breaking

**Acceptance:**
- [ ] Impact card visible at top
- [ ] Content doesn't overflow
- [ ] Real-time updates

---

### Week 4: Security Explanations

#### Task 2.4: Security Explanations [5 hours]
**Objective:** Explain "why" for security features

**Checklist:**

**2.4a: SecurityContextModal Component** [3 hours]
- [ ] Create component: `client/src/components/modals/SecurityContextModal.tsx`
- [ ] Shows before security change:
  - [ ] "What's at risk?" (explain threat)
  - [ ] "Why this helps?" (explain mitigation)
  - [ ] "What's the cost?" (time, UX impact)
- [ ] Confirmation checkbox: "I understand this"
- [ ] Design: Use clear, simple language (no jargon)
- [ ] Examples:
  - [ ] 2FA: Risk = password leak, Help = second lock
  - [ ] Key export: Risk = permanent loss, Help = backup
  - [ ] PIN: Risk = unauthorized access, Help = guard access
- [ ] Test: Language understandable by non-tech users
- [ ] Test: Checkbox required before action
- [ ] Test: [Learn More] link helpful

**Acceptance:**
- [ ] Modal appears before security change
- [ ] Language is simple (no jargon)
- [ ] Checkbox prevents accidental enable
- [ ] [Learn More] links work

---

**2.4b: Apply to All Security Settings** [2 hours]
- [x] File: `client/src/components/settings/SecuritySettings.tsx` → `frontend/components/SecuritySettings/SecurityOverview.tsx` (IMPLEMENTED)
- [x] Add SecurityContextModal to:
  - [x] Enable 2FA (✅ Created SecurityContextModal component + integrated with modal configs)
  - [x] Change PIN (✅ Modal context + handler implemented)
  - [x] Export keys (✅ Modal context + handler implemented)
  - [x] Enable/disable social recovery (✅ Modal context + handler implemented)
- [x] SecurityContextModal component created: `frontend/components/SecuritySettings/SecurityContextModal.tsx`
- [x] API integration layer created: `frontend/api/index.ts` with:
  - [x] sendFlow APIs (estimateFee, submitTransaction)
  - [x] proposalVoting APIs (getImpact, submitVote)
  - [x] security APIs (2FA, PIN, keys, social recovery)
- [ ] Preload explanations (simple JSON)
- [ ] Test: All security features have explanations
- [ ] Test: Modals trigger before action

**Acceptance:**
- [ ] All security features have explanations
- [ ] Modals trigger correctly
- [ ] No modal crashes

---

## PHASE 3: PROGRESSIVE DISCLOSURE (Weeks 5-6) — 19 hours engineering

### Week 5: Feature Gating

#### Task 3.1: Feature Tier System [10 hours]

**3.1a: FeatureGate Hook** [3 hours]
- [ ] Create hook: `client/src/hooks/useFeatureGate.ts`
- [ ] Logic:
  ```
  const gatingRules = {
    'dao.join': { requiredAge: 7 },
    'vault.yield': { requiredBalance: 10000000 },
    'trading.dex': { manualOptIn: true },
    'proposal.create': { requiredRole: 'admin' },
  };
  ```
- [ ] Returns: `{ isGated: boolean, reason: string }`
- [ ] Test: All conditions check correctly
- [ ] Test: Returns correct reason
- [ ] Test: Works with feature flags

**Acceptance:**
- [ ] Hook correctly checks conditions
- [ ] Returns reason for gating
- [ ] Works with all rule types

---

**3.1b: GatedFeature Wrapper Component** [3 hours]
- [ ] Create component: `client/src/components/FeatureGate.tsx`
- [ ] Usage:
  ```tsx
  <FeatureGate feature="trading.dex" fallback={<UpgradeMessage />}>
    <DexSwapInterface />
  </FeatureGate>
  ```
- [ ] Fallback messages:
  - [ ] If age-gated: "Available in 5 more days! [Why?]"
  - [ ] If balance-gated: "Deposit 10K more [Why?]"
  - [ ] If manual opt-in: "[Enable Advanced Features]"
- [ ] Test: Gated features hidden
- [ ] Test: Fallback messages helpful
- [ ] Test: [Why?] explains reason

**Acceptance:**
- [ ] Gated features hidden by default
- [ ] Fallback message helpful
- [ ] [Why?] link explains reason

---

**3.1c: Advanced Mode Toggle** [2 hours]
- [ ] Create toggle: `client/src/components/settings/AdvancedToggle.tsx`
- [ ] Location: Account → Settings → Advanced Options
- [ ] Warning modal before enabling
- [ ] When enabled: All features unlock
- [ ] Storage: `user.advancedMode = true` (database)
- [ ] Test: Toggle works
- [ ] Test: Warning shown
- [ ] Test: All features unlock
- [ ] Test: Persists on refresh

**Acceptance:**
- [ ] Toggle visible in settings
- [ ] Warning modal shown
- [ ] All features unlock when enabled

---

#### Task 3.2: Onboarding Path Selection [9 hours]

**3.2a: OnboardingPathSelector Component** [3 hours]
- [ ] Create component: `client/src/components/OnboardingPathSelector.tsx`
- [ ] Shown: First login after signup
- [ ] Options:
  - [ ] 💾 Just Save (Okedi path)
  - [ ] 👥 Earn Together (Yuki path)
  - [ ] 📈 Trade & Farm (Amara path)
- [ ] Design: Follow mockup (radio buttons + descriptions)
- [ ] Effect: Sets `user.onboardingPath` (database)
- [ ] Customizes: Dashboard, tips, tutorials
- [ ] Test: Modal shown on first login
- [ ] Test: Each path leads to relevant features
- [ ] Test: Can be changed in settings
- [ ] Test: Persists on refresh

**Acceptance:**
- [ ] Modal shown on first login
- [ ] 3 paths available
- [ ] Setting persists
- [ ] Features match path

---

**3.2b: Path-Specific Tutorials** [3 hours]
- [ ] Create component: `client/src/components/tutorials/PathTutorial.tsx`
- [ ] 3 paths:
  - [ ] "Just Save" → Send, deposit, watch earn (3 steps)
  - [ ] "Earn Together" → Create DAO, invite, vote (4 steps)
  - [ ] "Trade & Farm" → Swap, bridge, farm (3 steps)
- [ ] Delivery: Tooltips on first visit to each section
- [ ] Can be: Replayed from Help menu
- [ ] Design: Tooltips + step-by-step UI
- [ ] Test: Tutorials appear for path
- [ ] Test: Can be skipped
- [ ] Test: Can be replayed

**Acceptance:**
- [ ] Tutorials appear for path
- [ ] Can be skipped
- [ ] Can be replayed
- [ ] Steps clear

---

**3.2c: Feature Unlock Based on Path** [3 hours]
- [ ] Update gating rules to consider `onboardingPath`
- [ ] "Just Save" → Hide trading, governance
- [ ] "Earn Together" → Hide advanced trading
- [ ] "Trade & Farm" → Show all (with advanced toggle)
- [ ] Test: Path affects feature visibility
- [ ] Test: Changing path updates visibility
- [ ] Test: Manual opt-in overrides path

**Acceptance:**
- [ ] Path affects feature visibility
- [ ] All features accessible via opt-in
- [ ] No forced restrictions

---

## PHASE 4: DESIGN SYSTEM (Weeks 5-7, parallel with Phase 3) — 11 hours

### Weeks 5-6: Component Standardization

#### Task 4.1: Component Audit [3 hours]

**4.1a: Audit Existing Components** [2 hours]
- [ ] Scan: `client/src/components/ui/` directory
- [ ] Document: Button variations
- [ ] Document: Card patterns
- [ ] Document: Modal styles
- [ ] Document: Form inputs
- [ ] Document: Color usage
- [ ] Create: `COMPONENT_AUDIT.md`
- [ ] Identify inconsistencies
- [ ] Provide recommendations

**Acceptance:**
- [ ] All existing components documented
- [ ] Inconsistencies identified
- [ ] Recommendations provided

---

**4.1b: Standardize Button Component** [2 hours]
- [ ] File: `client/src/components/ui/Button.tsx`
- [ ] Variants:
  - [ ] `variant="primary"` (blue, filled)
  - [ ] `variant="secondary"` (gray, outlined)
  - [ ] `variant="danger"` (red, outlined)
  - [ ] `variant="ghost"` (no border)
- [ ] Sizes: sm (32px), md (40px), lg (48px)
- [ ] States: default, hover, active, disabled, loading
- [ ] Test: All variants render
- [ ] Test: Mobile sizing (min 44px)
- [ ] Test: States work

**Acceptance:**
- [ ] Variants match spec
- [ ] States render correctly
- [ ] Mobile sizing OK
- [ ] All buttons migrated

---

**4.1c: Standardize Card Component** [1 hour]
- [ ] File: `client/src/components/ui/Card.tsx`
- [ ] Variants: info, action, warning, success
- [ ] Structure: Header, Body, Footer
- [ ] Test: All variants render
- [ ] Test: Colors match palette
- [ ] Test: Responsive layout

**Acceptance:**
- [ ] Card variants render
- [ ] Colors correct
- [ ] Responsive layout works

---

#### Task 4.2: Icon System [2 hours]

**4.2a: Icon Audit & Standardization** [2 hours]
- [ ] Source: Lucide React
- [ ] Standard set: Send, Receive, Wallet, DAO, Vote, Proposals, Settings, Help, Warning, Success, Error, Loading
- [ ] Size: 24px or 32px
- [ ] Stroke weight: Consistent
- [ ] Test: All icons render
- [ ] Test: Consistent sizing
- [ ] Test: Used consistently

**Acceptance:**
- [ ] Icon set defined
- [ ] All icons 24/32px
- [ ] Consistent stroke weight
- [ ] Used consistently across app

---

## PHASE 5: TESTING & VALIDATION (Weeks 7-8) — 16 hours

### Week 7: User Testing

#### Task 5.1a: Persona Testing [8 hours]
**Objective:** Test with real users (Okedi, Yuki, Amara personas)

**Checklist:**
- [ ] Recruit: 1 beginner (Okedi), 1 intermediate (Yuki), 1 advanced (Amara)
- [ ] Setup: Test scenarios, capture video, take notes
- [ ] Test Scenarios:
  1. [ ] First login → see correct dashboard?
  2. [ ] Send money → understand cost before confirm?
  3. [ ] Join DAO → clear steps?
  4. [ ] Vote → understand impact?
  5. [ ] Access advanced feature → gating works?
- [ ] Measure: Task completion time, confidence score, errors
- [ ] Document: Results + learnings
- [ ] Iterate: Fix blockers found in testing

**Success Criteria:**
- [ ] Okedi: Send in < 3 min, confidence 7+/10
- [ ] Yuki: Create DAO in < 10 min, understand voting
- [ ] Amara: Find opportunity in < 30 sec
- [ ] All: Zero critical errors

---

#### Task 5.1b: Mobile Testing [4 hours]
**Objective:** Ensure app works on small screens

**Checklist:**
- [ ] Devices: iPhone (iOS), Android phone
- [ ] Test All Flows:
  - [ ] Navigation on small screen?
  - [ ] Modals readable (375px)?
  - [ ] Forms work (mobile keyboard)?
  - [ ] Images load fast?
  - [ ] Touch targets 44px+?
- [ ] Measure: Load time, layout integrity
- [ ] Document: Mobile bugs
- [ ] Fix: All blockers

**Success Criteria:**
- [ ] All flows work on mobile
- [ ] No horizontal scrolling
- [ ] Touch targets min 44px
- [ ] Load time < 3 sec on 4G

---

#### Task 5.1c: Accessibility Testing [4 hours]
**Objective:** WCAG AA compliance

**Checklist:**
- [ ] Tools: Lighthouse, aXe, WAVE
- [ ] Check:
  - [ ] Color contrast (WCAG AA)
  - [ ] Keyboard navigation
  - [ ] Screen reader compatibility
  - [ ] Form labels + ARIA
- [ ] Measure: Lighthouse score, aXe violations
- [ ] Document: Issues found
- [ ] Fix: All critical issues

**Success Criteria:**
- [ ] Lighthouse score > 90
- [ ] No aXe critical errors
- [ ] Keyboard navigation works
- [ ] Screen reader can read key elements

---

### Week 8: Bug Fixes & Finalization

#### Task 5.2: Address Testing Findings [Varies]
- [ ] Prioritize bugs found in testing
- [ ] Fix critical issues (blockers)
- [ ] Fix high-priority issues (UX)
- [ ] Document low-priority issues (future)
- [ ] Retest: Verify fixes work
- [ ] Regression testing: Ensure nothing broke

---

## 📊 PROGRESS TRACKING

### Weekly Standup Template
```
Week X Standup (Date: _____)

COMPLETED THIS WEEK:
[ ] Task 1.1a: _____ [Status: ✓ Done]
[ ] Task 1.2b: _____ [Status: ⏳ 80% done]

IN PROGRESS:
[ ] Task 1.2c: _____ [Blocker: None]
[ ] Task 1.3a: _____ [Blocker: Awaiting design]

NEXT WEEK PRIORITIES:
[ ] Task 2.1: Transaction preview
[ ] Task 2.2: Proposal impact

RISKS / BLOCKERS:
[ ] None currently

METRICS:
- Velocity: X hours/week
- On Schedule: Yes/No
- Quality: X bugs found, Y fixed
```

---

## ✅ SIGN-OFF CHECKLIST

### Phase 1 Complete When:
- [ ] All 6 Phase 1 tasks done
- [ ] Acceptance criteria met for each task
- [ ] Code reviewed & merged
- [ ] No high-priority bugs
- [ ] Design handoff complete
- [ ] Documentation updated

### Phase 2 Complete When:
- [ ] All 3 Phase 2 tasks done
- [ ] Acceptance criteria met
- [ ] Code reviewed & merged
- [ ] No high-priority bugs
- [ ] Design handoff complete
- [ ] User ready to vote on features

### Phase 3 Complete When:
- [ ] Tasks 3.1 & 3.2 done
- [ ] Feature gating working
- [ ] Onboarding paths active
- [ ] All features accessible via opt-in
- [ ] No high-priority bugs

### Phase 4 Complete When:
- [ ] Button standardized
- [ ] Cards standardized
- [ ] Icons standardized
- [ ] All components using standard library
- [ ] No visual inconsistencies

### Phase 5 Complete When:
- [ ] User testing done (3+ personas)
- [ ] Mobile testing done
- [ ] Accessibility tested
- [ ] All critical bugs fixed
- [ ] Metrics collected

### READY FOR LAUNCH When:
- [ ] All 5 phases complete
- [ ] Success metrics met (or close)
- [ ] Team confident in quality
- [ ] Documentation complete
- [ ] Rollout plan finalized

---

## 📞 ESCALATION PATH

**If blocked:**
1. Post in team Slack (give context + what you need)
2. Ping project lead if > 2 hours blocked
3. Schedule 15-min sync call if can't resolve async
4. Escalate to PM if blocking multiple people

**If discovering new scope:**
1. Document issue + impact
2. Discuss with PM before starting work
3. Decide: Now vs. Phase 2?
4. Update timeline if needed

**If finding bugs in existing code:**
1. Log issue with reproducible steps
2. Note: Is it blocking this task? Or future phase?
3. Fix if blocking; document if not

---

**Document Version:** 1.0  
**Last Updated:** January 26, 2026  
**Status:** Ready to Print & Use

Print this, tape to team room, check off items as you go! 📌

