# Redis Test Configuration Guide

## Overview

This guide explains how Redis tests work, common issues, and how to properly configure them for your development environment.

---

## Prerequisites

### 1. Redis Container Running

```bash
# Start Redis container
docker-compose up -d mtaa-redis

# Verify it's running
docker ps | grep mtaa-redis
```

### 2. Environment Variables Set

Your `.env` file should contain:

```env
# Redis Connection (with authentication)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=@billionaremindset001
REDIS_DB=0

# Or full URL (takes precedence):
# REDIS_URL=redis://:@billionaremindset001@localhost:6379/0
```

> **Important**: The password `@billionaremindset001` must match what's configured in your Redis server.

---

## Test Setup Lifecycle

### 1. Test Initialization (`beforeAll`)

```typescript
beforeAll(async () => {
  // Build Redis URL with authentication from environment
  const redisConfig = getRedisConfig();
  
  // Initialize Redis connection
  await redis.connect();
  // OR: await cacheManager.initialize();
});
```

**What happens:**
- Reads `REDIS_PASSWORD` from `.env`
- Builds full connection URL with authentication
- Establishes connection to Redis (with AUTH command)
- Selects correct database (DB 0 by default)

### 2. Test Execution

```typescript
it('should cache price data', async () => {
  // Set test data (preload)
  await cacheManager.set('price:ETH', { price: 2000 }, 60);
  
  // Retrieve and verify
  const cached = await cacheManager.get('price:ETH');
  expect(cached).toBeDefined();
});
```

**Key points:**
- Tests MUST preload data they want to read
- Use synchronous operations where possible to avoid timing issues
- Always add small delays between `set` and `get` if needed:
  ```typescript
  await cacheManager.set(key, data, 60);
  await new Promise(r => setTimeout(r, 100)); // Let cache persist
  const result = await cacheManager.get(key);
  ```

### 3. Test Cleanup (`afterAll` or `afterEach`)

```typescript
afterEach(async () => {
  // Clean up test data to avoid interference
  await cacheManager.invalidateByPattern('price:*');
  await cacheManager.invalidateByPattern('test:*');
});
```

**Why it matters:**
- Prevents test data from bleeding into other tests
- Keeps Redis database "clean" between runs
- Ensures reproducible test results

---

## Common Issues & Solutions

### Issue 1: "NOAUTH Authentication required"

**Symptom:** Test fails with Redis error about authentication.

**Cause:** Test code doesn't provide the Redis password.

**Solution:**
```typescript
// ❌ WRONG - No authentication
const redis = new Redis('redis://localhost:6379');

// ✅ CORRECT - With authentication
const redis = new Redis(`redis://:${password}@localhost:6379`);

// ✅ BETTER - Using helper
const { url } = getRedisConfig();
const redis = new Redis(url);
```

### Issue 2: "KEYS: 0 matches" / Keys Not Found

**Symptom:** `KEYS *` returns empty even though you think you set data.

**Causes:**
1. **Wrong database**: Test writes to DB 0, reads from DB 1
2. **No test data**: Test tries to read keys that were never `SET`
3. **Auth not provided**: Command executed without authentication

**Solutions:**

```typescript
// 1. Always preload data
beforeEach(async () => {
  await cacheManager.set('test:key', 'value', 60);
});

// 2. Verify DB index matches
const config = getRedisConfig(); // Should match REDIS_DB=0
console.log('Using DB:', config.db);

// 3. Confirm authentication
await redis.connect(); // This will throw if auth fails
```

### Issue 3: Connection Timeout / Hangs

**Symptom:** Test runs indefinitely without error or result.

**Cause:** Redis command blocked by retry loop (`maxRetriesPerRequest: 3`).

**Solution:** This is already fixed in our Redis config changes:
```typescript
maxRetriesPerRequest: 1,    // Fail fast instead of blocking
commandTimeout: 3000,        // 3-second hard timeout
enableOfflineQueue: false,   // Don't queue commands while disconnected
```

---

## Test Patterns

### Pattern 1: Simple GET/SET Test

```typescript
it('should cache and retrieve data', async () => {
  const key = 'test:data';
  const data = { value: 123 };

  // Write
  await cacheManager.set(key, data, 60);
  
  // Read
  const cached = await cacheManager.get(key);
  expect(cached).toEqual(data);
});
```

### Pattern 2: Test with Expiration

```typescript
it('should expire cached data', async () => {
  const key = 'test:expires';
  
  // Write with 1 second TTL
  await cacheManager.set(key, { data: 'test' }, 1);
  
  // Should exist immediately
  let cached = await cacheManager.get(key);
  expect(cached).toBeDefined();
  
  // Wait for expiration
  await new Promise(r => setTimeout(r, 1100));
  
  // Should be gone
  cached = await cacheManager.get(key);
  expect(cached).toBeNull();
});
```

### Pattern 3: Pattern Invalidation Test

```typescript
it('should invalidate by pattern', async () => {
  // Preload multiple keys
  await cacheManager.set('price:ETH', { price: 2000 }, 60);
  await cacheManager.set('price:BTC', { price: 50000 }, 60);
  await cacheManager.set('apy:aave', { apy: 5 }, 60);
  
  // Give Redis time to persist
  await new Promise(r => setTimeout(r, 100));
  
  // Invalidate price:* pattern
  await cacheManager.invalidateByPattern('price:*');
  
  // price keys should be gone
  expect(await cacheManager.get('price:ETH')).toBeNull();
  expect(await cacheManager.get('price:BTC')).toBeNull();
  
  // apy key should persist
  expect(await cacheManager.get('apy:aave')).toBeDefined();
});
```

### Pattern 4: Batch Operations

```typescript
it('should handle batch sets', async () => {
  const batch = [
    { key: 'test:1', value: { id: 1 }, ttl: 60 },
    { key: 'test:2', value: { id: 2 }, ttl: 60 },
    { key: 'test:3', value: { id: 3 }, ttl: 60 },
  ];

  // Write batch
  await cacheManager.mset(batch);
  
  // Verify all exist
  for (const item of batch) {
    const cached = await cacheManager.get(item.key);
    expect(cached).toBeDefined();
  }
});
```

---

## Debugging Tips

### Check Redis Connection

```typescript
// In your test
beforeAll(async () => {
  const config = getRedisConfig();
  console.log('Redis Config:', {
    host: config.host,
    port: config.port,
    db: config.db,
    hasPassword: !!config.password,
    url: config.url, // Avoid logging password here
  });
  
  await redis.connect();
  console.log('✅ Redis connected');
});
```

### Manually Test Keys

```bash
# Connect to Redis
docker exec -it mtaa-redis redis-cli

# Authenticate
AUTH @billionaremindset001

# Check DB
SELECT 0

# List all keys
KEYS *

# Check specific key
GET test:key

# Set test data
SET test:debug "hello"

# Get it back
GET test:debug
```

### Check Redis Logs

```bash
# View container logs
docker logs mtaa-redis

# Follow logs in real-time
docker logs -f mtaa-redis
```

---

## Environment Variable Reference

| Variable | Default | Example | Purpose |
|----------|---------|---------|---------|
| `REDIS_HOST` | `localhost` | `redis-prod.example.com` | Redis server hostname |
| `REDIS_PORT` | `6379` | `6380` | Redis server port |
| `REDIS_PASSWORD` | _(none)_ | `@billionaremindset001` | Authentication password |
| `REDIS_DB` | `0` | `1` | Database index (0-15) |
| `REDIS_URL` | _(built from above)_ | `redis://:pass@host:6379/0` | Full connection URL |

> **Note**: `REDIS_URL` takes precedence over individual variables if both are set.

---

## Helper Usage Examples

### In Test Files

```typescript
import { getRedisConfig, buildRedisUrl } from '../../utils/redisHelper';

describe('My Redis Tests', () => {
  beforeAll(async () => {
    const config = getRedisConfig();
    console.log(`Connecting to Redis at ${config.host}:${config.port}/DB${config.db}`);
    
    // Initialize cache manager or service
    const cacheManager = new CacheManager({ 
      redisUrl: config.url,
      enableCache: true 
    });
    await cacheManager.initialize();
  });
});
```

### In Services

```typescript
import { buildRedisUrl } from '../utils/redisHelper';

class MyService {
  constructor() {
    const redisUrl = buildRedisUrl();
    this.redis = new Redis(redisUrl);
  }
}
```

### Building Custom Configs

```typescript
// Override specific settings
const config = getRedisConfig({
  db: 1,  // Use different database for testing
  port: 6380,  // Connect to different instance
});

const url = buildRedisUrl({
  password: 'test-password',
  db: 2,
});
```

---

## Summary Checklist

Before Running Tests:

- [ ] Redis container is running: `docker ps | grep mtaa-redis`
- [ ] `.env` has correct password: `REDIS_PASSWORD=@billionaremindset001`
- [ ] `.env` specifies correct DB: `REDIS_DB=0`
- [ ] Tests initialize Redis connection in `beforeAll`
- [ ] Tests preload data before reading it (or check it's null)
- [ ] Tests clean up after themselves (`afterEach`)
- [ ] Using `getRedisConfig()` or `buildRedisUrl()` helper (not hardcoded URLs)

When Debugging:

- [ ] Manually test: `docker exec -it mtaa-redis redis-cli`
- [ ] Verify auth: `AUTH @billionaremindset001`
- [ ] Check DB: `SELECT 0` then `KEYS *`
- [ ] View logs: `docker logs mtaa-redis`
- [ ] Check env vars: `printenv | grep REDIS`
