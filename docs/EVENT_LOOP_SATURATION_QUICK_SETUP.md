# ⚡ Event Loop Saturation Fix - Quick Setup

## 🎯 What You Have

Three new utilities to prevent Redis/DB cascade failures:

| File | Purpose | Status |
|------|---------|--------|
| `jobExecutionGuard.ts` | Prevents overlapping job runs | ✅ Ready |
| `systemHealthMonitor.ts` | Monitors heap/CPU/eventloop | ✅ Ready |
| `diagnosticsAPI.ts` | Exposes metrics to admin dashboard | ✅ Ready |

---

## 🚀 Setup (5 minutes)

### 1. Initialize Monitoring (Required)

**File:** `server/index.ts` (or your main entry point)

Add at startup (after Express configured, before listening):

```typescript
import { initializeSystemMonitoring } from './utils/systemHealthMonitor';

// ... rest of your setup ...

// Start monitoring BEFORE listening
initializeSystemMonitoring();

// Then start server
server.listen(PORT, () => {
  logger.info(`✅ Server listening on port ${PORT}`);
  logger.info('✅ System monitoring active');
});
```

### 2. Add Diagnostics API (Recommended)

**File:** `server/index.ts` (same file)

```typescript
import createDiagnosticsRouter from './utils/diagnosticsAPI';

// ... express setup ...

// Add diagnostics routes
app.use('/api', createDiagnosticsRouter());

logger.info('📊 Diagnostics available at /api/diagnostics/*');
```

### 3. Wrap Your High-Frequency Jobs

**Choose your top 3-5 jobs** (highest frequency first):

```typescript
import { executeGuardedJob } from './utils/jobExecutionGuard';

// Example: CEX Price Collection
setInterval(async () => {
  const result = await executeGuardedJob(
    'job-name',           // Unique identifier
    async () => {
      // Your job logic here
    },
    {
      skipIfRunning: true,  // Skip if already running
      logDuration: true,    // Log execution time
      timeout: 25000,       // Fail if > 25 seconds
    }
  );

  if (!result.executed) {
    logger.debug('Job skipped - previous run still executing');
  } else if (result.error) {
    logger.error('Job failed:', result.error);
  }
}, 30000); // 30 second interval
```

---

## 📊 Verify It Works

### Check Monitoring is Running

```bash
curl http://localhost:3000/api/diagnostics/system | jq .
```

Should show:
```json
{
  "current": {
    "heap": { "usagePercent": 45 },
    "cpu": { "user": 12, "system": 8 },
    "jobs": { "totalJobs": 3, "runningJobs": 0 }
  },
  "healthScore": 95
}
```

### Monitor Specific Job

```bash
curl http://localhost:3000/api/diagnostics/job/job-name | jq .
```

Look for:
- `stats.skipCount` = 0 (or very low)
- `stats.errorCount` = 0 (or low)
- `stats.avgDuration` < interval

---

## 🚨 If Still Seeing Errors

### Step 1: Verify Guards Are Active

```bash
curl http://localhost:3000/api/diagnostics/full | jq .systemStatus
```

Should say: `"HEALTHY"` or at worst `"WARNING"`

### Step 2: Check Which Jobs Are Slow

```bash
curl http://localhost:3000/api/diagnostics/jobs | jq 'to_entries[] | select(.value.avgDuration > 5000)'
```

If a job's `avgDuration > its interval`:
```
Job runs every 30s but takes 35s to complete
→ Next run overlaps
→ Guards will skip it
→ Check DATABASE or API latency
```

### Step 3: Reduce Job Frequency Temporarily

```typescript
setInterval(job, 60000);  // Increase from 30s to 60s
```

If system becomes healthy → confirmed saturation. Keep higher interval.

### Step 4: Check System Limits

```bash
curl http://localhost:3000/api/diagnostics/full | jq .recommendations
```

Will suggest:
- Increase DB pool
- Optimize slow queries
- Profile CPU usage
- etc.

---

## 📋 Job Wrapping Quick Guide

### High Priority (Do these first):

**CEX Price Collection** (typically 30s)
```typescript
const result = await executeGuardedJob('cex-price-collection', 
  () => cexPriceCollector.fetchAllExchanges(),
  { skipIfRunning: true, timeout: 25000 }
);
```

**Opportunity Engine** (typically 10s)
```typescript
const result = await executeGuardedJob('opportunity-engine',
  () => opportunityEngine.run(),
  { skipIfRunning: true, timeout: 8000 }
);
```

**Metrics Aggregation** (typically 5m)
```typescript
const result = await executeGuardedJob('metrics-aggregation',
  () => MonitoringAggregationService.aggregatePlatformMetrics(),
  { skipIfRunning: true, timeout: 240000 }
);
```

**Price Streaming** (typically 500ms - use higher timeout!)
```typescript
const result = await executeGuardedJob('price-streaming',
  () => priceService.streamPrices(),
  { skipIfRunning: true, timeout: 400 }
);
```

### Medium Priority:

**WebSocket Broadcast**, **Defender Agent**, **Graph Propagation**

### Low Priority:

**Report generation**, **batch analytics** (these aren't real-time critical)

---

## ✅ Success Checklist

After setup, verify:

- [ ] `initializeSystemMonitoring()` called at startup
- [ ] Diagnostics router registered
- [ ] Top 3 jobs wrapped with `executeGuardedJob`
- [ ] All jobs have unique names
- [ ] Timeout set appropriately (< interval)
- [ ] Health score in diagnostics > 70
- [ ] System status shows "HEALTHY" or "WARNING" (not CRITICAL)
- [ ] No recommendations for immediate action
- [ ] Skip count near 0 for all jobs
- [ ] Heap usage stable (not increasing)

---

## 📈 Monitoring (After Setup)

### Daily:
```bash
curl http://localhost:3000/api/diagnostics/full | jq '.recommendations, .systemStatus'
```

### Weekly:
```bash
curl http://localhost:3000/api/diagnostics/system | jq '.history'
```

### If Issues Return:
```bash
curl http://localhost:3000/api/diagnostics/jobs | jq '.diagnostics'
```

---

## 🎯 Expected Results

### Before Guards:
```
❌ "Stream isn't writeable" errors
❌ Redis connection timeouts
❌ Database pool exhaustion
❌ Unpredictable failures
```

### After Guards:
```
✅ No overlapping job execution
✅ Consistent Redis operations
✅ Stable database connections
✅ Predictable, monotonic performance
```

---

## 📞 Troubleshooting

| Problem | Solution |
|---------|----------|
| No jobs registered | Call `JobExecutionRegistry.registerJob()` before scheduling |
| Timeouts too short | Increase `timeout` option, re-test |
| Still seeing skips | Reduce job frequency or increase system resources |
| Health score < 50 | Check recommendations endpoint for specific issues |
| Memory still growing | Check for memory leaks in job implementation |

---

## 💾 Files Created

```
server/utils/
  ├── jobExecutionGuard.ts        (New - guards overlapping execution)
  ├── systemHealthMonitor.ts      (New - heap/CPU monitoring)
  └── diagnosticsAPI.ts           (New - diagnostics endpoints)
  
Documentation:
  ├── EVENT_LOOP_SATURATION_STABILIZATION.md (Detailed guide)
  └── EVENT_LOOP_SATURATION_QUICK_SETUP.md   (This file)
```

---

## 🚀 Ready to Go

You now have visibility into event loop saturation and automatic guards against cascade failures.

**Next:** Wrap your top 5 jobs with `executeGuardedJob` and monitor for 24 hours.
