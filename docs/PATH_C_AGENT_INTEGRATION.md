# 🔗 Path C: Integrate All Agents with Your Infrastructure

**Status:** Path B (Tier 2) agents built. Ready to integrate.  
**Goal:** Wire Health Monitor + 3 Tier 2 agents into your existing agent ecosystem  
**Time:** 2-4 hours depending on complexity of your agent infrastructure  

---

## 🎯 Integration Overview

You now have **4 powerful monitoring agents** ready to be consumed by your existing infrastructure:

1. **Tier 1:** Health Monitor Agent (every 15s)
2. **Tier 2A:** Domain Aggregator (every 5min)
3. **Tier 2B:** Capacity Planner (every 10min)
4. **Tier 2C:** Performance Optimizer (every 2min)

This guide shows how to integrate them with your existing agents.

---

## 🏗️ Integration Architecture

### Before:
```
Your Agents
  ├─ Agent 1
  ├─ Agent 2
  ├─ Agent 3
  └─ Agent 4
      (polling endpoints directly, no coordination)
```

### After:
```
Real-Time Metrics Collection
  ↓
Health Monitor + Tier 2 Agents (auto-running)
  ├─ Data aggregation
  ├─ Pattern detection
  ├─ Slack notifications
  └─ 24-hour history
      ↓
Your Agents (enhanced)
  ├─ Agent 1 (with health context)
  ├─ Agent 2 (with domain insights)
  ├─ Agent 3 (with capacity forecasts)
  └─ Agent 4 (with optimization status)
      (now much smarter - coordinated actions)
```

---

## 🔌 Integration Patterns

### Pattern 1: Context-Aware Agent

Your agent checks system health before taking action:

```typescript
import { getHealthMonitor } from './agents/healthMonitorAgent';

export async function mySmartAgent() {
  const health = getHealthMonitor();
  
  // Check if system is degraded
  if (health.isAlertState()) {
    const alertDuration = health.getAlertDuration();
    logger.info(`System in alert state for ${alertDuration}ms. Skipping non-critical work.`);
    return; // Skip optional operations during degradation
  }
  
  // Proceed with normal operations
  await doNormalWork();
}
```

---

### Pattern 2: Domain-Owner Escalation

Alert the right team based on which domain is affected:

```typescript
import { getDomainAggregator } from './agents/domainAggregatorAgent';

export async function escalationAgent() {
  const domains = getDomainAggregator();
  
  const unhealthy = domains.getUnhealthyDomains();
  for (const domain of unhealthy) {
    const trend = domains.getDomainTrends(domain.domain, 60);
    
    if (trend.trend === 'degrading') {
      // Getting worse - escalate immediately
      await pageTeam({
        domain: domain.domain,
        severity: 'high',
        reason: `Domain degrading: error rate ${domain.errorRate}% and increasing`,
        trend: trend,
      });
    } else if (domain.errorRate > 10) {
      // Bad but stable
      await notifySlack({
        domain: domain.domain,
        message: `Domain ${domain.domain} at ${domain.errorRate}% error rate`,
      });
    }
  }
}
```

---

### Pattern 3: Proactive Capacity Management

Scale services before they become a problem:

```typescript
import { getCapacityPlanner } from './agents/capacityPlannerAgent';

export async function capacityManagementAgent() {
  const capacity = getCapacityPlanner();
  
  // Get scaling recommendations
  const recommendations = capacity.getScalingRecommendations('scale_up');
  
  for (const rec of recommendations) {
    if (rec.confidence > 0.8) {
      // High confidence = proactively scale
      logger.info(`Proactive scaling: ${rec.endpoint}`, {
        currentRate: rec.currentCallRate,
        projectedRate: rec.projectedCallRate,
        expectedImprovement: `${rec.expectedImprovement}%`,
      });
      
      await autoScaleService(rec.endpoint, rec.projectedCallRate);
    }
  }
  
  // Track utilization trends
  const trend = capacity.getUtilizationTrend(1); // Last hour
  if (trend.trend === 'increasing') {
    // Prepare for higher load
    await prepareInfrastructure({
      projection: trend.peakCallRate * 1.25,
      timeframe: '1 hour',
    });
  }
}
```

---

### Pattern 4: Performance Intelligence

React to performance optimization opportunities:

```typescript
import { getPerformanceOptimizer } from './agents/performanceOptimizerAgent';

export async function performanceAgent() {
  const optimizer = getPerformanceOptimizer();
  
  // Check optimization health
  const health = optimizer.getOptimizationHealth();
  logger.info('Optimization Status:', {
    totalActions: health.totalActions,
    successRate: `${(health.successfulActions / health.totalActions * 100).toFixed(1)}%`,
    avgImprovement: `${health.averageImprovement}%`,
    currentlySlow: health.currentlySlow,
  });
  
  // Get slowest endpoints
  const slowest = optimizer.getSlowestEndpoints(10);
  for (const endpoint of slowest) {
    const history = optimizer.getEndpointHistory(endpoint.path, 10);
    
    // Detect sustained slowness
    if (history.every(h => h.avgLatency > 1000)) {
      await investigateAndOptimize({
        endpoint: endpoint.path,
        avgLatency: endpoint.avgLatency,
        p99Latency: endpoint.p99Latency,
      });
    }
  }
}
```

---

### Pattern 5: Consolidated Dashboard

Create a unified view of all metrics:

```typescript
import { getHealthMonitor } from './agents/healthMonitorAgent';
import { getDomainAggregator } from './agents/domainAggregatorAgent';
import { getCapacityPlanner } from './agents/capacityPlannerAgent';
import { getPerformanceOptimizer } from './agents/performanceOptimizerAgent';

export async function dashboardUpdateAgent() {
  const health = getHealthMonitor();
  const domains = getDomainAggregator();
  const capacity = getCapacityPlanner();
  const perf = getPerformanceOptimizer();
  
  const dashboard = {
    system: {
      health: health.getCurrentHealth(),
      trends: health.getHealthTrends(300), // 5 min
      alertState: health.isAlertState(),
      alertDuration: health.getAlertDuration(),
    },
    domains: {
      all: Array.from(domains.getDomainSnapshot().values()),
      unhealthy: domains.getUnhealthyDomains(),
      slowest: domains.getSlowestDomains(5),
    },
    capacity: {
      current: capacity.getCurrentCapacity(),
      hotEndpoints: capacity.getHottestEndpoints(20),
      bottlenecks: capacity.getBottlenecks(),
      recommendations: capacity.getScalingRecommendations('scale_up'),
      trend: capacity.getUtilizationTrend(1),
    },
    performance: {
      slowest: perf.getSlowestEndpoints(15),
      optimization: perf.getOptimizationHealth(),
      recentActions: perf.getActionHistory(undefined, 50),
    },
    timestamp: new Date(),
  };
  
  // Send to database, websocket, or API
  await updateDashboard(dashboard);
}
```

---

### Pattern 6: Intelligent Load Shedding

Gracefully degrade under heavy load:

```typescript
import { getHealthMonitor } from './agents/healthMonitorAgent';
import { getPerformanceOptimizer } from './agents/performanceOptimizerAgent';

export async function loadShedding() {
  const health = getHealthMonitor();
  const perf = getPerformanceOptimizer();
  
  if (health.isAlertState()) {
    const alerts = health.getAlertHistory(10);
    const recentErrors = alerts.filter(a => a.type === 'error_spike');
    
    if (recentErrors.length > 2) {
      // Multiple error spikes = we're under attack or overload
      const slowest = perf.getSlowestEndpoints(10);
      
      // Shed traffic from slowest endpoints
      const shedCandidates = slowest.filter(ep => ep.callCount > 50_000);
      for (const endpoint of shedCandidates) {
        // Reduce traffic by routing to fallback
        await applyLoadShedding({
          endpoint: endpoint.path,
          shedPercentage: 25, // Drop 25% of traffic
          fallback: 'use_cache_or_fail_gracefully',
        });
      }
    }
  }
}
```

---

## 📋 Integration Checklist

### Step 1: Identify Your Agents
- [ ] List all existing agents in your codebase
- [ ] Document what each agent does
- [ ] Identify which could benefit from metrics

### Step 2: Add Imports
```typescript
// At the top of your agent file
import { getHealthMonitor } from './agents/healthMonitorAgent';
import { getDomainAggregator } from './agents/domainAggregatorAgent';
import { getCapacityPlanner } from './agents/capacityPlannerAgent';
import { getPerformanceOptimizer } from './agents/performanceOptimizerAgent';
```

### Step 3: Integrate Agents One-by-One
- [ ] Start with Pattern 1 (Context-aware agent)
- [ ] Add Pattern 2 (Domain escalation)
- [ ] Add Pattern 3 (Capacity management)
- [ ] Add Pattern 4 (Performance intelligence)
- [ ] Add Pattern 5 (Consolidated dashboard)
- [ ] Add Pattern 6 (Load shedding) if needed

### Step 4: Test Each Integration
- [ ] Verify imports work
- [ ] Verify agent data access works
- [ ] Verify actions execute correctly
- [ ] Monitor for unexpected side effects

### Step 5: Deploy Together
- [ ] Build: `npm run build:backend`
- [ ] Start: `npm run dev`
- [ ] Monitor: Watch all agents polling
- [ ] Verify: Check Slack notifications work

---

## 🔄 Real-World Integration Examples

### Example 1: Payment Service Monitoring

Your existing payment agent enhanced:

```typescript
// Original agent
async function originalPaymentAgent() {
  const payments = await db.query('SELECT * FROM payments WHERE status=pending');
  for (const payment of payments) {
    await processPayment(payment);
  }
}

// Enhanced with health monitoring
import { getHealthMonitor, getDomainAggregator } from './agents';

async function enhancedPaymentAgent() {
  const health = getHealthMonitor();
  const domains = getDomainAggregator();
  
  // Skip if system-wide issues
  if (health.getCurrentHealth().overallErrorRate > 10) {
    logger.warn('System error rate too high, pausing payment processing');
    return;
  }
  
  // Skip if payments domain specifically is struggling
  const paymentDomain = domains.getDomainSnapshot('payments');
  if (paymentDomain && paymentDomain.errorRate > 5) {
    logger.warn(`Payments domain error rate ${paymentDomain.errorRate}%, pausing`);
    return;
  }
  
  // Safe to process
  try {
    const payments = await db.query('SELECT * FROM payments WHERE status=pending');
    for (const payment of payments) {
      await processPayment(payment);
    }
  } catch (error) {
    // If you hit an error while processing, escalate immediately
    const currentHealth = health.getCurrentHealth();
    if (currentHealth.overallErrorRate > 5) {
      await pageOnCall('Payment processing degraded + system-wide high errors');
    }
  }
}
```

---

### Example 2: Scaling Decision Agent

Coordinate scaling decisions across services:

```typescript
import { getCapacityPlanner, getPerformanceOptimizer } from './agents';

async function scalingCoordinator() {
  const capacity = getCapacityPlanner();
  const perf = getPerformanceOptimizer();
  
  // Get high-confidence scale-up recommendations
  const recommendations = capacity.getScalingRecommendations('scale_up')
    .filter(r => r.confidence > 0.75);
  
  // Cross-check with current performance
  const actions = perf.getActionHistory(undefined, 100);
  const recentScaleUps = actions.filter(
    a => a.action === 'scale_up' && 
    Date.now() - a.timestamp.getTime() < 600_000 // Last 10 min
  );
  
  // Avoid thrashing - don't scale up if already scaling
  for (const rec of recommendations) {
    const alreadyScaling = recentScaleUps.some(a => a.endpoint === rec.endpoint);
    
    if (!alreadyScaling) {
      logger.info(`Executing scaling decision: ${rec.endpoint}`, {
        reason: rec.reason,
        expectedImprovement: `${rec.expectedImprovement}%`,
      });
      
      await k8s.scaleDeployment({
        service: extractService(rec.endpoint),
        replicas: Math.ceil(rec.projectedCallRate / 5000), // 5k calls per replica
      });
    }
  }
}
```

---

## 🚀 Deployment Strategy

### Conservative Approach (Safest)

1. Deploy all agents (Tier 1 + 2) with server
2. Run for 1 day observation-only mode
3. Integrate Pattern 1 (context-aware) into one agent
4. Run for 1 day more
5. Add Pattern 2 (escalation) to same agent
6. Roll out to other agents gradually

**Timeline:** 5-7 days  
**Risk:** Very low (gradual integration)

---

### Moderate Approach (Recommended)

1. Deploy all agents with server
2. Integrate all patterns into one "orchestrator" agent
3. Let it run parallel to existing agents (shadow mode)
4. Compare outputs for 1 day
5. Integrate with other agents
6. Deprecate old logic

**Timeline:** 2-3 days  
**Risk:** Low (shadow mode first)

---

### Aggressive Approach (Fastest)

1. Deploy all agents + all integrations
2. Go live immediately
3. Monitor closely for 24 hours
4. Adjust thresholds/conditions as needed

**Timeline:** 1 day  
**Risk:** Medium (if agent logic has bugs)

---

## ✅ Success Criteria

Integration is successful when:

- [ ] All 4 agents start without errors
- [ ] Your existing agents import metrics agents cleanly
- [ ] Your agents call getHealthMonitor() etc. without errors
- [ ] Actions execute based on agent data
- [ ] Slack notifications work as expected
- [ ] System behaves more intelligently than before
- [ ] No regressions in existing agent functionality

---

## 🐛 Troubleshooting Integration

| Problem | Solution |
|---------|----------|
| Import errors | Verify agent files in `server/agents/` |
| `getHealthMonitor()` returns null | Agent must start before calling getter |
| Data always empty | Wait 15+ seconds after server start |
| Too many Slack alerts | Adjust thresholds in .env or code |
| Agents interfering with each other | Each has cooldown period to prevent thrashing |

---

## 📊 Example: Full Integration

This example shows all patterns working together:

```typescript
/**
 * Master Orchestrator Agent
 * Integrates all 4 monitoring agents
 */

import {
  getHealthMonitor,
  getDomainAggregator,
  getCapacityPlanner,
  getPerformanceOptimizer,
} from './agents';

export class MasterOrchestrator {
  private health = getHealthMonitor();
  private domains = getDomainAggregator();
  private capacity = getCapacityPlanner();
  private perf = getPerformanceOptimizer();

  async run() {
    // Every 30 seconds
    setInterval(() => this.execute(), 30_000);
  }

  private async execute() {
    // Pattern 1: Context-aware check
    if (this.health.isAlertState()) {
      logger.warn('System in alert state, reducing workload');
      return;
    }

    // Pattern 2: Domain escalation
    const unhealthy = this.domains.getUnhealthyDomains();
    for (const domain of unhealthy) {
      await this.escalateDomain(domain);
    }

    // Pattern 3: Proactive capacity management
    const recs = this.capacity.getScalingRecommendations('scale_up');
    for (const rec of recs.filter(r => r.confidence > 0.8)) {
      await this.autoScale(rec);
    }

    // Pattern 4: Performance optimization
    const slowest = this.perf.getSlowestEndpoints(10);
    for (const endpoint of slowest) {
      await this.optimizeEndpoint(endpoint);
    }

    // Pattern 5: Update dashboard
    await this.updateDashboard();

    // Pattern 6: Load shedding if needed
    if (this.health.getCurrentHealth().overallErrorRate > 7) {
      await this.applyShedding();
    }
  }

  private async escalateDomain(domain: any) {
    // Your escalation logic
    logger.warn(`Domain ${domain.domain} failed, escalating...`);
  }

  private async autoScale(rec: any) {
    // Your scaling logic
    logger.info(`Auto-scaling ${rec.endpoint}`);
  }

  private async optimizeEndpoint(endpoint: any) {
    // Your optimization logic
    logger.info(`Optimizing ${endpoint.path}`);
  }

  private async updateDashboard() {
    // Send consolidated metrics to dashboard
    logger.debug('Dashboard updated');
  }

  private async applyShedding() {
    // Reduce load gracefully
    logger.warn('Applying load shedding');
  }
}
```

---

## 📞 Integration Support

**Get help with integration:**

1. Review one of the 6 patterns above
2. Apply to your specific agent
3. Test in isolation first
4. Deploy with Tier 1 agent
5. Monitor for issues
6. If stuck, check troubleshooting table

---

## ✨ Benefits After Integration

After integrating Path C with your agents, you'll have:

✅ **Coordinated monitoring** - 4 agents working together, not separately  
✅ **Intelligent decision-making** - Agents aware of system-wide state  
✅ **Reduced false positives** - Context prevents unnecessary escalations  
✅ **Proactive optimization** - Scale before problems, not after  
✅ **Better SLAs** - Unified monitoring across 877+ endpoints  
✅ **Faster incident response** - Right team alerted immediately  
✅ **Data-driven decisions** - 24-hour history for trending analysis  
✅ **Zero additional overhead** - Re-uses existing metrics infrastructure  

---

## 🎯 Next Steps

1. **Read this document** ✓ (you are here)
2. **Pick one integration pattern** above
3. **Apply to one existing agent**
4. **Deploy and monitor for 1 day**
5. **Roll out to other agents**
6. **Enjoy coordinated, intelligent monitoring!**

---

**Ready to integrate?** Start with Pattern 1 (Context-aware agent) in one of your existing agents. Takes 10 minutes!
