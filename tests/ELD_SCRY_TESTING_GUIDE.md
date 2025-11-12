# ELD-SCRY Testing & Validation Guide

## Overview

Complete testing strategy for ELD-SCRY threat detection system, including unit tests, integration tests, and end-to-end validation.

---

## Test Structure

```
tests/
├── unit/
│   ├── surveillance-engine.test.ts
│   ├── threat-predictor.test.ts
│   └── scry-elder.test.ts
├── integration/
│   ├── scry-api.test.ts
│   ├── scry-messages.test.ts
│   └── scry-database.test.ts
└── e2e/
    ├── threat-detection.e2e.ts
    └── dashboard-access.e2e.ts
```

---

## 1. Unit Tests

### Surveillance Engine Tests

**File:** `tests/unit/surveillance-engine.test.ts`

```typescript
import { SurveillanceEngine } from '../../core/elders/scry/surveillance-engine';

describe('SurveillanceEngine', () => {
  let engine: SurveillanceEngine;

  beforeEach(() => {
    engine = new SurveillanceEngine();
  });

  describe('Pattern Registration', () => {
    it('should initialize with 7 known threat patterns', () => {
      const status = engine.getStatus();
      expect(status.knownPatterns).toBe(7);
    });

    it('should have treasury-drain pattern', () => {
      const patterns = engine.getKnownPatterns();
      expect(patterns.some(p => p.id === 'treasury-drain')).toBe(true);
    });
  });

  describe('Activity Monitoring', () => {
    it('should detect treasury drain attack', () => {
      const activities = [
        {
          activityId: '1',
          daoId: 'test-dao',
          userId: 'attacker',
          type: 'transfer' as const,
          timestamp: new Date(),
          details: { amount: 100000, recipient: 'external' }
        },
        {
          activityId: '2',
          daoId: 'test-dao',
          userId: 'attacker',
          type: 'transfer' as const,
          timestamp: new Date(Date.now() + 300000),
          details: { amount: 100000, recipient: 'external' }
        }
      ];

      const patterns = engine.monitorDAO('test-dao', activities);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.type === 'treasury-drain')).toBe(true);
    });

    it('should detect sybil attack', () => {
      const activities = [
        {
          activityId: '1',
          daoId: 'test-dao',
          userId: 'sybil1',
          type: 'vote' as const,
          timestamp: new Date(),
          details: { proposalId: 'prop-1', vote: 'yes' }
        },
        {
          activityId: '2',
          daoId: 'test-dao',
          userId: 'sybil2',
          type: 'vote' as const,
          timestamp: new Date(Date.now() + 1000),
          details: { proposalId: 'prop-1', vote: 'yes' }
        },
        {
          activityId: '3',
          daoId: 'test-dao',
          userId: 'sybil3',
          type: 'vote' as const,
          timestamp: new Date(Date.now() + 2000),
          details: { proposalId: 'prop-1', vote: 'yes' }
        }
      ];

      const patterns = engine.monitorDAO('test-dao', activities);
      expect(patterns.some(p => p.type === 'sybil-attack')).toBe(true);
    });

    it('should not flag normal activities as threats', () => {
      const activities = [
        {
          activityId: '1',
          daoId: 'test-dao',
          userId: 'member1',
          type: 'proposal' as const,
          timestamp: new Date(),
          details: { title: 'Budget Increase' }
        }
      ];

      const patterns = engine.monitorDAO('test-dao', activities);
      expect(patterns.length).toBe(0);
    });
  });

  describe('Risk Scoring', () => {
    it('should calculate activity risk score', () => {
      const activity = {
        activityId: '1',
        daoId: 'test-dao',
        userId: 'user1',
        type: 'transfer' as const,
        timestamp: new Date(),
        details: { amount: 1000000, count: 10, timeframeHours: 1 }
      };

      const score = engine.calculateActivityRiskScore(activity);
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should increase risk score with multiple transfers', () => {
      const singleTransfer = {
        activityId: '1',
        daoId: 'test-dao',
        userId: 'user1',
        type: 'transfer' as const,
        timestamp: new Date(),
        details: { amount: 1000000, count: 1, timeframeHours: 1 }
      };

      const multipleTransfers = {
        ...singleTransfer,
        details: { amount: 1000000, count: 10, timeframeHours: 1 }
      };

      const score1 = engine.calculateActivityRiskScore(singleTransfer);
      const score2 = engine.calculateActivityRiskScore(multipleTransfers);

      expect(score2).toBeGreaterThan(score1);
    });
  });

  describe('Pattern Learning', () => {
    it('should learn from detected patterns', () => {
      const pattern = {
        id: 'treasury-drain',
        type: 'treasury-drain',
        indicators: ['multiple_transfers', 'large_amounts'],
        riskThreshold: 0.6,
        confidence: 0.85
      };

      engine.registerPattern(pattern);
      engine.learnFromPattern('test-dao', pattern, ['attacker1', 'attacker2']);

      const traits = engine.getLearnedTraits('test-dao');
      expect(traits.size).toBeGreaterThan(0);
    });

    it('should update threat actor scores', () => {
      engine.registerPattern({
        id: 'treasury-drain',
        type: 'treasury-drain',
        indicators: ['multiple_transfers'],
        riskThreshold: 0.6,
        confidence: 0.85
      });

      engine.learnFromPattern('test-dao', 
        { id: 'treasury-drain', type: 'treasury-drain' } as any,
        ['attacker1']
      );

      const score1 = engine.getPreemptiveSuspicionScore('test-dao', 'attacker1');
      
      engine.learnFromPattern('test-dao',
        { id: 'treasury-drain', type: 'treasury-drain' } as any,
        ['attacker1']
      );

      const score2 = engine.getPreemptiveSuspicionScore('test-dao', 'attacker1');
      expect(score2).toBeGreaterThan(score1);
    });
  });

  describe('Data Lifecycle', () => {
    it('should maintain maximum history size', () => {
      const activities = [];
      for (let i = 0; i < 15000; i++) {
        activities.push({
          activityId: `${i}`,
          daoId: 'test-dao',
          userId: `user${i}`,
          type: 'transfer' as const,
          timestamp: new Date(),
          details: { amount: 1000 }
        });
      }

      engine.monitorDAO('test-dao', activities);
      const status = engine.getStatus();
      expect(status.historySize).toBeLessThanOrEqual(10000);
    });

    it('should prune old data', async () => {
      const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days old
      
      engine.registerPattern({
        id: 'treasury-drain',
        type: 'treasury-drain',
        indicators: ['multiple_transfers'],
        riskThreshold: 0.6,
        confidence: 0.85
      });

      engine.learnFromPattern('test-dao',
        { id: 'treasury-drain', type: 'treasury-drain' } as any,
        ['old-attacker']
      );

      await engine.pruneOldData(30);
      
      const score = engine.getPreemptiveSuspicionScore('test-dao', 'old-attacker');
      expect(score).toBeLessThan(0.5);
    });
  });
});
```

### Threat Predictor Tests

**File:** `tests/unit/threat-predictor.test.ts`

```typescript
import { ThreatPredictor } from '../../core/elders/scry/threat-predictor';

describe('ThreatPredictor', () => {
  let predictor: ThreatPredictor;

  beforeEach(() => {
    predictor = new ThreatPredictor();
  });

  describe('Health Data Collection', () => {
    it('should collect historical health data', () => {
      const healthData = {
        timestamp: new Date(),
        overallHealth: 75,
        treasuryHealth: 80,
        governanceHealth: 70,
        communityHealth: 75,
        systemHealth: 70
      };

      predictor.recordHealthData('test-dao', healthData);
      expect(predictor.getHistorySize('test-dao')).toBe(1);
    });

    it('should maintain maximum history size', () => {
      for (let i = 0; i < 10000; i++) {
        predictor.recordHealthData('test-dao', {
          timestamp: new Date(Date.now() - i * 3600000),
          overallHealth: 70 + Math.random() * 20,
          treasuryHealth: 70 + Math.random() * 20,
          governanceHealth: 70 + Math.random() * 20,
          communityHealth: 70 + Math.random() * 20,
          systemHealth: 70 + Math.random() * 20
        });
      }

      expect(predictor.getHistorySize('test-dao')).toBeLessThanOrEqual(8760);
    });
  });

  describe('Trend Analysis', () => {
    it('should detect declining trend', () => {
      for (let i = 0; i < 24; i++) {
        predictor.recordHealthData('test-dao', {
          timestamp: new Date(Date.now() - i * 3600000),
          overallHealth: 100 - (i * 2),
          treasuryHealth: 100 - (i * 2),
          governanceHealth: 100 - (i * 2),
          communityHealth: 100 - (i * 2),
          systemHealth: 100 - (i * 2)
        });
      }

      const forecast = predictor.forecastDAOHealth('test-dao', 24);
      expect(forecast.trend).toBe('declining');
    });

    it('should detect improving trend', () => {
      for (let i = 0; i < 24; i++) {
        predictor.recordHealthData('test-dao', {
          timestamp: new Date(Date.now() - i * 3600000),
          overallHealth: 50 + (i * 2),
          treasuryHealth: 50 + (i * 2),
          governanceHealth: 50 + (i * 2),
          communityHealth: 50 + (i * 2),
          systemHealth: 50 + (i * 2)
        });
      }

      const forecast = predictor.forecastDAOHealth('test-dao', 24);
      expect(forecast.trend).toBe('improving');
    });

    it('should calculate volatility', () => {
      for (let i = 0; i < 24; i++) {
        predictor.recordHealthData('test-dao', {
          timestamp: new Date(Date.now() - i * 3600000),
          overallHealth: 50 + Math.random() * 50,
          treasuryHealth: 50 + Math.random() * 50,
          governanceHealth: 50 + Math.random() * 50,
          communityHealth: 50 + Math.random() * 50,
          systemHealth: 50 + Math.random() * 50
        });
      }

      const forecast = predictor.forecastDAOHealth('test-dao', 24);
      expect(forecast.volatility).toBeGreaterThan(0);
    });
  });

  describe('Risk Factor Identification', () => {
    it('should identify treasury risks', () => {
      for (let i = 0; i < 24; i++) {
        predictor.recordHealthData('test-dao', {
          timestamp: new Date(Date.now() - i * 3600000),
          overallHealth: 60,
          treasuryHealth: 30 - (i * 1), // Declining treasury
          governanceHealth: 75,
          communityHealth: 75,
          systemHealth: 75
        });
      }

      const forecast = predictor.forecastDAOHealth('test-dao', 24);
      const treasuryRisks = forecast.riskFactors.filter(r => r.category === 'treasury');
      expect(treasuryRisks.length).toBeGreaterThan(0);
      expect(treasuryRisks[0].riskLevel).toBe('high');
    });

    it('should identify governance risks', () => {
      for (let i = 0; i < 24; i++) {
        predictor.recordHealthData('test-dao', {
          timestamp: new Date(Date.now() - i * 3600000),
          overallHealth: 60,
          treasuryHealth: 75,
          governanceHealth: 20 - (i * 1), // Declining governance
          communityHealth: 75,
          systemHealth: 75
        });
      }

      const forecast = predictor.forecastDAOHealth('test-dao', 24);
      const govRisks = forecast.riskFactors.filter(r => r.category === 'governance');
      expect(govRisks.length).toBeGreaterThan(0);
    });
  });

  describe('Early Warnings', () => {
    it('should generate early warnings for critical risks', () => {
      for (let i = 0; i < 24; i++) {
        predictor.recordHealthData('test-dao', {
          timestamp: new Date(Date.now() - i * 3600000),
          overallHealth: 20 - (i * 1), // Severe decline
          treasuryHealth: 20 - (i * 1),
          governanceHealth: 20 - (i * 1),
          communityHealth: 20 - (i * 1),
          systemHealth: 20 - (i * 1)
        });
      }

      const forecast = predictor.forecastDAOHealth('test-dao', 24);
      expect(forecast.earlyWarnings.length).toBeGreaterThan(0);
      const criticalWarnings = forecast.earlyWarnings.filter(w => w.severity === 'critical');
      expect(criticalWarnings.length).toBeGreaterThan(0);
    });

    it('should include required actions in warnings', () => {
      for (let i = 0; i < 24; i++) {
        predictor.recordHealthData('test-dao', {
          timestamp: new Date(Date.now() - i * 3600000),
          overallHealth: 20 - (i * 1),
          treasuryHealth: 20 - (i * 1),
          governanceHealth: 75,
          communityHealth: 75,
          systemHealth: 75
        });
      }

      const forecast = predictor.forecastDAOHealth('test-dao', 24);
      forecast.earlyWarnings.forEach(warning => {
        expect(warning.requiredAction).toBeTruthy();
        expect(warning.requiredAction.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Forecast Confidence', () => {
    it('should have low confidence with minimal data', () => {
      predictor.recordHealthData('test-dao', {
        timestamp: new Date(),
        overallHealth: 70,
        treasuryHealth: 70,
        governanceHealth: 70,
        communityHealth: 70,
        systemHealth: 70
      });

      const forecast = predictor.forecastDAOHealth('test-dao', 24);
      expect(forecast.confidence).toBeLessThan(0.5);
    });

    it('should have higher confidence with more data', () => {
      for (let i = 0; i < 168; i++) { // 1 week of hourly data
        predictor.recordHealthData('test-dao', {
          timestamp: new Date(Date.now() - i * 3600000),
          overallHealth: 70 + Math.random() * 10,
          treasuryHealth: 70 + Math.random() * 10,
          governanceHealth: 70 + Math.random() * 10,
          communityHealth: 70 + Math.random() * 10,
          systemHealth: 70 + Math.random() * 10
        });
      }

      const forecast = predictor.forecastDAOHealth('test-dao', 24);
      expect(forecast.confidence).toBeGreaterThan(0.7);
    });
  });
});
```

---

## 2. Integration Tests

### API Endpoint Tests

**File:** `tests/integration/scry-api.test.ts`

```typescript
import axios from 'axios';
import { eldScry } from '../../core/elders/scry';

describe('ELD-SCRY API Integration', () => {
  const API_URL = 'http://localhost:5000/api/elders';
  let superuserToken: string;
  let memberToken: string;
  let testDaoId: string;

  beforeAll(async () => {
    // Setup test tokens
    superuserToken = 'test-superuser-token';
    memberToken = 'test-member-token';
    testDaoId = 'test-dao-integration';

    // Start ELD-SCRY
    await eldScry.start();
  });

  afterAll(async () => {
    await eldScry.stop();
  });

  describe('Public Endpoints', () => {
    it('GET /scry/health should return status', async () => {
      const response = await axios.get(`${API_URL}/scry/health`);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.elderName).toBe('ELD-SCRY');
      expect(response.data.status).toBe('monitoring');
    });
  });

  describe('Superuser Endpoints', () => {
    it('GET /scry/dashboard requires superuser role', async () => {
      try {
        await axios.get(`${API_URL}/scry/dashboard`, {
          headers: { 'Authorization': `Bearer ${memberToken}` }
        });
        fail('Should require superuser role');
      } catch (error: any) {
        expect(error.response?.status).toBe(403);
      }
    });

    it('GET /scry/dashboard returns global threat overview', async () => {
      const response = await axios.get(`${API_URL}/scry/dashboard`, {
        headers: { 'Authorization': `Bearer ${superuserToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.threatStats).toBeDefined();
      expect(response.data.daos).toBeInstanceOf(Array);
    });

    it('GET /scry/threat-signatures returns learned patterns', async () => {
      const response = await axios.get(`${API_URL}/scry/threat-signatures`, {
        headers: { 'Authorization': `Bearer ${superuserToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.totalSignatures).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(response.data.signatures)).toBe(true);
    });
  });

  describe('DAO Member Endpoints', () => {
    it('GET /scry/dao/:daoId/threats requires DAO membership', async () => {
      try {
        await axios.get(`${API_URL}/scry/dao/${testDaoId}/threats`, {
          headers: { 'Authorization': `Bearer invalid-token` }
        });
        fail('Should require valid token');
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
      }
    });

    it('GET /scry/dao/:daoId/threats returns threats', async () => {
      const response = await axios.get(`${API_URL}/scry/dao/${testDaoId}/threats`, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.daoId).toBe(testDaoId);
      expect(Array.isArray(response.data.threats)).toBe(true);
    });

    it('GET /scry/dao/:daoId/forecast returns health forecast', async () => {
      const response = await axios.get(`${API_URL}/scry/dao/${testDaoId}/forecast`, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.forecast).toBeDefined();
      expect(response.data.forecast.predictedScore).toBeGreaterThanOrEqual(0);
      expect(response.data.forecast.riskFactors).toBeInstanceOf(Array);
    });

    it('GET /scry/dao/:daoId/suspicion/:userId returns user score', async () => {
      const response = await axios.get(
        `${API_URL}/scry/dao/${testDaoId}/suspicion/test-user`,
        { headers: { 'Authorization': `Bearer ${memberToken}` } }
      );

      expect(response.status).toBe(200);
      expect(response.data.suspicionScore).toBeGreaterThanOrEqual(0);
      expect(response.data.suspicionScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Data Validation', () => {
    it('threat objects should have required fields', async () => {
      const response = await axios.get(`${API_URL}/scry/dao/${testDaoId}/threats`, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
      });

      response.data.threats.forEach(threat => {
        expect(threat.patternId).toBeDefined();
        expect(threat.type).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(threat.severity);
        expect(threat.confidence).toBeGreaterThanOrEqual(0);
        expect(threat.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('forecast should include all required fields', async () => {
      const response = await axios.get(`${API_URL}/scry/dao/${testDaoId}/forecast`, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
      });

      const { forecast } = response.data;
      expect(forecast.timeframeHours).toBe(24);
      expect(forecast.predictedScore).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence).toBeGreaterThanOrEqual(0.3);
      expect(forecast.confidence).toBeLessThanOrEqual(0.95);
      expect(Array.isArray(forecast.riskFactors)).toBe(true);
      expect(Array.isArray(forecast.earlyWarnings)).toBe(true);
    });
  });
});
```

---

## 3. End-to-End Tests

### Threat Detection Flow

**File:** `tests/e2e/threat-detection.e2e.ts`

```typescript
import { eldScry } from '../../core/elders/scry';
import axios from 'axios';

describe('ELD-SCRY Threat Detection E2E', () => {
  const API_URL = 'http://localhost:5000/api/elders';
  const testDaoId = 'e2e-test-dao';
  let memberToken: string;

  beforeAll(async () => {
    await eldScry.start();
    memberToken = 'test-member-token';
  });

  afterAll(async () => {
    await eldScry.stop();
  });

  it('should detect treasury drain attack end-to-end', async () => {
    // Step 1: Simulate treasury drain activities
    const activities = [
      {
        activityId: '1',
        daoId: testDaoId,
        userId: 'attacker-1',
        type: 'transfer',
        timestamp: new Date(),
        details: { amount: 500000, recipient: 'external' }
      },
      {
        activityId: '2',
        daoId: testDaoId,
        userId: 'attacker-1',
        type: 'transfer',
        timestamp: new Date(Date.now() + 600000),
        details: { amount: 500000, recipient: 'external' }
      }
    ];

    // Step 2: Process activities
    const metrics = await eldScry.monitorDAO(testDaoId, activities);

    // Step 3: Verify threats detected
    expect(metrics.detectedThreats.length).toBeGreaterThan(0);
    expect(metrics.riskLevel).toBe('high');
    expect(metrics.detectedThreats.some(t => t.type === 'treasury-drain')).toBe(true);

    // Step 4: Query API
    const response = await axios.get(`${API_URL}/scry/dao/${testDaoId}/threats`, {
      headers: { 'Authorization': `Bearer ${memberToken}` }
    });

    expect(response.data.threats.length).toBeGreaterThan(0);
  });

  it('should forecast DAO health decline', async () => {
    // Step 1: Record declining health metrics
    for (let i = 0; i < 24; i++) {
      const predictor = eldScry['predictor'];
      predictor.recordHealthData(testDaoId, {
        timestamp: new Date(Date.now() - i * 3600000),
        overallHealth: 100 - (i * 3),
        treasuryHealth: 100 - (i * 3),
        governanceHealth: 75,
        communityHealth: 75,
        systemHealth: 75
      });
    }

    // Step 2: Get forecast
    const response = await axios.get(`${API_URL}/scry/dao/${testDaoId}/forecast`, {
      headers: { 'Authorization': `Bearer ${memberToken}` }
    });

    // Step 3: Verify forecast
    expect(response.data.forecast.predictedScore).toBeLessThan(50);
    expect(response.data.forecast.earlyWarnings.length).toBeGreaterThan(0);
  });

  it('should identify suspicious users', async () => {
    // Step 1: Simulate multiple attacks by same user
    for (let i = 0; i < 3; i++) {
      const activities = [
        {
          activityId: `${i}-1`,
          daoId: testDaoId,
          userId: 'repeat-attacker',
          type: 'transfer',
          timestamp: new Date(Date.now() + i * 86400000),
          details: { amount: 100000 }
        }
      ];
      await eldScry.monitorDAO(testDaoId, activities);
    }

    // Step 2: Check suspicion score
    const response = await axios.get(
      `${API_URL}/scry/dao/${testDaoId}/suspicion/repeat-attacker`,
      { headers: { 'Authorization': `Bearer ${memberToken}` } }
    );

    // Step 3: Verify score increased
    expect(response.data.suspicionScore).toBeGreaterThan(0.5);
  });

  it('should provide actionable recommendations', async () => {
    // Step 1: Get forecast with risks
    const response = await axios.get(`${API_URL}/scry/dao/${testDaoId}/forecast`, {
      headers: { 'Authorization': `Bearer ${memberToken}` }
    });

    // Step 2: Verify early warnings have actions
    response.data.forecast.earlyWarnings.forEach(warning => {
      expect(warning.requiredAction).toBeTruthy();
      expect(warning.requiredAction).toMatch(/^[A-Z]/); // Starts with capital letter
    });
  });
});
```

---

## 4. Performance Tests

### Load Testing

**File:** `tests/performance/scry-load.test.ts`

```typescript
import { EldScryElder } from '../../core/elders/scry';

describe('ELD-SCRY Performance', () => {
  let scry: EldScryElder;

  beforeEach(() => {
    scry = new EldScryElder({ autoReportThreats: false });
  });

  it('should process 100 DAOs in < 5 seconds', async () => {
    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      const activities = [];
      for (let j = 0; j < 50; j++) {
        activities.push({
          activityId: `${i}-${j}`,
          daoId: `dao-${i}`,
          userId: `user-${j}`,
          type: 'transfer',
          timestamp: new Date(),
          details: { amount: Math.random() * 1000000 }
        });
      }
      await scry.monitorDAO(`dao-${i}`, activities);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(5000);
    console.log(`Processed 100 DAOs in ${duration}ms`);
  });

  it('should maintain < 500MB memory for 1000 threat events', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      scry['surveillance'].monitorDAO('test-dao', [
        {
          activityId: `${i}`,
          daoId: 'test-dao',
          userId: `user-${i}`,
          type: 'transfer',
          timestamp: new Date(),
          details: { amount: 100000 }
        }
      ]);
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024;

    expect(memoryUsed).toBeLessThan(500);
    console.log(`Memory used: ${memoryUsed.toFixed(2)}MB`);
  });
});
```

---

## 5. Running Tests

### Setup

```bash
# Install dependencies
npm install --save-dev jest @types/jest ts-jest

# Configure Jest
cat > jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  collectCoverageFrom: [
    'core/**/*.ts',
    '!core/**/*.d.ts',
    '!core/**/index.ts'
  ]
};
EOF
```

### Run All Tests

```bash
# Unit tests
npm test -- tests/unit

# Integration tests
npm test -- tests/integration

# E2E tests
npm test -- tests/e2e

# Performance tests
npm test -- tests/performance

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

---

## 6. Test Coverage Goals

| Component | Target Coverage | Status |
|-----------|-----------------|--------|
| Surveillance Engine | 90% | ⚠️ In Progress |
| Threat Predictor | 85% | ⚠️ In Progress |
| ELD-SCRY Elder | 80% | ⚠️ In Progress |
| API Routes | 95% | ⚠️ In Progress |
| **Overall** | **85%** | ⚠️ In Progress |

---

## 7. Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/scry-tests.yml
name: ELD-SCRY Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test -- tests/unit --coverage
      
      - name: Run integration tests
        run: npm test -- tests/integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## 8. Debugging Tests

### Common Issues

**Problem:** Tests timeout
```bash
# Increase timeout
npm test -- --testTimeout=10000
```

**Problem:** Need test logs
```typescript
// Enable debug logging
process.env.DEBUG = 'scry:*';
```

**Problem:** Database not connecting
```bash
# Check database is running
psql -U postgres -h localhost -c "SELECT 1"
```

---

## 9. Test Data Fixtures

### Create Test DAO

```typescript
export const createTestDAO = (daoId: string) => ({
  daoId,
  name: `Test DAO ${daoId}`,
  treasury: 1000000,
  members: 100,
  proposals: []
});

export const createTestActivities = (daoId: string, count: number) => {
  const activities = [];
  for (let i = 0; i < count; i++) {
    activities.push({
      activityId: `activity-${i}`,
      daoId,
      userId: `user-${i % 10}`,
      type: ['transfer', 'proposal', 'vote'][Math.floor(Math.random() * 3)],
      timestamp: new Date(Date.now() - i * 3600000),
      details: { amount: Math.random() * 1000000 }
    });
  }
  return activities;
};
```

---

## 10. Success Criteria

✅ **All tests pass**
- Unit tests: 100% pass rate
- Integration tests: 100% pass rate
- E2E tests: 100% pass rate

✅ **Performance targets met**
- 100 DAOs processed in <5s
- Memory usage <500MB for 1000 events
- API response time <500ms

✅ **Coverage goals reached**
- Overall coverage: >85%
- Critical paths: >95%
- Edge cases covered

✅ **CI/CD passing**
- All workflows green
- Coverage reports generated
- Deployment ready
