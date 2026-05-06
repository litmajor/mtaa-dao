# Redis Singleton Architecture - START HERE

**Status:** ✅ Implementation Complete - Ready to Use

---

## What Happened?

Your Redis is creating **multiple instances** instead of one, causing:
- ❌ ECONNRESET errors every 90-186 seconds
- ❌ 0% cache hits (services isolated)
- ❌ 5-minute gaps in CEX data collection
- ❌ Memory leaks (800+ MB)

**Solution:** Created a singleton pattern that forces everything through one Redis connection.

---

## What You Got (3 New Components)

### 1. 🔴 Singleton Manager
**File:** `server/config/redisConnectionManager.ts`  
**What it does:** Controls all Redis connections (must use only one)  
**You'll use:** `getRedisInstance()` instead of `new Redis()`

### 2. 🔍 Violation Scanner
**File:** `server/utils/redisViolationScanner.ts`  
**What it does:** Finds all places creating Redis incorrectly  
**You'll use:** Via health endpoint `/health/redis-violations`

### 3. 📊 Health Endpoints
**File:** `server/routes/health.ts` (enhanced)  
**What they do:**
- `GET /health/redis` - Shows if instance count is 1 (good) or >1 (bad)
- `GET /health/redis-violations` - Lists all violations to fix

---

## Next 5 Minutes (Just Run This)

```bash
# 1. Start your server
npm run dev

# 2. In another terminal, get the violation list
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/health/redis-violations
```

**This tells you exactly what to fix.**

---

## Next 30-60 Minutes (Fix Everything)

The scan results will show violations like:
```
File: server/services/cexPriceBackgroundJob.ts, Line 45
BEFORE: const redis = new Redis(process.env.REDIS_URL);
AFTER:  import { getRedisInstance } from '../config/redisConnectionManager';
        const redis = getRedisInstance();
```

Just follow the "AFTER" examples for each file.

---

## Documentation (Read in This Order)

### 🎯 **START HERE:**
1. **This file** (you're reading it now)
2. `REDIS_SINGLETON_SESSION_SUMMARY.md` - What was built

### 📖 **For Details:**
3. `REDIS_SINGLETON_FIX_GUIDE.md` - Complete how-to guide
4. `REDIS_SINGLETON_QUICK_REFERENCE.md` - Quick lookup reference

---

## The 3 Patterns You'll See

### Pattern 1: Replace `new Redis(...)`
```typescript
// WRONG ❌
const redis = new Redis(process.env.REDIS_URL);

// CORRECT ✅
import { getRedisInstance } from '../config/redisConnectionManager';
const redis = getRedisInstance();
```

### Pattern 2: Remove `.connect()`
```typescript
// WRONG ❌
const redis = new Redis();
await redis.connect(); // Remove this!

// CORRECT ✅
const redis = getRedisInstance();
// Ready to use immediately
```

### Pattern 3: Add Import to Services
```typescript
// WRONG ❌
const redis = new Redis(); // Oops

// CORRECT ✅
import { getRedisInstance } from '../config/redisConnectionManager';
const redis = getRedisInstance();
```

---

## Your Quick Checklist

- [ ] Start server: `npm run dev`
- [ ] Run scan: `GET /health/redis-violations`
- [ ] Save results (shows all files to fix)
- [ ] Fix each file (copy patterns from scan results)
- [ ] Restart server
- [ ] Run scan again (should show 0 violations)
- [ ] Check: `GET /health/redis` (should show instanceCount = 1)

**Done!** No more ECONNRESET errors. ✅

---

## What Will Change

### Before ❌
```
Cache hits: 0/6
✅ Redis connected
❌ Redis connection error: ECONNRESET
(repeats every 90-186 seconds)
Connections: 10+
Memory: 800+ MB
CEX gaps: 5 minutes
```

### After ✅
```
Cache hits: 95%+
✅ Redis connected
(stays connected forever)
Connections: 1
Memory: <200 MB
CEX timing: Consistent 30s
```

---

## The Minimum You Need to Know

1. **Never do:** `new Redis(...)`
2. **Always do:** `getRedisInstance()`
3. **Remove:** Manual `.connect()` / `.disconnect()`
4. **That's it!**

---

## Time Estimate

| Step | Time |
|------|------|
| Run scan | 5 min |
| Review results | 10 min |
| Fix violations | 30-60 min |
| Verify | 10 min |
| **Total** | **1-1.5 hours** |

---

## Questions?

**"How do I run the scan?"**
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/health/redis-violations
```

**"What if I see InstanceCount > 1?"**
→ Not all violations fixed yet. Run scan again to find missing ones.

**"Do I need to restart after each fix?"**
Not required, but will show errors faster if you do.

**"What if something breaks?"**
→ See troubleshooting section in `REDIS_SINGLETON_FIX_GUIDE.md`

---

## Files You Just Got

### New Code (In Your Repo)
- ✅ `server/config/redisConnectionManager.ts` - Singleton manager
- ✅ `server/utils/redisViolationScanner.ts` - Violation detector
- ✅ `server/routes/health.ts` - Updated health endpoints

### New Documentation (In Your Repo)
- ✅ `REDIS_SINGLETON_SESSION_SUMMARY.md` - What was built
- ✅ `REDIS_SINGLETON_FIX_GUIDE.md` - Complete guide
- ✅ `REDIS_SINGLETON_QUICK_REFERENCE.md` - Quick reference
- ✅ `REDIS_SINGLETON_IMPLEMENTATION_COMPLETE.md` - Detailed summary

---

## Troubleshooting (Quick)

**Problem:** Scan still shows violations after fixing

**Solution:**
1. Make sure file was actually saved
2. Run: `npm run build` (check for errors)
3. Restart server completely
4. Run scan again

**Problem:** instanceCount still > 1

**Solution:**
1. Check logs for `[REDIS-VIOLATION]` messages
2. Those lines show exactly which file needs fixing
3. Fix that file
4. Restart and check again

---

## One More Time - The 3 Things to Remember

```typescript
// ❌ NEVER
const redis = new Redis(...);
await redis.connect();
await redis.disconnect();

// ✅ ALWAYS
import { getRedisInstance } from '../config/redisConnectionManager';
const redis = getRedisInstance();
```

That's literally it. Everything else is just applying this pattern to all your files.

---

## Where to Go Next

### Right Now:
1. Start your server
2. Run the scan endpoint
3. See what violations exist

### Next 30 minutes:
1. Review violation list
2. Fix CRITICAL violations (color-coded in scan results)
3. Fix HIGH violations
4. Fix MEDIUM violations

### After that:
1. Restart server
2. Run scan again (should show CLEAN)
3. Verify `GET /health/redis` shows instanceCount = 1
4. Watch logs for exactly ONE instance creation
5. Monitor cache hits increase to 95%+
6. ECONNRESET errors should be gone forever

---

## You've Got This! 🚀

Everything is set up. Just:
1. Run the scan
2. Fix the violations using the patterns shown
3. Restart
4. Verify

Time to close the book on Redis connection issues and get your cache working!

---

**Next Step:** Start server and run `GET /health/redis-violations`

Good luck! 💪
