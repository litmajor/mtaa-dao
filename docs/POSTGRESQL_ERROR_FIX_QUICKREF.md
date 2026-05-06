# PostgreSQL Error Fix - Quick Reference

## Error Message
```
ERROR:  column "daoId" does not exist at character 24
HINT:  Perhaps you meant to reference the column "proposals.dao_id".
```

## Location
**File:** `server/routes/daos.ts`  
**Lines:** 80-88 (growthRates query)

## Quick Fix
Changed 3 things in the SQL query:

```diff
- SELECT "daoId"              → SELECT "dao_id" as "daoId"
- WHERE "joinedAt" >= ...     → WHERE "created_at" >= ...
- GROUP BY "daoId"            → GROUP BY "dao_id"
```

## Why This Happened
PostgreSQL uses **snake_case** for column names in the database, but the query was trying to use **camelCase** (`daoId`). PostgreSQL couldn't find a column named `daoId` because the actual column is `dao_id`.

## How to Prevent
1. **Always check the actual database schema** before writing SQL
   ```bash
   \d dao_memberships  # List columns in psql
   ```

2. **Use aliasing for SELECT results**
   ```sql
   SELECT "actual_column_name" as "camelCaseName"
   ```

3. **Use actual column names in WHERE/GROUP BY**
   ```sql
   GROUP BY "actual_column_name"  -- NOT the alias
   ```

## Fixed Queries

### Query 1: Activity Counts ✅
```typescript
const activityCounts = await db.execute(sql`
  SELECT 
    "dao_id" as "daoId",
    COUNT(*) as "activeProposals"
  FROM proposals
  WHERE status = 'active'
  GROUP BY "dao_id"
`);
```

### Query 2: Growth Rates ✅
```typescript
const growthRates = await db.execute(sql`
  SELECT 
    "dao_id" as "daoId",
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE COUNT(*) FILTER (WHERE "created_at" >= NOW() - INTERVAL '30 days') * 100.0 / COUNT(*)
    END as "growthRate"
  FROM dao_memberships
  GROUP BY "dao_id"
`);
```

## Test It
```bash
# The DAO listing endpoint should now work
curl http://localhost:3000/api/daos

# Check logs for no column errors
grep "does not exist" logs/error.log  # Should find nothing
```

## Status
✅ **Fixed and ready to deploy**
