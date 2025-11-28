# Week 1 Implementation Plan: Analyzer API Endpoints & Feature Flags

**Week:** November 24-30, 2025  
**Focus:** API Endpoints, Feature Flags, Integration Testing  
**Baseline:** selectProportional verification ✅ COMPLETE

---

## Overview

```
Week 0 (COMPLETE):
  ✅ selectProportional function implemented
  ✅ ContributionAnalyzer integration verified
  ✅ Fallback mechanisms validated

Week 1 (NEXT):
  → Add API endpoints (/api/analyzer/*)
  → Create feature flags (3 new flags)
  → Integration testing suite
  → Documentation & load testing
```

---

## Phase 1: API Endpoints (`/api/analyzer/*`)

### Endpoint 1: GET `/api/analyzer/contributions`

**Purpose:** Retrieve member contribution weights for a DAO

**File:** `server/routes/analyzer.ts` (add after line 169)

**Implementation:**
```typescript
// Get contribution weights for all members
router.get('/contributions/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { timeframe = '90d' } = req.query;

    // Verify user has access to this DAO
    const dao = await db.query.daos.findFirst({
      where: (daos, { eq }) => eq(daos.id, daoId)
    });

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get all approved members
    const members = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.status, 'approved'),
          eq(daoMemberships.isBanned, false)
        )
      );

    if (members.length === 0) {
      return res.json({
        success: true,
        data: {
          members: [],
          totalContributions: 0,
          period: timeframe,
          daoId
        }
      });
    }

    // Get contribution weights
    const { ContributionAnalyzer } = await import('../core/nuru/analytics/contribution_analyzer');
    const analyzer = new ContributionAnalyzer();
    const memberIds = members.map(m => m.userId || m.id);
    const weights = await analyzer.getContributionWeights(daoId, memberIds, timeframe as string);

    // Format response with member details
    const memberContributions = members.map(member => ({
      userId: member.userId || member.id,
      userName: member.userName || 'Unknown',
      weight: weights[member.userId || member.id] || 0,
      joinedAt: member.joinedAt,
      status: member.status
    })).sort((a, b) => b.weight - a.weight);

    const totalWeight = memberContributions.reduce((sum, m) => sum + m.weight, 0);

    res.json({
      success: true,
      data: {
        members: memberContributions,
        totalContributions: totalWeight,
        period: timeframe,
        daoId,
        averageWeight: totalWeight / members.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error fetching contribution weights', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Request:**
```bash
GET /api/analyzer/contributions/dao-123?timeframe=90d
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "userId": "user-001",
        "userName": "Alice",
        "weight": 3.5,
        "joinedAt": "2025-11-01",
        "status": "approved"
      },
      {
        "userId": "user-002",
        "userName": "Bob",
        "weight": 2.1,
        "joinedAt": "2025-11-05",
        "status": "approved"
      }
    ],
    "totalContributions": 5.6,
    "averageWeight": 2.8,
    "period": "90d",
    "daoId": "dao-123",
    "timestamp": "2025-11-24T10:30:00Z"
  }
}
```

---

### Endpoint 2: POST `/api/analyzer/proportional/select`

**Purpose:** Execute proportional selection and return selected member

**File:** `server/routes/analyzer.ts` (add after Endpoint 1)

**Implementation:**
```typescript
// Execute proportional selection
router.post('/proportional/select/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;

    // Verify DAO exists
    const dao = await db.query.daos.findFirst({
      where: (daos, { eq }) => eq(daos.id, daoId)
    });

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Import rotation service
    const { selectRotationRecipient, RotationSelectionMethod } = await import('../api/rotation_service');

    // Execute proportional selection
    const selectedUserId = await selectRotationRecipient(
      daoId,
      RotationSelectionMethod.PROPORTIONAL
    );

    // Get selected member details
    const selectedMember = await db.query.daoMemberships.findFirst({
      where: (members, { and, eq }) => and(
        eq(members.daoId, daoId),
        eq(members.userId, selectedUserId)
      )
    });

    // Get weights for probability calculation
    const { ContributionAnalyzer } = await import('../core/nuru/analytics/contribution_analyzer');
    const analyzer = new ContributionAnalyzer();
    const allMembers = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.status, 'approved'),
          eq(daoMemberships.isBanned, false)
        )
      );

    const memberIds = allMembers.map(m => m.userId || m.id);
    const weights = await analyzer.getContributionWeights(daoId, memberIds, '90d');
    const selectedWeight = weights[selectedUserId] || 1;
    const totalWeight = Object.values(weights).reduce((a: number, b: any) => a + (b as number), 0);
    const probability = (selectedWeight / totalWeight) * 100;

    res.json({
      success: true,
      data: {
        selectedUserId,
        selectedMember: {
          userId: selectedMember?.userId,
          userName: selectedMember?.userName,
          joinedAt: selectedMember?.joinedAt
        },
        weight: selectedWeight,
        probabilityOfSelection: probability.toFixed(2) + '%',
        totalContestants: allMembers.length,
        selectionMethod: 'proportional',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in proportional selection', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Request:**
```bash
POST /api/analyzer/proportional/select/dao-123
Authorization: Bearer {token}
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "data": {
    "selectedUserId": "user-001",
    "selectedMember": {
      "userId": "user-001",
      "userName": "Alice",
      "joinedAt": "2025-11-01"
    },
    "weight": 3.5,
    "probabilityOfSelection": "62.5%",
    "totalContestants": 2,
    "selectionMethod": "proportional",
    "timestamp": "2025-11-24T10:35:00Z"
  }
}
```

---

### Endpoint 3: GET `/api/analyzer/rotation/history`

**Purpose:** Retrieve rotation history and current cycle info

**File:** `server/routes/analyzer.ts` (add after Endpoint 2)

**Implementation:**
```typescript
// Get rotation history
router.get('/rotation/history/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { limit = '50' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 50, 500);

    // Verify DAO exists
    const dao = await db.query.daos.findFirst({
      where: (daos, { eq }) => eq(daos.id, daoId)
    });

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get rotation cycles
    const cycles = await db.query.daoRotationCycles.findMany({
      where: (cycles, { eq }) => eq(cycles.daoId, daoId),
      limit: limitNum,
      orderBy: (cycles, { desc }) => desc(cycles.cycleNumber)
    });

    // Get current cycle details
    const currentCycle = cycles[0] || null;

    // Get next potential recipient using proportional selection
    const { selectRotationRecipient, RotationSelectionMethod } = await import('../api/rotation_service');
    let nextRecipient = null;
    try {
      nextRecipient = await selectRotationRecipient(
        daoId,
        RotationSelectionMethod.PROPORTIONAL
      );
    } catch (e) {
      // Silently fail if cannot determine next recipient
      logger.warn(`Could not determine next recipient for DAO ${daoId}`, e);
    }

    res.json({
      success: true,
      data: {
        daoId,
        currentCycleNumber: dao.currentRotationCycle || 0,
        currentCycle: currentCycle ? {
          cycleNumber: currentCycle.cycleNumber,
          recipientId: currentCycle.recipientId,
          amountDistributed: currentCycle.amountDistributed,
          distributedAt: currentCycle.distributedAt,
          method: currentCycle.selectionMethod
        } : null,
        nextRecipientUserId: nextRecipient,
        recentCycles: cycles.slice(0, 10).map(cycle => ({
          cycleNumber: cycle.cycleNumber,
          recipientId: cycle.recipientId,
          amountDistributed: cycle.amountDistributed,
          distributedAt: cycle.distributedAt,
          method: cycle.selectionMethod
        })),
        totalCycles: cycles.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error fetching rotation history', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Request:**
```bash
GET /api/analyzer/rotation/history/dao-123?limit=20
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "daoId": "dao-123",
    "currentCycleNumber": 5,
    "currentCycle": {
      "cycleNumber": 5,
      "recipientId": "user-001",
      "amountDistributed": 1000,
      "distributedAt": "2025-11-23T14:00:00Z",
      "method": "proportional"
    },
    "nextRecipientUserId": "user-002",
    "recentCycles": [
      {
        "cycleNumber": 5,
        "recipientId": "user-001",
        "amountDistributed": 1000,
        "distributedAt": "2025-11-23T14:00:00Z",
        "method": "proportional"
      }
    ],
    "totalCycles": 5,
    "timestamp": "2025-11-24T10:40:00Z"
  }
}
```

---

### Endpoint 4: POST `/api/analyzer/rotation/cycle`

**Purpose:** Process next rotation cycle and distribute funds

**File:** `server/routes/analyzer.ts` (add after Endpoint 3)

**Implementation:**
```typescript
// Process rotation cycle
router.post('/rotation/cycle/:daoId', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { method = 'proportional' } = req.body;

    // Verify DAO exists
    const dao = await db.query.daos.findFirst({
      where: (daos, { eq }) => eq(daos.id, daoId)
    });

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Verify user has permission to process rotation
    const userSession = await getSession({ req });
    if (!userSession) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Add permission check (only DAO admin can process rotation)

    // Import rotation service
    const { selectRotationRecipient, RotationSelectionMethod, processRotation } = await import('../api/rotation_service');

    // Map method string to enum
    let rotationMethod: RotationSelectionMethod;
    switch (method.toLowerCase()) {
      case 'sequential':
        rotationMethod = RotationSelectionMethod.SEQUENTIAL;
        break;
      case 'lottery':
        rotationMethod = RotationSelectionMethod.LOTTERY;
        break;
      case 'proportional':
      default:
        rotationMethod = RotationSelectionMethod.PROPORTIONAL;
    }

    // Execute rotation
    const result = await processRotation(daoId, rotationMethod);

    res.json({
      success: true,
      data: {
        cycleNumber: result.cycleNumber,
        selectedRecipient: result.recipientId,
        amountDistributed: result.amountToReceive,
        method: method,
        distributedAt: result.distributedAt,
        daoId,
        transactionHash: result.transactionHash || null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error processing rotation cycle', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Request:**
```bash
POST /api/analyzer/rotation/cycle/dao-123
Authorization: Bearer {token}
Content-Type: application/json

{
  "method": "proportional"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cycleNumber": 6,
    "selectedRecipient": "user-002",
    "amountDistributed": 1000,
    "method": "proportional",
    "distributedAt": "2025-11-24T11:00:00Z",
    "daoId": "dao-123",
    "transactionHash": "0x123abc...",
    "timestamp": "2025-11-24T11:00:00Z"
  }
}
```

---

## Phase 2: Feature Flags

### New Flags to Add

**File:** `server/services/featureService.ts`  
**Location:** After line 460 (after 'analytics.analyzer')

**Add these three flags:**

```typescript
// ========== ANALYZER ROTATION FEATURES (3 Features) ==========
'analytics.proportionalSelection': {
  name: 'Proportional Member Selection',
  enabled: getEnvBoolean('FEATURE_PROPORTIONAL_SELECTION', true),
  releaseDate: '2025-11-30',
  phase: 3,
  description: 'Weighted member selection based on 90-day contributions',
  category: 'analytics',
  dependencies: ['analytics.analyzer'],
},

'analytics.contributionWeights': {
  name: 'Contribution Weights',
  enabled: getEnvBoolean('FEATURE_ANALYZER_CONTRIBUTIONS', true),
  releaseDate: '2025-11-30',
  phase: 3,
  description: 'Retrieve and display member contribution metrics',
  category: 'analytics',
  dependencies: ['analytics.analyzer'],
},

'analytics.rotationManagement': {
  name: 'Rotation Management',
  enabled: getEnvBoolean('FEATURE_ANALYZER_ROTATION', true),
  releaseDate: '2025-11-30',
  phase: 3,
  description: 'DAO rotation cycle management and history tracking',
  category: 'analytics',
  dependencies: ['analytics.proportionalSelection', 'analytics.contributionWeights'],
},
```

### Environment Variables

**Add to `.env`:**
```env
# Analyzer Rotation Features (Week 1)
FEATURE_PROPORTIONAL_SELECTION=true
FEATURE_ANALYZER_CONTRIBUTIONS=true
FEATURE_ANALYZER_ROTATION=true
```

**Add to `.env.phases`:**
```env
# Phase 3: Analyzer Rotation (Nov 30, 2025)
FEATURE_PROPORTIONAL_SELECTION=false  # Enable Nov 30
FEATURE_ANALYZER_CONTRIBUTIONS=false  # Enable Nov 30
FEATURE_ANALYZER_ROTATION=false       # Enable Nov 30
```

### Feature Flag Usage in Routes

**Update `server/routes/analyzer.ts` to check flags:**

```typescript
// At the top of each route, add:
import { featureService } from '../services/featureService';

// Before processing, verify feature is enabled:
router.get('/contributions/:daoId', isAuthenticated, async (req, res) => {
  // Check if feature is enabled
  if (!featureService.isFeatureEnabled('analytics.contributionWeights')) {
    return res.status(403).json({ 
      error: 'Feature not available',
      feature: 'analytics.contributionWeights'
    });
  }
  
  // ... rest of implementation
});
```

---

## Phase 3: Integration Testing

### Test File Structure

**File:** `server/tests/rotation_proportional.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../db';
import { daoMemberships, daos } from '../../shared/schema';
import { selectRotationRecipient, RotationSelectionMethod } from '../api/rotation_service';
import { ContributionAnalyzer } from '../core/nuru/analytics/contribution_analyzer';

describe('Proportional Selection Integration', () => {
  const testDaoId = 'test-dao-' + Date.now();
  const testMemberIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

  beforeAll(async () => {
    // Setup: Create test DAO
    // Setup: Create test members
    // Setup: Create sample contribution data
  });

  afterAll(async () => {
    // Cleanup: Remove test data
  });

  describe('Weighted Selection Algorithm', () => {
    it('should select members proportional to weights', async () => {
      // Mock: Set weights [1, 1, 1, 1, 10] (last member 50% chance)
      // Run: 100 selections
      // Assert: Last member selected ~50 times
      expect(results.distribution[4]).toBeGreaterThan(40);
      expect(results.distribution[4]).toBeLessThan(60);
    });

    it('should handle equal weights evenly', async () => {
      // Mock: All weights = 1
      // Run: 100 selections
      // Assert: Each member selected ~20 times
      for (const count of results.distribution) {
        expect(count).toBeGreaterThan(10);
        expect(count).toBeLessThan(30);
      }
    });

    it('should select single member correctly', async () => {
      // Arrange: Single member in DAO
      // Act: Select 10 times
      // Assert: Same member selected every time
      expect(new Set(results).size).toBe(1);
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should fallback to random when no contributions exist', async () => {
      // Mock: Zero contribution weights
      // Act: Call selectProportional
      // Assert: Returns valid member without error
      const result = await selectRotationRecipient(testDaoId, RotationSelectionMethod.PROPORTIONAL);
      expect(testMemberIds).toContain(result);
    });

    it('should fallback on ContributionAnalyzer error', async () => {
      // Mock: ContributionAnalyzer.getContributionWeights throws
      // Act: Call selectProportional
      // Assert: Still returns valid member
      const result = await selectRotationRecipient(testDaoId, RotationSelectionMethod.PROPORTIONAL);
      expect(testMemberIds).toContain(result);
    });

    it('should handle empty member list gracefully', async () => {
      // Arrange: DAO with no approved members
      // Act: Call selectProportional
      // Assert: Throws error with clear message
      await expect(() => selectProportional(testDaoId, [])).rejects.toThrow('No eligible members');
    });
  });

  describe('API Endpoint Integration', () => {
    it('GET /api/analyzer/contributions should return weights', async () => {
      // Act: Call endpoint
      // Assert: Response includes all members and weights
      expect(response.data.members.length).toBe(5);
      expect(response.data.totalContributions).toBeGreaterThan(0);
    });

    it('POST /api/analyzer/proportional/select should execute selection', async () => {
      // Act: Call endpoint
      // Assert: Response includes selected user and probability
      expect(response.data.selectedUserId).toBeDefined();
      expect(response.data.probabilityOfSelection).toBeDefined();
    });

    it('GET /api/analyzer/rotation/history should return cycles', async () => {
      // Act: Call endpoint
      // Assert: Response includes cycle history
      expect(response.data.currentCycleNumber).toBeDefined();
      expect(Array.isArray(response.data.recentCycles)).toBe(true);
    });

    it('POST /api/analyzer/rotation/cycle should process new cycle', async () => {
      // Act: Call endpoint with method=proportional
      // Assert: Returns new cycle with recipient
      expect(response.data.cycleNumber).toBeGreaterThan(previousCycle);
      expect(response.data.selectedRecipient).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent DAO', async () => {
      // Act: Call endpoint with invalid daoId
      // Assert: Returns 404 error
      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Act: Call endpoint without auth token
      // Assert: Returns 401 error
      expect(response.status).toBe(401);
    });

    it('should validate input parameters', async () => {
      // Act: Call with invalid timeframe
      // Assert: Returns 400 error or uses default
      expect(['90d', '30d', '7d']).toContain(response.data.period);
    });
  });

  describe('Performance', () => {
    it('should select member within 100ms for 1000 members', async () => {
      // Arrange: DAO with 1000 members
      // Act: Select 5 times
      // Assert: All selections complete within 100ms
      for (const duration of durations) {
        expect(duration).toBeLessThan(100);
      }
    });

    it('should fetch contributions within 500ms', async () => {
      // Act: Call contributions endpoint
      // Assert: Response time < 500ms
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Security', () => {
    it('should exclude banned members from selection', async () => {
      // Arrange: Ban one member
      // Act: Select 100 times
      // Assert: Banned member never selected
      expect(results).not.toContain(bannedMemberId);
    });

    it('should exclude unapproved members', async () => {
      // Arrange: Add unapproved member
      // Act: Select 100 times
      // Assert: Unapproved member never selected
      expect(results).not.toContain(unapprovedMemberId);
    });

    it('should verify DAO access permissions', async () => {
      // Arrange: User from different org
      // Act: Try to access other DAO
      // Assert: Returns 403 forbidden
      expect(response.status).toBe(403);
    });
  });
});
```

### Test Coverage Matrix

| Component | Test Cases | Expected |
|-----------|-----------|----------|
| Weighted Algorithm | 3 | ✅ |
| Fallback Mechanisms | 3 | ✅ |
| API Endpoints | 4 | ✅ |
| Error Handling | 3 | ✅ |
| Performance | 2 | ✅ |
| Security | 3 | ✅ |
| **Total** | **18** | **✅** |

---

## Week 1 Schedule

| Day | Task | Owner | Status |
|-----|------|-------|--------|
| **Mon (11/24)** | Add feature flags to featureService.ts | Dev | ⏳ |
| **Tue (11/25)** | Create API Endpoints 1-2 (contributions, select) | Dev | ⏳ |
| **Wed (11/26)** | Create API Endpoints 3-4 (history, cycle) | Dev | ⏳ |
| **Thu (11/27)** | Write integration tests | QA | ⏳ |
| **Fri (11/28)** | Load testing & documentation | Dev/QA | ⏳ |

---

## Verification Checklist (Week 1)

- [ ] Feature flags added to featureService.ts
- [ ] 4 API endpoints created and tested
- [ ] Environment variables configured
- [ ] Feature flag checks added to all routes
- [ ] 18 integration tests written and passing
- [ ] API documentation updated
- [ ] Load testing completed
- [ ] Error handling verified
- [ ] Security review completed
- [ ] Code merged to main branch

---

## Success Criteria

✅ **API Endpoints:**
- All 4 endpoints functional and tested
- Response times < 500ms
- Proper error handling on all edge cases
- Feature flags gating all endpoints

✅ **Feature Flags:**
- 3 new flags integrated
- Flags control endpoint availability
- Proper dependencies between flags
- Can toggle on/off without errors

✅ **Integration Tests:**
- 18 test cases passing
- Code coverage > 90%
- Performance benchmarks established
- Security validated

✅ **Documentation:**
- API docs updated with examples
- Feature flag guide created
- Integration testing guide written
- Deployment checklist updated

---

Generated: November 23, 2025
Ready for Week 1 Implementation
