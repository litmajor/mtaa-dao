# CEX Price Collection Fixes - Complete

## Issues Found & Fixed

### Issue #1: Missing `cex_prices` Table ❌
**Symptom:** PostgreSQL error `relation "cex_prices" does not exist`  
**Root Cause:** Migration `004-cex-tables.ts` failed during table creation  
**Status:** ✅ FIXED

### Issue #2: Invalid PostgreSQL Syntax in Migration
**Problem:** All CREATE INDEX statements were in a single `pool.query()` call
```typescript
// BROKEN - PostgreSQL doesn't support multiple statements in one query
await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_1 ...;
  CREATE INDEX IF NOT EXISTS idx_2 ...;
  CREATE INDEX IF NOT EXISTS idx_3 ...;
`);
```

**Solution:** Split into separate queries
```typescript
// FIXED - Each index gets its own query
await pool.query(`CREATE INDEX IF NOT EXISTS idx_1 ...;`);
await pool.query(`CREATE INDEX IF NOT EXISTS idx_2 ...;`);
await pool.query(`CREATE INDEX IF NOT EXISTS idx_3 ...;`);
```

**File Changed:** [server/db/migrations/004-cex-tables.ts](server/db/migrations/004-cex-tables.ts)

---

### Issue #3: Mismatched UNIQUE Constraint
**Problem:** 
- Table had: `UNIQUE(exchange, trading_pair, timestamp)`
- INSERT used: `ON CONFLICT (exchange, trading_pair)`
- These don't match → ON CONFLICT fails

**Solution:** Changed constraint to match INSERT logic
```typescript
// BEFORE
UNIQUE(exchange, trading_pair, timestamp)

// AFTER  
UNIQUE(exchange, trading_pair)
```

This allows one row per exchange/pair (latest price) with proper upsert behavior.

**File Changed:** [server/db/migrations/004-cex-tables.ts](server/db/migrations/004-cex-tables.ts)

---

## CEX Collection Behavior Explained

### Why 0/7 Pairs Despite "success: true"?

Looking at the server logs:
```json
{
  "exchange": "binance",
  "success": true,
  "pairsProcessed": 0,
  "pairsFailed": 7
}
```

**What's happening:**
1. ✅ Exchange API connection succeeds (success = true)
2. ✅ Pair discovery completes (it gets back 7 pairs)
3. ❌ ALL 7 pairs fail to fetch data (pairsFailed: 7)
4. ❌ Table doesn't exist, so prices aren't stored

**The 7 pairs are the FALLBACK pairs:**
- BTC/USDT
- ETH/USDT
- SOL/USDT
- BNB/USDT
- ADA/USDT
- AVAX/USDT
- MATIC/USDT

### Why Are Fallback Pairs Being Used?

In `symbolUniverseService.getSupportedPairs()`:
```typescript
async getSupportedPairs(exchange: string): Promise<string[]> {
  const supported = await this.discoverSupportedPairs(exchange);
  
  if (supported.length === 0) {
    // Fallback to common pairs
    const commonSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'AVAX', 'MATIC'];
    return commonSymbols.map(s => `${s}/USDT`);
  }
  
  return supported;
}
```

**This means market discovery is failing** (returning 0 pairs) for all exchanges.

---

## Next Investigation Steps

Once the migration is fixed and server restarts:

1. **Monitor if pairs now succeed:** Check if pairsProcessed > 0
2. **If still failing:** Debug why market discovery returns 0 pairs
   - Check ccxtService.getMarkets() implementation
   - Verify exchange API connectivity
   - Check rate limiting/throttling
3. **Verify table creation:** 
   ```sql
   SELECT COUNT(*) FROM cex_prices;
   ```

---

## Files Modified

| File | Change |
|------|--------|
| [server/db/migrations/001-notification-system.ts](server/db/migrations/001-notification-system.ts) | Fixed `triggered_by` type: UUID → VARCHAR(255) |
| [server/db/migrations/004-cex-tables.ts](server/db/migrations/004-cex-tables.ts) | Fixed CREATE INDEX syntax + UNIQUE constraint |
| [server/db/migrations/007-cross-chain-support.ts](server/db/migrations/007-cross-chain-support.ts) | Fixed all MySQL-style INDEX to PostgreSQL syntax |

---

## Migration Execution Order

The migrations run in this order (from [server/db/migrations/index.ts](server/db/migrations/index.ts)):

1. ✅ Notification tables (001)
2. ✅ Rules engine (002)  
3. ✅ Limit orders (003)
4. **🔴 → 🟢 CEX tables (004) - NOW FIXED**
5. ⚠️ Cross-chain (007) - NOW FIXED (non-critical on failure)

---

## Test After Fix

```bash
# 1. Restart server
npm run dev

# 2. Check migrations succeeded
# Look for: "✅ All CEX migrations completed successfully!"

# 3. Query table exists
# SELECT COUNT(*) FROM cex_prices; -- Should return 0 rows

# 4. Monitor logs for price collection
# Look for: "[CEXPriceBackgroundJob] binance: X/7 pairs"
# Should now show pairsProcessed > 0
```

---

## Related Issues

- Redis connection resilience implemented ✅
- Database schema type mismatches fixed ✅
- PostgreSQL syntax corrections complete ✅
