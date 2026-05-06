# Phase 1B Implementation Plan - OKEDI Refactor

## 📋 Phase 1B Objectives

Enhance the OKEDI Dashboard (Personal Wallet + Governance) with:
1. ✅ Send with 3 context options (DAO/User/Address)
2. ✅ Receive & Transfer functionality
3. ✅ Payment Links feature
4. ✅ Referral system integration
5. ✅ Enhanced governance features

---

## 🏗️ Current OKEDI Dashboard Status

### Already Implemented ✅
- **Balance Header**: Personal balance, trust score, governance score, member stats
- **Quick Actions**: 11 action buttons (Send, Receive, Escrow, Vote, Links, Settings, Withdraw, Analytics, Split, Refer, Chat)
- **KYC Banner**: KYC status, transfer limits, progress indicator
- **Analytics Panel**: Transaction volume, average tx, 7-day growth, sparkline chart
- **My DAOs**: List of user's DAOs with vote/send/manage buttons
- **Governance Stats**: Votes cast, governance power, DAO count, influence rank
- **Active Proposals**: Governance proposals with vote progress
- **Active Escrows**: Escrow transactions with status
- **Recent Transactions**: Transaction history with type/amount/status
- **Referral Stats**: Referral earnings and copy-to-clipboard link
- **DAO Chat**: Recent chat messages from DAO communities
- **Tip of the Day**: Daily tips for user guidance

### Quick Action Buttons (Already in UI) ✅
```
Send      Receive   Escrow    Vote      Links
Settings  Withdraw  Analytics Split     Refer
Chat      + More
```

---

## 🎯 Phase 1B Enhancements

### 1. Send with 3 Context Options

**Current State**: Send button exists but needs context switching

**Enhancement**:
```typescript
// Add SendModal with context selector
interface SendContext {
  type: 'dao' | 'user' | 'address';
  label: string;
  description: string;
}

// Contexts:
// 1. DAO Send - Send to DAO treasury/members
// 2. User Send - Send to known user by username
// 3. Address Send - Send to wallet address
```

**Implementation**:
- Create `SendModal.tsx` with context tabs
- Each context has different form fields
- Validate based on context type
- Show relevant history/suggestions per context

**Files to Create**:
- `components/modals/SendModal.tsx` (main send modal)
- `components/modals/SendContextSelector.tsx` (context tabs)
- `components/modals/SendDAOForm.tsx` (DAO send form)
- `components/modals/SendUserForm.tsx` (user send form)
- `components/modals/SendAddressForm.tsx` (address send form)

---

### 2. Receive Functionality

**Current State**: Receive button in quick actions

**Enhancement**:
```typescript
// Receive modal should show:
// - User's wallet address (with copy button)
// - QR code for easy mobile scanning
// - Receive link (shareable)
// - Request amount option
// - Request history
```

**Implementation**:
- Create `ReceiveModal.tsx`
- Display wallet address with QR code
- Generate shareable receive links
- Track receive requests
- Show receive history

**Files to Create**:
- `components/modals/ReceiveModal.tsx`
- `components/sections/ReceiveSection.tsx`

---

### 3. Payment Links Feature

**Current State**: Link button exists

**Enhancement**:
```typescript
// Payment Links should allow:
// - Create payment request link
// - Set amount or open-ended
// - Set expiration date
// - Track link performance
// - View collected payments
```

**Implementation**:
- Create `PaymentLinksPage.tsx`
- Display list of payment links
- Create new payment link form
- Show link statistics (views, clicks, conversions)
- Share/copy payment links

**Files to Create**:
- `pages/payment-links/index.tsx`
- `components/payment-links/CreatePaymentLink.tsx`
- `components/payment-links/PaymentLinksList.tsx`
- `components/payment-links/PaymentLinkStats.tsx`

---

### 4. Transfer Functionality

**Current State**: Basic send/receive

**Enhancement**:
```typescript
// Transfer should support:
// - Between user's own wallets
// - Between profiles (OKEDI ↔ YUKI ↔ AMARA)
// - Between linked accounts
// - Batch transfers
// - Scheduled transfers
```

**Implementation**:
- Create `TransferModal.tsx`
- Support multi-wallet transfers
- Profile-to-profile transfers
- Batch transfer interface

**Files to Create**:
- `components/modals/TransferModal.tsx`
- `components/modals/BatchTransferForm.tsx`

---

### 5. Referral System Enhancement

**Current State**: Referral stats section exists

**Enhancement**:
```typescript
// Referral should show:
// - Referral link with easy copy
// - Referral stats (clicks, signups, earnings)
// - Tier benefits
// - Referral history
// - Payout status
```

**Implementation**:
- Enhance referral display
- Show tier progression
- Display earnings breakdown
- Create referral leaderboard

**Files to Create**:
- `components/dashboard/ReferralStats.tsx` (enhanced)
- `pages/referrals/index.tsx` (new)

---

### 6. Enhanced Governance Features

**Current State**: Governance stats and proposals exist

**Enhancement**:
```typescript
// Governance should support:
// - Create proposals
// - Vote with delegated power
// - View governance power sources
// - Track voting history
// - Governance rewards
```

**Implementation**:
- Add create proposal button
- Show governance power breakdown
- Display voting history
- Calculate governance rewards
- Integration with governance smart contracts

**Files to Create**:
- `components/governance/ProposalCreator.tsx`
- `components/governance/GovernancePowerBreakdown.tsx`
- `components/governance/VotingHistory.tsx`

---

## 📊 Implementation Strategy

### Priority Order (Recommended)
1. **HIGH**: Send with 3 contexts (most used feature)
2. **HIGH**: Receive functionality (fundamental)
3. **MEDIUM**: Transfer feature (complements Send/Receive)
4. **MEDIUM**: Payment Links (enables new use cases)
5. **LOW**: Referral enhancement (nice to have)
6. **LOW**: Governance enhancement (advanced feature)

### Time Estimate per Feature
- Send with contexts: 2-3 hours
- Receive: 1-2 hours
- Transfer: 1.5-2 hours
- Payment Links: 2-3 hours
- Referral: 1 hour
- Governance: 1.5-2 hours
- **Total Phase 1B**: 8-13 hours

### Testing Approach
```
Unit Tests:
- Send validation per context
- Address/user/DAO lookup
- Amount formatting
- Fee calculations

Integration Tests:
- Send flow end-to-end
- Receive link generation
- Payment link tracking
- Profile transfer

E2E Tests:
- Full user journey: Send → Receive → Payment Link
- Error scenarios
- Mobile responsiveness
```

---

## 🔧 Technical Considerations

### API Integration Points
```
POST   /api/send          - Send transaction
POST   /api/receive       - Generate receive link
GET    /api/receive/:id   - Track receive link
POST   /api/transfer      - Profile transfer
POST   /api/payment-links - Create payment link
GET    /api/payment-links - List user's links
GET    /api/referrals     - Referral stats
POST   /api/proposals     - Create proposal
POST   /api/votes         - Cast vote
```

### State Management
```
PersonaContext:
├── activeProfile (okedi/yuki/amara)
├── preferences (for Send context selection, etc.)
└── profileData (balance, transactions, etc.)

Modal State:
├── showSendModal
├── sendContext (dao/user/address)
├── selectedDAO
├── selectedUser
└── recipientAddress
```

### Storage
```
localStorage:
- User's frequent recipients (last 10)
- Payment link templates
- Governance preferences
- Send context preference

Backend:
- Transaction history
- Payment links
- Referral data
- Governance records
```

---

## ✨ UX Patterns

### Send Flow
```
User clicks "Send"
  ↓
SendModal opens
  ↓
Context Selector (3 tabs: DAO | User | Address)
  ↓
Appropriate form renders
  ↓
Amount + Memo
  ↓
Review & Confirm
  ↓
2FA/PIN verification
  ↓
Transaction submitted
  ↓
Toast notification + redirect
```

### Receive Flow
```
User clicks "Receive"
  ↓
ReceiveModal opens
  ↓
Show wallet address + QR code
  ↓
Options: Request amount / Generate link / View history
  ↓
Copy address or share QR
```

### Payment Link Flow
```
User clicks "Payment Links"
  ↓
PaymentLinksPage shows existing links
  ↓
Click "Create Link"
  ↓
Set amount (optional), description, expiration
  ↓
Link generated + stats dashboard
  ↓
Share via copy/QR/social
```

---

## 📝 Data Structures

### Send Transaction
```typescript
interface SendTransaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  context: 'dao' | 'user' | 'address';
  memo?: string;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  fee: number;
  timestamp: Date;
}
```

### Payment Link
```typescript
interface PaymentLink {
  id: string;
  createdBy: string;
  amount?: number; // Optional = open-ended
  description?: string;
  expiresAt?: Date;
  link: string;
  qrCode?: string;
  stats: {
    views: number;
    clicks: number;
    conversions: number;
    amountCollected: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Referral Record
```typescript
interface ReferralRecord {
  id: string;
  referrer: string;
  referee: string;
  status: 'pending' | 'completed' | 'paid';
  reward: number;
  tier: number;
  createdAt: Date;
  paidAt?: Date;
}
```

---

## 🎨 UI Components

### New Modal Components
```
SendModal.tsx
├── SendContextSelector (tabs)
├── SendDAOForm
├── SendUserForm
├── SendAddressForm
└── SendReview

ReceiveModal.tsx
├── WalletAddress display
├── QR Code
├── ReceiveLink generator
└── ReceiveHistory

TransferModal.tsx
├── SourceWallet selector
├── DestinationWallet selector
├── Amount input
└── Confirmation

PaymentLinkModal.tsx
├── Amount input (optional)
├── Description
├── Expiration
└── Link preview
```

### New Page Components
```
pages/payment-links/
├── PaymentLinksPage (main)
├── CreatePaymentLink (form)
├── PaymentLinkStats (analytics)
└── PaymentLinksList (existing links)

pages/referrals/
├── ReferralsPage (main)
├── ReferralStats (analytics)
├── ReferralLeaderboard
└── PayoutHistory
```

---

## 🔐 Security Considerations

### Send Transaction
- ✅ 2FA/PIN verification for amounts > threshold
- ✅ Address validation (no send to 0x0)
- ✅ Recipient verification (confirm before send)
- ✅ Rate limiting (prevent spam)
- ✅ KYC limits enforcement

### Payment Links
- ✅ Link expiration
- ✅ One-time payment links option
- ✅ Rate limiting per link
- ✅ CSRF token validation

### Referrals
- ✅ Prevent self-referral
- ✅ Track referral chain (prevent abuse)
- ✅ Verify account completion before payout
- ✅ Blacklist fraud accounts

---

## 📈 Success Metrics

### For Send Feature
- Send success rate > 99%
- Average send time < 2 seconds
- User adoption > 80% within 30 days
- Error rate < 1%

### For Payment Links
- Link creation < 30 seconds
- Share rate > 40%
- Conversion rate > 15%
- Link usage > 50% of created links

### For Referrals
- Referral program completion > 20%
- Tier progression engagement > 50%
- Average earnings/referral > $10

---

## 🚀 Next Steps

1. **Start with Send Modal** (most critical feature)
2. Implement Receive functionality (quick win)
3. Add Transfer support
4. Build Payment Links
5. Enhance Referrals
6. Add Governance features

**Recommended Sprint**: 2-3 sprints @ 2-3 days each

---

## 📚 Reference Files

**Existing Components to Leverage**:
- [OkediDashboard.tsx](client/src/components/dashboard/OkediDashboard.tsx) - Main dashboard
- [SendToDAOMemberModal.tsx](client/src/components/modals/SendToDAOMemberModal.tsx) - Existing send modal (to extend)
- [PersonalizedDashboard.tsx](client/src/components/dashboard/PersonalizedDashboard.tsx) - Profile router
- [persona-context.tsx](client/src/contexts/persona-context.tsx) - Profile state

**Related APIs**:
- [dashboardApi.ts](client/src/api/dashboardApi.ts) - Dashboard API calls
- [yukiApi.ts](client/src/api/yukiApi.ts) - Trading API (for reference patterns)

---

**Phase 1B Status**: Ready to implement
**Recommended Start**: Begin with Send Modal implementation
**Estimated Duration**: 8-13 hours
