# Performance Optimization: Three-Tier Data Flow Pattern

**Problem:** Agents writing directly to DB every cycle creates feedback-loop degradation

**Solution:** Three-tier data flow with buffering

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  TIER 1: COMPUTE (Worker Process - Isolated)                   │
│  ────────────────────────────────────────────────────────────   │
│                                                                 │
│  • Agent runs every 60s (or on-demand)                          │
│  • Computes heavy metrics (CPU, memory, DB, Redis state)        │
│  • ❌ Does NOT write to DB                                     │
│  • ✅ Writes ONLY to Redis (fast, buffer)                      │
│                                                                 │
│  Example:                                                       │
│  ```typescript                                                  │
│  const metrics = computeSystemMetrics();                        │
│  await PerformanceOptimizerBufferedWriter.bufferMetrics(       │
│    metrics  // Writes to Redis (30s TTL)                       │
│  );                                                             │
│  ```                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  TIER 2: BUFFER (Redis - Shock Absorber)                        │
│  ────────────────────────────────────────────────────────────   │
│                                                                 │
│  • Stores current metrics (30s TTL)                             │
│  • Accumulates history (5 min window)                           │
│  • ⚡ Instant reads for dashboards (no DB hit)                 │
│  • Survives DB slowness, connection issues                       │
│                                                                 │
│  Redis keys:                                                    │
│  • perf:metrics:current (latest, 30s TTL)                       │
│  • perf:metrics:buffer (last 5 min, 5 min TTL)                  │
│  • perf:metrics:last-flush (timestamp, 10 min TTL)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ▼ (every 5-10 min)
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  TIER 3: ARCHIVE (PostgreSQL - Historical Record)              │
│  ────────────────────────────────────────────────────────────   │
│                                                                 │
│  • Receives aggregated data (1 row per 5 min)                   │
│  • NOT hit on every cycle                                      │
│  • For reporting, post-mortems, trending                        │
│  • Backup/compliance purposes                                   │
│                                                                 │
│  Example aggregated row:                                        │
│  ```sql                                                         │
│  INSERT INTO performance_metrics (                              │
│    timestamp,                                                   │
│    cpu_usage,        -- avg of 5 samples                       │
│    memory_usage,     -- avg of 5 samples                       │
│    db_connections,   -- avg of 5 samples                       │
│    request_count,    -- sum of 5 samples                       │
│    period_start,     -- 5 min ago                              │
│    period_end,       -- now                                    │
│    sample_count      -- 5                                      │
│  ) VALUES (...)                                                │
│  ```                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **DB Write Frequency** | Every 60s | Every 5-10 min |
| **DB Write Rows** | 1 per cycle × N agents | 1 aggregated row per cycle |
| **DB Pressure** | Multiplicative → degradation | Minimal, batched |
| **Dashboard Latency** | Depends on DB | 1ms (Redis hit) |
| **Fault Tolerance** | DB issue = all metrics lost | Redis buffer absorbs outage |
| **Data Loss** | High (realtime) | Low (aggregated snapshots) |

---

## 🚀 Implementation Pattern

### Step 1: Compute & Buffer (60s interval)

```typescript
// In isolated worker process (NOT in API)
export class SystemMetricsWorker {
  async run(): Promise<void> {
    // Compute metrics
    const metrics = {
      timestamp: Date.now(),
      cpuUsage: process.cpuUsage().user,
      memoryUsage: process.memoryUsage().heapUsed,
      dbConnections: await countActiveConnections(),
      redisLatency: await measureRedisLatency(),
      apiLatency: await getAverageLatency(),
      requestCount: this.getRequestCount(),
      errorCount: this.getErrorCount(),
      cacheHitRate: await cacheService.getHitRate(),
      queryCount: await countQueries(),
    };

    // ✅ Write to Redis (fast, safe)
    await PerformanceOptimizerBufferedWriter.bufferMetrics(metrics);
  }
}
```

### Step 2: Serve from Cache (Always)

```typescript
// Dashboard/monitoring endpoints
router.get('/metrics/current', async (req, res) => {
  // This reads from Redis, NOT the DB
  const current = await PerformanceOptimizerBufferedWriter
    .getCurrentMetrics();
  
  res.json(current || defaultMetrics);
});
```

### Step 3: Periodic Flush (5-10 min interval)

```typescript
// In main server process (background job)
// Runs once every 5-10 minutes

async function flushMetricsJob(): Promise<void> {
  // Aggregate Redis buffer (last 5 samples)
  // Write single row to DB
  // Clear Redis buffer
  
  await PerformanceOptimizerBufferedWriter
    .flushBufferedMetricsToDB();
}

// Schedule it
const metrics FlusherJob = new CronJob(
  '*/5 * * * *',  // Every 5 minutes
  async () => {
    try {
      await flushMetricsJob();
    } catch (error) {
      logger.error('[Metrics Flusher] Job failed:', error);
    }
  }
);

metricsFlushJob.start();
```

---

## 🔌 Integration Checklist

### For any agent that writes system metrics:

- [ ] Import `PerformanceOptimizerBufferedWriter`
- [ ] Replace direct DB writes with `bufferMetrics()`
- [ ] Move agent to isolated worker process
- [ ] Add error boundary around compute cycle
- [ ] Test with slow DB (verify Redis fallback works)

### For main server:

- [ ] Add periodic flush job (every 5-10 min)
- [ ] Add metrics endpoint that reads from Redis
- [ ] Create monitoring dashboard (feeds from Redis)
- [ ] Set up alerting on Redis buffer size (>10 samples = stale data)

### For monitoring:

- [ ] Real-time dashboard reads from `perf:metrics:current` (Redis)
- [ ] Historical analysis reads from `performance_metrics` table (DB)
- [ ] Never mix real-time + historical reads in single query

---

## 🛡️ Failure Modes & Recovery

### If Redis goes down:
```
Agent computes → tries to buffer → fails
→ Logs error → continues anyway
→ Next agent cycle retries
→ No crash, no stall
```

Fallback: In-memory metrics for current cycle

### If DB flush fails:
```
Background job runs → aggregates × reads from Redis
→ tries to write DB → fails → defers with error log
→ Next cycle retries → accumulates in Redis
→ When DB recovers, flush catches up
```

### If agent compute spikes:
```
CPU goes to 100% in worker process
→ API process unaffected
→ Both continue independently
→ Buffered metrics show the spike
→ No feedback loop
```

---

## 📈 Metrics Dashboard Example

```typescript
router.get('/admin/performance/dashboard', async (req, res) => {
  // Check authorization
  await requireRole('admin', 'super_admin')(req, res, () => {});

  // All reads from Redis (instant)
  const status = await PerformanceOptimizerBufferedWriter
    .getBufferedMetricsStatus();

  // Get historical trend (from DB)
  const historical = await db
    .select()
    .from(performanceMetrics)
    .orderBy(desc(performanceMetrics.timestamp))
    .limit(288); // Last 24 hours (1 per 5 min)

  res.json({
    current: status.current,
    buffer: {
      size: status.bufferSize,
      isFresh: status.bufferSize > 0,
      lastFlush: status.lastFlush,
    },
    historical,
    health: {
      redisLive: status.current !== null,
      bufferHealthy: status.bufferSize <= 10,
      metricsFlowing: status.lastFlush && 
        Date.now() - status.lastFlush < 600000,
    },
  });
});
```

---

## ⚠️ Common Anti-Patterns

❌ **Don't:**
```typescript
// This defeats the whole pattern
await db.insert(performanceMetrics).values(metrics);
```

✅ **Do:**
```typescript
// Compute → Redis buffer
await PerformanceOptimizerBufferedWriter.bufferMetrics(metrics);
```

---

❌ **Don't:**
```typescript
// Writing to DB every cycle from agent
setInterval(async () => {
  const metrics = compute();
  await db.insert(metrics); // ← This is the problem
}, 60_000);
```

✅ **Do:**
```typescript
// Only buffering
setInterval(async () => {
  const metrics = compute();
  await buffer(metrics); // Redis write (fast)
}, 60_000);

// Separate flush job
setInterval(async () => {
  await flushBufferToDb(); // Aggregated (rare)
}, 300_000);
```

---

## 📊 Query Examples

### Get current metrics (instant):
```typescript
const current = await PerformanceOptimizerBufferedWriter
  .getCurrentMetrics();
// Response time: <1ms (Redis)
```

### Get last 24 hours trend (historical):
```typescript
const history = await db
  .select()
  .from(performanceMetrics)
  .where(gte(
    performanceMetrics.timestamp,
    Date.now() - 86400000 // 24 hours
  ))
  .orderBy(desc(performanceMetrics.timestamp));
// Response time: 50-200ms (DB with index)
```

---

## 🎯 Success Criteria

✅ System is stable when:
1. **Agent compute** isolated (worker process)
2. **Metrics buffer** in Redis (not DB)
3. **Flush job** runs periodically (5-10 min)
4. **Real-time reads** from Redis (<5ms)
5. **Historical reads** from DB (indexed)
6. **No feedback loop** (agent slowness ≠ system slowness)

---

## 📚 Related Files

- [PerformanceOptimizerBufferedWriter.ts](server/services/PerformanceOptimizerBufferedWriter.ts) - Implementation
- [HealthMonitorAgent.ts](server/agents/healthMonitorAgent.ts) - Example agent to migrate
- [server/index.ts](server/index.ts) - Startup integration

---

**Key Principle:** Decouple compute from persistence. Redis absorbs spikes. DB records history.

