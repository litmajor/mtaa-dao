# P3 `/create` Routes Implementation Plan

**Status**: Ready for implementation  
**Target Routes**: 11 endpoints (+ 1 in wallet sub-resources)  
**Approach**: Systematic batch implementation with deprecation headers  
**Timeline**: 2-3 hours for all routes  

---

## Audit Results

### ✅ Confirmed `/create` Routes in Codebase

| # | Route | File | Current Endpoint | New Endpoint | Status |
|---|-------|------|------------------|--------------|--------|
| 1 | Announcements | `announcements.ts` | `POST /api/announcements/admin/create` | `POST /api/announcements` | ✅ Found |
| 2 | Bounty Escrow | `bounty-escrow.ts` | `POST /api/bounty-escrow/create` | `POST /api/bounty-escrow` | ✅ Found |
| 3 | Disbursements | `disbursements.ts` | `POST /api/disbursements/create` | `POST /api/disbursements` | ✅ Found |
| 4 | Escrow | `escrow.ts` | `POST /api/escrow/create` | `POST /api/escrow` | ✅ To Verify |
| 5 | Investment Pools | `investment-pools.ts` | `POST /api/investment-pools/create` | `POST /api/investment-pools` | ✅ To Verify |
| 6 | Invoices | `invoices.ts` | `POST /api/invoices/create` | `POST /api/invoices` | ✅ To Verify |
| 7 | Strategies | `strategies.ts` | `POST /api/strategies/create` | `POST /api/strategies` | ✅ To Verify |
| 8 | Strategy (singular) | `strategy.ts` | `POST /api/strategy/create` | `POST /api/strategy` | ✅ To Verify |
| 9 | Tasks | `tasks.ts` | `POST /api/tasks/create` | `POST /api/tasks` | ✅ To Verify |
| 10 | Wallet - Multisig | `wallet.ts` | `POST /api/wallet/multisig/create` | `POST /api/wallet/multisig` | ✅ To Verify |
| 11 | Wallet - Savings | `wallet.ts` | `POST /api/wallet/savings/create` | `POST /api/wallet/savings` | ✅ To Verify |

---

## Implementation Strategy

### Step 1: Verify All Routes (5 minutes)
Search remaining routes to confirm they have `/create` endpoints

### Step 2: Create Implementation Batch
For each route file, we'll:
1. Add new `POST /` endpoint with same logic
2. Keep old `POST /create` with deprecation headers
3. No breaking changes - backward compatible

### Step 3: Test & Verify
Test both old and new endpoints work

### Step 4: Document Changes
Update API documentation

---

## Implementation Order (by Impact)

1. **High Priority** (Most Used):
   - `announcements.ts` - admin/create path
   - `bounty-escrow.ts` - common operation
   - `disbursements.ts` - financial operation
   - `wallet.ts` - two sub-routes

2. **Medium Priority**:
   - `escrow.ts`
   - `investment-pools.ts`
   - `invoices.ts`

3. **Lower Priority**:
   - `tasks.ts`
   - `strategy.ts` / `strategies.ts` (consolidate?)

---

## Code Template for Implementation

For each file, follow this pattern:

```typescript
// ════════════════════════════════════════════════════════════════════════
// NEW RESTful ENDPOINT (RECOMMENDED)
// ════════════════════════════════════════════════════════════════════════

/**
 * POST /api/[resource]
 * Create a new [resource]
 * @body {...fields...}
 * @returns {object}
 */
router.post('/', [middleware], async (req, res) => {
  try {
    const { /* fields */ } = req.body;
    
    // Validate
    if (!/* required */) {
      return res.status(400).json({ error: 'Required field missing' });
    }

    // Create
    const [newItem] = await db
      .insert(/* table */)
      .values({ /* data */ })
      .returning();

    res.json({  /* response */ });
  } catch (error) {
    logger.error('Error creating [resource]:', error);
    res.status(500).json({ error: 'Failed to create [resource]' });
  }
});

// ════════════════════════════════════════════════════════════════════════
// DEPRECATED ENDPOINT (KEEP FOR 6 MONTHS)
// ════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use POST /api/[resource] instead
 * Sunset: 2026-09-01
 */
router.post('/create', [middleware], async (req, res) => {
  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Warning', '299 - "POST /[resource]/create is deprecated. Use POST /[resource] instead"');

  // Keep exact same logic as above (or call shared handler)
  // ... existing implementation ...
});
```

---

## Next Steps

Ready to implement? Choose a route to start with:

1. **Start with `announcements.ts`** - Short, clear implementation, admin-only
2. **Start with `bounty-escrow.ts`** - Fundamental operation, frequently used
3. **Start with `disbursements.ts`** - Clear separation, financial domain
4. **Implement all at once** - Run all changes in parallel using multi-replace

Which would you prefer?

