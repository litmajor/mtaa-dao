# Week 2 Quick Testing Guide

**All 12 Components Ready for QA** ✅

---

## Component Quick Reference

### SendFlow (3 components + hook)
**File Path:** `frontend/components/SendFlow/`

| Component | Purpose | Props |
|-----------|---------|-------|
| **SendFlowPreview.tsx** | Amount & recipient form | `initialAmount`, `balance`, `onReview`, `onCancel` |
| **ImpactPreview.tsx** | Fee breakdown & timeline | `amount`, `fee`, `estimatedTime`, `onEdit`, `onConfirm`, `onCancel` |
| **SendFlowReview.tsx** | Final confirmation | `recipient`, `recipientName`, `amount`, `fee`, `total`, `estimatedTime`, `onConfirm`, `onEdit` |
| **useSendFlow.ts** | State machine hook | Returns: `state`, `estimateFee()`, `submitTransaction()`, `goToPreview()`, `goBack()` |

**Flow:** Preview → ImpactPreview → SendFlowReview → Success

---

### ProposalVoting (4 components + hook)
**File Path:** `frontend/components/ProposalVoting/`

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **ProposalCard.tsx** | Individual proposal display | Status badges, quorum bar, vote counts, voting buttons |
| **ProposalImpactCard.tsx** | YES/NO impact comparison | Tab switching, benefits/risks, metric changes |
| **QuorumStatus.tsx** | Voting progress | Progress bar, vote breakdown chart, participation % |
| **ProposalContext.tsx** | Proposal background | Proposer info, description, related proposals |
| **useProposalImpact.ts** | Impact data & voting | Returns: `impactData`, `submitVote()` |

**Key Data:** `Proposal` interface with id, title, status, dates, quorum data

---

### SecuritySettings (4 components + hook)
**File Path:** `frontend/components/SecuritySettings/`

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **SecurityOverview.tsx** | Security status dashboard | Risk level, feature list, account info |
| **SecurityFeatureCard.tsx** | Individual security feature | Enable/disable buttons, benefits, implementation info |
| **TwoFactorSetup.tsx** | Multi-step 2FA onboarding | 6 steps: method → download → QR → verify → backup → success |
| **RiskExplainer.tsx** | Security threats & practices | Expandable threat cards, best practices grid |
| **useSecuritySetup.ts** | Security flow management | Returns: `enableTwoFA()`, `changePassword()`, `revokeAllSessions()` |

**Flow:** Overview → FeatureCard (click) → TwoFactorSetup modal → Confirm

---

## Testing Checklist

### ✅ Functionality Tests
- [ ] SendFlow: Submit form → see impact → confirm → success
- [ ] ProposalVoting: View proposal → click vote → see impact → confirm
- [ ] SecuritySettings: View status → enable 2FA → complete flow
- [ ] All hooks load data without errors
- [ ] State changes update UI in real-time

### ✅ Responsive Tests (test at these widths)
- [ ] 480px (iPhone SE)
- [ ] 375px (Galaxy A)
- [ ] 768px (iPad)
- [ ] 1200px (Desktop)

**What to check:**
- Buttons stack vertically on mobile
- Text is readable (min 16px)
- Forms are single column on mobile
- Modals fit in viewport
- No horizontal scroll

### ✅ Accessibility Tests
- [ ] Keyboard navigation: Tab through all interactive elements
- [ ] Focus visible: Blue outline on focused buttons
- [ ] Escape key: Closes modals
- [ ] Enter key: Submits forms & buttons
- [ ] Screen reader (NVDA/JAWS): Announces all content
- [ ] Color contrast: All text ≥4.5:1 ratio

### ✅ Browser Tests
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Component Implementation Details

### SendFlow State Machine
```
'amount' → 'preview' → 'confirm' → 'sending' → 'success'
                                              ↘ 'error'
```

Mock API endpoints:
- GET `/api/transactions/estimate-fee?amount={amount}` → returns ~0.2%
- POST `/api/transactions/send` → 2s delay → success

### ProposalVoting Data Structure
```typescript
interface Proposal {
  id: string;
  title: string;
  status: 'active' | 'passed' | 'failed' | 'queued';
  dateCreated: string;
  dateEnds: string;
  quorumRequired: number;
  quorumCurrent: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
}
```

### SecuritySettings Features
- Two-Factor Authentication (highest priority to enable)
- Strong Password (enforced)
- Recovery Email (backup)
- Session Management (real-time)

---

## Mock Data for Testing

### SendFlow Mock
```
Balance: 10 ETH
Amount: 1 ETH
Fee: 0.002 ETH (0.2%)
Recipient: 0x1234567890abcdef1234567890abcdef12345678
Estimated Time: 15-30 seconds
```

### ProposalVoting Mock
```
Title: "Increase Treasury Allocation"
Status: active
Quorum Required: 50 addresses
Quorum Current: 32 addresses (64%)
Yes Votes: 28
No Votes: 4
Abstain Votes: 0
```

### SecuritySettings Mock
```
Account Age: 1 year, 3 months
Last Login: 2 hours ago
Last Password Change: 6 months ago
2FA Status: Not Enabled (HIGH RISK)
Recovery Email: user@example.com
```

---

## Common Issues & Fixes

### Issue: Modal won't close
**Fix:** Check that escape key listener is attached, or click X button

### Issue: Form validation not working
**Fix:** Verify prop `value` is controlled, handlers update state

### Issue: Mobile layout broken
**Fix:** Check CSS media query at 768px breakpoint, test at 375px

### Issue: Colors look wrong
**Fix:** Verify trust color palette is used: #4CAF50, #FF9800, #F44336, #2196F3

### Issue: Buttons not clickable
**Fix:** Check `disabled` prop, ensure button has `onClick` handler

---

## Performance Targets

**Load Time:** < 500ms (cold load)  
**Interaction:** < 300ms (button click to response)  
**CSS Size:** < 50KB for all 3 modules combined  
**Component Size:** < 20KB each

---

## What's NOT Included (Yet)

- ❌ Real API endpoints (using mocks)
- ❌ Database persistence (state resets on refresh)
- ❌ Real user authentication (using mock userId)
- ❌ Payment processing (SendFlow is demo only)
- ❌ Email/SMS 2FA (setup is demo only)
- ❌ Error analytics/logging

These will be integrated in Phase 5.4+

---

## File Organization

```
frontend/
├── components/
│   ├── SendFlow/
│   │   ├── SendFlowPreview.tsx
│   │   ├── ImpactPreview.tsx
│   │   ├── SendFlowReview.tsx
│   │   └── SendFlow.module.css
│   ├── ProposalVoting/
│   │   ├── ProposalCard.tsx
│   │   ├── ProposalImpactCard.tsx
│   │   ├── QuorumStatus.tsx
│   │   ├── ProposalContext.tsx
│   │   └── ProposalVoting.module.css
│   └── SecuritySettings/
│       ├── SecurityOverview.tsx
│       ├── SecurityFeatureCard.tsx
│       ├── TwoFactorSetup.tsx
│       ├── RiskExplainer.tsx
│       └── Security.module.css
└── hooks/
    ├── useSendFlow.ts
    ├── useProposalImpact.ts
    └── useSecuritySetup.ts
```

---

## How to Import Components

```typescript
// SendFlow
import { SendFlowPreview } from '@/components/SendFlow/SendFlowPreview';
import { ImpactPreview } from '@/components/SendFlow/ImpactPreview';
import { SendFlowReview } from '@/components/SendFlow/SendFlowReview';
import { useSendFlow } from '@/hooks/useSendFlow';

// ProposalVoting
import { ProposalCard } from '@/components/ProposalVoting/ProposalCard';
import { ProposalImpactCard } from '@/components/ProposalVoting/ProposalImpactCard';
import { useProposalImpact } from '@/hooks/useProposalImpact';

// SecuritySettings
import { SecurityOverview } from '@/components/SecuritySettings/SecurityOverview';
import { TwoFactorSetup } from '@/components/SecuritySettings/TwoFactorSetup';
import { useSecuritySetup } from '@/hooks/useSecuritySetup';
```

---

**Test Coverage Target:** 90%+  
**Ready for Staging:** ✅ YES  
**Ready for Production:** ⏳ After testing
