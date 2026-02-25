# 🎯 Referral Endpoints - Quick Testing Checklist

## All 14 Referral System Endpoints

### Core Referrals Module (`/api/referrals`)

#### 1️⃣ GET /api/referrals/stats
- **Auth Required:** ✅ Yes
- **Purpose:** Get user's referral statistics (code, total referrals, earnings, etc.)
- **Status Code:** 401 (no auth), 404 (user not found), 200 (success), 500 (DB error)
- **Test Command:**
  ```bash
  curl -X GET http://localhost:3000/api/referrals/stats \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- **Expected Response (200):**
  ```json
  {
    "referralCode": "MTAA-ABC123",
    "referralUsername": "john_doe",
    "totalReferrals": 5,
    "activeReferrals": 4,
    "totalEarned": 100,
    "pendingRewards": 50,
    "thisMonthReferrals": 2
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 2️⃣ GET /api/referrals/leaderboard
- **Auth Required:** ❌ No (public)
- **Purpose:** Get top 50 referrers with badges (Bronze/Silver/Gold/Platinum/Diamond)
- **Status Code:** 200 (success), 500 (DB error)
- **Test Command:**
  ```bash
  curl -X GET http://localhost:3000/api/referrals/leaderboard
  ```
- **Expected Response (200):**
  ```json
  [
    {
      "id": "user-123",
      "name": "John Doe",
      "referrals": 25,
      "earnings": 500,
      "rank": 1,
      "badge": "Gold"
    }
  ]
  ```
- **Testing:** [ ] No 500 errors

---

#### 3️⃣ GET /api/referrals/referred-users
- **Auth Required:** ✅ Yes
- **Purpose:** Get list of users referred by current user with status
- **Status Code:** 401 (no auth), 200 (success), 500 (DB error)
- **Test Command:**
  ```bash
  curl -X GET http://localhost:3000/api/referrals/referred-users \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- **Expected Response (200):**
  ```json
  {
    "success": true,
    "summary": {
      "total": 5,
      "active": 4,
      "banned": 1
    },
    "users": [
      {
        "id": "user-456",
        "username": "jane_smith",
        "displayName": "Jane Smith",
        "email": "jane@example.com",
        "joinedAt": "2025-01-10T10:00:00Z",
        "contributions": 10,
        "status": "active",
        "shareLink": "@jane_smith"
      }
    ]
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 4️⃣ POST /api/referrals/distribute-reward
- **Auth Required:** ❌ No (but should be admin-only)
- **Purpose:** Manually award referral rewards
- **Status Code:** 400 (missing fields), 200 (success), 500 (DB error)
- **Request Body:**
  ```json
  {
    "referrerId": "user-123",
    "newUserId": "user-456",
    "rewardAmount": 20
  }
  ```
- **Test Command:**
  ```bash
  curl -X POST http://localhost:3000/api/referrals/distribute-reward \
    -H "Content-Type: application/json" \
    -d '{"referrerId":"user-123","newUserId":"user-456","rewardAmount":20}'
  ```
- **Expected Response (200):**
  ```json
  {
    "success": true,
    "transaction": { /* wallet transaction */ },
    "message": "Referral reward distributed successfully"
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 5️⃣ POST /api/referrals/ping-inactive
- **Auth Required:** ✅ Yes
- **Purpose:** Send reminder to inactive referred users
- **Status Code:** 401 (no auth), 400 (missing fields), 200 (success), 500 (error)
- **Request Body:**
  ```json
  {
    "referredUserId": "user-456",
    "daoId": "dao-123"
  }
  ```
- **Test Command:**
  ```bash
  curl -X POST http://localhost:3000/api/referrals/ping-inactive \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"referredUserId":"user-456","daoId":"dao-123"}'
  ```
- **Expected Response (200):**
  ```json
  {
    "success": true,
    "message": "Reminder sent to inactive user"
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 6️⃣ POST /api/referrals/validate (NEW)
- **Auth Required:** ❌ No
- **Purpose:** Validate referral eligibility BEFORE sending invite
- **Status Code:** 200 (eligible/ineligible), 400 (validation error), 500 (error)
- **Request Body:**
  ```json
  {
    "referrerId": "user-123",
    "email": "newuser@example.com"
  }
  ```
- **Test Command:**
  ```bash
  curl -X POST http://localhost:3000/api/referrals/validate \
    -H "Content-Type: application/json" \
    -d '{"referrerId":"user-123","email":"newuser@example.com"}'
  ```
- **Expected Response (200 - eligible):**
  ```json
  {
    "isEligible": true,
    "userExists": false
  }
  ```
- **Expected Response (200 - not eligible):**
  ```json
  {
    "isEligible": false,
    "reason": "User already exists - no referral reward available",
    "userExists": true
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 7️⃣ GET /api/referrals/analytics (NEW)
- **Auth Required:** ✅ Yes
- **Purpose:** Get detailed referral analytics for current user
- **Status Code:** 401 (no auth), 200 (success), 400 (error)
- **Test Command:**
  ```bash
  curl -X GET http://localhost:3000/api/referrals/analytics \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- **Expected Response (200):**
  ```json
  {
    "stats": {
      "totalInvitationsSent": 10,
      "invitationsAccepted": 8,
      "invitationsPending": 2,
      "invitationsExpired": 0,
      "invitationsRejected": 0,
      "totalRewardsAwarded": 8,
      "totalRewardAmount": 160,
      "conversionRate": 80,
      "rewardsByType": {
        "invitationAccepted": 8,
        "firstContribution": 0,
        "milestone": 0
      }
    },
    "recentInvitations": [ /* ... */ ],
    "recentRewards": [ /* ... */ ]
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 8️⃣ GET /api/referrals/status/:invitationId (NEW)
- **Auth Required:** ❌ No
- **Purpose:** Get status of specific referral invitation
- **Status Code:** 200 (found), 400 (error)
- **Test Command:**
  ```bash
  curl -X GET http://localhost:3000/api/referrals/status/invitation-456
  ```
- **Expected Response (200):**
  ```json
  {
    "invitationSent": true,
    "invitationAccepted": true,
    "userSignedUp": true,
    "rewardAwarded": true,
    "rewardAmount": 20,
    "statusTimestamp": "2025-01-15T10:00:00Z"
  }
  ```
- **Testing:** [ ] No 500 errors

---

### Referral Rewards Module (`/api/referral-rewards`)

#### 9️⃣ GET /api/referral-rewards/current-week
- **Auth Required:** ✅ Yes
- **Purpose:** Get current week's leaderboard with potential rewards
- **Status Code:** 401 (no auth), 200 (success), 500 (error)
- **Test Command:**
  ```bash
  curl -X GET http://localhost:3000/api/referral-rewards/current-week \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- **Expected Response (200):**
  ```json
  {
    "weekStart": "2025-01-12T00:00:00.000Z",
    "weekEnd": "2025-01-19T00:00:00.000Z",
    "totalPool": 10000,
    "distributedAmount": 5000,
    "leaderboard": [
      {
        "rank": 1,
        "userId": "user-123",
        "name": "John Doe",
        "referralCount": 25,
        "activeReferrals": 20,
        "qualityScore": 80,
        "baseReward": 3000,
        "qualityBonus": 600,
        "totalReward": 3600,
        "isCurrentUser": true
      }
    ],
    "userPosition": { /* same as above */ },
    "daysRemaining": 4
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 🔟 GET /api/referral-rewards/history
- **Auth Required:** ✅ Yes
- **Purpose:** Get user's reward history (20 most recent)
- **Status Code:** 401 (no auth), 200 (success), 500 (error)
- **Test Command:**
  ```bash
  curl -X GET http://localhost:3000/api/referral-rewards/history \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- **Expected Response (200):**
  ```json
  {
    "rewards": [
      {
        "id": "reward-123",
        "weekEnding": "2025-01-12T00:00:00Z",
        "rank": 1,
        "baseReward": 3000,
        "qualityMultiplier": 1.2,
        "bonusAmount": 600,
        "totalReward": 3600,
        "claimedAmount": 900,
        "status": "vesting",
        "vestingSchedule": "25/25/25/25",
        "createdAt": "2025-01-13T09:00:00Z"
      }
    ],
    "summary": {
      "totalEarned": 10000,
      "totalClaimed": 5000,
      "pending": 5000
    }
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 1️⃣1️⃣ POST /api/referral-rewards/claim/:rewardId
- **Auth Required:** ✅ Yes
- **Purpose:** Claim available rewards with vesting validation
- **Status Code:** 401 (no auth), 404 (reward not found), 400 (not vested yet), 200 (success), 500 (error)
- **Request Body (optional):**
  ```json
  {
    "claimAmount": 500
  }
  ```
- **Test Command:**
  ```bash
  curl -X POST http://localhost:3000/api/referral-rewards/claim/reward-123 \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"claimAmount":500}'
  ```
- **Expected Response (200 - success):**
  ```json
  {
    "success": true,
    "claimed": 500,
    "remaining": 3600,
    "vestedPercentage": 50,
    "nextVestingDate": "2025-02-12T00:00:00Z",
    "nextVestingPercentage": 75,
    "transactionId": null
  }
  ```
- **Expected Response (400 - not ready):**
  ```json
  {
    "error": "No tokens available to claim yet",
    "nextVestingDate": "2025-02-12T00:00:00Z",
    "nextVestingPercentage": 75
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 1️⃣2️⃣ GET /api/referral-rewards/leaderboard
- **Auth Required:** ❌ No (public)
- **Purpose:** Get ranking with quality scoring and optional timeframe filter
- **Query Parameters:** 
  - `timeframe` - all-time (default), this-month, this-quarter, this-year
  - `limit` - max results (default 50)
- **Status Code:** 200 (success), 500 (error)
- **Test Command:**
  ```bash
  curl -X GET "http://localhost:3000/api/referral-rewards/leaderboard?timeframe=this-month&limit=20"
  ```
- **Expected Response (200):**
  ```json
  {
    "timeframe": "this-month",
    "leaderboard": [
      {
        "rank": 1,
        "userId": "user-123",
        "name": "John Doe",
        "rewardCount": 5,
        "totalEarned": "5000.00",
        "totalClaimed": "1250.00",
        "pendingAmount": "3750.00",
        "claimRatio": 25,
        "lastReward": "2025-01-12T00:00:00Z"
      }
    ],
    "totalRanked": 50,
    "generatedAt": "2025-01-15T10:30:00Z"
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 1️⃣3️⃣ GET /api/referral-rewards/stats
- **Auth Required:** ✅ Yes
- **Purpose:** Get overall program stats
- **Status Code:** 401 (no auth), 200 (success), 500 (error)
- **Test Command:**
  ```bash
  curl -X GET http://localhost:3000/api/referral-rewards/stats \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- **Expected Response (200):**
  ```json
  {
    "uniqueWinners": 150,
    "totalDistributions": 500,
    "totalDistributed": "1500000.00",
    "totalClaimed": "750000.00",
    "pendingDistribution": "750000.00",
    "lastDistribution": "2025-01-13T09:00:00Z",
    "currentWeekPool": 10000,
    "avgWeeklyDistribution": 1500.00
  }
  ```
- **Testing:** [ ] No 500 errors

---

#### 1️⃣4️⃣ POST /api/referral-rewards/distribute
- **Auth Required:** ✅ Yes (Admin only)
- **Purpose:** Manually trigger weekly reward distribution
- **Status Code:** 401 (no auth), 403 (not admin), 400 (already distributed), 200 (success), 500 (error)
- **Request Body:**
  ```json
  {
    "weekEnding": "2025-01-19T00:00:00Z"
  }
  ```
- **Test Command:**
  ```bash
  curl -X POST http://localhost:3000/api/referral-rewards/distribute \
    -H "Authorization: Bearer ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"weekEnding":"2025-01-19T00:00:00Z"}'
  ```
- **Expected Response (200):**
  ```json
  {
    "success": true,
    "distributed": 10,
    "totalAmount": 15000,
    "distributions": [
      {
        "userId": "user-123",
        "rank": 1,
        "totalReward": 3000
      }
    ]
  }
  ```
- **Testing:** [ ] No 500 errors

---

## Testing Summary

### How to Test All Endpoints

1. **Start the server:**
   ```bash
   npm run dev  # or yarn dev
   ```

2. **Get an auth token (if needed):**
   ```bash
   # Login to get token
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"password"}'
   ```

3. **Run each test command above and verify:**
   - ✅ No 500 errors
   - ✅ Status code is as expected
   - ✅ Response format matches documentation
   - ✅ Error messages are helpful

### Error Codes to Monitor

| Code | Meaning | Expected? |
|------|---------|-----------|
| 200 | Success | ✅ YES |
| 400 | Bad request (validation failed) | ✅ YES |
| 401 | Unauthorized (no auth token) | ✅ YES |
| 403 | Forbidden (not admin) | ✅ YES |
| 404 | Not found (resource doesn't exist) | ✅ YES |
| 500 | Server error | ❌ NO (should not occur) |

---

## Checklist

- [ ] All 14 endpoints tested
- [ ] No 500 errors returned
- [ ] Auth required endpoints reject unauthenticated requests properly
- [ ] Admin endpoints properly restrict access
- [ ] Public endpoints work without authentication
- [ ] Error messages are helpful and descriptive
- [ ] Vesting schedule in /claim endpoint works correctly
- [ ] Leaderboard returns top 50 users correctly
- [ ] Current week rewards calculation is accurate
- [ ] Database is properly seeded with test data

---

**Last Updated:** 2026-01-15
**Status:** ✅ READY FOR TESTING

