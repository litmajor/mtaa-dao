# 🚀 Tier 2 Agents - Complete Implementation Guide

**Status:** ✅ Path B (Tier 2) agents fully built and integrated  
**Build Time:** Complete (3 advanced agents created)  
**Integration:** Ready to deploy with server  
**Next Step:** Wire into your existing agents (Path C)

---

## 📊 Three Tier 2 Agents Now Available

### 1️⃣ Domain Aggregator Agent
**Polls:** Every 5 minutes  
**Source:** `/api/docs/stats/by-domain`  
**What it does:**
- Groups endpoints by domain (/api/admin, /api/strategies, etc.)
- Tracks per-domain error rates and latency
- Detects domain-level degradation
- Sends alerts when a domain health changes
- Maintains 24-hour history per domain

**Key metrics:**
- Error rate per domain
- Latency (avg, p99) per domain
- Call volume per domain
- Health trend (stable, improving, degrading)

**Use for:**
- Alert domain owners when their area is slow
- Identify which team to page based on error patterns
- Domain-specific SLA tracking

---

### 2️⃣ Capacity Planner Agent
**Polls:** Every 10 minutes  
**Source:** `/api/docs/stats` (full snapshot)  
**What it does:**
- Analyzes usage patterns across all endpoints
- Identifies hotspots (high-traffic endpoints)
- Detects bottlenecks (high latency + high volume)
- Generates scaling recommendations
- Forecasts 1-hour ahead capacity needs

**Key metrics:**
- Total call volume per period
- Hot endpoints (>50k calls/period)
- Bottlenecks (high latency + volume combo)
- Scaling recommendations + confidence scores

**Use for:**
- Plan infrastructure scaling before you hit limits
- Identify which services need more resources
- Forecast peak usage times
- Optimize database/cache allocation

---

### 3️⃣ Performance Optimizer Agent
**Polls:** Every 2 minutes  
**Source:** `/api/docs/stats/slowest?limit=50`  
**What it does:**
- Monitors slowest endpoints in real-time
- Auto-recommends scaling, caching, rate limiting
- Tracks optimization effectiveness
- Detects latency trends on individual endpoints
- Prevents thrashing with cooldown periods

**Key metrics:**
- Slowest endpoints (sorted by p99 latency)
- Latency trend per endpoint
- Optimization actions taken
- Expected improvement from each action

**Use for:**
- Automatically trigger scaling when endpoints get slow
- Enable caching on high-volume endpoints
- Detect outlier performance degradation
- Learn which optimizations are effective

---

## 🔄 How All 4 Agents Work Together

```
Real-time Metrics Collection (17 endpoints)
           ↓
   ┌───────┴───────┬───────────┬──────────────┐
   ↓               ↓           ↓              ↓
TIER 1:        TIER 2A:    TIER 2B:       TIER 2C:
Health       Domain      Capacity      Performance
Monitor      Aggregator  Planner       Optimizer
(15s)        (5min)      (10min)       (2min)

├─ System wide  ├─ Per domain   ├─ Forecasting  ├─ Auto-optimize
├─ Error spikes ├─ Trends       ├─ Hotspots     ├─ Real-time actions
├─ Latency spikeErrors        ├─ Bottlenecks ├─ Caching
└─ Unhealthy   └─ Recovery     └─ Scaling     └─ Rate limiting
   endpoints                                 └─ Load shedding
         ↓
    All send to SLACK
    All maintain 24-hour history
    All auto-recover from failures
```

---

## 📋 Agent Configuration

All agents are in `server/index.ts` and auto-initialize at startup.

### Environment Variables (Optional Slack Webhooks)

```bash
# Set in .env file:
SLACK_WEBHOOK_HEALTH_MONITOR=https://hooks.slack.com/services/...
SLACK_WEBHOOK_DOMAIN_ALERTS=https://hooks.slack.com/services/...
SLACK_WEBHOOK_CAPACITY=https://hooks.slack.com/services/...
SLACK_WEBHOOK_PERFORMANCE=https://hooks.slack.com/services/...
```

Leave empty to disable Slack for any agent.

### Customization (In Code)

Edit `server/index.ts` around line 1035 to change thresholds:

```typescript
// Domain Aggregator
const domainAggregator = initDomainAggregator(`http://localhost:${PORT}`, {
  pollInterval: 300_000, // 5 min
  slackWebhook: process.env.SLACK_WEBHOOK_DOMAIN_ALERTS,
  thresholds: {
    errorRateWarning: 3.0,      // Change this
    errorRateCritical: 7.5,     // Or this
    latencyWarning: 750,        // Or this
    latencyCritical: 1500,      // Or this
    p99LatencyWarning: 2000,
    p99LatencyCritical: 4000,
  }
});
```

---

## 🎯 Deployment Sequence

### Step 1: Deploy (5 minutes)

```bash
npm run build:backend
npm run dev
```

Watch console for:
```
🏥 Health Monitor Agent started (polling every 15s)
🌐 Domain Aggregator Agent started (polling every 5 min)
📈 Capacity Planner Agent started (polling every 10 min)
⚡ Performance Optimizer Agent started (polling every 2 min)
```

### Step 2: Verify All Four Agents Running

In another terminal:

```bash
# Health Monitor
curl http://localhost:5000/api/docs/health

# Domain Aggregator
curl http://localhost:5000/api/docs/stats/by-domain | head -c 200

# Capacity Planner
curl http://localhost:5000/api/docs/stats | head -c 200

# Performance Optimizer
curl http://localhost:5000/api/docs/stats/slowest | head -c 200
```

All should return JSON with valid data.

---

## 📊 What You'll See

### In Console (Every Poll)
```
[DOMAIN_AGGREGATOR] Domain snapshot: admin healthy, strategies degrading
[CAPACITY_PLANNER] Hotspots identified: /api/strategies/backtest (523k calls)
[PERFORMANCE_OPTIMIZER] Executing optimization: scale_up for /api/payments
```

### In Slack (Every 15 seconds - Health Monitor)
```
🚨 ERROR_SPIKE
Error rate at 6.50%
└─ System-wide alert

(5 min later - Domain Aggregator)
⚠️ DOMAIN: STRATEGIES
Error rate warning: 4.5%
└─ Alert on /api/strategies domain only

(10 min later - Capacity Planner)
📈 SCALING RECOMMENDATIONS
/api/strategies/backtest needs scale_up
└─ High volume + high latency

(2 min later - Performance Optimizer)
⚡ PERFORMANCE OPTIMIZATION
scale_up triggered for /api/payments
Expected improvement: 30%
└─ Auto-scaling action taken
```

---

## 🔗 Integration with Path C (Your Agents)

Now that Tier 2 is running, you can integrate with your existing agent infrastructure.

### Your agents can now consume:

```typescript
// Import agent getters
import { getHealthMonitor } from './agents/healthMonitorAgent';
import { getDomainAggregator } from './agents/domainAggregatorAgent';
import { getCapacityPlanner } from './agents/capacityPlannerAgent';
import { getPerformanceOptimizer } from './agents/performanceOptimizerAgent';

// In your agent code:
const health = getHealthMonitor();
const domains = getDomainAggregator();
const capacity = getCapacityPlanner();
const perf = getPerformanceOptimizer();

// Programmatic access to data:
if (health.isAlertState()) {
  // System is degraded, do something
}

const unhealthy = domains.getUnhealthyDomains();
if (unhealthy.length > 0) {
  // Notify domain owners
  notifySlack(`Unhealthy domains: ${unhealthy.map(d => d.domain).join(', ')}`);
}

const scaling = capacity.getScalingRecommendations('scale_up');
if (scaling.length > 0) {
  scaling.forEach(rec => {
    autoScaleService(rec.endpoint, rec.projectedCallRate);
  });
}
```

---

## 🎯 Per-Agent Details

### Health Monitor Agent (Tier 1)
**Status:** Already built (previous step)
**Files:** `server/agents/healthMonitorAgent.ts`
**Methods:**
- `getCurrentHealth()` - Last snapshot
- `getHealthHistory(limit)` - Rolling 24hr
- `getHealthTrends(seconds)` - Calculate trends
- `isAlertState()` - Boolean status
- `getAlertDuration()` - Long alert state for

---

### Domain Aggregator Agent
**Files:** `server/agents/domainAggregatorAgent.ts`
**Methods:**
- `getDomainSnapshot()` - All domains
- `getDomainSnapshot('admin')` - Specific domain
- `getDomainHistory(domain, limit)` - History
- `getDomainTrends(domain, minutes)` - Trend analysis
- `getUnhealthyDomains()` - Error > 5%
- `getSlowestDomains(limit)` - By p99 latency
- `getHighestErrorDomains(limit)` - By error rate

**Example:**
```typescript
const agg = getDomainAggregator();
const strategyDomain = agg.getDomainSnapshot('strategies');
console.log(strategyDomain.errorRate); // 3.5%
console.log(strategyDomain.p99Latency); // 1234ms
```

---

### Capacity Planner Agent
**Files:** `server/agents/capacityPlannerAgent.ts`
**Methods:**
- `getCurrentCapacity()` - Current snapshot
- `getCapacityHistory(limit)` - History
- `getScalingRecommendations(severity)` - Recommendations
- `getHottestEndpoints(limit)` - High traffic
- `getBottlenecks()` - High latency + volume
- `getUtilizationTrend(hours)` - Trend analysis

**Example:**
```typescript
const planner = getCapacityPlanner();
const hottest = planner.getHottestEndpoints(5);
hottest.forEach(ep => {
  console.log(`${ep.path}: ${ep.callCount} calls`);
});

const recs = planner.getScalingRecommendations('scale_up');
```

---

### Performance Optimizer Agent
**Files:** `server/agents/performanceOptimizerAgent.ts`
**Methods:**
- `getSlowestEndpoints(limit)` - Current slowest
- `getEndpointHistory(endpoint, limit)` - Time series
- `getActionHistory(endpoint, limit)` - Actions taken
- `getScalingLevels()` - Current scaling
- `getOptimizationHealth()` - Stats on actions

**Example:**
```typescript
const opt = getPerformanceOptimizer();
const slowest = opt.getSlowestEndpoints(3);
slowest.forEach(ep => {
  const actions = opt.getActionHistory(ep.path);
  console.log(`${ep.path}: ${actions.length} optimizations tried`);
});
```

---

## 📈 Real-World Usage Examples

### Example 1: Smart Escalation

```typescript
// Your agent code
async function smartEscalation() {
  const health = getHealthMonitor();
  const domains = getDomainAggregator();
  
  if (health.isAlertState()) {
    // Find which domain is sick
    const unhealthy = domains.getUnhealthyDomains();
    
    if (unhealthy.length === 1) {
      // Page that domain's team
      pageTeam(unhealthy[0].domain);
    } else {
      // Multiple domains down = page on-call engineer
      pageOnCall('System-wide degradation');
    }
  }
}
```

### Example 2: Proactive Scaling

```typescript
// Your agent code
async function proactiveScaling() {
  const capacity = getCapacityPlanner();
  const perf = getPerformanceOptimizer();
  
  const recs = capacity.getScalingRecommendations('scale_up');
  for (const rec of recs) {
    if (rec.confidence > 0.8) {
      // High confidence = scale before it becomes a problem
      await autoScale(rec.endpoint, rec.projectedCallRate);
      logger.info(`Proactively scaled ${rec.endpoint}`);
    }
  }
}
```

### Example 3: Service Health Dashboard

```typescript
// Your agent code - consolidate all metrics
async function updateDashboard() {
  const health = getHealthMonitor();
  const domains = getDomainAggregator();
  const capacity = getCapacityPlanner();
  
  const dashboard = {
    overallHealth: health.getCurrentHealth(),
    domainStatus: Array.from(domains.getDomainSnapshot().entries()),
    hotEndpoints: capacity.getHottestEndpoints(10),
    bottlenecks: capacity.getBottlenecks(),
    timeRange: new Date(),
  };
  
  await updateDatabase(dashboard);
}
```

---

## ✅ Deployment Checklist

- [ ] Build backend: `npm run build:backend` (no errors)
- [ ] Start server: `npm run dev`
- [ ] Watch console for 4 agent startup messages
- [ ] Test each endpoint with curl
- [ ] (Optional) Set Slack webhooks in .env
- [ ] Run for 5+ minutes and observe agent behavior
- [ ] Verify all agents are polling successfully
- [ ] Plan Path C integration with your agents

---

## 🔄 Next: Path C Integration

Now that Tier 2 is running, integrate with your existing agents:

**See:** `HEALTH_MONITOR_AGENT_INTEGRATION.md` for patterns

**Quick example:**
```typescript
// In your existing agent:
import { getHealthMonitor, getDomainAggregator } from './agents';

// Add monitoring
const health = getHealthMonitor();
if (health.isAlertState()) {
  // Skip doing work if system is degraded
  return;
}

// Use domain-level insights
const domains = getDomainAggregator();
const unhealthy = domains.getUnhealthyDomains();
// React to unhealthy domains
```

---

## 📊 File Manifest

**New Agent Files Created:**
- ✅ `server/agents/healthMonitorAgent.ts` (Tier 1, 580 lines)
- ✅ `server/agents/domainAggregatorAgent.ts` (Tier 2A, 400 lines)
- ✅ `server/agents/capacityPlannerAgent.ts` (Tier 2B, 450 lines)
- ✅ `server/agents/performanceOptimizerAgent.ts` (Tier 2C, 420 lines)

**Modified Files:**
- ✅ `server/index.ts` (Added imports, initialization)
- ✅ `.env` (Added Slack webhook variables)

**Existing Files (Used):**
- `server/services/endpointMetricsCollector.ts`
- `server/middleware/metricsMiddleware.ts`
- `server/routes/apiRegistry.ts`

---

## 🚀 Launch & Monitor

**Ready to go!**

```bash
npm run dev

# Watch console output:
# In first 5 seconds:
# 🏥 Health Monitor Agent started
# 🌐 Domain Aggregator Agent started
# 📈 Capacity Planner Agent started
# ⚡ Performance Optimizer Agent started

# After 15 seconds:
# [HEALTH_MONITOR] Health snapshot: status=healthy, errorRate=0.5%

# After 2 minutes:
# [PERFORMANCE_OPTIMIZER] Slowest endpoints poll complete

# After 5 minutes:
# [DOMAIN_AGGREGATOR] Domain snapshots: admin=healthy, strategies=degrading

# After 10 minutes:
# [CAPACITY_PLANNER] Hotspots identified, scaling recommendations ready
```

---

## 📞 Support

**Issues?** Check in this order:
1. Build output: `npm run build:backend 2>&1 | tail -100`
2. Console logs: Look for agent startup messages
3. Agent files: Check syntax in each agent .ts file
4. Integration: Verify imports in server/index.ts

**All clean?** → Proceed to test endpoints and then Path C integration.

---

**✅ Path B: Complete!**

**Next:** Path C - Integrate these agents with your existing infrastructure
