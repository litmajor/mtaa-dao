# Week 1 Backend API Testing Guide

## Overview
This document provides comprehensive testing instructions for the 3 Week 1 backend API endpoints.

## Endpoints to Test

### 1. GET /api/users/persona-data
**Purpose:** Detect user's persona based on their DAO participation and activity

**Authentication:** Required (Bearer Token)

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "primaryPersona": "dao_treasurer",
    "allPersonas": ["dao_member", "dao_treasurer"],
    "daoCount": 5,
    "isDAOCreator": true,
    "totalContributions": 42,
    "contributionTypes": ["voting", "task_completion", "fund_management"],
    "reputationScore": 8500,
    "lastActivityDate": "2025-01-15T10:30:00Z"
  }
}
```

**Test Cases:**
- Test with authenticated user who is a DAO member
- Test with authenticated user who is a DAO creator/treasurer
- Test with authenticated user with no DAO participation
- Test without authentication (should return 401)

**cURL Example:**
```bash
curl -X GET http://localhost:3000/api/users/persona-data \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

### 2. GET /api/users/my-daos
**Purpose:** List all DAOs the user belongs to or has created

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `limit` (optional): Maximum number of DAOs to return (default: 50)
- `offset` (optional): Number of DAOs to skip for pagination (default: 0)
- `sortBy` (optional): Sort field - 'name', 'members', 'createdAt' (default: 'createdAt')
- `order` (optional): Sort order - 'asc', 'desc' (default: 'desc')

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "daos": [
      {
        "id": "dao123",
        "name": "Tech Innovators",
        "description": "A DAO for tech entrepreneurs",
        "imageUrl": "https://...",
        "createdAt": "2024-12-01T00:00:00Z",
        "memberCount": 156,
        "treasuryUSD": 45000,
        "userRole": "creator",
        "userStatus": "active",
        "isPrimary": true,
        "joinedAt": "2024-12-01T00:00:00Z"
      },
      {
        "id": "dao456",
        "name": "Creative Collective",
        "description": "For digital artists and creators",
        "imageUrl": "https://...",
        "createdAt": "2024-11-15T00:00:00Z",
        "memberCount": 89,
        "treasuryUSD": 12500,
        "userRole": "member",
        "userStatus": "active",
        "isPrimary": false,
        "joinedAt": "2025-01-10T00:00:00Z"
      }
    ],
    "total": 2,
    "limit": 50,
    "offset": 0
  }
}
```

**Test Cases:**
- Test with user who has multiple DAOs
- Test with user who has created a DAO
- Test with user who is only a member
- Test pagination with `limit` and `offset`
- Test sorting by different fields
- Test with user who has no DAOs (should return empty array)
- Test without authentication (should return 401)

**cURL Examples:**
```bash
# Basic request
curl -X GET http://localhost:3000/api/users/my-daos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# With pagination
curl -X GET "http://localhost:3000/api/users/my-daos?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# With sorting
curl -X GET "http://localhost:3000/api/users/my-daos?sortBy=members&order=desc" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

### 3. GET /api/dashboard/{persona}
**Purpose:** Get persona-specific dashboard data with metrics and insights

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `persona`: One of: 'dao_member', 'dao_treasurer', 'dao_creator', 'investor'

**Expected Response Structure by Persona:**

#### For 'dao_member' Persona:
```json
{
  "success": true,
  "data": {
    "persona": "dao_member",
    "summary": {
      "activeMemberships": 3,
      "contributionsThisMonth": 12,
      "pendingTasks": 2,
      "reputationScore": 8500
    },
    "recentActivity": [
      {
        "id": "activity123",
        "type": "proposal_voted",
        "daoId": "dao123",
        "daoName": "Tech Innovators",
        "description": "Voted on proposal: Budget Increase 2025",
        "timestamp": "2025-01-15T10:30:00Z",
        "metadata": {
          "proposalId": "prop123",
          "proposalTitle": "Budget Increase 2025"
        }
      }
    ],
    "taskBoard": {
      "todo": 5,
      "inProgress": 2,
      "completed": 18,
      "upcomingDeadlines": [
        {
          "taskId": "task123",
          "title": "Review governance proposal",
          "dueDate": "2025-01-20T00:00:00Z",
          "daoName": "Tech Innovators"
        }
      ]
    },
    "networkMetrics": {
      "followersCount": 145,
      "followingCount": 89,
      "connectionRequests": 3
    }
  }
}
```

#### For 'dao_treasurer' Persona:
```json
{
  "success": true,
  "data": {
    "persona": "dao_treasurer",
    "summary": {
      "daosManaged": 2,
      "totalTreasuryUSD": 85000,
      "monthlyInflow": 12000,
      "monthlyOutflow": 8500
    },
    "treasuries": [
      {
        "daoId": "dao123",
        "daoName": "Tech Innovators",
        "balance": 45000,
        "currency": "USD",
        "memberCount": 156,
        "monthlyInflow": 8000,
        "monthlyOutflow": 5500,
        "topAssets": [
          {
            "symbol": "ETH",
            "balance": 25,
            "valueUSD": 40000
          },
          {
            "symbol": "USDC",
            "balance": 5000,
            "valueUSD": 5000
          }
        ]
      }
    ],
    "pendingApprovals": [
      {
        "id": "tx123",
        "type": "withdrawal",
        "amount": 1500,
        "currency": "USD",
        "requiredSignatures": 3,
        "currentSignatures": 1,
        "daoName": "Tech Innovators"
      }
    ],
    "financialMetrics": {
      "burnRate": 8500,
      "runwayMonths": 10,
      "assetDiversification": 0.65
    }
  }
}
```

#### For 'dao_creator' Persona:
```json
{
  "success": true,
  "data": {
    "persona": "dao_creator",
    "summary": {
      "daosCreated": 3,
      "totalMembers": 300,
      "governance": "active"
    },
    "daos": [
      {
        "daoId": "dao123",
        "name": "Tech Innovators",
        "createdAt": "2024-12-01T00:00:00Z",
        "status": "active",
        "memberCount": 156,
        "proposalsCount": 12,
        "tasksCount": 45,
        "governanceMetrics": {
          "avgProposalDuration": 5,
          "proposalApprovalRate": 0.78,
          "memberEngagementRate": 0.65
        }
      }
    ],
    "analyticsOverview": {
      "memberGrowthRate": 0.15,
      "engagementTrendMonth": "up",
      "topContributors": [
        {
          "userId": "user123",
          "username": "alice",
          "contributions": 24,
          "reputationGain": 1200
        }
      ]
    }
  }
}
```

#### For 'investor' Persona:
```json
{
  "success": true,
  "data": {
    "persona": "investor",
    "summary": {
      "portfolioValue": 125000,
      "investmentsCount": 8,
      "investmentReturnsMonth": 2400
    },
    "investments": [
      {
        "investmentId": "inv123",
        "daoName": "Tech Innovators",
        "investmentAmount": 15000,
        "currentValue": 18500,
        "returnPercentage": 23.3,
        "investmentDate": "2024-10-01T00:00:00Z",
        "sharesOwned": 150
      }
    ],
    "portfolioMetrics": {
      "diversificationScore": 0.72,
      "riskLevel": "medium",
      "averageReturn": 0.18
    },
    "opportunities": [
      {
        "id": "opp123",
        "daoName": "Emerging Tech Fund",
        "fundingNeeded": 50000,
        "fundingTarget": 100000,
        "fundingRaised": 48000,
        "expectedReturn": "25-30%"
      }
    ]
  }
}
```

**Test Cases:**
- Test each persona separately
- Test with user who doesn't have a specific persona
- Test with invalid persona name (should return 400)
- Test response includes all expected fields for the persona
- Test timestamp formatting
- Test data aggregation accuracy
- Test without authentication (should return 401)

**cURL Examples:**
```bash
# Test DAO Member Dashboard
curl -X GET http://localhost:3000/api/dashboard/dao_member \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Test DAO Treasurer Dashboard
curl -X GET http://localhost:3000/api/dashboard/dao_treasurer \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Test DAO Creator Dashboard
curl -X GET http://localhost:3000/api/dashboard/dao_creator \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Test Investor Dashboard
curl -X GET http://localhost:3000/api/dashboard/investor \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## Testing Checklist

### Authentication Tests
- [ ] Test all endpoints without authentication (expect 401)
- [ ] Test all endpoints with valid token (expect 200)
- [ ] Test all endpoints with invalid token (expect 401)
- [ ] Test all endpoints with expired token (expect 401)

### Response Structure Tests
- [ ] Verify all responses have `success` field
- [ ] Verify all responses have `data` field
- [ ] Check for error responses include `message` and `error` fields
- [ ] Verify timestamp format consistency (ISO 8601)

### Data Validation Tests
- [ ] Verify numerical fields are numbers (not strings)
- [ ] Verify boolean fields are actual booleans
- [ ] Verify dates are valid ISO 8601 format
- [ ] Verify no null values in required fields

### Performance Tests
- [ ] Test /api/users/my-daos with large result sets
- [ ] Test response time for each endpoint
- [ ] Test concurrent requests to all endpoints
- [ ] Monitor database query performance

### Error Handling Tests
- [ ] Test with missing required parameters
- [ ] Test with invalid parameter values
- [ ] Test with SQL injection attempts in query parameters
- [ ] Test with oversized request payloads

---

## Manual Testing Steps

### 1. Set Up Test Environment
```bash
# Start the development server
npm run dev

# In another terminal, prepare authentication
# Create a test user account or use existing credentials
```

### 2. Get Authentication Token
```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","username":"testuser"}'

# Login to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}' \
  > auth_response.json

# Extract token from response (adjust based on actual response structure)
TOKEN=$(jq -r '.token' auth_response.json)
```

### 3. Test Endpoint 1: Persona Detection
```bash
# Save token to variable
export TOKEN="your_token_here"

# Test persona detection
curl -X GET http://localhost:3000/api/users/persona-data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq .
```

### 4. Test Endpoint 2: List User DAOs
```bash
# Test basic request
curl -X GET http://localhost:3000/api/users/my-daos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq .

# Test with pagination
curl -X GET "http://localhost:3000/api/users/my-daos?limit=5&offset=0" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq .

# Test with sorting
curl -X GET "http://localhost:3000/api/users/my-daos?sortBy=memberCount&order=desc" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq .
```

### 5. Test Endpoint 3: Persona Dashboard
```bash
# Test each persona
for persona in dao_member dao_treasurer dao_creator investor; do
  echo "Testing $persona persona..."
  curl -X GET http://localhost:3000/api/dashboard/$persona \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    | jq .
  echo "---"
done
```

---

## Postman Collection Template

Import this into Postman for easier testing:

```json
{
  "info": {
    "name": "Week 1 Dashboard API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Persona Data",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/users/persona-data",
          "host": ["{{baseUrl}}"],
          "path": ["api", "users", "persona-data"]
        }
      }
    },
    {
      "name": "Get User DAOs",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/users/my-daos?limit=50&offset=0",
          "host": ["{{baseUrl}}"],
          "path": ["api", "users", "my-daos"],
          "query": [
            {"key": "limit", "value": "50"},
            {"key": "offset", "value": "0"}
          ]
        }
      }
    },
    {
      "name": "Get DAO Member Dashboard",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/dashboard/dao_member",
          "host": ["{{baseUrl}}"],
          "path": ["api", "dashboard", "dao_member"]
        }
      }
    },
    {
      "name": "Get DAO Treasurer Dashboard",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/dashboard/dao_treasurer",
          "host": ["{{baseUrl}}"],
          "path": ["api", "dashboard", "dao_treasurer"]
        }
      }
    }
  ]
}
```

---

## Expected Database Queries

### For Persona Detection:
1. SELECT user details from `users` table
2. COUNT DAOs created by user from `daos` table
3. COUNT DAO memberships from `dao_members` table
4. SUM contributions from `contributions` table by type
5. GET reputation score from `reputation` table

### For User DAOs:
1. SELECT DAOs from `dao_members` WHERE `user_id = ?`
2. JOIN with `daos` table for DAO details
3. COUNT members per DAO from `dao_members`
4. GET treasury info from `dao_treasury` table
5. ORDER and LIMIT results as specified

### For Dashboard:
1. Persona-specific queries based on detected persona
2. For DAO Member: Recent activity, tasks, network metrics
3. For Treasurer: Treasury balances, pending approvals, financial metrics
4. For Creator: DAO growth metrics, governance stats, analytics
5. For Investor: Portfolio values, ROI calculations, opportunities

---

## Success Criteria

✅ All endpoints return 200 status code on success
✅ All endpoints return 401 on authentication failure
✅ All endpoints return 400 on invalid parameters
✅ Response structure matches documented format exactly
✅ Data is accurate and up-to-date
✅ Performance is acceptable (< 500ms per request)
✅ No database errors in server logs
✅ No security vulnerabilities in parameter handling
✅ Proper error messages for edge cases
✅ Type safety maintained throughout

---

## Troubleshooting

### Issue: 401 Unauthorized
- **Cause:** Token missing or invalid
- **Solution:** Re-authenticate and ensure token is in Authorization header

### Issue: 404 Not Found
- **Cause:** Endpoint not registered
- **Solution:** Verify imports and route registrations in routes.ts

### Issue: 500 Internal Server Error
- **Cause:** Database or logic error
- **Solution:** Check server logs, verify database connection and query

### Issue: Empty Response Data
- **Cause:** User has no data for requested entity
- **Solution:** Create test data or verify data exists in database

---

## Next Steps After Testing

1. ✅ Verify all endpoints work correctly
2. ✅ Confirm response structures match documentation
3. ✅ Check error handling and edge cases
4. ✅ Performance optimization if needed
5. ✅ Update frontend to consume these endpoints
6. ✅ Create integration tests
7. ✅ Deploy to staging environment
