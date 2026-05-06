# Task Management API v2 Documentation

## Overview

The Task Management API v2 provides endpoints for creating, managing, and collaborating on tasks within the MTAA DAO platform. It includes support for task assignments, bounty management, claims processing, and activity tracking.

## Base URL

```
/api/tasks-v2
```

## Authentication

All endpoints except those marked as public require authentication. Include a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

The user information is extracted from the JWT payload using `id` or `sub` field.

---

## Task Management Endpoints

### 1. List All Tasks

**Endpoint:** `GET /`

**Description:** Retrieve a paginated list of all visible tasks with optional filtering and sorting.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by task status (e.g., 'open', 'in_progress', 'completed') |
| `category` | string | No | Filter by task category |
| `priority` | string | No | Filter by priority (low, medium, high, critical) |
| `assignedTo` | string | No | Filter by user ID of assignee |
| `sortBy` | string | No | Sort field: 'priority', 'due_date', 'bounty', or 'created' (default) |
| `limit` | number | No | Number of results per page (default: 50) |
| `offset` | number | No | Pagination offset (default: 0) |

**Response:**
```json
{
  "success": true,
  "count": 25,
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Fix login page bug",
      "description": "Users unable to login with Google",
      "category": "bug",
      "priority": "high",
      "status": "in_progress",
      "createdById": "user-uuid",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T14:45:00Z",
      "dueDate": "2024-01-20T00:00:00Z",
      "bountyAmount": "1000"
    }
  ]
}
```

### 2. Get Task Details

**Endpoint:** `GET /:taskId`

**Description:** Retrieve detailed information about a specific task, including assignments, bounty, milestones, and comments.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Response:**
```json
{
  "success": true,
  "task": {
    "id": "task-uuid",
    "title": "Fix login page bug",
    "description": "Users unable to login with Google",
    "category": "bug",
    "priority": "high",
    "status": "in_progress",
    "createdById": "user-uuid",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T14:45:00Z",
    "dueDate": "2024-01-20T00:00:00Z",
    "bountyAmount": "1000"
  },
  "assignments": [...],
  "bounty": {...},
  "milestones": [...],
  "comments": [...]
}
```

**Status Codes:**
- `200` - Success
- `404` - Task not found
- `500` - Server error

### 3. Create New Task

**Endpoint:** `POST /`

**Authentication:** Required

**Description:** Create a new task. If a `bountyAmount` is provided, a corresponding bounty will be created.

**Request Body:**
```json
{
  "title": "Implement dark mode",
  "description": "Add dark mode support to the dashboard",
  "category": "feature",
  "priority": "medium",
  "dueDate": "2024-02-01T00:00:00Z",
  "bountyAmount": 2500,
  "bountyToken": "MTAA",
  "distributionType": "equal",
  "requiredSkills": ["React", "TypeScript"],
  "skillLevel": "intermediate",
  "tags": ["frontend", "ui"]
}
```

**Required Fields:** `title`, `description`, `category`

**Optional Fields:** `priority`, `dueDate`, `bountyAmount`, `bountyToken`, `distributionType`, `requiredSkills`, `skillLevel`, `tags`

**Response:**
```json
{
  "success": true,
  "task": {
    "id": "new-task-uuid",
    "title": "Implement dark mode",
    "description": "Add dark mode support to the dashboard",
    "category": "feature",
    "priority": "medium",
    "status": "open",
    "createdById": "user-uuid",
    "createdAt": "2024-01-16T10:00:00Z",
    "bountyAmount": "2500"
  },
  "bounty": {
    "id": "bounty-uuid",
    "taskId": "new-task-uuid",
    "totalAmount": "2500",
    "tokenSymbol": "MTAA",
    "distributionType": "equal",
    "status": "active"
  }
}
```

**Status Codes:**
- `201` - Task created successfully
- `400` - Missing required fields or invalid data
- `401` - Unauthorized
- `500` - Server error

### 4. Update Task

**Endpoint:** `PUT /:taskId`

**Authentication:** Required

**Description:** Update task details. Partial updates are supported.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Request Body:**
```json
{
  "title": "Updated task title",
  "description": "Updated description",
  "priority": "critical",
  "dueDate": "2024-02-15T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "task": {
    "id": "task-uuid",
    "title": "Updated task title",
    "description": "Updated description",
    "priority": "critical",
    "dueDate": "2024-02-15T00:00:00Z",
    "updatedAt": "2024-01-16T11:30:00Z"
  }
}
```

### 5. Update Task Status

**Endpoint:** `PATCH /:taskId/status`

**Authentication:** Required

**Description:** Update the status of a task.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Request Body:**
```json
{
  "status": "completed"
}
```

**Valid Status Values:** `open`, `in_progress`, `in_review`, `completed`, `cancelled`

**Response:**
```json
{
  "success": true,
  "task": {
    "id": "task-uuid",
    "status": "completed",
    "completedAt": "2024-01-16T15:00:00Z",
    "updatedAt": "2024-01-16T15:00:00Z"
  }
}
```

### 6. Delete Task (Soft Delete)

**Endpoint:** `DELETE /:taskId`

**Authentication:** Required

**Description:** Mark a task as deleted (soft delete). The task remains in the database but is hidden from queries.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Response:**
```json
{
  "success": true,
  "task": {
    "id": "task-uuid",
    "isHidden": true,
    "updatedAt": "2024-01-16T15:30:00Z"
  }
}
```

---

## Task Assignment Endpoints

### 7. Assign User to Task

**Endpoint:** `POST /:taskId/assign`

**Authentication:** Required

**Description:** Assign a user to a task with a specific role and capacity.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Request Body:**
```json
{
  "assignUserId": "user-uuid-to-assign",
  "role": "developer",
  "capacityPercent": 50
}
```

**Required Fields:** `assignUserId`

**Optional Fields:** `role` (default: 'contributor'), `capacityPercent` (default: 100)

**Response:**
```json
{
  "success": true,
  "assignment": {
    "id": "assignment-uuid",
    "taskId": "task-uuid",
    "userId": "user-uuid-to-assign",
    "role": "developer",
    "capacityPercent": 50,
    "status": "assigned",
    "assignedById": "assigner-user-uuid",
    "assignedAt": "2024-01-16T16:00:00Z"
  }
}
```

### 8. Get Task Assignments

**Endpoint:** `GET /:taskId/assignments`

**Description:** Retrieve all assignments for a specific task.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Response:**
```json
{
  "success": true,
  "assignments": [
    {
      "id": "assignment-uuid",
      "taskId": "task-uuid",
      "userId": "user-uuid",
      "role": "developer",
      "capacityPercent": 50,
      "status": "accepted",
      "assignedAt": "2024-01-16T16:00:00Z",
      "acceptedAt": "2024-01-16T16:15:00Z"
    }
  ]
}
```

### 9. Accept Assignment

**Endpoint:** `POST /assignments/:assignmentId/accept`

**Authentication:** Required

**Description:** Accept a task assignment. The assignment must belong to the authenticated user.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assignmentId` | string | Yes | UUID of the assignment |

**Response:**
```json
{
  "success": true,
  "assignment": {
    "id": "assignment-uuid",
    "status": "accepted",
    "acceptedAt": "2024-01-16T16:15:00Z"
  }
}
```

### 10. Get User's Tasks

**Endpoint:** `GET /user/my-tasks`

**Authentication:** Required

**Description:** Retrieve all tasks assigned to the authenticated user.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by task status |

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "task": { /* task details */ },
      "assignment": { /* assignment details */ }
    }
  ]
}
```

---

## Bounty Management Endpoints

### 11. Get Active Bounties

**Endpoint:** `GET /bounties/active`

**Description:** Retrieve all active bounties across all tasks.

**Response:**
```json
{
  "success": true,
  "count": 10,
  "bounties": [
    {
      "id": "bounty-uuid",
      "taskId": "task-uuid",
      "totalAmount": "2500",
      "claimedAmount": "500",
      "tokenSymbol": "MTAA",
      "distributionType": "equal",
      "status": "active",
      "createdAt": "2024-01-16T10:00:00Z"
    }
  ]
}
```

### 12. Get Task Bounty

**Endpoint:** `GET /:taskId/bounty`

**Description:** Retrieve bounty information for a specific task.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Response:**
```json
{
  "success": true,
  "bounty": {
    "id": "bounty-uuid",
    "taskId": "task-uuid",
    "totalAmount": "2500",
    "claimedAmount": "500",
    "tokenSymbol": "MTAA",
    "distributionType": "equal",
    "status": "active"
  },
  "availableAmount": 2000
}
```

---

## Bounty Claim Endpoints

### 13. Submit Bounty Claim

**Endpoint:** `POST /:taskId/bounty/claim`

**Authentication:** Required

**Description:** Submit a bounty claim for a task. The claim is initially in 'pending' status and must be reviewed by an admin.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Request Body:**
```json
{
  "bountyId": "bounty-uuid",
  "claimAmount": 500,
  "walletAddress": "0x...",
  "proof": {
    "pullRequestUrl": "https://github.com/...",
    "committedHours": 8,
    "description": "Fixed the login page issue"
  }
}
```

**Required Fields:** `bountyId`, `claimAmount`, `walletAddress`

**Optional Fields:** `proof`

**Response:**
```json
{
  "success": true,
  "claim": {
    "id": "claim-uuid",
    "bountyId": "bounty-uuid",
    "taskId": "task-uuid",
    "userId": "user-uuid",
    "claimAmount": "500",
    "walletAddress": "0x...",
    "status": "pending",
    "submittedAt": "2024-01-16T17:00:00Z"
  }
}
```

**Status Codes:**
- `201` - Claim submitted
- `400` - Missing required fields or claim exceeds available bounty
- `401` - Unauthorized

### 14. Get Bounty Claims for Task

**Endpoint:** `GET /:taskId/bounty/claims`

**Description:** Retrieve all claims submitted for a task's bounty.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by claim status (pending, approved, rejected) |

**Response:**
```json
{
  "success": true,
  "count": 3,
  "claims": [
    {
      "id": "claim-uuid",
      "bountyId": "bounty-uuid",
      "taskId": "task-uuid",
      "userId": "user-uuid",
      "claimAmount": "500",
      "status": "pending",
      "submittedAt": "2024-01-16T17:00:00Z"
    }
  ]
}
```

### 15. Get User's Bounty Claims

**Endpoint:** `GET /user/my-claims`

**Authentication:** Required

**Description:** Retrieve all bounty claims submitted by the authenticated user.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "claims": [
    {
      "id": "claim-uuid",
      "bountyId": "bounty-uuid",
      "taskId": "task-uuid",
      "claimAmount": "500",
      "status": "pending",
      "submittedAt": "2024-01-16T17:00:00Z"
    }
  ]
}
```

### 16. Review Bounty Claim

**Endpoint:** `PATCH /claims/:claimId`

**Authentication:** Required (Admin role required)

**Description:** Review and approve/reject a bounty claim.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `claimId` | string | Yes | UUID of the claim |

**Request Body:**
```json
{
  "status": "approved",
  "reviewNotes": "Work completed satisfactorily"
}
```

**Valid Status Values:** `pending`, `approved`, `rejected`

**Required Fields:** `status`

**Optional Fields:** `reviewNotes`

**Response:**
```json
{
  "success": true,
  "claim": {
    "id": "claim-uuid",
    "status": "approved",
    "reviewedById": "admin-user-uuid",
    "reviewNotes": "Work completed satisfactorily",
    "reviewedAt": "2024-01-17T10:00:00Z"
  }
}
```

---

## Statistics Endpoints

### 17. Get Task Statistics

**Endpoint:** `GET /stats/overview`

**Description:** Retrieve cached task statistics. If no cached statistics exist, they will be calculated and cached.

**Response:**
```json
{
  "success": true,
  "statistics": {
    "id": "stats-uuid",
    "totalTasks": 150,
    "openTasks": 45,
    "inProgressTasks": 32,
    "completedTasks": 70,
    "cancelledTasks": 3,
    "totalBountyAmount": "50000",
    "claimedBounties": "15000",
    "paidBounties": "12000",
    "activeContributors": 28,
    "calculatedAt": "2024-01-17T08:00:00Z"
  }
}
```

### 18. Refresh Statistics

**Endpoint:** `POST /stats/refresh`

**Authentication:** Required (Admin role required)

**Description:** Force recalculation and caching of task statistics.

**Response:**
```json
{
  "success": true,
  "statistics": {
    "id": "stats-uuid",
    "totalTasks": 150,
    "openTasks": 45,
    "inProgressTasks": 32,
    "completedTasks": 70,
    "cancelledTasks": 3,
    "totalBountyAmount": "50000",
    "claimedBounties": "15000",
    "paidBounties": "12000",
    "calculatedAt": "2024-01-17T09:15:00Z"
  }
}
```

---

## Comment Endpoints

### 19. Add Comment to Task

**Endpoint:** `POST /:taskId/comments`

**Authentication:** Required

**Description:** Add a comment to a task. Supports mentions and nested comments.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Request Body:**
```json
{
  "content": "I can help with this task",
  "mentions": ["user-uuid-1", "user-uuid-2"],
  "parentCommentId": "parent-comment-uuid"
}
```

**Required Fields:** `content`

**Optional Fields:** `mentions`, `parentCommentId` (for nested comments)

**Response:**
```json
{
  "success": true,
  "comment": {
    "id": "comment-uuid",
    "taskId": "task-uuid",
    "userId": "user-uuid",
    "content": "I can help with this task",
    "mentions": ["user-uuid-1", "user-uuid-2"],
    "parentCommentId": null,
    "createdAt": "2024-01-17T10:30:00Z"
  }
}
```

### 20. Get Task Comments

**Endpoint:** `GET /:taskId/comments`

**Description:** Retrieve all comments for a task in chronological order.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | UUID of the task |

**Response:**
```json
{
  "success": true,
  "count": 5,
  "comments": [
    {
      "id": "comment-uuid",
      "taskId": "task-uuid",
      "userId": "user-uuid",
      "content": "I can help with this task",
      "mentions": [],
      "parentCommentId": null,
      "createdAt": "2024-01-17T10:30:00Z"
    }
  ]
}
```

---

## Error Responses

All endpoints return standard error responses in the following format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `200` - Success (GET requests)
- `201` - Created (POST/PUT/PATCH requests)
- `400` - Bad Request (validation errors, missing fields)
- `401` - Unauthorized (missing or invalid authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## Rate Limiting

Currently, no rate limiting is implemented. This may be added in future versions.

## Webhooks

Webhooks are not currently supported but may be added in future versions.

## Versioning

This API is v2. Previous versions:
- v1: Deprecated

---

## Example Usage

### Creating a Task with a Bounty

```bash
curl -X POST http://localhost:3000/api/tasks-v2 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement user profile page",
    "description": "Create a user profile page with edit functionality",
    "category": "feature",
    "priority": "high",
    "dueDate": "2024-02-01T00:00:00Z",
    "bountyAmount": 5000,
    "bountyToken": "MTAA",
    "requiredSkills": ["React", "TypeScript", "CSS"]
  }'
```

### Submitting a Bounty Claim

```bash
curl -X POST http://localhost:3000/api/tasks-v2/task-uuid/bounty/claim \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "bountyId": "bounty-uuid",
    "claimAmount": 5000,
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "proof": {
      "pullRequestUrl": "https://github.com/...",
      "committedHours": 16
    }
  }'
```

### Retrieving User's Tasks

```bash
curl -X GET "http://localhost:3000/api/tasks-v2/user/my-tasks?status=in_progress" \
  -H "Authorization: Bearer <token>"
```

---

## Support

For API issues or questions, please open an issue on GitHub or contact the development team.

