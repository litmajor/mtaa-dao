# Redis Singleton Pattern Fix Guide

## Overview

You have **ECONNRESET connection errors** caused by multiple Redis instances being created throughout your codebase instead of using a singleton pattern. This guide explains how to identify and fix your Redis connections.

---

## Problem Statement

**Current Issue:**
```
Cache hits: 0/6
✅ Redis connected successfully
❌ Redis connection error: read ECONNRESET
✅ Redis connected successfully
❌ Redis connection error: read ECONNRESET
```

**Root Cause:**
- Each service/job creates `new Redis(...)` independently
- 6 CEX exchanges + DEX scanners + event listeners = 10+ connections created
- Multiple independent connections = connection storm → ECONNRESET
- No shared cache between instances = 0 cache hits

---

## Solution Architecture

### New Infrastructure Files

Two files have been added to your codebase:

#### 1. **server/config/redisConnectionManager.ts**
- Singleton Redis client manager
- Single entry point for all Redis connections
- Logs every instantiation attempt with stack traces
- Tracks violation count
- Auto-reconnection with exponential backoff

**Export Functions:**
```typescript
// Get or create the singleton Redis instance
const redis = getRedisInstance();

// Async version (waits for connection)
const redis = await getRedisInstanceAsync();

// Check how many instances exist (should be 1)
const count = getRedisInstanceCount(); 

// Check connection status
if (isRedisConnected()) { ... }
```

#### 2. **server/utils/redisViolationScanner.ts**
- Scans entire codebase for Redis pattern violations
- Identifies:
  - `new Redis(...)` instantiations (CRITICAL)
  - Manual `.connect()` / `.disconnect()` calls (HIGH)
  - Missing singleton imports (HIGH)
- Generates human-readable violation report
- Suggests specific fixes per violation

---

## Step-by-Step Fix Guide

### Step 1: Run Diagnostic Scan

First, identify all violations in your codebase:

```bash
# Start your server
npm run dev

# In another terminal, run the scan endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/health/redis-violations
```

**Output:**
```json
{
  "success": true,
  "summary": {
    "totalViolations": 42,
    "critical": 8,
    "high": 15,
    "medium": 19,
    "status": "VIOLATIONS FOUND"
  },
  "violations": {
    "critical": [
      {
        "file": "server/services/cexPriceBackgroundJob.ts",
        "line": 45,
        "type": "new-redis",
        "code": "const redis = new Redis(process.env.REDIS_URL);",
        "fix": "import { getRedisInstance } from '../config/redisConnectionManager'; const redis = getRedisInstance();"
      }
      // ... more violations
    ]
  },
  "report": "# Redis Violations Report\n..."
}
```

### Step 2: Triage Violations by Severity

The scanner categorizes violations:

- **CRITICAL** 🔴: `new Redis(...)` instantiations
  - Highest priority - causes connection storms
  - Fix by replacing with singleton

- **HIGH** 🟠: Manual `connect()` / `disconnect()` calls
  - Prevents proper connection pooling
  - Remove immediately

- **MEDIUM** 🟡: Missing singleton imports
  - Services using Redis without importing singleton
  - Add import + use singleton method

### Step 3: Fix Each Violation

For each violation reported, apply the corresponding fix:

#### Pattern 1: Replace `new Redis(...)` with Singleton

**BEFORE:**
```typescript
// server/services/cexPriceCollector.ts
import { Redis } from 'ioredis';

export class CEXPriceCollector {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }
  
  async collectPrice() {
    const cached = await this.redis.get(`price:${symbol}`);
  }
}
```

**AFTER:**
```typescript
// server/services/cexPriceCollector.ts
import { getRedisInstance } from '../config/redisConnectionManager';

export class CEXPriceCollector {
  private redis;
  
  constructor() {
    this.redis = getRedisInstance(); // ← Use singleton
  }
  
  async collectPrice() {
    const cached = await this.redis.get(`price:${symbol}`);
  }
}
```

#### Pattern 2: Remove Manual Connection Management

**BEFORE:**
```typescript
// server/services/cacheService.ts
const redis = new Redis(process.env.REDIS_URL);

// Manual control - causes issues!
await redis.connect();

async function cacheData(key, value) {
  await redis.set(key, value);
}

// App shutdown
process.on('SIGTERM', async () => {
  await redis.disconnect();
});
```

**AFTER:**
```typescript
// server/services/cacheService.ts
import { getRedisInstance, isRedisConnected } from '../config/redisConnectionManager';

// Singleton is auto-connecting via connectionManager
async function cacheData(key, value) {
  const redis = getRedisInstance();
  if (!isRedisConnected()) {
    console.warn('Redis not connected, operation may fail');
  }
  await redis.set(key, value);
}

// No need for manual disconnect - connectionManager handles graceful shutdown
process.on('SIGTERM', async () => {
  // ConnectionManager will handle cleanup
});
```

#### Pattern 3: Add Import to Services Using Redis

**BEFORE:**
```typescript
// server/services/analyticsService.ts
const redis = new Redis(); // ← Creating new instance!

export async function getAnalytics() {
  return redis.get('analytics:data');
}
```

**AFTER:**
```typescript
// server/services/analyticsService.ts
import { getRedisInstance } from '../config/redisConnectionManager';

export async function getAnalytics() {
  const redis = getRedisInstance();
  return redis.get('analytics:data');
}
```

### Step 4: Verify Fixes

After fixing all violations, run the scan again:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/health/redis-violations
```

**Expected Output:**
```json
{
  "summary": {
    "totalViolations": 0,
    "critical": 0,
    "high": 0,
    "medium": 0,
    "status": "CLEAN" ✓
  }
}
```

### Step 5: Verify Instance Count

Check that only ONE Redis instance exists:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/health/redis
```

**Expected Output:**
```json
{
  "redis": {
    "instanceCount": {
      "actual": 1,
      "expected": 1,
      "status": "OK",
      "severity": "none"
    },
    "connection": {
      "status": "connected",
      "pingStatus": "healthy",
      "lastError": null
    },
    "recommendations": [
      "✓ No singleton violations detected",
      "Cache should be functioning normally"
    ]
  }
}
```

### Step 6: Monitor for Compliance

After restarting your server, watch the logs for violations:

```
[REDIS] Creating Redis client (instance #1) from /path/to/redisConnectionManager.ts:XXX
[REDIS] Redis connected successfully
```

**You should see `instance #1` only ONCE on startup.**

If you see more instances:
```
[REDIS-VIOLATION] Duplicate Redis instantiation attempted!
[REDIS-VIOLATION] Stack trace: ...
```

This means there's still a rogue `new Redis(...)` somewhere.

---

## Monitoring & Observability

### Two New Health Endpoints

#### GET /health/redis
Shows Redis connection diagnostics and singleton status.

**Use Cases:**
- Quick health check of Redis
- Verify singleton compliance
- See recommendations for violations

#### GET /health/redis-violations
Runs full codebase scan for Redis pattern violations.

**Use Cases:**
- Initial audit of codebase
- Verify fixes applied correctly
- Periodic compliance checks

### Logs to Watch

When violations occur, you'll see:

```
[REDIS-VIOLATION] Duplicate Redis instantiation attempted! Instance count: 2
[REDIS-VIOLATION] Stack trace location: /path/to/service.ts:123
[REDIS-VIOLATION] First instance created at: /path/to/connectionManager.ts:45
```

When everything is working:
```
[REDIS] Creating Redis client (instance #1)
[REDIS] Connected (latency: 2ms, memory: 4.2MB)
```

---

## Expected Outcome After Fix

### Before Fix:
```
Cache hits: 0/6          ← Isolated instances, no sharing
ECONNRESET pattern       ← Connection storm
Memory leaks             ← Connections not pooled
Collection gaps: 5min    ← Event loop stalls
```

### After Fix:
```
Cache hits: 95%+         ← Shared singleton cache
Clean connections        ← Single pooled connection
Stable memory usage      ← No connection leaks
Consistent timing        ← No event loop stalls
```

---

## Common Pitfalls

### ❌ Mistake 1: Using Redis without importing singleton

```typescript
// WRONG
const redis = new Redis(process.env.REDIS_URL);
```

### ✅ Correct Approach

```typescript
import { getRedisInstance } from '../config/redisConnectionManager';
const redis = getRedisInstance();
```

---

### ❌ Mistake 2: Calling connect() manually

```typescript
// WRONG
const redis = getRedisInstance();
await redis.connect(); // Redundant!
```

### ✅ Correct Approach

```typescript
// ConnectionManager handles connection automatically
const redis = getRedisInstance();
// Ready to use immediately
```

---

### ❌ Mistake 3: Disconnecting in service shutdown

```typescript
// WRONG
process.on('SIGTERM', async () => {
  await redis.disconnect(); // Breaks other services!
});
```

### ✅ Correct Approach

```typescript
// WRONG - Let connectionManager handle it
// The singleton will gracefully disconnect all services at once
// No need for individual service cleanup
```

---

## Troubleshooting

### Issue: Violations still detected after fixes

**Check:**
1. Did you restart the server?
2. Did you verify every file that uses Redis?
3. Run scan again to see current violations

```bash
curl http://localhost:3000/health/redis-violations
```

### Issue: instanceCount shows > 1

**Steps:**
1. Stop the server
2. Run scan: `curl http://localhost:3000/health/redis-violations`
3. Check all files in "critical" violations
4. Apply fixes line by line
5. Restart and verify

### Issue: Cache still showing 0 hits

**Possible Causes:**
1. Violations still exist → verify all are fixed
2. Cache keys don't match between services → standardize them
3. Redis expiration too short → check TTL settings

---

## Summary

**What Changed:**
- ✅ New singleton manager: `redisConnectionManager.ts`
- ✅ New violation scanner: `redisViolationScanner.ts`
- ✅ Two new health endpoints: `/health/redis` and `/health/redis-violations`
- ✅ Enhanced `checkRedis()` function in health.ts

**What You Need to Do:**
1. Run `/health/redis-violations` scan
2. Fix each violation (replace `new Redis(...)` with `getRedisInstance()`)
3. Remove manual `.connect()` / `.disconnect()` calls
4. Verify scan shows 0 violations
5. Restart server and check `/health/redis` shows instance count = 1

**Time to Fix:**
- Scan: 5 minutes
- Fixes: 30-60 minutes (depends on violation count)
- Verification: 10 minutes

---

## Next Steps

1. **Start Server:**
   ```bash
   npm run dev
   ```

2. **Run Initial Scan:**
   ```bash
   curl -H "Authorization: Bearer TOKEN" http://localhost:3000/health/redis-violations
   ```

3. **Document Findings:**
   - Save violations report
   - Prioritize by severity (CRITICAL first)
   - Create fix checklist

4. **Apply Fixes:**
   - Follow patterns above
   - Test each service after fixing
   - Commit changes incrementally

5. **Verify Compliance:**
   - Re-run scan: should show 0 violations
   - Check instance count: should show 1
   - Monitor logs: no more ECONNRESET errors

6. **Test Performance:**
   - CEX collection: consistent 30s intervals
   - Cache hits: should show > 95%
   - Memory: stable usage

---

## Support

For detailed debugging:
- Check full scan report: `/health/redis-violations` → `report` field
- Watch logs: `[REDIS-VIOLATION]` messages during startup
- Verify fixes: Each fixed file should be removed from next scan

Good luck! This is the final piece to fix your ECONNRESET connection lifecycle issue. 🚀
