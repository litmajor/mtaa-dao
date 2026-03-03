# Async Job Queue - Code Patterns & Extension Guide

## Pattern 1: Queueing a Job in a Route Handler

This is the pattern used in updated routes. Use this when you need to move an operation to async:

```typescript
// File: server/routes/strategiesConsolidated.ts

import { jobQueueService } from '../services/jobQueueService';
import { rateLimitPerUser } from '../middleware/rateLimiter';

// POST endpoint that queues a job instead of blocking
router.post('/:strategyId/backtest', authenticateToken, async (req, res) => {
  try {
    const { strategyId } = req.params;
    const userId = req.user.id;
    
    // Apply rate limit (20 requests per 10 minutes per user)
    await rateLimitPerUser(req, 'strategy-backtest', 20, 600000);
    
    // Validate input
    if (!strategyId) {
      return res.status(400).json({ error: 'strategyId required' });
    }
    
    // Queue the job instead of blocking
    const jobId = await jobQueueService.queueJob(
      'strategy-backtest',                    // job type
      {                                        // payload
        userId,
        strategyId,
        timerange: req.body.timerange,
        stake: req.body.stake
      },
      {
        timeout: 1800000                       // 30 minutes
      }
    );
    
    // Return 202 Accepted immediately with job ID
    res.status(202).json({
      success: true,
      message: 'Backtest queued',
      jobId,
      statusUrl: `/api/strategies/${strategyId}/backtest-status/${jobId}`
    });
    
  } catch (error) {
    console.error('Error queuing backtest:', error);
    res.status(500).json({ error: 'Failed to queue backtest' });
  }
});
```

---

## Pattern 2: Worker Processing Function

This pattern handles a queued job in a worker. Use this when creating new worker processors:

```typescript
// File: server/workers/strategyJobWorker.ts

import { Job } from 'bull';
import { jobQueueService } from '../services/jobQueueService';
import type { JobPayload } from '../services/jobQueueService';

// Define the processor function
export async function processBacktest(job: Job<JobPayload>) {
  try {
    const { userId, strategyId, timerange, stake } = job.data;
    
    // Update progress - job started
    await job.progress(10);
    console.log(`[BacktestWorker] Starting backtest for strategy ${strategyId}`);
    
    // Validate data
    if (!strategyId || !timerange) {
      throw new Error('Missing required fields: strategyId, timerange');
    }
    
    // Do the heavy computation
    const result = await strategyFreqtradeIntegration.queueBacktest({
      strategyId,
      timerange,
      stake: stake || 0.01
    });
    
    // Update progress - computation complete
    await job.progress(90);
    
    // Validate result
    if (!result) {
      throw new Error('Backtest returned empty result');
    }
    
    console.log(`[BacktestWorker] Backtest complete for ${strategyId}`);
    
    // Return result (auto-stored in Redis by jobQueueService)
    return {
      success: true,
      strategyId,
      result: result
    };
    
  } catch (error) {
    console.error(`[BacktestWorker] Error in backtest:`, error);
    throw error;  // Will trigger retry and then error status
  }
}

// Register the worker (called from workers/index.ts)
export function registerStrategyWorkers() {
  jobQueueService.registerProcessor(
    'strategy-backtest',
    processBacktest,
    { concurrency: 2 }  // 2 concurrent backtest jobs
  );
}
```

---

## Pattern 3: Job Status Retrieval Endpoint

Use this pattern in the jobs route to expose job status:

```typescript
// File: server/routes/jobs.ts

import express from 'express';
import { jobQueueService } from '../services/jobQueueService';

const router = express.Router();

// Get job status with progress and error details
router.get('/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Retrieve from Redis
    const status = await jobQueueService.getJobStatus(jobId);
    const error = await jobQueueService.getJobError(jobId);
    const progress = await jobQueueService.getJobProgress(jobId);
    
    if (!status) {
      return res.status(404).json({
        error: 'Job not found',
        jobId
      });
    }
    
    res.json({
      jobId,
      status,          // 'processing', 'completed', 'failed'
      progress,        // 0-100
      error: error || null,
      startedAt: await jobQueueService.getJobStartedAt(jobId)
    });
    
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Get full job result (202 while processing)
router.get('/:jobId/result', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const status = await jobQueueService.getJobStatus(jobId);
    
    // Still processing
    if (status === 'processing') {
      const progress = await jobQueueService.getJobProgress(jobId);
      return res.status(202).json({
        message: 'Job still processing',
        status,
        progress,
        jobId
      });
    }
    
    // Failed
    if (status === 'failed') {
      const error = await jobQueueService.getJobError(jobId);
      return res.status(400).json({
        error: error || 'Job failed',
        status: 'failed'
      });
    }
    
    // Completed - return result
    const result = await jobQueueService.getJobResult(jobId);
    return res.json({
      jobId,
      status: 'completed',
      result,
      completedAt: await jobQueueService.getJobCompletedAt(jobId)
    });
    
  } catch (error) {
    console.error('Error getting job result:', error);
    res.status(500).json({ error: 'Failed to get job result' });
  }
});

export default router;
```

---

## Pattern 4: Queue Statistics Endpoint

Expose queue health metrics:

```typescript
// File: server/routes/jobs.ts (continued)

// Get queue statistics
router.get('/queue/:queueType/stats', async (req, res) => {
  try {
    const { queueType } = req.params;
    
    const stats = await jobQueueService.getQueueStats(queueType);
    
    if (!stats) {
      return res.status(404).json({
        error: 'Queue not found',
        queueType
      });
    }
    
    res.json({
      queueType,
      active: stats.active,      // Currently processing
      waiting: stats.waiting,    // Queued, not started
      completed: stats.completed, // Successfully done
      failed: stats.failed        // Failed jobs
    });
    
  } catch (error) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});
```

---

## Pattern 5: Worker Initialization

This pattern is called once on server startup:

```typescript
// File: server/workers/index.ts

import { registerStrategyWorkers } from './strategyJobWorker';
import { registerMorioWorkers } from './morioJobWorker';
import { registerPoolVaultWorkers } from './poolVaultJobWorker';
import { jobQueueService } from '../services/jobQueueService';

let initialized = false;

export async function initializeWorkers() {
  if (initialized) {
    console.log('Workers already initialized');
    return;
  }
  
  try {
    console.log('[Workers] Initializing...');
    
    // Register all processors
    registerStrategyWorkers();
    registerMorioWorkers();
    registerPoolVaultWorkers();
    
    console.log('✅ [Workers] All workers initialized successfully');
    initialized = true;
    
  } catch (error) {
    console.error('❌ [Workers] Failed to initialize:', error);
    throw error;
  }
}

export async function shutdownWorkers() {
  try {
    console.log('[Workers] Shutting down...');
    await jobQueueService.closeQueues();
    console.log('✅ [Workers] Gracefully shutdown');
  } catch (error) {
    console.error('❌ [Workers] Error during shutdown:', error);
  }
}
```

---

## Pattern 6: Integration in Server Startup

Call this from your main server file:

```typescript
// File: server/index.ts

import express from 'express';
import { initializeWorkers, shutdownWorkers } from './workers';
import jobRoutes from './routes/jobs';

const app = express();

// ... middleware setup ...
app.use(express.json());
app.use(authenticateToken);
// ... etc ...

// === Add Job Queue Infrastructure ===

// Initialize workers
try {
  await initializeWorkers();
} catch (error) {
  console.error('Failed to initialize job workers:', error);
  process.exit(1);
}

// Register job routes
app.use('/api/jobs', jobRoutes);

// === End Job Queue Infrastructure ===

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received');
  server.close(async () => {
    await shutdownWorkers();
    console.log('Server and workers shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received');
  server.close(async () => {
    await shutdownWorkers();
    console.log('Server and workers shutdown complete');
    process.exit(0);
  });
});
```

---

## How to Add a New Job Type

Follow these steps to add a new async operation:

### Step 1: Define Job Type
Edit [server/services/jobQueueService.ts](server/services/jobQueueService.ts):
```typescript
export type JobType = 
  | 'strategy-backtest'
  | 'strategy-optimize'
  | 'morio-analyze'
  | 'custom-new-operation'  // ← Add here
  // ...
```

### Step 2: Set Timeout
In [server/services/jobQueueService.ts](server/services/jobQueueService.ts):
```typescript
const JOB_TIMEOUTS: Record<JobType, number> = {
  'strategy-backtest': 1800000,
  'custom-new-operation': 300000,  // ← Add timeout in ms
  // ...
};
```

### Step 3: Create Worker File
Create [server/workers/customJobWorker.ts](server/workers/customJobWorker.ts):
```typescript
import { Job } from 'bull';
import { jobQueueService } from '../services/jobQueueService';

export async function processCustomOperation(job: Job) {
  try {
    const { userId, param1, param2 } = job.data;
    
    await job.progress(25);
    // Do work...
    const result = await doHeavyComputation(param1, param2);
    await job.progress(90);
    
    return result;
  } catch (error) {
    console.error('Custom operation failed:', error);
    throw error;
  }
}

export function registerCustomWorker() {
  jobQueueService.registerProcessor(
    'custom-new-operation',
    processCustomOperation,
    { concurrency: 2 }
  );
}
```

### Step 4: Register Worker
Update [server/workers/index.ts](server/workers/index.ts):
```typescript
import { registerCustomWorker } from './customJobWorker';

export async function initializeWorkers() {
  // ...
  registerCustomWorker();  // ← Add here
  // ...
}
```

### Step 5: Add Route Handler
In your route file:
```typescript
router.post('/custom-operation', authenticateToken, async (req, res) => {
  const jobId = await jobQueueService.queueJob(
    'custom-new-operation',
    { userId: req.user.id, ...req.body },
    { timeout: 300000 }
  );
  
  res.status(202).json({
    success: true,
    jobId,
    statusUrl: `/api/jobs/${jobId}/status`
  });
});
```

---

## Rate Limiting Pattern

All heavy operations should have rate limits. Use this pattern:

```typescript
import { rateLimitPerUser } from '../middleware/rateLimiter';

router.post('/heavy-operation', authenticateToken, async (req, res) => {
  // Apply rate limit: 10 requests per 5 minutes per user
  await rateLimitPerUser(req, 'heavy-operation', 10, 300000);
  
  // If rate limit exceeded, middleware will return 429
  // Otherwise continue...
  
  const jobId = await jobQueueService.queueJob(/* ... */);
  res.status(202).json({ jobId });
});
```

---

## Error Handling

All patterns should include try-catch and proper error responses:

```typescript
try {
  // Queue or process job
  const jobId = await jobQueueService.queueJob(/* ... */);
  res.status(202).json({ success: true, jobId });
  
} catch (error) {
  if (error.message.includes('Rate limit')) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  if (error.message.includes('Not found')) {
    return res.status(404).json({ error: 'Resource not found' });
  }
  
  console.error('Unexpected error:', error);
  res.status(500).json({ error: 'Internal server error' });
}
```

---

## Testing Pattern

Test any new async operation with this sequence:

```bash
# 1. Queue a job
JOB_ID=$(curl -s -X POST http://localhost:3000/api/your-endpoint \
  -H "Authorization: Bearer TOKEN" | jq -r '.jobId')

echo "Queued job: $JOB_ID"

# 2. Poll status (should show processing)
curl http://localhost:3000/api/jobs/$JOB_ID/status
# {"status":"processing","progress":30}

# 3. Wait for completion
sleep 5

# 4. Get result
curl http://localhost:3000/api/jobs/$JOB_ID/result
# {"status":"completed","result":{...}}

# 5. Check queue stats
curl http://localhost:3000/api/jobs/queue/your-job-type/stats
```

---

## Performance Tips

1. **Concurrency:** Set to 2-3 for most operations, lower for heavy compute
2. **Timeouts:** Set realistic timeouts (30min for backtest, 60s for chat)
3. **Progress:** Update progress at 25%, 50%, 75%, 90% for visibility
4. **Retries:** Default 3 is good for flaky operations, adjust if needed
5. **Monitoring:** Check `/api/jobs/queue/*/stats` regularly

---

## Common Patterns Summary

| Need | Pattern | File |
|------|---------|------|
| Queue job in route | [Pattern 1](#pattern-1-queueing-a-job-in-a-route-handler) | routes/*.ts |
| Process in worker | [Pattern 2](#pattern-2-worker-processing-function) | workers/*.ts |
| Get job status | [Pattern 3](#pattern-3-job-status-retrieval-endpoint) | routes/jobs.ts |
| Monitor queue | [Pattern 4](#pattern-4-queue-statistics-endpoint) | routes/jobs.ts |
| Init workers | [Pattern 5](#pattern-5-worker-initialization) | workers/index.ts |
| Server integration | [Pattern 6](#pattern-6-integration-in-server-startup) | index.ts |

---

This guide covers all the patterns used in the implementation. Follow these when extending to other endpoints.

