# 🏥 Health Monitor Agent - Deployment Guide

**Status:** ✅ Agent built, integrated, and ready to deploy  
**Auto-start:** Yes (starts automatically with server)  
**Poll interval:** 15 seconds  
**Monitoring scope:** All 877+ API endpoints

---

## 📋 Quick Start (5 minutes)

### Step 1: Enable Slack Notifications (Optional)

1. **Create a Slack App** (if you don't have one):
   - Go to https://api.slack.com/apps
   - Click "Create New App"
   - Choose "From scratch"
   - Name it `mtaa-dao-health-monitor`
   - Select your workspace

2. **Enable Incoming Webhooks**:
   - In your app settings, go to "Incoming Webhooks"
   - Click "Add New Webhook to Workspace"
   - Select the channel where alerts should go (e.g., `#system-alerts`)
   - Click "Allow"
   - Copy the webhook URL (looks like: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`)

3. **Add to .env**:
   ```bash
   # In .env file:
   SLACK_WEBHOOK_HEALTH_MONITOR=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

### Step 2: Start the Server

```bash
cd e:\repos\litmajor\mtaa-dao
npm run build:backend  # If not already built
npm run dev           # Starts frontend + backend
```

Expected console output:
```
[STARTUP] ✅ Server listening on port 5000
✅ Real-time metrics reporting job started
🏥 Health Monitor Agent started (polling every 15s)
```

### Step 3: Verify It's Running

In a new terminal, test the health endpoints:

```powershell
# Get overall system health
curl http://localhost:5000/api/docs/health

# Get lightweight summary (what agent polls)
curl http://localhost:5000/api/docs/stats/summary

# Get all endpoint metrics
curl http://localhost:5000/api/docs/stats
```

Expected response from `/api/docs/health`:
```json
{
  "status": "healthy",
  "overallErrorRate": 1.23,
  "unhealthyEndpoints": 0,
  "avgLatency": 145.5,
  "p99Latency": 892.3,
  "timestamp": "2026-03-01T10:30:45.123Z"
}
```

---

## 🚨 Alert Types & Thresholds

The agent monitors these metrics continuously:

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| **Error Rate** | >2.5% | >5% | Slack alert, logs warning |
| **Avg Latency** | >500ms | >1000ms | Auto-alert, check load |
| **P99 Latency** | >1500ms | >3000ms | Investigate DB/cache |
| **Unhealthy Endpoints** | >5 | >10 | Possible cascading failure |

### Alert States

- **🟢 Healthy:** All metrics in normal range
- **🟡 Degraded:** One metric in warning range
- **🔴 Critical:** One or more metrics critical, or cascading failure (>10 unhealthy endpoints)
- **✅ Recovered:** System returns to healthy after alert

---

## 📊 How the Agent Works

### Polling Strategy

```
Every 15 seconds:
├─ GET /api/docs/health (fast, ~10ms)
├─ GET /api/docs/stats/summary (fast, ~20ms)
├─ Analyze metrics
├─ Compare to thresholds
└─ Send alerts if needed
```

### Alert Decision Tree

```
Poll data
  ├─ Error Rate > 5%?
  │  └─ YES → CRITICAL alert → Slack webhook
  │  └─ NO: Error Rate > 2.5%?
  │     └─ YES → WARNING alert (unless already in alert)
  │
  ├─ Avg Latency > 1000ms?
  │  └─ YES → CRITICAL alert → Slack webhook
  │  └─ NO: Avg Latency > 500ms?
  │     └─ YES → WARNING alert
  │
  ├─ P99 Latency > 3000ms?
  │  └─ YES → CRITICAL alert
  │
  ├─ Unhealthy Endpoints > 10?
  │  └─ YES → CASCADING FAILURE alert
  │
  └─ System was in alert + metrics normal?
     └─ YES → RECOVERY alert (system is healing)
```

---

## 🔍 Monitoring the Agent

### Access Agent Data Programmatically

In your code, you can query the agent's internal state:

```typescript
import { getHealthMonitor } from './agents/healthMonitorAgent';

const monitor = getHealthMonitor();

// Current health snapshot
const current = monitor.getCurrentHealth();
// {
//   timestamp: Date,
//   overallErrorRate: number,
//   unhealthyCount: number,
//   avgLatency: number,
//   p99Latency: number,
//   status: 'healthy' | 'degraded' | 'critical'
// }

// Historical data (last 24 hours)
const history = monitor.getHealthHistory(100); // Last 100 snapshots

// 5-minute trend analysis
const trends = monitor.getHealthTrends(300);
// {
//   avgErrorRate: 1.5,
//   peakErrorRate: 5.2,
//   avgLatency: 250,
//   peakLatency: 1200,
//   timeRange: { from, to }
// }

// Check alert state
console.log(monitor.isAlertState()); // true/false
console.log(monitor.getAlertDuration()); // milliseconds or null

// Get all alerts (last 1000)
const alerts = monitor.getAlertHistory();
```

### REST API Endpoints (Agent Uses These)

All endpoints are lightweight and agent-friendly:

```bash
# Current health status (used by agent)
GET /api/docs/health

# Summary stats (used by agent)
GET /api/docs/stats/summary

# Full detailed metrics
GET /api/docs/stats

# Only unhealthy endpoints (error rate > 5%)
GET /api/docs/stats/unhealthy

# N slowest endpoints
GET /api/docs/stats/slowest?limit=20

# N highest error rate endpoints
GET /api/docs/stats/errors?limit=20

# Metrics grouped by domain
GET /api/docs/stats/by-domain

# Metrics for specific domain
GET /api/docs/stats/domain/:domain
```

---

## 🛠️ Configuration Options

Edit these in `.env`:

```bash
# Optional: Slack webhook for alerts
SLACK_WEBHOOK_HEALTH_MONITOR=https://hooks.slack.com/services/...

# In code, customize thresholds:
const healthMonitor = initHealthMonitor(`http://localhost:5000`, {
  pollInterval: 15_000,        // milliseconds
  slackWebhook: process.env.SLACK_WEBHOOK_HEALTH_MONITOR,
  thresholds: {
    errorRateWarning: 2.5,         // %
    errorRateCritical: 5.0,        // %
    latencyWarning: 500,           // ms
    latencyCritical: 1000,         // ms
    p99LatencyWarning: 1500,       // ms
    p99LatencyCritical: 3000,      // ms
    unhealthyEndpointsWarning: 5,
    unhealthyEndpointsCritical: 10,
  }
});
```

---

## 📈 What to Expect

### First 5 Minutes
- Agent polls health endpoints
- All metrics should show as "healthy" in normal operation
- Console logs confirm polling is working:
  ```
  [HEALTH_MONITOR] Polling started
  [HEALTH_MONITOR] Health snapshot: errorRate=0.5%, latency=120ms
  ```

### Over Time
- Agent builds 24-hour historical data (360 snapshots at 15-second intervals)
- Slack channel fills with alerts during degradation, recoveries at end
- Logs in `visibility/metrics-reporting.log` track all events

### Example Slack Alert

```
🚨 ERROR_SPIKE
Error rate at 6.50% (threshold: 5%)

affectedEndpoints: 12
overallErrorRate: 6.5
totalEndpoints: 877

Posted at: 2026-03-01 10:30:45 UTC
```

---

## 🐛 Troubleshooting

### Agent not starting?

1. **Check import in server/index.ts**:
   ```bash
   grep -n "initHealthMonitor" server/index.ts
   ```
   Should show line ~113 and line ~1027

2. **Build might have errors**:
   ```bash
   npm run build:backend
   ```

3. **Check logs for errors**:
   ```bash
   npm run dev 2>&1 | grep "HEALTH_MONITOR"
   ```

### Not receiving Slack alerts?

1. **Verify webhook URL is valid**:
   ```bash
   curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
     -H 'Content-Type: application/json' \
     -d '{"text":"test message"}'
   ```

2. **Check .env is loaded**:
   ```bash
   echo $env:SLACK_WEBHOOK_HEALTH_MONITOR  # PowerShell
   # Should print the webhook URL
   ```

3. **Check agent is polling**:
   ```bash
   curl http://localhost:5000/api/docs/health
   # Should return current health data
   ```

### High false positives?

Adjust thresholds in code (where `initHealthMonitor` is called):
- Increase `errorRateCritical` if normal operation has >5% errors
- Increase `latencyCritical` if average latency is normally >1s
- Increase `unhealthyEndpointsCritical` if many endpoints naturally fluctuate

---

## ✅ Success Criteria

You can consider deployment complete when:

- [x] Server starts without errors
- [x] Agent logs appear: "🏥 Health Monitor Agent started"
- [x] `/api/docs/health` endpoint responds with health data
- [x] Slack webhook configured (or explicitly skipped)
- [x] Agent runs for 1-2 minutes without errors
- [x] Check Slack channel and see nothing urgent (good sign!)

---

## 📚 Next Steps

After deployment:

- **Short-term:** Monitor Slack channel for alerts
- **Medium-term:** Build [Tier 2 agents](AGENT_DISTRIBUTION_STRATEGY.md) (Domain Aggregator, Capacity Planner)
- **Long-term:** Integrate with your existing agent suite

---

## 📞 Support

If agent crashes or behaves unexpectedly:

1. Check `server/agents/healthMonitorAgent.ts` for the implementation
2. Review `server/index.ts` for where it's initialized
3. Check logs in `visibility/metrics-reporting.log`
4. Verify all endpoints return valid JSON: `/api/docs/health`, `/api/docs/stats/summary`

---

**Deployment Status:** Ready to go live ✅  
**Monitoring uptime:** 24/7 automatic  
**Zero manual intervention:** Required after startup
