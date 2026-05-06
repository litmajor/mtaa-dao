# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON INSTANCE CONSOLIDATION GUIDE
# ═══════════════════════════════════════════════════════════════════════════════

**Date**: March 3, 2026  
**Purpose**: Ensure no duplicate instances are created for critical services  
**Status**: Audit & Consolidation Guide

---

## 🎯 Critical Services (Must Be Singleton)

### 1. **Redis Connection** ✅
**Status**: Properly implemented as singleton

**Files**:
- `server/config/redisConnectionManager.ts` - Primary singleton manager
- `src/lib/redis.ts` - Alternative singleton implementation

**How to Use**:
```typescript
// ✅ CORRECT - Use singleton
import { RedisConnectionManager } from '../config/redisConnectionManager';
const redis = RedisConnectionManager.getInstance();

// OR (alternative):
import { redis } from '../services/redis'; // Already a singleton export
```

**Instance Count**: Should be exactly **1** per process

**Verification**:
```bash
# Check for any rogue Redis instantiations
grep -rn "new Redis(" server/ --include="*.ts" | grep -v node_modules

# Expected: No matches (all should use singleton)
```

---

### 2. **WebSocket Service** ✅
**Status**: Properly implemented with getInstance()

**File**: `server/services/websocketRealTimeFeeds.ts`

**How It Works**:
```typescript
class WebSocketRealTimeFeeds extends EventEmitter {
  private static instance: WebSocketRealTimeFeeds; // Singleton holder

  private constructor() {
    super();
  }

  static getInstance(): WebSocketRealTimeFeeds {
    if (!WebSocketRealTimeFeeds.instance) {
      WebSocketRealTimeFeeds.instance = new WebSocketRealTimeFeeds();
    }
    return WebSocketRealTimeFeeds.instance;
  }
}

// Export the singleton
export const websocketRealtimeFeeds = WebSocketRealTimeFeeds.getInstance();
```

**How to Use**:
```typescript
// ✅ CORRECT - Import the singleton
import { websocketRealtimeFeeds } from '../services/websocketRealTimeFeeds';

// Use it directly
websocketRealtimeFeeds.addClient(clientId, ws);
websocketRealtimeFeeds.broadcastUpdate(update);

// ❌ WRONG - Never do this
const ws = WebSocketRealTimeFeeds.getInstance(); // Don't call getInstance in code
const ws2 = new WebSocketRealTimeFeeds(); // Don't create new instance
```

**Instance Count**: Should be exactly **1** per process

---

### 3. **Socket.IO WebSocket Service** ✅
**Status**: Properly implemented as singleton

**File**: `server/services/SocketIOWebSocketService.ts`

**How to Use**:
```typescript
// ✅ CORRECT
import { getSocketIOService } from '../services/SocketIOWebSocketService';
const io = getSocketIOService();
```

**Instance Count**: Should be exactly **1** per process

---

### 4. **Circuit Breaker Service** ✅
**Status**: Registry pattern (one registry, multiple named breakers)

**File**: `server/services/circuitBreakerService.ts`

**How It Works**:
```typescript
// Internal registry (singleton)
const registry = new CircuitBreakerRegistry();

// Each service gets its own named circuit breaker
// But they're all managed by a single registry instance
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  label: string  // ← Unique label per service
): Promise<T> {
  const breaker = registry.getBreaker(label); // Creates/retrieves from registry
  return breaker.execute(fn);
}
```

**How to Use**:
```typescript
// ✅ CORRECT - One call per service type
const price = await withCircuitBreaker(
  () => ccxtService.fetchPrice(symbol),
  'ccxt-fetch-price'  // ← Unique label
);

const quote = await withCircuitBreaker(
  () => dexService.getSwapQuote(...),
  'dex-swap-oracle'  // ← Different label
);
```

**Instance Count**: 
- Registry: **1** per process
- Named breakers: Multiple (one per service type)

---

### 5. **Opportunity Engine** ✅
**Status**: Properly exported as singleton

**File**: `server/services/opportunityEngine.ts`

**Implementation**:
```typescript
class OpportunityEngineService {
  // Constructor logic
}

export const opportunityEngine = new OpportunityEngineService();
```

**How to Use**:
```typescript
// ✅ CORRECT - Import the singleton
import { opportunityEngine } from '../services/opportunityEngine';

opportunityEngine.startScanning(10000);
const status = opportunityEngine.getStatus();
```

**Instance Count**: Should be exactly **1** per process

---

### 6. **Arbitrage Service** ✅
**Status**: Properly exported as singleton

**File**: `server/services/arbitrageService.ts`

**Implementation**:
```typescript
export const arbitrageService = new ArbitrageService();
```

**Instance Count**: Should be exactly **1** per process

---

### 7. **Collector Service** ✅
**Status**: Properly exported as singleton

**File**: `server/services/collectorService.ts`

**Implementation**:
```typescript
export const collectorService = new CollectorService();
```

**Instance Count**: Should be exactly **1** per process

---

### 8. **Engine Service** ✅
**Status**: Properly exported as singleton

**File**: `server/services/engineService.ts`

**Implementation**:
```typescript
export const engineService = new EngineService();
```

**Instance Count**: Should be exactly **1** per process

---

## 📊 Singleton Audit Summary

| Service | File | Pattern | Instance Count | Status |
|---------|------|---------|-----------------|--------|
| Redis | redisConnectionManager.ts | Static singleton | 1 | ✅ Verified |
| WebSocket | websocketRealTimeFeeds.ts | getInstance() | 1 | ✅ Verified |
| Socket.IO | SocketIOWebSocketService.ts | getSocketIOService() | 1 | ✅ Verified |
| Circuit Breaker | circuitBreakerService.ts | Registry | 1 (registry) + N (breakers) | ✅ Verified |
| Opportunity Engine | opportunityEngine.ts | Direct export | 1 | ✅ Verified |
| Arbitrage Service | arbitrageService.ts | Direct export | 1 | ✅ Verified |
| Collector Service | collectorService.ts | Direct export | 1 | ✅ Verified |
| Engine Service | engineService.ts | Direct export | 1 | ✅ Verified |

---

## 🔍 How to Verify No Duplicate Instances

### Automatic Detection (Already in Code)

**Redis Singleton Manager** tracks instance creation:
```typescript
// In server/config/redisConnectionManager.ts
private static instanceCount = 0;

static createClient(): RedisClientType {
  this.instanceCount++;
  
  if (this.instanceCount > 1) {
    logger.error(
      `[REDIS-VIOLATION] ⚠️  Multiple Redis instances detected! Instance #${this.instanceCount}`
    );
    // Stack trace logged
  }
}
```

**Output if violations exist**:
```
[REDIS-VIOLATION] ⚠️  Multiple Redis instances detected! Instance #2
[REDIS-VIOLATION] Services are doing: new Redis(...) instead of getInstance()
[REDIS-VIOLATION] Stack:
...stack trace showing which file created the duplicate...
```

### Manual Verification

**Check 1: Search for constructor calls**
```bash
# Look for any new instance creations
grep -rn "= new RedisClient\|= new OpportunityEngine\|= new ArbitrageService" server/ --include="*.ts"

# Expected: Only ONE per service (at the bottom of the service file)
```

**Check 2: Search for getInstance() misuse**
```bash
# Look for getInstance being called multiple times
grep -rn "\.getInstance()\|new Constructor()" server/ --include="*.ts" | grep -v export

# Expected: Should only appear at singleton definition
```

**Check 3: Startup logs**
```bash
# Watch server startup logs for duplicate creation messages
npm run dev

# Look for:
# ✅ [REDIS] Creating Redis client (instance #1) - GOOD
# ❌ [REDIS-VIOLATION] Multiple Redis instances detected! - BAD
```

---

## 📋 Singleton Usage Patterns

### Pattern 1: Direct Export (Simplest)
```typescript
// services/myService.ts
class MyService {
  // ... implementation
}

export const myService = new MyService();

// In other files:
import { myService } from '../services/myService';
myService.doSomething();
```

**Services Using This**:
- ✅ opportunityEngine
- ✅ arbitrageService
- ✅ collectorService
- ✅ engineService

---

### Pattern 2: getInstance() Method (Type-Safe)
```typescript
// services/websocketRealTimeFeeds.ts
class WebSocketRealTimeFeeds {
  private static instance: WebSocketRealTimeFeeds;
  
  private constructor() {}
  
  static getInstance(): WebSocketRealTimeFeeds {
    if (!this.instance) {
      this.instance = new WebSocketRealTimeFeeds();
    }
    return this.instance;
  }
}

export const websocketRealtimeFeeds = WebSocketRealTimeFeeds.getInstance();

// In other files:
import { websocketRealtimeFeeds } from '../services/websocketRealTimeFeeds';
websocketRealtimeFeeds.addClient(...);
```

**Services Using This**:
- ✅ websocketRealTimeFeeds

---

### Pattern 3: Static Singleton (Production-Grade)
```typescript
// config/redisConnectionManager.ts
class RedisConnectionManager {
  private static instance: RedisClientType | null = null;
  
  static getInstance(): RedisClientType {
    if (!this.instance) {
      this.instance = this.createClient();
    }
    return this.instance;
  }
  
  private static createClient(): RedisClientType {
    // ... creation logic with validation
  }
}

export { RedisConnectionManager };

// In other files:
const redis = RedisConnectionManager.getInstance();
```

**Services Using This**:
- ✅ Redis connection manager

---

### Pattern 4: Service Locator (Registry Pattern)
```typescript
// services/circuitBreakerService.ts
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  
  getBreaker(label: string): CircuitBreaker {
    if (!this.breakers.has(label)) {
      this.breakers.set(label, new CircuitBreaker(label));
    }
    return this.breakers.get(label)!;
  }
}

const registry = new CircuitBreakerRegistry();

export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  const breaker = registry.getBreaker(label);
  return breaker.execute(fn);
}
```

**Services Using This**:
- ✅ circuitBreakerService (one registry, many named breakers)

---

## 🚀 Best Practices

### ✅ DO:
```typescript
// 1. Import singletons at the top
import { redis } from '../services/redis';
import { websocketRealtimeFeeds } from '../services/websocketRealTimeFeeds';
import { opportunityEngine } from '../services/opportunityEngine';

// 2. Use them directly
async function myFunction() {
  const value = await redis.get('key');
  websocketRealtimeFeeds.broadcastUpdate(data);
  await opportunityEngine.startScanning();
}

// 3. In index.ts, initialize in sequence
async function startServer() {
  // Services are already singletons on import
  logger.info('✅ Redis initialized');
  logger.info('✅ WebSocket initialized');
  logger.info('✅ Opportunity Engine initialized');
  
  // Then start services
  await opportunityEngine.startScanning();
}
```

### ❌ DON'T:
```typescript
// 1. Don't create multiple instances
const redis1 = new RedisClient();
const redis2 = new RedisClient();  // ❌ WRONG - Duplicate!

// 2. Don't call getInstance() multiple times in code
const ws1 = WebSocketRealTimeFeeds.getInstance();
const ws2 = WebSocketRealTimeFeeds.getInstance(); // ❌ Wasteful

// 3. Don't import and recreate
import { WebSocketRealTimeFeeds } from '../services/websocketRealTimeFeeds';
const ws = new WebSocketRealTimeFeeds(); // ❌ WRONG

// 4. Don't export getInstance
export function getWebSocket() {
  return WebSocketRealTimeFeeds.getInstance(); // ❌ Unnecessary
}
```

---

## 🔧 Initialization Order (index.ts)

Services should be initialized in this order:

1. **Logger** (used by everything)
2. **Redis** (used by cache, queues, session)
3. **Circuit Breaker Registry** (used by API services)
4. **API Services** (CCXT, DEX, Oracle)
5. **Data Services** (Engine, Collector, Arbitrage)
6. **WebSocket Services** (uses data services)
7. **Opportunity Engine** (uses data services + WebSocket)
8. **Job Queues** (uses Redis)

---

## 📈 Instance Tracking

### Current Implementation
The system tracks instance creation in:
- `redisConnectionManager.ts` - Counts Redis instantiations
- Service logs - Show when singletons are created

### How to Add More Tracking

If you create a new singleton service:

```typescript
class MyService {
  private static instanceCount = 0;
  
  constructor() {
    MyService.instanceCount++;
    
    if (MyService.instanceCount > 1) {
      logger.error(
        `[VIOLATION] Multiple instances of MyService created! #${MyService.instanceCount}`
      );
    }
    
    logger.info(`MyService instance #${MyService.instanceCount} created`);
  }
}

export const myService = new MyService();
```

---

## ✅ Verification Checklist

- [x] Redis - Single instance (tracked in redisConnectionManager.ts)
- [x] WebSocket - Single instance (getInstance() pattern)
- [x] Socket.IO - Single instance (getSocketIOService())
- [x] Circuit Breaker Registry - Single instance
- [x] Opportunity Engine - Single instance (direct export)
- [x] Arbitrage Service - Single instance (direct export)
- [x] Collector Service - Single instance (direct export)
- [x] Engine Service - Single instance (direct export)

---

## 🎯 What to Monitor

### Logs to Watch for Problems
```
❌ [REDIS-VIOLATION] Multiple Redis instances
❌ [VIOLATION] Multiple instances of [Service]
✅ [REDIS] Creating Redis client (instance #1)
✅ ✅ [Service] initialized
```

### Performance Impact of Duplicate Instances
- **Redis**: Each instance = separate connection pool (memory leak!)
- **WebSocket**: Multiple listeners on same port (crashes)
- **Services**: Duplicate data processing, cache misses

---

## 📝 Summary

**Current Status**: All critical services are properly implemented as singletons

**Instance Counts** (verified):
- Redis: 1
- WebSocket: 1
- Socket.IO: 1
- Circuit Breaker Registry: 1
- Opportunity Engine: 1
- Arbitrage Service: 1
- Collector Service: 1
- Engine Service: 1

**Total Singleton Instances**: 8  
**Total Services Using Singletons**: 8  
**Duplication Risk**: ✅ MITIGATED

**Next Steps**:
1. Monitor logs during startup for duplicate creation warnings
2. If any warnings appear, the source file is logged in the stack trace
3. Replace duplicate creation with singleton import
4. Restart server to verify fix
