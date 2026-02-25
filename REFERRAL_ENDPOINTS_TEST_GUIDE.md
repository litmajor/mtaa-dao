# 🎯 Referral Endpoints Testing Guide

## All Referral Endpoints Summary

### Core Referral Routes (`/api/referrals`)
Located in: [server/routes/referrals.ts](server/routes/referrals.ts)

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/referrals/stats` | ✅ Required | Get user's referral statistics | ⏳ Test |
| GET | `/api/referrals/leaderboard` | ❌ Public | Get top 50 referrers with badges | ⏳ Test |
| GET | `/api/referrals/referred-users` | ✅ Required | Get list of users referred by current user | ⏳ Test |
| POST | `/api/referrals/distribute-reward` | ❌ Admin? | Award referral rewards manually | ⏳ Test |
| POST | `/api/referrals/ping-inactive` | ✅ Required | Send reminder to inactive referred users | ⏳ Test |

### Referral Validation & Analytics Routes
Located in: [server/api/referral_service.ts](server/api/referral_service.ts)
**Status: ⚠️ Handlers defined but NOT registered in Express routes**

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| POST | `/api/referrals/validate` | ❌ | Validate referral eligibility before sending | ❌ NOT REGISTERED |
| GET | `/api/referrals/analytics` | ✅ Required | Get detailed referral analytics | ❌ NOT REGISTERED |
| GET | `/api/referrals/status/:invitationId` | ❌ | Get status of specific referral invitation | ❌ NOT REGISTERED |

### Referral Rewards Routes (`/api/referral-rewards`)
Located in: [server/routes/referral-rewards.ts](server/routes/referral-rewards.ts)

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| GET | `/api/referral-rewards/current-week` | ✅ Required | Get current week's leaderboard with potential rewards | ⏳ Test |
| GET | `/api/referral-rewards/history` | ✅ Required | Get user's reward history (20 most recent) | ⏳ Test |
| POST | `/api/referral-rewards/claim/:rewardId` | ✅ Required | Claim available rewards with vesting validation | ⏳ Test |
| GET | `/api/referral-rewards/stats` | ✅ Required | Get user's total earned/claimed stats | ⏳ Verify |
| POST | `/api/referral-rewards/distribute` | ✅ Admin | Trigger weekly reward distribution | ⏳ Test |

### Invitation Routes (Related to Referrals)
Located in: [server/routes.ts](server/routes.ts)

| Method | Endpoint | Auth | Purpose | Status |
|--------|----------|------|---------|--------|
| POST | `/api/dao/:daoId/invitations` | ✅ Required | Create DAO invitation (includes referral) | ⏳ Test |
| GET | `/api/dao/:daoId/invitations` | ❌ | Get all invitations for a DAO | ⏳ Test |
| DELETE | `/api/dao/:daoId/invitations/:invitationId` | ✅ Required | Revoke invitation | ⏳ Test |
| GET | `/api/invitations/pending` | ✅ Required | Get pending invitations for user | ⏳ Test |
| POST | `/api/invitations/:inviteToken/accept` | ✅ Required | Accept referral invitation | ⏳ Test |
| POST | `/api/invitations/:inviteToken/reject` | ❌ | Reject referral invitation | ⏳ Test |

---

## Testing Checklist

### Prerequisites
- [ ] Obtain valid auth token (login first)
- [ ] Identify test user ID
- [ ] Identify test DAO ID
- [ ] Create test referral invitations if needed

### Error Response Testing (500 Error Prevention)

#### 1. Authentication Issues
- [ ] **GET `/api/referrals/stats`** without auth token → Should return 401, NOT 500
- [ ] **GET `/api/referrals/analytics`** without auth token → Should return 401, NOT 500
- [ ] **POST `/api/referral-rewards/claim/:rewardId`** with invalid token → Should return 401, NOT 500

#### 2. Resource Not Found
- [ ] **GET `/api/referrals/status/:invitationId`** with non-existent ID → Should return 404, NOT 500
- [ ] **POST `/api/referral-rewards/claim/:rewardId`** with invalid rewardId → Should return 400/404, NOT 500
- [ ] **GET `/api/dao/:daoId/invitations`** with invalid daoId → Should return 400/404, NOT 500

#### 3. Bad Request Data
- [ ] **POST `/api/referrals/validate`** with missing email → Should return 400, NOT 500
- [ ] **POST `/api/referrals/distribute-reward`** with missing required fields → Should return 400, NOT 500
- [ ] **POST `/api/invitations/:inviteToken/accept`** with invalid token format → Should return 400, NOT 500

#### 4. Database Connection Errors
- [ ] **GET `/api/referrals/leaderboard`** when DB is slow → Should handle gracefully, NOT 500
- [ ] **GET `/api/referral-rewards/history`** with large dataset → Should paginate/limit, NOT 500
- [ ] **POST `/api/referral-rewards/distribute`** (cron job) → Should fail gracefully, NOT 500

#### 5. Happy Path Testing
- [ ] **GET `/api/referrals/stats`** with valid user → Should return 200 with stats
- [ ] **GET `/api/referrals/leaderboard`** → Should return 200 with array of top 50
- [ ] **GET `/api/referral-rewards/current-week`** → Should return 200 with leaderboard
- [ ] **POST `/api/referral-rewards/claim/:rewardId`** → Should return 200/400 (with helpful error)
- [ ] **GET `/api/referrals/referred-users`** → Should return 200 with user list

---

## Known Implementation Issues to Verify

### In [server/routes/referrals.ts](server/routes/referrals.ts)

1. **Line 16 - GET /stats**
   ```typescript
   // Potential issue: No try-catch around db queries
   // Verify: All database errors are caught and return 400/500 with message
   ```

2. **Line 70 - GET /leaderboard**
   ```typescript
   // Uses raw SQL - verify parameterized correctly
   // Could throw if users/walletTransactions schema doesn't match
   res.status(500).json({ error: error.message }); // ✅ Has error handling
   ```

3. **Line 105 - POST /distribute-reward**
   ```typescript
   // Checks for required fields properly
   // But no authentication - is this intentional?
   // Verify: Is this endpoint admin-only in practice?
   ```

4. **Line 155 - GET /referred-users**
   ```typescript
   // Filters users by referredBy - verify this column exists
   // Error handling looks good: catches and returns 500 with message
   ```

### In [server/routes/referral-rewards.ts](server/routes/referral-rewards.ts)

1. **Line 31 - GET /current-week**
   ```typescript
   // Uses complex SQL with aggregations
   // Verify: All column names match schema (firstName, lastName, isActive, etc.)
   // Has error handling: logger.error + res.status(500)
   ```

2. **Line 115 - GET /history**
   ```typescript
   // Potential issue: References "referral_rewards" table
   // Verify: Table structure matches query (weekEnding, rank, baseReward, etc.)
   // Has error handling: logger.error + res.status(500)
   ```

3. **Line 155 - POST /claim/:rewardId**
   ```typescript
   // Vesting schedule logic is complex
   // Verify: Math is correct (25%, 50%, 75%, 100% milestones)
   // Verify: Handles edge cases (reward already claimed, negative amounts, etc.)
   // Truncated - need to see full implementation
   ```

---

## Testing Commands

### 1. Test Referrals Stats (Requires Auth)
```bash
curl -X GET http://localhost:3000/api/referrals/stats \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Expected: 200 with stats object or 401 if unauthorized
# Should NOT return: 500
```

### 2. Test Referrals Leaderboard (Public)
```bash
curl -X GET http://localhost:3000/api/referrals/leaderboard \
  -H "Content-Type: application/json"

# Expected: 200 with array of top referrers
# Should NOT return: 500
```

### 3. Test Referral Rewards Current Week
```bash
curl -X GET http://localhost:3000/api/referral-rewards/current-week \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Expected: 200 with week's leaderboard
# Should NOT return: 500
```

### 4. Test Claim Reward
```bash
curl -X POST http://localhost:3000/api/referral-rewards/claim/REWARD_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"claimAmount": 100}'

# Expected: 200 if valid, 400 if vesting not ready
# Should NOT return: 500 (unless DB error)
```

### 5. Test Validate Referral
```bash
curl -X POST http://localhost:3000/api/referrals/validate \
  -H "Content-Type: application/json" \
  -d '{
    "referrerId": "USER_ID",
    "email": "test@example.com"
  }'

# Expected: 200 with eligibility status
# Should NOT return: 500
```

---

## Code Review Findings

### ✅ Good Practices
- Error messages are descriptive
- 404/400 status codes used appropriately in most places
- Authentication middleware applied where needed
- Try-catch blocks catch and log errors

### ⚠️ Areas to Verify
1. **Column Name Mismatches**: SQL queries reference columns like `first_name`, `is_banned`, `referred_by` - verify these match actual schema
2. **Missing Endpoints**: `validateReferralHandler`, `getReferralAnalyticsHandler` defined but may not be registered in routes
3. **Admin-Only Checks**: Some endpoints (distribute-reward) don't have explicit admin checks
4. **Vesting Logic**: Complex math in claim endpoint - verify all edge cases handled

### 🔴 Issues Found
1. **No pagination** on leaderboard (LIMIT 50) - okay for now but could be slow
2. **Complex SQL** in referral-rewards could fail silently if schema changes
3. **Unclear registration**: Some handlers defined but unclear if registered in Express

---

## Next Steps

1. ✅ Run through all test cases above
2. ✅ Enable server logs to capture any 500 errors
3. ✅ Check database schema matches SQL queries
4. ✅ Verify all handlers are registered in main routes file
5. ✅ Load test the leaderboard endpoint with large datasets
6. ✅ Test concurrent claims to ensure no race conditions

---

## Integration Points

This referral system integrates with:
- **DAOs**: Invitations per DAO
- **Users**: Referrer/Referee tracking
- **Wallet Transactions**: Recording rewards
- **Contributions**: Calculating reward value
- **Cron Jobs**: Weekly reward distribution (if enabled)

Ensure all these systems are:
- ✅ Database tables exist and have correct schema
- ✅ Foreign keys properly configured
- ✅ Indices exist for performance (user lookups, referral tracking)

