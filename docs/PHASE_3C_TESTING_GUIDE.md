# Phase 3C Testing Guide
**Quick Start**: January 23, 2026

---

## Quick Start - 5 Minutes

### 1. Start Server
```bash
npm run dev
```

**Watch for logs**:
```
[STARTUP] Initializing metrics aggregation jobs...
[STARTUP] Daily aggregations scheduled to run in XXX minutes at 2 AM UTC
[STARTUP] ✅ Scheduled aggregation jobs initialized
```

### 2. Test Health Endpoint
Open in browser or terminal:
```bash
curl http://localhost:5000/admin/jobs/health
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "message": "...",
    "jobsMonitored": 2
  }
}
```

### 3. Check Job Stats
```bash
curl http://localhost:5000/admin/jobs/stats
```

Should show both "Hourly Aggregations" and "Daily Aggregations"

---

## Full Testing Checklist

### Phase 1: Server Startup (5 min)
- [ ] Server starts without errors
- [ ] See "[STARTUP] Initializing metrics aggregation jobs" log
- [ ] See "[STARTUP] ✅ Scheduled aggregation jobs initialized" log
- [ ] Server running on port 5000

### Phase 2: Job Execution (2 min)
- [ ] First hourly job runs immediately (watch logs)
- [ ] See "📊 Job started: Hourly Aggregations"
- [ ] See aggregation logs (platform metrics, defi metrics)
- [ ] See "✅ Job completed: Hourly Aggregations"

### Phase 3: Monitoring Endpoints (5 min)

#### Test System Health
```bash
curl http://localhost:5000/admin/jobs/health
```
✅ Should return status: "healthy"

#### Test All Job Stats
```bash
curl http://localhost:5000/admin/jobs/stats
```
✅ Should list 2 jobs with execution history

#### Test Specific Job Stats
```bash
curl http://localhost:5000/admin/jobs/stats/Hourly%20Aggregations
```
✅ Should show detailed stats for hourly job

#### Test Job History
```bash
curl http://localhost:5000/admin/jobs/history/Hourly%20Aggregations?limit=5
```
✅ Should list last 5 executions

### Phase 4: Database Verification (5 min)

Connect to PostgreSQL and check:
```sql
-- Check metrics tables have data
SELECT COUNT(*) as record_count FROM platform_metrics;
SELECT COUNT(*) as record_count FROM defi_protocol_metrics;

-- Check most recent records
SELECT * FROM platform_metrics ORDER BY id DESC LIMIT 1;
```

✅ Should see recent timestamps (within last hour)

### Phase 5: Timing Verification (1 min)

**Next Hourly Run**: 
- Note current time
- Should run again in ~60 minutes
- Watch logs for "📊 Job started: Hourly Aggregations"

**Next Daily Run**:
- Should run at 2 AM UTC tomorrow
- Or today if before 2 AM UTC

---

## Monitoring Commands

### Real-Time Job Monitoring
```bash
# Watch logs for job execution
npm run dev 2>&1 | grep -E "(Job|Aggregations|completed|failed)"
```

### Check Database Growth
```bash
# In PostgreSQL
SELECT tablename, 
       (SELECT COUNT(*) FROM pg_stat_user_tables 
        WHERE relname = tablename) as row_count
FROM pg_tables 
WHERE table_name LIKE '%metrics%' 
ORDER BY tablename;
```

### Monitor Memory Usage
```bash
# Check Node.js memory
# In another terminal while server runs
ps aux | grep "node.*index"
```

---

## Common Issues & Solutions

### Issue: Jobs Not Running

**Check 1**: Logs show initialization
```bash
grep "Scheduled aggregation jobs initialized" <logs>
```

**Check 2**: Database is accessible
```bash
curl http://localhost:5000/admin/jobs/health
```

**Check 3**: Verify timing
```bash
# Check if first hourly job completed
curl http://localhost:5000/admin/jobs/history/Hourly%20Aggregations
```

### Issue: High Memory Usage

**Solution**: 
```bash
# Reset job history
curl -X POST http://localhost:5000/admin/jobs/reset-all
```

### Issue: Jobs Failing

**Check logs**:
```bash
npm run dev 2>&1 | grep -E "❌|error|Error"
```

**Check endpoint**:
```bash
curl http://localhost:5000/admin/jobs/stats
```

Look for failed jobs and error messages

---

## Expected Metrics After Running

### After 1 Hour
- ✅ "Hourly Aggregations" executed 2 times (startup + 60 min)
- ✅ Success rate: 100%
- ✅ Average duration: 1-3 seconds
- ✅ Database records: ~300+ new rows

### After 24 Hours
- ✅ "Hourly Aggregations" executed 24-25 times
- ✅ "Daily Aggregations" executed 1 time
- ✅ Success rate: 99%+
- ✅ Database records: ~10,000+ total across all tables

---

## Performance Benchmarks

| Metric | Target | Actual |
|--------|--------|--------|
| Job Duration | <3s | TBD |
| Success Rate | >99% | TBD |
| Memory Growth | <10MB/hr | TBD |
| Database Records/hr | ~300-500 | TBD |

---

## Endpoint Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/jobs/health` | GET | Overall system health |
| `/admin/jobs/stats` | GET | All job statistics |
| `/admin/jobs/stats/:jobName` | GET | Specific job stats |
| `/admin/jobs/history/:jobName` | GET | Execution history |
| `/admin/jobs/reset/:jobName` | POST | Clear job history |
| `/admin/jobs/reset-all` | POST | Clear all histories |

---

## Logs to Watch

### Initialization Phase
```
[STARTUP] Initializing metrics aggregation jobs...
[STARTUP] Daily aggregations scheduled to run in XXX minutes at 2 AM UTC
[STARTUP] ✅ Scheduled aggregation jobs initialized
```

### Job Execution Phase
```
📊 Job started: Hourly Aggregations
Platform metrics aggregated successfully
DeFi protocols metrics aggregated
✅ Job completed: Hourly Aggregations
```

### Failure Phase (if applicable)
```
❌ Job failed: Hourly Aggregations
  error: Database connection timeout
  stack: Error: Database connection timeout at...
```

---

## Next Steps

After verification:
1. ✅ Monitor for 24 hours to ensure daily job runs
2. ✅ Check database for data quality
3. ✅ Integrate with admin dashboard
4. ✅ Set up alerting for failed jobs
5. ✅ Prepare for production deployment

---

## Quick Reference

**Start Server**:
```bash
npm run dev
```

**Health Check**:
```bash
curl http://localhost:5000/admin/jobs/health | jq
```

**View All Stats**:
```bash
curl http://localhost:5000/admin/jobs/stats | jq
```

**Monitor Logs**:
```bash
npm run dev 2>&1 | grep -E "(Job|Aggregation|scheduled)"
```

---

**Status**: Ready for Testing ✅
