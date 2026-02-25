# Phase 5.3 Advanced Features API Reference

## Base URL
```
http://localhost:8000/api/admin/agents-elders
```

## Authentication
All endpoints require valid JWT token with admin privileges.

## Response Format
All responses follow standard JSON format:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

---

## Configuration History Endpoints

### 1. Get Configuration History

**Endpoint:**
```
GET /history/:entityType/:entityId
```

**Parameters:**
- `entityType` (path): "elder" or "agent"
- `entityId` (path): ID of the entity
- `limit` (query, optional): Results per page (default: 50)
- `offset` (query, optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "uuid",
        "entityType": "elder",
        "entityId": "kaizen",
        "versionNumber": 5,
        "configuration": { /* full config */ },
        "previousConfiguration": { /* previous config */ },
        "changedFields": ["updateInterval", "logLevel"],
        "changeReason": "Security update",
        "changedBy": "admin@example.com",
        "changedAt": "2024-02-14T10:30:00Z",
        "createdAt": "2024-02-14T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 42,
      "limit": 50,
      "offset": 0,
      "pages": 1
    }
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid parameters
- `500`: Server error

**Example:**
```bash
curl -X GET "http://localhost:8000/api/admin/agents-elders/history/elder/kaizen?limit=10&offset=0" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Specific Configuration Version

**Endpoint:**
```
GET /history/:entityType/:entityId/:versionNumber
```

**Parameters:**
- `entityType` (path): "elder" or "agent"
- `entityId` (path): Entity ID
- `versionNumber` (path): Version number to retrieve

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "entityType": "elder",
    "entityId": "kaizen",
    "versionNumber": 3,
    "configuration": { /* full config */ },
    "previousConfiguration": { /* previous config */ },
    "changedFields": ["updateInterval"],
    "changeReason": "Performance tuning",
    "changedBy": "admin@example.com",
    "changedAt": "2024-02-12T15:45:00Z",
    "createdAt": "2024-02-12T15:45:00Z"
  }
}
```

**Status Codes:**
- `200`: Success
- `404`: Version not found
- `500`: Server error

**Example:**
```bash
curl -X GET "http://localhost:8000/api/admin/agents-elders/history/elder/kaizen/3" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Compare Two Configuration Versions

**Endpoint:**
```
GET /history/:entityType/:entityId/compare
```

**Parameters:**
- `entityType` (path): "elder" or "agent"
- `entityId` (path): Entity ID
- `versionA` (query): First version number
- `versionB` (query): Second version number

**Response:**
```json
{
  "success": true,
  "data": {
    "versionA": {
      "versionNumber": 2,
      "configuration": { /* config */ },
      "changedAt": "2024-02-10T10:00:00Z"
    },
    "versionB": {
      "versionNumber": 3,
      "configuration": { /* config */ },
      "changedAt": "2024-02-12T15:45:00Z"
    },
    "differences": {
      "updateInterval": {
        "from": 5000,
        "to": 3000
      },
      "logLevel": {
        "from": "info",
        "to": "debug"
      }
    }
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Missing version parameters
- `500`: Server error

**Example:**
```bash
curl -X GET "http://localhost:8000/api/admin/agents-elders/history/elder/kaizen/compare?versionA=2&versionB=3" \
  -H "Authorization: Bearer <token>"
```

---

## Configuration Templates Endpoints

### 4. Get Templates for Entity Type

**Endpoint:**
```
GET /templates/:entityType
```

**Parameters:**
- `entityType` (path): "elder" or "agent"
- `private` (query, optional): Include private templates (true/false)
- `specificType` (query, optional): Filter by type (KAIZEN, SCRY, etc.)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "High Security Configuration",
      "description": "Enhanced security settings",
      "entityType": "elder",
      "specificType": "KAIZEN",
      "configuration": { /* template config */ },
      "category": "security",
      "isPublic": true,
      "createdBy": "admin@example.com",
      "usageCount": 12,
      "tags": ["security", "production"],
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-02-14T10:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid parameters
- `500`: Server error

**Example:**
```bash
curl -X GET "http://localhost:8000/api/admin/agents-elders/templates/elder?specificType=KAIZEN" \
  -H "Authorization: Bearer <token>"
```

---

### 5. Create Configuration Template

**Endpoint:**
```
POST /templates
```

**Request Body:**
```json
{
  "name": "Performance Optimized",
  "description": "Templates for improved performance",
  "entityType": "agent",
  "specificType": "morio",
  "configuration": {
    "updateInterval": 1000,
    "logLevel": "info",
    "maxRetries": 5,
    "cacheEnabled": true
  },
  "category": "performance",
  "isPublic": true,
  "tags": ["performance", "production"]
}
```

**Required Fields:**
- `name`: Template name
- `configuration`: Template configuration object
- `entityType`: "elder" or "agent"

**Optional Fields:**
- `description`: Template description
- `specificType`: Specific entity type
- `category`: Grouping category
- `isPublic`: Public/private flag (default: true)
- `tags`: Search tags array

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Performance Optimized",
    "entityType": "agent",
    "createdAt": "2024-02-14T10:30:00Z"
  }
}
```

**Status Codes:**
- `201`: Created
- `400`: Missing required fields
- `500`: Server error

**Example:**
```bash
curl -X POST "http://localhost:8000/api/admin/agents-elders/templates" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Performance Optimized",
    "entityType": "agent",
    "configuration": {"updateInterval": 1000}
  }'
```

---

### 6. Apply Template to Entity

**Endpoint:**
```
POST /templates/:templateId/apply
```

**Parameters:**
- `templateId` (path): Template ID to apply

**Request Body:**
```json
{
  "entityId": "morio",
  "changeReason": "Implementing performance optimization"
}
```

**Required Fields:**
- `entityId`: ID of entity to configure

**Optional Fields:**
- `changeReason`: Why the template is being applied

**Response:**
```json
{
  "success": true,
  "message": "Template applied successfully"
}
```

**Status Codes:**
- `200`: Success
- `400`: Missing entityId
- `404`: Template not found
- `500`: Server error

**Example:**
```bash
curl -X POST "http://localhost:8000/api/admin/agents-elders/templates/abc123/apply" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"entityId": "morio", "changeReason": "Performance upgrade"}'
```

---

## Scheduled Changes Endpoints

### 7. Get Scheduled Changes

**Endpoint:**
```
GET /scheduled-changes
```

**Parameters:**
- `status` (query, optional): Filter by status (pending, approved, executed)
- `entityType` (query, optional): Filter by entity type

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "entityType": "agent",
      "entityId": "morio",
      "configuration": { /* new config */ },
      "scheduledFor": "2024-02-15T10:00:00Z",
      "schedule": null,
      "status": "pending",
      "changeReason": "Performance optimization",
      "executedAt": null,
      "executionResult": null,
      "createdBy": "admin@example.com",
      "approvedBy": null,
      "approvedAt": null,
      "createdAt": "2024-02-14T10:30:00Z",
      "updatedAt": "2024-02-14T10:30:00Z"
    }
  ]
}
```

**Status Codes:**
- `200`: Success
- `500`: Server error

**Example:**
```bash
curl -X GET "http://localhost:8000/api/admin/agents-elders/scheduled-changes?status=pending" \
  -H "Authorization: Bearer <token>"
```

---

### 8. Schedule Configuration Change

**Endpoint:**
```
POST /scheduled-changes
```

**Request Body:**
```json
{
  "entityType": "agent",
  "entityId": "morio",
  "configuration": {
    "updateInterval": 2000,
    "maxRetries": 3
  },
  "scheduledFor": "2024-02-15T10:00:00Z",
  "changeReason": "Performance optimization",
  "schedule": null
}
```

**Required Fields:**
- `entityType`: "elder" or "agent"
- `entityId`: Entity to configure
- `configuration`: New configuration
- `scheduledFor`: ISO 8601 timestamp

**Optional Fields:**
- `changeReason`: Justification for change
- `schedule`: Cron expression for recurring

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "entityType": "agent",
    "entityId": "morio",
    "status": "pending",
    "scheduledFor": "2024-02-15T10:00:00Z",
    "createdAt": "2024-02-14T10:30:00Z"
  }
}
```

**Status Codes:**
- `201`: Created
- `400`: Missing required fields
- `500`: Server error

**Example:**
```bash
curl -X POST "http://localhost:8000/api/admin/agents-elders/scheduled-changes" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "agent",
    "entityId": "morio",
    "configuration": {"updateInterval": 2000},
    "scheduledFor": "2024-02-15T10:00:00Z"
  }'
```

---

### 9. Approve Scheduled Change

**Endpoint:**
```
PUT /scheduled-changes/:changeId/approve
```

**Parameters:**
- `changeId` (path): ID of scheduled change to approve

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "approved",
    "approvedBy": "admin@example.com",
    "approvedAt": "2024-02-14T10:45:00Z"
  }
}
```

**Status Codes:**
- `200`: Success
- `404`: Change not found or already approved
- `500`: Server error

**Example:**
```bash
curl -X PUT "http://localhost:8000/api/admin/agents-elders/scheduled-changes/abc123/approve" \
  -H "Authorization: Bearer <token>"
```

---

## Alert Endpoints

### 10. Get Alerts

**Endpoint:**
```
GET /alerts
```

**Parameters:**
- `resolved` (query, optional): Filter by resolution status (true/false)
- `severity` (query, optional): Filter by severity (info, warning, error, critical)
- `entityType` (query, optional): Filter by entity type

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "entityType": "agent",
      "entityId": "morio",
      "alertType": "config_change",
      "message": "Configuration changed",
      "details": {
        "previousValue": 5000,
        "newValue": 3000
      },
      "severity": "warning",
      "isResolved": false,
      "resolvedAt": null,
      "resolvedBy": null,
      "notificationsSent": true,
      "createdAt": "2024-02-14T10:30:00Z",
      "updatedAt": "2024-02-14T10:30:00Z"
    }
  ]
}
```

**Status Codes:**
- `200`: Success
- `500`: Server error

**Example:**
```bash
curl -X GET "http://localhost:8000/api/admin/agents-elders/alerts?severity=critical" \
  -H "Authorization: Bearer <token>"
```

---

### 11. Resolve Alert

**Endpoint:**
```
PUT /alerts/:alertId/resolve
```

**Parameters:**
- `alertId` (path): ID of alert to resolve

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "isResolved": true,
    "resolvedBy": "admin@example.com",
    "resolvedAt": "2024-02-14T10:45:00Z"
  }
}
```

**Status Codes:**
- `200`: Success
- `404`: Alert not found
- `500`: Server error

**Example:**
```bash
curl -X PUT "http://localhost:8000/api/admin/agents-elders/alerts/abc123/resolve" \
  -H "Authorization: Bearer <token>"
```

---

## Alert Rules Endpoints

### 12. Get Alert Rules

**Endpoint:**
```
GET /alert-rules
```

**Parameters:**
- `enabled` (query, optional): Filter by enabled status (true/false)
- `entityType` (query, optional): Filter by entity type

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "High Memory Usage",
      "description": "Alert when memory usage exceeds threshold",
      "entityType": "agent",
      "entityId": null,
      "alertType": "threshold",
      "condition": {
        "metric": "memoryUsage",
        "operator": "greaterThan"
      },
      "threshold": {
        "value": 80,
        "unit": "percent"
      },
      "severity": "error",
      "isEnabled": true,
      "notificationChannels": ["email", "slack"],
      "createdBy": "admin@example.com",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-02-14T10:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200`: Success
- `500`: Server error

**Example:**
```bash
curl -X GET "http://localhost:8000/api/admin/agents-elders/alert-rules?enabled=true" \
  -H "Authorization: Bearer <token>"
```

---

### 13. Create Alert Rule

**Endpoint:**
```
POST /alert-rules
```

**Request Body:**
```json
{
  "name": "Configuration Change Alert",
  "alertType": "config_change",
  "condition": {
    "type": "change_detected",
    "fields": ["updateInterval", "logLevel"]
  },
  "description": "Alert when configuration changes",
  "entityType": "agent",
  "severity": "warning",
  "notificationChannels": ["email"]
}
```

**Required Fields:**
- `name`: Rule name
- `alertType`: Type of alert
- `condition`: Condition expression

**Optional Fields:**
- `description`: What the rule does
- `entityType`: Target entity type
- `entityId`: Target entity (null = all)
- `threshold`: Threshold values
- `severity`: Alert severity (default: info)
- `isEnabled`: Active flag (default: true)
- `notificationChannels`: Email, Slack, etc.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Configuration Change Alert",
    "alertType": "config_change",
    "createdAt": "2024-02-14T10:30:00Z"
  }
}
```

**Status Codes:**
- `201`: Created
- `400`: Missing required fields
- `500`: Server error

**Example:**
```bash
curl -X POST "http://localhost:8000/api/admin/agents-elders/alert-rules" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Configuration Change Alert",
    "alertType": "config_change",
    "condition": {"type": "change_detected"}
  }'
```

---

## Search Profile Endpoints

### 14. Get Search Profiles

**Endpoint:**
```
GET /search-profiles
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "High-Risk Agents",
      "description": "Search for agents with risk score > 80",
      "query": "risk_score > 80 AND type = agent",
      "filters": {
        "riskScore": { "min": 80 },
        "type": "agent"
      },
      "isPublic": true,
      "createdBy": "admin@example.com",
      "usageCount": 23,
      "lastUsedAt": "2024-02-14T10:30:00Z",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-02-14T10:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200`: Success
- `500`: Server error

**Example:**
```bash
curl -X GET "http://localhost:8000/api/admin/agents-elders/search-profiles" \
  -H "Authorization: Bearer <token>"
```

---

### 15. Create Search Profile

**Endpoint:**
```
POST /search-profiles
```

**Request Body:**
```json
{
  "name": "Recent Changes",
  "query": "changed_at >= 2024-02-10",
  "description": "Search for changes in last 5 days",
  "filters": {
    "dateRange": {
      "start": "2024-02-10",
      "end": "2024-02-15"
    }
  },
  "isPublic": false
}
```

**Required Fields:**
- `name`: Profile name
- `query`: Search query

**Optional Fields:**
- `description`: What it searches for
- `filters`: Filter configuration
- `isPublic`: Public/private flag (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Recent Changes",
    "query": "changed_at >= 2024-02-10",
    "createdAt": "2024-02-14T10:30:00Z"
  }
}
```

**Status Codes:**
- `201`: Created
- `400`: Missing required fields
- `500`: Server error

**Example:**
```bash
curl -X POST "http://localhost:8000/api/admin/agents-elders/search-profiles" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Recent Changes",
    "query": "changed_at >= 2024-02-10"
  }'
```

---

## Analytics Endpoint

### 16. Get Performance Analytics

**Endpoint:**
```
GET /performance-analytics
```

**Parameters:**
- `entityType` (query, required): "elder" or "agent"
- `entityId` (query, required): Entity ID
- `days` (query, optional): Number of days (default: 7)

**Response:**
```json
{
  "success": true,
  "data": {
    "entityType": "agent",
    "entityId": "morio",
    "days": 7,
    "snapshots": [
      {
        "id": "uuid",
        "entityType": "agent",
        "entityId": "morio",
        "metrics": {
          "cpuUsage": 45.2,
          "memoryUsage": 62.8,
          "successRate": 99.2,
          "responseTime": 234
        },
        "timestamp": "2024-02-14T10:30:00Z",
        "period": "daily"
      }
    ]
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Missing required parameters
- `500`: Server error

**Example:**
```bash
curl -X GET "http://localhost:8000/api/admin/agents-elders/performance-analytics?entityType=agent&entityId=morio&days=30" \
  -H "Authorization: Bearer <token>"
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200 OK`: Successful GET request
- `201 Created`: Successful POST request
- `204 No Content`: Successful DELETE/update with no return data
- `400 Bad Request`: Invalid parameters or missing required fields
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Rate Limiting

No rate limiting currently implemented. May be added in production.

---

## Pagination

List endpoints support pagination:
- `limit`: Results per page (default: 50, max: 100)
- `offset`: Page offset (default: 0)

Example:
```bash
GET /history/elder/kaizen?limit=10&offset=20
```

Response includes pagination metadata:
```json
{
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 20,
    "pages": 10
  }
}
```

---

## Sorting

Most list endpoints return results sorted by:
- **History**: By version_number DESC
- **Templates**: By usage_count DESC, then updated_at DESC
- **Alerts**: By severity DESC, then created_at DESC
- **Search Profiles**: By usage_count DESC, then updated_at DESC

---

## Filtering

Use query parameters to filter results:

- `status`: Filter by status (pending, approved, executed, resolved)
- `severity`: Filter by severity (info, warning, error, critical)
- `entityType`: Filter by entity type
- `resolved`: Filter by resolution status (true/false)
- `enabled`: Filter by enabled status (true/false)

---

## Audit Logging

All mutating operations (POST, PUT, DELETE) include audit logging:
- User ID recorded
- Action type stored
- Resource details captured
- Timestamps recorded

---

## Authentication

Include JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## Summary

**Total Endpoints**: 16 new endpoints
**Collections**: History, Templates, Scheduled Changes, Alerts, Rules, Profiles, Analytics
**Features**: Version control, templates, scheduling, alerts, search, performance metrics

All endpoints are production-ready with:
- Comprehensive validation
- Error handling
- Audit logging
- Permission enforcement
- Pagination support
