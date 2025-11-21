# Task Management API v2 - Testing Guide

This guide provides comprehensive testing instructions for the Task Management API v2 endpoints. All examples use curl commands that can be run in a terminal.

## Prerequisites

1. **Running Server:** Ensure the backend server is running on `http://localhost:3000`
2. **Authentication Token:** A valid JWT token with user authentication (typically obtained from `/auth/login` or similar)
3. **Test Data:** Initial tasks and users should exist in the database

## Setup

### Environment Variables

Create a `.env.test` file or use these commands to set variables:

```bash
# Set your authentication token
export TOKEN="your-jwt-token-here"
export BASE_URL="http://localhost:3000/api/tasks-v2"
export ADMIN_TOKEN="admin-jwt-token-here"
```

### Helper Functions

Add these to your shell profile for easier testing:

```bash
# Get headers with auth
auth_headers() {
  echo "-H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'"
}

# Helper to pretty-print JSON
pretty() {
  curl -s "$@" | jq .
}
```

---

## Test Scenarios

### Scenario 1: Complete Task Workflow

This scenario walks through creating a task, assigning it, and completing it.

#### 1.1 Create a New Task

```bash
curl -X POST $BASE_URL \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement user authentication",
    "description": "Set up JWT-based authentication for the API",
    "category": "backend",
    "priority": "high",
    "dueDate": "2024-02-01T00:00:00Z"
  }' | jq .
```

**Expected Response:** 201 Created with task details and auto-generated UUID

**Save the task ID for next steps:**
```bash
TASK_ID="<task-id-from-response>"
```

#### 1.2 Create a Task with Bounty

```bash
curl -X POST $BASE_URL \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Design system component library",
    "description": "Build reusable React components for design system",
    "category": "frontend",
    "priority": "high",
    "bountyAmount": 10000,
    "bountyToken": "MTAA",
    "distributionType": "equal",
    "requiredSkills": ["React", "TypeScript", "Storybook"]
  }' | jq .
```

**Save the IDs:**
```bash
BOUNTY_TASK_ID="<task-id>"
BOUNTY_ID="<bounty-id-from-response>"
```

#### 1.3 List All Tasks

```bash
# Get all tasks
curl -X GET "$BASE_URL?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Filter by status
curl -X GET "$BASE_URL?status=open&priority=high" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Sort by priority
curl -X GET "$BASE_URL?sortBy=priority&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

#### 1.4 Get Task Details

```bash
curl -X GET "$BASE_URL/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected Response:** Task details with assignments, bounty, milestones, and comments

#### 1.5 Update Task

```bash
curl -X PUT "$BASE_URL/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement JWT authentication",
    "priority": "critical",
    "dueDate": "2024-01-25T00:00:00Z"
  }' | jq .
```

#### 1.6 Update Task Status

```bash
# Change to in_progress
curl -X PATCH "$BASE_URL/$TASK_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}' | jq .

# Change to in_review
curl -X PATCH "$BASE_URL/$TASK_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_review"}' | jq .

# Change to completed
curl -X PATCH "$BASE_URL/$TASK_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}' | jq .
```

---

### Scenario 2: Task Assignments

This scenario covers assigning users to tasks and managing assignments.

#### 2.1 Assign User to Task

```bash
# First, get a user ID (or use a known user ID)
USER_ID_TO_ASSIGN="<another-user-uuid>"

curl -X POST "$BASE_URL/$TASK_ID/assign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"assignUserId\": \"$USER_ID_TO_ASSIGN\",
    \"role\": \"developer\",
    \"capacityPercent\": 75
  }" | jq .
```

**Save assignment ID:**
```bash
ASSIGNMENT_ID="<assignment-id-from-response>"
```

#### 2.2 Get Task Assignments

```bash
curl -X GET "$BASE_URL/$TASK_ID/assignments" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

#### 2.3 Accept Assignment (as assigned user)

```bash
# Note: This should be run as the user who was assigned
curl -X POST "$BASE_URL/assignments/$ASSIGNMENT_ID/accept" \
  -H "Authorization: Bearer $ASSIGNED_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

#### 2.4 Get User's Tasks

```bash
# Get all tasks assigned to current user
curl -X GET "$BASE_URL/user/my-tasks" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Filter by status
curl -X GET "$BASE_URL/user/my-tasks?status=in_progress" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

### Scenario 3: Bounty Management

This scenario covers creating, retrieving, and claiming bounties.

#### 3.1 Get Active Bounties

```bash
curl -X GET "$BASE_URL/bounties/active" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

#### 3.2 Get Task Bounty Details

```bash
curl -X GET "$BASE_URL/$BOUNTY_TASK_ID/bounty" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Response includes:**
- Bounty details
- Available amount (total - claimed)
- Claim status

#### 3.3 Submit Bounty Claim

```bash
curl -X POST "$BASE_URL/$BOUNTY_TASK_ID/bounty/claim" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"bountyId\": \"$BOUNTY_ID\",
    \"claimAmount\": 5000,
    \"walletAddress\": \"0x1234567890123456789012345678901234567890\",
    \"proof\": {
      \"pullRequestUrl\": \"https://github.com/repo/pull/123\",
      \"committedHours\": 16,
      \"description\": \"Completed all components with tests\"
    }
  }" | jq .
```

**Save claim ID:**
```bash
CLAIM_ID="<claim-id-from-response>"
```

#### 3.4 Get Task Bounty Claims

```bash
# Get all claims for a task
curl -X GET "$BASE_URL/$BOUNTY_TASK_ID/bounty/claims" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Filter by status
curl -X GET "$BASE_URL/$BOUNTY_TASK_ID/bounty/claims?status=pending" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

#### 3.5 Get User's Bounty Claims

```bash
curl -X GET "$BASE_URL/user/my-claims" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

#### 3.6 Review Bounty Claim (Admin)

```bash
# Approve a claim
curl -X PATCH "$BASE_URL/claims/$CLAIM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "reviewNotes": "Excellent work! All requirements met."
  }' | jq .

# Reject a claim
curl -X PATCH "$BASE_URL/claims/$CLAIM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "reviewNotes": "PR does not meet quality standards. Please refactor and resubmit."
  }' | jq .
```

---

### Scenario 4: Comments and Collaboration

This scenario covers adding comments and collaborating on tasks.

#### 4.1 Add Comment to Task

```bash
curl -X POST "$BASE_URL/$TASK_ID/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I can help implement this feature. Do we have a design spec?",
    "mentions": ["designer-user-id"]
  }' | jq .
```

#### 4.2 Add Nested Comment (Reply)

```bash
PARENT_COMMENT_ID="<comment-id-from-previous-response>"

curl -X POST "$BASE_URL/$TASK_ID/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Yes, design spec is ready in the project wiki\",
    \"parentCommentId\": \"$PARENT_COMMENT_ID\"
  }" | jq .
```

#### 4.3 Get Task Comments

```bash
curl -X GET "$BASE_URL/$TASK_ID/comments" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

### Scenario 5: Statistics and Reporting

This scenario covers retrieving and refreshing statistics.

#### 5.1 Get Task Statistics

```bash
curl -X GET "$BASE_URL/stats/overview" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Response includes:**
- Total tasks
- Tasks by status (open, in_progress, completed, cancelled)
- Bounty pool information
- Active contributors count

#### 5.2 Refresh Statistics (Admin)

```bash
curl -X POST "$BASE_URL/stats/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

---

## Error Scenarios

Test the error handling of the API with these scenarios.

### Scenario 6: Error Handling

#### 6.1 Missing Required Fields

```bash
# Missing title
curl -X POST $BASE_URL \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Missing title",
    "category": "bug"
  }' | jq .

# Expected: 400 Bad Request with error message about missing fields
```

#### 6.2 Invalid Status Update

```bash
curl -X PATCH "$BASE_URL/$TASK_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid_status"}' | jq .

# Expected: 400 Bad Request or validation error
```

#### 6.3 Unauthorized Access

```bash
# No token
curl -X GET "$BASE_URL/$TASK_ID" \
  -H "Content-Type: application/json" | jq .

# Expected: 401 Unauthorized
```

#### 6.4 Non-Existent Task

```bash
curl -X GET "$BASE_URL/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: 404 Not Found
```

#### 6.5 Bounty Claim Exceeds Available Amount

```bash
# Try to claim more than available
curl -X POST "$BASE_URL/$BOUNTY_TASK_ID/bounty/claim" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"bountyId\": \"$BOUNTY_ID\",
    \"claimAmount\": 50000,
    \"walletAddress\": \"0x1234567890123456789012345678901234567890\"
  }" | jq .

# Expected: 400 Bad Request with error about exceeding available amount
```

---

## Test Data Seeding

### SQL to Seed Test Data

```sql
-- Create test users (if not using auth system)
-- Insert test tasks
INSERT INTO tasks (
  id, title, description, category, priority, status, created_by_id, created_at, updated_at
) VALUES (
  'test-task-1',
  'Test Task 1',
  'Description for test task 1',
  'feature',
  'medium',
  'open',
  'test-user-1',
  NOW(),
  NOW()
);

-- Insert test bounty
INSERT INTO task_bounties (
  id, task_id, total_amount, token_symbol, distribution_type, status, created_at
) VALUES (
  'test-bounty-1',
  'test-task-1',
  '5000',
  'MTAA',
  'equal',
  'active',
  NOW()
);
```

---

## Performance Testing

### Load Testing with Apache Bench

```bash
# Simple load test - list endpoint
ab -n 1000 -c 10 \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/tasks-v2

# Concurrency test
ab -n 5000 -c 50 \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/tasks-v2
```

### Using hey for HTTP/2 testing

```bash
# Install: go get -u github.com/rakyll/hey

hey -n 1000 -c 10 \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/tasks-v2
```

---

## Automated Testing with Postman

### Import Collection

1. Copy the cURL commands into Postman
2. Set environment variables:
   - `token`: Your JWT token
   - `base_url`: http://localhost:3000/api/tasks-v2
   - `task_id`: Save from responses
   - `assignment_id`: Save from responses
   - `claim_id`: Save from responses

### Create Tests in Postman

For each endpoint, add a test:

```javascript
// Check for success
pm.test("Status code is 200/201", function() {
  pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});

// Validate response structure
pm.test("Response has required fields", function() {
  var jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property('success');
  pm.expect(jsonData.success).to.be.true;
});

// Save values for next requests
pm.test("Save task ID", function() {
  var jsonData = pm.response.json();
  pm.environment.set("task_id", jsonData.task.id);
});
```

---

## Debugging Tips

### Enable Detailed Logging

```bash
# Set debug logging
export DEBUG=app:* 
npm start

# Or for curl
curl -v -X GET "$BASE_URL/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Check Response Headers

```bash
curl -i -X GET "$BASE_URL/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Validate JSON

```bash
# Pretty print and validate JSON
curl -X GET "$BASE_URL/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" | jq 'keys'
```

---

## Continuous Integration

### Sample GitHub Actions Workflow

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Start server
        run: npm start &
      
      - name: Run API tests
        run: npm run test:api
        env:
          TEST_TOKEN: ${{ secrets.TEST_JWT_TOKEN }}
```

---

## Common Issues and Solutions

### Issue: 401 Unauthorized

**Solution:** 
- Verify JWT token is valid
- Check token hasn't expired
- Ensure token is passed in Authorization header

### Issue: 404 Not Found

**Solution:**
- Verify task/assignment ID is correct
- Check task exists in database
- Confirm task isn't soft-deleted

### Issue: Slow Response Times

**Solution:**
- Check database indexes
- Enable query logging to identify bottlenecks
- Use pagination to limit result sets

### Issue: Bounty Claim Rejected

**Common Causes:**
- Claim exceeds available bounty amount
- Invalid wallet address format
- Missing proof documentation

---

## Test Report Template

```markdown
# API Test Report - [Date]

## Test Environment
- Server URL: http://localhost:3000
- API Version: v2
- Database: PostgreSQL
- Node Version: 18.x

## Test Results

### Task Management
- ✅ Create Task: PASSED
- ✅ List Tasks: PASSED
- ✅ Get Task Details: PASSED
- ✅ Update Task: PASSED
- ✅ Delete Task: PASSED

### Assignments
- ✅ Assign User: PASSED
- ✅ Accept Assignment: PASSED
- ✅ Get User Tasks: PASSED

### Bounties
- ✅ Get Active Bounties: PASSED
- ✅ Submit Claim: PASSED
- ✅ Review Claim: PASSED

### Comments
- ✅ Add Comment: PASSED
- ✅ Get Comments: PASSED

### Statistics
- ✅ Get Statistics: PASSED

## Performance Metrics
- Average response time: [X]ms
- Requests per second: [X]
- Error rate: [X]%

## Issues Found
1. [Issue description]
2. [Issue description]

## Recommendations
1. [Recommendation]
2. [Recommendation]
```

