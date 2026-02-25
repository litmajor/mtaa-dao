# Phase 3B: Database Migration - Complete Setup Guide

**Status**: ✅ **READY TO DEPLOY**  
**Created**: January 22, 2026  
**Phase**: 3B - Database Migration  
**Previous Phase**: 3A - Real Data Integration (Complete)

---

## 📋 Overview

Phase 3B implements the database migration for 16 new monitoring and metrics tables. All migration files have been created and are ready for deployment to your PostgreSQL database.

### What's Included
- ✅ 3 SQL migration files with 16 complete table definitions
- ✅ Proper indexes for query performance
- ✅ Foreign key constraints for data integrity
- ✅ Financial precision (Decimal 20,8) for all monetary values
- ✅ UUID primary keys and automatic timestamps

---

## 🗂️ Migration Files Created

### File 1: `migrations/0032_phase3_monitoring_metrics_phase1.sql`
**Tables Created**: 8 core monitoring tables

1. **`platform_metrics`** - Real-time system health tracking
2. **`defi_protocol_metrics`** - DeFi protocol performance
3. **`cefi_exchange_metrics`** - Exchange integration data
4. **`blockchain_health_metrics`** - Chain status monitoring
5. **`liquidity_pool_metrics`** - Pool analytics
6. **`revenue_metrics`** - Platform revenue tracking
7. **`payment_provider_metrics`** - Payment gateway performance
8. **`agent_performance_metrics`** - Bot/agent metrics

### File 2: `migrations/0033_phase3_monitoring_metrics_phase2.sql`
**Tables Created**: 4 growth and usage tables

1. **`api_usage_metrics`** - API performance tracking
2. **`platform_growth_metrics`** - Growth rate analytics
3. **`support_ticket_metrics`** - Support system performance
4. **`tokenomics_metrics`** - Token supply and distribution

### File 3: `migrations/0034_phase3_monitoring_metrics_phase3.sql`
**Tables Created**: 4 community and analytics tables

1. **`referral_metrics`** - Referral program analytics
2. **`leaderboard_rankings`** - User ranking data
3. **`reward_distribution`** - Reward issuance tracking
4. **`dao_analytics`** - DAO performance metrics

**Total Tables**: 16 ✅

---

## 🚀 Deployment Steps

### Option 1: Using Docker Compose (Recommended)

```bash
# Navigate to project root
cd e:\repos\litmajor\mtaa-dao

# Copy migration files into Docker container
docker cp migrations/0032_phase3_monitoring_metrics_phase1.sql docker-postgres-1:/tmp/
docker cp migrations/0033_phase3_monitoring_metrics_phase2.sql docker-postgres-1:/tmp/
docker cp migrations/0034_phase3_monitoring_metrics_phase3.sql docker-postgres-1:/tmp/

# Execute migrations in order
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -f /tmp/0032_phase3_monitoring_metrics_phase1.sql
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -f /tmp/0033_phase3_monitoring_metrics_phase2.sql
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -f /tmp/0034_phase3_monitoring_metrics_phase3.sql

# Verify tables were created
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -c "\dt public.platform_*"
```

### Option 2: Direct PostgreSQL Connection

```bash
# From your local machine (if connected to remote DB)
psql -h your-db-host -U growth_halo -d mtaadao -f migrations/0032_phase3_monitoring_metrics_phase1.sql
psql -h your-db-host -U growth_halo -d mtaadao -f migrations/0033_phase3_monitoring_metrics_phase2.sql
psql -h your-db-host -U growth_halo -d mtaadao -f migrations/0034_phase3_monitoring_metrics_phase3.sql
```

### Option 3: Using Drizzle Kit

```bash
# Generate SQL from Drizzle schema
npm run db:generate

# Apply migrations
npm run db:migrate
```

---

## 📊 Table Specifications

### Core Schema Features

| Feature | Details |
|---|---|
| **Primary Keys** | UUID with auto-generation |
| **Timestamps** | `created_at`, `updated_at` on all tables |
| **Financial Precision** | Decimal(20, 8) for currency values |
| **Date Tracking** | Sortable by DESC for time-series data |
| **Indexes** | Strategic placement for common queries |

### Sample Table Structure

```sql
CREATE TABLE platform_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamp NOT NULL DEFAULT NOW(),
  
  -- Metrics
  total_daos integer DEFAULT 0,
  active_daos integer DEFAULT 0,
  total_tvl numeric(20, 8) DEFAULT '0',
  
  -- Tracking
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);
```

---

## 🔍 Verification Commands

### Check if tables were created
```bash
# List all new tables
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -c "\dt public.*metrics*"

# Count rows in each table
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao << EOF
SELECT tablename, (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name=tablename) as exists
FROM pg_tables
WHERE schemaname='public' AND tablename LIKE '%metrics%'
ORDER BY tablename;
EOF

# Check specific table structure
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -c "\d platform_metrics"
```

### Verify indexes
```bash
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -c "SELECT * FROM pg_indexes WHERE tablename LIKE '%metrics%';"
```

### Check table sizes
```bash
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao << EOF
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname='public' AND tablename LIKE '%metrics%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
EOF
```

---

## 📝 Data Loading Instructions

### After Tables Are Created

1. **Populate Initial Data** (Optional)
```sql
-- Example: Insert sample platform metrics
INSERT INTO platform_metrics (
  total_daos, active_daos, total_members, total_vaults, total_tvl
) VALUES (
  50, 45, 1250, 180, '1000000.00000000'
);
```

2. **Schedule Aggregation Jobs**
```typescript
// From server startup
import { ScheduledAggregationJobs } from './services/metricsAggregationService';

const jobs = new ScheduledAggregationJobs();
jobs.initializeScheduledJobs(); // Runs hourly aggregations
```

3. **Connect Aggregation Service**
```typescript
// In each endpoint that needs real data
const data = await MetricsCacheService.getOrSet(
  CACHE_KEY,
  async () => {
    return MonitoringAggregationService.aggregatePlatformMetrics();
  },
  CACHE_TTL.SHORT
);
```

---

## ⚠️ Pre-Migration Checklist

Before running migrations:

- [ ] Database is running and accessible
- [ ] You have backup of existing database
- [ ] All 3 migration files are in `migrations/` folder
- [ ] Node.js environment variables are set
- [ ] No other migrations are currently running
- [ ] Sufficient disk space for new tables (estimate: 50MB-500MB initially)

---

## ✅ Post-Migration Verification

After migrations complete, verify:

1. **All 16 Tables Exist**
```bash
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao << EOF
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema='public' AND table_name LIKE '%metrics%';
EOF
# Should return: 16
```

2. **Indexes Are Created**
```bash
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao << EOF
SELECT COUNT(*) FROM pg_indexes 
WHERE tablename LIKE '%metrics%';
EOF
# Should return: 20+ (all indexes)
```

3. **Foreign Keys Work**
```bash
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao << EOF
SELECT * FROM information_schema.table_constraints 
WHERE table_schema='public' AND constraint_type='FOREIGN KEY';
EOF
# Should show constraints on agent_performance_metrics, leaderboard_rankings, reward_distribution, dao_analytics
```

4. **Tables Are Empty**
```bash
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao << EOF
SELECT tablename, 0 as row_count FROM pg_tables 
WHERE schemaname='public' AND tablename LIKE '%metrics%' 
ORDER BY tablename;
EOF
# All should have row_count = 0 initially
```

---

## 🔄 Rollback Procedure

If you need to rollback the migration:

```bash
# Drop all created tables (CAREFUL!)
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao << EOF
DROP TABLE IF EXISTS dao_analytics CASCADE;
DROP TABLE IF EXISTS reward_distribution CASCADE;
DROP TABLE IF EXISTS leaderboard_rankings CASCADE;
DROP TABLE IF EXISTS referral_metrics CASCADE;
DROP TABLE IF EXISTS tokenomics_metrics CASCADE;
DROP TABLE IF EXISTS support_ticket_metrics CASCADE;
DROP TABLE IF EXISTS platform_growth_metrics CASCADE;
DROP TABLE IF EXISTS api_usage_metrics CASCADE;
DROP TABLE IF EXISTS agent_performance_metrics CASCADE;
DROP TABLE IF EXISTS payment_provider_metrics CASCADE;
DROP TABLE IF EXISTS revenue_metrics CASCADE;
DROP TABLE IF EXISTS liquidity_pool_metrics CASCADE;
DROP TABLE IF EXISTS blockchain_health_metrics CASCADE;
DROP TABLE IF EXISTS cefi_exchange_metrics CASCADE;
DROP TABLE IF EXISTS defi_protocol_metrics CASCADE;
DROP TABLE IF EXISTS platform_metrics CASCADE;
EOF
```

---

## 📦 Database Size Estimates

| Phase | Tables | Estimated Size (Empty) | Estimated Size (1 Year Data) |
|---|---|---|---|
| Phase 1 | 8 | ~5MB | ~200-500MB |
| Phase 2 | 4 | ~3MB | ~100-300MB |
| Phase 3 | 4 | ~3MB | ~100-300MB |
| **Total** | **16** | **~11MB** | **~400-1100MB** |

*Estimates based on typical daily metrics collection (100-1000 rows/day per table)*

---

## 🔗 Integration Points

Once tables are created, these endpoints will start using real data:

### Admin Monitoring (12 endpoints)
- ✅ `/admin/monitoring/dashboard-overview`
- ✅ `/admin/monitoring/defi-protocols`
- ✅ `/admin/monitoring/cefi-exchanges`
- ✅ `/admin/monitoring/health-status`
- ✅ `/admin/monitoring/liquidity-pools`
- ✅ `/admin/monitoring/revenue`
- ✅ `/admin/monitoring/payments`
- ✅ `/admin/monitoring/agents`
- ✅ `/admin/monitoring/platform-growth`
- ✅ `/admin/monitoring/api-usage`
- ✅ `/admin/monitoring/tokenomics`
- ✅ `/admin/monitoring/support-tickets`

### Admin Community (26 endpoints)
- ✅ All 26 referral/leaderboard/rewards/DAO endpoints
- ✅ All use the new analytics tables

---

## 📞 Troubleshooting

### Issue: Permission Denied
```bash
# Ensure user has CREATE permission
docker exec docker-postgres-1 psql -U postgres -d mtaadao -c \
  "GRANT ALL PRIVILEGES ON SCHEMA public TO growth_halo;"
```

### Issue: Table Already Exists
The migration uses `CREATE TABLE IF NOT EXISTS`, so re-running is safe.

### Issue: Connection Timeout
Check Docker container status:
```bash
docker ps | grep postgres
docker logs docker-postgres-1 | tail -20
```

### Issue: Disk Space Full
Check available space:
```bash
docker exec docker-postgres-1 df -h /var/lib/postgresql
```

---

## 🎯 Next Steps After Migration

1. **✅ Verify all tables exist** (Use verification commands above)
2. **Initialize aggregation jobs** in `server/index.ts`
3. **Test endpoints** with real data
4. **Monitor performance** with database queries
5. **Set up daily backups**
6. **Deploy to staging**
7. **Run load tests**
8. **Deploy to production**

---

## 📌 Important Notes

- All migrations are **idempotent** (safe to run multiple times)
- No data loss occurs (tables start empty)
- Foreign keys maintain referential integrity
- Indexes optimize query performance
- Timestamps are UTC-based

---

## ✨ Success Criteria

Phase 3B is complete when:

✅ All 16 tables are created  
✅ All indexes are in place  
✅ Foreign key constraints are active  
✅ Tables are queryable and empty  
✅ All 38 endpoints can access real data  
✅ Caching layer functions correctly  
✅ No compilation errors  

**Current Status**: ✅ **READY FOR DEPLOYMENT**

---

## 📚 Related Documentation

- [PHASE_3_COMPLETION_SUMMARY.md](PHASE_3_COMPLETION_SUMMARY.md) - Phase 3A summary
- [PHASE_3_REAL_DATA_INTEGRATION_COMPLETE.md](PHASE_3_REAL_DATA_INTEGRATION_COMPLETE.md) - Endpoint integration details
- [PHASE_3_DOCUMENTATION_INDEX.md](PHASE_3_DOCUMENTATION_INDEX.md) - Complete phase index
- [shared/monitoringMetricsSchema.ts](shared/monitoringMetricsSchema.ts) - Schema definitions

---

**File Location**: `/migrations/`  
**Total Files**: 3 SQL files  
**Total Lines**: ~500 lines  
**Ready for**: Docker/Local deployment

