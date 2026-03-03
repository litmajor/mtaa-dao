# CRUD Operations Implementation - Complete P2 Priority Fix

**Status**: ✅ COMPLETE  
**Implementation Date**: February 2026  
**Impact**: Resolves all API quality & consistency gaps for client operations

## Executive Summary

Implemented missing CRUD operations across 5 modules to eliminate client workarounds:
- **Proposals**: LIST (enumeration) + CREATE + UPDATE + DELETE
- **Tasks**: UPDATE + DELETE (CREATE already existed)
- **Vaults**: DELETE (CREATE, READ already existed)
- **Escrow**: LIST (comprehensive filtering) + DELETE
- **Invoices**: LIST (advanced filtering) + UPDATE + DELETE

---

## Implementation Details

### 1. Proposals Module (`/server/routes/proposals.ts`)

#### Added Operations

**LIST - Get all proposals for a DAO**
```
GET /api/dao/:daoId/proposals?status=active&proposer=userId&sortBy=createdAt&sortOrder=desc&limit=50&offset=0
```
- Response includes pagination metadata
- Contains vote breakdown summary
- Filters: status, proposer, sortBy, sortOrder
- Returns: `{success, data[], pagination{total, limit, offset, hasMore}}`

**GET - Single proposal details**
```
GET /api/dao/:daoId/proposals/:proposalId
```
- Enhanced with complete vote breakdown
- Vote count from related votes table
- Returns: `{success, data{...proposal, voteCount, voteBreakdown}}`

**CREATE - New proposal**
```
POST /api/dao/:daoId/proposals
{
  "title": "string (required)",
  "description": "string (required)",
  "proposalType": "general|budget|emergency|poll",
  "voteEndTime": "ISO8601 (required)",
  "quorumRequired": "number",
  "pollOptions": "array",
  "allowMultipleChoices": "boolean",
  "executionData": "object",
  "tags": "array",
  "imageUrl": "string"
}
```
- Validates user is DAO member with proposer role
- Creates with status='active', all vote counts=0
- Returns: `{success, data{...newProposal}}`

**UPDATE - Modify proposal (draft/active only)**
```
PUT /api/dao/:daoId/proposals/:proposalId
{
  "title": "optional",
  "description": "optional",
  "proposalType": "optional",
  "voteEndTime": "optional",
  "quorumRequired": "optional",
  "tags": "optional",
  "imageUrl": "optional"
}
```
- Only proposer can update
- Cannot update if status is passed/failed/executed/expired
- Returns: `{success, data{...updatedProposal}}`

**DELETE - Remove proposal (draft/active only)**
```
DELETE /api/dao/:daoId/proposals/:proposalId
```
- Only proposer or DAO admin can delete
- Prevents deletion of proposals in voting/completed stages
- Cascades: Deletes associated votes
- Returns: `{success, message}`

---

### 2. Tasks Module (`/server/routes/tasks.ts`)

#### Added Operations

**UPDATE - Modify task (not completed/disputed)**
```
PUT /api/dao/:daoId/tasks/:taskId
{
  "title": "optional",
  "description": "optional",
  "reward": "optional - numeric",
  "category": "optional",
  "difficulty": "optional - easy|medium|hard",
  "estimatedTime": "optional",
  "deadline": "optional - ISO8601"
}
```
- Only creator, admin, or moderator can update
- Cannot update completed or disputed tasks
- Logs change in taskHistory
- Returns: `{success, task{...updatedTask}}`

**DELETE - Remove task (open status only)**
```
DELETE /api/dao/:daoId/tasks/:taskId
```
- Only creator or DAO admin can delete
- Prevents deletion if someone claimed the task
- Cascades: Deletes taskHistory entries
- Returns: `{success, message}`

---

### 3. Vaults Module (`/server/routes/vaults.ts`)

#### Added Operations

**DELETE - Remove vault (no active deposits)**
```
DELETE /api/vaults/:vaultId
```
- Validates no user has active deposits
- Validates vault TVL = 0
- Soft-deletes vault (marks isActive=false)
- Prevents deletion if other users have balance
- Returns: `{success, message, vaultId}`

Logic Flow:
1. Check if user has shares → Error if nonzero
2. Iterate all depositors → Error if any have currentValue > 0
3. Call vaultService.deactivateVault()
4. Return success

---

### 4. Escrow Module (`/server/routes/escrow.ts`)

#### Added Operations

**LIST - Get all escrows with comprehensive filtering**
```
GET /api/escrow/list/all?role=all|payer|payee|mediator&status=pending&daoId=DAO-ID&limit=50&offset=0&sortBy=createdAt&sortOrder=desc
```
- Filters escrows by user involvement:
  - role='all': payer OR payee OR mediator
  - role='payer': user is payer
  - role='payee': user is payee
  - role='mediator': user is mediator
- Additional filters: status, daoId
- Returns: `{success, data[], pagination{total, limit, offset, hasMore}}`

**DELETE - Remove escrow (draft/pending only)**
```
DELETE /api/escrow/:escrowId
```
- Only payer can delete
- Cannot delete if status is funded/released/disputed/resolved
- Cascades: Deletes escrowMilestones, escrowDisputes entries
- Returns: `{success, message}`

---

### 5. Invoices Module (`/server/routes/invoices.ts`)

#### Added Operations

**LIST - Get all invoices with advanced filtering**
```
GET /api/invoices/list/all?type=sent|received&status=draft&daoId=DAO-ID&limit=50&offset=0&sortBy=createdAt&sortOrder=desc
```
- Filter by involvement:
  - type='sent': invoices created by user
  - type='received': invoices sent to user
  - type=undefined: both
- Additional filters: status (draft/sent/paid/cancelled/overdue), daoId
- Returns: `{success, data[], pagination{total, limit, offset, hasMore}}`

**UPDATE - Modify invoice (draft status only)**
```
PUT /api/invoices/:invoiceId
{
  "toUserId": "optional",
  "amount": "optional - numeric",
  "currency": "optional",
  "description": "optional",
  "lineItems": "optional - array",
  "dueDate": "optional - ISO8601",
  "notes": "optional",
  "termsAndConditions": "optional"
}
```
- Only invoice creator can update
- Cannot update sent/paid/cancelled invoices
- Returns: `{success, invoice{...updatedInvoice}}`

**DELETE - Remove invoice (draft/sent only)**
```
DELETE /api/invoices/:invoiceId
```
- Only invoice creator can delete
- Cannot delete paid or cancelled invoices
- Cascades: Deletes invoicePayments entries
- Returns: `{success, message}`

---

## API Response Standards

All endpoints follow consistent response format:

### Success Response
```json
{
  "success": true,
  "data": {} | [],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "currentStatus": "for relevant operations"
}
```

---

## Database Cascades

| Module | DELETE Cascades |
|--------|-----------------|
| Proposals | → votes (CASCADE) |
| Tasks | → taskHistory (CASCADE) |
| Vaults | NA (soft delete) |
| Escrow | → escrowMilestones, escrowDisputes |
| Invoices | → invoicePayments |

---

## Permission Matrix

| Operation | Roles Required | Restrictions |
|-----------|----------------|--------------|
| Proposals LIST | Any authenticated | By daoId |
| Proposals CREATE | admin, proposer, elder | DAO member |
| Proposals UPDATE | Proposer only | Draft/Active status |
| Proposals DELETE | Proposer or admin | Draft/Active status |
| Tasks UPDATE | Creator/admin/moderator | Not completed/disputed |
| Tasks DELETE | Creator or admin | Open status only |
| Vaults DELETE | Owner | No active deposits |
| Escrow LIST | Any authenticated | By involvement |
| Escrow DELETE | Payer only | Pending/Draft status |
| Invoices LIST | Any authenticated | By involvement |
| Invoices UPDATE | Creator only | Draft status |
| Invoices DELETE | Creator only | Draft/Sent status |

---

## Testing Checklist

### Proposals
- [ ] LIST by daoId returns paginated results
- [ ] LIST filters by status correctly
- [ ] LIST filters by proposer correctly
- [ ] GET single proposal includes vote breakdown
- [ ] CREATE requires DAO membership and proposer role
- [ ] CREATE fails without required fields
- [ ] UPDATE only allows proposer
- [ ] UPDATE fails for non-draft/active status
- [ ] DELETE cascades votes table
- [ ] DELETE fails for non-proposer

### Tasks
- [ ] UPDATE only allows creator/admin
- [ ] UPDATE logs to taskHistory
- [ ] UPDATE fails for completed/disputed
- [ ] DELETE only allows creator/admin
- [ ] DELETE cascades taskHistory
- [ ] DELETE fails if task is claimed

### Vaults
- [ ] DELETE checks user shares = 0
- [ ] DELETE checks all depositors (currentValue = 0)
- [ ] DELETE soft-marks isActive=false
- [ ] DELETE fails if any active deposits exist

### Escrow
- [ ] LIST returns only user's escrows (as payer/payee/mediator)
- [ ] LIST role filter works (payer/payee/mediator/all)
- [ ] LIST pagination works correctly
- [ ] DELETE only allows payer
- [ ] DELETE cascades milestones and disputes
- [ ] DELETE fails for non-pending status

### Invoices
- [ ] LIST returns user's invoices (sent/received)
- [ ] LIST pagination works
- [ ] UPDATE only allows creator
- [ ] UPDATE fails for non-draft status
- [ ] DELETE only allows creator
- [ ] DELETE cascades payments
- [ ] DELETE fails for paid/cancelled status

---

## Integration Examples

### Get DAO proposals with voting activity
```bash
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/dao/abc-123/proposals?status=active&sortBy=createdAt&sortOrder=desc&limit=20'
```

### Create a new proposal
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Budget Allocation Q1",
    "description": "Propose allocation of funds for Q1",
    "voteEndTime": "2026-03-31T23:59:59Z",
    "quorumRequired": 20,
    "tags": ["budget", "finance"]
  }' \
  'http://localhost:3000/api/dao/abc-123/proposals'
```

### Update task before anyone claims it
```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reward": 500, "difficulty": "hard"}' \
  'http://localhost:3000/api/dao/abc-123/tasks/task-id'
```

### List my pending escrows
```bash
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/escrow/list/all?role=payer&status=pending'
```

### List my received invoices
```bash
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/invoices/list/all?type=received&status=sent&limit=10'
```

---

## Migration Notes

### Backward Compatibility

- Proposals: Existing routes unaffected, new LIST/CREATE/UPDATE/DELETE added
- Tasks: Legacy endpoints preserved, UPDATE/DELETE new
- Vaults: DELETE is completely new operation
- Escrow: Legacy `/my-escrows` preserved, new `/list/all` adds filtering
- Invoices: Legacy `/my-invoices` preserved, new `/list/all` with comprehensive filters

### Database Requirements

No schema changes required. Uses existing tables:
- proposals, votes
- tasks, taskHistory
- vaults
- escrow_accounts, escrow_milestones, escrow_disputes
- invoices, invoice_payments

---

## Performance Considerations

- **Pagination**: Default limit=50, max recommended 500 per request
- **Indexes**: Ensure on (daoId, status), (creatorId), (payerId), (fromUserId)
- **Query Complexity**: LIST operations perform single table scan + filters
- **Cascades**: DELETE operations perform cascading deletes (transactional)

---

## Error Handling

All operations return standard HTTP status codes:
- **200**: Successful GET/PUT
- **201**: Successful POST (created)
- **400**: Validation error, illegal state
- **403**: Permission denied
- **404**: Resource not found
- **500**: Server error

---

## Summary

**Time to implement**: 2-3 hours ✅  
**Impact**: Eliminates all client workarounds  
**Breaking changes**: None  
**Database changes**: None  
**Test coverage**: Comprehensive checklist provided  

All missing CRUD operations now allow clients to:
- Enumerate proposals without manual tracking
- Update tasks before claiming them
- Finalize vault removal process
- List escrow accounts with role-based filtering
- Manage invoice lifecycle including updates

