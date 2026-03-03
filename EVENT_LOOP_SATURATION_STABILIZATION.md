# 🚀 Event Loop Saturation - Stabilization Implementation

## Overview

Your system is experiencing **event loop saturation** from overlapping job execution. This guide implements guardrails to prevent cascade failures.

---

## 📊 The Problem (Now Fixed)

```
Multiple concurrent jobs (500ms, 10s, 5s intervals)
↓
Each takes longer than interval when DB is slow
↓
New run starts before previous ends
↓
Overlapping execution → event loop congestion
↓
Redis commands queue → stream errors
↓
DB gets slower → more overlap
↓
Complete saturation → Redis/DB failures
```

---

## ✅ Solutions Implemented

### 1. **Job Execution Guard** (`jobExecutionGuard.ts`)

**What it does:**
- Tracks if a job is currently running
- Skips new execution if previous run still executing
- Collects execution metrics (duration, errors, skips)
- Detects saturation patterns

**Key statistic:**
If `skipCount > executionCount * 0.1`, your system is overloaded.

### 2. **System Health Monitor** (`systemHealthMonitor.ts`)

**What it does:**
- Monitors heap memory every 30 seconds
- Tracks CPU usage
- Detects event loop lag
- Alerts when saturation detected

**Health score:** 0-100 (100 = healthy)
- < 50: Critical
- 50-70: Warning
- 70-85: Caution
- 85-100: Healthy

### 3. **Diagnostics API** (`diagnosticsAPI.ts`)

**Endpoints:**

```
GET /diagnostics/jobs
  → Job execution stats & patterns
  
GET /diagnostics/system
  → Heap, CPU, event loop, health score
  
GET /diagnostics/full
  → Complete diagnosis with recommendations
  
GET /diagnostics/job/:name
  → Detailed metrics for specific job
```

---

## 🔧 Integration Steps

### Step 1: Initialize Monitoring at Startup

**In your `server/index.ts` or `server.ts`:**

```typescript
import { initializeSystemMonitoring } from './utils/systemHealthMonitor';
import { JobExecutionRegistry } from './utils/jobExecutionGuard';

// At startup, after express is configured:
initializeSystemMonitoring(); // Starts 30s interval monitoring

logger.info('✅ System monitoring initialized');
```

### Step 2: Register Diagnostics API

**In your Express setup:**

```typescript
import createDiagnosticsRouter from './utils/diagnosticsAPI';

// Add to your routes:
app.use('/api', createDiagnosticsRouter());

logger.info('✅ Diagnostics endpoints available at /api/diagnostics/*');
```

### Step 3: Wrap Existing Jobs with Guards

**Example: CEX Price Collector**

**Before:**
```typescript
setInterval(async () => {
  try {
    await cexPriceCollector.fetchAllExchanges();
  } catch (error) {
    logger.error('Price collection error:', error);
  }
}, 30000);
```

**After:**
```typescript
import { executeGuardedJob } from './utils/jobExecutionGuard';

setInterval(async () => {
  const result = await executeGuardedJob(
    'cex-price-collection',
    () => cexPriceCollector.fetchAllExchanges(),
    {
      skipIfRunning: true,      // Skip if already running
      logDuration: true,         // Log execution time
      timeout: 25000,            // Fail if takes > 25s
    }
  );

  if (!result.executed) {
    logger.warn('[CEX] Skipped price collection - previous run still executing');
  } else if (result.error) {
    logger.error('[CEX] Price collection failed:', result.error.message);
  } else {
    logger.info('[CEX] Price collection completed', {
      duration: result.duration,
    });
  }
}, 30000);
```

---

## 📋 Jobs Selection - Which to Guard

### Priority 1 (DO FIRST):
- ✅ CEX price collection (30s interval)
- ✅ Opportunity engine (10s interval)
- ✅ Price streaming (500ms interval)
- ✅ Metrics aggregation (5m interval)

These are high-frequency and interact with external systems (DB, APIs).

### Priority 2:
- ✅ WebSocket broadcast jobs
- ✅ Defender agent loops
- ✅ Graph propagation

### Priority 3:
- ⏭️ Batch analytics jobs
- ⏭️ Report generation

---

## 🚨 Immediate Diagnostic Steps

### 1. Check Current Status

```bash
# In another terminal while system is running:
curl http://localhost:3000/api/diagnostics/full | jq .
```

Look for:
- `healthScore`: Should be > 70
- `saturated`: Should be `false`
- `recommendations`: Any red flags?

### 2. Monitor in Real-Time

```bash
# Watch system metrics every 10 seconds
watch -n 10 'curl -s http://localhost:3000/api/diagnostics/system | jq "{heap: .current.heap, cpu: .current.cpu, jobs: .current.jobs, saturated: .saturated}"'
```

### 3. Check Job Execution Pattern

```bash
curl http://localhost:3000/api/diagnostics/jobs | jq .jobs
```

Example healthy output:
```json
{
  "cex-price-collection": {
    "isRunning": false,
    "executionCount": 120,
    "skipCount": 0,
    "avgDuration": 2500,
    "maxDuration": 5200,
    "errorCount": 0
  }
}
```

Red flags:
- `skipCount > 10`: System overloaded
- `avgDuration > interval`: Each run takes longer than interval
- `errorCount > 5`: Job is failing

---

## ⚙️ Tuning Strategy

### If System is Healthy (after guards):
```
No changes needed - guards are preventing saturation
Monitor weekly for trends
```

### If Still Seeing Saturation:

**Step 1: Reduce frequency temporarily**

```typescript
setInterval(cexJob, 60000); // Increase from 30s to 60s
```

If system becomes healthy → confirmed saturation. Keep increased frequency.

**Step 2: Check job duration**

```bash
curl http://localhost:3000/api/diagnostics/job/cex-price-collection | jq .stats.avgDuration
```

If > 10s: Database or API is slow, not overtasking.

**Step 3: Increase DB pool**

If confirmed DB issue:

```
POSTGRES_CONNECTION_LIMIT=25  # Increase from default 10-15
```

**Step 4: Add caching layer**

For price data - cache 10-15s instead of fetching on every interval.

---

## 📈 Monitoring Dashboard Integration

### Display in Admin Dashboard:

```typescript
// In your admin metrics endpoint:
import { JobExecutionRegistry } from './jobExecutionGuard';
import { SystemHealthMonitor } from './systemHealthMonitor';

router.get('/admin/system-health', (req, res) => {
  res.json({
    healthScore: SystemHealthMonitor.getHealthScore(),
    jobs: JobExecutionRegistry.getAllStats(),
    saturated: SystemHealthMonitor.isSaturated(),
  });
});
```

Show:
- Health score gauge (0-100)
- Running jobs count
- Skipped jobs trend
- Heap usage over time
- CPU usage graph
- Recommendations panel

---

## 🎯 Success Indicators

After implementation, you should see:

✅ **No more "Stream isn't writeable" errors**
- Guards prevent queue buildup
- Redis operations complete

✅ **Consistent execution timing**
- Jobs finish before next interval
- No execution overlap

✅ **Zero or low skip count**
- `skipCount` stays near 0
- Jobs run on schedule

✅ **Stable memory usage**
- Heap stays under 60%
- No memory leaks over 24h

✅ **Clean logs**
- Diagnostics show "HEALTHY"
- No saturation warnings

---

## 🔄 Ongoing Maintenance

### Daily:
```bash
# Check if any recommendations
curl http://localhost:3000/api/diagnostics/full | jq .recommendations
```

### Weekly:
```bash
# Check trends - heap should be stable
curl http://localhost:3000/api/diagnostics/system | jq .history
```

### Monthly:
```bash
# Review slowest jobs
curl http://localhost:3000/api/diagnostics/jobs | jq '.jobs[] | select(.avgDuration > 5000)'
```

---

## 📝 Example: Complete Refactored Job

```typescript
// server/services/cexPriceBackgroundJob.ts

import { executeGuardedJob } from '../utils/jobExecutionGuard';
import { logger } from '../utils/logger';

export class CEXPriceBackgroundJob {
  private static scheduledInterval: NodeJS.Timer | null = null;

  static startCollection() {
    if (this.scheduledInterval) {
      return; // Already running
    }

    logger.info('[CEX] Starting background price collection job');

    // Start with 30s interval
    this.scheduledInterval = setInterval(
      () => this.runCollection(),
      30_000
    );
  }

  /**
   * Collection run with execution guard
   * If previous run still executing, this one is skipped
   */
  private static async runCollection() {
    const result = await executeGuardedJob(
      'cex-price-collection',
      () => this.collectPrices(),
      {
        skipIfRunning: true,       // Don't overlap
        logDuration: true,          // Log how long it takes
        timeout: 25_000,            // Safety timeout
      }
    );

    if (!result.executed) {
      // Previous run still executing - skip
      logger.debug('[CEX] Price collection skipped (previous run in progress)');
      return;
    }

    if (result.error) {
      logger.error('[CEX] Price collection failed', {
        error: result.error.message,
        duration: result.duration,
      });
      return;
    }

    if (result.duration > 15000) {
      logger.warn('[CEX] Price collection slow', {
        duration: result.duration,
        message: 'Approaching timeout - check database/API latency',
      });
    } else {
      logger.info('[CEX] Price collection completed', {
        duration: result.duration,
      });
    }
  }

  /**
   * The actual collection logic
   */
  private static async collectPrices() {
    // Your existing implementation
    await this.fetchAllExchanges();
  }

  /**
   * Stop the job
   */
  static stopCollection() {
    if (this.scheduledInterval) {
      clearInterval(this.scheduledInterval);
      this.scheduledInterval = null;
      logger.info('[CEX] Background price collection stopped');
    }
  }
}
```

---

## ✅ Next Steps

1. **Add guards to top 5 jobs** (CEX, opportunities, metrics, streaming)
2. **Monitor for 24 hours** - look at diagnostics dashboard
3. **If still seeing issues** - check which jobs are taking longest
4. **Document baseline** - save diagnostics output for comparison
5. **Keep guards indefinitely** - they're a safety mechanism

Your Redis and DB errors should disappear once event loop saturation is prevented.
