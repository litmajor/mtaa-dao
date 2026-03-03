# Unused Declarations Tracking

## Overview
Tracking all unused imports, variables, and declarations across the codebase that may cause API failures or integration issues.

## Format
```
File | Line | Type | Name | Status | Notes
-----|------|------|------|--------|-------
```

---

## SERVER FILES

### server/services/dexRoutingExecution.ts
| Line | Type | Name | Status | Notes |
|------|------|------|--------|-------|
| 17 | import | `v4 as uuidv4` | ✅ FIXED | Now properly used for transaction hashes & rebalance IDs |
| 82 | variable | `transactionQueue` | ✅ FIXED | Now properly retrieved from queue in executeOrders |
| 130 | variable | `totalGasUsed` | ✅ FIXED | Now accumulates gasCostGwei from each transaction |

### server/index.ts
| Line | Type | Name | Status | Notes |
|------|------|------|--------|-------|
| 2 | import | `NextFunction` | ❌ UNUSED | Import exists but never used in middleware |
| 17 | import | `generalRateLimit` | ❌ UNUSED | Imported from rateLimiter but never applied to routes |
| 13 | import | `path` | ✅ USED | Used for path.join() in visibility logger setup |
| 18 | imports | `sanitizeInput, preventSqlInjection, preventXSS` | ✅ USED | All applied as middleware at lines 224-226 |

---

## ACTION ITEMS

### Immediate Fixes Needed
- [ ] Remove `NextFunction` from server/index.ts line 2 imports
- [ ] Either use `generalRateLimit` or remove it from line 17
- [ ] Audit all core files in `/server/core/` for similar patterns
- [ ] Check all service files in `/server/services/` for unused variables

### Investigation Needed
- [ ] Why was `generalRateLimit` imported but not used?
- [ ] Are there other services/modules depending on unused exports?
- [ ] Check if external APIs fail due to missing rate limiting

---

## Patterns Found

### Pattern 1: Imported but Never Applied
**Example:** `generalRateLimit` from `./security/rateLimiter`
- Imported at initialization
- Never referenced in middleware chain
- **Fix:** Apply to critical routes or remove

### Pattern 2: Declared but Never Accessed
**Example:** `transactionQueue` Map in dexRoutingExecution
- Declared as class property
- Created via `.set()` but never read via `.get()`
- **Fix:** Retrieve and use from queue (DONE ✅)

### Pattern 3: Unused Type Imports
**Example:** `NextFunction` type from express
- Imported for type safety
- Never used in any function or middleware signature
- **Fix:** Remove unused type import

---

## Next Steps
1. Apply fixes to dexRoutingExecution.ts ✅ DONE
2. Fix server/index.ts unused imports
3. Scan remaining core files
4. Verify API calls work with fixes
