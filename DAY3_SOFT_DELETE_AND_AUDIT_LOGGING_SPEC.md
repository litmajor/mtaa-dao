# Day 3: Soft Delete & Audit Logging Specification
**Status:** 🔵 READY TO BUILD  
**Date:** Wednesday, February 13, 2026  
**Hours:** 19 hours (9 AM - 6 PM)  
**Owners:** Engineer B (Admin), Engineer A (Support)  
**Goals:**
- Implement soft delete with 30-day recovery window for users & DAOs
- Comprehensive audit logging for all admin actions
- Admin recovery interface for managing deleted items
- System-wide audit querying & reporting

---

## Part 1: Soft Delete Implementation (Morning, 3 Hours)

### 1.1 Database Schema Changes

**Migration File: `011-soft-delete-users-daos.ts`**

Changes to `users` table:
```typescript
// Add these columns:
- deleted_at: timestamp (nullable, DEFAULT NULL)
- deleted_by: UUID (nullable, FK to admin_users)
- delete_reason: text (nullable)
- deleted_recovery_deadline: timestamp (nullable, DEFAULT NULL + 30 days when deleted)
```

Changes to `daos` table:
```typescript
// Add these columns:
- deleted_at: timestamp (nullable, DEFAULT NULL)
- deleted_by: UUID (nullable, FK to admin_users)
- delete_reason: text (nullable)
- deleted_recovery_deadline: timestamp (nullable, DEFAULT NULL + 30 days when deleted)
```

Changes to `admin_users` table:
```typescript
// Add these columns (soft delete admins too):
- deleted_at: timestamp (nullable, DEFAULT NULL)
- deleted_by: UUID (nullable, FK to admin_users)
- delete_reason: text (nullable)
- deleted_recovery_deadline: timestamp (nullable)
```

**Indexes to add:**
```sql
CREATE INDEX users_deleted_at_idx ON users(deleted_at);
CREATE INDEX users_deleted_recovery_idx ON users(deleted_recovery_deadline);
CREATE INDEX daos_deleted_at_idx ON daos(deleted_at);
CREATE INDEX daos_deleted_recovery_idx ON daos(deleted_recovery_deadline);
CREATE INDEX admin_users_deleted_at_idx ON admin_users(deleted_at);
```

**Implementation Notes:**
- `deleted_at` NULL means active
- `deleted_at` NOT NULL means soft deleted (can see if deleted)
- `deleted_recovery_deadline` = `deleted_at` + 30 days (INTERVAL '30 days')
- All soft delete fields must be logged in audit trail

### 1.2 Soft Delete Service

**File: `server/services/softDeleteService.ts`**

```typescript
interface SoftDeleteDTO {
  targetId: string;
  targetType: 'user' | 'dao' | 'admin';
  deletedBy: string;
  reason: string;
  auditLogId?: string; // Reference to audit log
}

interface RestoreDTO {
  targetId: string;
  targetType: 'user' | 'dao' | 'admin';
  restoredBy: string;
  reason: string;
  auditLogId?: string;
}

class SoftDeleteService {
  // Soft delete user
  async softDeleteUser(dto: SoftDeleteDTO): Promise<void>
    // 1. Check if user exists
    // 2. Check if already soft deleted
    // 3. Update users table: set deleted_at, deleted_by, delete_reason, deleted_recovery_deadline
    // 4. Log to audit trail
    // 5. Notify user via email (if enabled)
    // 6. Trigger any cleanup (e.g., revoke sessions, cancel pending actions)

  // Soft delete DAO
  async softDeleteDAO(dto: SoftDeleteDTO): Promise<void>
    // 1. Check if DAO exists
    // 2. Check if already soft deleted
    // 3. Update daos table: set deleted_at, deleted_by, delete_reason, deleted_recovery_deadline
    // 4. Soft delete all users in DAO? OR keep as-is?
    // 5. Log to audit trail
    // 6. Notify DAO members

  // Soft delete admin
  async softDeleteAdmin(dto: SoftDeleteDTO): Promise<void>
    // 1. Check if admin exists
    // 2. Check if last superuser (prevent deleting all admins)
    // 3. Revoke all permissions + sessions immediately
    // 4. Update admin_users table
    // 5. Log to audit trail with approval chain

  // Restore user
  async restoreUser(dto: RestoreDTO): Promise<void>
    // 1. Check if user is soft deleted
    // 2. Check if within 30-day recovery window
    // 3. If past deadline, throw "Recovery deadline expired"
    // 4. Clear deleted_at, deleted_by, delete_reason, deleted_recovery_deadline
    // 5. Log restoration to audit trail
    // 6. Restore access (sessions, permissions)
    // 7. Notify user of restoration

  // Restore DAO
  async restoreDAO(dto: RestoreDTO): Promise<void>
    // Same as restoreUser but for DAOs

  // Check recovery status
  async getRecoveryStatus(targetId: string, targetType: string): Promise<{
    isDeleted: boolean;
    deletedAt?: Date;
    deletedBy?: string;
    reason?: string;
    recoveryDeadline?: Date;
    daysRemaining?: number;
  }>

  // List all soft-deleted items (for admin recovery page)
  async listSoftDeleted(targetType: string, limit: number = 50): Promise<Array<{
    id: string;
    name: string;
    deletedAt: Date;
    deletedBy: string;
    reason: string;
    recoveryDeadline: Date;
    daysRemaining: number;
  }>>

  // Force permanent delete (only after 30 days)
  async permanentlyDelete(targetId: string, targetType: string, reason: string): Promise<void>
    // 1. Check if 30-day period has passed
    // 2. If not, throw "Cannot permanently delete yet"
    // 3. Permanently delete from database
    // 4. Log to audit trail (irreversible action)
}
```

### 1.3 Query Guards (Filter Active Items)

**Update all queries to exclude soft-deleted items:**

```typescript
// BEFORE:
const user = await db.execute(sql`
  SELECT * FROM users WHERE id = ${userId}
`);

// AFTER:
const user = await db.execute(sql`
  SELECT * FROM users WHERE id = ${userId} AND deleted_at IS NULL
`);

// For listing:
const users = await db.execute(sql`
  SELECT * FROM users 
  WHERE deleted_at IS NULL
  ORDER BY created_at DESC
`);

// For recovery page:
const deletedUsers = await db.execute(sql`
  SELECT * FROM users
  WHERE deleted_at IS NOT NULL AND deleted_recovery_deadline > NOW()
  ORDER BY deleted_recovery_deadline ASC
`);
```

**Files to update:**
- `server/services/userService.ts` - All user queries
- `server/services/daoService.ts` - All DAO queries
- `server/services/adminAuthService.ts` - Admin user queries
- `server/routes/admin/admin-users.ts` - User management endpoints
- `server/routes/admin/admin-daos.ts` - DAO management endpoints
- `server/routes/users.ts` - User profile endpoints
- `server/routes/governance.ts` - DAO lookup endpoints

---

## Part 2: Comprehensive Audit Logging (Midday, 3 Hours)

### 2.1 Audit Log Schema

**Migration File: `012-audit-logging-comprehensive.ts`**

```sql
CREATE TABLE audit_logs (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor (WHO performed action)
  actor_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_type VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (actor_type IN ('admin', 'agent', 'system')),
  actor_role VARCHAR(50), -- 'superuser', 'moderator', 'bot', etc.
  
  -- Action (WHAT was done)
  action_type VARCHAR(100) NOT NULL, -- 'soft_delete_user', 'restore_user', 'approve_proposal', etc.
  action_category VARCHAR(50) NOT NULL DEFAULT 'admin', -- 'admin', 'governance', 'agent', 'system'
  
  -- Target (TO WHAT)
  target_type VARCHAR(50) NOT NULL, -- 'user', 'dao', 'proposal', 'escrow', 'agent'
  target_id UUID NOT NULL,
  target_name VARCHAR(255), -- snapshot of target name at action time
  
  -- State Snapshots (WHAT CHANGED)
  before_state JSONB, -- JSON snapshot of object before change
  after_state JSONB, -- JSON snapshot of object after change
  changed_fields TEXT[], -- Array of field names that changed: ['deleted_at', 'deleted_by']
  
  -- Result (SUCCESS or FAILURE)
  result VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failed', 'partial')),
  result_reason TEXT, -- "User not found", "Insufficient permissions", etc.
  result_snapshot JSONB, -- Final state after action
  
  -- Authority & Approval Chain
  authority VARCHAR(50) NOT NULL DEFAULT 'admin', -- 'self', 'delegated', 'admin', 'approval_board', 'automated'
  approval_chain TEXT[], -- Array of [approver1_id, approver2_id] if multi-step approval
  approval_status VARCHAR(20), -- 'pending', 'approved', 'rejected'
  
  -- Reversibility Metadata
  reversible BOOLEAN NOT NULL DEFAULT false, -- Can this action be undone?
  reversal_action_id UUID, -- If this action reverses another, FK to that audit log
  reversal_type VARCHAR(50), -- 'restore', 'cancel', 'rollback'
  reversal_deadline TIMESTAMP, -- Until when can this be reversed?
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  -- Request Context (HOW & WHERE)
  metadata JSONB, -- {
                   //   "ip_address": "192.168.1.1",
                   //   "user_agent": "Mozilla/5...",
                   //   "device_fingerprint": "abc123",
                   //   "session_id": "sess_xyz",
                   //   "request_id": "req_123",
                   //   "endpoint": "POST /api/admin/users/:id/delete"
                   // }
  
  -- Optional: Integration context
  external_id VARCHAR(255), -- Reference to external system (Sentry, etc.)
  related_logs TEXT[] -- Array of related audit log IDs
);

-- Indexes for fast querying
CREATE INDEX audit_logs_actor_id_idx ON audit_logs(actor_id);
CREATE INDEX audit_logs_action_type_idx ON audit_logs(action_type);
CREATE INDEX audit_logs_target_type_target_id_idx ON audit_logs(target_type, target_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX audit_logs_actor_created_idx ON audit_logs(actor_id, created_at);
CREATE INDEX audit_logs_action_created_idx ON audit_logs(action_type, created_at);
CREATE INDEX audit_logs_target_created_idx ON audit_logs(target_type, target_id, created_at);
CREATE INDEX audit_logs_result_idx ON audit_logs(result);
CREATE INDEX audit_logs_reversible_idx ON audit_logs(reversible, reversal_deadline);
```

### 2.2 Audit Logging Service

**File: `server/services/auditLoggingService.ts`**

```typescript
interface AuditLogDTO {
  // Actor
  actorId: string;
  actorType?: 'admin' | 'agent' | 'system';
  actorRole?: string;
  
  // Action
  actionType: string; // 'soft_delete_user', 'restore_user', 'approve_proposal', etc.
  actionCategory?: 'admin' | 'governance' | 'agent' | 'system';
  
  // Target
  targetType: string; // 'user', 'dao', 'proposal', etc.
  targetId: string;
  targetName?: string;
  
  // State
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  changedFields?: string[];
  
  // Result
  result?: 'success' | 'failed' | 'partial';
  resultReason?: string;
  
  // Authority
  authority?: string; // 'self', 'admin', 'approval_board'
  approvalChain?: string[]; // Array of approver IDs
  
  // Reversibility
  reversible?: boolean;
  reversalDeadline?: Date;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  sessionId?: string;
  endpoint?: string;
  
  // Relations
  revertsActionId?: string; // If this reverses a prior action
  relatedLogIds?: string[];
}

class AuditLoggingService {
  // Log any admin action
  async logAction(dto: AuditLogDTO): Promise<AuditLog> {
    // 1. Validate DTO (all required fields present)
    // 2. Capture request metadata from context (IP, user agent, etc.)
    // 3. Calculate changed_fields if beforeState && afterState provided
    // 4. Store to audit_logs table
    // 5. Return logged entry
    // 6. Emit event for real-time alerting?
  }

  // Query actions by actor
  async getActorActionLog(
    actorId: string,
    filters?: {
      actionType?: string;
      since?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]>

  // Query actions affecting specific resource
  async getResourceActionLog(
    targetType: string,
    targetId: string,
    filters?: {
      since?: Date;
      limit?: number;
    }
  ): Promise<AuditLog[]>

  // Query all actions with flexible filtering
  async queryAuditLogs(filters: {
    actionType?: string[];
    actionCategory?: string[];
    targetType?: string[];
    targetId?: string;
    actorId?: string;
    result?: string;
    reversible?: boolean;
    sinceDate?: Date;
    untilDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: AuditLog[];
    total: number;
  }>

  // Get full action details (with state snapshots)
  async getActionDetails(logId: string): Promise<AuditLogDetails> {
    // Returns: log entry + before/after state + approval chain details
  }

  // Get reversal chain (this action + what it reversed + what reversed it)
  async getReversalChain(logId: string): Promise<{
    original: AuditLog;
    reversals: AuditLog[];
  }>

  // Statistics & reporting
  async getAuditStats(period: {
    since: Date;
    until: Date;
  }): Promise<{
    totalActions: number;
    byActionType: Record<string, number>;
    byActor: Record<string, number>;
    byResult: Record<string, number>;
    byCategory: Record<string, number>;
    successRate: number;
    failureRate: number;
  }>

  // Export audit logs for compliance/archival
  async exportAuditLogs(format: 'json' | 'csv', filters: any): Promise<Buffer>
}
```

### 2.3 Hook Audit Logging into Existing Services

**Update all existing admin services to call auditLoggingService:**

Files to update:
- `server/services/adminAuthService.ts` - Log permission checks
- `server/services/softDeleteService.ts` - Log all deletes & restores
- `server/routes/admin/admin-users.ts` - Log user management actions
- `server/routes/admin/admin-daos.ts` - Log DAO management actions
- `server/routes/admin/admin-agent-proposals.ts` - Log proposal approvals
- `server/routes/admin/admin-agents-kill-switch.ts` - Log kill-switch actions

**Example pattern in routes:**
```typescript
// In route handler
const result = await softDeleteService.softDeleteUser(userId, reason);

// Log the action
await auditLoggingService.logAction({
  actorId: adminUserId,
  actionType: 'soft_delete_user',
  targetType: 'user',
  targetId: userId,
  beforeState: originalUserState,
  afterState: { ...originalUserState, deleted_at: now, deleted_by: adminUserId },
  changedFields: ['deleted_at', 'deleted_by', 'delete_reason'],
  result: 'success',
  authority: 'admin',
  reversible: true,
  reversalDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});
```

---

## Part 3: Admin Dashboard & Recovery Interface (Afternoon, 3 Hours)

### 3.1 Admin Status Dashboard Endpoint

**Endpoint: `GET /api/admin/dashboard/status`**

```typescript
interface AdminDashboardStatus {
  // System Overview
  system: {
    timestamp: Date;
    status: 'healthy' | 'degraded' | 'critical';
  };
  
  // Agents Status
  agents: {
    total: number;
    active: number;
    paused: number;
    killSwitchActive: number;
    lastAction: {
      agentId: string;
      actionType: string;
      timestamp: Date;
      status: 'success' | 'failed';
    };
    alerting: {
      circuitBreakerTriggered: number;
      highRiskActions: number;
    };
  };
  
  // Admin Approvals Pending
  approvals: {
    pending: number;
    oldestPending: {
      actionId: string;
      actionType: string;
      initiatedAt: Date;
      hoursRemaining: number;
    };
    approved24h: number;
    rejected24h: number;
  };
  
  // Recovery Window Items
  recovery: {
    deletedUsers: number;
    oldestUserDeadline: Date;
    deletedDAOs: number;
    oldestDAODeadline: Date;
    expiredItemsCleanup: number; // Items ready to be permanently deleted
  };
  
  // Recent Audit Logs
  auditLogs: {
    last10: Array<{
      id: string;
      actionType: string;
      actor: { id: string; role: string };
      target: { type: string; id: string };
      timestamp: Date;
      result: 'success' | 'failed';
    }>;
    alertingActions: number; // High-risk actions in last 24h
  };
  
  // System Health
  health: {
    databaseConnected: boolean;
    authServiceOnline: boolean;
    auditLoggingOnline: boolean;
    lastHealthCheck: Date;
  };
}
```

**Response Example:**
```json
{
  "system": {
    "timestamp": "2026-02-13T14:30:00Z",
    "status": "healthy"
  },
  "agents": {
    "total": 7,
    "active": 6,
    "paused": 1,
    "killSwitchActive": 0,
    "lastAction": {
      "agentId": "agent_kaizen_01",
      "actionType": "swap",
      "timestamp": "2026-02-13T14:25:00Z",
      "status": "success"
    }
  },
  "approvals": {
    "pending": 2,
    "oldestPending": {
      "actionId": "action_123",
      "actionType": "delete_user",
      "initiatedAt": "2026-02-13T10:00:00Z",
      "hoursRemaining": 14
    }
  },
  "recovery": {
    "deletedUsers": 3,
    "oldestUserDeadline": "2026-03-15T10:00:00Z",
    "deletedDAOs": 1,
    "expiredItemsCleanup": 0
  },
  "auditLogs": {
    "last10": [
      {
        "id": "log_abc123",
        "actionType": "soft_delete_user",
        "actor": { "id": "admin_001", "role": "superuser" },
        "target": { "type": "user", "id": "user_456" },
        "timestamp": "2026-02-13T14:20:00Z",
        "result": "success"
      }
    ]
  },
  "health": {
    "databaseConnected": true,
    "authServiceOnline": true,
    "auditLoggingOnline": true,
    "lastHealthCheck": "2026-02-13T14:30:00Z"
  }
}
```

### 3.2 Admin Recovery Interface Endpoints

**Endpoint 1: `GET /api/admin/recovery/pending`**

Lists all users/DAOs in recovery window:

```typescript
interface RecoveryListItem {
  id: string;
  type: 'user' | 'dao';
  name: string;
  deletedAt: Date;
  deletedBy: {
    id: string;
    email: string;
    name: string;
  };
  deleteReason: string;
  recoveryDeadline: Date;
  daysRemaining: number;
  lastActivity?: Date;
  
  // Actions available
  canRestore: boolean;
  canForceDelete: boolean; // Only if deadline has passed
}
```

**Response:**
```json
{
  "users": [
    {
      "id": "user_001",
      "type": "user",
      "name": "alice@example.com",
      "deletedAt": "2026-02-10T15:30:00Z",
      "deletedBy": { "id": "admin_01", "email": "admin@example.com", "name": "Admin One" },
      "deleteReason": "User requested account deletion",
      "recoveryDeadline": "2026-03-12T15:30:00Z",
      "daysRemaining": 27,
      "canRestore": true,
      "canForceDelete": false
    }
  ],
  "daos": [
    {
      "id": "dao_xyz",
      "type": "dao",
      "name": "Test DAO",
      "deletedAt": "2026-02-05T10:00:00Z",
      "deletedBy": { "id": "admin_02", "email": "admin2@example.com", "name": "Admin Two" },
      "deleteReason": "DAO governance issue",
      "recoveryDeadline": "2026-03-07T10:00:00Z",
      "daysRemaining": 22,
      "canRestore": true,
      "canForceDelete": false
    }
  ],
  "expiredItems": [
    {
      "id": "user_old_001",
      "type": "user",
      "name": "old@example.com",
      "deletedAt": "2026-01-01T00:00:00Z",
      "recoveryDeadline": "2026-01-31T00:00:00Z",
      "daysRemaining": 0,
      "canRestore": false,
      "canForceDelete": true
    }
  ]
}
```

**Endpoint 2: `POST /api/admin/recovery/:targetId/restore`**

Restore a soft-deleted user or DAO:

```typescript
interface RestoreRequest {
  reason: string; // Required: why restoring? (min 20 chars)
}

interface RestoreResponse {
  success: boolean;
  target: {
    id: string;
    type: 'user' | 'dao';
    name: string;
  };
  restoredAt: Date;
  auditLogId: string;
  notification: {
    emailSent?: boolean;
    slackNotified?: boolean;
  };
}
```

**Error Responses:**
- `404` - Target not found or not soft-deleted
- `409` - Recovery deadline has passed (use force delete)
- `400` - Reason too short
- `403` - Insufficient permissions

**Endpoint 3: `POST /api/admin/recovery/:targetId/force-delete`**

Permanently delete an expired soft-deleted item (requires approval board):

```typescript
interface ForceDeleteRequest {
  reason: string; // Required
}

interface ForceDeleteResponse {
  success: boolean;
  target: {
    id: string;
    type: 'user' | 'dao';
  };
  actionId: string; // Approval board action ID
  approvalRequired: boolean;
  message: string; // "Permanent deletion queued for approval" or "Already approved"
}
```

### 3.3 Admin Audit Query Endpoints

**Endpoint: `GET /api/admin/audit-logs`**

Query audit logs with flexible filtering:

```typescript
interface AuditLogQuery {
  actionType?: string[]; // Filter by action type
  actionCategory?: string[]; // 'admin', 'governance', 'agent', 'system'
  targetType?: string[]; // 'user', 'dao', 'proposal', etc.
  targetId?: string; // Specific target ID
  actorId?: string; // Actions by specific admin
  result?: 'success' | 'failed';
  reversible?: boolean;
  since?: string; // ISO date
  until?: string; // ISO date
  limit?: number; // Default 50, max 1000
  offset?: number; // For pagination
}

interface AuditLogResponse {
  logs: Array<{
    id: string;
    actionType: string;
    actor: { id: string; role: string; email: string };
    target: { type: string; id: string; name: string };
    result: string;
    timestamp: Date;
    reversible: boolean;
    reversalDeadline?: Date;
  }>;
  total: number;
  hasMore: boolean;
}
```

**Endpoint: `GET /api/admin/audit-logs/:logId/details`**

Get full details of a specific audit log entry:

```typescript
interface AuditLogDetails {
  id: string;
  actionType: string;
  timestamp: Date;
  actor: {
    id: string;
    role: string;
    email: string;
  };
  target: {
    type: string;
    id: string;
    name: string;
  };
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  changedFields: string[];
  result: string;
  resultReason?: string;
  authority: string;
  approvalChain?: Array<{
    approverId: string;
    approvedAt: Date;
    status: 'approved' | 'rejected';
  }>;
  reversible: boolean;
  reversalDeadline?: Date;
  reversalAction?: {
    id: string;
    actorId: string;
    timestamp: Date;
    status: string;
  };
  metadata: {
    ipAddress: string;
    userAgent: string;
    sessionId: string;
    endpoint: string;
  };
}
```

**Endpoint: `GET /api/admin/users/:userId/audit-trail`**

All actions affecting a specific user:

```typescript
interface UserAuditTrail {
  userId: string;
  userName: string;
  totalActions: number;
  actions: Array<{
    id: string;
    actionType: string;
    actor: { id: string; role: string };
    timestamp: Date;
    changedFields: string[];
    beforeState: any;
    afterState: any;
  }>;
}
```

**Endpoint: `GET /api/admin/daos/:daoId/audit-trail`**

All actions affecting a specific DAO:

```typescript
interface DAOAuditTrail {
  daoId: string;
  daoName: string;
  totalActions: number;
  actions: Array<{
    id: string;
    actionType: string;
    actor: { id: string; role: string };
    timestamp: Date;
    changedFields: string[];
  }>;
}
```

---

## Frontend Components

### 3.4 Admin Recovery Dashboard Component

**File: `client/components/admin/AdminRecoveryDashboard.tsx`**

Features:
- List of soft-deleted users & DAOs with recovery deadline visual (progress bar)
- Filter by type (user/dao)
- Sort by deletion date, recovery deadline
- Restore button (with reason modal)
- Force delete button (if expired, requires approval)
- Search by name
- View deletion reason & admin who deleted

### 3.5 Audit Log Viewer Component

**File: `client/components/admin/AuditLogViewer.tsx`**

Features:
- Real-time audit log table (auto-refresh)
- Filter by action type, actor, target type
- Date range picker (since/until)
- Color-coded results (green=success, red=failed)
- Click to expand and see before/after state
- Click actor/target to see related logs
- Export to CSV
- Search by action type or target name

### 3.6 Admin Dashboard Component (Update)

**File: `client/components/admin/AdminDashboard.tsx`** (Enhancement)

Add to existing dashboard:
- Recovery window widget (users/daos pending deletion)
- Audit activity widget (recent actions, activity graph)
- System health widget (all services online?)
- Alert panel (any critical actions, expired items)

---

## Testing Strategy

### Unit Tests
- SoftDeleteService: delete, restore, recovery window logic
- AuditLoggingService: log creation, query, filtering
- Services must handle edge cases (already soft-deleted, expired deadline, etc.)

### Integration Tests
- End-to-end soft delete flow: delete user → verify soft deleted → restore → verify restored
- End-to-end audit logging: perform action → verify logged → query audit logs → verify details
- Approval board integration: soft delete requires approval → verify approval chain logged

### API Tests
- All endpoints test auth (403 if not superuser)
- All endpoints verify audit logging
- Recovery endpoints verify recovery deadline logic
- Query endpoints test filtering & pagination

---

## File Checklist

### Database Migrations
- [ ] `server/db/migrations/011-soft-delete-users-daos.ts` - Add deleted_at columns
- [ ] `server/db/migrations/012-audit-logging-comprehensive.ts` - Create audit_logs table

### Backend Services
- [ ] `server/services/softDeleteService.ts` - New service
- [ ] `server/services/auditLoggingService.ts` - New service
- [ ] Update `server/services/userService.ts` - Add deleted_at filters
- [ ] Update `server/services/daoService.ts` - Add deleted_at filters
- [ ] Update `server/services/adminAuthService.ts` - Log auth checks
- [ ] Update existing route files to call auditLoggingService

### API Routes
- [ ] `server/routes/admin/admin-recovery.ts` - New routes for recovery interface
- [ ] `server/routes/admin/admin-audit.ts` - New routes for audit queries
- [ ] `server/routes/admin/admin-dashboard.ts` - Status dashboard endpoint
- [ ] Update `server/routes/admin/admin-users.ts` - Add audit logging hooks
- [ ] Update `server/routes/admin/admin-daos.ts` - Add audit logging hooks

### Frontend Components
- [ ] `client/components/admin/AdminRecoveryDashboard.tsx` - Recovery interface
- [ ] `client/components/admin/AuditLogViewer.tsx` - Audit log viewer
- [ ] `client/components/admin/AdminDashboard.tsx` - Update with recovery + audit widgets
- [ ] CSS modules for new components

### Tests
- [ ] `tests/day3-soft-delete-and-audit-tests.ts` - Comprehensive test suite

---

## Power Checklist Compliance

Soft Delete implements:
- **#3 State Clarity**: Delete state is clear (deleted_at timestamp)
- **#4 Authority Transparency**: All deletes logged with actor info
- **#6 Intent Confirmation**: Restore requires explicit reason
- **#7 Reversibility**: 30-day recovery window
- **#8 Post-Action Narrative**: Audit logs provide full trail
- **#9 Emotional Safety**: Soft delete, not permanent destruction
- **#10 Distributed Verification**: Audit logs visible to all admins

---

## Success Criteria

✅ Users/DAOs cannot be permanently deleted immediately  
✅ 30-day recovery window active  
✅ All admin actions fully audited  
✅ Audit logs queryable with flexible filters  
✅ Recovery interface functional  
✅ All tested + deployed to dev  
✅ Integration with approval board verified

---

**Status:** 🟢 READY TO BUILD  
**Next:** Execute todo list tasks in order
