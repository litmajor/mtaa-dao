# Admin Operation Guide: Emergency Safeguards

**Status**: 🔴 ACTIVE - All Systems Live  
**Date**: February 13, 2026  
**Audience**: Superuser Admins (3+ required for sensitive operations)

---

## Quick Start

**If you need to...**
- **Stop an agent immediately**: [Jump to Kill-Switch](#quick-kill-switch)
- **Delete a user account**: [Jump to Approval Board](#approval-board-process)
- **Check system health**: [Jump to Dashboard](#admin-dashboard)
- **Restore a deleted user**: [Jump to Recovery](#recovery-process)
- **View who did what**: [Jump to Audit Logs](#audit-logging)

---

## Quick Kill-Switch 🔴

### Emergency Stop Agent Execution

**When to use**: Agent acting unexpectedly, excessive trading, security concern

```bash
# Activate kill-switch (superuser only)
curl -X POST https://api.mtaadao.com/api/admin/agents/{agentId}/kill-switch \
  -H "Authorization: Bearer ${SUPERUSER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Agent exceeded trading limits"
  }'

# Response: Agent immediately stops executing
{
  "agentId": "kaizen-agent",
  "status": "inactive",
  "killSwitchActivatedAt": "2026-02-13T10:35:22Z",
  "killSwitchReason": "Agent exceeded trading limits",
  "actionsTakenBefore": 18,
  "actionQueueCleared": true
}
```

### Check Agent Status

```bash
curl https://api.mtaadao.com/api/admin/agents/{agentId}/status \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# Response shows:
{
  "agentId": "kaizen-agent",
  "status": "inactive",  // or "active"
  "killSwitchActive": true,
  "killSwitchReason": "Circuit breaker triggered: 20+ actions/hour",
  "killSwitchActivatedAt": "2026-02-13T10:35:22Z",
  "lastActionAt": "2026-02-13T10:35:00Z",
  "actionCountThisHour": 20
}
```

### Reactivate Agent

```bash
# Requires 1 second superuser + 1 approval from another admin
curl -X POST https://api.mtaadao.com/api/admin/agents/{agentId}/reactivate \
  -H "Authorization: Bearer ${SUPERUSER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Reviewed logs, issue resolved. Ready to resume."
  }'

# Response: Agent reactivated with timestamp logged
{
  "agentId": "kaizen-agent",
  "status": "active",
  "reactivatedAt": "2026-02-13T10:40:00Z",
  "reactivatedBy": "superuser-1",
  "reason": "Reviewed logs, issue resolved"
}
```

---

## Approval Board Process 📋

### 2-of-3 Multi-Signature for Sensitive Actions

All destructive admin actions require **2-of-3 superuser approval**:
- User deletion
- DAO suspension
- Settings modification
- Fund transfers (>$10K)

### Step 1: Initiate Action

**Example: Delete User**

```bash
curl -X POST https://api.mtaadao.com/api/admin/users/{userId}/delete \
  -H "Authorization: Bearer ${SUPERUSER_1_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "User requested account termination"
  }'

# Response: Action created, waiting for approvals
{
  "actionId": "action-12345",
  "actionType": "user_delete",
  "targetId": "user-789",
  "initiatedBy": "superuser-1",
  "status": "pending_approval",
  "approvalsNeeded": 2,
  "approvalsReceived": 0,
  "expiresAt": "2026-02-14T10:40:00Z",  // 24 hour window
  "approvalLink": "https://admin.mtaadao.com/actions/action-12345/approve"
}
```

**Share this `actionId` with the other 2 superusers**

### Step 2: First Approval

**Superuser #2 approves:**

```bash
curl -X POST https://api.mtaadao.com/api/admin/actions/{actionId}/approve \
  -H "Authorization: Bearer ${SUPERUSER_2_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "0x1234567890abcdef..."  // Superuser 2's digital signature
  }'

# Response: First approval recorded
{
  "actionId": "action-12345",
  "status": "pending_approval",
  "approvalsNeeded": 2,
  "approvalsReceived": 1,
  "approvalChain": [
    {
      "approver": "superuser-2",
      "approvedAt": "2026-02-13T10:45:00Z",
      "signature": "0x1234567890abcdef..."
    }
  ],
  "message": "1/2 approvals received. Waiting for one more."
}
```

### Step 3: Final Approval

**Superuser #3 approves:**

```bash
curl -X POST https://api.mtaadao.com/api/admin/actions/{actionId}/approve \
  -H "Authorization: Bearer ${SUPERUSER_3_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "0x9876543210fedcba..."  // Superuser 3's digital signature
  }'

# Response: Action executes after 2 approvals
{
  "actionId": "action-12345",
  "status": "executed",
  "approvalsReceived": 2,
  "approvalChain": [
    {
      "approver": "superuser-2",
      "approvedAt": "2026-02-13T10:45:00Z",
      "signature": "0x1234567890abcdef..."
    },
    {
      "approver": "superuser-3",
      "approvedAt": "2026-02-13T10:48:00Z",
      "signature": "0x9876543210fedcba..."
    }
  ],
  "executedAt": "2026-02-13T10:48:05Z",
  "message": "Action executed with full approval chain."
}
```

### Check Pending Approvals

```bash
curl https://api.mtaadao.com/api/admin/actions/pending \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# Response: All actions waiting for approval
{
  "pendingActions": [
    {
      "actionId": "action-12345",
      "type": "user_delete",
      "target": "user-789",
      "initiatedBy": "superuser-1",
      "initiatedAt": "2026-02-13T10:40:00Z",
      "approvalsNeeded": 2,
      "approvalsReceived": 1,
      "expiresAt": "2026-02-14T10:40:00Z",
      "approvalLink": "https://admin.mtaadao.com/actions/action-12345/approve"
    }
  ]
}
```

### Reject Action

```bash
curl -X POST https://api.mtaadao.com/api/admin/actions/{actionId}/reject \
  -H "Authorization: Bearer ${SUPERUSER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Needs more investigation before deletion"
  }'

# Response: Action cancelled
{
  "actionId": "action-12345",
  "status": "rejected",
  "rejectedBy": "superuser-3",
  "rejectedAt": "2026-02-14T09:00:00Z",
  "reason": "Needs more investigation before deletion"
}
```

---

## Admin Dashboard 📊

### System Overall Health

```bash
curl https://api.mtaadao.com/api/admin/system-status \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# Response: Complete system picture
{
  "status": "healthy",
  "timestamp": "2026-02-13T10:50:00Z",
  "agents": {
    "total": 6,
    "active": 5,
    "inactive": 1,
    "killSwitchesActive": 1,
    "lastAgentActionAt": "2026-02-13T10:49:00Z"
  },
  "governance": {
    "proposalsActive": 3,
    "proposalsQueued": 1,
    "proposalsExecutingAt": "2026-02-15T14:00:00Z"
  },
  "approvals": {
    "pendingActions": 2,
    "oldestAction": "2026-02-13T08:00:00Z",
    "recentlyExecuted": "2026-02-13T10:48:00Z"
  },
  "auditLogs": {
    "actionsLast24h": 127,
    "anomaliesDetected": 0
  },
  "recovery": {
    "softDeletedUsers": 5,
    "softDeletedDAOs": 1,
    "itemsDueForPermanentDeletion": 0
  }
}
```

### Dashboard UI

Access at: https://admin.mtaadao.com/dashboard (requires 2FA + superuser login)

**Shows:**
- Agent status (with kill-switch indicators)
- Pending approvals (1-click approve/reject)
- Recent audit actions (searchable)
- Soft-deleted items awaiting recovery decision
- System health scores

---

## Recovery Process 🔄

### View Soft-Deleted Items

```bash
curl https://api.mtaadao.com/api/admin/recovery/pending \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# Response: All items in recovery window
{
  "items": [
    {
      "targetId": "user-789",
      "targetType": "user",
      "deletedAt": "2026-02-05T10:00:00Z",
      "deletedBy": "superuser-1",
      "deleteReason": "User requested termination",
      "recoveryDeadline": "2026-03-07T10:00:00Z",  // 30 days later
      "daysRemaining": 22,
      "canRestore": true,
      "canForceDelete": false
    }
  ]
}
```

### Restore Deleted User

```bash
curl -X POST https://api.mtaadao.com/api/admin/recovery/{targetId}/restore \
  -H "Authorization: Bearer ${SUPERUSER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "User requested reinstatement"
  }'

# Response: User immediately restored
{
  "targetId": "user-789",
  "status": "restored",
  "restoredAt": "2026-02-13T10:55:00Z",
  "restoredBy": "superuser-2",
  "reason": "User requested reinstatement"
}
```

### Force Delete (After Deadline)

```bash
curl -X POST https://api.mtaadao.com/api/admin/recovery/{targetId}/force-delete \
  -H "Authorization: Bearer ${SUPERUSER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Recovery deadline passed, authorized for permanent deletion"
  }'

# Response: User permanently deleted
{
  "targetId": "user-789",
  "status": "permanently_deleted",
  "deletedPermanentlyAt": "2026-02-13T10:56:00Z",
  "deletedPermanentlyBy": "superuser-1",
  "recoveryWindowClosed": true
}
```

---

## Audit Logging 🔍

### Query Audit Logs

```bash
# All logs about a specific user
curl "https://api.mtaadao.com/api/admin/audit-logs?targetId=user-789" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# Logs from last 7 days
curl "https://api.mtaadao.com/api/admin/audit-logs?since=7d" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# Logs of specific action type
curl "https://api.mtaadao.com/api/admin/audit-logs?actionType=user_deleted&since=30d" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# Response format
{
  "logs": [
    {
      "id": "audit-12345",
      "timestamp": "2026-02-13T10:48:00Z",
      "actor": {
        "id": "superuser-1",
        "type": "superuser",
        "ip": "192.168.1.100"
      },
      "action": "user_deleted",
      "target": {
        "type": "user",
        "id": "user-789",
        "summary": "john.doe@example.com"
      },
      "result": "success",
      "beforeState": { /* JSON snapshot */ },
      "afterState": { /* JSON snapshot */ },
      "approvalChain": [
        { "approver": "superuser-2", "approvedAt": "..." },
        { "approver": "superuser-3", "approvedAt": "..." }
      ],
      "reversible": true,
      "recoveryDeadline": "2026-03-07..."
    }
  ]
}
```

### Export Audit Trail

```bash
# Export as CSV for accountability report
curl "https://api.mtaadao.com/api/admin/audit-logs/export?format=csv&since=30d" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  > audit_report_jan2026.csv
```

---

## Common Tasks

### Task 1: User Requests Account Deletion

1. User submits deletion request in settings
2. Email alert sent to superusers
3. Superuser #1: `POST /api/admin/users/{userId}/delete`
4. Superuser #2: Approves via email link or `POST /api/admin/actions/{actionId}/approve`
5. Superuser #3: Approves with signature
6. User soft-deleted (recoverable for 30 days)
7. Audit log shows full approval chain

### Task 2: Agent Malfunction

1. Agent starts trading unexpectedly
2. Multiple concurrent transactions detected
3. Circuit breaker triggers after 21 actions/hour
4. Kill-switch auto-activates (no admin action needed)
5. Agent stops executing immediately
6. Alert sent to admin dashboard
7. Audit log records: `agent_circuit_breaker_triggered`
8. Admin reviews logs: `GET /api/admin/audit-logs?actionType=agent_circuit_breaker_triggered`

### Task 3: Governance Proposal Too Risky

1. Proposal created in governance system
2. Simulation shows it will concentrate voting power
3. DAO members see simulation failure in UI
4. Anyone can cancel: `POST /api/governance/{daoId}/proposals/{proposalId}/cancel`
5. Proposal removed from execution queue
6. Audit log records cancellation reason

### Task 4: Investigate Deleted User

1. Check if user was deleted: Query audit logs
2. See who deleted them: `deletedBy` field
3. See when: `timestamp` field
4. See why: `deleteReason` field
5. See approval chain: `approvalChain` field (who approved deletion)
6. Restore if needed: `POST /api/admin/recovery/{userId}/restore`

---

## Emergency Procedures

### If Approval Board Member Unavailable

Escalation steps:
1. Try contacting all 3 superusers (try again in 24 hours)
2. If 2 of 3 confirmed unavailable, use degraded mode:
   ```bash
   POST /api/admin/actions/{actionId}/degraded-mode
   {
     "reason": "Superuser(s) unreachable for 6+ hours",
     "available_approvers": ["superuser-1", "superuser-2"]
   }
   ```
3. Remaining 2 superusers can approve with escalation flag
4. Full audit trail shows degradation reason

### If Agent Kill-Switch Malfunctions

1. Manually deactivate agent:
   ```bash
   curl -X POST /api/admin/agents/{agentId}/deactivate \
     -H "Authorization: Bearer ${SUPERUSER_TOKEN}"
   ```
2. Review circuit breaker logs
3. Contact engineering team
4. Do NOT reactivate until root cause identified

### If Audit Logs Appear Tampered

1. PostgreSQL triggers prevent modification
2. Any attempted modification will fail
3. Report to security team immediately
4. Check backup database (immutable copy)

---

## FAQs

**Q: What if I delete something by accident?**  
A: No permanent deletion happens immediately. Everything is soft-deleted with a 30-day recovery window. Restore with: `POST /api/admin/recovery/{id}/restore`

**Q: Can I delete something immediately?**  
A: No. Design intentionally prevents immediate deletion. 30-day window is mandatory for safety. You can only force-delete after 30 days.

**Q: What if all 3 superusers disappear?**  
A: Escalation procedures activate. DAO can vote to add new superusers. Emergency mode allows approved core team members to take actions with super-majority vote.

**Q: Are all admin actions logged?**  
A: Yes. Every action, approval, and deletion is immutably logged in audit trail. Cannot be modified, only read.

**Q: Can users see what admins do?**  
A: Users can see if their own data was deleted (soft-delete) and the reason. Full admin actions audit trail is admin-only.

---

## Support

- **Dashboard**: https://admin.mtaadao.com/
- **Documentation**: https://docs.mtaadao.com/admin
- **Emergency** (24/7): support@mtaadao.com
- **On-Call**: See Slack #admin-oncall

