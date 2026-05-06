# OKEDI Escrow - Testing & QA Guide

## 🧪 Manual Testing Scenarios

### Scenario 1: Create Escrow WITHOUT Mediator (Backward Compatible)

**Steps:**
1. Go to Wallet → Initiate Escrow
2. Enter recipient email: `bob@example.com`
3. Amount: `100`
4. Currency: `cUSD`
5. Description: `Website design`
6. Add milestone: `Design mockups - $50`
7. Add milestone: `Final delivery - $50`
8. **Do NOT select DAO** → Mediator selector hidden
9. Click "Initiate Escrow"
10. Copy invite link
11. Share with recipient

**Expected Result:**
- Escrow created with `daoId = NULL`, `mediatorId = NULL`
- Works exactly like before (backward compatible) ✅

---

### Scenario 2: Create Escrow WITH Mediator (NEW)

**Steps:**
1. Go to Wallet → Initiate Escrow
2. Enter recipient: `alice@example.com`
3. Amount: `50`
4. Description: `Freelance writing`
5. Milestones: `Writing - $50`
6. **Select DAO: "MTAA Council"** → Mediator selector appears
7. **Search mediators:** Type "John"
8. **Select:** John (Elder, Trust: 85)
9. Click "Initiate Escrow"

**Expected Result:**
- Escrow created with `mediatorId = john-id`
- John receives notification: "You are assigned as mediator"
- Invite link includes mediator context ✅

---

### Scenario 3: Complete Escrow Normally (Reputation Boost)

**Prerequisites:**
- Alice (payer) created escrow for Bob (payee)
- Escrow is in "funded" state

**Steps:**
1. Alice & Bob both accept terms
2. Mediator (if assigned) reviews and approves
3. Click "Release Funds" button
4. Confirm transaction

**Expected Result:**
- Escrow marked "released"
- Alice reputation: +2 ✅
- Bob reputation: +2 ✅
- Notification: "✅ Escrow Completed! Both parties earned +2 reputation"

---

### Scenario 4: File Dispute & Resolve (Reputation Scoring)

**Prerequisites:**
- Escrow is in "accepted/funded" state
- Both parties haven't released

**Steps - File Dispute:**
1. Alice (or Bob) clicks "File Dispute"
2. Reason: `"Work quality below standard"`
3. Upload evidence (screenshot, file, etc.)
4. Submit

**Expected Result:**
- Escrow status → "disputed"
- Mediator notified: "Dispute filed on escrow #123"
- Other party notified: "Dispute filed"

**Steps - Mediator Resolves:**
1. Mediator views escrow detail page
2. Reviews evidence from both sides
3. Makes decision: "Split 60% payee, 40% payer"
4. Clicks "Make Decision"
5. Selects "Split"
6. Enters payer percentage: `40`
7. Confirms

**Expected Result - Reputation Updates:**
- Alice (payer, got 40%): reputation -2 ❌ (lost)
- Bob (payee, got 60%): reputation +2 ✅ (won)
- Mediator John: reputation +5 ✅ (resolved)
- Funds released: Alice sends 40% back, Bob keeps 60%
- Both notified: "⚖️ Dispute Resolved"

---

### Scenario 5: Mediator Approves (Normal Flow)

**Prerequisites:**
- Escrow created with assigned mediator
- Status: "accepted"

**Steps:**
1. Mediator views escrow details
2. Reviews terms and milestones
3. Clicks "Approve as Mediator"
4. Confirms

**Expected Result:**
- `mediatorApprovedAt` timestamp set
- Payer notified: "Mediator approved. Ready to release."
- Status still "accepted" but mediator-approved flag set ✅

---

## ✅ Automated Test Cases

### Test 1: Mediator Suggestion
```bash
curl GET /api/escrow/mediators/suggest/{daoId}
  -H "Authorization: Bearer token"

Expected:
- 200 OK
- Array of mediators
- Sorted by trust score (highest first)
- Excludes sender/recipient
```

### Test 2: Set Mediator
```bash
curl POST /api/escrow/{id}/set-mediator
  -H "Authorization: Bearer payer-token"
  -d '{"mediatorId": "user-123"}'

Expected:
- 200 OK
- Escrow.mediatorId = user-123
- Mediator notified
```

### Test 3: Approve as Mediator
```bash
curl POST /api/escrow/{id}/approve-as-mediator
  -H "Authorization: Bearer mediator-token"

Expected:
- 200 OK
- mediatorApprovedAt = now
```

### Test 4: Complete with Trust
```bash
curl POST /api/escrow/{id}/complete-with-trust
  -H "Authorization: Bearer payer-token"

Expected:
- 200 OK
- Status = "released"
- Payer.trustScore += 2
- Payee.trustScore += 2
```

### Test 5: Resolve Dispute
```bash
curl POST /api/escrow/{id}/resolve-dispute
  -H "Authorization: Bearer mediator-token"
  -d '{
    "winner": "split",
    "payerPercentage": 30
  }'

Expected:
- 200 OK
- disputeWinner = "split"
- disputePercentages = {payer: 30, payee: 70}
- Loser.trustScore -= 2 (if payee won, payer loses)
- Winner.trustScore += 2
- Mediator.trustScore += 5
```

---

## 🐛 Common Issues & Troubleshooting

### Issue: Mediator selector not showing
**Cause:** DAO not selected
**Fix:** Select DAO first, then mediator selector appears ✅

### Issue: "Not assigned as mediator" error
**Cause:** Wrong user trying to approve/resolve
**Fix:** Only assigned mediator can approve/resolve
**Solution:** Use mediator's auth token ✅

### Issue: Reputation not updating
**Cause:** Service method not called
**Fix:** Verify endpoint was hit and returned 200 ✅

### Issue: Trust score is string instead of number
**Cause:** Database returns string, need to parse
**Fix:** Wrap in `parseInt()` when displaying ✅

### Issue: Backward compatibility broken
**Cause:** New fields required
**Fix:** All new fields have defaults (NULL/empty)
**Verify:** Create escrow without DAO - should work ✅

---

## 📊 Database Queries for Testing

### Check user trust scores
```sql
SELECT id, username, trust_score FROM users ORDER BY trust_score DESC LIMIT 10;
```

### Check escrow with mediator
```sql
SELECT id, payer_id, payee_id, mediator_id, status, dispute_winner, created_at 
FROM escrow_accounts 
WHERE mediator_id IS NOT NULL;
```

### Check dispute resolution
```sql
SELECT escrow_id, dispute_winner, dispute_percentages, resolved_at 
FROM escrow_accounts 
WHERE dispute_winner IS NOT NULL;
```

### Check reputation changes
```sql
SELECT 
  id, 
  username, 
  trust_score,
  created_at
FROM users 
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY trust_score DESC;
```

---

## 📱 UI Testing Checklist

```
EscrowInitiator Component:
☐ Form renders without errors
☐ DAO selector appears
☐ Mediator selector hidden until DAO selected
☐ Mediator selector shows list when clicked
☐ Can search mediators by name
☐ Selected mediator shows with avatar/trust score
☐ Can clear selected mediator with X button
☐ Form submits with daoId + mediatorId
☐ Works without selecting DAO (backward compat)

EscrowMediatorSelector Component:
☐ Shows "Select a DAO first" when no DAO
☐ Loads mediators from API
☐ Shows loading state while fetching
☐ Displays mediators with avatars
☐ Shows trust scores
☐ Shows roles (elder, treasurer, admin)
☐ Search filters by username/role
☐ Selected mediator shows in blue box
☐ Can clear selection with X
☐ No matches message when search empty

Escrow Detail Page:
☐ Shows mediator name if assigned
☐ Shows "Approve as Mediator" button if user is mediator
☐ Shows "Resolve Dispute" button if user is mediator AND disputed
☐ Shows trust score changes in notification
```

---

## 🔒 Security Testing

```
Authorization:
☐ Only payer can set mediator
☐ Only assigned mediator can approve
☐ Only assigned mediator can resolve
☐ Users can't view others' escrows (except parties)
☐ Mediator can't access escrows they're not assigned to
☐ All endpoints require valid JWT token

Input Validation:
☐ Invalid mediatorId rejected
☐ Invalid daoId rejected
☐ Dispute percentage > 100 rejected
☐ Dispute percentage < 0 rejected
☐ Invalid winner value rejected
☐ Escrow not found returns 404
☐ User not party to escrow returns 403

Data Integrity:
☐ Trust scores can't go below 0 (or min value)
☐ Trust scores can't exceed reasonable max
☐ Reputation updates are atomic (all or nothing)
☐ Dispute resolution only once
☐ Can't re-approve after resolved
```

---

## 📈 Performance Testing

```
API Response Times:
☐ GET /api/escrow/mediators/suggest/{id} < 200ms
☐ POST /api/escrow/{id}/set-mediator < 300ms
☐ POST /api/escrow/{id}/approve-as-mediator < 300ms
☐ POST /api/escrow/{id}/complete-with-trust < 500ms
☐ POST /api/escrow/{id}/resolve-dispute < 500ms

Database:
☐ Mediator suggestion query uses proper indexes
☐ No N+1 queries on escrow detail load
☐ Reputation update is transactional
☐ No locking issues with concurrent updates
```

---

## ✨ Success Criteria

All of the following must pass:

```
Core Functionality:
✅ Escrow with mediator assignment works
✅ Escrow without mediator works (backward compat)
✅ Reputation scores update correctly
✅ Dispute resolution works
✅ Mediator can split funds custom percentages
✅ Notifications sent to all parties

Authorization:
✅ Only authorized users can perform actions
✅ Proper 403 on unauthorized requests
✅ JWT tokens validated

Data Integrity:
✅ Reputation changes are permanent
✅ Dispute can only be resolved once
✅ Fund splits add to 100%

Performance:
✅ All endpoints respond in < 500ms
✅ No timeout issues
✅ Database queries optimized

UI/UX:
✅ Components render without errors
✅ Form validation works
✅ Notifications display correctly
✅ Mobile responsive

Backward Compatibility:
✅ Existing escrows work unchanged
✅ Old API calls work unchanged
✅ No breaking changes
```

---

## 🚀 Go-Live Checklist

Before deploying to production:

```
Code:
☐ All 5 endpoints implemented
☐ All 5 service methods implemented
☐ Components created and tested
☐ No console errors/warnings
☐ TypeScript compiles without errors

Database:
☐ Schema updated with new fields
☐ All indexes present
☐ Migration tested on staging
☐ Backup taken before deployment

Testing:
☐ All scenarios tested manually
☐ All 5 API tests pass
☐ Security tests pass
☐ Performance tests pass
☐ UI tests pass
☐ No breaking changes

Documentation:
☐ This testing guide complete
☐ API docs updated
☐ Dev notes recorded
☐ Troubleshooting guide ready

Monitoring:
☐ Error tracking configured
☐ Performance monitoring on
☐ Notification service ready
☐ Database backups automated
```

---

**Created:** January 27, 2026
**Status:** Ready for QA
**Duration:** ~2 hours full testing cycle

