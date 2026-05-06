# Week 3 Task 6: End-to-End Testing - Complete Escrow Flows

**Status**: Ready to Start  
**Time Estimate**: 90-120 minutes  
**Difficulty**: High  
**Prerequisites**: ✅ Tasks 1-5 must be complete

---

## Overview

This task tests the complete escrow flow end-to-end with all Phase 2 features:

1. **Escrow Creation** - With notifications
2. **Acceptance** - With referral tracking
3. **Approval** - With notifications
4. **Release/Dispute** - With notifications
5. **History & Analytics** - Updated correctly

Tests real user workflows, not isolated features.

---

## 📋 What You'll Do

- [ ] Create test user accounts
- [ ] Test complete escrow flows
- [ ] Verify all notifications sent
- [ ] Confirm history updated
- [ ] Check analytics calculations
- [ ] Test multiple concurrent escrows
- [ ] Document any issues

---

## 🎯 Test Scenarios

### Scenario 1: Happy Path - Complete Escrow

**Goal**: Create escrow → Accept → Approve → Release with all notifications

**Setup**:
```bash
# Create two test users
# User 1: buyer@test.com (buyer)
# User 2: seller@test.com (seller)
```

**Steps**:

**1.1 Create Escrow (Buyer)**
```typescript
// Navigate to create escrow page
// Fill form:
POST /api/escrows
{
  "type": "buyer_protection",
  "amount": 100,
  "currency": "USD",
  "description": "Test escrow - happy path",
  "sellerAddress": "seller@test.com",
  "buyerAddress": "buyer@test.com"
}
```

**Expected**:
- ✅ Escrow created with status "pending"
- ✅ Email sent to seller (escrow created notification)
- ✅ SMS sent to seller (if enabled)
- ✅ History shows "Pending" status
- ✅ Analytics shows +1 to total

**Verify**:
```typescript
// Check database:
SELECT * FROM escrows WHERE id = '[escrow_id]';
// Should show: status='pending', buyer_address='buyer@test.com', seller_address='seller@test.com'

// Check notifications:
SELECT * FROM notifications_log WHERE escrow_id = '[escrow_id]';
// Should show: 2 records (1 email, 1 SMS)

// Check history:
// Navigate to /wallet/history
// Should show new escrow in list with Pending status
```

**1.2 Accept Escrow (Seller)**
```typescript
// Log in as seller
// Navigate to pending escrows
// Click "Accept" on test escrow

PUT /api/escrows/[escrow_id]/accept
{
  "seller_address": "seller@test.com",
  "seller_confirms": true
}
```

**Expected**:
- ✅ Status changes to "accepted"
- ✅ Email sent to buyer (escrow accepted notification)
- ✅ SMS sent to buyer (if enabled)
- ✅ Referral tracked (if referrer parameter present)
- ✅ History updated to "Accepted"

**Verify**:
```typescript
// Check database:
SELECT * FROM escrows WHERE id = '[escrow_id]';
// Should show: status='accepted'

// Check notifications:
SELECT COUNT(*) FROM notifications_log 
WHERE escrow_id = '[escrow_id]';
// Should show: 4+ records (new emails/SMS)

// Check referral:
SELECT * FROM escrow_referrals 
WHERE escrow_id = '[escrow_id]';
// Should have record if referrer present
```

**1.3 Approve Funds (Buyer)**
```typescript
// Log in as buyer
// Navigate to accepted escrows
// Click "Approve Release" to approve funds

PUT /api/escrows/[escrow_id]/approve
{
  "buyer_address": "buyer@test.com",
  "buyer_approves": true
}
```

**Expected**:
- ✅ Status changes to "approved"
- ✅ Email sent to seller (approved notification)
- ✅ SMS sent to seller (if enabled)
- ✅ History updated to "Approved"
- ✅ Analytics shows escrow progressing

**Verify**:
```typescript
// Check status:
SELECT status FROM escrows WHERE id = '[escrow_id]';
// Should show: 'approved'

// Check notifications sent:
SELECT COUNT(*) FROM notifications_log 
WHERE escrow_id = '[escrow_id]' AND notification_type = 'approved';
// Should have 1+ records
```

**1.4 Release Funds (Admin or Seller)**
```typescript
// Log in as admin or seller
// Navigate to approved escrows
// Click "Release Funds"

PUT /api/escrows/[escrow_id]/release
{
  "released_by": "admin@test.com",
  "release_notes": "E2E test - funds released successfully"
}
```

**Expected**:
- ✅ Status changes to "completed"
- ✅ Email sent to both parties (completed notification)
- ✅ SMS sent (if enabled)
- ✅ History shows "Completed" with timestamp
- ✅ Analytics shows +1 to completed count
- ✅ Completion rate updates

**Verify**:
```typescript
// Check final status:
SELECT status FROM escrows WHERE id = '[escrow_id]';
// Should show: 'completed'

// Check timeline in history:
// Navigate to /wallet/history
// Should show complete flow: Pending → Accepted → Approved → Completed

// Check analytics:
// Navigate to /wallet/analytics
// Completion card should show updated percentage
// Timeline chart should show completion date
```

---

### Scenario 2: Dispute Flow

**Goal**: Create escrow → Dispute → Verify notification and history

**Setup**:
```bash
# Use same test users from Scenario 1
```

**Steps**:

**2.1 Create Escrow for Dispute**
```typescript
POST /api/escrows
{
  "type": "seller_protection",
  "amount": 250,
  "currency": "USD",
  "description": "Test dispute flow",
  "sellerAddress": "seller@test.com",
  "buyerAddress": "buyer@test.com"
}
```

**2.2 Accept Escrow**
```typescript
// Log in as seller
PUT /api/escrows/[escrow_id2]/accept
{
  "seller_address": "seller@test.com"
}
```

**2.3 Initiate Dispute (Buyer)**
```typescript
// Log in as buyer
PUT /api/escrows/[escrow_id2]/dispute
{
  "disputer": "buyer@test.com",
  "reason": "E2E Test - product not received",
  "evidence": "Test evidence for dispute"
}
```

**Expected**:
- ✅ Status changes to "disputed"
- ✅ Dispute notification sent to seller
- ✅ Admin notification sent to resolver
- ✅ History shows "Disputed" status
- ✅ Analytics shows in disputed count

**Verify**:
```typescript
// Check dispute recorded:
SELECT * FROM escrows WHERE id = '[escrow_id2]';
// Should show: status='disputed'

// Check notifications:
SELECT * FROM notifications_log 
WHERE escrow_id = '[escrow_id2]' AND notification_type = 'disputed';
// Should have 2+ records (seller + admin)
```

---

### Scenario 3: Referral Conversion

**Goal**: Create escrow with referrer, verify token award and conversion tracked

**Setup**:
```bash
# Have referrer ID ready from referral service
REFERRER_ID = "referrer_12345"
```

**Steps**:

**3.1 Create Escrow with Referrer**
```typescript
// Create escrow with referrer in URL:
// /escrow/create?referrer=[REFERRER_ID]

POST /api/escrows
{
  "type": "buyer_protection",
  "amount": 500,
  "currency": "USD",
  "description": "Test referral conversion",
  "referrer_id": "referrer_12345"
}
```

**3.2 Accept to Complete Conversion**
```typescript
// Log in as seller
PUT /api/escrows/[escrow_id3]/accept
{
  "seller_address": "seller@test.com"
}

// Then complete flow:
PUT /api/escrows/[escrow_id3]/approve
// ... (buyer approves)

PUT /api/escrows/[escrow_id3]/release
// ... (release funds)
```

**Expected**:
- ✅ Referral tracked in `escrow_referrals`
- ✅ Tokens awarded to referrer
- ✅ Conversion recorded when completed
- ✅ Analytics show conversion metric

**Verify**:
```typescript
// Check referral tracking:
SELECT * FROM escrow_referrals 
WHERE escrow_id = '[escrow_id3]';
// Should show: referrer_id, status='pending' → 'completed'

// Check tokens:
SELECT * FROM referral_tokens 
WHERE referrer_id = 'referrer_12345';
// Should show: balance updated

// Check conversion metrics:
// Navigate to /wallet/analytics
// Referral conversion section should show +1 conversion
```

---

### Scenario 4: Multiple Concurrent Escrows

**Goal**: Test system with multiple escrows in different states

**Setup**:
```bash
# Create 5 test escrows
# Different types, amounts, statuses
```

**Steps**:

**4.1 Create 5 Escrows**
```typescript
// Create these escrows:
Escrow 1: type=buyer_protection, status=pending
Escrow 2: type=seller_protection, status=accepted
Escrow 3: type=buyer_protection, status=approved
Escrow 4: type=seller_protection, status=completed
Escrow 5: type=buyer_protection, status=disputed
```

**4.2 Verify History Shows All**
```typescript
// Navigate to /wallet/history
// Should show all 5 escrows in table
// Filter by status should show correct subset:
// - Status=Pending: 1 escrow
// - Status=Accepted: 1 escrow
// - Status=Approved: 1 escrow
// - Status=Completed: 1 escrow
// - Status=Disputed: 1 escrow
```

**4.3 Verify Analytics Correct**
```typescript
// Navigate to /wallet/analytics
// Cards should show:
// - Total Escrows: 5
// - Pending: 1
// - Completed: 1
// - Disputed: 1
// - Completion Rate: 20% (1/5)

// Charts should show:
// - Pie chart: 5 sections for different statuses
// - Timeline: 5 dates represented
```

**Verify**:
```typescript
// Check database:
SELECT status, COUNT(*) FROM escrows 
GROUP BY status;
// Should show distribution matching 5 escrows

// Check notifications logged:
SELECT COUNT(*) FROM notifications_log;
// Should have multiple records from all escrow events
```

---

## 📊 Test Matrix

Run these combinations:

| # | Buyer Type | Seller Type | Flow | Expected Status |
|---|-----------|-------------|------|-----------------|
| 1 | Individual | Business | Create→Accept→Approve→Release | ✅ Completed |
| 2 | Business | Individual | Create→Accept→Dispute | ✅ Disputed |
| 3 | Individual | Individual | Create→Accept→Approve | ⏳ Approved |
| 4 | Business | Business | Create→Accept→Release | ⏳ Approved |
| 5 | Individual | Business | Create (no accept) | ⏳ Pending |

---

## 🔍 Verification Steps

After each scenario, verify:

### 1. Database Consistency
```typescript
// Check escrows table
SELECT id, status, created_at, updated_at FROM escrows 
WHERE id IN ('[id1]', '[id2]', '[id3]', '[id4]', '[id5]');

// Check all fields present and correct
// Check timestamps reasonable (not future/far past)
// Check status progression logical
```

### 2. Notifications Sent
```typescript
// Check all notifications logged
SELECT escrow_id, notification_type, recipient, sent_at FROM notifications_log 
WHERE escrow_id IN ('[id1]', '[id2]', '[id3]', '[id4]', '[id5]')
ORDER BY sent_at DESC;

// Verify count matches expectations
// Verify recipients correct
// Verify timestamps recent
```

### 3. SMS Sent (if enabled)
```typescript
// Check SMS log
SELECT escrow_id, message, recipient, status FROM notifications_log 
WHERE notification_type = 'sms'
AND escrow_id IN ('[id1]', '[id2]', '[id3]', '[id4]', '[id5]');

// Verify SMS sent
// Verify message format correct
```

### 4. History Updated
```typescript
// Navigate to /wallet/history
// Verify each escrow shows correct:
// - Current status
// - Type
// - Amount
// - Date created
// - All transactions shown
```

### 5. Analytics Updated
```typescript
// Navigate to /wallet/analytics
// Verify:
// - Total count updated
// - Completion % calculated
// - Status breakdown correct
// - Timeline updated
// - All metrics match database
```

---

## 🧪 Test Checklist

### Pre-Test Setup
- [ ] Test users created (buyer, seller)
- [ ] Test data prepared (referrer IDs, etc)
- [ ] Email configured and working
- [ ] SMS configured (if testing)
- [ ] Database migrations run
- [ ] API server running
- [ ] Frontend running
- [ ] Browser dev tools open

### Scenario 1: Happy Path
- [ ] Escrow created successfully
- [ ] Initial notifications sent (1+ email, 1+ SMS)
- [ ] Escrow accepted
- [ ] Accept notifications sent
- [ ] Funds approved
- [ ] Approval notifications sent
- [ ] Funds released
- [ ] Release notifications sent
- [ ] Status shows "Completed"
- [ ] History updated to show completion
- [ ] Analytics shows +1 completed

### Scenario 2: Dispute
- [ ] Dispute escrow created
- [ ] Dispute initiated
- [ ] Dispute notifications sent to seller
- [ ] Dispute notifications sent to admin
- [ ] Status shows "Disputed"
- [ ] History shows dispute
- [ ] Analytics shows in disputed count

### Scenario 3: Referral
- [ ] Escrow created with referrer
- [ ] Referral tracked in database
- [ ] Escrow completed
- [ ] Referral status updated to "completed"
- [ ] Tokens awarded
- [ ] Analytics show conversion

### Scenario 4: Concurrent
- [ ] 5 escrows created
- [ ] Each has different status
- [ ] History shows all 5
- [ ] Filters work correctly
- [ ] Analytics show correct totals
- [ ] Completion % correct (1/5 = 20%)

### Final Verification
- [ ] No database errors in logs
- [ ] No API errors in console
- [ ] No frontend console errors
- [ ] All notifications in audit log
- [ ] All escrows in history
- [ ] Analytics calculations correct
- [ ] Performance acceptable (< 2 sec load)

---

## 🐛 Troubleshooting

### Issue: Notifications not sent

**Diagnosis**:
```typescript
// Check notifications_log table
SELECT COUNT(*) FROM notifications_log;
// If 0, notifications service not triggered

// Check API logs
// Look for errors when creating/updating escrow
```

**Solution**:
1. Verify SMTP configured correctly
2. Check email trigger in `escrow.ts` router
3. Check `escrow-notifications.ts` service
4. Run test: `testEmailConfiguration()`

### Issue: History not updating

**Diagnosis**:
```typescript
// Check escrows table updated
SELECT * FROM escrows WHERE id = '[id]';
// If status not changing, update not working
```

**Solution**:
1. Check API endpoint returns 200
2. Verify database has correct permissions
3. Check component refreshes after update
4. Check API caching issues

### Issue: Analytics showing old data

**Diagnosis**:
```typescript
// Refresh page and check
// If still old, check calculation
SELECT COUNT(*) FROM escrows WHERE status = 'completed';
// Compare with analytics card number
```

**Solution**:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Verify API endpoint returns fresh data
3. Check calculation in `escrow-analytics.tsx`
4. Manually call `/api/escrows/stats/summary` to verify

### Issue: Referral not tracking

**Diagnosis**:
```typescript
// Check database
SELECT * FROM escrow_referrals 
WHERE escrow_id = '[id]';
// If empty, referral not recorded
```

**Solution**:
1. Verify referrer parameter in URL
2. Check referral service is running
3. Check `referral-integration.ts` for errors
4. Verify escrow_referrals table created

---

## ✅ Success Criteria

All of these must be true:

**Scenario 1: Happy Path**
- ✅ Escrow progresses through all states
- ✅ All expected notifications sent
- ✅ History shows complete flow
- ✅ Final status is "Completed"

**Scenario 2: Dispute**
- ✅ Dispute processed correctly
- ✅ Notifications sent to all parties
- ✅ Status shows "Disputed"
- ✅ Analytics updated

**Scenario 3: Referral**
- ✅ Referral tracked from URL
- ✅ Tokens awarded on completion
- ✅ Conversion recorded
- ✅ Analytics show conversion

**Scenario 4: Concurrent**
- ✅ All 5 escrows visible in history
- ✅ Filters work correctly
- ✅ Analytics show correct totals
- ✅ No data loss or conflicts

**Overall**:
- ✅ No database errors
- ✅ No API errors
- ✅ No frontend errors
- ✅ Performance acceptable
- ✅ All notifications audited
- ✅ All data consistent

---

## 📝 Test Results Template

Use this to document results:

```markdown
## E2E Test Results

### Scenario 1: Happy Path
- Status: PASS / FAIL
- Escrow ID: [escrow_id]
- Time: [hh:mm to hh:mm]
- Notifications sent: [count]
- Issues found: [list]

### Scenario 2: Dispute
- Status: PASS / FAIL
- Escrow ID: [escrow_id]
- Time: [hh:mm to hh:mm]
- Notifications sent: [count]
- Issues found: [list]

### Scenario 3: Referral
- Status: PASS / FAIL
- Escrow ID: [escrow_id]
- Referrer ID: [ref_id]
- Tokens awarded: [count]
- Issues found: [list]

### Scenario 4: Concurrent
- Status: PASS / FAIL
- Escrow count: 5
- Correct filters: YES / NO
- Correct analytics: YES / NO
- Issues found: [list]

### Summary
- Total tests: 4
- Passed: [count]
- Failed: [count]
- Critical issues: [count]
- Minor issues: [count]

### Sign-off
- Tester: [name]
- Date: [YYYY-MM-DD]
- Ready for Task 7: YES / NO
```

---

## 🚀 Next Steps

Once all E2E tests pass:

1. ✅ Document any issues found
2. ✅ Fix any bugs discovered
3. ⏳ **Next**: Task 7 - Performance & Security Review

---

## 📚 Reference Files

**Code Files**:
- `server/routes/escrow.ts` - API endpoints
- `server/services/escrow-notifications.ts` - Notifications
- `server/services/referral-integration.ts` - Referral tracking
- `client/src/components/wallet/EscrowHistory.tsx` - History component
- `client/src/pages/escrow-analytics.tsx` - Analytics component

**Database**:
- `escrows` table - Main data
- `notifications_log` table - Audit trail
- `escrow_referrals` table - Referral tracking

---

**Estimated Time**: 90-120 minutes  
**Difficulty**: High  
**Next Task**: WEEK3_TASK7_PERF_SECURITY.md

Good luck! 🎉
