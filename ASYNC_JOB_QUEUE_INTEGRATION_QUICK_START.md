# Async Job Queue - Quick Integration Guide

## ⚡ 5-Minute Server Integration

### Step 1: Import Workers in server/index.ts

```typescript
import { initializeWorkers, shutdownWorkers } from './workers';
```

### Step 2: Register Workers After Express Setup

```typescript
import express from 'express';
import { initializeWorkers, shutdownWorkers } from './workers';
import jobRoutes from './routes/jobs';

const app = express();

// ... all your existing middleware setup ...

// === ADD THIS SECTION ===
// Initialize job workers
try {
  await initializeWorkers();
  console.log('✅ Job workers initialized');
} catch (error) {
  console.error('❌ Failed to initialize workers:', error);
  process.exit(1);
}

// Register job status routes
app.use('/api/jobs', jobRoutes);
// === END NEW SECTION ===

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close();
  await shutdownWorkers();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close();
  await shutdownWorkers();
});
```

---

## ✅ Verification Checklist

### 1. Dependencies Installed
```bash
npm list bull bullmq redis
```
Should show all three packages installed.

### 2. Routes Updated Correctly
These files should import `jobQueueService`:
- [server/routes/investment-pools.ts](server/routes/investment-pools.ts) ✅
- [server/routes/strategiesConsolidated.ts](server/routes/strategiesConsolidated.ts) ✅
- [server/routes/morio.ts](server/routes/morio.ts) ✅

### 3. Worker Files Created
```bash
ls -la server/workers/
```
Should exist:
- `strategyJobWorker.ts` ✅
- `morioJobWorker.ts` ✅
- `poolVaultJobWorker.ts` ✅
- `index.ts` ✅

### 4. Services Created
```bash
ls -la server/services/ | grep jobQueue
```
Should exist:
- `jobQueueService.ts` ✅

### 5. Routes Created
```bash
ls -la server/routes/ | grep jobs
```
Should exist:
- `jobs.ts` ✅

---

## 🧪 Testing the Implementation

### Test 1: Strategy Backtest Job Queue

```bash
# 1. Start server
npm run dev

# 2. In another terminal, queue a backtest job
curl -X POST http://localhost:3000/api/strategies/strat123/backtest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timerange": "20230101-20231231",
    "stake": 0.01
  }'

# 3. Should return 202 with jobId
# Response:
# {
#   "success": true,
#   "message": "Backtest queued",
#   "jobId": "strategy-backtest:abc-def-123",
#   "statusUrl": "/api/jobs/strategy-backtest:abc-def-123/status"
# }

# 4. Poll job status
curl http://localhost:3000/api/jobs/strategy-backtest:abc-def-123/status

# 5. Wait for completion and get results
curl http://localhost:3000/api/jobs/strategy-backtest:abc-def-123/result
```

### Test 2: Morio Chat Job Queue

```bash
# Queue a chat job
curl -X POST http://localhost:3000/api/morio/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Analyze my portfolio"
  }'

# Response should be 202 with jobId
# Poll and retrieve results as above
```

### Test 3: Queue Statistics

```bash
# Check strategy-backtest queue stats
curl http://localhost:3000/api/jobs/queue/strategy-backtest/stats

# Response:
# {
#   "queueType": "strategy-backtest",
#   "active": 1,
#   "waiting": 3,
#   "completed": 42,
#   "failed": 0
# }
```

---

## 🐛 Troubleshooting

### Issue: Workers not initializing
**Solution:** Check Redis connection
```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Check Redis is running
ps aux | grep redis
```

### Issue: Jobs stuck in 'waiting'
**Solution:** Check worker processors are registered
```bash
# Check server logs for:
# ✅ Job workers initialized
# If missing, verify initializeWorkers() is called in server.ts
```

### Issue: Job returns status 'failed'
**Solution:** Check worker logs
```bash
# See error message in job result
curl http://localhost:3000/api/jobs/[jobId]/result

# Look for "error" field with failure reason
```

### Issue: TypeScript compilation errors
**Solution:** Verify all files created with correct imports
```bash
npm run build
# Should compile with zero errors
```

---

## 📊 Performance Baseline

After integration, measure:

```bash
# Before (blocking):
time curl -X POST /api/strategies/123/backtest

# After (non-blocking):
# Response time should be ~50ms instead of 20-30 seconds

# Test concurrent requests don't block
ab -n 10 -c 5 http://localhost:3000/api/strategies/123/backtest
# All requests should complete in <200ms
```

---

## 🔍 Monitoring Commands

```bash
# Check queue depth
curl http://localhost:3000/api/jobs/queue/strategy-backtest/stats

# View Redis keys for debugging
redis-cli keys "job:*"

# Check specific job status
curl http://localhost:3000/api/jobs/[jobId]/status

# Monitor server logs
npm run dev | grep "Job"
```

---

## 🚀 Next Steps After Integration

1. **Test end-to-end** with actual backtest/optimize requests
2. **Monitor queue stats** for 1 hour under normal load
3. **Verify result storage** in Redis (use `/api/jobs/:jobId/result`)
4. **Set up alerting** for failed jobs
5. **Document in team wiki** with these endpoints

---

## 📝 Rate Limits Applied

Once running, these rate limits are active:

| Endpoint | Limit |
|----------|-------|
| POST /strategies/:id/backtest | 20/10min |
| POST /strategies/:id/optimize | 10/10min |
| POST /morio/chat | 30/1min |
| POST /morio/analyze | 10/5min |
| POST /pools/:id/trigger-rebalance | 5/10min |

Test rate limiting with rapid requests:
```bash
# This should succeed (first request)
curl http://localhost:3000/api/morio/chat

# After 30 requests in 1 minute, should get 429 Too Many Requests
# Try again in 60 seconds
```

---

## 🎯 Success Indicators

After integration:
- ✅ POST to backtest/optimize returns 202 (not 200)
- ✅ Response time <100ms (not 20-30 seconds)
- ✅ Can poll job status via `/api/jobs/:jobId/status`
- ✅ Results available after completion
- ✅ Queue stats show "active" workers processing
- ✅ Server logs show "Job workers initialized"

