# 🤖 Health Monitor - Integration Guide for Your Agents

**Purpose:** Show how your existing agents can monitor endpoint health in real-time  
**Use case:** Auto-remediation, capacity planning, performance optimization  
**Polling cost:** ~40 bytes per request, <50ms latency

---

## 📊 Available Endpoints for Your Agents

All endpoints return JSON and are optimized for agent polling (lightweight, fast):

### 1️⃣ Overall Health (Check First)

```
GET /api/docs/health
```

**Response:**
```json
{
  "status": "healthy",
  "overallErrorRate": 2.34,
  "unhealthyEndpoints": 2,
  "avgLatency": 235.5,
  "p99Latency": 1050.3,
  "timestamp": "2026-03-01T10:30:45.123Z"
}
```

**Use for:** Quick system-wide health check  
**Agent decision:** If `status !== "healthy"`, investigate further

---

### 2️⃣ Lightweight Summary (Fast Polling)

```
GET /api/docs/stats/summary
```

**Response:**
```json
{
  "summary": {
    "totalEndpoints": 877,
    "totalCalls": 2_450_123,
    "avgLatency": 235.5,
    "p50Latency": 150.2,
    "p95Latency": 823.4,
    "p99Latency": 1050.3,
    "errorCount": 12_345,
    "errorRate": 2.34
  },
  "timestamp": "2026-03-01T10:30:45.123Z"
}
```

**Use for:** Frequent polling (every 30-60 seconds)  
**Agent decision:** Track trends, detect degradation over time

---

### 3️⃣ Only Unhealthy Endpoints (Error Rate > 5%)

```
GET /api/docs/stats/unhealthy
```

**Response:**
```json
{
  "timestamp": "2026-03-01T10:30:45.123Z",
  "unhealthyEndpoints": [
    {
      "path": "/api/admin/users",
      "method": "POST",
      "callCount": 523,
      "errorCount": 45,
      "errorRate": 8.6,
      "avgLatency": 1234,
      "p99Latency": 2500,
      "lastAccessed": "2026-03-01T10:30:42.000Z",
      "statusCodes": { "200": 478, "500": 45 }
    }
    // ... more unhealthy endpoints
  ]
}
```

**Use for:** Auto-remediation (find broken endpoints quickly)  
**Agent decision:** If `unhealthyEndpoints.length > 5`, trigger alerts

---

### 4️⃣ Slowest Endpoints (By Average Latency)

```
GET /api/docs/stats/slowest?limit=10
```

**Response:**
```json
{
  "timestamp": "2026-03-01T10:30:45.123Z",
  "slowest": [
    {
      "path": "/api/strategies/backtest",
      "method": "POST",
      "avgLatency": 3450,
      "p99Latency": 5200,
      "callCount": 234,
      "errorRate": 0.5
    },
    {
      "path": "/api/treasury-intelligence/forecast",
      "method": "GET",
      "avgLatency": 2800,
      "p99Latency": 4100,
      "callCount": 89,
      "errorRate": 0.2
    }
    // ... more
  ]
}
```

**Use for:** Performance optimization decisions  
**Agent decision:** If P99 > 3s, allocate more resources to that service

---

### 5️⃣ Highest Error Rate Endpoints

```
GET /api/docs/stats/errors?limit=10
```

**Response:**
```json
{
  "timestamp": "2026-03-01T10:30:45.123Z",
  "errors": [
    {
      "path": "/api/admin/users",
      "method": "POST",
      "callCount": 523,
      "errorCount": 45,
      "errorRate": 8.6,
      "avgLatency": 1234,
      "p99Latency": 2500,
      "lastAccessed": "2026-03-01T10:30:42.000Z"
    }
    // ... more
  ]
}
```

**Use for:** Quality assurance and debugging  
**Agent decision:** Alert engineering team to broken endpoints

---

### 6️⃣ Metrics by Domain

```
GET /api/docs/stats/by-domain
```

**Response:**
```json
{
  "timestamp": "2026-03-01T10:30:45.123Z",
  "domains": {
    "/api/admin": {
      "endpointCount": 50,
      "callCount": 12_350,
      "avgLatency": 145.2,
      "p99Latency": 850.3,
      "errorRate": 1.2,
      "isHealthy": true
    },
    "/api/strategies": {
      "endpointCount": 35,
      "callCount": 8_923,
      "avgLatency": 1200,
      "p99Latency": 3400,
      "errorRate": 0.5,
      "isHealthy": true
    },
    "/api/payments": {
      "endpointCount": 28,
      "callCount": 234_523,
      "avgLatency": 450.5,
      "p99Latency": 1200,
      "errorRate": 5.6,
      "isHealthy": false
    }
    // ... more domains
  }
}
```

**Use for:** Domain-level health checks  
**Agent decision:** If a domain's errorRate > 5%, page that team

---

### 7️⃣ Specific Domain Metrics

```
GET /api/docs/stats/domain/:domain
# Example: GET /api/docs/stats/domain/admin
```

**Response:**
```json
{
  "timestamp": "2026-03-01T10:30:45.123Z",
  "domain": "admin",
  "summary": {
    "endpointCount": 50,
    "callCount": 12_350,
    "avgLatency": 145.2,
    "p99Latency": 850.3,
    "errorRate": 1.2,
    "isHealthy": true
  },
  "endpoints": [
    {
      "path": "/api/admin/dashboard",
      "method": "GET",
      "callCount": 523,
      "errorCount": 4,
      "errorRate": 0.8,
      "avgLatency": 120
    }
    // ... all endpoints in domain
  ]
}
```

**Use for:** Deep-dive analysis of a specific domain  
**Agent decision:** Analyze all endpoints in `/api/payments` to find the broken one

---

## 🤖 Agent Integration Patterns

### Pattern 1: Health Check Agent

```typescript
// Poll every 30 seconds
async function healthCheckAgent() {
  const response = await fetch('http://localhost:5000/api/docs/health');
  const health = await response.json();
  
  if (health.status !== 'healthy') {
    console.log('⚠️  System degraded:', health);
    notifyOps();
  }
}

setInterval(healthCheckAgent, 30_000);
```

### Pattern 2: Performance Monitor Agent

```typescript
// Poll every 60 seconds for slow endpoints
async function performanceMonitorAgent() {
  const response = await fetch('http://localhost:5000/api/docs/stats/slowest?limit=5');
  const { slowest } = await response.json();
  
  slowest.forEach(endpoint => {
    if (endpoint.p99Latency > 3000) {
      console.log(`🐌 SLOW: ${endpoint.path} (p99=${endpoint.p99Latency}ms)`);
      autoScaleService(endpoint.path);
    }
  });
}

setInterval(performanceMonitorAgent, 60_000);
```

### Pattern 3: Error Rate Detector Agent

```typescript
// Poll every 30 seconds for high error rates
async function errorDetectorAgent() {
  const response = await fetch('http://localhost:5000/api/docs/stats/errors?limit=20');
  const { errors } = await response.json();
  
  errors.forEach(endpoint => {
    if (endpoint.errorRate > 5) {
      console.log(`❌ ERROR: ${endpoint.path} (${endpoint.errorRate}% errors)`);
      rollbackRecentDeploy();
    }
  });
}

setInterval(errorDetectorAgent, 30_000);
```

### Pattern 4: Domain Health Aggregator Agent

```typescript
// Poll every 5 minutes for domain-level insights
async function domainHealthAgent() {
  const response = await fetch('http://localhost:5000/api/docs/stats/by-domain');
  const { domains } = await response.json();
  
  Object.entries(domains).forEach(([domain, stats]) => {
    if (!stats.isHealthy) {
      console.log(`⚠️  Domain ${domain} is unhealthy: ${stats.errorRate}% errors`);
      notifyDomainOwner(domain);
    }
  });
}

setInterval(domainHealthAgent, 5 * 60 * 1000);
```

### Pattern 5: Capacity Planning Agent

```typescript
// Poll every 10 minutes for trend analysis
async function capacityPlannerAgent() {
  const response = await fetch('http://localhost:5000/api/docs/stats');
  const { summary, endpoints } = await response.json();
  
  // Find busiest endpoints
  const busiest = endpoints
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, 10);
  
  busiest.forEach(endpoint => {
    if (endpoint.callCount > 100_000) {
      console.log(`📊 High traffic: ${endpoint.path} (${endpoint.callCount} calls)`);
      forecastCapacity(endpoint);
    }
  });
}

setInterval(capacityPlannerAgent, 10 * 60 * 1000);
```

---

## 📈 Polling Recommendations

| Agent Type | Endpoint | Interval | Priority |
|------------|----------|----------|----------|
| **Health Monitor** | `/api/docs/health` | 15s | Critical |
| **Performance Monitor** | `/api/docs/stats/slowest?limit=10` | 30s | High |
| **Error Detector** | `/api/docs/stats/errors?limit=20` | 30s | High |
| **Domain Aggregator** | `/api/docs/stats/by-domain` | 5m | Medium |
| **Capacity Planner** | `/api/docs/stats` | 10m | Medium |
| **Doc Sync** | `/api/docs/stats/by-domain` | 1h | Low |

---

## 💡 Real-World Examples

### Example 1: Auto-Recovery on Error Spike

```typescript
let lastErrorRate = 0;

async function autoRecoveryAgent() {
  const response = await fetch('http://localhost:5000/api/docs/stats/summary');
  const { summary } = await response.json();
  
  // Detect sharp increase
  if (summary.errorRate > lastErrorRate * 1.5 && summary.errorRate > 3) {
    console.log('📈 Error spike detected, initiating recovery...');
    
    // Action: Kill and restart the most-error-prone service
    const { errors } = await fetch('http://localhost:5000/api/docs/stats/errors?limit=1').then(r => r.json());
    const worstService = extractService(errors[0].path);
    
    restartService(worstService);
    await sleep(5000);
    
    // Verify recovery
    const after = await fetch('http://localhost:5000/api/docs/stats/summary').then(r => r.json());
    if (after.summary.errorRate < 3) {
      sendSlack('✅ Auto-recovery successful');
    }
  }
  
  lastErrorRate = summary.errorRate;
}
```

### Example 2: Intelligent Load Balancing

```typescript
async function loadBalancingAgent() {
  const response = await fetch('http://localhost:5000/api/docs/stats/by-domain');
  const { domains } = await response.json();
  
  // Find slowest domain
  const slowest = Object.entries(domains)
    .sort((a, b) => b[1].p99Latency - a[1].p99Latency)[0];
  
  // Route new requests elsewhere if too slow
  if (slowest[1].p99Latency > 2000) {
    console.log(`Reducing traffic to ${slowest[0]}`);
    updateLoadBalancer({
      domain: slowest[0],
      weight: 0.5 // Half normal traffic
    });
  }
}
```

---

## 🔗 Connection Details

**Base URL:** `http://localhost:5000` (or your production URL)  
**Protocol:** HTTP  
**Format:** JSON  
**Authentication:** None required (monitoring endpoints are public)  
**Timeout:** 30 seconds recommended  
**Rate limits:** No rate limiting on monitoring endpoints

---

## ✅ Integration Checklist

- [ ] Test each endpoint with curl to see response format
- [ ] Identify which endpoints your agents need
- [ ] Set up polling intervals based on recommendations above
- [ ] Implement error handling (network failures, timeouts)
- [ ] Add logging to track agent decisions
- [ ] Test with actual endpoint degradation (manual tests)
- [ ] Set up Slack/email notifications for critical events
- [ ] Monitor agent resource usage (should be minimal)

---

## 🚀 Next Steps

1. **Start with Health Check Agent** (simplest, highest value)
2. **Add Error Detector Agent** (catches bugs immediately)
3. **Expand to Performance & Domain agents** (longer-term optimization)
4. **Consider Capacity Planner** (proactive resource allocation)

---

**Ready to integrate?** Pick an endpoint above and start with a simple curl test!
