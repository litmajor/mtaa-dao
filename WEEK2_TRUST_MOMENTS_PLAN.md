# Week 2 UI/UX Redesign - TRUST MOMENTS Implementation Plan

**Phase:** Week 2 of 4-Week Redesign  
**Date:** January 26, 2026  
**Focus:** Building Trust Through Transparency  
**Duration:** 14 hours engineering + 10 hours design  
**Team:** 2 Designers + 2 Engineers

---

## 📋 Week 2 Overview

Week 2 focuses on **TRUST MOMENTS** - critical user interactions where transparency and clarity prevent fear and errors.

### Three Core Components

| Component | Owner | Hours | Goal |
|-----------|-------|-------|------|
| 1. Send Money Flow | Engineer 1 | 4h | Impact preview before commitment |
| 2. Proposals Interface | Engineer 2 | 5h | Show DAO impact, encourage voting |
| 3. Security Settings | Engineer 1 | 5h | Explain "why" behind security |
| **Design Support** | Designers | 10h | Mockups, copy, validation |

---

## 🎯 Week 2 Success Criteria

| Metric | Target | Validation |
|--------|--------|-----------|
| Send Flow Clarity | Users understand fees/timeline before confirm | User testing |
| Proposal Context | Users see impact of their vote before voting | Analytics: click tracking |
| Security Adoption | Users enable 2FA after reading explanation | Settings completion rate |
| First Transaction Time | Reduce to < 3 min (from 10 min) | Stopwatch test |
| Mobile Responsive | All components work on mobile | Device testing |

---

## 📁 Project Structure

```
frontend/
├── components/
│   ├── SendFlow/
│   │   ├── SendFlowPreview.tsx          [NEW]
│   │   ├── SendFlowReview.tsx           [NEW]
│   │   ├── ImpactPreview.tsx            [NEW]
│   │   └── SendFlowStyles.module.css    [NEW]
│   │
│   ├── ProposalVoting/
│   │   ├── ProposalContext.tsx          [NEW]
│   │   ├── ProposalImpactCard.tsx       [NEW]
│   │   ├── QuorumStatus.tsx             [NEW]
│   │   └── ProposalStyles.module.css    [NEW]
│   │
│   └── SecuritySettings/
│       ├── SecurityOverview.tsx         [NEW]
│       ├── TwoFactorSetup.tsx           [NEW]
│       ├── RiskExplainer.tsx            [NEW]
│       └── SecurityStyles.module.css    [NEW]
│
├── hooks/
│   ├── useSendFlow.ts                   [NEW]
│   ├── useProposalImpact.ts             [NEW]
│   └── useSecuritySetup.ts              [NEW]
│
├── context/
│   └── TrustMomentsContext.tsx          [NEW]
│
└── pages/
    ├── SendPage.tsx                     [UPDATE]
    ├── ProposalPage.tsx                 [UPDATE]
    └── SecurityPage.tsx                 [NEW]
```

---

## Task 1: Send Money Flow with Impact Preview

### 📐 Design Specifications

**Current State (Problem):**
```
[SEND MONEY]
  ↓
[Enter Amount] 
  ↓
[Choose Recipient]
  ↓
[Confirm] ← User hits this without seeing cost/impact
  ↓
"Fee: 2 KES" ← Surprised! Feels hidden.
```

**Redesigned State (Solution):**
```
[SEND MONEY]
  ↓
[Enter Amount + Select Recipient]
  ↓
[IMPACT PREVIEW SCREEN] ← New! Shows everything
  • You send: 1,000 KES
  • Fee: 2 KES (0.2%)
  • Recipient gets: 998 KES
  • Timeline: ~30 seconds
  • Confirm/Cancel (clear buttons)
  ↓
[CONFIRMATION] ← Only after understanding
  ↓
Success
```

### 🛠️ Implementation Tasks

**Component 1: SendFlowPreview.tsx**
```
Purpose: Form to capture amount & recipient
Inputs: 
  - amount: number
  - recipientAddress: string
  - recipientName: string
Outputs:
  - onNext(data) → shows ImpactPreview
  - onCancel()
Features:
  - Real-time validation
  - Address/QR scanning
  - Recent recipients dropdown
  - Input error states
```

**Component 2: ImpactPreview.tsx**
```
Purpose: Show transaction impact before confirmation
Displays:
  - Amount breakdown (send, fee, receive)
  - Timeline visualization
  - Gas cost explanation
  - Risk warnings (if any)
  - Network status indicator
Features:
  - Clear visual hierarchy
  - Expandable fee details
  - "What is this?" tooltips
  - Mobile-friendly layout
```

**Component 3: SendFlowReview.tsx**
```
Purpose: Final confirmation with transaction details
Displays:
  - Full transaction summary
  - Recipient information
  - Blockchain details
  - Approval buttons (Confirm/Cancel/EditDetails)
Features:
  - "Copy transaction" button
  - Share confirmation option
  - Save as template option
```

**Hook: useSendFlow.ts**
```typescript
interface SendFlowState {
  step: 'amount' | 'preview' | 'confirm' | 'sending' | 'success' | 'error';
  data: SendTransaction;
  error?: string;
  estimatedFee: number;
  estimatedTime: string;
}

const useSendFlow = () => {
  const [state, setState] = useState<SendFlowState>();
  
  const validateAmount = (amount: number) => { ... }
  const estimateFee = (amount: number) => { ... }
  const estimateTime = (network: string) => { ... }
  const submitTransaction = () => { ... }
  const goBack = () => { ... }
  
  return { state, validateAmount, estimateFee, submitTransaction, goBack };
}
```

### 📊 Data Flow

```
User Input
    ↓
validateAmount()
    ↓
estimateFee() + estimateTime()
    ↓
ImpactPreview (shows breakdown)
    ↓
User Confirms
    ↓
submitTransaction()
    ↓
Success with confirmation details
```

### ✨ Copy/Messaging

| Element | Message | Why |
|---------|---------|-----|
| Fee Label | "Network fee: 2 KES (0.2%)" | Transparency: shows % not just amount |
| Timeline | "~30 seconds (depends on network)" | Sets expectations |
| Recipient | "Yuki receives: 998 KES" | Emphasizes what matters to them |
| Confirm Button | "Send 1,000 KES" | Clear, specific action |
| Cancel Button | "Review again" | Positive framing vs "Cancel" |

### 🧪 Testing Checklist

- [ ] Form validates empty fields
- [ ] Amount must be > 0 and < balance
- [ ] Address validation works (alphanumeric, length)
- [ ] Fee calculation is accurate
- [ ] Timeline is realistic
- [ ] Mobile layout stacks correctly
- [ ] Cancel returns to amount entry
- [ ] Keyboard navigation works
- [ ] Copy buttons work on all browsers
- [ ] Accessibility: screen reader friendly

---

## Task 2: Proposals Interface with DAO Impact

### 📐 Design Specifications

**Current State (Problem):**
```
[PROPOSALS]
  ↓
List of 10 proposals
├─ "Proposal #47: Budget Increase" ← What's the impact?
├─ "Proposal #48: Fee Structure Change" ← Should I vote?
└─ "Proposal #49: Team Expansion" ← What happens if YES? NO?
  
User reads text for 5 minutes, still confused about impact.
```

**Redesigned State (Solution):**
```
[PROPOSALS]
  ↓
Smart filtering (Active, Voted, Archived)
  ↓
Proposal Card:
├─ Title: "Budget Increase"
├─ Visual: Impact breakdown
│  • If YES → DAO spends 50% more
│  • Quorum: 60% (currently 45%)
│  • Time left: 2 days
├─ Your vote: [I haven't voted]
├─ Action: [Vote YES] [Vote NO] [Learn More]
│
On click [Vote YES]:
  ↓
Impact Explainer:
  • What changes: "Monthly spending ↑ from 10M to 15M KES"
  • Who benefits: "Team headcount ↑ from 5 to 8"
  • Risk: "Burn rate higher, need more revenue"
  • Timeline: "Effective immediately after passage"
  ↓
  [Confirm Vote] [Go Back]
```

### 🛠️ Implementation Tasks

**Component 1: ProposalCard.tsx**
```
Purpose: Display individual proposal with voting option
Displays:
  - Proposal title & status
  - Quorum progress bar
  - Impact summary (3 key metrics)
  - Your vote status (voted/not voted)
  - Time remaining
  - Vote buttons
Features:
  - Color coding (active/passed/failed)
  - Mobile-optimized cards
  - Expandable details
```

**Component 2: ProposalImpactCard.tsx**
```
Purpose: Show specific impact of YES/NO vote
Displays:
  - Change breakdown (what's affected)
  - Beneficiaries/losers
  - Financial impact
  - Risk level indicator
  - Comparison (current vs. proposed)
Features:
  - Visual charts (simple bar charts)
  - Plain language explanations
  - "What if" scenarios
```

**Component 3: QuorumStatus.tsx**
```
Purpose: Show voting progress towards quorum
Displays:
  - Quorum required (%)
  - Current votes (%)
  - Time remaining
  - Voting breakdown (YES/NO)
  - Participation rate
Features:
  - Animated progress bar
  - Visual threshold indicator
  - "You can break the tie" messaging
```

**Component 4: ProposalContext.tsx**
```
Purpose: Show background & importance of proposal
Displays:
  - Who proposed it
  - When it was created
  - Discussion link/forum
  - Previous related proposals
Features:
  - Timeline of related decisions
  - Quorum history
```

**Hook: useProposalImpact.ts**
```typescript
interface ProposalImpact {
  proposal: Proposal;
  impact: {
    ifYes: Impact;
    ifNo: Impact;
  };
  quorum: QuorumData;
  userVote?: 'yes' | 'no' | null;
  userVotePower: number;
}

const useProposalImpact = (proposalId: string) => {
  const [impact, setImpact] = useState<ProposalImpact>();
  
  const getImpact = () => { ... } // Calls API
  const submitVote = (vote: 'yes' | 'no') => { ... }
  const getQuorumStatus = () => { ... }
  
  return { impact, submitVote, getQuorumStatus };
}
```

### 📊 Impact Data Model

```json
{
  "proposal": {
    "id": "prop_123",
    "title": "Budget Increase",
    "status": "active",
    "endDate": "2026-01-28T00:00:00Z"
  },
  "impact": {
    "ifYes": {
      "summary": "Monthly spending increases by 50%",
      "changes": [
        { "metric": "Monthly Budget", "current": "10M KES", "proposed": "15M KES", "change": "+50%" },
        { "metric": "Burn Rate", "current": "2M KES/mo", "proposed": "3M KES/mo", "change": "+50%" },
        { "metric": "Team Size", "current": "5", "proposed": "8", "change": "+3 hires" }
      ],
      "risks": ["Higher burn rate", "Need more revenue"],
      "benefits": ["Better team", "Faster development"]
    },
    "ifNo": {
      "summary": "Budget stays same, team grows slower",
      "changes": [...]
    }
  },
  "quorum": {
    "required": 60,
    "current": 45,
    "yes": 30,
    "no": 15,
    "abstain": 0
  }
}
```

### ✨ Copy/Messaging

| Element | Message | Why |
|---------|---------|-----|
| Quorum Status | "45 of 60 votes needed (75% there!)" | Positive framing |
| Impact Summary | "If YES: 50% budget increase" | Specific, not vague |
| Your Vote Prompt | "Your vote: +30 voting power" | Emphasizes influence |
| Time Remaining | "2 days left to vote" | Creates healthy urgency |
| Learning Path | "What changes? → Who's affected? → Your risk?" | Logical progression |

### 🧪 Testing Checklist

- [ ] Proposals load from API correctly
- [ ] Quorum calculation is accurate
- [ ] Impact data is correctly displayed
- [ ] Vote submission works
- [ ] Vote status updates immediately
- [ ] Mobile card layout works
- [ ] Charts render on all browsers
- [ ] Accessibility: all data in text form too
- [ ] Performance: <1s load time
- [ ] Filter buttons work (Active/Voted/Archived)

---

## Task 3: Security Settings with Explanations

### 📐 Design Specifications

**Current State (Problem):**
```
[SETTINGS] → [SECURITY]
  ↓
[ ] Enable 2FA
[ ] Enable Hardware Wallet
[ ] Require Transaction Approval

User thinks: "What? I don't understand why I need this."
```

**Redesigned State (Solution):**
```
[SECURITY OVERVIEW]

Your current risk level: 🟡 MEDIUM

┌─────────────────────────────────────┐
│ 🔒 2FA (Two-Factor Authentication) │
│ Status: ❌ NOT ENABLED              │
├─────────────────────────────────────┤
│ WHAT IT DOES:                       │
│ "Requires a code from your phone    │
│  to log in. Extra security."        │
│                                      │
│ WHY YOU NEED IT:                    │
│ "Without 2FA, someone with your     │
│  password can access your wallet."  │
│                                      │
│ WHAT IT COSTS:                      │
│ "Time: ~30 sec per login"           │
│ "Cost: Free"                        │
│                                      │
│ WHAT HAPPENS:                       │
│ "1. You sign in with password"      │
│ "2. Phone shows a code"             │
│ "3. You enter code → Access"        │
│                                      │
│ [ENABLE 2FA] [LEARN MORE]           │
└─────────────────────────────────────┘

Risk indicator shows:
❌ 2FA not enabled
⚠️ Transaction approval optional
✓ Hardware wallet not needed yet
    (but available if paranoid)
```

### 🛠️ Implementation Tasks

**Component 1: SecurityOverview.tsx**
```
Purpose: Show security status at a glance
Displays:
  - Overall risk level (low/medium/high)
  - Status of each security feature
  - Quick enable buttons
  - Risk explanation
Features:
  - Color-coded risk levels
  - Recommended actions highlighted
  - One-click enablement
```

**Component 2: SecurityFeatureCard.tsx**
```
Purpose: Explain one security feature deeply
Displays:
  - What it does (simple explanation)
  - Why you need it (threat-specific)
  - What it costs (time/money)
  - How it works (step-by-step)
  - Enable button
Features:
  - Expandable sections
  - Icons for each section
  - Examples/scenarios
```

**Component 3: TwoFactorSetup.tsx**
```
Purpose: Guided 2FA onboarding
Shows:
  - QR code to scan
  - Backup codes (to save)
  - Verification step
  - Final confirmation
Features:
  - Step-by-step progress
  - Copy/share buttons
  - Cancel option at each step
```

**Component 4: RiskExplainer.tsx**
```
Purpose: Explain what could go wrong and how feature protects
Displays:
  - Threat scenario (plain language)
  - How feature helps
  - Remaining risks
  - Best practices
Features:
  - Honest, not scary
  - "Is this paranoid?" FAQ
  - Links to external guides
```

**Hook: useSecuritySetup.ts**
```typescript
interface SecurityStatus {
  twoFactorEnabled: boolean;
  hardwareWalletEnabled: boolean;
  transactionApprovalRequired: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  lastPasswordChange?: Date;
  activeDevices: Device[];
}

const useSecuritySetup = () => {
  const [status, setStatus] = useState<SecurityStatus>();
  
  const enableTwoFactor = () => { ... }
  const disableTwoFactor = () => { ... }
  const generateBackupCodes = () => { ... }
  const getRiskLevel = () => { ... }
  const updatePassword = () => { ... }
  
  return { status, enableTwoFactor, generateBackupCodes, getRiskLevel };
}
```

### 📊 Security Data Model

```json
{
  "riskLevel": "medium",
  "features": [
    {
      "id": "2fa",
      "name": "Two-Factor Authentication",
      "enabled": false,
      "what": "Requires a code from your phone to log in",
      "why": "Without 2FA, anyone with your password can access your wallet",
      "cost": { "time": "30 seconds per login", "money": "Free" },
      "howItWorks": [
        "Sign in with password",
        "Receive code on phone",
        "Enter code to complete login"
      ],
      "recommended": true,
      "risk": { "without": "high", "with": "low" }
    },
    {
      "id": "hardware",
      "name": "Hardware Wallet",
      "enabled": false,
      "what": "Keep crypto in a physical device",
      "why": "Even if password stolen, crypto is safe",
      "cost": { "time": "1 minute per transaction", "money": "$50-100" },
      "recommended": false,
      "risk": { "without": "medium", "with": "very low" }
    }
  ]
}
```

### ✨ Copy/Messaging

| Element | Message | Why |
|---------|---------|-----|
| 2FA What | "Requires a code from your phone to log in" | Simple, not technical |
| 2FA Why | "Without 2FA, someone with your password can access your wallet" | Specific threat |
| Risk Framing | "Your risk level: Medium (improving to Low)" | Positive trajectory |
| Cost Label | "Time: 30 sec per login" | Honest about inconvenience |
| Enable Button | "Enable 2FA (takes 2 minutes)" | Sets expectations |

### 🧪 Testing Checklist

- [ ] Risk level calculation is correct
- [ ] 2FA setup works end-to-end
- [ ] Backup codes generate and display correctly
- [ ] QR code scans with authenticator apps
- [ ] Verification code validation works
- [ ] Mobile layout is readable
- [ ] Copy buttons work
- [ ] Accessibility: all explanations in text form
- [ ] Performance: <1s load time
- [ ] Security: sensitive codes not logged

---

## 🎨 Design System Requirements

### Color Palette

```css
/* Trust/Security Colors */
--color-trust-primary: #4CAF50;    /* Green - positive actions */
--color-trust-warning: #FF9800;    /* Orange - caution/fees */
--color-trust-danger: #F44336;     /* Red - high risk */
--color-trust-info: #2196F3;       /* Blue - informational */

/* Semantic States */
--state-success: #4CAF50;
--state-warning: #FF9800;
--state-error: #F44336;
--state-info: #2196F3;
--state-neutral: #999999;
```

### Typography

```css
/* Clear Hierarchy */
--font-heading-1: 28px, bold, line-height 1.3
--font-heading-2: 20px, bold, line-height 1.3
--font-body: 16px, regular, line-height 1.5
--font-label: 12px, medium, line-height 1.4
--font-caption: 12px, regular, line-height 1.4

/* Special */
--font-mono: Courier New, monospace  /* For addresses, amounts */
```

### Component Patterns

```
BUTTONS:
├─ Primary Action: "Send Money" (green, large, full-width on mobile)
├─ Secondary Action: "Review again" (outline, medium, full-width)
├─ Tertiary Action: "Learn more" (text, small)
└─ Destructive: "Delete" (red, outlined)

CARDS:
├─ Info Card: White bg, subtle border, icon + text
├─ Warning Card: Yellow bg, icon + text, no border
├─ Impact Card: Blue bg, full-width, shadow
└─ Transaction Card: Minimal, mono font for amounts

FORMS:
├─ Input: Large touch target (44px), clear label, placeholder
├─ Validation: Real-time feedback, inline errors
├─ Submission: Disabled until valid, loading state
└─ Confirmation: Checkbox, clear terms, final button
```

---

## 📅 Week 2 Implementation Schedule

### Monday-Tuesday (Days 1-2): Design & Planning

**Designers (10h total):**
- Hour 1-2: Finalize mockups for Send Flow, Proposals, Security
- Hour 3-4: Create Figma components and style guide
- Hour 5-6: Interactive prototypes for usability review
- Hour 7-8: Design system documentation
- Hour 9-10: Mobile responsive refinements

**Engineers (Kick-off meetings, 2h total):**
- Review mockups
- Understand data requirements
- Set up project structure
- Install dependencies

### Wednesday-Thursday (Days 3-4): Send Flow Implementation

**Engineer 1 (4h):**
- Hour 1: Create SendFlowPreview component & tests
- Hour 2: Create ImpactPreview component & tests
- Hour 3: Create SendFlowReview component & tests
- Hour 4: Hook up to API, integration testing

**Designers (review & iterate, 2h):**
- Review component implementations
- Feedback on copy & layout
- Test on mobile devices

### Friday (Day 5): Proposals Implementation

**Engineer 2 (5h):**
- Hour 1: Create ProposalCard component & tests
- Hour 2: Create ProposalImpactCard component & tests
- Hour 3: Create QuorumStatus component & tests
- Hour 4: Create ProposalContext component & tests
- Hour 5: Hook up to API, integration testing

**Engineers (5h total security work):**

### Weekend (Optional): Security Implementation

**Engineer 1 (5h):**
- Hour 1: Create SecurityOverview component & tests
- Hour 2: Create SecurityFeatureCard component & tests
- Hour 3: Create TwoFactorSetup component & tests
- Hour 4: Create RiskExplainer component & tests
- Hour 5: Hook up to API, integration testing

---

## 🔗 API Integration Points

### Send Money Flow APIs

```typescript
// Estimate transaction fee
GET /api/transactions/estimate-fee
  ?amount=1000&recipientAddress=0x...
  → { fee: 2, estimatedTime: "30s" }

// Get gas prices (for context)
GET /api/transactions/gas-prices
  → { standard: 2, fast: 5, instant: 10 }

// Submit transaction
POST /api/transactions/send
  { amount, recipient, fee, gasPrice }
  → { transactionId, confirmationTime }
```

### Proposals APIs

```typescript
// Get single proposal with impact
GET /api/dao/:daoId/proposals/:proposalId
  → { proposal, impact, quorum }

// Get quorum status in real-time
GET /api/dao/:daoId/proposals/:proposalId/quorum
  → { required, current, yes, no, time_remaining }

// Submit vote
POST /api/dao/:daoId/proposals/:proposalId/vote
  { vote: 'yes' | 'no', reason? }
  → { voteId, confirmationTime }
```

### Security APIs

```typescript
// Get security status
GET /api/user/security/status
  → { twoFactorEnabled, lastPasswordChange, devices[] }

// Enable 2FA - get QR code
POST /api/user/security/2fa/setup
  → { qrCode, backupCodes[], secret }

// Verify 2FA code
POST /api/user/security/2fa/verify
  { code }
  → { success, backupCodesRemaining }
```

---

## ✅ Deliverables Checklist

### Code Deliverables
- [ ] SendFlow components (3 components + tests)
- [ ] Send flow hooks + context
- [ ] ProposalVoting components (4 components + tests)
- [ ] Proposal hooks + context
- [ ] Security components (4 components + tests)
- [ ] Security hooks + context
- [ ] API integration layer
- [ ] Error handling & edge cases
- [ ] Accessibility audit
- [ ] Performance optimization

### Design Deliverables
- [ ] Figma mockups for all 3 features
- [ ] Component library in Figma
- [ ] Mobile responsive designs
- [ ] Copy & messaging documentation
- [ ] Accessibility checklist
- [ ] Design handoff documentation

### Documentation Deliverables
- [ ] Component API documentation
- [ ] Hook documentation
- [ ] Usage examples for each component
- [ ] Testing documentation
- [ ] Deployment guide

### Testing Deliverables
- [ ] Unit tests for all components
- [ ] Integration tests for flows
- [ ] E2E tests for critical paths
- [ ] Accessibility tests
- [ ] Performance tests

---

## 📊 Success Metrics (End of Week 2)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Components Built | 11 components | Code review |
| Code Coverage | > 80% | Jest coverage report |
| Performance | < 500ms load | Lighthouse audit |
| Accessibility | WCAG AA | axe-core testing |
| Mobile Responsive | 100% | Manual testing on devices |
| First Transaction Time | < 3 min | Stopwatch test |
| Documentation | Complete | Doc review |

---

## 🚀 Next Week Preview (Week 3)

Week 3 focuses on **PROGRESSIVE DISCLOSURE** - showing features only when users are ready.

- Feature gates (time-based, role-based)
- Onboarding paths for each persona
- Skill progression tracking
- Advanced features opt-in

---

## 📚 Reference Files

- Design Mockups: (Figma link)
- API Specifications: (Postman link)
- Database Schema: (Schema documentation)
- Component Library: (Storybook link)

---

**Status:** 🟢 Ready to Start  
**Priority:** HIGH  
**Effort:** 14 engineering hours + 10 design hours  
**Team:** 2 designers + 2 engineers  
**Next Sync:** Monday 9 AM kickoff

