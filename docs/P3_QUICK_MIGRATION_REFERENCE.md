# P3 Non-RESTful Routes: Quick Migration Reference

**Purpose**: Quick reference for migrating remaining 23 routes  
**Template**: Use governance quorum example (P3_GOVERNANCE_QUORUM_CONSOLIDATION_EXAMPLE.md) as pattern  
**Effort**: ~3 hours total for all routes

---

## Quick Summary: 25 Routes to Consolidate

### Pattern 1: `/create` Suffix (11 routes)
Convert `POST /resource/create` → `POST /resource`

### Pattern 2: `/list` Suffix (4 routes)
Convert `GET /resource/list` → `GET /resource`

### Pattern 3: Other Verbs (4 routes)
Convert `POST /resource/verb` → appropriate method + resource

### Pattern 4: 3-way Governance Split (1 API task)
Already covered in detailed example above

---

## Pattern 1: `/create` Suffix Routes (11 routes)

**Strategy**: Replace `POST /resource/create` with `POST /resource`

### 1. Announcements - `/create`

**File**: `src/routes/announcements.ts`

```typescript
// ❌ OLD (deprecated, keep 6 months)
/**
 * @deprecated Use POST /api/announcements instead
 * Sunset: 2026-09-01
 */
router.post('/admin/create', isAuthenticated, isAdmin, (req, res) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Warning', '299 - "/admin/create is deprecated. Use POST /api/announcements instead"');
  // Keep logic...
});

// ✅ NEW (recommended)
/**
 * POST /api/announcements
 * Create a new announcement (admin only)
 */
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  const { title, content } = req.body;
  // Create logic
  res.json({ message: 'Announcement created', id: newId });
});
```

**Quick Details**:
- Create: `POST /api/announcements` with title, content
- Store: Announcements table
- Auth: Admin only
- Response: `{ id, title, content, createdAt }`

---

### 2. Bounty Escrow - `/create`

**File**: `src/routes/bounty-escrow.ts`

```typescript
// ❌ OLD
router.post('/create', isAuthenticated, (req, res) => {
  res.setHeader('Deprecation', 'true');
  // Keep logic...
});

// ✅ NEW
/**
 * POST /api/bounty-escrow
 * Create a new bounty escrow
 */
router.post('/', isAuthenticated, async (req, res) => {
  const { bountyId, amount, releaseCondition } = req.body;
  // Create logic
  res.json({ id: escrowId, status: 'pending' });
});
```

**Quick Details**:
- Create: `POST /api/bounty-escrow` with bountyId, amount, releaseCondition
- Store: Bounty escrow table
- Auth: Authenticated user
- Response: `{ id, bountyId, amount, status }`

---

### 3. Disbursements - `/create`

```typescript
// ✅ NEW
/**
 * POST /api/disbursements
 * Create a new disbursement
 */
router.post('/', isAuthenticated, async (req, res) => {
  const { payee, amount, reason } = req.body;
  // Create logic
  res.json({ id: disbursementId, status: 'pending' });
});
```

**Quick Details**:
- Create: `POST /api/disbursements` with payee, amount, reason
- Store: Disbursements table
- Auth: Authenticated user (or admin-only?)
- Response: `{ id, payee, amount, status, createdAt }`

---

### 4. Escrow - `/create`

```typescript
// ✅ NEW
/**
 * POST /api/escrow
 * Create a new escrow
 */
router.post('/', isAuthenticated, async (req, res) => {
  const { parties, amount, terms } = req.body;
  // Create logic
  res.json({ id: escrowId, status: 'active' });
});
```

---

### 5. Investment Pools - `/create`

```typescript
// ✅ NEW
/**
 * POST /api/investment-pools
 * Create a new investment pool
 */
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  const { name, strategy, minInvestment, maxInvestment } = req.body;
  // Create logic
  res.json({ id: poolId, status: 'pending' });
});
```

**Quick Details**:
- Create: `POST /api/investment-pools` with pool details
- Store: Investment pools table
- Auth: Admin only
- Response: `{ id, name, strategy, status, createdAt }`

---

### 6. Invoices - `/create`

```typescript
// ✅ NEW
/**
 * POST /api/invoices
 * Create a new invoice
 */
router.post('/', isAuthenticated, async (req, res) => {
  const { recipient, amount, items, dueDate } = req.body;
  // Create logic
  res.json({ id: invoiceId, status: 'draft' });
});
```

---

### 7. Strategies - `/create` (Two separate routers!)

**File**: `src/routes/strategies.ts` – handling `/api/strategies`

```typescript
// ✅ NEW
/**
 * POST /api/strategies
 * Create a new strategy
 */
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  const { name, rules, parameters } = req.body;
  // Create logic
  res.json({ id: strategyId, status: 'active' });
});
```

### 8. Strategy (singular) - `/create`

**File**: `src/routes/strategy.ts` – handling `/api/strategy` (note: singular)

```typescript
// ✅ NEW
/**
 * POST /api/strategy
 * Create a new strategy (singular endpoint variant)
 */
router.post('/', isAuthenticated, async (req, res) => {
  // Similar to strategies but different context
  const { name, rules } = req.body;
  res.json({ id: strategyId });
});
```

**Note**: Consolidate `/api/strategies` and `/api/strategy` into single resource if they do the same thing!

---

### 9. Tasks - `/create`

```typescript
// ✅ NEW
/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', isAuthenticated, async (req, res) => {
  const { title, description, assignee, priority } = req.body;
  // Create logic
  res.json({ id: taskId, status: 'open' });
});
```

---

### 10. Wallet - Multisig `/create`

**File**: `src/routes/wallet.ts` (sub-resource)

```typescript
// ❌ OLD
router.post('/multisig/create', isAuthenticated, (req, res) => {
  // ...
});

// ✅ NEW
/**
 * POST /api/wallet/multisig
 * Create a new multisig wallet
 */
router.post('/multisig', isAuthenticated, async (req, res) => {
  const { signers, threshold } = req.body;
  // Create logic
  res.json({ id: walletId, status: 'active' });
});
```

---

### 11. Wallet - Savings `/create`

```typescript
// ❌ OLD
router.post('/savings/create', isAuthenticated, (req, res) => {
  // ...
});

// ✅ NEW
/**
 * POST /api/wallet/savings
 * Create a new savings wallet
 */
router.post('/savings', isAuthenticated, async (req, res) => {
  const { strategy, initialAmount } = req.body;
  // Create logic
  res.json({ id: walletId, status: 'pending' });
});
```

---

## Pattern 2: `/list` Suffix Routes (4 routes)

**Strategy**: Replace `GET /resource/list` with `GET /resource`

### 1. Admin DAOs - `/list`

**File**: `src/routes/admin.ts`

```typescript
// ❌ OLD
router.get('/daos/list', isAuthenticated, isAdmin, (req, res) => {
  // ...
});

// ✅ NEW
/**
 * GET /api/admin/daos
 * List all DAOs (admin only)
 */
router.get('/daos', isAuthenticated, isAdmin, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const daos = await db('daos')
    .limit(limit)
    .offset(offset);
  
  res.json({ 
    data: daos,
    total: count,
    limit,
    offset
  });
});
```

---

### 2. Admin Users - `/list`

```typescript
// ✅ NEW
/**
 * GET /api/admin/users
 * List all users (admin only)
 */
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
  const { limit = 20, offset = 0, roleFilter } = req.query;
  
  let query = db('users');
  if (roleFilter) {
    query = query.where('role', roleFilter);
  }
  
  const users = await query
    .limit(limit)
    .offset(offset);
  
  res.json({ 
    data: users,
    total: count,
    limit,
    offset
  });
});
```

---

### 3. Announcements - Admin `/list`

**File**: `src/routes/announcements.ts`

```typescript
// ❌ OLD
router.get('/admin/list', isAuthenticated, isAdmin, (req, res) => {
  // ...
});

// ✅ NEW
/**
 * GET /api/announcements?isAdmin=true
 * OR
 * GET /api/announcements/admin
 * List announcements (admin gets full list)
 */
router.get('/', isAuthenticated, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const isAdmin = req.user.role === 'admin';
  
  let query = db('announcements');
  
  // Non-admin users only see published
  if (!isAdmin) {
    query = query.where('published', true);
  }
  
  const announcements = await query
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);
  
  res.json({ data: announcements, total: count });
});

// Alternative approach - separate admin endpoint
/**
 * GET /api/announcements/admin
 * List all announcements (admin only, includes drafts)
 */
router.get('/admin', isAuthenticated, isAdmin, async (req, res) => {
  // Return all announcements including drafts
  const announcements = await db('announcements')
    .orderBy('created_at', 'desc');
  
  res.json({ data: announcements });
});
```

---

### 4. Rebalancing - Active `/list`

**File**: `src/routes/rebalancing.ts`

```typescript
// ❌ OLD
router.get('/active/list', isAuthenticated, (req, res) => {
  // ...
});

// ✅ NEW
/**
 * GET /api/rebalancing/active
 * List active rebalancing operations
 */
router.get('/active', isAuthenticated, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  
  const active = await db('rebalancing_operations')
    .where('status', 'active')
    .limit(limit)
    .offset(offset);
  
  res.json({ 
    data: active,
    total: count,
    limit,
    offset
  });
});
```

---

## Pattern 3: Other Verb Suffixes (4 routes)

### 1. Profile - `/update-username`

**File**: `src/routes/profile.ts`

```typescript
// ❌ OLD
router.post('/update-username', isAuthenticated, (req, res) => {
  // ...
});

// ✅ NEW (two options)

// Option A: Sub-resource endpoint
/**
 * PUT /api/profile/username
 * Update user username
 */
router.put('/username', isAuthenticated, async (req, res) => {
  const { newUsername } = req.body;
  // Validate & update
  res.json({ username: newUsername });
});

// Option B: Profile with operation
/**
 * PATCH /api/profile
 * Update specific profile fields
 */
router.patch('/', isAuthenticated, async (req, res) => {
  const updates = req.body; // { username, email, bio, etc }
  // Validate & update
  res.json({ ...profile });
});
```

**Recommendation**: Use Option A for single-field updates, Option B for multi-field.

---

### 2. Webhook - `/delete`

**File**: `src/routes/webhooks.ts`

```typescript
// ❌ OLD
router.post('/delete', isAuthenticated, (req, res) => {
  const { webhookId } = req.body;
  // ...
});

// ✅ NEW
/**
 * DELETE /api/webhooks/:webhookId
 * Delete a webhook
 */
router.delete('/:webhookId', isAuthenticated, async (req, res) => {
  const { webhookId } = req.params;
  
  await db('webhooks')
    .where({ id: webhookId })
    .delete();
  
  res.json({ message: 'Webhook deleted' });
});
```

---

### 3. Transactions - `/remove`

**File**: `src/routes/transactions.ts`

```typescript
// ❌ OLD
router.post('/remove', isAuthenticated, (req, res) => {
  const { transactionId } = req.body;
  // ...
});

// ✅ NEW
/**
 * DELETE /api/transactions/:transactionId
 * Remove a transaction
 */
router.delete('/:transactionId', isAuthenticated, async (req, res) => {
  const { transactionId } = req.params;
  
  // Soft delete or hard delete?
  await db('transactions')
    .where({ id: transactionId })
    .update({ deleted_at: new Date() }); // Soft delete
  
  res.json({ message: 'Transaction removed' });
});
```

---

### 4. Strategies - `/:id/add`

**File**: `src/routes/strategies.ts`

```typescript
// ❌ OLD
router.post('/:id/add', isAuthenticated, (req, res) => {
  // Add something to a strategy (rule? parameter?)
  // ...
});

// ✅ NEW (context-dependent)

// If adding to a sub-collection:
/**
 * POST /api/strategies/:id/rules
 * Add a rule to a strategy
 */
router.post('/:id/rules', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { rule } = req.body;
  
  // Add rule to strategy
  const newRule = await db('strategy_rules')
    .insert({ strategy_id: id, ...rule });
  
  res.json({ message: 'Rule added', rule: newRule });
});

// Alternative: Nested sub-resource
/**
 * POST /api/strategies/:id/parameters
 * Add a parameter to a strategy
 */
router.post('/:id/parameters', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { parameter } = req.body;
  
  // Add parameter to strategy
  res.json({ message: 'Parameter added' });
});
```

**Note**: Without seeing the actual code, the specific resource being "added" is unclear. Review actual implementation and use appropriate sub-resource naming.

---

## Implementation Workflow

For each route, follow this template:

```typescript
/**
 * ════════════════════════════════════════════════════════════════
 * NEW RESTful ENDPOINT (RECOMMENDED)
 * ════════════════════════════════════════════════════════════════
 */

/**
 * [METHOD] /api/[resource]
 * [Description]
 * @param {type} param - Description
 * @returns {object} Response
 */
router.[method]('[path]', [middleware], async (req, res) => {
  try {
    // Implementation
    res.json({ result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * ════════════════════════════════════════════════════════════════
 * DEPRECATED ENDPOINT (REMOVE IN 6 MONTHS)
 * ════════════════════════════════════════════════════════════════
 */

/**
 * @deprecated Use [NEW_PATH] instead
 * Sunset: 2026-09-01
 */
router.[method]('[old-path]', [middleware], async (req, res) => {
  // Deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Warning', '299 - "[old-path] is deprecated. Use [new-path] instead"');
  
  // Keep logic for 6 months...
});
```

---

## Quick Effort Estimate

| Route Type | Routes | Per Route | Total |
|-----------|--------|-----------|-------|
| `/create` routes | 11 | 10 min | 110 min |
| `/list` routes | 4 | 8 min | 32 min |
| Other verbs | 4 | 12 min | 48 min |
| Consolidation (e.g. governance quorum) | 1 | 45 min | 45 min |
| Tests + docs | All | — | 30 min |
| **TOTAL** | **20** | — | **265 min (4.4 hrs)** |

---

## Checklist for Implementation

- [ ] Create new endpoints with proper HTTP methods
- [ ] Add deprecation headers to old endpoints
- [ ] Write tests for new endpoints
- [ ] Test backward compatibility (old routes still work)
- [ ] Update API documentation
- [ ] Update client SDKs
- [ ] Set Sunset header to 6 months from now
- [ ] Document migration path for API users
- [ ] Monitor deprecation metrics
- [ ] Schedule reminder for 6-month endpoint removal

---

## Testing Template

```typescript
describe('Migration: /create → POST /', () => {
  it('NEW endpoint: POST /api/resource should create', async () => {
    const res = await request(app)
      .post('/api/resource')
      .set('Authorization', `Bearer ${token}`)
      .send({ data });

    expect(res.status).toBe(200 | 201);
    expect(res.body).toHaveProperty('id');
  });

  it('OLD endpoint: POST /api/resource/create should warn deprecation', async () => {
    const res = await request(app)
      .post('/api/resource/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ data });

    expect(res.header['deprecation']).toBe('true');
    expect(res.header['sunset']).toBeDefined();
  });
});

describe('Migration: /list → GET /', () => {
  it('NEW endpoint: GET /api/resource should list', async () => {
    const res = await request(app)
      .get('/api/resource')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('OLD endpoint: GET /api/resource/list should warn', async () => {
    const res = await request(app)
      .get('/api/resource/list')
      .set('Authorization', `Bearer ${token}`);

    expect(res.header['deprecation']).toBe('true');
  });
});
```

---

## Documentation Template

```markdown
### [Resource Name]

**Current (Deprecated)**: `POST /api/resource/create`  
**New (Recommended)**: `POST /api/resource`  
**File**: `src/routes/resource.ts`  
**Auth**: [Authenticated|Admin only]  

**Request**:
```json
{
  "field1": "value",
  "field2": 123
}
```

**Response**:
```json
{
  "id": "new-id",
  "field1": "value",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

**Migration Status**: ✅ Ready to implement (6-month deprecation)  
**Sunset Date**: 2026-09-01
```

---

## Notes

1. **Order of Implementation**: Start with most-used routes (admin.ts /list endpoints, bounty-escrow/create)
2. **Testing**: Both old & new endpoints must work during 6-month deprecation
3. **Documentation**: Update OpenAPI/Swagger specs for new endpoints
4. **Client SDKs**: Update to use new endpoints
5. **Monitoring**: Track requests to deprecated endpoints
6. **Gradual Rollout**: No breaking changes during transition period

Good luck with the implementation! Use the governance quorum example as your template.

