# Async Job Queue - Pre-Deployment Verification Checklist

**Complete this checklist before deploying to production**

---

## 📋 Pre-Deployment Checks

### Infrastructure Requirements
- [ ] Redis server running and accessible
  - Command: `redis-cli ping` → should return `PONG`
  - Port: 6379 (or configured PORT)
  - Persistence: AOF or RDB enabled for job recovery

- [ ] Node.js ≥ 14.x installed
  - Command: `node --version`

- [ ] npm dependencies installed
  - Command: `npm list bull bullmq redis`
  - All three should show version numbers

- [ ] Environment variables set
  - `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`
  - Check: `echo $REDIS_URL`

### Code Compilation
- [ ] Zero TypeScript compilation errors
  - Command: `npm run build`
  - Expected: No errors, only warnings if any

- [ ] All new files exist and are readable
  - [ ] `server/services/jobQueueService.ts` (298 lines)
  - [ ] `server/workers/strategyJobWorker.ts` (122 lines)
  - [ ] `server/workers/morioJobWorker.ts` (126 lines)
  - [ ] `server/workers/poolVaultJobWorker.ts` (108 lines)
  - [ ] `server/workers/index.ts` (65 lines)
  - [ ] `server/routes/jobs.ts` (151 lines)

- [ ] Modified route files updated correctly
  - [ ] `server/routes/investment-pools.ts` imports jobQueueService
  - [ ] `server/routes/strategiesConsolidated.ts` imports jobQueueService
  - [ ] `server/routes/morio.ts` imports jobQueueService and rateLimitPerUser

### Server Integration
- [ ] `initializeWorkers()` call added in server startup
  - Location: `server/index.ts` or `server/app.ts`
  - Called: After middleware setup, before listen()
  - Check: Server logs show "✅ Job workers initialized"

- [ ] Job routes registered
  - Code: `app.use('/api/jobs', jobRoutes)`
  - Check: GET requests to `/api/jobs/test-123/status` return 404 (job doesn't exist)

- [ ] Graceful shutdown configured
  - [ ] `SIGTERM` handler calls `shutdownWorkers()`
  - [ ] `SIGINT` handler calls `shutdownWorkers()`

---

## 🧪 Functionality Tests

### Test 1: Queue Endpoints Return 202

```bash
# Strategy Backtest
curl -i -X POST http://localhost:3000/api/strategies/test123/backtest \
  -H "Authorization: Bearer TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timerange":"20230101-20231231"}'

# Expected: HTTP 202 Accepted (not 200)
# Has "jobId" in response
```

- [ ] Strategy backtest endpoint returns 202
- [ ] Strategy optimize endpoint returns 202
- [ ] Morio chat endpoint returns 202
- [ ] Morio analyze endpoint returns 202
- [ ] Pool rebalance endpoint returns 202

### Test 2: Response Latency

```bash
# Measure response time (should be <100ms)
time curl -s -X POST http://localhost:3000/api/strategies/xyz/backtest \
  -H "Authorization: Bearer TOKEN" > /dev/null

# Expected: < 100ms (not 20+ seconds)
```

- [ ] All async endpoints respond in <100ms
- [ ] No blocking/waiting visible
- [ ] Server doesn't seem to hang

### Test 3: Job Status Endpoints

```bash
# Get job status
curl http://localhost:3000/api/jobs/[jobId]/status

# Expected: JSON with status, progress, error
# Status should be 'processing', 'completed', or 'failed'
```

- [ ] GET `/api/jobs/:jobId` returns full job object
- [ ] GET `/api/jobs/:jobId/status` returns minimal status
- [ ] GET `/api/jobs/:jobId/result` returns result or 202 if processing
- [ ] GET `/api/jobs/queue/:type/stats` returns queue metrics
- [ ] 404 returned for non-existent jobIds

### Test 4: Rate Limiting

```bash
# Make 30+ requests in 1 minute to morio/chat
for i in {1..35}; do
  curl -X POST http://localhost:3000/api/morio/chat \
    -H "Authorization: Bearer TOKEN"
done

# Expected: First 30 succeed, remainder get 429 Too Many Requests
```

- [ ] Rate limits are enforced
- [ ] 429 returned when limit exceeded
- [ ] Rate limit resets after window expires
- [ ] Limits are per-user (different users have separate limits)

### Test 5: Authentication

```bash
# Request without token
curl -X POST http://localhost:3000/api/strategies/xyz/backtest

# Expected: 401 Unauthorized
```

- [ ] Endpoints require authentication
- [ ] Invalid tokens rejected
- [ ] DAO membership checks work (if applicable)

### Test 6: Queue Statistics

```bash
curl http://localhost:3000/api/jobs/queue/strategy-backtest/stats

# Expected:
# {
#   "queueType": "strategy-backtest",
#   "active": 0-2,
#   "waiting": 0-100,
#   "completed": 0+,
#   "failed": 0+
# }
```

- [ ] Stats endpoint returns for each queue type
- [ ] Numbers make sense (active ≤ concurrency limit)
- [ ] Stats update as jobs complete

### Test 7: Error Handling

```bash
# Queue an operation with invalid data
curl -X POST http://localhost:3000/api/strategies/-1/backtest \
  -H "Authorization: Bearer TOKEN"

# Check job status after it processes
curl http://localhost:3000/api/jobs/[jobId]/status

# Job should show status: 'failed' with error message
```

- [ ] Invalid inputs caught before queuing
- [ ] Failed jobs show error messages
- [ ] Workers don't crash on errors
- [ ] Errors are recoverable (next job works)

### Test 8: Progress Tracking

```bash
# Queue a long operation
JOB_ID=$(curl -s -X POST .../backtest | jq -r '.jobId')

# Immediately check progress
curl http://localhost:3000/api/jobs/$JOB_ID/status | jq '.progress'

# Wait 5 seconds and check again
sleep 5
curl http://localhost:3000/api/jobs/$JOB_ID/status | jq '.progress'

# Progress should increase from first to second check
```

- [ ] Progress increases during processing
- [ ] Progress goes from 0 to 100 over operation lifetime
- [ ] Completed jobs show 100
- [ ] Failed jobs show progress at failure point

---

## 📊 Performance Benchmarks

### Baseline Measurements

Take these measurements before deploying:

```bash
# Measure response time over 10 requests
ab -n 10 -c 1 http://localhost:3000/api/backtest

# Record:
# - Mean response time: _______ ms (should be <100ms)
# - Min response time: _______ ms
# - Max response time: _______ ms
```

- [ ] Mean response time <100ms
- [ ] 95th percentile <150ms
- [ ] 99th percentile <200ms
- [ ] No timeouts or errors

### Load Test

```bash
# Test with concurrent requests
ab -n 50 -c 10 http://localhost:3000/api/backtest

# Record:
# - Successful requests: _______ (should be 50)
# - Failed requests: _______ (should be 0)
# - Requests per second: _______ (should be high)
```

- [ ] All 50 requests succeed
- [ ] No request drops
- [ ] Throughput increases with concurrency

---

## 🔍 Monitoring Setup

### Redis Monitoring

```bash
# Watch redis operations
redis-cli monitor

# Look for job:* keys being created and deleted
# Job results should persist ~1 hour then expire
```

- [ ] Redis keys created for job storage
- [ ] No memory bloat (keys expire properly)

### Server Logging

Server logs should show:
- [ ] "✅ Job workers initialized" on startup
- [ ] "[JobQueue] Processing job ..." when jobs queue
- [ ] "[JobQueue] Job completed" when jobs finish
- [ ] No error spam or warnings

### Queue Monitoring Script

Create a monitoring script:
```bash
#!/bin/bash
while true; do
  echo "=== Queue Stats ==="
  curl -s http://localhost:3000/api/jobs/queue/strategy-backtest/stats | jq '.'
  sleep 10
done
```

- [ ] Monitor script can be run continuously
- [ ] Stats show queue is progressing
- [ ] No jobs stuck in 'processing' state

---

## 📝 Documentation Verification

- [ ] [ASYNC_JOB_QUEUE_IMPLEMENTATION.md](ASYNC_JOB_QUEUE_IMPLEMENTATION.md) exists
- [ ] [ASYNC_JOB_QUEUE_INTEGRATION_QUICK_START.md](ASYNC_JOB_QUEUE_INTEGRATION_QUICK_START.md) exists
- [ ] [ASYNC_JOB_QUEUE_CODE_PATTERNS.md](ASYNC_JOB_QUEUE_CODE_PATTERNS.md) exists
- [ ] [ASYNC_JOB_QUEUE_COMPLETE_SUMMARY.md](ASYNC_JOB_QUEUE_COMPLETE_SUMMARY.md) exists
- [ ] Team notified of new endpoints
- [ ] API documentation updated

---

## 🚀 Production Readiness Checklist

- [ ] All above checks completed
- [ ] No TypeScript compilation errors
- [ ] Load tests pass
- [ ] Error handling verified
- [ ] Rate limiting verified
- [ ] Monitoring configured
- [ ] Rollback plan documented
- [ ] Team trained on new behavior
- [ ] Staging environment tested first
- [ ] Production backup created
- [ ] On-call support ready
- [ ] Runbook created for common issues

---

## 📞 Common Issues & Fixes

### Issue: Workers not initializing
**Fix:**
```bash
# Check Redis
redis-cli ping  # Should return PONG

# Check server logs
npm run dev | grep "workers"

# Verify initializeWorkers() is called
# Location: server/index.ts
```

### Issue: Jobs stuck in 'processing'
**Fix:**
```bash
# List all keys related to stuck job
redis-cli keys "job:status:*"

# Delete if truly stuck
redis-cli del job:status:problematic-job-id

# Check worker logs for errors
```

### Issue: Rate limiting too strict/loose
**Fix:**
Edit [server/middleware/rateLimiter.ts](server/middleware/rateLimiter.ts) to adjust:
- `limit` (number of requests)
- `window` (time window in milliseconds)

### Issue: Timeout errors on long operations
**Fix:**
In [server/services/jobQueueService.ts](server/services/jobQueueService.ts):
```typescript
const JOB_TIMEOUTS: Record<JobType, number> = {
  'strategy-backtest': 1800000,  // ← Increase if needed
  // ...
};
```

### Issue: Memory usage too high
**Fix:**
- Reduce job result TTL (1 hour default in jobQueueService)
- Increase worker concurrency limits (to process jobs faster)
- Check for memory leaks in worker functions

---

## ✅ Sign-Off

**Production Readiness:**
- [ ] All checks passing
- [ ] No critical issues remaining
- [ ] Team approval obtained
- [ ] Ready for deployment

**Deployment Date:** __________
**Deployed By:** __________
**Approval By:** __________

---

## 📋 Post-Deployment

After deployment, verify:
- [ ] Workers initialized on startup (check logs)
- [ ] At least 1 job has been queued successfully
- [ ] Job status endpoint returns results
- [ ] Rate limiting is preventing abuse
- [ ] No error spam in logs
- [ ] Redis memory usage is stable

Keep monitoring for 24 hours after deployment.

