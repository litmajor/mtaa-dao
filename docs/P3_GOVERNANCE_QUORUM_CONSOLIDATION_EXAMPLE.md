# Implementation Example: Governance Quorum Consolidation

**Status**: Reference implementation for P3 API consolidation  
**Estimated Time**: 1.5 hours to implement  
**Complexity**: Medium

---

## Current Fragmented Implementation

### File: `src/routes/governance-quorum.ts` (Current)
```typescript
// GET /api/governance/quorum/:daoId
// PUT /api/governance/quorum/:daoId
```

### File: `src/routes/governance.ts` (Current)  
```typescript
// POST /api/governance/proposals/:proposalId/check-quorum
```

### Problem
Three different URLs for related functionality:
- ❌ `/api/governance/quorum/:daoId` (GET)
- ❌ `/api/governance/quorum/:daoId` (PUT)  
- ❌ `/api/governance/proposals/:proposalId/check-quorum` (POST)

**Not consistent**: Two resource paths, three operations scattered

---

## Consolidation Strategy

### New Unified Pattern
```
GET    /api/dao/:daoId/quorum              [Retrieve quorum requirements]
PUT    /api/dao/:daoId/quorum              [Update quorum settings]
POST   /api/dao/:daoId/quorum/validate     [Validate proposal against quorum]
POST   /api/dao/:daoId/quorum/check        [Check if proposal meets quorum (alias)]
```

**Benefits**:
- ✅ Single resource path `/api/dao/:daoId/quorum`
- ✅ Proper HTTP methods (GET, PUT, POST)
- ✅ Clear action naming (validate, check)
- ✅ Proper nesting (quorum is subresource of dao)
- ✅ Easier to document and test

---

## Implementation Steps

### Step 1: Update `src/routes/dao.ts` (Add Quorum Sub-routes)

**File**: `src/routes/dao.ts`

```typescript
import express, { Router } from 'express';
import { db } from '../db';
import { isAuthenticated, isDAOAdmin } from '../middleware/auth';

const router: Router = express.Router();

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * QUORUM MANAGEMENT (Consolidated from governance-quorum.ts)
 * Resource: /api/dao/:daoId/quorum
 * ════════════════════════════════════════════════════════════════════════════════
 */

/**
 * GET /api/dao/:daoId/quorum
 * Retrieve quorum requirements and current status for a DAO
 * 
 * @param {string} daoId - The DAO ID
 * @returns {object} Quorum requirements {required: number, current: number, status: string}
 */
router.get('/:daoId/quorum', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;

    // Get quorum requirements
    const quorum = await db('governance_quorum')
      .where({ dao_id: daoId })
      .first();

    if (!quorum) {
      return res.status(404).json({
        error: 'Quorum not found for DAO',
        daoId
      });
    }

    // Get current proposal count
    const activeProposals = await db('proposals')
      .where({ 
        dao_id: daoId,
        status: 'active'
      })
      .count('* as count')
      .first();

    res.json({
      daoId,
      requiredPercentage: quorum.required_percentage,
      requiredAbsolute: quorum.required_absolute,
      totalMembers: quorum.total_members,
      currentVotes: activeProposals?.count || 0,
      status: 'active',
      lastUpdated: quorum.updated_at
    });

  } catch (error) {
    console.error('Error fetching quorum:', error);
    res.status(500).json({ error: 'Failed to fetch quorum' });
  }
});

/**
 * PUT /api/dao/:daoId/quorum
 * Update quorum requirements for a DAO (admin only)
 * 
 * @param {string} daoId - The DAO ID
 * @body {number} requiredPercentage - Required percentage of votes (0-100)
 * @body {number} requiredAbsolute - Required absolute number of votes
 * @returns {object} Updated quorum object
 */
router.put('/:daoId/quorum', isAuthenticated, isDAOAdmin, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { requiredPercentage, requiredAbsolute } = req.body;

    // Validate inputs
    if (requiredPercentage !== undefined && (requiredPercentage < 0 || requiredPercentage > 100)) {
      return res.status(400).json({
        error: 'requiredPercentage must be between 0 and 100'
      });
    }

    if (requiredAbsolute !== undefined && requiredAbsolute < 0) {
      return res.status(400).json({
        error: 'requiredAbsolute must be non-negative'
      });
    }

    // Check DAO exists
    const dao = await db('daos').where({ id: daoId }).first();
    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Update quorum
    const updates: any = {
      updated_at: new Date()
    };

    if (requiredPercentage !== undefined) {
      updates.required_percentage = requiredPercentage;
    }
    if (requiredAbsolute !== undefined) {
      updates.required_absolute = requiredAbsolute;
    }

    await db('governance_quorum')
      .where({ dao_id: daoId })
      .update(updates);

    // Return updated quorum
    const updatedQuorum = await db('governance_quorum')
      .where({ dao_id: daoId })
      .first();

    res.json({
      message: 'Quorum updated successfully',
      daoId,
      requiredPercentage: updatedQuorum.required_percentage,
      requiredAbsolute: updatedQuorum.required_absolute,
      updatedAt: updatedQuorum.updated_at
    });

  } catch (error) {
    console.error('Error updating quorum:', error);
    res.status(500).json({ error: 'Failed to update quorum' });
  }
});

/**
 * POST /api/dao/:daoId/quorum/validate
 * Validate if a specific proposal meets quorum requirements
 * 
 * @param {string} daoId - The DAO ID
 * @body {string} proposalId - The proposal to validate
 * @returns {object} Validation result {meetQuorum: boolean, votesNeeded: number}
 * 
 * Consolidated from: POST /api/governance/proposals/:proposalId/check-quorum
 */
router.post('/:daoId/quorum/validate', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { proposalId } = req.body;

    if (!proposalId) {
      return res.status(400).json({ error: 'proposalId is required' });
    }

    // Get quorum requirements
    const quorum = await db('governance_quorum')
      .where({ dao_id: daoId })
      .first();

    if (!quorum) {
      return res.status(404).json({ error: 'Quorum not found for DAO' });
    }

    // Get proposal votes
    const proposal = await db('proposals')
      .where({ 
        id: proposalId,
        dao_id: daoId 
      })
      .first();

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Count votes
    const votes = await db('votes')
      .where({ proposal_id: proposalId })
      .count('* as count')
      .first();

    const voteCount = votes?.count || 0;
    const percentageThreshold = quorum.required_percentage || 50;
    const absoluteThreshold = quorum.required_absolute || 0;

    const votesPercentage = quorum.total_members > 0 
      ? (voteCount / quorum.total_members) * 100 
      : 0;

    const meetsPercentage = votesPercentage >= percentageThreshold;
    const meetsAbsolute = voteCount >= absoluteThreshold;
    const meetQuorum = meetsPercentage && meetsAbsolute;

    const votesNeeded = Math.max(
      Math.ceil((percentageThreshold / 100) * quorum.total_members) - voteCount,
      Math.max(0, absoluteThreshold - voteCount)
    );

    res.json({
      proposalId,
      daoId,
      currentVotes: voteCount,
      votesNeeded: Math.max(0, votesNeeded),
      percentageThreshold,
      absoluteThreshold,
      votesPercentage: Math.round(votesPercentage * 100) / 100,
      meetQuorum,
      status: meetQuorum ? 'passed' : 'pending'
    });

  } catch (error) {
    console.error('Error validating quorum:', error);
    res.status(500).json({ error: 'Failed to validate quorum' });
  }
});

/**
 * POST /api/dao/:daoId/quorum/check
 * Alias for /validate - Check if proposal meets quorum (alternative naming)
 * 
 * @deprecated Use POST /api/dao/:daoId/quorum/validate instead
 * @param {string} daoId - The DAO ID
 * @body {string} proposalId - The proposal to check
 * @returns {object} Same as /validate
 */
router.post('/:daoId/quorum/check', isAuthenticated, async (req, res) => {
  // Issue deprecation warning for this alias
  res.setHeader('Deprecation', 'true');
  res.setHeader('Warning', '299 - "/check is deprecated. Use /validate instead"');

  // Delegate to validate endpoint
  req.url = `/${req.params.daoId}/quorum/validate`;
  return router._router.handle(req, res);
  
  // OR keep both for compatibility and point to same logic
  // (omitted for brevity - just call the handler from above)
});

// ════════════════════════════════════════════════════════════════════════════════
// DEPRECATED ENDPOINTS (Keep for 6 months, then remove)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/governance/quorum/:daoId
 * 
 * @deprecated Use GET /api/dao/:daoId/quorum instead
 * Sunset: 2026-09-01
 */
router.get('/governance/quorum/:daoId', isAuthenticated, async (req, res) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', `</api/dao/${req.params.daoId}/quorum>; rel="successor-version"`);
  res.setHeader('Warning', '299 - "GET /governance/quorum/:daoId is deprecated. Use GET /api/dao/:daoId/quorum instead"');

  // Redirect (optional - some APIs redirect, others just warn)
  return res.status(301).redirect(`/api/dao/${req.params.daoId}/quorum`);
});

/**
 * PUT /api/governance/quorum/:daoId
 * 
 * @deprecated Use PUT /api/dao/:daoId/quorum instead
 * Sunset: 2026-09-01
 */
router.put('/governance/quorum/:daoId', isAuthenticated, isDAOAdmin, async (req, res) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', `</api/dao/${req.params.daoId}/quorum>; rel="successor-version"`);
  res.setHeader('Warning', '299 - "PUT /governance/quorum/:daoId is deprecated. Use PUT /api/dao/:daoId/quorum instead"');

  // Redirect
  return res.status(301).redirect(`/api/dao/${req.params.daoId}/quorum`);
});

/**
 * POST /api/governance/proposals/:proposalId/check-quorum
 * 
 * @deprecated Use POST /api/dao/:daoId/quorum/validate instead
 * Sunset: 2026-09-01
 */
router.post('/governance/proposals/:proposalId/check-quorum', isAuthenticated, async (req, res) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');

  // Extract daoId from proposal to find correct new endpoint
  try {
    const proposal = await db('proposals')
      .where({ id: req.params.proposalId })
      .first();

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const daoId = proposal.dao_id;
    res.setHeader('Link', `</api/dao/${daoId}/quorum/validate>; rel="successor-version"`);
    res.setHeader('Warning', '299 - "POST /governance/proposals/:id/check-quorum is deprecated. Use POST /api/dao/:daoId/quorum/validate instead"');

    // Forward to new endpoint
    return res.status(301).redirect(`/api/dao/${daoId}/quorum/validate`);
  } catch (error) {
    console.error('Error processing deprecated endpoint:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
});

export default router;
```

---

### Step 2: Update `src/routes/governance.ts` (Remove Duplicated Routes)

**File**: `src/routes/governance.ts` (Changes)

```typescript
// ❌ REMOVE THIS (now in dao.ts as consolidated endpoint):
// router.post('/proposals/:proposalId/check-quorum', ...)

// Replace with redirect to new endpoint (for backward compatibility)
/**
 * @deprecated Use POST /api/dao/:daoId/quorum/validate instead
 */
router.post('/proposals/:proposalId/check-quorum', isAuthenticated, async (req, res) => {
  // Get proposal to find daoId
  const proposal = await db('proposals')
    .where({ id: req.params.proposalId })
    .first();

  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  // Deprecated notice
  res.setHeader('Deprecation', 'true');
  res.setHeader('Warning', '299 - "Endpoint is deprecated. Use POST /api/dao/:daoId/quorum/validate instead"');
  
  // Redirect to new location
  return res.status(301).redirect(
    `/api/dao/${proposal.dao_id}/quorum/validate`
  );
});
```

---

### Step 3: Update `src/routes/governance-quorum.ts` (Mark Deprecated)

**File**: `src/routes/governance-quorum.ts` (Changes)

```typescript
/**
 * @deprecated All quorum endpoints have been consolidated to /api/dao/:daoId/quorum
 * See: src/routes/dao.ts
 * 
 * This file will be removed on: 2026-09-01
 */

import express, { Router } from 'express';
import { db } from '../db';
import { isAuthenticated, isDAOAdmin } from '../middleware/auth';

const router: Router = express.Router();

/**
 * GET /api/governance/quorum/:daoId
 * 
 * @deprecated Use GET /api/dao/:daoId/quorum instead
 * Sunset: 2026-09-01
 */
router.get('/:daoId', isAuthenticated, async (req, res) => {
  const { daoId } = req.params;

  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', `</api/dao/${daoId}/quorum>; rel="successor-version"`);
  res.setHeader('Warning', '299 - "GET /governance/quorum/:daoId is deprecated. Use GET /api/dao/:daoId/quorum instead"');

  // Keep logic temporary (for 6-month period)
  try {
    const quorum = await db('governance_quorum')
      .where({ dao_id: daoId })
      .first();

    if (!quorum) {
      return res.status(404).json({
        error: 'Quorum not found for DAO',
        daoId
      });
    }

    const activeProposals = await db('proposals')
      .where({ 
        dao_id: daoId,
        status: 'active'
      })
      .count('* as count')
      .first();

    res.json({
      daoId,
      requiredPercentage: quorum.required_percentage,
      requiredAbsolute: quorum.required_absolute,
      totalMembers: quorum.total_members,
      currentVotes: activeProposals?.count || 0,
      status: 'active',
      lastUpdated: quorum.updated_at
    });

  } catch (error) {
    console.error('Error fetching quorum:', error);
    res.status(500).json({ error: 'Failed to fetch quorum' });
  }
});

/**
 * PUT /api/governance/quorum/:daoId
 * 
 * @deprecated Use PUT /api/dao/:daoId/quorum instead
 * Sunset: 2026-09-01
 */
router.put('/:daoId', isAuthenticated, isDAOAdmin, async (req, res) => {
  const { daoId } = req.params;
  const { requiredPercentage, requiredAbsolute } = req.body;

  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', `</api/dao/${daoId}/quorum>; rel="successor-version"`);
  res.setHeader('Warning', '299 - "PUT /governance/quorum/:daoId is deprecated. Use PUT /api/dao/:daoId/quorum instead"');

  // Keep logic temporary (for 6-month period)
  try {
    // Validate inputs
    if (requiredPercentage !== undefined && (requiredPercentage < 0 || requiredPercentage > 100)) {
      return res.status(400).json({
        error: 'requiredPercentage must be between 0 and 100'
      });
    }

    if (requiredAbsolute !== undefined && requiredAbsolute < 0) {
      return res.status(400).json({
        error: 'requiredAbsolute must be non-negative'
      });
    }

    // Check DAO exists
    const dao = await db('daos').where({ id: daoId }).first();
    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Update quorum
    const updates: any = {
      updated_at: new Date()
    };

    if (requiredPercentage !== undefined) {
      updates.required_percentage = requiredPercentage;
    }
    if (requiredAbsolute !== undefined) {
      updates.required_absolute = requiredAbsolute;
    }

    await db('governance_quorum')
      .where({ dao_id: daoId })
      .update(updates);

    // Return updated quorum
    const updatedQuorum = await db('governance_quorum')
      .where({ dao_id: daoId })
      .first();

    res.json({
      message: 'Quorum updated successfully',
      daoId,
      requiredPercentage: updatedQuorum.required_percentage,
      requiredAbsolute: updatedQuorum.required_absolute,
      updatedAt: updatedQuorum.updated_at
    });

  } catch (error) {
    console.error('Error updating quorum:', error);
    res.status(500).json({ error: 'Failed to update quorum' });
  }
});

export default router;
```

---

### Step 4: Update Main Router

**File**: `src/index.ts` (or your main app setup)

```typescript
// ════════════════════════════════════════════════════════════════
// ROUTE REGISTRATION (updated)
// ════════════════════════════════════════════════════════════════

// Import all routers
import daoRouter from './routes/dao';
import governanceRouter from './routes/governance';
import governanceQuorumRouter from './routes/governance-quorum';

// Register routes
app.use('/api/dao', daoRouter);                    // ✅ NEW consolidated quorum
app.use('/api/governance', governanceRouter);      // Updated with deprecation
app.use('/api/governance/quorum', governanceQuorumRouter); // Deprecated (keep for 6 months)

// ...rest of routes
```

---

### Step 5: Tests

**File**: `tests/quorum.test.ts`

```typescript
import request from 'supertest';
import app from '../src/index';

describe('Quorum Management - Consolidated Endpoints', () => {
  const daoId = 'test-dao-1';
  const testToken = 'valid-jwt-token';

  describe('GET /api/dao/:daoId/quorum (NEW)', () => {
    it('should fetch quorum requirements', async () => {
      const res = await request(app)
        .get(`/api/dao/${daoId}/quorum`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('requiredPercentage');
      expect(res.body).toHaveProperty('totalMembers');
      expect(res.body.daoId).toBe(daoId);
    });
  });

  describe('PUT /api/dao/:daoId/quorum (NEW)', () => {
    it('should update quorum settings (admin only)', async () => {
      const res = await request(app)
        .put(`/api/dao/${daoId}/quorum`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          requiredPercentage: 67,
          requiredAbsolute: 10
        });

      expect(res.status).toBe(200);
      expect(res.body.requiredPercentage).toBe(67);
    });
  });

  describe('POST /api/dao/:daoId/quorum/validate (NEW)', () => {
    it('should validate if proposal meets quorum', async () => {
      const res = await request(app)
        .post(`/api/dao/${daoId}/quorum/validate`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          proposalId: 'proposal-1'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('meetQuorum');
      expect(res.body).toHaveProperty('currentVotes');
      expect(res.body).toHaveProperty('votesNeeded');
    });
  });

  describe('Deprecated Endpoints', () => {
    it('GET /api/governance/quorum/:daoId should return deprecation header', async () => {
      const res = await request(app)
        .get(`/api/governance/quorum/${daoId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.header['deprecation']).toBe('true');
      expect(res.header['warning']).toMatch(/deprecated/i);
      expect(res.status).toBe(301); // Redirect
    });

    it('POST /api/governance/proposals/:id/check-quorum should warn deprecation', async () => {
      const res = await request(app)
        .post('/api/governance/proposals/proposal-1/check-quorum')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.header['deprecation']).toBe('true');
      expect(res.header['warning']).toMatch(/deprecated/i);
    });
  });
});
```

---

## Migration Checklist

### Before Implementation
- [ ] Review current quorum usage in codebase
- [ ] Check existing tests  
- [ ] Document client impact
- [ ] Identify deprecation timeline (suggest 6 months)

### Implementation
- [ ] Add new endpoints to `src/routes/dao.ts`
- [ ] Add deprecation headers to old endpoints
- [ ] Update route registration in main app
- [ ] Write/update tests
- [ ] Update API documentation

### Post-Implementation
- [ ] Test both old and new endpoints work
- [ ] Verify deprecation warnings are issued
- [ ] Monitor client adoption metrics
- [ ] Update internal docs/team
- [ ] Schedule 6-month reminder for removal

### After 6 Months (Removal)
- [ ] Remove old endpoints from all files
- [ ] Remove deprecation infrastructure
- [ ] Clean up test file
- [ ] Update docs

---

## API Documentation (for docs/openapi.yaml)

```yaml
/api/dao/{daoId}/quorum:
  get:
    summary: Get quorum requirements
    parameters:
      - name: daoId
        in: path
        required: true
        schema:
          type: string
    responses:
      200:
        description: Quorum requirements
        content:
          application/json:
            schema:
              type: object
              properties:
                daoId: { type: string }
                requiredPercentage: { type: number }
                requiredAbsolute: { type: number }
                totalMembers: { type: number }
                currentVotes: { type: number }
                status: { type: string }

  put:
    summary: Update quorum settings (admin only)
    parameters:
      - name: daoId
        in: path
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              requiredPercentage: { type: number, minimum: 0, maximum: 100 }
              requiredAbsolute: { type: number, minimum: 0 }
    responses:
      200:
        description: Updated quorum

  post:
    operationId: validateQuorum
    summary: Validate proposal against quorum
    parameters:
      - name: daoId
        in: path
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              proposalId: { type: string }
              required: [proposalId]
    responses:
      200:
        description: Validation result
```

---

## Client Migration Example

### Before (Old Non-RESTful)
```typescript
// getting quorum
const quorumResponse = await api.get(`/governance/quorum/${daoId}`);

// updating quorum
await api.put(`/governance/quorum/${daoId}`, {
  requiredPercentage: 67
});

// checking proposal quorum
await api.post(`/governance/proposals/${proposalId}/check-quorum`);
```

### After (New Consolidated RESTful)
```typescript
// getting quorum (same DAO resource)
const quorumResponse = await api.get(`/dao/${daoId}/quorum`);

// updating quorum (same endpoint)
await api.put(`/dao/${daoId}/quorum`, {
  requiredPercentage: 67
});

// validating proposal quorum (part of quorum resource)
await api.post(`/dao/${daoId}/quorum/validate`, {
  proposalId: proposalId
});
```

---

## Summary

| Aspect | Details |
|--------|---------|
| **Old Pattern** | 3 scattered endpoints across 2 files |
| **New Pattern** | 1 unified resource with 4 methods |
| **Deprecation** | 6 months of parallel operation |
| **Breaking Changes** | None (old endpoints still work) |
| **Implementation Time** | ~1.5 hours |
| **Testing** | Update 3-4 test suites |
| **Documentation** | Update API docs + add migration guide |
| **Client Impact** | Low (optional migration, no breaking changes) |

