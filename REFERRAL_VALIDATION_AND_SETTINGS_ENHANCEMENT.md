# Phase 3 Enhancement: Referral Validation & Settings Evolution

## Overview

Two critical enhancements have been added to address referral reward accuracy and DAO customization:

1. **Referral Service with User Validation** - Prevents awarding rewards for non-existent users
2. **Advanced DAO Settings & Subscription Management** - Comprehensive customization pages

---

## 1. REFERRAL SERVICE - User Existence Validation

### Problem Solved
Previously, invitations were counted as referrals and rewards given immediately, even if the invited user never signed up or completed onboarding.

### Solution: Enhanced Referral Tracking

**File**: `server/api/referral_service.ts` (NEW - 350+ lines)

#### Key Changes

**Before (Issue)**:
```typescript
// OLD: Rewards awarded immediately on invitation
await awardReward(referrerId);  // ❌ User might not exist yet
```

**After (Fixed)**:
```typescript
// NEW: Rewards only after verified signup + acceptance
1. Invitation sent (NO REWARD)
2. User creates account (NO REWARD)
3. User accepts invitation (REWARD AWARDED) ✅
```

#### Three-Stage Validation Process

```
Stage 1: Invitation Created
├─ Check if user already exists
├─ Create invitation record
└─ Flag: userExistedAtInvite (boolean)

Stage 2: User Signs Up
├─ User completes registration
├─ User email/phone verified
└─ User account created in DB

Stage 3: Invitation Accepted
├─ User accepts invitation
├─ Membership created
└─ ONLY NOW: Award referral reward ✅
```

### API Endpoints (New)

```typescript
// Validate referral eligibility BEFORE sending
POST /api/referrals/validate
Body: { referrerId, email }
Response: {
  isEligible: boolean,
  reason?: string,
  userExists?: boolean
}

// Get referral analytics for user
GET /api/referrals/analytics
Response: {
  stats: {
    totalInvitationsSent,
    invitationsAccepted,
    conversionRate,
    totalRewardsAwarded,
    totalRewardAmount
  },
  recentInvitations: [],
  recentRewards: []
}

// Get status of specific invitation
GET /api/referrals/status/:invitationId
Response: {
  invitationSent: boolean,
  invitationAccepted: boolean,
  userSignedUp: boolean,
  rewardAwarded: boolean,
  rewardAmount?: number,
  statusTimestamp: Date
}
```

### Updated Functions

#### createInvitationWithTracking()
```typescript
// NEW: Tracks referral intent but no rewards yet
const { invitation, userAlreadyExists } = await createInvitationWithTracking(
  daoId,
  referrerId,
  email,
  phone,
  role
);

// Returns:
{
  invitation: {
    id,
    referrerId,      // NEW: Track who referred
    invitationSentAt, // NEW: Timestamp
    userExistedAtInvite, // NEW: Flag for existing user
    status: 'pending'
  },
  userAlreadyExists: boolean
}
```

#### acceptInvitationWithReferral()
```typescript
// ENHANCED: Only awards reward after acceptance
const membership = await acceptInvitationWithReferral(
  inviteToken,
  userId
);

// This function:
// 1. Verifies user exists and completed signup
// 2. Updates invitation status
// 3. Creates membership
// 4. CALLS awardReferralReward() ← Rewards now!
```

#### getUserReferralAnalytics()
```typescript
// NEW: Detailed referral stats
const analytics = await getUserReferralAnalytics(userId);

// Returns:
{
  stats: {
    totalInvitationsSent: 10,
    invitationsAccepted: 7,      // Only counted if accepted
    invitationsPending: 2,
    invitationsExpired: 1,
    totalRewardsAwarded: 7,      // Matches accepted count
    totalRewardAmount: 350,      // $50 × 7
    conversionRate: 70%,         // 7/10
    rewardsByType: {
      invitationAccepted: 7,
      firstContribution: 0,
      milestone: 0
    }
  }
}
```

### Reward Eligibility Check

Before sending invitation, validate:

```typescript
const eligibility = await validateReferralEligibility(referrerId, email);

// Returns:
{
  isEligible: true,  // Only if:
  reason: undefined  // - User doesn't exist yet
               // - Referrer is valid
               // - No pending invite already sent
}
```

### Database Schema Updates

Add to `daoInvitations` table:
```sql
-- Track referral information
referrerId VARCHAR -- Who sent this invite
invitationSentAt TIMESTAMP -- When was it sent
userExistedAtInvite BOOLEAN -- Was user already in system?

-- Status tracking
invitationSentAt TIMESTAMP
acceptedAt TIMESTAMP  -- Only set when accepted
rejectedAt TIMESTAMP  -- Only set if rejected
expiredAt TIMESTAMP   -- If it expires
```

### Implementation in InvitationManagement Component

```tsx
// When sending invitation:
const handleCreateInvitation = async () => {
  // 1. Validate first
  const { isEligible, reason, userExists } = 
    await fetch('/api/referrals/validate', {
      method: 'POST',
      body: { referrerId: currentUser.id, email }
    });

  if (!isEligible) {
    if (userExists) {
      showMessage('User already exists - no reward available');
    } else {
      showMessage(reason);
    }
    return;
  }

  // 2. Send invitation (no reward yet)
  await createInvitation({...});
};
```

---

## 2. DAO SETTINGS EVOLUTION

### Two New Pages

#### A. Advanced DAO Settings Page
**File**: `client/src/pages/dao/[id]/settings.tsx` (380+ lines)

Comprehensive settings management with 6 tabs:

##### Tab 1: Rotation Configuration
- Enable/disable rotation
- Selection method: Sequential, Lottery, Proportional
- Cycle duration & max cycles
- Auto-treasury depletion on rotation

```tsx
Settings controlled:
├─ rotationEnabled
├─ rotationMethod
├─ rotationCycleDays
└─ rotationMaxCycles
```

##### Tab 2: Referral & Invitation Settings
- Enable/disable referral rewards
- Reward amount per successful signup
- Invitation expiry period (days)
- Auto-accept peer invites toggle

```tsx
⚠️ Reward Flow Displayed:
1. Invitation sent (no reward)
2. User creates account (no reward)
3. User accepts invite → REWARD AWARDED ✅
```

##### Tab 3: Governance & Voting
- Minimum members for governance
- Voting quorum percentage
- Proposal cool-down period
- Max pending proposals

```tsx
Governance controls:
├─ minMembersForGovernance
├─ votingQuorumPercentage
├─ proposalCooldownHours
└─ maxPendingProposals
```

##### Tab 4: Financial Controls
- Treasury minimum balance
- Transaction audit threshold
- Auto-audit for large transactions
- Emergency pause on anomalies

```tsx
Financial safety:
├─ treasuryMinimumBalance
├─ transactionAuditThreshold
├─ autoAuditEnabled
└─ emergencyPauseEnabled
```

##### Tab 5: Capacity Limits
- Max members (tied to subscription)
- Max daily transactions
- Max monthly volume
- Shows current usage

```tsx
Limits by subscription:
Free:       10 members, $5K/month
Pro:        100 members, $100K/month
Enterprise: 10K members, $10M/month
```

##### Tab 6: Notification Preferences
- Email notifications toggle
- SMS notifications toggle
- Rotation event alerts
- Invitation reminders

```tsx
Alert channels:
├─ Email
├─ SMS
└─ Notification types:
   ├─ Rotation events
   └─ Invitation reminders
```

### Usage Overview Widget
At top of settings page shows real-time usage:

```
┌─ Current Members: 45/100 ────────────┐
├─ Monthly Volume: $15,432 limit $100K │
├─ Daily Transactions: 23/500           │
└─ Tier: Pro                            │
```

#### B. Subscription Management Page
**File**: `client/src/pages/dao/[id]/subscription.tsx` (420+ lines)

Comprehensive subscription management with 3 tabs:

##### Tab 1: Plans & Pricing
- Visual plan cards
- Price comparison
- Current plan highlighted
- One-click upgrade/downgrade

```
FREE          PRO              ENTERPRISE
$0/month      $49/month        $199/month
─────────────────────────────────────────
10 members    100 members      10K members
50 txns/day   500 txns/day     5K txns/day
$5K/month     $100K/month      $10M/month
```

##### Tab 2: Feature Comparison
- Rotation: All tiers ✓
- Custom Rules: Pro+ only
- Analytics: Pro+ only
- API Access: Pro+ only
- Priority Support: Enterprise only

```
Feature              Free  Pro  Enterprise
─────────────────────────────────────────
Rotation Logic        ✓     ✓      ✓
Custom Rules          ✗     ✓      ✓
Advanced Analytics    ✗     ✓      ✓
API Access           ✗     ✓      ✓
Priority Support     ✗     ✗      ✓
```

##### Tab 3: Billing History
- Invoice list with dates
- Amount and status
- PDF download links
- Filter by date range

```
Invoice from Jan 15    $49.00    Paid ✓
Invoice from Dec 15    $49.00    Paid ✓
Invoice from Nov 15    $49.00    Paid ✓
```

### Current Subscription Status Card
Shows:
- Active plan with badge
- Renewal date
- Auto-renew status
- Payment method
- Cancel button (if active)

---

## 3. INTEGRATION ARCHITECTURE

### How Customizations Flow

```
Settings Page
    ↓
User adjusts rotation method, member limits, etc.
    ↓
Save to DAO settings (API call)
    ↓
Subscription validation:
  └─ Pro: Custom rules available
  └─ Free: Limited to rotation only
    ↓
Rules Engine applies limits
    ↓
Referral Service respects settings:
  └─ Reward amount from settings
  └─ Invitation expiry from settings
    ↓
Dashboard displays based on tier
```

### Settings Hierarchy

```
1. DAO-level Settings (customizable by admins)
   ├─ Rotation config
   ├─ Referral amounts
   ├─ Governance rules
   └─ Financial controls

2. Subscription-based Features (locked by tier)
   ├─ Free: Rotation only
   ├─ Pro: + Custom rules + Analytics
   └─ Enterprise: + API + Priority support

3. User Preferences (per member)
   ├─ Notification settings
   ├─ Privacy settings
   └─ Email/SMS toggles
```

---

## 4. UPDATED INVITATION FLOW

### Complete Referral Journey

```
STEP 1: Admin sends invitation
├─ Call: validateReferralEligibility(referrerId, email)
├─ Check: User doesn't exist yet
├─ Check: No pending invite
└─ Result: isEligible = true

STEP 2: Create invitation
├─ Call: createInvitationWithTracking(daoId, referrerId, email, role)
├─ Set: inviteToken, expiresAt, referrerId
├─ Set: userExistedAtInvite = false
├─ Status: 'pending'
└─ ⚠️ NO REWARD YET

STEP 3: User receives email
├─ Email contains: /invite/[token] link
├─ User can click "Accept Invite"
└─ Takes to: InviteAcceptancePage

STEP 4: User signs up (NEW if not existing)
├─ Visit: /auth/signup
├─ Create account with email
├─ Email verified
├─ User ID created in DB
└─ ⚠️ STILL NO REWARD YET

STEP 5: User accepts invitation
├─ Visit: /invite/[token]
├─ See DAO preview
├─ Click "Accept Invite"
├─ Call: acceptInvitationWithReferral(token, userId)
├─ Update: invitation.status = 'accepted'
├─ Create: daoMembership record
└─ ✅ CALL awardReferralReward() NOW!

STEP 6: Reward credited
├─ Get: referrer ID from invitation
├─ Verify: both users exist
├─ Calculate: reward amount ($50)
├─ Insert: referralRewards record
├─ Notify: referrer via email
└─ ✅ REWARD COMPLETE!

Analytics updated:
├─ Referrer: totalRewardsAwarded ++
├─ Referrer: totalRewardAmount += $50
├─ DAO: totalReferrals ++
└─ Dashboard: stats refresh
```

---

## 5. API ENDPOINTS SUMMARY

### New Referral Endpoints
```
POST   /api/referrals/validate
GET    /api/referrals/analytics
GET    /api/referrals/status/:invitationId
```

### Enhanced Settings Endpoints
```
GET    /api/dao/:daoId/settings
PUT    /api/dao/:daoId/settings
GET    /api/dao/:daoId/subscription
POST   /api/dao/:daoId/subscription/upgrade
POST   /api/dao/:daoId/subscription/cancel
GET    /api/dao/:daoId/subscription/billing-history
```

---

## 6. TESTING CHECKLIST

### Referral System Tests

- [ ] Validate that existing users cannot generate referral rewards
- [ ] Validate that unfinished signups don't trigger rewards
- [ ] Test that rewards only awarded on acceptance
- [ ] Test referral analytics show correct conversion rates
- [ ] Test invitation expiry doesn't count as reward
- [ ] Test rejected invitations don't award

### Settings Page Tests

- [ ] Admin can save all settings types
- [ ] Settings persist after page reload
- [ ] Usage metrics update correctly
- [ ] Subscription limits enforced
- [ ] Non-admin cannot access settings
- [ ] Validation prevents invalid values

### Subscription Tests

- [ ] Plans display correctly
- [ ] Upgrade flow works
- [ ] Feature limits enforced
- [ ] Invoice history shows
- [ ] Auto-renew toggle works
- [ ] Cancel subscription works

---

## 7. DATABASE UPDATES REQUIRED

### Add to daoInvitations table:
```sql
ALTER TABLE daoInvitations ADD COLUMN referrerId VARCHAR;
ALTER TABLE daoInvitations ADD COLUMN invitationSentAt TIMESTAMP;
ALTER TABLE daoInvitations ADD COLUMN userExistedAtInvite BOOLEAN DEFAULT FALSE;
```

### Create indexes:
```sql
CREATE INDEX idx_referrals_referrer ON daoInvitations(referrerId) WHERE status = 'accepted';
CREATE INDEX idx_referral_rewards_referrer ON referralRewards(referrerId);
```

---

## 8. MIGRATION PATH

### For Existing DAOs:

1. **Backward Compatibility**: Old invitations treated as if user already existed
2. **Existing Rewards**: Grandfathered in, not recalculated
3. **New Invitations**: Subject to new validation rules

### Settings Migration:

```
Existing DAO
    ↓
Auto-create default settings
    ↓
Match current behavior
    ↓
Admin can customize
```

---

## 9. SECURITY CONSIDERATIONS

✅ **Implemented:**
- Only reward after verified user signup
- Prevent double-rewarding same user
- Referrer verification before reward
- Audit log for all reward issuance
- Rate limiting on invite sending
- Email verification required

⚠️ **Recommendations:**
1. Implement maximum rewards per user per month
2. Add fraud detection for rapid signup attempts
3. Manual review queue for high-value rewards
4. Implement referral cooldown periods

---

## 10. ROLLOUT PLAN

### Phase 1: Backend Implementation
- [x] Referral service with validation
- [x] Settings endpoints
- [x] Subscription management endpoints

### Phase 2: Frontend Implementation
- [x] Settings page (6 tabs)
- [x] Subscription page (3 tabs)
- [x] Referral analytics dashboard

### Phase 3: Testing & Deployment
- [ ] Complete testing checklist
- [ ] Database migrations
- [ ] Gradual rollout to users
- [ ] Monitor referral accuracy
- [ ] Gather user feedback

### Phase 4: Optimization
- [ ] Performance tuning
- [ ] Advanced analytics
- [ ] Custom reward rules per DAO
- [ ] Fraud detection system

---

**Status**: Ready for Implementation & Testing

